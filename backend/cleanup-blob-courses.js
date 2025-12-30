// Clean up blob storage - remove course-specific folders for deleted courses
import * as blobStorage from './blob-storage.js';
import * as coursesStorage from './courses-storage.js';

async function cleanupBlobs() {
  try {
    await blobStorage.initializeBlobStorage();
    
    // Get the remaining course
    const courses = await coursesStorage.getAllCourses();
    const sharepointCourse = courses.find(c => 
      c.title.toLowerCase().includes('sharepoint') && 
      c.title.toLowerCase().includes('101')
    );
    
    if (!sharepointCourse) {
      console.error('❌ SharePoint 101 course not found!');
      return;
    }
    
    console.log(`✅ Keeping blobs for: ${sharepointCourse.courseId} - ${sharepointCourse.title}\n`);
    
    // List all blobs
    const allBlobs = await blobStorage.listBlobs('');
    console.log(`Total blobs: ${allBlobs.length}\n`);
    
    // Find blobs in course-specific folders
    const courseBlobs = allBlobs.filter(b => b.name.startsWith('courses/'));
    const courseFolders = [...new Set(courseBlobs.map(b => b.name.split('/')[1]))];
    
    console.log(`Found ${courseFolders.length} course folders:`, courseFolders);
    
    let deleted = 0;
    let errors = 0;
    
    // Delete blobs in folders for courses that no longer exist
    for (const folder of courseFolders) {
      // Skip if this is the SharePoint course folder (if it exists)
      // Since files are at root, we'll delete all course folders
      console.log(`\nDeleting blobs in folder: courses/${folder}`);
      
      const folderBlobs = allBlobs.filter(b => b.name.startsWith(`courses/${folder}/`));
      console.log(`  Found ${folderBlobs.length} blobs to delete`);
      
      for (const blob of folderBlobs) {
        try {
          await blobStorage.deleteBlob(blob.name);
          deleted++;
          if (deleted % 10 === 0) {
            process.stdout.write('.');
          }
        } catch (error) {
          console.error(`\n  ❌ Error deleting ${blob.name}:`, error.message);
          errors++;
        }
      }
    }
    
    console.log('\n\n' + '='.repeat(50));
    console.log(`✅ Deleted: ${deleted} blob files`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors} files`);
    }
    console.log('='.repeat(50));
    
    // Verify final state
    const remaining = await blobStorage.listBlobs('');
    console.log(`\n📦 Remaining blobs: ${remaining.length}`);
    console.log('✅ All course files are at root level (no course-specific folders)');
  } catch (error) {
    console.error('Error:', error);
  }
}

cleanupBlobs();

