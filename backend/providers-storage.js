/**
 * Providers Storage using Azure Table Storage
 * Stores facilities/providers for group assignments
 */

import { getTableClient, retryOperation } from './azure-tables.js';
import { storageLogger as logger } from './logger.js';

const PROVIDER_PARTITION_KEY = 'provider';

export async function listProviders() {
  const client = getTableClient('PROVIDERS');
  const providers = [];

  try {
    for await (const entity of client.listEntities()) {
      providers.push({
        providerId: entity.rowKey,
        name: entity.name,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      });
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error listing providers');
    return [];
  }

  return providers;
}

export async function getProvider(providerId) {
  if (!providerId) return null;

  const client = getTableClient('PROVIDERS');

  try {
    const entity = await client.getEntity(PROVIDER_PARTITION_KEY, providerId);
    return {
      providerId: entity.rowKey,
      name: entity.name,
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

export async function saveProvider(provider) {
  if (!provider?.providerId || !provider?.name) {
    throw new Error('providerId and name are required');
  }

  const client = getTableClient('PROVIDERS');

  const entity = {
    partitionKey: PROVIDER_PARTITION_KEY,
    rowKey: provider.providerId,
    name: provider.name,
    createdAt: provider.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  logger.info({ providerId: provider.providerId }, 'Provider saved');
  return entity;
}

export async function deleteProvider(providerId) {
  if (!providerId) return false;
  const client = getTableClient('PROVIDERS');

  try {
    await client.deleteEntity(PROVIDER_PARTITION_KEY, providerId);
    logger.info({ providerId }, 'Provider deleted');
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return false;
    }
    throw error;
  }
}
