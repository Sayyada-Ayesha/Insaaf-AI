import { RAGEngine } from '../../server/ragEngine.js';

const testCases = [
  { q: "What is Article 8 of the Constitution?", desc: "Article 8 (Laws inconsistent with fundamental rights to be void)" },
  { q: "What is Article 9 of the Constitution?", desc: "Article 9 (Security of person)" },
  { q: "What is Article 10A of the Constitution?", desc: "Article 10A (Right to fair trial)" },
  { q: "What is Article 14 of the Constitution?", desc: "Article 14 (Inviolability of dignity of man)" },
  { q: "What is Article 19 of the Constitution?", desc: "Article 19 (Freedom of speech)" },
  { q: "What is Article 25 of the Constitution?", desc: "Article 25 (Equality of citizens)" },
  { q: "What is Article 251 of the Constitution?", desc: "Article 251 (National language - later provision)" },
  { q: "آرٹیکل 25 کیا ہے؟", desc: "Urdu question for Article 25" },
  { q: "Article 25 ka kya matlab hai?", desc: "Roman Urdu question for Article 25" }
];

async function runVerification() {
  console.log("=========================================");
  console.log("P37 CONSTITUTION DATASET VERIFICATION SUITE");
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
      console.log(`     Title/Heading: ${res.chunks[0].chunkTitle}`);
      console.log(`     URL: ${res.chunks[0].sourceURL}`);
    }
    console.log("-----------------------------------------");
  }
}

runVerification().catch(console.error);
