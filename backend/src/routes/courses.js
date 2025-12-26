import express from 'express';
import { getPool, sql } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { getLearnerProgress } from '../services/progressService.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// Get all courses (with enrollment status for authenticated users)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    const userId = req.user.userId;

    // Get all courses with enrollment status
    const result = await request
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          c.courseId,
          c.title,
          c.description,
          c.thumbnailUrl,
          c.activityId,
          c.createdAt,
          CASE 
            WHEN e.enrollmentId IS NOT NULL THEN 1 
            ELSE 0 
          END AS isEnrolled,
          e.status AS enrollmentStatus,
          e.enrolledAt
        FROM Courses c
        LEFT JOIN Enrollments e ON c.courseId = e.courseId AND e.userId = @userId
        ORDER BY c.createdAt DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});

// Get course details
router.get('/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const pool = await getPool();
    const request = pool.request();

    const result = await request
      .input('courseId', sql.UniqueIdentifier, courseId)
      .query(`
        SELECT 
          courseId,
          title,
          description,
          thumbnailUrl,
          launchFile,
          activityId,
          blobPath,
          createdAt,
          updatedAt
        FROM Courses
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

// Launch course (create attempt and return launch URL)
router.post('/:courseId/launch', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.userId;
    const pool = await getPool();
    const request = pool.request();

    // Get course details
    const courseResult = await request
      .input('courseId', sql.UniqueIdentifier, courseId)
      .query('SELECT * FROM Courses WHERE courseId = @courseId');

    if (courseResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.recordset[0];

    // Check if user is enrolled, if not, auto-enroll
    const enrollmentCheck = await request
      .input('userId', sql.UniqueIdentifier, userId)
      .input('courseId', sql.UniqueIdentifier, courseId)
      .query(`
        SELECT enrollmentId FROM Enrollments 
        WHERE userId = @userId AND courseId = @courseId
      `);

    if (enrollmentCheck.recordset.length === 0) {
      // Auto-enroll user
      await request
        .input('userId', sql.UniqueIdentifier, userId)
        .input('courseId', sql.UniqueIdentifier, courseId)
        .query(`
          INSERT INTO Enrollments (userId, courseId)
          VALUES (@userId, @courseId)
        `);
    }

    // Generate registration UUID for xAPI
    const registrationId = randomUUID();

    // Create or update attempt
    const attemptResult = await request
      .input('userId', sql.UniqueIdentifier, userId)
      .input('courseId', sql.UniqueIdentifier, courseId)
      .input('registrationId', sql.UniqueIdentifier, registrationId)
      .query(`
        MERGE Attempts AS target
        USING (SELECT @userId AS userId, @courseId AS courseId) AS source
        ON target.userId = source.userId AND target.courseId = source.courseId
        WHEN MATCHED THEN
          UPDATE SET 
            lastAccessedAt = GETUTCDATE(),
            registrationId = @registrationId
        WHEN NOT MATCHED THEN
          INSERT (userId, courseId, registrationId)
          VALUES (@userId, @courseId, @registrationId)
        OUTPUT INSERTED.attemptId, INSERTED.registrationId;
      `);

    const attempt = attemptResult.recordset[0];

    // Construct launch URL
    const launchUrl = `/content/courses/${courseId}/xapi/${course.launchFile}`;

    res.json({
      course,
      attemptId: attempt.attemptId,
      registrationId: attempt.registrationId,
      launchUrl,
    });
  } catch (error) {
    next(error);
  }
});

// Get learner progress for a course
router.get('/:courseId/progress/:userId', authenticate, async (req, res, next) => {
  try {
    const { courseId, userId } = req.params;

    // Verify user can access this progress (own progress or admin)
    if (req.user.userId !== userId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pool = await getPool();
    const request = pool.request();

    // Get course activityId
    const courseResult = await request
      .input('courseId', sql.UniqueIdentifier, courseId)
      .query('SELECT activityId FROM Courses WHERE courseId = @courseId');

    if (courseResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const activityId = courseResult.recordset[0].activityId;

    // Get progress from LRS
    const progress = await getLearnerProgress(userId, activityId);

    // Get enrollment and attempt info from database
    const enrollmentResult = await request
      .input('userId', sql.UniqueIdentifier, userId)
      .input('courseId', sql.UniqueIdentifier, courseId)
      .query(`
        SELECT 
          e.status AS enrollmentStatus,
          e.enrolledAt,
          a.attemptId,
          a.startedAt,
          a.completedAt,
          a.lastAccessedAt,
          a.registrationId
        FROM Enrollments e
        LEFT JOIN Attempts a ON e.userId = a.userId AND e.courseId = a.courseId
        WHERE e.userId = @userId AND e.courseId = @courseId
      `);

    const enrollment = enrollmentResult.recordset[0] || {};

    res.json({
      ...progress,
      enrollment: {
        status: enrollment.enrollmentStatus,
        enrolledAt: enrollment.enrolledAt,
      },
      attempt: {
        attemptId: enrollment.attemptId,
        startedAt: enrollment.startedAt,
        completedAt: enrollment.completedAt,
        lastAccessedAt: enrollment.lastAccessedAt,
        registrationId: enrollment.registrationId,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;


