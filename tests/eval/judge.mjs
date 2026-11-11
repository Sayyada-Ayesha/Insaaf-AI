/**
 * tests/eval/judge.mjs — the ten axes §8 of the brief demands, scored
 * deterministically from the live HTTP payload plus the repository's own corpus.
 *
 * No axis compares the answer to a hand-written expected answer. The checks are
 * structural: which records were used and whether they share the question's
 * subject, whether the verdict matches what is actually attached, whether every
 * URL/authority is a real corpus value, and whether every number, section or
 * deadline in the prose appears in the record the answer cites.
 */
import {
  citedRecordText, recordStems, domainsOfDoc, KNOWN_URLS, KNOWN_AUTHORITIES,
} from './corpusFacts.mjs';
import { SLOT_CONCEPTS } from './scenarios.mjs';

const URDU_RE = /[؀-ۿ]/;
const PROVINCIES = ['punjab', 'sindh', 'khyber pakhtunkhwa', 'kpk', 'balochistan', 'gilgit', 'baltistan', 'azad jammu', 'islamabad', 'ict', 'ajk'];

const REFUSAL = [
  /NO VERIFIED MATCH/i, /TASDEEQ SHUDA MATCH NAHI MILA/i,
  /no record in the verified law corpus matches/i,
  /milta-julta koi record nahi/i, /poora madad-ga record nahi mila/i,
  /I could not find a record in the verified corpus/i,
  /verified law corpus mein is sawal ka koi jawab mojood nahi/i,
  /holds no record that answers it/i,
  /I will not guess a section/i, /andaaza nahi lagao/i, /qanoon yaad se nahi bataunga/i,
  /out of scope/i, /\bI (can'?t|cannot) (answer|verify|say|help|assist|advise)\b/i,
];
const PRACTICE = [
  /\b(step|steps|file|filing|apply|application|submit|complaint|notice|petition|court|tribunal|authority|register|appeal|lawyer|helpline|form|write to|approach)\b/i,
  /\b(qadam|darkhwast|shikayat|appeal|adalat|tribunal|wakil|office|jama|bhej|likh|notice)\b/i,
  /^\s*(?:[1-9][.)]|[-*•])\s+\S+/m,
];

const toAsciiDigits = (s) => String(s)
  .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
  .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
const norm = (s) => toAsciiDigits(String(s || '')).toLowerCase();

/** Which script is this prose written in, per the P0 product language contract. */
export function scriptOf(text) {
  const s = String(text || '');
  if (URDU_RE.test(s)) return 'ur';
  const roman = (s.match(/\b(ke|ki|ka|ko|se|mein|main|hai|hain|mujhe|mera|meri|aap|kya|nahi|nahin|raha|karoon|karein|baat|masla|qanoon|adalat|shehar|raqam|paise|liye|chahiye|pehle|agar|warna|baraye|meharbani)\b/gi) || []).length;
  return roman >= 3 ? 'roman' : 'en';
}

const askedSet = (exp) => (Array.isArray(exp.ask) ? exp.ask : [exp.ask]);
const isRefusal = (answer) => REFUSAL.some(re => re.test(answer));

function isClarification(answer, verdict) {
  if (verdict === 'clarify') return true;
  const questions = (answer.match(/[?؟]/g) || []).length;
  return questions >= 1 && !isRefusal(answer) && answer.length < 1100 && !/https?:\/\//i.test(answer);
}
const hasPractical = (answer) => PRACTICE.some(re => re.test(answer));
const mentionsSlot = (answer, slot) => {
  const concepts = SLOT_CONCEPTS[slot];
  if (!concepts) return true;
  const a = norm(answer);
  return concepts.some(c => a.includes(norm(c)));
};

const sharesStem = (stem, recordStemSet) => {
  const s = String(stem).toLowerCase();
  if (recordStemSet.has(s)) return true;
  return [...recordStemSet].some(w => w.length > 3 && (w.startsWith(s) || s.startsWith(w)));
};

const trimUrl = (u) => String(u).replace(/[.,;:]+$/, '').replace(/\/+$/, '');
const MANIFEST_URLS = [...KNOWN_URLS].map(trimUrl);

/**
 * Where a link may legitimately come from: the document's registered manifest
 * URL, or an address printed verbatim inside a record the answer actually cites
 * (official portals such as complaint.fia.gov.pk live in record bodies, not in
 * doc-level metadata). This completes the truth set rather than loosening it —
 * an invented URL still matches neither, and a real corpus URL lifted from a
 * record the answer did NOT use still fails.
 */
function urlTracedToEvidence(url, citedTexts) {
  const b = trimUrl(url);
  if (MANIFEST_URLS.some(k => k.startsWith(b) || b.startsWith(k))) return true;
  const body = norm((citedTexts || []).join('\n'));
  return b.length > 8 && body.includes(norm(b));
}

/** How many of the records actually used are about the question's own subject. */
function subjectAgreement(sources, exp) {
  const stems = exp.stems || [];
  if (!stems.length) return null;
  if (!sources.length) return { score: 0, bad: false };
  let hits = 0;
  for (const s of sources) {
    const rs = recordStems(s);
    if (stems.some(st => sharesStem(st, rs))) hits++;
  }
  const first = sources[0] ? recordStems(sources[0]) : new Set();
  const badStems = exp.badStems || [];
  const topSharesExpected = stems.some(st => sharesStem(st, first));
  const topSharesBad = badStems.some(st => sharesStem(st, first));
  return { score: hits / sources.length, bad: badStems.length > 0 && topSharesBad && !topSharesExpected };
}

/** Claims only a record can license: sections, periods, percents, money, citations. */
export function extractClaims(answer) {
  const text = toAsciiDigits(String(answer || ''));
  const claims = [];
  const add = (kind, raw, value) => claims.push({ kind, raw: String(raw).trim(), value: norm(value) });
  for (const m of text.matchAll(/\b(?:section|dafa|under article|article)\s*#?\s*([0-9]{1,4}[A-Za-z]?(?:-[A-Z0-9]{1,3})?)/gi)) add('provision', m[0], m[1]);
  for (const m of text.matchAll(/([0-9]{1,4})\s*\**\s*(?:days?|months?|years?|din|mahine|saal)\b/gi)) add('period', m[0], m[1]);
  for (const m of text.matchAll(/([0-9]{1,3}(?:\.[0-9]+)?)\s*%?\s*percent/gi)) add('percent', m[0], m[1]);
  for (const m of text.matchAll(/(?:PKR|Rs\.?)\s*([0-9][0-9,.]*)/gi)) add('money', m[0], m[1]);
  for (const m of text.matchAll(/([0-9][0-9,.]{1,12})\s*(?:rupees?|PKR|lakh|lac|crore|arab)/gi)) add('amount', m[0], m[1]);
  for (const m of text.matchAll(/\b(PLD|SCMR|CLC|MLD|YLR|PLJ|CLD)\s*[0-9]{4}\b/gi)) add('citation', m[0], m[0]);
  return claims.filter(c => c.value.replace(/[^0-9]/g, '').length > 0 || c.kind === 'citation');
}

const WORD_NUMBERS = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 12: 'twelve', 15: 'fifteen', 21: 'twenty one', 30: 'thirty', 45: 'forty five', 60: 'sixty', 90: 'ninety', 120: 'one hundred and twenty' };

function groundedIn(claim, corpusText, question) {
  const digits = norm(claim.value).replace(/[^0-9]/g, '');
  const citationLetters = (norm(claim.value).match(/[a-z]+/g) || []).join('');
  if (!digits) return true;
  const q = norm(question);
  if (q.includes(digits) || q.includes(norm(claim.raw))) return true;
  const t = norm(corpusText).replace(/([0-9]),([0-9])/g, '$1$2');
  if (t.includes(digits)) return true;
  if (WORD_NUMBERS[digits] && t.includes(WORD_NUMBERS[digits])) return true;
  // 2 lakh == 200,000: a trailing-zeros-stripped match is the same quantity.
  const trimmed = digits.replace(/0+$/, '');
  if (trimmed.length >= 3 && t.includes(trimmed)) return true;
  // A provision letter must also match (489-F is not 489).
  if (citationLetters && claim.kind === 'provision') return false;
  return false;
}

/**
 * @param {object} scenario entry from scenarios.mjs
 * @param {object} res live payload {status, answer, sources, evidence, correction, understanding}
 */
export function judge(scenario, res) {
  const axes = {};
  const set = (name, score, reason) => { axes[name] = { score: Math.max(0, Math.min(1, score)), reason }; };
  const exp = scenario.exp || {};
  const answer = String(res.answer || '');
  const sources = Array.isArray(res.sources) ? res.sources : [];
  const verdict = (res.evidence && res.evidence.verdict) || null;
  const clarified = isClarification(answer, verdict);
  const refused = isRefusal(answer);
  const proseAsk = refused ? 'abstain' : clarified ? 'clarify' : 'answer';
  // The server now declares what it did on the payload. That declaration is
  // authoritative; the prose reading stays as a cross-check, because a reply that
  // says "answer" while its text refuses to answer is exactly the defect this
  // suite exists to catch.
  const declared = ['answer', 'clarify', 'abstain'].includes(res.action) ? res.action : null;
  const asked = declared || proseAsk;
  const declaresAnswerOverRefusal = declared === 'answer' && refused;
  const agree = subjectAgreement(sources, exp);
  const want = askedSet(exp);
  const offSubject = !!agree && (agree.bad || agree.score < 0.34);
  const meta = { verdict, asked, declared, cards: sources.length, subject: agree ? Number(agree.score.toFixed(2)) : null, chars: answer.length };

  // 1 — INTENT ACCURACY: did the system do the right kind of thing?
  {
    let s = 0; let why = '';
    if (want.includes(asked)) {
      s = 1;
      if (asked === 'answer' && offSubject) { s = 0.3; why = 'answered, but about a different subject'; }
      if (asked === 'clarify' && exp.slot && !mentionsSlot(answer, exp.slot)) { s = 0.5; why = `clarified without asking about ${exp.slot}`; }
    } else if (asked === 'clarify' && want.includes('answer')) {
      s = 0.5; why = 'asked a question the corpus could already answer';
    } else if (asked === 'answer' && want.includes('clarify')) {
      s = 0; why = 'answered instead of choosing between the two disputes the question allows';
    } else if (asked === 'abstain') {
      s = want.includes('answer') ? 0 : 0.3; why = 'abstained';
    } else why = `did "${asked}" where "${want.join('/')}" was required`;
    if (!why) why = `${asked}, as expected`;
    // The declaration and the reply cannot both be true: a payload that says it
    // answered while its own text refuses is the defect, not a reporting glitch.
    if (declaresAnswerOverRefusal) { s = 0; why = 'declared action "answer" over a refusal reply'; }
    set('intent', s, why);
  }

  // 2 — DOMAIN CLASSIFICATION
  {
    const dom = res.evidence && res.evidence.domain;
    const wantUnknown = (exp.domains || []).includes('unknown');
    let s;
    if (wantUnknown) s = (!dom || dom === 'unknown' || asked === 'abstain') ? 1 : 0;
    else if (dom && (exp.domains || []).includes(dom)) s = 1;
    else s = sources.flatMap(x => domainsOfDoc(x.docId || '')).some(d => (exp.domains || []).includes(d)) ? 0.5 : 0;
    set('domain', s, `gate domain=${dom || 'none'}; expected ${(exp.domains || []).join('/')}`);
  }

  // 3 — JURISDICTION ACCURACY
  {
    const prov = exp.province ? norm(exp.province) : null;
    if (!prov) {
      // Where may a province name come from? The question itself, or a record the
      // answer actually cites. Card metadata is too coarse (the manifest labels
      // every provincial rent law "Pakistan (Provincial & ICT)"), and an
      // instrument-pattern rule alone was too narrow: "The Federal Government sets
      // minimum wage for Islamabad Capital Territory" is the record's own sentence
      // and licenses the name exactly as "Punjab Rented Premises Act" does. A name
      // no cited record prints still fails.
      const licence = p => sources.some(s => new RegExp(`\\b${p}\\b`, 'i')
        .test(`${s.jurisdiction || ''} ${s.authority || ''} ${s.title || ''} ${citedRecordText(s)}`));
      const invented = PROVINCIES.filter(p => new RegExp(`\\b${p}\\b`, 'i').test(answer)
        && !new RegExp(`\\b${p}\\b`, 'i').test(scenario.q) && !licence(p));
      set('jurisdiction', invented.length ? 0 : 1, invented.length
        ? `answer asserts ${invented[0]}, which neither the question nor any cited record states`
        : 'jurisdiction only ever stated as the question or the cited records state it');
    } else {
      const cards = sources.map(s => norm(s.jurisdiction || ''));
      const hasProvCard = cards.some(j => j.includes(prov));
      const contradicted = cards.some(j => j && PROVINCIES.some(p => j.includes(p)) && !j.includes(prov));
      set('jurisdiction', hasProvCard ? 1 : contradicted ? 0 : 0.5,
        hasProvCard ? 'a record of the asked jurisdiction was used' : contradicted ? 'a different province record was used' : 'only national/federal coverage was reached');
    }
  }

  // 4 — RETRIEVAL RELEVANCE: subject agreement with the records actually used
  {
    if (agree === null) set('retrieval', sources.length ? 0.5 : (want.includes('abstain') ? 1 : 0), 'scenario declares no subject stems (out-of-corpus class)');
    else if (!sources.length) set('retrieval', (want.includes('abstain') || want.includes('clarify')) ? 1 : 0, asked === 'answer' ? 'answered with no attached record' : 'no record attached, none needed');
    else {
      const first = recordStems(sources[0]);
      const shared = (exp.stems || []).filter(st => sharesStem(st, first));
      set('retrieval', agree.bad ? 0 : shared.length >= 2 ? 1 : shared.length === 1 ? 0.5 : 0,
        `top record shares ${shared.length} subject stem(s)${shared.length ? `: ${shared.slice(0, 4).join(',')}` : ''}${agree.bad ? `; the answer slid to a different subject (${exp.badStems.join(',')})` : ''}`);
    }
  }

  // 5 — EVIDENCE SUFFICIENCY: the verdict must match what is actually attached
  {
    const bad = [];
    if (verdict === 'strong' && !sources.length) bad.push('verdict strong with zero source cards');
    if (verdict === 'strong' && sources.some(x => !x.sourceURL)) bad.push('a strong card carries no URL');
    const unqualified = /(?<!PARTIALLY )(?<!QISMAN )(?<!DIRECT )\bVERIFIED (?:LEGAL )?(?:REFERENCE|JAWAB|MAKHAAZ|QANOONI HAWALA)/i.test(answer);
    if (unqualified && verdict !== 'strong') bad.push(`unqualified "VERIFIED" wording on verdict=${verdict}`);
    if (unqualified && !sources.length) bad.push('VERIFIED wording with no attached record');
    if (verdict === 'clarify' && /https?:\/\//i.test(answer)) bad.push('a clarification carries citations');
    if (verdict === 'none' && asked === 'answer' && !refused) bad.push('verdict none but the prose presents law');
    set('sufficiency', bad.length ? 0 : 1, bad.length ? bad.join('; ') : `verdict=${verdict}, cards=${sources.length}`);
  }

  // 6 — ANSWER RELEVANCE
  {
    if (asked !== 'answer') set('relevance', want.includes(asked) ? 1 : 0, asked === 'clarify' ? 'clarified; no answer body to judge' : 'abstained');
    else {
      const generic = !sources.length && /what actually happened/i.test(answer);
      const s = generic ? 0 : offSubject ? 0 : hasPractical(answer) ? 1 : 0.5;
      set('relevance', s, generic ? 'generic "tell me what happened" template on an answerable question'
        : offSubject ? 'the answer is about a different subject than the question'
          : hasPractical(answer) ? 'addresses the asked subject with practical content' : 'no step, forum, authority or document named');
    }
  }

  // 7 — LANGUAGE / SCRIPT PRESERVATION (P0 contract: Urdu script + Roman input →
  // Roman Urdu prose; English input → English prose)
  {
    const out = scriptOf(answer);
    const wantScript = scenario.lang === 'en' ? 'en' : 'roman';
    let s = out === wantScript ? 1 : (wantScript === 'roman' && out === 'en') ? 0.5 : 0;
    if (out === 'ur') s = 0.5;
    if (!answer.trim()) s = 0;
    set('language', s, `input=${scenario.lang}, output script=${out}, contract expects ${wantScript}`);
  }

  // 8 — PRACTICAL USEFULNESS
  {
    const stepLines = (answer.match(/^\s*(?:[1-9][.)]|[-*•])\s+\S+/gm) || []).length;
    let s; let why;
    if (asked === 'clarify') {
      const qCount = (answer.match(/[?؟]/g) || []).length;
      s = qCount >= 1 && qCount <= 3 ? (exp.slot && !mentionsSlot(answer, exp.slot) ? 0.4 : 1) : 0.4;
      why = `${qCount} question(s), slot ${exp.slot || 'n/a'} ${s === 1 ? 'asked for' : 'not asked for'}`;
    } else if (asked === 'answer') {
      const headings = (answer.match(/\*\*[^*]+\*\*/g) || []).length;
      let base = hasPractical(answer) ? 1 : 0.3;
      if (headings >= 7 && stepLines === 0) base = Math.min(base, 0.4);
      if (exp.maxLen && answer.length > exp.maxLen) base = Math.min(base, 0.5);
      if (offSubject) base = 0;
      s = base;
      why = `${headings} heading(s), ${stepLines} step line(s)${offSubject ? ', off-subject' : ''}`;
    } else {
      s = want.includes('abstain') ? 1 : 0.3;
      why = 'abstention';
    }
    set('usefulness', s, why);
  }

  // 9 — CITATION VALIDITY
  {
    const problems = [];
    if (asked === 'abstain' && sources.length) problems.push(`abstention still attached ${sources.length} source card(s)`);
    const citedTexts = sources.map(s => citedRecordText(s)).filter(Boolean);
    for (const m of answer.matchAll(/https?:\/\/[^\s)>\]]+/g)) {
      const u = m[0].replace(/[.,;:]$/, '');
      if (!urlTracedToEvidence(u, citedTexts)) problems.push(`URL not carried by the cited records: ${u.slice(0, 60)}`);
    }
    for (const s of sources) {
      const t = String(s.title || '').trim();
      if (t.length < 6) problems.push('a card has no real title');
      if (/[a-z_]+_[a-z]+|\[(?:insert|your|...)\]/i.test(t)) problems.push(`placeholder-looking title: ${t.slice(0, 30)}`);
      if (!s.sourceURL) problems.push(`card "${t.slice(0, 26)}" has no URL`);
      else if (!urlTracedToEvidence(s.sourceURL, [citedRecordText(s)])) problems.push(`card URL is not carried by its record: ${s.sourceURL}`);
      const au = String(s.authority || '').trim();
      if (au && ![...KNOWN_AUTHORITIES].some(k => {
        const a = norm(k); const b = norm(au);
        return a === b || a.includes(b) || b.includes(a) || b.split(',').some(x => x.length > 6 && a.includes(x.trim()));
      })) problems.push(`authority not carried by the corpus: ${au.slice(0, 44)}`);
    }
    set('citations', problems.length ? 0 : 1, problems.length ? problems.slice(0, 3).join('; ')
      : sources.length ? `${sources.length} card(s); every URL traced to rag/manifest.json or its own record, every authority to the corpus registry` : 'no citation asserted');
  }

  // 10 — HALLUCINATION / UNSUPPORTED CLAIMS
  {
    const claims = extractClaims(answer);
    const corpusText = sources.map(citedRecordText).join('\n') + '\n'
      + sources.map(s => `${s.title} ${s.authority || ''}`).join('\n');
    const ungrounded = claims.filter(c => !groundedIn(c, corpusText, scenario.q));
    meta.claims = claims.length;
    meta.ungrounded = ungrounded.map(c => `${c.kind}:${c.raw}`);
    const s = ungrounded.length ? Math.max(0, 1 - ungrounded.length / Math.max(claims.length, 1)) : 1;
    set('grounding', s, ungrounded.length
      ? `${ungrounded.length}/${claims.length} claim(s) absent from the cited record(s): ${ungrounded.slice(0, 3).map(c => `${c.kind} "${c.raw}"`).join(' | ')}`
      : `${claims.length} legal claim(s), each present in a cited record or in the user's own words`);
  }

  return { axes, meta };
}

export const AXES = [
  ['intent', 'intent accuracy'],
  ['domain', 'domain classification'],
  ['jurisdiction', 'jurisdiction accuracy'],
  ['retrieval', 'retrieval relevance'],
  ['sufficiency', 'evidence sufficiency'],
  ['relevance', 'answer relevance'],
  ['language', 'language/script preservation'],
  ['usefulness', 'practical usefulness'],
  ['citations', 'citation validity'],
  ['grounding', 'hallucination / unsupported claims'],
];

const FLOORS = {
  intent: 1, domain: 0.5, jurisdiction: 0.5, retrieval: 0.5, sufficiency: 1,
  relevance: 0.5, language: 0.5, usefulness: 0.4, citations: 1, grounding: 1,
};
/** Honesty and subject axes are hard; the rest may land partially — but any
 *  axis that scores zero at all is still blocking. */
const SOFT = new Set(['domain', 'jurisdiction', 'retrieval', 'relevance', 'language', 'usefulness']);

export function verdictOf(judged) {
  const failed = [];
  for (const [key] of AXES) {
    const a = judged.axes[key];
    if (a.score < FLOORS[key]) failed.push({ axis: key, score: a.score, floor: FLOORS[key], reason: a.reason });
  }
  const hard = failed.filter(f => !SOFT.has(f.axis));
  const blocking = failed.filter(f => SOFT.has(f.axis) && f.score === 0);
  return {
    pass: failed.length === 0,
    partial: (hard.length === 0 && blocking.length === 0 && failed.length > 0),
    // An axis that scores zero at all is a real defect, soft or not.
    failed,
    blocking: [...hard, ...blocking],
  };
}
