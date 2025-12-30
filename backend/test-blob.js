// Test blob storage
// Run: node test-blob.js

import * as blobStorage from './blob-storage.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function test() {
  log('\n🧪 Testing Azure Blob Storage\n', 'blue');
  log('='.repeat(50), 'blue');

  try {
    // Test 1: Initialize
    log('\n1️⃣ Initializing Blob Storage', 'blue');
    await blobStorage.initializeBlobStorage();
    log('   ✅ Blob storage initialized', 'green');

    // Test 2: List blobs
    log('\n2️⃣ Listing blobs', 'blue');
    const blobs = await blobStorage.listBlobs();
    log(`   ✅ Found ${blobs.length} blob(s)`, 'green');
    if (blobs.length > 0) {
      log(`   📄 Sample: ${blobs[0].name}`, 'yellow');
    }

    // Test 3: Check if index_lms.html exists
    log('\n3️⃣ Checking for index_lms.html', 'blue');
    const exists = await blobStorage.blobExists('index_lms.html');
    if (exists) {
      log('   ✅ index_lms.html exists in blob storage', 'green');
    } else {
      log('   ⚠️  index_lms.html not found - you may need to upload course files', 'yellow');
      log('   💡 Run: node upload-course-files.js', 'yellow');
    }

    // Test 4: Test file serving endpoint
    log('\n4️⃣ Testing file serving endpoint', 'blue');
    try {
      const response = await fetch('http://localhost:3000/course/index_lms.html');
      if (response.ok) {
        log('   ✅ File serving endpoint works', 'green');
      } else {
        log(`   ⚠️  Endpoint returned ${response.status}`, 'yellow');
      }
    } catch (error) {
      log(`   ⚠️  Could not test endpoint: ${error.message}`, 'yellow');
      log('   💡 Make sure server is running', 'yellow');
    }

    log('\n' + '='.repeat(50), 'blue');
    log('\n✅ Blob storage tests completed!\n', 'green');
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

test().catch(console.error);

