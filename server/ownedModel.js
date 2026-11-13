// ============================================================================
// Insaaf AI OWNED-MODEL INFERENCE  (Part C / AC / AD)
// ----------------------------------------------------------------------------
// This is Insaaf AI's OWN local legal-reasoning engine. It is the runtime's only
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
import { ANSWER_LEVELS, normalizeAnswerLevel, evidenceNoteText, queryEvidenceTokens, queryOwnWordForms } from './evidenceGate.js';
import { documentMetadata, isSelfReferentialAuthority } from './corpusMetadata.js';
import {
  deriveChunkScope, scopeLabel, applicabilityNote, missingScopeMessage,
  scopeLayerName, detectQueryScope
} from './corpusScope.js';
import { groundAnswerCitations } from './answerGrounding.js';

const EN = {
  issue: 'Issue',
  answer: 'Answer',
  law: 'Relevant law',
  says: 'What the law says',
  procedure: 'What you can do',
  fees: 'Published fee schedule',
  remedy: 'Possible remedy',
  precedent: 'Relevant precedent',
  forum: 'Jurisdiction / forum',
  source: 'Sources',
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
  procedure: 'Ab aap kya karein?',
  remedy: 'Mumkina tadaruk',
  precedent: 'Mutaliqa misali faisla',
  forum: 'Jurisdiction / forum',
  source: 'Qanooni hawalay',
  evidence: 'Yeh kitne mazboot record par hai',
  exceptions: 'Istisnat aur nuqsaat',
  limit: 'Zaroori tahaffuz',
  limitText: 'Ye verified Pakistani qanooni zakhire se li gayi aam qanooni maloomat hai, kisi licensed wakeel ke mashware ka mutabadil nahi. Muqadma kaise aage barhta hai aur us ka natija aap ke khais haqaiq, shawahid aur adalat par munhasir hai. Agar koi deadline ya peshi ki tareekh shamil hai to fori qadam uthayein aur wakeel ya mutaliqa adalat/office se tasdeeq karein.',
  provision: (type, key) => `${type === 'ARTICLE' ? 'Article' : 'Section'} ${key}`,
  statusNote: (s) => (s && String(s).toLowerCase() !== 'in force' ? ` — halat: ${s}` : '')
};

// Urdu Script answer surface. Section headings and framing prose are Urdu; a
// record's statutory wording is quoted unchanged (it is the evidence), and the
// English legal term stays bracketed next to its Urdu explanation so the reader
// can match it to the document they will file or the office they will visit.
const URDU = {
  issue: 'مسئلہ',
  answer: 'جواب',
  law: 'متعلقہ قانون',
  says: 'قانون کیا کہتا ہے',
  procedure: 'اب آپ کیا کریں؟',
  fees: 'شائع شدہ فیس',
  remedy: 'ممکنہ ازالہ',
  precedent: 'متعلقہ نظیر',
  forum: 'دائرہ اختیار / فورم',
  source: 'قانونی حوالے',
  evidence: 'یہ کس حد تک مستند ریکارڈ پر ہے',
  exceptions: 'استثنات و تفصیلات',
  limit: 'ضروری وضاحت',
  limitText: 'یہ معلومات مستند پاکستانی قانونی ذخیرے (verified law corpus) سے لی گئی عمومی قانونی رہنمائی ہے اور کسی لائسنس یافتہ وکیل (licensed advocate) کے مشورے کا متبادل نہیں۔ مقدمہ کیسے آگے بڑھے گا اور اس کا نتیجہ آپ کے مخصوص حقائق، شواہد اور عدالت پر منحصر ہے۔ اگر کوئی مقررہ مدت (deadline) یا پیشی کی تاریخ شامل ہو تو فوراً قدم اٹھائیں اور وکیل یا متعلقہ عدالت/دفتر سے تصدیق کریں۔',
  provision: (type, key) => `${type === 'ARTICLE' ? 'آرٹیکل' : 'دفعہ'} ${key}`,
  statusNote: (s) => (s && String(s).toLowerCase() !== 'in force' ? ` — حیثیت: ${s}` : '')
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

const QUERY_STOP = new Set(('the a an and or of to in for on with without is are was be what which how why when who whom whose can could should would do does did not no my me i you your our we they it this that these those about from as at by if into over under very much many more most all any some there here then than who\'s let make makes please tell explain define meaning used use works work ka ke ki ko mein main hai hain ho hota hoti kar karna kare karon karta karti raha rahe diya diya kya kis kon sa liye par se tak bhi hi awara').split(/\s+/));

/**
 * Forensic boilerplate: every judgment and every statute carries these words, so
 * agreeing on them says nothing about what a record is ABOUT. Two of them ("court"
 * and "Punjab") were enough to quote a 2026 Lahore High Court writ petition inside
 * an answer about Asma Jilani v. Government of Punjab.
 */
const BOILERPLATE_TERMS = new Set(('court courts supreme high honble judge judges judgment judgement order orders case cases law laws legal act acts section sections article articles subsection rule rules regulation petition petitions petitioner petitioners respondent respondents appellant applicants applicant plaintiff defendant counsel advocate learned decision decisions decided decide decide appeal appeals revision review constitution constitutional government province provincial state rules plaintiff government petitioner pltf').split(/\s+/));

/**
 * What the words of a script-only question are called in the corpus. Retrieval
 * already decided WHICH records came back; this only names the question's own
 * vocabulary in the language those records are written in, so ranking can tell
 * an account-fee record from an education-fee record for the same Urdu word فیس.
 */
function glossedCorpusTerms(query) {
  const out = [];
  try {
    for (const entry of queryOwnWordForms(String(query || ''), undefined)) {
      for (const form of (entry && entry.forms) || []) {
        const w = String(form).toLowerCase();
        if (/^[a-z']{3,}$/.test(w) && !QUERY_STOP.has(w) && !BOILERPLATE_TERMS.has(w)) out.push(w);
      }
    }
  } catch { return []; }
  return [...new Set(out)];
}

/** How many of the question's own words this record actually carries. */
function queryTermHits(query, chunk, gloss = null) {
  const words = new Set((String(query || '').toLowerCase().match(/[a-z']{3,}/g) || [])
    .filter(w => !QUERY_STOP.has(w) && !BOILERPLATE_TERMS.has(w)));
  if (!chunk) return 0;
  // An Urdu-script question has no Latin token, so the set above is empty and the
  // record that answers it cannot be told from the record that merely rode in on
  // a vector distance. The gloss list is that question's own words translated to
  // the vocabulary the corpus prints, and it is only used when there is no other
  // reading of what the user wrote.
  const terms = words.size ? words : new Set(gloss || []);
  if (!terms.size) return 0;
  // The WHOLE record, not its first 900 characters. A rule stated further down a
  // long record was invisible here, so the drug-abuse clause of a 3,828-character
  // welfare record outranked "Student Right to Appeal Disciplinary Decisions" for
  // a suspension-appeal question. Hits count DISTINCT query words, so a longer
  // scan cannot inflate a record the way raw term frequency would.
  const hay = `${chunk.chunkTitle || ''} ${chunk.title || ''} ${String(chunk.text || '').slice(0, 6000)}`.toLowerCase();
  let hits = 0;
  for (const w of terms) if (hay.includes(w)) hits++;
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
function ownIdentityHits(query, chunk, gloss = null) {
  const raw = `${String(chunk?.key || '').replace(/_/g, ' ')} ${chunk?.chunkTitle || ''}`.toLowerCase();
  const own = new Set((raw.match(/[a-z']{3,}/g) || []).filter(w => !QUERY_STOP.has(w)).map(stemTerm));
  if (!own.size) return 0;
  const words = new Set((String(query || '').toLowerCase().match(/[a-z']{3,}/g) || [])
    .filter(w => !QUERY_STOP.has(w)).map(stemTerm));
  const terms = words.size ? words : new Set((gloss || []).map(stemTerm));
  if (!terms.size) return 0;
  let hits = 0;
  for (const w of own) if (terms.has(w)) hits++;
  return hits;
}

/** A question about money the customer says the bank took wrongly. Used both for
 *  ranking (which record leads) and for the supporting-quote choice (the forum
 *  record, not the deposit-insurance clause). */
function isBankDeductionAsk(query) {
  const q = String(query || '');
  return /\b(bank|banking|account)\b/i.test(q)
    && /\b(deduct\w*|debit\w*|wrongful\w*|unauthori[sz]ed|dispute\w*|reversal|revers(?:e|ed)|refund\w*|not\s+(?:return|refund)\w*|wapis|kaat\w*)\b/i.test(q);
}

/** A policy's own cover section — scope, definitions, applicability — names the
 *  policy but states no rule. Retrieval's authorityLead mark belongs to the
 *  instrument, not to this heading, so it must not become the direct answer: a
 *  withdrawal-refund question was led by "3. SCOPE" and quoted a later clause
 *  starting "5.2. However…" whose "above-mentioned time frame" was never shown.
 *  The heading alone is not the test: the HEC refund policy's "# 3. SCOPE" chunk
 *  carries sections 3.1 through 8, so the cover heading sits on the operative
 *  text. Only a cover chunk that states nothing operative is excluded. */
function isNonOperativeSection(chunk) {
  const head = String((chunk && (chunk.chunkTitle || chunk.title)) || '').trim();
  const key = String((chunk && chunk.key) || '');
  const isCover = /^(?:#\s*)?(?:\d+(?:\.\d+)*\.?\s*)?(?:SCOPE|PREAMBLE|DEFINITIONS?|APPLICABILITY|OBJECTIVES?|INTRODUCTION)\b/i.test(head)
    || /_(?:SCOPE|PREAMBLE|DEFINITIONS|APPLICABILITY|OBJECTIVES|INTRODUCTION)$/i.test(key);
  if (!isCover) return false;
  const body = String((chunk && chunk.text) || '');
  return !/%|per\s?cent|\bdays?\b|\bweeks?\b|\bmonths?\b|deduct|cancel|withdraw|refund|shall\b|\bmust\b|liable|entitled|penalt|deadline|time\s*frame/i.test(body);
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
  // Nothing to rank on in Latin — ask the same dictionary the evidence gate uses
  // what the user's own words are called in the corpus. With no gloss either,
  // order is left exactly as retrieval returned it.
  const gloss = words.size ? null : glossedCorpusTerms(query);
  if (!words.size && !gloss.length) return [...(chunks || [])];
  // A "how do I recover X" question is answered by the procedural record. The
  // substance records state the right, but the citizen asked what to DO; a
  // statutory digest with one overlapping noun used to outrank the step-by-step
  // record. A deposit question ("refusing to return") keeps its substantive
  // answer because it names none of the recovery situations below.
  // A tenant whose rent was not paid, or a worker whose wages were withheld, is
  // asking how to recover money. The words they use for that are not the word
  // "recover", so those situations earn the procedure lift too.
  const recoveryAsk = /\b(recover\w*|wasool|not\s+paid|unpaid|arrears?|non.?payment|default\w*|evict\w*|withh(?:o|e)ld\w*|rok\w*|nahi\s+mila|na\s+diya)\b/i.test(String(query || ''));
  // A bank-deduction question asks WHICH FORUM hears the dispute. The record
  // that names the Banking Court or the Banking Mohtasib answers it, but the
  // depositor-protection clause shares the generic nouns "bank" and "account"
  // with the question and outranked it. The lift is gated on the deduction/dispute
  // wording, so ordinary banking-regulation questions keep their own order.
  const bankDisputeAsk = isBankDeductionAsk(query);
  // A survivor asking for protection from an abusive spouse is answered by the
  // protection-order record, not by the maintenance clause: both name "husband"
  // and "wife", and the maintenance record happened to rank first, so an abuse
  // question was answered with the right to maintenance. Gated on the violence
  // words in the same turn so an ordinary maintenance question keeps its record.
  const dvProtectionAsk = /\b(domestic\s+violence|abus\w*|batter\w*|beat\w*|assault\w*|zabardasti|zordeed|maar\s*p?eet)\b/i.test(String(query || ''))
    && /\b(husband|wife|spouse|shohar|biwi|partner|in[- ]?laws?|aurat|woman|women)\b/i.test(String(query || ''));
  // "How do I register an FIR" is answered by the filing procedure. The refusal
  // record repeats "register FIR" throughout its list of remedies, so it
  // out-scored the filing record and the answer opened with "the Sessions Judge
  // can direct the SHO" — a remedy for a refusal the user never mentioned. The
  // lift only applies when the question does not itself raise a refusal.
  const firFilingAsk = /\b(fir|first\s+information\s+report)\b/i.test(String(query || ''))
    && /\b(register|lodge|file|filing|darj|likhwa|kataw\w*)\b/i.test(String(query || ''))
    && !/\b(refus\w*|deni\w*|not\s+register\w*|mana|inkaar)\b/i.test(String(query || ''));
  const scored = (chunks || []).map((c, i) => {
    const own = ownIdentityHits(query, c, gloss);
    const procedural = recoveryAsk && /PROCEDURE|WORKFLOW|_STAGES|_PROCESS|STEPS/i.test(String(c.key || '')) ? 2 : 0;
    const forum = bankDisputeAsk && /\b(banking\s+court|mohtasib|complaint)\b/i.test(`${c.chunkTitle || ''} ${c.text || ''}`) ? 3 : 0;
    const protection = dvProtectionAsk && /\b(protection\s+order|protection\s+officer|residence\s+order|domestic\s+violence)\b/i.test(`${c.chunkTitle || ''} ${c.text || ''}`) ? 4 : 0;
    const filing = firFilingAsk && /FIR_(?:PROCEDURE|FILING)|FIR_FILING|WORKFLOW_FIR_FILING/i.test(String(c.key || '')) ? 3 : 0;
    return { c, i, s: own + queryTermHits(query, c, gloss) + procedural + forum + protection + filing, own };
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
    operative: /%|per\s?cent|\bday[s]?\b|deduct|cancell|withdr(?:aw|ew|awn)|refundabl|nonrefundable/i,
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
  // A cover section (SCOPE / DEFINITIONS / APPLICABILITY) is in the family's
  // document but states no rule. Treating it as the family's operative record
  // made "3. SCOPE" lead a withdrawal-refund answer and quote a later "5.2.
  // However…" whose antecedent was never shown.
  const isFam = (c) => inDoc(c) && !isNonOperativeSection(c)
    && (!fam.mustMatch || fam.mustMatch.test(String(`${c.chunkTitle || ''} ${c.text || ''}`)));
  const inFam = pool.filter(isFam);
  if (!inFam.length) return pool;
  let head = inFam;
  // A refund after withdrawal is governed by the cancellation/withdrawal rules
  // and the tuition-fee schedule, which sit in the policy's earlier sections. The
  // library/deposit/exam clauses also say "refundable", so without this the answer
  // quoted them instead of the tiers the student asked about.
  if (fam.id === 'refund' && /\b(withdr\w*|withdrew|cancel\w*|left|quit|drop\w*)\b/i.test(String(query || ''))) {
    const rank = (c) => (/canceling or withdrawing/i.test(String(c.text || '')) ? 2 : 0)
      + (/Percentage of Fee|\b100\s*%/i.test(String(c.text || '')) ? 1 : 0);
    inFam.sort((a, b) => rank(b) - rank(a));
  }
  // A refund question always wants the operative tiers, whether it says
  // "withdraw", "withdrew" or just "refusing to refund"; the other families
  // still only reorder when the question itself asks for their operative detail.
  if (fam.id === 'refund' || fam.operative.test(String(query || ''))) {
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

/** An address as printed inside a record runs into the punctuation of the line
 *  it sits in ("https://x.gov.pk;" in a semi-colon separated Source block), and
 *  a citation is only a citation if it is clickable. Only trailing punctuation
 *  is removed — a trailing slash is part of an address, not decoration. */
function cleanUrl(url) {
  return String(url || '').trim().replace(/["'`,;:)\]}]+$/g, '');
}

/** A record's own stated source address where it carries one. The manifest holds
 *  ONE url per document, while a civic/procedure document holds many services —
 *  so every record of that file, the passport one included, inherited the NADRA
 *  NICOP address. The line inside the record describes the record. */
function recordSourceUrl(chunk) {
  const own = String(chunk?.text || '').match(SOURCE_URL_LINE);
  return cleanUrl((own && own[1]) || chunk?.sourceURL || '');
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
 *  a different service than the one asked, the address the corpus registered for
 *  the document. Never another service's page, and never an address we composed
 *  ourselves — a truncated portal root is not where this record came from. */
function recordSource(chunk, asked) {
  const url = recordSourceUrl(chunk);
  if (!url || !asked || !asked.size) return url;
  const tag = urlServiceSet(url);
  if (!tag.size) return url;
  for (const s of tag) if (asked.has(s)) return url;
  const registered = cleanUrl(documentMetadata(chunk?.docId)?.sourceUrl || chunk?.sourceURL || '');
  return registered || url;
}

/**
 * The authority a record is attributed to. Only ever a string the corpus
 * registers for THIS document — never prose lifted out of the record.
 *
 * THE DEFECT THIS KILLS: the previous version returned the record's own
 * "Authority:" line for guide documents, which is free text written by whoever
 * harvested the page. Cards then read "NADRA (National Database and Registration
 * Authority)", "CrPC Sections 154, 22-A/22-B, 200", "Respective organization
 * official websites." and "Stamp Act, 1899. VERIFICATION: metadata-verified" —
 * some of those are statutes or ingest notes rather than institutions, none of
 * them is checkable against the corpus registry, and the last one shows internal
 * pipeline metadata reaching a citizen-facing card.
 *
 * A multi-service document registers several authorities in one slash-separated
 * field, so the field is split and the entry the record actually names is the one
 * published — spelled exactly as the registry spells it, because a citation that
 * cannot be matched back to the corpus is not a citation. When the record names
 * none of them and more than one is registered, nothing is claimed.
 */
const contentTokens = s => new Set(String(s || '').toLowerCase()
  .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ').split(' ').filter(w => w.length >= 4));
const abbreviations = s => (String(s || '').match(/\b[A-Z]{2,}\b/g) || []);

function recordAuthority(chunk) {
  if (!chunk) return '';
  const registered = String(documentMetadata(chunk.docId)?.authority || chunk.issuingAuthority || '').trim();
  if (!registered || isSelfReferentialAuthority(registered)) return '';
  // The separator is " / ", not "/": a registered string may hold a slash-list
  // of abbreviations inside parentheses, and splitting that apart publishes a
  // fragment of an institution's name.
  const entries = registered.split(/\s+\/\s+/).map(s => s.trim()).filter(Boolean);
  const text = String(chunk.text || '');
  const recordTokens = contentTokens(`${chunk.key || ''} ${chunk.chunkTitle || ''} ${text}`);
  const spoken = abbreviations(registered).filter(a => text.includes(a));
  if (spoken.length) {
    // A document registered as several agencies is about one of them per record,
    // and the record's own letterhead says which. The abbreviation is published
    // exactly as it appears inside the registered string.
    const counts = new Map();
    for (const m of text.matchAll(/\b[A-Z]{3,}\b/g)) {
      if (spoken.includes(m[0])) counts.set(m[0], (counts.get(m[0]) || 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length === 1 || ranked[0][1] > (ranked[1] || [0, 0])[1]) return ranked[0][0];
    return '';
  }
  if (entries.length <= 1) return entries[0] || registered;
  const fit = entries.map(e => {
    const tk = contentTokens(e);
    let shared = 0;
    for (const w of tk) if (recordTokens.has(w)) shared++;
    return { e, s: tk.size ? shared / tk.size : 0 };
  }).sort((a, b) => b.s - a.s);
  // One agency, named by the record itself, and clearly better than the rest.
  if (fit[0].s >= 0.34 && fit[0].s > (fit[1] ? fit[1].s : 0)) return fit[0].e;
  return '';
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
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/^\s*(?:laws?|title|wing|office|authority)\s*:\s*/i, '')
    .replace(/\s*[.—-]?\s*coverage\s*:[\s\S]*$/i, '')
    .replace(/\s*[.—-]?\s*(?:source|verification)\s*:[\s\S]*$/i, '')
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
 * A line that is only a label — "Library Fee :", "2. Transport Fee :" — is a
 * table stub whose value sits in the next row of the source layout, not a rule
 * and not a step. Quoted as either it prints a heading with nothing said.
 */
function isLabelStubLine(line) {
  return /^(?:\d+[.)]\s+)?[^:\n]{1,60}:\s*$/.test(String(line || '').trim());
}
export { isLabelStubLine };

/**
 * "Consumer Complaint Procedure — Step-by-Step" names the block it sits above;
 * it is not a step and not a rule. A Title-Cased run of words with no sentence
 * terminator is a heading in every ingest format in this corpus.
 */
function isHeadingLine(line) {
  const l = String(line || '').trim();
  if (/[.!?]$/.test(l)) return false;
  // Section labels are frequently one or two ALL-CAPS words ("SCOPE",
  // "CANCELLATION/WITHDRAWAL", "REFUNDABLE FEE"). They name the block that
  // follows; quoted as prose they printed as a bare heading in the answer.
  const bare = l.replace(/^\d+(?:\.\d+)*[.)]?\s*/, '').trim();
  if (bare && !/[a-z]/.test(bare) && /[A-Z]{2,}/.test(bare) && bare.split(/\s+/).length <= 6) return true;
  const toks = l.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
  if (toks.length < 3) return false;
  return toks.filter(t => /^[A-Z]/.test(t)).length / toks.length >= 0.8;
}
export { isHeadingLine };

/**
 * The ingest convention for "what this record is about": a sentence that opens
 * with a document-describing verb and never names an actor —
 * "- Governs residential and commercial tenancy disputes in Islamabad.",
 * "Governs rent and tenancy in urban areas of KP.",
 * "Arbitration Act, 1940 — Governs domestic arbitration in Pakistan."
 * It describes the filing cabinet, not the rule, so it can never answer a
 * citizen. Statutory sentences that state their own subject ("This Act applies
 * to …") are left alone: those are the instrument speaking, not the indexer.
 */
function isScopeAnnotationLine(line) {
  const l = String(line || '').trim()
    .replace(/^[-*•\s]+/, '')
    .replace(/^[\s\S]{0,120}?\s[—–]\s*/, '');
  return /^(governs?|covered|covers|deals with|concerns|describes?|summaris(?:es|ing)|summariz(?:es|ing)|enumerat(?:es|ing)|lists|recorded|it (?:covers|lists|describes)|this (?:record|document|note|entry|chunk|file) (?:covers|lists|describes|contains))\b/i.test(l);
}
export { isScopeAnnotationLine };

/**
 * A line whose whole content is a pointer to something else. The corpus is built
 * in passes, so a record can carry "See Circular No. 4/2025." where the rule
 * should be, and an indexer's "This provision applies to tenancy disputes
 * involving students." beside the provision it filed. Neither states a rule, and
 * an answer built on one tells a citizen nothing they can act on. An instrument
 * name is not a plumbing subject: "This Act applies to …" is the law speaking
 * about its own reach, which is a fact a citizen can use.
 */
function isCrossReferenceLine(line) {
  const l = String(line || '').trim().replace(/^[-*•\s]+/, '');
  if (/^(?:also\s+)?see\b/i.test(l) || /^refer(?:s|ed)?\s+to\b/i.test(l)
    || /^as\s+per\b/i.test(l)) return true;
  return /^this\s+(?:provision|section|subsection|sub-section|clause|paragraph|para|item|entry|rule)\b[^.!?]{0,90}\b(?:applies to|applies in|is applicable|extends to|relates to|pertains to)\b/i.test(l);
}
export { isCrossReferenceLine };

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
    // A markdown heading is the source file's layout, not the rule it contains.
    .filter(l => !l.startsWith('#'))
    // "Transport Fee :" with nothing after the colon is a table stub, a
    // Title-Cased line names the block and a "Governs …" line describes the
    // record; a "See …" or "This provision applies to …" line points somewhere
    // else. None of the four states a rule.
    .filter(l => !isLabelStubLine(l) && !isHeadingLine(l) && !isCorpusMetaLine(l)
      && !SECTION_LABEL_RE.test(l) && !isFeeRowLine(l) && !isScopeAnnotationLine(l)
      && !isCrossReferenceLine(l))
    // "SUBSTANCE:" is an ingest label sitting in front of the rule itself; the
    // rule is quotable, the label is not. Provenance lines (WING / SOURCE /
    // VERIFICATION) describe the record, not the law, and never reach a reader.
    .filter(l => !/^\s*(?:wing|office|source|verification)\s*:/i.test(l))
    .map(l => l.replace(/^[-*•]\s+/, '').replace(/^\s*substance\s*:\s*/i, ''));
  if (!all.length) return '';
  // Summary records store the provision itself in their title and repeat it as
  // their only body line — there, the title IS the content, so keep it.
  let lines = all.filter(l => !(title && norm(l) === title));
  if (!lines.length) lines = all;
  // "a." / "b)" sub-items belong to the numbered item above them. Leaving them
  // out of bullet mode dropped the item a sentence introduces ("… may approach:
  // a. The relevant Ombudsman …") and the quote ended on the colon.
  const bullets = lines.filter(l => /^(?:\d{1,3}|[a-z]{1,6})[.)]\s+|[-*•]\s+/.test(l));
  // Bullet mode is for records whose body IS the list (a label plus its items).
  // The HEC refund policy's clause chunk also carries a laboratory sub-list, and
  // bullets-only left "Personal Emergencies… Computer Laboratory…" while every
  // refund clause (3.1, 4.1, 7.2) was dropped — the answer then led with "5.2.
  // However…", whose antecedent was never shown. Multi-sentence prose outside
  // the list means the record states its rules in prose; keep every line.
  const prose = lines.filter(l => !bullets.includes(l)).join(' ');
  const proseSentences = splitSentences(prose).filter(s => hasSubstance(s, 25));
  const listOnly = proseSentences.length < 2;
  const kept = bullets.length >= 2 && listOnly ? bullets : lines;
  // Items introduced by a colon ("… under one of the categories:") are one
  // sentence, not six. Joining them with a space left each item as its own
  // "sentence", so a two-sentence quote stopped after the first item and the
  // answer read "… categories: Personal Emergencies."
  const joined = [];
  let listing = false;
  for (const l of kept) {
    const m = l.match(/^(?:(?:[ivxlcdm]{1,6}|\d{1,3}|[a-z])[.)]|[-*•])\s+(.*)$/);
    if (!m) {
      if (listing && joined.length) joined[joined.length - 1] = joined[joined.length - 1].replace(/[;,]\s*$/, '') + '.';
      listing = false;
      joined.push(l);
      continue;
    }
    // The marker belongs to the list item; its sentence punctuation does not.
    // Stripping the period from a STANDALONE item ("1. The employer has 15 days
    // to reply.") glued it to the next item and printed a wage answer as one
    // unpunctuated run.
    const raw = m[1].trim();
    const item = raw.replace(/\s*[;,]\s*$/, '').replace(/\.\s*$/, '');
    if (listing) {
      // An item that itself ends on a colon ("… the student may approach:")
      // introduces a nested list, so the next item follows the colon directly.
      joined[joined.length - 1] += `${/:\s*$/.test(joined[joined.length - 1]) ? ' ' : '; '}${item}`;
      continue;
    }
    if (joined.length && /:\s*$/.test(joined[joined.length - 1])) {
      joined[joined.length - 1] += ` ${item}`;
      listing = true;
    } else joined.push(raw);
  }
  if (listing && joined.length) joined[joined.length - 1] = joined[joined.length - 1].replace(/[;,]\s*$/, '') + '.';
  return joined.join(' ');
}

/**
 * One sentence splitter for every quote path. Corpus clause numbering
 * ("9.1. No student shall …") reads as its own sentence because the last period
 * is followed by a space, so a naive split cut the marker away from the
 * provision it numbers — the window then scored and returned the provision
 * without its number, and a one-sentence clip returned the bare number.
 * A marker belongs to the sentence it numbers, never on its own.
 */
function splitSentences(text) {
  const raw = String(text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  const parts = [];
  let pending = '';
  for (const p of raw) {
    if (!hasSubstance(p, 1)) { pending += `${p} `; continue; }
    parts.push(pending ? `${pending}${p}` : p);
    pending = '';
  }
  if (pending && !parts.length) parts.push(pending.trim());
  return parts;
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
  const literal = (String(query || '').toLowerCase().match(/[a-z']{4,}/g) || []);
  // The corpus is English-language. A Roman Urdu or Urdu-script question shares
  // no literal word with the record that answers it, so matching only the words
  // as typed left this function always answering "the opening is fine" — and the
  // opening of an ingest-built record is frequently a coverage description
  // ("Governs X disputes in Y"), not a rule. The gate's own gloss is the single
  // place that already turns these questions into corpus vocabulary.
  let glossed = [];
  try { glossed = queryEvidenceTokens(query); } catch { glossed = []; }
  // "Fee" is three letters but it is the subject of a fee question, and the
  // refund tier sentences each carry it; without it a sentence that says
  // "100% fee refund" scored below the floor and the scope paragraph answered.
  const feeTerms = /\b(fee|fees|refund|tuition|challan)\b/i.test(String(query || '')) ? ['fee', 'fees'] : [];
  // A withdrawal question is answered by the withdrawal clause ("Students
  // canceling or withdrawing … entitled to a refund"), whose words never appear
  // literally in "I withdrew" — include the record's own forms of the ask.
  const refundTerms = /\b(refund\w*|withdr(?:ew|aw|awn)|cancell?\w*)\b/i.test(String(query || ''))
    ? ['refund', 'withdraw', 'canceling', 'tuition'] : [];
  const words = [...new Set([...literal, ...glossed, ...feeTerms, ...refundTerms]
    .filter(w => w.length >= 4 || (w === 'fee' || w === 'fees'))
    .filter(w => !QUERY_STOP.has(w) && !BOILERPLATE_TERMS.has(w)))];
  if (!words.length) return '';
  const parts = splitSentences(body);
  if (parts.length < 3) return '';
  const scoreOf = (s) => {
    const l = s.toLowerCase();
    // Weight by the matched word's LENGTH, not by a flat count: when several
    // sentences carry one query word each, the one carrying the long, specific
    // word ("admission") is the answer and the ones carrying a short generic
    // one ("fee", "refund") are context. A flat count tied and kept whichever
    // sentence came first, so an admission-fee question was answered from the
    // library-fee clause printed above it.
    let n = 0;
    // A hit must BEGIN at a word boundary: "rent" inside "current" and
    // "different" is not the subject, and substring matching let unrelated
    // sentences clear the topical floor. Stems still reach their longer forms,
    // so "evict" scores "eviction" the way the gloss intends.
    for (const w of words) if (new RegExp(`(?:^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(l)) n += w.length;
    return n;
  };
  // One shared word is not the subject, and two incidental ones do not make a
  // sentence the answer. The opening used to keep its place whenever it cleared
  // that floor, so a tenant asking about being turned out was quoted the lease-
  // registration bullet of the same Act — the eviction sentence right below it
  // shared three of the question's words and was never consulted. Every sentence
  // is now scored on the same footing, and the opening is displaced only when
  // another is strictly more on-topic.
  let best = 0;
  let bestScore = scoreOf(parts[0]);
  parts.forEach((p, i) => {
    const s = scoreOf(p);
    if (s > bestScore) { bestScore = s; best = i; }
  });
  if (best < 1 || bestScore < 7) return '';
  // A step title ("Step 4: Written Statement & Leave to Contest.") carries no
  // instruction of its own; the sentence after it does. Starting on the body
  // pulled the NEXT step's bare title into the quote, so a rent-recovery answer
  // ended on "Step 4: Written Statement & Leave to Contest." — start on the
  // heading that introduced the chosen sentence, and always carry a heading's
  // own body line even when that spends one sentence beyond the cap.
  const isStepHeading = (s) => /^Step\s*\d+\s*[.:)\-\u2013\u2014]\s*\S/i.test(s)
    && /[.:]$/.test(s) && (s.match(/[A-Za-z]+/g) || []).length <= 10;
  let start = best;
  if (start > 0 && isStepHeading(parts[start - 1])) start -= 1;
  const picked = [];
  for (let i = start; i < parts.length; i++) {
    picked.push(parts[i]);
    if (picked.length >= Math.max(1, maxSentences) && !isStepHeading(parts[i])) break;
    if (picked.length > Math.max(1, maxSentences)) break;
  }
  return picked.join(' ');
}

function recordLead(chunk, maxSentences = 2, maxChars = 520, query = null) {
  const body = recordBody(chunk);
  if (body.replace(/[^A-Za-z\u0600-\u06FF]/g, '').length < 45) return '';
  // A block that never ends a sentence is a layout listing — a table of column
  // values or a publication index — not a rule stated in words. Named as a
  // source it is evidence; quoted as prose it pasted an entire contents page
  // into a citizen's answer, because joining the lines erases the table.
  if (body.length > 300 && (body.match(/[.!?](?:\s|$)/g) || []).length < 2) return '';
  const windowed = query ? onTopicWindow(body, query, maxSentences) : '';
  const clipped = clipSentences(windowed || body, maxSentences, maxChars);
  // A quote that lands on a bare list marker ("… under one of the categories:
  // i.") reads as a broken sentence; drop the orphan marker and its colon.
  const out = clipped.replace(/\s+(?:[ivx]{1,4}|[a-z])\.\s*$/i, '').replace(/[:;,]\s*$/, '').trim();
  // The floor belongs under the PART that is quoted, not under the record it
  // came from: a clause that reads "9.1." sits inside a document long enough to
  // clear any body-wide test, and quoting it told a student that was the rule.
  return hasSubstance(out) ? out : '';
}

/** Words a reader can act on. Clause numbers, cross-references and layout
 *  fragments have characters but no content. */
function hasSubstance(text, minAlpha = 30) {
  return String(text || '').replace(/[^A-Za-z\u0600-\u06FF]/g, '').length >= minAlpha;
}

/** What the SAME record says after the part already quoted — a record is only
 *  finished with once it has nothing left to give. */
function recordContinuation(chunk, shown, maxSentences = 2, maxChars = 520, query = null) {
  const body = recordBody(chunk);
  if (!body) return '';
  const parts = splitSentences(body);
  const shownNorm = norm(shown);
  let start = 0;
  // The lead quote is trimmed at its tail (a dangling "… categories: i."), so an
  // exact containment test no longer recognises it and the continuation started
  // by repeating the same clause. Compare on the head of each sentence too.
  while (start < parts.length) {
    const n = norm(parts[start]);
    if (n && (shownNorm.includes(n) || (n.length >= 40 && shownNorm.includes(n.slice(0, 40))))) start++;
    else if (!n) start++;
    else break;
  }
  // A multi-section record has more than one topic. Continuing with the next
  // sentence regardless pasted the following section into the answer — a
  // security-deposit question was "explained" by the Fair Rent clause printed
  // below it. The continuation must still carry a word of the ask; a record that
  // has nothing left about the question leaves the section out.
  let restParts = parts.slice(start);
  let end = start;
  if (query) {
    const words = (String(query).toLowerCase().match(/[a-z']{4,}/g) || [])
      .filter(w => !QUERY_STOP.has(w) && !BOILERPLATE_TERMS.has(w));
    if (words.length) {
      const carriesAsk = (p) => {
        const l = p.toLowerCase();
        return words.some(w => new RegExp(`(?:^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(l));
      };
      const next = parts.findIndex((p, i) => i >= start && carriesAsk(p));
      if (next < 0) return '';
      start = next;
      // Stop at the first sentence that no longer speaks about the ask: the Fair
      // Rent clause below a security-deposit rule shares the record's subject but
      // not the question's, and continuing past it pasted a different rule in.
      end = start;
      while (end < parts.length && end - start < Math.max(1, maxSentences) && carriesAsk(parts[end])) end++;
      restParts = parts.slice(start, end);
    }
  }
  // A sentence that introduces a list ("… the student may approach: a.") is
  // completed by the item after it. That item repeats none of the question's
  // words, so the ask scan stopped there and the quote ended on "may approach".
  const lastPart = restParts[restParts.length - 1] || '';
  if (end < parts.length && /[:;]\s*(?:(?:[ivx]{1,4}|[a-z])\.)?\s*$/i.test(lastPart)) {
    restParts = [...restParts, parts[end]];
  }
  const rest = restParts.join(' ');
  if (rest.replace(/[^A-Za-z\u0600-\u06FF]/g, '').length < 45) return '';
  const out = clipSentences(rest, maxSentences, maxChars)
    .replace(/([:;])\s+(?:[ivx]{1,4}|[a-z])\.\s+/gi, '$1 ')
    .replace(/\s+(?:[ivx]{1,4}|[a-z])\.\s*$/i, '').replace(/[:;,]\s*$/, '').trim();
  return hasSubstance(out) ? out : '';
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
  const sections = new Set(['answer', 'says', 'source', 'limit']);
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

// ----------------------------------------------------------------------------
// NATURAL GUIDANCE — what a knowledgeable person would say first.
// A citizen asking "how do I get an FIR registered" needs the human sequence
// (where to go, what to take, what to do if the police refuse) before a quoted
// clause. These blocks are plain-language guidance in the selected language,
// keyed to the question's intent. They are deliberately generic and accurate:
// no right, deadline, fee or section number is invented, and the retrieved
// records still drive the "Relevant law" and "Sources" sections. Nothing here
// claims that every complaint qualifies for an FIR or any other remedy.
// ----------------------------------------------------------------------------

const WOMEN_AREA_LABELS = [
  { re: /inheritance|succession|wirasat/i, en: 'inheritance', roman: 'wirasat', ur: 'وراثت' },
  { re: /harass/i, en: 'protection from harassment at the workplace', roman: 'kaam ki jagah harassment se hifazat', ur: 'کام کی جگہ ہراسانی سے تحفظ' },
  { re: /domestic violence|protection of women against violence|women against violence/i, en: 'protection from domestic violence', roman: 'gharelu tashaddud se hifazat', ur: 'گھریلو تشدد سے تحفظ' },
  { re: /maintenance/i, en: 'maintenance (nafaqa)', roman: 'nafaqa', ur: 'نان نفقہ' },
  { re: /dowry|bridal/i, en: 'dowry and bridal gifts', roman: 'jahez aur shaadi ke tohfe', ur: 'جہیز اور شادی کے تحفے' },
  { re: /nikkah|nikah|marriage/i, en: 'marriage registration', roman: 'nikah ki registration', ur: 'نکاح کی رجسٹریشن' },
  { re: /property|possession|residence order/i, en: 'property and residence rights', roman: 'jaidad aur rehaish ke huqooq', ur: 'جائیداد اور رہائش کے حقوق' }
];

function womenRightsLead(focus, lang) {
  const areas = [];
  for (const c of focus || []) {
    const hay = `${c.chunkTitle || ''} ${c.title || ''}`;
    for (const a of WOMEN_AREA_LABELS) {
      if (a.re.test(hay) && !areas.includes(a[lang])) areas.push(a[lang]);
    }
  }
  const list = areas.slice(0, 6);
  const joined = list.length > 1
    ? `${list.slice(0, -1).join(', ')}${lang === 'ur' ? ' اور ' : lang === 'roman' ? ' aur ' : ' and '}${list[list.length - 1]}`
    : (list[0] || '');
  if (lang === 'ur') {
    return `پاکستانی قانون عورتوں کو کئی شعبوں میں تحفظ دیتا ہے${joined ? `، جن میں ${joined} شامل ہیں` : ''}۔ ہر معاملے پر کون سا قانون لاگو ہوگا یہ اس بات پر منحصر ہے کہ مسئلہ کیا ہے اور آپ کس صوبے میں ہیں۔`;
  }
  if (lang === 'roman') {
    return `Pakistani qanoon khawateen ko kai shebon mein hifazat deta hai${joined ? `, jin mein ${joined} shamil hain` : ''}. Har mamlay par kaunsa qanoon laagu hoga yeh is baat par munhasir hai ke masla kya hai aur aap kis province mein hain.`;
  }
  return `Pakistani law gives women protection in several areas${joined ? `, including ${joined}` : ''}. Which law applies depends on the issue and on your province.`;
}

const GUIDANCE = {
  'police-fir': {
    en: {
      lead: 'If something happened to you that can be reported as a cognizable offence, go to the police station for the area where it happened and tell the duty officer or the SHO what happened. Section 154 of the Code of Criminal Procedure deals with information given to the police about a cognizable offence. It does not mean every complaint automatically becomes an FIR — the police first look at whether the information discloses such an offence. Keep the date, place, details of the person involved and any evidence with you.',
      steps: [
        'Write down what happened in order: date, time, place, and who was involved.',
        'Take the evidence you have — photos, messages, medical papers, witness names and phone numbers.',
        'Go to the police station for the area where the incident happened and meet the duty officer or the SHO.',
        'Tell them what happened clearly and ask that your information be recorded; ask for your copy or receipt.',
        'If the police refuse to record it, send the same written complaint to the Superintendent of Police or District Police Officer and keep proof that you delivered it.',
        'If that still does not work, ask a lawyer or a legal-aid service about filing a complaint before the court.'
      ],
      followUp: 'Tell me what happened and in which city or district, and I can point you to the right police station and the law that applies more closely.'
    },
    roman: {
      lead: 'Agar aap ke saath aisa waqia pesh aaya hai jis par FIR darj ho sakti hai to apne ilaqe ke mutaliqa thane jayein aur duty officer ya SHO ko waqia ki tafseel batayein. Section 154 CrPC police ko cognizable offence ki ittila dene ke mamlay se mutaliq hai. Iska matlab yeh nahi ke har shikayat khud-ba-khud FIR ban jati hai — police pehle dekhti hai ke ittila mein aisa jurm nazar aata hai ya nahi. Waqia ki tareekh, jagah, mulzim ki maloomat aur maujood saboot saath rakhein.',
      steps: [
        'Waqia tarteeb se likhein: tareekh, waqt, jagah aur kaun shamil tha.',
        'Jo saboot aap ke paas hai saath lein — tasveerein, messages, medical papers, gawahon ke naam aur phone numbers.',
        'Jis ilaqe mein waqia hua us thane jayein aur duty officer ya SHO se milein.',
        'Waqia saaf saaf batayein aur keh dein ke aap ki ittila record ki jaye; apni copy ya receipt zaroor lein.',
        'Agar police record karne se inkaar kare to wahi likhit shikayat Superintendent of Police ya District Police Officer ko bhejein aur delivery ka saboot rakhein.',
        'Agar phir bhi kaam na bane to wakeel ya legal-aid service se poochein ke adalat mein shikayat kaise dair ki jati hai.'
      ],
      followUp: 'Agar aap bata dein ke kya hua aur kis shehar ya zile mein, to main sahi thana aur mutaliqa qanoon zyada qareeb se bata sakta hoon.'
    },
    ur: {
      lead: 'اگر آپ کے ساتھ کوئی ایسا واقعہ پیش آیا ہے جس پر ایف آئی آر درج ہو سکتی ہے تو اپنے علاقے کے متعلقہ تھانے میں جائیں اور ڈیوٹی افسر یا ایس ایچ او کو واقعے کی تفصیل بتائیں۔ دفعہ 154 ضابطہ فوجداری (CrPC) پولیس کو قابلِ سماعت جرم کی اطلاع دینے سے متعلق ہے۔ اس کا مطلب یہ نہیں کہ ہر شکایت خود بخود ایف آئی آر بن جاتی ہے — پولیس پہلے دیکھتی ہے کہ اطلاع میں ایسا جرم نظر آتا ہے یا نہیں۔ واقعے کی تاریخ، جگہ، ملزم کی معلومات اور موجود ثبوت ساتھ رکھیں۔',
      steps: [
        'واقعہ ترتیب سے لکھیں: تاریخ، وقت، جگہ اور کون شامل تھا۔',
        'جو ثبوت آپ کے پاس ہے ساتھ لے جائیں — تصاویر، پیغامات، میڈیکل کاغذات، گواہوں کے نام اور فون نمبر۔',
        'جس علاقے میں واقعہ پیش آیا اس تھانے میں جائیں اور ڈیوٹی افسر یا ایس ایچ او سے ملیں۔',
        'واقعہ صاف صاف بتائیں اور کہیں کہ آپ کی اطلاع ریکارڈ کی جائے؛ اپنی کاپی یا رسید ضرور لیں۔',
        'اگر پولیس ریکارڈ کرنے سے انکار کرے تو وہی تحریری شکایت ایس پی یا ڈسٹرکٹ پولیس آفیسر کو بھیجیں اور ثبوت رکھیں کہ وہ پہنچی ہے۔',
        'اگر پھر بھی کام نہ بنے تو وکیل یا قانونی امداد سے پوچھیں کہ عدالت میں شکایت کیسے دائر کی جاتی ہے۔'
      ],
      followUp: 'اگر آپ بتا دیں کہ کیا ہوا اور کس شہر یا ضلع میں، تو میں صحیح تھانہ اور متعلقہ قانون زیادہ قریب سے بتا سکتا ہوں۔'
    }
  },
  'cyber-harassment': {
    en: {
      lead: 'Online harassment, blackmail, fake accounts and sharing someone\'s private pictures without consent are offences under Pakistani law, including the Prevention of Electronic Crimes Act 2016. You can complain to the FIA Cyber Crime Wing and to the police for your area. Do not delete anything — the messages, screenshots and account links are your evidence.',
      steps: [
        'Save every message, post, comment and profile link, with screenshots that show the account name, date and time.',
        'Write down what happened in order: date, time, platform, account names and what was said or sent.',
        'Do not reply to or delete the material; block the account only after the evidence is saved.',
        'Report the account to the platform as well.',
        'File a written complaint with the FIA Cyber Crime Wing (complaint.fia.gov.pk) or the police station for your area, and keep the complaint copy or receipt.',
        'If you feel unsafe, tell a trusted person and ask the police about protection; legal aid is available.'
      ],
      followUp: 'Tell me which platform was used and what was sent, and I can explain the next step for that situation.'
    },
    roman: {
      lead: 'Online harassment, blackmail, fake accounts aur kisi ki private tasveerein ijazat ke baghair share karna Pakistani qanoon ke tehat jurm hain, jin mein Prevention of Electronic Crimes Act 2016 bhi shamil hai. Aap FIA Cyber Crime Wing aur apne ilaqe ki police ko shikayat de sakte hain. Kuch bhi delete na karein — messages, screenshots aur account links hi aap ka saboot hain.',
      steps: [
        'Har message, post, comment aur profile link mehfooz karein; screenshots mein account ka naam, tareekh aur waqt nazar aaye.',
        'Waqia tarteeb se likhein: tareekh, waqt, platform, account ke naam aur kya kaha ya bheja gaya.',
        'Jawab na dein aur material delete na karein; saboot mehfooz karne ke baad account block karein.',
        'Platform ko bhi report karein.',
        'FIA Cyber Crime Wing (complaint.fia.gov.pk) ya apne ilaqe ke thane mein likhit shikayat dair karein, aur uski copy ya receipt rakhein.',
        'Agar aap khud ko ghair mehfooz mehsoos karein to kisi bharosemand insaan ko batayein aur police se hifazat ke baare mein poochein; legal aid bhi maujood hai.'
      ],
      followUp: 'Batayein kis platform par yeh hua aur kya bheja gaya, to main us surat-e-haal ka agla qadam bata sakta hoon.'
    },
    ur: {
      lead: 'آن لائن ہراسانی، بلیک میلنگ، جعلی اکاؤنٹس اور کسی کی نجی تصاویر اس کی اجازت کے بغیر شیئر کرنا پاکستانی قانون کے تحت جرم ہیں، جن میں پریوینشن آف الیکٹرانک کرائمز ایکٹ 2016 شامل ہے۔ آپ ایف آئی اے سائبر کرائم ونگ اور اپنے علاقے کی پولیس کو شکایت دے سکتے ہیں۔ کچھ بھی ڈیلیٹ نہ کریں — پیغامات، اسکرین شاٹس اور اکاؤنٹ لنکس ہی آپ کے ثبوت ہیں۔',
      steps: [
        'ہر پیغام، پوسٹ، تبصرہ اور پروفائل لنک محفوظ کریں؛ اسکرین شاٹ میں اکاؤنٹ کا نام، تاریخ اور وقت نظر آئے۔',
        'واقعہ ترتیب سے لکھیں: تاریخ، وقت، پلیٹ فارم، اکاؤنٹ کے نام اور کیا کہا یا بھیجا گیا۔',
        'جواب نہ دیں اور مواد ڈیلیٹ نہ کریں؛ ثبوت محفوظ کرنے کے بعد اکاؤنٹ بلاک کریں۔',
        'پلیٹ فارم کو بھی رپورٹ کریں۔',
        'ایف آئی اے سائبر کرائم ونگ (complaint.fia.gov.pk) یا اپنے علاقے کے تھانے میں تحریری شکایت دائر کریں، اور اس کی کاپی یا رسید رکھیں۔',
        'اگر آپ خود کو غیر محفوظ محسوس کریں تو کسی بھروسے مند شخص کو بتائیں اور پولیس سے تحفظ کے بارے میں پوچھیں؛ قانونی امداد بھی موجود ہے۔'
      ],
      followUp: 'بتائیں کہ یہ کس پلیٹ فارم پر ہوا اور کیا بھیجا گیا، تو میں اس صورتِ حال کا اگلا قدم بتا سکتا ہوں۔'
    }
  },
  harassment: {
    en: {
      lead: 'If someone is harassing you at work, at university or in public, Pakistani law gives you protection. A workplace or educational institution must have an Inquiry Committee to receive a written complaint, and you can complain to the provincial Ombudsperson if the institution does not act.',
      steps: [
        'Write down the dates, places, what was said or done, and who saw it.',
        'Keep messages, emails, screenshots or any other evidence.',
        'File a written complaint with the institution\'s Inquiry Committee, or with the relevant authority for your situation.',
        'Keep your copy and the receipt or diary number of the complaint.',
        'If no action is taken, complain to the provincial Ombudsperson and ask a legal-aid service for help.'
      ],
      followUp: 'Tell me where the harassment happened — at work, at a university, or somewhere else — and I can be more specific.'
    },
    roman: {
      lead: 'Agar koi aap ko kaam ki jagah, university ya kisi aur jagah pareshan kar raha hai to Pakistani qanoon aap ko hifazat deta hai. Workplace ya taleemi idara mein written shikayat ke liye Inquiry Committee hona zaroori hai, aur agar idara action na le to aap provincial Ombudsperson ko shikayat kar sakte hain.',
      steps: [
        'Tareekhen, jagah, kya kaha ya kiya gaya aur kis ne dekha — sab likh lein.',
        'Messages, emails, screenshots ya koi aur saboot mehfooz karein.',
        'Idare ki Inquiry Committee ya apne maslay ki mutaliqa authority ko likhit shikayat dein.',
        'Shikayat ki apni copy aur receipt ya diary number zaroor rakhein.',
        'Agar koi action na ho to provincial Ombudsperson ko shikayat karein aur legal-aid se madad lein.'
      ],
      followUp: 'Batayein yeh kaam ki jagah par hua, university mein ya kisi aur jagah, to main zyada wazeh rehnumai de sakta hoon.'
    },
    ur: {
      lead: 'اگر کوئی آپ کو کام کی جگہ، یونیورسٹی یا کسی اور جگہ ہراساں کر رہا ہے تو پاکستانی قانون آپ کو تحفظ دیتا ہے۔ کام کی جگہ یا تعلیمی ادارے میں تحریری شکایت کے لیے انکوائری کمیٹی ہونا ضروری ہے، اور اگر ادارہ کارروائی نہ کرے تو آپ صوبائی محتسب (Ombudsperson) کو شکایت کر سکتے ہیں۔',
      steps: [
        'تاریخیں، جگہیں، کیا کہا یا کیا گیا اور کس نے دیکھا — سب لکھ لیں۔',
        'پیغامات، ای میلز، اسکرین شاٹس یا کوئی اور ثبوت محفوظ کریں۔',
        'ادارے کی انکوائری کمیٹی یا اپنے معاملے کی متعلقہ اتھارٹی کو تحریری شکایت دیں۔',
        'شکایت کی اپنی کاپی اور رسید یا ڈائری نمبر ضرور رکھیں۔',
        'اگر کوئی کارروائی نہ ہو تو صوبائی محتسب کو شکایت کریں اور قانونی امداد سے مدد لیں۔'
      ],
      followUp: 'بتائیں یہ کام کی جگہ پر ہوا، یونیورسٹی میں یا کسی اور جگہ، تو میں زیادہ واضح رہنمائی دے سکتا ہوں۔'
    }
  },
  khula: {
    en: {
      lead: 'Khula is a wife\'s application to the Family Court to end the marriage. The court sends notice to the husband and tries reconciliation; if that does not work, the court decides the case according to the law. The application is filed in writing in the Family Court that has jurisdiction where you live.',
      steps: [
        'Gather your Nikah Nama, CNIC, marriage-registration papers and any documents about dowry, children or property.',
        'Talk to a family lawyer or a legal-aid service about your situation and the correct Family Court.',
        'File a written khula application in the Family Court.',
        'Attend the hearings, including the reconciliation stage, and keep every notice and order.',
        'After the decree, get a certified copy and ask your lawyer about the registration and waiting-period steps that follow.'
      ],
      followUp: 'Tell me your province and whether there are children or property involved, and I can add the points that matter for your case.'
    },
    roman: {
      lead: 'Khula biwi ki taraf se Family Court mein shaadi khatam karne ki darkhwast hai. Court shohar ko notice bhejti hai aur sulah ki koshish karti hai; agar sulah na ho to court qanoon ke mutabiq faisla karti hai. Darkhwast likhit mein us Family Court mein dair hoti hai jahan aap rehti hain.',
      steps: [
        'Nikah Nama, CNIC, nikah registration ke kaghazat aur jahez, bachon ya jaidad se mutaliq documents ikatthe karein.',
        'Family wakeel ya legal-aid service se apni surat-e-haal aur sahi Family Court ke baare mein baat karein.',
        'Family Court mein likhit khula application dair karein.',
        'Sunnaiyon mein hazir hon, jis mein sulah ka marhala bhi shamil hai, aur har notice aur order sambhal kar rakhein.',
        'Decree ke baad certified copy lein aur wakeel se registration aur iddat ke agle qawaneen ke baare mein poochein.'
      ],
      followUp: 'Apna province aur yeh batayein ke bachay ya jaidad shamil hai ya nahi, to main aap ke case ke mutaliq mazeed nuktay bata sakta hoon.'
    },
    ur: {
      lead: 'خلع بیوی کی طرف سے فیملی کورٹ میں نکاح ختم کرنے کی درخواست ہے۔ عدالت شوہر کو نوٹس بھیجتی ہے اور صلح کی کوشش کرتی ہے؛ اگر صلح نہ ہو تو عدالت قانون کے مطابق فیصلہ کرتی ہے۔ درخواست تحریری طور پر اس فیملی کورٹ میں دائر ہوتی ہے جہاں آپ رہتی ہیں۔',
      steps: [
        'نکاح نامہ، شناختی کارڈ، نکاح کی رجسٹریشن کے کاغذات اور جہیز، بچوں یا جائیداد سے متعلق دستاویزات جمع کریں۔',
        'فیملی وکیل یا قانونی امداد سے اپنی صورتِ حال اور درست فیملی کورٹ کے بارے میں بات کریں۔',
        'فیملی کورٹ میں تحریری خلع کی درخواست دائر کریں۔',
        'سماعتوں میں حاضر ہوں، جن میں صلح کا مرحلہ بھی شامل ہے، اور ہر نوٹس اور حکم نامہ سنبھال کر رکھیں۔',
        'ڈگری کے بعد تصدیق شدہ کاپی لیں اور وکیل سے رجسٹریشن اور عدت کے بعد کے قانونی مراحل کے بارے میں پوچھیں۔'
      ],
      followUp: 'اپنا صوبہ اور یہ بتائیں کہ بچے یا جائیداد شامل ہیں یا نہیں، تو میں آپ کے معاملے سے متعلق مزید نکات بتا سکتا ہوں۔'
    }
  },
  tenancy: {
    en: {
      lead: 'A landlord cannot simply keep your security deposit without a legal reason. What you can do depends on your written tenancy agreement and on the rent law of your province, so keep the agreement and any receipt for the deposit.',
      steps: [
        'Read the tenancy agreement for the deposit, notice and handover clauses.',
        'Write a written demand to the landlord asking for the deposit back, and keep proof that it was delivered.',
        'Gather proof of payment — bank transfer, receipt, or witnesses.',
        'If the landlord still refuses, ask a lawyer or legal-aid service about the Rent Controller or civil court for your area.',
        'If you are moving out, do not hand over the keys without a written condition and handover report.'
      ],
      followUp: 'Tell me your province and whether you have a written agreement, and I can narrow down the correct forum.'
    },
    roman: {
      lead: 'Makaan malik kisi qanooni wajah ke baghair aap ka security deposit nahi rakh sakta. Aap kya kar sakte hain yeh aap ke likhit kiraya agreement aur aap ke province ke rent qanoon par munhasir hai, is liye agreement aur deposit ki receipt sambhal kar rakhein.',
      steps: [
        'Kiraya agreement mein deposit, notice aur handover ki shartein parhein.',
        'Makaan malik ko likhit demand bhejein ke deposit wapas kiya jaye, aur us ke pahunchne ka saboot rakhein.',
        'Payment ka saboot ikattha karein — bank transfer, receipt ya gawah.',
        'Agar makaan malik phir bhi inkaar kare to wakeel ya legal-aid se apne ilaqe ke Rent Controller ya civil court ke baare mein poochein.',
        'Agar aap ghar chhod rahe hain to likhit condition aur handover report ke baghair chabiyan na dein.'
      ],
      followUp: 'Apna province aur yeh batayein ke likhit agreement hai ya nahi, to main sahi forum tak baat mehdood kar sakta hoon.'
    },
    ur: {
      lead: 'مکان مالک کسی قانونی وجہ کے بغیر آپ کا سیکیورٹی ڈپازٹ نہیں رکھ سکتا۔ آپ کیا کر سکتے ہیں یہ آپ کے تحریری کرایہ نامے اور آپ کے صوبے کے کرایہ داری قانون پر منحصر ہے، اس لیے کرایہ نامہ اور ڈپازٹ کی رسید سنبھال کر رکھیں۔',
      steps: [
        'کرایہ نامے میں ڈپازٹ، نوٹس اور حوالگی کی شرائط پڑھیں۔',
        'مکان مالک کو تحریری مطالبہ بھیجیں کہ ڈپازٹ واپس کیا جائے، اور اس کے پہنچنے کا ثبوت رکھیں۔',
        'ادائیگی کا ثبوت جمع کریں — بینک ٹرانسفر، رسید یا گواہ۔',
        'اگر مکان مالک پھر بھی انکار کرے تو وکیل یا قانونی امداد سے اپنے علاقے کے رنٹ کنٹرولر یا سول عدالت کے بارے میں پوچھیں۔',
        'اگر آپ گھر چھوڑ رہے ہیں تو تحریری حالت اور حوالگی رپورٹ کے بغیر چابیاں نہ دیں۔'
      ],
      followUp: 'اپنا صوبہ اور یہ بتائیں کہ تحریری معاہدہ ہے یا نہیں، تو میں صحیح فورم تک بات محدود کر سکتا ہوں۔'
    }
  },
  student: {
    en: {
      lead: 'Students in Pakistan have protections under their university\'s own regulations and HEC policies. These usually cover fair treatment, a written disciplinary process, protection from harassment, fee and refund rules, and a way to complain when a decision is unfair. The exact rule depends on your university.',
      steps: [
        'Read your university\'s student handbook or regulations and note the complaint and appeal channel.',
        'Put your request or complaint in writing.',
        'Get it received with a diary number or stamp, and keep a copy.',
        'Follow the internal complaint or appeal path in the order the regulations set.',
        'If the university does not respond, ask HEC or a legal-aid service about the next step.'
      ],
      followUp: 'Tell me which university and what the problem is, and I can point to the rule that usually covers it.'
    },
    roman: {
      lead: 'Pakistan mein students ko apni university ke regulations aur HEC policies ke tehat hifazat hasil hai. In mein aam tor par insaaf, likhit disciplinary tareeqa, harassment se hifazat, fees aur refund ke rules, aur ghair-munsif faislay ke khilaf shikayat ka raasta shamil hota hai. Asal rule aap ki university par munhasir hai.',
      steps: [
        'Apni university ka student handbook ya regulations parhein aur complaint aur appeal ka channel note karein.',
        'Apni darkhwast ya shikayat likhit mein dein.',
        'Us par diary number ya stamp laga kar receive karwayein aur copy rakhein.',
        'Regulations ke mutabiq internal complaint ya appeal ke marahil tarteeb se follow karein.',
        'Agar university jawab na de to HEC ya legal-aid service se agle qadam ke baare mein poochein.'
      ],
      followUp: 'Batayein kaunsi university hai aur masla kya hai, to main us qanoon ki taraf ishara kar sakta hoon jo aam tor par is par lagta hai.'
    },
    ur: {
      lead: 'پاکستان میں طلبہ کو اپنی یونیورسٹی کے ضوابط اور ایچ ای سی کی پالیسیوں کے تحت تحفظ حاصل ہے۔ ان میں عام طور پر انصاف، تحریری تادیبی طریقہ کار، ہراسانی سے تحفظ، فیس اور ریفنڈ کے قواعد، اور غیر منصفانہ فیصلے کے خلاف شکایت کا راستہ شامل ہوتا ہے۔ اصل قاعدہ آپ کی یونیورسٹی پر منحصر ہے۔',
      steps: [
        'اپنی یونیورسٹی کا طلبہ ہینڈ بک یا ضوابط پڑھیں اور شکایت اور اپیل کا راستہ نوٹ کریں۔',
        'اپنی درخواست یا شکایت تحریری طور پر دیں۔',
        'اس پر ڈائری نمبر یا مہر لگوا کر وصول کریں اور ایک کاپی رکھیں۔',
        'ضوابط کے مطابق ادارے کے اندر شکایت یا اپیل کے مراحل ترتیب سے مکمل کریں۔',
        'اگر یونیورسٹی جواب نہ دے تو ایچ ای سی یا قانونی امداد سے اگلے قدم کے بارے میں پوچھیں۔'
      ],
      followUp: 'بتائیں کون سی یونیورسٹی ہے اور مسئلہ کیا ہے، تو میں اس قاعدے کی طرف اشارہ کر سکتا ہوں جو عام طور پر اس پر لاگو ہوتا ہے۔'
    }
  }
};

const WOMEN_BROAD_RE = /(khawateen|khawateen\s+ke\s+huqooq|women'?s\s+rights|rights\s+of\s+women|خواتین|عورت|عورتوں)/i;
const WOMEN_SPECIFIC_RE = /\b(inheritance|wirasat|marriage|nikah|divorce|talaq|khula|maintenance|nafaqa|domestic|violence|custody|harass\w*|workplace|job|property|jaidad|dowry|jahez|acid)\b|وراثت|شادی|طلاق|خلع|نفقہ|گھریلو|تشدد|حراست|ہراسانی|جائیداد|جہیز/i;

function guidanceKey(query) {
  const q = String(query || '');
  if (WOMEN_BROAD_RE.test(q) && !WOMEN_SPECIFIC_RE.test(q)) return 'women-rights';
  if (/(cyber|online|internet|facebook|whatsapp|instagram|snapchat|tiktok|blackmail|fake account|سائبر|آن لائن|انٹرنیٹ|بلیک میل|جعلی اکاؤنٹ)/i.test(q)) return 'cyber-harassment';
  if (/(khula|خلع)/i.test(q)) return 'khula';
  if (/(\bfir\b|first information report|police complaint|police refuse|ایف\s*آئی\s*آر|تھانہ|تھانے)/i.test(q)) return 'police-fir';
  if (/(harass|ہراساں|ہراسانی|pareshan)/i.test(q)) return 'harassment';
  if (/(security deposit|tenant|landlord|kiraya|kirayadar|rent(?:ed)?\s+(?:house|flat)|deposit|کرایہ|کرایہ دار|مالک مکان|ڈپازٹ)/i.test(q)) return 'tenancy';
  if (/(student|university|college|hostel|scholarship|طالب علم|طلبہ|یونیورسٹی|کالج|وظیفہ)/i.test(q)) return 'student';
  return null;
}

function naturalGuidance(key, lang, ctx = {}) {
  if (key === 'women-rights') {
    const lead = womenRightsLead(ctx.focus, lang);
    const followUp = lang === 'ur'
      ? 'آپ کو ان میں سے کس معاملے کی معلومات چاہیے؟ مسئلہ بتائیں تو میں متعلقہ قانون اور عملی اقدامات سمجھا دوں گا۔'
      : lang === 'roman'
        ? 'Aap ko in mein se kis mamlay ki maloomat chahiye? Masla bata dein to main mutaliqa qanoon aur amli qadam samjha doon ga.'
        : 'Which of these areas is your situation about? Tell me the issue and I will explain the law and the practical steps that apply.';
    return { lead, steps: [], followUp };
  }
  const block = GUIDANCE[key];
  if (!block) return null;
  return block[lang] || block.en || null;
}

/**
 * The next record that carries the ask, for the "what the law says" section.
 * The section used to fall back on a keyword table: `detectQueryIntent` picked
 * a canned paragraph — "Property rights are protected by law. Clear provisions
 * govern registration, possession, and transfer." — which no retrieved record
 * states and which answered a different question from the one asked. A tenant
 * told the eviction rule they were entitled to instead read a generic property
 * blurb, because the table fired before the evidence was used up.
 *
 * Now the section is filled from the records or not at all: each grounded
 * record in retrieval order gets the same topical floor every other quote has
 * to clear, and an answer that has nothing left to say leaves the section out.
 */
function nextGroundedExplanation(userQuery, grounded, answerRecord, lvl) {
  for (const c of grounded) {
    if (!c || c === answerRecord) continue;
    if (queryTermHits(userQuery, c) < 2) continue;
    const lead = recordLead(c, lvl.answerSentences, lvl.explanationChars, userQuery);
    if (lead) return lead;
  }
  return '';
}

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

/** Published percentage refund tiers ("Upto 10th day … 100% fee refund"). They
 *  are the operative answer to a refund question, and they are not amounts, so
 *  the fee-schedule parser above cannot read them. */
const REFUND_TIER_RE = /^[-*•]?\s*(Upto\s+.+?)\s*:\s*(\d{1,3})\s*%\s*(?:fee\s*)?refund/i;
function refundTiers(chunk) {
  const rows = [];
  for (const line of String(chunk?.text || '').split('\n')) {
    const m = REFUND_TIER_RE.exec(line.trim());
    if (m) rows.push({ when: m[1].replace(/\s+/g, ' ').trim(), percent: m[2] });
  }
  return rows;
}

function numberedSteps(chunk, max = 5) {
  const lines = String(chunk?.text || '').split('\n').map(l => l.trim()).filter(Boolean);
  // "3. SCOPE" / "4. CANCELLATION/WITHDRAWAL" are numbered section labels in a
  // policy document, not steps; treating them as steps printed a list of
  // headings under "What to do / procedure".
  const steps = lines.filter(l => /^\d+[.)]\s+\S/.test(l) && !isFeeRowLine(l) && !isLabelStubLine(l) && !isHeadingLine(l)).slice(0, max);
  return steps.length >= 2 ? steps : [];
}

/** Whole-sentence bound that never cuts mid-word: legal text is never left as a
 *  fragment. clipSentences enforces both limits, sentence count and length. */
function boundSentence(text, maxChars) {
  return clipSentences(text, 3, maxChars);
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
    // An indented line belongs to the step above it, and a Title-Cased line
    // names the block. Neither is a step the citizen can act on.
    const lines = String(procedures[0].text).split('\n')
      .filter(l => l.trim() && !/^\s/.test(l))
      .map(l => l.trim())
      .filter(l => !META_LINE_RE.test(l) && !SECTION_LABEL_RE.test(l) && !isLabelStubLine(l) && !isFeeRowLine(l) && !isHeadingLine(l))
      .map(l => l.replace(/^step\s*\d+\s*[.:)\-\u2013\u2014]\s*/i, '').replace(/^\d+[.)]\s+/, '')
        .replace(/^[-*•]\s+/, '').trim())
      .filter(l => l.length > 25).slice(0, max).map(b => boundSentence(b, cap));
    if (lines.length) return [lead, ...lines.map((s, i) => `${i + 1}. ${s}`)].filter(Boolean).join('\n');
  }
  return null;
}

// Build practical steps from procedure chunks and query intent.
//
// The ONLY two forms a step line may take: a step the retrieved record itself
// numbers, or a content line of the retrieved procedure record. An intent-keyed
// table of ready-made advice used to answer here instead — "Understand your
// rights and check the relevant rules", "you can approach the court under
// Section 200 CrPC", "contact the HEC or the provincial Ombudsperson" — none of
// which any retrieved record stated for that question. Such lines are not
// grounded advice, they are the same template for every citizen who asks
// anything in that domain, and the brief forbids them. No steps in evidence
// means no steps section, which the caller already handles.
function buildPracticalSteps(query, chunks, domain, isRoman) {
  const procedures = chunks.filter(c => /PROCEDURE|WORKFLOW|_STAGES|_PROCESS|MARAHIL/i.test(String(c.key || '')));
  return stepsFromRecords(procedures, chunks, 5, isRoman);
}

// Trim to whole sentences only — legal text is never cut mid-clause.
function clipSentences(text, maxSentences = 3, maxChars = 900) {
  const s = String(text || '').trim();
  if (!s) return '';
  const parts = splitSentences(s);
  let out = [];
  let len = 0;
  for (const p of parts) {
    if (out.length >= maxSentences) break;
    if (len + p.length > maxChars && out.length > 0) break;
    out.push(p);
    len += p.length + 1;
  }
  if (!out.length) return clipAtBoundary(s, maxChars);
  return clipAtBoundary(out.join(' '), maxChars);
}

/**
 * Hard length ceilings meet unbounded corpus sentences here, and a plain slice
 * cut legal text mid-word — "this fee is refundable after". Always land on a
 * boundary: a finished sentence, then a clause, then a word. Nothing is added to
 * make the fragment read as a complete rule.
 */
function clipAtBoundary(text, maxChars) {
  const s = String(text || '').trim();
  if (s.length <= maxChars) return s;
  const head = s.slice(0, maxChars);
  const floor = Math.floor(maxChars * 0.4);
  const at = (chars) => Math.max(...chars.map(ch => head.lastIndexOf(ch)));
  const sentence = at(['.', '!', '?']);
  if (sentence > floor) return head.slice(0, sentence + 1).trim();
  const clause = at([';', ':']);
  if (clause > floor) return head.slice(0, clause).trim();
  const space = head.lastIndexOf(' ');
  return space > floor ? head.slice(0, space).trim() : head.trim();
}

// Exceptions/conditions copied VERBATIM out of a retrieved record. The Advanced
// level may name a nuance only where the corpus itself states one; nothing here
// is composed.
const PROVISO_RE = /\b(provided that|provided no|unless|subject to|save as|shall not apply|exempt|notwithstanding)\b/i;
function extractProvisos(chunk, max = 2) {
  if (!chunk || !PROVISO_RE.test(String(chunk.text || ''))) return [];
  const sentences = splitSentences(chunk.text);
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
    // Ingest labels ("SCOPE:", "WING:", "SUBSTANCE:") name the parsing layer,
    // not the record, and must never be printed as a source card title.
    .replace(/^\s*(?:overview|summary|scope|wing|office|coverage|source|verification|substance)\s*:\s*/i, '')
    .replace(/[\s:;.,—–-]+$/, '')
    .trim();
  const head = (raw.split(/\s+[—–:]\s+|\.\s/)[0] || '').trim();
  const label = (head.length >= 8 ? head : raw).replace(/\s+/g, ' ');
  if (!label || /^(?:scope|wing|office|coverage|source|verification|substance|overview|summary)$/i.test(label)) {
    return String(chunk?.title || 'Relevant record');
  }
  return label.length > 90 ? `${label.slice(0, 90).replace(/\s+\S*$/, '')}…` : label;
}

/** The record's own text must name this provision; a sequential chunk key does not. */
function recordStatesOwnKey(chunk, key) {
  const k = String(key || '');
  if (!/^\d+[a-z]*$/i.test(k)) return true;
  const text = `${chunk?.chunkTitle || ''} ${chunk?.text || ''}`;
  return new RegExp(`(?:section|article|rule|order|dafa|dhara|دفعہ|آرٹیکل)\\s*(?:no\\.?)?\\s*#?\\s*${k}\\b`, 'i').test(text);
}

// Build concise legal basis — just the law names and sections, not full text.
// Each line also names the LAYER it belongs to (Part 7), so a university rule and
// an Act of Parliament are never printed as the same kind of rule.
function buildConciseLegalBasis(chunks, L, cap = 4, scopeLang = null, asked = null) {
  const { provisions, topics } = categorize(chunks);
  const lines = [];
  for (const c of [...provisions, ...topics].slice(0, cap)) {
    // Only legislation records carry a real section/article number in their key.
    // Guides and directories number their entries sequentially, so printing
    // "Section 1" for one would quote a citation that does not exist, and the
    // last grounding pass would then delete the invented label mid-line.
    const isLegislation = String(c.documentType || '') === 'Legislation';
    const numbered = /^\d+[a-z]*$/i.test(String(c.key)) || /^ORDER_/i.test(String(c.key));
    const own = (recordCitation(c) || '').trim();
    let label = (own
      || (isLegislation && numbered && recordStatesOwnKey(c, c.key) ? L.provision(c.type, c.key) : topicLabel(c))
      || displayTitle(c.title || '')
      || 'Record').trim();
    // A guide document holds many services; its own title lists them all. For
    // those documents the record IS its section, so name and attribute the
    // section. Legislation and case law keep the instrument's name and court.
    const isGuide = /guide|digest|workflow|handbook|manual|directory/i.test(String(c.documentType || ''));
    const name = isGuide ? (displayTitle(c.chunkTitle || '') || c.title) : c.title;
    if (label === name) label = '';
    const authority = recordAuthority(c);
    const auth = authority ? ` (${authority})` : '';
    lines.push(label
      ? `- ${label} — ${name}${auth}${L.statusNote(c.legalStatus)}`
      : `- ${name}${auth}${L.statusNote(c.legalStatus)}`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

// Build source lines from chunks. The label is the RECORD the answer used, not
// the file it sits in: one civic document carries the CNIC, passport and NICOP
// records, and quoting the file title made every civic answer look like it came
// from the same generic page.
function buildSources(chunks, cap = 4, asked = null, lang = 'en') {
  const seen = new Set();
  const lines = [];
  for (const c of chunks.slice(0, cap)) {
    const label = topicLabel(c);
    const url = recordSource(c, asked);
    const id = `${label}|${url}`;
    if (seen.has(id)) continue;
    seen.add(id);
    // A portal home page is the publisher, not a link to this record. Saying so
    // stops a bare pakistancode.gov.pk (or any ministry home page) from reading
    // as a direct link to the provision or complaint form the answer describes.
    let bareHome = false;
    try { bareHome = Boolean(url) && new URL(url).pathname.replace(/\/+$/, '') === ''; } catch { bareHome = false; }
    const note = bareHome
      ? (lang === 'ur' ? ' (سرکاری ویب سائٹ)' : lang === 'roman_urdu' ? ' (sarkari website)' : ' (official website)')
      : '';
    lines.push(url ? `- ${label}: ${url}${note}` : `- ${label}`);
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
 * One record can be both the answer and the step list, and the same bound text
 * reaches each section at a different length. Repeating it reads as padding
 * rather than guidance, so a later section keeps only what has not been said.
 */
function dropRepeatedLines(block, composed) {
  if (!block) return block;
  const hay = norm(composed);
  if (!hay) return block;
  let n = 0;
  return String(block).split('\n')
    .filter(line => {
      const l = norm(line.replace(/^[-*•\s]+/, '').replace(/^\d+[.)]\s+/, ''));
      return l.length < 40 || !hay.includes(l.slice(0, 60));
    })
    .map(line => {
      const m = line.match(/^(\d+)([.)])\s+/);
      if (!m) return line;
      n += 1;
      return `${n}${m[2]} ${line.slice(m[0].length)}`;
    })
    .join('\n');
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
  // "My tenant has not paid rent — what are my options?" is a question about
  // what to do, not about which clause scored first. A registration/escalation
  // clause of the rent statute used to lead the answer because it matched the
  // same nouns; the step-by-step record is what the citizen asked for.
  const asksHowToRecover = /\b(recover\w*|wasool|not\s+paid|unpaid|arrears?|non.?payment|evict\w*|withh(?:o|e)ld\w*)\b/i.test(String(userQuery || ''));
  const isProcedureRecord = (c) => /PROCEDURE|WORKFLOW|_STAGES|_PROCESS|STEPS/i.test(String(c?.key || ''));
  const naturalKey = guidanceKey(userQuery);
  const broadTopic = naturalKey === 'women-rights';
  const chunkCap = broadTopic ? 15 : lvl.chunkCap;
  let pool = scopePoolToServices(chunks.slice(0, chunkCap), askedServices);
  // The depth cap selects the first N records the gate returned. When the gate's
  // own ordering placed a clause above the procedure, the procedure fell outside
  // the cap and the answer lost the only record that says what to do. For a
  // recovery question the procedure earns a slot in place of the last record.
  if (asksHowToRecover && !pool.some(isProcedureRecord)) {
    const proc = scopePoolToServices(chunks, askedServices).find(c => isProcedureRecord(c) && !pool.includes(c));
    if (proc) {
      pool = pool.length >= chunkCap
        ? [...pool.slice(0, chunkCap - 1), proc]
        : [...pool, proc];
    }
  }
  const isRoman = activeLang === 'roman_urdu';
  const isUrdu = activeLang === 'ur';
  const L = isUrdu ? URDU : (isRoman ? ROMAN : EN);
  const scopeLang = isUrdu ? 'ur' : (isRoman ? 'roman_urdu' : 'en');
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
  const proceduralAnswer = asksHowToRecover ? focus.find(isProcedureRecord) : null;
  const primary = proceduralAnswer || ((provisions[0] && topicalScoreOf(provisions[0]) >= topicalScoreOf(focus[0]))
    ? provisions[0]
    : (focus[0] || provisions[0]));
  // PART 1b — the question's own words choose WHICH RECORD answers, never WHICH
  // DOCUMENT. Across documents generic overlap wins: a supporting digest record
  // repeating "admission", "fee" and "policy" displaced the HEC fee-refund
  // schedule it was meant to illustrate, so the answer described admissions
  // instead of the refund. When the retrieval put an authority instrument first
  // and the word-match picked a supporting record, the instrument answers.
  // Between two instruments the word-match still decides, because choosing
  // between two policies is a relevance question, not an attribution one.
  const leadRecord = pool[0] && pool[0].authorityLead && !isNonOperativeSection(pool[0]) ? pool[0] : null;
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

  // 0. No "Issue" restatement: repeating the user's question above the answer
  //    adds nothing a reader needs and was the first place a raw query leaked
  //    into a supposed legal explanation.

  // 1. Direct answer — natural guidance in the selected language first, then the
  //    record's own wording where there is no guidance block, and the legal
  //    LAYER those words belong to (Part 7). Roman/Urdu guidance is written in
  //    that language: quoting an English procedure dump inside a Roman answer
  //    broke the language rule and buried the actionable part.
  const aScope = deriveChunkScope(answerRecord);
  const askedHere = (evidence && evidence.scope && evidence.scope.asked) || detectQueryScope(userQuery);
  const showFraming = aScope.scopeLevel !== 'national'
    || Boolean(askedHere && (askedHere.city || askedHere.province || askedHere.institutionNamed));
  const framing = showFraming ? scopeLabel(aScope, scopeLang, askedHere) : null;
  const natural = naturalKey
    ? naturalGuidance(naturalKey, isUrdu ? 'ur' : (isRoman ? 'roman' : 'en'), { focus, userQuery, domain })
    : null;
  const synthesis = clipSentences(synthesizePlainAnswer(userQuery, focus, domain, isRoman), lvl.answerSentences, lvl.answerChars);
  // Roman Urdu quotes one bounded clause, not the paragraph it sits in — the same
  // ceiling the "says" part already uses. Quoting nothing left the Roman answer
  // with only topic titles, so a citizen reporting a deduction from an 8171
  // payment never got the helpline number the retrieved record states.
  const romanClause = clipSentences(recordLead(answerRecord, 1, ROMAN_QUOTE_CHARS, userQuery), 1, ROMAN_QUOTE_CHARS);
  // The record leads in Roman Urdu as it does in English. The intent template is
  // what a citizen falls back on when the record has nothing quotable, not a
  // standing preamble that pushes the actual rule out of the first paragraph.
  const urduClause = clipSentences(recordLead(answerRecord, 1, ROMAN_QUOTE_CHARS, userQuery), 1, ROMAN_QUOTE_CHARS);
  // Urdu answers keep the record's own (usually English) wording as the quoted
  // evidence and wrap it in Urdu framing, so the selected language is never
  // silently swapped for a different one.
  const lead = isUrdu
    ? (urduClause
      ? `اس معاملے میں مستند ریکارڈ کے مطابق (اصل قانونی متن انگریزی میں نقل کیا گیا ہے): «${urduClause}»`
      : 'اس سوال کا جواب درج ذیل مستند ریکارڈ سے ملتا ہے۔')
    : isRoman
      ? (romanClause ? `Record ke mutabiq: ${romanClause}` : synthesis)
      : recordLead(answerRecord, lvl.answerSentences, lvl.answerChars, userQuery);
  let directAnswer = (natural && natural.lead) || lead || synthesis;
  if (natural && natural.followUp) directAnswer = `${directAnswer}\n\n${natural.followUp}`;
  if (directAnswer && framing) directAnswer = `${framing}: ${directAnswer}`;
  // Never let a university/city/province record read as Pakistan-wide law.
  const guard = applicabilityNote(aScope, scopeLang);
  if (directAnswer && guard) directAnswer = `${directAnswer} ${guard}`;
  if (plan.has('answer') && directAnswer) push(L.answer, directAnswer);

  // 2. Legal basis — only where the level asks for provisions, never a law dump.
  //    The record the answer itself was built from leads, so the "law" line names
  //    the instrument the guidance above came from rather than a record that only
  //    shares a word with the question.
  if (!shortStyle && plan.has('law') && lvl.legalBasis > 0) {
    const lawSupport = answerRecord
      ? [answerRecord, ...support.filter(c => c !== answerRecord)]
      : support;
    const lawLines = buildConciseLegalBasis(lawSupport, L, lvl.legalBasis, scopeLang, askedHere);
    if (lawLines) push(L.law, lawLines);
  }

  // 3. What the law says — the next record that carries the question, quoted;
  //    this record's own remaining words next; a plain-language bridge last.
  //    One shared generic word ("case", "court") does not make a record about
  //    the thing that was asked, and quoting such a record pastes a different
  //    case's facts into this answer.
  const nextCandidate = grounded.find(c => c !== answerRecord);
  // A bank-deduction answer already names the forum in its first two sentences.
  // The generic clause that passes the word tests here is depositor protection
  // (deposit insurance and account secrecy), which shares "bank" and "account"
  // with the question but says nothing about disputing a debit; the answer
  // record's own next sentence (the appeal route) is the useful support.
  const second = !isBankDeductionAsk(userQuery) && nextCandidate
    && queryTermHits(userQuery, nextCandidate) >= 2
    && ownIdentityHits(userQuery, nextCandidate) >= 1 ? nextCandidate : null;
  const secondLead = recordLead(second, lvl.answerSentences, lvl.explanationChars, userQuery);
  const selfRest = secondLead ? '' : recordContinuation(answerRecord, lead, lvl.answerSentences, lvl.explanationChars, userQuery);
  const unusedRest = (secondLead || selfRest || isBankDeductionAsk(userQuery))
    ? '' : nextGroundedExplanation(userQuery, grounded, answerRecord, lvl);
  const rawSays = secondLead || selfRest || unusedRest;
  // A continuation or sibling record can repeat the very clause the direct
  // answer just quoted; printing it twice adds nothing.
  const leadNorm = norm(lead || '');
  const saysText = rawSays && leadNorm
    && norm(rawSays).slice(0, 60) === leadNorm.slice(0, 60) ? '' : rawSays;
  // Roman Urdu explains first and quotes only the clause that carries the rule;
  // an English answer keeps the record's own wording in full.
  const romanQuote = clipSentences(saysText, 1, ROMAN_QUOTE_CHARS);
  const explanation = isUrdu
    ? (saysText ? `مستند ریکارڈ مزید یہ بتاتا ہے (اصل متن انگریزی میں): «${clipSentences(saysText, 2, ROMAN_QUOTE_CHARS * 2)}»` : '')
    : isRoman
      ? (romanQuote ? `Verifiable record ke mutabiq: ${romanQuote}` : '')
      : saysText;
  if (!shortStyle && plan.has('says') && explanation && !natural) {
    push(L.says, explanation);
  }

  // 4. Practical steps — concrete actions from procedure chunks and intent.
  //    GCU-D2: a question about what something COSTS is answered with the
  //    published schedule. Prices stay prices; turning a fee row into an
  //    "application step" invents a process the document never states.
  const asksFee = /\b(fee|fees|charge|charges|cost|price|amount)\b/i.test(userQuery)
    || detectQueryIntent(userQuery, domain) === 'fee-scholarship';
  const asksAmount = /\b(how much|how many|fee amount|amount of (?:the )?fee|fees? kitn[aei]|kitn[aei] (?:fee|fees|paisa|paise))\b/i.test(userQuery);
  const feeRecord = [answerRecord, ...grounded].find(c => c && hasFeeSchedule(c)) || null;
  let feeGap = '';
  if (!shortStyle && asksFee && feeRecord) {
    const table = feeScheduleBlock(feeRecord, Math.max(6, lvl.steps || 6), isRoman, userQuery);
    if (table) push(L.fees, table);
  } else if (!shortStyle && asksFee) {
    const tierRecord = [answerRecord, ...grounded].find(c => c && refundTiers(c).length >= 3);
    if (tierRecord) {
      const lead = isRoman
        ? 'Document mein likhi hui refund schedule yeh hai:'
        : 'The published refund tiers are:';
      const rows = refundTiers(tierRecord).slice(0, 8)
        .map(r => `- ${r.when} — ${r.percent}% fee refund`);
      push(L.fees, [lead, ...rows].join('\n'));
    } else if (asksAmount) {
      // The question asks a price the corpus does not carry. Say that, and point
      // at the official portal named by the record that was retrieved — never
      // invent an amount.
      const src = [answerRecord, ...grounded]
        .map(c => recordSource(c, askedServices))
        .find(u => /^https?:\/\/(?:[a-z0-9-]+\.)+gov\.pk\b/i.test(String(u || '')));
      feeGap = isRoman
        ? ` Verified record tareeqa batata hai lekin fees ki raqam nahi likhta; taza fees ${src ? `official portal (${src})` : 'mutaliqa official portal'} ya daftar se tasdeeq karein.`
        : ` The verified records here describe the procedure but do not publish the fee amount; confirm the current fee ${src ? `on the official portal (${src})` : 'on the relevant official portal'} or at the office before paying.`;
    }
  }
  if (!shortStyle && plan.has('procedure')) {
    if (natural && natural.steps && natural.steps.length) {
      push(L.procedure, natural.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
    } else {
      const steps = buildPracticalSteps(userQuery, grounded, domain, isRoman);
      // A numbered sequence is only honest whole: dropping the step the direct
      // answer already quoted renumbered the rest (source steps 1, 2, 4 printed as
      // 1, 2, 3) and made the opposing party's reply look like the reader's third
      // action.
      const fresh = steps && /(?:^|\n)1[.)]\s/.test(steps)
        ? steps
        : dropRepeatedLines(steps, out.join('\n'));
      if (fresh) {
        const stepText = isUrdu
          ? `درج ذیل اقدامات متعلقہ مستند ریکارڈ سے لیے گئے ہیں (اصل متن انگریزی میں):\n${clipList(fresh, lvl.steps)}`
          : clipList(fresh, lvl.steps);
        push(L.procedure, stepText);
      }
    }
  }

  // 5. Remedy — only if a remedy chunk was retrieved and the level wants it.
  if (!shortStyle && plan.has('remedy') && lvl.remedy) {
    const remedyText = isRoman
      ? (romanRecordLine(remedies[0]) || recordLead(remedies[0], 1, ROMAN_QUOTE_CHARS, userQuery))
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
    push(L.forum, [primary.jurisdiction, recordAuthority(primary), layer].filter(Boolean).join(' · '));
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
  const srcLines = buildSources(focus, broadTopic ? 4 : lvl.sources, askedServices, scopeLang);
  const portals = srcLines ? siblingPortals(focus.slice(0, lvl.sources), chunks) : [];
  if (plan.has('source') && srcLines) {
    push(L.source, [srcLines, ...portals.map(u => `- ${isUrdu ? 'سرکاری پورٹل' : isRoman ? 'Sarkari portal' : 'Official portal'}: ${u}`)].join('\n'));
  }

  // 11. Limitation — every level, unchanged, plus the honest scope gap: where the
  //     corpus holds no record for the layer the user asked about, the answer says
  //     so instead of quietly answering from a wider one.
  // A bank-deduction dispute is only partly covered: the corpus names the forum
  // (Banking Court above PKR 500,000) and the channel (the Banking Mohtasib), but
  // publishes no step-by-step complaint procedure. Say so rather than letting the
  // depositor-protection clause stand in for an answer about how to dispute.
  const bankingDisputeGap = !shortStyle && domain === 'banking'
    && /\b(bank|banking|account)\b/i.test(userQuery)
    && /\b(deduct\w*|debit\w*|wrongful\w*|unauthori[sz]ed|dispute\w*|refund\w*|reversal|revers(?:e|ed)|not\s+(?:return|refund)\w*|wapis|kaat\w*)\b/i.test(userQuery)
    && !grounded.some(c => /PROCEDURE|WORKFLOW|_STEPS|_STAGES|_PROCESS/i.test(String(c.key || '')))
    ? (isRoman
      ? ' Verified records Banking Court (PKR 500,000 se zyada ke disputes) aur Banking Mohtasib ka zikr karte hain, lekin bank ke andar shikayat darj karne ka step-by-step tareeqa corpus mein nahi hai; taza tareeqa bank ke complaint office aur Mohtasib se tasdeeq karein.'
      : ' The verified records name the Banking Court (for disputes involving amounts above PKR 500,000) and the Banking Mohtasib for consumer grievances against banks, but they do not publish a step-by-step complaint procedure; confirm the current process with the bank\'s complaint office and the Mohtasib before filing.')
    : '';
  const scopeGap = (evidence && evidence.scope && missingScopeMessage(evidence.scope, scopeLang)) || '';
  push(L.limit, `${L.limitText}${feeGap}${bankingDisputeGap}${scopeGap}`);

  // 12. Citation grounding — the one exit every mode passes through, so a section
  //     number that no cited record states cannot be printed by chat, advice,
  //     voice or the agent alike.
  return groundAnswerCitations(out.join('\n\n'), focus, userQuery).text;
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
  const isUrdu = activeLang === 'ur';
  const probe = parseOverseasIntent(String(userQuery || ''));
  if (probe.isOverseas) {
    const place = displayCountry(probe.country);
    if (place) {
      if (isUrdu) {
        return `مجھے ${place} کے قانون سے متعلق اس ذخیرے میں کوئی مستند (verified) ریکارڈ نہیں ملا، اور میں کسی ملک کا قانون یاد سے نہیں بتاؤں گا۔ جو میں مستند پاکستانی مواد سے دے سکتا ہوں وہ یہ ہے: دستاویزات اور تصدیق (attestation)، پاکستانی مشن/قونصلر مدد، ویزا اور امیگریشن کی بنیادی باتیں، بیرونِ ملک ملازمت، بیرونِ ملک تعلیم، اور سرحد پار خاندانی/جائیداد کے معاملات۔ آپ کو ان میں سے کس چیز کی ضرورت ہے، اور اصل مسئلہ کیا ہے؟ اگر کوئی نوٹس یا خط موصول ہوا ہو تو اسے یہاں اپ لوڈ کریں — میں اس کا تجزیہ کروں گا۔ ${place} کے موجودہ سرکاری قواعد (ویزا، فیس، مقررہ تاریخیں) کے لیے میں صرف سرکاری ماخذ کی طرف رہنمائی کروں گا، کوئی اندازہ نہیں لگاؤں گا۔`;
      }
      return isRoman
        ? `Mujhe ${place} ke qanoon ka koi verified record is zakhire mein nahi mila, aur main kisi mulk ka qanoon yaad se nahi bataunga. Main aap ko yeh verified Pakistan-facing rehnumai de sakta hoon: documents aur attestation, Pakistani mission/consular madad, visa aur immigration basics, overseas employment, study abroad, aur cross-border family/property muamlat. Aap ko in mein se kis cheez ki zaroorat hai, aur asal masla kya hai? Agar koi notice ya khat mila hai to use yahan upload karein — main uska tajzia karunga. ${place} ke maujooda sarkari rules (visa, fees, deadlines) ke liye main sirf official source ki taraf bhejunga, koi andaaza nahi lagao ga.`
        : `I could not find a verified record covering ${place}'s law in this corpus, and I will not guess any country's law from memory. What I CAN give you — from verified Pakistan-facing material — is guidance on: documents and attestation, Pakistani mission/consular help, visa and immigration basics, overseas employment, study abroad, and cross-border family/property matters. Which of these do you need, and what exactly happened? If you have received a notice or letter, upload it and I will analyze it for you. For ${place}'s current official rules (visa, fees, deadlines) I will only point you to the official authority — I will not invent them.`;
    }
    if (isUrdu) {
      return `مجھے آپ کے سوال کا کوئی مستند (verified) ریکارڈ نہیں ملا، اور میں اندازے سے قانونی جواب نہیں دوں گا۔ درست رہنمائی کے لیے براہِ کرم بتائیں: **آپ کس ملک جا رہے ہیں (یا رہ رہے ہیں)؟** اور **مقصد کیا ہے — نوکری، تعلیم، مستقل سکونت، خاندان، یا وزٹ؟** ملک اور مقصد معلوم ہوتے ہی میں مستند رہنمائی دے سکتا ہوں: دستاویزات، تصدیق، ویزا/امیگریشن کی بنیادی باتیں، بیرونِ ملک ملازمت کے قواعد، بیرونِ ملک تعلیم کی ضروریات، قونصلر مدد، یا سرحد پار خاندانی/جائیداد کا طریقہ۔ اگر کوئی نوٹس یا خط ملا ہو تو وہ بھی اپ لوڈ کر سکتے ہیں۔`;
    }
    return isRoman
      ? `Mujhe aap ke sawal ka koi verified record nahi mila, aur main andaaze se qanooni jawab nahi dunga. Sahih rehnumai ke liye baraye meharbani bataayein: **aap kis mulk mein ja rahe hain (ya reh rahe hain)?** aur **maqsad kya hai — naukri/work, parhai/study, mustaqil rehna/settlement, family, ya visit?** Country aur maqsad batate hi main aap ko verified rehnumai de sakta hoon: documents, attestation, visa/immigration basics, overseas employment ke rules, study abroad ki zarooratain, consular madad, ya cross-border family/property ka tareeqa. Agar koi notice ya khat mila hai to use bhi upload kar sakte hain.`
      : `I could not find a verified record matching this yet, and I will not guess legal facts. To give you accurate, verified guidance, please tell me: **which country are you moving to (or living in)?** and **what is the purpose — work, study, permanent settlement, family, or a visit?** Once I know the country and purpose, I can give you the verified guidance that applies: documents and attestation, visa and immigration basics, overseas employment rules, study-abroad requirements, consular help, or cross-border family/property procedure. If you have received a notice or letter, upload it and I will analyze it.`;
  }
  if (isUrdu) {
    return `مجھے آپ کے سوال سے ملتا جلتا کوئی مستند پاکستانی قانونی ریکارڈ نہیں ملا، اور میں قانونی حقیقت گھڑ کر نہیں بتاؤں گا۔ میں پھر بھی مدد کر سکتا ہوں — براہِ کرم کچھ اور تفصیل بتائیں: **اصل مسئلہ کیا ہوا** (مثلاً جائیداد، خاندان، ملازمت، کرایہ داری، یا کوئی فوجداری معاملہ) **اور آپ کس شہر/صوبے میں ہیں؟** اگر کوئی نوٹس، خط یا دستاویز ہو تو اسے یہاں اپ لوڈ کریں — میں اسے پڑھ کر سمجھاؤں گا۔ آپ کسی طریقۂ کار کے بارے میں بھی پوچھ سکتے ہیں (مثلاً "مجھے کیا کرنا چاہیے...")، یا ایپ میں Legal Library، قانونی امداد اور مستند وکیل کی مدد لے سکتے ہیں۔`;
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
  const isUrdu = activeLang === 'ur';
  const asks = [];
  if (!probe.country) {
    asks.push(isUrdu
      ? '**ایک ضروری بات:** آپ کے سوال میں کسی ملک کا نام نہیں ہے۔ اگر آپ بتا دیں کہ کس ملک جا رہے ہیں / رہ رہے ہیں، تو میں دستاویزات، تصدیق اور سرکاری اقدامات اسی ملک کے حساب سے ترتیب دے سکتا ہوں — نوکری، تعلیم، مستقل سکونت یا خاندان — بغیر کسی اندازے کے۔'
      : isRoman
      ? '**Ek zaroori baat:** aap ke sawal mein kisi mulk (country) ka naam nahi hai. Agar aap bata dein ke kis mulk mein ja rahe hain / reh rahe hain, to main documents, attestation aur official qadam us mulk ke hisaab se tailor kar sakta hoon — work, study, settlement ya family — bina kisi andaaze ke.'
      : '**One thing that would make this precise:** your question does not name a country. If you tell me which country you are moving to (or living in), I can tailor the documents, attestation and official steps for that destination — whether it is for work, study, settlement or family — without any guesswork.');
  } else if (!probe.purpose && probe.move) {
    asks.push(isUrdu
      ? '**ایک اور بات:** کس مقصد کے لیے جا رہے ہیں — **نوکری، تعلیم، مستقل سکونت، خاندان، یا وزٹ**؟ مقصد بتانے سے میں درست مستند طریقۂ کار اور دستاویزات کی طرف رہنمائی کر سکتا ہوں۔'
      : isRoman
      ? '**Ek aur baat:** kis maqsad ke liye move ho rahe hain — **naukri/work, parhai/study, mustaqil rehna/settlement, family, ya visit**? Maqsad batane se main sahi verified procedure aur documents ki taraf le ja sakta hoon.'
      : '**One more thing:** what is the purpose of the move — **work, study, permanent settlement, family, or a visit**? Knowing the purpose lets me point you to the right verified procedure and documents.');
  }
  return asks.join('\n\n');
}
