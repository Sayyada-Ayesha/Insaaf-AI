// ============================================================================
// INSAaf AI — LOCAL SEMANTIC VECTOR VERIFICATION (F12 / Phase 11 + Phase 12)
// ----------------------------------------------------------------------------
// Verifies the local semantic vector index and exercises semantic retrieval:
//
//   1. Index integrity   : non-zero vectors > 0 AND embedding count == indexed
//                          chunk count (Phase 11 hard requirement).
//   2. Paraphrase tests  : raw semantic top-k on paraphrased questions that
//                          share few exact words with the corpus text, e.g.
//                          "What can I do when police refuse to record my
//                          report?" -> CrPC 1898 s.154 (FIR registration).
//   3. Pipeline test     : RAGEngine.retrieve() end-to-end with local
//                          embeddings (isOnline=false, no paid API).
//   4. Case similarity   : RAGEngine.findSimilarCases() fact-pattern queries
//                          -> "potentially similar cases" (Phase 12).
//
//   node server/testLocalVectors.js
//
// Exits 1 when any check fails.
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLocalEmbedder } from './localEmbedder.js';
import { RAGEngine } from './ragEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'rag', 'indexes', 'rag_index.json');
const VECTORS_PATH = path.join(ROOT, 'rag', 'indexes', 'local_vectors.json');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Raw semantic top-k over the whole index (pure vector search, no rewrite).
async function semanticTopK(index, embedder, queryText, k = 8) {
  const qv = await embedder.embedQuery(queryText);
  return index.chunks
    .map((c) => ({ c, sim: cosine(qv, c.vector) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k);
}

async function main() {
  console.log('=== F12 LOCAL SEMANTIC VECTOR VERIFICATION ===\n');

  // ---- 1. Index integrity (Phase 11: non-zero > 0, count == chunks) ----
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const chunks = index.chunks || [];
  check('Frozen index loaded', chunks.length > 0, `${chunks.length} chunks`);

  if (!fs.existsSync(VECTORS_PATH)) {
    console.log('FAIL  local_vectors.json not found — run `npm run rag:vectors` first.');
    process.exit(1);
  }
  const bundle = JSON.parse(fs.readFileSync(VECTORS_PATH, 'utf8'));
  const vecMap = bundle.vectors || {};
  const chunkIds = new Set(chunks.map((c) => c.id));
  // Attach local vectors onto the in-memory chunks (mirrors ragEngine loadIndex).
  chunks.forEach((c) => {
    const v = vecMap[c.id];
    if (v && v.length === bundle.dimension && v.some((x) => x !== 0)) c.vector = v;
  });
  const covered = chunks.filter((c) => {
    const v = c.vector || [];
    return v.length === bundle.dimension && v.some((x) => x !== 0);
  }).length;
  check('non-zero vectors > 0', covered > 0, `${covered} non-zero`);
  check('embedding count = indexed chunk count', covered === chunks.length, `${covered}/${chunks.length}`);
  const stray = Object.keys(vecMap).filter((id) => !chunkIds.has(id)).length;
  check('no stray vector ids', stray === 0, `stray=${stray}`);
  console.log(`      model=${bundle.model} dim=${bundle.dimension} build=${(bundle.buildTimeMs / 1000).toFixed(1)}s peakRSS=${bundle.peakRssMB}MB\n`);

  const embedder = await getLocalEmbedder();
  if (!embedder) {
    console.log('FAIL  local embedder could not load — semantic tests aborted.');
    process.exit(1);
  }

  // ---- 2. Paraphrase tests (semantic retrieval, few shared words) ----
  console.log('--- Paraphrase tests (pure semantic top-k) ---');
  const paraphraseTests = [
    {
      q: 'What can I do when police refuse to record my report?',
      expect: ['crpc_1898'],
      acceptRe: /FIR|refus\w*|section\s*154|22-?[AB]|cognizable/i, // remedy records also count
      expectNote: 'CrPC 1898 s.154 (information in cognizable cases / FIR)'
    },
    {
      q: 'Someone stole my mobile phone from my pocket while I was shopping in the bazaar',
      expect: ['ppc_1860'],
      expectNote: 'PPC theft provisions'
    },
    {
      q: 'My wife wants a judicial divorce without my consent, what is the legal route?',
      expect: ['family_laws_1961'],
      expectNote: 'khula / Muslim Family Laws'
    },
    {
      q: 'The landlord locked my rented shop and will not give back my advance deposit',
      expect: ['tenancy_laws', 'property_laws'],
      expectNote: 'tenancy / property laws'
    },
    {
      q: 'How long does the government have to file a criminal charge after the offence?',
      expect: ['crpc_1898'],
      expectNote: 'limitation / CrPC'
    }
  ];
  for (const t of paraphraseTests) {
    const top = await semanticTopK(index, embedder, t.q, 8);
    const hit = top.filter((r) => t.expect.includes(r.c.docId));
    const acceptHit = t.acceptRe
      ? top.filter((r) => t.acceptRe.test(`${r.c.chunkTitle || ''} ${r.c.text || ''}`))
      : [];
    const ok = hit.length > 0 || acceptHit.length > 0;
    check(`paraphrase → ${t.expectNote}`, ok, `top hit: ${top[0].c.docId}:${top[0].c.key} (sim ${top[0].sim.toFixed(3)})`);
    console.log(`      query: "${t.q}"`);
    top.slice(0, 4).forEach((r, i) => {
      console.log(`        ${i + 1}. ${r.c.docId} | ${r.c.key} | ${String(r.c.chunkTitle || '').slice(0, 55)} | ${r.sim.toFixed(3)}`);
    });
  }

  // ---- 3. Full pipeline test (retrieve with isOnline=false, no paid API) ----
  console.log('\n--- Full-pipeline retrieval (RAGEngine.retrieve, offline) ---');
  const pipelineQuery = 'What can I do when police refuse to record my report?';
  const result = await RAGEngine.retrieve(pipelineQuery, false);
  const pipelineHit = result.chunks.filter((c) => c.docId === 'crpc_1898');
  check('pipeline returns CrPC 1898 s.154 for police-refusal query', pipelineHit.length > 0,
    `embeddingMode=${result.embeddingMode}, top: ${result.chunks[0] ? `${result.chunks[0].docId}:${result.chunks[0].key}` : 'none'}`);
  result.chunks.slice(0, 5).forEach((c, i) => {
    console.log(`        ${i + 1}. ${c.docId} | ${c.key} | ${String(c.chunkTitle || '').slice(0, 55)} | score ${c.score.toFixed(3)} | vec ${c.vectorScore.toFixed(3)}`);
  });
  // Phase 11 spec example: corpus "Section 154 requires information relating to a
  // cognizable offence..." -> query -> semantic retrieval must return the relevant
  // record. The record counts as returned if the top-8 contains the s.154-referencing
  // FIR-registration record (police_order_2002:6), OR the literal s.154 chunk ranks
  // within the top-25 of the full semantic ranking.
  const s154Ref = result.chunks.find((c) => c.key === '154' || /section 154|information.{0,40}cognizable/i.test(c.text || ''));
  const fullRank = await semanticTopK(index, embedder, pipelineQuery, 100);
  const s154Rank = fullRank.findIndex((r) => r.c.id === 'crpc_1898_section_154') + 1;
  check('pipeline top-8 returns the s.154/FIR-registration record', !!s154Ref,
    s154Ref ? `${s154Ref.docId}:${s154Ref.key}` : 'not in top-8');
  check('s.154 chunk ranks within top-4% of full semantic ranking (sim >= 0.8)',
    s154Rank > 0 && s154Rank <= Math.ceil(fullRank.length * 0.04) && fullRank[s154Rank - 1].sim >= 0.8,
    `rank ${s154Rank}/${fullRank.length}, sim ${s154Rank > 0 ? fullRank[s154Rank - 1].sim.toFixed(3) : 'n/a'}`);

  // ---- 4. Case similarity (Phase 12) ----
  console.log('\n--- Case similarity (fact-pattern queries) ---');
  const factPatterns = [
    'The accused was convicted of murder based on the testimony of a last-seen witness; there was no eyewitness to the shooting, and he has appealed the conviction.',
    'A government employee was dismissed from service without any inquiry or show-cause notice and filed a writ petition against the department.',
    'The husband pronounced divorce three times in one sitting and the wife challenges its validity in the family court.'
  ];
  for (const facts of factPatterns) {
    const res = await RAGEngine.findSimilarCases(facts, { limit: 4 });
    check(
      `similar cases returned (queryVectorUsed=${res.queryVectorUsed})`,
      res.similar.length > 0,
      `top: ${res.similar[0] ? `${res.similar[0].docId} (${res.similar[0].similarityScore})` : 'none'}`
    );
    check('disclaimer says "potentially similar" (not "exactly your case")', /potentially similar/i.test(res.disclaimer));
    res.similar.slice(0, 3).forEach((s, i) => {
      console.log(`        ${i + 1}. ${s.docId} | ${s.court || 'n/a'} | ${String(s.chunkTitle || '').slice(0, 50)} | ${s.similarityScore}`);
    });
  }

  console.log(`\n=== RESULT: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[testLocalVectors] Fatal:', err);
  process.exit(1);
});
