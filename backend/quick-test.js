// Quick test script - run with: node quick-test.js

const BASE_URL = 'http://localhost:3000';

async function test() {
  console.log('\n🧪 Testing Backend Endpoints\n');
  
  // Test 1: Health
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    console.log('✅ Health:', data.status);
  } catch (e) {
    console.log('❌ Health failed:', e.message);
  }
  
  // Test 2: Get Courses
  try {
    const res = await fetch(`${BASE_URL}/api/courses`);
    const data = await res.json();
    console.log('✅ Get Courses:', data.length, 'course(s)');
    if (data.length > 0) {
      console.log('   Course:', data[0].title);
    }
  } catch (e) {
    console.log('❌ Get Courses failed:', e.message);
  }
  
  // Test 3: Login
  let token = null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      token = data.token;
      console.log('✅ Login:', data.user.email, '| Token:', token.substring(0, 20) + '...');
    } else {
      console.log('❌ Login failed:', data.error);
    }
  } catch (e) {
    console.log('❌ Login failed:', e.message);
  }
  
  // Test 4: Get Courses with Auth
  if (token) {
    try {
      const res = await fetch(`${BASE_URL}/api/courses?token=${token}`);
      const data = await res.json();
      console.log('✅ Get Courses (Auth):', data[0]?.isEnrolled ? 'Enrolled' : 'Not enrolled');
    } catch (e) {
      console.log('❌ Get Courses (Auth) failed:', e.message);
    }
  }
  
  // Test 5: Launch Course
  if (token) {
    try {
      const res = await fetch(`${BASE_URL}/api/courses/sharepoint-navigation-101/launch`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.launchUrl) {
        console.log('✅ Launch Course: Success');
        console.log('   Launch URL:', data.launchUrl.substring(0, 80) + '...');
      } else {
        console.log('❌ Launch failed:', data.error);
      }
    } catch (e) {
      console.log('❌ Launch failed:', e.message);
    }
  }
  
  // Test 6: xAPI Statement
  try {
    const res = await fetch(`${BASE_URL}/xapi/statements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: { objectType: 'Agent', name: 'Test', mbox: 'mailto:test@example.com' },
        verb: { id: 'http://adlnet.gov/expapi/verbs/experienced' },
        object: { id: 'urn:articulate:storyline:5Ujw93Dh98n', objectType: 'Activity' }
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log('✅ xAPI Statement: Saved', Array.isArray(data) ? data.length : 1, 'statement(s)');
    } else {
      console.log('❌ xAPI Statement failed:', data.error);
    }
  } catch (e) {
    console.log('❌ xAPI Statement failed:', e.message);
  }
  
  // Test 7: Query Statements
  try {
    const res = await fetch(`${BASE_URL}/xapi/statements?limit=5`);
    const data = await res.json();
    if (res.ok) {
      console.log('✅ Query Statements:', data.statements?.length || 0, 'statement(s)');
    } else {
      console.log('❌ Query Statements failed:', data.error);
    }
  } catch (e) {
    console.log('❌ Query Statements failed:', e.message);
  }
  
  console.log('\n✅ All tests completed!\n');
}

test().catch(console.error);

