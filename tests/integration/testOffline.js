import fetch from 'node-fetch';

async function testOffline() {
  console.log("\n==================================================");
  console.log("TESTING OFFLINE RAG");
  console.log("==================================================\n");

  const q = "What is the punishment for theft?";
  console.log(`[TEST]: ${q}`);
  
  // We'll simulate offline by sending a request when we know the backend will exhaust fallback chain or by temporarily renaming .env
  // Wait, I can just hit the backend. But the backend has Gemini enabled so it'll succeed!
  // To truly test offline, we can modify the test script to temporarily move the .env file.
}
testOffline();
