// ============================================================================
// Insaaf AI — Fine-Tuning Dataset: shared reference resolution
// Used by the generator (precheck) and the validator (source-reference
// checks). Resolves a source_ref string against the RAG corpus so that no
// example claims a section, title, case citation or law that the corpus
// does not actually contain.
// ============================================================================
import fs from 'fs';
import { CATEGORIES } from '../../src/config/documentSchemas.ts';

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------
export const norm = (s) => String(s || '').toLowerCase()
  .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
  .replace(/\s+/g, ' ').trim();

// Aggressive normalization: letters/digits only (used for corpus keys).
export const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// English-only normalization (drops Urdu script; used for template labels).
const normEn = (s) => String(s || '').toLowerCase().replace(/[^a-z]+/g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Law-name aliases mapped to corpus document ids (order matters).
// ---------------------------------------------------------------------------
const LAW_ALIASES = [
  { re: /prevention of electronic crimes act/i, doc: 'peca_2016' },
  { re: /muslim family laws ordinance/i, doc: 'family_laws_1961' },
  { re: /pakistan penal code/i, doc: 'ppc_1860' },
  { re: /code of criminal procedure/i, doc: 'crpc_1898' },
  { re: /code of civil procedure/i, doc: 'cpc_1908' },
  { re: /constitution of pakistan/i, doc: 'constitution_1973' },
  { re: /constitution\b/i, doc: 'constitution_1973' },
  { re: /crpc\b/i, doc: 'crpc_1898' },
  { re: /\bppc\b/i, doc: 'ppc_1860' },
  { re: /peca\b/i, doc: 'peca_2016' },
  { re: /\bcpc\b/i, doc: 'cpc_1908' }
];

// Citation pattern (case citations appear verbatim in the corpus only).
// Handles "PLD 1988 SC 416", "PLD 2010 FSC 1" and "2015 SCMR 1739" forms.
const CITATION_RE = /((?:PLD|SCMR|FSC)\s+\d{4}(?:\s+(?:SC|FSC|\d{1,4}))?)|(\d{4}\s+SCMR\s+\d{1,4})/i;
const SECTION_RE = /(?:Sections?|Articles?)\s+([^,;:•\n]*)/gi;
const ORDER_RE = /Orders?\s+([IVXLCDM]+(?:\s*,\s*[IVXLCDM]+)*)/gi;

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

// ---------------------------------------------------------------------------
// Corpus loading
// ---------------------------------------------------------------------------
export function loadCorpus() {
  const idxRaw = JSON.parse(fs.readFileSync(new URL('../../rag/indexes/rag_index.json', import.meta.url), 'utf8'));
  const offlineRaw = JSON.parse(fs.readFileSync(new URL('../../rag/knowledge/offlineKnowledge.json', import.meta.url), 'utf8'));
  const chunks = idxRaw.chunks || [];
  const byDocKey = {};          // docId -> Set<normKey>
  const titles = [];            // { norm, docId, key }
  const titleSet = new Set();
  const mentionParts = [];
  for (const c of chunks) {
    if (!byDocKey[c.docId]) byDocKey[c.docId] = new Set();
    byDocKey[c.docId].add(normKey(c.key));
    const tn = norm(c.chunkTitle || '');
    titles.push({ norm: tn, docId: c.docId, key: c.key });
    if (tn) titleSet.add(tn);
    mentionParts.push(norm(c.text || ''));
    mentionParts.push(tn);
  }
  for (const t of Object.values(offlineRaw)) {
    mentionParts.push(norm((t.content || '') + ' ' + (t.topic || '') + ' ' + (t.title || '')));
  }
  const mentionPool = mentionParts.join(' \n ');
  return { chunks, byDocKey, titles, titleSet, mentionPool, offline: offlineRaw };
}

// ---------------------------------------------------------------------------
// Drafting-template ids from the live document schemas.
// ---------------------------------------------------------------------------
let _templateIds = null;
export function templateIds() {
  if (!_templateIds) {
    const set = new Set();
    for (const cat of CATEGORIES) {
      for (const sub of cat.subCategories) {
        set.add(normKey(sub.id));            // e.g. 'lostcnic'
        set.add(normEn(sub.label || ''));     // e.g. 'lost cnic application'
      }
    }
    _templateIds = set;
  }
  return _templateIds;
}

// ---------------------------------------------------------------------------
// resolveRef(ref, corpus) -> { ok: boolean, reason: string }
// ---------------------------------------------------------------------------
export function resolveRef(ref, corpus) {
  if (!ref || typeof ref !== 'string' || !ref.trim()) return { ok: false, reason: 'empty reference' };
  const raw = ref.trim();
  const rn = norm(raw);

  // 1. Case citations must appear verbatim in the corpus.
  if (CITATION_RE.test(raw)) {
    const m = raw.match(CITATION_RE);
    const token = (m[1] || m[2]).replace(/[^A-Za-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (corpus.mentionPool.includes(token)) return { ok: true, reason: 'citation found in corpus' };
    return { ok: false, reason: `citation "${token}" not found in corpus` };
  }

  // 2. Law alias + Section/Article/Order tokens -> exact index-key check.
  const alias = LAW_ALIASES.find(a => a.re.test(raw));
  if (alias) {
    const tokens = [];
    SECTION_RE.lastIndex = 0;
    let m;
    while ((m = SECTION_RE.exec(raw)) !== null) {
      const piece = m[1].trim();
      for (const tok of piece.split(/,|&| and /i)) {
        const t = tok.trim();
        if (!t) continue;
        const range = t.match(/^([0-9]+)\s*[-–]+\s*([0-9]+)$/);
        if (range) { tokens.push(range[1], range[2]); continue; }
        tokens.push(t.replace(/[^0-9A-Za-z]/g, '').toUpperCase());
      }
    }
    ORDER_RE.lastIndex = 0;
    while ((m = ORDER_RE.exec(raw)) !== null) {
      for (const rom of m[1].split(',')) tokens.push('ORDER_' + rom.trim().toUpperCase());
    }
    if (tokens.length > 0) {
      const keys = corpus.byDocKey[alias.doc];
      const bad = tokens.filter(t => t && !keys.has(normKey(t)));
      if (bad.length === 0) return { ok: true, reason: `section tokens verified in ${alias.doc}` };
      // Fallback: the provision may only be mentioned inside case text or
      // knowledge summaries (e.g. Constitution Article 58 within a judgment).
      const mentioned = bad.every(t => {
        const tok = t.toLowerCase();
        return corpus.mentionPool.includes('article ' + tok) ||
          corpus.mentionPool.includes('articles ' + tok) ||
          corpus.mentionPool.includes('section ' + tok) ||
          corpus.mentionPool.includes('sections ' + tok);
      });
      if (mentioned) return { ok: true, reason: `section token(s) ${bad.join(', ')} mentioned in corpus text` };
      return { ok: false, reason: `section token(s) ${bad.join(', ')} not found in ${alias.doc}` };
    }
    // Law named without sections: must be mentioned in the corpus.
    if (corpus.mentionPool.includes(rn) || corpus.mentionPool.includes(rn.slice(0, Math.max(12, rn.length)))) {
      return { ok: true, reason: 'law name found in corpus text' };
    }
    return { ok: false, reason: `law "${raw}" not found in corpus text` };
  }

  // 3. Drafting-template references.
  if (/^Drafting Template:/i.test(raw)) {
    const label = raw.replace(/^Drafting Template:/i, '');
    const ids = templateIds();
    if (ids.has(normKey(label)) || ids.has(normEn(label))) return { ok: true, reason: 'drafting template known' };
    return { ok: false, reason: `unknown drafting template "${label.trim()}"` };
  }

  // 4. Exact corpus key match (no length limit).
  for (const doc of Object.keys(corpus.byDocKey)) {
    if (corpus.byDocKey[doc].has(normKey(raw))) return { ok: true, reason: `exact key match in ${doc}` };
  }

  // 5. Normalized title / text mention (minimum length guard).
  if (rn.length >= 8) {
    if (corpus.titleSet.has(rn)) return { ok: true, reason: 'exact title match' };
    for (const t of corpus.titles) {
      if ((t.norm.length >= 12 && t.norm.includes(rn)) || (rn.length >= 12 && rn.includes(t.norm) && t.norm.length >= 8)) {
        return { ok: true, reason: 'title substring match' };
      }
    }
    if (corpus.mentionPool.includes(rn)) return { ok: true, reason: 'mentioned in corpus text' };
  }
  return { ok: false, reason: `reference not found in corpus: "${raw}"` };
}

// ---------------------------------------------------------------------------
// URL allowlist — domains that actually appear in the RAG corpus.
// ---------------------------------------------------------------------------
export const URL_ALLOWED_DOMAINS = [
  'pakistancode.gov.pk',
  'punjabcode.punjab.gov.pk',
  'hec.gov.pk',
  'mohr.gov.pk',
  'supremecourt.gov.pk',
  'complaint.fia.gov.pk',
  'pakistanbarcouncil.org',
  // Official domains added with the 2026-09-06 corpus expansion (each verified
  // present verbatim inside rag/documents of the frozen corpus; nadra.gov.pk
  // also covers the visa.nadra.gov.pk subdomain via the endsWith rule).
  'nadra.gov.pk',
  'dgip.gov.pk',
  'ecp.gov.pk',
  'mohtasib.gov.pk',
  'scp.gov.pk',
  'fccp.gov.pk'
];

export function checkUrls(text) {
  const hits = [];
  const re = /https?:\/\/[^\s"'<>)\]]+/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const u = m[0].replace(/[.,;]+$/, '');
    let host = '';
    try { host = new URL(u).hostname.toLowerCase(); } catch { host = u.toLowerCase(); }
    const allowed = URL_ALLOWED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
    if (!allowed) hits.push(u);
  }
  return hits;
}
