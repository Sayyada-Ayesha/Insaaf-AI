import fetch from 'node-fetch';

async function testStream() {
  console.log("Simulating Browser Fetch to http://localhost:3001/api/ai/chat ...");
  try {
    const res = await fetch('http://localhost:3001/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_user_token'
      },
      body: JSON.stringify({
        userQuery: "What is Article 25 of the Constitution of Pakistan?",
        history: [],
        preferredLanguage: 'en'
      })
    });

    console.log("HTTP Status:", res.status);
    console.log("Headers:", res.headers.raw());

    const body = await res.text();
    console.log("Raw Response Body:\n", body);
  } catch (err) {
    console.error("Stream Fetch Error:", err);
  }
}

testStream();
