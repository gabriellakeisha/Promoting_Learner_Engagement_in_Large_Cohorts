/**
 * Rate Limiting Test Script
 * Tests the security middleware rate limiters
 */

const BASE_URL = 'http://localhost:3000';

async function testAuthRateLimit() {
  console.log('\n=== Testing Auth Rate Limit (10 req/15min) ===\n');

  let blocked = false;
  for (let i = 1; i <= 15; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
      });

      if (res.status === 429) {
        console.log(`Request ${i}: BLOCKED (rate limit hit)`);
        blocked = true;
        break;
      } else {
        console.log(`Request ${i}: ${res.status} (allowed)`);
      }
    } catch (err) {
      console.log(`Request ${i}: Error - ${err.message}`);
    }
  }

  if (blocked) {
    console.log('\n✅ Auth rate limiting is WORKING');
  } else {
    console.log('\n❌ Auth rate limiting NOT working (should block after 10)');
  }
}

async function testMessageRateLimit() {
  console.log('\n=== Testing Message Rate Limit (30 req/min) ===\n');
  console.log('Note: This requires a valid session. Testing API endpoint...\n');

  let blocked = false;
  for (let i = 1; i <= 35; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/messages/test-session-id`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.status === 429) {
        console.log(`Request ${i}: BLOCKED (rate limit hit)`);
        blocked = true;
        break;
      } else {
        console.log(`Request ${i}: ${res.status}`);
      }
    } catch (err) {
      console.log(`Request ${i}: Error - ${err.message}`);
    }
  }

  if (blocked) {
    console.log('\n✅ Message rate limiting is WORKING');
  } else {
    console.log('\n⚠️ Message rate limit not hit (may need 30+ requests)');
  }
}

async function testAPIRateLimit() {
  console.log('\n=== Testing API Rate Limit (100 req/15min) ===\n');
  console.log('Sending 105 requests to /api/health...\n');

  let blocked = false;
  let blockCount = 0;

  for (let i = 1; i <= 105; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);

      if (res.status === 429) {
        if (!blocked) {
          console.log(`Request ${i}: BLOCKED (rate limit hit)`);
          blocked = true;
        }
        blockCount++;
      } else if (i % 20 === 0) {
        console.log(`Request ${i}: ${res.status} (allowed)`);
      }
    } catch (err) {
      console.log(`Request ${i}: Error - ${err.message}`);
    }
  }

  if (blocked) {
    console.log(`\n✅ API rate limiting is WORKING (blocked ${blockCount} requests)`);
  } else {
    console.log('\n❌ API rate limiting NOT working');
  }
}

async function runTests() {
  console.log('========================================');
  console.log('   RATE LIMITING TEST');
  console.log('   Make sure server is running first!');
  console.log('========================================');

  await testAuthRateLimit();
  await testMessageRateLimit();
  // Uncomment below to test API limit (takes longer)
  // await testAPIRateLimit();

  console.log('\n========================================');
  console.log('   TEST COMPLETE');
  console.log('========================================\n');
}

runTests();
