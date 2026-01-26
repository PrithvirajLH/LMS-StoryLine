/**
 * Provider Course Assignments Storage
 * Tracks which courses are assigned to each provider
 */

import { getTableClient, retryOperation, buildODataEqFilter } from './azure-tables.js';
import { storageLogger as logger } from './logger.js';

export async function getProviderCourse(providerId, courseId) {
  if (!providerId || !courseId) return null;
  const client = getTableClient('PROVIDER_COURSES');

  try {
    const entity = await client.getEntity(providerId, courseId);
    return {
      providerId: entity.partitionKey,
      courseId: entity.rowKey,
      assignedAt: entity.assignedAt || null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return null;
    }
    throw error;
  }
}

export async function listProviderCourses(providerId) {
  if (!providerId) return [];
  const client = getTableClient('PROVIDER_COURSES');
  const assignments = [];

  try {
    const filter = buildODataEqFilter('PartitionKey', providerId);
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      assignments.push({
        providerId: entity.partitionKey,
        courseId: entity.rowKey,
        assignedAt: entity.assignedAt || null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      });
    }
  } catch (error) {
    logger.error({ providerId, error: error.message }, 'Error listing provider courses');
    return [];
  }

  return assignments;
}

export async function assignCourseToProvider(providerId, courseId, assignedAt = null) {
  if (!providerId || !courseId) {
    throw new Error('providerId and courseId are required');
  }

  const client = getTableClient('PROVIDER_COURSES');
  const now = new Date().toISOString();
  const entity = {
    partitionKey: providerId,
    rowKey: courseId,
    assignedAt: assignedAt || now,
    createdAt: now,
    updatedAt: now
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  logger.info({ providerId, courseId }, 'Provider course assigned');
  return entity;
}

export async function removeCourseFromProvider(providerId, courseId) {
  if (!providerId || !courseId) return false;
  const client = getTableClient('PROVIDER_COURSES');

  try {
    await client.deleteEntity(providerId, courseId);
    logger.info({ providerId, courseId }, 'Provider course removed');
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return false;
    }
    throw error;
  }
}

export async function deleteCoursesForProvider(providerId) {
  if (!providerId) return 0;
  const client = getTableClient('PROVIDER_COURSES');
  const filter = buildODataEqFilter('PartitionKey', providerId);
  let deleted = 0;

  for await (const entity of client.listEntities({ queryOptions: { filter } })) {
    await retryOperation(() => client.deleteEntity(entity.partitionKey, entity.rowKey));
    deleted += 1;
  }

  return deleted;
}
