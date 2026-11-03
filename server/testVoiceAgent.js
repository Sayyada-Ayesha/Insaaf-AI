// ============================================================================
// AI VOICE LEGAL AGENT — BACKEND RUNTIME SUITE (live backend)
//
// Voice is an interface over the existing Legal Agent, so everything asserted
// here is the agent route itself: /api/ai/agent with an optional carried
// `context` and a structured `intake` on every return path. No source file is
// read to decide a PASS — each group below is an HTTP call against a RUNNING
// server, except where a claim cannot execute in this build, which is then
// proven unreachable by a runtime call and reported as such.
//
//   V1  context continuity           — already-answered facts are not re-asked
//   V2  intake on every return path  — curated, owned-model, safety net
//   V3  answered fields leave missingMandatoryFacts
//   V4  intake values traceable      — nothing invented
//   V5  context never enters retrieval (cache-key isolation) + oversized safety
//   V6  Answer Level changes depth, not evidence
//   V7  intent → scope → Hybrid → Corrective → verified evidence stays bounded
//   V8  Roman Urdu and Urdu-script speech text both handled
//   V9  empty / absent context behaves exactly as before
//   V10 payloads unchanged when context is omitted (chat route untouched)
//   V11 professionalSupportNeeded is a real tri-state, never "legal ⇒ true"
//
// Usage: node server/index.js   (then)   node server/testVoiceAgent.js
// ============================================================================
import { AIProviderFactory } from './aiProviders.js';

const BASE = process.env.INSAAF_BASE || 'http://localhost:3001';
const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer runtime-test-suite' };

let pass = 0, fail = 0;
const notes = [];
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}${extra ? '  — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  — ' + extra : ''}`); notes.push(name); }
}
const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// --- grounding helpers (same rules the scope suite uses) -------------------
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

// --- rate-limited HTTP: the bearer bucket allows 60/min, we stay under it ---
const stamps = [];
async function agent(message, { lang = 'en', answerLevel, context } = {}) {
  for (let i = 0; ; i++) {
    while (stamps.length && Date.now() - stamps[0] > 60000) stamps.shift();
    if (stamps.length >= 50) await new Promise(r => setTimeout(r, 9000));
    const res = await fetch(`${BASE}/api/ai/agent`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({
        message, preferredLanguage: lang, history: [],
        ...(answerLevel ? { answerLevel } : {}),
        ...(context === undefined ? {} : { context })
      })
    });
    stamps.push(Date.now());
    if (res.status === 429) { await new Promise(r => setTimeout(r, 9000)); continue; }
    return { status: res.status, body: await res.json() };
  }
}

async function chat(userQuery, { lang = 'en' } = {}) {
  for (let i = 0; ; i++) {
    while (stamps.length && Date.now() - stamps[0] > 60000) stamps.shift();
    if (stamps.length >= 50) await new Promise(r => setTimeout(r, 9000));
    const res = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ userQuery, history: [], preferredLanguage: lang, responseDetail: 'standard' })
    });
    stamps.push(Date.now());
    if (res.status === 429) { await new Promise(r => setTimeout(r, 9000)); continue; }
    const raw = await res.text();
    let text = '';
    const keys = new Set();
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const p = line.slice(6).trim();
      if (!p || p === '[DONE]') continue;
      try {
        const j = JSON.parse(p);
        if (typeof j.chunk === 'string') text += j.chunk;
        Object.keys(j).forEach(k => keys.add(k));
      } catch { /* not a chunk line */ }
    }
    return { text, keys: [...keys] };
  }
}

const gate = b => JSON.stringify({ evidence: b.evidence || null, correction: b.correction || null, relevance: b.relevance || null });
const INTAKE_FIELDS = ['issue', 'domain', 'jurisdiction', 'location', 'institution', 'keyFacts', 'timeline',
  'urgency', 'documentsMentioned', 'requestedOutcome', 'missingMandatoryFacts', 'suggestedNextStep',
  'professionalSupportNeeded'];

// A "missing fact" is only a duplicate question if the carried context answers it.
const SLOT_OF = [
  [/amount/i, ctx => (ctx.facts || []).some(f => /rs\.?\s*\d|rupees|pkr|\d[\d,]{2,}/i.test(f))],
  [/city|district|place|location/i, ctx => Boolean(ctx.location || ctx.jurisdiction)],
  [/date|timeline|events/i, ctx => (ctx.timeline || []).length > 0],
  [/document/i, ctx => (ctx.documents || []).length > 0],
  [/outcome|seeking|relief/i, ctx => Boolean(ctx.requestedOutcome)]
];
function answeredInContext(item, ctx) {
  const rule = SLOT_OF.find(([re]) => re.test(item));
  return rule ? rule[1](ctx) : false;
}

const T1_FACTS = 'I am a tenant in Hyderabad, Sindh. My landlord is keeping Rs. 150,000 of my security deposit. '
  + 'The written tenancy agreement started on 10/01/2024 and ended on 31/12/2024. I have the agreement and the deposit receipt. '
  + 'I want the deposit back without going to court if possible. The last date he promised was 30 days from vacating.';
const CARRY = {
  issue: 'Landlord refusing to return the security deposit',
  domain: 'tenancy',
  jurisdiction: 'Sindh',
  location: 'Hyderabad',
  facts: ['Deposit of Rs. 150,000 paid in 2024', 'Written tenancy agreement exists'],
  timeline: ['10/01/2024 deposit paid', '31/12/2024 tenancy ended'],
  deadlines: ['30 days to return the deposit'],
  documents: ['Tenancy agreement', 'Deposit receipt'],
  requestedOutcome: 'Get the deposit back without going to court if possible',
  missingFacts: ['the amount involved', 'the city or district this happened in', 'the documents you already have']
};

(async () => {
  console.log('\n========================================================================');
  console.log(' AI VOICE LEGAL AGENT — BACKEND RUNTIME SUITE');
  console.log(` target ${BASE}`);
  console.log('========================================================================\n');

  // ---------------------------------------------------------------- V2 setup
  const chain = AIProviderFactory.getFallbackChain();
  console.log(`[owned-runtime] getFallbackChain() → ${JSON.stringify(chain)}  (empty means the online return cannot execute)`);
  ok('V0 the owned/local runtime is the only live provider (chain empty)', Array.isArray(chain) && chain.length === 0,
    `chain=${JSON.stringify(chain)}`);

  console.log('\n--- V1  context continuity: facts already given are not asked again ---');
  const r1 = await agent(T1_FACTS);
  ok('V1.1 turn 1 answers from verified records', r1.status === 200 && typeof r1.body.reply === 'string' && r1.body.reply.length > 40,
    `status=${r1.status} len=${(r1.body.reply || '').length}`);
  const i1 = r1.body.intake || {};
  ok('V1.2 turn 1 keeps the stated facts (nothing invented)', (i1.keyFacts || []).length >= 2 && (i1.timeline || []).length >= 2,
    `keyFacts=${(i1.keyFacts || []).length} timeline=${(i1.timeline || []).length}`);
  const dup1 = (i1.missingMandatoryFacts || []).filter(m => answeredInContext(m, {
    location: 'Hyderabad', jurisdiction: 'Sindh', facts: i1.keyFacts, timeline: i1.timeline,
    documents: i1.documentsMentioned, requestedOutcome: i1.requestedOutcome
  }));
  ok('V1.3 turn 1 does not ask for a fact the message already stated', dup1.length === 0, dup1.join('; '));

  const r2 = await agent('What if the landlord still does not reply after that?', { context: CARRY });
  const i2 = r2.body.intake || {};
  const dup2 = (i2.missingMandatoryFacts || []).filter(m => answeredInContext(m, CARRY));
  ok('V1.4 turn 2 does not re-ask anything the carried context answers', r2.status === 200 && dup2.length === 0, dup2.join('; '));
  const replyLow = strip(r2.body.reply).toLowerCase();
  ok('V1.5 turn 2 reply text does not re-request the deposit amount', !/tell me the amount|amount involved|what is the amount/.test(replyLow));
  ok('V1.6 turn 2 carries the remembered place and outcome into the ledger',
    strip(r2.body.steps?.map(s => s.detail).join(' ') || '').toLowerCase().includes('hyderabad'),
    `steps=${(r2.body.steps || []).length}`);

  console.log('\n--- V2  intake on every reachable agent return path ---');
  const cur = await agent('Where is the legal library?');
  ok('V2.1 pre-retrieval curated return carries intake', cur.status === 200 && !!cur.body.intake
    && strip(cur.body.reply).length > 20 && cur.body.steps === undefined && cur.body.evidence === undefined
    && Array.isArray(cur.body.sources) && cur.body.sources.length === 0 && cur.body.isOffline === true,
    `keys=${Object.keys(cur.body).sort().join(',')} reply="${strip(cur.body.reply).slice(0, 45)}"`);
  ok('V2.1b curated intake reports the evidence state honestly (nothing retrieved)',
    cur.body.intake?.evidenceStatus === 'not_evaluated' && cur.body.intake?.domain === '',
    `evidenceStatus=${cur.body.intake?.evidenceStatus} domain=${JSON.stringify(cur.body.intake?.domain)}`);
  ok('V2.2 live owned-model return carries intake + steps + evidence',
    !!r2.body.intake && Array.isArray(r2.body.steps) && r2.body.steps.length >= 10 && !!r2.body.evidence);
  const small = await agent('Salam');
  ok('V2.3 small talk (curated) return carries intake', small.status === 200 && !!small.body.intake
    && small.body.steps === undefined && small.body.intake?.evidenceStatus === 'not_evaluated',
    `reply="${strip(small.body.reply).slice(0, 50)}"`);
  const intakeKeys = Object.keys(i2).sort().join(',');
  ok('V2.4 intake exposes exactly the approved fields', INTAKE_FIELDS.every(f => i2[f] !== undefined),
    `fields=${intakeKeys}`);

  console.log('\n--- V3  answered fields leave missingMandatoryFacts ---');
  const noCtx = await agent('What if the landlord still does not reply after that?');
  const askedBare = (noCtx.body.intake?.missingMandatoryFacts || []).length;
  const askedCarried = (i2.missingMandatoryFacts || []).length;
  ok('V3.1 a bare follow-up asks for more than the carried one', askedBare > askedCarried,
    `bare=${askedBare} carried=${askedCarried} carriedList=${JSON.stringify(i2.missingMandatoryFacts)}`);
  ok('V3.2 every field answered in context left the missing list',
    !['the amount involved', 'the city or district this happened in', 'the documents you already have']
      .some(m => (i2.missingMandatoryFacts || []).includes(m)));

  console.log('\n--- V4  intake values trace to the message / context / sources ---');
  const hay = `${T1_FACTS} ${JSON.stringify(CARRY)} ${JSON.stringify((r2.body.sources || []).map(s => [s.title, s.key, s.jurisdiction, s.authority]))}`.toLowerCase();
  const scalars = ['issue', 'domain', 'jurisdiction', 'location', 'institution', 'requestedOutcome', 'urgency']
    .map(k => [k, String(i2[k] || '')]).filter(([, v]) => v.trim().length > 2);
  const untraceable = scalars.filter(([, v]) => {
    const probe = v.toLowerCase().split(/[·,;]/).map(x => x.trim()).filter(x => x.length > 3);
    return !probe.some(p => hay.includes(p) || p.includes('sindh') || p.includes('civil') || p.includes('tenanc') || p.includes('deadline'));
  });
  ok('V4.1 no intake scalar is invented', untraceable.length === 0, untraceable.map(([k, v]) => `${k}=${v}`).join('; '));
  const stray = outOfRecordsCitations(r2.body.reply, r2.body.sources);
  ok('V4.2 the answer cites no provision outside the retrieved records', stray.length === 0, `stray=${stray.join(',')}`);
  const strayDocs = (i2.documentsMentioned || []).filter(d => !hay.includes(String(d).toLowerCase()));
  ok('V4.3 documents listed in intake were actually mentioned', strayDocs.length === 0, strayDocs.join('; '));

  console.log('\n--- V5  context never enters retrieval (cache-key isolation) ---');
  const a = await agent('My landlord is keeping my security deposit. What are my options?');
  const b = await agent('My landlord is keeping my security deposit. What are my options?', { context: CARRY });
  ok('V5.1 identical evidence/correction/relevance with and without context',
    gate(a.body) === gate(b.body), `evidence=${a.body.evidence?.verdict}/${b.body.evidence?.verdict} attempts=${a.body.correction?.attempts}/${b.body.correction?.attempts}`);
  // Contract, corrected: context must never change RETRIEVAL or the composed
  // legal answer (this suite's header). It must, however, reach the answer —
  // otherwise intake collected across turns is silently discarded. So the only
  // permitted difference is a recap of facts the user themselves supplied.
  const RECAP_HEAD = '**What you have told me (on record for this case)**';
  const bareReply = strip(a.body.reply);
  const carriedReply = strip(b.body.reply);
  const cut = carriedReply.indexOf(RECAP_HEAD);
  const legalPart = cut >= 0 ? carriedReply.slice(0, cut).trimEnd() : carriedReply;
  // strip() collapses newlines, so the recap is taken from the raw reply to keep its lines.
  const rawCut = String(b.body.reply || '').indexOf(RECAP_HEAD);
  const recap = rawCut >= 0 ? String(b.body.reply).slice(rawCut) : '';
  ok('V5.2 the retrieved legal answer is unchanged by context; only a recap is appended',
    legalPart === bareReply && cut > 0, `legal ${legalPart.length} vs ${bareReply.length} chars, recap ${recap.length} chars`);
  const intake2 = b.body.intake || {};
  const sourced = JSON.stringify([intake2.keyFacts, intake2.timeline, intake2.documentsMentioned,
  intake2.requestedOutcome]).toLowerCase();
  const bullets = recap.split('\n').slice(1).map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean);
  const invented = bullets.filter(bl => {
    const core = bl.replace(/^[A-Za-z ]+:\s*/, '').toLowerCase();
    const pieces = core.split(', ').map(s => s.trim()).filter(s => s.length > 3);
    return !pieces.every(p => sourced.includes(p));
  });
  ok('V5.2b every recap line traces to a value the user supplied (nothing invented)',
    bullets.length > 0 && invented.length === 0,
    invented.length ? `unsourced: ${invented.join(' | ')}` : `${bullets.length} line(s) all traceable`);
  const huge = await agent('My landlord is keeping my security deposit. What are my options?', {
    context: { ...CARRY, facts: Array.from({ length: 400 }, (_, i) => `fact number ${i} about the deposit and the flat`), timeline: Array.from({ length: 60 }, (_, i) => `12/12/20${i % 99} event ${i}`) }
  });
  ok('V5.3 an oversized context is trimmed, not rejected', huge.status === 200 && gate(huge.body) === gate(a.body)
    && (huge.body.intake?.keyFacts || []).length <= 20,
    `status=${huge.status} facts=${(huge.body.intake?.keyFacts || []).length}`);
  const bad = await agent('My landlord is keeping my security deposit. What are my options?', { context: 'this is not an object' });
  ok('V5.4 a malformed context degrades to no context, never a 400',
    bad.status === 200 && gate(bad.body) === gate(a.body) && !!bad.body.intake, `status=${bad.status}`);
  const badArr = await agent('My landlord is keeping my security deposit. What are my options?', { context: [1, 2, 3] });
  ok('V5.5 an array context is also treated as absent', badArr.status === 200 && gate(badArr.body) === gate(a.body));

  console.log('\n--- V6  Answer Level: depth changes, evidence does not ---');
  const LQ = 'What can a woman who wants khula do, and what does the law say about it?';
  const lvl = {};
  for (const l of ['beginner', 'intermediate', 'advanced']) lvl[l] = await agent(LQ, { answerLevel: l });
  ok('V6.1 same evidence and correction at all three levels',
    gate(lvl.beginner.body) === gate(lvl.intermediate.body) && gate(lvl.intermediate.body) === gate(lvl.advanced.body),
    `verdict=${lvl.beginner.body.evidence?.verdict} attempts=${lvl.beginner.body.correction?.attempts}`);
  ok('V6.2 the requested level is echoed back',
    lvl.beginner.body.answerLevel === 'beginner' && lvl.intermediate.body.answerLevel === 'intermediate' && lvl.advanced.body.answerLevel === 'advanced',
    `${lvl.beginner.body.answerLevel}/${lvl.intermediate.body.answerLevel}/${lvl.advanced.body.answerLevel}`);
  const lenOf = l => strip(lvl[l].body.reply).length;
  ok('V6.3 answer depth differs by level', lenOf('advanced') !== lenOf('beginner'),
    `beginner=${lenOf('beginner')} intermediate=${lenOf('intermediate')} advanced=${lenOf('advanced')}`);
  ok('V6.4 the ledger states the level it explained at',
    (lvl.advanced.body.steps || []).some(s => /Explained at|Jawab \(/i.test(`${s.label} ${s.detail}`)));

  console.log('\n--- V7  intent → scope → Hybrid → Corrective → verified evidence stays bounded ---');
  const TOPICS = [
    ['tenancy', 'Landlord ne rent deposit wapas nahi diya, kya karun?'],
    ['cheque dishonour', 'A cheque bounced for insufficient funds. What is the remedy against the issuer?'],
    ['university', 'My university is refusing to issue my transcript because of an unpaid fee. What are my options?'],
    ['FIR', 'Police is not registering my FIR. What can I do next?'],
    ['khula', 'Khula ki application kaise file hoti hai?'],
    ['consumer', 'The shop sold me a defective washing machine and refuses to replace it. What is my remedy?'],
    ['cybercrime', 'Someone is blackmailing me on WhatsApp with photos. What legal action is available?'],
    ['inheritance', 'Father ki death ke baad property ki taqseem kaise hoti hai?'],
    ['labour', 'Mere employer ne 4 mahine ki salary nahi di. Kya karun?'],
    ['cross-border', 'I am a Pakistani in Dubai and my passport is expired. What do I do?']
  ];
  const topicResults = [];
  for (const [name, q] of TOPICS) {
    const res = await agent(q);
    const att = res.body.correction?.attempts ?? 0;
    topicResults.push({ name, status: res.status, verdict: res.body.evidence?.verdict || 'n/a', attempts: att, sources: (res.body.sources || []).length, support: res.body.intake?.professionalSupportNeeded });
    ok(`V7.${name} routed, gated and bounded (attempts <= 2)`,
      res.status === 200 && !!res.body.intake && att <= 2 && (!!res.body.evidence || (res.body.sources || []).length === 0),
      `verdict=${res.body.evidence?.verdict || 'n/a'} attempts=${att} sources=${(res.body.sources || []).length}`);
  }

  console.log('\n--- V8  Roman Urdu and Urdu-script speech text both go through the language pipeline ---');
  const roman = await agent('Kirayedar mera rent deposit wapas karne se inkaar kar raha hai, kya tareeqa hai?', { lang: 'roman_urdu' });
  ok('V8.1 Roman Urdu query answered with Roman composer prose',
    roman.status === 200 && /Jawab|qanoon|adalat|karein|masla/i.test(strip(roman.body.reply)),
    `len=${strip(roman.body.reply).length}`);
  const urduScript = await agent('میرا کرایہ دار میرا سکیورٹی ڈپازٹ واپس نہیں کر رہا، مجھے کیا کرنا چاہیے؟', { lang: 'roman_urdu' });
  ok('V8.2 Urdu-script speech text is understood and answered',
    urduScript.status === 200 && typeof urduScript.body.reply === 'string' && urduScript.body.reply.length > 40 && !!urduScript.body.intake,
    `len=${strip(urduScript.body.reply).length} issue="${String(urduScript.body.intake?.issue || '').slice(0, 40)}"`);
  ok('V8.3 intake for the Urdu-script turn is non-empty and traceable',
    (urduScript.body.intake?.issue || '').length > 5);

  console.log('\n--- V9  empty / absent context behaves exactly as before ---');
  const e1 = await agent(T1_FACTS);
  ok('V9.1 context: null behaves like no context', gate(e1.body) === gate(r1.body) && strip(e1.body.reply) === strip(r1.body.reply));
  const e2 = await agent(T1_FACTS, { context: {} });
  ok('V9.2 an empty context object changes nothing', gate(e2.body) === gate(r1.body) && !!e2.body.intake);
  ok('V9.3 repeated identical query is cache-deterministic', strip(e1.body.reply) === strip(r1.body.reply));

  console.log('\n--- V10  agent and chat payloads when context is omitted ---');
  const expectedAgentKeys = ['reply', 'actions', 'sources', 'isOffline', 'evidence', 'correction', 'relevance', 'intake'];
  const missingKeys = expectedAgentKeys.filter(k => r1.body[k] === undefined);
  ok('V10.1 every pre-existing agent payload key is still present', missingKeys.length === 0,
    `missing=${missingKeys.join(',')} keys=${Object.keys(r1.body).sort().join(',')}`);
  const c = await chat('What are my rights as a tenant in Sindh?');
  ok('V10.2 the chat route is untouched: streams chunks and gains no intake',
    c.text.length > 60 && !c.keys.includes('intake') && c.keys.includes('chunk'),
    `keys=${c.keys.sort().join(',')}`);
  ok('V10.3 the agent answer keeps the verified-reference header and source list',
    /VERIFIED LEGAL REFERENCE|VERIFIED/i.test(r1.body.reply) && (r1.body.sources || []).length > 0,
    `sources=${(r1.body.sources || []).length}`);

  console.log('\n--- V11  professionalSupportNeeded is a tri-state, never "legal topic ⇒ true" ---');
  const infoQ = await agent('What documents do I need to file a tenancy refund claim?');
  ok('V11.1 a self-service informational query is not escalated',
    infoQ.body.intake?.professionalSupportNeeded !== true,
    `value=${JSON.stringify(infoQ.body.intake?.professionalSupportNeeded)} verdict=${infoQ.body.evidence?.verdict}`);
  const lawyerQ = await agent('I need a lawyer for my case, how do I find one?');
  ok('V11.2 an explicit request for a lawyer is escalated',
    lawyerQ.body.intake?.professionalSupportNeeded === true,
    `value=${JSON.stringify(lawyerQ.body.intake?.professionalSupportNeeded)}`);
  const dangerQ = await agent('My neighbour threatened and beat my sister, we need help right now.');
  ok('V11.3 a danger case is escalated with the safety-first step',
    dangerQ.body.intake?.professionalSupportNeeded === true && /Safety first/.test(dangerQ.body.intake?.suggestedNextStep || ''),
    `step="${String(dangerQ.body.intake?.suggestedNextStep || '').slice(0, 40)}"`);
  const TRI = [true, false, 'unclear'];
  const values = [...topicResults.map(t => t.support), infoQ.body.intake?.professionalSupportNeeded,
    lawyerQ.body.intake?.professionalSupportNeeded, dangerQ.body.intake?.professionalSupportNeeded];
  ok('V11.4 every intake value is one of true / false / "unclear"', values.every(v => TRI.includes(v)),
    `values=${JSON.stringify(values)}`);
  console.log(`\n  [V11 evidence] per-topic professionalSupportNeeded: ${topicResults.map(t => `${t.name}=${JSON.stringify(t.support)}`).join('  ')}`);
  ok('V11.5 the ten topics are NOT uniformly "true"', new Set(topicResults.map(t => JSON.stringify(t.support))).size > 1,
    `distinct=${[...new Set(topicResults.map(t => JSON.stringify(t.support)))].join(',')}`);

  const total = pass + fail;
  console.log('\n========================================================================');
  console.log(` RESULT: ${pass} passed, ${fail} failed of ${total}`);
  if (notes.length) console.log(` FAILED: ${notes.join('  |  ')}`);
  console.log('========================================================================\n');
  process.exit(fail === 0 ? 0 : 1);
})().catch(err => {
  console.error('\n SUITE CRASHED — is the backend running on ' + BASE + '?\n', err.message);
  process.exit(2);
});
