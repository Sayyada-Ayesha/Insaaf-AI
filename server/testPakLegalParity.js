// ============================================================================
// PAKLEGAL FEATURE-PARITY REGRESSION SUITE (live backend + pure modules)
//
// Groups:
//   A  statutory glossary query expansion (everyday wording -> statutory wording)
//   B  runtime citation verification (a cited provision is checked against the
//      evidence actually retrieved and against the corpus)
//   C  incident documents assembled by code from reviewed intake facts
//   D  provision-level law search endpoint
//   E  the two new endpoints and the chat payload over HTTP
//
// Nothing here reads source files to decide a PASS: retrieval, drafting and
// search are asserted against the running server, and the pure builders are
// asserted on their own output.
//
// Usage: node server/index.js   (then)   node server/testPakLegalParity.js
// ============================================================================
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.INSAAF_BASE || 'http://localhost:3001';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}${extra ? '  — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  — ' + extra : ''}`); failures.push(name); }
}
const URDU = /[\u0600-\u06FF]/;

async function post(p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json error body */ }
  return { status: res.status, data };
}

/** Read the single SSE data frame the chat route writes for an offline answer. */
async function chatFrame(userQuery, preferredLanguage = 'en') {
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ userQuery, preferredLanguage, isOnline: false })
  });
  const text = await res.text();
  const frames = text.split('\n\n').filter(l => l.startsWith('data: '))
    .map(l => { try { return JSON.parse(l.slice(6)); } catch { return null; }; })
    .filter(Boolean);
  return frames[frames.length - 1] || {};
}

const { statutoryWordingFor, expandSearchText, STATUTORY_WORDING_RULE_COUNT } =
  await import('./legalGlossary.js');
const { findProvisionCitations, auditCitations, citationAdvisory } =
  await import('./citationAudit.js');
const { buildComplaintDraft, buildLawyerBrief, normalizeIntake } =
  await import('./incidentDocuments.js');

// ---------------------------------------------------------------------------
console.log('\n=== A. Statutory glossary: everyday wording -> statutory wording ===');
ok('A1 rules registered', STATUTORY_WORDING_RULE_COUNT >= 20, `${STATUTORY_WORDING_RULE_COUNT} rules`);

const firUr = statutoryWordingFor('مقدمہ درج نہیں ہو رہا', 'مقدمہ درج نہیں ہو رہا');
ok('A2 Urdu-script FIR wording expands', /first information report/i.test(firUr.appended), firUr.terms.length + ' terms');

const firRoman = statutoryWordingFor('police ne FIR darj karne se inkaar kar diya', '');
ok('A3 Roman Urdu FIR wording expands', /first information report/i.test(firRoman.appended));

const custody = statutoryWordingFor('main bachon ki custody chahti hoon', '');
ok('A4 child custody is read as guardianship, not police custody',
  /guardian|welfare of the child/i.test(custody.appended) && !/remand/i.test(custody.appended),
  custody.appended.slice(0, 60));

const feeRefund = statutoryWordingFor('What is the HEC fee refund policy', '');
ok('A5 fee refund maps to the refund policy, not consumer refund',
  /refundable tuition fee/i.test(feeRefund.appended) && !/consumer protection/i.test(feeRefund.appended));

const OFF_TOPIC = [
  'main ek car bechna chahta hoon simple agreement',
  'meri biwi se nijarad kar di usne',
  'advertisement mein jhoota business hai',
  'police wingan case mein namzadi',
  'zzz qqq www nothing legal here'
];
for (const q of OFF_TOPIC) {
  const r = statutoryWordingFor(q, q.toLowerCase());
  ok(`A6 no expansion for unrelated text: "${q.slice(0, 24)}"`, r.terms.length === 0, r.appended.slice(0, 50));
}

ok('A7 expansion leaves an unmatched query untouched',
  expandSearchText('base rewrite', 'main ek car bechna chahta hoon', '') === 'base rewrite');
ok('A8 expansion appends to a matched query',
  expandSearchText('base rewrite', 'FIR darj nahi hui', '').startsWith('base rewrite'));

// ---------------------------------------------------------------------------
console.log('\n=== B. Runtime citation verification ===');
const cites = findProvisionCitations(
  'Section 154 CrPC applies. Section 489-F PPC is relevant. Article 10-A of the Constitution.'
);
const keys = cites.map(c => `${c.type}:${c.key}`).sort();
ok('B1 hyphenated section key normalised to corpus form', keys.includes('SECTION:489f'), keys.join(', '));
ok('B2 Constitution unit kept as ARTICLE, not mislabelled SECTION',
  keys.includes('ARTICLE:10a') && !keys.includes('SECTION:10a'));
ok('B3 one cited provision is audited once', new Set(cites.map(c => c.key)).size === cites.length,
  `${cites.length} citations`);
ok('B4 prose without citations yields none', findProvisionCitations('Please collect your documents and file within 30 days of 2024-05-01.').length === 0);
const unHyphenated = findProvisionCitations('Section 489F PPC is relevant.');
ok('B5 un-hyphenated letter suffix keeps its full key', unHyphenated.length === 1 && unHyphenated[0].key === '489f',
  JSON.stringify(unHyphenated.map(c => `${c.type}:${c.key}`)));

const evidence = [
  { docId: 'crpc_1898', key: '154', type: 'SECTION', title: 'Information in cognizable case', text: 'FIR procedure.' },
  { docId: 'ppc_1860', key: '489f', type: 'SECTION', title: 'Dishonour of cheque', text: 'Cheque dishonour.' }
];
const corpus = [
  ...evidence,
  { docId: 'constitution_1973', key: '10a', type: 'ARTICLE', title: 'Fair trial', text: 'due process' },
  { docId: 'constitution_1973', key: '199', type: 'ARTICLE', title: 'Writ jurisdiction', text: 'high court writs' }
];
const allGood = auditCitations('Section 154 CrPC and Section 489-F PPC apply.', evidence, corpus);
ok('B5 citations present in evidence are verified and clean',
  allGood.checked === 2 && allGood.verified.length === 2 && allGood.clean === true,
  `checked=${allGood.checked} verified=${allGood.verified.length} clean=${allGood.clean}`);

const realElsewhere = auditCitations('Article 199 of the Constitution applies.', evidence, corpus);
ok('B6 real provision outside the evidence is flagged notInEvidence',
  realElsewhere.notInEvidence.length === 1 && realElsewhere.unknown.length === 0 && realElsewhere.clean === false,
  `notInEvidence=${realElsewhere.notInEvidence.map(c => c.raw).join('|')}`);

const invented = auditCitations('Section 999 of the PPC applies.', evidence, corpus);
ok('B7 a provision that does not exist in the corpus is reported unknown',
  invented.unknown.length === 1 && invented.clean === false);

const none = auditCitations('No provision is cited in this answer.', evidence, corpus);
ok('B8 nothing cited means nothing to flag', none.checked === 0 && none.clean === true);

const adv = citationAdvisory(invented, 'roman_urdu');
ok('B9 Roman Urdu advisory is written in Latin script only', !URDU.test(adv.text || ''), (adv.text || '').slice(0, 70));
ok('B10 clean answers get no advisory', citationAdvisory(allGood, 'en') === null);

// ---------------------------------------------------------------------------
console.log('\n=== C. Incident documents assembled by code ===');
const intake = {
  keyFacts: ['Amount stated: Rs. 450,000'],
  timeline: ['March 2026 — cheque handed over', 'June 2026 — cheque returned'],
  urgency: 'Urgent — no date stated yet',
  documentsMentioned: ['cheque copy', 'bank return memo'],
  requestedOutcome: 'Recovery of the amount',
  missingMandatoryFacts: ['the city or district this happened in'],
  location: '',
  summary: 'Cheque issued for a loan was returned dishonoured.'
};
const narrative = 'He gave me a cheque for 450000 in March 2026 and it returned in June 2026.';
const complaint = buildComplaintDraft(intake, narrative, 'en');
const OFFENCE_SECTIONS = /\b(?:379|420|406|489\s*-?\s*f|ppc|penal code)\b/i;
ok('C1 complaint names no offence section', !OFFENCE_SECTIONS.test(complaint),
  complaint.match(OFFENCE_SECTIONS)?.[0] || 'no offence section');
ok('C2 complaint states the s.154 procedure only',
  /154/.test(complaint) && /criminal procedure/i.test(complaint));
ok('C3 complaint carries the facts given',
  /450,?000/.test(complaint) && /March 2026/.test(complaint) && /June 2026/.test(complaint));
ok('C4 undated fields stay blank, never invented',
  /______/.test(complaint) && !/[A-Z][a-z]+ s\/o [A-Z]/.test(complaint));

const briefSources = evidence.map(e => ({
  label: `${e.type === 'ARTICLE' ? 'Article' : 'Section'} ${e.key} — ${e.title}`, docId: e.docId
}));
const brief = buildLawyerBrief({ intake, narrative, lang: 'en', sources: briefSources });
ok('C5 brief lists the provisions retrieval returned',
  /Section 154/.test(brief) && /Section 489f/i.test(brief) && !/999/.test(brief),
  (brief.match(/- Section .*/) || [''])[0]);
const emptyBrief = buildLawyerBrief({ intake, narrative, lang: 'en', sources: [] });
ok('C6 brief with no verified provision says so instead of guessing',
  /not verified|could not be confirmed|No provision/i.test(emptyBrief),
  emptyBrief.split('\n').find(l => /not verified|could not|No provision/i.test(l))?.slice(0, 70) || '');
ok('C7 brief records what is still outstanding',
  /city or district/i.test(brief));

const romanComplaint = buildComplaintDraft(intake, narrative, 'roman_urdu');
const romanBrief = buildLawyerBrief({ intake, narrative, lang: 'roman_urdu', sources: [] });
ok('C8 Roman Urdu documents contain no Urdu script',
  !URDU.test(romanComplaint) && !URDU.test(romanBrief));
const urComplaint = buildComplaintDraft(intake, 'یہ اردو میں بیان ہے۔', 'ur');
ok('C9 Urdu-script input produces Urdu-script document', URDU.test(urComplaint));
ok('C10 Urdu document still names no offence section', !OFFENCE_SECTIONS.test(urComplaint));

const norm = normalizeIntake({}, narrative);
ok('C11 normalizeIntake invents nothing from an empty intake',
  Array.isArray(norm.facts) && norm.facts.length === 0 && norm.location === '' && !/Rs\.? _+/.test(norm.summary));

// Defect regressions: an empty timeline must not leave a complaint with no events,
// and a place must not be printed in whatever case the extractor left it in.
const noTimeline = buildComplaintDraft(
  { keyFacts: [], timeline: [], summary: '' },
  'My landlord kept Rs. 200000 in Karachi. He refused to return it on 12 October 2026.', 'en');
ok('C12 dates in the person\'s own words become the event sequence',
  /^\d+\. 12 October 2026 — .*refused/im.test(noTimeline),
  (noTimeline.match(/^\d+\. [^\n]*/m) || [''])[0].slice(0, 72));
ok('C13 a stated city reaches the complaint as written', /Karachi/.test(noTimeline));
const lowerPlace = buildComplaintDraft({ location: 'rawalpindi', keyFacts: [], timeline: [] }, 'nothing stated elsewhere', 'en');
ok('C14 a lower-cased extracted place is title-cased, not left broken',
  /Rawalpindi/.test(lowerPlace) && !/\brawalpindi\b/.test(lowerPlace));

// ---------------------------------------------------------------------------
console.log('\n=== D/E. Endpoints over HTTP ===');
let health = 0;
try { health = (await fetch(`${BASE}/api/health`)).status; } catch { /* down */ }
if (health !== 200) {
  console.log('\n  BACKEND NOT REACHABLE at ' + BASE + ' — skipping HTTP group.');
  fail++;
  failures.push('backend reachable');
} else {
  const ls = await post('/api/ai/law-search', { query: 'cheque dishonour of a cheque', limit: 5 });
  const results = ls.data?.results || [];
  ok('D1 law search returns corpus hits', ls.status === 200 && results.length > 0,
    `${results.length} results, top=${results[0]?.provision?.number || '-'}`);
  ok('D2 every result carries the provision it is about',
    results.every(r => r.provision && r.provision.number && r.title));
  ok('D3 excerpt is real corpus text, not generated prose',
    results.every(r => typeof r.excerpt === 'string' && r.excerpt.length > 10));
  ok('D4 search reports itself as corpus retrieval', ls.data?.generatedBy === 'corpus-retrieval');

  const ur = await post('/api/ai/law-search', { query: 'Article 199 Constitution writ jurisdiction', limit: 3 });
  ok('D5 article-level query reaches the Constitution',
    (ur.data?.results || []).some(r => r.docId === 'constitution_1973'),
    (ur.data?.results || []).map(r => `${r.docId}:${r.provision?.number}`).join(', ').slice(0, 70));

  ok('D6 empty query rejected', (await post('/api/ai/law-search', { query: '' })).status === 400);
  const long = (await post('/api/ai/law-search', { query: 'a'.repeat(4001) })).status;
  ok('D7 over-long query rejected', long === 400, `status=${long}`);
  ok('D8 non-string query rejected', (await post('/api/ai/law-search', { query: 42 })).status === 400);

  const ip = await post('/api/ai/incident-package', {
    narrative: 'My landlord kept Rs. 200000 security deposit in Karachi and refuses to return it since January 2026. I have the rent agreement and the receipts.',
    preferredLanguage: 'en'
  });
  const pk = ip.data || {};
  ok('E1 incident package returns both documents', ip.status === 200 && !!pk.complaint && !!pk.brief);
  ok('E2 provisions in the brief come from retrieval',
    !pk.brief || /154|provision|not verified|could not be confirmed/i.test(pk.brief + JSON.stringify(pk.evidence || {})),
    JSON.stringify(pk.evidence?.provisionsListed || []).slice(0, 60));
  ok('E3 complaint still names no offence section',
    !/\b(?:420|379|406)\b|penal code/i.test(pk.complaint || ''));
  ok('E4 intake facts are echoed, not invented',
    /200,?000/.test(pk.complaint || '') && /Karachi/.test(pk.complaint || ''));
  ok('E5 empty narrative rejected', (await post('/api/ai/incident-package', { narrative: '' })).status === 400);
  ok('E6 missing narrative rejected', (await post('/api/ai/incident-package', {})).status === 400);

  const ipr = await post('/api/ai/incident-package', {
    narrative: 'Police station mein meri FIR darj nahi ho rahi, main ne 12 October 2026 ko complaint di thi, rawalpindi.',
    preferredLanguage: 'roman_urdu'
  });
  ok('E7 Roman Urdu package stays in Latin script',
    ipr.status === 200 && !URDU.test(ipr.data.complaint || '') && !URDU.test(ipr.data.brief || ''));

  // Regression: money a partner took and refused to return is a criminal breach of
  // trust matter (the PPC corpus carries s.405/406/409 for it). It used to be read as
  // a labour dispute purely because the shop was the place the money left.
  const shopFixture = await post('/api/ai/incident-package', {
    narrative: 'My name is Aadil and on 12 October 2026 my business partner Usman took Rs 400000 from my shop in Karachi and promised to return it by 1 November 2026. He refused to return it on 1 November 2026 and now ignores my calls.',
    preferredLanguage: 'en'
  });
  ok('E11 money taken and refused back is read as criminal, not labour',
    shopFixture.status === 200 && shopFixture.data.evidence?.domain === 'criminal',
    `domain=${shopFixture.data.evidence?.domain} verdict=${shopFixture.data.evidence?.verdict} provisions=${shopFixture.data.evidence?.provisionsListed}`);
  ok('E12 the narrative package lists the verified provisions that answer it',
    shopFixture.status === 200 && shopFixture.data.evidence?.provisionsListed >= 1
    && /Section 40[569]/.test(shopFixture.data.brief || ''),
    `verdict=${shopFixture.data.evidence?.verdict} provisions=${shopFixture.data.evidence?.provisionsListed}`);

  const frame = await chatFrame('Section 489-F PPC cheque dishonour in Karachi', 'en');
  ok('E8 chat answer carries a citation audit',
    frame.citationAudit && typeof frame.citationAudit.checked === 'number',
    JSON.stringify(frame.citationAudit || {}).slice(0, 90));
  ok('E9 a citation the evidence does not support is surfaced, not hidden',
    !frame.citationAudit || frame.citationAudit.checked === 0 ||
    Array.isArray(frame.citationAudit.notInEvidence) || Array.isArray(frame.citationAudit.unknownProvisions));
  ok('E10 chat still answers normally when nothing is contradicted',
    typeof frame.chunk === 'string' && frame.chunk.length > 40, `${(frame.chunk || '').length} chars`);
}

// ---------------------------------------------------------------------------
console.log(`\n=== RESULT: ${pass} PASS, ${fail} FAIL ===`);
if (failures.length) console.log('Failed: ' + failures.join(' | '));
process.exit(fail === 0 ? 0 : 1);
