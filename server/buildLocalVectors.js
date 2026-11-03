// ============================================================================
// INSAaf AI — LOCAL VECTOR INDEX BUILDER (F12 / Phase 11)
// ----------------------------------------------------------------------------
// Builds a persistent local semantic vector index for the FROZEN corpus
// (2.5.0-final) WITHOUT touching any frozen file. It reads the authoritative
// rag/indexes/rag_index.json chunk list and writes a SEPARATE additive file:
//
//   rag/indexes/local_vectors.json        chunkId -> 384-dim float vector
//   rag/indexes/local_vectors.report.md   model/dim/runtime/memory/size/build
//
// The frozen rag_index.json and rag/manifest.json remain byte-identical, so
// the 2.5.0-final freeze hash stays valid. ragEngine merges the local vectors
// into the in-memory index at load time.
//
//   node server/buildLocalVectors.js
//
// Exits 1 if any chunk fails to receive a non-zero vector.
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLocalEmbedder } from './localEmbedder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'rag', 'indexes', 'rag_index.json');
const OUT_PATH = path.join(ROOT, 'rag', 'indexes', 'local_vectors.json');
const REPORT_PATH = path.join(ROOT, 'rag', 'indexes', 'local_vectors.report.md');

// Identical to the ragBuilder embedding text formula, so chunk semantics are
// consistent with the rest of the pipeline (title + type + key + title + body).
function textToEmbed(chunk) {
  return `${chunk.title} ${chunk.type} ${chunk.key} ${chunk.chunkTitle} ${chunk.text}`;
}

async function main() {
  const startedAt = Date.now();
  console.log('[Local Vectors] Loading frozen index:', INDEX_PATH);
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('[Local Vectors] Frozen index not found. Run the corpus freeze first.');
    process.exit(1);
  }
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const chunks = index.chunks || [];
  if (chunks.length === 0) {
    console.error('[Local Vectors] Index has no chunks.');
    process.exit(1);
  }
  console.log(`[Local Vectors] Chunks to embed: ${chunks.length}`);

  const embedder = await getLocalEmbedder();
  if (!embedder) {
    console.error('[Local Vectors] Local embedder unavailable — cannot build semantic vectors. Aborting (do not fake completion).');
    process.exit(1);
  }
  console.log(`[Local Vectors] Model loaded: ${embedder.model} (dim ${embedder.dim}). Embedding...`);
  const rssAfterLoadMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

  const vectors = {};
  let nonZero = 0;
  let zeroCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const v = await embedder.embedPassage(textToEmbed(chunk));
    if (v && v.length > 0 && v.some((x) => x !== 0)) {
      vectors[chunk.id] = v;
      nonZero++;
    } else {
      zeroCount++;
      console.warn(`[Local Vectors] Zero vector for ${chunk.id}`);
    }
    if ((i + 1) % 200 === 0 || i === chunks.length - 1) {
      const el = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[Local Vectors] ${i + 1}/${chunks.length} embedded (${el}s)...`);
    }
  }

  const buildTimeMs = Date.now() - startedAt;
  const peakRssMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

  const bundle = {
    generatedAt: new Date().toISOString(),
    model: embedder.model,
    modelSource: 'Local HF cache (quantized ONNX), fully offline',
    provider: 'local',
    dimension: embedder.dim,
    prefixConvention: 'passage: for chunks / query: for queries (e5 convention)',
    indexedChunkCount: chunks.length,
    nonZeroVectorCount: nonZero,
    zeroVectorCount: zeroCount,
    buildTimeMs,
    peakRssMB,
    rssAfterModelLoadMB: rssAfterLoadMB,
    vectors
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(bundle), 'utf8');
  const indexSizeBytes = fs.statSync(OUT_PATH).size;

  const report = `# Local Semantic Vector Index — ${bundle.generatedAt}

## Model
- **Model**: ${bundle.model}
- **Dimension**: ${bundle.dimension}
- **Source**: ${bundle.modelSource}
- **Prefix convention**: ${bundle.prefixConvention}
- **Long-text handling**: lead truncation to the first 360 words (e5 RAG practice; avoids diffuse vectors for full-text judgments)

## Runtime & Memory
- **Runtime**: Node.js + @xenova/transformers 2.17.2 (onnxruntime-web WASM)
- **RSS after model load**: ${rssAfterLoadMB} MB
- **Peak RSS during build**: ${peakRssMB} MB

## Index size
- **File**: rag/indexes/local_vectors.json
- **Size**: ${(indexSizeBytes / 1024 / 1024).toFixed(2)} MB (${indexSizeBytes.toLocaleString()} bytes)

## Build
- **Build time**: ${(buildTimeMs / 1000).toFixed(1)} s
- **Chunks indexed**: ${chunks.length}
- **Non-zero vectors**: ${nonZero}
- **Zero vectors**: ${zeroCount}

## Verification status
${nonZero > 0 && nonZero === chunks.length ? '**PASS** — non-zero vectors > 0 and embedding count = indexed chunk count.' : '**FAIL** — see zeroVectorCount above.'}
`;
  fs.writeFileSync(REPORT_PATH, report, 'utf8');

  console.log(`\n[Local Vectors] DONE. Non-zero: ${nonZero}/${chunks.length}. Zero: ${zeroCount}.`);
  console.log(`[Local Vectors] Build time: ${(buildTimeMs / 1000).toFixed(1)}s. Peak RSS: ${peakRssMB} MB. Index size: ${(indexSizeBytes / 1024 / 1024).toFixed(2)} MB.`);
  console.log(`[Local Vectors] Wrote: ${OUT_PATH}`);
  console.log(`[Local Vectors] Wrote: ${REPORT_PATH}`);

  if (nonZero !== chunks.length || nonZero === 0) {
    console.error('[Local Vectors] FAIL: embedding count != indexed chunk count. Semantic search NOT marked PASS.');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[Local Vectors] Fatal:', err);
  process.exit(1);
});
