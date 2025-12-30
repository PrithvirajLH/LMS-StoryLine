/**
 * Upload course files from local xapi folder to Azure Blob Storage
 * Run: node upload-course-files.js
 */

import * as blobStorage from './blob-storage.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const XAPI_FOLDER = path.join(__dirname, '../xapi');

async function uploadDirectory(dirPath, blobPrefix = '') {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    // If blobPrefix is empty and we have a course folder, use it
    const basePrefix = blobPrefix || (COURSE_FOLDER_NAME ? `${COURSE_FOLDER_NAME}/` : '');
    const blobPath = basePrefix ? `${basePrefix}${entry.name}`.replace(/\/+/g, '/') : entry.name;

    if (entry.isDirectory()) {
      // Recursively upload subdirectories
      const result = await uploadDirectory(fullPath, blobPath);
      uploaded += result.uploaded;
      skipped += result.skipped;
      errors += result.errors;
    } else if (entry.isFile()) {
      try {
        // Check if blob already exists
        const exists = await blobStorage.blobExists(blobPath);
        if (exists) {
          console.log(`⏭️  Skipped (exists): ${blobPath}`);
          skipped++;
          continue;
        }

        // Read file and upload
        const content = await fs.readFile(fullPath);
        
        // Determine content type
        const ext = path.extname(entry.name).toLowerCase();
        const contentTypes = {
          '.html': 'text/html',
          '.htm': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.xml': 'application/xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.mp3': 'audio/mpeg',
          '.mp4': 'video/mp4',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf'
        };

        await blobStorage.uploadBlob(blobPath, content, contentTypes[ext] || null);
        console.log(`✅ Uploaded: ${blobPath}`);
        uploaded++;
      } catch (error) {
        console.error(`❌ Error uploading ${blobPath}:`, error.message);
        errors++;
      }
    }
  }

  return { uploaded, skipped, errors };
}

async function main() {
  console.log('\n📤 Uploading course files to Azure Blob Storage\n');
  console.log(`Source: ${XAPI_FOLDER}`);
  console.log(`Container: ${process.env.AZURE_STORAGE_CONTAINER_NAME || 'lms-content'}\n`);

  try {
    // Initialize blob storage
    await blobStorage.initializeBlobStorage();
    
    // Check if xapi folder exists
    try {
      await fs.access(XAPI_FOLDER);
    } catch {
      console.error(`❌ xapi folder not found: ${XAPI_FOLDER}`);
      process.exit(1);
    }

    // Upload all files
    const result = await uploadDirectory(XAPI_FOLDER);

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Upload complete!`);
    console.log(`   Uploaded: ${result.uploaded} files`);
    console.log(`   Skipped: ${result.skipped} files (already exist)`);
    console.log(`   Errors: ${result.errors} files`);
    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    process.exit(1);
  }
}

main();

