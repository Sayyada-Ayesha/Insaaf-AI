/**
 * LIVE ANSWER-INTELLIGENCE ACCEPTANCE (§8 of the answer-intelligence brief).
 *
 * Nothing here is mocked: every assertion is made against the running backend over
 * POST /api/ai/chat (SSE) and POST /api/ai/agent, because a unit pass on the intent
 * resolver proves only that the resolver resolves — it does not prove that the
 * citizen receives a clarification instead of a generic rent-law list. Requests are
 * paced for the shared limiter (~6 req / 60 s), and every response is checked for
 * HTTP 200 BEFORE its payload, so a throttled 429 can never read as a pass or as a
 * vacuous "no claims found".
 *
 * Run: PORT=3005 node server/index.js   (then)   INSAF_PORT=3005 node tests/integration/testEverydayAnswerLive.mjs
 */
const PORT = process.env.INSAF_PORT || 3001;
const BASE = `http://localhost:${PORT}`;
const URDU_SCRIPT = /[\u0600-\u06FF]/;

let pass = 0, fail = 0;
const failed = [];
function record(name, ok, info = '') {
  if (ok) pass += 1;
  else { fail += 1; failed.push(name); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' :: ' + info : ''}`);
}

const stamps = [];
async function hold() {
  for (;;) {
    while (stamps.length && Date.now() - stamps[0] > 60000) stamps.shift();
    if (stamps.length < 4) return;
    await new Promise((r) => setTimeout(r, 12000));
  }
}

async function chat(userQuery, preferredLanguage, history = []) {
  await hold();
  stamps.push(Date.now());
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery, preferredLanguage, responseDetail: 'medium', history })
  });
  const status = res.status;
  const raw = await res.text();
  if (!res.ok) return { status, answer: raw.slice(0, 200), sources: [], evidence: null, verdict: '' };
  let answer = '', sources = [], evidence = null;
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
  return { status, answer, sources, evidence, verdict: (evidence || {}).verdict || '' };
}

async function agent(message, preferredLanguage, history = []) {
  await hold();
  stamps.push(Date.now());
  const res = await fetch(`${BASE}/api/ai/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, preferredLanguage, history })
  });
  const status = res.status;
  const data = res.ok ? await res.json() : {};
  return {
    status,
    answer: String(data.reply || ''),
    sources: Array.isArray(data.sources) ? data.sources : [],
    evidence: data.evidence || null,
    verdict: (data.evidence || {}).verdict || ''
  };
}

// The three claims the brief named as unverified universals. They may only appear
// when the evidence gate itself said the answer is strong.
const UNIVERSAL_CLAIM = /(typically|usually|always|must) (be )?(registered|.*10 ?%|.*10 percent)|10 ?% (annual|per year|har saal)|registered with (the )?(rent registrar|police)|annual increment is (typically|usually)/i;
const PLACEHOLDER = /\[[^\]]*(Tasdeeq|Hawala|placeholder|TODO|your [a-z]+ here)|\bN\/A\b\]/i;
// An unqualified "VERIFIED …" heading asserts the answer itself was verified, so it
// may only appear when the gate said strong. The composer's qualified wording
// ("PARTIALLY VERIFIED …", "QISMAN VERIFIED …") states that no record matches the
// question exactly, which is the middle class §5 asks for — hence the lookbehind.
const UNQUALIFIED_VERIFIED = /(?<!PARTIALLY )(?<!QISMAN )\bVERIFIED (?:LEGAL )?(?:REFERENCE|JAWAB|MAKHAAZ|QANOONI HAWALA)/i;
const ANY_VERIFIED = /VERIFIED (?:LEGAL )?(?:REFERENCE|JAWAB|MAKHAAZ|QANOONI HAWALA)/i;

function honesty(name, r) {
  record(`${name} — HTTP 200`, r.status === 200, `status=${r.status}`);
  if (r.status !== 200) return false;
  const strong = r.verdict === 'strong';
  record(`${name} — no unverified universal claim`, strong || !UNIVERSAL_CLAIM.test(r.answer),
    `verdict=${r.verdict || 'none'}`);
  record(`${name} — unqualified VERIFIED wording only on a strong verdict`,
    strong || !UNQUALIFIED_VERIFIED.test(r.answer), `verdict=${r.verdict || 'none'}`);
  record(`${name} — no evidence at all claims no verification either`,
    r.verdict === 'strong' || r.verdict === 'weak' || !ANY_VERIFIED.test(r.answer),
    `verdict=${r.verdict || 'none'}`);
  record(`${name} — no bracketed placeholder in the answer`, !PLACEHOLDER.test(r.answer));
  record(`${name} — every source card has a real title`,
    r.sources.every((s) => String(s.title || '').trim().length > 3), `${r.sources.length} sources`);
  return true;
}

const CASES = [
  { id: 'salary', lang: 'roman_urdu', q: 'employer ne 2 mahine ki salary nahi di, kya karun',
    topic: /salary|tankhwa|wages|mazdoor|labour|employer|maid|company/i,
    other: /kiraya|tenant|landlord|deposit|security/i, label: 'employer not paying salary' },
  { id: 'refund', lang: 'roman_urdu', q: 'university meri fees refund nahi kar rahi',
    topic: /fee|refund|university|college|hec/i,
    other: /tenant|kiraya|landlord|salary|tankhwa/i, label: 'university refusing fee refund' },
  { id: 'suspend', lang: 'roman_urdu', q: 'college ne bina wajah mujhe suspend kar diya',
    topic: /suspend|explanation|show cause|student|disciplin|inquiry/i,
    other: /tenant|kiraya|salary|refund fee/i, label: 'student unfairly suspended' },
  { id: 'loan', lang: 'roman_urdu', q: 'dost ne 50000 udhaar liye the wapas nahi kiye',
    topic: /udhaar|loan|recover|agreement|wapas|civil/i,
    other: /tenant|kiraya|salary|fees refund/i, label: 'borrowed money not returned' },
  { id: 'notice', lang: 'roman_urdu', q: 'mujhe legal notice aya hai ab kya karun',
    topic: /notice|reply|jawab|14 din|within|advocate|wakil/i,
    other: /kiraya|tenant|salary|fees/i, label: 'legal notice received' },
  { id: 'evict', lang: 'roman_urdu', q: 'malik ne zabardasti ghar khali karwa liya',
    topic: /khali|evict|nikal|possession|notice|tenant|landlord/i,
    other: /salary|tankhwa|fees refund|udhaar/i, label: 'landlord forcing eviction' },
];

async function main() {
  console.log(`\n=== LIVE ANSWER INTELLIGENCE — ${BASE} ===\n`);

  // ── §8.1 the reported query must NOT produce a legal answer ──────────────────
  const bad = await chat('tenant [paise nh derha wapis', undefined);
  record('8.1 exact reported query returns HTTP 200', bad.status === 200, `status=${bad.status}`);
  record('8.1a it asks instead of answering (verdict=clarify)', bad.verdict === 'clarify', `verdict=${bad.verdict || 'none'}`);
  record('8.1b the question names BOTH directions',
    /kiraya|rent/i.test(bad.answer) && /security|advance|wapas|wapis|return/i.test(bad.answer));
  record('8.1c it does not dump the generic rent-law list',
    !/section \d|dafa \d|10 ?%|rent registrar/i.test(bad.answer), bad.answer.slice(0, 90));
  record('8.1d a clarification carries no verification heading at all', !ANY_VERIFIED.test(bad.answer));
  record('8.1e at most three question marks — not a long form',
    (bad.answer.match(/\?/g) || []).length <= 3, `${(bad.answer.match(/\?/g) || []).length} questions`);
  console.log(`\n  AFTER /chat "tenant [paise nh derha wapis" →\n  ${bad.answer.replace(/\n/g, '\n  ')}\n`);

  // ── §8.2 six everyday situations, each answered on its own subject ───────────
  const seen = [];
  const bodies = [];
  // The heading block is shared boilerplate by design; distinctness must live in the
  // substance, so compare both the whole reply and the reply without its banner.
  const stripBanner = (t) => t.replace(/^\s*\*\*[^*]*\*\*/, '').replace(/^\s*\*[^*]*\*/, '').trim();
  for (const c of CASES) {
    const r = await chat(c.q, c.lang);
    if (!honesty(`8.2 ${c.label}`, r)) continue;
    record(`8.2 ${c.label} — stays on its own subject`, c.topic.test(r.answer), r.answer.slice(0, 70));
    record(`8.2 ${c.label} — not the same generic answer as another dispute`,
      !(c.other.test(r.answer) && r.verdict !== 'strong'), `verdict=${r.verdict || 'none'}`);
    seen.push(r.answer.replace(/\s+/g, ' ').trim());
    bodies.push(stripBanner(r.answer).replace(/\s+/g, ' ').trim().slice(0, 260));
  }
  record('8.2x all six everyday answers are textually distinct',
    new Set(seen).size === seen.length && seen.length === CASES.length, `${seen.length} compared`);
  record('8.2y they differ in substance, not only in the heading banner',
    new Set(bodies).size === bodies.length && bodies.every((b) => b.length > 40), `${bodies.length} bodies`);

  // ── §8.3 the same disputes in Urdu script ───────────────────────────────────
  const ur1 = await chat('کرایہ دار تین ماہ سے کرایہ نہیں دے رہا، میں کیا کروں', undefined);
  if (honesty('8.3a rent arrears (Urdu script)', ur1)) {
    record('8.3a Urdu-script input is answered in Roman Urdu, not Urdu script', !URDU_SCRIPT.test(ur1.answer));
    record('8.3a rent arrears (Urdu script) stays on rent',
      /kiraya|rent|tenant/i.test(ur1.answer), ur1.answer.slice(0, 70));
  }
  const ur2 = await chat('مالک نے سیکورٹی واپس نہیں کی', undefined);
  if (honesty('8.3b deposit return (Urdu script)', ur2)) {
    record('8.3b Urdu-script input is answered in Roman Urdu, not Urdu script', !URDU_SCRIPT.test(ur2.answer));
    record('8.3b it recognises the withheld deposit, not unpaid rent',
      /wapas|wapis|security|advance|refund|return/i.test(ur2.answer), ur2.answer.slice(0, 70));
  }

  // ── §8.4 the same disputes in English ───────────────────────────────────────
  const en1 = await chat('My landlord will not return my security deposit', 'en');
  if (honesty('8.4a deposit return (English)', en1)) {
    record('8.4a English input answered in English', !URDU_SCRIPT.test(en1.answer) && /[a-z]{4}/.test(en1.answer));
    record('8.4a deposit return (English) stays on the deposit',
      /deposit|return|refund|security/i.test(en1.answer), en1.answer.slice(0, 70));
  }
  const en2 = await chat('My employer has not paid my salary for two months', 'en');
  if (honesty('8.4b unpaid salary (English)', en2)) {
    record('8.4b unpaid salary (English) stays on wages',
      /salary|wage|employer|labour/i.test(en2.answer), en2.answer.slice(0, 70));
  }

  // ── §8.5 follow-up after the clarification is remembered, not re-asked ──────
  const follow = await chat('haan kiraya nahi de raha', undefined, [
    { role: 'user', text: 'tenant [paise nh derha wapis' },
    { role: 'model', text: bad.answer }
  ]);
  if (honesty('8.5 follow-up after clarification', follow)) {
    record('8.5 the settled direction is not asked again', follow.verdict !== 'clarify', `verdict=${follow.verdict || 'none'}`);
    record('8.5 once settled it answers about rent arrears',
      /kiraya|rent|tenant/i.test(follow.answer), follow.answer.slice(0, 70));
  }

  // ── §8.6 the agent route sees the same collision and asks too ───────────────
  const ag1 = await agent('tenant [paise nh derha wapis', undefined);
  record('8.6 agent route returns HTTP 200', ag1.status === 200, `status=${ag1.status}`);
  if (ag1.status === 200) {
    record('8.6 agent asks the decisive question instead of answering',
      ag1.verdict === 'clarify', `verdict=${ag1.verdict || 'none'}`);
    record('8.6 agent asks only the relevant either-or',
      /kiraya|rent/i.test(ag1.answer) && /security|advance|wapas|wapis/i.test(ag1.answer));
  }
  const ag2 = await agent('consumer ne phone khareeda tha kharab hai dukan wala paisa nahi de raha', 'roman_urdu');
  if (honesty('8.7 defective product (agent)', ag2)) {
    record('8.7 defective product is not answered as a tenancy dispute',
      !/kiraya|rent|tenant/i.test(ag2.answer) || ag2.verdict === 'strong', ag2.answer.slice(0, 70));
  }

  console.log(`\n=== LIVE: ${pass} PASS / ${fail} FAIL ===`);
  if (failed.length) console.log(`FAILED:\n${failed.map((f) => ' - ' + f).join('\n')}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('SUITE ERROR:', e); process.exit(1); });
