// Test admin access
import * as auth from './auth.js';

async function test() {
  console.log('\n🧪 Testing Admin Access\n');
  console.log('='.repeat(50));
  
  try {
    // Test login
    console.log('\n1️⃣ Testing Admin Login');
    const result = await auth.login('admin@example.com', 'admin123');
    console.log('✅ Login successful');
    console.log('   User:', result.user.email);
    console.log('   Role:', result.user.role);
    console.log('   isAdmin:', result.user.isAdmin);
    
    if (result.user.isAdmin) {
      console.log('   ✅ Admin access granted!');
    } else {
      console.log('   ❌ Admin access denied!');
    }
    
    console.log('\n2️⃣ Testing Token Verification');
    const verified = auth.verifyToken(result.token);
    if (verified) {
      console.log('✅ Token verified');
      console.log('   Role:', verified.role);
      console.log('   Email:', verified.email);
    } else {
      console.log('❌ Token verification failed');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('\n✅ Admin access test complete!\n');
    console.log('💡 To access admin panel:');
    console.log('   1. Logout from frontend');
    console.log('   2. Login again with: admin@example.com / admin123');
    console.log('   3. Navigate to: http://localhost:5173/admin\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();

