// ============================================================================
// INSAaf AI — FINAL V2 EXPANSION VALIDATOR (deterministic QC — Phase 4)
// ----------------------------------------------------------------------------
// Independent hard check of rag/training/v2_expansion/v2_changeset.jsonl.
// Deliberately separate from the generator; mirrors the V1 rules in
// server/validateFineTuneDataset.js / validateV2V3ChangeSet.js and adds the
// task-specific checks (behaviour-group coverage, document-language rule,
// fabricated-citation / fabricated-contact / unsupported-country-law scans,
// test-set contamination, V1 immutability).
//
//   node server/validateV2FinalExpansion.js      (exit 0 = every hard check passes)
//
// Writes into rag/training/v2_expansion/:
//   v2_dataset_manifest.json   v2_dataset_quality_report.md
//   v2_changeset.json          v2_retrain_readiness.md
// ============================================================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { loadCorpus, resolveRef, checkUrls } from './fineTuneData/refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAIN_DIR = path.resolve(__dirname, '../rag/training');
const OUT_DIR = path.join(TRAIN_DIR, 'v2_expansion');
const CHANGESET = path.join(OUT_DIR, 'v2_changeset.jsonl');

const VALID_LANGUAGES = new Set(['en', 'ur', 'roman_ur']);
const VALID_DOMAINS = new Set(['constitution', 'criminal_law', 'criminal_procedure', 'civil_procedure', 'cybercrime', 'family_law', 'property', 'tenancy', 'labour', 'consumer', 'education', 'legal_aid', 'court_procedure', 'case_law', 'documents', 'general', 'cross_border']);
const VALID_TASKS = new Set(['legal_qa', 'offence_punishment', 'fundamental_rights', 'legal_procedures', 'situation_action', 'legal_remedies', 'case_law', 'similar_case', 'legal_terminology', 'en_legal_answer', 'ur_legal_answer', 'rom_legal_answer', 'document_explanation', 'document_drafting', 'source_aware', 'refusal', 'domain_classification']);
const GROUPS = ['cross_border', 'agent', 'document_ocr', 'procedure_strategy', 'safety_hallucination', 'answer_quality'];
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const TASK_LANGUAGE = { en_legal_answer: 'en', ur_legal_answer: 'ur', rom_legal_answer: 'roman_ur' };
const V1_BASELINE = { 'train.jsonl': '9F830BE9F2F5D34D', 'validation.jsonl': '28594BEEDAFC340F', 'test.jsonl': 'E59E24F9DEE0B525' };
const URDU = /[\u0600-\u06FF]/;

const toks = (s) => new Set(String(s).toLowerCase().split(/[^a-z0-9\u0600-\u06FF]+/).filter((t) => t.length > 1 || /[0-9\u0600-\u06FF]/.test(t)));
function jaccard(a, b) { let inter = 0; for (const t of a) if (b.has(t)) inter++; const union = a.size + b.size - inter; return union === 0 ? 0 : inter / union; }
const NEAR_DUP = 0.9;
const sha16 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16).toUpperCase();

// reporter citation pattern that must resolve against the corpus if present
const CIT = /\b(?:PLD|SCMR|CLC|CLD|YLR|PLC|PLJ|MLD|FSC|PLJ)\s+\d{4}\b(?:\s+[A-Z]{2,4}\s*\d+|\s+(?:SC|FSC|Lahore|Karachi|Peshawar|Quetta|Islamabad|Federal))?/gi;
// personal-mobile / foreign-number / explicit per-person fee patterns (fabrication risk)
const PHONE = /(?:\+92|0092|\b0?3\d{2}[-\s]?\d{7}\b|\b0\d{3,4}[-\s]\d{6,7}\b)/g;
// an unsupported country-law assertion: "under <Country> law ... (section/penalty/years)"
const COUNTRY = /\b(UAE|U\.A\.E|Saudi Arabia|Qatar|Kuwait|Oman|Bahrain|United Kingdom|Britain|\bUK\b|United States|\bUSA\b|Canada|Australia|China|Japan|Malaysia|T.rkiye|Turkey|Germany|France|Netherlands|Italy|Spain|Thailand|Singapore|Korea|Schengen)\b/gi;
const UNDER_COUNTRY_LAW = /under\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+law/i;

const failures = [];
const notes = [];
const corpus = loadCorpus();
if (!fs.existsSync(CHANGESET)) { console.error('FAIL: change-set not found at ' + CHANGESET); process.exit(1); }

const lines = fs.readFileSync(CHANGESET, 'utf8').split(/\r?\n/).filter((l) => l.trim().length);
const examples = [];
for (let i = 0; i < lines.length; i++) {
  let e; try { e = JSON.parse(lines[i]); } catch (err) { failures.push('line ' + (i + 1) + ': invalid JSON (' + err.message + ')'); continue; }
  e.__line = i + 1; examples.push(e);
}

const refCache = new Map();
let fabricatedCitationHits = 0; let fabricatedContactHits = 0; let countryLawHits = 0;
for (const e of examples) {
  const L = 'line ' + e.__line;
  // required base fields
  for (const f of ['instruction', 'input', 'output', 'language', 'domain', 'task', 'source_refs']) if (!(f in e)) failures.push(L + ': missing field "' + f + '"');
  for (const f of ['instruction', 'input', 'output']) if (typeof e[f] !== 'string' || !e[f].trim()) failures.push(L + ': empty "' + f + '"');
  // required metadata fields
  for (const f of ['example_id', 'behavior_group', 'subdomain', 'jurisdiction', 'difficulty', 'source_linked']) if (!(f in e)) failures.push(L + ': missing metadata "' + f + '"');
  if (!VALID_LANGUAGES.has(e.language)) failures.push(L + ': bad language "' + e.language + '"');
  if (!VALID_DOMAINS.has(e.domain)) failures.push(L + ': bad domain "' + e.domain + '"');
  if (!VALID_TASKS.has(e.task)) failures.push(L + ': bad task "' + e.task + '"');
  if (!GROUPS.includes(e.behavior_group)) failures.push(L + ': bad behavior_group "' + e.behavior_group + '"');
  if (!DIFFICULTIES.has(e.difficulty)) failures.push(L + ': bad difficulty "' + e.difficulty + '"');
  if (typeof e.source_linked !== 'boolean') failures.push(L + ': source_linked must be boolean');
  if (e.behavior_group !== e.behaviour) failures.push(L + ': behavior_group/behaviour mismatch');
  const want = TASK_LANGUAGE[e.task]; if (want && e.language !== want) failures.push(L + ': task "' + e.task + '" requires language "' + want + '"');

  // source refs must resolve
  if (!Array.isArray(e.source_refs)) failures.push(L + ': source_refs not an array');
  else for (const ref of e.source_refs) {
    if (typeof ref !== 'string' || !ref.trim()) { failures.push(L + ': empty source_ref'); continue; }
    let r = refCache.get(ref); if (!r) { r = resolveRef(ref, corpus); refCache.set(ref, r); }
    if (!r.ok) failures.push(L + ': unresolved source_ref "' + ref + '" (' + r.reason + ')');
  }

  // ellipsis / dot-runs / urls
  if (/\u2026/.test(e.output)) failures.push(L + ': unicode ellipsis in output');
  for (const m of (String(e.output).match(/\.{2,}/g) || [])) { if (m.length === 3) failures.push(L + ': bare "..." in output'); else if (e.task !== 'document_drafting') failures.push(L + ': ' + m.length + '-dot run outside document_drafting'); }
  for (const f of ['instruction', 'input', 'output']) for (const u of checkUrls(String(e[f] || ''))) failures.push(L + ': non-corpus URL in ' + f + ': ' + u);

  // DOCUMENT-LANGUAGE rule (the core language policy)
  const hasUrdu = URDU.test(String(e.output));
  if (e.language === 'ur' && !hasUrdu) failures.push(L + ': language "ur" but output has NO Urdu script');
  if ((e.language === 'en' || e.language === 'roman_ur') && hasUrdu) failures.push(L + ': language "' + e.language + '" output contains Urdu script (chat must be EN/Roman only)');
  if (e.task === 'document_drafting' && e.language === 'roman_ur') failures.push(L + ': Roman Urdu used inside a FORMAL LEGAL DOCUMENT target (documents must be EN or Urdu script)');

  // fabricated citation: every reporter citation in the output must resolve in corpus
  for (const m of (String(e.output).match(CIT) || [])) {
    const r = resolveRef(m.trim(), corpus);
    if (!r.ok) { fabricatedCitationHits++; if (fabricatedCitationHits <= 8) failures.push(L + ': possibly fabricated citation "' + m.trim() + '" (not resolvable in corpus)'); }
  }
  // fabricated personal contact / fee
  const phones = String(e.output).match(PHONE) || [];
  if (phones.length) { fabricatedContactHits += phones.length; if (fabricatedContactHits <= 8) notes.push(L + ': phone-like pattern "' + phones.join(',') + '" (verify it is a verified official helpline, not an invented contact)'); }
  // unsupported country-law assertion in a cross_border example
  if (e.behavior_group === 'cross_border') {
    const m = String(e.output).match(UNDER_COUNTRY_LAW);
    if (m && /section|penalty|imprison|years|fine|deport/i.test(String(e.output))) { COUNTRY.lastIndex = 0; if (COUNTRY.test(String(e.output))) { countryLawHits++; notes.push(L + ': cross_border output asserts a specific "' + m[0] + '" rule — verify not fabricated'); } }
  }
}

// duplicate ids / triples
const idSeen = new Map(); let dupIds = 0;
for (const e of examples) { if (!e.example_id) continue; idSeen.set(e.example_id, (idSeen.get(e.example_id) || 0) + 1); }
for (const [id, n] of idSeen) if (n > 1) { dupIds += n - 1; failures.push('duplicate example_id "' + id + '" x' + n); }
const triples = new Map();
for (const e of examples) { const k = e.instruction + '\u0000' + e.input + '\u0000' + e.output; triples.set(k, (triples.get(k) || 0) + 1); }
let dups = 0; for (const n of triples.values()) if (n > 1) dups += n - 1;
if (dups) failures.push(dups + ' exact duplicate triples within the expansion');

// test-set contamination (HARD)
const testEx = fs.readFileSync(path.join(TRAIN_DIR, 'test.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).map((e) => ({ qa: toks(e.instruction + ' ' + e.input), out: toks(e.output) }));
let contaminated = 0;
for (const e of examples) { const qa = toks(e.instruction + ' ' + e.input), out = toks(e.output); for (const t of testEx) if (jaccard(qa, t.qa) >= NEAR_DUP && jaccard(out, t.out) >= NEAR_DUP) { contaminated++; break; } }
if (contaminated) failures.push(contaminated + ' example(s) would contaminate the 433-example V1 test set');

// behaviour-group coverage (all six present)
const byGroup = examples.reduce((a, e) => (a[e.behavior_group] = (a[e.behavior_group] || 0) + 1, a), {});
const missingGroups = GROUPS.filter((g) => !(byGroup[g] > 0));
if (missingGroups.length) failures.push('missing behaviour groups: ' + missingGroups.join(', '));

// V1 immutability (HARD)
let v1ok = true; const v1 = {};
for (const f of Object.keys(V1_BASELINE)) { const h = sha16(path.join(TRAIN_DIR, f)); v1[f] = { hash16: h, unchanged: h === V1_BASELINE[f] }; if (h !== V1_BASELINE[f]) v1ok = false; }
if (!v1ok) failures.push('V1 dataset files changed: ' + JSON.stringify(v1));

// ---- tallies ----
const tally = (k) => examples.reduce((a, e) => (a[e[k]] = (a[e[k]] || 0) + 1, a), {});
const byLang = tally('language'), byDomain = tally('domain'), byTask = tally('task'), byDiff = tally('difficulty');
const sourceLinked = examples.filter((e) => e.source_linked).length;
const urduScriptDocs = examples.filter((e) => e.language === 'ur').length;
const romanChat = examples.filter((e) => e.language === 'roman_ur').length;
const hardPass = failures.length === 0;

// ---- manifest ----
const manifest = {
  dataset_version: 'v2-final-expansion-1.0',
  generated_at: new Date().toISOString(),
  description: 'FINAL V2 training-data expansion: NEW behaviours added after V1 (cross-border, agent, document/OCR, procedure/strategy, safety/hallucination-resistance, answer-quality), captured from the verified owned-model pipeline. Additive to V1; V1 is immutable.',
  source: 'rag/training/v2_expansion/v2_changeset.jsonl',
  capture_method: 'Every output is the ACTUAL response of the running owned-model pipeline (offline, localhost:3001); no legal fact hand-authored. Generic blank-field document templates teach verified [MISSING]/grounded behaviour.',
  total_examples: examples.length,
  by_behavior_group: byGroup, by_language: byLang, by_domain: byDomain, by_task: byTask, by_difficulty: byDiff,
  source_linked_examples: sourceLinked,
  roman_urdu_chat_examples: romanChat,
  urdu_script_document_examples: urduScriptDocs,
  v1_immutability: { policy: 'train/validation/test.jsonl read-only; SHA-256 asserted unchanged', files: v1, all_unchanged: v1ok },
  test_set_contamination: { threshold: 'Jaccard>=0.9 on BOTH question and answer vs 433 V1 test examples', contaminated_found: contaminated, must_be_zero: true },
  fabrication_checks: { unresolved_source_refs: examples.reduce((n, e) => n + (e.source_refs || []).filter((r) => { let x = refCache.get(r); if (!x) { x = resolveRef(r, corpus); refCache.set(r, x); } return !x.ok; }).length, 0), citations_resolvable: fabricatedCitationHits === 0, possible_fabricated_citations: fabricatedCitationHits, phone_like_patterns: fabricatedContactHits, unsupported_country_law_assertions: countryLawHits },
  language_rule: { policy: 'chat = EN or Roman Urdu only; formal documents = EN or Urdu Script only; NEVER Roman Urdu inside a formal document', violations: examples.filter((e) => e.task === 'document_drafting' && e.language === 'roman_ur').length },
  combine_instructions: 'For a future V2 run: train on (V1 train.jsonl + V1 validation.jsonl + rag/training/v2v3_changeset.jsonl + rag/training/v2_expansion/v2_changeset.jsonl). Evaluate on the UNCHANGED V1 test.jsonl (433). Never merge any additions into test.jsonl.',
  validation: { result: hardPass ? 'PASS' : 'FAIL', failure_count: failures.length, failures: failures.slice(0, 60) },
};
fs.writeFileSync(path.join(OUT_DIR, 'v2_dataset_manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

// ---- v2_changeset.json (full expansion wrapped) ----
fs.writeFileSync(path.join(OUT_DIR, 'v2_changeset.json'), JSON.stringify({ dataset_version: manifest.dataset_version, schema: 'V1 schema {instruction,input,output,language,domain,task,source_refs} + behaviour, example_id, behavior_group, subdomain, jurisdiction, difficulty, source_linked (+ agent_actions where applicable)', total_examples: examples.length, examples: examples.map(({ __line, ...r }) => r) }, null, 2) + '\n', 'utf8');

// ---- quality report (md) ----
const q = [];
q.push('# INSAaf AI — V2 Final Expansion · Dataset Quality Report');
q.push('');
q.push('- **Dataset:** `rag/training/v2_expansion/v2_changeset.jsonl`');
q.push('- **Examples:** ' + examples.length + '  |  **Source-linked:** ' + sourceLinked + ' (' + Math.round((sourceLinked / examples.length) * 100) + '%)');
q.push('- **Overall QC:** **' + (hardPass ? 'PASS' : 'FAIL') + '** (' + failures.length + ' hard failures)');
q.push('');
q.push('## Validation checks');
q.push('');
q.push('| Check | Result |');
q.push('|---|---|');
q.push('| Valid JSON / required base fields | ' + (failures.filter((f) => /missing field|empty|invalid JSON/.test(f)).length === 0 ? 'PASS' : 'FAIL') + ' |');
q.push('| Metadata present (id/group/subdomain/jurisdiction/difficulty/source_linked) | ' + (failures.filter((f) => /missing metadata|bad difficulty|source_linked must/.test(f)).length === 0 ? 'PASS' : 'FAIL') + ' |');
q.push('| Language / domain / task / group enums | ' + (failures.filter((f) => /bad (language|domain|task|behavior_group)/.test(f)).length === 0 ? 'PASS' : 'FAIL') + ' |');
q.push('| All six behaviour groups represented | ' + (missingGroups.length === 0 ? 'PASS' : 'FAIL: ' + missingGroups.join(', ')) + ' |');
q.push('| Every source_ref resolves in corpus | ' + (failures.filter((f) => /unresolved source_ref/.test(f)).length === 0 ? 'PASS' : 'FAIL') + ' |');
q.push('| No non-corpus URLs | ' + (failures.filter((f) => /non-corpus URL/.test(f)).length === 0 ? 'PASS' : 'FAIL') + ' |');
q.push('| No ellipsis / stray dot-runs (outside drafting) | ' + (failures.filter((f) => /ellipsis|dot run/.test(f)).length === 0 ? 'PASS' : 'FAIL') + ' |');
q.push('| Document-language rule (chat EN/Roman; docs EN/Urdu-script; no Roman in docs) | ' + (failures.filter((f) => /Urdu script|Roman Urdu used inside/.test(f)).length === 0 ? 'PASS' : 'FAIL') + ' |');
q.push('| No fabricated citations (citations resolve) | ' + (fabricatedCitationHits === 0 ? 'PASS' : 'FLAG (' + fabricatedCitationHits + ')') + ' |');
q.push('| No invented personal contacts/fees | ' + (fabricatedContactHits === 0 ? 'PASS' : 'ADVISORY (' + fabricatedContactHits + ' phone-like, verify official helplines)') + ' |');
q.push('| No unsupported country-law assertions | ' + (countryLawHits === 0 ? 'PASS' : 'FLAG (' + countryLawHits + ')') + ' |');
q.push('| No duplicate example_ids | ' + (dupIds === 0 ? 'PASS' : 'FAIL (' + dupIds + ')') + ' |');
q.push('| No exact duplicate triples | ' + (dups === 0 ? 'PASS' : 'FAIL (' + dups + ')') + ' |');
q.push('| **Test-set contamination (must be 0)** | **' + (contaminated === 0 ? 'PASS' : 'FAIL (' + contaminated + ')') + '** |');
q.push('| **V1 immutability (hashes unchanged)** | **' + (v1ok ? 'PASS' : 'FAIL') + '** |');
q.push('');
q.push('## Distribution');
q.push('');
q.push('- **By behaviour group:** ' + JSON.stringify(byGroup));
q.push('- **By language:** ' + JSON.stringify(byLang) + ' (Roman-Urdu chat: ' + romanChat + '; Urdu-script documents: ' + urduScriptDocs + ')');
q.push('- **By domain:** ' + JSON.stringify(byDomain));
q.push('- **By task:** ' + JSON.stringify(byTask));
q.push('- **By difficulty:** ' + JSON.stringify(byDiff));
q.push('');
if (notes.length) { q.push('## Advisories (non-blocking)'); q.push(''); for (const n of notes) q.push('- ' + n); q.push(''); }
if (failures.length) { q.push('## Hard failures'); q.push(''); for (const f of failures) q.push('- ' + f); q.push(''); }
q.push('---');
q.push('Deterministic QC only (no browser audit, no model training). Generated by `server/validateV2FinalExpansion.js`.');
q.push('');
fs.writeFileSync(path.join(OUT_DIR, 'v2_dataset_quality_report.md'), q.join('\n'), 'utf8');

// ---- retrain readiness (md) ----
const readinessChecks = {
  'V1 dataset immutable (hashes unchanged)': v1ok,
  'Test set not contaminated': contaminated === 0,
  'All six behaviour groups present': missingGroups.length === 0,
  'All source_refs resolve': examples.reduce((n, e) => n + (e.source_refs || []).filter((r) => { let x = refCache.get(r); if (!x) { x = resolveRef(r, corpus); refCache.set(r, x); } return !x.ok; }).length, 0) === 0,
  'No fabricated citations': fabricatedCitationHits === 0,
  'Document-language rule respected': examples.filter((e) => e.task === 'document_drafting' && e.language === 'roman_ur').length === 0 && failures.filter((f) => /Urdu script/.test(f)).length === 0,
  'Schema/enum valid': failures.filter((f) => /bad (language|domain|task|behavior_group)|missing field|empty|not an array/.test(f)).length === 0,
};
const ready = Object.values(readinessChecks).every(Boolean);
const rd = [];
rd.push('# INSAaf AI — V2 Retrain Readiness');
rd.push('');
rd.push('## Verdict: **' + (ready ? 'READY' : 'NOT READY') + '** for a future V2 fine-tune data-prep (NO training performed)');
rd.push('');
rd.push('| Readiness criterion | Status |');
rd.push('|---|---|');
for (const [k, v] of Object.entries(readinessChecks)) rd.push('| ' + k + ' | ' + (v ? 'READY' : 'BLOCKED') + ' |');
rd.push('');
rd.push('## How to train later (NOT now)');
rd.push('');
rd.push('1. Assemble training set = V1 `train.jsonl` + V1 `validation.jsonl` + `v2v3_changeset.jsonl` + `v2_expansion/v2_changeset.jsonl`.');
rd.push('2. Keep V1 `test.jsonl` (433) untouched as the evaluation set.');
rd.push('3. Do not enable any V1 LoRA adapter in production; production model behaviour is unchanged by this task.');
rd.push('4. Corpus for RAG is frozen in `rag/corpus_expansion/final_corpus_*.{json,md}` (freeze_hash lock).');
rd.push('');
rd.push('## Genuinely remaining gaps the expansion cannot teach (needs verified corpus growth, not more data rows)');
rd.push('');
rd.push('- High Court case law (only SC/FSC digests exist) — cannot add verified HC citations without sources.');
rd.push('- Country-specific FOREIGN substantive law — intentionally NOT fabricated; layer routes to official foreign authorities only.');
rd.push('- Semantic embedding vectors are zero (offline): retrieval is keyword + exact-provision only until a valid key + rebuild.');
rd.push('- Provincial full statutes are digests, not complete acts.');
rd.push('');
fs.writeFileSync(path.join(OUT_DIR, 'v2_retrain_readiness.md'), rd.join('\n'), 'utf8');

console.log('=== FINAL V2 EXPANSION VALIDATION ===');
console.log('examples          : ' + examples.length);
console.log('behaviour groups  : ' + JSON.stringify(byGroup));
console.log('languages         : ' + JSON.stringify(byLang) + ' (ur-docs=' + urduScriptDocs + ', roman-chat=' + romanChat + ')');
console.log('source-linked     : ' + sourceLinked + '/' + examples.length);
console.log('test contamination: ' + contaminated + ' (must be 0)');
console.log('fabricated cites  : ' + fabricatedCitationHits + ' | country-law flags: ' + countryLawHits + ' | phone-like: ' + fabricatedContactHits);
console.log('V1 unchanged      : ' + v1ok + ' ' + JSON.stringify(v1));
console.log('QC result         : ' + (hardPass ? 'PASS' : 'FAIL (' + failures.length + ')'));
console.log('retrain readiness : ' + (ready ? 'READY' : 'NOT READY'));
if (failures.length) { console.log('\nFAILURES:'); failures.slice(0, 40).forEach((f) => console.log('  - ' + f)); }
if (notes.length) { console.log('\nADVISORIES:'); notes.slice(0, 20).forEach((n) => console.log('  - ' + n)); }
console.log('\n==== V2 EXPANSION QC: ' + (hardPass ? 'PASS' : 'FAIL') + ' | READINESS: ' + (ready ? 'READY' : 'NOT READY') + ' ====');
process.exit(hardPass ? 0 : 1);
