import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { createCourse } from '../src/services/tableService.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'lms-content';

if (!accountName || !accountKey) {
  console.error('Azure Storage credentials not set in .env');
  process.exit(1);
}

const credential = new StorageSharedKeyCredential(accountName, accountKey);
const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  credential
);

async function uploadDirectory(localPath, blobPathPrefix) {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const files = [];
  
  function getAllFiles(dir, baseDir = dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      
      if (entry.isDirectory()) {
        getAllFiles(fullPath, baseDir);
      } else {
        files.push(relativePath);
      }
    }
  }
  
  getAllFiles(localPath);
  
  console.log(`Uploading ${files.length} files...`);
  
  for (const file of files) {
    const localFilePath = path.join(localPath, file);
    const blobPath = `${blobPathPrefix}${file}`;
    
    try {
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
      const fileContent = fs.readFileSync(localFilePath);
      
      await blockBlobClient.upload(fileContent, fileContent.length, {
        blobHTTPHeaders: {
          blobContentType: getContentType(file),
        },
      });
      
      console.log(`  ✓ ${file}`);
    } catch (error) {
      console.error(`  ✗ Failed to upload ${file}:`, error.message);
    }
  }
  
  console.log(`✓ Upload complete: ${files.length} files uploaded`);
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase().substring(1);
  const types = {
    html: 'text/html',
    js: 'application/javascript',
    css: 'text/css',
    json: 'application/json',
    xml: 'application/xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    txt: 'text/plain',
  };
  return types[ext] || 'application/octet-stream';
}

async function parseTincanXml(tincanPath) {
  const xmlContent = fs.readFileSync(tincanPath, 'utf8');
  const activityMatch = xmlContent.match(/<activity id="([^"]+)"[^>]*>/);
  const nameMatch = xmlContent.match(/<name>([^<]+)<\/name>/);
  const descriptionMatch = xmlContent.match(/<description[^>]*>([^<]+)<\/description>/);
  const launchMatch = xmlContent.match(/<launch[^>]*>([^<]+)<\/launch>/);
  
  return {
    activityId: activityMatch ? activityMatch[1] : null,
    name: nameMatch ? nameMatch[1] : 'Untitled Course',
    description: descriptionMatch ? descriptionMatch[1] : null,
    launchFile: launchMatch ? launchMatch[1] : 'index.html',
  };
}

async function setupCourse(courseFolder, courseName) {
  const coursePath = path.join(__dirname, '../../TinCan_Prototypes', courseFolder);
  const tincanPath = path.join(coursePath, 'tincan.xml');
  
  if (!fs.existsSync(tincanPath)) {
    console.error(`✗ tincan.xml not found in ${courseFolder}`);
    return;
  }
  
  console.log(`\n📦 Setting up: ${courseName}`);
  console.log('─'.repeat(50));
  
  // Parse tincan.xml
  const tincanData = await parseTincanXml(tincanPath);
  console.log(`Activity ID: ${tincanData.activityId}`);
  console.log(`Launch File: ${tincanData.launchFile}`);
  
  // Generate course ID
  const courseId = randomUUID();
  const blobPath = `courses/${courseId}/xapi/`;
  
  // Upload files
  console.log(`\nUploading to: ${blobPath}`);
  await uploadDirectory(coursePath, blobPath);
  
  // Create course record
  try {
    const course = await createCourse({
      title: tincanData.name || courseName,
      description: tincanData.description,
      activityId: tincanData.activityId,
      blobPath: blobPath,
      launchFile: tincanData.launchFile,
    });
    
    console.log(`\n✓ Course created in database:`);
    console.log(`  Course ID: ${course.courseId}`);
    console.log(`  Title: ${course.title}`);
    console.log(`  Blob Path: ${course.blobPath}`);
  } catch (error) {
    console.error(`\n✗ Failed to create course record:`, error.message);
  }
}

async function main() {
  console.log('🚀 Course Upload Script');
  console.log('═'.repeat(50));
  
  const courses = [
    { folder: 'GolfExample_TCAPI', name: 'Golf Example Course' },
    { folder: 'JsTetris_TCAPI', name: 'Tetris Game Course' },
    { folder: 'Locator_TCAPI', name: 'Museum Tour Course' },
  ];
  
  for (const course of courses) {
    await setupCourse(course.folder, course.name);
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('✅ All courses uploaded!');
  console.log('\nNext steps:');
  console.log('1. Login to the LMS');
  console.log('2. Browse courses in the catalog');
  console.log('3. Enroll and launch a course');
}

main().catch(console.error);

