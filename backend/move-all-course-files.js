// Move ALL course files (including subdirectories) to course-specific folder
import * as blobStorage from './blob-storage.js';
import * as coursesStorage from './courses-storage.js';

async function moveAllFiles() {
  try {
    await blobStorage.initializeBlobStorage();
    
    // Get the course
    const courses = await coursesStorage.getAllCourses();
    const course = courses[0];
    
    if (!course) {
      console.error('No course found');
      return;
    }
    
    console.log(`📚 Course: ${course.title}`);
    
    // Create folder name from course title
    const folderName = course.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    console.log(`📁 Target folder: ${folderName}\n`);
    
    // List ALL blobs (not just root)
    const allBlobs = await blobStorage.listBlobs('');
    
    // Filter out files that are already in course folders (like courses/xxx/)
    // and files that are already in our target folder
    const filesToMove = allBlobs.filter(b => {
      // Skip if already in a course folder (courses/xxx/)
      if (b.name.startsWith('courses/')) return false;
      // Skip if already in our target folder
      if (b.name.startsWith(`${folderName}/`)) return false;
      return true;
    });
    
    console.log(`Found ${filesToMove.length} files to move\n`);
    
    if (filesToMove.length === 0) {
      console.log('✅ All files already organized!');
      return;
    }
    
    let moved = 0;
    let errors = 0;
    let skipped = 0;
    
    // Move each file
    for (const blob of filesToMove) {
      try {
        const oldPath = blob.name;
        const newPath = `${folderName}/${oldPath}`;
        
        // Check if already exists in new location
        const exists = await blobStorage.blobExists(newPath);
        if (exists) {
          skipped++;
          // Delete old file if new one exists
          try {
            await blobStorage.deleteBlob(oldPath);
          } catch (e) {
            // Ignore
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
        if (moved % 20 === 0) {
          process.stdout.write('.');
        }
      } catch (error) {
        console.error(`\n❌ Error moving ${blob.name}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n\n✅ Moved: ${moved} files`);
    console.log(`⏭️  Skipped: ${skipped} files (already in target)`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors} files`);
    }
    
    // Update course's coursePath
    const updatedCourse = {
      ...course,
      coursePath: folderName
    };
    
    await coursesStorage.saveCourse(updatedCourse);
    console.log(`\n✅ Updated coursePath to: ${folderName}`);
    console.log(`✅ Launch URL: /course/${folderName}/${course.launchFile}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

moveAllFiles();

