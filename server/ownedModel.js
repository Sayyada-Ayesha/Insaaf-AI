// ============================================================================
// INSAaf OWNED-MODEL INFERENCE  (Part C / AC / AD)
// ----------------------------------------------------------------------------
// This is INSAaf AI's OWN local legal-reasoning engine. It is the runtime's only
// inference path — there is no external-provider mode to fall back to.
// It performs NO network calls and NEVER fabricates: every line it emits is
// assembled from (a) the user's own question and (b) fields of chunks that were
// actually retrieved from the verified Pakistani law corpus (rag_index.json).
//
// For legal-PROBLEM questions it composes the professional guidance model
// (Part D / rule 11): Issue -> Law that may apply -> What the law says ->
// Procedure / what to do -> Remedy -> Precedent -> Jurisdiction/forum ->
// Source -> Limitation. Only sections with real grounding are included, and
// predictions are always hedged ("may", "depending on the facts and evidence").
// ============================================================================

import { parseOverseasIntent } from './ragEngine.js';
import { ANSWER_LEVELS, normalizeAnswerLevel, evidenceNoteText } from './evidenceGate.js';
import {
  deriveChunkScope, scopeLabel, applicabilityNote, missingScopeMessage,
  scopeLayerName, detectQueryScope
} from './corpusScope.js';

const EN = {
  issue: 'Issue',
  answer: 'Answer',
  law: 'Law that may apply',
  says: 'What the law says',
  procedure: 'What to do / procedure',
  fees: 'Published fee schedule',
  remedy: 'Possible remedy',
  precedent: 'Relevant precedent',
  forum: 'Jurisdiction / forum',
  source: 'Source',
  evidence: 'How strongly this is grounded',
  exceptions: 'Exceptions and nuances',
  limit: 'Important limitation',
  limitText: 'This is general legal information assembled from the verified Pakistani law corpus, not a substitute for advice from a licensed advocate. How a case proceeds and its outcome depend on the specific facts, the evidence, and the court. If a deadline or an appearance date is involved, act promptly and confirm with a lawyer or the relevant court/office.',
  provision: (type, key) => `${type === 'ARTICLE' ? 'Article' : 'Section'} ${key}`,
  statusNote: (s) => (s && String(s).toLowerCase() !== 'in force' ? ` — status: ${s}` : '')
};

const ROMAN = {
  issue: 'Masla',
  answer: 'Jawab',
  law: 'Laagu hone wala qanoon',
  says: 'Qanoon kya kehta hai',
  procedure: 'Kya karna chahiye / tareeqa',
  remedy: 'Mumkina tadaruk',
  precedent: 'Mutaliqa misali faisla',
  forum: 'Jurisdiction / forum',
  source: 'Makhaz',
  evidence: 'Yeh kitne mazboot record par hai',
  exceptions: 'Istisnat aur nuqsaat',
  limit: 'Zaroori tahaffuz',
  limitText: 'Ye verified Pakistani qanooni zakhire se li gayi aam qanooni maloomat hai, kisi licensed wakeel ke mashware ka mutabadil nahi. Muqadma kaise aage barhta hai aur us ka natija aap ke khais haqaiq, shawahid aur adalat par munhasir hai. Agar koi deadline ya peshi ki tareekh shamil hai to fori qadam uthayein aur wakeel ya mutaliqa adalat/office se tasdeeq karein.',
  provision: (type, key) => `${type === 'ARTICLE' ? 'Article' : 'Section'} ${key}`,
  statusNote: (s) => (s && String(s).toLowerCase() !== 'in force' ? ` — halat: ${s}` : '')
};

// First N non-empty paragraphs, so we never truncate mid-sentence.
function leadParagraphs(text, maxParas = 3, maxChars = 900) {
  const paras = String(text || '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  let out = [];
  let len = 0;
  for (const p of paras) {
    if (out.length >= maxParas) break;
    if (len + p.length > maxChars && out.length > 0) break;
    out.push(p);
    len += p.length;
  }
  if (out.length === 0 && paras[0]) out = [paras[0].slice(0, maxChars)];
  return out.join('\n\n');
}

function categorize(chunks) {
  const provisions = [], procedures = [], remedies = [], precedents = [], topics = [];
  for (const c of chunks || []) {
    const k = String(c.key || '');
    const ct = String(c.chunkTitle || '');
    const dt = String(c.documentType || '');
    if (/^case_/i.test(k) || /judg|case[_ ]?law|precedent/i.test(dt) || /\bv\.?s?\.?\b/i.test(ct)) precedents.push(c);
    else if (/PROCEDURE|WORKFLOW|_STAGES|_PROCESS|MARAHIL/i.test(k)) procedures.push(c);
    else if (/REMEDY|RELIEF|TADARUK/i.test(k)) remedies.push(c);
    else if (/^\d+[a-z]*$/i.test(k) || /^ORDER_/i.test(k)) provisions.push(c);
    else topics.push(c);
  }
  return { provisions, procedures, remedies, precedents, topics };
}

const QUERY_STOP = new Set(('the a an and or of to in for on with is are was be what which how why when who whom whose can could should would do does did not no my me i you your our we they it this that these those about from as at by if into over under very much many more most all any some there here then than who\'s let make makes please tell explain define meaning used use works work ka ke ki ko mein main hai hain ho hota hoti kar karna kare karon karta karti raha rahe diya diya kya kis kon sa liye par se tak bhi hi awara').split(/\s+/));

/**
 * Forensic boilerplate: every judgment and every statute carries these words, so
 * agreeing on them says nothing about what a record is ABOUT. Two of them ("court"
 * and "Punjab") were enough to quote a 2026 Lahore High Court writ petition inside
 * an answer about Asma Jilani v. Government of Punjab.
 */
const BOILERPLATE_TERMS = new Set(('court courts supreme high honble judge judges judgment judgement order orders case cases law laws legal act acts section sections article articles subsection rule rules regulation petition petitions petitioner petitioners respondent respondents appellant applicants applicant plaintiff defendant counsel advocate learned decision decisions decided decide decide appeal appeals revision review constitution constitutional government province provincial state rules plaintiff government petitioner pltf').split(/\s+/));

/** How many of the question's own words this record actually carries. */
function queryTermHits(query, chunk) {
  const words = new Set((String(query || '').toLowerCase().match(/[a-z']{3,}/g) || [])
    .filter(w => !QUERY_STOP.has(w) && !BOILERPLATE_TERMS.has(w)));
  if (!words.size || !chunk) return 0;
  // The WHOLE record, not its first 900 characters. A rule stated further down a
  // long record was invisible here, so the drug-abuse clause of a 3,828-character
  // welfare record outranked "Student Right to Appeal Disciplinary Decisions" for
  // a suspension-appeal question. Hits count DISTINCT query words, so a longer
  // scan cannot inflate a record the way raw term frequency would.
  const hay = `${chunk.chunkTitle || ''} ${chunk.title || ''} ${String(chunk.text || '').slice(0, 6000)}`.toLowerCase();
  let hits = 0;
  for (const w of words) if (hay.includes(w)) hits++;
  return hits;
}

function stemTerm(w) {
  return w.length > 4 ? w.replace(/s$/, '') : w;
}

/**
 * A record's own identity: its section key and heading. `chunk.title` is the
 * DOCUMENT title, shared by every chunk of that file, so it cannot tell a rules
 * register from a scholarship list sitting in the same corpus file — and the
 * distinguishing words of such questions are boilerplate-filtered away.
 */
function ownIdentityHits(query, chunk) {
  const raw = `${String(chunk?.key || '').replace(/_/g, ' ')} ${chunk?.chunkTitle || ''}`.toLowerCase();
  const own = new Set((raw.match(/[a-z']{3,}/g) || []).filter(w => !QUERY_STOP.has(w)).map(stemTerm));
  if (!own.size) return 0;
  const words = new Set((String(query || '').toLowerCase().match(/[a-z']{3,}/g) || [])
    .filter(w => !QUERY_STOP.has(w)).map(stemTerm));
  let hits = 0;
  for (const w of own) if (words.has(w)) hits++;
  return hits;
}

/**
 * Records that carry the user's OWN words rank above records that merely scored.
 * A heading match alone is not enough: inside one institution's document family
 * every heading repeats that institution's name, so heading overlap degenerates
 * into "whoever printed the generic noun first". Measured on 2026-10-18 for
 * "How do I apply for re-checking of results at GCU Hyderabad and what is the
 * fee?": the only record that carries re-checking, results and the office to
 * apply to scored own=2/hits=5 and was ranked 5th behind admission-cancellation
 * records at own=3/hits=3, so the answer quoted a fee-refund route for a
 * results-rechecking question. Totaling both signals keeps a heading match
 * decisive when it is genuinely distinctive, and lets body content carry the
 * record whose heading happens to be terse. Nothing is added, dropped or
 * re-scored — only the order within the records retrieval already returned.
 */
function rankRecords(query, chunks) {
  const words = new Set((String(query || '').toLowerCase().match(/[a-z']{3,}/g) || [])
    .filter(w => !QUERY_STOP.has(w)));
  if (!words.size) return [...(chunks || [])];
  const scored = (chunks || []).map((c, i) => {
    const own = ownIdentityHits(query, c);
    return { c, i, s: own + queryTermHits(query, c), own };
  });
  return scored.sort((a, b) => b.s - a.s || b.own - a.own || a.i - b.i).map(s => s.c);
}

/**
 * The national HEC policies each live in ONE document, so naming the family is
 * enough to stop a campus-security clause answering a harassment question or a
 * degree-attestation page answering a recognition question. Nothing is deleted and
 * no score is changed: a record outside the family simply yields its place while a
 * family record exists. Within the family, the clause carrying the operative rule
 * (a percentage, a number of days, an eligibility test) comes first when the
 * question asked for exactly that. A question naming one institution stands the
 * reorder down, because its own published terms outrank the national frame.
 */
const POLICY_FAMILIES = [
  {
    id: 'harassment',
    test: /harassment|unwelcome sexual|mohtasib|inquiry committee/i,
    docs: ['hec_harassment_policy'],
    operative: /complaint|inquiry committee|deadline|within\s+\d+\s+day|proceedings|workplace/i,
  },
  {
    id: 'disability',
    test: /disabilit|disabled|accessib|accommodat/i,
    docs: ['hec_student_welfare_policies'],
    operative: /disabilit|disabled|accessib|accommodat|ramp|braille|sign language|assistive/i,
  },
  {
    id: 'recognition',
    test: /recogni[sz]ed|recogni[sz]ation|recogni[sz]e\b|chartered|list of universities|verify.{0,40}universit|affiliated institution/i,
    docs: ['hec_institution_recognition', 'hec_degree_recognition'],
    operative: /recognit|charter|establish|campus|affiliate/i,
  },
  {
    id: 'refund',
    test: /refund/i,
    docs: ['hec_fee_refund_policy'],
    operative: /%|per\s?cent|\bday[s]?\b|deduct|cancell|withdraw/i,
  },
  {
    id: 'nbs',
    test: /need[- ]based|means[- ]test/i,
    docs: ['hec_student_support_programs', 'edu_scholarships'],
    operative: /eligib|income|domicile|cgpa|apply|application|documents required/i,
    // A generic need-based question is not an invitation to answer with one named
    // scheme: ASIP, ELT, Ehsaas and USAID records each carry their own eligibility,
    // and quoting one of them states a rule for a programme nobody asked about.
    mustMatch: /need[- ]based|means[- ]test/i,
    exclude: /\bASIP\b|ELT scholarship|indigenous elt|ehsaas|usaid|scholarship programme for|pakistan scholar/i,
  },
  {
    // Measured 2026-11-01: a ragging complaint was answered from hostel-allotment
    // procedure and a suspension appeal from the drug-abuse clause of a welfare
    // record — both live in the same two documents as the rule that applies, and
    // both scored on "student"/"university". Naming the family and requiring the
    // operative words keeps the clause that actually states the prohibition.
    id: 'discipline',
    test: /ragging|ragged|haz(?:e|ed|ing)|suspend|expel|discontinue|show.?cause|disciplinary|misconduct/i,
    docs: ['edu_discipline_grievance', 'edu_hostel'],
    operative: /ragging|ragged|haz(?:e|ed|ing)|suspend|expel|discontinue|show.?cause|appeal|due process|inquiry committee|prohibition/i,
  },
  {
    id: 'transcript',
    test: /transcript|mark ?sheet|result card|degree certificate|provisional certificate|bonafide certificate/i,
    docs: ['edu_academic_rules', 'edu_examination'],
    operative: /transcript|mark ?sheet|result card|provisional certificate|bonafide|withhold|withheld|not\s+(?:be\s+)?issued|fee/i,
  },
];

function policyFamilyOrder(query, records) {
  const pool = (records || []).slice();
  const fam = POLICY_FAMILIES.find(f => f.test.test(String(query || '')));
  if (!fam || pool.length < 2) return pool;
  const asked = detectQueryScope(query);
  if (asked && asked.institutionNamed) {
    const who = String(asked.institutionNamed).toLowerCase();
    if (pool.some(c => String(`${c.title || ''} ${c.chunkTitle || ''} ${c.text || ''}`).toLowerCase().includes(who))) return pool;
  }
  const inDoc = (c) => fam.docs.includes(String(c.docId));
  const isFam = (c) => inDoc(c) && (!fam.mustMatch || fam.mustMatch.test(String(`${c.chunkTitle || ''} ${c.text || ''}`)));
  const inFam = pool.filter(isFam);
  if (!inFam.length) return pool;
  let head = inFam;
  if (fam.operative.test(String(query || ''))) {
    const hit = inFam.filter(c => fam.operative.test(String(c.text || '')));
    if (hit.length) head = [...hit, ...inFam.filter(c => !hit.includes(c))];
  }
  const tail = pool.filter(c => !isFam(c));
  const rest = fam.exclude
    ? tail.filter(c => !(inDoc(c) && fam.exclude.test(String(`${c.chunkTitle || ''} ${c.text || ''}`))))
    : tail;
  return [...head, ...rest];
}

/**
 * A corpus FILE holds several distinct records — the Sindh HEC file carries both
 * the rules register and the scholarship criteria list. Once one of them has
 * answered, a sibling from the same file that carries FEWER of the question's own
 * words is a different topic, not additional support: generic overlap ("Sindh",
 * "commission") is shared by every record in that file and cannot say the
 * sibling is about what was asked. Records from other files are untouched.
 */
function siblingOffTopic(candidate, answerRecord, query) {
  if (!candidate || !answerRecord || candidate === answerRecord) return false;
  if (candidate.docId !== answerRecord.docId) return false;
  return ownIdentityHits(query, candidate) < ownIdentityHits(query, answerRecord);
}

/**
 * Quoted evidence must belong to the jurisdiction being answered. A Pakistan-wide
 * record may still appear as the national LAYER in "Law that may apply", labelled
 * as such, but pasting its text under a Sindh answer reads as Sindh law.
 */
function sameJurisdiction(a, b) {
  const j = (r) => String(r?.jurisdiction || '').trim().toLowerCase();
  const x = j(a); const y = j(b);
  return !x || !y || x === y;
}

// ---------------------------------------------------------------------------
// Service affinity. One government service per record in the civic corpus, and
// every record shares the vocabulary a citizen uses ("documents", "apply",
// "office", "fee"), so word overlap alone let a CNIC question be answered from
// the passport procedure. Each record names the service it is about in its own
// section key and section title, so a record tagged to a service the question
// did NOT ask about is dropped. Untagged records always survive: this filter
// only ever removes a mismatch, never the answer itself.
// ---------------------------------------------------------------------------
const SERVICES = [
  { id: 'passport', q: /passport|pasport|پاسپورٹ/i, r: /passport|pasport|dgip/i },
  { id: 'nicop', q: /\bnicop\b|\bpoc\b|overseas pakistan/i, r: /nicop|overseas pakistan|\bpoc\b|proof of citizenship/i },
  { id: 'cnic', q: /\bcnic\b|smart ?card|identity card|شناختی کارڈ|cnicf/i, r: /\bcnic\b|identity card|identity document|cnicf/i },
  { id: 'b-form', q: /b-?form|\bcrc\b|child registration|birth certificate|پیدوار/i, r: /b-?form|child registration|birth (?:registration|certificate)/i },
  { id: 'frc', q: /\bfrc\b|family registration certificate/i, r: /\bfrc\b|family registration/i },
  { id: 'domicile', q: /domicile/i, r: /domicile/i },
  { id: 'voter', q: /voter|electoral|voting/i, r: /voter|electoral/i },
  { id: 'licence', q: /driving (?:licence|license)|learner/i, r: /driving (?:licence|license)/i },
  // BISP's own programme records are untagged by the rules above, yet they reuse
  // the same civic wording ("documents", "heir", "bank", "verification"), so a
  // passport question used to list a Kafaalat record in its answer.
  { id: 'bisp', q: /\bbisp\b|8171|kafaalat|kifalat|nashonuma|\bnser\b|taleemi wazaif|benazir|proxy means test|بینظیر|کفالت|نشونما|تعلیمی\s*وظائف|بیسپ/i,
    r: /\bbisp\b|8171|kafaalat|kifalat|nashonuma|\bnser\b|taleemi wazaif|benazir|proxy means test|بینظیر|کفالت|نشونما/i }
];

function matchedServices(text, field) {
  const s = String(text || '');
  const out = new Set();
  for (const svc of SERVICES) if (svc[field].test(s)) out.add(svc.id);
  return out;
}

/** The service(s) THIS question names. A question that names more than three is
 *  not asking about one service, so nothing gets filtered. */
function askedServiceSet(query) {
  const asked = matchedServices(query, 'q');
  return asked.size > 3 ? new Set() : asked;
}

/** The service(s) a record is about — its own section key and section title,
 *  never the document title, which lists every service in the file. */
function recordServiceSet(chunk) {
  if (!chunk) return new Set();
  const a = matchedServices(`${chunk.key || ''} ${chunk.chunkTitle || ''}`, 'r');
  return a;
}

function scopePoolToServices(pool, asked) {
  if (!asked || !asked.size) return pool;
  const tagged = (pool || []).filter(c => recordServiceSet(c).size);
  if (!tagged.length) return pool;
  const kept = (pool || []).filter(c => {
    const mine = recordServiceSet(c);
    if (!mine.size) return true;
    for (const s of mine) if (asked.has(s)) return true;
    return false;
  });
  return kept.length ? kept : pool;
}

const SOURCE_URL_LINE = /^\s*source\s*url\s*:\s*(https?:\/\/\S+)[\s,]*$/im;

/** A record's own stated source address where it carries one. The manifest holds
 *  ONE url per document, while a civic/procedure document holds many services —
 *  so every record of that file, the passport one included, inherited the NADRA
 *  NICOP address. The line inside the record describes the record. */
function recordSourceUrl(chunk) {
  const own = String(chunk?.text || '').match(SOURCE_URL_LINE);
  return (own && own[1]) || String(chunk?.sourceURL || '');
}

const URL_SERVICES = [
  { id: 'passport', re: /passport/i },
  { id: 'nicop', re: /nicop/i },
  { id: 'b-form', re: /birth|crc|bform|b-form/i },
  { id: 'domicile', re: /domicile/i },
  { id: 'voter', re: /voter|election/i },
  { id: 'licence', re: /driving|license|licence/i }
];

function urlServiceSet(url) {
  const s = String(url || '').toLowerCase();
  const out = new Set();
  for (const svc of URL_SERVICES) if (svc.re.test(s)) out.add(svc.id);
  return out;
}

/** The citation for a record: its own address, and where that address belongs to
 *  a different service than the one asked, the same authority's portal root —
 *  never another service's page, and never no source at all. */
function recordSource(chunk, asked) {
  const url = recordSourceUrl(chunk);
  if (!url || !asked || !asked.size) return url;
  const tag = urlServiceSet(url);
  if (!tag.size) return url;
  for (const s of tag) if (asked.has(s)) return url;
  try { return new URL(url).origin; } catch { return url; }
}
/** The authority a record names for ITSELF. The manifest carries one
 *  issuingAuthority per document, so a civic record reported the whole list
 *  "NADRA/DGIP/ECP/Mohtasib/FIA" — including agencies the quoted record has
 *  nothing to do with. The record's own Authority/Source line is the truthful
 *  attribution. */
const RECORD_AUTH_LINE = /^\s*(?:authority|issuing authority)\s*:\s*(.+)$/im;
const RECORD_SOURCE_LINE = /^\s*source\s*:\s*(.+)$/im;
function recordAuthority(chunk) {
  const fallback = String(chunk?.issuingAuthority || '');
  const isGuide = /guide|digest|workflow|handbook|manual|directory/i.test(String(chunk?.documentType || ''));
  if (!isGuide) return fallback;
  const text = String(chunk?.text || '');
  const own = text.match(RECORD_AUTH_LINE) || text.match(RECORD_SOURCE_LINE);
  const line = own && own[1] ? own[1].replace(/\s*[—-]\s*(?:the\s+)?official\s+(?:portal|website|site)\s*$/i, '').trim() : '';
  return line || fallback;
}
export { askedServiceSet, recordServiceSet, scopePoolToServices, recordSourceUrl, recordSource, recordAuthority };

const META_LINE_RE = /^\s*(?:title|institution|authority|jurisdiction|document[\s-]*type|reference[\s-]*(?:number|no)|ref[\s-]*no|publication[\s-]*date|effective[\s-]*date|stated[\s-]*deadline|retrieval[\s-]*date|extraction[\s-]*method|verification[\s-]*status|official[\s-]*page|source[\s-]*file|version|section|notification[\s-]*\/[\s-]*publication[\s-]*date|extracted[\s-]*verbatim|source(?:\s*url(?:s)?)?|legal[\s-]*status|status|applicability|territory|applicable[\s-]*law)\s*:/i;
const SECTION_LABEL_RE = /^\s*(?:overview|key provisions|provisions|summary|text|procedure|steps|note|coverage)(?:\s*\([^)]*\))?\s*:?\s*$/i;
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');

/**
 * A record title as the corpus authors it carries internal plumbing — "LAW:" labels
 * and coverage annotations (". COVERAGE: PARTIAL.") that describe how the corpus is
 * organised rather than what the law says. Neither belongs in a reader's answer.
 */
function displayTitle(raw) {
  return String(raw || '')
    .replace(/^\s*(?:laws?|title)\s*:\s*/i, '')
    .replace(/\s*[.—-]?\s*coverage\s*:[\s\S]*$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export { displayTitle };

/** A line of corpus plumbing — record metadata or a coverage annotation — not law text. */
function isCorpusMetaLine(line) {
  const l = String(line || '');
  return META_LINE_RE.test(l) || /^\s*coverage\s*:/i.test(l) || /COVERAGE\s*:/.test(l)
    || /^\s*(?:extracted verbatim|only layout was repaired|retrieved from the official|this (?:page|record) was (?:retrieved|extracted))/i.test(l.trim());
}
export { isCorpusMetaLine };
export { queryTermHits, rankRecords, policyFamilyOrder };

/**
 * What THIS record says, in its own words: its metadata header and any line that
 * only repeats its title are dropped, so the answer quotes the provision rather
 * than describing the topic it belongs to. Returns '' when the record has no
 * substantive body text — the caller then says nothing instead of inventing it.
 */
function recordBody(chunk) {
  const raw = String((chunk && chunk.text) || '');
  if (!raw.trim()) return '';
  const title = norm(chunk.chunkTitle || chunk.title);
  const all = raw.split('\n').map(l => l.trim()).filter(Boolean)
    .filter(l => !isCorpusMetaLine(l) && !SECTION_LABEL_RE.test(l) && !isFeeRowLine(l))
    .map(l => l.replace(/^[-*•]\s+/, ''));
  if (!all.length) return '';
  // Summary records store the provision itself in their title and repeat it as
  // their only body line — there, the title IS the content, so keep it.
  let lines = all.filter(l => !(title && norm(l) === title));
  if (!lines.length) lines = all;
  const bullets = lines.filter(l => /^(\d+[.)]\s+|[-*•]\s+)/.test(l));
  return (bullets.length >= 2 ? bullets : lines)
    .map(l => l.replace(/^(\d+[.)]|[-*•])\s+/, ''))
    .join(' ');
}

/**
 * The part of a record that answers THIS question. A record can run to several
 * unrelated sections, and printing its opening sentences let a ragging complaint
 * be answered with scholarship-eligibility text, a suspension appeal with a
 * campus drug-abuse clause and a fee-refund question with a fee-table fragment.
 * When the opening carries none of the question's own subject words, return the
 * sentences of the SAME record that carry at least two of them — the topical
 * floor this codebase already uses. '' means "the opening is fine" or "this
 * record does not address the ask"; it never reaches outside the record.
 */
function onTopicWindow(body, query, maxSentences = 2) {
  const words = [...new Set((String(query || '').toLowerCase().match(/[a-z']{4,}/g) || [])
    .filter(w => !QUERY_STOP.has(w) && !BOILERPLATE_TERMS.has(w)))];
  if (!words.length) return '';
  const parts = String(body || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length < 3) return '';
  const scoreOf = (s) => {
    const l = s.toLowerCase();
    let n = 0;
    for (const w of words) if (l.includes(w)) n++;
    return n;
  };
  if (scoreOf(parts[0]) > 0) return '';
  let best = -1;
  let bestScore = 0;
  parts.forEach((p, i) => {
    const s = scoreOf(p);
    if (s > bestScore) { bestScore = s; best = i; }
  });
  if (best < 1 || bestScore < 2) return '';
  return parts.slice(best, best + Math.max(1, maxSentences)).join(' ');
}

function recordLead(chunk, maxSentences = 2, maxChars = 520, query = null) {
  const body = recordBody(chunk);
  if (body.replace(/[^A-Za-z\u0600-\u06FF]/g, '').length < 45) return '';
  const windowed = query ? onTopicWindow(body, query, maxSentences) : '';
  return clipSentences(windowed || body, maxSentences, maxChars);
}

/** What the SAME record says after the part already quoted — a record is only
 *  finished with once it has nothing left to give. */
function recordContinuation(chunk, shown, maxSentences = 2, maxChars = 520) {
  const body = recordBody(chunk);
  if (!body) return '';
  const parts = body.split(/(?<=[.!?])\s+/).filter(Boolean);
  const shownNorm = norm(shown);
  let start = 0;
  while (start < parts.length && shownNorm.includes(norm(parts[start]))) start++;
  const rest = parts.slice(start).join(' ');
  if (rest.replace(/[^A-Za-z\u0600-\u06FF]/g, '').length < 45) return '';
  return clipSentences(rest, maxSentences, maxChars);
}

// A Roman Urdu answer explains in Roman Urdu. Where it quotes the corpus it
// quotes the clause that carries the rule, not the paragraph it sits in.
const ROMAN_QUOTE_CHARS = 220;

/** Compact record citation: its own name and issuing authority, never a dump of
 *  its metadata lines or English body text. Used by the Roman remedy/precedent
 *  sections, where the identity of the record is what the reader needs. */
function romanRecordLine(chunk) {
  const title = String((chunk && (chunk.chunkTitle || chunk.title)) || '').replace(/^title:\s*/i, '').trim();
  if (!title) return '';
  const authority = /^\s*authority\s*:\s*(.+)$/im.exec(String((chunk && chunk.text) || ''));
  const status = /^\s*legal status\s*:\s*(.+)$/im.exec(String((chunk && chunk.text) || ''));
  return [`"${title}"`, authority ? authority[1].trim() : '', status ? status[1].trim() : '']
    .filter(Boolean).join(' — ');
}

/**
 * PART 2 — the shape follows the detected intent. A legal PROBLEM gets the full
 * professional ladder; a plain "what is X" question gets the answer, the record
 * that states it and its source. A heading is only ever emitted when the
 * retrieved evidence has something to put under it.
 */
const PROBLEM_INTENTS = new Set(['police-fir', 'recovery', 'property', 'family', 'bail',
  'consumer', 'legal-notice', 'injunction', 'guardianship', 'certificate-noc',
  'civic-document', 'fee-scholarship', 'admission', 'discipline', 'examination',
  'hostel', 'complaint-appeal', 'harassment', 'how-to']);

/**
 * Explicit depth request in the user's own words, in any of the three scripts
 * the product accepts. A style request is not evidence and not a legal fact: it
 * only decides how much of the verified record set to show.
 */
export function detectAnswerStyle(userQuery) {
  const q = String(userQuery || '');
  const SHORT = /\b(short|brief|concise|one.?line|quick answer|answer only|only (?:the )?answer|no (?:long |lengthy )?(?:detail|details|explanation)|don'?t explain|keep it short)\b/i
    .test(q)
    || /\b(mukhtasar|mukhtasir|sirf jawab|sirf (?:ek )?jawab|chota jawab|lambi tafseel|tafseel nahi|tafseel ki zaroorat nahi)\b/i.test(q)
    || /(مختصر|صرف\s*جواب|لمبی\s*تفصیل|تفصیل\s*نہیں)/.test(q);
  if (SHORT) return 'short';
  const DETAIL = /\b(detail|detailed|in depth|in-depth|full (?:detail|explanation)|with (?:references|citations|sources)|explain fully|tafseel ke sath|tafseeli|tafseel se)\b/i.test(q)
    || /\b(hawalon|hawala|hawalay|hawale|references?)\b/i.test(q)
    || /(تفصیلی|تفصیل\s*کے\s*ساتھ|حوالوں|حوالہ)/.test(q);
  if (DETAIL) return 'detail';
  return null;
}

function answerPlan(intent, isProblem, hasProcedure, hasProvision, hasRecord = false) {
  const sections = new Set(['issue', 'answer', 'says', 'source', 'limit']);
  if (hasProvision || (isProblem && hasRecord)) sections.add('law');
  if (hasProcedure) sections.add('procedure');
  if (isProblem || PROBLEM_INTENTS.has(intent)) {
    sections.add('procedure');
    for (const s of ['remedy', 'precedent', 'forum', 'exceptions', 'evidence']) sections.add(s);
  }
  return sections;
}

// A legal-PROBLEM / advice question (as opposed to a pure citation lookup or a
// one-line definition). Used to decide when the full guidance model is helpful.
export function isLegalProblemQuery(userQuery) {
  const s = String(userQuery || '').toLowerCase().trim();
  if (!s) return false;
  // Pure citation lookups are handled earlier by the direct-response path.
  if (/^(what is|what does|define|meaning of|kya hai|kya hota|def\b)/.test(s) && !/\b(my|mera|meri|mujhe|i want|i need|how do i|how can i|what should)\b/.test(s)) return false;
  // Urdu script legal-problem terms (میرے = my, میری = my, حقوق = rights, شکایت = complaint,
  // مدعی = plaintiff, مسئلہ = problem, قانون = law, انصاف = justice, عدالت = court, etc.)
  if (/[\u0600-\u06FF]/.test(s) && /میر[ےی]|حقوق|شکایت|مدعی|مسئل[ہه]|قانون|انصاف|عدالت|وکیل|بھرتی|اخراج|وظیف[ہه]|فیس|پنالتی|disciplin|ہراساں|تعدی/.test(s)) return true;
  return /\b(what should i do|what can i do|what do i do|how do i|how can i|how to|can i\b|could i\b|is it legal|illegal|unlawful|unfair|wrongful|wrongfully|refus|denied|deny|not paying|won'?t pay|no pay|breach|dispute|evict|harass|threat|recover|get back|get my|stop him|stop her|take action|file a case|sue\b|remedy|relief|help me|my landlord|my employer|my husband|my wife|police (?:is|has|not|refus)|mera|meri|mujhe|humari|humare)\b/.test(s)
    || /\bwhat are (?:the |my )?(?:rights|options|duties|obligations|responsibilities)\b/i.test(s)
    || /\b(expel|expulsion|suspension|dismiss|termination|fired|terminated|fee refund|scholarship|admission cancel|hostel|discipline|show.cause|ragging|probation)\b/i.test(s);
}

// Query-intent detection: classifies the user's question into a category so we
// can build a plain-language answer from chunk metadata rather than dumping
// raw corpus text.
function detectQueryIntent(query, domain) {
  const q = String(query || '').toLowerCase();
  // Urdu script terms (checked first since \b doesn't work with non-ASCII)
  if (/ہراساں|irasani|تکلیف|pareshan/.test(q)) return 'harassment';
  if (/حقوق|huqooq|haqooq/.test(q)) return 'rights';
  // Latin-script patterns — specific domains first, then general patterns
  if (/\b(harass|harassment|harassing|harassed|herass|herassment)\b/i.test(q)) return 'harassment';
  if (/\b(rights)\b/i.test(q)) return 'rights';
  // Specific domain patterns (checked before general 'how-to')
  if (/\b(fir|police|report|cognizable|arrest)\b/i.test(q)) return 'police-fir';
  if (/\b(recovery|loan|debt|money back|paisa)\b/i.test(q)) return 'recovery';
  if (/\b(property|land|house|rent|tenant|evict|registry|possession)\b/i.test(q)) return 'property';
  if (/\b(divorce|khula|dissolution|maintenance|custody|family)\b/i.test(q)) return 'family';
  if (/\b(bail|arrest|remand|zamanat)\b/i.test(q)) return 'bail';
  if (/\b(consumer|defective|substandard|service provider)\b/i.test(q)) return 'consumer';
  if (/\b(legal notice|demand notice)\b/i.test(q)) return 'legal-notice';
  if (/\b(injunction|stay order|temporary injunction)\b/i.test(q)) return 'injunction';
  if (/\b(guardian|guardianship|minor|custody of minor)\b/i.test(q)) return 'guardianship';
  if (/\b(noc|bonafide|certificate|transcript|degree)\b/i.test(q)) return 'certificate-noc';
  if (/\b(domicile|passport|cnic|identity)\b/i.test(q)) return 'civic-document';
  // Student/education domain patterns
  if (/\b(fee|fees|tuition|refund|scholarship|stipend)\b/i.test(q)) return 'fee-scholarship';
  if (/\b(admission|enroll|merit|daftar|inside daakhla)\b/i.test(q)) return 'admission';
  if (/\b(discipline|expul|suspension|rusticat|show.cause|penal|action against)\b/i.test(q)) return 'discipline';
  if (/\b(exam|recheck|re-eval|result|marks|grade|paper)\b/i.test(q)) return 'examination';
  if (/\b(hostel|room|dormitory|mess)\b/i.test(q)) return 'hostel';
  if (/\b(appeal|grievance|complaint|shikayat)\b/i.test(q)) return 'complaint-appeal';
  // General patterns (checked last)
  if (/\b(what should i do|what can i do|how do i|how can i|how to|kya karun|kya karen|kaise)\b/i.test(q)) return 'how-to';
  if (domain === 'education') return 'student-general';
  return 'general';
}

// Convert chunk keys/titles to human-readable topic labels for answer synthesis.
function topicFromChunk(chunk) {
  const key = String(chunk.key || '').toLowerCase();
  const rawTitle = String(chunk.chunkTitle || chunk.title || '');
  // Corpus authoring labels ("LAW:", ". COVERAGE: PARTIAL.") are plumbing, not law.
  const title = displayTitle(rawTitle);

  // Student/education domain keys
  if (/student.*right|education.*right/.test(key)) return 'fair treatment and access to education';
  if (/fee.*refund|refund.*rule/.test(key)) return 'fee refund policies';
  if (/harassment.*policy|anti.*harassment/.test(key)) return 'protection from harassment';
  if (/discipline|due.*process|grievance/.test(key)) return 'disciplinary procedures and fair hearing';
  if (/examination|exam.*right/.test(key)) return 'examination rules and rechecking';
  if (/hostel/.test(key)) return 'hostel rules and facilities';
  if (/scholarship|financial.*aid/.test(key)) return 'scholarships and financial aid';
  if (/admission|enrollment/.test(key)) return 'admission policies';
  if (/transport|safety/.test(key)) return 'transport and campus safety';
  if (/academic.*rule|probation/.test(key)) return 'academic rules and probation';
  if (/student.*welfare/.test(key)) return 'student welfare and support';
  if (/degree.*recog|attestation/.test(key)) return 'degree recognition and attestation';

  // Skip case law chunks for topic labels
  if (/^case_/i.test(key) || /judg|precedent/i.test(String(chunk.documentType || ''))) return null;

  // Clean up title for display
  if (title && title.length > 5 && title.length < 100) {
    return title.toLowerCase();
  }
  return null;
}

// Build a plain-language direct answer from query intent + chunk metadata.
// This NEVER fabricates legal facts — it summarizes what the retrieved records
// cover, in language a normal person can understand.
function synthesizePlainAnswer(query, chunks, domain, isRoman) {
  const intent = detectQueryIntent(query, domain);
  // Only records that share the question's own subject may name its topics. One
  // incidental word ("punishment") let an unrelated record ("high court's powers
  // of revision") appear in the direct answer as if it were part of the answer.
  // The answer record's own document always qualifies: for an Urdu-script question
  // the English term-overlap test cannot see the user's words at all, and dropping
  // every topic there left the list with nothing but other documents' titles.
  const leadDoc = chunks[0] && chunks[0].docId;
  const onSubject = chunks.filter(c => c.docId === leadDoc || queryTermHits(query, c) >= 2);
  const topicChunks = onSubject.length ? onSubject : chunks;
  const topics = topicChunks.map(topicFromChunk).filter(Boolean);
  const uniqueTopics = [...new Set(topics)];

  if (isRoman) {
    return synthesizeRomanAnswer(query, intent, uniqueTopics, domain, chunks);
  }
  return synthesizeEnglishAnswer(query, intent, uniqueTopics, domain, chunks);
}

function synthesizeEnglishAnswer(query, intent, topics, domain, chunks) {
  switch (intent) {
    case 'rights':
      if (domain === 'education') {
        return `A university student in Pakistan has several important rights. You have the right to fair treatment and due process in all university matters. You have the right to protection from harassment — every university must have an anti-harassment committee. You have the right to a fair hearing before any disciplinary action like expulsion or suspension. You have the right to see your exam papers and request rechecking. You have the right to fee refunds as per HEC policy. These rights come from your university's regulations, HEC policies, and applicable laws.`;
      }
      return `Based on the available legal records, your rights in this matter include protections relating to: ${topics.length > 0 ? topics.slice(0, 5).join(', ') : 'the relevant legal provisions'}. The exact application depends on the specific facts of your situation and the applicable law.`;

    case 'harassment':
      return `If you are being harassed, you are protected under Pakistani law. Most institutions including universities are required to have an anti-harassment policy and an inquiry committee. You can file a written complaint describing what happened, with dates and any evidence you have. If your institution does not have a committee or does not act on your complaint, you can approach the provincial Ombudsperson. You do not need to face this alone — legal aid is available if you need it.`;

    case 'how-to':
      if (domain === 'education') {
        return `Here is what you can generally do in this situation: first, document everything that happened (dates, people involved, any written communication). Second, check your university's rules and procedures for the proper channel — this is usually a complaint committee, grievance cell, or the relevant administrative office. Third, file your complaint or application in writing and keep a copy. If the university does not resolve it, you may have further options including approaching the HEC or other relevant authority.`;
      }
      return `Here are the general steps: first, document the relevant facts and gather any supporting documents. Second, identify the correct authority or forum for your matter. Third, file your complaint or application in writing, keeping copies of everything. The specific procedure depends on the type of matter and your location.`;

    case 'fee-scholarship':
      return `Regarding fees and scholarships: universities in Pakistan are bound by HEC policies on fee structures and refunds. If you have a fee-related grievance, you can first raise it with your university's finance office or student affairs. For scholarships, the HEC and provincial governments have various programs — eligibility depends on your specific situation. The detailed rules depend on your university's regulations.`;

    case 'discipline':
      return `In disciplinary matters, you have the right to due process. This generally means: you should be informed of the allegations against you, given a fair opportunity to respond, and the decision should follow the university's established procedures. A show-cause notice must be responded to within the given deadline. If you believe the process was unfair, you may have grounds for an appeal.`;

    case 'police-fir':
      return `For filing an FIR or police matter: under Section 154 of the Code of Criminal Procedure (CrPC), the police are required to register an FIR when information about a cognizable offence is received. If the police refuse to register your FIR, you can send the information in writing to the Superintendent of Police (SP) or approach the court under Section 200 CrPC.`;

    case 'family':
      return `In family matters, Pakistani law provides specific protections and procedures. The relevant forum depends on the specific issue — family courts handle divorce, khula, maintenance and custody matters. The procedure and your rights depend on the applicable personal law.`;

    case 'property':
      return `In property matters, your rights and the procedure depend on the type of issue (ownership dispute, tenancy, possession, etc.). The relevant laws include the Transfer of Property Act, rent laws, and the civil procedure code. The correct forum is usually the civil court having jurisdiction over the property location.`;

    case 'consumer':
      return `As a consumer, you are protected under the relevant consumer protection act (federal or provincial, depending on your location). If you have received defective goods or poor services, you can file a complaint with the Consumer Protection Council and, if needed, the Consumer Court.`;

    case 'civic-document':
      return `For civic documents like domicile, passport, or CNIC: the procedure and required documents depend on the specific document and your province. Generally, you need to apply through the relevant government authority with the required supporting documents.`;

    case 'student-general':
    default:
      if (domain === 'education' && topics.length > 0) {
        return `Based on the verified records, the relevant areas for your question include: ${topics.slice(0, 5).join(', ')}. The specific rules depend on your university's regulations and applicable HEC policies. Here is what the records say about these areas:`;
      }
      if (topics.length > 0) {
        return `Based on the verified legal records, the relevant information covers: ${topics.slice(0, 5).join(', ')}. Here are the details:`;
      }
      return '';
  }
}

function synthesizeRomanAnswer(query, intent, topics, domain, chunks) {
  switch (intent) {
    case 'rights':
      if (domain === 'education') {
        return `University ke student ke Pakistan mein kai ahem rights hain. Aap ko har university mamlay mein insaaf aur due process ka haq hai. Aap ko harassment se hifazat ka haq hai — har university mein anti-harassment committee hona zaroori hai. Kisi bhi disciplinary action (masalan expulsion ya suspension) se pehle aap ko fair hearing ka haq hai. Aap apne exam papers dekh sakte hain aur rechecking ki darkhwast kar sakte hain. HEC policy ke mutabiq aap ko fee refund ka bhi haq hai. Yeh rights aap ki university ke rules, HEC policies aur mutaliqa qawaneen se aate hain.`;
      }
      return `Verified qanooni records ke mutabiq, aap ke is mamlay mein yeh rights hain: ${topics.length > 0 ? topics.slice(0, 5).join(', ') : 'mutaliqa qanooni dafa'} . Is ka amli itlaq aap ke haal-e-waqia par depend karta hai.`;

    case 'harassment':
      return `Agar aap ko koi pareshan kar raha hai to aap Pakistani qanoon ke tehat mehfooz hain. Taqreeban tamam institutions jin mein universities bhi shamil hain, ke liye anti-harassment policy aur inquiry committee hona zaroori hai. Aap likhit shikayat darj karwa sakte hain jis mein waqia, tareekhen aur saboot bayan hon. Agar aap ke institution mein committee nahi hai ya wo action nahi leti to aap provincial Ombudsperson se rujoo kar sakte hain. Aap ko akele nahi jhelna chahiye — qanooni madad bhi available hai.`;

    case 'how-to':
      if (domain === 'education') {
        return `Is surat-e-haal mein aap generally yeh kar sakte hain: pehle, har cheez likh kar mehfooz karein (tareekhen, shakhs, koi likhit baat). Doosra, apni university ke rules check karein ke sahi channel kaunsa hai — aam tor par yeh complaint committee, grievance cell ya mutaliqa administrative office hota hai. Teesra, apni shikayat ya application likhit mein den aur copy rakh lein.`;
      }
      return `Aam qadam yeh hain: pehle, mutaliqa haqaiq aur documents mehfooz karein. Doosra, sahi authority ya forum ki pehchan karein. Teesra, likhit mein shikayat ya application den aur sab ki copy rakh lein.`;

    case 'fee-scholarship':
      // No generic HEC fee/refund paragraph here: on a scholarship question it
      // opened the answer with boilerplate about a different matter and pushed
      // the grounded eligibility record into the second sentence. The record's
      // own clause leads instead, exactly as it does in English.
      return '';

    case 'discipline':
      return `Disciplinary mamlay mein aap ko due process ka haq hasil hai. Is ka matlab hai: aap ko allegations se aagah kiya jana chahiye, aap ko jawab dene ka munasib mauqa milna chahiye, aur faisla university ke muqarrar tareeqay ke mutabiq hona chahiye. Show-cause notice ka jawab di gayi deadline mein dena zaroori hai.`;

    case 'police-fir':
      return `FIR ya police mamlay ke liye: CrPC ki Section 154 ke tehat police par zaroori hai ke wo cognizable offence ki ittila milne par FIR darj kare. Agar police FIR register karne se inkaar kare to aap SP ko likhit bhej sakte hain ya Section 200 CrPC ke tehat adalat se rujoo kar sakte hain.`;

    case 'family':
      return `Family mamlay mein Pakistani qanoon khaas hifazat aur tareeqay faraham karta hai. Sahi forum maslay ki qisam par depend karta hai — family courts talaq, khula, maintenance aur custody ke muamlat sunte hain.`;

    case 'property':
      return `Property mamlay mein aap ke rights aur tareeqa maslay ki qisam par depend karta hai (maliki, kirayadari, qabza, waghera). Sahi forum aam tor par property ke ilaqay ki civil court hoti hai.`;

    case 'consumer':
      return `Consumer ke tor par aap mutaliqa consumer protection act (federal ya provincial) ke tehat mehfooz hain. Agar aap ko naqsa maal ya kharab service mili hai to aap Consumer Protection Council aur zaroorat par Consumer Court mein shikayat kar sakte hain.`;

    case 'student-general':
    default:
      if (domain === 'education' && topics.length > 0) {
        return `Verified records ke mutabiq, aap ke sawal se mutaliqa pehlu yeh hain: ${topics.slice(0, 5).join(', ')}. Tafseelaat aap ki university ke regulations aur HEC policies par depend karti hain. Records ki details neechay di gayi hain:`;
      }
      if (topics.length > 0) {
        return `Verified qanooni records ke mutabiq, mutaliqa maloomat in pehluon par hai: ${topics.slice(0, 5).join(', ')}. Tafseelaat neechay hain:`;
      }
      return '';
  }
}

// Build a simple explanation from the primary chunk's text — extract the key
// point, not the full legal text.
function buildExplanation(query, primary, domain, isRoman) {
  // Provide a simple plain-language bridge based on the query and retrieved chunk.
  let intent = detectQueryIntent(query, domain);
  // A social-protection or civic programme question is answered by the
  // programme's own published channel — a Tehsil/field office, a helpline, a
  // registration desk. The intent templates below name court remedies, and
  // "recovery" fires on words like paisa/qist, so a citizen reporting a
  // deduction from their 8171 payment was being told to file a civil suit: a
  // remedy no retrieved record states. On these domains the ask gets the
  // programme bridge instead.
  if (domain === 'social-protection' || domain === 'civic') intent = 'programme-channel';
  const chunkTitle = String(primary?.chunkTitle || primary?.title || '').replace(/^title:\s*/i, '').trim();
  const topic = chunkTitle || topicFromChunk(primary) || 'your legal matter';

  if (isRoman) {
    switch (intent) {
      case 'programme-channel':
        return `Yeh maloomat programme ke apne verified records se li gayi hai. Is mein jo tareeqa likha hai woh programme ka apna registration ya shikayat ka channel hai — maslan Tehsil/field office ya toll-free helpline. Adalat ya civil suit is ka pehla qadam nahi, jab tak record khud woh na kahe.`;
      case 'police-fir':
        return `FIR (First Information Report) darj karwana aap ka qanooni haq hai. Police cognizable offence ki FIR register karne ki paband hai.`;
      case 'harassment':
        return `Harassment ke khilaf qanoon aap ki hifazat karta hai. Aap likhit shikayat de sakte hain aur inquiry ka haq rakhte hain.`;
      case 'rights':
        return `Yeh aap ke qanooni huqooq hain jo verified qanooni zakhire se sabit hain. In ka maqsad aap ki hifazat aur insaaf hai.`;
      case 'fee-scholarship':
      case 'student-general':
        return `Yeh rights aur protections aap ki university ke regulations aur HEC ki policies mein darj hain. In ka maqsad yeh hai ke students ke saath insaaf ho.`;
      case 'recovery':
        return `Qarz ya recovery ke liye qanooni tareeqay majood hain. Aap legal notice ya civil suit ke zariye apna haq hasil kar sakte hain.`;
      case 'property':
        return `Property ke qanooni huqooq protected hain. Registry, possession aur transfer ke liye clear qanooni provisions hain.`;
      case 'family':
        return `Family matters mein qanoon aap ko rights deta hai — maintenance, custody ya divorce ke liye clear tareeqay hain.`;
      case 'bail':
        return `Bail ka haq qanoon mein darj hai. Zamanat ke liye aap court mein application de sakte hain.`;
      case 'consumer':
        return `Consumer protection qanoon ke tehet aap defective goods ya substandard services ke khilaf shikayat kar sakte hain.`;
      case 'legal-notice':
        return `Legal notice ek rasmi tareeqa hai jisme aap apni baat doosri party tak pohanchate hain aur qanooni action ki warning dete hain.`;
      default:
        return `Yeh maloomat verified Pakistani qanooni zakhire se li gayi hai. Is ka maqsad aap ko aap ke huqooq aur tareeqay samjhana hai.`;
    }
  }

  switch (intent) {
    case 'programme-channel':
      return `This is drawn from the programme's own verified records. The route stated in them is the programme's registration or grievance channel — a Tehsil/field office, a helpline — not a court claim, unless a record says otherwise.`;
    case 'police-fir':
      return `Registering an FIR is your legal right. The police are obligated to register a First Information Report for cognizable offences under Section 154 CrPC.`;
    case 'harassment':
      return `The law protects you from harassment. You can submit a written complaint and have the right to an inquiry.`;
    case 'rights':
      return `These are your legal rights, verified from the Pakistani law corpus. Their purpose is to ensure your protection and access to justice.`;
    case 'fee-scholarship':
    case 'student-general':
      return `These rights and protections are set out in your university's regulations and HEC policies. Their purpose is to ensure fair treatment for students.`;
    case 'recovery':
      return `Legal remedies exist for debt recovery. You can pursue your claim through a legal notice or civil suit.`;
    case 'property':
      return `Property rights are protected by law. Clear provisions govern registration, possession, and transfer.`;
    case 'family':
      return `Family law provides clear rights and procedures for maintenance, custody, and divorce matters.`;
    case 'bail':
      return `Bail is a legal right. You can apply for bail through the appropriate court.`;
    case 'consumer':
      return `Consumer protection law allows you to file complaints against defective goods or substandard services.`;
    case 'legal-notice':
      return `A legal notice is a formal way to communicate your position to the other party and warn of potential legal action.`;
    default:
      return `This information is from the verified Pakistani law corpus. Its purpose is to help you understand your rights and the relevant procedures.`;
  }
}

/** A record's own numbered action list, quoted verbatim. */
/** A published fee-schedule row: "<name> — <amount>". Numbered in the source, but
 *  it prices a service; it is not a procedural step, and rendering it as one would
 *  invent an application process the document never describes. */
const FEE_ROW_RE = /^\d+[.)]\s+(.+?)\s+[—–:-]\s*(?:(?:Rs\.?|PKR)\s*)?([\d][\d,.]*)\s*(?:Rs\.?|PKR)?\s*$/i;
function parseFeeRows(chunk) {
  const lines = String(chunk?.text || '').split('\n').map(l => l.trim()).filter(Boolean);
  const rows = [];
  let group = null;
  for (const l of lines) {
    if (META_LINE_RE.test(l)) continue;
    const heading = /^\d+[.)]\s+/.test(l) ? null
      : /^(.{5,90}?)\s*[—–-]?\s*\((?:Rs\.?|PKR)[^)]*\)\s*:?\s*$/i.exec(l);
    if (heading) { group = heading[1].replace(/\s+/g, ' ').trim(); continue; }
    const m = FEE_ROW_RE.exec(l);
    if (m) rows.push({ name: m[1].trim(), amount: m[2].replace(/,$/, ''), group });
  }
  return rows;
}
function isFeeRowLine(line) { return FEE_ROW_RE.test(String(line || '').trim()); }
function hasFeeSchedule(chunk) { return parseFeeRows(chunk).length >= 3; }

/** The schedule itself, as published: names, amounts and the currency the document
 *  states. Amounts are copied verbatim — never summed, converted or completed. */
function feeScheduleBlock(chunk, maxRows = 12, roman = false, query = '') {
  const all = parseFeeRows(chunk);
  if (all.length < 3) return null;
  const words = String(query || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(w => w.length > 3 && !/^(fee|fees|what|when|where|how|does|the|and|for|about)$/i.test(w));
  const scored = all.map((r, i) => {
    const n = words.filter(w => r.name.toLowerCase().includes(w)).length;
    return { r, i, s: n };
  });
  scored.sort((a, b) => (b.s - a.s) || (a.i - b.i));
  const rows = scored.slice(0, Math.max(6, maxRows)).map(x => x.r);
  const seen = new Set();
  const lines = rows.map(r => {
    const g = r.group && !seen.has(r.group) && r.group.length <= 100 ? `**${r.group}:**\n` : '';
    if (r.group) seen.add(r.group);
    return `${g}- ${r.name} — Rs. ${r.amount}`;
  });
  const lead = roman
    ? 'Amounts neeche document mein jaise chhape hue hain waise hi likhe gaye hain (sab figures Rupees, Rs. mein):'
    : 'Every amount below is copied as printed (all figures in Rupees, Rs.):';
  const omitted = rows.length < all.length
    ? (roman ? `Baaqi ${all.length - rows.length} items original document mein maujood hain.`
      : `${all.length - rows.length} further items are listed in the source document.`)
    : null;
  return [lead, ...lines, omitted ? `_${omitted}_` : ''].filter(Boolean).join('\n');
}

function numberedSteps(chunk, max = 5) {
  const lines = String(chunk?.text || '').split('\n').map(l => l.trim()).filter(Boolean);
  const steps = lines.filter(l => /^\d+[.)]\s+\S/.test(l) && !isFeeRowLine(l)).slice(0, max);
  return steps.length >= 2 ? steps : [];
}

/** Whole-sentence bound that never cuts mid-word: legal text is never left as a
 *  fragment. clipSentences keeps its first sentence whole, so an oversized
 *  single sentence is trimmed at the last space inside the limit. */
function boundSentence(text, maxChars) {
  const s = String(text || '').trim();
  if (s.length <= maxChars) return s;
  const whole = clipSentences(s, 3, maxChars);
  if (whole.length <= maxChars) return whole;
  const cut = whole.slice(0, maxChars);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).replace(/[,;:\s]+$/, '');
}

/** Steps for a "what do I do" answer: the record that actually lists them.
 *  `roman` keeps the framing Roman Urdu — the steps stay quoted but bounded, so
 *  the answer explains in Roman and carries only short verifiable clauses. */
function stepsFromRecords(procedures, chunks, max = 5, roman = false) {
  const cap = roman ? ROMAN_QUOTE_CHARS : 150;
  const lead = roman ? 'Ye qadam verified record se liye gaye hain:' : '';
  const source = procedures.find(c => numberedSteps(c, max).length)
    || (chunks || []).find(c => numberedSteps(c, max).length);
  const steps = numberedSteps(source, max).map(s => boundSentence(s.replace(/^\d+[.)]\s+/, ''), cap));
  if (steps.length) {
    return [lead, ...steps.map(s => `- ${s}`)].filter(Boolean).join('\n');
  }
  if (procedures[0]) {
    // A procedure record opens with its metadata card (Title / Authority /
    // Jurisdiction) and labels its blocks ("Step-by-Step Practical Workflow:").
    // Those describe the document; the steps themselves are its content lines.
    const lines = String(procedures[0].text).split('\n').map(l => l.trim()).filter(Boolean)
      .filter(l => !META_LINE_RE.test(l) && !SECTION_LABEL_RE.test(l) && !/:\s*$/.test(l) && !isFeeRowLine(l))
      .map(l => l.replace(/^step\s*\d+\s*[.:)\-]\s*/i, '').replace(/^\d+[.)]\s+/, '')
        .replace(/^[-*•]\s+/, '').trim())
      .filter(l => l.length > 25).slice(0, max).map(b => boundSentence(b, cap));
    if (lines.length) return [lead, ...lines.map((s, i) => `${i + 1}. ${s}`)].filter(Boolean).join('\n');
  }
  return null;
}

// Build practical steps from procedure chunks and query intent.
function buildPracticalSteps(query, chunks, domain, isRoman) {
  const intent = detectQueryIntent(query, domain);
  const procedures = chunks.filter(c => /PROCEDURE|WORKFLOW|_STAGES|_PROCESS|MARAHIL/i.test(String(c.key || '')));

  if (isRoman) {
    switch (intent) {
      case 'rights':
        if (domain === 'education') {
          return `- Apni university ka student handbook ya regulations check karein\n- Agar koi masla hai to pehle relevant department ya student affairs office se baat karein\n- Shikayat likhit mein den aur copy zaroor rakh lein\n- Agar university se insaaf na mile to HEC ya provincial Ombudsperson se rujoo kar sakte hain`;
        }
        return `- Apne rights ko samjhein aur mutaliqa rules check karein\n- Maslay ko likhit mein document karein\n- Mutaliqa authority ya forum ko likhit darkhwast den\n- Agar zaroorat ho to qanooni mashwara lein`;
      case 'harassment':
        return `- Jo hua uski tareekh, waqt aur gawahon ki detail likh kar mehfooz karein\n- Apni university ki anti-harassment committee ya inquiry body ko likhit shikayat den\n- Shikayat ki copy apne paas rakh lein aur receipt lein\n- Agar university action na le to provincial Ombudsperson se rujoo karein\n- Qanooni madad ke liye legal aid services se bhi raabta kar sakte hain`;
      case 'discipline':
        return `- Show-cause notice mein di gayi deadline ka khayal rakhein\n- Likhit jawab tayar karein jis mein har allegation ka jawab ho\n- Saboot aur gawah agar hain to unki list attach karein\n- University ke appeal tareeqay ke mutabiq appeal kar sakte hain`;
      case 'police-fir':
        return `- Nazdeek police station jayein aur waqia bayan karein\n- Agar FIR register na ho to SP ko likhit bhejein\n- FIR ki copy zaroor lein\n- Agar police madad na kare to adalat se rujoo ka option hai`;
      default:
        return stepsFromRecords(procedures, chunks, 5, true);
    }
  }

  switch (intent) {
    case 'rights':
      if (domain === 'education') {
        return `- Check your university's student handbook or regulations for the specific rules\n- If you have a problem, first talk to the relevant department or student affairs office\n- Submit your complaint in writing and always keep a copy\n- If the university does not resolve it, you can approach the HEC or the provincial Ombudsperson`;
      }
      return `- Understand your rights and check the relevant rules\n- Document the issue in writing\n- Submit a written application to the relevant authority or forum\n- Seek legal advice if needed`;
    case 'harassment':
      return `- Document what happened: dates, times, witnesses, any messages or evidence\n- File a written complaint with your institution's anti-harassment committee or inquiry body\n- Keep a copy of your complaint and get a receipt\n- If the institution does not act, approach the provincial Ombudsperson\n- Legal aid services are available if you need support`;
    case 'discipline':
      return `- Note the deadline in the show-cause notice\n- Prepare a written reply addressing each allegation\n- Attach any evidence or list of witnesses\n- Follow your university's appeal procedure if the outcome is unfavorable`;
    case 'police-fir':
      return `- Go to the nearest police station and report the incident\n- If the FIR is not registered, send the information in writing to the Superintendent of Police (SP)\n- Always obtain a copy of the FIR\n- If the police do not help, you can approach the court under Section 200 CrPC`;
    case 'fee-scholarship':
      return `- First raise the issue with your university's finance office or student affairs\n- If not resolved, check if your university has a fee grievance committee\n- For scholarship issues, contact the HEC or relevant scholarship authority\n- Keep all fee receipts and correspondence as evidence`;
    default:
      return stepsFromRecords(procedures, chunks);
  }
}

// Trim to whole sentences only — legal text is never cut mid-clause.
function clipSentences(text, maxSentences = 3, maxChars = 900) {
  const s = String(text || '').trim();
  if (!s) return '';
  const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = [];
  let len = 0;
  for (const p of parts) {
    if (out.length >= maxSentences) break;
    if (len + p.length > maxChars && out.length > 0) break;
    out.push(p);
    len += p.length + 1;
  }
  if (!out.length) return s.slice(0, maxChars);
  return out.join(' ');
}

// Exceptions/conditions copied VERBATIM out of a retrieved record. The Advanced
// level may name a nuance only where the corpus itself states one; nothing here
// is composed.
const PROVISO_RE = /\b(provided that|provided no|unless|subject to|save as|shall not apply|exempt|notwithstanding)\b/i;
function extractProvisos(chunk, max = 2) {
  if (!chunk || !PROVISO_RE.test(String(chunk.text || ''))) return [];
  const sentences = String(chunk.text).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const s of sentences) {
    if (out.length >= max) break;
    if (!PROVISO_RE.test(s)) continue;
    if (s.length < 25 || s.length > 320) continue;
    if (!/[a-z]/.test(s)) continue;
    out.push(s.replace(/^[-*•]\s+/, '').trim());
  }
  return out;
}

// Some summary records carry a sequential key ("section 20 of this document")
// that is not a statutory section number, while their own text opens with the
// real citation. Quote what the record states; never compose a citation.
const OWN_CITATION_RE = /^\s*((?:Article|Section|Rule|Order|Sub-rule|Clause)\s+[0-9]+[A-Za-z]*(?:\([0-9ivxIVX]+\))?)\s*[:—–-]/i;
function recordCitation(chunk) {
  for (const s of [chunk?.chunkTitle, chunk?.text]) {
    const m = String(s || '').trim().match(OWN_CITATION_RE);
    if (m) return m[1].trim();
  }
  return null;
}

/** A short heading for a record that is not a numbered statutory provision. */
function topicLabel(chunk) {
  const raw = displayTitle(chunk?.chunkTitle || '')
    .replace(/^\s*(?:overview|summary)\s*:\s*/i, '').trim();
  const head = (raw.split(/\s+[—–:]\s+|\.\s/)[0] || '').trim();
  const label = (head.length >= 8 ? head : raw).replace(/\s+/g, ' ');
  if (!label) return String(chunk?.title || 'Relevant record');
  return label.length > 90 ? `${label.slice(0, 90).replace(/\s+\S*$/, '')}…` : label;
}

// Build concise legal basis — just the law names and sections, not full text.
// Each line also names the LAYER it belongs to (Part 7), so a university rule and
// an Act of Parliament are never printed as the same kind of rule.
function buildConciseLegalBasis(chunks, L, cap = 4, scopeLang = null) {
  const { provisions, topics } = categorize(chunks);
  const lines = [];
  for (const c of [...provisions, ...topics].slice(0, cap)) {
    // Only legislation records carry a real section/article number in their key.
    // Guides and directories number their entries sequentially, so printing
    // "Section 1" for one would quote a citation that does not exist.
    const isLegislation = String(c.documentType || '') === 'Legislation';
    const numbered = /^\d+[a-z]*$/i.test(String(c.key)) || /^ORDER_/i.test(String(c.key));
    const own = recordCitation(c);
    const label = own
      || (isLegislation && numbered ? L.provision(c.type, c.key) : topicLabel(c));
    // A guide document holds many services; its own title lists them all. For
    // those documents the record IS its section, so name and attribute the
    // section. Legislation and case law keep the instrument's name and court.
    const isGuide = /guide|digest|workflow|handbook|manual|directory/i.test(String(c.documentType || ''));
    const name = isGuide ? (displayTitle(c.chunkTitle || '') || c.title) : c.title;
    const authority = isGuide ? (recordAuthority(c) || c.issuingAuthority) : c.issuingAuthority;
    const auth = authority ? ` (${authority})` : '';
    const layer = scopeLang ? scopeLabel(deriveChunkScope(c), scopeLang) : null;
    lines.push(`- ${label}${layer ? ` [${layer}]` : ''} — ${name}${auth}${L.statusNote(c.legalStatus)}`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

// Build source lines from chunks. The label is the RECORD the answer used, not
// the file it sits in: one civic document carries the CNIC, passport and NICOP
// records, and quoting the file title made every civic answer look like it came
// from the same generic page.
function buildSources(chunks, cap = 4, asked = null) {
  const seen = new Set();
  const lines = [];
  for (const c of chunks.slice(0, cap)) {
    const label = displayTitle(c.chunkTitle || '') || c.title;
    const url = recordSource(c, asked);
    const id = `${label}|${url}`;
    if (seen.has(id)) continue;
    seen.add(id);
    lines.push(url ? `- ${label}: ${url}` : `- ${label}`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

const OFFICIAL_PORTAL_URL = /https?:\/\/(?:[a-z0-9-]+\.)+gov\.pk\b/gi;
function portalHost(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

/**
 * A cross-border record names every Pakistan-side office that can act on the
 * matter — the emigration record points at the Bureau of Emigration AND the
 * Ministry of Overseas Pakistanis — but a chunk carries only its own document
 * URL, so depth clipping silently discarded the sibling portal the evidence
 * itself provides. Recovery is restricted to records the gate already accepted,
 * to a document the answer already cites, to the cross-border layer and to
 * official .gov.pk hosts, so no outside source can enter the answer.
 */
function siblingPortals(citedChunks, acceptedChunks, cap = 2) {
  const citedDocs = new Set(citedChunks.map(c => c.docId).filter(Boolean));
  const known = new Set(citedChunks.map(c => portalHost(c.sourceURL || '')).filter(Boolean));
  const found = [];
  for (const c of acceptedChunks || []) {
    if (!citedDocs.has(c.docId)) continue;
    if (deriveChunkScope(c).scopeLevel !== 'cross_border') continue;
    for (const url of String(c.text || '').match(OFFICIAL_PORTAL_URL) || []) {
      const host = portalHost(url);
      if (!host || known.has(host)) continue;
      known.add(host);
      found.push(url);
      if (found.length >= cap) return found;
    }
  }
  return found;
}

/** Keep the first N lines of a bullet/numbered list. */
function clipList(text, max = 99) {
  if (!text) return text;
  const lines = String(text).split('\n').filter(l => l.trim());
  return lines.slice(0, max).join('\n');
}

/**
 * Compose a structured, corpus-grounded answer from retrieved chunks.
 * Structure: Direct Answer → Explanation → Practical Steps → Legal Basis → Source → Limitation
 *
 * `answerLevel` (beginner | intermediate | advanced) controls DEPTH ONLY: how
 * many records are worked from, how long each part is, and which optional
 * sections appear. It never changes which records count as evidence, and every
 * level keeps the same grounding rules and the same limitation line.
 * @param {object} [evidence] gate diagnostics ({verdict, supportedCount, rejected, corrections})
 * @returns {string} markdown answer (empty string if there is nothing to ground on)
 */
export function composeOwnedModelAnswer(userQuery, chunks, activeLang = 'en', domain = 'general-legal', answerLevel = 'beginner', evidence = null) {
  if (!chunks || chunks.length === 0) return '';
  // The user's explicit depth request outranks the stored answer level: asking
  // for a short answer must shorten an advanced profile, and asking for detail
  // must expand a beginner one. Neither changes what counts as evidence.
  const style = detectAnswerStyle(userQuery);
  const baseLevel = normalizeAnswerLevel(answerLevel);
  const styleLevel = style === 'detail'
    ? (baseLevel === 'advanced' ? 'advanced' : 'intermediate')
    : baseLevel;
  const lvl = style === 'short'
    ? { ...ANSWER_LEVELS.beginner, answerSentences: 3, answerChars: 420, sources: 1, legalBasis: 0, steps: 0 }
    : ANSWER_LEVELS[styleLevel];
  const shortStyle = style === 'short';
  // PART 3-A — a civic question is about ONE service. Records tagged to another
  // service leave the pool before anything is ranked or cited.
  const askedServices = askedServiceSet(userQuery);
  const pool = scopePoolToServices(chunks.slice(0, lvl.chunkCap), askedServices);
  const isRoman = activeLang === 'roman_urdu';
  const L = isRoman ? ROMAN : EN;
  const scopeLang = isRoman ? 'roman_urdu' : 'en';
  // PART 1 — answer the question that was asked. The gate hands records over in
  // evidence order; re-rank them by the words of THIS question so the section
  // content comes from the record that addresses the ask, not the one that merely
  // scored highest on generic terms.
  const focus = policyFamilyOrder(userQuery, rankRecords(userQuery, pool));
  const { provisions, remedies, precedents } = categorize(focus);
  // Being a PROVISION does not qualify a record to answer. Measured on a ragging
  // complaint: the topically first record was "Prohibition of Ragging in Hostels",
  // but a scholarship-eligibility provision displaced it and became the direct
  // answer, pushing the ragging rule into a supporting bullet. Provisions break a
  // tie; they no longer outrank relevance.
  const topicalScoreOf = (c) => (c ? ownIdentityHits(userQuery, c) + queryTermHits(userQuery, c) : -1);
  const primary = (provisions[0] && topicalScoreOf(provisions[0]) >= topicalScoreOf(focus[0]))
    ? provisions[0]
    : (focus[0] || provisions[0]);
  // PART 1b — the question's own words choose WHICH RECORD answers, never WHICH
  // DOCUMENT. Across documents generic overlap wins: a supporting digest record
  // repeating "admission", "fee" and "policy" displaced the HEC fee-refund
  // schedule it was meant to illustrate, so the answer described admissions
  // instead of the refund. When the retrieval put an authority instrument first
  // and the word-match picked a supporting record, the instrument answers.
  // Between two instruments the word-match still decides, because choosing
  // between two policies is a relevance question, not an attribution one.
  const leadRecord = pool[0] && pool[0].authorityLead ? pool[0] : null;
  // ...but only when that same-document record is at least as on-topic as the
  // word-match. Measured on a suspension-appeal question: the HEC welfare policy
  // carries an authorityLead mark, so its drug-abuse clause replaced "Student
  // Right to Appeal Disciplinary Decisions" as the direct answer — attribution
  // decided a relevance question.
  const leadMatch = leadRecord ? focus.find(c => c.docId === leadRecord.docId) : null;
  const answerRecord = (leadMatch && primary && !primary.authorityLead
    && topicalScoreOf(leadMatch) >= topicalScoreOf(primary))
    ? leadMatch
    : primary;
  // Supporting sections cite the records that address THIS question, not every
  // record that scored well enough to be retrieved.
  const support = focus.filter(c => !siblingOffTopic(c, answerRecord, userQuery));
  // Records that may be QUOTED or turned into practical steps: on-topic AND from
  // the jurisdiction being answered. The national layer stays in
  // "Law that may apply", labelled; it does not become this answer's procedure.
  const grounded = support.filter(c => sameJurisdiction(c, answerRecord));
  const out = [];
  const push = (label, body) => { if (body && String(body).trim()) out.push(`**${label}**\n${String(body).trim()}`); };
  const hasProcedure = focus.some(c => /PROCEDURE|WORKFLOW|_STAGES|_PROCESS|MARAHIL/i.test(String(c.key || '')));
  const plan = answerPlan(detectQueryIntent(userQuery, domain), isLegalProblemQuery(userQuery),
    hasProcedure, provisions.length > 0, focus.length > 0);

  // 0. Issue — one line naming what the user asked, then the answer. Skipped for
  //    non-Latin input: echoing an Urdu-script question here would put Urdu script
  //    inside an answer that Part 5 requires to come back in Roman Urdu.
  const statedIssue = String(userQuery || '').trim().replace(/\s+/g, ' ');
  if (!shortStyle && plan.has('issue') && statedIssue && !/[\u0600-\u06FF\u0900-\u097F]/.test(statedIssue)) {
    push(L.issue, clipSentences(statedIssue, 2, 240));
  }

  // 1. Direct answer — this record's own words where it has them, and the legal
  //    LAYER those words belong to (Part 7). Roman Urdu keeps the plain-language
  //    composition: quoting an English statute inside a Roman answer would break
  //    the language rule.
  const aScope = deriveChunkScope(answerRecord);
  const askedHere = evidence && evidence.scope && evidence.scope.asked;
  const showFraming = aScope.scopeLevel !== 'national'
    || Boolean(askedHere && (askedHere.city || askedHere.province || askedHere.institutionNamed));
  const framing = showFraming ? scopeLabel(aScope, scopeLang) : null;
  const synthesis = clipSentences(synthesizePlainAnswer(userQuery, focus, domain, isRoman), lvl.answerSentences, lvl.answerChars);
  // Roman Urdu quotes one bounded clause, not the paragraph it sits in — the same
  // ceiling the "says" part already uses. Quoting nothing left the Roman answer
  // with only topic titles, so a citizen reporting a deduction from an 8171
  // payment never got the helpline number the retrieved record states.
  const romanClause = clipSentences(recordLead(answerRecord, 1, ROMAN_QUOTE_CHARS, userQuery), 1, ROMAN_QUOTE_CHARS);
  const lead = isRoman
    ? [synthesis, romanClause ? `Record ke mutabiq: ${romanClause}` : ''].filter(Boolean).join(' ')
    : recordLead(answerRecord, lvl.answerSentences, lvl.answerChars, userQuery);
  let directAnswer = lead || synthesis;
  if (directAnswer && framing) directAnswer = `${framing}: ${directAnswer}`;
  // Never let a university/city/province record read as Pakistan-wide law.
  const guard = applicabilityNote(aScope, scopeLang);
  if (directAnswer && guard) directAnswer = `${directAnswer} ${guard}`;
  if (plan.has('answer') && directAnswer) push(L.answer, directAnswer);

  // 2. Legal basis — only where the level asks for provisions, never a law dump.
  if (!shortStyle && plan.has('law') && lvl.legalBasis > 0) {
    const lawLines = buildConciseLegalBasis(support, L, lvl.legalBasis, scopeLang);
    if (lawLines) push(L.law, lawLines);
  }

  // 3. What the law says — the next record that carries the question, quoted;
  //    this record's own remaining words next; a plain-language bridge last.
  //    One shared generic word ("case", "court") does not make a record about
  //    the thing that was asked, and quoting such a record pastes a different
  //    case's facts into this answer.
  const nextCandidate = grounded.find(c => c !== answerRecord);
  const second = nextCandidate
    && queryTermHits(userQuery, nextCandidate) >= 2
    && ownIdentityHits(userQuery, nextCandidate) >= 1 ? nextCandidate : null;
  const secondLead = recordLead(second, lvl.answerSentences, lvl.explanationChars);
  const selfRest = secondLead ? '' : recordContinuation(answerRecord, lead, lvl.answerSentences, lvl.explanationChars);
  const bridge = clipSentences(buildExplanation(userQuery, primary, domain, isRoman), lvl.answerSentences, lvl.explanationChars);
  // Roman Urdu explains first and quotes only the clause that carries the rule;
  // an English answer keeps the record's own wording in full.
  const romanQuote = clipSentences(secondLead, 1, ROMAN_QUOTE_CHARS);
  const explanation = isRoman
    ? [bridge, romanQuote ? `Verifiable record ke mutabiq: ${romanQuote}` : ''].filter(Boolean).join(' ')
    : (secondLead || selfRest || bridge);
  if (!shortStyle && plan.has('says') && explanation) {
    push(L.says, explanation);
  }

  // 4. Practical steps — concrete actions from procedure chunks and intent.
  //    GCU-D2: a question about what something COSTS is answered with the
  //    published schedule. Prices stay prices; turning a fee row into an
  //    "application step" invents a process the document never states.
  const asksFee = /\b(fee|fees|charge|charges|cost|price|amount)\b/i.test(userQuery)
    || detectQueryIntent(userQuery, domain) === 'fee-scholarship';
  const feeRecord = [answerRecord, ...grounded].find(c => c && hasFeeSchedule(c)) || null;
  if (!shortStyle && asksFee && feeRecord) {
    const table = feeScheduleBlock(feeRecord, Math.max(6, lvl.steps || 6), isRoman, userQuery);
    if (table) push(L.fees, table);
  }
  if (!shortStyle && plan.has('procedure')) {
    const steps = buildPracticalSteps(userQuery, grounded, domain, isRoman);
    if (steps) push(L.procedure, clipList(steps, lvl.steps));
  }

  // 5. Remedy — only if a remedy chunk was retrieved and the level wants it.
  if (!shortStyle && plan.has('remedy') && lvl.remedy) {
    const remedyText = isRoman
      ? (romanRecordLine(remedies[0]) || recordLead(remedies[0], 1, ROMAN_QUOTE_CHARS))
      : (remedies[0] ? leadParagraphs(remedies[0].text, 2, 400) : '');
    if (remedyText) push(L.remedy, remedyText);
  }

  // 6. Precedent — cite compactly, professional level only.
  if (!shortStyle && plan.has('precedent') && lvl.precedent && precedents[0]) {
    const p = precedents[0];
    const cite = [p.chunkTitle || p.title, p.legalStatus].filter(Boolean).join(' — ');
    push(L.precedent, isRoman ? cite : `${cite}\n${leadParagraphs(p.text, 1, 200)}`);
  }

  // 7. Jurisdiction / forum — the authority the record itself names.
  if (!shortStyle && plan.has('forum') && lvl.forum && (primary.jurisdiction || primary.issuingAuthority)) {
    const layer = scopeLayerName(aScope.scopeLevel, detectQueryScope(userQuery), scopeLang);
    push(L.forum, [primary.jurisdiction, recordAuthority(primary) || primary.issuingAuthority, layer].filter(Boolean).join(' · '));
  }

  // 8. Exceptions and nuances — copied verbatim from the accepted record, so a
  //    qualification is stated only where the corpus itself states one.
  if (!shortStyle && plan.has('exceptions') && lvl.exceptions > 0) {
    const found = [];
    for (const c of focus) {
      for (const p of extractProvisos(c, lvl.exceptions - found.length)) {
        if (!found.includes(p)) found.push(p);
      }
      if (found.length >= lvl.exceptions) break;
    }
    if (found.length) push(L.exceptions, found.map(p => `- ${p}`).join('\n'));
  }

  // 9. Evidence strength — professional level only; describes the records, never adds to them.
  if (!shortStyle && plan.has('evidence') && lvl.evidenceNote) {
    const note = evidenceNoteText(evidence, isRoman);
    if (note) push(L.evidence, note);
  }

  // 10. Source. Portals named inside the cited document's own accepted records
  //     are listed too — clipping depth must not silently drop a source the
  //     evidence itself provides.
  const srcLines = buildSources(focus, lvl.sources, askedServices);
  const portals = srcLines ? siblingPortals(focus.slice(0, lvl.sources), chunks) : [];
  if (plan.has('source') && srcLines) {
    push(L.source, [srcLines, ...portals.map(u => `- ${isRoman ? 'Sarkari portal' : 'Official portal'}: ${u}`)].join('\n'));
  }

  // 11. Limitation — every level, unchanged, plus the honest scope gap: where the
  //     corpus holds no record for the layer the user asked about, the answer says
  //     so instead of quietly answering from a wider one.
  const scopeGap = (evidence && evidence.scope && missingScopeMessage(evidence.scope, scopeLang)) || '';
  push(L.limit, `${L.limitText}${scopeGap}`);

  return out.join('\n\n');
}

// ----------------------------------------------------------------------------
// Phase 1/2 — MINIMUM-CLARIFICATION (A/B/C) instead of a cold refusal.
// The chat/agent/advice endpoints call askClarification() only when retrieval
// returned ZERO records. It decides what the least number of questions is that
// lets the pipeline answer next time: for an overseas/move question that is the
// target country + purpose; otherwise a concrete issue-area probe with the
// Library / legal-aid / lawyer routing. Nothing here invents legal facts, and
// the copy stays honest that no verified record matched THIS phrasing.
// crossBorderNudge() is the lighter variant used when records DID match generic
// cross-border context: answer first, then ask the country/purpose follow-up.
// ----------------------------------------------------------------------------

// Display names for the most common destination tokens (parseOverseasIntent
// returns the raw regex token). Unknown tokens are title-cased, never guessed.
const COUNTRY_DISPLAY = {
  uk: 'the UK', 'u.k': 'the UK', 'u.k.': 'the UK', 'united kingdom': 'the UK',
  britain: 'the UK', england: 'England', usa: 'the USA', 'u.s': 'the USA',
  'u.s.a': 'the USA', 'united states': 'the USA', america: 'the USA',
  uae: 'the UAE', 'u.a.e': 'the UAE', 'united arab emirates': 'the UAE',
  dubai: 'Dubai (UAE)', 'abu dhabi': 'Abu Dhabi (UAE)',
  saudi: 'Saudi Arabia', 'saudi arabia': 'Saudi Arabia', riyadh: 'Riyadh (Saudi Arabia)',
  qatar: 'Qatar', oman: 'Oman', bahrain: 'Bahrain', kuwait: 'Kuwait',
  canada: 'Canada', australia: 'Australia', 'new zealand': 'New Zealand',
  ireland: 'Ireland', germany: 'Germany', france: 'France', italy: 'Italy',
  spain: 'Spain', netherlands: 'the Netherlands', belgium: 'Belgium',
  switzerland: 'Switzerland', austria: 'Austria', sweden: 'Sweden',
  norway: 'Norway', denmark: 'Denmark', finland: 'Finland', poland: 'Poland',
  turkey: 'Turkey', turkiye: 'Turkey', china: 'China', japan: 'Japan',
  'south korea': 'South Korea', korea: 'South Korea', malaysia: 'Malaysia',
  singapore: 'Singapore', thailand: 'Thailand', indonesia: 'Indonesia',
  philippines: 'the Philippines', vietnam: 'Vietnam', brazil: 'Brazil',
  'south africa': 'South Africa', egypt: 'Egypt'
};

function displayCountry(country) {
  if (!country) return null;
  const key = country.toLowerCase();
  if (COUNTRY_DISPLAY[key]) return COUNTRY_DISPLAY[key];
  return key.replace(/(^| )(\w)/g, (_, sp, ch) => sp + ch.toUpperCase());
}

/**
 * Build the minimum-clarification message for a question retrieval could not
 * ground at all. @returns {string} markdown copy in en / roman_urdu.
 */
export function askClarification(userQuery, activeLang = 'en') {
  const isRoman = activeLang === 'roman_urdu';
  const probe = parseOverseasIntent(String(userQuery || ''));
  if (probe.isOverseas) {
    const place = displayCountry(probe.country);
    if (place) {
      return isRoman
        ? `Mujhe ${place} ke qanoon ka koi verified record is zakhire mein nahi mila, aur main kisi mulk ka qanoon yaad se nahi bataunga. Main aap ko yeh verified Pakistan-facing rehnumai de sakta hoon: documents aur attestation, Pakistani mission/consular madad, visa aur immigration basics, overseas employment, study abroad, aur cross-border family/property muamlat. Aap ko in mein se kis cheez ki zaroorat hai, aur asal masla kya hai? Agar koi notice ya khat mila hai to use yahan upload karein — main uska tajzia karunga. ${place} ke maujooda sarkari rules (visa, fees, deadlines) ke liye main sirf official source ki taraf bhejunga, koi andaaza nahi lagao ga.`
        : `I could not find a verified record covering ${place}'s law in this corpus, and I will not guess any country's law from memory. What I CAN give you — from verified Pakistan-facing material — is guidance on: documents and attestation, Pakistani mission/consular help, visa and immigration basics, overseas employment, study abroad, and cross-border family/property matters. Which of these do you need, and what exactly happened? If you have received a notice or letter, upload it and I will analyze it for you. For ${place}'s current official rules (visa, fees, deadlines) I will only point you to the official authority — I will not invent them.`;
    }
    return isRoman
      ? `Mujhe aap ke sawal ka koi verified record nahi mila, aur main andaaze se qanooni jawab nahi dunga. Sahih rehnumai ke liye baraye meharbani bataayein: **aap kis mulk mein ja rahe hain (ya reh rahe hain)?** aur **maqsad kya hai — naukri/work, parhai/study, mustaqil rehna/settlement, family, ya visit?** Country aur maqsad batate hi main aap ko verified rehnumai de sakta hoon: documents, attestation, visa/immigration basics, overseas employment ke rules, study abroad ki zarooratain, consular madad, ya cross-border family/property ka tareeqa. Agar koi notice ya khat mila hai to use bhi upload kar sakte hain.`
      : `I could not find a verified record matching this yet, and I will not guess legal facts. To give you accurate, verified guidance, please tell me: **which country are you moving to (or living in)?** and **what is the purpose — work, study, permanent settlement, family, or a visit?** Once I know the country and purpose, I can give you the verified guidance that applies: documents and attestation, visa and immigration basics, overseas employment rules, study-abroad requirements, consular help, or cross-border family/property procedure. If you have received a notice or letter, upload it and I will analyze it.`;
  }
  return isRoman
    ? `Mujhe aap ke sawal se milta-julta koi verified Pakistani qanooni record nahi mila, aur main qanooni haqeeqat ghad kar nahi bataunga. Main phir bhi madad kar sakta hoon — baraye meharbani thori si aur detail bataayein: **asal masla kya hua** (masalan property, family, naukri, tenancy, ya koi criminal muamla) **aur aap kis shehar/province mein hain?** Agar koi notice, khat ya dastavez hai to use yahan upload karein — main use parh kar samjhaunga. Aap kisi procedure ke baare mein bhi pooch sakte hain (masalan "main kya karun..."), ya app mein Legal Library, legal-aid aur verified wakeel ki madad le sakte hain.`
    : `I could not find a verified Pakistani legal record that matches this exact question, and I will not guess legal facts. I can still help — please tell me a little more: **what actually happened** (for example a property, family, employment, tenancy or criminal matter), and **which city/province you are in**? If you have a notice, letter or document, upload it here and I will read and explain it for you. You can also ask me about a procedure ("what should I do..."), or use the Legal Library, legal-aid options and verified lawyers inside the app.`;
}

/**
 * Lighter follow-up used when retrieval DID answer from generic cross-border
 * context: restate what was answered, then ask the country/purpose that would
 * make it precise. @returns {string} markdown nudge, or '' when not applicable.
 */
export function crossBorderNudge(userQuery, activeLang = 'en') {
  const probe = parseOverseasIntent(String(userQuery || ''));
  if (!probe.isOverseas) return '';
  const isRoman = activeLang === 'roman_urdu';
  const asks = [];
  if (!probe.country) {
    asks.push(isRoman
      ? '**Ek zaroori baat:** aap ke sawal mein kisi mulk (country) ka naam nahi hai. Agar aap bata dein ke kis mulk mein ja rahe hain / reh rahe hain, to main documents, attestation aur official qadam us mulk ke hisaab se tailor kar sakta hoon — work, study, settlement ya family — bina kisi andaaze ke.'
      : '**One thing that would make this precise:** your question does not name a country. If you tell me which country you are moving to (or living in), I can tailor the documents, attestation and official steps for that destination — whether it is for work, study, settlement or family — without any guesswork.');
  } else if (!probe.purpose && probe.move) {
    asks.push(isRoman
      ? '**Ek aur baat:** kis maqsad ke liye move ho rahe hain — **naukri/work, parhai/study, mustaqil rehna/settlement, family, ya visit**? Maqsad batane se main sahi verified procedure aur documents ki taraf le ja sakta hoon.'
      : '**One more thing:** what is the purpose of the move — **work, study, permanent settlement, family, or a visit**? Knowing the purpose lets me point you to the right verified procedure and documents.');
  }
  return asks.join('\n\n');
}
