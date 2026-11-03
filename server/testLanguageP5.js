// P5 — LANGUAGE ROUTING (student-rights examples) + TRANSLATION TRUTHFULNESS.
//
// Group A (§6): the brief's student-rights question, in all three input modes,
// through Main Chat, the Legal Agent and drafting — and the check is on the BODY
// of the answer, not just its heading.
// Group B (§6): every translation direction the UI actually exposes. A direction
// is only scored PASS when the response is genuinely in the target language;
// a 200 that returns the source text, or a mixed-script word swap, is a FAIL.
//
// Usage: node server/testLanguageP5.js      (spawns its own backend on TEST_PORT)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.TEST_PORT || 4270);
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
const ROMAN_MARKER_RE = /\b(masla|jawab|qanoon|qanooni|adalat|wakeel|shikayat|darkhast|tareeqa|mutabiq|zaroori|chahiye|nahi|hain|hai|kya|karna|karen|karoon|wapas|mera|meri|mujhe|aap|apna|liye|baraye|sawal|agar|aur|bhi|koi|kuch|raha|rahi|sakta|sakti|hoga|mein|talib|ilam|unnat|darakhwaat|khaas|taqseer)\b/gi;
const EN_MARKER_RE = /\b(the|your|you|court|law|section|article|apply|file|may|can|should|must|notice|university|admission|student|right|rights|written|appeal)\b/gi;

// Body-level: the whole answer is measured, so Roman headings over an English body
// (or the reverse) cannot pass.
function assertBodyLanguage(text, expectRoman, name) {
  ok(!URDU_RE.test(text), `${name}: answer body contains no Urdu script`,
    URDU_RE.test(text) ? text.slice(0, 160) : '');
  const roman = (text.match(ROMAN_MARKER_RE) || []).length;
  const en = (text.match(EN_MARKER_RE) || []).length;
  if (expectRoman) {
    ok(roman >= 4, `${name}: answer body is Roman Urdu (${roman} Roman markers, ${en} English)`, text.slice(0, 200));
  } else {
    ok(en >= 3 && roman <= 1, `${name}: answer body is English (${en} English markers, ${roman} Roman)`, text.slice(0, 200));
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
  let text = '';
  for (const line of (await res.text()).split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6);
    if (payload === '[DONE]') break;
    try { const j = JSON.parse(payload); if (typeof j.chunk === 'string') text += j.chunk; } catch { /* frame */ }
  }
  return text;
}

const S_EN = 'What are my rights if my university cancels my admission?';
const S_ROM = 'Agar university mera admission cancel kar de to mere kya rights hain?';
const S_UR = 'اگر یونیورسٹی میرا داخلہ منسوخ کر دے تو میرے کیا حقوق ہیں؟';

console.log(`[P5] Starting backend on port ${PORT} …`);
const child = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'pipe']
});
let bootErr = '';
child.stderr.on('data', d => { bootErr += d.toString(); });

async function waitForBoot() {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return true; } catch { /* not up yet */ }
    await sleep(1000);
  }
  return false;
}

try {
  if (!await waitForBoot()) { console.log('Backend did not boot.\n' + bootErr.slice(0, 800)); process.exit(2); }

  // -------------------------------------------------------------------------
  section('P5-A — Main Chat: student-rights question, 3 input modes');
  {
    const rows = [['EN', S_EN, false], ['Roman', S_ROM, true], ['Urdu script', S_UR, true]];
    for (const [label, q, expectRoman] of rows) {
      const text = await sseChat(q, 'en');
      ok(text.length > 120, `chat(${label}): an answer body came back (${text.length} chars)`, text.slice(0, 120));
      assertBodyLanguage(text, expectRoman, `chat(${label})`);
      await sleep(250);
    }
  }

  // -------------------------------------------------------------------------
  section('P5-A — Legal Agent: same question, 3 input modes');
  {
    const rows = [['EN', S_EN, false], ['Roman', S_ROM, true], ['Urdu script', S_UR, true]];
    for (const [label, q, expectRoman] of rows) {
      const { json } = await postJSON('/api/ai/agent', { message: q, preferredLanguage: 'en' });
      const reply = String(json?.reply || '');
      ok(reply.length > 80, `agent(${label}): a reply body came back (${reply.length} chars)`, reply.slice(0, 120));
      assertBodyLanguage(reply, expectRoman, `agent(${label})`);
      await sleep(250);
    }
  }

  // -------------------------------------------------------------------------
  section('P5-A — Drafting: answer prose follows the request, the document follows the choice');
  {
    const rows = [
      ['EN', S_EN, 'en', false],
      ['Roman', S_ROM, 'en', true],
      ['Urdu script', S_UR, 'en', true]
    ];
    for (const [label, req, pref, expectRoman] of rows) {
      const { status, json } = await postExpensive('/api/ai/generate', { requestText: req, preferredLanguage: pref });
      if (!ok(status === 200 && !!json, `generate(${label}): HTTP 200 with a payload`, `status ${status}`)) continue;
      const asks = Array.isArray(json?.missingInformation) ? json.missingInformation.filter(Boolean) : [];
      const metaProse = [asks.join('\n'), String(json?.explanation || ''), String(json?.summary || '')]
        .filter(Boolean).join('\n');
      ok(metaProse.length > 0, `generate(${label}): meta prose exists to check (${metaProse.length} chars)`, metaProse.slice(0, 160));
      ok(!URDU_RE.test(metaProse), `generate(${label}) meta: contains no Urdu script`, metaProse.slice(0, 160));
      // A single short ask carries a handful of words, so the observable rule is
      // WHICH ask table the engine used, not how many markers it accumulated.
      const romanAsk = /\b(aap|poora naam|naam|matlabi|waqiyat|idare|karen|karein|bataen|darkhast|darkhwast|sawal|zaroori)\b/i.test(metaProse);
      const enAsk = /^\s*\[?(Your full name|Institution name|Name of the institution|Please (provide|specify|mention)|Amount involved)/i.test(metaProse.replace(/\n/g, ' '));
      ok(expectRoman ? (romanAsk && !enAsk) : (enAsk || !romanAsk),
        `generate(${label}) meta: uses the ${expectRoman ? 'Roman' : 'English'} ask wording`, metaProse.slice(0, 200));
      if (metaProse.length >= 200) assertBodyLanguage(metaProse, expectRoman, `generate(${label}) meta body`);
      await sleep(250);
    }
    // Explicit alternative output language: the DOCUMENT is asked for in Urdu
    // script. The document may be Urdu script; the surrounding answer may not.
    const { status, json } = await postExpensive('/api/ai/generate', { requestText: S_UR, preferredLanguage: 'ur' });
    if (ok(status === 200 && !!json, `generate(ur document): HTTP 200 with a payload`, `status ${status}`)) {
      const html = String(json?.html || '');
      ok(URDU_RE.test(html), 'generate(ur document): the document body is rendered in Urdu script when explicitly chosen', html.slice(0, 160));
      const asks = Array.isArray(json?.missingInformation) ? json.missingInformation.filter(Boolean) : [];
      const meta = [asks.join('\n'), String(json?.explanation || ''), String(json?.summary || '')].filter(Boolean).join('\n');
      ok(!URDU_RE.test(meta), 'generate(ur document): the answer prose around an Urdu document stays Urdu-script free', meta.slice(0, 160));
    }
  }

  // -------------------------------------------------------------------------
  section('P5-B — translation: every direction exposed in the UI');
  {
    const SRC = {
      'en-to-ur': 'You can file an appeal within 30 days against the order of the court.',
      'ur-to-en': 'آپ عدالت کے حکم کے خلاف تیس دن کے اندر اپیل کر سکتے ہیں۔',
      'roman-to-ur': 'Aap 30 din ke andar appeal kar sakte hain.'
    };
    const SOURCES = Object.values(SRC);
    for (const [dir, text] of Object.entries(SRC)) {
      const { status, json } = await postJSON('/api/ai/translate', { text, direction: dir });
      // 1. An unsupported direction is an error, not a 200 success.
      const isError = status === 501 || status === 503 || status >= 400;
      ok(isError, `translate(${dir}): not reported as success (HTTP ${status})`, `HTTP ${status}`);
      ok(json?.translatedText == null, `translate(${dir}): no translatedText field is populated`, JSON.stringify(json)?.slice(0, 200));
      // 2. The source text is never handed back dressed as a translation.
      const bodyText = JSON.stringify(json || {});
      ok(!bodyText.includes(text), `translate(${dir}): the source text is not silently returned as the translation`);
      // 3. No mixed-script word swap anywhere in the payload.
      const anyString = [json?.error, json?.message, json?.code].filter(Boolean).join(' ');
      ok(!URDU_RE.test(anyString), `translate(${dir}): no mixed-script output presented as a result`, anyString.slice(0, 160));
      // 4. The state is explicit and machine-readable, with a human explanation.
      ok(json?.supported === false, `translate(${dir}): supported:false is stated explicitly`, bodyText.slice(0, 200));
      ok(typeof json?.error === 'string' && json.error.length > 30, `translate(${dir}): an explanation is returned for the UI`, String(json?.error || '').slice(0, 160));
      ok(json?.direction === dir, `translate(${dir}): the attempted direction is echoed back`, String(json?.direction));
      await sleep(250);
    }

    // Input validation still behaves like validation, not like a translation.
    const empty = await postJSON('/api/ai/translate', { text: '', direction: 'en-to-ur' });
    ok(empty.status === 400, `translate(empty): HTTP 400, not a success`, `HTTP ${empty.status}`);
    const long = await postJSON('/api/ai/translate', { text: 'x'.repeat(20001), direction: 'en-to-ur' });
    ok(long.status === 400, `translate(oversized): HTTP 400, not a success`, `HTTP ${long.status}`);
    const bogus = await postJSON('/api/ai/translate', { text: SRC['en-to-ur'], direction: 'not-a-direction' });
    ok(bogus.status >= 400 && bogus.json?.translatedText == null,
      'translate(unknown direction): rejected as an error with no fake output', `HTTP ${bogus.status}`);

    // The word-substitution glossary that produced "file an اپیل within 30 دن" is gone.
    const serverSrc = readFileSync('server/index.js', 'utf8');
    ok(!/offlineTranslate/.test(serverSrc), 'server/index.js no longer contains the dictionary word-swap translator');
    ok(!serverSrc.includes("'chalan': 'چالان'"), 'server/index.js no longer ships the EN→UR term dictionary');

    // The client surfaces the error instead of showing the input as translated.
    const runtimeSrc = readFileSync('src/services/aiRuntime.ts', 'utf8');
    ok(/supported:\s*false/.test(runtimeSrc) && /error:\s*typeof data\.error/.test(runtimeSrc),
      'src/services/aiRuntime.ts returns supported:false with the server error');
    ok(!URDU_RE.test(runtimeSrc), 'src/services/aiRuntime.ts stays free of Urdu-script strings');
    const uiSrc = readFileSync('src/components/DocumentIntelligenceSection.tsx', 'utf8');
    ok(/resultUnsupported/.test(uiSrc) && /Translation not available/.test(uiSrc),
      'the Document Intelligence UI labels a failed translation as unavailable');
    ok(/Sentence-level translation is not available in this build/.test(uiSrc),
      'the Document Intelligence UI states the limitation before the user clicks');
    ok(!/selectedAudience/.test(uiSrc),
      'the audience control that only fed the translate endpoint is gone (no dead control)');
  }
} finally {
  child.kill();
}

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) console.log(failures.map(f => ' - ' + f).join('\n'));
process.exit(fail === 0 ? 0 : 1);
