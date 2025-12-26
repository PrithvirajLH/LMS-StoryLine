import express from 'express';
import { getPool, sql } from '../config/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// All routes require admin access
router.use(authenticate);
router.use(requireAdmin);

// Create new course
router.post('/courses', async (req, res, next) => {
  try {
    const { title, description, thumbnailUrl, launchFile, activityId, blobPath } = req.body;

    if (!title || !activityId || !blobPath) {
      return res.status(400).json({
        error: 'Title, activityId, and blobPath are required',
      });
    }

    const pool = await getPool();
    const request = pool.request();

    const result = await request
      .input('title', sql.NVarChar, title)
      .input('description', sql.NVarChar, description || null)
      .input('thumbnailUrl', sql.NVarChar, thumbnailUrl || null)
      .input('launchFile', sql.NVarChar, launchFile || 'index.html')
      .input('activityId', sql.NVarChar, activityId)
      .input('blobPath', sql.NVarChar, blobPath)
      .query(`
        INSERT INTO Courses (title, description, thumbnailUrl, launchFile, activityId, blobPath)
        OUTPUT INSERTED.*
        VALUES (@title, @description, @thumbnailUrl, @launchFile, @activityId, @blobPath)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    next(error);
  }
});

// Get all courses (admin view)
router.get('/courses', async (req, res, next) => {
  try {
    const pool = await getPool();
    const request = pool.request();

    const result = await request.query(`
      SELECT 
        c.*,
        COUNT(DISTINCT e.userId) AS enrollmentCount,
        COUNT(DISTINCT a.attemptId) AS attemptCount
      FROM Courses c
      LEFT JOIN Enrollments e ON c.courseId = e.courseId
      LEFT JOIN Attempts a ON c.courseId = a.courseId
      GROUP BY 
        c.courseId, c.title, c.description, c.thumbnailUrl, 
        c.launchFile, c.activityId, c.blobPath, c.createdAt, c.updatedAt
      ORDER BY c.createdAt DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});

// Update course
router.put('/courses/:courseId', async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, description, thumbnailUrl, launchFile, activityId, blobPath } = req.body;

    const pool = await getPool();
    const request = pool.request();

    const updates = [];
    const inputs = { courseId: sql.UniqueIdentifier };

    if (title !== undefined) {
      updates.push('title = @title');
      request.input('title', sql.NVarChar, title);
    }
    if (description !== undefined) {
      updates.push('description = @description');
      request.input('description', sql.NVarChar, description);
    }
    if (thumbnailUrl !== undefined) {
      updates.push('thumbnailUrl = @thumbnailUrl');
      request.input('thumbnailUrl', sql.NVarChar, thumbnailUrl);
    }
    if (launchFile !== undefined) {
      updates.push('launchFile = @launchFile');
      request.input('launchFile', sql.NVarChar, launchFile);
    }
    if (activityId !== undefined) {
      updates.push('activityId = @activityId');
      request.input('activityId', sql.NVarChar, activityId);
    }
    if (blobPath !== undefined) {
      updates.push('blobPath = @blobPath');
      request.input('blobPath', sql.NVarChar, blobPath);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updatedAt = GETUTCDATE()');
    request.input('courseId', sql.UniqueIdentifier, courseId);

    const result = await request.query(`
      UPDATE Courses
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE courseId = @courseId
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    next(error);
  }
});

// Delete course
router.delete('/courses/:courseId', async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const pool = await getPool();
    const request = pool.request();

    const result = await request
      .input('courseId', sql.UniqueIdentifier, courseId)
      .query('DELETE FROM Courses WHERE courseId = @courseId');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get all learner progress
router.get('/progress', async (req, res, next) => {
  try {
    const pool = await getPool();
    const request = pool.request();

    const result = await request.query(`
      SELECT 
        u.userId,
        u.email,
        u.firstName,
        u.lastName,
        c.courseId,
        c.title AS courseTitle,
        e.enrolledAt,
        e.status AS enrollmentStatus,
        a.startedAt,
        a.completedAt,
        a.lastAccessedAt,
        a.registrationId
      FROM Enrollments e
      INNER JOIN Users u ON e.userId = u.userId
      INNER JOIN Courses c ON e.courseId = c.courseId
      LEFT JOIN Attempts a ON e.userId = a.userId AND e.courseId = a.courseId
      ORDER BY e.enrolledAt DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});

// Get LRS configuration (read-only, for display)
router.get('/lrs-config', async (req, res) => {
  // Return configuration status without exposing secrets
  res.json({
    endpoint: process.env.LRS_ENDPOINT ? 'configured' : 'not configured',
    key: process.env.LRS_KEY ? 'configured' : 'not configured',
    secret: process.env.LRS_SECRET ? 'configured' : 'not configured',
  });
});

export default router;


