// Islamic Guidance mode: retrieval scope + answer composer.
//
// Two things are kept apart by construction:
//   * the Islamic layer (rag/indexes/islamic_index.json), produced only from text
//     this repository actually retrieved (see server/ingestIslamicSources.mjs);
//   * enacted Pakistani law, which is retrieved through the existing legal index
//     and the existing corrective evidence gate, unchanged.
// The Islamic layer is never merged into rag_index.json, and default-scope
// retrieval never reads it, so a legal question cannot pick up scripture and an
// Islamic question cannot be answered from a NADRA or passport record.
//
// Nothing in this file writes a verse, hadith text, grading, school position or
// statutory section that is not present in the retrieved record it quotes. Where
// the layer has no record, the composer says so.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RAGEngine } from './ragEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISLAMIC_INDEX_PATH = path.join(__dirname, '..', 'rag', 'indexes', 'islamic_index.json');

let islamicIndex = null;
function loadIslamicIndex() {
  if (islamicIndex) return islamicIndex;
  try {
    islamicIndex = fs.existsSync(ISLAMIC_INDEX_PATH)
      ? JSON.parse(fs.readFileSync(ISLAMIC_INDEX_PATH, 'utf8'))
      : { chunks: [] };
  } catch { islamicIndex = { chunks: [] }; }
  if (!Array.isArray(islamicIndex.chunks)) islamicIndex.chunks = [];
  return islamicIndex;
}

/**
 * Curated topic cues. Each entry names passages that exist in the retrieved
 * layer — a cue can never pull in a record the corpus does not hold. This is a
 * lookup table, not query fuzzing: it does not widen the candidate pool.
 */
const TOPICS = [
  { cues: /\b(fast|fasting|ramadan|roza|roze|sawm|fasts)\b|روزہ|رمضان/i, keys: ['2:183', '2:185', 'bukhari:8'] },
  { cues: /\b(prayer|salah|salat|namaz|pray\b)\b|نماز|صلاة/i, keys: ['2:43', 'bukhari:8'] },
  { cues: /\b(zakat|zakaat|charity|alms|dan)\b|زکوٰۃ|زکات/i, keys: ['2:43', 'bukhari:8'] },
  { cues: /\b(pillars?|arkan|basics of islam|five pillars)\b/i, keys: ['bukhari:8'] },
  { cues: /\b(debt|loan|borrow|qarz|witness|witnesses|contract in writing|writ\w*(\s+(it|them|the|a|down|up)){0,2}\s+contract|put in writing|agreement|likhit|dastawat)\b/i, keys: ['2:282'] },
  { cues: /\b(trade|trading|buy|sell|business|commerce|merchant|tijarat)\b/i, keys: ['4:29'] },
  { cues: /\b(justice|just|testimony|testify|fair|equity|adaalat|insaaf)\b/i, keys: ['4:58', '5:8'] },
  { cues: /\b(orphan|orphans|ward|minor.s property|yateem)\b/i, keys: ['17:34'] },
  { cues: /\b(equality|racism|race|tribe|nations|prejudice|superior|takwa|piety)\b/i, keys: ['49:13'] },
  { cues: /\b(intention|intent|niyyat|niyyah)\b/i, keys: ['bukhari:1'] },
  { cues: /\b(sincerity|ikhlas)\b/i, keys: ['muslim:55'] },
  { cues: /\b(socks|khuff|khuffs|masah|wiping over|ablution|wudu|ghalr|mojan)\b/i, keys: ['bukhari:206'], disputed: true },
  { cues: /\b(liar? about the prophet|fabricat\w+ hadith|fake hadith|jhoot|attribut\w+ to the prophet)\b/i, keys: ['muslim:1'] },
  { cues: /\b(tawakkul|rely|trust in allah|guard allah|protection|fate)\b/i, keys: ['tirmidhi:2516'] },

  // ---- Women's and family rights: mahr, maintenance, inheritance, marriage,
  // divorce, consent, treatment of spouses, children, family responsibilities.
  // Urdu-script alternatives are kept outside \b(...): \b is a word-boundary for
  // ASCII only and silently drops Arabic-script input.
  {
    cues: /\b(woman|women|wife|husband|spouse|zauj|bride|groom|mahr|dowry|jahez|haq mahr|consent|maintenance|nafaqa|inheritance|inherit|miras|talaaq|talaq|khula|divorce|razamand|children|child|aulad|bacche|bacchon|family|khandaan|gharwale|shohar|biwi|patni|kindness|aurat|khawateen|khawatin|orat)\b|عورت|عورتوں|خواتین|بیوی|شوہر|زوج|مہر|جہیز|نفقہ|ویراث|طلاق|خلع|رضامندی|بچے|بچوں|اولاد|خاندان/i,
    keys: ['4:19', '2:228', '2:233', '4:7', '4:11', 'tirmidhi:3895', 'bukhari:5185', 'bukhari:5136', 'bukhari:5971'],
  },
  {
    cues: /\b(rights|huqooq|haqooq|duty|duties|farz|zimmedari|responsibilit\w+)\b|حقوق|فرض|ذمہ داری/i,
    keys: ['4:19', '2:233', '49:13'],
  },
  // ---- Crimes, punishments, evidence, and hudud vs ta'zir.
  {
    cues: /\b(theft|thief|steal|stolen|chori|hudud|hadd|tazir|punishment|saza|penalty|sentence|evidence|testimony|witnesses|witness|shahadat|inquiry|verify|rumour)\b|چوری|سزا|حدود|تعزیر|گواہ|گواہی|ثبوت/i,
    keys: ['5:38', '49:6', 'bukhari:6783', 'bukhari:6787', 'bukhari:2667'],
  },
  // ---- Education and knowledge: seeking knowledge, students, teachers.
  {
    cues: /\b(education|student|students|study|school|college|university|teacher|professor|ustad|mualim|syllabus|curriculum|padhai)\b|تعلیم|طالب|طالبہ|استاد|تعليم|اسکول|کالج/i,
    keys: ['96:1', '20:114', '58:11'],
  },
  {
    cues: /\b(knowledge|seeking knowledge|taleem|padhai)\b|(?<![a-z])(ilm|taleem)(?![a-z])|علم|تعلیم/i,
    keys: ['96:1', '20:114', '58:11', 'ibnmajah:224', 'tirmidhi:2682'],
  },
  // ---- Financial and property matters: contracts, debts, repayment, measures,
  // property rights, false claims over land.
  {
    cues: /\b(property|estate|land|assets|asset|zamini|transaction|deal|measures|measure|weights|weigh|scale|defraud|cheat|fraud|repay|repayment|settlement|payment)\b|ملک|زمین|تول|ناپ|معاملہ/i,
    keys: ['83:1', '2:282', '4:29', 'bukhari:2667'],
  },
  {
    cues: /\b(guest|guests|hospitality|mehman|mehmaan|musafir|traveller|traveler)\b|مہمان|مسافر/i,
    keys: ['bukhari:2461'],
  },
  // ---- Islamic history: major ghazwat and their documented context/outcome.
  {
    cues: /\b(ghazwa|ghazwat|gharazat|gazwa|battle|conquest|fath|badr|uhud|khandaq|trench|hudaybiyyah|hudaibia|mecca|makka|sirah|seerah|caliph|sahabi|companions|history|historical|chronology|events|waqiat|waqeiat)\b|غزوہ|غزوات|لڑائی|جنگ|فتح|سیرت|تاریخ|واقعات|خلافت/i,
    keys: ['3:123'],
    docIds: ['history_sirah_events'],
  },

  { cues: /\b(cii|council of islamic ideology|islamic ideology)\b/i, docIds: ['cii_faqs'] },
  { cues: /\b(recommendation|advisory|is .* islamic law|enacted law|binding law|parliament|body\b)/i, docIds: ['cii_faqs'] },
  { cues: /\b(hanafi|shafi|maliki|hanbali|jafari|fiqh|madhhab|school of thought|mazhab|deeni maslak)\b/i, docIds: ['fiqh_seekersguidance'] },
  { cues: /\b(riba|interest|bank|banking|salary|wage|job|employment|income|earning|career|medical negligence|compensation|damage[s]? claim)\b/i, docIds: ['fiqh_seekersguidance'] },
  { cues: /\b(mahr|dowry|bride|groom|haq mahr|custom|cultural|inheritance|miras|estate)\b/i, docIds: ['fiqh_seekersguidance'] },
];

const STOP = new Set(['what', 'the', 'and', 'for', 'with', 'from', 'does', 'did', 'can', 'is', 'are', 'how', 'why', 'tell', 'please', 'about', 'that', 'this', 'have', 'has', 'not', 'all', 'them', 'they', 'when', 'which', 'who', 'will', 'your', 'its', 'hua', 'hai', 'ka', 'ki', 'ke', 'ko', 'mein', 'se', 'bhi', 'yeh', 'kya', 'toh', 'jun', 'kay',
  // measured this window: these four produced a two-word floor hit on a CII FAQ
  // for a sports question. They carry no subject by themselves.
  'final', 'last', 'year', 'years']);

function tokens(text) {
  return String(text || '').toLowerCase()
    .replace(/[^\w\s؀-ۿ]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP.has(t));
}

/**
 * Selects passages for the question. A passage qualifies when (a) a curated topic
 * names it, or (b) it shares at least two content words with the question. Two is
 * a floor, not a courtesy: a single shared word such as "law" would otherwise
 * attach every record in the layer to every question.
 */
export function retrieveIslamic(userQuery, { limit = 4 } = {}) {
  const idx = loadIslamicIndex();
  const chunks = idx.chunks;
  const byKey = new Map(chunks.map(c => [c.key, c]));
  const chosen = new Map();
  const qt = new Set(tokens(userQuery));
  const topics = [];
  for (const t of TOPICS) {
    if (!t.cues.test(userQuery)) continue;
    topics.push(t);
    for (const k of t.keys || []) {
      const c = byKey.get(k);
      if (c) chosen.set(c.id, { chunk: c, score: 3, via: 'topic' });
    }
    for (const d of t.docIds || []) {
      // Which three of this document is chosen by topic relevance, not by file
      // order: the fiqh and history documents hold many records and a blind
      // slice(0, 3) would forever surface the oldest three.
      const docChunks = chunks.filter(x => x.docId === d)
        .map(c => ({ c, n: [...qt].filter(w => new Set(tokens(`${c.chunkTitle} ${c.text}`)).has(w)).length }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 3);
      for (const { c } of docChunks) {
        if (!chosen.has(c.id)) chosen.set(c.id, { score: 3, chunk: c, via: 'topic' });
      }
    }
  }
  for (const c of chunks) {
    if (chosen.has(c.id)) continue;
    const ct = new Set(tokens(`${c.chunkTitle} ${c.text}`));
    let n = 0;
    for (const w of qt) if (ct.has(w)) n++;
    if (n >= 2) chosen.set(c.id, { chunk: c, score: n, via: 'lexical' });
  }
  const ranked = [...chosen.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  return {
    chunks: ranked.map(r => r.chunk),
    disputed: topics.some(t => t.disputed),
    topicHit: topics.length > 0,
    poolSize: chunks.length,
  };
}

const LAW_CUES = /\b(law|legal|act|statute|court|penal|enforce|enacted|parliament|constitution|qanoon|adalat|punjab|sindh|s.g\.o)\b/i;
export function asksAboutLaw(userQuery) {
  return LAW_CUES.test(String(userQuery || ''));
}

const H = (isRoman, en, roman) => isRoman ? roman : en;

/**
 * A question that asks only for one verse or one hadith must be answered with one
 * verse or one hadith — not with the full sectioned study. \b can only wrap the
 * ASCII forms (a word boundary does not exist around Urdu script), and it is
 * required there so "money" cannot match "one".
 */
const withBoundary = (alts) => alts.split('|')
  .map(a => /^[\x00-\x7F]+$/.test(a) ? `\\b(?:${a})\\b` : `(?:${a})`).join('|');

export function narrowRequestKind(userQuery) {
  const q = String(userQuery || '');
  const ONE = withBoundary('one|single|just|only|ek|aik|sirf|ایک|صرف');
  const VERSE = withBoundary('verses|verse|ayahs|ayah|ayaat|aayat|qur.an|quran|قرآن|آیات|آیت');
  const HADITH = withBoundary('hadith|hadees|hadis|حدیث|ہدیت');
  const win = '[^.?\\n]{0,24}?';
  const adjacent = (kind) => new RegExp(`(?:${ONE})${win}(?:${kind})|(?:${kind})${win}(?:${ONE})`, 'i').test(q);
  const verse = adjacent(VERSE), hadith = adjacent(HADITH);
  if (verse && !hadith) return 'AYAH';
  if (hadith && !verse) return 'HADITH';
  return null;
}

const asksAboutPunishment = (q) => /(?:\b(?:punishment|penalt|sentence|punish)\b)|saza|سزا|حدود?|ہد/i.test(String(q || ''));

// --- which legal records actually name the question's subject ---------------
// The evidence gate ranks by overlap, so a definitions section ("adult") can
// outrank the provision the question is about ("adultery"), or an unrelated
// hurt/qatl record can ride along on a shared word. Once the gate has accepted
// the retrieval, these helpers decide what may be *presented* — they never add,
// rescore or drop accepted evidence from the gate's own verdict.
const SUBJECT_STOP = new Set([
  'what', 'does', 'did', 'islam', 'islamic', 'muslim', 'muslims', 'pakistan', 'pakistani',
  'law', 'laws', 'legal', 'sharia', 'shariah', 'shariat', 'about', 'says', 'say', 'said',
  'give', 'tell', 'explain', 'please', 'there', 'their', 'this', 'that', 'with', 'from',
  'have', 'has', 'been', 'being', 'which', 'when', 'where', 'would', 'should', 'could',
  'into', 'also', 'regarding', 'position', 'perspective', 'view', 'views', 'situation',
  'matter', 'point', 'rules', 'rule', 'current', 'currently', 'today', 'under', 'over',
  'than', 'then', 'them', 'they', 'your', 'yours', 'question', 'answer', 'detail',
  'details', 'information', 'mean', 'means', 'meaning', 'according', 'work', 'works',
  'going', 'kaise', 'kya', 'kay', 'ka', 'ki', 'ke', 'mein', 'hai', 'hain', 'hoga',
  'gaya', 'gayi', 'bare', 'baray', 'mutaliq', 'sirf', 'only', 'just', 'bhi', 'aur',
  'and', 'for', 'the', 'are', 'can', 'may', 'must', 'how', 'why', 'who', 'whom',
  'whose', 'any', 'all', 'not', 'but', 'you', 'our', 'its', 'his', 'her', 'she',
  'him', 'one', 'two', 'both', 'more', 'most', 'such', 'some', 'other', 'very',
  'still', 'even', 'ever', 'never', 'always', 'often', 'because', 'before', 'after',
  'since', 'until', 'while', 'during', 'between', 'among', 'allah', 'quran', 'hadith',
  'hadees', 'verse', 'ayah', 'fiqh', 'fatwa', 'scholar', 'scholars', 'religion',
  'religious', 'ruling', 'punishment', 'penalty', 'sentence', 'enforce', 'enforceable',
  'enforced', 'application', 'applicable', 'applies', 'apply', 'procedure', 'process',
  'require', 'required', 'requirement', 'there', 'here', 'please', 'want', 'wants',
  'know', 'need', 'needs', 'help', 'tell', 'make', 'made', 'take', 'taken', 'give',
  'given', 'gets', 'getting', 'like', 'also', 'same', 'different', 'new', 'old',
  'karo', 'karein', 'karen', 'chahiye', 'chahye', 'batao', 'bataen', 'bataye',
  'setting', 'aside', 'said', 'held', 'order', 'orders', 'case', 'cases'
]);

/** The content words of the question, with Roman/Urdu forms glossed by the engine. */
function subjectTokens(userQuery) {
  const raw = String(userQuery || '');
  let normalized = '';
  try { normalized = RAGEngine.processQuery(raw).normalizedQuery || ''; } catch { normalized = ''; }
  const words = `${raw} ${normalized}`.toLowerCase().match(/[a-z]{4,}/g) || [];
  const out = [];
  for (const w of words) {
    if (SUBJECT_STOP.has(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out.slice(0, 10);
}

const hasWord = (hay, token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay);

/** Where the record names one of the question's subjects: its heading or only its text. */
export function lawNamesSubject(record, tokens) {
  if (!tokens.length) return { inHeading: false, inText: false };
  const heading = `${record.title || ''} ${record.chunkTitle || ''}`.toLowerCase();
  const inHeading = tokens.some(t => hasWord(heading, t));
  const inText = inHeading || tokens.some(t => hasWord(String(record.text || '').toLowerCase(), t));
  return { inHeading, inText };
}

/** The record's own operative wording, without repeating its heading twice. */
function lawLeadText(record) {
  const raw = String(record?.text || '').replace(/\r/g, '').trim();
  if (!raw) return '';
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const heading = String(record.chunkTitle || '').replace(/\.$/, '').trim().toLowerCase();
  if (lines.length > 1 && lines[0].replace(/\.$/, '').trim().toLowerCase() === heading) lines.shift();
  return lines.join(' ').replace(/\s+/g, ' ').slice(0, 220).trim();
}

/** A status caveat the record itself carries (e.g. a provision held unenforceable). */
function lawStatusNote(record) {
  const m = /Note:\s*([^\n]+)/.exec(String(record?.text || ''));
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

const ISLAMIC_SIDE = `(?:islam\\w*|qur'?an|quran|deen\\w*|shari[ae]h|shariat|religio\\w*)`;
const PAKISTAN_SIDE = `(?:pakistan\\w*|qanoon|law|legal|statute\\w*|court\\w*)`;
const wantsOnlyIslamicGuidance = (q) => new RegExp(
  `\\b(?:only|sirf|just|merely)\\s+(?:the\\s+)?${ISLAMIC_SIDE}\\b|\\b${ISLAMIC_SIDE}\\s+(?:only|sirf)\\b|\\b(?:no|not|without)\\s+(?:any\\s+)?(?:pakistan\\w*\\s+)?(?:law|qanoon|legal)\\b`,
  'i').test(String(q || ''));
const wantsOnlyPakistanLaw = (q) => !wantsOnlyIslamicGuidance(q) && new RegExp(
  `\\b(?:only|sirf|just|merely)\\s+(?:the\\s+)?${PAKISTAN_SIDE}\\b|\\b(?:pakistan\\w*\\s+law|qanoon)\\s+(?:only|sirf)\\b`,
  'i').test(String(q || ''));

/** The record's own wording, used as the direct answer instead of a paraphrase. */
function recordLeadSentence(c) {
  if (c.type === 'AYAH') return /Translation \(([^)]+)\): ([^\n]+)/.exec(c.text)?.[2] || '';
  if (c.type === 'HADITH') return /English: ([^\n]+)/.exec(c.text)?.[1] || '';
  if (c.type === 'FAQ') return /Answer \(as published by the Council\): ([^\n]+)/.exec(c.text)?.[1] || '';
  if (c.type === 'FIQH') return /Answer text \(as published\): ([^\n]+)/.exec(c.text)?.[1] || '';
  return /Summary as published: ([^\n]+)/.exec(c.text)?.[1] || '';
}

function citationOf(c) {
  if (c.type === 'AYAH') return `Qur’an ${c.key}`;
  if (c.type === 'HADITH') return `Hadith ${(/Reference: ([^\n|]+)/.exec(c.text)?.[1] || c.key).trim()}`;
  if (c.type === 'FAQ') return `Council of Islamic Ideology FAQ ${c.key}`;
  if (c.type === 'FIQH') return `Fiqh — ${c.school ? `${c.school} school` : 'publisher category'} (${c.key})`;
  return `History — ${c.key}`;
}

/** One record, printed the same way whether the answer is narrow or sectioned. */
function renderRecord(c, isRoman) {
  const quote = recordLeadSentence(c);
  if (c.type === 'AYAH') {
    const ar = /Arabic \(Uthmani[^:]*\): ([^\n]+)/.exec(c.text)?.[1];
    const tr = /Translation \(([^)]+)\): ([^\n]+)/.exec(c.text);
    return `- ${c.chunkTitle} [${c.key}]${ar ? `\n  Arabic: ${ar}` : ''}`
      + `${tr ? `\n  Translation (${tr[1]}): “${tr[2]}”` : ''}\n  Source: ${c.sourceURL}`;
  }
  if (c.type === 'HADITH') {
    const ref = /Reference: ([^\n|]+)/.exec(c.text)?.[1]?.trim() || c.key;
    const narr = /Narrator: ([^\n]+)/.exec(c.text)?.[1] || '';
    const gradeLine = c.grading
      ? `\n  Grading exactly as printed by the publisher on the cited page: ${c.grading}`
      : `\n  Grading: the cited page carries no grading statement, so none is claimed here (the beta hadith API requires a token that is not configured for this project).`;
    return `- ${ref}${narr ? ` — narrated ${narr}` : ''}\n  “${quote}”${gradeLine}\n  Source: ${c.sourceURL}`;
  }
  if (c.type === 'FIQH') {
    const scholar = /Answered by: ([^\n]+)/.exec(c.text)?.[1] || '';
    const approved = /Checked and approved by: ([^\n]+)/.exec(c.text)?.[1] || '';
    const category = /Category as published: ([^\n]+)/.exec(c.text)?.[1] || '';
    return `- ${c.school
      ? `${c.school} school — the school label is the publisher’s own category, “${category}”`
      : `Publisher category “${category}”; the publisher states no school, so none is attributed here`}`
      + `${scholar ? ` — answered by ${scholar}` : ''}${approved ? `, checked and approved by ${approved}` : ''}\n`
      + `  Question as published: ${c.chunkTitle}\n  “${quote}”\n  Source: ${c.sourceURL}`;
  }
  if (c.type === 'FAQ') {
    return `- CII FAQ ${c.key}: ${c.chunkTitle} — “${String(quote).slice(0, 320)}” [${c.sourceURL}]`;
  }
  const article = /Article title: ([^\n]+)/.exec(c.text)?.[1] || c.chunkTitle;
  const rev = /Revision timestamp: ([^\n]+)/.exec(c.text)?.[1] || '';
  return `- ${c.chunkTitle} (encyclopedia article: “${article}”)\n`
    + `  Summary as published: “${String(quote).slice(0, 400)}”\n`
    + `  Source: ${c.sourceURL}${rev ? ` (revision ${rev})` : ''}`;
}

/** Part 1 of the output contract: the answer itself, in the cited record's own words. */
function directAnswerBlock(top, isRoman, qualifier = '') {
  const said = String(recordLeadSentence(top) || '').replace(/\s+/g, ' ').trim();
  const body = said
    ? H(isRoman,
      `**Direct answer:** ${citationOf(top)} says — “${said.slice(0, 260)}”.${qualifier ? ` ${qualifier}` : ''}`,
      `**Seedha jawab:** ${citationOf(top)} yun kehta hai — “${said.slice(0, 260)}”.${qualifier ? ` ${qualifier}` : ''}`)
    : H(isRoman,
      `**Direct answer:** the verified layer’s closest record on this is ${citationOf(top)} (${top.chunkTitle}).${qualifier ? ` ${qualifier}` : ''}`,
      `**Seedha jawab:** verified layer ka is sawal se sab se qareebi record ${citationOf(top)} hai (${top.chunkTitle}).${qualifier ? ` ${qualifier}` : ''}`);
  return body;
}

const PUNISHMENT_NOTE = (isRoman) => H(isRoman,
  '**On punishment:** the jurisprudential conditions under which a physical penalty applied — competent authority, standard of proof, recognised defences and the right of appeal — are stated separately below from the enacted Pakistani provision that the evidence gate matched. Nothing here authorises anyone to carry out a punishment privately, only a court constituted under Pakistani law may impose one, and no outcome in a real case is guaranteed by this answer.',
  '**Sza ke barae mein:** jismani sza ke jo sharaie aur qanooni conditions hain — makhias authority (kaun sza de sakta hai), suboot ka mayaar, dafa ke huqooq aur apil ka haq — woh neeche enacted Pakistani qanoon se alag bataye gae hain, evidence gate jis provision tak mehdood raha. Yeh jawab kisi shakhs ko apni taraf se sza dene ki ijazat nahi deta; sza sirf Pakistan ke qanoon ke tehat qaim adalat de sakti hai, aur kisi haqeeqi case ke natijay ki koi zamandehi nahi di jaati.');

/**
 * Builds the answer from the retrieved passages only. `lawRetrieval` is the
 * untouched result of retrieveCorrected() over the legal index; when it holds no
 * accepted chunks, section E reports that instead of being written.
 */
export function composeIslamicAnswer({
  userQuery, isRoman = false, islamicChunks = [], disputed = false, lawChunks = [], lawUsed = false
}) {
  const idx = loadIslamicIndex();
  const total = idx.chunks.length;
  const out = [];
  const ayahs = islamicChunks.filter(c => c.type === 'AYAH');
  const hadiths = islamicChunks.filter(c => c.type === 'HADITH');
  const cii = islamicChunks.filter(c => c.type === 'FAQ');
  const fiqh = islamicChunks.filter(c => c.type === 'FIQH');
  const history = islamicChunks.filter(c => c.type === 'HISTORY');

  if (!islamicChunks.length && !(lawUsed && lawChunks.length)) {
    return {
      text: H(isRoman,
        `No passage in the Islamic source layer answers this question, so nothing is quoted here and no ruling is given.\n\n**Limitation**\nThe verified layer currently holds ${total} retrieved records (Qur'an verses, the hadith listed in the registry, Council of Islamic Ideology FAQ items, and the published fiqh answers named in the registry with the school each publisher states). It does not cover this topic. For a personal or consequential religious matter, consult a qualified scholar; for legal consequences, consult an advocate entitled to practise in the relevant jurisdiction.`,
        `Islamic source layer mein is sawal ka koi jawab mojood nahi, is liye yahan kuch bhi naql nahi kiya gaya na koi hukm diya gaya hai.\n\n**Boond**\nVerified layer mein abhi ${total} retrieved records hain (Qur’an ki ayaat, registry mein di gayi hadees, Council of Islamic Ideology ke FAQ, aur registry mein shamil published fiqh answers jin har ek par publisher ne apna mazhab likha hai). Is mauzay par cover nahi hai. Kisi shakhsi ya azeem deeni masle ke liye kisi qualified aalim se ruju karein; qanooni natijay ke liye mufakkik ilaqay mein kaam karne wale wakeel se mashwara karein.`),
      sources: [],
      verdict: 'none',
    };
  }

  out.push(H(isRoman, '**Islamic Guidance** — sourced from the verified Islamic source layer.',
    '**Islami Rahnumai** — jaanch-shuda Islamic source layer se.'));

  const kind = asksAboutLaw(userQuery) || lawUsed ? null : narrowRequestKind(userQuery);
  if (kind) {
    const wanted = islamicChunks.filter(c => c.type === kind);
    const what = kind === 'AYAH' ? { en: 'verse', ur: 'ayah' } : { en: 'hadith', ur: 'hadees' };
    if (wanted.length) {
      return {
        text: [
          out[0],
          directAnswerBlock(wanted[0], isRoman),
          renderRecord(wanted[0], isRoman),
          H(isRoman,
            `Only the ${what.en} you asked for is quoted here. The layer holds other records on this and adjacent subjects and they are left out of this answer, not because they are wrong but because you did not ask for them. This is a cited record reproduced for study — not a binding fatwa, and not a statement of Pakistani law.`,
            `Yahan sirf wahi ${what.ur} naql ki gayi jo aap ne maangi. Layer mein is aur qareebi mauzay par aur records hain jo is jawab mein shamil nahi kiye gaye — ghalat hone ki wajah se nahi, balke is liye ke aap ne unhein nahi maanga. Yeh taleemi taur par naql kiya gaya cited record hai — na bondi fatwa, aur na Pakistan ke qanoon ka bayan.`)
        ].join('\n\n'),
        sources: [wanted[0]],
        verdict: 'strong',
      };
    }
    return {
      text: [
        out[0],
        H(isRoman,
          `No ${what.en} in the verified Islamic source layer bears on this question, so none is quoted — and no other kind of record is substituted in its place. The layer holds ${total} retrieved records in all; this gap is stated rather than filled. For a personal religious matter, consult a qualified scholar.`,
          `Verified Islamic source layer mein is sawal se mutaliq koi ${what.ur} nahi, is liye koi naql nahi kiya gaya — aur na kisi dusre qism ka record us ki jagah diya gaya. Layer mein kul ${total} retrieved records hain; kami batayi gayi hai, bhari nahi gayi. Shakhsi deeni masle ke liye qualified aalim se ruju karein.`)
      ].join('\n\n'),
      sources: [],
      verdict: 'none',
    };
  }

  // Part 1 of the output contract, before any basis is listed: the answer itself.
  const top = ayahs[0] || hadiths[0] || fiqh[0] || cii[0] || history[0];
  if (top) out.push(directAnswerBlock(top, isRoman, disputed
    ? H(isRoman, 'This is a point on which recognised schools have differed — see the fiqh section below.',
      'Yeh us masle par hai jis par mazahib ikhtilaf karte aaye hain — fiqh section dekhen.')
    : ''));

  if (ayahs.length) {
    out.push(H(isRoman, '**A. Qur’an**', '**A. Qur’an**'));
    for (const c of ayahs) {
      const ar = /Arabic \(Uthmani[^:]*\): ([^\n]+)/.exec(c.text)?.[1];
      const tr = /Translation \(([^)]+)\): ([^\n]+)/.exec(c.text);
      out.push(`- ${c.chunkTitle} [${c.key}]${ar ? `\n  Arabic: ${ar}` : ''}`
        + `${tr ? `\n  Translation (${tr[1]}): “${tr[2]}”` : ''}`);
    }
  } else {
    out.push(`${H(isRoman, '**A. Qur’an**', '**A. Qur’an**')}\n- ${H(isRoman,
      'No verse in the retrieved layer addresses this specific point, so none is quoted.',
      'Retrieved layer mein is khaas masle se mutaliq koi ayah mojood nahi, is liye koi ayah naql nahi kiya gaya.')}`);
  }

  if (hadiths.length) {
    out.push(H(isRoman, '**B. Hadith**', '**B. Hadees**'));
    for (const c of hadiths) {
      const en = /English: ([^\n]+)/.exec(c.text)?.[1] || '';
      const ref = /Reference: ([^\n|]+)/.exec(c.text)?.[1]?.trim() || c.key;
      const narr = /Narrator: ([^\n]+)/.exec(c.text)?.[1] || '';
      const gradeLine = c.grading
        ? `\n  Grading exactly as printed by the publisher on the cited page: ${c.grading}`
        : `\n  Grading: the cited page carries no grading statement, so none is claimed here (the beta hadith API requires a token that is not configured for this project).`;
      out.push(`- ${ref}${narr ? ` — narrated ${narr}` : ''}\n  “${en}”${gradeLine}\n  Source: ${c.sourceURL}`);
    }
  } else {
    out.push(`${H(isRoman, '**B. Hadith**', '**B. Hadees**')}\n- ${H(isRoman,
      'No hadith in the retrieved layer bears on this question, so none is quoted.',
      'Retrieved layer mein is sawal se mutaliq koi hadees nahi, is liye koi hadees naql nahi ki gayi.')}`);
  }

  out.push(H(isRoman, '**C. Fiqh and recognised scholarly views**', '**C. Fiqh aur maanyay ulama ke Nazriyat**'));
  if (fiqh.length) {
    for (const c of fiqh) {
      const scholar = /Answered by: ([^\n]+)/.exec(c.text)?.[1] || '';
      const approved = /Checked and approved by: ([^\n]+)/.exec(c.text)?.[1] || '';
      const category = /Category as published: ([^\n]+)/.exec(c.text)?.[1] || '';
      const ans = /Answer text \(as published\): ([^\n]+)/.exec(c.text)?.[1] || '';
      out.push(`- ${c.school
        ? `${c.school} school — the school label is the publisher’s own category, “${category}”`
        : `Publisher category “${category}”; the publisher states no school, so none is attributed here`}`
        + `${scholar ? ` — answered by ${scholar}` : ''}${approved ? `, checked and approved by ${approved}` : ''}\n`
        + `  Question as published: ${c.chunkTitle}\n  “${ans}”\n  Source: ${c.sourceURL}`);
    }
    const schools = [...new Set(fiqh.map(c => c.school).filter(Boolean))];
    out.push(schools.length > 1
      ? H(isRoman,
        `The ${fiqh.length} published answers above come from ${schools.length} different schools (${schools.join(' and ')}). They are reproduced as each publisher states them; the sources do not agree with one another and no consensus is claimed. This layer does not cover every school of thought — it holds only what was retrieved.`,
        `Upar ke ${fiqh.length} published answers ${schools.length} mukhtalif mazahib (${schools.join(' aur ')}) se hain. Har ek jaisa publisher ne likha hai waisa hi naql kiya gaya hai — yeh makhaz aapas mein mutafiq nahi hain aur koi ittefaq ka dawa nahi kiya ja raha. Yeh layer har mazhab ko cover nahi karti, sirf retrieved material rakhti hai.`)
      : H(isRoman,
        `All the answers above come from the ${schools[0] || 'unnamed'} school as categorised by the publisher. Other schools’ positions on this point are not in the retrieved layer, so none is quoted, no consensus is claimed, and one school’s published view is not presented as universally agreed.`,
        `Upar ke tamam answers publisher ke mutabiq ${schools[0] || 'baghair naam'} mazhab se hain. Is masle par dusre mazahib ke moqifat retrieved layer mein nahi, is liye na koi diya gaya hai na koi ittefaq ka dawa — ek mazhab ka published moqif tamam ko lazim nahi samjha ja raha.`));
  }
  if (disputed) {
    out.push(H(isRoman,
      fiqh.length
        ? 'This is a point on which recognised schools have historically differed. The fiqh records above are positions published by the schools their publishers name — they do not settle this point, and no consensus is claimed. Present the difference to a qualified scholar for a ruling.'
        : 'This is a point on which recognised schools have historically differed. The retrieved layer holds the hadith text but contains no sourced statement of any school’s position on it, so no Hanafi, Shafi‘i, Maliki, Hanbali or Ja‘fari view is attributed here, and no consensus is claimed. Present the difference to a qualified scholar for a ruling.',
      fiqh.length
        ? 'Yeh us masle par hai jis par maanyay mazahib ikhtilaf karte aaye hain. Upar ke fiqh records apne apne publisher ke naam shuda mazahib ke moqifat hain — yeh is masle ko hal nahi karte aur koi ittefaq nahi. Farq kisi qualified aalim ke samne pesh karein.'
        : 'Yeh us masle par hai jis par maanyay mazahib ikhtilaf karte aaye hain. Retrieved layer mein sirf hadees ka matn hai, is masle par kisi bhi mazhab ki position ka source mojood nahi — is liye na Hanafi, Shafi‘i, Maliki, Hanbali ya Jafari nisbat di ja rahi hai na koi ittefaq ka dawa kiya ja raha hai. Hukm ke liye kisi qualified aalim se ruju karein.'));
  } else if (!fiqh.length) {
    out.push(H(isRoman,
      'The retrieved layer holds no fiqh or school-of-law material bearing on this question, so no scholarly opinion is attributed and no consensus is claimed here. (The layer does hold fiqh answers on other subjects; anything beyond the quoted texts would need a sourced scholarly work on this one.)',
      'Retrieved layer mein is sawal se mutaliq koi fiqh ya school-of-law material nahi, is liye na koi aalim ki raye nisbat ki ja rahi hai na koi ittefaq ka dawa. (Layer mein dusre mauzay par fiqh answers hain; naql kiye gaye matn se aage ki baat ke liye is mauzay par sourced scholarly zaroori hai.)'));
  }

  out.push(H(isRoman, '**D. Practical guidance**', '**D. Amali Hidayat**'));
  const plain = ayahs[0] || hadiths[0] || fiqh[0];
  out.push(plain
    ? H(isRoman,
      `In ordinary language, the passages above are quoted for study: ${plain.chunkTitle}. This is a general explanation of the cited text, not a personal religious ruling and not a fatwa.`,
      `Aam zabaan mein, yeh passages tafseel ke liye naql kiye gaye hain: ${plain.chunkTitle}. Yeh matn ki general tashreeh hai — na shakhsi deeni hukm hai aur na fatwa.`)
    : H(isRoman,
      'No general explanation is offered because no passage was retrieved for this question.',
      'Koi general tashreeh pesh nahi ki ja rahi kyunke is sawal par koi passage retrieve nahi hua.'));

  if (asksAboutPunishment(userQuery)) out.push(PUNISHMENT_NOTE(isRoman));

  if (asksAboutLaw(userQuery) || lawUsed) {
    out.push(H(isRoman, '**E. Pakistan law — separately**', '**E. Pakistan ka qanoon — alag taur par**'));
    if (lawChunks.length) {
      for (const c of lawChunks.slice(0, 3)) {
        out.push(`- ${c.title} — ${c.type} ${c.key}${c.chunkTitle ? ` (${c.chunkTitle})` : ''}: ${String(c.text).replace(/\s+/g, ' ').slice(0, 260)} [${c.sourceURL}]`);
      }
      out.push(H(isRoman,
        'Enacted law is cited here from the legal corpus and is separate from the verses and hadith above. A religious position does not by itself make a rule enforceable, and this assistant does not determine Sharia compliance of any statute.',
        'Yahan enacted law qanooni corpus se diya gaya hai aur upar ki ayaat aur hadees se alag hai. Koi deeni moqif khud-ba-khud zam Karnay qabili qanoon nahi banata, aur yeh assistant kisi qanoon ki shariat se mutabqat ka faisla nahi karta.'));
    } else {
      out.push(H(isRoman,
        'No enacted Pakistani provision in the legal corpus was matched to this question by the evidence gate, so none is cited. The gap is stated rather than filled.',
        'Evidence gate ne is sawal ke liye qanooni corpus mein koi enacted Pakistani provision match nahi kiya, is liye koi diya nahi gaya. Kami batayi gayi hai, bhari nahi.'));
    }
  }

  if (history.length) {
    out.push(H(isRoman,
      '**Recorded history — events, not rulings**',
      '**Tareekh — waqiat, hukm nahi**'));
    for (const c of history) {
      const article = /Article title: ([^\n]+)/.exec(c.text)?.[1] || c.chunkTitle;
      const summary = /Summary as published: ([^\n]+)/.exec(c.text)?.[1] || '';
      const rev = /Revision timestamp: ([^\n]+)/.exec(c.text)?.[1] || '';
      out.push(`- ${c.chunkTitle} (encyclopedia article: “${article}”)\n`
        + `  Summary as published: “${summary.slice(0, 400)}”\n`
        + `  Source: ${c.sourceURL}${rev ? ` (revision ${rev})` : ''}`);
    }
    out.push(H(isRoman,
      `These ${history.length} entries are tertiary summaries of events, reproduced from the cited article under its own text licence (CC BY-SA 4.0). Something that happened is not offered here as a ruling for today, is not a verse, hadith or fatwa, and is not a source of Pakistani law; the historical record does not establish what is currently lawful in a court.`,
      `Yeh ${history.length} entries kisi encyclopedia ke article se liye gaye tertiary summaries hain aur uske apne text licence (CC BY-SA 4.0) ke tehat naql kiye gaye hain. Jo guzar gaya use yahan aaj ka hukm nahi bataya ja raha, yeh ayah, hadees ya fatwa nahi hai, aur na yeh Pakistan ke qanoon ka makhaz hai — tareekh ka record yeh saabit nahi karta ke adalat mein abhi kya qanooni hai.`));
  }

  if (cii.length) {
    out.push(H(isRoman, '**Council of Islamic Ideology (advisory material)**', '**Council of Islamic Ideology (mashweri material)**'));
    for (const c of cii.slice(0, 2)) {
      const ans = /Answer \(as published by the Council\): ([^\n]+)/.exec(c.text)?.[1] || '';
      out.push(`- CII FAQ ${c.key}: ${c.chunkTitle} — “${ans.slice(0, 320)}” [${c.sourceURL}]`);
    }
    out.push(H(isRoman,
      'CII material is published by an advisory constitutional body. A CII recommendation or FAQ answer is not itself enacted law, and not an agreed ruling of all schools; whether a rule is enforceable in Pakistan depends on the enacted legislation, which is cited separately in section E.',
      'CII ka material ek advisory aini jism ki taraf se shaya hota hai. CII kiifarish ya FAQ ka jawab khud mein enacted law nahi hai aur tamam mazahib ka motabiq hukm bhi nahi; Pakistan mein usay zam karnay qabili hona enacted qanoon par depend karta hai, jo section E mein alag diya gaya hai.'));
  }

  out.push(H(isRoman, '**F. Sources and limitation**', '**F. Hawale aur Boond**'));
  const unverified = [];
  if (!hadiths.length) unverified.push(H(isRoman, 'no hadith retrieved', 'koi hadees retrieve nahi hui'));
  if (asksAboutLaw(userQuery) && !lawChunks.length) unverified.push(H(isRoman, 'no enacted provision matched', 'koi enacted provision match nahi hui'));
  out.push(H(isRoman,
    `Verified sources used: ${[...new Set([...ayahs, ...hadiths, ...cii, ...fiqh, ...history].map(c => c.sourceURL))].join(', ') || 'none'}. `
    + `Not verified or not covered here: ${unverified.length ? unverified.join('; ') : 'the quoted passages themselves are retrieved records'}. `
    + 'This is educational guidance drawn from cited sources, not a binding fatwa, and not a substitute for a qualified scholar or for legal advice from an advocate entitled to practise in the relevant jurisdiction. It does not judge any person’s faith.',
    `Jaanch-shuda makhaz: ${[...new Set([...ayahs, ...hadiths, ...cii, ...fiqh, ...history].map(c => c.sourceURL))].join(', ') || 'koi nahi'}. `
    + `Jaanch nahi ho saka ya cover nahi hua: ${unverified.length ? unverified.join('; ') : 'naql kiye gaye passages khud retrieved records hain'}. `
    + 'Yeh cited makhaz se taleemi hidayat hai, na bondi fatwa hai, aur na kisi qualified aalim ya relevant ilaqay ke wakeel se mashwaray ka badal. Yeh kisi shakhs ke imaan ke baray mein koi faisla nahi karti.'));

  return { text: out.join('\n\n'), sources: islamicChunks, verdict: islamicChunks.length ? (ayahs.length || hadiths.length ? 'strong' : 'weak') : 'none' };
}

/**
 * Combined view: the SAME question answered from two separate evidence paths.
 * Section A is built only from the Islamic layer, section B only from records the
 * legal evidence gate accepted, and section C states what is still missing. A verse
 * is never offered as proof that a statute exists, and a statute is never offered
 * as a religious ruling. Where one path has no verified evidence, that side is
 * disclosed as a gap rather than filled.
 */
export function composeCombinedAnswer({
  userQuery, isRoman = false, islamicChunks = [], disputed = false, lawChunks = [], lawUsed = true,
  lawVerdict = null, lawDomain = null, islamicTopicHit = true, answerLevel = null
}) {
  // Depth only: the evidence gate has already decided what is supported, and the
  // same records, caveats and limitations are kept at every level. "beginner"
  // shortens presentation (one record per source type, two law records, shorter
  // quotations, no explanatory re-statements) instead of dropping qualifications.
  const brief = answerLevel === 'beginner' || answerLevel === 'short';
  const idx = loadIslamicIndex();
  const total = idx.chunks.length;
  const q = String(userQuery || '');
  const onlyLaw = wantsOnlyPakistanLaw(q);
  const onlyIslamic = !onlyLaw && wantsOnlyIslamicGuidance(q);
  const islamicPool = onlyLaw ? [] : islamicChunks;
  const ayahs = islamicPool.filter(c => c.type === 'AYAH');
  const hadiths = islamicPool.filter(c => c.type === 'HADITH');
  const fiqh = islamicPool.filter(c => c.type === 'FIQH');
  const cii = islamicPool.filter(c => c.type === 'FAQ');
  const history = islamicPool.filter(c => c.type === 'HISTORY');

  // Presentation filter only: the gate's verdict and accepted set stay as they
  // are. A definitions section or a neighbouring offence can share one word with
  // the question; it is not shown unless its own text names what was asked about.
  const requestedLaw = onlyIslamic ? [] : (lawChunks || []);
  const tokens = subjectTokens(q);
  // A weak gate verdict may only be shown when the record's own heading names the
  // subject; one shared word in the body of an unrelated instrument is not evidence.
  const named = requestedLaw.filter(c => {
    const where = lawNamesSubject(c, tokens);
    return lawVerdict === 'strong' ? where.inText : where.inHeading;
  });
  const headed = named.filter(c => lawNamesSubject(c, tokens).inHeading);
  const onSubject = headed.length ? headed : named;
  const omittedLaw = requestedLaw.length - onSubject.length;
  // A weak match that names nothing the user asked about is a gap, not evidence.
  // A STRONG verdict does not make an unnamed record evidence either: the record
  // still has to name the subject in its own words to be shown as law on it.
  const law = onSubject.slice(0, brief ? 2 : 4);
  const islamicStrong = Boolean(ayahs.length || hadiths.length || fiqh.length || cii.length || history.length);

  if (!islamicStrong && !law.length) {
    return {
      text: H(isRoman,
        `Neither evidence path supports an answer to this question, so nothing is cited here.\n\n- **Islamic perspective**: the verified Islamic source layer holds ${total} retrieved records and none of them bears on this question, so no verse, hadith or scholarly opinion is quoted.\n- **Pakistani law**: the legal evidence gate matched no enacted provision or case authority to this question, so none is cited.\n\nThe gaps are stated rather than filled. For a personal religious matter consult a qualified scholar; for legal consequences consult an advocate entitled to practise in the relevant jurisdiction.`,
        `Koi bhi evidence path is sawal ka jawab dene ke liye kafi nahi, is liye yahan kuch cite nahi kiya gaya.\n\n- **Deeni nazriya**: verified Islamic source layer mein ${total} retrieved records hain, in mein se koi is sawal se mutaliq nahi — is liye na ayah, na hadees, na ulama ki raye naql ki gayi.\n- **Pakistan ka qanoon**: legal evidence gate ne is sawal ke liye koi enacted provision ya case authority match nahi kiya, is liye koi nahi diya gaya.\n\nKamiyan batayi gayi hain, bhari nahi gayi hain. Shakhsi deeni masle ke liye qualified aalim se aur qanooni natijay ke liye mufakkik ilaqay ke wakeel se ruju karein.`),
      sources: [],
      islamicSources: [],
      lawSources: [],
      verdict: 'none',
    };
  }

  const out = [];
  if (brief) {
    // Retrieval order is not relevance order. Before a short answer keeps only
    // one verse, put the passage that actually names the asked subject first —
    // an inheritance question must lead with the shares verse, not whichever
    // Nisa passage scored highest on general wording.
    const subjectScore = c => {
      const hay = String(c.text || '').toLowerCase();
      return tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
    };
    for (const list of [ayahs, hadiths, fiqh, cii, history]) list.sort((a, b) => subjectScore(b) - subjectScore(a));
  }
  const islamicTop = ayahs[0] || hadiths[0] || fiqh[0] || cii[0] || history[0];
  // A record reached only by word overlap is not the answer's lead: the question
  // gets "the layer has no record on this", not an unrelated passage in first place.
  const islamicLead = islamicTopicHit ? islamicTop : (ayahs[0] || hadiths[0] || null);
  if (brief) {
    ayahs.splice(1); hadiths.splice(1); fiqh.splice(1); cii.splice(1); history.splice(1);
    // Short answers quote the primary text only. Published fiqh/FAQ records are
    // depth, and they remain in the full answer at the same evidence rules.
    if (ayahs.length || hadiths.length) { fiqh.splice(0); cii.splice(0); }
    // When no curated topic matched, the records share wording only and the
    // direct answer says so; quoting them at length in a short answer would
    // present unrelated material as if it addressed the question. The lead is
    // still resolved above so the disclosure keeps saying a record was returned.
    if (!islamicTopicHit) { ayahs.splice(0); hadiths.splice(0); fiqh.splice(0); cii.splice(0); history.splice(0); }
  }
  const lawTop = law[0];
  if (islamicLead || islamicTop || lawTop) {
    const relClause = islamicLead
      ? H(isRoman, `on the religious side, ${citationOf(islamicLead)} says — “${String(recordLeadSentence(islamicLead)).replace(/\s+/g, ' ').slice(0, 200)}”`,
        `deeni pehlu mein ${citationOf(islamicLead)} ki nass section A mein jaisi retrieved hui waisi naql ki gayi hai`)
      : H(isRoman, islamicTop
        ? 'the verified Islamic layer holds no curated record answering this question; the one it returned shares wording only and is not quoted here as an answer'
        : 'the verified Islamic layer holds no verse, hadith or published opinion bearing on this question, so nothing is quoted or substituted from it',
      islamicTop
        ? 'verified Islamic layer mein is sawal ka jawab dene wala koi curated record nahi; jo record mila woh sirf alfaaz share karta hai aur yahan jawab ke taur par naql nahi kiya gaya'
        : 'verified Islamic layer mein is sawal se mutaliq koi ayah, hadees ya published raye nahi, is liye us se kuch naql ya badal nahi kiya gaya');
    const legalNote = lawTop ? lawStatusNote(lawTop) : '';
    const lawClause = lawTop
      ? H(isRoman, `on the law side, ${lawTop.title}${lawTop.key ? `, ${lawTop.type || 'section'} ${lawTop.key}` : ''} (“${lawTop.chunkTitle || lawTop.title}”) provides — “${lawLeadText(lawTop)}”${legalNote ? ` The record itself adds: ${legalNote}` : ''}${lawVerdict && lawVerdict !== 'strong' ? ` The evidence gate rates this a ${lawVerdict} match, not a settled provision.` : ''}`,
        `aur qanooni pehlu mein ${lawTop.title}${lawTop.key ? `, ${lawTop.type || 'section'} ${lawTop.key}` : ''} (“${lawTop.chunkTitle || lawTop.title}”) ka matn section B mein record ke apne alfaaz mein diya gaya hai${legalNote ? `; record ka apna status caveat: ${legalNote}` : ''}${lawVerdict && lawVerdict !== 'strong' ? ` Evidence gate isay ${lawVerdict} match kehta hai, tay shuda provision nahi.` : ''}`)
      : H(isRoman, onlyIslamic
        ? 'and the Pakistani-law side is left out at your request, so no statute or case authority is cited here'
        : 'and the legal evidence gate matched no provision or case authority, so none is cited',
      onlyIslamic
        ? 'aur Pakistan ke qanoon ka pehlu aap ki darkhwast par shamil nahi kiya gaya, is liye yahan koi statute ya case authority cite nahi ki gayi'
        : 'aur legal evidence gate ne koi provision ya case authority match nahi kiya, is liye koi nahi diya gaya');
    out.push(H(isRoman,
      `**Direct answer:** ${relClause}; ${lawClause}. These are separate evidence and are read together, not merged.`,
      `**Seedha jawab:** ${relClause}; ${lawClause}. Yeh alag alag makhaz hain — sath parhe jaate hain, milaye nahi jaate.`));
  }

  if (onlyLaw) {
    out.push(H(isRoman,
      'You asked for the Pakistani legal position only. The Islamic side is therefore not answered or quoted here; nothing on this page is a religious ruling.',
      'Aap ne sirf Pakistan ke qanooni pehlu ka sawal kiya. Is liye deeni pehlu yahan na jawab diya gaya na naql kiya gaya; is safhay par koi deeni hukm nahi.'));
  }
  if (onlyIslamic) {
    out.push(H(isRoman,
      'You asked for the Islamic position only. The Pakistani-law side is therefore not retrieved or cited here; what follows is not a statement of enforceable law.',
      'Aap ne sirf deeni pehlu ka sawal kiya. Is liye Pakistan ke qanoon ka pehlu yahan na retrieve kiya gaya na cite kiya gaya; aage jo hai woh nafiz qanoon ka bayan nahi.'));
  }

  if (!brief) out.push(H(isRoman,
    'What follows is two separate evidence paths: section A quotes only the verified Islamic source layer and section B quotes only records the legal evidence gate accepted. They are read together and not merged.',
    'Aage do alag makhaz hain: section A sirf verified Islamic source layer se naql karta hai aur section B sirf un records se jo legal evidence gate ne qubool kiye. Dono sath parhe jaate hain, milaye nahi jaate.'));

  // --- A. Islamic perspective ------------------------------------------------
  if (!onlyLaw) {
  out.push(H(isRoman, '**A. Islamic perspective**', '**A. Deeni Nazriya**'));
  if (!islamicTopicHit) {
    out.push(H(isRoman,
      'Match quality: no curated topic in the Islamic layer matches this question; the records below share wording with it and are quoted as retrieved, not as an answer to it. Treat this side as not covered.',
      'Match ki khubi: Islamic layer ka koi curated topic is sawal se match nahi karta; neeche diye gaye records sirf alfaaz milne ki wajah se shamil hue hain aur jaisay retrieve huay waisay naql kiye gaye hain — yeh is sawal ka jawab nahi samjha jaye. Is pehlu ko cover shuda na samjhen.'));
  }
  const absent = [];
  if (ayahs.length) {
    for (const c of ayahs) {
      const ar = /Arabic \(Uthmani[^:]*\): ([^\n]+)/.exec(c.text)?.[1];
      const tr = /Translation \(([^)]+)\): ([^\n]+)/.exec(c.text);
      out.push(`- Qur’an ${c.key} — ${c.chunkTitle}${ar ? `\n  Arabic: ${ar}` : ''}`
        + `${tr ? `\n  Translation (${tr[1]}): “${tr[2]}”` : ''}\n  Source: ${c.sourceURL}`);
    }
  } else absent.push(H(isRoman, 'no verse in the retrieved layer addresses this point',
    'retrieved layer mein is masle se mutaliq koi ayah nahi'));
  if (hadiths.length) {
    for (const c of hadiths) {
      const en = /English: ([^\n]+)/.exec(c.text)?.[1] || '';
      const ref = /Reference: ([^\n|]+)/.exec(c.text)?.[1]?.trim() || c.key;
      const narr = /Narrator: ([^\n]+)/.exec(c.text)?.[1] || '';
      const gradeLine = c.grading
        ? `\n  Grade exactly as printed by the publisher on the cited page: ${c.grading}`
        : `\n  Grade: the cited page carries no grading statement, so none is claimed here.`;
      out.push(`- Hadith ${ref}${narr ? ` — narrated ${narr}` : ''}\n  “${en}”${gradeLine}\n  Source: ${c.sourceURL}`);
    }
  } else absent.push(H(isRoman, 'no hadith in the retrieved layer bears on this question',
    'retrieved layer mein is sawal se mutaliq koi hadees nahi'));
  if (fiqh.length) {
    for (const c of fiqh) {
      const scholar = /Answered by: ([^\n]+)/.exec(c.text)?.[1] || '';
      const approved = /Checked and approved by: ([^\n]+)/.exec(c.text)?.[1] || '';
      const category = /Category as published: ([^\n]+)/.exec(c.text)?.[1] || '';
      const ans = /Answer text \(as published\): ([^\n]+)/.exec(c.text)?.[1] || '';
      out.push(`- Fiqh — ${c.school
        ? `${c.school} school (the school label is the publisher’s own category, “${category}”)`
        : `publisher category “${category}”; no school is stated, so none is attributed`}`
        + `${scholar ? ` — answered by ${scholar}` : ''}${approved ? `, checked and approved by ${approved}` : ''}\n`
        + `  Question as published: ${c.chunkTitle}\n  “${ans}”\n  Source: ${c.sourceURL}`);
    }
    const schools = [...new Set(fiqh.map(c => c.school).filter(Boolean))];
    out.push(schools.length > 1
      ? H(isRoman,
        `These ${fiqh.length} published answers come from ${schools.length} different schools (${schools.join(' and ')}). They differ, no consensus is claimed, and this layer holds only what was retrieved — it does not cover every school of thought.`,
        `Yeh ${fiqh.length} published answers ${schools.length} mukhtalif mazahib (${schools.join(' aur ')}) se hain. Yeh ikhtilaf karte hain, koi ittefaq ka dawa nahi kiya ja raha, aur yeh layer sirf retrieved material rakhti hai — har mazhab ko cover nahi karti.`)
      : H(isRoman,
        `These answers come from the ${schools[0] || 'unnamed'} school as categorised by the publisher. Other schools’ positions are not in the retrieved layer, so none is quoted, no consensus is claimed, and one school’s published view is not presented as universally agreed.`,
        `Yeh answers publisher ke mutabiq ${schools[0] || 'baghair naam'} mazhab se hain. Dusre mazahib ke moqifat retrieved layer mein nahi, is liye na diya gaya na koi ittefaq ka dawa — ek mazhab ka published moqif sab par lazim nahi samjha ja raha.`));
  } else absent.push(H(isRoman, 'no school-of-law material bears on this question',
    'is sawal se mutaliq koi school-of-law material nahi'));
  if (absent.length) {
    out.push(H(isRoman,
      `Not quoted from this path, because the verified layer does not hold it: ${absent.join('; ')}. Nothing is substituted in its place and no grade or scholarly opinion is claimed on those points.`,
      `Is path se kuch naql nahi kiya gaya kyunke verified layer mein yeh mojood nahi: ${absent.join('; ')}. Is ki jagah kuch nahi diya gaya aur in nuqtaat par na koi grade na ulama ki raye ka dawa kiya jaata hai.`));
  }
  if (cii.length) {
    for (const c of cii.slice(0, 2)) {
      const ans = /Answer \(as published by the Council\): ([^\n]+)/.exec(c.text)?.[1] || '';
      out.push(`- Council of Islamic Ideology FAQ ${c.key}: ${c.chunkTitle} — “${ans.slice(0, 320)}”\n  Source: ${c.sourceURL} (advisory body; not itself enacted law)`);
    }
  }
  if (history.length) {
    for (const c of history) {
      const article = /Article title: ([^\n]+)/.exec(c.text)?.[1] || c.chunkTitle;
      const summary = /Summary as published: ([^\n]+)/.exec(c.text)?.[1] || '';
      const rev = /Revision timestamp: ([^\n]+)/.exec(c.text)?.[1] || '';
      out.push(`- History — ${c.chunkTitle} (encyclopedia article “${article}”, text licence CC BY-SA 4.0)\n`
        + `  Summary as published: “${summary.slice(0, 400)}”\n`
        + `  Source: ${c.sourceURL}${rev ? ` (revision ${rev})` : ''}`);
    }
    out.push(H(isRoman,
      `These ${history.length} history entries are tertiary summaries of events. Something that happened is not presented as a ruling for today, is not a verse, hadith or fatwa, and is not Pakistani law — the enacted position, if any, appears only in section B.`,
      `Yeh ${history.length} history entries waqiat ki tertiary summaries hain. Jo guzar gaya use aaj ka hukm nahi bataya ja raha, yeh ayah, hadees ya fatwa nahi, aur na Pakistan ka qanoon hai — mojooda enacted position sirf section B mein aati hai.`));
  }
  if (disputed) {
    out.push(H(isRoman,
      'This is a point on which recognised schools have historically differed. The records above do not settle it and no consensus is claimed; a ruling on it needs a qualified scholar.',
      'Yeh us masle par hai jis par maanyay mazahib ikhtilaf karte aaye hain. Upar ke records isay hal nahi karte aur koi ittefaq nahi — hukm ke liye qualified aalim zaroori hai.'));
  }
  const plain = ayahs[0] || hadiths[0] || fiqh[0];
  if (!brief) out.push(plain
    ? H(isRoman,
      `In plain terms, from the cited text: ${plain.chunkTitle}. This is a general explanation of retrieved source text for study — not a personal religious ruling and not a fatwa.`,
      `Aam zabaan mein, cited matn se: ${plain.chunkTitle}. Yeh retrieved matn ki general tashreeh hai — na shakhsi deeni hukm, na fatwa.`)
    : H(isRoman,
      'No practical religious explanation is offered, because no Islamic passage was retrieved for this question.',
      'Koi amali deeni tashreeh nahi di ja rahi, kyunke is sawal par koi Islamic passage retrieve nahi hua.'));

  }

  const penaltyInQuote = /amputat|stoning|stoned|flogg|lashes|cut (?:off|them off)|qisas|death as|hadd|hudud/i
    .test(String(islamicLead ? recordLeadSentence(islamicLead) : ''));
  if (asksAboutPunishment(userQuery) || penaltyInQuote) out.push(PUNISHMENT_NOTE(isRoman));

  // --- B. Pakistani law ------------------------------------------------------
  if (!onlyIslamic) {
  out.push(H(isRoman, '**B. Pakistani law**', '**B. Pakistan ka qanoon**'));
  if (law.length) {
    out.push(H(isRoman,
      `Evidence gate classification: ${lawVerdict || 'unrated'} match${lawDomain ? ` in domain ${lawDomain}` : ''}.`
      + (lawVerdict && lawVerdict !== 'strong'
        ? ' This is a WEAK match: the records below are the closest the legal corpus holds, not a settled provision on this question, and the legal side of this answer is therefore weakly supported.'
        : ''),
      `Evidence gate classification: ${lawVerdict || 'unrated'} match${lawDomain ? ` domain ${lawDomain}` : ''}.`
      + (lawVerdict && lawVerdict !== 'strong'
        ? ' Yeh WEAK match hai: neeche ke records qanooni corpus ke sab se qareebi mojoodaat hain, is sawal ka tay shuda provision nahi — is liye qanooni pehlu kamzor support rakhta hai.'
        : '')));
  }
  if (law.length) {
    for (const c of law) {
      out.push(`- ${c.title} — ${c.documentType || 'record'}, ${c.type} ${c.key}`
        + `${c.chunkTitle ? ` (${c.chunkTitle})` : ''}\n`
        + `  Jurisdiction: ${c.jurisdiction || 'not stated on the record'} · Issuing authority: ${c.issuingAuthority || 'not stated on the record'} · Status: ${c.legalStatus || 'not stated on the record'}\n`
        + `${lawStatusNote(c) ? `  Status caveat on the record: ${lawStatusNote(c)}\n` : ''}`
        + `  What the retrieved record says: ${String(c.text).replace(/\s+/g, ' ').slice(0, brief ? 160 : 300)}\n`
        + `  Source: ${c.sourceURL}`);
    }
    if (omittedLaw > 0) out.push(H(isRoman,
      `The evidence gate also accepted ${omittedLaw} further legal record(s) whose own text does not name this question’s subject. They are not presented here: sharing a word with the question is not support for it.`,
      `Evidence gate ne ${omittedLaw} mazeed qanooni records bhi qubool kiye jin ke apne matn mein is sawal ka mauzu nahi aata. Woh yahan pesh nahi kiye gaye: sawal se ek lafz milna us ka support nahi hai.`));
    out.push(H(isRoman,
      'This section is enacted law and case authority from the legal corpus only. Its limits still apply: it is quoted as retrieved, it does not decide your particular case, and the province or forum that governs depends on facts not supplied here.',
      'Yeh section sirf qanooni corpus ka enacted qanoon aur case authority hai. Is ki hudood barkarar: jaisa retrieve hua waisa hi naql kiya gaya, yeh aap ka khaas case faisla nahi karta, aur kaunsa ilaqay ya forum haakim hai yeh yahan na diye gaye facts par depend karta hai.'));
  } else {
    out.push(H(isRoman,
      `No enacted Pakistani provision or case authority was matched to this question by the legal evidence gate${lawUsed ? '' : ' (no legal retrieval was run for this question)'}, so none is cited. The gap is stated rather than filled.`,
      `Legal evidence gate ne is sawal ke liye koi enacted Pakistani provision ya case authority match nahi kiya${lawUsed ? '' : ' (is sawal ke liye legal retrieval chalayi hi nahi gayi)'}, is liye koi nahi diya gaya. Kami batayi gayi hai, bhari nahi.`));
  }
  out.push(H(isRoman,
    brief
      ? 'The two paths are separate evidence: a position in section A is not a rule of Pakistani law, and a provision in section B is not a religious ruling. They are not merged.'
      : 'The two paths above are separate evidence. A religious position quoted in section A is not presented as a rule of Pakistani law, and an enacted provision in section B is not presented as a religious ruling. Where they point in different directions, both are shown as retrieved and the difference is left open rather than reconciled.',
    brief
      ? 'Dono paths alag makhaz hain: section A ka moqif Pakistan ke qanoon ka rule nahi, aur section B ka provision deeni hukm nahi. Yeh milaye nahi jaate.'
      : 'Upar ke do paths alag makhaz hain. Section A ka deeni moqif Pakistan ke qanoon ka rule pesh nahi karta, aur section B ka enacted qanoon deeni hukm pesh nahi karta. Jahan yeh alag direction mein jaate hain, wahan dono jaisay retrieve huay waisay dikhaye jaate hain aur farq ko khula rakha jaata hai, mashkook nahi kiya jaata.'));
  }

  // --- C. Practical next steps ----------------------------------------------
  out.push(H(isRoman, '**C. Practical next steps**', '**C. Amali Qadamaat**'));
  const missing = [];
  if (!islamicStrong && !onlyLaw) missing.push(H(isRoman,
    'no verified Islamic source for this topic in the layer', 'layer mein is mauzay ka koi verified Islamic source nahi'));
  if (!law.length) missing.push(H(isRoman,
    'no enacted provision or case authority matched by the evidence gate', 'evidence gate ka koi enacted provision ya case authority match nahi'));
  out.push(H(isRoman,
    `- Facts or documents still needed: the identity of the parties and their legal capacity, dates and any written agreement or decree, the district and province the matter sits in, and whether any court or council proceeding has already been started.${missing.length ? ` Not established from evidence here: ${missing.join('; ')}.` : ''}`,
    `- Abhi darkaar facts ya documents: tarafon ki shanakht aur unki ahliyat, tareekhen, likhit agreement ya decree zair-nazar, ilaqay aur sooba jahan masla hai, aur yeh ke adalat ya council ka koi maamla shuru to nahi ho chuka.${missing.length ? ` Yahan evidence se sabit nahi hua: ${missing.join('; ')}.` : ''}`));
  if (!onlyIslamic) out.push(H(isRoman,
    '- Take the cited records, not a summary, to a qualified advocate entitled to practise in that jurisdiction before acting; outcome depends on facts and forum, and nothing here guarantees a result.',
    '- Amal se pehle cited records (khullasa nahi) us ilaqay mein kaam karne wale qualified wakeel ke paas le jayen; natija facts aur forum par depend karta hai aur yeh jawab koi kaamyaabi ki zamandehi nahi karta.'));
  if (!onlyLaw) out.push(H(isRoman,
    '- For the religious side, put the question with your own circumstances to a qualified scholar; a scholar may weigh a school position that this retrieved layer does not hold.',
    '- Deeni pehlu apne shakhsi halaat ke saath kisi qualified aalim ke samne pesh karein; aalim us mazhab ka moqif bhi tarajh kar sakta hai jo is retrieved layer mein mojood nahi.'));

  out.push(H(isRoman, '**Sources and limitation**', '**Hawale aur Boond**'));
  out.push(H(isRoman,
    `Islamic records: ${[...new Set([...ayahs, ...hadiths, ...fiqh, ...cii].map(c => c.sourceURL))].join(', ') || (onlyLaw ? 'not requested — the Islamic path was left out at your request' : 'none')}. Legal records: ${[...new Set(law.map(c => c.sourceURL))].join(', ') || (onlyIslamic ? 'not requested — the legal path was left out at your request' : 'none')}. Educational answer from cited, retrieved records — not a binding fatwa and not a substitute for a qualified scholar or an advocate.`
    ,
    `Islamic records: ${[...new Set([...ayahs, ...hadiths, ...fiqh, ...cii].map(c => c.sourceURL))].join(', ') || 'koi nahi'}. Qanooni records: ${[...new Set(law.map(c => c.sourceURL))].join(', ') || 'koi nahi'}. Cited retrieved records se taleemi jawab — na bondi fatwa, na qualified aalim ya wakeel ka badal.`));

  const islamicSources = [...ayahs, ...hadiths, ...fiqh, ...cii];
  const islamicMatched = islamicStrong && islamicTopicHit;
  const lawMatched = law.length > 0 && (!lawVerdict || lawVerdict === 'strong');
  return {
    text: out.join('\n\n'),
    sources: [...islamicSources, ...law],
    islamicSources,
    lawSources: law,
    verdict: islamicMatched && lawMatched ? 'strong' : ((islamicStrong || law.length) ? 'weak' : 'none'),
  };
}
