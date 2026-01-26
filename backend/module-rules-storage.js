/**
 * Module Rules Storage
 * Stores per-course module mapping and completion rules
 */

import { getTableClient, retryOperation } from './azure-tables.js';
import { storageLogger as logger } from './logger.js';

/**
 * Get module rules for a course
 */
export async function getModuleRules(courseId) {
  if (!courseId) {
    return [];
  }
  
  const client = getTableClient('MODULE_RULES');
  
  try {
    const entity = await client.getEntity(courseId, 'rules');
    const rules = JSON.parse(entity.rules || '[]');
    logger.debug({ courseId, ruleCount: rules.length }, 'Module rules loaded');
    return rules;
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return [];
    }
    logger.error({ courseId, error: error.message }, 'Error getting module rules');
    throw error;
  }
}

/**
 * Save module rules for a course
 */
export async function saveModuleRules(courseId, rules) {
  if (!courseId) {
    throw new Error('courseId is required');
  }
  
  const client = getTableClient('MODULE_RULES');
  
  const entity = {
    partitionKey: courseId,
    rowKey: 'rules',
    rules: JSON.stringify(rules || []),
    updatedAt: new Date().toISOString()
  };
  
  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  
  logger.info({ courseId, ruleCount: (rules || []).length }, 'Module rules saved');
  
  return rules;
}

/**
 * Delete module rules for a course
 */
export async function deleteModuleRules(courseId) {
  if (!courseId) {
    return false;
  }
  
  const client = getTableClient('MODULE_RULES');
  
  try {
    await client.deleteEntity(courseId, 'rules');
    logger.info({ courseId }, 'Module rules deleted');
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return false;
    }
    throw error;
  }
}
