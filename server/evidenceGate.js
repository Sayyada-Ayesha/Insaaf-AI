/**
 * server/evidenceGate.js — Corrective-RAG quality control.
 *
 * This layer sits AFTER the existing retrieval engine and never modifies it:
 * every retrieval here is a plain call to RAGEngine.retrieve(), the same entry
 * point Chat / Advice / Agent already used. What this module adds is a judgement
 * step — is the returned evidence actually good enough to answer THIS question —
 * and, only when it is not, a small bounded correction loop (max
 * MAX_CORRECTIVE_ATTEMPTS retries) that reformulates the query, drops noise,
 * adds domain/procedure terms, tightens metadata scope, tries the other existing
 * retrieval strategy, then re-ranks and rejects weak candidates.
 *
 * Grounding rules this module exists to enforce:
 *  - evidence is only ever REJECTED or REORDERED, never invented;
 *  - the caller's honest "insufficient evidence" paths stay reachable, because
 *    an exhausted loop returns an empty accepted set instead of filler;
 *  - a STRONG first retrieval costs exactly one RAGEngine.retrieve() call, so
 *    normal latency does not change;
 *  - scope is judged next to topic (server/corpusScope.js): a record stating a
 *    DIFFERENT province or city than the one asked is evidence about somewhere
 *    else, while the University → city → province → national ladder is only a
 *    specificity tie-breaker. Broad national law is never rejected for being
 *    broad, because it applies inside the city the user named.
 *
 * Roman Urdu and Urdu-script queries are judged against the retrieval engine's
 * own dictionary translation of the user's words (RAGEngine.normalizeQuery),
 * because the corpus is English-language: token overlap against a raw Roman
 * transliteration would look like "no evidence" on perfectly grounded records.
 */
import { RAGEngine, DOMAIN_DOCS, parseOverseasIntent } from './ragEngine.js';
import {
  detectQueryScope, scopeLadder, deriveChunkScope, scopeSpecificityWeight,
  scopeConflict, scopeCoverage, institutionScoped, namedInstitutionQuery
} from './corpusScope.js';
import { askedProvisionKeys, chunkCarriesProvision } from './provisionRef.js';
import { analyzeSubject, subjectCheck, domainSubjectTerms, GENERIC_RELATION_TERMS } from './domainProfile.js';

/** Hard ceiling on corrective retries per query — no retrieval loops. */
export const MAX_CORRECTIVE_ATTEMPTS = 2;

// Thresholds reuse the numbers the retrieval engine already produces (hybrid
// score, the 2.5 domainless cut-off, the 8.0 exact-provision bar).
const STRONG_SCORE = 6.0;
const ACCEPT_SCORE = 2.5;
const SUPPORT_COVERAGE = 0.3;
const MIN_COVERAGE = 0.1;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'are', 'was', 'with', 'that', 'this', 'have', 'has',
  'what', 'when', 'where', 'which', 'from', 'about', 'will', 'would', 'could', 'should',
  'can', 'did', 'does', 'how', 'why', 'tell', 'please', 'kindly', 'want', 'need', 'issue',
  'problem', 'matter', 'thing', 'things', 'something', 'anything', 'actually', 'given',
  'hello', 'hi', 'sir', 'madam', 'out', 'get', 'got', 'let', 'one', 'two', 'any', 'all',
  'not', 'but', 'if', 'or', 'of', 'to', 'in', 'is', 'it', 'be', 'as', 'at', 'by', 'on',
  'my', 'me', 'his', 'her', 'their', 'our', 'they', 'them', 'its', 'we', 'us', 'i', 'a',
  'hai', 'hain', 'tha', 'thi', 'thay', 'ka', 'ki', 'ke', 'ko', 'se', 'me', 'mein', 'main',
  'mujhe', 'apna', 'mera', 'meri', 'tum', 'aap', 'bhi', 'jo', 'kya', 'kar', 'karo', 'karna',
  'karne', 'hota', 'hoti', 'hoon', 'hogaya', 'hoga', 'hogi', 'ho', 'ya', 'aur', 'lekin',
  'ke liye', 'liye', 'par', 'phir', 'ab', 'tab', 'yeh', 'wo', 'woh', 'is', 'us', 'har',
  'sab', 'kuch', 'nahi', 'nhi', 'nahin', 'haan', 'sahab', 'wala', 'wale', 'wali',
  // Roman Urdu grammar carries no legal content; leaving these in the
  // informative set depressed coverage for Roman Urdu queries.
  'raha', 'rahi', 'rahe', 'rha', 'rhi', 'hum', 'sakta', 'sakti', 'sakte', 'saktee',
  'karta', 'karti', 'karte', 'kerte', 'hua', 'huye', 'huyi', 'howa', 'howi', 'howe',
  'apka', 'apni', 'apne', 'tera', 'teri', 'uska', 'uski', 'unka', 'unki', 'iska', 'iski',
  'hamara', 'hamari', 'zaroor', 'jaroor', 'bilkul', 'sath', 'saath', 'baad', 'pehle',
  // Style and meta-instruction words. They describe HOW to answer, not WHICH law
  // applies, so counting them as uncovered content made "Chori ki saza kya hai?
  // Iska tafseeli jawab hawalon ke sath do" read as weak evidence (coverage 0.25)
  // on the same Section 379 record that covers the bare question completely.
  'answer', 'jawab', 'detail', 'details', 'detailed', 'description', 'explain',
  'explanation', 'reference', 'references', 'hawala', 'hawalon', 'hawalay',
  'tafseel', 'tafseeli', 'short', 'brief', 'concise', 'mukhtasar', 'mukhtasir',
  'long', 'lambi', 'sirf', 'only', 'chahiye', 'chahye', 'batao', 'bataen', 'bataye',
  // Interrogatives: the Roman spelling of "which" / "who" / "whose", both already
  // stop words above in their English form.
  'kaun', 'kon', 'kaunsi', 'kaunsa', 'kaunse', 'kis', 'kisi',
  // Reporting verbs carried by questions about a religious or legal position
  // ("what does Islam say about zina"). They name no legal subject.
  'say', 'says', 'saying', 'said'
]);

// Terms appended when the routed domain needs tightening on a corrective retry.
// These are corpus vocabulary (document titles/domains), not new law.
const DOMAIN_TERMS = {
  criminal: 'PPC CrPC police FIR court procedure',
  cyber: 'PECA cybercrime FIA electronic crime complaint',
  family: 'family law marriage divorce khula maintenance custody guardians',
  rights: 'fundamental rights Constitution of Pakistan remedies',
  civil: 'civil suit CPC property contract specific relief tenancy',
  labour: 'labour employment wages termination industrial',
  consumer: 'consumer protection complaint defective goods refund',
  'legal-aid': 'legal aid services free legal assistance',
  procedure: 'court procedure filing steps limitation',
  'case-law': 'judgment precedent Supreme Court High Court reported decision',
  civic: 'civic services municipal citizen documentation',
  foreigner: 'foreigner visa immigration passport registration',
  'cross-border': 'overseas Pakistani embassy consulate attestation immigration',
  evidence: 'Qanun-e-Shahadat evidence proof witness',
  banking: 'banking finance NBFI recovery',
  customs: 'customs duty import export',
  environment: 'environmental pollution protection tribunal',
  torts: 'tort negligence damages compensation',
  health: 'health medical negligence patient',
  elections: 'elections electoral roll candidate',
  province: 'provincial law province',
  history: 'constitutional history',
  amendment: 'constitution amendment',
  drafting: 'deed agreement notice application affidavit drafting',
  immigration: 'immigration passport visa nationality',
  offices: 'public office institution authority',
  competition: 'competition regulator merger abuse',
  education: 'student university college fee hostel scholarship examination'
};

// Corpus vocabulary for each ladder layer, appended only when a retry is
// tightening SCOPE. These are words the corpus documents themselves use
// ("university", "provincial", "municipal corporation"), never a new rule; the
// place name always comes from the user's own message.
const SCOPE_TERMS = {
  university: 'university student rules regulations fee hostel admission discipline',
  local_city: 'local procedure complaint municipal corporation chairman commissioner district administration',
  provincial: 'provincial law act province assembly rules',
  national: 'Pakistan federal law act section constitution'
};

const PROCEDURE_RE = /\b(procedure|process|step|how|file|filing|apply|application|submit|approach|darj|kahan|tareeqa|tariqa|karwai|form|fees|form)\b/i;
const CASE_LAW_RE = /\b(case law|judgment|judgement|precedent|verdict|reported decision|supreme court|high court|federal shariat|citation|PLD|CLC|SCMR|MLHD|suitable case|related case)\b/i;

// Regions the corpus can label a record with. AJK and Gilgit-Baltistan are read
// territories with their own education administration, so a national record that
// does not name them cannot establish THEIR rule.
const REGION_WORDS = ['punjab', 'sindh', 'balochistan', 'khyber pakhtunkhwa', 'kpk',
  'azad jammu', 'ajk', 'gilgit', 'baltistan', 'islamabad', 'ict', 'federal'];
const namesRegion = (text) => REGION_WORDS.some(w => new RegExp(`\\b${w}`, 'i').test(String(text || '')));
// An education subject and a jurisdiction-specific RULE ATTRIBUTE. A procedural
// "how do I obtain" question is not a rule-attribute question, so this pair is
// deliberately narrow.
const EDUCATION_OBJECT_RE = /\b(scholarships?|admissions?|universit(y|ies)|colleges?|hec|degree programmes?|degree programs?|financial assistance)\b/i;
const RULE_ATTRIBUTE_RE = /\b(last date|deadline|closing date|close date|domicile (condition|requirement|rule)|eligibility (criteria|condition|requirement)|quota|reservation|reserved seat|merit (criteria|requirement))\b/i;
// District -> province resolver for the guard below. These are administrative
// districts whose province is settled; the map resolves a NAME to a province so
// a district-level ask is recognised. It asserts no coverage of its own: a
// district record still has to exist in the corpus.
const DISTRICT_PROVINCE = {
  tharparkar: 'Sindh', umarkot: 'Sindh', badin: 'Sindh', thatta: 'Sindh', mirpurkhas: 'Sindh',
  sanghar: 'Sindh', kashmore: 'Sindh', matli: 'Sindh', naveethahar: 'Sindh', Jacobabad: 'Sindh',
  nushki: 'Balochistan', chagai: 'Balochistan', panjgur: 'Balochistan', kharan: 'Balochistan',
  washuk: 'Balochistan', musakhel: 'Balochistan', harnai: 'Balochistan', duki: 'Balochistan',
  bahawalnagar: 'Punjab', bhakkar: 'Punjab', lodhran: 'Punjab', pakpattan: 'Punjab',
  'lower dir': 'Khyber Pakhtunkhwa', 'upper dir': 'Khyber Pakhtunkhwa', chitral: 'Khyber Pakhtunkhwa',
  batagram: 'Khyber Pakhtunkhwa', torghar: 'Khyber Pakhtunkhwa'
};
const PROVINCES = ['punjab', 'sindh', 'khyber pakhtunkhwa', 'balochistan', 'islamabad', 'ict', 'gilgit', 'azad kashmir'];

// Words that name the *existence* of law rather than a legal subject, plus the
// everyday ways a layperson asks ("kya kehta hai", "what does it say").
const SCOPE_META_TERMS = new Set([
  'law', 'laws', 'qanoon', 'qawaneen', 'kanoon', 'legal', 'act', 'acts',
  'provincial', 'province', 'provinces', 'central', 'federal', 'national', 'state',
  'kehta', 'kehti', 'kehte', 'kehata', 'kahata', 'kehtaa', 'say', 'says', 'said',
  'mean', 'means', 'matlab', 'detail', 'details', 'tafseel', 'maloomat', 'information',
  'info', 'batao', 'bataye', 'batata', 'bata', 'samjhao', 'explain', 'guide', 'tell',
  'chahe', 'chahiye', 'kya'
]);
// Places a query can name while still stating no issue: province ladder entries
// and the cities the corpus scopes records to.
const PLACE_TERMS = new Set([...PROVINCES, 'pakistan', 'pakistani',
  'karachi', 'lahore', 'hyderabad', 'peshawar', 'quetta', 'multan', 'faisalabad',
  'rawalpindi', 'gujranwala', 'sargodha', 'sukkur', 'larkana', 'nawabshah',
  'abbottabad', 'abbotabad', 'mansehra', 'muzaffarabad', 'gilgit', 'gwadar', 'turbat',
  'ajk', 'gb', 'islamabad capital', 'khyber', 'pakhtunkhwa', 'azad', 'kashmir']);

// Statutes a user can NAME in the query. If they name one and none of the
// accepted records belong to it, the evidence is about the wrong law even when
// the subject-matter domain router agrees with the wording.
const STATUTE_PROFILES = [
  { re: /\b(ppc|pakistan penal code|penal code)\b/i, match: /ppc|penal/i, label: 'Pakistan Penal Code 1860' },
  { re: /\b(crpc|criminal procedure code|code of criminal procedure)\b/i, match: /crpc|criminal procedure/i, label: 'Criminal Procedure Code 1898' },
  { re: /\b(peca|prevention of electronic crime)\b/i, match: /peca|electronic crime/i, label: 'PECA 2016 cybercrime' },
  { re: /\b(cpc|civil procedure code|code of civil procedure)\b/i, match: /\bcpc\b|civil procedure/i, label: 'Code of Civil Procedure 1908' },
  { re: /\b(constitution|basic law of pakistan)\b/i, match: /constitution|fundamental right|basic law/i, label: 'Constitution of Pakistan' },
  { re: /\b(qanun-e-shahadat|law of evidence)\b/i, match: /shahadat|evidence/i, label: 'Qanun-e-Shahadat Order 1984' }
];

/** Canonical labels of the statutes a query names (empty when none). */
export function statuteMentions(query) {
  return STATUTE_PROFILES.filter(s => s.re.test(String(query || ''))).map(s => s.label);
}

function tokenizeInformative(text) {
  const words = String(text || '').toLowerCase().match(/[a-z][a-z0-9'_-]{2,}|\d{2,}[a-z]?/g) || [];
  const out = new Set();
  for (const raw of words) {
    const t = raw.replace(/^_+|_+$/g, '');
    if (t.length < 3 || STOP_WORDS.has(t)) continue;
    out.add(t);
  }
  return out;
}

/**
 * Urdu grammar words. They carry no legal subject, so they must not be counted as
 * the user's own evidence words.
 */
const URDU_STOP_WORDS = new Set([
  'میں', 'के', 'کی', 'کا', 'کے', 'کو', 'سے', 'پر', 'اور', 'یا', 'بھی', 'نے', 'ہے', 'ہیں',
  'tha', 'تھا', 'تھی', 'تھے', 'کہ', 'جو', 'جب', 'تو', 'ہونا', 'کرنے', 'کرنا', 'کیا',
  'لیے', 'لئے', 'ہر', 'سب', 'تمام', 'بعض', 'اب', 'پھر', 'اس', 'یہ', 'وہ', 'ان', 'اپنے'
].filter(w => /[\u0600-\u06FF]/.test(w)));

/**
 * Direct cross-script equivalents for the Urdu words citizens actually write when
 * asking about a service the verified corpus holds. One entry per word, at most a
 * few words out — this is NOT the retrieval expansion (which injects corpus
 * vocabulary the user never asked for). A word with no entry yields no English
 * form, so an unmapped Urdu question is still judged with nothing to match on and
 * refuses honestly.
 */
const URDU_GLOSS = {
  پاسپورٹ: 'passport',
  شناختی: 'identity cnic nadra',
  قومی: 'national',
  کارڈ: 'card',
  خاندانی: 'family',
  ڈومیسائل: 'domicile',
  فارم: 'form',
  سرٹیفکیٹ: 'certificate',
  رجسٹریشن: 'registration',
  دستاویزات: 'documents required',
  دستاویز: 'document required',
  درکار: 'required',
  بنوانے: 'apply obtain',
  بنانے: 'apply make',
  حاصل: 'obtain',
  فیس: 'fee charges',
  تجدید: 'renewal renew',
  دوبارہ: 'renew reissue',
  ترمیم: 'modification correction',
  نئی: 'new',
  نیا: 'new',
  گم: 'lost',
  کھویا: 'lost',
  اہلیت: 'eligibility eligible',
  لائق: 'eligible',
  بچہ: 'child',
  بچے: 'child children',
  عمر: 'age',
  پتہ: 'address',
  رابطہ: 'contact',
  شکایت: 'complaint',
  عدالت: 'court',
  پولیس: 'police fir',
  مقدمہ: 'case',
  وکیل: 'lawyer advocate',
  جرم: 'offence crime',
  سزا: 'punishment sentence',
  گھروں: 'house',
  گھر: 'house',
  کرائےدار: 'tenant',
  // "گھر خالی کروانا" is the citizen's phrase for eviction; the corpus writes it
  // in English ("cannot evict … except by order"). Untranslatable, the ask
  // shares no word with the provision that answers it and reads as uncovered.
  خالی: 'vacate evict eviction empty',
  نوکری: 'employment job',
  ملازمت: 'employment job',
  تنخواہ: 'salary',
  طلبہ: 'students',
  طالب: 'student',
  يونيورسٹی: 'university',
  یونیورسٹی: 'university',
  کالج: 'college',
  اسکول: 'school',
  امتحان: 'examination exam',
  حاضری: 'attendance',
  بیٹھنے: 'appear sit',
  ضروری: 'required',
  کم: 'minimum least',
  حیدرآباد: 'hyderabad',
  ہاسٹل: 'hostel',
  وظیفہ: 'scholarship stipend',
  داخلہ: 'admission',
  کفالت: 'kafaalat benazir income support',
  نظیر: 'benazir',
  فورم: 'forum',
  اسکور: 'score',
  طے: 'decided determined',
  ڈیٹا: 'data',
  ذاتی: 'personal',
  معلومات: 'information'
};

/**
 * Words the USER wrote in Urdu script. Without these a pure Urdu query has an
 * empty own-word set, and the gate's support test (`own.length === 0` skips the
 * own-word bar) would then be decided purely by coverage over an also-empty token
 * set — which reads as "no evidence" on perfectly grounded records.
 */
function tokenizeUrduWords(text) {
  const words = String(text || '').match(/[\u0621-\u064A\u0671-\u06D3]{3,}/g) || [];
  const out = [];
  for (const w of words) if (!URDU_STOP_WORDS.has(w)) out.push(w);
  return out;
}

/**
 * Informative query tokens. English queries use their own words; Roman Urdu /
 * Urdu-script queries additionally use the engine's DICTIONARY translation of the
 * same words (RAGEngine.normalizeQuery), because the corpus is English-language
 * and coverage measured against a raw Roman transliteration would read as "no
 * evidence" on perfectly grounded records.
 *
 * The domain cascade's `rewrittenQuery` is deliberately NOT used: it injects
 * corpus vocabulary the user never asked for, which would make every query look
 * well covered and defeat the weak-evidence detector.
 */
export function queryEvidenceTokens(userQuery) {
  let translated = '';
  let lang = 'en';
  try {
    const processed = RAGEngine.processQuery(String(userQuery || ''));
    translated = processed.normalizedQuery || '';
    lang = processed.detectedLang || 'en';
  } catch {
    // Pure translation helper; judging the raw query stays correct, just less
    // generous for Roman Urdu.
  }
  const set = new Set();
  for (const t of tokenizeInformative(userQuery)) {
    if (lang !== 'en') {
      // One concept, one coverage slot. A Roman or Urdu word AND its English
      // gloss are the same ask, but counting both meant "chori ... saza"
      // produced five tokens where "theft ... punishment" produced two, so the
      // SAME PPC 379 record scored 0.4 instead of 1.0 and fell under the support
      // bar. Where the dictionary knows the word, measure the corpus-addressable
      // gloss; keep the literal word only when it is already English-addressable
      // or the dictionary cannot translate it. (tokenizeInformative returns a
      // Set — its size, never its length, decides whether a gloss exists.)
      let gloss = '';
      try { gloss = RAGEngine.normalizeQuery(t, lang); } catch { gloss = ''; }
      const forms = tokenizeInformative(gloss || '');
      if (gloss && gloss.toLowerCase().trim() !== t.toLowerCase() && forms.size) {
        for (const f of forms) set.add(f);
        continue;
      }
    }
    set.add(t);
  }
  for (const t of tokenizeInformative(translated)) set.add(t);
  // Per-word too: the whole-query pass misses a word the dictionary cannot map,
  // and its expansion is what makes the record's own vocabulary visible. The
  // literal word is already in the set; only its other forms are added here.
  for (const entry of queryOwnWordForms(userQuery)) {
    for (const f of entry.forms) if (f !== entry.word && !/[^\x00-\x7F]/.test(f)) set.add(f);
  }
  return [...set];
}

/**
 * The informative words the USER literally wrote: ASCII tokens when the query has
 * any, otherwise their Urdu-script words. Callers must treat an empty set as
 * "no own-word evidence available" rather than "no evidence".
 */
export function queryOwnTokens(userQuery) {
  const ascii = [...tokenizeInformative(userQuery)];
  // A script-only query does have words the user wrote — they are simply not
  // ASCII. Returning them keeps the gate's own-word bar enforceable (it is
  // skipped when this set is empty) instead of judging Urdu questions on an
  // equally empty coverage set, which read as "no evidence" on real DGIP
  // records. Latin and Roman-Urdu queries keep the ASCII behaviour unchanged.
  return ascii.length ? ascii : tokenizeUrduWords(userQuery);
}

/**
 * Spelling variants the retrieval dictionary's own keys miss ("kirayedara" for
 * its `kirayedar` entry, "khali karne" for eviction phrasing). The gate expands
 * a user's word through the engine dictionary FIRST and this table second, so
 * overlap can be measured on a real transliteration instead of being skipped —
 * skipping it would let a query with no stated legal issue read as strong
 * evidence. Retrieval never sees this table: it judges records, not ranking.
 */
const EVIDENCE_VARIANTS = {
  kirayedara: 'kirayedar', kirayedaar: 'kirayedar', kirayedaron: 'kirayedar',
  kiraye: 'kiraya', kirayein: 'kiraya',
  makan: 'ghar', makaan: 'ghar',
  tankhwah: 'tankhwa',
  khali: 'vacate empty evict eviction',
  nokar: 'employee',
  // PPC 497 is headed "Adultery"; the citizen's word is zina. The record uses the
  // statute's term, so the gloss must count as the user's own word for grounding.
  zina: 'adultery', zinaa: 'adultery'
};

/**
 * Each of the user's own words plus the English corpus vocabulary that word maps
 * to: "chori" -> ["chori", "theft"], "saza" -> ["saza", "punishment", "penalty"].
 *
 * @returns {Array<{word: string, forms: string[]}>}
 */
export function queryOwnWordForms(userQuery, lang) {
  let detected = lang;
  if (!detected) {
    try { detected = RAGEngine.processQuery(String(userQuery || '')).detectedLang; } catch { detected = 'en'; }
  }
  return queryOwnTokens(userQuery).map(t => {
    const forms = new Set([t]);
    const expand = phrase => {
      for (const w of [...tokenizeInformative(phrase),
        ...tokenizeInformative(RAGEngine.normalizeQuery(phrase, detected))]) forms.add(w);
    };
    try {
      expand(t);
      if (EVIDENCE_VARIANTS[t]) expand(EVIDENCE_VARIANTS[t]);
      // Cross-script equivalence for the user's OWN Urdu word. The engine's
      // normalizeQuery leaves Urdu script untranslated, so without this the
      // word would have no form that any English corpus record can match.
      if (URDU_GLOSS[t]) expand(URDU_GLOSS[t]);
    } catch {
      // Translation helpers only; the literal word stays the evidence bar.
    }
    return { word: t, forms: [...forms] };
  });
}

function evidenceHay(chunk) {
  return `${chunk.title || ''} ${chunk.chunkTitle || ''} ${chunk.key || ''} ${chunk.text || ''}`.toLowerCase();
}

function coverageHit(token, chunk) {
  return evidenceHay(chunk).includes(token);
}

function coverageOf(tokens, chunk) {
  if (!tokens.length || !chunk) return 0;
  const hay = evidenceHay(chunk);
  let hit = 0;
  for (const t of tokens) if (hay.includes(t)) hit++;
  return hit / tokens.length;
}

/** Authority of where the record came from, from the chunk's own metadata. */
function authorityScore(chunk) {
  const d = String(chunk.sourceDomain || '').toLowerCase();
  const url = String(chunk.sourceURL || '').toLowerCase();
  if (!d && !url) return 0;
  if (/gov\.pk|\.gov\b|supremecourt|highcourt|pakistanlaw|tribunal|parliament|hec\.|nga\.|nbc/.test(`${d} ${url}`)) return 1;
  if (/gov|court|law|justice|nicop|moira|fia|peca/.test(`${d} ${url}`)) return 0.75;
  if (/\.org|\.edu|\.com|\.net/.test(d)) return 0.5;
  return url ? 0.5 : 0.25;
}

function isStale(chunk) {
  const s = String(chunk.legalStatus || '').toLowerCase();
  if (!s) return false;
  return !/(active|in force|current|ongoing|valid)/.test(s);
}

function isCaseLaw(chunk) {
  const dt = String(chunk.documentType || '').toLowerCase();
  return /case law|case study|judgment|judgement/.test(dt)
    || /_fulltext_|_index_|judgment|case_law|sc_judgments/.test(String(chunk.docId || ''));
}

function isProcedureLike(chunk) {
  return /procedur|workflow|guide|order|steps|manual/i.test(
    `${chunk.documentType || ''} ${chunk.chunkTitle || ''} ${chunk.title || ''}`);
}

/**
 * Judge a retrieval pass against the ORIGINAL user question.
 * @param {string} userQuery
 * @param {{chunks?: Array, domain?: string}} retrieval
 * @param {{tokens?: string[], foreign?: object}} [opts] precomputed helpers
 * @returns verdict + the nine detector reasons + per-chunk evidence rows
 */
export function evaluateEvidence(userQuery, retrieval, opts = {}) {
  const chunks = (retrieval && retrieval.chunks) || [];
  const domain = (retrieval && retrieval.domain) || 'general-legal';
  const routedDocs = DOMAIN_DOCS[domain] || [];
  const tokens = opts.tokens || queryEvidenceTokens(userQuery);
  const own = opts.own || queryOwnTokens(userQuery);
  const ownForms = opts.ownForms || queryOwnWordForms(userQuery, opts.lang);
  const probe = opts.foreign || parseOverseasIntent(userQuery);
  // WHAT the sentence is about, read from the corpus's own vocabulary and from
  // the case roles the user's words sit in — not from whichever domain a keyword
  // cascade happened to fire first. `decisive` stays false whenever the ask
  // reading is thin, so the gate keeps its existing behaviour on questions this
  // cannot judge confidently.
  const subject = opts.subject
    || analyzeSubject(own, { text: userQuery, glosses: ownForms.map(e => ({ source: e.word, forms: e.forms })) });
  // The caller's canonical wording of the situation it resolved from the user's OWN
  // sentence (everydayIntent's retrieval phrase). An everyday complaint names the
  // thing, not the legal category — "washing machine", never "defective goods" — and
  // statute text carries no consumer product nouns, so the citizen's literal words
  // alone can never show that a record covers their case. Two DISTINCT words of the
  // resolved situation must appear in the record to license it; one incidental match
  // licenses nothing, and these words never replace the user's own coverage test.
  const licensed = opts.situationTerms
    ? [...tokenizeInformative(String(opts.situationTerms))]
      .filter(t => t.length >= 5 && !GENERIC_RELATION_TERMS.has(t))
    : [];
  // The resolved situation IS a reading of what the question is about — in the
  // corpus's own category vocabulary — while the citizen's literal words may name no
  // legal subject at all ("washing machine", "stopped working"). Without this, one
  // generic English word the lexicon happens to file under another domain set the
  // records that answer the question aside as off-subject.
  const askedFromSituation = licensed.length >= 3 ? analyzeSubject(licensed, {}).asked : [];
  const subjectForRecords = askedFromSituation.length
    ? { ...subject, asked: [...new Set([...subject.asked, ...askedFromSituation])] }
    : subject;
  const wantsProcedure = PROCEDURE_RE.test(userQuery);
  const wantsCaseLaw = CASE_LAW_RE.test(userQuery);
  const namedProvince = PROVINCES.find(p => String(userQuery).toLowerCase().includes(p));
  const namedStatutes = STATUTE_PROFILES.filter(s => s.re.test(userQuery));
  // Provisions the user themselves named ("Section 302", "Article 199",
  // "Section 489-F", "دفعہ 496"). A lookup of a provision no kept record carries
  // is evidence that does not support the answer, even when an adjacent
  // provision scored well — and the letter suffix is part of that identity.
  const namedProvisions = askedProvisionKeys(userQuery);

  // Scope (Parts 4-8): which legal layer the user asked about, derived from
  // their own words. `layerAsked` is deliberately narrow — naming a city in an
  // otherwise general legal question says where the user is, not that they want
  // that city's by-laws, and the ladder must not be allowed to demand evidence
  // nobody asked for.
  const qs = opts.queryScope || detectQueryScope(userQuery);
  const ladder = opts.ladder === undefined ? scopeLadder(qs) : opts.ladder;
  const layerAsked = Boolean(qs) && institutionScoped(qs)
    && Boolean(qs.city || qs.province || qs.institutionNamed);
  const institutionQuery = namedInstitutionQuery(qs)
    ? (String(userQuery).match(/\b[A-Z][A-Za-z']+(?:[ \t]+[A-Z][A-Za-z']+){0,4}[ \t]+(?:University|Universities|Institute)\b/)
      || String(userQuery).match(/\b(?:University|Institute)[ \t]+of[ \t]+[A-Z][A-Za-z']+/)
      || [null])[0]
    : null;

  // Words that appear in headings without naming a subject. A heading made only
  // of these says nothing about what the record is about.
  const GENERIC_HEADING_TERMS = new Set([
    'punishment', 'punishments', 'penalty', 'penalties', 'definition', 'definitions',
    'interpretation', 'application', 'commencement', 'short', 'title', 'preamble',
    'repeal', 'schedule', 'general', 'procedure', 'powers', 'law', 'laws', 'legal',
    'pakistan', 'pakistani', 'section', 'sections', 'article', 'articles', 'act',
    'code', 'rule', 'rules', 'right', 'rights', 'offence', 'offences', 'offense', 'offenses'
  ]);
  // The user's own lexical fingerprint, literal and dictionary-faithful. Used to
  // decide whether a record's own heading names the subject they asked about.
  const ownLexicon = new Set([
    ...own.map(w => String(w).toLowerCase()),
    ...ownForms.flatMap(e => e.forms.map(f => String(f).toLowerCase()))
  ]);

  const rows = chunks.map(c => {
    const rawExact = Number(c.exactScore) || 0;
    // Only trust an exact-provision hit that was measured against the question
    // the user actually asked. opts.origExact is absent when a single pass is
    // judged on its own, in which case its own scores are faithful by definition.
    const exact = opts.origExact ? (Number(opts.origExact.get(c.id)) || 0) : rawExact;
    const vector = Number(c.vectorScore) || 0;
    const tfidf = Number(c.tfIdfScore) || 0;
    const score = Number(c.score) || 0;
    const cover = coverageOf(tokens, c);
    const ownHits = ownForms.length
      ? ownForms.reduce((n, e) => n + (e.forms.some(f => coverageHit(f, c)) ? 1 : 0), 0)
      : 0;
    const domainOk = !routedDocs.length || routedDocs.includes(c.docId);
    const statuteOk = !namedStatutes.length
      || namedStatutes.some(s => s.match.test(`${c.docId || ''} ${c.title || ''}`));
    // A record is "about another province" only when it NAMES exactly one
    // province and it is not the one asked about. The bare `ict` used to match
    // inside the umbrella label "Pakistan (Provincial & ICT)" that doc-level
    // metadata carries, which discarded the Sindh tenancy record for a Sindh
    // question — an umbrella label names no province, so it cannot conflict.
    const jurisText = String(c.jurisdiction || '');
    const provincesNamed = ['punjab', 'sindh', 'balochistan', 'khyber pakhtunkhwa', 'kpk', 'islamabad', 'ict']
      .filter(p => new RegExp(`\\b${p}\\b`, 'i').test(jurisText));
    const umbrellaLabel = /provincial|all provinces/i.test(jurisText) && provincesNamed.length <= 1;
    const jurisMismatch = Boolean(namedProvince) && provincesNamed.length > 0 && !umbrellaLabel
      && !jurisText.toLowerCase().includes(namedProvince.split(' ')[0]);
    // Does THIS record carry the provision the user asked for, suffix included?
    const provisionHit = namedProvisions.length > 0 && chunkCarriesProvision(c, namedProvisions);
    const scope = deriveChunkScope(c);
    const scopeWeight = scopeSpecificityWeight(scope, ladder);
    // Evidence about a DIFFERENT place is evidence about something else.
    const scopeMismatch = scopeConflict(scope, qs);
    // Jurisdiction-specific education RULE lookup. A question that names a
    // region and asks for that region's deadline, last date, domicile condition,
    // eligibility criteria or quota may not be established by a record that
    // neither covers that region nor states an education rule of general
    // application. The measured Window G defect: an AJK scholarship "domicile
    // requirement and last date" question was answered from the national civic
    // domicile workflow and labelled VERIFIED LEGAL REFERENCE. A purely
    // procedural civic question ("how do I obtain a domicile certificate") does
    // not carry a rule attribute and is unaffected.
    const askedRegions = REGION_WORDS.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(String(userQuery)));
    // District resolver. detectQueryScope only knows the cities in
    // CITY_PROVINCE, so a question naming a district ("Tharparkar") previously
    // set no locale at all and the guard stayed blind to it. An unlisted place
    // name is simply not resolved — the ask then behaves as it did before.
    const askedDistricts = Object.keys(DISTRICT_PROVINCE)
      .filter(d => new RegExp(`\\b${d.replace(/ /g, '[- ]')}\\b`, 'i').test(String(userQuery)));
    const districtProvince = askedDistricts.map(d => DISTRICT_PROVINCE[d]);
    const regionAsked = Boolean(qs && (qs.province || qs.city))
      || askedRegions.length > 0 || askedDistricts.length > 0;
    const educationRuleAsk = regionAsked && EDUCATION_OBJECT_RE.test(String(userQuery))
      && RULE_ATTRIBUTE_RE.test(String(userQuery));
    const regionCovered = askedRegions.some(w => new RegExp(`\\b${w}\\b`, 'i').test(jurisText))
      || Boolean(scope.province && qs && qs.province
        && String(scope.province).toLowerCase() === String(qs.province).toLowerCase())
      || Boolean(scope.city && qs && qs.city
        && String(scope.city).toLowerCase() === String(qs.city).toLowerCase())
      // A district ask is answered locally only by a record that names that
      // district; naming the enclosing province is enough when the USER also
      // named that province, because then the province rule is what was asked for.
      || askedDistricts.some(d => new RegExp(`\\b${d.replace(/ /g, '[- ]')}\\b`, 'i').test(jurisText))
      || (askedRegions.length > 0
        && districtProvince.some(p => new RegExp(`\\b${p}\\b`, 'i').test(jurisText)));
    const generalEducationRecord = askedDistricts.length === 0
      && (Boolean(scope.studentRelevant)
        || EDUCATION_OBJECT_RE.test(`${c.documentType || c.type || ''} ${c.title || ''}`));
    const regionEducationGap = educationRuleAsk && !regionCovered && !generalEducationRecord;
    // "Does this record actually carry the question?" — an exact provision hit
    // counts as support on its own; otherwise the record must share content
    // terms with the query, and at least one of those shared terms must carry
    // the meaning of a word the USER wrote (its literal form or its dictionary
    // translation), not a generic expansion they never asked for.
    // A record whose own section heading names the subject — using a word the
    // user wrote or its faithful dictionary gloss — is about that subject even
    // when its prose says "shall be punished" rather than "punishment". PPC 497
    // is headed "Adultery." (the gloss of zina) while the 254-token definitions
    // clause headed "Definitions." out-scored it on body overlap alone and said
    // nothing about the offence. Generic heading words are excluded so
    // "Punishment of abetment…" cannot claim the subject by sharing "punishment".
    const headingWords = new Set(tokenizeInformative(c.chunkTitle || ''));
    const headingSubject = cover >= MIN_COVERAGE
      && [...headingWords].some(w => ownLexicon.has(w) && !GENERIC_HEADING_TERMS.has(w));
    // Which case the record is about, judged against the ask reading rather
    // than against a routed document list. A record from a subject the user did
    // not describe is not evidence for this answer, however well its words fit.
    const subj = subjectCheck(c, subjectForRecords);
    // An exact provision hit on a record belonging to the domain the question
    // was routed to is the engine's own, query-derived subject decision. The
    // term-profile reading beneath is a statistical guess that generic
    // vocabulary can fool: the word "social" is frequent in education records,
    // so "someone made a fake profile using my pictures on social media" was
    // read as an education ask and PECA 13/24 — exact hits on routed-domain
    // documents — were set aside as off-subject, leaving HEC records answering
    // a cybercrime question. The weaker reading may not veto the stronger one.
    const subjectOverridden = subj.checked && !subj.ok && domainOk && exact >= 8;
    const offSubject = subj.checked && !subj.ok && !subjectOverridden;
    // Words of the resolved situation this record actually carries. Two of them,
    // in a record the router already filed under the domain that was asked about,
    // is the same agreement test the user's own words face — it just speaks the
    // corpus's category vocabulary instead of the citizen's object nouns.
    const situationHits = licensed.length
      ? licensed.filter(t => evidenceHay(c).includes(t)).length : 0;
    const support = exact >= 8
      || (cover >= SUPPORT_COVERAGE && (own.length === 0 || ownHits >= 1))
      || (headingSubject && ownHits >= 1)
      // The local embedding score does not discriminate (a nonsense query scores
      // 0.83 against case-law records, a correct criminal match 0.78), so this
      // branch is carried by agreement on the user's own words: TWO of them, not
      // one incidental match. Runtime calibration over answerable vs adjacent-only
      // queries separated the two sets cleanly on exactly this count.
      || (vector >= 0.5 && cover >= MIN_COVERAGE && ownHits >= 2)
      || (licensed.length >= 3 && situationHits >= 2 && domainOk && cover >= MIN_COVERAGE);
    const keep = support && score >= ACCEPT_SCORE && !jurisMismatch && !scopeMismatch
      && !regionEducationGap && !offSubject && (domainOk || cover >= SUPPORT_COVERAGE);
    return {
      chunk: c, docId: c.docId, score, exact, rawExact, vector, tfidf,
      coverage: Number(cover.toFixed(2)), ownHits, headingSubject, situationHits,
      domainOk, statuteOk, jurisMismatch, regionEducationGap, provisionHit,
      subjectOk: subj.ok || subjectOverridden, subjectWhy: subj.why, offSubject,
      stale: isStale(c), authority: authorityScore(c),
      caseLaw: isCaseLaw(c), procedureLike: isProcedureLike(c), support, keep,
      scope, scopeWeight, scopeMismatch
    };
  });

  const accepted = rows.filter(r => r.keep);
  // Judge what we would actually answer from; fall back to the raw top chunk
  // only when nothing survived, so an empty pass still reports honestly.
  const best = accepted.length ? accepted.reduce((a, b) => (b.score > a.score ? b : a)) : (rows[0] || null);
  const reasons = [];
  const add = r => { if (!reasons.includes(r)) reasons.push(r); };

  if (!rows.length) add('no_evidence');
  else if (!accepted.length && rows.some(r => r.regionEducationGap)) add('jurisdiction_evidence_gap');
  else if (!accepted.length) add('insufficient_evidence');
  else if (accepted.length < 2 && !rows.some(r => r.keep && r.exact >= 8)) add('insufficient_evidence');
  if (best) {
    if ((best.coverage < MIN_COVERAGE || (own.length > 0 && best.ownHits === 0))
      && best.exact < 8) {
      add('irrelevant_chunks');
    }
    if (best.tfidf < 1.0 && best.exact < 8) add('weak_lexical_match');
    if (accepted.length && routedDocs.length && !accepted.some(r => r.domainOk)) add('wrong_domain');
    // The user pointed at a specific statute and nothing accepted belongs to it.
    if (accepted.length && namedStatutes.length && !accepted.some(r => r.statuteOk)) add('wrong_domain');
    // The user asked for a specific provision and no kept record carries it —
    // adjacent provisions are not an answer to this lookup.
    if (accepted.length && namedProvisions.length && !accepted.some(r => r.provisionHit)) {
      add('unsupported_evidence');
    }
    if (accepted.length && accepted.every(r => r.jurisMismatch)) add('wrong_jurisdiction');
    if (probe.isOverseas && accepted.length && !accepted.some(r => /cross_border|immigration|foreigner/i.test(r.docId))) {
      add('wrong_jurisdiction');
    }
    if (accepted.length && accepted.every(r => r.authority === 0)) add('poor_source_quality');
    if (accepted.length && accepted.every(r => r.stale)) add('poor_source_quality');
    if (wantsProcedure && accepted.length && !accepted.some(r => r.procedureLike)) add('procedure_mismatch');
    if (wantsCaseLaw && accepted.length && !accepted.some(r => r.caseLaw)) add('case_law_mismatch');
    if (accepted.length && accepted.every(r => r.coverage < MIN_COVERAGE) && best.exact < 8) {
      add('unsupported_evidence');
    }
    if (accepted.length && own.length && accepted.every(r => r.ownHits === 0) && best.exact < 8) {
      add('unsupported_evidence');
    }
    // The words overlapped; the case did not. Every record that matched the
    // user's vocabulary belongs to a subject their own sentence does not
    // describe, so there is nothing here this answer may be built from.
    if (subject.decisive && rows.some(r => r.offSubject) && !accepted.some(r => r.subjectOk)) {
      add('subject_mismatch');
    }
  }

  // -- scope verdicts (Parts 6-8) ---------------------------------------------
  // Which ladder layers the accepted evidence actually reaches.
  const scopeCov = scopeCoverage(accepted.map(r => r.scope), ladder, qs);
  const mismatchRows = [...new Set(rows.filter(r => r.scopeMismatch).map(r => r.scopeMismatch))];
  // Records from another place were set aside: informational, never blocking —
  // the answer can still be correct for the question that was asked.
  if (mismatchRows.length) add('scope_mismatch');
  // Only the layer the user ASKED for (the top of the ladder) can be missing;
  // the rungs below it are fallbacks, and a covered top means the ask is met.
  const missingTop = layerAsked && accepted.length && ladder && ladder[0] !== 'national' && !scopeCov.topCovered
    ? ladder[0] : null;
  if (missingTop) add('scope_missing');

  const bestScore = accepted.length ? Math.max(...accepted.map(r => r.score)) : 0;
  const bestCover = accepted.length ? Math.max(...accepted.map(r => r.coverage)) : 0;
  const bestExact = accepted.length ? Math.max(...accepted.map(r => r.exact)) : 0;
  const bestOwnHits = accepted.length ? Math.max(...accepted.map(r => r.ownHits)) : 0;
  // Did the user name a provision themselves? Then an exact hit on THAT number
  // is sufficient grounding even when the record's prose shares no words.
  const namedProvision = /\b(section|sec|article|art|dafa|دفعہ)\s*\.?\s*\d+/i.test(userQuery);
  const coverageBar = (opts.lang || retrieval.detectedLang || 'en') === 'en' ? 0.3 : 0.2;
  // A question that names only a place and the word for "law" states no legal
  // issue, so an index or coverage row titled after that place matches it
  // completely by accident. It is still answered from those records, but never
  // promoted to strong authority on that basis.
  const noStatedIssue = tokens.length > 0
    && tokens.every(t => SCOPE_META_TERMS.has(t) || PLACE_TERMS.has(t));
  if (noStatedIssue && accepted.length) add('no_stated_issue');
  const blocking = reasons.some(r => r === 'wrong_domain' || r === 'wrong_jurisdiction'
    || r === 'unsupported_evidence' || r === 'no_evidence' || r === 'insufficient_evidence'
    || r === 'irrelevant_chunks' || r === 'scope_missing' || r === 'subject_mismatch');
  let verdict = 'weak';
  if (!accepted.length) verdict = 'none';
  else if (
    bestScore >= STRONG_SCORE
    && !blocking
    && !noStatedIssue
    // At least one of the user's own words (or a faithful exact provision hit)
    // must be present in the record we would answer from.
    && (own.length === 0 || bestOwnHits >= 1 || bestExact >= 8)
    && (bestCover >= coverageBar || (namedProvision && bestExact >= 8) || bestExact >= 15)
  ) verdict = 'strong';

  return {
    verdict, reasons, domain, routedDocs, wantsProcedure, wantsCaseLaw, tokens, own,
    // The ask reading the gate judged against, carried out so a refusal can say
    // what was understood and the retry can chase the subject that was asked.
    subject: {
      decisive: subject.decisive, asked: subjectForRecords.asked, hasRoles: subject.hasRoles,
      top: subject.top ? { domain: subject.top.domain, score: subject.top.score, terms: subject.top.terms } : null
    },
    namedStatutes: namedStatutes.map(s => s.label),
    accepted, rows, supportedCount: accepted.length,
    queryScope: qs, ladder, institutionQuery,
    scope: {
      asked: {
        city: qs.city, province: qs.province, institutionNamed: qs.institutionNamed,
        universityContext: qs.universityContext, studentContext: qs.studentContext,
        nationalExplicit: qs.nationalExplicit, educationTopic: qs.educationTopic,
        text: qs.text,
        layerAsked
      },
      ladder,
      covered: scopeCov.covered,
      missing: scopeCov.missing,
      missingTop,
      mismatch: mismatchRows[0] || null,
      // Diagnostics only — which is known versus which is the corpus default.
      // A record that states no jurisdiction is national only by derivation
      // (jurisdiction:pakistan-default); it is never counted as asserting a
      // layer, and nothing is added to the answer because of this count.
      declared: accepted.filter(r => !(r.scope && (r.scope.derivedFrom || []).includes('jurisdiction:pakistan-default'))).length,
      undeclared: accepted.filter(r => r.scope && (r.scope.derivedFrom || []).includes('jurisdiction:pakistan-default')).length,
      scopeKnown: accepted.length > 0
        && accepted.every(r => r.scope && !(r.scope.derivedFrom || []).includes('jurisdiction:pakistan-default')),
      layers: accepted.slice(0, 4).map(r => ({
        scopeLevel: r.scope.scopeLevel, city: r.scope.city, province: r.scope.province,
        institutions: r.scope.institutions.slice(0, 3), authorityLevel: r.scope.authorityLevel,
        sector: r.scope.sector, docId: r.docId
      }))
    },
    top: best ? {
      docId: best.docId, score: best.score, exact: best.exact, rawExact: best.rawExact,
      vector: best.vector, tfidf: best.tfidf, coverage: best.coverage, ownHits: best.ownHits,
      scope: best.scope ? { ...best.scope } : null
    } : null
  };
}

/** Drop filler words and repeated punctuation so retries chase real terms. */
function stripNoise(query) {
  return String(query)
    .replace(/[\s]+/g, ' ')
    .replace(/\b(please|kindly|actually|basically|really|urgently|asap|hello|hi|salam|assalam o alaikum)\b[,!.\s]*/gi, ' ')
    .replace(/[?!]{2,}/g, '?')
    .trim();
}

/**
 * Build the next corrective query. Attempt 1 re-states the same question with
 * the routed domain's own corpus vocabulary; attempt 2 keeps that question but
 * runs it through the OTHER existing retrieval strategy. Returning null ends the
 * loop early when there is nothing left to try.
 */
function buildCorrectiveQuery(userQuery, ev, attemptNo) {
  const clean = stripNoise(userQuery);
  const domainTerm = DOMAIN_TERMS[ev.domain] || '';
  if (attemptNo === 1) {
    const needsDomainTerms = ev.reasons.includes('wrong_domain')
      || ev.reasons.includes('insufficient_evidence')
      || ev.reasons.includes('irrelevant_chunks')
      || ev.reasons.includes('subject_mismatch');
    // The user named a statute the evidence missed: re-scope on THEIR reference
    // first, so the retry looks for the law they asked about, not a synonym.
    const statuteTerms = (ev.namedStatutes || []).join(' ');
    // The evidence answered a different case. Chase the subject the sentence
    // actually describes with that subject's OWN corpus vocabulary — words taken
    // from the documents this repository ships, never invented for the query.
    const subjectTerms = ev.reasons.includes('subject_mismatch') && ev.subject && ev.subject.top
      ? domainSubjectTerms(ev.subject.top.domain, 6).join(' ') : '';
    // A narrower legal layer was asked for (or records from another place were
    // set aside): re-state the question with the place the USER named plus the
    // corpus vocabulary of that layer. An institution is named only when the
    // user named it — nobody's rules are invented to fill the gap.
    const scopeTerms = [];
    const sc = ev.scope;
    const scopeReason = ev.reasons.includes('scope_missing') || ev.reasons.includes('scope_mismatch');
    const nothingAccepted = !(ev.accepted || []).length;
    if (sc && sc.ladder && (scopeReason || nothingAccepted)) {
      const place = sc.asked ? [sc.asked.city, sc.asked.province].filter(Boolean).join(' ') : '';
      if (place) scopeTerms.push(place);
      // Something was accepted but the asked layer was not: chase that one layer.
      // Nothing was accepted: the question may be in the wrong corpus entirely,
      // so the retry covers the asked layer AND the rung below it.
      const layers = nothingAccepted ? sc.ladder.slice(0, 2) : [sc.missingTop || sc.ladder[0]];
      for (const layer of layers) {
        if (!layer || layer === 'national') continue;
        if (layer === 'university' && ev.institutionQuery) scopeTerms.push(ev.institutionQuery);
        else scopeTerms.push(SCOPE_TERMS[layer] || '');
      }
    }
    const scopeExtra = scopeTerms.join(' ').replace(/\s+/g, ' ').trim();
    const extra = statuteTerms
      || (subjectTerms ? subjectTerms
        : (scopeExtra && ev.reasons.includes('scope_missing') ? `${scopeExtra} ${domainTerm}`.trim()
          : needsDomainTerms ? (scopeExtra ? `${scopeExtra} ${domainTerm}`.trim() : domainTerm)
          : (ev.wantsProcedure && ev.reasons.includes('procedure_mismatch')) ? 'procedure steps filing court'
          : (ev.wantsCaseLaw && ev.reasons.includes('case_law_mismatch')) ? 'judgment reported decision precedent'
          : (scopeExtra || domainTerm)))
      || '';
    if (!extra) return null;
    const q = `${clean} ${extra}`.replace(/\s+/g, ' ').trim();
    if (q.toLowerCase() === String(userQuery).toLowerCase().trim()) return null;
    return {
      query: q,
      strategy: !statuteTerms && subjectTerms ? 'reformulate_subject'
        : (scopeReason || (nothingAccepted && scopeExtra))
          ? 'reformulate_scope' : 'reformulate_domain_scope'
    };
  }
  if (attemptNo === 2) {
    return { query: clean, strategy: 'alternate_strategy', invertStrategy: true };
  }
  return null;
}

/** Re-rank merged candidates: the existing hybrid score first, gate signals next. */
function gateScore(row, ev) {
  let g = row.score;
  // An exact provision hit (the user named the section/article and it matched)
  // must never be re-ranked below a merely well-worded unrelated record.
  if (row.exact >= 15) g += 12;
  else if (row.exact >= 8) g += 6;
  if (ev.routedDocs.length) g += row.domainOk ? 3.0 : -3.0;
  g += 4.0 * row.coverage;
  // A heading that names the subject outranks body overlap in a record that
  // never names it: the offence clause should be shown before its definitions.
  if (row.headingSubject) g += 1.5;
  g += 1.5 * row.authority;
  if (row.jurisMismatch) g -= 6.0;
  // Evidence about another subject answers a question nobody asked — the same
  // class of error as evidence about another place, so it carries the same weight.
  if (row.offSubject) g -= 8.0;
  if (row.stale) g -= 2.0;
  if (ev.wantsCaseLaw) g += row.caseLaw ? 2.0 : -1.0;
  if (ev.wantsProcedure && row.procedureLike) g += 1.5;
  if (ev.namedStatutes && ev.namedStatutes.length) g += row.statuteOk ? 2.0 : -1.5;
  // Scope: a specificity tie-breaker, smaller than relevance terms. A record
  // about a DIFFERENT place is the one case where scope outranks the score,
  // because it answers a question nobody asked.
  if (row.scopeMismatch) g -= 6.0;
  else if (row.scopeWeight) g += Number((1.5 * row.scopeWeight).toFixed(2));
  return Number(g.toFixed(2));
}

/**
 * Retrieval + evidence gate + bounded correction.
 * Returns an object shaped exactly like RAGEngine.retrieve() (so every existing
 * consumer keeps working unchanged) plus `correction` and `evidence` diagnostics.
 */
export async function retrieveCorrected(userQuery, { isOnline = true, apiKey = null, maxCorrections = MAX_CORRECTIVE_ATTEMPTS, extraQuery = null } = {}) {
  const started = Date.now();
  const foreign = parseOverseasIntent(userQuery);
  let qLang = 'en';
  try { qLang = RAGEngine.processQuery(String(userQuery || '')).detectedLang || 'en'; } catch { /* default */ }
  const tokens = queryEvidenceTokens(userQuery);
  const own = queryOwnTokens(userQuery);
  const ownForms = queryOwnWordForms(userQuery, qLang);
  const queryScope = detectQueryScope(userQuery);
  const ladder = scopeLadder(queryScope);
  // One ask reading for the whole correction loop: retries may add evidence,
  // they may never redefine what the question was about.
  const subject = analyzeSubject(own, {
    text: userQuery, glosses: ownForms.map(e => ({ source: e.word, forms: e.forms }))
  });
  // A caller that has already worked out WHAT the question is about hands in one
  // paraphrase of the same situation. Lifting it above the judge lets it ADD
  // evidence on the primary pass too; it never redefines the ask, because every
  // row is still scored against the user's own words.
  const extra = String(extraQuery || '').trim();
  const judge = (retrieval, origExact) =>
    evaluateEvidence(userQuery, retrieval, {
      tokens, own, ownForms, foreign, lang: qLang, origExact, queryScope, ladder, subject,
      situationTerms: extra && extra.toLowerCase() !== String(userQuery || '').toLowerCase().trim() ? extra : ''
    });

  const first = await RAGEngine.retrieve(userQuery, isOnline, apiKey);
  let ev = judge(first);
  // Exact-provision hits are query-dependent: only the ones measured against the
  // user's own question may grant the exact-hit shortcuts later on.
  const origExact = new Map(ev.rows.map(r => [r.chunk.id, r.rawExact]));
  const attempts = [{ n: 0, strategy: 'primary', query: userQuery, verdict: ev.verdict, chunks: (first.chunks || []).length }];
  let corrections = 0;

  // Merge pool: chunk id -> best-scoring evidence row across all passes.
  const pool = new Map();
  // The topic label stays with the domain the user's OWN words routed to, so the
  // gate keeps judging the collected evidence against the question that was
  // actually asked. A retry can only add evidence, never redefine the ask.
  let poolDomain = first.domain;
  let poolBestScore = ev.rows.length ? Math.max(...ev.rows.map(r => r.score)) : -1;
  const absorb = (rows, passDomain) => {
    for (const r of rows) {
      const prev = pool.get(r.chunk.id);
      if (!prev || r.score > prev.score) pool.set(r.chunk.id, r);
      if (r.score > poolBestScore) {
        poolBestScore = r.score;
        // A reformulation carries corpus words the user never wrote, so its own
        // routing says nothing about the ask. Only a question that never routed
        // at all may take a label from a retry; otherwise the injected words
        // would redefine the subject and another subject's records would clear
        // the routed-domain check as if they answered the original question.
        if (poolDomain === 'unknown' || poolDomain === 'general-legal') poolDomain = passDomain;
      }
    }
  };
  absorb(ev.rows, first.domain);

  // A caller that has already worked out WHAT the question is about may hand in
  // one paraphrase of the same situation. It only ADDS candidates: every row it
  // brings is scored against the user's own words by judge(), so a record that
  // matches the paraphrase but not the question still fails the gate.
  if (extra && ev.verdict !== 'strong'
      && extra.toLowerCase() !== String(userQuery || '').toLowerCase().trim()) {
    const pass = await RAGEngine.retrieve(extra, isOnline, apiKey);
    absorb(judge(pass).rows, pass.domain);
    ev = judge({ chunks: [...pool.values()].map(r => r.chunk), domain: poolDomain }, origExact);
    attempts.push({
      n: 0, strategy: 'situation_paraphrase', query: extra,
      verdict: ev.verdict, chunks: (pass.chunks || []).length, online: isOnline
    });
  }

  while (ev.verdict !== 'strong' && corrections < maxCorrections) {
    const next = buildCorrectiveQuery(userQuery, ev, corrections + 1);
    if (!next) break;
    corrections++;
    const online = next.invertStrategy ? !isOnline : isOnline;
    const pass = await RAGEngine.retrieve(next.query, online, apiKey);
    absorb(judge(pass).rows, pass.domain);
    // Re-judge the ORIGINAL question over the merged pool — never over the
    // reformulation, so a retry can only ADD evidence, not redefine the ask.
    ev = judge({ chunks: [...pool.values()].map(r => r.chunk), domain: poolDomain }, origExact);
    attempts.push({
      n: corrections, strategy: next.strategy, query: next.query,
      verdict: ev.verdict, chunks: (pass.chunks || []).length, online
    });
  }

  // One final judgement over the whole merged pool, under the faithful-signal
  // rule, so acceptance, reasons, verdict and ranking all describe the SAME
  // thing: how well the collected evidence answers the ORIGINAL question.
  ev = judge({ chunks: [...pool.values()].map(r => r.chunk), domain: ev.domain }, origExact);
  const scored = ev.rows.map(r => ({ ...r, gate: gateScore(r, ev) }))
    .sort((a, b) => b.gate - a.gate);
  const accepted = scored.filter(r => r.keep);
  // Exhausted loop with nothing reliable: hand back an empty set so the caller's
  // existing honest "insufficient evidence / ask a clarifying question" path runs.
  const finalChunks = ev.verdict === 'none' ? [] : accepted.map(r => r.chunk);
  const relevance = ev.verdict === 'strong' ? 'high' : (finalChunks.length ? 'low' : 'none');

  return {
    ...first,
    chunks: finalChunks,
    domain: ev.domain,
    relevance,
    evidence: {
      verdict: ev.verdict,
      reasons: ev.reasons,
      domain: ev.domain,
      subject: ev.subject,
      namedStatutes: ev.namedStatutes,
      supportedCount: accepted.length,
      rejected: scored.length - accepted.length,
      scope: ev.scope,
      institutionQuery: ev.institutionQuery,
      top: ev.top ? { ...ev.top } : null
    },
    correction: {
      triggered: corrections > 0,
      attempts: corrections,
      maxAttempts: maxCorrections,
      strategies: attempts.map(a => a.strategy),
      detail: attempts,
      ms: Date.now() - started
    }
  };
}

/** Accepted answer levels; anything else falls back to the product default. */
export function normalizeAnswerLevel(level) {
  const v = String(level || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (v.startsWith('advanced') || v === 'professional' || v === 'expert' || v === 'lawyer') return 'advanced';
  if (v === 'intermediate' || v === 'middle' || v === 'moderate') return 'intermediate';
  return 'beginner';
}

/** Depth profile shared by the local composer and the online prompt instruction. */
export const ANSWER_LEVELS = {
  beginner: {
    label: 'Beginner', chunkCap: 4, sources: 1, explanationChars: 420, steps: 3,
    answerSentences: 2, answerChars: 480,
    legalBasis: 1, precedent: false, remedy: false, forum: false, evidenceNote: false, exceptions: 0
  },
  intermediate: {
    label: 'Intermediate', chunkCap: 6, sources: 3, explanationChars: 700, steps: 5,
    answerSentences: 4, answerChars: 1100,
    legalBasis: 3, precedent: false, remedy: true, forum: true, evidenceNote: false, exceptions: 0
  },
  advanced: {
    label: 'Advanced / Professional', chunkCap: 8, sources: 4, explanationChars: 1100, steps: 7,
    answerSentences: 8, answerChars: 2400,
    legalBasis: 4, precedent: true, remedy: true, forum: true, evidenceNote: true, exceptions: 2
  }
};

/** Plain-language verdict on how well the accepted evidence covers the ask. */
export function evidenceNoteText(evidence, isRoman = false) {
  if (!evidence) return null;
  const n = Number(evidence.supportedCount) || 0;
  const parts = [];
  parts.push(isRoman
    ? `${n} verified record(s) is jawab ko support karte hain`
    : `${n} verified record${n === 1 ? '' : 's'} in the verified corpus support this answer`);
  if (evidence.rejected) {
    parts.push(isRoman
      ? `${evidence.rejected} laazim record(s) ko ye keh kar hataya gaya ke wo aap ke mamlay se match nahi karte`
      : `${evidence.rejected} retrieved record(s) were dropped as not supporting this question`);
  }
  if (evidence.verdict === 'strong') {
    parts.push(isRoman
      ? 'record aap ke mamlay se seedha mutaliq hai'
      : 'the closest record is directly on point for this question');
  } else if (evidence.verdict === 'weak') {
    parts.push(isRoman
      ? 'record qismen mutaliq hai — bataye gaye qanoon ka aap par poora itlaq hona check karein'
      : 'the records are only partly on point, so confirm how far the cited law actually reaches your facts');
  }
  if (evidence.corrections) {
    parts.push(isRoman
      ? `dhoond ko ${evidence.corrections} baar theek karke dobara kiya gaya`
      : `retrieval was corrected ${evidence.corrections} time(s) before this answer`);
  }
  return parts.join('; ') + '.';
}

/** Prompt instruction for the online provider path (same depth rules, shared). */
export function answerLevelInstruction(level) {
  const l = normalizeAnswerLevel(level);
  if (l === 'advanced') {
    return 'ANSWER LEVEL = ADVANCED / PROFESSIONAL: give a detailed legal analysis with the exact provisions (section/article/order numbers) that the evidence supports, procedural detail, any reported judgment in the evidence, authority and source status, and the important exceptions or nuances. Discuss the strength of the evidence where the records allow it. Never add a section, case or citation that is not in the retrieved evidence.';
  }
  if (l === 'intermediate') {
    return 'ANSWER LEVEL = INTERMEDIATE: explain clearly with moderate detail, name the relevant legal sections/provisions where the evidence supports them, set out the practical process, and state the important qualifications or exceptions. Never add a section, case or citation that is not in the retrieved evidence.';
  }
  return 'ANSWER LEVEL = BEGINNER: answer in simple everyday language, direct answer first, then what to do next. Use minimal legal terminology, keep it short, and give at most one verified source or official process link. Do NOT list sections or case law unless the user asked for them. Never add a section, case or citation that is not in the retrieved evidence.';
}
