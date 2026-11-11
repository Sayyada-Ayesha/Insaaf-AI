/**
 * tests/eval/corpusFacts.mjs — the corpus-side truth set the evaluator judges against.
 *
 * Every axis that concerns citations or unsupported claims is answered from the
 * repository's own records, never from a hand-written expected answer: a claim in
 * an answer is legitimate only if it appears in the chunk that the answer cites.
 *
 * rag/indexes/rag_index.json carries an embedding vector per chunk (~36 MB); the
 * vectors are dropped as the file is read so the judge holds only text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const manifestDocs = readJson('rag/manifest.json').documents;
const index = readJson('rag/indexes/rag_index.json');

/** key -> chunk (chunk.key is the stable record id the SSE sources card carries) */
export const chunkByKey = new Map();
/** docId -> document metadata from the manifest */
export const docById = new Map(manifestDocs.map(d => [d.id, d]));
/** docId -> its chunks, for doc-level grounding when a card carries no key */
export const chunksByDoc = new Map();
/** docId -> corpus domain key (from DOMAIN_DOCS, imported below) */
export const domainByDoc = new Map();

for (const c of index.chunks) {
  delete c.vector;
  if (c.key) chunkByKey.set(c.key, c);
  if (!chunksByDoc.has(c.docId)) chunksByDoc.set(c.docId, []);
  chunksByDoc.get(c.docId).push(c);
}

/** Domains whose routing table says a document answers that kind of question. */
const { DOMAIN_DOCS } = await import('../../server/ragEngine.js');
for (const [domain, ids] of Object.entries(DOMAIN_DOCS)) {
  for (const id of ids) {
    if (!domainByDoc.has(id)) domainByDoc.set(id, domain);
    const list = domainByDoc.get(id);
    if (typeof list === 'string' && list !== domain) domainByDoc.set(id, [list, domain]);
    else if (Array.isArray(list) && !list.includes(domain)) list.push(domain);
  }
}

export const DOMAINS = Object.keys(DOMAIN_DOCS);
export const DOMAIN_DOC_IDS = DOMAIN_DOCS;

/** Every URL the corpus publishes — the only URLs an answer may show. */
export const KNOWN_URLS = new Set(
  manifestDocs.map(d => String(d.sourceURL || '')).filter(Boolean)
);

/** Authority + title strings the corpus actually carries. */
export const KNOWN_AUTHORITIES = new Set(
  manifestDocs.flatMap(d => [d.issuingAuthority, d.title].filter(Boolean))
);

export function domainsOfDoc(docId) {
  const v = domainByDoc.get(docId);
  return v == null ? [] : (Array.isArray(v) ? v : [v]);
}

/**
 * The searchable text of the record a source card points at. A claim is grounded
 * when the cited record itself says it, so a right number attached to the wrong
 * record still reads as ungrounded at the answer level (the gate owns subject
 * matching; this owns claim-to-record matching).
 */
export function citedRecordText(source) {
  const key = source && (source.key || source.chunkKey);
  if (key && chunkByKey.has(key)) return chunkByKey.get(key).text || '';
  const docId = source && source.docId;
  if (docId && chunksByDoc.has(docId)) {
    return chunksByDoc.get(docId).map(c => c.text || '').join('\n');
  }
  return '';
}

/** Words that make up a record's own subject — used for stem agreement. */
export function recordStems(source) {
  const key = source && (source.key || source.chunkKey);
  const chunk = key ? chunkByKey.get(key) : null;
  const doc = source && source.docId ? docById.get(source.docId) : null;
  const parts = [
    chunk && chunk.key, chunk && chunk.chunkTitle, chunk && chunk.title,
    chunk && chunk.issuingAuthority,
    source && source.title, source && source.authority,
    doc && doc.title, doc && doc.issuingAuthority,
  ].filter(Boolean).join(' ').toLowerCase();
  return new Set(parts.split(/[^a-z0-9]+/).filter(w => w.length > 2));
}

export const CORPUS_STATS = {
  documents: manifestDocs.length,
  chunks: index.chunks.length,
  domains: DOMAINS.length,
  urls: KNOWN_URLS.size,
};
