import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

if (!accountName || !accountKey) {
  console.warn('Azure Storage Account credentials not set. Table operations will fail.');
}

// Create credential
const credential = accountName && accountKey
  ? new AzureNamedKeyCredential(accountName, accountKey)
  : null;

// Table names
export const TABLES = {
  USERS: 'Users',
  COURSES: 'Courses',
  ENROLLMENTS: 'Enrollments',
  ATTEMPTS: 'Attempts',
};

// Helper to get table client
export function getTableClient(tableName) {
  if (!credential) {
    throw new Error('Azure Storage credentials not configured');
  }
  
  return new TableClient(
    `https://${accountName}.table.core.windows.net`,
    tableName,
    credential
  );
}

// Initialize tables (create if they don't exist)
export async function initializeTables() {
  if (!credential) {
    console.warn('⚠ Azure Storage credentials not set. Skipping table initialization.');
    return;
  }

  try {
    const tables = Object.values(TABLES);
    
    for (const tableName of tables) {
      try {
        const client = getTableClient(tableName);
        await client.createTable();
        console.log(`✓ Table '${tableName}' ready`);
      } catch (error) {
        if (error.statusCode === 409) {
          // Table already exists
          console.log(`✓ Table '${tableName}' already exists`);
        } else {
          console.error(`✗ Failed to create table '${tableName}':`, error.message);
        }
      }
    }
    
    console.log('✓ Azure Table Storage initialized');
  } catch (error) {
    console.error('✗ Table Storage initialization error:', error.message);
    throw error;
  }
}

// Helper to check if table storage is available
export async function isTableStorageAvailable() {
  try {
    if (!credential) return false;
    const client = getTableClient(TABLES.USERS);
    await client.getAccessPolicy(); // Simple operation to test connection
    return true;
  } catch {
    return false;
  }
}

export { credential };

