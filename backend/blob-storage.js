/**
 * Azure Blob Storage Service for Course Files
 * Production-grade file serving from Azure Blob Storage
 */

// Import crypto polyfill before Azure SDK
import './crypto-polyfill.js';

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import dotenv from 'dotenv';
import { blobLogger as logger } from './logger.js';

dotenv.config();

const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'lms-content';

let blobServiceClient = null;
let containerClient = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize Azure Blob Storage
 */
export async function initializeBlobStorage() {
  if (!STORAGE_ACCOUNT_NAME || !STORAGE_ACCOUNT_KEY) {
    throw new Error('Azure Storage credentials not configured. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY');
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(STORAGE_ACCOUNT_NAME, STORAGE_ACCOUNT_KEY);
  const accountUrl = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;
  
  blobServiceClient = new BlobServiceClient(accountUrl, sharedKeyCredential);
  containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  try {
    await containerClient.createIfNotExists({});
    logger.info({ container: CONTAINER_NAME }, 'Blob container ready');
  } catch (error) {
    if (error.message.includes('Public access') || error.message.includes('not permitted')) {
      logger.warn({ container: CONTAINER_NAME }, 'Container creation skipped (public access not allowed)');
      try {
        await containerClient.listBlobsFlat().next();
        logger.info({ container: CONTAINER_NAME }, 'Blob container accessible');
      } catch (listError) {
        logger.error({ container: CONTAINER_NAME, error: listError.message }, 'Cannot access blob container');
        throw new Error(`Container '${CONTAINER_NAME}' does not exist or is not accessible`);
      }
    } else {
      logger.error({ container: CONTAINER_NAME, error: error.message }, 'Failed to create blob container');
      throw error;
    }
  }

  logger.info('Azure Blob Storage initialized');
  return true;
}

// ============================================================================
// Container/Blob Access
// ============================================================================

/**
 * Get container client
 */
export function getContainerClient() {
  if (!containerClient) {
    throw new Error('Blob storage not initialized. Call initializeBlobStorage() first.');
  }
  return containerClient;
}

/**
 * Get blob client for a specific file
 */
export function getBlobClient(blobPath) {
  const container = getContainerClient();
  return container.getBlobClient(blobPath);
}

// ============================================================================
// Blob Operations
// ============================================================================

/**
 * Check if blob exists
 */
export async function blobExists(blobPath) {
  try {
    const blobClient = getBlobClient(blobPath);
    return await blobClient.exists();
  } catch (error) {
    logger.error({ blobPath, error: error.message }, 'Error checking blob existence');
    return false;
  }
}

/**
 * Get blob content as stream
 */
export async function getBlobStream(blobPath) {
  const blobClient = getBlobClient(blobPath);
  const exists = await blobClient.exists();
  
  if (!exists) {
    throw new Error(`Blob not found: ${blobPath}`);
  }

  const downloadResponse = await blobClient.download();
  return downloadResponse.readableStreamBody;
}

/**
 * Get blob content as buffer
 */
export async function getBlobBuffer(blobPath) {
  const blobClient = getBlobClient(blobPath);
  const exists = await blobClient.exists();
  
  if (!exists) {
    throw new Error(`Blob not found: ${blobPath}`);
  }

  const downloadResponse = await blobClient.download();
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload file to blob storage
 */
export async function uploadBlob(blobPath, content, contentType = null) {
  const blobClient = getBlobClient(blobPath);
  const blockBlobClient = blobClient.getBlockBlobClient();
  
  const options = {};
  if (contentType) {
    options.blobHTTPHeaders = { blobContentType: contentType };
  }

  if (Buffer.isBuffer(content)) {
    await blockBlobClient.upload(content, content.length, options);
  } else if (typeof content === 'string') {
    const buffer = Buffer.from(content, 'utf-8');
    await blockBlobClient.upload(buffer, buffer.length, options);
  } else {
    const length = content.length || content.byteLength || 0;
    await blockBlobClient.upload(content, length, options);
  }
  
  logger.debug({ blobPath }, 'Blob uploaded');
}

/**
 * Delete blob
 */
export async function deleteBlob(blobPath) {
  const blobClient = getBlobClient(blobPath);
  await blobClient.delete();
  logger.debug({ blobPath }, 'Blob deleted');
}

/**
 * List blobs in a path (directory)
 */
export async function listBlobs(prefix = '') {
  const container = getContainerClient();
  const blobs = [];
  
  for await (const blob of container.listBlobsFlat({ prefix })) {
    blobs.push({
      name: blob.name,
      size: blob.properties.contentLength,
      lastModified: blob.properties.lastModified,
      contentType: blob.properties.contentType
    });
  }
  
  return blobs;
}

/**
 * Get blob URL (for direct access)
 */
export function getBlobUrl(blobPath) {
  const blobClient = getBlobClient(blobPath);
  return blobClient.url;
}
