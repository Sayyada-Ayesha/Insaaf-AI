// ---------------------------------------------------------------------------
// INSAaf AI — Fine-Tuning Dataset Validator (PHASE 3, spec §18–19)
// ---------------------------------------------------------------------------
// Validates rag/training/{train,validation,test}.jsonl against the dataset
// spec and writes rag/training/dataset_report.json.
//
//   node server/validateFineTuneDataset.js      (or: npm run dataset:validate)
//
// Exit code: 0 when every hard check passes, 1 otherwise.
//
// The validator is intentionally independent of the generator: the
// allowed-value lists below are duplicated so drift in either file is caught.
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadCorpus, resolveRef, checkUrls } from './fineTuneData/refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../rag/training');
const FILES = ['train.jsonl', 'validation.jsonl', 'test.jsonl'];

// Must match the constants in server/generateFineTuneDataset.js.
const VALID_LANGUAGES = new Set(['en', 'ur', 'roman_ur']);
const VALID_DOMAINS = new Set([
  'constitution', 'criminal_law', 'criminal_procedure', 'civil_procedure',
  'cybercrime', 'family_law', 'property', 'tenancy', 'labour', 'consumer',
  'education', 'legal_aid', 'court_procedure', 'case_law', 'documents', 'general',
]);
const VALID_TASKS = new Set([
  'legal_qa', 'offence_punishment', 'fundamental_rights', 'legal_procedures',
  'situation_action', 'legal_remedies', 'case_law', 'similar_case',
  'legal_terminology', 'en_legal_answer', 'ur_legal_answer', 'rom_legal_answer',
  'document_explanation', 'document_drafting', 'source_aware', 'refusal',
  'domain_classification',
]);
// Tasks whose name locks the expected language.
const TASK_LANGUAGE = { en_legal_answer: 'en', ur_legal_answer: 'ur', rom_legal_answer: 'roman_ur' };

// Tokenizer identical to the generator's, so Jaccard thresholds are comparable.
const toks = (s) => new Set(String(s).toLowerCase()
  .split(/[^a-z0-9\u0600-\u06FF]+/)
  .filter((t) => t.length > 1 || /[0-9\u0600-\u06FF]/.test(t)));
function jaccardSets(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
const jaccardStr = (a, b) => jaccardSets(toks(a), toks(b));
const qaText = (e) => e.instruction + ' ' + e.input;

// Contamination threshold — same value the generator uses for near-duplicates.
const NEAR_DUP = 0.9;

const failures = [];
const warnings = [];
const notes = [];
const unsupportedRefs = new Map(); // "ref — reason" -> count
const disallowedUrlSet = new Set();
const corpus = loadCorpus();

// ---------------------------------------------------------------------------
// 1. Parse the three JSONL files.
// ---------------------------------------------------------------------------
const data = { train: [], validation: [], test: [] };
for (const f of FILES) {
  const p = path.join(DATA_DIR, f);
  if (!fs.existsSync(p)) {
    failures.push({ file: f, line: 0, kind: 'missing_file', detail: `${f} does not exist` });
    continue;
  }
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  const key = f.replace('.jsonl', '');
  for (let i = 0; i < lines.length; i++) {
    let e;
    try {
      e = JSON.parse(lines[i]);
    } catch (err) {
      failures.push({ file: f, line: i + 1, kind: 'invalid_json', detail: String(err.message) });
      continue;
    }
    e.__file = f;
    e.__line = i + 1;
    data[key].push(e);
  }
}

// ---------------------------------------------------------------------------
// 2. Per-example hard checks.
// ---------------------------------------------------------------------------
const refCache = new Map();
function fail(e, kind, detail) {
  failures.push({ file: e.__file, line: e.__line, kind, detail });
}
function warn(e, kind, detail) {
  warnings.push({ file: e.__file, line: e.__line, kind, detail });
}

function checkExample(e) {
  // Required fields.
  for (const field of ['instruction', 'input', 'output', 'language', 'domain', 'task', 'source_refs']) {
    if (!(field in e)) fail(e, 'missing_field', `missing "${field}"`);
  }
  // Text fields: non-empty strings.
  for (const field of ['instruction', 'input', 'output']) {
    const v = e[field];
    if (typeof v !== 'string' || !v.trim()) fail(e, 'empty_field', `"${field}" must be a non-empty string`);
  }
  // Enum fields.
  if (typeof e.language === 'string' && !VALID_LANGUAGES.has(e.language)) {
    fail(e, 'invalid_language', `unknown language "${e.language}"`);
  }
  if (typeof e.domain === 'string' && !VALID_DOMAINS.has(e.domain)) {
    fail(e, 'invalid_domain', `unknown domain "${e.domain}"`);
  }
  if (typeof e.task === 'string' && !VALID_TASKS.has(e.task)) {
    fail(e, 'invalid_task', `unknown task "${e.task}"`);
  }
  // Task -> language consistency.
  const want = TASK_LANGUAGE[e.task];
  if (want && e.language !== want) {
    fail(e, 'task_language_mismatch', `task "${e.task}" requires language "${want}", got "${e.language}"`);
  }
  // No unfinished sentences: true "..." ellipses and unicode ellipses.
  // Dotted leaders (4+ dots, e.g. "..........") are a legitimate Pakistani
  // drafting convention and are only allowed inside document_drafting outputs.
  if (typeof e.output === 'string') {
    if (/…/.test(e.output)) fail(e, 'ellipsis_in_output', 'unicode ellipsis (…) found in output');
    const runRe = /\.{2,}/g;
    let m;
    while ((m = runRe.exec(e.output)) !== null) {
      if (m[0].length === 3) {
        fail(e, 'ellipsis_in_output', '"..." unfinished-sentence marker found in output');
      } else if (e.task !== 'document_drafting') {
        fail(e, 'dot_run_in_output', `${m[0].length}-dot run outside a document_drafting output`);
      }
    }
  }
  // No hallucinated URLs outside the corpus allowlist.
  for (const field of ['instruction', 'input', 'output']) {
    for (const u of checkUrls(String(e[field] || ''))) {
      disallowedUrlSet.add(u);
      fail(e, 'disallowed_url', `"${field}" contains non-corpus URL ${u}`);
    }
  }
  // No raw RAG metadata leaked into answers (info-level check).
  if (typeof e.output === 'string' && /(docId|chunkId|rag_index|byDocKey)\s*[:=]/.test(e.output)) {
    warn(e, 'raw_rag_metadata', 'output appears to contain raw RAG index metadata');
  }
  // Source references must resolve against the RAG corpus.
  if (Array.isArray(e.source_refs)) {
    for (const ref of e.source_refs) {
      if (typeof ref !== 'string' || !ref.trim()) {
        fail(e, 'empty_reference', 'source_refs contains an empty entry');
        continue;
      }
      let r = refCache.get(ref);
      if (!r) {
        r = resolveRef(ref, corpus);
        refCache.set(ref, r);
      }
      if (!r.ok) {
        const tag = `${ref} — ${r.reason}`;
        unsupportedRefs.set(tag, (unsupportedRefs.get(tag) || 0) + 1);
        fail(e, 'unsupported_reference', tag);
      }
    }
  } else {
    fail(e, 'invalid_source_refs', 'source_refs must be an array');
  }
}

const all = [];
for (const key of ['train', 'validation', 'test']) {
  for (const e of data[key]) {
    checkExample(e);
    e.__qaToks = toks(qaText(e));
    e.__outToks = toks(e.output);
    all.push(e);
  }
}

// ---------------------------------------------------------------------------
// 3. Exact duplicate (instruction, input, output) triples.
// ---------------------------------------------------------------------------
const tripleCounts = new Map();
for (const e of all) {
  const key = e.instruction + '\u0000' + e.input + '\u0000' + e.output;
  tripleCounts.set(key, (tripleCounts.get(key) || 0) + 1);
}
let duplicateCount = 0;
for (const n of tripleCounts.values()) if (n > 1) duplicateCount += n - 1;
if (duplicateCount > 0) {
  failures.push({ file: '(all)', line: 0, kind: 'exact_duplicates', detail: `${duplicateCount} exact duplicate (instruction, input, output) triples` });
}

// Same question+answer under a DIFFERENT instruction is a deliberate
// cross-task overlap; reported for transparency, not treated as a failure.
const pairCounts = new Map();
for (const e of all) {
  const key = e.input + '\u0000' + e.output;
  pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
}
let sharedQAPairs = 0;
for (const n of pairCounts.values()) if (n > 1) sharedQAPairs += n - 1;

// ---------------------------------------------------------------------------
// 4. Cross-split contamination (test must be genuinely unseen).
// A test example is contaminated when some train/validation example shares
// BOTH a near-identical question (Jaccard >= 0.9) AND a near-identical
// answer (Jaccard >= 0.9).
// ---------------------------------------------------------------------------
const pool = [...data.train, ...data.validation];
const contamination = [];
for (const te of data.test) {
  for (const pe of pool) {
    if (jaccardSets(te.__qaToks, pe.__qaToks) >= NEAR_DUP &&
        jaccardSets(te.__outToks, pe.__outToks) >= NEAR_DUP) {
      contamination.push({ testLine: te.__line, poolFile: pe.__file, poolLine: pe.__line, input: String(te.input).slice(0, 90) });
      if (contamination.length <= 20) break;
    }
  }
  if (contamination.length > 20) break;
}
if (contamination.length > 0) {
  failures.push({ file: 'test.jsonl', line: 0, kind: 'split_contamination', detail: `${contamination.length} near-duplicate test example(s) also present in train/validation` });
}

// Within-split near-duplicates (informational — paraphrases are expected only
// where the generator deliberately kept them apart; a high number is a smell).
function nearDupPairs(list) {
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (jaccardSets(list[i].__qaToks, list[j].__qaToks) >= NEAR_DUP &&
          jaccardSets(list[i].__outToks, list[j].__outToks) >= NEAR_DUP) n++;
    }
  }
  return n;
}
const withinDups = {
  train: nearDupPairs(data.train),
  validation: nearDupPairs(data.validation),
  test: nearDupPairs(data.test),
};

// ---------------------------------------------------------------------------
// 5. Distribution (languages, domains, tasks, splits).
// ---------------------------------------------------------------------------
const tally = (list, key) => {
  const m = {};
  for (const e of list) m[e[key]] = (m[e[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const totals = { train: data.train.length, validation: data.validation.length, test: data.test.length };
const total = totals.train + totals.validation + totals.test;
const languageCounts = tally(all, 'language');
const domainCounts = tally(all, 'domain');
const taskCounts = tally(all, 'task');
const splitPercentages = {};
for (const k of ['train', 'validation', 'test']) {
  splitPercentages[k] = total ? Math.round((totals[k] / total) * 1000) / 10 : 0;
}
// Balance warnings.
for (const lang of VALID_LANGUAGES) {
  const pct = total ? (languageCounts[lang] || 0) / total : 0;
  if (pct < 0.2) warnings.push({ file: '(all)', line: 0, kind: 'language_balance', detail: `language "${lang}" is only ${(pct * 100).toFixed(1)}% of the dataset` });
}
for (const d of VALID_DOMAINS) {
  if (!(domainCounts[d] > 0)) warnings.push({ file: '(all)', line: 0, kind: 'domain_balance', detail: `domain "${d}" has zero examples` });
}
notes.push(`Split is ${splitPercentages.train}/${splitPercentages.validation}/${splitPercentages.test} (train/validation/test). The core pool is hashed 70/15/15; a held-out test pool (paraphrases, refusals, classification, source-aware, scenarios, similar cases, misc, drafting-missing, language tasks) is always assigned to test by design, which raises the test share.`);

// ---------------------------------------------------------------------------
// 6. Source provenance counts.
// ---------------------------------------------------------------------------
let withRefs = 0;
let withoutRefs = 0;
const refFrequency = new Map();
for (const e of all) {
  if (Array.isArray(e.source_refs) && e.source_refs.length > 0) {
    withRefs++;
    for (const r of e.source_refs) refFrequency.set(r, (refFrequency.get(r) || 0) + 1);
  } else {
    withoutRefs++;
  }
}
const topReferences = Object.fromEntries(
  [...refFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
);

// ---------------------------------------------------------------------------
// 7. Manifest consistency.
// ---------------------------------------------------------------------------
let manifest = null;
const manifestPath = path.join(DATA_DIR, 'dataset_manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const mCounts = manifest.counts || {};
    for (const k of ['train', 'validation', 'test']) {
      if (mCounts[k] !== undefined && mCounts[k] !== totals[k]) {
        warnings.push({ file: 'dataset_manifest.json', line: 0, kind: 'manifest_mismatch', detail: `manifest ${k}=${mCounts[k]} but file has ${totals[k]}` });
      }
    }
    if (manifest.counts && manifest.counts.total !== total) {
      warnings.push({ file: 'dataset_manifest.json', line: 0, kind: 'manifest_mismatch', detail: `manifest total=${manifest.counts.total} but files have ${total}` });
    }
  } catch (err) {
    warnings.push({ file: 'dataset_manifest.json', line: 0, kind: 'manifest_invalid', detail: String(err.message) });
  }
} else {
  warnings.push({ file: 'dataset_manifest.json', line: 0, kind: 'manifest_missing', detail: 'dataset_manifest.json not found' });
}

// ---------------------------------------------------------------------------
// 8. Report + exit.
// ---------------------------------------------------------------------------
const report = {
  name: 'INSAaf AI — Fine-Tuning Dataset Validation Report',
  generatedAt: new Date().toISOString(),
  validator: 'server/validateFineTuneDataset.js',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  totalExamples: total,
  trainCount: totals.train,
  validationCount: totals.validation,
  testCount: totals.test,
  splitPercentages,
  englishCount: languageCounts.en || 0,
  urduCount: languageCounts.ur || 0,
  romanUrduCount: languageCounts.roman_ur || 0,
  domainCounts,
  taskCounts,
  sourceCounts: {
    examplesWithRefs: withRefs,
    examplesWithoutRefs: withoutRefs,
    topReferences,
  },
  duplicateCount,
  sharedQuestionAnswerPairsUnderDifferentInstructions: sharedQAPairs,
  crossSplitContaminationCount: contamination.length,
  contaminationSamples: contamination.slice(0, 20),
  withinSplitNearDuplicates: withinDups,
  validationFailures: failures.slice(0, 200),
  validationFailureCount: failures.length,
  unsupportedReferences: Object.fromEntries(
    [...unsupportedRefs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100)
  ),
  disallowedUrls: [...disallowedUrlSet],
  warnings: warnings.slice(0, 100),
  notes,
};

fs.writeFileSync(path.join(DATA_DIR, 'dataset_report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log('=== DATASET VALIDATION ===');
console.log(`Total: ${total} | train: ${totals.train} | validation: ${totals.validation} | test: ${totals.test}`);
console.log(`Languages: ${JSON.stringify(languageCounts)}`);
console.log(`Domains: ${Object.keys(domainCounts).length}/${VALID_DOMAINS.size}`);
console.log(`Tasks: ${Object.keys(taskCounts).length}/${VALID_TASKS.size}`);
console.log(`Duplicates: ${duplicateCount}`);
console.log(`Cross-split contamination: ${contamination.length}`);
console.log(`Unsupported references: ${unsupportedRefs.size} unique`);
console.log(`Disallowed URLs: ${disallowedUrlSet.size}`);
console.log(`Failures: ${failures.length} | Warnings: ${warnings.length}`);
console.log(`STATUS: ${report.status}`);
console.log('Report written to', path.join(DATA_DIR, 'dataset_report.json'));
for (const f of failures.slice(0, 25)) console.log(`  FAIL [${f.file}:${f.line}] ${f.kind}: ${f.detail}`);
for (const w of warnings.slice(0, 15)) console.log(`  WARN [${w.file}:${w.line}] ${w.kind}: ${w.detail}`);

process.exit(failures.length === 0 ? 0 : 1);
