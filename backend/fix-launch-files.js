// Fix launch files for all courses to use index_lms.html (the file that exists in blob storage)
import * as coursesStorage from './courses-storage.js';

async function fixLaunchFiles() {
  try {
    const courses = await coursesStorage.getAllCourses();
    console.log(`Found ${courses.length} courses to check\n`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const course of courses) {
      if (course.launchFile !== 'index_lms.html') {
        console.log(`Fixing: ${course.courseId} - ${course.title}`);
        console.log(`  Current launchFile: ${course.launchFile}`);
        
        const updatedCourse = {
          ...course,
          launchFile: 'index_lms.html'
        };
        
        await coursesStorage.saveCourse(updatedCourse);
        
        // Verify
        const verify = await coursesStorage.getCourseById(course.courseId);
        console.log(`  ✅ Updated launchFile to: ${verify.launchFile}`);
        console.log(`  Launch URL: /course/${verify.launchFile}\n`);
        fixed++;
      } else {
        console.log(`Skipping: ${course.courseId} (launchFile already correct)\n`);
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

fixLaunchFiles();

