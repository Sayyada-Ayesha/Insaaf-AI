// Jurisdiction retrieval regression suite (Window G).
// Asserts the ACTUAL selected record ids and the limitation text they carry,
// because a regional answer is only correct when the evidence itself supports
// the claim. Runs in-process against the same index the server loads.
import { RAGEngine } from '../../server/ragEngine.js';
import { evaluateEvidence } from '../../server/evidenceGate.js';

const PROV = ['sindh_hec_establishment_criteria', 'hec_recognized_campuses_sindh', 'punjab_hed_instruments',
  'punjab_hed_notifications', 'kp_qac_notifications', 'baloch_chte_student_information',
  'federal_mofept_policies', 'gb_doecgb_nominations', 'sindh_higher_education_laws'];
const gate = async (q) => {
  const r = await RAGEngine.retrieve(q);
  return { r, ev: evaluateEvidence(q, r) };
};
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (detail ? ' :: ' + JSON.stringify(detail) : '')); }
};
const get = async (q) => (await RAGEngine.retrieve(q)).chunks || [];
const top = (cs) => cs[0] || {};

const cases = [];
const push = (label, fn) => cases.push([label, fn]);

// R1 Sindh establishment criteria must not be answered from the scholarship register
push('R1 Sindh establishment criteria selects the criteria record', async () => {
  const cs = await get('What criteria must a new private sector university or a new campus satisfy to be established under Sindh HEC norms and standards?');
  const t = top(cs);
  ok('R1.1 top record is sindh_hec_establishment_criteria', t.docId === 'sindh_hec_establishment_criteria', { top: t.docId });
  ok('R1.2 that record holds the establishment criteria titles', /Criteria for establishment of a New Private Sector University/i.test(t.text || ''), {});
  ok('R1.3 scholarship eligibility text does not lead the answer', !(cs[0] && /Minimum CGPA 3\.0/.test(cs[0].text || '')), {});
  ok('R1.4 jurisdiction is Sindh', /Sindh/.test(String(t.jurisdiction || '')), { j: t.jurisdiction });
});

// R2 Sindh scholarship keeps its own record
push('R2 Sindh Indigenous Scholarship selects the scholarship record', async () => {
  const cs = await get('Eligibility conditions for the Sindh HEC Indigenous Scholarship for MS, MPhil and PhD research students');
  const t = top(cs);
  ok('R2.1 top record is sindh_higher_education_laws', t.docId === 'sindh_higher_education_laws', { top: t.docId });
  ok('R2.2 it carries the published CGPA condition', /Minimum CGPA 3\.0/.test(t.text || ''), {});
  ok('R2.3 the establishment register does not answer it', !(t.docId === 'sindh_hec_establishment_criteria'), {});
});

// R3 Hyderabad campus recognition uses the campus register, not navigation chrome
push('R3 Hyderabad recognition selects the HEC campus register', async () => {
  const cs = await get('Is the SZABIST Hyderabad campus listed in the HEC recognized campuses register?');
  const t = top(cs);
  ok('R3.1 top record is hec_recognized_campuses_sindh', t.docId === 'hec_recognized_campuses_sindh', { top: t.docId });
  ok('R3.2 the register names SZABIST with a Hyderabad entry', /SZABIST/i.test(cs.slice(0, 3).map(c => c.text).join(' ')), {});
  ok('R3.3 the leading record is not scraped menu chrome', !/^# ?HEC( HEC)?( Universities|$)/im.test(String(t.text || '').trim()), { lead: String(t.text || '').slice(0, 40) });
  ok('R3.4 register scope limit is stated in the evidence', /does not establish admission rules/i.test(cs.map(c => c.text).join(' ')), {});
});

// R4 Punjab: instruments register, and its own "not student rules" limit travels with it
push('R4 Punjab education query selects a Punjab record', async () => {
  const cs = await get('Which laws and policies does the Punjab Higher Education Department publish about transfers and principal selection?');
  const ids = [...new Set(cs.map(c => c.docId))];
  ok('R4.1 a Punjab record leads', /(^|\D)punjab_hed_/.test(ids[0] || '') || ids[0] === 'punjab_hed_instruments', { first: ids[0] });
  ok('R4.2 the record declares it is employee governance, not student rules', /NOT student rules/i.test(cs.map(c => c.text).join(' ')), {});
  ok('R4.3 jurisdiction is Punjab', /Punjab/.test(String(top(cs).jurisdiction || '')), { j: top(cs).jurisdiction });
});

// R5 KP: a notification register must not masquerade as substantive policy
push('R5 KP query selects the QAC notification register', async () => {
  const cs = await get('Has KP QAC issued a notification containing admission guidelines for Associate Degree holders?');
  const t = top(cs);
  ok('R5.1 top record is kp_qac_notifications', t.docId === 'kp_qac_notifications', { top: t.docId });
  ok('R5.2 the register names the dated notice', /Admission Guidelines for Associate Degree Holders/i.test(t.text || ''), {});
  ok('R5.3 the register states the attachment was not retrieved', /was not retrieved/i.test(t.text || ''), {});
});

// R6 Balochistan: homepage record, homepage scope preserved
push('R6 Balochistan query selects the CH&TE record with its scope limit', async () => {
  const cs = await get('How many university students does the Balochistan education department report as enrolled and what scholarships does it list?');
  const t = top(cs);
  ok('R6.1 top record is baloch_chte_student_information', t.docId === 'baloch_chte_student_information', { top: t.docId });
  ok('R6.2 the figure it can support is present', /34,564/.test(cs.slice(0, 2).map(c => c.text).join(' ')), {});
  ok('R6.3 the record denies detailed entitlement', /do NOT state eligibility/i.test(cs.map(c => c.text).join(' ')), {});
});

// R7 Federal: draft vs operative from the federal register
push('R7 Federal draft policy is distinguished from operative policy', async () => {
  const cs = await get('Is the Draft Federal Non-Formal Education Policy 2025 zero draft an operative policy?');
  const t = top(cs);
  ok('R7.1 a federal record leads', t.docId === 'federal_mofept_policies', { top: t.docId });
  ok('R7.2 the evidence holds the zero draft entry', /Zero Draft/i.test(cs.map(c => c.text).join(' ')), {});
  ok('R7.3 the evidence states a draft is not operative', /A draft policy is not operative policy/i.test(cs.map(c => c.text).join(' ')), {});
  ok('R7.4 Constitution Article 36 does not answer it', !(cs[0] && /Article 36/.test(cs[0].text || '')), {});
});

// R8 GB: listed categories are not seats, eligibility or an open window
push('R8 GB nomination query selects the GB register with its limit', async () => {
  const cs = await get('Which nomination categories does the Gilgit-Baltistan Directorate of Education Colleges publish for medical and engineering seats?');
  const t = top(cs);
  ok('R8.1 top record is gb_doecgb_nominations', t.docId === 'gb_doecgb_nominations', { top: t.docId });
  ok('R8.2 category names are in the evidence', /MEDICAL/i.test(t.text || '') && /ENGINEERING/i.test(t.text || ''), {});
  ok('R8.3 the evidence denies seats, criteria and an open window', /does NOT establish seat numbers/i.test(t.text || ''), {});
});

// R9 AJK: no verified AJK education record — nothing may be substituted
push('R9 AJK deadline question receives no substituted regional rule', async () => {
  const cs = await get('What domicile condition and application deadline does AJK apply to higher education scholarships?');
  const ids = [...new Set(cs.map(c => c.docId))];
  ok('R9.1 no other province education record is substituted', !ids.some(d => PROV.includes(d)), { ids });
  ok('R9.2 no evidence chunk states an AJK scholarship deadline', !/AJK[^.]{0,80}deadline/i.test(cs.map(c => c.text).join(' ')), {});
});

// R10 national HEC control: national policy still wins
push('R10 national HEC harassment question keeps the national policy record', async () => {
  const cs = await get('What is the HEC policy on harassment complaints against a university employee?');
  const ids = [...new Set(cs.map(c => c.docId))];
  ok('R10.1 hec_harassment_policy leads', ids[0] === 'hec_harassment_policy', { first: ids[0] });
  ok('R10.2 no province-only record displaces it', !ids.slice(0, 3).some(d => PROV.includes(d)), { ids });
});

// R11 GCU institution-specific evidence preserved.
// Re-pinned 2026-10-18: the old list (gcuh_institutional_rules,
// gcuh_admissions_fees_examinations_rules) was written before the GCUH
// Undergraduate Admission Policy 2026-27 entered the corpus, and
// gcuh_institutional_rules is not refund evidence — its own fee notification
// states "What this notification does not contain: no fee-refund terms".
// The assertions now check the metadata the retrieval path really returns,
// which is stricter than matching a hard-coded doc-id.
push('R11 GCU question is answered from GCU Hyderabad instruments', async () => {
  const cs = await get('GCU Hyderabad fee refund after withdrawal from admission');
  const t = cs[0] || {};
  ok('R11.1 a GCU Hyderabad instrument leads', String(t.docId || '').startsWith('gcuh_'), { first: t.docId });
  ok('R11.2 the lead is scoped to GCU Hyderabad with its own authority and URL',
    /GCU Hyderabad, institution-specific/i.test(String(t.jurisdiction || ''))
    && /Government College University Hyderabad/i.test(String(t.issuingAuthority || ''))
    && /gcuh\.edu\.pk/i.test(String(t.sourceURL || '')),
    { jur: t.jurisdiction, auth: t.issuingAuthority, url: t.sourceURL });
  ok('R11.3 a record stating the cancellation and refund route is in the window',
    cs.some(c => /CANCELLATION.*REFUND|REFUND.*ROUTE/i.test(`${c.key} ${c.chunkTitle || ''}`)),
    { keys: cs.map(c => c.key).join(',') });
});

// R12 unrelated civic question is not contaminated by regional education sources
push('R12 civic land-registry question carries no education sources', async () => {
  const cs = await get('How do I obtain a certified copy of a land registry record in Lahore?');
  const ids = [...new Set(cs.map(c => c.docId))];
  const EDU = [...PROV, 'gcuh_institutional_rules', 'edu_admissions_fees', 'edu_scholarships', 'hec_harassment_policy'];
  ok('R12.1 no regional or national education record appears', !ids.some(d => EDU.includes(d)), { ids });
});

// R13 GATE: the unsupported AJK education rule question must be refused,
// not answered from an unrelated national civic record.
push('R13 gate refuses the unsupported AJK education rule question', async () => {
  const q = 'What domicile condition and application deadline does AJK apply to higher education scholarships?';
  const { ev } = await gate(q);
  ok('R13.1 verdict is none', ev.verdict === 'none', { verdict: ev.verdict, reasons: ev.reasons });
  ok('R13.2 reasons include jurisdiction_evidence_gap',
    ev.reasons.includes('jurisdiction_evidence_gap'), { reasons: ev.reasons });
});

// R14 CONTROL: a civic procedural question with no education rule attribute
// must still be accepted from the record that genuinely applies to it.
push('R14 gate still accepts the civic procedural domicile question', async () => {
  const q = 'What documents do I need and where do I apply to get a domicile certificate?';
  const { ev } = await gate(q);
  ok('R14.1 verdict is not none', ev.verdict !== 'none', { verdict: ev.verdict, reasons: ev.reasons });
});

// R15 CONTROL: an education rule question whose record really names that
// region stays accepted — the guard is a coverage test, not a regional ban.
push('R15 gate accepts a regional education rule question the corpus covers', async () => {
  const q = 'Which nomination categories does the Gilgit-Baltistan Directorate of Education Colleges publish for medical and engineering seats?';
  const { ev } = await gate(q);
  ok('R15.1 verdict is not none', ev.verdict !== 'none', { verdict: ev.verdict, reasons: ev.reasons });
});

for (const [label, fn] of cases) { console.log('--- ' + label); await fn(); }
console.log(`\nJURISDICTION RETRIEVAL SUITE: PASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
