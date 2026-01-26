/**
 * One-time backfill for knowledge check attempts from xAPI statements.
 * Usage:
 *   node scripts/backfill-kc-attempts.js
 *   node scripts/backfill-kc-attempts.js --limit 5000 --page-size 200 --dry-run
 */

import dotenv from 'dotenv';
dotenv.config();

import '../crypto-polyfill.js';
import { getTableClient } from '../azure-tables.js';
import { storageLogger as logger } from '../logger.js';
import * as kcAttemptsStorage from '../kc-attempts-storage.js';
import * as verbTracker from '../xapi-verb-tracker.js';
import * as coursesStorage from '../courses-storage.js';

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

function getUserIdFromActor(actor) {
  if (!actor) return null;
  if (actor.mbox) {
    return actor.mbox.replace('mailto:', '').toLowerCase();
  }
  const accountName = actor.account?.name;
  if (accountName) {
    return String(accountName).toLowerCase();
  }
  return null;
}

function isKnowledgeCheckStatement(statement) {
  if (!statement) return false;
  const verbId = statement.verb?.id || '';
  const verbConfig = verbTracker.getVerbConfig(verbId);
  const interactionType = statement.object?.definition?.interactionType || '';
  const definitionType = statement.object?.definition?.type || '';
  const result = statement.result || {};
  const score = result.score || {};

  const hasResponse = typeof result.response === 'string' && result.response.length > 0;
  const hasScore = typeof score.scaled === 'number' || typeof score.raw === 'number';
  const hasSuccess = typeof result.success === 'boolean';
  const isInteractionType = Boolean(interactionType) || definitionType.includes('interaction') || definitionType.includes('question');

  return verbConfig.action === 'track_answer' ||
    verbConfig.action === 'track_attempt' ||
    (isInteractionType && (hasResponse || hasScore || hasSuccess));
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

  await verbTracker.initializeVerbTracker();

  const courses = await coursesStorage.getAllCourses();

  function findCourseByActivityId(activityId) {
    if (!activityId) return null;
    const baseActivityId = getBaseActivityId(activityId);
    let course = courses.find(c => c.activityId === activityId);
    if (course) return course;
    if (baseActivityId && baseActivityId !== activityId) {
      course = courses.find(c => c.activityId === baseActivityId);
      if (course) return course;
    }
    course = courses.find(c => activityId.startsWith(c.activityId + '/') || activityId === c.activityId);
    return course || null;
  }

  const client = getTableClient('STATEMENTS');
  const listEntities = client.listEntities();
  const pageIterator = listEntities.byPage({ maxPageSize: pageSize });

  let scanned = 0;
  let matched = 0;
  let recorded = 0;
  let skipped = 0;
  let errors = 0;

  logger.info({ dryRun, limit, pageSize }, 'Starting KC attempts backfill');

  for await (const page of pageIterator) {
    for (const entity of page) {
      if (scanned >= limit) break;
      scanned++;

      if (!entity.statement) {
        skipped++;
        continue;
      }

      let statement;
      try {
        statement = JSON.parse(entity.statement);
      } catch (error) {
        errors++;
        logger.warn({ error: error.message, rowKey: entity.rowKey }, 'Invalid statement JSON');
        continue;
      }

      if (!isKnowledgeCheckStatement(statement)) {
        skipped++;
        continue;
      }

      const userEmail = getUserIdFromActor(statement.actor);
      const activityId = statement.object?.id || '';
      const course = findCourseByActivityId(activityId);
      const registrationId = statement.context?.registration || null;

      if (!userEmail || !activityId) {
        skipped++;
        continue;
      }

      matched++;

      if (dryRun) {
        recorded++;
        continue;
      }

      try {
        const result = await kcAttemptsStorage.recordAttempt(statement, {
          userEmail,
          registrationId,
          courseId: course?.courseId || null,
          activityId: course?.activityId || activityId
        });
        if (result) {
          recorded++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        logger.warn({ error: error.message, rowKey: entity.rowKey }, 'Failed to record KC attempt');
      }
    }

    if (scanned >= limit) break;
  }

  logger.info({ scanned, matched, recorded, skipped, errors }, 'KC attempts backfill complete');
}

run().catch(error => {
  logger.error({ error: error.message }, 'KC attempts backfill failed');
  process.exitCode = 1;
});
