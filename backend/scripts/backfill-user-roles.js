/**
 * Backfill user roles/flags for existing users.
 * Usage: node backend/scripts/backfill-user-roles.js [--dry-run]
 */

import dotenv from 'dotenv';
dotenv.config();

import * as usersStorage from '../users-storage.js';
import { buildAuthUser } from '../auth.js';

const isDryRun = process.argv.includes('--dry-run');

function normalizeRoleArray(roles) {
  if (!Array.isArray(roles)) return [];
  return roles.map((role) => String(role)).filter(Boolean).sort();
}

function hasMismatch(user, normalized) {
  const rolesA = normalizeRoleArray(user.roles);
  const rolesB = normalizeRoleArray(normalized.roles);
  if (rolesA.join(',') !== rolesB.join(',')) return true;

  const flagKeys = [
    'isAdmin',
    'isManager',
    'isCoordinator',
    'isLearningCoordinator',
    'isCoach',
    'isInstructionalCoach',
    'isCorporate',
    'isHr',
    'isLearner'
  ];

  return flagKeys.some((key) => Boolean(user[key]) !== Boolean(normalized[key]));
}

async function run() {
  const users = await usersStorage.getAllUsers();
  let updatedCount = 0;

  for (const user of users) {
    const normalized = buildAuthUser(user);

    if (!hasMismatch(user, normalized)) {
      continue;
    }

    updatedCount += 1;

    if (isDryRun) {
      console.log(`[DRY-RUN] Would update ${user.email} -> roles=${normalized.roles?.join(',')}`);
      continue;
    }

    await usersStorage.saveUser({
      ...user,
      role: normalized.role,
      roles: normalized.roles,
      isAdmin: normalized.isAdmin,
      isManager: normalized.isManager,
      isCoordinator: normalized.isCoordinator,
      isLearningCoordinator: normalized.isLearningCoordinator,
      isCoach: normalized.isCoach,
      isInstructionalCoach: normalized.isInstructionalCoach,
      isCorporate: normalized.isCorporate,
      isHr: normalized.isHr,
      isLearner: normalized.isLearner
    });

    console.log(`Updated ${user.email} -> roles=${normalized.roles?.join(',')}`);
  }

  console.log(`Backfill complete. Updated ${updatedCount} user(s).`);
}

run().catch((error) => {
  console.error('Backfill failed:', error.message);
  process.exit(1);
});
