/**
 * xAPI Verb Tracker - Tracks and handles custom xAPI verbs
 * Supports verbs from https://registry.tincanapi.com/#home/verbs
 * Now with Azure Table Storage persistence
 */

import { getTableClient, retryOperation, TABLES } from './azure-tables.js';
import './crypto-polyfill.js';

/**
 * Encode verbId for use as Azure Table Storage RowKey
 * Azure RowKeys cannot contain: / \ # ?
 * Using base64url encoding (URL-safe base64)
 */
function encodeVerbIdForRowKey(verbId) {
  // Convert to base64url (URL-safe base64)
  return Buffer.from(verbId, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, ''); // Remove padding
}

/**
 * Decode verbId from Azure Table Storage RowKey
 */
function decodeVerbIdFromRowKey(encodedVerbId) {
  try {
    // Add padding back if needed
    let base64 = encodedVerbId.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch (e) {
    // If decoding fails, return as-is (might be an old unencoded value)
    return encodedVerbId;
  }
}

/**
 * Encode a string for use in Azure Table Storage RowKey
 * Encodes all special characters that Azure doesn't allow: / \ # ? | @
 */
function encodeForRowKey(str) {
  if (!str) return '';
  // Use base64url encoding for safety
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode a string from Azure Table Storage RowKey
 */
function decodeFromRowKey(encodedStr) {
  if (!encodedStr) return '';
  try {
    // Add padding back if needed
    let base64 = encodedStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch (e) {
    // If decoding fails, return as-is (might be an old unencoded value)
    return encodedStr;
  }
}

// Standard xAPI verbs from ADL registry
const STANDARD_VERBS = {
  // Completion verbs
  'http://adlnet.gov/expapi/verbs/completed': {
    category: 'completion',
    action: 'mark_completed',
    description: 'Course or activity completed'
  },
  'http://adlnet.gov/expapi/verbs/passed': {
    category: 'completion',
    action: 'mark_passed',
    description: 'Course or activity passed'
  },
  'http://adlnet.gov/expapi/verbs/failed': {
    category: 'completion',
    action: 'mark_failed',
    description: 'Course or activity failed'
  },
  
  // Progress verbs
  'http://adlnet.gov/expapi/verbs/initialized': {
    category: 'progress',
    action: 'mark_started',
    description: 'Activity initialized'
  },
  'http://adlnet.gov/expapi/verbs/launched': {
    category: 'progress',
    action: 'mark_launched',
    description: 'Activity launched'
  },
  'http://adlnet.gov/expapi/verbs/experienced': {
    category: 'progress',
    action: 'track_interaction',
    description: 'User experienced content'
  },
  'http://adlnet.gov/expapi/verbs/progressed': {
    category: 'progress',
    action: 'update_progress',
    description: 'Progress updated'
  },
  
  // Interaction verbs
  'http://adlnet.gov/expapi/verbs/interacted': {
    category: 'interaction',
    action: 'track_interaction',
    description: 'User interacted with content'
  },
  'http://adlnet.gov/expapi/verbs/answered': {
    category: 'interaction',
    action: 'track_answer',
    description: 'User answered question'
  },
  'http://adlnet.gov/expapi/verbs/attempted': {
    category: 'interaction',
    action: 'track_attempt',
    description: 'User attempted activity'
  },
  'http://adlnet.gov/expapi/verbs/accessed': {
    category: 'interaction',
    action: 'track_access',
    description: 'User accessed resource'
  },
  'http://adlnet.gov/expapi/verbs/bookmarked': {
    category: 'interaction',
    action: 'track_bookmark',
    description: 'User bookmarked content'
  },
  'http://adlnet.gov/expapi/verbs/shared': {
    category: 'interaction',
    action: 'track_share',
    description: 'User shared content'
  },
  'http://adlnet.gov/expapi/verbs/downloaded': {
    category: 'interaction',
    action: 'track_download',
    description: 'User downloaded resource'
  }
};

// Custom verb handlers configuration (loaded from Azure)
let CUSTOM_VERBS = {};

// Verb statistics tracking (persisted to Azure)
// In-memory cache for performance, synced to Azure
const verbStatsCache = new Map();
let isInitialized = false;

/**
 * Initialize verb tracker - load custom verbs and statistics from Azure
 */
export async function initializeVerbTracker() {
  if (isInitialized) return;
  
  try {
    await loadCustomVerbsFromAzure();
    await loadVerbStatsFromAzure();
    isInitialized = true;
    console.log('[Verb Tracker] Initialized with Azure persistence');
  } catch (error) {
    console.error('[Verb Tracker] Error initializing:', error);
    // Continue with empty state if Azure fails
    isInitialized = true;
  }
}

/**
 * Load custom verbs from Azure Table Storage
 */
async function loadCustomVerbsFromAzure() {
  CUSTOM_VERBS = {}; // Initialize to empty object
  
  try {
    const client = getTableClient('VERB_STATS');
    
    // Try to create table if it doesn't exist
    try {
      await client.createTable();
    } catch (createError) {
      if (createError.statusCode !== 409 && createError.code !== 'TableAlreadyExists') {
        // If we can't create the table, log and continue (don't break initialization)
        console.log('[Verb Tracker] Cannot create VerbStatistics table yet:', createError.message);
        return;
      }
    }
    
    // Try to list entities - filter in JavaScript instead of OData to avoid syntax issues
    try {
      for await (const entity of client.listEntities()) {
        // Filter by partition key in JavaScript (more reliable than OData filter)
        if (entity.partitionKey === 'custom_verbs') {
          // Decode verbId from RowKey (handles both encoded and unencoded for backward compatibility)
          const verbId = decodeVerbIdFromRowKey(entity.rowKey);
          try {
            CUSTOM_VERBS[verbId] = JSON.parse(entity.config || '{}');
            CUSTOM_VERBS[verbId].isCustom = true;
          } catch (e) {
            console.error(`[Verb Tracker] Error parsing custom verb ${verbId}:`, e);
          }
        }
      }
      
      console.log(`[Verb Tracker] Loaded ${Object.keys(CUSTOM_VERBS).length} custom verbs from Azure`);
    } catch (listError) {
      // If listing fails, table might not exist yet - that's OK
      if (listError.statusCode === 404 || listError.code === 'ResourceNotFound') {
        console.log('[Verb Tracker] VerbStatistics table not found, will be created on first use');
      } else {
        console.error('[Verb Tracker] Error listing custom verbs:', listError.message || listError);
      }
    }
  } catch (error) {
    if (error.message?.includes('not initialized')) {
      console.log('[Verb Tracker] VerbStatistics table not initialized yet, will be created on first use');
    } else {
      console.error('[Verb Tracker] Error loading custom verbs:', error.message || error);
    }
  }
}

/**
 * Load verb statistics from Azure Table Storage
 */
async function loadVerbStatsFromAzure() {
  verbStatsCache.clear(); // Initialize to empty cache
  
  try {
    const client = getTableClient('VERB_STATS');
    
    // Try to create table if it doesn't exist
    try {
      await client.createTable();
    } catch (createError) {
      if (createError.statusCode !== 409 && createError.code !== 'TableAlreadyExists') {
        // If we can't create the table, log and continue (don't break initialization)
        console.log('[Verb Tracker] Cannot create VerbStatistics table yet:', createError.message);
        return;
      }
    }
    
    // Try to list entities - filter in JavaScript instead of OData to avoid syntax issues
    try {
      for await (const entity of client.listEntities()) {
        // Filter by partition key in JavaScript (more reliable than OData filter)
        if (entity.partitionKey === 'verb_stats') {
          // Decode RowKey (handles both encoded and unencoded for backward compatibility)
          // RowKey format: encodedVerbId|encodedUserId|encodedActivityId
          let key = entity.rowKey;
          
          // If verbId, userId, activityId fields exist, reconstruct the key from original values
          if (entity.verbId && entity.userId && entity.activityId) {
            key = `${entity.verbId}|${entity.userId}|${entity.activityId}`;
          } else {
            // Try to decode all parts if they're encoded
            const parts = key.split('|');
            if (parts.length >= 3) {
              // Decode all three parts
              parts[0] = decodeFromRowKey(parts[0]); // verbId
              parts[1] = decodeFromRowKey(parts[1]); // userId
              parts[2] = decodeFromRowKey(parts[2]); // activityId
              key = parts.join('|');
            } else if (parts.length >= 1) {
              // Legacy format: only verbId was encoded
              parts[0] = decodeVerbIdFromRowKey(parts[0]);
              key = parts.join('|');
            }
          }
          
          const count = parseInt(entity.count || '0', 10);
          const lastUsed = entity.lastUsed || null;
          verbStatsCache.set(key, { count, lastUsed });
        }
      }
      
      console.log(`[Verb Tracker] Loaded ${verbStatsCache.size} verb statistics from Azure`);
    } catch (listError) {
      // If listing fails, table might not exist yet - that's OK
      if (listError.statusCode === 404 || listError.code === 'ResourceNotFound') {
        console.log('[Verb Tracker] VerbStatistics table not found, will be created on first use');
      } else {
        console.error('[Verb Tracker] Error listing verb statistics:', listError.message || listError);
      }
    }
  } catch (error) {
    if (error.message?.includes('not initialized')) {
      console.log('[Verb Tracker] VerbStatistics table not initialized yet, will be created on first use');
    } else {
      console.error('[Verb Tracker] Error loading verb statistics:', error.message || error);
    }
  }
}

/**
 * Save custom verb to Azure
 */
async function saveCustomVerbToAzure(verbId, config) {
  try {
    const client = getTableClient('VERB_STATS');
    
    // Ensure table exists
    try {
      await client.createTable();
    } catch (createError) {
      if (createError.statusCode !== 409 && createError.code !== 'TableAlreadyExists') {
        throw createError;
      }
    }
    
    // Encode verbId for RowKey (Azure doesn't allow / \ # ? in RowKeys)
    const encodedRowKey = encodeVerbIdForRowKey(verbId);
    
    const entity = {
      partitionKey: 'custom_verbs',
      rowKey: encodedRowKey,
      verbId: verbId, // Store original verbId as a field for easy access
      config: JSON.stringify(config),
      updatedAt: new Date().toISOString()
    };
    
    await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  } catch (error) {
    console.error(`[Verb Tracker] Error saving custom verb to Azure:`, error);
    throw error;
  }
}

/**
 * Delete custom verb from Azure
 */
async function deleteCustomVerbFromAzure(verbId) {
  try {
    const client = getTableClient('VERB_STATS');
    // Encode verbId for RowKey lookup
    const encodedRowKey = encodeVerbIdForRowKey(verbId);
    await retryOperation(() => client.deleteEntity('custom_verbs', encodedRowKey));
  } catch (error) {
    if (error.statusCode !== 404) {
      console.error(`[Verb Tracker] Error deleting custom verb from Azure:`, error);
      throw error;
    }
  }
}

/**
 * Save verb usage statistics to Azure
 */
async function saveVerbStatsToAzure(verbId, userId, activityId, count, lastUsed) {
  try {
    const client = getTableClient('VERB_STATS');
    
    // Ensure table exists
    try {
      await client.createTable();
    } catch (createError) {
      if (createError.statusCode !== 409 && createError.code !== 'TableAlreadyExists') {
        // If we can't create the table, log and continue (don't break the app)
        console.error(`[Verb Tracker] Cannot create VerbStatistics table:`, createError.message);
        return;
      }
    }
    
    // Encode all parts of the RowKey (Azure doesn't allow / \ # ? | @ in RowKeys)
    // Format: encodedVerbId|encodedUserId|encodedActivityId
    const encodedVerbId = encodeForRowKey(verbId);
    const encodedUserId = encodeForRowKey(userId);
    const encodedActivityId = encodeForRowKey(activityId);
    const key = `${encodedVerbId}|${encodedUserId}|${encodedActivityId}`;
    const entity = {
      partitionKey: 'verb_stats',
      rowKey: key,
      verbId: verbId, // Store original values as fields for easy access
      userId: userId,
      activityId: activityId,
      count: count.toString(),
      lastUsed: lastUsed || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  } catch (error) {
    console.error(`[Verb Tracker] Error saving verb stats to Azure:`, error);
    // Don't throw - stats are cached in memory, Azure write failure shouldn't break the app
  }
}

/**
 * Get verb configuration
 */
export function getVerbConfig(verbId) {
  if (!verbId) {
    return {
      category: 'unknown',
      action: 'track_verb',
      description: 'No verb ID provided',
      isCustom: false
    };
  }
  
  // Check custom verbs first
  if (CUSTOM_VERBS[verbId]) {
    return CUSTOM_VERBS[verbId];
  }
  
  // Check standard verbs
  if (STANDARD_VERBS[verbId]) {
    return STANDARD_VERBS[verbId];
  }
  
  // Check if verb ID contains keywords (fallback detection)
  const verbIdLower = verbId.toLowerCase();
  if (verbIdLower.includes('completed') || verbIdLower.includes('complete')) {
    return {
      category: 'completion',
      action: 'mark_completed',
      description: 'Completion verb (detected)',
      isDetected: true
    };
  }
  
  if (verbIdLower.includes('passed') || verbIdLower.includes('pass')) {
    return {
      category: 'completion',
      action: 'mark_passed',
      description: 'Pass verb (detected)',
      isDetected: true
    };
  }
  
  if (verbIdLower.includes('failed') || verbIdLower.includes('fail')) {
    return {
      category: 'completion',
      action: 'mark_failed',
      description: 'Fail verb (detected)',
      isDetected: true
    };
  }
  
  if (verbIdLower.includes('initialized') || verbIdLower.includes('launched') || verbIdLower.includes('started')) {
    return {
      category: 'progress',
      action: 'mark_started',
      description: 'Start verb (detected)',
      isDetected: true
    };
  }
  
  if (verbIdLower.includes('downloaded') || verbIdLower.includes('download')) {
    return {
      category: 'interaction',
      action: 'track_download',
      description: 'Download verb (detected)',
      isDetected: true
    };
  }
  
  // Unknown verb - return default
  return {
    category: 'unknown',
    action: 'track_verb',
    description: `Unknown verb: ${verbId}`,
    isCustom: false,
    isUnknown: true
  };
}

/**
 * Track verb usage for statistics (persisted to Azure)
 */
export async function trackVerbUsage(verbId, userId, activityId) {
  if (!verbId) return;
  
  const key = `${verbId}|${userId}|${activityId}`;
  const cached = verbStatsCache.get(key) || { count: 0, lastUsed: null };
  const newCount = cached.count + 1;
  const lastUsed = new Date().toISOString();
  
  // Update cache
  verbStatsCache.set(key, { count: newCount, lastUsed });
  
  // Persist to Azure (async, don't wait)
  saveVerbStatsToAzure(verbId, userId, activityId, newCount, lastUsed).catch(err => {
    console.error(`[Verb Tracker] Failed to persist verb stats:`, err);
  });
  
  // Log custom/unknown verbs
  const config = getVerbConfig(verbId);
  if (config.isCustom || config.isUnknown) {
    console.log(`[Verb Tracker] Custom/Unknown verb detected: ${verbId}`);
    console.log(`[Verb Tracker] User: ${userId}, Activity: ${activityId}`);
  }
}

/**
 * Get verb statistics (from cache, which is synced with Azure)
 */
export function getVerbStats() {
  const stats = {};
  
  verbStatsCache.forEach(({ count, lastUsed }, key) => {
    const [verbId, userId, activityId] = key.split('|');
    if (!stats[verbId]) {
      stats[verbId] = {
        verbId,
        totalCount: 0,
        users: new Set(),
        activities: new Set(),
        lastUsed: null
      };
    }
    stats[verbId].totalCount += count;
    stats[verbId].users.add(userId);
    stats[verbId].activities.add(activityId);
    
    // Track most recent lastUsed
    if (!stats[verbId].lastUsed || (lastUsed && lastUsed > stats[verbId].lastUsed)) {
      stats[verbId].lastUsed = lastUsed;
    }
  });
  
  // Convert Sets to arrays for JSON serialization
  Object.values(stats).forEach(stat => {
    stat.users = Array.from(stat.users);
    stat.activities = Array.from(stat.activities);
    stat.uniqueUsers = stat.users.length;
    stat.uniqueActivities = stat.activities.length;
  });
  
  return stats;
}

/**
 * Calculate verb statistics from stored xAPI statements
 * Useful for rebuilding stats or getting accurate counts
 */
export async function calculateVerbStatsFromStatements() {
  try {
    const client = getTableClient('STATEMENTS');
    const stats = {};
    
    console.log('[Verb Tracker] Calculating verb statistics from stored xAPI statements...');
    
    // Query all statements (this might be slow for large datasets)
    let count = 0;
    for await (const entity of client.listEntities()) {
      try {
        const statement = JSON.parse(entity.statement || '{}');
        const verbId = statement.verb?.id || '';
        const actor = statement.actor || {};
        const activityId = statement.object?.id || '';
        const userEmail = actor.mbox ? actor.mbox.replace('mailto:', '') : 'unknown';
        const timestamp = statement.timestamp || statement.stored || new Date().toISOString();
        
        if (!verbId) continue;
        
        if (!stats[verbId]) {
          stats[verbId] = {
            verbId,
            totalCount: 0,
            users: new Set(),
            activities: new Set(),
            lastUsed: null
          };
        }
        
        stats[verbId].totalCount++;
        stats[verbId].users.add(userEmail);
        stats[verbId].activities.add(activityId);
        
        if (!stats[verbId].lastUsed || timestamp > stats[verbId].lastUsed) {
          stats[verbId].lastUsed = timestamp;
        }
        
        count++;
        if (count % 1000 === 0) {
          console.log(`[Verb Tracker] Processed ${count} statements...`);
        }
      } catch (e) {
        console.error('[Verb Tracker] Error parsing statement:', e);
      }
    }
    
    // Convert Sets to arrays
    Object.values(stats).forEach(stat => {
      stat.users = Array.from(stat.users);
      stat.activities = Array.from(stat.activities);
      stat.uniqueUsers = stat.users.length;
      stat.uniqueActivities = stat.activities.length;
    });
    
    console.log(`[Verb Tracker] Calculated statistics from ${count} statements`);
    return stats;
  } catch (error) {
    console.error('[Verb Tracker] Error calculating stats from statements:', error);
    return {};
  }
}

/**
 * Process custom verb handler
 */
export async function processCustomVerb(statement, context) {
  const verbId = statement.verb?.id || '';
  const config = getVerbConfig(verbId);
  
  if (config.customHandler && typeof config.customHandler === 'function') {
    try {
      return await config.customHandler(statement, context);
    } catch (error) {
      console.error(`[Verb Tracker] Error in custom handler for ${verbId}:`, error);
      return null;
    }
  }
  
  return null;
}

/**
 * Check if verb indicates completion
 */
export function isCompletionVerb(verbId) {
  const config = getVerbConfig(verbId);
  return config.action === 'mark_completed' || 
         config.action === 'mark_passed' ||
         config.action === 'mark_failed' ||
         config.category === 'completion';
}

/**
 * Check if verb indicates start
 */
export function isStartVerb(verbId) {
  const config = getVerbConfig(verbId);
  return config.action === 'mark_started' || 
         config.action === 'mark_launched' ||
         config.category === 'progress';
}

/**
 * Get all tracked verbs
 */
export function getAllVerbs() {
  return {
    standard: STANDARD_VERBS,
    custom: CUSTOM_VERBS,
    stats: getVerbStats()
  };
}

/**
 * Add custom verb configuration (persisted to Azure)
 */
export async function addCustomVerb(verbId, config) {
  if (!verbId || !config) {
    throw new Error('verbId and config are required');
  }
  
  CUSTOM_VERBS[verbId] = {
    ...config,
    isCustom: true
  };
  
  // Persist to Azure
  await saveCustomVerbToAzure(verbId, CUSTOM_VERBS[verbId]);
  
  console.log(`[Verb Tracker] Added custom verb: ${verbId}`);
  return CUSTOM_VERBS[verbId];
}

/**
 * Update custom verb configuration (persisted to Azure)
 */
export async function updateCustomVerb(verbId, config) {
  if (!CUSTOM_VERBS[verbId]) {
    throw new Error(`Custom verb ${verbId} not found`);
  }
  
  CUSTOM_VERBS[verbId] = {
    ...CUSTOM_VERBS[verbId],
    ...config,
    isCustom: true
  };
  
  // Persist to Azure
  await saveCustomVerbToAzure(verbId, CUSTOM_VERBS[verbId]);
  
  console.log(`[Verb Tracker] Updated custom verb: ${verbId}`);
  return CUSTOM_VERBS[verbId];
}

/**
 * Remove custom verb (persisted to Azure)
 */
export async function removeCustomVerb(verbId) {
  if (!CUSTOM_VERBS[verbId]) {
    throw new Error(`Custom verb ${verbId} not found`);
  }
  
  delete CUSTOM_VERBS[verbId];
  
  // Delete from Azure
  await deleteCustomVerbFromAzure(verbId);
  
  console.log(`[Verb Tracker] Removed custom verb: ${verbId}`);
  return true;
}

/**
 * Get custom verb by ID
 */
export function getCustomVerb(verbId) {
  return CUSTOM_VERBS[verbId] || null;
}

/**
 * Get all custom verbs
 */
export function getAllCustomVerbs() {
  return CUSTOM_VERBS;
}
