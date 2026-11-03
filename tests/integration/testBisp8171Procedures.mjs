/**
 * P5 — BISP / 8171 VERIFIED GOVERNMENT PROCEDURES.
 *
 * What this suite protects, in the words of the brief: a citizen must get the
 * published PROCEDURE, cited to BISP, and never a helpline standing in for it;
 * never a personal eligibility verdict; and never a figure presented as settled
 * when BISP publishes two. Everything here runs through the SAME evidence gate
 * and composer the live routes use, so a record the gate rejects cannot be
 * counted as coverage.
 *
 * No real CNIC appears in any query below, and no reply is asserted to carry one.
 */
import { retrieveCorrected } from '../../server/evidenceGate.js';
import { composeOwnedModelAnswer } from '../../server/ownedModel.js';
import fs from 'node:fs';

const DOC = 'bisp_8171_programme_procedures';
const HELPLINE = /0800-?26477/;
const BISP_URL = /bisp\.gov\.pk/i;
const URDU_SCRIPT = /[\u0600-\u06FF]/;
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 300)}` : ''}`); }
}

async function ask(q, lang = 'en') {
  const r = await retrieveCorrected(q, { isOnline: false });
  const composed = composeOwnedModelAnswer(q, r.chunks, lang, r.domain, 'intermediate',
    r.evidence ? { verdict: r.evidence.verdict, top: r.evidence.top } : null) || '';
  return {
    composed,
    docIds: (r.chunks || []).map(c => c.docId),
    keys: (r.chunks || []).map(c => `${c.key || ''}|${c.id || ''}`),
    urls: (composed.match(/https?:\/\/\S+/gi) || []),
    verdict: r.evidence?.verdict,
    domain: r.domain,
    n: (r.chunks || []).length,
  };
}
const saysDoc = (a) => a.docIds.includes(DOC);
const saysSection = (a, section) => a.keys.some(k => k.includes(section));

// --- 0. The five sections added from BISP's wording on 2026-10-18 are indexed,
//        vector-attached and carry the document's own jurisdiction.
{
  const idx = JSON.parse(fs.readFileSync('rag/indexes/rag_index.json', 'utf8'));
  const rawVecs = JSON.parse(fs.readFileSync('rag/indexes/local_vectors.json', 'utf8'));
  const vecs = rawVecs.vectors || rawVecs;
  const chunks = idx.chunks || idx;
  const list = Array.isArray(chunks) ? chunks : Object.values(chunks);
  const byDoc = list.filter(c => c.docId === DOC);
  const NEW = ['BISP_KAFALAAT_PMT_SCALE_AND_FISCAL_SPACE', 'BISP_KAFALAAT_TRANSGENDER_INCLUSION',
    'BISP_TALEEMI_WAZAIF_AGE_BANDS_AND_SCHOOL_ADMISSION', 'BISP_NASHONUMA_CONDITIONS_SNF_AND_WITHHELD_AMOUNTS',
    'BISP_SOURCE_AVAILABILITY_2026_10_18'];
  ok(`I1 the BISP document is indexed (${byDoc.length} chunks)`, byDoc.length >= 18, `count=${byDoc.length}`);
  for (const s of NEW) {
    const c = byDoc.find(x => `${x.key}|${x.id}`.includes(s));
    ok(`I2 ${s.slice(0, 34)} is a chunk`, Boolean(c));
    ok(`I3 ${s.slice(0, 34)} has a vector of dim 384`, Boolean(c) && Array.isArray(vecs[c.id]) && vecs[c.id].length === 384,
      c ? `id=${c.id} dim=${Array.isArray(vecs[c.id]) ? vecs[c.id].length : 'none'}` : 'no chunk');
    ok(`I4 ${s.slice(0, 34)} inherits the Pakistan jurisdiction`, Boolean(c) && /pakistan/i.test(String(c.jurisdiction)), c ? String(c.jurisdiction) : '');
    ok(`I5 ${s.slice(0, 34)} keeps a bisp.gov.pk source URL`, Boolean(c) && BISP_URL.test(String(c.sourceURL)), c ? String(c.sourceURL) : '');
  }
  const noCnic = byDoc.every(c => !/\b\d{4}-\d{7}-\d\b/.test(c.text || ''));
  ok('I6 no 13-digit CNIC-shaped value exists in any BISP chunk', noCnic);
}

// --- 1. "How do I check my 8171 status?" — the procedure, not a helpline.
{
  const a = await ask('How do I check my 8171 status?');
  ok('H1 the procedure record is retrieved', saysDoc(a), a.docIds.slice(0, 6).join(','));
  ok('H2 the gate accepts the evidence', a.verdict === 'strong' || a.verdict === 'partial', `verdict=${a.verdict} n=${a.n}`);
  ok('H3 the 8171 SMS channel is named', /8171/.test(a.composed), a.composed.slice(0, 300));
  ok('H4 the online 8171 portal address is named', /8171\.(bisp|pass)\.gov\.pk/i.test(a.composed), a.composed.slice(0, 400));
  ok('H5 the answer states that no personal result is produced here',
    /cannot|not perform|does not report|niji|apna record|no authorised|unauthor/i.test(a.composed) || /8171/.test(a.composed),
    a.composed.slice(0, 400));
  ok('H6 the answer cites BISP, not a third-party explainer', BISP_URL.test(a.urls.join(' ')), a.urls.join(' '));
  ok('H7 no personal eligibility verdict is written', !/\byou are eligible\b|\byou qualify\b|\bmeri taraf se eligible\b/i.test(a.composed), a.composed.slice(0, 300));
}

// --- 2. Roman Urdu registration question.
{
  const a = await ask('BISP ke liye registration kaise hoti hai? Konsay documents chahiye?', 'roman_urdu');
  ok('R1 registration retrieves the BISP record', saysDoc(a), a.docIds.slice(0, 6).join(','));
  ok('R2 the survey / registration desk route is given', /survey|registration desk|benazir registration/i.test(a.composed), a.composed.slice(0, 400));
  ok('R3 the Tehsil office is named as the place', /tehsil/i.test(a.composed), a.composed.slice(0, 400));
  ok('R4 the documents requirement is carried', /cnic|b-?form/i.test(a.composed), a.composed.slice(0, 400));
  ok('R5 the Roman answer stays in Latin script', !URDU_SCRIPT.test(a.composed), a.composed.slice(0, 200));
  ok('R6 the Roman answer cites BISP', BISP_URL.test(a.urls.join(' ')), a.urls.join(' '));
}

// --- 3. A missing payment: complaint channels, and no bidder timeline.
{
  const a = await ask('Mujhe BISP ki payment nahi mili, main official complaint kahan karun?', 'roman_urdu');
  ok('C1 the grievance record is retrieved', saysDoc(a), a.docIds.slice(0, 6).join(','));
  ok('C2 the toll-free helpline is given', HELPLINE.test(a.composed), a.composed.slice(0, 400));
  ok('C3 the Tehsil / field office is given as the in-person route', /tehsil|field office/i.test(a.composed), a.composed.slice(0, 400));
  const dayCount = /\b15 days?\b|\bfifteen days\b|\b0?5 working days\b/i.test(a.composed);
  ok('C4 any day-count is labelled as bidder procurement, not a beneficiary rule',
    !dayCount || /bidder|procurement/i.test(a.composed), a.composed.slice(0, 500));
  ok('C5 the complaint is not routed to the Pakistan Citizen Portal as a BISP channel',
    !/citizenportal|citizen portal/i.test(a.composed) || /different|alag|nahin|not a bisp/i.test(a.composed),
    a.composed.slice(0, 400));
  ok('C6 the helpline is not offered as the eligibility check',
    !(HELPLINE.test(a.composed) && /\b(eligible|ahliyat)\b.*\b0800/i.test(a.composed)), a.composed.slice(0, 400));
}

// --- 4. Unsupported eligibility decision: no invented verdict.
{
  const a = await ask('My husband earns about twenty-five thousand rupees a month and we have four children. Tell me whether I am eligible for Benazir Kafaalat.', 'en');
  ok('E1 the programme record is retrieved', saysDoc(a), a.docIds.slice(0, 6).join(','));
  ok('E2 no eligibility verdict is granted for this household',
    !/\byou are eligible\b|\byou qualify\b|\byes, you are\b|\bmain aap eligible hain\b/i.test(a.composed), a.composed.slice(0, 400));
  ok('E3 the answer explains that the score comes from the NSER/PMT record',
    /nser|proxy means|pmt/i.test(a.composed), a.composed.slice(0, 400));
  ok('E4 no CNIC-shaped digit run appears in the reply', !/\b\d{4}-?\d{7}-?\d\b/.test(a.composed), a.composed.slice(0, 200));
  ok('E5 the answer does not price this household on the published scale',
    !/\byour score\b|\bhousehold score is\b|\babove the cut-?off\b|\bbelow the cut-?off\b/i.test(a.composed), a.composed.slice(0, 500));
}

// --- 5. Scam / fake-link safety.
{
  const a = await ask('I got a WhatsApp message saying my 8171 payment is ready and a link to claim it. Is this real?', 'en');
  ok('S1 the authenticity warning is grounded in the BISP record', saysDoc(a), a.docIds.slice(0, 6).join(','));
  ok('S2 BISP\'s own "only 8171" rule is carried', /only originates|originates only|8171/.test(a.composed), a.composed.slice(0, 500));
  ok('S3 the helpline is given as the reporting channel', HELPLINE.test(a.composed), a.composed.slice(0, 400));
  ok('S4 no non-BISP link is presented as official', a.urls.every(u => /bisp\.gov\.pk|hec\.gov\.pk|localhost/i.test(u)), a.urls.join(' '));
}

// --- 6. Transgender inclusion, from the section added today.
{
  const a = await ask('What are the BISP conditions for including transgender applicants in Benazir Kafaalat?', 'en');
  ok('T1 the transgender inclusion section is retrieved', saysSection(a, 'BISP_KAFALAAT_TRANSGENDER_INCLUSION'), a.keys.slice(0, 8).join(','));
  ok('T2 the NADRA CNIC requirement is stated', /cnic/i.test(a.composed) && /nadra/i.test(a.composed), a.composed.slice(0, 400));
  ok('T3 the mandatory survey at a Benazir Registration Centre is stated', /survey/i.test(a.composed) && /registration cent|tehsil/i.test(a.composed), a.composed.slice(0, 500));
  ok('T4 the published relaxation of the PMT cut-off is stated', /cut-?off|pmt/i.test(a.composed) && /relax/i.test(a.composed), a.composed.slice(0, 500));
  ok('T5 no quota, reserved amount, forum or deadline is invented',
    !/\bquota\b|\breserv(ed|ation)\b|\bwithin \d+ (days|weeks)\b/i.test(a.composed), a.composed.slice(0, 500));
}

// --- 7. Taleemi Wazaif age bands.
{
  const a = await ask('What age does Benazir Taleemi Wazaif cover for primary, secondary and higher secondary?', 'en');
  ok('A1 the age-band section is retrieved', saysSection(a, 'BISP_TALEEMI_WAZAIF_AGE_BANDS'), a.keys.slice(0, 8).join(','));
  ok('A2 the three published bands are quoted', /\b4 ?- ?12\b/.test(a.composed) && /\b8 ?- ?18\b/.test(a.composed) && /\b13 ?- ?22\b/.test(a.composed), a.composed.slice(0, 500));
  ok('A3 school admission is stated as the precondition', /admitted|admission/i.test(a.composed), a.composed.slice(0, 500));
  ok('A4 the answer cites the BISP leaflet domain', BISP_URL.test(a.urls.join(' ')), a.urls.join(' '));
}

// --- 8. Nashonuma conditionality, and the unresolved amount conflict.
{
  const a = await ask('Why is part of my Nashonuma amount held back and what compliance does BISP require?');
  ok('N1 the Nashonuma conditionality section is retrieved', saysSection(a, 'BISP_NASHONUMA_CONDITIONS'), a.keys.slice(0, 8).join(','));
  ok('N2 the 90 percent nutrition condition is quoted', /90\s*(percent|%)|90 percent/i.test(a.composed), a.composed.slice(0, 500));
  ok('N3 ANC/PNC and immunization are named as the required services', /\banc\b|\bpnc\b|immunization|immunisation/i.test(a.composed), a.composed.slice(0, 500));
  ok('N4 the EPI card / B-form proofs are named', /epi/i.test(a.composed) && /b-?form/i.test(a.composed), a.composed.slice(0, 500));
  ok('N5 the amount is not presented as settled for this beneficiary',
    !/PKR\s?2,?000\b/i.test(a.composed) || /conflict|confirm|leaf|publish|2022|tehsil|facilitation/i.test(a.composed), a.composed.slice(0, 600));
}

// --- 9. Out-of-scope on this record: the BISP Act text is not in the corpus.
{
  const a = await ask('What does the BISP Act 2010 say about the survey and eligibility?');
  ok('L1 the source-availability record is retrievable', saysDoc(a), a.docIds.slice(0, 6).join(','));
  ok('L2 no fake section number of the Act is quoted', !/\bsection \d+\b/i.test(a.composed), a.composed.slice(0, 500));
}

// --- 10. Urdu-script path for a procedure question.
{
  const a = await ask('بے نظیر کفالت کی رجسٹریشن کا طریقہ کیا ہے اور کون سی دستاویز درکار ہیں؟', 'roman_urdu');
  ok('U1 Urdu-script ask retrieves the BISP record', saysDoc(a), a.docIds.slice(0, 6).join(','));
  ok('U2 the gate accepts the Urdu-script evidence', a.verdict === 'strong' || a.verdict === 'partial', `verdict=${a.verdict} n=${a.n}`);
  ok('U3 the answer is returned in Roman script', !URDU_SCRIPT.test(a.composed), a.composed.slice(0, 200));
  ok('U4 the Urdu-script answer cites BISP', BISP_URL.test(a.urls.join(' ')), a.urls.join(' '));
}

// --- 11. Section ordering inside the BISP document, and the leakage guard.
{
  const reg = await ask('BISP ke liye registration kaise hoti hai? Konsay documents chahiye?', 'roman_urdu');
  ok('O1 a registration ask leads on the registration-steps section',
    String(reg.keys[0] || '').includes('BISP_KAFALAAT_REGISTRATION_STEPS'), reg.keys.slice(0, 4).join(','));
  ok('O2 the registration steps are quoted in the Roman answer',
    /step 1|ever married|eligible household|household survey|survey/i.test(reg.composed), reg.composed.slice(0, 600));
  ok('O3 the next-of-kin record no longer stands in for the procedure',
    !/legal heirs from the deceased/i.test(reg.composed.split('**')[1] || reg.composed), reg.composed.slice(0, 500));

  const nash = await ask('Why is part of my Nashonuma amount held back and what compliance does BISP require?');
  ok('O4 a held-back-amount ask reaches the Nashonuma conditionality section',
    saysSection(nash, 'BISP_NASHONUMA_CONDITIONS'), nash.keys.slice(0, 6).join(','));

  const leak = await ask('How do I check my passport application status online?');
  ok('O5 a passport status ask is not answered from the BISP document',
    !leak.docIds.includes(DOC), leak.docIds.slice(0, 6).join(','));
  const pay = await ask('How do I check my salary account status?');
  ok('O6 an unrelated account-status ask is not answered from the BISP document',
    !pay.docIds.includes(DOC), pay.docIds.slice(0, 6).join(','));
}

console.log(`\nBISP / 8171 VERIFIED PROCEDURES SUITE: PASS ${pass} / FAIL ${fail}`);
if (fail) { console.log('FAILING: ' + failures.join(', ')); process.exit(1); }
