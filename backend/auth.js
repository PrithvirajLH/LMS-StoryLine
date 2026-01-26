/**
 * Simple authentication for employees
 * Now using Azure Table Storage for production-grade user management
 */

// Load environment variables (required for ES modules where import order doesn't guarantee dotenv runs first)
import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import * as usersStorage from './users-storage.js';
import * as lockouts from './auth-lockouts.js';
import { authLogger as logger } from './logger.js';
import { AuthenticationError, ValidationError, ConflictError } from './errors.js';

const ROLE_ALIASES = {
  coach: ['instructionalCoach'],
  coordinator: ['learningCoordinator'],
  corporate: ['hr']
};

// ============================================================================
// Configuration - CRITICAL: JWT_SECRET must be set in production
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate JWT_SECRET is set in production
if (!JWT_SECRET) {
  if (NODE_ENV === 'production') {
    logger.fatal('JWT_SECRET environment variable is required in production');
    throw new Error('CRITICAL: JWT_SECRET environment variable must be set in production');
  } else {
    logger.warn('JWT_SECRET not set - using insecure default for development only');
  }
}

// Use a secure default only in development (never in production)
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-insecure-secret-change-in-production';

// Password requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const BCRYPT_ROUNDS = 12; // Increased from 10 for better security
const REQUIRE_PASSWORD_COMPLEXITY = process.env.REQUIRE_PASSWORD_COMPLEXITY !== 'false'; // Default true

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS || '5', 10);
const LOCKOUT_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10) * 60 * 1000;

function normalizeRoles(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const role = user?.role || 'learner';
  return Array.from(new Set([...roles, role].filter(Boolean)));
}

function hasRole(roles, role) {
  if (roles.includes(role)) return true;
  const aliases = ROLE_ALIASES[role] || [];
  return aliases.some((alias) => roles.includes(alias));
}

function buildRoleFlags(roles, user = {}) {
  return {
    isAdmin: hasRole(roles, 'admin') || user.isAdmin === true,
    isManager: hasRole(roles, 'manager') || user.isManager === true,
    isCoordinator: hasRole(roles, 'coordinator') || user.isCoordinator === true || user.isLearningCoordinator === true,
    isLearningCoordinator: hasRole(roles, 'learningCoordinator') || user.isLearningCoordinator === true,
    isCoach: hasRole(roles, 'coach') || user.isCoach === true || user.isInstructionalCoach === true,
    isInstructionalCoach: hasRole(roles, 'instructionalCoach') || user.isInstructionalCoach === true,
    isCorporate: hasRole(roles, 'corporate') || user.isCorporate === true || user.isHr === true,
    isHr: hasRole(roles, 'hr') || user.isHr === true,
    isLearner: hasRole(roles, 'learner') || user.isLearner === true
  };
}

export function buildAuthUser(user) {
  const roles = normalizeRoles(user);
  const roleFlags = buildRoleFlags(roles, user);

  return {
    id: user.id,
    userId: user.userId || user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName || (user.name?.split(' ')[0] || user.name),
    lastName: user.lastName || (user.name?.split(' ').slice(1).join(' ') || ''),
    role: user.role || 'learner',
    roles,
    providerId: user.providerId || null,
    ...roleFlags
  };
}

/**
 * Check if account is locked
 */
async function checkAccountLockout(email) {
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const record = await lockouts.getLockout(normalizedEmail);
    if (!record) return false;

    const lockoutUntilMs = record.lockoutUntil ? new Date(record.lockoutUntil).getTime() : null;
    if (lockoutUntilMs && Date.now() < lockoutUntilMs) {
      const remainingMinutes = Math.ceil((lockoutUntilMs - Date.now()) / 60000);
      throw new AuthenticationError(`Account locked. Try again in ${remainingMinutes} minute(s)`);
    }

    if (lockoutUntilMs && Date.now() >= lockoutUntilMs) {
      await lockouts.clearLockout(normalizedEmail);
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    logger.warn({ error: error.message }, 'Lockout check failed; continuing without lockout');
  }

  return false;
}

/**
 * Record a failed login attempt
 */
async function recordFailedAttempt(email) {
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const record = await lockouts.getLockout(normalizedEmail);
    const count = (record?.failedAttempts || 0) + 1;
    const lockoutUntil = count >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
      : record?.lockoutUntil || null;

    await lockouts.upsertLockout(normalizedEmail, {
      failedAttempts: count,
      lockoutUntil,
      lastAttempt: new Date().toISOString()
    });

    if (lockoutUntil && count >= MAX_FAILED_ATTEMPTS) {
      logger.warn({ email: normalizedEmail, lockoutUntil }, 'Account locked due to too many failed attempts');
    }
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to record lockout state');
  }
}

/**
 * Clear failed attempts on successful login
 */
async function clearFailedAttempts(email) {
  const normalizedEmail = email.toLowerCase().trim();
  try {
    await lockouts.clearLockout(normalizedEmail);
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to clear lockout state');
  }
}

// Initialize default admin user on module load
// This will create the admin user in Azure Table Storage if it doesn't exist
usersStorage.initializeDefaultAdmin().catch(err => {
  logger.error({ error: err.message }, 'Error initializing default admin');
});

/**
 * Validate password strength
 * Enforces complexity requirements: uppercase, lowercase, number, special char
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required');
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ValidationError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new ValidationError(`Password must be less than ${PASSWORD_MAX_LENGTH} characters`);
  }
  
  // Complexity requirements (can be disabled via REQUIRE_PASSWORD_COMPLEXITY=false)
  if (REQUIRE_PASSWORD_COMPLEXITY) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    const missing = [];
    if (!hasUppercase) missing.push('uppercase letter');
    if (!hasLowercase) missing.push('lowercase letter');
    if (!hasNumber) missing.push('number');
    if (!hasSpecial) missing.push('special character (!@#$%^&*...)');
    
    if (missing.length > 0) {
      throw new ValidationError(`Password must contain: ${missing.join(', ')}`);
    }
  }
  
  return true;
}

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
  if (email.length > 255) {
    throw new ValidationError('Email must be less than 255 characters');
  }
  return email.toLowerCase().trim();
}

/**
 * Hash password
 */
export async function hashPassword(password) {
  validatePassword(password);
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password
 */
export async function verifyPassword(password, hash) {
  if (!password || !hash) {
    return false;
  }
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(user) {
  if (!user || !user.email) {
    throw new ValidationError('User email is required for token generation');
  }
  
  const roles = normalizeRoles(user);
  const roleFlags = buildRoleFlags(roles, user);

  const payload = {
    userId: user.id || user.userId,
    email: user.email.toLowerCase(),
    name: user.name,
    role: user.role || 'learner',
    roles,
    ...roleFlags
  };
  
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { 
    expiresIn: JWT_EXPIRY,
    issuer: 'lms-backend',
    audience: 'lms-frontend'
  });
}

/**
 * Verify JWT token
 * Backwards compatible: accepts tokens with or without issuer/audience
 * (for transition period from older tokens)
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  try {
    // First try with strict issuer/audience validation (new tokens)
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET, {
      issuer: 'lms-backend',
      audience: 'lms-frontend'
    });
    return decoded;
  } catch (error) {
    // If issuer/audience mismatch, try without them (legacy tokens)
    if (error.message?.includes('issuer') || error.message?.includes('audience') || 
        error.message?.includes('iss') || error.message?.includes('aud')) {
      try {
        const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
        logger.debug('Legacy token accepted (no issuer/audience)');
        return decoded;
      } catch (legacyError) {
        if (legacyError.name !== 'TokenExpiredError') {
          logger.debug({ error: legacyError.message }, 'Legacy token verification failed');
        }
        return null;
      }
    }
    
    // Log token verification failures (except for expired tokens which are normal)
    if (error.name !== 'TokenExpiredError') {
      logger.debug({ error: error.message }, 'Token verification failed');
    }
    return null;
  }
}

/**
 * Register new user
 */
export async function register(email, password, name, firstName, lastName) {
  // Validate inputs
  const normalizedEmail = validateEmail(email);
  validatePassword(password);
  
  // Check if user exists
  const existing = await usersStorage.getUserByEmail(normalizedEmail);
  if (existing) {
    throw new ConflictError('User already exists');
  }

  // Create user
  const hashedPassword = await hashPassword(password);
  
  // Sanitize name inputs
  const sanitizedFirstName = firstName?.trim().substring(0, 100);
  const sanitizedLastName = lastName?.trim().substring(0, 100);
  const sanitizedName = name?.trim().substring(0, 200);
  
  const fullName = (sanitizedFirstName && sanitizedLastName) 
    ? `${sanitizedFirstName} ${sanitizedLastName}`.trim()
    : (sanitizedName || normalizedEmail.split('@')[0]);

  const userData = {
    email: normalizedEmail,
    password: hashedPassword,
    name: fullName,
    firstName: sanitizedFirstName,
    lastName: sanitizedLastName,
    role: 'learner'
  };

  // Save to Azure Table Storage
  await usersStorage.saveUser(userData);
  const savedUser = await usersStorage.getUserByEmail(normalizedEmail);
  
  logger.info({ email: normalizedEmail }, 'New user registered');
  
  if (!savedUser) {
    throw new Error('Failed to load newly created user');
  }

  return { 
    user: buildAuthUser(savedUser),
    token: generateToken(savedUser) 
  };
}

/**
 * Login user
 */
export async function login(email, password) {
  // Validate inputs
  const normalizedEmail = validateEmail(email);
  
  if (!password) {
    throw new AuthenticationError('Password is required');
  }
  
  // Check account lockout BEFORE checking credentials
  await checkAccountLockout(normalizedEmail);
  
  const user = await usersStorage.getUserByEmail(normalizedEmail);
  if (!user) {
    // Record failed attempt even for non-existent users (prevent enumeration)
    await recordFailedAttempt(normalizedEmail);
    // Use generic message to prevent user enumeration
    throw new AuthenticationError('Invalid credentials');
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    await recordFailedAttempt(normalizedEmail);
    logger.warn({ email: normalizedEmail }, 'Failed login attempt');
    throw new AuthenticationError('Invalid credentials');
  }
  
  // Successful login - clear any failed attempts
  await clearFailedAttempts(normalizedEmail);

  logger.info({ email: normalizedEmail }, 'User logged in');

  return {
    user: buildAuthUser(user),
    token: generateToken({
      id: user.id,
      userId: user.userId || user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles: user.roles,
      isAdmin: user.isAdmin,
      isManager: user.isManager,
      isCoordinator: user.isCoordinator,
      isLearningCoordinator: user.isLearningCoordinator,
      isCoach: user.isCoach,
      isInstructionalCoach: user.isInstructionalCoach,
      isCorporate: user.isCorporate,
      isHr: user.isHr,
      isLearner: user.isLearner
    })
  };
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
  if (!userId) {
    return null;
  }
  
  const user = await usersStorage.getUserById(userId);
  if (!user) {
    return null;
  }
  return buildAuthUser(user);
}

/**
 * Get all users (for admin)
 */
export async function getAllUsers() {
  return await usersStorage.getAllUsers();
}
