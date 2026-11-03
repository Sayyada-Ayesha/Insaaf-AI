import fetch from 'node-fetch';

async function testAdvice() {
  console.log("Testing Non-Streaming Advice Endpoint (/api/ai/advice)...");
  const res = await fetch('http://localhost:3001/api/ai/advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: "Chori ki saza kya hai?", preferredLanguage: 'roman_urdu' })
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Advice Response:", data.text ? data.text.substring(0, 150) + "..." : "EMPTY");
  if (data.text) {
    console.log("✅ NON-STREAMING ADVICE VERIFIED!");
  } else {
    console.error("❌ NON-STREAMING ADVICE FAILED!");
  }
}

testAdvice();
