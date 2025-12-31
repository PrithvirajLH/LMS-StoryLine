/**
 * Clear all data from Azure Tables except:
 * - Courses table (keep all courses)
 * - Users table (keep only admin user)
 */

import { initializeTables, getTableClient, TABLES } from './azure-tables.js';
import dotenv from 'dotenv';

dotenv.config();

async function clearAllData() {
  console.log('🧹 Starting data cleanup...\n');

  try {
    // Initialize Azure Tables
    await initializeTables();
    console.log('✓ Azure Tables initialized\n');

    // 1. Clear xapiStatements
    console.log('📊 Clearing xapiStatements...');
    await clearTable('STATEMENTS');
    console.log('✓ xapiStatements cleared\n');

    // 2. Clear xapiState
    console.log('📊 Clearing xapiState...');
    await clearTable('STATE');
    console.log('✓ xapiState cleared\n');

    // 3. Clear xapiActivityProfiles
    console.log('📊 Clearing xapiActivityProfiles...');
    await clearTable('ACTIVITY_PROFILES');
    console.log('✓ xapiActivityProfiles cleared\n');

    // 4. Clear xapiAgentProfiles
    console.log('📊 Clearing xapiAgentProfiles...');
    await clearTable('AGENT_PROFILES');
    console.log('✓ xapiAgentProfiles cleared\n');

    // 5. Clear UserProgress
    console.log('📊 Clearing UserProgress...');
    await clearTable('USER_PROGRESS');
    console.log('✓ UserProgress cleared\n');

    // 6. Clear Users (except admin)
    console.log('👥 Clearing Users (keeping admin only)...');
    await clearUsersExceptAdmin();
    console.log('✓ Users cleared (admin kept)\n');

    // 7. Keep Courses table as-is
    console.log('📚 Courses table: KEPT (no changes)\n');

    console.log('✅ Data cleanup complete!');
    console.log('\nSummary:');
    console.log('  ✓ xapiStatements: CLEARED');
    console.log('  ✓ xapiState: CLEARED');
    console.log('  ✓ xapiActivityProfiles: CLEARED');
    console.log('  ✓ xapiAgentProfiles: CLEARED');
    console.log('  ✓ UserProgress: CLEARED');
    console.log('  ✓ Users: CLEARED (admin kept)');
    console.log('  ✓ Courses: KEPT (no changes)');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

/**
 * Clear all entities from a table
 */
async function clearTable(tableKey) {
  const client = getTableClient(tableKey);
  const tableName = TABLES[tableKey];
  let count = 0;

  try {
    // List all entities
    const entities = [];
    for await (const entity of client.listEntities()) {
      entities.push(entity);
    }

    // Delete in batches (Azure allows up to 100 entities per transaction)
    const batchSize = 100;
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      // Group by partition key for batch deletion
      const partitionGroups = {};
      for (const entity of batch) {
        const pk = entity.partitionKey;
        if (!partitionGroups[pk]) {
          partitionGroups[pk] = [];
        }
        partitionGroups[pk].push(entity);
      }

      // Delete each partition group
      for (const [partitionKey, group] of Object.entries(partitionGroups)) {
        // Azure Table Storage batch operations require same partition key
        // Delete individually for simplicity
        for (const entity of group) {
          try {
            await client.deleteEntity(entity.partitionKey, entity.rowKey);
            count++;
          } catch (error) {
            if (error.statusCode !== 404) {
              console.error(`  ⚠️  Error deleting ${entity.partitionKey}/${entity.rowKey}:`, error.message);
            }
          }
        }
      }
    }

    console.log(`  Deleted ${count} entities`);
  } catch (error) {
    console.error(`  ❌ Error clearing table ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Clear all users except admin
 */
async function clearUsersExceptAdmin() {
  const client = getTableClient('USERS');
  let deletedCount = 0;
  let keptCount = 0;

  try {
    // List all users
    const users = [];
    for await (const entity of client.listEntities()) {
      users.push(entity);
    }

    // Delete all users except admin
    for (const user of users) {
      const email = user.email || user.rowKey;
      if (email && email.toLowerCase() === 'admin@example.com') {
        keptCount++;
        console.log(`  ✓ Keeping admin user: ${email}`);
      } else {
        try {
          await client.deleteEntity(user.partitionKey, user.rowKey);
          deletedCount++;
        } catch (error) {
          if (error.statusCode !== 404) {
            console.error(`  ⚠️  Error deleting user ${email}:`, error.message);
          }
        }
      }
    }

    console.log(`  Deleted ${deletedCount} users, kept ${keptCount} admin user(s)`);
  } catch (error) {
    console.error('  ❌ Error clearing users:', error.message);
    throw error;
  }
}

// Run cleanup
clearAllData().catch(console.error);

