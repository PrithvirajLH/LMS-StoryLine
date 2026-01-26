/**
 * Knowledge Check Attempts storage using Azure Table Storage
 */

import { getTableClient, retryOperation, buildODataFilter } from './azure-tables.js';
import { attemptsLogger as logger } from './logger.js';

// Azure RowKeys cannot contain: / \ # ?
function encodeRowKey(value) {
  if (!value) return '';
  return Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function decodeRowKey(value) {
  if (!value) return '';
  try {
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return value;
  }
}

function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

function extractLangValue(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value['en-US'] || value['en'] || Object.values(value)[0] || null;
  }
  return null;
}

function mapAttemptEntity(entity) {
  return {
    attemptId: decodeRowKey(entity.attemptId || ''),
    userEmail: entity.userEmail,
    registrationId: entity.registrationId || null,
    courseId: entity.courseId || null,
    activityId: entity.activityId || null,
    assessmentId: entity.assessmentId || null,
    assessmentName: entity.assessmentName || null,
    verbId: entity.verbId || null,
    success: entity.success !== undefined ? entity.success : null,
    scoreScaled: entity.scoreScaled !== undefined ? entity.scoreScaled : null,
    scoreRaw: entity.scoreRaw !== undefined ? entity.scoreRaw : null,
    scoreMax: entity.scoreMax !== undefined ? entity.scoreMax : null,
    response: entity.response || null,
    interactionType: entity.interactionType || null,
    timestamp: entity.timestamp || null,
    storedAt: entity.storedAt || null
  };
}

export async function recordAttempt(statement, context = {}) {
  const userEmail = normalizeEmail(context.userEmail);
  if (!userEmail) return null;

  const registrationId = context.registrationId || statement?.context?.registration || null;
  const attemptId = statement?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const assessmentId = statement?.object?.id || null;

  if (!assessmentId) return null;

  const verbId = statement?.verb?.id || null;
  const result = statement?.result || {};
  const score = result.score || {};

  const entity = {
    partitionKey: userEmail,
    rowKey: `${encodeRowKey(registrationId || 'noreg')}|${encodeRowKey(attemptId)}`,
    attemptId: encodeRowKey(attemptId),
    userEmail,
    registrationId: registrationId || null,
    courseId: context.courseId || null,
    activityId: context.activityId || null,
    assessmentId,
    assessmentName: extractLangValue(statement?.object?.definition?.name),
    verbId,
    success: typeof result.success === 'boolean' ? result.success : null,
    scoreScaled: typeof score.scaled === 'number' ? score.scaled : null,
    scoreRaw: typeof score.raw === 'number' ? score.raw : null,
    scoreMax: typeof score.max === 'number' ? score.max : null,
    response: typeof result.response === 'string' ? result.response : null,
    interactionType: statement?.object?.definition?.interactionType || null,
    timestamp: statement?.timestamp || null,
    storedAt: new Date().toISOString()
  };

  const client = getTableClient('KC_ATTEMPTS');
  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  logger.debug({ userEmail, assessmentId }, 'Knowledge check attempt recorded');

  return mapAttemptEntity(entity);
}

export async function listAttemptsByUser(userEmail, filters = {}) {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) return [];

  const client = getTableClient('KC_ATTEMPTS');
  const conditions = [{ field: 'PartitionKey', value: normalizedEmail }];

  if (filters.registrationId) {
    conditions.push({ field: 'registrationId', value: filters.registrationId });
  }
  if (filters.courseId) {
    conditions.push({ field: 'courseId', value: filters.courseId });
  }
  if (filters.assessmentId) {
    conditions.push({ field: 'assessmentId', value: filters.assessmentId });
  }

  const filter = buildODataFilter(conditions, 'and') || undefined;
  const attempts = [];

  try {
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      attempts.push(mapAttemptEntity(entity));
      if (filters.limit && attempts.length >= filters.limit) break;
    }
  } catch (error) {
    logger.error({ error: error.message, userEmail: normalizedEmail }, 'Error listing KC attempts');
    return [];
  }

  return attempts;
}

export async function listAttemptsByCourse(courseId, filters = {}) {
  if (!courseId) return [];

  const client = getTableClient('KC_ATTEMPTS');
  const conditions = [{ field: 'courseId', value: courseId }];

  if (filters.registrationId) {
    conditions.push({ field: 'registrationId', value: filters.registrationId });
  }
  if (filters.assessmentId) {
    conditions.push({ field: 'assessmentId', value: filters.assessmentId });
  }

  const filter = buildODataFilter(conditions, 'and') || undefined;
  const attempts = [];

  try {
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      attempts.push(mapAttemptEntity(entity));
      if (filters.limit && attempts.length >= filters.limit) break;
    }
  } catch (error) {
    logger.error({ error: error.message, courseId }, 'Error listing KC attempts by course');
    return [];
  }

  return attempts;
}
