/**
 * P0 — THE PRODUCT LANGUAGE CONTRACT (client mirror).
 *
 * The authoritative rule lives in server/index.js `resolveChatLanguage`; this file
 * exists so that client-side fallback prose and local validation messages make the
 * same decision as the server instead of inventing a second one:
 *
 *   English input      → English answer
 *   Roman Urdu input   → Roman Urdu answer
 *   Urdu SCRIPT input  → Roman Urdu answer
 *
 * Urdu Script is an input language and a DOCUMENT output language, never an answer
 * language. A user who selects Urdu script in the UI still receives answers in
 * Roman Urdu; only the printable document they explicitly ask for is rendered in
 * Urdu script.
 *
 * Note: this mirror detects Urdu SCRIPT plus a bounded set of distinctive Roman
 * Urdu words. The server's full detector (server/index.js detectLanguage) knows
 * more wording, so an offline fallback can still differ on an unusual Latin-script
 * sentence — which is why it only ever affects wording, never routing.
 */
import type { SupportedLanguage } from './i18n';

export type ResponseLanguage = 'en' | 'roman_urdu';

export const isUrduScript = (text: string): boolean => /[؀-ۿ]/.test(String(text || ''));

// The client mirror of server/languageDetect.js: same shape, same rule. Urdu
// evidence is scored AGAINST English evidence, because "two hits from one short
// list" (the previous rule) read plain Roman Urdu asks such as "office ne salary
// rok di" or "saman kharab nikla" as English, so the browser's own fallback
// wording contradicted the answer the server had just produced. The server stays
// authoritative for every networked answer; this decides local fallback and
// validation wording only.
const GRAMMAR = new Set([
  'ne', 'ko', 'se', 'ka', 'ki', 'ke', 'tak', 'bina', 'liye', 'waale', 'waali', 'wala', 'wali',
  'baad', 'waqt', 'jagah', 'tarah', 'taraf', 'mera', 'meri', 'mere', 'mujhe', 'mjhe', 'ham',
  'hamein', 'hamen', 'hamara', 'hamari', 'hamare', 'tum', 'tumhe', 'aap', 'aapko', 'aapka',
  'aapki', 'apna', 'apni', 'apne', 'yeh', 'ye', 'woh', 'wo', 'unhon', 'yahan', 'wahan',
  'hai', 'hain', 'hein', 'ho', 'hota', 'hoti', 'hote', 'hona', 'hone', 'hoga', 'hogi', 'tha',
  'thi', 'hoon', 'raha', 'rahe', 'rahi', 'chahiye', 'chahye', 'chahta', 'chahti', 'sakta',
  'sakti', 'sakte', 'karta', 'karti', 'karte', 'karna', 'karne', 'karoon', 'karein', 'karen',
  'karo', 'kar', 'kiya', 'kia', 'diya', 'diye', 'di', 'dena', 'denge', 'dega', 'lega', 'legi',
  'lena', 'liya', 'bataen', 'batayein', 'jaata', 'jaati', 'gaya', 'gayi', 'aaya', 'aayi',
  'mila', 'mili', 'mile', 'kya', 'kaun', 'kis', 'kise', 'kisne', 'kyun', 'kyon', 'kyunki',
  'magar', 'lekin', 'agar', 'warna', 'phir', 'ab', 'abhi', 'kab', 'kabhi', 'kahan', 'kaise',
  'kitna', 'kitni', 'kitne', 'kuch', 'koi', 'kisi', 'nahi', 'nhi', 'nahin', 'haan', 'ji',
  'bilkul', 'zaroor', 'bohat', 'bahut', 'zyada', 'thora', 'thori', 'sab', 'sara', 'sirf',
  'aur', 'bhi', 'saath', 'theek', 'achha', 'acha', 'masla', 'mamla', 'baat', 'tareeqa',
  'mutaliq', 'mukhtasar', 'mein'
]);

const EVERYDAY = new Set([
  'saman', 'kharab', 'kharida', 'khareed', 'udhaar', 'qarz', 'wapas', 'wapsi', 'paisa', 'paise',
  'raqam', 'tankhwa', 'naukri', 'mulazim', 'malik', 'kiraya', 'makan', 'ghar', 'chor', 'chori',
  'dhoka', 'jhoota', 'thana', 'wakeel', 'vakeel', 'adalat', 'qanoon', 'haq', 'huqooq', 'shikayat',
  'darkhwast', 'darkhast', 'kaghaz', 'dastavez', 'khawand', 'biwi', 'bhai', 'behn', 'beta', 'beti',
  'bachcha', 'bachon', 'bachay', 'nikla', 'nikli', 'ruka', 'ruke', 'jama', 'bhej', 'shuru', 'khatam',
  'dusra', 'tareekh', 'qism', 'sarkari', 'nikaah', 'shadi', 'talaq', 'khula', 'hizanat', 'nafqa',
  'mehr', 'iddat', 'wirasat', 'jaidad', 'zameen', 'malkiat', 'qabza', 'intqal', 'khat', 'taleem',
  'imtihan', 'daftar', 'bimari', 'ilaj', 'jaali', 'naqli', 'dhamki', 'badnami', 'tauheen'
]);

const ENGLISH = new Set([
  'the', 'this', 'that', 'these', 'those', 'there', 'here', 'is', 'are', 'was', 'were', 'am', 'be',
  'been', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'without', 'and', 'or', 'but', 'if', 'then',
  'so', 'because', 'my', 'your', 'our', 'their', 'they', 'them', 'i', 'you', 'he', 'she', 'it',
  'him', 'her', 'his', 'hers', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'can',
  'could', 'would', 'should', 'may', 'might', 'must', 'do', 'does', 'did', 'have', 'has', 'had',
  'please', 'want', 'need', 'against', 'under', 'according', 'about', 'from', 'into', 'than',
  'will', 'shall', 'not', 'no', 'yes', 'any', 'some', 'all', 'each', 'other', 'more', 'very',
  'get', 'got', 'make', 'made', 'give', 'take', 'file', 'case', 'court', 'law', 'a', 'an', 'as',
  'too', 'also', 'just', 'still'
]);

export function isRomanUrduText(text: string): boolean {
  const s = String(text || '');
  if (!s.trim() || isUrduScript(s)) return false;
  const words = s.toLowerCase().match(/[a-z]+/g) || [];
  if (!words.length) return false;
  let roman = 0;
  let english = 0;
  for (const w of words) {
    if (GRAMMAR.has(w)) roman += 3;
    else if (EVERYDAY.has(w)) roman += 2;
    else if (ENGLISH.has(w)) english += 3;
  }
  const inflected = words.some(w => /^[a-z]{3,}(?:gaa|gey|egi|ega|enge|unga|ungi|oo|ey|na)$/.test(w) && !ENGLISH.has(w));
  if (inflected) roman += 2;
  return roman >= 4 && roman > english;
}

export function resolveResponseLanguage(
  preferredLanguage?: SupportedLanguage | 'auto' | 'Auto' | null,
  userText = ''
): ResponseLanguage {
  // The language the user wrote in decides. The UI chrome offers only English and
  // Roman Urdu (i18n getCurrentLanguage), and English is the DEFAULT, so an 'en'
  // preference is a floor, never a ceiling: it may not pull a Roman Urdu or
  // Urdu-script question back into English.
  if (isUrduScript(userText)) return 'roman_urdu';
  if (isRomanUrduText(userText)) return 'roman_urdu';
  return preferredLanguage === 'roman_urdu' ? 'roman_urdu' : 'en';
}

/** Pick the wording for the resolved response language. */
export function prose<T>(lang: ResponseLanguage, en: T, roman: T): T {
  return lang === 'roman_urdu' ? roman : en;
}
