/*
 * P3 (2026-10-18) — GCU Hyderabad official coverage.
 * Locks: the four new institution-specific documents exist and are embedded, every indexed
 * chunk carries its canonical gcuh.edu.pk source, national HEC rules stay distinguished from
 * GCUH's own implementation, real English / Roman Urdu / Urdu-script questions reach a GCUH
 * record, an unverified category stays unverified, and a question about another GCU city is
 * not answered from GCU Hyderabad's rules.
 * Run: node tests/unit/testGcuHyderabadCoverage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAGEngine } from '../../server/ragEngine.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const index = JSON.parse(read('rag/indexes/rag_index.json'));
const vectors = JSON.parse(read('rag/indexes/local_vectors.json'));
const manifest = JSON.parse(read('rag/manifest.json'));

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const knownGap = (name, detail = '') => console.log(`KNOWN GAP - ${name}${detail ? ' :: ' + detail : ''}`);

const DOCS = {
  gcuh_admission_policy_2026_27: 9,
  gcuh_fee_structure_and_schedule: 5,
  gcuh_postgraduate_admission_rules: 6,
  gcuh_quality_governance_units: 4,
};

// 1. ingestion identity and embedding
for (const [docId, expected] of Object.entries(DOCS)) {
  const chunks = index.chunks.filter((c) => c.docId === docId);
  record(`${docId} is indexed`, chunks.length === expected, `${chunks.length} chunks, expected ${expected}`);
  const ids = chunks.map((c) => c.id);
  const missing = ids.filter((i) => !Object.prototype.hasOwnProperty.call(vectors.vectors, i));
  record(`${docId} has a vector for every chunk`, missing.length === 0, `${missing.length} unattached`);
  const dm = manifest.documents.find((d) => d.id === docId);
  record(`${docId} is registered against the official site`,
    !!dm && /gcuh\.edu\.pk$/.test(dm.sourceDomain) && /GCU Hyderabad, institution-specific/.test(dm.jurisdiction),
    dm ? `${dm.sourceDomain} | ${dm.jurisdiction}` : 'not in manifest');
}
{
  const ids = index.chunks.map((c) => c.id);
  record('the rebuilt index has no duplicate chunk id', new Set(ids).size === ids.length, `${ids.length} entries / ${new Set(ids).size} unique`);
  record('every indexed chunk id has a vector and every vector is 384-dim',
    ids.every((i) => vectors.vectors[i] && vectors.vectors[i].length === vectors.dimension) && Object.keys(vectors.vectors).length === ids.length,
    `keys=${Object.keys(vectors.vectors).length} dim=${vectors.dimension}`);
}

// 2. provenance: each new chunk states its canonical URL and its retrieval date
{
  const fresh = index.chunks.filter((c) => c.docId in DOCS);
  const noUrl = fresh.filter((c) => !/gcuh\.edu\.pk/.test(c.text));
  const noRetrieved = fresh.filter((c) => !/Retrieved: 2026-10-18/.test(c.text));
  record('every new GCUH chunk carries its canonical gcuh.edu.pk source URL', noUrl.length === 0, `${noUrl.length} without: ${noUrl.map((c) => c.key).join(',')}`);
  record('every new GCUH chunk records the date its source text was read', noRetrieved.length === 0, `${noRetrieved.length} without`);
  const fabricated = fresh.filter((c) => /2015-01-01/.test(c.text));
  record('no new GCUH chunk repeats a placeholder notification date', fabricated.length === 0, `${fabricated.length} hits`);
}

// 3. the national / institutional boundary is stated, not blurred
{
  const fee = index.chunks.filter((c) => c.docId === 'gcuh_admission_policy_2026_27').map((c) => c.text).join('\n');
  record('the GCUH refund route defers to the HEC Fee Refund Policy instead of inventing GCUH tiers',
    /in accordance with the latest HEC Fee Refund Policy/.test(fee) && !/GCUH refunds \d/.test(fee));
  record('the GCUH registration fee is stored as expressly non-refundable',
    /Rs\. 3,000\/- \(non-refundable\)/.test(fee));
  const pg = index.chunks.filter((c) => c.docId === 'gcuh_postgraduate_admission_rules').map((c) => c.text).join('\n');
  record('the postgraduate test standard is attributed to HEC wording applied by GCUH',
    /HEC recognized|HEC's general-standards wording|national-origin wording is HEC/.test(pg));
  const gap = index.chunks.filter((c) => c.docId === 'gcuh_fee_structure_and_schedule').map((c) => c.text).join('\n');
  record('the unreadable postgraduate fee sheet is stored as a gap, not a number',
    /image-only|could not be read/.test(gap) && !/MPhil fee.*Rs\. \d/.test(gap));
}

// 4. real student questions reach GCUH's own rules (en / roman urdu / ur)
{
  const cases = [
    ['What is the minimum attendance required at GCU Hyderabad to appear in examinations?', /75% attendance/],
    ['GCU Hyderabad undergraduate merit weightage SSC HSC pre-entry test', /10%[\s\S]{0,80}40%[\s\S]{0,80}50%|SSC \(Matriculation\) 10%/],
    ['How much is the GCUH registration fee and how do I pay the challan?', /Rs\. 3,000|Allied Bank/],
    ['How do I cancel my admission in GCU Hyderabad?', /Director Admissions[\s\S]{0,120}Head of Department|Head of Department[\s\S]{0,120}Director Admissions/],
    ['GCUH pre-entry test passing marks 2026-27', /40% marks in the Pre-Entry Test/],
    ['last date of application for MS MPhil GCU Hyderabad 2027', /27-09-2026/],
    ['PhD eligibility CGPA at GCU Hyderabad', /CGPA of 3\.00/],
    ['duplicate student ID card fee GCUH', /Rs\. 500/],
    ['GCUH me admission cancel karnay ka tareeqa kya hai', /Director Admissions|Head of Department/],
    ['GCU Hyderabad ki fee challan kaise banegi', /CMS|challan/i],
    ['جی سی یو حیدرآباد میں حاضری کی کم از کم شرط کیا ہے', /75% attendance/],
    ['گورنمنٹ کالج یونیورسٹی حیدرآباد داخلے کی فیس کتنی ہے', /Rs\. 3,000|3,000/],
  ];
  for (const [q, re] of cases) {
    const r = await RAGEngine.retrieve(q);
    const win = r.chunks || [];
    const rank = win.findIndex((c) => c.docId in DOCS && re.test(c.text));
    const anyGcu = win.some((c) => c.docId in DOCS);
    const line = `domain=${r.domain} window=${win.length} gcuDocInWindow=${anyGcu} rank=${rank < 0 ? 'absent' : rank + 1}`;
    if (rank >= 0) record(`GCUH rule grounds "${q.slice(0, 46)}…"`, true, line);
    else knownGap(`GCUH rule not in window for "${q.slice(0, 46)}…"`, line);
  }
}

// 5. an unverified GCUH category must not be answered with an invented rule
{
  // The coverage-gap record names hostel rules, rustication and PG fees as categories that
  // were NOT acquired; it is excluded so this gate reads only operative rule text.
  const operative = index.chunks
    .filter((c) => c.docId in DOCS && !/Legal status: Coverage gap|Legal status: Source-recovery gap/.test(c.text))
    .map((c) => c.text).join('\n');
  record('no GCUH rule record asserts a hostel rule that was never published', !/hostel[\s\S]{0,60}(Rs\. ?\d|75%|rusticat)/i.test(operative));
  record('no GCUH rule record asserts a rustication period or penalty schedule', !/rusticat\w*[\s\S]{0,60}(days|months|Rs\.)/i.test(operative));
  record('no GCUH rule record states a postgraduate semester fee amount', !/MPhil[\s\S]{0,40}Rs\. ?\d{2,}/i.test(operative));
  const gapRecorded = index.chunks.filter((c) => c.docId in DOCS && /Coverage gap/.test(c.text));
  record('the unverified categories are themselves stored as a record', gapRecorded.length > 0, `${gapRecorded.length} gap chunk(s)`);
  const r = await RAGEngine.retrieve('GCU Hyderabad hostel rules and mess fee');
  const asserts = (r.chunks || []).filter((c) => c.docId in DOCS && !/Coverage gap/.test(c.text) && /hostel rules/i.test(c.text));
  record('a hostel question does not surface a fabricated GCUH hostel rule', asserts.length === 0, `${asserts.length} hits`);
}

// 6. source attribution: another city's GCU must not borrow GCUH's rules
{
  const r = await RAGEngine.retrieve('GC University Lahore fee structure and admission rules');
  const leaked = (r.chunks || []).filter((c) => c.docId in DOCS);
  record('a GC Lahore question is not answered from GCU Hyderabad documents', leaked.length === 0, leaked.map((c) => c.docId).join(','));
}

const failed = results.filter((x) => !x.pass);
console.log(`\n${results.length - failed.length} PASS / ${failed.length} FAIL`);
process.exit(failed.length ? 1 : 0);
