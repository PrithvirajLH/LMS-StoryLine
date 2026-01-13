/**
 * Azure Table Storage Configuration
 * Production-grade table setup for xAPI LRS
 */

// Import crypto polyfill before Azure SDK
import './crypto-polyfill.js';

import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables';
import dotenv from 'dotenv';

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
  VERB_STATS: 'VerbStatistics'
};

let credential = null;
let tableClients = {};

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
      console.log(`✓ Table '${tableName}' ready`);
    } catch (error) {
      if (error.statusCode === 409 || error.code === 'TableAlreadyExists') {
        // Table already exists
        console.log(`✓ Table '${tableName}' already exists`);
      } else {
        console.error(`✗ Failed to create table '${tableName}':`, error.message);
        throw error;
      }
    }
  }

  console.log('✓ Azure Table Storage initialized');
  return true;
}

/**
 * Get table client
 */
export function getTableClient(tableKey) {
  if (!tableClients[tableKey]) {
    // Create client on-demand if not initialized (for xAPI tables and other tables)
    const allowedOnDemandTables = ['COURSES', 'USER_PROGRESS', 'USERS', 'VERB_STATS', 'STATE', 'STATEMENTS', 'ACTIVITY_PROFILES', 'AGENT_PROFILES'];
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

/**
 * Generate partition key for statements
 * Uses userId (from actor) for efficient querying by learner
 */
export function getStatementPartitionKey(actor) {
  // Extract email from actor mbox (mailto:user@example.com)
  const mbox = actor.mbox || '';
  const email = mbox.replace('mailto:', '');
  
  // Use first part of email as partition (scales better than full email)
  // This groups statements by user domain/prefix for better distribution
  const prefix = email.split('@')[0] || 'unknown';
  
  // Limit partition key length (Azure limit is 1KB, but we keep it short)
  return prefix.substring(0, 50);
}

/**
 * Generate partition key for state
 * Combines activityId and userId for efficient lookups
 */
export function getStatePartitionKey(activityId, agent) {
  // Handle both object and string agent formats
  let mbox = '';
  if (typeof agent === 'string') {
    try {
      agent = JSON.parse(agent);
    } catch (e) {
      // If parsing fails, use as-is
    }
  }
  
  mbox = agent.mbox || agent.mbox_sha1sum || '';
  const email = mbox.replace('mailto:', '');
  const userPrefix = email.split('@')[0] || 'unknown';
  
  // Sanitize activityId (remove special chars that might break partition key)
  const cleanActivityId = activityId.replace(/[^a-zA-Z0-9:]/g, '_').substring(0, 30);
  
  // Combine activity and user for efficient queries
  // Azure partition key limit is 1KB, but we keep it short for performance
  return `${cleanActivityId}|${userPrefix.substring(0, 20)}`;
}

/**
 * Generate partition key for activity profiles
 */
export function getActivityProfilePartitionKey(activityId) {
  // Use activity ID as partition (all profiles for same activity together)
  return activityId.substring(0, 50);
}

/**
 * Generate partition key for agent profiles
 */
export function getAgentProfilePartitionKey(agent) {
  const mbox = agent.mbox || '';
  const email = mbox.replace('mailto:', '');
  const userPrefix = email.split('@')[0] || 'unknown';
  return userPrefix.substring(0, 50);
}

/**
 * Retry helper for Azure operations
 */
export async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

