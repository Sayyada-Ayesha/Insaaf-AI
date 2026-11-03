/*
 * HYDERABAD / SINDH ROUTING REGRESSION (live backend, no voice code involved).
 *
 * These are the queries that previously exposed the geography bug. Each case
 * asserts against the branch that actually owns it:
 *   - "retrieval"  : intent → scope → Hybrid RAG → Corrective RAG → verified
 *                    evidence, with the asked city/province recognised and
 *                    correction.attempts bounded by MAX_CORRECTIVE_ATTEMPTS.
 *   - "safety"     : the domestic-violence query is owned by the PRE-EXISTING
 *                    pre-retrieval curated safety branch (server/index.js
 *                    isDomesticViolence), which returns a grounded safety answer
 *                    and deliberately no gate payload.
 *   - "closed-defect": the city + amount tenancy query. It used to be hijacked
 *                    into domain=education (an injected student rewrite re-routed
 *                    the question) and answered a landlord's deposit with HEC
 *                    tuition-refund percentages. The contract now: the routed
 *                    domain stays the one the user's own words chose, no
 *                    student-corpus record enters the answer, and — because no
 *                    Sindh record in the corpus speaks to a withheld deposit —
 *                    the reply is either grounded evidence or the explicit
 *                    no-verified-record refusal. Never another subject's rules.
 *                    tests/e2e/testPhaseAW.cjs W14.1/W14.2 carry the same finding.
 * Run: node server/index.js  (then)  node tests/integration/testHyderabadRouting.cjs
 */
const BASE = process.env.INSAAF_BASE || 'http://localhost:3001';
const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer runtime-test-suite' };

const CASES = [
  {
    name: 'H1 tenancy deposit, Sindh Hyderabad (Roman Urdu)',
    q: 'Sindh ke Hyderabad mein makan malik kiraye ki raqam wapas nahi de raha',
    expect: 'retrieval', wantDomain: 'civil', wantCity: 'hyderabad', wantProvince: 'sindh'
  },
  {
    name: 'H2 cheque dishonour, Karachi (Roman Urdu)',
    q: 'Karachi mein chque ke khilaf kya kar sakte hain?',
    expect: 'retrieval', wantDomain: 'banking', wantCity: 'karachi', wantProvince: 'sindh'
  },
  {
    name: 'H3 FIR refusal at police station, Hyderabad (Roman Urdu)',
    q: 'Hyderabad mein police wala FIR likhwane se inkar kar raha hai, kya karun?',
    expect: 'retrieval', wantDomain: 'criminal', wantCity: 'hyderabad', wantProvince: 'sindh'
  },
  {
    name: 'H4 Sindh Domestic Violence Act (curated safety branch)',
    q: 'Sindh domestic violence Act kya kehta hai?',
    expect: 'safety'
  },
  {
    name: 'H5 Punjab rent law',
    q: 'Punjab rent law kya hai?',
    expect: 'retrieval', wantDomain: 'province', wantCity: '', wantProvince: 'punjab'
  },
  {
    name: 'H6 city + amount tenancy query keeps its own domain (closed misroute)',
    q: 'My landlord in Hyderabad is keeping my security deposit of 150000 rupees, what are my options?',
    expect: 'closed-defect', wantDomain: 'civil'
  },
  {
    name: 'H7 control: the same sentence without the city retrieves evidence',
    q: 'My landlord is keeping my security deposit of 150000 rupees, what are my options?',
    expect: 'retrieval', wantDomain: 'civil', wantCity: '', wantProvince: ''
  }
];

const triState = v => v === true || v === false || v === 'unclear';
const stamps = [];

async function agent(message) {
  for (;;) {
    while (stamps.length && Date.now() - stamps[0] > 60000) stamps.shift();
    if (stamps.length >= 45) await new Promise(r => setTimeout(r, 9000));
    const res = await fetch(`${BASE}/api/ai/agent`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ message, preferredLanguage: 'en', history: [] })
    });
    stamps.push(Date.now());
    if (res.status === 429) { await new Promise(r => setTimeout(r, 9000)); continue; }
    return { status: res.status, body: await res.json() };
  }
}

(async () => {
  let pass = 0, fail = 0;
  for (const c of CASES) {
    const t0 = Date.now();
    const { status, body } = await agent(c.q);
    const ev = body.evidence || {};
    const cor = body.correction || {};
    const asked = (ev.scope || {}).asked || {};
    const intake = body.intake || null;
    const reply = String(body.reply || '').replace(/\s+/g, ' ').trim();
    const srcs = (body.sources || []).length;
    const srcTitles = (body.sources || [])
      .map(s => `${s.title || ''} ${s.docId || ''} ${s.key || ''}`).join(' | ');
    const reasons = (ev.reasons || []).join(',');

    let ok, check;
    if (c.expect === 'retrieval') {
      ok = status === 200
        && (ev.verdict === 'strong' || ev.verdict === 'partial')
        && srcs > 0
        && (cor.attempts === undefined || cor.attempts <= (cor.maxAttempts || 2))
        && !!intake && reply.length > 60
        && (!c.wantDomain || ev.domain === c.wantDomain)
        && (!c.wantCity || String(asked.city || '').toLowerCase() === c.wantCity)
        && (!c.wantProvince || String(asked.province || '').toLowerCase() === c.wantProvince);
      check = `domain=${ev.domain}(want ${c.wantDomain || '-'}) city=${asked.city || '-'}(want ${c.wantCity || '-'}) `
        + `province=${asked.province || '-'}(want ${c.wantProvince || '-'}) verdict=${ev.verdict} sources=${srcs} attempts=${cor.attempts}`;
    } else if (c.expect === 'safety') {
      ok = status === 200
        && /Domestic Violence Act 2013/i.test(reply)
        && /police emergency 15/i.test(reply)
        && srcs === 0 && body.evidence === undefined
        && !!intake && triState(intake.professionalSupportNeeded);
      check = `safetyAnswer=${/not alone/i.test(reply)} dvAct2013=${/Domestic Violence Act 2013/i.test(reply)} `
        + `emergency15=${/police emergency 15/i.test(reply)} gatePayload=${body.evidence !== undefined} `
        + `sources=${srcs} support=${JSON.stringify(intake && intake.professionalSupportNeeded)}`;
    } else {
      const studentContamination = /(university|student|hostel|tuition|HEC|scholarship|admission)/i;
      const grounded = (ev.verdict === 'strong' || ev.verdict === 'partial') && srcs > 0;
      const honestRefusal = /could not find a verified/i.test(reply);
      ok = status === 200 && ev.domain === c.wantDomain
        && String(asked.city || '').toLowerCase() === 'hyderabad'
        && !studentContamination.test(srcTitles) && !studentContamination.test(reply)
        && (grounded || honestRefusal)
        && cor.attempts <= (cor.maxAttempts || 2) && !!intake;
      check = `domain=${ev.domain}(want ${c.wantDomain}) city=${asked.city || '-'} `
        + `verdict=${ev.verdict} sources=${srcs} studentWordsInSources=${studentContamination.test(srcTitles)} `
        + `grounded=${grounded} honestRefusal=${honestRefusal} reasons=${reasons} attempts=${cor.attempts}`;
    }
    if (ok) pass++; else fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
    console.log(`        q     : ${c.q}`);
    console.log(`        check : ${check}`);
    console.log(`        intake: support=${JSON.stringify(intake && intake.professionalSupportNeeded)} `
      + `domain=${intake && intake.domain} juris=${intake && intake.jurisdiction} loc=${intake && intake.location}`);
    console.log(`        reply : ${reply.slice(0, 140)}`);
    console.log(`        ms=${Date.now() - t0} correction{attempts=${cor.attempts},max=${cor.maxAttempts},`
      + `triggered=${cor.triggered},strategies=${(cor.strategies || []).join('/')}}\n`);
  }
  console.log(`==== HYDERABAD/SINDH ROUTING REGRESSION: ${pass} PASS / ${fail} FAIL (of ${CASES.length}) ====`);
  // exitCode, not exit(): process.exit() aborts in libuv on Windows while the
  // keep-alive agent sockets are still being torn down.
  process.exitCode = fail === 0 ? 0 : 1;
})();
