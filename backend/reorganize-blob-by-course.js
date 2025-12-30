// Reorganize blob storage: Move files from root to course-specific folders
import * as blobStorage from './blob-storage.js';
import * as coursesStorage from './courses-storage.js';

async function reorganizeBlobs() {
  try {
    await blobStorage.initializeBlobStorage();
    
    // Get all courses
    const courses = await coursesStorage.getAllCourses();
    console.log(`Found ${courses.length} course(s) to reorganize\n`);
    
    for (const course of courses) {
      console.log(`\n📚 Processing: ${course.title}`);
      console.log(`   Course ID: ${course.courseId}`);
      
      // Create folder name from course title (sanitized)
      const folderName = course.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50); // Limit length
      
      console.log(`   Folder name: ${folderName}`);
      
      // List all blobs at root level
      const allBlobs = await blobStorage.listBlobs('');
      const rootBlobs = allBlobs.filter(b => !b.name.includes('/') || b.name.split('/').length === 1);
      
      console.log(`   Found ${rootBlobs.length} files at root level`);
      
      if (rootBlobs.length === 0) {
        console.log(`   ⚠️  No files to move (might already be organized)`);
        continue;
      }
      
      let moved = 0;
      let errors = 0;
      
      // Move each file to the course folder
      for (const blob of rootBlobs) {
        try {
          const oldPath = blob.name;
          const newPath = `${folderName}/${oldPath}`;
          
          // Check if already moved
          const exists = await blobStorage.blobExists(newPath);
          if (exists) {
            console.log(`   ⏭️  Skipped (already exists): ${newPath}`);
            // Delete old file if new one exists
            try {
              await blobStorage.deleteBlob(oldPath);
            } catch (e) {
              // Ignore if already deleted
            }
            continue;
          }
          
          // Read blob content
          const content = await blobStorage.getBlobBuffer(oldPath);
          
          // Determine content type
          const ext = oldPath.split('.').pop()?.toLowerCase() || '';
          const contentTypes = {
            'html': 'text/html',
            'htm': 'text/html',
            'js': 'application/javascript',
            'css': 'text/css',
            'json': 'application/json',
            'xml': 'application/xml',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'mp3': 'audio/mpeg',
            'mp4': 'video/mp4',
            'woff': 'font/woff',
            'woff2': 'font/woff2',
            'ttf': 'font/ttf'
          };
          
          const contentType = contentTypes[ext] || null;
          
          // Upload to new location
          await blobStorage.uploadBlob(newPath, content, contentType);
          
          // Delete old file
          await blobStorage.deleteBlob(oldPath);
          
          moved++;
          if (moved % 10 === 0) {
            process.stdout.write('.');
          }
        } catch (error) {
          console.error(`\n   ❌ Error moving ${blob.name}:`, error.message);
          errors++;
        }
      }
      
      console.log(`\n   ✅ Moved: ${moved} files`);
      if (errors > 0) {
        console.log(`   ❌ Errors: ${errors} files`);
      }
      
      // Update course's coursePath
      const updatedCourse = {
        ...course,
        coursePath: folderName
      };
      
      await coursesStorage.saveCourse(updatedCourse);
      console.log(`   ✅ Updated coursePath to: ${folderName}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Reorganization complete!');
    console.log('='.repeat(50));
    
    // Verify final state
    const finalCourses = await coursesStorage.getAllCourses();
    console.log(`\n📚 Final course structure:`);
    for (const course of finalCourses) {
      console.log(`   - ${course.title}`);
      console.log(`     CoursePath: ${course.coursePath}`);
      console.log(`     Launch URL: /course/${course.coursePath}/${course.launchFile}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

reorganizeBlobs();

