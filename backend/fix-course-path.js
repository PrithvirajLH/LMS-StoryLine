// Fix course path for courses that have files at root of blob storage
import * as coursesStorage from './courses-storage.js';

const courseId = '52823501-6410-4081-beed-c7d07ac0f78d';

async function fixCourse() {
  try {
    const course = await coursesStorage.getCourseById(courseId);
    if (!course) {
      console.error('Course not found');
      return;
    }

    console.log('Current coursePath:', course.coursePath);
    
    // Update coursePath to empty string explicitly since files are at root of blob storage
    // Azure Tables needs explicit empty string, not undefined
    const updatedCourse = {
      ...course,
      coursePath: '' // Explicitly set to empty string
    };
    
    await coursesStorage.saveCourse(updatedCourse);
    
    // Verify it was saved
    const verify = await coursesStorage.getCourseById(courseId);
    console.log('✅ Course updated');
    console.log('  coursePath after save:', JSON.stringify(verify.coursePath));
    console.log('  Launch URL will be:', `/course/${verify.launchFile}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

fixCourse();

