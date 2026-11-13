/**
 * server/domainProfile.js — what the corpus itself says each domain is about,
 * and what role the words you used play in your own sentence.
 *
 * THE DEFECT THIS EXISTS TO KILL. Domain selection elsewhere is a first-match
 * keyword cascade: whichever rule fires first decides the legal topic, and the
 * evidence gate then certifies whatever that topic routes to. So
 * "bank ne meri salary account se without notice charges kat liye" was answered
 * as an employment dispute — "salary" fired a labour rule, labour records
 * carried the retrieval, and the answer was labelled verified — because a bag
 * of matched keywords says nothing about WHO DID WHAT TO WHOM, and because a
 * single keyword was allowed to outrank every other reading.
 *
 * Two ingredients, both DERIVED rather than hand-written, so they hold for all
 * 29 corpus domains and for documents added later:
 *
 * 1. DOMAIN VOCABULARY FROM THE DOCUMENTS. For each domain, the words its own
 *    registered documents actually use, weighted by how much of a word's corpus
 *    footprint sits inside that domain (exclusivity) times how rare the word is
 *    overall (IDF). "cheque" belongs to banking because banking owns the
 *    documents that say it; "salary" belongs nowhere on its own because it is
 *    spread across labour, tax and university records — which is exactly right,
 *    since "salary" in "salary account se charges kat liye" is context, not the
 *    dispute.
 *
 * 2. ROLE WEIGHTS FROM CASE MARKING. Roman Urdu and English both mark the parts
 *    of a dispute, and the marker says which noun the sentence is about: `ne` /
 *    "by" flags the actor, `ko` / "to" the party acted on, `se` / "from" the
 *    source or instrument, and the noun running into the verb is the object in
 *    dispute. Terms therefore enter the score with a role weight instead of
 *    counting equally.
 *
 * The output is a subject READING, not a verdict. When the reading is not
 * decisive — no leader, a thin lead, or only generic words — `asked` is empty
 * and callers must fall back to what they already do. This module never adds
 * evidence and never invents a topic.
 *
 * Vocabulary is cached in rag/metadata/domain_lexicon.json and rebuilt when the
 * manifest or a document file changes; it is derived data, not corpus content.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMAIN_DOCS } from './ragEngine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LEXICON_PATH = path.join(ROOT, 'rag', 'metadata', 'domain_lexicon.json');

/** Words that name no subject anywhere in the corpus or in a question. */
const STOP_TERMS = new Set([
  // English legal furniture and function words.
  'the', 'and', 'for', 'you', 'your', 'are', 'was', 'with', 'that', 'this', 'have',
  'has', 'what', 'when', 'where', 'which', 'from', 'about', 'will', 'would',
  'could', 'should', 'can', 'did', 'does', 'how', 'why', 'tell', 'please',
  'kindly', 'want', 'need', 'issue', 'problem', 'matter', 'thing', 'things',
  'something', 'anything', 'actually', 'given', 'hello', 'sir', 'madam',
  'against', 'according', 'provided', 'thereof', 'herein', 'under', 'before',
  'after', 'other', 'others', 'such', 'made', 'make', 'may', 'must', 'shall',
  'not', 'any', 'all', 'but', 'if', 'or', 'of', 'to', 'in', 'is', 'it', 'be',
  'as', 'at', 'by', 'on', 'my', 'me', 'his', 'her', 'their', 'our', 'they',
  'them', 'its', 'we', 'us', 'an', 'a', 'also', 'more', 'most', 'than',
  'then', 'so', 'too', 'very', 'much', 'many', 'well', 'still', 'just',
  'know', 'knows', 'said', 'says', 'say', 'see', 'whether', 'while', 'who',
  'whom', 'whose', 'because', 'since', 'during', 'within', 'without', 'upon',
  'each', 'every', 'both', 'same', 'different', 'new', 'old', 'used', 'using',
  'use', 'time', 'times', 'year', 'years', 'day', 'days', 'part', 'parts',
  'section', 'sections', 'article', 'articles', 'clause', 'clauses', 'sub',
  'act', 'acts', 'law', 'laws', 'legal', 'pakistan', 'pakistani', 'court',
  'courts', 'judge', 'judges', 'case', 'cases', 'order', 'orders', 'rule',
  'rules', 'regulation', 'regulations', 'provision', 'provisions',
  'amendment', 'amendments', 'government', 'provincial', 'federal',
  'province', 'district', 'public', 'person', 'persons', 'people', 'body',
  'bodies', 'authority', 'authorities', 'office', 'offices', 'department',
  'committee', 'board', 'member', 'members', 'power', 'powers', 'right',
  'rights', 'penalty', 'penalties', 'punishment', 'punishments', 'fine',
  'fines', 'offence', 'offences', 'offense', 'offenses', 'general',
  'special', 'important', 'following', 'following', 'first', 'second',
  'third', 'number', 'named', 'called', 'known', 'means', 'defined',
  'definition', 'definitions', 'application', 'applications', 'procedure',
  'procedures', 'process', 'steps', 'information', 'report', 'reports',
  'date', 'dates', 'period', 'amount', 'sum', 'total', 'example',
  'schedule', 'schedules', 'annex', 'chapter', 'chapters', 'title',
  'preamble', 'repeal', 'repeals', 'commencement', 'interpretation',
  'short', 'text', 'full', 'fulltext', 'index', 'page', 'pages', 'vol',
  'reported', 'judgment', 'judgments', 'decision', 'decisions', 'appeal',
  'appeals', 'reply', 'answer', 'question', 'questions', 'please', 'here',
  'there', 'wherever', 'however', 'therefore', 'further', 'although',
  'made_by', 'versus', 'vs', 'vs.', 'etc', 'page',
  // Roman Urdu grammar carries no legal content.
  'hai', 'hain', 'hein', 'tha', 'thi', 'the', 'thay', 'tha', 'ka', 'ki', 'ke',
  'ko', 'se', 'me', 'mein', 'main', 'mujhe', 'apna', 'apni', 'mera', 'meri',
  'tum', 'aap', 'aapko', 'bhi', 'jo', 'kya', 'kar', 'karo', 'karna', 'karne',
  'karta', 'karti', 'hota', 'hoti', 'hoon', 'hoga', 'hogi', 'ho', 'ya', 'aur',
  'lekin', 'liye', 'par', 'phir', 'ab', 'tab', 'yeh', 'wo', 'woh', 'is', 'us',
  'har', 'sab', 'kuch', 'nahi', 'nhi', 'nahin', 'haan', 'sahab', 'wala',
  'wale', 'wali', 'raha', 'rahi', 'rahe', 'diya', 'diya', 'kiya', 'karya',
  'karega', 'karegi', 'karega', 'bata', 'bataen', 'batayein', 'bataein',
  'sakta', 'sakti', 'chahiye', 'chahye', 'agar', 'kab', 'kahan', 'kaun',
  'kitna', 'kitni', 'kyun', 'kyunki', 'acha', 'achha', 'theek', 'masla',
  'mumkin', 'tara', 'tarah', 'trika', 'tareeqa', 'silisla', 'silsla', 'silsila',
  'awwal', 'doom', 'duem', 'teesra', 'baqi', 'baki', 'sirf', 'zo',
  // Urdu-script grammar.
  'ہے', 'ہیں', 'کا', 'کی', 'کے', 'کو', 'سے', 'میں', 'نے', 'بھی', 'اور', 'یا',
  'کرتا', 'کرتی', 'کرنا', 'کرنے', 'کیا', 'گیا', 'گئی', 'رہا', 'رہی', 'نہیں',
  'ہوا', 'ہوئی', 'جو', 'یہ', 'وہ', 'اپنا', 'اپنی', 'میرا', 'میری', 'آپ', 'تum'
]);

const MIN_TERM_LEN = 4;
/** A word must occur this many times inside a domain to cue it at all. */
const MIN_DOMAIN_OCCURRENCES = 2;
/** …and far more often there than the corpus average, or it cues nothing. */
const MIN_KEYNESS_RATIO = 1.6;
/** Ceiling: one freak ratio must not outweigh a domain's whole vocabulary. */
const MAX_KEYNESS_RATIO = 120;
/** Below this weight a word contributes no subject signal at all. */
const MIN_TERM_WEIGHT = 0.8;
/** Ask must beat this absolute score… */
const MIN_ASK_SCORE = 0.9;
/** …and lead the runner-up by this ratio, to count as a reading at all. */
const MIN_ASK_MARGIN = 1.4;

/**
 * Words that only state that the other side did not act. They name no case:
 * "refuses" is corpus vocabulary of tenancy, salary, consumer and police records
 * alike, so a question whose loudest word is one of these has no subject the gate
 * may hold records against — it would reject the records that answer it.
 */
export const GENERIC_RELATION_TERMS = new Set([
  'refuse', 'refused', 'refuses', 'refusing', 'refusal', 'deny', 'denies', 'denied', 'denial',
  'decline', 'declined', 'declining', 'reject', 'rejected', 'rejects', 'rejection',
  'ignore', 'ignored', 'ignoring', 'withhold', 'withholds', 'withheld', 'withholding',
  'fail', 'failed', 'fails', 'failing', 'failure', 'delay', 'delayed', 'delays', 'delaying',
  'default', 'defaulted', 'defaults', 'inkar', 'inkaar', 'inzkar'
]);

const ROLE_WEIGHT = {
  actor: 1.0, target: 1.0, object: 1.0, source: 0.45, modifier: 0.35, plain: 0.7
};

/** docId -> Set(domain), inverted from the engine's own routing table. */
export const docDomains = new Map();
for (const [domain, ids] of Object.entries(DOMAIN_DOCS || {})) {
  for (const id of ids || []) {
    if (!docDomains.has(id)) docDomains.set(id, new Set());
    docDomains.get(id).add(domain);
  }
}

/** domain -> Map(term -> weight). Built once, then cached. */
const domainWeights = new Map();
/** term -> Map(domain -> doc count), kept so callers can inspect a word. */
const termDomainDocs = new Map();
/** docId -> Set(informative terms in its own title), the heading check. */
const docTitleTerms = new Map();
let state = 'unbuilt';

function informativeTerms(text) {
  const out = new Set();
  for (const raw of String(text || '').toLowerCase().split(/[^a-z0-9'+\u0600-\u06FF-]+/)) {
    const t = raw.replace(/^['+-]+|['+-]+$/g, '');
    if (t.length < MIN_TERM_LEN) continue;
    if (STOP_TERMS.has(t)) continue;
    out.add(t);
  }
  return out;
}

function sourceStamp() {
  let manifest = '';
  try { manifest = String(fs.statSync(path.join(ROOT, 'rag', 'manifest.json')).mtimeMs); } catch { /* absent */ }
  const docs = [];
  try {
    for (const id of docDomains.keys()) {
      const p = docPathById.get(id);
      if (p && fs.existsSync(p)) docs.push(`${id}:${fs.statSync(p).size}:${fs.statSync(p).mtimeMs}`);
    }
  } catch { /* fall through to a rebuild */ }
  return `${manifest}|${docs.join(',')}`;
}

const docPathById = new Map();
(function readManifestPaths() {
  try {
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag', 'manifest.json'), 'utf8'));
    for (const d of man.documents || []) {
      if (d && d.id && d.localFilePath) {
        docPathById.set(d.id, path.resolve(ROOT, String(d.localFilePath).replace(/\\/g, '/')));
      }
    }
  } catch { /* the caller falls back to the in-process build */ }
}());

/**
 * The cache serialises each map as an ARRAY of [key, value] pairs (domain names
 * are not safe JSON object keys once a term contains a quote, and array order is
 * stable). Reading that back with Object.entries would hand out the array
 * INDICES as keys and destructure each [key, value] pair into single characters,
 * silently replacing every domain name with '0'…'28' — a profile that matches
 * nothing and therefore vetoes nothing. Both shapes are accepted here so a
 * hand-written object cache still loads.
 */
const asPairs = source => {
  if (Array.isArray(source)) return source;
  if (source && typeof source === 'object') return Object.entries(source);
  return [];
};

function applyWeights(rows) {
  domainWeights.clear();
  for (const [domain, terms] of asPairs(rows.domains)) {
    const m = new Map();
    for (const [term, w] of asPairs(terms)) {
      const k = String(term).toLowerCase();
      const n = Number(w);
      if (k.length && Number.isFinite(n)) m.set(k, n);
    }
    if (m.size) domainWeights.set(String(domain), m);
  }
  for (const [term, per] of asPairs(rows.termDomains)) {
    const m = new Map();
    for (const [domain, n] of asPairs(per)) {
      const c = Number(n);
      if (Number.isFinite(c)) m.set(String(domain), c);
    }
    if (m.size) termDomainDocs.set(String(term).toLowerCase(), m);
  }
  for (const [docId, terms] of asPairs(rows.titleTerms)) {
    docTitleTerms.set(String(docId), new Set((terms || []).map(t => String(t))));
  }
}

/**
 * Read the corpus's own documents and score every word for every domain.
 * weight = how much of a word's total corpus usage a domain owns (tfShare)
 * x how rare the word is overall (idf) x log support. Frequency, not mere
 * presence, is what makes this a subject reading: "theft" belongs to criminal
 * law because the PPC says it constantly, not to whichever single cyber
 * document happens to mention it once, and "salary" cues nothing on its own
 * because labour, tax and university records all use it.
 */
function buildFromDocuments() {
  const tfDomain = new Map();   // domain -> Map(term -> occurrences)
  const tokensDomain = new Map(); // domain -> total informative tokens
  const termTotal = new Map();  // term -> occurrences summed over domain credits
  const dfDomain = new Map();   // term -> Map(domain -> docCount)
  for (const [docId, domains] of docDomains) {
    const p = docPathById.get(docId);
    if (!p || !fs.existsSync(p)) continue;
    let text = '';
    try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
    const freq = termFrequencies(text);
    // A document registered under several domains is credited to each of them
    // in proportion 1/k, not in full: the Penal Code serves criminal, banking
    // and evidence, and crediting its whole text to each would make every one
    // of those three vocabularies the Penal Code's.
    const share = 1 / Math.max(1, domains.size);
    for (const [t, n] of freq) {
      const nShared = n * share;
      for (const d of domains) {
        if (!tfDomain.has(d)) { tfDomain.set(d, new Map()); tokensDomain.set(d, 0); }
        const m = tfDomain.get(d);
        m.set(t, (m.get(t) || 0) + nShared);
        tokensDomain.set(d, tokensDomain.get(d) + nShared);
        termTotal.set(t, (termTotal.get(t) || 0) + nShared);
        if (!dfDomain.has(t)) dfDomain.set(t, new Map());
        const per = dfDomain.get(t);
        per.set(d, (per.get(d) || 0) + 1);
      }
    }
    docTitleTerms.set(docId, titleTerms(text));
  }
  const totals = { tokens: 0 };
  for (const n of tokensDomain.values()) totals.tokens += n;
  const domainDocs = new Map();
  for (const [docId, domains] of docDomains) {
    if (!docPathById.has(docId)) continue;
    for (const d of domains) domainDocs.set(d, (domainDocs.get(d) || 0) + 1);
  }
  domainWeights.clear();
  termDomainDocs.clear();
  for (const [domain, freq] of tfDomain) {
    const total = tokensDomain.get(domain) || 1;
    const otherTokens = Math.max(1, totals.tokens - total);
    const m = new Map();
    for (const [t, n] of freq) {
      if (n < MIN_DOMAIN_OCCURRENCES) continue;
      // LEAVE-ONE-OUT specificity: how much more often this word occurs per
      // token inside this domain than in every other domain combined.
      // Comparing against the whole corpus instead lets the largest part of it
      // (case-law prose) define what "normal" is, so legal boilerplate
      // inherited from one shared document looks like a signature word of
      // every domain that lists it.
      const rateHere = n / total;
      // A word no other domain uses at all is the most specific word there
      // can be, so the elsewhere rate is floored at one hypothetical
      // occurrence rather than dropping the word for dividing by zero.
      const rateElse = Math.max(((termTotal.get(t) || n) - n) / otherTokens, 1 / otherTokens);
      const ratio = Math.min(rateHere / rateElse, MAX_KEYNESS_RATIO);
      if (ratio < MIN_KEYNESS_RATIO) continue;
      // Support is the share of the domain's OWN documents that use the word:
      // a word used by a few of this domain's documents at extraordinary rate
      // outranks a word every legal text repeats.
      const per = dfDomain.get(t);
      const coverage = per && domainDocs.get(domain)
        ? (per.get(domain) || 0) / domainDocs.get(domain) : 0;
      const w = Math.log(ratio) * (0.45 + 0.55 * Math.sqrt(coverage));
      if (w >= MIN_TERM_WEIGHT) m.set(t, w);
    }
    const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 900);
    domainWeights.set(domain, new Map(top));
  }
  for (const [t, per] of dfDomain) {
    const keep = new Map();
    for (const [domain, n] of per) if (domainWeights.get(domain) && domainWeights.get(domain).has(t)) keep.set(domain, n);
    if (keep.size) termDomainDocs.set(t, keep);
  }

  try {
    const rows = {
      stamp: sourceStamp(),
      generatedAt: new Date().toISOString(),
      totalDocs: docPathById.size || 1,
      domains: [...domainWeights.entries()].map(([d, m]) => [d, [...m.entries()]]),
      termDomains: [...termDomainDocs.entries()].map(([t, per]) => [t, [...per.entries()]]),
      titleTerms: [...docTitleTerms.entries()].map(([d, s]) => [d, [...s]])
    };
    fs.writeFileSync(LEXICON_PATH, JSON.stringify(rows));
  } catch { /* cache is an optimization; the in-memory profile still works */ }
  return true;
}

/** Informative terms with their occurrence counts in one document. */
function termFrequencies(text) {
  const freq = new Map();
  for (const raw of String(text).toLowerCase().split(/[^a-z0-9'+-]+/)) {
    const t = raw.replace(/^['+-]+|['+-]+$/g, '');
    if (t.length < MIN_TERM_LEN || STOP_TERMS.has(t)) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

/** Words from a document's own Title:/heading lines — its declared subject. */
function titleTerms(text) {
  const lines = String(text).split('\n').slice(0, 400)
    .filter(l => /^\s*(title|subject|chapter|heading|section)\s*[:.-]/i.test(l));
  const out = new Set();
  for (const l of lines) for (const t of informativeTerms(l)) out.add(t);
  return out;
}

function build() {
  if (state === 'ready') return true;
  if (state === 'failed') return false;
  state = 'ready';
  try {
    let fresh = false;
    if (fs.existsSync(LEXICON_PATH)) {
      try {
        const cached = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));
        if (cached && cached.stamp === sourceStamp()) { applyWeights(cached); return true; }
      } catch { /* corrupted cache: rebuild below */ }
    }
    return buildFromDocuments() || fresh;
  } catch {
    state = 'failed';
    return false;
  }
}

export function termDomainWeight(term, domain) {
  if (!build()) return 0;
  const m = domainWeights.get(domain);
  return m ? (m.get(String(term).toLowerCase()) || 0) : 0;
}

/** Every domain this word cues, strongest first. */
export function termDomains(term) {
  if (!build()) return [];
  const t = String(term).toLowerCase();
  const per = termDomainDocs.get(t);
  if (!per) return [];
  return [...per.entries()]
    .map(([domain, n]) => ({ domain, n, weight: termDomainWeight(t, domain) }))
    .filter(e => e.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

export function domainsOfDoc(docId) {
  return docDomains.get(docId) || new Set();
}

/**
 * Role weights from case marking. We read the sentence left to right; the
 * marker that comes AFTER a content word assigns that word its role, which is
 * how "bank ne" makes bank the actor and "account se" makes account the source.
 */
const MARKERS = [
  [/\bne\b/i, 'actor'],
  [/\bko\b/i, 'target'],
  [/\b(se|say)\b/i, 'source'],
  [/\b(ka|ki|ke|kunw)\b/i, 'modifier']
];
const EN_MARKERS = [
  [/\bby\b/i, 'actor'],
  [/\bfrom\b/i, 'source'],
  [/\bof\b/i, 'modifier'],
  [/\bto\b/i, 'target']
];

/** word -> role for the content words in a sentence. */
export function roleMapFromText(text) {
  const roles = new Map();
  const tokens = String(text || '').split(/\s+/);
  let pending = 'plain';
  let lastWord = null;
  for (const raw of tokens) {
    const clean = raw.toLowerCase().replace(/[^a-z0-9'+-]/g, '');
    const marker = [...MARKERS, ...EN_MARKERS].find(([re]) => re.test(raw));
    if (marker) {
      if (lastWord && !STOP_TERMS.has(lastWord)) {
        const prev = roles.get(lastWord);
        // The first relation a word is caught in wins; a word in two slots is
        // context, not a subject cue.
        if (!prev || prev === 'plain') roles.set(lastWord, marker[1]);
      }
      lastWord = null;
      pending = 'plain';
      continue;
    }
    if (!clean || STOP_TERMS.has(clean)) { lastWord = null; continue; }
    if (!roles.has(clean)) roles.set(clean, pending);
    lastWord = clean;
  }
  // The last content word before the end of a clause is the object in dispute
  // when the sentence ends on a verb ("… charges kat liye").
  return roles;
}

/**
 * Score the user's own words for which domains the corpus would file them
 * under.
 *
 * @param {Iterable<string>} terms the user's own informative words
 * @param {{text?: string, glosses?: Array<{source:string, forms:Iterable<string>}>}} [opts]
 *   `text` supplies the case markers; `glosses` carry dictionary translations of
 *   the user's own words (Roman Urdu / Urdu script) and inherit their role.
 */
export function analyzeSubject(terms, opts = {}) {
  const empty = { scores: [], asked: [], decisive: false, termWeights: [], top: null };
  if (!build()) return empty;
  const roles = roleMapFromText(opts.text || '');
  const termWeights = [];
  const seen = new Set();
  const push = (t, role) => {
    const k = String(t).toLowerCase();
    if (k.length < MIN_TERM_LEN || STOP_TERMS.has(k) || seen.has(k)) return;
    if (GENERIC_RELATION_TERMS.has(k)) return;
    seen.add(k);
    termWeights.push([k, ROLE_WEIGHT[role || roles.get(k) || 'plain'] ?? 0.7]);
  };
  for (const t of terms || []) push(t);
  for (const t of terms || []) {
    const k = String(t).toLowerCase();
    const g = (opts.glosses || []).find(x => x && x.source === k);
    if (!g) continue;
    for (const f of g.forms) push(f, roles.get(k) || 'plain');
  }

  const scoreBy = filter => {
    const byDomain = new Map();
    for (const [t, w] of termWeights) {
      if (!filter(w)) continue;
      const per = termDomainDocs.get(t);
      if (!per) continue;
      for (const [domain] of per) {
        const weight = termDomainWeight(t, domain);
        if (weight <= 0) continue;
        if (!byDomain.has(domain)) byDomain.set(domain, { domain, score: 0, terms: [] });
        const e = byDomain.get(domain);
        e.score += weight * w;
        e.terms.push(t);
      }
    }
    return [...byDomain.values()]
      .map(e => ({ domain: e.domain, score: Number(e.score.toFixed(3)), terms: [...new Set(e.terms)] }))
      .sort((a, b) => b.score - a.score);
  };
  // The ask is what the sentence puts in a doing or receiving slot. When the
  // sentence carries no case markers at all there is no context to set aside,
  // so every content word counts — the reading only gets narrower with more
  // information, never artificially empty.
  const hasRoles = termWeights.some(([, w]) => w >= 0.9);
  const core = scoreBy(hasRoles ? (w => w >= 0.9) : (w => w >= 0.7));
  const scores = scoreBy(() => true);

  const top = core[0] || null;
  const decisive = Boolean(top && top.score >= MIN_ASK_SCORE);
  const asked = decisive
    ? core.filter(s => s.score >= top.score * 0.5).map(s => s.domain)
    : [];
  return { scores, core, asked, decisive, termWeights, top, hasRoles };
}

/** Convenience for callers that only have the raw sentence. */
export function askedDomains(text, extraTerms = []) {
  return analyzeSubject([...informativeTerms(text), ...extraTerms], { text }).asked;
}

/**
 * Gate-facing check: does this record belong to the subject that was asked?
 *
 * Passes when the record's own domain is one of the asked domains, when its
 * own declared title carries one of the user's subject words with real corpus
 * weight (a national record that names the thing asked about is on-subject
 * whatever the router called it), or when the profile is not decisive.
 */
export function subjectCheck(chunk, subject) {
  if (!build() || !subject || !subject.decisive) return { checked: false, ok: true, why: 'undecisive' };
  const asked = new Set(subject.asked);
  const d = domainsOfDoc(chunk.docId);
  if (!d.size) {
    // Shared registries (situation-to-action, workflows) belong to no single
    // domain by construction, so the profile has no ground to call them another
    // subject's records. Measured on a Roman Urdu blackmail question: the
    // remedy record that answers it was discarded as off-subject merely because
    // its document is not listed under a domain, and the gate refused a question
    // the corpus does answer. Topical coverage still decides whether it is kept.
    return { checked: false, ok: true, why: 'unregistered' };
  }
  if ([...d].some(x => asked.has(x))) return { checked: true, ok: true, why: 'domain' };
  const titles = docTitleTerms.get(chunk.docId) || new Set();
  const heads = new Set([...(chunk.chunkTitle ? informativeTerms(chunk.chunkTitle) : []), ...titles]);
  const coreBar = subject.hasRoles ? 0.9 : 0.7;
  let best = null;
  for (const [t, w] of subject.termWeights) {
    if (w < coreBar || !heads.has(t)) continue;
    let weight = 0;
    for (const domain of (d.size ? d : ['_'])) weight = Math.max(weight, termDomainWeight(t, domain));
    if (weight > 0 && (!best || weight > best.weight)) best = { term: t, weight };
  }
  if (best) return { checked: true, ok: true, why: 'title', term: best.term };
  return { checked: true, ok: false, why: 'off-subject', asked: subject.asked };
}

/** Retry vocabulary: the corpus's own words for the domain that was asked. */
export function domainSubjectTerms(domain, limit = 6) {
  if (!build()) return [];
  const m = domainWeights.get(domain);
  if (!m) return [];
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(e => e[0]);
}

export function profileStats() {
  build();
  return {
    domains: domainWeights.size,
    terms: termDomainDocs.size,
    docs: docTitleTerms.size,
    lexiconPath: LEXICON_PATH,
    perDomain: [...domainWeights.entries()].map(([d, m]) => ({
      domain: d, terms: m.size,
      top: [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0])
    }))
  };
}
