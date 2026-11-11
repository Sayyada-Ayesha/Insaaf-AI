// ANSWER-SURFACE HONESTY REGRESSION SUITE (§1/§5/§6 root causes).
//
// Three claims an answer must never make unless the evidence supports them:
//   1. a provision number — printable only when the user wrote it or a cited
//      record states it (server/answerGrounding.js);
//   2. a place — a provincial, city or university rule is attributed to its
//      layer conditionally when the question did not name that place
//      (server/corpusScope.js scopeLabel);
//   3. an issuer — a record whose registered authority is this product's own
//      placeholder publishes no authority at all (corpusMetadata.js).
//
// Pure unit suite: no server, no corpus rebuild.
// Usage: node server/testAnswerGrounding.js
import { groundAnswerCitations, answerCitations } from './answerGrounding.js';
import { scopeLabel, detectQueryScope } from './corpusScope.js';
import { isSelfReferentialAuthority, documentMetadata } from './corpusMetadata.js';
import { recordAuthority } from './ownedModel.js';

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`    PASS  ${name}`); }
  else {
    fail++;
    failures.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`    FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
  return !!cond;
}
const section = label => console.log(`\n== ${label} ==`);

const rec = (o = {}) => ({
  text: '', chunkTitle: '', title: '', key: '', docId: '', ...o,
});

// ---------------------------------------------------------------------------
// 1. Citation grounding
// ---------------------------------------------------------------------------
section('1. Provision numbers are printed only when a record or the user states them');

const crpc154 = rec({
  text: 'Under Section 154 CrPC the officer in charge of a police station must record the information in writing.',
  chunkTitle: 'Section 154 CrPC — FIR', title: 'Code of Criminal Procedure, 1898', key: 'CRPC_SECTION_154',
});
const bail22A = rec({
  text: 'Section 22-A grants the High Court bail powers and Section 22-B the Sessions Court powers.',
  chunkTitle: 'Sections 22-A/22-B CrPC — bail', title: 'Code of Criminal Procedure, 1898', key: 'CRPC_SECTION_22-A',
});
const bounce = rec({
  text: 'Section 489-F of the Pakistan Penal Code punishes dishonoured cheques.',
  chunkTitle: 'Dishonoured cheque', title: 'Pakistan Penal Code 1860', key: 'PPC_SECTION_489-F',
});
const theft379 = rec({
  text: 'Section 379 PPC prescribes the punishment for theft.',
  chunkTitle: 'Theft', title: 'Pakistan Penal Code 1860', key: 'PPC_SECTION_379',
});
const consumer = rec({
  text: 'A consumer whose goods are defective may complain to the Consumer Court under the Protection of Rights Act.',
  chunkTitle: 'Consumer complaint', title: 'Punjab Consumer Protection Act, 2009', key: 'CIVIC_CONSUMER',
});

function ground(text, records, q = '') {
  return groundAnswerCitations(text, records, q).text;
}

{
  const out = ground('Approach the police station. Under Section 154 CrPC they must record your statement.', [crpc154]);
  ok(out.includes('Section 154 CrPC'), 'grounded Section 154 survives', JSON.stringify(out));
}
{
  const out = ground('Your complaint is a consumer matter. Under Section 154 CrPC the police must record it.', [consumer]);
  ok(!/154/.test(out), 'Section 154 removed when no cited record states it', JSON.stringify(out));
  ok(out.includes('consumer matter'), 'the plain-language sentence is untouched', JSON.stringify(out));
  ok(!/\bunder\s*[.,]/i.test(out), 'the preposition that carried it goes too', JSON.stringify(out));
}
{
  const out = ground('Bail can be sought under Sections 22-A/22-B CrPC.', [bail22A]);
  ok(out.includes('22-A/22-B'), 'a range survives when both halves are stated', JSON.stringify(out));
}
{
  const out = ground('Bail can be sought under Sections 22-A/22-B CrPC.', [crpc154]);
  ok(!/22-A/.test(out), 'a range falls when one half is unstated', JSON.stringify(out));
}
{
  const out = ground('This is punishable under Section 489F.', [bounce]);
  ok(out.includes('Section 489F'), '489F matches a record written 489-F', JSON.stringify(out));
}
{
  const out = ground('Theft is punishable under Section 379 PPC.', [consumer]);
  ok(!/379/.test(out), 'Section 379 removed from a consumer-recorded answer', JSON.stringify(out));
}
{
  const out = ground('Section 306 PPC deals with abetment.', [consumer], 'What is the punishment under Section 306 PPC?');
  ok(out.includes('Section 306 PPC'), 'a number the user wrote is always kept', JSON.stringify(out));
}
{
  const out = ground('Yeh haq Article 10A ke tehat aap ko milta hai.', [crpc154]);
  ok(!/Article 10A/.test(out) && /milta hai/.test(out), 'Roman "ke tehat" citation is removed with its carrier', JSON.stringify(out));
}
{
  const out = ground('CrPC ki Section 154 ke mutabiq registration lazmi hai.', [crpc154]);
  ok(out.includes('Section 154'), 'Roman statute-before-number order is recognised', JSON.stringify(out));
}
{
  const out = ground('آپ کے خلاف دفعہ 379 کے تحت مقدمہ بن سکتا ہے۔', [theft379]);
  ok(out.includes('دفعہ 379'), 'Urdu script citation kept when the record states 379', JSON.stringify(out));
}
{
  const out = ground('آپ کے خلاف دفعہ 420 کے تحت مقدمہ بن سکتا ہے۔', [bounce]);
  ok(!/420/.test(out), 'Urdu script citation removed when unstated', JSON.stringify(out));
  ok(!/کے تحت/.test(out), 'the Urdu carrier phrase goes with the citation it carried', JSON.stringify(out));
  ok(/مقدمہ بن سکتا ہے/.test(out), 'the Urdu sentence still reads as a sentence', JSON.stringify(out));
}
{
  const out = ground('Approach the court or write to the SP.', [crpc154]);
  ok(out === 'Approach the court or write to the SP.', 'prose with no citation passes through unchanged');
}
{
  const out = ground('Under the Constitution of Pakistan, Article 19 guarantees freedom of speech.', []);
  ok(!/Article 19/.test(out), 'an unstated Article 19 is not printed', JSON.stringify(out));
}
{
  const out = ground('- Section 154 CrPC: FIR must be recorded\n- Some other point', [crpc154]);
  ok(out.includes('Section 154 CrPC'), 'a citation in a bullet keeps its line', JSON.stringify(out));
}
{
  const { removed } = groundAnswerCitations('Under Sections 22-A/22-B CrPC bail lies.', [crpc154]);
  ok(removed.length === 1 && /22-A/.test(removed[0]), 'the dropped phrase is reported for auditing', JSON.stringify(removed));
}
{
  const t = 'Under Section 154 CrPC and Section 999 CrPC.';
  ok(answerCitations(t).length >= 2, 'answerCitations surfaces every citation for regression checks',
    JSON.stringify(answerCitations(t)));
}

// ---------------------------------------------------------------------------
// 2. Jurisdiction is never asserted as the user's own place
// ---------------------------------------------------------------------------
section('2. A rule from one layer is attributed conditionally when the place was not stated');

const punjab = { scopeLevel: 'provincial', province: 'Punjab', city: null, institutions: [] };
const karachi = { scopeLevel: 'local_city', province: 'Sindh', city: 'Karachi', institutions: [] };
const gcu = { scopeLevel: 'university', province: 'Sindh', city: 'Hyderabad', institutions: ['GC University Hyderabad'] };
const national = { scopeLevel: 'national', province: null, city: null, institutions: [] };
const nowhere = detectQueryScope('Makan malik kiraye dar ko nikalna chahta hai');

{
  const out = scopeLabel(punjab, 'roman_urdu', nowhere);
  ok(/^Agar mamla Punjab mein hai to/i.test(out), 'province-free Roman ask gets a conditional attribution', out);
}
{
  const out = scopeLabel(punjab, 'roman_urdu', detectQueryScope('Punjab mein kiraye ka qanoon kya hai'));
  ok(/Punjab law ke under/i.test(out), 'a stated province keeps the direct attribution', out);
}
{
  const out = scopeLabel(punjab, 'en', detectQueryScope('rent law in Sindh'));
  ok(!/^Under Punjab law/i.test(out) && /Punjab/.test(out),
    'another province\'s rule is never stated as the user\'s own law', out);
}
{
  const out = scopeLabel(karachi, 'en', nowhere);
  ok(/If this is in/i.test(out), 'city practice is conditional without a stated city', out);
}
{
  const out = scopeLabel(gcu, 'roman_urdu', nowhere);
  ok(/^Agar aap/i.test(out), 'a university rule is not asserted for every student', out);
}
{
  const out = scopeLabel(gcu, 'roman_urdu', detectQueryScope('GC University Hyderabad ka rule'));
  ok(!/^Agar/i.test(out), 'the named institution keeps the direct wording', out);
}
{
  const out = scopeLabel(gcu, 'roman_urdu', detectQueryScope('Hyderabad university mein ragging ka masla'));
  ok(/^Agar aap/i.test(out), 'a city alone is not attributed to one university in it', out);
}
{
  ok(scopeLabel(national, 'en', nowhere) === scopeLabel(national, 'en', null),
    'a national rule is worded the same whatever the question asked', scopeLabel(national, 'en', nowhere));
}
{
  ok(scopeLabel(null, 'en', nowhere) === null, 'no scope means no attribution line');
}

// ---------------------------------------------------------------------------
// 3. No card names this product as the body that issued a record
// ---------------------------------------------------------------------------
section('3. A self-referential authority is not published as an issuer');

{
  ok(isSelfReferentialAuthority('Insaaf AI Verified Systems'), 'the internal placeholder is recognised');
  ok(isSelfReferentialAuthority('INSAaf AI'), 'product-name-only authority is recognised');
  ok(!isSelfReferentialAuthority('NADRA'), 'a real agency is not flagged');
  ok(!isSelfReferentialAuthority('Sindh Higher Education Commission'), 'a real commission is not flagged');
  ok(!isSelfReferentialAuthority(''), 'an empty authority is not flagged as self-referential');
}
{
  const meta = documentMetadata('legal_workflows');
  ok(meta && meta.authority === null, 'the registry drops the placeholder issuer', JSON.stringify(meta));
}
{
  const chunk = rec({
    docId: 'legal_workflows', issuingAuthority: 'Insaaf AI Verified Systems',
    title: 'Comprehensive Legal Workflows & Procedures', chunkTitle: 'FIR', key: 'PROC_FIR',
    text: 'How to get an FIR recorded.',
  });
  ok(recordAuthority(chunk) === '', 'a chunk carrying the placeholder field prints no authority',
    JSON.stringify(recordAuthority(chunk)));
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailed:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(fail ? 1 : 0);
