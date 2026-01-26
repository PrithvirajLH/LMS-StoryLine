/**
 * Progress Storage using Azure Table Storage
 * Tracks user enrollment, completion, scores, and time spent
 */

import { getTableClient, retryOperation, TABLES, sanitizeODataValue, buildODataEqFilter } from './azure-tables.js';
import * as xapiLRS from './xapi-lrs-azure.js';
import * as verbTracker from './xapi-verb-tracker.js';
import { progressLogger as logger } from './logger.js';

// ============================================================================
// Configuration (all values configurable via environment variables)
// ============================================================================

const MAX_STATEMENTS_PER_SYNC = parseInt(process.env.MAX_STATEMENTS_PER_SYNC || '5000', 10);
const MAX_GAP_SECONDS = parseInt(process.env.MAX_GAP_SECONDS || '300', 10); // Default 5 minutes
const DEFAULT_STATEMENTS_PER_COURSE = parseInt(process.env.DEFAULT_STATEMENTS_PER_COURSE || '80', 10);

// ============================================================================
// Table Initialization
// ============================================================================

/**
 * Initialize progress table
 */
export async function initializeProgressTable() {
  try {
    const client = getTableClient('USER_PROGRESS');
    // Table will be created automatically on first use
    logger.info({ table: TABLES.USER_PROGRESS }, 'Progress table ready');
  } catch (error) {
    logger.error({ error: error.message }, 'Error initializing progress table');
    throw error;
  }
}

// ============================================================================
// Progress CRUD Operations
// ============================================================================

/**
 * Get or create user progress for a course
 */
async function getOrCreateProgress(userId, courseId) {
  if (!userId || !courseId) {
    throw new Error(`Invalid parameters: userId=${userId}, courseId=${courseId}`);
  }
  
  const client = getTableClient('USER_PROGRESS');
  const partitionKey = String(userId); // Ensure it's a string
  const rowKey = String(courseId); // Ensure it's a string
  
  try {
    const entity = await client.getEntity(partitionKey, rowKey);
    return {
      userId: entity.partitionKey,
      courseId: entity.rowKey,
      enrollmentStatus: entity.enrollmentStatus || 'not_enrolled',
      completionStatus: entity.completionStatus || 'not_started',
      score: entity.score || null,
      progressPercent: entity.progressPercent !== undefined ? entity.progressPercent : null,
      timeSpent: entity.timeSpent || 0, // in seconds
      attempts: entity.attempts || 0, // number of times course was launched
      enrolledAt: entity.enrolledAt || null,
      startedAt: entity.startedAt || null,
      completedAt: entity.completedAt || null,
      lastAccessedAt: entity.lastAccessedAt || new Date().toISOString(),
      updatedAt: entity.updatedAt || new Date().toISOString()
    };
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      // Create new progress entry
      const newProgress = {
        partitionKey: partitionKey,
        rowKey: rowKey,
        enrollmentStatus: 'enrolled',
        completionStatus: 'not_started',
        score: null,
        timeSpent: 0,
        attempts: 1, // First attempt
        enrolledAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        lastAccessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await retryOperation(() => client.createEntity(newProgress));
      return {
        userId: partitionKey,
        courseId: rowKey,
        enrollmentStatus: newProgress.enrollmentStatus,
        completionStatus: newProgress.completionStatus,
        score: newProgress.score,
        timeSpent: newProgress.timeSpent,
        attempts: newProgress.attempts,
        enrolledAt: newProgress.enrolledAt,
        startedAt: newProgress.startedAt,
        completedAt: newProgress.completedAt,
        lastAccessedAt: newProgress.lastAccessedAt,
        updatedAt: newProgress.updatedAt
      };
    }
    throw error;
  }
}

/**
 * Update user progress
 */
export async function updateProgress(userId, courseId, updates) {
  if (!userId || !courseId) {
    throw new Error(`Invalid parameters: userId=${userId}, courseId=${courseId}`);
  }
  
  const client = getTableClient('USER_PROGRESS');
  const partitionKey = String(userId);
  const rowKey = String(courseId);
  
  const progress = await getOrCreateProgress(userId, courseId);
  
  // Merge updates
  const updated = {
    ...progress,
    ...updates,
    lastAccessedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Only increment attempts if explicitly requested (e.g., on course launch)
  if (updates.attempts !== undefined) {
    updated.attempts = updates.attempts;
  } else {
    updated.attempts = progress.attempts || 0;
  }
  
  // Set startedAt if transitioning from not_started
  if (updates.completionStatus && progress.completionStatus === 'not_started' && updates.completionStatus !== 'not_started') {
    updated.startedAt = updated.startedAt || new Date().toISOString();
  }
  
  // Set completedAt if completing
  if (updates.completionStatus === 'completed' || updates.completionStatus === 'passed') {
    updated.completedAt = updated.completedAt || new Date().toISOString();
    if (updates.score !== undefined && updates.score !== null) {
      updated.score = typeof updates.score === 'number' ? updates.score : parseFloat(updates.score) || null;
    }
  }
  
  // Handle timeSpent - preserve existing value if new value is 0 or invalid
  if (updates.timeSpent !== undefined) {
    const newTimeSpent = typeof updates.timeSpent === 'number' ? updates.timeSpent : parseFloat(updates.timeSpent) || 0;
    if (newTimeSpent > 0) {
      updated.timeSpent = newTimeSpent;
      logger.debug({ userId, courseId, timeSpent: newTimeSpent, prev: progress.timeSpent }, 'Updated timeSpent');
    } else if (progress.timeSpent > 0) {
      updated.timeSpent = progress.timeSpent;
    } else {
      updated.timeSpent = 0;
    }
  }
  
  // Handle progressPercent
  if (updates.progressPercent !== undefined) {
    updated.progressPercent = typeof updates.progressPercent === 'number' 
      ? updates.progressPercent 
      : parseFloat(updates.progressPercent) || 0;
  }
  
  // Set startedAt if missing but course has been started
  if (!updated.startedAt) {
    const hasProgress = (updated.progressPercent && updated.progressPercent > 0) || 
                       (updated.timeSpent && updated.timeSpent > 0) ||
                       (updated.completionStatus && updated.completionStatus !== 'not_started');
    if (hasProgress) {
      updated.startedAt = updated.enrolledAt || new Date().toISOString();
    }
  }
  
  const entity = {
    partitionKey: partitionKey,
    rowKey: rowKey,
    enrollmentStatus: updated.enrollmentStatus,
    completionStatus: updated.completionStatus,
    score: updated.score,
    progressPercent: updated.progressPercent !== undefined ? updated.progressPercent : null,
    timeSpent: updated.timeSpent,
    attempts: updated.attempts || 0,
    enrolledAt: updated.enrolledAt,
    startedAt: updated.startedAt,
    completedAt: updated.completedAt,
    lastAccessedAt: updated.lastAccessedAt,
    updatedAt: updated.updatedAt
  };
  
  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  
  return {
    ...updated,
    userId: partitionKey,
    courseId: rowKey
  };
}

/**
 * Get all progress for a user
 */
export async function getUserProgress(userId) {
  if (!userId) {
    return [];
  }
  
  const client = getTableClient('USER_PROGRESS');
  const progressList = [];
  
  try {
    // Use safe OData filter
    const filter = buildODataEqFilter('PartitionKey', userId);
    
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      progressList.push({
        userId: entity.partitionKey,
        courseId: entity.rowKey,
        enrollmentStatus: entity.enrollmentStatus || 'not_enrolled',
        completionStatus: entity.completionStatus || 'not_started',
        score: entity.score !== undefined ? entity.score : null,
        progressPercent: entity.progressPercent !== undefined ? entity.progressPercent : null,
        timeSpent: entity.timeSpent || 0,
        attempts: entity.attempts || 0,
        enrolledAt: entity.enrolledAt || null,
        startedAt: entity.startedAt || null,
        completedAt: entity.completedAt || null,
        lastAccessedAt: entity.lastAccessedAt || null,
        updatedAt: entity.updatedAt || null
      });
    }
  } catch (error) {
    logger.error({ userId, error: error.message }, 'Error getting user progress');
    return [];
  }
  
  return progressList;
}

/**
 * Get progress for a specific course
 */
export async function getCourseProgress(courseId) {
  if (!courseId) {
    return [];
  }
  
  const client = getTableClient('USER_PROGRESS');
  const progressList = [];
  
  try {
    // Use safe OData filter
    const filter = buildODataEqFilter('RowKey', courseId);
    
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      progressList.push({
        userId: entity.partitionKey,
        courseId: entity.rowKey,
        enrollmentStatus: entity.enrollmentStatus || 'not_enrolled',
        completionStatus: entity.completionStatus || 'not_started',
        score: entity.score || null,
        timeSpent: entity.timeSpent || 0,
        attempts: entity.attempts || 0,
        enrolledAt: entity.enrolledAt || null,
        startedAt: entity.startedAt || null,
        completedAt: entity.completedAt || null,
        lastAccessedAt: entity.lastAccessedAt || null,
        updatedAt: entity.updatedAt || null
      });
    }
  } catch (error) {
    logger.error({ courseId, error: error.message }, 'Error getting course progress');
    return [];
  }
  
  return progressList;
}

// ============================================================================
// Progress Calculation from xAPI Statements
// ============================================================================

/**
 * Calculate time spent from statements (excluding idle gaps)
 */
function calculateTimeSpent(statements) {
  if (!statements || statements.length <= 1) {
    return statements?.length ? 1 : 0;
  }
  
  const sortedStatements = [...statements].sort((a, b) => {
    const timeA = new Date(a.timestamp || a.stored || 0).getTime();
    const timeB = new Date(b.timestamp || b.stored || 0).getTime();
    return timeA - timeB;
  });
  
  let totalActiveTime = 0;
  
  for (let i = 0; i < sortedStatements.length - 1; i++) {
    const currentTime = new Date(sortedStatements[i].timestamp || sortedStatements[i].stored).getTime();
    const nextTime = new Date(sortedStatements[i + 1].timestamp || sortedStatements[i + 1].stored).getTime();
    
    if (!isNaN(currentTime) && !isNaN(nextTime) && currentTime > 0 && nextTime > 0) {
      const gapSeconds = Math.floor((nextTime - currentTime) / 1000);
      
      if (gapSeconds > 0 && gapSeconds <= MAX_GAP_SECONDS) {
        totalActiveTime += gapSeconds;
      }
    }
  }
  
  return totalActiveTime > 0 ? totalActiveTime : Math.max(1, sortedStatements.length);
}

/**
 * Extract score from statement result
 */
function extractScore(result) {
  if (!result?.score) {
    return null;
  }
  
  const { scaled, raw, max } = result.score;
  
  if (scaled !== undefined && scaled !== null) {
    return Math.round(scaled * 100);
  }
  if (raw !== undefined && raw !== null && max !== undefined && max !== null && max > 0) {
    return Math.round((raw / max) * 100);
  }
  if (raw !== undefined && raw !== null) {
    return raw;
  }
  
  return null;
}

/**
 * Calculate progress from xAPI statements
 */
export async function calculateProgressFromStatements(userId, courseId, activityId, registration = null) {
  try {
    // Normalize userId to email format for xAPI query
    const userEmail = userId.includes('@') ? userId : `${userId}@example.com`;
    
    // Query ALL xAPI statements for this user
    const allStatements = [];
    let cursor = null;
    
    do {
      const result = await xapiLRS.queryStatements({
        agent: {
          objectType: 'Agent',
          mbox: `mailto:${userEmail}`
        },
        registration: registration || undefined,
        limit: 200,
        cursor: cursor || undefined
      });
      
      const batch = result?.data?.statements || [];
      allStatements.push(...batch);
      cursor = result?.data?.more || null;
      
      if (allStatements.length >= MAX_STATEMENTS_PER_SYNC) {
        logger.warn({ userId, count: allStatements.length }, 'Statement cap reached, truncating');
        break;
      }
    } while (cursor);
    
    if (!Array.isArray(allStatements)) {
      logger.error({ userId, type: typeof allStatements }, 'Invalid statements format');
      return null;
    }
    
    // Filter statements for this course
    const statements = allStatements.filter(s => {
      const objectId = s.object?.id || '';
      return objectId === activityId || objectId.startsWith(activityId + '/');
    });
    
    if (statements.length === 0) {
      return null;
    }
    
    logger.debug({ userId, courseId, count: statements.length, total: allStatements.length }, 'Found statements');
    
    // Initialize progress data
    let completionStatus = 'not_started';
    let score = null;
    let startedAt = null;
    let completedAt = null;
    let completionStatementId = null;
    let completionVerb = null;
    let success = null;
    
    // If there are any statements, user has started
    if (statements.length > 0) {
      completionStatus = 'in_progress';
      
      const sortedByTime = [...statements].sort((a, b) => {
        const timeA = new Date(a.timestamp || a.stored || 0).getTime();
        const timeB = new Date(b.timestamp || b.stored || 0).getTime();
        return timeA - timeB;
      });
      startedAt = sortedByTime[0]?.timestamp || sortedByTime[0]?.stored || null;
    }
    
    // Find initial statement (started)
    const initialStatement = statements.find(s => verbTracker.isStartVerb(s.verb?.id || ''));
    if (initialStatement) {
      startedAt = initialStatement.timestamp || initialStatement.stored || startedAt;
    }
    
    // Find completion statement
    const completedStatement = statements.find(s => verbTracker.isCompletionVerb(s.verb?.id || ''));
    
    if (completedStatement) {
      const verbId = completedStatement.verb?.id || '';
      const verbConfig = verbTracker.getVerbConfig(verbId);
      
      completionStatementId = completedStatement.id || null;
      completionVerb = verbId || null;
      
      if (typeof completedStatement.result?.success === 'boolean') {
        success = completedStatement.result.success;
      }
      
      // Determine completion status
      if (verbConfig.action === 'mark_passed') {
        completionStatus = 'passed';
      } else if (verbConfig.action === 'mark_failed') {
        completionStatus = 'failed';
        success = false;
      } else {
        completionStatus = 'completed';
      }
      
      completedAt = completedStatement.timestamp || completedStatement.stored;
      score = extractScore(completedStatement.result);
      
      logger.debug({ userId, courseId, status: completionStatus, completedAt }, 'Found completion');
    }
    
    // Calculate time spent
    const timeSpent = calculateTimeSpent(statements);
    
    // Calculate progress percentage
    let progressPercent = 0;
    if (completionStatus === 'completed' || completionStatus === 'passed') {
      progressPercent = 100;
    } else if (completionStatus === 'in_progress') {
      progressPercent = Math.min(95, Math.round((statements.length / DEFAULT_STATEMENTS_PER_COURSE) * 100));
    }
    
    return {
      completionStatus,
      score,
      timeSpent,
      progressPercent,
      startedAt,
      completedAt,
      completionStatementId,
      completionVerb,
      success
    };
  } catch (error) {
    logger.error({ userId, courseId, error: error.message }, 'Error calculating progress');
    return null;
  }
}

/**
 * Sync progress from xAPI statements
 */
export async function syncProgressFromStatements(userId, courseId, activityId, registration = null) {
  logger.debug({ userId, courseId, activityId, registration }, 'Syncing progress');
  
  const calculated = await calculateProgressFromStatements(userId, courseId, activityId, registration);
  
  if (calculated) {
    logger.debug({ 
      userId, 
      courseId, 
      status: calculated.completionStatus, 
      score: calculated.score,
      timeSpent: calculated.timeSpent,
      progressPercent: calculated.progressPercent 
    }, 'Calculated progress');
    
    const updated = await updateProgress(userId, courseId, calculated);
    
    logger.debug({
      userId,
      courseId,
      status: updated.completionStatus,
      attempts: updated.attempts
    }, 'Updated progress');
    
    return { updatedProgress: updated, calculated };
  }
  
  logger.debug({ userId, courseId }, 'No progress calculated (no statements found)');
  return null;
}

// Max records per page for getAllProgress
const MAX_PROGRESS_PAGE_SIZE = parseInt(process.env.MAX_PROGRESS_PAGE_SIZE || '1000', 10);

/**
 * Get all progress (for admin) - with pagination to prevent OOM
 * @param {Object} options - { limit, continuationToken }
 * @returns {{ data: Array, continuationToken: string|null }}
 */
export async function getAllProgress(options = {}) {
  const client = getTableClient('USER_PROGRESS');
  const progressList = [];
  const limit = Math.min(options.limit || MAX_PROGRESS_PAGE_SIZE, MAX_PROGRESS_PAGE_SIZE);
  
  try {
    const listEntities = client.listEntities();
    const pageIterator = listEntities.byPage({
      maxPageSize: limit,
      continuationToken: options.continuationToken || undefined
    });
    
    const page = await pageIterator.next();
    
    if (!page.done && page.value) {
      for (const entity of page.value) {
        progressList.push({
          userId: entity.partitionKey,
          courseId: entity.rowKey,
          enrollmentStatus: entity.enrollmentStatus || 'not_enrolled',
          completionStatus: entity.completionStatus || 'not_started',
          score: entity.score !== undefined ? entity.score : null,
          progressPercent: entity.progressPercent !== undefined ? entity.progressPercent : null,
          timeSpent: entity.timeSpent || 0,
          attempts: entity.attempts || 0,
          enrolledAt: entity.enrolledAt || null,
          startedAt: entity.startedAt || null,
          completedAt: entity.completedAt || null,
          lastAccessedAt: entity.lastAccessedAt || null,
          updatedAt: entity.updatedAt || null
        });
      }
      
      const nextToken = page.value.continuationToken || null;
      
      return {
        data: progressList,
        continuationToken: nextToken,
        hasMore: !!nextToken
      };
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting all progress');
    return { data: [], continuationToken: null, hasMore: false };
  }
  
  return { data: progressList, continuationToken: null, hasMore: false };
}
