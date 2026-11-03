/**
 * HEC corpus builder — turns harvested official HEC text (rag/.staging/HEC) into
 * corpus documents under rag/documents/hec/ and registers them in rag/manifest.json.
 *
 *   node scripts/corpus/buildHecCorpus.cjs               # write corpus files
 *   node scripts/corpus/buildHecCorpus.cjs --manifest    # also register/update manifest entries
 *   node scripts/corpus/buildHecCorpus.cjs --doc=hec_gep_graduate
 *   node scripts/corpus/buildHecCorpus.cjs --sources     # report source resolution only
 *
 * Rules this file exists to enforce:
 *  - the clause text stored in the corpus is the text extracted from the official
 *    HEC document. Nothing is paraphrased, added or invented; only layout is repaired.
 *  - every section carries the canonical source URL, the version and the status, so a
 *    newer notification can never be merged into an older policy text unnoticed.
 *  - sources are addressed by their official URL, never by a staging file name.
 *  - sources that produced no usable text layer are reported, not silently dropped.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const STAGE = path.join(ROOT, 'rag', '.staging', 'HEC');
const PDF_TXT = path.join(STAGE, 'pdftext');
const PAGE_TXT = path.join(STAGE, 'txt');
const OUT_DIR = path.join(ROOT, 'rag', 'documents', 'hec');
const MANIFEST = path.join(ROOT, 'rag', 'manifest.json');
const REPORT = path.join(STAGE, 'corpus_build.json');
const H = 'https://www.hec.gov.pk';

/** Where a source's raw text lives. kind 'pdf' = extracted PDF text, 'page' = HEC web page. */
const SRC = {
  // ---- official policy PDFs (the policy text itself) ----
  UGEP: { kind: 'pdf', url: `${H}/english/services/students/UEP/Documents/UGE-Policy.pdf`, page: `${H}/english/policies/Pages/UGEP.aspx` },
  GEP: { kind: 'pdf', url: `${H}/english/services/faculty/Plagiarism/Documents/Graduate-Education-Policy.pdf`, page: `${H}/english/policies/Pages/GEP.aspx` },
  PLAG: { kind: 'pdf', url: `${H}/english/policies/Documents/Plagiarism-Policy.pdf`, page: `${H}/english/policies/Pages/Plagiarism.aspx` },
  PLAG_SOP: { kind: 'pdf', url: `${H}/english/services/faculty/Documents/Plagiarism/Time%20bound%20SOPs%20for%20Plagiarism%20Cases.pdf`, page: `${H}/english/services/faculty/Plagiarism/Pages/default.aspx` },
  PLAG_HOW: { kind: 'pdf', url: `${H}/english/services/faculty/Documents/Plagiarism/How%20does%20HEC%20deals%20with%20Plagiarism%20Cases.pdf`, page: `${H}/english/services/faculty/Plagiarism/Pages/default.aspx` },
  PLAG_LITTLE: { kind: 'pdf', url: `${H}/english/services/faculty/Documents/Plagiarism/Little%20Book%20of%20Plagiarism.pdf`, page: `${H}/english/services/faculty/Plagiarism/Pages/default.aspx` },
  PLAG_TURNITIN: { kind: 'pdf', url: `${H}/english/services/faculty/Documents/Plagiarism/Guidelines%20on%20Turnitin.pdf`, page: `${H}/english/services/faculty/Plagiarism/Pages/default.aspx` },
  PLAG_TURNITIN_SOP: { kind: 'pdf', url: `${H}/english/services/faculty/Plagiarism/Documents/Turnitin-SOPs.pdf`, page: `${H}/english/services/faculty/Plagiarism/Pages/default.aspx` },
  ODL: { kind: 'pdf', url: `${H}/english/policies/Documents/ODL-Policy-Circulated.pdf`, page: `${H}/english/policies/Pages/ODL.aspx` },
  ODL_TOOLKIT: { kind: 'pdf', url: `${H}/english/policies/Documents/ODL-Toolkit.pdf`, page: `${H}/english/policies/Pages/ODL.aspx` },
  GENAI: { kind: 'pdf', url: `${H}/english/policies/Documents/Framework-Gene-AI.pdf`, page: `${H}/english/policies/Pages/Framework-GenAI.aspx` },
  GENAI_NOTIF: { kind: 'pdf', url: `${H}/english/Notifications/Lists/Notifications/Attachments/62/HEC%20Notification%20AI%20Gen-AI-HEIs.pdf`, page: `${H}/english/Notifications/Pages/default.aspx` },
  DDJDP: { kind: 'pdf', url: `${H}/english/policies/Documents/DDJDP.pdf`, page: `${H}/english/policies/Pages/DDJDP.aspx` },
  DDJDP_NOTIF: { kind: 'pdf', url: `${H}/english/Notifications/Lists/Notifications/Attachments/57/Notification%20-%20Policy%20on%20Dual,%20Double%20&%20Joint%20Degree%20Programmes,%202026.pdf`, page: `${H}/english/Notifications/Pages/default.aspx` },
  LAUP: { kind: 'pdf', url: `${H}/english/policies/Documents/FRAMEWORK%20FOR%20RECOGNITION%20OF%20LIBERAL%20ARTS%20UNDERGRADUATE%20PROGRAMS.pdf`, page: `${H}/english/policies/Pages/Framework-LAUP.aspx` },
  FEE_REFUND: { kind: 'pdf', url: `${H}/english/policies/Documents/Refund-Policy.pdf`, page: `${H}/english/policies/Pages/Refund-Policy.aspx` },
  CAMPUS_SEC: { kind: 'pdf', url: `${H}/english/policies/Documents/Campus-Security-surveillance-policy.pdf`, page: `${H}/english/policies/Pages/Campus-Security-Policy.aspx` },
  BUTA: { kind: 'pdf', url: `${H}/english/policies/Documents/Framework-BUTA.pdf`, page: `${H}/english/policies/Pages/Framework-BUTA.aspx` },
  DNP: { kind: 'pdf', url: `${H}/english/policies/Documents/Framework-DNP.pdf`, page: `${H}/english/policies/Pages/Framework-DNP.aspx` },
  MP: { kind: 'pdf', url: `${H}/english/policies/Documents/Framework-MP.pdf`, page: `${H}/english/policies/Pages/Framework-MP.aspx` },
  PE: { kind: 'pdf', url: `${H}/english/policies/Documents/Framework-PE.pdf`, page: `${H}/english/policies/Pages/Framework-PE.aspx` },
  PRACTICE: { kind: 'pdf', url: `${H}/english/policies/Documents/Appointment-Prof-Practice.pdf`, page: `${H}/english/policies/Pages/Guidelines-APP.aspx` },
  VISITING: { kind: 'pdf', url: `${H}/english/policies/Documents/Guidelines%20for%20Engagement%20of%20Visiting%20Faculty%20in%20Higher%20Education%20Institutions.pdf`, page: `${H}/english/policies/Pages/Visiting-Faculty.aspx` },
  VISITING_NOTIF: { kind: 'pdf', url: `${H}/english/Notifications/Lists/Notifications/Attachments/55/Notification%20-%20Guidelines%20for%20Engagement%20of%20Visiting%20Faculty%20in%20HEIs,%202026.pdf`, page: `${H}/english/Notifications/Pages/default.aspx` },
  POSTPHD_DEFER: { kind: 'pdf', url: `${H}/english/Notifications/Lists/Notifications/Attachments/64/Deferment-Post-PhD-Experience.pdf`, page: `${H}/english/Notifications/Pages/default.aspx` },
  IPFP: { kind: 'pdf', url: `${H}/english/NAHE/IPFP/Documents/IPFP-Policy.pdf`, page: `${H}/english/policies/Pages/IPFP-Policy.aspx` },
  GRANT_REVAMP: { kind: 'pdf', url: `${H}/english/policies/Documents/Revamping%20the%20HEC%20Research%20Grant%20Framework_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  GRANT_FIN: { kind: 'pdf', url: `${H}/english/policies/Documents/Financial%20Rules%20Research%20Grants_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  ORICS: { kind: 'pdf', url: `${H}/english/policies/Documents/ORICs-Policy.pdf`, page: `${H}/english/policies/Pages/ORICs-Policy.aspx` },
  REVIEW_PANELS: { kind: 'pdf', url: `${H}/english/policies/Documents/Scientific%20Reveiw%20Panels_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  RES_AWARDS: { kind: 'pdf', url: `${H}/english/policies/Documents/Research%20Awards_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  TRAVEL_GRANT: { kind: 'pdf', url: `${H}/english/policies/Documents/Travel%20Grant%20for%20Pakistani%20Researchers%20Revised_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  PERIDOT: { kind: 'pdf', url: `${H}/english/policies/Documents/PERIDOT%20Researchers%20Mobility%20Grant%20Program_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  TEXTBOOK: { kind: 'pdf', url: `${H}/english/policies/Documents/Textbook%20Writing%20Support%20Program_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  LIBRARY_SP: { kind: 'pdf', url: `${H}/english/policies/Documents/Library%20Support%20Program_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  NDLP: { kind: 'pdf', url: `${H}/english/policies/Documents/National%20Digital%20Library%20Program_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  SEMINAR_GRANT: { kind: 'pdf', url: `${H}/english/policies/Documents/Grant%20to%20Organize%20Seminar%20-Conference%20-%20Symposium%20or%20Training%20Workshop_Policy.pdf`, page: `${H}/english/policies/Pages/RnD-Policies.aspx` },
  JOURNALS: { kind: 'pdf', url: `${H}/english/services/faculty/journals/Documents/HEC%20Journals%20and%20Publication%20Policy%202024%20v2.0-As%20amended%20wef%2005-11-2025.pdf`, page: `${H}/english/services/faculty/journals/Pages/default.aspx` },
  UNETHICAL_PUB: { kind: 'pdf', url: `${H}/english/services/faculty/journals/Documents/Guidelines%20unethicalunlawful%20practices%20in%20research%20publication.pdf`, page: `${H}/english/services/faculty/journals/Pages/default.aspx` },
  EARB: { kind: 'pdf', url: `${H}/english/services/faculty/journals/Documents/EARB-%20Appeal%20Submission%20Guidelines%20v1.0.pdf`, page: `${H}/english/services/faculty/journals/Pages/default.aspx` },
  HARASSMENT: { kind: 'pdf', url: `${H}/english/services/Documents/HARASSMENT-POLICY.pdf`, page: `${H}/english/policies/Pages/HARASSMENT-POLICY.aspx` },
  DISABILITY: { kind: 'pdf', url: `${H}/english/services/universities/Documents/HEC%20-%20POLICY%20FOR%20STUDENTS%20WITH%20DISABILITIES%20AT%20HEIs%20IN%20PAKISTAN.pdf`, page: `${H}/english/policies/Pages/Policy-on-Disability.aspx` },
  DRUG_TOBACCO: { kind: 'pdf', url: `${H}/english/Documents/Policy%20on%20drugs%20and%20tobacco%20control%20at%20HEIs.pdf`, page: `${H}/english/policies/Pages/Policy-on-Drug-and-Tobacco-Abuse-in-Higher-Education-Institutions.aspx` },
  TNE_POLICY: { kind: 'pdf', url: `${H}/english/services/universities/Documents/HEC-Foreign-Collaboratin-Policy.pdf`, page: `${H}/english/policies/Pages/HEC-Foreign-Collaboration-Policy.aspx` },
  TNE_AMEND: { kind: 'pdf', url: `${H}/english/Notifications/Lists/Notifications/Attachments/58/Notification%20-%20Amendments%20in%20TNE%20Policy,%202024.pdf`, page: `${H}/english/Notifications/Pages/default.aspx` },
  SHAHADAT_ALIA: { kind: 'pdf', url: `${H}/english/services/students/DES/Documents/Shahadatul-Alia-Notification-Urdu.pdf`, page: `${H}/english/services/students/DES/Pages/Procedure/Deeni-Asnad.aspx` },
  ISCED: { kind: 'pdf', url: `${H}/english/Notifications/Lists/Notifications/Attachments/53/UNESCO-ISCED.pdf`, page: `${H}/english/Notifications/Pages/default.aspx` },

  // ---- HEC web pages: procedures, service rules and official registers ----
  POLICY_INDEX: { kind: 'page', url: `${H}/english/policies/Pages/default.aspx` },
  NOTIFICATIONS: { kind: 'page', url: `${H}/english/Notifications/Pages/default.aspx` },
  DAS_MAIN: { kind: 'page', url: `${H}/english/services/students/DAS/Pages/Degree-Attestation.aspx` },
  DAS_DOCS: { kind: 'page', url: `${H}/english/services/students/DAS/Pages/Documents-Attested.aspx` },
  DAS_ADDL: { kind: 'page', url: `${H}/english/services/students/DAS/Pages/Additional-Requirement.aspx` },
  DAS_VERIFY: { kind: 'page', url: `${H}/english/services/students/DAS/Pages/Verification.aspx` },
  DAS_OPDAS: { kind: 'page', url: `${H}/english/HECAnnouncements/Pages/OPDAS.aspx` },
  DES_LOCAL: { kind: 'page', url: `${H}/english/services/students/DES/Pages/Procedure/Local-Equivalence.aspx` },
  DES_FOREIGN: { kind: 'page', url: `${H}/english/services/students/DES/Pages/Procedure/Procedure-foreign.aspx` },
  DES_DEENI: { kind: 'page', url: `${H}/english/services/students/DES/Pages/Procedure/Deeni-Asnad.aspx` },
  DES_FEE: { kind: 'page', url: `${H}/english/services/students/DES/Pages/Fee-for-Equivalence.aspx` },
  DES_COMMITTEE: { kind: 'page', url: `${H}/english/services/students/DES/Pages/EquivalenceAccreditationCommittee.aspx` },
  DES_FAQ_LOCAL: { kind: 'page', url: `${H}/english/services/students/DES/Pages/FAQs/FAQs-Local.aspx` },
  DES_FAQ_FOREIGN: { kind: 'page', url: `${H}/english/services/students/DES/Pages/FAQs/FAQs-Foreign.aspx` },
  DES_FAQ_DEENI: { kind: 'page', url: `${H}/english/services/students/DES/Pages/FAQs/FAQs-Deeni.aspx` },
  DES_SYSTEM: { kind: 'page', url: `${H}/english/services/students/DES/Pages/SystemAndProcedure.aspx` },
  AFFILIATION_PAGE: { kind: 'page', url: `${H}/english/policies/Pages/HEC-Institutional-Affiliation-Policy.aspx` },
  RECOGNISED: { kind: 'page', url: `${H}/english/universities/Pages/recognised.aspx` },
  CAMPUSES: { kind: 'page', url: `${H}/english/universities/Pages/DAIs/HEC-recognized-Campuses.aspx` },
  UNACCREDITED: { kind: 'page', url: `${H}/english/universities/Pages/Unaccredited-Institutions.aspx` },
  TNE_INSTITUTIONS: { kind: 'page', url: `${H}/english/universities/Pages/Foreign-Collaboration-Institutions.aspx` },
  TNE_OLD: { kind: 'page', url: `${H}/english/universities/Pages/Institution-Accredited-under-the-Old-TNE-Policy.aspx` },
  FOREIGN_NOC: { kind: 'page', url: `${H}/english/services/universities/Fsnoc/Pages/default.aspx` },
  QAA_MAIN: { kind: 'page', url: `${H}/english/services/universities/QAA/Pages/default.aspx` },
  QAA_REVAMPED: { kind: 'page', url: `${H}/english/services/universities/QAA/Pages/Revamped-QA-Framework.aspx` },
  QAA_QEC: { kind: 'page', url: `${H}/english/services/universities/QAA/Pages/QECs.aspx` },
  QAA_IPE: { kind: 'page', url: `${H}/english/services/universities/QAA/externalQA/IPE/Pages/default.aspx` },
  QAA_ACCRED_COUNCILS: { kind: 'page', url: `${H}/english/services/universities/QAA/Pages/Accreditation-Councils.aspx` },
  QAA_PR: { kind: 'page', url: `${H}/english/services/universities/QAA/Pages/Progress-Review.aspx` },
  PLA: { kind: 'page', url: `${H}/english/services/universities/QAA/externalQA/PLA/Pages/default.aspx` },
  PQF: { kind: 'page', url: `${H}/english/services/universities/pqf/Pages/default.aspx` },
  PQR: { kind: 'page', url: `${H}/english/services/universities/pqr/Pages/default.aspx` },
  PQR_INFO: { kind: 'page', url: `${H}/english/services/universities/pqr/Pages/PQR-information.aspx` },
  CURRICULA: { kind: 'page', url: `${H}/english/services/universities/RevisedCurricula/Pages/default.aspx` },
  CR: { kind: 'page', url: `${H}/english/services/universities/cr/Pages/default.aspx` },
  ETC_MAIN: { kind: 'page', url: `${H}/english/services/students/etc/Pages/default.aspx` },
  ETC_ANNOUNCE: { kind: 'page', url: `${H}/english/services/students/etc/Pages/Announcements.aspx` },
  ETC_OS_HAT_KEYS: { kind: 'page', url: `${H}/english/HECAnnouncements/Pages/Answer-Keys-OS-HAT.aspx` },
  UEP_PAGE: { kind: 'page', url: `${H}/english/services/students/UEP/Pages/default.aspx` },
  HARASSMENT_PAGE: { kind: 'page', url: `${H}/english/policies/Pages/HARASSMENT-POLICY.aspx` },
  FEE_REFUND_PAGE: { kind: 'page', url: `${H}/english/policies/Pages/Fee-Refund-Policy.aspx` },
  REFUND_PAGE: { kind: 'page', url: `${H}/english/policies/Pages/Refund-Policy.aspx` },
  DRUG_PAGE: { kind: 'page', url: `${H}/english/policies/Pages/Policy-on-Drug-and-Tobacco-Abuse-in-Higher-Education-Institutions.aspx` },
  ODL_PAGE: { kind: 'page', url: `${H}/english/policies/Pages/ODL.aspx` },
  TNE_PAGE: { kind: 'page', url: `${H}/english/policies/Pages/HEC-Foreign-Collaboration-Policy.aspx` },
  PLAG_PAGE: { kind: 'page', url: `${H}/english/policies/Pages/Plagiarism.aspx` },
  PLAG_CONTACT: { kind: 'page', url: `${H}/english/services/faculty/Plagiarism/Pages/Contact-Us.aspx` },
  PLAG_WRONG: { kind: 'page', url: `${H}/english/services/faculty/Plagiarism/Pages/People-Who-Provided-Wrong-Complaint.aspx` },
  JOURNALS_PAGE: { kind: 'page', url: `${H}/english/services/faculty/journals/Pages/default.aspx` },
  ELT_SCHOLARSHIPS: { kind: 'page', url: `${H}/english/services/faculty/ELTR/Pages/Indigenous-ELT-scholarships.aspx` },
  STUDENT_SERVICES: { kind: 'page', url: `${H}/english/services/students/Pages/default.aspx` },
  PMNLS: { kind: 'page', url: `${H}/english/services/students/PMYP/Pages/default.aspx` },
  PMNLS_NIA: { kind: 'page', url: `${H}/english/services/students/PMYP/Pages/NIA.aspx` },
  STFS: { kind: 'page', url: `${H}/english/services/students/stfs/Pages/default.aspx` },
  SCP: { kind: 'page', url: `${H}/english/services/students/scp/Pages/default.aspx` },
  SCP_ELIG: { kind: 'page', url: `${H}/english/services/students/scp/Pages/Eligibility-Criteria.aspx` },
  MSIA: { kind: 'page', url: `${H}/english/services/students/msia/Pages/default.aspx` },
  WHEELCHAIR: { kind: 'page', url: `${H}/english/services/students/wheelchair/Pages/default.aspx` },
  WHEELCHAIR_ELIG: { kind: 'page', url: `${H}/english/services/students/wheelchair/Pages/Eligibility-Criteria.aspx` },
  WHEELCHAIR_HOW: { kind: 'page', url: `${H}/english/services/students/wheelchair/Pages/How-To-Apply.aspx` },
  ASIP: { kind: 'page', url: `${H}/english/services/students/ASIP/Pages/ASIP.aspx` },
  ASIP_FAQ: { kind: 'page', url: `${H}/english/services/students/ASIP/Pages/FAQs.aspx` },
  DIGITAL_LIBRARY: { kind: 'page', url: `${H}/english/services/students/DL/Pages/Announcements.aspx` },
  THYSL: { kind: 'page', url: `${H}/english/services/students/Sports/Pages/THYSL.aspx` }
};

/** One manifest document per entry. `parts` are the official sources merged into it. */
const DOCS = [
  // ---------- A. Institution recognition, campuses, unaccredited/illegal institutions ----------
  {
    id: 'hec_institution_recognition',
    title: 'HEC recognition of universities and campuses, affiliated institutions and unaccredited institutions',
    documentType: 'HEC Official Register / Policy',
    coverage: 'A',
    legalStatus: 'Current (list as published on the HEC site)',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'Live HEC register, retrieved 2026-10-10',
    note: 'Recognised-university and recognised-campus lists are reproduced as published by HEC on the retrieval date. A list can change without a new notification: re-verify before relying on an entry. "Unaccredited Institutions" and "HEC NOC suspended/withdrawn" markers are HEC\u2019s own status labels.',
    parts: ['RECOGNISED', 'CAMPUSES', 'UNACCREDITED', 'AFFILIATION_PAGE', 'FOREIGN_NOC', 'POLICY_INDEX']
  },
  // ---------- B. Undergraduate and graduate education regulation ----------
  {
    id: 'hec_ugep_undergraduate',
    title: 'HEC Undergraduate Education Policy (V 1.1), effective Fall 2023',
    documentType: 'HEC Policy',
    coverage: 'B',
    legalStatus: 'Current',
    publicationDate: '2023-07-12',
    effectiveDate: '2023-01-01',
    version: 'V 1.1 (effective Fall 2023)',
    note: 'Notification "Undergraduate Education Policy", dated Wednesday, July 12, 2023; policy text states effect from Fall 2023.',
    parts: ['UGEP', 'POLICY_INDEX', 'NOTIFICATIONS', 'UEP_PAGE']
  },
  {
    id: 'hec_gep_graduate',
    title: 'HEC Graduate Education Policy (GEP-2023) — MS/MPhil and PhD requirements, supervision and grievances',
    documentType: 'HEC Policy',
    coverage: 'B,H',
    legalStatus: 'Current',
    publicationDate: '2023-07-10',
    effectiveDate: '2023-07-10',
    version: 'GEP-2023',
    note: 'Notification "Graduate Education Policy-2023 (GEP-2023)", dated Monday, July 10, 2023.',
    parts: ['GEP', 'NOTIFICATIONS', 'POSTPHD_DEFER']
  },
  {
    id: 'hec_laup_liberal_arts',
    title: 'HEC Framework for Recognition of Liberal Arts Undergraduate Programs (under UEP 2023)',
    documentType: 'HEC Framework',
    coverage: 'B,A',
    legalStatus: 'Current',
    publicationDate: '2025-09-17',
    effectiveDate: '2025-09-17',
    version: 'Framework under HEC Undergraduate Education Policy, 2023',
    note: 'Notification "HEC Notification Framework for Recognition of Liberal Arts Undergraduate Programs under the HEC Undergraduate Education Policy, 2023"; the notification PDF attached to the register is an image scan, so dates come from the HEC notification register.',
    parts: ['LAUP', 'NOTIFICATIONS']
  },
  {
    id: 'hec_ddjdp_joint_degrees',
    title: 'HEC Policy on Dual, Double and Joint Degree Programmes (2026) — including 2023 framework',
    documentType: 'HEC Policy',
    coverage: 'B,F',
    legalStatus: 'Current (2026 policy); earlier DDJDP framework text retained',
    publicationDate: '2026-08-27',
    effectiveDate: '2026-08-27',
    version: 'Notification dated 2026; DDJDP framework text as circulated',
    note: 'The register lists "Notification - Policy on Dual, Double & Joint Degree Programmes, 2026". Both the framework text and the 2026 notification are kept; the notification is the later instrument.',
    parts: ['DDJDP_NOTIF', 'DDJDP', 'NOTIFICATIONS']
  },
  {
    id: 'hec_etc_admission_tests',
    title: 'HEC Education Testing Council (ETC): HAT/GRE/LAT admission tests and the GRE/HAT mandatory-notification chain',
    documentType: 'HEC Council Procedure',
    coverage: 'B',
    legalStatus: 'Current',
    publicationDate: '2026-05-12',
    effectiveDate: 'see note',
    version: 'ETC pages as published; notification chain 2026-05-12 -> 2026-05-24 -> 2026-10-02',
    note: 'TIME-SENSITIVE: the HEC notification register records "Mandatory Conduct of GRE/HAT General & Subject Test through HEC-ETC" (2026-05-12) and later deferral notifications. Always read the latest register entry before stating that a test is or is not required.',
    parts: ['ETC_MAIN', 'ETC_ANNOUNCE', 'NOTIFICATIONS', 'ETC_OS_HAT_KEYS']
  },
  // ---------- C. Attestation vs equivalence ----------
  {
    id: 'hec_degree_attestation',
    title: 'HEC Degree Attestation Service (DAS): attestation of degrees, diplomas and certificates, documents required and verification',
    documentType: 'HEC Service Procedure',
    coverage: 'C',
    legalStatus: 'Current',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'HEC DAS pages as published, retrieved 2026-10-10',
    note: 'Attestation is NOT equivalence: HEC attests a degree; the Degree Equivalence Service (DES) decides equivalence. Charges and portals change — verify on the HEC page before quoting.',
    parts: ['DAS_MAIN', 'DAS_DOCS', 'DAS_ADDL', 'DAS_VERIFY', 'DAS_OPDAS']
  },
  {
    id: 'hec_equivalence_services',
    title: 'HEC Degree Equivalence Service (DES): local, foreign and Deeni Asnad equivalence, fees, committee and FAQs',
    documentType: 'HEC Service Procedure',
    coverage: 'C',
    legalStatus: 'Current',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'HEC DES pages as published, retrieved 2026-10-10',
    note: 'Covers equivalence of Pakistani degrees, foreign degrees, and Deeni Asnad. Fees and document lists are quoted from the HEC pages on the retrieval date.',
    parts: ['DES_LOCAL', 'DES_FOREIGN', 'DES_FEE', 'DES_COMMITTEE', 'DES_SYSTEM', 'DES_FAQ_LOCAL', 'DES_FAQ_FOREIGN']
  },
  {
    id: 'hec_deeni_asnad_equivalence',
    title: 'HEC equivalence of Deeni Asnad / Shahadat-ul-Alia and madrasah degrees',
    documentType: 'HEC Service Procedure',
    coverage: 'C',
    legalStatus: 'Current',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'HEC Deeni Asnad procedure and FAQs as published, retrieved 2026-10-10',
    note: 'Includes the HEC notification on recognition of Shahadat-ul-Alia (Urdu original; the page also carries an image-only notice). Deeni equivalence is decided by the HEC Equivalence Committee for Deeni Degrees.',
    parts: ['DES_DEENI', 'DES_FAQ_DEENI', 'SHAHADAT_ALIA']
  },
  // ---------- D. Student rights, complaints, welfare ----------
  {
    id: 'hec_fee_refund_policy',
    title: 'HEC Refund / National Fee-Refund Policy at HEIs: refund entitlements and timelines',
    documentType: 'HEC Policy',
    coverage: 'D,E',
    legalStatus: 'Current (policy text as published)',
    publicationDate: '2015-01-01',
    effectiveDate: '2015-01-01',
    version: 'Revised National Fee-Refund Policy (HEC page states the policy was revised in 2015)',
    note: 'CAUTION: the "National Fee Refund Policy.pdf" and "Fee-Refund-Policy.pdf" notification attachment published on the HEC site are image-only scans with no text layer; the machine-readable policy text here is the Refund-Policy.pdf that HEC also publishes, plus the HEC policy page statement.',
    parts: ['FEE_REFUND', 'REFUND_PAGE', 'FEE_REFUND_PAGE', 'NOTIFICATIONS']
  },
  {
    id: 'hec_harassment_policy',
    title: 'HEC Policy on Protection Against Harassment of Women at the Workplace in Higher Education Institutions',
    documentType: 'HEC Policy',
    coverage: 'D',
    legalStatus: 'Current',
    publicationDate: '2026-08-25',
    effectiveDate: '2026-08-25',
    version: 'HEC harassment policy as published; register lists notification "Policy-Harassment" dated Tuesday, August 25, 2026',
    note: 'Complaint routing inside an HEI (internal complaints committee, Ombudsperson, HEC escalation) is set out in the policy text. Institutional implementations differ; do not read a university\u2019s committee as the HEC rule.',
    parts: ['HARASSMENT', 'HARASSMENT_PAGE', 'NOTIFICATIONS']
  },
  {
    id: 'hec_student_welfare_policies',
    title: 'HEC student welfare policies: students with disabilities, drug and tobacco abuse, campus security and surveillance',
    documentType: 'HEC Policy',
    coverage: 'D',
    legalStatus: 'Current',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'As published on the HEC policies pages, retrieved 2026-10-10',
    note: 'Three separate HEC policies kept in one document because students ask about them together. Each section carries its own source URL.',
    parts: ['DISABILITY', 'DRUG_TOBACCO', 'CAMPUS_SEC', 'DRUG_PAGE', 'WHEELCHAIR', 'WHEELCHAIR_ELIG', 'WHEELCHAIR_HOW']
  },
  {
    id: 'hec_student_support_programs',
    title: 'HEC student support, financial assistance and skilling programs (eligibility, application and current intake status)',
    documentType: 'HEC Program Guidance',
    coverage: 'E,D',
    legalStatus: 'Mixed — see per-section status',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'HEC program pages as published, retrieved 2026-10-10',
    note: 'TIME-SENSITIVE: these HEC pages carry their own status text (for example "The project is closed for further intake", or an offer "valid till June 30, 2023"). Status is reproduced exactly as HEC published it and must be re-checked before advising a student.',
    parts: ['STUDENT_SERVICES', 'ASIP', 'ASIP_FAQ', 'STFS', 'SCP', 'SCP_ELIG', 'MSIA', 'PMNLS', 'PMNLS_NIA', 'THYSL', 'ELT_SCHOLARSHIPS', 'DIGITAL_LIBRARY']
  },
  // ---------- F. ODL / TNE ----------
  {
    id: 'hec_odl_policy',
    title: 'HEC Policy and Toolkit for Open, Distance and Online Learning (ODL) in Pakistan',
    documentType: 'HEC Policy',
    coverage: 'F,B',
    legalStatus: 'Current',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'ODL Policy (circulated) + ODL Toolkit as published',
    note: 'ODL recognition, programme approval and delivery-mode limits come from this policy; the notification attachment "ODL-Policy.pdf" is an image scan, so the circulated policy PDF is used.',
    parts: ['ODL', 'ODL_TOOLKIT', 'ODL_PAGE', 'NOTIFICATIONS']
  },
  {
    id: 'hec_tne_transnational',
    title: 'HEC Transnational Education (TNE) / Foreign Collaboration Policy, 2024, with amendments and the recognised TNE institution lists',
    documentType: 'HEC Policy',
    coverage: 'F,A',
    legalStatus: 'Current as amended (2026 amendments); old-TNE accreditation list is historical',
    publicationDate: '2024-09-09',
    effectiveDate: '2024-09-09',
    version: 'TNE Policy 2024 + "Notification - Amendments in TNE Policy, 2024" dated 2026-05-13',
    note: 'SUPERSESSION: the register dates the TNE Policy notification to 2024-09-09 and the amendments notification to 2026-05-13 — the amendments are the later instrument. "Institution-Accredited-under-the-Old-TNE-Policy" is explicitly the old regime.',
    parts: ['TNE_POLICY', 'TNE_AMEND', 'TNE_INSTITUTIONS', 'TNE_OLD', 'TNE_PAGE', 'NOTIFICATIONS']
  },
  // ---------- G. Quality assurance, accreditation, PQF, curricula ----------
  {
    id: 'hec_quality_assurance',
    title: 'HEC Quality Assurance Agency: QA framework, Quality Enhancement Cells, institutional performance evaluation and accreditation councils',
    documentType: 'HEC Guidance / Framework',
    coverage: 'G',
    legalStatus: 'Current',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'QAA pages as published, retrieved 2026-10-10',
    note: 'HEC publishes annual QAA targets as spreadsheets; only the narrative framework pages are in the corpus.',
    parts: ['QAA_MAIN', 'QAA_REVAMPED', 'QAA_QEC', 'QAA_IPE', 'QAA_ACCRED_COUNCILS', 'QAA_PR', 'PLA']
  },
  {
    id: 'hec_pqf_qualifications',
    title: 'Pakistan Qualification Framework (PQF), Pakistan Qualification Register (PQR) and UNESCO ISCED classification',
    documentType: 'HEC Framework',
    coverage: 'G,B',
    legalStatus: 'Current',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'PQF/PQR pages as published, retrieved 2026-10-10; UNESCO ISCED as notified by HEC',
    note: 'ISCED 2011 was circulated by HEC as a notification attachment (dated in the HEC register) and is the classification reference behind PQF level mappings.',
    parts: ['PQF', 'PQR', 'PQR_INFO', 'ISCED', 'NOTIFICATIONS']
  },
  {
    id: 'hec_curriculum_revision',
    title: 'HEC curriculum revision policy, revised curricula and model curricula guidance',
    documentType: 'HEC Guidance',
    coverage: 'G,B',
    legalStatus: 'Current',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'Curriculum Revision / Revised Curricula pages as published, retrieved 2026-10-10',
    note: 'Discipline model curricula are published as Word documents by HEC and are not machine-readable here; the corpus keeps the HEC process pages only.',
    parts: ['CR', 'CURRICULA', 'POLICY_INDEX']
  },
  // ---------- H. Academic integrity, research, publications ----------
  {
    id: 'hec_anti_plagiarism',
    title: 'HEC Anti-Plagiarism Policy and complaint procedure (Turnitin, thresholds, sanctions, PSC SOPs)',
    documentType: 'HEC Policy / Procedure',
    coverage: 'H,B',
    legalStatus: 'Current (Anti-Plagiarism Policy 2023 notified 2023-08-02)',
    publicationDate: '2023-08-02',
    effectiveDate: '2023-08-02',
    version: 'Plagiarism Policy as published + time-bound SOPs and complaint-handling notes',
    note: 'The notification attachment "Notification-ANTI-PLAGIARISM-POLICY.pdf" is an image scan; the policy text used is HEC\u2019s published Plagiarism-Policy.pdf plus the Plagiarism Directorate SOPs.',
    parts: ['PLAG', 'PLAG_SOP', 'PLAG_HOW', 'PLAG_LITTLE', 'PLAG_TURNITIN', 'PLAG_TURNITIN_SOP', 'PLAG_PAGE', 'PLAG_CONTACT', 'PLAG_WRONG', 'NOTIFICATIONS']
  },
  {
    id: 'hec_genai_academic_integrity',
    title: 'HEC Framework for Generation AI use in Higher Education Institutions',
    documentType: 'HEC Framework',
    coverage: 'H,B',
    legalStatus: 'Current',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'Framework-Gene-AI as published; HEC GenAI notification attached in the register',
    note: 'GenAI rules interact with the Anti-Plagiarism Policy: read both before advising on AI-assisted submissions.',
    parts: ['GENAI', 'GENAI_NOTIF', 'NOTIFICATIONS']
  },
  {
    id: 'hec_research_publications',
    title: 'HEC Journals and Publications Policy 2024 (v2.0 as amended w.e.f. 2025-11-05), recognition of journals, research grants and publication ethics',
    documentType: 'HEC Policy',
    coverage: 'H',
    legalStatus: 'Current as amended w.e.f. 2025-11-05',
    publicationDate: '2025-11-05',
    effectiveDate: '2025-11-05',
    version: 'Journals and Publication Policy 2024, Version 2.0 as amended w.e.f. 05-11-2025',
    note: 'SUPERSESSION: HEC also publishes the unamended "HEC Journals and Publication Policy 2024" and the notification attachment "Journals-Publications-Policy2024.pdf" (image scan). Version 2.0 as amended is the later instrument and governs.',
    parts: ['JOURNALS', 'JOURNALS_PAGE', 'UNETHICAL_PUB', 'EARB', 'GRANT_REVAMP', 'GRANT_FIN', 'REVIEW_PANELS', 'RES_AWARDS', 'TRAVEL_GRANT', 'PERIDOT', 'TEXTBOOK', 'LIBRARY_SP', 'NDLP', 'SEMINAR_GRANT', 'ORICS', 'NOTIFICATIONS']
  },
  {
    id: 'hec_faculty_appointment',
    title: 'HEC faculty appointment and eligibility frameworks: Tenure Track, IPFP, Professor of Practice, Meritorious Professor, DNP, Professor Emeritus, Visiting Faculty, BUTA',
    documentType: 'HEC Framework',
    coverage: 'H',
    legalStatus: 'Mixed — per-framework status recorded in each section',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'Frameworks as published; notification dates from the HEC register',
    note: 'Eligibility for appointment is HEC framework text; individual HEI statutes add requirements on top of it.',
    parts: ['IPFP', 'PRACTICE', 'MP', 'PE', 'DNP', 'BUTA', 'VISITING', 'VISITING_NOTIF', 'NOTIFICATIONS']
  },
  {
    id: 'hec_notifications_register',
    title: 'HEC Notifications register (official dated record of policy notifications, amendments and deferrals)',
    documentType: 'HEC Notification Register',
    coverage: 'A,B,C,D,E,F,G,H',
    legalStatus: 'Authoritative dated record as published',
    publicationDate: '2026-10-10',
    effectiveDate: '2026-10-10',
    version: 'HEC Notifications page as published, retrieved 2026-10-10',
    note: 'This is the register used to decide which version of an HEC rule is current. Entries are title + notification date exactly as HEC publishes them.',
    parts: ['NOTIFICATIONS', 'POLICY_INDEX']
  }
];

// ---------------------------------------------------------------------------
// source resolution — by official URL, never by staging file name
// ---------------------------------------------------------------------------
function slug(s) {
  return String(s).toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 110);
}
function normUrl(u) {
  const s = String(u).trim();
  const m = s.match(/^(https?:\/\/[^/]+)(.*)$/i);
  return m ? m[1] + m[2].replace(/\/{2,}/g, '/') : s;
}

let _pdfReg = null;
function pdfRegistry() {
  if (_pdfReg) return _pdfReg;
  const p = path.join(STAGE, 'pdfs.json');
  _pdfReg = new Map();
  if (fs.existsSync(p)) {
    for (const r of JSON.parse(fs.readFileSync(p, 'utf8'))) _pdfReg.set(normUrl(r.url), r);
  }
  return _pdfReg;
}
let _pageFiles = null;
function pageFileIndex() {
  if (_pageFiles) return _pageFiles;
  _pageFiles = new Map();
  if (!fs.existsSync(PAGE_TXT)) return _pageFiles;
  for (const f of fs.readdirSync(PAGE_TXT)) {
    if (!f.endsWith('.txt')) continue;
    const base = f.slice(0, -4);
    // file is `<id>_<slug>` where slug itself may contain underscores — match by suffix
    const at = base.lastIndexOf('_www_');
    const slugPart = at === -1 ? base : base.slice(at + 1);
    const key = slugPart || base;
    const cur = _pageFiles.get(key);
    const size = fs.statSync(path.join(PAGE_TXT, f)).size;
    if (!cur || size > cur.size) _pageFiles.set(key, { file: path.join(PAGE_TXT, f), size });
  }
  return _pageFiles;
}

/**
 * A few HEC hub pages were saved with their SharePoint markup intact. Markup is
 * layout, not content, so it is turned back into the layout it stood for (line
 * breaks, list dashes) and the rest discarded. Entities are decoded only after the
 * tags are gone, so a literal "&lt;" in the page text can never become markup.
 */
function stripHtml(t) {
  if (!/<(?:p|div|span|table|td|th|li|ul|ol|br|h[1-6]|a|img|strong|em)\b/i.test(t)) return t;
  return t
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|ul|ol|table|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, ' - ')
    .replace(/<(?:td|th)[^>]*>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function loadSource(name) {
  const s = SRC[name];
  if (!s) throw new Error(`unknown source ${name}`);
  const base = { ...s, url: normUrl(s.url) };
  let p = null;
  let meta = null;
  if (s.kind === 'pdf') {
    meta = pdfRegistry().get(base.url) || null;
    p = meta && meta.textFile ? path.join(ROOT, meta.textFile) : path.join(PDF_TXT, `${slug(base.url)}.txt`);
  } else {
    const hit = pageFileIndex().get(slug(base.url));
    p = hit ? hit.file : null;
  }
  if (!p || !fs.existsSync(p)) {
    return { ...base, missing: true, text: '', chars: 0, note: meta ? meta.error || meta.download : 'not acquired' };
  }
  const raw = s.kind === 'pdf' ? fs.readFileSync(p, 'utf8') : stripHtml(fs.readFileSync(p, 'utf8')).replace(/\t/g, ' ');
  const lines = raw.split('\n').map(l => l.replace(/\u00A0/g, ' ').replace(/[ \t]{2,}/g, ' ').trimEnd());
  const kept = dropNoise(lines, s.kind === 'pdf' ? PDF_NOISE : PAGE_NOISE);
  const body = kept.join('\n').replace(/[ \t]{2,}/g, ' ');
  const text = s.kind === 'pdf' ? reflow(body.split('\n').map(l => l.trim()).filter(Boolean)).join('\n') : body;
  const chars = text.replace(/\s+/g, '').length;
  return { ...base, text, chars, missing: false, pages: meta ? meta.pages : null, regError: meta ? meta.error : null };
}

// ---------------------------------------------------------------------------
// text normalisation for harvested sources
// ---------------------------------------------------------------------------
const PDF_NOISE = [
  /^\d{1,4}\s*\|?\s*(?:page|pg\b)/i,
  /^page \d+( of \d+)?$/i,
  /^\d{1,4}\s*\|\s*[a-zA-Z ]{1,15}$/i,          // "2  |  P  a  g  e"
  /^\d{1,4}$/,
  /^[ivxlc]+\s*\.{0,1}\s*\d{1,4}\s*$/i,
  /^\.{4,}\s*\d{1,4}$/,
  /^\s*(?:higher education commission|government of pakistan|islamabad)\s*$/i
];
const PAGE_NOISE = [
  /^turn on more accessible mode$/i, /^turn off more accessible mode$/i, /^sign in$/i,
  /^close$/i, /^quick links$/i, /^page content$/i, /^page image$/i, /^go$/i, /^-\s*$/,
  /^# ?hec$/i, /^english$/i, /^contact us$/i, /^filter$/i, /^reset filter$/i, /^default$/i,
  /^a to z$/i, /^z to a$/i, /^showing$/i, /^out of$/i, /^results$/i, /^click for registration$/i,
  /^go to hec e-portal$/i, /^hec career development$/i, /^do you want to grow.*$/i,
  /^get enrolled today$/i, /^skip to (main )?content$/i, /^\d{1,3}$/,
  /^notification date:$/i                        // kept attached to its title line instead
];

function dropNoise(lines, patterns) {
  return lines.filter(l => {
    const t = l.replace(/^#+\s*/, '').trim();
    if (!t) return false;
    return !patterns.some(re => re.test(t));
  });
}

/** PDF text layers break words and lines; this rejoins wrapped prose without changing words. */
function reflow(lines) {
  const out = [];
  let para = '';
  const flush = () => { if (para.trim()) out.push(para.replace(/\s+/g, ' ').trim()); para = ''; };
  for (const line of lines) {
    if (/^\s*#/.test(line) || /^[-•*]\s/.test(line) || /^\|/.test(line) || /^\(?[ivxlcdm]{1,5}\)?[.:)]\s/i.test(line) || /^\d{1,2}(\.\d{1,2}){0,3}[.)]?\s/.test(line) && line.length < 80) {
      flush(); out.push(line.trim()); continue;
    }
    if (!para) para = line;
    else if (/[^-]$/.test(para) && /^[a-z(]/.test(line)) para = `${para} ${line}`;
    else if (/[^-]-$/.test(para)) para = para.slice(0, -1) + line;
    else para = `${para} ${line}`;
    if (/[.!?:]["')\]]?$/.test(line)) flush();
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// section splitting on the document's own structure
// ---------------------------------------------------------------------------
const SUB_CLAUSE = /^(\d{1,2}\.\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+(.*)$/;

/**
 * A top-level policy heading in HEC documents is "1. Scope" / "II. Definitions" in
 * the contents page and "III: GENERAL EDUCATION REQUIREMENT:" in the body.
 * Rejected: dot-leader table-of-contents lines, sentences, and bare numbers
 * ("1. 5" style page artefacts), which would otherwise create empty sections.
 */
function matchTopHeading(line) {
  const t = line.replace(/^#+\s*/, '').trim();
  if (!t || t.length > 90) return null;
  if (/\.{5,}/.test(t)) return null;                 // "Scope........... 12"
  const m = t.match(/^([IVXLCDM]{1,5}|\d{1,2})[.:]\s+([A-Za-z][^.\n]*)$/);
  if (!m) return null;
  let head = m[2].trim();
  if (/[;:]$/.test(head)) {
    // A heading may end with a colon; a running sentence may not look like one.
    const stripped = head.replace(/[;:]$/, '').trim();
    const words = stripped.split(/\s+/);
    const isHeadingCase = words.length <= 9 && words.every(w => /^[A-Z][a-z]*$|^[A-Z]+$/.test(w));
    if (!isHeadingCase) return null;
    head = stripped;
  }
  if (head.length < 4 || head.length > 72) return null;
  if (head.replace(/[^A-Za-z]/g, '').length < 4) return null;
  if ((head.match(/\s/g) || []).length > 11) return null;
  return `${m[1]}. ${head}`;
}

/**
 * A PDF table of contents repeats every clause heading, so each contents entry
 * scans as a heading with almost nothing under it while the same heading appears
 * again in the body with the real text. Those entries are folded back into the
 * preceding section — the contents page stays a single block and nothing is lost.
 */
function collapseTocSections(sections) {
  const weight = new Map();
  for (const s of sections) {
    const k = s.heading.replace(/^#+\s*/, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    weight.set(k, Math.max(weight.get(k) || 0, s.body.length));
  }
  const out = [];
  for (const s of sections) {
    const k = s.heading.replace(/^#+\s*/, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const duplicate = (weight.get(k) || 0) > s.body.length;
    if (out.length && s.body.length < 1200 && duplicate) { out[out.length - 1].body = `${out[out.length - 1].body}\n\n${s.body}`; continue; }
    out.push({ ...s });
  }
  return out;
}

/**
 * HEC web pages print their real title as a plain line under the navigation, not as
 * a markdown heading, so those blocks would otherwise carry no section title at all.
 * A line is accepted as a title only on unmistakable evidence — a short, unpunctuated
 * phrase immediately introducing a substantial paragraph. Otherwise there is no title
 * and the caller's fallback label is used; a section is never given an invented name.
 */
const NAVISH = /^(services|universities|students|faculty|home|about us|contact us|quick links|page content|related links|useful links|important links|downloads?|resources|faqs?|overview|introduction|currently selected|select an option|search|filter|results|showing .*|top links)$/i;

function detectPageTitle(body) {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length - 1, 25); i++) {
    const t = lines[i].replace(/^#+\s*/, '').replace(/\p{Cf}/gu, '').trim();
    if (t.length < 12 || t.length > 70) continue;
    if (NAVISH.test(t)) continue;
    if (/^[-*•|]/.test(t) || /^\d/.test(t)) continue;
    if (/[<>]/.test(t)) continue;
    if (/[.,;:]$/.test(t)) continue;
    const words = t.split(/\s+/);
    if (words.length < 2 || words.length > 8) continue;
    if (!/[A-Za-z]{3}/.test(t)) continue;
    if ((lines[i + 1] || '').replace(/^#+\s*/, '').length < 160) continue;
    return t;
  }
  return null;
}

function splitSections(text, maxChars = 5200, fallbackHeading = 'PRELIMINARY') {
  const lines = text.split('\n');
  const hashHeadings = lines.filter(l => /^#{1,4}\s+\S/.test(l)).length;
  const sections = [];
  let cur = { heading: '', lines: [] };
  const flush = () => {
    const body = cur.lines.join('\n').trim();
    if (body) sections.push({ heading: cur.heading || detectPageTitle(body) || fallbackHeading, body });
    cur = { heading: '', lines: [] };
  };
  for (const line of lines) {
    // Web pages come out of the harvester with real <h1>–<h4> headings; use them.
    if (hashHeadings >= 2 && /^#{1,4}\s+\S/.test(line)) {
      const t = line.replace(/^#+\s*/, '').trim();
      if (t.length > 3) { flush(); cur.heading = t; cur.lines = [line]; continue; }
    }
    const h = matchTopHeading(line);
    if (h) { flush(); cur.heading = h; cur.lines = [line]; continue; }
    cur.lines.push(line);
  }
  flush();
  const merged = collapseTocSections(sections);
  if (!merged.length && text.trim().length > 40) return [{ heading: 'FULL TEXT', body: text.trim() }];

  // Long sections are split further at their own clause numbers.
  const out = [];
  for (const s of merged) {
    if (s.body.length <= maxChars) { out.push(s); continue; }
    const parts = [];
    let c = { heading: s.heading, lines: [] };
    for (const line of s.body.split('\n')) {
      const m = line.match(SUB_CLAUSE);
      if (m && c.lines.join('\n').length > maxChars / 2) {
        if (c.lines.length) parts.push({ heading: c.heading, body: c.lines.join('\n').trim() });
        c = { heading: `${m[1]} ${m[2]}`.slice(0, 90), lines: [line] };
      } else c.lines.push(line);
    }
    if (c.lines.length) parts.push({ heading: c.heading, body: c.lines.join('\n').trim() });
    for (const p of parts) {
      if (p.body.length <= maxChars * 1.5) { out.push(p); continue; }
      // Last resort: keep whole lines together, never cut a line in half.
      let acc = '';
      for (const line of p.body.split('\n')) {
        if (acc && acc.length + line.length + 1 > maxChars) { out.push({ heading: p.heading, body: acc }); acc = ''; }
        acc = acc ? `${acc}\n${line}` : line;
      }
      if (acc) out.push({ heading: p.heading, body: acc });
    }
  }
  return out;
}

/**
 * A 200-character clause is a weak retrieval chunk, and its neighbours belong to
 * the same policy. Consecutive short sections are packed together; because every
 * section body starts with its own heading, packing keeps all headings and all
 * words exactly as the source has them.
 */
function packSections(sections, minChars = 900, target = 2600) {
  const out = [];
  let buf = null;
  const flush = () => { if (buf) { out.push(buf); buf = null; } };
  for (const s of sections) {
    if (s.body.length >= minChars) { flush(); out.push(s); continue; }
    if (!buf || buf.body.length >= target) { flush(); buf = { heading: s.heading, body: s.body }; continue; }
    buf = { heading: buf.heading, body: `${buf.body}\n\n${s.body}` };
  }
  flush();
  return out;
}

function sectionKey(docId, heading, i) {
  const slugPart = heading.replace(/^#*\s*/, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 46).toUpperCase();
  return `${docId}_${i}_${slugPart || 'PART'}`;
}

/**
 * The name a section gets when the source page or PDF gives it no heading of its
 * own: the document's own title, which is the accurate answer to "where is this
 * text from?" and beats a meaningless placeholder in both citations and embeddings.
 */
function fallbackLabel(doc) {
  let head = doc.title.split(/[:—]/)[0].trim();
  if (head.length > 62) head = head.slice(0, 62).replace(/\s+\S*$/, '');
  return head || doc.id;
}

const RETRIEVED_ON = new Date().toISOString().slice(0, 10);

function metadataLines(doc, src, heading) {
  return [
    `Title: ${doc.title}`,
    `Authority: Higher Education Commission (HEC) of Pakistan`,
    `Section: ${heading.replace(/^#*\s*/, '').slice(0, 120)}`,
    `Official page: ${src.page || src.url}`,
    `Source file: ${src.url}`,
    `Version: ${doc.version}`,
    `Notification / publication date: ${doc.publicationDate}`,
    `Effective date: ${doc.effectiveDate}`,
    `Legal status: ${doc.legalStatus}`,
    `Extracted verbatim from the official HEC source on ${RETRIEVED_ON}; only layout was repaired (line wraps, page markup) — no wording was changed.`
  ].join('\n');
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------
/** node buildHecCorpus.cjs --probe=hec_ugep_undergraduate — section structure, source by source. */
function probeDocument(id) {
  const doc = DOCS.find(d => d.id === id);
  if (!doc) { console.error(`unknown document ${id}`); console.error(DOCS.map(d => d.id).join('\n')); process.exit(1); }
  console.log(`# ${doc.id} — ${doc.title}`);
  for (const name of doc.parts) {
    const src = loadSource(name);
    console.log(`\n[${name}] ${src.kind} chars=${src.chars || 0}${src.missing ? ' MISSING' : ''}`);
    if (src.missing || src.chars < 300) continue;
    const raw = splitSections(src.text, 5200, fallbackLabel(doc));
    const packed = packSections(raw);
    console.log(`  sections: ${raw.length} -> packed: ${packed.length}`);
    raw.forEach((s, i) => console.log(`   ${String(i + 1).padStart(3)} ${String(s.body.length).padStart(6)}  ${s.heading.slice(0, 78)}`));
  }
}

/**
 * Proof of the verbatim rule: every section body written into the corpus must be an
 * exact (whitespace-normalised) substring of the harvested official source text.
 * node buildHecCorpus.cjs --verify
 */
function verifyWritten() {
  const flat = s => s.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  let checked = 0, failed = 0, dropped = 0;
  for (const doc of DOCS) {
    const p = path.join(OUT_DIR, `${doc.id}.txt`);
    if (!fs.existsSync(p)) { console.log(`MISSING FILE ${doc.id}`); failed++; continue; }
    const file = fs.readFileSync(p, 'utf8');
    const hay = flat(doc.parts.map(n => loadSource(n).text || '').join(' '));
    const bodies = [];
    const chunks = file.split('\n[SECTION: ').slice(1);
    for (const raw of chunks) {
      const body = raw.split('\n');
      body.shift();                                   // the heading line
      const end = body.findIndex(l => l === '');
      const text = flat(body.slice(end + 1).join('\n'));
      if (!text) continue;
      bodies.push(text);
      checked++;
      if (!hay.includes(text)) {
        failed++;
        let lo = 0, hi = text.length;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (hay.includes(text.slice(0, mid))) lo = mid; else hi = mid - 1;
        }
        const at = hay.indexOf(text.slice(0, lo));
        console.log(`NOT VERBATIM ${doc.id} :: ${raw.split('\n')[0].slice(0, 60)}`);
        console.log(`   corpus   : …${text.slice(Math.max(0, lo - 20), lo + 70)}`);
        console.log(`   source   : …${at >= 0 ? hay.slice(Math.max(0, at + lo - 20), at + lo + 70) : '(no common prefix)'}"`);
      }
    }
    // The other direction: nothing in the source may go missing from the file.
    const corpus = flat(bodies.join(' '));
    for (const name of doc.parts) {
      const src = loadSource(name);
      if (src.missing || src.chars < 300) continue;
      const missing = src.text.split('\n').map(flat).filter(l => l.length > 2 && !corpus.includes(l));
      if (missing.length) {
        dropped += missing.length;
        console.log(`DROPPED LINES ${doc.id}/${name}: ${missing.length} e.g. ${missing.slice(0, 3).map(m => m.slice(0, 60)).join(' | ')}`);
      }
    }
  }
  console.log(`\n[HEC verify] sections checked=${checked} not-verbatim=${failed} dropped-source-lines=${dropped}`);
  if (failed || dropped) process.exitCode = 1;
}

function reportSources() {
  const bad = [];
  for (const name of Object.keys(SRC)) {
    const s = loadSource(name);
    const line = `${String(s.chars).padStart(7)} ${s.kind.padEnd(4)} ${name.padEnd(20)} ${s.url.replace(H, '')}${s.missing ? '  << NOT ACQUIRED (' + s.note + ')' : ''}`;
    if (s.missing || s.chars < 300) bad.push(line);
    else console.log(line);
  }
  console.log('\n--- weak / missing sources ---');
  bad.forEach(l => console.log(l));
  console.log(`total ${Object.keys(SRC).length}, weak/missing ${bad.length}`);
}

function build({ writeManifest = false, only = null } = {}) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), retrievedOn: RETRIEVED_ON, documents: [], gaps: [] };

  for (const doc of DOCS) {
    if (only && doc.id !== only) continue;
    const blocks = [];
    const label = fallbackLabel(doc);
    const labelled = new Map();
    const stats = { id: doc.id, title: doc.title, coverage: doc.coverage, sections: 0, chars: 0, sources: [] };
    for (const name of doc.parts) {
      const src = loadSource(name);
      stats.sources.push({ source: name, kind: src.kind, url: src.url, chars: src.chars || 0, missing: !!src.missing });
      if (src.missing) { report.gaps.push({ docId: doc.id, source: name, url: src.url, reason: `not acquired (${src.note})` }); continue; }
      if (src.chars < 300) { report.gaps.push({ docId: doc.id, source: name, url: src.url, reason: `acquired but only ${src.chars} characters of usable text${src.regError ? ' — ' + src.regError : ''}` }); continue; }
      const sections = packSections(splitSections(src.text, 5200, label));
      if (!sections.length) { report.gaps.push({ docId: doc.id, source: name, url: src.url, reason: 'parsed text produced no sections' }); continue; }
      sections.forEach((s) => {
        let heading = s.heading;
        if (heading === label) {
          const n = (labelled.get(heading) || 0) + 1;
          labelled.set(heading, n);
          if (n > 1) heading = `${label} (part ${n})`;
        }
        const key = sectionKey(doc.id, heading, blocks.length + 1);
        blocks.push([
          `[SECTION: ${key}]`,
          heading.startsWith('#') ? heading : `# ${heading}`,
          metadataLines(doc, src, heading),
          '',
          s.body
        ].join('\n'));
        stats.chars += s.body.length;
      });
      stats.sections += sections.length;
    }
    if (!blocks.length) {
      report.documents.push({ ...stats, written: false });
      console.log(`SKIP ${doc.id}: no usable source text`);
      continue;
    }
    const header = [
      `# ${doc.title}`,
      `Authority: Higher Education Commission (HEC) of Pakistan`,
      `Jurisdiction: Pakistan (Federal) — higher education`,
      `Version: ${doc.version} | Published/notified: ${doc.publicationDate} | Effective: ${doc.effectiveDate} | Status: ${doc.legalStatus}`,
      `Provenance: sections below carry the canonical HEC URL for the document they were extracted from.`,
      `Coverage area: ${doc.coverage}`,
      doc.note ? `Verification note: ${doc.note}` : null,
      '',
      blocks.join('\n\n')
    ].filter(x => x !== null).join('\n');
    const outPath = path.join(OUT_DIR, `${doc.id}.txt`);
    fs.writeFileSync(outPath, header + '\n', 'utf8');
    report.documents.push({ ...stats, written: true, file: `rag/documents/hec/${doc.id}.txt`, bytes: fs.statSync(outPath).size });
    console.log(`WROTE ${doc.id}: ${blocks.length} sections, ${stats.chars} chars`);
  }

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');

  if (writeManifest) registerManifest(report);
  console.log(`\n[HEC corpus] documents=${report.documents.length} written=${report.documents.filter(d => d.written).length} gaps=${report.gaps.length}`);
  console.log(`[HEC corpus] report: rag/.staging/HEC/corpus_build.json`);
}

const MANIFEST_TEMPLATE = doc => ({
  id: doc.id,
  localFilePath: `rag/documents/hec/${doc.id}.txt`,
  title: doc.title,
  documentType: doc.documentType,
  jurisdiction: 'Pakistan (Federal) — Higher Education',
  issuingAuthority: 'Higher Education Commission (HEC) of Pakistan',
  sourceURL: (SRC[doc.parts[0]] || {}).page || (SRC[doc.parts[0]] || {}).url || `${H}/english/policies/Pages/default.aspx`,
  sourceDomain: 'hec.gov.pk',
  publicationDate: doc.publicationDate,
  effectiveDate: doc.effectiveDate,
  version: doc.version,
  legalStatus: doc.legalStatus,
  sourcePriority: 1,
  language: 'en',
  note: doc.note
});

function registerManifest(report) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const written = new Set(report.documents.filter(d => d.written).map(d => d.id));
  let added = 0, updated = 0, skipped = 0;
  for (const doc of DOCS) {
    if (!written.has(doc.id)) { skipped++; continue; }
    const entry = MANIFEST_TEMPLATE(doc);
    const i = manifest.documents.findIndex(d => d.id === doc.id);
    if (i === -1) { manifest.documents.push(entry); added++; }
    else {
      const keep = manifest.documents[i];
      manifest.documents[i] = { ...keep, ...entry, checksum: keep.checksum, lastVerifiedAt: keep.lastVerifiedAt };
      updated++;
    }
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[HEC corpus] manifest: ${added} added, ${updated} updated, ${skipped} skipped (no usable text)`);
}

const argv = process.argv.slice(2);
if (argv.includes('--sources')) reportSources();
else if (argv.includes('--verify')) verifyWritten();
else if (argv.some(a => a.startsWith('--probe='))) probeDocument(argv.find(a => a.startsWith('--probe=')).split('=')[1]);
else build({
  writeManifest: argv.includes('--manifest'),
  only: (argv.find(a => a.startsWith('--doc=')) || '').split('=')[1] || null
});
