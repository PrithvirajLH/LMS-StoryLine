import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const LRS_ENDPOINT = process.env.LRS_ENDPOINT;
const LRS_KEY = process.env.LRS_KEY;
const LRS_SECRET = process.env.LRS_SECRET;

console.log('\n🔍 Testing LRS Connection...\n');

// Check configuration
if (!LRS_ENDPOINT || !LRS_KEY || !LRS_SECRET) {
  console.error('❌ LRS configuration incomplete!');
  console.log('\nPlease add these to your backend/.env file:');
  console.log('LRS_ENDPOINT=http://your-server-ip/data/xAPI');
  console.log('LRS_KEY=your-basic-auth-key');
  console.log('LRS_SECRET=your-basic-auth-secret\n');
  process.exit(1);
}

console.log('✓ Configuration found');
console.log(`  Endpoint: ${LRS_ENDPOINT}`);
console.log(`  Key: ${LRS_KEY.substring(0, 10)}...`);
console.log(`  Secret: ${LRS_SECRET.substring(0, 10)}...\n`);

// Test connection
const LRS_AUTH = Buffer.from(`${LRS_KEY}:${LRS_SECRET}`).toString('base64');

async function testConnection() {
  try {
    console.log('Testing /about endpoint...');
    const response = await axios.get(`${LRS_ENDPOINT}/about`, {
      headers: {
        Authorization: `Basic ${LRS_AUTH}`,
        'X-Experience-API-Version': '1.0.3',
      },
      timeout: 5000,
    });

    console.log('✅ Connection successful!');
    console.log('\nLRS Information:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Test statements endpoint
    console.log('\nTesting /statements endpoint...');
    const statementsResponse = await axios.get(`${LRS_ENDPOINT}/statements`, {
      params: { limit: 1 },
      headers: {
        Authorization: `Basic ${LRS_AUTH}`,
        'X-Experience-API-Version': '1.0.3',
      },
      timeout: 5000,
    });

    const statementCount = statementsResponse.data.statements?.length || 0;
    console.log(`✅ Statements endpoint working! (Found ${statementCount} statements)`);
    
    console.log('\n🎉 LRS is fully configured and working!\n');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error('❌ Cannot connect to LRS endpoint');
      console.error(`   Make sure Learning Locker is running at: ${LRS_ENDPOINT}`);
      console.error('   Check firewall and network connectivity');
    } else if (error.response?.status === 401) {
      console.error('❌ Authentication failed');
      console.error('   Check your LRS_KEY and LRS_SECRET in .env file');
    } else if (error.response?.status === 404) {
      console.error('❌ Endpoint not found');
      console.error(`   Make sure the endpoint URL is correct: ${LRS_ENDPOINT}`);
      console.error('   Should end with /data/xAPI');
    } else {
      console.error('❌ Error:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Response:', error.response.data);
      }
    }
    process.exit(1);
  }
}

testConnection();

