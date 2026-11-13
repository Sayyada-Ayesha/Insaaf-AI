// ============================================================================
// Insaaf AI — LOCAL SEMANTIC EMBEDDER (F12 / Phase 11 — Semantic Retrieval)
// ----------------------------------------------------------------------------
// Genuine semantic embeddings WITHOUT any paid external generative-AI API.
// Uses the open model Xenova/multilingual-e5-small served locally through
// @xenova/transformers (quantized ONNX + onnxruntime WASM, fully offline).
//
//   Model    : Xenova/multilingual-e5-small (quantized)
//   Dim      : 384
//   Runtime  : Node.js + @xenova/transformers 2.17.2 (onnxruntime-web)
//   Memory   : ~400-600 MB RSS while loaded (~118 MB quantized weights on disk)
//   Prefix   : e5 convention — "query: " for queries, "passage: " for passages
//   Long text: LEAD-TRUNCATION to the first 360 words (the model's effective
//              window). Chunk embeddings follow standard e5 RAG practice:
//              title + key + chunkTitle + leading body text. Mean-pooling
//              whole judgments produces overly broad vectors that crowd out
//              precise statute matches, so the tail is dropped.
//
// Lazy singleton: the heavy model loads ONCE per process on first use. If the
// model cannot load (missing cache / unsupported platform), getLocalEmbedder()
// resolves to null and callers fall back to keyword retrieval.
// ============================================================================
import { pipeline, env } from '@xenova/transformers';

const CACHE_DIR = process.env.HF_CACHE_DIR || 'D:/hf-cache';
env.cacheDir = CACHE_DIR;
env.localModelPath = CACHE_DIR;
// Fully offline: never attempt to fetch from the HF hub at runtime. If the
// cached model is missing this throws a clear error instead of hanging on a
// network call (the corpus build depends on no paid API, online or not).
env.allowRemoteModels = false;

const MODEL_NAME = 'Xenova/multilingual-e5-small';
const DIM = 384;
const WINDOW_WORDS = 360; // conservative words-per-window to stay under 512 tokens

let extractorPromise = null;
let loadError = null;

async function embedSingle(extractor, text) {
  const out = await extractor(String(text || '').trim(), { pooling: 'mean', normalize: true });
  const v = Array.from(out.data);
  return v.length >= DIM ? v.slice(0, DIM) : v;
}

function normalize(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((x) => x / norm);
}

// Long texts (full-text judgments) exceed the model's 512-token limit. Standard
// e5 RAG practice embeds the LEAD of the passage: the title/key/chunkTitle and
// the opening body text carry the identifying semantics, while mean-pooling an
// entire 10k-word judgment produces a diffuse vector that outranks precise
// statute sections. So we keep the first WINDOW_WORDS words only.
async function embedLong(extractor, text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return new Array(DIM).fill(0);
  const lead = words.slice(0, WINDOW_WORDS).join(' ');
  return embedSingle(extractor, lead);
}

/**
 * Returns the shared local embedder:
 *   { model, dim, embedPassage(text), embedQuery(text) }
 * or null when the model cannot load. Idempotent and safe to call repeatedly
 * (including inside hot retrieval loops — it always resolves the same handle).
 */
export async function getLocalEmbedder() {
  if (loadError) return null;
  if (extractorPromise) return extractorPromise;

  extractorPromise = (async () => {
    const extractor = await pipeline('feature-extraction', MODEL_NAME, { quantized: true });
    return {
      model: MODEL_NAME,
      dim: DIM,
      embedPassage: (text) => embedLong(extractor, `passage: ${text}`),
      embedQuery: (text) => embedLong(extractor, `query: ${text}`)
    };
  })();

  try {
    return await extractorPromise;
  } catch (err) {
    loadError = err;
    extractorPromise = null;
    console.warn(
      `[Local Embedder] ${MODEL_NAME} could not be loaded (${err.message}). ` +
      `Semantic retrieval will fall back to keyword matching. Cache dir: ${CACHE_DIR}`
    );
    return null;
  }
}
