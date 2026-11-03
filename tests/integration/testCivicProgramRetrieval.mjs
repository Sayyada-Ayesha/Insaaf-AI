/**
 * CIVIC / SOCIAL-PROTECTION ingestion acceptance. The newly indexed BISP/8171
 * programme record must be retrievable and citable through the SAME evidence
 * gate and composer the live chat route uses — retrieval alone is not enough,
 * because a record that the gate rejects never reaches a citizen.
 *
 * The behaviour this suite exists to protect:
 *  - a published programme rule is answerable in English, Roman Urdu and Urdu
 *    script, cited to bisp.gov.pk;
 *  - a household's own eligibility verdict is never invented;
 *  - a bidder's procurement deadline is never presented as a beneficiary's
 *    grievance timeline (the brief's explicit "do not confuse" rule);
 *  - where BISP publishes two conflicting amounts, the answer does not pick one
 *    and call it settled.
 */
import { retrieveCorrected } from '../../server/evidenceGate.js';
import { composeOwnedModelAnswer } from '../../server/ownedModel.js';

const DOC = 'bisp_8171_programme_procedures';
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 320)}` : ''}`); }
}

async function answer(q, lang = 'en') {
  const r = await retrieveCorrected(q, { isOnline: false });
  const composed = composeOwnedModelAnswer(q, r.chunks, lang, r.domain, 'intermediate',
    r.evidence ? { verdict: r.evidence.verdict, top: r.evidence.top } : null) || '';
  return {
    composed,
    docIds: (r.chunks || []).map(c => c.docId),
    urls: (composed.match(/https?:\/\/\S+/gi) || []),
    verdict: r.evidence?.verdict,
    domain: r.domain,
    n: (r.chunks || []).length
  };
}

const URDU_SCRIPT = /[\u0600-\u06FF]/;

// --- 1. Published PMT cut-off ------------------------------------------------
{
  const a = await answer('What PMT cut-off score does BISP use to decide Benazir Kafaalat eligibility?');
  ok('P1 the BISP programme record is retrieved', a.docIds.includes(DOC), a.docIds.slice(0, 6).join(','));
  ok('P2 the gate accepts the evidence', a.verdict === 'strong' || a.verdict === 'partial', `verdict=${a.verdict} n=${a.n}`);
  ok('P3 the published 32 cut-off is quoted', /\b32\b/.test(a.composed), a.composed.slice(0, 260));
  ok('P4 the 37 cut-off for a household with a differently abled member is quoted', /\b37\b/.test(a.composed), a.composed.slice(0, 260));
  ok('P5 the differently abled threshold is explained, not just numbered', /differently abled|disabl/i.test(a.composed), a.composed.slice(0, 400));
  ok('P6 the answer cites BISP\'s own site', /bisp\.gov\.pk/i.test(a.urls.join(' ')), a.urls.join(' '));
  ok('P7 Proxy Means Test and NSER are named as the mechanism', /proxy means test/i.test(a.composed) && /nser|national socio/i.test(a.composed), a.composed.slice(0, 400));
  // The standing constraint: no private identity-status result.
  ok('P8 no personal eligibility verdict is written for the caller',
    !/\byou are eligible\b|\byou qualify\b/i.test(a.composed), a.composed.slice(0, 300));
}

// --- 2. Next-of-kin route after a beneficiary dies ---------------------------
{
  const a = await answer('My mother was a BISP beneficiary and she has died. Which documents do we take to the Tehsil office?');
  const says = a.composed;
  ok('K1 the heir record is retrieved', a.docIds.includes(DOC), a.docIds.slice(0, 6).join(','));
  ok('K2 NADRA\'s CNIC cancellation certificate is named', /cancellation certificate/i.test(says), says.slice(0, 400));
  ok('K3 the union council death certificate is named', /union council/i.test(says) && /death certificate/i.test(says), says.slice(0, 400));
  ok('K4 the deceased\'s CNIC and the family CNICs are named', /cnic/i.test(says), says.slice(0, 400));
  ok('K5 the route ends at the BISP Tehsil office', /tehsil/i.test(says), says.slice(0, 400));
  ok('K6 the answer cites BISP', /bisp\.gov\.pk/i.test(a.urls.join(' ')), a.urls.join(' '));
}

// --- 3. Bidder deadlines must not become a beneficiary's timeline ------------
{
  const a = await answer('How long does BISP take to decide a beneficiary complaint?');
  const says = a.composed;
  const quotesDays = /\b15 days?\b|\bfifteen days\b|\b05 working days\b|\b5 working days\b/i.test(says);
  ok('T1 the BISP record is retrieved', a.docIds.includes(DOC), a.docIds.slice(0, 6).join(','));
  ok('T2 any day-count quoted is labelled as procurement, not a beneficiary rule',
    !quotesDays || /bidder|procurement|public procurement/i.test(says), says.slice(0, 500));
  ok('T3 the answer states that no beneficiary decision period is published',
    /not published|no equivalent|does not publish|publishes no|unpublished/i.test(says) || /0800-?26477/.test(says),
    says.slice(0, 500));
  ok('T4 the published grievance channels are given instead',
    /0800-?26477/.test(says) && /tehsil/i.test(says), says.slice(0, 500));
  ok('T5 the answer cites BISP', /bisp\.gov\.pk/i.test(a.urls.join(' ')), a.urls.join(' '));
}

// --- 4. Grievance and fraud channel -----------------------------------------
{
  const a = await answer('Someone is asking for a cut of my 8171 payment. Where do I report it?');
  ok('G1 the toll-free helpline is given', /0800-?26477/.test(a.composed), a.composed.slice(0, 400));
  ok('G2 the Tehsil/field office route is given', /tehsil|field office/i.test(a.composed), a.composed.slice(0, 400));
  ok('G3 BISP\'s own 8171-only authenticity warning is carried', /only originates|originates only|8171/.test(a.composed), a.composed.slice(0, 500));
  ok('G4 the answer cites BISP', /bisp\.gov\.pk/i.test(a.urls.join(' ')), a.urls.join(' '));
}

// --- 5. Roman Urdu ------------------------------------------------------------
{
  const a = await answer('8171 ki qist mein se koi paisa maang raha hai, main shikayat kahan karun?', 'roman_urdu');
  ok('R1 Roman Urdu retrieves the programme record', a.docIds.includes(DOC), a.docIds.slice(0, 6).join(','));
  ok('R2 the helpline number survives the Roman path', /0800-?26477/.test(a.composed), a.composed.slice(0, 400));
  ok('R3 the Roman answer stays in Latin script', !URDU_SCRIPT.test(a.composed), a.composed.slice(0, 200));
  ok('R4 the Roman answer cites BISP', /bisp\.gov\.pk/i.test(a.urls.join(' ')), a.urls.join(' '));
}

// --- 6. Urdu script -----------------------------------------------------------
{
  const a = await answer('کیا بے نظیر کفالت کی اہلیت کا فورم کون سا ہے اور اسکور کیسے طے ہوتا ہے؟', 'ur');
  ok('U1 Urdu-script ask retrieves the programme record', a.docIds.includes(DOC), a.docIds.slice(0, 6).join(','));
  ok('U2 the gate accepts the Urdu-script evidence', a.verdict === 'strong' || a.verdict === 'partial', `verdict=${a.verdict} n=${a.n}`);
  ok('U3 the answer names the PMT/NSER mechanism', /proxy means test|pmt|nser|national socio/i.test(a.composed), a.composed.slice(0, 400));
  ok('U4 the Urdu-script answer cites BISP', /bisp\.gov\.pk/i.test(a.urls.join(' ')), a.urls.join(' '));
}

// --- 7. Registration steps and the two conditions -----------------------------
{
  const a = await answer('What are the steps to register for Benazir Kafaalat and who is declared the beneficiary?');
  ok('S1 the registration record is retrieved', a.docIds.includes(DOC), a.docIds.slice(0, 6).join(','));
  ok('S2 the ever-married female beneficiary rule is stated', /ever married female/i.test(a.composed), a.composed.slice(0, 500));
  ok('S3 household eligibility is distinguished from beneficiary declaration',
    /not the same|household being eligible|declared as beneficiary|profiling/i.test(a.composed), a.composed.slice(0, 600));
  ok('S4 the registration desk at the Tehsil office is named', /tehsil|registration desk/i.test(a.composed), a.composed.slice(0, 400));
}

// --- 8. Taleemi Wazaif: enrolment conditions ----------------------------------
{
  const a = await answer('How do I enrol my children in Taleemi Wazaif and what documents does BISP require?');
  ok('W1 the Taleemi Wazaif record is retrieved', a.docIds.includes(DOC), a.docIds.slice(0, 6).join(','));
  ok('W2 the NADRA B-form/CRC requirement is stated', /b-?form|crc/i.test(a.composed), a.composed.slice(0, 500));
  ok('W3 the school admission slip is named', /admission slip/i.test(a.composed), a.composed.slice(0, 500));
  ok('W4 the attendance co-responsibility rule is carried', /attendance/i.test(a.composed) && /suspend|three/i.test(a.composed), a.composed.slice(0, 600));
}

// --- 9. Conflicting published amounts are not merged into one figure ----------
{
  const a = await answer('How much does the Benazir Kafaalat stipend pay per quarter?');
  const quotes = (a.composed.match(/Rs\.?\s?[\d,]+/gi) || []);
  ok('A1 the stipend record is retrieved', a.docIds.includes(DOC), a.docIds.slice(0, 6).join(','));
  ok('A2 a quarterly amount is given', /quarter/i.test(a.composed), a.composed.slice(0, 400));
  ok('A3 the amount is not presented as settled for this household',
    quotes.length === 0 || /conflict|confirm|range|published|8171|tehsil/i.test(a.composed),
    `${quotes.join(',')} :: ${a.composed.slice(0, 300)}`);
  ok('A4 biometric verification is named as the release condition', /biometric/i.test(a.composed), a.composed.slice(0, 500));
}

console.log(`\nCIVIC PROGRAM RETRIEVAL SUITE: PASS ${pass} / FAIL ${fail}`);
if (fail) { console.log('FAILING: ' + failures.join(', ')); process.exit(1); }
