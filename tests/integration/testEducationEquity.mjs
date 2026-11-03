// Education Equity integration suite — Priority 5.
// Asserts on real indexed docIds and the text actually stored in the index,
// plus the evidence-gate verdict, over the configured retrieval path.
import { RAGEngine } from '../../server/ragEngine.js';
import { evaluateEvidence } from '../../server/evidenceGate.js';

const EQ = ['hec_disability_policy', 'hec_need_based_scholarship', 'pbm_education_assistance', 'navttc_act_and_candidate_routes'];
let pass = 0, fail = 0;
const ok = (l, c, e = {}) => { c ? (pass++, console.log('PASS ', l)) : (fail++, console.log('FAIL ', l, '::', JSON.stringify(e))); };
const get = async q => { const r = await RAGEngine.retrieve(q); return r.chunks || []; };
const gate = async q => { const r = await RAGEngine.retrieve(q); return { cs: r.chunks || [], ev: evaluateEvidence(q, r) }; };
const top = cs => cs[0] || {};
const all = cs => cs.map(c => c.text || '').join(' ');
const cases = [];
const push = (label, fn) => cases.push([label, fn]);

push('E1 disability question selects the HEC disability policy record', async () => {
  const cs = await get('What does the HEC policy for students with disabilities say about equal opportunities in higher education?');
  const t = top(cs);
  ok('E1.1 top record is hec_disability_policy', t.docId === 'hec_disability_policy', { top: t.docId });
  ok('E2.2 the policy commitment text is the indexed text', /equal opportunities of higher education for students with disabilities/i.test(t.text || ''), {});
});

push('E2 HEC NBS eligibility selects the NBS record with its published figures', async () => {
  const cs = await get('What are the eligibility criteria and monthly stipend for the HEC Need-Based Scholarship?');
  const t = top(cs);
  ok('E2.1 top record is hec_need_based_scholarship', t.docId === 'hec_need_based_scholarship', { top: t.docId });
  ok('E2.2 the Rs.6000 stipend is in the evidence', /Rs\.6000/.test(all(cs)), {});
  ok('E2.3 the self-finance exclusion is in the evidence', /self-finance are not eligible/i.test(all(cs)), {});
});

push('E3 HEC NBS application route comes from the NBS record, not a generic scholarship digest', async () => {
  const cs = await get('How do I apply for the HEC Need-Based Scholarship and does HEC accept the form directly?');
  const t = top(cs);
  ok('E3.1 top record is hec_need_based_scholarship', t.docId === 'hec_need_based_scholarship', { top: t.docId });
  ok('E3.2 the Financial Aid Office route is stated', /Financial Aid Office/i.test(all(cs)), {});
  ok('E3.3 the evidence states HEC does not accept applications directly', /HEC will not accept any application form directly/i.test(all(cs)), {});
});

push('E4 PBM education-assistance question selects the PBM record', async () => {
  const cs = await get('What education assistance does Pakistan Bait-ul-Mal give to poor students and which institutions qualify?');
  const t = top(cs);
  ok('E4.1 top record is pbm_education_assistance', t.docId === 'pbm_education_assistance', { top: t.docId });
  ok('E4.2 the eligible institution list is verbatim', /Government schools, colleges, universities/i.test(all(cs)), {});
  ok('E4.3 the required documents are stated', /Bonafide certificate from Head of Institution/i.test(all(cs)), {});
});

push('E5 PBM record keeps the General-assistance income ceiling off education assistance', async () => {
  const cs = await get('What is the income limit and stipend amount for PBM education assistance?');
  const txt = all(cs);
  ok('E5.1 the PBM record leads', top(cs).docId === 'pbm_education_assistance', { top: top(cs).docId });
  ok('E5.2 the record attributes Rs.37,000 to IFA General', /monthly income up to Rs\. 37,000/i.test(txt), {});
  ok('E5.3 the record denies applying it to education assistance', /Do not apply the General-assistance income threshold/i.test(txt), {});
  ok('E5.4 the record states education section gives no ceiling', /does NOT state an income ceiling/i.test(txt), {});
});

push('E6 no indexed equity record invents a minority scholarship', async () => {
  const cs = await get('Is there a government scholarship specifically for minority students?');
  const eqHits = cs.filter(c => EQ.includes(c.docId));
  ok('E6.1 equity records do not claim a minority scheme', !eqHits.some(c => /minority scholarship/i.test(c.text || '')), { n: eqHits.length });
  ok('E6.2 a minority scheme query is not answered as an open scheme', !/minority scholarship (is open|applications are open)/i.test(all(cs)), {});
});

push('E7 TVET candidate question selects the NAVTTC record with its scope limit', async () => {
  const cs = await get('How does a candidate apply for NAVTTC technical training and is admission open?');
  const t = top(cs);
  ok('E7.1 top record is navttc_act_and_candidate_routes', t.docId === 'navttc_act_and_candidate_routes', { top: t.docId });
  ok('E7.2 the published candidate route is present', /Apply for Trainings/i.test(t.text || ''), {});
  ok('E7.3 the record denies that a listing is an offer', /not an offer of admission/i.test(all(cs)), {});
});

push('E8 an unsupported rural reserved-seat criterion produces a limitation, not a rule', async () => {
  const { ev } = await gate('What reserved seat quota for rural students from Tharparkar does the agricultural university admission policy publish?');
  ok('E8.1 gate refuses the unestablished quota', ev.verdict === 'none', { verdict: ev.verdict, reasons: ev.reasons });
});

push('E9 NBS versus another scheme does not mix sources', async () => {
  const cs = await get('Is the HEC Need-Based Scholarship the same as the Ehsaas Undergraduate Scholarship?');
  const txt = all(cs);
  ok('E9.1 the NBS record is retrieved', cs.some(c => c.docId === 'hec_need_based_scholarship'), { ids: [...new Set(cs.map(c => c.docId))] });
  ok('E9.2 the record states the schemes are separate', /separate scheme from the Ehsaas/i.test(txt), {});
});

push('E10 ordinary education and legal queries are not contaminated by equity records', async () => {
  const cs = await get('GCU Hyderabad fee refund after withdrawal from admission');
  const ids = [...new Set(cs.map(c => c.docId))];
  ok('E10.1 a GCU Hyderabad instrument still leads', String(ids[0]).startsWith('gcuh_'), { first: ids[0] });
  ok('E10.2 no equity record appears', !ids.some(d => EQ.includes(d)), { ids });
  const cs2 = await get('Can a landlord evict a tenant without a court order?');
  const ids2 = [...new Set(cs2.map(c => c.docId))];
  ok('E10.3 tenancy answer carries no equity record', !ids2.some(d => EQ.includes(d)), { ids: ids2 });
});

for (const [label, fn] of cases) { console.log('--- ' + label); await fn(); }
console.log(`\nEDUCATION EQUITY SUITE: PASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
