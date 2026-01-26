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
import { authLogger as logger } from './logger.js';
import { AuthenticationError, ValidationError, ConflictError } from './errors.js';

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

// In-memory store for failed login attempts (consider Redis for multi-instance deployments)
const failedAttempts = new Map(); // email -> { count, lockoutUntil }

/**
 * Check if account is locked
 */
function checkAccountLockout(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const record = failedAttempts.get(normalizedEmail);
  
  if (!record) return false;
  
  // Check if lockout has expired
  if (record.lockoutUntil && Date.now() < record.lockoutUntil) {
    const remainingMinutes = Math.ceil((record.lockoutUntil - Date.now()) / 60000);
    throw new AuthenticationError(`Account locked. Try again in ${remainingMinutes} minute(s)`);
  }
  
  // Clear expired lockout
  if (record.lockoutUntil && Date.now() >= record.lockoutUntil) {
    failedAttempts.delete(normalizedEmail);
  }
  
  return false;
}

/**
 * Record a failed login attempt
 */
function recordFailedAttempt(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const record = failedAttempts.get(normalizedEmail) || { count: 0, lockoutUntil: null };
  
  record.count++;
  record.lastAttempt = Date.now();
  
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    logger.warn({ email: normalizedEmail, lockoutUntil: new Date(record.lockoutUntil).toISOString() }, 
      'Account locked due to too many failed attempts');
  }
  
  failedAttempts.set(normalizedEmail, record);
}

/**
 * Clear failed attempts on successful login
 */
function clearFailedAttempts(email) {
  const normalizedEmail = email.toLowerCase().trim();
  failedAttempts.delete(normalizedEmail);
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
  
  const payload = {
    userId: user.id || user.userId,
    email: user.email.toLowerCase(),
    name: user.name,
    role: user.role || 'learner'
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
  const savedUser = await usersStorage.saveUser(userData);
  
  logger.info({ email: normalizedEmail }, 'New user registered');
  
  const user = {
    id: savedUser.userId,
    userId: savedUser.userId,
    email: savedUser.email,
    name: savedUser.name,
    firstName: savedUser.firstName,
    lastName: savedUser.lastName,
    role: savedUser.role
  };

  return { 
    user: { 
      id: user.id,
      userId: user.id,
      email: user.email, 
      name: user.name,
      firstName: user.firstName || (user.name?.split(' ')[0] || user.name),
      lastName: user.lastName || (user.name?.split(' ').slice(1).join(' ') || ''),
      role: user.role,
      isAdmin: user.role === 'admin'
    }, 
    token: generateToken(user) 
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
  checkAccountLockout(normalizedEmail);
  
  const user = await usersStorage.getUserByEmail(normalizedEmail);
  if (!user) {
    // Record failed attempt even for non-existent users (prevent enumeration)
    recordFailedAttempt(normalizedEmail);
    // Use generic message to prevent user enumeration
    throw new AuthenticationError('Invalid credentials');
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    recordFailedAttempt(normalizedEmail);
    logger.warn({ email: normalizedEmail }, 'Failed login attempt');
    throw new AuthenticationError('Invalid credentials');
  }
  
  // Successful login - clear any failed attempts
  clearFailedAttempts(normalizedEmail);

  logger.info({ email: normalizedEmail }, 'User logged in');

  return {
    user: { 
      id: user.id, 
      userId: user.userId || user.id,
      email: user.email, 
      name: user.name,
      firstName: user.firstName || (user.name?.split(' ')[0] || user.name),
      lastName: user.lastName || (user.name?.split(' ').slice(1).join(' ') || ''),
      role: user.role,
      isAdmin: user.role === 'admin'
    },
    token: generateToken({
      id: user.id,
      userId: user.userId || user.id,
      email: user.email,
      name: user.name,
      role: user.role
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
  return { 
    id: user.id, 
    userId: user.userId || user.id,
    email: user.email, 
    name: user.name, 
    role: user.role 
  };
}

/**
 * Get all users (for admin)
 */
export async function getAllUsers() {
  return await usersStorage.getAllUsers();
}
