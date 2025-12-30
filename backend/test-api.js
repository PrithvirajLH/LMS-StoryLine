/**
 * Test script for backend API endpoints
 * Run: node test-api.js
 * 
 * Note: Requires Node.js 18+ (has built-in fetch)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Colors for console output
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

async function testEndpoint(name, method, url, body = null, headers = {}) {
  try {
    log(`\n🧪 Testing: ${name}`, 'blue');
    log(`   ${method} ${url}`, 'yellow');
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    
    if (response.ok) {
      log(`   ✅ Success (${response.status})`, 'green');
      if (Object.keys(data).length > 0) {
        log(`   Response: ${JSON.stringify(data).substring(0, 100)}...`, 'yellow');
      }
      return { success: true, data, status: response.status };
    } else {
      log(`   ❌ Failed (${response.status}): ${data.error || response.statusText}`, 'red');
      return { success: false, data, status: response.status };
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n🚀 Starting API Tests\n', 'blue');
  log('='.repeat(50), 'blue');
  
  // Test 1: Health check
  await testEndpoint('Health Check', 'GET', `${BASE_URL}/health`);
  
  // Test 2: Register user
  const registerResult = await testEndpoint(
    'Register User',
    'POST',
    `${BASE_URL}/api/auth/register`,
    {
      email: 'test@example.com',
      password: 'test123',
      name: 'Test User'
    }
  );
  
  let token = null;
  if (registerResult.success && registerResult.data.token) {
    token = registerResult.data.token;
    log(`\n   🔑 Token received: ${token.substring(0, 20)}...`, 'green');
  } else {
    // Try login instead
    log('\n   ⚠️  Registration failed, trying login...', 'yellow');
    const loginResult = await testEndpoint(
      'Login',
      'POST',
      `${BASE_URL}/api/auth/login`,
      {
        email: 'admin@example.com',
        password: 'admin123'
      }
    );
    if (loginResult.success && loginResult.data.token) {
      token = loginResult.data.token;
      log(`\n   🔑 Token received: ${token.substring(0, 20)}...`, 'green');
    }
  }
  
  // Test 3: Get courses (without auth)
  await testEndpoint('Get Courses (No Auth)', 'GET', `${BASE_URL}/api/courses`);
  
  // Test 4: Get courses (with auth)
  if (token) {
    await testEndpoint(
      'Get Courses (With Auth)',
      'GET',
      `${BASE_URL}/api/courses?token=${token}`
    );
    
    // Test 5: Get specific course
    await testEndpoint(
      'Get Course Details',
      'GET',
      `${BASE_URL}/api/courses/sharepoint-navigation-101?token=${token}`
    );
    
    // Test 6: Launch course
    const launchResult = await testEndpoint(
      'Launch Course',
      'POST',
      `${BASE_URL}/api/courses/sharepoint-navigation-101/launch`,
      { token },
      { Authorization: `Bearer ${token}` }
    );
    
    if (launchResult.success) {
      log(`\n   🎯 Launch URL: ${launchResult.data.launchUrl}`, 'green');
    }
    
    // Test 7: Get user info
    await testEndpoint(
      'Get User Info',
      'GET',
      `${BASE_URL}/api/auth/me?token=${token}`
    );
  }
  
  // Test 8: xAPI - Save statement
  log('\n📊 Testing xAPI Endpoints', 'blue');
  await testEndpoint(
    'Save xAPI Statement',
    'POST',
    `${BASE_URL}/xapi/statements`,
    {
      actor: {
        objectType: 'Agent',
        name: 'Test User',
        mbox: 'mailto:test@example.com'
      },
      verb: {
        id: 'http://adlnet.gov/expapi/verbs/experienced'
      },
      object: {
        id: 'urn:articulate:storyline:5Ujw93Dh98n',
        objectType: 'Activity'
      }
    }
  );
  
  // Test 9: xAPI - Query statements
  await testEndpoint(
    'Query xAPI Statements',
    'GET',
    `${BASE_URL}/xapi/statements?limit=10`
  );
  
  log('\n' + '='.repeat(50), 'blue');
  log('\n✅ Tests completed!\n', 'green');
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test runner error: ${error.message}`, 'red');
  process.exit(1);
});

