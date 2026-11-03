// ============================================================================
// Register the F4-F10 gap-closure corpus documents in rag/manifest.json.
// Idempotent: existing ids are refreshed (checksum/lastVerifiedAt), new ids
// are appended. Run: node server/registerGapDocs.cjs
// ============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'rag', 'manifest.json');

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const NOW = new Date().toISOString();

const NEW_DOCS = [
  {
    id: 'amendment_history',
    localFilePath: 'rag/documents/amendments/amendment_history.txt',
    title: 'Pakistan Major Laws — Amendment History Corpus (original → amendment → current text)',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Federal & Provincial)',
    issuingAuthority: 'Parliament of Pakistan / Provincial Assemblies',
    sourceURL: 'https://pakistancode.gov.pk/',
    sourceDomain: 'pakistancode.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'provincial_fulltext',
    localFilePath: 'rag/documents/provincial/provincial_fulltext.txt',
    title: 'Provincial Laws — Operative Provisions & Coverage Matrix (Punjab/Sindh/KP/Balochistan/ICT)',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Provincial & ICT)',
    issuingAuthority: 'Provincial Assemblies / ICT',
    sourceURL: 'https://punjabcode.punjab.gov.pk',
    sourceDomain: 'punjabcode.punjab.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'ajk_laws',
    localFilePath: 'rag/documents/ajk/ajk_laws.txt',
    title: 'Azad Jammu & Kashmir — Legal System, Interim Constitution 1974 & Adapted Codes',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (AJK)',
    issuingAuthority: 'AJK Legislative Assembly',
    sourceURL: 'https://ajkassembly.gok.pk',
    sourceDomain: 'ajkassembly.gok.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'gb_laws',
    localFilePath: 'rag/documents/gb/gb_laws.txt',
    title: 'Gilgit-Baltistan — Legal System, Governance Order 2018 & Adapted Codes',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Gilgit-Baltistan)',
    issuingAuthority: 'GB Legislative Assembly',
    sourceURL: 'https://gilgitbaltistan.gov.pk',
    sourceDomain: 'gilgitbaltistan.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'customs_act_1969',
    localFilePath: 'rag/documents/customs/customs_act_1969.txt',
    title: 'Customs Act, 1969 — Import/Export Framework, Offences, Appeals & Baggage',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Federal)',
    issuingAuthority: 'Federal Board of Revenue',
    sourceURL: 'https://pakistancode.gov.pk/',
    sourceDomain: 'pakistancode.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'health_laws',
    localFilePath: 'rag/documents/health/health_laws.txt',
    title: 'Health Regulation — DRAP, Healthcare Commissions, PM&DC, Food Safety, Mental Health',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Federal & Provincial)',
    issuingAuthority: 'Parliament of Pakistan / Provincial Assemblies',
    sourceURL: 'https://pakistancode.gov.pk/',
    sourceDomain: 'pakistancode.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'fia_act_1974',
    localFilePath: 'rag/documents/fia/fia_act_1974.txt',
    title: 'Federal Investigation Agency Act, 1974 — Jurisdiction, Complaint Procedure, Cyber & Trafficking',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Federal)',
    issuingAuthority: 'Federal Investigation Agency',
    sourceURL: 'https://pakistancode.gov.pk/',
    sourceDomain: 'pakistancode.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'admin_service_laws',
    localFilePath: 'rag/documents/admin-service/admin_service_laws.txt',
    title: 'Administrative Law & Public Service — Civil Servants Act 1973, E&D Rules, Service Tribunals, Judicial Review',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Federal)',
    issuingAuthority: 'Federal Public Service Commission',
    sourceURL: 'https://pakistancode.gov.pk/',
    sourceDomain: 'pakistancode.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'torts_laws',
    localFilePath: 'rag/documents/torts/torts_laws.txt',
    title: 'Law of Torts — Defamation, Negligence, Nuisance/Trespass, Malicious Prosecution, Damages',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Federal & Provincial)',
    issuingAuthority: 'Parliament of Pakistan / Provincial Assemblies',
    sourceURL: 'https://pakistancode.gov.pk/',
    sourceDomain: 'pakistancode.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'civic_workflows',
    localFilePath: 'rag/documents/civic/civic_workflows.txt',
    title: 'Pakistan Civic Services — Citizen Workflows (registration, domicile, complaints, legal aid, emergency)',
    documentType: 'Civic Guide',
    jurisdiction: 'Pakistan (National)',
    issuingAuthority: 'NADRA / Local Government / Election Commission',
    sourceURL: 'https://www.nadra.gov.pk/',
    sourceDomain: 'nadra.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active Guide',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'poa_laws',
    localFilePath: 'rag/documents/poa/poa_laws.txt',
    title: 'Power of Attorney — Law, Registration, Execution & Drafting Structures (English/Urdu Script)',
    documentType: 'Actionable Legal Guide',
    jurisdiction: 'Pakistan (Federal & Provincial)',
    issuingAuthority: 'Registration Authorities',
    sourceURL: 'https://pakistancode.gov.pk/',
    sourceDomain: 'pakistancode.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active',
    sourcePriority: 2,
    language: 'en'
  },
  {
    id: 'foreigner_residence_work_study',
    localFilePath: 'rag/documents/foreigners/foreigner_residence_work_study.txt',
    title: 'Foreigners in Pakistan — Residence, Registration, Work, Study, Family & Emergencies (Depth Expansion)',
    documentType: 'Visa Guide',
    jurisdiction: 'Pakistan (Federal - Entry/Stay/Registration)',
    issuingAuthority: 'Ministry of Interior',
    sourceURL: 'https://visa.nadra.gov.pk/',
    sourceDomain: 'visa.nadra.gov.pk',
    publicationDate: '2026-09-07',
    effectiveDate: '2026-09-07',
    version: '2026.1',
    legalStatus: 'Active Guide',
    sourcePriority: 2,
    language: 'en'
  }
];

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const docs = manifest.documents || (manifest.documents = []);
const byId = new Map(docs.map((d) => [d.id, d]));

let added = 0;
let refreshed = 0;
for (const spec of NEW_DOCS) {
  const abs = path.resolve(ROOT, spec.localFilePath);
  if (!fs.existsSync(abs)) {
    console.error('MISSING SOURCE FILE: ' + spec.localFilePath + ' — skipping');
    process.exitCode = 1;
    continue;
  }
  const entry = { ...spec, checksum: sha256(abs), lastVerifiedAt: NOW };
  const existing = byId.get(spec.id);
  if (existing) {
    Object.assign(existing, entry);
    refreshed++;
  } else {
    docs.push(entry);
    byId.set(spec.id, entry);
    added++;
  }
}

// Refresh the expanded public_offices.txt checksum in place (same id).
const offices = byId.get('public_offices');
if (offices) {
  offices.checksum = sha256(path.resolve(ROOT, offices.localFilePath));
  offices.lastVerifiedAt = NOW;
  refreshed++;
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('registerGapDocs: added=' + added + ' refreshed=' + refreshed + ' total=' + docs.length);
