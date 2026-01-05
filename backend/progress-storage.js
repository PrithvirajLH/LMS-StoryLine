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
        partitionKey: partitionKey, // Use string-converted userId
        rowKey: rowKey, // Use string-converted courseId
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
  
  // Only increment attempts if explicitly requested (e.g., on course launch)
  // Don't auto-increment on every update (e.g., during sync)
  if (updates.attempts !== undefined) {
    updated.attempts = updates.attempts;
  } else {
    // Keep existing attempts if not updating
    updated.attempts = progress.attempts || 0;
  }
  
  // Set startedAt if transitioning from not_started
  if (updates.completionStatus && progress.completionStatus === 'not_started' && updates.completionStatus !== 'not_started') {
    updated.startedAt = updated.startedAt || new Date().toISOString();
  }
  
  // Set completedAt if completing
  if (updates.completionStatus === 'completed' || updates.completionStatus === 'passed') {
    updated.completedAt = updated.completedAt || new Date().toISOString();
    // If score is provided, ensure it's a number
    if (updates.score !== undefined && updates.score !== null) {
      updated.score = typeof updates.score === 'number' ? updates.score : parseFloat(updates.score) || null;
    }
  }
  
  // Ensure timeSpent is a number and preserve existing value if new value is 0 or invalid
  if (updates.timeSpent !== undefined) {
    const newTimeSpent = typeof updates.timeSpent === 'number' ? updates.timeSpent : parseFloat(updates.timeSpent) || 0;
    // Only update if new value is greater than existing (don't overwrite with 0)
    if (newTimeSpent > 0) {
      updated.timeSpent = newTimeSpent;
      console.log(`[Progress Storage] Updated timeSpent: ${newTimeSpent}s (was ${progress.timeSpent || 0}s)`);
    } else if (progress.timeSpent > 0) {
      updated.timeSpent = progress.timeSpent; // Keep existing timeSpent if new is 0
      console.log(`[Progress Storage] Preserved existing timeSpent: ${progress.timeSpent}s (new value was 0)`);
    } else {
      updated.timeSpent = 0; // Both are 0, keep 0
    }
  }
  
  // Ensure progressPercent is saved to database
  if (updates.progressPercent !== undefined) {
    updated.progressPercent = typeof updates.progressPercent === 'number' ? updates.progressPercent : parseFloat(updates.progressPercent) || 0;
  }
  
  const entity = {
    partitionKey: partitionKey, // Use the string-converted userId
    rowKey: rowKey, // Use the string-converted courseId
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
        attempts: entity.attempts || 0,
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
    const result = await xapiLRS.queryStatements({
      agent: {
        objectType: 'Agent',
        mbox: `mailto:${userEmail}`
      },
      activity: activityId,
      limit: 1000
    });
    
    // Extract statements array from result
    // queryStatements returns: { status: 200, data: { statements: [...], more: '...' } }
    const statements = result?.data?.statements || [];
    
    // Safety check: ensure statements is an array
    if (!Array.isArray(statements)) {
      console.error('[Progress Storage] Invalid statements format:', typeof statements, statements);
      return null;
    }
    
    if (statements.length === 0) {
      return null;
    }
    
    console.log(`[Progress Storage] Found ${statements.length} statements for ${userEmail} / ${activityId}`);
    
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
    const completedStatement = statements.find(s => {
      const verbId = s.verb?.id || '';
      return verbId === 'http://adlnet.gov/expapi/verbs/completed' ||
             verbId === 'http://adlnet.gov/expapi/verbs/passed' ||
             verbId.includes('completed') ||
             verbId.includes('passed');
    });
    
    if (completedStatement) {
      const verbId = completedStatement.verb?.id || '';
      completionStatus = verbId.includes('passed') ? 'passed' : 'completed';
      completedAt = completedStatement.timestamp || completedStatement.stored;
      
      console.log(`[Progress Storage] Found completion statement: ${completionStatus} at ${completedAt}`);
      
      // Extract score if available
      if (completedStatement.result?.score) {
        const rawScore = completedStatement.result.score.raw;
        const scaledScore = completedStatement.result.score.scaled;
        const maxScore = completedStatement.result.score.max;
        const minScore = completedStatement.result.score.min;
        
        // Calculate percentage score
        if (scaledScore !== undefined && scaledScore !== null) {
          score = Math.round(scaledScore * 100);
        } else if (rawScore !== undefined && rawScore !== null && maxScore !== undefined && maxScore !== null) {
          score = Math.round((rawScore / maxScore) * 100);
        } else if (rawScore !== undefined && rawScore !== null) {
          score = rawScore; // Assume it's already a percentage
        } else {
          score = null;
        }
        
        console.log(`[Progress Storage] Extracted score: ${score}%`);
      }
    }
    
    // Calculate time spent more accurately
    // Sum up time differences between consecutive statements, excluding large gaps (user left and came back)
    if (statements.length > 0) {
      const sortedStatements = [...statements].sort((a, b) => {
        const timeA = new Date(a.timestamp || a.stored || 0).getTime();
        const timeB = new Date(b.timestamp || b.stored || 0).getTime();
        return timeA - timeB;
      });
      
      if (sortedStatements.length > 1) {
        // Calculate active time by summing intervals between consecutive statements
        // Exclude gaps larger than 5 minutes (300 seconds) - user likely left and came back
        const MAX_GAP_SECONDS = 300; // 5 minutes
        let totalActiveTime = 0;
        
        for (let i = 0; i < sortedStatements.length - 1; i++) {
          const currentTime = new Date(sortedStatements[i].timestamp || sortedStatements[i].stored).getTime();
          const nextTime = new Date(sortedStatements[i + 1].timestamp || sortedStatements[i + 1].stored).getTime();
          
          if (!isNaN(currentTime) && !isNaN(nextTime) && currentTime > 0 && nextTime > 0) {
            const gapSeconds = Math.floor((nextTime - currentTime) / 1000);
            
            // Only count gaps that are reasonable (user is actively engaged)
            // If gap is too large, user likely left and came back - don't count that time
            if (gapSeconds > 0 && gapSeconds <= MAX_GAP_SECONDS) {
              totalActiveTime += gapSeconds;
            } else if (gapSeconds > MAX_GAP_SECONDS) {
              // Large gap detected - user left and came back, don't count this gap
              console.log(`[Progress Storage] Large gap detected: ${gapSeconds}s (${Math.floor(gapSeconds / 60)}m) - excluding from time spent`);
            }
          }
        }
        
        // If we have active time, use it; otherwise fall back to a minimal estimate
        if (totalActiveTime > 0) {
          timeSpent = totalActiveTime;
          console.log(`[Progress Storage] Calculated active time spent: ${timeSpent} seconds (${Math.floor(timeSpent / 60)} minutes ${timeSpent % 60} seconds) from ${sortedStatements.length} statements`);
        } else {
          // No active time calculated - estimate based on statement count (at least 1 second per statement)
          timeSpent = Math.max(1, sortedStatements.length);
          console.log(`[Progress Storage] No active time calculated, estimating: ${timeSpent} seconds from ${sortedStatements.length} statements`);
        }
      } else if (sortedStatements.length === 1) {
        // Single statement - estimate minimal time (at least 1 second)
        timeSpent = 1;
        console.log(`[Progress Storage] Single statement found, setting minimal time: ${timeSpent} second`);
      }
    }
    
    // Calculate progress percentage based on completion status
    let progressPercent = 0;
    if (completionStatus === 'completed' || completionStatus === 'passed') {
      progressPercent = 100;
    } else if (completionStatus === 'in_progress') {
      // Estimate progress based on number of statements (rough estimate)
      // This is a simple heuristic - could be improved with more sophisticated tracking
      const statementCount = statements.length;
      if (statementCount > 0) {
        // Assume course has ~50-100 statements for completion
        // This is a rough estimate - adjust based on your course structure
        progressPercent = Math.min(95, Math.round((statementCount / 80) * 100));
      }
    }
    
    return {
      completionStatus,
      score,
      timeSpent,
      progressPercent, // Add progress percentage
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
  console.log(`[Progress Storage] Syncing progress for ${userId} / ${courseId} / ${activityId}`);
  const calculated = await calculateProgressFromStatements(userId, courseId, activityId);
  
  if (calculated) {
    console.log(`[Progress Storage] Calculated progress:`, {
      completionStatus: calculated.completionStatus,
      score: calculated.score,
      timeSpent: calculated.timeSpent,
      progressPercent: calculated.progressPercent
    });
    const updated = await updateProgress(userId, courseId, calculated);
    console.log(`[Progress Storage] Updated progress:`, {
      completionStatus: updated.completionStatus,
      score: updated.score,
      timeSpent: updated.timeSpent,
      attempts: updated.attempts
    });
    return updated;
  } else {
    console.log(`[Progress Storage] No progress calculated (no statements found)`);
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
    console.error('[Progress Storage] Error getting all progress:', error);
    return [];
  }
  
  return progressList;
}

