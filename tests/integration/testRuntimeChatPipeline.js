import fetch from 'node-fetch';

async function parseSSEStream(response) {
  let accumulated = '';
  let meta = null;
  let isOffline = false;

  const text = await response.text();
  const lines = text.split('\n\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const dataStr = line.replace(/^data:\s*/, '').trim();
      if (dataStr === '[DONE]') break;
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.meta) {
          meta = parsed.meta;
          if (typeof parsed.meta.isOffline === 'boolean') isOffline = parsed.meta.isOffline;
        }
        if (typeof parsed.isOffline === 'boolean') isOffline = parsed.isOffline;
        if (parsed.chunk) accumulated += parsed.chunk;
      } catch (e) {
        // Ignore parse error
      }
    }
  }

  return { text: accumulated, meta, isOffline };
}

async function testFullPipeline() {
  console.log("==================================================");
  console.log("TESTING COMPLETE RUNTIME AI CHAT PIPELINE");
  console.log("==================================================\n");

  const testQueries = [
    { name: "Article 25 Constitution", query: "What is Article 25 of the Constitution of Pakistan?", lang: "en" },
    { name: "Theft Punishment (EN)", query: "What is the punishment for theft?", lang: "en" },
    { name: "FIR Refusal Steps (Roman Urdu)", query: "Police meri FIR register nahi kar rahi, kya karun?", lang: "roman_urdu" },
    { name: "Theft Punishment (Urdu)", query: "چوری کی سزا کیا ہے؟", lang: "ur" },
    { name: "Theft Punishment (Roman Urdu)", query: "Chori ki saza kya hai?", lang: "roman_urdu" }
  ];

  for (const t of testQueries) {
    console.log(`[TEST]: ${t.name}`);
    console.log(`  Query: "${t.query}" (${t.lang})`);

    const res = await fetch('http://localhost:3001/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuery: t.query, history: [], preferredLanguage: t.lang })
    });

    if (!res.ok) {
      console.error(`  ❌ HTTP ERROR: ${res.status}`);
      continue;
    }

    const result = await parseSSEStream(res);
    const wordCount = (result.text || '').split(/\s+/).filter(Boolean).length;
    console.log(`  Output Length: ${result.text.length} chars (${wordCount} words)`);
    console.log(`  Is Offline / Fallback: ${result.isOffline}`);
    console.log(`  Snippet: ${result.text.substring(0, 180).replace(/\n/g, ' ')}...`);

    if (result.text.trim().length > 0) {
      console.log(`  ✅ ${t.name} RECEIVED VALID ANSWER!\n`);
    } else {
      console.error(`  ❌ ${t.name} RETURNED BLANK ANSWER!\n`);
    }
  }
}

testFullPipeline();
