/**
 * server/languageDetect.js — ONE written-language detector for the whole product.
 *
 * Prose language used to be decided in index.js and retrieval language in
 * ragEngine.processQuery, by two different hand-listed word counts. Both needed
 * a fixed number of exact-match cues, so ordinary Roman Urdu — "office ne salary
 * rok di", "saman kharab nikla", "mere huqooq maar diye ja rahe hain" — read as
 * English and was answered in English, in every domain and every route.
 *
 * This classifier is COMPARATIVE rather than threshold-on-a-list: every token is
 * scored for how strongly it belongs to Urdu grammar versus English grammar, so
 * English function words count AGAINST a Roman Urdu reading and one stray
 * particle in an English sentence cannot flip it. The everyday-content set is
 * folded in from the project's own Roman Urdu glossary at load, so growing that
 * glossary grows the detector instead of the two drifting apart.
 */

/**
 * Urdu closed-class words: case-markers, pronouns, auxiliaries, question words,
 * connectives. English homographs ('main', 'the', 'is', 'us', 'do', 'na', 'ya',
 * 'par') are deliberately absent — they would misfire on English input.
 */
const GRAMMAR = new Set([
  'ne', 'ko', 'se', 'ka', 'ki', 'ke', 'tak', 'bina', 'liye', 'waale', 'waali', 'wala', 'wali',
  'baad', 'waqt', 'jagah', 'jaga', 'tarah', 'taraf', 'trf', 'bare', 'amura', 'alawa', 'siva',
  'mera', 'meri', 'mere', 'mujhe', 'mjhe', 'ham', 'hamein', 'hamen', 'hamara', 'hamari', 'hamare',
  'tum', 'tumhe', 'tumhara', 'tumhari', 'aap', 'aapko', 'aapka', 'aapki', 'ap', 'apna', 'apni', 'apne',
  'yeh', 'ye', 'woh', 'wo', 'unhon', 'unho', 'yahan', 'idhar', 'udhar', 'wahan',
  'hai', 'hain', 'hein', 'ho', 'hota', 'hoti', 'hote', 'hona', 'hone', 'hoga', 'hogi', 'hoge',
  'tha', 'thi', 'hoon', 'hun', 'raha', 'rahe', 'rahi', 'rahega', 'rahegi',
  'chahiye', 'chahye', 'chahein', 'chahta', 'chahti', 'sakta', 'sakti', 'sakte', 'saka',
  'karta', 'karti', 'karte', 'karna', 'karne', 'karoon', 'karein', 'karen', 'karo', 'kar',
  'kiya', 'kia', 'diya', 'diye', 'di', 'dena', 'denge', 'dega', 'degi',
  'lega', 'legi', 'lenge', 'lena', 'lene', 'liya', 'lia', 'dijiye', 'bataen', 'batayein', 'bataein',
  'jaata', 'jaati', 'jaate', 'gaya', 'gayi', 'aaya', 'aayi', 'aata', 'aati', 'aya', 'ayi',
  'mila', 'mili', 'mile', 'milta', 'milti',
  'kya', 'kaun', 'kis', 'kise', 'kisne', 'kyun', 'kyon', 'kyunki', 'kyonki', 'magar', 'lekin',
  'agar', 'agr', 'warna', 'phir', 'ab', 'abhi', 'kab', 'kabhi', 'kahin', 'kahan', 'kaise', 'kesay',
  'kitna', 'kitni', 'kitne', 'kuch', 'kuchh', 'koi', 'kisi', 'nahi', 'nhi', 'nahin', 'haan',
  'ji', 'bilkul', 'zaroor', 'zara', 'bohat', 'bahut', 'zyada', 'ziada', 'thora', 'thori', 'thoda',
  'sab', 'sabh', 'sara', 'saare', 'sirf', 'aur', 'bhi', 'sang', 'saath', 'theek', 'achha', 'acha',
  'masla', 'mamla', 'baat', 'tareeqa', 'tariqa', 'raasta', 'maqsood', 'maqsad', 'shakal',
  'halat', 'haalaat', 'tauke', 'shayad', 'zaroorat', 'majboor', 'pareshan',
  'taliqa', 'mutaliq', 'mufassal', 'mukhtasar', 'banane', 'banaya', 'banai', 'bana', 'bani'
]);

/** Everyday Urdu content words a citizen types, whatever the subject matter. */
const EVERYDAY = new Set([
  'saman', 'kharab', 'kharida', 'khareed', 'khareedari', 'bikri', 'becha', 'bekha', 'dukan', 'dukaan',
  'dukaandar', 'udhaar', 'qarz', 'wapas', 'wapsi', 'paisa', 'paise', 'raqam', 'tankhwa', 'tankhwah',
  'naukri', 'mulazim', 'mazdoor', 'malik', 'kiraya', 'kiraye', 'makan', 'ghar', 'chor', 'chori',
  'loot', 'daketi', 'dhoka', 'jhoot', 'jhoota', 'thana', 'wakeel', 'vakeel', 'wukeel', 'adalat',
  'qanoon', 'haq', 'huqooq', 'zimmedari', 'zimmedaar', 'shikayat', 'darkhwast', 'darkhast',
  'kaghaz', 'kaghazat', 'kaghazaat', 'dastavez', 'khawand', 'shohar', 'biwi', 'bhai', 'behn', 'behan',
  'mata', 'pidar', 'waldain', 'abu', 'ammi', 'beta', 'beti', 'bete', 'betiyan', 'bachcha', 'bachon',
  'bachay', 'bache', 'rishtedar', 'khandaan', 'nikla', 'nikli', 'nikal', 'nikalna', 'ruka', 'ruke',
  'ruki', 'rukavat', 'atka', 'atki', 'jama', 'bhej', 'bheja', 'bheji', 'shuru', 'shuruat', 'khatam',
  'dusra', 'doosra', 'pehla', 'pahla', 'baina', 'tameem', 'ijazat', 'zaban', 'bhasha', 'tafreeq',
  'afraatelli', 'nuqsan', 'nuqsandeh', 'muaawza', 'bawajood', 'khilaf', 'zilaal', 'dhamki',
  'dhamkana', 'tauheen', 'touheen', 'badnami', 'rishtay', 'nikaah', 'shadi', 'shadhi', 'talaq',
  'khula', 'hizanat', 'nafqa', 'mehr', 'mahram', 'iddat', 'wirasat', 'jaidad', 'zameen', 'khat',
  'intqal', 'tabdili', 'malkiat', 'qabza', 'qabze', 'tareekh', 'bimari', 'ilaj', 'aspataal',
  'taleem', 'imtihan', 'daftar', 'qism', 'sarkari', 'kifalat', 'kafaalat', 'bhandar', 'manga',
  'mangwa', 'pention', 'riyayat', 'chutti', 'jaali', 'naqli', 'sharab', 'nashe', 'zabardasti'
]);

/** English closed-class words — evidence AGAINST a Roman Urdu reading. */
const ENGLISH = new Set([
  'the', 'this', 'that', 'these', 'those', 'there', 'here', 'is', 'are', 'was', 'were', 'am', 'be',
  'been', 'being', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'without', 'and', 'or', 'but', 'if',
  'then', 'so', 'because', 'my', 'your', 'yours', 'our', 'ours', 'their', 'they', 'them', 'i', 'you',
  'he', 'she', 'it', 'him', 'her', 'his', 'hers', 'its', 'what', 'when', 'where', 'which', 'who',
  'whom', 'why', 'how', 'can', 'could', 'would', 'should', 'may', 'might', 'must', 'do', 'does',
  'did', 'doing', 'have', 'has', 'had', 'having', 'please', 'want', 'wanted', 'need', 'needs',
  'kind', 'type', 'against', 'under', 'according', 'about', 'from', 'into', 'than', 'will', 'shall',
  'not', 'no', 'yes', 'any', 'some', 'all', 'each', 'other', 'more', 'most', 'very', 'much', 'many',
  'get', 'got', 'make', 'made', 'give', 'given', 'take', 'took', 'file', 'filed', 'case', 'matter',
  'court', 'law', 'legal', 'me', 'us', 'a', 'an', 'as', 'too', 'also', 'just', 'still', 'already'
]);

let glossary = null;
/**
 * Filled by ragEngine once its Roman Urdu glossary exists. Those words are the
 * product's own inventory of Roman Urdu legal vocabulary, so they count as
 * content evidence here without this module duplicating them.
 */
export function registerRomanGlossary(map) {
  glossary = new Set(Object.keys(map || {})
    .map(k => String(k).toLowerCase())
    .filter(w => /^[a-z]{3,}$/.test(w)));
}
const glossaryWords = () => (glossary || new Set());

const TOKENS = /[A-Za-z]+/g;

/**
 * @param {string} text exactly what the user wrote
 * @returns {'en'|'roman_urdu'|'ur'} 'ur' only for Urdu SCRIPT input
 */
export function detectWrittenLanguage(text) {
  const s = String(text || '');
  if (!s.trim()) return 'en';
  if (/[\u0600-\u06FF]/.test(s)) return 'ur';

  const tokens = (s.toLowerCase().match(TOKENS) || []).filter(Boolean);
  if (!tokens.length) return 'en';

  const gloss = glossaryWords();
  let roman = 0;
  let english = 0;
  for (const t of tokens) {
    if (GRAMMAR.has(t)) { roman += 3; continue; }
    if (EVERYDAY.has(t) || gloss.has(t)) { roman += 2; continue; }
    if (ENGLISH.has(t)) english += 3;
  }
  // An English loanword written with an Urdu ending ("legaa", "karoo", "khareedo")
  // is Roman Urdu morphology, and one such token is enough to tip a short ask.
  const inflected = tokens.some(t => /^[a-z]{3,}(?:gaa|gey|egi|ega|enge|unga|ungi|oo|ey|na)$/.test(t) && !ENGLISH.has(t));
  if (inflected) roman += 2;

  if (roman >= 4 && roman > english) return 'roman_urdu';
  // Telegram-style asks ("domicile banana hai", "sarkari scheme ka paise ruke
  // hain") carry no English function word at all; Urdu evidence with zero
  // English evidence still reads as Urdu.
  if (english === 0 && roman >= 4) return 'roman_urdu';
  return 'en';
}

/**
 * The language an ANSWER is written in — the product P0 contract: Urdu script and
 * Roman Urdu input are answered in Roman Urdu, English input in English, and an
 * explicitly Roman-chosen interface answers anything in Roman Urdu.
 */
export function proseLanguage(text, preferredLanguage = 'en') {
  const d = detectWrittenLanguage(text);
  if (d === 'ur' || d === 'roman_urdu') return 'roman_urdu';
  return preferredLanguage === 'roman_urdu' ? 'roman_urdu' : 'en';
}

export function languageInventories() {
  return { grammar: GRAMMAR.size, everyday: EVERYDAY.size, english: ENGLISH.size, glossary: glossaryWords().size };
}
