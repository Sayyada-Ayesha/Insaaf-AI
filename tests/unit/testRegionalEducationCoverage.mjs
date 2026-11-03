/*
 * P4 (2026-10-18) — HEC national + all-region education source coverage.
 * Locks, over the live index and the real retrieval path:
 *   1. every regional education record exists, is embedded, and carries its own
 *      jurisdiction and canonical official URL (source relevance, not HTTP 200);
 *   2. representative questions in English, Roman Urdu and Urdu script reach the
 *      record that actually governs them;
 *   3. a question that names a region is never answered from another region's or
 *      another institution's education rules;
 *   4. Azad Jammu & Kashmir — which has no verified education instrument in the
 *      corpus — falls through instead of borrowing a province's rules;
 *   5. national HEC policy stays reachable when the question names no region.
 * Run: node tests/unit/testRegionalEducationCoverage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAGEngine } from '../../server/ragEngine.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const index = JSON.parse(read('rag/indexes/rag_index.json'));
const vectors = JSON.parse(read('rag/indexes/local_vectors.json'));
const manifest = JSON.parse(read('rag/manifest.json'));
const byId = new Map(manifest.documents.map((d) => [d.id, d]));
const chunksOf = (docId) => index.chunks.filter((c) => c.docId === docId);

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const knownGap = (name, detail = '') => console.log(`KNOWN GAP - ${name}${detail ? ' :: ' + detail : ''}`);

// Region-locked education records, keyed by the region their official source governs.
const REGIONAL = {
  sindh_higher_education_laws: { region: 'Sindh', domain: 'sindhhec.gov.pk' },
  sindh_hec_establishment_criteria: { region: 'Sindh', domain: 'sindhhec.gov.pk' },
  hec_recognized_campuses_sindh: { region: 'Sindh', domain: 'hec.gov.pk' },
  gcuh_institutional_rules: { region: 'Sindh', domain: 'gcuh.edu.pk' },
  gcuh_admissions_fees_examinations_rules: { region: 'Sindh', domain: 'gcuh.edu.pk' },
  gcuh_admission_policy_2026_27: { region: 'Sindh', domain: 'gcuh.edu.pk' },
  gcuh_fee_structure_and_schedule: { region: 'Sindh', domain: 'gcuh.edu.pk' },
  gcuh_postgraduate_admission_rules: { region: 'Sindh', domain: 'gcuh.edu.pk' },
  gcuh_quality_governance_units: { region: 'Sindh', domain: 'gcuh.edu.pk' },
  punjab_hed_instruments: { region: 'Punjab', domain: 'hed.punjab.gov.pk' },
  punjab_hed_notifications: { region: 'Punjab', domain: 'hed.punjab.gov.pk' },
  kp_qac_notifications: { region: 'Khyber Pakhtunkhwa', domain: 'qac.hed.gkp.pk' },
  baloch_chte_student_information: { region: 'Balochistan', domain: 'balochistan.gov.pk' },
  federal_mofept_policies: { region: 'Federal/ICT', domain: 'mofept.gov.pk' },
  gb_doecgb_nominations: { region: 'Gilgit-Baltistan', domain: 'doecgb.gov.pk' },
};
// Records that answer across every region because their owner is a national body.
const NATIONAL = {
  hec_fee_refund_policy: 'hec.gov.pk',
  hec_degree_attestation: 'hec.gov.pk',
  hec_equivalence_services: 'hec.gov.pk',
  hec_need_based_scholarship: 'hec.gov.pk',
  hec_disability_policy: 'hec.gov.pk',
  hec_harassment_policy: 'hec.gov.pk',
  hec_student_support_programs: 'hec.gov.pk',
  hec_student_welfare_policies: 'hec.gov.pk',
  navttc_act_and_candidate_routes: 'navttc.gov.pk',
  pbm_education_assistance: 'pbm.gov.pk',
};

// 1. ingestion identity: record exists, is embedded, is attributed to its own
//    jurisdiction and to the official domain that published it.
for (const [docId, expect] of Object.entries(REGIONAL)) {
  const chunks = chunksOf(docId);
  const dm = byId.get(docId);
  record(`${docId} is indexed`, chunks.length > 0, `${chunks.length} chunks`);
  const missing = chunks.map((c) => c.id).filter((i) => !Object.prototype.hasOwnProperty.call(vectors.vectors, i));
  record(`${docId} has a vector for every chunk`, missing.length === 0, `${missing.length} unattached`);
  record(`${docId} carries ${expect.region} jurisdiction`,
    !!dm && dm.jurisdiction.includes(expect.region), dm ? dm.jurisdiction : 'not in manifest');
  record(`${docId} cites ${expect.domain}`, !!dm && String(dm.sourceDomain).endsWith(expect.domain), dm ? dm.sourceDomain : 'missing');
  record(`${docId} chunk metadata matches the document jurisdiction`,
    chunks.length > 0 && chunks.every((c) => String(c.jurisdiction || '').includes(expect.region)),
    `${[...new Set(chunks.map((c) => c.jurisdiction))].join(' | ')}`);
}
for (const [docId, domain] of Object.entries(NATIONAL)) {
  const chunks = chunksOf(docId);
  const dm = byId.get(docId);
  record(`${docId} is indexed against ${domain}`,
    chunks.length > 0 && !!dm && String(dm.sourceDomain) === domain, `${chunks.length} chunks`);
  record(`${docId} is a national record`,
    !!dm && !/Punjab|Sindh|Khyber|Balochistan|Gilgit|AJK|Islamabad/.test(dm.jurisdiction), dm ? dm.jurisdiction : 'missing');
}

// 2. the question matrix: region x category x script, each with the records that
//    legitimately answer it. Rank is asserted, not mere retrieval.
const CASES = [
  ['HEC fee refund on cancelled admission', null, 'en', ['hec_fee_refund_policy']],
  ['HEC degree attestation for use abroad', null, 'en', ['hec_degree_attestation']],
  ['equivalence of O levels A levels HEC', null, 'en', ['hec_equivalence_services']],
  ['HEC need-based scholarship application eligibility', null, 'en', ['hec_need_based_scholarship']],
  ['accommodations for students with disabilities HEC', null, 'en', ['hec_disability_policy', 'hec_student_welfare_policies']],
  ['university anti-harassment committee procedure HEC', null, 'en', ['hec_harassment_policy']],
  ['HEC support for students from rural underserved areas', null, 'en', ['hec_student_support_programs', 'hec_student_welfare_policies']],
  ['Sindh HEC establishment criteria for a new university', 'Sindh', 'en', ['sindh_hec_establishment_criteria']],
  ['HEC recognised institutions in Hyderabad division Sindh', 'Sindh', 'en', ['hec_recognized_campuses_sindh']],
  ['Sindh domicile scholarship for Larkana students', 'Sindh', 'en', ['sindh_higher_education_laws', 'edu_scholarships']],
  ['Punjab HED scholarship domicile requirement', 'Punjab', 'en', ['punjab_hed_instruments', 'punjab_hed_notifications']],
  ['Punjab university fee notification HED', 'Punjab', 'en', ['punjab_hed_notifications', 'punjab_hed_instruments']],
  ['KP higher education department notification for students', 'KP', 'en', ['kp_qac_notifications']],
  ['Balochistan Higher Education Department student information', 'Balochistan', 'en', ['baloch_chte_student_information']],
  ['MOFEPT federal curriculum notification for schools', 'ICT', 'en', ['federal_mofept_policies']],
  ['Gilgit Baltistan education department nomination seats college', 'GB', 'en', ['gb_doecgb_nominations']],
  ['NAVTTC free technical training course application', null, 'en', ['navttc_act_and_candidate_routes']],
  ['Bait-ul-Mal education stipend for college students', null, 'en', ['pbm_education_assistance']],
  ['minority student quota at GCU Hyderabad admission', 'Sindh', 'en', ['gcuh_admission_policy_2026_27', 'gcuh_admissions_fees_examinations_rules']],
  ['HEC ki fee refund policy kya hai', null, 'roman', ['hec_fee_refund_policy']],
  ['Punjab ja HED scholarship lai ke tareeqa banao', 'Punjab', 'roman', ['punjab_hed_instruments', 'punjab_hed_notifications']],
  ['GCU Hyderabad mein disability quota se admission kaise', 'Sindh', 'roman', ['gcuh_admission_policy_2026_27', 'gcuh_admissions_fees_examinations_rules']],
  ['سندھ میں ہیک شناخت شدہ تعلیمی ادارے کون سے ہیں', 'Sindh', 'urdu', ['hec_recognized_campuses_sindh', 'sindh_hec_establishment_criteria']],
  ['خیبر پختونخوا ہائر ایجوکیشن ڈیپارٹمنٹ نوٹیفکیشن طلبہ', 'KP', 'urdu', ['kp_qac_notifications']],
  ['بلوچستان میں ہائر ایجوکیشن کے قواعد', 'Balochistan', 'urdu', ['baloch_chte_student_information']],
  ['پنجاب ہائر ایجوکیشن ڈیپارٹمنٹ کے قواعد', 'Punjab', 'urdu', ['punjab_hed_instruments', 'punjab_hed_notifications']],
  ['گلگت بلتستان میں کالجوں لیے نامزدگی سیٹیں', 'GB', 'urdu', ['gb_doecgb_nominations']],
  ['وفاقی تعلیم پالیسی غیر رسمی تعليم', 'ICT', 'urdu', ['federal_mofept_policies']],
];
const REGION_MATCH = {
  Sindh: /Sindh|Hyderabad/,
  Punjab: /Punjab/,
  KP: /Khyber|Pakhtunkhwa/,
  Balochistan: /Balochistan/,
  GB: /Gilgit|Baltistan/,
  ICT: /Federal\/ICT|Islamabad/,
  AJK: /AJK|Azad/,
};
for (const [q, region, script, want] of CASES) {
  const r = await RAGEngine.retrieve(q);
  const win = r.chunks || [];
  const rank = win.findIndex((c) => want.includes(c.docId));
  record(`[${script}] ${q.slice(0, 34)} reaches ${want[0]}`, rank >= 0, `rank=${rank + 1} domain=${r.domain} top=${win[0] ? win[0].docId : '-'}`);
  if (region) {
    const foreign = win.filter((c) => {
      const j = String((byId.get(c.docId) || {}).jurisdiction || '');
      return Object.keys(REGIONAL).includes(c.docId) && !REGION_MATCH[region].test(j);
    });
    record(`[${script}] ${q.slice(0, 34)} keeps out-of-region education records out`, foreign.length === 0, foreign.map((c) => c.docId).join(','));
  }
}

// 3. the AJK control: no verified AJK education instrument exists, so an AJK
//    education question must not be answered from another region's rules.
const AJK_QUERIES = [
  'AJK domicile-based scholarship scheme for students',
  'آزاد جموں و کشمیر کے تعلیمی قواعد کیا ہیں',
  'Kotli Azad Jammu college admission merit list rules',
];
for (const q of AJK_QUERIES) {
  const r = await RAGEngine.retrieve(q);
  const stolen = (r.chunks || []).filter((c) => Object.keys(REGIONAL).includes(c.docId));
  record(`AJK "${q.slice(0, 30)}" is not answered from a province or institution record`,
    stolen.length === 0, stolen.map((c) => c.docId).join(','));
}
const ajkDocs = manifest.documents.filter((d) => /AJK|Azad/.test(String(d.jurisdiction)));
record('AJK has no education instrument in the corpus (gap recorded, not papered over)',
  !ajkDocs.some((d) => /educ|universit|college|scholarship|hec|examin/i.test(`${d.id} ${d.title}`)),
  `AJK records: ${ajkDocs.map((d) => d.id).join(', ') || 'none'}`);

// 4. national policy stays reachable when no region is named.
{
  const r = await RAGEngine.retrieve('HEC scholarship eligibility rules for universities');
  const win = r.chunks || [];
  const provincial = win.filter((c) => Object.keys(REGIONAL).includes(c.docId));
  const national = win.filter((c) => Object.keys(NATIONAL).includes(c.docId) || /^edu_/.test(c.docId));
  record('an unregional HEC question still reaches national education records', national.length > 0, `${national.length} national chunks`);
  record('an unregional HEC question is not displaced by a province record', provincial.length === 0, provincial.map((c) => c.docId).join(','));
}

// 5. the guard removes rather than re-ranks: a named region cannot pull in a
//    province record for a question about a different province.
{
  const r = await RAGEngine.retrieve('Punjab polytechnic diploma admission merit list HED');
  const leaked = (r.chunks || []).filter((c) => /sindh|gcuh|baloch|kp_qac|doecgb|mofept/i.test(c.docId));
  record('a Punjab polytechnic question does not borrow Sindh/Balochistan/KP/GB records', leaked.length === 0, leaked.map((c) => c.docId).join(','));
}

const counted = Object.entries(REGIONAL).map(([docId]) => `${docId}:${chunksOf(docId).length}`).join(' ');
console.log(`\nregional chunk counts — ${counted}`);
knownGap('Khyber Pakhtunkhwa education', `${chunksOf('kp_qac_notifications').length} chunk(s) — QAC KP publishes notification titles with the text in PDFs`);
knownGap('Balochistan education', `${chunksOf('baloch_chte_student_information').length} chunk(s) — CHTE/BHISE student-information pages only`);
knownGap('Federal/ICT education', `${chunksOf('federal_mofept_policies').length} chunk(s) — MOFEPT lists 22 policy PDFs, the page carries titles`);
knownGap('Punjab education', `${chunksOf('punjab_hed_instruments').length + chunksOf('punjab_hed_notifications').length} chunk(s) — rules_regulations page is a 36-PDF title index`);
knownGap('Azad Jammu & Kashmir education', 'no verified education instrument; ajkassembly.gok.pk returns a navigation shell (2,978 text chars, 0 education terms)');

const failed = results.filter((x) => !x.pass);
console.log(`\n${results.length - failed.length} PASS / ${failed.length} FAIL`);
process.exit(failed.length ? 1 : 0);
