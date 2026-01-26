/**
 * Persistent lockout storage using Azure Table Storage
 */

import { getTableClient, retryOperation } from './azure-tables.js';
import { authLogger as logger } from './logger.js';

const PARTITION_KEY = 'lockout';

function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

export async function getLockout(email) {
  if (!email) return null;
  const rowKey = normalizeEmail(email);
  const client = getTableClient('AUTH_LOCKOUTS');

  try {
    const entity = await client.getEntity(PARTITION_KEY, rowKey);
    return {
      failedAttempts: Number(entity.failedAttempts) || 0,
      lockoutUntil: entity.lockoutUntil || null,
      lastAttempt: entity.lastAttempt || null
    };
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return null;
    }
    throw error;
  }
}

export async function upsertLockout(email, updates) {
  if (!email) return false;
  const rowKey = normalizeEmail(email);
  const client = getTableClient('AUTH_LOCKOUTS');

  const entity = {
    partitionKey: PARTITION_KEY,
    rowKey,
    failedAttempts: Number(updates?.failedAttempts) || 0,
    lockoutUntil: updates?.lockoutUntil || null,
    lastAttempt: updates?.lastAttempt || new Date().toISOString()
  };

  await retryOperation(() => client.upsertEntity(entity, 'Merge'));
  logger.debug({ email: rowKey, failedAttempts: entity.failedAttempts }, 'Lockout updated');
  return true;
}

export async function clearLockout(email) {
  if (!email) return false;
  const rowKey = normalizeEmail(email);
  const client = getTableClient('AUTH_LOCKOUTS');

  try {
    await client.deleteEntity(PARTITION_KEY, rowKey);
  } catch (error) {
    if (error.statusCode !== 404 && error.code !== 'ResourceNotFound') {
      throw error;
    }
  }
  return true;
}
