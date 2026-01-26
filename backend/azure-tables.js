/**
 * Azure Table Storage Configuration
 * Production-grade table setup for xAPI LRS
 */

// Import crypto polyfill before Azure SDK
import './crypto-polyfill.js';

import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables';
import dotenv from 'dotenv';
import { storageLogger as logger } from './logger.js';

dotenv.config();

const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const STORAGE_TABLE_ENDPOINT = process.env.AZURE_STORAGE_TABLE_ENDPOINT || 
  `https://${STORAGE_ACCOUNT_NAME}.table.core.windows.net`;

// Table names
export const TABLES = {
  STATEMENTS: 'xapiStatements',
  STATE: 'xapiState',
  ACTIVITY_PROFILES: 'xapiActivityProfiles',
  AGENT_PROFILES: 'xapiAgentProfiles',
  COURSES: 'Courses',
  USER_PROGRESS: 'UserProgress',
  USERS: 'Users',
  VERB_STATS: 'VerbStatistics',
  COURSE_ATTEMPTS: 'CourseAttempts',
  MODULE_RULES: 'ModuleRules'
};

let credential = null;
let tableClients = {};

// ============================================================================
// OData Filter Sanitization - SECURITY CRITICAL
// Prevents OData injection attacks
// ============================================================================

/**
 * Sanitize a string value for use in OData filters
 * Escapes single quotes and removes dangerous characters
 * @param {string} value - The value to sanitize
 * @returns {string} - Sanitized value safe for OData
 */
export function sanitizeODataValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Convert to string if not already
  const str = String(value);
  
  // Escape single quotes by doubling them (OData standard)
  // Also remove any control characters that could be problematic
  return str
    .replace(/'/g, "''")  // Escape single quotes
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, 1000); // Limit length to prevent DoS
}

/**
 * Build a safe OData equality filter
 * @param {string} field - The field name
 * @param {string} value - The value to match
 * @returns {string} - Safe OData filter string
 */
export function buildODataEqFilter(field, value) {
  if (!field || value === null || value === undefined) {
    return '';
  }
  
  // Validate field name (only alphanumeric and underscore allowed)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
    throw new Error(`Invalid OData field name: ${field}`);
  }
  
  return `${field} eq '${sanitizeODataValue(value)}'`;
}

/**
 * Build a safe OData filter with multiple conditions
 * @param {Array<{field: string, value: string, operator?: string}>} conditions - Array of conditions
 * @param {string} conjunction - 'and' or 'or'
 * @returns {string} - Safe OData filter string
 */
export function buildODataFilter(conditions, conjunction = 'and') {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return '';
  }
  
  const validConditions = conditions
    .filter(c => c.field && c.value !== null && c.value !== undefined)
    .map(c => {
      const operator = c.operator || 'eq';
      if (!['eq', 'ne', 'gt', 'ge', 'lt', 'le'].includes(operator)) {
        throw new Error(`Invalid OData operator: ${operator}`);
      }
      return `${c.field} ${operator} '${sanitizeODataValue(c.value)}'`;
    });
  
  if (validConditions.length === 0) {
    return '';
  }
  
  return validConditions.join(` ${conjunction} `);
}

// ============================================================================
// Partition Key Sanitization
// ============================================================================

/**
 * Sanitize a value for use as partition/row key
 * Azure Table Storage keys cannot contain: \ / # ?
 * @param {string} value - The value to sanitize
 * @returns {string} - Sanitized key
 */
export function sanitizePartitionKey(value) {
  if (!value) return 'unknown';
  return String(value)
    .replace(/[\\/#?]/g, '_')
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, 200);
}

// ============================================================================
// Table Initialization
// ============================================================================

/**
 * Initialize Azure Table Storage
 */
export async function initializeTables() {
  if (!STORAGE_ACCOUNT_NAME || !STORAGE_ACCOUNT_KEY) {
    throw new Error('Azure Storage credentials not configured. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY');
  }

  credential = new AzureNamedKeyCredential(STORAGE_ACCOUNT_NAME, STORAGE_ACCOUNT_KEY);

  // Initialize table clients
  for (const [key, tableName] of Object.entries(TABLES)) {
    const client = new TableClient(STORAGE_TABLE_ENDPOINT, tableName, credential);
    tableClients[key] = client;

    // Create table if it doesn't exist
    try {
      await client.createTable();
      logger.info({ table: tableName }, 'Table created');
    } catch (error) {
      if (error.statusCode === 409 || error.code === 'TableAlreadyExists') {
        logger.debug({ table: tableName }, 'Table already exists');
      } else {
        logger.error({ table: tableName, error: error.message }, 'Failed to create table');
        throw error;
      }
    }
  }

  logger.info('Azure Table Storage initialized');
  return true;
}

/**
 * Get table client
 */
export function getTableClient(tableKey) {
  if (!tableClients[tableKey]) {
    // Create client on-demand if not initialized (for xAPI tables and other tables)
    const allowedOnDemandTables = ['COURSES', 'USER_PROGRESS', 'USERS', 'VERB_STATS', 'STATE', 'STATEMENTS', 'ACTIVITY_PROFILES', 'AGENT_PROFILES', 'COURSE_ATTEMPTS', 'MODULE_RULES'];
    if (allowedOnDemandTables.includes(tableKey) && STORAGE_ACCOUNT_NAME && STORAGE_ACCOUNT_KEY) {
      if (!credential) {
        credential = new AzureNamedKeyCredential(STORAGE_ACCOUNT_NAME, STORAGE_ACCOUNT_KEY);
      }
      const tableName = TABLES[tableKey];
      if (!tableName) {
        throw new Error(`Unknown table key: ${tableKey}`);
      }
      const client = new TableClient(STORAGE_TABLE_ENDPOINT, tableName, credential);
      tableClients[tableKey] = client;
      return client;
    }
    throw new Error(`Table client '${tableKey}' not initialized`);
  }
  return tableClients[tableKey];
}

// ============================================================================
// Actor Identifier Helpers
// ============================================================================

export function getActorIdentifier(actor) {
  if (!actor) return 'unknown';
  const mbox = actor.mbox || '';
  if (mbox) {
    return mbox.replace('mailto:', '').toLowerCase();
  }
  const accountName = actor.account?.name || '';
  if (accountName) {
    const homePage = actor.account?.homePage || 'account';
    return `${homePage}|${accountName}`.toLowerCase();
  }
  return 'unknown';
}

/**
 * Generate partition key for statements
 * Uses full actor identifier for correct isolation
 */
export function getStatementPartitionKey(actor) {
  const identifier = getActorIdentifier(actor);
  return sanitizePartitionKey(identifier);
}

/**
 * Legacy partition key (email local-part)
 * Used only for compatibility queries
 */
export function getLegacyStatementPartitionKey(actor) {
  const mbox = actor?.mbox || '';
  const email = mbox.replace('mailto:', '');
  const prefix = email.split('@')[0] || 'unknown';
  return sanitizePartitionKey(prefix.substring(0, 50));
}

/**
 * Partition keys for statement queries (new + legacy)
 */
export function getStatementPartitionKeys(actor) {
  const keys = new Set();
  keys.add(getStatementPartitionKey(actor));
  const legacy = getLegacyStatementPartitionKey(actor);
  if (legacy) {
    keys.add(legacy);
  }
  return Array.from(keys);
}

/**
 * Generate partition key for state
 * Combines activityId and userId for efficient lookups
 */
export function getStatePartitionKey(activityId, agent) {
  // Handle both object and string agent formats
  let mbox = '';
  let parsedAgent = agent;
  
  if (typeof agent === 'string') {
    try {
      parsedAgent = JSON.parse(agent);
    } catch (e) {
      // If parsing fails, use as-is
      parsedAgent = { mbox: '' };
    }
  }
  
  mbox = parsedAgent?.mbox || parsedAgent?.mbox_sha1sum || '';
  const email = mbox.replace('mailto:', '');
  const userPrefix = email.split('@')[0] || 'unknown';
  
  // Sanitize activityId (remove special chars that might break partition key)
  const cleanActivityId = sanitizePartitionKey(activityId).substring(0, 30);
  
  // Combine activity and user for efficient queries
  // Azure partition key limit is 1KB, but we keep it short for performance
  return `${cleanActivityId}|${sanitizePartitionKey(userPrefix).substring(0, 20)}`;
}

/**
 * Generate partition key for activity profiles
 */
export function getActivityProfilePartitionKey(activityId) {
  // Use activity ID as partition (all profiles for same activity together)
  return sanitizePartitionKey(activityId).substring(0, 50);
}

/**
 * Generate partition key for agent profiles
 */
export function getAgentProfilePartitionKey(agent) {
  const mbox = agent?.mbox || '';
  const email = mbox.replace('mailto:', '');
  const userPrefix = email.split('@')[0] || 'unknown';
  return sanitizePartitionKey(userPrefix).substring(0, 50);
}

// ============================================================================
// Retry Helper
// ============================================================================

/**
 * Retry helper for Azure operations with exponential backoff
 */
export async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        throw error;
      }
      
      if (i === maxRetries - 1) break;
      
      // Exponential backoff with jitter
      const jitter = Math.random() * 500;
      const backoffMs = delay * Math.pow(2, i) + jitter;
      
      logger.debug({ attempt: i + 1, backoffMs }, 'Retrying Azure operation');
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  throw lastError;
}
