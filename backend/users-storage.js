/**
 * Users Storage using Azure Table Storage
 * Production-grade user management for 15,000+ employees
 */

import { getTableClient, retryOperation, TABLES } from './azure-tables.js';
import bcrypt from 'bcrypt';

const USERS_TABLE = 'Users';

/**
 * Initialize users table
 */
export async function initializeUsersTable() {
  try {
    const client = getTableClient('USERS');
    // Table will be created automatically on first use
    console.log(`✓ Users table '${TABLES.USERS}' ready`);
  } catch (error) {
    console.error(`[Users Storage] Error initializing table:`, error);
    throw error;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email) {
  const client = getTableClient('USERS');
  const partitionKey = 'user'; // Single partition for all users
  const rowKey = email.toLowerCase(); // Use email as row key (normalized to lowercase)
  
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
  const client = getTableClient('USERS');
  const partitionKey = 'user';
  
  try {
    // Query by userId field (since rowKey is email)
    const iterator = client.listEntities({
      queryOptions: { filter: `userId eq '${userId}'` }
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
    console.error('[Users Storage] Error getting user by ID:', error);
    return null;
  }
}

/**
 * Create or update user
 */
export async function saveUser(user) {
  const client = getTableClient('USERS');
  const partitionKey = 'user';
  const rowKey = user.email.toLowerCase(); // Normalize email to lowercase
  
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
    email: user.email,
    name: fullName,
    firstName: user.firstName || (fullName?.split(' ')[0] || fullName),
    lastName: user.lastName || (fullName?.split(' ').slice(1).join(' ') || ''),
    password: user.password, // Should be hashed
    role: user.role || 'learner',
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
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
    console.error('[Users Storage] Error getting all users:', error);
    return [];
  }
  
  return users;
}

/**
 * Delete user
 */
export async function deleteUser(email) {
  const client = getTableClient('USERS');
  const partitionKey = 'user';
  const rowKey = email.toLowerCase();
  
  try {
    await client.deleteEntity(partitionKey, rowKey);
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return false; // User doesn't exist
    }
    throw error;
  }
}

/**
 * Initialize default admin user if not exists
 */
export async function initializeDefaultAdmin() {
  try {
    const existingAdmin = await getUserByEmail('admin@example.com');
    if (existingAdmin) {
      console.log('✓ Default admin user already exists');
      return;
    }
    
    // Create default admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await saveUser({
      userId: '1',
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin'
    });
    
    console.log('✓ Default admin user created (email: admin@example.com, password: admin123)');
  } catch (error) {
    console.error('[Users Storage] Error initializing default admin:', error);
  }
}

