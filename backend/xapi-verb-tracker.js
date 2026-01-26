/**
 * xAPI Verb Tracker - Tracks and handles custom xAPI verbs
 * Supports verbs from https://registry.tincanapi.com/#home/verbs
 * Now with Azure Table Storage persistence
 */

import { getTableClient, retryOperation, TABLES } from './azure-tables.js';
import './crypto-polyfill.js';
import { verbLogger as logger } from './logger.js';

// ============================================================================
// Encoding Helpers for Azure Table Storage
// ============================================================================

/**
 * Encode verbId for use as Azure Table Storage RowKey
 * Azure RowKeys cannot contain: / \ # ?
 */
function encodeVerbIdForRowKey(verbId) {
  return Buffer.from(verbId, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode verbId from Azure Table Storage RowKey
 */
function decodeVerbIdFromRowKey(encodedVerbId) {
  try {
    let base64 = encodedVerbId.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch (e) {
    return encodedVerbId;
  }
}

/**
 * Encode a string for use in Azure Table Storage RowKey
 */
function encodeForRowKey(str) {
  if (!str) return '';
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
    let base64 = encodedStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch (e) {
    return encodedStr;
  }
}

// ============================================================================
// Standard Verbs Configuration
// ============================================================================

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

// Custom verb handlers (loaded from Azure)
let CUSTOM_VERBS = {};

// Verb statistics cache with LRU eviction (synced with Azure)
const MAX_CACHE_SIZE = parseInt(process.env.VERB_CACHE_MAX_SIZE || '10000', 10);
const verbStatsCache = new Map();
let isInitialized = false;

/**
 * LRU eviction - remove oldest entries when cache exceeds max size
 */
function evictOldestCacheEntries() {
  if (verbStatsCache.size <= MAX_CACHE_SIZE) return;
  
  // Sort by lastUsed time and remove oldest entries
  const entries = Array.from(verbStatsCache.entries());
  entries.sort((a, b) => {
    const timeA = a[1].lastUsed ? new Date(a[1].lastUsed).getTime() : 0;
    const timeB = b[1].lastUsed ? new Date(b[1].lastUsed).getTime() : 0;
    return timeA - timeB;
  });
  
  // Remove oldest 10% when over limit
  const toRemove = Math.ceil(entries.length * 0.1);
  for (let i = 0; i < toRemove; i++) {
    verbStatsCache.delete(entries[i][0]);
  }
  
  logger.debug({ removed: toRemove, remaining: verbStatsCache.size }, 'Evicted old cache entries');
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize verb tracker - load custom verbs and statistics from Azure
 */
export async function initializeVerbTracker() {
  if (isInitialized) return;
  
  try {
    await loadCustomVerbsFromAzure();
    await loadVerbStatsFromAzure();
    isInitialized = true;
    logger.info('Verb tracker initialized');
  } catch (error) {
    logger.error({ error: error.message }, 'Error initializing verb tracker');
    isInitialized = true;
  }
}

/**
 * Load custom verbs from Azure Table Storage
 */
async function loadCustomVerbsFromAzure() {
  CUSTOM_VERBS = {};
  
  try {
    const client = getTableClient('VERB_STATS');
    
    try {
      await client.createTable();
    } catch (createError) {
      if (createError.statusCode !== 409 && createError.code !== 'TableAlreadyExists') {
        logger.debug({ error: createError.message }, 'Cannot create VerbStatistics table yet');
        return;
      }
    }
    
    try {
      for await (const entity of client.listEntities()) {
        if (entity.partitionKey === 'custom_verbs') {
          const verbId = decodeVerbIdFromRowKey(entity.rowKey);
          try {
            CUSTOM_VERBS[verbId] = JSON.parse(entity.config || '{}');
            CUSTOM_VERBS[verbId].isCustom = true;
          } catch (e) {
            logger.error({ verbId, error: e.message }, 'Error parsing custom verb');
          }
        }
      }
      
      logger.debug({ count: Object.keys(CUSTOM_VERBS).length }, 'Custom verbs loaded');
    } catch (listError) {
      if (listError.statusCode === 404 || listError.code === 'ResourceNotFound') {
        logger.debug('VerbStatistics table not found');
      } else {
        logger.error({ error: listError.message }, 'Error listing custom verbs');
      }
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error loading custom verbs');
  }
}

/**
 * Load verb statistics from Azure Table Storage
 */
async function loadVerbStatsFromAzure() {
  verbStatsCache.clear();
  
  try {
    const client = getTableClient('VERB_STATS');
    
    try {
      await client.createTable();
    } catch (createError) {
      if (createError.statusCode !== 409 && createError.code !== 'TableAlreadyExists') {
        return;
      }
    }
    
    try {
      for await (const entity of client.listEntities()) {
        if (entity.partitionKey === 'verb_stats') {
          let key = entity.rowKey;
          
          if (entity.verbId && entity.userId && entity.activityId) {
            key = `${entity.verbId}|${entity.userId}|${entity.activityId}`;
          } else {
            const parts = key.split('|');
            if (parts.length >= 3) {
              parts[0] = decodeFromRowKey(parts[0]);
              parts[1] = decodeFromRowKey(parts[1]);
              parts[2] = decodeFromRowKey(parts[2]);
              key = parts.join('|');
            } else if (parts.length >= 1) {
              parts[0] = decodeVerbIdFromRowKey(parts[0]);
              key = parts.join('|');
            }
          }
          
          const count = parseInt(entity.count || '0', 10);
          const lastUsed = entity.lastUsed || null;
          verbStatsCache.set(key, { count, lastUsed });
        }
      }
      
      logger.debug({ count: verbStatsCache.size }, 'Verb statistics loaded');
    } catch (listError) {
      if (listError.statusCode !== 404 && listError.code !== 'ResourceNotFound') {
        logger.error({ error: listError.message }, 'Error listing verb statistics');
      }
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error loading verb statistics');
  }
}

// ============================================================================
// Verb Statistics Persistence
// ============================================================================

/**
 * Save custom verb to Azure
 */
async function saveCustomVerbToAzure(verbId, config) {
  try {
    const client = getTableClient('VERB_STATS');
    
    try {
      await client.createTable();
    } catch (createError) {
      if (createError.statusCode !== 409 && createError.code !== 'TableAlreadyExists') {
        throw createError;
      }
    }
    
    const encodedRowKey = encodeVerbIdForRowKey(verbId);
    
    const entity = {
      partitionKey: 'custom_verbs',
      rowKey: encodedRowKey,
      verbId: verbId,
      config: JSON.stringify(config),
      updatedAt: new Date().toISOString()
    };
    
    await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  } catch (error) {
    logger.error({ verbId, error: error.message }, 'Error saving custom verb');
    throw error;
  }
}

/**
 * Delete custom verb from Azure
 */
async function deleteCustomVerbFromAzure(verbId) {
  try {
    const client = getTableClient('VERB_STATS');
    const encodedRowKey = encodeVerbIdForRowKey(verbId);
    await retryOperation(() => client.deleteEntity('custom_verbs', encodedRowKey));
  } catch (error) {
    if (error.statusCode !== 404) {
      logger.error({ verbId, error: error.message }, 'Error deleting custom verb');
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
    
    try {
      await client.createTable();
    } catch (createError) {
      if (createError.statusCode !== 409 && createError.code !== 'TableAlreadyExists') {
        logger.error({ error: createError.message }, 'Cannot create VerbStatistics table');
        return;
      }
    }
    
    const encodedVerbId = encodeForRowKey(verbId);
    const encodedUserId = encodeForRowKey(userId);
    const encodedActivityId = encodeForRowKey(activityId);
    const key = `${encodedVerbId}|${encodedUserId}|${encodedActivityId}`;
    
    const entity = {
      partitionKey: 'verb_stats',
      rowKey: key,
      verbId: verbId,
      userId: userId,
      activityId: activityId,
      count: count.toString(),
      lastUsed: lastUsed || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  } catch (error) {
    logger.error({ verbId, error: error.message }, 'Error saving verb stats');
  }
}

// ============================================================================
// Public API
// ============================================================================

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
  
  if (CUSTOM_VERBS[verbId]) {
    return CUSTOM_VERBS[verbId];
  }
  
  if (STANDARD_VERBS[verbId]) {
    return STANDARD_VERBS[verbId];
  }
  
  // Fallback detection by keyword
  const verbIdLower = verbId.toLowerCase();
  
  if (verbIdLower.includes('completed') || verbIdLower.includes('complete')) {
    return { category: 'completion', action: 'mark_completed', description: 'Completion verb (detected)', isDetected: true };
  }
  if (verbIdLower.includes('passed') || verbIdLower.includes('pass')) {
    return { category: 'completion', action: 'mark_passed', description: 'Pass verb (detected)', isDetected: true };
  }
  if (verbIdLower.includes('failed') || verbIdLower.includes('fail')) {
    return { category: 'completion', action: 'mark_failed', description: 'Fail verb (detected)', isDetected: true };
  }
  if (verbIdLower.includes('initialized') || verbIdLower.includes('launched') || verbIdLower.includes('started')) {
    return { category: 'progress', action: 'mark_started', description: 'Start verb (detected)', isDetected: true };
  }
  if (verbIdLower.includes('downloaded') || verbIdLower.includes('download')) {
    return { category: 'interaction', action: 'track_download', description: 'Download verb (detected)', isDetected: true };
  }
  
  return {
    category: 'unknown',
    action: 'track_verb',
    description: `Unknown verb: ${verbId}`,
    isCustom: false,
    isUnknown: true
  };
}

/**
 * Track verb usage for statistics
 */
export async function trackVerbUsage(verbId, userId, activityId) {
  if (!verbId) return;
  
  const key = `${verbId}|${userId}|${activityId}`;
  const cached = verbStatsCache.get(key) || { count: 0, lastUsed: null };
  const newCount = cached.count + 1;
  const lastUsed = new Date().toISOString();
  
  verbStatsCache.set(key, { count: newCount, lastUsed });
  
  // LRU eviction to prevent unbounded memory growth
  evictOldestCacheEntries();
  
  // Persist async
  saveVerbStatsToAzure(verbId, userId, activityId, newCount, lastUsed).catch(err => {
    logger.error({ verbId, error: err.message }, 'Failed to persist verb stats');
  });
  
  const config = getVerbConfig(verbId);
  if (config.isCustom || config.isUnknown) {
    logger.debug({ verbId, userId, activityId }, 'Custom/Unknown verb detected');
  }
}

/**
 * Get verb statistics
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
    
    if (!stats[verbId].lastUsed || (lastUsed && lastUsed > stats[verbId].lastUsed)) {
      stats[verbId].lastUsed = lastUsed;
    }
  });
  
  Object.values(stats).forEach(stat => {
    stat.users = Array.from(stat.users);
    stat.activities = Array.from(stat.activities);
    stat.uniqueUsers = stat.users.length;
    stat.uniqueActivities = stat.activities.length;
  });
  
  return stats;
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
      logger.error({ verbId, error: error.message }, 'Error in custom handler');
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
 * Add custom verb configuration
 */
export async function addCustomVerb(verbId, config) {
  if (!verbId || !config) {
    throw new Error('verbId and config are required');
  }
  
  CUSTOM_VERBS[verbId] = { ...config, isCustom: true };
  await saveCustomVerbToAzure(verbId, CUSTOM_VERBS[verbId]);
  
  logger.info({ verbId }, 'Custom verb added');
  return CUSTOM_VERBS[verbId];
}

/**
 * Update custom verb configuration
 */
export async function updateCustomVerb(verbId, config) {
  if (!CUSTOM_VERBS[verbId]) {
    throw new Error(`Custom verb ${verbId} not found`);
  }
  
  CUSTOM_VERBS[verbId] = { ...CUSTOM_VERBS[verbId], ...config, isCustom: true };
  await saveCustomVerbToAzure(verbId, CUSTOM_VERBS[verbId]);
  
  logger.info({ verbId }, 'Custom verb updated');
  return CUSTOM_VERBS[verbId];
}

/**
 * Remove custom verb
 */
export async function removeCustomVerb(verbId) {
  if (!CUSTOM_VERBS[verbId]) {
    throw new Error(`Custom verb ${verbId} not found`);
  }
  
  delete CUSTOM_VERBS[verbId];
  await deleteCustomVerbFromAzure(verbId);
  
  logger.info({ verbId }, 'Custom verb removed');
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

/**
 * Calculate verb statistics from stored xAPI statements
 */
export async function calculateVerbStatsFromStatements() {
  try {
    const client = getTableClient('STATEMENTS');
    const stats = {};
    
    logger.info('Calculating verb statistics from statements...');
    
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
          logger.debug({ count }, 'Processing statements...');
        }
      } catch (e) {
        logger.error({ error: e.message }, 'Error parsing statement');
      }
    }
    
    Object.values(stats).forEach(stat => {
      stat.users = Array.from(stat.users);
      stat.activities = Array.from(stat.activities);
      stat.uniqueUsers = stat.users.length;
      stat.uniqueActivities = stat.activities.length;
    });
    
    logger.info({ count }, 'Calculated statistics from statements');
    return stats;
  } catch (error) {
    logger.error({ error: error.message }, 'Error calculating stats from statements');
    return {};
  }
}
