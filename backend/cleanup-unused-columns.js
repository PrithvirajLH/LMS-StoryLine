/**
 * Cleanup script to remove unused columns from Azure Table Storage
 * 
 * SAFE CLEANUP - This script removes columns that are stored but never used:
 * - xapiStatements: statementId, actor, timestamp, stored (duplicates of statement JSON)
 * - xapiState: activityId, agent, stateId, registration, updated (already in keys or not used)
 * - Courses: modules (if empty)
 * 
 * This is safe because:
 * - All read operations only use the columns we're keeping
 * - Removed columns are duplicates or already in partitionKey/rowKey
 * - The code has been updated to stop storing these columns going forward
 * 
 * Usage:
 *   node cleanup-unused-columns.js          # Dry run (shows what would be cleaned)
 *   node cleanup-unused-columns.js --apply  # Actually perform cleanup
 */

import dotenv from 'dotenv';
import { initializeTables, getTableClient, retryOperation } from './azure-tables.js';
import { TABLES } from './azure-tables.js';

dotenv.config();

const DRY_RUN = !process.argv.includes('--apply');

async function cleanupXapiStatements() {
  console.log(`\n🧹 ${DRY_RUN ? '[DRY RUN] ' : ''}Cleaning up xapiStatements table...`);
  const client = getTableClient('STATEMENTS');
  let count = 0;
  let needsCleanup = 0;
  let updated = 0;
  
  try {
    for await (const entity of client.listEntities()) {
      count++;
      
      // Check if entity has unused columns
      const hasUnusedColumns = entity.statementId || entity.actor || entity.timestamp || entity.stored;
      
      if (hasUnusedColumns) {
        needsCleanup++;
        
        if (!DRY_RUN) {
          // Create new entity with only used columns
          const cleanedEntity = {
            partitionKey: entity.partitionKey,
            rowKey: entity.rowKey,
            statement: entity.statement, // Keep - this is the full statement
            verb: entity.verb, // Keep - used for filtering
            object: entity.object, // Keep - used for filtering
            registration: entity.registration // Keep - used for filtering
            // Removed: statementId, actor, timestamp, stored (all duplicates of statement JSON)
          };
          
          await retryOperation(() => client.upsertEntity(cleanedEntity, 'Replace'));
          updated++;
          
          if (updated % 100 === 0) {
            console.log(`  ✅ Updated ${updated} statements...`);
          }
        }
      }
    }
    
    if (DRY_RUN) {
      console.log(`  📊 Found ${needsCleanup} out of ${count} statements that need cleanup`);
      console.log(`  💡 Run with --apply flag to actually perform cleanup`);
    } else {
      console.log(`  ✅ Cleaned ${updated} out of ${count} statements`);
    }
  } catch (error) {
    console.error('  ❌ Error cleaning xapiStatements:', error);
  }
}

async function cleanupXapiState() {
  console.log(`\n🧹 ${DRY_RUN ? '[DRY RUN] ' : ''}Cleaning up xapiState table...`);
  const client = getTableClient('STATE');
  let count = 0;
  let needsCleanup = 0;
  let updated = 0;
  
  try {
    for await (const entity of client.listEntities()) {
      count++;
      
      // Check if entity has unused columns
      const hasUnusedColumns = entity.activityId || entity.agent || entity.stateId || 
                                entity.registration || entity.updated;
      
      if (hasUnusedColumns) {
        needsCleanup++;
        
        if (!DRY_RUN) {
          // Create new entity with only used columns
          const cleanedEntity = {
            partitionKey: entity.partitionKey,
            rowKey: entity.rowKey,
            state: entity.state // Keep - this is the actual state data
            // Removed: activityId (in partitionKey), agent (in partitionKey), 
            //          stateId (in rowKey), registration (in rowKey), updated (not used)
          };
          
          await retryOperation(() => client.upsertEntity(cleanedEntity, 'Replace'));
          updated++;
          
          if (updated % 100 === 0) {
            console.log(`  ✅ Updated ${updated} state entries...`);
          }
        }
      }
    }
    
    if (DRY_RUN) {
      console.log(`  📊 Found ${needsCleanup} out of ${count} state entries that need cleanup`);
      console.log(`  💡 Run with --apply flag to actually perform cleanup`);
    } else {
      console.log(`  ✅ Cleaned ${updated} out of ${count} state entries`);
    }
  } catch (error) {
    console.error('  ❌ Error cleaning xapiState:', error);
  }
}

async function cleanupCourses() {
  console.log(`\n🧹 ${DRY_RUN ? '[DRY RUN] ' : ''}Cleaning up Courses table...`);
  const client = getTableClient('COURSES');
  let count = 0;
  let needsCleanup = 0;
  let updated = 0;
  
  try {
    for await (const entity of client.listEntities()) {
      count++;
      
      // Check if modules is empty (can be removed)
      const modules = entity.modules ? JSON.parse(entity.modules) : [];
      const hasModules = Array.isArray(modules) && modules.length > 0;
      const hasEmptyModules = entity.modules && !hasModules;
      
      if (hasEmptyModules) {
        needsCleanup++;
        
        if (!DRY_RUN) {
          // Create new entity - keep modules only if it has data
          const cleanedEntity = {
            partitionKey: entity.partitionKey,
            rowKey: entity.rowKey,
            title: entity.title,
            description: entity.description || '',
            thumbnailUrl: entity.thumbnailUrl || '',
            activityId: entity.activityId,
            launchFile: entity.launchFile || 'index_lms.html',
            coursePath: entity.coursePath || '',
            // Don't include modules if empty
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
          };
          
          await retryOperation(() => client.upsertEntity(cleanedEntity, 'Replace'));
          updated++;
        }
      }
    }
    
    if (DRY_RUN) {
      console.log(`  📊 Found ${needsCleanup} out of ${count} courses with empty modules`);
      console.log(`  💡 Run with --apply flag to actually perform cleanup`);
    } else {
      console.log(`  ✅ Cleaned ${updated} out of ${count} courses`);
    }
  } catch (error) {
    console.error('  ❌ Error cleaning Courses:', error);
  }
}

async function main() {
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
    console.log('💡 Add --apply flag to actually perform cleanup\n');
  } else {
    console.log('🚀 Starting cleanup of unused columns...\n');
  }
  
  try {
    await initializeTables();
    console.log('✅ Tables initialized\n');
    
    // Cleanup each table
    await cleanupXapiStatements();
    await cleanupXapiState();
    await cleanupCourses();
    
    if (DRY_RUN) {
      console.log('\n✅ Dry run completed!');
      console.log('\n📝 Summary of columns that would be removed:');
      console.log('  - xapiStatements: statementId, actor, timestamp, stored (duplicates of statement JSON)');
      console.log('  - xapiState: activityId, agent, stateId, registration, updated (in keys or unused)');
      console.log('  - Courses: empty modules arrays');
      console.log('\n💡 Run with --apply flag to actually perform cleanup');
    } else {
      console.log('\n✅ Cleanup completed!');
      console.log('\n📝 Summary:');
      console.log('  - xapiStatements: Removed statementId, actor, timestamp, stored');
      console.log('  - xapiState: Removed activityId, agent, stateId, registration, updated');
      console.log('  - Courses: Removed empty modules arrays');
      console.log('\n💡 Note: These columns were duplicates or not used in queries.');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

main();

