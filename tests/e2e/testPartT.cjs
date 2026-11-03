/*
 * Part T — "Explain This Document" verification.
 * The Drafter's "Explain This Document" button sends a fixed 11-point template to
 * /api/ai/advice. This test asserts the answer is a GROUNDED, structured
 * document-type explanation (verified statutes/forums), is HONEST about fees and
 * deadlines (never invented), is NOT intercepted by the lawyer-directory blurb,
 * is NOT an off-topic RAG keyword dump, supports Roman Urdu, and refuses to guess
 * for an unknown document type. Run: node testPartT.cjs
 */
const BASE = 'http://localhost:3001/api/ai';
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name}`); } }

function explainQuery(docName) {
  return `Explain the Pakistani legal document type: "${docName}".
Answer strictly in this numbered order:
1. What this document is
2. What it is used for
3. Who receives it / who it is addressed or submitted to
4. Where it should be submitted or filed
5. What supporting documents/evidence may be relevant
6. What the next procedural step is after this document
7. What the person should do after submission
8. Possible fees — ONLY if genuinely verified; otherwise state clearly that fees are not verified and vary by office
9. Whether a lawyer is advisable
10. Important deadlines or limitation periods — ONLY if verified; otherwise state they are not verified
11. Best-practice checklist before submission
IMPORTANT: Do NOT invent fees, deadlines, authorities, or mandatory documents.`;
}

async function explain(docName, preferredLanguage = 'en') {
  const r = await fetch(`${BASE}/advice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: explainQuery(docName), preferredLanguage })
  });
  const j = await r.json();
  return j.text || '';
}

// All 11 numbered point labels that must appear, in order.
const POINT_LABELS = [
  '1. What this document is',
  '2. What it is used for',
  '3. Who receives it',
  '4. Where it should be submitted',
  '5. Supporting documents',
  '6. The next procedural step',
  '7. What the person should do after submission',
  '8. Possible fees',
  '9. Whether a lawyer is advisable',
  '10. Important deadlines',
  '11. Best-practice checklist'
];

(async () => {
  console.log('\n===== Part T: Pre-Arrest Bail (English) =====');
  const pab = await explain('Pre-Arrest Bail');
  check('returns non-empty text', pab.length > 500);
  check('has Explained title', /\*\*Explained:/.test(pab));
  POINT_LABELS.forEach(l => check(`point present: "${l}"`, pab.includes(l)));
  check('cites verified provision (Section 498 CrPC)', /Section 498 CrPC/i.test(pab));
  check('names correct forum (Sessions / High Court)', /Sessions Court|High Court|Court of Session/i.test(pab));
  check('fees stated honestly as NOT verified', /NOT verified/i.test(pab));
  check('disclaimer: legal information, not legal advice', /not legal advice/i.test(pab));
  check('NOT intercepted by lawyer-directory blurb', !/verified lawyer directory is available/i.test(pab));
  check('NO invented numeric court fee', !/(?:court fee|stamp duty)[^.]{0,40}PKR\s?\d/i.test(pab));

  console.log('\n===== Part T: Legal Notice (English) =====');
  const ln = await explain('Legal Notice');
  check('returns non-empty text', ln.length > 500);
  POINT_LABELS.forEach(l => check(`point present: "${l}"`, ln.includes(l)));
  check('is about a legal notice (not off-topic labour)', /formal written demand|grievance|legal proceedings/i.test(ln));
  check('NOT off-topic labour/termination dump', !/wrongful termination|Labour Court|retrenchment/i.test(ln));
  check('verified Section 80 CPC note for government suits', /Section 80 CPC/i.test(ln));
  check('fees stated honestly as NOT verified', /NOT verified/i.test(ln));
  check('disclaimer: not legal advice', /not legal advice/i.test(ln));

  console.log('\n===== Part T: FIR Application (English) =====');
  const fir = await explain('FIR Application');
  check('cites Section 154 CrPC', /Section 154 CrPC/i.test(fir));
  check('names the SHO / police station', /Station House Officer|SHO|police station/i.test(fir));
  check('states FIR lodging is FREE (verified fact)', /FREE/i.test(fir));
  check('mentions Section 22-A remedy for refusal', /22-A|Justice of Peace/i.test(fir));

  console.log('\n===== Part T: Writ Petition (English) =====');
  const writ = await explain('Writ Petition (Art. 199)');
  check('cites Article 199', /Article 199/i.test(writ));
  check('names the High Court', /High Court/i.test(writ));

  console.log('\n===== Part T: Roman Urdu (bilingual labels) =====');
  const ur = await explain('Bail Application', 'roman_urdu');
  check('has Roman Urdu point label (Yeh document kya hai)', /Yeh document kya hai/i.test(ur));
  check('still grounded (Sections 496/497/498 CrPC)', /49[678]/.test(ur));
  check('has Roman Urdu disclaimer (qanooni mashwara nahi)', /qanooni mashwara nahi/i.test(ur));

  console.log('\n===== Part T: unknown document type (honest fallback) =====');
  const unknown = await explain('scan_2024_photo.pdf');
  check('does NOT guess an explanation', !/Explained:/i.test(unknown));
  check('says it is not a recognised type', /not a recognised legal document type/i.test(unknown));
  check('redirects to the document analyzer', /Upload \/ Analyze Document|Analyze Document/i.test(unknown));

  console.log(`\n===== Part T RESULT: ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})();
