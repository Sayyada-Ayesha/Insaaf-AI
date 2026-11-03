import { RAGEngine } from '../../server/ragEngine.js';

const testCases = [
  { q: "What is the punishment for theft?", desc: "Theft English" },
  { q: "چوری کی سزا کیا ہے؟", desc: "Theft Urdu" },
  { q: "Chori ki saza kya hai?", desc: "Theft Roman Urdu" },
  { q: "What is the punishment for cheating?", desc: "Cheating English" },
  { q: "Criminal intimidation ki kya saza hai?", desc: "Criminal intimidation Roman Urdu" },
  { q: "What is the penalty for causing hurt?", desc: "Hurt English" },
  { q: "What is the punishment for robbery?", desc: "Robbery English" },
  { q: "What is the punishment for murder?", desc: "Homicide Section 302" },
  { q: "Someone committed trespass on my land.", desc: "Property Offence/Trespass situation query" }
];

async function runVerification() {
  console.log("=========================================");
  console.log("P38 PPC DATASET VERIFICATION SUITE");
  console.log("=========================================\n");

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`[TEST ${i+1}] Query: "${tc.q}" (${tc.desc})`);
    
    const res = await RAGEngine.retrieve(tc.q, false); // Offline check
    
    console.log(`  -> Domain: ${res.domain}`);
    console.log(`  -> Lang: ${res.detectedLang}`);
    
    if (res.chunks.length === 0) {
      console.log(`  -> ❌ FAILED: No chunks retrieved.`);
    } else {
      console.log(`  -> ✅ SUCCESS: Retrieved ${res.chunks.length} chunks. Top score: ${res.chunks[0].score.toFixed(2)}`);
      console.log(`     Top chunk: [${res.chunks[0].docId}] ${res.chunks[0].key} - ${res.chunks[0].title}`);
      console.log(`     Section Title: ${res.chunks[0].chunkTitle}`);
      console.log(`     URL: ${res.chunks[0].sourceURL}`);
    }
    console.log("-----------------------------------------");
  }
}

runVerification().catch(console.error);
