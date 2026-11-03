// ============================================================================
// INSAaf AI — FINAL V3 PACKAGE VALIDATOR (spec part 28, dataset layer)
// ----------------------------------------------------------------------------
// Independent, read-only re-validation of the FINAL training package
// rag/training/final_v3/* plus the frozen-corpus lock:
//
//   1. V1 immutability (train/validation/test hash16 prefixes asserted)
//   2. final_v3/test.jsonl byte-identical to the V1 held-out test.jsonl
//   3. every train/validation row hard-checked: schema, enums (20 domains,
//      17 tasks, 4 provenance classes), task-language map, script rules,
//      URL allowlist, phone-like patterns, fabricated-citation scan,
//      foreign-law claims, jurisdiction labels, source_refs resolution
//   4. provenance policy per origin (spec part 26)
//   5. exact-duplicate triples + near-duplicate contamination vs the
//      held-out test copy (must be 0)
//   6. package manifest cross-check (counts/provenance/origins consistent)
//   7. corpus freeze re-assertion: recompute every locked file's sha256 and
//      compare against final_corpus_freeze.json freeze_hash
//
//   node server/validateFinalV3.js   (exit 0 = PASS, 1 = FAIL)
// ============================================================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { loadCorpus, resolveRef, checkUrls } from './fineTuneData/refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.resolve(ROOT, p);
const DATA_DIR = R('rag/training');
const PKG = path.join(DATA_DIR, 'final_v3');
const FROZEN_DIR = R('rag/corpus_expansion');

const V1_EXPECTED_HASH16 = {
  'train.jsonl': '9F830BE9F2F5D34D',
  'validation.jsonl': '28594BEEDAFC340F',
  'test.jsonl': 'E59E24F9DEE0B525',
};

// Enum sets MUST stay identical to server/generateV3Expansion.js and
// server/buildFinalV3.js.
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
const V2_ORIGINS = new Set(['v2v3_changeset', 'v2_expansion']);
const V1_ORIGINS = new Set(['v1_train', 'v1_validation']);
const NEAR_DUP = 0.9;

const ARABIC = /[\u0600-\u06FF]/;
const CITATION_RE = /((?:PLD|SCMR|FSC)\s+\d{4}(?:\s+(?:SC|FSC|\d{1,4}))?)|(\d{4}\s+SCMR\s+\d{1,4})/i;
const PHONE_SCAN = /\d[\d\s().-]{7,}\d/g;
const DATE_DIGITS = /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/;
const FOREIGN_LAW_CLAIM = /(?:under|according to|governed by|as per|per)\s+(?:the\s+)?(?:saudi|uae|emirati|dubai|qatari|omani|kuwaiti|bahraini|american|\bus\b|u\.s|uk|british|english|canadian|australian|german|french|italian|spanish|dutch|chinese|japanese|turkish|european|gulf)\s+(?:law|court|labou?r law|employment law|immigration law)/i;
const JURIS_OK = /^(?:Pakistan|Pakistan \(.*\)|Cross-border \(.*\))$/;

const toks = (s) => new Set(String(s).toLowerCase().split(/[^a-z0-9\u0600-\u06FF]+/).filter((t) => t.length > 1 || /[0-9\u0600-\u06FF]/.test(t)));
function jaccardSets(a, b) { let inter = 0; for (const t of a) if (b.has(t)) inter++; const u = a.size + b.size - inter; return u === 0 ? 0 : inter / u; }
const qaText = (e) => e.instruction + ' ' + e.input;

const sha256Hex = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hash16 = (h) => h.slice(0, 16).toUpperCase();
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const loadJsonl = (p) => fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l, i) => ({ e: JSON.parse(l), line: i + 1 }));

const failures = [];
const ok = (msg) => console.log('  PASS  ' + msg);
const fail = (msg) => { failures.push(msg); console.log('  FAIL  ' + msg); };

console.log('=== FINAL V3 PACKAGE VALIDATION ===');

// ---------------------------------------------------------------------------
// 1. V1 immutability
// ---------------------------------------------------------------------------
console.log('\n[1] V1 immutability');
for (const f of Object.keys(V1_EXPECTED_HASH16)) {
  const h = hash16(sha256Hex(path.join(DATA_DIR, f)));
  if (h === V1_EXPECTED_HASH16[f]) ok(`${f} hash16 ${h}`);
  else fail(`${f} hash16 ${h} != expected ${V1_EXPECTED_HASH16[f]}`);
}

// ---------------------------------------------------------------------------
// 2. test copy identity
// ---------------------------------------------------------------------------
console.log('\n[2] held-out test copy');
const t1 = sha256Hex(path.join(DATA_DIR, 'test.jsonl'));
const t2 = sha256Hex(path.join(PKG, 'test.jsonl'));
if (t1 === t2) ok('final_v3/test.jsonl byte-identical to V1 test.jsonl (hash16 ' + hash16(t2) + ')');
else fail('final_v3/test.jsonl differs from V1 test.jsonl');
const pkgTest = loadJsonl(path.join(PKG, 'test.jsonl'));
if (pkgTest.length === 433) ok(`test copy rows ${pkgTest.length}`);
else fail(`test copy rows ${pkgTest.length} != 433`);

// ---------------------------------------------------------------------------
// 3. Row-level hard checks on the package train + validation
// ---------------------------------------------------------------------------
console.log('\n[3] row-level hard checks (train + validation)');
const corpus = loadCorpus();
const trainRows = loadJsonl(path.join(PKG, 'train.jsonl')).map((r) => ({ ...r, split: 'train' }));
const valRows = loadJsonl(path.join(PKG, 'validation.jsonl')).map((r) => ({ ...r, split: 'validation' }));
const allRows = [...trainRows, ...valRows];
const rowCheck = [];
const ids = new Map();
const tripleCounts = new Map();
for (const { e, line, split } of allRows) {
  const where = `${split}:${line}`;
  for (const f of ['instruction', 'input', 'output', 'language', 'domain', 'task', 'source_refs', 'example_id', 'origin', 'provenance']) {
    if (!(f in e)) rowCheck.push(`${where}: missing "${f}"`);
  }
  for (const f of ['instruction', 'input', 'output']) {
    if (typeof e[f] !== 'string' || !e[f].trim()) rowCheck.push(`${where}: empty "${f}"`);
  }
  if (!VALID_LANGUAGES.has(e.language)) rowCheck.push(`${where}: invalid language "${e.language}"`);
  if (!VALID_DOMAINS.has(e.domain)) rowCheck.push(`${where}: invalid domain "${e.domain}"`);
  if (!VALID_TASKS.has(e.task)) rowCheck.push(`${where}: invalid task "${e.task}"`);
  const wantLang = TASK_LANGUAGE[e.task];
  if (wantLang && e.language !== wantLang) rowCheck.push(`${where}: task/language mismatch`);
  if (!PROVENANCES.has(e.provenance)) rowCheck.push(`${where}: invalid provenance "${e.provenance}"`);
  if (!Array.isArray(e.source_refs)) rowCheck.push(`${where}: source_refs not an array`);
  if (typeof e.example_id !== 'string' || !e.example_id) rowCheck.push(`${where}: missing example_id`);
  else if (ids.has(e.example_id)) rowCheck.push(`${where}: duplicate example_id "${e.example_id}"`);
  else ids.set(e.example_id, true);
  const key = e.instruction + '\u0000' + e.input + '\u0000' + e.output;
  tripleCounts.set(key, (tripleCounts.get(key) || 0) + 1);

  if (typeof e.output === 'string') {
    if (/…/.test(e.output)) rowCheck.push(`${where}: unicode ellipsis in output`);
    const runRe = /\.{2,}/g; let m;
    while ((m = runRe.exec(e.output)) !== null) {
      if (m[0].length === 3) rowCheck.push(`${where}: "..." in output`);
      else if (e.task !== 'document_drafting') rowCheck.push(`${where}: ${m[0].length}-dot run outside document_drafting`);
    }
    if (e.language === 'roman_ur' && e.task === 'document_drafting') rowCheck.push(`${where}: Roman Urdu inside formal document_drafting`);
    if ((e.language === 'en' || e.language === 'roman_ur') && ARABIC.test(e.output)) rowCheck.push(`${where}: Urdu script in en/roman_ur output`);
    if (e.language === 'ur' && !ARABIC.test(e.output)) rowCheck.push(`${where}: ur output has no Urdu script`);
    for (const u of checkUrls(e.output)) rowCheck.push(`${where}: disallowed output URL ${u}`);
    PHONE_SCAN.lastIndex = 0; let pm;
    while ((pm = PHONE_SCAN.exec(e.output)) !== null) {
      if (/^\d{5}-\d{7}-\d$/.test(pm[0].replace(/\s/g, ''))) continue;
      const digits = pm[0].replace(/\D/g, '');
      if (digits.length >= 10 && !DATE_DIGITS.test(digits)) rowCheck.push(`${where}: phone-like output "${pm[0].trim()}"`);
    }
    const citeRe = new RegExp(CITATION_RE.source, 'gi'); let cm;
    while ((cm = citeRe.exec(e.output)) !== null) {
      const token = cm[0].replace(/[^A-Za-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!corpus.mentionPool.includes(token)) rowCheck.push(`${where}: citation "${token}" not in corpus`);
    }
    if (FOREIGN_LAW_CLAIM.test(e.output)) {
      const cb = e.domain === 'cross_border' || (typeof e.jurisdiction === 'string' && e.jurisdiction.startsWith('Cross-border'));
      if (!cb) rowCheck.push(`${where}: foreign-country-law assertion outside cross-border`);
    }
  }
  if ('jurisdiction' in e && !JURIS_OK.test(String(e.jurisdiction))) rowCheck.push(`${where}: invalid jurisdiction "${e.jurisdiction}"`);
  if (Array.isArray(e.source_refs)) {
    for (const ref of e.source_refs) {
      if (typeof ref !== 'string' || !ref.trim()) { rowCheck.push(`${where}: empty source_ref`); continue; }
      const r = resolveRef(ref, corpus);
      if (!r.ok) rowCheck.push(`${where}: unresolved ref "${ref}" (${r.reason})`);
    }
  }
  for (const f of ['instruction', 'input']) {
    for (const u of checkUrls(String(e[f] || ''))) rowCheck.push(`${where}: disallowed ${f} URL ${u}`);
  }
}
if (rowCheck.length === 0) ok(`${allRows.length} rows passed all hard checks`);
else fail(`${rowCheck.length} row issues:\n      - ` + rowCheck.slice(0, 12).join('\n      - '));
let exactDupes = 0;
for (const n of tripleCounts.values()) if (n > 1) exactDupes += n - 1;
if (exactDupes === 0) ok('0 exact duplicate (instruction,input,output) triples');
else fail(`${exactDupes} exact duplicate triples`);

// ---------------------------------------------------------------------------
// 4. Provenance policy per origin (spec part 26)
// ---------------------------------------------------------------------------
console.log('\n[4] provenance policy per origin');
const provPolicy = [];
const provTally = {};
const originTally = {};
for (const { e } of allRows) {
  originTally[e.origin] = (originTally[e.origin] || 0) + 1;
  provTally[e.provenance] = (provTally[e.provenance] || 0) + 1;
  if (V1_ORIGINS.has(e.origin)) {
    const expect = (Array.isArray(e.source_refs) && e.source_refs.length) ? 'SOURCE_DERIVED' : 'SYNTHETIC_BEHAVIOR';
    if (e.provenance !== expect) provPolicy.push(`${e.origin}: expected ${expect}, got ${e.provenance}`);
  } else if (V2_ORIGINS.has(e.origin)) {
    if (e.provenance !== 'BEHAVIORAL') provPolicy.push(`${e.origin}: expected BEHAVIORAL, got ${e.provenance}`);
  } else if (e.origin === 'v3_expansion') {
    if (!['SOURCE_ORIGINAL', 'SOURCE_DERIVED', 'SYNTHETIC_BEHAVIOR'].includes(e.provenance)) provPolicy.push(`v3_expansion: unexpected provenance ${e.provenance}`);
  } else {
    provPolicy.push(`unknown origin ${e.origin}`);
  }
}
if (provPolicy.length === 0) ok('provenance classes consistent with the documented inheritance policy (' + JSON.stringify(provTally) + ')');
else fail(provPolicy.slice(0, 8).join(' | '));

// ---------------------------------------------------------------------------
// 5. Contamination vs held-out test + within-split near-dups (informational)
// ---------------------------------------------------------------------------
console.log('\n[5] contamination vs held-out test');
const qaToksCache = new Map();
const outToksCache = new Map();
const toksOf = (cache, s) => { let t = cache.get(s); if (!t) { t = toks(s); cache.set(s, t); } return t; };
const nearDup = (a, b) =>
  jaccardSets(toksOf(qaToksCache, qaText(a)), toksOf(qaToksCache, qaText(b))) >= NEAR_DUP &&
  jaccardSets(toksOf(outToksCache, a.output), toksOf(outToksCache, b.output)) >= NEAR_DUP;
let nearTrainVsTest = 0;
let nearValVsTest = 0;
for (const { e: trainE } of trainRows) for (const { e: testE } of pkgTest) if (nearDup(trainE, testE)) nearTrainVsTest++;
for (const { e: valE } of valRows) for (const { e: testE } of pkgTest) if (nearDup(valE, testE)) nearValVsTest++;
if (nearTrainVsTest === 0 && nearValVsTest === 0) ok(`0 near-dups vs held-out test (train ${nearTrainVsTest} / validation ${nearValVsTest})`);
else fail(`near-dups vs held-out test: train ${nearTrainVsTest} / validation ${nearValVsTest} — must be 0`);

// ---------------------------------------------------------------------------
// 6. Package manifest cross-check
// ---------------------------------------------------------------------------
console.log('\n[6] package manifest cross-check');
const pkgManifest = readJson(path.join(PKG, 'manifest.json'));
const mismatches = [];
if (pkgManifest.package_total !== allRows.length) mismatches.push(`package_total ${pkgManifest.package_total} != rows ${allRows.length}`);
if (pkgManifest.counts.train !== trainRows.length) mismatches.push('counts.train mismatch');
if (pkgManifest.counts.validation !== valRows.length) mismatches.push('counts.validation mismatch');
for (const [k, v] of Object.entries(originTally)) if ((pkgManifest.counts.origins || {})[k] !== v) mismatches.push(`origins.${k} mismatch`);
for (const [k, v] of Object.entries(provTally)) if ((pkgManifest.provenance_policy.counts || {})[k] !== v) mismatches.push(`provenance counts.${k} mismatch`);
if (pkgManifest.held_out_test.rows !== pkgTest.length) mismatches.push('held_out_test.rows mismatch');
if (mismatches.length === 0) ok('manifest counts/provenance/origins/held-out consistent with file contents');
else fail(mismatches.join(' | '));

// ---------------------------------------------------------------------------
// 7. Corpus freeze re-assertion (2.4.0-final lock)
// ---------------------------------------------------------------------------
console.log('\n[7] corpus freeze lock (2.4.0-final)');
const freezeLock = readJson(path.join(FROZEN_DIR, 'final_corpus_freeze.json'));
const freezeManifest = readJson(path.join(FROZEN_DIR, 'final_corpus_manifest.json'));
const lockIssues = [];
let locked = 0;
if (freezeLock.corpus_version !== '2.4.0-final') lockIssues.push(`freeze lock version ${freezeLock.corpus_version}`);
for (const f of freezeLock.files || []) {
  const abs = R(f.path);
  if (!fs.existsSync(abs)) { lockIssues.push(`locked file missing: ${f.path}`); continue; }
  const h = sha256Hex(abs);
  if (h !== f.sha256) lockIssues.push(`locked file MUTATED: ${f.path}`);
  else locked++;
}
if (freezeManifest.corpus_version !== '2.4.0-final') lockIssues.push(`freeze manifest version ${freezeManifest.corpus_version}`);
if (lockIssues.length === 0) ok(`all ${locked} frozen files match the lock; corpus_version ${freezeLock.corpus_version}`);
else fail(lockIssues.slice(0, 8).join(' | '));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n=== SUMMARY ===');
console.log('train rows           : ' + trainRows.length);
console.log('validation rows      : ' + valRows.length);
console.log('held-out test rows   : ' + pkgTest.length + ' (copy only, never trained on)');
console.log('origins              : ' + JSON.stringify(originTally));
console.log('provenance           : ' + JSON.stringify(provTally));
console.log('exact dupes          : ' + exactDupes);
console.log('near-dups vs test    : train ' + nearTrainVsTest + ' / validation ' + nearValVsTest);
console.log('HARD FAILURES        : ' + failures.length);
if (failures.length > 0) {
  console.log('FINAL V3 PACKAGE VALIDATION: FAIL');
  process.exit(1);
}
console.log('FINAL V3 PACKAGE VALIDATION: PASS');
process.exit(0);
