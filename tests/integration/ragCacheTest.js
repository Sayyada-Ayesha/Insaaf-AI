import fetch from 'node-fetch';
import { execSync } from 'child_process';
import fs from 'fs';

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function runTest() {
  console.log("=========================================");
  console.log("P47 SAFE AI & RAG CACHING VERIFICATION SUITE");
  console.log("=========================================\n");

  // Step 1: Initial metrics
  const mRes0 = await fetch(`${BASE_URL}/api/ai/cost`);
  const initialMetrics = await mRes0.json();
  console.log("Initial Metrics:", initialMetrics);

  const ts = Date.now();
  const queryEn = `What is Article 25 of the Constitution? [id:${ts}]`;
  const queryRu = `Article 25 kia hai? [id:${ts}]`;

  // Step 2: First query (RAG Miss, AI Cache Miss)
  console.log(`\n[TEST 1] First query: '${queryEn}'`);
  const res1 = await fetch(`${BASE_URL}/api/ai/advice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: queryEn, preferredLanguage: "en" })
  });
  const data1 = await res1.json();
  
  const mRes1 = await fetch(`${BASE_URL}/api/ai/cost`);
  const metrics1 = await mRes1.json();
  console.log("Metrics after Query 1:", metrics1);

  // Step 3: Second query (RAG Hit, AI Cache Hit)
  console.log(`\n[TEST 2] Second identical query: '${queryEn}' (Should Hit Cache)`);
  const res2 = await fetch(`${BASE_URL}/api/ai/advice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: queryEn, preferredLanguage: "en" })
  });
  const data2 = await res2.json();

  const mRes2 = await fetch(`${BASE_URL}/api/ai/cost`);
  const metrics2 = await mRes2.json();
  console.log("Metrics after Query 2 (Cache check):", metrics2);

  // Step 4: Language change (Different Cache Key check)
  console.log(`\n[TEST 3] Query with different language: '${queryRu}' (Should Miss Cache)`);
  const res3 = await fetch(`${BASE_URL}/api/ai/advice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: queryRu, preferredLanguage: "roman_urdu" })
  });
  
  const mRes3 = await fetch(`${BASE_URL}/api/ai/cost`);
  const metrics3 = await mRes3.json();
  console.log("Metrics after Language Change Query:", metrics3);

  // Step 5: Touch RAG index to trigger invalidation (P47)
  console.log("\n[TEST 4] Touching RAG Index to trigger cache invalidation...");
  const now = new Date();
  fs.utimesSync('rag/indexes/rag_index.json', now, now);
  console.log("  -> Index touch completed.");

  // Step 6: Query again (Should Miss Cache due to invalidation)
  console.log(`\n[TEST 5] Query after RAG Rebuild: '${queryEn}'`);
  const res4 = await fetch(`${BASE_URL}/api/ai/advice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: queryEn, preferredLanguage: "en" })
  });

  const mRes4 = await fetch(`${BASE_URL}/api/ai/cost`);
  const metrics4 = await mRes4.json();
  console.log("Metrics after RAG Rebuild Query:", metrics4);

  // Verify assertions
  const hasRagHit = metrics2.ragCacheHits > metrics1.ragCacheHits;
  const hasAiHit = metrics2.cacheHits > metrics1.cacheHits;
  const hasLangMiss = metrics3.ragCacheMisses > metrics2.ragCacheMisses;
  const hasInvalidationMiss = metrics4.ragCacheMisses > metrics3.ragCacheMisses;

  if (hasRagHit && hasAiHit && hasLangMiss && hasInvalidationMiss) {
    console.log("\n✅ SAFE AI & RAG CACHING VERIFICATION PASSED!");
  } else {
    console.error("\n❌ SAFE AI & RAG CACHING VERIFICATION FAILED.");
    console.error(`  -> hasRagHit: ${hasRagHit}`);
    console.error(`  -> hasAiHit: ${hasAiHit}`);
    console.error(`  -> hasLangMiss: ${hasLangMiss}`);
    console.error(`  -> hasInvalidationMiss: ${hasInvalidationMiss}`);
    process.exit(1);
  }
}

runTest().catch(console.error);
