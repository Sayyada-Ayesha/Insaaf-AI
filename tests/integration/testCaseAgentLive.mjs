/**
 * §13 Case-Agent live regression (sprint §4 root cause).
 *
 * Proves against a running backend that the collected intake actually reaches the
 * analysis: the same case, sent once as a bare one-line question and once with the
 * intake, must produce different server-side intake and a shorter missing-fact list.
 * Before the fix both calls were identical, because the frontend sent `null`.
 *
 * Uses node:http (not fetch) with a closed agent so the event loop drains and the
 * real exit code is reported; fetch + process.exit crashes on a pending libuv handle.
 *
 * Run: INSAAF_BASE=http://localhost:3005 node tests/integration/testCaseAgentLive.mjs
 */
import http from 'node:http';

const BASE = process.env.INSAAF_BASE || 'http://localhost:3005';
const u = new URL(BASE);

let passed = 0;
const failures = [];
function ok(label, condition, detail = '') {
  if (condition) { passed++; console.log(`PASS ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ''}`); console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

function agent(body) {
  return new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({ ...body, answerLevel: 'intermediate' }), 'utf8');
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: '/api/ai/agent', method: 'POST', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length, Connection: 'close' },
      timeout: 120000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* non-JSON body */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', () => resolve({ status: 0, json: null }));
    req.end(payload);
  });
}

const INTAKE_QUERY = 'Legal problem from a structured case intake: fee refund after forced withdrawal. I was withdrawn in 12 March 2026 and the hostel fee was not returned'
  + '. Parties: Syed Ali Raza and GCU Hyderabad. When: 12 March 2026. Where: Hyderabad. Forum: Sindh Consumer Court.'
  + ' Against/institution: Government College University Hyderabad. Documents: withdrawal application, fee challan, email reply.'
  + ' Deadline: 30 April 2026. Seeking: refund of Rs. 85,000 hostel fee';

const CONTEXT = {
  issue: 'fee refund after forced withdrawal',
  location: 'Hyderabad',
  jurisdiction: 'Sindh Consumer Court',
  institution: 'Government College University Hyderabad',
  requestedOutcome: 'refund of Rs. 85,000 hostel fee',
  facts: ['Parties: Syed Ali Raza and GCU Hyderabad', 'Witnesses: room mate Bilal Ahmed',
    'Already done: submitted a written request to the vice chancellor office'],
  timeline: ['filed application 12 March 2026, reply due 30 April 2026'],
  deadlines: ['30 April 2026 (stated urgency: high)'],
  documents: ['withdrawal application', 'fee challan', 'email reply']
};

const BARE = 'fee refund after forced withdrawal';

const bare = await agent({ message: BARE });
ok('L0.1 bare question reaches the agent endpoint (HTTP 200, not a 429/500)',
  bare.status === 200, `status=${bare.status} body=${JSON.stringify(bare.json).slice(0, 160)}`);
if (bare.status !== 200) {
  console.log(`\nBackend is not serving /api/ai/agent on ${BASE}. Live gate cannot run.`);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exitCode = 1;
} else {
  const withIntake = await agent({ message: INTAKE_QUERY, context: CONTEXT });
  ok('L0.2 intake call reaches the endpoint (HTTP 200)', withIntake.status === 200, `status=${withIntake.status}`);
  if (withIntake.status !== 200) process.exitCode = 1;
  else {
    const bi = bare.json.intake;
    const ii = withIntake.json.intake;
    ok('L1.1 the endpoint returns a structured intake on both paths', !!bi && !!ii);
    ok('L2.1 the city collected in intake reaches the server',
      (ii.location || '').toLowerCase() === 'hyderabad', `got ${ii.location}`);
    ok('L2.2 the institution collected in intake reaches the server',
      /Government College University Hyderabad/i.test(ii.institution || ''), `got ${ii.institution}`);
    ok('L2.3 the sought outcome collected in intake reaches the server',
      /85,000/.test(ii.requestedOutcome || ''), `got ${ii.requestedOutcome}`);
    ok('L2.4 the documents collected in intake are reported as mentioned',
      (ii.documentsMentioned || []).length > 0, `got ${JSON.stringify(ii.documentsMentioned)}`);
    ok('L2.5 a date from the intake lands in the timeline',
      (ii.timeline || []).some(t => /2026/.test(t)), `got ${JSON.stringify(ii.timeline)}`);

    // The point of the fix: the two calls must not be indistinguishable.
    const bareMiss = (bi.missingMandatoryFacts || []).length;
    const intakeMiss = (ii.missingMandatoryFacts || []).length;
    ok('L3.1 intake shrinks the server’s missing-fact list instead of repeating it',
      intakeMiss < bareMiss, `bare=${bareMiss} intake=${intakeMiss} :: ${(ii.missingMandatoryFacts || []).join(' | ')}`);
    ok('L3.2 the bare call has no city while the intake call carries the one supplied',
      !bi.location && Boolean(ii.location), `bare=${JSON.stringify(bi.location)} intake=${JSON.stringify(ii.location)}`);
    ok('L3.3 the intake call is not re-asked for any slot the intake answered',
      !(ii.missingMandatoryFacts || []).some(m => /city|district|document|outcome|date|university|college|institution/i.test(m)),
      `missing=${JSON.stringify(ii.missingMandatoryFacts)}`);

    ok('L4.1 the intake reply is a real answer, not an error string',
      typeof withIntake.json.reply === 'string' && withIntake.json.reply.length > 80, `len=${(withIntake.json.reply || '').length}`);
    ok('L4.2 the answer names the jurisdiction layer the intake gave',
      /hyderabad|sindh/i.test(withIntake.json.reply), (withIntake.json.reply || '').slice(0, 120));
    ok('L4.3 evidence is reported honestly (sources array present even when empty)',
      Array.isArray(withIntake.json.sources), typeof withIntake.json.sources);
    ok('L4.4 no outcome is predicted in the reply',
      !/\b(you will win|guaranteed to win|sure win)\b/i.test(withIntake.json.reply || ''));

    // An unknown/garbage context must degrade to "no context", never break the answer.
    const bad = await agent({ message: BARE, context: { facts: 'not-an-array', issue: 1 } });
    ok('L5.1 a malformed context still returns HTTP 200 with an answer',
      bad.status === 200 && typeof bad.json.reply === 'string' && bad.json.reply.length > 40, `status=${bad.status}`);
  }
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(`FAILURES:\n  ${failures.join('\n  ')}`); process.exitCode = 1; }
