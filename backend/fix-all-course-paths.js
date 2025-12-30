// Fix course paths for all courses that have files at root of blob storage
import * as coursesStorage from './courses-storage.js';

async function fixAllCourses() {
  try {
    const courses = await coursesStorage.getAllCourses();
    console.log(`Found ${courses.length} courses to check\n`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const course of courses) {
      // Check if coursePath is set to a subdirectory (like "courses/{id}")
      // Files are at root of blob storage, so coursePath should be empty
      if (course.coursePath && course.coursePath.trim() && course.coursePath !== '') {
        console.log(`Fixing: ${course.courseId}`);
        console.log(`  Current coursePath: ${course.coursePath}`);
        
        const updatedCourse = {
          ...course,
          coursePath: '' // Set to empty since files are at root
        };
        
        await coursesStorage.saveCourse(updatedCourse);
        
        // Verify
        const verify = await coursesStorage.getCourseById(course.courseId);
        console.log(`  ✅ Updated coursePath to: "${verify.coursePath}"`);
        console.log(`  Launch URL: /course/${verify.launchFile}\n`);
        fixed++;
      } else {
        console.log(`Skipping: ${course.courseId} (coursePath already empty or correct)\n`);
        skipped++;
      }
    }
    
    console.log('='.repeat(50));
    console.log(`✅ Fixed: ${fixed} courses`);
    console.log(`⏭️  Skipped: ${skipped} courses`);
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Error:', error);
  }
}

fixAllCourses();

