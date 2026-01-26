/**
 * User Assignments Storage
 * Tracks per-user course assignments with due dates
 */

import { getTableClient, retryOperation, buildODataFilter, buildODataEqFilter, sanitizePartitionKey } from './azure-tables.js';
import { storageLogger as logger } from './logger.js';

function buildRowKey(userId, courseId) {
  const safeUserId = sanitizePartitionKey(userId);
  const safeCourseId = sanitizePartitionKey(courseId);
  return `${safeUserId}|${safeCourseId}`;
}

export async function listAssignmentsByProvider(providerId) {
  if (!providerId) return [];
  const client = getTableClient('USER_ASSIGNMENTS');
  const assignments = [];

  try {
    const filter = buildODataEqFilter('PartitionKey', providerId);
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      assignments.push({
        providerId: entity.partitionKey,
        userId: entity.userId,
        courseId: entity.courseId,
        assignedAt: entity.assignedAt || null,
        dueDate: entity.dueDate || null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      });
    }
  } catch (error) {
    logger.error({ providerId, error: error.message }, 'Error listing provider assignments');
    return [];
  }

  return assignments;
}

export async function listAssignmentsByProviderUser(providerId, userId) {
  if (!providerId || !userId) return [];
  const client = getTableClient('USER_ASSIGNMENTS');
  const assignments = [];

  try {
    const filter = buildODataFilter([
      { field: 'PartitionKey', value: providerId },
      { field: 'userId', value: userId }
    ], 'and');
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      assignments.push({
        providerId: entity.partitionKey,
        userId: entity.userId,
        courseId: entity.courseId,
        assignedAt: entity.assignedAt || null,
        dueDate: entity.dueDate || null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      });
    }
  } catch (error) {
    logger.error({ providerId, userId, error: error.message }, 'Error listing user assignments');
    return [];
  }

  return assignments;
}

export async function listAssignmentsByProviderCourse(providerId, courseId) {
  if (!providerId || !courseId) return [];
  const client = getTableClient('USER_ASSIGNMENTS');
  const assignments = [];

  try {
    const filter = buildODataFilter([
      { field: 'PartitionKey', value: providerId },
      { field: 'courseId', value: courseId }
    ], 'and');
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      assignments.push({
        providerId: entity.partitionKey,
        userId: entity.userId,
        courseId: entity.courseId,
        assignedAt: entity.assignedAt || null,
        dueDate: entity.dueDate || null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      });
    }
  } catch (error) {
    logger.error({ providerId, courseId, error: error.message }, 'Error listing course assignments');
    return [];
  }

  return assignments;
}

export async function upsertAssignments(assignments) {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return [];
  }

  const client = getTableClient('USER_ASSIGNMENTS');
  const now = new Date().toISOString();

  const stored = await Promise.all(assignments.map(async assignment => {
    const rowKey = buildRowKey(assignment.userId, assignment.courseId);
    const entity = {
      partitionKey: assignment.providerId,
      rowKey,
      providerId: assignment.providerId,
      userId: assignment.userId,
      courseId: assignment.courseId,
      assignedAt: assignment.assignedAt || now,
      dueDate: assignment.dueDate || null,
      createdAt: assignment.createdAt || now,
      updatedAt: now
    };

    await retryOperation(() => client.upsertEntity(entity, 'Replace'));
    return entity;
  }));

  return stored;
}

export async function deleteAssignmentsByProviderUser(providerId, userId) {
  if (!providerId || !userId) return 0;
  const client = getTableClient('USER_ASSIGNMENTS');
  const assignments = await listAssignmentsByProviderUser(providerId, userId);
  let deleted = 0;

  for (const assignment of assignments) {
    const rowKey = buildRowKey(assignment.userId, assignment.courseId);
    await retryOperation(() => client.deleteEntity(providerId, rowKey));
    deleted += 1;
  }

  return deleted;
}

export async function deleteAssignmentsByProviderCourse(providerId, courseId) {
  if (!providerId || !courseId) return 0;
  const client = getTableClient('USER_ASSIGNMENTS');
  const assignments = await listAssignmentsByProviderCourse(providerId, courseId);
  let deleted = 0;

  for (const assignment of assignments) {
    const rowKey = buildRowKey(assignment.userId, assignment.courseId);
    await retryOperation(() => client.deleteEntity(providerId, rowKey));
    deleted += 1;
  }

  return deleted;
}

export async function deleteAssignmentsByProvider(providerId) {
  if (!providerId) return 0;
  const client = getTableClient('USER_ASSIGNMENTS');
  const assignments = await listAssignmentsByProvider(providerId);
  let deleted = 0;

  for (const assignment of assignments) {
    const rowKey = buildRowKey(assignment.userId, assignment.courseId);
    await retryOperation(() => client.deleteEntity(providerId, rowKey));
    deleted += 1;
  }

  return deleted;
}
