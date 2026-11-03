// PHASE 19 — LIGHTWEIGHT REAL RUNTIME TESTS (13 targeted items, no giant audit).
// Exercises the REAL runtime path over live HTTP against the deterministic
// offline owned-model route (AI_PROVIDER=insaaf from .env — no external calls).
//
// Item 7 (Library "Read More") is browser-level and runs separately:
//   npm run build  (then)
//   node server/testReadMorePuppeteer.js        (TEST_BASE=http://localhost:4127)
//
// Usage: node server/testP19Runtime.js          (spawns its own backend on TEST_PORT)
import { spawn } from 'node:child_process';

const PORT = Number(process.env.TEST_PORT || 4235);
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`    PASS  ${name}`); }
  else { fail++; console.log(`    FAIL  ${name}`); }
  return !!cond;
}
const item = (n, label) => console.log(`\n== P19-${n} — ${label} ==`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REFUSAL_MARKERS = ['outside verified knowledge scope', 'could not find a verified Pakistani legal source', 'data unavailable', 'not in my knowledge'];
const URDU_RE = /[\u0600-\u06FF]/;

async function sseChat(query, lang) {
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: query, preferredLanguage: lang || 'en' })
  });
  const raw = await res.text();
  const out = { text: '', meta: null, status: res.status };
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6);
    if (payload === '[DONE]') break;
    try {
      const j = JSON.parse(payload);
      if (typeof j.chunk === 'string') out.text += j.chunk;
      if (j.meta) out.meta = j.meta;
    } catch (e) { /* non-JSON frame */ }
  }
  return out;
}
async function postJSON(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch (e) { json = { parseError: String(e) }; }
  return { status: res.status, json };
}
const stripHtml = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Spawn the backend under test (same pattern as testFinalIntelligence.js).
// ---------------------------------------------------------------------------
console.log(`[P19] Starting backend on port ${PORT} …`);
const child = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'pipe']
});
let bootErr = '';
child.stderr.on('data', d => { bootErr += String(d); });
const died = new Promise(resolve => child.on('exit', code => resolve(code)));

async function waitForHealth(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) break;
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch (e) { /* not up yet */ }
    await sleep(500);
  }
  return false;
}

let eHtml = ''; // captured complete EN legal notice (used by P19-11)

try {
  if (!(await waitForHealth(45000))) {
    console.error('[P19] Backend failed to boot:', bootErr.slice(0, 500));
    process.exit(2);
  }
  console.log('[P19] Backend healthy.\n');

  // ============ P19-1 — legal question with an EXACT section ===============
  item(1, 'legal question with exact section (chat)');
  {
    const a = await sseChat('What is the punishment for theft under Section 379 of the Pakistan Penal Code?', 'en');
    const srcs = (a.meta && Array.isArray(a.meta.sources)) ? a.meta.sources : [];
    ok(a.status === 200 && a.text.length > 200, `streamed substantive answer (${a.text.length} chars)`);
    // Exact-section lookups with a high exact score take the deterministic
    // "DIRECT VERIFIED LEGAL REFERENCE" path: the verified corpus section is
    // quoted verbatim (no AI generation, no meta frame by design).
    ok(a.text.includes('Section 379') && /theft/i.test(a.text) && /imprisonment/i.test(a.text) && /fine/i.test(a.text),
      'answer quotes the verified corpus Section 379 verbatim');
    ok(!REFUSAL_MARKERS.some(m => a.text.includes(m)), 'no cold refusal for an exact-section question');
    ok(!URDU_RE.test(a.text), 'EN answer has no Urdu script');
    ok(srcs.length === 0
      ? /VERIFIED LEGAL REFERENCE|directly from the verified law corpus/.test(a.text)
      : a.meta.isOffline === true,
      'offline direct-corpus (or meta-verified offline) path confirmed');
  }

  // ============ P19-2 — legal question in natural language =================
  item(2, 'legal question in natural language (chat)');
  {
    const a = await sseChat('What is the procedure if police refuse to register my FIR?', 'en');
    const srcs = (a.meta && Array.isArray(a.meta.sources)) ? a.meta.sources : [];
    ok(a.status === 200 && a.text.length > 200, `streamed substantive answer (${a.text.length} chars)`);
    ok(srcs.some(s => /criminal procedure/i.test(s.title) || String(s.key) === '154'), `grounded on CrPC Section 154 (${srcs.map(s => s.key || s.title).slice(0, 3).join(', ')})`);
    ok(/Issue/.test(a.text) && /Procedure/.test(a.text), 'answer structured (Issue/Procedure/Source) from retrieved context');
    ok(!REFUSAL_MARKERS.some(m => a.text.includes(m)), 'no cold refusal');
  }

  // ============ P19-3 — Roman Urdu legal question ==========================
  item(3, 'Roman Urdu legal question (chat)');
  {
    const a = await sseChat('Mujhe police ne FIR register nahi ki, ab main kya karun?', 'roman_urdu');
    ok(a.status === 200 && a.text.length > 150, `streamed substantive answer (${a.text.length} chars)`);
    ok(!URDU_RE.test(a.text), 'Roman Urdu answer stays Latin-script (no Urdu script)');
    ok(/Masla|Laagu hone wala qanoon|Kya karna chahiye/i.test(a.text), 'answer actually renders in Roman Urdu');
  }

  // ============ P19-4 — cross-border question ==============================
  item(4, 'cross-border question (chat)');
  {
    const a = await sseChat('I am a Pakistani working in Dubai and my employer is withholding my salary. What should I do?', 'en');
    const srcs = (a.meta && Array.isArray(a.meta.sources)) ? a.meta.sources : [];
    ok(a.status === 200 && a.text.length > 150, `streamed substantive answer (${a.text.length} chars)`);
    ok(srcs.length >= 1 && srcs.every(s => s.domain === 'cross-border'), `routed to cross-border domain (${srcs[0] ? srcs[0].title : 'none'})`);
    ok(!REFUSAL_MARKERS.some(m => a.text.includes(m)), 'no cold refusal for overseas matter');
  }

  // ============ P19-5 — Agent legal answer =================================
  item(5, 'Agent legal answer (agent)');
  {
    const c = await postJSON('/api/ai/agent', { message: 'I need help understanding a legal notice.', preferredLanguage: 'en' });
    const reply = String(c.json.reply || '');
    ok(c.status === 200 && reply.length > 300, `agent answered substantively (${reply.length} chars)`);
    ok(Array.isArray(c.json.sources) && c.json.sources.length >= 1, `agent used the retrieval pipeline (${(c.json.sources || []).length} sources)`);
    ok(/Law that may apply|law/i.test(reply), 'answer structured from retrieved context');
    ok(!REFUSAL_MARKERS.some(m => reply.includes(m)), 'no refusal while context exists');
    ok(c.json.isOffline === true, 'offline owned-model path confirmed');
  }

  // ============ P19-6 — Agent navigation ===================================
  item(6, 'Agent navigation (agent → route action)');
  {
    const c = await postJSON('/api/ai/agent', { message: 'I need a lawyer in Lahore for a family case.', preferredLanguage: 'en' });
    const reply = String(c.json.reply || '');
    ok(c.status === 200 && reply.length > 100, `agent answered (${reply.length} chars)`);
    ok(Array.isArray(c.json.actions) && c.json.actions.includes('lawyers'), `navigation action emitted: ${JSON.stringify(c.json.actions)}`);
    ok(/verified lawyer directory/i.test(reply), 'points to the verified in-app directory');
    ok(!/\b(?:advocate|lawyer|wakil)\s+[A-Z][a-z]+ [A-Z][a-z]+/.test(reply.replace(/directory|section|searchable|individual|recommend|profiles/gi, '')), 'never fabricates a lawyer name');
    ok(c.json.isOffline === true, 'curated offline path confirmed');
  }

  // P19-7 (Library Read More) is browser-level: node server/testReadMorePuppeteer.js
  console.log('\n== P19-7 — Library "Read More" — covered by server/testReadMorePuppeteer.js (real-browser modal walk) ==');

  // ============ P19-8 — complete legal notice (EN) =========================
  item(8, 'complete legal notice (generate, English)');
  {
    const e = await postJSON('/api/ai/generate', { requestText: 'Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000.', preferredLanguage: 'en' });
    const h = String(e.json.html || '');
    ok(e.status === 200 && h.length > 1500, `complete document produced (${h.length} chars)`);
    ok(e.json.type === 'Legal Notice for Recovery of Unpaid Money', 'document type detected: ' + e.json.type);
    ok(h.includes('LEGAL NOTICE FOR RECOVERY OF UNPAID MONEY'), 'professional heading');
    ok(h.includes('That the sum of Rs 500,000, being an unpaid loan'), 'claim recital survives as a numbered prose clause');
    ok(h.includes('Prepared with INSAaf AI'), 'verified footer preserved');
    ok(!URDU_RE.test(h), 'English document has no Urdu script');
    ok((h.match(/_{8,}/g) || []).length <= 10, 'signature fill-ins only — not a wall of blanks');
    ok(Array.isArray(e.json.missingInformation) && e.json.missingInformation.length >= 1, 'missing mandatory items surfaced as asks');
    ok(e.json.isOffline === true, 'offline owned-model path confirmed');
    eHtml = h;
  }

  // ============ P19-9 — complete FIR application ===========================
  item(9, 'complete FIR application (generate)');
  {
    const fReq = 'Write an application to the SHO for registration of FIR based on these facts: my motorcycle (Honda CD 70, white) was stolen from outside my house in Gulberg III, Lahore on 15 March 2026. I had parked it at 8 pm and found it missing the next morning.';
    const f = await postJSON('/api/ai/generate', { requestText: fReq, preferredLanguage: 'en' });
    const h = stripHtml(f.json.html);
    ok(f.status === 200 && typeof f.json.html === 'string' && f.json.html.length > 1200, `application produced (${String(f.json.html || '').length} chars)`);
    ok(/FIR/i.test(f.json.type), 'type detected: ' + f.json.type);
    ok(h.includes('stolen from outside my house') && h.includes('Honda CD 70') && h.includes('15 March 2026'), 'user facts preserved in professional prose');
    ok(Array.isArray(f.json.missingInformation) && f.json.missingInformation.some(m => /police station/i.test(m)), 'missing station-name surfaced as the essential ask');
    ok((String(f.json.html).match(/_{8,}/g) || []).length <= 10, 'signature fill-ins only — not a wall of blanks');
    ok(String(f.json.html).includes('Prepared with INSAaf AI'), 'footer preserved');
  }

  // ============ P19-10 — uploaded-document reply ===========================
  item(10, 'uploaded-document reply (document-reply)');
  {
    const NOTICE = `LEGAL NOTICE FOR RECOVERY OF OUTSTANDING AMOUNT

From: Bilal Traders (Pvt) Ltd., Shop 12, Hall Road, Lahore
To: Ahmed Khan, House 44, Gulberg III, Lahore
Dated: 12 August 2026

Subject: Notice of demand for outstanding payment of Rs 750,000

Dear Sir,

You are hereby required to pay the outstanding amount of Rs 750,000 being the price of goods supplied to you between January and June 2026. Despite repeated demands made on 3 March 2026 and 5 May 2026, you have failed to make the payment.

Take notice that if the said amount is not paid within 15 days of the receipt of this notice, we shall be constrained to institute legal proceedings against you for the recovery of the said amount along with costs.

Yours faithfully,
For Bilal Traders (Pvt) Ltd.`;
    const g = await postJSON('/api/ai/document-reply', { text: NOTICE, instruction: 'Iska complete reply likh do', replyType: 'reply', language: 'en' });
    const h = String(g.json.html || '');
    ok(g.status === 200 && h.length > 1000, `complete reply drafted from the uploaded document (${h.length} chars)`);
    ok(h.includes('Ahmed Khan') && h.includes('Bilal Traders') && h.includes('12 August 2026'), 'parties and source date preserved');
    ok(h.includes('Amount claimed:') && h.includes('Rs 750,000'), 'claimed amount preserved');
    ok(h.includes('Reply / Grounds:') && !h.includes('Iska complete reply likh do'), 'reply body uses user instructions, never app-chrome');
    ok(h.includes('[MISSING: your point-by-point response'), 'user grounds honestly marked while the document completes');
    ok(h.includes('Prepared with INSAaf AI'), 'footer preserved');
  }

  // ============ P19-11 — change request on an existing draft ===============
  item(11, 'change request on existing draft (document-chat)');
  {
    const hRes = await postJSON('/api/ai/document-chat', { context: eHtml, history: [], userInput: 'Change the amount to Rs 750,000 and add that I already sent two written notices.' });
    const summary = String(hRes.json.summary || '');
    const h = String(hRes.json.html || '');
    ok(hRes.status === 200, 'document-chat endpoint responded 200');
    ok(/^Changed/.test(summary) && !/could not|unchanged/i.test(summary.slice(0, 60)), 'change applied — no unnecessary clarification');
    ok(h.includes('Rs 750,000') && !h.includes('500,000'), 'amount actually replaced in the document');
    ok(/two written notices/i.test(h), 'user fact added as a new paragraph');
    ok(/1\.|2\.|3\./.test(stripHtml(h)), 'numbering/structure preserved');
  }

  // ============ P19-12 — English document ==================================
  item(12, 'English document (generate, EN)');
  {
    // eHtml from P19-8 already verified: professional EN legal notice with
    // prose clauses, footer and no Urdu script (see P19-8 checks).
    ok(eHtml.length > 1500 && !URDU_RE.test(eHtml), 'complete English document, no Urdu script');
  }

  // ============ P19-13 — Urdu Script document ==============================
  item(13, 'Urdu Script document (generate, ur)');
  {
    const eu = await postJSON('/api/ai/generate', { requestText: 'Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000.', preferredLanguage: 'ur' });
    const h = String(eu.json.html || '');
    ok(eu.status === 200 && h.length > 1000, `Urdu document produced (${h.length} chars)`);
    ok(URDU_RE.test(h), 'document rendered in Urdu script');
    ok(!h.includes('the sum of'), 'no system-generated English prose inside the Urdu document');
    ok(h.includes('بطور بقایا قرض') && h.includes('رقم Rs 500,000'), 'localized Urdu claim recital keeps the amount verbatim');
  }
} finally {
  child.kill();
  await sleep(400);
}

// ---------------------------------------------------------------------------
console.log('\n=================  P19 RESULT  =================');
console.log(`  runtime items 1-6, 8-13 exercised live (HTTP): ${pass} passed, ${fail} failed`);
console.log('  P19-7 (Library Read More): browser-level — node server/testReadMorePuppeteer.js after npm run build');
process.exit(fail ? 1 : 0);
