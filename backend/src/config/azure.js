import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'lms-content';

if (!accountName) {
  console.warn('AZURE_STORAGE_ACCOUNT_NAME not set. Blob operations will fail.');
}

let blobServiceClient = null;

if (accountName) {
  if (accountKey) {
    // Use account key (for local development)
    try {
      const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
      blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        sharedKeyCredential
      );
      console.log('✓ Azure Storage configured using account key');
    } catch (error) {
      console.error('✗ Azure Storage connection error:', error.message);
      console.warn('⚠ Check your AZURE_STORAGE_ACCOUNT_KEY in .env');
    }
  } else {
    // Use DefaultAzureCredential (Managed Identity or Azure CLI)
    try {
      const credential = new DefaultAzureCredential();
      blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential
      );
      console.log('✓ Azure Storage configured using DefaultAzureCredential');
    } catch (error) {
      console.warn('⚠ Azure Storage credential error:', error.message);
      console.warn('⚠ Set AZURE_STORAGE_ACCOUNT_KEY in .env for local development');
    }
  }
}

export function getBlobServiceClient() {
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not configured');
  }
  return blobServiceClient;
}

export function getContainerName() {
  return containerName;
}

export { DefaultAzureCredential };


