/**
 * EDUCATION LAW ingestion acceptance: the newly indexed official Sindh HEC and
 * GCU Hyderabad records must actually be retrievable and citable, and a record
 * from one jurisdiction must never be cited as the authority for another.
 * Retrieval runs in-process (no HTTP, no rate limit); every claim is read back
 * out of the real composed answer.
 */
import { RAGEngine } from '../../server/ragEngine.js';
import { composeOwnedModelAnswer } from '../../server/ownedModel.js';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 320)}` : ''}`); }
}

async function answer(q, lang = 'en') {
  const r = await RAGEngine.retrieve(q);
  const composed = composeOwnedModelAnswer(q, r.chunks, lang, r.domain, 'intermediate', null);
  return {
    composed: composed || '',
    docIds: (r.chunks || []).map(c => c.docId),
    urls: (composed.match(/https?:\/\/\S+/gi) || []),
    domain: r.domain,
    n: (r.chunks || []).length
  };
}

/** The composer's direct answer block — the lead the citizen actually reads first. */
function leadOf(composed) {
  return sectionOf(composed, 'Answer');
}

/** Any composer block, by heading. */
function sectionOf(composed, heading) {
  const m = new RegExp(`\\*\\*${heading}\\*\\*\\s*\\n+([\\s\\S]*?)(?=\\n\\s*\\*\\*|\\s*$)`, 'i').exec(composed || '');
  return (m ? m[1] : '').trim();
}

// --- 1. Sindh HEC rules/regulations register is retrievable --------------------
{
  const q = 'What rules and regulations has the Sindh Higher Education Commission published?';
  const a = await answer(q);
  ok('S1 Sindh HEC query returned records', a.n > 0, `chunks=${a.n}`);
  ok('S2 Sindh HEC official record is in the retrieved set', a.docIds.includes('sindh_higher_education_laws'), a.docIds.slice(0, 8).join(','));
  ok('S3 answer names the Sindh Higher Education Commission', /sindh higher education commission/i.test(a.composed), a.composed.slice(0, 200));
  ok('S4 answer cites the official Sindh HEC site', /sindhhec\.gov\.pk/i.test(a.composed), a.urls.join(' '));
  ok('S5 answer carries a Source section', /\*\*Source\*\*/i.test(a.composed), a.composed.slice(-300));
  // Answer focus: a rules question is answered from the rules register, not from
  // the scholarship criteria sitting in the same corpus file.
  const lead = leadOf(a.composed);
  ok('S6 direct answer leads with rules/Act content',
    /recruitment rules|financial rules|act 2013|office circular/i.test(lead), lead.slice(0, 300));
  ok('S7 direct answer does not lead with scholarship eligibility text',
    !/cgpa|indigenous scholarship/i.test(lead), lead.slice(0, 300));
  const firstRuleSource = (a.composed.match(/- [^\n]*: https?:\/\/\S+/i) || [''])[0];
  ok('S8 primary citation is the Sindh HEC rules/regulation page',
    /rules-regulation/i.test(firstRuleSource), firstRuleSource);
  const says = sectionOf(a.composed, 'What the law says');
  ok('S9 supporting section carries no unrelated scholarship criterion',
    !/cgpa|indigenous scholarship/i.test(says), says.slice(0, 300));
  ok('S10 supporting section is still rules/Act content',
    /rules|regulation|act 2013|circular|commission/i.test(says), says.slice(0, 300));
  ok('S11 supporting citations were not stripped', (a.urls || []).length >= 2, a.urls.join(' '));
  // Procedure evidence: the rules register publishes instruments, it does not
  // describe an application process. Steps must therefore be rules-grounded or
  // absent — never borrowed from a sibling topic or another jurisdiction.
  const proc = sectionOf(a.composed, 'What to do / procedure');
  ok('S12 procedure section carries no scholarship/CGPA steps',
    !/cgpa|scholarship|3\.0/i.test(proc), proc.slice(0, 300));
  ok('S13 procedure section carries no out-of-jurisdiction disciplinary steps',
    !/right to notice|show-cause notice|rustication/i.test(proc), proc.slice(0, 300));
}

// --- 2. Sindh scholarship criteria come from the indexed record ----------------
{
  const q = 'Sindh Indigenous Scholarship eligibility criteria for MS and PhD students';
  const a = await answer(q);
  ok('H1 Sindh scholarship query returned records', a.n > 0, `chunks=${a.n}`);
  ok('H2 retrieval surfaced the Sindh scholarship record', a.docIds.includes('sindh_higher_education_laws'), a.docIds.slice(0, 8).join(','));
  // 3.0 CGPA is the figure printed on the official Sindh HEC page; the answer may
  // only state it because the record is in the corpus.
  ok('H3 answer states the official CGPA condition verbatim', /3\.0/.test(a.composed), a.composed.slice(0, 400));
  ok('H7 direct answer lead is the scholarship criteria', /cgpa/i.test(leadOf(a.composed)), leadOf(a.composed).slice(0, 300));
  ok('H8 supporting section keeps scholarship content',
    /cgpa|3\.0|scholarship/i.test(sectionOf(a.composed, 'What the law says')),
    sectionOf(a.composed, 'What the law says').slice(0, 300));
  ok('H9 scholarship answer kept its supporting citations', (a.urls || []).length >= 2, a.urls.join(' '));
  // Layered jurisdiction, not a ban on mentioning HEC: the Sindh record must be
  // the primary cited authority, the Sindh-specific condition must be presented
  // as Sindh law, and a national record may only appear as the Pakistan-wide layer.
  const firstSource = (a.composed.match(/- [^\n]*: https?:\/\/\S+/i) || [''])[0];
  ok('H4 primary citation is the Sindh HEC page', /sindhhec\.gov\.pk/i.test(firstSource), firstSource);
  ok('H5 Sindh condition is labelled as Sindh law', /under sindh law/i.test(a.composed), a.composed.slice(0, 300));
  ok('H6 any national record is labelled Pakistan-wide, never Sindh',
    !/under sindh law[^\n]*hec\.gov\.pk/i.test(a.composed) && /pakistan-wide legal position/i.test(a.composed), a.composed.slice(0, 600));
}

// --- 3. GCU Hyderabad is institution-specific ----------------------------------
{
  const q = 'Government College University Hyderabad overview';
  const a = await answer(q);
  ok('G1 GCUH query returned records', a.n > 0, `chunks=${a.n}`);
  ok('G2 retrieval surfaced the GCUH record', a.docIds.includes('gcuh_institutional_rules'), a.docIds.slice(0, 8).join(','));
  ok('G3 answer cites the official GCU Hyderabad site', /gcuh\.edu\.pk/i.test(a.composed), a.urls.join(' '));
}

// --- 4. Province isolation: a Sindh record must not answer a Punjab question ----
{
  const q = 'Punjab university fee refund after withdrawal of admission';
  const a = await answer(q);
  ok('P1 Punjab query returned records', a.n > 0, `chunks=${a.n}`);
  ok('P2 Sindh HEC record is not the primary Punjab authority', a.docIds[0] !== 'sindh_higher_education_laws', a.docIds.slice(0, 4).join(','));
  ok('P3 no Sindh HEC URL is cited for a Punjab question', !/sindhhec\.gov\.pk/i.test(a.composed), a.urls.join(' '));
  ok('P4 direct answer lead is not the Sindh record', !/under sindh law/i.test(leadOf(a.composed)), leadOf(a.composed).slice(0, 300));
}

// --- 5. National HEC policy stays a separate layer from provincial law ----------
{
  const q = 'HEC fee refund policy timeline for universities';
  const a = await answer(q);
  ok('N1 HEC refund query returned records', a.n > 0, `chunks=${a.n}`);
  ok('N2 a HEC policy record was retrieved', a.docIds.some((d) => /^hec_/.test(d)), a.docIds.slice(0, 6).join(','));
  ok('N3 answer cites hec.gov.pk', /hec\.gov\.pk/i.test(a.composed), a.urls.join(' '));
}

// --- 6. No content, no claim: an un-ingested jurisdiction must not be fabricated
{
  const q = 'Balochistan Higher Education Department hostel rules for female students';
  const a = await answer(q);
  ok('B1 un-ingested Balochistan education rule is not attributed to a Sindh source',
    !/sindhhec\.gov\.pk/i.test(a.composed), a.urls.join(' '));
  ok('B2 domain was still routed (no crash on thin corpus)', typeof a.domain === 'string' && a.domain.length > 0, a.domain);
}

// --- 7. GCU Hyderabad's own published rules (ingested 2026-10-16) ----------------
{
  const q = 'What is the weightage of the Pre-Entry Test in GCU Hyderabad admission merit?';
  const a = await answer(q);
  ok('U1 GCUH weightage query returned records', a.n > 0, `chunks=${a.n}`);
  ok('U2 the GCUH rules record is retrieved', a.docIds.includes('gcuh_admissions_fees_examinations_rules'),
    a.docIds.slice(0, 6).join(','));
  ok('U3 answer names the Pre-Entry Test weightage figures', /50%/.test(a.composed) && /pre[- ]?entry/i.test(a.composed),
    leadOf(a.composed).slice(0, 260));
  ok('U4 answer cites the university\'s own site', /gcuh\.edu\.pk/i.test(a.composed), a.urls.join(' '));
  ok('U5 the record is labelled at its own institutional layer',
    /hyderabad/i.test(a.composed), a.composed.slice(0, 300));

  const q2 = 'How do I get a fee refund after cancelling my provisional admission at GCU Hyderabad?';
  const a2 = await answer(q2);
  ok('U6 refund query retrieves the GCUH rules record',
    a2.docIds.includes('gcuh_admissions_fees_examinations_rules'), a2.docIds.slice(0, 6).join(','));
  ok('U7 refund answer names the GCUH application route',
    /director admissions/i.test(a2.composed) && /head of department/i.test(a2.composed),
    sectionOf(a2.composed, 'What to do / procedure').slice(0, 300));
  ok('U8 refund answer ties the amount to the HEC refund policy, not an invented slab',
    /hec fee refund policy/i.test(a2.composed), a2.composed.slice(0, 300));

  const q3 = 'GCU Hyderabad minimum attendance required to appear in examinations';
  const a3 = await answer(q3);
  ok('U9 attendance rule comes from the GCUH record',
    a3.docIds.includes('gcuh_admissions_fees_examinations_rules'), a3.docIds.slice(0, 6).join(','));
  ok('U10 the published 75% figure is quoted', /75%/.test(a3.composed), leadOf(a3.composed).slice(0, 260));

  const q4 = 'Who sits on the GCU Hyderabad inquiry committee for harassment complaints?';
  const a4 = await answer(q4);
  ok('U11 harassment query reaches the GCUH notification record',
    a4.docIds.includes('gcuh_admissions_fees_examinations_rules'), a4.docIds.slice(0, 6).join(','));
  ok('U12 answer names the statutory basis of the committee',
    /gcu hyderabad act 2018|section 14\(3\)/i.test(a4.composed), sectionOf(a4.composed, 'What the law says').slice(0, 300));
}

// --- 8. Institution isolation and the published-gap rule --------------------------
{
  const q = 'What is the merit for admission at Government College University Lahore?';
  const a = await answer(q);
  ok('X1 a Lahore question is not answered from GCU Hyderabad\'s URL',
    !/gcuh\.edu\.pk/i.test(a.composed), a.urls.join(' '));
  ok('X2 the GCUH institution record is not the primary Lahore authority',
    a.docIds[0] !== 'gcuh_admissions_fees_examinations_rules', a.docIds.slice(0, 5).join(','));

  const q2 = 'How do I apply for re-checking of results at GCU Hyderabad and what is the fee?';
  const a2 = await answer(q2);
  const says2 = `${leadOf(a2.composed)} ${sectionOf(a2.composed, 'What the law says')}`;
  ok('X3 the unpublished GCUH re-checking rule is not given an invented fee',
    !/re[- ]?check\w*[^.\n]{0,60}Rs\.?\s?\d/i.test(a2.composed), says2.slice(0, 300));
  ok('X4 the answer routes the gap to the office that exists',
    /controller of examinations/i.test(a2.composed), a2.composed.slice(0, 400));
}

console.log(`\nEDUCATION JURISDICTION SUITE: PASS ${pass} / FAIL ${fail}`);
if (fail) { console.log('FAILING: ' + failures.join(', ')); process.exit(1); }
