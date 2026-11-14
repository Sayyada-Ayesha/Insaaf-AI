// ============================================================================
// server/docModel.js — Insaaf AI OWNED-MODEL LOCAL DOCUMENT ANALYZER (Part N/O/T)
// ----------------------------------------------------------------------------
// Analyzes uploaded document text entirely locally (no network, no external
// LLM). It is the document counterpart of ownedModel.js: when the Insaaf AI owned
// model is the primary provider, /api/ai/document-understanding composes its
// answer from THIS engine instead of giving up.
//
// NON-NEGOTIABLE: never fabricate. Every extracted value (party, date,
// authority, deadline, requested action) comes from the actual document text.
// General procedural guidance is qualified with "usually/normally" and specific
// deadlines/fees are stated ONLY when present in the text.
// ============================================================================

import { renderUrduReplyDocument, renderFullUrduDocument } from './docUrdu.js';
import { fillCourtLineTokens } from './courtLineTokens.js';

// --- Document-type classifiers (scored by keyword density) ------------------
const DOC_TYPE_RULES = [
  { type: 'Show-Cause Notice', score: t => count(t, /\bshow[\s-]?cause\b/gi) * 4 + count(t, /\bexplain why\b|\bwithin \d+ (?:days|day)\b.*\baction\b/gi) * 2 },
  { type: 'Legal Notice', score: t => count(t, /\blegal notice\b/gi) * 4 + count(t, /\bnotice\b/gi) * 2 + count(t, /\bunder instructions from\b|\bon behalf of\b|\bdemand\b/gi) * 2 },
  { type: 'Summons / Court Summons', score: t => count(t, /\bsummons\b|\bsummoned\b|\bnotice to appear\b/gi) * 4 + count(t, /\bappear before\b|\bcourt\b/gi) * 2 },
  { type: 'Court Order / Judgment', score: t => count(t, /\border(?:ed)?\b|\bjudgment\b|\bdecree\b|\bverdict\b/gi) * 3 + count(t, /\bit is (?:hereby )?(?:ordered|adjudged|declared)\b|\bcourt\b/gi) * 2 },
  { type: 'FIR / First Information Report', score: t => count(t, /\bf\.?i\.?r\.?\b|first information report/gi) * 4 + count(t, /\bpolice station\b|\bcomplainant\b|\baccused\b|\bsection \d+/gi) * 2 },
  // A bare "challan" is ambiguous: in a police file it is the report, in a
  // university it is a fee form. Only credit the criminal reading with police context.
  { type: 'Charge Sheet / Challan', score: t => count(t, /\bcharge[\s-]?sheet\b|\bfinal report\b.*\b173\b/gi) * 4 + (/\bpolice\b|\bc\.?r\.?p\.?c\.?\b|\btraffic\b|\boffence\b|\bfir\b/i.test(t) ? count(t, /\bchallan\b/gi) * 4 : 0) },
  { type: 'Bail Application', score: t => count(t, /\bbail\b/gi) * 4 + count(t, /\bapplication\b|\bsection 49[678]\b|\bpre-?arrest\b|\bpost-?arrest\b/gi) * 2 },
  { type: 'Complaint / Petition', score: t => count(t, /\bcomplaint\b|\bpetition\b|\bplaint\b/gi) * 3 + count(t, /\bcourt\b|\bfiled\b|\bprayer\b|\brespectfully\b/gi) * 2 },
  { type: 'Rental / Tenancy Agreement', score: t => count(t, /\brent\b|\btenant\b|\blandlord\b|\blease\b|\btenancy\b/gi) * 3 + count(t, /\bmonthly rent\b|\bsecurity deposit\b|\bpremises\b/gi) * 2 },
  { type: 'Employment Contract / Offer', score: t => count(t, /\bemploy(?:er|ment)\b|\bsalary\b|\bprobation\b|\bdesignation\b/gi) * 3 + count(t, /\bcontract\b|\boffer\b|\bappointment\b/gi) * 2 },
  { type: 'Agreement / Contract', score: t => count(t, /\bagreement\b|\bcontract\b|\bbetween\b.*\band\b|\bparties\b|\bwhereas\b/gi) * 3 },
  { type: 'Application / Request', score: t => count(t, /\bapplication\b|\brequest\b|\bapply\b|\bmost respectfully\b|\bit is (?:requested|submitted)\b/gi) * 3 },
  { type: 'Certificate', score: t => count(t, /\bcertificate\b|\bcharacter\b|\bthis is to certify\b/gi) * 4 },
  { type: 'Letter / Correspondence', score: t => count(t, /\bdear\b|\bsincerely\b|\bregards\b|\bsubject:\s|\bre:\s/gi) * 3 },
  // Student / university document classifiers
  { type: 'University ID Card', score: t => count(t, /\bidentity card\b|\bstudent card\b|\bidentity card\b.*\buniversity\b|\broll\s*no\b.*\bdepartment\b.*\buniversity\b|\bregistration card\b/gi) * 4 + count(t, /\benrollment no\b|\bfather'?s name\b|\bblood group\b|\bvalid upto\b|\bvalid till\b/gi) * 2 },
  { type: 'Fee Challan / Receipt', score: t => count(t, /\bfee\b.*\bchallan\b|\btuition fee\b|\bfee receipt\b|\bfee slip\b|\bfee challan\b/gi) * 4 + count(t, /\bsemester\b.*\bamount\b|\bamount due\b|\bamount paid\b|\bchallan\s*(?:form\s*)?no\b|\bdeposit date\b/gi) * 2 },
  { type: 'Transcript / Mark Sheet', score: t => count(t, /\btranscript\b|\bmark sheet\b|\bmarks?heet\b|\bgrade sheet\b|\bresult card\b|\bstatement of grades\b/gi) * 4 + count(t, /\bcredit hours?\b|\bgpa\b|\bcgpa\b|\bgrade point\b|\bsemester\s+\w+\s+results?\b|\bsubject\b.*\bmarks?\b/gi) * 2 },
  { type: 'Examination Admit Card', score: t => count(t, /\badmit card\b|\broll number slip\b|\bexamination\s+(?:admit|entry)\b|\bhall ticket\b|\bdate sheet\b|\bexam schedule\b/gi) * 4 + count(t, /\bexam centre\b|\bexamination centre\b|\bseat number\b|\btime\s+slot\b|\bpaper\s+(?:code|name)\b/gi) * 2 },
  { type: 'Hostel Allotment Letter', score: t => count(t, /\bhostel\b.*\ballot(?:ment)?\b|\bhostel\b.*\broom\b.*\ballot\b|\bhostel\b.*\baccommodation\b|\bhostel offer\b|\bhostel\b.*\bletter\b/gi) * 4 + count(t, /\broom no\b|\bhostel fee\b|\bhostel name\b|\bwarden\b|\bmes(?:s|sing)\b|\bhostel rules?\b/gi) * 2 }
];

// --- Authorities / forums recognised in Pakistani legal documents ----------
const AUTHORITY_RULES = [
  { name: 'Supreme Court of Pakistan', re: /\bsupreme court\b/i },
  { name: 'High Court', re: /\b(lahore|karachi|peshawar|quetta|islamabad|sindh|balochistan)?\s*high court\b/i },
  { name: 'Sessions Court / Judge', re: /\bsessions?\s+(?:court|judge)\b/i },
  { name: 'Civil Court / Judge', re: /\bcivil\s+(?:court|judge)\b/i },
  { name: 'Magistrate', re: /\bmagistrate\b/i },
  { name: 'Family Court', re: /\bfamily\s+court\b/i },
  { name: 'Consumer Court', re: /\bconsumer\s+court\b/i },
  { name: 'Labour Court', re: /\blabou?r\s+court\b/i },
  { name: 'Banking Court', re: /\bbanking\s+court\b/i },
  { name: 'Special / Anti-Terrorism Court', re: /\b(special|anti-?terrorism|ata)\s+court\b/i },
  { name: 'Tribunal', re: /\btribunal\b/i },
  { name: 'Justice of Peace', re: /\bjustice of (?:the )?peace\b/i },
  { name: 'Station House Officer (SHO)', re: /\b(?:sho|station house officer)\b/i },
  { name: 'Police Station', re: /\bpolice station\b|\bthana\b/i },
  { name: 'Superintendent of Police (SP/DSP)', re: /\b(?:sp|dsp|superintendent of police)\b/i },
  { name: 'Inspector General of Police (IG)', re: /\b(?:ig|inspector general)\b/i },
  { name: 'FIA (Federal Investigation Agency)', re: /\bfia\b|\bfederal investigation\b/i },
  { name: 'NADRA', re: /\bnadra\b/i },
  { name: 'Ombudsman / Mohtasib', re: /\b(?:ombuds(?:man|person)|mohtasib|wafaqi mohtasib)\b/i },
  { name: 'District Officer / Commissioner / DC / AC', re: /\b(?:commissioner|district officer|deputy commissioner|\bdc\b|assistant commissioner|\bac\b|district administration)\b/i },
  { name: 'Registrar', re: /\bregistrar\b/i },
  { name: 'Union Council / Tehsil', re: /\b(?:union council|tehsil|municipal)\b/i },
  { name: 'Bar Council', re: /\bbar council\b/i },
  { name: 'SECP', re: /\bsecp\b|\bsecurities and exchange\b/i },
  { name: 'State Bank of Pakistan', re: /\bstate bank\b/i },
  { name: 'EOBI', re: /\beobi\b/i },
  { name: 'Federal Board of Revenue (FBR)', re: /\bfbr\b|\bfederal board of revenue\b/i },
  // University / education authorities
  { name: 'University Administration', re: /\b(?:vice[\s-]?chancellor|pro[\s-]?vice[\s-]?chancellor|dean\b|provost\b|rector\b)\b/i },
  { name: 'University Registrar', re: /\b(?:university|college)\s+registrar\b|\bcontroller of examinations?\b/i },
  { name: 'Disciplinary Committee / Board', re: /\bdisciplinary (?:committee|board|committee|proceedings)\b|\banti[\s-]?ragging\b/i },
  { name: 'Anti-Harassment Inquiry Committee', re: /\binquiry committee\b|\banti[\s-]?harassment (?:committee|cell|inquiry)\b|\bprotection against harassment\b/i },
  { name: 'HEC (Higher Education Commission)', re: /\bhec\b|\bhigher education commission\b/i },
  { name: 'University Hostels Office', re: /\bhostel (?:office|administration|allotment|warden)\b/i },
  // The issuing institution itself, and the named offices inside it. Only an
  // explicit wording counts — an institution is never inferred from layout.
  { name: 'Educational Institution', re: /\b(?:university|college|institute|school|board of intermediate)\b/i },
  { name: 'Head of Department', re: /\bhead of (?:the )?department\b|\bh\.?o\.?d\.?\b/i },
  { name: 'Accounts Office', re: /\baccounts? office\b|\bfee section\b|\bbursar\b/i },
  { name: 'Bank / Bank Branch', re: /\bbank(?:ing)? branch\b|\bhbl\b|\bnbp\b|\bmezan bank\b|\balfalah\b|\b(?:UBL|MCB|Fayslabank|Faysal Bank)\b/i }
];

// --- Cross-border / foreign-jurisdiction detection -------------------------
// A document issued by a FOREIGN court/authority must be treated under THAT
// country's law, not Pakistani law. We detect an explicit foreign cue (a named
// foreign country or a foreign institution/authority term) so the analyzer can
// flag jurisdiction and route to a local lawyer + consular support instead of
// applying Pakistani procedure. Detection is conservative: it only reports a
// foreign country when it is actually named, and never invents rules.
const FOREIGN_JURISDICTION_COUNTRIES = [
  { country: 'United States', re: /\b(?:united states|u\.?s\.?a\.?|u\.s\.|america|california|new york|texas)\b/i },
  { country: 'United Kingdom', re: /\b(?:united kingdom|u\.?k\.?|england|scotland|wales|britain|london)\b/i },
  { country: 'Canada', re: /\b(?:canada|ontario|british columbia|toronto|vancouver)\b/i },
  { country: 'Australia', re: /\b(?:australia|new south wales|victoria\b.*australia|sydney|melbourne)\b/i },
  { country: 'Saudi Arabia', re: /\b(?:saudi arabia|saudi|riyadh|jeddah|makkah|madinah)\b/i },
  { country: 'UAE', re: /\b(?:u\.?a\.?e\.?|united arab emirates|dubai|abu dhabi|sharjah)\b/i },
  { country: 'Qatar', re: /\b(?:qatar|doha)\b/i },
  { country: 'Oman', re: /\b(?:oman|muscat)\b/i },
  { country: 'Bahrain', re: /\b(?:bahrain|manama)\b/i },
  { country: 'Kuwait', re: /\b(?:kuwait)\b/i },
  { country: 'Malaysia', re: /\b(?:malaysia|kuala lumpur)\b/i },
  { country: 'Germany', re: /\b(?:germany|german|berlin|munich)\b/i },
  { country: 'France', re: /\b(?:france|french|paris)\b/i },
  { country: 'Italy', re: /\b(?:italy|italian|rome)\b/i },
  { country: 'Spain', re: /\b(?:spain|spanish|madrid)\b/i },
  { country: 'Netherlands', re: /\b(?:netherlands|dutch|amsterdam)\b/i },
  { country: 'Switzerland', re: /\b(?:switzerland|swiss|zurich|geneva)\b/i },
  { country: 'Sweden', re: /\b(?:sweden|swedish|stockholm)\b/i },
  { country: 'Norway', re: /\b(?:norway|oslo)\b/i },
  { country: 'Denmark', re: /\b(?:denmark|copenhagen)\b/i },
  { country: 'Turkey', re: /\b(?:turkey|turkiye|türkiye|istanbul|ankara)\b/i },
  { country: 'China', re: /\b(?:china|chinese|beijing|shanghai)\b/i },
  { country: 'Japan', re: /\b(?:japan|japanese|tokyo)\b/i },
  { country: 'South Korea', re: /\b(?:korea|seoul)\b/i },
  { country: 'Singapore', re: /\b(?:singapore)\b/i },
  { country: 'Thailand', re: /\b(?:thailand|bangkok)\b/i },
  { country: 'Russia', re: /\b(?:russia|moscow)\b/i },
  { country: 'South Africa', re: /\b(?:south africa)\b/i },
  { country: 'Egypt', re: /\b(?:egypt|cairo)\b/i }
];
// Foreign institutional/authority signals that strongly indicate a non-Pakistani
// legal document even when only a country adjective appears.
const FOREIGN_AUTHORITY_SIGNALS = /\b(?:immigration and customs|uscis|visa (?:approval|denial|decision)|deportation|removal (?:order|notice)|green card|work permit|residence permit|social security number|ssn|ein|royal (?:police|court)|county court|district court|superior court|circuit court|high court of justice|home office|dvla|irrc|border force|australian taxation|internal revenue service)\b/i;

export function detectForeignJurisdiction(text) {
  const t = String(text || '');
  const hit = FOREIGN_JURISDICTION_COUNTRIES.find(c => c.re.test(t));
  const foreignAuthority = FOREIGN_AUTHORITY_SIGNALS.test(t);
  // Foreign only if a foreign country is named AND (it reads as an authority /
  // legal document) or a clear foreign-authority term is present.
  const isForeign = (hit && foreignAuthority) || foreignAuthority;
  return { country: hit ? hit.country : null, isForeign: !!isForeign };
}


// --- Date helpers ----------------------------------------------------------
const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december';
// Real documents abbreviate ("15 Mar 2026", "12 Sept 2025") and ISO-format
// ("2025-08-12") as often as they spell out, and all three were missed.
const MONTHS_ABBR = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';

/** Urdu (۰-۹) and Arabic-Indic (٠-٩) digits as ASCII, for date/amount matching. */
function toLatinDigits(s) {
  return String(s || '').replace(/[۰-۹]/g, ch => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660));
}

/** Rejects "1.200.500" / "2.24.1" style triples that are not calendar dates. */
function looksLikeDate(day, month, year) {
  const y = String(year).length === 2 ? 2000 + Number(year) : Number(year);
  return Number(day) >= 1 && Number(day) <= 31
    && Number(month) >= 1 && Number(month) <= 12
    && y >= 1900 && y <= 2100;
}

function count(text, re) {
  const m = String(text).match(re);
  return m ? m.length : 0;
}

function cleanLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

// Split into sentence-ish units for grounded summarisation.
// A period is only a sentence end when the word before it is not an
// abbreviation: "House No. 5", "Rs. 60,000" and "Adv. X Y Z" are one fact, and
// cutting there dropped the operative clause (vacate / rent / interest) from
// every summary of a Pakistani notice.
const SENTENCE_ABBREVIATIONS = new Set([
  'no', 'nos', 'rs', 'pkr', 'adv', 'dr', 'mr', 'mrs', 'ms', 'md', 'sr', 'jr',
  'ltd', 'pvt', 'inc', 'co', 'corp', 'vs', 'v', 'art', 'sec', 'ord', 'ref',
  'sl', 'approx', 'etc', 'ibid', 'cf', 'hon', 'jit', 'sahib', 'rahim', 'sallam'
]);

/** True when a chunk stops at an abbreviation mark rather than a real full stop. */
function endsAtAbbreviation(chunk) {
  const m = /([^\s./-]+)\.\s*$/.exec(chunk);
  if (!m) return false;
  const token = m[1].toLowerCase().replace(/[^a-z]/g, '');
  return SENTENCE_ABBREVIATIONS.has(token) || token.length === 1;
}

function sentences(text) {
  const parts = String(text)
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
  const merged = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && endsAtAbbreviation(prev)) merged[merged.length - 1] = `${prev} ${part}`;
    else merged.push(part);
  }
  return merged.map(s => s.trim()).filter(s => s.length > 25 && s.length < 600);
}

/** Classify the document type by keyword scoring. Returns {type, confidence}. */
export function classifyDocumentType(text) {
  const t = String(text || '');
  if (!t.trim()) return { type: null, confidence: 0 };
  let best = { type: null, confidence: 0 };
  for (const rule of DOC_TYPE_RULES) {
    const s = rule.score(t);
    if (s > best.confidence) best = { type: rule.type, confidence: s };
  }
  return best;
}

/** Extract dates WITH their surrounding context (never a bare invented date). */
export function extractDates(text) {
  const t = cleanLine(text);
  const rawLines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();
  const sents = sentences(t);
  const numericDate = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  const isoDate = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  const patterns = [
    numericDate,
    isoDate,
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\s*,?\\s+\\d{4}\\b`, 'gi'),
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'gi'),
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS_ABBR})\\.?\\s*,?\\s+\\d{4}\\b`, 'gi'),
    new RegExp(`\\b(?:${MONTHS_ABBR})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'gi'),
    /\bdated\s+[^\n.,;]{3,40}/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(t)) !== null && out.length < 8) {
      if (re === numericDate && !looksLikeDate(m[1], m[2], m[3])) continue;
      if (re === isoDate && !looksLikeDate(m[3], m[2], m[1])) continue;
      const raw = cleanLine(m[0]);
      // Quote the document's own sentence for this date when it is short enough;
      // a fixed character window cuts addresses and lists the same day twice.
      const whole = sents.find(s => s.includes(raw));
      const lineCtx = rawLines.find(l => l.includes(raw) && l.length <= 110);
      const start = Math.max(0, m.index - 45);
      const end = Math.min(t.length, m.index + raw.length + 45);
      let ctx = lineCtx || (whole && whole.length <= 110 ? whole : cleanLine(t.slice(start, end)));
      if (!lineCtx && (!whole || whole.length > 110)) {
        // A window that opens/closes inside a word shows a fragment (", Gulberg").
        if (start > 0 && !/\s/.test(t[start - 1])) ctx = ctx.replace(/^\S*\s*/, '');
        if (end < t.length && !/\s/.test(t[end])) ctx = ctx.replace(/\s*\S*$/, '');
        ctx = cleanLine(ctx.replace(/^["'(,.:;\u2014\u2013-]+/, ''));
      }
      const key = raw.toLowerCase().replace(/^dated\s+/, '');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(ctx.includes(raw) ? `${raw} — "${ctx}"` : raw);
      }
    }
  }

  // Urdu-script documents state dates as "15 مارچ 2026" or with Urdu digits
  // (۱۵/۰۳/۲۰۲۶). Both are normalised to a Latin date string and are pushed
  // WITHOUT the surrounding sentence, so the facts panel keeps the response
  // language instead of leaking Urdu script into an English/Roman answer.
  if (hasUrduScript(t) || /[۰-۹٠-۹]/.test(t)) {
    const digits = toLatinDigits(t);
    for (const [i, [urduMonth, englishMonth]] of URDU_MONTHS.entries()) {
      const re = new RegExp(`\\b(\\d{1,2})\\s+${urduMonth}\\s+(\\d{4})\\b`, 'g');
      let m;
      while ((m = re.exec(digits)) !== null && out.length < 8) {
        if (!looksLikeDate(m[1], i + 1, m[2])) continue;
        const raw = `${m[1]} ${englishMonth} ${m[2]}`;
        if (!seen.has(raw.toLowerCase())) { seen.add(raw.toLowerCase()); out.push(raw); }
      }
    }
    let m;
    const numericUrdu = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
    while ((m = numericUrdu.exec(digits)) !== null && out.length < 8) {
      if (!looksLikeDate(m[1], m[2], m[3])) continue;
      const raw = cleanLine(m[0]);
      if (!seen.has(raw.toLowerCase())) { seen.add(raw.toLowerCase()); out.push(raw); }
    }
  }

  // "Dated: 15 Mar 2026 at Lahore" and "15 Mar 2026" are the same date stated
  // once; compare the date token, not the whole quoted entry.
  const DATE_TOKEN = /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z'.]+,?\s+\d{4}|[A-Za-z'.]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/;
  const tokens = new Set();
  return out.filter(entry => {
    const head = String(entry).split(' — ')[0].replace(/^dated\s*[:,]?\s*/i, '').trim();
    const key = ((head.match(DATE_TOKEN) || [head])[0]).toLowerCase().replace(/\s+/g, ' ');
    if (tokens.has(key)) return false;
    tokens.add(key);
    return true;
  });
}

/** Stated deadlines / response periods, kept to the phrase the document uses. */
export function extractDeadlines(text) {
  const t = cleanLine(text);
  const out = [];
  const seen = new Set();
  const push = m => {
    let v = m[0];
    const end = m.index + v.length;
    // A bounded tail can stop inside a word; the partial token is not the
    // document's wording, so it goes rather than being shown truncated.
    if (t[end] && /[\w'-]/.test(t[end])) v = v.replace(/(\s|^)[\w'-]*$/, '');
    const clean = cleanLine(v);
    const key = clean.toLowerCase();
    if (clean.length > 6 && !seen.has(key)) { seen.add(key); out.push(clean.slice(0, 140)); }
  };

  // "within 15 working days" — the qualifier between the number and the unit is
  // part of the period, and requiring the unit right after the number lost it.
  const within = /\bwithin\s+(?:\d+|[a-z]+)(?:\s+[\w'-]+){0,3}\s+(?:days?|weeks?|months?|years?)\b/gi;
  let m;
  while ((m = within.exec(t)) !== null && out.length < 6) {
    push({ 0: m[0] + deadlineQualifier(t, m.index + m[0].length), index: m.index });
  }

  const patterns = [
    /\bnot later than\s+[^,.;\n]{3,60}/gi,
    // A challan or fee notice states its own deadline as a labelled date. The
    // label is kept in the matched text: "Deposit Date: 30-05-2026" is a payment
    // deadline, and the word is what stops it being read as a court response period.
    new RegExp(`\\b(?:deposit|payment|paying|due|last)[\\s\\-]+date\\s*[:=\\-]?\\s*\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}`, 'gi'),
    new RegExp(`\\b(?:deposit|payment|paying|due|last)[\\s\\-]+date\\s*[:=\\-]?\\s*(?:\\d{1,2}\\s+(?:${MONTHS}|${MONTHS_ABBR})|(?:${MONTHS}|${MONTHS_ABBR})\\s+\\d{1,2})\\b[^,.;\\n]{0,12}`, 'gi'),
    /\brespond\s+(?:within|by)\s+[^,.;\n]{3,60}/gi,
    /\blimitation\s+(?:period|of)\s+[^,.;\n]{3,60}/gi,
    /\bby\s+\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b[^,.;\n]{0,40}/gi,
    /\bfail(?:ure|ing)?\s+(?:to|which)\s+[^.;\n]{5,80}/gi,
    // Roman Urdu: "30 dinon ke andar", "15 working din", "25 March 2026 tak".
    /\b\d+\s*(?:dinon|dino|din|mahino|mahine|mah|haftay|hafte|hafta)\b(?:\s+(?:ke\s+)?andar)?/gi,
    /\b\d{1,2}\s+[\w'-]+\s+\d{4}\s+tak\b/gi,
    /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s+tak\b/gi
  ];
  for (const re of patterns) {
    while ((m = re.exec(t)) !== null && out.length < 6) push(m);
  }
  return out;
}

/** A short prepositional tail ("of receipt of this notice") in the document's own words. */
function deadlineQualifier(t, end) {
  const rest = t.slice(end, end + 60);
  const q = rest.match(/^\s+(?:of|from|after|upon|to|by|in)(?:\s[\w'’.\-]+){0,6}/i);
  if (!q) return '';
  // The tail is a phrase, not a clause. "…within 15 working days of issue. After
  // the due date a further penalty applies." is two sentences, and letting the
  // tail run past the full stop produced the deadline "within 15 working days of
  // issue. After the due date a" — a period that stops mid-sentence. A dot that
  // ends a sentence is followed by whitespace; a dot inside a date ("15.03.2026")
  // is not, so only the former cuts.
  const stop = q[0].search(/[.!?](?:\s|$)/);
  const phrase = stop === -1 ? q[0] : q[0].slice(0, stop);
  return phrase
    .replace(/\s+\b(?:under|as per|in case|failing|notwithstanding|subject to|read with|which|that|for the purpose|and|but)\b.*$/i, '')
    .replace(/\s+$/, '');
}

/** An office, not a person: without this filter a bare "Signed: <witness name>"
 *  line would be reported as the document's issuing authority. */
const OFFICE_WORD = /\b(?:officer|officiat|controller|registrar|commission|collector|deputy|assistant|manager|head|h\.?o\.?d|chairman|secretar|judg|magistr|committee|authorit|department|office|warden|principal|director|dean|auditor|treasur|nazir|bursar|board|section|branch|court|station|council|minister|mayor|bank|university|college|school|institute|hospital|company|ltd|limited|government|trust|society|police|tehsil|union)\w*/i;

/** The office a document names for itself, in its own words. */
function namedIssuingOffice(text) {
  const m = /^[ \t]*(?:issued|signed|certified|approved|prepared|signature)[ \t]*(?:by|u\/s)?[ \t]*[:\-–]?[ \t]+([A-Z][\w'&().\-\/ ]{2,70})/im
    .exec(String(text || ''));
  if (!m) return '';
  // The office ends where the document's own dating or place clause begins.
  const value = cleanLine(m[1].replace(/\s*[,;]?\s*(?:dated|dt\.?|on \d|this|at|place)\b.*$/i, ''));
  if (!value || /\d{4}/.test(value)) return '';
  if (!OFFICE_WORD.test(value)) return '';
  return value.slice(0, 70);
}

/** Extract authorities / courts / offices mentioned in the document. */
export function extractAuthorities(text) {
  const t = String(text || '');
  const out = [];
  const named = namedIssuingOffice(t);
  // The document's own wording first: every consumer of authorities[0] presents
  // it to the citizen as the authority NAMED in their document.
  if (named) out.push(named);
  for (const rule of AUTHORITY_RULES) {
    if (rule.re.test(t) && !out.includes(rule.name)) out.push(rule.name);
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Party extraction. Every rule reads a party LABEL (a To:/From: header, a role
 * word, "between X and Y", an honorific) and then takes only the proper-noun
 * sequence that follows it. A sequence that starts on a lowercase word is
 * prose, not a name — the earlier patterns matched "to" inside "Town" and
 * allowed a lowercase first letter, which produced parties such as "To: be",
 * "To: wn, Lahore." and "To: every paper is required."
 */
const PARTY_CONNECTOR = /^(?:is|was|name|called|namely|my|his|her|their|our|said|s\/o|r\/o|d\/o|a\/k\/o|w\/e)$/i;
const PARTY_HONORIFIC = 'Mr|Mrs|Ms|Mst|Dr|Prof|Advocate|Barrister|Syed|Mian|Chaudhry|Rao|Raja|Hon\'ble';
const PARTY_ROLES = [
  'petitioner', 'respondent', 'plaintiff', 'defendant', 'applicant', 'complainant',
  'accused', 'landlord', 'tenant', 'employer', 'employee', 'sender', 'recipient',
  'deponent', 'opposite party', 'judgment debtor', 'decree holder', 'lessor',
  'lessee', 'transferor', 'transferee',
  // Institutional records name the person by their role in the institution.
  'student', 'candidate', 'scholar', 'wardsman', 'holder', 'account holder',
  // Roman Urdu labels, kept in the document's own wording.
  'mukhatib', 'bewinder', 'kirayedar', 'kirayedaar', 'makaan malik', 'makan malik',
  'darkhwast khwah', 'darkhwast-khwah', 'darkhwastkhwah'
].join('|');

/** True for the short dotted abbreviations that sit inside a name ("Mr.", "S.K."). */
const isNameAbbrev = core => core.length > 0 && core.length <= 4 && !/[0-9]/.test(core);

// Form field labels that open a NEW field on the same line. A name ends where one
// of these begins, otherwise "Student Name: Bilal Ahmed Registration No: …"
// swallows the next field's label into the party.
const FIELD_LABEL_RE = /^(?:Registration|Reg|Roll|Form|Challan|Receipt|Amount|Total|Fee|Tuition|Semester|Session|Programme|Program|Department|Address|Date|Deposit|Payment|CNIC|NIC|BForm|Contact|Phone|Mobile|Email|Status|Signature|Bank|Branch|Class|Course|Voucher)$/i;

/**
 * Bound a name: keep Capitalised words, stop at the first lowercase word and at
 * a comma (which opens the address, not the name). A colon restarts the name so
 * "Employee Name: Mr. Kamran Ali" yields the person, not the label.
 */
function boundPartyName(value, opts = {}) {
  const { keepLeading = false, maxWords = 4 } = opts;
  const words = cleanLine(value).split(/\s+/).filter(Boolean);
  const kept = [];
  for (const raw of words) {
    const core = raw.replace(/[.,;:()\[\]"'\u2014\u2013\-]+$/g, '');
    if (!core) break;
    if (/:$/.test(raw) && kept.length === 0) continue;
    if (!keepLeading && !kept.length && !/[A-Z]/.test(core[0])) return '';
    if (kept.length && !/[A-Z]/.test(core[0])) break;
    // A following field label is not part of the name: institutional records run
    // "Student Name: Bilal Ahmed Registration No: FA24-BS-1029" on one line.
    if (kept.length && FIELD_LABEL_RE.test(core)) break;
    if (!kept.length && PARTY_CONNECTOR.test(core)) continue;
    kept.push(raw.endsWith('.') && isNameAbbrev(core) ? `${core}.` : core);
    if (/[,;:]$/.test(raw)) break;
    if (kept.length >= maxWords) break;
  }
  const name = kept.join(' ').trim();
  // A reference number is not a party ("Employee ID: EMP-2231", "Roll No. 2021-CS-114").
  if (/[0-9\u0660-\u0669\u06F0-\u06F9]/.test(name)) return '';
  return name.length > 1 && /[A-Z]/.test(name) ? name : '';
}

/** A header keyword starts the next field; it is never part of the party name. */
function stripHeaderTail(value) {
  return String(value || '').replace(/\s*\b(?:dated|dtd|date|ref|reference|re|subject|case\s*no|firal)\s*[:\-].*$/i, '');
}

export function extractParties(text) {
  const t = String(text || '').trim();
  const out = [];
  const seen = new Set();
  const push = v => {
    const c = cleanLine(v);
    if (!c || c.length < 2 || c.length > 90 || seen.has(c.toLowerCase())) return;
    if (out.some(o => o.toLowerCase().includes(c.toLowerCase()))) return;
    seen.add(c.toLowerCase());
    out.push(c);
  };

  // To / From / Addressee header. Accepted at the start of a line, or after a
  // sentence end when it carries an explicit colon.
  for (const line of t.split(/\r?\n/)) {
    const lm = line.match(/(?:^|(?<=[.;!]\s))\s*(to|from|addressee|addressed to|mukhatib)\b\s*[:,\-–]\s*(.+)$/i);
    if (!lm) continue;
    const name = boundPartyName(stripHeaderTail(lm[2]));
    // The header word ("To:", "From:") is document chrome, not part of the party.
    if (name) push(name);
    if (out.length >= 8) break;
  }

  // "Role: Name" / "role Name" — the role word is matched case-insensitively,
  // the name itself must start on a capital.
  const roleRe = new RegExp(`\\b(?:${PARTY_ROLES})\\b[\\s:,–-]*`, 'gi');
  let m;
  while ((m = roleRe.exec(t)) !== null && out.length < 8) {
    const label = cleanLine(m[0].replace(/[\s:,–-]+$/, ''));
    const rest = t.slice(m.index + m[0].length, m.index + m[0].length + 70);
    const name = boundPartyName(stripHeaderTail(rest));
    if (name && name.toLowerCase() !== label.toLowerCase()) push(`${label}: ${name}`);
  }

  // "Between <A> and <B>" / "<A> vs <B>". Guard: a pure date range such as
  // "between January and June 2026" is a period, NOT a party pairing.
  const between = t.match(/between\s+([^\n]{2,70}?)\s+and\s+([^\n.,]{2,70})/i);
  if (between) {
    const monthRe = new RegExp(`^(?:${MONTHS}|${MONTHS_ABBR})\\b`, 'i');
    const sideA = boundPartyName(between[1], { keepLeading: true, maxWords: 5 });
    const sideB = boundPartyName(between[2], { keepLeading: true, maxWords: 5 });
    if (sideA && sideB && !(monthRe.test(sideA) && monthRe.test(sideB))) { push(sideA); push(sideB); }
  }
  const vs = t.match(/([A-Z][\w.\s]{2,40}?)\s+(?:vs\.?|versus|v\.s\.?)\s+([A-Z][\w.\s]{2,40})/);
  if (vs) {
    push(boundPartyName(vs[1], { keepLeading: true, maxWords: 5 }) || cleanLine(vs[1]));
    push(boundPartyName(vs[2], { keepLeading: true, maxWords: 5 }) || cleanLine(vs[2]));
  }

  // Honorific names anywhere in the document ("Mr. Ahmad Raza Khan, resident of…").
  const hon = new RegExp(`\\b(?:${PARTY_HONORIFIC})\\.?\\s+[A-Z][\\w'-]*(?:\\s+[A-Z][\\w'-]*){0,3}`, 'g');
  while ((m = hon.exec(t)) !== null && out.length < 8) push(cleanLine(m[0]).replace(/[,;:]+$/, ''));

  return out.slice(0, 8);
}

/** Extract what the document asks the recipient to do (requested action). */
export function extractRequestedAction(text) {
  const t = cleanLine(text);
  const out = [];
  const seen = new Set();
  const patterns = [
    /\byou are (?:hereby )?(?:required|directed|ordered|advised|called upon|notified|requested)\s+to\s+[^.;\n]{3,120}/gi,
    /\bit is (?:hereby )?(?:ordered|directed|requested|advised)\s+(?:that\s+)?[^.;\n]{3,120}/gi,
    /\b(?:appear|submit|pay|respond|reply|vacate|cease|desist|produce|attend)\b[^.;\n]{3,90}/gi,
    /\bshow cause\b[^.;\n]{0,90}/gi,
    /\bprayer\b|prayed that\s+[^.;\n]{3,120}/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(t)) !== null && out.length < 6) {
      const raw = cleanLine(m[0]).slice(0, 160);
      const key = raw.toLowerCase().slice(0, 40);
      if (!seen.has(key)) { seen.add(key); out.push(raw); }
    }
  }
  return out;
}

/** Detect statutory provisions cited in the document ("under section X of Y"). */
export function extractProvisions(text) {
  const t = String(text || '');
  const out = [];
  const re = /\b(?:section|sec\.?|article|art\.?|dafa|order|rule)\s*\.?\s*\d+[a-z]?(?:\s*(?:of|\/|crpc|ppc|cpc|peca|cpc)\s*[a-z0-9 ]{0,30})?/gi;
  let m;
  while ((m = re.exec(t)) !== null && out.length < 6) {
    const raw = cleanLine(m[0]).replace(/[.,;:\s]+$/, '').slice(0, 70);
    if (!out.some(o => o.toLowerCase() === raw.toLowerCase())) out.push(raw);
  }
  return out;
}

/** Extract case numbers / reference numbers from the document. */
export function extractCaseNumbers(text) {
  const t = String(text || '');
  const out = [];
  const seen = new Set();
  const patterns = [
    /\b(?:case|suit|petition|appeal|revision|FIR|complaint)\s*(?:no\.?|number|#)\s*\.?\s*[\w\-\/]+(?:\s*of\s*\d{4})?/gi,
    /\b[\w\-]+\/\d{2,4}(?:\/\d{2,4})?\b/g,
    /\b(?:CPLC|SHO|SSP|DIG|CP|DI|Sessions|Civil Judge)\s*(?:no\.?|ref|reference|#)\s*\.?\s*[\w\-\/]+/gi,
    /\bRoll\s*(?:no\.?|number|#)\s*\.?\s*[\w\-\/]+/gi,
    /\b(?:challan|form|token|receipt|memo|diary)\s*(?:no\.?|number|#)\s*\.?\s*[\w\-\/]+(?:\s*of\s*\d{4})?/gi,
    /\bRegistration\s*(?:no\.?|number|#)\s*\.?\s*[\w\-\/]+/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(t)) !== null && out.length < 6) {
      const raw = cleanLine(m[0]).slice(0, 80);
      const key = raw.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(raw); }
    }
  }
  return out;
}

/** Resolve a matched money phrase to a canonical currency + numeric value. */
function amountKey(raw) {
  const s = String(raw).toLowerCase();
  const digits = (s.match(/[\d,]+/g) || []).sort((a, b) => b.length - a.length)[0];
  if (!digits) return '';
  let value = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return '';
  const mult = [
    ['lakh', 1e5], ['lac', 1e5], ['لاکھ', 1e5],
    ['kharab', 1e7], ['kharah', 1e7], ['crore', 1e7], ['croar', 1e7], ['کروڑ', 1e7],
  ].find(([word]) => new RegExp(`\\b${word}\\b`).test(s));
  if (mult) value *= mult[1];
  let cur = 'other';
  if (/(rs\.?|pkr|rupees|rupay|rupaye|rupiya|روپیہ|روپے)/.test(s)) cur = 'pkr';
  else if (/usd|\$/.test(s)) cur = 'usd';
  else if (/gbp/.test(s)) cur = 'gbp';
  else if (/sar/.test(s)) cur = 'sar';
  else if (/aed/.test(s)) cur = 'aed';
  return `${cur}:${value}`;
}

/** Urdu-script documents state money as "۵ لاکھ روپے". The facts panel keeps the
 *  response language, so such an amount is reported in its canonical Latin
 *  reading instead of leaking Urdu words into an English or Roman Urdu answer —
 *  the same rule extractDates follows for Urdu dates. */
function latinAmount(raw) {
  if (!hasUrduScript(raw)) return raw;
  const s = String(raw).toLowerCase();
  const num = (s.match(/[\d,.]+/) || [''])[0].replace(/[.,]+$/, '');
  const val = Number(num.replace(/,/g, ''));
  if (!num || !Number.isFinite(val) || val <= 0) return raw;
  const mult = /لاکھ/.test(s) ? ' lakh' : /کروڑ/.test(s) ? ' crore' : '';
  const cur = /روپیہ|روپے/.test(s) ? 'Rs ' : '';
  return `${cur}${val.toLocaleString('en-US')}${mult}`;
}

/** Extract monetary amounts mentioned in the document. */
export function extractAmounts(text) {
  // Urdu digits (۵۰،۰۰۰) and the Arabic comma thousands separator are normalised
  // first. Both maps are 1:1, so the match offsets below still address the text
  // the caller passed in, and Latin/Roman input is untouched.
  const t = toLatinDigits(String(text || '')).replace(/،/g, ',');
  const out = [];
  const seen = new Set();
  // "Rs 2 lakh" must resolve to ONE fact. Without the multiplier group the
  // currency pattern stops after the digits and leaves a bare "Rs 2" behind.
  const MULT = String.raw`(?:\s*(?:lakh|lac|kharab|kharah|crore|croar|لاکھ|کروڑ))?`;
  const patterns = [
    new RegExp(String.raw`(?:Rs\.?|PKR|rupees|rupay|rupaye|rupiya|روپیہ|روپے|amount)\s*\.?\s*[\d,]+(?:\.\d{2})?${MULT}(?:\s*(?:only|\/-))?`, 'gi'),
    // `\b` cannot follow an Urdu letter, so the end of the phrase is asserted with
    // a zero-width terminator instead — it still blocks matches inside a word.
    new RegExp(String.raw`[\d,]+(?:\.\d{2})?${MULT}\s*(?:rupees|rupay|rupaye|rupiya|PKR|Rs\.?|روپیہ|روپے)(?=\s|$|[,.;:!])`, 'gi'),
    /\$\s*[\d,]+(?:\.\d{2})?/g,
    /(?:USD|GBP|SAR|AED|GBP)\s*[\d,]+(?:\.\d{2})?/gi,
    new RegExp(String.raw`\b\d+(?:\.\d+)?\s*(?:lakh|lac|kharab|kharah|crore|croar|لاکھ|کروڑ)(?![A-Za-z])`, 'gi'),
    /(?:fine|penalty|damages|compensation|refund|recovery|claim|fee|rent|salary|wage|dues|arrears|outstanding|jurmana|kiraya|tankhwa|maqda)\s*(?:of|:)?\s*(?:Rs\.?|PKR)?\s*[\d,]+(?:\.\d{2})?/gi
  ];
  const spans = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(t)) !== null && out.length < 6) {
      const start = m.index;
      const end = m.index + m[0].length;
      // An earlier pattern already claimed this figure (or a wider phrase
      // around it); a partial re-match would surface a truncated amount.
      if (spans.some(([s, e]) => start < e && end > s)) continue;
      spans.push([start, end]);
      const raw = cleanLine(m[0]).slice(0, 80);
      const key = amountKey(raw) || raw.toLowerCase().replace(/\s+/g, ' ');
      if (!seen.has(key)) { seen.add(key); out.push(latinAmount(raw)); }
    }
  }
  return out;
}

/** Detect unusual or onerous clauses in contracts/agreements. */
function detectUnusualClauses(text, isRoman) {
  const t = String(text || '');
  const findings = [];
  const patterns = [
    { en: 'Automatic renewal without notice', ur: 'Baghair notice ke khud ba khud tajdeed', re: /\b(?:auto(?:matic)?\s+renew|renew\s+auto(?:matic)?(?:ally)?|khud\s+ba\s+khud\s+tajdeed|خود\s*با\s*خود\s*تجدید)\b[^.;\n]{0,80}/gi },
    { en: 'Unlimited liability', ur: 'La-mehdood zimmedari', re: /\b(?:unlimited\s+liab|no\s+limit\s+(?:on|to)\s+liab|la[\s-]?mehdood\s+zimmedari|لامحدود\s*ذمہ\s*داری)\b[^.;\n]{0,80}/gi },
    { en: 'Waiver of legal rights', ur: 'Qanooni huqooq se dastbardari', re: /\b(?:waiv(?:e|er|ing)\s+(?:all\s+)?(?:legal\s+)?right|irrevocable\s+waiver)\b[^.;\n]{0,80}/gi },
    { en: 'Unilateral termination', ur: 'Aik tarfa khatma', re: /\b(?:either\s+party\s+may\s+terminat|may\s+terminat(?:e|ion)\s+(?:at\s+any\s+time|without\s+(?:notice|cause|reason))|ek\s+tarfa\s+(?:takhleea|khatma|tanah)|aik\s+tarfa\s+(?:takhleea|khatma|tanah))\b[^.;\n]{0,80}/gi },
    { en: 'Non-compete / restraint of trade', ur: 'Ghair-muqabla / trade ki pabandi', re: /\b(?:non[\s-]?compete|restraint\s+of\s+trade|shall\s+not\s+(?:compete|engage|work)\s+(?:in|for|with))\b[^.;\n]{0,80}/gi },
    { en: 'Penalty clause', ur: 'Jurmana ki shart', re: /\b(?:penalty|liquidated\s+damages)\s*(?:of|shall\s+be)?\s*[^.;\n]{0,80}/gi },
    { en: 'Confidentiality with broad scope', ur: 'Wasee daayre mein raazdari', re: /\b(?:confidential(?:ity)?\s+(?:shall|will|must|extends?))\b[^.;\n]{0,80}/gi },
    { en: 'Jurisdiction in distant forum', ur: 'Door adalat mein ikhtiyar', re: /\b(?:jurisdiction|governed\s+by|subject\s+to)\s+(?:the\s+)?(?:courts\s+of|laws\s+of)\s+[^.;\n]{3,60}/gi },
    { en: 'Indemnity obligation', ur: 'Talfi ki zimmedari', re: /\b(?:shall\s+indemnif|indemnif(?:y|ication)\s+(?:the|against|hold))\b[^.;\n]{0,80}/gi },
    { en: 'Forced arbitration', ur: 'Zabardasti salami', re: /\b(?:mandatory\s+arbitration|binding\s+arbitration|disputes?\s+(?:shall|will)\s+be\s+(?:referred|resolved)\s+(?:to|by)\s+arbitr)/gi }
  ];
  for (const p of patterns) {
    const m = t.match(p.re);
    if (m) {
      for (const hit of m.slice(0, 1)) {
        const label = isRoman ? p.ur : p.en;
        findings.push(`${label}: "${cleanLine(hit).slice(0, 120)}"`);
      }
    }
  }
  return findings.slice(0, 5);
}

/** Detect inconsistencies within the document text. */
function detectInconsistencies(text, isRoman) {
  const t = String(text || '');
  const findings = [];
  const dates = extractDates(t);
  if (dates.length >= 2) {
    const dateValues = dates.map(d => {
      const m = d.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (m) return new Date(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`);
      return null;
    }).filter(Boolean);
    if (dateValues.length >= 2 && dateValues[0] > dateValues[1]) {
      findings.push(isRoman
        ? `Tareekhi tarteeb mein ikhtilaf ho sakta hai: "${dates[0]}" pehle aata hai "${dates[1]}" se lekin waqai mein baad ki hai.`
        : `Date order may be inconsistent: "${dates[0]}" appears before "${dates[1]}" but is chronologically later.`);
    }
  }
  const amounts = extractAmounts(t);
  if (amounts.length >= 3) {
    const nums = amounts.map(a => {
      const m = a.match(/[\d,]+(?:\.\d{2})?/);
      return m ? parseFloat(m[0].replace(/,/g, '')) : null;
    }).filter(n => n !== null && n > 0);
    if (nums.length >= 2 && nums[0] !== nums[1] && /total|sum|aggregate/i.test(t)) {
      findings.push(isRoman
        ? 'Yahan kai raqamein hain — tasdeeq karen ke infaradi raqamein kul jumla ke barabar hain.'
        : 'Multiple amounts detected — verify that individual amounts add up to the stated total.');
    }
  }
  if (/\btenant\b/i.test(t) && /\blandlord\b/i.test(t)) {
    const nameAsTenant = t.match(/tenant\s*[:\-–]\s*([A-Z][\w. ]{2,40})/i);
    const nameAsLandlord = t.match(/landlord\s*[:\-–]\s*([A-Z][\w. ]{2,40})/i);
    if (nameAsTenant && nameAsLandlord && cleanLine(nameAsTenant[1]).toLowerCase() === cleanLine(nameAsLandlord[1]).toLowerCase()) {
      findings.push(isRoman
        ? `Wahi naam "${cleanLine(nameAsTenant[1])}" kirayedar aur malik dono ke tor par — shayad kirdar ki uljhan ho.`
        : `Same name "${cleanLine(nameAsTenant[1])}" appears as both tenant and landlord — possible role confusion.`);
    }
  }
  return findings.slice(0, 3);
}

/** Detect ambiguous wording in the document. */
function detectAmbiguousWording(text, isRoman) {
  const t = String(text || '');
  const findings = [];
  const patterns = [
    { en: 'Vague time reference', ur: 'Wazeh waqt ka hawala nahi', re: /\b(?:within\s+(?:a\s+)?reasonable\s+time|as\s+soon\s+as\s+possible|in\s+due\s+course|at\s+the\s+earliest)\b/gi },
    { en: 'Undefined term used', ur: 'Bina-tareef lafz istemal hua', re: /\b(?:the\s+(?:said|said)\s+(?:matter|thing|item|goods|property|services))\b(?![^.]*(?:defined|means|shall\s+mean))/gi },
    { en: '"As applicable" without specifics', ur: '"Jaisa qabil-e-atlaq" baghair tafseel', re: /\b(?:as\s+(?:applicable|may\s+be\s+applicable|deemed\s+fit))\b/gi },
    { en: '"Subject to" without reference', ur: '"Mashroot" baghair hawala', re: /\b(?:subject\s+to\s+(?:change|modification|terms|conditions|approval))\b(?![^.]*(?:of|the\s+\w+\s+dated))/gi }
  ];
  for (const p of patterns) {
    const m = t.match(p.re);
    if (m) {
      const label = isRoman ? p.ur : p.en;
      findings.push(`${label}: "${cleanLine(m[0]).slice(0, 80)}"`);
    }
  }
  return findings.slice(0, 4);
}

/** Detect missing information that a complete document of this type should have. */
function detectMissingInfo(text, docType, isRoman) {
  const t = String(text || '');
  const findings = [];
  const dt = String(docType || '').toLowerCase();
  if (/notice|summons|show[\s-]?cause/i.test(dt)) {
    if (!/\b(?:CNIC|identity|ID)\b/i.test(t)) findings.push(isRoman ? 'Mukhatib ka CNIC/identity number nahi mila.' : 'No CNIC/identity number of the addressee detected.');
    if (!extractDeadlines(t).length) findings.push(isRoman ? 'Jawab ki mohlat nahi mili — notices mein aam tor par hoti hai.' : 'No response deadline detected — notices normally carry one.');
  }
  if (/agreement|contract|rent|tenancy|employment/i.test(dt)) {
    if (!extractAmounts(t).length) findings.push(isRoman ? 'Koi mali raqam (kiraya, tankhwa, badla) nahi mili.' : 'No monetary amount (rent, salary, consideration) detected.');
    if (!/\b(?:witness|witnesses|gawah|gawahan|گواہ|گواہان)\b/i.test(t)) findings.push(isRoman ? 'Gawahan ke naam nahi mile — agreements mein aam tor par kam az kam do hote hain.' : 'No witness names detected — agreements normally have at least two.');
    if (!/\b(?:sign(?:ature|ed)?|dastakhat|dastkhat|sahihat|دستخط)\b/i.test(t) && !/\bthumb\s+impression\b/i.test(t)) findings.push(isRoman ? 'Dastakhat ka hissa nahi mila.' : 'No signature block detected.');
  }
  if (/fir|complaint|criminal/i.test(dt)) {
    if (!/\b(?:section|sec\.?)\s*\d+/i.test(t)) findings.push(isRoman ? 'Koi qanooni dhara (PPC/ghair qanoon) nahi mili.' : 'No penal section (PPC/other law) detected.');
  }
  if (/application|petition/i.test(dt)) {
    if (!/\bTo,?\s/i.test(t) && !/\b(?:addressed\s+to|directed\s+to)\b/i.test(t)) findings.push(isRoman ? 'Mukhatib ki line ("To,") nahi mili.' : 'No addressee ("To,") line detected.');
  }
  return findings.slice(0, 5);
}

// --- Urdu-script sources read into Roman Urdu -------------------------------
// Every extractor above keys off ASCII/English labels, so an Urdu-script
// document yields no facts at all and summarize() used to paste the Urdu-script
// sentences straight into a Roman Urdu response. These tables read a bounded set
// of high-frequency Urdu legal-document words so the Roman response is rebuilt
// semantically (what the document is, plus the numbers it states) instead of
// being transliterated character-by-character, which would distort legal wording.
const URDU_SCRIPT_RE = /[\u0600-\u06FF]/;
const hasUrduScript = s => URDU_SCRIPT_RE.test(String(s || ''));

const URDU_MONTHS = [
  ['جنوری', 'January'], ['فروری', 'February'], ['مارچ', 'March'], ['اپریل', 'April'],
  ['مئی', 'May'], ['جون', 'June'], ['جولائی', 'July'], ['اگست', 'August'],
  ['ستمبر', 'September'], ['اکتوبر', 'October'], ['نومبر', 'November'], ['دسمبر', 'December']
];

// Urdu legal-document terms -> Roman Urdu gloss (English cue in brackets).
const URDU_TOPICS = [
  [/کرایہ\s*نامہ/, 'kiraya naamah (rent agreement)'],
  [/کرایہدار|کرایہ\s*دار|تخلیہ|کرایہ/, 'kiraya / kirayedar (rent, tenant, eviction)'],
  [/مکان|پلاٹ|جائیداد|زمین/, 'makan / jaidad (house, plot, property)'],
  [/تنخواہ|معاش|ماہوار/, 'tankhwa / mahwar (salary, monthly)'],
  [/معاہدہ/, 'muadah (contract, agreement)'],
  [/شروط|شرائط/, 'shartain (terms and conditions)'],
  [/میعاد|مدت/, 'muddat / mayaad (period, term)'],
  [/آخری\s*تاریخ|مہلت|تاریخ/, 'tareekh / mohlat (date, time allowed to reply)'],
  [/ادا|تسویہ|وصول/, 'ada / wasooli (payment, recovery)'],
  [/جرمانہ/, 'jurmana (fine, penalty)'],
  [/تاوان|معاوضہ|نقصان/, 'tauan / muawza (compensation, damages)'],
  [/ذمہ\s*داری|لامحدود|مسئول/, 'zimmedari (liability; la-mehdood = unlimited)'],
  [/خود\s*بخود|خود\s*با\s*خود|تجدید/, 'khud ba khud tajdeed (automatic renewal)'],
  [/ایک\s*طرفہ/, 'aik tarfa (one-sided)'],
  [/گواہان|گواہ/, 'gawah / gawahan (witnesses)'],
  [/دستخط|خط\s*و\s*مہر/, 'dastakhat (signature)'],
  [/مخاطب|خطاب/, 'mukhatib (addressee)'],
  [/نکاح|شادی|مہر/, 'nikkah / mehr (marriage, dower)'],
  [/طلاق|خلع/, 'talaq / khula (divorce)'],
  [/نفقہ|خورد\s*و\s*نوش/, 'nafqa (maintenance)'],
  [/حضان|حظانت|بچوں/, 'hizanat (child custody)'],
  [/وارث|تقسیمی/, 'waris / taqseemi (heirs, inheritance)'],
  [/وصیت/, 'wasiyat (will)'],
  [/اختیار\s*نامہ/, 'ikhtiyar naamah (power of attorney)'],
  [/بیع\s*نامہ|فروخت|رجسٹری|انتقال/, 'baye naamah / registry (sale deed, transfer)'],
  [/ایف\s*آئی\s*ار|فریاد|ملزم|تھانہ|پولیس/, 'FIR / thana (crime report, police)'],
  [/ضمانت/, 'zamanat (bail)'],
  [/چیک|قرض|سود|ادھار/, 'qarz / cheque (loan, cheque)'],
  [/نوٹس|اطلاع/, 'notice / itla (notice, intimation)'],
  [/عدالت|کچہری|منصف|جج/, 'adalat (court, judge)'],
  [/حکم|فیصلہ|ڈگری/, 'hukm / faisla (order, judgment, decree)'],
  [/اظہارنامہ|ہلفی/, 'izhar naamah / hulfi (affidavit)'],
  [/درخواست|الزام/, 'darkhwast / ilzaam (application, claim)'],
  [/شکایت|ہراساں|ظلم/, 'shikayat / harassment (complaint, harassment)'],
  [/صارف|معیب/, 'saif / mayeeb (consumer, defective product)'],
  [/بجلی|گیس|بل/, 'bill (utility charges)'],
  [/فیس|امتح|نتیجہ|ٹرانسکرپٹ|ہاسٹل/, 'fee / imtihan / result (student record)']
];

// Urdu-script heading -> document kind, used ONLY for the Roman summary line.
// It is deliberately not fed back into analyzeDocumentText's documentType: the
// Roman "missing information" findings assume the ASCII extractors saw the whole
// document, so an Urdu-script document typed as an agreement would wrongly be
// reported as having no amount / no witnesses.
const URDU_DOC_KINDS = [
  { type: 'Rental / Tenancy Agreement (kiraya naamah)', re: /کرایہ\s*نامہ|کرایہ\s*داری/ },
  { type: 'Employment Contract / Appointment Letter', re: /تقرری\s*نامہ|تنخواہ|ملازمت/ },
  { type: 'Sale Deed / Transfer Document', re: /بیع\s*نامہ|رجسٹری|انتقال\s*نامہ/ },
  { type: 'Legal Notice', re: /قانونی\s*نوٹس/ },
  { type: 'Bail Application', re: /ضمانت/ },
  { type: 'Family Matter (nikkah / talaq / nafqa)', re: /طلاق|خلع|نفقہ|حضان|مہر\s*نامہ/ },
  { type: 'Affidavit / Declaration', re: /اظہارنامہ|ہلفی|تصدیق/ },
  { type: 'Complaint / Petition', re: /فریاد|شکایت|درخواست/ },
  { type: 'Application / Request', re: /درخواست/ }
];

/** Keep the ASCII identifier of a fact token, drop its Urdu-script context. */
function keepRomanPart(v) {
  const s = cleanLine(v);
  if (!hasUrduScript(s)) return s;
  const head = s.includes(' — ') ? s.split(' — ')[0] : s;
  const cut = head.split(URDU_SCRIPT_RE)[0].replace(/[\s,;:.\-–—"'()]+$/, '').trim();
  return cut.length > 1 ? cut : null;
}

const URDU_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function normalizeUrduDigits(v) {
  return String(v).replace(/[۰-۹]/g, d => String(URDU_DIGITS.indexOf(d)));
}

/** Amounts stated in an Urdu-script document: digits kept, currency romanised. */
function extractUrduAmounts(text) {
  const t = normalizeUrduDigits(String(text || ''));
  const out = [];
  for (const m of t.matchAll(/([\d][\d,.]*)\s*(?:روپیہ|روپے)/g)) {
    const v = `${m[1].replace(/[.,]+$/, '')} rupay`;
    if (!out.includes(v)) out.push(v);
    if (out.length >= 4) break;
  }
  return out;
}

/** Dates stated in an Urdu-script document: digits kept, month written Roman. */
function extractUrduDates(text) {
  const t = normalizeUrduDigits(String(text || ''));
  const out = [];
  for (const [ur, en] of URDU_MONTHS) {
    for (const m of t.matchAll(new RegExp(`(\\d{1,2})\\s*${ur}\\s*(\\d{4})`, 'g'))) {
      const v = `${m[1]} ${en} ${m[2]}`;
      if (!out.includes(v)) out.push(v);
    }
  }
  return out.slice(0, 4);
}

function matchUrduTopics(text) {
  const t = String(text || '');
  const hits = [];
  for (const [re, roman] of URDU_TOPICS) {
    if (re.test(t) && !hits.includes(roman)) hits.push(roman);
    if (hits.length >= 6) break;
  }
  return hits;
}

function detectUrduDocKind(text) {
  const t = String(text || '');
  for (const rule of URDU_DOC_KINDS) if (rule.re.test(t)) return rule.type;
  return null;
}

/** Share of the letter characters that are Urdu script (0..1). */
function urduShare(s) {
  const str = String(s || '');
  const all = (str.match(/[\u0600-\u06FFA-Za-z]/g) || []).length;
  if (!all) return 0;
  return (str.match(/[\u0600-\u06FF]/g) || []).length / all;
}

/**
 * Summary-sized units of a document. sentences() splits only on [.!?] followed by an
 * uppercase/digit boundary, so a challan, receipt or form whose lines carry no
 * punctuation, and Urdu-script text whose sentence terminator is \u06D4, all yield zero
 * sentences, and the whole document used to be pasted back as its own "summary". This
 * splits on the separators the document actually uses.
 */
function summaryUnits(text) {
  return String(text || '')
    .split(/[\r\n;|]+|(?<=[.!?])\s+|(?<=[.!?\u06D4])/)
    .map(s => cleanLine(s))
    .filter(s => s.length >= 12 && s.length <= 400);
}

/**
 * Share of a document's lines that are `Label: value` form fields rather than
 * prose. A challan, receipt or application form is mostly field lines; a notice
 * or agreement is not. The label must be short and free of sentence periods, so
 * "Ref: LN/2026/77 dated 10 February 2026." counts as prose while
 * "Deposit Date: 30-05-2026" counts as a field.
 */
function fieldLineShare(text) {
  const units = summaryUnits(text);
  if (units.length < 2) return 0;
  const fields = units.filter(u => /^[A-Z][^.:\n]{1,32}:\s*\S/.test(u)).length;
  return fields / units.length;
}

/**
 * A lead sentence built ONLY from facts already extracted from this document, so a
 * form-style record reads as a summary instead of a verbatim dump. Returns null when
 * the document yielded no facts at all, leaving the caller's fallback in charge.
 */
function factLead(docType, isRoman, facts = {}) {
  const first = arr => (Array.isArray(arr) && arr.length ? String(arr[0]) : '');
  const parties = Array.isArray(facts.parties) ? facts.parties.filter(Boolean) : [];
  const bits = [];
  if (parties.length) {
    bits.push(isRoman ? `naam: ${parties.slice(0, 3).join('; ')}`
      : `it names ${parties.slice(0, 3).join('; ')}`);
  }
  const amount = first(facts.amounts);
  if (amount) bits.push(isRoman ? `raqam ${amount} likhi hai` : `states a sum of ${amount}`);
  const deadline = first(facts.deadlines) || first(facts.dates);
  if (deadline) bits.push(isRoman ? `tareekh/mohlat ${deadline}` : `gives the date ${deadline}`);
  const authority = first(facts.authorities);
  if (authority) bits.push(isRoman ? `jarii karne wala: ${authority}` : `issued by ${authority}`);
  const requirement = first(facts.requirements);
  if (requirement) {
    bits.push(isRoman ? `maonga: ${requirement.slice(0, 120)}` : `asks for: ${requirement.slice(0, 120)}`);
  }
  if (!bits.length) return null;
  const head = docType
    ? (isRoman ? `Yeh aik "${docType}" lagta hai` : `This appears to be a ${docType}`)
    : (isRoman ? 'Dastawez ka khulasa' : 'Summary of the document');
  return cleanLine(`${head}: ${bits.join('; ')}.`);
}

/** Share of a document's RAW lines that are an amount sitting on its own line —
 *  the shape of a challan or dues table, where "Tuition fee (Semester)  Rs 68,000"
 *  carries no colon and so escapes the field-line test above. A prose notice
 *  states its amount inside a sentence that ends with a full stop, which this
 *  deliberately does not count. */
function amountLineShare(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return 0;
  const amountLines = lines.filter(l =>
    /(?:\bRs\.?\s*[\d,]+|\b[\d,]+\s*(?:rupees|PKR)\b)/i.test(l) && !/[.!?]\s*$/.test(l)).length;
  return amountLines / lines.length;
}

/** Grounded 2-4 sentence summary built from the document's own sentences. */
export function summarize(text, docType, isRoman, facts = {}) {
  const sents = sentences(text);
  const units = sents.length ? [] : summaryUnits(text);
  const picked = (sents.length ? sents : units).slice(0, 3).join(' ');
  // Urdu-script documents close sentences with \u06D4, which sentences() does not
  // split on, so an entire Urdu document arrives here as one unsplit block.
  const source = picked || cleanLine(String(text || '')).slice(0, 300);
  // A Roman Urdu response must not paste Urdu-script source text: restate the
  // document from its own facts instead. A mostly-Roman document keeps its
  // grounded sentence-based summary untouched.
  if (isRoman && urduShare(source) >= 0.5) {
    const t = String(text || '');
    const kind = docType || detectUrduDocKind(t);
    const topics = matchUrduTopics(t);
    const dedupe = arr => arr.filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
    const dates = dedupe([...extractUrduDates(t), ...extractDates(t).map(keepRomanPart).filter(Boolean)]);
    const amounts = dedupe([...extractUrduAmounts(t), ...extractAmounts(t).map(keepRomanPart).filter(Boolean)]);
    const lines = [kind
      ? `Yeh dastawez "${kind}" qism ka lagta hai; asal matn Urdu script mein hai.`
      : 'Asal matn Urdu script mein hai, is liye dastawez ki qism wazeh tor par pehchan nahi ho saki.'];
    if (topics.length) lines.push(`Is mein in baaton ka zikr hai: ${topics.join('; ')}.`);
    if (dates.length) lines.push(`Tareekhen: ${dates.join('; ')}.`);
    if (amounts.length) lines.push(`Raqamein: ${amounts.join('; ')}.`);
    lines.push(topics.length || dates.length || amounts.length
      ? 'Naam, pata aur lafzi shartain us Urdu matn mein as-is likhi hain — inhein asal dastawez se milwa len.'
      : 'Is matn se Roman Urdu mein zyada haqaiq nahi nikle; saaf image ya Roman/English text den to mukammal khulasa ban sakta hai.');
    return cleanLine(lines.join(' ')).slice(0, 900);
  }
  const full = cleanLine(String(text || ''));
  // A "summary" that reproduces nearly the whole document is a dump, not a
  // summary — but only for documents that never had sentences to summarise. The
  // lines of a challan, receipt or form are `Label: value` fragments, and pasting
  // them back reads as a dump; a short prose notice whose first sentences ARE the
  // document still gets its grounded sentence extract.
  const dumpLike = full.length > 0 && picked.length >= full.length * 0.85;
  if (sents.length === 0 || (dumpLike && (fieldLineShare(text) >= 0.5 || amountLineShare(text) >= 0.25))) {
    const lead = factLead(docType, isRoman, facts);
    if (lead) return lead.slice(0, 900);
    if (sents.length === 0) return source || null;
  }
  const prefix = docType
    ? (isRoman ? `Yeh aik "${docType}" lagta hai. ` : `This appears to be a ${docType}. `)
    : '';
  return cleanLine(prefix + picked).slice(0, 900);
}

/** Map the document type / content to a known Insaaf AI procedure (Part K). */
export function matchRelevantProcedure(docType, text) {
  const t = String(text || '').toLowerCase();
  const dt = String(docType || '').toLowerCase();
  if (/fir|first information/.test(t) || /fir/.test(dt)) return 'FIR (First Information Report)';
  if (/bail/.test(t)) return 'Bail Application';
  if (/show[\s-]?cause/.test(t) || /show[\s-]?cause/.test(dt)) return 'Reply to a Show-Cause Notice';
  if (/legal notice|demand notice/.test(t)) return 'Reply to a Legal Notice';
  if (/summons/.test(t)) return 'Responding to a Court Summons';
  if (/khula|divorce|family court|maintenance|custody/.test(t)) return 'Family Court Matter';
  if (/consumer|defective|refund/.test(t)) return 'Consumer Complaint';
  if (/labou?r|wages|termination|employment/.test(t)) return 'Labour / Employment Matter';
  if (/cyber|peca|online|social media|fia/.test(t)) return 'Cybercrime Complaint';
  if (/rent|tenant|landlord|evict/.test(t)) return 'Tenancy / Rent Dispute';
  if (/writ|article 199|constitutional/.test(t)) return 'Writ / Constitutional Petition';
  if (/civil suit|plaint|civil court/.test(t)) return 'Civil Suit';
  // Student / university document → procedure mapping
  if (/harassment|anti[\s-]?harassment/.test(dt) || (/harass/.test(t) && /university|college|campus|professor|teacher/.test(t))) return 'University Anti-Harassment Complaint';
  if (/hostel/.test(dt) || /hostel.*allot|allot.*hostel/.test(t)) return 'University Hostel Application';
  if (/fee challan|fee receipt/.test(dt) || /fee.*refund/.test(t)) return 'University Fee Refund Application';
  if (/transcript|mark sheet/.test(dt)) return 'University Transcript Request';
  if (/admit card|exam/.test(dt) && /exam/.test(dt)) return 'University Examination Appeal';
  if (/university|college/.test(dt) && /complaint|appeal/.test(dt)) return 'University Appeal / Complaint';
  return null;
}

/** Practical, doc-type-aware next steps (general guidance, never invented facts). */
function buildNextSteps(docType, data, isRoman) {
  const steps = [];
  const dt = String(docType || '').toLowerCase();
  if (data.deadlines.length) {
    steps.push(isRoman
      ? 'Document mein batayi gayi jawab ki mohlat ka khayal rakhein — mohlat chook jana aap ke muqam ko kamzor kar sakti hai.'
      : 'Note the response deadline stated in the document and act before it — missing a deadline can weaken your position.');
  }
  if (/notice|summons|show[\s-]?cause/.test(dt)) {
    steps.push(isRoman
      ? 'Aik tehreeri jawab tayar karen jo har ilzam ka nuqta-war jawab de, aur tasdeeq-shuda copy apne paas mehfooz rakhein.'
      : 'Prepare a written reply that addresses each allegation point-by-point, and keep a stamped/acknowledged copy for your record.');
    if (data.authorities.length) steps.push(isRoman
      ? `Apna jawab document mein bataye gaye idaray (${data.authorities[0]}) ke naam karen.`
      : `Direct your reply to the authority named in the document (${data.authorities[0]}).`);
    if (/university|college|hostel|department/.test(dt)) {
      steps.push(isRoman
        ? 'Apni university ke nazam-o-zabt ke qawaid aur appeal ka tariqa jaanch len — har idare ka apna tariqa hota hai.'
        : 'Check your university\'s applicable disciplinary rules and appeal process — procedures vary by institution.');
    }
  } else if (/fir|complaint|charge/.test(dt)) {
    steps.push(isRoman
      ? 'FIR/complaint ki tafseelat (naam, tareekhen, dharaaen) ki tasdeeq karen; zaroorat ho to police station se muft certified copy hasil karen.'
      : 'Verify the FIR/complaint details (names, dates, sections) are accurate; get a free certified copy from the police station if needed.');
  } else if (/agreement|contract|rent|employment/.test(dt)) {
    steps.push(isRoman
      ? 'Dastakhat se pehle har shart ghaur se parhein; raqmein, tareekhen aur zimmedariyan wahi hain jo taye hui thin — tasdeeq karen.'
      : 'Read every clause carefully before signing; confirm amounts, dates and obligations match what was agreed.');
  } else if (/application|petition|bail/.test(dt)) {
    steps.push(isRoman
      ? 'Sahi adalat/daftar aur zaroori munzamat ki tasdeeq karen, aur submission par dated receipt/stamp hasil karen.'
      : 'Confirm the correct court/office and required attachments before filing, and obtain a dated receipt/stamp on submission.');
  } else if (/university|college|hostel|transcript|admit|fee|examination/.test(dt)) {
    steps.push(isRoman
      ? 'Apni university ke qawaid se sahi tariqa, mohlat aur zaroori dastawezat ki tasdeeq karen.'
      : 'Check your university\'s applicable regulations for the correct procedure, deadlines, and required documents.');
    if (data.authorities.length) steps.push(isRoman
      ? `Apni darkhwast mutaliqa university ke daftar (${data.authorities[0]}) ke naam karen.`
      : `Direct your application to the relevant university office (${data.authorities[0]}).`);
    if (/harass|discrimin/.test(dt)) {
      steps.push(isRoman
        ? 'Protection Against Harassment of Women at the Workplace Act 2010 ke tehat har university mein Inquiry Committee hona zaroori hai — aap us ke samne baqaida shikayat darj kara sakte hain.'
        : 'Under the Protection Against Harassment of Women at the Workplace Act 2010, every university must have an Inquiry Committee — you may file a formal complaint with it.');
    }
    if (/fee|challan|refund/.test(dt)) {
      steps.push(isRoman
        ? 'Asli fee challan/receipt aur fee se mutaliq har tehreeri mukalabat mehfooz rakhein.'
        : 'Keep the original fee challan/receipt and any written correspondence about the fee dispute.');
    }
  } else {
    steps.push(isRoman
      ? 'Document mein batayi gayi karkardagi ki nishandahi karen aur hawala dastawezat jama karen.'
      : 'Identify the action the document asks of you and gather any supporting documents it refers to.');
  }
  steps.push(isRoman
    ? 'Asli document mehfooz rakhein aur jama karai har cheez ki copy bana len.'
    : 'Keep the original document and make copies of everything you submit.');
  if (!/certificate|letter/.test(dt)) {
    steps.push(isRoman
      ? 'Mohlat, adalat ya raqam se mutaliqa har kaam ke liye registered wakeel se mashwara behtar hai.'
      : 'For anything involving a deadline, a court, or money, consider consulting a registered advocate.');
  }
  return steps.slice(0, 5);
}

/** Risks grounded ONLY in what the document actually states. */
function buildRisks(docType, data, isRoman) {
  const risks = [];
  const dt = String(docType || '').toLowerCase();
  // A deadline on a court notice carries a litigation consequence; the deposit date on a
  // fee challan does not. Saying "ex-parte proceedings" about a challan invented a court
  // risk the document never states.
  const ADVERSARIAL_DOC = /\bnotice\b|summons|show[\s-]?cause|\bfir\b|complaint|charge|bail|\bsuit\b|appeal|\border\b|judgment|writ\b/i;
  if (data.deadlines.length) {
    risks.push(ADVERSARIAL_DOC.test(dt)
      ? (isRoman
        ? `Document mein mohlat: ${data.deadlines[0]}. Waqt par jawab na dena sangeen natijay ya aik tarfa karkardagi ka bais ban sakta hai.`
        : `Deadline stated in the document: ${data.deadlines[0]}. Failing to respond in time may lead to adverse or ex-parte proceedings.`)
      : (isRoman
        ? `Document mein mohlat: ${data.deadlines[0]}. Us tareekh tak jawab ya adaigi mukammal karein. Is document mein yeh nahi likha ke tareekh guzarne ke baad kya hoga — ehtram-able office se pooch len.`
        : `Deadline stated in the document: ${data.deadlines[0]}. Respond or pay by that date. This document does not state what happens after the date, so confirm it with the issuing office.`));
  }
  if (/show[\s-]?cause|notice|summons/.test(dt) && !data.deadlines.length) {
    risks.push(isRoman
      ? 'Text mein koi wazeh mohlat nahi mili — document dobara jaanch len, kyunke notices mein aam tor par jawab ki mohlat hoti hai.'
      : 'No explicit deadline was detected in the extracted text — check the document again, as notices normally carry a response period.');
  }
  if (/fir|complaint|charge|bail/.test(dt)) {
    risks.push(isRoman
      ? 'Faujdari mamlaat azaadi ko mutasir kar sakte hain; ghalat bayan aap ke khilaf istemal ho sakta hai, is liye soch samajh kar jawab den.'
      : 'Criminal matters can affect liberty; incorrect statements can be used against you, so respond carefully.');
  }
  // Money demanded but no due date: the obligation is real, the timeline is not.
  if (data.amounts.length && !data.deadlines.length) {
    risks.push(isRoman
      ? `Document mein rakam ka zikr hai (${data.amounts[0]}) magar koi moheen tareekh/mohlat nahi mili. Adaigi se pehle tareekh likhit mein le len.`
      : `The document mentions a sum (${data.amounts[0]}) but no due date or response period was found in the text. Get the exact due date in writing before paying or agreeing.`);
  } else if (data.amounts.length && data.deadlines.length) {
    // Both were extracted, so the money fact must still reach the user. The
    // document's own wording is quoted; no payment consequence is invented.
    risks.push(isRoman
      ? `Document mein rakam (${data.amounts[0]}) aur uski likhi hui tareekh (${data.deadlines[0]}) dono mojood hain — adaigi se pehle rakam aur tareekh issuing office se confirm karein.`
      : `The document states a sum (${data.amounts[0]}) together with its own stated date (${data.deadlines[0]}). Confirm the amount and that date with the issuing office before paying or relying on either.`);
  }
  // A provision cited in a notice is an assertion by the sender, not a finding.
  if (data.provisions.length && /notice|show[\s-]?cause|complaint/.test(dt)) {
    risks.push(isRoman
      ? `Is mein ${data.provisions.slice(0, 2).join(', ')} ka hawala diya gaya hai. Ye dhaarein aap ke waqay par lagu hote hain ya nahi, ye registered wakeel se tafteesh karwayen.`
      : `The document invokes ${data.provisions.slice(0, 2).join(', ')}. Whether those provisions actually apply to your facts should be confirmed with a registered advocate — a notice asserting them does not decide the point.`);
  }
  if (!data.parties.length && /notice|order|summons|show[\s-]?cause/.test(dt)) {
    risks.push(isRoman
      ? 'Fariqon (kis ne bheja, kis ko bheja gaya) ke naam wazeh tor par nahi nikle — ghalti se kisi aur ke khilaf ya kisi aur ki taraf se jawab taiyar na ho jaye.'
      : 'The parties (sender and addressee) were not clearly identified in the extracted text — confirm them before replying so the response is not addressed to, or signed on behalf of, the wrong person.');
  }
  if (/agreement|contract|rent|tenancy|employment/.test(dt) && !data.deadlines.length && !data.amounts.length) {
    risks.push(isRoman
      ? 'Is samjhaute se text mein rakam ya mohlat nahi mili — tehreeri shartain zubani waday par tarjeeh rakhti hain, is liye har shart parh kar hi dastkhwaz karein.'
      : 'No amount or period was found in this agreement/contract text — written terms override oral promises, so read every clause before signing.');
  }
  if (!risks.length) {
    risks.push(isRoman
      ? 'Extract kiye gaye text mein koi mohlat, rakam ya idaray ka zikr nahi mila. Is ka matlab ye nahi ke document mehfooz hai — shartain khud parhen, aur agar koi shart ghair-mamool lage to wakeel se poochen.'
      : 'No deadline, monetary claim or authority was detected in the extracted text. That is not proof the document is safe — read the clauses yourself, and question any term that looks unusual.');
  }
  return risks.slice(0, 4);
}

/** Build categorized risk review — each risk tagged with its category. */
function buildCategorizedRisks(docType, data, text, isRoman) {
  const categorized = {
    deadline: [],
    legalIssue: [],
    missingInfo: [],
    unusualClause: [],
    ambiguousWording: [],
    inconsistency: []
  };
  const dt = String(docType || '').toLowerCase();
  if (data.deadlines.length) {
    categorized.deadline.push(isRoman ? `Jawab ki mohlat: ${data.deadlines[0]}` : `Response deadline: ${data.deadlines[0]}`);
  }
  if (/show[\s-]?cause|notice|summons/.test(dt) && !data.deadlines.length) {
    categorized.deadline.push(isRoman
      ? 'Koi wazeh mohlat nahi mili — notices mein aam tor par jawab ki mohlat hoti hai.'
      : 'No explicit deadline detected — notices normally carry a response period.');
  }
  if (data.amounts.length && !data.deadlines.length) {
    categorized.deadline.push(isRoman
      ? `Rakam (${data.amounts[0]}) ka zikr hai magar moheen tareekh/mohlat nahi mili — adaigi se pehle tareekh likhit mein le len.`
      : `A sum (${data.amounts[0]}) is mentioned but no due date or response period was found — obtain the due date in writing before paying.`);
  }
  if (data.provisions.length && /notice|show[\s-]?cause|complaint/.test(dt)) {
    categorized.legalIssue.push(isRoman
      ? `Document ${data.provisions.slice(0, 2).join(', ')} ka hawala deta hai — ye dhaarein aap ke waqay par lagu hote hain ya nahi, tafteesh zaroori hai.`
      : `The document invokes ${data.provisions.slice(0, 2).join(', ')} — whether those provisions apply to your facts still needs to be verified.`);
  }
  if (/fir|complaint|charge|bail/.test(dt)) {
    categorized.legalIssue.push(isRoman
      ? 'Faujdari mamlaat azaadi ko mutasir kar sakte hain; ghalat bayan aap ke khilaf istemal ho sakta hai.'
      : 'Criminal matters can affect liberty; incorrect statements can be used against you.');
  }
  if (/agreement|contract|rent|tenancy|employment/.test(dt)) {
    categorized.legalIssue.push(isRoman
      ? 'Tasdeeq karen ke tamam shartain wahi hain jo zubani taye hui thin — tehreeri shartain zubani waday par tarjeeh rakhti hain.'
      : 'Verify that all terms match what was verbally agreed — written terms override oral promises.');
  }
  const unusual = detectUnusualClauses(text, isRoman);
  for (const u of unusual) categorized.unusualClause.push(u);
  const missing = detectMissingInfo(text, docType, isRoman);
  for (const m of missing) categorized.missingInfo.push(m);
  const ambiguous = detectAmbiguousWording(text, isRoman);
  for (const a of ambiguous) categorized.ambiguousWording.push(a);
  const inconsistent = detectInconsistencies(text, isRoman);
  for (const ic of inconsistent) categorized.inconsistency.push(ic);
  return categorized;
}

/** Answer the user's specific question using ONLY the extracted data + text. */
function answerQuestion(question, data, text, isRoman) {
  const q = String(question || '').toLowerCase().trim();
  const dt = data.documentType;

  const when = data.dates[0] ? (isRoman ? `Document mein yeh date/tareekh hai: ${data.dates[0]}.` : `The document shows this date: ${data.dates[0]}.`) : (isRoman ? 'Text mein koi wazeh tareekh nahi mili.' : 'No clear date was found in the extracted text.');
  const who = data.parties.length ? (isRoman ? `Tehreer ke mutabiq yeh fariq hain: ${data.parties.slice(0, 3).join('; ')}.` : `Based on the text, the parties are: ${data.parties.slice(0, 3).join('; ')}.`) : (isRoman ? 'Text mein fariq ka naam wazeh nahi mila.' : 'No party name was clearly found in the text.');
  const where = data.authorities.length ? (isRoman ? `Is mein yeh idaray/adalat zikr hain: ${data.authorities.slice(0, 3).join(', ')}.` : `These authorities/courts are mentioned: ${data.authorities.slice(0, 3).join(', ')}.`) : (isRoman ? 'Text mein koi idaray ya adalat ka wazeh zikr nahi mila.' : 'No specific authority or court was clearly mentioned in the text.');
  const whatToDo = data.requirements.length ? (isRoman ? `Document aap se yeh maangta hai: ${data.requirements.slice(0, 2).join(' | ')}.` : `The document asks you to: ${data.requirements.slice(0, 2).join(' | ')}.`) : (isRoman ? 'Text mein koi wazeh hidayat nahi mili.' : 'No explicit instruction to the recipient was found in the text.');

  if (/\b(what is written|kya likha|what does this say|summary|khulasa|what is this)\b/.test(q)) {
    return isRoman
      ? `Yeh ${dt ? `aik "${dt}"` : 'aik document'} lagta hai. ${data.summary || 'Mukhtasar: text se zyada tafseel nahi nikli.'}`
      : `This appears to be ${dt ? `a "${dt}"` : 'a document'}. ${data.summary || 'The extracted text did not yield further detail.'}`;
  }
  if (/\b(what does this mean|meaning|matlab|explain|tafseer|samjha)\b/.test(q)) {
    return isRoman
      ? `Aam tor par "${dt || 'is qism ka document'}" ka matlab hota hai ke aap ko aik qanooni baat se aagah kiya gaya hai. ${whatToDo}`
      : `In plain terms, ${dt ? `a "${dt}"` : 'this document'} normally informs you of a legal matter and what is expected of you. ${whatToDo}`;
  }
  if (/\b(what (?:do|should|can) i do|what (?:do|should) i|kya karna|next step|agla qadam|action)\b/.test(q)) {
    return isRoman ? `${whatToDo} ${data.nextSteps[0] || ''}` : `${whatToDo} ${data.nextSteps[0] || ''}`;
  }
  if (/\b(when|deadline|by when|kitne din|kab tak|respond|mohlat|time)\b/.test(q)) {
    // Appearance / hearing date: prefer a concrete date over a consequence clause.
    const wantsAppearDate = /\b(?:when|kab)\b[\s\S]{0,30}\b(?:appear|pesh|hearing|court|sunwai|next date|agla)\b|\b(?:appear|pesh|hearing)\b[\s\S]{0,20}\b(?:when|kab|date|tareekh)\b/.test(q);
    if (wantsAppearDate && data.dates.length) {
      return isRoman
        ? `Document ke mutabiq peshi/hearing ki tareekh yeh hai: ${data.dates[0]}.`
        : `According to the document, the appearance/hearing date is: ${data.dates[0]}.`;
    }
    return isRoman
      ? (data.deadlines.length ? `Jawab ki mohlat: ${data.deadlines[0]}.` : when)
      : (data.deadlines.length ? `Response deadline: ${data.deadlines[0]}.` : when);
  }
  if (/\b(who (?:sent|send|issued|from)|kis ne|sender|bheja|from whom)\b/.test(q)) {
    return isRoman ? who : who;
  }
  if (/\b(where|kahan|submit|file|jama)\b/.test(q)) {
    return isRoman
      ? `${where} ${data.authorities.length ? `Aam tor par yeh ${data.authorities[0]} mein jama hota hai.` : 'Document mein jama karne ki jagah wazeh nahi likhi.'}`
      : `${where} ${data.authorities.length ? `Normally this is submitted to the ${data.authorities[0]}.` : 'The document does not clearly state a submission place.'}`;
  }
  if (/\b(lawyer|wakeel|vakeel|advocate|do i need)\b/.test(q)) {
    return isRoman
      ? `Qanooni nuqta-e-nazar se, "${dt || 'is qism'}" ke liye registered wakeel se mashwara behtar hai — khaas tor par agar koi mohlat ya adalat ka zikr ho.`
      : `From a legal standpoint it is usually advisable to consult a registered advocate for ${dt ? `a "${dt}"` : 'this document'} — especially where a deadline or a court is involved.`;
  }
  if (/\b(draft|reply|jawab|response banao|write)\b/.test(q)) {
    return isRoman
      ? `Haan — main is document ka jawab draft kar sakta hoon. "Iska jawab draft karo" kahein ya Document Drafter mein reply chunein; main sirf is text ke haqaiq use karunga aur na-maloom cheezein [MISSING] mark karunga.`
      : `Yes — I can draft a reply to this document. Say "draft a reply" or choose Reply in the Document Drafter; I will use only the facts in this text and mark anything unknown as [MISSING].`;
  }
  // Default: the full grounded picture. The document's own wording is not an
  // explanation — lead with what it asks of the reader, then only the facts
  // that were actually extracted from the text.
  const whenLine = data.dates.length
    ? (isRoman ? `Tareekh: ${data.dates[0]}.` : `Date in the document: ${data.dates[0]}.`)
    : '';
  const amountLine = data.amounts.length
    ? (isRoman ? `Raqamein: ${data.amounts.slice(0, 4).join(', ')}.` : `Amounts mentioned: ${data.amounts.slice(0, 4).join(', ')}.`)
    : '';
  const riskLine = data.risks.length
    ? (isRoman ? `Ehtiyat: ${data.risks[0]}` : `To note: ${data.risks[0]}`)
    : (isRoman
      ? 'Text se koi khaas khatra nahi nikla — is ka matlab yeh nahi ke dastawez mehfooz hai.'
      : 'No specific risk could be read from the text — that is not the same as the document being free of risk.');
  return isRoman
    ? `Yeh text ${dt ? `"${dt}"` : 'aik document'} jaisa hai. ${whatToDo} ${who} ${whenLine} ${amountLine} ${data.deadlines.length ? `Mohlat: ${data.deadlines[0]}.` : ''} ${riskLine}`.replace(/\s+/g, ' ').trim()
    : `Based only on this text, it reads as ${dt ? `a "${dt}"` : 'a document'}. ${whatToDo} ${who} ${whenLine} ${amountLine} ${data.deadlines.length ? `Deadline: ${data.deadlines[0]}.` : ''} ${riskLine}`.replace(/\s+/g, ' ').trim();
}

/**
 * FIX 3: is this actually document language?
 * A raw file handed to a text route (base64 blob, decoded binary, a dump of
 * numbers) must fail honestly instead of being reported as a parsed document.
 * Thresholds stay loose because Urdu is written both in Arabic script and in
 * Roman transliteration; the reliable discriminators are script purity,
 * alphabet share and the word shape of real prose.
 */
export function assessDocumentReadability(text) {
  const s = String(text || '').trim();
  if (s.length < 20) return { readable: false, reason: 'tooShort' };
  const raw = s.slice(0, 8000);
  const control = (raw.match(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g) || []).length;
  if (control / raw.length > 0.02) return { readable: false, reason: 'binary' };
  // Layout is not language. PDF extraction leaves runs that carry no wording
  // at all: fill-in and separator rules (____, ====), table-of-contents dot
  // leaders ("Role of the Committee ........ 9"), zero-width marks inside table
  // cells, prose split into one letter per token, table pipes, and — for Urdu
  // Nastaliq embedded as a symbol font — private-use-area glyphs that are neither
  // Latin nor Arabic. Left in the denominator they depress the alphabet share of a
  // genuine document until it scores as garbage; parts of the HEC corpus were
  // refusing that way.
  // None of this admits junk: a filler-only or PUA-only chunk collapses to
  // tooShort, code and markup keep their braces and tags, and a binary dump, a
  // number dump and a base64 blob still fail the control-byte, letter-share and
  // word-shape tests on their own.
  const sample = raw
    .replace(/[=\-_\u2013\u2014*#~^]{3,}/g, ' ')
    .replace(/(?:\.\s*){3,}|\u2026{2,}/g, ' ')
    .replace(/[\u200b-\u200f\u2060\ufeff\uE000-\uF8FF]/g, '')
    .replace(/(?:\b[A-Za-z]\b\s+){3,}[A-Za-z]\b/g, (m) => m.replace(/\s+/g, ''))
    .replace(/[|\u00a6\u2022\u00b7]/g, ' ')
    .replace(/https?:\/\/\S+/g, (m) => m.replace(/[^\p{L}\p{N}]/gu, ''));
  if ((sample.match(/\S/g) || []).length < 20) return { readable: false, reason: 'tooShort' };
  // A contents page is wording plus dot leaders plus page and clause numbers.
  // Those numbers are positions in a document, not vocabulary, so on a page this
  // structural they stay out of the word-shape measure.
  const isContentsPage = ((raw.match(/(?:\.\s*){4,}/g) || []).length >= 3);
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  const arabic = (sample.match(/[\u0600-\u06FF\u0700-\u074F]/g) || []).length;
  const alnum = (sample.match(/[A-Za-z0-9\u0600-\u06FF\u0700-\u074F]/g) || []).length;
  const spaces = (sample.match(/\s/g) || []).length;
  const allTokens = sample.split(/\s+/).filter(Boolean);
  const tokens = isContentsPage ? allTokens.filter(t => !/^[\d.,;:()\/%#-]+$/.test(t)) : allTokens;
  const wordTokens = tokens.filter(t => (t.match(/[A-Za-z\u0600-\u06FF\u0700-\u074F]/g) || []).length >= 2);
  const alnumRatio = alnum / sample.length;
  const letterRatio = (latin + arabic) / sample.length;
  const wordRatio = tokens.length ? wordTokens.length / tokens.length : 0;
  const spaceRatio = spaces / sample.length;
  if (alnumRatio < 0.55) return { readable: false, reason: 'notText' };
  if (arabic > 0 && letterRatio >= 0.4) return { readable: true, reason: '' };
  if (letterRatio < 0.55 && wordRatio < 0.5) return { readable: false, reason: 'numbers' };
  if (wordRatio < 0.45 || spaceRatio < 0.06) return { readable: false, reason: 'notLanguage' };
  return { readable: true, reason: '' };
}

const UNREADABLE_HINTS = {
  binary: { en: 'binary file data', roman: 'binary file ka data' },
  notText: { en: 'a code or reference string', roman: 'code ya reference string' },
  numbers: { en: 'numbers without wording', roman: 'bageer lafzon ke numbers' },
  notLanguage: { en: "raw file code instead of the document's wording", roman: 'file ka raw code, document ka text nahi' },
  tooShort: { en: 'too little text', roman: 'bohat kam text' }
};

// P0 — meta/answer prose follows the resolved response language; English is the
// default and Roman Urdu is used when the user wrote Roman Urdu or Urdu Script.
function proseMeta(isRoman, en, roman) {
  return isRoman ? roman : en;
}

/**
 * Full local document analysis (Part N/O/T). Returns the exact shape consumed by
 * the frontend DocumentUnderstandingResult. Everything is grounded in `text`.
 */
export function analyzeDocumentText(text, question, opts = {}) {
  const cleanText = String(text || '').trim();
  const isRoman = opts.preferredLanguage === 'roman_urdu';
  const lowQuality = typeof opts.ocrQuality === 'number' && opts.ocrQuality > 0 && opts.ocrQuality < 55;

  // FIX 3: nothing can be grounded in text that is not language. Report that
  // plainly instead of summarising a base64 blob as if the document parsed.
  const readability = assessDocumentReadability(cleanText);
  if (!readability.readable) {
    const hint = UNREADABLE_HINTS[readability.reason] || UNREADABLE_HINTS.notText;
    return {
      documentType: null,
      jurisdiction: null,
      summary: null,
      parties: [], dates: [], authorities: [], requirements: [], deadlines: [], provisions: [],
      caseNumbers: [], amounts: [], nextSteps: [], risks: [],
      categorizedRisks: { deadline: [], legalIssue: [], missingInfo: [], unusualClause: [], ambiguousWording: [], inconsistency: [] },
      relevantProcedure: null,
      answer: isRoman
        ? `Is input mein parhne layak document text nahi tha (yeh ${hint.roman} lag raha hai). Is liye koi analysis nahi banaya ja sakta. Baraye meharbani document ka saaf scan/photo upload karein, ya khaas text khud type karke bhejen.`
        : `This input did not contain readable document text — it looks like ${hint.en}. No analysis was made, because there is nothing reliable to extract. Please upload a clearer scan or photo of the document, or type its key text and try again.`,
      ocrQualityNote: isRoman
        ? 'Document text parhne layak nahi tha; kuch bhi analyse nahi kiya gaya.'
        : 'The document text was not readable; nothing was analysed.',
      isOffline: true
    };
  }

  const { type: docType } = classifyDocumentType(cleanText);
  const dates = extractDates(cleanText);
  const deadlines = extractDeadlines(cleanText);
  const authorities = extractAuthorities(cleanText);
  const parties = extractParties(cleanText);
  const requirements = extractRequestedAction(cleanText);
  const provisions = extractProvisions(cleanText);
  const caseNumbers = extractCaseNumbers(cleanText);
  const amounts = extractAmounts(cleanText);
  const summary = summarize(cleanText, docType, isRoman, {
    parties, amounts, deadlines, dates, authorities, requirements
  });
  const relevantProcedure = matchRelevantProcedure(docType, cleanText);

  // Cross-border jurisdiction gate: if the document is from a foreign court/
  // authority, its procedure is the foreign country's law — never Pakistani law.
  const foreign = detectForeignJurisdiction(cleanText);
  const jurisdiction = foreign.isForeign
    ? (foreign.country ? `Foreign — ${foreign.country}` : 'Foreign (non-Pakistani)')
    : 'Pakistan';
  const foreignProcedureNote = foreign.isForeign
    ? (isRoman
        ? `Ye document ${foreign.country ? foreign.country + ' ke' : 'kisi foreign mulk ke'} court/authority ka hai, is liye is par USKA apna mulqi qanoon/law lagu hoga — Pakistani law ya Pakistani court procedure nahi. Na hi MOFA/Pakistani authority ye foreign case chalegi. For next steps, deadline par amal aur jawab ke liye us mulk ka qualified local lawyer zaroori hai; Pakistani mission (MOFA) sirf consular support de sakti hai. Insaaf AI foreign law, fees ya deadline nahi ghadta — live official source se confirm karein.`
        : `This document appears to come from ${foreign.country ? 'a ' + foreign.country : 'a foreign'} court/authority, so it is governed by THAT country's own law and procedure — not Pakistani law, and Pakistani court procedure does not apply. Pakistani authorities do not adjudicate a foreign case. Respond on the document's own terms and within its stated deadline, using a qualified local lawyer in that country; a Pakistani mission (MOFA) can provide consular support only. Insaaf AI does not fabricate foreign law, fees or deadlines — confirm current rules with the country's official source.`)
    : null;

  const data = { documentType: docType, summary, parties, dates, authorities, requirements, deadlines, provisions, caseNumbers, amounts };
  const nextSteps = buildNextSteps(docType, data, isRoman);
  const risks = buildRisks(docType, data, isRoman);
  const categorizedRisks = buildCategorizedRisks(docType, data, cleanText, isRoman);
  // answerQuestion() references data.nextSteps — attach before calling it.
  data.nextSteps = nextSteps;
  data.risks = risks;

  let answer = answerQuestion(question, data, cleanText, isRoman);
  if (foreignProcedureNote) {
    answer = foreignProcedureNote + ' ' + answer;
  }
  if (lowQuality) {
    const warn = isRoman
      ? 'Note: OCR quality kam hai, is liye text ghalat ho sakta hai — baraye meharbani saaf image/PDF upload karein. '
      : 'Note: OCR quality is low, so the extracted text may be inaccurate — please upload a clearer image/PDF. ';
    answer = warn + answer;
  }

  return {
    documentType: docType,
    jurisdiction,
    summary,
    parties,
    dates,
    deadlines,
    provisions,
    authorities,
    requirements,
    nextSteps,
    risks,
    caseNumbers,
    amounts,
    categorizedRisks,
    relevantProcedure: foreign.isForeign ? foreignProcedureNote : relevantProcedure,
    answer: cleanLine(answer),
    ocrQualityNote: lowQuality
      ? (isRoman ? 'OCR quality kam lagti hai. Baraye meharbani saaf document upload karein.' : 'OCR quality appears low. Please upload a clearer document.')
      : null,
    isOffline: true
  };
}

// --- Part S: mandatory footer for every AI-generated document ----------------
export const INSAF_DOC_FOOTER = `<div style="margin-top:48px; padding-top:12px; border-top:1px solid #d1d5db; text-align:center; font-size:0.8em; color:#6b7280; font-family:'Times New Roman', serif;">
  <p style="margin:0; font-weight:bold; color:#374151;">Prepared with Insaaf AI</p>
  <p style="margin:4px 0 0;">AI-assisted draft for guidance only &mdash; not legal advice and not filed with any court or authority. Please verify all details and consult a registered advocate before use.</p>
</div>`;

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const firstToken = d => String(d || '').split(' — ')[0].trim();

// --- Phase 7 — meta / app-chrome instruction lines --------------------------
// UI action defaults ("Iska jawab bana do (draft a reply to this document)"),
// language mandates ("Generate this document entirely in Urdu Script…") and
// structure directives are APP CONTROLS, not user facts. They must never be
// inlined as numbered reply paragraphs in the document body.
const META_INSTRUCTION_RE = [
  /^\s*(?:draft|generate|write|prepare|create|make)\s+(?:a|the|this)?\s*(?:formal\s*)?(?:document|reply|response|legal\s*notice|application|complaint)\s+(?:entirely\s+)?(?:in|into)/i,
  /^\s*(?:iska|is\s*ka|is\s*ki)\s+(?:jawab|reply|complaint|application|legal\s*notice|complete\s*(?:reply|jawab)?)\s+(?:bana|likh|draft|kar)/i,
  /^\s*(?:draft|write|prepare|make)\s+(?:a\s+)?(?:complete\s+)?(?:reply|response|answer)/i,
  /^\s*(?:draft|generate|write|prepare)\s+(?:the\s+)?document\s+in/i,
  /^\s*[a-z0-9_-]*\s*(?:RESPONSE\s+SCRIPT\s+MANDATE|LANGUAGE\s+DIRECTIVE|DOCUMENT\s+STRUCTURE|CRITICAL\s+REQUIREMENTS|SYSTEM\s+RULE|OUT-OF-SCOPE|JURISDICTION\s+RULE|Part\s+[A-Z])/i,
  /^\s*(?:Output|Use|For|Add|End|Any|Date|Format|The\s+document|DO\s+NOT|If\s+the\s+exact|Return|Never|Only|Heading|CourtLine|Structure)/i
];
function isMetaInstructionLine(p) {
  const s = String(p || '').trim();
  if (!s) return true;
  if (/\b(?:entirely\s+in\s+(?:urdu|english|roman)|mandatory\)|backticks|ready-to-print|fabricate|underscores|exact\s+order|signature\s+area)\b/i.test(s)) return true;
  for (const re of META_INSTRUCTION_RE) if (re.test(s)) return true;
  return false;
}

// --- Phase 5/6 — free-text drafting-request understanding -------------------
// A user types "Draft a legal notice for recovery of unpaid money…" in their
// own words; the system must produce the COMPLETE professional document of the
// RIGHT type — never a form, never a generic template. Rules are ordered:
// the first rule whose cue matches wins (most specific first). Facts are then
// interpreted into clean prose paragraphs (user wording, directive noise
// removed, nothing invented), and per-type MANDATORY signals are checked so
// missing essentials surface as clearly marked placeholders / questions while
// drafting still completes (Phase 8).
// ضمانت / zamanat means BOTH "bail" and "security deposit / guarantee", and the
// two have opposite forums: a bail petition goes before a criminal court, a
// deposit refund goes in a notice to the other party. Whenever the request also
// carries a rent / landlord / tenant / money-to-be-returned cue, the token is a
// deposit claim, never a bail matter (P2: the authority must match the actual
// request — "Do not infer 'court' merely because the text contains legal language").
const DEPOSIT_CONTEXT_CUE = /(?:kirayedar|kiraya|kiraay|landlord|landlady|tenant|rent|makan|ghar|malik|jaaydaad|security\s+deposit|deposit|jama\b|raqam|amount|rupees|pai?sa)|کرایہ|کرایہ ?دار|مکان|گھر|مالک|جمع\s*(?:شده|شدہ)|رقم|ضمانت\s*(?:رقم|کی\s*رقم)|(?:واپس|لوٹا|رٹ)\s*(?:نہیں\s*)?(?:کر|رہا|دی)/i;

// Returning a deposit is a claim for money back; eviction is a claim for
// possession. They share the landlord/tenant words but not the relief.
const DEPOSIT_REFUND_CUE = /security\s+deposit|advance\s+(?:rent|deposit)|سیکیورٹی\s*ڈپازٹ|ضمانت\s*(?:کی\s*)?واپسی|(?:deposit|zamanat|ضمانت)[^.!?\n]{0,40}(?:wapas|laut|return|refund|واپس|لوٹا)|(?:wapas|laut|return|refund|واپس|لوٹا)[^.!?\n]{0,40}(?:deposit|zamanat|ضمانت)/i;
// "after I vacated the flat" reports a past fact; only a demand that someone
// else vacate makes the request an eviction.
const EVICTION_CUE = /\bevict\w*|\b(?:ask|want|tell|direct|notice|require)[^.!?\n]{0,40}\bvacat\w*|khali\s*kar\w*|bedakhli|possession|qabza|خالی|بے\s*دخلی|قبضہ/i;

const DRAFT_REQUEST_RULES = [
  { label: 'Defamation Notice', re: /defamat|hataq|toheen|badnami|هتک|توہین/i },
  { label: 'Show-Cause Reply', re: /show[\s-]?cause/i },
  { label: 'Reply to Legal Notice', re: /(?:^|[\s,])(?:reply|jawab|جواب)(?:\s|,|$)/i },
  { label: 'Pre-Arrest Bail Application', re: /pre-?arrest bail|anticipatory bail|ضمانت.*(?:قبل|خدشہ)/i },
  // "bail" in English is unambiguous; the Urdu/Roman token is not, so it only
  // selects a bail document when no money-return context is present.
  { label: 'Bail Application', re: /\bbail\b/i },
  { label: 'Bail Application', re: /zamanat|ضمانت/i, unless: DEPOSIT_CONTEXT_CUE },
  { label: 'Cyber Crime Complaint (PECA 2016)', re: /cyber|peca|online\s+harass|social\s+media|facebook|whatsapp|instagram|tiktok|blackmail.*online|online.*blackmail|stalking|hack(?:ing)?|سائبر|آن\s*لائن/i },
  { label: 'Workplace Harassment Complaint', re: /harass.*(?:workplace|office|boss|employer|colleague)|workplace\s+harass|office\s+harass/i },
  { label: 'Harassment Complaint', re: /harass(?:ment)?|dhamki.*(?:online|call|message)|threat.*(?:online|call)|ہراسگی/i },
  { label: 'Consumer Complaint', re: /consumer|defective\s+(?:product|goods|item)|refund|khareedari|warranty|nuqsan|product.*(?:defect|return|replace)|خریداری|سامان.{0,15}(?:خراب|ناقص)/i },
  { label: 'Labour Complaint / Application', re: /labou?r|wage|salary|terminat|dismiss(?:ed)?\s+from|retrench|naukri|mulazim|unpaid\s+(?:wages|salary|tankhwa)|tankhwa|تنخواہ|مزدور/i },
  { label: 'Maintenance Application (Family Court)', re: /maintenance|nafqa|nafaqa|kharcha|خرچہ|نفقہ/i },
  { label: 'Khula / Divorce Petition', re: /khula|divorce|talaq|dissolution of marriage|طلاق|خلع/i },
  { label: 'Custody Petition (Minor)', re: /custody|hizanat|guardian|حضانت/i },
  { label: 'FIR (First Information Report)', re: /\bfir\b|first\s+information\s+report|report.*(?:police|thana)|police.*(?:report|darj)|شکایت.*پولیس|پولیس.{0,25}(?:شکایت|رپورٹ)|ایف\s*آئی\s*آر/i },
  { label: 'Police Complaint', re: /police\s+complaint|complaint.*(?:police|thana|darogha)|(?:police|thana).*(?:complaint|shikayat)|\b(?:complaint|report)\b[^.!?؛۔]{0,60}\b(?:stolen|theft|rob(?:bery|bed)|snatched|fraud|cheated|blackmail|kidnap(?:ped)?|assault|murder|attempted\s+to\s+steal)\b/i },
  { label: 'Constitutional Petition (Writ)', re: /constitutional\s+petition|writ\s+petition|fundamental\s+rights|article\s+199|bandi|بنیادی\s+حقوق/i },
  { label: 'Recovery Suit / Civil Suit (Plaint)', re: /\b(?:civil\s+)?suit\b|\bplaint\b|\bdawa\b|دعویٰ/i },
  { label: 'Tenancy / Eviction Notice', re: /tenant|evict|kiraya|landlord|rent\s+(?:notice|arrears)|کرایہ/i },
  { label: 'Criminal Complaint (Section 200 CrPC)', re: /criminal\s+complaint|section\s+200|magistrate.*complaint|فوجداری.{0,20}شکایت/i },
  { label: 'Legal Aid Application', re: /legal\s+a(id|assistance)|free\s+legal|مفت\s+قانونی|قانونی\s*امداد/i },
  { label: 'Affidavit / Declaration', re: /affidavit|halaf|حلف/i },
  { label: 'Power of Attorney', re: /power\s+of\s+attorney|wakalat\s+nama|وکالت/i },
  { label: 'Demand Notice', re: /demand\s+notice|notice\s+of\s+demand|notice\s+demanding|(?:legal\s*)?notice\b.*(?:outstanding|payment|dues)|bill.*outstanding/i },
  { label: 'Legal Notice for Recovery of Unpaid Money', re: /(?:legal\s*)?notice|recover|recovery|outstanding|unpaid\s+money|demand.*(?:money|payment|amount)|loan\s+return|udhar|نوٹس|security\s+deposit|(?:zamanat|deposit|raqam|amount|pai?sa|rupees)[^.!?\n]{0,30}(?:wapas|laut|return|refus|nahi)|wapas[^.!?\n]{0,30}(?:zamanat|deposit|raqam|pai?sa|rupees)|ضمانت[^۔!?\n]{0,25}(?:واپس|لوٹا|رٹ)|(?:واپس|لوٹا|رٹ)[^۔!?\n]{0,25}ضمانت|قرض[^۔!?\n]{0,25}(?:واپس|لوٹا)|(?:رقم|جائیداد)[^۔!?\n]{0,25}(?:واپس|لوٹا)/i },
  { label: 'Representation', re: /representation|reconsider(?:ation)?|represent\s+my\s+case|meri\s+namaindagi|نمائندگی/i },
  { label: 'Appeal / Revision', re: /appeal|revision|اپیل|apil/i },
  { label: 'Undertaking', re: /undertaking|تعهد/i },
  { label: 'University Fee Concession / Waiver Request', re: /fee\s+(?:concession|waiver|reduction|relief)|concession\s+(?:letter|request|application)|university.*fee|college.*fee|tuition\s+(?:fee|concession|waiver)|financial\s+aid.*(?:university|college|student)|student.*(?:fee|concession|waiver|scholarship)/i },
  { label: 'University / Academic Application', re: /university|college|school|academic|admission|transcript|degree|certificate|bona\s+fide|student.*(?:application|request|letter)|hec|board.*(?:application|request)/i },
  { label: 'General Legal Letter', re: /(?:^|[\s,.])(?:general\s+)?(?:legal\s+)?letter(?:s)?(?:\s|,|$|\?)/i },
  { label: 'Application / Request', re: /application|request|darkhast|درخواست/i }
];

// --- P2 (core reliability) — academic-scoped drafting rules -----------------
// A university / college matter is not a consumer claim, not a civil suit and
// not a court petition: its forum is an office or a statutory committee. These
// rules are consulted FIRST whenever the request carries an academic cue, so
// ragging never becomes a Recovery Suit, a fee refund to the Registrar never
// becomes a Consumer Complaint, and an internal suspension appeal never reads
// as a petition to "this Hon'ble Court".
//   unless — cues that mean the user genuinely wants the court/police document
//            after all (an FIR against the seniors, a writ to the High Court);
//            when present the academic rule is skipped and the generic table
//            decides, exactly as before.
//   forum  — the office this document is actually filed at. It is a class, never
//            an invented name: the renderer marks it as such unless the request
//            itself names the office.
const ACADEMIC_CUE = /\b(?:universit(?:y|ies)|institut(?:e|ion)|college|campus|hostel|day\s+scholar|semester|sessional|term\s+(?:paper|fee|sheet)|degree|diploma|result|transcript|mark\s+sheet|date\s+sheet|admit\s+card|cgpa|gpa|credit\s+hours?|admission|merit\s+(?:list|position|test)|re-?admission|migration|bona\s+fide|vice\s+chancellor|pro[\s-]?vice\s+chancellor|registrar|controller\s+of\s+exams?|dean|provost|rector|principal|head\s+of\s+(?:the\s+)?department|\bhod\b|professor|lecturer|instructor|faculty|lab\s+(?:instructor|assistant)|warden|student|class\s+(?:fellow|mate)|senior|ragging|hazing|disciplinary|tuition(?:\s+fee)?|scholarship|stipend|suspended|suspension|expell(?:ed|ing)|debar(?:red|ring)|attendance|hec\b|board\s+of\s+(?:studies|intermediate|technical)|school|fee)\b/i;

const ACADEMIC_CUE_UR = /یونیورسٹی|يونيورسٹی|کالج|اسکول|ہاسٹل|طالب|طلباء|اسٹوڈنٹ|کلاس|سینئر|رگنگ|ہائسنگ|فیس|داخلہ|داخلے|میرٹ|معطل|معطلی|انضباط|ہراساں|ہراسگانی|وائس ?چانسلر|رجسٹرار|پرنسپل|ڈین|وارڈن|کنٹرولر|ٹرانسکرپٹ|مارک ?شیٹ|کارڈنیش|سمری|امتحان|حاضری|اسکالرشپ|وظیفہ/;

// An Urdu request that itself names a court or the police is not an internal
// academic representation, exactly as in English — the veto only ever removes
// the academic framing, it never adds one.
const ACADEMIC_FORUM_VETO_UR = /عدالت|ہائی ?کورٹ|ہائیکورٹ|ٹریبیونل|ٹربیونل|فرسائش|پولیس|تھانہ|ایف ?آئی ?اے|سائبر/;

const ACADEMIC_REQUEST_RULES = [
  { label: 'University Ragging Complaint', re: /\bragging\b|\bhazing\b|رگنگ|زبردستی/i,
    unless: /\bfir\b|first\s+information|police|thana|تھانہ|cyber|peca|\bbail\b|high\s+court|\bwrit\b/i,
    forum: 'The Chairperson, Anti-Ragging / Discipline Committee' },
  { label: 'University Harassment Complaint', re: /harass|ہراسا|inappropriate\s+(?:remarks|behaviour|conduct)/i,
    unless: /\bfir\b|first\s+information|police|thana|تھانہ|cyber|peca|\bconsumer\b/i,
    forum: 'The Chairperson, Anti-Harassment Inquiry Committee' },
  { label: 'University Fee Refund Request', re: /\bfee\b[^.!?؛۔]{0,40}\b(?:refund|refunded|return|returned|reimburse|reimbursement|adjust|adjustment|cancel|cancelled|withdraw)\b|\b(?:refund|reimburse)\b[^.!?؛۔]{0,40}\bfee\b|فیس[^۔]{0,40}(?:واپس|واپسی|رد\s*کر)|(?:واپس|واپسی|رد\s*کر)[^۔]{0,40}فیس/i,
    unless: /\bconsumer\b|\bshop\b|shopkeeper|product|goods|warranty|samankari/i,
    forum: 'The Registrar' },
  { label: 'University Fee Concession / Waiver Request', re: /fee\s+(?:concession|waiver|reduction|relief|installment|adjustment)|concession\s+(?:letter|request|application)|tuition\s+(?:fee\s+)?(?:concession|waiver|reduction)|scholarship|financial\s+aid|stipend|فیس[^۔]{0,30}(?:رعایت|معافی|قسط|تقسیم)|اسکالرشپ|وظیفہ/i,
    unless: /\bconsumer\b|loan|bank\b/i,
    forum: 'The Registrar' },
  { label: 'University Admission Appeal', re: /\b(?:admission|merit|entry\s+test|test\s+result)\b[^.!?؛۔]{0,30}\b(?:appeal|re-?consider|review|rejected|refused|denied|challenge)\b|\b(?:appeal|review|re-?consideration)\b[^.!?؛۔]{0,30}\b(?:admission|merit|entry\s+test)\b|(?:داخلہ|میرٹ)[^۔]{0,40}(?:اپیل|رد|ناکام|دوبارہ|نظرِ?\s*ثانی)|(?:اپیل|نظرِ?\s*ثانی|دوبارہ\s*غور)[^۔]{0,40}(?:داخلہ|میرٹ)/i,
    unless: /high\s+court|\bwrit\b|\btribunal\b|civil\s+suit|decree/i,
    forum: 'The Vice Chancellor' },
  { label: 'University Suspension Appeal', re: /\b(?:suspension|suspended|expulsion|expelled|debarred|dismissal|disciplinary\s+(?:action|proceedings?)|rusticat(?:ed|ion))\b[^.!?؛۔]{0,40}\b(?:appeal|against|challeng|review|set\s+aside|re-?inquir|re-?hear|lift)\b|\b(?:appeal|review|representation)\b[^.!?؛۔]{0,40}\b(?:suspension|suspended|expulsion|debarment|disciplinary|rusticat)|(?:معطل|معطلی|انضباطی|بے\s*دخل)[^۔]{0,40}(?:اپیل|درخواست|ختم|اٹھائیں|رفع|نظرِ?\s*ثانی)|(?:اپیل|نظرِ?\s*ثانی|درخواست)[^۔]{0,40}(?:معطل|معطلی|انضباطی|بے\s*دخل)/i,
    unless: /high\s+court|\bwrit\b|\btribunal\b|civil\s+suit|service\s+tribunal/i,
    forum: 'The Vice Chancellor' },
  { label: 'University Hostel Application', re: /\bhostel\b|\bwarden\b|ہاسٹل|وارڈن/i,
    unless: /\bfir\b|police|thana/i,
    forum: 'The Warden / Director of Student Affairs' },
  { label: 'University Examination / Result Request', re: /re-?checking|re-?evaluation|result\s+(?:card|correction|changing|allotment)|mark\s+sheet|supplementary\s+(?:exam|paper)|exam(?:ination)?\s+(?:form|schedule|center|centre)|admit\s+card|date\s+sheet|carrying\s+(?:session|exam)|امتحان|نتیجہ|مارک\s*شیٹ|کارڈنیش|سمری|ایڈميٹ\s*کارڈ/i,
    // The topic never outranks the stated intent: a result matter raised AS a
    // complaint is a complaint, a routine result request is not.
    unless: /\b(?:complaint|complain|grievance)\b|شکایت/i,
    forum: 'The Controller of Examinations' },
  { label: 'University Certificate / Record Request', re: /\btranscript\b|degree\s+(?:attestation|verification|copy)|migration(?:\s+certificate)?|bona\s+fide|character\s+certificate|\bnoc\b|certificate\s+(?:copy|issuance|duplicate)|ٹرانسکرپٹ|ڈگری|سرٹیفکٹ|بونا\s*فائی|کردار\s*سرٹیفکٹ|ترسیلی\s*سرٹیفکٹ/i,
    forum: 'The Registrar' },
  // An explicit complaint/grievance ask is a complaint even when it names the
  // office it goes to: "complaint to the Registrar" must not degrade into a
  // routine application. The default forum below is only used when no office is
  // named — the composer's NAMED_OFFICE branch always wins for the address line.
  { label: 'University Complaint', re: /\b(?:complaint|complain|shikayat|grievance)\b|شکایت/i,
    unless: /\bfir\b|first\s+information|police|thana|تھانہ|cyber|peca|\bconsumer\b/i,
    forum: 'The Vice Chancellor' },
  { label: 'Application to the Vice Chancellor', re: /\bvice\s+chancellor\b|\bvc\b|وائس\s*چانسلر/i,
    forum: 'The Vice Chancellor' },
  { label: 'Application to the Registrar', re: /\bregistrar\b|\bregistration\s+(?:branch|office)\b|رجسٹرار/i,
    forum: 'The Registrar' },
  { label: 'University / Academic Application', re: /\b(?:application|request|apply|darkhast)\b|درخواست/i,
    forum: 'The Registrar' }
];

// Office line per academic label is carried on the matched rule itself
// (analyzeDraftRequest returns it as `forum`) — the composer uses it for the
// To-block when the request does not name the office.

/**
 * P2 — deterministic document-type selection for a free-text request.
 * Academic matters are decided inside their own band first (so a university
 * request cannot fall through to a consumer/court/civil label); everything
 * else keeps the existing ordered generic table.
 */
export function classifyDraftType(raw) {
  const text = String(raw || '').trim();
  if (!text) return { label: 'Application / Request', rule: null, academic: false };
  const academic = ACADEMIC_CUE.test(text) || ACADEMIC_CUE_UR.test(text);
  if (academic) {
    for (const r of ACADEMIC_REQUEST_RULES) {
      if (!r.re.test(text)) continue;
      if (r.unless && r.unless.test(text)) continue;
      if (ACADEMIC_FORUM_VETO_UR.test(text)) continue;
      return { label: r.label, rule: r, academic: true };
    }
  }
  // A request to get the tenant's own deposit back is a money claim, not an
  // eviction: the tenancy rule would otherwise win on the word "landlord" and
  // produce the generic tenancy shell.
  const depositRefundOnly = DEPOSIT_REFUND_CUE.test(text) && !EVICTION_CUE.test(text);
  const rule = DRAFT_REQUEST_RULES.find(r => r.re.test(text) && !(r.unless && r.unless.test(text))
    && !(r.label === 'Tenancy / Eviction Notice' && depositRefundOnly));
  const label = rule ? rule.label : (/(?:notice|recover|outstanding|unpaid|demand|نوٹس)/i.test(text) ? 'Legal Notice for Recovery of Unpaid Money' : 'Application / Request');
  return { label, rule: rule || null, academic: false };
}

// --- Phase 3 — machine-readable mandatory/optional requirements schema ------
// One entry per drafting label the engine can produce. MANDATORY items are the
// facts a usable document of that type genuinely requires; OPTIONAL items never
// block drafting (they become inline asks only when supplied/asked for);
// NOT REQUIRED lists items that must NOT be demanded of that type. The local
// analyzer (analyzeDraftRequest) implements the mandatory asks heuristically;
// this schema is the verified manifest those heuristics were checked against.
export const DOC_TYPE_REQUIREMENTS = {
  'Legal Notice for Recovery of Unpaid Money': {
    mandatory: ['recipient / identifiable addressee', 'issue / factual basis of the claim', 'amount or demand', 'sender identity for final issue'],
    optional: ['sender CNIC', 'recipient address', 'reference number', 'lawyer/bar details', 'demand deadline'],
    notRequired: ['court name', 'case number']
  },
  'Demand Notice': {
    mandatory: ['recipient / identifiable addressee', 'outstanding amount or obligation', 'issue / factual basis'],
    optional: ['invoice / reference number', 'deadline for payment', 'sender identity'],
    notRequired: ['court name', 'case number']
  },
  'Defamation Notice': {
    mandatory: ['recipient', 'the exact defamatory statement and where/when published', 'demand (apology/retraction/damages)'],
    optional: ['publication evidence', 'sender identity'],
    notRequired: ['court name']
  },
  'Reply to Legal Notice': {
    mandatory: ['sender of the original notice', 'point-by-point response to each allegation'],
    optional: ['reference/date of the original notice', 'CNIC', 'enclosures'],
    notRequired: ['court name', 'case number']
  },
  'Show-Cause Reply': {
    mandatory: ['issuing authority', 'response to each ground', 'your version of the facts'],
    optional: ['notice reference/date', 'CNIC', 'enclosures'],
    notRequired: []
  },
  'FIR (First Information Report)': {
    mandatory: ['police station (or clear [NAME OF POLICE STATION])', 'incident facts: what/when/where', 'complainant identity'],
    optional: ['accused description', 'witnesses', 'CNIC', 'sections of law if known'],
    notRequired: ['court name']
  },
  'Police Complaint': {
    mandatory: ['police station / authority', 'incident facts', 'complainant identity'],
    optional: ['accused details', 'evidence', 'CNIC'],
    notRequired: []
  },
  'Criminal Complaint (Section 200 CrPC)': {
    mandatory: ['complainant identity', 'incident facts with date/place', 'accused identity or description'],
    optional: ['sections of law', 'witnesses', 'magistrate/area'],
    notRequired: ['police station']
  },
  'Bail Application': {
    mandatory: ['case/FIR reference and offence', 'accused identity', 'grounds for bail'],
    optional: ['surety details', 'custody days', 'court'],
    notRequired: []
  },
  'Pre-Arrest Bail Application': {
    mandatory: ['apprehension of arrest', 'case/FIR reference if any', 'grounds'],
    optional: ['surety', 'court'],
    notRequired: ['days in custody']
  },
  'Recovery Suit / Civil Suit (Plaint)': {
    mandatory: ['plaintiff identity', 'defendant identity', 'cause of action with date', 'relief claimed'],
    optional: ['valuation/court fee note', 'case reference'],
    notRequired: ['police station']
  },
  'Constitutional Petition (Writ)': {
    mandatory: ['petitioner identity', 'impugned act/order and date', 'the right/provision engaged', 'relief'],
    optional: ['High Court'],
    notRequired: ['police station']
  },
  'Maintenance Application (Family Court)': {
    mandatory: ['applicant identity', 'respondent identity (person liable)', 'relationship/children basis', 'monthly amount claimed'],
    optional: ['marriage date', 'income of respondent', 'date from which claimed'],
    notRequired: []
  },
  'Khula / Divorce Petition': {
    mandatory: ['petitioner identity', 'marriage (nikah) particulars', 'grounds', 'relief'],
    optional: ['dower (haq mehr) details', 'children'],
    notRequired: []
  },
  'Custody Petition (Minor)': {
    mandatory: ['minor particulars', 'petitioner identity', 'current custody', 'relief'],
    optional: ['welfare grounds'],
    notRequired: []
  },
  'Consumer Complaint': {
    mandatory: ['complainant identity', 'seller/company identity', 'product/service and defect', 'relief (refund/replacement)' ],
    optional: ['purchase date', 'invoice'],
    notRequired: ['police station']
  },
  'Labour Complaint / Application': {
    mandatory: ['worker identity', 'employer identity', 'grievance (wages/termination)', 'relief'],
    optional: ['designation', 'employment dates'],
    notRequired: []
  },
  'Cyber Crime Complaint (PECA 2016)': {
    mandatory: ['complainant identity', 'platform and incident', 'accused account/number or description', 'relief'],
    optional: ['evidence/screenshots', 'dates'],
    notRequired: []
  },
  'Harassment Complaint': {
    mandatory: ['complainant identity', 'harasser identity or description', 'incident facts and dates', 'relief'],
    optional: ['evidence'],
    notRequired: []
  },
  'Workplace Harassment Complaint': {
    mandatory: ['complainant identity', 'employer/office', 'harassment facts and dates', 'relief'],
    optional: ['witnesses'],
    notRequired: []
  },
  'Tenancy / Eviction Notice': {
    mandatory: ['landlord identity', 'tenant identity', 'premises', 'grounds (rent arrears/eviction)'],
    optional: ['rent amount', 'notice period', 'CNIC'],
    notRequired: ['court name']
  },
  'Affidavit / Declaration': {
    mandatory: ['deponent identity', 'facts sworn to'],
    optional: ['CNIC', 'date'],
    notRequired: ['recipient']
  },
  'Power of Attorney': {
    mandatory: ['principal identity', 'attorney identity', 'scope of authority'],
    optional: ['witnesses', 'date'],
    notRequired: ['court']
  },
  'Legal Aid Application': {
    mandatory: ['applicant identity', 'financial circumstances', 'case type and stage'],
    optional: ['income proof', 'assistance requested'],
    notRequired: []
  },
  'Representation': {
    mandatory: ['authority/office addressed', 'facts of the grievance', 'requested reconsideration'],
    optional: ['reference number', 'CNIC'],
    notRequired: ['court name']
  },
  'Appeal / Revision': {
    mandatory: ['appellant identity', 'order appealed and its date', 'grounds', 'forum'],
    optional: ['case number', 'counsel'],
    notRequired: []
  },
  'Undertaking': {
    mandatory: ['person giving the undertaking', 'the obligation undertaken'],
    optional: ['recipient/authority', 'date'],
    notRequired: ['court']
  },
  'General Legal Letter': {
    mandatory: ['recipient', 'subject matter'],
    optional: ['sender identity', 'reference', 'date'],
    notRequired: ['court']
  },
  'Application / Request': {
    mandatory: ['authority/office addressed', 'request and its factual basis'],
    optional: ['sender identity', 'CNIC', 'reference'],
    notRequired: ['court']
  },
  'Application for Temporary Injunction (Stay)': {
    mandatory: ['applicant identity', 'property/subject matter precisely identified', 'prima facie case, balance of convenience and irreparable loss'],
    optional: ['suit/case reference if already filed', 'title/ownership documents', 'evidence of threatened act'],
    notRequired: ['police station']
  },
  'Application for Guardianship': {
    mandatory: ['applicant identity', 'minor particulars (name, age, date of birth)', 'nature of guardianship sought (person/property/both)', 'applicant relationship to minor'],
    optional: ['minor property details', 'current custody arrangement'],
    notRequired: ['police station']
  },
  'Civil Application / Plaint': {
    mandatory: ['plaintiff identity', 'defendant identity', 'cause of action with date', 'relief claimed'],
    optional: ['valuation/court fee note', 'case reference if pending', 'supporting documents'],
    notRequired: ['police station']
  },
  // --- P2: university / academic matters. The forum is an office or a statutory
  // committee, never a court; the amount is only mandatory when the money itself
  // is the subject (fee refund / concession), never for a ragging or harassment
  // complaint. Each entry drives the asks surfaced by analyzeDraftRequest.
  'University Complaint': {
    mandatory: ['your name and enrollment / registration number', 'the institution and the office addressed', 'what happened and when (date or period)', 'the outcome you want'],
    optional: ['CNIC', 'department / program', 'supporting documents'],
    notRequired: ['court name', 'police station', 'amount claimed']
  },
  'University Ragging Complaint': {
    mandatory: ['your name and enrollment / registration number', 'the students or staff involved and what was done', 'date and place of the incident', 'the committee or office addressed', 'the action sought'],
    optional: ['witnesses', 'messages / screenshots as evidence', 'CNIC'],
    notRequired: ['court name', 'police station', 'amount claimed']
  },
  'University Harassment Complaint': {
    mandatory: ['your name', 'the respondent (staff / instructor) and what happened', 'dates of the incidents', 'the Anti-Harassment Inquiry Committee or office addressed', 'the protection or action sought'],
    optional: ['witnesses', 'evidence', 'CNIC'],
    notRequired: ['court name', 'police station', 'amount claimed']
  },
  'University Fee Refund Request': {
    mandatory: ['your name and registration number', 'the fee amount and the semester / period it relates to', 'the institution and the office addressed (Registrar / Accounts)', 'why the refund is due', 'the refund or adjustment sought'],
    optional: ['receipt / challan number', 'date of payment', 'bank details for the refund'],
    notRequired: ['court name', 'police station']
  },
  'University Fee Concession / Waiver Request': {
    mandatory: ['your name and registration number', 'the fee amount and the program / semester', 'the financial grounds (guardian income, dependants)', 'the institution and office addressed', 'the concession or waiver sought'],
    optional: ['income certificate', 'previous result / attendance', 'date from which the concession should apply'],
    notRequired: ['court name', 'police station']
  },
  'University Admission Appeal': {
    mandatory: ['your name and roll / application number', 'the admission or merit decision appealed and its date', 'the grounds of appeal', 'the forum addressed (Admissions Office / Vice Chancellor)', 'the relief sought'],
    optional: ['merit position / marks', 'documents relied upon'],
    notRequired: ['court name', 'police station', 'amount claimed']
  },
  'University Suspension Appeal': {
    mandatory: ['your name, registration number and program', 'the suspension or disciplinary order and its date', 'the grounds of appeal', 'the forum addressed (appeal authority / Vice Chancellor)', 'the relief sought (order set aside, re-inquiry)'],
    optional: ['counsel / student advisor', 'evidence relied upon'],
    notRequired: ['court name', 'police station', 'amount claimed']
  },
  'University Hostel Application': {
    mandatory: ['your name and registration number', 'the hostel or room requested and the session', 'the institution and office addressed (Warden / Student Affairs)', 'the reason for the request'],
    optional: ['guardian contact', 'medical / disability need', 'CNIC'],
    notRequired: ['court name', 'police station', 'amount claimed']
  },
  'University Examination / Result Request': {
    mandatory: ['your name, roll number and examination / semester', 'the examination or result detail concerned', 'the institution and the Controller of Examinations', 'the action requested'],
    optional: ['subjects affected', 'result card reference'],
    notRequired: ['court name', 'police station', 'amount claimed']
  },
  'University Certificate / Record Request': {
    mandatory: ['your name, registration number and program / session', 'the document required (transcript, degree, NOC, migration certificate)', 'the institution and office addressed', 'the purpose or authority it is required for'],
    optional: ['number of copies', 'old record details', 'dispatch address'],
    notRequired: ['court name', 'police station', 'amount claimed']
  },
  'Application to the Registrar': {
    mandatory: ['your name, registration number and department', 'the institution', 'the request and its factual basis', 'the date or session it relates to'],
    optional: ['CNIC', 'supporting documents', 'contact details'],
    notRequired: ['court name', 'police station']
  },
  'Application to the Vice Chancellor': {
    mandatory: ['your name, registration number and program', 'the institution', 'the request and its factual basis', 'the date or session it relates to'],
    optional: ['the office the matter was previously taken to', 'supporting documents', 'CNIC'],
    notRequired: ['court name', 'police station']
  },
  'University / Academic Application': {
    mandatory: ['your name, registration number and program', 'the institution and department', 'the request and its factual basis'],
    optional: ['date / session concerned', 'CNIC', 'supporting documents'],
    notRequired: ['court name', 'police station', 'amount claimed']
  }
};

const REQUEST_LEAD_NOISE = /^(?:mera\s+masla\s+(?:ye|yah|yih|jo)?\s*(?:hai|ha)?\s*(?:ke|k|wo)?\s*|masla\s+(?:ye|yah)?\s*(?:hai|ha)?\s*(?:ke)?\s*|main\s+(?:aap\s*ko|aapko|apko)?\s*(?:batana\s+chahta|bata\s+raha|bataun|batata)\s*(?:hoon)?\s*(?:ke|k)?\s*|the\s+issue\s+is\s+(?:that\s+)?|i\s+(?:want|need|would\s+like)\s+to\s+|so\s+|well\s+|actually\s+|please\s+|plz\s+|pls\s+|kindly\s+|mujhe|meri\s+taraf\s+se|baat\s+ye\s+hai\s+(?:ke)?\s*)/i;
const REQUEST_TRAIL_NOISE = /(?:\s*(?:chahiye|karna\s+(?:hai|hain|hoga)|karwana\s+(?:hai|hoga)|karo|kar\s+do|bana\s+do|likh\s+do|please|plz))$/i;
const REQUEST_SUBMIT_TAIL = /(?:\s+(?:and|so)\s+(?:i|I)\s+(?:want|wish|would\s+like|need|intend)\s+to\s+(?:submit|file|give|send|write)\s+(?:my\s+)?(?:reply|response|answer|grounds|defence|application)\s*)[.,؛۔;]*$/i;
const REQUEST_DIRECTIVE_HEAD = /^(?:please\s*)?(?:draft|write|prepare|make|create|generate|file|lodge|submit|banao|likh(?:o|na|e| de)?|kar(?:o| de| do)?|bana)\b/i;

function splitRequestSentences(raw) {
  // A fact-introduction colon ("based on these facts: my bike was stolen…",
  // "facts ye hain: …") marks the end of the request framing and the start of
  // the user's facts. Without this break the whole sentence reads as one
  // request header and the substantive facts would be dropped with it.
  const factIntro = String(raw)
    .replace(/\s+/g, ' ')
    .replace(/\b(?:based\s+on\s+these\s+(?:facts|details|grounds)|these\s+(?:facts|details)|in\s+these\s+(?:facts|details)|the\s+following\s+(?:facts|details)|(?:facts|details)\s+are\s+as\s+follows|facts\s+ye\s+hain|facts\s+ye\s+hai|facts\s+hai|in\s+haalat\s+mein|reply\s+to\s+(?:the\s+)?(?:show[\s-]?cause(?:\s+notice)?|legal\s+notice|notice|letter|document)|my\s+reply\s+to\s+(?:the\s+)?(?:show[\s-]?cause(?:\s+notice)?|legal\s+notice|notice|letter|document)|a\s+reply\s+to\s+(?:the\s+)?(?:show[\s-]?cause(?:\s+notice)?|legal\s+notice|notice|letter|document)|response\s+to\s+(?:the\s+)?(?:show[\s-]?cause(?:\s+notice)?|legal\s+notice|notice|letter|document))\b[^.!?।]{0,30}?[:—–-]/gi, '. ')
    .trim();
  return String(factIntro.replace(HONORIFIC_ABBREV_RE, m => m.slice(0, -1) + DOT_SENTINEL))
    .split(/(?<=[.!?۔।])\s+|\s+[;،]\s+|\n+/)
    .map(s => s.split(DOT_SENTINEL).join('.').trim())
    .filter(Boolean);
}
function cleanFactSentence(s) {
  let t = String(s || '')
    .replace(REQUEST_LEAD_NOISE, '')
    .replace(REQUEST_DIRECTIVE_HEAD, '')
    .replace(REQUEST_TRAIL_NOISE, '')
    .replace(REQUEST_SUBMIT_TAIL, '')
    .replace(/^that\s+/i, '')  // dictation artifact; the clause prefix re-adds "That"
    .replace(/^[\s,;:،]+|[\s,;:،]+$/g, '')
    .replace(/\.{2,}$/, '')
    .trim();
  // Phase 8 — Urdu Script requests. A directive head ("براہ کرم ایک قانونی نوٹس
  // تیار کریں کہ …") is app framing, not a fact: strip it so only the user's
  // facts survive as clauses. Purely directive sentences never reach here —
  // analyzeDraftRequest() drops them first via isUrduDirective().
  if (/[\u0600-\u06FF]/.test(t)) {
    t = t.replace(/^(?:براہ\s*کرم\s*)?(?:میرے\s*لیے\s*)?(?:مجھے\s*)?(?:ایک\s*)?(?:مکمل\s*)?(?:قانونی\s*|پولیس\s*)?(?:درخواست|نوٹس|شکایت|اپیل|جواب|خط|ضمانت|نمائندگی|دستاویز|ایف\s*آئی\s*آر)\s*(?:تیار\s*کریں|بنائیں|بنا\s*دیں|لکھ\s*دیں|لکھیں|کروائیں)\s*(?:کہ\s*)?/i, '')
      .replace(/^[\s,;:،]+|[\s,;:،]+$/g, '')
      .trim();
  }
  // Still imperative after the noise-strip (e.g. leftover "bana do")? drop it.
  if (/^\s*(?:bana|banao|likh|karo|kar\s+do)\b/i.test(t)) return '';
  return t;
}

// A request that only NAMES the document — "Khula ki application bana do (wife
// ki janib se)" — is an instruction, never a case fact. The bracketed party
// phrase says who files it; it is not a ground for the relief. The instruction
// is removed as a whole, and the remaining content decides whether any facts
// were actually supplied.
const DIRECTIVE_VERB_RE = /\b(?:bana\s*(?:do|dein|dena|dijiye)|banado|banao|bana\s*de|likh\s*(?:do|dein|dena|dijiye)|likhdo|likho|likhein|likh\s*de|tayyar\s*(?:karo|karein|kar\s*do|kijiye|karna|kiya)|draft|write|prepare|make|create|generate)\b/i;
const DOCUMENT_NOUN_RE = /\b(?:application|darkhwast|darakhwast|notice|shikayat|complaint|appeal|petition|letter|khat|reply|jawab|affidavit|fir|suit|claim)\b|(?:درخواست|نوٹس|شکایت|اپیل|خط|جواب|ضمانت|ایف\s*آئی\s*آر)/i;
const PARTY_CLAUSE_RE = /\((?:[^)]*?)\b(?:janib|taraf|traaf)\b[^)]*\)|\b(?:janib|taraf|traaf)\s*(?:se)\b/gi;
const DIRECTIVE_FILLER_RE = /\b(?:ki|ka|ke|se|ne|ko|meri|mera|mere|mujhe|hamari|hamara|please|kindly|a|an|the|for|of|to|my|me|i|main|mein|ek|aik|complete|mukammal)\b/gi;
const PARTY_SIDE_RES = [
  [/\b(?:wife|biwi|zoja|بیوی)\b/i, 'wife'],
  [/\b(?:husband|shohar|khavand|khawand|mian|شوہر)\b/i, 'husband']
];

function detectDraftDirective(raw) {
  const text = String(raw || '').trim();
  if (!text) return { instructionOnly: false, partySide: null };
  let partySide = null;
  for (const [re, side] of PARTY_SIDE_RES) if (re.test(text)) { partySide = side; break; }
  const isDirective = DIRECTIVE_VERB_RE.test(text) && DOCUMENT_NOUN_RE.test(text);
  if (!isDirective) return { instructionOnly: false, partySide: null };
  const remainder = text
    .replace(PARTY_CLAUSE_RE, ' ')
    .replace(DIRECTIVE_VERB_RE, ' ')
    .replace(DOCUMENT_NOUN_RE, ' ')
    .replace(DIRECTIVE_FILLER_RE, ' ')
    .replace(/[^A-Za-z\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !/^(?:khula|divorce|talaq|طلاق|خلع)$/i.test(w));
  return { instructionOnly: remainder.length < 2, partySide };
}

// Phase 8 — a purely directive Urdu sentence ("درخواست تیار کریں", "قانونی نوٹس
// بنائیں") carries no facts and must never become a clause of the document.
function isUrduDirective(s) {
  const t = String(s || '').trim();
  if (!t || !/[\u0600-\u06FF]/.test(t)) return false;
  if (/\d/.test(t)) return false;              // digits suggest real facts follow
  if (t.length > 80) return false;              // long sentence is likely factual
  if (!/^(?:براہ\s*کرم\s*)?(?:میرے\s*لیے\s*)?(?:مجھے\s*)?(?:ایک\s*)?(?:مکمل\s*)?(?:قانونی\s*|پولیس\s*)?(?:درخواست|نوٹس|شکایت|اپیل|جواب|خط|ضمانت|نمائندگی|دستاویز|ایف\s*آئی\s*آر)\s/.test(t)) return false;
  return /(?:تیار\s*کریں|بنائیں|لکھ\s*دیں|لکھیں|بنا\s*دیں|کروائیں|کریں|کیجیے)\s*[!?۔.]*$/.test(t);
}

/**
 * Understand a free-text drafting request. Returns the detected document label,
 * clean fact paragraphs and the MANDATORY signals that are missing (so the
 * caller can ask / mark placeholders while the document still gets drafted).
 */
// Phase 5 — money-token shapes inside a free-text drafting request. Used both
// to decide that a framing sentence carries the claimed amount and to re-use
// that amount in a claim recital when no other fact mentions it.
const REQUEST_MONEY = /(?:Rs\.?|PKR|روپے)\s*\d[\d,.]*(?:\s*(?:lakh|lac|crore|thousand|ہزار|لاکھ|کروڑ))?|\d[\d,.]*(?:\s*(?:lakh|lac|crore|thousand|ہزار|لاکھ|کروڑ))?\s*(?:Rupees|rupay|روپے)/i;

// Urdu fixed phrasing used when a claim recital must render inside an Urdu
// Script document: the user's amount stays verbatim; only OUR OWN boilerplate
// (the parts the English recital also composes) is localized. Urdu-script
// documents therefore never contain system-generated English prose.
const SALVAGE_UR_BEING = { loan: 'بطور بقایا قرض', rent: 'بطور بقایا کرایہ', salary: 'بطور بقایا تنخواہ / اجرت' };
const SALVAGE_UR_MAIN = {
  pay: 'مخاطب سے ادا ہونا واجب ہے',
  refund: 'واپسی / استرداد کے قابل ہے',
  defaultMain: 'مخاطب سے وصول ہونا واجب اور قابلِ وصول ہے'
};

// Extract {amount, kind, action} shared by the English and Urdu recitals below.
function salvageClaimParts(sentence) {
  const src = String(sentence || '').trim();
  const rest = src
    .replace(/^(?:please\s*)?(?:(?:a|an|the)\s+)?(?:\w+\s+){0,4}(?:legal\s*notice|notice|application|complaint|fir|suit|plaint|petition|reply|bail|affidavit)\s+/i, '')
    .trim();
  const amountMatch = REQUEST_MONEY.exec(rest || src);
  if (!amountMatch) return null;
  const amount = String(amountMatch[0]).trim().replace(/\brs\.?\s+/gi, 'Rs ').replace(/\bpkr\s+/gi, 'PKR ').replace(/\brupees\b/gi, 'Rupees').replace(/(\d)\.$/, '$1');
  const tail = (rest || src).replace(REQUEST_MONEY, ' ').replace(/\b(?:of|for|the|a|an|and)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const kind = /\bloan\b/i.test(tail) ? 'loan' : (/\brent\b/i.test(tail) ? 'rent' : (/\bsalary\b|\bwages?\b/i.test(tail) ? 'salary' : ''));
  const action = /\b(?:pay|repay|payment|repayment)\b/i.test(tail) ? 'pay' : (/\b(?:refund|return|refundable|returnable)\b/i.test(tail) ? 'refund' : '');
  return { amount, kind, action };
}

// Phase 5 — turn a money-bearing document-framing sentence ("a legal notice for
// recovery of an unpaid loan of Rs 500,000") into an English claim recital.
// Only the amount and the debt-character word the user typed are reused; nothing
// new is asserted (the renderer adds the leading "That").
function salvageClaimSentence(sentence) {
  const p = salvageClaimParts(sentence);
  if (!p) return null;
  const being = p.kind === 'loan' ? ', being an unpaid loan' : p.kind === 'rent' ? ', being unpaid rent' : p.kind === 'salary' ? ', being unpaid salary/wages' : '';
  const main = p.action === 'pay' ? 'is due and payable by the addressee' : p.action === 'refund' ? 'is due and refundable/returnable' : 'is due and recoverable from the addressee';
  return being ? `the sum of ${p.amount}${being}, ${main}` : `the sum of ${p.amount} ${main}`;
}

// Parallel Urdu recital for the same sentence (Urdu Script documents).
function salvageClaimSentenceUrdu(sentence) {
  const p = salvageClaimParts(sentence);
  if (!p) return null;
  const being = p.kind ? SALVAGE_UR_BEING[p.kind] : '';
  const main = SALVAGE_UR_MAIN[p.action] || SALVAGE_UR_MAIN.defaultMain;
  return `رقم ${p.amount}${being ? '، ' + being : ''}، ${main}`;
}

export function analyzeDraftRequest(requestText) {
  const raw = String(requestText || '').trim();
  const detected = classifyDraftType(raw);
  const label = detected.label;
  // An instruction that only names the document contributes no facts. Dropping
  // it here is what stops the request text from being rendered as clause 1 of
  // the user's own document.
  const directive = detectDraftDirective(raw);

  const sentences = splitRequestSentences(raw);
  const facts = [];
  const seen = new Set();
  let salvage = null; // money-bearing framing sentence kept only if nothing else carries the amount
  // App request framing that carries nothing but the claim ("recovery of an
  // unpaid loan of Rs 500,000") is boilerplate the app wrote, not a fact the
  // user stated: it renders as a professional recital in the document's own
  // language. A framing tail that also carries real content (a name, a date, a
  // period) is left exactly as it is, in every language.
  const framingRecitals = {};
  const CLAIM_WORDS = /^(?:of|an|a|the|for|from|to|and|or|in|on|at|recovery|recover|unpaid|outstanding|due|loan|rent|salary|wages|payment|pay|repay|refund|money|sum|amount|legal|notice|please|being|is|it)$/i;
  // True when a sentence carries nothing but the claim itself — app boilerplate
  // that may be reworded, never a fact the user stated.
  const isClaimOnly = (src) => String(src || '').replace(REQUEST_MONEY, ' ').replace(/[.,;:]/g, ' ')
    .split(/\s+/).filter(w => w && !CLAIM_WORDS.test(w)).length === 0;
  const registerFramingRecital = (src) => {
    if (!src || /[\u0600-\u06FF]/.test(src) || framingRecitals[src]) return;
    if (!isClaimOnly(src)) return;
    const en = salvageClaimSentence(src);
    if (!en) return;
    framingRecitals[src] = { en, ur: salvageClaimSentenceUrdu(src) || en };
  };
  for (const s of sentences) {
    // An instruction-only request ("Khula ki application bana do") supplies no
    // facts at all; every sentence is the command itself.
    if (directive.instructionOnly) break;
    // Phase 8 — a purely directive Urdu command ("درخواست تیار کریں") is app
    // framing, never a fact: drop it so it can never leak into a document clause.
    if (isUrduDirective(s)) continue;
    let c = cleanFactSentence(s);
    // Drop sentences that are only the request itself ("please draft a legal
    // notice for recovery of unpaid money") or repeat the detected type label.
    // When the directive sentence contains substantive facts after the document
    // description ("Write a fee concession letter for a student who cannot afford
    // the full fee due to father's low income"), strip the directive + document
    // type framing and let the factual tail flow through as a fact.
    if (!c) continue;
    let fromFraming = false;
    if (/^(?:please\s*)?(?:draft|write|prepare|make|create|generate|banao|likh|karo)\b/i.test(c)) {
      c = c.replace(/^(?:please\s*)?(?:draft|write|prepare|make|create|generate|banao|likh|karo)\b\s*/i, '');
      c = c.replace(/^(?:a|an|the)\s+(?:complete\s+|full\s+|detailed\s+)?(?:[\w\s-]*?(?:letter|notice|application|request|complaint|petition|reply|fir|affidavit|suit|claim|appeal))\s+(?:for|regarding|about|in\s+the\s+matter\s+of|concerning)\s+/i, '');
      if (!c || c.length < 10) continue;
      fromFraming = true;
    }
    // A cleaned sentence that merely re-describes the requested document label
    // ("a legal notice for recovery of unpaid money of Rs 20 lakh", "a complete
    // legal notice for …") is request framing, not a fact — drop it UNLESS it
    // continues with a finite verb and reads as a live statement ("notice was
    // served on 3 May", "application is pending before the court"). The framing
    // may be the only carrier of the claimed amount, so it is kept as a salvage
    // candidate instead of being discarded (Phase 5).
    if (/^(?:(?:a|an|the)\s+)?(?:\w+\s+){0,4}(?:legal\s*notice|notice|application|complaint|fir|suit|plaint|petition|reply|bail|affidavit|request|letter|concession|appeal)\b/i.test(c)
      && !/\b(?:was|were|is|are|has|have|had|been|did|get|got|am|shall|will|would|being|received|served|issued|dated|submitted|filed|pending|demanded|threatened)\b/i.test(c.split(' ').slice(0, 8).join(' '))) {
      if (REQUEST_MONEY.test(c)) salvage = c;
      // Strip the document-type framing prefix and keep the factual tail if
      // it carries substantive content (e.g. "a fee concession letter for a
      // student who cannot afford the full fee" → "a student who cannot
      // afford the full fee due to father low income").
      let tail = c.replace(/^(?:(?:a|an|the)\s+)?(?:[\w\s-]*(?:legal\s*notice|notice|application|complaint|fir|suit|plaint|petition|reply|bail|affidavit|request|letter|concession|appeal))\s+(?:(?:to|upon|against)\s+[A-Z\u0600-\u06FF][A-Za-z\u0600-\u06FF'.&-]*(?:\s+[A-Z\u0600-\u06FF][A-Za-z\u0600-\u06FF'.&-]*){0,3}\s+)?(?:for|regarding|about|in\s+the\s+matter\s+of|concerning|where|who|in\s+which)\s+/i, '').trim();
      if (tail.length > 0) tail = tail.charAt(0).toUpperCase() + tail.slice(1);
      if (tail.length >= 10 && !/^(?:The\s+)?(?:above|said|aforementioned|requested|desired)\b/i.test(tail)) {
        // The tail can still be the app's own claim wording plus the user's
        // continuation ("recovery of unpaid loan of Rs 500,000 which I gave on
        // 10 January 2026"). The claim is boilerplate and renders as a
        // professional recital; the continuation is appended word for word, so
        // the amount and the date survive without any invented prose.
        const cont = tail.match(/\b(?:which|that|although|whereas|since)\b[\s\S]*$/i);
        const claimPart = (cont ? tail.slice(0, cont.index) : tail).trim().replace(/[,;]\s*$/, '');
        const recitalEn = REQUEST_MONEY.test(claimPart) && isClaimOnly(claimPart) ? salvageClaimSentence(claimPart) : null;
        const key = recitalEn ? (cont ? `${recitalEn}, ${cont[0]}` : recitalEn) : tail;
        const kLower = key.toLowerCase();
        if (!seen.has(kLower)) {
          seen.add(kLower);
          if (facts.length < 14) {
            facts.push(key);
            if (recitalEn) {
              const urRecital = salvageClaimSentenceUrdu(claimPart);
              framingRecitals[key] = { en: key, ur: urRecital ? (cont ? `${urRecital}، ${cont[0]}` : urRecital) : key };
            } else if (REQUEST_MONEY.test(tail)) {
              registerFramingRecital(tail);
            }
          }
        }
      }
      continue;
    }
    const lower = c.toLowerCase();
    if (lower.length < 4) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    if (facts.length < 14) {
      facts.push(c);
      // A sentence that is only the stripped "draft a … notice for" wrapper still
      // belongs to the app, not to the user's narrative: it may be reworded.
      // A fact the user actually stated is never touched.
      if (fromFraming && REQUEST_MONEY.test(c)) registerFramingRecital(c);
    }
  }

  // Phase 5 — salvage: when the dropped framing sentence was the ONLY sentence
  // carrying the claimed amount, convert it into a professional claim recital so
  // the money survives in the document body. The English recital is used for
  // English documents; a parallel Urdu recital (salvaged.ur) is substituted by
  // the Urdu composer, so Urdu-script documents never embed system-generated
  // English prose. Urdu-script requests keep their own prose conventions and are
  // not machine-rewritten.
  let salvaged = null;
  if (salvage && !/[\u0600-\u06FF]/.test(raw) && !facts.some(f => REQUEST_MONEY.test(f))) {
    const claimEn = salvageClaimSentence(salvage);
    if (claimEn) {
      const claimUr = salvageClaimSentenceUrdu(salvage);
      facts.unshift(claimEn);
      salvaged = claimUr ? { en: claimEn, ur: claimUr } : { en: claimEn, ur: claimEn };
    }
  }

  // Phase 8 / P3 — mandatory-signal checks. The ASK wording is unchanged, but
  // WHETHER an ask applies is now read from that document type's own
  // DOC_TYPE_REQUIREMENTS entry instead of a loose label regex: a harassment or
  // university complaint must never be told to supply "the specific amount
  // claimed", while a fee-refund request (where the money IS the subject) must.
  const missing = [];
  const t = raw.toLowerCase();
  const hasYear = /\b(?:19|20)\d{2}\b/.test(t);
  const hasAmount = /(?:rs\.?|pkr|rupees|روپے)\s*\d|\d[\d,]*(?:\s*(?:lakh|lac|crore|thousand|ہزار|لاکھ))?\s*(?:rupees|rs\.?)?/i.test(t) && /\d{2,}/.test(t);
  // A salvaged claim recital ("the sum of Rs 20 lakh is due…") is not by
  // itself the full story — it must not suppress the full-facts mandatory ask.
  const isLong = (salvaged ? facts.slice(1) : facts).join(' ').length >= 60;
  const req = DOC_TYPE_REQUIREMENTS[label] || {};
  const mandatoryText = (req.mandatory || []).join(' | ');
  const notRequiredText = (req.notRequired || []).join(' | ');
  const wantsAmount = !/amount|sum|money/i.test(notRequiredText)
    && /amount|sum|\bdue\b|demand|refund|rent|salary|wages|fee\b|price|cost/i.test(mandatoryText);
  const wantsDate = !/\bdate\b/i.test(notRequiredText)
    && (/date|when|period/i.test(mandatoryText)
      || /(?:notice|suit|plaint|fir|complaint|petition|maintenance|khula|divorce|custody|family|tenancy|evict)/i.test(label));
  if (wantsAmount && !hasAmount) missing.push('The specific amount or sum claimed (for example Rs 750,000)');
  if (wantsDate && !hasYear) missing.push('The date/period when the matter happened');
  if (!isLong) missing.push('The full facts — what happened, who was involved, and what was promised or done');
  // Phase 4 — an FIR / Police Complaint must reach a named police station: mere
  // mention of the words is enough (the renderer addresses the SHO and marks the
  // station as [NAME OF POLICE STATION] when no value was supplied).
  if (/(?:\bfir\b|first information|police report|police complaint)/i.test(label) && !/(?:police\s+station|thana|تھانہ)/i.test(t)) missing.push('The police station where the case should be registered (e.g. the SHO / police station of the relevant area)');
  if (/bail/i.test(label) && !/(?:case|fir|arrest|giraftari|تھانہ|مقدمہ)/i.test(t)) missing.push('The case/FIR reference and the offence for which bail is sought');
  // P2 — a university document is unusable without the institution and the office
  // it is filed at; that is this class's real mandatory field (never a court).
  if (detected.academic && !/(?:universit|college|institut|school|board|یونیورسٹی|يونيورسٹی|کالج|اسکول|ادارہ|تعلیم گاہ)/i.test(t)) {
    missing.push('The name of the university / institution and the office you are addressing (e.g. the Registrar, the Vice Chancellor, the Head of Department)');
  }
  // Phase 3 — identity asks: a complete document needs the author's identity and,
  // for notices/replies/letters, an identified addressee. The checks are
  // deliberately permissive so a miss only surfaces as an ask/placeholder.
  const authorNameGiven = /(?:my\s+name\s+(?:is|:)|(?:name|naam|نام)\s*[:،,-]\s*[A-Z\u0600-\u06FF]|(?:^|[.!?;،\n])\s*(?:i|main|mein|میں)[,،]?\s+(?:am\s+|hoon\s+|ہوں\s+)?[A-Z\u0600-\u06FF][^\s,]{2,}|the\s+undersigned\s+[A-Z])/i.test(raw);
  if (!authorNameGiven) missing.push('Your full name (the sender / applicant / complainant / petitioner)');
  const issuerKnown = /reply|show cause|response/i.test(label) && /(?:from|by)\s+(?:the\s+)?[A-Z]/i.test(t);
  if (/(?:notice|reply|letter)/i.test(label) && !(/(?:to|against|addressee|recipient)\s+[A-Z\u0600-\u06FF]|(?:کو|کی\s*طرف)\s+[A-Z\u0600-\u06FF]/i.test(t) || issuerKnown)) missing.push('The name and address of the addressee (the person/party to be served)');

  // A Khula application requested by instruction only is still a complete,
  // usable draft: the parties and personal details become labelled placeholders
  // and the asks below are the family-law questions that actually matter. Mehr
  // return is never added as a requirement — it is not a condition of Khula.
  if (directive.instructionOnly && /khula/i.test(label)) {
    missing.length = 0;
    missing.push('The applicant\'s and respondent\'s full names (and father\'s names)');
    missing.push('The city/province where the marriage took place and where the application will be filed');
    missing.push('The date of marriage and the Nikahnama registration details (union council / registrar)');
    missing.push('Whether there are children — their ages and who has their custody');
    missing.push('The reasons for seeking Khula, in the applicant\'s own words');
    missing.push('Whether any prior notice, family-court proceeding or mediation is pending');
  }

  return { label, facts, missing, salvaged, framingRecitals, academic: detected.academic, forum: detected.rule ? detected.rule.forum : null, partySide: directive.partySide, instructionOnly: directive.instructionOnly };
}

// Urdu-script equivalents of the ACADEMIC_REQUEST_RULES `forum` classes, used
// only for the office the SYSTEM chose. Keys must match those forum values.
const ACADEMIC_FORUM_UR = {
  'The Chairperson, Anti-Ragging / Discipline Committee': 'چیئرمین، انسدادِ رگنگ / انضباطی کمیٹی',
  'The Chairperson, Anti-Harassment Inquiry Committee': 'چیئرمین، انسدادِ ہراسانی تحقیقاتی کمیٹی',
  'The Registrar': 'رجسٹرار',
  'The Vice Chancellor': 'وائس چانسلر',
  'The Warden / Director of Student Affairs': 'وارڈن / ڈائریکٹر آف سٹوڈنٹ افیرز',
  'The Controller of Examinations': 'کنٹرولر آف امتحانات'
};

/**
 * P0 — the "what is still missing" asks are shown to the user verbatim, so they are
 * answer prose and follow the language the request was written in. Key legal
 * loanwords (police station, addressee, university / institution) stay recognisable
 * inside the Roman wording. Anything not listed passes through unchanged — an
 * untranslated ask is honest, a mistranslated one is not.
 */
const MISSING_ASK_ROMAN_PATTERNS = [
  [/specific amount or sum claimed/i, 'Matlabi raqam jo demand ki ja rahi hai (maslan Rs 750,000)'],
  [/date\/period when the matter happened/i, 'Woh tareekh ya period jab yeh waqia pesh aaya'],
  [/full facts/i, 'Poore waqiyat — kya hua, kaun shamil tha, aur kya wada kiya gaya ya kya kiya gaya'],
  [/police station where the case/i, 'Woh police station jahan mamla darj hona chahiye (ilaqay ke SHO ya police station ka naam)'],
  [/case\/FIR reference and the offence/i, 'Case/FIR ka hawala aur woh jurm jis ke liye zamanat maangi ja rahi hai'],
  [/name of the university \/ institution/i, 'University / idare ka naam aur woh office jise aap mukhatab hain (maslan Registrar, Vice Chancellor, Head of Department)'],
  [/Your full name/i, 'Aap ka poora naam (sender / applicant / complainant / petitioner)'],
  [/name and address of the addressee/i, 'Addressee ka naam aur pata (jis shakhs ya party ko notice diya jana hai)']
];

function localizeMissingAsks(missing, isRoman) {
  if (!isRoman) return missing;
  return (missing || []).map(m => {
    const hit = MISSING_ASK_ROMAN_PATTERNS.find(([re]) => re.test(String(m)));
    return hit ? hit[1] : m;
  });
}

/**
 * Phase 5/7 — compose a COMPLETE professional document from a free-text
 * drafting request, offline. English renders via renderFullLegalDocument (full
 * prose, corpus-grounded legal basis when chunks were actually retrieved); Urdu
 * Script renders via renderFullUrduDocument. Returns the endpoint payload shape
 * (html INCLUDING the document footer, type label, missing-information list).
 */
export function composeDraftFromRequest(requestText, opts = {}) {
  const language = opts.language === 'ur' ? 'ur' : 'en';
  const ana = analyzeDraftRequest(requestText);
  let facts = ana.facts;
  // Phase 5 — when a salvaged claim recital (English boilerplate) was inserted
  // but the document is being rendered in Urdu Script, swap in the parallel
  // Urdu recital so no system-generated English prose appears in the Urdu body.
  if (language === 'ur' && ana.salvaged && ana.salvaged.ur && facts[0] === ana.salvaged.en) {
    facts = facts.map((f, i) => (i === 0 ? ana.salvaged.ur : f));
  }
  // Same rule for framing tails that survived as facts: only the app's own
  // wording is replaced, and only with the recital in the document's language.
  if (ana.framingRecitals && Object.keys(ana.framingRecitals).length) {
    const key = language === 'ur' ? 'ur' : 'en';
    facts = facts.map(f => (ana.framingRecitals[f] || {})[key] || f);
  }
  // A Khula application asked for by instruction only still needs a real
  // structure: correct parties, a labelled placeholder for every personal
  // detail the user has not supplied, and the statutory route. Nothing about
  // Mehr is asserted — it is a separate claim, not a condition of Khula.
  const khulaInstructionOnly = /khula/i.test(ana.label) && !facts.length;
  if (khulaInstructionOnly) {
    facts = language === 'ur' ? [
      'درخواست گزرندہ کی بیوی کی حیثیت سے اپنے حق میں پیش کی جا رہی ہے؛ درخواست گزار زوجہ اور جواب دہندہ شوہر ہیں۔',
      'دونوں فریقین کا نکاح [نکاح کی تاریخ] کو ہوا اور نکاح نامہ [یونین کونسل / رجسٹریشن دفتر] میں رجسٹرڈ ہے۔',
      'درخواست گزار کا پتہ [درخواست گزار کا پتہ] اور جواب دہندہ کا پتہ [جواب دہندہ کا پتہ] ہے۔',
      'دونوں فریقین کے درمیان اختلافات پیدا ہو گئے جن کی وجوہات درخواست گزار کے اپنے الفاظ میں یہ ہیں: [خلع کی وجوہات]۔',
      'درخواست گزار مسلم فیملی لاز آرڈیننس 1961 کے تحت خلع کے ذریعے نکاح کی تنسیخ کا مطالبہ کرتی ہے۔ مؤخر مہر، اگر کوئی واجب الادا ہو، ایک علیحدہ مطالبہ ہے اور اس درخواست کی شرط نہیں۔'
    ] : [
      'The Applicant is the wife and files this application in her own right; the Respondent is her husband.',
      'The parties were married on [MISSING: date of marriage], and the Nikahnama is registered at [MISSING: union council / registration office].',
      'The Applicant resides at [MISSING: applicant\'s address] and the Respondent resides at [MISSING: respondent\'s address].',
      'Differences arose between the parties, the reasons being: [MISSING: the reasons for seeking Khula, in the Applicant\'s own words].',
      'The Applicant seeks dissolution of marriage by way of Khula under the Muslim Family Laws Ordinance, 1961. Any deferred Mehr is a separate claim and is not a condition of this application.'
    ];
  }

  const { label, missing } = ana;
  const chunks = Array.isArray(opts.chunks) ? opts.chunks : [];
  // Phase 4 — replies (incl. show-cause) go back to the office that sent the
  // document. When the request names it ("…notice from the Deputy Commissioner
  // dated 20 June 2026") the issuer and date flow into the To-block, the header
  // Date cell and the show-cause Prayer — real values, not placeholders.
  let replyDetails = '';
  if (/reply|show cause|response|جواب|شوکاز/i.test(label)) {
    const joined = facts.join(' ');
    const issuerM = joined.match(/\b(?:from|by)\s+(?:the\s+)?([A-Z][A-Za-z&.'-]*(?:\s+[A-Z][A-Za-z&.'-]*){1,5})/);
    const dateM = joined.match(/\bdated\s+(?:notice|letter|document)?\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4})/i);
    if (issuerM) replyDetails += 'issuer: ' + issuerM[1];
    if (dateM) replyDetails += (replyDetails ? ', ' : '') + 'date: ' + dateM[1];
  }
  // Phase 3 — extract identity / structured fields from the free-text request so
  // the rendered document shows real names instead of [YOUR FULL NAME] etc.
  // Patterns handled: "Student name: Ahmed", "name: Ahmed Ali", "University:
  // Punjab University", "Class / Department: BS CS", "Father name: …", "CNIC: …",
  // "Address: …", "Roll No: …", "Reg No: …".
  const identityParts = [];
  // P3 — a person's name is kept WHOLE. The value is captured generously, then
  // trimmed to the leading run of capitalized words: "Ali Raza" never degrades to
  // "Ali", while a following clause ("… and I request") is never swallowed.
  const STOP_NAME = /^(?:is|am|are|was|were|student|son|daughter|resident|working|studying|from|and|or|s\/?o|d\/?o|advocate|mr|mrs|ms|dr)$/i;
  const toPersonName = (v) => {
    const out = [];
    for (const w of String(v || '').trim().split(/\s+/)) {
      if (!/^[A-Z\u0600-\u06FF]/.test(w) || STOP_NAME.test(w)) break;
      const core = w.replace(/[.,;:!؟]+$/, '');
      // A title is kept whole: "Mr. Ali Raza" must never print as "Mr Ali Raza".
      out.push(/\.$/.test(w) && isNameAbbrev(core) ? `${core}.` : core);
    }
    const name = out.join(' ').trim();
    return name.length >= 2 ? name : String(v || '').trim().replace(/[.,;:]+$/, '');
  };
  const extractField = (re, key, transform) => { const m = requestText.match(re); if (m) identityParts.push(key + ': ' + (transform ? transform(m[1].trim()) : m[1].trim())); };
  extractField(/(?:my\s+name|(?<![\w])name|naam)\s*(?:is|:)\s*([A-Z\u0600-\u06FF][A-Za-z\u0600-\u06FF'.-]*(?:\s+[A-Za-z\u0600-\u06FF'.-]+){0,5})/i, 'name', toPersonName);
  extractField(/(?:student\s+name|applicant\s+name)\s*[:=]\s*([A-Z\u0600-\u06FF][A-Za-z\u0600-\u06FF'.-]*(?:\s+[A-Za-z\u0600-\u06FF'.-]+){0,5})/i, 'student', toPersonName);
  extractField(/(?:class|department|dept|programme|program|course)\s*[:=]\s*([A-Za-z\u0600-\u06FF0-9][A-Za-z\u0600-\u06FF0-9 /.-]{1,40})/i, 'discipline', v => v.replace(/[.\s]+$/, ''));
  extractField(/(?:roll\s*(?:no|number)|reg(?:istration)?\s*(?:no|number)|roll\s*num)\s*[:=]\s*([A-Za-z0-9][\w./-]{1,20})/i, 'caseNo');
  extractField(/(?:father(?:'s)?\s*(?:name|naam))\s*[:=]\s*([A-Z\u0600-\u06FF][A-Za-z\u0600-\u06FF'.-]*(?:\s+[A-Za-z\u0600-\u06FF'.-]+){0,5})/i, 'father', toPersonName);
  extractField(/(?:cnic|id(?:entity)?\s*(?:card)?(?:\s*no)?)\s*[:=]\s*([0-9][\d-]{5,20})/i, 'cnic');
  extractField(/(?:address|located\s+at|situated\s+at)\s*[:=]\s*([A-Za-z\u0600-\u06FF0-9][\w,./-]{3,80})/i, 'address');
  // P3 — a recipient named in the request ("legal notice to Ali Raza for …") is
  // data the user supplied, not a blank left for them to fill: the name goes into
  // the To-block exactly as typed and only the address is marked unknown. Office
  // words are skipped — the authority block below owns the addressee there.
  const RECIPIENT_OFFICE = /^(?:the\s+)?(?:registrar|vice\s*chancellor|vc|principal|dean|warden|chairman|head|sho|station|court|authority|office|committee|board|sir|madam|addressee|respondent|applicant|student|tenant|landlord|employer|employee|bank|company|firm|university|college|institute|school|department|government|society|council|dealer|seller|vendor|buyer)\b/i;
  const recipM = requestText.match(/(?:notice|letter|complaint|application|request|reply|demand)\s+(?:to|upon|against)\s+((?:[A-Z\u0600-\u06FF][A-Za-z\u0600-\u06FF'.&-]+\s+){1,4})/i);
  // The same debtor is often named at the transfer verb instead of the framing
  // clause ("a legal notice for recovery of a loan of Rs 500,000 that I gave to
  // Mr. Ali Raza"). The notice is addressed to that person, so their name belongs
  // in the To-block too — only when the framing clause named no one.
  const transferM = recipM ? null : requestText.match(/\b(?:gave|given|lent|loaned|advanced|issued|sent|delivered|sold|transferred|owed|paid)\s+(?:it\s+|them\s+)?to\s+((?:[A-Z\u0600-\u06FF][A-Za-z\u0600-\u06FF'.&-]+\s+){1,4})/i);
  const recipCaptured = recipM ? recipM[1] : (transferM ? transferM[1] : null);
  // An institution is never the person to serve, wherever its word sits in the
  // name: "notice to Habib Bank Limited" names a payee, not an addressee.
  const INSTITUTION_NAME = /\b(?:bank|limited|ltd|inc|corp(?:oration)?|company|co\b|firm|university|college|institute|school|department|government|society|council|board|authority|hospital|municipal|office)\b/i;
  if (recipCaptured) {
    const recipName = toPersonName(recipCaptured);
    const selfName = (identityParts.find(part => part.startsWith('name: ')) || '').slice(6).trim();
    if (recipName && !RECIPIENT_OFFICE.test(recipName) && !INSTITUTION_NAME.test(recipName) && recipName.toLowerCase() !== selfName.toLowerCase()) {
      identityParts.push(`recipient: ${recipName}, [MISSING: the recipient's address]`);
    }
  }
  // P2 — the forum is read from what the user actually asked for. An office named
  // in the request always wins; otherwise an academic document is addressed to its
  // own class of office (Registrar / Vice Chancellor / Committee) with the
  // institution left visibly unknown. Never a court unless it IS a court document.
  const NAMED_OFFICE = /\b(?:vice\s*chancellor|pro[\s-]?vice\s*chancellor|registrar|dean\s+of|(?:head|controller)\s+of\s+(?:studies|examinations)|principal|warden|discipline(?:ry)?\s+committee|anti[\s-]?ragging\s+committee|anti[\s-]?harassment[\s-]*(?:inquiry\s+)?committee|harassment\s+committee|inquiry\s+committee|admissions?\s+(?:office|committee)|board\s+of\s+(?:studies|governors))\b/i;
  const institutionM = requestText.match(/(?:^|[\s,])([A-Z][A-Za-z&.'-]*(?:\s+[A-Z][A-Za-z&.'-]*){0,3}\s+(?:University|Institute|College|School|Campus))\b/);
  const institutionKV = requestText.match(/(?:university|institute|institution|college|school)\s*[:=]\s*([A-Z\u0600-\u06FF][A-Za-z\u0600-\u06FF&. \-]{2,50})/);
  const institution = institutionM ? institutionM[1].trim()
    : (institutionKV ? institutionKV[1].trim().replace(/[.,;\s]+$/, '') : null);
  const officeM = requestText.match(NAMED_OFFICE);
  // The same office named in Urdu script must win too. It is mapped to the English
  // office class the Latin path uses, then localized back by forumFor — so the
  // address line is never a mix of "The" and Urdu, and never the default forum.
  const UR_OFFICE_CLASS = { 'وائس چانسلر': 'Vice Chancellor', 'رجسٹرار': 'Registrar', 'وارڈن': 'Warden', 'پرنسپل': 'Principal' };
  const officeMUr = requestText.match(/(?:وائس\s*چانسلر|رجسٹرار|وارڈن|پرنسپل)/);
  const urOfficeKey = officeMUr && officeMUr[0].replace(/\s+/g, ' ');
  const officeClass = officeM
    ? officeM[0].replace(/\s+/g, ' ').replace(/^\w/, c => c.toUpperCase())
    : (urOfficeKey && UR_OFFICE_CLASS[urOfficeKey] ? 'The ' + UR_OFFICE_CLASS[urOfficeKey] : null);
  const forumFor = f => (language === 'ur' && ACADEMIC_FORUM_UR[f]) ? ACADEMIC_FORUM_UR[f] : f;
  const unknownInstitution = language === 'ur' ? '[یونیورسٹی / ادارے کا نام]' : '[NAME OF THE UNIVERSITY / INSTITUTION]';
  let authorityValue = null;
  if (officeClass) {
    const titled = /^(?:the|board|admissions|hec)\b/i.test(officeClass) ? officeClass : 'The ' + officeClass;
    authorityValue = institution ? `${forumFor(titled)}, ${institution}` : `${forumFor(titled)}, ${unknownInstitution}`;
  } else if (institution) {
    authorityValue = `${forumFor(ana.forum || 'The Registrar')}, ${institution}`;
  } else if (ana.academic && ana.forum) {
    authorityValue = `${forumFor(ana.forum)}, ${unknownInstitution}`;
  }
  if (authorityValue) identityParts.push('authority: ' + authorityValue);
  const detailsStr = [replyDetails, ...identityParts].filter(Boolean).join(', ');
  // Phase 3 — remove sentences from facts that are purely structured label-value
  // pairs (e.g. "Student name: Ahmed, University: Punjab University, Class: BS
  // Computer Science.") — these are identity data, not factual narrations.
  const LABEL_VALUE_LINE = /^(?:\s*(?:student|applicant|sender|my|author|writer)\s+)?(?:name|university|institute|college|school|class|department|dept|programme|program|course|roll\s*(?:no|number)|reg(?:istration)?\s*(?:no|number)|father(?:'s)?\s*(?:name|naam)|cnic|address)\s*[:=]\s*.+/i;
  facts = facts.filter(f => {
    const parts = String(f).split(/[,;]/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return true;
    const labelParts = parts.filter(p => LABEL_VALUE_LINE.test(p));
    return labelParts.length < parts.length;
  });
  // Presentation polish only — never content invention: canonicalize currency
  // words typed casually and terminate each fact sentence so numbered clauses
  // read as complete prose (Phase 7). No first-letter capitalization: the
  // clause prefix ("That / کہ") makes the fact mid-sentence, so the user's own
  // casing is preserved except a standalone leading "i" → "I".
  const tidy = facts.map(f => {
    let s = String(f || '').trim();
    s = s.replace(/\brs\.?\s+/gi, 'Rs ').replace(/\bpkr\s+/gi, 'PKR ').replace(/\brupees\b/gi, 'Rupees');
    if (language === 'ur') {
      if (!/[.!?۔…]$/.test(s)) s += '۔';
    } else {
      if (/^i(?:\s|$)/.test(s)) s = 'I' + s.slice(1);
      if (!/[.!?۔…]$/.test(s)) s += '.';
    }
    return s;
  });
  if (language === 'ur') {
    return {
      html: renderFullUrduDocument({ type: label, details: detailsStr, paragraphs: tidy, chunks, academic: ana.academic, forum: ana.forum }),
      type: label,
      missingInformation: localizeMissingAsks(missing, opts.metaLanguage === 'roman_urdu'),
      isOffline: true,
      isUrdu: true
    };
  }
  // The renderer must not let a thin narrative read as a complete statement of
  // facts: the same mandatory ask that surfaces in `missingInformation` is also
  // marked inline, so the document itself stays honest about what is absent.
  const factsIncomplete = missing.some(m => /full facts/i.test(String(m)));
  const khulaHeading = /khula/i.test(label)
    ? { heading: 'APPLICATION FOR DISSOLUTION OF MARRIAGE (KHULA)' }
    : null;
  return {
    html: renderFullLegalDocument({ type: label, details: detailsStr, chunks, paragraphs: tidy, factsIncomplete, academic: ana.academic, forum: ana.forum, structure: khulaHeading }) + INSAF_DOC_FOOTER,
    type: label,
    missingInformation: localizeMissingAsks(missing, opts.metaLanguage === 'roman_urdu'),
    isOffline: true,
    isUrdu: false
  };
}

/**
 * Part P — draft a structured legal response from an uploaded document, entirely
 * offline. Grounded ONLY in the source text; every unknown is marked [MISSING].
 * Returns the same shape as the online /document-reply endpoint.
 */
export function draftFromDocument(text, opts = {}) {
  const cleanText = String(text || '').trim();
  const TYPE_LABEL = { reply: 'Reply', application: 'Application', complaint: 'Complaint', legal_notice: 'Legal Notice' };
  const replyType = TYPE_LABEL[opts.replyType] ? opts.replyType : 'reply';
  const structure = opts.structure || null;
  const analysis = analyzeDocumentText(cleanText, '', { preferredLanguage: 'en' });
  const refDate = analysis.dates.length ? firstToken(analysis.dates[0]) : null;
  const claimedAmount = (String(cleanText).match(REQUEST_MONEY) || [])[0] || null;

  // Phase 10 — the user's own instruction lines drive the reply body. Meta /
  // app-chrome lines (UI defaults like "Iska jawab bana do…", language mandates,
  // structure directives) are filtered out so they never appear as reply
  // paragraphs; substantive lines enter the reply body in BOTH languages —
  // verbatim, never rewritten, never invented (Phase 7/13).
  const userInstruction = String(opts.instruction || '').trim();
  const userParas = userInstruction ? userInstruction.split(/\n+/).map(s => s.trim()).filter(p => p && !isMetaInstructionLine(p)) : [];

  // Part A / Phase AU — the document BODY language is the user's explicit document
  // choice (opts.language); Urdu Script is a document-only output language.
  // P0 — the META guidance (explanation / next steps / submission / missing info)
  // is the assistant's own answer, so it follows the product language contract
  // resolved by the caller: English or Roman Urdu, never Urdu Script.
  const isRomanMeta = opts.metaLanguage === 'roman_urdu';
  const TYPE_ROMAN = { reply: 'jawab', application: 'darkhast', complaint: 'shikayat', legal_notice: 'qanooni notice' };
  const submission = analysis.authorities[0]
    ? proseMeta(isRomanMeta,
      `As named in your document, this is addressed to the ${analysis.authorities[0]}. Submit the signed original there and obtain a dated receipt/stamp; keep a copy for your record.`,
      `Jaisa aap ke document mein naamzuda hai, yeh ${analysis.authorities[0]} ko mukhatab hai. Dastakhat shuda asli nusukha wahan jama karein aur tareekh wala rasid/mohar hasil karein; apne paas ek nusukha rakhen.`)
    : null;
  const meta = {
    explanation: proseMeta(isRomanMeta,
      `This is a locally drafted ${TYPE_LABEL[replyType].toLowerCase()} prepared from the actual text of your uploaded ${analysis.documentType || 'document'}. It preserves the facts found in that document and marks every unknown item so nothing is invented.`,
      `Yeh aap ke upload kiye gaye ${analysis.documentType || 'document'} ke asli text se locally taiyar kiya gaya ${TYPE_ROMAN[replyType]} hai. Is mein us document mein mile hue waqiyat barqarar rakhe gaye hain aur har namaloom cheez nishan lagayee gayi hai — kuch bhi ijaad nahi kiya gaya.`),
    nextSteps: proseMeta(isRomanMeta,
      [
        'Fill every marked field with accurate information from your records.',
        'Attach copies of the documents/evidence referred to (the original document, your CNIC, and any receipts or correspondence).',
        'Sign and date the document, then submit before any deadline stated in the source document.',
        'Keep a stamped/acknowledged copy of whatever you submit.'
      ],
      [
        'Nishan lagaye gaye har khaanay ko apne records ke mutabiq parka karein.',
        'Hawala diye gaye documents/saboojat ki naslen sanlagn karen (asli document, apna CNIC, aur rasid ya khat-o-kitaabat).',
        'Document par dastakhat aur tareekh likhen, phir source document mein batay gaye aakhri tareekh se pehle jama karein.',
        'Jo kuch bhi jama karein us ka mohar ya tasdeeq shuda nusukha apne paas rakhen.'
      ]),
    submission,
    missingInformation: proseMeta(isRomanMeta,
      ['Your point-by-point reply/grounds', 'Full names, CNIC and addresses of the parties', 'The specific relief or outcome you want', 'Any fact not present in the uploaded document'],
      ['Aap ka point-be-point jawab/daleel', 'Tarafain ke poore naam, CNIC aur pata', 'Aap jo khaas relief ya natija chahte hain', 'Upload kiye gaye document mein maujood na hone wala har waqiya']),
    isOffline: true
  };

  // Part A / Phase AU — Urdu Script document behavior: render the SAME grounded
  // reply in Urdu (RTL). Only the fixed boilerplate/labels are localized (in
  // server/docUrdu.js); facts extracted from the uploaded source document
  // (parties, dates, authorities, type) are passed through and preserved
  // VERBATIM — never invented or machine-translated, and every unknown stays
  // marked for the user to fill.
  if (opts.language === 'ur') {
    const urduHtml = renderUrduReplyDocument({
      documentType: analysis.documentType || null,
      parties: analysis.parties.slice(0, 4),
      dates: analysis.dates.slice(0, 3).map(firstToken),
      authorities: analysis.authorities.slice(0, 3),
      requirements: analysis.requirements.slice(0, 2),
      amounts: claimedAmount ? [claimedAmount] : [],
      refDate
    }, { replyType, structure, instructionParas: userParas });
    return { html: urduHtml, ...meta };
  }

  const heading = (structure && structure.heading) || `${TYPE_LABEL[replyType]} to ${analysis.documentType || 'the Document'}`;
  // The structure court line is a caption TEMPLATE (tokens such as [RECIPIENT] /
  // [ADVOCATE]); this reply flow has no user field map, so unresolved tokens are
  // stripped — never printed — and the caption falls back to the authority the
  // uploaded source document actually names.
  let courtLine = (structure && structure.courtLine) ? fillCourtLineTokens(structure.courtLine, null) : '';
  if (!courtLine && analysis.authorities[0]) courtLine = `To, ${analysis.authorities[0]}`;

  let html = `<div style="font-family: 'Times New Roman', serif; text-align: justify; max-width: 800px; margin: 0 auto; line-height: 1.7;">`;
  html += `<h2 style="text-align:center; text-transform:uppercase; text-decoration:underline;">${esc(heading)}</h2>`;
  if (courtLine) html += `<p style="text-align:center; font-weight:bold;">${esc(courtLine)}</p>`;
  if (structure && structure.authorityNote) html += `<p style="font-style:italic; font-size:0.9em; color:#4b5563;">${esc(structure.authorityNote)}</p>`;

  html += `<p style="margin-top:16px;"><b>Subject:</b> ${esc(TYPE_LABEL[replyType])} in response to the ${esc(analysis.documentType || 'received document')}${refDate ? ` dated ${esc(refDate)}` : ''}.</p>`;
  html += `<p>Respected Sir / Madam,</p>`;
  html += `<p>With reference to the ${esc(analysis.documentType || 'document')}${refDate ? ` dated ${esc(refDate)}` : ''} received/served upon the undersigned, the following facts are stated on the basis of that document:</p>`;

  const facts = [];
  if (analysis.parties.length) facts.push(`<b>Parties named:</b> ${esc(analysis.parties.slice(0, 4).join('; '))}`);
  if (analysis.dates.length) facts.push(`<b>Relevant dates:</b> ${esc(analysis.dates.slice(0, 3).map(firstToken).join(', '))}`);
  if (analysis.authorities.length) facts.push(`<b>Authority / forum:</b> ${esc(analysis.authorities.slice(0, 3).join(', '))}`);
  if (analysis.requirements.length) facts.push(`<b>What the document requires:</b> ${esc(analysis.requirements.slice(0, 2).join(' | '))}`);
  if (claimedAmount) facts.push(`<b>Amount claimed:</b> ${esc(claimedAmount)}`);
  if (facts.length) html += `<ol style="margin:8px 0 16px 20px;">${facts.map(f => `<li style="margin-bottom:6px;">${f}</li>`).join('')}</ol>`;

  html += `<p><b>Reply / Grounds:</b></p>`;
  // Phase 6/9/10: fold the user's own instruction into the reply body so the
  // draft reads as a substantive document. Only the user's supplied words and
  // the facts found in the uploaded source are used — nothing is invented; any
  // point the user has not addressed stays clearly marked for them to complete.
  if (userParas.length) {
    userParas.forEach((p, i) => { html += `<p style="margin-bottom:12px;"><b>${i + 1}.</b>&nbsp;&nbsp;${esc(p)}</p>`; });
  } else {
    html += `<p style="margin-bottom:12px;">[MISSING: your point-by-point response to each allegation/requirement stated above — please provide your version and the reply will be written into this structure]</p>`;
  }

  // Para-wise skeleton derived ONLY from the requirements the source document
  // actually states — gives the reply its real paragraph structure without
  // fabricating the user's answers.
  if (analysis.requirements.length) {
    html += `<p style="margin-top:8px;"><b>Para-wise response to the document's requirements:</b></p>`;
    html += `<ol style="margin:8px 0 16px 20px;">${analysis.requirements.slice(0, 6).map(r => `<li style="margin-bottom:6px;">With reference to "${esc(String(r).slice(0, 160))}" — ${userParas.length ? 'the reply above addresses this; please confirm or add specifics.' : '[state your specific response]'}</li>`).join('')}</ol>`;
  }

  if (replyType === 'complaint' || replyType === 'application') {
    html += `<p style="margin-top:16px;"><b>Prayer:</b> It is therefore most respectfully prayed that ${userParas.length ? 'the relief/outcome set out above' : '[MISSING: the relief/order sought]'} may kindly be granted.</p>`;
  } else {
    html += `<p style="margin-top:16px;">It is therefore requested that the contents of the ${esc(analysis.documentType || 'document')} be considered in light of the above and appropriate action be taken.</p>`;
  }

  const signLabel = replyType === 'complaint' ? 'Complainant' : replyType === 'legal_notice' ? 'Sender / Advocate' : 'Applicant / Respondent';
  html += `<div style="text-align:right; margin-top:40px;"><p>____________________________________</p><p><b>${esc(signLabel)}</b></p><p>Name: ______________ &nbsp; CNIC: ______________</p><p>Date: ____________ &nbsp; Place: ____________</p></div>`;
  html += `<p style="font-style:italic; font-size:0.9em; color:#6b7280; margin-top:24px;">Note: Formats may vary by court or authority. Verify the exact format with the relevant office before submission.</p>`;
  html += INSAF_DOC_FOOTER;
  html += `</div>`;

  return { html, ...meta };
}

// ============================================================================
// Phase 5 / 8 / 9 — FULL PROFESSIONAL LEGAL DOCUMENT COMPOSER (offline)
// ----------------------------------------------------------------------------
// The previous owned-model document path rendered the user's answers as bare
// "Label: ______" field lines — a form, not a document. This composer writes a
// COMPLETE, submittable legal document: sender/advocate identification, date &
// reference line, recipient block, subject, formal opening, a representation
// statement, numbered substantive paragraphs built from the facts the user
// actually supplied, a corpus-grounded legal-basis clause, the demand / prayer /
// relief, a requested deadline (framed as the sender's request, never an invented
// legal mandate), consequences and reservation of rights (for notices), a
// verification clause, the signature block and enclosures. NON-FABRICATION:
// missing facts become clearly marked inline placeholders while the rest of the
// document is still fully drafted; legal-basis citations come only from records
// the RAG layer actually retrieved.
// ============================================================================

const DOC_BLANK_RE = /^[\s_]*$/;

// A short, human-readable label for each known form field name; unknown names
// fall back to a prettified version of the key itself.
const FIELD_READABLE = {
  sender: 'Notice issuer', recepient: 'Recipient', recipient: 'Recipient', toSender: 'Addressed to (original sender)',
  lawyer: 'Advocate / counsel', replier: 'Replier', subject: 'Subject', matter: 'Subject matter',
  facts: 'Facts of the matter', description: 'Detailed account', grievance: 'Grievance / claim',
  demand: 'Demand / required action', relief: 'Relief / order sought', assistance: 'Assistance requested',
  deadline: 'Time limit', station: 'Police station', complainant: 'Complainant', applicant: 'Applicant',
  petitioner: 'Petitioner', plaintiff: 'Plaintiff', defendant: 'Defendant', respondent: 'Respondent',
  accused: 'Accused / suspect', suspect: 'Accused / suspect', cnic: 'CNIC', father: 'Father / guardian name',
  address: 'Address', incidentTime: 'Date & time of incident', incident: 'Incident details', location: 'Place of incident',
  crimeHeader: 'Nature of offence', sections: 'Relevant sections', witness: 'Witnesses', witness1: 'Witness 1', witness2: 'Witness 2',
  court: 'Court / forum', caseNo: 'Case / FIR reference', suitNo: 'Suit number', firNo: 'FIR number / date', noticeRef: 'Notice reference & date',
  grounds: 'Grounds', parawiseReply: 'Para-wise reply', orderRef: 'Legal provision relied upon', surety: 'Surety / bonds',
  custodyDays: 'Days in custody', currentCustody: 'Present custody', childName: 'Child name', childAge: 'Child age', children: 'Children',
  minor: 'Minor', marriageDate: 'Date of marriage', amount: 'Amount', income: 'Monthly income', article: 'Constitutional article',
  impugnedAction: 'Impugned action / order', writType: 'Nature of writ', employer: 'Employer / establishment', employee: 'Employee',
  designation: 'Designation', authority: 'Authority', platform: 'Platform', evidence: 'Evidence', product: 'Product / service',
  purchaseDate: 'Date of purchase', defect: 'Defect / deficiency', property: 'Property / subject matter', propDetails: 'Property details',
  price: 'Consideration / price', registryNo: 'Registry number', rent: 'Monthly rent', security: 'Security deposit', duration: 'Period',
  seller: 'Seller', buyer: 'Buyer', vendor: 'Vendor', invoice: 'Invoice number', dueDate: 'Due date', lateDays: 'Days overdue',
  misconduct: 'Alleged misconduct', dateOfEvent: 'Date of event', issuer: 'Issuing authority', empId: 'Employee ID', id: 'ID',
  stage: 'Stage of proceedings', caseType: 'Case type & forum', contact: 'Contact details', reason: 'Reason', basis: 'Basis of claim'
};

// Field names that populate the header / parties block rather than the numbered
// body paragraphs (rendered separately so they are never lost or duplicated).
const HEADER_FIELDS = new Set(['sender', 'recipient', 'recepient', 'toSender', 'lawyer', 'replier', 'subject', 'matter',
  'court', 'station', 'authority', 'issuer', 'cnic', 'father', 'address', 'complainant', 'applicant', 'petitioner',
  'plaintiff', 'defendant', 'respondent', 'accused', 'suspect', 'employee', 'employer', 'student', 'vendor', 'seller',
  'buyer', 'landlord', 'tenant', 'minor', 'otherParty', 'supervisor', 'faculty', 'discloser', 'bank', 'branch', 'uni', 'dept', 'date', 'noticeDate', 'noticeRef', 'discipline', 'name']);

function blankValue(v) { return v == null || DOC_BLANK_RE.test(String(v)); }
function readableName(n) { return FIELD_READABLE[n] || String(n).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

// A narrative is split into numbered paragraphs at every sentence mark, but
// "I gave it to Mr. Ali Raza" must not become two paragraphs: the period inside
// a honorific/official abbreviation is masked before the split and restored
// after it. The sentinel carries no punctuation, so the splitter ignores it.
const HONORIFIC_ABBREV_RE = /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Adv|Hon|Rev|Jr|Sr|SP|DIG|IGP|SSP|DSP|SHO|HC|SI)\.(?=\s)/gi;
const DOT_SENTINEL = '@@DOT@@';
function splitFreeTextSentences(raw) {
  return String(raw || '')
    .replace(HONORIFIC_ABBREV_RE, m => m.slice(0, -1) + DOT_SENTINEL)
    .split(/[.!?]+/)
    .map(s => s.split(DOT_SENTINEL).join('.').trim())
    .filter(s => s.length > 10);
}

/**
 * @param {object} p
 * @param {string} p.type        Document / sub-category label from the client
 * @param {object} [p.structure] { heading, courtLine, authorityNote, sections:[{label,hint}] }
 * @param {string} p.details     "fieldName: value, fieldName: value, ..." (underscores = not supplied)
 * @param {Array}  [p.chunks]    RAG chunks actually retrieved for this document (grounding only)
 * @param {string} [p.language]  'en' (this composer is English-only; Urdu routes to docUrdu)
 * @returns {string} complete document HTML (no footer added here — caller appends INSAF_DOC_FOOTER)
 */
export function renderFullLegalDocument(p = {}) {
  const { type = 'Legal Document', structure = null, details = '', chunks = [], paragraphs = null, factsIncomplete = false } = p;
  const M = {};
  String(details || '').split(/,(?=\s*[A-Za-z][\w]*\s*:)/).forEach(part => {
    const idx = part.indexOf(':');
    if (idx === -1) return;
    const k = part.substring(0, idx).trim();
    const v = part.substring(idx + 1).trim();
    if (k) M[k] = v;
  });
  const grab = (...names) => { for (const n of names) { if (!blankValue(M[n])) return String(M[n]).trim(); } return null; };

  const heading = (structure && structure.heading) || String(type).split('/')[0].trim().toUpperCase() || 'LEGAL DOCUMENT';
  const typeStr = String(type).toLowerCase() + ' ' + String(heading).toLowerCase() + ' ' + String(structure && structure.courtLine || '').toLowerCase();
  // A "Show-Cause Reply" carries both classes in its label; the show-cause
  // branch must win so the reply is addressed to the issuing authority and
  // closes with the show-cause Prayer instead of the generic reply frame.
  // P2 — a university matter is addressed to an internal office (Registrar, Vice
  // Chancellor, Anti-Ragging Committee), NOT to a court. Words like "complaint"
  // or "appeal" must not pull an academic document into court framing.
  const isAcademicForum = p.academic === true || (!p.academic && /universit|academic|college|school|student|hostel|ragging|hazing|vice\s+chancellor|head\s+of\s+department|controller\s+of\s+(?:studies|examinations)|transcript|semester|\bhec\b/i.test(typeStr));
  const isShowCause = /show[\s-]?cause/.test(typeStr);
  const isReply = /reply/.test(typeStr) && !isShowCause;
  const isNotice = /legal notice|demand notice|defamation notice|reminder/.test(typeStr) && !isReply && !isShowCause;
  const isComplaint = !isAcademicForum && /complaint|\bfir\b|cyber|labour|consumer/.test(typeStr);
  const isPetition = !isAcademicForum && /petition|writ|constitutional|appeal|revision|guardian|custody/.test(typeStr);
  const isBail = !isAcademicForum && /bail/.test(typeStr);
  const isApplication = /application|injunction|stay|maintenance|request|leave|concession|transcript|university|academic|fee\s+(?:concession|waiver)|student/.test(typeStr);
  const isLetter = /letter|general legal/.test(typeStr) && !isNotice && !isReply && !isApplication && !isComplaint;
  // A document is a court matter only when a court is actually its forum — named
  // in the type or in the guided structure's court line. "Application" by itself
  // is not a court word, so legal language alone never buys court wording here.
  const isCourtForum = !isAcademicForum && (isComplaint || isPetition || isBail || /court|hon'?ble|sessions|judge|tribunal|civil\s+claim|\bsuit\b|\bplaint\b/i.test(typeStr));

  const P = (s) => `<p style="margin:0 0 12px; text-align: justify;">${s}</p>`;

  const authorName = grab('applicant', 'petitioner', 'complainant', 'plaintiff', 'sender', 'replier', 'employee', 'student', 'accused', 'name', 'accName', 'discloser');
  const authorFather = grab('father');
  const authorAddress = grab('address');
  const authorCnic = grab('cnic');
  const counsel = grab('lawyer');
  const authorityLine = grab('court', 'station', 'authority', 'issuer', 'bank', 'branch');
  // P11 hygiene — the structure court line is a caption TEMPLATE (tokens such as
  // [CITY] / [POLICE STATION] / [RECIPIENT]); fill each token from the user's
  // field values and strip anything still unresolved so raw bracket tokens are
  // never printed into a finished document.
  const courtLineClean = (structure && structure.courtLine) ? fillCourtLineTokens(structure.courtLine, grab) : '';
  const subject = grab('subject', 'matter', 'title', 'crimeHeader', 'writType');
  // Phase 4 — the addressee block must NEVER read "To, [THE ADDRESSEE]". Police
  // documents address the Station House Officer by law and only the police
  // station is unknown; court/authority documents mark the verified forum class;
  // notices/replies mark exactly whose details are missing. When nothing is
  // known at all the block is omitted instead of printing a blank form.
  const toBlock = (isNotice || isReply || isShowCause)
    ? (grab('recipient', 'recepient', 'toSender') || grab('respondent', 'defendant', 'employer', 'seller', 'vendor') || (isShowCause ? authorityLine : null))
    : (authorityLine || courtLineClean || null);
  const addresseeHint = toBlock ? null : (() => {
    if (isAcademicForum) {
      return 'To,<br/>The Vice Chancellor / Registrar,<br/>[NAME OF THE UNIVERSITY / INSTITUTION],<br/>[City / District]';
    }
    if (/first information|\bfir\b|police (?:complaint|case|report)/.test(typeStr)) {
      return 'To,<br/>The Station House Officer (SHO),<br/>[NAME OF POLICE STATION],<br/>[City / District]';
    }
    if (/cyber|peca|nr3c/.test(typeStr)) return 'To,<br/>The Officer in Charge,<br/>FIA Cyber Crime Wing (NR3C),<br/>[City / District]';
    // A statutory forum named by the user outranks a generic court.
    if (/consumer/.test(typeStr)) return 'To,<br/>The Presiding Officer,<br/>[Consumer Court having jurisdiction]';
    if (/labou?r/.test(typeStr)) return 'To,<br/>The Presiding Officer,<br/>[Labour Court / Labour Authority having jurisdiction]';
    // Court matters stated in free text carry no structure caption, so the forum
    // class is stated here — the concrete court/city is left visibly unresolved.
    // Patterns stay anchored: "plaint" must not match inside "complaint".
    if (/\bbail/.test(typeStr)) return "To,<br/>The Hon'ble Court of Sessions,<br/>[City / District]";
    if (/\bwrit\b|constitutional/.test(typeStr)) return "To,<br/>The Hon'ble High Court,<br/>[City / Province]";
    if (/\bsuit\b|\bplaint\b/.test(typeStr)) return 'To,<br/>The Court of the Civil Judge,<br/>[City / District]';
    if (/\bpetition\b|\bappeal\b|\brevision\b/.test(typeStr)) return "To,<br/>The Hon'ble [Court having jurisdiction]";
    if (isShowCause) return 'To,<br/>[THE AUTHORITY / OFFICE THAT ISSUED THE SHOW-CAUSE NOTICE]';
    if (isReply) return 'To,<br/>[FULL NAME AND ADDRESS OF THE SENDER OF THE NOTICE / DOCUMENT]';
    if (isNotice) return 'To,<br/>[FULL NAME AND ADDRESS OF THE RECIPIENT]';
    return null;
  })();

  let html = `<div style="font-family: 'Times New Roman', serif; text-align: justify; max-width: 800px; margin: 0 auto; line-height: 1.7; color:#111;">`;
  html += `<h2 style="text-align:center; text-transform:uppercase; text-decoration:underline; margin-bottom:6px;">${esc(heading)}</h2>`;
  if (courtLineClean) html += `<p style="text-align:center; font-weight:bold; margin:0 0 4px;">${esc(courtLineClean)}</p>`;
  if (structure && structure.authorityNote) html += `<p style="font-style:italic; font-size:0.9em; color:#4b5563; text-align:center; margin:0 0 12px;">${esc(structure.authorityNote)}</p>`;

  const refNo = grab('caseNo', 'suitNo', 'firNo', 'invoice', 'registryNo', 'noticeRef');
  const dateSupplied = grab('date', 'lostDate', 'purchaseDate', 'marriageDate', 'incidentTime', 'dueDate', 'lastDay', 'start', 'dateOfEvent');
  // P1 hygiene — unknown reference/date cells are OMITTED, never printed as
  // "[REFERENCE NO.]"/"[DATE]" blanks; the header still carries what is known.
  const addrLine = toBlock ? `To,<br/>${esc(toBlock)}` : addresseeHint;
  const rightBits = [];
  if (refNo) rightBits.push(`Ref: ${esc(refNo)}`);
  if (dateSupplied) rightBits.push(`Date: ${esc(dateSupplied)}`);
  if (addrLine || rightBits.length) {
    if (addrLine && rightBits.length) {
      html += `<table style="width:100%; margin:8px 0 16px;"><tr><td style="text-align:left; vertical-align:top;">${addrLine}</td><td style="text-align:right; vertical-align:top; white-space:nowrap;">${rightBits.join('<br/>')}</td></tr></table>`;
    } else if (addrLine) {
      html += `<p style="margin:8px 0 16px;">${addrLine}</p>`;
    } else {
      html += `<p style="margin:8px 0 16px; text-align:right; white-space:nowrap;">${rightBits.join('<br/>')}</p>`;
    }
  }

  if (counsel) html += P(`<i>Through: Advocate ${esc(counsel)}</i>`);
  html += P(`<b>Subject:</b> ${esc(subject || String(type).split('/')[0].trim())}`);
  html += P(`Respected Sir / Madam,`);

  const authorBits = [];
  authorBits.push(authorName ? esc(authorName) : '[YOUR FULL NAME]');
  if (authorFather) authorBits.push(`son/daughter of ${esc(authorFather)}`);
  if (authorAddress) authorBits.push(`resident of ${esc(authorAddress)}`);
  if (authorCnic) authorBits.push(`CNIC ${esc(authorCnic)}`);
  const authorDesc = authorBits.join(', ');
  let opening;
  if (isNotice) opening = `I, ${authorDesc}, serve this Legal Notice upon the addressee${counsel ? ' through my undersigned counsel' : ''}, and hereby state the following true and correct facts on my behalf:`;
  else if (isShowCause) opening = `I, ${authorDesc}, in reply to the Show-Cause Notice served upon me, most respectfully submit the following:`;
  else if (isReply) opening = `I, ${authorDesc}, in reference to the notice/document served upon me, most respectfully submit this reply and state as under:`;
  else if (isAcademicForum) {
    const discipline = grab('discipline');
    const studentDesc = discipline ? `a student of ${esc(discipline)}` : (/student/i.test(typeStr) ? 'a student' : 'the applicant');
    const forumName = p.forum || 'the authority addressed';
    opening = `I, ${authorDesc}, ${studentDesc}, most respectfully address this representation to ${esc(forumName)} and state the following:`;
  }
  else if (isComplaint) opening = `I, ${authorDesc}, the complainant, most respectfully state the following facts and pray for appropriate legal action:`;
  else if (isBail) opening = `I, ${authorDesc}, the applicant/accused, most respectfully move this Hon'ble Court for grant of bail and submit the following grounds:`;
  else if (isPetition) opening = `The petitioner, ${authorDesc}, most respectfully humbly approaches this Hon'ble Court and states as under:`;
  else if (isApplication) opening = `The applicant, ${authorDesc}, most respectfully submits this application and states the following:`;
  else opening = `I, ${authorDesc}, do hereby state the following:`;
  html += P(opening);

  const bodyNames = Object.keys(M).filter(n => !HEADER_FIELDS.has(n));
  const paragraphsMode = Array.isArray(paragraphs) && paragraphs.length > 0;
  const clauses = [];
  if (paragraphsMode) {
    // Phase 5/7 free-text flow: the user's interpreted fact sentences become the
    // numbered substantive paragraphs ("That ..."), replacing the field scan.
    for (const raw of paragraphs) {
      const t = String(raw || '').trim();
      if (t) clauses.push(esc(t));
    }
  } else {
    for (const n of bodyNames) {
      const label = readableName(n);
      const raw = M[n];
      // P1/P3 hygiene: never print "Label: [please state: …]". A blank optional
      // or genuinely missing field is simply OMITTED — a completed document must
      // never read as a blank form (the caller's missing-information asks cover it).
      if (!blankValue(raw)) clauses.push(`<b>${esc(label)}:</b> ${esc(String(raw).trim())}`);
    }
  }
  // P3 — the facts ask mentions a sum only when this document turns on one
  // (its class, or an amount the user actually stated). A service or office
  // application must not inherit "the amount/claim concerned".
  const factsSource = `${typeStr} ${String(details || '')} ${(Array.isArray(paragraphs) ? paragraphs : []).join(' ')}`;
  const moneyInvolved = /recover|amount|loan|suit|plaint|damages|refund|unpaid|rent|salary|cheque|money|maintenance|dower|cost|price|invoice|outstanding|\bRs\.?\s?[\d,]+|روپے|رقم/i.test(factsSource);
  const factsAskText = moneyInvolved
    ? 'what happened, when, where, who was involved, and the amount/claim concerned'
    : 'what happened, when, where and who was involved';
  if (clauses.length === 0 && !paragraphsMode) {
    // Free-text details: when the user provided a narrative description (no
    // key:value pairs parsed), use it as the document body instead of a placeholder.
    const rawDetails = String(details || '').trim();
    if (Object.keys(M).length === 0 && rawDetails.length > 0) {
      // Split into sentences and use each as a numbered paragraph
      const sentences = splitFreeTextSentences(rawDetails);
      if (sentences.length > 0) {
        sentences.forEach(s => clauses.push(esc(s)));
      } else {
        // Single paragraph if no sentence breaks found
        clauses.push(esc(rawDetails));
      }
    } else {
      clauses.push(`<b>Facts:</b> [set out the full facts — ${factsAskText}]`);
    }
  }
  // A thin narrative must not read as a complete statement of facts: the open
  // full-facts ask is marked inline with the same [MISSING: …] convention used
  // for every other unresolved field.
  if (factsIncomplete && clauses.length > 0 && !clauses.some(c => /full facts/i.test(String(c)))) {
    clauses.push(`[MISSING: the full facts — ${factsAskText}]`);
  }
  const useCourtStyle = isNotice || isReply || isShowCause || isComplaint || isPetition || isBail || /affidavit/i.test(typeStr);
  clauses.forEach((c, i) => {
    if (useCourtStyle) {
      // Lowercase common leading words so "That A university student..." reads
      // as "That a university student..."
      let clauseText = c;
      if (/^[A-Z]/.test(clauseText)) {
        const first = (clauseText.split(/\s+/)[0] || '');
        if (/^(on|in|at|by|for|to|from|the|a|an|we|he|she|they|my|our|your|his|her|their|it|as|since|after|before|during|when|while|despite|with|without|upon|about|this|these|those|me|him|them)$/i.test(first)) {
          clauseText = clauseText.charAt(0).toLowerCase() + clauseText.slice(1);
        }
      }
      html += P(`<b>${i + 1}.</b>&nbsp;&nbsp;That ${clauseText}`);
    } else {
      html += P(`<b>${i + 1}.</b>&nbsp;&nbsp;${c}`);
    }
  });

  // One concise legal-reference line — built here but appended at the very END
  // of the document, never between the facts and the operative paragraphs.
  const topChunk = (Array.isArray(chunks) ? chunks : []).find(c => c && (c.key || c.title));
  let legalRefHtml = '';
  if (topChunk) {
    const prov = /^[\d]+[a-zA-Z]?$/.test(String(topChunk.key || ''))
      ? `${topChunk.type === 'ARTICLE' ? 'Article' : 'Section'} ${topChunk.key}`
      : (topChunk.chunkTitle || topChunk.key || '');
    const cite = [topChunk.title, prov].filter(Boolean).join(' — ');
    legalRefHtml = `<p style="font-style:italic; font-size:0.85em; color:#4b5563; margin:8px 0 14px; text-align: justify;">Legal reference: ${esc(cite)}.</p>`;
  }

  const reliefRaw = grab('demand', 'relief', 'assistance', 'request');
  // Free-text flow without an explicit relief field: refer to the demands in the
  // numbered paragraphs instead of inventing one (Phase 9 — no decorative text).
  const relief = reliefRaw || (paragraphsMode ? null : (isNotice ? '[the specific action / amount demanded from the addressee]' : '[the relief / order sought]'));
  const deadline = grab('deadline');
  if (isNotice) {
    html += P(`<b>Demand / Requisition:</b> I, through the undersigned, hereby call upon and require you to ${relief ? esc(relief) : 'comply with the demand set out in the foregoing paragraphs (the specific amount / action claimed)'}${deadline ? `, within ${esc(deadline)} of the service of this notice (being the time stipulated by the sender)` : ''}. Should you fail to comply, my client shall be constrained to initiate appropriate civil / criminal proceedings against you entirely at your own risk as to cost and consequences, in which event you shall also be liable for damages, costs and legal fees.`);
    html += P(`<b>Reservation of Rights:</b> Nothing stated herein shall be construed as a waiver of any right, remedy or claim available to the undersigned at law or in equity, all of which are expressly reserved.`);
  } else if (isShowCause) {
    const noticeDate = grab('noticeRef', 'date', 'noticeDate');
    html += P(`<b>Prayer:</b> In light of the above, it is most respectfully prayed that ${noticeDate ? `the show-cause notice dated ${esc(noticeDate)}` : 'the above-mentioned show-cause notice'} be kindly vacated/dropped and no adverse action be taken against me, and that I be afforded an opportunity of being heard.`);
  } else if (isBail) {
    html += P(`<b>Prayer:</b> It is, therefore, most respectfully prayed that this Hon'ble Court may graciously be pleased to admit the applicant to bail${grab('surety') ? ` against surety and bonds in the nature of ${esc(grab('surety'))}` : ''}, and pass any other order deemed just and proper in the circumstances.`);
  } else if (isAcademicForum) {
    html += P(`<b>Request:</b> It is therefore most respectfully requested that ${relief ? esc(relief) : 'the action / relief described above in the foregoing paragraphs'} may kindly be granted by the authority addressed, and that I be afforded an opportunity of being heard before any adverse decision is taken. I shall be grateful for your favourable consideration.`);
  } else if (isCourtForum) {
    html += P(`<b>Prayer:</b> It is therefore most respectfully prayed that ${relief ? esc(relief) : 'the relief sought in the foregoing paragraphs'} may kindly be granted, together with any further relief as this Hon'ble Court deems fit and proper in the circumstances of the case.`);
  } else {
    html += P(`<b>Request:</b> ${relief ? esc(relief) : 'the request set out in the foregoing paragraphs is kindly submitted for consideration.'}`);
  }

  if (useCourtStyle) {
    html += P(`I hereby solemnly affirm and declare that the contents stated above are true and correct to the best of my knowledge and belief, and that nothing material has been concealed therefrom.`);
  }
  const signLabel = isNotice ? 'Sender / Advocate' : isAcademicForum ? 'Applicant / Complainant' : isComplaint ? 'Complainant' : (isBail || isPetition || isApplication) ? 'Applicant / Petitioner' : isLetter ? 'Writer / Applicant' : 'Signature';
  html += `<div style="margin-top:24px;">${P('Thanking you,')}${P('<b>Yours faithfully,</b>')}<div style="text-align:right; margin-top:30px;"><p style="margin:0;">____________________________________</p><p style="margin:4px 0 0;"><b>${esc(signLabel)}${authorName ? ` (${esc(authorName)})` : ''}</b></p><p style="margin:2px 0 0;">Name: ${esc(authorName || '______________')}${authorCnic ? ` &nbsp; CNIC: ${esc(authorCnic)}` : ''}</p><p style="margin:2px 0 0;">Date: ____________ &nbsp; Place: ____________</p></div></div>`;

  const enclosures = grab('evidence', 'witness', 'documents');
  // P1 hygiene — the Enclosures line is printed only when the user actually
  // supplied supporting documents; a blank example list never appears in a draft.
  if (enclosures) html += P(`<b>Enclosures / Documents:</b> ${esc(enclosures)}`);
  html += legalRefHtml;
  html += `<p style="font-style:italic; font-size:0.9em; color:#6b7280; margin-top:24px;">Note: Formats may vary by court or authority. Verify the exact format with the relevant office before submission. This is an AI-assisted draft prepared from the details supplied and is not a substitute for review by a registered advocate.</p>`;
  html += `</div>`;
  return html;
}

/**
 * Part Q — Phase 11 offline document editor. Parses the user's change request
 * into TARGET / ACTION / VALUE / LOCATION and ACTUALLY edits the current draft:
 *  - "remove paragraph 3" / "ye paragraph hatao"        → delete that numbered body paragraph
 *  - "remove the demand/prayer paragraph"                 → delete that block
 *  - "change the amount to Rs 750,000" (EN or Roman Urdu)  → rewrite the money figure
 *  - "add that I already sent two written notices"         → insert a new numbered paragraph
 *  - "change X to Y"                                       → fallback text replacement
 * Everything else stays byte-identical; nothing is ever invented. When the
 * request is genuinely ambiguous or unsupported, changed=false with a precise
 * explanation of what WAS understood (never a fake edit).
 */
export function applyLocalEdit(html, userInput) {
  const h0 = String(html || '');
  const u = String(userInput || '').trim();
  if (!u) return { changed: false, html: h0, summary: null };
  const low = u.toLowerCase();

  const plainText = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const escH = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // numbered body paragraphs only — the number must sit INSIDE the same
  // <p> as the text, so a lazy scan can never start at an earlier paragraph
  // and swallow unrelated blocks (headers, openings, prayers) with it.
  const numberedBlockRe = /<p\b[^>]*>\s*<b>\s*(\d+)\s*\.\s*<\/b>((?:(?!<\/p>)[\s\S])*?)<\/p>/gi;
  const removeIntent = /(?:remove|delete|hata(?:o| do)?|nikal(?:o| do)?|khatam|delete\s+karo|remove\s+karo)/i.test(low);
  const paraWord = /(?:paragraph|para(?:graph)?|point|clause|hissa|part)/i.test(low);
  const demandWord = /(?:demand|requisition|prayer|request|matalba|استدعا|درخواست)/i.test(low);

  // A compound instruction ("change the amount to Rs 750,000 and add that I
  // already sent two written notices") must apply EVERY decodable edit, so the
  // rules below run in sequence — each fires AT MOST ONCE against the evolving
  // draft and every successful change is recorded. A rule whose intent matched
  // but could not be applied records a precise "gripe" instead of silently
  // swallowing the request. Guidance rules (E/F/G) run only when nothing applied.
  let h = h0;
  const notes = [];
  let gripe = null;

  // ---- A. Remove a numbered / last / mentioned paragraph -------------------
  if (removeIntent && paraWord && !demandWord) {
    const pm = low.match(/(?:paragraph|para(?:graph)?|point|clause|hissa|part)\s*(?:no\.?|number)?\s*#?\s*(\d+)|(\d+)(?:st|nd|rd|th)?\s*(?:paragraph|para|point|clause|hissa|part)/i);
    const blocks = [...h.matchAll(numberedBlockRe)];
    let target = pm ? parseInt(pm[1] || pm[2], 10) : null;
    const wantsLast = !target && /(?:last|aakhri|akhri)/i.test(low) && blocks.length > 0;
    const hit = target ? blocks.find(b => parseInt(b[1], 10) === target) : null;
    if (wantsLast) {
      const last = blocks[blocks.length - 1];
      h = h.replace(last[0], '').replace(/\n{3,}/g, '\n\n');
      notes.push(`Removed the last numbered paragraph (“${plainText(last[0]).slice(0, 90)}”).`);
    } else if (hit) {
      h = h.replace(hit[0], '').replace(/\n{3,}/g, '\n\n');
      notes.push(`Removed paragraph ${target} (“${plainText(hit[0]).slice(0, 90)}”).`);
    } else if (!target) {
      gripe = 'Which numbered paragraph should I remove? Tell me the number (e.g. "remove paragraph 2") or say "remove the last paragraph".';
    } else {
      gripe = `The document has no numbered paragraph ${target} (it has ${blocks.length} numbered paragraphs); tell me a different number, or paste the exact line to remove.`;
    }
  }

  // ---- B. Remove the demand / prayer / request block -----------------------
  if (removeIntent && demandWord) {
    const needles = ['<b>Demand / Requisition:</b>', '<b>Prayer:</b>', '<b>Request:</b>', '<b>مطالبہ / تقاضہ:</b>', '<b>استدعا:</b>', '<b>درخواست:</b>'];
    const blocks = [...h.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/g)];
    const victim = blocks.find(b => needles.some(n => b[0].includes(n)));
    if (victim) {
      h = h.replace(victim[0], '').replace(/\n{3,}/g, '\n\n');
      notes.push(`Removed the ${plainText(victim[0]).slice(0, 60)} paragraph as requested.`);
    }
  }

  // ---- C. Change the amount / money figure ---------------------------------
  const amountIntent = /(?:amount|sum|payment|money|figure|consideration|price|rent|salary|wages|claim|demand|recover|compensation|mehr|dower|loan)\b.*(?:change|set|update|badal|karo|kardo|kijiye)|(?:change|set|update|badal)\b.*(?:amount|sum|payment|money|figure|consideration|price|rent|salary|claim|demand)/i.test(low);
  if (amountIntent) {
    const nv = u.match(/(?:to|into|ko|as|karo|kardo|kar dein)\s*["']?\s*((?:rs\.?|pkr|rupees|روپے)?\s*[\d][\d,]*(?:\s*(?:lakh|lac|crore|thousand|k|ہزار|لاکھ))?)/i)
      || u.match(/\b((?:rs\.?|pkr|rupees|روپے)\s*[\d][\d,]*(?:\s*(?:lakh|lac|crore|thousand|k|ہزار|لاکھ))?)\b/i);
    if (nv) {
      let newVal = nv[1].replace(/\s+/g, ' ').trim();
      const digitsOnly = newVal.replace(/[^\d]/g, '');
      if (digitsOnly.length >= 4 && !/[,.\s]/.test(newVal.replace(/^(?:rs\.?|pkr|rupees|روپے)/i, ''))) {
        newVal = newVal.replace(/(\d+)/, d => d.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
      }
      if (!/^(?:rs\.?|pkr|rupees|روپے)/i.test(newVal)) newVal = 'Rs ' + newVal;
      const moneyRe = /(?:rs\.?|pkr|rupees|روپے)\s*[\d,]+(?:\s*(?:lakh|lac|crore|thousand|k|ہزار|لاکھ))?|\b[\d,]{3,}(?:\s*(?:lakh|lac|crore|thousand|k|ہزار|لاکھ))?\b/gi;
      const parts = h.split(/(<[^>]*>)/g);
      let current = null;
      for (let i = 0; i < parts.length && !current; i += 2) {
        const m = String(parts[i]).match(moneyRe);
        if (m) current = m[0];
      }
      if (!current) {
        gripe = 'The draft does not currently show a money figure for me to update; tell me the exact amount shown, or edit the figure in the preview.';
      } else if (String(current).replace(/[^\d]/g, '') === newVal.replace(/[^\d]/g, '')) {
        gripe = `The amount in the draft already reads ${current.trim()}, so there was nothing to change.`;
      } else {
        let done = 0;
        const parts2 = h.split(/(<[^>]*>)/g);
        for (let i = 0; i < parts2.length && !done; i += 2) {
          parts2[i] = parts2[i].replace(moneyRe, m => { if (!done) { done = 1; return newVal; } return m; });
        }
        if (done) {
          h = parts2.join('');
          notes.push(`Changed the amount to ${newVal}.`);
        }
      }
    }
  }

  // ---- D. Add a new fact / paragraph ----------------------------------------
  if (/(?:^|\s)(?:add|insert|append|likh(?:o| do| dein)?|bhi\s+likh|bhi\s+add|aur\s+(?:ye|yeh)\s+bhi)/i.test(low)) {
    let addText = null;
    let m = u.match(/(?:add|insert)\s+(?:that\s+|a\s+(?:new\s+)?(?:fact|point|paragraph|sentence|line)\s+(?:that\s+|stating\s+that\s+|saying\s+that\s+)?|the\s+following\s*:?\s*)?(.+)$/i);
    if (!m) m = u.match(/(?:likh\s+(?:do|dein)|likho|add\s+karo|bhi\s+(?:likh(?:o| do)?|add\s+karo)|aur\s+(?:ye|yeh)\s+bhi\s+likh(?:o| do)?|aur\s+(?:ye|yeh)\s+bhi\s+add\s+karo)\s*(?:ke|k|kehte hue)?\s*(.+)$/i);
    if (m) {
      addText = String(m[1] || '').trim().replace(/[\s,;:،]*$/, '').replace(/\.+$/, '');
      // H/I/J targets ("add police station X", "add reference number 123/2026",
      // "add enclosure: copy of …") are edits with their OWN rules below — do
      // not let the generic add-fact rule swallow them as body paragraphs. An
      // explicit "add that …" / "add karo ke …" framing is always a fact.
      const addThat = /(?:^|\s)(?:add|insert|append|likh(?:o| do| dein)?|bhi\s+likh|bhi\s+add)\s+(?:a\s+(?:new\s+)?(?:fact|point|paragraph|sentence|line)\s+)?(?:that|ke|k)\b/i.test(low);
      const editTargetLead = !addThat && /^(?:(?:the|a|an)\s+)?(?:(?:name\s+of\s+the\s+)?(?:police\s+station|thana|تھانہ)\b|(?:enclosures?|attachments?)\b|(?:reference|ref(?:erence)?|case|fir)\s*(?:number|no\.?)?\b)/i.test(addText);
      if (addText && !removeIntent && !editTargetLead) {
        const rtl = /dir="rtl"/.test(h);
        if (!/[.!?۔]$/.test(addText)) addText += rtl ? '۔' : '.';
        const nums = [...h.matchAll(/<b>\s*(\d+)\s*\.\s*<\/b>/g)].map(x => parseInt(x[1], 10));
        const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
        const newPara = `<p style="margin:0 0 12px; text-align: justify;"><b>${nextNum}.</b>&nbsp;&nbsp;${rtl ? 'کہ ' : 'That '}${escH(addText)}</p>`;
        const anchors = ['<b>Legal Basis:</b>', '<b>Demand / Requisition:</b>', '<b>مطالبہ / تقاضہ:</b>', '<b>Prayer:</b>', '<b>استدعا:</b>', '<b>Request:</b>', '<b>درخواست:</b>', 'I hereby solemnly affirm', '<div style="margin-top:24px;">'];
        let pos = -1;
        for (const a of anchors) {
          const at = h.indexOf(a);
          if (at > 0 && (pos === -1 || at < pos)) pos = at;
        }
        if (pos === -1) pos = h.lastIndexOf('</div>');
        if (pos > 0) {
          h = h.slice(0, pos) + newPara + '\n\n' + h.slice(pos);
          notes.push(`Added paragraph ${nextNum}: “${addText.slice(0, 90)}”.`);
        } else {
          gripe = 'I understood the addition, but could not find a safe place inside the document to insert it.';
        }
      }
    }
  }

  // ---- H. Add the police station (FIR / police complaint) -------------------
  // Runs even after another rule applied (compound request) as long as no
  // paragraph was added/removed — an add/remove note means the user's own
  // sentence was already handled as a fact, and re-parsing it here would misfire.
  if (!notes.some(n => /^(?:Added|Removed)/.test(n)) && /(?:police\s+station|thana|تھانہ)/i.test(low) && /(?:add|insert|include|mention|likh|dal)/i.test(low)) {
    let sv = u.match(/(?:add|insert|include|mention|likh(?:o| do| dein)?)\s+(?:the\s+)?(?:name\s+of\s+)?(?:the\s+)?(?:police\s+station|thana|تھانہ)\s*(?:of|ka\s+naam)?\s*[:—–-]?\s*["']?([^"'\n]+?)["']?$/i)
      || u.match(/station\s+(?:ka\s+naam|name)\s*(?:hai|is)?\s*[:—–-]?\s*["']?([^"'\n]+?)["']?$/i);
    if (sv && sv[1]) {
      let stationName = String(sv[1]).trim().replace(/\s*(?:add\s+karo|add\s+kar\s+do|likh\s+do|likho|karo|kar\s+do|hai)$/i, '').replace(/^["']|["']$/g, '').trim();
      // A clause that merely mentions the station ("the police station refused…")
      // is a fact, not a station value — refuse it so it never fills the marker.
      if (stationName && /\b(?:refused|was|were|is|are|has|have|had|did|didn'?t|took|showed|kept|filed|registered|reported|said)\b/i.test(stationName)) stationName = null;
      if (stationName && stationName.split(/\s+/).length > 6) stationName = null;
      if (stationName && stationName.length >= 2 && stationName.length <= 60) {
        const phRe = /\[NAME OF (?:THE )?POLICE STATION\]/i;
        const parts = h.split(/(<[^>]*>)/g);
        let rep = 0;
        const label = /(?:police\s+station|thana)$/i.test(stationName) ? stationName : `${stationName} Police Station`;
        for (let i = 0; i < parts.length; i += 2) {
          parts[i] = parts[i].replace(phRe, () => { rep = 1; return escH(label); });
        }
        if (rep) {
          h = parts.join('');
          notes.push(`Added the police station: ${label}.`);
        } else {
          gripe = 'The current draft does not carry a [NAME OF POLICE STATION] marker to fill, so there is nothing to update. Regenerate the document mentioning the station, or edit the value in the preview.';
        }
      }
    }
    if (!notes.length && !gripe) gripe = 'Tell me the name of the police station to add, e.g. "police station Gulberg add karo".';
  }

  // ---- I. Add a reference / case / FIR number -------------------------------
  if (!notes.some(n => /^(?:Added|Removed)/.test(n)) && /(?:reference|ref(?:\.|\s*no\.?)?|case|fir)\s*(?:number|no\.?)?\b/i.test(low) && /(?:add|insert|likh|dal|include)/i.test(low)) {
    const rm = u.match(/(?:add|insert|likh(?:o| do| dein)?|include)\s+(?:a\s+|the\s+)?(?:reference|ref|case|fir)\s*(?:number|no\.?)?\s*[:—–-]?\s*["']?([A-Za-z0-9][A-Za-z0-9/\-\.]{1,30})["']?/i);
    if (rm && rm[1]) {
      const refVal = String(rm[1]).trim().replace(/^(?:add\s+karo|add\s+kar\s+do|likh\s+do|karo)$/i, '');
      const phRe2 = /\[REFERENCE NO\.\]/i;
      const parts = h.split(/(<[^>]*>)/g);
      let rep = 0;
      for (let i = 0; i < parts.length; i += 2) {
        parts[i] = parts[i].replace(phRe2, () => { rep = 1; return escH(refVal); });
      }
      if (rep) {
        h = parts.join('');
        notes.push(`Added the reference number: ${refVal}.`);
      } else {
        const subjAt = h.indexOf('<b>Subject:</b>');
        const refLine = `<p style="margin:8px 0 12px; text-align:right; white-space:nowrap;">Ref: ${escH(refVal)}</p>\n\n`;
        if (subjAt > 0) {
          h = h.slice(0, subjAt) + refLine + h.slice(subjAt);
          notes.push(`Added the reference number: ${refVal}.`);
        } else {
          gripe = 'I could not find a safe place to insert the reference number in this document; add it in the preview instead.';
        }
      }
    }
    if (!notes.length && !gripe) gripe = 'Tell me the number to add, e.g. "add reference number 123/2026".';
  }

  // ---- J. Add an enclosure --------------------------------------------------
  if (!notes.some(n => /^(?:Added|Removed)/.test(n)) && /(?:enclosures?|attachments?|documents?\s+(?:attach|ke\s+sath))/i.test(low) && /(?:add|insert|include|attach|likh)/i.test(low)) {
    const em = u.match(/(?:add|insert|include|attach|likh(?:o| do| dein)?)\s+(?:the\s+following\s+)?(?:enclosures?|attachments?|documents?)\s*(?:ke\s+sath)?\s*[:—–-]?\s*(?:the\s+following\s*:?\s*)?["']?([^"'\n]{3,160})["']?$/i)
      || u.match(/(?:enclosures?|attachments?|documents?)\s*[:—–-]\s*["']?([^"'\n]{3,160})["']?$/i);
    if (em && em[1]) {
      const encVal = String(em[1]).trim().replace(/\s*(?:add\s+karo|likh\s+do|likho|karo|kar\s+do)$/i, '').trim();
      if (encVal && encVal.length >= 3 && !/(?:add|karo|likh)\s*$/i.test(encVal)) {
        const encRe = /(<p\b[^>]*>[\s\S]*?<b>\s*Enclosures\s*\/\s*Documents\s*:\s*<\/b>)([\s\S]*?)(<\/p>)/i;
        const em0 = h.match(encRe);
        if (em0) {
          h = h.replace(encRe, (all, pre, mid, post) => `${pre}${mid.replace(/\s+$/, '')}${mid.trim() ? '; ' : ' '}${escH(encVal)}${post}`);
          notes.push(`Added to the enclosures: ${encVal.slice(0, 80)}.`);
        } else {
          const noteAt = h.indexOf('Note: Formats may vary');
          const encP = `<p style="margin:0 0 12px; text-align: justify;"><b>Enclosures / Documents:</b> ${escH(encVal)}</p>\n\n`;
          if (noteAt > 0) {
            h = h.slice(0, noteAt) + encP + h.slice(noteAt);
            notes.push(`Added the enclosures line: ${encVal.slice(0, 80)}.`);
          } else {
            gripe = 'I understood the enclosure, but could not find a safe place to insert it in this document; add it in the preview instead.';
          }
        }
      }
    }
    if (!notes.length && !gripe) gripe = 'Tell me which document to add as an enclosure, e.g. "add enclosure: copy of the receipt".';
  }

  // ---- K. Rewrite the prayer / demand / request text ------------------------
  if (!notes.some(n => /^(?:Added|Removed)/.test(n)) && /(?:prayer|demand|request|مطالبہ|استدعا|درخواست|matalba|taqaza)/i.test(low) && /(?:change|badal|update|set|karo|kijiye|تبدیل)/i.test(low)) {
    const which = /prayer|استدعا/.test(low) ? 'Prayer' : (/demand|مطالبہ|taqaza/.test(low) ? 'Demand / Requisition' : (/request|درخواست/.test(low) ? 'Request' : null));
    const km = u.match(/(?:change|update|set|badal(?:o| do| karo)?)\s+(?:the\s+)?(?:prayer|demand|request|مطالبہ|استدعا|درخواست)?\s*(?:(?:karo|kar|do|kijiye)\s+(?:ke|k)\s*|(?:to|into|as|ko)\s*[:—–-]?\s+|:\s*)(.+)$/i)
      || u.match(/(?:prayer|demand|request|مطالبہ|استدعا|درخواست)\s+(?:change|update|set|badal(?:o| do| karo)?|karo|kijiye)\s*(?:(?:ke|k)\s*|:?\s*)(.+)$/i);
    if (which && km && km[1]) {
      const newText = String(km[1]).trim().replace(/["']$/, '').replace(/[.;۔]+$/, '');
      if (newText.length >= 4) {
        const needles = which === 'Prayer' ? ['<b>Prayer:</b>', '<b>استدعا:</b>'] : which === 'Demand / Requisition' ? ['<b>Demand / Requisition:</b>', '<b>مطالبہ / تقاضہ:</b>'] : ['<b>Request:</b>', '<b>درخواست:</b>'];
        const blocks = [...h.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/g)];
        const victim = blocks.find(b => needles.some(n => b[0].includes(n)));
        if (victim) {
          const needle = needles.find(n => victim[0].includes(n));
          const pre = victim[0].slice(0, victim[0].indexOf(needle) + needle.length);
          h = h.replace(victim[0], `${pre} ${escH(newText)}</p>`);
          notes.push(`Updated the ${which.toLowerCase()} text as requested.`);
        } else {
          gripe = 'The current draft does not show a paragraph with that heading to update; add the new wording in the preview instead.';
        }
      }
    }
    if (!notes.length && !gripe) gripe = 'Tell me the new wording after a clear connector, e.g. "prayer change karo ke mujhe poora amount wapas mil jaye" or "change the prayer to: grant my claim".';
  }

  // ---- L. Convert the whole document into Urdu Script (اردو) -----------------
  // Deterministic round-trip: parse the numbered English paragraphs (the user's
  // facts, verbatim) and re-render the SAME document through the Urdu composer,
  // whose headings/boilerplate are localized. No machine-translation of user
  // facts happens; nothing is invented. Roman Urdu is never a document language,
  // so a "Roman Urdu" request gets honest guidance (rule E below) instead.
  if (!notes.some(n => /^(?:Added|Removed)/.test(n)) && !gripe) {
    const wantsUrdu = /(?:urdu\s+script|اردو)/i.test(low)
      && !/roman\s+urdu/i.test(low)
      && /(?:convert|translate|change|make|turn|karo|kijiye|mein|main|بنا|بنائیں|تبدیل)/i.test(low);
    const translateToUrdu = /(?:convert|translate|تبدیل)\s+(?:this\s+(?:document|draft)|it|iska|is\s+ko|document)\s+(?:into|to|mein)?\s+(?:urdu\s+script\s*|urdu\s*|اردو)/i.test(low);
    if (wantsUrdu || translateToUrdu) {
      if (/[\u0600-\u06FF]/.test(h)) {
        return { changed: false, html: h, summary: 'This document is already in Urdu Script (اردو), so there is nothing to translate. Note: Insaaf AI drafts formal documents only in English or Urdu Script — Roman Urdu is never used inside documents.' };
      }
      const heading = (h.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1];
      const headingText = heading ? plainText(heading) : '';
      const paras = [];
      for (const b of h.matchAll(numberedBlockRe)) {
        let txt = plainText(b[0]).replace(/&amp;nbsp;/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&');
        txt = txt.replace(/^\s*\d+\s*\.\s*/, '').replace(/^That\s+/i, '').replace(/^کہ\s+/, '').trim();
        // The EN claim recital is system boilerplate composed from the request
        // framing — localize it like every other boilerplate line while the
        // user's amount stays verbatim; user-typed fact sentences pass through.
        const recital = txt.match(/^the sum of\s+(Rs [\d,]+(?:\s*(?:lakh|lac|crore|thousand))?)\b/i);
        if (recital && !/[\u0600-\u06FF]/.test(txt)) {
          const kindM = txt.match(/\bunpaid\s+(loan|rent|salary|wages)\b/i);
          const kind = kindM ? (kindM[1] === 'wages' ? 'salary' : kindM[1].toLowerCase()) : '';
          const action = /\b(?:due and payable|payable by)\b/i.test(txt) ? 'pay' : (/\b(?:refundable|returnable)\b/i.test(txt) ? 'refund' : '');
          const being = kind ? SALVAGE_UR_BEING[kind] : '';
          const main = SALVAGE_UR_MAIN[action] || SALVAGE_UR_MAIN.defaultMain;
          txt = 'رقم ' + recital[1] + (being ? '، ' + being : '') + '، ' + main;
        } else {
          // A legacy template clause begins "Label: value" — keep only the user's
          // value so no English label leaks into the Urdu Script body.
          txt = txt.replace(/^[A-Z][A-Za-z &\/'-]{0,38}:\s+/, '').trim();
        }
        if (txt && !/^\[(?:MISSING|please\s+state|YOUR\s+FULL\s+NAME)/i.test(txt)) paras.push(txt);
      }
      if (paras.length) {
        const urduHtml = renderFullUrduDocument({ type: headingText || 'Legal Document', paragraphs: paras, chunks: [] });
        return { changed: true, html: urduHtml, summary: 'Converted the document into Urdu Script (اردو): the headings and legal phrasing are localized while your stated facts are preserved verbatim. Review the translated draft before use.' };
      }
      gripe = 'I could not find numbered content paragraphs in this draft to convert. Regenerate the document and try the conversion again.';
    }
  }

  // Guidance rules run only when no edit applied, so they never override a
  // successful change or fire twice on a compound request.
  if (!notes.length) {
    // ---- E. Language-conversion requests (honest guidance only where the
    // deterministic converter above could not run) -----------------------------
    if (!gripe && /roman\s+urdu/i.test(low) && /(?:karo|make|convert|change|turn|main|mein)/i.test(low)) {
      return { changed: false, html: h, summary: 'Insaaf AI drafts formal documents only in English or Urdu Script (اردو) — Roman Urdu is not a document language, so this draft cannot be rendered in Roman Urdu. Choose English or اردو (Urdu Script) in the document language setting and regenerate. The current draft is unchanged.' };
    }
    if (!gripe && /(?:english|angrezi|انگریزی)/i.test(low) && /(?:karo|make|convert|change|turn|main|mein)/i.test(low)) {
      return { changed: false, html: h, summary: 'To render this document in English, choose English in the document language setting and regenerate — the whole document is then re-rendered cleanly in English. The current draft is unchanged.' };
    }
    if (!gripe && /(?:more\s+formal|formal\s+karo|professional\s+karo|formal\s+register)/i.test(low)) {
      return { changed: false, html: h, summary: 'I cannot silently rewrite the whole draft into a different register without risking a change of meaning. Please tell me the exact sentence or paragraph to reword, or regenerate the document with the missing details filled in.' };
    }

    // ---- F. Fallback: explicit "change X to Y" replacement ------------------
    // Only fired when no other rule applied. Generic targets without a value
    // ("change the amount/date to …") are refused — they need a concrete anchor.
    let X = null, Y = null, m;
    if ((m = u.match(/(?:change|replace|update|set)\s+["']?(.+?)["']?\s+(?:to|into|with|as)\s+["']?(.+?)['"]?\.?$/i))) { X = m[1]; Y = m[2]; }
    else if ((m = u.match(/["']?(.+?)['"]?\s+(?:ko|se|ki\s+jagah)\s+["']?(.+?)['"]?\s+(?:karo|kar\s+do|banao|badal\s+do|replace\s+karo|likho)/i))) { X = m[1]; Y = m[2]; }
    if (X && Y) {
      X = X.trim().replace(/^["']|["']$/g, '');
      Y = Y.trim().replace(/^["']|["']$/g, '');
      // "amount 500,000 ko 750,000 kar do" captures the label with the value, but
      // a draft only ever shows the value ("Rs 500,000"), so the anchor is the
      // figure — the label names the field, it is not part of its text.
      const labelled = X.match(/^(?:the\s+)?(?:amount|sum|money|payment|figure|consideration|price|rent|salary|wages|claim|date|day|month|year|number|value)s?\s+(.+)$/i);
      if (labelled && /\d/.test(labelled[1])) X = labelled[1].trim();
      const genericX = /^the?\s+(?:amount|sum|money|payment|figure|consideration|price|rent|salary|wages|claim|date|day|month|year|name|address|number|paragraph|para|clause|point|document|text|value|party|applicant|respondent|sender|recipient|complainant|accused|title|subject|details?|facts?|amounts?)$/i.test(X);
      if (X.length >= 2 && Y && X.toLowerCase() !== Y.toLowerCase() && !genericX && Y.length <= 64) {
        const re = new RegExp(X.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const parts = h.split(/(<[^>]*>)/g);
        let count = 0;
        for (let i = 0; i < parts.length; i += 2) {
          parts[i] = parts[i].replace(re, () => { count++; return Y; });
        }
        if (count) {
          return { changed: true, html: parts.join(''), summary: `Replaced “${X}” with “${Y}” (${count} occurrence${count > 1 ? 's' : ''}). Everything else in the document is unchanged.` };
        }
        return { changed: false, html: h, summary: `I could not find “${X}” in the current draft, so nothing was replaced. Check the exact wording (or the amount/date as shown) and try again, or tell me what to add/remove.` };
      }
    }

    // ---- G. Genuinely ambiguous or specific rule gripe ----------------------
    return {
      changed: false,
      html: h,
      summary: gripe
        ? `${gripe} Nothing was changed.`
        : 'I could not turn that into a precise edit by myself. Tell me exactly what to change, e.g. "change the amount to Rs 750,000", "add that I sent two written notices", "remove paragraph 3", or "change 10,000 to 15,000". Nothing was changed.'
    };
  }

  return { changed: true, html: h, summary: notes.concat(gripe ? [gripe] : []).join(' ') };
}

// ============================================================================
// Part T — "EXPLAIN THIS DOCUMENT" (11-point structured explanation)
// ----------------------------------------------------------------------------
// A deterministic, grounded explanation of a Pakistani legal document TYPE,
// composed from verified statutory references and forums only (mirroring the
// verified structures in src/config/documentStructures.ts). It never returns a
// keyword-match dump and NEVER invents fees or deadlines: the shared defaults
// below state honestly that exact amounts/periods are not verified and vary by
// province and office, and an entry overrides them only with an established fact.
// ============================================================================

const FEES_NOT_VERIFIED = 'Court fee / stamp duty is NOT verified here and varies by province, the value of the claim and the specific court or office. Confirm the exact amount with the relevant court/office (or a registered advocate) before filing, and always obtain an official receipt for anything you pay.';
const DEADLINES_NOT_VERIFIED = 'The exact limitation period / filing deadline is NOT verified here — it depends on the type of claim and when the cause of action arose. Limitation is strict and filing late can bar the case, so confirm the applicable period (e.g. under the Limitation Act 1908 or the relevant special law) with a lawyer before the time runs out.';

// Verified document-type knowledge. Order matters: specific matchers precede
// general ones (e.g. pre-arrest bail before "bail"; reply-to-notice before
// "legal notice"; consumer/cyber/labour complaint before generic "complaint").
const DOC_EXPLAIN = [
  {
    match: /\bf\.?\s?i\.?\s?r\b|first information|police (?:case|report)|\b154\b/i,
    name: 'FIR (First Information Report) / Application for Registration of FIR',
    provision: 'Section 154 CrPC',
    is: 'the first written record of a cognizable offence lodged with the police. Under Section 154 CrPC the Station House Officer (SHO) is obliged to register a cognizable offence and may not refuse on technical grounds.',
    usedFor: 'to set the criminal process in motion — it authorises and obliges the police to investigate the reported offence.',
    toWhom: 'the Station House Officer (SHO) of the police station whose jurisdiction covers the place where the incident occurred.',
    where: 'the relevant police station. If the SHO refuses, escalate to a senior officer (SP/DSP/IG) or, under Sections 22-A/22-B CrPC, to the Justice of Peace / Court of Session.',
    docs: 'your original CNIC; the date, time and exact location of the incident; the names or best available descriptions of the accused; witness details; and anything supporting the account (medical report, photos, messages) if you already have them.',
    nextStep: 'registration of the FIR and commencement of police investigation. The complainant is entitled to a free certified copy of the FIR.',
    afterSubmission: 'obtain the free FIR copy, note the FIR number and police station, cooperate with the investigation, and record the names of the officers handling the case.',
    fees: 'Lodging an FIR is FREE and you are entitled to a free certified copy. No official fee should be demanded for either; if money is demanded, report it to a senior officer.',
    lawyer: 'not required to lodge an FIR, but advisable if the police delay or refuse, or the matter is serious, so your remedies (including a Section 22-A application) are properly pursued.',
    deadlines: 'there is no fixed deadline to report an offence, but prompt reporting strengthens the case and any delay should be explained. Some minor offences carry limitation periods — confirm with a lawyer.',
    checklist: ['State the facts clearly: what happened, when, where and who was involved.', 'Carry your original CNIC.', 'Ask for the FIR number and a free certified copy.', 'If refused, note the officer\u2019s name and escalate (SP / Justice of Peace under Section 22-A CrPC).']
  },
  {
    match: /cyber|peca|\bfia\b|online (?:harassment|fraud|abuse)|nr3c/i,
    name: 'Cyber Crime Complaint (PECA 2016)',
    provision: 'Prevention of Electronic Crimes Act 2016',
    is: 'a complaint about an electronic/offence committed online (harassment, fraud, unauthorized access, hate speech, etc.) under the Prevention of Electronic Crimes Act (PECA) 2016.',
    usedFor: 'to report a cyber offence so the FIA Cyber Crime Wing can investigate and take action against the person responsible.',
    toWhom: 'the Director / Officer-in-Charge, FIA Cyber Crime Wing (NR3C), or via the FIA online complaint portal / helpline.',
    where: 'the FIA Cyber Crime Wing (NR3C) office having territorial jurisdiction, or the FIA online complaint portal.',
    docs: 'your CNIC and contact details; the accused\u2019s username, number or description; the platform and links involved; dated screenshots; and any call/message records you already possess.',
    nextStep: 'FIA registration of the complaint and preliminary inquiry; if a cognizable offence is disclosed, formal investigation follows.',
    afterSubmission: 'keep the complaint/diary number, preserve the original electronic evidence (do not delete), and respond promptly if the FIA calls you for a statement.',
    lawyer: 'helpful, particularly to frame the offence under the correct PECA sections and to protect your evidence, though not mandatory to file.',
    checklist: ['Capture dated screenshots before content is removed.', 'List the exact platform, account/number and dates.', 'Attach your CNIC.', 'Note the complaint/diary number on submission.']
  },
  {
    match: /consumer|defective|deficien|refund|sarmaya|zarar/i,
    name: 'Consumer Court Complaint (Consumer Protection Act)',
    provision: 'Consumer Protection Act (provincial)',
    is: 'a complaint by a consumer against a seller/manufacturer/service provider for defective goods, deficiency in service or unfair trade practice.',
    usedFor: 'to claim a refund, replacement, repair or compensation for a defective product or deficient service.',
    toWhom: 'the District Consumer Court (Consumer Protection Act) having jurisdiction; a prior legal notice to the seller is commonly part of the process.',
    where: 'the District Consumer Court in the relevant district. Consumer protection is a provincial subject, so the applicable Act and forum depend on your province.',
    docs: 'proof of purchase (receipt/invoice), warranty/guarantee card, the product or its photos, any correspondence with the seller, and evidence of the defect or deficiency.',
    nextStep: 'the court issues notice to the seller/company and hears both sides; it may order refund, replacement or compensation.',
    afterSubmission: 'attend hearings on the dates given, keep the original receipts safe, and produce the defective item if the court directs.',
    lawyer: 'not always necessary for small claims, but advisable where the value is significant or liability is disputed.',
    checklist: ['Keep the original receipt/invoice.', 'Photograph the defect.', 'Send/retain proof of any prior notice to the seller.', 'State the exact relief you want (refund / replacement / compensation).']
  },
  {
    match: /labou?r|employment|wages|salary|termination|mazdoor|retrench/i,
    name: 'Labour / Employment Complaint',
    provision: 'Industrial Relations Act / provincial labour laws',
    is: 'a grievance by a worker/employee about wages, wrongful termination, working conditions, harassment or benefits, addressed to the labour authority.',
    usedFor: 'to seek redress for an employment grievance such as unpaid wages, illegal termination or denial of statutory benefits.',
    toWhom: 'the Labour Court / relevant labour authority, or the employer through a grievance petition, depending on the nature of the complaint.',
    where: 'the correct forum depends on the grievance (wages, termination, harassment) and your province/sector — confirm the exact authority before filing.',
    docs: 'employment/appointment letter, salary slips or bank credits, attendance or service records, the termination/grievance-related correspondence, and your CNIC.',
    nextStep: 'the authority/court issues notice to the employer and hears the grievance; it may order reinstatement, back wages or other relief.',
    afterSubmission: 'attend the scheduled hearings, keep copies of every employment record, and note any deadline given for a reply.',
    lawyer: 'advisable, as the correct forum and limitation depend on the specific grievance and applicable labour law.',
    deadlines: 'a grievance/appeal must generally be filed within a limited period after the grievance arises (the corpus notes a grievance petition is commonly filed within 30 days for wrongful termination). This is NOT independently verified for every case — confirm the exact period with the labour authority or a lawyer before it expires.',
    checklist: ['Identify the exact grievance (wages / termination / harassment / benefits).', 'Gather appointment letter and pay records.', 'Confirm the correct labour forum for your province/sector.', 'File promptly — limitation periods are short.']
  },
  {
    match: /reply to (?:a )?(?:legal )?notice|notice reply|jawab/i,
    name: 'Reply to a Legal Notice',
    provision: 'general civil/criminal practice',
    is: 'a written, point-by-point response to a legal notice someone has sent you, setting out your version of the facts and your legal stand.',
    usedFor: 'to answer the allegations/demands in a notice, correct the record and, where possible, resolve the matter before litigation.',
    toWhom: 'the sender of the notice (or the advocate who issued it), at the address stated on the notice.',
    where: 'sent to the notice-sender/advocate by a trackable means (registered post/courier). It is a response between parties, not a court filing (unless a specific statute requires otherwise).',
    docs: 'the original notice and its envelope/reference number; documents proving your version (agreements, receipts, correspondence); and your CNIC.',
    nextStep: 'the other side reviews your reply and either withdraws, negotiates, or proceeds to file a case; your reply becomes part of the record.',
    afterSubmission: 'keep proof of dispatch and acknowledgement, retain a signed copy, and note any further deadline mentioned.',
    lawyer: 'strongly advisable — a notice reply shapes the dispute and an admission or omission can be used against you later.',
    deadlines: 'reply within the period stated in the notice itself (the notice fixes the time, commonly 14 days). This is NOT a verified universal figure — always follow the exact period written in the notice you received.',
    checklist: ['Reference the notice number and date.', 'Answer each allegation paragraph by paragraph.', 'State your true facts and enclose proof.', 'Send within the notice period and keep proof of dispatch.']
  },
  {
    match: /defamation|libel|slander|htak/i,
    name: 'Legal Notice for Defamation',
    provision: 'Defamation Ordinance 2002 / PPC Sections 499-500',
    is: 'a notice sent to a person who has made a false, damaging statement about you, demanding retraction/apology and/or damages.',
    usedFor: 'to seek correction, apology and compensation for harm to reputation, and to put the other party on notice before filing a civil or criminal defamation case.',
    toWhom: 'the person/entity that made or published the defamatory statement, usually through your advocate.',
    where: 'served on the other party by trackable means; if unresolved, a civil suit (District Court) or criminal complaint (Magistrate) may follow.',
    docs: 'a copy/record of the exact statement (screenshot, clipping, recording), proof of publication and date, evidence of the harm caused, and your CNIC.',
    nextStep: 'the recipient may retract/apologise, negotiate, or refuse — after which you may institute defamation proceedings.',
    afterSubmission: 'preserve the original defamatory material and proof of publication; note any deadline you set for compliance.',
    lawyer: 'advisable, as defamation has both civil and criminal dimensions and the wording of the notice matters.',
    checklist: ['Quote the exact defamatory words and where/when published.', 'Describe the injury to your reputation.', 'State the demand (apology/retraction/damages) and a deadline.', 'Preserve the evidence of publication.']
  },
  {
    match: /legal notice|demand notice/i,
    name: 'Legal Notice',
    provision: 'general practice; Section 80 CPC for government suits',
    is: 'a formal written demand sent (usually through an advocate) to another party, stating your grievance and what you require before starting legal proceedings.',
    usedFor: 'to formally assert a claim, give the other side a chance to comply or settle, and create a record — often a prerequisite to filing a suit.',
    toWhom: 'the person/entity against whom you have the grievance (the recipient), commonly issued through your advocate.',
    where: 'served on the recipient by registered post/courier. It is not filed in court, except that a notice may be a statutory precondition to a suit.',
    docs: 'documents proving your claim (agreement, receipts, correspondence), the recipient\u2019s correct name and address, and your CNIC/authority to act.',
    nextStep: 'the recipient replies, complies, negotiates or ignores it; non-compliance within the stated time usually leads to a lawsuit.',
    afterSubmission: 'keep proof of dispatch and any reply, and diarise the compliance deadline you set.',
    lawyer: 'advisable — a notice issued through an advocate carries more weight and frames the claim correctly.',
    deadlines: 'you set the compliance period in the notice (commonly 14\u201330 days). Separately, for a suit against the government/public authority, Section 80 CPC generally requires a prior notice before instituting the suit. These periods are NOT verified for every case — confirm the applicable requirement with a lawyer.',
    checklist: ['State the facts, your grievance and the exact demand.', 'Fix a clear compliance deadline.', 'Send through an advocate / by trackable post.', 'Keep proof of dispatch and any reply.']
  },
  {
    match: /pre[\s-]?arrest|before arrest|anticipatory|\b498\b|zamanat(?:e)?\s*(?:qabl|before)/i,
    name: 'Pre-Arrest Bail Application (Bail Before Arrest)',
    provision: 'Section 498 CrPC',
    is: 'an application for bail made BEFORE arrest, where a person apprehends being arrested in a non-bailable offence. It is granted under Section 498 CrPC.',
    usedFor: 'to obtain protection from arrest while the matter is examined, typically where the accusation appears mala fide, the person is not a flight risk, or has no criminal antecedents.',
    toWhom: 'the Court of Session or the High Court having jurisdiction.',
    where: 'filed before the Sessions Court or High Court. The court may grant interim pre-arrest bail and issue notice to the prosecution.',
    docs: 'CNIC and particulars of the applicant; the FIR (number/date/station) if registered, or a statement that it is proposed; the sections alleged; grounds for bail; and surety details.',
    nextStep: 'the court issues notice to the prosecution/police, hears both sides, then confirms or recalls the interim bail.',
    afterSubmission: 'obtain the certified order, comply with any conditions (surety, joining investigation), and keep the police/court informed as required.',
    lawyer: 'strongly advisable — pre-arrest bail is discretionary and turns on legal grounds best argued by an advocate.',
    checklist: ['State the apprehension of arrest and the case/FIR reference.', 'Set out grounds (no antecedents, not a flight risk, mala fide).', 'Offer surety.', 'File in the correct Sessions Court / High Court.']
  },
  {
    match: /post[\s-]?arrest|after arrest|\b497\b/i,
    name: 'Post-Arrest Bail Application',
    provision: 'Section 497 CrPC',
    is: 'an application for the release on bail of a person already arrested/detained in a non-bailable offence, governed by Section 497 CrPC.',
    usedFor: 'to secure the release of the accused from custody while the investigation/trial continues.',
    toWhom: 'the Magistrate, Court of Session or High Court, depending on the offence and stage.',
    where: 'filed before the court seized of the matter (Magistrate/Sessions/High Court). Grant is discretionary in non-bailable offences.',
    docs: 'the FIR (number/date/station) and PPC sections; the accused\u2019s particulars and CNIC; date of arrest and days in custody; grounds for bail; and surety/bonds.',
    nextStep: 'the court hears the prosecution and the accused, examines the record, and grants or refuses bail (possibly with conditions).',
    afterSubmission: 'if granted, furnish the required surety/bonds to secure release and comply with all conditions (e.g. attending every hearing).',
    lawyer: 'strongly advisable — bail in non-bailable offences is discretionary and depends on the record and legal grounds.',
    checklist: ['Cite the FIR/case number, date, station and sections.', 'State custody details and grounds for bail.', 'Arrange surety/bonds.', 'File in the correct court promptly.']
  },
  {
    match: /\bbail\b|zamanat|guarantee|bond/i,
    name: 'Bail Application',
    provision: 'Sections 496, 497, 498 CrPC',
    is: 'an application for the release of an accused from custody. In bailable offences bail is a right (Section 496 CrPC); in non-bailable offences it is discretionary (Section 497 CrPC); bail before arrest is under Section 498 CrPC.',
    usedFor: 'to secure the release of an accused from police or judicial custody pending investigation or trial.',
    toWhom: 'the police (for bailable offences) or the Magistrate / Court of Session / High Court (for non-bailable offences).',
    where: 'the court before which the accused is produced or the case is pending; pre-arrest bail lies before the Sessions Court or High Court.',
    docs: 'the FIR/case reference and sections; the accused\u2019s particulars and CNIC; grounds for bail; and surety/bond details.',
    nextStep: 'the court (or police, if bailable) hears the matter and grants or refuses bail, possibly with conditions and surety.',
    afterSubmission: 'if granted, execute the bail bond/furnish surety to secure release and comply with all conditions.',
    lawyer: 'advisable in non-bailable matters, where bail is discretionary and legally technical.',
    checklist: ['Confirm whether the offence is bailable or non-bailable.', 'Cite the FIR/case number and sections.', 'State the grounds for bail.', 'Arrange surety/bonds.']
  },
  {
    match: /injunction|stay (?:application|order)|\bstay\b|hukm[\s-]?e[\s-]?imtina|restrain/i,
    name: 'Application for Temporary Injunction (Stay)',
    provision: 'Order XXXIX Rules 1 & 2 CPC',
    is: 'an application asking a civil court to temporarily restrain a party from doing something (e.g. alienating property, construction) until the case is decided, under Order XXXIX Rules 1 and 2 CPC.',
    usedFor: 'to preserve the subject matter and prevent irreparable harm while a civil suit is pending.',
    toWhom: 'the Civil Court where the suit is filed/pending (or where it would be filed).',
    where: 'filed in the Civil Court of the relevant district, usually along with or after the main suit.',
    docs: 'title/ownership or interest documents for the subject matter; the suit reference if already filed; evidence of the threatened act; and grounds (prima facie case, balance of convenience, irreparable loss).',
    nextStep: 'the court may issue notice to the other side (or, in urgent cases, grant an ad-interim stay) and then decide the application.',
    afterSubmission: 'obtain the certified order, ensure it is communicated/served, and comply with any conditions; a stay is temporary and must be pursued to a decision.',
    lawyer: 'strongly advisable — injunctions turn on the three legal tests and correct drafting.',
    checklist: ['Identify the property/subject matter precisely.', 'Plead a prima facie case, balance of convenience and irreparable loss.', 'Attach title/interest documents.', 'File in the correct Civil Court, urgently if the act is imminent.']
  },
  {
    match: /writ|constitutional petition|article\s*199|184\s*\(\s*3\s*\)|constitution/i,
    name: 'Writ / Constitutional Petition',
    provision: 'Article 199 (High Court); Article 184(3) (Supreme Court)',
    is: 'a petition invoking the constitutional jurisdiction of a High Court (Article 199) — or the Supreme Court (Article 184(3)) — to enforce fundamental rights or challenge an act of a public functionary as being without lawful authority.',
    usedFor: 'to obtain a direction, declaration or restraint against the State/a public authority, or to enforce a fundamental right (habeas corpus, mandamus, prohibition, quo warranto, certiorari).',
    toWhom: 'the relevant High Court (Lahore/Sindh/Peshawar/Balochistan/Islamabad) or the Supreme Court of Pakistan.',
    where: 'filed before the High Court having jurisdiction (or the Supreme Court for Article 184(3) matters of public importance / fundamental rights).',
    docs: 'the petitioner\u2019s particulars; the impugned act/order with its date; the constitutional provision/fundamental right engaged; grounds; and the relief sought, with supporting annexures.',
    nextStep: 'the court examines maintainability, may issue notice to the respondent(s) and, in urgent cases, grant interim relief.',
    afterSubmission: 'obtain the certified order, serve/comply as directed, and pursue the petition through its hearings.',
    lawyer: 'essential — constitutional petitions are technically demanding and are ordinarily presented by an advocate.',
    checklist: ['Identify the impugned act/order and its date.', 'Specify the Article 199 clause and the right engaged.', 'State how the act is without lawful authority.', 'Annex supporting documents and file in the correct High Court.']
  },
  {
    match: /maintenance|nafaqa|kharcha|guzar(?:a|bash)/i,
    name: 'Application for Maintenance',
    provision: 'Family Courts Act 1964',
    is: 'an application to the Family Court claiming maintenance for a wife and/or children (and, in some cases, parents) from the person legally liable to provide it.',
    usedFor: 'to obtain a court order fixing and directing payment of monthly maintenance.',
    toWhom: 'the respondent legally liable to pay (e.g. husband/father), through the Family Court.',
    where: 'filed in the Family Court of the relevant area under the Family Courts Act 1964.',
    docs: 'proof of marriage/relationship (Nikah Nama), children\u2019s details/birth certificates, evidence of needs and of the respondent\u2019s means, and the monthly amount claimed.',
    nextStep: 'the Family Court issues notice, hears both sides, and may fix maintenance by order (family matters are meant to be decided relatively quickly).',
    afterSubmission: 'attend hearings on the dates given; if an order passes, ensure compliance and record any non-payment.',
    lawyer: 'helpful to quantify the claim and prove the respondent\u2019s means, though family litigants may also appear in person.',
    checklist: ['Attach the Nikah Nama / proof of relationship.', 'List children and their ages.', 'State the monthly amount claimed and from which date (do not invent figures).', 'File in the correct Family Court.']
  },
  {
    match: /custody|hizanat|child(?:ren)? (?:custody|minor)|minor(?:'|’)?s? custody/i,
    name: 'Petition for Custody of a Minor',
    provision: 'Guardians and Wards Act 1890',
    is: 'a petition seeking custody (physical care) of a minor child, decided primarily on the welfare of the child.',
    usedFor: 'to obtain custody or a defined arrangement for the care and upbringing of a minor.',
    toWhom: 'the Guardian Court / Family Court having jurisdiction.',
    where: 'filed in the Guardian/Family Court of the relevant district under the Guardians and Wards Act 1890.',
    docs: 'the minor\u2019s particulars (name, age, birth certificate), the current custody arrangement, the relationship of the parties, and evidence supporting the child\u2019s welfare.',
    nextStep: 'the court issues notice, may appoint/consider a guardian ad litem, and decides on the basis of the minor\u2019s welfare.',
    afterSubmission: 'attend hearings, comply with any interim visitation/custody order, and keep the child\u2019s welfare records.',
    lawyer: 'advisable, as custody is decided on nuanced welfare considerations.',
    checklist: ['Focus the petition on the welfare of the minor.', 'Attach the child\u2019s birth certificate and particulars.', 'State the current custody and what you seek.', 'File in the correct Guardian/Family Court.']
  },
  {
    match: /guardianship|guardian|\bward\b|sarparasti/i,
    name: 'Application for Guardianship',
    provision: 'Guardians and Wards Act 1890',
    is: 'an application for appointment as the guardian of a minor\u2019s person and/or property, governed by the Guardians and Wards Act 1890; the welfare of the minor is paramount.',
    usedFor: 'to obtain legal authority to care for a minor and/or manage the minor\u2019s property.',
    toWhom: 'the Guardian Court / Family Court having jurisdiction over the minor.',
    where: 'filed in the Guardian/Family Court of the relevant district under the Guardians and Wards Act 1890.',
    docs: 'the minor\u2019s particulars (name, age, date of birth), the nature of guardianship sought (person/property/both), the applicant\u2019s relationship and fitness, and details of any property.',
    nextStep: 'the court issues notice to interested parties, examines the minor\u2019s welfare, and may appoint a guardian (with conditions for property).',
    afterSubmission: 'if appointed, comply with the court\u2019s conditions, and for property, observe the reporting/accounting duties imposed on a guardian.',
    lawyer: 'advisable, especially where property or a contested appointment is involved.',
    checklist: ['State whether guardianship of person, property or both is sought.', 'Attach the minor\u2019s birth certificate and particulars.', 'Show why you are a fit guardian (welfare of the minor).', 'File in the correct Guardian/Family Court.']
  },
  {
    match: /family|khula|divorce|talaq|nikah|marriage|dower|haq[\s-]?mehr| Family Courts Act/i,
    name: 'Family Application / Suit',
    provision: 'Family Courts Act 1964',
    is: 'an application or suit in the Family Court for a family matter such as khula, divorce, dower (haq mehr), maintenance, custody or restitution of conjugal rights.',
    usedFor: 'to obtain a decree/order on a family dispute under the Family Courts Act 1964.',
    toWhom: 'the respondent spouse/family member, through the Family Court.',
    where: 'filed in the Family Court of the relevant area under the Family Courts Act 1964.',
    docs: 'the Nikah Nama (marriage certificate), particulars of the parties and children, the specific matter claimed, and supporting facts/documents.',
    nextStep: 'the Family Court issues notice, attempts reconciliation where required (e.g. khula), and decides the matter — family cases are meant to be disposed of relatively quickly.',
    afterSubmission: 'attend every hearing on the dates given and comply with any interim or final order.',
    lawyer: 'helpful to plead the correct ground and relief, though a party may appear in person.',
    checklist: ['Attach the Nikah Nama.', 'Specify the exact matter (khula / divorce / dower / maintenance / custody).', 'State the facts and relief sought clearly.', 'File in the correct Family Court.']
  },
  {
    match: /legal aid|free legal|muft|pro bono|legal empower/i,
    name: 'Application for Free Legal Aid',
    provision: 'Legal Aid & Justice Authority / District Legal Empowerment Committees',
    is: 'an application for free legal assistance (a lawyer, advice or representation) for a person who cannot afford one, made to a Legal Aid Committee.',
    usedFor: 'to obtain free legal representation or advice where the applicant lacks the means to pay a lawyer.',
    toWhom: 'the relevant Legal Aid Committee / District Legal Empowerment Committee (or the Legal Aid Office of the District Judiciary).',
    where: 'submitted to the Legal Aid Committee of the relevant district; eligibility criteria and offices vary by district.',
    docs: 'your CNIC, proof of income/financial circumstances, the case type and court, the stage of proceedings, and the assistance requested.',
    nextStep: 'the committee assesses eligibility and, if approved, assigns a legal-aid lawyer or provides advice.',
    afterSubmission: 'keep the application reference, provide any further documents requested, and cooperate with the assigned lawyer.',
    fees: 'Free legal aid is provided at no cost to eligible applicants. Do not pay anyone claiming to arrange free legal aid — approach the official committee directly.',
    lawyer: 'this application is itself the route to obtaining a free lawyer; help filling it is available from the committee.',
    checklist: ['State your true financial circumstances.', 'Attach CNIC and income proof.', 'Specify the case type, court and stage.', 'Submit to the correct District Legal Aid / Empowerment Committee.']
  },
  {
    match: /civil application|plaint|civil suit|court application|divani|declaration|specific performance/i,
    name: 'Civil Application / Plaint',
    provision: 'Code of Civil Procedure (CPC) 1908',
    is: 'a pleading filed in a civil court — either a plaint instituting a civil suit or an application within a pending suit — seeking a civil remedy (declaration, specific performance, recovery, injunction, etc.).',
    usedFor: 'to commence or progress civil litigation and obtain a civil court order/decree.',
    toWhom: 'the Civil Court (of the competent judge/valuation) having jurisdiction over the subject matter and territory.',
    where: 'filed in the Civil Court of the relevant district; the heading and case-number block should match the pending case record.',
    docs: 'the parties\u2019 particulars; facts and cause of action; the relief claimed; valuation and court fee; and supporting documents/evidence.',
    nextStep: 'the court issues summons/notice to the defendant, who files a written statement; then issues are framed and evidence is recorded.',
    afterSubmission: 'obtain the dated filing receipt/case number, attend every hearing, and serve/produce documents as directed.',
    lawyer: 'strongly advisable — pleadings, valuation, court fee and limitation are technical and errors can defeat the claim.',
    checklist: ['State the facts, cause of action and relief precisely.', 'Value the suit and affix the correct court fee.', 'Attach supporting documents.', 'File within limitation in the court of competent jurisdiction.']
  },
  {
    match: /rent|tenant|landlord|lease|tenancy|kiraya|evict/i,
    name: 'Rental / Tenancy Agreement',
    provision: 'provincial rent/tenancy laws (e.g. Punjab Rented Premises Act 2009)',
    is: 'a contract between a landlord and a tenant setting out the terms on which a property is let — rent, deposit, duration and conditions.',
    usedFor: 'to record the tenancy terms and protect both parties; in several provinces tenancies must be registered.',
    toWhom: 'executed between the landlord (lessor) and the tenant (lessee); a copy is retained by each, and registration may involve the relevant rent authority/registrar.',
    where: 'signed by both parties with witnesses; where provincial law requires, registered with the relevant rent controller/registrar/authority.',
    docs: 'parties\u2019 CNICs, the property description/title, agreed rent and security deposit, duration and terms, and witness details.',
    nextStep: 'the tenancy commences per the agreement; disputes (e.g. eviction, rent) go to the relevant rent controller/court under provincial law.',
    afterSubmission: 'keep a signed (and where required, registered) copy; record rent payments; give/receive notice per the agreement\u2019s terms.',
    lawyer: 'advisable where the tenancy is high-value or long-term, or if a dispute is likely, to ensure correct stamping/registration.',
    fees: 'stamping and registration charges are NOT verified here and vary by province and by the rent amount/term. Confirm the applicable stamp duty and registration fee with the relevant authority before executing.',
    checklist: ['Record rent, deposit, duration and renewal terms clearly.', 'Attach CNICs and describe the premises.', 'Have it signed and witnessed.', 'Confirm provincial stamping/registration requirements.']
  },
  {
    match: /property transfer|sale deed|registry|sub[\s-]?registrar|transfer of (?:property|land)|mutation|intiqal/i,
    name: 'Property Transfer Application / Sale Deed',
    provision: 'Registration Act 1908 / provincial stamp laws',
    is: 'the document(s) by which ownership of immovable property is transferred from a seller (transferor) to a buyer (transferee), requiring registration.',
    usedFor: 'to legally transfer title in property and record the transaction with the state.',
    toWhom: 'executed between the transferor and transferee and registered before the relevant Sub-Registrar; mutation (intiqal) is recorded with the revenue authority.',
    where: 'registered with the Sub-Registrar having jurisdiction over the property; for agricultural land, mutation is entered in the revenue record.',
    docs: 'title/ownership documents, the parties\u2019 CNICs, property description, consideration/price, prior tax receipts, and any required NOC/authority documents.',
    nextStep: 'registration of the deed (and, where applicable, mutation/intiqal in the revenue record) completes the transfer.',
    afterSubmission: 'collect the registered deed, verify the entry, and preserve all title documents and receipts.',
    lawyer: 'advisable — title verification, stamp duty and registration are technical and errors can cloud ownership.',
    fees: 'stamp duty and registration fee are NOT verified here and vary by province, property value and category. Confirm the exact amounts with the relevant Sub-Registrar/revenue office before proceeding.',
    checklist: ['Verify the seller\u2019s clear title.', 'State the exact property description and consideration.', 'Attach CNICs and prior tax/ownership records.', 'Register before the correct Sub-Registrar and obtain mutation where applicable.']
  },
  {
    match: /complaint|petition|shikayat|\b200\b/i,
    name: 'Criminal Complaint (Private Complaint)',
    provision: 'Section 200 CrPC',
    is: 'a complaint made to a Magistrate alleging an offence, so that the Magistrate may take cognizance — commonly used where the police have not acted on the matter.',
    usedFor: 'to ask the court to take cognizance of an offence and proceed against the accused when an FIR route is unavailable or the police have not acted.',
    toWhom: 'the Magistrate having jurisdiction (under Section 200 CrPC), or the SHO for a cognizable offence.',
    where: 'filed before the Court of the Magistrate of the relevant area.',
    docs: 'the complainant\u2019s particulars and CNIC, the accused\u2019s particulars, the facts (date/time/place), the offences/PPC sections if known, and witness details.',
    nextStep: 'the Magistrate examines the complainant and witnesses on oath and may summon the accused, order an investigation, or dismiss the complaint.',
    afterSubmission: 'attend the examination/hearings, produce witnesses, and keep a copy of the complaint and any order.',
    lawyer: 'advisable — private complaints are technical and are best framed by an advocate.',
    checklist: ['State the facts clearly with date, time and place.', 'Identify the accused and witnesses.', 'Cite the offences/sections if known.', 'File before the Magistrate of the correct jurisdiction.']
  }
];

/** Match a document name/label (or an uploaded filename) to a verified entry. */
function matchDocExplain(docName) {
  const d = String(docName || '').toLowerCase();
  for (const e of DOC_EXPLAIN) { if (e.match.test(d)) return e; }
  return null;
}

/**
 * Part T — compose the 11-point "Explain This Document" answer for a legal
 * document TYPE. Grounded in verified statutory references/forums only; fees and
 * deadlines are stated honestly (never invented). English output with bilingual
 * point labels when the conversation language is Roman Urdu. If the name is not a
 * recognised legal document type (e.g. an arbitrary uploaded filename), it says
 * so honestly and redirects to the grounded document analyzer — it never guesses.
 */
export function explainDocumentType(docName, lang) {
  const isRoman = lang === 'roman_urdu';
  const e = matchDocExplain(docName);
  const rawName = cleanLine(docName);

  if (!e) {
    return [
      isRoman ? `**"${rawName || 'Yeh file'}" aik pehchani gayi qanooni document qism nahi hai.**` : `**"${rawName || 'This file'}" is not a recognised legal document type.**`,
      '',
      isRoman
        ? 'Main kisi na-maloom document qism ke baare mein andaaze se tafseel nahi banaunga. Agar aap ke paas asal document hai, to Document Drafter mein "Upload / Analyze Document" se file upload karein — main uska ASAL text parh kar bataunga ke yeh kya hai, kis ke naam hai, aap se kya maangta hai aur agla qadam kya hai (sirf usi text ke haqaiq se).'
        : 'I will not guess an explanation for an unknown document type. If you have the actual document, upload it via "Upload / Analyze Document" in the Document Drafter — I will read its real text and tell you what it is, who it is addressed to, what it requires and the next step, grounded only in what the document actually says.',
      '',
      isRoman
        ? 'Agar aap kisi maloom qism (maslan FIR, Legal Notice, Bail, Writ, Family Application) ki tafseel chahte hain, to Drafter mein woh category chunein aur "Explain This Document" dabayein.'
        : 'If you want an explanation of a known type (e.g. FIR, Legal Notice, Bail, Writ, Family Application), select that category in the Drafter and press "Explain This Document".'
    ].join('\n');
  }

  const L = (en, ur) => (isRoman ? `${en} / ${ur}` : en);
  const pts = [
    [L('1. What this document is', '1. Yeh document kya hai'), e.is],
    [L('2. What it is used for', '2. Kis liye istemal hota hai'), e.usedFor],
    [L('3. Who receives it / who it is addressed or submitted to', '3. Kisko milta hai / kis ke naam'), e.toWhom],
    [L('4. Where it should be submitted or filed', '4. Kahan jama ya file hona chahiye'), e.where],
    [L('5. Supporting documents / evidence that may be relevant', '5. Mutalqa handayz / saboot'), e.docs],
    [L('6. The next procedural step after this document', '6. Iske baad agla qadam'), e.nextStep],
    [L('7. What the person should do after submission', '7. Jama karane ke baad kya karein'), e.afterSubmission],
    [L('8. Possible fees (verified only)', '8. Mumkinah fees (sirf tasdeeq shuda)'), e.fees || FEES_NOT_VERIFIED],
    [L('9. Whether a lawyer is advisable', '9. Kya wakeel behtar hai'), e.lawyer],
    [L('10. Important deadlines / limitation (verified only)', '10. Ahem mohlat / limitation (sirf tasdeeq shuda)'), e.deadlines || DEADLINES_NOT_VERIFIED]
  ];

  let out = `**${isRoman ? 'Tafseel' : 'Explained'}: ${e.name}**\n\n`;
  for (const [label, body] of pts) out += `**${label}**\n${body}\n\n`;
  out += `**${L('11. Best-practice checklist before submission', '11. Jama karane se pehle behtareen checklist')}**\n`;
  out += e.checklist.map(c => `\u2022 ${c}`).join('\n');

  const prov = e.provision ? (isRoman ? ` (tasdeeq shuda hawala: ${e.provision})` : ` (verified reference: ${e.provision})`) : '';
  out += `\n\n---\n` + (isRoman
    ? `General qanooni rehnumai — tasdeeq shuda Pakistani qanoon par mabni${prov}. Court fees, stamp duty, exact formats aur limitation periods yahan tasdeeq shuda NAHI hain aur sooba/office ke mutabiq mukhtalif ho sakte hain — file karne se pehle mutalqa court/office ya registered advocate se tasdeeq karein. Yeh qanooni maloomat hai, qanooni mashwara nahi.`
    : `General legal guidance based on verified Pakistani law${prov}. Court fees, stamp duty, exact formats and limitation periods are NOT independently verified here and vary by province and office — confirm with the relevant court/office or a registered advocate before filing. This is legal information, not legal advice.`);
  return out;
}

// ============================================================================
// Document Comparison (Kaaghaz-Saathi parity — Feature 5)
// Compares two document texts structurally: parties, dates, amounts, obligations,
// deadlines, clauses added/removed/changed. Everything grounded in the actual
// text — never fabricates a difference.
// ============================================================================

/** A comparison result that reports no findings, used by every refusal path. */
function emptyComparison(summary, overallRisk) {
  return {
    summary,
    typeA: null,
    typeB: null,
    partiesChanged: [],
    datesChanged: [],
    amountsChanged: [],
    obligationsAdded: [],
    obligationsRemoved: [],
    deadlinesChanged: [],
    clausesAdded: [],
    clausesRemoved: [],
    overallRisk,
    riskLevel: 'unknown',
    isOffline: true
  };
}

export function compareDocumentsLocal(textA, textB, opts = {}) {
  const a = String(textA || '').trim();
  const b = String(textB || '').trim();
  const isRoman = opts.preferredLanguage === 'roman_urdu';

  if (a.length < 20 || b.length < 20) {
    return emptyComparison(
      isRoman
        ? 'Dono documents mein kafi text nahi mila muqabla karne ke liye. Baraye meharbani dono documents dobara upload karein.'
        : 'Not enough text in one or both documents to perform a meaningful comparison. Please re-upload both documents.',
      isRoman ? 'Muqabla mumkin nahi — text kam hai.' : 'Comparison not possible — insufficient text.'
    );
  }

  // Garbage in must not become confident output: if either side is not readable
  // document text (base64 blob, binary noise), refuse instead of "diffing" it.
  const readableA = assessDocumentReadability(a);
  const readableB = assessDocumentReadability(b);
  if (!readableA.readable || !readableB.readable) {
    const which = !readableA.readable && !readableB.readable
      ? (isRoman ? 'Dono documents' : 'Both documents')
      : `Document ${readableA.readable ? 'B' : 'A'}`;
    return emptyComparison(
      isRoman
        ? `${which} mein parhne layak document text nahi tha, is liye muqabla nahi kiya gaya. Us document ka saaf scan/photo dobara upload karein ya us ka text khud type karke bhejen.`
        : `${which} did not contain readable document text, so no comparison was made. Re-upload a clearer scan or photo of that document, or type its text and try again.`,
      isRoman ? 'Muqabla mumkin nahi — text parhne layak nahi tha.' : 'Comparison not possible — one side was not readable document text.'
    );
  }

  const typeA = classifyDocumentType(a).type || 'Unknown document';
  const typeB = classifyDocumentType(b).type || 'Unknown document';

  const partiesA = extractParties(a).map(p => p.toLowerCase());
  const partiesB = extractParties(b).map(p => p.toLowerCase());
  const partiesAdded = extractParties(b).filter((p, i) => !partiesA.includes(p.toLowerCase()));
  const partiesRemoved = extractParties(a).filter((p, i) => !partiesB.includes(p.toLowerCase()));

  const datesA = extractDates(a);
  const datesB = extractDates(b);
  const datesChanged = [];
  const datesASet = new Set(datesA.map(d => d.toLowerCase()));
  const datesBSet = new Set(datesB.map(d => d.toLowerCase()));
  for (const d of datesB) { if (!datesASet.has(d.toLowerCase())) datesChanged.push(`+ ${d}`); }
  for (const d of datesA) { if (!datesBSet.has(d.toLowerCase())) datesChanged.push(`- ${d}`); }

  const amountsA = extractAmounts(a);
  const amountsB = extractAmounts(b);
  const amountsChanged = [];
  const amountsASet = new Set(amountsA.map(x => x.toLowerCase()));
  const amountsBSet = new Set(amountsB.map(x => x.toLowerCase()));
  for (const amt of amountsB) { if (!amountsASet.has(amt.toLowerCase())) amountsChanged.push(`+ ${amt}`); }
  for (const amt of amountsA) { if (!amountsBSet.has(amt.toLowerCase())) amountsChanged.push(`- ${amt}`); }

  const reqsA = extractRequestedAction(a).map(r => r.toLowerCase());
  const reqsB = extractRequestedAction(b).map(r => r.toLowerCase());
  const obligationsAdded = extractRequestedAction(b).filter(r => !reqsA.includes(r.toLowerCase()));
  const obligationsRemoved = extractRequestedAction(a).filter(r => !reqsB.includes(r.toLowerCase()));

  const deadA = extractDeadlines(a).map(d => d.toLowerCase());
  const deadB = extractDeadlines(b).map(d => d.toLowerCase());
  const deadlinesChanged = [];
  for (const d of extractDeadlines(b)) { if (!deadA.includes(d.toLowerCase())) deadlinesChanged.push(`+ ${d}`); }
  for (const d of extractDeadlines(a)) { if (!deadB.includes(d.toLowerCase())) deadlinesChanged.push(`- ${d}`); }

  const provA = extractProvisions(a).map(p => p.toLowerCase());
  const provB = extractProvisions(b).map(p => p.toLowerCase());
  const clausesAdded = extractProvisions(b).filter(p => !provA.includes(p.toLowerCase()));
  const clausesRemoved = extractProvisions(a).filter(p => !provB.includes(p.toLowerCase()));

  // No comparable facts on one side means every reported "difference" would be
  // noise — refuse rather than announcing a difference count.
  const signalA = partiesA.length + datesA.length + amountsA.length + extractAuthorities(a).length + provA.length + extractCaseNumbers(a).length;
  const signalB = partiesB.length + datesB.length + amountsB.length + extractAuthorities(b).length + provB.length + extractCaseNumbers(b).length;
  if (signalA === 0 || signalB === 0) {
    const which = signalA === 0 && signalB === 0
      ? (isRoman ? 'Dono documents' : 'Both documents')
      : `Document ${signalA === 0 ? 'A' : 'B'}`;
    return emptyComparison(
      isRoman
        ? `${which} se koi bhi tulna-qabil baat (naam, tareekh, rakam, idaray ya dhara) nahi nikli. Is liye muqabla nahi kiya gaya — khalayi ya parhne layak nahi. Us document ka saaf scan dobara upload karein ya us ka asli text paste karein.`
        : `No comparable facts (parties, dates, amounts, authorities or provisions) could be extracted from ${which}, so no comparison was made — the result would only reflect missing or unreadable text. Re-upload a clearer scan of that document, or paste its actual text.`,
      isRoman ? 'Muqabla mumkin nahi — ek taraf se koi baat nahi nikli.' : 'Comparison not possible — one document yielded no extractable facts.'
    );
  }

  const changes = [
    partiesAdded.length + partiesRemoved.length,
    datesChanged.length,
    amountsChanged.length,
    obligationsAdded.length + obligationsRemoved.length,
    deadlinesChanged.length,
    clausesAdded.length + clausesRemoved.length
  ].reduce((s, n) => s + n, 0);

  let riskLevel = 'low';
  if (changes > 10 || amountsChanged.length > 2 || deadlinesChanged.length > 2) riskLevel = 'high';
  else if (changes > 5 || amountsChanged.length > 0 || deadlinesChanged.length > 0) riskLevel = 'medium';

  const riskLabel = isRoman
    ? (riskLevel === 'high' ? 'Bohat zyada farq — ghaur talab jaiza zaroori hai' : riskLevel === 'medium' ? 'Kuch ahem farq hain — jaiza lein' : 'Chotay farq — aam tor par mamooli')
    : (riskLevel === 'high' ? 'Significant differences — careful review required' : riskLevel === 'medium' ? 'Some important differences detected — review recommended' : 'Minor differences — generally routine');

  const summary = isRoman
    ? `Document A "${typeA}" hai aur Document B "${typeB}" hai. Kul ${changes} farq mile: ${partiesAdded.length + partiesRemoved.length} fariq, ${datesChanged.length} tareekhein, ${amountsChanged.length} raqmein, ${obligationsAdded.length + obligationsRemoved.length} zimmedariyan, ${deadlinesChanged.length} mohlatein, ${clausesAdded.length + clausesRemoved.length} qanooni dharaain. Khatera ki satah: ${riskLabel}.`
    : `Document A is a "${typeA}" and Document B is a "${typeB}". Total ${changes} differences found: ${partiesAdded.length + partiesRemoved.length} party changes, ${datesChanged.length} date changes, ${amountsChanged.length} amount changes, ${obligationsAdded.length + obligationsRemoved.length} obligation changes, ${deadlinesChanged.length} deadline changes, ${clausesAdded.length + clausesRemoved.length} legal provision changes. Risk level: ${riskLabel}.`;

  return {
    summary,
    typeA,
    typeB,
    partiesChanged: [...partiesRemoved.map(p => `- ${p}`), ...partiesAdded.map(p => `+ ${p}`)],
    datesChanged,
    amountsChanged,
    obligationsAdded,
    obligationsRemoved,
    deadlinesChanged,
    clausesAdded,
    clausesRemoved,
    overallRisk: riskLabel,
    riskLevel,
    isOffline: true
  };
}

// ============================================================================
// Readiness Checklist (Kaaghaz-Saathi parity — Feature 8)
// Given a document type or description, returns a structured checklist of
// everything the user needs to prepare, a readiness score, and guidance.
// Student-first: university document types get priority coverage.
// ============================================================================

const STUDENT_CHECKLISTS = {
  'university fee challan': {
    label: 'University Fee Challan / Fee Deposit',
    items: [
      { text: 'The challan as issued — showing challan/form number, semester or programme, and the amount', required: true },
      { text: 'University registration/enrolment number and CNIC or B-Form of the student', required: true },
      { text: 'Bank deposit slip or the university counter\'s payment receipt, kept after paying', required: true },
      { text: 'The fee schedule/notification published by the university for this semester and programme, to check that the amount on the challan matches it', required: true },
      { text: 'Written record of any fee concession, scholarship or waiver already granted to you', required: false },
      { text: 'If the amount is disputed: a dated written request to the Accounts/Fee Section stating the mismatch, with a copy retained', required: false },
      { text: 'Proof of the payment date when a late-payment charge is being challenged', required: false }
    ],
    authority: 'Accounts / Fee Section of the respective university, and the bank named on the challan',
    studentSpecific: true
  },
  'university admission': {
    label: 'University Admission',
    items: [
      { text: 'Matric/Intermediate marksheet and certificate (original + attested copies)', required: true },
      { text: 'CNIC or B-Form', required: true },
      { text: 'Domicile certificate', required: true },
      { text: 'Passport-size photographs (4-8)', required: true },
      { text: 'Admission fee challan / bank draft', required: true },
      { text: 'Migration certificate (if from another board/university)', required: false },
      { text: 'Character certificate from previous institution', required: false },
      { text: 'Equivalence certificate (for foreign qualifications)', required: false }
    ],
    authority: 'Admissions Office of the respective university',
    studentSpecific: true
  },
  'university hostel': {
    label: 'University Hostel Application',
    items: [
      { text: 'University enrollment/registration proof', required: true },
      { text: 'CNIC or B-Form', required: true },
      { text: 'Passport-size photographs (4)', required: true },
      { text: 'Hostel fee challan', required: true },
      { text: 'Parent/guardian consent letter', required: true },
      { text: 'Medical fitness certificate', required: false },
      { text: 'Previous hostel NOC (if transferring)', required: false }
    ],
    authority: 'Provost / Hostel Office of the respective university',
    studentSpecific: true
  },
  'university fee refund': {
    label: 'University Fee Refund Application',
    items: [
      { text: 'Original fee challan/receipt', required: true },
      { text: 'Written application stating reason for refund', required: true },
      { text: 'University enrollment/registration proof', required: true },
      { text: 'CNIC or B-Form', required: true },
      { text: 'Bank account details for refund transfer', required: false },
      { text: 'Admission cancellation/withdrawal proof', required: false }
    ],
    authority: 'Treasurer / Finance Office of the respective university',
    studentSpecific: true
  },
  'university transcript': {
    label: 'University Transcript / Degree Request',
    items: [
      { text: 'Completed application form', required: true },
      { text: 'All semester mark sheets (originals for verification)', required: true },
      { text: 'CNIC or B-Form', required: true },
      { text: 'Transcript fee challan', required: true },
      { text: 'University ID card copy', required: false },
      { text: 'NOC from department (if required)', required: false }
    ],
    authority: 'Controller of Examinations / Registrar Office',
    studentSpecific: true
  },
  'university exam appeal': {
    label: 'University Examination Appeal / Recheck',
    items: [
      { text: 'Original mark sheet / result card', required: true },
      { text: 'Rechecking fee challan (per paper)', required: true },
      { text: 'Written application specifying subject(s) and grounds', required: true },
      { text: 'University enrollment/registration proof', required: true },
      { text: 'CNIC or B-Form', required: true },
      { text: 'Copy of answer script (if available)', required: false }
    ],
    authority: 'Controller of Examinations of the respective university',
    studentSpecific: true
  },
  'university scholarship': {
    label: 'University Scholarship Application',
    items: [
      { text: 'University enrollment/registration proof', required: true },
      { text: 'All previous semester mark sheets', required: true },
      { text: 'CNIC or B-Form', required: true },
      { text: 'Family income proof / affidavit', required: false },
      { text: 'Recommendation letter from department head', required: false },
      { text: 'Other scholarship/financial aid disclosure', required: false }
    ],
    authority: 'Student Affairs / Scholarship Office of the respective university',
    studentSpecific: true
  },
  'university anti-harassment complaint': {
    label: 'University Anti-Harassment Complaint',
    items: [
      { text: 'Written complaint with dates, times, and specifics of each incident', required: true },
      { text: 'Complainant identity (name, enrollment number, department)', required: true },
      { text: 'Accused person description (name/role/department if known)', required: true },
      { text: 'Any evidence: screenshots, messages, emails, witness names', required: false },
      { text: 'Previous complaints (if any)', required: false }
    ],
    authority: 'Inquiry Committee (mandatory under Protection Against Harassment Act 2010) — every university must have one',
    studentSpecific: true
  },
  'domicile certificate': {
    label: 'Domicile Certificate',
    items: [
      { text: 'CNIC or B-Form', required: true },
      { text: 'Affidavit on stamp paper', required: true },
      { text: "Father's/husband's CNIC", required: true },
      { text: 'Passport-size photographs (4-6)', required: true },
      { text: 'School leaving certificate / matric certificate as proof of residence', required: true },
      { text: 'Utility bill of residence', required: false },
      { text: 'Revenue record (fard/registry) if applicable', required: false }
    ],
    authority: 'Tehsil / District Revenue Office (AC Office) of your area',
    studentSpecific: false
  },
  'passport': {
    label: 'Passport (New / Renewal)',
    items: [
      { text: 'CNIC (original + copies)', required: true },
      { text: 'Old passport (for renewal)', required: false },
      { text: 'Passport fee challan / bank draft', required: true },
      { text: 'Passport-size photographs (as per specifications)', required: true },
      { text: 'NOC from employer (for government employees)', required: false }
    ],
    authority: 'Regional Passport Office',
    studentSpecific: false
  },
  'legal notice': {
    label: 'Legal Notice',
    items: [
      { text: 'Recipient name and address (identifiable addressee)', required: true },
      { text: 'Clear statement of facts and grievance', required: true },
      { text: 'Specific demand (amount, action, deadline)', required: true },
      { text: 'Sender identity (your name/CNIC)', required: true },
      { text: 'Supporting documents (contracts, invoices, correspondence)', required: false },
      { text: 'Lawyer details (if sending through advocate)', required: false }
    ],
    authority: 'Directly to the recipient; keep proof of dispatch (registered post/courier receipt)',
    studentSpecific: false
  }
};

const LEGAL_CHECKLISTS = {
  'show cause notice reply': {
    label: 'Reply to a Show-Cause / Departmental Notice',
    items: [
      { text: 'The notice itself, with the date you received it', required: true },
      { text: 'A written reply that answers each ground or allegation the notice states, one by one', required: true },
      { text: 'The records that support your version of each stated ground (ledgers, emails, attendance, receipts, file notings)', required: true },
      { text: 'Proof the reply was submitted within the period stated in the notice, and that period calculated from the date of receipt', required: true },
      { text: 'A copy of your reply with the receiving stamp, acknowledgement or postal/courier receipt', required: true },
      { text: 'Any earlier correspondence on the same matter', required: false },
      { text: 'Representation by a lawyer, where the notice warns of disciplinary or legal consequences', required: false }
    ],
    authority: 'The issuing authority named in the notice',
    studentSpecific: false
  },
  'bail application': {
    label: 'Bail Application',
    items: [
      { text: 'CNIC of the accused (original + copies)', required: true },
      { text: 'Copy of FIR (First Information Report)', required: true },
      { text: 'Arrest memo or intimation of arrest (if arrested)', required: true },
      { text: 'Affidavit in support of bail application', required: true },
      { text: 'Vakalatnama (power of attorney for lawyer)', required: true },
      { text: 'Previous criminal record (if any) — or affidavit of no prior record', required: false },
      { text: 'Medical reports (if health grounds cited)', required: false },
      { text: 'Surety documents (property papers / CNIC of surety)', required: false }
    ],
    authority: 'Sessions Court / High Court depending on offence category',
    studentSpecific: false
  },
  'fir registration': {
    label: 'FIR Registration',
    items: [
      { text: 'Complainant CNIC (original + copy)', required: true },
      { text: 'Written complaint detailing the incident (date, time, place, accused if known)', required: true },
      { text: 'Supporting evidence — medical report, photographs, CCTV footage, witness names', required: false },
      { text: 'Previous correspondence (if any) with police', required: false }
    ],
    authority: 'Local Police Station (SHO) having territorial jurisdiction',
    studentSpecific: false
  },
  'family case': {
    label: 'Family Case (Maintenance / Custody / Divorce)',
    items: [
      { text: 'Nikahnama (marriage certificate) — original + copies', required: true },
      { text: 'CNIC of both parties', required: true },
      { text: 'Details of children (names, ages, CNIC/B-Form if available)', required: true },
      { text: 'Income proof of husband (salary slip, tax return, bank statements)', required: false },
      { text: 'Evidence of cruelty / desertion (if applicable)', required: false },
      { text: 'Previous court orders (if any)', required: false }
    ],
    authority: 'Family Court under the Muslim Family Laws Ordinance 1961',
    studentSpecific: false
  },
  'consumer complaint': {
    label: 'Consumer Complaint',
    items: [
      { text: 'Complainant CNIC', required: true },
      { text: 'Receipt / invoice / proof of purchase', required: true },
      { text: 'Written description of defect / deficiency / unfair trade practice', required: true },
      { text: 'Correspondence with the seller / service provider (complaint letters, emails)', required: false },
      { text: 'Photographs or expert report of the defective product/service', required: false },
      { text: 'Details of compensation claimed (amount, replacement, refund)', required: false }
    ],
    authority: 'District Consumer Court / Provincial Consumer Protection Authority',
    studentSpecific: false
  },
  'property transfer': {
    label: 'Property Transfer (Sale / Gift / Inheritance)',
    items: [
      { text: 'Title deed / registry (fard inteqaal) of the property', required: true },
      { text: 'CNIC of transferor and transferee', required: true },
      { text: 'Mutation / inteqal record from revenue office', required: true },
      { text: 'Fard Jama Bandi (current ownership record)', required: false },
      { text: 'No-encumbrance certificate / proof of clear title', required: false },
      { text: 'Valuation report (for stamp duty calculation)', required: false },
      { text: 'NOC from relevant authority (for leasehold / society property)', required: false },
      { text: 'Succession certificate or heir consent (for inheritance transfer)', required: false }
    ],
    authority: 'Sub-Registrar Office / Revenue Office (Patwari Circle)',
    studentSpecific: false
  },
  'tenancy dispute': {
    label: 'Rent / Tenancy Dispute (Eviction, Deposit, Default)',
    items: [
      { text: 'Written tenancy agreement / rent deed (registered where the province requires it)', required: true },
      { text: 'Rent receipts signed by the landlord, or bank transfer records showing rent paid', required: true },
      { text: 'CNIC of the tenant and landlord (original + copies)', required: true },
      { text: 'Proof of the tenancy address and period of occupation', required: true },
      { text: 'Security deposit receipt or the agreement clause recording the deposit', required: false },
      { text: '15-day written notice / demand already served, with proof of dispatch', required: false },
      { text: 'Evidence for the ground relied on — sub-letting, nuisance, structural damage, cut-off utilities (photos, bills, witness names)', required: false },
      { text: 'Copy of the Rent Controller order, if appealing within 30 days', required: false }
    ],
    authority: 'Rent Controller / Rent Tribunal of the district where the property is located',
    studentSpecific: false
  },
  'student appeal': {
    label: 'Student Appeal (University Decision)',
    items: [
      { text: 'University enrollment / registration proof', required: true },
      { text: 'Original decision / order being appealed', required: true },
      { text: 'Written appeal stating grounds and relief sought', required: true },
      { text: 'Supporting documents — mark sheets, attendance records, medical certificates', required: false },
      { text: 'Copy of university appeal rules / statute (if available)', required: false },
      { text: 'Prior correspondence with department / examination office', required: false }
    ],
    authority: 'Appeals Committee / Syndicate / Vice Chancellor of the respective university',
    studentSpecific: true
  },
  'domicile certificate': {
    label: 'Domicile Certificate',
    items: [
      { text: 'CNIC of the applicant (or B-Form for minors)', required: true },
      { text: 'Father / husband CNIC', required: true },
      { text: 'Affidavit on stamp paper declaring permanent residence', required: true },
      { text: 'Utility bill (gas / electricity / water) of the residence', required: true },
      { text: 'Two passport-size photographs', required: true },
      { text: 'Educational certificates mentioning address (matric / intermediate)', required: false },
      { text: 'Revenue record (fard / inteqal) or property documents proving residence', required: false },
      { text: 'NOC from employer (if domicile of service locality is required)', required: false }
    ],
    authority: 'Office of the Deputy Commissioner / Assistant Commissioner — Tehsil level',
    studentSpecific: false
  },
  'passport': {
    label: 'Passport (New / Renewal)',
    items: [
      { text: 'Original CNIC (valid, not expired)', required: true },
      { text: 'Photocopy of CNIC (front and back)', required: true },
      { text: 'Two recent passport-size photographs (white background)', required: true },
      { text: 'Old passport (for renewal / re-issue)', required: false },
      { text: 'Bank draft / pay order for the passport fee', required: true },
      { text: 'NOC from government employer (if applicable)', required: false },
      { text: 'Guardian CNIC and consent letter (for minors under 18)', required: false },
      { text: 'Police character certificate (if required for specific categories)', required: false }
    ],
    authority: 'Regional Passport Office / District Passport Seva Kendra',
    studentSpecific: false
  }
};

const LEGAL_COMMON_MISTAKES = {
  'bail application': [
    'Not mentioning the exact FIR number, date, and police station',
    'Filing in the wrong court — bailable offences go to the trial court, non-bailable to Sessions/High Court',
    'Not providing a local surety with verifiable property documents',
    'Omitting the accused\'s criminal history — courts require full disclosure'
  ],
  'fir registration': [
    'Going to a police station outside the area where the incident occurred — jurisdiction matters',
    'Not getting a stamped receiving copy of your written complaint',
    'Vague description without date, time, place, or names of accused',
    'Delay in reporting without explanation — courts view unexplained delay skeptically'
  ],
  'family case': [
    'Filing without the Nikahnama — it is the foundational document',
    'Not specifying the exact amount of maintenance claimed and how it was calculated',
    'Confusing jurisdiction — family cases go to the court where the wife resides or where marriage was solemnized',
    'Not attaching children\'s birth certificates / B-Form in custody cases'
  ],
  'consumer complaint': [
    'Filing after the limitation period (usually 2 years from the cause of action)',
    'Not sending a legal notice to the seller/service provider before filing',
    'Missing the original receipt or invoice — photocopies may not be accepted',
    'Claiming unrealistic compensation without evidence of actual loss'
  ],
  'tenancy dispute': [
    'Changing the locks, cutting off water/electricity/gas or locking out the tenant — eviction requires an order of the Rent Controller (Sindh) or Rent Tribunal (Punjab), and disconnecting essential services is itself an offence',
    'Filing in the wrong forum or the wrong district — the petition goes to the Rent Court where the property is located',
    'No written tenancy agreement or signed rent receipts — Punjab requires the agreement in writing and registered, and the tenant is entitled to a signed receipt for rent',
    'Serving no 15-day written notice before filing, then being unable to show the default or grievance was raised first',
    'Missing the appeal window — an appeal against the Rent Court order lies to the District Judge within 30 days'
  ],
  'property transfer': [
    'Not verifying the title chain — always check the last 20+ years of ownership',
    'Skipping the mutation (inteqal) at the revenue office after registry',
    'Not checking for encumbrances — court attachments, bank mortgages, or family disputes',
    'Paying stamp duty on an undervalued amount — revenue authorities can penalize'
  ],
  'student appeal': [
    'Missing the university\'s internal appeal deadline — usually 15-30 days from the decision',
    'Not exhausting internal remedies before approaching an external forum',
    'Filing a vague appeal without referencing the specific clause or rule being challenged',
    'Not attaching the original mark sheet / decision order being appealed'
  ],
  'domicile certificate': [
    'Applying in the wrong tehsil — domicile must be of the area where you actually reside or your father resides',
    'Submitting an affidavit that does not match the address on your CNIC or educational records',
    'Not attesting the affidavit — most offices require a notarized stamp-paper affidavit',
    'Missing the utility bill or submitting one in someone else\'s name without proof of relationship'
  ],
  'passport': [
    'Photographs with a coloured or dark background — passport offices require plain white background',
    'CNIC expired or about to expire — most passport offices require at least 6 months validity',
    'Not carrying the old passport for renewal — it is needed for cancellation and reference',
    'Paying the wrong fee amount — urgent vs normal vs executive categories have different fees'
  ],
  'legal notice': [
    'Sending the notice by ordinary post with no acknowledgment — the forum expects registered post (AD) or courier with acknowledgment as proof of service',
    'Filing the complaint or suit before the notice period has run out — the consumer forum requires the 15-day notice period to expire first, and a cheque case allows a 489-F complaint only after 15 days from the notice',
    'Missing the deadline for issuing the notice itself — in a cheque dishonour the notice to the drawer must be sent within 30 days of the dishonour',
    'Stating the grievance but no specific demand: the notice must set out the facts, the legal basis, and the exact relief or amount demanded with a deadline to respond',
    'Losing the postal receipt and the sent copy — the later complaint has to attach the copy of the legal notice, its postal receipt, and any reply received'
  ]
};

// Procedural cautions that hold for any filing with any office — used when no
// document-type-specific list exists. Deliberately names no forum, fee, or
// limitation period, because those vary and are not verified here.
const GENERAL_COMMON_MISTAKES = {
  en: [
    'Filing without keeping your own copy of everything submitted — you will later need proof of what you filed and on what date',
    'Leaving fields blank or writing a vague subject line instead of naming the exact document, the office it is addressed to, and the date',
    'Relying on a verbal assurance instead of obtaining a written acknowledgement, receipt, or diary/reference number at the time of filing',
    'Attaching plain photocopies where the office requires an original or an attested copy',
    'Calculating a stated deadline from the wrong date — confirm whether the clock runs from the day you received the document or the day it was decided'
  ],
  roman: [
    'Jama karne ke baad apne paas mukammal nakal (copy) na rakhna — baad mein sabit karna parta hai ke aap ne kya aur kis tareekh ko jama kiya',
    'Khanay khali chhor dena ya wazeh subject na likhna — document ka naam, kis idaray ke naam, aur tareekh saaf likhen',
    'Zubani waday par bharosa kar lena ke bajaye jama karte hi likhit rasid, acknowledgement ya diary/reference number hasil karein',
    'Jahan asal ya tasdeeq shuda (attested) copy darkar hai, wahan aam nakal lagha dena',
    'Mohlat ki shumar ghalat tareekh se shuru karna — tasdeeq karein ke ginti aap ko dastawez milne ki tareekh se chalti hai ya faislay ki tareekh se'
  ]
};

function matchChecklistType(description) {
  const d = String(description || '').toLowerCase();
  // A challan, receipt or fee deposit is a PAYMENT record. Left to the university
  // fallthrough below it became an admission application, and the student was told to
  // gather matric marksheets and photographs instead of their deposit slip. Excluded
  // when the ask is a refund, which has its own established checklist.
  if (/refund/.test(d) === false && /\bchallan\b|\bdues\b|fee\s+(?:receipt|due|deposit|voucher|section)|fee\s+form/.test(d)) {
    return 'university fee challan';
  }
  if (/show[\s-]?cause|charge.?sheet|departmental\s+(?:in|en)quiry|explanation\s+notice/.test(d)) {
    return 'show cause notice reply';
  }
  if (/university|uni|college|hostel|admission|transcript|degree|recheck|re.?evaluat|exam.*appeal|scholarship|stipend|fee.*refund|anti.?harass|harassment.*(?:university|college|campus|professor|teacher)|disciplin|expulsion|rustication/.test(d)) {
    if (/hostel/.test(d)) return 'university hostel';
    if (/fee.*refund|refund.*fee/.test(d)) return 'university fee refund';
    if (/transcript|degree|attestation|equivalence/.test(d)) return 'university transcript';
    if (/recheck|re.?evaluat|exam.*appeal|result.*appeal/.test(d)) return 'university exam appeal';
    if (/scholarship|stipend|financial.?aid|Ehsaas|BISP/.test(d)) return 'university scholarship';
    if (/harass|anti.?harass|discrimin/.test(d)) return 'university anti-harassment complaint';
    if (/admission|enroll|merit/.test(d)) return 'university admission';
    if (/appeal/.test(d)) return 'student appeal';
    return 'university admission';
  }
  if (/domicile/.test(d)) return 'domicile certificate';
  if (/passport/.test(d)) return 'passport';
  if (/legal notice|demand notice|recovery notice/.test(d)) return 'legal notice';
  if (/bail|zamanat|pre.?arrest|post.?arrest/.test(d)) return 'bail application';
  if (/\bfir\b|first information|police.*complaint|police.*report|darj.*fir|fir.*darj/.test(d)) return 'fir registration';
  if (/family|maintenance|nafqa|custody|tahweel|divorce|talaq|khula|dissolution|judicial.*separation/.test(d)) return 'family case';
  if (/consumer|defective.*product|deficient.*service|unfair.*trade|warranty|guarantee|consumer.*court|consumer.*complaint/.test(d)) return 'consumer complaint';
  if (/\brent(s|ed|al)?\b|\brented premises\b|tenant|tenanc|landlord|evict|sublet|sub-let|security deposit|makan malik|kirayedar|qanoon-e-kirayadari|kirayadaar|kirayadaari|\bkiraya\b|makan.*khali/.test(d)) return 'tenancy dispute';
  if (/property.*transfer|sale.*deed|registry|inteqaal|mutation|intaqaal|gift.*deed|hiba|inheritance|virasat|succession/.test(d)) return 'property transfer';
  if (/(?:student|university|college).*appeal|appeal.*(?:result|exam|discipline|admission|expulsion|rustication)/.test(d)) return 'student appeal';
  return null;
}

export function getReadinessChecklist(description, opts = {}) {
  const isRoman = opts.preferredLanguage === 'roman_urdu';
  const generalMistakes = isRoman ? GENERAL_COMMON_MISTAKES.roman : GENERAL_COMMON_MISTAKES.en;
  const key = matchChecklistType(description);

  if (!key) {
    return {
      matched: false,
      label: null,
      items: [],
      requiredItems: [],
      optionalItems: [],
      readinessScore: 0,
      authority: null,
      studentSpecific: false,
      commonMistakes: generalMistakes,
      guidance: isRoman
        ? 'Is qism ke document ke liye koi specific checklist available nahi hai. Baraye meharbani document ka naam ya qisam wazeh karein. Neeche di gayi aam baatein har qism ki darkhast/file par lagu hoti hain.'
        : 'No specific checklist available for this document type. Please specify the document name or type more clearly. The cautions listed below apply to any filing, whatever the document type.',
      isOffline: true
    };
  }

  const cl = STUDENT_CHECKLISTS[key] || LEGAL_CHECKLISTS[key];
  if (!cl) {
    return {
      matched: false,
      label: null,
      items: [],
      requiredItems: [],
      optionalItems: [],
      readinessScore: 0,
      authority: null,
      studentSpecific: false,
      commonMistakes: generalMistakes,
      guidance: isRoman
        ? 'Is qism ke document ke liye koi specific checklist available nahi hai. Neeche di gayi aam baatein har qism ki darkhast/file par lagu hoti hain.'
        : 'No specific checklist available for this document type. The cautions listed below apply to any filing, whatever the document type.',
      isOffline: true
    };
  }
  const requiredItems = cl.items.filter(i => i.required);
  const optionalItems = cl.items.filter(i => !i.required);
  const readinessScore = Math.round((requiredItems.length / Math.max(cl.items.length, 1)) * 100);

  const guidance = isRoman
    ? `Yeh "${cl.label}" ke liye checklist hai. ${requiredItems.length} zaroori cheezein hain aur ${optionalItems.length} ikhtiari. Har zaroori item tayyar karein — na hone par application wapis ho sakti hai ya ruk sakti hai.`
    : `This is the checklist for a "${cl.label}". There are ${requiredItems.length} required items and ${optionalItems.length} optional. Prepare every required item — missing ones may cause your application to be returned or delayed.`;

  return {
    matched: true,
    label: cl.label,
    items: cl.items.map(i => ({ text: i.text, required: i.required })),
    requiredItems: requiredItems.map(i => i.text),
    optionalItems: optionalItems.map(i => i.text),
    readinessScore,
    authority: cl.authority,
    studentSpecific: cl.studentSpecific,
    commonMistakes: (LEGAL_COMMON_MISTAKES[key] || []).length ? LEGAL_COMMON_MISTAKES[key] : generalMistakes,
    guidance,
    isOffline: true
  };
}

