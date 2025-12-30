// Test launch URL construction
import * as coursesStorage from './courses-storage.js';

const courseId = '6e64564d-5cb1-42d3-8a3d-548d788cf5eb';

async function test() {
  const course = await coursesStorage.getCourseById(courseId);
  
  // Same logic as server.js
  const filePath = course.coursePath && course.coursePath.trim() 
    ? `${course.coursePath}/${course.launchFile}`.replace(/\/+/g, '/')
    : course.launchFile;
  
  console.log('Course:', course.title);
  console.log('CoursePath:', JSON.stringify(course.coursePath));
  console.log('LaunchFile:', course.launchFile);
  console.log('Constructed filePath:', filePath);
  console.log('✅ Launch URL would be:', `http://localhost:3000/course/${filePath}?params...`);
}

test();

