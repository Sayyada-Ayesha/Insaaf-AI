/**
 * Runtime citation audit.
 *
 * An answer is assembled from retrieved corpus records, so every Section/Article
 * it prints SHOULD be one of those records. Historically this was only checked in
 * the test harness (server/testCorrectiveRag.js `unsupportedCitations`), which
 * catches drift between releases but tells the user nothing at the moment they read
 * an answer. This module runs the same idea at request time and reports, honestly,
 * which cited provisions are backed by the evidence shown, which exist in the
 * verified corpus but were not retrieved for this question, and which cannot be
 * found in the corpus at all.
 *
 * It never edits the answer and never adds a legal fact. A citation it cannot back
 * is surfaced to the user as "please verify" rather than silently trusted.
 *
 * The provision catalogue is derived from the built index itself (chunks whose key
 * is a provision number and whose type is SECTION/ARTICLE), so this audit can only
 * ever claim a provision exists where the corpus really carries its text.
 */

/** Alias patterns that identify which statute a citation points at. */
const LAW_ALIASES = [
  { docId: 'ppc_1860', re: /\b(?:ppc|p\.?\s?p\.?\s?c\.?|penal code|pakistan penal code)\b|تعزیراتِ پاکستان/i, label: 'Pakistan Penal Code, 1860' },
  { docId: 'crpc_1898', re: /\b(?:crpc|cr\.?\s?p\.?\s?c\.?|code of criminal procedure|criminal procedure)\b|ضابطہ فوجداری/i, label: 'Code of Criminal Procedure, 1898' },
  { docId: 'constitution_1973', re: /\b(?:constitution|constitution of pakistan)\b|دستور پاکستان/i, label: 'Constitution of Pakistan, 1973' },
  { docId: 'peca_2016', re: /\b(?:peca|prevention of electronic crimes|electronic crimes act)\b/i, label: 'Prevention of Electronic Crimes Act, 2016' },
  { docId: 'court_procedures', re: /\b(?:court order|civil procedure|cpc|trial court procedure)\b/i, label: 'court procedure record' },
];

const PROVISION_TYPE_BY_UNIT = {
  section: 'SECTION', sec: 'SECTION', s: 'SECTION', dafa: 'SECTION',
  article: 'ARTICLE', art: 'ARTICLE',
};

const URDU_DIGIT_BASES = [0x06F0, 0x0660];
// Urdu/Persian digits to ASCII, non-breaking hyphen variants to "-".
function toAsciiDigits(text) {
  return String(text || '')
    .replace(/[۰-۹٠-٩]/g, (d) => {
      const code = d.charCodeAt(0);
      const base = URDU_DIGIT_BASES.find(b => code >= b && code <= b + 9);
      return base === undefined ? d : String(code - base);
    })
    .replace(/[‐-―−]/g, '-');
}

/**
 * Provision references written in a text.
 * A bare number is only treated as a citation when a unit word ("Section", "دفعہ")
 * is attached to it, because plain numbers appear in ordinary speech ("within 30
 * days"). A number joined to a single letter ("489-F") is distinctive enough to be
 * read as a provision on its own.
 * @param {string} text
 * @returns {Array<{raw: string, key: string, type: string|null, docIds: string[]}>}
 */
export function findProvisionCitations(text) {
  const src = toAsciiDigits(text);
  const found = [];
  const seen = new Set();
  const explicitKeys = new Set();

  // Unit word is captured explicitly: recovering it by subtracting the number
  // from the whole match mis-reads "Article 10-A" as a Section.
  const unitFirst = /(?<![A-Za-z])(sections?|sec\.?|s\.|articles?|art\.?|دفعہ|دفعات|سیکشن|آرٹیکل)\s*(?:no\.?\s*)?(\d{1,4}(?:\s*-?\s*[a-fA-F]{1,2})?)(?![a-zA-Z0-9])/gi;
  // "154 CrPC", "of the CrPC" — the number is only a provision when the law name
  // follows it directly, so the abbreviation cannot be eaten as a letter suffix.
  const lawAfter = /(?<![A-Za-z])(\d{1,4}(?:\s*-?\s*[a-fA-F]{1,2})?)\s*(?:of\s+(?:the\s+)?)?(ppc|crpc|peca|constitution)(?![a-z])/gi;
  const bareLettered = /\b(\d{1,3})[\s-]([a-fA-F]{1,2})\b/g;

  const windowAfter = 40;
  const windowBefore = 32;

  const push = (raw, numToken, unitWord, before, after, explicit = true) => {
    // Corpus keys are separator-free ("489f", "10a"); a citation writes "489-F".
    const num = toAsciiDigits(numToken).replace(/[\s-]+/g, '').toLowerCase();
    if (!/^\d{1,4}[a-f]{0,2}$/.test(num)) return;
    const key = num;
    // A number already written with its own unit word is settled: the
    // law-name/bare-letter passes default to SECTION and would mislabel a
    // Constitution article as a section, making a real citation unconfirmable.
    if (!explicit && (explicitKeys.has(key) || seen.has(key))) return;
    if (seen.has(key)) return;
    if (explicit) explicitKeys.add(key);
    seen.add(key);
    const typeMatch = unitWord
      ? PROVISION_TYPE_BY_UNIT[String(unitWord).toLowerCase().replace(/\.$/, '')]
      : null;
    const ctx = `${before} ${after}`;
    const docIds = LAW_ALIASES.filter(l => l.re.test(ctx)).map(l => l.docId);
    found.push({ raw: raw.trim(), key, type: typeMatch || null, docIds });
  };

  for (const m of src.matchAll(unitFirst)) {
    const end = m.index + m[0].length;
    push(m[0], m[2], m[1], src.slice(Math.max(0, m.index - windowBefore), m.index), src.slice(end, end + windowAfter));
  }
  for (const m of src.matchAll(lawAfter)) {
    const unit = /^constitution$/i.test(m[2]) ? 'article' : 'section';
    push(m[0], m[1], unit, src.slice(Math.max(0, m.index - windowBefore), m.index), m[2], false);
  }
  for (const m of src.matchAll(bareLettered)) {
    // A number hyphen-joined to a short letter is a provision, but never when it
    // sits inside a URL, a date or a money/percent figure.
    const before = src.slice(Math.max(0, m.index - 12), m.index);
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (/[a-z(]/i.test(before.slice(-1))) continue;
    if (/^\s*[%a-z0-9]/i.test(after)) continue;
    if (/https?:|\b(plz|pkr|rs|no|days?|months?|years?|percent|%)\b/i.test(`${before} ${after}`)) continue;
    push(m[0], `${m[1]}-${m[2]}`, 'section', before, after, false);
  }
  return found;
}

/** Chunks that carry the text of a numbered provision. */
export function provisionCatalog(chunks) {
  return (chunks || []).filter(
    c => c && /^\d{1,4}[a-z]{0,3}$/i.test(String(c.key || ''))
      && (c.type === 'SECTION' || c.type === 'ARTICLE'),
  );
}

function sameProvision(chunk, cite) {
  const key = String(chunk.key || '').toLowerCase();
  if (key !== cite.key) return false;
  if (cite.docIds.length && !cite.docIds.includes(chunk.docId)) return false;
  if (cite.type && chunk.type !== cite.type && chunk.type !== 'GENERAL') return false;
  return true;
}

/**
 * A procedure or civic record can QUOTE a provision ("issued under Section 9 & 10 of
 * the NADRA Ordinance") without being an atomized provision chunk, so sameProvision
 * alone calls its own citation unsupported. The number the evidence prints is evidence
 * for that number — and only for that number: a citation the evidence never writes
 * still falls through to notInEvidence / unknown.
 */
function evidenceStatesProvision(chunk, cite) {
  const text = `${chunk?.title || ''} ${chunk?.chunkTitle || ''} ${chunk?.text || ''}`;
  for (const c of findProvisionCitations(text)) {
    if (c.key !== cite.key) continue;
    if (cite.type && c.type && c.type !== cite.type) continue;
    if (cite.docIds.length && c.docIds.length && !c.docIds.some(d => cite.docIds.includes(d))) continue;
    return true;
  }
  return false;
}

/**
 * Check every provision a text cites against the evidence shown and the corpus.
 * @param {string} answerText composed answer
 * @param {Array} evidenceChunks chunks that were used for this answer
 * @param {Array} corpusChunks the whole index (for existence checks)
 * @returns {{checked:number, verified:object[], notInEvidence:object[], unknown:object[], clean:boolean}}
 */
export function auditCitations(answerText, evidenceChunks, corpusChunks) {
  const cites = findProvisionCitations(answerText);
  const catalog = provisionCatalog(corpusChunks);
  const out = { checked: cites.length, verified: [], notInEvidence: [], unknown: [], clean: true };
  for (const c of cites) {
    const inEvidence = (evidenceChunks || []).some(chunk => sameProvision(chunk, c) || evidenceStatesProvision(chunk, c));
    if (inEvidence) { out.verified.push(c); continue; }
    const exists = catalog.some(chunk => sameProvision(chunk, c));
    if (exists) { out.notInEvidence.push(c); } else { out.unknown.push(c); }
  }
  out.clean = out.notInEvidence.length === 0 && out.unknown.length === 0;
  return out;
}

const SUMMARY_LABELS = {
  en: {
    lead: 'Citation check:',
    notInEvidence: n => `The cited ${n} is real Pakistani law but was not part of the sources retrieved for this answer — confirm it against the official text before relying on it.`,
    unknown: n => `The cited ${n} was not found in the verified corpus, so it could not be confirmed. Please verify it with a lawyer or on pakistancode.gov.pk before using it.`,
    both: (a, b) => `Cited provisions not in the sources above: ${a}. Not found in the verified corpus: ${b}. Please verify before relying on them.`,
  },
  roman_urdu: {
    lead: 'Citation check:',
    notInEvidence: n => `Yeh cited ${n} asli Pakistani qanoon hai, magar is jawab ke sources mein shamil nahi tha — istemal se pehle official text se confirm kar lein.`,
    unknown: n => `Cited ${n} verified corpus mein nahi mila, is liye is ki tasdeeq nahi ho saki. Istemal se pehle kisi lawyer se ya pakistancode.gov.pk par check karein.`,
  },
};

/**
 * One localized sentence for the user, or null when everything cited is backed.
 * @param {object} audit result of auditCitations
 * @param {'en'|'roman_urdu'} lang
 */
export function citationAdvisory(audit, lang) {
  if (!audit || audit.clean || !audit.checked) return null;
  const L = lang === 'roman_urdu' ? SUMMARY_LABELS.roman_urdu : SUMMARY_LABELS.en;
  const fmt = list => list.map(c => `${c.type === 'ARTICLE' ? 'Article' : 'Section'} ${c.key}`).join(', ');
  const parts = [];
  if (audit.notInEvidence.length) parts.push(L.notInEvidence(fmt(audit.notInEvidence)));
  if (audit.unknown.length) parts.push(L.unknown(fmt(audit.unknown)));
  return {
    lead: L.lead,
    text: parts.join(' '),
    unverified: [...audit.notInEvidence, ...audit.unknown].map(c => c.raw).filter(Boolean),
    notInEvidence: fmt(audit.notInEvidence) || null,
    unknownProvisions: fmt(audit.unknown) || null,
  };
}
