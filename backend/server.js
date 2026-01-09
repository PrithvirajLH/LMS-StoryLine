/**
 * Storyline LMS Backend Server
 * Serves course files and provides xAPI LRS endpoints
 */

// Import crypto polyfill before any Azure SDK imports
import './crypto-polyfill.js';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { Readable } from 'stream';

// Import services
import * as xapiLRS from './xapi-lrs-azure.js';
import * as auth from './auth.js';
import * as coursesStorage from './courses-storage.js';
import * as blobStorage from './blob-storage.js';
import * as progressStorage from './progress-storage.js';
import * as usersStorage from './users-storage.js';
import { extractActivityIdFromXml } from './extract-activity-id.js';
import { initializeTables } from './azure-tables.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for course content
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Experience-API-Version']
}));

// IMPORTANT: Handle raw body for xAPI state PUT BEFORE express.json()
// Storyline sends state as application/octet-stream (binary), NOT JSON
// Storyline uses a proprietary encoded format, so we save it as-is (string)
app.put('/xapi/activities/state', express.raw({ type: ['application/octet-stream', 'application/json', '*/*'], limit: '10mb' }), (req, res, next) => {
  // Convert buffer to string - Storyline expects the exact same format back
  if (Buffer.isBuffer(req.body)) {
    req.body = req.body.toString('utf8');
    console.log(`[xAPI State Middleware] Converted buffer to string (${req.body.length} chars), Preview: ${req.body.substring(0, 100)}`);
  } else if (typeof req.body === 'object' && req.body !== null) {
    // If it's already an object, try to stringify it (for JSON content-type)
    try {
      req.body = JSON.stringify(req.body);
      console.log(`[xAPI State Middleware] Stringified object to JSON string`);
    } catch (e) {
      console.warn(`[xAPI State Middleware] Could not stringify object: ${e.message}`);
      req.body = String(req.body);
    }
  }
  // Keep as string - Storyline's format is not JSON, it's a proprietary encoding
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log xAPI state requests for debugging
app.use('/xapi/activities/state', (req, res, next) => {
  if (req.method === 'GET') {
    console.log(`[xAPI State] GET - stateId: ${req.query.stateId}, hasAgent: ${!!req.query.agent}, activityId: ${req.query.activityId?.substring(0, 50) || 'missing'}...`);
  }
  next();
});

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Experience-API-Version');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve launch page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'launch.html'));
});

// ============================================================================
// Courses API Routes
// ============================================================================

// Courses are now stored in Azure Table Storage via courses-storage.js

// Helper to verify token and get user
function verifyAuth(req) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) {
    return null;
  }
  return auth.verifyToken(token);
}

// GET /api/courses - Get all courses (with enrollment status for authenticated users)
app.get('/api/courses', async (req, res) => {
  try {
    const user = verifyAuth(req);
    const courses = await coursesStorage.getAllCourses();
    
    // Get user's progress if authenticated
    let userProgress = [];
    if (user && user.email) {
      try {
        userProgress = await progressStorage.getUserProgress(user.email);
      } catch (progressError) {
        console.error('[Courses] Error getting user progress:', progressError);
        // Continue without progress data
      }
    }
    
    // Return courses with enrollment status if user is authenticated
    const coursesWithEnrollment = courses.map(course => {
      const progress = userProgress.find(p => p.courseId === course.courseId);
      const isEnrolled = progress && (progress.enrollmentStatus === 'enrolled' || progress.enrollmentStatus === 'in_progress');
      
      // Calculate progress percent - ensure it's always a number
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
        enrollmentStatus: progress?.enrollmentStatus || undefined,
        completionStatus: progress?.completionStatus || undefined,
        progressPercent: progressPercent,
        score: progress?.score !== undefined && progress?.score !== null ? Number(progress.score) : undefined,
        completedAt: progress?.completedAt || undefined,
        activityId: course.activityId
      };
    });

    res.json(coursesWithEnrollment);
  } catch (error) {
    console.error('[Courses] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/courses/:courseId - Get specific course
app.get('/api/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await coursesStorage.getCourseById(courseId);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const user = verifyAuth(req);
    
    res.json({
      ...course,
      isEnrolled: user ? true : false,
      enrollmentStatus: user ? 'enrolled' : undefined
    });
  } catch (error) {
    console.error('[Courses] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/courses/:courseId/launch - Launch course (auto-enrolls and tracks progress)
app.post('/api/courses/:courseId/launch', async (req, res) => {
  try {
    const { courseId } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token || req.body.token;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const user = auth.verifyToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Find course
    const course = await coursesStorage.getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Update progress - enroll and mark as started
    // Use email as PartitionKey for consistency (better than numeric userId)
    const userEmail = user.email;
    if (userEmail) {
      try {
        // Get existing progress to increment attempts correctly
        const existingProgressList = await progressStorage.getUserProgress(userEmail);
        const currentProgress = existingProgressList.find(p => p.courseId === courseId);
        const currentAttempts = currentProgress?.attempts || 0;
        
        await progressStorage.updateProgress(userEmail, courseId, {
          enrollmentStatus: 'enrolled',
          completionStatus: 'in_progress',
          attempts: currentAttempts + 1 // Increment attempts on launch
        });
        console.log(`[Progress] ✅ Updated progress on launch: attempts=${currentAttempts + 1}`);
      } catch (progressError) {
        console.error('[Progress] Error updating progress on launch:', progressError);
        // Continue with launch even if progress update fails
      }
    } else {
      console.warn('[Progress] Cannot update progress: user email not found', user);
    }

    // Generate registration ID
    const registrationId = `reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create actor
    const actor = {
      objectType: 'Agent',
      name: user.name || user.email,
      mbox: `mailto:${user.email}`
    };

    // xAPI endpoint
    const endpoint = `${BASE_URL}/xapi`;
    const authString = Buffer.from(`${user.email}:${token}`).toString('base64');

    // Build launch URL with xAPI parameters
    const params = new URLSearchParams({
      endpoint: endpoint,
      auth: `Basic ${authString}`,
      actor: JSON.stringify(actor),
      registration: registrationId,
      activityId: course.activityId
    });

    // Build launch URL - include coursePath if it exists and is not empty
    const filePath = course.coursePath && course.coursePath.trim() 
      ? `${course.coursePath}/${course.launchFile}`.replace(/\/+/g, '/') // Normalize slashes
      : course.launchFile;
    const launchUrl = `${BASE_URL}/course/${filePath}?${params.toString()}`;

    // Get current progress to include progressPercent
    let progressPercent = 0;
    let completionStatus = 'not_started';
    if (userEmail) {
      try {
        const progressList = await progressStorage.getUserProgress(userEmail);
        const currentProgress = progressList.find(p => p.courseId === courseId);
        if (currentProgress) {
          completionStatus = currentProgress.completionStatus || 'not_started';
          // Use progressPercent from database if available, otherwise calculate
          if (currentProgress.progressPercent !== undefined) {
            progressPercent = currentProgress.progressPercent;
          } else if (completionStatus === 'completed' || completionStatus === 'passed') {
            progressPercent = 100;
          } else if (completionStatus === 'in_progress') {
            progressPercent = currentProgress.score || 0;
          }
        }
      } catch (progressError) {
        console.error('[Progress] Error getting progress for launch:', progressError);
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
        completionStatus: completionStatus,
        progressPercent: progressPercent
      },
      launchUrl: launchUrl,
      registrationId: registrationId
    });
  } catch (error) {
    console.error('[Courses] Launch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Authentication Routes
// ============================================================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    // Combine firstName and lastName if provided, otherwise use name
    const fullName = (firstName && lastName) 
      ? `${firstName.trim()} ${lastName.trim()}`.trim()
      : (name || email.split('@')[0]);
    const result = await auth.register(email, password, fullName, firstName, lastName);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await auth.login(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const user = auth.verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  // Transform user to include isAdmin for frontend compatibility
  res.json({ 
    user: {
      ...user,
      userId: user.userId || user.id,
      isAdmin: user.role === 'admin',
      firstName: user.name?.split(' ')[0] || user.name,
      lastName: user.name?.split(' ').slice(1).join(' ') || ''
    }
  });
});

// ============================================================================
// Course Launch Route
// ============================================================================

app.get('/launch', async (req, res) => {
  try {
    // Get token from query or header
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Add ?token=YOUR_TOKEN to the URL' });
    }

    // Verify token
    const user = auth.verifyToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Generate registration ID for this attempt
    const registrationId = req.query.registration || `reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create actor object for xAPI
    const actor = {
      objectType: 'Agent',
      name: user.name || user.email,
      mbox: `mailto:${user.email}`
    };

    // Activity ID from tincan.xml
    const activityId = 'urn:articulate:storyline:5Ujw93Dh98n';

    // xAPI endpoint
    const endpoint = `${BASE_URL}/xapi`;

    // Create auth string (Basic auth with token)
    const authString = Buffer.from(`${user.email}:${token}`).toString('base64');

    // Build launch URL with xAPI parameters
    // Storyline's scormdriver.js reads these from URL query parameters
    const params = new URLSearchParams({
      endpoint: endpoint,
      auth: `Basic ${authString}`,
      actor: JSON.stringify(actor),
      registration: registrationId,
      activityId: activityId
    });

    // Redirect to course with xAPI parameters
    const courseUrl = `/course/index_lms.html?${params.toString()}`;
    res.redirect(courseUrl);
  } catch (error) {
    console.error('[Launch] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Course File Serving from Azure Blob Storage
// ============================================================================

// Serve course files from Azure Blob Storage
app.get('/course/*', async (req, res, next) => {
  try {
    // Get file path (everything after /course/)
    // Express wildcard routes: req.params[0] or use req.path
    // Note: req.path is URL-decoded by Express, but req.url/req.originalUrl are not
    // Use req.path for the decoded path, but also check req.originalUrl if needed
    const fullPath = req.path; // e.g., "/course/index_lms.html" (already URL-decoded by Express)
    let filePath = fullPath.replace(/^\/course\//, '') || 'index_lms.html';
    
    // Ensure proper URL decoding (Express should handle req.path, but be explicit for safety)
    // Also try decoding in case there's any remaining encoding
    try {
      // If filePath still contains % encoding, decode it
      if (filePath.includes('%')) {
        filePath = decodeURIComponent(filePath);
      }
    } catch (e) {
      // If decoding fails, use as-is
      console.log(`[Course File] URL decode warning: ${e.message}, using path as-is: ${filePath}`);
    }
    
    // Fix duplicated path segments (e.g., "coursePath/coursePath/file" -> "coursePath/file")
    // This can happen when course JavaScript constructs paths incorrectly
    const originalFilePath = filePath;
    const pathParts = filePath.split('/').filter(p => p !== ''); // Remove empty parts
    const deduplicatedParts = [];
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      // Skip if this part is the same as the previous part (consecutive duplicate)
      if (i > 0 && pathParts[i - 1] === part) {
        continue;
      }
      deduplicatedParts.push(part);
    }
    filePath = deduplicatedParts.join('/');
    
    // Security: prevent directory traversal
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Determine content type
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
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Get blob stream from Azure with fallback to root level
    let stream;
    let actualFilePath = filePath;
    try {
      stream = await blobStorage.getBlobStream(filePath);
    } catch (error) {
      // If file not found and path contains '/', try multiple fallback strategies
      if (error.message.includes('not found') && filePath.includes('/')) {
        const fileName = path.basename(filePath);
        
        // Strategy 1: Try root level (just filename)
        try {
          stream = await blobStorage.getBlobStream(fileName);
          actualFilePath = fileName;
        } catch (fallbackError1) {
          // Strategy 2: Try with duplicated path (in case file is stored with duplication in blob storage)
          const pathParts = filePath.split('/').filter(p => p !== '');
          let found = false;
          if (pathParts.length > 0) {
            const firstPart = pathParts[0];
            const duplicatedPath = `${firstPart}/${firstPart}/${pathParts.slice(1).join('/')}`;
            try {
              stream = await blobStorage.getBlobStream(duplicatedPath);
              actualFilePath = duplicatedPath;
              found = true;
            } catch (fallbackError2) {
              // Strategy 3: Try with different file extension (.jpg vs .png, etc.)
              const ext = path.extname(filePath);
              const baseName = path.basename(filePath, ext);
              const dirPath = path.dirname(filePath);
              const altExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
              for (const altExt of altExtensions) {
                if (altExt !== ext) {
                  const altPath = dirPath === '.' ? `${baseName}${altExt}` : `${dirPath}/${baseName}${altExt}`;
                  try {
                    stream = await blobStorage.getBlobStream(altPath);
                    actualFilePath = altPath;
                    found = true;
                    break;
                  } catch (altError) {
                    // Try duplicated path with alternative extension
                    const duplicatedAltPath = `${firstPart}/${firstPart}/${pathParts.slice(1, -1).join('/')}/${baseName}${altExt}`.replace(/\/+/g, '/');
                    try {
                      stream = await blobStorage.getBlobStream(duplicatedAltPath);
                      actualFilePath = duplicatedAltPath;
                      found = true;
                      break;
                    } catch (dupAltError) {
                      // Continue to next extension
                    }
                  }
                }
              }
            }
          }
          if (!found) {
            throw error; // Re-throw original error if all fallbacks fail
          }
        }
      } else {
        throw error; // Re-throw if not a "not found" error or path doesn't contain '/'
      }
    }
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    
    // Different cache strategies for different file types
    // Images: shorter cache (5 min) to allow updates, or use ETag for better invalidation
    // Other files: longer cache (1 hour) for performance
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext);
    if (isImage) {
      // For images, use shorter cache or allow revalidation
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes, must revalidate
    } else {
      // For other files, cache longer
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    }
    
    // Pipe stream to response
    stream.pipe(res);
    
    stream.on('error', (error) => {
      console.error(`[Blob Storage] Stream error for ${filePath}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      const requestedPath = req.path.replace(/^\/course\//, '') || 'index_lms.html';
      console.error(`[Course File] ❌ File not found: ${requestedPath}`);
      console.error(`[Course File] 💡 Tried paths: ${requestedPath} and ${path.basename(requestedPath)}`);
      console.error(`[Course File] 💡 Make sure course files are uploaded to blob storage`);
      return res.status(404).json({ 
        error: 'File not found',
        message: `Course file not found. Please ensure course files are uploaded to blob storage.`,
        triedPaths: [requestedPath, path.basename(requestedPath)]
      });
    }
    console.error(`[Blob Storage] Error serving file: ${req.params[0]}`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// ============================================================================
// xAPI LRS Endpoints
// ============================================================================

// Helper function to extract base activity ID from statement activity ID
// Storyline sends statements with extended IDs like "urn:articulate:storyline:5Ujw93Dh98n/6BnvowJ1urM"
// We need to match against the base course activity ID "urn:articulate:storyline:5Ujw93Dh98n"
function extractBaseActivityId(activityId) {
  if (!activityId) return null;
  // If activityId contains a '/', extract the base part (everything before the first '/')
  const slashIndex = activityId.indexOf('/');
  return slashIndex > 0 ? activityId.substring(0, slashIndex) : activityId;
}

// Helper function to find course by activity ID (handles extended IDs)
async function findCourseByActivityId(activityId) {
  const allCourses = await coursesStorage.getAllCourses();
  const baseActivityId = extractBaseActivityId(activityId);
  
  // Try exact match first
  let course = allCourses.find(c => c.activityId === activityId);
  if (course) return course;
  
  // Try base activity ID match (for extended IDs like "base/sub")
  if (baseActivityId && baseActivityId !== activityId) {
    course = allCourses.find(c => c.activityId === baseActivityId);
    if (course) return course;
  }
  
  // Try prefix match (statement activity ID starts with course activity ID)
  course = allCourses.find(c => activityId.startsWith(c.activityId + '/') || activityId === c.activityId);
  return course || null;
}

// POST /xapi/statements - Store statement(s)
app.post('/xapi/statements', async (req, res) => {
  console.log(`[xAPI POST] /xapi/statements endpoint called`);
  try {
    const statement = Array.isArray(req.body) ? req.body[0] : req.body;
    console.log(`[xAPI Statements] Received statement:`, {
      hasActor: !!statement?.actor,
      hasObject: !!statement?.object,
      actorMbox: statement?.actor?.mbox,
      objectId: statement?.object?.id,
      bodyType: Array.isArray(req.body) ? 'array' : typeof req.body,
      bodyLength: JSON.stringify(req.body).length
    });
    const result = await xapiLRS.saveStatement(req.body);
    
    // Auto-sync progress when statements are saved
    console.log(`[Progress] Checking statement for sync:`, {
      hasStatement: !!statement,
      hasActor: !!statement?.actor,
      hasObject: !!statement?.object,
      actorMbox: statement?.actor?.mbox,
      objectId: statement?.object?.id
    });
    
    if (statement && statement.actor && statement.object) {
      try {
        const actor = statement.actor;
        const activityId = statement.object.id;
        const userEmail = actor.mbox ? actor.mbox.replace('mailto:', '') : null;
        
        console.log(`[Progress] ✅ Auto-sync triggered: userEmail=${userEmail}, activityId=${activityId}`);
        
        if (userEmail && activityId) {
          // Find course by activityId (handles extended IDs)
          const course = await findCourseByActivityId(activityId);
          
          if (course) {
            // Use the course's base activityId for syncing (not the extended one from statement)
            const baseActivityId = course.activityId;
            console.log(`[Progress] ✅ Found course ${course.courseId} for activityId ${activityId} (base: ${baseActivityId}), syncing progress...`);
            // Sync progress in background (don't wait for it)
            progressStorage.syncProgressFromStatements(userEmail, course.courseId, baseActivityId)
              .then(result => {
                if (result) {
                  console.log(`[Progress] ✅✅ Sync completed: status=${result.completionStatus}, timeSpent=${result.timeSpent}s, score=${result.score}, progressPercent=${result.progressPercent}`);
                } else {
                  console.log(`[Progress] ⚠️ Sync returned null (no statements found)`);
                }
              })
              .catch(err => {
                console.error('[Progress] ❌ Auto-sync error:', err);
                console.error('[Progress] ❌ Error stack:', err.stack);
              });
          } else {
            const allCourses = await coursesStorage.getAllCourses();
            console.warn(`[Progress] ⚠️ No course found for activityId: ${activityId} (base: ${extractBaseActivityId(activityId)})`);
            console.warn(`[Progress] Available courses:`, allCourses.map(c => ({ id: c.courseId, activityId: c.activityId })));
          }
        } else {
          console.warn(`[Progress] ⚠️ Missing userEmail or activityId: userEmail=${userEmail}, activityId=${activityId}`);
        }
      } catch (syncErr) {
        // Don't fail the statement save if sync fails
        console.error('[Progress] ❌ Error auto-syncing progress:', syncErr);
        console.error('[Progress] ❌ Error stack:', syncErr.stack);
      }
    } else {
      console.warn(`[Progress] ⚠️ Statement missing required fields for sync`);
    }
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error('[xAPI] Error saving statement:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /xapi/statements - Query statements or get by statementId
app.get('/xapi/statements', async (req, res) => {
  try {
    // If statementId is in query params, get specific statement (Storyline uses this)
    if (req.query.statementId) {
      const result = await xapiLRS.getStatement(req.query.statementId);
      if (result.status === 404) {
        return res.status(404).send();
      }
      return res.status(result.status).json(result.data);
    }
    
    // Otherwise, query statements
    const result = await xapiLRS.queryStatements(req.query);
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error('[xAPI] Error querying statements:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /xapi/statements - Update statement (Storyline uses statementId query param)
app.put('/xapi/statements', async (req, res) => {
  console.log(`[xAPI PUT] /xapi/statements endpoint called`);
  try {
    // Storyline sends statementId as query parameter
    const statementId = req.query.statementId;
    
    if (!statementId) {
      return res.status(400).json({ error: 'statementId required' });
    }
    
    // Update the statement (for now, just save it as a new one)
    // In a real LRS, you'd update the existing statement
    const statement = req.body;
    statement.id = statementId;
    
    console.log(`[xAPI Statements PUT] Received statement:`, {
      statementId,
      hasActor: !!statement?.actor,
      hasObject: !!statement?.object,
      actorMbox: statement?.actor?.mbox,
      objectId: statement?.object?.id,
      bodyType: typeof req.body,
      bodyLength: JSON.stringify(req.body).length
    });
    
    const result = await xapiLRS.saveStatement(statement);
    
    // Auto-sync progress when statements are saved (same as POST)
    console.log(`[Progress PUT] Checking statement for sync:`, {
      hasStatement: !!statement,
      hasActor: !!statement?.actor,
      hasObject: !!statement?.object,
      actorMbox: statement?.actor?.mbox,
      objectId: statement?.object?.id
    });
    
    if (statement && statement.actor && statement.object) {
      try {
        const actor = statement.actor;
        const activityId = statement.object.id;
        const userEmail = actor.mbox ? actor.mbox.replace('mailto:', '') : null;
        
        console.log(`[Progress PUT] ✅ Auto-sync triggered: userEmail=${userEmail}, activityId=${activityId}`);
        
        if (userEmail && activityId) {
          // Find course by activityId (handles extended IDs)
          const course = await findCourseByActivityId(activityId);
          
          if (course) {
            // Use the course's base activityId for syncing (not the extended one from statement)
            const baseActivityId = course.activityId;
            console.log(`[Progress PUT] ✅ Found course ${course.courseId} for activityId ${activityId} (base: ${baseActivityId}), syncing progress...`);
            // Sync progress in background (don't wait for it)
            progressStorage.syncProgressFromStatements(userEmail, course.courseId, baseActivityId)
              .then(result => {
                if (result) {
                  console.log(`[Progress PUT] ✅✅ Sync completed: status=${result.completionStatus}, timeSpent=${result.timeSpent}s, score=${result.score}, progressPercent=${result.progressPercent}`);
                } else {
                  console.log(`[Progress PUT] ⚠️ Sync returned null (no statements found)`);
                }
              })
              .catch(err => {
                console.error('[Progress PUT] ❌ Auto-sync error:', err);
                console.error('[Progress PUT] ❌ Error stack:', err.stack);
              });
          } else {
            const allCourses = await coursesStorage.getAllCourses();
            console.warn(`[Progress PUT] ⚠️ No course found for activityId: ${activityId} (base: ${extractBaseActivityId(activityId)})`);
            console.warn(`[Progress PUT] Available courses:`, allCourses.map(c => ({ id: c.courseId, activityId: c.activityId })));
          }
        } else {
          console.warn(`[Progress PUT] ⚠️ Missing userEmail or activityId: userEmail=${userEmail}, activityId=${activityId}`);
        }
      } catch (syncErr) {
        // Don't fail the statement save if sync fails
        console.error('[Progress PUT] ❌ Error auto-syncing progress:', syncErr);
        console.error('[Progress PUT] ❌ Error stack:', syncErr.stack);
      }
    } else {
      console.warn(`[Progress PUT] ⚠️ Statement missing required fields for sync`);
    }
    
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error('[xAPI] Error updating statement:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /xapi/statements/:id - Get specific statement (path parameter)
app.get('/xapi/statements/:id', async (req, res) => {
  try {
    const result = await xapiLRS.getStatement(req.params.id);
    if (result.status === 404) {
      return res.status(404).send();
    }
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error('[xAPI] Error getting statement:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /xapi/activities/state - Get activity state
app.get('/xapi/activities/state', async (req, res) => {
  try {
    const { activityId, agent, stateId, registration } = req.query;
    
    // Log request for debugging
    if (!agent) {
      console.warn('[xAPI State GET] Missing agent parameter. Query params:', Object.keys(req.query));
      return res.status(400).json({ error: 'Missing required parameter: agent' });
    }
    
    if (!activityId || !stateId) {
      console.warn('[xAPI State GET] Missing required parameters. activityId:', !!activityId, 'stateId:', !!stateId);
      return res.status(400).json({ error: 'Missing required parameters: activityId, stateId' });
    }
    
    // Parse agent - handle URL encoding
    let agentObj;
    try {
      // Try decoding first (most common case)
      const decoded = decodeURIComponent(agent);
      agentObj = JSON.parse(decoded);
    } catch (e1) {
      try {
        // If that fails, try parsing directly
        agentObj = JSON.parse(agent);
      } catch (e2) {
        // If both fail, log and return error
        console.error('[xAPI] Failed to parse agent:', agent);
        return res.status(400).json({ error: 'Invalid agent parameter format' });
      }
    }
    
    // Log agent details for debugging
    if (stateId === 'resume') {
      console.log(`[xAPI State GET] Resume request:`, {
        activityId,
        stateId,
        registration,
        agentEmail: agentObj.mbox?.replace('mailto:', ''),
        agentName: agentObj.name
      });
    }
    
    const result = await xapiLRS.getState(activityId, agentObj, stateId, registration || null);
    if (result.status === 404) {
      // Return empty response for 404 (xAPI spec) - this is normal for first-time access
      // No resume state exists yet, which is expected
      console.log(`[xAPI State GET] No state found for stateId: ${stateId}`);
      return res.status(404).send();
    }
    
    // Log what we're returning
    const dataLength = typeof result.data === 'string' ? result.data.length : JSON.stringify(result.data).length;
    const preview = typeof result.data === 'string' ? result.data.substring(0, 200) : JSON.stringify(result.data).substring(0, 200);
    console.log(`[xAPI State GET] Returning state (${result.status}):`, {
      stateId,
      dataType: typeof result.data,
      dataLength,
      preview
    });
    
    // Storyline expects the state as-is (string), not as JSON
    // If it's a string, send it as text/plain, otherwise as JSON
    if (typeof result.data === 'string') {
      res.status(result.status).type('text/plain').send(result.data);
    } else {
      res.status(result.status).json(result.data);
    }
  } catch (error) {
    console.error('[xAPI] Error getting state:', error);
    console.error('[xAPI] Request params:', { 
      activityId: req.query.activityId, 
      stateId: req.query.stateId,
      hasAgent: !!req.query.agent,
      registration: req.query.registration
    });
    res.status(500).json({ error: error.message });
  }
});

// PUT /xapi/activities/state - Save activity state
// Note: Raw body parsing middleware is applied above, before express.json()
app.put('/xapi/activities/state', async (req, res) => {
  console.log(`[xAPI State PUT Handler] Request received - Content-Type: ${req.headers['content-type']}, Body type: ${typeof req.body}`);
  
  try {
    const { activityId, agent, stateId, registration } = req.query;
    if (!activityId || !agent || !stateId) {
      return res.status(400).json({ error: 'Missing required parameters: activityId, agent, stateId' });
    }
    
    // Log what state is being saved
    if (stateId === 'resume') {
      console.log(`[xAPI State PUT] Saving resume state:`, {
        stateId,
        registration,
        contentType: req.headers['content-type'],
        bodyType: typeof req.body,
        bodyLength: typeof req.body === 'object' ? JSON.stringify(req.body).length : (req.body?.length || 0),
        bodyPreview: typeof req.body === 'object' ? JSON.stringify(req.body).substring(0, 200) : String(req.body).substring(0, 200),
        bodyKeys: typeof req.body === 'object' && req.body !== null ? Object.keys(req.body) : 'N/A'
      });
    }
    
    const agentObj = typeof agent === 'string' ? JSON.parse(decodeURIComponent(agent)) : agent;
    const result = await xapiLRS.saveState(activityId, agentObj, stateId, req.body, registration || null);
    res.status(result.status).send();
  } catch (error) {
    console.error('[xAPI] Error saving state:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /xapi/activities/state - Delete activity state
app.delete('/xapi/activities/state', async (req, res) => {
  try {
    const { activityId, agent, stateId, registration } = req.query;
    if (!activityId || !agent || !stateId) {
      return res.status(400).json({ error: 'Missing required parameters: activityId, agent, stateId' });
    }
    const agentObj = typeof agent === 'string' ? JSON.parse(agent) : agent;
    const result = await xapiLRS.deleteState(activityId, agentObj, stateId, registration || null);
    res.status(result.status).send();
  } catch (error) {
    console.error('[xAPI] Error deleting state:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /xapi/activities/profile - Get activity profile
app.get('/xapi/activities/profile', async (req, res) => {
  try {
    const { activityId, profileId } = req.query;
    if (!activityId || !profileId) {
      return res.status(400).json({ error: 'Missing required parameters: activityId, profileId' });
    }
    const result = await xapiLRS.getActivityProfile(activityId, profileId);
    if (result.status === 404) {
      return res.status(404).send();
    }
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error('[xAPI] Error getting activity profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /xapi/activities/profile - Save activity profile
app.put('/xapi/activities/profile', async (req, res) => {
  try {
    const { activityId, profileId } = req.query;
    if (!activityId || !profileId) {
      return res.status(400).json({ error: 'Missing required parameters: activityId, profileId' });
    }
    const result = await xapiLRS.saveActivityProfile(activityId, profileId, req.body);
    res.status(result.status).send();
  } catch (error) {
    console.error('[xAPI] Error saving activity profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /xapi/activities/profile - Delete activity profile
app.delete('/xapi/activities/profile', async (req, res) => {
  try {
    const { activityId, profileId } = req.query;
    if (!activityId || !profileId) {
      return res.status(400).json({ error: 'Missing required parameters: activityId, profileId' });
    }
    const result = await xapiLRS.deleteActivityProfile(activityId, profileId);
    res.status(result.status).send();
  } catch (error) {
    console.error('[xAPI] Error deleting activity profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /xapi/agents/profile - Get agent profile
app.get('/xapi/agents/profile', async (req, res) => {
  try {
    const { agent, profileId } = req.query;
    if (!agent || !profileId) {
      return res.status(400).json({ error: 'Missing required parameters: agent, profileId' });
    }
    const agentObj = typeof agent === 'string' ? JSON.parse(agent) : agent;
    const result = await xapiLRS.getAgentProfile(agentObj, profileId);
    if (result.status === 404) {
      return res.status(404).send();
    }
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error('[xAPI] Error getting agent profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /xapi/agents/profile - Save agent profile
app.put('/xapi/agents/profile', async (req, res) => {
  try {
    const { agent, profileId } = req.query;
    if (!agent || !profileId) {
      return res.status(400).json({ error: 'Missing required parameters: agent, profileId' });
    }
    const agentObj = typeof agent === 'string' ? JSON.parse(agent) : agent;
    const result = await xapiLRS.saveAgentProfile(agentObj, profileId, req.body);
    res.status(result.status).send();
  } catch (error) {
    console.error('[xAPI] Error saving agent profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /xapi/agents/profile - Delete agent profile
app.delete('/xapi/agents/profile', async (req, res) => {
  try {
    const { agent, profileId } = req.query;
    if (!agent || !profileId) {
      return res.status(400).json({ error: 'Missing required parameters: agent, profileId' });
    }
    const agentObj = typeof agent === 'string' ? JSON.parse(agent) : agent;
    const result = await xapiLRS.deleteAgentProfile(agentObj, profileId);
    res.status(result.status).send();
  } catch (error) {
    console.error('[xAPI] Error deleting agent profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// User Progress API Routes
// ============================================================================

// GET /api/users/:userId/courses - Get user's course progress
app.get('/api/users/:userId/courses', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = verifyAuth(req);
    
    // Users can only view their own progress (unless admin)
    // Normalize userId: if numeric, use email; if email, use as-is
    const normalizedUserId = userId.includes('@') ? userId : user.email || userId;
    const currentUserEmail = user.email;
    if (!user || (currentUserEmail !== normalizedUserId && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Use email for progress lookup (more consistent than numeric IDs)
    const progressUserId = normalizedUserId.includes('@') ? normalizedUserId : currentUserEmail || normalizedUserId;
    const progressList = await progressStorage.getUserProgress(progressUserId);
    
    // Enrich with course details
    const coursesWithProgress = await Promise.all(
      progressList.map(async (progress) => {
        try {
          const course = await coursesStorage.getCourseById(progress.courseId);
          if (!course) return null;
          
          // Sync progress from xAPI statements if available
          if (course.activityId) {
            try {
              console.log(`[Progress] Syncing progress for ${progressUserId} / ${progress.courseId} / ${course.activityId}`);
              const syncedProgress = await progressStorage.syncProgressFromStatements(
                progressUserId, 
                progress.courseId, 
                course.activityId
              );
              // Use synced progress if available
              if (syncedProgress) {
                progress = syncedProgress;
                console.log(`[Progress] ✅ Synced: status=${progress.completionStatus}, timeSpent=${progress.timeSpent}s, score=${progress.score}, progressPercent=${progress.progressPercent}`);
              } else {
                console.log(`[Progress] ⚠️ Sync returned null, using existing progress`);
              }
            } catch (syncError) {
              console.error('[Progress] ❌ Sync error:', syncError);
            }
          }
          
          // Use progressPercent from database (synced or existing), fallback to calculation
          let progressPercent = progress.progressPercent;
          if (progressPercent === undefined || progressPercent === null) {
            // Fallback calculation if not in database
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
            progressPercent: progressPercent, // Use from database
            timeSpent: progress.timeSpent || 0, // in seconds
            attempts: progress.attempts || 0,
            enrolledAt: progress.enrolledAt,
            startedAt: progress.startedAt,
            completedAt: progress.completedAt,
            lastAccessedAt: progress.lastAccessedAt
          };
        } catch (error) {
          console.error(`[Progress] Error enriching course ${progress.courseId}:`, error);
          return null;
        }
      })
    );
    
    // Filter out nulls
    const validCourses = coursesWithProgress.filter(c => c !== null);
    
    res.json(validCourses);
  } catch (error) {
    console.error('[Progress] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/:userId/courses/:courseId/enroll - Enroll user in course
app.post('/api/users/:userId/courses/:courseId/enroll', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const user = verifyAuth(req);
    
    // Normalize userId: use email if userId is numeric
    const normalizedUserId = userId.includes('@') ? userId : user.email || userId;
    const currentUserEmail = user.email;
    if (!user || (currentUserEmail !== normalizedUserId && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Verify course exists
    const course = await coursesStorage.getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Use email for progress (more consistent than numeric IDs)
    const progressUserId = normalizedUserId.includes('@') ? normalizedUserId : currentUserEmail || normalizedUserId;
    // Create or update enrollment
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
  } catch (error) {
    console.error('[Progress] Enrollment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Admin API Routes
// ============================================================================

// Middleware to check if user is admin
function requireAdmin(req) {
  const user = verifyAuth(req);
  if (!user) {
    throw new Error('Authentication required');
  }
  if (user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return user;
}

// GET /api/admin/courses - Get all courses (admin view)
app.get('/api/admin/courses', async (req, res) => {
  try {
    requireAdmin(req);
    const courses = await coursesStorage.getAllCourses();
    
    // Calculate stats from progress data
    const allProgress = await progressStorage.getAllProgress();
    const coursesWithStats = courses.map(course => {
      const courseProgress = allProgress.filter(p => p.courseId === course.courseId);
      const enrollmentCount = courseProgress.filter(p => p.enrollmentStatus === 'enrolled' || p.enrollmentStatus === 'in_progress').length;
      const attemptCount = courseProgress.reduce((sum, p) => sum + (p.attempts || 0), 0);
      
      return {
        ...course,
        enrollmentCount,
        attemptCount
      };
    });
    
    res.json(coursesWithStats);
  } catch (error) {
    const status = error.message.includes('Admin') ? 403 : error.message.includes('Authentication') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// GET /api/admin/extract-activity-id - Extract activity ID from tincan.xml
app.get('/api/admin/extract-activity-id', async (req, res) => {
  try {
    requireAdmin(req);
    const { coursePath } = req.query;
    
    if (!coursePath) {
      return res.status(400).json({ error: 'coursePath query parameter is required' });
    }
    
    // Try to get tincan.xml from blob storage
    const tincanPath = `${coursePath}/tincan.xml`.replace(/\/+/g, '/');
    
    try {
      const xmlContent = await blobStorage.getBlobBuffer(tincanPath);
      const xmlString = xmlContent.toString('utf-8');
      const activityId = await extractActivityIdFromXml(xmlString);
      
      res.json({ 
        activityId,
        coursePath,
        tincanPath 
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: `tincan.xml not found at ${tincanPath}. Make sure course files are uploaded to blob storage.` });
      }
      throw error;
    }
  } catch (error) {
    const status = error.message.includes('Admin') ? 403 : error.message.includes('Authentication') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// GET /api/admin/find-thumbnail - Find thumbnail image in course folder
app.get('/api/admin/find-thumbnail', async (req, res) => {
  try {
    requireAdmin(req);
    const { coursePath } = req.query;
    
    if (!coursePath) {
      return res.status(400).json({ error: 'coursePath query parameter is required' });
    }
    
    // Common thumbnail file names and locations to search
    const thumbnailPatterns = [
      'mobile/poster.jpg',
      'mobile/poster.png',
      'mobile/poster.webp',
      'mobile/poster_*.jpg',
      'poster.jpg',
      'poster.png',
      'poster.webp',
      'thumbnail.jpg',
      'thumbnail.png',
      'thumbnail.webp',
      'thumb.jpg',
      'thumb.png'
    ];
    
    try {
      // List all files in the course folder
      const allBlobs = await blobStorage.listBlobs(coursePath);
      
      // Search for thumbnail files (case-insensitive)
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
      const foundThumbnails = [];
      
      for (const blob of allBlobs) {
        const blobName = blob.name.toLowerCase();
        const blobPath = blob.name;
        const fileName = blobPath.split('/').pop().toLowerCase();
        
        // Check if it's an image file
        const isImage = imageExtensions.some(ext => blobName.endsWith(ext));
        
        if (isImage) {
          // Check if filename contains common thumbnail keywords
          const isThumbnail = fileName.includes('poster') || 
                             fileName.includes('thumbnail') || 
                             fileName.includes('thumb') ||
                             (blobName.includes('mobile') && fileName.includes('poster'));
          
          if (isThumbnail) {
            foundThumbnails.push({
              path: `/course/${blobPath}`,
              name: blobPath.split('/').pop(),
              size: blob.size
            });
          }
        }
      }
      
      // Sort by priority: prefer thumbnail.jpg first, then mobile/poster.jpg, then other poster files
      foundThumbnails.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aPath = a.path.toLowerCase();
        const bPath = b.path.toLowerCase();
        
        // Priority 0: thumbnail.jpg (exact match)
        const aPriority = aName === 'thumbnail.jpg' ? 0 :
                          aName === 'thumbnail.png' ? 0 :
                          aName === 'thumbnail.webp' ? 0 :
                          // Priority 1: mobile/poster.jpg
                          aPath.includes('mobile/poster') ? 1 :
                          // Priority 2: other poster files
                          aName.includes('poster') ? 2 :
                          // Priority 3: other thumbnail files
                          aName.includes('thumbnail') ? 3 : 4;
        
        const bPriority = bName === 'thumbnail.jpg' ? 0 :
                          bName === 'thumbnail.png' ? 0 :
                          bName === 'thumbnail.webp' ? 0 :
                          bPath.includes('mobile/poster') ? 1 :
                          bName.includes('poster') ? 2 :
                          bName.includes('thumbnail') ? 3 : 4;
        
        return aPriority - bPriority;
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
          message: 'No thumbnail images found. Common locations: thumbnail.jpg, mobile/poster.jpg, poster.jpg',
          coursePath 
        });
      }
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: `Course folder not found: ${coursePath}. Make sure course files are uploaded to blob storage.` });
      }
      throw error;
    }
  } catch (error) {
    const status = error.message.includes('Admin') ? 403 : error.message.includes('Authentication') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// POST /api/admin/courses - Create new course
app.post('/api/admin/courses', async (req, res) => {
  try {
    requireAdmin(req);
    const { title, description, thumbnailUrl, activityId, launchFile, coursePath } = req.body;
    
    if (!title || !activityId || !launchFile) {
      return res.status(400).json({ error: 'Title, activityId, and launchFile are required' });
    }

    // Generate course ID from title
    const courseId = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    // Check if course already exists
    const existing = await coursesStorage.getCourseById(courseId);
    if (existing) {
      return res.status(400).json({ error: 'Course with this title already exists' });
    }

    const newCourse = {
      courseId,
      title,
      description: description || '',
      thumbnailUrl: thumbnailUrl || '/course/mobile/poster.jpg',
      activityId,
      launchFile,
      // Default to empty string (root level) if coursePath not provided
      // Files are typically uploaded to root level in blob storage
      coursePath: coursePath || '',
      modules: []
    };

    await coursesStorage.saveCourse(newCourse);
    
    console.log(`[Admin] Course created: ${courseId} - ${title}`);
    res.status(201).json(newCourse);
  } catch (error) {
    const status = error.message.includes('Admin') ? 403 : error.message.includes('Authentication') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// PUT /api/admin/courses/:courseId - Update course
app.put('/api/admin/courses/:courseId', async (req, res) => {
  try {
    requireAdmin(req);
    const { courseId } = req.params;
    const existing = await coursesStorage.getCourseById(courseId);
    
    if (!existing) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const updates = req.body;
    const updatedCourse = {
      ...existing,
      ...updates,
      courseId: existing.courseId, // Don't allow changing courseId
      updatedAt: new Date().toISOString()
    };

    await coursesStorage.saveCourse(updatedCourse);
    
    console.log(`[Admin] Course updated: ${courseId}`);
    res.json(updatedCourse);
  } catch (error) {
    const status = error.message.includes('Admin') ? 403 : error.message.includes('Authentication') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// DELETE /api/admin/courses/:courseId - Delete course
app.delete('/api/admin/courses/:courseId', async (req, res) => {
  try {
    requireAdmin(req);
    const { courseId } = req.params;
    const existing = await coursesStorage.getCourseById(courseId);
    
    if (!existing) {
      return res.status(404).json({ error: 'Course not found' });
    }

    await coursesStorage.deleteCourse(courseId);
    console.log(`[Admin] Course deleted: ${courseId}`);
    res.status(204).send();
  } catch (error) {
    const status = error.message.includes('Admin') ? 403 : error.message.includes('Authentication') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// GET /api/admin/progress - Get learner progress (admin view)
app.get('/api/admin/progress', async (req, res) => {
  try {
    requireAdmin(req);
    
    // Get all progress
    const allProgress = await progressStorage.getAllProgress();
    
    // Enrich with course and user details
    const enrichedProgress = await Promise.all(
      allProgress.map(async (progress) => {
        try {
          const course = await coursesStorage.getCourseById(progress.courseId);
          if (!course) return null;
          
          // Get user details from auth system
          // Progress.userId should be email (after migration), but handle both cases for backward compatibility
          let userEmail = null;
          let firstName = null;
          let lastName = null;
          
          if (progress.userId.includes('@')) {
            // userId is already an email - use it and try to get user details
            userEmail = progress.userId;
            try {
              const allUsers = await auth.getAllUsers();
              const user = allUsers.find(u => u.email === userEmail);
              if (user) {
                const nameParts = (user.name || '').split(' ');
                firstName = nameParts[0] || null;
                lastName = nameParts.slice(1).join(' ') || null;
              } else {
                // User not found in auth system, extract from email
                const emailParts = userEmail.split('@')[0];
                firstName = emailParts || null;
              }
            } catch (error) {
              // If lookup fails, extract from email
              const emailParts = userEmail.split('@')[0];
              firstName = emailParts || null;
            }
          } else {
            // userId is numeric (old data) - try to get user by ID and use their email
            try {
              const user = await auth.getUserById(progress.userId);
              if (user) {
                userEmail = user.email;
                const nameParts = (user.name || '').split(' ');
                firstName = nameParts[0] || null;
                lastName = nameParts.slice(1).join(' ') || null;
              } else {
                // Fallback: generate email from userId (for old data)
                userEmail = `${progress.userId}@example.com`;
                firstName = progress.userId;
              }
            } catch (error) {
              // Fallback: generate email from userId (for old data)
              userEmail = `${progress.userId}@example.com`;
              firstName = progress.userId;
            }
          }
          
          // Calculate progress percentage
          // Priority: 1) Use progressPercent from database, 2) Check completion status/date, 3) Use score, 4) Default to 0
          let progressPercent = 0;
          if (progress.progressPercent !== undefined && progress.progressPercent !== null) {
            // Use progressPercent from database if available
            progressPercent = Number(progress.progressPercent);
          } else if (progress.completionStatus === 'completed' || progress.completionStatus === 'passed' || progress.completedAt) {
            // If completed (by status or date), show 100%
            progressPercent = 100;
          } else if (progress.completionStatus === 'in_progress' && progress.score !== undefined && progress.score !== null) {
            // If in progress, use score if available
            progressPercent = Number(progress.score);
          } else if (progress.score !== undefined && progress.score !== null) {
            // Fallback to score if available
            progressPercent = Number(progress.score);
          }
          
          // Infer startedAt if missing but course has been started
          let startedAt = progress.startedAt;
          if (!startedAt) {
            const hasProgress = (progressPercent > 0) || 
                               (progress.timeSpent && progress.timeSpent > 0) ||
                               (progress.completionStatus && progress.completionStatus !== 'not_started');
            if (hasProgress && progress.enrolledAt) {
              // Use enrolledAt as a reasonable approximation for when the course was started
              startedAt = progress.enrolledAt;
            }
          }
          
          return {
            userId: progress.userId,
            email: userEmail,
            firstName: firstName,
            lastName: lastName,
            courseId: course.courseId,
            courseTitle: course.title,
            enrollmentStatus: progress.enrollmentStatus,
            completionStatus: progress.completionStatus,
            score: progress.score,
            progressPercent: progressPercent,
            timeSpent: progress.timeSpent || 0, // in seconds (frontend can convert)
            attempts: progress.attempts || 0,
            enrolledAt: progress.enrolledAt,
            startedAt: startedAt,
            completedAt: progress.completedAt,
            lastAccessedAt: progress.lastAccessedAt
          };
        } catch (error) {
          console.error(`[Admin Progress] Error enriching progress:`, error);
          return null;
        }
      })
    );
    
    // Filter out nulls and sort by last accessed
    const validProgress = enrichedProgress
      .filter(p => p !== null)
      .sort((a, b) => {
        const aTime = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
        const bTime = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
        return bTime - aTime;
      });
    
    res.json(validProgress);
  } catch (error) {
    const status = error.message.includes('Admin') ? 403 : error.message.includes('Authentication') ? 401 : 500;
    res.status(status).json({ error: error.message });
  }
});

// ============================================================================
// Start Server
// ============================================================================

// Initialize Azure Storage (Tables + Blob) before starting server
Promise.all([
  initializeTables().catch(err => ({ error: err })),
  blobStorage.initializeBlobStorage().catch(err => ({ error: err }))
])
  .then(async ([tablesResult, blobResult]) => {
    const tablesOk = !tablesResult.error;
    const blobOk = !blobResult.error;
    
    if (tablesResult.error) {
      console.error('❌ Failed to initialize Azure Tables:', tablesResult.error.message);
    }
    if (blobResult.error) {
      console.error('❌ Failed to initialize Azure Blob Storage:', blobResult.error.message);
    }
    
    if (tablesOk) {
      // Initialize default course if it doesn't exist
      await coursesStorage.initializeDefaultCourse();
    }
    
    if (tablesOk && blobOk) {
      startServer('Azure Storage (Tables + Blob) - Production-ready for 15K+ users');
    } else if (tablesOk) {
      startServer('⚠️  Azure Tables OK, Blob Storage not configured - course files may not work');
    } else if (blobOk) {
      startServer('⚠️  Blob Storage OK, Azure Tables not configured - xAPI may not work');
    } else {
      console.error('⚠️  Make sure AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY are set in .env');
      startServer('⚠️  Azure Storage not configured - features may not work');
    }
  });

function startServer(storageInfo) {
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Storyline LMS Backend running on http://localhost:${PORT}`);
    console.log(`📚 Course files served from: /course`);
    console.log(`🔐 Auth endpoints: /api/auth/*`);
    console.log(`📊 xAPI LRS endpoint: ${BASE_URL}/xapi`);
    console.log(`🎯 Launch course: ${BASE_URL}/launch?token=YOUR_TOKEN`);
    console.log(`💾 Storage: ${storageInfo}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use!`);
      console.error(`\n💡 Solutions:`);
      console.error(`   1. Kill the process using port ${PORT}:`);
      console.error(`      Windows: netstat -ano | findstr :${PORT} then taskkill /PID <PID> /F`);
      console.error(`      Linux/Mac: lsof -ti:${PORT} | xargs kill -9`);
      console.error(`   2. Use a different port by setting PORT environment variable:`);
      console.error(`      PORT=3001 npm run dev`);
      console.error(`   3. Check if another instance is running and stop it`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

