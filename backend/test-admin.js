// Test admin API endpoints
// Run: node test-admin.js

const BASE_URL = 'http://localhost:3000';

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
  log('\n🧪 Testing Admin API Endpoints\n', 'blue');
  log('='.repeat(50), 'blue');
  
  let adminToken = null;
  
  // Test 1: Login as admin
  try {
    log('\n1️⃣ Testing Admin Login', 'blue');
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      adminToken = data.token;
      log(`   ✅ Login successful: ${data.user.email} (${data.user.role})`, 'green');
      log(`   🔑 Token: ${adminToken.substring(0, 30)}...`, 'yellow');
    } else {
      log(`   ❌ Login failed: ${data.error}`, 'red');
      return;
    }
  } catch (error) {
    log(`   ❌ Login error: ${error.message}`, 'red');
    return;
  }
  
  if (!adminToken) {
    log('   ❌ No admin token, cannot continue', 'red');
    return;
  }
  
  // Test 2: Get all courses (admin)
  try {
    log('\n2️⃣ Testing GET /api/admin/courses', 'blue');
    const res = await fetch(`${BASE_URL}/api/admin/courses`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      log(`   ✅ Retrieved ${data.length} course(s)`, 'green');
      if (data.length > 0) {
        log(`   📚 Course: ${data[0].title}`, 'yellow');
      }
    } else {
      log(`   ❌ Failed: ${data.error}`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }
  
  // Test 3: Create new course
  let testCourseId = null;
  try {
    log('\n3️⃣ Testing POST /api/admin/courses', 'blue');
    const newCourse = {
      title: 'Test Course - Admin API',
      description: 'This is a test course created via admin API',
      activityId: 'urn:test:course:12345',
      launchFile: 'index_lms.html',
      thumbnailUrl: '/course/test-thumbnail.jpg'
    };
    
    const res = await fetch(`${BASE_URL}/api/admin/courses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newCourse)
    });
    const data = await res.json();
    if (res.ok) {
      testCourseId = data.courseId;
      log(`   ✅ Course created: ${data.courseId}`, 'green');
      log(`   📝 Title: ${data.title}`, 'yellow');
    } else {
      log(`   ❌ Failed: ${data.error}`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }
  
  // Test 4: Update course
  if (testCourseId) {
    try {
      log('\n4️⃣ Testing PUT /api/admin/courses/:courseId', 'blue');
      const res = await fetch(`${BASE_URL}/api/admin/courses/${testCourseId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Updated description via admin API'
        })
      });
      const data = await res.json();
      if (res.ok) {
        log(`   ✅ Course updated: ${data.courseId}`, 'green');
        log(`   📝 New description: ${data.description}`, 'yellow');
      } else {
        log(`   ❌ Failed: ${data.error}`, 'red');
      }
    } catch (error) {
      log(`   ❌ Error: ${error.message}`, 'red');
    }
  }
  
  // Test 5: Get specific course
  if (testCourseId) {
    try {
      log('\n5️⃣ Testing GET /api/admin/courses/:courseId', 'blue');
      const res = await fetch(`${BASE_URL}/api/admin/courses/${testCourseId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        log(`   ✅ Retrieved course: ${data.title}`, 'green');
      } else {
        log(`   ❌ Failed: ${data.error}`, 'red');
      }
    } catch (error) {
      log(`   ❌ Error: ${error.message}`, 'red');
    }
  }
  
  // Test 6: Delete course
  if (testCourseId) {
    try {
      log('\n6️⃣ Testing DELETE /api/admin/courses/:courseId', 'blue');
      const res = await fetch(`${BASE_URL}/api/admin/courses/${testCourseId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.status === 204) {
        log(`   ✅ Course deleted: ${testCourseId}`, 'green');
      } else {
        const data = await res.json();
        log(`   ❌ Failed: ${data.error}`, 'red');
      }
    } catch (error) {
      log(`   ❌ Error: ${error.message}`, 'red');
    }
  }
  
  // Test 7: Test non-admin access (should fail)
  try {
    log('\n7️⃣ Testing Admin Access Control', 'blue');
    // Try to access admin endpoint without admin role
    const res = await fetch(`${BASE_URL}/api/admin/courses`, {
      headers: { 'Authorization': `Bearer invalid-token` }
    });
    const data = await res.json();
    if (res.status === 401 || res.status === 403) {
      log(`   ✅ Access control working: ${data.error}`, 'green');
    } else {
      log(`   ⚠️  Unexpected response: ${res.status}`, 'yellow');
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }
  
  // Test 8: Get courses (public endpoint)
  try {
    log('\n8️⃣ Testing GET /api/courses (public)', 'blue');
    const res = await fetch(`${BASE_URL}/api/courses`);
    const data = await res.json();
    if (res.ok) {
      log(`   ✅ Retrieved ${data.length} course(s) (public)`, 'green');
    } else {
      log(`   ❌ Failed: ${data.error}`, 'red');
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
  }
  
  log('\n' + '='.repeat(50), 'blue');
  log('\n✅ Admin API tests completed!\n', 'green');
}

test().catch(console.error);

