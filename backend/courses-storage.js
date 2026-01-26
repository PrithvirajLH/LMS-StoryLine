/**
 * Courses Storage using Azure Table Storage
 * Production-grade course management
 */

import { getTableClient, retryOperation, TABLES, sanitizeODataValue } from './azure-tables.js';
import { storageLogger as logger } from './logger.js';

// ============================================================================
// Course CRUD Operations
// ============================================================================

/**
 * Get all courses from Azure Tables
 */
export async function getAllCourses() {
  try {
    const client = getTableClient('COURSES');
    const courses = [];
    const courseIds = new Set(); // Track unique course IDs to prevent duplicates
    
    for await (const entity of client.listEntities()) {
      // Skip if we've already seen this courseId (duplicate across partitions)
      if (courseIds.has(entity.rowKey)) {
        logger.debug({ courseId: entity.rowKey }, 'Skipping duplicate course');
        continue;
      }
      
      courseIds.add(entity.rowKey);
      courses.push({
        courseId: entity.rowKey,
        title: entity.title,
        description: entity.description || '',
        thumbnailUrl: entity.thumbnailUrl || '',
        activityId: entity.activityId,
        launchFile: entity.launchFile,
        coursePath: entity.coursePath || `courses/${entity.rowKey}`,
        modules: entity.modules ? JSON.parse(entity.modules) : [],
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      });
    }
    
    return courses;
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting courses');
    return [];
  }
}

/**
 * Get course by ID
 */
export async function getCourseById(courseId) {
  if (!courseId) {
    return null;
  }
  
  try {
    const client = getTableClient('COURSES');
    let entity;
    
    // Try both partition keys for backward compatibility
    try {
      entity = await client.getEntity('course', courseId);
    } catch (error) {
      if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
        entity = await client.getEntity('courses', courseId);
      } else {
        throw error;
      }
    }
    
    return {
      courseId: entity.rowKey,
      title: entity.title,
      description: entity.description || '',
      thumbnailUrl: entity.thumbnailUrl || '',
      activityId: entity.activityId,
      launchFile: entity.launchFile,
      coursePath: entity.coursePath !== undefined ? entity.coursePath : `courses/${entity.rowKey}`,
      modules: entity.modules ? JSON.parse(entity.modules) : [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return null;
    }
    throw error;
  }
}

/**
 * Save course to Azure Tables
 */
export async function saveCourse(course) {
  if (!course?.courseId) {
    throw new Error('courseId is required');
  }
  
  const client = getTableClient('COURSES');
  
  // Check which partition key the course currently uses
  let partitionKey = 'courses';
  try {
    await client.getEntity('course', course.courseId);
    partitionKey = 'course';
  } catch (error) {
    try {
      await client.getEntity('courses', course.courseId);
      partitionKey = 'courses';
    } catch (e) {
      partitionKey = 'courses';
    }
  }
  
  const entity = {
    partitionKey: partitionKey,
    rowKey: course.courseId,
    title: course.title,
    description: course.description || '',
    thumbnailUrl: course.thumbnailUrl || '',
    activityId: course.activityId,
    launchFile: course.launchFile || 'index_lms.html',
    coursePath: course.coursePath !== undefined ? course.coursePath : `courses/${course.courseId}`,
    modules: JSON.stringify(course.modules || []),
    createdAt: course.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await retryOperation(() => client.upsertEntity(entity, 'Replace'));
  
  // Clean up from other partition if it exists there
  const otherPartition = partitionKey === 'course' ? 'courses' : 'course';
  try {
    await client.deleteEntity(otherPartition, course.courseId);
  } catch (e) {
    // Ignore if doesn't exist
  }
  
  logger.info({ courseId: course.courseId, title: course.title }, 'Course saved');
  return course;
}

/**
 * Delete course from Azure Tables
 */
export async function deleteCourse(courseId) {
  if (!courseId) {
    return false;
  }
  
  const client = getTableClient('COURSES');
  let deleted = false;
  
  // Delete from both partition keys to ensure complete removal
  for (const partitionKey of ['course', 'courses']) {
    try {
      await client.deleteEntity(partitionKey, courseId);
      deleted = true;
      logger.info({ courseId, partition: partitionKey }, 'Course deleted');
    } catch (error) {
      if (error.statusCode !== 404 && error.code !== 'ResourceNotFound') {
        throw error;
      }
    }
  }
  
  return deleted;
}

/**
 * Initialize Courses table (create if doesn't exist)
 */
export async function initializeCoursesTable() {
  try {
    const client = getTableClient('COURSES');
    await client.createTable();
    logger.info('Courses table created');
  } catch (error) {
    if (error.statusCode === 409 || error.code === 'TableAlreadyExists') {
      return;
    }
    throw error;
  }
}

/**
 * Initialize default course (migration helper)
 */
export async function initializeDefaultCourse() {
  try {
    await initializeCoursesTable();
    
    const existing = await getCourseById('sharepoint-navigation-101');
    if (existing) {
      return;
    }

    await saveCourse({
      courseId: 'sharepoint-navigation-101',
      title: 'SharePoint Navigation 101 - Custom',
      description: 'Learn how to navigate SharePoint effectively',
      thumbnailUrl: '/course/mobile/poster.jpg',
      activityId: 'urn:articulate:storyline:5Ujw93Dh98n',
      launchFile: 'index_lms.html',
      coursePath: 'xapi',
      modules: [
        { id: '6Wh6oKMtG1B', name: 'Intro Slide' },
        { id: '5rY0DVu2ASj', name: 'Navigation' },
        { id: '64Z7kJPhm6X', name: 'Menu Slide' },
        { id: '5w6GAdJvlax', name: 'Homepage Overview' },
        { id: '6FaQWNPQAo6', name: 'Departments & Tech page' },
        { id: '6BnvowJ1urM', name: 'Search Bar' },
        { id: '6nB4Hr8SvQg', name: 'Quicklinks' },
        { id: '6Kqe4RNidSn', name: 'Troubleshoot' }
      ]
    });
    
    logger.info('Default course initialized');
  } catch (error) {
    logger.error({ error: error.message }, 'Error initializing default course');
  }
}
