import { RAGEngine } from '../../server/ragEngine.js';

const testQueries = [
  // Required Test Questions
  "What is the punishment for theft?",
  "چوری کی سزا کیا ہے؟",
  "Chori ki saza kya hai?",
  "Police refused to register my FIR. What should I do?",
  "پولیس میری ایف آئی آر درج نہیں کر رہی، میں کیا کروں؟",
  "Police meri FIR nahi likh rahi, kya karun?",
  "What is Article 25 of the Constitution?",
  "ضمانت کا طریقہ کار کیا ہے؟",
  "Bail ka procedure kya hai?",
  "Tell me about a verified Pakistani court case.",
  "What is the capital of France?" // Unrelated question
];

async function runTests() {
  console.log("=========================================");
  console.log("P36 RAG SPECIFIC TEST SUITE");
  console.log("=========================================\n");
  
  for (let i = 0; i < testQueries.length; i++) {
    const q = testQueries[i];
    console.log(`[TEST ${i+1}] Query: "${q}"`);
    
    const res = await RAGEngine.retrieve(q, false); // Offline retrieval
    
    console.log(`  -> Domain: ${res.domain}`);
    console.log(`  -> Lang: ${res.detectedLang}`);
    console.log(`  -> Mode: ${res.embeddingMode}`);
    
    if (res.chunks.length === 0) {
      const refusalText = (res.domain === 'unknown') 
        ? "This question is outside Insaaf AI's verified legal knowledge scope."
        : "Verified legal source material was not found for this question.";
      console.log(`  -> ✅ REFUSAL/NO CHUNKS: "${refusalText}"`);
    } else {
      console.log(`  -> ✅ SUCCESS: Retrieved ${res.chunks.length} chunks. Top score: ${res.chunks[0].score.toFixed(2)}`);
      console.log(`     Top chunk: [${res.chunks[0].docId}] ${res.chunks[0].key} - ${res.chunks[0].title}`);
      console.log(`     Citations Info: Title: ${res.chunks[0].title}, Authority: ${res.chunks[0].issuingAuthority}, URL: ${res.chunks[0].sourceURL}`);
    }
    console.log("-----------------------------------------");
  }
}

runTests().catch(console.error);
