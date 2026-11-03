import { RAGEngine } from '../../server/ragEngine.js';

const testCases = [
  { q: "I am a student and my university is not resolving my complaint.", desc: "Student grievance English" },
  { q: "A university teacher is harassing me, what can I do?", desc: "Student harassment English" },
  { q: "Where can I get legal help as a student?", desc: "Legal-aid request English" },
  { q: "University fee issue details.", desc: "Fee issue English" },
  { q: "Someone is cyberbullying me at university.", desc: "Cyber complaint English" },
  { q: "یونیورسٹی میں ہراسگی کی شکایت کیسے درج کریں؟", desc: "Student harassment Urdu script" },
  { q: "Student free legal aid kaise milegi?", desc: "Legal-aid Roman Urdu" }
];

async function runVerification() {
  console.log("=========================================");
  console.log("P41 STUDENT & LEGAL AID VERIFICATION SUITE");
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
      console.log(`     Section/Article Title: ${res.chunks[0].chunkTitle}`);
      console.log(`     URL: ${res.chunks[0].sourceURL}`);
    }
    console.log("-----------------------------------------");
  }
}

runVerification().catch(console.error);
