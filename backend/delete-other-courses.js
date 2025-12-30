// Delete all courses except SharePoint 101
import * as coursesStorage from './courses-storage.js';

async function deleteOtherCourses() {
  try {
    const courses = await coursesStorage.getAllCourses();
    console.log(`Found ${courses.length} courses\n`);
    
    // Find SharePoint 101 course (keep this one)
    const sharepointCourse = courses.find(c => 
      c.title.toLowerCase().includes('sharepoint') && 
      c.title.toLowerCase().includes('101')
    );
    
    if (!sharepointCourse) {
      console.error('❌ SharePoint 101 course not found!');
      return;
    }
    
    console.log(`✅ Keeping: ${sharepointCourse.courseId} - ${sharepointCourse.title}\n`);
    
    let deleted = 0;
    let errors = 0;
    
    // Delete all other courses
    for (const course of courses) {
      if (course.courseId !== sharepointCourse.courseId) {
        try {
          await coursesStorage.deleteCourse(course.courseId);
          console.log(`✅ Deleted: ${course.courseId} - ${course.title}`);
          deleted++;
        } catch (error) {
          console.error(`❌ Error deleting ${course.courseId}:`, error.message);
          errors++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Deleted: ${deleted} courses`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors} courses`);
    }
    console.log(`✅ Kept: ${sharepointCourse.courseId} - ${sharepointCourse.title}`);
    console.log('='.repeat(50));
    
    // Verify final state
    const remaining = await coursesStorage.getAllCourses();
    console.log(`\n📚 Remaining courses: ${remaining.length}`);
    remaining.forEach(c => console.log(`  - ${c.courseId}: ${c.title}`));
  } catch (error) {
    console.error('Error:', error);
  }
}

deleteOtherCourses();

