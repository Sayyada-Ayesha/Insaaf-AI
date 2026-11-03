/**
 * Document Assistant risk-grounding regression (2026-10-12).
 *
 * A fee challan's only deadline is a deposit date. buildRisks() used to append
 * "may lead to adverse or ex-parte proceedings" to every deadline-bearing
 * document, inventing a litigation consequence the challan never states. The
 * adversarial wording must survive on a show-cause notice.
 *
 * Asserted since the 2026-10-16 sprint (D1/D2): "Deposit Date: 30-05-2026" is read
 * as the challan's own deadline, and "Student Name: Bilal Ahmed" is extracted as a
 * party. Both were previously recorded as open extraction defects.
 *
 * Also asserted (S1–S4): a challan's summary is a lead built from its own extracted
 * facts, not the document pasted back, in English and in Roman Urdu; and a fee
 * challan and a show-cause notice each get their own readiness checklist instead of
 * an admission checklist or a generic legal one.
 */
import { analyzeDocumentText, getReadinessChecklist } from '../../server/docModel.js';

const CHALLAN = [
  'The University of Somewhere — Fee Section',
  'Semester Spring 2026 fee challan',
  'Student Name: Bilal Ahmed',
  'Registration No: FA24-BS-1029',
  'Total Amount Due: Rs. 48,500',
  'Challan Form No: 771234',
  'Deposit Date: 30-05-2026',
  'Payable at any HBL branch.',
].join('\n');

const SHOW_CAUSE = [
  'SHOW CAUSE NOTICE',
  'To: Mr. Adeel Raza, Employee No 4471',
  'You are directed to submit a written reply within 7 days of receipt of this notice.',
  'Discrepancy in accounts for FY 2024-25 is under inquiry.',
].join('\n');

const COURT_WORDS = /ex-parte|ex parte|adverse or|litigation|court/i;
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass += 1; } else { fail += 1; }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
};

// analyzeDocumentText(text, question, opts): the options belong in the THIRD argument.
// Passing them second put them in the question slot, so every case silently ran as
// English and no Roman Urdu prose branch was ever exercised.
const challan = await analyzeDocumentText(CHALLAN, '', { preferredLanguage: 'en' });
const challanRoman = await analyzeDocumentText(CHALLAN, '', { preferredLanguage: 'roman_urdu' });
const notice = await analyzeDocumentText(SHOW_CAUSE, '', { preferredLanguage: 'en' });

const cRisks = (challan.risks || []).map(r => String(r.label || r.text || r));
const nRisks = (notice.risks || []).map(r => String(r.label || r.text || r));

check('C1 fee challan typed as Fee Challan / Receipt', /fee challan/i.test(String(challan.documentType || '')), String(challan.documentType));
check('C2 fee challan carries no court/ex-parte wording', !cRisks.some(r => COURT_WORDS.test(r)), JSON.stringify(cRisks).slice(0, 120));
check('C3 fee challan still states the money fact', cRisks.some(r => /48,500/.test(r)), '');
check('N1 notice typed as a show-cause notice', /show[\s-]?cause/i.test(String(notice.documentType || '')), String(notice.documentType));
check('N2 notice keeps the response-consequence wording', nRisks.some(r => /ex-parte/i.test(r)), '');
check('N3 notice quotes its own stated deadline', nRisks.some(r => /within 7 days/.test(r)), '');
const cDead = (challan.deadlines || []).map(String);
const nDead = (notice.deadlines || []).map(String);
check('D1 challan reads its own labelled deposit date as a deadline',
  cDead.some(d => /deposit\s*date\s*:?\s*30-05-2026/i.test(d)), JSON.stringify(cDead).slice(0, 140));
check('D2 the named student is a party with the full name',
  (challan.parties || []).some(p => /Bilal Ahmed/.test(String(p))), JSON.stringify(challan.parties || []).slice(0, 140));
check('D3 the deposit date is not presented as a court response period',
  !cDead.some(d => /respond|reply|notice/i.test(d)), JSON.stringify(cDead).slice(0, 120));
check('D4 show-cause deadlines are unaffected', nDead.some(d => /within 7 days/i.test(d)), JSON.stringify(nDead).slice(0, 120));

// S1/S2 — the 2026-10-11 audit recorded "the document's raw text is returned as the
// summary". A challan has no prose sentences, so summarize() used to paste the whole
// record back; it must now state the document's own extracted facts.
const cSum = String(challan.summary || '');
const collapsedChallan = CHALLAN.replace(/\s+/g, ' ').trim();
check('S1 challan summary is a fact sentence, not the document pasted back',
  cSum.length > 0 && !collapsedChallan.startsWith(cSum.slice(0, 80))
  && /Bilal Ahmed/.test(cSum) && /48,500/.test(cSum) && /30-05-2026/.test(cSum), cSum.slice(0, 160));
const rSum = String(challanRoman.summary || '');
check('S2 Roman Urdu challan summary stays in Roman Urdu with the same facts',
  /lagta hai/.test(rSum) && /Bilal Ahmed/.test(rSum) && /48,500/.test(rSum) && /30-05-2026/.test(rSum), rSum.slice(0, 160));

// S3/S4 — a fee challan was handed the ADMISSION checklist (matric marksheet, domicile,
// photographs). Each ask must now reach its own checklist.
const clChallan = getReadinessChecklist('university fee challan deposit', { preferredLanguage: 'en' });
check('S3 fee challan gets the fee-deposit checklist, not admission documents',
  /fee challan|fee deposit/i.test(String(clChallan.label || ''))
  && !(clChallan.items || []).some(i => /matric|photograph/i.test(String(i.text))), String(clChallan.label));
const clShowCause = getReadinessChecklist('show cause notice reply', { preferredLanguage: 'en' });
check('S4 show-cause notice gets its own reply checklist',
  /show[\s-]?cause/i.test(String(clShowCause.label || ''))
  && (clShowCause.items || []).some(i => /each ground|allegation/i.test(String(i.text))), String(clShowCause.label));

console.log(`SUMMARY document-assistant risk gating: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
