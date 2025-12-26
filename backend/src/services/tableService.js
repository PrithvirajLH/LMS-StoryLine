import { getTableClient, TABLES } from '../config/tableStorage.js';
import { randomUUID } from 'crypto';

// Helper to create entity with required Table Storage fields
function createEntity(partitionKey, rowKey, data) {
  return {
    partitionKey,
    rowKey,
    ...data,
  };
}

// User operations
export async function createUser(userData) {
  const client = getTableClient(TABLES.USERS);
  const userId = randomUUID();
  const entity = createEntity('user', userId, {
    userId,
    email: userData.email,
    passwordHash: userData.passwordHash,
    firstName: userData.firstName || null,
    lastName: userData.lastName || null,
    isAdmin: userData.isAdmin || false,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  });
  
  await client.createEntity(entity);
  return entity;
}

export async function getUserByEmail(email) {
  const client = getTableClient(TABLES.USERS);
  const entities = client.listEntities({
    queryOptions: { filter: `email eq '${email}'` }
  });
  
  for await (const entity of entities) {
    return entity;
  }
  return null;
}

export async function getUserById(userId) {
  const client = getTableClient(TABLES.USERS);
  try {
    return await client.getEntity('user', userId);
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

export async function updateUser(userId, updates) {
  const client = getTableClient(TABLES.USERS);
  const entity = await client.getEntity('user', userId);
  const updated = { ...entity, ...updates };
  await client.updateEntity(updated, 'Merge');
  return updated;
}

// Course operations
export async function createCourse(courseData) {
  const client = getTableClient(TABLES.COURSES);
  const courseId = randomUUID();
  const entity = createEntity('course', courseId, {
    courseId,
    title: courseData.title,
    description: courseData.description || null,
    thumbnailUrl: courseData.thumbnailUrl || null,
    launchFile: courseData.launchFile || 'index.html',
    activityId: courseData.activityId,
    blobPath: courseData.blobPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  await client.createEntity(entity);
  return entity;
}

export async function getCourseById(courseId) {
  const client = getTableClient(TABLES.COURSES);
  try {
    return await client.getEntity('course', courseId);
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

export async function getAllCourses() {
  const client = getTableClient(TABLES.COURSES);
  const courses = [];
  for await (const entity of client.listEntities()) {
    courses.push(entity);
  }
  return courses;
}

export async function updateCourse(courseId, updates) {
  const client = getTableClient(TABLES.COURSES);
  const entity = await client.getEntity('course', courseId);
  const updated = { ...entity, ...updates, updatedAt: new Date().toISOString() };
  await client.updateEntity(updated, 'Merge');
  return updated;
}

export async function deleteCourse(courseId) {
  const client = getTableClient(TABLES.COURSES);
  await client.deleteEntity('course', courseId);
}

// Enrollment operations
export async function createEnrollment(userId, courseId, status = 'enrolled') {
  const client = getTableClient(TABLES.ENROLLMENTS);
  const enrollmentId = randomUUID();
  const entity = createEntity(userId, courseId, {
    enrollmentId,
    userId,
    courseId,
    enrolledAt: new Date().toISOString(),
    status,
  });
  
  await client.createEntity(entity);
  return entity;
}

export async function getEnrollment(userId, courseId) {
  const client = getTableClient(TABLES.ENROLLMENTS);
  try {
    return await client.getEntity(userId, courseId);
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

export async function getUserEnrollments(userId) {
  const client = getTableClient(TABLES.ENROLLMENTS);
  const enrollments = [];
  for await (const entity of client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${userId}'` }
  })) {
    enrollments.push(entity);
  }
  return enrollments;
}

// Attempt operations
export async function createOrUpdateAttempt(userId, courseId, registrationId) {
  const client = getTableClient(TABLES.ATTEMPTS);
  const attemptId = randomUUID();
  const partitionKey = `${userId}_${courseId}`;
  
  try {
    // Try to get existing
    const existing = await client.getEntity(partitionKey, 'attempt');
    const updated = {
      ...existing,
      lastAccessedAt: new Date().toISOString(),
      registrationId,
    };
    await client.updateEntity(updated, 'Merge');
    return updated;
  } catch (error) {
    if (error.statusCode === 404) {
      // Create new
      const entity = createEntity(partitionKey, 'attempt', {
        attemptId,
        userId,
        courseId,
        startedAt: new Date().toISOString(),
        completedAt: null,
        lastAccessedAt: new Date().toISOString(),
        registrationId,
      });
      await client.createEntity(entity);
      return entity;
    }
    throw error;
  }
}

export async function getAttempt(userId, courseId) {
  const client = getTableClient(TABLES.ATTEMPTS);
  const partitionKey = `${userId}_${courseId}`;
  try {
    return await client.getEntity(partitionKey, 'attempt');
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

// Get all enrollments for a course
export async function getCourseEnrollments(courseId) {
  const client = getTableClient(TABLES.ENROLLMENTS);
  const enrollments = [];
  for await (const entity of client.listEntities({
    queryOptions: { filter: `RowKey eq '${courseId}'` }
  })) {
    enrollments.push(entity);
  }
  return enrollments;
}

// Get all attempts for a course
export async function getCourseAttempts(courseId) {
  const client = getTableClient(TABLES.ATTEMPTS);
  const attempts = [];
  for await (const entity of client.listEntities()) {
    if (entity.courseId === courseId) {
      attempts.push(entity);
    }
  }
  return attempts;
}

