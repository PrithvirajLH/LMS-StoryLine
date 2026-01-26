/**
 * Storyline LMS Backend Server
 * Serves course files and provides xAPI LRS endpoints
 * 
 * Security & Performance Improvements:
 * - Rate limiting on auth and API endpoints
 * - Request ID tracking for debugging
 * - Centralized error handling
 * - Input validation with Zod
 * - OData injection protection
 * - Proper logging with Pino
 */

// CRITICAL: Load environment variables FIRST, before any imports that read process.env
import dotenv from 'dotenv';
dotenv.config();

// Import crypto polyfill before any Azure SDK imports
import './crypto-polyfill.js';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

// Import services
import * as xapiLRS from './xapi-lrs-azure.js';
import * as auth from './auth.js';
import * as coursesStorage from './courses-storage.js';
import * as blobStorage from './blob-storage.js';
import * as progressStorage from './progress-storage.js';
import * as usersStorage from './users-storage.js';
import * as attemptsStorage from './attempts-storage.js';
import * as kcAttemptsStorage from './kc-attempts-storage.js';
import * as moduleRulesStorage from './module-rules-storage.js';
import * as providersStorage from './providers-storage.js';
import * as providerCoursesStorage from './provider-courses-storage.js';
import * as userAssignmentsStorage from './user-assignments-storage.js';
import { extractActivityIdFromXml } from './extract-activity-id.js';
import { initializeTables } from './azure-tables.js';
import * as verbTracker from './xapi-verb-tracker.js';

// Import utilities
import logger, { serverLogger } from './logger.js';
import { 
  asyncHandler, 
  errorHandler, 
  notFoundHandler, 
  sendXapiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError
} from './errors.js';
import {
  validateBody,
  registerSchema,
  loginSchema,
  createCourseSchema,
  updateCourseSchema,
  customVerbSchema,
  moduleRulesSchema,
  providerSchema,
  providerCourseSchema,
  userProviderSchema,
  userRolesSchema,
  validate
} from './validation.js';

// dotenv.config() is called at the top of the file before imports

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// ============================================================================
// Cookie & Security Configuration
// ============================================================================

const COOKIE_SECRET = process.env.COOKIE_SECRET || (IS_PRODUCTION ? null : 'dev-cookie-secret');
if (IS_PRODUCTION && !COOKIE_SECRET) {
  serverLogger.fatal('COOKIE_SECRET environment variable is required in production');
  throw new Error('CRITICAL: COOKIE_SECRET must be set in production');
}

// Cookie settings for auth token
const AUTH_COOKIE_NAME = 'lms_auth';
const CSRF_COOKIE_NAME = 'lms_csrf';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// SameSite cookie policy:
// - 'strict': Best security, but blocks cross-origin requests (same domain only)
// - 'lax': Allows top-level navigation cross-origin (good for most cases)
// - 'none': Required for cross-origin API calls (must use Secure)
// Use COOKIE_SAMESITE env var for cross-origin deployments (e.g., different subdomains)
// Normalize COOKIE_SAMESITE to lowercase (Express expects lowercase)
const COOKIE_SAMESITE_RAW = process.env.COOKIE_SAMESITE || (IS_PRODUCTION ? 'lax' : 'lax');
const COOKIE_SAMESITE = COOKIE_SAMESITE_RAW.toLowerCase();

const cookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION || COOKIE_SAMESITE === 'none', // HTTPS required for SameSite=None
  sameSite: COOKIE_SAMESITE,
  maxAge: COOKIE_MAX_AGE,
  path: '/'
};

// CORS allowed origins (configure for your domains in production)
const CORS_ORIGINS = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3001', `http://localhost:${PORT}`];

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // limit each IP to 300 requests per minute
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const xapiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // xAPI endpoints need higher limits for course interactions
  message: { error: 'Too many xAPI requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// Request ID Middleware
// ============================================================================

app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
});

// ============================================================================
// Request Logging Middleware
// ============================================================================

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`
    };
    
    if (res.statusCode >= 400) {
      serverLogger.warn(logData, 'Request completed with error');
    } else if (duration > 1000) {
      serverLogger.warn(logData, 'Slow request');
    } else {
      serverLogger.debug(logData, 'Request completed');
    }
  });
  
  next();
});

// ============================================================================
// Helper Functions
// ============================================================================

function getBaseUrl(req) {
  if (process.env.BASE_URL && !process.env.BASE_URL.includes('localhost')) {
    return process.env.BASE_URL;
  }
  
  const protocol = req.get('x-forwarded-proto') || req.protocol || (req.secure ? 'https' : 'http');
  const origin = req.get('origin') || req.get('referer');
  let host = null;
  
  if (origin) {
    try {
      const originUrl = new URL(origin);
      host = `${originUrl.hostname}:${PORT}`;
    } catch (e) {
      // Fall through
    }
  }
  
  if (!host) host = req.get('x-forwarded-host');
  if (!host) host = req.get('host') || `localhost:${PORT}`;
  
  if (host.includes('localhost') && process.env.NODE_ENV !== 'production') {
    const forwardedFor = req.get('x-forwarded-for');
    if (forwardedFor) {
      const clientIp = forwardedFor.split(',')[0].trim().replace(/^::ffff:/, '');
      if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
        host = `${clientIp}:${PORT}`;
      }
    }
  }
  
  return `${protocol}://${host}`;
}

function verifyAuth(req) {
  // Try each auth method and return first VALID token
  // This allows fallback if cookie is stale but Authorization header is valid
  
  // 1. Try cookie first (most secure for browsers)
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) {
    const user = auth.verifyToken(cookieToken);
    if (user) return user;
    // Cookie invalid/expired, try next method
  }
  
  // 2. Try Bearer token (API clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.replace('Bearer ', '');
    const user = auth.verifyToken(bearerToken);
    if (user) return user;
  }
  
  // 3. Try query param (legacy, least secure)
  const queryToken = req.query.token;
  if (queryToken) {
    const user = auth.verifyToken(queryToken);
    if (user) return user;
  }
  
  return null;
}

// Generate CSRF token
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// CSRF validation middleware for state-changing requests
function validateCsrf(req, res, next) {
  // Skip CSRF for API clients using token-based auth (Basic or Bearer)
  // These clients authenticate via Authorization header, not cookies
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Basic') || authHeader?.startsWith('Bearer')) {
    return next();
  }
  
  // Skip for GET/HEAD/OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // In production, validate CSRF token for cookie-based browser sessions
  if (IS_PRODUCTION) {
    const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers['x-csrf-token'];
    
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      serverLogger.warn({ path: req.path }, 'CSRF validation failed');
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  
  next();
}

function requireAuth(req) {
  const user = verifyAuth(req);
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }
  return user;
}

function isAdminUser(user) {
  if (!user) return false;
  return user.role === 'admin' || user.isAdmin === true || (Array.isArray(user.roles) && user.roles.includes('admin'));
}

function requireAdmin(req) {
  const user = requireAuth(req);
  if (!isAdminUser(user)) {
    throw new AuthorizationError('Admin access required');
  }
  return user;
}

function countAdmins(users) {
  return users.filter((user) => isAdminUser(user)).length;
}

function normalizeRolesInput(currentUser, input = {}) {
  const nextRoles = new Set(Array.isArray(currentUser?.roles) && currentUser.roles.length > 0
    ? currentUser.roles
    : [currentUser?.role || 'learner']);

  if (Array.isArray(input.roles)) {
    nextRoles.clear();
    input.roles.forEach((role) => nextRoles.add(role));
  }

  if (input.role) {
    nextRoles.add(input.role);
  }

  if (input.flags) {
    const flagMap = {
      isAdmin: 'admin',
      isManager: 'manager',
      isCoordinator: 'coordinator',
      isLearningCoordinator: 'learningCoordinator',
      isCoach: 'coach',
      isInstructionalCoach: 'instructionalCoach',
      isCorporate: 'corporate',
      isHr: 'hr',
      isLearner: 'learner'
    };

    Object.entries(flagMap).forEach(([flag, role]) => {
      if (input.flags[flag] === true) {
        nextRoles.add(role);
      }
      if (input.flags[flag] === false) {
        nextRoles.delete(role);
      }
    });
  }

  if (nextRoles.size === 0) {
    nextRoles.add('learner');
  }

  return Array.from(nextRoles);
}

function decodeBasicAuthHeader(authHeader) {
  const encoded = authHeader.replace(/^Basic\s+/i, '');
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return null;
  return {
    email: decoded.slice(0, separatorIndex),
    token: decoded.slice(separatorIndex + 1)
  };
}

function getXapiAuth(req) {
  const authHeader = req.headers.authorization || req.query.authorization || req.query.auth;
  if (!authHeader || typeof authHeader !== 'string') return null;

  if (authHeader.startsWith('Basic ')) {
    const basic = decodeBasicAuthHeader(authHeader);
    if (!basic?.token || !basic?.email) return null;
    const user = auth.verifyToken(basic.token);
    if (!user || user.email?.toLowerCase() !== basic.email.toLowerCase()) return null;
    return { user, email: basic.email.toLowerCase() };
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const user = auth.verifyToken(token);
    if (!user || !user.email) return null;
    return { user, email: user.email.toLowerCase() };
  }

  return null;
}

function requireXapiAuth(req) {
  const authInfo = getXapiAuth(req);
  if (!authInfo?.user || !authInfo?.email) {
    throw new AuthenticationError('xAPI authentication required');
  }
  return authInfo;
}

function getAgentEmail(agent) {
  if (!agent) return null;
  const mbox = agent.mbox || '';
  if (!mbox) return null;
  return mbox.replace('mailto:', '').toLowerCase();
}

function assertActorMatches(user, actorEmail) {
  if (!actorEmail) return;
  if (isAdminUser(user)) return;
  if (user.email?.toLowerCase() !== actorEmail.toLowerCase()) {
    throw new AuthorizationError('Actor does not match authenticated user');
  }
}

function getScorePercentFromAttempt(attempt) {
  if (!attempt) return null;
  if (typeof attempt.scoreScaled === 'number') return attempt.scoreScaled * 100;
  if (typeof attempt.scoreRaw === 'number' && typeof attempt.scoreMax === 'number' && attempt.scoreMax > 0) {
    return (attempt.scoreRaw / attempt.scoreMax) * 100;
  }
  if (typeof attempt.scoreRaw === 'number') return attempt.scoreRaw;
  return null;
}

function roundScore(value) {
  if (value === null || value === undefined) return null;
  return Math.round(value * 10) / 10;
}

function summarizeKcAttempts(attempts) {
  const summaries = new Map();

  attempts.forEach(attempt => {
    const assessmentId = attempt.assessmentId || 'unknown';
    const key = assessmentId;
    const existing = summaries.get(key) || {
      assessmentId,
      assessmentName: attempt.assessmentName || null,
      attempts: 0,
      scoredAttempts: 0,
      scoreSum: 0,
      bestScore: null,
      lastScore: null,
      lastAttemptAt: null,
      successCount: 0,
      successTotal: 0
    };

    existing.attempts += 1;
    if (!existing.assessmentName && attempt.assessmentName) {
      existing.assessmentName = attempt.assessmentName;
    }

    const scorePercent = getScorePercentFromAttempt(attempt);
    if (scorePercent !== null) {
      existing.scoredAttempts += 1;
      existing.scoreSum += scorePercent;
      if (existing.bestScore === null || scorePercent > existing.bestScore) {
        existing.bestScore = scorePercent;
      }
    }

    if (typeof attempt.success === 'boolean') {
      existing.successTotal += 1;
      if (attempt.success) {
        existing.successCount += 1;
      }
    }

    const attemptTime = attempt.timestamp || attempt.storedAt || null;
    if (attemptTime) {
      const attemptMs = new Date(attemptTime).getTime();
      const lastMs = existing.lastAttemptAt ? new Date(existing.lastAttemptAt).getTime() : null;
      if (!lastMs || (attemptMs && attemptMs > lastMs)) {
        existing.lastAttemptAt = attemptTime;
        existing.lastScore = scorePercent;
      }
    }

    summaries.set(key, existing);
  });

  return Array.from(summaries.values()).map(summary => ({
    assessmentId: summary.assessmentId,
    assessmentName: summary.assessmentName,
    attempts: summary.attempts,
    scoredAttempts: summary.scoredAttempts,
    averageScorePercent: summary.scoredAttempts > 0 ? roundScore(summary.scoreSum / summary.scoredAttempts) : null,
    bestScorePercent: roundScore(summary.bestScore),
    lastScorePercent: roundScore(summary.lastScore),
    successRatePercent: summary.successTotal > 0 ? Math.round((summary.successCount / summary.successTotal) * 100) : null,
    lastAttemptAt: summary.lastAttemptAt
  }));
}

function summarizeKcAttemptsByUser(attempts) {
  const summaries = new Map();

  attempts.forEach(attempt => {
    const userEmail = attempt.userEmail || 'unknown';
    const existing = summaries.get(userEmail) || {
      userEmail,
      attempts: 0,
      scoredAttempts: 0,
      scoreSum: 0,
      bestScore: null,
      lastScore: null,
      lastAttemptAt: null,
      successCount: 0,
      successTotal: 0
    };

    existing.attempts += 1;

    const scorePercent = getScorePercentFromAttempt(attempt);
    if (scorePercent !== null) {
      existing.scoredAttempts += 1;
      existing.scoreSum += scorePercent;
      if (existing.bestScore === null || scorePercent > existing.bestScore) {
        existing.bestScore = scorePercent;
      }
    }

    if (typeof attempt.success === 'boolean') {
      existing.successTotal += 1;
      if (attempt.success) {
        existing.successCount += 1;
      }
    }

    const attemptTime = attempt.timestamp || attempt.storedAt || null;
    if (attemptTime) {
      const attemptMs = new Date(attemptTime).getTime();
      const lastMs = existing.lastAttemptAt ? new Date(existing.lastAttemptAt).getTime() : null;
      if (!lastMs || (attemptMs && attemptMs > lastMs)) {
        existing.lastAttemptAt = attemptTime;
        existing.lastScore = scorePercent;
      }
    }

    summaries.set(userEmail, existing);
  });

  return Array.from(summaries.values()).map(summary => ({
    userEmail: summary.userEmail,
    attempts: summary.attempts,
    scoredAttempts: summary.scoredAttempts,
    averageScorePercent: summary.scoredAttempts > 0 ? roundScore(summary.scoreSum / summary.scoredAttempts) : null,
    bestScorePercent: roundScore(summary.bestScore),
    lastScorePercent: roundScore(summary.lastScore),
    successRatePercent: summary.successTotal > 0 ? Math.round((summary.successCount / summary.successTotal) * 100) : null,
    lastAttemptAt: summary.lastAttemptAt
  }));
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

// ============================================================================
// Module Rules Cache
// ============================================================================

const moduleRulesCache = new Map();
const MODULE_RULES_CACHE_TTL_MS = 5 * 60 * 1000;

async function getCachedModuleRules(courseId) {
  const cached = moduleRulesCache.get(courseId);
  if (cached && (Date.now() - cached.fetchedAt) < MODULE_RULES_CACHE_TTL_MS) {
    return cached.rules;
  }
  const rules = await moduleRulesStorage.getModuleRules(courseId);
  moduleRulesCache.set(courseId, { rules, fetchedAt: Date.now() });
  return rules;
}

function setModuleRulesCache(courseId, rules) {
  moduleRulesCache.set(courseId, { rules, fetchedAt: Date.now() });
}

// ============================================================================
// Course Cache
// ============================================================================

const courseCache = {
  courses: null,
  fetchedAt: 0
};
const COURSE_CACHE_TTL_MS = parseInt(process.env.COURSE_CACHE_TTL_MS || '60000', 10);

async function getCachedCourses() {
  const now = Date.now();
  if (courseCache.courses && (now - courseCache.fetchedAt) < COURSE_CACHE_TTL_MS) {
    return courseCache.courses;
  }
  const courses = await coursesStorage.getAllCourses();
  courseCache.courses = courses;
  courseCache.fetchedAt = now;
  return courses;
}

function invalidateCourseCache() {
  courseCache.courses = null;
  courseCache.fetchedAt = 0;
}

// ============================================================================
// Users Cache
// ============================================================================

const usersCache = {
  users: null,
  fetchedAt: 0
};
const USERS_CACHE_TTL_MS = parseInt(process.env.USERS_CACHE_TTL_MS || '60000', 10);

async function getCachedUsers() {
  const now = Date.now();
  if (usersCache.users && (now - usersCache.fetchedAt) < USERS_CACHE_TTL_MS) {
    return usersCache.users;
  }
  const users = await auth.getAllUsers();
  usersCache.users = users;
  usersCache.fetchedAt = now;
  return users;
}

function invalidateUsersCache() {
  usersCache.users = null;
  usersCache.fetchedAt = 0;
}

// ============================================================================
// Report Helpers
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(baseIso, days) {
  const baseMs = baseIso ? new Date(baseIso).getTime() : Date.now();
  return new Date(baseMs + days * DAY_MS).toISOString();
}

function parseDateParam(value, label) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid ${label}`);
  }
  return date;
}

function resolveReportDateRange(dateType, startParam, endParam) {
  const now = new Date();
  const start = parseDateParam(startParam, 'startDate');
  const end = parseDateParam(endParam, 'endDate');

  if (start && end && start > end) {
    throw new ValidationError('startDate must be before endDate');
  }

  if (start || end) {
    return { start, end };
  }

  if (dateType === 'completion') {
    return { start: new Date(now.getTime() - 30 * DAY_MS), end: now };
  }

  return { start: null, end: new Date(now.getTime() + 30 * DAY_MS) };
}

async function fetchAllProgress() {
  let token = null;
  const all = [];

  do {
    const page = await progressStorage.getAllProgress({ limit: 1000, continuationToken: token });
    all.push(...(page.data || []));
    token = page.continuationToken || null;
  } while (token);

  return all;
}

// ============================================================================
// Progress Sync Throttling
// ============================================================================

const progressSyncState = new Map();
const PROGRESS_SYNC_MIN_INTERVAL_SECONDS = parseInt(process.env.PROGRESS_SYNC_MIN_INTERVAL_SECONDS || '60', 10);
const PROGRESS_SYNC_MAX_KEYS = parseInt(process.env.PROGRESS_SYNC_MAX_KEYS || '50000', 10);

function shouldSyncProgress(userEmail, courseId, registrationId, statement) {
  if (!userEmail || !courseId) return false;
  if (progressSyncState.size > PROGRESS_SYNC_MAX_KEYS) {
    progressSyncState.clear();
  }

  const key = `${userEmail}|${courseId}|${registrationId || 'none'}`;
  const now = Date.now();
  const lastSyncAt = progressSyncState.get(key)?.lastSyncAt || 0;
  const verbId = statement?.verb?.id || '';
  const isCompletion = verbTracker.isCompletionVerb(verbId);

  if (isCompletion || PROGRESS_SYNC_MIN_INTERVAL_SECONDS <= 0) {
    progressSyncState.set(key, { lastSyncAt: now });
    return true;
  }

  if (now - lastSyncAt >= PROGRESS_SYNC_MIN_INTERVAL_SECONDS * 1000) {
    progressSyncState.set(key, { lastSyncAt: now });
    return true;
  }

  return false;
}

// ============================================================================
// Statement Progress Sync (Extracted Common Logic)
// ============================================================================

function extractBaseActivityId(activityId) {
  if (!activityId) return null;
  const slashIndex = activityId.indexOf('/');
  return slashIndex > 0 ? activityId.substring(0, slashIndex) : activityId;
}

async function findCourseByActivityId(activityId) {
  const allCourses = await getCachedCourses();
  const baseActivityId = extractBaseActivityId(activityId);
  
  let course = allCourses.find(c => c.activityId === activityId);
  if (course) return course;
  
  if (baseActivityId && baseActivityId !== activityId) {
    course = allCourses.find(c => c.activityId === baseActivityId);
    if (course) return course;
  }
  
  course = allCourses.find(c => activityId.startsWith(c.activityId + '/') || activityId === c.activityId);
  return course || null;
}

function getStatementScorePercent(statement) {
  const score = statement?.result?.score;
  if (!score) return null;
  if (typeof score.scaled === 'number') return Math.round(score.scaled * 100);
  if (typeof score.raw === 'number' && typeof score.max === 'number' && score.max > 0) {
    return Math.round((score.raw / score.max) * 100);
  }
  if (typeof score.raw === 'number') return score.raw;
  return null;
}

function statementMatchesRule(statement, rule) {
  const objectId = statement?.object?.id || '';
  const matchValue = rule?.matchValue || '';
  if (!objectId || !matchValue) return false;
  if ((rule.matchType || 'prefix') === 'contains') {
    return objectId.includes(matchValue);
  }
  return objectId.startsWith(matchValue);
}

async function updateAttemptModuleProgress(userEmail, registrationId, course, statement) {
  if (!registrationId || !userEmail || !course) return;
  const rules = await getCachedModuleRules(course.courseId);
  if (!rules || rules.length === 0) return;

  const verbId = statement?.verb?.id || '';
  if (!verbId) return;

  const scorePercent = getStatementScorePercent(statement);
  const completedAt = statement?.timestamp || statement?.stored || new Date().toISOString();

  const attempt = await attemptsStorage.getAttempt(userEmail, registrationId);
  const moduleProgress = attempt?.moduleProgress || {};

  let updated = false;
  rules.forEach(rule => {
    if (!rule || !rule.moduleId) return;
    if (!statementMatchesRule(statement, rule)) return;
    const completionVerbs = Array.isArray(rule.completionVerbs) ? rule.completionVerbs : [];
    if (completionVerbs.length > 0 && !completionVerbs.includes(verbId)) return;
    if (typeof rule.scoreThreshold === 'number' && scorePercent !== null) {
      if (scorePercent < rule.scoreThreshold) return;
    } else if (typeof rule.scoreThreshold === 'number' && scorePercent === null) {
      return;
    }

    moduleProgress[rule.moduleId] = {
      status: 'completed',
      completedAt,
      verbId,
      scorePercent
    };
    updated = true;
  });

  if (updated) {
    await attemptsStorage.upsertAttemptProgress(userEmail, registrationId, {
      courseId: course.courseId,
      activityId: course.activityId,
      moduleProgress
    });
  }
}

/**
 * Process statement and sync progress (extracted common logic)
 * Used by both POST and PUT /xapi/statements
 */
async function processStatementProgressSync(statement) {
  if (!statement?.actor || !statement?.object) return;
  
  const userEmail = statement.actor.mbox ? statement.actor.mbox.replace('mailto:', '') : null;
  const activityId = statement.object.id;
  
  if (!userEmail || !activityId) return;
  
  const course = await findCourseByActivityId(activityId);
  if (!course) return;
  
  const baseActivityId = course.activityId;
  const registrationId = statement?.context?.registration || null;
  
  // Update module progress
  await updateAttemptModuleProgress(userEmail, registrationId, course, statement).catch(err => {
    serverLogger.error({ error: err.message }, 'Error updating module progress');
  });

  if (isKnowledgeCheckStatement(statement)) {
    kcAttemptsStorage.recordAttempt(statement, {
      userEmail,
      registrationId,
      courseId: course.courseId,
      activityId: baseActivityId
    }).catch(err => {
      serverLogger.error({ error: err.message }, 'Error recording knowledge check attempt');
    });
  }
  
  if (shouldSyncProgress(userEmail, course.courseId, registrationId, statement)) {
    // Sync progress in background
    progressStorage.syncProgressFromStatements(userEmail, course.courseId, baseActivityId, registrationId)
      .then(async (syncResult) => {
        if (syncResult?.updatedProgress) {
          const { calculated } = syncResult;
          if (registrationId && calculated) {
            const eligibleForRaise = (calculated.completionStatus === 'passed' || calculated.completionStatus === 'completed') &&
              calculated.success !== false;
            try {
              await attemptsStorage.upsertAttemptProgress(userEmail, registrationId, {
                courseId: course.courseId,
                activityId: baseActivityId,
                completionStatus: calculated.completionStatus,
                completionVerb: calculated.completionVerb,
                completionStatementId: calculated.completionStatementId,
                success: calculated.success,
                score: calculated.score,
                progressPercent: calculated.progressPercent,
                timeSpent: calculated.timeSpent,
                completedAt: calculated.completedAt,
                eligibleForRaise
              });
            } catch (attemptError) {
              serverLogger.error({ error: attemptError.message }, 'Error updating attempt');
            }
          }
        }
      })
      .catch(err => {
        serverLogger.error({ error: err.message }, 'Auto-sync error');
      });
  }
}

function processStatementsSideEffects(statements) {
  const list = Array.isArray(statements) ? statements : [statements];
  list.forEach(statement => {
    processStatementProgressSync(statement).catch(err => {
      serverLogger.error({ error: err.message }, 'Statement side-effects error');
    });
  });
}

// ============================================================================
// Middleware Setup
// ============================================================================

// HTTPS enforcement in production
if (IS_PRODUCTION) {
  app.use((req, res, next) => {
    // Trust proxy headers (Azure, nginx, etc.)
    if (req.headers['x-forwarded-proto'] !== 'https' && req.hostname !== 'localhost') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

// Cookie parser (must be before CORS for credentials)
app.use(cookieParser(COOKIE_SECRET));

// CORS configuration
app.use(cors({
  origin: IS_PRODUCTION 
    ? (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (CORS_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          serverLogger.warn({ origin }, 'Blocked by CORS');
          callback(new Error('Not allowed by CORS'));
        }
      }
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Experience-API-Version', 'X-Request-ID', 'X-CSRF-Token', 'x-retry-count']
}));

// Handle raw body for xAPI state PUT BEFORE express.json()
app.put('/xapi/activities/state', express.raw({ type: ['application/octet-stream', 'application/json', '*/*'], limit: '10mb' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.body = req.body.toString('utf8');
  } else if (typeof req.body === 'object' && req.body !== null) {
    try {
      req.body = JSON.stringify(req.body);
    } catch (e) {
      req.body = String(req.body);
    }
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply CSRF validation to all API state-changing routes (POST, PUT, DELETE)
// Excludes: auth routes (login/register need to work without CSRF), xAPI routes (Basic auth)
app.use('/api', (req, res, next) => {
  // Skip CSRF for auth routes (login, register need to work without prior CSRF token)
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register') || req.path.startsWith('/auth/csrf')) {
    return next();
  }
  validateCsrf(req, res, next);
});

app.options('*', (req, res) => {
  const origin = req.headers.origin;
  
  // Enforce CORS allowlist consistently with cors() middleware
  if (IS_PRODUCTION) {
    if (!origin || !CORS_ORIGINS.includes(origin)) {
      serverLogger.warn({ origin }, 'Preflight blocked by CORS');
      return res.sendStatus(403);
    }
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Development: allow all origins, but MUST use origin (not *) when credentials: true
    // Browsers reject Access-Control-Allow-Origin: * with credentials: true
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      // No origin header - likely same-origin or non-browser client
      // Can't use * with credentials, so reflect localhost
      res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    }
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Experience-API-Version, X-Request-ID, X-CSRF-Token, x-retry-count');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), requestId: req.id });
});

// Legacy launch page (for direct xAPI course launching)
// Access via /launch instead of root
app.get('/launch', (req, res) => {
  res.sendFile(path.join(__dirname, 'launch.html'));
});

// ============================================================================
// Authentication Routes (with rate limiting)
// ============================================================================

app.post('/api/auth/register', authLimiter, validateBody(registerSchema), asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, name } = req.body;
  const fullName = (firstName && lastName) 
    ? `${firstName.trim()} ${lastName.trim()}`.trim()
    : (name || email.split('@')[0]);
  const result = await auth.register(email, password, fullName, firstName, lastName);
  
  // Set httpOnly cookie with auth token
  res.cookie(AUTH_COOKIE_NAME, result.token, cookieOptions);
  
  // Set CSRF token (readable by JavaScript for inclusion in headers)
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, { 
    ...cookieOptions, 
    httpOnly: false // CSRF token must be readable by JS
  });
  
  // Return user data and CSRF token (auth token is in httpOnly cookie only)
  res.json({ 
    user: result.user, 
    csrfToken
    // NOTE: Token intentionally NOT included - use httpOnly cookie for security
  });
}));

app.post('/api/auth/login', authLimiter, validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await auth.login(email, password);
  
  // Set httpOnly cookie with auth token
  res.cookie(AUTH_COOKIE_NAME, result.token, cookieOptions);
  
  // Set CSRF token (readable by JavaScript for inclusion in headers)
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, { 
    ...cookieOptions, 
    httpOnly: false // CSRF token must be readable by JS
  });
  
  // Return user data and CSRF token (auth token is in httpOnly cookie only)
  res.json({ 
    user: result.user, 
    csrfToken
    // NOTE: Token intentionally NOT included - use httpOnly cookie for security
  });
}));

app.post('/api/auth/logout', asyncHandler(async (req, res) => {
  // Clear auth cookies
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
  
  serverLogger.info('User logged out');
  res.json({ success: true, message: 'Logged out successfully' });
}));

app.get('/api/auth/me', asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const freshUser = await usersStorage.getUserById(user.userId || user.id)
    || await usersStorage.getUserByEmail(user.email);
  const responseUser = freshUser ? auth.buildAuthUser(freshUser) : auth.buildAuthUser(user);
  res.json({ 
    user: responseUser
  });
}));

// CSRF token refresh endpoint
app.get('/api/auth/csrf', asyncHandler(async (req, res) => {
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, { 
    ...cookieOptions, 
    httpOnly: false 
  });
  res.json({ csrfToken });
}));

// ============================================================================
// Courses API Routes
// ============================================================================

app.get('/api/courses', apiLimiter, asyncHandler(async (req, res) => {
    const user = verifyAuth(req);
    const courses = await getCachedCourses();
    
    let userProgress = [];
  if (user?.email) {
      try {
        userProgress = await progressStorage.getUserProgress(user.email);
    } catch (err) {
      serverLogger.error({ error: err.message }, 'Error getting user progress');
      }
    }
    
    const coursesWithEnrollment = courses.map(course => {
      const progress = userProgress.find(p => p.courseId === course.courseId);
      const isEnrolled = progress && (progress.enrollmentStatus === 'enrolled' || progress.enrollmentStatus === 'in_progress');
      
      let progressPercent = 0;
      if (progress) {
        if (progress.progressPercent !== undefined && progress.progressPercent !== null) {
          progressPercent = Number(progress.progressPercent) || 0;
        } else if (progress.completionStatus === 'completed' || progress.completionStatus === 'passed') {
          progressPercent = 100;
        } else if (progress.completionStatus === 'in_progress') {
          progressPercent = Number(progress.score) || 0;
        }
      }
      
      return {
        courseId: course.courseId,
        title: course.title,
        description: course.description || '',
        thumbnailUrl: course.thumbnailUrl || '',
        isEnrolled: isEnrolled || false,
      enrollmentStatus: progress?.enrollmentStatus,
      completionStatus: progress?.completionStatus,
      progressPercent,
        score: progress?.score !== undefined && progress?.score !== null ? Number(progress.score) : undefined,
      completedAt: progress?.completedAt,
        activityId: course.activityId
      };
    });

    res.json(coursesWithEnrollment);
}));

app.get('/api/courses/:courseId', apiLimiter, asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const course = await coursesStorage.getCourseById(courseId);
    
    if (!course) {
    throw new NotFoundError('Course');
    }

    const user = verifyAuth(req);
    
    res.json({
      ...course,
      isEnrolled: user ? true : false,
      enrollmentStatus: user ? 'enrolled' : undefined
    });
}));

app.post('/api/courses/:courseId/launch', apiLimiter, asyncHandler(async (req, res) => {
    const { courseId } = req.params;
  const user = requireAuth(req);

    const course = await coursesStorage.getCourseById(courseId);
    if (!course) {
    throw new NotFoundError('Course');
    }

    const userEmail = user.email;
  let currentProgress = null;
  
    if (userEmail) {
      try {
        const existingProgressList = await progressStorage.getUserProgress(userEmail);
        currentProgress = existingProgressList.find(p => p.courseId === courseId);
        const currentAttempts = currentProgress?.attempts || 0;
        
        progressStorage.updateProgress(userEmail, courseId, {
          enrollmentStatus: 'enrolled',
          completionStatus: 'in_progress',
        attempts: currentAttempts + 1
      }).catch(err => {
        serverLogger.error({ error: err.message }, 'Error updating progress on launch');
      });
    } catch (err) {
      serverLogger.error({ error: err.message }, 'Error getting progress on launch');
    }
  }

  // Reuse open attempt or create new registration
    let registrationId;
    let reusedAttempt = false;
    try {
      const openAttempt = await attemptsStorage.getLatestOpenAttempt(user.email, course.courseId);
      registrationId = openAttempt?.registrationId || null;
      reusedAttempt = !!openAttempt;
  } catch (err) {
    serverLogger.error({ error: err.message }, 'Error checking open attempts');
    }
  
    if (!registrationId) {
      registrationId = `reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    const actor = {
      objectType: 'Agent',
      name: user.name || user.email,
      mbox: `mailto:${user.email}`
    };

    const requestBaseUrl = getBaseUrl(req);
    const endpoint = `${requestBaseUrl}/xapi`;
  // Get JWT token: prioritize cookie (httpOnly), then fallback to header/query for API clients
  const token = req.cookies?.[AUTH_COOKIE_NAME] 
    || req.headers.authorization?.replace('Bearer ', '') 
    || req.query.token 
    || req.body.token;
    const authString = Buffer.from(`${user.email}:${token}`).toString('base64');

    const params = new URLSearchParams({
    endpoint,
      auth: `Basic ${authString}`,
      actor: JSON.stringify(actor),
      registration: registrationId,
      activityId: course.activityId
    });

  const filePath = course.coursePath?.trim() 
    ? `${course.coursePath}/${course.launchFile}`.replace(/\/+/g, '/')
      : course.launchFile;
    const launchUrl = `${requestBaseUrl}/course/${filePath}?${params.toString()}`;
    
    if (!reusedAttempt) {
      try {
        await attemptsStorage.createAttempt({
          registrationId,
          userEmail: user.email,
          userName: user.name || user.email,
          courseId: course.courseId,
          activityId: course.activityId,
          launchedAt: new Date().toISOString(),
          completionStatus: 'in_progress'
        });
    } catch (err) {
      serverLogger.error({ error: err.message }, 'Error creating attempt');
      }
    }

    let progressPercent = 0;
    let completionStatus = 'not_started';
    if (currentProgress) {
      completionStatus = currentProgress.completionStatus || 'not_started';
      if (currentProgress.progressPercent !== undefined && currentProgress.progressPercent !== null) {
        progressPercent = Math.max(0, Math.min(100, Number(currentProgress.progressPercent)));
      } else if (completionStatus === 'completed' || completionStatus === 'passed') {
        progressPercent = 100;
      } else if (completionStatus === 'in_progress') {
        progressPercent = currentProgress.score ? Math.max(0, Math.min(100, Number(currentProgress.score))) : 0;
      }
    }

    res.json({
      course: {
        courseId: course.courseId,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        activityId: course.activityId,
        isEnrolled: true,
        enrollmentStatus: 'enrolled',
      completionStatus,
      progressPercent
    },
    launchUrl,
    registrationId
  });
}));

// ============================================================================
// Course File Serving from Azure Blob Storage
// ============================================================================

app.get('/course/*', asyncHandler(async (req, res) => {
  const fullPath = req.path;
    let filePath = fullPath.replace(/^\/course\//, '') || 'index_lms.html';
    
    if (filePath.endsWith('.map')) {
      return res.status(404).send();
    }
    
    try {
      if (filePath.includes('%')) {
        filePath = decodeURIComponent(filePath);
      }
    } catch (e) {
    // Use as-is
  }
  
  // Deduplicate path segments
  const pathParts = filePath.split('/').filter(p => p !== '');
    const deduplicatedParts = [];
    for (let i = 0; i < pathParts.length; i++) {
    if (i > 0 && pathParts[i - 1] === pathParts[i]) continue;
    deduplicatedParts.push(pathParts[i]);
    }
    filePath = deduplicatedParts.join('/');
    
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.htm': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.xml': 'application/xml; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.pdf': 'application/pdf',
      '.vtt': 'text/vtt',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    let stream;
    try {
      stream = await blobStorage.getBlobStream(filePath);
    } catch (error) {
      if (error.message.includes('not found') && filePath.includes('/')) {
        const fileName = path.basename(filePath);
        if (fileName.endsWith('.map')) {
          return res.status(404).send();
        }
        
        try {
          stream = await blobStorage.getBlobStream(fileName);
      } catch (fallbackError) {
        throw error;
        }
      } else {
      throw error;
      }
    }
    
  res.setHeader('Content-Type', contentType);
  const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext);
  res.setHeader('Cache-Control', isImage ? 'public, max-age=300, must-revalidate' : 'public, max-age=3600');
  
  // Content Security Policy for HTML files (course content)
  if (ext === '.html' || ext === '.htm') {
    // Allow scripts from same origin and inline (required for Storyline)
    // Allow styles from same origin and inline
    // Allow images from same origin, data URIs, and blob URIs
    // Allow fonts from same origin
    // Allow frames from same origin
    const cspFrameSrc = process.env.CSP_FRAME_SRC
      ? process.env.CSP_FRAME_SRC.split(',').map(source => source.trim()).filter(Boolean)
      : [];
    const cspScriptSrc = process.env.CSP_SCRIPT_SRC
      ? process.env.CSP_SCRIPT_SRC.split(',').map(source => source.trim()).filter(Boolean)
      : [];
    const cspConnectSrc = process.env.CSP_CONNECT_SRC
      ? process.env.CSP_CONNECT_SRC.split(',').map(source => source.trim()).filter(Boolean)
      : [];
    const cspImgSrc = process.env.CSP_IMG_SRC
      ? process.env.CSP_IMG_SRC.split(',').map(source => source.trim()).filter(Boolean)
      : [];
    const connectSources = cspConnectSrc.length ? cspConnectSrc : ['*'];

    // Frame ancestors for embedding - allow localhost dev servers and same origin
    const frameAncestors = process.env.NODE_ENV === 'production' 
      ? "'self'" 
      : "'self' http://localhost:* http://127.0.0.1:*";
    
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${cspScriptSrc.join(' ')}`.trim(), // Storyline requires inline scripts
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${cspImgSrc.join(' ')}`.trim(),
      "font-src 'self' data:",
      `connect-src 'self' ${connectSources.join(' ')}`.trim(), // Allow xAPI connections
      `frame-src 'self' ${cspFrameSrc.join(' ')}`.trim(),
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors " + frameAncestors // Modern replacement for X-Frame-Options
    ].join('; '));
    
    // X-Frame-Options only in production (frame-ancestors takes precedence in modern browsers)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
  
  stream.pipe(res);
    
    stream.on('error', (error) => {
    serverLogger.error({ filePath, error: error.message }, 'Stream error');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    });
}));

// ============================================================================
// xAPI LRS Endpoints (with rate limiting)
// ============================================================================

app.post('/xapi/statements', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
    const statement = Array.isArray(req.body) ? req.body[0] : req.body;
  
    if (Array.isArray(req.body)) {
      for (const stmt of req.body) {
        const actorEmail = getAgentEmail(stmt?.actor);
        assertActorMatches(user, actorEmail);
      }
    } else {
      const actorEmail = getAgentEmail(statement?.actor);
      assertActorMatches(user, actorEmail);
    }

    const result = await xapiLRS.saveStatement(req.body);
    
  // Process side-effects asynchronously (progress sync + KC attempts)
  processStatementsSideEffects(req.body);
  
    res.status(result.status).json(result.data);
}));

app.get('/xapi/statements', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
  
    if (req.query.statementId) {
      const result = await xapiLRS.getStatement(req.query.statementId);
      if (result.status === 404) {
        return res.status(404).send();
      }
      if (!isAdminUser(user)) {
        const actorEmail = getAgentEmail(result.data?.actor);
        assertActorMatches(user, actorEmail);
      }
      return res.status(result.status).json(result.data);
    }
    
    if (!isAdminUser(user) && req.query.agent) {
      try {
        const agentObj = typeof req.query.agent === 'string' ? JSON.parse(decodeURIComponent(req.query.agent)) : req.query.agent;
        const agentEmail = getAgentEmail(agentObj);
        assertActorMatches(user, agentEmail);
      } catch (parseError) {
      throw new ValidationError('Invalid agent parameter format');
      }
    }
  
    if (!isAdminUser(user) && !req.query.agent) {
      req.query.agent = JSON.stringify({
        objectType: 'Agent',
        mbox: `mailto:${user.email}`
      });
    }
  
    const result = await xapiLRS.queryStatements(req.query);
    res.status(result.status).json(result.data);
}));

app.put('/xapi/statements', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
    const statementId = req.query.statementId;
    
    if (!statementId) {
    throw new ValidationError('statementId required');
    }
    
    const statement = req.body;
    statement.id = statementId;
    
    const actorEmail = getAgentEmail(statement?.actor);
    assertActorMatches(user, actorEmail);

    const result = await xapiLRS.saveStatement(statement);
    
  // Process side-effects asynchronously (progress sync + KC attempts)
  processStatementsSideEffects(statement);
    
    res.status(result.status).json(result.data);
}));

app.get('/xapi/statements/:id', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
    const result = await xapiLRS.getStatement(req.params.id);
  
    if (result.status === 404) {
      return res.status(404).send();
    }
  
    if (!isAdminUser(user)) {
      const actorEmail = getAgentEmail(result.data?.actor);
      assertActorMatches(user, actorEmail);
    }
  
    res.status(result.status).json(result.data);
}));

// xAPI State endpoints
app.get('/xapi/activities/state', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
    const { activityId, agent, stateId, registration } = req.query;
    
    if (!agent) {
    throw new ValidationError('Missing required parameter: agent');
    }
    if (!activityId || !stateId) {
    throw new ValidationError('Missing required parameters: activityId, stateId');
    }
    
    let agentObj;
    try {
      const decoded = decodeURIComponent(agent);
      agentObj = JSON.parse(decoded);
    } catch (e1) {
      try {
        agentObj = JSON.parse(agent);
      } catch (e2) {
      throw new ValidationError('Invalid agent parameter format');
      }
    }

    const agentEmail = getAgentEmail(agentObj);
    assertActorMatches(user, agentEmail);
    
    const result = await xapiLRS.getState(activityId, agentObj, stateId, registration || null);
  
    if (result.status === 404) {
      return res.status(404).send();
    }
    
    if (typeof result.data === 'string') {
      res.status(result.status).type('text/plain').send(result.data);
    } else {
      res.status(result.status).json(result.data);
    }
}));

app.put('/xapi/activities/state', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
    const { activityId, agent, stateId, registration } = req.query;
  
    if (!activityId || !agent || !stateId) {
    throw new ValidationError('Missing required parameters: activityId, agent, stateId');
    }
    
    const agentObj = typeof agent === 'string' ? JSON.parse(decodeURIComponent(agent)) : agent;
    const agentEmail = getAgentEmail(agentObj);
    assertActorMatches(user, agentEmail);
  
    const result = await xapiLRS.saveState(activityId, agentObj, stateId, req.body, registration || null);
    res.status(result.status).send();
}));

app.delete('/xapi/activities/state', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
    const { activityId, agent, stateId, registration } = req.query;
  
    if (!activityId || !agent || !stateId) {
    throw new ValidationError('Missing required parameters: activityId, agent, stateId');
    }
  
    const agentObj = typeof agent === 'string' ? JSON.parse(agent) : agent;
    const agentEmail = getAgentEmail(agentObj);
    assertActorMatches(user, agentEmail);
  
    const result = await xapiLRS.deleteState(activityId, agentObj, stateId, registration || null);
    res.status(result.status).send();
}));

// xAPI Profile endpoints
app.get('/xapi/activities/profile', xapiLimiter, asyncHandler(async (req, res) => {
    requireXapiAuth(req);
    const { activityId, profileId } = req.query;
  
    if (!activityId || !profileId) {
    throw new ValidationError('Missing required parameters: activityId, profileId');
    }
  
    const result = await xapiLRS.getActivityProfile(activityId, profileId);
    if (result.status === 404) {
      return res.status(404).send();
    }
    res.status(result.status).json(result.data);
}));

app.put('/xapi/activities/profile', xapiLimiter, asyncHandler(async (req, res) => {
    requireXapiAuth(req);
    const { activityId, profileId } = req.query;
  
    if (!activityId || !profileId) {
    throw new ValidationError('Missing required parameters: activityId, profileId');
    }
  
    const result = await xapiLRS.saveActivityProfile(activityId, profileId, req.body);
    res.status(result.status).send();
}));

app.delete('/xapi/activities/profile', xapiLimiter, asyncHandler(async (req, res) => {
    requireXapiAuth(req);
    const { activityId, profileId } = req.query;
  
    if (!activityId || !profileId) {
    throw new ValidationError('Missing required parameters: activityId, profileId');
    }
  
    const result = await xapiLRS.deleteActivityProfile(activityId, profileId);
    res.status(result.status).send();
}));

app.get('/xapi/agents/profile', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
    const { agent, profileId } = req.query;
  
    if (!agent || !profileId) {
    throw new ValidationError('Missing required parameters: agent, profileId');
    }
  
    const agentObj = typeof agent === 'string' ? JSON.parse(agent) : agent;
    const agentEmail = getAgentEmail(agentObj);
    assertActorMatches(user, agentEmail);
  
    const result = await xapiLRS.getAgentProfile(agentObj, profileId);
    if (result.status === 404) {
      return res.status(404).send();
    }
    res.status(result.status).json(result.data);
}));

app.put('/xapi/agents/profile', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
    const { agent, profileId } = req.query;
  
    if (!agent || !profileId) {
    throw new ValidationError('Missing required parameters: agent, profileId');
    }
  
    const agentObj = typeof agent === 'string' ? JSON.parse(agent) : agent;
    const agentEmail = getAgentEmail(agentObj);
    assertActorMatches(user, agentEmail);
  
    const result = await xapiLRS.saveAgentProfile(agentObj, profileId, req.body);
    res.status(result.status).send();
}));

app.delete('/xapi/agents/profile', xapiLimiter, asyncHandler(async (req, res) => {
    const { user } = requireXapiAuth(req);
    const { agent, profileId } = req.query;
  
    if (!agent || !profileId) {
    throw new ValidationError('Missing required parameters: agent, profileId');
    }
  
    const agentObj = typeof agent === 'string' ? JSON.parse(agent) : agent;
    const agentEmail = getAgentEmail(agentObj);
    assertActorMatches(user, agentEmail);
  
    const result = await xapiLRS.deleteAgentProfile(agentObj, profileId);
    res.status(result.status).send();
}));

// ============================================================================
// User Progress API Routes
// ============================================================================

app.get('/api/users/:userId/courses', apiLimiter, asyncHandler(async (req, res) => {
    const { userId } = req.params;
  const user = requireAuth(req);
    
    const normalizedUserId = userId.includes('@') ? userId : user.email || userId;
    const currentUserEmail = user.email;
  
  if (currentUserEmail !== normalizedUserId && !isAdminUser(user)) {
    throw new AuthorizationError('Access denied');
  }
    
    const progressUserId = normalizedUserId.includes('@') ? normalizedUserId : currentUserEmail || normalizedUserId;
    const progressList = await progressStorage.getUserProgress(progressUserId);
    
  // Pre-fetch all courses to avoid N+1
  const allCourses = await getCachedCourses();
  const courseMap = new Map(allCourses.map(c => [c.courseId, c]));
  
    const coursesWithProgress = await Promise.all(
      progressList.map(async (progress) => {
      const course = courseMap.get(progress.courseId);
          if (!course) return null;
          
          if (course.activityId) {
            try {
              const syncResult = await progressStorage.syncProgressFromStatements(
                progressUserId, 
                progress.courseId, 
                course.activityId
              );
              if (syncResult?.updatedProgress) {
                progress = syncResult.updatedProgress;
              }
        } catch (err) {
          serverLogger.error({ courseId: progress.courseId, error: err.message }, 'Sync error');
            }
          }
          
          let progressPercent = progress.progressPercent;
          if (progressPercent === undefined || progressPercent === null) {
            if (progress.completionStatus === 'completed' || progress.completionStatus === 'passed') {
              progressPercent = 100;
            } else if (progress.completionStatus === 'in_progress') {
              progressPercent = progress.score || 0;
            } else {
              progressPercent = 0;
            }
          }
          
          return {
            courseId: course.courseId,
            title: course.title,
            description: course.description,
            thumbnailUrl: course.thumbnailUrl,
            enrollmentStatus: progress.enrollmentStatus,
            completionStatus: progress.completionStatus,
            score: progress.score,
        progressPercent,
        timeSpent: progress.timeSpent || 0,
            attempts: progress.attempts || 0,
            enrolledAt: progress.enrolledAt,
            startedAt: progress.startedAt,
            completedAt: progress.completedAt,
            lastAccessedAt: progress.lastAccessedAt
          };
    })
  );
  
  res.json(coursesWithProgress.filter(c => c !== null));
}));

app.post('/api/users/:userId/courses/:courseId/enroll', apiLimiter, asyncHandler(async (req, res) => {
    const { userId, courseId } = req.params;
  const user = requireAuth(req);
    
    const normalizedUserId = userId.includes('@') ? userId : user.email || userId;
    const currentUserEmail = user.email;
  
  if (currentUserEmail !== normalizedUserId && !isAdminUser(user)) {
    throw new AuthorizationError('Access denied');
  }
    
    const course = await coursesStorage.getCourseById(courseId);
    if (!course) {
    throw new NotFoundError('Course');
    }
    
    const progressUserId = normalizedUserId.includes('@') ? normalizedUserId : currentUserEmail || normalizedUserId;
    const progress = await progressStorage.updateProgress(progressUserId, courseId, {
      enrollmentStatus: 'enrolled',
      completionStatus: 'not_started'
    });
    
    res.json({
      courseId: course.courseId,
      title: course.title,
      enrollmentStatus: progress.enrollmentStatus,
      completionStatus: progress.completionStatus,
      enrolledAt: progress.enrolledAt
    });
}));

// ============================================================================
// Admin API Routes
// ============================================================================

app.get('/api/admin/courses', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    const courses = await getCachedCourses();
    
  // Pre-fetch all progress to avoid N+1 (with pagination)
  const allProgress = await fetchAllProgress();
  
    const coursesWithStats = courses.map(course => {
      const courseProgress = allProgress.filter(p => p.courseId === course.courseId);
      const enrollmentCount = courseProgress.filter(p => p.enrollmentStatus === 'enrolled' || p.enrollmentStatus === 'in_progress').length;
      const attemptCount = courseProgress.reduce((sum, p) => sum + (p.attempts || 0), 0);
      
    return { ...course, enrollmentCount, attemptCount };
    });
    
    res.json(coursesWithStats);
}));

app.get('/api/admin/extract-activity-id', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    const { coursePath } = req.query;
    
    if (!coursePath) {
    throw new ValidationError('coursePath query parameter is required');
    }
    
    const tincanPath = `${coursePath}/tincan.xml`.replace(/\/+/g, '/');
    
    try {
      const xmlContent = await blobStorage.getBlobBuffer(tincanPath);
      const xmlString = xmlContent.toString('utf-8');
      const activityId = await extractActivityIdFromXml(xmlString);
      
    res.json({ activityId, coursePath, tincanPath });
    } catch (error) {
      if (error.message.includes('not found')) {
      throw new NotFoundError(`tincan.xml at ${tincanPath}`);
      }
      throw error;
    }
}));

app.get('/api/admin/find-thumbnail', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    const { coursePath } = req.query;
    
    if (!coursePath) {
    throw new ValidationError('coursePath query parameter is required');
  }
  
  try {
      const allBlobs = await blobStorage.listBlobs(coursePath);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
      const foundThumbnails = [];
      
      for (const blob of allBlobs) {
        const blobName = blob.name.toLowerCase();
      const fileName = blob.name.split('/').pop().toLowerCase();
        const isImage = imageExtensions.some(ext => blobName.endsWith(ext));
        
        if (isImage) {
          const isThumbnail = fileName.includes('poster') || 
                             fileName.includes('thumbnail') || 
                             fileName.includes('thumb') ||
                             (blobName.includes('mobile') && fileName.includes('poster'));
          
          if (isThumbnail) {
            foundThumbnails.push({
            path: `/course/${blob.name}`,
            name: blob.name.split('/').pop(),
              size: blob.size
            });
          }
        }
      }
      
      foundThumbnails.sort((a, b) => {
      const getPriority = (item) => {
        const name = item.name.toLowerCase();
        const path = item.path.toLowerCase();
        if (name.startsWith('thumbnail.')) return 0;
        if (path.includes('mobile/poster')) return 1;
        if (name.includes('poster')) return 2;
        return 3;
      };
      return getPriority(a) - getPriority(b);
      });
      
      if (foundThumbnails.length > 0) {
        res.json({ 
          thumbnailUrl: foundThumbnails[0].path,
          found: true,
          allMatches: foundThumbnails,
          coursePath 
        });
      } else {
        res.json({ 
          thumbnailUrl: null,
          found: false,
        message: 'No thumbnail images found',
          coursePath 
        });
      }
    } catch (error) {
      if (error.message.includes('not found')) {
      throw new NotFoundError(`Course folder: ${coursePath}`);
      }
      throw error;
    }
}));

app.post('/api/admin/courses', apiLimiter, validateBody(createCourseSchema), asyncHandler(async (req, res) => {
    requireAdmin(req);
    const { title, description, thumbnailUrl, activityId, launchFile, coursePath } = req.body;
    
    const courseId = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    const existing = await coursesStorage.getCourseById(courseId);
    if (existing) {
    throw new ValidationError('Course with this title already exists');
    }

    const newCourse = {
      courseId,
      title,
      description: description || '',
      thumbnailUrl: thumbnailUrl || '/course/mobile/poster.jpg',
      activityId,
      launchFile,
      coursePath: coursePath || '',
      modules: []
    };

    await coursesStorage.saveCourse(newCourse);
    invalidateCourseCache();
    
  serverLogger.info({ courseId, title }, 'Course created');
    res.status(201).json(newCourse);
}));

app.put('/api/admin/courses/:courseId', apiLimiter, validateBody(updateCourseSchema), asyncHandler(async (req, res) => {
    requireAdmin(req);
    const { courseId } = req.params;
    const existing = await coursesStorage.getCourseById(courseId);
    
    if (!existing) {
    throw new NotFoundError('Course');
    }

    const updates = req.body;
    const updatedCourse = {
      ...existing,
      ...updates,
    courseId: existing.courseId,
      updatedAt: new Date().toISOString()
    };

    await coursesStorage.saveCourse(updatedCourse);
    invalidateCourseCache();
    
  serverLogger.info({ courseId }, 'Course updated');
    res.json(updatedCourse);
}));

app.delete('/api/admin/courses/:courseId', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    const { courseId } = req.params;
    const existing = await coursesStorage.getCourseById(courseId);
    
    if (!existing) {
    throw new NotFoundError('Course');
    }

    await coursesStorage.deleteCourse(courseId);
    invalidateCourseCache();
  serverLogger.info({ courseId }, 'Course deleted');
    res.status(204).send();
}));

app.get('/api/admin/progress', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);

  const { courseId, limit, continuationToken, paginated } = req.query;
  const shouldPaginate = paginated === 'true' || paginated === '1' || limit || continuationToken || courseId;
  const pageLimit = Math.min(parseInt(limit || '0', 10) || 200, 1000);
  const normalizedCourseId = courseId ? String(courseId) : '';
  const hasCourseFilter = normalizedCourseId && normalizedCourseId !== 'all';

  const [allCourses, allUsers] = await Promise.all([
    getCachedCourses(),
    getCachedUsers()
  ]);

  const courseMap = new Map(allCourses.map(c => [c.courseId, c]));
  const userMap = new Map(allUsers.map(u => [u.email?.toLowerCase(), u]));

  const buildEnrichedProgress = (progressList) => {
    const enriched = progressList.map(progress => {
      const course = courseMap.get(progress.courseId);
      if (!course) return null;

      let userEmail = progress.userId.includes('@') ? progress.userId : null;
      let firstName = null;
      let lastName = null;

      if (userEmail) {
        const user = userMap.get(userEmail.toLowerCase());
        if (user) {
          const nameParts = (user.name || '').split(' ');
          firstName = nameParts[0] || null;
          lastName = nameParts.slice(1).join(' ') || null;
        } else {
          firstName = userEmail.split('@')[0] || null;
        }
      } else {
        userEmail = `${progress.userId}@example.com`;
        firstName = progress.userId;
      }

      let progressPercent = 0;
      if (progress.progressPercent !== undefined && progress.progressPercent !== null) {
        progressPercent = Number(progress.progressPercent);
      } else if (progress.completionStatus === 'completed' || progress.completionStatus === 'passed' || progress.completedAt) {
        progressPercent = 100;
      } else if (progress.score !== undefined && progress.score !== null) {
        progressPercent = Number(progress.score);
      }

      let startedAt = progress.startedAt;
      if (!startedAt && (progressPercent > 0 || progress.timeSpent > 0 || (progress.completionStatus && progress.completionStatus !== 'not_started'))) {
        startedAt = progress.enrolledAt;
      }

      return {
        userId: progress.userId,
        email: userEmail,
        firstName,
        lastName,
        courseId: course.courseId,
        courseTitle: course.title,
        enrollmentStatus: progress.enrollmentStatus,
        completionStatus: progress.completionStatus,
        score: progress.score,
        progressPercent,
        timeSpent: progress.timeSpent || 0,
        attempts: progress.attempts || 0,
        enrolledAt: progress.enrolledAt,
        startedAt,
        completedAt: progress.completedAt,
        lastAccessedAt: progress.lastAccessedAt
      };
    }).filter(p => p !== null);

    enriched.sort((a, b) => {
      const aTime = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
      const bTime = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
      return bTime - aTime;
    });

    return enriched;
  };

  if (!shouldPaginate) {
    const allProgress = await fetchAllProgress();
    return res.json(buildEnrichedProgress(allProgress));
  }

  const pageResult = hasCourseFilter
    ? await progressStorage.getCourseProgressPage(normalizedCourseId, { limit: pageLimit, continuationToken })
    : await progressStorage.getAllProgress({ limit: pageLimit, continuationToken });

  return res.json({
    data: buildEnrichedProgress(pageResult.data),
    continuationToken: pageResult.continuationToken || null,
    hasMore: pageResult.hasMore || false
  });
}));

// Activity report - provider summary
app.get('/api/admin/reports/activity/summary', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);

  const providerId = String(req.query.providerId || 'all');
  const courseId = String(req.query.courseId || 'all');
  const dateType = String(req.query.dateType || 'due');

  if (!['due', 'completion'].includes(dateType)) {
    throw new ValidationError('dateType must be "due" or "completion"');
  }

  const { start, end } = resolveReportDateRange(dateType, req.query.startDate, req.query.endDate);

  const providers = providerId === 'all'
    ? await providersStorage.listProviders()
    : [await providersStorage.getProvider(providerId)];

  if (providers.some(p => !p)) {
    throw new NotFoundError('Provider');
  }

  const users = await getCachedUsers();
  const usersByProvider = new Map();
  users.forEach(user => {
    if (!user.providerId) return;
    if (!usersByProvider.has(user.providerId)) {
      usersByProvider.set(user.providerId, []);
    }
    usersByProvider.get(user.providerId).push(user);
  });

  const progressList = await fetchAllProgress();
  const progressMap = new Map();
  const lastAccessByUser = new Map();

  progressList.forEach(progress => {
    progressMap.set(`${progress.userId}|${progress.courseId}`, progress);
    if (progress.lastAccessedAt) {
      const accessedMs = new Date(progress.lastAccessedAt).getTime();
      const current = lastAccessByUser.get(progress.userId) || 0;
      if (accessedMs > current) {
        lastAccessByUser.set(progress.userId, accessedMs);
      }
    }
  });

  const isWithinRange = (value) => {
    if (!value) return false;
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) return false;
    if (start && ms < start.getTime()) return false;
    if (end && ms > end.getTime()) return false;
    return true;
  };

  const activeCutoffMs = Date.now() - 30 * DAY_MS;
  const rows = [];
  let totalAssigned = 0;
  let totalCompleted = 0;
  let totalCompletedOnTime = 0;
  let totalCompletedLate = 0;
  let totalNotComplete = 0;

  for (const provider of providers) {
    const providerUsers = usersByProvider.get(provider.providerId) || [];
    const activeLearners = providerUsers.filter(user => {
      const lastAccessed = lastAccessByUser.get(user.id) || 0;
      return lastAccessed >= activeCutoffMs;
    }).length;

    const assignments = await userAssignmentsStorage.listAssignmentsByProvider(provider.providerId);
    const scopedAssignments = courseId === 'all'
      ? assignments
      : assignments.filter(assignment => assignment.courseId === courseId);

    let assigned = 0;
    let completed = 0;
    let completedOnTime = 0;
    let completedLate = 0;

    for (const assignment of scopedAssignments) {
      const progress = progressMap.get(`${assignment.userId}|${assignment.courseId}`);
      const completedAt = progress?.completedAt || null;
      const completionStatus = progress?.completionStatus || '';
      const isCompleted = !!completedAt && (completionStatus === 'completed' || completionStatus === 'passed');

      const include = dateType === 'completion'
        ? (isCompleted && isWithinRange(completedAt))
        : isWithinRange(assignment.dueDate);

      if (!include) continue;

      assigned += 1;
      if (isCompleted) {
        completed += 1;
        const dueMs = assignment.dueDate ? new Date(assignment.dueDate).getTime() : null;
        const completedMs = new Date(completedAt).getTime();
        if (dueMs && completedMs <= dueMs) {
          completedOnTime += 1;
        } else if (dueMs) {
          completedLate += 1;
        }
      }
    }

    const notComplete = assigned - completed;
    const compliantPercent = assigned > 0
      ? Math.round((completedOnTime / assigned) * 1000) / 10
      : 0;

    totalAssigned += assigned;
    totalCompleted += completed;
    totalCompletedOnTime += completedOnTime;
    totalCompletedLate += completedLate;
    totalNotComplete += notComplete;

    rows.push({
      providerId: provider.providerId,
      providerName: provider.name,
      activeLearners,
      assigned,
      completed,
      completedOnTime,
      completedLate,
      notComplete,
      compliantPercent
    });
  }

  const totalCompliantPercent = totalAssigned > 0
    ? Math.round((totalCompletedOnTime / totalAssigned) * 1000) / 10
    : 0;

  res.json({
    rows,
    totals: {
      assigned: totalAssigned,
      completed: totalCompleted,
      completedOnTime: totalCompletedOnTime,
      completedLate: totalCompletedLate,
      notComplete: totalNotComplete,
      compliantPercent: totalCompliantPercent
    },
    dateRange: {
      startDate: start ? start.toISOString() : null,
      endDate: end ? end.toISOString() : null
    }
  });
}));

// Activity report - provider detail
app.get('/api/admin/reports/activity/users', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);

  const providerId = String(req.query.providerId || '');
  const courseId = String(req.query.courseId || 'all');
  const dateType = String(req.query.dateType || 'due');

  if (!providerId) {
    throw new ValidationError('providerId is required');
  }
  if (!['due', 'completion'].includes(dateType)) {
    throw new ValidationError('dateType must be "due" or "completion"');
  }

  const provider = await providersStorage.getProvider(providerId);
  if (!provider) {
    throw new NotFoundError('Provider');
  }

  const { start, end } = resolveReportDateRange(dateType, req.query.startDate, req.query.endDate);
  const users = await getCachedUsers();
  const userMap = new Map(users.map(user => [user.id, user]));
  const courses = await getCachedCourses();
  const courseMap = new Map(courses.map(course => [course.courseId, course]));

  const progressList = await fetchAllProgress();
  const progressMap = new Map();
  progressList.forEach(progress => {
    progressMap.set(`${progress.userId}|${progress.courseId}`, progress);
  });

  const isWithinRange = (value) => {
    if (!value) return false;
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) return false;
    if (start && ms < start.getTime()) return false;
    if (end && ms > end.getTime()) return false;
    return true;
  };

  const assignments = await userAssignmentsStorage.listAssignmentsByProvider(providerId);
  const scopedAssignments = courseId === 'all'
    ? assignments
    : assignments.filter(assignment => assignment.courseId === courseId);

  const rows = [];

  for (const assignment of scopedAssignments) {
    const progress = progressMap.get(`${assignment.userId}|${assignment.courseId}`);
    const completedAt = progress?.completedAt || null;
    const completionStatus = progress?.completionStatus || '';
    const isCompleted = !!completedAt && (completionStatus === 'completed' || completionStatus === 'passed');
    const include = dateType === 'completion'
      ? (isCompleted && isWithinRange(completedAt))
      : isWithinRange(assignment.dueDate);

    if (!include) continue;

    const dueMs = assignment.dueDate ? new Date(assignment.dueDate).getTime() : null;
    const completedMs = completedAt ? new Date(completedAt).getTime() : null;
    const completedOnTime = !!(completedMs && dueMs && completedMs <= dueMs);
    const completedLate = !!(completedMs && dueMs && completedMs > dueMs);

    let status = 'not_complete';
    if (completedOnTime) status = 'completed_on_time';
    else if (completedLate) status = 'completed_late';
    else if (isCompleted) status = 'completed';

    const user = userMap.get(assignment.userId);
    const course = courseMap.get(assignment.courseId);

    rows.push({
      userId: assignment.userId,
      userName: user?.name || user?.email || assignment.userId,
      courseId: assignment.courseId,
      courseTitle: course?.title || assignment.courseId,
      assignedAt: assignment.assignedAt,
      dueDate: assignment.dueDate,
      completedAt: completedAt || null,
      completionStatus: completionStatus || null,
      status
    });
  }

  rows.sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return bTime - aTime;
  });

  res.json({
    providerId: provider.providerId,
    providerName: provider.name,
    rows,
    dateRange: {
      startDate: start ? start.toISOString() : null,
      endDate: end ? end.toISOString() : null
    }
  });
}));

app.get('/api/admin/reports/users', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { courseId, limit, continuationToken } = req.query;
  const normalizedCourseId = courseId ? String(courseId) : '';
  const isAllCourses = !normalizedCourseId || normalizedCourseId === 'all';
  const pageLimit = Math.min(parseInt(limit || '0', 10) || 200, 1000);

  const course = isAllCourses ? null : await coursesStorage.getCourseById(normalizedCourseId);
  if (!isAllCourses && !course) {
    throw new NotFoundError('Course');
  }

  const [progressResult, allUsers, allCourses] = await Promise.all([
    isAllCourses
      ? progressStorage.getAllProgress({ limit: pageLimit, continuationToken })
      : progressStorage.getCourseProgressPage(course.courseId, { limit: pageLimit, continuationToken }),
    getCachedUsers(),
    isAllCourses ? getCachedCourses() : Promise.resolve([])
  ]);

  const userByEmail = new Map(allUsers.map(u => [u.email?.toLowerCase(), u]));
  const userById = new Map(allUsers.map(u => [u.userId, u]));
  const courseMap = new Map(allCourses.map(c => [c.courseId, c]));

  const rows = progressResult.data.map(progress => {
    const rawId = String(progress.userId || '');
    const emailKey = rawId.includes('@') ? rawId.toLowerCase() : null;
    const user = emailKey ? userByEmail.get(emailKey) : userById.get(rawId);

    const username = user?.name || user?.email || rawId || 'Unknown';
    const resolvedCourse = course || courseMap.get(progress.courseId);
    const courseTitle = resolvedCourse?.title || progress.courseId || 'Unknown Course';

    return {
      id: rawId,
      username,
      courseTitle,
      enrolledAt: progress.enrolledAt || null,
      completedAt: progress.completedAt || null
    };
  });

  res.json({
    courseId: isAllCourses ? 'all' : course.courseId,
    courseTitle: isAllCourses ? 'All Courses' : course.title,
    rows,
    continuationToken: progressResult.continuationToken || null,
    hasMore: progressResult.hasMore || false
  });
}));

app.get('/api/admin/attempts', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);

  const [attempts, courses] = await Promise.all([
    attemptsStorage.listAttempts(),
    getCachedCourses()
  ]);
  
  const courseMap = new Map(courses.map(c => [c.courseId, c]));

    const enriched = attempts.map(attempt => {
      const course = courseMap.get(attempt.courseId);
    return { ...attempt, courseTitle: course?.title || attempt.courseId };
    }).sort((a, b) => {
      const aTime = new Date(a.completedAt || a.launchedAt || 0).getTime();
      const bTime = new Date(b.completedAt || b.launchedAt || 0).getTime();
      return bTime - aTime;
    });

  res.json(enriched);
}));

// Knowledge Check Attempts
app.get('/api/kc-attempts', apiLimiter, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { courseId, registrationId, assessmentId, limit } = req.query;
  const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 0, 1000) : undefined;

  const attempts = await kcAttemptsStorage.listAttemptsByUser(user.email, {
    courseId,
    registrationId,
    assessmentId,
    limit: parsedLimit
  });

  res.json(attempts);
}));

app.get('/api/admin/kc-attempts', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { userEmail, courseId, registrationId, assessmentId, limit } = req.query;

  const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 0, 1000) : undefined;

  let attempts = [];
  if (userEmail) {
    attempts = await kcAttemptsStorage.listAttemptsByUser(String(userEmail), {
      courseId,
      registrationId,
      assessmentId,
      limit: parsedLimit
    });
  } else if (courseId) {
    attempts = await kcAttemptsStorage.listAttemptsByCourse(String(courseId), {
      registrationId,
      assessmentId,
      limit: parsedLimit
    });
  } else {
    throw new ValidationError('userEmail or courseId query parameter is required');
  }

  res.json(attempts);
}));

app.get('/api/kc-scores', apiLimiter, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { courseId, registrationId, assessmentId, limit } = req.query;
  const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 0, 2000) : undefined;

  const attempts = await kcAttemptsStorage.listAttemptsByUser(user.email, {
    courseId,
    registrationId,
    assessmentId,
    limit: parsedLimit
  });

  res.json(summarizeKcAttempts(attempts));
}));

app.get('/api/admin/kc-scores', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { userEmail, courseId, registrationId, assessmentId, limit } = req.query;

  const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 0, 2000) : undefined;

  let attempts = [];
  if (userEmail) {
    attempts = await kcAttemptsStorage.listAttemptsByUser(String(userEmail), {
      courseId,
      registrationId,
      assessmentId,
      limit: parsedLimit
    });
    return res.json(summarizeKcAttempts(attempts));
  }

  if (courseId) {
    attempts = await kcAttemptsStorage.listAttemptsByCourse(String(courseId), {
      registrationId,
      assessmentId,
      limit: parsedLimit
    });
    return res.json(summarizeKcAttemptsByUser(attempts));
  }

  throw new ValidationError('userEmail or courseId query parameter is required');
}));

// Admin verb endpoints
app.get('/api/admin/verbs', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    
    await verbTracker.initializeVerbTracker().catch(err => {
    serverLogger.error({ error: err.message }, 'Verb tracker initialization error');
    });
    
    const stats = verbTracker.getVerbStats();
    const allVerbs = verbTracker.getAllVerbs();
    
    res.json({
      statistics: stats || {},
      configuredVerbs: {
        standard: Object.keys(allVerbs?.standard || {}).length,
        custom: Object.keys(allVerbs?.custom || {}).length
      },
      verbConfigs: {
        standard: allVerbs?.standard || {},
        custom: allVerbs?.custom || {}
      }
    });
}));

app.get('/api/admin/module-rules', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    const { courseId } = req.query;
  
    if (!courseId) {
    throw new ValidationError('courseId query parameter is required');
    }
  
    const course = await coursesStorage.getCourseById(courseId);
    if (!course) {
    throw new NotFoundError('Course');
    }
  
    const rules = await moduleRulesStorage.getModuleRules(courseId);
    if (!rules || rules.length === 0) {
      const defaultRules = (course.modules || []).map(module => ({
        moduleId: module.id,
        moduleName: module.name,
        matchType: 'contains',
        matchValue: module.id,
        completionVerbs: [],
        scoreThreshold: null
      }));
      return res.json({ courseId, rules: defaultRules });
    }
  
    res.json({ courseId, rules });
}));

app.put('/api/admin/module-rules', apiLimiter, validateBody(moduleRulesSchema), asyncHandler(async (req, res) => {
    requireAdmin(req);
    const { courseId } = req.query;
  
    if (!courseId) {
    throw new ValidationError('courseId query parameter is required');
    }
  
    await moduleRulesStorage.saveModuleRules(courseId, req.body.rules);
    setModuleRulesCache(courseId, req.body.rules);
    res.json({ success: true });
}));

app.get('/api/admin/statements', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    const { courseId, limit, registration } = req.query;
  
    if (!courseId) {
    throw new ValidationError('courseId query parameter is required');
    }
  
    const course = await coursesStorage.getCourseById(courseId);
    if (!course?.activityId) {
    throw new NotFoundError('Course activityId');
    }
  
    const safeLimit = Math.min(parseInt(limit || '50', 10) || 50, 200);
    const result = await xapiLRS.queryStatementsByActivityPrefix(course.activityId, safeLimit, registration || null);
    res.status(result.status).json(result.data);
}));

app.post('/api/admin/verbs', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    
    const { verbId, config } = req.body;
    if (!verbId || !config) {
    throw new ValidationError('verbId and config are required');
    }
    
    if (!config.category || !config.action || !config.description) {
    throw new ValidationError('config must include category, action, and description');
    }
    
    const verb = await verbTracker.addCustomVerb(verbId, config);
    
  res.json({ success: true, message: `Custom verb ${verbId} added`, verb });
}));

app.put('/api/admin/verbs/*', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    
    const verbId = decodeURIComponent(req.params[0] || '');
    const { config } = req.body;
    
    if (!verbId) {
    throw new ValidationError('verbId is required');
    }
    if (!config) {
    throw new ValidationError('config is required');
    }
    
    const verb = await verbTracker.updateCustomVerb(verbId, config);
    
  res.json({ success: true, message: `Custom verb ${verbId} updated`, verb });
}));

app.delete('/api/admin/verbs/*', apiLimiter, asyncHandler(async (req, res) => {
    requireAdmin(req);
    
    const verbId = decodeURIComponent(req.params[0] || '');
    
    if (!verbId) {
    throw new ValidationError('verbId is required');
    }
    
    await verbTracker.removeCustomVerb(verbId);
    
  res.json({ success: true, message: `Custom verb ${verbId} removed` });
}));

// ============================================================================
// User Management Routes (Admin Only)
// ============================================================================

// Get all users (admin only)
app.get('/api/admin/users', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  
  const users = await getCachedUsers();
  
  // Remove sensitive data (password hashes)
  const safeUsers = users.map(user => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    roles: user.roles,
    isAdmin: user.isAdmin || (Array.isArray(user.roles) && user.roles.includes('admin')) || user.role === 'admin',
    isManager: user.isManager,
    isCoordinator: user.isCoordinator || user.isLearningCoordinator,
    isCoach: user.isCoach || user.isInstructionalCoach,
    isCorporate: user.isCorporate || user.isHr,
    providerId: user.providerId || null,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  }));
  
  res.json(safeUsers);
}));

// Update user role (admin only)
app.put('/api/admin/users/:userId/role', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  
  const { userId } = req.params;
  const { role } = req.body;
  
  if (!role || !['admin', 'learner'].includes(role)) {
    throw new ValidationError('Invalid role. Must be "admin" or "learner"');
  }
  
  // Find user by ID
  const users = await getCachedUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Prevent demoting the last admin
  if (isAdminUser(user) && role === 'learner') {
    const adminCount = countAdmins(users);
    if (adminCount <= 1) {
      throw new ValidationError('Cannot demote the last admin');
    }
  }
  
  const updatedRoles = Array.isArray(user.roles) ? [...user.roles] : [];
  if (role === 'admin' && !updatedRoles.includes('admin')) {
    updatedRoles.push('admin');
  }
  if (role !== 'admin') {
    for (let i = updatedRoles.length - 1; i >= 0; i -= 1) {
      if (updatedRoles[i] === 'admin') {
        updatedRoles.splice(i, 1);
      }
    }
  }
  if (!updatedRoles.includes(role)) {
    updatedRoles.push(role);
  }

  // Update user role
  await usersStorage.saveUser({ ...user, role, roles: updatedRoles });
  
  serverLogger.info({ userId, newRole: role }, 'User role updated');
  invalidateUsersCache();
  res.json({ success: true, message: `User role updated to ${role}` });
}));

// Update user roles/flags (admin only)
app.put('/api/admin/users/:userId/roles', apiLimiter, validateBody(userRolesSchema), asyncHandler(async (req, res) => {
  requireAdmin(req);

  const { userId } = req.params;
  const { role, roles, flags } = req.body;

  const users = await getCachedUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const nextRoles = normalizeRolesInput(user, { role, roles, flags });

  const nextPrimaryRole = role || user.role || 'learner';
  if (!nextRoles.includes(nextPrimaryRole)) {
    nextRoles.push(nextPrimaryRole);
  }

  const updatedUser = {
    ...user,
    role: nextPrimaryRole,
    roles: nextRoles
  };

  const normalized = auth.buildAuthUser(updatedUser);

  if (isAdminUser(user) && !normalized.isAdmin) {
    const adminCount = countAdmins(users);
    if (adminCount <= 1) {
      throw new ValidationError('Cannot remove the last admin');
    }
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

  invalidateUsersCache();

  res.json({
    success: true,
    message: 'User roles updated',
    user: normalized
  });
}));

// Update user provider (admin only)
app.put('/api/admin/users/:userId/provider', apiLimiter, validateBody(userProviderSchema), asyncHandler(async (req, res) => {
  requireAdmin(req);

  const { userId } = req.params;
  const { providerId } = req.body;

  const users = await getCachedUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const nextProviderId = providerId || null;
  if (nextProviderId) {
    const provider = await providersStorage.getProvider(nextProviderId);
    if (!provider) {
      throw new NotFoundError('Provider');
    }
  }

  const previousProviderId = user.providerId || null;

  if (previousProviderId && previousProviderId !== nextProviderId) {
    await userAssignmentsStorage.deleteAssignmentsByProviderUser(previousProviderId, user.id);
  }

  await usersStorage.saveUser({ ...user, providerId: nextProviderId });
  invalidateUsersCache();

  if (nextProviderId && nextProviderId !== previousProviderId) {
    const providerCourses = await providerCoursesStorage.listProviderCourses(nextProviderId);
    if (providerCourses.length > 0) {
      const assignedAt = new Date().toISOString();
      const dueDate = addDays(assignedAt, 30);
      const assignments = providerCourses.map(course => ({
        providerId: nextProviderId,
        userId: user.id,
        courseId: course.courseId,
        assignedAt,
        dueDate
      }));
      await userAssignmentsStorage.upsertAssignments(assignments);
    }
  }

  res.json({ success: true, message: 'User provider updated' });
}));

// Delete user (admin only)
app.delete('/api/admin/users/:userId', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  
  const { userId } = req.params;
  const currentUser = verifyAuth(req);
  
  // Find user by ID to get email
  const users = await getCachedUsers();
  const userToDelete = users.find(u => u.id === userId);
  
  if (!userToDelete) {
    throw new NotFoundError('User not found');
  }
  
  // Prevent self-deletion
  if (userToDelete.email === currentUser.email) {
    throw new ValidationError('Cannot delete your own account');
  }
  
  // Prevent deleting the last admin
  if (isAdminUser(userToDelete)) {
    const adminCount = countAdmins(users);
    if (adminCount <= 1) {
      throw new ValidationError('Cannot delete the last admin');
    }
  }
  
  await usersStorage.deleteUser(userToDelete.email);
  
  serverLogger.info({ userId, email: userToDelete.email }, 'User deleted');
  invalidateUsersCache();
  res.json({ success: true, message: 'User deleted successfully' });
}));

// ============================================================================
// Provider Management Routes (Admin Only)
// ============================================================================

app.get('/api/admin/providers', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  const providers = await providersStorage.listProviders();
  res.json(providers);
}));

app.post('/api/admin/providers', apiLimiter, validateBody(providerSchema), asyncHandler(async (req, res) => {
  requireAdmin(req);
  const providerId = uuidv4();
  const provider = await providersStorage.saveProvider({
    providerId,
    name: req.body.name
  });
  res.status(201).json(provider);
}));

app.put('/api/admin/providers/:providerId', apiLimiter, validateBody(providerSchema), asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { providerId } = req.params;
  const existing = await providersStorage.getProvider(providerId);
  if (!existing) {
    throw new NotFoundError('Provider');
  }
  const updated = await providersStorage.saveProvider({
    providerId,
    name: req.body.name,
    createdAt: existing.createdAt
  });
  res.json(updated);
}));

app.delete('/api/admin/providers/:providerId', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { providerId } = req.params;
  const existing = await providersStorage.getProvider(providerId);
  if (!existing) {
    throw new NotFoundError('Provider');
  }

  await providerCoursesStorage.deleteCoursesForProvider(providerId);
  await userAssignmentsStorage.deleteAssignmentsByProvider(providerId);

  const users = await getCachedUsers();
  const usersToUpdate = users.filter(u => u.providerId === providerId);
  await Promise.all(usersToUpdate.map(user => usersStorage.saveUser({ ...user, providerId: null })));
  invalidateUsersCache();

  await providersStorage.deleteProvider(providerId);
  res.json({ success: true, message: 'Provider deleted' });
}));

app.get('/api/admin/providers/:providerId/courses', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { providerId } = req.params;
  const provider = await providersStorage.getProvider(providerId);
  if (!provider) {
    throw new NotFoundError('Provider');
  }

  const assignments = await providerCoursesStorage.listProviderCourses(providerId);
  const courses = await getCachedCourses();
  const courseMap = new Map(courses.map(c => [c.courseId, c]));

  const rows = assignments.map(assignment => ({
    providerId,
    courseId: assignment.courseId,
    title: courseMap.get(assignment.courseId)?.title || assignment.courseId,
    assignedAt: assignment.assignedAt
  }));

  res.json(rows);
}));

app.post('/api/admin/providers/:providerId/courses', apiLimiter, validateBody(providerCourseSchema), asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { providerId } = req.params;
  const { courseId } = req.body;

  const provider = await providersStorage.getProvider(providerId);
  if (!provider) {
    throw new NotFoundError('Provider');
  }

  const course = await coursesStorage.getCourseById(courseId);
  if (!course) {
    throw new NotFoundError('Course');
  }

  const existingAssignment = await providerCoursesStorage.getProviderCourse(providerId, courseId);
  if (existingAssignment) {
    return res.json({ success: true, message: 'Course already assigned' });
  }

  const assignedAt = new Date().toISOString();
  await providerCoursesStorage.assignCourseToProvider(providerId, courseId, assignedAt);

  const users = await getCachedUsers();
  const providerUsers = users.filter(user => user.providerId === providerId);
  if (providerUsers.length > 0) {
    const dueDate = addDays(assignedAt, 30);
    const assignments = providerUsers.map(user => ({
      providerId,
      userId: user.id,
      courseId,
      assignedAt,
      dueDate
    }));
    await userAssignmentsStorage.upsertAssignments(assignments);
  }

  res.status(201).json({ success: true, message: 'Course assigned to provider' });
}));

app.delete('/api/admin/providers/:providerId/courses/:courseId', apiLimiter, asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { providerId, courseId } = req.params;

  await providerCoursesStorage.removeCourseFromProvider(providerId, courseId);
  await userAssignmentsStorage.deleteAssignmentsByProviderCourse(providerId, courseId);

  res.json({ success: true, message: 'Course removed from provider' });
}));

// ============================================================================
// Frontend SPA Fallback Route
// ============================================================================

const frontendDistPath = path.join(__dirname, '../frontend/dist');

// Use synchronous check to ensure routes are registered in correct order
if (existsSync(frontendDistPath)) {
  // Debug: Log all requests that might be for static files
  app.use((req, res, next) => {
    if (req.path.startsWith('/assets/')) {
      serverLogger.debug({ path: req.path, distPath: frontendDistPath }, 'Static asset request');
    }
    next();
  });
  
  // Serve static assets with long cache (they have hashes in filenames)
  // But DON'T serve index.html via static - we handle that separately
    app.use(express.static(frontendDistPath, {
    maxAge: '1y',
    etag: true,
    index: false, // Don't serve index.html automatically
    setHeaders: (res, filePath) => {
      serverLogger.debug({ filePath }, 'Serving static file');
      // Never cache index.html (in case it somehow gets served here)
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
    }
  }));
  
  // SPA fallback - serve index.html for all non-API routes
  // IMPORTANT: Set no-cache headers so browser always gets fresh index.html
    app.get('*', (req, res, next) => {
    // Skip API and backend routes
      if (req.path.startsWith('/api/') || 
          req.path.startsWith('/course/') || 
          req.path.startsWith('/xapi/') || 
          req.path.startsWith('/launch') ||
          req.path.startsWith('/health')) {
      return next();
    }
    
    // Set no-cache headers for index.html
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
      res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
        if (err) {
        serverLogger.error({ error: err.message }, 'Error serving index.html');
          res.status(500).json({ error: 'Failed to serve application' });
        }
      });
    });
    
  serverLogger.info({ path: frontendDistPath }, 'Frontend static files served');
} else {
  serverLogger.info('Frontend dist folder not found - serve separately via Vite');
}

// ============================================================================
// Error Handling
// ============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// Start Server
// ============================================================================

Promise.all([
  initializeTables().catch(err => ({ error: err })),
  blobStorage.initializeBlobStorage().catch(err => ({ error: err }))
])
  .then(async ([tablesResult, blobResult]) => {
    const tablesOk = !tablesResult.error;
    const blobOk = !blobResult.error;
    
    if (tablesResult.error) {
      serverLogger.error({ error: tablesResult.error.message }, 'Failed to initialize Azure Tables');
    }
    if (blobResult.error) {
      serverLogger.error({ error: blobResult.error.message }, 'Failed to initialize Azure Blob Storage');
    }
    
    if (tablesOk) {
      await coursesStorage.initializeDefaultCourse();
      await verbTracker.initializeVerbTracker().catch(err => {
        serverLogger.warn({ error: err.message }, 'Failed to initialize verb tracker');
      });
    }
    
    let storageInfo = 'Azure Storage not configured';
    if (tablesOk && blobOk) {
      storageInfo = 'Azure Storage (Tables + Blob) - Production-ready';
    } else if (tablesOk) {
      storageInfo = 'Azure Tables OK, Blob Storage not configured';
    } else if (blobOk) {
      storageInfo = 'Blob Storage OK, Azure Tables not configured';
    }
    
    startServer(storageInfo);
  });

function startServer(storageInfo) {
  const HOST = process.env.HOST || '0.0.0.0';
  const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);
  
  const server = app.listen(PORT, HOST, () => {
    serverLogger.info({
      host: HOST,
      port: PORT,
      storage: storageInfo,
      env: process.env.NODE_ENV || 'development'
    }, 'Server started');
    
    console.log(`\n🚀 Storyline LMS Backend running on http://${HOST}:${PORT}`);
    console.log(`📚 Course files served from: /course`);
    console.log(`🔐 Auth endpoints: /api/auth/*`);
    console.log(`📊 xAPI LRS endpoint: ${BASE_URL}/xapi`);
    console.log(`💾 Storage: ${storageInfo}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      serverLogger.fatal({ port: PORT }, 'Port already in use');
      process.exit(1);
    } else {
      serverLogger.fatal({ error: err.message }, 'Server error');
      process.exit(1);
    }
  });
  
  // Graceful shutdown handler
  const gracefulShutdown = (signal) => {
    serverLogger.info({ signal }, 'Shutdown signal received, closing server gracefully');
    
    server.close(() => {
      serverLogger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force shutdown if graceful close takes too long
    setTimeout(() => {
      serverLogger.warn({ timeout: SHUTDOWN_TIMEOUT_MS }, 'Forcing shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
