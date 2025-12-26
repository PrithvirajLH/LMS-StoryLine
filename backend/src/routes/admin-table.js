import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { 
  createCourse, 
  getAllCourses, 
  getCourseById, 
  updateCourse, 
  deleteCourse,
  getUserEnrollments,
  getCourseEnrollments,
  getCourseAttempts,
  getAttempt,
  getUserById
} from '../services/tableService.js';

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
    
    const course = await createCourse({
      title,
      description,
      thumbnailUrl,
      launchFile,
      activityId,
      blobPath,
    });
    
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
});

// Get all courses (admin view)
router.get('/courses', async (req, res, next) => {
  try {
    const courses = await getAllCourses();
    
    // Get enrollment and attempt counts for each course
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        const enrollments = await getCourseEnrollments(course.courseId);
        const attempts = await getCourseAttempts(course.courseId);
        
        return {
          ...course,
          enrollmentCount: enrollments.length,
          attemptCount: attempts.length,
        };
      })
    );
    
    // Sort by createdAt descending
    coursesWithStats.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    res.json(coursesWithStats);
  } catch (error) {
    next(error);
  }
});

// Update course
router.put('/courses/:courseId', async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const updates = req.body;
    
    // Remove undefined values
    Object.keys(updates).forEach(key => 
      updates[key] === undefined && delete updates[key]
    );
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const course = await updateCourse(courseId, updates);
    res.json(course);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'Course not found' });
    }
    next(error);
  }
});

// Delete course
router.delete('/courses/:courseId', async (req, res, next) => {
  try {
    const { courseId } = req.params;
    await deleteCourse(courseId);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'Course not found' });
    }
    next(error);
  }
});

// Get all learner progress
router.get('/progress', async (req, res, next) => {
  try {
    const allCourses = await getAllCourses();
    const allEnrollments = [];
    
    // Get all enrollments for all courses
    for (const course of allCourses) {
      const enrollments = await getCourseEnrollments(course.courseId);
      for (const enrollment of enrollments) {
        const user = await getUserById(enrollment.userId);
        const attempt = await getAttempt(enrollment.userId, course.courseId);
        
        allEnrollments.push({
          userId: enrollment.userId,
          email: user?.email || 'Unknown',
          firstName: user?.firstName,
          lastName: user?.lastName,
          courseId: course.courseId,
          courseTitle: course.title,
          enrolledAt: enrollment.enrolledAt,
          enrollmentStatus: enrollment.status,
          startedAt: attempt?.startedAt,
          completedAt: attempt?.completedAt,
          lastAccessedAt: attempt?.lastAccessedAt,
          registrationId: attempt?.registrationId,
        });
      }
    }
    
    // Sort by enrolledAt descending
    allEnrollments.sort((a, b) => 
      new Date(b.enrolledAt) - new Date(a.enrolledAt)
    );
    
    res.json(allEnrollments);
  } catch (error) {
    next(error);
  }
});

// Get LRS configuration (read-only, for display)
router.get('/lrs-config', async (req, res) => {
  res.json({
    endpoint: process.env.LRS_ENDPOINT ? 'configured' : 'not configured',
    key: process.env.LRS_KEY ? 'configured' : 'not configured',
    secret: process.env.LRS_SECRET ? 'configured' : 'not configured',
  });
});

export default router;

