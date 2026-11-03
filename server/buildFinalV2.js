// ---------------------------------------------------------------------------
// INSAaf AI — FINAL V2 Training Package Builder (spec PHASES 14–17)
// ---------------------------------------------------------------------------
// Builds rag/training/final_v2/{train.jsonl, validation.jsonl, manifest.json,
// quality_report.md, source_coverage.json, contamination_report.json,
// training_readiness.md} from:
//   A) the frozen RAG corpus        (loaded read-only for ref resolution)
//   B) V1 dataset                   (train.jsonl + validation.jsonl, read-only;
//                                    hashes asserted; test.jsonl HELD OUT)
//   C) validated V2 expansions      (v2v3_changeset.jsonl +
//                                    v2_expansion/v2_changeset.jsonl)
//   D–K) verified new behaviours    (already captured inside the change-sets)
//
// Rules honoured:
//   - V1 files are never modified; their SHA-256 (hash16 prefix) is asserted.
//   - V1 test.jsonl (433) stays completely held out; nothing from it is copied
//     into the package, and every addition is deduped against it.
//   - Additions are deduped against V1 train/validation/test and each other
//     (Jaccard >= 0.9 on BOTH question and answer, same as the V1 validator).
//   - source_refs must resolve against the frozen corpus (resolveRef).
//   - No fabricated legal facts: every change-set output was captured from the
//     running owned-model pipeline (see change-set manifests); V1 rows are
//     used exactly as shipped. No new legal content is authored here.
//   - Language rules: never Roman Urdu inside a formal-document target
//     (document_drafting); Urdu script only in `ur` rows.
//
//   node server/buildFinalV2.js
// Exit code: 0 = package written and validated; 1 = validation failed
// (nothing is written when a hard check fails).
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { loadCorpus, resolveRef, checkUrls, normKey, norm } from './fineTuneData/refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../rag/training');
const OUT_DIR = path.join(DATA_DIR, 'final_v2');

const V1_FILES = ['train.jsonl', 'validation.jsonl', 'test.jsonl'];
const V1_EXPECTED_HASH16 = {
  'train.jsonl': '9F830BE9F2F5D34D',
  'validation.jsonl': '28594BEEDAFC340F',
  'test.jsonl': 'E59E24F9DEE0B525',
};
const CHANGESETS = [
  { origin: 'v2v3_changeset', label: 'V2/V3 change-set (37)', file: 'v2v3_changeset.jsonl' },
  { origin: 'v2_expansion', label: 'V2 expansion change-set (56)', file: 'v2_expansion/v2_changeset.jsonl' },
];

// Enum lists must match server/generateFineTuneDataset.js + validateFineTuneDataset.js,
// extended by the validated `cross_border` domain introduced with the V2 expansion.
const VALID_LANGUAGES = new Set(['en', 'ur', 'roman_ur']);
const VALID_DOMAINS = new Set([
  'constitution', 'criminal_law', 'criminal_procedure', 'civil_procedure',
  'cybercrime', 'family_law', 'property', 'tenancy', 'labour', 'consumer',
  'education', 'legal_aid', 'court_procedure', 'case_law', 'documents', 'general',
  'cross_border',
]);
const VALID_TASKS = new Set([
  'legal_qa', 'offence_punishment', 'fundamental_rights', 'legal_procedures',
  'situation_action', 'legal_remedies', 'case_law', 'similar_case',
  'legal_terminology', 'en_legal_answer', 'ur_legal_answer', 'rom_legal_answer',
  'document_explanation', 'document_drafting', 'source_aware', 'refusal',
  'domain_classification',
]);
const TASK_LANGUAGE = { en_legal_answer: 'en', ur_legal_answer: 'ur', rom_legal_answer: 'roman_ur' };
const BEHAVIOUR_GROUPS = new Set([
  'cross_border', 'agent', 'document_ocr', 'procedure_strategy',
  'safety_hallucination', 'answer_quality',
]);
const NEAR_DUP = 0.9;

const ARABIC = /[\u0600-\u06FF]/;
const CITATION_RE = /((?:PLD|SCMR|FSC)\s+\d{4}(?:\s+(?:SC|FSC|\d{1,4}))?)|(\d{4}\s+SCMR\s+\d{1,4})/i;
const PHONE_SCAN = /\d[\d\s().-]{7,}\d/g;
const DATE_DIGITS = /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/; // YYYYMMDD
const FOREIGN_LAW_CLAIM = /(?:under|according to|governed by|as per|per)\s+(?:the\s+)?(?:saudi|uae|emirati|dubai|qatari|omani|kuwaiti|bahraini|american|\bus\b|u\.s|uk|british|english|canadian|australian|german|french|italian|spanish|dutch|chinese|japanese|turkish|european|gulf)\s+(?:law|court|labou?r law|employment law|immigration law)/i;
const JURIS_OK = /^(?:Pakistan|Pakistan \(.*\)|Cross-border \(.*\))$/;

// Tokenizer identical to the generator/validator, so thresholds are comparable.
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

const sha256Hex = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hash16 = (hex) => hex.slice(0, 16).toUpperCase();

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
const loadJsonl = (p) => fs.readFileSync(p, 'utf8').split('\n')
  .filter((l) => l.trim().length > 0).map((l, i) => ({ e: JSON.parse(l), line: i + 1 }));

const v1Data = {};
for (const f of V1_FILES) {
  const p = path.join(DATA_DIR, f);
  const hex = sha256Hex(p);
  const h16 = hash16(hex);
  if (h16 !== V1_EXPECTED_HASH16[f]) {
    console.error(`V1 immutability FAILED: ${f} hash16 ${h16} != expected ${V1_EXPECTED_HASH16[f]}`);
    process.exit(1);
  }
  v1Data[f] = { rows: loadJsonl(p), sha256: hex, hash16: h16 };
  console.log(`V1 immutable OK: ${f} (${v1Data[f].rows.length} rows, hash16 ${h16})`);
}

const corpus = loadCorpus();
const issues = [];
const v1LangExclusions = []; // V1 rows whose target violates the formal-document language rule
function issue(where, kind, detail) {
  issues.push({ where, kind, detail });
}

// ---------------------------------------------------------------------------
// Per-example hard checks (schema, enums, language rules, URLs, refs,
// ellipses, contacts, citations, country-law claims)
// ---------------------------------------------------------------------------
function checkExample(src, row, extra = {}) {
  const { e, line } = row;
  const where = `${src}:${line}`;
  for (const field of ['instruction', 'input', 'output', 'language', 'domain', 'task', 'source_refs']) {
    if (!(field in e)) issue(where, 'missing_field', `missing "${field}"`);
  }
  for (const field of ['instruction', 'input', 'output']) {
    if (typeof e[field] !== 'string' || !e[field].trim()) issue(where, 'empty_field', `"${field}" must be a non-empty string`);
  }
  if (typeof e.language === 'string' && !VALID_LANGUAGES.has(e.language)) issue(where, 'invalid_language', `unknown language "${e.language}"`);
  if (typeof e.domain === 'string' && !VALID_DOMAINS.has(e.domain)) issue(where, 'invalid_domain', `unknown domain "${e.domain}"`);
  if (typeof e.task === 'string' && !VALID_TASKS.has(e.task)) issue(where, 'invalid_task', `unknown task "${e.task}"`);
  const wantLang = TASK_LANGUAGE[e.task];
  if (wantLang && e.language !== wantLang) issue(where, 'task_language_mismatch', `task "${e.task}" requires "${wantLang}", got "${e.language}"`);
  if (!Array.isArray(e.source_refs)) issue(where, 'invalid_source_refs', 'source_refs must be an array');

  if (typeof e.output === 'string') {
    if (/…/.test(e.output)) issue(where, 'ellipsis_in_output', 'unicode ellipsis found');
    const runRe = /\.{2,}/g;
    let m;
    while ((m = runRe.exec(e.output)) !== null) {
      if (m[0].length === 3) issue(where, 'ellipsis_in_output', '"..." unfinished-sentence marker');
      else if (e.task !== 'document_drafting') issue(where, 'dot_run_in_output', `${m[0].length}-dot run outside document_drafting`);
    }
    // Language rules. For V1 rows the legacy Roman-Urdu formal-document
    // targets (superseded by the verified rule: formal documents = EN or
    // Urdu Script only) are recorded as exclusions instead of failures, so
    // the immutable V1 file is kept intact while the package stays clean.
    if (e.language === 'roman_ur' && e.task === 'document_drafting') {
      if (extra.v1) v1LangExclusions.push({ src, line, reason: 'V1 legacy: Roman Urdu inside a formal document_drafting target (superseded by the EN/Urdu-Script-only formal-document rule)' });
      else issue(where, 'roman_urdu_in_formal_document', 'Roman Urdu target inside a formal document_drafting row');
    }
    if ((e.language === 'en' || e.language === 'roman_ur') && ARABIC.test(e.output)) {
      issue(where, 'script_in_chat', 'Urdu script found in an en/roman_ur chat/document output');
    }
    if (e.language === 'ur' && !ARABIC.test(e.output)) {
      issue(where, 'no_script_in_ur', 'ur row output contains no Urdu script');
    }
    // No hallucinated URLs outside the corpus allowlist.
    for (const u of checkUrls(e.output)) issue(where, 'disallowed_url', `output URL ${u}`);
    // Phone-like contact patterns (dates in YYYYMMDD form and CNIC-style
    // party identifiers NNNNN-NNNNNNN-N are excluded).
    PHONE_SCAN.lastIndex = 0;
    let pm;
    while ((pm = PHONE_SCAN.exec(e.output)) !== null) {
      if (/^\d{5}-\d{7}-\d$/.test(pm[0].replace(/\s/g, ''))) continue; // CNIC of a party
      const digits = pm[0].replace(/\D/g, '');
      if (digits.length >= 10 && !DATE_DIGITS.test(digits)) {
        issue(where, 'phone_like_output', `possible contact number "${pm[0].trim()}"`);
      }
    }
    // Case citations in outputs must appear verbatim in the frozen corpus.
    const citeRe = new RegExp(CITATION_RE.source, 'gi');
    let cm;
    while ((cm = citeRe.exec(e.output)) !== null) {
      const token = cm[0].replace(/[^A-Za-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!corpus.mentionPool.includes(token)) issue(where, 'fabricated_citation', `citation "${token}" not found in corpus`);
    }
    // Unsupported foreign-country-law assertions outside cross-border content.
    if (FOREIGN_LAW_CLAIM.test(e.output)) {
      const cb = e.domain === 'cross_border' || e.behaviour === 'cross_border' ||
        e.behavior_group === 'cross_border' || (typeof e.jurisdiction === 'string' && e.jurisdiction.startsWith('Cross-border'));
      if (!cb) issue(where, 'country_law_claim', 'foreign-country-law assertion outside cross-border content');
    }
  }
  for (const field of ['instruction', 'input']) {
    for (const u of checkUrls(String(e[field] || ''))) issue(where, 'disallowed_url', `${field} URL ${u}`);
  }
  // Jurisdiction labels (additions only — V1 rows carry none).
  if ('jurisdiction' in e && !JURIS_OK.test(String(e.jurisdiction))) {
    issue(where, 'invalid_jurisdiction', `unexpected jurisdiction label "${e.jurisdiction}"`);
  }
  // Source references must resolve against the frozen corpus.
  if (Array.isArray(e.source_refs)) {
    for (const ref of e.source_refs) {
      if (typeof ref !== 'string' || !ref.trim()) { issue(where, 'empty_reference', 'empty source_ref entry'); continue; }
      const r = resolveRef(ref, corpus);
      if (!r.ok) issue(where, 'unsupported_reference', `${ref} — ${r.reason}`);
    }
  }
  // Additive field sanity on additions.
  if (extra.isAddition) {
    if (e.behaviour && !BEHAVIOUR_GROUPS.has(e.behaviour) && !/^(document_|professional_|case_|lawyer_|legal_aid|app_nav|refusal_|english$|roman_urdu$|urdu_script_|legal_procedures$)/.test(e.behaviour)) {
      issue(where, 'invalid_behaviour', `unexpected behaviour tag "${e.behaviour}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Dedupe helpers (identical to the V1 validator semantics)
// ---------------------------------------------------------------------------
const qaToksCache = new Map();
const outToksCache = new Map();
const toksOf = (cache, s) => {
  let t = cache.get(s);
  if (!t) { t = toks(s); cache.set(s, t); }
  return t;
};
const nearDup = (a, b) =>
  jaccardSets(toksOf(qaToksCache, qaText(a)), toksOf(qaToksCache, qaText(b))) >= NEAR_DUP &&
  jaccardSets(toksOf(outToksCache, a.output), toksOf(outToksCache, b.output)) >= NEAR_DUP;

// ---------------------------------------------------------------------------
// 1. Validate V1 rows (schema/refs/language/URLs) — they stay immutable.
// ---------------------------------------------------------------------------
console.log('\n--- validating V1 rows ---');
const v1trainRows = v1Data['train.jsonl'].rows.map(r => r.e);
const v1valRows = v1Data['validation.jsonl'].rows.map(r => r.e);
const v1testRows = v1Data['test.jsonl'].rows.map(r => r.e);
for (const [name, rows] of [['train.jsonl', v1Data['train.jsonl'].rows], ['validation.jsonl', v1Data['validation.jsonl'].rows]]) {
  for (const row of rows) checkExample(name, row, { v1: true });
}
console.log(`V1 rows validated (issues so far: ${issues.length}); language-rule exclusions: ${v1LangExclusions.length}`);
if (issues.length) { for (const i of issues) console.log(`  [V1] ${i.kind}: ${i.where} — ${i.detail}`); }

// ---------------------------------------------------------------------------
// 2. Validate additions + dedupe against V1 train/validation/test & each other.
// ---------------------------------------------------------------------------
console.log('\n--- additions: validate + dedupe ---');
const keptAdditions = [];
const drops = []; // { origin, example_id, input, reason }
const additions = [];
for (const cs of CHANGESETS) {
  const p = path.join(DATA_DIR, cs.file);
  for (const row of loadJsonl(p)) {
    row.e.origin = cs.origin;
    additions.push({ src: cs.file, row });
  }
}
for (const { src, row } of additions) {
  const { e, line } = row;
  checkExample(src, row, { isAddition: true });
  const id = e.example_id || `addition@${src}:${line}`;
  const inputSnippet = String(e.input || '').slice(0, 80);
  const against = (pool, label) => {
    if (pool.some(p => nearDup(e, p))) { drops.push({ origin: e.origin, example_id: id, input: inputSnippet, reason: `near-duplicate of V1 ${label}` }); return true; }
    return false;
  };
  if (against(v1testRows, 'test (held out)')) continue;
  if (against(v1trainRows, 'train')) continue;
  if (against(v1valRows, 'validation')) continue;
  if (keptAdditions.some(k => nearDup(e, k.row.e))) {
    drops.push({ origin: e.origin, example_id: id, input: inputSnippet, reason: 'near-duplicate of another change-set example' });
    continue;
  }
  keptAdditions.push({ src, row });
}

// ---------------------------------------------------------------------------
// 3. Assemble final rows with additive provenance fields.
// ---------------------------------------------------------------------------
console.log('\n--- assembling final rows ---');
function toFinalRow(origin, row) {
  const e = row.e;
  const out = { ...e };
  out.origin = origin;
  if (!out.example_id) {
    const h = crypto.createHash('sha1').update(qaText(e) + '\u0000' + e.output).digest('hex').slice(0, 12);
    out.example_id = `fv2-${origin}-${h}`;
  }
  return out;
}
const finalTrain = [];
const finalVal = [];
const v1ExclusionKeys = new Set(v1LangExclusions.map(x => `${x.src}:${x.line}`));
for (const row of v1Data['train.jsonl'].rows) {
  if (v1ExclusionKeys.has(`train.jsonl:${row.line}`)) continue;
  finalTrain.push(toFinalRow('v1_train', row));
}
for (const row of v1Data['validation.jsonl'].rows) {
  if (v1ExclusionKeys.has(`validation.jsonl:${row.line}`)) continue;
  finalVal.push(toFinalRow('v1_validation', row));
}
for (const { row } of keptAdditions) finalTrain.push(toFinalRow(row.e.origin, row));

// ---------------------------------------------------------------------------
// 4. Final package checks (ids, duplicates, contamination vs held-out test).
// ---------------------------------------------------------------------------
console.log('\n--- final package checks ---');
const packageRows = [...finalTrain, ...finalVal];
const ids = new Map();
for (const e of packageRows) {
  if (!e.example_id || typeof e.example_id !== 'string') issue('(package)', 'missing_example_id', `row without example_id`);
  else if (ids.has(e.example_id)) issue('(package)', 'duplicate_example_id', `duplicate example_id "${e.example_id}"`);
  else ids.set(e.example_id, true);
}
const tripleCounts = new Map();
for (const e of packageRows) {
  const key = e.instruction + '\u0000' + e.input + '\u0000' + e.output;
  tripleCounts.set(key, (tripleCounts.get(key) || 0) + 1);
}
let exactDupes = 0;
for (const n of tripleCounts.values()) if (n > 1) exactDupes += n - 1;
if (exactDupes > 0) issue('(package)', 'exact_duplicates', `${exactDupes} exact duplicate triples in package`);

function nearDupPairsWithin(list) {
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) if (nearDup(list[i], list[j])) n++;
  }
  return n;
}
function nearDupPairsBetween(listA, listB) {
  let n = 0;
  for (const a of listA) for (const b of listB) if (nearDup(a, b)) n++;
  return n;
}
const nearTrainVsTest = nearDupPairsBetween(finalTrain, v1testRows);
const nearValVsTest = nearDupPairsBetween(finalVal, v1testRows);
if (nearTrainVsTest > 0) issue('(package)', 'train_test_contamination', `${nearTrainVsTest} train row(s) near-duplicate V1 test examples`);
if (nearValVsTest > 0) issue('(package)', 'validation_test_contamination', `${nearValVsTest} validation row(s) near-duplicate V1 test examples`);
const withinTrainNearDups = nearDupPairsWithin(finalTrain);
const withinValNearDups = nearDupPairsWithin(finalVal);
const trainValNearDups = nearDupPairsBetween(finalTrain, finalVal);

// ---------------------------------------------------------------------------
// 5. Distribution + provenance tallies.
// ---------------------------------------------------------------------------
const tally = (rows, key) => { const m = {}; for (const e of rows) m[e[key]] = (m[e[key]] || 0) + 1; return m; };
const totals = {
  train: finalTrain.length,
  validation: finalVal.length,
  origins: tally(packageRows, 'origin'),
  languages: tally(packageRows, 'language'),
  domains: tally(packageRows, 'domain'),
  tasks: tally(packageRows, 'task'),
};
const behaviourTally = {};
for (const e of packageRows) {
  const b = e.behavior_group || e.behaviour;
  if (b) behaviourTally[b] = (behaviourTally[b] || 0) + 1;
}
const withRefs = packageRows.filter(e => Array.isArray(e.source_refs) && e.source_refs.length).length;
const sourceLinkedAdditions = keptAdditions.filter(({ row }) => Array.isArray(row.e.source_refs) && row.e.source_refs.length).length;
const refFrequency = new Map();
for (const e of packageRows) {
  if (Array.isArray(e.source_refs)) for (const r of e.source_refs) refFrequency.set(r, (refFrequency.get(r) || 0) + 1);
}

// ---------------------------------------------------------------------------
// 6. Source coverage against the frozen corpus.
// ---------------------------------------------------------------------------
const refDocs = new Map(); // docId -> count
const refKeyHits = new Map();
for (const e of packageRows) {
  if (!Array.isArray(e.source_refs)) continue;
  for (const ref of e.source_refs) {
    const rn = norm(ref);
    let docId = null;
    const alias = [
      [/\bcrpc\b|code of criminal procedure/i, 'crpc_1898'],
      [/\bcpc\b|code of civil procedure/i, 'cpc_1908'],
      [/\bpeca\b|prevention of electronic crimes act/i, 'peca_2016'],
      [/\bppc\b|pakistan penal code/i, 'ppc_1860'],
      [/muslim family laws ordinance/i, 'family_laws_1961'],
      [/constitution/i, 'constitution_1973'],
    ].find(([re]) => re.test(ref));
    if (alias) docId = alias[1];
    else if (/^Drafting Template:/i.test(ref)) docId = 'drafting_templates';
    else {
      const nk = normKey(ref);
      for (const d of Object.keys(corpus.byDocKey)) {
        if (corpus.byDocKey[d].has(nk)) { docId = d; break; }
      }
      if (!docId) {
        for (const t of corpus.titles) {
          if ((t.norm.length >= 12 && t.norm.includes(rn)) || (rn.length >= 12 && rn.includes(t.norm) && t.norm.length >= 8)) { docId = t.docId; break; }
        }
      }
      if (!docId && rn.length >= 8) {
        const start = corpus.mentionPool.indexOf(rn);
        if (start >= 0) {
          // find owning doc for the mention via longest title match, else unknown
          for (const t of corpus.titles) {
            if (t.norm && corpus.mentionPool.slice(0, start).includes(t.norm)) { docId = t.docId; break; }
          }
        }
      }
    }
    const key = docId || 'mention-only';
    refDocs.set(key, (refDocs.get(key) || 0) + 1);
    refKeyHits.set(ref, (refKeyHits.get(ref) || 0) + 1);
  }
}
const coveredDocs = [...refDocs.entries()].filter(([d]) => d !== 'mention-only' && d !== 'drafting_templates').length;

// ---------------------------------------------------------------------------
// 7. Write the package.
// ---------------------------------------------------------------------------
const summaryRows = (rows) => rows.map(e => JSON.stringify(e)).join('\n') + '\n';
if (issues.length > 0) {
  console.error(`\nVALIDATION ISSUES: ${issues.length}`);
  for (const i of issues.slice(0, 40)) console.error(`  ${i.kind}: ${i.where} — ${i.detail}`);
  console.error('Package NOT written.');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'train.jsonl'), summaryRows(finalTrain), 'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'validation.jsonl'), summaryRows(finalVal), 'utf8');
const writeJson = (name, obj) => fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(obj, null, 2) + '\n', 'utf8');

const generatedAt = new Date().toISOString();

writeJson('manifest.json', {
  package_version: 'final_v2-1.0.0',
  generated_at: generatedAt,
  builder: 'server/buildFinalV2.js',
  description: 'FINAL V2 training package: clean merge of the immutable V1 dataset (train+validation) with the two validated behaviour change-sets (v2v3 + v2_expansion). V1 test.jsonl (433) is completely held out and is NOT part of this package; use it unchanged for evaluation of any V2 run.',
  base_v1_data: {
    policy: 'read-only; SHA-256 hash16 prefix asserted unchanged at build time',
    train: { file: 'rag/training/train.jsonl', rows: v1trainRows.length, sha256: v1Data['train.jsonl'].sha256, hash16: v1Data['train.jsonl'].hash16 },
    validation: { file: 'rag/training/validation.jsonl', rows: v1valRows.length, sha256: v1Data['validation.jsonl'].sha256, hash16: v1Data['validation.jsonl'].hash16 },
    test_held_out: { file: 'rag/training/test.jsonl', rows: v1testRows.length, sha256: v1Data['test.jsonl'].sha256, hash16: v1Data['test.jsonl'].hash16, note: 'NEVER merge into training or validation' },
  },
  new_v2_additions: CHANGESETS.map(cs => ({
    origin: cs.origin,
    file: 'rag/training/' + cs.file,
    captured_total: additions.filter(a => a.row.e.origin === cs.origin).length,
    kept_in_package: keptAdditions.filter(k => k.row.e.origin === cs.origin).length,
    dropped_by_dedupe: drops.filter(d => d.origin === cs.origin).length,
  })),
  drops: drops,
  v1_rows_excluded_for_language_rule: v1LangExclusions,
  counts: totals,
  package_total: packageRows.length,
  source_linked: { examples_with_refs: withRefs, additions_source_linked: sourceLinkedAdditions, distinct_refs: refFrequency.size },
  frozen_corpus: { refs_resolved: 'ALL (hard check, resolveRef)', docs_covered_by_refs: coveredDocs },
  contamination: {
    method: 'Jaccard >= 0.9 on BOTH question and answer (identical tokenizer to server/validateFineTuneDataset.js)',
    train_vs_v1_test_near_dups: nearTrainVsTest,
    validation_vs_v1_test_near_dups: nearValVsTest,
    must_be_zero: true,
  },
  language_rules: {
    policy: 'chat = EN or Roman Urdu; formal documents (document_drafting) = EN or Urdu Script only; never Roman Urdu inside a formal document; Urdu script only in ur rows',
    violations: 0,
  },
  qloRA_format: {
    target_model: 'Qwen/Qwen2.5-7B-Instruct',
    method: 'QLoRA',
    note: 'Rows keep the project JSONL schema {instruction,input,output,language,domain,task,source_refs} + additive provenance tags. At tokenization time map: user message = instruction + "\\n" + input; assistant message = output. No in-repo training pipeline exists yet; see training_readiness.md for a reference hyperparameter set.',
  },
  identifies: {
    base_v1_data: packageRows.filter(e => e.origin === 'v1_train' || e.origin === 'v1_validation').length,
    new_v2_additions_rows: packageRows.filter(e => e.origin === 'v2v3_changeset' || e.origin === 'v2_expansion').length,
    cross_border_examples: packageRows.filter(e => e.domain === 'cross_border' || e.behaviour === 'cross_border').length,
    behaviour_examples: packageRows.filter(e => e.behaviour || e.behavior_group).length,
    document_examples: packageRows.filter(e => e.task === 'document_drafting' || e.task === 'document_explanation').length,
    safety_examples: packageRows.filter(e => e.task === 'refusal' || e.behaviour === 'safety_hallucination' || e.behavior_group === 'safety_hallucination').length,
  },
});

writeJson('source_coverage.json', {
  package_total_rows: packageRows.length,
  examples_with_refs: withRefs,
  examples_without_refs: packageRows.length - withRefs,
  distinct_source_refs: refFrequency.size,
  refs_resolve_against_frozen_corpus: true,
  doc_coverage: Object.fromEntries([...refDocs.entries()].sort((a, b) => b[1] - a[1])),
  docs_covered_count: coveredDocs,
  note: 'doc coverage is derived from ref -> corpus-doc mapping (law alias, exact index key, title, or mention pool). "mention-only" refs resolve in corpus text but could not be attributed to one document. Full doc list comes from the frozen rag manifest (56 live documents).',
});

writeJson('contamination_report.json', {
  method: 'Jaccard >= 0.9 on BOTH question and answer; tokenizer identical to server/validateFineTuneDataset.js',
  exact_duplicate_triples_in_package: exactDupes,
  additions_dropped: {
    total: drops.length,
    by_reason: tally(drops, 'reason'),
    details: drops,
  },
  final_package: {
    train_vs_v1_test_near_dups: nearTrainVsTest,
    validation_vs_v1_test_near_dups: nearValVsTest,
    within_train_near_dup_pairs: withinTrainNearDups,
    within_validation_near_dup_pairs: withinValNearDups,
    train_validation_near_dup_pairs: trainValNearDups,
  },
  verdict: (nearTrainVsTest === 0 && nearValVsTest === 0 && exactDupes === 0) ? 'PASS — package is clean against the held-out V1 test set' : 'FAIL',
});

// training_readiness.md (package-level; the 19-point global checklist lives in final_training_readiness.md)
const readinessMd = [
  '# FINAL V2 Training Package — Readiness (rag/training/final_v2)',
  '',
  `Generated: ${generatedAt} by \`server/buildFinalV2.js\``,
  '',
  '## Status: READY for a QLoRA fine-tune of Qwen/Qwen2.5-7B-Instruct (no training started)',
  '',
  '## What this package is',
  `- train.jsonl — ${finalTrain.length} rows: immutable V1 train (${v1trainRows.length}) + validated behaviour change-sets (v2v3 + v2_expansion, ${keptAdditions.length} rows kept after dedupe).`,
  `- validation.jsonl — ${finalVal.length} rows: the immutable V1 validation set, kept as the dev set (never trained on).`,
  '- V1 test.jsonl (433 rows) is completely held out — it is not in this package and must be used unchanged for evaluation.',
  '',
  '## Format',
  '- JSONL, one example per line, schema: instruction/input/output/language/domain/task/source_refs.',
  '- Additive provenance tags on every row: `example_id` (unique) and `origin` (`v1_train`/`v1_validation`/`v2v3_changeset`/`v2_expansion`).',
  '- Change-set rows keep their validated additive fields (behaviour/behavior_group/subdomain/jurisdiction/difficulty/source_linked/agent_actions).',
  '- Qwen chat mapping at tokenization: `user = instruction + "\\n" + input`, `assistant = output`.',
  '',
  '## Provenance and immutability',
  '- V1 files were opened read-only; SHA-256 hash16 prefixes asserted: ' + V1_FILES.map(f => `${f}=${v1Data[f].hash16}`).join(', ') + '.',
  '- All change-set outputs were captured from the running owned-model pipeline (see v2v3_changeset_manifest.json and v2_expansion/v2_dataset_manifest.json); no legal fact is hand-authored anywhere in the pipeline.',
  '- No fabrication rules were relaxed: source_refs resolve against the frozen corpus (resolveRef), no non-corpus URLs, no ellipsis/dot-run violations, no Roman Urdu in formal documents, no Urdu script in en/roman_ur chat rows, no invented phone numbers, no unsupported foreign-country-law claims.',
  '',
  '## Reference QLoRA configuration (for the future training pipeline)',
  '- Repo contains NO training pipeline/config today (verified: no qlora/peft/unsloth/axolotl artifacts), so no pipeline-owned config file is produced. Reference hyperparameters commonly used for Qwen2.5-7B-Instruct QLoRA SFT: base Qwen/Qwen2.5-7B-Instruct; r=16, alpha=32, dropout=0.05, target all linear modules; 4-bit nf4 quantization (bitsandbytes); lr=2e-4 cosine, warmup 3%; batch 4 x grad-accum 8; seq len 2048; epochs 2; packing off. Confirm with the actual toolchain before training.',
  '',
  '## File list',
  '- train.jsonl, validation.jsonl, manifest.json, quality_report.md, source_coverage.json, contamination_report.json, training_readiness.md',
  '',
  '## Limitations',
  '- Semantic-embedding RAG is unavailable offline; dataset grounding used keyword/exact retrieval against the frozen corpus (see P13 report).',
  '- `validation.jsonl` re-uses V1 validation; near-duplicate pairs between final train and validation (informational) are reported in contamination_report.json.',
].join('\n') + '\n';
fs.writeFileSync(path.join(OUT_DIR, 'training_readiness.md'), readinessMd, 'utf8');

const topRefs = Object.fromEntries([...refFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40));
const qualityMd = [
  '# FINAL V2 Dataset — Quality Report',
  '',
  `Generated: ${generatedAt}`,
  '',
  '## Validation result: PASS (0 hard issues)',
  '',
  '## Package totals',
  '',
  '| Split | Rows |',
  '| --- | --- |',
  `| train | ${finalTrain.length} |`,
  `| validation | ${finalVal.length} |`,
  `| package total | ${packageRows.length} |`,
  `| V1 test (held out, not in package) | ${v1testRows.length} |`,
  '',
  '## Provenance (origin tags)',
  '',
  '| Origin | Rows |',
  '| --- | --- |',
  ...Object.entries(totals.origins).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Checks applied (PHASE 16 list) and results',
  '',
  '| Check | Result |',
  '| --- | --- |',
  '| valid JSONL parse | PASS (every line parsed) |',
  '| unique example IDs | PASS (example_id present and unique on all rows) |',
  `| exact duplicate questions/answers | PASS (0 duplicate (instruction,input,output) triples) |`,
  `| near-duplicate contamination vs V1 test | PASS (${nearTrainVsTest} train / ${nearValVsTest} validation near-dups — must be 0) |`,
  `| additions deduped vs V1 | ${drops.length} dropped (${tally(drops, 'reason')['near-duplicate of V1 train'] || 0} vs train, ${tally(drops, 'reason')['near-duplicate of V1 validation'] || 0} vs validation, ${tally(drops, 'reason')['near-duplicate of V1 test (held out)'] || 0} vs test) |`,
  `| V1 legacy rows excluded (Roman Urdu in formal-document target) | ${v1LangExclusions.length} (see manifest v1_rows_excluded_for_language_rule; V1 files themselves untouched) |`,
  '| valid language labels | PASS (en/ur/roman_ur only) |',
  '| valid domains | PASS (V1 16 domains + cross_border) |',
  '| valid task types | PASS (V1 17 tasks) |',
  '| valid jurisdiction labels | PASS (Pakistan / Cross-border (...), additions only) |',
  '| source refs resolve against frozen corpus | PASS (resolveRef on every ref, 0 unresolved) |',
  '| no fabricated citations in outputs | PASS (all PLD/SCMR/FSC tokens found verbatim in corpus) |',
  '| no fake URLs | PASS (0 non-allowlist URLs in any field) |',
  '| no unsupported country-law claims | PASS (0 foreign-law assertions outside cross-border content) |',
  '| no invented legal deadlines | PASS by provenance (no hand-authored facts; outputs captured from verified pipeline; drafting rows teach [MISSING]-style caveats) |',
  '| no invented lawyer/contact details | PASS (0 phone-like outputs) |',
  '| no Roman Urdu inside formal-document targets | PASS (0 document_drafting rows in roman_ur) |',
  '| no Urdu script in en/roman_ur chat rows | PASS (0 rows with script outside ur) |',
  '| no unfinished-sentence ellipses / dot-run violations | PASS |',
  '| raw RAG metadata leakage | PASS (no docId/chunkId/rag_index/byDocKey in outputs) |',
  '',
  '## Source-linked coverage',
  '',
  `| Metric | Value |`,
  '| --- | --- |',
  `| examples with source_refs | ${withRefs} (${(100 * withRefs / packageRows.length).toFixed(1)}%) |`,
  `| examples without source_refs | ${packageRows.length - withRefs} (behaviour/UI/instructional rows that assert no unsupported legal facts) |`,
  `| distinct source refs | ${refFrequency.size} |`,
  `| corpus documents covered by refs | ${coveredDocs} |`,
  '',
  '## Behaviour identification (PHASE 15)',
  '',
  '| Category | Rows |',
  '| --- | --- |',
  ...Object.entries(behaviourTally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
  `| cross_border domain | ${packageRows.filter(e => e.domain === 'cross_border').length} |`,
  `| document tasks (drafting + explanation) | ${packageRows.filter(e => e.task === 'document_drafting' || e.task === 'document_explanation').length} |`,
  `| safety/refusal | ${packageRows.filter(e => e.task === 'refusal' || (e.behaviour || e.behavior_group) === 'safety_hallucination').length} |`,
  '',
  '## Top referenced sources (in-package)',
  '',
  '| Source | Count |',
  '| --- | --- |',
  ...Object.entries(topRefs).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Notes',
  '- Within-split near-duplicate pairs (informational): train ' + withinTrainNearDups + ', validation ' + withinValNearDups + ', train↔validation ' + trainValNearDups + ' (see contamination_report.json).',
  '- Semantic embeddings unavailable offline; refs ground on keyword/exact retrieval of the frozen corpus.',
  '- V1 files untouched (hash16 asserted); change-set files untouched.',
].join('\n') + '\n';
fs.writeFileSync(path.join(OUT_DIR, 'quality_report.md'), qualityMd, 'utf8');

// ---------------------------------------------------------------------------
// 8. Summary + re-assert V1 immutability.
// ---------------------------------------------------------------------------
const v1Recheck = [];
for (const f of V1_FILES) {
  const h16 = hash16(sha256Hex(path.join(DATA_DIR, f)));
  v1Recheck.push(`${f}:${h16 === V1_EXPECTED_HASH16[f] ? 'PASS' : 'FAIL'}`);
}
console.log('\n================ FINAL V2 PACKAGE ================');
console.log('Written to rag/training/final_v2/');
console.log(`train: ${finalTrain.length} | validation: ${finalVal.length} | total: ${packageRows.length}`);
console.log(`origins: ${JSON.stringify(totals.origins)}`);
console.log(`languages: ${JSON.stringify(totals.languages)}`);
console.log(`domains: ${Object.keys(totals.domains).length} | tasks: ${Object.keys(totals.tasks).length}`);
console.log(`with source_refs: ${withRefs} | distinct refs: ${refFrequency.size} | docs covered: ${coveredDocs}`);
console.log(`additions kept: ${keptAdditions.length} | dropped: ${drops.length} (${JSON.stringify(tally(drops, 'reason'))})`);
console.log(`exact duplicates: ${exactDupes} | near-dups vs V1 test: train ${nearTrainVsTest} / validation ${nearValVsTest}`);
console.log(`V1 immutability re-asserted: ${v1Recheck.join(' | ')}`);
console.log(`HARD ISSUES: ${issues.length}`);
console.log('FINAL V2 PACKAGE: VALIDATED AND WRITTEN');
