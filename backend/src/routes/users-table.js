import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getLearnerProgress } from '../services/progressService.js';
import { 
  getUserById, 
  getUserEnrollments, 
  getCourseById,
  getAttempt
} from '../services/tableService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/me', async (req, res, next) => {
  try {
    const user = await getUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin || false,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
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
    
    // Get enrollments
    const enrollments = await getUserEnrollments(userId);
    
    // Get course details and progress for each enrollment
    const coursesWithProgress = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = await getCourseById(enrollment.courseId);
        const attempt = await getAttempt(userId, enrollment.courseId);
        const progress = course 
          ? await getLearnerProgress(userId, course.activityId)
          : { completionStatus: 'unknown', score: null, timeSpent: null };
        
        return {
          courseId: enrollment.courseId,
          title: course?.title || 'Unknown Course',
          description: course?.description,
          thumbnailUrl: course?.thumbnailUrl,
          activityId: course?.activityId,
          enrolledAt: enrollment.enrolledAt,
          enrollmentStatus: enrollment.status,
          startedAt: attempt?.startedAt,
          completedAt: attempt?.completedAt,
          lastAccessedAt: attempt?.lastAccessedAt,
          completionStatus: progress.completionStatus,
          score: progress.score,
          timeSpent: progress.timeSpent,
        };
      })
    );
    
    // Sort by enrolledAt descending
    coursesWithProgress.sort((a, b) => 
      new Date(b.enrolledAt) - new Date(a.enrolledAt)
    );
    
    res.json(coursesWithProgress);
  } catch (error) {
    next(error);
  }
});

export default router;

