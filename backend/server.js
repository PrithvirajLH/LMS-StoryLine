/**
 * Storyline LMS Backend Server
 * Serves course files and provides xAPI LRS endpoints
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

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
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for course content
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Experience-API-Version']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    
    // Return courses with enrollment status if user is authenticated
    const coursesWithEnrollment = courses.map(course => ({
      courseId: course.courseId,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      isEnrolled: user ? true : false, // For now, all authenticated users are "enrolled"
      enrollmentStatus: user ? 'enrolled' : undefined,
      activityId: course.activityId
    }));

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
        await progressStorage.updateProgress(userEmail, courseId, {
          enrollmentStatus: 'enrolled',
          completionStatus: 'in_progress'
        });
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

    res.json({
      course: {
        courseId: course.courseId,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        activityId: course.activityId,
        isEnrolled: true,
        enrollmentStatus: 'enrolled'
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
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await auth.register(email, password, name);
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
    const fullPath = req.path; // e.g., "/course/index_lms.html"
    const filePath = fullPath.replace(/^\/course\//, '') || 'index_lms.html';
    
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

    // Get blob stream from Azure
    const stream = await blobStorage.getBlobStream(filePath);
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
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
      return res.status(404).json({ error: 'File not found' });
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

// POST /xapi/statements - Store statement(s)
app.post('/xapi/statements', async (req, res) => {
  try {
    const result = await xapiLRS.saveStatement(req.body);
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
    
    const result = await xapiLRS.saveStatement(statement);
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
    if (!activityId || !agent || !stateId) {
      return res.status(400).json({ error: 'Missing required parameters: activityId, agent, stateId' });
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
    
    const result = await xapiLRS.getState(activityId, agentObj, stateId, registration || null);
    if (result.status === 404) {
      // Return empty response for 404 (xAPI spec) - this is normal for first-time access
      return res.status(404).send();
    }
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error('[xAPI] Error getting state:', error);
    console.error('[xAPI] Request params:', { activityId: req.query.activityId, stateId: req.query.stateId });
    res.status(500).json({ error: error.message });
  }
});

// PUT /xapi/activities/state - Save activity state
app.put('/xapi/activities/state', async (req, res) => {
  try {
    const { activityId, agent, stateId, registration } = req.query;
    if (!activityId || !agent || !stateId) {
      return res.status(400).json({ error: 'Missing required parameters: activityId, agent, stateId' });
    }
    const agentObj = typeof agent === 'string' ? JSON.parse(agent) : agent;
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
              await progressStorage.syncProgressFromStatements(
                progressUserId, 
                progress.courseId, 
                course.activityId
              );
              // Re-fetch updated progress
              const updated = await progressStorage.getUserProgress(progressUserId);
              const updatedProgress = updated.find(p => p.courseId === progress.courseId);
              if (updatedProgress) {
                progress = updatedProgress;
              }
            } catch (syncError) {
              console.error('[Progress] Sync error:', syncError);
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
            timeSpent: progress.timeSpent ? `${Math.floor(progress.timeSpent / 3600)} hours` : undefined,
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
    
    // Add stats (TODO: Calculate from enrollments/attempts)
    const coursesWithStats = courses.map(course => ({
      ...course,
      enrollmentCount: 0,
      attemptCount: 0
    }));
    
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
      // Use course title as folder name (sanitized)
      coursePath: coursePath || title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50),
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
            timeSpent: progress.timeSpent ? Math.floor(progress.timeSpent / 3600) : 0, // hours
            enrolledAt: progress.enrolledAt,
            startedAt: progress.startedAt,
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
  app.listen(PORT, () => {
    console.log(`\n🚀 Storyline LMS Backend running on http://localhost:${PORT}`);
    console.log(`📚 Course files served from: /course`);
    console.log(`🔐 Auth endpoints: /api/auth/*`);
    console.log(`📊 xAPI LRS endpoint: ${BASE_URL}/xapi`);
    console.log(`🎯 Launch course: ${BASE_URL}/launch?token=YOUR_TOKEN`);
    console.log(`💾 Storage: ${storageInfo}\n`);
  });
}

