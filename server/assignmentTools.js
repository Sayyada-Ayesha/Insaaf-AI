// Student assignment workspace (Phase 2 §B).
//
// A student pastes the actual brief; this module reads the requirements out of
// that text, builds a research outline and a draft scaffold, and attaches to each
// section only the records the corpus actually holds. Three rules are structural:
//
//   * a citation is emitted only when a retrieved record carries it, together with
//     that record's own source URL and status metadata — no reference is ever
//     written here, and a section with no matched record says it has none;
//   * anything the brief did not state is reported as unconfirmed instead of being
//     guessed, because the instructor's brief is the authority on its own rules;
//   * the output is a scaffold with the student's argument left to be written, and
//     carries an academic-integrity notice. It is not a submitted essay and is not
//     represented as independently verified scholarship.

import { RAGEngine } from './ragEngine.js';

const STYLES = /\b(oscola|apa(\s*\d{4})?|mla|harvard|chicago|ieee|vancouver|footnote[s]?)\b/i;
const DELIVERABLES = [
  { id: 'essay', re: /\bessay\b|مضمون/i },
  { id: 'case_brief', re: /\bcase\s*brief\b|brief\s*of\s*the\s*case|judicial\s*analysis|case\s*analysis\b|کیس بریف/i },
  { id: 'report', re: /\breport\b|project\s*report|lab\s*report/i },
  { id: 'presentation', re: /\bpresentation\b|slides?\b|seminar\s*(?:talk|presentation)/i },
  { id: 'reflection', re: /\breflection\b|reflective\s*(?:writing|journal|essay)/i },
  { id: 'dissertation', re: /\bthesis\b|dissertation\b|research\s*paper|final\s*year\s*project/i },
  { id: 'problem_question', re: /\bproblem\s*question\b|hypothetical|moot|viva|oral\s*exam/i },
];

const OUTLINES = {
  essay: ['Understanding the question', 'Position / thesis', 'Legal framework', 'Argument', 'Counterargument', 'Conclusion'],
  case_brief: ['Case identification', 'Facts', 'Issues framed', 'Decision held', 'Reasoning', 'Ratio and obiter', 'Practical effect'],
  report: ['Scope and method', 'Findings', 'Analysis', 'Limitations', 'Recommendations'],
  presentation: ['Framing', 'Core argument in 3 points', 'Evidence', 'Counterpoint', 'Close and questions'],
  reflection: ['What happened', 'What the law says', 'What I would change', 'Link to module outcomes'],
  dissertation: ['Research question', 'Literature and sources', 'Method', 'Analysis plan', 'Expected contribution', 'Timeline'],
  problem_question: ['Material facts', 'Issues', 'Applicable law', 'Application to each party', 'Outcome and remedy'],
};

/** Reads the requirement fields a brief actually states. Absent stays absent. */
export function parseAssignmentBrief(text) {
  const s = String(text || '').replace(/\r/g, '');
  const out = {
    words: null, dueDate: null, dueInDays: null, marks: null, style: null,
    deliverable: null, course: null, institution: null, wordTarget: null,
    flagged: [], stated: {},
  };
  const words = (m) => (m ? Number(String(m[1]).replace(/,/g, '')) : null);
  const w = /(\d{1,3}(?:,\d{3})+|\d{2,5})\s*(?:\+\/?-?\s*\d{0,4})?\s*words/i.exec(s)
    || /word\s*(?:limit|count|max(?:imum)?)\D{0,8}(\d{1,3}(?:,\d{3})+|\d{2,5})/i.exec(s);
  if (w) { out.words = words(w); out.wordTarget = out.words; }
  else out.flagged.push('word-count');

  const dateNotes = {};
  if ((out.dueDate = isoDateFrom(s, dateNotes))) {
    if (dateNotes.deadlineAmbiguous) out.flagged.push('deadline-format-assumed');
    out.dueInDays = Math.ceil((new Date(out.dueDate + 'T23:59:59') - new Date()) / 86400000);
    if (out.dueInDays < 0) out.flagged.push('deadline-passed');
    else if (out.dueInDays <= 3) out.flagged.push('deadline-imminent');
  }
  if (!out.dueDate) out.flagged.push('deadline');

  const m = /\b(?:worth|weight(?:age|ing)?|carries|marks?[:=])\D{0,12}(\d{1,3})\s*%?/i.exec(s)
    || /\bweight(?:age|ing)\D{0,10}(\d{1,3})/.exec(s)
    || /\b(\d{1,3})\s*marks\b/i.exec(s)
    || /(\d{1,3})\s*%\s*(?:of|out of|towards?|weight)/i.exec(s);
  if (m) out.marks = Number(m[1]); else out.flagged.push('marks-weighting');

  const st = STYLES.exec(s);
  if (st) out.style = st[1].toUpperCase().replace(/\s+\d{4}$/, '');
  if (!out.style) out.flagged.push('citation-style');

  for (const dl of DELIVERABLES) {
    if (dl.re.test(s)) { out.deliverable = dl.id; break; }
  }
  if (!out.deliverable) out.flagged.push('deliverable-type');

  out.course = courseFrom(s);
  out.institution = institutionFrom(s);

  out.stated = {
    words: out.words, dueDate: out.dueDate, marks: out.marks, style: out.style,
    deliverable: out.deliverable, course: out.course, institution: out.institution,
  };
  return out;
}

function monthNo(name) {
  const t = String(name).slice(0, 3).toLowerCase();
  const i = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(t);
  return String(i + 1).padStart(2, '0');
}

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

/** Each date form has its own group count; mixing them produced "undefined-00-March". */
function isoDateFrom(s, notes = {}) {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const prose = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\s+(\d{4})\b/.exec(s);
  if (prose && new RegExp(`^(${MONTHS})$`, 'i').test(prose[2])) {
    return `${prose[3]}-${monthNo(prose[2])}-${String(prose[1]).padStart(2, '0')}`;
  }
  const inv = /\b(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})\b/.exec(s);
  if (inv) return `${inv[1]}-${String(inv[2]).padStart(2, '0')}-${String(inv[3]).padStart(2, '0')}`;
  const num = /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/.exec(s);
  if (!num) return null;
  let a = Number(num[1]), b = Number(num[2]);
  const y = num[3].length === 2 ? `20${num[3]}` : num[3];
  // Day-first is the convention on Pakistani university briefs. When both halves
  // are ≤ 12 the reading is a guess, so it is reported as one.
  if (a > 12 && b <= 12) { /* day-first already correct */ }
  else if (b > 12 && a <= 12) { const t = a; a = b; b = t; }
  else if (b > 12) return null;
  else notes.deadlineAmbiguous = true;
  return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
}

function courseFrom(s) {
  const cued = /\b(?:course|module|paper|subject|vip(?:yan)?|code)\s*[:\-]?\s*([A-Z]{2,6}\s?\d{2,5}|[A-Za-z][\w &-]{3,44})/i.exec(s);
  if (cued) return cued[1].trim();
  // A brief headed by its own code ("LAW 305 Jurisprudence") carries no cue word.
  const bare = /\b([A-Z]{2,6})[ -](\d{3,5})\b/.exec(s);
  return bare ? `${bare[1]} ${bare[2]}` : null;
}

const INST_TYPE = /^(university|college|institute|academy|school)$/i;

function institutionFrom(s) {
  const words = s.split(/(\s+)/).filter(t => t.trim() !== '');
  const clean = t => t.replace(/[.,;:!?'"()\[\]—–-]+$/, '').replace(/^[.,;:!?'"()\[\]—–-]+/, '');
  const cap = t => /^[A-Z][\w'-]*$/.test(t) || /^(government|public|national|islamic|muhammadan|federal|the|of)$/i.test(t);
  for (let i = 0; i < words.length; i++) {
    const w = clean(words[i]);
    if (!INST_TYPE.test(w)) continue;
    let a = i, b = i;
    while (a > 0 && cap(clean(words[a - 1])) && i - a < 5) a--;
    while (b + 1 < words.length && cap(clean(words[b + 1])) && b - i < 2) b++;
    const name = words.slice(a, b + 1).map(clean).join(' ').trim();
    if (name.length > 4) return name;
  }
  return null;
}

function integrity(lang) {
  if (lang === 'ur') {
    return 'تعلیمی دیانت: یہ خاکہ آپ کے ادارے کی پالیسی کے مطابق لازمی طور پر ظاہر کیا جائے۔ یہ مصنفہ تحریر نہیں ہے اور نہ ہی اس میں دیے گئے حوالے آزادانہ طور پر تصدیق شدہ ہیں۔ ہر حوالہ اصل ماخذ سے خود ملائیں۔';
  }
  if (lang === 'roman_urdu') {
    return 'Academic integrity: yeh outline aap ke institution ki policy ke mutabiq declare karna zaroori hai. Yeh submitted writing nahi hai, aur diye gaye hawale azadana tor par verify nahi kiye gaye — har hawala asli source se khud milayein.';
  }
  return 'Academic integrity: declare this assistance if your institution requires it. This is a scaffold, not a submitted answer, and the sources listed are corpus records, not independently verified scholarship — match every citation to the publisher before you submit.';
}

/**
 * Builds the whole pack. `retriever` is injectable so the suite can prove that a
 * lead with no matching record produces an honest gap rather than an invented one.
 */
export async function buildAssignmentPack({ instructions, topic, lang = 'en', retriever = null } = {}) {
  const brief = String(instructions || '');
  const parsed = parseAssignmentBrief(brief);
  const question = String(topic || '').trim()
    || (/\?/.test(brief) ? brief.split(/(?<=\?)/)[0].trim().slice(0, 220) : brief.slice(0, 220));
  const retrieve = retriever || (async q => { const r = await RAGEngine.retrieve(q); return r.chunks || []; });

  const kind = parsed.deliverable || 'essay';
  if (!parsed.deliverable) parsed.deliverable = 'essay';
  const sections = OUTLINES[kind];
  const leads = await leadsWith(retrieve, question, sections);

  const citations = [];
  const draft = leads.map(l => {
    const bullets = l.chunks.map(c => {
      const cite = {
        section: l.section, docId: c.docId, title: c.title || c.chunkTitle, key: c.key,
        url: c.sourceURL, legalStatus: c.legalStatus || null, version: c.version || null,
        jurisdiction: c.jurisdiction || null,
      };
      citations.push(cite);
      const excerpt = String(c.text || '').replace(/\s+/g, ' ').slice(0, 200);
      return { excerpt, cite };
    });
    return {
      section: l.section,
      goal: goalFor(kind, l.section),
      ...(parsed.words ? { wordBudget: Math.max(40, Math.round(parsed.words / sections.length)) } : {}),
      groundedLeads: bullets,
      gap: bullets.length === 0
        ? (lang === 'ur' ? 'اس حصے کے لیے ذخیرہ میں کوئی تصدیق شدہ ماخذ نہیں ملا — یہاں کوئی حوالہ تجویز نہیں کیا گیا۔'
          : lang === 'roman_urdu' ? 'Is hissay ke liye corpus mein koi verified source nahi mila — yahan koi hawala suggest nahi kiya gaya.'
            : 'No verified source in the corpus matched this section, so none is suggested here.')
        : null,
    };
  });

  const checklist = buildChecklist(parsed, citations, draft, kind);
  const limitations = [
    'Retrieval covers the Pakistani legal and education corpus indexed in this project; a section it does not hold is reported as a gap, not filled.',
    'Reference formatting is your institution\'s style sheet applied to the listed sources; this module does not claim a citation has been checked against the publisher.',
    parsed.dueInDays != null ? `Deadline read from the brief: ${parsed.dueDate} (${parsed.dueInDays} day(s) from today).` : 'No submission date was stated in the brief.',
  ];
  if (leads.dropped > 0) {
    limitations.push(`${leads.dropped} retrieved record(s) were withheld because they did not share at least two content words with this topic — the list below is filtered, not complete.`);
  }
  return {
    kind,
    question,
    brief: parsed,
    unconfirmed: parsed.flagged,
    outline: draft.map(d => d.section),
    draft,
    citations,
    checklist,
    integrityNotice: integrity(lang),
    limitations,
  };
}

async function leadsWith(retrieve, question, sections) {
  const qt = stems(question);
  const out = [];
  let dropped = 0;
  for (const sec of sections) {
    const chunks = await retrieve(`${question} — ${sec}`);
    const pool = (chunks || []).filter(c => c && c.sourceURL);
    const onTopic = pool.filter(c => {
      const ct = stems(`${c.title || ''} ${c.chunkTitle || ''} ${String(c.text || '').slice(0, 900)}`);
      return sharedContentWords(qt, ct) >= 2;
    }).slice(0, 2);
    dropped += pool.length - onTopic.length;
    out.push({ section: sec, chunks: onTopic });
  }
  out.dropped = dropped;
  return out;
}

const LEAD_STOP = new Set(['the', 'and', 'for', 'with', 'from', 'does', 'did', 'can', 'is', 'are', 'how', 'why', 'tell', 'please', 'about', 'that', 'this', 'have', 'has', 'not', 'all', 'them', 'they', 'when', 'which', 'who', 'will', 'your', 'essay', 'assignment', 'due', 'word', 'words', 'must', 'shall', 'been', 'were', 'was', 'into', 'their', 'there', 'than', 'then', 'use', 'used', 'using', 'case', 'court', 'section', 'act', 'law', 'legal', 'question', 'under', 'between', 'against', 'because', 'before', 'after', 'over', 'any', 'each', 'other', 'such', 'same', 'own', 'part']);

/**
 * Two shared content words is the floor (the same one the Islamic layer uses). One
 * shared word — "court", "act", "law" — attaches the whole corpus to any question,
 * so case law must match the topic, not merely be a legal document. Stems match by
 * prefix, which lets "writ"/"written" and "code"/"codes" meet while "contract" and
 * "context" stay apart.
 */
function stems(text) {
  const out = new Set();
  for (const raw of String(text || '').toLowerCase().replace(/[^\w\s؀-ۿ]/g, ' ').split(/\s+/)) {
    if (raw.length < 4 || LEAD_STOP.has(raw)) continue;
    const stem = raw.replace(/(ingly|ing|edly|ed|ies)$/, m => (m === 'ies' ? 'i' : ''));
    out.add(stem.length >= 4 ? stem : raw);
  }
  return out;
}

function sharedContentWords(a, b) {
  let n = 0;
  for (const x of a) {
    for (const y of b) {
      if (x === y || (x.length >= 4 && y.startsWith(x)) || (y.length >= 4 && x.startsWith(y))) { n++; break; }
    }
  }
  return n;
}

function goalFor(kind, section) {
  const G = {
    'Understanding the question': 'State in your own words what the brief asks, the action words (analyse / discuss / evaluate) and the scope you are NOT being asked to cover.',
    'Position / thesis': 'One paragraph: the position you will defend and the reason you give for it.',
    'Argument': 'Your reasons in numbered steps, each tied to a source below or to a source you locate yourself.',
    'Counterargument': 'The strongest reading against your position, answered rather than ignored.',
    'Conclusion': 'What follows if your argument holds, and what does not.',
    'Case identification': 'Court, citation, benches, dates and disposing decision exactly as reported.',
    'Facts': 'Only the material facts the judgment itself records.',
    'Issues framed': 'Each question of law the court answered, as a question.',
    'Decision held': 'Allow / dismiss, and the order in the court\'s own terms.',
    'Reasoning': 'How the court moved from the provision to the result.',
    'Ratio and obiter': 'The binding principle versus remarks that are not.',
    'Practical effect': 'What this changes for the parties and for similar matters.',
    'Scope and method': 'What you examined, on what material, and what you excluded.',
    'Findings': 'Observations your material actually supports.',
    'Analysis': 'Why the findings matter; connect them to the framework.',
    'Limitations': 'What your material cannot answer.',
    'Recommendations': 'Concrete next steps, each traceable to a finding.',
  };
  return G[section] || 'Write this section yourself, then check it against the sources listed and the brief above.';
}

function buildChecklist(parsed, citations, draft, kind) {
  const items = [];
  const wordCountable = draft.filter(d => d.groundedLeads.length).length;
  items.push({
    id: 'requirements-read',
    label: parsed.words
      ? `Word limit stated in the brief: ${parsed.words} words — check your final draft against it, not against this scaffold.`
      : 'No word limit was stated in the brief. Confirm it with the instructor before writing.',
    done: !!parsed.words,
  });
  items.push({
    id: 'style',
    label: parsed.style
      ? `Referencing style read from the brief: ${parsed.style}. Apply that style sheet to the listed sources; the style itself has not been verified against your department handbook.`
      : 'No referencing style was stated. Ask before you format.',
    done: !!parsed.style,
  });
  items.push({
    id: 'deadline',
    label: parsed.dueDate
      ? `Due ${parsed.dueDate}${parsed.dueInDays != null ? ` (${parsed.dueInDays} day(s) from today)` : ''}.`
      : 'No submission date was stated in the brief.',
    done: !!parsed.dueDate,
  });
  items.push({
    id: 'weight',
    label: parsed.marks ? `Stated weight: ${parsed.marks}%.` : 'Marks or weighting were not stated; confirm how this is assessed.',
    done: !!parsed.marks,
  });
  items.push({
    id: 'sections-covered',
    label: `${wordCountable} of ${draft.length} sections have a corpus source attached; the rest must be written from material you locate yourself.`,
    done: wordCountable > 0,
  });
  items.push({
    id: 'no-unverified-citation',
    label: 'Every citation listed here is a corpus record with its own URL. If you add a reference that is not in this list, verify it against the publisher before citing it.',
    done: citations.length > 0,
  });
  items.push({
    id: 'argument-yours',
    label: kind === 'case_brief'
      ? 'Ratio, facts and decision must be quoted or paraphrased from the reported judgment, not reconstructed from memory.'
      : 'The argument in each section is yours; a scaffold is not an answer and will not read as one.',
    done: true,
  });
  items.push({
    id: 'disclosure',
    label: 'Declaration of assistance made, if your institution requires one.',
    done: false,
  });
  return items;
}
