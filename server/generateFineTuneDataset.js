// ============================================================================
// Insaaf AI — Fine-Tuning Dataset Generator
// ============================================================================
// Builds the supervised fine-tuning dataset (train/validation/test JSONL) for
// the future Pakistani Legal AI model from the verified content banks
// (server/fineTuneData/content1-5.js + offences.js). Every legal fact is
// grounded in the RAG corpus (rag/indexes/rag_index.json); the generator
// ABORTS if any source reference cannot be resolved against the corpus.
//
// Usage:  npm run dataset:generate
// Output: rag/training/train.jsonl, validation.jsonl, test.jsonl,
//         rag/training/dataset_manifest.json
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadCorpus, resolveRef } from './fineTuneData/refs.js';
import {
  OFFENCES, PECA_OFFENCES, SPECIAL_PUNISHMENTS,
  NUM_WORDS_UR, NUM_WORDS_ROM, PHRASE_MAP_UR, PHRASE_MAP_ROM,
  SCENARIOS, SCENARIO_STEPS,
} from './fineTuneData/offences.js';
import { CASES, PROCEDURES, RIGHTS, WORKFLOWS } from './fineTuneData/content1.js';
import { DEFINITIONS, DOC_DRAFTS, DOC_EXPLAIN, DOC_MISSING, TERMS } from './fineTuneData/content2.js';
import { CLASSIFY, FAMILY_MAP, REFUSALS, SOURCE_AWARE } from './fineTuneData/content3.js';
import { DOMAIN_QAS, LANGUAGE_TASKS, REMEDIES } from './fineTuneData/content4.js';
import {
  EXTRA_REFUSALS, EXTRA_CLASSIFY, EXTRA_SOURCE_AWARE, EXTRA_LANGUAGE,
  PARAPHRASES, EXTRA_SCENARIOS, EXTRA_SIMILAR, EXTRA_MISC,
} from './fineTuneData/content5.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../rag/training');

export const VALID_LANGUAGES = ['en', 'ur', 'roman_ur'];
export const VALID_DOMAINS = [
  'constitution', 'criminal_law', 'criminal_procedure', 'civil_procedure',
  'cybercrime', 'family_law', 'property', 'tenancy', 'labour', 'consumer',
  'education', 'legal_aid', 'court_procedure', 'case_law', 'documents', 'general',
];
export const VALID_TASKS = [
  'legal_qa', 'offence_punishment', 'fundamental_rights', 'legal_procedures',
  'situation_action', 'legal_remedies', 'case_law', 'similar_case',
  'legal_terminology', 'en_legal_answer', 'ur_legal_answer', 'rom_legal_answer',
  'document_explanation', 'document_drafting', 'source_aware', 'refusal',
  'domain_classification',
];

// ---------------------------------------------------------------------------
// Instruction templates (task x language)
// ---------------------------------------------------------------------------
const INSTR = {
  legal_qa: {
    en: 'Answer this Pakistani legal question concisely.',
    ur: 'پاکستانی قانون کے اس سوال کا مختصر جواب دیں۔',
    rom: 'Pakistani qanoon ke is sawal ka mukhtasar jawab dein.'
  },
  offence_punishment: {
    en: 'Answer this question about Pakistani law concisely, citing the legal source.',
    ur: 'پاکستانی قانون کے اس سوال کا مختصر جواب دیں اور قانونی ماخذ کا حوالہ دیں۔',
    rom: 'Pakistani qanoon ke is sawal ka mukhtasar jawab dein aur qanooni source ka hawala dein.'
  },
  fundamental_rights: {
    en: 'Answer this question about a fundamental right under the Constitution of Pakistan.',
    ur: 'آئین پاکستان کے تحت بنیادی حق سے متعلق اس سوال کا جواب دیں۔',
    rom: 'Aaeen-e-Pakistan ke tehat bunyadi haq se mutaliq is sawal ka jawab dein.'
  },
  legal_procedures: {
    en: 'Give the legal steps concisely.',
    ur: 'قانونی اقدامات مختصراً بیان کریں۔',
    rom: 'Qanooni qadam mukhtasar tor par bayan karein.'
  },
  legal_remedies: {
    en: 'Explain the available legal remedies concisely.',
    ur: 'دستیاب قانونی علاج مختصراً بیان کریں۔',
    rom: 'Dastiyab qanooni ilaaj mukhtasar tor par bayan karein.'
  },
  situation_action: {
    en: 'Give practical legal guidance for this situation.',
    ur: 'اس صورتِ حال کے لیے عملی قانونی رہنمائی دیں۔',
    rom: 'Is surat-e-haal ke liye amli qanooni rehnumai dein.'
  },
  case_law: {
    en: 'Answer this question about a reported Pakistani case concisely.',
    ur: 'کسی رپورٹ شدہ پاکستانی مقدمے سے متعلق اس سوال کا مختصر جواب دیں۔',
    rom: 'Kisi reported Pakistani case se mutaliq is sawal ka mukhtasar jawab dein.'
  },
  similar_case: {
    en: 'Explain whether a reported case is similar to this situation, without claiming exact equivalence.',
    ur: 'بتائیں کہ کیا کوئی رپورٹ شدہ مقدمہ اس صورتِ حال سے ملتا جلتا ہے، قطعی مماثلت کا دعویٰ کیے بغیر۔',
    rom: 'Batayen ke kya koi reported case is surat-e-haal se milta julta hai, bina exact barabari ka dawa kiye.'
  },
  legal_terminology: {
    en: 'Explain this Pakistani legal term simply.',
    ur: 'اس پاکستانی قانونی اصطلاح کو آسان الفاظ میں بیان کریں۔',
    rom: 'Is Pakistani qanooni istilah ko aasan alfaaz mein bayan karein.'
  },
  document_explanation: {
    en: 'Explain what this legal document requires.',
    ur: 'بتائیں کہ اس قانونی دستاویز کے لیے کیا درکار ہے۔',
    rom: 'Batayen ke is qanooni document ke liye kya darkar hai.'
  },
  source_aware: {
    en: 'Answer this question and cite the verified legal source.',
    ur: 'اس سوال کا جواب دیں اور تصدیق شدہ قانونی ماخذ کا حوالہ دیں۔',
    rom: 'Is sawal ka jawab dein aur tasdeeq shuda qanooni source ka hawala dein.'
  },
  refusal: {
    en: 'Answer based only on verified Pakistani legal source material.',
    ur: 'صرف تصدیق شدہ پاکستانی قانونی ماخذ کی بنیاد پر جواب دیں۔',
    rom: 'Sirf tasdeeq shuda Pakistani qanooni makhaz ki buniyad par jawab dein.'
  },
  domain_classification: {
    en: 'Classify this question into a single Pakistani legal domain.',
    ur: 'اس سوال کو ایک پاکستانی قانونی شعبے میں درجہ بند کریں۔',
    rom: 'Is sawal ko aik Pakistani qanooni shobay mein darja band karein.'
  }
};
const LANGKEY = { en: 'en', ur: 'ur', roman_ur: 'rom' };

// ---------------------------------------------------------------------------
// Offence punishment extraction (verbatim from corpus) + Urdu/Roman rendering
// ---------------------------------------------------------------------------
const ALLOW_WORDS = new Set(['or', 'and', 'with', 'for', 'a', 'an', 'of', 'to', 'in',
  'the', 'at', 'as', 'he', 'she', 'his', 'her', 'him', 'it', 'its', 'is', 'by', 'on',
  'up', 'so', 'if', 'no', 'not', 'any', 'be', 'this', 'that', 'such', 'who', 'each',
  'all', 'from', 'may', 'same', 'manner', 'has', 'been', 'but', 'shall']);

const LOCAL_PHRASE_UR = [
  ['or with both', 'یا دونوں'],
  ['and with both', 'اور دونوں'],
  ['or with rigorous imprisonment for a term which may extend to ', 'یا قیدِ بامشقت جو '],
  [', in addition to the punishment provided for the offence by the last preceding section', '، اس کے علاوہ پچھلی دفعہ میں اس جرم کے لیے مقرر کردہ سزا بھی ہوگی'],
  ['in the same manner as if he had forged such document', 'اسی طرح جیسے اس نے ایسی دستاویز خود جعل کی ہو'],
  ['death', 'سزائے موت'],
  ['or with ', 'یا '],
  [' and ', ' اور '],
  [' or ', ' یا ']
];
const LOCAL_PHRASE_ROM = [
  ['or with both', 'ya dono'],
  ['and with both', 'aur dono'],
  ['or with rigorous imprisonment for a term which may extend to ', 'ya sakht qaid jo '],
  [', in addition to the punishment provided for the offence by the last preceding section', ', is ke ilawa pichhli section mein is jurm ke liye muqarrar ki gayi saza bhi hogi'],
  ['in the same manner as if he had forged such document', 'usi tarah jaise us ne aisi dastaveez khud jaal ki ho'],
  ['death', 'saza-e-maut'],
  ['or with ', 'ya '],
  [' and ', ' aur '],
  [' or ', ' ya ']
];
const LOCAL_NUM_UR = {
  'six months': 'چھ ماہ', 'six years': 'چھ سال', 'eight years': 'آٹھ سال',
  'ten million': 'ایک کروڑ', 'fifty million': 'پانچ کروڑ', 'five hundred': 'پانچ سو', 'one hundred': 'ایک سو',
  'two hundred': 'دو سو', 'three hundred': 'تین سو', 'four hundred': 'چار سو',
  'one thousand': 'ایک ہزار', 'two thousand': 'دو ہزار', 'five thousand': 'پانچ ہزار',
  'ten thousand': 'دس ہزار', 'twenty thousand': 'بیس ہزار', 'fifty thousand': 'پچاس ہزار',
  'one hundred thousand': 'ایک لاکھ'
};
const LOCAL_NUM_ROM = {
  'six months': '6 mah', 'six years': '6 saal', 'eight years': '8 saal',
  'ten million': '1 crore', 'fifty million': '5 crore', 'five hundred': '500', 'one hundred': '100',
  'two hundred': '200', 'three hundred': '300', 'four hundred': '400',
  'one thousand': '1,000', 'two thousand': '2,000', 'five thousand': '5,000',
  'ten thousand': '10,000', 'twenty thousand': '20,000', 'fifty thousand': '50 hazar',
  'one hundred thousand': '1 lakh'
};

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const UR_PHRASES = [...LOCAL_PHRASE_UR, ...PHRASE_MAP_UR]
  .sort((a, b) => b[0].length - a[0].length);
const ROM_PHRASES = [...LOCAL_PHRASE_ROM, ...PHRASE_MAP_ROM]
  .sort((a, b) => b[0].length - a[0].length);
const UR_NUMS = { ...NUM_WORDS_UR, ...LOCAL_NUM_UR };
const ROM_NUMS = { ...NUM_WORDS_ROM, ...LOCAL_NUM_ROM };
const urNumKeys = Object.keys(UR_NUMS).sort((a, b) => b.length - a.length);
const romNumKeys = Object.keys(ROM_NUMS).sort((a, b) => b.length - a.length);

function renderLang(coreEn, phrases, nums, numKeys) {
  let s = String(coreEn);
  for (const [k, v] of phrases) s = s.replace(new RegExp(escRe(k), 'gi'), v);
  for (const k of numKeys) s = s.replace(new RegExp('\\b' + escRe(k) + '\\b', 'gi'), nums[k]);
  return s.replace(/\s+/g, ' ').trim();
}

function residualWords(coreEn, phrases, nums, numKeys) {
  let s = ' ' + String(coreEn).toLowerCase() + ' ';
  for (const [k] of phrases) s = s.split(k.toLowerCase()).join(' ');
  for (const k of numKeys) s = s.replace(new RegExp('\\b' + escRe(k.toLowerCase()) + '\\b', 'g'), ' ');
  const words = s.match(/[a-z]{2,}/g) || [];
  return [...new Set(words.filter((w) => !ALLOW_WORDS.has(w)))];
}

const SUBJECT_RE = [
  /^whoever\s+[\s\S]*?\bshall\s+be\s+punish(?:ed|able)\s+(?:with\s+)?/i,
  /^a\s+person\s+convicted\s+of\s+[a-z\s']+?\bshall\s+be\s+punish(?:ed|able)\s+(?:with\s+)?/i
];

function extractPunishment(text) {
  const frags = String(text).split(/[.;:]\s+/);
  for (const f of frags) {
    if (/^punishment\b/i.test(f.trim())) continue;
    if (/(shall be punish(ed|able)|punished with|liable to)/i.test(f)) {
      // Keep only the newline-separated piece that carries the trigger
      // (drops glued heading lines such as "Unauthorized access ...").
      const pieces = f.split(/\n+/);
      const hit = pieces.filter((p) => /(shall be punish(ed|able)|punished with|liable to)/i.test(p)).pop();
      let out = (hit || f).trim();
      const cut = out.search(/\bunless\b|\bprovided that\b/i);
      if (cut > 40) out = out.slice(0, cut).trim();
      return out.replace(/[,\s]+$/, '');
    }
  }
  return null;
}

function stripSubject(frag) {
  for (const re of SUBJECT_RE) {
    const m = String(frag).match(re);
    if (m) return String(frag).slice(m[0].length).replace(/\.\s*$/, '').trim();
  }
  return null;
}

const PPC_FULL = { en: 'the Pakistan Penal Code, 1860', ur: 'تعزیرات پاکستان 1860', rom: 'PPC 1860' };
const PECA_FULL = { en: 'the Prevention of Electronic Crimes Act, 2016', ur: 'الیکٹرانک کرائمز ایکٹ 2016', rom: 'PECA 2016' };
const PPC_SHORT = { en: 'PPC', ur: 'تعزیرات پاکستان', rom: 'PPC' };
const PECA_SHORT = { en: 'PECA', ur: 'پیکا', rom: 'PECA' };
const VERIFIED = { en: 'Verified', ur: 'تصدیق شدہ', rom: 'Verified' };
const SOURCE_WORD = { en: 'Source', ur: 'ماخذ', rom: 'Source' };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------------------
// Case translations (grounded in the CASES bank English fields)
// ---------------------------------------------------------------------------
const CASE_UR = {
  CASE_BENAZIR_BHUTTO_V_FEDERATION: 'اس مقدمے میں سپریم کورٹ نے قرار دیا کہ سیاسی جماعت بنانے اور اس کا رکن بننے کا حق آئین کے آرٹیکل 17 کے تحت بنیادی حق ہے۔ یہ مقدمہ سیاسی جماعتوں کے ذریعے سیاسی شراکت کو آئینی طور پر محفوظ قرار دیتا ہے۔',
  CASE_DARSHAN_MASIH_V_STATE: 'سپریم کورٹ نے ہر قسم کی جبری مشقت کو غیر آئینی اور آئین کے آرٹیکلز 9، 11 اور 14 کے تحت بنیادی حقوق کی خلاف ورزی قرار دیا، اور حکومت کو جبری مشقت کے خاتمے کے اقدامات کا حکم دیا۔',
  CASE_SHEHLA_ZIA_V_WAPDA: 'سپریم کورٹ نے آرٹیکل 9 کے تحت زندگی کے حق کی تشریح وسیع کرتے ہوئے صاف اور غیر آلودہ ماحول کا حق اس میں شامل کیا، اور واپڈا کو گرڈ اسٹیشن کا ماحولیاتی مطالعہ کرانے کا حکم دیا۔',
  CASE_PAKISTAN_V_PUBLIC_AT_LARGE: 'عدالت نے قرار دیا کہ جبری گمشدگیاں آئین کے آرٹیکلز 9، 10 اور 14 کی خلاف ورزی ہیں، اداروں کو لاپتہ افراد پیش کرنے کا حکم دیا، اور ایسے معاملات کے لیے کمیشن قائم کیا۔',
  CASE_KHAKI_V_RAWALPINDI: 'عدالت نے مخنث افراد کے بنیادی حقوق تسلیم کیے، جن میں شناخت، وقار، تعلیم اور وراثت کا حق شامل ہے، اور نادرا کو شناختی دستاویزات جاری کرنے کا حکم دیا۔',
  CASE_MAULVI_IQBAL_HAIDER: 'سپریم کورٹ نے عوامی اخراجات کی معلومات تک شہریوں کے حق کو برقرار رکھا اور شفافیت کو خوش انتظامی کے لیے ضروری قرار دیا۔ یہ مقدمہ آئین کے آرٹیکل 19-اے کے تحت معلومات کے حق کی حمایت کرتا ہے۔',
  CASE_SALMAN_AKRAM_RAJA: 'سپریم کورٹ نے توثیق کی کہ آئین کا آرٹیکل 10-اے ہر شخص کو منصفانہ ٹرائل کا حق دیتا ہے، اور یہ حق خصوصی طریقہ ہائے کار سے اس وقت تک محدود نہیں کیا جا سکتا جب تک وہ انصاف کے کم از کم معیار پورے نہ کریں۔',
  CASE_IMRANA_TIWANA: 'سپریم کورٹ نے قرار دیا کہ عوامی پارک اور سبزہ زار شہریوں کے لیے امانت ہیں اور انہیں تجارتی یا نجی نہیں بنایا جا سکتا۔',
  CASE_MUHAMMAD_NAWAZ_SHARIF: 'سپریم کورٹ نے قومی اسمبلی بحال کر دی اور قرار دیا کہ صدر تحلیل کے لیے مناسب بنیادیں ثابت کرنے میں ناکام رہے، اس طرح اسمبلی کی تحلیل پر عدالتی نظرثانی کا اختیار استعمال کیا۔',
  CASE_STUDY_1_FIR_REFUSAL: 'یہ کیس اسٹڈی بتاتی ہے کہ جب پولیس ایف آئی آر درج کرنے سے انکار کرے تو ضابطہ فوجداری کی دفعات 22-اے/22-بی کے تحت جسٹس آف پیس کے ذریعے ایف آئی آر درج کرائی جا سکتی ہے۔',
  CASE_STUDY_2_CYBER_STALKING: 'یہ کیس اسٹڈی آن لائن اسٹاکنگ اور بلیک میلنگ میں پیکا 2016 کے تحت سزا کا ایک واقعہ بیان کرتی ہے، جس میں اسکرین شاٹس کے ذریعے محفوظ کردہ ڈیجیٹل ثبوت اور ایف آئی اے سائبر کرائم ونگ کو شکایت نے مدد فراہم کی۔',
  CASE_STUDY_3_TENANCY_EVICTION: 'یہ کیس اسٹڈی بتاتی ہے کہ کرایہ دار نے پنجاب رینٹڈ پریمسز ایکٹ 2009 کے تحت رینٹ کنٹرولر کے ذریعے یوٹیلیٹیز منقطع کرنے اور بے دخلی کے خلاف تحفظ حاصل کیا، اور یہ کہ کرایہ دار کو صرف قانونی رینٹ کنٹرولر کے عمل سے ہی بے دخل کیا جا سکتا ہے۔'
};
const CASE_ROM = {
  CASE_BENAZIR_BHUTTO_V_FEDERATION: 'Is case mein Supreme Court ne qarar diya ke political party banane aur us ka rukan banne ka haq Aaeen ke Article 17 ke tehat bunyadi haq hai. Yeh case political parties ke zariye siyasi shirkat ko aaeeni tor par mehfooz qarar deta hai.',
  CASE_DARSHAN_MASIH_V_STATE: 'Supreme Court ne har qisam ki jabri mashaqqat ko ghair aaeeni aur Aaeen ke Articles 9, 11 aur 14 ke tehat bunyadi haqooq ki khilaf warzi qarar diya, aur hukoomat ko jabri mashaqqat ke khatmay ke iqdamaat ka hukm diya.',
  CASE_SHEHLA_ZIA_V_WAPDA: 'Supreme Court ne Article 9 ke tehat zindagi ke haq ki tashreeh wasee karte hue saaf aur ghair aalooda mahaul ka haq is mein shamil kiya, aur WAPDA ko grid station ka maholiyati mutalia karane ka hukm diya.',
  CASE_PAKISTAN_V_PUBLIC_AT_LARGE: 'Court ne qarar diya ke jabri gumshudgiyan Aaeen ke Articles 9, 10 aur 14 ki khilaf warzi hain, idaron ko lapata afraad pesh karne ka hukm diya, aur aise mamlaat ke liye commission qaem kiya.',
  CASE_KHAKI_V_RAWALPINDI: 'Court ne transgender afraad ke bunyadi haqooq tasleem kiye, jin mein shanakht, waqar, taleem aur wirasat ka haq shamil hai, aur NADRA ko shanakhti dastawezaat jari karne ka hukm diya.',
  CASE_MAULVI_IQBAL_HAIDER: 'Supreme Court ne awaami akhrajat ki maloomat tak shehriyon ke haq ko barqarar rakha aur shafafiyat ko khoob intizami ke liye zaroori qarar diya. Yeh case Aaeen ke Article 19-A ke tehat maloomat ke haq ki himayat karta hai.',
  CASE_SALMAN_AKRAM_RAJA: 'Supreme Court ne tasdeeq ki ke Aaeen ka Article 10-A har shakhs ko munsifana trial ka haq deta hai, aur yeh haq khusoosi tareeqa haaye kaar se us waqt tak mehdood nahi kiya ja sakta jab tak woh insaf ke kam az kam miyaar poore na karein.',
  CASE_IMRANA_TIWANA: 'Supreme Court ne qarar diya ke awaami parks aur sabza zaar shehriyon ke liye amanat hain aur unhein commercial ya private nahi banaya ja sakta.',
  CASE_MUHAMMAD_NAWAZ_SHARIF: 'Supreme Court ne qaumi assembly bahal kar di aur qarar diya ke President inhilaal ke liye munasib bunyadein sabit karne mein nakam rahe, is tarah assembly ke inhilaal par adalti nazar-e-sani ka ikhtiyar istemal kiya.',
  CASE_STUDY_1_FIR_REFUSAL: 'Yeh case study batati hai ke jab police FIR darj karne se inkar kare to CrPC Sections 22-A/22-B ke tehat Justice of Peace ke zariye FIR darj karai ja sakti hai.',
  CASE_STUDY_2_CYBER_STALKING: 'Yeh case study online stalking aur blackmailing mein PECA 2016 ke tehat saza ka aik waqia bayan karti hai, jis mein screenshots ke zariye mehfooz ki gayi digital saboot aur FIA Cybercrime Wing ko shikayat ne madad faraham ki.',
  CASE_STUDY_3_TENANCY_EVICTION: 'Yeh case study batati hai ke kirayedar ne Punjab Rented Premises Act 2009 ke tehat Rent Controller ke zariye utilities munqata karne aur be dakhli ke khilaf tahaffuz hasil kiya, aur yeh ke kirayedar ko sirf qanooni Rent Controller ke amal se hi be dakhal kiya ja sakta hai.'
};

// ---------------------------------------------------------------------------
// Domain mapping helpers
// ---------------------------------------------------------------------------
const WF_DOMAINS = {
  WF_FIR: 'criminal_procedure', WF_REFUSAL: 'criminal_procedure',
  WF_COMPLAINT: 'criminal_procedure', WF_ARREST: 'criminal_procedure',
  WF_REMAND: 'criminal_procedure', WF_BAIL_POST: 'criminal_procedure',
  WF_PRE_BAIL: 'criminal_procedure', WF_TRIAL: 'criminal_procedure',
  WF_CIVIL: 'civil_procedure', WF_FAMILY: 'family_law', WF_CUSTODY: 'family_law',
  WF_MAINT: 'family_law', WF_TENANCY: 'tenancy', WF_PROPERTY: 'property',
  WF_CONSUMER: 'consumer', WF_LABOUR: 'labour', WF_CYBER: 'cybercrime',
  WF_HARASS: 'labour', WF_AID: 'legal_aid', WF_APPEAL: 'court_procedure'
};

const SCEN_TOPIC_DOMAINS = {
  fir_refusal: 'criminal_procedure', threat: 'criminal_law',
  online_blackmail: 'cybercrime', landlord_deposit: 'tenancy',
  employer_salary: 'labour', cnic_misuse: 'cybercrime'
};

const PARA_TOPIC_DOMAINS = {
  'offence_punishment': 'criminal_law',
  'legal_procedures': 'criminal_procedure',
  'legal_remedies': 'general',
  'legal_qa': 'general'
};
const PARA_TOPIC_OVERRIDES = {
  'hacking': 'cybercrime', 'cyber_stalking': 'cybercrime', 'identity_misuse': 'cybercrime',
  'khula': 'family_law',
  'cyber_blackmail': 'cybercrime', 'deposit': 'tenancy', 'unpaid_wages': 'labour',
  'cnic_misuse': 'cybercrime', 'defective_product': 'consumer', 'eviction': 'tenancy',
  'polygamy': 'family_law', 'iddat': 'family_law', 'talaq_notice': 'family_law',
  'inheritance': 'property', 'fee_refund': 'education', 'consumer_rights': 'consumer',
  'child_custody': 'family_law', 'nafaqa': 'family_law', 'fir_meaning': 'criminal_procedure'
};

const MISC_TOPIC_DOMAINS = {
  legal_aid: 'legal_aid', hr_cell: 'constitution', inteqal: 'property',
  nikah_nama: 'family_law', citizen_portal: 'general', eobi: 'labour',
  arbitration_council: 'family_law', utility_cutoff: 'tenancy',
  consumer_fee: 'consumer', family_reconciliation: 'family_law'
};

const SIM_TOPIC_DOMAINS = {
  political_party: 'constitution', bonded_labour: 'constitution',
  grid_station_health: 'constitution', missing_person: 'constitution',
  transgender_rights: 'constitution', public_spending_info: 'constitution',
  park_commercialization: 'constitution', fir_refusal_case: 'criminal_procedure'
};

function domainFromRefs(refs) {
  const text = (refs || []).join(' ');
  if (/\bPPC\b/.test(text)) return 'criminal_law';
  if (/\bCrPC\b/.test(text)) return 'criminal_procedure';
  if (/\bCPC\b/.test(text)) return 'civil_procedure';
  if (/Constitution/.test(text)) return 'constitution';
  if (/PECA/.test(text)) return 'cybercrime';
  if (/Muslim Family|Family Courts|Guardians/.test(text)) return 'family_law';
  if (/Rented Premises/.test(text)) return 'tenancy';
  if (/Consumer|PSQCA/.test(text)) return 'consumer';
  if (/Labour|Wages|EOBI/.test(text)) return 'labour';
  if (/Registration Act|Mutation/.test(text)) return 'property';
  if (/DLAC|Legal Aid|Human Rights Cell|Bar Council/.test(text)) return 'legal_aid';
  return 'general';
}

function domainFromClassifyOutput(output) {
  const m = String(output).match(/domain:\s*([a-z_]+)/);
  return m && VALID_DOMAINS.includes(m[1]) ? m[1] : 'general';
}

// ---------------------------------------------------------------------------
// Split helpers
// ---------------------------------------------------------------------------
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const toks = (s) => new Set(String(s).toLowerCase()
  .split(/[^a-z0-9\u0600-\u06FF]+/)
  .filter((t) => t.length > 1 || /[0-9\u0600-\u06FF]/.test(t)));
function jaccardSets(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
function jaccardStr(a, b) { return jaccardSets(toks(a), toks(b)); }

// ---------------------------------------------------------------------------
// Build all examples
// ---------------------------------------------------------------------------
const corpus = loadCorpus();
const examples = []; // {instruction,input,output,language,domain,task,source_refs,forceTest,splitKey,origin,id}
const skipped = [];  // rendering skips (ur/rom not clean)
let originCounter = {};

function add(entry, origin) {
  originCounter[origin] = (originCounter[origin] || 0) + 1;
  examples.push({ ...entry, origin, splitKey: entry.splitKey || (origin + ':' + (entry.id || entry.input) + ':' + entry.language) });
}

// --- 1. Offences (PPC + PECA): 2 question variants x 3 languages ---
{
  const offenceList = [
    ...OFFENCES.map((o) => ({ ...o, src: 'PPC', full: PPC_FULL, short: PPC_SHORT })),
    ...PECA_OFFENCES.map((o) => ({ ...o, src: 'PECA', full: PECA_FULL, short: PECA_SHORT }))
  ];
  const chunkFor = (o) => {
    const doc = o.src === 'PPC' ? 'ppc_1860' : 'peca_2016';
    return corpus.chunks.find((c) => c.docId === doc && String(c.key) === String(o.key));
  };
  for (const o of offenceList) {
    const chunk = chunkFor(o);
    const specialKey = o.special ? (o.src === 'PECA' ? 'peca:' + o.key : o.key) : null;
    const special = specialKey ? SPECIAL_PUNISHMENTS[specialKey] : null;
    const verbatim = special ? null : (chunk ? extractPunishment(chunk.text) : null);
    if (!special && !verbatim) {
      console.error('ABORT: no verbatim punishment extractable for ' + o.src + ' ' + o.key);
      process.exit(1);
    }
    const refs = [`${o.src} Section ${o.key}`,
      ...(o.defKey ? [`${o.src} Section ${o.defKey}`] : [])];
    const qEn = [`What is the punishment for ${o.en}?`, `What punishment does the law provide for ${o.en}?`];
    const qUr = [`${o.ur} کی سزا کیا ہے؟`, `قانون میں ${o.ur} کے لیے کیا سزا مقرر ہے؟`];
    const qRom = [`${o.rom} ki saza kya hai?`, `Qanoon mein ${o.rom} ke liye kya saza muqarrar hai?`];

    // English answers (verbatim grounded)
    const enBody = special
      ? `Under ${o.short.en} Section ${o.key}, ${o.en} is punishable with ${special.en}.`
      : `${cap(o.en)} is an offence under ${o.full.en} Section ${o.key}. ${verbatim}`;
    const enAns = `${enBody} ${SOURCE_WORD.en}: ${o.short.en} Section ${o.key} • ${VERIFIED.en}`;

    // Urdu / Roman: only when the verbatim renders cleanly
    let urAns = null, romAns = null;
    if (!special && verbatim) {
      const core = stripSubject(verbatim);
      if (core) {
        const resUr = residualWords(core, UR_PHRASES, UR_NUMS, urNumKeys);
        const resRom = residualWords(core, ROM_PHRASES, ROM_NUMS, romNumKeys);
        if (resUr.length === 0 && resRom.length === 0) {
          const coreUr = renderLang(core, UR_PHRASES, UR_NUMS, urNumKeys);
          const coreRom = renderLang(core, ROM_PHRASES, ROM_NUMS, romNumKeys);
          urAns = `${o.ur} ${o.full.ur} کی دفعہ ${o.key} کے تحت جرم ہے۔ سزا: ${coreUr}۔ ${SOURCE_WORD.ur}: ${o.short.ur} دفعہ ${o.key} • ${VERIFIED.ur}`;
          romAns = `${o.rom} ${o.full.rom} ke Section ${o.key} ke tehat jurm hai. Saza: ${coreRom}. ${SOURCE_WORD.rom}: ${o.short.rom} Section ${o.key} • ${VERIFIED.rom}`;
        } else {
          skipped.push(`${o.src} ${o.key} (${o.en}) ur/rom skipped — residual: ${[...resUr, ...resRom].join(', ')}`);
        }
      }
    } else if (special) {
      urAns = `${o.full.ur} کی دفعہ ${o.key} کے تحت ${o.ur} کی سزا ${special.ur} ہے۔ ${SOURCE_WORD.ur}: ${o.short.ur} دفعہ ${o.key} • ${VERIFIED.ur}`;
      romAns = `${o.full.rom} ke Section ${o.key} ke tehat ${o.rom} ki saza ${special.rom} hai. ${SOURCE_WORD.rom}: ${o.short.rom} Section ${o.key} • ${VERIFIED.rom}`;
    }

    for (let v = 0; v < 2; v++) {
      add({ instruction: INSTR.offence_punishment.en, input: qEn[v], output: enAns, language: 'en', domain: o.src === 'PECA' ? 'cybercrime' : 'criminal_law', task: 'offence_punishment', source_refs: refs, id: `off_${o.src}_${o.key}_en_v${v}` }, 'OFFENCES');
      if (urAns) add({ instruction: INSTR.offence_punishment.ur, input: qUr[v], output: urAns, language: 'ur', domain: o.src === 'PECA' ? 'cybercrime' : 'criminal_law', task: 'offence_punishment', source_refs: refs, id: `off_${o.src}_${o.key}_ur_v${v}` }, 'OFFENCES');
      if (romAns) add({ instruction: INSTR.offence_punishment.rom, input: qRom[v], output: romAns, language: 'roman_ur', domain: o.src === 'PECA' ? 'cybercrime' : 'criminal_law', task: 'offence_punishment', source_refs: refs, id: `off_${o.src}_${o.key}_rom_v${v}` }, 'OFFENCES');
    }
  }
}

// --- 2. Situation -> Action (SCENARIOS bank) ---
{
  const famRefs = {};
  for (const o of [...OFFENCES, ...PECA_OFFENCES]) {
    if (!famRefs[o.family]) famRefs[o.family] = [];
    const src = OFFENCES.includes(o) ? 'PPC' : 'PECA';
    famRefs[o.family].push(`${src} Section ${o.key}`);
    if (o.defKey) famRefs[o.family].push(`${src} Section ${o.defKey}`);
  }
  for (const sc of SCENARIOS) {
    const lead = FAMILY_MAP[sc.family];
    if (!lead) { console.error('ABORT: no FAMILY_MAP entry for ' + sc.family); process.exit(1); }
    const stepKey = sc.family === 'cyber' ? 'cyber' : sc.family === 'cheque' ? 'cheque' : 'general';
    const refs = [...new Set([...(famRefs[sc.family] || []),
      ...(stepKey === 'general' ? ['CrPC Section 154'] : stepKey === 'cyber' ? ['FIA Complaint Procedure'] : [])])];
    const domain = sc.family === 'cyber' ? 'cybercrime' : 'criminal_law';
    const langs = [{ lang: 'en', q: sc.en, lk: 'en' }, { lang: 'ur', q: sc.ur, lk: 'ur' }, { lang: 'roman_ur', q: sc.rom, lk: 'roman' }];
    for (const { lang, q, lk } of langs) {
      const steps = (SCENARIO_STEPS[stepKey][lk] || []).join(' ');
      const output = `${lead[LANGKEY[lang]]} ${steps}`;
      add({ instruction: INSTR.situation_action[LANGKEY[lang]], input: q, output, language: lang, domain, task: 'situation_action', source_refs: refs, id: `scn_${sc.family}_${lang}_${originCounter.SCENARIOS || 0}` }, 'SCENARIOS');
    }
  }
}

// --- 3. Fundamental rights (RIGHTS bank) ---
{
  for (const r of RIGHTS) {
    const chunk = corpus.chunks.find((c) => c.docId === 'constitution_1973' && String(c.key) === String(r.article));
    let clause = null;
    if (chunk) {
      const m = chunk.text.match(/Title:\s*[^.]+\.\s*/);
      const raw = m ? chunk.text.slice(m.index + m[0].length) : '';
      clause = raw.split(/\bSource\s*[:.]/i)[0].replace(/\s+/g, ' ').trim();
      if (clause.length < 20 || clause.length > 320) clause = null;
    }
    const refs = [`Constitution Article ${r.article}`];
    const enAns1 = clause
      ? `${clause} ${SOURCE_WORD.en}: Constitution Article ${r.article} • ${VERIFIED.en}`
      : `Article ${r.article} of the Constitution of Pakistan, 1973 provides for ${r.en}. ${r.simple} ${SOURCE_WORD.en}: Constitution Article ${r.article} • ${VERIFIED.en}`;
    const enAns2 = `Article ${r.article} guarantees the ${r.en}. ${r.simple} ${SOURCE_WORD.en}: Constitution Article ${r.article} • ${VERIFIED.en}`;
    add({ instruction: INSTR.fundamental_rights.en, input: `What does the Constitution say about the ${r.en}?`, output: enAns1, language: 'en', domain: 'constitution', task: 'fundamental_rights', source_refs: refs, id: `right_${r.article}_en1` }, 'RIGHTS');
    add({ instruction: INSTR.fundamental_rights.en, input: `Which fundamental right does Article ${r.article} of the Constitution guarantee?`, output: enAns2, language: 'en', domain: 'constitution', task: 'fundamental_rights', source_refs: refs, id: `right_${r.article}_en2` }, 'RIGHTS');
    if (r.simpleUr) add({ instruction: INSTR.fundamental_rights.ur, input: `${r.ur} کے بارے میں آئین کیا کہتا ہے؟`, output: `${r.simpleUr} ${SOURCE_WORD.ur}: آئین کا آرٹیکل ${r.article} • ${VERIFIED.ur}`, language: 'ur', domain: 'constitution', task: 'fundamental_rights', source_refs: refs, id: `right_${r.article}_ur` }, 'RIGHTS');
    if (r.simpleRom) add({ instruction: INSTR.fundamental_rights.rom, input: `${r.rom} ke baray mein Aaeen kya kehta hai?`, output: `${r.simpleRom} ${SOURCE_WORD.rom}: Constitution Article ${r.article} • ${VERIFIED.rom}`, language: 'roman_ur', domain: 'constitution', task: 'fundamental_rights', source_refs: refs, id: `right_${r.article}_rom` }, 'RIGHTS');
  }
}

// --- 4. Procedures (PROCEDURES + WORKFLOWS banks) ---
{
  for (const p of PROCEDURES) {
    add({ instruction: INSTR.legal_procedures.en, input: p.enQ, output: p.answerEn, language: 'en', domain: p.domain, task: 'legal_procedures', source_refs: p.refs || [], id: `proc_${p.id}_en` }, 'PROCEDURES');
    add({ instruction: INSTR.legal_procedures.ur, input: p.urQ, output: p.answerUr, language: 'ur', domain: p.domain, task: 'legal_procedures', source_refs: p.refs || [], id: `proc_${p.id}_ur` }, 'PROCEDURES');
    add({ instruction: INSTR.legal_procedures.rom, input: p.romQ, output: p.answerRom, language: 'roman_ur', domain: p.domain, task: 'legal_procedures', source_refs: p.refs || [], id: `proc_${p.id}_rom` }, 'PROCEDURES');
  }
  for (const w of WORKFLOWS) {
    add({ instruction: INSTR.legal_procedures.en, input: w.enQ, output: w.answerEn, language: 'en', domain: WF_DOMAINS[w.id] || 'court_procedure', task: 'legal_procedures', source_refs: w.refs || [], id: `wf_${w.id}` }, 'WORKFLOWS');
  }
}

// --- 5. Case law (CASES bank: 6 examples per case) ---
{
  for (const c of CASES) {
    const refs = c.refs || [];
    add({ instruction: INSTR.case_law.en, input: `Summarize the case ${c.name} (${c.citation}).`, output: c.decision, language: 'en', domain: 'case_law', task: 'case_law', source_refs: refs, id: `${c.id}_summary` }, 'CASES');
    add({ instruction: INSTR.case_law.en, input: `What legal issue did the court decide in ${c.name}?`, output: `${c.issue} ${c.decision}`, language: 'en', domain: 'case_law', task: 'case_law', source_refs: refs, id: `${c.id}_issue` }, 'CASES');
    add({ instruction: INSTR.case_law.en, input: `Which provision of law is relevant in ${c.name}?`, output: `The relevant provision is ${refs[0] || 'the provision cited in the case'}. ${c.significance}`, language: 'en', domain: 'case_law', task: 'case_law', source_refs: refs, id: `${c.id}_provision` }, 'CASES');
    add({ instruction: INSTR.case_law.en, input: `Explain ${c.name} in simple terms.`, output: c.significance, language: 'en', domain: 'case_law', task: 'case_law', source_refs: refs, id: `${c.id}_simple` }, 'CASES');
    if (CASE_UR[c.id]) add({ instruction: INSTR.case_law.ur, input: `مقدمہ ${c.name} (${c.citation}) کے بارے میں مختصراً بتائیں۔`, output: CASE_UR[c.id], language: 'ur', domain: 'case_law', task: 'case_law', source_refs: refs, id: `${c.id}_ur` }, 'CASES');
    if (CASE_ROM[c.id]) add({ instruction: INSTR.case_law.rom, input: `Case ${c.name} (${c.citation}) ke baray mein mukhtasar batayen.`, output: CASE_ROM[c.id], language: 'roman_ur', domain: 'case_law', task: 'case_law', source_refs: refs, id: `${c.id}_rom` }, 'CASES');
  }
}

// --- 6. Legal terminology (DEFINITIONS + TERMS banks) ---
{
  for (const d of DEFINITIONS) {
    const refs = [`PPC Section ${d.key}`];
    add({ instruction: INSTR.legal_terminology.en, input: `What is ${d.name} under the Pakistan Penal Code?`, output: d.en, language: 'en', domain: 'criminal_law', task: 'legal_terminology', source_refs: refs, id: `def_${d.key}_en` }, 'DEFINITIONS');
    add({ instruction: INSTR.legal_terminology.ur, input: `تعزیرات پاکستان کے تحت ${d.name} کیا ہے؟`, output: d.ur, language: 'ur', domain: 'criminal_law', task: 'legal_terminology', source_refs: refs, id: `def_${d.key}_ur` }, 'DEFINITIONS');
    add({ instruction: INSTR.legal_terminology.rom, input: `PPC ke tehat ${d.name} kya hai?`, output: d.rom, language: 'roman_ur', domain: 'criminal_law', task: 'legal_terminology', source_refs: refs, id: `def_${d.key}_rom` }, 'DEFINITIONS');
  }
  for (const t of TERMS) {
    add({ instruction: INSTR.legal_terminology.en, input: `What does "${t.enName}" mean in Pakistani law?`, output: t.en, language: 'en', domain: 'criminal_law', task: 'legal_terminology', source_refs: t.refs || [], id: `term_${t.id}_en` }, 'TERMS');
    add({ instruction: INSTR.legal_terminology.ur, input: `پاکستانی قانون میں "${t.urName}" کا کیا مطلب ہے؟`, output: t.ur, language: 'ur', domain: 'criminal_law', task: 'legal_terminology', source_refs: t.refs || [], id: `term_${t.id}_ur` }, 'TERMS');
    add({ instruction: INSTR.legal_terminology.rom, input: `Pakistani qanoon mein "${t.romName}" ka kya matlab hai?`, output: t.rom, language: 'roman_ur', domain: 'criminal_law', task: 'legal_terminology', source_refs: t.refs || [], id: `term_${t.id}_rom` }, 'TERMS');
    add({ instruction: INSTR.legal_terminology.en, input: `Explain the legal term "${t.enName}" in simple words.`, output: t.en, language: 'en', domain: 'criminal_law', task: 'legal_terminology', source_refs: t.refs || [], id: `term_${t.id}_en2` }, 'TERMS');
  }
}

// --- 7. Document explanation (DOC_EXPLAIN bank) ---
{
  for (const d of DOC_EXPLAIN) {
    add({ instruction: INSTR.document_explanation.en, input: d.enQ, output: d.ansEn, language: 'en', domain: 'documents', task: 'document_explanation', source_refs: d.refs || [], id: `docexp_${d.id}_en` }, 'DOC_EXPLAIN');
    if (d.urQ && d.ansUr) add({ instruction: INSTR.document_explanation.ur, input: d.urQ, output: d.ansUr, language: 'ur', domain: 'documents', task: 'document_explanation', source_refs: d.refs || [], id: `docexp_${d.id}_ur` }, 'DOC_EXPLAIN');
    if (d.romQ && d.ansRom) add({ instruction: INSTR.document_explanation.rom, input: d.romQ, output: d.ansRom, language: 'roman_ur', domain: 'documents', task: 'document_explanation', source_refs: d.refs || [], id: `docexp_${d.id}_rom` }, 'DOC_EXPLAIN');
  }
}

// --- 8. Document drafting (DOC_DRAFTS + DOC_MISSING banks) ---
{
  for (const d of DOC_DRAFTS) {
    add({ instruction: d.instruction, input: d.input, output: d.output, language: d.language, domain: 'documents', task: 'document_drafting', source_refs: [], id: `draft_${d.id}` }, 'DOC_DRAFTS');
  }
  for (const d of DOC_MISSING) {
    add({ instruction: d.instruction, input: d.input, output: d.output, language: d.language, domain: 'documents', task: 'document_drafting', source_refs: [], id: `draftmiss_${d.id}`, forceTest: true }, 'DOC_MISSING');
  }
}

// --- 9. Refusals (REFUSALS bank) ---
{
  for (const r of REFUSALS) {
    add({ instruction: INSTR.refusal[LANGKEY[r.lang]], input: r.input, output: r.output, language: r.lang, domain: 'general', task: 'refusal', source_refs: [], id: `ref_${originCounter.REFUSALS}_${r.lang}` }, 'REFUSALS');
  }
}

// --- 10. Source-aware answers (SOURCE_AWARE bank) ---
{
  for (const s of SOURCE_AWARE) {
    add({ instruction: INSTR.source_aware[LANGKEY[s.lang]], input: s.input, output: s.output, language: s.lang, domain: domainFromRefs(s.refs), task: 'source_aware', source_refs: s.refs || [], id: `src_${originCounter.SOURCE_AWARE}_${s.lang}` }, 'SOURCE_AWARE');
  }
}

// --- 11. Domain classification (CLASSIFY bank) ---
{
  for (const c of CLASSIFY) {
    add({ instruction: INSTR.domain_classification[LANGKEY[c.lang]], input: c.input, output: c.output, language: c.lang, domain: domainFromClassifyOutput(c.output), task: 'domain_classification', source_refs: [], id: `cls_${originCounter.CLASSIFY}_${c.lang}` }, 'CLASSIFY');
  }
}

// --- 12. Domain QAs (DOMAIN_QAS bank) ---
{
  for (const q of DOMAIN_QAS) {
    add({ instruction: INSTR.legal_qa.en, input: q.enQ, output: q.ansEn, language: 'en', domain: q.domain, task: 'legal_qa', source_refs: q.refs || [], id: `dqa_${q.id}_en` }, 'DOMAIN_QAS');
    add({ instruction: INSTR.legal_qa.ur, input: q.urQ, output: q.ansUr, language: 'ur', domain: q.domain, task: 'legal_qa', source_refs: q.refs || [], id: `dqa_${q.id}_ur` }, 'DOMAIN_QAS');
    add({ instruction: INSTR.legal_qa.rom, input: q.romQ, output: q.ansRom, language: 'roman_ur', domain: q.domain, task: 'legal_qa', source_refs: q.refs || [], id: `dqa_${q.id}_rom` }, 'DOMAIN_QAS');
  }
}

// --- 13. Legal remedies (REMEDIES bank) ---
{
  for (const r of REMEDIES) {
    add({ instruction: INSTR.legal_remedies.en, input: r.enQ, output: r.ansEn, language: 'en', domain: r.domain, task: 'legal_remedies', source_refs: r.refs || [], id: `rem_${r.id}_en` }, 'REMEDIES');
    add({ instruction: INSTR.legal_remedies.ur, input: r.urQ, output: r.ansUr, language: 'ur', domain: r.domain, task: 'legal_remedies', source_refs: r.refs || [], id: `rem_${r.id}_ur` }, 'REMEDIES');
    add({ instruction: INSTR.legal_remedies.rom, input: r.romQ, output: r.ansRom, language: 'roman_ur', domain: r.domain, task: 'legal_remedies', source_refs: r.refs || [], id: `rem_${r.id}_rom` }, 'REMEDIES');
  }
}

// --- 14. Language tasks (LANGUAGE_TASKS bank) ---
{
  for (const l of LANGUAGE_TASKS) {
    add({ instruction: l.instruction, input: l.input, output: l.output, language: l.lang, domain: 'general', task: l.task, source_refs: [], id: `lang_${originCounter.LANGUAGE_TASKS}_${l.lang}` }, 'LANGUAGE_TASKS');
  }
}

// --- 15. Content 5 held-out banks (always test split) ---
{
  for (const e of EXTRA_REFUSALS) add({ instruction: INSTR.refusal[LANGKEY[e.lang]], input: e.input, output: e.output, language: e.lang, domain: 'general', task: 'refusal', source_refs: [], forceTest: true, id: e.lang + '_' + e.input.slice(0, 40) }, 'EXTRA_REFUSALS');
  for (const e of EXTRA_CLASSIFY) add({ instruction: INSTR.domain_classification[LANGKEY[e.lang]], input: e.input, output: e.output, language: e.lang, domain: domainFromClassifyOutput(e.output), task: 'domain_classification', source_refs: [], forceTest: true, id: e.lang + '_' + e.input.slice(0, 40) }, 'EXTRA_CLASSIFY');
  for (const e of EXTRA_SOURCE_AWARE) add({ instruction: INSTR.source_aware[LANGKEY[e.lang]], input: e.input, output: e.output, language: e.lang, domain: domainFromRefs(e.refs), task: 'source_aware', source_refs: e.refs || [], forceTest: true, id: e.lang + '_' + e.input.slice(0, 40) }, 'EXTRA_SOURCE_AWARE');
  for (const e of EXTRA_LANGUAGE) add({ instruction: e.instruction, input: e.input, output: e.output, language: e.lang, domain: 'general', task: e.task, source_refs: [], forceTest: true, id: e.lang + '_' + e.input.slice(0, 40) }, 'EXTRA_LANGUAGE');
  for (const e of PARAPHRASES) add({ instruction: e.instruction, input: e.input, output: e.output, language: e.lang, domain: PARA_TOPIC_OVERRIDES[e.topic] || PARA_TOPIC_DOMAINS[e.task] || 'general', task: e.task, source_refs: e.refs || [], forceTest: true, id: e.id }, 'PARAPHRASES');
  for (const e of EXTRA_SCENARIOS) add({ instruction: e.instruction, input: e.input, output: e.output, language: e.lang, domain: SCEN_TOPIC_DOMAINS[e.topic] || 'criminal_law', task: e.task, source_refs: e.refs || [], forceTest: true, id: e.id }, 'EXTRA_SCENARIOS');
  for (const e of EXTRA_SIMILAR) add({ instruction: e.instruction, input: e.input, output: e.output, language: e.lang, domain: SIM_TOPIC_DOMAINS[e.topic] || 'case_law', task: e.task, source_refs: e.refs || [], forceTest: true, id: e.id }, 'EXTRA_SIMILAR');
  for (const e of EXTRA_MISC) add({ instruction: e.instruction, input: e.input, output: e.output, language: e.lang, domain: MISC_TOPIC_DOMAINS[e.topic] || 'general', task: e.task, source_refs: e.refs || [], forceTest: true, id: e.id }, 'EXTRA_MISC');
}

// ---------------------------------------------------------------------------
// Reference precheck — abort on any unresolvable source reference
// ---------------------------------------------------------------------------
console.log(`Built ${examples.length} examples. Running source-reference precheck...`);
{
  const failures = [];
  for (const e of examples) {
    for (const ref of e.source_refs || []) {
      const r = resolveRef(ref, corpus);
      if (!r.ok) failures.push({ id: e.id, ref, reason: r.reason });
    }
  }
  if (failures.length) {
    console.error('ABORT: unresolvable source references:');
    for (const f of failures) console.error(`  - [${f.id}] "${f.ref}" -> ${f.reason}`);
    process.exit(1);
  }
  console.log('All source references resolve against the RAG corpus.');
}

// ---------------------------------------------------------------------------
// Split: forced test pool + deterministic 70/15/15 hash split
// ---------------------------------------------------------------------------
const splits = { train: [], validation: [], test: [] };
let merges = 0;
{
  const forced = examples.filter((e) => e.forceTest);
  const pool = examples.filter((e) => !e.forceTest);

  // Near-duplicate QA pairs are compared as instruction + input: the same
  // question under a different task (e.g. domain classification vs legal
  // guidance) is not a duplicate.
  const qaText = (e) => e.instruction + ' ' + e.input;

  // union-find merge of near-duplicate examples among non-forced examples
  const parent = pool.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const tokenCache = pool.map((e) => toks(qaText(e)));
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (jaccardSets(tokenCache[i], tokenCache[j]) >= 0.9) {
        const ri = find(i), rj = find(j);
        if (ri !== rj) { parent[rj] = ri; merges++; }
      }
    }
  }
  // forced vs non-forced collision check
  const forcedCache = forced.map((e) => toks(qaText(e)));
  const collisions = [];
  for (let i = 0; i < forced.length; i++) {
    for (let j = 0; j < pool.length; j++) {
      if (jaccardSets(forcedCache[i], tokenCache[j]) >= 0.9) {
        collisions.push({ test: forced[i].id, other: pool[j].id, a: qaText(forced[i]), b: qaText(pool[j]) });
      }
    }
  }
  if (collisions.length) {
    console.error('ABORT: forced-test examples collide with the train/validation pool:');
    for (const c of collisions.slice(0, 20)) console.error(`  - [${c.test}] vs [${c.other}]: "${c.a.slice(0, 90)}" / "${c.b.slice(0, 90)}"`);
    process.exit(1);
  }

  const splitOf = new Map(); // familyRootIndex -> split
  for (let i = 0; i < pool.length; i++) {
    const r = find(i);
    if (!splitOf.has(r)) {
      const h = hashStr(pool[i].splitKey);
      splitOf.set(r, h % 100 < 70 ? 'train' : h % 100 < 85 ? 'validation' : 'test');
    }
  }
  pool.forEach((e, i) => { e.split = splitOf.get(find(i)); splits[e.split].push(e); });
  for (const e of forced) { e.split = 'test'; splits.test.push(e); }
  console.log(`Split (${merges} near-duplicate merges): train=${splits.train.length} validation=${splits.validation.length} test=${splits.test.length}`);
}

// ---------------------------------------------------------------------------
// Exact duplicate removal (same instruction AND input AND output) — the same
// question with a different instruction/task is a distinct training example.
// ---------------------------------------------------------------------------
{
  const seen = new Set();
  const final = { train: [], validation: [], test: [] };
  let dupes = 0;
  for (const k of ['train', 'validation', 'test']) {
    for (const e of splits[k]) {
      const key = e.instruction + '\u0000' + e.input + '\u0000' + e.output;
      if (seen.has(key)) { dupes++; continue; }
      seen.add(key);
      final[k].push(e);
    }
  }
  splits.train = final.train; splits.validation = final.validation; splits.test = final.test;
  if (dupes) console.log(`Removed ${dupes} exact duplicate (instruction, input, output) triples.`);
}

// ---------------------------------------------------------------------------
// Write JSONL files + manifest
// ---------------------------------------------------------------------------
function writeJsonl(name, list) {
  const lines = list.map((e) => JSON.stringify({
    instruction: e.instruction,
    input: e.input,
    output: e.output,
    language: e.language,
    domain: e.domain,
    task: e.task,
    source_refs: e.source_refs
  }));
  fs.writeFileSync(path.join(OUT_DIR, name), lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  return lines.length;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const counts = {
  train: writeJsonl('train.jsonl', splits.train),
  validation: writeJsonl('validation.jsonl', splits.validation),
  test: writeJsonl('test.jsonl', splits.test)
};

const tally = (list, key) => {
  const m = {};
  for (const e of list) m[e[key]] = (m[e[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const all = [...splits.train, ...splits.validation, ...splits.test];

const manifest = {
  name: 'Insaaf AI — Pakistani Legal Fine-Tuning Dataset',
  purpose: 'Supervised fine-tuning dataset for a future Pakistani Legal AI model. RAG remains the source of current legal facts; this dataset teaches response behavior.',
  generatedAt: new Date().toISOString(),
  generator: 'server/generateFineTuneDataset.js',
  corpusIndexedAt: corpus.chunks.length ? 'rag/indexes/rag_index.json' : 'unknown',
  schema: {
    fields: ['instruction', 'input', 'output', 'language', 'domain', 'task', 'source_refs'],
    languages: VALID_LANGUAGES,
    tasks: VALID_TASKS
  },
  split: { strategy: '70/15/15 deterministic hash; held-out test pool (paraphrases, refusals, classification, source-aware, scenarios, similar cases, misc, drafting-missing, language tasks) always in test', nearDuplicateMerges: merges },
  counts: { total: all.length, ...counts },
  languages: tally(all, 'language'),
  domains: tally(all, 'domain'),
  tasks: tally(all, 'task'),
  banks: originCounter,
  renderingSkips: skipped.length,
  note: 'No model has been trained. This manifest describes data only.'
};
fs.writeFileSync(path.join(OUT_DIR, 'dataset_manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('\n=== GENERATION COMPLETE ===');
console.log('Total:', all.length, '| train:', counts.train, '| validation:', counts.validation, '| test:', counts.test);
console.log('Languages:', JSON.stringify(manifest.languages));
console.log('Skipped ur/rom renderings:', skipped.length);
for (const s of skipped.slice(0, 10)) console.log('  -', s);
if (skipped.length > 10) console.log(`  ... and ${skipped.length - 10} more`);
console.log('Files written to', OUT_DIR);
