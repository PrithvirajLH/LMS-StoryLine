import express from 'express';
import { getPool, sql } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { getLearnerProgress } from '../services/progressService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/me', async (req, res, next) => {
  try {
    const pool = await getPool();
    const request = pool.request();

    const result = await request
      .input('userId', sql.UniqueIdentifier, req.user.userId)
      .query(`
        SELECT 
          userId,
          email,
          firstName,
          lastName,
          isAdmin,
          createdAt,
          lastLoginAt
        FROM Users
        WHERE userId = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    next(error);
  }
});

// Get enrolled courses for a user
router.get('/:userId/courses', async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Users can only view their own courses unless they're admin
    if (req.user.userId !== userId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pool = await getPool();
    const request = pool.request();

    // Get enrolled courses
    const result = await request
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          c.courseId,
          c.title,
          c.description,
          c.thumbnailUrl,
          c.activityId,
          e.enrolledAt,
          e.status AS enrollmentStatus,
          a.startedAt,
          a.completedAt,
          a.lastAccessedAt
        FROM Enrollments e
        INNER JOIN Courses c ON e.courseId = c.courseId
        LEFT JOIN Attempts a ON e.userId = a.userId AND e.courseId = a.courseId
        WHERE e.userId = @userId
        ORDER BY e.enrolledAt DESC
      `);

    // Get progress for each course from LRS
    const coursesWithProgress = await Promise.all(
      result.recordset.map(async (course) => {
        const progress = await getLearnerProgress(userId, course.activityId);
        return {
          ...course,
          completionStatus: progress.completionStatus,
          score: progress.score,
          timeSpent: progress.timeSpent,
        };
      })
    );

    res.json(coursesWithProgress);
  } catch (error) {
    next(error);
  }
});

export default router;


