import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function runTests() {
  console.log("==================================================");
  console.log("REAL-TIME AI + RAG CHAT EXPERIENCE TEST SUITE");
  console.log("==================================================\n");

  const testCases = [
    {
      name: "1. Theft Punishment (Roman Urdu)",
      query: "Chori ki saza kya hai?",
      lang: "roman_urdu",
      check: (text) => text.includes("379") || text.includes("PPC") || text.includes("saal") || text.includes("saza")
    },
    {
      name: "2. FIR Refusal Remedy (English)",
      query: "What should I do if the police refuse to register my FIR?",
      lang: "en",
      check: (text) => text.includes("22A") || text.includes("Justice of Peace") || text.includes("Magistrate") || text.includes("complaint")
    },
    {
      name: "3. Cyber Harassment (Urdu Script)",
      query: "مجھے آن لائن ہراساں کیا جا رہا ہے، مجھے کیا کرنا چاہیے؟",
      lang: "ur",
      check: (text) => text.length > 30
    },
    {
      name: "4. Grade 11 Officer Query (Roman Urdu)",
      query: "11 grade ka officer mujhe rok raha hai, main kya karun?",
      lang: "roman_urdu",
      check: (text) => text.length > 20
    }
  ];

  for (const tc of testCases) {
    console.log(`[TEST] ${tc.name}`);
    console.log(`  -> Query: "${tc.query}"`);
    const res = await fetch(`${BASE_URL}/api/ai/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_chat_token' },
      body: JSON.stringify({ userQuery: tc.query, preferredLanguage: tc.lang })
    });

    const data = await res.json();
    console.log(`  -> Response snippet:\n     ${data.text.substring(0, 200).replace(/\n/g, ' ')}...`);

    const wordCount = data.text.split(/\s+/).length;
    console.log(`  -> Response word count: ${wordCount} words (Concise check: ${wordCount < 150 ? 'PASS' : 'WARN'})`);

    if (tc.check(data.text)) {
      console.log(`  -> ✅ ${tc.name} PASSED!\n`);
    } else {
      console.error(`  -> ❌ ${tc.name} FAILED validation!\n`);
      process.exit(1);
    }
  }

  // Test SSE streaming metadata endpoint
  console.log("[TEST] 5. SSE Streaming Route Payload & Sources Metadata Check...");
  const streamRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_chat_token' },
    body: JSON.stringify({ userQuery: "Article 25 of Constitution", preferredLanguage: "en" })
  });

  const text = await streamRes.text();
  console.log("  -> SSE Stream Output Snippet:\n", text.substring(0, 300));
  if (text.includes("sources") || text.includes("data:")) {
    console.log("  -> ✅ SSE Metadata Streaming PASSED!\n");
  } else {
    console.error("  -> ❌ SSE Streaming FAILED validation!\n");
    process.exit(1);
  }

  console.log("==================================================");
  console.log("✅ ALL REAL-TIME AI + RAG CHAT TESTS PASSED!");
  console.log("==================================================");
}

runTests().catch(console.error);
