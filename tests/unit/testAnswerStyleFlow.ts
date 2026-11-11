/**
 * FINAL GLOBAL INTELLIGENCE FIX §3/§8 — the answer-style layer.
 *
 * Measured defects this pins, all reproduced from live /api/ai/chat output before
 * the fix: an answer whose only content was a corpus coverage note ("Governs
 * residential and commercial tenancy disputes in Islamabad"), a fee-refund answer
 * cut off mid-word ("this fee is refundable after"), a whole HEC notification
 * index pasted into "What the law says", fee-table labels ("Library Fee :") and
 * the record's own block heading printed as practical steps, the same steps
 * repeated in two sections with a gapped numbering (1 … 5), and a step list
 * reading "1. Step 4 —".
 *
 * Every case here is a synthetic record, so the rules are tested as form rules
 * that hold in any domain, not as checks on five corpus examples.
 *
 * S6/S7 pin the second measurement round: the composer's intent table answered
 * in place of the record with a sentence no record states ("Property rights are
 * protected by law…"), a coverage annotation reached the answer from a SECOND
 * record, a clause number ("9.1.") was quoted as the whole rule, and topical
 * scoring counted "rent" inside "current" and "different" as subject matches.
 *
 * Run: npx tsx tests/unit/testAnswerStyleFlow.ts
 */
import { composeOwnedModelAnswer } from '../../server/ownedModel.js';

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failures.push(label + (detail ? ` — ${detail}` : '')); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

const header = (title: string, authority = 'Ministry of Law and Justice') =>
  `Title: ${title}\nAuthority: ${authority}\nJurisdiction: Pakistan\nLegal Status: Active\nSource URL: https://example.gov.pk\n`;

/** One record, in the shape retrieval hands to the composer. */
function rec(docId: string, key: string, chunkTitle: string, body: string, extra: Record<string, unknown> = {}) {
  return { docId, key, chunkTitle, title: chunkTitle, text: header(chunkTitle) + body, domain: 'general-legal', ...extra };
}

/** Sections of a composed answer, keyed by their heading. */
function sections(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = String(text).split(/\n(?=\*\*)/);
  for (const p of parts) {
    const m = /^\*\*(.+?)\*\*\n?([\s\S]*)$/.exec(p);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

const ROMAN_TENANCY = 'makan malik ne kiraye daar ko 3 mahine ka rent na dene par khali karne ka notice bheja hai. Mera kya haq hai?';
const TENANCY_RECORDS = [
  rec('tenancy_laws', 'ICT_RENT', 'Islamabad Rent Restriction Ordinance, 2001',
    '\nKey Provisions & Rights:\n'
    + '- Governs residential and commercial tenancy disputes in Islamabad.\n'
    + '- Landlord must register lease agreement with the Islamabad Rent Controller.\n'
    + '- A tenant cannot be evicted without an order of the Rent Controller.\n'
    + '- Rent disputes are decided by the Rent Controller on evidence.\n'
    + '- Refund of advance rent is ordered by the Rent Controller with the arrears.\n'),
  rec('property_laws', 'EVICT_PROC', 'Landlord-Tenant Dispute Resolution Procedure in Pakistan',
    '\nStep-by-Step Practical Workflow:\n'
    + 'Step 1 — Send Legal Notice: State the arrears and the relief sought.\n'
    + 'Step 2 — File Application: Move the Rent Controller for eviction.\n'
    + 'Step 3 — Hearing: Both parties produce the rent receipts.\n'
    + 'Step 4 — Order: The Rent Controller decides arrears and eviction.\n'),
];

console.log('\n--- S1  a coverage annotation is never the answer ---');
const ten = composeOwnedModelAnswer(ROMAN_TENANCY, TENANCY_RECORDS as never[], 'roman_urdu', 'civil', 'intermediate',
  { verdict: 'strong', supportedCount: 2, rejected: 0 });
const tenS = sections(ten);
ok('S1.1 the Roman answer leads with a rule, not with what the record covers',
  !/Governs /.test(tenS['Jawab'] || ''), (tenS['Jawab'] || '').slice(0, 160));
ok('S1.2 the lead states an action the record actually asserts',
  /Rent Controller/.test(tenS['Jawab'] || ''), (tenS['Jawab'] || '').slice(0, 160));
ok('S1.3 no section of the answer is a bare coverage sentence',
  !Object.values(tenS).some(v => /^Record ke mutabiq: Governs\b/.test(v)),
  Object.values(tenS).map(v => v.slice(0, 60)).join(' | '));

console.log('\n--- S2  quoted text is never cut mid-word or left as a fragment ---');
const LONG = 'Payable by all new students together with the first - semester tuition fee, this fee is refundable after deductions are made for the damage or loss caused by the student and the balance is returned within the period stated by the institution which may extend to sixty days from the date of the application received by the accounts office of the university';
const longRec = [rec('hec_refund', 'LIB_FEE', 'HEC National Fee-Refund Policy at HEIs',
  `\n${LONG}\nA student who withdraws before the last date of addition or deletion is refunded the paid fee after deduction of the prescribed charges.\nRefund of the hostel fee is made when the hostel is vacated and the damage, if any, is assessed by the warden and reported to the finance office of the institution.\n`)];
const romanLong = composeOwnedModelAnswer('university ne semester cancel kar diya aur fee refund nahi kar raha, HEC ka rule', longRec as never[], 'roman_urdu', 'education', 'intermediate',
  { verdict: 'strong', supportedCount: 1, rejected: 0 });
const leadLine = (romanLong.match(/Record ke mutabiq: ([^\n]*)/) || [])[1] || '';
ok('S2.1 a lead over the quote ceiling is present at all', leadLine.length > 0, romanLong.slice(0, 120));
const leadSource = LONG + ' ' + 'A student who withdraws before the last date of addition or deletion is refunded the paid fee after deduction of the prescribed charges. Refund of the hostel fee is made when the hostel is vacated and the damage, if any, is assessed by the warden and reported to the finance office of the institution.';
ok('S2.2 it stops at a word boundary, never inside a word',
  (() => {
    if (!leadLine) return false;
    const whole = leadLine.replace(/[.]*$/, '');
    const at = leadSource.indexOf(whole);
    if (at < 0) return true; // composed text, not a slice — checked by S2.3
    const next = leadSource.charAt(at + whole.length);
    return next === '' || /\s/.test(next);
  })(), `"…${leadLine.slice(-40)}"`);
ok('S2.3 no answer line ends on a dangling function word',
  !/\b(and|the|of|to|for|after|before|with|from)\s*$/i.test(leadLine), `"…${leadLine.slice(-40)}"`);
ok('S2.4 the quote stays inside the ceiling the level allows',
  leadLine.length <= 240, `${leadLine.length} chars`);

console.log('\n--- S3  a layout listing may be cited but never quoted as law ---');
const INDEX = 'HEC Notifications\nType\nAcademic\nUniversity\nGeneral Public\nRecognition of the degree awarded by foreign chartered institutions through virtual learning Friday, July 22 2022\nDeferment of Post PhD Experience for Professors Wednesday, July 20 2022\nExtension in maximum duration of MS MPhil PhD programs due to Covid 19 Friday, April 15 2022\nAppointment of TTS faculty on academic administrative positions Wednesday, March 2 2022\nWithdrawal of Migration Certificate as an admission requirement Monday, February 28 2022\nCollecting hard copies of PhD dissertation to register record Sunday, December 19 2021\nSalary Package for the Vice Chancellors of Public Sector Universities Friday, October 22 2021\nAmendment of the clause 1 4 1 2 of Model Tenure Track Process Statutes Saturday, October 16 2021\nTransition of BA BSc Programs to Associate Degree Programs Thursday, July 11 2019\nAcceptance of USAT Undergraduate Studies Admission Test Tuesday, July 5 2022\nClarification regarding TTS Leave Policy Friday, March 5 2021\nRevised Interim Placement of Fresh PhDs Policy Friday, July 21 2023\nAnti Plagiarism Policy 2023 Wednesday, August 2 2023\nFramework of the HEC Distinguished National Professor Program Tuesday, September 30 2025';
const indexRec = [
  rec('hec_refund', 'NOTIF_INDEX', 'HEC Notifications Index', `\n${INDEX}\n`),
  rec('hec_refund', 'FEE_REFUND', 'HEC Refund / National Fee-Refund Policy at HEIs',
    '\nA student who withdraws before the last date of addition or deletion is refunded the paid fee after deduction of the prescribed charges.\nRefund is processed within thirty working days of a complete application received by the accounts office.\nThe institution shall not withhold a refund on the ground of an unpaid library fine beyond the prescribed limit.\n'),
];
const idx = composeOwnedModelAnswer('university ne semester cancel kar diya hai aur fee refund nahi kar raha. HEC ka kya rule hai?', indexRec as never[], 'roman_urdu', 'education', 'intermediate',
  { verdict: 'strong', supportedCount: 2, rejected: 0 });
ok('S3.1 the notification index never reaches the prose',
  !/Friday, July 22 2022/.test(idx) && !/Wednesday, July 20 2022/.test(idx));
ok('S3.2 no single line of the answer is a wall of listing text',
  Math.max(...idx.split('\n').map(l => l.length)) <= 620,
  `longest ${Math.max(...idx.split('\n').map(l => l.length))}`);
ok('S3.3 the answer still quotes the record that states the refund rule',
  /refund/i.test(idx), idx.slice(0, 120));

console.log('\n--- S4  table stubs, headings and sub-lists are not practical steps ---');
const feeStubRec = [rec('hec_refund', 'FEE_TABLE', 'HEC Refund Policy Fee Table',
  '\n1. Library Fee :\n2. Transport Fee :\n3. Utilities Fee :\n4. Security/Deposit Fee :\n5. Semester Fee :')];
const stubAns = composeOwnedModelAnswer('meri fees ka refund kitna hoga aur konsi fees kategi', feeStubRec as never[], 'roman_urdu', 'education', 'intermediate',
  { verdict: 'weak', supportedCount: 1, rejected: 0 });
ok('S4.1 no step is a label with nothing after its colon',
  !/^\s*(?:[-*\d.]+\s*)?[^:\n]{1,40}:\s*$/m.test(stubAns.replace(/\*\*[^*]*\*\*/g, '')),
  stubAns.split('\n').filter(l => /:\s*$/.test(l)).join(' | '));

const procRec = [rec('consumer_protection', 'CONSUMER_COMPLAINT_PROCEDURE', 'Consumer Complaint Procedure',
  '\nConsumer Complaint Procedure — Step-by-Step\n'
  + 'Step 1 — Send Legal Notice: Before filing a consumer court case, send a mandatory 15-day legal notice to the seller in writing.\n'
  + 'Step 2 — File Complaint in District Consumer Court: Prepare a written complaint including:\n'
  + '  - Name, address, and contact of complainant.\n'
  + '  - Relief sought.\n'
  + 'Step 3 — Consumer Court Issues Notice: The Court registers the complaint and issues notice to the opposite party.\n'
  + 'Step 4 — Order: Consumer Court passes a reasoned order for refund, replacement, or compensation.\n')];
const proc = composeOwnedModelAnswer('shop refuses to replace my defective washing machine, what is the procedure in consumer court', procRec as never[], 'en', 'consumer', 'intermediate',
  { verdict: 'weak', supportedCount: 1, rejected: 0 });
const procS = sections(proc);
const steps = (procS['What to do / procedure'] || '').split('\n').filter(l => /^\d+\./.test(l));
ok('S4.2 the record\'s own block heading is not printed as a step',
  !/^\s*\d+\.\s*Consumer Complaint Procedure/.test(procS['What to do / procedure'] || ''),
  (procS['What to do / procedure'] || '').slice(0, 120));
ok('S4.3 an indented sub-list of complaint form fields is not a step',
  !steps.some(l => /^Name, address/.test(l.replace(/^\d+\.\s*/, '')) || /^\s*\d+\.\s*Name, address/.test(l)),
  steps.join(' | ').slice(0, 200));
ok('S4.4 step numbering is contiguous from 1',
  steps.every((l, i) => l.startsWith(`${i + 1}.`)), steps.map(l => l.slice(0, 4)).join(','));
ok('S4.5 an internal "Step N —" prefix is not kept inside the new numbering',
  !steps.some(l => /\bStep \d+ —/.test(l)), steps.join(' | ').slice(0, 200));

console.log('\n--- S5  one section does not repeat another verbatim ---');
const normAll = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const answerBlob = normAll(procS['Answer'] || '');
ok('S5.1 no practical step repeats a sentence the answer already gave',
  !steps.some(l => answerBlob.includes(normAll(l.replace(/^\d+\.\s*/, '')).slice(0, 60))),
  steps.filter(l => answerBlob.includes(normAll(l.replace(/^\d+\.\s*/, '')).slice(0, 60))).join(' | ').slice(0, 160));
const procS2 = sections(composeOwnedModelAnswer('what is the consumer court procedure for a defective washing machine and what happens after the notice', procRec as never[], 'en', 'consumer', 'intermediate',
  { verdict: 'weak', supportedCount: 1, rejected: 0 }));
const steps2 = (procS2['What to do / procedure'] || '').split('\n').filter(l => /^\d+\./.test(l));
const saidAll = normAll(Object.values(procS2).join(' '));
ok('S5.2 deduplication loses no step: every action the record lists is still said once',
  ['Send Legal Notice', 'File Complaint in District Consumer Court', 'Consumer Court Issues Notice', 'Order: Consumer Court passes']
    .every(frag => saidAll.includes(normAll(frag))), procS2['Answer'] || '');
const beforeBlob = normAll(['Answer', 'What the law says', 'Law that may apply'].map(k => procS2[k] || '').join(' '));
ok('S5.3 when a procedure section is emitted it adds what earlier sections did not',
  !steps2.length || steps2.every(l => !beforeBlob.includes(normAll(l.replace(/^\d+\.\s*/, '')).slice(0, 60))),
  steps2.join(' | ').slice(0, 160));

console.log('\n--- S6  no intent-keyed canned paragraph reaches an answer ---');
// The composer used to choose a sentence from a keyword table whenever the
// records were used up: "Property rights are protected by law. Clear provisions
// govern registration, possession, and transfer." — words no record states, in
// place of the rule that answers the question.
const TEMPLATE_FORMS = [
  'Property rights are protected by law', 'Property ke qanooni huqooq protected',
  'These rights and protections are set out', 'Yeh rights aur protections aap ki university',
  'Legal remedies exist for debt recovery', 'Consumer protection law allows you',
  'This information is from the verified Pakistani law corpus',
  'Yeh maloomat verified Pakistani qanooni zakhire',
  // The practical-step table, deleted with the explanation table: the same four
  // lines answered every question in an intent, and one of them asserted a
  // provision ("Section 200 CrPC") no retrieved record stated.
  'Understand your rights and check the relevant rules', 'Document the issue in writing',
  'Submit a written application to the relevant authority or forum', 'Seek legal advice if needed',
  'you can approach the court under Section 200 CrPC',
  'If the FIR is not registered, send the information in writing',
  'contact the HEC or relevant scholarship authority',
  'you can approach the HEC or the provincial Ombudsperson',
  'Apne rights ko samjhein aur mutaliqa rules check karein',
  'Mutaliqa authority ya forum ko likhit darkhwast den',
  'Agar police madad na kare to adalat se rujoo',
  'Qanooni madad ke liye legal aid services se bhi raabta',
];
const enTenancy = sections(composeOwnedModelAnswer(
  'my landlord sent a notice to vacate after three months of unpaid rent, what are my rights',
  TENANCY_RECORDS as never[], 'en', 'civil', 'intermediate',
  { verdict: 'strong', supportedCount: 2, rejected: 0 }));
ok('S6.1 an English answer carries no template sentence',
  !TEMPLATE_FORMS.some(t => Object.values(enTenancy).some(v => v.includes(t))),
  Object.values(enTenancy).join(' | ').slice(0, 260));
ok('S6.2 a Roman Urdu answer carries no template sentence',
  !TEMPLATE_FORMS.some(t => Object.values(tenS).some(v => v.includes(t))),
  Object.values(tenS).join(' | ').slice(0, 260));
// The quote surfaces are "Answer" and "What the law says". The Issue section
// restates the citizen's own question, so it is not a claim about the corpus and
// is not held to this bar. The composer quotes a body whose lines it re-joins
// with spaces, so whitespace is collapsed on BOTH sides before comparing.
const srcPool = TENANCY_RECORDS.map(r => String(r.text).replace(/\s+/g, ' ').toLowerCase());
const quotedTenancy = ['Answer', 'What the law says']
  .map(k => (enTenancy[k] || '').replace(/\*\*[^*]*\*\*/g, ''))
  .join(' ')
  .split(/(?<=[.!?])\s+/)
  .map(s => s.replace(/^\s*(?:if this is in|for|under)\s[^:.]{0,40}:\s*/i, '').replace(/\s+/g, ' ').trim())
  .filter(s => s.length > 25);
// Two different claims share the law sections. A QUOTED rule must be found in a
// supplied record verbatim. A scope frame — corpusScope.js writes "This is
// ${city}, ${province} local-level practice, not Pakistan-wide law." from its own
// scope model — is never a record sentence, so it is held to its own bar: the
// fixed form only, and a jurisdiction the supplied records actually state.
const scopeFrame = /^this is [a-z][a-z ,]{2,40}? (?:local-level practice, not pakistan-wide law|pakistan-wide law(?: only)?|practice of the [a-z ]{3,40})\.?$/i;
const isQuoted = (s) => srcPool.some(p => p.includes(s.slice(0, 40).toLowerCase()));
const namesKnownPlace = (s) => (s.match(/\b([A-Z][a-z]{3,})\b/g) || [])
  .filter(w => !['This'].includes(w))
  .every(w => srcPool.some(p => p.includes(w.toLowerCase())));
const unsourcedQuote = quotedTenancy.filter(s => !scopeFrame.test(s) && !isQuoted(s));
const badScope = quotedTenancy.filter(s => scopeFrame.test(s) && !namesKnownPlace(s));
ok('S6.3 every quoted sentence of the law sections appears in a supplied record',
  quotedTenancy.length > 0 && !unsourcedQuote.length,
  `${quotedTenancy.length} sentences checked | unsourced: ${unsourcedQuote.slice(0, 3).join(' // ').slice(0, 240)}`);
ok('S6.3a a scope frame names only a jurisdiction the records state',
  !badScope.length, badScope.slice(0, 3).join(' // ').slice(0, 240));
// The annotation rule must hold for a record quoted as the SECOND source too,
// not only for the record that answers.
const annotSecond = [
  rec('property_laws', 'KP_RENT', 'Khyber Pakhtunkhwa Urban Rent Restriction Ordinance, 1959',
    '\nKey Provisions & Rights:\n'
    + '- Governs rent and tenancy in urban areas of KP.\n'
    + '- The Rent Controller tries the case and no civil court has jurisdiction.\n'
    + '- A tenant in arrears of rent may be evicted on an application to the Rent Controller.\n'),
  rec('tenancy_laws', 'ICT_RENT', 'Islamabad Rent Restriction Ordinance, 2001',
    '\nKey Provisions & Rights:\n'
    + '- A tenant cannot be evicted without an order of the Rent Controller.\n'
    + '- Rent disputes are decided by the Rent Controller on evidence.\n'
    + '- Refund of advance rent is ordered with the arrears after the hearing.\n'),
];
const annotBlob = sections(composeOwnedModelAnswer(
  'ground rules for eviction of a tenant by the rent controller under the tenancy ordinance',
  annotSecond as never[], 'en', 'civil', 'intermediate',
  { verdict: 'strong', supportedCount: 2, rejected: 0 }))['What the law says'] || '';
ok('S6.4 a coverage annotation is not quoted from a second record either',
  !/Governs /.test(annotBlob), annotBlob.slice(0, 200));

console.log('\n--- S7  a quote is a sentence a reader can act on ---');
const clauseRec = [
  rec('hec_refund', '9', 'HEC Fee Refund Policy (part 4)',
    '\nKey Provisions:\n'
    + '9.1. The library and digital library fee is completely refundable on withdrawal.\n'
    + '9.2. The semester tuition fee is refundable in full when the semester is cancelled before classes begin.\n'
    + '9.3. Where a semester is cancelled after classes begin, fifty per cent of the tuition fee is refundable.\n'),
];
const clauseBlob = Object.values(sections(composeOwnedModelAnswer(
  'university cancelled the semester and refuses the fee refund, what does the HEC policy say about refundable fee',
  clauseRec as never[], 'en', 'education', 'intermediate',
  { verdict: 'strong', supportedCount: 1, rejected: 0 }))).join(' ');
ok('S7.1 no clause marker appears without the provision it numbers',
  !/\d+(?:\.\d+)*\.(?!\s*[A-Za-z\d])/.test(clauseBlob), clauseBlob.slice(0, 240));
ok('S7.2 the answer still states a substantive refund rule',
  /refund/i.test(clauseBlob), clauseBlob.slice(0, 240));
// Substring hits are not subject matches: "current" and "different" both contain
// "rent", and a sentence built only of those words used to outscore the rule.
const noiseRec = [
  rec('tenancy_laws', 'ICT_RENT', 'Rent Restriction Ordinance',
    '\nKey Provisions & Rights:\n'
    + '- The ordinance is current for different parents and indifferent landlords.\n'
    + '- A tenant cannot be evicted without an order of the Rent Controller.\n'
    + '- Eviction proceedings are decided by the Rent Controller on evidence.\n'
    + '- The landlord who arrears rent may apply for eviction of the tenant.\n'),
];
const noiseBlob = sections(composeOwnedModelAnswer(
  'can the landlord evict a tenant without a court order when rent is in arrears',
  noiseRec as never[], 'en', 'civil', 'intermediate',
  { verdict: 'strong', supportedCount: 1, rejected: 0 }))['Answer'] || '';
ok('S7.3 a sentence that only shares substrings is not chosen as the rule',
  !/indifferent|parents/i.test(noiseBlob), noiseBlob.slice(0, 200));
ok('S7.4 the sentence that states the eviction rule is the one quoted',
  /evict/i.test(noiseBlob), noiseBlob.slice(0, 200));

console.log('\n--- S8  a pointer to another document is not a rule ---');
// Measured live on :3005 with the six composer fixes in place: ten-05 printed
// "**What the law says:** See Circular No. 4/2025." and edu-02 printed "This
// provision applies to tenancy disputes involving students." Both are corpus
// plumbing — one points at a document that was never retrieved, the other is the
// indexer's note beside the provision — and neither tells a citizen anything.
const xrefRec = [
  rec('hec_circular', 'XREF', 'HEC Fee Refund Circular reference note',
    '\nKey Provisions:\n'
    + '- See Circular No. 4/2025.\n'
    + '- This provision applies to tenancy disputes involving students.\n'
    + '- A student who withdraws before the last date gets eighty per cent of the tuition fee refunded.\n'),
];
const xrefBlob = Object.values(sections(composeOwnedModelAnswer(
  'university refuses my fee refund after withdrawal, what does the HEC circular say about the refund amount',
  xrefRec as never[], 'en', 'education', 'intermediate',
  { verdict: 'strong', supportedCount: 1, rejected: 0 }))).join(' ');
ok('S8.1 a pointer line is never quoted as the law',
  !/See Circular No\. 4\/2025\./i.test(xrefBlob), xrefBlob.slice(0, 220));
ok('S8.2 an indexer\'s "This provision applies to …" note is never quoted',
  !/This provision applies to/i.test(xrefBlob), xrefBlob.slice(0, 220));
ok('S8.3 the record\'s real rule is still quoted',
  /eighty per cent/i.test(xrefBlob), xrefBlob.slice(0, 220));
// The filter must not swallow a statute's OWN scope sentence: that is the
// instrument speaking about its reach, and it is a fact a citizen can use.
const actScope = [
  rec('tenancy_laws', 'ICT_S1', 'Islamabad Rent Restriction Ordinance, 2001',
    '\nKey Provisions:\n'
    + '- This Act applies to the whole of Islamabad Capital Territory.\n'
    + '- A landlord may not take rent above the rate the Rent Controller fixes.\n'),
];
const scopeBlob = Object.values(sections(composeOwnedModelAnswer(
  'which city does the Islamabad rent restriction ordinance apply to and what is the rent ceiling',
  actScope as never[], 'en', 'civil', 'intermediate',
  { verdict: 'strong', supportedCount: 1, rejected: 0 }))).join(' ');
ok('S8.4 an instrument\'s own "This Act applies to …" sentence stays quotable',
  /This Act applies to the whole of Islamabad Capital Territory\./i.test(scopeBlob),
  scopeBlob.slice(0, 220));
const lawQuotes = (xrefBlob.match(/[^.!?]+[.!?]/g) || [])
  .map(s => s.replace(/\s+/g, ' ').trim())
  .filter(s => /tuition fee|refund/i.test(s));
ok('S8.5 no returned law quote is a fragment without substance',
  lawQuotes.every(s => s.replace(/[^A-Za-z\u0600-\u06FF]/g, '').length >= 30),
  lawQuotes.filter(s => s.replace(/[^A-Za-z\u0600-\u06FF]/g, '').length < 30).join(' // ').slice(0, 200));

console.log(`\n=== S: ${passed} PASS / ${failures.length} FAIL ===`);
if (failures.length) {
  console.log('FAILURES:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
