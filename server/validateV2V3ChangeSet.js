// ============================================================================
// INSAaf AI — V2/V3 CHANGE-SET VALIDATOR  (Phase AU)
// ============================================================================
// Independent check of rag/training/v2v3_changeset.jsonl. Deliberately separate
// from the generator (server/generateV2V3ChangeSet.js) so drift is caught, and
// mirrors the hard rules in server/validateFineTuneDataset.js so the change-set
// stays combinable with the preserved V1 dataset.
//
//   node server/validateV2V3ChangeSet.js     (exit 0 = every hard check passes)
//
// Hard checks per example:
//   * valid JSON; required fields present & non-empty
//   * language/domain/task in the V1 enums; task->language lock respected
//   * source_refs is an array and EVERY ref resolves against the corpus
//   * no unicode ellipsis / no bare "..." ; dot-runs only inside document_drafting
//   * no non-corpus URLs (allowlist)
//   * Part A script policy: language "ur" MUST contain Urdu script; "en"/"roman_ur"
//     MUST NOT (Urdu script is a document-only language, never a chat language)
// Global checks:
//   * no exact duplicate (instruction,input,output) triples
//   * TEST-SET CONTAMINATION: no example is a near-duplicate (Jaccard>=0.9 on BOTH
//     question and answer) of any of the 433 test.jsonl examples
//   * V1 train/validation/test.jsonl hashes UNCHANGED (V1 preserved)
// ============================================================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { loadCorpus, resolveRef, checkUrls } from './fineTuneData/refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAIN_DIR = path.resolve(__dirname, '../rag/training');
const CHANGESET = path.join(TRAIN_DIR, 'v2v3_changeset.jsonl');

const VALID_LANGUAGES = new Set(['en', 'ur', 'roman_ur']);
const VALID_DOMAINS = new Set(['constitution', 'criminal_law', 'criminal_procedure', 'civil_procedure', 'cybercrime', 'family_law', 'property', 'tenancy', 'labour', 'consumer', 'education', 'legal_aid', 'court_procedure', 'case_law', 'documents', 'general']);
const VALID_TASKS = new Set(['legal_qa', 'offence_punishment', 'fundamental_rights', 'legal_procedures', 'situation_action', 'legal_remedies', 'case_law', 'similar_case', 'legal_terminology', 'en_legal_answer', 'ur_legal_answer', 'rom_legal_answer', 'document_explanation', 'document_drafting', 'source_aware', 'refusal', 'domain_classification']);
const TASK_LANGUAGE = { en_legal_answer: 'en', ur_legal_answer: 'ur', rom_legal_answer: 'roman_ur' };
const V1_BASELINE = { 'train.jsonl': '9F830BE9F2F5D34D', 'validation.jsonl': '28594BEEDAFC340F', 'test.jsonl': 'E59E24F9DEE0B525' };
const URDU = /[\u0600-\u06FF]/;

const toks = (s) => new Set(String(s).toLowerCase().split(/[^a-z0-9\u0600-\u06FF]+/).filter((t) => t.length > 1 || /[0-9\u0600-\u06FF]/.test(t)));
function jaccard(a, b) { let inter = 0; for (const t of a) if (b.has(t)) inter++; const union = a.size + b.size - inter; return union === 0 ? 0 : inter / union; }
const NEAR_DUP = 0.9;
const sha16 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16).toUpperCase();

const failures = [];
const corpus = loadCorpus();

if (!fs.existsSync(CHANGESET)) { console.error('FAIL: change-set file not found at ' + CHANGESET); process.exit(1); }
const lines = fs.readFileSync(CHANGESET, 'utf8').split(/\r?\n/).filter((l) => l.trim().length);
const examples = [];
for (let i = 0; i < lines.length; i++) {
  let e; try { e = JSON.parse(lines[i]); } catch (err) { failures.push('line ' + (i + 1) + ': invalid JSON (' + err.message + ')'); continue; }
  e.__line = i + 1; examples.push(e);
}

const refCache = new Map();
for (const e of examples) {
  const L = 'line ' + e.__line;
  for (const f of ['instruction', 'input', 'output', 'language', 'domain', 'task', 'source_refs']) if (!(f in e)) failures.push(L + ': missing field "' + f + '"');
  for (const f of ['instruction', 'input', 'output']) if (typeof e[f] !== 'string' || !e[f].trim()) failures.push(L + ': empty "' + f + '"');
  if (!VALID_LANGUAGES.has(e.language)) failures.push(L + ': bad language "' + e.language + '"');
  if (!VALID_DOMAINS.has(e.domain)) failures.push(L + ': bad domain "' + e.domain + '"');
  if (!VALID_TASKS.has(e.task)) failures.push(L + ': bad task "' + e.task + '"');
  const want = TASK_LANGUAGE[e.task]; if (want && e.language !== want) failures.push(L + ': task "' + e.task + '" requires language "' + want + '", got "' + e.language + '"');
  if (/\u2026/.test(e.output)) failures.push(L + ': unicode ellipsis in output');
  for (const m of (String(e.output).match(/\.{2,}/g) || [])) { if (m.length === 3) failures.push(L + ': bare "..." in output'); else if (e.task !== 'document_drafting') failures.push(L + ': ' + m.length + '-dot run outside document_drafting'); }
  for (const f of ['instruction', 'input', 'output']) for (const u of checkUrls(String(e[f] || ''))) failures.push(L + ': non-corpus URL in ' + f + ': ' + u);
  if (!Array.isArray(e.source_refs)) failures.push(L + ': source_refs not an array');
  else for (const ref of e.source_refs) {
    if (typeof ref !== 'string' || !ref.trim()) { failures.push(L + ': empty source_ref'); continue; }
    let r = refCache.get(ref); if (!r) { r = resolveRef(ref, corpus); refCache.set(ref, r); }
    if (!r.ok) failures.push(L + ': unresolved source_ref "' + ref + '" (' + r.reason + ')');
  }
  const hasUrdu = URDU.test(String(e.output));
  if (e.language === 'ur' && !hasUrdu) failures.push(L + ': language "ur" but output has NO Urdu script');
  if ((e.language === 'en' || e.language === 'roman_ur') && hasUrdu) failures.push(L + ': language "' + e.language + '" but output contains Urdu script (chat must be EN/Roman only)');
}

const triples = new Map();
for (const e of examples) { const k = e.instruction + '\u0000' + e.input + '\u0000' + e.output; triples.set(k, (triples.get(k) || 0) + 1); }
let dups = 0; for (const n of triples.values()) if (n > 1) dups += n - 1;
if (dups) failures.push(dups + ' exact duplicate triples within the change-set');

const testEx = fs.readFileSync(path.join(TRAIN_DIR, 'test.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).map((e) => ({ qa: toks(e.instruction + ' ' + e.input), out: toks(e.output) }));
let contaminated = 0;
for (const e of examples) { const qa = toks(e.instruction + ' ' + e.input), out = toks(e.output); for (const t of testEx) if (jaccard(qa, t.qa) >= NEAR_DUP && jaccard(out, t.out) >= NEAR_DUP) { contaminated++; break; } }
if (contaminated) failures.push(contaminated + ' example(s) would contaminate the 433-example test set');

let v1ok = true; const v1 = {};
for (const f of Object.keys(V1_BASELINE)) { const h = sha16(path.join(TRAIN_DIR, f)); v1[f] = h === V1_BASELINE[f]; if (h !== V1_BASELINE[f]) v1ok = false; }
if (!v1ok) failures.push('V1 dataset files changed: ' + JSON.stringify(v1));

const areas = new Set(examples.map((e) => e.behaviour));
const REQUIRED = ['document_reasoning', 'document_action', 'document_reply', 'professional_guidance', 'case_reasoning', 'case_comparison', 'legal_procedures', 'lawyer_lookup', 'legal_aid', 'app_navigation', 'refusal_safety', 'english', 'roman_urdu', 'urdu_script_document'];
const missingAreas = REQUIRED.filter((a) => !areas.has(a));
if (missingAreas.length) failures.push('missing AU behaviour areas: ' + missingAreas.join(', '));

console.log('=== PHASE AU — V2/V3 CHANGE-SET VALIDATION ===');
console.log('examples          : ' + examples.length);
console.log('behaviour areas   : ' + [...areas].sort().join(', '));
console.log('languages         : ' + JSON.stringify(examples.reduce((a, e) => (a[e.language] = (a[e.language] || 0) + 1, a), {})));
console.log('urdu-script ex    : ' + examples.filter((e) => URDU.test(e.output)).length + ' (all language="ur")');
console.log('refs resolved     : ' + examples.reduce((n, e) => n + e.source_refs.length, 0) + ' (all validated against corpus)');
console.log('test-set protect  : ' + contaminated + ' contaminating (must be 0)');
console.log('V1 files unchanged: ' + v1ok + ' ' + JSON.stringify(v1));
if (failures.length) { console.log('\nFAILURES (' + failures.length + '):'); failures.slice(0, 40).forEach((f) => console.log('  - ' + f)); console.log('\n==== CHANGE-SET VALIDATION: FAIL ===='); process.exit(1); }
console.log('\n==== CHANGE-SET VALIDATION: ' + examples.length + '/' + examples.length + ' PASS ====');
process.exit(0);
