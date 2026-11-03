/**
 * One grammar for provision references.
 *
 * Each call site used to carry its own regex, and only some of them kept the
 * letter suffix: "Section 489-F" was read as "489" and "Article 10-A" as "10",
 * so a real corpus record keyed "489f" was reported as not found. Corpus keys
 * are separator-free and lowercase ("489f", "10a"), so every parse goes through
 * here and compares normalized tokens instead of re-splitting the text.
 */

const UNIT_TYPES = {
  section: 'SECTION', sections: 'SECTION', sec: 'SECTION', dafa: 'SECTION',
  'دفعہ': 'SECTION', 'دفعات': 'SECTION', 'سیکشن': 'SECTION',
  article: 'ARTICLE', articles: 'ARTICLE', art: 'ARTICLE', 'آرٹیکل': 'ARTICLE',
  rule: 'RULE', rules: 'RULE', 'ضابطہ': 'RULE', 'قاعده': 'RULE',
  order: 'ORDER', orders: 'ORDER', 'آرڈر': 'ORDER',
};

const UNITS = [
  'sections', 'section', 'sec\\.', 'sec', 'dafa', 'دفعہ', 'دفعات', 'سیکشن',
  'articles', 'article', 'art\\.', 'art', 'آرٹیکل',
  'rules', 'rule', 'ضابطہ', 'قاعده',
  'orders', 'order', 'آرڈر',
].join('|');

// Number, then either an attached letter suffix ("489F"), or a separator and a
// letter ("489-F", "489 F"). (?![a-zA-Z]) stops "Section 302 and" from reading
// the "a" of "and" as a suffix. A trailing "-304" is a RANGE: both endpoints are
// emitted as their own references, never glued into one impossible key.
const PROVISION_REF_RE = new RegExp(
  `(?<![A-Za-z\\u0600-\\u06FF])(${UNITS})\\s*\\.?\\s*` +
  `(\\d{1,6}[a-fA-F]{0,2}(?:[\\s-]+[a-fA-F]{1,2})?)(?![a-zA-Z])` +
  `(?:\\s*[-/]\\s*(\\d{1,6}[a-fA-F]{0,2}))?`,
  'gi'
);

const URDU_DIGIT_BASES = [0x06f0, 0x0660];

/** Urdu/Persian digits to ASCII, unicode hyphen variants to "-". */
export function toAsciiDigits(text) {
  return String(text || '')
    .replace(/[۰-۹٠-٩]/g, (d) => {
      const code = d.charCodeAt(0);
      const base = URDU_DIGIT_BASES.find((b) => code >= b && code <= b + 9);
      return base === undefined ? d : String(code - base);
    })
    .replace(/[‐-―−]/g, '-');
}

/** Corpus key form: lowercase, no separators. "489-F" -> "489f". */
export function provisionKey(value) {
  return toAsciiDigits(value).toLowerCase().replace(/[\s_-]/g, '');
}

/**
 * The provision token a chunk actually carries. Keys are sometimes embedded in
 * a longer id ("AMEND_PPC_489F_CHEQUE"), so the number and its letter suffix are
 * read out rather than the whole key being compared.
 */
export function chunkProvisionToken(key) {
  const lower = toAsciiDigits(key).toLowerCase();
  const segments = lower.split(/[^a-z0-9]+/);
  for (let i = 0; i < segments.length; i++) {
    const m = segments[i].match(/\d{1,6}[a-f]{0,2}/);
    if (!m) continue;
    // A key written "489-F" splits into "489" and "f"; the letter is part of the
    // number, so rejoin it here instead of reporting provision 489.
    let token = m[0];
    if (/^\d+$/.test(token) && /^[a-f]{1,2}$/.test(segments[i + 1] || '')) token += segments[i + 1];
    return token;
  }
  return '';
}

/**
 * @param {string} text
 * @returns {Array<{raw: string, unit: string, key: string, type: string, range: boolean}>}
 *   one entry per provision number named, in the order it appears.
 */
export function findProvisionRefs(text) {
  const src = toAsciiDigits(text);
  const refs = [];
  for (const m of src.matchAll(PROVISION_REF_RE)) {
    const unitWord = m[1].toLowerCase().replace(/\.$/, '');
    const type = UNIT_TYPES[unitWord] || UNIT_TYPES[m[1]] || 'SECTION';
    const range = Boolean(m[3]);
    for (const token of [m[2], m[3]]) {
      if (!token) continue;
      const key = provisionKey(token);
      if (!/^\d{1,6}[a-f]{0,2}$/.test(key)) continue;
      refs.push({ raw: `${m[1].trim()} ${token}`.replace(/\s+/g, ' ').trim(), unit: m[1], key, type, range });
    }
  }
  return refs;
}

/** Keys only, deduplicated, in first-mention order. */
export function askedProvisionKeys(text) {
  return [...new Set(findProvisionRefs(text).map((r) => r.key))];
}

/**
 * Does this chunk carry the provision the user named? A letter suffix is part of
 * the identity: "489-F" is not "489", so a record for the parent section is not
 * evidence for the lettered one.
 */
export function chunkCarriesProvision(chunk, askedKeys) {
  const token = chunkProvisionToken(chunk && chunk.key);
  return Boolean(token) && askedKeys.includes(token);
}
