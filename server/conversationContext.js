// ============================================================================
// MULTI-TURN CONTEXT — the shape of a conversation thread, and what a follow-up
// sentence actually means once the earlier turns are taken into account.
//
// Two defects live here, and both are the product's, not a test's:
//
//   * The chat client posts history as {role:'user'|'model', text}; the Legal
//     Agent and the document-edit client post {role:'assistant'|'user', content}.
//     The routes read only `.text`, so every agent-shaped turn validated as a
//     400 or, where validation was looser, was silently IGNORED — the citizen
//     re-stated a fact and the system asked for it again.
//   * "And what happens if they still do not reply?" and "wohr private company
//     hai" carry no subject of their own. Retrieval matches words, so on the
//     fragment alone it finds nothing about the dispute actually being discussed.
//     A follow-up is therefore resolved against the thread BEFORE retrieval, and
//     the resolution never changes the language of the reply or invents a fact:
//     it only supplies the words the user already gave.
//
// "Carries no subject of its own" is measured against the corpus's own
// vocabulary (domainProfile.askedDomains, built from rag/metadata/domain_lexicon.json)
// rather than a hand-written word list, so a new subject area does not need a
// change here.
// ============================================================================

import { askedDomains } from './domainProfile.js';

const ASSISTANT_ROLES = new Set(['model', 'assistant', 'ai', 'bot']);

/**
 * One history shape, whatever a client sent. Items with no text are dropped
 * rather than kept as empty turns; the role is reduced to 'user' | 'model'.
 */
export function normalizeHistory(raw, { maxItems = 30, maxItemLength = 8000 } = {}) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(-maxItems)) {
    if (!item || typeof item !== 'object') continue;
    const text = typeof item.text === 'string' ? item.text
      : typeof item.content === 'string' ? item.content : '';
    if (!text.trim()) continue;
    const role = String(item.role || 'user').toLowerCase().trim();
    out.push({
      role: ASSISTANT_ROLES.has(role) ? 'model' : 'user',
      text: text.slice(0, maxItemLength),
    });
  }
  return out;
}

export function joinTurns(history, role) {
  return (Array.isArray(history) ? history : [])
    .filter(h => h && h.role === role)
    .map(h => h.text || '')
    .filter(Boolean)
    .join(' ');
}

const lastTurn = (history, role) => {
  const turns = (Array.isArray(history) ? history : []).filter(h => h && h.role === role);
  return turns.length ? String(turns[turns.length - 1].text || '') : '';
};

// Words whose only job is to point back at something already said. Interrogatives
// (what/which/how/why) are deliberately absent: "How do I file a tenancy suit?"
// is a complete question, while "He has been in custody six days" is not.
const REFERENTIAL_TOKENS = new Set([
  'and', 'so', 'then', 'but', 'also', 'plus', 'anyway', 'ok', 'okay', 'now', 'well',
  'they', 'them', 'their', 'theirs', 'he', 'him', 'his', 'she', 'her', 'hers',
  'it', 'its', 'this', 'that', 'these', 'those', 'there', 'here', 'another',
  'same', 'still', 'again', 'both', 'either', 'neither',
  // Roman Urdu. "to" is the Urdu connector "then"; in English it opens an
  // infinitive, so it only counts when the sentence is Urdu (see below).
  'aur', 'or', 'phir', 'ab', 'bhi', 'toh', 'to', 'yeh', 'ye', 'woh', 'wo', 'wohr',
  'usi', 'isko', 'use', 'unka', 'uska', 'iska', 'unhon', 'wohran', 'wahan', 'mujhe',
  'hum', 'huma', 'apna', 'mera', 'meri', 'tum', 'aap', 'inka', 'inka', 'jiska', 'jis',
  // Urdu script
  'ان', 'وہ', 'یہ', 'اس', 'کا', 'کی', 'اور', 'پھر', 'تو', 'بھی', 'وہاں', 'انہوں', 'مجھے', 'میرا',
]);

// Frames that presuppose an earlier turn: "what if they refuse?" says nothing a
// search could run on by itself.
const REFERENTIAL_PAIRS = new Set([
  'what about', 'how about', 'what if', 'so if', 'and if', 'but if',
]);

// Cheap evidence that a sentence is Roman Urdu, so 'to' is read as "then".
const ROMAN_URDU_HINTS = new Set([
  'hai', 'hain', 'tha', 'thi', 'thay', 'ho', 'hoga', 'hogi', 'karna', 'karo', 'karoon',
  'kya', 'kaun', 'kis', 'kitna', 'kitni', 'liye', 'wala', 'wali', 'nahi', 'nahin', 'ab',
  'toh', 'phir', 'aur', 'bhi', 'ka', 'ke', 'ki', 'se', 'mein', 'main', 'par', 'mujhe',
  'chahiye', 'bata', 'bataayein', 'dijiye', 'diya', 'raha', 'rahi', 'gaya', 'gayi',
  'hua', 'hui', 'de', 'dena', 'lena', 'mera', 'meri', 'aap', 'tum', 'apna', 'hamara',
  'masla', 'shikayat', 'raqam', 'tankhwah', 'kiraya', 'mukaddama', 'thahra', 'karwayi',
]);

// Asking for a document, forum or authority is a NEW ask, not a reference. This
// list is only the cheap first pass; anything it misses is settled by the
// corpus's own vocabulary in namesItsOwnSubject().
const SELF_CONTAINED_RE = /\b(act|section|dafa|court|tribunal|police|bank|university|fee|rent|cheque|loan|contract|notice|fir|complaint|appeal|passport|visa|doctor|hospital|salary|deposit|tenancy|arrest|custody|agreement|lawyer)\b/i;

export function tokenizeTurn(query) {
  return String(query || '').toLowerCase().trim().split(/[^'\p{L}\p{N}]+/u).filter(Boolean);
}

/** Does this turn name something the corpus can be searched for on its own? */
export function namesItsOwnSubject(query, words = tokenizeTurn(query)) {
  if (SELF_CONTAINED_RE.test(String(query || ''))) return true;
  if (!words.length) return false;
  try {
    return askedDomains(String(query || '')).length > 0;
  } catch {
    // The lexicon could not be read; assume the turn stands alone rather than
    // dragging an unrelated earlier subject into every retrieval.
    return true;
  }
}

/**
 * Is this turn incomplete on its own? It either points back with a connector or
 * pronoun, or it is a short turn that names nothing the corpus can search for.
 */
export function isFollowUpTurn(query) {
  const words = tokenizeTurn(query);
  if (!words.length) return false;
  const thin = !namesItsOwnSubject(query, words);
  const isRomanUrdu = words.some(w => ROMAN_URDU_HINTS.has(w));
  const refers = (i) => {
    const w = words[i];
    if (w == null) return false;
    if (w === 'to' && !isRomanUrdu) return false;
    return REFERENTIAL_TOKENS.has(w);
  };
  // A connector in second position ("to ab main kya karoon") or a referential
  // frame ("what if they refuse?") only counts when the turn carries no subject
  // of its own.
  const refersBack = refers(0)
    || (thin && (refers(1) || REFERENTIAL_PAIRS.has(words.slice(0, 2).join(' '))));
  return refersBack || (thin && words.length <= 5);
}

/** The assistant asked something and this turn is the answer to it. */
export function priorTurnAskedQuestion(modelTurn) {
  const t = String(modelTurn || '').trim();
  return /[?؟]\s*$/.test(t);
}

/**
 * Resolve a turn against its thread.
 *   retrievalQuery — what to search for. On a follow-up this is the last user
 *     turn that carried a subject, plus the current words; otherwise exactly the
 *     current words, so nothing outside the citizen's own question can move the
 *     evidence.
 *   followUp — true when the subject came from the earlier turn.
 * Nothing here touches the reply language, which stays decided by the current
 * turn, and no fact is added that the user did not say.
 */
export function resolveThread(userQuery, history, { maxPriorChars = 320 } = {}) {
  const items = normalizeHistory(history);
  const priorUser = joinTurns(items, 'user');
  const priorModel = joinTurns(items, 'model');
  const q = String(userQuery || '').trim();
  const lastModel = lastTurn(items, 'model');
  // A reply to a clarification question is a follow-up even when it reads as a
  // complete sentence: "account Sindh mein hai" states a fact, it does not ask
  // a searchable question.
  const followUp = items.length > 0
    && (isFollowUpTurn(q) || (lastModel.trim() !== '' && priorTurnAskedQuestion(lastModel)));
  let source = lastTurn(items, 'user');
  if (!source.trim()) source = lastModel;
  source = String(source || '').trim().slice(0, maxPriorChars);
  const subjectFromThread = followUp && source.length > 0;
  return {
    history: items,
    priorUser,
    priorModel,
    followUp: subjectFromThread,
    retrievalQuery: subjectFromThread ? `${source} ${q}` : q,
  };
}
