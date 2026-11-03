// P0 — THE PRODUCT LANGUAGE CONTRACT REGRESSION SUITE.
//
// The contract (documented on resolveChatLanguage in server/index.js and mirrored
// in src/lib/responseLanguage.ts):
//   English input      → English answer
//   Roman Urdu input   → Roman Urdu answer
//   Urdu SCRIPT input  → Roman Urdu answer
// Urdu Script is an INPUT language and a DOCUMENT output language, never an answer
// language. Every assertion below therefore checks two things at once: the answer
// arrived in the expected language, and no answer prose leaked into Urdu script.
//
// Usage: node server/testLanguageContract.js      (spawns its own backend on TEST_PORT)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.TEST_PORT || 4260);
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`    PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`    FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
  return !!cond;
}
const section = label => console.log(`\n== ${label} ==`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const URDU_RE = /[؀-ۿ]/;
// The owned-model composer has exactly two heading tables (EN and ROMAN), but it
// emits different SECTION SETS per intent branch (a rights answer carries "Jawab"
// without "Masla"), and the verified-reference banners have their own bilingual
// wording. So the observable product rule is the WORDING of the prose, not one
// fixed heading list: Roman Urdu answers are built from Roman function words and
// legal vocabulary, English answers from English ones.
const ROMAN_MARKER_RE = /\b(masla|jawab|qanoon|qanooni|kanoon|maloomat|maloom|adalat|wakeel|vakeel|shikayat|darkhast|darkhwast|tareeqa|tariqa|mutabiq|mutaliqa|pehlu|pehluon|zaroori|zaroor|chahiye|chahye|nahi|nhi|hain|hai|kya|karna|karen|karoon|karo|karunga|doonga|wapas|mera|meri|mujhe|aap|apna|apni|liye|baraye|bara-e|tahaffuz|dafa|dhara|qareeb|tareen|milta|julta|neeche|tafseelaat|faraham|tasdeeq|shuda|hawala|sawal|pareshan|yaqeen|agar|aur|bhi|koi|kuch|sab|haan|theek|raha|rahi|sakta|sakti|hoga|hona|kahan|kyun|kyunki|mein)\b/gi;
const EN_MARKER_RE = /\b(the|your|you|court|law|section|article|apply|file|filing|may|can|should|must|notice|refund|landlord|tenant|deposit|hearing|evidence)\b/gi;

function assertAnswerLanguage(text, expectRoman, name) {
  ok(!URDU_RE.test(text), `${name}: answer prose contains no Urdu script`,
    text.match(URDU_RE) ? `found "${(text.match(URDU_RE) || []).slice(0, 4).join('')}" in ${text.slice(0, 120)}` : '');
  const roman = (text.match(ROMAN_MARKER_RE) || []).length;
  const en = (text.match(EN_MARKER_RE) || []).length;
  if (expectRoman) {
    ok(roman >= 4, `${name}: answer prose is Roman Urdu (${roman} Roman markers, ${en} English)`,
      `expected Roman Urdu — ${text.slice(0, 200).replace(/\n/g, ' ')}`);
  } else {
    ok(en >= 3 && roman <= 1, `${name}: answer prose is English (${en} English markers, ${roman} Roman)`,
      `expected English — ${text.slice(0, 200).replace(/\n/g, ' ')}`);
  }
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

// /api/ai/generate and /api/ai/document-chat are the rate-limited "expensive"
// routes (6 requests per 60s for an anonymous client). This suite legitimately
// needs more than that, so a real 429 is waited out rather than scored as a
// language defect — the limiter itself is left exactly as production runs it.
async function postExpensive(path, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const out = await postJSON(path, body);
    if (out.status !== 429) return out;
    console.log(`    ..   ${path} throttled (HTTP 429) — waiting out the 60s window`);
    await sleep(62000);
  }
  return { status: 429, json: null };
}

async function sseChat(query, lang) {
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: query, preferredLanguage: lang })
  });
  const raw = await res.text();
  let text = '';
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6);
    if (payload === '[DONE]') break;
    try {
      const j = JSON.parse(payload);
      if (typeof j.chunk === 'string') text += j.chunk;
    } catch { /* non-JSON frame */ }
  }
  return text;
}

// The three input modes, one substantive tenancy question per mode. The Urdu-script
// row is the mode that used to be answered in English because the UI only ever
// sends 'en' or 'roman_urdu' as a preference.
const Q_EN = 'My landlord refuses to return my security deposit after I vacated the rented house in Lahore. What can I do?';
const Q_ROM = 'Mera landlord security deposit wapas nahi kar raha, main kya karoon?';
const Q_UR = 'میرا مالک مکان خالی کرنے کے بعد ضمانت واپس نہیں لوٹا رہا۔ میں کیا کروں؟';
// A real document (English) used by every document-assistant row so that only the
// LANGUAGE of the user's own question varies between the three modes.
const DOC = `LEGAL NOTICE
To: The Landlord, Mr. Abdul Rehman, House No. 12, Model Town, Lahore.
From: Ms. Sana Yousuf, tenant (vacated on 30 June 2025).
Take notice that a security deposit of Rs 250,000 was paid on 1 July 2023 under the
tenancy agreement dated 1 July 2023. The premises were vacated and handed back in
good condition on 30 June 2025, and no demand for repair was made at that time.
The deposit has not been returned after 45 days. You are called upon to refund the
sum of Rs 250,000 within 14 days of this notice, failing which legal proceedings
will be instituted at your risk as to cost and consequences.`;

console.log(`[P0] Starting backend on port ${PORT} …`);
const child = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'pipe']
});
let bootErr = '';
child.stderr.on('data', d => { bootErr += String(d); });

async function waitForHealth(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) return false;
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await sleep(400);
  }
  return false;
}

try {
  if (!(await waitForHealth(60000))) {
    console.error('[P0] Backend did not come up:\n' + bootErr.slice(0, 2000));
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  section('P0 — Chat: 3 input modes → answer language');
  {
    const en = await sseChat(Q_EN, 'en');
    assertAnswerLanguage(en, false, 'chat(EN input)');
    const rom = await sseChat(Q_ROM, 'roman_urdu');
    assertAnswerLanguage(rom, true, 'chat(Roman input)');
    // Mode 3 with the preference the UI actually sends: 'en' chrome + Urdu-script typing.
    const ur = await sseChat(Q_UR, 'en');
    assertAnswerLanguage(ur, true, 'chat(Urdu-script input, preference en)');
    const urAuto = await sseChat(Q_UR, 'ur');
    assertAnswerLanguage(urAuto, true, 'chat(Urdu-script input, preference ur)');
  }

  // -------------------------------------------------------------------------
  section('P0 — Advice (non-streaming) uses the same rule');
  {
    for (const [label, q, expectRoman] of [['EN', Q_EN, false], ['Roman', Q_ROM, true], ['Urdu script', Q_UR, true]]) {
      const { json } = await postJSON('/api/ai/advice', { userQuery: q, preferredLanguage: 'en', history: [] });
      assertAnswerLanguage(String(json?.text || ''), expectRoman, `advice(${label})`);
      await sleep(250);
    }
  }

  // -------------------------------------------------------------------------
  section('P0 — Legal Agent uses the same rule');
  {
    for (const [label, q, expectRoman] of [['EN', Q_EN, false], ['Roman', Q_ROM, true], ['Urdu script', Q_UR, true]]) {
      const { json } = await postJSON('/api/ai/agent', { message: q, preferredLanguage: 'en' });
      const reply = String(json?.reply || '');
      ok(!URDU_RE.test(reply), `agent(${label}): reply prose contains no Urdu script`);
      ok(expectRoman ? /qanoon|wakeel|adalat|darkhast|shikayat|karen|kya/.test(reply) : /court|law|lawyer|apply|file|tenant/i.test(reply),
        `agent(${label}): reply is in the expected language`, reply.slice(0, 160));
      await sleep(250);
    }
  }

  // -------------------------------------------------------------------------
  section('P0 — Document Assistant: the question language drives the answer');
  {
    const questions = [
      ['English', 'What do I need to know from this notice?', false],
      ['Roman', 'Is notice se mujhe kya maloom hona chahiye?', true],
      ['Urdu script', 'اس نوٹس سے مجھے کیا معلوم ہونا چاہیے؟', true]
    ];
    for (const [label, question, expectRoman] of questions) {
      const { json } = await postJSON('/api/ai/document-understanding', { text: DOC, question, preferredLanguage: 'en' });
      const prose = [json?.answer, json?.summary, ...(json?.nextSteps || [])].filter(Boolean).join('\n');
      ok(!URDU_RE.test(prose), `doc-understanding(${label}): prose contains no Urdu script`);
      ok(expectRoman
        ? /kya|hai|nahi|karen|aap|notice|deposit|karon|chahiye/i.test(String(json?.answer || ''))
        : /you|the|is|not|landlord|deposit|notice/i.test(String(json?.answer || '')),
        `doc-understanding(${label}): answer is in the expected language`, String(json?.answer || '').slice(0, 160));
      await sleep(250);
    }
    // A refusal is part of the answer: an unreadable upload asked in Urdu script
    // must refuse in Roman Urdu, never in English and never in Urdu script.
    const { json: refused } = await postJSON('/api/ai/document-understanding', {
      text: 'چھوٹا ٹکڑا', question: 'اس کا کیا مطلب ہے؟', preferredLanguage: 'en'
    });
    const refusalText = String(refused?.answer || '');
    ok(!URDU_RE.test(refusalText), 'doc-understanding(refusal): refusal prose contains no Urdu script');
    ok(/nahi|kya|baraye|upload|text|saka|parcel/i.test(refusalText),
      'doc-understanding(refusal): refusal is written in Roman Urdu', refusalText.slice(0, 200));
  }

  // -------------------------------------------------------------------------
  section('P0 — Readiness checklist and compare follow the same rule');
  {
    for (const [label, desc, expectRoman] of [
      ['EN', 'I need a checklist for a bail application', false],
      ['Roman', 'Bail application ki checklist chahiye', true],
      ['Urdu script', 'ضمانت کی درخواست کی چیک لسٹ چاہیے', true]
    ]) {
      const { json } = await postJSON('/api/ai/readiness-checklist', { description: desc, preferredLanguage: 'en' });
      const guidance = String(json?.guidance || '');
      ok(!URDU_RE.test(guidance), `checklist(${label}): guidance contains no Urdu script`);
      ok(expectRoman ? /aap|zaroori|checklist|hain|karen|ke liye/i.test(guidance) : /your|required|checklist|items|prepare/i.test(guidance),
        `checklist(${label}): guidance is in the expected language`, guidance.slice(0, 160));
      await sleep(250);
    }
    const { json: cmp } = await postJSON('/api/ai/document-compare', {
      textA: DOC,
      textB: DOC.replace('Rs 250,000', 'Rs 180,000').replace('14 days', '30 days'),
      preferredLanguage: 'en'
    });
    ok(!URDU_RE.test(String(cmp?.summary || '')), 'compare: summary contains no Urdu script');
  }

  // -------------------------------------------------------------------------
  section('P0 — a generated DOCUMENT follows the explicit document language (answer ≠ document)');
  {
    // The user explicitly chose Urdu script for the DOCUMENT while writing their
    // instruction in Urdu script: body Urdu script, meta prose Roman.
    const { json } = await postJSON('/api/ai/document-reply', {
      text: DOC,
      instruction: 'اس کا جواب بنائیں کہ رقم واپس کر دی گئی ہے',
      replyType: 'reply',
      language: 'ur'
    });
    ok(URDU_RE.test(String(json?.html || '')), 'document-reply: the document body is rendered in Urdu script when the user chose it');
    const meta = [json?.explanation, ...(json?.nextSteps || []), ...(json?.missingInformation || [])].filter(Boolean).join('\n');
    ok(!URDU_RE.test(meta), 'document-reply: explanation/next steps contain no Urdu script');
    ok(/aap|khaanay|maloomat|document|karen|baraye|har/i.test(String(json?.explanation || '')),
      'document-reply: explanation is written in Roman Urdu', String(json?.explanation || '').slice(0, 200));

    // Free-text drafting: the document FRAME language is the explicit choice. The
    // user's own Urdu-script words are preserved verbatim inside an English
    // document (P3 integrity), so this asserts the boilerplate, not the payload.
    const { json: enDoc } = await postExpensive('/api/ai/generate', { requestText: Q_UR, preferredLanguage: 'en' });
    const enHtml = String(enDoc?.html || '');
    ok(!/عنوان\s*:|بہ\s*:|محترم سر/.test(enHtml), 'generate(en): the document frame stays English for an Urdu-script request', enHtml.slice(0, 200));
    ok(/To,|Subject:|Respected Sir/i.test(enHtml), 'generate(en): the English frame headings are present', enHtml.slice(0, 200));
    const { json: urDoc } = await postExpensive('/api/ai/generate', { requestText: Q_UR, preferredLanguage: 'ur' });
    ok(/عنوان\s*:|بہ\s*:|محترم سر/.test(String(urDoc?.html || '')), 'generate(ur): the same request renders an Urdu-script frame only when the document language is Urdu script', String(urDoc?.html || '').slice(0, 200));
    // P2 at the HTTP layer: the ambiguous token must not invent a criminal forum.
    ok(!/bail/i.test(String(enDoc?.type || '')), 'generate(en): a deposit request is not drafted as a Bail Application', String(enDoc?.type || ''));
    ok(!/Court of Sessions|عدالت/i.test(enHtml), 'generate(en): no court forum invented for a deposit refund', enHtml.slice(0, 240));
  }

  // -------------------------------------------------------------------------
  section('P0 — the drafting "what is still missing" asks follow the request language');
  {
    // These asks are printed verbatim in the Drafting chat, so they are answer
    // prose — not document text — and never carry Urdu script.
    const ASK_ROWS = [
      ['EN', 'Draft a legal notice for recovery of an unpaid loan of Rs 400,000.', 'en', false],
      ['Roman', 'Mere dost ne 400,000 ka qarz wapas nahi kiya, us ka legal notice bana den.', 'en', true],
      ['Roman chrome', 'Draft a legal notice for recovery of an unpaid loan of Rs 400,000.', 'roman_urdu', true],
      ['Urdu script', 'میرے ساتھی نے چار لاکھ واپس نہیں کیے، اس کا قانونی نوٹس بنا دیں۔', 'en', true]
    ];
    let romanHtml = '';
    for (const [label, req, pref, expectRoman] of ASK_ROWS) {
      const { json } = await postExpensive('/api/ai/generate', { requestText: req, preferredLanguage: pref });
      if (label === 'Roman') romanHtml = String(json?.html || '');
      const asks = Array.isArray(json?.missingInformation) ? json.missingInformation.filter(Boolean) : [];
      ok(asks.length >= 1, `generate(${label}): a thin request still surfaces its missing essentials`, JSON.stringify(asks));
      ok(asks.every(a => !URDU_RE.test(a)), `generate(${label}): no ask carries Urdu script`, asks.join(' | ').slice(0, 220));
      // Wording unique to the Roman ask table — shared loanwords ("addressee",
      // "police station") also sit inside the English asks, so they prove nothing.
      const romanAsk = /Matlabi raqam|Poore waqiyat|Aap ka poora naam|ka naam aur pata|Woh police station jahan|idare ka naam|Woh tareekh ya period|zamanat maangi/i.test(asks.join(' '));
      const enAsk = /The specific amount|The full facts|Your full name|The name and address|The date\/period|The police station|The name of the university/i.test(asks.join(' '));
      ok(expectRoman ? romanAsk : (enAsk && !romanAsk),
        `generate(${label}): the asks are written in ${expectRoman ? 'Roman Urdu' : 'English'}`, asks.join(' | ').slice(0, 260));
      await sleep(200);
    }
    // The DOCUMENT body is untouched by this: an English document request written
    // in Roman still renders its clauses in English (answer ≠ document).
    ok(/That the|Whereas|You are hereby|Respected|Subject:/i.test(romanHtml), 'generate(Roman): the document itself stays in the chosen document language (English)', romanHtml.slice(0, 220));
    ok(!URDU_RE.test(romanHtml), 'generate(Roman): no Urdu script inside the English document');
  }

  // -------------------------------------------------------------------------
  section('P0 — document-chat: the edit reply follows the instruction language');
  {
    const { json: draft } = await postExpensive('/api/ai/generate', {
      requestText: 'Draft a complete legal notice to Ali Raza for recovery of unpaid loan of Rs 500,000 which I gave on 10 January 2026.',
      preferredLanguage: 'en'
    });
    const html = String(draft?.html || '');
    ok(/500,000/.test(html), 'document-chat fixture: an English draft containing Rs 500,000 was produced');
    const ROWS = [
      ['EN', 'change 500,000 to 750,000', false],
      ['Roman', 'amount 500,000 ko 750,000 kar do', true],
      ['Urdu script', 'رقم 500,000 کو 750,000 کر دیں', true]
    ];
    for (const [label, instr, expectRoman] of ROWS) {
      const { json } = await postJSON('/api/ai/document-chat', { context: html, history: [], userInput: instr });
      const steps = (json?.nextSteps || []).join('\n');
      const summary = String(json?.summary || '');
      ok(!URDU_RE.test(steps), `document-chat(${label}): next steps contain no Urdu script`);
      ok(!URDU_RE.test(summary.replace(/“[^”]*”/g, ' ')), `document-chat(${label}): summary prose (excluding quoted document text) has no Urdu script`, summary.slice(0, 200));
      const romanFrame = /aap ki draft mein jo tabdeeli/i.test(summary);
      ok(expectRoman ? romanFrame : !romanFrame,
        `document-chat(${label}): the ${expectRoman ? 'Roman framing sentence is present' : 'English reply carries no Roman framing'}`);
      ok(expectRoman
        ? /karein|kar len|likhein|badal|document|hissa|qanooni|zaban/i.test(steps)
        : /review|verify|save|print|preview|rephrase|form/i.test(steps),
        `document-chat(${label}): next steps are in the expected language`, steps.slice(0, 200));
      // The editor parses English and Roman Urdu instructions by design.
      if (!expectRoman || label === 'Roman') {
        ok(/750,000/.test(String(json?.html || '')),
          `document-chat(${label}): the ${label} instruction actually applied the edit`, summary.slice(0, 220));
      } else {
        ok(summary.length > 0 && json?.html === html,
          'document-chat(Urdu script): an unparsed Urdu-script edit instruction leaves the document unchanged instead of guessing', summary.slice(0, 220));
      }
      await sleep(250);
    }
  }

  // -------------------------------------------------------------------------
  section('P0 — the client mirror never emits Urdu-script answer prose');
  {
    const src = readFileSync('src/services/aiRuntime.ts', 'utf8');
    ok(!URDU_RE.test(src), 'src/services/aiRuntime.ts contains no Urdu-script string at all');
    const mirror = readFileSync('src/lib/responseLanguage.ts', 'utf8');
    ok(mirror.includes('isUrduScript(userText)') && mirror.includes("return 'roman_urdu'"),
      'src/lib/responseLanguage.ts keeps the script-outranks-preference rule');
    ok(/\\u0600-\\u06FF|[\u0600-\u06FF]/.test(mirror), 'the client mirror detects the Urdu script range');
    const serverSrc = readFileSync('server/index.js', 'utf8');
    ok(serverSrc.includes("if (/[\\u0600-\\u06FF]/.test(String(userQuery || ''))) return 'roman_urdu';"),
      'server/index.js resolves Urdu-script input to Roman before any preference');
    const draftingSrc = readFileSync('src/components/DraftingSection.tsx', 'utf8');
    ok(draftingSrc.includes("resolveResponseLanguage") && /const answerIsRoman = /.test(draftingSrc),
      'src/components/DraftingSection.tsx resolves its own prose from the user\'s words');
    ok(!/currentLang === 'roman_urdu' \? 'Ghaib maloomat|currentLang === 'roman_urdu' \? 'Dastawez ki qisam/.test(draftingSrc),
      'the drafting missing-info frame and "Drafted as" line are no longer chrome-only');
    const assistantSrc = readFileSync('src/components/DocumentIntelligenceSection.tsx', 'utf8');
    ok(assistantSrc.includes("resolveResponseLanguage") && /const answerIsRoman = /.test(assistantSrc),
      'src/components/DocumentIntelligenceSection.tsx resolves its answer language from the pasted text');
    ok(!/isRoman \? 'Wazahat'|isRoman \? 'Zaroori Cheezein'|isRoman \? 'Ikhtiyari Cheezein'|label: isRoman \?/.test(assistantSrc),
      'the assistant result headings follow the produced answer, not the UI chrome');
  }

  // -------------------------------------------------------------------------
  section('P0 — the preference is a floor, never a ceiling');
  {
    // An explicit roman_urdu chrome answers even an English question in Roman Urdu.
    const { json } = await postJSON('/api/ai/advice', { userQuery: Q_EN, preferredLanguage: 'roman_urdu', history: [] });
    assertAnswerLanguage(String(json?.text || ''), true, 'advice(EN input, roman preference)');
    // An 'en' chrome must not pull a Roman Urdu question back into English — this
    // was the mode-2 breach: the default UI language is English, so every Roman
    // Urdu question used to be answered in English.
    const { json: rom } = await postJSON('/api/ai/advice', { userQuery: Q_ROM, preferredLanguage: 'en', history: [] });
    assertAnswerLanguage(String(rom?.text || ''), true, 'advice(Roman input, en preference)');
    const serverSrc = readFileSync('server/index.js', 'utf8');
    ok(/if \(detectLanguage\(userQuery\) === 'roman_urdu'\) return 'roman_urdu';/.test(serverSrc),
      'server/index.js lets a detected Roman question outrank an English preference');
  }
} finally {
  child.kill();
}

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) console.log(failures.map(f => ' - ' + f).join('\n'));
process.exit(fail === 0 ? 0 : 1);
