// ============================================================================
// PART 12 — SCOPE / QUESTION-FOCUS / ANSWER-LEVEL RUNTIME SUITE (live backend)
//
// Everything below is asserted against the RUNNING server over /api/* — no
// source is read to decide a PASS. Groups follow the Part-12 plan:
//   A1-A6   question focus (the answer addresses what was asked)
//   B7-B9   Answer Level: depth changes, evidence does not
//   C10-C13 scope: university / Hyderabad / Sindh / Pakistan-wide
//   D14-D18 corrective RAG: bounded, only when needed, never invented
//   E19-E26 regression: chat languages, Document Intelligence, formal drafting
//   F0      #127: corrective loop visible on the live payload + Roman Urdu
//           location queries (tenancy / cheque) stay topic-routed and bounded
//   E27     `npx tsc --noEmit`      (run separately)
//   E28     `npm run build`         (run separately)
//
// Usage: node server/index.js   (then)   node server/testScopeFocus.js
// ============================================================================
const BASE = process.env.INSAAF_BASE || 'http://localhost:3001';
const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer runtime-test-suite' };

let pass = 0, fail = 0;
const notes = [];
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}${extra ? '  — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  — ' + extra : ''}`); notes.push(name); }
}
const URDU = /[\u0600-\u06FF]/;
const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const sections = s => [...String(s || '').matchAll(/^\*\*(.+?)\*\*/gm)].map(m => m[1]);
/** Body under one heading, up to the next heading. */
const sectionBody = (s, heading) => {
  const m = new RegExp(`\\*\\*${heading}\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*|$)`).exec(String(s || ''));
  return m ? m[1].trim() : '';
};
const contains = (s, re) => re.test(String(s || ''));
/**
 * "A Roman answer must not quote the corpus in bulk" cannot be measured by
 * character class — Roman Urdu is written in Latin script too. A run counts as
 * English only when none of its words are Roman Urdu vocabulary, and the
 * composer's own fixed Roman prose is excluded since it quotes nothing.
 */
const COMPOSER_PROSE = ['Jawab', 'Zaroori tahaffuz', 'Masla'];
const recordPart = s => COMPOSER_PROSE.reduce((out, h) =>
  out.replace(new RegExp(`\\*\\*${h}\\*\\*\\s*\\n[\\s\\S]*?(?=\\n\\*\\*|$)`), '\n'), String(s || ''));
const ROMAN_WORDS = new Set(('hai hain nahin nahi karta karti karte kiya kyun ke ka ki ko se mein par aur ya bhi ap aap ham tum liye wala wali hoti hota hoon '
  + 'karna karne diya dijiye dega degi sakta sakti sakte chahiye zaroori mutabiq qanoon qanooni haq huqooq masla jawab tareeqa tareeqay adalat rujoo likhit '
  + 'mutaliq bayan waqia fori foran aam maloomat shamil bhar pooch samjha parh khud na sirf phir takaron qism jagah waqt baat shuru miya biwi bachay darj '
  + 'record verified tehat').split(/\s+/).filter(Boolean));
const englishRuns = s => [...recordPart(s).matchAll(/[A-Za-z][A-Za-z ,;:'"().&\/-]{40,}/g)]
  .map(m => m[0])
  .filter(run => run.split(/[^A-Za-z'.-]+/).filter(w => w && w.length > 1)
    .every(w => !ROMAN_WORDS.has(w.toLowerCase().replace(/^[-']+|[-']+$/g, ''))));
const longestEnglishRun = s => Math.max(0, ...englishRuns(s).map(x => x.length));
/** Headings that introduce nothing — a section added for looks, not content. */
const emptyHeadings = s => String(s || '').split(/\n\n+/)
  .filter(b => !/VERIFIED|hawala/i.test(b))
  .filter(b => /^\s*\*\*[^*]+\*\*\s*[::]?\s*$/.test(b)).map(b => b.trim());

async function jget(path) { return await (await fetch(`${BASE}${path}`)).json(); }

async function advice(userQuery, { lang = 'en', answerLevel } = {}) {
  for (let i = 0; ; i++) {
    const res = await fetch(`${BASE}/api/ai/advice`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ userQuery, history: [], preferredLanguage: lang, ...(answerLevel ? { answerLevel } : {}) })
    });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 9000)); continue; }
    return await res.json();
  }
}

async function chat(userQuery, { lang = 'en', answerLevel } = {}) {
  for (let i = 0; ; i++) {
    const res = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ userQuery, history: [], preferredLanguage: lang, responseDetail: 'standard', ...(answerLevel ? { answerLevel } : {}) })
    });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 9000)); continue; }
    const raw = await res.text();
    let text = '';
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const p = line.slice(6).trim();
      if (!p || p === '[DONE]') continue;
      try { const o = JSON.parse(p); if (typeof o.chunk === 'string') text += o.chunk; } catch { /* not an event */ }
    }
    return { text };
  }
}

async function agent(message, { lang = 'en', answerLevel } = {}) {
  for (let i = 0; ; i++) {
    const res = await fetch(`${BASE}/api/ai/agent`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ message, preferredLanguage: lang, history: [], ...(answerLevel ? { answerLevel } : {}) })
    });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 9000)); continue; }
    return await res.json();
  }
}

/** Provision numbers the answer cites that the answer itself never sourced. */
function citedProvisions(text) {
  return [...new Set((String(text).match(/\b(?:section|sec|article|dafa)\s*\.?\s*(\d{1,5}[a-z]?)/gi) || [])
    .map(m => m.replace(/[^0-9a-z]/gi, '').toLowerCase()))];
}
/**
 * What the answer ASSERTS on its own must be sourced: a provision number in the
 * direct-answer lines must also appear in a retrieved-record line (law list,
 * source list, quoted record) or in the user's own question. Record blocks are
 * quotations, not assertions, so they are not scanned.
 */
const RECORD_BLOCKS = /^\*\*(Law that may apply|Laagu hone wala qanoon|Makhaz|Source|What the law says|Qanoon kya kehta hai|What to do \/ procedure|Kya karna chahiye \/ tareeqa|Istisnat aur nuqsaat|Important limitation|Zaroori tahaffuz)\*\*/i;
function unsourcedCitations(text, query = '') {
  const blocks = String(text).split(/\n\n+/);
  const recordLines = blocks.filter(b => RECORD_BLOCKS.test(b)).join('\n');
  const claims = blocks.filter(b => !RECORD_BLOCKS.test(b)).join('\n');
  const hay = `${recordLines} ${query}`.toLowerCase();
  return citedProvisions(claims).filter(c => !hay.includes(c.replace(/(section|sec|article|dafa)\.?/, '')));
}
/**
 * Ground truth from the response itself. The composer opens with a quoted
 * corpus sentence and renders the citation on a separate line, so
 * unsourcedCitations cannot see that quote — but the server returns the records
 * it answered from, and a provision number cited anywhere in the answer must
 * exist in one of them.
 */
const citedNumbers = text => [...String(text).matchAll(/\b(?:section|sec|article|art|dafa)\s*\.?\s*(\d+[a-z]?)/gi)]
  .map(m => m[1].toUpperCase());
const numbersInRecords = sources => new Set((sources || []).flatMap(s => [
  ...String(s.key || '').matchAll(/\d+[a-z]?/gi),
  ...String(s.text || '').matchAll(/\b(?:section|sec|article|art|dafa)\s*\.?\s*(\d+[a-z]?)/gi)
].map(m => String(m[1] ?? m[0]).toUpperCase())));
const outOfRecordsCitations = (text, sources) => {
  const inRecords = numbersInRecords(sources);
  return [...new Set(citedNumbers(text))].filter(n => !inRecords.has(n));
};

const OFFTOPIC = /\b(tenant|landlord|lease|FIR|consumer|harassment|bail|zamanat)\b/i;
const A1Q = 'What are the rights to education?';
const A2Q = 'Meri university ne bina hearing admission cancel kar di, kya karun?';
const A3Q = 'Bail ka basic process kya hai?';
const A4Q = 'Hyderabad mein student complaint kahan ho sakti hai?';
const A5Q = 'Sindh mein students ke harassment rights kya hain?';
const A6Q = 'Pakistan mein education ka constitutional right kya hai?';

const docText = `LEGAL NOTICE
To: Mr. Ahmed Khan, son of Abdul Rahman, resident of House No. 5, Gulberg III, Lahore.
Ref: LN/2026/77 dated 10 February 2026.
You are called upon to vacate the premises at House No. 5, Gulberg III, Lahore within 30 days of service of this notice, failing which civil and criminal action will follow. You have further failed to pay rent of Rs. 60,000 per month for the months of November 2025, December 2025 and January 2026, being a total of Rs. 180,000. Interest at 24% per annum shall run on the outstanding amount. This notice is issued by Adv. X Y Z, Lahore High Court.`;

// Must match src/components/DocumentIntelligenceSection.tsx verbatim — the
// server detects a DI request from this exact wording.
function diPrompt(action, text) {
  const prompts = {
    explain: `You are a Pakistani legal assistant. Read the following text carefully and explain it in simple, clear English that a layperson can understand. Break down any legal jargon. Structure your answer as:

**What this says:** (plain-language summary)
**What it means for you:** (practical implications)
**Key terms explained:** (any legal terms defined simply)
**What to do next:** (actionable steps if applicable)

Text to explain:
---
${text}
---`,
    summarize: `You are a Pakistani legal assistant. Read the following text and provide a concise, structured summary in English. Structure:

**Summary:** (2-3 sentence overview)
**Key Points:**
- (bullet list of important facts, dates, amounts, obligations)
**Parties Involved:** (if identifiable)
**Deadlines or Dates:** (if mentioned)
**Type of Document:** (your best assessment)

Text to summarize:
---
${text}
---`,
    risks: `You are a Pakistani legal assistant. Read the following text carefully and identify potential legal risks, issues, and red flags under Pakistani law. Structure:

**Risk Level:** (Low / Medium / High — with brief reason)
**Identified Risks:**
- (each risk with the relevant law/section if known)
**Missing Information:** (what you would need to give fuller advice)
**Recommended Actions:** (what the person should do)
**Important:** Do NOT invent laws, sections, penalties, or deadlines. Only cite what you are confident about. Where uncertain, say so.

Text to analyze:
---
${text}
---`
  };
  return prompts[action];
}

(async () => {
  const health = await jget('/api/ai/health');
  console.log(`\nBackend: ${BASE}  ownedModel=${health.ownedModelPrimary} externalLLM=${health.runtimeExternalLLMCalls} chunks=${health.ragDocumentsCount} docs`);

  // ==========================================================================
  console.log('\n=== A1-A6 · PART 1: the answer addresses the question asked ===');
  const aAns = [];
  {
    const r = await advice(A1Q, { lang: 'en' });
    const t = strip(r.text); aAns.push(r);
    ok('A1 answered', t.length > 150, `${t.length} chars, verdict=${r.evidence?.verdict}`);
    ok('A1 answers the education ask with the education record', contains(t, /25A|free and compulsory education/i));
    ok('A1 carries no unrelated topic', !OFFTOPIC.test(t), sections(r.text).join(' | '));
    ok('A1 simple rights question keeps a short structure', sections(r.text).length <= 8, `${sections(r.text).length} sections`);
    ok('A1 national record is tagged at its own layer', contains(r.text, /Pakistan-wide legal position/i));
  }
  {
    const r = await advice(A2Q, { lang: 'roman_urdu' });
    const t = strip(r.text); aAns.push(r);
    ok('A2 roman answered', t.length > 150 && !URDU.test(r.text), `${t.length} chars`);
    ok('A2 gives the university appeal ladder, not an essay', contains(t, /Registrar|Vice-Chancellor|appeal|Ombudsman|High Court/i));
    ok('A2 keeps the record deadline at beginner level', contains(t, /15-30|deadline|timeframe/i));
    ok('A2 states the supported basis', contains(r.text, /\*\*Laagu hone wala qanoon\*\*/));
    ok('A2 no unrelated topic', !OFFTOPIC.test(t));
    ok('A2 domain routed to education', r.evidence?.domain === 'education', `domain=${r.evidence?.domain}`);
  }
  {
    const r = await advice('Police FIR darj nahi kar rahi, mera kya haq hai?', { lang: 'roman_urdu', answerLevel: 'advanced' });
    const t = String(r.text || '');
    const says = sectionBody(t, 'Qanoon kya kehta hai');
    ok('A2b roman answer carries no long English corpus passage', longestEnglishRun(t) <= 220, `longest english run ${longestEnglishRun(t)} chars`);
    ok('A2b roman explanation leads, the record quote stays a bounded clause',
      /aap|qanoon|haq/i.test(says) && says.length < 420, `${says.length} chars`);
    ok('A2c records are cited, not dumped as metadata lines',
      !/^\s*(title|authority|jurisdiction|legal status|source url)\s*:/im.test(t),
      sectionBody(t, 'Mumkina tadaruk').slice(0, 90));
    ok('A2d exact legal identifiers survive the paraphrase',
      /Section 154 CrPC|Section 154/.test(t) && /Code of Criminal Procedure|CrPC/.test(t));
    ok('A2d no Urdu Script appears in a Roman answer', !URDU.test(t));
  }
  for (const lvl of ['beginner', 'intermediate', 'advanced']) {
    const r = await advice('Makan malik rent wapas nahi de raha, Hyderabad mein kya karoon?', { lang: 'roman_urdu', answerLevel: lvl });
    const t = String(r.text || '');
    const hs = sections(t);
    ok(`A2e ${lvl}: roman answer quotes no long English passage`, longestEnglishRun(t) <= 220, `${longestEnglishRun(t)} chars`);
    ok(`A2e ${lvl}: roman headings of the contract are used`,
      hs.includes('Masla') && hs.includes('Makhaz') && hs.includes('Zaroori tahaffuz'), hs.join(' | '));
    ok(`A2e ${lvl}: no Urdu Script in a Roman answer`, !URDU.test(t));
  }
  {
    const r = await advice(A3Q, { lang: 'roman_urdu' });
    const t = strip(r.text); aAns.push(r);
    ok('A3 bail answered in roman', t.length > 150 && !URDU.test(r.text));
    ok('A3 answers the process asked for', contains(t, /bail|zamanat/i) && contains(t, /496|court|application/i));
    ok('A3 no student/education bleed', !/\b(university|hostel|admission|fee refund)\b/i.test(t), `domain=${r.evidence?.domain}`);
  }
  {
    const r = await advice(A4Q, { lang: 'roman_urdu' });
    const t = strip(r.text); aAns.push(r);
    ok('A4 Hyderabad complaint venue answered', t.length > 120 && !URDU.test(r.text));
    ok('A4 names an authority or forum', contains(t, /Vice-Chancellor|Registrar|Ombudsman|committee|court|HEC|authority/i), sections(r.text).join(' | '));
    ok('A4 names the scope layer it answers from', contains(r.text, /Hyderabad|Sindh|university|Pakistan-wide/i));
    ok('A4 asked-scope recorded as Hyderabad', String(r.evidence?.scope?.asked?.city || '').toLowerCase() === 'hyderabad', JSON.stringify(r.evidence?.scope?.asked || null));
  }
  {
    const r = await advice(A5Q, { lang: 'roman_urdu' });
    const t = strip(r.text); aAns.push(r);
    ok('A5 Sindh student harassment answered', t.length > 150 && !URDU.test(r.text));
    ok('A5 on-topic (harassment committee / complaint route)', contains(t, /harass|committee|shikayat|complaint|Ombudsman/i));
    ok('A5 province asked is recorded', String(r.evidence?.scope?.asked?.province || '') === 'Sindh', JSON.stringify(r.evidence?.scope?.asked || null));
  }
  {
    const r = await advice(A6Q, { lang: 'roman_urdu' });
    const t = strip(r.text); aAns.push(r);
    ok('A6 Pakistan-wide constitutional ask answered', t.length > 150 && !URDU.test(r.text));
    ok('A6 quotes the constitutional record', contains(t, /25A|free and compulsory education/i));
    ok('A6 is grounded at the national layer', (r.evidence?.scope?.covered || []).includes('national'), JSON.stringify(r.evidence?.scope?.covered));
  }
  const empties = aAns.flatMap(r => emptyHeadings(r.text));
  ok('A1-A6 no heading is added without content', empties.length === 0, JSON.stringify(empties));
  const shapes = [...new Set(aAns.map(r => sections(r.text).join('|')))];
  ok('A1-A6 structure follows intent, not one fixed template', shapes.length >= 3,
    `${shapes.length} distinct structures over ${aAns.length} questions`);

  // ==========================================================================
  console.log('\n=== B7-B9 · PART 3: Answer Level changes depth, not evidence ===');
  {
    const b = await advice(A2Q, { lang: 'roman_urdu', answerLevel: 'beginner' });
    const i = await advice(A2Q, { lang: 'roman_urdu', answerLevel: 'intermediate' });
    const a = await advice(A2Q, { lang: 'roman_urdu', answerLevel: 'advanced' });
    const L = o => String(o.text || '').length;
    ok('B7 depth grows with the level', L(b) <= L(i) && L(i) <= L(a), `${L(b)} ≤ ${L(i)} ≤ ${L(a)} chars`);
    ok('B7 structure grows with the level', sections(b.text).length <= sections(a.text).length,
      `${sections(b.text).length} vs ${sections(a.text).length} sections`);
    ok('B8 evidence set is identical across levels',
      [b, i, a].every(o => o.evidence?.verdict === b.evidence?.verdict
        && o.evidence?.domain === b.evidence?.domain
        && o.evidence?.supportedCount === b.evidence?.supportedCount),
      `verdict/domain/supported = ${[b, i, a].map(o => `${o.evidence?.verdict}/${o.evidence?.domain}/${o.evidence?.supportedCount}`).join(' , ')}`);
    const cov = o => JSON.stringify([...new Set((o.evidence || {}).scope?.covered || [])].sort());
    ok('B8 scope coverage is identical across levels',
      cov(b) === cov(i) && cov(i) === cov(a), `${cov(b)} / ${cov(i)} / ${cov(a)}`);
    const agB = await agent(A2Q, { lang: 'roman_urdu', answerLevel: 'beginner' });
    const agA = await agent(A2Q, { lang: 'roman_urdu', answerLevel: 'advanced' });
    const src = o => JSON.stringify((o.sources || []).map(s => `${s.title}#${s.key}`));
    ok('B8c agent source set is identical at beginner and advanced',
      src(agB) === src(agA) && (agB.sources || []).length > 0,
      `${(agB.sources || []).length} sources: ${src(agB).slice(0, 150)}`);
    ok('B9 advanced invents no extra authority',
      unsourcedCitations(a.text, A2Q).length === 0,
      `advanced cites: ${citedProvisions(a.text).join(', ') || 'none'}; unsourced: ${JSON.stringify(unsourcedCitations(a.text, A2Q))}`);
    ok('B9 beginner keeps the critical deadline', contains(b.text, /15-30|deadline|timeframe/i));
    ok('B9 advanced adds real detail, not filler',
      sections(a.text).some(s => !sections(b.text).includes(s)),
      `extra: ${sections(a.text).filter(s => !sections(b.text).includes(s)).join(', ') || 'none'}`);
    ok('B9 every level stays Latin-script (Roman Urdu)', [b, i, a].every(o => !URDU.test(o.text)));
    ok('B9 no level shows an unsourced citation', [b, i, a].every(o => unsourcedCitations(o.text, A2Q).length === 0),
      JSON.stringify([b, i, a].map(o => unsourcedCitations(o.text, A2Q))));
  }
  {
    const en = await advice(A1Q, { lang: 'en', answerLevel: 'beginner' });
    const enAdv = await advice(A1Q, { lang: 'en', answerLevel: 'advanced' });
    ok('B7b english levels differ in depth', String(en.text).length < String(enAdv.text).length,
      `${String(en.text).length} < ${String(enAdv.text).length}`);
    ok('B8b same records at both levels', en.evidence?.supportedCount === enAdv.evidence?.supportedCount
      && en.evidence?.domain === enAdv.evidence?.domain);
  }

  // ==========================================================================
  console.log('\n=== C10-C13 · PARTS 4-8: student-first scope model + fallback ladder ===');
  {
    const r = await advice('University of Sindh ne meri admission bina notice ke cancel kar di. Kya karun?', { lang: 'roman_urdu' });
    const sc = r.evidence?.scope || {};
    ok('C10 named university is detected', sc.asked?.institutionNamed === true, JSON.stringify(sc.asked));
    ok('C10 ladder starts at the university layer', (sc.ladder || [])[0] === 'university', JSON.stringify(sc.ladder));
    ok('C10 answer is framed by its own layer', contains(r.text, /university|Pakistan-wide/i), sections(r.text).join(' | '));
  }
  {
    const r = await advice('University of Sindh ne meri admission bina notice ke cancel kar di. Kya karun?', { lang: 'roman_urdu', answerLevel: 'intermediate' });
    ok('C10b layers are named separately, never merged',
      /university rules ke mutabiq/i.test(r.text) && /Pakistan-wide qanooni position/i.test(r.text),
      JSON.stringify((r.text.match(/\[[^\]]+\]/g) || []).slice(0, 6)));
  }
  {
    const r = await advice(A4Q, { lang: 'roman_urdu' });
    const sc = r.evidence?.scope || {};
    ok('C11 Hyderabad city scope detected', String(sc.asked?.city || '').toLowerCase() === 'hyderabad', JSON.stringify(sc.asked));
    ok('C11 ladder is specificity-ordered, not geography-last',
      (sc.ladder || []).indexOf('university') < (sc.ladder || []).indexOf('provincial'),
      JSON.stringify(sc.ladder));
    ok('C11 national is still reachable (fallback, not exclusion)', (sc.ladder || []).includes('national'));
  }
  {
    const r = await advice('Sindh mein students ke rights kya hain?', { lang: 'roman_urdu' });
    const sc = r.evidence?.scope || {};
    ok('C12 Sindh province scope detected', String(sc.asked?.province || '') === 'Sindh', JSON.stringify(sc.asked));
    ok('C12 provincial layer ranks above national', (sc.ladder || []).indexOf('provincial') < (sc.ladder || []).indexOf('national'), JSON.stringify(sc.ladder));
    ok('C12 no narrow rule is presented as Pakistan-wide law',
      (sc.covered || []).length === 0 || (sc.covered || []).includes('provincial') || contains(r.text, /Sindh/i),
      JSON.stringify(sc.covered));
  }
  {
    const r = await advice(A6Q, { lang: 'roman_urdu' });
    const sc = r.evidence?.scope || {};
    ok('C13 explicit Pakistan-wide ask leads with national', (sc.ladder || [])[0] === 'national', JSON.stringify(sc.ladder));
    ok('C13 a university circular is not the main authority',
      !(sc.covered || []).filter(c => c === 'university' || c === 'local_city').length
      || contains(r.text, /25A|Constitution/i), JSON.stringify(sc.covered));
    ok('C13b every kept record is classed as declared or undeclared scope',
      typeof sc.declared === 'number' && typeof sc.undeclared === 'number'
      && sc.declared + sc.undeclared === (r.evidence?.supportedCount ?? 0),
      `declared=${sc.declared} undeclared=${sc.undeclared} kept=${r.evidence?.supportedCount}`);
    ok('C13c scope availability is an explicit answer, never an assumption',
      typeof sc.scopeKnown === 'boolean', `scopeKnown=${sc.scopeKnown}`);
  }
  {
    const ag = await agent('University of Sindh ne meri admission bina notice ke cancel kar di. Kya karun?', { lang: 'roman_urdu', answerLevel: 'intermediate' });
    const keys = (ag.steps || []).map(s => s.key);
    ok('C14 agent runs the 11-step workflow incl. scope selection',
      ['understand_issue', 'identify_facts', 'determine_jurisdiction', 'retrieve_records', 'evaluate_evidence',
        'correct_retrieval', 'select_by_scope', 'explain_at_level', 'practical_options', 'forum_authority', 'legal_references']
        .every(k => keys.includes(k)), `${keys.length} steps`);
    const scopeStep = (ag.steps || []).find(s => s.key === 'select_by_scope');
    ok('C15 scope step names the ladder and the kept layers', /→/.test(scopeStep?.detail || '') && /intekhab|selection/i.test(`${scopeStep?.label}`), scopeStep?.detail || 'missing');
  }

  // ==========================================================================
  console.log('\n=== D14-D18 · PART 8: corrective RAG fires only when required ===');
  {
    const r = await advice(A1Q, { lang: 'en' });
    ok('D14 relevant first pass needs no correction', (r.correction?.attempts ?? 0) === 0 && r.evidence?.verdict === 'strong',
      `attempts=${r.correction?.attempts} verdict=${r.evidence?.verdict}`);
  }
  {
    const r = await advice('Mera smartphone online khareedte waqt fraud ho gaya, paisa wapas kaise loon?', { lang: 'roman_urdu' });
    ok('D15 wrong-domain query either routes right or corrects',
      (r.correction?.attempts ?? 0) <= 2 && ['strong', 'weak'].includes(r.evidence?.verdict),
      `attempts=${r.correction?.attempts} verdict=${r.evidence?.verdict} domain=${r.evidence?.domain} strategies=${JSON.stringify(r.correction?.strategies)}`);
  }
  {
    const r = await advice(A4Q, { lang: 'roman_urdu' });
    ok('D16 wrong-scope ask is tightened by a bounded retry',
      (r.correction?.attempts ?? 0) <= 2 && r.evidence?.verdict === 'strong',
      `attempts=${r.correction?.attempts} strategies=${JSON.stringify(r.correction?.strategies)} covered=${JSON.stringify(r.evidence?.scope?.covered)}`);
  }
  {
    const bankQ = 'Mujhe apne bank account ke bare mein pata karna hai.';
    const r = await advice(bankQ, { lang: 'roman_urdu' });
    ok('D17 weak evidence never becomes a fabricated authority',
      unsourcedCitations(r.text, bankQ).length === 0 && (r.correction?.attempts ?? 0) <= 2,
      `verdict=${r.evidence?.verdict} attempts=${r.correction?.attempts}`);
  }
  {
    const r = await advice('How do I file a case in the International Court of Justice about the planet Mars?', { lang: 'en' });
    ok('D18 out-of-corpus stays bounded', (r.correction?.attempts ?? 0) <= 2, `attempts=${r.correction?.attempts} verdict=${r.evidence?.verdict}`);
    ok('D18 out-of-corpus answers honestly instead of inventing law',
      !contains(r.text, /\*\*Law that may apply\*\*|Section \d+ — /) || r.evidence?.verdict === 'strong',
      sections(r.text).join(' | '));
  }
  {
    const h = await jget('/api/ai/health');
    ok('D19 gate counters report a bounded loop', (h.correctiveRag?.maxAttemptsPerQuery ?? 0) <= 2, JSON.stringify(h.correctiveRag));
  }

  // ==========================================================================
  // F0 — TASK #127: the corrective loop is observable on the LIVE payload.
  // Everything here is read off the HTTP response only: verdict, attempts,
  // strategies, correction status, evidence quality and the records actually
  // returned. A city name must behave like scope metadata, never like a legal
  // topic, and a weak pass may only be answered from records that exist.
  console.log('\n=== F0 · #127: weak evidence → bounded correction, live payload ===');
  /** A province that a record names for itself — umbrella labels do not count. */
  const otherProvince = src => /\b(punjab|balochistan|khyber pakhtunkhwa|kpk|islamabad)\b/i.test(
    `${src.jurisdiction || ''} ${src.title || ''}`);
  {
    const q = 'Sindh ke Hyderabad mein makan malik kiraye ki raqam wapas nahi de raha';
    const r = await advice(q, { lang: 'roman_urdu' });
    const ev = r.evidence || {}, co = r.correction || {};
    ok('F0-A tenancy answer carries the gate payload', !!ev.verdict && typeof co.attempts === 'number',
      `verdict=${ev.verdict} attempts=${co.attempts}/${co.maxAttempts} relevance=${r.relevance}`);
    ok('F0-A Hyderabad/Sindh words do not hijack tenancy routing',
      ['civil', 'property', 'tenancy'].includes(ev.domain), `domain=${ev.domain}`);
    ok('F0-A correction status, bound and per-attempt verdicts are all visible',
      co.maxAttempts === 2 && co.triggered === (co.attempts > 0)
      && (co.detail || []).length === co.attempts + 1 && (co.detail || []).every(d => d.verdict),
      `triggered=${co.triggered} detail=${JSON.stringify((co.detail || []).map(d => `${d.n}:${d.strategy}:${d.verdict}`))}`);
    ok('F0-A correction fires exactly when a pass is weak',
      ev.verdict === 'strong' ? co.attempts === 0 : co.attempts >= 1,
      `verdict=${ev.verdict} attempts=${co.attempts} primary=${(co.detail || [])[0]?.verdict}`);
    ok('F0-A corrective strategies are named when triggered, never invented',
      co.attempts === 0 || (co.strategies || []).length === co.attempts + 1 && (co.strategies || []).slice(1).every(s => s !== 'primary'),
      JSON.stringify(co.strategies));
    ok('F0-A retrieved records stay tenancy-relevant',
      (r.sources || []).length > 0 && (r.sources || []).every(s => /rent|tenanc|landlord|tenant|premises|evict|deposit|mutation/i.test(`${s.title} ${s.text}`)),
      `${(r.sources || []).length} records`);
    ok('F0-A at least one Sindh record answers a Sindh ask',
      (r.sources || []).some(s => /sindh/i.test(`${s.title} ${s.text}`)), JSON.stringify((r.sources || []).map(s => s.key)));
    ok('F0-A no record from another province is kept for a Sindh question',
      !(r.sources || []).some(otherProvince), JSON.stringify((r.sources || []).map(s => s.jurisdiction)));
    ok('F0-A the tenancy answer cites nothing the records do not contain',
      unsourcedCitations(r.text, q).length === 0, `verdict=${ev.verdict}`);
    ok('F0-A the tenancy answer cites only provisions it was given',
      outOfRecordsCitations(r.text, r.sources).length === 0,
      `outOfRecords=${JSON.stringify(outOfRecordsCitations(r.text, r.sources))}`);
    ok('F0-A scope diagnostics still name the province that was asked',
      ev.scope?.asked?.province === 'Sindh', JSON.stringify(ev.scope?.asked || null));
  }
  {
    const q = 'Karachi mein chque ke khilaf kya kar sakte hain?';
    const r = await advice(q, { lang: 'roman_urdu' });
    const ev = r.evidence || {}, co = r.correction || {};
    ok('F0-B cheque answer carries the gate payload', !!ev.verdict && typeof co.attempts === 'number',
      `verdict=${ev.verdict} attempts=${co.attempts} quality=${JSON.stringify(ev.quality || null)}`);
    ok('F0-B Karachi word does not hijack cheque routing',
      ['banking', 'criminal'].includes(ev.domain), `domain=${ev.domain}`);
    ok('F0-B corrective behavior is observable and bounded for the cheque query',
      co.attempts <= 2 && co.maxAttempts === 2 && (co.detail || []).length === co.attempts + 1,
      `attempts=${co.attempts} strategies=${JSON.stringify(co.strategies)}`);
    ok('F0-B correction fires exactly when the cheque pass is weak',
      ev.verdict === 'strong' ? co.attempts === 0 : co.attempts >= 1,
      `verdict=${ev.verdict} attempts=${co.attempts}`);
    ok('F0-B the final record is cheque / banking relevant',
      (r.sources || []).length > 0 && (r.sources || []).every(s => /cheque|negotiable|489|dishonour|bank/i.test(`${s.title} ${s.text} ${s.key}`)),
      JSON.stringify((r.sources || []).map(s => s.key)));
    ok('F0-B the cheque answer cites nothing the records do not contain',
      unsourcedCitations(r.text, q).length === 0, `verdict=${ev.verdict} sources=${(r.sources || []).length}`);
    ok('F0-B the cheque answer cites only provisions it was given',
      outOfRecordsCitations(r.text, r.sources).length === 0,
      `cited=${JSON.stringify(citedNumbers(r.text))} outOfRecords=${JSON.stringify(outOfRecordsCitations(r.text, r.sources))}`);
  }
  {
    // The approved contract for a content-free provincial ask: the curated guard
    // answers it BEFORE retrieval, so no evidence gate runs and the response
    // cannot claim verification of a subject the user never named.
    for (const [label, q, lang] of [
      ['Roman', 'Sindh provincial law kya kehta hai?', 'roman_urdu'],
      ['Urdu', 'صوبائی قانون کیا کہتا ہے؟', 'ur'],
      ['Urdu', 'صوبوں کا قانون کیا کہتا ہے؟', 'ur'],
      ['Roman', 'sooba qanoon kya kehta hai?', 'roman_urdu'],
      ['English', 'What does provincial law say?', 'en']
    ]) {
      const r = await advice(q, { lang });
      ok(`F0-C ${label} content-free province ask never reaches retrieval`, !r.evidence,
        `evidence=${JSON.stringify(r.evidence || null)}`);
      ok(`F0-C ${label} content-free province ask claims no verification`,
        !/VERIFIED (LEGAL )?REFERENCE|QISMAN VERIFIED|VERIFIED QANOONI HAWALA/i.test(r.text)
        && unsourcedCitations(r.text, q).length === 0,
        `cited=${JSON.stringify(citedNumbers(r.text))}`);
      ok(`F0-C ${label} content-free province ask names the subjects and asks for one`,
        /subject/i.test(r.text) && /tenancy/i.test(r.text) && r.text.trim().length > 200,
        `len=${r.text.trim().length}`);
    }
  }
  {
    // The loop bound is only real if a weak query is shown hitting it live. This
    // ask states a genuine subject (a criminal penalty) that the corpus does not
    // cover, so the gate must retry and stay weak — never upgrade itself to
    // strong by accepting unrelated records.
    const q = 'Sindh mein time machine banane ki saza kya hai?';
    const r = await advice(q, { lang: 'roman_urdu' });
    const ev = r.evidence || {}, co = r.correction || {};
    ok('F0-C a weak pass actually triggers corrective retrieval',
      ev.verdict !== 'strong' && co.attempts >= 1 && (co.strategies || []).some(s => s !== 'primary'),
      `verdict=${ev.verdict} attempts=${co.attempts} strategies=${JSON.stringify(co.strategies)}`);
    ok('F0-C the loop stops at two attempts and re-evaluates each one',
      co.attempts <= 2 && (co.detail || []).slice(1).every(d => d.verdict),
      JSON.stringify((co.detail || []).map(d => `${d.n}:${d.strategy}:${d.verdict}`)));
    ok('F0-C exhausted weak evidence is never answered as a strong authority',
      ev.verdict !== 'strong' && unsourcedCitations(r.text, q).length === 0, `verdict=${ev.verdict}`);
    // Guard-rail: the provincial guard must not swallow real questions.
    for (const q2 of [
      'Sindh mein kirayedar ko makan se nikalne ka qanoon kya kehta hai?',
      'Sindh ke kiraye ke qawaneen kya kehte hain?',
      'Punjab Rent Acts 2009 kya kehta hai?'
    ]) {
      const r2 = await advice(q2, { lang: 'roman_urdu' });
      ok('F0-C a subject-bearing province ask still gets verified retrieval',
        r2.evidence && r2.evidence.verdict === 'strong' && /VERIFIED/i.test(r2.text),
        `verdict=${r2.evidence ? r2.evidence.verdict : 'no gate'} q=${q2.slice(0, 34)}`);
    }
    const dv = await advice('Sindh domestic violence Act kya kehta hai?', { lang: 'roman_urdu' });
    ok('F0-C the DV Act ask stays province-scoped in the answer',
      contains(dv.text, /Sindh Domestic Violence Act/i) && (!dv.evidence || dv.evidence.domain === 'province' || dv.evidence.verdict !== 'strong'),
      `gate=${dv.evidence ? dv.evidence.domain : 'curated safety branch'}`);
  }
  {
    const q = 'Can a landlord evict a tenant without a court order in Pakistan?';
    const r = await advice(q, { lang: 'en' });
    const ev = r.evidence || {}, co = r.correction || {};
    ok('F0-D Pakistan-wide ask stays national in scope',
      ['civil', 'property', 'tenancy'].includes(ev.domain) && !String(ev.scope?.asked?.province || '').length,
      `domain=${ev.domain} province=${JSON.stringify(ev.scope?.asked?.province)}`);
    ok('F0-D English first pass needs no correction', co.attempts === 0 && ev.verdict === 'strong',
      `attempts=${co.attempts} verdict=${ev.verdict}`);
    ok('F0-D the English tenancy answer cites only provisions it was given',
      outOfRecordsCitations(r.text, r.sources).length === 0,
      `cited=${JSON.stringify(citedNumbers(r.text))} outOfRecords=${JSON.stringify(outOfRecordsCitations(r.text, r.sources))}`);
    ok('F0-D a Pakistan-wide ask is not answered from one province alone',
      (r.sources || []).some(s => !/punjab|sindh|balochistan|khyber|kpk|islamabad/i.test(`${s.title} ${s.text}`))
      || contains(r.text, /provinc|state|each province|mukhtalif/i),
      JSON.stringify((r.sources || []).map(s => s.key)));
  }

  // ==========================================================================
  console.log('\n=== E19-E26 · PART 10: existing features untouched ===');
  {
    const r = await chat('What is the procedure if police refuse to register my FIR?');
    ok('E19 english chat still answers', r.text.length > 150 && !/could not find|not available/i.test(strip(r.text).slice(0, 200)), `${r.text.length} chars`);
  }
  {
    const r = await chat('Police FIR register nahi kar rahi, main kya karun?', { lang: 'roman_urdu' });
    ok('E20 roman chat still answers in roman', r.text.length > 120 && !URDU.test(r.text));
  }
  {
    const r = await chat('پولیس ایف آئی آر درج نہیں کر رہی، میں کیا کروں؟');
    ok('E21 urdu script comes back roman (Latin only)', r.text.length > 120 && !URDU.test(r.text), `${r.text.length} chars`);
  }
  {
    const r = await advice(diPrompt('explain', docText), { lang: 'en' });
    ok('E22 DI explain works on pasted text', r.text.length > 120 && contains(r.text, /notice|30 days|60,000|180,000/i), `${String(r.text).length} chars`);
  }
  let diSummary = '', diRisks = '';
  {
    const r = await advice(diPrompt('summarize', docText), { lang: 'en' });
    diSummary = String(r.text || '');
    ok('E23 DI summarize extracts the facts', contains(diSummary, /Summary|Key Points/i) && contains(diSummary, /30 days|180,000|60,000/i));
  }
  {
    const ABBREV_DOC = `LEGAL NOTICE
Ref: LN/2026/77 dated 10 February 2026.
I, Mr. Ali Raza, Adv., son of Abdul Rehman, resident of House No. 5, Gulberg III, Lahore, am instructing you on behalf of my client.
You are required to pay the outstanding sum of Rs 450,000 within 30 days of receipt of this notice, failing which legal proceedings shall follow.`;
    const r = await advice(diPrompt('summarize', ABBREV_DOC), { lang: 'en' });
    const t = String(r.text || '');
    ok('E23b summary is not truncated at "No." — address and deadline stay in one clause',
      /House No\. 5[\s\S]{0,160}within 30 days/.test(t) && /proceedings shall follow/.test(t), t.replace(/\*/g, '').slice(0, 150));
    ok('E23c the claimed amount is surfaced on its own line', /Amounts|Raqmein/.test(t) && /450,000/.test(t));
    ok('E23d the document number keeps its date context', /LN\/2026\/77/.test(t) && /10 February 2026/.test(t));
  }
  {
    const r = await advice(diPrompt('risks', docText), { lang: 'en' });
    diRisks = String(r.text || '');
    ok('E24 DI risks lists real risks', contains(diRisks, /Risk/i) && diRisks.length > 150);
  }
  ok('E24b DI actions stay isolated from each other',
    contains(diSummary, /^\*\*Summary:\*\*/m) && !contains(diSummary, /Risk Level/i)
    && contains(diRisks, /Risk Level/i) && !contains(diRisks, /^\*\*Summary:\*\*/m),
    `summary=[${sections(diSummary).join(', ')}] risks=[${sections(diRisks).join(', ')}]`);
  {
    const viaChat = await chat(diPrompt('summarize', docText), { lang: 'en' });
    const t = String(viaChat.text || '');
    ok('E24c the same DI request is intercepted on /chat, not sent to legal RAG',
      contains(t, /^\*\*Summary:\*\*/m) && !contains(t, /\*\*Masla\*\*|\*\*Issue\*\*/),
      `chat=[${sections(t).join(', ')}] advice=[${sections(diSummary).join(', ')}]`);
    ok('E24d /chat and /advice give the same DI extraction',
      /60,000|180,000/.test(t) && /30 days/.test(t) && sections(t).join('|') === sections(diSummary).join('|'),
      `chat=[${sections(t).join(', ')}]`);
  }
  {
    const a = await (await fetch(`${BASE}/api/ai/generate`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ requestText: 'Draft a legal notice for recovery of unpaid money. I lent Rs 2,000,000 to Ahmed Khan in Lahore on 1 January 2023 and he has not repaid it.', preferredLanguage: 'en' })
    })).json();
    ok('E25 formal english draft completes', String(a.html || '').length > 1200 && contains(a.html, /notice|demand|recover/i), `${String(a.html || '').length} chars`);
  }
  {
    const b = await (await fetch(`${BASE}/api/ai/generate`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ requestText: 'قروض کی واپسی کے لیے قانونی نوٹس لکھیں۔ میں نے احمد خان کو لاہور میں دو لاکھ روپے ادھار دیے تھے۔', preferredLanguage: 'ur' })
    })).json();
    ok('E26 formal urdu draft completes', String(b.html || '').length > 800, `${String(b.html || '').length} chars`);
  }

  const h1 = await jget('/api/ai/health');
  console.log(`\nGate at end: ${JSON.stringify(h1.correctiveRag)}`);
  console.log(`\n${'='.repeat(64)}\n  ${pass} passed, ${fail} failed${notes.length ? `\n  Failed: ${notes.join('; ')}` : ''}\n${'='.repeat(64)}\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR:', e); process.exit(2); });
