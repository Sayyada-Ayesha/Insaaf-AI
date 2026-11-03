/*
 * §5 Document Assistant defect register — reproduced against the CURRENT code,
 * one assertion per defect that a past audit recorded as still open. TEXT
 * fixtures only; the upload -> OCR chain is a browser concern and is never
 * simulated here.
 *
 * Each fixture is synthetic. It carries no real institution's fee figures as
 * fact — only the shapes the extractor has to recognise.
 */
const {
  analyzeDocumentText, extractParties, compareDocumentsLocal,
  getReadinessChecklist, classifyDocumentType, extractDeadlines, extractAuthorities
} = require('../../server/docModel.js');

let pass = 0, fail = 0;
const failures = [];
function check(ok, label, extra) {
  if (ok) { pass++; console.log(`PASS - ${label}`); }
  else { fail++; failures.push(label); console.log(`FAIL - ${label}${extra ? ' :: ' + String(extra).slice(0, 300) : ''}`); }
}

const CHALLAN = `GOVERNMENT COLLEGE (TEST FIXTURE) — FEE CHALLAN
Challan Form No. CH-2026-44871
Student Name: Ayesha Siddiqui
Roll No.: 2021-CS-114    Semester: Fall 2025
Particulars of dues:
Tuition fee (Semester)          Rs 68,000
Examination fee                 Rs 4,500
Hostel fee                      Rs 12,000
Late payment penalty            Rs 500
Total payable: Rs 85,000
Deposit this challan at any HBL branch within 15 working days of issue. After the due date a further penalty applies.
Issued by: Controller of Examinations, dated 12 March 2026.`;

const CHALLAN_EDITED = CHALLAN.replace('Late payment penalty            Rs 500', 'Late payment penalty            Rs 1,500');

const ANALYSED = analyzeDocumentText(CHALLAN, 'What is written in this document?', {});
const srcLines = CHALLAN.split('\n').map(l => l.trim()).filter(Boolean);
const verbatimIn = s => srcLines.filter(l => l.length > 12 && String(s).includes(l)).length;

// --------------------------------------------------------------- D1: summary --
{
  const s = ANALYSED.summary;
  check(typeof s === 'string' && s.length > 40, 'D0 a summary is produced at all', JSON.stringify(s).slice(0, 200));
  const dumped = verbatimIn(s);
  check(dumped <= 1, 'D1 the summary is not a verbatim line dump of the document',
    `${dumped}/${srcLines.length} source lines appear intact :: ${s}`);
  const head = String(ANALYSED.answer || '');
  check(!/^Challan Form No\. CH-2026-44871\s+Student Name/.test(head) && verbatimIn(head) <= 1,
    'D1b the Explain answer does not open with the document pasted back', head.slice(0, 320));
}

// ------------------------------------------------------- D2: risk wording -----
{
  const dt = classifyDocumentType(CHALLAN).type;
  const wording = JSON.stringify([ANALYSED.risks, ANALYSED.nextSteps, ANALYSED.categorizedRisks]);
  check(/challan|fee|payment|dues|deposit/i.test(dt), 'D2a a fee challan is classified as a fee/payment document', dt);
  check(!/ex[-\s]?parte|adverse or ex parte|appeal to the appellate court/i.test(wording),
    'D2b no ex-parte court boilerplate on a fee challan', (wording.match(/.{0,90}ex.{0,20}parte.{0,90}/i) || [''])[0]);
  check(/fee|challan|deposit|payment|university/i.test(wording),
    'D2c the challan advice is worded for a fee document', wording.slice(0, 200));
}

// --------------------------------------------- D3: checklist category routing --
{
  const cl = getReadinessChecklist('I have a university fee challan and want to deposit it correctly', {});
  const items = JSON.stringify(cl);
  check(/fee challan|fee deposit/i.test(cl.label || ''),
    'D3a the fee challan is routed to the fee checklist, not the admission one', cl.label);
  check(!/domicile|matric|photograph/i.test(items),
    'D3b admission-only artifacts (domicile, matric, photographs) are not demanded', items.slice(0, 300));
  check(/challan|fee schedule/i.test((cl.requiredItems || []).join(' ')),
    'D3c the required items are the challan and the published fee schedule', JSON.stringify(cl.requiredItems));
}

// ------------------------------------------------- D4: labelled addressee -----
{
  const p = extractParties(CHALLAN);
  check(p.some(x => /Ayesha Siddiqui/i.test(x)),
    'D4 a labelled addressee ("Student Name: …") is extracted as a party', JSON.stringify(p));
}

// --------------------------------------------- D6/D7: extraction fidelity -----
{
  const dl = extractDeadlines(CHALLAN);
  check(dl.includes('within 15 working days of issue'),
    'D6 the stated deadline is the document phrase, not a fragment cut mid-sentence', JSON.stringify(dl));
  check(!dl.some(d => /[.!?]\s+\S+$/.test(d) && !/(^|[^.])\.$/.test(d)) && !/After the due date a$/.test(dl[0] || ''),
    'D6b no deadline ends on a dangling half word', JSON.stringify(dl));
  const auth = extractAuthorities(CHALLAN);
  check(/^Controller of Examinations$/i.test(auth[0] || ''),
    'D7 the authority first is the office the document itself names', JSON.stringify(auth));
  check(!/issued by University Registrar/i.test(ANALYSED.summary),
    'D7b the summary does not rename the issuer with a generic category', ANALYSED.summary);
}

// ------------------------------------------------------- D5: compare depth ----
{
  const c = compareDocumentsLocal(CHALLAN, CHALLAN_EDITED, {});
  const s = JSON.stringify(c);
  check(/1,500|1500/.test(s) && /500/.test(s),
    'D5 the changed penalty figure is reported as before/after, not only the total', s.slice(0, 400));
  check((c.amountsChanged || []).length === 2,
    'D5a both sides of the changed amount are listed', JSON.stringify(c.amountsChanged));
  check(/review recommended/i.test(c.overallRisk || '') && /medium|high/.test(c.riskLevel || ''),
    'D5b the comparison states a risk level for a changed payable amount', `${c.riskLevel} :: ${c.overallRisk}`);
}

console.log(`\n==== testDocumentAssistantDefects: ${pass}/${pass + fail} PASS ====`);
if (fail) console.log('FAILING: ' + failures.join(', '));
process.exit(fail ? 1 : 0);
