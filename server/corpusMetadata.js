/**
 * Document-level corpus metadata (issuer, legal status, official URL).
 *
 * Chunks carry provision-level text only; the registering authority, status and
 * source URL live in the corpus registry (rag/manifest.json), which is the file
 * the corpus pipeline validates with checksums. Retrieval responses read their
 * metadata from here so nothing is invented at request time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'rag', 'manifest.json'
);

let registry = null;

function loadRegistry() {
  if (registry) return registry;
  registry = {};
  try {
    const documents = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).documents || [];
    for (const doc of documents) {
      if (!doc || !doc.id) continue;
      registry[doc.id] = {
        authority: doc.issuingAuthority || null,
        legalStatus: doc.legalStatus || null,
        sourceUrl: doc.sourceURL || null,
      };
    }
  } catch (err) {
    console.warn('[corpus-metadata] manifest unreadable:', err.message);
  }
  return registry;
}

export function documentMetadata(docId) {
  if (!docId) return null;
  return loadRegistry()[docId] || null;
}
