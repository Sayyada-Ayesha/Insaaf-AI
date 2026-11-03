import fetch from 'node-fetch';

const queries = [
  { q: "agr koi mujhe bully kry to kai krun", lang: "roman_urdu" },
  { q: "Chori ki saza kya hai?", lang: "roman_urdu" },
  { q: "agar mujhe dhamki mil rahi ho to kya karun", lang: "roman_urdu" },
  { q: "Police FIR nahi likh rahi", lang: "roman_urdu" },
  { q: "Someone is blackmailing me online", lang: "en" },
  { q: "cyber harassment ki saza kya hai", lang: "roman_urdu" },
  { q: "Tell me about a Pakistani case related to criminal intimidation", lang: "en" },
  { q: "What are my rights under Article 25?", lang: "en" },
  { q: "آرٹیکل 25 کے تحت میرے حقوق کیا ہیں؟", lang: "ur" },
  { q: "Article 25 ke tehat mere huqooq kya hain?", lang: "roman_urdu" },
];

async function parseSSEStream(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const raw = await response.text();
  const lines = raw.split('\n');
  let finalResponse = '';
  let meta = null;
  let offlineFallback = false;
  
  for (const line of lines) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      try {
        const parsed = JSON.parse(line.replace('data: ', ''));
        if (parsed.meta) meta = parsed.meta;
        if (parsed.chunk) finalResponse += parsed.chunk;
        if (parsed.isOffline) offlineFallback = true;
      } catch (e) {
        // ignore
      }
    }
  }
  return { finalResponse, meta, offlineFallback };
}

async function runTests() {
  console.log("==================================================");
  console.log("TESTING 10 EXACT QUERIES");
  console.log("==================================================\n");

  for (let i = 0; i < queries.length; i++) {
    const { q, lang } = queries[i];
    console.log(`[TEST ${i + 1}]: ${q} (${lang})`);
    try {
      const { finalResponse, meta, offlineFallback } = await parseSSEStream(
        'http://localhost:3001/api/ai/chat',
        { userQuery: q, preferredLanguage: lang }
      );
      
      const isRefusal = finalResponse.includes("outside Insaaf AI's verified legal knowledge scope") ||
                        finalResponse.includes("Verified Pakistani legal source material was not found");
      const providerStr = offlineFallback ? "OFFLINE (No Provider)" : "ONLINE (OpenAI/Gemini/Groq)";
      const snippet = finalResponse.substring(0, 100).replace(/\n/g, ' ') + (finalResponse.length > 100 ? "..." : "");
      let retrievedSource = "None";
      if (meta && meta.sources && meta.sources.length > 0) {
        retrievedSource = `${meta.sources[0].title} (${meta.sources[0].type} ${meta.sources[0].key})`;
      }

      console.log(`  Result: ${isRefusal ? "FAIL (Refusal)" : "PASS"}`);
      console.log(`  Provider: ${providerStr}`);
      console.log(`  Source: ${retrievedSource}`);
      console.log(`  Snippet: ${snippet}\n`);
    } catch (e) {
      console.log(`  Result: ERROR (${e.message})\n`);
    }
  }
}

runTests();
