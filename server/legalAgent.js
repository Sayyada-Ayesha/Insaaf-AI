/**
 * server/legalAgent.js — the Legal Agent orchestration layer.
 *
 * This module sits ABOVE retrieval and generation. It owns the order of work
 * for a legal question and nothing else: the RAG engine, the corrective evidence
 * gate and the answer composer stay exactly where they are and are called as
 * black boxes. Only /api/ai/agent runs this workflow, so an ordinary chat
 * reply never pays for a ten-step orchestration.
 *
 * The 11 steps
 *   1 understand the issue          — routed domain + intent + language
 *   2 identify facts                — quoted from the user's OWN message only
 *   3 determine jurisdiction /      — province/city mentioned, foreign layer,
 *     domain / procedure              subject domain, procedure vs substantive
 *   4 retrieve                      — RAGEngine.retrieve via the evidence gate
 *   5 evaluate evidence quality     — the gate verdict + reasons
 *   6 correct retrieval if needed   — bounded retries already run by the gate
 *   7 select evidence by scope      — the specificity ladder: which layer each
 *                                     kept record belongs to, which layer was
 *                                     asked for, what is missing
 *   8 explain at the requested      — composeOwnedModelAnswer at answerLevel
 *     difficulty level
 *   9 practical options / steps     — from procedure records
 *  10 forum / authority             — only where a record states one
 *  11 cautious legal references      — provisions/cases actually retrieved
 *
 * Grounding: every line of the ledger is built from the user's own words or from
 * a retrieved record's metadata. A step with no support says so and stays empty
 * — it is never filled in from memory.
 */
import { RAGEngine, parseOverseasIntent } from './ragEngine.js';
import { retrieveCorrected, normalizeAnswerLevel, ANSWER_LEVELS, statuteMentions } from './evidenceGate.js';
import { composeOwnedModelAnswer, askClarification, crossBorderNudge, askedServiceSet, recordSource, recordAuthority } from './ownedModel.js';
import { CITY_PROVINCE, scopeLayerName } from './corpusScope.js';

const CITIES = CITY_PROVINCE;

const PROCEDURE_CUES = /\b(procedure|process|step|how|file|filing|apply|application|submit|appeal|revision|execution|summons|darj|tareeqa|kaise|form|fees)\b/i;

function quotedList(items) {
  return items.filter(Boolean).join('; ');
}

/** Step 2 — facts, taken verbatim from the user's own message. Nothing inferred. */
export function extractStatedFacts(message) {
  const text = String(message || '');
  const facts = { cities: [], statutes: [], provisions: [], dates: [], amounts: [], documents: [] };
  const low = text.toLowerCase();
  for (const city of Object.keys(CITIES)) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(low) && !facts.cities.includes(city)) facts.cities.push(city);
  }
  facts.statutes = statuteMentions(text);
  const prov = text.match(/\b(?:section|sec|article|art|dafa|دفعہ)\s*\.?\s*\d+[a-z]?\b/gi) || [];
  facts.provisions = [...new Set(prov.map(p => p.trim()))];
  const dates = text.match(/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{4}\b/gi) || [];
  facts.dates = [...new Set(dates)];
  const amounts = text.match(/(?:rs\.?|rupees|pkr)\s*[\d,]+/gi) || [];
  facts.amounts = [...new Set(amounts)];
  const docs = text.match(/\b(?:fir|notice|order|petition|complaint|challan|decree|agreement|deed|application|letter|show-?cause)\b(?:\s*(?:no\.?|dated|under)\s*[\w/\-.:]+)?/gi) || [];
  facts.documents = [...new Set(docs.map(d => d.trim().replace(/\s+/g, ' ')))].slice(0, 6);
  return facts;
}

// ---------------------------------------------------------------------------
// Conversation context — multi-turn continuity for the voice agent.
//
// This layer carries WHAT THE USER ALREADY SAID so the agent stops re-asking.
// It is deliberately kept out of the reasoning pipeline: `message` remains the
// only text passed to retrieval, the cache key, scope detection and the
// composer. Nothing here can add evidence or lower a threshold.
// ---------------------------------------------------------------------------
export const CONTEXT_LIMITS = {
  field: 160,        // any single scalar field
  item: 120,         // any single list entry
  facts: 20, timeline: 12, deadlines: 8, documents: 12, missingFacts: 12,
  total: 3000        // serialized cap for the whole context object
};

function cleanScalar(value, cap = CONTEXT_LIMITS.field) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, cap);
}

function cleanList(value, cap) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    const s = cleanScalar(entry, CONTEXT_LIMITS.item);
    if (s && !out.some(o => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Validate + bound the incoming conversation context.
 * @returns {object|null} a normalized context, or null when absent, malformed or
 *                        carrying nothing usable — a bad context must never
 *                        break the legal answer, so it degrades to "no context"
 *                        instead of an HTTP 400.
 */
export function sanitizeAgentContext(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const c = {
    issue: cleanScalar(raw.issue),
    domain: cleanScalar(raw.domain, 40),
    jurisdiction: cleanScalar(raw.jurisdiction, 40),
    institution: cleanScalar(raw.institution),
    location: cleanScalar(raw.location),
    requestedOutcome: cleanScalar(raw.requestedOutcome),
    facts: cleanList(raw.facts, CONTEXT_LIMITS.facts),
    timeline: cleanList(raw.timeline, CONTEXT_LIMITS.timeline),
    deadlines: cleanList(raw.deadlines, CONTEXT_LIMITS.deadlines),
    documents: cleanList(raw.documents, CONTEXT_LIMITS.documents),
    missingFacts: cleanList(raw.missingFacts, CONTEXT_LIMITS.missingFacts)
  };
  // Longest lists are trimmed first until the whole payload fits the total cap.
  let size = JSON.stringify(c).length;
  for (const key of ['facts', 'timeline', 'documents', 'missingFacts', 'deadlines']) {
    while (size > CONTEXT_LIMITS.total && c[key].length > 1) {
      c[key].pop();
      size = JSON.stringify(c).length;
    }
  }
  const hasAnything = Object.values(c).some(v => (typeof v === 'string' ? v.length > 0 : v.length > 0));
  return hasAnything ? c : null;
}

const URGENCY_CUES = /\b(urgent|urgently|immediate|immediately|emergency|deadline|last date|expiry|expire|within\s+\d+\s*(?:day|days|week|weeks|month|months)|kal|parson|foran|fauran|jald|turant)\b/i;
const DANGER_CUES = /\b(rape|raped|murder|kill|killed|attack|attacked|abduct|kidnap|harass|harassment|violence|beaten|assault|threat|threatened|danger|gun|firing|accident|arrest|arrested|detain|detained|custody|ejama|qatl|zhilat|chakro)\b/i;
const LAWYER_ASK = /\b(lawyer|lawyers|vakeel|wakil|advocate|attorney|legal aid|bar council|free legal|vakil)\b/i;
const MONEY_CUES = /\b(amount|fee|salary|rent|refund|deposit|security|mult|nahi di|unpaid|charges|fine|damages|compensation)\b/i;
const DRAFT_CUES = /\b(draft|write|prepare|compose|application|notice|complaint|petition|affidavit|bana|likh|taiyar)\b/i;
const AMOUNT_CARRIED = /(?:\brs\.?\s*\d|rupees|pkr|\b\d[\d,]{2,}\b)/i;

// Which intake slot each carried "missing fact" refers to, so a slot the user has
// since answered is dropped instead of re-asked.
const SLOT_KEYWORDS = {
  location: /city|district|shehar|ilaqa|area|location|place|address/i,
  dates: /date|timeline|tareekh|waqt|time|when/i,
  amount: /amount|raqqam|sum|money|fee|salary/i,
  documents: /document|dastavez|paper|record|evidence|proof/i,
  outcome: /outcome|result|target|maqsad|what you want|relief/i,
  institution: /university|college|institute|school|hostel|office|court|police station/i
};

/**
 * Build the structured Client Intake Summary. Every field traces to the current
 * message, the carried context, or verified retrieval metadata — an unknown field
 * is returned empty and the UI says "not stated", it is never guessed.
 * @param {string} message   the turn the user just asked
 * @param {object|null} context  sanitized conversation context
 * @param {object|null} retrieval the gated retrieval result (may be null: a curated
 *                                answer is produced before retrieval runs)
 */
export function deriveIntake(message, context = null, retrieval = null) {
  const facts = extractStatedFacts(message);
  const ctx = context || {};
  const ev = retrieval && retrieval.evidence ? retrieval.evidence : null;
  const scope = ev && ev.scope ? ev.scope : null;
  const qs = scope && scope.asked ? scope.asked : {};

  const location = facts.cities[0] || ctx.location || '';
  const province = qs.province
    || (scope && scope.layers ? (scope.layers.find(l => l.province) || {}).province : '')
    || ctx.jurisdiction || '';
  const institution = (ev && ev.institutionQuery) || ctx.institution || '';
  const routedDomain = (retrieval && retrieval.domain && retrieval.domain !== 'general-legal')
    ? retrieval.domain
    : ((ev && ev.domain && ev.domain !== 'general-legal') ? ev.domain : (ctx.domain || ''));

  const keyFacts = [];
  if (facts.statutes.length) keyFacts.push(`Law named: ${facts.statutes.join(', ')}`);
  if (facts.provisions.length) keyFacts.push(`Provision named: ${facts.provisions.join(', ')}`);
  if (facts.amounts.length) keyFacts.push(`Amount stated: ${facts.amounts.join(', ')}`);
  if (facts.documents.length) keyFacts.push(`Document mentioned: ${facts.documents.join(', ')}`);
  for (const f of ctx.facts || []) {
    if (!keyFacts.some(k => k.toLowerCase() === f.toLowerCase())) keyFacts.push(f);
  }

  const timeline = [...facts.dates, ...(ctx.timeline || [])];
  const documentsMentioned = [...new Set([...facts.documents, ...(ctx.documents || [])])];

  let urgency = '';
  if ((ctx.deadlines || []).length) urgency = `Deadline mentioned: ${ctx.deadlines.join('; ')}`;
  else if (URGENCY_CUES.test(message)) urgency = 'Urgent — no date stated yet';

  // Missing slots: recomputed from what is NOW known, so an answered slot is gone.
  const have = {
    location: Boolean(location || province),
    dates: timeline.length > 0,
    amount: facts.amounts.length > 0 || (ctx.facts || []).some(f => AMOUNT_CARRIED.test(f)),
    documents: documentsMentioned.length > 0,
    outcome: Boolean(ctx.requestedOutcome),
    institution: Boolean(institution)
  };
  const missingMandatoryFacts = [];
  if (!have.location) missingMandatoryFacts.push('the city or district this happened in');
  if (!have.dates) missingMandatoryFacts.push('the dates of the main events');
  if (!have.amount && MONEY_CUES.test(message)) missingMandatoryFacts.push('the amount involved');
  if (!have.documents) missingMandatoryFacts.push('the documents you already have');
  if (!have.outcome) missingMandatoryFacts.push('what outcome you are seeking');
  // Anything the previous turn flagged as missing is dropped once answered.
  for (const carried of ctx.missingFacts || []) {
    const slot = Object.keys(SLOT_KEYWORDS).find(k => SLOT_KEYWORDS[k].test(carried));
    if (slot && have[slot]) continue;
    if (!missingMandatoryFacts.some(m => m.toLowerCase() === carried.toLowerCase())) {
      missingMandatoryFacts.push(carried);
    }
  }

  const verdict = ev ? ev.verdict : null;
  const attempts = (retrieval && retrieval.correction ? retrieval.correction.attempts : 0) || 0;

  let suggestedNextStep = '';
  if (DANGER_CUES.test(message)) {
    suggestedNextStep = 'Safety first: contact the police or the relevant emergency helpline, then a lawyer. The app cannot contact anyone for you.';
  } else if (verdict === 'weak') {
    suggestedNextStep = 'Add the law/section, the city and the dates, or take these facts to a lawyer or a legal aid organisation — the verified records do not cover this exact point.';
  } else if (LAWYER_ASK.test(message)) {
    suggestedNextStep = 'Open the verified lawyer directory or the legal aid list and contact them directly.';
  } else if (DRAFT_CUES.test(message)) {
    suggestedNextStep = 'Draft the application or notice in the Document Drafter, then have a lawyer or the relevant office check it.';
  } else if (routedDomain === 'education') {
    suggestedNextStep = 'Confirm the rule in your own university\'s regulations before acting — this answer is not a Pakistan-wide rule.';
  } else if (PROCEDURE_CUES.test(message)) {
    suggestedNextStep = 'Follow the step-by-step procedure for this matter in Legal Procedures.';
  } else if (verdict === 'strong') {
    suggestedNextStep = 'Read the Legal Library guide for this subject and collect the documents listed there.';
  }

  // Tri-state: true only when a real escalation rule fires, never because the
  // subject happens to be legal.
  let professionalSupportNeeded = 'unclear';
  const escalation = DANGER_CUES.test(message) || LAWYER_ASK.test(message);
  const weakAfterCorrection = verdict === 'weak' || (verdict !== 'strong' && attempts >= 2);
  const selfServiceAsk = PROCEDURE_CUES.test(message) || DRAFT_CUES.test(message);
  if (escalation) professionalSupportNeeded = true;
  else if (weakAfterCorrection && !selfServiceAsk) professionalSupportNeeded = true;
  else if (verdict === 'strong' && !URGENCY_CUES.test(message) && !selfServiceAsk) professionalSupportNeeded = false;

  return {
    issue: cleanScalar(ctx.issue || message, 200),
    domain: routedDomain || '',
    jurisdiction: province || '',
    location: location || '',
    institution: institution || '',
    keyFacts,
    timeline,
    urgency,
    documentsMentioned,
    requestedOutcome: ctx.requestedOutcome || '',
    missingMandatoryFacts,
    suggestedNextStep,
    professionalSupportNeeded,
    evidenceStatus: verdict || 'not_evaluated'
  };
}

/**
 * Renders the intake slots the user already gave, so a party, amount, date,
 * document or outcome collected across turns stays visible in the answer
 * instead of living only in the metadata. Prints only what the intake holds.
 */
function carriedFactsForReply(intake, message, isRoman) {
  const lines = [];
  for (const f of (intake.keyFacts || []).slice(0, 4)) {
    const s = String(f || '').trim();
    if (s) lines.push(s);
  }
  for (const t of (intake.timeline || []).slice(-2)) {
    const s = String(t || '').trim();
    if (s && !lines.includes(s)) lines.push(isRoman ? `Tareekh: ${s}` : `Date: ${s}`);
  }
  const docs = (intake.documentsMentioned || []).map(d => String(d || '').trim()).filter(Boolean);
  if (docs.length) lines.push(isRoman ? `Document: ${docs.slice(0, 4).join(', ')}` : `Documents: ${docs.slice(0, 4).join(', ')}`);
  if (intake.requestedOutcome) {
    lines.push(isRoman ? `Aap ka maqsad: ${intake.requestedOutcome}` : `Outcome sought: ${intake.requestedOutcome}`);
  }
  if (!lines.length) return '';
  const head = isRoman
    ? '**Aap ne jo bataya (mere paas ye record hai)**'
    : '**What you have told me (on record for this case)**';
  return `${head}\n${lines.slice(0, 7).map(l => `- ${l}`).join('\n')}`;
}

/** Steps 1-3 metadata that does not need retrieval. */
function frameQuestion(message, activeLang) {
  let processed = { detectedLang: activeLang || 'en', domain: 'general-legal' };
  try {
    processed = RAGEngine.processQuery(String(message || '')) || processed;
  } catch { /* keep the caller's language */ }
  const foreign = parseOverseasIntent(String(message || ''));
  return {
    lang: activeLang || processed.detectedLang || 'en',
    routedDomain: processed.domain,
    intent: {
      procedure: PROCEDURE_CUES.test(message || ''),
      overseas: Boolean(foreign.isOverseas),
      country: foreign.country || null,
      purpose: foreign.purpose || null
    }
  };
}

/**
 * Run the Legal Agent workflow for one message.
 * @param {object} p
 * @param {string} p.message            user text (already validated + trimmed)
 * @param {string} [p.activeLang]       'en' | 'roman_urdu' (Urdu script maps to Roman upstream)
 * @param {string} [p.answerLevel]      'beginner' | 'intermediate' | 'advanced'
 * @param {boolean} [p.isOnline]        retrieval strategy flag the endpoint already uses
 * @param {string|null} [p.apiKey]
 * @param {object|null} [p.retrieval]   already-gated retrieval (retrieveCorrected result)
 *                                       to reuse instead of running retrieval again
 * @param {object|null} [p.context]     sanitized conversation context from earlier
 *                                       turns — remembered facts only. It is never
 *                                       passed to retrieval, the cache key, scope
 *                                       detection or the composer.
 * @param {Function} p.headerFor        (lang, verdict) => the endpoint's verified-knowledge header
 * @param {Function} [p.sectionNotFoundFor] (message, lang) => honest guard text or null
 * @param {Function} [p.clarificationFor]   (message, lang) => minimum-clarification text
 * @param {Function} [p.crossBorderFor]     (message, lang) => follow-up nudge or null
 * @returns {Promise<{reply, steps, evidence, correction, answerLevel, domain, relevance, sources, chunkCount}>}
 */
export async function runLegalAgent(p = {}) {
  const {
    message, activeLang = 'en', answerLevel = 'beginner', isOnline = false, apiKey = null,
    retrieval: providedRetrieval = null, context = null,
    headerFor = () => '', sectionNotFoundFor = null,
    clarificationFor = askClarification, crossBorderFor = crossBorderNudge
  } = p;
  const lvlName = normalizeAnswerLevel(answerLevel);
  const lvl = ANSWER_LEVELS[lvlName];
  const isRoman = activeLang === 'roman_urdu';
  const ctx = context || {};
  const steps = [];
  const add = (key, label, detail) => {
    if (detail && String(detail).trim()) steps.push({ n: steps.length + 1, key, label, detail: String(detail).trim() });
  };

  // Facts carried over from earlier turns. They influence only what the agent
  // remembers and what it still needs to ask — never the retrieval query.
  const remembered = [];
  if (ctx.location) remembered.push(`${isRoman ? 'Shehar/ilaqa' : 'Place'}: ${ctx.location}`);
  if (ctx.jurisdiction) remembered.push(`${isRoman ? 'Jurisdiction' : 'Jurisdiction'}: ${ctx.jurisdiction}`);
  if (ctx.institution) remembered.push(`${isRoman ? 'Idara' : 'Institution'}: ${ctx.institution}`);
  if (ctx.requestedOutcome) remembered.push(`${isRoman ? 'Maqsad' : 'Wanted outcome'}: ${ctx.requestedOutcome}`);
  for (const f of ctx.facts || []) remembered.push(f);
  for (const d of ctx.deadlines || []) remembered.push(`${isRoman ? 'Muddat' : 'Deadline'}: ${d}`);

  // 1 — understand the issue.
  const frame = frameQuestion(message, activeLang);
  add('understand_issue',
    isRoman ? 'Masla' : 'Issue',
    isRoman
      ? `Bunyadi sawal: ${String(message).slice(0, 160)} — zakhira domain: ${frame.routedDomain}`
      : `Question as asked: ${String(message).slice(0, 160)} — subject area routed to: ${frame.routedDomain}`);

  // 2 — identify the facts the user actually stated.
  const facts = extractStatedFacts(message);
  const factLines = [
    facts.cities.length ? `${isRoman ? 'Shehar' : 'Place'}: ${facts.cities.join(', ')}` : '',
    facts.statutes.length ? `${isRoman ? 'Qanoon' : 'Law named'}: ${facts.statutes.join(', ')}` : '',
    facts.provisions.length ? `${isRoman ? 'Dafa/Article' : 'Provision named'}: ${facts.provisions.join(', ')}` : '',
    facts.dates.length ? `${isRoman ? 'Tareekh' : 'Date'}: ${facts.dates.join(', ')}` : '',
    facts.amounts.length ? `${isRoman ? 'Raqqam' : 'Amount'}: ${facts.amounts.join(', ')}` : '',
    facts.documents.length ? `${isRoman ? 'Dastavez' : 'Document'}: ${facts.documents.join(', ')}` : ''
  ].filter(Boolean);
  if (remembered.length) {
    factLines.push(`${isRoman ? 'Is baat cheet se yaad' : 'Carried from this conversation'}: ${remembered.slice(0, 8).join('; ')}`);
  }
  add('identify_facts', isRoman ? 'Haqaiq' : 'Stated facts', factLines.length
    ? factLines.join(' · ')
    : (isRoman ? 'Aap ne koi wazeh tareekh, raqqam ya qanoon nahi likha — haal-e-waqia batayein to jawab behtar hoga.'
      : 'No date, amount, place or law was stated in the message — the more of these you add, the more precise the answer.'));

  // 3 — jurisdiction, domain and procedure type (from the message + the router,
  //     falling back to what an earlier turn already established).
  const provinces = [...new Set(facts.cities.map(c => CITIES[c]))];
  const jurLines = [
    provinces.length ? `${isRoman ? 'Ilaqa' : 'Local layer'}: ${provinces.join(', ')}`
      : (ctx.location || ctx.jurisdiction ? `${isRoman ? 'Ilaqa (pehle se)' : 'Local layer (stated earlier)'}: ${ctx.location || ctx.jurisdiction}` : ''),
    frame.intent.overseas
      ? `${isRoman ? 'Ghair mulki layer' : 'Foreign layer'}: ${frame.intent.country || 'another country'}${frame.intent.purpose ? ` (${frame.intent.purpose})` : ''} — ${isRoman ? 'us mulk ke rules sirf official source se tasdeeq karein' : 'its current rules must come from the official source'}`
      : (isRoman ? 'Koi ghair mulki layer zahir nahi — Pakistan ka qanoon' : 'No foreign layer stated — Pakistan law'),
    `${isRoman ? 'Qisam' : 'Type'}: ${frame.intent.procedure ? (isRoman ? 'procedure/court process' : 'procedure / court process') : (isRoman ? 'substantive haq ka masla' : 'substantive rights question')}`
  ].filter(Boolean);
  if (ctx.institution && !facts.cities.length) {
    jurLines.push(`${isRoman ? 'Idara (pehle se)' : 'Institution (stated earlier)'}: ${ctx.institution}`);
  }
  add('determine_jurisdiction', isRoman ? 'Jurisdiction aur domain' : 'Jurisdiction, domain, procedure', quotedList(jurLines));

  // 4 + 5 + 6 — retrieve, judge the evidence, correct within the bounded loop.
  // A caller that already ran the gate (the agent endpoint, which caches it)
  // hands the result over, so the bounded correction loop never runs twice.
  const retrieval = (providedRetrieval && providedRetrieval.evidence)
    ? providedRetrieval
    : await retrieveCorrected(message, { isOnline, apiKey });
  const ev = retrieval.evidence || { verdict: 'weak', supportedCount: (retrieval.chunks || []).length, rejected: 0, reasons: [] };
  const corr = retrieval.correction || { attempts: 0, strategies: [] };
  add('retrieve_records', isRoman ? 'Records dhoondna' : 'Retrieval',
    isRoman ? `${(retrieval.chunks || []).length} verified records, domain ${retrieval.domain}`
      : `${(retrieval.chunks || []).length} verified record(s) kept, subject area ${retrieval.domain}`);
  add('evaluate_evidence', isRoman ? 'Saboot ka tajzia' : 'Evidence quality',
    `${isRoman ? 'Faisla' : 'Verdict'}: ${ev.verdict}`
    + (ev.reasons && ev.reasons.length ? ` — ${ev.reasons.join(', ')}` : '')
    + (ev.top ? ` — ${isRoman ? 'sab se qareeb record' : 'closest record'}: ${ev.top.docId}` : ''));
  add('correct_retrieval', isRoman ? 'Dhoond ki tashih' : 'Retrieval correction',
    corr.attempts
      ? `${isRoman ? `${corr.attempts} tashih koshish(en): ${corr.strategies.slice(1).join(' → ')}` : `${corr.attempts} corrective attempt(s): ${corr.strategies.slice(1).join(' → ')}`}`
      : (isRoman ? 'pehli koshish kaafi thi — koi tashih nahi chahiye thi' : 'the first pass was accepted — no correction was needed'));

  // 7 — scope-aware evidence selection: which layer the answer may speak from.
  const sc = ev.scope;
  if (sc) {
    const layer = l => scopeLayerName(l, sc.asked, isRoman ? 'roman_urdu' : 'en');
    const scopeLines = [
      `${isRoman ? 'Dhoond ka tarteeb' : 'Specificity order'}: ${(sc.ladder || []).map(layer).join(' → ')}`,
      sc.covered && sc.covered.length
        ? `${isRoman ? 'Records kis layer se' : 'Kept records are'}: ${[...new Set(sc.covered)].map(layer).join(', ')}`
        : `${isRoman ? 'Koi verified record nahi raha' : 'No record was kept'}`,
      sc.mismatch ? `${isRoman ? 'Hataya gaya' : 'Set aside'}: ${sc.mismatch}` : '',
      sc.missingTop
        ? `${isRoman ? 'Aap ne kaha tha' : 'Asked for'}: ${layer(sc.missingTop)} — ${isRoman ? 'corpus mein ye record nahi' : 'no such record in the corpus'}`
        : ''
    ].filter(Boolean);
    add('select_by_scope', isRoman ? 'Scope ke mutabiq intekhab' : 'Scope-aware selection', quotedList(scopeLines));
  }

  // Structured client intake — assembled from this message, the carried context
  // and the verified retrieval metadata only. Never a new legal claim.
  const intake = deriveIntake(message, context, retrieval);

  // 8 — the answer itself, at the requested difficulty level.
  const askedRef = /\b(?:section|sec|article|art|dafa|دفعہ)\s*\.?\s*\d+[a-z]?/i.test(message);
  const guard = (askedRef && (retrieval.chunks[0]?.exactScore || 0) < 8.0 && sectionNotFoundFor)
    ? sectionNotFoundFor(message, activeLang) : null;
  let body = '';
  if (guard) {
    body = guard;
  } else if ((retrieval.chunks || []).length === 0) {
    const stillNeeded = intake.missingMandatoryFacts.slice(0, 3);
    if (context && remembered.length && stillNeeded.length) {
      // Continuity: acknowledge what was already answered instead of re-asking it.
      body = isRoman
        ? `Aap ne pehle hi bata diya tha: ${remembered.slice(0, 5).join('; ')}. Verified records mein is exact point ka jawab nahi mila. Ab bas ye chahiye: ${stillNeeded.join('; ')}.`
        : `You already told me: ${remembered.slice(0, 5).join('; ')}. No verified record answers this exact point yet. What is still needed: ${stillNeeded.join('; ')}.`;
    } else {
      body = clarificationFor(message, activeLang);
    }
  } else {
    body = composeOwnedModelAnswer(message, retrieval.chunks, activeLang, retrieval.domain, lvlName, {
      verdict: ev.verdict, supportedCount: ev.supportedCount, rejected: ev.rejected,
      corrections: corr.attempts, scope: ev.scope || null, institutionQuery: ev.institutionQuery || null
    });
    if (retrieval.domain === 'cross-border') {
      const nudge = crossBorderFor(message, activeLang);
      if (nudge) body += nudge;
    }
  }
  // The composer only ever sees this message and the retrieved records, so a
  // party, amount, date or document the user already gave would be collected
  // into the intake and then dropped from the reply. Carry it in verbatim;
  // nothing here is a new fact, and anything restated below is skipped.
  const recap = carriedFactsForReply(intake, message, isRoman);
  if (recap) body = `${body}\n\n${recap}`;
  add('explain_at_level', isRoman ? `Jawab (${lvl.label})` : `Explained at ${lvl.label} level`,
    `${lvl.sources} source line(s) · ${lvl.steps} step line(s) · ${lvl.legalBasis ? `${lvl.legalBasis} provision reference(s)` : 'no provision list'}${lvl.precedent ? ' · case law where retrieved' : ''}`);

  // 9 — practical options, from the procedure records that were kept.
  const procChunks = (retrieval.chunks || []).filter(c => /procedur|workflow|order|steps|process|marahil/i.test(
    `${c.documentType || ''} ${c.chunkTitle || ''} ${c.key || ''} ${c.title || ''}`));
  add('practical_options', isRoman ? 'Amli ikhtiyar' : 'Practical options', procChunks.length
    ? (isRoman ? `${procChunks.length} procedure record(s) is jawab ke steps support karte hain` : `${procChunks.length} procedure record(s) back the steps given in this answer`)
    : (isRoman ? 'is jawab ke liye koi procedure record nahi mila — steps sirf aam qadam hain' : 'no procedure record matched, so the steps above stay general'));

  // 10 — forum / authority, only where a retrieved record states one.
  const askedServices = askedServiceSet(message);
  const forums = [...new Set((retrieval.chunks || []).slice(0, lvl.chunkCap)
    .map(c => [c.jurisdiction, recordAuthority(c)].filter(Boolean).join(' · ')).filter(Boolean))];
  add('forum_authority', isRoman ? 'Adalat / authority' : 'Forum / authority', forums.length
    ? forums.slice(0, 3).join(' | ')
    : (isRoman ? 'koi forum record mein zikr nahi — adalat/office ki tasdeeq karein' : 'no forum stated in the records — confirm the office/court'));

  // 11 — cautious references: only what was actually retrieved.
  const refs = (retrieval.chunks || []).slice(0, lvl.sources).map(c => {
    // Only legislation records number their entries by statutory section; guide
    // and directory entries are sequential, so their key is not a citation.
    const numbered = /^\d+[a-z]*$/i.test(String(c.key)) || /^ORDER_/i.test(String(c.key));
    const prov = (numbered && String(c.documentType || '') === 'Legislation')
      ? `${c.type === 'ARTICLE' ? 'Article' : 'Section'} ${c.key} — ` : '';
    return `${prov}${c.title}${c.sourceURL ? ` (${c.sourceURL})` : ''}`;
  });
  add('legal_references', isRoman ? 'Qanooni hawale' : 'Cautious references', refs.length
    ? (isRoman ? `Sirf yeh records is jawab ne dekhe hain: ${refs.join(' | ')}` : `Only these retrieved records back the answer: ${refs.join(' | ')}`)
    : '');

  // A refusal or a clarifying question is not verified law — the header must
  // not claim a verification level for text that cites no retrieved record.
  const isRefusalOnly = Boolean(guard) || (retrieval.chunks || []).length === 0;

  return {
    reply: headerFor(activeLang, isRefusalOnly ? 'refusal' : (ev && ev.verdict)) + body,
    steps,
    intake,
    evidence: { ...ev, top: ev.top ? { docId: ev.top.docId, score: ev.top.score, coverage: ev.top.coverage } : null },
    correction: corr,
    answerLevel: lvlName,
    domain: retrieval.domain,
    relevance: retrieval.relevance,
    detectedLang: retrieval.detectedLang,
    sources: (retrieval.chunks || []).slice(0, 4).map(c => ({
      title: c.title, authority: recordAuthority(c), type: c.type, key: c.key,
      jurisdiction: c.jurisdiction, sourceURL: recordSource(c, askedServices), domain: retrieval.domain
    })),
    chunkCount: (retrieval.chunks || []).length
  };
}
