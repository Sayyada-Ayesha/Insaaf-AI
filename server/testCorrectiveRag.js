// ============================================================================
// Parts 1-8 — CORRECTIVE-RAG + ANSWER LEVEL RUNTIME SUITE (HTTP, live backend)
//
// Everything here is asserted against the RUNNING server over /api/*, not by
// reading source. Groups follow the Phase-8 test plan:
//   A1-A9   regression: existing chat/answer behaviour still works
//   B10-B16 corrective-RAG: evidence judging, bounded retry, no invention
//   C17-C22 Answer Level: depth changes, facts and sources do not
//   D23-D27 Document Intelligence + formal drafting stay untouched
//   E28     (run separately) tsc --noEmit
//   E29     (run separately) npm run build
//
// Usage: node server/index.js   (then)   node server/testCorrectiveRag.js
// ============================================================================
const BASE = process.env.INSAAF_BASE || 'http://localhost:3001';
// The rate limiter gives an unauthenticated IP 30 ordinary requests/minute and
// a bearer-carrying client 60. This suite makes ~30, so it presents a token.
const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer runtime-test-suite' };

let pass = 0, fail = 0;
const notes = [];
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}${extra ? '  — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  — ' + extra : ''}`); notes.push(name); }
}
const URDU = /[\u0600-\u06FF]/;
const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function jget(path) {
  const r = await fetch(`${BASE}${path}`);
  return await r.json();
}

/** Non-streaming advice: the owned-model local path, with gate diagnostics. */
async function advice(userQuery, { lang = 'en', answerLevel, tries = 4 } = {}) {
  for (let i = 0; ; i++) {
    const res = await fetch(`${BASE}/api/ai/advice`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ userQuery, history: [], preferredLanguage: lang, ...(answerLevel ? { answerLevel } : {}) })
    });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 8000)); continue; }
    const data = await res.json();
    if (data && data.error && i < tries) { await new Promise(r => setTimeout(r, 500)); continue; }
    return { data, ms: 0 };
  }
}

/** Streaming chat: returns the assembled answer + the final gate event. */
async function chat(userQuery, { lang = 'en', answerLevel } = {}) {
  const t0 = Date.now();
  let raw = '';
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ userQuery, history: [], preferredLanguage: lang, responseDetail: 'standard', ...(answerLevel ? { answerLevel } : {}) })
    });
    raw = await res.text();
    // The 60/min limiter is shared across suites: a 429 body is not an empty answer.
    if (res.status === 429) { await new Promise(r => setTimeout(r, 8000)); continue; }
    break;
  }
  let text = '', event = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const obj = JSON.parse(payload);
      if (typeof obj.chunk === 'string') text += obj.chunk;
      if (obj.evidence || obj.answerLevel) event = obj;
    } catch { /* partial chunk lines are not JSON events */ }
  }
  return { text, event, ms: Date.now() - t0 };
}

async function agent(message, { lang = 'en', answerLevel } = {}) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${BASE}/api/ai/agent`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ message, preferredLanguage: lang, history: [], ...(answerLevel ? { answerLevel } : {}) })
    });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 8000)); continue; }
    return await res.json();
  }
  return {};
}

/** Provision numbers the answer cites, and whether the corpus actually has them. */
function citedProvisions(text) {
  return [...new Set((String(text).match(/\b(?:section|sec|article|dafa)\s+\.?\s*(\d{1,5}[a-z]?)/gi) || [])
    .map(m => m.replace(/[^0-9a-z]/gi, '').toLowerCase()))];
}
function unsupportedCitations(answer, sources, query = '') {
  const hay = `${JSON.stringify(sources || '')} ${query} `.toLowerCase();
  return citedProvisions(answer).filter(p => !hay.includes(p.replace(/(section|sec|article|dafa)/, '')));
}

const docText = `LEGAL NOTICE
To: Mr. Ahmed Khan, son of Abdul Rahman, resident of House No. 5, Gulberg III, Lahore.
Ref: LN/2026/77 dated 10 February 2026.
You are called upon to vacate the premises at House No. 5, Gulberg III, Lahore within 30 days of service of this notice, failing which civil and criminal action will follow. You have further failed to pay rent of Rs. 60,000 per month for the months of November 2025, December 2025 and January 2026, being a total of Rs. 180,000. Interest at 24% per annum shall run on the outstanding amount. This notice is issued by Adv. X Y Z, Lahore High Court.`;

(async () => {
  const health0 = await jget('/api/ai/health');
  console.log(`\nBackend: ${BASE}  provider=${health0.activeProvider} ownedModel=${health0.ownedModelPrimary}`);
  console.log(`Gate at start: ${JSON.stringify(health0.correctiveRag)}`);

  // ==========================================================================
  console.log('\n=== A1-A9 · REGRESSION: existing answers still work ===');
  {
    const r = await chat('What is the procedure if police refuse to register my FIR?');
    ok('A1 english chat answers', r.text.length > 150 && !/could not find|not available/i.test(strip(r.text).slice(0, 200)), `${r.text.length} chars, ${r.ms}ms`);
    ok('A1 gate event present on chat', !!r.event && !!r.event.evidence, `verdict=${r.event?.evidence?.verdict} level=${r.event?.answerLevel}`);
  }
  {
    const r = await chat('Police FIR register nahi kar rahi, main kya karun?', { lang: 'roman_urdu' });
    ok('A2 roman urdu chat answers', r.text.length > 120);
    ok('A2 roman stays Latin (no Urdu script)', !URDU.test(r.text));
    ok('A2 roman structural labels used', /Jawab|Is ka matlab|Aap ko kya karna|Qanooni hawala/i.test(r.text));
  }
  {
    const r = await chat('میری فائی آر رجسٹر نہیں ہو رہی، میں کیا کروں؟');
    ok('A3 urdu-script input answered', r.text.length > 100, `${r.text.length} chars`);
    ok('A3 urdu-script input -> Roman answer (no Urdu script out)', !URDU.test(r.text));
  }
  {
    const { data } = await advice('How do I file a consumer complaint for a defective mobile phone?');
    ok('A4 english legal query grounded', strip(data.text).length > 120 && data.evidence?.verdict !== 'none', `dom=${data.evidence?.domain ?? data.domain} verdict=${data.evidence?.verdict}`);
  }
  {
    const { data } = await advice('University ne hostel se nikalne ka notice bheja hai, student ke kya rights hain?');
    ok('A5 student-rights query answered', strip(data.text).length > 120);
    ok('A5 routed to education domain', data.evidence?.domain === 'education', `domain=${data.evidence?.domain}`);
  }
  {
    const { data } = await advice('What is the procedure to get bail in a criminal case in Pakistan?');
    const direct = /DIRECT VERIFIED LEGAL REFERENCE/i.test(data.text);
    ok('A6 bail query grounded on bail records',
      /bail/i.test(data.text) && strip(data.text).length > 120 && (direct || (data.sources || []).length > 0),
      direct ? 'verbatim direct-reference path' : `composed, ${(data.sources || []).length} records`);
  }
  {
    const { data } = await advice('Mera kirayedars ghar khali nahi kar raha, property dispute ka kya tareeqa hai?');
    ok('A7 property/tenancy roman query answered', strip(data.text).length > 120 && !URDU.test(data.text));
  }
  {
    const { data } = await advice('Khula divorce ki procedure aur maintenance ka kya rule hai?');
    ok('A8 family-law query answered', strip(data.text).length > 100 && /khula|divorce|mainteni|maintenance|Mehar|Haq mahr/i.test(data.text));
  }
  {
    const { data } = await advice('Someone is blackmailing me on WhatsApp with my photos, what is the PECA remedy?');
    ok('A9 cybercrime query grounded on PECA', /PECA|cyber|FIA/i.test(data.text) && (data.sources || []).length > 0);
  }
  {
    // Corrective RAG must not cost recall: this transliteration is only partly
    // covered by the engine's dictionary, yet retrieval returns the Rented
    // Premises / tenancy records, so it must be answered from them.
    const { data } = await advice('Mera kirayedara ghar khali karne ko kehta hai, kiraye ka masla');
    ok('A9b partly-unmapped roman urdu query still answered (no gate over-refusal)',
      strip(data.text).length > 120 && (data.sources || []).length > 0 && data.evidence?.verdict !== 'none'
      && !/verified Pakistani qanooni record nahi mila/i.test(strip(data.text)),
      `verdict=${data.evidence?.verdict} sources=${(data.sources || []).length}`);
  }

  // ==========================================================================
  console.log('\n=== B10-B16 · CORRECTIVE RAG: judge, correct at most twice, never invent ===');
  {
    const { data } = await advice('What should I do if the police refuse to register my FIR in Lahore?');
    ok('B10 relevant query accepted strong', data.evidence?.verdict === 'strong', `verdict=${data.evidence?.verdict} supported=${data.evidence?.supportedCount}`);
    ok('B10 strong pass costs no retry (attempts 0)', data.correction?.attempts === 0, `attempts=${data.correction?.attempts}`);
  }
  {
    const { data } = await advice('aaj raat ke khanay mein kya banau, mujhe recipe batao', { lang: 'roman_urdu' });
    const honest = (data.sources || []).length === 0
      && /batayein|describe|confirm|wazeh|please|share|clarif|rephrase|mutaliqa/i.test(data.text);
    // Honest refusal may come from the curated pre-retrieval path (no gate run at
    // all) or from an exhausted gate; either way the ask must not be invented.
    ok('B11 off-topic query gets clarification not invention',
      honest && (data.evidence?.verdict ?? 'none') !== 'strong',
      `verdict=${data.evidence?.verdict ?? 'curated-pre-gate'} sources=${(data.sources || []).length} attempts=${data.correction?.attempts ?? 0}`);
    ok('B11 bounded loop respected (attempts <= 2)', (data.correction?.attempts ?? 0) <= 2, `attempts=${data.correction?.attempts ?? 0}`);
  }
  {
    const { data } = await advice('Can I claim refund for a defective laptop under the PPC 1860?');
    ok('B12 wrong-domain demand detected or corrected', data.evidence?.verdict !== 'strong'
      || (data.evidence?.reasons || []).includes('wrong_domain')
      || data.evidence?.domain === 'consumer', `verdict=${data.evidence?.verdict} dom=${data.evidence?.domain} reasons=${(data.evidence?.reasons || []).join(',')}`);
    ok('B12 answer does not cite PPC as the refund basis', !/under section \d+ of the Pakistan Penal/i.test(data.text));
  }
  {
    const { data } = await advice('What is the UK law on tenancy deposit protection for Pakistani landlords?');
    ok('B13 wrong-jurisdiction routed away from Pakistani law', data.evidence?.domain === 'cross-border'
      || (data.evidence?.reasons || []).includes('wrong_jurisdiction')
      || /official source|verify|UK|foreign/i.test(data.text), `dom=${data.evidence?.domain} reasons=${(data.evidence?.reasons || []).join(',')}`);
  }
  {
    const { data } = await advice('What is the penalty for owning a time machine in Lahore?');
    const weakNotStrong = data.evidence?.verdict !== 'strong';
    const noFakeLaw = unsupportedCitations(data.text, data.sources).length === 0;
    ok('B14 weak evidence not accepted as strong', weakNotStrong, `verdict=${data.evidence?.verdict} chunks=${(data.sources || []).length}`);
    ok('B14 weak evidence never states a fabricated penalty', noFakeLaw && !/shall be punished|imprisonment/i.test(data.text));
  }
  {
    const strongQ = await advice('What should I do if the police refuse to register my FIR in Lahore?');
    const weakQ = await advice('time machine penalty lahore ownership');
    ok('B15 retry fires only when needed', strongQ.data.correction?.attempts === 0 && (weakQ.data.correction?.attempts ?? 0) <= 2,
      `strong attempts=${strongQ.data.correction?.attempts} weak attempts=${weakQ.data.correction?.attempts}`);
    const h = await jget('/api/ai/health');
    ok('B15 gate counters move on /api/ai/health',
      h.correctiveRag.strongVerdicts > health0.correctiveRag.strongVerdicts
      && h.correctiveRag.maxAttemptsPerQuery === 2,
      `strong=${h.correctiveRag.strongVerdicts} retried=${h.correctiveRag.weakRetriedQueries} rejected=${h.correctiveRag.evidenceRejectedQueries} attempts=${h.correctiveRag.correctiveAttempts}`);
  }
  {
    const probes = [
      'What is section 99999 of the constitution?',
      'asdfgh qwerty zxcvbnm legal thing',
      'What is the procedure for a space station lease in Pakistan?'
    ];
    let allHonest = true, detail = [];
    for (const q of probes) {
      const { data } = await advice(q);
      const refuses = /was not found|not found in the verified|verified legal source|could not find|nahi mila|nahi milli|batayein|share the relevant/i.test(data.text);
      const bad = refuses ? [] : unsupportedCitations(data.text, data.sources, q);
      detail.push(`${q.slice(0, 20)}… verdict=${data.evidence?.verdict} ${refuses ? 'honest-refusal' : `bad=[${bad.join('|')}]`}`);
      if (bad.length || !refuses && data.evidence?.verdict === 'none') allHonest = false;
    }
    ok('B16 no fabricated authority when evidence is weak', allHonest, detail.join(' · '));
  }

  // ==========================================================================
  console.log('\n=== C17-C22 · ANSWER LEVEL: depth changes, evidence does not ===');
  const Q = 'What is the procedure if police refuse to register my FIR in Karachi?';
  const lvl = {};
  for (const l of ['beginner', 'intermediate', 'advanced']) {
    const { data } = await advice(Q, { answerLevel: l });
    lvl[l] = { text: strip(data.text), raw: data.text, level: data.answerLevel, sources: data.sources || [], evidence: data.evidence };
  }
  ok('C17 level echoed back per request', lvl.beginner.level === 'beginner' && lvl.intermediate.level === 'intermediate' && lvl.advanced.level === 'advanced',
    `${lvl.beginner.level}/${lvl.intermediate.level}/${lvl.advanced.level}`);
  ok('C17 beginner is the shortest answer', lvl.beginner.text.length < lvl.intermediate.text.length && lvl.intermediate.text.length <= lvl.advanced.text.length,
    `len ${lvl.beginner.text.length} < ${lvl.intermediate.text.length} <= ${lvl.advanced.text.length}`);
  const core = ['154'];
  ok('C18 facts identical across levels (CrPC 154 at every level)', core.every(n => ['beginner', 'intermediate', 'advanced'].every(l => lvl[l].text.includes(n))),
    core.join(','));
  ok('C18 no level invents provisions', ['beginner', 'intermediate', 'advanced'].every(l => unsupportedCitations(lvl[l].text, lvl[l].sources).length === 0));
  ok('C19 beginner stays simple (no case-law / evidence-note sections)', !/precedent|PLD|SCMR|evidence quality/i.test(lvl.beginner.text) && lvl.beginner.text.length < lvl.advanced.text.length);
  ok('C20 advanced adds exact detail beyond beginner (more provisions or proviso/evidence lines)',
    (lvl.advanced.text.match(/\b(?:section|article)\s+\d+/gi) || []).length >= (lvl.beginner.text.match(/\b(?:section|article)\s+\d+/gi) || []).length
    && lvl.advanced.text.length > lvl.beginner.text.length + 200,
    `provs ${lvl.beginner.text.match(/\b(?:section|article)\s+\d+/gi)?.length || 0} → ${lvl.advanced.text.match(/\b(?:section|article)\s+\d+/gi)?.length || 0}`);
  const evSame = ['beginner', 'intermediate', 'advanced'].every(l => lvl[l].evidence?.verdict === lvl.beginner.evidence?.verdict);
  const keysSame = lvl.beginner.sources.length > 0
    && lvl.advanced.sources.slice(0, lvl.beginner.sources.length).map(s => `${s.type}:${s.key}`).join(',')
      === lvl.beginner.sources.map(s => `${s.type}:${s.key}`).join(',');
  ok('C21 evidence verdict identical at all levels', evSame, `verdict=${lvl.beginner.evidence?.verdict}`);
  ok('C21 top-ranked sources identical at all levels', keysSame, `${lvl.beginner.sources.length} vs ${lvl.advanced.sources.length} records (depth differs, ranking does not)`);
  {
    const roman = {};
    for (const l of ['beginner', 'advanced']) {
      const { data } = await advice('Police FIR register nahi kar rahi, main kya karun?', { lang: 'roman_urdu', answerLevel: l });
      roman[l] = strip(data.text);
    }
    ok('C22 answer level works in Roman Urdu too (and stays Latin)',
      roman.beginner.length > 80 && roman.advanced.length > roman.beginner.length && !URDU.test(roman.advanced),
      `len ${roman.beginner.length} → ${roman.advanced.length}`);
    const urduScript = await advice('پولیس ایف آئی آر درج نہیں کر رہی، میں کیا کروں؟', { answerLevel: 'advanced' });
    ok('C22 urdu-script input + advanced level -> Roman output', !URDU.test(urduScript.data.text) && strip(urduScript.data.text).length > 100);
  }

  // ==========================================================================
  console.log('\n=== D23-D27 · Document Intelligence + formal drafting untouched ===');
  {
    const { data } = await advice(`Explain it in simple, clear words what this document says:\n---\n${docText}\n---`, { answerLevel: 'advanced' });
    ok('D23 DI Explain stays task-focused (not a Legal Agent answer)',
      /What this document says|Summary:|Type of Document/i.test(data.text) && !data.evidence && !/Verified knowledge bank/i.test(data.text),
      `${strip(data.text).slice(0, 60)}…`);
  }
  {
    const { data } = await advice(`Provide a concise, structured summary of the following document:\n---\n${docText}\n---`, { answerLevel: 'advanced' });
    ok('D24 DI Summarize returns a summary of the pasted document',
      /Summary:/i.test(data.text) && /vacate|Ahmed Khan|180,000|rent/i.test(data.text) && !data.steps);
  }
  {
    const { data } = await advice(`Identify potential legal risks in the following document:\n---\n${docText}\n---`, { answerLevel: 'beginner' });
    ok('D25 DI Risks returns risk analysis, unaffected by answer level',
      /risk/i.test(data.text) && /vacate|rent|interest|30 days/i.test(data.text));
  }
  {
    const body = { requestText: 'Draft a legal notice for recovery of unpaid debt. I, Ali Raza son of Muhammad Raza, resident of Lahore, lent Rs. 500,000 to Bilal Traders on 1 January 2026 which is still unpaid. Demand payment within 14 days.', preferredLanguage: 'en' };
    const a = await (await fetch(`${BASE}/api/ai/generate`, { method: 'POST', headers: AUTH, body: JSON.stringify(body) })).json();
    const b = await (await fetch(`${BASE}/api/ai/generate`, { method: 'POST', headers: AUTH, body: JSON.stringify({ ...body, answerLevel: 'advanced' }) })).json();
    const txt = strip(a.html);
    ok('D26 formal English draft complete + English-only',
      txt.length > 600 && !URDU.test(a.html) && /serve this Legal Notice|Reservation of Rights/i.test(txt) && /Prepared with INSAaf AI/.test(a.html || ''),
      `${txt.length} chars`);
    ok('D26 answer level cannot alter formal drafting (byte-identical html)', a.html === b.html);
  }
  {
    const body = { requestText: 'ایک قانونی نوٹس برائے وصولی بقایا جات تیار کریں۔ میں علی رضا لاہور کا رہنے والا ہوں۔', preferredLanguage: 'ur' };
    const u = await (await fetch(`${BASE}/api/ai/generate`, { method: 'POST', headers: AUTH, body: JSON.stringify(body) })).json();
    const ua = await (await fetch(`${BASE}/api/ai/generate`, { method: 'POST', headers: AUTH, body: JSON.stringify({ ...body, answerLevel: 'beginner' }) })).json();
    ok('D27 formal Urdu draft in Urdu script, unchanged by answer level',
      URDU.test(u.html || '') && (u.html || '') === (ua.html || '') && !/Kya karna chahiye|Laagu hone wala/i.test(u.html || ''),
      `${strip(u.html).length} chars`);
  }

  // ==========================================================================
  console.log('\n=== EXTRA · Legal Agent orchestration layer (Part 3) ===');
  {
    const r = await agent('My landlord in Lahore refuses to return my security deposit of Rs. 200,000. What should I do?', { answerLevel: 'intermediate' });
    const keys = (r.steps || []).map(s => s.key);
    const wanted = ['understand_issue', 'identify_facts', 'determine_jurisdiction', 'retrieve_records', 'evaluate_evidence', 'correct_retrieval', 'select_by_scope', 'explain_at_level', 'practical_options', 'forum_authority', 'legal_references'];
    ok('Agent runs all 11 workflow steps', wanted.every(k => keys.includes(k)), `${keys.length} steps`);
    const ledger = JSON.stringify(r.steps);
    ok('Agent ledger quotes only user-stated facts', /lahore/i.test(ledger) && /200,000/.test(ledger) && !/PLD|SCMR|MLD/i.test(ledger));
    ok('Agent answer is a substantive grounded reply', strip(r.reply).length > 200 && (r.sources || []).length > 0);
    ok('Agent honours the requested answer level', r.answerLevel === 'intermediate');
    ok('Agent stays grounded', unsupportedCitations(r.reply, r.sources).length === 0);
    const chat_ = await chat('My landlord in Lahore refuses to return my security deposit of Rs. 200,000. What should I do?', { answerLevel: 'intermediate' });
    ok('Chat does NOT get the agent ledger (no forced multi-step)', !chat_.event?.steps);
  }

  const h1 = await jget('/api/ai/health');
  console.log(`\nGate at end : ${JSON.stringify(h1.correctiveRag)}`);
  console.log(`Requests judged: ${(h1.correctiveRag.strongVerdicts - health0.correctiveRag.strongVerdicts)} strong, ` +
    `${(h1.correctiveRag.weakRetriedQueries - health0.correctiveRag.weakRetriedQueries)} retried, ` +
    `${(h1.correctiveRag.evidenceRejectedQueries - health0.correctiveRag.evidenceRejectedQueries)} rejected, ` +
    `${(h1.correctiveRag.correctiveAttempts - health0.correctiveRag.correctiveAttempts)} corrective attempts total`);
  console.log(`\n=================  ${pass} passed / ${fail} failed  ==================`);
  if (fail) console.log('Failed cases: ' + notes.join(' | '));
  process.exit(fail === 0 ? 0 : 1);
})();
