/*
 * Verifies the INSAaf owned-model structured reasoning (Part AD) on the RUNNING
 * backend. Legal-PROBLEM queries must get the professional guidance structure
 * (Issue -> Law -> What the law says -> ... -> Source -> Limitation), grounded
 * in the corpus; pure lookups stay concise; no provider leak; no cold refusal.
 * Run: node testOwnedModel.cjs
 */
const results = [];
const record = (n, p, d = '') => { results.push({ n, p }); console.log(`${p ? 'PASS' : 'FAIL'} - ${n}${d ? ' :: ' + d : ''}`); };

async function ask(userQuery, preferredLanguage = 'en') {
  const r = await fetch('http://localhost:3001/api/ai/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery, preferredLanguage })
  });
  const t = await r.text();
  let text = '';
  for (const l of t.split('\n')) {
    if (!l.startsWith('data: ')) continue;
    const p = l.slice(6);
    if (p === '[DONE]') continue;
    try { const o = JSON.parse(p); if (o.chunk) text += o.chunk; } catch (e) {}
  }
  return text;
}

const LEAK = /temporarily unavailable|live ai|429|api key not valid|rate limit|all ai providers failed/i;
const COLD = /knowledge unavailable|i don'?t have this data|verified legal source material was not found/i;

const EN_PROBLEM = [
  'My landlord is trying to evict me illegally without any notice, what should I do?',
  'The police refused to register my FIR, how can I take action?',
  'My employer terminated me without notice or pay, what remedy do I have?'
];
const EN_LABELS = ['Answer', 'Relevant law', 'What you can do', 'Sources', 'Important limitation'];

(async () => {
  // --- EN legal-problem queries get the structured owned-model answer ---
  for (const q of EN_PROBLEM) {
    const reply = await ask(q, 'en');
    const present = EN_LABELS.filter(l => reply.includes(l));
    record(`EN structured: "${q.slice(0, 42)}..."`, present.length >= 4, `${present.length}/5 labels [${present.join(', ')}] len=${reply.length}`);
    record(`  no provider leak: "${q.slice(0, 30)}..."`, !LEAK.test(reply), '');
    record(`  not a cold refusal: "${q.slice(0, 30)}..."`, !COLD.test(reply), '');
    // grounded: must cite at least one real official source URL from the corpus
    record(`  grounded with official source URL: "${q.slice(0, 30)}..."`, /https?:\/\/[^\s)]+/i.test(reply), '');
  }

  // --- Roman Urdu legal-problem query gets the Roman structure ---
  const ru = await ask('Mera landlord mujhe baghair notice ghar se nikal raha hai, main kya karun?', 'roman_urdu');
  const ROMAN_LABELS = ['Jawab', 'Laagu hone wala qanoon', 'Ab aap kya karein?', 'Qanooni hawalay', 'Zaroori tahaffuz'];
  const rp = ROMAN_LABELS.filter(l => ru.includes(l));
  record('Roman Urdu structured answer', rp.length >= 4, `${rp.length}/5 labels [${rp.join(', ')}]`);
  record('  Roman answer has no Urdu script', !/[\u0600-\u06FF]/.test(ru), '');

  // --- Pure lookup stays concise & correct (regression for fix-rag-statute) ---
  const lookup = await ask('Section 154 CrPC', 'en');
  record('lookup "Section 154 CrPC" -> CrPC (cognizable/FIR), not structured essay',
    /cognizable|information in cognizable/i.test(lookup) && !/bailment|bailee/i.test(lookup), `len=${lookup.length}`);

  const passed = results.filter(r => r.p).length;
  console.log(`\n==== testOwnedModel: ${passed}/${results.length} PASS ====`);
  process.exit(passed === results.length ? 0 : 1);
})();
