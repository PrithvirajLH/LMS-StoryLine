/**
 * Courses Storage using Azure Table Storage
 * Production-grade course management
 */

import { getTableClient, retryOperation, TABLES } from './azure-tables.js';

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
        console.log(`[Courses Storage] Skipping duplicate course: ${entity.rowKey} (partition: ${entity.partitionKey})`);
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
    console.error('[Courses Storage] Error getting courses:', error);
    // If table doesn't exist or error, return empty array
    return [];
  }
}

/**
 * Get course by ID
 */
export async function getCourseById(courseId) {
  try {
    const client = getTableClient('COURSES');
    // Try both partition keys for backward compatibility
    let entity;
    try {
      entity = await client.getEntity('course', courseId);
    } catch (error) {
      // Fallback to 'courses' partition key if 'course' doesn't exist
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
  const client = getTableClient('COURSES');
  
  // Check which partition key the course currently uses
  let partitionKey = 'courses';
  try {
    await client.getEntity('course', course.courseId);
    partitionKey = 'course'; // Course exists in 'course' partition
  } catch (error) {
    // Course doesn't exist in 'course' partition, check 'courses'
    try {
      await client.getEntity('courses', course.courseId);
      partitionKey = 'courses'; // Course exists in 'courses' partition
    } catch (e) {
      // Course doesn't exist, use 'courses' as default
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
  
  // Also delete from the other partition if it exists there (migration)
  if (partitionKey === 'course') {
    try {
      await client.deleteEntity('courses', course.courseId);
    } catch (e) {
      // Ignore if doesn't exist
    }
  } else {
    try {
      await client.deleteEntity('course', course.courseId);
    } catch (e) {
      // Ignore if doesn't exist
    }
  }
  
  console.log(`[Courses Storage] Course saved: ${course.courseId} - ${course.title} (partition: ${partitionKey})`);
  return course;
}

/**
 * Delete course from Azure Tables
 */
export async function deleteCourse(courseId) {
  const client = getTableClient('COURSES');
  
  let deleted = false;
  
  // Delete from both partition keys to ensure complete removal
  // (courses might exist in either partition due to migration)
  for (const partitionKey of ['course', 'courses']) {
    try {
      await client.deleteEntity(partitionKey, courseId);
      deleted = true;
      console.log(`[Courses Storage] Course deleted from '${partitionKey}' partition: ${courseId}`);
    } catch (error) {
      // Ignore 404 errors (course doesn't exist in this partition)
      if (error.statusCode !== 404 && error.code !== 'ResourceNotFound') {
        throw error;
      }
    }
  }
  
  if (deleted) {
    console.log(`[Courses Storage] Course deleted: ${courseId}`);
    return true;
  } else {
    // Course wasn't found in any partition
    return false;
  }
}

/**
 * Initialize Courses table (create if doesn't exist)
 */
export async function initializeCoursesTable() {
  try {
    const client = getTableClient('COURSES');
    await client.createTable();
    console.log('[Courses Storage] Courses table created');
  } catch (error) {
    if (error.statusCode === 409 || error.code === 'TableAlreadyExists') {
      // Table already exists - that's fine
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
    // Ensure table exists first
    await initializeCoursesTable();
    
    const existing = await getCourseById('sharepoint-navigation-101');
    if (existing) {
      return; // Already exists
    }

    // Create default course from tincan.xml
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
    
    console.log('[Courses Storage] Default course initialized');
  } catch (error) {
    console.error('[Courses Storage] Error initializing default course:', error);
    // Don't throw - allow server to start even if default course fails
  }
}

