import { RAGEngine } from '../../server/ragEngine.js';

const testCases = [
  { q: "What is the law and punishment for cyber harassment?", desc: "Cyber Harassment English" },
  { q: "Someone is blackmailing me online with my pictures.", desc: "Online Blackmail NL query" },
  { q: "Online fraud par kya law apply hota hai?", desc: "Cyber Fraud Roman Urdu" },
  { q: "What is the punishment for unauthorized access to an information system?", desc: "Unauthorized Access English" },
  { q: "Someone is using my identity details online without permission.", desc: "Identity Theft NL query" },
  { q: "How do I file a complaint with the FIA Cybercrime Wing?", desc: "FIA Complaint Procedure English" },
  { q: "Cyber harassment ki saza kya hai?", desc: "Harassment Punishment Roman Urdu" },
  { q: "سائبر ہراسگی کی کیا سزا ہے؟", desc: "Harassment Punishment Urdu script" }
];

async function runVerification() {
  console.log("=========================================");
  console.log("P40 PECA DATASET VERIFICATION SUITE");
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
