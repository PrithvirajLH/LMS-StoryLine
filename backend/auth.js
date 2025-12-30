/**
 * Simple authentication for employees
 * Now using Azure Table Storage for production-grade user management
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import * as usersStorage from './users-storage.js';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRY = '7d';

// Initialize default admin user on module load
// This will create the admin user in Azure Table Storage if it doesn't exist
usersStorage.initializeDefaultAdmin().catch(err => {
  console.error('[Auth] Error initializing default admin:', err);
});

/**
 * Hash password
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * Verify password
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Register new user
 */
export async function register(email, password, name) {
  // Check if user exists
  const existing = await usersStorage.getUserByEmail(email);
  if (existing) {
    throw new Error('User already exists');
  }

  // Create user
  const hashedPassword = await hashPassword(password);
  const userData = {
    email: email.toLowerCase(), // Normalize email
    password: hashedPassword,
    name: name || email.split('@')[0],
    role: 'learner'
  };

  // Save to Azure Table Storage
  const savedUser = await usersStorage.saveUser(userData);
  
  const user = {
    id: savedUser.userId,
    userId: savedUser.userId,
    email: savedUser.email,
    name: savedUser.name,
    role: savedUser.role
  };

  return { 
    user: { 
      id: user.id,
      userId: user.id,
      email: user.email, 
      name: user.name,
      firstName: user.name?.split(' ')[0] || user.name,
      lastName: user.name?.split(' ').slice(1).join(' ') || '',
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
  const user = await usersStorage.getUserByEmail(email.toLowerCase());
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  return {
    user: { 
      id: user.id, 
      userId: user.userId || user.id, // Also include userId for frontend compatibility
      email: user.email, 
      name: user.name,
      firstName: user.name?.split(' ')[0] || user.name,
      lastName: user.name?.split(' ').slice(1).join(' ') || '',
      role: user.role,
      isAdmin: user.role === 'admin' // Convert role to isAdmin boolean for frontend
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

