import fetch from 'node-fetch';

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function runTest() {
  console.log("=========================================");
  console.log("P46 RATE LIMITING VERIFICATION SUITE");
  console.log("=========================================\n");

  // TEST 1: GUEST ORDINARY LIMIT (5 requests per min)
  console.log("[TEST 1] Sending 5 requests as Guest to /api/ai/advice...");
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${BASE_URL}/api/ai/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuery: `Test query ${i} Article 25`, preferredLanguage: "en" })
    });
    console.log(`  -> Request ${i} status: ${res.status}`);
    if (res.status !== 200) {
      console.error(`  -> Unexpected status on request ${i}: ${res.status}`);
    }
  }

  console.log("\n[TEST 2] Sending 6th request as Guest (should be blocked with 429)...");
  const res6 = await fetch(`${BASE_URL}/api/ai/advice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: "Test query 6 Article 25", preferredLanguage: "en" })
  });
  console.log(`  -> Request 6 status: ${res6.status}`);
  const data6 = await res6.json();
  console.log(`  -> Request 6 error message:`, data6.error);

  if (res6.status === 429 && data6.error === "Too many requests. Please try again shortly.") {
    console.log("  -> ✅ Guest ordinary rate limit test passed!");
  } else {
    console.error("  -> ❌ Guest ordinary rate limit test failed.");
    process.exit(1);
  }

  // TEST 2: AUTH ORDINARY LIMIT (20 requests per min)
  console.log("\n[TEST 3] Sending 6th request with Authentication header (should bypass Guest 429)...");
  const authRes = await fetch(`${BASE_URL}/api/ai/advice`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test_user_token_123'
    },
    body: JSON.stringify({ userQuery: "Test query with auth Article 25", preferredLanguage: "en" })
  });
  console.log(`  -> Auth request status: ${authRes.status}`);
  if (authRes.status === 200) {
    console.log("  -> ✅ Auth user rate limit bypass test passed!");
  } else {
    console.error("  -> ❌ Auth user rate limit bypass test failed.");
    process.exit(1);
  }

  // TEST 3: GUEST EXPENSIVE LIMIT (2 requests per min)
  console.log("\n[TEST 4] Sending 2 requests as Guest to expensive endpoint /api/ai/generate...");
  for (let i = 1; i <= 2; i++) {
    const res = await fetch(`${BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: "Affidavit", details: "name: Ali", preferredLanguage: "en" })
    });
    console.log(`  -> Generate request ${i} status: ${res.status}`);
  }

  console.log("\n[TEST 5] Sending 3rd request to /api/ai/generate as Guest (should be blocked with 429)...");
  const genRes3 = await fetch(`${BASE_URL}/api/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: "Affidavit", details: "name: Ali", preferredLanguage: "en" })
  });
  console.log(`  -> Generate request 3 status: ${genRes3.status}`);
  const genData3 = await genRes3.json();
  console.log(`  -> Generate request 3 error message:`, genData3.error);

  if (genRes3.status === 429 && genData3.error === "Too many requests. Please try again shortly.") {
    console.log("  -> ✅ Guest expensive rate limit test passed!");
  } else {
    console.error("  -> ❌ Guest expensive rate limit test failed.");
    process.exit(1);
  }

  console.log("\n=========================================");
  console.log("✅ ALL RATE LIMIT TESTS PASSED SUCCESSFULLY!");
  console.log("=========================================");
}

runTest().catch(console.error);
