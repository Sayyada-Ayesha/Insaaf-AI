// ============================================================================
// Register the GCU Hyderabad rules corpus and the BISP/8171 programme-procedure
// corpus in rag/manifest.json.
//
// `npm run corpus:update` deliberately does NOT auto-ingest unregistered files
// (see its own log line), so a new document only reaches the index after an
// explicit manifest entry. Idempotent: an existing id is refreshed in place, a
// new id is appended. Run: node server/registerEducationCivicDocs.cjs
//
// publicationDate / effectiveDate / version carry the official-source
// verification date, not an assumed gazette date: neither publisher dates its
// undergraduate policy or programme leaflets in a machine-readable way.
// ============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'rag', 'manifest.json');
const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const VERIFIED_ON = '2026-10-16';

const DOCS = [
  {
    id: 'gcuh_admissions_fees_examinations_rules',
    localFilePath: 'rag/documents/education/gcuh_admissions_fees_examinations_rules.txt',
    title: 'Government College University Hyderabad — Admission, Fee, Examination, Discipline and Harassment Rules',
    documentType: 'University Rules / Student Guide',
    jurisdiction: 'Pakistan (Sindh — GCU Hyderabad, institution-specific)',
    issuingAuthority: 'Government College University Hyderabad (Office of Admissions, Student Affairs, Registrar)',
    sourceURL: 'https://gcuh.edu.pk/pages/undergraduate_policy.html',
    sourceDomain: 'gcuh.edu.pk',
    publicationDate: VERIFIED_ON,
    effectiveDate: VERIFIED_ON,
    version: VERIFIED_ON,
    legalStatus: 'Active',
    sourcePriority: 1,
    language: 'en'
  },
  {
    id: 'bisp_8171_programme_procedures',
    localFilePath: 'rag/documents/civic/bisp_8171_programme_procedures.txt',
    title: 'BISP / 8171 — Benazir Kafaalat, NSER, Taleemi Wazaif and Nashonuma Procedures and Grievance Routes',
    documentType: 'Federal Assistance Programme',
    jurisdiction: 'Pakistan (Federal)',
    issuingAuthority: 'Benazir Income Support Programme (BISP)',
    sourceURL: 'https://bisp.gov.pk/Detail/YTgzNjkxM2YtN2ViMC00MjA5LWI0MDMtNzM4ZWJmMGVlNzc5',
    sourceDomain: 'bisp.gov.pk',
    publicationDate: VERIFIED_ON,
    effectiveDate: VERIFIED_ON,
    version: VERIFIED_ON,
    legalStatus: 'Active',
    sourcePriority: 1,
    language: 'en'
  }
];

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
for (const doc of DOCS) {
  const abs = path.resolve(ROOT, doc.localFilePath);
  if (!fs.existsSync(abs)) {
    console.error(`[register] MISSING SOURCE FILE — ${doc.localFilePath} (write the corpus file first)`);
    process.exit(1);
  }
  const entry = { ...doc, checksum: sha256(abs), lastVerifiedAt: new Date().toISOString() };
  const at = manifest.documents.findIndex(d => d.id === doc.id);
  if (at === -1) { manifest.documents.push(entry); console.log(`[register] added ${doc.id}`); }
  else { manifest.documents[at] = entry; console.log(`[register] refreshed ${doc.id}`); }
}

const tmp = `${MANIFEST_PATH}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), 'utf8');
fs.renameSync(tmp, MANIFEST_PATH);
console.log(`[register] manifest now holds ${manifest.documents.length} documents`);
