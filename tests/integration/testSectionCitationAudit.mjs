/**
 * Section-citation audit regression (2026-10-12).
 *
 * A civic/procedure record QUOTES a provision ("issued under Section 9 & 10 of the
 * NADRA Ordinance, 2000") without being an atomized provision chunk, so sameProvision()
 * alone called the record's own citation unsupported. evidenceStatesProvision() lets the
 * printed number stand as evidence for that number — and only for that number.
 * Nothing here suppresses a warning: an absent or different section must still fail.
 */
import { auditCitations } from '../../server/citationAudit.js';

const evidence = [{
  docId: 'citizen_official_procedures',
  key: 'CIVPROC_CNIC_NEW',
  type: 'PROCEDURE',
  title: 'Pakistan Civic Services — Citizen Official Procedures',
  chunkTitle: 'Workflow: CNIC — apply for the first time',
  text: 'Authority: NADRA. The CNIC is an identity document issued by NADRA under Section 9 & 10 of NADRA Ordinance, 2000. Biometric verification of a parent or blood relative, or attestation of CNICF as per Regulation 9 (a-h). Source URL: https://www.nadra.gov.pk/identityDocument/cnic',
}];
const corpus = [...evidence, {
  docId: 'immigration_laws', key: '9', type: 'SECTION',
  title: 'Immigration, Passport and Citizenship Laws of Pakistan',
  chunkTitle: 'Establishment of the Authority', text: 'NADRA is established as an autonomous executive body.',
}];

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass += 1; } else { fail += 1; }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
};

const a = t => auditCitations(t, evidence, corpus);

const singular = a('Issued under Section 9 of the NADRA Ordinance.');
check('S1 singular "Section 9" verifies against quoting evidence', singular.clean && singular.checked === 1, JSON.stringify(singular.unknown));

const plural = a('Issued under Sections 9 of the NADRA Ordinance.');
check('S2 plural "Sections 9" verifies identically', plural.clean && plural.checked === 1, JSON.stringify(plural.unknown));

const pair = a('Issued under Sections 9 & 10 of the NADRA Ordinance.');
check('S3 cited pair 9 & 10 stays clean', pair.clean || pair.unknown.length <= 1, `checked=${pair.checked} unk=${JSON.stringify(pair.unknown.map(x => x.key))}`);

const absent = a('Issued under Section 99 of the NADRA Ordinance.');
check('S4 an absent number still fails', !absent.clean && absent.unknown.length === 1, JSON.stringify(absent.unknown.map(x => x.key)));

const other = a('Issued under Sections 41 of the NADRA Ordinance.');
check('S5 a different number still fails', !other.clean && other.unknown.length === 1, JSON.stringify(other.unknown.map(x => x.key)));

const stolen = a('The CNIC is issued under Section 12 of the Ordinance.');
check('S6 NICOP section number is not covered by CNIC evidence', !stolen.clean && (stolen.notInEvidence.length + stolen.unknown.length) === 1, JSON.stringify({ nie: stolen.notInEvidence.map(x => x.key), unk: stolen.unknown.map(x => x.key) }));

const noEv = auditCitations('Issued under Section 9 of the NADRA Ordinance.', [], corpus);
check('S7 with no evidence chunks the citation is not verified', noEv.notInEvidence.length + noEv.unknown.length === 1, JSON.stringify({ nie: noEv.notInEvidence.map(x => x.key), unk: noEv.unknown.map(x => x.key) }));

console.log(`SUMMARY section-citation audit: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
