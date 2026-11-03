// ============================================================================
// INSAF AI — VECTOR KEY REPAIR (P0.1)
// ----------------------------------------------------------------------------
// rag/indexes/local_vectors.json is keyed by chunk id, so a chunk id that was
// shared by two different passages silently carried ONE embedding for both.
// The builder now gives every passage its own id; this script re-keys the
// existing verified embedding store to those ids without re-running the whole
// 12-minute embed pass.
//
// Reuse is only allowed after the local embedder is PROVEN to reproduce the
// stored vectors for unchanged chunks bit-for-bit. If that check fails the
// script refuses and tells the operator to run the full `npm run rag:vectors`.
//
//   node server/repairVectorKeys.mjs
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
const SOURCE_PATH = OUT_PATH;
const BACKUP_DIR = path.join(ROOT, 'rag', '.staging', 'vector_backups');
const DETERMINISM_SAMPLE = 8;

// Must stay identical to server/buildLocalVectors.js.
function textToEmbed(chunk) {
  return `${chunk.title} ${chunk.type} ${chunk.key} ${chunk.chunkTitle} ${chunk.text}`;
}

function sameVector(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error('[Key Repair] FAIL: no existing vector store at rag/indexes/local_vectors.json. Run the full pipeline first: npm run rag:vectors');
    process.exit(1);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.copyFileSync(SOURCE_PATH, path.join(BACKUP_DIR, `local_vectors.${Date.now()}.json`));
  const backup = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const oldVectors = backup.vectors || {};
  const chunks = index.chunks || [];
  const ids = chunks.map(c => c.id);
  const unique = new Set(ids);
  console.log(`[Key Repair] Index chunks ${chunks.length}, unique ids ${unique.size}.`);
  if (unique.size !== chunks.length) {
    console.error('[Key Repair] FAIL: index still has duplicate ids. Fix the builder first.');
    process.exit(1);
  }

  const embedder = await getLocalEmbedder();
  if (!embedder) {
    console.error('[Key Repair] Local embedder unavailable — refusing to write vectors (do not fake completion).');
    process.exit(1);
  }

  // 1. Prove that re-embedding an unchanged chunk returns the stored vector.
  const reusable = chunks.filter(c => Array.isArray(oldVectors[c.id]));
  const sample = reusable.filter(c => !c.id.endsWith('__2'))
    .sort((a, b) => b.text.length - a.text.length).slice(0, DETERMINISM_SAMPLE);
  let matched = 0;
  for (const c of sample) {
    const v = await embedder.embedPassage(textToEmbed(c));
    if (sameVector(v, oldVectors[c.id])) matched++;
    else console.warn(`[Key Repair] Drift on ${c.id}`);
  }
  console.log(`[Key Repair] Determinism ${matched}/${sample.length} on ${embedder.model} (dim ${embedder.dim}).`);
  if (matched !== sample.length) {
    console.error('[Key Repair] ABORT — the embedder is not reproducible, so stored vectors cannot be reused.');
    console.error('[Key Repair] Run the full pipeline instead: npm run rag:vectors');
    process.exit(1);
  }

  // 2. Re-key everything still present, then embed the newly separated passages.
  // A colliding group stored only its LAST passage under the base id, so the
  // vector sitting at a base id describes the wrong passage. Both members of a
  // former collision are embedded fresh; every other id reuses its verified vector.
  const formerBases = new Set(ids.filter(i => /__\d+$/.test(i)).map(i => i.replace(/__\d+$/, '')));
  const vectors = {};
  for (const c of chunks) {
    if (Array.isArray(oldVectors[c.id]) && !formerBases.has(c.id)) vectors[c.id] = oldVectors[c.id];
  }
  const missing = chunks.filter(c => !vectors[c.id]);
  console.log(`[Key Repair] Reused ${chunks.length - missing.length} verified vectors; embedding ${missing.length} passage(s) (newly separated ids + the mislabelled base id of each former collision).`);
  let zero = 0;
  for (const c of missing) {
    const v = await embedder.embedPassage(textToEmbed(c));
    if (v && v.length === embedder.dim && v.some(x => x !== 0)) vectors[c.id] = v;
    else { zero++; console.warn(`[Key Repair] Zero/short vector for ${c.id}`); }
    console.log(`  embedded ${c.id} (${c.chunkTitle.slice(0, 48)})`);
  }

  // 3. Parity assertions.
  const keys = Object.keys(vectors);
  const dims = new Set(keys.map(k => vectors[k].length));
  const unattached = chunks.filter(c => !vectors[c.id]).length;
  const bundle = {
    ...backup,
    generatedAt: new Date().toISOString(),
    indexedChunkCount: chunks.length,
    nonZeroVectorCount: keys.length - zero,
    zeroVectorCount: zero,
    repair: {
      method: 'non-colliding chunk ids reused from the previous verified build after an 8/8 bit-identical determinism check; both members of each former collision embedded with the same model, because the shared base id had stored only the last passage',
      previousGeneratedAt: backup.generatedAt,
      reused: chunks.length - missing.length,
      embedded: missing.length,
      embeddedIds: missing.map(c => c.id)
    },
    vectors
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(bundle), 'utf8');
  const size = fs.statSync(OUT_PATH).size;

  const report = `# Local Semantic Vector Index — ${bundle.generatedAt}

## Model
- **Model**: ${bundle.model}
- **Dimension**: ${bundle.dimension}
- **Source**: ${bundle.modelSource}
- **Prefix convention**: ${bundle.prefixConvention}
- **Long-text handling**: lead truncation to the first 360 words (e5 RAG practice; avoids diffuse vectors for full-text judgments)

## Build
- **Method**: ${bundle.repair.method}
- **Previous build**: ${bundle.repair.previousGeneratedAt}
- **Chunks indexed**: ${chunks.length}
- **Vectors stored**: ${keys.length} (distinct keys, one per chunk)
- **Reused verified vectors**: ${bundle.repair.reused}
- **Freshly embedded**: ${bundle.repair.embedded} — ${bundle.repair.embeddedIds.join(', ')}
- **Zero vectors**: ${zero}
- **Chunks with no vector**: ${unattached}
- **Dimensions present**: ${[...dims].join(', ')}
- **File size**: ${(size / 1024 / 1024).toFixed(2)} MB (${size.toLocaleString()} bytes)

## Verification status
${keys.length === chunks.length && zero === 0 && unattached === 0
    ? '**PASS** — every chunk id has exactly one non-zero vector; no id collision remains.'
    : '**FAIL** — see counts above. Do not ship this file as the default index.'}
`;
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(`[Key Repair] Keys ${keys.length}/${chunks.length}, zero ${zero}, unattached ${unattached}, dims ${[...dims].join(',')}.`);
  if (keys.length !== chunks.length || zero > 0 || unattached > 0) process.exit(1);
  console.log('[Key Repair] PASS');
}

main().catch(e => { console.error('[Key Repair] ERROR', e.message); process.exit(1); });
