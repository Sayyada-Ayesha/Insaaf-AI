// ============================================================================
// Guided-document court/authority line token hygiene (EN + Urdu Script).
// ----------------------------------------------------------------------------
// Structure seeds (src/config/documentStructures.ts and its Urdu mirror map in
// server/docUrdu.js) carry bracket tokens such as [CITY], [POLICE STATION],
// [RECIPIENT] or [شہر] that describe WHERE a user-supplied value belongs.
// The offline renderers must never print an unresolved token into a finished
// document:
//   - each token is filled from the user's field values when a value exists;
//   - any token that stays unresolved is REMOVED with its punctuation and the
//     now-meaningless clause (e.g. "• THROUGH: [ADVOCATE], ADVOCATE") tidied
//     away;
//   - captions whose grammatical subject was an unresolved token (e.g.
//     "IN THE COURT OF THE [SESSIONS JUDGE / MAGISTRATE]") or that collapse to
//     empty glue ("TO:", "IN THE COURT OF THE") are dropped entirely — the
//     renderers already emit a correct address block and/or clearly marked
//     missing-information asks below, so omitting the caption never loses real
//     content.
// Non-fabrication: nothing is invented here — values come only from the
// caller's field map, never from the legal corpus or boilerplate.
// ============================================================================

// Token -> candidate field names. Choice-list tokens such as
// "[HIGH COURT / SUPREME COURT]" or "[RECIPIENT IDENTIFIED IN THE SOURCE
// DOCUMENT]" describe form options rather than a slot and are deliberately
// NOT listed: they can never be filled safely and are always stripped.
const EN_TOKEN_FIELDS = {
  '[POLICE STATION]': ['station'],
  '[CITY]': ['city', 'courtCity', 'district'],
  '[RECIPIENT]': ['recipient', 'recepient'],
  '[ADVOCATE]': ['lawyer'],
  '[JUDGE]': ['court', 'authority', 'judge'],
  '[SESSIONS JUDGE / MAGISTRATE]': ['court', 'authority'],
  '[SESSIONS JUDGE / HIGH COURT]': ['court', 'authority'],
  '[MAGISTRATE / SESSIONS JUDGE / HIGH COURT]': ['court', 'authority'],
  '[LANDLORD]': ['landlord'],
  '[TENANT]': ['tenant'],
  '[EMPLOYER]': ['employer'],
  '[EMPLOYEE]': ['employee'],
  '[DISCLOSING PARTY]': ['discloser']
};

const UR_TOKEN_FIELDS = {
  '[شہر]': ['city', 'courtCity', 'district'],
  '[تھانہ]': ['station'],
  '[وصول کنندہ]': ['recipient', 'recepient'],
  '[وکیل]': ['lawyer'],
  '[جج]': ['court', 'authority', 'judge'],
  '[سشن جج / مجسٹریٹ]': ['court', 'authority'],
  '[سشن جج / ہائی کورٹ]': ['court', 'authority'],
  '[مجسٹریٹ / سشن جج / ہائی کورٹ]': ['court', 'authority'],
  '[مالکِ مکان]': ['landlord'],
  '[کرایہ دار]': ['tenant'],
  '[آجر / کمپنی]': ['employer'],
  '[ملازم]': ['employee'],
  '[انکشاف کنندہ فریق]': ['discloser']
};

// Captions that would collapse to pure glue once their tokens are gone.
const DEGENERATE_EN = [
  /^TO:\s*$/i,
  /^TO:\s*ADVOCATE\s*$/i,
  /^BETWEEN:\s*$/i,
  /^BETWEEN:\s*AND:\s*$/i,
  /^IN THE\b.*\bOF(?:\s+THE)?\s*$/i, // "IN THE COURT OF (THE)", "IN THE CIVIL COURT OF"
  /\bTHE\s*[,،]/i,                   // dangling subject: "…THE , Lahore"
  /\bOF\s*[,،]/i,                    // dangling subject: "…OF , Lahore"
  /\bTHE\s+OF\b/i                    // "IN THE [HIGH COURT …] OF PAKISTAN"
];

const DEGENERATE_UR = [
  /^بہ\s*:?\s*$/,
  /^بہ\s*:?\s*ایڈووکیٹ\s*$/,
  /^بہ\s*(?:دیوانی\s+)?عدالتِ\s*$/, // "بہ عدالتِ" / "بہ دیوانی عدالتِ" (subject token gone)
  /^درمیان:\s*$/,
  /^درمیان:\s*و:\s*$/,
  /عدالتِ\s*[،,]/i // dangling subject: "بہ عدالتِ ، لاہور"
];

/**
 * Fill/strip bracket tokens from a court/authority caption.
 * @param {string} line    caption text (EN seed or Urdu-translated seed)
 * @param {Function|null} grabFn  (…fieldNames) => value | null — caller's field lookup
 * @param {string} [lang]  'en' | 'ur' — which token table is checked first
 * @returns {string} clean caption — never contains an unresolved '[TOKEN]';
 *                   may be '' (callers then omit the caption / fall back)
 */
export function fillCourtLineTokens(line, grabFn, lang = 'en') {
  const tables = lang === 'ur' ? [UR_TOKEN_FIELDS, EN_TOKEN_FIELDS] : [EN_TOKEN_FIELDS, UR_TOKEN_FIELDS];
  let out = String(line || '');
  for (const table of tables) {
    for (const token of Object.keys(table)) {
      if (!out.includes(token)) continue;
      const value = grabFn ? grabFn(...table[token]) : null;
      if (value) out = out.split(token).join(String(value).trim());
    }
  }
  out = out
    // Remove unresolved tokens together with their anchors …
    .replace(/\[[^\]]*\]\s*•\s*/g, '')          // "[RECIPIENT] • THROUGH: …" (bullet dies with it)
    .replace(/\s*•\s*\[[^\]]*\]/g, '')          // "… • [ADVOCATE]"
    .replace(/\s*[,،]\s*\[[^\]]*\]/g, '')       // "…, [CITY]" / "…، [شہر]"
    .replace(/\s*\[[^\]]*\]/g, '')              // any remaining "[…]" remnant
    // … then repair the clauses those removals could have severed.
    .replace(/TO:\s*THROUGH:\s*/gi, 'TO: ')     // "[RECIPIENT] • " ate the bullet in front of THROUGH
    .replace(/بہ:\s*بذریعہ:\s*/gi, 'بہ: ')      // Urdu mirror of the above
    .replace(/\s*•\s*THROUGH:\s*[،,]?\s*(?:ADVOCATE\b)?\s*$/gi, '') // dangling "• THROUGH: …" w/o a name
    .replace(/\s*•\s*بذریعہ:\s*[،,]?\s*(?:ایڈووکیٹ\b)?\s*$/gi, '') // Urdu mirror
    .replace(/\bAND:\s*$/i, '')
    .replace(/\bو:\s*$/, '')
    .replace(/\s*•\s*$/, '')
    // punctuation tidy
    .replace(/,\s*,/g, ',')
    .replace(/،\s*،/g, '،')
    .replace(/:\s*[،,]/g, ':');
  // A caption reduced to pure glue (or with a dangling mid-phrase subject) is
  // worse than no caption: drop it — the address block below still carries the
  // addressee (or a clearly marked missing-information hint).
  if (!out.trim()) return '';
  const degen = lang === 'ur' ? DEGENERATE_UR : DEGENERATE_EN;
  for (const re of degen) if (re.test(out.trim())) return '';
  for (const re of (lang === 'ur' ? DEGENERATE_EN : DEGENERATE_UR)) if (re.test(out.trim())) return '';
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,،•]+$/g, '')
    .trim();
}
