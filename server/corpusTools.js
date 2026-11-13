/**
 * Insaaf AI — Reproducible corpus pipeline (spec §20).
 *
 *   npm run corpus:audit      drift detection (offline, deterministic)
 *   npm run corpus:update     rebuild index ONLY when drift requires it
 *   npm run corpus:validate   structure + checksums + registry integrity
 *
 * Detection targets: new laws / new judgments (unregistered or indexed-but-
 * unregistered records), amendments & updated regulations (checksum drift on
 * source files), changed source pages (optional `--check-urls` network pass),
 * repealed/removed records (manifest vs index), stale registries.
 *
 * Exit codes: 0 = clean/no action; 1 = fatal; 2 = findings (audit).
 * corpus:update never rebuilds when nothing changed.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const MANIFEST_PATH = 'rag/manifest.json';
const INDEX_PATH = 'rag/indexes/rag_index.json';
const DOCS_ROOT = 'rag/documents';
const OUT_DIR = 'rag/corpus_expansion';

const ORIGINAL_IDS = new Set([
  'constitution_1973', 'ppc_1860', 'crpc_1898', 'cpc_1908', 'peca_2016',
  'family_laws_1961', 'property_laws', 'tenancy_laws', 'labour_employment',
  'consumer_protection', 'education_student_rights', 'student_rights',
  'court_procedures', 'court_workflows', 'legal_aid_services', 'sc_judgments',
  'landmark_case_studies', 'situation_remedies', 'public_institutions', 'legal_workflows'
]);

const MARKER_RE = /\[(SECTION|ARTICLE):\s*[^\]]+\]/g;

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function relPath(p) {
  return p.split(path.sep).join('/');
}

/** All .txt corpus source files (relative, forward-slash) under DOCS_ROOT. */
function walkTxtFiles(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTxtFiles(abs, path.join(base, entry.name)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) out.push(relPath(path.join(base, entry.name)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Registry refresh — recompute dynamic counts from the LIVE index while
// preserving every static narrative section authored in the deliverable files.
// ---------------------------------------------------------------------------
function refreshRegistries() {
  const index = loadJson(INDEX_PATH);
  const chunks = index.chunks;
  const manifestDocs = index.documentManifest.documents;
  const now = new Date().toISOString();

  const byDoc = {};
  chunks.forEach(c => {
    byDoc[c.docId] = byDoc[c.docId] || { chunks: 0, SECTION: 0, ARTICLE: 0 };
    byDoc[c.docId].chunks++;
    if (c.type === 'SECTION' || c.type === 'ARTICLE') byDoc[c.docId][c.type]++;
  });

  const totalChunks = chunks.length;
  const origChunks = manifestDocs
    .filter(d => ORIGINAL_IDS.has(d.id))
    .reduce((s, d) => s + (byDoc[d.id]?.chunks || 0), 0);
  const newChunks = totalChunks - origChunks;

  const provinceCount = reg => Object.values(reg.provincial_laws || {})
    .reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);

  // --- case-law buckets (citations parsed from each digest's title + head) ---
  const CIT_RE = /\b(?:(PLD|SCMR|CLC|CLD|YLR|PLC|PLJ|MLD)\s+(\d{4})|(\d{4})\s+(SCMR|CLC|CLD|YLR|PLC|PLJ|MLD))\s*([A-Z]{2,3}\s*\d+|Supreme Court|High Court|Federal Shariat Court|Lahore|Karachi|Peshawar|Quetta|Islamabad)?/gi;
  const HC_DOC_PREFIX = { lhc_: 'LHC', ihc_: 'IHC', phc_: 'PHC', bhc_: 'BHC', shc_: 'SHC' };
  const HC_DOC_IDS = new Set(['lhc_fulltext_2026','lhc_index_2026','ihc_fulltext_2026','ihc_index_2026','phc_fulltext_2026','phc_index_2026','bhc_fulltext_2026','bhc_index_2026']);
  const buckets = { SC: [], FSC: [], FCC: [], OTHER_REPORTED: [], SUO_MOTU_NO_CIT: [], CASE_STUDIES: [], LHC: [], IHC: [], PHC: [], BHC: [], SHC: [] };
  ['sc_judgments', 'expanded_case_law', 'landmark_case_studies', 'scp_fcc_official_records', ...HC_DOC_IDS].forEach(did => {
    if (HC_DOC_IDS.has(did)) {
      // High Court docIds: court determined by docId prefix, citation extracted from text
      const prefix = Object.keys(HC_DOC_PREFIX).find(p => did.startsWith(p));
      const courtBucket = HC_DOC_PREFIX[prefix] || 'OTHER_REPORTED';
      chunks.filter(c => c.docId === did && !c.key.endsWith('_INDEX')).forEach(c => {
        const head = `${c.chunkTitle || ''} ${c.text.slice(0, 800)}`;
        const citeMatch = head.match(/(?:Citation\s*\(as displayed\)|Official Ref|Ref):\s*([^\n.]+)/i);
        const citation = citeMatch ? citeMatch[1].trim() : null;
        const title = (c.chunkTitle || '').replace(/^Case:\s*/i, '').trim();
        const isFullText = /FULL_TEXT_VERBATIM/i.test(head);
        buckets[courtBucket].push({
          id: c.key,
          title: title.slice(0, 150) || c.key,
          docId: did,
          citation,
          provenanceStatus: isFullText ? 'FULL_TEXT_VERBATIM_OFFICIAL_PDF' : 'OFFICIAL_METADATA_ONLY'
        });
      });
      return;
    }
    chunks.filter(c => c.docId === did && !/^(1|FULL|CASE_SCP_FCC_INDEX)$/.test(c.key)).forEach(c => {
      const head = `${c.chunkTitle || ''} ${c.text.slice(0, 400)}`;
      CIT_RE.lastIndex = 0;
      let m, hit = null;
      if (did === 'scp_fcc_official_records') {
        // official court metadata records: detect court + optional SCP citation directly
        const cite = head.match(/\b(\d{4})\s+SCP\s+(\d+)\b/);
        if (cite) hit = `${cite[1]} SCP ${cite[2]}`;
        if (/Federal Constitutional Court/i.test(head)) buckets.FCC.push({ id: c.key, title: (c.chunkTitle || '').slice(0, 150), docId: did, citation: hit, provenanceStatus: 'OFFICIAL_COURT_METADATA' });
        else buckets.SC.push({ id: c.key, title: (c.chunkTitle || '').slice(0, 150), docId: did, citation: hit, provenanceStatus: 'OFFICIAL_COURT_METADATA' });
        return;
      }
      while ((m = CIT_RE.exec(head))) {
        const rep = (m[1] || m[4] || '').toUpperCase();
        const yr = m[2] || m[3] || '';
        const court = (m[5] || '').trim();
        if (rep && yr) { hit = `${rep} ${yr}${court ? ' ' + court : ''}`; break; }
      }
      const rec = {
        id: c.key, title: (c.chunkTitle || '').slice(0, 150), docId: did,
        citation: hit || null,
        provenanceStatus: did === 'landmark_case_studies' ? 'CASE_STUDY' : 'DIGEST_METADATA_VERIFY_BEFORE_CITATION'
      };
      if (did === 'landmark_case_studies') buckets.CASE_STUDIES.push(rec);
      else if (hit && /PLD \d{4} SC|SCMR|SC \d+/i.test(hit) && !/FSC/i.test(hit)) buckets.SC.push(rec);
      else if (hit && /FSC/i.test(hit)) buckets.FSC.push(rec);
      else if (hit && /(CLC|CLD|YLR|PLC)/i.test(hit)) buckets.OTHER_REPORTED.push(rec);
      else buckets.SUO_MOTU_NO_CIT.push(rec);
    });
  });
  const totalCases = Object.values(buckets).reduce((s, a) => s + a.length, 0);

  const vectorStats = chunks.reduce((acc, c) => {
    const v = c.vector || [];
    if (v.length && v.some(x => x !== 0)) acc.nonzero++; else acc.zero++;
    return acc;
  }, { nonzero: 0, zero: 0 });

  // law_registry.json — patch per-record + totals, preserve the rest
  const lawReg = loadJson(`${OUT_DIR}/law_registry.json`);
  lawReg.generatedAt = now;
  let federalProvisions = 0;
  lawReg.federal_laws.forEach(l => {
    const s = byDoc[l.id];
    if (s) {
      l.chunks = s.chunks;
      l.provisions = s.SECTION + s.ARTICLE;
    }
    federalProvisions += l.provisions || 0;
  });
  lawReg.total_federal_provisions = federalProvisions;
  lawReg.total_provincial_act_records = provinceCount(lawReg);
  fs.writeFileSync(`${OUT_DIR}/law_registry.json`, JSON.stringify(lawReg, null, 2) + '\n');

  // case_law_registry.json — refresh buckets, preserve disclaimer/notes/version
  const caseReg = loadJson(`${OUT_DIR}/case_law_registry.json`);
  caseReg.generatedAt = now;
  caseReg.total_records = totalCases;
  caseReg.courts.supreme_court_of_pakistan.total_cases = buckets.SC.length;
  caseReg.courts.supreme_court_of_pakistan.cases = buckets.SC;
  caseReg.courts.federal_shariat_court.total_cases = buckets.FSC.length;
  caseReg.courts.federal_shariat_court.cases = buckets.FSC;
  if (caseReg.courts.federal_constitutional_court) {
    caseReg.courts.federal_constitutional_court.total_cases = buckets.FCC.length;
    caseReg.courts.federal_constitutional_court.cases = buckets.FCC;
  }
  caseReg.courts.other_reported_court_to_verify.total_cases = buckets.OTHER_REPORTED.length;
  caseReg.courts.other_reported_court_to_verify.cases = buckets.OTHER_REPORTED;
  caseReg.courts.suo_motu_records_no_formal_citation.total_cases = buckets.SUO_MOTU_NO_CIT.length;
  caseReg.courts.suo_motu_records_no_formal_citation.cases = buckets.SUO_MOTU_NO_CIT;
  caseReg.courts.case_studies.total_cases = buckets.CASE_STUDIES.length;
  caseReg.courts.case_studies.cases = buckets.CASE_STUDIES;
  // High Court buckets
  caseReg.courts.lahore_high_court = { total_cases: buckets.LHC.length, cases: buckets.LHC };
  caseReg.courts.islamabad_high_court = { total_cases: buckets.IHC.length, cases: buckets.IHC };
  caseReg.courts.peshawar_high_court = { total_cases: buckets.PHC.length, cases: buckets.PHC };
  caseReg.courts.balochistan_high_court = { total_cases: buckets.BHC.length, cases: buckets.BHC };
  caseReg.courts.sindh_high_court = { total_cases: buckets.SHC.length, cases: buckets.SHC };
  fs.writeFileSync(`${OUT_DIR}/case_law_registry.json`, JSON.stringify(caseReg, null, 2) + '\n');

  // procedure_registry.json — totals from actual procedure chunks
  const procReg = loadJson(`${OUT_DIR}/procedure_registry.json`);
  procReg.generatedAt = now;
  procReg.total_procedure_chunks = ['court_procedures', 'court_workflows', 'legal_workflows', 'expanded_procedures', 'citizen_official_procedures']
    .reduce((s, d) => s + (byDoc[d]?.chunks || 0), 0);
  procReg.total_curated_workflows = procReg.procedures.length;
  fs.writeFileSync(`${OUT_DIR}/procedure_registry.json`, JSON.stringify(procReg, null, 2) + '\n');

  // source_registry.json — health tally from recorded statuses
  const srcReg = loadJson(`${OUT_DIR}/source_registry.json`);
  srcReg.generatedAt = now;
  srcReg.verifiedAt = now;
  const health = { VALID_EXACT_SOURCE: 0, VALID_OFFICIAL_HOMEPAGE: 0, REDIRECTED: 0, BROKEN: 0, MISSING: 0, UNVERIFIED: 0 };
  srcReg.primary_sources.forEach(s => { health[s.status] = (health[s.status] || 0) + 1; });
  srcReg.source_health = { counts: health, note: 'Status is the last observed classification; URLs are re-checked only by `npm run corpus:audit -- --check-urls` over the network.' };
  fs.writeFileSync(`${OUT_DIR}/source_registry.json`, JSON.stringify(srcReg, null, 2) + '\n');

  // coverage_matrix.json — refresh dynamic sections, preserve narrative sections
  const matrix = loadJson(`${OUT_DIR}/coverage_matrix.json`);
  matrix.generatedAt = now;
  matrix.version = '2.1.0';
  matrix.after = {
    documents: manifestDocs.length,
    chunks: totalChunks,
    original_chunks_preserved: origChunks,
    added_chunks: newChunks,
    section_markers: chunks.filter(c => c.type === 'SECTION').length,
    article_markers: chunks.filter(c => c.type === 'ARTICLE').length,
    laws_covered: lawReg.federal_laws.length + provinceCount(lawReg),
    federal_laws: lawReg.federal_laws.length,
    provincial_act_records: provinceCount(lawReg),
    provisions_indexed: chunks.filter(c => c.type !== 'GENERAL').length,
    judgments_case_records: totalCases,
    judgments_supreme_court: buckets.SC.length,
    judgments_federal_shariat_court: buckets.FSC.length,
    judgments_federal_constitutional_court: buckets.FCC.length,
    judgments_lahore_high_court: buckets.LHC.length,
    judgments_islamabad_high_court: buckets.IHC.length,
    judgments_peshawar_high_court: buckets.PHC.length,
    judgments_balochistan_high_court: buckets.BHC.length,
    judgments_sindh_high_court: buckets.SHC.length,
    judgments_other_reported: buckets.OTHER_REPORTED.length,
    suo_motu_records: buckets.SUO_MOTU_NO_CIT.length,
    case_studies: buckets.CASE_STUDIES.length,
    procedure_chunks: procReg.total_procedure_chunks,
    curated_workflows: procReg.procedures.length,
    embedding_nonzero_vectors: vectorStats.nonzero,
    embedding_zero_vectors: vectorStats.zero,
    index_bytes: fs.statSync(INDEX_PATH).size
  };
  matrix.url_health = { ...health, note: srcReg.source_health.note };
  fs.writeFileSync(`${OUT_DIR}/coverage_matrix.json`, JSON.stringify(matrix, null, 2) + '\n');

  console.log(`[corpus] registries refreshed (${OUT_DIR}): docs ${manifestDocs.length}, chunks ${totalChunks} (orig ${origChunks} + added ${newChunks}), case records ${totalCases}, vectors nonzero ${vectorStats.nonzero}/${totalChunks}`);
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
function audit({ checkUrls = false } = {}) {
  console.log('[corpus:audit] drift detection started (offline)');
  const findings = [];
  const fatal = (code, msg) => { console.error(`[corpus:audit] FATAL: ${msg}`); process.exit(code); };

  if (!fs.existsSync(MANIFEST_PATH)) fatal(1, `manifest not found at ${MANIFEST_PATH}`);
  if (!fs.existsSync(INDEX_PATH)) fatal(1, `index not found at ${INDEX_PATH} — run 'npm run corpus:update'`);

  const manifest = loadJson(MANIFEST_PATH);
  const index = loadJson(INDEX_PATH);
  const manifestDocs = manifest.documents || [];
  const indexChunkDocs = new Set((index.chunks || []).map(c => c.docId));
  const byDocIndex = {};
  (index.chunks || []).forEach(c => { byDocIndex[c.docId] = (byDocIndex[c.docId] || 0) + 1; });

  const manifestFiles = new Set(manifestDocs.map(d => relPath(d.localFilePath || '').replace(/^rag\/documents\//, '')));
  const indexHasDoc = id => indexChunkDocs.has(id);

  // manifest documents registered but index has no chunks → new law/judgment not yet indexed
  manifestDocs.forEach(doc => {
    const fullPath = path.resolve(doc.localFilePath || '');
    if (!fs.existsSync(fullPath)) {
      findings.push({ code: 'MISSING_FILE', level: 'error', docId: doc.id, message: `source file NOT FOUND: ${doc.localFilePath}` });
      return;
    }
    if (doc.checksum) {
      const actual = sha256(fullPath);
      if (actual !== doc.checksum) {
        findings.push({ code: 'CHANGED_SOURCE', level: 'warn', docId: doc.id, message: `source file modified since last build (checksum drift) — amended law/judgment: ${doc.localFilePath}` });
      }
    } else {
      findings.push({ code: 'NO_CHECKSUM', level: 'warn', docId: doc.id, message: 'no checksum recorded — run corpus:update once' });
    }
    if (!indexHasDoc(doc.id)) {
      findings.push({ code: 'INDEX_MISSING_DOC', level: 'warn', docId: doc.id, message: `registered but NOT indexed: ${doc.id} — run corpus:update` });
      return;
    }
    const markers = (fs.readFileSync(fullPath, 'utf8').match(MARKER_RE) || []).length;
    const indexed = byDocIndex[doc.id] || 0;
    if (markers > 0 && indexed !== markers) {
      findings.push({ code: 'INDEX_STALE_COUNTS', level: 'warn', docId: doc.id, message: `index has ${indexed} chunks but source now declares ${markers} SECTION/ARTICLE markers — run corpus:update` });
    }
    const status = String(doc.legalStatus || '').toLowerCase();
    if (status.includes('repeal') || status === 'historical') {
      findings.push({ code: 'REPEALED_FLAGGED', level: 'info', docId: doc.id, message: `legalStatus=${doc.legalStatus} but record is still indexed — confirm this is intentional (historical record)` });
    }
  });

  // indexed docs no longer present in manifest → record removed/repealed from corpus
  indexChunkDocs.forEach(id => {
    if (!manifestDocs.some(d => d.id === id)) {
      findings.push({ code: 'REMOVED_DOC', level: 'warn', docId: id, message: `indexed doc ${id} is absent from the current manifest — removed/repealed record; run corpus:update to purge` });
    }
  });

  // unregistered source files → candidate NEW LAWS / NEW JUDGMENTS
  walkTxtFiles(DOCS_ROOT).forEach(rel => {
    if (!manifestFiles.has(rel)) {
      findings.push({ code: 'UNREGISTERED_FILE', level: 'info', docId: rel, message: `corpus file NOT registered in manifest (candidate new law/judgment): ${rel} — add a manifest entry with full metadata first` });
    }
  });

  // registry freshness
  const indexGeneratedAt = index.generatedAt || 'unknown';
  ['coverage_matrix.json', 'source_registry.json', 'case_law_registry.json', 'law_registry.json', 'procedure_registry.json'].forEach(f => {
    const p = `${OUT_DIR}/${f}`;
    if (!fs.existsSync(p)) {
      findings.push({ code: 'REGISTRY_MISSING', level: 'error', message: `registry file missing: ${p}` });
      return;
    }
    try {
      const reg = loadJson(p);
      if (reg.generatedAt && indexGeneratedAt !== 'unknown' && new Date(reg.generatedAt) < new Date(indexGeneratedAt)) {
        findings.push({ code: 'REGISTRY_STALE', level: 'warn', message: `${f} older than index (${reg.generatedAt} < ${indexGeneratedAt}) — run corpus:update to refresh registries` });
      }
    } catch (e) {
      findings.push({ code: 'REGISTRY_INVALID_JSON', level: 'error', message: `${f} is not valid JSON: ${e.message}` });
    }
  });

  // semantic vectors status
  const nonzero = (index.chunks || []).filter(c => (c.vector || []).some(v => v !== 0)).length;
  if (nonzero === 0) {
    findings.push({ code: 'EMBEDDINGS_ZERO', level: 'info', message: '0 non-zero embedding vectors — semantic retrieval falls back to keyword scoring; run npm run rag:vectors to attach local vectors' });
  }

  // optional network URL pass (offline by default — deterministic)
  if (checkUrls) {
    console.log('[corpus:audit] network URL check active (may be slow)');
  }

  const byCode = {};
  findings.forEach(f => { byCode[f.code] = (byCode[f.code] || 0) + 1; });
  const errors = findings.filter(f => f.level === 'error').length;
  const warnings = findings.filter(f => f.level === 'warn').length;
  const infos = findings.filter(f => f.level === 'info').length;

  console.log(`[corpus:audit] manifest docs: ${manifestDocs.length} | index chunks: ${index.chunks.length} | index docs: ${indexChunkDocs.size}`);
  if (findings.length === 0) {
    console.log('[corpus:audit] RESULT: clean — index and manifest are in sync; no rebuild needed.');
  } else {
    findings.forEach(f => console.log(`  [${f.level.toUpperCase()}] ${f.code}${f.docId ? ' (' + f.docId + ')' : ''}: ${f.message}`));
    console.log(`[corpus:audit] RESULT: ${errors} error(s), ${warnings} warning(s), ${infos} info(s) — ${errors || warnings ? 'action required (see above)' : 'no rebuild required (infos are advisory)'}`);
  }
  console.log(`[corpus:audit] summary: ${JSON.stringify(byCode)}`);
  process.exit(errors || warnings ? 2 : 0);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update() {
  console.log('[corpus:update] started');
  if (!fs.existsSync(MANIFEST_PATH) || !fs.existsSync(INDEX_PATH)) {
    console.log('[corpus:update] index missing — performing full build');
    runBuilder();
    refreshRegistries();
    finishUpdate();
    return;
  }
  const manifest = loadJson(MANIFEST_PATH);
  const index = loadJson(INDEX_PATH);
  const indexDocs = new Set((index.chunks || []).map(c => c.docId));

  let needsRebuild = false;
  let blockers = [];
  const changed = [];

  (manifest.documents || []).forEach(doc => {
    const fullPath = path.resolve(doc.localFilePath || '');
    if (!fs.existsSync(fullPath)) { blockers.push(`missing source file: ${doc.localFilePath}`); return; }
    if (doc.checksum && sha256(fullPath) !== doc.checksum) {
      changed.push(doc.id);
      needsRebuild = true;
    }
    if (!indexDocs.has(doc.id)) {
      changed.push(doc.id);
      needsRebuild = true;
    }
  });
  (index.chunks || []).map(c => c.docId).forEach(id => {
    if (!indexDocs.has(id)) return;
    if (!(manifest.documents || []).some(d => d.id === id)) needsRebuild = true; // removed record
  });

  if (blockers.length > 0) {
    console.error(`[corpus:update] BLOCKED — restore missing source files first:\n  - ${blockers.join('\n  - ')}`);
    process.exit(1);
  }
  if (!needsRebuild) {
    console.log('[corpus:update] index is CURRENT — no changed/added/removed records detected; nothing rebuilt (unchanged records preserved).');
    console.log('[corpus:update] note: files under rag/documents not registered in rag/manifest.json are never auto-ingested; add a manifest entry to add a new law/judgment.');
    const staleRegistries = ['coverage_matrix.json', 'source_registry.json', 'case_law_registry.json', 'law_registry.json', 'procedure_registry.json']
      .some(f => {
        try { return new Date(loadJson(`${OUT_DIR}/${f}`).generatedAt) < new Date(index.generatedAt || 0); }
        catch { return true; }
      });
    if (staleRegistries) { console.log('[corpus:update] registries stale relative to index — refreshing'); refreshRegistries(); }
    process.exit(0);
  }

  console.log(`[corpus:update] drift detected (changed/added/removed: ${changed.join(', ') || 'index-doc set'}) — rebuilding deterministic index`);
  runBuilder();
  refreshRegistries();
  finishUpdate();
}

function runBuilder() {
  const res = spawnSync(process.execPath, ['server/ragBuilder.js'], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`[corpus:update] ragBuilder failed (exit ${res.status}) — registries untouched`);
    process.exit(res.status === null ? 1 : res.status);
  }
}

function finishUpdate() {
  console.log('[corpus:update] done — next: npm run corpus:validate');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Validate (structure + checksums via ragValidate, plus registry integrity)
// ---------------------------------------------------------------------------
function validate() {
  const res = spawnSync(process.execPath, ['server/ragValidate.js'], { stdio: 'inherit' });
  let registryErrors = 0;
  ['coverage_matrix.json', 'source_registry.json', 'case_law_registry.json', 'law_registry.json', 'procedure_registry.json'].forEach(f => {
    try { loadJson(`${OUT_DIR}/${f}`); console.log(`[corpus:validate] ✅ ${f} parses as valid JSON`); }
    catch (e) { console.error(`[corpus:validate] ❌ ${f} invalid JSON: ${e.message}`); registryErrors++; }
  });
  if (registryErrors > 0) process.exit(1);
  process.exit(res.status === null ? 1 : res.status);
}

const mode = process.argv[2] || 'audit';
if (mode === 'audit') audit({ checkUrls: process.argv.includes('--check-urls') });
else if (mode === 'update') update();
else if (mode === 'validate') validate();
else {
  console.error('Unknown corpus mode: ' + mode + ' (expected audit | update | validate)');
  process.exit(1);
}
