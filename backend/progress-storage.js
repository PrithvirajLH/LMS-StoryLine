/**
 * Progress Storage using Azure Table Storage
 * Tracks user enrollment, completion, scores, and time spent
 */

import { getTableClient, retryOperation, TABLES } from './azure-tables.js';
import * as xapiLRS from './xapi-lrs-azure.js';

/**
 * Initialize progress table
 */
export async function initializeProgressTable() {
  try {
    const client = getTableClient('USER_PROGRESS');
    // Table will be created automatically on first use
    console.log(`✓ Progress table '${TABLES.USER_PROGRESS}' ready`);
  } catch (error) {
    console.error(`[Progress Storage] Error initializing table:`, error);
    throw error;
  }
}

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
      timeSpent: entity.timeSpent || 0, // in seconds
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
        partitionKey: partitionKey, // Use string-converted userId
        rowKey: rowKey, // Use string-converted courseId
        enrollmentStatus: 'enrolled',
        completionStatus: 'not_started',
        score: null,
        timeSpent: 0,
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
  const partitionKey = String(userId); // Ensure it's a string
  const rowKey = String(courseId); // Ensure it's a string
  
  const progress = await getOrCreateProgress(userId, courseId);
  
  // Merge updates
  const updated = {
    ...progress,
    ...updates,
    lastAccessedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Set startedAt if transitioning from not_started
  if (updates.completionStatus && progress.completionStatus === 'not_started' && updates.completionStatus !== 'not_started') {
    updated.startedAt = updated.startedAt || new Date().toISOString();
  }
  
  // Set completedAt if completing
  if (updates.completionStatus === 'completed' || updates.completionStatus === 'passed') {
    updated.completedAt = updated.completedAt || new Date().toISOString();
  }
  
  const entity = {
    partitionKey: partitionKey, // Use the string-converted userId
    rowKey: rowKey, // Use the string-converted courseId
    enrollmentStatus: updated.enrollmentStatus,
    completionStatus: updated.completionStatus,
    score: updated.score,
    timeSpent: updated.timeSpent,
    enrolledAt: updated.enrolledAt,
    startedAt: updated.startedAt,
    completedAt: updated.completedAt,
    lastAccessedAt: updated.lastAccessedAt,
    updatedAt: updated.updatedAt
  };
  
  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  
  // Return updated progress with correct IDs
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
  const client = getTableClient('USER_PROGRESS');
  const progressList = [];
  
  try {
    for await (const entity of client.listEntities({ queryOptions: { filter: `PartitionKey eq '${userId}'` } })) {
      progressList.push({
        userId: entity.partitionKey,
        courseId: entity.rowKey,
        enrollmentStatus: entity.enrollmentStatus || 'not_enrolled',
        completionStatus: entity.completionStatus || 'not_started',
        score: entity.score || null,
        timeSpent: entity.timeSpent || 0,
        enrolledAt: entity.enrolledAt || null,
        startedAt: entity.startedAt || null,
        completedAt: entity.completedAt || null,
        lastAccessedAt: entity.lastAccessedAt || null,
        updatedAt: entity.updatedAt || null
      });
    }
  } catch (error) {
    console.error('[Progress Storage] Error getting user progress:', error);
    return [];
  }
  
  return progressList;
}

/**
 * Get progress for a specific course
 */
export async function getCourseProgress(courseId) {
  const client = getTableClient('USER_PROGRESS');
  const progressList = [];
  
  try {
    for await (const entity of client.listEntities({ queryOptions: { filter: `RowKey eq '${courseId}'` } })) {
      progressList.push({
        userId: entity.partitionKey,
        courseId: entity.rowKey,
        enrollmentStatus: entity.enrollmentStatus || 'not_enrolled',
        completionStatus: entity.completionStatus || 'not_started',
        score: entity.score || null,
        timeSpent: entity.timeSpent || 0,
        enrolledAt: entity.enrolledAt || null,
        startedAt: entity.startedAt || null,
        completedAt: entity.completedAt || null,
        lastAccessedAt: entity.lastAccessedAt || null,
        updatedAt: entity.updatedAt || null
      });
    }
  } catch (error) {
    console.error('[Progress Storage] Error getting course progress:', error);
    return [];
  }
  
  return progressList;
}

/**
 * Calculate progress from xAPI statements
 */
export async function calculateProgressFromStatements(userId, courseId, activityId) {
  try {
    // Normalize userId to email format for xAPI query
    const userEmail = userId.includes('@') ? userId : `${userId}@example.com`;
    
    // Query xAPI statements for this user and course
    const statements = await xapiLRS.queryStatements({
      agent: {
        mbox: `mailto:${userEmail}`
      },
      activity: activityId,
      limit: 1000
    });
    
    if (!statements || statements.length === 0) {
      return null;
    }
    
    // Analyze statements to determine progress
    let completionStatus = 'not_started';
    let score = null;
    let timeSpent = 0; // in seconds
    let startedAt = null;
    let completedAt = null;
    
    // Find initial statement (started)
    const initialStatement = statements.find(s => 
      s.verb?.id === 'http://adlnet.gov/expapi/verbs/initialized' ||
      s.verb?.id === 'http://adlnet.gov/expapi/verbs/launched'
    );
    if (initialStatement) {
      completionStatus = 'in_progress';
      startedAt = initialStatement.timestamp || initialStatement.stored;
    }
    
    // Find completion statement
    const completedStatement = statements.find(s => 
      s.verb?.id === 'http://adlnet.gov/expapi/verbs/completed' ||
      s.verb?.id === 'http://adlnet.gov/expapi/verbs/passed'
    );
    if (completedStatement) {
      completionStatus = completedStatement.verb.id.includes('passed') ? 'passed' : 'completed';
      completedAt = completedStatement.timestamp || completedStatement.stored;
      
      // Extract score if available
      if (completedStatement.result?.score) {
        score = completedStatement.result.score.scaled || 
                completedStatement.result.score.raw || 
                completedStatement.result.score.min || null;
      }
    }
    
    // Calculate time spent (rough estimate from statement timestamps)
    if (statements.length > 1) {
      const timestamps = statements
        .map(s => new Date(s.timestamp || s.stored))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a - b);
      
      if (timestamps.length > 1) {
        const first = timestamps[0];
        const last = timestamps[timestamps.length - 1];
        timeSpent = Math.floor((last - first) / 1000); // Convert to seconds
      }
    }
    
    return {
      completionStatus,
      score,
      timeSpent,
      startedAt,
      completedAt
    };
  } catch (error) {
    console.error('[Progress Storage] Error calculating progress from statements:', error);
    return null;
  }
}

/**
 * Sync progress from xAPI statements
 */
export async function syncProgressFromStatements(userId, courseId, activityId) {
  const calculated = await calculateProgressFromStatements(userId, courseId, activityId);
  
  if (calculated) {
    return await updateProgress(userId, courseId, calculated);
  }
  
  return null;
}

/**
 * Get all progress (for admin)
 */
export async function getAllProgress() {
  const client = getTableClient('USER_PROGRESS');
  const progressList = [];
  
  try {
    for await (const entity of client.listEntities()) {
      progressList.push({
        userId: entity.partitionKey,
        courseId: entity.rowKey,
        enrollmentStatus: entity.enrollmentStatus || 'not_enrolled',
        completionStatus: entity.completionStatus || 'not_started',
        score: entity.score || null,
        timeSpent: entity.timeSpent || 0,
        enrolledAt: entity.enrolledAt || null,
        startedAt: entity.startedAt || null,
        completedAt: entity.completedAt || null,
        lastAccessedAt: entity.lastAccessedAt || null,
        updatedAt: entity.updatedAt || null
      });
    }
  } catch (error) {
    console.error('[Progress Storage] Error getting all progress:', error);
    return [];
  }
  
  return progressList;
}

