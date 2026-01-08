/**
 * Fix course blob path - Check if files exist and update coursePath accordingly
 * Run: node fix-course-blob-path.js <courseId>
 */

import * as blobStorage from './blob-storage.js';
import * as coursesStorage from './courses-storage.js';

const courseId = process.argv[2];

if (!courseId) {
  console.error('Usage: node fix-course-blob-path.js <courseId>');
  console.error('Example: node fix-course-blob-path.js securecare-what-is-dementia-etiology-and-treatment');
  process.exit(1);
}

async function fixCoursePath() {
  try {
    await blobStorage.initializeBlobStorage();
    
    // Get the course
    const course = await coursesStorage.getCourseById(courseId);
    if (!course) {
      console.error(`❌ Course not found: ${courseId}`);
      process.exit(1);
    }
    
    console.log(`\n📚 Course: ${course.title}`);
    console.log(`   Course ID: ${course.courseId}`);
    console.log(`   Current coursePath: "${course.coursePath}"`);
    console.log(`   Launch File: ${course.launchFile}\n`);
    
    // Check if file exists at current coursePath
    const currentPath = course.coursePath && course.coursePath.trim()
      ? `${course.coursePath}/${course.launchFile}`.replace(/\/+/g, '/')
      : course.launchFile;
    
    console.log(`🔍 Checking: ${currentPath}`);
    const existsAtCurrent = await blobStorage.blobExists(currentPath);
    console.log(`   ${existsAtCurrent ? '✅' : '❌'} File ${existsAtCurrent ? 'exists' : 'not found'}\n`);
    
    if (existsAtCurrent) {
      console.log('✅ Course path is correct! No changes needed.');
      return;
    }
    
    // Try root level
    console.log(`🔍 Checking root level: ${course.launchFile}`);
    const existsAtRoot = await blobStorage.blobExists(course.launchFile);
    console.log(`   ${existsAtRoot ? '✅' : '❌'} File ${existsAtRoot ? 'exists' : 'not found'}\n`);
    
    if (existsAtRoot) {
      console.log('💡 Files are at root level. Updating coursePath to empty string...');
      const updatedCourse = {
        ...course,
        coursePath: ''
      };
      await coursesStorage.saveCourse(updatedCourse);
      console.log('✅ Updated coursePath to "" (root level)');
      console.log(`✅ Launch URL will be: /course/${course.launchFile}`);
      return;
    }
    
    // List all blobs to see what exists
    console.log('🔍 Searching for course files in blob storage...\n');
    const allBlobs = await blobStorage.listBlobs('');
    
    // Look for the launch file
    const matchingBlobs = allBlobs.filter(b => 
      b.name.includes(course.launchFile) || 
      b.name.endsWith(`/${course.launchFile}`)
    );
    
    if (matchingBlobs.length > 0) {
      console.log(`📄 Found ${matchingBlobs.length} matching file(s):`);
      matchingBlobs.forEach(blob => {
        console.log(`   - ${blob.name}`);
      });
      
      // Extract the path prefix
      const firstMatch = matchingBlobs[0].name;
      const pathParts = firstMatch.split('/');
      if (pathParts.length > 1) {
        pathParts.pop(); // Remove filename
        const suggestedPath = pathParts.join('/');
        console.log(`\n💡 Suggested coursePath: "${suggestedPath}"`);
        console.log('   Update course? (This script does not auto-update, please update manually)');
      }
    } else {
      console.log('❌ Course files not found in blob storage!');
      console.log('💡 You need to upload course files first.');
      console.log('   Run: node upload-course-files.js');
      console.log(`   Or upload files to blob storage at path: ${currentPath}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixCoursePath();
