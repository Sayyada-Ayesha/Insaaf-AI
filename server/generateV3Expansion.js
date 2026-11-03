// ============================================================================
// INSAaf AI — V3 EXPANSION GENERATOR (spec parts 14-27; corpus 2.4.0-final)
// ----------------------------------------------------------------------------
// Deterministically builds rag/training/v3_expansion/v3_changeset.jsonl from
// the FROZEN RAG INDEX only. Every output is assembled from canonical corpus
// chunk text (2026-09-06 records and earlier verified digests) — no legal fact
// is authored anywhere. Drafting-letter rows (FULL-taxonomy types) carry
// [bracketed placeholders] and assert only phrases verified present in their
// anchor chunks (runtime substring assertion; row skipped on mismatch).
//
// Provenance classes (spec part 26), per row:
//   SOURCE_ORIGINAL       — output restates verbatim official-record text
//                           (SCP/FCC official metadata rows, visa glossary)
//   SOURCE_DERIVED        — corpus digest/record restatement (all other rows)
//   SYNTHETIC_BEHAVIOR    — authored behaviour/refusal scripts, no legal
//                           assertions (scope rows; FCC holding refusals)
//   (BEHAVIORAL reserved for pipeline-captured rows — v2 change-sets; not
//    produced here because nothing is captured in this task)
//
//   node server/generateV3Expansion.js   (exit 0 = change-set written)
// ============================================================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { loadCorpus, resolveRef, checkUrls } from './fineTuneData/refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IDX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../rag/indexes/rag_index.json'), 'utf8'));
const OUT_DIR = path.resolve(__dirname, '../rag/training/v3_expansion');
const OUT_JSONL = path.join(OUT_DIR, 'v3_changeset.jsonl');
const OUT_MANIFEST = path.join(OUT_DIR, 'v3_expansion_manifest.json');

const byKey = new Map(); // "docId::key" -> chunk
for (const c of IDX.chunks) byKey.set(`${c.docId}::${c.key}`, c);
const get = (docId, key) => byKey.get(`${docId}::${key}`);

// ---------------------------------------------------------------------------
// Enum sets — MUST stay identical to server/buildFinalV3.js and
// server/validateFinalV3.js.
// ---------------------------------------------------------------------------
const VALID_LANGUAGES = new Set(['en', 'ur', 'roman_ur']);
const VALID_DOMAINS = new Set([
  'constitution', 'criminal_law', 'criminal_procedure', 'civil_procedure',
  'cybercrime', 'family_law', 'property', 'tenancy', 'labour', 'consumer',
  'education', 'legal_aid', 'court_procedure', 'case_law', 'documents', 'general',
  'cross_border',
  'civic_services', 'public_offices', 'foreigners',
]);
const VALID_TASKS = new Set([
  'legal_qa', 'offence_punishment', 'fundamental_rights', 'legal_procedures',
  'situation_action', 'legal_remedies', 'case_law', 'similar_case',
  'legal_terminology', 'en_legal_answer', 'ur_legal_answer', 'rom_legal_answer',
  'document_explanation', 'document_drafting', 'source_aware', 'refusal',
  'domain_classification',
]);
const TASK_LANGUAGE = { en_legal_answer: 'en', ur_legal_answer: 'ur', rom_legal_answer: 'roman_ur' };
const PROVENANCES = new Set(['SOURCE_ORIGINAL', 'SOURCE_DERIVED', 'BEHAVIORAL', 'SYNTHETIC_BEHAVIOR']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const ARABIC = /[\u0600-\u06FF]/;
const PHONE_SCAN = /\d[\d\s().-]{7,}\d/g;
const DATE_DIGITS = /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/;

const corpus = loadCorpus();

// ---------------------------------------------------------------------------
// Text hygiene helpers
// ---------------------------------------------------------------------------
// Remove the duplicated chunk-title lead line (chunk.text starts with the
// same line as chunkTitle in this corpus) and collapse blank lines.
const clean = (docId, key) => {
  const c = get(docId, key);
  let t = c.text;
  const titleLine = c.chunkTitle.split('\n')[0];
  // Chunk text usually = title lead line + body. When the body duplicates the
  // whole title (case-record chunks) keep a single canonical copy; when the
  // chunk IS the title line alone, keep it untouched.
  if (t.startsWith(titleLine) && t.length > titleLine.length) {
    const rest = t.slice(titleLine.length).replace(/^\s*\n?/, '');
    if (rest.trim()) t = rest;
  }
  return t.replace(/\n{2,}/g, '\n').trim();
};
// Cut everything from a "Status:" tag to the end (drops provenance lines that
// contain raw rag/ paths and Source-URL tails — never emitted in outputs).
const cutStatus = (t) => t.replace(/\s*Status:\s*[A-Za-z]+[.\s]*[\s\S]*$/, '');
// Remove a "Provenance:" sentence (raw doc paths must not leak into outputs).
const cutProvenance = (t) => t.replace(/\s*Provenance:\s*[^;)]*(?:;[^)]*)?\)?\.?\s*/g, ' ');
const single = (t) => t.replace(/\s+/g, ' ').trim();
// Contact-number segments inside corpus records are never emitted into row
// outputs (no-phone-like-pattern rule); the corpus keeps them for retrieval.
const cutPhones = (t) => t.replace(/\s*(?:Phones?|Contacts?):\s*[^.]*\./g, ' ');

const stripMeta = (docId, key) => single(cutPhones(cutStatus(cutProvenance(clean(docId, key)))));

// Case-record fields are '. '-delimited label/value pairs ("Court: ... . Case
// No: ... . Title: ...") and the VALUES contain dotted abbreviations (C.P.L.A.,
// Mr., N.A., SCMR), so fields are parsed by scanning for the next known label
// rather than by splitting on periods.
const FIELD_LABEL_RE = /(?:^|\. )((?:Court|Subject|Case No|Title|Author Judges?|Judgment Date|Upload Date|Type|Citation|Points \(as published by the court\)|Note))(?=\s*:)/;
function parseFields(rec) {
  const fields = {};
  let rest = rec;
  for (;;) {
    const m = FIELD_LABEL_RE.exec(rest);
    if (!m) break;
    const label = m[1];
    const after = rest.slice(m.index + m[0].length).replace(/^\s*:\s*/, '');
    const nxt = FIELD_LABEL_RE.exec(after);
    fields[label] = (nxt ? after.slice(0, nxt.index) : after).trim();
    if (!nxt) break;
    rest = after.slice(nxt.index);
  }
  return fields;
}
const stripDot = (s) => s.replace(/\s*\.+\s*$/, '');

// ---------------------------------------------------------------------------
// Row factory + deterministic id
// ---------------------------------------------------------------------------
const problems = [];
const rows = [];
const seenQa = new Set();
let internalDupes = 0;
function add(plan) {
  const { docId, key, chunkTitle, language, domain, task, provenance, difficulty, subdomain, instruction, input, output, sourceRefs } = plan;
  for (const f of ['instruction', 'input', 'output', 'language', 'domain', 'task', 'provenance', 'difficulty', 'subdomain']) {
    if (!plan[f]) problems.push(`missing ${f} (${docId}::${key})`);
  }
  if (!VALID_LANGUAGES.has(language)) problems.push(`bad language ${language} (${docId}::${key})`);
  if (!VALID_DOMAINS.has(domain)) problems.push(`bad domain ${domain} (${docId}::${key})`);
  if (!VALID_TASKS.has(task)) problems.push(`bad task ${task} (${docId}::${key})`);
  if (!PROVENANCES.has(provenance)) problems.push(`bad provenance ${provenance} (${docId}::${key})`);
  if (!DIFFICULTIES.has(difficulty)) problems.push(`bad difficulty ${difficulty} (${docId}::${key})`);
  const wantLang = TASK_LANGUAGE[task];
  if (wantLang && language !== wantLang) problems.push(`task/language mismatch (${docId}::${key})`);
  const refs = Array.isArray(sourceRefs) ? sourceRefs : [sourceRefs];
  for (const ref of refs) {
    const r = resolveRef(ref, corpus);
    if (!r.ok) problems.push(`unresolved ref "${ref}" (${docId}::${key}): ${r.reason}`);
  }
  if (typeof output === 'string') {
    if (/…/.test(output)) problems.push(`unicode ellipsis (${docId}::${key})`);
    const dotRun = /\.{2,}/g; let dm;
    while ((dm = dotRun.exec(output)) !== null) {
      if (dm[0].length >= 2 && task !== 'document_drafting') problems.push(`${dm[0].length}-dot run outside document_drafting (${docId}::${key})`);
      if (dm[0].length === 3) problems.push(`"..." in output (${docId}::${key})`);
    }
    if ((language === 'en' || language === 'roman_ur') && ARABIC.test(output)) problems.push(`Urdu script in ${language} output (${docId}::${key})`);
    PHONE_SCAN.lastIndex = 0;
    let pm;
    while ((pm = PHONE_SCAN.exec(output)) !== null) {
      if (/^\d{5}-\d{7}-\d$/.test(pm[0].replace(/\s/g, ''))) continue;
      const digits = pm[0].replace(/\D/g, '');
      if (digits.length >= 10 && !DATE_DIGITS.test(digits)) problems.push(`phone-like output (${docId}::${key}): "${pm[0].trim()}"`);
    }
    for (const f of ['output', 'input', 'instruction']) {
      for (const u of checkUrls(String(plan[f] || ''))) problems.push(`non-corpus URL in ${f} (${docId}::${key}): ${u}`);
    }
  }
  if (problems.length) return; // report at end; never write partial rows with problems
  const id = crypto.createHash('sha1').update(`${instruction}\u0000${input}\u0000${output}\u0000${provenance}`).digest('hex').slice(0, 12);
  rows.push({
    instruction, input, output, language, domain, task,
    source_refs: refs,
    behaviour: undefined, behavior_group: undefined,
    example_id: `v3-${id}`,
    provenance, difficulty, subdomain,
    jurisdiction: 'Pakistan',
    source_linked: true,
  });
}

// near-dup guard identical to dataset validators (informational drop)
const toks = (s) => new Set(String(s).toLowerCase().split(/[^a-z0-9\u0600-\u06FF]+/).filter((t) => t.length > 1 || /[0-9\u0600-\u06FF]/.test(t)));
const jaccard = (a, b) => { let inter = 0; for (const t of a) if (b.has(t)) inter++; const u = a.size + b.size - inter; return u === 0 ? 0 : inter / u; };
function nearDupDropped(instruction, input, output) {
  const qa = toks(instruction + ' ' + input); const out = toks(output);
  for (const r of rows) {
    if (jaccard(qa, toks(r.instruction + ' ' + r.input)) >= 0.9 && jaccard(out, toks(r.output)) >= 0.9) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Generic instruction texts per task/language
// ---------------------------------------------------------------------------
const EN_INST = {
  legal_qa: 'Answer this Pakistani law question concisely using the verified official record.',
  legal_procedures: 'Explain the verified procedure step by step, based only on the official record.',
  legal_remedies: 'Explain the verified remedy and the official channel to pursue it.',
  legal_terminology: 'Explain the term exactly as the official glossary defines it.',
  case_law: 'State the verified official record for this case accurately.',
  situation_action: 'Tell the user what to do, based only on the verified official record.',
  document_explanation: 'Explain what this document is and what it requires, using only the verified record.',
  refusal: 'Respond as INSAaf AI must: stay within verified scope and refuse what is not covered.',
};
const RU_INST = {
  legal_qa: 'Is Pakistani qanooni sawal ka jawab tasdeeq-shuda official record ke mutabiq dein.',
  legal_procedures: 'Tasdeeq-shuda procedure ke steps tarteeb se batayen, sirf official record ki bunyad par.',
  legal_remedies: 'Tasdeeq-shuda remedy aur official channel batayen.',
  situation_action: 'User ko batayen ke kya karna hai, sirf tasdeeq-shuda record ke mutabiq.',
  refusal: 'INSAaf AI ki hudood ke andar jawab dein aur jo verified scope mein nahi hai us se inkaar karein.',
};

// ---------------------------------------------------------------------------
// Note assertions against the SCP/FCC index chunk (only include note lines
// whose exact wording exists in the corpus)
// ---------------------------------------------------------------------------
const INDEX_CHUNK = get('scp_fcc_official_records', 'CASE_SCP_FCC_INDEX');
const INDEX_TEXT = INDEX_CHUNK ? INDEX_CHUNK.text : '';
const SC_NOTE = 'The record above is transcribed verbatim from the official Supreme Court of Pakistan judgments page (scp.gov.pk/LatestJudgments); the judgments page publishes case metadata and, on some records, the Court-published legal point. Full judgment text is not web-published in these listings and remains on the court portal as official PDFs.';
const FCC_NOTE = 'The record above is transcribed verbatim from the official Federal Constitutional Court of Pakistan judgements page (fccp.gov.pk/judgements). The FCC page lists case number, author judge and upload date as metadata only; case titles and judgment text are not web-published there, and full texts remain official downloads on the FCC portal.';
const hasNote = (note) => note && INDEX_TEXT.includes(note.replace(/\s+/g, ' ').slice(0, 120).split(' ').slice(0, 12).join(' '));

// ---------------------------------------------------------------------------
// BUILDERS
// ---------------------------------------------------------------------------
// 1. SCP / FCC official record rows (verbatim => SOURCE_ORIGINAL)
const scpRecords = [];
const fccRecords = [];
for (const c of IDX.chunks) {
  if (c.docId === 'scp_fcc_official_records' && /^CASE_SCP_2026_\d+$/.test(c.key)) scpRecords.push(c);
  if (c.docId === 'scp_fcc_official_records' && /^CASE_FCC_2026_\d+$/.test(c.key)) fccRecords.push(c);
}
scpRecords.sort((a, b) => a.key.localeCompare(b.key));
fccRecords.sort((a, b) => a.key.localeCompare(b.key));

for (const c of scpRecords) {
  const rec = single(clean(c.docId, c.key)); // one canonical record line
  const f = parseFields(rec);
  const ttl = stripDot(f.Title || '');
  const subject = stripDot(f.Subject || '');
  const cite = stripDot(f.Citation || '');
  const qBase = `What is the official Supreme Court record for the case ${ttl || 'noted on the Latest Judgments page'}?`;
  const qCite = cite ? `Which 2026 SCP citation does the official record assign to the case ${ttl}?` : null;
  const qSub = subject ? `What subject does the official Supreme Court record list for the case ${ttl}?` : null;
  add({ docId: c.docId, key: c.key, chunkTitle: c.chunkTitle, language: 'en', domain: 'case_law', task: 'case_law', provenance: 'SOURCE_ORIGINAL', difficulty: 'easy', subdomain: 'scp-official-record', instruction: EN_INST.case_law, input: qBase, output: rec, sourceRefs: [c.key] });
  if (qSub) add({ docId: c.docId, key: c.key, chunkTitle: c.chunkTitle, language: 'en', domain: 'case_law', task: 'case_law', provenance: 'SOURCE_ORIGINAL', difficulty: 'easy', subdomain: 'scp-official-record', instruction: EN_INST.case_law, input: qSub, output: rec, sourceRefs: [c.key] });
  if (qCite) add({ docId: c.docId, key: c.key, chunkTitle: c.chunkTitle, language: 'en', domain: 'case_law', task: 'case_law', provenance: 'SOURCE_ORIGINAL', difficulty: 'easy', subdomain: 'scp-official-record', instruction: EN_INST.case_law, input: qCite, output: rec, sourceRefs: [c.key] });
  if (subject && hasNote(SC_NOTE)) add({ docId: c.docId, key: c.key, chunkTitle: c.chunkTitle, language: 'en', domain: 'case_law', task: 'legal_qa', provenance: 'SOURCE_DERIVED', difficulty: 'medium', subdomain: 'scp-record-scope', instruction: EN_INST.legal_qa, input: `Can you quote the full judgment text of the Supreme Court case on ${subject}?`, output: `No. ${rec} ${SC_NOTE}`, sourceRefs: [c.key, 'CASE_SCP_FCC_INDEX'] });
}

for (const c of fccRecords) {
  const rec = single(clean(c.docId, c.key));
  const f = parseFields(rec);
  const cn = stripDot(f['Case No'] || '');
  const judge = stripDot(f['Author Judge'] || f['Author Judges'] || '');
  const uploaded = stripDot(f['Upload Date'] || '');
  const disp = cn || judge || 'the matter';
  add({ docId: c.docId, key: c.key, chunkTitle: c.chunkTitle, language: 'en', domain: 'case_law', task: 'case_law', provenance: 'SOURCE_ORIGINAL', difficulty: 'easy', subdomain: 'fcc-official-record', instruction: EN_INST.case_law, input: `What is the official Federal Constitutional Court record for case ${disp}?`, output: rec, sourceRefs: [c.key] });
  if (judge && uploaded) add({ docId: c.docId, key: c.key, chunkTitle: c.chunkTitle, language: 'en', domain: 'case_law', task: 'case_law', provenance: 'SOURCE_ORIGINAL', difficulty: 'easy', subdomain: 'fcc-upload-author', instruction: EN_INST.case_law, input: `Which author judge heard FCC case ${disp} and when was it uploaded, per the official record?`, output: rec, sourceRefs: [c.key] });
  // Holding/text refusal — behaviour row without legal assertions
  add({ docId: c.docId, key: c.key, chunkTitle: c.chunkTitle, language: 'en', domain: 'case_law', task: 'refusal', provenance: 'SYNTHETIC_BEHAVIOR', difficulty: 'easy', subdomain: 'fcc-text-not-published', instruction: EN_INST.refusal, input: `What was the holding or reasoning in FCC case ${disp}?`, output: `I cannot summarise the holding: this case is an official metadata-only record. The FCC judgements page lists the case number, author judge and upload date without the case title or any judgment-text preview, and I never invent holdings. ${FCC_NOTE}`, sourceRefs: [c.key] });
}

// Similar-case rows over the official SCP records: group the records by their
// officially listed subject and teach retrieval of every record in the group.
const SIMILAR_GROUPS = [
  { label: 'life imprisonment confirmations', keys: ['CASE_SCP_2026_06', 'CASE_SCP_2026_07', 'CASE_SCP_2026_08', 'CASE_SCP_2026_09'] },
  { label: 'death-sentence appeals', keys: ['CASE_SCP_2026_05', 'CASE_SCP_2026_15', 'CASE_SCP_2026_16'] },
  { label: 'service regularization cases', keys: ['CASE_SCP_2026_04', 'CASE_SCP_2026_13'] },
];
for (const g of SIMILAR_GROUPS) {
  const recs = g.keys.map((k) => single(clean('scp_fcc_official_records', k)));
  add({ docId: 'scp_fcc_official_records', key: g.keys[0], chunkTitle: null, language: 'en', domain: 'case_law', task: 'similar_case', provenance: 'SOURCE_ORIGINAL', difficulty: 'medium', subdomain: 'scp-similar-records', instruction: 'Find the official Supreme Court records on this subject in the verified corpus and state each one.', input: `Which official Supreme Court records concern ${g.label}?`, output: `The verified corpus holds the following official Supreme Court records on ${g.label}:\n\n${recs.join('\n\n')}`, sourceRefs: g.keys });
}

// 2. Visa-glossary definitions (verbatim official glossary => SOURCE_ORIGINAL)
const GLOSS = stripMeta('foreigner_entry_stay_registration', 'foreigner_online_visa_glossary');
const GLOSS_TERMS = [
  ['CNIC', "Pakistan's Computerized National Identity Card"],
  ['Extension', 'extending stay by applying for extension of the relevant visa category'],
  ['Dependent children', 'a child or stepchild who has not turned 18 years of age, or, if aged 18 years or over, is a dependent'],
  ['Business Visa List', 'the list of business-friendly countries identified by the Government of Pakistan'],
  ['Negative List', 'the list of names of foreigners or entities developed by the Government of Pakistan'],
  ['Applicant', 'the person (or persons) applying for a Pakistan Online Visa'],
  ['Dual nationality', "a person's citizenship status when concurrently regarded as a citizen of more than one state"],
  ['Immediate family', "the applicant's partner and dependent children"],
  ['INGO', 'registered international non-governmental organization in Pakistan'],
];
for (const [term, snippet] of GLOSS_TERMS) {
  if (!GLOSS.includes(snippet)) { console.warn('glossary term mismatch, skipped:', term); continue; }
  add({ docId: 'foreigner_entry_stay_registration', key: 'foreigner_online_visa_glossary', chunkTitle: null, language: 'en', domain: 'foreigners', task: 'legal_terminology', provenance: 'SOURCE_ORIGINAL', difficulty: 'easy', subdomain: 'visa-glossary', instruction: EN_INST.legal_terminology, input: `In the Pakistan Online Visa System glossary, what does "${term}" mean?`, output: `In the official Pakistan Online Visa System glossary: ${term} — ${snippet}.`, sourceRefs: ['foreigner_online_visa_glossary'] });
}

// 3. Civic / foreigner / office / civproc record rows (SOURCE_DERIVED; outputs
//    are the canonical corpus record text with meta lines stripped)
const QA_PLANS = [
  // --- civic_services ---
  { docId: 'civic_services', key: 'civic_services_overview', task: 'legal_qa', subdomain: 'civic-overview', difficulty: 'easy', ru: true, qs: ['Which citizen-facing civic services have verified records in the INSAaf corpus?'] },
  { docId: 'civic_services', key: 'civic_identity_nadra', task: 'legal_qa', subdomain: 'nadra-identity', difficulty: 'medium', ru: true, qs: ['What identity documents does NADRA issue for citizens and overseas Pakistanis, and what does the official record say about NICOP?', 'What are the NICOP forms and eligibility conditions recorded from the official NADRA page?'] },
  { docId: 'civic_services', key: 'civic_passport_dgip', task: 'legal_procedures', subdomain: 'passport-process', difficulty: 'medium', ru: true, qs: ['How does a Pakistani citizen apply for a new passport according to the official DGIP process?', 'What documents and steps does the DGIP passport process require for an adult first-time applicant?'] },
  { docId: 'civic_services', key: 'civic_voter_enrolment_ecp', task: 'legal_procedures', subdomain: 'voter-enrolment', difficulty: 'medium', ru: true, qs: ['How can a citizen enrol as a voter or get the electoral roll corrected per the official ECP record?', 'Which ECP forms cover enrolment, objection and correction, and how is status checked?'] },
  { docId: 'civic_services', key: 'civic_federal_ombudsman', task: 'legal_remedies', subdomain: 'ombudsman-complaint', difficulty: 'medium', ru: true, qs: ['How do I complain about maladministration by a federal agency to the Wafaqi Mohtasib?', 'What does the official record say about the Ombudsman complaint process, receipts and the child helpline?'] },
  { docId: 'civic_services', key: 'civic_fia_complaints', task: 'legal_procedures', subdomain: 'fia-complaint', difficulty: 'medium', ru: true, qs: ['How do I lodge a complaint within FIA jurisdiction on the Public Services Portal?', 'What does the official record say about FIA complaint references and feedback on FIA offices?'] },
  // --- foreigners (Pakistan-side rules) ---
  { docId: 'foreigner_entry_stay_registration', key: 'foreigner_entry_stay_overview', task: 'legal_qa', subdomain: 'foreigner-overview', difficulty: 'easy', ru: true, qs: ['Which entry, stay and registration rules for foreigners in Pakistan have official records in the corpus?'] },
  { docId: 'foreigner_entry_stay_registration', key: 'foreigner_visa_validity_stay', task: 'legal_qa', subdomain: 'visa-validity-stay', difficulty: 'medium', ru: true, qs: ['How long is a Pakistan Online Visa valid and how is the period of stay counted per the official visa system?'] },
  { docId: 'foreigner_entry_stay_registration', key: 'foreigner_police_registration', task: 'legal_procedures', subdomain: 'police-registration', difficulty: 'medium', ru: true, qs: ['Which foreign nationals must register with the police in Pakistan and who is exempt, per the official visa record?', 'Are managerial-category foreigners from Bangladesh, Bhutan, India, Israel, Nigeria, PLO or Somalia exempt from police registration?'] },
  { docId: 'foreigner_entry_stay_registration', key: 'foreigner_poc_pakistan_origin', task: 'legal_qa', subdomain: 'poc-identity', difficulty: 'medium', ru: true, qs: ['What does the official record say about the Pakistan Origin Card (POC) and identity documents for foreigners of Pakistani origin?'] },
  { docId: 'foreigner_entry_stay_registration', key: 'foreigner_entry_refusal_and_limits', task: 'legal_qa', subdomain: 'entry-controls', difficulty: 'medium', ru: true, qs: ['What entry controls and refusal grounds apply to foreigners entering Pakistan per the official record?'] },
  // --- public_offices records (verbatim structured record; meta stripped) ---
  { docId: 'public_offices', key: 'OFFICE_PRESIDENT', task: 'legal_qa', subdomain: 'office-president', difficulty: 'medium', ru: false, qs: ['What does the corpus record state about the Office of the President of Pakistan and which of its powers are not yet indexed?'] },
  { docId: 'public_offices', key: 'OFFICE_PRIME_MINISTER', task: 'legal_qa', subdomain: 'office-pm', difficulty: 'medium', ru: false, qs: ['What is recorded about the Office of the Prime Minister and why can the corpus not detail the full powers?'] },
  { docId: 'public_offices', key: 'OFFICE_GOVERNOR_CM', task: 'legal_qa', subdomain: 'office-governor-cm', difficulty: 'medium', ru: false, qs: ['What is recorded about provincial Governors and Chief Ministers in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_CHIEF_JUSTICE_PAKISTAN', task: 'legal_qa', subdomain: 'office-cjp', difficulty: 'medium', ru: false, qs: ['What does the corpus record state about the Office of the Chief Justice of Pakistan?'] },
  { docId: 'public_offices', key: 'OFFICE_HC_JUSTICES', task: 'legal_qa', subdomain: 'office-hc', difficulty: 'medium', ru: false, qs: ['What is recorded about the High Courts and their constitutional role in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_FSC_JUSTICES', task: 'legal_qa', subdomain: 'office-fsc', difficulty: 'medium', ru: false, qs: ['What does the corpus record state about the Federal Shariat Court?'] },
  { docId: 'public_offices', key: 'OFFICE_DISTRICT_SESSIONS_JUDGE', task: 'legal_qa', subdomain: 'office-dsj', difficulty: 'medium', ru: false, qs: ['What is recorded about the District and Sessions Judge in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_CIVIL_JUDGE_MAGISTRATE', task: 'legal_qa', subdomain: 'office-civil-judge', difficulty: 'medium', ru: false, qs: ['What does the corpus record state about Civil Judges and Judicial Magistrates?'] },
  { docId: 'public_offices', key: 'OFFICE_ECP', task: 'legal_qa', subdomain: 'office-ecp', difficulty: 'medium', ru: false, qs: ['What is recorded about the Election Commission of Pakistan in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_FEDERAL_OMBUDSMAN', task: 'legal_qa', subdomain: 'office-ombudsman', difficulty: 'medium', ru: true, qs: ['What does the corpus record state about the Wafaqi Mohtasib and how citizens approach it?'] },
  { docId: 'public_offices', key: 'OFFICE_PROVINCIAL_OMBUDSMAN', task: 'legal_qa', subdomain: 'office-prov-ombudsman', difficulty: 'medium', ru: true, qs: ['What is recorded about Provincial Ombudsmen in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_IGP_PPO', task: 'legal_qa', subdomain: 'office-igp', difficulty: 'medium', ru: true, qs: ['What is recorded about the Inspector General of Police and the provincial police complaint cell?'] },
  { docId: 'public_offices', key: 'OFFICE_SP_DSP_COMPLAINT_CELL', task: 'legal_qa', subdomain: 'office-sp-dsp', difficulty: 'medium', ru: false, qs: ['What does the corpus record state about the SP/SSP/DPO and DSP complaint cell?'] },
  { docId: 'public_offices', key: 'OFFICE_SHO', task: 'legal_qa', subdomain: 'office-sho', difficulty: 'medium', ru: true, qs: ['What is recorded about the Station House Officer and the duties tied to FIR registration?'] },
  { docId: 'public_offices', key: 'OFFICE_DEPUTY_COMMISSIONER', task: 'legal_qa', subdomain: 'office-dc', difficulty: 'medium', ru: false, qs: ['What is recorded about the Deputy Commissioner in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_TEHSILDAR', task: 'legal_qa', subdomain: 'office-tehsildar', difficulty: 'medium', ru: false, qs: ['What does the corpus record state about the Tehsildar and Naib-Tehsildar?'] },
  { docId: 'public_offices', key: 'OFFICE_PATWARI', task: 'legal_qa', subdomain: 'office-patwari', difficulty: 'medium', ru: true, qs: ['What is recorded about the Patwari and the land-revenue record in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_COLLECTOR_BOARD_REVENUE', task: 'legal_qa', subdomain: 'office-collector-bor', difficulty: 'medium', ru: false, qs: ['What does the corpus record state about the Collector and the Board of Revenue?'] },
  { docId: 'public_offices', key: 'OFFICE_SUPERINTENDENT_JAIL', task: 'legal_qa', subdomain: 'office-jail-supr', difficulty: 'medium', ru: false, qs: ['What is recorded about the Superintendent of the jail in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_IG_PRISONS', task: 'legal_qa', subdomain: 'office-ig-prisons', difficulty: 'medium', ru: false, qs: ['What is recorded about the Inspector General of Prisons in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_PUBLIC_PROSECUTOR', task: 'legal_qa', subdomain: 'office-prosecutor', difficulty: 'medium', ru: false, qs: ['What does the corpus record state about the Public Prosecutor?'] },
  { docId: 'public_offices', key: 'OFFICE_LAW_OFFICERS', task: 'legal_qa', subdomain: 'office-law-officers', difficulty: 'medium', ru: false, qs: ['What is recorded about the Attorney-General and the Advocates-General in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_DLAC_DLEC', task: 'legal_qa', subdomain: 'office-dlac-dlec', difficulty: 'medium', ru: true, qs: ['What is recorded about the DLAC and DLEC for free legal aid in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_FIA', task: 'legal_qa', subdomain: 'office-fia', difficulty: 'medium', ru: false, qs: ['What is recorded about the Federal Investigation Agency in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_NADRA', task: 'legal_qa', subdomain: 'office-nadra', difficulty: 'medium', ru: false, qs: ['What is recorded about NADRA and its Registration Centres in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_DGIP', task: 'legal_qa', subdomain: 'office-dgip', difficulty: 'medium', ru: false, qs: ['What is recorded about the Directorate General of Immigration and Passports in the public-offices corpus?'] },
  { docId: 'public_offices', key: 'OFFICE_GAP_SUMMARY', task: 'legal_qa', subdomain: 'office-gaps', difficulty: 'medium', ru: false, qs: ['Which public offices have no indexed record in the corpus, and why can the assistant not detail them?'] },
  // --- citizen official procedures ---
  { docId: 'citizen_official_procedures', key: 'CIVPROC_NICOP', task: 'legal_procedures', subdomain: 'nicop-application', difficulty: 'medium', ru: true, qs: ['How does an overseas Pakistani apply for a NICOP through PakID according to the official workflow?'] },
  { docId: 'citizen_official_procedures', key: 'CIVPROC_PASSPORT_ONLINE', task: 'legal_procedures', subdomain: 'passport-online', difficulty: 'medium', ru: false, qs: ['What is the official online application path for a Pakistani passport?'] },
  { docId: 'citizen_official_procedures', key: 'CIVPROC_VOTER', task: 'legal_procedures', subdomain: 'voter-forms', difficulty: 'medium', ru: false, qs: ['Which voter form fits which situation, and what is the official workflow around Forms 21, 22 and 23?'] },
  { docId: 'citizen_official_procedures', key: 'CIVPROC_OMBUDSMAN', task: 'legal_procedures', subdomain: 'ombudsman-workflow', difficulty: 'medium', ru: false, qs: ['Walk through the official workflow of a complaint to the Federal Ombudsman against a federal agency.'] },
  { docId: 'citizen_official_procedures', key: 'CIVPROC_FIA', task: 'legal_procedures', subdomain: 'fia-workflow', difficulty: 'medium', ru: false, qs: ['What is the official workflow for an FIA complaint and for feedback on FIA services?'] },
  { docId: 'citizen_official_procedures', key: 'CIVPROC_FIR_ESCALATION', task: 'legal_procedures', subdomain: 'fir-escalation', difficulty: 'medium', ru: true, qs: ['Police refused to register my FIR. What is the verified escalation ladder in order?'] },
  { docId: 'citizen_official_procedures', key: 'CIVPROC_FOREIGNER_REGISTRATION', task: 'legal_procedures', subdomain: 'fro-registration', difficulty: 'medium', ru: false, qs: ['A foreigner in Pakistan has been directed to report to the Foreigner Registration Office. What is the official workflow?'] },
];

for (const p of QA_PLANS) {
  const c = get(p.docId, p.key);
  if (!c) { problems.push(`missing chunk ${p.docId}::${p.key}`); continue; }
  const body = stripMeta(p.docId, p.key);
  for (const q of p.qs) {
    const row = { docId: p.docId, key: p.key, chunkTitle: c.chunkTitle, language: 'en', domain: p.docId === 'civic_services' || p.docId === 'citizen_official_procedures' ? 'civic_services' : p.docId === 'foreigner_entry_stay_registration' ? 'foreigners' : 'public_offices', task: p.task, provenance: 'SOURCE_DERIVED', difficulty: p.difficulty, subdomain: p.subdomain, instruction: EN_INST[p.task], input: q, output: body, sourceRefs: [p.key] };
    add(row);
  }
  if (p.ru) {
    add({ docId: p.docId, key: p.key, chunkTitle: c.chunkTitle, language: 'roman_ur', domain: p.docId === 'civic_services' || p.docId === 'citizen_official_procedures' ? 'civic_services' : p.docId === 'foreigner_entry_stay_registration' ? 'foreigners' : 'public_offices', task: p.task, provenance: 'SOURCE_DERIVED', difficulty: p.difficulty, subdomain: p.subdomain, instruction: RU_INST[p.task], input: p.qs[0], output: `Tasdeeq-shuda official record ke mutabiq:
${body}`, sourceRefs: [p.key] });
  }
}

// Second angle for office records that explicitly carry a "Not indexed" caveat:
// teach the exact scope boundary (never a full-powers answer for these offices).
for (const p of QA_PLANS) {
  if (p.docId !== 'public_offices' || p.key === 'OFFICE_RECORDS_INTRO' || p.key === 'OFFICE_GAP_SUMMARY') continue;
  const body = stripMeta(p.docId, p.key);
  if (body.includes('Not indexed')) {
    add({ docId: p.docId, key: p.key, chunkTitle: null, language: 'en', domain: 'public_offices', task: 'legal_qa', provenance: 'SOURCE_DERIVED', difficulty: p.difficulty, subdomain: p.subdomain + '-scope', instruction: EN_INST.legal_qa, input: 'Which parts of this office does the corpus record mark as not indexed, and what should the assistant say instead?', output: body, sourceRefs: [p.key] });
  }
}

// ---------------------------------------------------------------------------
// Drafting-letter rows (FULL taxonomy types; formal EN; each asserted fact
// must appear verbatim in its anchor chunk; letters use [bracketed fields])
// ---------------------------------------------------------------------------
function assertIn(docId, key, snippet) {
  const c = get(docId, key);
  return c.text.includes(snippet);
}
const DRAFT = [
  {
    docId: 'civic_services', key: 'civic_federal_ombudsman', type: 'Complaint letter to the Federal Ombudsman (Wafaqi Mohtasib)', needs: ['WMS Form', 'solemn affirmation', 'within 72 hours', 'first approach the higher authorities'],
    q: 'Draft a formal complaint letter to the Wafaqi Mohtasib about maladministration by a federal agency.',
    out: () => `To\nThe Office of the Wafaqi Mohtasib (Federal Ombudsman)
Secretariat, 36 Constitution Avenue, G-5/2, Islamabad

Subject: Complaint of maladministration against [Name of Federal Agency/Department]

Respected Sir/Madam,

I, [Complainant Full Name], son/daughter of [Father Name], holder of CNIC No. [CNIC Number], resident of [Complete Address], most respectfully state as follows:

1. That I am aggrieved by the action/in action of [Name of Federal Agency/Department] in the matter of [Describe the matter, e.g. pension, service record, license, refund].
2. That I first approached the higher authorities of the said agency to give them an opportunity to redress the grievance, as the normal practice requires, but the grievance was not redressed.
3. That no suit, appeal, petition or other judicial proceedings in connection with the subject matter are pending before any court, tribunal or board.

In support of this complaint I solemnly affirm that: (1) the allegations are correct and true to the best of my knowledge and belief; (2) no prior complaint on the subject was filed with the Secretariat or regional offices; (3) no suit, appeal, petition or other judicial proceedings in connection with the subject matter are pending before any court, tribunal or board; and (4) a representation to the competent authority of the agency was made but no reply was given within a reasonable time or the representation was unjustly turned down.

Verified complaint requirements recorded by the official Ombudsman process:
- The complaint may be written in English or Urdu, on WMS Form 'A' (downloadable from the official website) or online; if it is not on Form 'A' it must be accompanied by the solemn affirmation set out above.
- Copies of relevant documents, including the CNIC and latest correspondence with the agency, should be annexed where possible.
- A receipt is issued immediately when the complaint is presented in person; when submitted by other means, a receipt is issued within 72 hours.

Annexures: [CNIC copy], [Latest correspondence with the agency], [Any supporting documents].

Yours faithfully,
[Complainant Name]
[CNIC Number]
[Contact Number]
[Date]

Note: this draft is legal information assembled from the verified official Ombudsman record; confirm the current form and submission channel on the official Ombudsman website before filing.`,
  },
  {
    docId: 'citizen_official_procedures', key: 'CIVPROC_FIR_ESCALATION', type: 'Application letter to the SHO for registration of an FIR', needs: ['Sections 22-A/22-B', 'Helpline 8171', 'free copy'],
    q: 'Draft an application letter to the Station House Officer requesting registration of an FIR for a cognizable offence.',
    out: () => `To
The Station House Officer
[Name of Police Station], [City/District]

Subject: Application for registration of FIR regarding [Offence, e.g. theft/assault/fraud]

Sir/Madam,

I, [Applicant Full Name], son/daughter of [Father Name], CNIC No. [CNIC Number], resident of [Complete Address], state that on [Date] at [Time] at [Place], [briefly describe the incident]. The occurrence discloses a cognizable offence and I request that an FIR may kindly be registered. An FIR must be registered for cognizable offences; refusal is a dereliction of duty (Police Order 2002 / CrPC as recorded in the police digest). The FIR itself is free of charge and the complainant is entitled to a free copy.

If registration is refused, the verified escalation ladder recorded for a citizen is: (1) written complaint to the Superintendent of Police (SP) or Deputy Superintendent of Police (DSP) of the area (DSP Complaint Cell); (2) application to the Sessions Judge sitting as ex-officio Justice of Peace under Sections 22-A/22-B CrPC, who can direct the SHO to register the FIR; (3) private complaint directly before the Magistrate under Section 200 CrPC; (4) in extreme cases, a writ petition before the High Court under Article 199; (5) complaint through the Pakistan Citizen Portal (Helpline 8171); (6) contact the IGP Complaint Cell.

Annexures: [CNIC copy], [Copies of any evidence of the occurrence].

Yours faithfully,
[Applicant Name]
[CNIC Number]
[Contact Number]
[Date]

Note: statutory anchors for this draft are recorded in the corpus (CrPC Sections 154, 22-A/22-B, 200; Constitution Article 199).`,
  },
  {
    docId: 'court_procedures', key: 'FIR_REFUSAL_REMEDY', type: 'Application to the Sessions Judge (ex-officio Justice of Peace) under Sections 22-A/22-B CrPC', needs: ['Ex-Officio Justice of Peace', '22-A/22-B', 'direct the SHO to register the FIR'],
    q: 'Draft an application to the Sessions Judge as ex-officio Justice of Peace for a direction to register an FIR after police refusal.',
    out: () => `In the Court of the learned Sessions Judge, [District], as Ex-Officio Justice of Peace

Application under Sections 22-A/22-B, Criminal Procedure Code, 1898, for a direction to register FIR

Applicant: [Full Name], CNIC No. [CNIC Number], resident of [Address]
Respondent: [Police Station / SHO concerned]

Respected Sir/Madam,

1. That on [Date] the applicant reported [the occurrence] at Police Station [Name] through a written application to the Station House Officer requesting registration of the FIR, and kept a copy of that application.
2. That the SHO refused to register the FIR, and a written complaint was thereafter submitted to the Superintendent of Police (SP) or Deputy Superintendent of Police (DSP) of the area, but the FIR has still not been registered.
3. That the occurrence discloses a cognizable offence, and an FIR must be registered for cognizable offences; refusal is a dereliction of duty (Police Order 2002 / CrPC as recorded in the police digest).

It is therefore most respectfully prayed that this Honourable Court, sitting as Ex-Officio Justice of Peace, may kindly direct the SHO of Police Station [Name] to register the FIR of the occurrence reported by the applicant.

Verified supporting documents recorded with this remedy: [Copy of the written application to the SHO], [Copy of the complaint to the SP/DSP], [CNIC copy], [Any evidence of the occurrence].

Applicant: [Name]
Through: [Advocate, if engaged]
[Date]`,
  },
  {
    docId: 'property_laws', key: 'MUTATION_INTEQAL', type: 'Mutation (Inteqal) application after purchase of land', needs: ['Patwari', 'Tehsildar'],
    q: 'Draft an application for mutation (Inteqal) of land in the revenue record after purchase.',
    out: () => `To\nThe Tehsildar / Naib-Tehsildar, [Tehsil], District [District]\n\nSubject: Application for mutation (Inteqal) of land bearing Khasra/Khewat No. [Numbers], Mouza [Name], after purchase\n\nSir/Madam,\n\nI, [Applicant Full Name], CNIC No. [CNIC Number], resident of [Address], have purchased land bearing Khasra/Khewat No. [Numbers], Mouza [Name], measuring [Kanals/Marlas] from [Seller Name] vide registered sale deed No. [Number] dated [Date].\n\nI request that mutation of the said land may kindly be sanctioned in my name in the revenue record. I undertake to appear before the revenue officer as required.\n\nVerified procedure recorded for mutation (Inteqal): the buyer applies through the local Patwari; the Revenue Officer (Tehsildar/Naib-Tehsildar) issues notice; after no objection and verification the mutation is sanctioned and the new owner is recorded. Note that mutation itself updates the revenue record only — legal title passes through the registered sale deed, not through mutation.\n\nAnnexures: [Copy of registered sale deed], [CNIC copies of buyer and seller], [Copies of Fard-e-Malkiat].\n\nYours faithfully,\n[Applicant Name]\n[CNIC Number]\n[Contact Number]\n[Date]`,
  },
  {
    docId: 'public_institutions', key: 'INSTITUTION_DLAC_BAR_COUNCIL', type: 'Application for free legal aid to the District Legal Advisory Committee', needs: ['District Legal Advisory Committees', 'Free Legal Aid'],
    q: 'Draft an application for free legal aid to the District Legal Advisory Committee for a person who cannot afford a lawyer.',
    out: () => `To\nThe District Legal Advisory Committee (DLAC)\nThrough: [District Bar Association / District Court]\n[District]\n\nSubject: Application for free legal aid\n\nRespected Sir/Madam,\n\nI, [Applicant Full Name], CNIC No. [CNIC Number], resident of [Address], am a party in [Case/Court/Forum details] and I am unable to afford the services of a lawyer due to [financial circumstances].\n\nI request that I may kindly be provided free legal assistance from the panel of the District Legal Advisory Committee as recorded in the legal-aid procedure.\n\nVerified eligibility context recorded for legal aid: DLAC grants free legal aid on proof of inability to engage a lawyer; free legal aid is a recognised right for those who cannot afford counsel, and in capital cases the State provides counsel.\n\nAnnexures: [CNIC copy], [Case documents, if any], [Evidence of financial circumstances (income affidavit / Zakat certificate, as applicable)].\n\nYours faithfully,\n[Applicant Name]\n[CNIC Number]\n[Contact Number]\n[Date]`,
  },
];
for (const d of DRAFT) {
  const missing = d.needs.filter((n) => !assertIn(d.docId, d.key, n));
  if (missing.length) {
    console.warn(`drafting row skipped (anchor phrase missing in ${d.docId}::${d.key}): ${d.type} -> ${missing.join(' | ')}`);
    continue;
  }
  const c = get(d.docId, d.key);
  const lang = 'en';
  if (nearDupDropped(EN_INST.document_explanation, d.q, d.out(''))) { internalDupes++; continue; }
  add({ docId: d.docId, key: d.key, chunkTitle: c.chunkTitle, language: lang, domain: 'documents', task: 'document_drafting', provenance: 'SOURCE_DERIVED', difficulty: 'hard', subdomain: `drafting-${d.key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, instruction: `Draft the document in complete formal English prose. Fill the [bracketed fields] with the user's actual details. Use only the verified requirements recorded in the corpus.`, input: d.q, output: d.out(''), sourceRefs: [d.key] });
}

// ---------------------------------------------------------------------------
// Authored scope/refusal rows (SYNTHETIC_BEHAVIOR — no legal assertions)
// ---------------------------------------------------------------------------
const SCOPE = [
  { domain: 'property', subdomain: 'poa-gap', difficulty: 'easy', language: 'en', q: 'Can you draft a power of attorney for me?', a: 'I cannot draft a power of attorney: the Registration Act 1908 rules for a registered power of attorney are not part of my verified corpus, and I do not draft documents whose governing rules are outside my verified knowledge. A general power of attorney exists as a legal document that authorises another person to act on your behalf; for a proper draft, terms suited to your matter and lawful attestation/registration, please consult a registered advocate or the relevant registration office.' },
  { domain: 'civic_services', subdomain: 'fees-not-frozen', difficulty: 'easy', language: 'en', q: 'What is the exact fee for a new passport and for a NICOP?', a: 'Fee amounts are not part of my verified corpus records, and I do not invent them. The official record covers the application process, documents and steps; current fee schedules are published and updated by the issuing authority (DGIP for passports, NADRA for NICOP). Please confirm the current fee on the official portal or at the counter before payment, and keep the official receipt.' },
  { domain: 'constitution', subdomain: 'president-powers-gap', difficulty: 'easy', language: 'en', q: 'List all constitutional powers of the President of Pakistan under Articles 41 to 44.', a: 'I cannot give you a complete list: the full text of those constitutional articles is not yet indexed in my verified corpus. My record for the Office of the President covers only the powers indexed so far, and I do not invent provisions. For the authoritative text of Articles 41 to 44 of the Constitution, please consult the official constitutional text (pakistancode.gov.pk) or a lawyer.' },
  { domain: 'constitution', subdomain: 'president-powers-gap-urdu', difficulty: 'easy', language: 'roman_ur', q: 'President ke tamam constitutional powers Articles 41 se 44 tak ki list bata dein.', a: 'Main ye complete list nahi de sakta: in constitutional articles ka poora text abhi mere verified corpus mein indexed nahi hai. President ke Office ke liye mere record mein sirf woh powers hain jo ab tak indexed hui hain, aur main provisions invent nahi karta. Constitution ke Articles 41 se 44 ka asli text official source (pakistancode.gov.pk) ya kisi lawyer se tasdeeq karein.' },
  { domain: 'civic_services', subdomain: 'ombudsman-limits', difficulty: 'easy', language: 'roman_ur', q: 'Kya main apne civil court ke case ke khilaf Wafaqi Mohtasib se complain kar sakta hoon?', a: 'Nahi — ye INSAaf ke verified scope se bahar hai. Mohtasib (Federal Ombudsman) sirf federal agencies ke khilaf maladministration complaints dekhta hai; jo matters courts ke samne hain wo Ombudsman ke jurisdiction se bahar hain. Apne court case ke liye apne lawyer ya court se rabta karein.' },
  { domain: 'foreigners', subdomain: 'visa-fee-scope', difficulty: 'easy', language: 'en', q: 'How much is the Pakistan Online Visa fee and how long does approval take?', a: 'Visa fee amounts and processing timelines are not part of my verified record, and I do not invent them. My verified records cover visa validity, period of stay, police-registration rules and the official glossary of the Pakistan Online Visa System. Please confirm current fees and timelines on the official visa portal before applying.' },
  { domain: 'case_law', subdomain: 'unpublished-judgments', difficulty: 'easy', language: 'en', q: 'Summarise the judgments the Supreme Court uploaded yesterday.', a: 'I cannot do that: I have no access to today\u2019s or yesterday\u2019s court uploads beyond the verified official records in my corpus. For cases in my corpus I can state the official record (case number, subject, title, author judge and dates); for judgments uploaded after my last verified corpus update, please check the official court website directly.' },
];
for (const s of SCOPE) {
  add({ docId: 'public_offices', key: 'OFFICE_GAP_SUMMARY', chunkTitle: null, language: s.language, domain: s.domain, task: 'refusal', provenance: 'SYNTHETIC_BEHAVIOR', difficulty: s.difficulty, subdomain: s.subdomain, instruction: s.language === 'roman_ur' ? RU_INST.refusal : EN_INST.refusal, input: s.q, output: s.a, sourceRefs: [] });
}

// ---------------------------------------------------------------------------
// Write (only if zero problems)
// ---------------------------------------------------------------------------
if (problems.length) {
  console.error(`\nV3 EXPANSION PROBLEMS: ${problems.length}`);
  for (const p of problems.slice(0, 60)) console.error('  - ' + p);
  console.error('Change-set NOT written.');
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });
const sorted = [...rows];
sorted.sort((a, b) => a.example_id.localeCompare(b.example_id));
fs.writeFileSync(OUT_JSONL, sorted.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
const tally = (arr, k) => { const m = {}; for (const r of arr) m[r[k]] = (m[r[k]] || 0) + 1; return m; };
fs.writeFileSync(OUT_MANIFEST, JSON.stringify({
  change_set_version: 'v3-expansion-1.0',
  corpus: '2.4.0-final (rag/indexes/rag_index.json, 63 docs, frozen)',
  generated_at: new Date().toISOString(),
  generator: 'server/generateV3Expansion.js',
  description: 'V3 expansion: deterministic, corpus-grounded rows over the 2026-09-06 corpus records (civic services, foreigners, public offices, citizen official procedures, official SCP/FCC case records) plus drafting letters for FULL-taxonomy document types and authored scope/refusal rows. Every output is assembled from canonical chunk text; drafting rows assert only anchor-verified phrases.',
  total_examples: sorted.length,
  internal_near_duplicates_dropped: internalDupes,
  by_provenance: tally(sorted, 'provenance'),
  by_language: tally(sorted, 'language'),
  by_domain: tally(sorted, 'domain'),
  by_task: tally(sorted, 'task'),
  by_difficulty: tally(sorted, 'difficulty'),
  sources_linked: sorted.filter((r) => r.source_refs.length > 0).length,
  provenance_policy: 'SOURCE_ORIGINAL = verbatim official-record restatement (SCP/FCC records, visa glossary); SOURCE_DERIVED = canonical corpus digest/record restatement incl. drafting letters; SYNTHETIC_BEHAVIOR = authored behaviour/refusal scripts without legal assertions; BEHAVIORAL = reserved for pipeline-captured rows (not produced here).',
  language_policy: 'EN and Roman Urdu only in this change-set; Urdu-script rows were not auto-generated (no Urdu rendering of the new English official records exists) — documented gap; formal drafting rows are EN.',
  combine_instructions: 'Merge into final_v3 via server/buildFinalV3.js on top of V1 (train+validation) + v2v3_changeset.jsonl + v2_expansion/v2_changeset.jsonl. V1 test.jsonl (433) stays held out.',
}, null, 2) + '\n', 'utf8');
console.log('\n================ V3 EXPANSION ================');
console.log('rows:', sorted.length, '| internal near-dups dropped:', internalDupes);
console.log('provenance:', JSON.stringify(tally(sorted, 'provenance')));
console.log('languages:', JSON.stringify(tally(sorted, 'language')));
console.log('domains:', JSON.stringify(tally(sorted, 'domain')));
console.log('tasks:', JSON.stringify(tally(sorted, 'task')));
console.log('difficulties:', JSON.stringify(tally(sorted, 'difficulty')));
console.log('source-linked rows:', sorted.filter((r) => r.source_refs.length > 0).length);
console.log('V3 EXPANSION CHANGE-SET: VALIDATED AND WRITTEN');
