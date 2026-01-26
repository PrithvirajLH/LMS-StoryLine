/**
 * One-time backfill for activityBase on xAPI statements.
 * Usage:
 *   node scripts/backfill-activity-base.js
 *   node scripts/backfill-activity-base.js --limit 5000 --dry-run
 */

import dotenv from 'dotenv';
dotenv.config();

import '../crypto-polyfill.js';
import { getTableClient, retryOperation } from '../azure-tables.js';
import { storageLogger as logger } from '../logger.js';

function getBaseActivityId(activityId) {
  if (!activityId || typeof activityId !== 'string') return '';
  const slashIndex = activityId.indexOf('/');
  return slashIndex > 0 ? activityId.substring(0, slashIndex) : activityId;
}

function getArgValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  const prefix = `${name}=`;
  const match = args.find(arg => arg.startsWith(prefix));
  if (match) {
    return match.slice(prefix.length);
  }
  return fallback;
}

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = getArgValue(args, '--limit', process.env.BACKFILL_LIMIT);
  const pageSizeArg = getArgValue(args, '--page-size', process.env.BACKFILL_PAGE_SIZE);

  const limit = limitArg ? parseInt(limitArg, 10) : Infinity;
  const pageSize = pageSizeArg ? parseInt(pageSizeArg, 10) : 200;

  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('Invalid --limit value');
  }
  if (Number.isNaN(pageSize) || pageSize <= 0) {
    throw new Error('Invalid --page-size value');
  }

  const client = getTableClient('STATEMENTS');
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  logger.info({ dryRun, limit, pageSize }, 'Starting activityBase backfill');

  const listEntities = client.listEntities();
  const pageIterator = listEntities.byPage({ maxPageSize: pageSize });

  for await (const page of pageIterator) {
    for (const entity of page) {
      if (scanned >= limit) {
        break;
      }
      scanned++;

      if (entity.activityBase) {
        skipped++;
        continue;
      }

      let statement;
      try {
        statement = entity.statement ? JSON.parse(entity.statement) : null;
      } catch (error) {
        errors++;
        logger.warn({ error: error.message, rowKey: entity.rowKey }, 'Invalid statement JSON');
        continue;
      }

      const activityId = entity.object || statement?.object?.id || '';
      const activityBase = getBaseActivityId(activityId) || activityId;

      if (!activityBase) {
        skipped++;
        continue;
      }

      if (dryRun) {
        updated++;
        continue;
      }

      try {
        await retryOperation(() => client.updateEntity({
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
          activityBase
        }, 'Merge'));
        updated++;
      } catch (error) {
        errors++;
        logger.warn({ error: error.message, rowKey: entity.rowKey }, 'Failed to update activityBase');
      }
    }

    if (scanned >= limit) {
      break;
    }
  }

  logger.info({ scanned, updated, skipped, errors }, 'ActivityBase backfill complete');
}

run().catch(error => {
  logger.error({ error: error.message }, 'ActivityBase backfill failed');
  process.exitCode = 1;
});
