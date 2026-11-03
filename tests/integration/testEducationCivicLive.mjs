/**
 * LIVE INGESTION ACCEPTANCE — GCU Hyderabad rules and BISP / 8171 procedures.
 *
 * Every assertion here is made against the running backend over POST
 * /api/ai/chat, reading the SSE frames, because "indexed" is not "answerable":
 * a record only counts as coverage when a question in English, Roman Urdu or
 * Urdu script comes back grounded in that record, with a citation that belongs
 * to it and a scope label that agrees with the question (2026-10-16 brief §3E, §4).
 * Requests are spaced for the shared limiter (~6 req / 60 s).
 *
 * Run: node server/index.js   (then)   node tests/integration/testEducationCivicLive.mjs
 */
const PORT = process.env.INSAF_PORT || 3001;
const BASE = `http://localhost:${PORT}`;
const URDU_SCRIPT = /[\u0600-\u06FF]/;

let pass = 0;
let fail = 0;
const failed = [];
const record = (name, ok, info = '') => {
  if (ok) pass += 1; else { fail += 1; failed.push(name); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' :: ' + info : ''}`);
};

const stamps = [];
async function hold() {
  for (;;) {
    while (stamps.length && Date.now() - stamps[0] > 60000) stamps.shift();
    if (stamps.length < 4) return;
    await new Promise(r => setTimeout(r, 12000));
  }
}

async function chat(userQuery, preferredLanguage = 'en', extra = {}) {
  await hold();
  stamps.push(Date.now());
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery, preferredLanguage, responseDetail: 'medium', history: [], ...extra })
  });
  const status = res.status;
  const raw = await res.text();
  let answer = '';
  let sources = [];
  let evidence = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const body = line.slice(6);
    if (body === '[DONE]') continue;
    try {
      const f = JSON.parse(body);
      if (typeof f.chunk === 'string') answer += f.chunk;
      if (f.meta?.sources?.length) sources = f.meta.sources;
      if (f.evidence) evidence = f.evidence;
    } catch { /* partial frame */ }
  }
  const urls = sources.map(s => s.sourceURL || s.url || '').join(' ');
  return { status, answer, sources, urls, evidence, verdict: (evidence || {}).verdict || '' };
}

const GCUH = 'gcuh\\.edu\\.pk';
const BISP = 'bisp\\.gov\\.pk';

// ---------------------------------------------------------------- education --
{
  const r = await chat('What is the weightage of the Pre-Entry Test in GCU Hyderabad admission merit?', 'en');
  record('E1 GCUH weightage answers over chat', r.status === 200 && r.answer.length > 200,
    `status=${r.status} len=${r.answer.length} verdict=${r.verdict}`);
  record('E2 GCUH weightage quotes the published 50% test share',
    /pre[- ]?entry/i.test(r.answer) && /50\s*%/.test(r.answer), r.answer.slice(0, 260));
  record('E3 GCUH weightage cites the university\'s own domain', new RegExp(GCUH, 'i').test(r.urls),
    r.urls.slice(0, 220));
}
{
  // "hazri" is the Roman spelling of حاضری that a citizen actually types; the
  // earlier string here was a mixed-script fragment patched into the non-word
  // "haydari", so it exercised no vocabulary at all.
  const r = await chat('GCU Hyderabad mein examination mein shamil hone ke liye kitni hazri zaroori hai?', 'roman_urdu');
  record('R1 GCUH attendance answers in Roman Urdu', r.status === 200 && !URDU_SCRIPT.test(r.answer) && r.answer.length > 150,
    `status=${r.status} len=${r.answer.length}`);
  record('R2 the 75% attendance rule survives the Roman path', /75\s*%/.test(r.answer), r.answer.slice(0, 260));
  record('R3 GCUH is cited in the Roman path too', new RegExp(GCUH, 'i').test(r.urls), r.urls.slice(0, 220));
}
{
  const r = await chat('جی سی یو حیدرآباد میں امتحان میں بیٹھنے کے لیے کم از کم حاضری کتنی ضروری ہے؟', 'ur');
  record('U1 Urdu-script GCUH query is answered, not refused', r.status === 200 && r.answer.length > 150,
    `status=${r.status} len=${r.answer.length} verdict=${r.verdict}`);
  record('U2 the Urdu-script question still returns the 75% figure', /75\s*%/.test(r.answer), r.answer.slice(0, 260));
  record('U3 the Urdu-script question cites GCU Hyderabad', new RegExp(GCUH, 'i').test(r.urls), r.urls.slice(0, 220));
}
{
  const r = await chat('How do I apply for a fee refund after cancelling my provisional admission at GCU Hyderabad?', 'en');
  record('E4 GCUH refund route names the Director Admissions',
    /director admissions/i.test(r.answer), r.answer.slice(0, 300));
  record('E5 GCUH refund ties the amount to the HEC policy it cites',
    /hec fee refund policy/i.test(r.answer), r.answer.slice(0, 300));
}

// ------------------------------------------------------------------- control --
{
  const r = await chat('What is the merit for admission at Government College University Lahore?', 'en');
  record('C1 a Lahore admission question does not cite GCU Hyderabad',
    !new RegExp(GCUH, 'i').test(r.urls), `urls=${r.urls.slice(0, 220)} verdict=${r.verdict}`);
  record('C2 the Lahore question is still answered or honestly refused, never invented',
    r.status === 200 && r.answer.length > 80, `status=${r.status} len=${r.answer.length}`);
}

// ----------------------------------------------------------------------- BISP --
{
  const r = await chat('What PMT cut-off score does BISP use to decide Benazir Kafaalat eligibility?', 'en');
  record('B1 BISP PMT cut-off answers over chat', r.status === 200 && r.answer.length > 150,
    `status=${r.status} len=${r.answer.length} verdict=${r.verdict}`);
  record('B2 the published 32 cut-off is quoted', /\b32\b/.test(r.answer), r.answer.slice(0, 260));
  record('B3 the 37 cut-off for a household with a differently abled member is quoted',
    /\b37\b/.test(r.answer), r.answer.slice(0, 300));
  record('B4 the answer cites bisp.gov.pk', new RegExp(BISP, 'i').test(r.urls), r.urls.slice(0, 220));
}
{
  const r = await chat('My mother was a BISP beneficiary and she has died. Which documents do we take to the Tehsil office?', 'en');
  record('B5 heir documents name the NADRA cancellation certificate',
    /cancellation/i.test(r.answer), r.answer.slice(0, 300));
  record('B6 heir documents name the union council death certificate',
    /death certificate/i.test(r.answer) && /union council/i.test(r.answer), r.answer.slice(0, 300));
  record('B7 the heir route cites BISP', new RegExp(BISP, 'i').test(r.urls), r.urls.slice(0, 220));
}
{
  const r = await chat('8171 ki qist mein se koi paisa maang raha hai, main shikayat kahan karun?', 'roman_urdu');
  record('B8 Roman BISP complaint names the toll-free helpline',
    /0800-?26477/.test(r.answer), r.answer.slice(0, 300));
  record('B9 Roman BISP complaint names the Tehsil office', /tehsil/i.test(r.answer), r.answer.slice(0, 300));
  record('B10 the Roman answer stays in Latin script', !URDU_SCRIPT.test(r.answer), r.answer.slice(0, 120));
}
{
  const r = await chat('How long does BISP take to decide a beneficiary complaint?', 'en');
  const m = /(\b15\b|fifteen)[^.\n]{0,80}(day|days)/i.exec(r.answer);
  const window = m ? r.answer.slice(Math.max(0, m.index - 200), m.index + 200) : '';
  record('B11 the bidder/procurement timelines are never used as a beneficiary timeline',
    !m || /bidder|procurement/i.test(window), m ? window.slice(0, 260) : 'no 15-day claim');
  record('B12 the complaint answer still gives the published channel',
    /0800-?26477|tehsil/i.test(r.answer), r.answer.slice(0, 260));
}
{
  const r = await chat('کیا بے نظیر کفالت کی اہلیت کا فورم کون سا ہے اور اسکور کیسے طے ہوتا ہے؟', 'ur');
  record('B13 Urdu-script BISP query returns evidence', r.status === 200 && r.answer.length > 120,
    `status=${r.status} len=${r.answer.length} verdict=${r.verdict}`);
  record('B14 Urdu-script BISP query cites BISP', new RegExp(BISP, 'i').test(r.urls), r.urls.slice(0, 220));
}

console.log(`\nSUMMARY education+civic live ingestion: ${pass} PASS / ${fail} FAIL`);
if (failed.length) console.log('FAILING: ' + failed.join(', '));
process.exit(fail === 0 ? 0 : 1);
