import { RAGEngine } from '../../server/ragEngine.js';

const testCases = [
  { q: "What is Section 154 of the CrPC?", desc: "Section 154 English" },
  { q: "پولیس نے ایف آئی آر درج کرنے سے انکار کر دیا۔ میں کیا کروں؟", desc: "FIR Refusal Urdu" },
  { q: "Police FIR register nahi kar rahi, kya karun?", desc: "FIR Refusal Roman Urdu" },
  { q: "What happens after arrest?", desc: "Arrest NL query" },
  { q: "How do I apply for bail?", desc: "Bail procedure NL query" },
  { q: "Bail ka procedure kya hai?", desc: "Bail procedure Roman Urdu" },
  { q: "What is the procedure for remand?", desc: "Remand English" },
  { q: "What is the form of a summons or warrant of arrest?", desc: "Summons/Warrant English" },
  { q: "What is the complaint procedure before a Magistrate?", desc: "Complaint procedure English" }
];

async function runVerification() {
  console.log("=========================================");
  console.log("P39 CrPC DATASET VERIFICATION SUITE");
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
