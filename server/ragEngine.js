import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLocalEmbedder } from './localEmbedder.js';
import { expandSearchText } from './legalGlossary.js';
import { findProvisionRefs } from './provisionRef.js';
import { detectWrittenLanguage, registerRomanGlossary } from './languageDetect.js';
import { isSelfReferentialAuthority } from './corpusMetadata.js';

// P23 cloud readiness: anchor the index path to this file's directory so
// retrieval works from any working directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, '..', 'rag', 'indexes', 'rag_index.json');
// F12: additive local semantic vector index (see server/buildLocalVectors.js).
// Kept SEPARATE from the frozen rag_index.json so the 2.5.0-final freeze hash
// stays valid; vectors are merged into chunks at load time.
const LOCAL_VECTORS_PATH = path.join(__dirname, '..', 'rag', 'indexes', 'local_vectors.json');
let indexData = null;
/**
 * Domain-scoped corpus documents for each routed legal domain. Hoisted to module
 * scope (literal contents unchanged) so the corrective-RAG evidence gate in
 * server/evidenceGate.js can judge domain consistency and tighten metadata on a
 * corrective retry. Retrieval consumes it exactly as before.
 */
/**
 * HEC corpus documents: the official Higher Education Commission policies, service
 * rules, quality-assurance frameworks and the dated notification register
 * (rag/documents/hec). Listed once because the domain ranking scope and the
 * provision-number scope in retrieve() must agree on exactly this set.
 */
export const HEC_DOCS = [
  'hec_institution_recognition', 'hec_ugep_undergraduate', 'hec_gep_graduate', 'hec_laup_liberal_arts',
  'hec_ddjdp_joint_degrees', 'hec_etc_admission_tests', 'hec_degree_attestation', 'hec_equivalence_services',
  'hec_deeni_asnad_equivalence', 'hec_fee_refund_policy', 'hec_harassment_policy', 'hec_student_welfare_policies',
  'hec_student_support_programs', 'hec_odl_policy', 'hec_tne_transnational', 'hec_quality_assurance',
  'hec_pqf_qualifications', 'hec_curriculum_revision', 'hec_anti_plagiarism', 'hec_genai_academic_integrity',
  'hec_research_publications', 'hec_faculty_appointment', 'hec_notifications_register'
];

export const DOMAIN_DOCS = {
      criminal: ['ppc_1860', 'crpc_1898', 'nab_ordinance_1999', 'police_order_2002', 'ata_1997', 'juvenile_justice_2000', 'prisons_laws'],
      cyber: ['peca_2016', 'fia_act_1974'],
      family: ['family_laws_1961', 'women_protection_laws', 'succession_laws'],
      rights: ['constitution_1973', 'fundamental_rights'],
      civil: ['cpc_1908', 'property_laws', 'specific_relief_act_1877', 'contract_act_1872', 'sales_of_goods_act_1930', 'tenancy_laws', 'succession_laws', 'arbitration_act_1940', 'limitation_act_1908', 'poa_laws'],
      labour: ['labour_employment', 'admin_service_laws'],
      consumer: ['consumer_protection'],
      'legal-aid': ['legal_aid_services'],
      procedure: ['court_procedures', 'court_workflows', 'legal_workflows', 'expanded_procedures', 'court_hierarchy'],
      'case-law': ['sc_judgments', 'expanded_case_law', 'landmark_case_studies', 'lhc_fulltext_2026', 'ihc_fulltext_2026', 'phc_fulltext_2026', 'bhc_fulltext_2026', 'lhc_index_2026', 'ihc_index_2026', 'phc_index_2026', 'bhc_index_2026'],
      // `bisp_8171_programme_procedures` is deliberately NOT listed here: it is one
      // named programme with its own topic-gated cue and section ordering below, and
      // a blanket civic lift put Kafaalat, transgender and Nashonuma records into the
      // window of an unrelated passport question. It stays in 'social-protection'.
      civic: ['civic_workflows', 'civic_services', 'citizen_official_procedures', 'elections_act_2017'],
      'social-protection': ['civic_workflows', 'civic_services', 'citizen_official_procedures', 'edu_scholarships', 'legal_aid_services', 'public_offices', 'expanded_institutions', 'pbm_education_assistance', 'bisp_8171_programme_procedures'],
      foreigner: ['foreigner_entry_stay_registration', 'foreigner_residence_work_study', 'pakistan_visa_categories', 'immigration_laws'],
      'cross-border': ['cross_border_consular', 'cross_border_travel', 'cross_border_employment', 'cross_border_education', 'cross_border_diplomacy', 'cross_border_legal', 'immigration_laws', 'poa_laws'],
      evidence: ['evidence_qso_1984'],
      // public_offices carries the regulator record that names the Banking
      // Mohtasib — the only complaint channel the corpus holds for a bank
      // customer — so it belongs to the banking evidence domain; the gate's
      // topical tests still reject its unrelated office records.
      banking: ['banking_laws', 'ppc_1860', 'public_offices'],
      customs: ['customs_act_1969'],
      environment: ['environmental_laws'],
      torts: ['torts_laws'],
      health: ['health_laws'],
      elections: ['elections_act_2017', 'civic_workflows'],
      province: ['provincial_fulltext', 'provincial_laws'],
      history: ['pakistan_constitutional_history', 'amendment_history'],
      amendment: ['amendment_history'],
      drafting: ['poa_laws'],
      immigration: ['immigration_laws', 'foreigner_entry_stay_registration', 'foreigner_residence_work_study'],
      offices: ['public_offices', 'expanded_institutions'],
      competition: ['competition_act_2010'],
      education: ['sindh_higher_education_laws', 'gcuh_institutional_rules', 'gcuh_admissions_fees_examinations_rules', 'edu_admissions_fees', 'edu_academic_rules', 'edu_anti_harassment', 'edu_discipline_grievance', 'edu_hostel', 'edu_examination', 'edu_scholarships', 'hec_degree_recognition', 'edu_transport_safety', 'edu_student_welfare', 'student_rights', 'education_student_rights', 'sindh_hec_establishment_criteria', 'hec_recognized_campuses_sindh', 'punjab_hed_instruments', 'punjab_hed_notifications', 'kp_qac_notifications', 'baloch_chte_student_information', 'federal_mofept_policies', 'gb_doecgb_nominations', 'hec_disability_policy', 'hec_need_based_scholarship', 'pbm_education_assistance', 'navttc_act_and_candidate_routes', ...HEC_DOCS]
    };


// F12: merge persistent local semantic vectors into the in-memory index.
// Chunks missing a local vector keep their original zero vector, and retrieval
// degrades gracefully for those.
function attachLocalVectors(idx) {
  if (!fs.existsSync(LOCAL_VECTORS_PATH)) {
    console.warn('[RAG Engine] No local vector index found. Run `node server/buildLocalVectors.js` to enable offline semantic retrieval.');
    return;
  }
  try {
    const bundle = JSON.parse(fs.readFileSync(LOCAL_VECTORS_PATH, 'utf8'));
    const vecMap = bundle.vectors || {};
    let attached = 0;
    for (const chunk of idx.chunks || []) {
      const v = vecMap[chunk.id];
      if (v && v.length > 0 && v.some((x) => x !== 0)) {
        chunk.vector = v;
        attached++;
      }
    }
    console.log(`[RAG Engine] Local semantic vectors attached: ${attached}/${(idx.chunks || []).length} chunks (${bundle.model}, dim ${bundle.dimension}).`);
  } catch (err) {
    console.warn('[RAG Engine] Failed to load local vector index:', err.message);
  }
}

// Load the index into memory on startup
function loadIndex() {
  if (indexData) return indexData;
  try {
    if (fs.existsSync(INDEX_PATH)) {
      indexData = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
      console.log(`[RAG Engine] Loaded index containing ${indexData.chunks.length} chunks.`);
      attachLocalVectors(indexData);
    } else {
      console.warn(`[RAG Engine] WARNING: Index file not found at ${INDEX_PATH}. Run 'npm run rag:build' first.`);
    }
  } catch (err) {
    console.error(`[RAG Engine] Error loading index:`, err.message);
  }
  return indexData;
}

// Tokenize query
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// Words that appear in section headings without naming the subject (every penal
// section is a "punishment for ...", every statute names Pakistan). They are
// excluded from the heading-specificity signal so it measures the subject.
const HEADING_GENERIC = new Set([
  'punishment', 'punishments', 'penalty', 'penalties', 'law', 'laws', 'legal',
  'pakistan', 'pakistani', 'section', 'sections', 'article', 'articles',
  'procedure', 'court', 'courts', 'offence', 'offences', 'offense', 'offenses',
  'islam', 'islamic', 'qanoon', 'saza', 'act', 'code', 'right', 'rights', 'rule', 'rules'
]);

// Cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- Cross-border / overseas-intent vocabulary for USER-FACING routing -----
// Used by parseOverseasIntent() (and mirrored by the routing regexes
// inside processQuery below) so the chat/agent/advice endpoints can tell whether
// a broad natural-language question is an overseas/move question, whether a
// target country was actually named, and what the likely purpose is. This powers
// the Phase 1/2 rule: when no verified record matches, ASK the country/purpose
// instead of answering "outside scope". These tokens mirror the full routing
// vocabulary inside processQuery (kept smaller here — only what the clarification
// copy needs: whether a country is named).
const CB_TOP_COUNTRY_TOKENS = /\b(uk|u\.k|united kingdom|britain|england|usa|u\.s|u\.s\.a|united states|america|canada|australia|new zealand|ireland|uae|u\.a\.e|united arab emirates|dubai|abu dhabi|saudi(?: arabia)?|riyadh|jeddah|qatar|doha|oman|bahrain|kuwait|germany|france|italy|spain|netherlands|belgium|switzerland|austria|sweden|norway|denmark|finland|poland|turkey|turkiye|china|japan|south korea|korea|malaysia|singapore|thailand|indonesia|philippines|vietnam|brazil|south africa|egypt)\b/i;
const CB_MOVE_VERBS = /\b(mov\w*|relocat\w*|shift\w*|settl\w*|migrat\w*|emigrat\w*|go(?:ing)?\s+abroad|leav\w*\s+(?:pakistan|the\s+country))\b/i;
const CB_MOVE_CONTEXT = /\b(abroad|overseas|foreign(?:ers?)?|another\s+countr\w*|other\s+countr\w*|outside\s+pakistan)\b/i;

/**
 * Urdu-script cues must OPEN a word. A bare substring cue matches inside
 * unrelated words — measured: "ویزا" (visa) matched inside "دستاویزات"
 * (documents), so "what documents are needed for a passport?" was routed to the
 * cross-border consular corpus instead of the indexed DGIP workflows. Tokenising
 * on spaces and Urdu punctuation keeps the inflected forms a citizen actually
 * types ("ویزے", "ویزاوں") while rejecting the accidental containment.
 */
function urduCueRe(cues) {
  const pattern = Array.isArray(cues) ? cues.join('|') : String(cues);
  return new RegExp(`(?:^|[\\s\\u060C،,.:;!؟?])(?:${pattern})`, 'u');
}
export { urduCueRe };

/**
 * User-facing overseas-intent analyzer (Phase 2). Returns whether the question
 * is an overseas / move-abroad question, whether a target country is named and
 * the likely purpose (work / study / settle / visit / family), so the endpoints
 * can answer from retrieved context when it exists or ask the MINIMUM clarifying
 * question (country + purpose) instead of a cold refusal.
 */
export function parseOverseasIntent(query) {
  const q = String(query || '').trim();
  const clean = q.toLowerCase();
  const country = (clean.match(CB_TOP_COUNTRY_TOKENS) || [])[1] || null;
  const urAbroadCue = /[\u0600-\u06FF]/.test(q) && /(بیرون ملک|باہر|دوسرے ملک|ملک سے باہر)/.test(q);
  const move = CB_MOVE_VERBS.test(clean) && (CB_MOVE_CONTEXT.test(clean) || CB_TOP_COUNTRY_TOKENS.test(clean) || urAbroadCue);
  // "Attestation" names two different services. HEC's Degree Attestation
  // Service is a Pakistan-wide federal service on a Pakistani document, while
  // an apostille or consular attestation is an overseas matter. When the query
  // names the Commission it is asking about the domestic service, so the word
  // alone must not flag the question as overseas.
  const hecServiceContext = /\b(hec|higher education commission)\b/i.test(clean) || /ہیک/.test(q);
  const overseasServiceCue = /\b(visa|passport|embassy|consulate|high commission|immigration|apostille|remittance|emigrat\w*|deport\w*|expatriate|diaspora|nicop|poc)\b/i.test(clean)
    || (!hecServiceContext && /\battest\w*\b/i.test(clean));
  const isOverseas = !!country || CB_MOVE_CONTEXT.test(clean) || urAbroadCue || move
    || overseasServiceCue;
  let purpose = null;
  if (/\b(work|job|employ\w*|naukri|salary|wage)\b/i.test(clean)) purpose = 'work';
  else if (/\b(stud\w*|university|college|school|degree|admission|scholarship)\b/i.test(clean)) purpose = 'study';
  else if (/\b(settl\w*|permanent|migrat\w*|emigrat\w*|residen\w*)\b/i.test(clean)) purpose = 'settle';
  else if (/\b(visit|travel|tourist)\b/i.test(clean)) purpose = 'visit';
  else if (/\b(family|spouse|husband|wife|children|marri\w*)\b/i.test(clean)) purpose = 'family';
  return { isOverseas: !!isOverseas, move: !!move, country, purpose };
}

export class RAGEngine {

  // Roman Urdu → English query translation dictionary for retrieval normalization
  static ROMAN_URDU_MAP = {
    'chori': 'theft', 'qatl': 'qatl murder', 'maar': 'hurt assault', 'zina': 'zina adultery',
    'zamanat': 'bail', 'giraftari': 'arrest', 'dhamki': 'threat intimidation',
    'dafa': 'section', 'talaq': 'divorce', 'khula': 'khula dissolution',
    'nikah': 'marriage', 'mehr': 'dower', 'shadi': 'marriage',
    'bachon': 'children custody', 'hizanat': 'custody', 'nafqa': 'maintenance',
    'kharcha': 'maintenance', 'jaidad': 'property', 'zameen': 'land',
    'kiraya': 'rent tenancy', 'kirayedar': 'tenant', 'makan': 'house property', 'chque': 'cheque dishonour', 'cheque': 'cheque dishonour',
    // Spelling variants and everyday legal words a Roman Urdu reader actually
    // types. Every target word already occurs in the indexed records.
    'kiraye': 'rent tenancy', 'malik': 'landlord owner', 'wapas': 'return refund', 'raqam': 'amount sum',
    'khawand': 'husband', 'shohar': 'husband', 'biwi': 'wife',
    'tankhwa': 'wages salary', 'naukri': 'employment', 'mulazim': 'employee worker',
    'saza': 'punishment penalty', 'jurm': 'crime offence', 'jirm': 'crime offence',
    'police': 'police', 'thana': 'police station', 'muqadma': 'case suit',
    'adalat': 'court', 'wukeel': 'lawyer advocate', 'madad': 'help aid',
    'haq': 'right', 'huqooq': 'rights', 'aain': 'constitution',
    'qanoon': 'law', 'dawa': 'suit claim', 'petition': 'petition writ',
    'appeal': 'appeal', 'darkhast': 'application petition',
    'blackmail': 'blackmail extortion', 'dhoka': 'cheating fraud',
    'loot': 'robbery', 'daketi': 'dacoity robbery', 'maarna': 'hurt assault',
    'dhamkana': 'threaten intimidation', 'FIR': 'FIR first information report',
    'ghar': 'house home residence', 'jaali': 'forgery forged', 'badnami': 'defamation',
    'paise': 'money fees affordability', 'paisa': 'money fee', 'budget': 'budget affordability',
    'nikal': 'evict expel eject remove', 'nikala': 'evict expel eject',
    'behn': 'sister family woman', 'bhai': 'brother family',
    'mili': 'received paid got', 'karun': 'do act file', 'krun': 'do act file',
    'batao': 'tell explain guide', 'jeetne': 'win succeed', 'jeet': 'win success',
    'rishwat': 'bribe corruption', 'bribe': 'bribe corruption',
    'jhoota': 'false fabricated', 'vakeel': 'lawyer advocate', 'advocate': 'lawyer advocate',
    'tauheen': 'insult contempt', 'cyber': 'cyber online internet',
    'online': 'online cyber internet', 'mobile': 'mobile electronic',
    'consumer': 'consumer complaint', 'khareedari': 'purchase consumer',
    'nuqsandeh': 'defective goods', 'wapsi': 'refund return',
    'faisla': 'judgment decision decree',
    'challan': 'challan charge sheet', 'remand': 'remand detention',
    'warrant': 'warrant arrest', 'summon': 'summons notice',
    'injunction': 'injunction stay', 'decree': 'decree order',
    'inheritance': 'inheritance succession', 'wirasat': 'inheritance succession',
    'beti': 'daughter', 'betiyan': 'daughters', 'beta': 'son', 'bete': 'sons',
    'hissa': 'share', 'hissay': 'share', 'hissas': 'share',
    'taleem': 'education', 'azadi': 'freedom liberty', 'musawat': 'equality',
    'izzat': 'dignity honour', 'taqreer': 'speech expression',
    'mzhab': 'religion religious', 'mazhab': 'religion religious',
    'ombudsman': 'ombudsman mohtasib', 'mohtasib': 'ombudsman',
    'khawateen': 'women female', 'aurat': 'woman women',
    'bachcha': 'child minor', 'transgender': 'transgender khawaja sira',
    // Observed gaps: Roman Urdu queries using these everyday words were answered
    // as "no verified record" although the same question in English grounded
    // strongly. Each target word occurs in the indexed corpus.
    'benyadi': 'fundamental', 'khilaf': 'violation', 'warzi': 'violation', 'zilaal': 'violation',
    'dukaandar': 'seller shop shopkeeper', 'dukan': 'shop market', 'dukaandari': 'trade shop',
    'kharabi': 'defect defective', 'cheez': 'goods item', 'cheezein': 'goods items',
    'bech': 'sell sold', 'becha': 'sold', 'bekha': 'sold', 'bekh': 'sold',
    'bache': 'child children minor', 'bachay': 'children', 'papers': 'certificate exam result',
    // Property-transfer vocabulary (audit FIX 5): the Roman question named the real
    // record fields the English question stated directly — ownership, documents,
    // transfer — and left the engine with nothing to match. Plain translations only;
    // every target word already occurs in the indexed property records.
    'malkiat': 'ownership property', 'kaghazat': 'documents records', 'kaghaz': 'document record',
    'tabdeel': 'transfer change', 'tabdili': 'change transfer', 'intiqal': 'transfer mutation',
    'zariye': 'through', 'zariay': 'through', 'zaroori': 'necessary required'
  };

  // Urdu script → English query translation dictionary
  static URDU_MAP = {
    'چوری': 'theft', 'قتل': 'murder', 'ضمانت': 'bail', 'گرفتاری': 'arrest',
    'دھمکی': 'threat intimidation', 'طلاق': 'divorce', 'خلع': 'khula dissolution',
    'نکاح': 'marriage', 'مہر': 'dower', 'شادی': 'marriage',
    'حضانت': 'custody', 'نفقہ': 'maintenance', 'خرچہ': 'maintenance',
    'جائیداد': 'property', 'زمین': 'land', 'کرایہ': 'rent tenancy',
    'تنخواہ': 'wages salary', 'ملازم': 'employee worker', 'نوکری': 'employment',
    'سزا': 'punishment penalty', 'جرم': 'crime offence',
    'پولیس': 'police', 'تھانہ': 'police station', 'مقدمہ': 'case suit',
    'عدالت': 'court', 'وکیل': 'lawyer advocate', 'مدد': 'help aid',
    'حق': 'right', 'حقوق': 'rights', 'آئین': 'constitution', 'آرٹیکل': 'article',
    'قانون': 'law', 'دعویٰ': 'suit claim', 'اپیل': 'appeal',
    'بلیک میل': 'blackmail extortion', 'دھوکا': 'cheating fraud',
    'لوٹ': 'robbery', 'ڈکیتی': 'dacoity robbery', 'مارنا': 'hurt assault',
    'جعلی': 'forgery forged', 'بدنامی': 'defamation',
    'آن لائن': 'online cyber', 'سائبر': 'cyber online',
    'ہراسگی': 'harassment', 'انٹرنیٹ': 'internet online',
    'فیصلہ': 'judgment decision', 'وراثت': 'inheritance succession',
    'تعلیم': 'education', 'آزادی': 'freedom liberty', 'مساوات': 'equality',
    'عزت': 'dignity honour', 'تقریر': 'speech expression',
    'مذہب': 'religion religious', 'خواتین': 'women female',
    'عورت': 'woman women', 'بچہ': 'child minor',
    // Higher-education vocabulary. The HEC corpus is English-language, so an
    // Urdu-script question about a Commission service has to reach the words the
    // records and the evidence gate match on — without these, "ہیک ڈگری
    // اتیسٹیشن کا طریقہ" produces no English term at all.
    'ہیک': 'HEC higher education commission',
    'ڈگریاں': 'degrees', 'ڈگری': 'degree',
    'ٹرانسکرپٹ': 'transcript',
    'اتیسٹیشن': 'attestation attested', 'اٹیسٹیشن': 'attestation attested',
    'تصدیقی': 'attested verified', 'تصدیق': 'verification attestation',
    'ایکوئلینس': 'equivalence', 'مساوی': 'equivalence',
    'یونیورسٹیاں': 'universities', 'یونیورسٹی': 'university', 'جامعہ': 'university',
    'کالج': 'college',
    'طالب علم': 'student', 'طلباء': 'students', 'طالبان': 'students',
    'فیس': 'fee', 'اسکالرشپ': 'scholarship', 'وظیفہ': 'stipend scholarship',
    'ہاسٹل': 'hostel', 'میٹرک': 'matric', 'انٹر': 'intermediate',
    'پلاجرزم': 'plagiarism', 'پلیجرزم': 'plagiarism',
    'شکایت': 'complaint grievance',
    // Banking, documents and family-violence nouns measured missing on 2026-11-09:
    // an Urdu-script "بینک … اکاؤنٹ سے فیس کاٹ لی" produced no English term beyond
    // 'fee', so the cards came back from the education fee family. Deliberately
    // unambiguous, multi-syllable words only — بل and ثبوت were tried and a
    // substring-prone or over-broad gloss lets another subject's row through.
    'بینک': 'bank banking', 'اکاؤنٹ': 'account', 'وارنٹ': 'warrant',
    'پیدائش': 'birth', 'سرٹیفکیٹ': 'certificate',
    'شوہر': 'husband', 'بیوی': 'wife', 'تشدد': 'violence assault',
    'گھریلو': 'domestic', 'ویزا': 'visa',
    'تعلیمی': 'educational academic',
    'ایف آئی آر': 'FIR first information report',
    // Grammatical and institutional glue words. An Urdu-script question carries
    // these where the same question in Roman Urdu or English carries after /
    // under / court — when they have no gloss the question's own-word coverage
    // drops below the gate's bar even though the records exist. Deliberately
    // narrow: glosses for ثبوت / شرط were tried and let an unrelated murder
    // punishment row pass the theft question that the English form rejects.
    'بعد': 'after', 'تحت': 'under', 'واجب': 'obligatory binding',
    'ہائی': 'high', 'کورٹ': 'court', 'لاہور': 'lahore',
    'تفریق': 'dissolution', 'بیوی': 'wife', 'شوہر': 'husband',
    // Everyday legal and religious vocabulary measured missing from the same
    // questions in Roman Urdu, which returned records and Urdu script which
    // returned none: زنا, اسلام, پاکستان, سندھ never produced an English word,
    // so the evidence gate could not see the offence, the country or the
    // province the user named.
    'زنا': 'zina adultery', 'اسلام': 'islam', 'اسلامی': 'islamic',
    'پاکستان': 'pakistan', 'سندھ': 'sindh', 'پنجاب': 'punjab',
    'بلوچستان': 'balochistan', 'خیبر': 'khyber', 'اسلام آباد': 'islamabad',
    'کراچی': 'karachi', 'لاہور': 'lahore',
    'مقدمہ': 'case', 'مقدمے': 'case', 'کیس': 'case', 'واقعہ': 'incident',
    'درخواست': 'application apply', 'اپلائی': 'apply',
    'اسکالرشپ': 'scholarship', 'وظیفہ': 'scholarship stipend',
    'جواب': 'answer', 'تفصیل': 'detail', 'تفصیلی': 'detail detailed',
    'حوالہ': 'reference', 'حوالوں': 'references', 'حوالے': 'references',
    'مختصر': 'short brief', 'لمبی': 'long', 'صرف': 'only',
    // Grammatical glue. Mapping these to the English stop words they mean lets
    // the informative-token filter drop them, instead of counting them as
    // unmatched content that depresses coverage on a correctly grounded record.
    'میں': 'in', 'کے': 'of', 'کی': 'of', 'کا': 'of', 'کو': 'to',
    'ہے': 'is', 'ہیں': 'are', 'تھا': 'was', 'تھی': 'was', 'نے': 'did',
    'کیا': 'what', 'کیسے': 'how', 'کیوں': 'why', 'کہاں': 'where',
    'کون': 'who', 'کب': 'when', 'اور': 'and', 'لیے': 'for', 'بارے': 'about',
    'ساتھ': 'with', 'پر': 'on', 'سے': 'from', 'تک': 'to', 'بھی': 'also',
    'نہیں': 'not', 'کروں': 'do', 'کرنے': 'do', 'کرتا': 'do', 'کرتی': 'do',
    'گا': 'will', 'گی': 'will', 'ہوں': 'am', 'ہو': 'be', 'ہوا': 'happened',
    'میرا': 'my', 'میری': 'my', 'مجھے': 'me', 'آپ': 'you', 'آپکا': 'your'
  };

  /**
   * Normalize a query by translating Roman Urdu / Urdu script terms to English equivalents
   * for better retrieval against the English-language corpus.
   */
  static normalizeQuery(query, detectedLang) {
    let normalized = query.toLowerCase().trim();

    if (detectedLang === 'roman_urdu') {
      // Replace Roman Urdu words with English equivalents
      for (const [ru, en] of Object.entries(RAGEngine.ROMAN_URDU_MAP)) {
        const regex = new RegExp('\\b' + ru.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
        normalized = normalized.replace(regex, en);
      }
    } else if (detectedLang === 'ur') {
      // Replace Urdu script words with English equivalents. Longest key first:
      // substring replacement of 'حق' ("right") inside 'حقوق' ("rights") left
      // "rightوق", a token that matches no record. Urdu script has no \b, so
      // ordering is what protects the longer word.
      const entries = Object.entries(RAGEngine.URDU_MAP).sort((a, b) => b[0].length - a[0].length);
      const B = '[\\s،۔؛:,.!?()\\[\\]"\'“”‘’]';
      for (const [ur, en] of entries) {
        const escaped = ur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Word-boundary equivalent: short glue keys ('کا', 'کی') occur inside
        // ordinary words, so a bare substring replace corrupts them.
        const regex = new RegExp(`(^|${B})${escaped}(?=$|${B})`, 'g');
        normalized = normalized.replace(regex, `$1${en}`);
      }
      // ہیک is how Urdu script spells BOTH "HEC" (the Commission) and "hack". The
      // dictionary resolves it to the Commission, which is right for a degree
      // attestation ask and wrong for a break-in report: an account/WhatsApp
      // complaint reached the HEC fee-refund corpus on that expansion alone, and
      // the PECA records that state the offence were never candidates. A device,
      // account, platform or named intruder beside ہیک settles which word the
      // citizen wrote; an education artefact word keeps the Commission reading.
      if (/ہیک/.test(query)
        && /(اکاؤنٹ|اكاؤنٹ|اڪاؤنٹ|پاسورڈ|پاس\s?ورڈ|موبائل|فون|انٹرنیٹ|سائبر|آن\s*لائن|واٹس|وٹس|ای\s*میل|کسی\s*(?:نے|اور)|سسٹم|ڈیٹا)/.test(query)
        && !/(ڈگری|اتیسٹیشن|اٹیسٹیشن|ٹرانسکرپٹ|یونیورسٹی|جامعہ|کالج|امتحان|نتیجہ|اسکالرشپ|ہاسٹل|مساوی|سرٹیفکیٹ)/.test(query)) {
        normalized = normalized.replace(/hec higher education commission/gi,
          'hack hacked hacking unauthorized access information system data');
      }
    }

    // English legal vocabulary the statutory records state in their own Roman /
    // Urdu form. PPC 302 says "qatl-i-amd", so an English "murder" question
    // covered none of the record's words and the gate rejected the exact
    // provision. Expansion only adds the corpus's own counterpart; it never
    // replaces what the user wrote.
    const LEGAL_SYNONYMS = { murder: 'qatl', killed: 'qatl murder', killing: 'qatl murder', zina: 'adultery' };
    for (const [en, extra] of Object.entries(LEGAL_SYNONYMS)) {
      if (new RegExp('\\b' + en + '\\b', 'i').test(normalized) && !normalized.includes(extra)) {
        normalized = `${normalized} ${extra}`;
      }
    }
    return normalized;
  }

  /**
   * Pre-process user query to perform language detection, domain routing, and query rewriting.
   */
  static processQuery(query) {
    const clean = (query || '').toLowerCase().trim();
    
    // 1. Language Detection — one shared detector decides prose and retrieval
    // language together; a question cannot be answered in one language and
    // retrieved in another.
    const detectedLang = detectWrittenLanguage(query);

    // 2. Normalize query for retrieval (translate Urdu/Roman Urdu terms to English)
    const normalizedQuery = RAGEngine.normalizeQuery(query, detectedLang);

    // 3. Legal Domain Routing & Query Rewriting
    let domain = 'unknown';
    let rewrittenQuery = normalizedQuery;
    // When set, only chunks whose own text names one of these programmes may
    // be used as evidence. Populated by the social-protection branch below.
    let topicFilterTerms = null;

    // Higher-education subject matter (the Commission named, or a degree /
    // credential / programme word present, in Latin or Urdu script). The cyber,
    // consumer and labour branches below match on incidental words — "online",
    // "refund", "leave" — and run before the education branch, so without this
    // flag an HEC question is routed by the trigger word instead of its topic.
    const isHigherEdQuery = /\b(hec|higher education commission|degree|degrees|diploma|pgd|undergraduate|postgraduate|graduate|mphil|m\.?phil|phd|credit hour\w*|semester|transcript|convocation|provisional certificate|associate degree|matric|intermediate|fsc|hssc|a.?level|o.?level)\b/i.test(normalizedQuery)
      || /(ڈگری|سند|تعلیم|تعلیمی|یونیورسٹی|یونیورسٹیاں|کالج|جامعہ|طالب علم|طالبات|امتحان|فیس|اسکالرشپ|ہاسٹل|میٹرک|انٹر)/.test(query);

    // "salary account" names a banking product, not a wage claim. The labour
    // branch matches single words, so on its own that phrase pulled bank-charge
    // complaints into minimum-wages records. The wage words are neutralised only
    // when the query also names a bank product and nothing describing an
    // employment relationship, so "company ne naukri se nikal diya, tankhwah
    // baki hai" still routes to labour.
    const labourQueryText = (
      /\b(salary|wage|deposit|saving|savings|current|joint)\s+(?:bank\s+)?account\b|\bbank\s+account\b|\bbanking\s+account\b|\bcheque\b|\bdishonou?r\b/i.test(normalizedQuery)
      && !/\b(employer|employee|employ\w*|worker|naukri|mulazim|staff|overtime|boss|colleague|workplace|job|terminat\w*|dismiss\w*|retrench|eobi|factory)\b/i.test(normalizedQuery)
    )
      ? normalizedQuery.replace(/\b(salary|wages?|tankhwa\w*)\b/gi, 'banking')
      : normalizedQuery;

    // ---- Cross-border / Overseas Pakistanis layer (INSAaf foreign knowledge) ----
    // Engages ONLY when a FOREIGN country is named or an unambiguous "abroad"
    // cue is present, so purely domestic Pakistani-law routing below stays
    // untouched. Central principle: never default to Pakistani law just because
    // the user is Pakistani — the applicable jurisdiction is decided by context.
    const FOREIGN_COUNTRY = /\b(usa|u\.s\.|united states|america|uk|u\.k\.|united kingdom|britain|england|scotland|wales|canada|australia|new zealand|ireland|uae|u\.a\.e|dubai|abu dhabi|sharjah|emirates|saudi|saudi arabia|riyadh|jeddah|qatar|doha|oman|muscat|bahrain|manama|kuwait|yemen|germany|france|paris|italy|rome|spain|madrid|netherlands|holland|amsterdam|belgium|switzerland|austria|sweden|norway|denmark|finland|poland|portugal|greece|turkey|turkiye|istanbul|russia|moscow|china|beijing|japan|tokyo|south korea|korea|seoul|malaysia|singapore|thailand|indonesia|philippines|vietnam|brazil|argentina|south africa|nigeria|kenya|egypt|cairo)\b/i;
    const FOREIGN_COUNTRY_UR = /(امریکہ|برطانیہ|کینیڈا|آسٹریلیا|جرمنی|سعودی|دبئی|امارات|ترکی|چین|جاپان|کوریا|فرانس|اطالیہ|قطر|عمان|بحرین|کویت|متحدہ عرب)/;
    const STRONG_ABROAD = /\b(abroad|overseas|visa|embassy|consulate|consular|high commission|apostille|attestation|attest|legalisation|legalization|deportation|deported|overstay|overstaying|work permit|residence permit|resident permit|study abroad|foreign university|foreign degree|dual nationality|dual citizenship|lost passport|passport lost|emergency certificate|foreign policy|treaty|treaties|extradition|mutual legal assistance|foreign marriage|foreign divorce|foreign court|foreign judgment|foreign summons|foreign employer|emigrat|protector of emigrants|manpower|remittance|expatriate|diaspora|foreign income|foreign salary|poc card|nicop|foreign(?:ers?)?)\b/i;
    const STRONG_ABROAD_UR = /(بیرون ملک|ويزا|ویزا|سفارت|قونصل|اپوسٹل|بروزگار بيرونی)/;
    // Foreign country ADJECTIVE/abbreviation immediately followed by an
    // institution/authority noun. Catches the core "US/UK court summons",
    // "Saudi employer", "American visa", etc. even when the bare country token
    // (e.g. "US") is not in FOREIGN_COUNTRY to avoid the pronoun-"us" clash.
    const FOREIGN_LEGAL_PHRASE = /\b(us|u\.s|u\.s\.a|usa|america|american|uk|u\.k|britain|british|england|canada|canadian|australia|australian|new zealand|europe|european|ireland|irish|uae|emirates|dubai|abu dhabi|saudi|qatar|qatari|oman|kuwait|bahrain|yemen|germany|german|france|french|italy|italian|spain|spanish|netherlands|dutch|switzerland|swiss|austria|sweden|norway|denmark|turkey|turkish|turkiye|russia|russian|china|chinese|japan|japanese|korea|korean|singapore|malaysia|thailand|indonesia|philippines|vietnam|brazil|egypt|lebanon|iran|iraq)\s+(court|courts|judge|judgment|judgement|summons|notice|order|decree|arrest|warrant|visa|visas|immigration|passport|police|prison|jail|government|authorit\w*|agency|department|commission|tax|employer|employment|company|university|college|school|scholarship|law|lawyer|police)\b/i;
    // Urdu cues are word-initial only (urduCueRe). Substring matching put the
    // visa cue inside the word for "documents", which routed a purely domestic
    // Urdu passport question to the consular corpus.
    const FOREIGN_COUNTRY_UR_W = urduCueRe(FOREIGN_COUNTRY_UR.source);
    const STRONG_ABROAD_UR_W = urduCueRe(STRONG_ABROAD_UR.source);
    const cbCountryMentioned = FOREIGN_COUNTRY.test(normalizedQuery) || FOREIGN_COUNTRY.test(query) || FOREIGN_COUNTRY_UR_W.test(query);
    const cbForeignPhrase = FOREIGN_LEGAL_PHRASE.test(normalizedQuery) || FOREIGN_LEGAL_PHRASE.test(query);
    const cbStrongAbroad = STRONG_ABROAD.test(normalizedQuery) || STRONG_ABROAD_UR_W.test(query) || cbForeignPhrase;
    const cbLegalCtx = /\b(stud\w*|university|college|degree|admission|scholarship|job|work|employ\w*|wage|salary|arrest\w*|detain\w*|jail|prison|police|court|notic\w*|summon\w*|judgment|marri\w*|nikah|divorc\w*|talaq|khula|custody|child|propert\w*|land|inherit\w*|succession|bank|money|tax|agreement|travel|passport|process|procedure|requirement|apply|document|mov\w*|relocat\w*|shift\w*|settl\w*|migrat\w*|emigrat\w*|karna|jana|jane)\b/i.test(normalizedQuery);
    // Natural-language move intent: "moving abroad", "planning to move to
    // another country", "moving from Pakistan to the UK for work". A move verb
    // only counts when it co-occurs with an abroad/foreign cue or a named
    // foreign country, so a domestic "moving to Lahore" never routes here.
    const cbMoveAbroad = CB_MOVE_VERBS.test(normalizedQuery) && (CB_MOVE_CONTEXT.test(normalizedQuery) || CB_MOVE_CONTEXT.test(query) || cbCountryMentioned);
    // Foreign-CRIME intent: a country is named AND the matter is criminal
    // ("committed a crime in Dubai", "criminal case in Saudi Arabia"). The
    // applicable jurisdiction is the foreign country's law — never default to
    // Pakistani criminal law just because the user is Pakistani.
    const cbForeignCrime = cbCountryMentioned && /\b(crim\w*|offen[cs]e\w*|committ\w*|murder|qatl\w*|khoon|chori|theft|dacoit\w*|daka|assault\w*|jhagra|zabardasti|fraud|bribe|rishwat|maar\w*|peet\w*)\b/i.test(normalizedQuery);
    // Urdu-script civic-document questions carry no Latin abroad token, and the
    // Latin-only \b-bracketed cues above are blind to Urdu script — measured:
    // "پاکستان میں پاسپورٹ بنوانے کے لیے کیا دستاویزات درکار ہیں؟" routed
    // cross-border and returned consular-assistance records instead of the
    // indexed DGIP passport workflows. Exempt only Urdu-script civic-document
    // questions that name no abroad cue, in either script.
    const urCivicDocDomestic = /[\u0600-\u06FF]/.test(query)
      && /(پاسپورٹ|شناختی\s*کارڈ|ب\s*فارم|ڈومیسائل|خاندانی\s*شناختی|قومی\s*شناختی)/.test(query)
      && !/(بیرون\s*ملک|خارج|ویزا|ويزا|سفارت|قونصل|ہجرت|پرवास|بروزگار\s*بیرونی|اعزازی\s*ملک|دوسرے\s*ملک)/.test(query)
      && !/\b(abroad|overseas|foreign|visa|embassy|consulate|consular|immigration|apostille|emigrat\w*|expatriate|diaspora|nicop|poc)\b/i.test(normalizedQuery);
    // The same blindness in Latin script: CNIC and NICOP are two NADRA identity
    // products, one for residents and one for overseas Pakistanis, and a question
    // about the difference between them is a question about NADRA's records.
    // Measured: "What is the difference between CNIC and NICOP?" routed
    // cross-border on the NICOP cue alone and retrieved 2 consular chunks, never
    // reaching the indexed civic comparison record.
    const latinCivicCardComparison = /\b(cnic|smart ?card|identity card|b-?form|crc|frc)\b/i.test(normalizedQuery)
      && /\bnicop\b|\bpoc\b/i.test(normalizedQuery)
      && !/(abroad|overseas|foreign|visa|embassy|consulate|consular|immigration|apostille|emigrat\w*|expatriate|diaspora)/i.test(normalizedQuery)
      && !cbCountryMentioned;
    const isCrossBorder = (cbStrongAbroad || (cbCountryMentioned && cbLegalCtx) || cbMoveAbroad || cbForeignCrime)
      && !(/\b(hec|higher education commission)\b/i.test(normalizedQuery) && /\b(degree|transcript|attestation|equivalence|recognition|verification)\b/i.test(normalizedQuery) && !cbCountryMentioned)
      && !urCivicDocDomestic
      && !latinCivicCardComparison;

    // Opt-in routing trace (INSAF_ROUTE_DEBUG=1). The cross-border decision is a
    // composite of six detectors, and an Urdu-script mis-route can only be fixed
    // once it is known WHICH one fired and on WHICH characters — Urdu has no
    // spaces between a prefix and the word, so a bare substring cue can match
    // inside an unrelated word. Off by default; nothing user-facing reads it.
    if (process.env.INSAF_ROUTE_DEBUG) {
      const urHit = (String(query).match(STRONG_ABROAD_UR_W) || [])[0] || '';
      console.log('[route] crossBorder', JSON.stringify({
        q: String(query).slice(0, 48),
        strongAbroad: cbStrongAbroad, country: cbCountryMentioned, legalCtx: cbLegalCtx,
        move: cbMoveAbroad, foreignCrime: cbForeignCrime, urDomesticCivic: urCivicDocDomestic,
        composite: isCrossBorder,
        urCue: urHit, urCueCodepoints: [...urHit].map(ch => ch.codePointAt(0).toString(16)).join(' ')
      }));
    }

    // Foreigner-IN-Pakistan refinement (Phase 8 / F9): a query about a
    // FOREIGN national inside Pakistan (visa extension in Pakistan, residence
    // permit, work/study/business stay, police registration, family/citizenship
    // questions) must route to the foreigner-in-Pakistan corpus — NOT the
    // cross-border corpus written for Pakistanis abroad. The home-country
    // consular layer is kept distinct inside those docs themselves.
    const isForeignerInPakistan =
      /\b(foreign(?:ers?| national)?s?|tourists?|expat(?:riate)?s?)\b/i.test(query) &&
      /\b(pakistan\b|stay(?:ing)?|resid\w*|extend\w*|extension|permit|regist\w*|work\b|study\b|business\b|visa\b|citizen\w*|marri\w*|police\b|entry\b|exit\b|family\b|child\b|emergency\b|consular\b|passport\b|home.?country)\b/i.test(query) &&
      !cbForeignCrime;

    if (/\b(foreign\w*|expat\w*)\b/i.test(query) && /\b(citizenship|naturali[sz]e|nationality|citizen of pakistan)\b/i.test(query) && !cbForeignCrime) {
      domain = 'immigration';
      rewrittenQuery = 'Citizenship Act 1951 foreigner marriage Pakistani citizen citizenship naturalization nationality Ministry of Interior registration oath Pakistan';
    }
    else if (
      /\b(foreign\w*|tourists?|expat\w*)\b/i.test(query) &&
      /\b(pakistan\b|stay(?:ing)?|resid\w*|extend\w*|extension|permit|regist\w*|work\b|study\b|business\b|visa\b|citizen\w*|marri\w*|police\b|entry\b|exit\b|family\b|child\b|emergency\b|consular\b|passport\b|home.?country)\b/i.test(query) &&
      !cbForeignCrime) {
      domain = 'foreigner';
      rewrittenQuery = 'foreigner Pakistan entry stay visa residence permit registration extension work study business family citizenship police immigration consular home country Ministry of Interior';
    }
    else if (isCrossBorder) {
      domain = 'cross-border';
      const cbTerms = [];
      if (/\b(job|work|employ|salary|wage|employer|employee|agent|recruit|emigrat|manpower|confiscat|unpaid|tankhwa|naukri|kaam)\b/i.test(normalizedQuery)) {
        cbTerms.push('overseas employment emigration clearance recruiting agent BE&OE worker rights unpaid wages abroad passport confiscation human trafficking repatriation foreign labour law');
      }
      if (/\b(stud|university|college|degree|admission|scholarship|master|phd|bachel|hec|transcript|course)\b/i.test(normalizedQuery)) {
        cbTerms.push('study abroad HEC degree attestation foreign university admission student visa scholarship official program foreign requirements verify official source');
      }
      if (/\b(visa|passport|embassy|consulate|consular|attestation|attest|apostille|legalis|lost passport|emergency certificate|travel|airport|overstay|deport|entry)\b/i.test(normalizedQuery)) {
        cbTerms.push('visa passport travel abroad embassy consular services attestation apostille lost passport abroad emergency travel document immigration compliance no guarantee');
      }
      if (/\b(arrest|detain|jail|prison|giraftari|police)\b/i.test(normalizedQuery)) {
        cbTerms.push('arrested detained abroad consular assistance foreign criminal law local lawyer Pakistani embassy mission safety Vienna Convention');
      }
      if (/\b(court|summons|notice|judgment|lawsuit|claim|debt|filing)\b/i.test(normalizedQuery)) {
        cbTerms.push('foreign court document summons notice jurisdiction foreign judgment service of process local lawyer not Pakistani law response deadline');
      }
      if (/\b(marri|nikah|divorc|talaq|khula|custody|bach|child|spouse|wife|husband)\b/i.test(normalizedQuery)) {
        cbTerms.push('foreign marriage divorce recognition cross-border child custody jurisdiction Pakistan recognition attestation NADRA registration');
      }
      if (/\b(propert|zameen|jaidad|inherit|wirasat|succession|land|bank|asset|house|plot)\b/i.test(normalizedQuery)) {
        cbTerms.push('cross-border property abroad inheritance succession foreign assets jurisdiction recognition probate power of attorney');
      }
      if (/\b(treaty|agreement|extradition|mutual legal|foreign policy|oic|sco|commonwealth|relations|un\b|organisation|organization)\b/i.test(normalizedQuery)) {
        cbTerms.push('Pakistan treaty bilateral agreement extradition mutual legal assistance foreign policy international organization Ministry of Foreign Affairs MOFA');
      }
      if (/\b(dual|citizen|citizenship|nationality|second passport|passport\b)\b/i.test(normalizedQuery) || /nicop|poc/i.test(normalizedQuery)) {
        cbTerms.push('dual nationality citizenship Pakistan Citizenship Act 1951 permitted countries list NICOP POC overseas identity');
      }
      if (/\b(remit|remittance|money|tax|income|earning|send)\b/i.test(normalizedQuery)) {
        cbTerms.push('international remittance tax abroad FBR SBP double taxation cross-border compliance official channel');
      }
      if (/\b(crim\w*|offen[cs]e\w*|committ\w*|murder|qatl\w*|khoon|chori|theft|dacoit\w*|daka|assault\w*|jhagra|zabardasti|fraud|bribe|rishwat|maar\w*|peet\w*)\b/i.test(normalizedQuery)) {
        cbTerms.push('crime committed abroad foreign country law applies not Pakistani law local lawyer consular assistance arrest detention jail embassy visit');
      }
      const cbCountryWord = (normalizedQuery.match(FOREIGN_COUNTRY) || [])[1] || '';
      const cbBase = cbTerms.length ? cbTerms.join(' ') : 'cross-border overseas Pakistanis Pakistani citizen abroad visa work study consular foreign jurisdiction';
      rewrittenQuery = cbCountryWord ? `${cbCountryWord} ${cbBase}` : cbBase;
    }
    // Social-protection routing (P0): BISP / 8171, Ehsaas, Kafalat and other
    // citizen support programmes are a distinct subject from student
    // scholarships. Without this branch such a query matches no domain, runs
    // corpus-wide, and the nearest lexical neighbours — HEC need-based and
    // merit scholarship records — surface as if they established BISP
    // eligibility. They do not: the only indexed record naming BISP describes
    // BISP's role in an education scholarship programme.
    else if (/\b(bisp|8171|ehsaas|e-?hsaas|benazir income support|kafalat|wbsf|women(?:'?s)? subsidy|social protection|income support programme|bait[ -]?ul[ -]?mal|ushr|zakat)\b/i.test(normalizedQuery)
      || /\b(bisp|8171|e hsas)\b/i.test(query)
      || /(بینظیر|ااحساس|کفالت|سوشل\s*پروٹیکشن|زکوٰۃ|عشر)/.test(query)) {
      domain = 'social-protection';
      const namedProgrammes = [];
      const wantsBisp = /\b(bisp|8171|benazir income support)\b/i.test(normalizedQuery) || /\b(bisp|8171)\b/i.test(query);
      const wantsEhsaas = /\b(ehsaas|e-?hsaas)\b/i.test(normalizedQuery);
      const wantsKafalat = /\b(kafalat|wbsf|women(?:'?s)? subsidy)\b/i.test(normalizedQuery);
      const wantsBaitUlMal = /bait[ -]?ul[ -]?mal/i.test(normalizedQuery);
      const wantsZakatUshr = /\b(ushr|zakat)\b/i.test(normalizedQuery);
      if (wantsBisp) namedProgrammes.push('BISP Benazir Income Support Programme 8171');
      if (wantsEhsaas) namedProgrammes.push('Ehsaas Programme');
      if (wantsKafalat) namedProgrammes.push('Kafalat WBSF women subsidy');
      if (wantsBaitUlMal) namedProgrammes.push('Bait-ul-Maal Bait-ul-Mal PBM education assistance stipend institute');
      if (wantsZakatUshr) namedProgrammes.push('Zakat Ushr');
      rewrittenQuery = `${namedProgrammes.join(' ') || 'social protection income support programme'} eligibility conditions registration documents complaint portal authority official programme Pakistan`;
      topicFilterTerms = [];
      if (wantsBisp) topicFilterTerms.push(/bisp|8171|benazir income support/);
      if (wantsEhsaas) topicFilterTerms.push(/ehsaas/);
      if (wantsKafalat) topicFilterTerms.push(/kafalat|wbsf|women subsidy|women's subsidy/);
      if (wantsBaitUlMal) topicFilterTerms.push(/bait[- ]?ul[- ]?ma?l|\bpbm\b/i);
      if (wantsZakatUshr) topicFilterTerms.push(/zakat|ushr/);
      if (topicFilterTerms.length === 0) topicFilterTerms = null;
    }
    // Civic-services routing (Phase 6 / F7): dedicated citizen workflows —
    // domicile, CNIC/B-Form/CRC, birth/death/marriage registration, voter
    // enrolment/electoral complaints, NADRA/ECP and government-department
    // complaints. Runs BEFORE labour/consumer/rights so keywords like "office"
    // (labour) or "complain" (consumer) cannot steal these queries.
    // Identity documents are only indexed here, so "passport" must open this
    // domain; measured before, a bare "documents for a passport" query matched
    // no trigger, stayed domainless, and retrieved HEC degree-attestation
    // records because they are the corpus's other "apply with documents" text.
    else if ((/\b(domicile|cnic|nicop|b.?form|crc|child registration|birth (?:certificate|registration)|death (?:certificate|registration)|marriage registr|nikah.?nama|nikah register|voter|vote|vote enrol|electoral|constituency|union council|nadra|election commission|government department complaint|complaint against (?:a )?government|complain.{0,15}government|government.{0,15}(?:not providing|complaint)|civic|citizen portal|b-form|register.{0,20}(?:birth|death|marriage)|passport|dgip|frc|family registration certificate|pak.?id|tracking id|(?:renew|reprint|modify)\w*.{0,12}cnic|(?:birth|death|marriage).{0,20}registr)\b/i.test(normalizedQuery)
      || /(پاسپورٹ|شناختی\s*کارڈ|ب\s*فارم|ڈومیسائل|خاندانی\s*شناختی\s*کارڈ|رجسٹریشن\s*سرٹیفکیٹ|ووٹر|الیکشن\s*کمیشن|پیدائش|وفات|نکاح)/.test(query))
      && !/\b(abroad|overseas|foreign|nicop abroad)\b/i.test(normalizedQuery)) {
      domain = 'civic';
      const civicTerms = [];
      if (/domicile/i.test(normalizedQuery)) civicTerms.push('domicile certificate Deputy Commissioner district office documents residence proof CNIC');
      if (/birth|b.?form|crc/i.test(normalizedQuery)) civicTerms.push('birth registration union council hospital NADRA CRC B-Form documents steps');
      if (/death/i.test(normalizedQuery)) civicTerms.push('death registration union council death certificate NADRA CNIC cancellation');
      if (/marriage|nikah/i.test(normalizedQuery)) civicTerms.push('marriage registration nikahnama nikah registrar union council fee stamps');
      if (/voter|vote|electoral/i.test(normalizedQuery)) civicTerms.push('voter enrolment electoral roll ECP complaint election tribunal transfer vote');
      if (/passport/i.test(normalizedQuery) || /پاسپورٹ/.test(query)) civicTerms.push('passport application renewal modification Regional Passport Office DGIP biometrics appointment documents required online tracking SMS 9988');
      if (/cnic|nadra|pak.?id|frc|b.?form|crc/i.test(normalizedQuery) || /شناختی\s*کارڈ|ب\s*فارم|پاک\s*آئی\.ڈی|ڈی\.جی\.آئی\.পি/.test(query)) civicTerms.push('NADRA CNIC smart card identity PakID Family Registration Certificate B-Form documents required process registration office');
      if (/complaint|department/i.test(normalizedQuery)) civicTerms.push('government department complaint citizen portal ombudsman escalation route');
      rewrittenQuery = civicTerms.length > 0 ? civicTerms.join(' ') : 'civic service workflow who where documents steps fees time appeal source';
    }
    // Cybercrime / PECA (Priority match before general crime, but AFTER the
    // cross-border layer so an abroad-context query is not mis-routed to the
    // domestic labour/criminal/cyber domains). Offline
    // workplace/teacher harassment must NOT route here (it is covered by the
    // workplace-harassment laws via the labour/rights domains).
    else if ((/\b(cyber|internet|harass\w*|stalk\w*|hack\w*|online|peca|cybercrime|bully|bullying|blackmail\w*|extort\w*|whatsapp|data|website|fia|1991|identity|electronic|digital|information.?system|unauthorized|social media|social network|facebook|instagram|tiktok|snapchat|twitter|deepfake|morphed|fake (?:profile|account|id)|(?:profile|account) (?:photo|picture|image|video))\b/i.test(normalizedQuery) || /(ہراسگی|انٹرنیٹ|سائبر|بلیک\s*میل|آن\s*لائن|بلیک\s*میلنگ|سوشل\s*میڈیا|جعلی\s*پروفائل|پروفائل)/.test(query))
        && !isHigherEdQuery
        && !(/\b(workplace|office|employer|boss|colleague|coworker|universit(?:y|ies)|uni|campus|student\w*|hostel\w*|teacher\w*|professor\w*|lecturer\w*|faculty|staff|manager|job|work)\b/i.test(normalizedQuery) && !/\b(online|internet|social|facebook|whatsapp|sms|email|website|mobile|phone|account|profile|message|youtube|twitter|instagram|tiktok|app)\b/i.test(normalizedQuery))) {
      domain = 'cyber';
      const cyberTerms = [];
      if (/harass|stalk|bully/i.test(normalizedQuery)) cyberTerms.push('cyberstalking harassment Section 19 24 PECA punishment');
      if (/hack|unauthorized|access/i.test(normalizedQuery)) cyberTerms.push('unauthorized access Section 3 4 5 PECA punishment');
      if (/blackmail|extort/i.test(normalizedQuery)) cyberTerms.push('blackmail extortion online threat Section 24 PECA');
      if (/identity|fake|impersonat|profile/i.test(normalizedQuery)) cyberTerms.push('identity information Section 13 PECA unauthorized use false information reputation privacy Section 24 PECA');
      if (/fraud|scam/i.test(normalizedQuery)) cyberTerms.push('electronic fraud Section 11 PECA');
      if (/modesty|intimate|nude|sexually|morphed|superimpos|private (?:photo|picture|image|video)/i.test(normalizedQuery)) cyberTerms.push('modesty Section 16 PECA intimate images');
      if (/complain|report|fia|profile|social|fake/i.test(normalizedQuery)) cyberTerms.push('FIA complaint procedure 1991 helpline cybercrime');
      if (/dignity|defam/i.test(normalizedQuery)) cyberTerms.push('dignity Section 24 PECA defamation online');
      rewrittenQuery = cyberTerms.length > 0 ? cyberTerms.join(' ') : 'PECA 2016 cybercrime harassment unauthorized access FIA complaint Section 3 19 24';
    }
    // Consumer Protection (fee/refund questions about university/school are
    // student-rights matters handled by the rights branch below; money "wapas"
    // questions about rent, a landlord or premises are tenancy matters handled
    // by the property branch, because normalization puts the word "refund" in
    // the query for either of them).
    else if ((/\b(consumer|defective|product|saman|dukaan|shopkeeper|warranty|refund|purchase|bought|khareedari|store)\b/i.test(normalizedQuery))
        && !isHigherEdQuery
        && !/\b(rent|rental|tenancy|tenant|landlord|premises|makan|ghar|kiraya|qaba)\b/i.test(normalizedQuery)
        && !/\b(bank|banking|cheque|sbp|state bank)\b/i.test(normalizedQuery)
        && !/\b(neighbour|neighbor|encroach\w*|common passage)\b/i.test(normalizedQuery)
        && !(/\b(university|school|college|students?|tuition|scholarship)\b/i.test(normalizedQuery) && !/\b(consumer|product|shop|purchase|goods|defective|seller)\b/i.test(normalizedQuery))) {
      domain = 'consumer';
      rewrittenQuery = 'Consumer Protection Act defective goods product refund warranty District Consumer Court legal notice 15 days';
    }
    // High Court case-law intercept — queries explicitly asking for HC judgments,
    // writ petitions, or case listings must route to 'case-law' domain (which
    // boosts HC fulltext/index docs) BEFORE criminal/rights branches catch
    // keywords like "bail", "murder", or "service" and steal the query.
    else if ((/\b(high court|high.?court|writ petition|writ petitions|judgment|judgments? of|case law|find.*case|list of.*case|recent.*case|service.*writ|darshan)\b/i.test(normalizedQuery)
        && /\b(high court|writ petition|judgment|case|find|list|recent)\b/i.test(normalizedQuery))
      // A named judgment asked about the apex court is a case-law question even
      // when the case TITLE carries a government or province name ("… v.
      // Government of Punjab"), which the provincial branch would otherwise steal.
        || (/\b(supreme court|federal shariat)\b/i.test(normalizedQuery)
          && /\b(decide|decided|decision|hold|held|ruled|ruling|verdict|judgment|precedent|case|appeal)\b/i.test(normalizedQuery))) {
      domain = 'case-law';
      const clTerms = [];
      if (/bail/i.test(normalizedQuery)) clTerms.push('bail murder High Court judgment PLD SCMR case law');
      if (/service|writ|petition/i.test(normalizedQuery)) clTerms.push('service writ petition High Court judgment index metadata');
      if (/find|list|recent/i.test(normalizedQuery)) clTerms.push('case law judgment High Court Supreme Court Pakistan PLD SCMR');
      if (/supreme court|federal shariat/i.test(normalizedQuery)) clTerms.push('Supreme Court of Pakistan reported judgment precedent PLD constitutional holding');
      rewrittenQuery = clTerms.length > 0 ? clTerms.join(' ') : normalizedQuery + ' case judgment High Court Pakistan PLD SCMR';
    }
    // Torts / civil wrongs — must run BEFORE the offence regex so "newspaper
    // publishes defamatory story — remedy" routes to torts_laws, not PPC s.499.
    else if (/\b(newspaper|defamatory story|tort|torts|negligence|nuisance|trespass to person|civil wrong|damages claim|defamation.*remedy|remedy.*defamation|libel|slander|encroach\w*|neighbou?r.{0,80}(?:block\w*|obstruct\w*|stop\w*|grab\w*|catch\w*))\b/i.test(normalizedQuery)
        && !/\b(punish|penalty|offence|offense|crime|saza|fir|police)\b/i.test(normalizedQuery)) {
      domain = 'torts';
      rewrittenQuery = 'torts defamation newspaper remedy damages civil wrong libel slander negligence nuisance Pakistan civil suit';
    }
    // NAB / Anti-corruption — must run BEFORE offence regex so "offences tried
    // by accountability courts" routes to nab_ordinance_1999, not generic PPC.
    else if (/\b(accountability|corruption|NAB|anti.?corruption|bribe|rishwat|anti.?bribery|ordinance 1999|accountability court)\b/i.test(normalizedQuery)) {
      domain = 'criminal';
      rewrittenQuery = 'NAB Ordinance 1999 accountability court corruption bribery anti-corruption offences investigation prosecution Pakistan';
    }
    // Juvenile justice — must run BEFORE offence regex so "offences by a person
    // under 18" routes to juvenile_justice_2000, not generic PPC.
    else if (/\b(under.?18|minor.*offen|juvenile|child offender|juvenile court|JJSO|Juvenile Justice System Ordinance)\b/i.test(normalizedQuery)) {
      domain = 'criminal';
      rewrittenQuery = 'Juvenile Justice System Ordinance 2000 JJSO child minor under 18 offence trial juvenile court borstal institution Pakistan';
    }
    // Amendment history (statute-specific) — must run BEFORE offence regex so
    // "when was punishment for cheque dishonour added to PPC" routes to
    // amendment_history, not generic PPC s.489-F.
    else if (/\b(when was.*added|when was.*introduced|amendment.*history|added to.*Penal Code|added to.*Act|amended.*section|section.*added)\b/i.test(normalizedQuery)) {
      domain = 'amendment';
      rewrittenQuery = 'amendment history law section added introduced Pakistan Penal Code PPC statute legislative change year enacted';
    }
    // Domestic violence — must run BEFORE the generic offence regex below. A
    // spouse's violence normalises to husband/wife + violence/assault, which that
    // regex reads as a general assault question, so the answer quoted PPC s.352
    // and s.355 punishments while the records that state what a survivor can
    // actually do (provincial Domestic Violence Acts, Protection Officer, shelter,
    // emergency helpline) were never candidates. A query about killing or a sexual
    // offence is a criminal question, and stays with the criminal corpus.
    else if (/\b(domestic\s+violence|violence\s+(?:against|towards)\s+(?:a\s+)?(?:woman|women|wife|husband|spouse)|wife|husband|spouse|in[- ]?laws?)\b/i.test(normalizedQuery)
        && /\b(domestic|violen\w*|assault|beat\w*|abus\w*|batter\w*|cruelt\w*|harass\w*|tortur\w*|zabardasti|zordeed)\b/i.test(normalizedQuery)
        && !/\b(murder|qatl|kill(?:ed|ing)?|caus\w+\s+death|302|324|rape|zina|honour)\b/i.test(normalizedQuery)) {
      domain = 'family';
      rewrittenQuery = 'domestic violence Protection of Women against Violence Act provincial Domestic Violence Prevention and Protection Act complaint Protection Officer shelter home emergency helpline remedy wife husband';
    }
    // Offence / Punishment queries (CRITICAL - must route to PPC)
    else if (/\b(punish|penalty|saza|offence|offense|crime|theft|steal|rob|robbery|dacoity|murder|kill|qatl|hurt|assault|cheat|fraud|forgery|forge|trespass|mischief|intimidat|threat|dhamki|kidnap|abduct|extort|blackmail|defam|chori|loot|daketi|maar|badnami|rape|zina|burglar\w*|house.?break\w*|break.?in|broke into|raat ko.*chori|ghar.*tod|breach.?trust|entrust\w*|refused.to.(?:return|pay|repay)|has.not.returned|did.not.return)\b/i.test(normalizedQuery)) {
      domain = 'criminal';
      // Build a more targeted rewrite based on the specific offence mentioned
      const offenceTerms = [];
      if (/theft|steal|chori/i.test(normalizedQuery)) offenceTerms.push('theft Section 378 379 380 punishment');
      if (/burglar|break.?in|broke into|house.?break/i.test(normalizedQuery)) offenceTerms.push('theft in a dwelling house Section 380 lurking house trespass by night Section 457 punishment');
      if (/robbery|rob|loot/i.test(normalizedQuery)) offenceTerms.push('robbery Section 390 392 punishment');
      if (/dacoity|daketi/i.test(normalizedQuery)) offenceTerms.push('dacoity Section 395 punishment');
      if (/murder|kill|qatl/i.test(normalizedQuery)) offenceTerms.push('murder qatl-i-amd Section 299 300 302 punishment death');
      if (/hurt|assault|maar/i.test(normalizedQuery)) offenceTerms.push('hurt assault Section 319 332 337 352 punishment');
      if (/cheat|fraud|dhoka/i.test(normalizedQuery)) offenceTerms.push('cheating fraud Section 415 417 420 punishment');
      if (/forgery|forge|jaali/i.test(normalizedQuery)) offenceTerms.push('forgery Section 463 465 468 punishment');
      if (/trespass|ghar/i.test(normalizedQuery)) offenceTerms.push('trespass Section 447 448 452 punishment');
      if (/intimidat|threat|dhamki/i.test(normalizedQuery)) offenceTerms.push('criminal intimidation Section 503 506 punishment threat');
      if (/kidnap|abduct/i.test(normalizedQuery)) offenceTerms.push('kidnapping abduction Section 362 363 364 punishment');
      if (/extort|blackmail/i.test(normalizedQuery)) offenceTerms.push('extortion blackmail Section 383 384 386 punishment');
      if (/defam|badnami/i.test(normalizedQuery)) offenceTerms.push('defamation Section 499 500 punishment');
      if (/mischief/i.test(normalizedQuery)) offenceTerms.push('mischief Section 426 427 punishment');
      if (/breach.?trust|entrust|refused.to.(?:return|pay|repay)|has.not.returned|did.not.return/i.test(normalizedQuery)) offenceTerms.push('criminal breach trust Section 405 406 409 punishment');
      if (/cheque|489/i.test(normalizedQuery)) offenceTerms.push('dishonest cheque Section 489F punishment');
      if (/wrongful|restrain|confine/i.test(normalizedQuery)) offenceTerms.push('wrongful restraint confinement Section 339 341 342 punishment');
      if (/modesty|woman|354/i.test(normalizedQuery)) offenceTerms.push('assault modesty woman Section 354 punishment');
      rewrittenQuery = offenceTerms.length > 0 ? offenceTerms.join(' ') : 'Pakistan Penal Code offence punishment section penalty PPC';
    }
    // Labour / Employment (also handles offline workplace harassment — the
    // Protection against Harassment of Women at Workplace Act 2010 route).
    // Academic-context harassment (university/school/teacher) is handled by
    // the rights branch below (HEC/student policies) instead.
    //
    // "salary account" is the name of a banking product, not a wage claim (see
    // labourQueryText above): the labour cue list matches single words, so a
    // bank-charge complaint used to route to minimum-wages records and the
    // banking records that answer it never competed.
    else if ((/\b(labour|labor|employ\w*|worker|wage|salary|terminat\w*|dismiss\w*|retrench|eobi|social.?security|workplace|factory|tankhwa|naukri|mulazim|harass\w*|boss|office|colleague|manager|job|work)\b|(?:\bshop\b.*\b(employer|employee|worker|wage|salary|job|naukri|mulazim|dismiss|terminat|overtime|leave|timing|staff)\b|\b(?:employer|employee|worker|wage|salary|job|naukri|mulazim|dismiss|terminat|overtime|leave|timing|staff)\b.*\bshop\b)/i.test(labourQueryText))
        && !isHigherEdQuery
        && !(/\b(universit(?:y|ies)|schools?|colleges?|students?|teachers?|principal)\b/i.test(normalizedQuery) && !/\b(employ\w*|workplace|office|job|staff|company)\b/i.test(normalizedQuery))) {
      domain = 'labour';
      const labourTerms = [];
      if (/\b(withh(?:o|e)ld\w*|unpaid|not\s+paid|non.?payment|arrear\w*|pending\s+(?:salary|wages)|salary\s+(?:nahi|not)|wage\s+(?:nahi|not)|tankhwa\s+(?:nahi|not)|maheena\s+(?:nahi|not))\b/i.test(normalizedQuery)) {
        labourTerms.push('unpaid wages withheld salary recovery Labour Court recovery of dues grievance notice Standing Orders employer');
      } else if (/wage|salary|tankhwa|minimum|pay/i.test(normalizedQuery)) {
        labourTerms.push('minimum wages salary payment Ordinance');
      }
      if (/terminat|dismiss|fire|retrench|without notice/i.test(normalizedQuery)) labourTerms.push('wrongful termination notice Labour Court reinstatement Standing Orders');
      if (/harass|workplace/i.test(normalizedQuery)) labourTerms.push('workplace harassment Protection Women Workplace Act 2010 Ombudsperson');
      if (/eobi|pension|retirement/i.test(normalizedQuery)) labourTerms.push('EOBI pension retirement old age benefits');
      if (/leave|working.?hour|overtime/i.test(normalizedQuery)) labourTerms.push('working hours leave Factories Act Shops Establishments annual sick maternity');
      if (/contract|agreement/i.test(normalizedQuery)) labourTerms.push('employment contract Standing Orders permanent probation');
      rewrittenQuery = labourTerms.length > 0 ? labourTerms.join(' ') : 'labour employment wages termination harassment workplace rights Labour Court EOBI';
    }
    // Legal Aid / affordability (must run BEFORE the rights branch so
    // "fees ke paise nahi hain" routes to legal aid, not student fee rights)
    else if ((/\b(aid|free.?lawyer|free.?legal|dlac|helpline|1099|1991|ngo|ombudsman|mohtasib|bait.?ul.?maal|pro.?bono|afford|affordability|garib|poor|madad|mufti|paise|paisa|budget|no money|no budget|nahi hain)\b/i.test(normalizedQuery) || /(مدد|مفت|قانونی\s*امداد)/.test(query))
        && !/\b(university|school|college|students?|tuition|scholarship|hostel)\b/i.test(normalizedQuery)
        && !/\b(bank|banking|cheque|sbp|state bank)\b/i.test(normalizedQuery)) {
      domain = 'legal-aid';
      rewrittenQuery = 'legal aid DLAC free lawyer helpline 1099 1991 NGO ombudsman mohtasib Pakistan Bar Council eligibility pro bono Human Rights Cell affordability no fee';
    }
    // Constitutional history — must run BEFORE the rights branch so "which
    // constitution was in force in 1962" routes to pakistan_constitutional_history,
    // not generic fundamental_rights.
    else if (/\b(constitutional history|1956|1962|which constitution|constitution.*was.*in force|constitution.*of.*1956|constitution.*of.*1962|constitution.*of.*1973|martial law|legal framework order|LFO|One Unit|constituent assembly|constitutional development|constitutional amendment.*history)\b/i.test(normalizedQuery)) {
      domain = 'history';
      rewrittenQuery = 'Pakistan constitutional history 1956 1962 1973 constitution martial law Legal Framework Order One Unit constituent assembly constitutional development';
    }
    // Prisons / prisoner rights — must run BEFORE the rights branch so "rights
    // of prisoners to family meetings" routes to prisons_laws, not fundamental_rights.
    else if (/\b(prisoner\w*|prison\w*|jail\w*|borstal\w*|family meeting.*prison|prison rights|prisoners rights)\b/i.test(normalizedQuery)) {
      domain = 'criminal';
      rewrittenQuery = 'Prisons Act prisoner rights jail family meetings visitation rules Pakistan prison regulations';
    }
    // Public service / Civil servants — must run BEFORE the rights branch so
    // "terms and conditions of civil servants" routes to admin_service_laws,
    // not fundamental_rights (which catches "rights" in the query).
    else if (/\b(civil servant\w*|government employ\w*|government servant\w*|service rules|civil servants act|terms and conditions of service|CSS |establishment division)\b/i.test(normalizedQuery)) {
      domain = 'labour';
      rewrittenQuery = 'Civil Servants Act 1973 government employee civil servant terms conditions service rules Establishment Division Pakistan service tribunal';
    }
    // Education / Student domain — must run BEFORE the rights branch so
    // university/student queries route to the dedicated student corpus,
    // not fundamental rights. Exclusion guards prevent cross-domain contamination.
    else if (
      (/\b(university|universit(?:y|ies)|college|campus|academic|semester|admission|enroll\w*|matric|intermediate|bachelor|masters|PhD|undergraduate|postgraduate)\b/i.test(normalizedQuery) ||
      /\b(tuition|fee|fees|challan|refund|concession|waiver|scholarship|stipend|financial aid|need.?based|merit.?based)\b/i.test(normalizedQuery) && /\b(students?|university|college|admission|degree)\b/i.test(normalizedQuery) ||
      /\b(exam|examination|paper|result|recheck|re.?evaluat|supplementary|backlog|CGPA|GPA|transcript|mark.?sheet|grade|degree|attestation|equivalence)\b/i.test(normalizedQuery) && /\b(students?|university|college|board|BISE|HEC)\b/i.test(normalizedQuery) ||
      /\b(hostel|accommodation|mess|warden|provost|hall of residence)\b/i.test(normalizedQuery) && /\b(students?|university|college|allotment)\b/i.test(normalizedQuery) ||
      /\b(disciplinary|expulsion|suspension|rustication|debarment|show.?cause|notice|misconduct|ragging|hazing)\b/i.test(normalizedQuery) && /\b(students?|university|college|school)\b/i.test(normalizedQuery) ||
      /\b(harassment|harass|bully|cyberstalk|molest|indecent)\b/i.test(normalizedQuery) && /\b(university|college|campus|teacher|professor|students?|class|lecture)\b/i.test(normalizedQuery) ||
      /\b(complaint|grievance|appeal|forum|authority|where|kahan)\b/i.test(normalizedQuery) && /\b(students?|university|college|hostel|campus)\b/i.test(normalizedQuery) ||
      /\b(HEC|Higher Education Commission|degree attestation|transcript request|degree equivalence|foreign degree)\b/i.test(normalizedQuery) ||
      /\b(student council|student union|student society|student organization|student election|student representative)\b/i.test(normalizedQuery) ||
      /\b(student welfare|counselling|counseling|disability|special needs|health centre|health services)\b/i.test(normalizedQuery) && /\b(students?|university|college)\b/i.test(normalizedQuery) ||
      /\b(university transport|uni van|student bus|student transport|campus transport|school transport)\b/i.test(normalizedQuery) ||
      /\b(legal aid clinic|free legal aid|student legal)\b/i.test(normalizedQuery) && /\b(students?|university|college)\b/i.test(normalizedQuery) ||
      /\b(bonafide|NOC|no objection certificate|character certificate)\b/i.test(normalizedQuery) && /\b(students?|university|college)\b/i.test(normalizedQuery) ||
      /\b(academic probation|academic integrity|plagiarism|course repeat|attendance shortage)\b/i.test(normalizedQuery) ||
      /\b(admit card|roll number slip|date sheet|examination schedule)\b/i.test(normalizedQuery) ||
      /\b(fee refund|tuition refund|admission cancellation refund)\b/i.test(normalizedQuery) ||
      /\b(Ehsaas scholarship|BISP scholarship|Zakat scholarship|HEC need.?based|HEC merit scholarship|foreign scholarship|Fulbright|Chevening|DAAD)\b/i.test(normalizedQuery) ||
      /\b(scholarship|stipend)\b/i.test(normalizedQuery) && /\b(Ehsaas|BISP|Zakat|merit|need.?based|foreign|Fulbright|Chevening|DAAD|HEC)\b/i.test(normalizedQuery) ||
      /\b(rechecking|re.?evaluat|supplementary exam|paper recheck|result recheck)\b/i.test(normalizedQuery) ||
      /\b(expulsion|rustication|debarment from university|debarment from college|debarment from exam\w*)\b/i.test(normalizedQuery) ||
      /\b(professor misconduct|teacher abuse|faculty harass|lecturer harass)\b/i.test(normalizedQuery) ||
      /\b(university appeal|VC appeal|syndicate|academic council|controller of examinations)\b/i.test(normalizedQuery) ||
      /\b(anti.?harassment committee|inquiry committee harassment|focal person harassment)\b/i.test(normalizedQuery) ||
      /\b(exam|result|appeal|fee|fees|challan|admission|hostel|transcript|degree|scholarship|recheck|paper|backlog|CGPA|merit)\b/i.test(normalizedQuery) && /\b(kaise|karna|kare|banwa|banwaye|milega|milegi|chahiye|kahan|darj|kya|apply|karo|batao|bataye|jama)\b/i.test(normalizedQuery) ||
      // An education artefact named next to an education actor is the education
      // corpus whichever language or phrasing the question uses.
      /\b(exam|examination|result|papers?|marks|certificate|certificates|bonafide|transcript|admission|hostel|degree|attendance)\b/i.test(normalizedQuery) && /\b(school|teacher|principal|student|board)\b/i.test(normalizedQuery) ||
      /(یونیورسٹی|یونیورسٹیاں|کالج|تعلیم|تعلیمی|فیس|فیسوں|اسکالرشپ|وظیفہ|امتحان|پرچہ|نتیجہ|ڈگری|ہاسٹل|طالب علم|طالبات|جامعہ)/.test(query))
      && !/cyber.*(?:crime|bullying|hack|PECA|online fraud)/i.test(normalizedQuery)
      && !/consumer.*(?:court|complaint|product|shop|goods|defective|seller)/i.test(normalizedQuery)
      && !/labour.*(?:wage|factory|worker|employ\w*|workplace|office|job|staff|company)/i.test(normalizedQuery)
      && !/\b(?:employ\w*|workplace|office|job|staff|company|factory|worker|wage|salary)\b/i.test(normalizedQuery)
      // فیس is the Urdu word for ANY fee, and the script trigger below matches it
      // without an education partner word, so a bank charge taken from an account
      // was classified as education and answered from the HEC fee-refund policy.
      // A query that names a bank is a banking question whichever fee it cites.
      && !/\b(bank|banking|cheque|dishonou?r|SBP|State Bank)\b/i.test(normalizedQuery)
    ) {
      domain = 'education';
      const eduTerms = [];
      if (/admission|enroll|merit list|provisional/i.test(normalizedQuery)) eduTerms.push('university admission criteria merit list fee structure refund policy provisional admission');
      if (/fee|tuition|refund|concession|waiver|challan/i.test(normalizedQuery)) eduTerms.push('university fee structure refund policy concession waiver HEC fee refund guidelines');
      if (/scholarship|stipend|financial aid|Ehsaas|BISP|Zakat|HEC need|merit scholarship/i.test(normalizedQuery)) eduTerms.push('HEC scholarship need-based merit Ehsaas BISP provincial scholarship university waiver financial aid');
      if (/exam|paper|result|recheck|re.?evaluat|supplementary|backlog/i.test(normalizedQuery)) eduTerms.push('university examination rules rechecking re-evaluation supplementary exam result gazette Controller of Examinations');
      if (/degree|attestation|equivalence|transcript|HEC verify/i.test(normalizedQuery)) eduTerms.push('HEC degree recognition attestation equivalence transcript verification foreign degree');
      if (/hostel|accommodation|warden|mess|allotment/i.test(normalizedQuery)) eduTerms.push('university hostel allotment fees rules cancellation mess security warden provost');
      if (/harass|bully|inquiry committee|focal person/i.test(normalizedQuery)) eduTerms.push('anti-harassment Protection Against Harassment Act 2010 HEC policy Inquiry Committee complaint procedure appeal Ombudsman');
      if (/disciplinary|expulsion|suspension|show.?cause|ragging|hazing|misconduct/i.test(normalizedQuery)) eduTerms.push('student discipline show-cause notice disciplinary proceedings due process appeal Article 10A fair hearing');
      if (/student council|student union|student society|election|organization/i.test(normalizedQuery)) eduTerms.push('student organization society registration election student union Article 17 freedom of association');
      if (/welfare|counselling|disability|health|legal aid/i.test(normalizedQuery)) eduTerms.push('student welfare health services counselling disability accommodation legal aid Article 25A');
      if (/transport|bus|van|safety|accident/i.test(normalizedQuery)) eduTerms.push('university transport safety harassment accident liability Motor Vehicles Ordinance');
      if (/probation|attendance|CGPA|plagiarism|academic integrity/i.test(normalizedQuery)) eduTerms.push('academic rules attendance grading CGPA probation academic integrity plagiarism transcript');
      if (/bonafide|NOC|certificate/i.test(normalizedQuery)) eduTerms.push('university bonafide certificate NOC student request procedure');
      if (/appeal|VC|syndicate|academic council/i.test(normalizedQuery)) eduTerms.push('university appeal Vice-Chancellor Syndicate Academic Council grievance redressal Article 199 writ');
      if (eduTerms.length > 0) {
        // Append, never replace. The discipline rule above fires on the word
        // "ragging" and then rewrote the whole query to generic discipline
        // vocabulary that does not print "ragging" once — so the records that
        // actually state ragging/hazing were never candidates, and a ragging
        // complaint was answered from scholarship-eligibility text.
        rewrittenQuery = `${normalizedQuery} ${eduTerms.join(' ')}`;
      } else {
        rewrittenQuery = 'student rights university education HEC policy Pakistan admission fee exam degree hostel harassment discipline welfare';
      }
    }
    // Fundamental Rights / Constitution / Student Rights.
    // The bare word "rights"/"haq" occurs in almost every lay legal query, so
    // this branch must not outrank the dedicated statute branches further down:
    // a landlord keeping a deposit is a tenancy question and a wife's
    // maintenance is a family question, and each of those corpora answers it
    // better than the general rights records. A query that names the
    // Constitution or an Article is the opposite case — there the rights
    // corpus IS the authority, so that marker overrides the exclusion.
    else if ((/\b(rights?|fundamental|constitution|article|liberty|education|equality|dignity|freedom|speech|religion|fair.?trial|due.?process|writ|habeas|mandamus|azadi|musawat|huqooq|aain|students?|university|school|degree|fee|scholarship|hostel)\b/i.test(normalizedQuery) || /(بنیادی\s*حقوق|حقوق|زندگی|آزادی|آئین|قانون|آرٹیکل|یونیورسٹی|فیس|تعلیم|اسکالرشپ)/.test(query))
        && (/\b(article|constitution|aain|fundamental|human rights)\b/i.test(normalizedQuery) || /(آئین|بنیادی\s*حقوق)/.test(query)
          || !(/\b(landlord|landlady|tenant|tenancy|rent|rental|premises|eviction|qaba|makan|kiraya|kiraye|kirayedar|malik)\b/i.test(normalizedQuery)
            || /\b(husband|wife|biwi|khawand|shohar|spouse|khula|talaq|divorce|maintenance|nafqa|custody|hizanat|dowry|jahez|mehr|dower|iddat)\b/i.test(normalizedQuery)
            || /\b(bank|banking|cheque|dishonou?r|SBP|State Bank)\b/i.test(normalizedQuery)))) {
      domain = 'rights';
      // Check for specific article numbers
      const artMatch = /\b(article|art)\s*(\d+[a-zA-Z]?)\b/i.exec(normalizedQuery);
      if (artMatch) {
        rewrittenQuery = `Constitution Pakistan Article ${artMatch[2]} fundamental rights`;
      } else {
        // Build the rewrite from the *actual* rights sub-domain mentioned in
        // the query. Generic queries must NOT inherit student/university
        // boilerplate or they outrank the dedicated fundamental-rights corpus.
        const studentTerms = [];
        if (/fee|refund|concession/i.test(normalizedQuery)) studentTerms.push('university tuition fee refund policy concession waiver STUDENT_FEE_RIGHTS');
        if (/harass|teacher|abuse/i.test(normalizedQuery)) studentTerms.push('university teacher sexual harassment Inquiry Committee HEC policy');
        if (/scholarship|merit|need/i.test(normalizedQuery)) studentTerms.push('HEC scholarship merit need based Ehsaas laptop');
        if (/disciplinary|expel|suspend|debar/i.test(normalizedQuery)) studentTerms.push('university disciplinary proceedings fair hearing expulsion suspension');
        if (/exam|recheck|mark/i.test(normalizedQuery)) studentTerms.push('examination rechecking marks Controller Board BISE');
        if (/aid|free.?lawyer|help/i.test(normalizedQuery)) studentTerms.push('legal aid resources free lawyer help helpline');
        if (studentTerms.length > 0) {
          rewrittenQuery = studentTerms.join(' ');
        } else if (/\b(students?|university|school|college|tuition|degree)\b/i.test(normalizedQuery)) {
          rewrittenQuery = 'student rights university education Constitution Article 25A fair hearing discipline HEC complaint';
        } else if (/\b(procedure|tareeqa|how|steps|filing|process|kaise|darj|apply)\b/i.test(normalizedQuery)) {
          // Procedure-intent rights query: remedy pathway, not case law
          rewrittenQuery = normalizedQuery + ' procedure remedy writ petition High Court Article 199 Constitution filing steps court enforcement';
        } else if (/\b(women|woman|female|khawateen|aurat)\b/i.test(normalizedQuery)) {
          rewrittenQuery = 'Constitution Pakistan fundamental rights women equal protection of law Article 14 25 25A 26 27 34 35 37 women protection laws inheritance harassment';
        } else if (/\b(accused|prisoner|detainee|arrested|undertrial)\b/i.test(normalizedQuery)) {
          rewrittenQuery = 'Constitution Pakistan fundamental rights accused prisoner detainee arrested person Article 9 10 10A 11 14 fair trial safeguards';
        } else if (/\b(child|children|minor|juvenile)\b/i.test(normalizedQuery)) {
          rewrittenQuery = 'children rights juvenile protection Constitution Article 11 25A guardianship welfare of minor child protection laws';
        } else if (/\b(cases?|judgments?|judgements?|verdict|precedent|petition|decision)\b/i.test(normalizedQuery)) {
          rewrittenQuery = normalizedQuery + ' landmark judgment Supreme Court Pakistan fundamental rights constitution PLD SCMR precedent';
        } else {
          rewrittenQuery = 'Constitution Pakistan fundamental rights enforcement writ jurisdiction High Court Supreme Court Articles 8 9 10 10A 11 14 19 19A 20 23 24 25 25A 26 27 28 remedies';
        }
      }
    }
    // Evidence law / QSO — must run BEFORE FIR/police so "confession to a
    // police officer inadmissible" routes to evidence_qso_1984, not CrPC.
    else if (/\b(confession|inadmissible|admissible|admissibility|evidence law|QSO|evidence act|testimony|witness|deposition|affidavit|oath|corroborat|proof of|burden of proof|estoppel|presumption|relevance|relevant fact)\b/i.test(normalizedQuery)) {
      domain = 'evidence';
      const evTerms = [];
      if (/confession|police officer/i.test(normalizedQuery)) evTerms.push('confession police officer inadmissible QSO Section 24 25 26 27 38');
      if (/witness|testimony|deposition/i.test(normalizedQuery)) evTerms.push('witness testimony deposition examination cross-examination QSO evidence');
      if (/burden of proof|presumption/i.test(normalizedQuery)) evTerms.push('burden of proof presumption QSO evidence');
      rewrittenQuery = evTerms.length > 0 ? evTerms.join(' ') : 'Qanoon-e-Shahadat Order 1984 QSO evidence admissibility confession witness testimony Pakistan';
    }
    // FIR / Police / Arrest / Bail (Criminal Procedure)
    else if (/\b(fir|police|complaint|arrest|bail|remand|challan|warrant|summon|investigation|thana|giraftari|zamanat)\b/i.test(normalizedQuery) || /(ایف\s*آئی\s*آر|پولیس|تھانہ|ضمانت|گرفتاری)/.test(query)) {
      // Election-related complaints must route to elections, not police/FIR
      if (/\b(election\w*|electoral|result.*decided|tribunal|petition.*election)\b/i.test(normalizedQuery)) {
        domain = 'elections';
        rewrittenQuery = 'Elections Act 2017 election tribunal electoral complaint dispute result petition appeal ECP Election Commission Pakistan ROPA representation';
      } else {
      domain = 'criminal';
      const procTerms = [];
      if (/refus|deni|inakar|nahi/i.test(normalizedQuery)) {
        procTerms.push('FIR refusal remedy Section 22A 22B CrPC Sessions Court Justice of Peace');
      } else if (/fir|first information|report|register/i.test(normalizedQuery)) {
        procTerms.push('FIR registration Section 154 CrPC procedure');
      }
      if (/bail|zamanat/i.test(normalizedQuery)) procTerms.push('bail procedure Section 496 497 498A bailable non-bailable pre-arrest anticipatory');
      if (/arrest|giraftari/i.test(normalizedQuery)) procTerms.push('arrest Section 46 54 61 without warrant 24 hours');
      if (/remand/i.test(normalizedQuery)) procTerms.push('remand Section 167 physical judicial');
      if (/challan/i.test(normalizedQuery)) procTerms.push('challan Section 173 police report');
      if (/warrant/i.test(normalizedQuery)) procTerms.push('warrant Section 70 75 arrest');
      if (/investigation/i.test(normalizedQuery)) procTerms.push('investigation Section 156 157 161 164 police');
      rewrittenQuery = procTerms.length > 0 ? procTerms.join(' ') : 'FIR police complaint arrest bail CrPC procedure Section 154 496 497';
      }
    }
    // Provincial / territorial laws — must run BEFORE property/family/civil so
    // "Punjab rent", "Sindh domestic violence", "Islamabad rented premises" etc.
    // route to the provincial corpus, not the generic property/family domain.
    else if (/\b(punjab|sindh|balochistan|khyber|KP\b|KPK|islamabad|ICT\b|lahore|quetta|peshawar|karachi|provincial|province law)\b/i.test(normalizedQuery)
      // A place name is scope metadata, not a legal topic. Route to provincial
      // law only when the query is about the law itself, so "rent deposit in
      // Hyderabad" still reaches tenancy and "cheque in Karachi" still reaches
      // banking instead of a generic provincial rewrite that matches nothing.
      && /\b(province|provincial|qanoon|kanun|law|laws|act|acts|ordinance|assembly|sarkar|government|rule|rules|policy|legislation)\b/i.test(normalizedQuery)) {
      domain = 'province';
      const provTerms = [];
      if (/punjab|lahore/i.test(normalizedQuery)) provTerms.push('Punjab provincial law Lahore Punjab Rented Premises Act Punjab laws');
      if (/sindh|karachi/i.test(normalizedQuery)) provTerms.push('Sindh provincial law Karachi Sindh Acts domestic violence protection');
      if (/balochistan|quetta/i.test(normalizedQuery)) provTerms.push('Balochistan provincial law Quetta Balochistan Acts rent laws');
      if (/khyber|KP\b|KPK|peshawar/i.test(normalizedQuery)) provTerms.push('KP Khyber Pakhtunkhwa provincial law Peshawar child protection Acts');
      if (/islamabad|ICT/i.test(normalizedQuery)) provTerms.push('Islamabad ICT provincial law rented premises federal capital');
      if (/rent|tenancy|leased/i.test(normalizedQuery)) provTerms.push('rent tenancy leased premises provincial Act');
      if (/domestic violence|DV|protection/i.test(normalizedQuery)) provTerms.push('domestic violence protection provincial Act');
      if (/child protection/i.test(normalizedQuery)) provTerms.push('child protection provincial Act');
      rewrittenQuery = provTerms.length > 0 ? provTerms.join(' ') : 'provincial law Pakistan province specific legislation';
    }
    // POA / Document Drafting (before family — "power of attorney" must not
    // fall through to property/civil just because the POA concerns property)
    else if (/\b(power of attorney|attorney|poa|mukhtar.?nama|draft|template|format|wording|deed)\b/i.test(normalizedQuery)) {
      domain = 'drafting';
      const draftTerms = [];
      if (/power of attorney|attorney|poa|mukhtar/i.test(normalizedQuery)) draftTerms.push('power of attorney POA Mukhtar Nama general special registration attestation');
      if (/sale|property|house|land|plot/i.test(normalizedQuery)) draftTerms.push('sale deed property transfer registration');
      if (/draft|template|format|wording/i.test(normalizedQuery)) draftTerms.push('drafting structure template format legal document');
      rewrittenQuery = draftTerms.length > 0 ? draftTerms.join(' ') : 'power of attorney POA drafting structure template';
    }
    // Family Law
    else if (/\b(marri\w*|bride|groom|underage|divorce|maintenance|family|wife|husband|talaq|khula|polygamy|nikah|mehr|dower|custody|guardian|hizanat|nafqa|iddat|dowry|jahez)\b/i.test(normalizedQuery) || /(طلاق|شادی|نکاح|خاندانی|مہر|خرچہ|حضانت|خلع|نفقہ)/.test(query)) {
      domain = 'family';
      const famTerms = [];
      if (/divorce|talaq/i.test(normalizedQuery)) famTerms.push('talaq divorce Section 7 Muslim Family Laws notice Union Council');
      if (/khula|dissolution/i.test(normalizedQuery)) famTerms.push('khula dissolution Section 2 wife Family Court');
      if (/maintenance|nafqa|kharcha/i.test(normalizedQuery)) famTerms.push('maintenance Section 9 wife children nafaqa');
      if (/custody|hizanat|children|bachon/i.test(normalizedQuery)) famTerms.push('child custody hizanat Guardians Wards Act welfare minor');
      if (/(child|underage|girl|bride|minor)\W.{0,25}(marri|nikah|shadi)|marri\w*\W.{0,25}(child|underage|girl|bride|minor)|age of marri|legal age|restraint/i.test(normalizedQuery)) famTerms.push('child marriage restraint minimum age of marriage girl wife Muslim Family Laws Ordinance age of majority consent');
      if (/dower|mehr/i.test(normalizedQuery)) famTerms.push('dower mehr Section 10 recovery');
      if (/marriage|nikah|shadi/i.test(normalizedQuery)) famTerms.push('marriage nikah registration Section 5 Muslim Family Laws');
      if (/polygamy/i.test(normalizedQuery)) famTerms.push('polygamy permission Section 6 Union Council Arbitration');
      rewrittenQuery = famTerms.length > 0 ? famTerms.join(' ') : 'Muslim Family Laws Ordinance 1961 marriage divorce maintenance custody Section 5 6 7 9';
    }
    // Property / Tenancy / Land
    else if (/\b(property|land|tenancy|rent|lease|eviction|landlord|tenant|transfer|registry|mutation|zameen|kiraya|makan|kirayedar|plot|flat|house|builder|sold|double\s*sale)\b/i.test(normalizedQuery) || /(جائیداد|زمین|کرایہ|مکان)/.test(query)) {
      domain = 'civil';
      const propTerms = [];
      if (/tenant|rent|kiraya|kirayedar|evict|landlord/i.test(normalizedQuery)) propTerms.push('tenancy rent eviction landlord tenant Punjab Rented Premises Act Rent Tribunal');
      if (/deposit|advance|security\s*deposit|refund.*rent|rent.*refund/i.test(normalizedQuery)) propTerms.push('security deposit refund tenant landlord vacation arrears tenancy agreement deposit return Sindh Punjab Rented Premises Act');
      if (/transfer|sale|registry|registr/i.test(normalizedQuery)) propTerms.push('Transfer Property Act 1882 sale registration Registration Act 1908 Section 17 54');
      if (/mutation|inteqal|fard/i.test(normalizedQuery)) propTerms.push('mutation inteqal land revenue records Patwari Tehsildar Board Revenue');
      if (/inherit|heir|succession|estate|warisha|legal share|father.*died|parent/i.test(normalizedQuery)) propTerms.push('inheritance succession Muslim law shares legal heir certificate estate partition suit unauthorized sale by one heir');
      if (/dispute|claim|possess|plot|builder|double/i.test(normalizedQuery)) propTerms.push('property dispute Specific Relief Act declaration injunction possession suit double sale fraud remedy');
      rewrittenQuery = propTerms.length > 0 ? propTerms.join(' ') : 'property land tenancy rent Transfer Property Act Registration Act mutation eviction';
    }
    // Customs laws — must run BEFORE court hierarchy / civil procedure so
    // "appeal route when customs officers seize goods" routes to customs_act_1969.
    else if (/\b(customs|import|export|seizure|seized|customs officer|customs duty|adjudication|collector of customs)\b/i.test(normalizedQuery)) {
      domain = 'customs';
      rewrittenQuery = 'Customs Act 1969 import export seizure appeal Collector Customs adjudication duty tariff remedy Pakistan';
    }
    // Arbitration — must run BEFORE court hierarchy / civil procedure so
    // "arbitration award enforced by a court" routes to arbitration_act_1940.
    else if (/\b(arbitration|arbitrator|arbitral award|arbitration agreement|reference to arbitration)\b/i.test(normalizedQuery)) {
      domain = 'civil';
      rewrittenQuery = 'Arbitration Act 1940 arbitration award enforcement arbitrator reference agreement court Pakistan Section 17 30 34';
    }
    // Court hierarchy — must run BEFORE civil procedure so "which court hears
    // an appeal against sessions judge" routes to court_hierarchy, not generic CPC.
    else if (/\b(which court|court hierarchy|appeal against|sessions judge|district judge|judicial magistrate|civil judge|additional district|high court.*appeal|supreme court.*appeal|appellate court|court of)\b/i.test(normalizedQuery)) {
      domain = 'procedure';
      rewrittenQuery = 'court hierarchy appellate jurisdiction Supreme Court High Court District Court Sessions Judge Civil Judge Magistrate appeal revision review Pakistan';
    }
    // Limitation law — must run BEFORE civil procedure so "within how many years
    // must a suit be filed" routes to limitation_act_1908, not generic CPC.
    else if (/\b(within how many years|limitation|time.?bar|barred by time|limitation period|period of limitation|within.*years.*file|time limit.*suit)\b/i.test(normalizedQuery)) {
      domain = 'civil';
      rewrittenQuery = 'Limitation Act 1908 period limitation time bar suit filed years schedule article Pakistan prescription';
    }
    // Civil Procedure
    else if (/\b(civil|cpc|suit|plaint|summons|written.?statement|decree|injunction|appeal|revision|review|execution|order)\b/i.test(normalizedQuery) || /(عدالت|مقدمہ|دعویٰ)/.test(query)) {
      domain = 'civil';
      rewrittenQuery = 'civil suit procedure CPC plaint summons written statement issues evidence judgment decree appeal revision execution Order injunction';
    }
    // Consumer
    else if (/\b(consumer|defective|warranty|product|refund|complain|goods|service|purchase|khareed|nuqsan)\b/i.test(normalizedQuery)
        && !/\b(bank|banking|cheque|sbp|state bank)\b/i.test(normalizedQuery)) {
      domain = 'consumer';
      rewrittenQuery = 'consumer complaint defective goods services refund Consumer Protection Act Consumer Court procedure legal notice warranty';
    }
    // Court proceedings / hearing stages must route to procedure BEFORE the
    // case-law branch — "first hearing of a criminal case" is a procedure
    // question, not a request for judgments.
    else if (/\b(first.?hearing|hearing|trial|stages|proceed(?:ing|s)?|appearance|adjourn\w*|peshi|samai|fram(?:e|ing).?of.?charge|next.?date)\b/i.test(normalizedQuery)
        && !/\b(benazir|bhutto|darshan|shehla|asma|jilani|nawaz|mehrunisa|rehman|suo.?motu|pld|scmr|citation)\b/i.test(normalizedQuery)) {
      domain = 'procedure';
      rewrittenQuery = /\b(criminal|crime|offence|charge.?sheet|crpc|ppc|accused|sessions|magistrate)\b/i.test(normalizedQuery)
        ? 'criminal trial stages CrPC charge sheet framing of charges prosecution defense evidence judgment first hearing appearance'
        : 'court procedure trial stages civil family first hearing framing of charges evidence arguments judgment decree appeal';
    }
    // Case Law
    else if (/\b(case|judgment|judg|verdict|precedent|supreme.?court|high.?court|pld|scmr|citation|suo.?motu|faisla|benazir|darshan|shehla|nawaz|asma|jilani|bhutto|mehrunisa|rehman|lal.?masjid|transgender|honour.?killing)\b/i.test(normalizedQuery) || / (v\.|vs\.) /i.test(normalizedQuery)) {
      domain = 'case-law';
      if (/benazir/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_BENAZIR_BHUTTO_V_FEDERATION Benazir Bhutto PLD 1988 SC 416 political party fundamental right Article 17';
      } else if (/zulfiqar|bhutto/i.test(normalizedQuery) && !/benazir/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_ZULFIQAR_ALI Zulfiqar Ali Bhutto v State PLD 1979 SC 53 constitutional criminal jurisdiction';
      } else if (/asma|jilani/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_ASMA_JILANI Asma Jilani v Government of Punjab PLD 1972 SC 139 revolutionary legality constitutional continuity';
      } else if (/mehrunisa|inheritance|wirasat/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_MEHRUNNISA Mehrunisa v Government of Punjab PLD 2000 SC 494 women inheritance Quranic share custom';
      } else if (/darshan/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_DARSHAN_MASIH_V_STATE Darshan Masih PLD 1990 SC 513 bonded labour slavery Article 11';
      } else if (/shehla|wAPDA|environment/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_SHEHLA_ZIA_V_WAPDA Shehla Zia PLD 1994 SC 693 environment right to life Article 9';
      } else if (/nawaz/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_MUHAMMAD_NAWAZ_SHARIF Nawaz Sharif PLD 1993 SC 476 supersession government Article 58';
      } else if (/rehman|honour/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_REHMAN_GIRLS Rehman v State PLD 2018 SC 1 honour killing qisas diyat Section 311';
      } else if (/lal.?masjid/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_LAL_MASJID Lal Masjid PLD 2015 SC 403 security forces operation compensation state law';
      } else if (/transgender/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_TRANSGENDER transgender rights 2020 SCMR 1234 self perceived gender identity Article 9 14 25';
      } else if (/al.?jihad|judge|appointment|consultation/i.test(normalizedQuery)) {
        rewrittenQuery = 'CASE_INAMUL_HAQ Al-Jihad Trust PLD 1996 SC 324 consultation judges appointment Article 177 193';
      } else if (/supreme.?court/i.test(normalizedQuery) && /independence|judiciary/i.test(normalizedQuery)) {
        rewrittenQuery = 'Supreme Court of Pakistan independence judiciary judicial autonomy separation of powers Article 177 193 209 constitutional bench sc_judgments landmark ruling PLD SCMR';
      } else if (/\b(list|index|recent|compilation|digest)\b/i.test(normalizedQuery) && /\b(writ petition|service|high court)\b/i.test(normalizedQuery)) {
        rewrittenQuery = 'High Court index metadata list writ petition service cases decided judgments digest PLD SCMR lhc_index ihc_index phc_index bhc_index recent service matter';
      } else {
        rewrittenQuery = normalizedQuery + ' case judgment Supreme Court High Court Pakistan PLD SCMR precedent';
      }
    }
    // Court Procedure (general)
    else if (/\b(court|procedure|filing|hearing|evidence|trial|stages|adalat|kachehri)\b/i.test(normalizedQuery)) {
      domain = 'procedure';
      rewrittenQuery = 'court procedure trial stages criminal civil family filing hearing evidence judgment appeal';
    }
    // Contract law
    else if (/\b(consideration|agreement without|contract act|breach of contract|enforceable agreement|void agreement|void contract|valid contract|contractual)\b/i.test(normalizedQuery)) {
      domain = 'civil';
      rewrittenQuery = 'Contract Act 1872 consideration agreement enforceable void voidable Section 25 2 10 23 24 Pakistani law';
    }
    // Banking laws
    else if (/\b(bank|banking|cheque|dishonour|insufficient funds|489.?F|SBP|State Bank)\b/i.test(normalizedQuery)
        && !/\b(cyber|online|digital|electronic|peca)\b/i.test(normalizedQuery)
        && !/\b(regulat\w*|overse\w*|which body|who regulates)\b/i.test(normalizedQuery)) {
      domain = 'banking';
      const bankTerms = [];
      if (/cheque|dishonour|insufficient|489/i.test(normalizedQuery)) bankTerms.push('dishonour of cheque Section 489F PPC punishment banking law remedy');
      if (/bank|banking|SBP|State Bank/i.test(normalizedQuery)) bankTerms.push('banking law State Bank SBP regulation Banking Companies Ordinance');
      // A dispute about money taken from the customer's own account is not a
      // question about what a central bank does. Without this the corpus record
      // that names the SBP's currency and monetary-policy functions outranked
      // the records that speak to the customer's problem, and the answer to
      // "the bank deducted my money and will not return it" described SBP's
      // mandate. The complaint/remedy vocabulary below is the corpus's own
      // (public offices names the Banking Mohtasib; banking laws name the
      // Banking Court and depositor protection).
      if (/deduct|debit|kaat|kat |kat\b|withdr|not (?:return|refund)|wapis|refund|reversal|unauthori[sz]ed|fraud/i.test(normalizedQuery)) {
        bankTerms.push('wrongful deduction debit account refund reversal complaint Banking Mohtasib Banking Court dispute depositor protection');
      }
      rewrittenQuery = bankTerms.length > 0 ? bankTerms.join(' ') : 'banking laws Pakistan bank cheque dishonour remedy SBP';
    }
    // Environmental laws
    else if (/\b(environment|environmental|EPA|no.?objection|industrial project|pollution|environmental impact|NEQS)\b/i.test(normalizedQuery)) {
      domain = 'environment';
      rewrittenQuery = 'environmental protection EPA Environmental Protection Act 1997 no-objection certificate NOC industrial project environmental impact assessment pollution NEQS Pakistan';
    }
    // Health / medicines — must run BEFORE public offices so "registration of
    // medicines" routes to health_laws, not public_offices.
    else if (/\b(medicin\w*|health|drug|DRAP|pharma|pharmaceutic|registration of medic|medical device)\b/i.test(normalizedQuery)
        && !/\b(court|judge|judicial)\b/i.test(normalizedQuery)) {
      domain = 'health';
      rewrittenQuery = 'health laws DRAP Drug Regulatory Authority Pakistan medicine registration pharmaceutical regulation Pakistan';
    }
    // Competition — must run BEFORE public offices so "which body regulates
    // anti-competitive agreements" routes to competition_act_2010, not public_offices.
    else if (/\b(anti.?competitive|competition|monopoly|cartel|CCP|Competition Commission)\b/i.test(normalizedQuery)) {
      domain = 'competition';
      rewrittenQuery = 'Competition Act 2010 Competition Commission of Pakistan CCP anti-competitive agreements monopoly cartel market dominance abuse Pakistan';
    }
    // Public offices / regulators — queries about institutional oversight,
    // regulatory bodies, and powers of public offices.
    else if (/\b(regulat\w*|overse\w*|which body|who regulates|powers of|deputy commissioner|role of.*officer|functions of)\b/i.test(normalizedQuery)
        && !/\b(court|judge|judicial)\b/i.test(normalizedQuery)
        && !/\b(medicin\w*|health|drug|DRAP|pharma|registration of medic)\b/i.test(normalizedQuery)
        && !/\b(anti.?competitive|competition|monopoly|cartel|Competition Commission)\b/i.test(normalizedQuery)) {
      domain = 'offices';
      rewrittenQuery = 'public offices regulators oversight bodies powers functions Deputy Commissioner SHO regulatory authority institution Pakistan government';
    }
    // Elections / election tribunal — catches election result disputes and
    // electoral complaints that the civic branch (voter enrolment, ECP) doesn't cover.
    else if (/\b(election.*result|election.*complaint|election.*tribunal|election.*dispute|election.*petition|electoral.*complaint|electoral.*tribunal|electoral.*dispute|election.*appeal)\b/i.test(normalizedQuery)) {
      domain = 'elections';
      rewrittenQuery = 'Elections Act 2017 election tribunal electoral complaint dispute result petition appeal ECP Election Commission Pakistan ROPA representation';
    }
    // Catch-all: try to route via normalized query content
    else {
      // Attempt broad legal keyword detection before giving up
      if (/\b(law|legal|section|act|ordinance|regulation|rule|penalty|fine|imprison|qanoon|dafa)\b/i.test(normalizedQuery)) {
        domain = 'general-legal';
        rewrittenQuery = normalizedQuery + ' Pakistan law section act ordinance legal provision';
      }
    }

    // Everyday words -> the wording the statutes actually use, but only when no
    // branch above already rewrote the query: those rewrites carry the statute's
    // own wording, and stacking a second block of terms on top of them dilutes
    // the signal (verified: PECA/cyber queries fell under the evidence gate).
    // Queries matching no glossary rule come back unchanged.
    // Exempted again for a query with no Latin word at all (pure Urdu or Arabic
    // script): its own words contribute no token an English-language record can
    // match, so the canned branch rewrite is the entire search text and the
    // bridge would never run. There the expansion is recall, not dilution — the
    // measured dilution case involved Latin queries whose words were already in
    // the rewrite.
    if (rewrittenQuery === normalizedQuery || !/[a-z]{3,}/i.test(normalizedQuery)) {
      rewrittenQuery = expandSearchText(rewrittenQuery, query, normalizedQuery);
    }

    return { detectedLang, domain, rewrittenQuery, normalizedQuery, topicFilterTerms };
  }

  /**
   * Retrieves relevant legal chunks using hybrid retrieval.
   * Performs exact section matching, vector search (if online), and local TF-IDF keyword search.
   */
  /**
   * Every chunk that carries the text of a numbered provision, using the same
   * key/type convention exact matching relies on (numeric key, SECTION/ARTICLE).
   * The runtime citation audit checks a cited provision against this catalogue, so
   * it can only ever claim a section exists where the corpus really holds its text.
   */
  static provisionCorpus() {
    const idx = loadIndex();
    if (!idx || !Array.isArray(idx.chunks)) return [];
    return idx.chunks.filter(c =>
      /^\d{1,4}[a-f]{0,2}$/i.test(String(c.key || ''))
      && (c.type === 'SECTION' || c.type === 'ARTICLE'));
  }

  static async retrieve(query) {
    const idx = loadIndex();
    if (!idx || !idx.chunks || idx.chunks.length === 0) {
      return { chunks: [], isOfflineRetrieval: true, detectedLang: 'en', domain: 'unknown' };
    }

    // Pre-process and rewrite query
    const { detectedLang, domain, rewrittenQuery, normalizedQuery, topicFilterTerms } = RAGEngine.processQuery(query);

    // RUNTIME FIX (Phase 1): previously an 'unknown' domain short-circuited to
    // `{ chunks: [] }` here, so any legitimate legal question that did not hit a
    // routing keyword (e.g. "What is 22-A / 22-B used for?") never reached the
    // deterministic scoring below and Chat/Agent wrongly answered "not available"
    // even though the corpus held the answer. We no longer bail out: 'unknown'
    // simply means "no specific domain was detected", so we run the same
    // exact-provision + keyword + lexical + title scoring across the WHOLE
    // corpus. Domain-scoped boosts are naturally skipped (no DOMAIN_DOCS entry),
    // and the low relevance threshold + the caller's honest composer still guard
    // against junk. Truly non-legal chatter (greetings, refusals, math) is
    // intercepted earlier by curatedOfflineAnswer(), so this path is for real
    // knowledge questions that must be grounded, not refused.
    const isDomainless = domain === 'unknown';

    // Tokenize both rewritten and original query AND normalized query for better matches
    const originalTokens = tokenize(query);
    const rewrittenTokens = tokenize(rewrittenQuery);
    const normalizedTokens = tokenize(normalizedQuery);
    const queryTokens = Array.from(new Set([...originalTokens, ...rewrittenTokens, ...normalizedTokens]));
    const lowercaseQuery = query.toLowerCase();

    // Calculate vocabulary-present query tokens once for efficient normalization
    const validQueryTokens = queryTokens.filter(t => idx.idf[t] !== undefined);
    
    // 1. Exact legal-section / article matching — support MULTIPLE exact keys.
    // Numeric keys are scoped to the documents relevant to the routed domain:
    // without scoping, "section 24" would exactly match section 24 in every
    // statute that happens to have one (PECA, QSO 1984, Companies Act, ...).
    const DOMAIN_NUMBER_DOCS = {
      criminal: ['ppc_1860', 'crpc_1898', 'nab_ordinance_1999'],
      cyber: ['peca_2016'],
      family: ['family_laws_1961'],
      rights: { ARTICLE: ['constitution_1973'], SECTION: ['constitution_1973', 'fundamental_rights'] },
      civil: ['cpc_1908', 'property_laws', 'specific_relief_act_1877', 'contract_act_1872', 'sales_of_goods_act_1930'],
      labour: ['labour_employment'],
      consumer: ['consumer_protection'],
      'case-law': ['ppc_1860', 'crpc_1898', 'cpc_1908', 'constitution_1973'],
      education: ['edu_admissions_fees', 'edu_academic_rules', 'edu_anti_harassment', 'edu_discipline_grievance', 'edu_hostel', 'edu_examination', 'edu_scholarships', 'hec_degree_recognition', 'edu_transport_safety', 'edu_student_welfare', 'student_rights', 'education_student_rights', 'sindh_higher_education_laws', 'gcuh_institutional_rules']
    };
    // Precision override (named-statute disambiguation). When the query
    // EXPLICITLY names a statute, scope numeric section/article keys to that
    // statute's document only. Without this, a bare citation such as
    // "Section 154 CrPC" falls through to the general-legal domain, numericScope
    // returns null (no scoping), and the number ties with an unrelated statute
    // that happens to share it — e.g. Contract Act 1872 s.154 (bailment) instead
    // of CrPC 1898 s.154 (information in cognizable cases / FIR). Both chunks
    // carry key="154"/type="SECTION", so only docId scoping separates them.
    const NAMED_STATUTE_SCOPE = [
      { re: /\b(crpc|criminal procedure code|code of criminal procedure)\b/i, docIds: ['crpc_1898'] },
      { re: /\b(ppc|pakistan penal code|penal code)\b/i, docIds: ['ppc_1860'] },
      { re: /\b(cpc|civil procedure code|code of civil procedure)\b/i, docIds: ['cpc_1908'] },
      { re: /\b(peca|prevention of electronic crimes act|electronic crimes act|prevention of electronic crimes)\b/i, docIds: ['peca_2016'] },
      { re: /\b(contract act|indian contract act)\b/i, docIds: ['contract_act_1872'] },
      { re: /\b(qso|qanun.?e.?shahadat|law of evidence|evidence act)\b/i, docIds: ['evidence_qso_1984'] },
      { re: /\b(muslim family laws ordinance|muslim family laws)\b/i, docIds: ['family_laws_1961'] },
      { re: /\b(consumer protection act)\b/i, docIds: ['consumer_protection'] },
      { re: /\b(sale of goods act|sales of goods act)\b/i, docIds: ['sales_of_goods_act_1930'] },
      { re: /\b(specific relief act)\b/i, docIds: ['specific_relief_act_1877'] },
      { re: /\b(transfer of property act)\b/i, docIds: ['property_laws'] },
      { re: /\b(limitation act)\b/i, docIds: ['limitation_act_1908'] },
      { re: /\b(companies act|company act)\b/i, docIds: ['companies_act_2017'] },
      { re: /\b(nab ordinance|national accountability ordinance|national accountability bureau)\b/i, docIds: ['nab_ordinance_1999'] },
      { re: /\b(anti.?terrorism act|anti.?terror(?:ism)? (?:act|law))\b/i, docIds: ['ata_1997'] },
      { re: /\b(police order 2002|police order)\b/i, docIds: ['police_order_2002'] },
      { re: /\b(arbitration act)\b/i, docIds: ['arbitration_act_1940'] },
      { re: /\b(competition act)\b/i, docIds: ['competition_act_2010'] },
      { re: /\b(juvenile justice system ordinance|juvenile justice)\b/i, docIds: ['juvenile_justice_2000'] },
      { re: /\b(protection against harassment(?: of women at the workplace)? act|harassment act)\b/i, docIds: ['edu_anti_harassment'] },
      { re: /\b(hec act|higher education commission act|higher education)\b/i, docIds: ['hec_degree_recognition', 'edu_scholarships'] },
      { re: /\b(pecra|pakistan electronic crimes|cyber crime act)\b/i, docIds: ['peca_2016'] }
    ];
    const namedStatute = NAMED_STATUTE_SCOPE.find(s => s.re.test(query));
    const numericScope = type => {
      // An explicitly-named statute is the most precise scope available.
      if (namedStatute) return namedStatute.docIds;
      const sc = DOMAIN_NUMBER_DOCS[domain];
      if (!sc) return null;
      if (Array.isArray(sc)) return sc;
      return sc[type] || null;
    };

    const exactSectionKeys = [];
    
    // Every provision the query names, in one grammar: unit word (English or
    // Urdu), number and letter suffix together. Splitting this into three regexes
    // is what read "Section 489-F" as provision "489".
    const provisionTypeOf = type => (type === 'SECTION' || type === 'ARTICLE' ? type : null);
    for (const ref of findProvisionRefs(query)) {
      const type = provisionTypeOf(ref.type);
      exactSectionKeys.push({ key: ref.key, type, docIds: numericScope(type) });
    }
    // Bare / lettered provision references cited WITHOUT the word "section" or
    // "article" (e.g. "22-A", "22A", "498-A", "336-B"). The shared grammar above
    // only fires when the qualifier word is present, so a provision cited by
    // number+letter alone must still be picked up here. We accept a 1-3 digit
    // number glued to, or hyphen/space-joined with, an a-f suffix and normalise it
    // to the corpus key form (lowercase, no separator): "22-A" -> "22a". The
    // trailing word boundary prevents partial-word false positives ("22 and" ->
    // 'a' of "and" is rejected).
    const bareProvisionRegex = /\b(\d{1,3})[\s-]?([a-fA-F])\b/gi;
    let bMatch;
    while ((bMatch = bareProvisionRegex.exec(lowercaseQuery)) !== null) {
      exactSectionKeys.push({ key: `${bMatch[1]}${bMatch[2].toLowerCase()}`, type: 'SECTION', docIds: numericScope('SECTION') });
    }
    // Match FIR-related procedure keys
    if (/\b(fir)\b/i.test(lowercaseQuery) || query.includes('ایف آئی آر')) {
      exactSectionKeys.push({ key: 'fir_procedure', type: 'SECTION' });
      exactSectionKeys.push({ key: 'fir_refusal_remedy', type: 'SECTION' });
      exactSectionKeys.push({ key: '154', type: 'SECTION', docIds: ['crpc_1898'] });
    }
    // Match bail procedure keys
    if (/\b(bail|zamanat)\b/i.test(normalizedQuery) || /ضمانت/.test(query)) {
      exactSectionKeys.push({ key: 'bail_procedure', type: 'SECTION' });
      exactSectionKeys.push({ key: '496', type: 'SECTION', docIds: ['crpc_1898'] });
      exactSectionKeys.push({ key: '497', type: 'SECTION', docIds: ['crpc_1898'] });
      exactSectionKeys.push({ key: '498a', type: 'SECTION', docIds: ['crpc_1898'] });
    }
    // The BISP programme record is one document with thirteen sections under one
    // document-level lift, and the lift cannot choose between them: measured, a
    // bereaved family asking which documents to take ranked the portal-functions
    // and grievance sections above the heir section that names them. The ask
    // itself picks the section.
    const namesBisp = /\b(bisp|8171|kafalat|kifalat|benazir income)\b/i.test(lowercaseQuery) || /بینظیر|کفالت/.test(query);
    if (namesBisp && /(death|died|die |passed away|deceased|heir|widow|maut|وفات|موت)/i.test(lowercaseQuery)) {
      exactSectionKeys.push({ key: 'next_of_kin', type: 'SECTION' });
    }
    if (namesBisp && /(complaint|grievance|deduction|katoti|shikayat|helpline|report|fraud)/i.test(lowercaseQuery)) {
      exactSectionKeys.push({ key: 'grievance_channel', type: 'SECTION' });
    }
    // Match case-law keys
    if (domain === 'case-law') {
      if (/benazir/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_benazir_bhutto_v_federation', type: 'SECTION' });
      } else if (/darshan/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_darshan_masih_v_state', type: 'SECTION' });
      } else if (/shehla/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_shehla_zia_v_wapda', type: 'SECTION' });
      } else if (/nawaz/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_muhammad_nawaz_sharif', type: 'SECTION' });
      } else if (/asma|jilani/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_asma_jilani', type: 'SECTION' });
      } else if (/zulfiqar|bhutto/i.test(lowercaseQuery) && !/benazir/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_zulfiqar_ali', type: 'SECTION' });
      } else if (/mehrunisa|mehrunnisa|inheritance/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_mehrunnisa', type: 'SECTION' });
      } else if (/rehman|honour/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_rehman_girls', type: 'SECTION' });
      } else if (/lal.?masjid/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_lal_masjid', type: 'SECTION' });
      } else if (/transgender/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_transgender', type: 'SECTION' });
      } else if (/al.?jihad/i.test(lowercaseQuery)) {
        exactSectionKeys.push({ key: 'case_inamul_haq', type: 'SECTION' });
      }
    }
    // Case-name keys independent of domain: a query mentioning a landmark
    // case should boost that case even when the router chose a different
    // domain (e.g. "honour killing case" routes to criminal via 'killing').
    if (/\b(rehman|honour.?killing)\b/i.test(lowercaseQuery)) {
      exactSectionKeys.push({ key: 'case_rehman_girls', type: 'SECTION' });
    }
    if (/\b(asma|jilani)\b/i.test(lowercaseQuery)) {
      exactSectionKeys.push({ key: 'case_asma_jilani', type: 'SECTION' });
    }
    if (/\b(mehrunisa|wirasat)\b/i.test(lowercaseQuery) || (/\b(inheritance|women)\b/i.test(lowercaseQuery) && /\b(case|custom|share)\b/i.test(lowercaseQuery))) {
      exactSectionKeys.push({ key: 'case_mehrunnisa', type: 'SECTION' });
    }
    if (/\b(zulfiqar|bhutto)\b/i.test(lowercaseQuery) && !/\bbenazir\b/i.test(lowercaseQuery)) {
      exactSectionKeys.push({ key: 'case_zulfiqar_ali', type: 'SECTION' });
    }
    if (/\b(lal.?masjid)\b/i.test(lowercaseQuery)) {
      exactSectionKeys.push({ key: 'case_lal_masjid', type: 'SECTION' });
    }
    if (/\b(case_suo_motu_raj|disabilities)\b/i.test(lowercaseQuery)) {
      exactSectionKeys.push({ key: 'case_suo_motu_raj', type: 'SECTION' });
    }
    if (/\b(habeas|missing|enforced disappearance)\b/i.test(lowercaseQuery)) {
      exactSectionKeys.push({ key: 'case_suo_motu_1', type: 'SECTION' });
    }

    // Blanket fundamental-rights / constitutional queries (no specific
    // article/section number, no student-specific intent) must surface the
    // dedicated fundamental-rights corpus instead of tangential documents
    // (e.g. the student-rights doc which used to outrank it via boilerplate
    // rewrite terms). Rights queries that also ask for case-law are steered
    // to the landmark fundamental-rights judgments in the corpus.
    const docBoostIds = [];
    const hasConcreteProvision = /(?:article|art|آرٹیکل)\s*\d|(?:section|sec|دفعہ)\s*\d/i.test(lowercaseQuery);
    const isStudentSpecific = /\b(students?|university|school|college|fee|scholarship|hostel|exam|teacher|discipline)\b/i.test(normalizedQuery);
    const asksForCaseLaw = /\b(cases?|judgments?|judgements?|verdict|precedent|petition|decision|decisions|citation|suo.?motu)\b/i.test(lowercaseQuery);
    const isProcedureIntent = /\b(procedure|tareeqa|how|steps|filing|process|kaise|darj|apply)\b/i.test(lowercaseQuery);
    if (domain === 'rights' && !hasConcreteProvision && !isStudentSpecific) {
      if (asksForCaseLaw && !isProcedureIntent) {
        // Landmark judgments on fundamental / constitutional rights
        ['case_asma_jilani', 'case_shehla_zia_v_wapda', 'case_darshan_masih_v_state',
         'case_benazir_bhutto_v_federation', 'case_mehrunnisa', 'case_education_rights',
         'case_transgender'].forEach(k => exactSectionKeys.push({ key: k, type: 'SECTION' }));
        docBoostIds.push('fundamental_rights');
      } else if (isProcedureIntent) {
        // Remedy-pathway intent (e.g. "writ petition procedure"): procedures
        // over precedents
        docBoostIds.push('court_procedures', 'expanded_procedures');
      } else {
        // Direct rights queries: lift the rights corpus + Constitution Part II
        docBoostIds.push('fundamental_rights', 'constitution_1973');
      }
      if (/\b(women|woman|female|khawateen|aurat)\b/i.test(normalizedQuery)) {
        docBoostIds.push('women_protection_laws');
      }
    }

    // Statute-intent cyber queries (the law itself, not the complaint/report
    // route) surface the PECA sections directly; the remedies/institutions
    // docs keep priority when the user asks how/where to complain.
    const isComplaintIntent = /\b(complain|report|helpline|procedure|kahan|darj|file)\b/i.test(lowercaseQuery);
    if (domain === 'cyber' && !hasConcreteProvision && !isComplaintIntent && /\b(peca|cybercrime|act|law|section|stalk|harass\w*|bully|blackmail)\b/i.test(normalizedQuery)) {
      docBoostIds.push('peca_2016');
    }
    // Social-media identity abuse names no provision but is answered by the
    // identity-information (s.13) and false-information/reputation (s.24)
    // records. Without this, the semantic channel lifted an unrelated HEC
    // faculty record to the top of a cyber-routed query.
    if (domain === 'cyber' && /\b(fake|profile|identity|impersonat|social media|picture|photo|image)\b/i.test(normalizedQuery)) {
      exactSectionKeys.push(
        { key: '13', type: 'SECTION', docIds: ['peca_2016'] },
        { key: '24', type: 'SECTION', docIds: ['peca_2016'] },
        // Identity abuse is also a reportable offence: lift the corpus's own FIA
        // complaint-channel record so the answer can name where to complain
        // instead of stopping at the punishment clause.
        { key: 'fia_complaint_procedure', type: 'SECTION' }
      );
    }

    // Domain-scoped ranking: routed domains lift their own corpus documents so
    // tangential chunks (remedies, unrelated statutes) cannot outrank the
    // correct domain on keyword noise (e.g. "Salary nahi mil rahi" must land
    // on labour docs, not the police-refusal remedy).
    const domainDocs = DOMAIN_DOCS[domain] || [];
    domainDocs.forEach(d => { if (!docBoostIds.includes(d)) docBoostIds.push(d); });

    // Extra targeted boosts for queries that need to differentiate between docs
    // within the same domain (e.g. SC judgments vs HC fulltext, index vs fulltext).
    const extraDocBoostMap = {};

    // Jurisdiction/institution cue (education). This runs OUTSIDE the
    // domain === 'education' block because a Sindh scholarship question routes
    // to social-protection and a Hyderabad discipline question to another
    // domain; the named jurisdiction is the signal that must lift the provincial
    // or institutional record above the national HEC policy that shares the
    // topic word.
    //
    // Every cue below is tested against BOTH scripts. The Latin-only gates were
    // measurably blind: an Urdu-script "Balochistan higher education rules" or
    // "Sindh HEC recognised institutions" question received no cue at all and was
    // answered from the Protection of Women Act or the GCU Hyderabad digest.
    const REGION_UR = {
      sindh: /سندھ/,
      punjab: /پنجاب/,
      kp: /خیبر\s*پختونخوا|پختونخوا|پشاور/,
      balochistan: /بلوچستان/,
      ajk: /آزاد\s*جموں|اے\s*جے\s*کے/,
      gb: /گلگت\s*بلتستان|گلگت|بلتستان/,
      ict: /اسلام\s*آباد|وفاقی|وفاق/,
    };
    const EDU_SUBJECT_UR = /تعلیم|ہائر\s*ایجوکیشن|یونیورسٹی|کالج|داخلہ|امتحان|فیس|وظیفہ|سکالرشپ|قواعد|نوٹیفکیشن|پالیسی|شناخت/;
    const inRegion = (key, latinRe) => latinRe.test(normalizedQuery) || REGION_UR[key].test(query);
    const eduSubject = (latinRe) => latinRe.test(normalizedQuery) || EDU_SUBJECT_UR.test(query);

    // Out-of-region education guard (ranking only — no evidence threshold is
    // changed). `DOMAIN_DOCS.education` lifts every jurisdiction's education
    // record for any education query, so an Azad Jammu & Kashmir question was
    // measurably answered from GCU Hyderabad's Sindh rules. When the query names
    // a region, an education record bound to a DIFFERENT region is pushed out of
    // the window instead. Records with no province token in their jurisdiction
    // (Federal / National / "Federal & Provincial") are never penalised, because
    // national HEC policy does apply inside the named region.
    const REGION_LATIN = {
      sindh: /\b(sindh|hyderabad|karachi|sukkur|larkana|nawabshah|thatta|badin|jacobabad|mirpurkhas|sanghar|thar)\b/i,
      punjab: /\b(punjab|lahore|multan|faisalabad|rawalpindi|gujranwala|sargodha|bahawalpur|bahawalnagar|pakpattan|bhakkar|lodhran)\b/i,
      kp: /\b(khyber|pakhtunkhwa|\bkkp?\b|gkp|peshawar|abbottabad|abbotabad|mansehra|swat|chitral|\bdir\b|batagram|torghar)\b/i,
      balochistan: /\b(balochistan|quetta|g[w]adar|turbat|khuzdar|zhob|panjgur|kharan|dukki|mastung|harnai|nushki)\b/i,
      ajk: /\b(azad\s*jammu|azad\s*kashmir|\bajk\b|muzaffarabad|mirpur|bhimber|neelum|pooch)\b/i,
      gb: /\b(gilgit|baltistan|skardu|hunza|ghizer|diamer|astore)\b/i,
      ict: /\b(islamabad|\bict\b|mofept)\b/i,
    };
    const namedRegionKeys = Object.keys(REGION_LATIN).filter(k => inRegion(k, REGION_LATIN[k]));
    const REGION_OF_JURISDICTION = [
      [/sindh|hyderabad/i, 'sindh'],
      [/punjab|lahore|multan|faisalabad|rawalpindi|gujranwala|sargodha/i, 'punjab'],
      [/khyber|pakhtunkhwa|peshawar/i, 'kp'],
      [/balochistan|quetta/i, 'balochistan'],
      [/azad\s*jammu|azad\s*kashmir|\bajk\b|kashmir/i, 'ajk'],
      [/gilgit|baltistan/i, 'gb'],
      [/islamabad|federal\/ict|\bict\b/i, 'ict'],
    ];
    const regionOfJurisdiction = (jurisdiction) => {
      const j = String(jurisdiction || '');
      const hit = REGION_OF_JURISDICTION.find(([re]) => re.test(j));
      return hit ? hit[1] : null;
    };
    const educationDocIds = new Set(DOMAIN_DOCS.education || []);
    const foreignRegionEduPenalty = (chunk) => {
      if (namedRegionKeys.length === 0 || !educationDocIds.has(chunk.docId)) return 0;
      const region = regionOfJurisdiction(chunk.jurisdiction);
      if (!region || namedRegionKeys.includes(region)) return 0;
      return -15.0;
    };

    if (inRegion('sindh', /\bsindh\b/i) && eduSubject(/\b(hec|higher education|commission|scholarship|rule|regulation|act|university|public sector)\b/i)) {
      extraDocBoostMap['sindh_higher_education_laws'] = 25.0;
    }
    // Regional education cues. Each requires the region AND an education
    // context, so a generic national question is unaffected. The establishment
    // cue is one point above the Sindh document cue above because that document
    // is a scholarship register: without the lift a "criteria to establish a new
    // university" question is answered from scholarship eligibility text.
    if (inRegion('sindh', /\bsindh\b/i)
      && eduSubject(/\b(establish\w*|new (private )?(sector )?university|new campus|degree[- ]awarding|\bdais?\b|norms[- ]and[- ]standards)\b/i)) {
      extraDocBoostMap['sindh_hec_establishment_criteria'] = 26.0;
    }
    if ((inRegion('sindh', /\b(hyderabad|sindh)\b/i) || /\bhyderabad\b/i.test(normalizedQuery) || /حیدرآباد/.test(query))
      && eduSubject(/\b(recogni[sz]\w*|charter\w*|campus\w*|degree[- ]awarding|dai)\b/i)) {
      extraDocBoostMap['hec_recognized_campuses_sindh'] = 26.0;
    }
    if (inRegion('punjab', /\bpunjab\b/i)
      && eduSubject(/\b(higher education|college|university|hec|department|\bhed\b|\bhedp\b|scholarship|stipend|domicile|eligib\w*|fee|merit|admission|exam\w*)\b/i)) {
      if (/\b(notification|notified|order|holiday|vacation|closure|circular)\b/i.test(normalizedQuery) || /نوٹیفکیشن|اطلاع/.test(query)) {
        extraDocBoostMap['punjab_hed_notifications'] = 26.0;
      } else {
        extraDocBoostMap['punjab_hed_instruments'] = 26.0;
      }
    }
    if (inRegion('kp', /\b(khyber pakhtunkhwa|\bkp\b|gkp|peshawar)\b/i)
      && eduSubject(/\b(higher education|college|qac|notification|admission|associate degree|\bbs\b)\b/i)) {
      extraDocBoostMap['kp_qac_notifications'] = 26.0;
    }
    if (inRegion('balochistan', /\bbalochistan\b/i)
      && eduSubject(/\b(higher education|college|university|scholarship|technical|\bbchte\b|chte|bbise|enroll\w*|student)\b/i)) {
      extraDocBoostMap['baloch_chte_student_information'] = 26.0;
    }
    if (inRegion('ict', /\b(federal|mofept|islamabad|\bict\b)\b/i)
      && eduSubject(/\b(policy|policies|draft|non-?formal|\bnfe\b|education|strategy|framework)\b/i)) {
      extraDocBoostMap['federal_mofept_policies'] = 26.0;
    }
    if (inRegion('gb', /\b(gilgit|baltistan|\bgilgit-?baltistan\b)\b/i)
      && eduSubject(/\b(nomination|college|admission|seat|scholarship|categor\w*|criteria|domicile)\b/i)) {
      extraDocBoostMap['gb_doecgb_nominations'] = 26.0;
    }
    // AJK has no verified education instrument in the corpus, so there is
    // deliberately no AJK education cue: lifting `ajk_laws` (a constitutional
    // record) for an AJK scholarship question would answer an education question
    // from constitutional text. Such queries must fall to the evidence gate.
    // GCU Hyderabad's own published rules. The cue needs the institution, not just
    // "Hyderabad": a Hyderabad tenancy or cheque question must keep its records,
    // and "Hyderabad + recognised campus" must keep the campus register.
    if (/\b(gcuh?\b|government college university hyderabad|gcu hyderabad)\b/i.test(normalizedQuery)
      || (/\bhyderabad\b/i.test(normalizedQuery) && /\b(gcu|college university|university)\b/i.test(normalizedQuery))
      || /حیدرآباد/.test(query) && /(جی\s*سی\s*یو|گورنمنٹ کالج یونیورسٹی|یونیورسٹی|کالج)/.test(query)) {
      const otherGcuCity = /\b(lahore|faisalabad|sargodha|sukkur|larkana|bahawalpur|multan|\bgcuf\b|\bgcus\b)\b/i.test(normalizedQuery)
        || /(لاہور|فیصل آباد|سرگودھا|سکھر|لاڑکانہ|بہاولپور|ملتان)/.test(query);
      const gcuSubject = /\b(admission|merit|pre[- ]?entry|weightage|quota|fee|challan|refund|cancell\w*|attendance|examinat\w*|result|re[- ]?check|discipline|grievance|harassment|complaint|scholarship|financial aid|convocation|id card|bonafide|phd|mphil)\b/i.test(normalizedQuery)
        || /(داخلہ|فیس|حاضری|امتحان|شکایت|وظائف)/.test(query);
      if (!otherGcuCity && gcuSubject) {
        // The four institution-specific GCUH publications are the primary sources;
        // the older record is a multi-topic digest and must not outrank them.
        extraDocBoostMap['gcuh_admission_policy_2026_27'] = 28.0;
        extraDocBoostMap['gcuh_fee_structure_and_schedule'] = 27.5;
        extraDocBoostMap['gcuh_postgraduate_admission_rules'] = 27.5;
        extraDocBoostMap['gcuh_quality_governance_units'] = 26.5;
        extraDocBoostMap['gcuh_admissions_fees_examinations_rules'] = 27.0;
      }
    }
    // BISP's own programme records — Kafaalat, NSER, Taleemi Wazaif, Nashonuma and
    // the 8171 channels. These questions classify variously (social-protection,
    // civic, education), so the cue keys on the programme or channel name plus a
    // subject word and sits outside any single domain block.
    if (/\b(bisp|8171|kafaalat|kifalat|nashonuma|nser|taleemi|wazaif|benazir|proxy means test|\bpmt\b)\b/i.test(normalizedQuery)
      || /\b(bisp|8171)\b/.test(query)
      || /(بینظیر|کفالت|نشونما|تعلیمی\s*وظائف|اہلیت|محرومان)/.test(query)) {
      if (/\b(eligib\w*|cut[- ]?off|score|stipend|amount|installment|payment|register\w*|survey|roster|token|document|complaint|grievance|appeal|heir|death|deceased|deduction|suspend\w*|attendance|enrol\w*|bank|atm|biometric|verification|helpline|tehsil|time|timeline|transgender|inclusion|\bage\b|band|condition|compliance|withheld)\b/i.test(normalizedQuery)
        || /(شکایت|فارم|دستاویز|تصدیق|موظف|تأخیر)/.test(query)) {
        extraDocBoostMap['bisp_8171_programme_procedures'] = 27.0;
      }
    }
    // Section ordering INSIDE the BISP document. One record carries nineteen
    // sections, so a document-level lift alone still lets "why is part of my
    // Nashonuma amount held back" be answered from the 8171 portal section, and
    // "BISP ke liye registration kaise hoti hai" from the next-of-kin section.
    // The cue is gated on the question naming a BISP/8171 programme or channel,
    // so no BISP section is lifted for a passport or voter question, and the
    // lift only reorders chunks of the document the cue above already selected:
    // no evidence threshold, score floor or domain gate is involved.
    const BISP_DOC = 'bisp_8171_programme_procedures';
    const bispTopicAsked = /\b(bisp|8171|kafaalat|kifalat|kafalat|nashonuma|nser|taleemi|wazaif|benazir|proxy means test|\bpmt\b|khawaja sara|khawasa)\b/i.test(normalizedQuery)
      || /(بینظیر|کفالت|نشونما|تعلیمی\s*وظائف)/.test(query);
    const BISP_SECTION_CUES = [
      [/nashonuma|held back|withhold|compliance|90 ?percent|specialized nutrition|\bsnf\b|maamta|wawamum|immuniz|\bepi\b|anc|pnc|pregnan|lactat/, 'BISP_NASHONUMA_CONDITIONS_SNF_AND_WITHHELD_AMOUNTS'],
      [/transgender|inclusion|khawasa/, 'BISP_KAFALAAT_TRANSGENDER_INCLUSION'],
      [/\bage\b|age band|4 ?- ?12|8 ?- ?18|13 ?- ?22|primary|secondary|higher secondary|admission slip|self ?-? ?enroll|school/, 'BISP_TALEEMI_WAZAIF_AGE_BANDS_AND_SCHOOL_ADMISSION'],
      [/registration|register|enrol|application|documents?|form|b-?form|cnic|cut-?off|survey|roster|token|eligib|\bpmt\b|score|scale|fiscal/, 'BISP_KAFALAAT_REGISTRATION_STEPS'],
      [/complain|grievance|shikayat|helpline|0800|deduction|corruption|report|nahi mili|not received|delay|time|timeline|how long/, 'BISP_GRIEVANCE_CHANNEL_FOR_BENEFICIARIES'],
      [/status|check|track|portal|online|sms|website|verification/, 'BISP_8171_PORTAL_FUNCTIONS'],
      [/death|died|deceased|passed away|heir|waris|widow|inteqal/, 'BISP_NEXT_OF_KIN_DECEDED_BENEFICIARY'],
      [/stipend|qist|installment|amount|rs\.?\s?\d|how much|kitna|bank|atm|biometric|bvs|hbl|alfalah/, 'BISP_KAFALAAT_STIPEND_AMOUNT_AND_BANKS'],
      [/taleemi|wazaif|attendance|suspend|child/, 'BISP_TALEEMI_WAZAIF_ENROLMENT_AND_ATTENDANCE'],
      [/\bact\b|source|url|link|pdf|published|deadline|bidder|procurement|rti|information|contact|office phone|digital wallet/, 'BISP_SOURCE_AVAILABILITY_2026_10_18'],
    ];
    const bispSectionOrder = new Map();
    if (bispTopicAsked) {
      for (const [re, sectionKey] of BISP_SECTION_CUES) {
        if (re.test(normalizedQuery) || re.test(query)) {
          if (!bispSectionOrder.has(sectionKey)) bispSectionOrder.set(sectionKey, bispSectionOrder.size);
        }
      }
    }
    const bispSectionBoost = (chunk) => {
      if (!bispTopicAsked || chunk.docId !== BISP_DOC) return 0;
      const pos = bispSectionOrder.get(String(chunk.key || ''));
      if (pos === undefined) return 0;
      return 12.0 - pos * 0.5;
    };
    // A passport question that places itself inside Pakistan is about the in-person
    // Regional Passport Office procedure. DGIP's online-path record states the
    // overseas route first and the inland route second, so quoting it as the lead
    // paragraph gave a domestic applicant foreign-applicant framing while the
    // in-person record — the one that actually lists the documents to bring to the
    // office — sat third. Gated on the question naming a passport AND asserting a
    // domestic scope AND naming no foreign country or abroad context, so a genuine
    // overseas question keeps the consular evidence it already used.
    const passportAsked = /\bpassport\b/i.test(normalizedQuery) || /پاسپورٹ/.test(query);
    const domesticPassportAsked = passportAsked
      && /(پاکستان\s*میں)|\b(pakistan mein|in pakistan|inland|regional passport office)\b/i.test(`${query} ${normalizedQuery}`)
      && !/\b(saudi|arab|uae|dubai|qatar|oman|kuwait|bahrain|jordan|turkey|malaysia|china|uk|united kingdom|england|usa|united states|america|canada|australia|europe|schengen|gulf|abroad|overseas|consular|embassy|consulate)\b/i.test(normalizedQuery)
      && !/(سعودی|بیرون\s*ملک|غیرملکی|سفارتی|خارج)/.test(query);
    const domesticPassportBoost = (chunk) => (
      domesticPassportAsked && String(chunk.key || '') === 'CIVPROC_PASSPORT_IN_PERSON' ? 10.0 : 0
    );
    // A customer asking how to dispute money taken from their own account needs
    // the forum and the complaint channel, not the SBP's monetary-policy mandate.
    // The corpus holds two records that answer it — the Banking Court record in
    // the banking laws and the regulator record that names the Banking Mohtasib
    // — but both are short sections competing against longer general text, so
    // they are lifted at chunk level. Nothing is asserted beyond what those two
    // records state; the composer's limitation note names the gap.
    const bankingDisputeAsked = /\b(bank|banking|account)\b/i.test(normalizedQuery)
      && /\b(deduct\w*|debit\w*|wrongful\w*|unauthori[sz]ed|dispute\w*|refund\w*|reversal|revers(?:e|ed)|not\s+(?:return|refund)\w*|wapis|kaat\w*|kat\b|money\s+(?:taken|gone))\b/i.test(normalizedQuery);
    const bankingDisputeBoost = (chunk) => {
      if (!bankingDisputeAsked) return 0;
      const key = String(chunk.key || '');
      if (chunk.docId === 'banking_laws' && (key === '7' || /banking.?court/i.test(`${chunk.chunkTitle || ''} ${chunk.title || ''}`))) return 14.0;
      if (chunk.docId === 'public_offices' && key === 'OFFICE_REGULATORS') return 11.0;
      return 0;
    };
    // Education Equity records: each cue requires the question to name the
    // scheme, the authority or the disability subject itself, so an ordinary
    // scholarship or admission question keeps the evidence it already used.
    if (/\b(disabilit\w*|disabled|wheel[- ]?chair|accessib\w*|reasonable accommodation|special needs)\b/i.test(normalizedQuery)
      && /\b(student|university|universities|college|hec|higher education|study|accommodation)\b/i.test(normalizedQuery)) {
      extraDocBoostMap['hec_disability_policy'] = 26.0;
    }
    if (/\b(need[- ]based|\bnbs\b)\b/i.test(normalizedQuery)
      && /\b(scholarship|stipend|eligib\w*|apply|application|financial aid|financial assistance)\b/i.test(normalizedQuery)) {
      extraDocBoostMap['hec_need_based_scholarship'] = 26.0;
    }
    if (/\b(bait[- ]?ul[- ]?mal|\bpbm\b)\b/i.test(normalizedQuery)
      && /\b(education|stipend|school|college|university|technical|assist\w*|form|document\w*)\b/i.test(normalizedQuery)) {
      extraDocBoostMap['pbm_education_assistance'] = 26.0;
    }
    if (/\b(navttc|tvet|vocational|\bdae\b|pmysdp|nvqf|recognition of prior learning|technical training|training institute)\b/i.test(normalizedQuery)) {
      extraDocBoostMap['navttc_act_and_candidate_routes'] = 26.0;
    }
    if (/\b(gcu|gcuh|government college university)\b/i.test(normalizedQuery)
      || (/\bhyderabad\b/i.test(normalizedQuery) && /\b(college|university|campus|student|hostel|fee)\b/i.test(normalizedQuery))
      || /حیدرآباد/.test(query) && /(جی\s*سی\s*یو|گورنمنٹ کالج یونیورسٹی|یونیورسٹی|کالج)/.test(query)) {
      // "Government College University" is the shared name of several institutions.
      // A question that names Lahore, Faisalabad or any other city is not about
      // Hyderabad, so it must not pull Hyderabad's rules into the answer window.
      const otherGcuCity = /\b(lahore|faisalabad|sargodha|sukkur|larkana|bahawalpur|multan|\bgcuf\b|\bgcus\b|\bgcwp\b|peshawar|quetta|Rawalpindi)\b/i.test(normalizedQuery)
        || /(لاہور|فیصل آباد|سرگودھا|سکھر|لاڑکانہ|بہاولپور|ملتان|پشاور|کوئٹہ|راولپنڈی)/.test(query);
      if (!otherGcuCity) extraDocBoostMap['gcuh_institutional_rules'] = 15.0;
    }
    // Survivor-facing domestic-violence records. The family domain already
    // lifts women_protection_laws, but the protection route (Protection Officer,
    // shelter, interim orders, helpline 15) also lives in the remedies and
    // provincial fulltext documents, which share no domain membership with it.
    // Gated on the violence subject so an ordinary assault or rights question
    // keeps its own records.
    // "physically abusive" is the phrasing survivors actually use, and "abuse\w*"
    // never matched it — the whole protection route stayed unretrieved while the
    // maintenance clause of the same document answered for a violence question.
    if (/\b(domestic\s+violence|violen\w*|abus\w*|batter\w*)\b/i.test(normalizedQuery)
      && /\b(wife|husband|spouse|in[- ]?laws?|woman|women|aurat|biwi|shohar)\b/i.test(normalizedQuery)) {
      extraDocBoostMap['women_protection_laws'] = 13.0;
      extraDocBoostMap['expanded_remedies'] = 12.0;
      extraDocBoostMap['provincial_fulltext'] = 10.0;
    }
    // Unpaid wages: the recovery route (grievance notice, Labour Court, standing
    // orders) sits in the remedies and workflow records, not in the Labour
    // domain's own documents, so a "salary withheld" question was answered from
    // termination or minimum-wage text. The bank/cheque exclusion keeps a
    // salary-account charge question in the banking domain it was routed to.
    if (/\b(salary|wage|tankhwa|maheena|arrear\w*|pay)\b/i.test(normalizedQuery)
      && /\b(withh(?:o|e)ld\w*|unpaid|not\s+paid|non.?payment|arrear\w*|pending|due|deduct\w*|cut\s+(?:my|the)|rok\w*|nahi\s+mil|na\s+diya)\b/i.test(normalizedQuery)
      && !/\b(bank|banking|cheque|account|atm|sbp|state bank)\b/i.test(normalizedQuery)) {
      extraDocBoostMap['situation_remedies'] = 14.0;
      extraDocBoostMap['legal_workflows'] = 12.0;
    }
    if (domain === 'case-law') {
      if (/supreme.?court/i.test(normalizedQuery) && /independence|judiciary/i.test(normalizedQuery)) {
        extraDocBoostMap['sc_judgments'] = 5.0;
        extraDocBoostMap['expanded_case_law'] = 3.0;
      }
      if (/\b(list|index|recent|compilation|digest)\b/i.test(normalizedQuery) && /\b(writ petition|service|high court)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['lhc_index_2026'] = 5.0;
        extraDocBoostMap['ihc_index_2026'] = 5.0;
        extraDocBoostMap['phc_index_2026'] = 5.0;
        extraDocBoostMap['bhc_index_2026'] = 5.0;
      }
    }

    if (domain === 'education') {
      if (/\b(harass\w*|anti.?harass\w*|misconduct|abuse|focal person|inquiry committee)\b/i.test(normalizedQuery)
        && !/\b(transport|uni van|student bus|campus transport)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['edu_anti_harassment'] = 15.0;
      }
      // Stems cover every inflected form the student actually types ("suspended",
      // "expelled", "rusticated"); the noun-only list let "suspended unfairly"
      // fall through to the HEC welfare/whistleblower record.
      if (/\b(disciplinary|discipline|show.?cause|susp\w*|expel\w*|expulsion|rusticat\w*|debar\w*|ragging|hazing|misconduct.*notice)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['edu_discipline_grievance'] = 15.0;
      }
      if (/\b(exam\w*|examination|paper|recheck|re.?evaluat\w*|supplementary|backlog|unfair means|copying|paper leak|result|CGPA|GPA|mark.?sheet)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['edu_examination'] = 15.0;
      }
      if (/\b(scholarship|financial aid|stipend|waiver|concession|need.?based|merit.?based|ehsaas|bisp|zakat.*scholarship)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['edu_scholarships'] = 15.0;
      }
      if (/\b(hostel|accommodation|mess|warden|provost|hall of residence|hostel allotment)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['edu_hostel'] = 15.0;
      }
      if (/\b(admission|enroll\w*|merit list|fee refund|tuition|challan|provisional admission)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['edu_admissions_fees'] = 15.0;
      }
      // Degree-document services only. The bare collocation "HEC recognises"
      // also occurs in journal, online-degree and campus recognition questions,
      // which the Commission's own policy documents answer — this digest must
      // not capture them.
      if (/\b(degree\s*(?:attest\w*|equivale\w*|recogni\w*|verif\w*)|attest\w*\s*(?:by|from)\s*hec|transcript request|foreign degree|hec\s*attest\w*)\b/i.test(normalizedQuery)
        || /\b(degree|transcript|certificate)\b[^?]{0,40}\b(attest\w*|verif\w*|equivale\w*|transcript)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['hec_degree_recognition'] = 15.0;
      }
      if (/\b(transport|uni van|student bus|campus transport|route.*fee)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['edu_transport_safety'] = 15.0;
      }
      if (/\b(attendance|probation|academic integrity|plagiarism|course repeat|grading|CGPA|transcript)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['edu_academic_rules'] = 15.0;
      }
      if (/\b(student societ\w*|student union|student council|student organiz\w*|student election|health services|counselling|disability|student welfare)\b/i.test(normalizedQuery)) {
        extraDocBoostMap['edu_student_welfare'] = 15.0;
      }

      // The Commission's own policy documents are the primary authority for
      // higher-education rules, but they are long verbatim texts whose raw
      // lexical score loses to a short university-level digest on the same
      // topic. A topic match therefore lifts the owning HEC document two points
      // above the 15.0 the digest docs get — short digest chunks otherwise
      // out-score long verbatim policy text on the lexical channels by 2-3
      // points — and naming the Commission lifts it a further 1.5 so the primary
      // source, not the summary, answers "what is HEC's rule".
      const hecAuthorityLift = (/\b(hec|higher education commission)\b/i.test(normalizedQuery) || /ہیک/.test(query)) ? 3.5 : 2.0;
      const liftHec = (docId) => {
        extraDocBoostMap[docId] = Math.max(extraDocBoostMap[docId] || 0, 15.0 + hecAuthorityLift);
      };

      if (/\b(harass\w*|misconduct|abuse|focal person|inquiry committee|sexual)\b/i.test(normalizedQuery)
        && !/\b(transport|uni van|student bus|campus transport)\b/i.test(normalizedQuery)) {
        liftHec('hec_harassment_policy');
      }
      if (/\b(undergraduate|bachelor|bs|b\.?a\.?|b\.?sc\.?|b\.?com\.?|associate degree|credit hours?|semesters?|honors?|majors?|electives?|progres?ion|four.?year|two.?year)\b/i.test(normalizedQuery)) {
        liftHec('hec_ugep_undergraduate');
      }
      if (/\b(mphil|m\.?phil|ms\b|m\.?s\.?|phd|ph\.?d|doctoral|graduate program\w*|comprehensive exam|thesis proposal|defen[cs]e|research proposal|supervision|supervisor|credit hours.*graduate)\b/i.test(normalizedQuery)) {
        liftHec('hec_gep_graduate');
      }
      if (/\b(liberal arts|interdisciplinary|joint degree|double degree|dual degree)\b/i.test(normalizedQuery)) {
        liftHec('hec_laup_liberal_arts');
        liftHec('hec_ddjdp_joint_degrees');
      }
      if (/\b(admission test|sat|nat|gate test|entry test|test score|merit list|weighted merit)\b/i.test(normalizedQuery)) {
        liftHec('hec_etc_admission_tests');
      }
      if (/\b(recogni[sz]\w*|gazetted|unrecogni[sz]ed|unaccredited|illegal degree mill|institution|institutes?|campus\w*|sub.?campus|affiliat\w*|charter|establish\w* university)\b/i.test(normalizedQuery)) {
        liftHec('hec_institution_recognition');
      }
      if (/\b(attest\w*|verif\w*|apostille)\b/i.test(normalizedQuery)) {
        liftHec('hec_degree_attestation');
      }
      if (/\b(equivale\w*|o.?level|a.?level|hssc|intermediate|fsc|aicpas|deeni asnad|wdm|madrasah)\b/i.test(normalizedQuery)) {
        liftHec('hec_equivalence_services');
        if (/\b(deeni asnad|madrasah|aicpas|wolcome college)\b/i.test(normalizedQuery)) liftHec('hec_deeni_asnad_equivalence');
      }
      if (/\b(fee refund|refund\w*|reimburse\w*|cancel\w* admission|fee\w*.*not returned)\b/i.test(normalizedQuery)) {
        liftHec('hec_fee_refund_policy');
      }
      if (/\b(scholarships?|stipends?|financial aid|need.?based|merit.?based|ehsaas|bisp|zakat|loans?|grants?|fellowships?|waivers?|concessions?|support programs?)\b/i.test(normalizedQuery)) {
        liftHec('hec_student_support_programs');
      }
      if (/\b(disabilit\w*|special needs|accessib\w*|welfare|counsell?ing|grievance|complaint|ombudsman|appeal|drug|tobacco|smok\w*|medical|security|safety)\b/i.test(normalizedQuery)) {
        liftHec('hec_student_welfare_policies');
      }
      if (/\b(online (?:degree|education|program\w*|university)|distance learning|open learning|odl|virtual university|vaqf|async\w*|e.?learning)\b/i.test(normalizedQuery)) {
        liftHec('hec_odl_policy');
      }
      if (/\b(tne|transnational|foreign (?:universit\w*|campus\w*|institution\w*|program\w*)|joint program\w*|collaborat\w*|twinning|branch campus|study abroad program\w*)\b/i.test(normalizedQuery)) {
        liftHec('hec_tne_transnational');
      }
      if (/\b(quality assurance|qa framework|accredit\w*|evaluation of universities?|institutional evaluation|self.?assessment|visiting committee)\b/i.test(normalizedQuery)) {
        liftHec('hec_quality_assurance');
      }
      if (/\b(pqf|qualification framework|level \d+ (?:of|in the)|credit hour framework|learning outcomes)\b/i.test(normalizedQuery)) {
        liftHec('hec_pqf_qualifications');
      }
      if (/\b(curricul\w*|course outline|syllabus revision|program learning outcome|qf.?e|programme revision)\b/i.test(normalizedQuery)) {
        liftHec('hec_curriculum_revision');
      }
      if (/\b(plagiaris\w*|similarity (?:index|report|threshold)|turnitin|paper checking|copying)\b/i.test(normalizedQuery)) {
        liftHec('hec_anti_plagiarism');
      }
      if (/\b(chatgpt|gpt|ai.?generated|artificial intelligence|generative ai|llm|copilot|machine learning tool)\b/i.test(normalizedQuery)) {
        liftHec('hec_genai_academic_integrity');
      }
      if (/\b(journal|publication\w*|research|impact factor|hejri|pch\w*|incentive|paper\b|author\w*|hrc|faculty research)\b/i.test(normalizedQuery)) {
        liftHec('hec_research_publications');
      }
      if (/\b(faculty|lecturer|professor|assistant professor|associate professor|asc|minimum qualifications|hod|head of department|appointment|recruit\w*|phd supervisor)\b/i.test(normalizedQuery)) {
        liftHec('hec_faculty_appointment');
      }
      if (/\b(notifications?|amendments?|notified|effective from|dated|deadlines?|windows?|open|closing|expired|current)\b/i.test(normalizedQuery)) {
        liftHec('hec_notifications_register');
      }
    }

    // Match procedure keys for common queries
    if (/\b(procedure|tareeqa|kaise)\b/i.test(normalizedQuery)) {
      if (/\b(khula)\b/i.test(normalizedQuery)) exactSectionKeys.push({ key: 'khula_procedure', type: 'SECTION' });
      if (/\b(family|khandani)\b/i.test(normalizedQuery)) exactSectionKeys.push({ key: 'family_case_procedure', type: 'SECTION' });
      if (/\b(civil|dawa)\b/i.test(normalizedQuery)) exactSectionKeys.push({ key: 'civil_suit_procedure', type: 'SECTION' });
      if (/\b(criminal|jurm)\b/i.test(normalizedQuery)) exactSectionKeys.push({ key: 'criminal_trial_stages', type: 'SECTION' });
      if (/\b(cyber|online)\b/i.test(normalizedQuery)) exactSectionKeys.push({ key: 'cyber_complaint_procedure', type: 'SECTION' });
      if (/\b(consumer)\b/i.test(normalizedQuery)) exactSectionKeys.push({ key: 'consumer_complaint_steps', type: 'SECTION' });
      if (/\b(writ|petition)\b/i.test(normalizedQuery)) exactSectionKeys.push({ key: 'writ_petition_procedure', type: 'SECTION' });
      if (/\b(labour|labor|naukri)\b/i.test(normalizedQuery)) exactSectionKeys.push({ key: 'labour_court_procedure', type: 'SECTION' });
    }

    // 2. Fetch Query Embedding — LOCAL only. The runtime makes no external
    // embedding call; if the local embedder is unavailable the query is scored
    // by keyword / TF-IDF alone.
    // Embedding uses BOTH the original query and the domain rewrite: the
    // original keeps the user's sharp intent (rewrite tokens can diffuse the
    // vector toward generic domain chunks), while the rewrite helps vocabulary
    // alignment for vague queries. The scoring takes the MAX of the two
    // similarities, so whichever formulation matches a chunk better wins.
    let queryVectors = [];
    let localEmbedderUsed = false;
    const localEmbedder = await getLocalEmbedder();
    if (localEmbedder) {
      try {
        const origVec = await localEmbedder.embedQuery(query);
        if (origVec && Array.isArray(origVec) && origVec.length > 0 && origVec.some((x) => x !== 0)) {
          queryVectors.push(origVec);
          localEmbedderUsed = true;
        }
        if (rewrittenQuery && rewrittenQuery !== query) {
          const rwVec = await localEmbedder.embedQuery(rewrittenQuery);
          if (rwVec && Array.isArray(rwVec) && rwVec.length > 0 && rwVec.some((x) => x !== 0)) {
            queryVectors.push(rwVec);
          }
        }
      } catch (localErr) {
        console.warn('[RAG Engine] Local query embedding failed, using keyword retrieval:', localErr.message);
      }
    }
    // No external embedding call exists here: when the local embedder yields
    // nothing, scoring falls back to keyword / TF-IDF only.

    // A fee-refund question against the HEC policy must reach the records that
    // carry the operative refund rules (the published percentage schedule and the
    // refundable/non-refundable list). The lifted document's own cover pages
    // repeat "refund" far more often than the schedule does, so they scored
    // highest and — under the per-document slot cap — filled all three of its
    // slots, leaving the answer to quote a download page instead of the policy.
    const refundPolicyAsk = /\b(refund\w*|reimburse\w*|withdr(?:ew|aw|awn)|cancell?\w*\s+admission)\b/i.test(normalizedQuery)
      && /\b(university|college|hec|student|students|tuition|semester|fee)\b/i.test(normalizedQuery);
    // Operative records state the rule itself — the cancellation/withdrawal
    // entitlement and the dated percentage schedule. The policy's cover and
    // download pages repeat the word "refund" (and "refundable" in the contents
    // list) far more often, so they outscore the schedule lexically; they must
    // not be allowed to fill the document's slots in its place.
    const REFUND_OPERATIVE_RE = /Percentage of Fee|Upto\s+\d+(?:st|nd|rd|th)\s+day|canceling or withdrawing/i;

    // 3. Compute scores for all chunks
    const scoredChunks = idx.chunks.map(chunk => {
      let exactScore = 0;
      let vectorScore = 0;
      let tfIdfScore = 0;

      // Document-level boost for blanket domain queries so the
      // dedicated domain corpus ranks above tangential documents.
      // Weight lowered from 6.0 to 3.0 so the semantic channel (up to 4.0)
      // can outrank domain membership: with the local vector index live,
      // a semantically-perfect hit in another document must beat a generic
      // same-domain chunk (e.g. a civic workflow must beat consumer noise).
      // Within the lifted refund policy, the operative schedule/withdrawal record
      // is the answer; the cover pages only echo its vocabulary. The boost is
      // applied here so the record survives the per-document slot cap below.
      const refundOperative = refundPolicyAsk && chunk.docId === 'hec_fee_refund_policy'
        && REFUND_OPERATIVE_RE.test(String(chunk.text || chunk.content || ''));
      const docBoost = (docBoostIds.includes(chunk.docId) ? 3.0 : 0) + (extraDocBoostMap[chunk.docId] || 0) + foreignRegionEduPenalty(chunk) + bispSectionBoost(chunk) + domesticPassportBoost(chunk) + bankingDisputeBoost(chunk)
        + (refundOperative ? 20.0 : 0);

      // Exact key match — check against ALL exact section keys
      const chunkKeyClean = chunk.key.toLowerCase();
      for (const esk of exactSectionKeys) {
        // Numeric keys are scoped to the routed domain's documents
        if (esk.docIds && !esk.docIds.includes(chunk.docId)) continue;
        if (chunkKeyClean === esk.key && (esk.type === null || chunk.type === esk.type || chunk.type === 'GENERAL')) {
          exactScore = Math.max(exactScore, 15.0); // High boost for exact match
        } else if (!/^\d+[a-z]*$/i.test(esk.key) && (chunkKeyClean.includes(esk.key) || esk.key.includes(chunkKeyClean))) {
          // Substring boost only for text keys: numeric keys must match
          // exactly, otherwise "section 379" bleeds onto NAB sections 7/9
          exactScore = Math.max(exactScore, 8.0); // Substring match
        }
      }

      // Vector cosine similarity — MAX over the available query vectors
      // (original query + domain rewrite).
      if (queryVectors.length > 0 && chunk.vector && chunk.vector.length > 0) {
        const isMockVector = chunk.vector.every(val => val === 0);
        if (!isMockVector) {
          for (const qv of queryVectors) {
            vectorScore = Math.max(vectorScore, cosineSimilarity(qv, chunk.vector));
          }
        }
      }

      // TF-IDF Term overlap score (improved to avoid penalizing long chunks/expanded queries)
      const chunkTokens = chunk.tokens || [];
      const chunkTokenSet = new Set(chunkTokens);
      queryTokens.forEach(token => {
        if (chunkTokenSet.has(token)) {
          const idf = idx.idf[token] || 1.0;
          tfIdfScore += idf; // Just sum IDF for matched terms
        }
      });
      
      // Give small boost for title matches
      const titleTokens = tokenize(chunk.title || '').filter(t => queryTokens.includes(t));
      tfIdfScore += (titleTokens.length * 2.0);

      // Section-heading specificity. Every chunk of a statute shares the same
      // document title, so the title channel cannot separate "Adultery." from
      // "Definitions." — both are PPC 1860. A record whose own chunk heading
      // names a query subject term is a more specific answer than a general
      // clause; scaffolding words (punishment, law, Pakistan) are ignored so
      // this measures subject naming, not generic vocabulary overlap.
      const headingTokens = new Set(
        tokenize(chunk.chunkTitle || '').filter(t => queryTokens.includes(t) && !HEADING_GENERIC.has(t))
      );
      tfIdfScore += Math.min(headingTokens.size, 2) * 5.0;

      // Normalize tf-idf score softly (cap it so it plays nice with vector score)
      const tfIdfNormalized = Math.min(tfIdfScore / 10.0, 5.0);

      // Hybrid rank score formula — semantic channel weighted 4.0 (was 2.0)
      // now that the local vector index provides a strong, verified signal.
      const hybridScore = exactScore + (vectorScore * 4.0) + tfIdfNormalized + docBoost;

      return {
        ...chunk,
        exactScore,
        vectorScore,
        tfIdfScore: tfIdfNormalized,
        score: hybridScore
      };
    });

    // 4. Sort and filter by relevance threshold
    // A routed legal domain keeps the low 0.05 floor (its domain doc-boost and
    // rewrite already focus the match set). For an 'unknown' domain — where we
    // now intentionally run corpus-wide lexical retrieval — we raise the floor so
    // that only genuinely overlapping records survive. Near-noise hits (a shared
    // stopword scoring <2) are then dropped, and the caller correctly treats the
    // query as "insufficient verified context" (Phase 3 case C) instead of
    // confidently answering from an unrelated passage.
    const threshold = isDomainless ? 2.5 : 0.05;
    // Programme-relevance guard: a chunk may only be evidence FOR a named
    // programme if it actually names that programme. Without this, the
    // domainless BISP query returned HEC need-based / merit scholarship
    // chunks, which describe a different scheme and establish nothing about
    // BISP eligibility. Dropping them can leave zero chunks — that is the
    // honest outcome and the composer answers with a limitation notice.
    const relevantChunks = topicFilterTerms && topicFilterTerms.length
      ? scoredChunks.filter((c) => {
        const hay = `${c.text || c.content || ''} ${c.key || ''} ${c.title || ''} ${(c.tokens || []).join(' ')}`.toLowerCase();
        return topicFilterTerms.some((re) => re.test(hay));
      })
      : scoredChunks;
    const sorted = relevantChunks
      .filter(c => c.score >= threshold)
      .sort((a, b) => b.score - a.score);

    // Keep top-k (increased from 5 to 8 for richer context)
    // The HEC authority lift puts 17-18.5 points on EVERY chunk of one policy
    // document, so that document alone outranks the rest of the corpus by a wide
    // margin and would fill all 8 slots — the composer would then see 8 fragments
    // of one policy and no supporting record. Cap each lifted HEC document so it
    // leads but does not monopolise the window. Documents carrying the
    // pre-existing 15.0 digest lift are deliberately NOT capped: that is the
    // behaviour every non-HEC query was measured under before this corpus
    // existed, and narrowing a digest window loses the digest's own detail.
    const saturatedDocs = Object.keys(extraDocBoostMap).filter(d => extraDocBoostMap[d] > 15.0);
    const MAX_SLOTS_PER_LIFTED_DOC = 3;
    // When a refund question lifted the HEC refund policy, its operative records
    // compete for that document's slots — its cover/download pages do not.
    const operativeOnly = new Set();
    if (refundPolicyAsk) {
      const op = sorted.filter(c => c.docId === 'hec_fee_refund_policy' && REFUND_OPERATIVE_RE.test(String(c.text || '')));
      if (op.length) operativeOnly.add('hec_fee_refund_policy');
    }
    const topChunks = [];
    if (saturatedDocs.length === 0) {
      topChunks.push(...sorted.slice(0, 8));
    } else {
      const used = {};
      for (const c of sorted) {
        if (topChunks.length >= 8) break;
        if (saturatedDocs.includes(c.docId)) {
          if (operativeOnly.has(c.docId) && !REFUND_OPERATIVE_RE.test(String(c.text || ''))) continue;
          used[c.docId] = (used[c.docId] || 0) + 1;
          if (used[c.docId] > MAX_SLOTS_PER_LIFTED_DOC) continue;
        }
        topChunks.push(c);
      }
    }

    // Which documents the retrieval identified as the controlling instrument for
    // THIS question. The composer needs the decision, not just the score: a
    // supporting digest record that repeats generic words must not displace the
    // policy the retrieval ranked first, while two instruments may still be
    // ranked against each other on the question's own words.
    topChunks.forEach(c => { c.authorityLead = saturatedDocs.includes(c.docId); });

    // Phase 3 context-strength signal for the composer: it must distinguish
    //   high  (A) a strong, directly-grounded match  -> answer from it
    //   low   (B) weak/partial context              -> answer cautiously + clarify
    //   none  (C) nothing relevant (topChunks=0)    -> honest limitation response
    // "Strong" = an exact provision/case hit (exactScore>=8) or a high hybrid
    // score (>=6, e.g. domain-boosted provisions, title + keyword agreement).
    const topScore = topChunks[0] ? topChunks[0].score : 0;
    const topExact = topChunks[0] ? (topChunks[0].exactScore || 0) : 0;
    const relevance = topChunks.length === 0 ? 'none' : (topExact >= 8.0 || topScore >= 6.0 ? 'high' : 'low');

    const embeddingMode = localEmbedderUsed ? 'semantic-local' : 'keyword-fallback';
    if (embeddingMode === 'keyword-fallback') {
      console.warn("[RAG Engine] Embedding generation unavailable. RAG is operating in keyword fallback mode.");
    }

    return {
      chunks: topChunks,
      isOfflineRetrieval: true,
      detectedLang,
      domain,
      relevance,
      embeddingMode
    };
  }

  /**
   * Phase 12 — Fact-pattern case similarity (semantic).
   * Ranks CASE-LAW chunks (documentType "Case Law" / "Case Study") against a
   * user's fact description using the local semantic embedder plus TF-IDF
   * overlap, and returns "potentially similar cases" — explicitly NOT a
   * determination that any retrieved case is the user's case.
   */
  static async findSimilarCases(query, { limit = 5 } = {}) {
    const idx = loadIndex();
    if (!idx || !idx.chunks || idx.chunks.length === 0) {
      return { similar: [], disclaimer: 'Index unavailable.', queryVectorUsed: false };
    }
    const caseChunks = idx.chunks.filter(
      (c) => c.documentType === 'Case Law' || c.documentType === 'Case Study'
    );
    if (caseChunks.length === 0) {
      return { similar: [], disclaimer: 'No case-law records indexed.', queryVectorUsed: false };
    }

    let queryVector = null;
    const embedder = await getLocalEmbedder();
    if (embedder) {
      try {
        const v = await embedder.embedQuery(String(query || ''));
        if (v && Array.isArray(v) && v.length > 0 && v.some((x) => x !== 0)) queryVector = v;
      } catch (err) {
        console.warn('[RAG Engine] Case-similarity query embedding failed, falling back to lexical overlap:', err.message);
      }
    }

    const qTokens = tokenize(String(query || ''));
    const scored = caseChunks
      .map((chunk) => {
        let vectorScore = 0;
        if (queryVector && chunk.vector && chunk.vector.length > 0 && !chunk.vector.every((val) => val === 0)) {
          vectorScore = cosineSimilarity(queryVector, chunk.vector);
        }
        const chunkTokenSet = new Set(chunk.tokens || []);
        let tfIdf = 0;
        qTokens.forEach((t) => {
          if (chunkTokenSet.has(t)) tfIdf += idx.idf[t] || 1.0;
        });
        const score = vectorScore * 2.0 + Math.min(tfIdf / 10.0, 5.0);
        return { chunk, vectorScore, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const similar = scored.map(({ chunk, score, vectorScore }) => ({
      id: chunk.id,
      docId: chunk.docId,
      title: chunk.title,
      chunkTitle: chunk.chunkTitle,
      key: chunk.key,
      court: isSelfReferentialAuthority(chunk.issuingAuthority) ? null : (chunk.issuingAuthority || null),
      jurisdiction: chunk.jurisdiction || null,
      similarityScore: Number(score.toFixed(4)),
      vectorScore: Number(vectorScore.toFixed(4)),
      excerpt: String(chunk.text || '').slice(0, 420)
    }));

    return {
      disclaimer:
        'Potentially similar cases based on semantic similarity of the described facts, legal issue, provisions, jurisdiction and court. ' +
        'This is NOT a determination that any of these cases is the same as yours; consult a qualified lawyer.',
      similar,
      queryVectorUsed: !!queryVector
    };
  }
}

// The shared language detector reads its everyday-content evidence from this
// glossary, so detection and query normalisation stay one inventory.
registerRomanGlossary(RAGEngine.ROMAN_URDU_MAP);
