/**
 * Azure Blob Storage Service for Course Files
 * Production-grade file serving from Azure Blob Storage
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import dotenv from 'dotenv';

dotenv.config();

const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'lms-content';

let blobServiceClient = null;
let containerClient = null;

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

  // Create container if it doesn't exist
  try {
    await containerClient.createIfNotExists({
      // No public access - files served through backend API (more secure)
      // If you need public access, enable it in Azure Portal: Storage Account → Configuration → Allow Blob public access
    });
    console.log(`✓ Blob container '${CONTAINER_NAME}' ready`);
  } catch (error) {
    // If container creation fails due to permissions, try to access existing container
    if (error.message.includes('Public access') || error.message.includes('not permitted')) {
      console.log(`⚠️  Container creation skipped (public access not allowed, using private access)`);
      // Verify container exists by trying to list blobs
      try {
        await containerClient.listBlobsFlat().next();
        console.log(`✓ Blob container '${CONTAINER_NAME}' accessible`);
      } catch (listError) {
        console.error(`✗ Cannot access blob container '${CONTAINER_NAME}':`, listError.message);
        throw new Error(`Container '${CONTAINER_NAME}' does not exist. Create it in Azure Portal or enable public access.`);
      }
    } else {
      console.error(`✗ Failed to create blob container '${CONTAINER_NAME}':`, error.message);
      throw error;
    }
  }

  console.log('✓ Azure Blob Storage initialized');
  return true;
}

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

/**
 * Check if blob exists
 */
export async function blobExists(blobPath) {
  try {
    const blobClient = getBlobClient(blobPath);
    return await blobClient.exists();
  } catch (error) {
    console.error(`[Blob Storage] Error checking blob existence: ${blobPath}`, error);
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

  // Azure Blob Storage v12+ - use BlockBlobClient for uploads
  if (Buffer.isBuffer(content)) {
    await blockBlobClient.upload(content, content.length, options);
  } else if (typeof content === 'string') {
    // For strings, convert to buffer
    const buffer = Buffer.from(content, 'utf-8');
    await blockBlobClient.upload(buffer, buffer.length, options);
  } else {
    // For streams or other types
    const length = content.length || content.byteLength || 0;
    await blockBlobClient.upload(content, length, options);
  }
  console.log(`[Blob Storage] Uploaded: ${blobPath}`);
}

/**
 * Delete blob
 */
export async function deleteBlob(blobPath) {
  const blobClient = getBlobClient(blobPath);
  await blobClient.delete();
  console.log(`[Blob Storage] Deleted: ${blobPath}`);
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

