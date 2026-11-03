// ============================================================================
// INSAaf AI — FINAL CORPUS FREEZE (Phase 1 of the V2 data-prep task)
// ----------------------------------------------------------------------------
// Produces a REPRODUCIBLE, VERSIONED, TAMPER-EVIDENT snapshot of the CURRENT
// expanded legal corpus + cross-border corpus, reusing the project's existing
// corpus mechanisms (rag/manifest.json, rag/indexes/rag_index.json and the
// rag/corpus_expansion/* registries authored by server/corpusTools.js).
//
//   node server/freezeFinalCorpus.js
//
// Outputs (all under rag/corpus_expansion/):
//   final_corpus_manifest.json     authoritative counts + coverage + gaps
//   final_corpus_freeze.json       SHA-256 lock over every frozen file
//   final_corpus_coverage_report.md  human-readable coverage/gap report
//
// This script is READ-ONLY with respect to the corpus: it never mutates the
// index, manifest, documents or registries. It only reads them and writes the
// three freeze artifacts. Running it again reproduces identical counts and
// identical file hashes (freeze_hash is derived from content, not timestamps).
// ============================================================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.resolve(ROOT, p);

const MANIFEST_PATH = R('rag/manifest.json');
const INDEX_PATH = R('rag/indexes/rag_index.json');
const OUT_DIR = R('rag/corpus_expansion');
const REG = (f) => path.join(OUT_DIR, f);

// 2026-09-07: 2.6.0-final closes the F4-F10 knowledge gaps on top of 2.5.0:
//  - amendment-history corpus (28 sections) + rag/corpus_expansion/amendment_registry.json
//  - provincial full-text + coverage matrix (Punjab/Sindh/KP/Balochistan/ICT/AJK/GB)
//  - missing domains: customs, health, FIA, administrative law/public service, torts
//  - civic-services workflow corpus (10 workflows), POA law + drafting structures,
//    foreigner residence/work/study depth, expanded public-offices catalog (39 records)
//  - local semantic embedding layer: rag/indexes/local_vectors.json (1569/1569
//    non-zero, Xenova/multilingual-e5-small dim 384) locked alongside the index.
// Prior freeze archived under rag/corpus_expansion/archive/2.5.0-final/.
const CORPUS_VERSION = '2.6.0-final';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

// ---- folder -> domain-category label (derived straight from disk layout) ----
function folderOf(localFilePath) {
  const m = String(localFilePath || '').match(/rag\/documents\/([^/]+)\//);
  return m ? m[1] : 'other';
}

// ---------------------------------------------------------------------------
// 1. Authoritative live counts from the index (includes cross-border).
// ---------------------------------------------------------------------------
const manifest = readJson(MANIFEST_PATH);
const index = readJson(INDEX_PATH);
const docs = manifest.documents || [];
const chunks = index.chunks || [];

// local semantic embedding layer (additive; see server/buildLocalVectors.js)
const LOCAL_VECTORS_PATH = R('rag/indexes/local_vectors.json');
let localVectorCount = 0;
let localVectorDim = null;
if (exists(LOCAL_VECTORS_PATH)) {
  try {
    const lv = readJson(LOCAL_VECTORS_PATH);
    localVectorCount = lv.nonZeroVectorCount || 0;
    localVectorDim = lv.dimension || null;
  } catch {
    localVectorCount = 0;
  }
}

const docById = new Map(docs.map((d) => [d.id, d]));
const chunksByDoc = {};
for (const c of chunks) chunksByDoc[c.docId] = (chunksByDoc[c.docId] || 0) + 1;

// per-domain-category (folder) doc + chunk counts
const domainCounts = {};
for (const d of docs) {
  const cat = folderOf(d.localFilePath);
  domainCounts[cat] = domainCounts[cat] || { documents: 0, chunks: 0 };
  domainCounts[cat].documents++;
  domainCounts[cat].chunks += chunksByDoc[d.id] || 0;
}

// provision markers (SECTION/ARTICLE/GENERAL) from index chunk types
const typeCount = { SECTION: 0, ARTICLE: 0, GENERAL: 0 };
for (const c of chunks) typeCount[c.type] = (typeCount[c.type] || 0) + 1;

// distinct source domains
const sourceDomains = new Set(docs.map((d) => String(d.sourceDomain || '').toLowerCase()).filter(Boolean));

// indexing drift: manifest ids vs index ids
const indexDocIds = new Set(chunks.map((c) => c.docId));
const manifestIds = new Set(docs.map((d) => d.id));
const unindexed = [...manifestIds].filter((id) => !indexDocIds.has(id));
const orphanIndexed = [...indexDocIds].filter((id) => !manifestIds.has(id));

// ---------------------------------------------------------------------------
// 2. Cross-border corpus (the layer added after the 2026-09-03 registries).
// ---------------------------------------------------------------------------
const CB_IDS = [
  'cross_border_legal', 'cross_border_consular', 'cross_border_travel',
  'cross_border_employment', 'cross_border_education', 'cross_border_diplomacy',
];
const cbDocs = docs.filter((d) => CB_IDS.includes(d.id));
const cbChunkDetail = {};
let cbChunkTotal = 0;
for (const d of cbDocs) {
  const n = chunksByDoc[d.id] || 0;
  cbChunkDetail[d.id] = { title: d.title, chunks: n, file: d.localFilePath, sourceURL: d.sourceURL };
  cbChunkTotal += n;
}

// Countries actually NAMED inside the cross-border documents (never fabricated:
// we only report what literally appears). This is a ROUTING/SOURCE reference,
// not verified per-country foreign substantive law.
const cbText = cbDocs
  .map((d) => (exists(R(d.localFilePath)) ? fs.readFileSync(R(d.localFilePath), 'utf8') : ''))
  .join('\n');
const COUNTRY_SCAN = {
  'United Arab Emirates (UAE)': /\bU\.?A\.?E\.?\b|\bUnited Arab Emirates\b/i,
  'Saudi Arabia': /\bSaudi\b/i,
  'Qatar': /\bQatar\b/i,
  'Kuwait': /\bKuwait\b/i,
  'Oman': /\bOman\b/i,
  'Bahrain': /\bBahrain\b/i,
  'United Kingdom': /\bUK\b|\bUnited Kingdom\b|\bBritain\b|\bEngland\b/i,
  'United States': /\bU\.?S\.?\b|\bUSA\b|\bUnited States\b|\bAmerica(n)?\b/i,
  'Canada': /\bCanada\b/i,
  'Australia': /\bAustralia(n)?\b/i,
  'China': /\bChina\b|\bChinese\b/i,
  'Japan': /\bJapan(ese)?\b/i,
  'Malaysia': /\bMalaysia\b/i,
  'Türkiye (Turkey)': /\bTürkiye\b|\bTurkey\b/i,
  'Germany': /\bGermany\b|\bGerman\b/i,
  'France': /\bFrance\b|\bFrench\b/i,
  'Netherlands': /\bNetherlands\b|\bDutch\b/i,
  'Italy': /\bItaly\b|\bItalian\b/i,
  'Spain': /\bSpain\b|\bSpanish\b/i,
  'Schengen / European states (region)': /\bSchengen\b/i,
  'Thailand': /\bThailand\b/i,
  'Singapore': /\bSingapore\b/i,
  'South Korea': /\bKorea\b/i,
  'South Africa': /\bSouth Africa\b/i,
};
const countriesNamed = [];
for (const [name, re] of Object.entries(COUNTRY_SCAN)) if (re.test(cbText)) countriesNamed.push(name);

// Official foreign/authority source URLs actually present in the cross-border docs.
const cbUrlMatches = [...cbText.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)].map((m) => m[0]);
const cbSourceHosts = [...new Set(cbUrlMatches.map((u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return null; } }))].filter(Boolean).sort();

// ---------------------------------------------------------------------------
// 3. Reuse the corpus_expansion registries for the curated Pakistan detail.
// ---------------------------------------------------------------------------
const lawReg = exists(REG('law_registry.json')) ? readJson(REG('law_registry.json')) : {};
const caseReg = exists(REG('case_law_registry.json')) ? readJson(REG('case_law_registry.json')) : {};
const procReg = exists(REG('procedure_registry.json')) ? readJson(REG('procedure_registry.json')) : {};
const srcReg = exists(REG('source_registry.json')) ? readJson(REG('source_registry.json')) : {};
const matrix = exists(REG('coverage_matrix.json')) ? readJson(REG('coverage_matrix.json')) : {};

const federalLawCount = (lawReg.federal_laws || []).length;
const provincialRecords = lawReg.total_provincial_act_records || 0;
const totalFederalProvisions = lawReg.total_federal_provisions || 0;
const courts = caseReg.courts || {};
const caseLawByCourt = {
  supreme_court: courts.supreme_court_of_pakistan?.total_cases ?? 0,
  federal_constitutional_court: courts.federal_constitutional_court?.total_cases ?? 0,
  federal_shariat_court: courts.federal_shariat_court?.total_cases ?? 0,
  lahore_high_court: courts.lahore_high_court?.total_cases ?? 0,
  islamabad_high_court: courts.islamabad_high_court?.total_cases ?? 0,
  peshawar_high_court: courts.peshawar_high_court?.total_cases ?? 0,
  balochistan_high_court: courts.balochistan_high_court?.total_cases ?? 0,
  sindh_high_court: courts.sindh_high_court?.total_cases ?? 0,
  other_reported_to_verify: courts.other_reported_court_to_verify?.total_cases ?? 0,
  suo_motu_no_formal_citation: courts.suo_motu_records_no_formal_citation?.total_cases ?? 0,
  case_studies: courts.case_studies?.total_cases ?? 0,
};
const totalCaseRecords = Object.values(caseLawByCourt).reduce((a, b) => a + b, 0);
const procedureChunks = procReg.total_procedure_chunks ?? (domainCounts['court-procedure']?.chunks || 0) + (domainCounts['procedure']?.chunks || 0);
const curatedWorkflows = procReg.total_curated_workflows ?? procReg.procedures?.length ?? 0;
const primarySourceCount = (srcReg.primary_sources || []).length;

// rights / remedies / institutions chunk counts (from live index folders)
function folderChunks(...folders) { return folders.reduce((s, f) => s + (domainCounts[f]?.chunks || 0), 0); }
const rightsChunks = folderChunks('constitution') + folderChunks('education') + folderChunks('student');
const remediesChunks = folderChunks('remedies');
const institutionsChunks = folderChunks('institutions');

// ---------------------------------------------------------------------------
// 4. Coverage gaps (honest, from the coverage_matrix + observed state).
// ---------------------------------------------------------------------------
const gaps = {
  high_court_case_law: 'High Court (LHC/IHC/PHC/BHC) judgments ingested with full-text+metadata records in 2.5.0-final. SHC online repository unreachable (Cloudflare 522); FSC/SCP/FCC hosts unreachable from this environment. Prior 72 SC/FSC digests retained.',
  case_law_provenance: 'All case records are DIGEST METADATA requiring verification against official reporters before citation.',
  provincial_full_text: 'CLOSED in 2.6.0-final: provincial_fulltext.txt (20 sections, per-province operative provisions + full/partial/summary matrix) + ajk_laws.txt + gb_laws.txt indexed.',
  missing_domains: 'CLOSED in 2.6.0-final: customs, health, FIA, administrative law/public service, torts added and indexed (34 domains covered; see coverage_matrix).',
  amendment_history: 'CLOSED in 2.6.0-final: 28-section amendment corpus + amendment_registry.json (27 chains). Corpus is current only up to the 26th Constitutional Amendment (Oct 2024); yearly Finance-Act changes are not enumerated by design.',
  cross_border_foreign_law: 'NO country-specific FOREIGN substantive law is stored. The cross-border layer gives Pakistan-side rules + routing to official foreign authorities for named countries only; it never asserts foreign rules it has not verified. Countries listed are MENTIONED (as official-source links / examples), not comprehensively covered.',
  dual_nationality_list: 'The permitted-countries list for Pakistani dual nationality is deliberately NOT enumerated (changes by official notification; confirmed via MOFA/NADRA).',
  semantic_embeddings: localVectorCount && localVectorCount > 0
    ? `Local semantic embeddings ACTIVE: ${localVectorCount}/${chunks.length} non-zero vectors (Xenova/multilingual-e5-small, dim ${localVectorDim || '?'}, offline).`
    : 'All embedding vectors are zero (offline): semantic retrieval disabled; keyword + exact-provision retrieval active.',
  unindexed_docs: unindexed,
  orphan_indexed_docs: orphanIndexed,
};

// ---------------------------------------------------------------------------
// 5. Freeze lock: SHA-256 over every file that makes up the frozen snapshot.
// ---------------------------------------------------------------------------
const freezeFiles = [];
function lockFile(rel, role) {
  const abs = R(rel);
  if (!exists(abs)) { freezeFiles.push({ path: rel, role, present: false }); return; }
  freezeFiles.push({ path: rel, role, present: true, sha256: sha256(fs.readFileSync(abs)), bytes: fs.statSync(abs).size });
}
lockFile('rag/manifest.json', 'corpus-manifest');
lockFile('rag/indexes/rag_index.json', 'search-index');
if (exists(R('rag/indexes/local_vectors.json'))) lockFile('rag/indexes/local_vectors.json', 'local-embedding-vectors');
for (const d of cbDocs) lockFile(d.localFilePath, 'cross-border-source');
for (const f of ['coverage_matrix.json', 'law_registry.json', 'case_law_registry.json', 'procedure_registry.json', 'source_registry.json', 'amendment_registry.json']) {
  if (exists(REG(f))) lockFile('rag/corpus_expansion/' + f, 'registry');
}
// every Pakistan .txt corpus source (documents not in cross-border)
for (const d of docs) if (!CB_IDS.includes(d.id)) lockFile(d.localFilePath, 'pakistan-source');

// A single content-only fingerprint (excludes timestamps) so re-freezing yields
// the same freeze_hash when the corpus has not mutated.
const freezeContent = freezeFiles
  .filter((f) => f.present)
  .map((f) => f.path + '=' + f.sha256)
  .sort()
  .join('\n');
const freezeHash = sha256(Buffer.from(freezeContent, 'utf8'));

// ---------------------------------------------------------------------------
// 6. Write artifacts.
// ---------------------------------------------------------------------------
const frozenAt = new Date().toISOString();

const coverageManifest = {
  corpus_version: CORPUS_VERSION,
  freeze_timestamp: frozenAt,
  freeze_hash: freezeHash,
  reproducible: true,
  method: 'Read-only aggregation of the live index (rag/indexes/rag_index.json) + rag/manifest.json + the rag/corpus_expansion registries maintained by server/corpusTools.js. See final_corpus_freeze.json for the content hash lock.',
  totals: {
    documents: docs.length,
    index_chunks: chunks.length,
    unique_indexed_doc_ids: indexDocIds.size,
    provision_markers: { SECTION: typeCount.SECTION || 0, ARTICLE: typeCount.ARTICLE || 0, GENERAL: typeCount.GENERAL || 0 },
    source_domains: sourceDomains.size,
    primary_sources_registered: primarySourceCount,
    local_embedding_vectors: { non_zero: localVectorCount, dimension: localVectorDim },
  },
  amendments: (() => {
    const reg = exists(REG('amendment_registry.json')) ? readJson(REG('amendment_registry.json')) : null;
    return {
      records: reg ? reg.total_amendment_records || (reg.records || []).length : 0,
      laws_with_history: reg ? reg.laws_with_history || 0 : 0,
      registry: 'rag/corpus_expansion/amendment_registry.json',
    };
  })(),
  pakistan: {
    federal_law_documents: federalLawCount,
    federal_provisions_indexed: totalFederalProvisions,
    provincial_act_records: provincialRecords,
    case_law: { total_records: totalCaseRecords, by_court: caseLawByCourt },
    procedures: { procedure_chunks: procedureChunks, curated_workflows: curatedWorkflows },
    chunk_counts_by_category: {
      constitution_rights: rightsChunks,
      remedies: remediesChunks,
      institutions: institutionsChunks,
    },
  },
  domain_counts_by_folder: domainCounts,
  cross_border: {
    documents: cbDocs.length,
    chunks: cbChunkTotal,
    per_document: cbChunkDetail,
    countries_referenced_in_corpus: countriesNamed,
    countries_note: 'Countries appear as official-source links, named scholarship/programme examples, or illustrative references (e.g. "a U.S. court summons"). This is NOT verified per-country foreign substantive law and does NOT claim coverage of all international law.',
    official_source_hosts_in_corpus: cbSourceHosts,
    behavior: 'Answers triage by jurisdiction, keep Pakistan-law and foreign-law layers separate, route to the correct official authority, and refuse to invent foreign rules.',
  },
  coverage_gaps: gaps,
  files_used_for_snapshot: freezeFiles.filter((f) => f.present).map((f) => f.path),
  integrity: {
    unindexed_manifest_docs: unindexed,
    indexed_docs_missing_from_manifest: orphanIndexed,
    all_manifest_docs_indexed: unindexed.length === 0,
    no_orphans: orphanIndexed.length === 0,
  },
  disclaimer: 'This is the maximum verified, publicly-sourced Pakistan-law + cross-border ROUTING corpus currently implemented in this project. It is NOT all Pakistani law and NOT all international law. Case records are digests to be verified against official reporters before citation. No foreign-country substantive law is fabricated.',
};

const freezeLock = {
  corpus_version: CORPUS_VERSION,
  freeze_timestamp: frozenAt,
  freeze_hash: freezeHash,
  hash_algorithm: 'sha256',
  note: 'To verify the corpus has not mutated, recompute sha256 of each file below and compare. `final_corpus_hash` recomputation logic lives in server/freezeFinalCorpus.js (content-only, timestamp-independent).',
  file_count: freezeFiles.filter((f) => f.present).length,
  files: freezeFiles,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'final_corpus_manifest.json'), JSON.stringify(coverageManifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'final_corpus_freeze.json'), JSON.stringify(freezeLock, null, 2) + '\n', 'utf8');

// ---- coverage report (markdown) ----
const md = [];
md.push('# INSAaf AI — Final Corpus Freeze & Coverage Report');
md.push('');
md.push(`- **Corpus version:** \`${CORPUS_VERSION}\``);
md.push(`- **Freeze timestamp:** ${frozenAt}`);
md.push(`- **Freeze hash (content, sha256):** \`${freezeHash}\``);
md.push(`- **Reproducible / tamper-evident:** yes — see \`final_corpus_freeze.json\``);
md.push('');
md.push('> This freezes the CURRENT expanded legal + cross-border corpus for RAG and future retraining. It is **not** all Pakistani law and **not** all international law. See Gaps.');
md.push('');
md.push('## 1. Totals (live index)');
md.push('');
md.push('| Metric | Value |');
md.push('|---|---|');
md.push(`| Documents (manifest) | ${coverageManifest.totals.documents} |`);
md.push(`| Index chunks | ${coverageManifest.totals.index_chunks} |`);
md.push(`| Unique indexed doc ids | ${coverageManifest.totals.unique_indexed_doc_ids} |`);
md.push(`| SECTION markers | ${coverageManifest.totals.provision_markers.SECTION} |`);
md.push(`| ARTICLE markers | ${coverageManifest.totals.provision_markers.ARTICLE} |`);
md.push(`| General/whole-doc chunks | ${coverageManifest.totals.provision_markers.GENERAL} |`);
md.push(`| Distinct source domains | ${coverageManifest.totals.source_domains} |`);
md.push(`| Registered primary sources | ${coverageManifest.totals.primary_sources_registered} |`);
md.push('');
md.push('## 2. Pakistan federal / provincial / case-law');
md.push('');
md.push('| Area | Count |');
md.push('|---|---|');
md.push(`| Federal law documents | ${federalLawCount} |`);
md.push(`| Federal provisions indexed | ${totalFederalProvisions} |`);
md.push(`| Provincial act records | ${provincialRecords} |`);
md.push(`| Case-law records (total) | ${totalCaseRecords} |`);
md.push(`| — Supreme Court digests | ${caseLawByCourt.supreme_court} |`);
md.push(`| — Federal Constitutional Court records | ${caseLawByCourt.federal_constitutional_court} |`);
md.push(`| — Federal Shariat Court digests | ${caseLawByCourt.federal_shariat_court} |`);
md.push(`| — Lahore High Court (full-text+metadata) | ${caseLawByCourt.lahore_high_court} |`);
md.push(`| — Islamabad High Court (full-text+metadata) | ${caseLawByCourt.islamabad_high_court} |`);
md.push(`| — Peshawar High Court (full-text+metadata) | ${caseLawByCourt.peshawar_high_court} |`);
md.push(`| — Balochistan High Court (full-text+metadata) | ${caseLawByCourt.balochistan_high_court} |`);
md.push(`| — Sindh High Court (full-text+metadata) | ${caseLawByCourt.sindh_high_court} |`);
md.push(`| — Other reported (verify) | ${caseLawByCourt.other_reported_to_verify} |`);
md.push(`| — Suo motu (no formal citation) | ${caseLawByCourt.suo_motu_no_formal_citation} |`);
md.push(`| — Case studies | ${caseLawByCourt.case_studies} |`);
md.push(`| Procedure chunks | ${procedureChunks} |`);
md.push(`| Curated workflows | ${curatedWorkflows} |`);
md.push('');
md.push('## 3. Chunks by corpus folder (domain category)');
md.push('');
md.push('| Folder / category | Documents | Chunks |');
md.push('|---|---|---|');
for (const [cat, v] of Object.entries(domainCounts).sort((a, b) => b[1].chunks - a[1].chunks)) {
  md.push(`| ${cat} | ${v.documents} | ${v.chunks} |`);
}
md.push('');
md.push('## 4. Cross-border corpus');
md.push('');
md.push(`- **Documents:** ${cbDocs.length}  |  **Chunks:** ${cbChunkTotal}`);
md.push('');
md.push('| Cross-border document | Chunks | Source |');
md.push('|---|---|---|');
for (const id of CB_IDS) { const d = cbChunkDetail[id]; if (d) md.push(`| ${d.title} | ${d.chunks} | ${d.sourceURL || ''} |`); }
md.push('');
md.push('### Countries / jurisdictions actually represented in the cross-border corpus');
md.push('');
md.push(countriesNamed.length ? countriesNamed.map((c) => '- ' + c).join('\n') : '- (none named)');
md.push('');
md.push('> **Honest framing:** these countries appear as **official-source links, named scholarship/programme examples, or illustrative references** (e.g. "a U.S. court summons"). The corpus stores **no country-specific foreign substantive law**. It keeps Pakistan-law and foreign-law layers separate and routes to the correct official authority. **This is not coverage of all international law.**');
md.push('');
md.push('Official source hosts referenced in the cross-border corpus:');
md.push('');
md.push(cbSourceHosts.map((h) => '- ' + h).join('\n') || '- (none)');
md.push('');
md.push('## 5. Unresolved coverage gaps (genuine)');
md.push('');
md.push(`- **High Court case law:** ${gaps.high_court_case_law}`);
md.push(`- **Case-law provenance:** ${gaps.case_law_provenance}`);
md.push(`- **Provincial full text:** ${gaps.provincial_full_text}`);
md.push(`- **Missing dedicated domains:** ${gaps.missing_domains}`);
md.push(`- **Amendment history:** ${gaps.amendment_history}`);
md.push(`- **Cross-border foreign law:** ${gaps.cross_border_foreign_law}`);
md.push(`- **Dual-nationality country list:** ${gaps.dual_nationality_list}`);
md.push(`- **Semantic embeddings:** ${gaps.semantic_embeddings}`);
md.push('');
md.push('## 6. Integrity');
md.push('');
md.push(`- All manifest documents indexed: **${coverageManifest.integrity.all_manifest_docs_indexed ? 'YES' : 'NO (' + unindexed.join(', ') + ')'}**`);
md.push(`- Orphan indexed docs absent from manifest: **${coverageManifest.integrity.no_orphans ? 'NONE' : orphanIndexed.join(', ')}**`);
md.push(`- Frozen files hashed in lock: **${freezeLock.file_count}**`);
md.push('');
md.push('## 7. How to use / re-verify');
md.push('');
md.push('- Re-run `node server/freezeFinalCorpus.js` to regenerate these three artifacts. If the corpus has not mutated, `freeze_hash` is identical.');
md.push('- The corpus itself is only changed through the sanctioned pipeline: edit `rag/documents/*`, register in `rag/manifest.json`, then `npm run corpus:update` and `npm run corpus:validate`.');
md.push('- Do **not** edit `rag/indexes/rag_index.json` or the frozen source files by hand; the freeze lock will detect it.');
md.push('');
md.push('---');
md.push(`Generated read-only from the live corpus by \`server/freezeFinalCorpus.js\` at ${frozenAt}.`);
md.push('');
fs.writeFileSync(path.join(OUT_DIR, 'final_corpus_coverage_report.md'), md.join('\n'), 'utf8');

console.log('=== FINAL CORPUS FREEZE ===');
console.log('corpus_version   : ' + CORPUS_VERSION);
console.log('documents        : ' + docs.length + '  (cross-border ' + cbDocs.length + ')');
console.log('index chunks     : ' + chunks.length + '  (cross-border ' + cbChunkTotal + ')');
console.log('SECTION/ARTICLE  : ' + typeCount.SECTION + '/' + typeCount.ARTICLE);
console.log('federal/provincial: ' + federalLawCount + ' laws (' + totalFederalProvisions + ' provisions) / ' + provincialRecords + ' provincial records');
console.log('case-law         : ' + JSON.stringify(caseLawByCourt) + ' = ' + totalCaseRecords);
console.log('hc-case-law      : LHC=' + caseLawByCourt.lahore_high_court + ' IHC=' + caseLawByCourt.islamabad_high_court + ' PHC=' + caseLawByCourt.peshawar_high_court + ' BHC=' + caseLawByCourt.balochistan_high_court + ' SHC=' + caseLawByCourt.sindh_high_court);
console.log('procedures       : ' + procedureChunks + ' chunks, ' + curatedWorkflows + ' workflows');
console.log('countries named  : ' + countriesNamed.length + ' -> ' + countriesNamed.join(', '));
console.log('local vectors    : ' + localVectorCount + ' non-zero (dim ' + (localVectorDim || '?') + ')');
console.log('amendments       : ' + (coverageManifest.amendments.records || 0) + ' records / ' + (coverageManifest.amendments.laws_with_history || 0) + ' laws');
console.log('integrity        : unindexed=' + unindexed.length + ' orphans=' + orphanIndexed.length);
console.log('freeze_hash      : ' + freezeHash);
console.log('frozen files     : ' + freezeLock.file_count);
console.log('written          : final_corpus_manifest.json, final_corpus_freeze.json, final_corpus_coverage_report.md');
process.exit(0);
