/**
 * Migration Script: Convert UserProgress PartitionKey from numeric userId to email
 * 
 * This script migrates existing progress entries to use email addresses as PartitionKey
 * instead of numeric userIds for better consistency and data organization.
 * 
 * Usage: node migrate-progress-to-email.js [--dry-run] [--delete-old]
 */

import * as progressStorage from './progress-storage.js';
import * as auth from './auth.js';
import * as xapiLRS from './xapi-lrs-azure.js';
import { getTableClient, initializeTables, TABLES } from './azure-tables.js';
import dotenv from 'dotenv';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_OLD = process.argv.includes('--delete-old');

/**
 * Migrate progress entries from numeric userId to email
 */
async function migrateProgressToEmail() {
  try {
    console.log('🔄 Starting UserProgress migration...');
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be saved)'}`);
    console.log(`   Delete old entries: ${DELETE_OLD ? 'YES' : 'NO (old entries will be kept)'}\n`);

    // Initialize Azure Tables
    await initializeTables();
    console.log('✓ Azure Tables initialized\n');

    // Get all progress entries
    const client = getTableClient('USER_PROGRESS');
    const allProgress = [];
    
    console.log('📊 Reading all progress entries...');
    for await (const entity of client.listEntities()) {
      allProgress.push({
        partitionKey: entity.partitionKey,
        rowKey: entity.rowKey,
        enrollmentStatus: entity.enrollmentStatus,
        completionStatus: entity.completionStatus,
        score: entity.score,
        timeSpent: entity.timeSpent,
        enrolledAt: entity.enrolledAt,
        startedAt: entity.startedAt,
        completedAt: entity.completedAt,
        lastAccessedAt: entity.lastAccessedAt,
        updatedAt: entity.updatedAt
      });
    }
    
    console.log(`   Found ${allProgress.length} progress entries\n`);

    // Filter entries that need migration (numeric userId)
    const entriesToMigrate = allProgress.filter(entry => {
      // Check if PartitionKey is numeric (not an email)
      return !entry.partitionKey.includes('@');
    });

    console.log(`📋 Entries to migrate: ${entriesToMigrate.length}`);
    console.log(`   Entries already using email: ${allProgress.length - entriesToMigrate.length}\n`);

    if (entriesToMigrate.length === 0) {
      console.log('✅ No migration needed - all entries already use email addresses!');
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    // Process each entry
    for (const entry of entriesToMigrate) {
      try {
        const numericUserId = entry.partitionKey;
        const courseId = entry.rowKey;

        // Try to get user by ID
        let user = await auth.getUserById(numericUserId);
        
        // If not found by ID, try to find by checking all users
        if (!user) {
          const allUsers = await auth.getAllUsers();
          user = allUsers.find(u => u.id === numericUserId || u.userId === numericUserId);
        }
        
        let userEmail = null;
        
        if (user && user.email) {
          userEmail = user.email;
        } else {
          // Try to find email from xAPI statements by searching all statements
          console.log(`   Looking for email in xAPI statements for user ID "${numericUserId}"...`);
          try {
            const statementsClient = getTableClient('STATEMENTS');
            let foundEmail = null;
            
            // Search through statements to find one that might match this user
            // Look for statements where the actor might reference this userId
            const iterator = statementsClient.listEntities();
            for await (const statementEntity of iterator) {
              try {
                const statement = JSON.parse(statementEntity.statement);
                // Check if statement actor has mbox that might match
                if (statement.actor && statement.actor.mbox) {
                  const email = statement.actor.mbox.replace('mailto:', '');
                  // Check if this email's username part matches the userId
                  const emailUsername = email.split('@')[0];
                  
                  // If we find a statement that might be from this user, use that email
                  // We'll use the first email we find that seems related
                  // (This is a heuristic - in production you'd have better user mapping)
                  if (emailUsername === numericUserId || emailUsername === `user${numericUserId}`) {
                    foundEmail = email;
                    break;
                  }
                }
              } catch (e) {
                // Skip malformed statements
                continue;
              }
            }
            
            if (foundEmail) {
              userEmail = foundEmail;
              console.log(`   ✓ Found email from xAPI statements: ${userEmail}`);
            } else {
              // Try common patterns
              const possibleEmails = [
                `${numericUserId}@example.com`,
                `user${numericUserId}@example.com`
              ];
              
              // Check if any of these emails have statements
              for (const email of possibleEmails) {
                try {
                  const iterator = statementsClient.listEntities({
                    queryOptions: { filter: `PartitionKey eq '${email}'` }
                  });
                  const firstStatement = await iterator.next();
                  if (!firstStatement.done) {
                    foundEmail = email;
                    break;
                  }
                } catch (e) {
                  // Continue searching
                }
              }
              
              if (foundEmail) {
                userEmail = foundEmail;
                console.log(`   ✓ Found email from xAPI statements (pattern match): ${userEmail}`);
              } else {
                // Last resort: generate email from userId
                userEmail = `${numericUserId}@example.com`;
                console.log(`   ⚠️  Using generated email: ${userEmail}`);
                console.log(`   💡 Note: This is a fallback. You may want to update this manually.`);
              }
            }
          } catch (error) {
            // Fallback to generated email
            userEmail = `${numericUserId}@example.com`;
            console.log(`   ⚠️  Using generated email (fallback): ${userEmail}`);
          }
        }
        
        if (!userEmail) {
          console.log(`❌ Could not determine email for user ID "${numericUserId}"`);
          skipped++;
          continue;
        }
        const newPartitionKey = userEmail;

        // Check if entry with email already exists
        let existingEntry = null;
        try {
          existingEntry = await client.getEntity(newPartitionKey, courseId);
          console.log(`⚠️  Entry already exists for ${userEmail} / ${courseId} - skipping migration`);
          skipped++;
          continue;
        } catch (error) {
          // Entry doesn't exist with email - proceed with migration
        }

        if (DRY_RUN) {
          console.log(`[DRY RUN] Would migrate: ${numericUserId} → ${userEmail} (Course: ${courseId})`);
          migrated++;
        } else {
          // Create new entry with email as PartitionKey
          const newEntity = {
            partitionKey: newPartitionKey,
            rowKey: courseId,
            enrollmentStatus: entry.enrollmentStatus || 'not_enrolled',
            completionStatus: entry.completionStatus || 'not_started',
            score: entry.score || null,
            timeSpent: entry.timeSpent || 0,
            enrolledAt: entry.enrolledAt || null,
            startedAt: entry.startedAt || null,
            completedAt: entry.completedAt || null,
            lastAccessedAt: entry.lastAccessedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await client.upsertEntity(newEntity, 'Replace');
          console.log(`✅ Migrated: ${numericUserId} → ${userEmail} (Course: ${courseId})`);

          // Delete old entry if requested
          if (DELETE_OLD) {
            try {
              await client.deleteEntity(numericUserId, courseId);
              console.log(`   🗑️  Deleted old entry with PartitionKey: ${numericUserId}`);
            } catch (deleteError) {
              console.log(`   ⚠️  Could not delete old entry: ${deleteError.message}`);
            }
          }

          migrated++;
        }
      } catch (error) {
        console.error(`❌ Error migrating entry ${entry.partitionKey}/${entry.rowKey}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    
    if (DRY_RUN) {
      console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
    } else if (!DELETE_OLD) {
      console.log('\n💡 Old entries with numeric userIds are still in the table.');
      console.log('   Run with --delete-old to remove them after verifying the migration.');
    } else {
      console.log('\n✅ Migration complete! Old entries have been removed.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateProgressToEmail()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

