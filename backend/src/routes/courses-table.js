import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getLearnerProgress } from '../services/progressService.js';
import { 
  getAllCourses, 
  getCourseById, 
  createEnrollment, 
  getEnrollment,
  createOrUpdateAttempt,
  getAttempt
} from '../services/tableService.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// Get all courses (with enrollment status for authenticated users)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const courses = await getAllCourses();
    
    // Get enrollment status for each course
    const coursesWithEnrollment = await Promise.all(
      courses.map(async (course) => {
        const enrollment = await getEnrollment(userId, course.courseId);
        return {
          courseId: course.courseId,
          title: course.title,
          description: course.description,
          thumbnailUrl: course.thumbnailUrl,
          activityId: course.activityId,
          createdAt: course.createdAt,
          isEnrolled: !!enrollment,
          enrollmentStatus: enrollment?.status || null,
          enrolledAt: enrollment?.enrolledAt || null,
        };
      })
    );
    
    // Sort by createdAt descending
    coursesWithEnrollment.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    res.json(coursesWithEnrollment);
  } catch (error) {
    next(error);
  }
});

// Get course details
router.get('/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await getCourseById(courseId);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    res.json(course);
  } catch (error) {
    next(error);
  }
});

// Launch course (create attempt and return launch URL)
router.post('/:courseId/launch', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.userId;
    
    // Get course details
    const course = await getCourseById(courseId);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check if user is enrolled, if not, auto-enroll
    let enrollment = await getEnrollment(userId, courseId);
    if (!enrollment) {
      enrollment = await createEnrollment(userId, courseId);
    }
    
    // Generate registration UUID for xAPI
    const registrationId = randomUUID();
    
    // Create or update attempt
    const attempt = await createOrUpdateAttempt(userId, courseId, registrationId);
    
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
    
    // Get course activityId
    const course = await getCourseById(courseId);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const activityId = course.activityId;
    
    // Get progress from LRS
    const progress = await getLearnerProgress(userId, activityId);
    
    // Get enrollment and attempt info
    const enrollment = await getEnrollment(userId, courseId);
    const attempt = await getAttempt(userId, courseId);
    
    res.json({
      ...progress,
      enrollment: enrollment ? {
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
      } : null,
      attempt: attempt ? {
        attemptId: attempt.attemptId,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        lastAccessedAt: attempt.lastAccessedAt,
        registrationId: attempt.registrationId,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

