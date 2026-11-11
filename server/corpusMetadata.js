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

/**
 * Two procedure guides were registered with "Insaaf AI Verified Systems" as their
 * issuing authority. That is this application describing itself, not an
 * institution a citizen can look up, and publishing it in a citation lets an
 * internal badge pass for a source. Any authority that names the product rather
 * than an issuer is treated as no authority at all.
 */
export function isSelfReferentialAuthority(value) {
  const a = String(value || '').trim();
  if (!a) return false;
  return /\binsaaf\b|\pinsayf\b|\binsaaf-?ai\b/i.test(a)
    || /\bverified systems?\b/i.test(a);
}

function loadRegistry() {
  if (registry) return registry;
  registry = {};
  try {
    const documents = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).documents || [];
    for (const doc of documents) {
      if (!doc || !doc.id) continue;
      registry[doc.id] = {
        authority: isSelfReferentialAuthority(doc.issuingAuthority) ? null : (doc.issuingAuthority || null),
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
