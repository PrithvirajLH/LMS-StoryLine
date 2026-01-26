/**
 * Users Storage using Azure Table Storage
 * Production-grade user management for 15,000+ employees
 */

// Load environment variables (required for ES modules)
import dotenv from 'dotenv';
dotenv.config();

import { getTableClient, retryOperation, TABLES, sanitizeODataValue, buildODataEqFilter } from './azure-tables.js';
import bcrypt from 'bcrypt';
import { storageLogger as logger } from './logger.js';

const USERS_TABLE = 'Users';

// ============================================================================
// Default Admin Configuration - Use Environment Variables
// ============================================================================

const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD;
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || 'Admin User';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// Table Initialization
// ============================================================================

/**
 * Initialize users table
 */
export async function initializeUsersTable() {
  try {
    const client = getTableClient('USERS');
    // Table will be created automatically on first use
    logger.info({ table: TABLES.USERS }, 'Users table ready');
  } catch (error) {
    logger.error({ error: error.message }, 'Error initializing users table');
    throw error;
  }
}

// ============================================================================
// User CRUD Operations
// ============================================================================

/**
 * Get user by email
 */
export async function getUserByEmail(email) {
  if (!email) {
    return null;
  }
  
  const client = getTableClient('USERS');
  const partitionKey = 'user'; // Single partition for all users
  const rowKey = email.toLowerCase().trim(); // Use email as row key (normalized to lowercase)
  
  try {
    const entity = await client.getEntity(partitionKey, rowKey);
    return {
      id: entity.userId || entity.rowKey,
      userId: entity.userId || entity.rowKey,
      email: entity.email,
      name: entity.name,
      firstName: entity.firstName || (entity.name?.split(' ')[0] || entity.name),
      lastName: entity.lastName || (entity.name?.split(' ').slice(1).join(' ') || ''),
      password: entity.password, // Hashed password
      role: entity.role || 'learner',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return null;
    }
    throw error;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
  if (!userId) {
    return null;
  }
  
  const client = getTableClient('USERS');
  
  try {
    // Build safe OData filter using sanitization
    const filter = buildODataEqFilter('userId', userId);
    
    const iterator = client.listEntities({
      queryOptions: { filter }
    });
    
    for await (const entity of iterator) {
      return {
        id: entity.userId || entity.rowKey,
        userId: entity.userId || entity.rowKey,
        email: entity.email,
        name: entity.name,
        firstName: entity.firstName || (entity.name?.split(' ')[0] || entity.name),
        lastName: entity.lastName || (entity.name?.split(' ').slice(1).join(' ') || ''),
        password: entity.password,
        role: entity.role || 'learner',
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      };
    }
    
    return null;
  } catch (error) {
    logger.error({ userId, error: error.message }, 'Error getting user by ID');
    return null;
  }
}

/**
 * Create or update user
 */
export async function saveUser(user) {
  if (!user || !user.email) {
    throw new Error('User email is required');
  }
  
  const client = getTableClient('USERS');
  const partitionKey = 'user';
  const rowKey = user.email.toLowerCase().trim(); // Normalize email to lowercase
  
  // Generate userId if not provided
  if (!user.userId && !user.id) {
    // Use email as userId for consistency, or generate UUID-like ID
    user.userId = user.email;
  }
  
  // Combine firstName and lastName if provided, otherwise use name
  let fullName = user.name;
  if (user.firstName && user.lastName) {
    fullName = `${user.firstName.trim()} ${user.lastName.trim()}`.trim();
  } else if (user.firstName) {
    fullName = user.firstName.trim();
  } else if (!fullName) {
    fullName = user.email.split('@')[0];
  }

  const entity = {
    partitionKey: partitionKey,
    rowKey: rowKey,
    userId: user.userId || user.id || user.email,
    email: user.email.toLowerCase().trim(),
    name: fullName,
    firstName: user.firstName?.trim() || (fullName?.split(' ')[0] || fullName),
    lastName: user.lastName?.trim() || (fullName?.split(' ').slice(1).join(' ') || ''),
    password: user.password, // Should be hashed
    role: user.role || 'learner',
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  
  logger.debug({ email: entity.email, role: entity.role }, 'User saved');
  
  return entity;
}

/**
 * Get all users (for admin)
 */
export async function getAllUsers() {
  const client = getTableClient('USERS');
  const users = [];
  
  try {
    for await (const entity of client.listEntities()) {
      users.push({
        id: entity.userId || entity.rowKey,
        userId: entity.userId || entity.rowKey,
        email: entity.email,
        name: entity.name,
        firstName: entity.name?.split(' ')[0] || entity.name,
        lastName: entity.name?.split(' ').slice(1).join(' ') || '',
        role: entity.role || 'learner',
        isAdmin: entity.role === 'admin',
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      });
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting all users');
    return [];
  }
  
  return users;
}

/**
 * Delete user
 */
export async function deleteUser(email) {
  if (!email) {
    return false;
  }
  
  const client = getTableClient('USERS');
  const partitionKey = 'user';
  const rowKey = email.toLowerCase().trim();
  
  try {
    await client.deleteEntity(partitionKey, rowKey);
    logger.info({ email }, 'User deleted');
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return false; // User doesn't exist
    }
    throw error;
  }
}

// ============================================================================
// Default Admin Initialization
// ============================================================================

/**
 * Initialize default admin user if not exists
 * Uses environment variables for credentials (never hardcoded in production)
 */
export async function initializeDefaultAdmin() {
  try {
    const existingAdmin = await getUserByEmail(DEFAULT_ADMIN_EMAIL);
    if (existingAdmin) {
      logger.debug('Default admin user already exists');
      return;
    }
    
    // In production, require DEFAULT_ADMIN_PASSWORD to be set
    if (NODE_ENV === 'production' && !DEFAULT_ADMIN_PASSWORD) {
      logger.warn('DEFAULT_ADMIN_PASSWORD not set in production - skipping default admin creation');
      logger.warn('Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD environment variables to create an admin user');
      return;
    }
    
    // Use environment variable or secure default for development only
    const adminPassword = DEFAULT_ADMIN_PASSWORD || (NODE_ENV !== 'production' ? 'admin-dev-password-change-me' : null);
    
    if (!adminPassword) {
      logger.warn('Cannot create default admin - no password configured');
      return;
    }
    
    // Create default admin
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await saveUser({
      userId: '1',
      email: DEFAULT_ADMIN_EMAIL,
      password: hashedPassword,
      name: DEFAULT_ADMIN_NAME,
      role: 'admin'
    });
    
    if (NODE_ENV !== 'production') {
      // Only log credentials in development
      logger.info({ email: DEFAULT_ADMIN_EMAIL }, 'Default admin user created (development mode)');
    } else {
      logger.info('Default admin user created');
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error initializing default admin');
  }
}
