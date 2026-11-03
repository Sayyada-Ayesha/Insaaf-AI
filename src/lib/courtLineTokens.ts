// ============================================================================
// Client-side court/authority line token hygiene (English).
// ----------------------------------------------------------------------------
// Mirrors server/courtLineTokens.js for the BROWSER-ONLY fallback renderers
// (src/services/aiRuntime.ts local fallback and src/templates/legalDocumentTemplates.ts
// skeleton), which run only when the backend cannot be reached. Structure seeds
// from src/config/documentStructures.ts carry bracket tokens such as [CITY] or
// [RECIPIENT] that describe WHERE a user-supplied value belongs; those tokens
// must never be printed into a user-visible document, so each is filled from
// the caller's field values when available and otherwise stripped (with the
// now-meaningless clause tidied or the caption dropped).
// Non-fabrication: nothing is invented here — values come only from the
// caller's field map.
// ============================================================================

const EN_TOKEN_FIELDS: Record<string, string[]> = {
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

const DEGENERATE_EN = [
  /^TO:\s*$/i,
  /^TO:\s*ADVOCATE\s*$/i,
  /^BETWEEN:\s*$/i,
  /^BETWEEN:\s*AND:\s*$/i,
  /^IN THE\b.*\bOF(?:\s+THE)?\s*$/i,
  /\bTHE\s*[,،]/i,
  /\bOF\s*[,،]/i,
  /\bTHE\s+OF\b/i
];

const BLANK_RE = /^[\s_]*$/;

/**
 * Fill/strip bracket tokens from a court/authority caption (EN seeds only).
 * @param {string} line caption text from the document structure registry
 * @param {(field: string) => string | null | undefined} [grabFn] field lookup
 * @returns {string} clean caption — never contains an unresolved '[TOKEN]';
 *                   may be '' (callers then omit the caption / fall back)
 */
export function fillCourtLineTokens(line: string, grabFn?: (...names: string[]) => string | null | undefined): string {
  let out = String(line || '');
  for (const token of Object.keys(EN_TOKEN_FIELDS)) {
    if (!out.includes(token)) continue;
    const names = EN_TOKEN_FIELDS[token];
    let value: string | null | undefined = null;
    if (grabFn) {
      for (const n of names) {
        const v = grabFn(n);
        if (v && !BLANK_RE.test(String(v))) { value = String(v).trim(); break; }
      }
    }
    if (value) out = out.split(token).join(value);
  }
  out = out
    .replace(/\[[^\]]*\]\s*•\s*/g, '')
    .replace(/\s*•\s*\[[^\]]*\]/g, '')
    .replace(/\s*[,،]\s*\[[^\]]*\]/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/TO:\s*THROUGH:\s*/gi, 'TO: ')
    .replace(/\s*•\s*THROUGH:\s*[،,]?\s*(?:ADVOCATE\b)?\s*$/gi, '')
    .replace(/\bAND:\s*$/i, '')
    .replace(/\s*•\s*$/, '')
    .replace(/,\s*,/g, ',')
    .replace(/:\s*[،,]/g, ':');
  if (!out.trim()) return '';
  for (const re of DEGENERATE_EN) if (re.test(out.trim())) return '';
  return out.replace(/\s{2,}/g, ' ').replace(/[\s,،•]+$/g, '').trim();
}
