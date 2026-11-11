/**
 * CITATION GROUNDING — the last step of every composed answer.
 *
 * The composers know Pakistani statutes from their own wording, not only from the
 * records handed to them: a police question used to come back quoting "Section 154
 * CrPC" even when retrieval had returned a consumer record with no such section in
 * it. A number the user never wrote and no cited record states is an invented
 * citation, and an invented citation is worse than no citation, because a citizen
 * will quote it in a police station or a court.
 *
 * The rule is therefore absolute and applied at the single point every answer
 * passes: a section / article / dafa may stay in printed prose only when
 *   1. the user themselves wrote it, or
 *   2. one of the records this answer is built from states it in provision
 *      context ("Section 154", "s. 379", "Art. 199", "دفعہ 306", a key like
 *      CRPC_SECTION_154).
 * Anything else is removed together with the preposition that carried it, leaving
 * the plain-language guidance that does not need a false authority to be useful.
 *
 * Only a citation is ever removed here. Nothing is added, and a grounded citation
 * is left exactly as the composer wrote it.
 */

// A provision token is digits, an optional letter ("379A"), and an optional
// hyphenated suffix ("489-F", "22-A"). "499-501" is a range of two tokens, so a
// hyphen followed by a digit separates rather than suffixes.
const TOKEN = '[0-9]{1,4}[A-Za-z]?(?:-[A-Za-z]{1,3})?';
const RANGE = `${TOKEN}(?:\\s*(?:/|–|-\\s*(?=\\d)|\\s+to\\s+|\\s+tak\\s+|\\s+se\\s+)\\s*${TOKEN})*`;
const PROVISION_WORDS = 'section|sections|sec|article|articles|art|dafa|dhara';
const STATUTE_WORDS = '(?:of\\s+the\\s+)?(?:Cr\\.?PC|PPC|R\\.?PC|IEA|Qanun-e-Shahadat|Code\\s+of\\s+Criminal\\s+Procedure(?:,\\s*1898)?|Code\\s+of\\s+Civil\\s+Procedure|Pakistan\\s+Penal\\s+Code(?:,\\s*1860)?|Constitution)';

/** English and Roman Urdu order: "under Section 154 CrPC", "Section 489-F ke tehat". */
const CITATION = new RegExp(
  `(?:\\b(?:under|as\\s+per|according\\s+to|as\\s+defined\\s+in|read\\s+with|via|in)\\s+)?`
  + `\\b(?:${PROVISION_WORDS})\\s*(?:no\\.?|num\\.?)?\\s*#?\\s*(${RANGE})`
  + `(?:\\s*\\([0-9]{1,3}\\))?(?:\\s*${STATUTE_WORDS})?(?:\\s+ke\\s+(?:tehat|mutabiq|zair))?`, 'gi');

/** Roman Urdu carries the statute before the number: "CrPC ki Section 154". */
const ROMAN_CITATION = new RegExp(
  `\\b(?:Cr\\.?PC|PPC|R\\.?PC|IEA|Constitution)\\s+(?:ki|ka|ke)\\s+(?:Section|Article|dafa)\\s*(${RANGE})`
  + `(?:\\s+ke\\s+(?:tehat|mutabiq))?`, 'gi');

/** Urdu script: "دفعہ 306" / "آرٹیکل 199", with the carrier that follows it. */
const URDU_CITATION = /(?:دفعہ|آرٹیکل|شعبدہ)\s*([0-9٠-٩]{1,4}[A-Za-z]?(?:-[A-Za-z]{1,3})?(?:\s*[-/]\s*[0-9٠-٩]{1,4}[A-Za-z]?)?)(?:\s+کے\s+(?:تحت|مطابق|زیر|ذیر))?/g;

const ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const normDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] ?? d);

/** "489-F" and "489F" are the same provision; "499-501" is two. */
function citationNumbers(phrase) {
  const body = normDigits(String(phrase));
  const numPart = body.match(new RegExp(`(${RANGE})`, 'i'));
  if (!numPart) return [];
  const parts = numPart[1].split(/\s*(?:\/|–|-(?=\d)|\s+to\s+|\s+tak\s+|\s+se\s+)\s*/i);
  const out = [];
  for (const p of parts) {
    const n = p.replace(/[\s-]/g, '').toLowerCase();
    if (n) out.push(n);
  }
  return out;
}

/**
 * The provision numbers a record itself states, in provision context only, so a
 * page number, a year or an amount inside the record licenses nothing.
 */
function recordProvisionNumbers(text) {
  const found = new Set();
  const re = new RegExp(`(?:${PROVISION_WORDS}|دفعہ|آرٹیکل|شعبدہ)\\s*(?:no\\.?\\s*)?#?\\s*(${RANGE})`, 'gi');
  for (const m of normDigits(String(text || '')).matchAll(re)) {
    for (const n of citationNumbers(m[1])) found.add(n);
  }
  // Chunk keys carry the number without the word: CRPC_SECTION_154.
  for (const m of normDigits(String(text || '')).matchAll(/_(?:SECTION|ARTICLE)_?([0-9]{1,4}[A-Za-z]?(?:-[A-Za-z]{1,3})?)/gi)) {
    for (const n of citationNumbers(m[1])) found.add(n);
  }
  return found;
}

/**
 * @param {string} text composed answer
 * @param {Array} records the chunks this answer was built from
 * @param {string} userQuery the user's own words
 * @returns {{text: string, removed: string[]}}
 */
export function groundAnswerCitations(text, records, userQuery = '') {
  const original = String(text || '');
  if (!original) return { text: original, removed: [] };

  const licensed = new Set();
  for (const c of records || []) {
    if (!c) continue;
    for (const n of recordProvisionNumbers(
      `${c.text || ''} ${c.chunkTitle || ''} ${c.title || ''} ${c.key || ''} ${c.docId || ''}`
    )) licensed.add(n);
  }
  for (const n of citationNumbers(userQuery)) licensed.add(n);

  const removed = [];
  const keepOrDrop = (phrase, numbers) => {
    // A citation naming no number at all is a heading, not an assertion, and stays.
    if (!numbers.length) return phrase;
    if (numbers.every(n => licensed.has(n))) return phrase;
    const label = phrase.replace(/\s+/g, ' ').trim();
    if (!removed.includes(label)) removed.push(label);
    return '';
  };
  const drop = (whole) => keepOrDrop(whole, citationNumbers(whole));

  const out0 = original
    .replace(ROMAN_CITATION, drop)
    .replace(CITATION, drop)
    .replace(URDU_CITATION, drop);

  if (!removed.length) return { text: original, removed };

  // Tidy what the removals left behind: dangling punctuation, empty brackets,
  // a bullet that held nothing but the citation, and double spaces.
  let out = out0
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/[ \t]+([,.;:])/g, '$1')
    .replace(/([,;])[ \t]*([.!:])/g, '$2')
    .replace(/(^|\n)[ \t]*[-•*][ \t]*(?=\n|$)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  // A sentence whose opening citation was removed gets its capital back. A colon
  // is not skipped: it continues the same sentence.
  out = out.replace(/(^|\n|[.!?][ \t]+)([a-z])/g, (m, lead, ch) => lead + ch.toUpperCase());

  return { text: out.trim(), removed };
}

/** Test hook: the citation phrases in a text, for regression suites. */
export function answerCitations(text) {
  const t = String(text || '');
  return [
    ...t.matchAll(ROMAN_CITATION), ...t.matchAll(CITATION), ...t.matchAll(URDU_CITATION)
  ].map(m => m[0].replace(/\s+/g, ' ').trim());
}
