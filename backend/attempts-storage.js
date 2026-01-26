/**
 * Course Attempts Storage using Azure Table Storage
 * Tracks per-registration attempt details for audit-grade reporting
 */

import { getTableClient, retryOperation, sanitizeODataValue, buildODataEqFilter } from './azure-tables.js';
import { attemptsLogger as logger } from './logger.js';

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

function buildPartitionKey(userEmail) {
  return normalizeEmail(userEmail);
}

function mapAttemptEntity(entity) {
  return {
    registrationId: entity.registrationId || entity.rowKey,
    userEmail: entity.userEmail,
    userName: entity.userName || null,
    courseId: entity.courseId,
    activityId: entity.activityId || null,
    launchedAt: entity.launchedAt || null,
    completionStatus: entity.completionStatus || null,
    completionVerb: entity.completionVerb || null,
    completionStatementId: entity.completionStatementId || null,
    success: entity.success !== undefined ? entity.success : null,
    score: entity.score !== undefined ? entity.score : null,
    progressPercent: entity.progressPercent !== undefined ? entity.progressPercent : null,
    timeSpent: entity.timeSpent || 0,
    completedAt: entity.completedAt || null,
    eligibleForRaise: entity.eligibleForRaise !== undefined ? entity.eligibleForRaise : null,
    moduleProgress: entity.moduleProgress ? JSON.parse(entity.moduleProgress) : null,
    updatedAt: entity.updatedAt || null
  };
}

// ============================================================================
// Attempt CRUD Operations
// ============================================================================

/**
 * Create a new attempt record
 */
export async function createAttempt(attempt) {
  if (!attempt?.userEmail || !attempt?.registrationId) {
    throw new Error('userEmail and registrationId are required');
  }
  
  const client = getTableClient('COURSE_ATTEMPTS');
  const partitionKey = buildPartitionKey(attempt.userEmail);
  const rowKey = attempt.registrationId;

  const entity = {
    partitionKey,
    rowKey,
    registrationId: attempt.registrationId,
    userEmail: normalizeEmail(attempt.userEmail),
    userName: attempt.userName || null,
    courseId: attempt.courseId,
    activityId: attempt.activityId || null,
    launchedAt: attempt.launchedAt || new Date().toISOString(),
    completionStatus: attempt.completionStatus || 'in_progress',
    completionVerb: attempt.completionVerb || null,
    completionStatementId: attempt.completionStatementId || null,
    success: attempt.success !== undefined ? attempt.success : null,
    score: attempt.score !== undefined ? attempt.score : null,
    progressPercent: attempt.progressPercent !== undefined ? attempt.progressPercent : null,
    timeSpent: attempt.timeSpent !== undefined ? attempt.timeSpent : 0,
    completedAt: attempt.completedAt || null,
    eligibleForRaise: attempt.eligibleForRaise !== undefined ? attempt.eligibleForRaise : null,
    moduleProgress: attempt.moduleProgress ? JSON.stringify(attempt.moduleProgress) : null,
    updatedAt: new Date().toISOString()
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  
  logger.debug({ 
    registrationId: entity.registrationId, 
    userEmail: entity.userEmail, 
    courseId: entity.courseId 
  }, 'Attempt created');
  
  return entity;
}

/**
 * Get an attempt by user email and registration ID
 */
export async function getAttempt(userEmail, registrationId) {
  if (!userEmail || !registrationId) {
    return null;
  }
  
  const client = getTableClient('COURSE_ATTEMPTS');
  const partitionKey = buildPartitionKey(userEmail);
  
  try {
    const entity = await client.getEntity(partitionKey, registrationId);
    return mapAttemptEntity(entity);
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return null;
    }
    throw error;
  }
}

/**
 * Update or insert attempt progress
 */
export async function upsertAttemptProgress(userEmail, registrationId, updates) {
  if (!userEmail || !registrationId) {
    throw new Error('userEmail and registrationId are required');
  }
  
  const client = getTableClient('COURSE_ATTEMPTS');
  const partitionKey = buildPartitionKey(userEmail);
  const rowKey = registrationId;

  const existing = await getAttempt(userEmail, registrationId);
  
  const entity = {
    partitionKey,
    rowKey,
    registrationId,
    userEmail: normalizeEmail(userEmail),
    userName: updates.userName || existing?.userName || null,
    courseId: updates.courseId || existing?.courseId || null,
    activityId: updates.activityId || existing?.activityId || null,
    launchedAt: existing?.launchedAt || updates.launchedAt || new Date().toISOString(),
    completionStatus: updates.completionStatus || existing?.completionStatus || 'in_progress',
    completionVerb: updates.completionVerb || existing?.completionVerb || null,
    completionStatementId: updates.completionStatementId || existing?.completionStatementId || null,
    success: updates.success !== undefined ? updates.success : existing?.success ?? null,
    score: updates.score !== undefined ? updates.score : existing?.score ?? null,
    progressPercent: updates.progressPercent !== undefined ? updates.progressPercent : existing?.progressPercent ?? null,
    timeSpent: updates.timeSpent !== undefined ? updates.timeSpent : existing?.timeSpent ?? 0,
    completedAt: updates.completedAt || existing?.completedAt || null,
    eligibleForRaise: updates.eligibleForRaise !== undefined ? updates.eligibleForRaise : existing?.eligibleForRaise ?? null,
    moduleProgress: updates.moduleProgress
      ? JSON.stringify(updates.moduleProgress)
      : (existing?.moduleProgress ? JSON.stringify(existing.moduleProgress) : null),
    updatedAt: new Date().toISOString()
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  
  logger.debug({ registrationId, status: entity.completionStatus }, 'Attempt progress updated');
  
  return mapAttemptEntity(entity);
}

/**
 * List all attempts
 */
export async function listAttempts() {
  const client = getTableClient('COURSE_ATTEMPTS');
  const attempts = [];

  try {
    for await (const entity of client.listEntities()) {
      attempts.push(mapAttemptEntity(entity));
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error listing attempts');
    return [];
  }

  return attempts;
}

/**
 * List attempts by user email
 */
export async function listAttemptsByUser(userEmail) {
  if (!userEmail) {
    return [];
  }
  
  const client = getTableClient('COURSE_ATTEMPTS');
  const attempts = [];
  const partitionKey = buildPartitionKey(userEmail);

  try {
    // Use safe OData filter
    const filter = buildODataEqFilter('PartitionKey', partitionKey);
    
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      attempts.push(mapAttemptEntity(entity));
    }
  } catch (error) {
    logger.error({ userEmail, error: error.message }, 'Error listing attempts by user');
    return [];
  }

  return attempts;
}

/**
 * Get the latest open (incomplete) attempt for a user and course
 */
export async function getLatestOpenAttempt(userEmail, courseId) {
  if (!userEmail || !courseId) {
    return null;
  }
  
  const attempts = await listAttemptsByUser(userEmail);
  
  const openAttempts = attempts.filter(attempt =>
    attempt.courseId === courseId &&
    attempt.completionStatus !== 'completed' &&
    attempt.completionStatus !== 'passed' &&
    attempt.completionStatus !== 'failed'
  );

  if (openAttempts.length === 0) {
    return null;
  }

  // Sort by launch time (most recent first)
  openAttempts.sort((a, b) => {
    const aTime = new Date(a.launchedAt || 0).getTime();
    const bTime = new Date(b.launchedAt || 0).getTime();
    return bTime - aTime;
  });

  return openAttempts[0];
}
