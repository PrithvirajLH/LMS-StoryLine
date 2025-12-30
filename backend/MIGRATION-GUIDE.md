# UserProgress Migration Guide

## Overview

This guide explains how to migrate existing `UserProgress` table entries from numeric `userId` PartitionKeys to email addresses for better data consistency.

## Problem

Older progress entries use numeric user IDs (e.g., `"2"`) as PartitionKey, which leads to:
- Inconsistent data format
- Difficulty matching with user accounts
- Display issues (showing "2" and "2@example.com")

## Solution

Migrate all progress entries to use email addresses as PartitionKey.

## Migration Script

A migration script is available: `migrate-progress-to-email.js`

### Usage

#### 1. Dry Run (Recommended First)

Test the migration without making changes:

```bash
cd backend
node migrate-progress-to-email.js --dry-run
```

This will:
- Show what entries would be migrated
- Identify any issues
- **Not make any changes**

#### 2. Run Migration

Once you've verified the dry run looks good:

```bash
node migrate-progress-to-email.js
```

This will:
- Create new entries with email as PartitionKey
- Keep old entries (for safety)

#### 3. Delete Old Entries (After Verification)

After verifying the new entries work correctly:

```bash
node migrate-progress-to-email.js --delete-old
```

This will:
- Create new entries with email as PartitionKey
- **Delete old entries with numeric userId**

**⚠️ Warning**: Only run `--delete-old` after verifying the migration worked correctly!

## What the Script Does

1. **Reads all progress entries** from `UserProgress` table
2. **Identifies entries to migrate** (those with numeric PartitionKey)
3. **Looks up user email** from:
   - Auth system (by userId)
   - xAPI statements (by searching for matching actor emails)
   - Falls back to generated email (`userId@example.com`)
4. **Creates new entry** with email as PartitionKey
5. **Optionally deletes old entry** (if `--delete-old` flag is used)

## Example Output

```
🔄 Starting UserProgress migration...
   Mode: LIVE (changes will be saved)
   Delete old entries: NO (old entries will be kept)

✓ Azure Tables initialized

📊 Reading all progress entries...
   Found 1 progress entries

📋 Entries to migrate: 1
   Entries already using email: 0

   Looking for email in xAPI statements for user ID "2"...
   ✓ Found email from xAPI statements: admin@example.com
✅ Migrated: 2 → admin@example.com (Course: sharepoint-navigation-101)

📊 Migration Summary:
   ✅ Migrated: 1
   ⏭️  Skipped: 0
   ❌ Errors: 0
```

## Manual Migration

If the script can't find a user's email, you can manually update entries:

1. **Find the entry** in Azure Portal → Storage Account → Tables → `UserProgress`
2. **Note the PartitionKey** (e.g., `"2"`) and **RowKey** (course ID)
3. **Create a new entry** with:
   - PartitionKey: User's email (e.g., `"user@example.com"`)
   - RowKey: Same course ID
   - Copy all other fields
4. **Delete the old entry** after verifying the new one works

## Verification

After migration, verify:

1. **Check admin panel** - Progress should show proper names instead of "2"
2. **Check user dashboard** - Users should see their progress correctly
3. **Test course launch** - New progress entries should use email

## Rollback

If something goes wrong:

1. **Old entries are kept** (unless you used `--delete-old`)
2. **Revert code changes** if needed
3. **Delete new entries** manually if necessary

## Notes

- **New entries** created after the code update will automatically use email
- **Old entries** will continue to work but may show fallback emails
- **Migration is safe** - it creates new entries without deleting old ones (unless `--delete-old` is used)
- **Multiple runs are safe** - script checks for existing entries before creating

