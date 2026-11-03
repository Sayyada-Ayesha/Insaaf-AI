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

// A deliberately short list of words that are Roman Urdu and not English. Two of
// them in one message is what the server also requires before it calls Latin
// script Roman Urdu.
const ROMAN_WORDS = new Set([
  'kya', 'hai', 'hain', 'hein', 'mera', 'meri', 'mujhe', 'aap', 'apna', 'apni', 'karen',
  'karoon', 'karna', 'kar', 'ko', 'nahi', 'nhi', 'chahiye', 'zaroori', 'tareeqa', 'kaise', 'kyun',
  'qanoon', 'wakeel', 'adalat', 'shikayat', 'darkhast', 'kiraya', 'malik', 'wapas',
  'liye', 'saath', 'lekin', 'magar', 'agar', 'aur', 'koi', 'kuch', 'sab', 'bhi', 'haan',
  'raha', 'rahi', 'sakta', 'sakti', 'hoga', 'kahan', 'kabhi', 'jaunga', 'doonga', 'masla'
]);

export function isRomanUrduText(text: string): boolean {
  const words = String(text || '').toLowerCase().split(/[^a-z']+/).filter(Boolean);
  let hits = 0;
  for (const w of words) if (ROMAN_WORDS.has(w) && ++hits >= 2) return true;
  return false;
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
