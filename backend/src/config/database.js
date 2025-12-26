// Using Azure Table Storage instead of SQL Server
import { initializeTables, isTableStorageAvailable } from './tableStorage.js';

let initialized = false;

export async function getPool() {
  // For compatibility, return a mock pool object
  // Routes should use tableService.js instead
  if (!initialized) {
    try {
      await initializeTables();
      initialized = true;
    } catch (error) {
      console.error('Table Storage initialization error:', error.message);
      throw error;
    }
  }
  
  // Return mock pool for backward compatibility
  return {
    request: () => ({
      input: () => ({ query: async () => ({ recordset: [] }) }),
      query: async () => ({ recordset: [] }),
    }),
  };
}

export async function isDatabaseAvailable() {
  return await isTableStorageAvailable();
}

export async function closePool() {
  // No-op for Table Storage
  initialized = false;
}

// Mock sql object for backward compatibility
export const sql = {
  NVarChar: (val) => val,
  UniqueIdentifier: (val) => val,
};


