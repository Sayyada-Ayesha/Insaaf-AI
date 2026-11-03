// Phase 15 — Targeted tests A–I against the REAL runtime path (live HTTP).
// This harness spawns its own backend (node server/index.js on TEST_PORT),
// waits for health, runs each spec test against /api/ai/chat (SSE),
// /agent, /generate, /document-reply and /document-chat, then shuts the
// server down. AI_PROVIDER=insaaf (from .env) makes every answer the
// deterministic offline owned-model path — no external model calls.
//
// Usage:  node server/testFinalIntelligence.js
//         (npm run build first, then node server/testReadMorePuppeteer.js for TEST D)
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const PORT = Number(process.env.TEST_PORT || 4231);
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const results = [];
function ok(cond, name) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); }
  return !!cond;
}
const section = t => console.log(`\n===== ${t} =====`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
const REFUSAL_MARKERS = ['outside verified knowledge scope', 'could not find a verified Pakistani legal source', 'data unavailable', 'not in my knowledge'];

// ---------------------------------------------------------------------------
// Spawn the backend under test.
// ---------------------------------------------------------------------------
console.log(`[Harness] Starting backend on port ${PORT} …`);
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
    if (died.then !== undefined && child.exitCode !== null) break;
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch (e) { /* not up yet */ }
    await sleep(500);
  }
  return false;
}

try {
  if (!(await waitForHealth(45000))) {
    console.error('[Harness] Backend failed to boot:', bootErr.slice(0, 500));
    process.exit(2);
  }
  console.log('[Harness] Backend healthy.');

  // ========================= TEST A — general cross-border =================
  section('TEST A — "What do I need to know before moving abroad?" (chat)');
  {
    const a = await sseChat('What do I need to know before moving abroad?', 'en');
    ok(a.status === 200 && a.text.length > 300, `A: chat streamed a substantive answer (${a.text.length} chars)`);
    ok(a.meta && Array.isArray(a.meta.sources) && a.meta.sources.length >= 1, `A: retrieved context sources attached (${a.meta ? a.meta.sources.length : 0})`);
    ok(a.text.includes('does not name a country'), 'A: asks the minimum country/purpose clarification');
    ok(!REFUSAL_MARKERS.some(m => a.text.includes(m)), 'A: no cold "outside verified scope" refusal');
    ok(!/[\u0600-\u06FF]/.test(a.text), 'A: EN chat never uses Urdu script');
  }

  // ========================= TEST B — cross-border country =================
  section('TEST B — "…moving from Pakistan to the UK for work?" (chat)');
  {
    const b = await sseChat('What do I need before moving from Pakistan to the UK for work?', 'en');
    ok(b.status === 200 && b.text.length > 300, `B: chat streamed a substantive answer (${b.text.length} chars)`);
    ok(b.text.includes('UK'), 'B: identifies the UK as the target country');
    ok(b.text.includes('ophrd.gov.pk') && b.text.includes('beoe.gov.pk'), 'B: routes through verified Pakistan-side official portals');
    ok(!REFUSAL_MARKERS.some(m => b.text.includes(m)), 'B: no refusal');
  }

  // Language rule: Roman Urdu chat — Latin script only.
  {
    const ru = await sseChat('What do I need to know before moving abroad?', 'roman_urdu');
    ok(!/[\u0600-\u06FF]/.test(ru.text), 'RU chat is Roman Urdu — no Urdu script');
    ok(ru.text.includes('mulk'), 'RU chat actually renders in Roman Urdu');
  }

  // ========================= TEST C — Agent ================================
  section('TEST C — "I need help understanding a legal notice." (agent)');
  {
    const c = await postJSON('/api/ai/agent', { message: 'I need help understanding a legal notice.', preferredLanguage: 'en' });
    ok(c.status === 200, 'C: agent endpoint responded 200');
    const reply = String(c.json.reply || '');
    ok(reply.length > 300, `C: agent answered substantively (${reply.length} chars) — never silent-fail`);
    ok(Array.isArray(c.json.sources) && c.json.sources.length >= 1, `C: agent used the same retrieval pipeline (${c.json.sources.length} sources)`);
    ok(reply.includes('Law that may apply') || reply.includes('law'), 'C: answer structured from retrieved context');
    ok(!REFUSAL_MARKERS.some(m => reply.includes(m)), 'C: no "no verified source" style refusal while context exists');
    ok(c.json.isOffline === true, 'C: offline owned-model path confirmed');
  }

  // ========================= TEST E — Draft legal notice ===================
  section('TEST E — "Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000." (generate)');
  let eHtml = '';
  {
    const e = await postJSON('/api/ai/generate', { requestText: 'Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000.', preferredLanguage: 'en' });
    ok(e.status === 200 && typeof e.json.html === 'string' && e.json.html.length > 1500, `E: complete document produced (${String(e.json.html || '').length} chars)`);
    ok(e.json.type === 'Legal Notice for Recovery of Unpaid Money', 'E: document type detected: ' + e.json.type);
    const h = String(e.json.html || '');
    ok(h.includes('LEGAL NOTICE FOR RECOVERY OF UNPAID MONEY'), 'E: professional heading');
    ok(h.includes('That the sum of Rs 500,000, being an unpaid loan'), 'E: claim recital survives as a numbered prose clause');
    ok(h.includes('Prepared with INSAaf AI'), 'E: verified footer preserved');
    const blankRuns = (h.match(/_{8,}/g) || []).length;
    ok(blankRuns <= 10, `E: signature fill-ins only — not a form-style wall of blanks (${blankRuns} blank runs)`);
    ok(Array.isArray(e.json.missingInformation) && e.json.missingInformation.length >= 1, 'E: missing mandatory items surfaced as asks, document still completes');
    ok(e.json.isOffline === true, 'E: offline owned-model path confirmed');
    eHtml = h;
  }

  // Language rule: Urdu Script document (English request, Urdu output).
  {
    const eu = await postJSON('/api/ai/generate', { requestText: 'Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000.', preferredLanguage: 'ur' });
    const h = String(eu.json.html || '');
    ok(/[\u0600-\u06FF]/.test(h), 'E(ur): document rendered in Urdu script');
    ok(!h.includes('the sum of'), 'E(ur): no system-generated English prose inside the Urdu document');
    ok(h.includes('بطور بقایا قرض') && h.includes('رقم Rs 500,000'), 'E(ur): localized Urdu claim recital keeps the amount verbatim');
  }

  // ========================= TEST F — Draft application ====================
  section('TEST F — "Write an application to the SHO for registration of FIR based on these facts: …"');
  {
    const fReq = 'Write an application to the SHO for registration of FIR based on these facts: my motorcycle (Honda CD 70, white) was stolen from outside my house in Gulberg III, Lahore on 15 March 2026. I had parked it at 8 pm and found it missing the next morning.';
    const f = await postJSON('/api/ai/generate', { requestText: fReq, preferredLanguage: 'en' });
    ok(f.status === 200 && typeof f.json.html === 'string', 'F: document produced');
    ok(/FIR/i.test(f.json.type), 'F: type detected: ' + f.json.type);
    const h = stripHtml(f.json.html);
    ok(h.includes('stolen from outside my house'), 'F: user facts converted into professional paragraphs (theft)');
    ok(h.includes('Honda CD 70') && h.includes('15 March 2026'), 'F: vehicle and date preserved in prose');
    ok(Array.isArray(f.json.missingInformation) && f.json.missingInformation.some(m => /police station/.test(m)), 'F: missing station-name surfaced as the essential ask');
    const blankRunsF = (String(f.json.html).match(/_{8,}/g) || []).length;
    ok(blankRunsF <= 10, `F: signature fill-ins only — not a form-style wall of blanks (${blankRunsF} blank runs)`);
    ok(String(f.json.html).includes('Prepared with INSAaf AI'), 'F: footer preserved');
  }

  // ========================= TEST G — OCR reply ============================
  section('TEST G — upload notice + "Iska complete reply likh do" (document-reply)');
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
    ok(g.status === 200 && typeof g.json.html === 'string' && g.json.html.length > 1000, `G: complete reply drafted from actual notice (${String(g.json.html || '').length} chars)`);
    const h = String(g.json.html || '');
    ok(h.includes('Ahmed Khan') && h.includes('Bilal Traders'), 'G: parties preserved from the source document');
    ok(h.includes('12 August 2026'), 'G: source date preserved');
    ok(h.includes('Amount claimed:') && h.includes('Rs 750,000'), 'G: claimed amount preserved (Rs 750,000)');
    ok(h.includes('Reply / Grounds:') && !h.includes('Iska complete reply likh do'), 'G: reply body uses user instructions, never app-chrome');
    ok(h.includes('[MISSING: your point-by-point response'), 'G: user grounds honestly marked while document completes');
    ok(h.includes('Prepared with INSAaf AI'), 'G: footer preserved');
  }

  // ========================= TEST H — Edit draft ===========================
  section('TEST H — "Change the amount to Rs 750,000 and add that I already sent two written notices." (document-chat)');
  {
    const hRes = await postJSON('/api/ai/document-chat', { context: eHtml, history: [], userInput: 'Change the amount to Rs 750,000 and add that I already sent two written notices.' });
    ok(hRes.status === 200, 'H: document-chat endpoint responded 200');
    const summary = String(hRes.json.summary || '');
    ok(/^Changed/.test(summary) && !/could not|unchanged/i.test(summary.slice(0, 60)), 'H: change applied — no unnecessary clarification: "' + summary.slice(0, 90) + '…"');
    const h = String(hRes.json.html || '');
    ok(h.includes('Rs 750,000') && !h.includes('500,000'), 'H: amount actually replaced in the document');
    ok(/two written notices/i.test(h), 'H: user fact added as a new paragraph');
    ok(/1\.|2\.|3\./.test(stripHtml(h)), 'H: numbering/structure preserved');
  }

  // ========================= TEST I — Missing mandatory ====================
  section('TEST I — bare request with genuinely missing essential facts (generate)');
  {
    const i = await postJSON('/api/ai/generate', { requestText: 'Write a maintenance application for my wife and two children.', preferredLanguage: 'en' });
    ok(i.status === 200 && typeof i.json.html === 'string', 'I: document still produced');
    ok(/Maintenance/i.test(i.json.type), 'I: type detected: ' + i.json.type);
    ok(Array.isArray(i.json.missingInformation) && i.json.missingInformation.length >= 2, `I: missing essentials asked (${(i.json.missingInformation || []).length} asks)`);
    const h = String(i.json.html || '');
    ok(h.includes('set out the full facts') || h.includes('[MISSING'), 'I: clearly-marked placeholder used in the body while the rest completes');
    ok(h.includes('Prepared with INSAaf AI'), 'I: footer preserved');
  }
} finally {
  child.kill();
  await sleep(400);
}

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
