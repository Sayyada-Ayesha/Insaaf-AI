// CIVIC ISSUES ASSISTANT — runtime suite.
//
// Exercises /api/civic/assist end-to-end on a spawned backend. The point is not
// that the endpoint returns 200: every scenario must name a responsible
// authority, give an honest verification level, use only recorded procedures, and
// never claim that anything was submitted. A separate row guards the legal chat
// surface against answering a domicile question from voter-enrolment records.
//
// Usage: node server/testCivicAssistant.js      (spawns its own backend on TEST_PORT)
import { spawn } from 'node:child_process';

const PORT = Number(process.env.TEST_PORT || 4262);
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`    PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`    FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
  return !!cond;
}
const section = (label) => console.log(`\n== ${label} ==`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URDU_RE = /[؀-ۿ]/;

async function postJSON(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch (e) { json = { parseError: String(e) }; }
  return { status: res.status, json };
}

async function assist(body) {
  const out = await postJSON('/api/civic/assist', body);
  return { ...out, r: out.json };
}

// What every analysed result must satisfy, regardless of service.
function assertAnalysedHonesty(r, name) {
  ok(r.status === 'analysed', `${name}: analysed`, `status=${r.status}`);
  ok(typeof r.service?.label === 'string' && r.service.label.length > 0, `${name}: named service`);
  ok(typeof r.authority?.name === 'string' && r.authority.name.length > 0, `${name}: responsible authority named`);
  ok(typeof r.authority?.why === 'string' && r.authority.why.length > 0, `${name}: explains why that authority`);
  ok(r.route === null || (typeof r.route.label === 'string' && typeof r.route.note === 'string'),
    `${name}: route label/note are localized strings`, JSON.stringify(r.route).slice(0, 160));
  ok(Array.isArray(r.steps) && r.steps.length > 0, `${name}: gives steps`);
  ok(Array.isArray(r.documents), `${name}: gives a documents list`);
  ok(r.analysis?.method === 'deterministic-keyword', `${name}: labels the method honestly`, r.analysis?.method);
  ok(['official', 'metadata', 'mixed', 'general', 'legal-route'].includes(r.analysis?.procedureVerification),
    `${name}: gives a verification level`, r.analysis?.procedureVerification);
  const draft = String(r.draft?.text || '');
  const auth = String(r.authority?.name || '');
  ok(draft.length > 0, `${name}: produces an editable draft`);
  ok(/\[[a-z]+\]/i.test(draft), `${name}: draft keeps placeholders instead of inventing facts`);
  ok(!/\b(19|20)\d{2}\b/.test(draft), `${name}: draft invents no date`, draft.slice(0, 200));
  ok(auth.length > 0 && draft.includes(auth), `${name}: draft addresses the analysed authority`);
  ok(r.submission?.state === 'not_submitted', `${name}: submission state is not_submitted`, r.submission?.state);
  ok(/nothing (has been|was) submitted|not (been )?submitted|submit nahi|جمع نہیں/i.test(r.disclosure), `${name}: disclosure says nothing was submitted`);
  ok(!/submitted successfully|application (has been|was) submitted|sent to (the )?(department|office)/i.test(draft + ' ' + r.disclosure),
    `${name}: makes no false submission claim`);
}

console.log(`[civic] Starting backend on port ${PORT} …`);
const child = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'pipe']
});
let bootErr = '';
child.stderr.on('data', (d) => { bootErr += String(d); });

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
    console.error('[civic] Backend did not come up:\n' + bootErr.slice(0, 2000));
    process.exit(1);
  }

  // ---------------------------------------------------------------------
  section('C1 — Domicile in Hyderabad, Sindh');
  {
    const { status, r } = await assist({
      description: 'Mujhe Hyderabad Sindh mein domicile certificate banwana hai. Kahan apply karna hoga?',
      language: 'roman_urdu', city: 'Hyderabad', province: 'Sindh'
    });
    ok(status === 200, 'C1: HTTP 200');
    ok(r.service?.id === 'domicile', 'C1: routes to domicile', r.service?.id);
    ok(/Deputy Commissioner/i.test(r.authority?.name || ''), 'C1: names the Deputy Commissioner office', r.authority?.name);
    ok(r.route?.url === 'https://sindh.gov.pk/', 'C1: Sindh portal link used', r.route?.url);
    ok(r.route?.urlVerified === true, 'C1: link is marked verified');
    ok(/not a domicile application page|application page nahi/i.test(r.route?.note || ''), 'C1: says the portal is not the application page', r.route?.note);
    assertAnalysedHonesty(r, 'C1');
  }

  // ---------------------------------------------------------------------
  section('C2 — Birth certificate');
  {
    const { r } = await assist({
      description: 'My child was born in Lahore and I need a birth certificate and B-Form.',
      language: 'en', city: 'Lahore', province: 'Punjab'
    });
    ok(r.service?.id === 'birth_registration', 'C2: routes to birth registration', r.service?.id);
    ok(/Union Council/i.test(r.authority?.name || ''), 'C2: names the union council', r.authority?.name);
    ok(/NADRA/i.test(r.authority?.name || ''), 'C2: names NADRA for the CRC/B-Form');
    ok(/nadra\.gov\.pk/.test(r.route?.url || ''), 'C2: uses the NADRA CRC page', r.route?.url);
    assertAnalysedHonesty(r, 'C2');
  }

  // ---------------------------------------------------------------------
  section('C3 — CNIC correction');
  {
    const { r } = await assist({
      description: 'I want a CNIC correction because my date of birth is printed wrongly.',
      language: 'en'
    });
    ok(r.service?.id === 'cnic_correction', 'C3: routes to CNIC correction', r.service?.id);
    ok(r.analysis?.procedureVerification === 'official', 'C3: marked as official-page grounded', r.analysis?.procedureVerification);
    ok(/nadra\.gov\.pk/.test(r.route?.url || ''), 'C3: uses the NADRA CNIC page', r.route?.url);
    ok(!/voter|election|vote/i.test(JSON.stringify(r.sources) + r.authority?.name), 'C3: no voter-enrolment source used');
    assertAnalysedHonesty(r, 'C3');
  }

  // ---------------------------------------------------------------------
  section('C4 — Public office complaint');
  {
    const { r } = await assist({
      description: 'The BISP 8171 office is not processing my application even though I submitted all papers last month.',
      language: 'roman_urdu'
    });
    ok(r.service?.id === 'public_office_complaint', 'C4: routes to public-office complaint', r.service?.id);
    ok(/Mohtasib/i.test(r.authority?.name || ''), 'C4: names the Mohtasib route', r.authority?.name);
    ok(r.clarifyQuestion === null, 'C4: does not ask for the department when one is named', r.clarifyQuestion);
    ok(/mohtasib\.gov\.pk/.test(r.route?.url || ''), 'C4: uses the Mohtasib site', r.route?.url);
    assertAnalysedHonesty(r, 'C4');
  }

  // ---------------------------------------------------------------------
  section('C5 — Municipal / service complaint');
  {
    const { r } = await assist({
      description: 'The streetlight in front of my house in Gulberg, Lahore has been broken for two months.',
      language: 'en', city: 'Lahore', province: 'Punjab'
    });
    ok(r.service?.id === 'municipal_complaint', 'C5: routes to municipal complaint', r.service?.id);
    ok(r.analysis?.procedureVerification === 'general', 'C5: does not pretend to a verified departmental procedure', r.analysis?.procedureVerification);
    ok(/local body|municipal|union council/i.test(r.route?.note || ''), 'C5: explains the Citizen Portal is additional, not a replacement', r.route?.note);
    ok(!/NADRA|FIA|Ombudsman|Mohtasib/i.test(r.authority?.name || ''), 'C5: not sent to an unrelated agency', r.authority?.name);
    assertAnalysedHonesty(r, 'C5');
  }

  // ---------------------------------------------------------------------
  section('C6 — Ambiguous request asks one focused question');
  {
    const { r } = await assist({ description: 'I need a domicile certificate.', language: 'en' });
    ok(r.status === 'clarify', 'C6: asks for the missing district', r.status);
    ok(typeof r.clarifyQuestion === 'string' && /district/i.test(r.clarifyQuestion), 'C6: the question asks for district/city', r.clarifyQuestion);
    ok(r.draft === null, 'C6: no draft is invented before the missing fact');
    ok(r.submission?.state === 'not_submitted', 'C6: nothing is marked submitted');

    const vague = await assist({ description: 'I have a problem with my papers.', language: 'en' });
    ok(vague.r.status === 'unsupported' || vague.r.status === 'clarify', 'C6b: vague text is not force-matched', vague.r.status);
    ok(vague.r.draft === null, 'C6b: no draft invented for an unmatched problem');
  }

  // ---------------------------------------------------------------------
  section('C7 — No recorded procedure → honest unsupported');
  {
    const { r } = await assist({
      description: 'The bakery near my house plays loud music every night and the owner ignores me.',
      language: 'en'
    });
    ok(r.status === 'unsupported', 'C7: unmatched problem is unsupported, not force-placed', r.status);
    ok(r.service === null, 'C7: no invented service');
    ok(r.route === null && r.draft === null, 'C7: no invented route or draft');
    ok(/which service|kis service|could not be matched|no recorded|کون سی خدمت/i.test(r.clarifyQuestion + ' ' + r.disclosure),
      'C7: states honestly that no procedure matched', r.clarifyQuestion);
  }

  // ---------------------------------------------------------------------
  section('C8 — Three languages produce the selected language');
  {
    const q = 'I need a domicile certificate in Hyderabad, Sindh.';
    const en = (await assist({ description: q, language: 'en', province: 'Sindh' })).r;
    const rom = (await assist({
      description: 'Mujhe Hyderabad Sindh mein domicile certificate chahiye.',
      language: 'roman_urdu', province: 'Sindh'
    })).r;
    const ur = (await assist({
      description: 'مجھے حیدرآباد سندھ میں ڈومیسائل سرٹیفکیٹ چاہیے۔',
      language: 'ur', province: 'Sindh'
    })).r;

    ok(!URDU_RE.test(en.draft.text), 'C8: English draft has no Urdu script');
    ok(/Guzaarish hai ke|Bara-e-karam/.test(rom.draft.text), 'C8: Roman Urdu draft uses Roman headings', rom.draft.text.slice(0, 80));
    ok(URDU_RE.test(ur.draft.text), 'C8: Urdu draft is in Urdu script');
    ok(/جمع نہیں/.test(ur.disclosure), 'C8: Urdu disclosure says nothing was submitted');
    ok(/Abhi kuch bhi submit nahi hua/.test(rom.disclosure), 'C8: Roman Urdu disclosure says nothing was submitted');
  }

  // ---------------------------------------------------------------------
  section('C9 — Legal chat does not answer a domicile question from voter records');
  {
    const res = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuery: 'How do I get a domicile certificate in Hyderabad, Sindh?', preferredLanguage: 'en' })
    });
    const raw = await res.text();
    let answer = '';
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') break;
      try {
        const j = JSON.parse(payload);
        if (typeof j.chunk === 'string') answer += j.chunk;
      } catch { /* non-JSON frame */ }
    }
    ok(res.status === 200, 'C9: chat answered without error', String(res.status));
    ok(!/voter|vote enrolment|election commission/i.test(answer), 'C9: no voter-enrolment answer for domicile', answer.slice(0, 200));
    ok(/domicile|Deputy Commissioner|DC office/i.test(answer) || /not available|nahi/i.test(answer),
      'C9: answer stays on the domicile subject or declines honestly', answer.slice(0, 200));
  }

  console.log(`\n[civic] ${pass} passed, ${fail} failed`);
  if (failures.length) { console.log('Failures:'); for (const f of failures) console.log(' - ' + f); }
  process.exitCode = fail ? 1 : 0;
} finally {
  child.kill();
  await sleep(300);
}
