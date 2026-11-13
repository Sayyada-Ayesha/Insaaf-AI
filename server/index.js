import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { RAGEngine, parseOverseasIntent } from './ragEngine.js';
import { detectWrittenLanguage } from './languageDetect.js';
import { AIProviderFactory } from './aiProviders.js';
import { composeOwnedModelAnswer, isLegalProblemQuery, askClarification, crossBorderNudge, displayTitle, isCorpusMetaLine, rankRecords, policyFamilyOrder, askedServiceSet, recordServiceSet, scopePoolToServices, recordSource, recordAuthority } from './ownedModel.js';
import { detectQueryScope, deriveChunkScope } from './corpusScope.js';
import { authorizer as civicAuthorizer, getAdmin as getFirebaseAdmin, authBackendStatus } from './authz.js';
import { createCivicRouter, createFirestoreStore } from './civicRoutes.js';
import { createCommunityRouter, createCommunityStore } from './communityRoutes.js';
import { createAdminRouter, createAdminServices } from './adminRoutes.js';
import { createSupportRouter } from './appSupport.js';
import { createUpdateRouter, defaultFetcher as updateFetcher } from './updateRoutes.js';
import { initRegistry as initUpdateRegistry, loadSources as loadUpdateSources, sweep as sweepUpdateSources, startScheduler as startUpdateScheduler, describeScheduler as describeUpdateScheduler } from './updatePipeline.js';
import { documentMetadata } from './corpusMetadata.js';
import { findProvisionRefs, askedProvisionKeys, chunkCarriesProvision } from './provisionRef.js';
import { retrieveCorrected, normalizeAnswerLevel, answerLevelInstruction, ANSWER_LEVELS, MAX_CORRECTIVE_ATTEMPTS } from './evidenceGate.js';
import { retrieveIslamic, composeIslamicAnswer, composeCombinedAnswer, asksAboutLaw } from './islamicGuidance.js';
import { buildAssignmentPack } from './assignmentTools.js';
import { runLegalAgent, sanitizeAgentContext, deriveIntake } from './legalAgent.js';
import { buildComplaintDraft, buildLawyerBrief } from './incidentDocuments.js';
import { auditCitations, citationAdvisory } from './citationAudit.js';
import { resolveEverydayIntent, everydayClarification, everydayUnverifiedNote, bareComplaintClarification } from './everydayIntent.js';
import { normalizeHistory, resolveThread } from './conversationContext.js';
import { answerWithModel, modelInferenceEnabled, modelInferenceConfigured, modelInferenceHealth } from './modelInferenceClient.js';
import { getModelStatus, publicModelStatus } from './modelStatus.js';
import { analyzeDocumentText, draftFromDocument, applyLocalEdit, explainDocumentType, INSAF_DOC_FOOTER, renderFullLegalDocument, composeDraftFromRequest, compareDocumentsLocal, getReadinessChecklist, assessDocumentReadability } from './docModel.js';
import { renderUrduOfflineDocument } from './docUrdu.js';
import { fillCourtLineTokens } from './courtLineTokens.js';
import { asksForeignRule, foreignRuleSubject } from './askedJurisdiction.js';

dotenv.config();

// P23 cloud readiness: anchor corpus paths to this file's directory so the
// server works from any working directory (containers, PM2, systemd, ...).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAG_ROOT = path.join(__dirname, '..', 'rag');

// P11 hygiene — court/authority captions embedded in ONLINE drafting prompts are
// cleaned like the offline renderers clean them: each seed token is filled from
// the request's own details map and anything still unresolved is stripped, so a
// live provider can never echo a raw "[CITY]"-style template token into a user's
// document (the values themselves are already passed to the model separately).
function promptCourtLine(structure, details) {
  if (!structure || !structure.courtLine) return '';
  const M = {};
  String(details || '').split(/,(?=\s*[A-Za-z][\w]*\s*:)/).forEach((part) => {
    const idx = part.indexOf(':');
    if (idx === -1) return;
    const k = part.substring(0, idx).trim();
    const v = part.substring(idx + 1).trim();
    if (k && v && !/^[\s_]+$/.test(v)) M[k] = v;
  });
  return fillCourtLineTokens(structure.courtLine, (...names) => { for (const n of names) if (M[n]) return M[n]; return null; });
}

const app = express();
const PORT = process.env.PORT || 3001;

// §5E: Express advertises itself by default; the version is of no use to a client
// and only helps an attacker fingerprint the stack.
app.disable('x-powered-by');

// §5D: behind one reverse proxy req.ip is otherwise the proxy's address, which
// would collapse every user into a single rate-limit bucket. Opt-in so local
// behaviour (direct socket address, no header honoured) is unchanged.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// P21 security: CORS is restricted to local development origins and the
// configured production app URL. Non-browser clients (no Origin header) pass.
const APP_URL = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    try {
      const host = new URL(origin).hostname;
      const normalized = origin.replace(/\/+$/, '');
      if (host === 'localhost' || host === '127.0.0.1' || (APP_URL && normalized === APP_URL)) {
        return callback(null, true);
      }
    } catch {
      // malformed origin — reject below
    }
    callback(null, false);
  }
}));
app.use(express.json({ limit: '15mb' }));

// P21 security: baseline response headers for every API route
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // microphone must stay available to our own origin — the Voice Agent is
  // browser Web Speech and has no other capture path. An empty list here would
  // deny the mic to ourselves and silently deaden the feature.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  next();
});


const aiProvider = AIProviderFactory.getProvider();

// Part C/AE — the owned-model runtime is fully LOCAL. Generation runs through the
// corpus composer (empty online chain) and RAG retrieval must NOT trigger hidden
// external embedding calls: ragSemanticOnline is permanently false and semantic
// retrieval always uses the local embedder. Voice (speech recognition and
// synthesis) is a browser-only Web Speech feature, is not an AI provider, and is
// never affected by this flag.
const _primaryProvider = (process.env.AI_PROVIDER || 'insaaf').toLowerCase().trim();
const isOwnedModelPrimary = _primaryProvider === 'insaaf' || _primaryProvider === 'insaaf-owned' || _primaryProvider === 'owned';
const ragSemanticOnline = false; // local embedder only

// Cost Control Global State (P45 & P47)
const metrics = {
  provider: process.env.AI_PROVIDER || 'insaaf',
  requestCount: 0,
  retrievalOnlyResponses: 0,
  aiGeneratedResponses: 0,
  cacheHits: 0,
  cacheMisses: 0,
  ragCacheHits: 0,
  ragCacheMisses: 0,
  // Corrective-RAG gate counters (Part 1/2): how often the first retrieval pass
  // was accepted as-is, how often a bounded correction ran, and how often the
  // gate refused to answer from weak evidence.
  evidenceStrong: 0,
  evidenceWeakRetried: 0,
  evidenceRejected: 0,
  correctiveRetrievals: 0,
  estimatedTokens: 0
};

const responseCache = new Map();
const ragCache = new Map();

/**
 * Privacy (Phase 3 §E): both caches used to be keyed by the question typed into the
 * box, so every query the service answered stayed in process memory as readable text
 * — reachable by a heap dump, a crash artefact or anything that logs the Map. The key
 * is now a per-process-salted digest: the same question still hits the same entry, but
 * no raw prompt text is retained to be indexed.
 *
 * Answers are safe to share across callers because they are composed from the verified
 * corpus for (question, language, answer level) alone; nothing in a cached answer comes
 * from another user's saved records, chats or drafts.
 */
const CACHE_PEPPER = crypto.randomBytes(16);
function cacheKeyFor(prefix, rawQuery, ...parts) {
  const h = crypto.createHash('sha256');
  h.update(CACHE_PEPPER);
  h.update('\u0000');
  h.update(String(rawQuery || '').trim().toLowerCase());
  for (const p of parts) h.update('\u0000' + String(p ?? ''));
  return `${prefix}_${h.digest('hex').slice(0, 40)}`;
}

// P23 cloud readiness: bound the in-memory response cache so long-running
// deployments never grow memory without limit.
const RESPONSE_CACHE_MAX_ENTRIES = 500;
function cacheResponse(key, value) {
  if (responseCache.size >= RESPONSE_CACHE_MAX_ENTRIES) {
    responseCache.clear();
  }
  responseCache.set(key, value);
}

// ragCache is keyed by every unique query, so it needs the same ceiling: an
// uncapped Map grows process memory for as long as the service runs.
const RAG_CACHE_MAX_ENTRIES = 500;
function cacheRagResult(key, value) {
  if (ragCache.size >= RAG_CACHE_MAX_ENTRIES) ragCache.clear();
  ragCache.set(key, value);
}

// Record the corrective-RAG gate outcome of one retrieval (no-op when the
// result carries no gate diagnostics, e.g. a cached pre-gate entry).
function gateMetrics(retrieval) {
  const ev = retrieval && retrieval.evidence;
  if (!ev) return;
  const attempts = (retrieval.correction && retrieval.correction.attempts) || 0;
  if (ev.verdict === 'strong') metrics.evidenceStrong++;
  else if (ev.verdict === 'none') metrics.evidenceRejected++;
  if (attempts > 0) metrics.evidenceWeakRetried++;
  metrics.correctiveRetrievals += attempts;
}

/** Evidence-gate diagnostics for a response payload ({} for pre-gate results).
 * `correction` is a sibling of `evidence`, not a field inside it: the gate is a
 * quality layer ABOVE retrieval, so verdict/attempts/strategies describe one
 * bounded correction loop rather than any single record. Per-attempt rows are
 * returned only outside production — they are harness diagnostics, not
 * something a user needs to see, and the reformulated query text stays inside
 * the server entirely. */
function gatePayload(retrieval) {
  const ev = retrieval && retrieval.evidence;
  if (!ev) return {};
  const corr = (retrieval && retrieval.correction) || {};
  const attempts = corr.attempts || 0;
  return {
    evidence: {
      verdict: ev.verdict,
      reasons: ev.reasons,
      domain: ev.domain,
      supportedCount: ev.supportedCount,
      rejected: ev.rejected,
      ...(ev.scope ? { scope: ev.scope } : {}),
      ...(!IS_PRODUCTION && ev.top
        ? { quality: { docId: ev.top.docId, score: ev.top.score, exact: ev.top.exact, coverage: ev.top.coverage, ownHits: ev.top.ownHits } }
        : {})
    },
    correction: {
      attempts,
      maxAttempts: corr.maxAttempts || MAX_CORRECTIVE_ATTEMPTS,
      triggered: attempts > 0,
      strategies: corr.strategies || [],
      ...(!IS_PRODUCTION && Array.isArray(corr.detail)
        ? { detail: corr.detail.map(d => ({ n: d.n, strategy: d.strategy, verdict: d.verdict, chunks: d.chunks, online: !!d.online })) }
        : {})
    },
    relevance: retrieval.relevance
      || (ev.verdict === 'strong' ? 'high' : (ev.supportedCount > 0 ? 'low' : 'none'))
  };
}

/**
 * The evidence object of a clarification, built from the gate's own payload rather
 * than copied by hand. Each route used to write its own literal and each copy
 * dropped `domain` — so a citizen asking "tenant ke sath masla hai" got a question
 * back with no record of which subject the system was asking about, and nothing
 * downstream (Library routing, the evaluator, the voice screen) could tell whether
 * the right domain had even been routed.
 */
function clarifyEvidence(retrieval, extra = {}) {
  const base = gatePayload(retrieval).evidence
    || { verdict: 'clarify', reasons: [], domain: null, supportedCount: 0, rejected: 0 };
  return { ...base, verdict: 'clarify', ...extra };
}

// With the owned-model runtime the chain is always empty, so this always rejects
// and each caller composes its answer from the offline composer inside its catch
// block. The rejection is the normal path; the catch is the renderer.
async function generateWithFallback(prompt, sysPrompt) {
  const chain = AIProviderFactory.getFallbackChain();
  let lastError = null;
  for (const provider of chain) {
    try {
      return await provider.generateContent(prompt, sysPrompt);
    } catch (err) {
      console.warn(`[Backend] Provider ${provider.getProviderName()} error:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error('All AI providers failed.');
}

// Strip markdown code fences (e.g. ```json ... ```) from AI JSON responses
function extractJson(text) {
  return String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

// Invalidation tracker based on index file mtime (P47)
let lastIndexModified = 0;
const INDEX_FILE_PATH = path.join(RAG_ROOT, 'indexes', 'rag_index.json');
try {
  if (fs.existsSync(INDEX_FILE_PATH)) {
    lastIndexModified = fs.statSync(INDEX_FILE_PATH).mtimeMs;
  }
} catch (e) {
  console.warn('[Cache] Could not read mtime of index file:', e.message);
}

function checkCacheInvalidation() {
  try {
    if (fs.existsSync(INDEX_FILE_PATH)) {
      const mtime = fs.statSync(INDEX_FILE_PATH).mtimeMs;
      if (lastIndexModified !== 0 && mtime !== lastIndexModified) {
        console.log(`[Cache Invalidation] RAG index rebuilt (mtime changed from ${lastIndexModified} to ${mtime}). Clearing caches.`);
        responseCache.clear();
        ragCache.clear();
        lastIndexModified = mtime;
      } else if (lastIndexModified === 0) {
        lastIndexModified = mtime;
      }
    }
  } catch (e) {
    // Fail silently
  }
}

// F3 Performance: development-only timing diagnostics (retrieval_ms / provider_ms / total_ms).
// Always printed to the backend console; never exposed to ordinary users in production.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
function logTimings(endpoint, timings) {
  const parts = [`retrieval_ms=${timings.retrieval_ms}`, `provider_ms=${timings.provider_ms}`, `total_ms=${timings.total_ms}`];
  if (timings.cached) parts.push(`cached=${timings.cached}`);
  console.log(`[TIMING] ${endpoint} ${parts.join(' ')}`);
}
function debugTimingsPayload(timings) {
  return IS_PRODUCTION ? null : { debugTimings: { retrieval_ms: timings.retrieval_ms, provider_ms: timings.provider_ms, total_ms: timings.total_ms } };
}

function isSafeToCache(query, domain) {
  const lowercase = (query || '').toLowerCase().trim();
  const personalTerms = /\b(my|me|i|mine|we|our|us|husband|wife|son|daughter|father|mother|brother|sister|stole|stolen|harass|harassing|blackmail|blackmailing|hacked|hack|threatened|threat|dhamki|dhoka)\b/i;
  if (personalTerms.test(lowercase)) {
    return false;
  }
  const safeDomains = ['rights', 'civil', 'criminal', 'cyber', 'labour', 'consumer', 'procedure', 'legal-aid'];
  return safeDomains.includes(domain);
}

function isPureLookupQuery(query, exactSectionKeys) {
  if (!exactSectionKeys || exactSectionKeys.length === 0) return false;
  const cleanQuery = query.toLowerCase().trim();
  const lookupPatterns = /\b(what is|what’s|define|explain|show|read|section|sec|article|art|provision|daraf|dafa|qanoon|law)\b/i;
  const sazaPatterns = /\b(saza|punishment|penalty|fine|jurmana)\b/i;
  if (/\b(my|me|i|mine|we|our|us|husband|wife)\b/i.test(cleanQuery)) return false;
  return lookupPatterns.test(cleanQuery) || sazaPatterns.test(cleanQuery)
    || /^(section|sections|article|articles|art|sec|dafa|دفعہ)\s*\.?\s*\d+[a-f]?(?:[-\s][a-f0-9]{1,2})?$/i.test(cleanQuery);
}

// '154-A', '154a' and '154 A' are the same provision, so keys are compared in
// one normalized form before anything is called a match. The shared grammar also
// keeps the letter suffix: "Section 489-F" is provision 489f, never 489.

// One number is not one provision: CrPC §154 and Contract Act §154 are different
// laws, so a lookup has to be answered from the law the user named, never from
// whichever same-numbered record keyword retrieval happened to rank first.
const LAW_NAME_TERMS = /\b(criminal procedure|civil procedure|penal code|contract act|muslim family|family laws|qanun.?e.?shahadat|evidence act|limitation act|constitution|tenancy|rent restriction|rent act|labour law|labor law|consumer|education act|banking companies|company act|companies act|accountability|anti-terrorism|terrorism|elections act|arbitration|competition|immigration|passport|citizenship|prisons|environmental protection|juvenile|provincial|punjab|sindh|balochistan|khyber|pakhtunkhwa|islamabad|electronic crimes|peca|women protection|domestic violence|child marriage|land revenue|registration act|negotiable instruments|sale of goods|specific relief|police order|crpc|ppc|ipc|cpc|qso|mflo)\b/gi;
const LAW_ACRONYM_EXPANSIONS = { crpc: 'criminal procedure', ppc: 'penal code', ipc: 'penal code', cpc: 'civil procedure', qso: 'qanun shahadat', mflo: 'muslim family' };

function namedLawTerms(query) {
  const found = String(query || '').toLowerCase().match(LAW_NAME_TERMS) || [];
  return [...new Set(found.flatMap(t => (LAW_ACRONYM_EXPANSIONS[t] ? [t, LAW_ACRONYM_EXPANSIONS[t]] : [t])))];
}

function chunkLawIdentity(c) {
  return `${c.title || ''} ${c.jurisdiction || ''} ${c.issuingAuthority || ''}`.toLowerCase();
}

// A numbered lookup is answered only from records that actually carry that
// number. { refusal } means the asked provision exists nowhere in the retrieved
// corpus — the next-best keyword match is a DIFFERENT law and must never be
// substituted for it. { text } is the verified direct answer.
function directLookupAnswer(userQuery, retrievedChunks, activeLang) {
  const askedKeys = askedProvisionKeys(userQuery);
  const askedTypes = [...new Set(findProvisionRefs(userQuery).map(r => r.type))];
  // A record of a different provision type is a different instrument: "Article 25"
  // must not be answered from "Section 25" of a procedural code.
  const typeAllows = c => askedTypes.length === 0
    || askedTypes.includes(c.type)
    || !['SECTION', 'ARTICLE'].includes(c.type);
  if (askedKeys.length) {
    const exactKeyChunks = retrievedChunks.filter(c => chunkCarriesProvision(c, askedKeys) && typeAllows(c));
    if (exactKeyChunks.length === 0) {
      return { refusal: `${offlineKnowledgeHeader(activeLang, 'refusal')}\n\n${sectionNotFoundText(userQuery, activeLang)}` };
    }
    const lawTerms = namedLawTerms(userQuery);
    if (lawTerms.length > 0) {
      const namedLawChunks = exactKeyChunks.filter(c => lawTerms.some(t => chunkLawIdentity(c).includes(t)));
      if (namedLawChunks.length === 0) {
        return { refusal: `${offlineKnowledgeHeader(activeLang, 'refusal')}\n\n${sectionNotFoundText(userQuery, activeLang)}` };
      }
      const shown = namedLawChunks.slice(0, 3);
      return { text: formatDirectResponse(shown, activeLang), chunks: shown };
    }
    const topTitle = (retrievedChunks[0] || {}).title;
    const sameLaw = topTitle ? exactKeyChunks.filter(c => c.title === topTitle) : [];
    const shown = sameLaw.length > 0 ? sameLaw.slice(0, 3) : exactKeyChunks.slice(0, 1);
    return { text: formatDirectResponse(shown, activeLang), chunks: shown };
  }
  const shown = retrievedChunks.slice(0, 3);
  return { text: formatDirectResponse(shown, activeLang), chunks: shown };
}

// Ingest labels are corpus plumbing, not law: a source card must never show
// "WING:", "SUBSTANCE:", "COVERAGE:" or a verification note to the reader.
function stripCorpusMeta(text) {
  return String(text || '')
    .replace(/\b(?:WING|OFFICE|COVERAGE|SOURCE|VERIFICATION)\s*:[^.\n]*(?:\.|$)/gi, ' ')
    .split(/\r?\n/)
    .filter(l => !/^\s*(?:source|wing|office|verification)\s*:/i.test(l))
    .map(l => l.replace(/^\s*substance\s*:\s*/i, '').replace(/\s{2,}/g, ' ').trim())
    .join('\n')
    .trim();
}

function toSourceMeta(chunks, domain, forQuery = null) {
  // The manifest carries ONE sourceURL/issuingAuthority per document, while a
  // civic document holds several services. Resolved per record, exactly as the
  // composer resolves the citation it prints, so an evidence card cannot show a
  // NADRA card URL under a DGIP passport excerpt.
  const asked = forQuery ? askedServiceSet(forQuery) : new Set();
  const seen = new Set();
  const cards = [];
  for (const c of chunks || []) {
    const card = {
      title: c.title,
      authority: recordAuthority(c),
      jurisdiction: c.jurisdiction,
      type: c.type,
      key: c.key,
      legalStatus: c.legalStatus,
      version: c.version,
      sourceURL: recordSource(c, asked),
      domain, // F14: powers "Open in Insaaf AI Library"
      text: stripCorpusMeta(c.text)
    };
    // Retrieval returns several chunks of the same document; the citizen reads
    // ONE card per authority and document, not the same title eleven times.
    const id = `${card.title}|${card.authority || ''}|${card.sourceURL || ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    cards.push(card);
    if (cards.length >= 6) break;
  }
  return cards;
}

/**
 * Source metadata must describe the records the ANSWER was built from, so it must
 * be built from the SAME pool the composer answers from: the level's cap, the
 * records tagged to the service actually asked about, then the question's own
 * words. Emitting raw retrieval order can pair a rules answer with a scholarship
 * excerpt, or a passport answer with a NADRA card record the composer dropped.
 * Records are never added, removed or re-scored here.
 */
function answerEvidenceOrder(userQuery, chunks, answerLevel = 'beginner') {
  const lvl = ANSWER_LEVELS[normalizeAnswerLevel(answerLevel)];
  const asked = askedServiceSet(userQuery);
  const pool = scopePoolToServices((chunks || []).slice(0, lvl.chunkCap), asked);
  const ranked = policyFamilyOrder(userQuery, rankRecords(userQuery, pool));
  // GCU-D3: a question naming ONE institution is about that institution's own
  // office. Consumer-protection and FIA records ride in on the shared words "fee
  // / charge / refund" and then appear as evidence for a university counter. They
  // leave THIS question's cards only — an actual FIA or consumer query names no
  // institution and keeps every one of them.
  const askedHere = detectQueryScope(userQuery);
  if (askedHere && askedHere.institutionNamed) {
    const who = String(askedHere.institutionNamed).toLowerCase();
    const kept = ranked.filter(c => {
      const s = deriveChunkScope(c);
      if (s && (s.scopeLevel === 'university' || s.sector === 'institutional' || s.studentRelevant)) return true;
      const own = `${c.title || ''} ${c.chunkTitle || ''} ${c.text || ''}`.toLowerCase();
      return own.includes(who);
    });
    // Never answer an institution question with zero evidence because a filter
    // swept the board: the unfiltered ranking goes back to the gate instead.
    if (kept.length) return kept;
  }
  // A question naming a BISP/8171 programme is answered from BISP's own published
  // records. Records that ride in on the shared words "payment", "registration"
  // or "complaint" — a passport workflow, a scholarship policy, a Supreme Court
  // judgment — must not fill the four cards a citizen reads as the authority for
  // that programme. Nothing here is deleted: the cards are a slice of this list,
  // so a non-BISP record simply yields its place underneath, and the rule only
  // runs when a BISP record is already in the pool, so no question is left
  // without evidence.
  const asksBispProgramme = /\b(bisp|8171|kafaalat|kifalat|kafalat|nashonuma|taleemi|wazaif|benazir)\b/i.test(userQuery || '')
    || /(بینظیر|کفالت|نشونما|تعلیمی\s*وظائف)/.test(userQuery || '');
  const isBispRecord = (c) => String(c.docId || '') === 'bisp_8171_programme_procedures'
    || /benazir income support/i.test(String(c.issuingAuthority || ''));
  if (asksBispProgramme && ranked.some(isBispRecord)) {
    const ordered = ranked
      .map((c, i) => ({ c, i, bisp: isBispRecord(c) ? 0 : 1 }))
      .sort((a, b) => (a.bisp - b.bisp) || (a.i - b.i))
      .map(x => x.c);
    // Demotion alone still left one unrelated record inside the four visible
    // cards, so where BISP's own records are numerous enough to stand on their
    // own the card list carries only them. A pool with a single BISP record is
    // left as the ordered whole — such an answer genuinely needs the second.
    const bispOnly = ordered.filter(isBispRecord);
    return bispOnly.length >= 2 ? bispOnly : ordered;
  }
  if (asked.size < 2) return ranked;
  // A question naming two services is answered by a record that covers both.
  // Word overlap alone put a single-service record, or a numbered provision that
  // only mentions a card, at the head of a comparison answer. Nothing is dropped:
  // a record covering fewer asked services simply yields its place.
  const covers = (c) => {
    const mine = recordServiceSet(c);
    let n = 0;
    for (const s of asked) if (mine.has(s)) n += 1;
    return n;
  };
  return ranked
    .map((c, i) => ({ c, i, n: covers(c) }))
    .sort((a, b) => (b.n - a.n) || (a.i - b.i))
    .map(x => x.c);
}

function formatDirectResponse(retrievedChunks, detectedLang) {
  const isUr = detectedLang === 'ur';
  const isRoman = detectedLang === 'roman_urdu';
  let text = isUr ? `**متعلقہ قانون**\n\n` : isRoman ? `**Laagu hone wala qanoon**\n\n` : `**Relevant law**\n\n`;
  if (isUr) {
    text += `یہ عبارت براہِ راست مستند قانونی ذخیرے سے لی گئی ہے اور اس میں کوئی تخلیقی اضافہ نہیں کیا گیا۔ قانونی عبارت انگریزی میں نقل کی گئی ہے تاکہ آپ اسے اصل دستاویز سے مل سکیں۔\n\n---\n\n`;
  } else if (isRoman) {
    text += `Yeh ibarat seedha verified qanooni zakhire se li gayi hai — is mein koi AI ka izafa nahi. Qanooni matan angrezi mein naqal kiya gaya hai taake aap use asal document se mila sakein.\n\n---\n\n`;
  } else {
    text += `*This information is retrieved directly from the verified law corpus without AI generation.*\n\n---\n\n`;
  }
  
  retrievedChunks.forEach((c) => {
    const isCaseLaw = /case_|judg|LHC_|SC_|PLD|CLC|PCrLJ|YLR/i.test(String(c.key || '')) || /VERBATIM|FULL_TEXT/i.test(String(c.text || '').substring(0, 200));
    const maxLen = isCaseLaw ? 200 : 800;
    let chunkText = String(c.text || '').split('\n')
      .filter(l => !isCorpusMetaLine(l) && !/^\s*(?:wing|office|source|verification)\s*:/i.test(l))
      .map(l => l.replace(/^\s*substance\s*:\s*/i, ''))
      .join('\n').trim();
    if (chunkText.length > maxLen) {
      chunkText = chunkText.slice(0, maxLen);
      const lastPeriod = chunkText.lastIndexOf('.');
      if (lastPeriod > maxLen * 0.5) chunkText = chunkText.slice(0, lastPeriod + 1);
      chunkText += ' [...]';
    }
    // A record key is a filing label, not a citation: only a real section /
    // article number may be printed in front of a reader.
    const numberedKey = /^\d+[A-Za-z]*(?:\([0-9ivxIVX]+\))?$/.test(String(c.key || ''));
    const citeLabel = numberedKey ? `${c.type === 'ARTICLE' ? 'Article' : 'Section'} ${c.key} — ` : '';
    text += `### ${citeLabel}${displayTitle(c.chunkTitle || c.title)}\n\n`;
    text += `${chunkText}\n\n`;
  });
  
  text += `---\n\n**${isUr ? 'قانونی حوالے' : isRoman ? 'Qanooni hawalay' : 'Sources'}**\n\n`;
  retrievedChunks.forEach((c, i) => {
    const numberedKey = /^\d+[A-Za-z]*(?:\([0-9ivxIVX]+\))?$/.test(String(c.key || ''));
    const tail = numberedKey ? ` — ${c.type} ${c.key}` : '';
    text += `${i + 1}. [${displayTitle(c.title)}${tail}](${c.sourceURL})\n`;
  });
  
  return text;
}

// Neutral offline header — states that the knowledge is verified, never that a
// provider failed or that "Live AI" is down (internal state must not leak).
// 'refusal' is the case where the reply carries NO record: claiming the answer
// was "assembled from closest matching records" would assert verification that
// isn't there. Weak/none passes get no banner — the answer's own limitation note
// says what it rests on, without contradicting the answer it introduces.
function offlineKnowledgeHeader(activeLang, verdict, jurisdictionNote = '') {
  if (verdict === 'refusal') {
    if (activeLang === 'ur') {
      return `*میرے پاس موجود ریکارڈز اس سوال کا احاطہ نہیں کرتے، اس لیے نیچے کچھ بھی قانون کے طور پر پیش نہیں کیا جا رہا۔*\n\n`;
    }
    return activeLang === 'roman_urdu'
      ? `*Mere paas maujood records is sawal ko cover nahi karte, is liye neeche kuch bhi qanoon ke tor par pesh nahi kiya ja raha.*\n\n`
      : `*The records available to me do not cover this question, so nothing below is presented as law.*\n\n`;
  }
  // A weak/none pass that still produced an answer carries its own honest
  // limitation note, and the citizenship-facing partial-evidence banner read as
  // the answer contradicting itself ("part of this is not covered" above a
  // supported answer). Only a refusal with no record is framed.
  return jurisdictionNote;
}

// A national record cannot establish the rule of a territory the user named. When
// the query names a jurisdiction and none of the records actually being shown
// covers it, the answer carries that fact instead of implying local authority.
const JURISDICTION_CUES = [
  [/آزاد\s*جموں|ازاد\s*جموں|\bajk\b|azad\s*jammu|azad\s*kashmir/i, /azad|ajk|kashmir/i, 'Azad Jammu & Kashmir'],
  [/گلگت|بلتستان|\bgilgit\b|\bbaltistan\b/i, /gilgit|baltistan/i, 'Gilgit-Baltistan'],
];
function jurisdictionNoteFor(userQuery, chunks, activeLang) {
  const cue = JURISDICTION_CUES.find(([re]) => re.test(String(userQuery || '')));
  if (!cue) return '';
  const [, covers, label] = cue;
  const covered = (chunks || []).some((c) => covers.test(`${c.title || ''} ${c.jurisdiction || ''} ${c.text || ''}`));
  if (covered) return '';
  if (activeLang === 'ur') {
    return `*نوٹ: مستند قانونی ذخیرے میں ${label} کا اس موضوع سے متعلق کوئی قاعدہ موجود نہیں؛ نیچے دیے گئے ریکارڈ وفاقی یا کسی دوسرے علاقے کے ہیں اور ان کا آپ کے علاقے پر لاگو ہونا ضروری نہیں۔ عمل سے پہلے اس علاقے کے متعلقہ اختیار سے تصدیق کریں۔*\n\n`;
  }
  if (activeLang === 'roman_urdu') {
    return `*Note: verified law corpus mein ${label} ka is topic ka koi rule record nahi hai; neeche diye gaye records federal ya doosre ilaaqe ke hain aur in ka aap ke ilaaqe par laazim hona zaroori nahi. Amal se pehle us ilaaqe ke authority se tasdeeq karein.*\n\n`;
  }
  return `*Jurisdiction note: the verified corpus holds no ${label} instrument for this topic; the records below are federal or from another territory and may not be the rule that applies in ${label}. Confirm with that authority before acting.*\n\n`;
}

// Honest guard message: a query naming a specific section/article that has no
// exact verified match must not be answered with a keyword dump from a
// different law. Returns null when the guard does not apply.
function sectionNotFoundText(userQuery, activeLang) {
  const askedRef = (findProvisionRefs(userQuery)[0] || {}).raw || '';
  if (!askedRef) return null;
  if (activeLang === 'ur') {
    return `آپ کے پوچھے گئے حوالے (${askedRef}) کی مستند تفصیل قانونی ذخیرے میں نہیں ملی۔ براہِ کرم نمبر اور قانون دوبارہ جانچ لیں — مثلاً "چوری کی سزا پاکستان پنل کوڈ کے تحت" یا "آئین کے تحت برابری کا حق"۔`;
  }
  return activeLang === 'roman_urdu'
    ? `Aap ke pooche gaye hawale (${askedRef}) ki tasdeeq shuda tafseel verified law corpus mein nahi mili. Baraye meharbani number aur qanoon dobara check karein — maslan "chori ki saza Pakistan Penal Code ke tahat" ya "aain ke tahat barabari ka haq".`
    : `A direct verified match for "${askedRef}" was not found in the verified law corpus. Please double-check the number and the law — for example "punishment for theft under the Pakistan Penal Code" or "the right to equality under the Constitution".`;
}

// Legal / civic subjects a citizen actually asks about, in all three scripts. The
// off-topic guard below refuses only when NONE of these appears, so a real legal
// question can never be silenced by it — the near-miss answer path stays as is.
// Stopwords are deliberately excluded: a cue must name a subject, not a copula.
const LEGAL_CUES_EN = [
  'law', 'legal', 'legality', 'legislature', 'act', 'ordinance', 'amendment', 'section', 'article',
  'clause', 'subsection', 'penal', 'criminal', 'civil', 'offence', 'offense', 'crime', 'punishment',
  'punished', 'sentence', 'fine', 'penalt', 'jurisdiction', 'court', 'judge', 'bench', 'trial',
  'appeal', 'petition', 'revision', 'suit', 'plaint', 'defence', 'acquit', 'convict', 'bail', 'remand',
  'arrest', 'police', 'fir', 'challan', 'complaint', 'notice', 'summon', 'warrant', 'subsidiar',
  'case', 'verdict', 'hearing', 'witness', 'evidence', 'injunction', 'arbitration', 'mediation',
  'settlement', 'probate', 'dowry', 'mehr', 'lien', 'adjourn', 'contempt', 'perjury', 'defamation',
  'libel', 'slander', 'detention', 'kidnap', 'abduction', 'murder',
  'contract', 'agreement', 'deed', 'registry', 'registration', 'mutation', 'property', 'land',
  'tenant', 'tenancy', 'rent', 'evict', 'possession', 'encroach', 'marriage', 'nikah', 'talaq',
  'divorce', 'khula', 'custody', 'maintenance', 'guardian', 'inheritance', 'estate', 'heir',
  'employer', 'employee', 'employment', 'salary', 'wage', 'appointment', 'termination', 'dismissal',
  'suspension', 'departmental', 'disciplinary', 'labour', 'labor', 'union', 'consumer', 'refund',
  'warranty', 'education', 'student', 'school', 'college', 'university', 'admission', 'examination',
  'exam', 'result', 'degree', 'transcript', 'hostel', 'fee', 'fees', 'scholarship', 'ragging',
  'harassment', 'harass', 'assault', 'abuse', 'molest', 'theft', 'stole', 'robbery', 'fraud',
  'cheating', 'forgery', 'counterfeit', 'blackmail', 'cyber', 'online', 'password', 'rights',
  'threat', 'threaten', 'intimidat', 'stalk', 'bully', 'impersonat', 'deepfake', 'morphed',
  'obscene', 'pornograph', 'abusive', 'defame',
  'duty', 'duties', 'speech', 'religion', 'minor', 'child', 'women', 'wife', 'husband', 'parent',
  'guardianship', 'passport', 'cnic', 'domicile', 'vote', 'election', 'tax', 'taxation', 'customs',
  'bank', 'banking', 'loan', 'debt', 'recover', 'cheque', 'dishonour', 'stamp', 'company',
  'partnership', 'business', 'license', 'licence', 'permit', 'vehicle', 'accident', 'insurance',
  'claim', 'hospital', 'medicine', 'drug', 'narcotic', 'smuggling', 'terrorism', 'anti',
  'money laundering', 'nab', 'ombudsman', 'advocate', 'lawyer', 'legal aid', 'affidavit',
  'notary', 'attestation', 'signature', 'document', 'gazette', 'crpc', 'ppc', 'pei', 'hta',
  'ipc', 'fia', 'nadra', 'bisp', '8171', 'kafaalat', 'kifalat', 'punjab', 'sindh', 'balochistan',
  'baluchistan', 'pakhtunkhwa', 'gilgit', 'baltistan', 'azad', 'kashmir', 'federal', 'provincial',
  'government', 'govt', 'authority', 'municipal', 'council', 'ministry', 'department', 'official',
];

const LEGAL_CUES_ROMAN_URDU = [
  'qanoon', 'kanoon', 'qawaneen', 'haq', 'huqooq', 'haqooq', 'adalat', 'kachehri', 'vakhtiyari',
  'wakil', 'wakeel', 'vakil', 'muqadma', 'dawa', 'dafa', 'dhara', 'saza', 'jurmana', 'shikayat',
  'faryad', 'darkhwast', 'police', 'thana', 'fir', 'qaboo', 'giraftari', 'zamanat', 'puchhtagi',
  'karardad', 'moahida', 'registri', 'intiqal', 'bayana', 'maqadma', 'zameen', 'jakri', 'kirayedar',
  'kiraye', 'kira', 'qabza', 'khalisi', 'nikah', 'talaq', 'khula', 'hadlat', 'nafaqa', 'zauj',
  'zauja', 'balish', 'bacha', 'aulad', 'waris', 'taqseem', 'miras', 'mulazim', 'mulazmat', 'naukri',
  'tankhwa', 'khidmat', 'tardid', 'khilaf', 'taleem', 'talib', 'imtihan', 'nateeja', 'marksheet',
  'hostel', 'haraasni', 'herasgen', 'chori', 'sargoshi', 'dukaati', 'dhoka', 'qalbi', 'sazi',
  'cyber', 'bank', 'qarz', 'wasli', 'wapsi', 'saleq', 'tax', 'customs', 'passport', 'cnic',
  'domisail', 'vote', 'chunao', 'sarkar', 'mahkama', 'idara', 'kagaz', 'dastavez', 'tasdeeq',
  'halefnama', 'dastakhat', 'khat', 'muhr', 'kharid', 'farokht', 'bazaar', 'dukan', 'dau',
  'kompani', 'sharakat', 'ijazat', 'muafiqat', 'injury', 'hukam', 'jurm',
  'sunwai', 'vakalatnama', 'gawah', 'saboot', 'faizla', 'dhamki', 'dhamkian', 'dhamkiyan',
  'tasveerein', 'tasveer', 'harasani', 'harrasani',
];

const LEGAL_CUES_URDU_SCRIPT = [
  'قانون', 'قوانین', 'حق', 'حقوق', 'عدالت', 'کچہری', 'اختیارات', 'وکیل', 'مقدمہ', 'دعوی',
  'دفعہ', 'سزا', 'جرمانہ', 'نوٹس', 'شکایت', 'فریاد', 'درخواست', 'پولیس', 'تھانہ', 'مقدم',
  'قبضو', 'گرفتاری', 'جیل', 'زمانت', 'پوچھتاچ', 'ترجمان', 'معاہدہ', 'رجسٹری', 'انتقال',
  'بیعانہ', 'معاملہ', 'زمین', 'جاگیر', 'کرایہ', 'قبضہ', 'کھالی', 'نکاح', 'طلاق', 'خلع',
  'حضانت', 'نفقہ', 'زوج', 'زوجہ', 'والد', 'والدہ', 'بچہ', 'اولاد', 'وارث', 'تقسیم',
  'بھٹکہ', 'ملازمت', 'نوکری', 'تنخواہ', 'خدمتگار', 'تعدد', 'خلاف', 'تعلیم', 'طالب',
  'علم', 'امتحان', 'نتیجہ', 'مارک شیٹ', 'ہاسٹل', 'فیس', 'ہراساں', 'مشکل', 'چوری',
  'سرقت', 'دھوکا', 'تقلب', 'سائبر', 'بیت', 'مال', 'بینک', 'قرض', 'واپسی', 'ٹیکس',
  'کسٹم', 'پاسپورٹ', 'قومی شناختی کارڈ', 'ڈومیسائل', 'ووٹ', 'الیکشن', 'حکومت', 'محکمہ',
  'ادارہ', 'کاغذ', 'دستاویز', 'تصدیق', 'حلف نامہ', 'دستخط', 'خط', 'مہر', 'خرید',
  'فروخت', 'کمپنی', 'شراکت', 'اجازت', 'معاوضہ', 'دعوی', 'موروث',
  'ثبوت', 'گواہ', 'سماعت', 'فیصلہ', 'وکالت نامہ', 'بلیک میل', 'دھمکی', 'ہراسانی', 'تصاویر',
];

const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ASCII cues match as a prefix at a word start, so a stem like 'penalt' or
// 'evict' still covers 'penalty' and 'eviction'. Urdu-script cues can not use
// \b, so they are substring-tested.
const LEGAL_CUES_ASCII_RE = new RegExp(
  `\\b(?:${[...new Set([...LEGAL_CUES_EN, ...LEGAL_CUES_ROMAN_URDU])].map(escRe).join('|')})`,
  'i'
);

// Does the question name a legal or civic subject at all? Deliberately
// permissive: an over-broad hit only means the guard stays out of the way.
function hasLegalOrCivicSignal(userQuery) {
  const s = String(userQuery || '');
  if (!s.trim()) return false;
  if (LEGAL_CUES_ASCII_RE.test(s)) return true;
  if (LEGAL_CUES_URDU_SCRIPT.some(cue => s.includes(cue))) return true;
  return findProvisionRefs(s).length > 0;
}

/**
 * An off-topic question (a stock tip, a travel fact, a trivia ask) must not be
 * answered from a corpus record that matched it only by accident. Fires when the
 * gate did NOT reach a strong verdict, the question names no legal or civic
 * subject in any script, and the corpus itself says nothing supports the answer
 * (no domain classified, or an explicit no-support reason). Returns null in every
 * other case, so near-miss legal questions keep their honest partial answer.
 */
const OFF_TOPIC_REASONS = new Set(['wrong_domain', 'wrong_jurisdiction', 'scope_mismatch',
  'insufficient_evidence', 'no_evidence', 'irrelevant_chunks', 'unsupported_evidence']);

function offTopicAbstentionText(userQuery, activeLang, evidence) {
  const ev = evidence || {};
  if (ev.verdict === 'strong') return null;
  if (hasLegalOrCivicSignal(userQuery)) return null;
  const reasons = ev.reasons || [];
  const corpusSaysNoSupport = ev.domain === 'unknown' || reasons.some(r => OFF_TOPIC_REASONS.has(r));
  if (!corpusSaysNoSupport) return null;
  if (activeLang === 'ur') {
    return 'آپ کے سوال میں کوئی قانون، دفعہ، عدالت، حق یا شہری موضوع نام سے ظاہر نہیں ہوتا، اور مستند قانونی ذخیرے میں اس سوال کا کوئی جواب موجود نہیں ہے — اس لیے یہاں کوئی متن یا حوالہ جواب کے طور پر پیش نہیں کیا جا رہا۔ قانونی مدد کے لیے اپنا سوال کسی قانون، عدالت یا حق کے حوالے سے پوچھیں — مثلاً "چوری کی سزا پاکستان پنل کوڈ کے تحت" یا "کرائے کا مکان خالی کروانا"۔';
  }
  return activeLang === 'roman_urdu'
    ? 'Aap ke sawal mein koi qanoon, dafa, adalat, haq ya civic mauzoo naam se zahir nahi hota, aur verified law corpus mein is sawal ka koi jawab mojood nahi hai — is liye yahan koi text ya hawala pesh nahi kiya ja raha. Qanooni madad ke liye apna sawal kisi qanoon, court ya haq ke hawale se poochein — maslan "chori ki saza Pakistan Penal Code ke tahat" ya "kiralay ka ghar khali karwana".'
    : 'This question names no statute, provision, court, right or civic subject, and the verified law corpus holds no record that answers it, so no text and no source is being presented as an answer. For legal help, ask with a law, section, court or right in the question — for example "punishment for theft under the Pakistan Penal Code" or "evicting a tenant".';
}

/**
 * The verified corpus carries Pakistani law and Pakistani civic procedure only.
 * When the ask is another country's OWN rule ("the sentence for murder under
 * Indian law", "the legal drinking age in California"), the best match in the
 * corpus is a Pakistani provision about the same subject — which is a wrong
 * answer wearing a "VERIFIED LEGAL REFERENCE" banner. This abstention is the
 * only honest output, and it fires whatever the evidence gate scored.
 */
function foreignRuleAbstentionText(userQuery, activeLang) {
  if (!asksForeignRule(userQuery)) return null;
  const country = foreignRuleSubject(userQuery);
  const isRoman = activeLang === 'roman_urdu';
  const subject = isRoman
    ? (country ? `Yeh sawal ${country} ke apne qanoon ke baare mein hai.` : 'Yeh sawal kisi aur mulk ke apne qanoon ke baare mein hai.')
    : (country ? `This question asks what the law of ${country} itself provides.` : 'This question asks what the law of a country other than Pakistan provides.');
  return isRoman
    ? `${subject} Insaaf AI ka verified corpus sirf Pakistan ke qanoon aur Pakistani civic procedure par mabni records rakhta hai — is mein koi foreign statute, court faisla ya tax rule shamil nahi, is liye koi record yeh nahi bata sakta ke us mulk ka qanoon kya kehta hai. Yahan koi text ya hawala pesh nahi kiya ja raha. Us mulk ke qanoon ke liye us mulk ka official source ya wahan eligible wakeel dekhein. Agar is maslay ka koi Pakistani pehlu hai — Pakistan mein koi dastavez, adalat, ya shakhs — to woh batayein, main us hisse mein madad kar sakta hoon.`
    : `${subject} Insaaf AI's verified corpus holds Pakistani law and Pakistani civic procedure only — no foreign statute, court decision or tax rule — so no record in it can state what that country's law provides, and nothing is being presented as an answer here. For that country's rule, use its official source or a lawyer qualified there. If your matter has a Pakistani side — a document, a forum or a person in Pakistan — describe that part and I can help with it.`;
}

/**
 * The one decision every response branch consults before it composes anything:
 * does this ask get an answer at all? An abstention beats a clarifying question
 * (asking "which province?" implies a matching record exists) and beats the
 * closest keyword-matched record (which would wear a verified banner).
 */
function abstentionFor(userQuery, activeLang, evidence, retrievedChunks) {
  const topChunkScore = retrievedChunks && retrievedChunks.length > 0 ? (retrievedChunks[0].exactScore || 0) : 0;
  const isSectionLookup = /\b(?:section|sec|article|art|dafa|دفعہ)\s*\.?\s*\d+/i.test(userQuery);
  const sectionMiss = (isSectionLookup && topChunkScore < 8.0) ? sectionNotFoundText(userQuery, activeLang) : null;
  return sectionMiss || offTopicAbstentionText(userQuery, activeLang, evidence)
    || foreignRuleAbstentionText(userQuery, activeLang);
}

/** What a curated reply did, in the response contract's words: a refusal rule
 * abstains, everything else (directory pointer, small talk) answers. */
const curatedAction = (answer) => (answer && answer.kind === 'abstain' ? 'abstain' : 'answer');

/**
 * Words that carry no legal subject at all — grammar, copulas, question verbs and
 * the generic nouns "law / qanoon / provincial / rule / act". Used by curated rule
 * 8b: once the place name is removed, a query left with only these words asks
 * nothing the corpus can answer.
 */
const SCOPE_ONLY_WORDS = new Set([
  'law', 'laws', 'legal', 'legality', 'provincial', 'province', 'state', 'federal', 'central',
  'rule', 'rules', 'act', 'acts', 'ordinance', 'enactment', 'enactments', 'statute', 'statutes',
  'say', 'says', 'said', 'tell', 'what', 'whats', 'how', 'does', 'do', 'did', 'about', 'regarding',
  'under', 'pertaining', 'apply', 'applies', 'applied', 'applicable', 'general', 'all', 'any',
  'everything', 'something', 'else', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'it', 'this', 'that', 'there', 'here',
  'qanoon', 'qanoons', 'kanon', 'kanoon', 'kaanoon', 'qawaneen', 'qwaneen',
  'kehta', 'kehti', 'kehte', 'kahta', 'kahti', 'kahat', 'kehat', 'bola', 'bole',
  'bata', 'batao', 'bataen', 'batayein', 'batado', 'batade', 'btao',
  'hai', 'hain', 'hen', 'he', 'ho', 'hota', 'hoti', 'hote', 'kya', 'kia', 'ka', 'ke', 'ki',
  'ko', 'se', 'mein', 'main', 'par', 'pe', 'aur', 'ya', 'bhi', 'sab', 'saara', 'saari', 'sare',
  'sari', 'meri', 'mera', 'meray', 'apna', 'apni', 'aap', 'apka', 'de', 'dena', 'dein', 'do',
  'karo', 'kare', 'karen', 'karna', 'karne', 'karun', 'lagu', 'lagoo', 'mutabiq', 'matabiq',
  'tarah', 'tariqa', 'tareeqa', 'aisa', 'aisay', 'chahiye', 'chahye', 'bana',
  'قانون', 'صوبائی', 'صوبہ', 'مرکزی', 'وفاقی', 'کیا', 'کہتا', 'کہتی', 'کہتے', 'ہے', 'ہیں',
  'بتائیں', 'بتاؤ', 'کے', 'کا', 'کی', 'میں', 'سے', 'پر', 'اور', 'بھی', 'سارا', 'ساری', 'کل',
  'طریقہ', 'تاریقہ', 'متعلق', 'تحت', 'کرنے', 'کرنا', 'چاہیے'
]);

/**
 * Provincial-scope words. Rule 8b needs them because "صوبائی قانون کیا کہتا ہے؟"
 * claims a scope tier without naming which province — still a content-free ask.
 */
const SCOPE_TIER_WORDS = new Set([
  'provincial', 'province', 'provinces', 'sooba', 'soobe', 'soobai', 'soobay', 'subai', 'suba',
  'soobon', 'sooba-e-azam',
  'صوبائی', 'صوبہ', 'صوبے', 'صوبوں'
]);

/**
 * Letter-only word class. [\u0600-\u06FF] would also match Urdu punctuation, so
 * "ہے؟" tokenised as one word and never equalled the grammar word "ہے" — a
 * content-free provincial question then looked like it still had a subject.
 */
const SCOPE_WORD_RE = /[a-z]+|[\u0621-\u064A\u0671-\u06D3]+/g;

/**
 * Curated offline answers for queries that must never be answered by keyword
 * retrieval alone: outcome predictions, illegal-request refusals, lawyer
 * discovery, app usage, greetings, math and gibberish.
 * Returns { text, actions } or null when no curated rule applies.
 *
 * opts.safetyOnly — run only the safety rules (refusals, domestic violence,
 * overseas emergency, invented citation) and stop before the pointer rules.
 * A caller that still has to ask a clarifying question must not let a pointer
 * answer first, but must still refuse an unlawful request immediately.
 * opts.legalSituation — the caller already identified a concrete citizen
 * dispute, so the lawyer / legal-aid directory pointers stand down. A named
 * problem ("university fees refund nahi kar rahi") is not a request for a
 * directory, even though it contains a word the pointer rules look for.
 */
function curatedOfflineAnswer(userQuery, activeLang, opts = {}) {
  const q = (userQuery || '').toLowerCase().trim();
  const isRoman = activeLang === 'roman_urdu';

  // 1. Outcome prediction refusal — a court decides; nobody can guarantee a result.
  // "Guarantee" alone is ordinary legal vocabulary (a constitutional guarantee, a
  // bank guarantee), so it only refuses when the thing guaranteed is an outcome.
  const asksOutcomeGuarantee = /guarantee\w*/i.test(q)
    && /\b(win|winning|jeet\w*|result|outcome|faisla|natija|success)\b/i.test(q);
  if (/\b(100%|pakka|jeetne|jeet|win my case|win the case|will i win|result batao|outcome batao|case ka faisla|faisla kya hoga)\b/i.test(q) || asksOutcomeGuarantee) {
    return {
      kind: 'abstain',
      text: isRoman
        ? 'Koi bhi wakil ya app pehle se nahi bata sakta ke case ka result kya hoga. Faisla hamesha adalat ka hota hai aur woh saboot, gawahi aur haalat par depend karta hai. Main aap ko sirf mutalqa qanooni dafa aur procedure bata sakta hoon. Mera mashwara: apne saboot mehfooz karein aur registered wakil se raabta karein.'
        : 'No lawyer or app can predict the outcome of a case. The result always depends on the evidence, witnesses and the court. I can tell you the law that may apply and the procedure to follow — but not whether you will win. My advice: preserve your evidence and consult a registered advocate.',
      actions: []
    };
  }

  // 2. Illegal-request refusal — never help with false or unlawful acts.
  // A fabricated legal artefact — a fake/false/forged FIR, report, judgment,
  // decree, court order, certificate, deed, nikah nama, contract, affidavit,
  // statement, signature or stamp paper — is itself an offence. Match it even
  // when the qualifier and the artefact are not one contiguous phrase (e.g.
  // "fake FIR document", "draft a fake Supreme Court judgment").
  const fabricatedArtefact = /\b(?:fake|false|fabricated?|forged|counterfeit|banawati|jaali|jhoot(?:a|i|e)?|jhooth(?:a|i|e)?)\s+(?:[a-z']+\s+){0,3}?(?:f\.?i\.?r\.?|report|judgment|judgement|decree|court[- ]?order|order|certificate|document|dastavez|deed|nikah[- ]?nama|contract|affidavit|statement|bayan|signature|dastakhat|stamp[- ]?paper|case|evidence|gawahi)\b/i.test(q);
  // Taking over a device, network or account that is not yours is an offence in
  // its own right, so an ask to do it is refused like a fabrication. Both word
  // orders are matched: "hack my neighbour's wifi" and "wifi hack karo".
  // The second word order needs BOTH an intrusion verb and a permission phrase.
  // A permission phrase alone ("the bank took money from my account without my
  // permission") is a complaint about a debit, not a request to break in.
  const asksUnauthorizedAccess = /\b(hack\w*|crack(?:ed|ing)?|break\s+into|bypass\w*|unauthoriz(?:ed|e)|unauthoris(?:ed|e)|steal(?:ing|s)?|churana|chura\w*|gisalna)\b[^.?;\n]{0,40}?\b(wi-?fi|internet|router|modem|password|pin|otp|account|e-?mail|phone|mobile|laptop|computer|sim|instagram|whatsapp|facebook|tiktok)\b/i.test(q)
    || /\b(wi-?fi|internet|router|modem|password|pin|otp|account|e-?mail|phone|mobile|laptop|computer|sim|instagram|whatsapp|facebook|tiktok)\b[^.?;\n]{0,40}?\b(hack\w*|crack\w*|churana|chura\w*|access\w*|enter|get\s+into|log\s*in|login|sign\s*in|unlock|take\s+over|istemal\w*|use)\b[^.?;\n]{0,30}?\b(?:bina\s+(?:ijazat|permission)|without\s+(?:my|their|his|her|the\s+owner'?s?|someone'?s?)\s+(?:permission|consent|ijazat))\b/i.test(q);
  const illegalIntent = fabricatedArtefact || asksUnauthorizedAccess || /\b(fake case|jhoota case|false case|fake evidence|false evidence|fabricated? evidence|jhooti gawahi|jhoothi gawahi|jhoota bayan|false statement|fake statement|perjury|falsif(?:y|ication)|tamper(?:ing)? (?:with )?evidence|forge|forged|forgery|bribe|rishwat|pay off|influence the judge|threatening letter|dhamki dena|blackmail karna|jaali dastavez|jaali evidence|fake document)\b/i.test(q);
  // "Someone hacked my WhatsApp" is a victim reporting a crime, not an ask to
  // commit one: a past or passive marker on the speaker's own system keeps the
  // unauthorised-access class silent. Fabrication asks are unaffected.
  const reportsOwnHack = /\b(was|were|had|got|is|hai)\s+(hack|crack|steal|chhupa)\w*|\bhack(ed)?\s+(my|meri|mera|hisaab)|\b(meri|mera|my)\s+(wi-?fi|password|account|phone|sim|email)\b[^.?;]{0,30}?\b(hack\w*|chori|chur|gisla|stolen|kisi\s+ne|ho\s+gay)\b/i.test(q);
  // "Kisi ne hack kar liya" / "was hacked" describes something that ALREADY
  // HAPPENED TO THE SPEAKER, so it is a crime report, not an instruction. The
  // completed-event or unnamed-perpetrator marker has to accompany the access
  // verb; a bare "how do I hack" carries no such marker and stays refused.
  const reportsCompletedHack = (/\b(was|were|got|had|ho\s*(?:gaya|gya|diya|liya)|kar\s*(?:liya|diya|diya)|kisi\s+(?:ne|aur\s+ne)|by\s+someone|someone\s+els\w*|chura\s*(?:liya|diya))\b/i.test(q))
    && (/\b(hack|crack|steal|chur|gisal)\w*|\bstolen\b|\bchori\b/i.test(q));
  // "hack MY wifi" and "hack my NEIGHBOUR's wifi" both contain "hack my", so the
  // veto above cannot tell a victim report from a targeted ask. What decides it is
  // whether the system named is owned by somebody else: a possessor (English
  // possessive or Roman-Urdu ka/ki/ke) bound to a target system means the speaker
  // is asking to break into a third party's device, which no victim reading covers.
  const thirdPartyOwnedTarget = /\b(neighbou?r|neighbou?rs|pados(?:an|i|hi|ni)|dost|friend|friends?|colleague|classmate|roommate|bhai|behin|boss|teacher|uska|uske|iske|unka|her|his|their)\b[^.?;\n]{0,12}?\b(wi-?fi|internet|router|modem|password|pin|otp|account|e-?mail|phone|mobile|laptop|computer|sim|instagram|whatsapp|facebook|tiktok)\b/i.test(q);
  const actionAsk = /\b(how to|how can i|how do i|tell me how|write|draft|create|prepare|make|produce|generate|likh|banana|banayein|banani|banao|bana|taiyar|karna|karun|karo|dena|chahiye)\b/i.test(q);
  const wantsToReport = /\b(report|complain|shikayat)\b/i.test(q);
  // Never refuse a VICTIM/defendant who wants to cancel, quash, withdraw, defend
  // or report a fake case/FIR made AGAINST ME/them — a legitimate remedy request,
  // not a request to fabricate. Deliberately EXCLUDES the broad "against my" so a
  // perpetrator ("file a fake case against my enemy") is still refused.
  const victimContext = /\b(against me|filed against|lodged against|registered against|khilaf|mere khilaf|cancel|quash|withdraw|defend|defen[cs]e|protect|bachna|bachao|victim|framed|phasaya|jhoote case mein)\b/i.test(q);
  if (illegalIntent && (actionAsk || asksUnauthorizedAccess) && !wantsToReport && !victimContext
    && !(asksUnauthorizedAccess && (reportsOwnHack || reportsCompletedHack) && !thirdPartyOwnedTarget)) {
    if (asksUnauthorizedAccess && !fabricatedArtefact) {
      return {
        kind: 'abstain',
        text: isRoman
          ? 'Main kisi aur ke Wi-Fi, router, account, email ya phone tak bina ijazat pohanchne ka tareeqa nahi bata sakta — doosre ke system mein bina ijazat dakhla khud jurm hai aur is par saza ho sakti hai. Agar aap ka apna account, number ya device kisi ne haasil kar liya hai, ya aap ko shak hai ke koi aap ka internet istemal kar raha hai, to yeh report karne layak baat hai — taareekh aur saboot ke saath batayein, main FIA Cybercrime Wing mein shikayat ka tareeqa aur qanooni raasta bata sakta hoon.'
          : 'I will not explain how to get into someone else\'s Wi-Fi, router, account, email or phone. Accessing a system that is not yours without authorisation is itself a criminal offence and can be punished. If it is YOUR account, number or device that someone took over, or you suspect another person is using your connection, that is a matter to report: tell me what happened and when, and I will explain how to complain to the FIA Cybercrime Wing and what the law provides.',
        actions: []
      };
    }
    return {
      kind: 'abstain',
      text: isRoman
        ? 'Main sirf jaiz qanooni tareeqay se madad kar sakta hoon. Jaali case banana, jaali FIR ya jaali qanooni/adalti dastavez tayar karna, jaali evidence ya jhooti gawahi dena, rishwat dena ya dhamki dena khud jurm hai aur PPC ke tahet saza ka sabab ban sakta hai. Agar aap ke saath nainsafi hui hai — maslan aap par jaali case ya FIR banai gayi hai — to mujhe apna masla batayein, main aap ko jaiz qanooni raasta (defence/quash/report) bataunga.'
        : 'I can only help through lawful means. Fabricating a case, forging a fake FIR or a fake legal/court document, creating false evidence or a false statement, bribing anyone, or writing threats are themselves criminal offences under the PPC and can lead to prosecution. If you have been wronged — for example a fake case or FIR was made against you — describe what happened and I will explain the legitimate legal path (defence, quashment or reporting).',
      actions: []
    };
  }

  // 2a. Instruction-override and assistant-side secret exfiltration. These are not
  // legal questions at all, so they must never reach retrieval — otherwise the
  // answer is served under a "VERIFIED LEGAL REFERENCE" banner quoting unrelated
  // law, which is worse than a plain refusal. Deliberately narrow: a user
  // describing their OWN credential ("my bank password was stolen") is a genuine
  // cybercrime query and is left to the normal legal paths.
  const overrideAttempt = /\b(ignore|disregard|forget|override|bhool|nazar-andaz)\b[\s\S]{0,30}?\b(previous|prior|above|earlier|original|system|apne)\b[\s\S]{0,25}?\b(instructions?|prompts?|rules?|hidyat|dikhayat)\b/i.test(q)
    || /\b(jailbreak|jailbroken|dan\s+mode|developer\s+mode|god\s*mode|prompt\s+injection|roleplay\s+as\s+an?\s+unrestricted|you\s+are\s+now)\b/i.test(q)
    || /\bpretend\b[\s\S]{0,25}?\byou\s+have\s+no\b/i.test(q)
    || /\b(pretend|act)\s+(to\s+be|as\s+(if\s+)?you)\b[\s\S]{0,40}?\b(no\s+rules|unrestricted|without\s+(any\s+)?restrictions|have\s+no\s+limits)\b/i.test(q);
  const exfilVerb = /\b(reveal|show|print|display|output|dump|leak|repeat|paste|share|send|expose|give|provide|disclose|hand\s+over|tell\s+me|bhejo|bata(?:o|en|ein)?|dikha(?:o|en|ein)?)\b/i.test(q);
  const assistantArtifact = /\b(system\s+prompt|system\s+instructions?|system\s+rules?|hidden\s+(?:prompts?|instructions?|rules?|messages?)|developer\s+(?:prompts?|messages?)|initial\s+prompt|your\s+(?:original|initial|secret|real|underlying|actual)\s+(?:instructions?|prompts?|rules?)|internal\s+(?:instructions?|prompts?|config(?:uration)?|settings?|ends?|logs?)|apna\s+(?:system\s+)?prompt|apni\s+instructions)\b/i.test(q)
    || /\b(your|aap\s+ka|aap\s+ki|apni|apna|internal|backend|server|this\s+app(?:'s)?)\s+(?:the\s+)?(api[\s_-]?keys?|secret[\s_-]?keys?|access[\s_-]?tokens?|bearer[\s_-]?tokens?|private[\s_-]?keys?|credentials?|secrets?)\b/i.test(q)
    || /\b(service\s+account|firebase\s+(?:api|service|credentials?)|google\s+service\s+account)\b[\s\S]{0,40}?\b(credentials?|keys?|tokens?|json|secret)\b/i.test(q)
    || /\b(secret\s+(?:phrase|word|handshake|question)|what\s+is\s+your\s+secret)\b/i.test(q)
    || /\b(process\.env|environment\s+variables?|env\s+vars?|GEMINI_API_KEY|OPENAI_API_KEY|FIREBASE_API_KEY|sk-[a-z0-9_-]{3,})\b/i.test(q)
    || /(?:^|[^\w])\.env\b/i.test(q)
    || /\b(debug\s+logs?|backend\s+logs?|raw\s+prompt|system\s+message)\b/i.test(q)
    || /\b(prompts?|instructions?|api[\s_-]?keys?|credentials?|secrets?|configuration)\b[\s\S]{0,20}?\b(of|for)\s+(this|the)\s+(app|assistant|chatbot|bot|ai|model|server|system)\b/i.test(q)
    || /\b(source\s+code|model\s+weights|training\s+data)\s+(of|for)\s+(your|the)\s+(app|model|bot|ai)\b/i.test(q);
  const aboutUsersOwnCredential = /\b(my|mine|our|myself|meri|mera|meray|apni\s+account|user\s+account)\b[\s\S]{0,40}?\b(password|pin|otp|token|key|account|email|sim|bank|wallet|nhif|nadra)\b/i.test(q)
    || /\b(password|pin|otp|token)\b[\s\S]{0,40}?\b(stolen|hacked|leaked|chori|gisla|kisi|ne)\b/i.test(q);
  // A question can ask for the same internals without using an exfiltration
  // verb ("what is the secret handshake of this assistant"). Refuse only when
  // the artifact is unambiguously assistant-side AND anchored to the assistant.
  const strongInternalArtifact = /\b(system\s+prompt|system\s+instructions?|system\s+rules?|hidden\s+(?:prompts?|instructions?|rules?|messages?)|raw\s+prompt|system\s+message|secret\s+(?:phrase|word|handshake)|debug\s+logs?|backend\s+logs?|service\s+account|api[\s_-]?keys?)\b/i.test(q)
    && /\b(your|aap\b|aap\s+k[a-i]|apn[ai]|yeh|this|assistant|chatbot|bot|ai|model|app|backend|server|internal|firebase|inaaf|insaaf)\b/i.test(q);
  // Urdu script is a separate writing system — the Latin patterns above can
  // never see it, so the same internals are matched in Urdu directly.
  const urduInternalArtifact = /سسٹم\s*پرامپٹ|پہلا\s*پرامپٹ|خام\s*پرامپٹ|اندرونی\s*(?:ہدایات|ترتیبات|لوگ)|چھپی\s*ہوئی\s*(?:ہدایات|تعلیمات)|پوشیدہ\s*(?:ہدایات|احکام)|خفیہ\s*(?:ہدایات|لفظ|عبارت|چابی)|اے\s*پی\s*آئی\s*کی|سروس\s*اکاؤنٹ|ڈیبگ\s*لاگ|سسٹم\s*پیغام/i.test(q);
  const urduRequestVerb = /(?:دکھ|بت|بھیج|کھول|چاپ|نکال)|دی?\s*(?:جئیے|یں)|مل\s*جائ/i.test(q);
  if ((overrideAttempt || (exfilVerb && assistantArtifact) || strongInternalArtifact || (urduInternalArtifact && urduRequestVerb)) && !aboutUsersOwnCredential) {
    return {
      kind: 'abstain',
      text: isRoman
        ? 'Main apni internal instructions, system prompt, API keys ya koi bhi confidential configuration nahi dikha sakta — yeh sawal qanoonsi maloomat se related nahi hai. Lekin agar aap ka masla haqeeqat mein kisi ke apne password, OTP ya account ki chori/khurdaat se related ho (maslan online fraud), to woh PPC aur Prevention of Electronic Crimes Act 2016 ke tahet jurm hai aur main us qanoon aur report karne ke tareeqay mein madad kar sakta hoon.'
        : 'I cannot share my internal instructions, system prompt, API keys or any backend configuration — that is not a legal question and the information is not available through this app. If your actual concern is about someone else taking a password, OTP or account (online fraud), that is an offence under the Prevention of Electronic Crimes Act 2016 and the PPC — describe what happened and I will explain the law and how to report it.',
      actions: ['chat']
    };
  }

  // 2b. Domestic violence / urgent personal-safety help — SAFETY CRITICAL. This
  // must NEVER become a cold "no verified source" refusal. Grounded strictly in
  // the verified corpus (women.txt): the provincial protection Acts, Protection
  // Officers, Dar-ul-Aman / crisis shelters, police emergency 15 and the
  // national/provincial women's helplines. Points to the in-app Emergency
  // directory (NAV: emergency) rather than inventing any number.
  // Domestic/family context is REQUIRED so a non-domestic violence query (e.g.
  // police brutality, workplace harassment) is never misrouted to this answer.
  const dvContext = /\b(domestic|gharelu|ghar|home|husband|shohar|khaund|wife|biwi|begum|spouse|partner|family|rishtedar|in-?laws?|saas|sasur)\b/i.test(q)
    || /(?:گھر|شوہر|خاوند|بیوی|گھریلو|ازدواجی)/.test(userQuery || '');
  // Kin beyond the household (brother, father, aunt…). Abuse by a relative is
  // still domestic violence, but this tier needs a strong abuse term because a
  // bare "my brother was killed in an accident" is a claim, not a safety case.
  const dvKin = /\b(brother|bhai|bhaee|sister|behen|bhan|father|baap|abu|appa|parent|mother|maa|ammi|ajan|son|daughter|beta|beti|bete|uncle|chacha|fufa|mama|aunt|phuphi|khalo|taya|cousin|nephew|bhatija|niece|bhatiji|devar|jija|jeeja|sala|nand|jeth|guardian|step[- ]?(?:mother|father|parent|brother|sister))\b/i.test(q)
    || /(?:بھائی|بہن|والد|والدہ|ماں|باپ|بیٹا|بیٹی|چچا|پھوپھی|ماما|خالا|رشتہ دار)/.test(userQuery || '');
  const violenceTerm = /\b(violence|tashaddud|zulm|zorm?|abuse|abusive|beats?|beating|beaten|beat|peet\w*|pitai|peetai|marta|marti|maarte|maarta|mara|mari|maar|hits|hit|hitting|kicks?|kicked|atak|attack|assault\w*|kill|kills|killing|qatl|dhamki|dhakia|threat|threatens|threatening|danger|acid|tezab|tortur\w*|cruel|mistreat\w*|ill-?treat\w*)\b/i.test(q)
    || /(?:تشدد|مارتا|مارتی|ماری|مارنے|پیٹ|دھمکی|تیزاب|قتل|ظلم|جبر|زیادتی)/.test(userQuery || '');
  const strongAbuse = /\b(violence|tashaddud|abuse|abusive|beats?|beating|beaten|peet\w*|pitai|peetai|marta|marti|maarte|mara\b|assault\w*|acid|tezab|dhamki|mistreat\w*|ill-?treat\w*|threat(?:s|ens|ening)?\s+to\s+kill|maarne\s+ki\s+dhamki)\b/i.test(q)
    || /(?:تشدد|مارتا|مارتی|پیٹ|دھمکی|تیزاب|ظلم|زیادتی)/.test(userQuery || '');
  // A state or institutional actor is a criminal/employment matter, not a
  // domestic one — police brutality or an abusive employer must keep its own path.
  const officialActor = /\b(police|thana|thanay|siya|sho\b|daroga|constable|lockup|lock[- ]?up|custod\w*|hc?p\b|employer|boss|manager|company|teacher|professor|lecturer|hostel|warden|landlord|landlady|malkin|sarkari|govt|government|court|judge|magistrate|army|ranger|officer)\b/i.test(q);
  const isClaimContext = /\b(accident|insurance|claim|compensation|inheritance|virsa|taqseem|share certificate|salary|wages|arrears|loan|recovery|challan|traffic|defamation|notice)\b/i.test(q);
  const explicitDV = /\b(domestic violence|gharelu tashaddud|spousal abuse|acid (?:attack|throwing)|tezab (?:hamla|phenk)|dar-ul-aman|(?:jaan se )?maarne ki dhamki|threat(?:s|ens|ening)? to kill)\b/i.test(q)
    || /(?:گھریلو تشدد|قتل کی دھمکی)/.test(userQuery || '');
  const isDomesticViolence = explicitDV
    || (dvContext && violenceTerm && !officialActor)
    || (dvKin && strongAbuse && !officialActor && !isClaimContext);
  if (isDomesticViolence) {
    return {
      text: isRoman
        ? '**Yeh aik fori (urgent) mamla hai — aap akele nahi hain, aur qanoon aap ko tahaffuz deta hai.**\n\nAgar aap ko abhi fori khatra hai to **police emergency 15** par call karein.\n\n**Aap ka qanooni tahaffuz:** Gharelu tashaddud qanooni tor par jurm hai. Soobai tahaffuz qawaneen — **Punjab Protection of Women against Violence Act 2016**, **Sindh Domestic Violence Act 2013**, aur **KPK Domestic Violence Act 2021** — ke tehat adalat yeh hukm de sakti hai:\n- **Protection order** — tashaddud karne wale ko mazeed tashaddud se rokna;\n- **Residence order** — ghar ka istemaal aap ke ikhtiyar mein dena;\n- **Maali madad** (monetary relief) — aap ke kharchon ke liye; aur\n- **Nabaligh bachon ki hiranat** aap ko dena.\n\n**Ab kya karein:**\n1. Agar mumkin ho to qareebi **police Women Complaint Cell** mein report karein ya **15** par call karein; aap Act ke tehat muqarrar **Protection Officer** se bhi shikayat kar sakti hain.\n2. Mehfooz panah ke liye hukoomat **Dar-ul-Aman** (Punjab), **Women Crisis Centers** (Sindh) aur **Shelter Homes** (KPK/Balochistan) chalati hai — jahan rehna, ilaj, qanooni madad aur counseling milti hai.\n3. **National Women Helpline 1043** (Ministry of Human Rights) aur **Sindh Women Helpline 1080** rehnumai kar sakti hain. (Call karne se pehle number tasdeeq kar lein — main sirf verified directory numbers likh raha hoon.)\n4. Saboot mehfooz karein: zakhmon ki tasaveer, **medical / medico-legal report**, messages, aur gawahan ki tafseel.\n\nApp ke **Emergency** section mein mukammal verified helpline directory mojood hai. Yeh qanooni maloomat hai, fori masawari madad ka mutabadil nahi — pehle apni hifazat ko tarjeeh dein.'
        : '**This is urgent — you are not alone, and the law gives you protection.**\n\nIf you are in immediate danger, call the **police emergency 15** right now.\n\n**Your legal protection:** Domestic violence is a recognised legal wrong. Under the provincial protection laws — the **Punjab Protection of Women against Violence Act 2016**, the **Sindh Domestic Violence Act 2013**, and the **KPK Domestic Violence Act 2021** — a court can grant:\n- a **protection order** stopping the abuser from committing further violence;\n- a **residence order** giving you exclusive use of the shared home;\n- **monetary relief** for your expenses; and\n- **custody of minor children** to you.\n\n**What to do now:**\n1. If it is safe to do so, report to the nearest **police Women Complaint Cell** or call **15**; you may also complain to a **Protection Officer** appointed under the Act.\n2. For safe shelter, the government runs **Dar-ul-Aman** homes (Punjab), **Women Crisis Centers** (Sindh) and **Shelter Homes** (KPK/Balochistan) offering accommodation, medical care, legal aid and counselling.\n3. The **National Women Helpline 1043** (Ministry of Human Rights) and the **Sindh Women Helpline 1080** can guide you. (Confirm the number before calling — I only list verified directory numbers.)\n4. Preserve any evidence: photographs of injuries, a **medical / medico-legal report**, messages, and details of witnesses.\n\nOpen the **Emergency** section of the app for the full verified helpline directory. This is legal information, not a substitute for urgent professional help — please prioritise your safety first.',
      actions: ['emergency']
    };
  }

  // 2b-ABROAD. Overseas emergency — a Pakistani in distress in another country
  // (arrested, detained, trafficked, stranded, lost passport, in danger). Like DV
  // this is SAFETY CRITICAL and must NEVER become a cold "no verified source"
  // refusal. Grounded only in stable, non-fabricated routing: local emergency
  // number is country-specific (do NOT invent one), the authoritative Pakistan
  // channel is the nearest Pakistani mission / MOFA, plus the app Emergency
  // directory. It does not guess any foreign law, fee or phone number.
  const abroadContext = /\b(abroad|overseas|foreign|visa|deport|deportation|outside pakistan|bioon|bioon mulk|بیرون ملک|duplicate)\b|\b(usa|uk|canada|australia|saudi|saudi arabia|uae|u\.?a\.?e|dubai|qatar|oman|bahrain|kuwait|malaysia|germany|france|italy|spain|netherlands|turkey|turkiye|china|japan|korea|russia|egypt)\b/i.test(q);
  const abroadDistress = /\b(arrest(?:ed|s)?|detain(?:ed|ee|tion)?|jail|prison|police|traffick|stranded|stuck|lost (?:my )?passport|passport (?:lost|stolen|theft)|emergency|danger|help|abuse|killed|died|death|hospital|deported|overstay|fired|unpaid|no pay|scam|cheated|kidnap|bound for)\b/i.test(q);
  if (abroadContext && abroadDistress) {
    return {
      text: isRoman
        ? '**Yeh overseas emergency ho sakti hai — pehle apni hifazat ko tarjeeh dein.**\n\n**Fauri tashaddud (khatra):** agar jaan ko khatra hai to us mulk ki **local emergency police** ko call karein (har mulq ka number alag hota hai — main andaze se number nahi likh sakta; apne mulk ka local emergency number confirm karein).\n\n**Pakistan ki taraf se madad — sab se ahem rasta Pakistani mission hai:** jahan bhi aap hain, qareebi **Pakistani Embassy / High Commission / Consulate** se rabta karein. Missions ki verified directory MOFA ke portal par hai: **https://www.mofa.gov.pk**. Consular post aap ko citizen hone ke naate madad kar sakta hai (khaas tor par:\n- **girftari/hiraasat (arrest/detention):** mission qanooni madad ke liye raahnumai aur local lawyer/interpreter dhoondne mein madad kar sakta hai, magar foreign case mein daakhil nahi ho sakta;\n- **gya huwa/chori shuda passport:** **Emergency Travel Document / Duplicate Passport** ke liye mission se sampark;\n- **insaan tashaddud-e-faraib (trafficking) ya zabardasti kaam:** mission ke saath saath local police aur Pakistan mein **Federal Investigation Agency (FIA)** aur **Bureau of Emigration & Overseas Employment (BE&OE)** ki shikayat branch;\n- **wapsi/Pakistan aaane mein atakne (stranded)** ya maali madad ke liye mission aur Ministry of Overseas Pakistanis (**https://ophrd.gov.pk**).\n\n**Ahem qanooni baat (jurisdiction):** foreign mulk mein aap par **us mulk ka qanoon** lagu hoga, Pakistani qanoon nahi — is liye wahan ke qualified local lawyer zaroori hai; Pakistani mission consular support deta hai, foreign adalati mamla chalane ka badal nahi. Fee/deadline/immigration rule jaisi current cheezein official source se confirm karein — main nahi ghadta.\n\nApp ke **Emergency** section aur **Legal Library → Pakistanis Abroad & International Matters** mein verified rabte aur rehnumai mojood hai.'
        : '**This may be an overseas emergency — prioritise your safety first.**\n\n**Immediate danger:** if you are in danger right now, call the **local emergency/police number of the country you are in** (every country differs — I will not invent a number; confirm the correct local emergency line).\n\n**Pakistan-side help — the key channel is the Pakistani mission:** contact the nearest **Pakistani Embassy / High Commission / Consulate** wherever you are. The verified mission directory is on MOFA\u2019s official portal: **https://www.mofa.gov.pk**. A consular post can assist you as a Pakistani citizen, in particular for:\n- **Arrest/detention:** the mission can guide you and help you find a local lawyer/interpreter, but cannot intervene in the foreign case itself;\n- **Lost/stolen passport:** contact the mission for an **Emergency Travel Document / duplicate passport**;\n- **Trafficking or forced labour:** alert the mission and local police, and in Pakistan the **FIA** and the **Bureau of Emigration & Overseas Employment (BE&OE)** complaint channels;\n- **Being stranded / needing to return, or welfare:** the mission and the Ministry of Overseas Pakistanis (**https://ophrd.gov.pk**).\n\n**Key legal point (jurisdiction):** in a foreign country, **that country\u2019s law applies to you, not Pakistani law** — so a qualified local lawyer there is essential; the Pakistani mission gives consular support, not a substitute for the foreign legal process. Confirm time-sensitive items (fees, deadlines, immigration rules) with the official source — I do not fabricate them.\n\nThe app\u2019s **Emergency** section and **Legal Library → Pakistanis Abroad & International Matters** carry verified contacts and guidance.',
      actions: ['emergency']
    };
  }

  // 2c. Random / invented case-citation request — must be refused honestly. A

  // made-up citation misleads a legal argument, so we never guess one; we point
  // to the verified law reports and the in-app case-law library instead.
  const citationWord = /\b(case\s*(?:law)?\s*(?:citation|hawala|reference)|citation|hawala|precedent)\b/i.test(q);
  const randomCitationIntent = /\b(random|any random|make up|invent|fabricate|banao|banana|koi bhi (?:ek )?hawala|koi random)\b/i.test(q);
  if (citationWord && randomCitationIntent) {
    return {
      kind: 'abstain',
      text: isRoman
        ? 'Main koi case citation nahi banaunga — aik banaya hua ya "random" hawala aap ki qanooni daleel ko gumrah kar sakta hai, is liye main andaaze se hawala nahi doonga. Asli Pakistani hawalaat sirf verified law reports (PLD, SCMR, CLC, MLR, PLJ) aur Supreme Court / High Court portals se milte hain. Mujhe apna qanooni masla aur mutalqa qanoon ya dafa batayein — main aap ko Library mein verified case-law sources ki taraf le jaunga, bajaye koi hawala banane ke.'
        : 'I will not invent a case citation — a made-up or "random" citation can seriously mislead a legal argument, so I will not guess one. Genuine Pakistani citations come only from verified law reports (PLD, SCMR, CLC, MLR, PLJ) and the Supreme Court / High Court portals. Tell me the legal issue and the relevant law or section, and I will point you to the verified case-law sources in the Library instead of fabricating a reference.',
      actions: ['library']
    };
  }

  // Everything above is a safety rule: it refuses an unlawful or unhedgable ask,
  // or routes a person in danger. A caller that has not yet established WHAT the
  // dispute is checks only these, so an illegal request is still refused before
  // any clarifying question is asked.
  if (opts.safetyOnly) return null;

  // 3. Lawyer discovery pointer — direct to the verified in-app directory.
  // Guard (Part T): a structured "explain this legal document type" request (or
  // any long multi-point numbered query) must be answered by the document/legal
  // composer with its full explanation — never intercepted by the short
  // directory / app-usage pointers below. Safety rules 1-2 above still apply.
  const isDocExplanation = /explain the (?:pakistani )?legal document type/i.test(userQuery || '');
  const isLongStructured = (userQuery || '').length > 240 && /\n\s*1\.\s/.test(userQuery || '');
  if (isDocExplanation || isLongStructured) return null;

  // Affordability / free-aid intent — "no budget for a lawyer", "can't afford",
  // "no money/funds", "budget/paise/fees nahi", "muft/free wakeel", "pro bono" —
  // is a request for FREE legal aid, NOT the paid lawyer directory. Computed
  // first so the lawyer-discovery rule (3) defers to the legal-aid rule (3b): a
  // citizen who cannot pay must be routed to free legal aid, never asked which
  // city they want a (paid) advocate in. A lawyer/legal context is required so an
  // unrelated "no money"/"free" phrase (e.g. "is the Library free") is never
  // mis-routed here.
  const cannotAfford = /(?:can'?t|cannot|can not|could not|couldn'?t|unable to|not able to|fail to)\s+(?:afford|pay|hire)|\bno\s+(?:money|budget|funds|resources|cash)\b|\b(?:budget|paise|paisa|afford|fees)\s+nahi\b|\bafford\s+(?:nahi|karne)\b|\bnahi\s+(?:afford|bhar|de|kar)\b|\bmuft\b|\bpro\s*bono\b|\bgarib\b/i.test(q);
  const wantsFreeLawyer = /\b(?:muft|free)\s+(?:wakeel|vakeel|advocate|lawyer|legal)\b/i.test(q);
  const lawyerContext = /\b(?:lawyer|wakil|vakeel|wakeel|advocate|attorney|barrister|fees|legal\s+(?:aid|help|advice|service|assistance))\b/i.test(q);
  const cannotAffordLawyer = wantsFreeLawyer || (cannotAfford && lawyerContext) || /(?:lawyer|wakil|vakeel|advocate|attorney)\s+(?:ki\s+)?fees\s+(?:nahi|pay nahi|afford nahi|inteza?am nahi|bhar nahi)/i.test(q);

  if (!opts.legalSituation && !cannotAffordLawyer && /\b(lawyer|wakil|vakeel|advocate|attorney|barrister)\b/i.test(q) && /\b(need|chahiye|find|dhoond|locate|search|recommend|kahan|where|koi|in [a-z]+)\b/i.test(q)) {
    return {
      text: isRoman
        ? 'Tasdeeq shuda wakilon ki directory app ke Legal Aid & Vakeel Directory section mein mojood hai — shehar aur specialization ke mutabiq search karein. Main khud kisi khaas wakil ki sifarish nahi karta. Directory mein bar council ki detail ke saath profiles hain.'
        : 'A verified lawyer directory is available in the Legal Aid & Vakeel Directory section of the app — searchable by city and specialization, with bar council details. I do not personally recommend individual lawyers. Open that section to see the verified profiles.',
      actions: ['lawyers']
    };
  }

  // 3b. Legal-aid / NGO discovery pointer — direct to the verified in-app
  // directory. Fires on an explicit legal-aid/NGO keyword OR an inability-to-afford
  // signal (computed above), so a citizen with no budget reaches free aid while a
  // real legal problem that merely mentions "emergency"/"help" is never mis-routed.
  const wantsLegalAidDir = /\b(legal aid|free legal (?:help|aid|advice|service|assistance)|muft (?:qanooni )?(?:madad|wakeel|legal aid|advice)|ngo|non-?government(?:al)? (?:organization|org)|pro bono)\b/i.test(q);
  const legalAidDirIntent = /\b(need|chahiye|find|dhoond|locate|search|where|kahan|koi|get|contact|raabta|recommend|list|available)\b/i.test(q);
  if (!opts.legalSituation && ((wantsLegalAidDir && legalAidDirIntent) || cannotAffordLawyer)) {
    return {
      text: isRoman
        ? 'Muft qanooni madad, legal aid organizations aur NGOs ki verified directory app ke Legal Aid & NGOs section mein mojood hai — shehar ke mutabiq organization ka contact dekhein. Main khud kisi khaas NGO ki sifarish nahi karta, lekin directory mein verified idaray mojood hain.'
        : 'A verified directory of free legal aid, legal-aid organizations and NGOs is available in the Legal Aid & NGOs section of the app — open it to find organizations by city with their contacts. I do not personally recommend any specific NGO, but the directory lists verified organizations.',
      actions: ['legalaid']
    };
  }

  // 4. App usage / where is X section.
  const mentionsApp = /\b(app|insaaf|insaf|website|portal)\b/i.test(q);
  const appFeatureNames = /\b(library|agent|chat|draft|analy|vault|settings|procedures|directory|legalaid|emergency|helpline)\b/i;
  if ((/\b(how (do i )?(use|work|start)|use (this app|hoti|hai)|ye app kaise|app kaise|what can (you|this app) do|help me (use|with) (this app|you)|features (hai|hain)?)\b/i.test(q) && mentionsApp)
      || (/(where (is|are)|kahan hai|kahan hain)\b/i.test(q) && appFeatureNames.test(q))
      || (/\bhow do i (use|open|find)\b/i.test(q) && appFeatureNames.test(q))) {
    return {
      text: isRoman
        ? 'Insaaf AI ke sections: Legal Chat (qanooni sawal), Legal Agent (raahnumai), Legal Library (qanoon aur dafaat), Document Analyzer (apni document samajhne ke liye), Document Drafter (arzi/notice banane ke liye), Lawyer Directory, Legal Procedures, Legal Aid & NGOs, aur Emergency Helplines. Shuru Legal Chat se karein — apna sawal English ya Roman Urdu mein likhein.'
        : 'Insaaf AI has these sections: Legal Chat (ask legal questions), Legal Agent (guided assistance), Legal Library (laws and sections), Document Analyzer (understand your documents), Document Drafter (create applications and notices), Lawyer Directory, Legal Procedures, Legal Aid & NGOs, and Emergency Helplines. Start with Legal Chat — type your question in English or Roman Urdu.',
      actions: ['chat']
    };
  }

  // 4b. Product identity — "what model are you / who built you / are you ChatGPT".
  // These are not legal questions and must never be answered from the law corpus.
  const identityObjectIsLaw = /\b(qanoon|qawaneen|law|act|amendment|dafa|section|deed|nikah[- ]?nama|contract|f\.?i\.?r\.?|document|dastavez|arz|application|order|adalti)\b/i.test(q);
  const asksProductIdentity = (/\b(what|which|who)\b[\s\S]{0,25}?\b(model|llm|ai|engine|system|technology|developers?|company|team|organisation|organization)\b/i.test(q)
      && /\b(you|your|this\s+(app|ai|assistant|tool)|insaaf|insaf)\b/i.test(q))
    || /\b(are|do)\s+you\s+(chatgpt|gpt|claude|gemini|bard|llama|copilot|a\s+robot|human)\b/i.test(q)
    || /\bwho\s+(made|built|created|developed|owns?)\s+(you|this)\b/i.test(q)
    || (!identityObjectIsLaw && /\b(app|insaaf|insaf|yeh|ye|this)\b[\s\S]{0,25}?\b(kisne|kaun)\b[\s\S]{0,20}?\b(banaya|banayi|banai|banate|develop(?:ed|s)?|created?|made)\b/i.test(q))
    || /\b(aap|app|insaaf)\s+(kaunsa|konsa|kon\s+sa)\s+(model|ai|llm|engine|technology)\b/i.test(q)
    || /\bkaunsa\s+(model|ai|llm)\b[\s\S]{0,25}?\b(use|istemal|kart\w*|chalat\w*|power)\b/i.test(q)
    || /\b(aap|tu)\s+(kon|kaun)\s+(ho|hain)\b/i.test(q);
  if (asksProductIdentity) {
    return {
      text: isRoman
        ? 'Main Insaaf AI hoon — Pakistan ke qanoon, procedures aur legal documents ke liye banaya gaya ek khas (domain-specific) assistant. jawab hamesha verified Pakistani law corpus se retrieve hotay hain aur Insaaf AI ke apne composer se tayyar hotay hain; main general-purpose chatbot nahi hoon aur kisi foreign model ki tarah behave nahi karta. Androoni technical configuration ke baray mein zyada maloomat app ki documentation mein hai. Qanooni sawal ke liye Legal Chat ya Legal Agent istemal karein.'
        : 'I am Insaaf AI — a purpose-built assistant for Pakistani law, court procedure and legal documents. My answers are assembled by Insaaf AI from its own verified Pakistani-law corpus, using the Insaaf AI answer composer. I am not a general-purpose chatbot and I do not go beyond Pakistani legal scope. Internal technical configuration is described in the project documentation, not here in chat. For a legal question, use Legal Chat or the Legal Agent.',
      actions: ['chat']
    };
  }

  // 5. Greetings / small talk.
  if (/^(salam|salaam|assalam|assalamo|assalamu|hello|hi|hey|aoa|asalaam|salamalikum|salamalekum)[\s!.,]*$/i.test(q)
      || /^(salam|salaam|assalam|hello|hi|hey|aoa)\b.*\b(kya|kaise|how)\b.*\b(ho|hai|you|doing|chal)\b/i.test(q)) {
    return {
      text: isRoman
        ? 'Assalam-o-Alaikum! Main Insaaf AI hoon — Pakistan ke qanoon, procedures aur legal documents ke baare mein aap ki madad ke liye. Apna sawal English ya Roman Urdu mein likhein.'
        : 'Hello! I am Insaaf AI — your assistant for Pakistani law, legal procedures and documents. Ask your question in English or Roman Urdu.',
      actions: []
    };
  }

  // 5b. Bare plea for help with no stated problem. Retrieval on "help" matches
  // whatever the highest-scored chunk happens to be, which produced a confident
  // but unrelated legal reference; ask what the matter actually is instead.
  if (/^(help( me)?( please)?|i need (your )?help|need help|please help me|sahayata|madad( karo| me)?|meri madad karo|bas help|koi madad)\W*$/i.test(q)) {
    return {
      text: isRoman
        ? 'Bilkul madad karunga — thora sa wazeh kar dein ke masla kya hai. Aap seedha likhein, maslan \"mera maalik tankhwa nahi de raha\", \"police mere khilaf FIR nahi likh rahi\", \"makan malik deposit wapas nahi kar raha\", ya \"wakeel chahiye\". Aap koi document ya notice yahan paste bhi kar sakte hain — main parh kar samjha dunga.'
        : 'Of course — tell me briefly what the problem is. You can write it plainly, for example \"my employer is not paying my salary\", \"the police will not register my FIR\", \"my landlord is keeping my deposit\", or \"I need a lawyer\". You can also paste a notice or document here and I will read it and explain it.',
      actions: ['chat']
    };
  }

  // 6. Math / non-legal calculations.
  // Exclude queries with non-ASCII characters (Urdu, Arabic, etc.) — these are
  // never math expressions.
  const hasNonASCII = /[^\x00-\x7F]/.test(q);
  // A date is not a division: "tenancy ended on 31/12/2024" is a legal fact, and
  // a spoken transcript almost always carries dates and amounts together.
  const looksLikeDate = /\b\d{1,4}[\/-]\d{1,2}([\/-]\d{1,4})?\b/;
  const LEGAL_SUBJECT = /\b(law|legal|legally|lawful|court|judge|justice|fir|police|advocate|lawyer|vakeel|wakil|tenant|landlord|lease|rent|deposit|contract|agreement|notice|complaint|petition|application|appeal|bail|arrest|divorce|khula|talaq|custody|guardian|inheritance|virsa|property|jaidad|harass|assault|threat|cheque|dishonour|dishonor|salary|wages|refund|claim|damages|compensation|consumer|rights|huqooq|qanoon|adalat|shikayat|muqadma)\b/i;
  const bareExpression = /^[\s\d+\-*\/=().?!x×]+$/i.test(q);
  if (!hasNonASCII && !LEGAL_SUBJECT.test(q) && (bareExpression || (/\b\d+\s*[+\-x×*\/]\s*\d+\b/.test(q) && !looksLikeDate(q)))) {
    return {
      text: isRoman
        ? 'Main aik qanooni madadgar hoon — mera kaam Pakistan ke qanoon, procedures aur documents ki rehnumai karna hai. Hisab ke sawal ke liye calculator use karein. Qanooni masla ho to zaroor poochein!'
        : 'I am a legal assistant for Pakistani law, procedures and documents — not a calculator. Please use a calculator for maths. If you have a legal question, I am ready to help!',
      actions: []
    };
  }

  // 7. Gibberish.
  const gibTokens = q.split(/[\s!.,]+/).filter(Boolean);
  if (gibTokens.length > 0 && gibTokens.every(t => /^(asdfghjkl|qwerty|asdf|zxcv|kjh|uiop|mnbvc|jhgfd|lkjhg|poiu|dfgh|sdfg)$/.test(t))) {
    return {
      text: isRoman
        ? 'Mujhe aap ka sawal samajh nahi aaya. Baraye meharbani apna qanooni sawal dobara likhein.'
        : "I couldn't understand that. Could you rephrase your legal question?",
      actions: []
    };
  }

  // 8. No-context "which law applies" — ask one clarifying question.
  if (/\b(i don'?t know which law|kaun sa qanoon|konsa qanoon|which law (applies|lagta))\b/i.test(q)) {
    return {
      text: isRoman
        ? 'Mujhe apne maslay ki mukhtasar tafseel batayein — kya hua, kab hua aur kaun shaamil tha. Phir main aap ko mutalqa qanoon aur procedure bata sakta hoon. (Maslan: "mera maalik tankhwa nahi de raha" ya "kisi ne meri zameen par qabza kar liya")'
        : 'Tell me briefly what happened, when, and who was involved — then I can identify the law that applies and the procedure to follow. For example: "my employer is not paying my salary" or "someone has occupied my land".',
      actions: ['chat']
    };
  }

  // 8b. A province/city (or a bare "the province") named with NO legal subject
  // (audit FIX 7). The corpus holds hundreds of Sindh records; presenting any one of
  // them as "what Sindh law says" claims an answer to a question that was never
  // asked. Ask which subject — and which province, if none was named — instead.
  const askedScope = detectQueryScope(userQuery);
  const queryTokens = (q.match(SCOPE_WORD_RE) || []);
  const scopeTierNamed = queryTokens.some(t => SCOPE_TIER_WORDS.has(t));
  if (askedScope.province || askedScope.city || scopeTierNamed) {
    const placeWords = [askedScope.province, askedScope.city].filter(Boolean)
      .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const stripped = q
      .replace(/سندھ|پنجاب|بلوچستان|خیبر\s*پختونخوا|پختونخوا|آزاد\s*کشمیر|گلگت|بلتستان|اسلام\s*آباد|کراچی|لاہور|حیدرآباد|پشاور|کوئٹہ/g, ' ')
      .replace(placeWords.length ? new RegExp(`(?:${placeWords.join('|')})`, 'gi') : /(?!)/, ' ');
    const subjectLeft = (stripped.match(SCOPE_WORD_RE) || [])
      .filter(t => !SCOPE_ONLY_WORDS.has(t) && !SCOPE_TIER_WORDS.has(t));
    if (!subjectLeft.length && !/\d/.test(stripped)) {
      const place = askedScope.city || askedScope.province;
      const text = place
        ? (isRoman
          ? `${place} ka koi ek qanoon nahi hota — ${place} ke naame par kai alag qanoon hain (tenancy, family, property, labour, consumer, police/criminal, cyber, local government). Sirf "sooba ka qanoon" likhne se main koi bhi record chun kar aap ko "yeh ${place} ka qanoon kehta hai" de sakta hoon, jo aap ke maslay se milta hi nahi. Is liye baraye meharbani subject likhein — maslan "${place} mein kirayedar ko makan se nikalne ka qanoon", "${place} ki domestic violence Act", ya "${place} mein zameen ki registry". Agar aap ke paas koi notice ya dastavez hai to use upload karein, main parh kar samjha dunga.`
          : `There is no single "law of ${place}" — ${place} has separate laws for tenancy, family, property, labour, consumer, police/criminal, cyber and local-government matters. If the question only names the province, I would have to pick one record and present it as "what ${place}'s law says", which would not be an answer to your actual problem. Please name the subject — for example "evicting a tenant in ${place}", "the ${place} domestic violence Act", or "land registry in ${place}". If you have a notice or document, upload it and I will read and explain it.`)
        : (isRoman
          ? 'Har sooba ke apne alag qanoon hote hain — tenancy, family, property, labour, consumer, police/criminal, cyber aur local government har soobe mein mukhtalif qawaneen se chalti hai. Sirf "sooba ka qanoon" likhne par main koi bhi ek record chun kar aap ko "yeh qanoon kehta hai" de sakta hoon, jo aap ke asal maslay se milta hi nahi — is liye main woh nahi karunga. Baraye meharbani do cheezein likhein: **kaunsa sooba ya shehar**, aur **kis subject par** — maslan "Sindh mein kirayedar ko makan se nikalne ka qanoon", "Punjab ki domestic violence Act", ya "Karachi mein maid ki registry". Agar koi notice ya dastavez hai to use upload karein, main parh kar samjha dunga.'
          : 'Every province has its own separate laws — tenancy, family, property, labour, consumer, police/criminal, cyber and local-government matters each run on different statutes in each province. If the question only says "the provincial law", I would have to pick one record and present it as "what the law says", which would not answer your actual problem — so I will not do that. Please give me two things: **which province or city**, and **which subject** — for example "evicting a tenant in Sindh", "the Punjab domestic violence Act", or "land registry in Karachi". If you have a notice or document, upload it and I will read and explain it.');
      return { text, actions: ['chat'] };
    }
  }

  // 9. Part X — general life / community / current-data help (never a cold refusal).
  const general = generalLifeAnswer(userQuery, activeLang);
  if (general) return general;

  return null;
}

/**
 * Part X — OUT-OF-SCOPE / GENERAL HELP classifier.
 * When a request is not a verifiable legal lookup we must NOT reply with a cold
 * "data unavailable" refusal. Instead classify it and respond helpfully:
 *   - CURRENT / TIME-SENSITIVE  → explain a live source is needed; never fabricate.
 *   - GENERAL LIFE / COMMUNITY   → practical steps + the right authority/channel.
 *   - HARMLESS UNRELATED         → brief natural reply, then offer legal/app help.
 * A query that explicitly asks for formal legal action is deferred to the legal
 * /RAG path (returns null) so verified law always wins over general guidance.
 * Returns { text, actions } or null.
 */
function generalLifeAnswer(userQuery, activeLang) {
  const q = (userQuery || '').toLowerCase().trim();
  if (!q) return null;
  const isRoman = activeLang === 'roman_urdu';

  // Defer to the legal/RAG path when the user clearly wants formal legal action.
  const wantsLegalRoute = /\b(sue|lawsuit|file a case|legal action|legal notice|muqadma|case karna|adalat|court|consumer court|petition|writ|wakeel|lawyer|vakeel|advocate|compensation claim|damages claim)\b/i.test(q);

  // A. CURRENT / TIME-SENSITIVE data — never invent live facts.
  const isCurrentData = /\b(market price|market rate|aaj ka|today'?s (price|rate)|current (price|rate)|live (price|rate|score)|gold (rate|price)|silver (rate|price)|sona|chandi|dollar|exchange rate|currency rate|forex|petrol|diesel|fuel price|cng price|weather|temperature|mausam|barish|cricket|match score|live score|election result|latest news|aaj ki khabar|bitcoin|crypto|share (price|market)|stock (price|market))\b/i.test(q)
    || /(kitna|kya|kitni)\s+(rate|price|bhao|qeemat)\b/i.test(q)
    || /\b(aaj|today|right now|abhi)\b.*\b(price|rate|bhao|qeemat|score|weather|mausam)\b/i.test(q)
    // Urdu script is a separate writing system: \b cannot bound these words, so
    // the same classes are matched as plain substrings.
    || /(موسم|درجہ حرارت|سونے|چاندی|ریٹ|قیمت|بھاؤ|ڈالر|زر مبادلہ|پٹرول|ڈیزل|کرکٹ|میچ|اسکور|الیکشن کا نتیجہ|خبر|تازہ)/.test(q);
  if (isCurrentData && !wantsLegalRoute) {
    return {
      kind: 'abstain',
      text: isRoman
        ? 'Yeh aik waqt-haasil (real-time) maloomat hai — maslan aaj ka rate, qeemat, mausam ya score. Mere paas live data feed nahi hai, is liye main sahih mojooda qeemat nahi bata sakta aur main jaan-boojh kar galat number nahi banaunga. Baraye meharbani mutalqa live source — jaise utility/market ki official website, bank, ya news service — se tasdeeq karein. Agar is mein koi qanooni pehlu ho (maslan over-billing ya consumer ka masla), to mujhe batayein — main aap ko qanooni raasta bata sakta hoon.'
        : 'This is real-time information (for example a current rate, price, weather or score). I do not have a live data feed, so I cannot give you an accurate current value — and I will not invent one. Please verify it from the relevant live source such as the official utility/market website, your bank, or a news service. If there is a legal angle to it (for example over-billing or a consumer dispute), tell me and I can explain your legal options.',
      actions: []
    };
  }

  // B. UTILITIES / BILLS — the canonical Part X general-help example.
  const isUtility = /\b(electricity|bijli|light bill|power bill|electric bill|k-?electric|lesco|mepco|iesco|fesco|pesco|qesco|sepco|tepco|hesco|bescom|nepco|sui gas|gas bill|gas connection|water bill|pani ka bill|wasa|sewerage|load shedding|meter reading|over-?billed|bill zyada|bill bara|bijli ka bill)\b/i.test(q);
  if (isUtility && !wantsLegalRoute) {
    return {
      text: isRoman
        ? 'Zyada ya ghalat bill ke liye aam tor par yeh practical qadmon par amal karein:\n\n1. **Meter reading check karein** — bill par di gayi reading apne meter ki mojooda reading se milayen; agar farq hai to tasveer lein.\n2. **Billing history dekhein** — pichle 3-6 mahinon ke bills se muwazna karein taake achanak izafa nazar aaye.\n3. **Utility ko complaint karein** — apni supply company (jaise K-Electric, LESCO, IESCO, MEPCO, FESCO, PESCO, ya Sui Gas) ki official helpline/online complaint par darkhwast dein aur complaint number mehfooz karein.\n4. **Record mehfooz karein** — bills, meter readings, complaints aur rasooqai ki photocopies ya phone par tasveerain rakhein.\n5. **Consumer forum** — agar shikayat hal nahi hoti ya over-billing hui hai, to Consumer Protection Act ke tehat mutalqa Consumer Court / District Consumer Protection Council se raabta kar sakte hain.\n\nYeh amoomi rehnumai hai; har shehar aur company ka apna procedure ho sakta hai. Agar aap qanooni karwai (consumer complaint ya notice) karna chahte hain, to bata dein — main aap ko tareeqa aur document drafter ki taraf le ja sakta hoon.'
        : 'For an unusually high or wrong bill, the practical steps are usually:\n\n1. **Check the meter reading** — compare the reading printed on the bill with your actual meter; photograph it if they differ.\n2. **Review your billing history** — compare the last 3–6 months of bills so a sudden jump is visible.\n3. **Complain to the utility** — lodge a complaint with your supply company (for example K-Electric, LESCO, IESCO, MEPCO, FESCO, PESCO, or Sui Gas) through its official helpline or online portal, and keep the complaint number.\n4. **Preserve your records** — keep copies or photos of bills, meter readings, complaints and receipts.\n5. **Consumer forum** — if the complaint is not resolved or you were over-billed, you may approach the relevant Consumer Court / District Consumer Protection Council under the Consumer Protection Act.\n\nThis is general guidance; the exact procedure varies by city and company. If you want to take legal action (a consumer complaint or notice), tell me and I can guide you to the procedure and the document drafter.',
      actions: []
    };
  }

  // C. SOCIAL-PROTECTION PROGRAMMES (BISP / 8171 / Ehsaas income support /
  // Kafalat). Two different asks arrive here and only one of them is dangerous.
  // A citizen asking for their OWN eligibility or payment result cannot be
  // answered at all: that verdict is BISP's record system checking a CNIC, and
  // Insaaf AI holds no authorised integration with it, so any answer would be
  // invented. A citizen asking what the programme itself publishes — the PMT
  // cut-off, the registration steps, the documents, the next-of-kin route, where
  // to complain — is now a normal retrieval question: bisp_8171_programme_procedures
  // carries those records with BISP's own wording and URLs, so the guard must not
  // stand in front of them. This guard originally pre-empted the whole class
  // because the corpus then held no income-support record at all.
  // BISP publishes this programme under three Latin spellings — "Benazir
  // Kafaalat" on its programme pages, "BISP Kifalat Programme" in its own
  // leaflets, and "Benazir Kafalat" as commonly written — so the cue must carry
  // all three or a citizen using the official spelling slips past the guard.
  const namesSupportProgramme = /\b(bisp|8171|benazir income support|ehsaas|e-?hsaas|kafaalat|kifalat|kafalat|wbsf)\b/i.test(q)
    || /(بینظیر|ااحساس|کفالت)/.test(userQuery || '');
  const isEducationScholarshipContext = /\b(scholarship|scholarships|stipend|fellowship|admission|university|college|degree|diploma|muet|hec|hostel|fee|tuition|student)\b/i.test(q);
  const asksOwnVerdict = /\b(am i|can i|will i|do i qualify|i qualify|my eligibility|my status|my cnic|check my|my account|my payment|my qist|meri eligibility|mera status|main eligible|kya main|mujhe milega)\b/i.test(q)
    || /(کیا میں|میری اہلیت|میرا اسٹیٹس|مجھے ملتا|میری قسط)/.test(userQuery || '');
  // "How do I check my 8171 status?" and "am I eligible?" both contain a
  // first-person phrase, and only the second one wants a verdict. The corpus
  // holds BISP's own wording for the checking channels, the documents and the
  // complaint routes, so a how-to ask must reach retrieval: it carries no
  // household record, so answering it cannot invent a result for this citizen.
  const isProcedureHowTo = /\b(how|kaise|kaisay|kaisa|kese|tareeqa|tareeq|triqa|procedure|process|steps?|kya karna|konse|kaunse|kis number|kahan|where|website|portal|form|documents?|last date|deadline)\b/i.test(q)
    || /(کیسے|طریقہ|کیا کرنا|کون سی|کونسے|کس نمبر|کہاں|پورٹل|فارم|دستاویز)/.test(userQuery || '');
  if (namesSupportProgramme && asksOwnVerdict && !isProcedureHowTo && !isEducationScholarshipContext && !wantsLegalRoute) {
    return {
      text: isRoman
        ? 'Main aap ki **nijati** BISP / 8171 ya Ehsaas eligibility ya payment ka result nahi bata sakta — yeh faisla sirf BISP ka apna record system aap ke CNIC ke khilaf deta hai, aur Insaaf AI ka us se koi authorized integration nahi. Is liye main aap ke ghar ke baare mein koi baat likhna inkaar karta hoon: woh tarfeeq hoti.\n\nJo cheez verified corpus mein mojood hai, woh BISP ka apna **shayahd programme material** hai: Proxy Means Test aur NSER survey se beneficiaries ki pehchaan, PMT ka shayahd cut-off score, Kafaalat registration ke steps aur required documents, beneficiary ki maut ke baad waris ka route aur us ke documents, aur shikayat ka tareeqa (qareebi Tehsil office, toll-free helpline 0800-26477, aur BISP ki warning ke official communication sirf 8171 se aati hai). Aise sawal is tarah likhein — "BISP Kafaalat ki registration ke liye kaunse documents chahiye?" — main un records se jawab doonga aur BISP ke URLs hawale karunga.\n\nApne nijati status ke liye published channel 8171 web portal (8171.bisp.gov.pk) aur bisp.gov.pk hai — yeh destination hai, suboot nahi.'
        : 'I cannot give you **your own** BISP / 8171 or Ehsaas eligibility or payment result — that verdict comes only from BISP\'s record system checking your CNIC, and Insaaf AI has no authorised integration with it. So I will not write anything about your household: it would be invented.\n\nWhat the verified corpus does hold is BISP\'s own published programme material: how beneficiaries are identified through the Proxy Means Test and the NSER survey, the published PMT cut-off score, the Kafaalat registration steps and required documents, the next-of-kin route when a beneficiary dies and the documents it needs, and how a beneficiary complains (nearest Tehsil office, the toll-free helpline 0800-26477, and BISP\'s own warning that official communication originates only from 8171). Ask it that way — for example "which documents are required to register for Benazir Kafaalat?" — and I will answer from those records and cite BISP.\n\nFor your own status the published channel is the 8171 web portal (8171.bisp.gov.pk) and bisp.gov.pk — a destination, not evidence.',
      actions: []
    };
  }

  // D. ADMINISTRATIVE / COMMUNITY help — point to the official channel (never invent numbers/URLs).
  const isAdmin = /\b(cnic|nadra|identity card|shanakhti card|driving license|driving licence|vehicle registration|number plate|passport|visa|traffic challan|e-?challan|admission|scholarship|hospital|doctor appointment|vaccination|birth certificate|domicile|character certificate|tax return|\bfbr\b|\bntn\b)\b/i.test(q);
  const isEducationContext = /\b(university|colleges?|schools?|students?|hec|admission fee|merit list|hostel|exam|examination|scholarships?( application)?|eligibility criteria|degree|transcript|academic|semester|discipline|show.cause|ragging|probation|attestation|equivalence|student societ|transport|university transport|gcu\w*|szabst|iqra university|merit|weightage|pre.?entry|provisional admission|fee refund|refund of fee|fee structure|credit hours?|attendance|bonafide|challan|result withheld)\b/i.test(q) || /یونیورسٹی|کالج|اسکول|طالب علم|امتحان|حاضری|داخلہ|فیس/.test(userQuery || '') || (/\badmission\b/i.test(q) && /\b(cancel|reject|refus|deny|denied|dismiss|expell?|suspend)\b/i.test(q));
  // An overseas Pakistani whose papers an employer is withholding is not asking
  // how to obtain a document — that is a live criminal/cross-border claim, and the
  // administrative blurb would bury it. Defer to the legal route in that case.
  const isAbroadContext = /\b(abroad|overseas|foreign country|saudi|uae|dubai|abu dhabi|qatar|oman|kuwait|bahrain|yemen|malaysia|gulf|uk|uk.?mode|england|america|canada|australia|europe|italy|spain|greece|poland|russia|china|japan|korea|turkey|libya|romania|serbia)\b/i.test(q);
  const statesLegalWrong = /\b(took|snatch\w*|confiscat\w*|seiz\w*|not (?:giving|returning)|refus\w* to (?:return|give|pay)|arrest\w*|deport\w*|fir|police|fraud|scam|cheat\w*|harass\w*|blackmail\w*|threaten\w*|beat\w*|tortur\w*|martag|ghaflat|loot\w*|force\w*|contract.*breach|sponsor)\b/i.test(q);
  // A death, injury or clinical fault is a legal claim, not a service enquiry —
  // "hospital" appears in both, so the harm signal decides which branch answers.
  const isHarmClaim = /\b(negligen\w*|malpractice|misdiagnos\w*|wrong[- ]?(treatment|medicine|injection)|quack|fake doctor|dead|died|death|died in|killed|murder|homicide|injur\w*|hurt|amputat\w*|disabled|poison\w*|qatl|maara|galeh|ghaatile?|zakhmi|chot)\b/i.test(q);
  // A question that names a civic document AND asks a procedure question is not
  // a general administrative enquiry — the verified civic corpus holds the
  // actual NADRA / DGIP / Deputy Commissioner workflows, so these must reach
  // retrieval instead of being answered by the blurb below.
  const isCivicProcedure = (
    /\b(cnic|nicop|poc\s*card|b.?form|child registration certificate|frc|family registration certificate|passport|domicile)\b/i.test(q)
    || /(شناختی\s*کارڈ|پاسپورٹ|ب\s*فارم|ڈومیسائل|خاندانی\s*شناختی)/.test(userQuery || '')
  ) && (
    /\b(how|procedure|process|apply|application|renew|renewal|modify|modification|reprint|document|documents|required|requirement|fee|fees|charge|charges|where|office|track|status|eligib\w*|lost|issue|form|difference|distin\w*|compar\w*|versus|vs\.?|same as)\b/i.test(q)
    || /\b(kaise|kas|karna|karo|bana|banwa|lena|chahiye|kahan|kitna|kitni|tareeqa|tareeq|raasta|farq|alag)\b/i.test(q)
    || /(کیسے|کہاں|کتن|طریقہ|بنوا|لینے|دینا|چاہیے|فرق|مقابلہ|تمیز)/.test(userQuery || '')
  );
  if (isAdmin && !isHarmClaim && !wantsLegalRoute && !isEducationContext && !isCivicProcedure && !(isAbroadContext && statesLegalWrong)) {
    return {
      text: isRoman
        ? 'Yeh aam tor par aik sarkari / idarajaat ka mamla hai. Behtareen raasta yeh hai ke mutalqa official idaray se raabta karein — maslan CNIC/shanakhti card, domicile ya birth certificate ke liye NADRA; driving license ya vehicle registration ke liye relevant Excise & Taxation / Licensing authority; passport ke liye Passport Office; traffic challan ke liye relevant traffic police; aur admission/scholarship ke liye mutalqa idara ya HEC. Amoomi tor par: apni pehchan (CNIC) saath rakhein, official website ya helpline par tasdeeq shuda tareeqa aur fees check karein, aur rasooqai mehfooz karein. Main jaan-boojh kar koi phone number ya URL nahi bana raha taake aap ko galat maloomat na mile. Agar is mein qanooni masla ho (maslan darkhwast reject hona ya haq ki khilaf warzi), to bata dein.'
        : 'This is generally a government / administrative matter. The best route is to contact the relevant official authority — for example NADRA for a CNIC/identity card, domicile or birth certificate; the relevant Excise & Taxation / Licensing authority for a driving licence or vehicle registration; the Passport Office for a passport; the relevant traffic police for a traffic challan; and the concerned institution or HEC for admissions/scholarships. In general: keep your CNIC handy, confirm the verified procedure and fee on the official website or helpline, and preserve your receipts. I deliberately do not invent phone numbers or URLs so you are not given wrong information. If there is a legal problem in it (for example a rejected application or a violation of your rights), tell me.',
      actions: []
    };
  }

  // D. HARMLESS UNRELATED small talk / casual — reply naturally, then offer help.
  //    We do not fabricate general-knowledge facts offline; we stay honest and friendly.
  const isCasual = /\b(tell me a joke|joke|story|kahani|shairi|poem|sing a song|gana|recipe|khana pakane|movie|film|video game|thanks|shukriya|thank you|well done|good job|nice|bored|bor ho raha)\b/i.test(q);
  if (isCasual && !wantsLegalRoute) {
    return {
      text: isRoman
        ? 'Main Insaaf AI hoon — Pakistan ke qanoon, procedures aur documents ke liye aik sanjeeda madadgar. Main general knowledge, jokes ya dil-bahlaa baatein nahi karta, lekin qanooni madad zaroor kar sakta hoon: apna masla batayein, koi dafa pochein, document samjhein ya banayein, ya wakeel/legal aid dhoondein.'
        : 'I am Insaaf AI — a serious assistant for Pakistani law, procedures and documents. I don\'t handle general-knowledge, jokes or casual chat, but I can genuinely help with legal matters: describe your problem, ask about a law or section, understand or draft a document, or find a lawyer/legal aid.',
      actions: ['chat']
    };
  }

  return null;
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Backend AI Rate Limiter (P46)
const rateLimits = new Map();
const rateLimitWindowMs = 60 * 1000; // 1 minute window

// Periodic cleanup to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimits.entries()) {
    const valid = timestamps.filter(ts => now - ts < rateLimitWindowMs);
    if (valid.length === 0) {
      rateLimits.delete(key);
    } else {
      rateLimits.set(key, valid);
    }
  }
}, 5 * 60 * 1000); // every 5 minutes

function rateLimiterMiddleware(req, res, next) {
  const isAuth = !!(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));
  // The token is a live credential; only a stable digest is needed to identify a
  // bucket, so the raw value never ends up as a key held in server memory.
  const clientKey = isAuth
    ? `auth_${crypto.createHash('sha256').update(req.headers.authorization.substring(7)).digest('hex').slice(0, 16)}`
    : `ip_${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
  
  const path = req.path;
  const isExpensive = path.includes('/generate') || path.includes('/analyze');
  const maxRequests = isExpensive 
    ? (isAuth ? 15 : 6) // Expensive operations (document generation)
    : (isAuth ? 60 : 30); // Ordinary chat operations

  // P46 fix: keep SEPARATE budgets for expensive vs ordinary operations. The
  // previous shared counter let a few ordinary chat requests exhaust the stricter
  // /generate limit, locking a legitimate user out of document drafting for the
  // rest of the one-minute window. Each bucket is still independently capped.
  const bucketKey = `${clientKey}:${isExpensive ? 'expensive' : 'ordinary'}`;

  const now = Date.now();
  if (!rateLimits.has(bucketKey)) {
    rateLimits.set(bucketKey, []);
  }

  const timestamps = rateLimits.get(bucketKey);
  const validTimestamps = timestamps.filter(ts => now - ts < rateLimitWindowMs);

  if (validTimestamps.length >= maxRequests) {
    // Clients need to know WHEN they may retry — without this the UI can only show
    // a generic "something went wrong" for a purely timing-related denial.
    const retryAfterSeconds = Math.max(1, Math.ceil((validTimestamps[0] + rateLimitWindowMs - now) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', '0');
    res.set('X-RateLimit-Window', `${Math.round(rateLimitWindowMs / 1000)}s`);
    return res.status(429).json({
      error: "Too many requests. Please try again shortly.",
      code: "RATE_LIMITED",
      retryAfterSeconds
    });
  }

  validTimestamps.push(now);
  rateLimits.set(bucketKey, validTimestamps);
  next();
}

// Safe server-side input validation (security hardening)
// Non-destructive: rejects malformed/oversized requests without altering legal content
const MAX_QUERY_LENGTH = 4000;
const MAX_HISTORY_ITEMS = 30;
const MAX_HISTORY_ITEM_LENGTH = 8000;
const MAX_ANALYZE_TEXT_LENGTH = 200000;
const MAX_DOCUMENT_CONTEXT_LENGTH = 200000;
// Feature 1: Chat responses are English / Roman Urdu only.
// 'ur' is accepted as an INPUT preference (the user writes Urdu script) and is
// normalized to a Roman Urdu response by resolveChatLanguage; Urdu Script remains
// a real output language only for the document generation endpoint (/api/ai/generate).
const ALLOWED_LANGUAGES = ['en', 'roman_urdu', 'ur', 'Auto', 'auto'];

function validateChatInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object.';
  }
  if (body.userQuery === undefined || body.userQuery === null) {
    return 'Missing required field: userQuery.';
  }
  if (typeof body.userQuery !== 'string') {
    return 'userQuery must be a string.';
  }
  const query = body.userQuery.trim();
  if (query.length === 0) {
    return 'userQuery cannot be empty.';
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return `userQuery exceeds maximum length of ${MAX_QUERY_LENGTH} characters.`;
  }
  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      return 'history must be an array.';
    }
    if (body.history.length > MAX_HISTORY_ITEMS) {
      return `history exceeds maximum of ${MAX_HISTORY_ITEMS} items.`;
    }
    for (const item of body.history) {
      // Two clients, two field names: /chat posts {role,text}, the Legal Agent and
      // the document editor post {role,content}. Rejecting the second shape made a
      // follow-up turn a hard 400 for a real user of the app.
      if (!item || typeof item !== 'object') {
        return 'history items must be objects with a string text or content field.';
      }
      const length = typeof item.text === 'string' ? item.text.length
        : typeof item.content === 'string' ? item.content.length : null;
      if (length === null) {
        return 'history items must be objects with a string text or content field.';
      }
      if (length > MAX_HISTORY_ITEM_LENGTH) {
        return `history item exceeds maximum length of ${MAX_HISTORY_ITEM_LENGTH} characters.`;
      }
    }
  }
  if (body.preferredLanguage !== undefined && !ALLOWED_LANGUAGES.includes(body.preferredLanguage)) {
    return 'Unsupported preferredLanguage.';
  }
  return null; // valid
}

function validateAnalyzeInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object.';
  }
  const { text, fileBase64, mimeType } = body;
  if (mimeType !== undefined && mimeType !== null && mimeType !== '') {
    if (typeof mimeType !== 'string') {
      return 'mimeType must be a string.';
    }
    const isSupported = mimeType === 'application/pdf' || mimeType === 'text/plain' || mimeType.startsWith('image/');
    if (!isSupported) {
      return `Unsupported mimeType: ${mimeType}`;
    }
  }
  if (text !== undefined && text !== null) {
    if (typeof text !== 'string') {
      return 'text must be a string.';
    }
    if (text.length > MAX_ANALYZE_TEXT_LENGTH) {
      return `text exceeds maximum length of ${MAX_ANALYZE_TEXT_LENGTH} characters.`;
    }
  }
  if (fileBase64 !== undefined && fileBase64 !== null && typeof fileBase64 !== 'string') {
    return 'fileBase64 must be a string.';
  }
  if (!text && !fileBase64) {
    return 'Either text or fileBase64 is required.';
  }
  return null; // valid
}

function validateDocumentChatInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object.';
  }
  if (body.userInput === undefined || typeof body.userInput !== 'string') {
    return 'Missing required field: userInput (string).';
  }
  if (body.userInput.trim().length === 0) {
    return 'userInput cannot be empty.';
  }
  if (body.userInput.length > MAX_QUERY_LENGTH) {
    return `userInput exceeds maximum length of ${MAX_QUERY_LENGTH} characters.`;
  }
  if (body.context !== undefined) {
    if (typeof body.context !== 'string') {
      return 'context must be a string.';
    }
    if (body.context.length > MAX_DOCUMENT_CONTEXT_LENGTH) {
      return `context exceeds maximum length of ${MAX_DOCUMENT_CONTEXT_LENGTH} characters.`;
    }
  }
  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      return 'history must be an array.';
    }
    if (body.history.length > MAX_HISTORY_ITEMS) {
      return `history exceeds maximum of ${MAX_HISTORY_ITEMS} items.`;
    }
  }
  return null; // valid
}


// --- Document Intelligence quick-action detection + formatting ---------------
// The Document Intelligence tab's quick actions (Explain, Summarize, Analyze
// Risks) build a prompt that wraps the user's pasted text between "---" markers.
// When AI_PROVIDER=insaaf the external provider chain is empty, so these would
// fall through to RAG + composeOwnedModelAnswer which ignores the action intent.
// These two helpers intercept the request BEFORE RAG and route to the local
// document analyzer (analyzeDocumentText) which already has summarize, risks
// and analysis capabilities grounded in the actual pasted text.

// Multi-signal language detection: Urdu script → roman_urdu; otherwise count
// distinctive Roman Urdu words (requiring 2+ matches) and strong phrase patterns.
// This prevents common English words ("to", "hi", "a", "in") from triggering
// a false roman_urdu classification.
function detectLanguage(text) {
  const q = String(text || '');
  if (/[\u0600-\u06FF]/.test(q)) return 'roman_urdu';

  // P0 — prose language is decided by ONE detector for the whole product
  // (server/languageDetect.js). This function used to count its own hand-listed
  // cue words while ragEngine.processQuery counted a different list, so a plain
  // Roman Urdu ask — "office ne salary rok di", "saman kharab nikla", "mere
  // huqooq maar diye ja rahe hain" — cleared neither count and was answered in
  // English. The shared classifier scores Urdu grammar against English grammar
  // instead of counting one fixed inventory.
  return detectWrittenLanguage(q) === 'en' ? 'en' : 'roman_urdu';
}

/**
 * P0 — THE PRODUCT LANGUAGE CONTRACT. One rule, used by every route that writes
 * prose to the user: chat, advice, agent, document-understanding, document-compare,
 * readiness-checklist and document-reply meta guidance.
 *
 *   English input      → English answer
 *   Roman Urdu input   → Roman Urdu answer
 *   Urdu SCRIPT input  → Roman Urdu answer
 *
 * The language the user ACTUALLY WROTE IN decides the answer. `preferredLanguage`
 * is the UI chrome language and is only ever a floor, never a ceiling: the default
 * chrome is English (src/lib/i18n.ts getCurrentLanguage returns 'en' unless the
 * person switches it), so letting an 'en' chrome outrank the input silenced the
 * contract for every Roman Urdu and Urdu-script question. Therefore Urdu script
 * resolves to Roman Urdu first, detected Roman Urdu resolves to Roman Urdu even
 * under an English chrome, and an explicit 'roman_urdu' chrome answers even an
 * English question in Roman Urdu.
 * Answer prose is never rendered in Urdu script; the only place Urdu Script is a
 * real output language is a generated legal document (/api/ai/generate and the
 * document-reply body), and only when the user explicitly chose it.
 *
 * `userQuery` is the user's OWN words — the question or description. For document
 * routes with no question, the extracted document text is the only user-written
 * text available to detect from.
 */
function resolveChatLanguage(preferredLanguage, userQuery) {
  // An explicit Urdu or Roman Urdu selection is honoured exactly; the assistant
  // must never swap the language the user selected. 'en' and Auto keep the
  // input-detection floor, because the default UI chrome is English and letting
  // it outrank the question silenced Roman Urdu answers.
  if (preferredLanguage === 'ur') return 'ur';
  if (preferredLanguage === 'roman_urdu') return 'roman_urdu';
  if (/[\u0600-\u06FF]/.test(String(userQuery || ''))) return 'ur';
  if (detectLanguage(userQuery) === 'roman_urdu') return 'roman_urdu';
  return 'en';
}

// P0 — a refusal is part of the answer, so it is written in the resolved response
// language instead of staying a hardcoded English string.
function prose(lang, en, roman, urdu) {
  if (lang === 'roman_urdu') return roman;
  if (lang === 'ur') return urdu || en;
  return en;
}

function detectDocIntelligenceAction(userQuery) {
  const q = String(userQuery || '');
  // Greedy match: captures from first ---\n to the LAST \n---, so user text
  // that itself contains --- on a line is still captured in full.
  const textMatch = /---\n([\s\S]*)\n---/.exec(q);
  if (!textMatch) return null;
  const pastedText = textMatch[1].trim();
  if (!pastedText || pastedText.length < 10) return null;

  // Summarize: EN "provide a concise, structured summary" / Roman "mukhtasar, munazzam khulasa"
  if (/concise.*structured summary|mukhtasar.*munazzam khulasa|Text to summarize/i.test(q)) {
    return { action: 'summarize', text: pastedText };
  }
  // Risks: EN "identify potential legal risks" / Roman "qanooni khatrat"
  if (/identify potential legal risks|qanooni khatrat|mumkina qanooni|Text to analyze/i.test(q)) {
    return { action: 'risks', text: pastedText };
  }
  // Explain: EN "explain it in simple, clear" / Roman "asaan, saaf"
  if (/explain it in simple|asaan.*saaf.*Roman Urdu|Text to explain/i.test(q)) {
    return { action: 'explain', text: pastedText };
  }
  return null;
}

function formatDocIntelligenceResponse(action, analysis, activeLang) {
  const isRoman = activeLang === 'roman_urdu';
  // FIX 3: an refused upload already carries its own explanation — report it
  // rather than formatting an empty analysis as "nothing was found".
  if (analysis && analysis.documentType === null && analysis.summary === null && analysis.answer) {
    // P0 — no Urdu-script branch: the response language is only ever English or
    // Roman Urdu, so a refusal heading can never be rendered in Urdu script.
    const heading = isRoman ? 'Document parha nahi ja saka' : 'Document could not be read';
    return `**${heading}**\n\n${analysis.answer}`;
  }
  const { documentType: docType, summary, parties, dates, deadlines, amounts, risks, nextSteps, categorizedRisks } = analysis;

  if (action === 'summarize') {
    const lines = [];
    lines.push(isRoman ? '**Khulasa:**' : '**Summary:**');
    lines.push(summary || (isRoman ? 'Text se koi wazeh khulasa nahi nikla.' : 'No clear summary could be extracted from the text.'));
    lines.push('');
    lines.push(isRoman ? '**Aham Nuqat:**' : '**Key Points:**');
    if (dates && dates.length) lines.push((isRoman ? '- Tareekhen: ' : '- Dates: ') + dates.join('; '));
    if (deadlines && deadlines.length) lines.push((isRoman ? '- Deadlines: ' : '- Deadlines: ') + deadlines.join('; '));
    if (amounts && amounts.length) lines.push((isRoman ? '- Raqmein: ' : '- Amounts: ') + [...new Set(amounts)].slice(0, 5).join('; '));
    if (parties && parties.length) lines.push((isRoman ? '- Farqain: ' : '- Parties: ') + parties.slice(0, 5).join('; '));
    if (!dates?.length && !deadlines?.length && !amounts?.length && !parties?.length) {
      lines.push(isRoman ? '- Text mein koi khaas numerical haqaiq nahi mile.' : '- No specific numerical facts were detected in the text.');
    }
    lines.push('');
    if (docType) {
      lines.push(isRoman ? `**Dastawez ki Qisam:** ${docType}` : `**Type of Document:** ${docType}`);
    }
    return lines.join('\n');
  }

  if (action === 'risks') {
    const lines = [];
    // Risk level: derive from number and severity of risks found
    const allRisks = categorizedRisks
      ? [...(categorizedRisks.deadline || []), ...(categorizedRisks.legalIssue || []), ...(categorizedRisks.unusualClause || []), ...(categorizedRisks.missingInfo || [])]
      : (risks || []);
    const riskCount = allRisks.length;
    const riskLevel = riskCount >= 3 ? (isRoman ? 'Zyada' : 'High') : riskCount >= 1 ? (isRoman ? 'Darmiyana' : 'Medium') : (isRoman ? 'Kam' : 'Low');
    lines.push(isRoman ? `**Khatre Ki Satah:** ${riskLevel}` : `**Risk Level:** ${riskLevel}`);
    lines.push('');
    lines.push(isRoman ? '**Pehchane Shuda Khatrat:**' : '**Identified Risks:**');
    if (allRisks.length) {
      for (const r of allRisks) lines.push(`- ${r}`);
    } else {
      lines.push(isRoman ? '- Text mein koi wazeh qanooni khatra nahi mila.' : '- No clear legal risks were detected in the text.');
    }
    lines.push('');
    if (categorizedRisks && categorizedRisks.missingInfo && categorizedRisks.missingInfo.length) {
      lines.push(isRoman ? '**Ghaib Maloomat:**' : '**Missing Information:**');
      for (const m of categorizedRisks.missingInfo) lines.push(`- ${m}`);
      lines.push('');
    }
    lines.push(isRoman ? '**Tajweez Karda Qadam:**' : '**Recommended Actions:**');
    if (nextSteps && nextSteps.length) {
      for (const s of nextSteps.slice(0, 3)) lines.push(`- ${s}`);
    } else {
      lines.push(isRoman ? '- Original document mehfooz rakhein aur copy bana kar rakhein.' : '- Keep the original document safe and make copies.');
    }
    lines.push('');
    lines.push(isRoman ? '**Zaroori:** Sirf text mein maujood maloomat ki bina par tajziya kiya gaya hai. Qanooni mashware ke liye registered wakil se raabta karen.' : '**Important:** Analysis is based only on information present in the text. Consult a registered advocate for legal advice.');
    return lines.join('\n');
  }

  if (action === 'explain') {
    const lines = [];
    lines.push(isRoman ? '**Is ka matlab:**' : '**What this says:**');
    lines.push(summary || (isRoman ? 'Text ka wazeh matlab nahi nikla.' : 'The text did not yield a clear summary.'));
    lines.push('');
    lines.push(isRoman ? '**Aap ke liye iska matlab:**' : '**What it means for you:**');
    if (analysis.requirements && analysis.requirements.length) {
      lines.push(isRoman ? `Yeh document aap se yeh maangta hai: ${analysis.requirements.slice(0, 2).join('; ')}.` : `This document asks you to: ${analysis.requirements.slice(0, 2).join('; ')}.`);
    } else {
      lines.push(isRoman ? 'Text mein koi wazeh hidayat nahi mili.' : 'No explicit instruction was found in the text.');
    }
    if (deadlines && deadlines.length) {
      lines.push(isRoman ? `Mohlat: ${deadlines[0]}.` : `Deadline: ${deadlines[0]}.`);
    }
    lines.push('');
    if (docType) {
      lines.push(isRoman ? `**Dastawez ki Qisam:** ${docType}` : `**Type of Document:** ${docType}`);
      lines.push('');
    }
    lines.push(isRoman ? '**Aage kya karen:**' : '**What to do next:**');
    if (nextSteps && nextSteps.length) {
      for (const s of nextSteps.slice(0, 3)) lines.push(`- ${s}`);
    } else {
      lines.push(isRoman ? '- Original document mehfooz rakhein.' : '- Keep the original document safe.');
    }
    return lines.join('\n');
  }

  return summary || '';
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Insaaf AI Backend API',
    timestamp: new Date().toISOString(),
    runtime: 'owned-model-local'
  });
});

/**
 * §5B — what an anonymous caller may see is operational status only. Which
 * provider module is loaded, the model identifier, the config file path and the
 * embedding mode are runtime internals: they fingerprint the stack for an
 * attacker and answer no user question, so they go only to a signed-in caller
 * (a bearer token is the same signal the rate limiter uses).
 */
function isSignedInRequest(req) {
  return !!(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));
}

// Reports the real state of the selected model transport (deterministic composer,
// Cloudflare Workers AI, Hugging Face ZeroGPU Space, or the private LoRA service):
// whether it is enabled, whether it is configured and what the transport actually
// reports. Workers AI is serverless, so it never claims a loaded model; it reports
// `modelAvailable` from a real, quota-free account probe. `?probe=1` performs it.
app.get('/api/ai/lora-status', async (req, res) => {
  const health = await modelInferenceHealth({ probe: req.query.probe === '1' });
  res.json({
    enabled: modelInferenceEnabled(),
    serviceConfigured: modelInferenceConfigured(),
    ...health
  });
});

app.get('/api/ai/health', async (req, res) => {
  // Phase 1.5 — the model fields below are MEASURED (files on disk, the OS, the
  // inference service's own report). `ownedModelPrimary` is a routing fact about
  // which chain is selected; it is deliberately accompanied by what actually
  // generated the text, so a fine-tuned model can never be implied by a name in
  // the environment.
  const model = await getModelStatus();
  const publicStatus = {
    status: 'ok',
    // Part C/AE: with only the deterministic composer, RAG retrieval is local and
    // normal legal answers make NO external LLM call. An enabled hosted provider
    // (Cloudflare Workers AI / the HF Space / the LoRA service) changes that, so
    // this field reports the routing fact instead of a constant.
    runtimeExternalLLMCalls: modelInferenceEnabled() ? 'ENABLED_FOR_LEGAL_ANSWERS' : 'NONE',
    ownedModelPrimary: isOwnedModelPrimary ? 'YES' : 'NO',
    // The routing fact above says which chain is selected; these say what
    // actually generated the text (a deterministic composer, not trained weights).
    fineTunedModelInUse: model.fineTunedModelInUse,
    ...publicModelStatus(model),
    ragIndexLoaded: fs.existsSync(path.join(RAG_ROOT, 'indexes', 'rag_index.json')) ? 'YES' : 'NO',
    ragDocumentsCount: fs.existsSync(path.join(RAG_ROOT, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(RAG_ROOT, 'manifest.json'), 'utf8')).documents.length : 0,
    // Corrective-RAG quality-control layer (Parts 1-2): counts since boot.
    correctiveRag: {
      maxAttemptsPerQuery: MAX_CORRECTIVE_ATTEMPTS,
      strongVerdicts: metrics.evidenceStrong,
      weakRetriedQueries: metrics.evidenceWeakRetried,
      evidenceRejectedQueries: metrics.evidenceRejected,
      correctiveAttempts: metrics.correctiveRetrievals
    }
  };
  if (!isSignedInRequest(req)) {
    return res.json(publicStatus);
  }
  // The full picture carries absolute paths and a host inventory (RAM, GPU,
  // python). `isSignedInRequest` only checks that a bearer header is present, so
  // that tier is not a trust boundary — the operator has to ask for the details.
  const verboseHealth = process.env.INSAF_HEALTH_VERBOSE === '1';
  res.json({
    ...publicStatus,
    activeProvider: (process.env.AI_PROVIDER || 'insaaf').toLowerCase().trim(),
    activeModel: aiProvider.getModelName(),
    ragEmbeddingMode: 'local-embedder',
    configurationFile: 'server/aiProviders.js',
    ...(verboseHealth
      // Adapter inventory with byte sizes and parameter counts, base-weight cache
      // state, host RAM/GPU/PyTorch probes, the inference test, every unmet
      // requirement.
      ? { fineTunedModel: model }
      : {
        modelDetail: 'redacted — set INSAF_HEALTH_VERBOSE=1 to include the adapter inventory, '
          + 'base-weight state and host requirements in this response',
      }),
  });
});

// Streaming Legal Advice endpoint (SSE / Chunked Transfer)
/**
 * Express 4 never forwards a rejected async handler to the error middleware, so
 * a failing retrieval here would leave the request hanging AND surface as an
 * unhandled rejection. Wrapper keeps the promise honest: rejection -> next(err).
 */
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Civic Issues persistence is server-side and credential-gated. With no service
 * account every route below refuses — there is no local fallback that would let
 * a "saved" report exist only in this process.
 */
let _civicStore = null;
function civicStore() {
  const admin = getFirebaseAdmin();
  if (!admin) throw new Error('Admin SDK not configured');
  if (!_civicStore) _civicStore = createFirestoreStore({ admin });
  return _civicStore;
}
const lazyCivicStore = {
  create: r => civicStore().create(r),
  get: id => civicStore().get(id),
  listByOwner: uid => civicStore().listByOwner(uid),
  listQueue: q => civicStore().listQueue(q),
  applyPatch: (id, patch) => civicStore().applyPatch(id, patch)
};

// Configuration probe for whoever is setting the server up. Reports only whether
// pieces exist; it never reads, echoes or lists a credential value.
app.get('/api/civic/auth-status', (_req, res) => {
  res.json({
    serverVerificationConfigured: authBackendStatus().configured,
    credentialSource: authBackendStatus().credentialSource || 'none',
    projectIdConfigured: authBackendStatus().projectIdConfigured,
    initializationError: authBackendStatus().initError,
    roles: ['student', 'lawyer', 'administrator']
  });
});
app.use('/api/civic', createCivicRouter({
  authorizer: civicAuthorizer,
  store: lazyCivicStore,
  rateLimiters: { write: rateLimiterMiddleware }
}));

/**
 * Community posts and administrator provisioning use the same verified-token guards.
 * Both stores are lazy: with no service account configured the routes still mount,
 * every handler reaches the store, the store throws, and the caller is refused with
 * 503. There is no local fallback that would let a "pending post" or a "role change"
 * exist only inside this process.
 */
let _communityStore = null;
function communityStore() {
  const admin = getFirebaseAdmin();
  if (!admin) throw new Error('Admin SDK not configured');
  if (!_communityStore) _communityStore = createCommunityStore({ admin });
  return _communityStore;
}
const lazyCommunityStore = Object.fromEntries(
  ['create', 'get', 'listFeed', 'listByOwner', 'listQueue', 'applyPatch', 'getMember', 'putMember']
    .map(m => [m, (...a) => communityStore()[m](...a)])
);
app.use('/api/community', createCommunityRouter({
  authorizer: civicAuthorizer,
  store: lazyCommunityStore,
  rateLimiters: { write: rateLimiterMiddleware }
}));

let _adminServices = null;
function adminServices() {
  const admin = getFirebaseAdmin();
  if (!admin) throw new Error('Admin SDK not configured');
  if (!_adminServices) _adminServices = createAdminServices({ admin });
  return _adminServices;
}
const lazyAdminServices = Object.fromEntries(
  ['getAccount', 'setRole', 'setDisabled', 'addAudit', 'listAudits', 'overview', 'listSupport', 'patchSupport']
    .map(m => [m, (...a) => adminServices()[m](...a)])
);
app.use('/api/admin', createAdminRouter({
  authorizer: civicAuthorizer,
  store: lazyAdminServices,
  rateLimiters: { write: rateLimiterMiddleware }
}));

/**
 * Phase 4 §C — app-support answers and in-app reports. Asking how the product works
 * needs no account, but filing a report does: it is written to the same
 * supportRequests queue the Phase 3 admin workflow already triages, so an unconfigured
 * backend fails with 503 instead of pretending the report was kept.
 */
app.use('/api/support', createSupportRouter({
  authorizer: civicAuthorizer,
  store: lazyAdminServices,
  rateLimiters: { write: rateLimiterMiddleware }
}));

/**
 * Phase 4 §B — official-source monitoring, visible to an administrator. The registry is
 * derived from URLs this repository already declares; nothing is invented here. A sweep
 * only raises candidates, and `publish` records a decision by a verified administrator —
 * scraped text reaches the trusted corpus only through a reviewed `rag:build`.
 */
function corpusManifestRecords() {
  try {
    const file = path.join(RAG_ROOT, 'manifest.json');
    if (!fs.existsSync(file)) return [];
    const docs = JSON.parse(fs.readFileSync(file, 'utf8')).documents || [];
    return docs.map(d => ({
      docId: d.id, sourceURL: d.sourceURL || null, jurisdiction: d.jurisdiction || null,
      version: d.version || null, legalStatus: d.legalStatus || null, title: d.title || null
    }));
  } catch { return []; }
}

const UPDATE_COMMANDS = [
  ['npm', ['run', 'rag:validate']],
  ['npx', ['tsc', '--noEmit']],
  ['node', ['server/testRAG.js']],
  ['node', ['tests/unit/testCivicAuthz.cjs']],
  ['node', ['tests/unit/testCommunityAuthz.cjs']],
  ['node', ['tests/unit/testPhase4Agents.cjs']]
];

/** Spawned as argument vectors, never a shell string, and only from the list above. */
function runUpdateCommand(command, cwd = path.join(__dirname, '..')) {
  const match = UPDATE_COMMANDS.find(([exe, args]) => exe === command.split(' ')[0] && command.endsWith(args.join(' ')));
  if (!match) return Promise.resolve({ command, exitCode: null, output: '', rejected: 'command is not on the allowlist' });
  return new Promise(resolve => {
    execFile(match[0], match[1], { cwd, timeout: 240000, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ command, exitCode: err ? (typeof err.code === 'number' ? err.code : 1) : 0, output: String(stdout || '').slice(-3000) + String(stderr || '').slice(-1500) });
    });
  });
}

const updateRegistryInit = initUpdateRegistry();
app.use('/api/admin/updates', createUpdateRouter({
  authorizer: civicAuthorizer,
  audit: lazyAdminServices,
  runCommand: runUpdateCommand,
  retrieve: query => RAGEngine.retrieve(query),
  records: corpusManifestRecords
}));

// The timer is registered only when an operator opts in; the logged line is the evidence
// of which state this process is actually in.
const updateScheduler = startUpdateScheduler({
  env: process.env,
  run: () => sweepUpdateSources({ fetcher: updateFetcher, sources: loadUpdateSources(), timeoutMs: 12000 })
});
console.log(`[updates] registry=${updateRegistryInit.sources} sources (${updateRegistryInit.created ? 'derived this boot' : 'loaded from rag/updates/sources.json'}), scheduler=${updateScheduler.started ? `running every ${describeUpdateScheduler(process.env).intervalMs}ms` : `not running (${updateScheduler.reason})`}`);

app.post('/api/ai/chat', rateLimiterMiddleware, asyncRoute(async (req, res) => {
  const validationError = validateChatInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { userQuery, history: rawHistory = [], preferredLanguage, responseDetail } = req.body;
  // One thread shape for every client. `askLegalAgent` and the document editor post
  // {role:'assistant', content}, the chat posts {role:'model', text}; both are the
  // product's own, and each used to lose the other's facts.
  const history = normalizeHistory(rawHistory);
  // Part 4: answer level (beginner | intermediate | advanced). It controls only
  // HOW an answer is explained — never which records count as evidence.
  const answerLevel = normalizeAnswerLevel(req.body.answerLevel);
  // Cross-border settings (overseas mode + preferred country of residence). The
  // country is free text and is NEVER used to fabricate that country's law — it
  // only tailors jurisdiction framing. Bounded + sanitized for safety.
  const overseasMode = req.body.overseasMode === true;
  const preferredCountry = String(req.body.preferredCountry || '').replace(/[<>]/g, '').trim().slice(0, 60);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 0. Cache Invalidation Check (P47)
  checkCacheInvalidation();

  // F3: development timing diagnostics
  const requestStart = Date.now();

  // 1. Urdu-script input maps to a Roman Urdu response — Urdu Script is not a chat response language.
  const activeLang = resolveChatLanguage(preferredLanguage, userQuery);

  // Islamic Guidance mode. An explicitly selected mode is carried in the request
  // body; it switches the candidate pool to rag/indexes/islamic_index.json and is
  // answered from retrieved records only. The layer is a separate file, never
  // merged into rag_index.json, so no other mode can retrieve scripture and this
  // mode cannot answer from a NADRA/passport record. Runs before the Document
  // Intelligence and curated intercepts, which are legal-mode branches.
  const chatMode = ['islamic', 'combined'].includes(String(req.body.mode || '').toLowerCase().trim())
    ? String(req.body.mode).toLowerCase().trim() : 'legal';
  if (chatMode === 'islamic' || chatMode === 'combined') {
    const { isRoman, lawResult, lawChunks, composed } = await buildModeAnswer(userQuery, chatMode, activeLang, answerLevel);
    // Each path keeps its own domain and its own record URL: a legal excerpt must
    // not be published as an islamic-layer card, and the card order mirrors the
    // order the composer printed.
    const islamicPool = chatMode === 'combined' ? composed.islamicSources : composed.sources;
    const lawPool = chatMode === 'combined' ? composed.lawSources : lawChunks;
    const cards = toSourceMeta(islamicPool, 'islamic')
      .concat(lawPool.length ? toSourceMeta(lawPool.slice(0, 3), lawResult.domain) : []);
    // citationPayload() is declared later in this handler, so the law-section
    // audit is computed with the same helper calls it wraps.
    const lawAudit = lawChunks.length
      ? (() => {
        const a = auditCitations(composed.text, lawChunks, RAGEngine.provisionCorpus());
        return {
          citationAudit: {
            checked: a.checked,
            verified: a.verified.length,
            notInEvidence: a.notInEvidence.map(c => c.raw),
            unknownProvisions: a.unknown.map(c => c.raw)
          },
          citationWarning: citationAdvisory(a, isRoman ? 'roman_urdu' : 'en')
        };
      })()
      : {};
    res.write(`data: ${JSON.stringify({ meta: { sources: cards, isOffline: true } })}\n\n`);
    res.write(`data: ${JSON.stringify({
      chunk: composed.text,
      isOffline: true,
      answerLevel,
      mode: chatMode,
      ...(lawResult ? gatePayload(lawResult) : { evidence: { verdict: composed.verdict, domain: 'islamic', supportedCount: composed.sources.length } }),
      ...lawAudit,
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // Document Intelligence quick actions (Summarize / Explain / Analyze Risks) are
  // intercepted here exactly as in /advice: the same request must not fall through
  // to generic legal RAG just because it arrived on a different route. Runs before
  // curated answers because embedded document text carries numbers that trigger
  // false curated matches.
  const diAction = detectDocIntelligenceAction(userQuery);
  if (diAction) {
    const analysis = analyzeDocumentText(diAction.text, '', { preferredLanguage: activeLang });
    const formatted = formatDocIntelligenceResponse(diAction.action, analysis, activeLang);
    res.write(`data: ${JSON.stringify({ chunk: formatted, isOffline: true, action: 'answer' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // Safety refusals win over everything below: an unlawful ask or a person in
  // danger is answered before the system worries about what the dispute is.
  const safetyAnswer = curatedOfflineAnswer(userQuery, activeLang, { safetyOnly: true });
  if (safetyAnswer) {
    res.write(`data: ${JSON.stringify({ chunk: safetyAnswer.text, isOffline: true, action: curatedAction(safetyAnswer) })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // Everyday-situation resolution (Rule 2). Retrieval matches words, so
  // "tenant … paise … wapis" (someone owes the tenant) and "tenant … rent nahi
  // de raha" (the tenant owes money) look alike while they are opposite cases.
  // When the direction cannot be told from the words, the honest answer is the
  // ONE question that decides it — never a generic rent-law list.
  const thread = resolveThread(userQuery, history);
  const everyday = resolveEverydayIntent(userQuery, thread.priorUser, thread.priorModel);
  const everydayAsk = everydayClarification(everyday, activeLang);

  // A complaint with no subject is not a question about FIR refusal. Retrieval
  // matches the word "complaint" to that record, so the honest reply is the one
  // question that picks the forum; a follow-up turn is answered from its thread.
  const bareComplaint = thread.followUp ? null : bareComplaintClarification(userQuery, activeLang);
  if (bareComplaint) {
    res.write(`data: ${JSON.stringify({
      chunk: bareComplaint, sources: [], isOffline: true, answerLevel,
      evidence: { verdict: 'clarify', reasons: ['ambiguous_complaint'], domain: 'general', supportedCount: 0, rejected: 0 },
      relevance: 'clarify', action: 'clarify'
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // Curated answers next: directory/app pointers and small talk are answered
  // instantly from verified app knowledge — no provider call and no keyword
  // retrieval noise. A resolved everyday dispute is NOT a directory request, so
  // the pointer rules stand down when the citizen has named an actual problem.
  const curatedAnswer = curatedOfflineAnswer(userQuery, activeLang, { legalSituation: !!everyday.situation });
  if (curatedAnswer) {
    res.write(`data: ${JSON.stringify({ chunk: curatedAnswer.text, isOffline: true, action: curatedAction(curatedAnswer) })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // Retrieve RAG context with caching (P47). A follow-up turn is searched with the
  // subject the citizen already stated, and that subject is part of the cache key —
  // the fragment alone ("aur uska kya natija niklega?") means a different thing in
  // every thread, so sharing one key would serve another case's evidence.
  const ragCacheKey = cacheKeyFor('rag', thread.retrievalQuery, activeLang, lastIndexModified, everyday.situation || '');

  let retrievalResult;
  let retrieval_ms = 0;
  const retrievalStart = Date.now();
  if (ragCache.has(ragCacheKey)) {
    metrics.ragCacheHits++;
    retrievalResult = ragCache.get(ragCacheKey);
    retrieval_ms = Date.now() - retrievalStart;
  } else {
    metrics.ragCacheMisses++;
    retrievalResult = await retrieveCorrected(thread.retrievalQuery, { isOnline: false, extraQuery: everyday.retrievalQuery });
    retrieval_ms = Date.now() - retrievalStart;
    cacheRagResult(ragCacheKey, retrievalResult);
  }
  const retrievedChunks = retrievalResult.chunks;
  gateMetrics(retrievalResult);
  // The chat source footer, the "Open in Library" button and the Read-more modal
  // are all driven by this metadata. Every path that returns an answer built from
  // retrieved records must emit it, not only the generated-answer path.

  // Honest abstention, decided here and before anything below can reply. Each of
  // the branches that follows either answers from a record or asks a clarifying
  // question, and both would misrepresent an ask the verified corpus simply cannot
  // answer (another country's own rule, a bare section number, no subject at all).
  const abstentionText = abstentionFor(userQuery, activeLang, retrievalResult.evidence, retrievedChunks);
  if (abstentionText) {
    res.write(`data: ${JSON.stringify({
      chunk: offlineKnowledgeHeader(activeLang, 'refusal', '') + abstentionText,
      sources: [], isOffline: true, answerLevel, action: 'abstain',
      ...gatePayload(retrievalResult)
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // The everyday-situation question is asked only when the corpus cannot already
  // place the dispute. It used to short-circuit ahead of retrieval, which made it
  // ask "whose money is it?" about a maintenance claim and an inheritance claim —
  // questions whose subject the verified records name directly. Retrieval decides,
  // because retrieval is what knows what the corpus covers.
  if (everydayAsk && retrievalResult.evidence && retrievalResult.evidence.verdict !== 'strong') {
    res.write(`data: ${JSON.stringify({
      chunk: everydayAsk, isOffline: true, answerLevel,
      evidence: clarifyEvidence(retrievalResult, { reasons: ['ambiguous_situation'], candidates: everyday.candidates, supportedCount: 0, rejected: 0 }),
      relevance: 'clarify', action: 'clarify'
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // Refusal Check — Phase 1/2 (A/B/C): never a cold "data unavailable" reply. If
  // no verified record matched, ask the MINIMUM clarifying question that lets
  // the pipeline answer next: for an overseas/move question that is the target
  // country + purpose; otherwise a concrete issue-area/facts probe — always with
  // Library / legal-aid / lawyer routing. Only askClarification itself may say
  // that no verified record matched (the genuinely exhausted case).
  if (!retrievedChunks || retrievedChunks.length === 0) {
    const clarificationText = everydayUnverifiedNote(everyday, activeLang) || askClarification(userQuery, activeLang);
    res.write(`data: ${JSON.stringify({ chunk: clarificationText, isOffline: true, answerLevel, action: /[?؟]/.test(clarificationText) ? 'clarify' : 'abstain', ...gatePayload(retrievalResult) })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // 1. Caching Layer Check (P45 Cost Control)
  let provisionCorpus = null;
  /**
   * Check every provision an outgoing answer cites against the evidence that
   * answer was built on. Same payload on every branch, so no answer can leave
   * with a section number that was never looked at.
   */
  const citationPayload = (answerText, chunks, advisory = true) => {
    const audit = auditCitations(answerText, chunks || [],
      (provisionCorpus ||= RAGEngine.provisionCorpus()));
    return {
      citationAudit: {
        checked: audit.checked,
        verified: audit.verified.length,
        notInEvidence: audit.notInEvidence.map(c => c.raw),
        unknownProvisions: audit.unknown.map(c => c.raw)
      },
      citationWarning: advisory
        ? citationAdvisory(audit, activeLang === 'roman_urdu' ? 'roman_urdu' : 'en')
        : null
    };
  };
  // Keyed on the thread query, never the bare turn: "and the interest?" must not
  // serve the answer cached for a different subject's follow-up.
  const cacheKey = cacheKeyFor('ans', thread.retrievalQuery, activeLang, answerLevel);
  const queryIsSafeToCache = isSafeToCache(thread.retrievalQuery, retrievalResult.domain);
  if (queryIsSafeToCache && responseCache.has(cacheKey)) {
    metrics.cacheHits++;
    const cachedResponse = responseCache.get(cacheKey);
    res.write(`data: ${JSON.stringify({ meta: { sources: toSourceMeta(answerEvidenceOrder(userQuery, retrievedChunks, answerLevel).slice(0, 4), retrievalResult.domain, userQuery), isOffline: true } })}\n\n`);
    res.write(`data: ${JSON.stringify({ chunk: cachedResponse, action: 'answer', ...gatePayload(retrievalResult), ...citationPayload(cachedResponse, retrievedChunks) })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  if (queryIsSafeToCache) {
    metrics.cacheMisses++;
  }

  // 2. RAG-First Direct Verified Response Check (P45 Cost Control)
  const topChunk = retrievedChunks[0];
  const hasExactMatch = topChunk && topChunk.exactScore >= 8.0;
  if (hasExactMatch && isPureLookupQuery(userQuery, [{ key: topChunk.key, type: topChunk.type }])) {
    // Precision guard: a pure "Section N <law>" lookup must show ONLY that
    // provision — never unrelated sections that keyword retrieval also scored
    // (e.g. "Section 379 PPC" must not drag in inheritance or abetment).
    const direct = directLookupAnswer(userQuery, retrievedChunks, activeLang);
    if (direct.refusal) {
      res.write(`data: ${JSON.stringify({ chunk: direct.refusal, action: 'abstain', ...gatePayload(retrievalResult), ...citationPayload(direct.refusal, retrievedChunks, false) })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    metrics.retrievalOnlyResponses++;
    const directResponse = direct.text;
    if (queryIsSafeToCache) {
      cacheResponse(cacheKey, directResponse);
    }
    res.write(`data: ${JSON.stringify({ meta: { sources: toSourceMeta(answerEvidenceOrder(userQuery, direct.chunks, answerLevel), retrievalResult.domain, userQuery), isOffline: true } })}\n\n`);
    res.write(`data: ${JSON.stringify({ chunk: directResponse, ...gatePayload(retrievalResult), ...citationPayload(directResponse, direct.chunks) })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }


  let langInstruction = "Respond in the user's language. NEVER respond in Urdu script (اردو). Respond only in English or Roman Urdu (Latin alphabet).";
  if (activeLang === 'roman_urdu') {
    langInstruction = "RESPONSE SCRIPT MANDATE: You MUST respond strictly in ROMAN URDU (Urdu written in Latin English alphabet, e.g., 'Police ko Section 154 ke tehat FIR register karni chahiye...'). Keep section numbers and legal terms accurate. NEVER use Urdu script (اردو).";
  } else if (activeLang === 'en') {
    langInstruction = "RESPONSE SCRIPT MANDATE: You MUST respond strictly in ENGLISH.";
  }

  // Part Z: response-detail setting controls answer verbosity (concise/standard/detailed).
  let detailInstruction = "2. Keep your answer SHORT, DIRECT, and CONCISE: maximum 2–5 sentences OR 3–5 short bullet points.";
  if (responseDetail === 'concise') {
    detailInstruction = "2. Keep your answer VERY BRIEF: 1–3 sentences only. Give the direct answer with the key provision; omit background.";
  } else if (responseDetail === 'detailed') {
    detailInstruction = "2. Give a THOROUGH, well-structured answer. Use the professional guidance model below with clear headings/bullets, covering the issue, applicable law, what it means, what to do now, documents/evidence, where to go, next step, and risks/limitations — but only the parts actually relevant to the question. Do not pad with irrelevant background.";
  }

  // Part 4: answer level → depth rules for the online provider path. The local
  // composer applies the same profile, so both inference modes behave alike.
  const levelInstruction = answerLevelInstruction(answerLevel);

  // Jurisdiction-awareness rule. For cross-border / overseas-Pakistani matters
  // the system must NOT default to Pakistani law merely because the user is
  // Pakistani — it must separate the Pakistan layer from the foreign layer and
  // route country-specific, time-sensitive facts to the live official source.
  let jurisdictionInstruction = `JURISDICTION RULE: First identify which legal system governs the user's issue. If the matter involves another country (an abroad, overseas, visa, immigration, foreign-employment, study-abroad, foreign-court, foreign-marriage/divorce, cross-border property/inheritance, remittance/tax or consular question), do NOT assume Pakistani law applies. Distinguish clearly between (A) PAKISTAN law/consular process and (B) the FOREIGN country's law/procedure, and never silently mix them. Answer each layer from the retrieved evidence; where the evidence does not cover the specific foreign country's CURRENT rule (visa, immigration, fees, deadlines, university/scholarship requirements, treaty or embassy details), say so plainly, do NOT fabricate it, and direct the user to that country's official authority and/or the relevant Pakistani mission (MOFA). Never claim to know every country's law — provide only verified Pakistan-facing cross-border guidance for the covered countries/topics.`;
  if (retrievalResult.domain === 'cross-border' || overseasMode) {
    const countryNote = (overseasMode && preferredCountry) ? ` The user has set their country of residence to "${preferredCountry}" — tailor the foreign-layer routing to that country, but still confirm its current rules against the live official source and never state its law from memory.` : '';
    jurisdictionInstruction = `THIS IS A CROSS-BORDER / OVERSEAS-PAKISTANI MATTER (highest-priority framing):${countryNote}\n- Do NOT answer using only Pakistani law. State which jurisdiction governs each part of the question.\n- Layer A = Pakistan law / consular / mission process; Layer B = the foreign country's own law and official procedure. Keep them separate and label them.\n- The specific foreign country's current visa/immigration/employment/education/tax/fee/deadline/treaty/embassy rules are TIME-SENSITIVE: if not in the retrieved evidence, do NOT guess — name the official source to verify and, where relevant, the Pakistani mission pathway.\n- For a document/notice from a FOREIGN court or authority, treat it under that foreign country's procedure and recommend a qualified local lawyer there; a Pakistani mission can give consular support only.\n- Safety first: if the user is arrested, detained, trafficked or in danger abroad, give the immediate consular/emergency routing before anything else.\n- Never present a "for all countries" guarantee. Give verified Pakistan-facing cross-border guidance for covered countries/topics only.\n\n` + jurisdictionInstruction;
  }


  // Construct Grounding Context (sized by Answer Level; never below the previous cap of 4)
  const groundingCap = Math.max(4, ANSWER_LEVELS[answerLevel].chunkCap);
  const cappedChunks = answerEvidenceOrder(userQuery, retrievedChunks, answerLevel).slice(0, groundingCap);
  const mappedSources = toSourceMeta(cappedChunks, retrievalResult.domain, userQuery);

  let contextStr = "Retrieved Authoritative Evidence:\n\n";
  cappedChunks.forEach((c, index) => {
    contextStr += `[Source ${index + 1}]:\n`;
    contextStr += `Title: ${c.title}\n`;
    contextStr += `Authority: ${c.issuingAuthority}\n`;
    contextStr += `Jurisdiction: ${c.jurisdiction}\n`;
    contextStr += `Provision: ${c.type} ${c.key}\n`;
    contextStr += `URL: ${c.sourceURL}\n`;
    contextStr += `Legal Status: ${c.legalStatus}\n`;
    contextStr += `Version: ${c.version}\n`;
    contextStr += `Text: ${c.text}\n\n`;
  });

  // Optional model-backed answer path (server/modelInferenceClient.js): Cloudflare
  // Workers AI, the HF ZeroGPU Space or the private LoRA service. It is OFF by
  // default. When it is on, the model only ever sees the retrieved records above,
  // its reply must pass the answer contract and the evidence check, and anything
  // that fails falls through to the deterministic composer below.
  if (modelInferenceEnabled()) {
    const modelTopScore = (retrievedChunks && retrievedChunks[0] && retrievedChunks[0].exactScore) || 0;
    const modelIsSectionLookup = /\b(?:section|sec|article|art|dafa|دفعہ)\s*\.?\s*\d+/i.test(userQuery);
    if (modelIsSectionLookup && modelTopScore < 8.0) {
      console.warn('[Backend] Model provider skipped: section lookup below the exact-match threshold.');
    } else {
      const modelResult = await answerWithModel({
        question: userQuery,
        chunks: cappedChunks,
        language: activeLang,
        answerLevel,
        history
      });
      if (modelResult.ok) {
        const modelText = modelResult.text;
        res.write(`data: ${JSON.stringify({ meta: { sources: mappedSources, isOffline: true, provider: modelResult.provider } })}\n\n`);
        res.write(`data: ${JSON.stringify({ chunk: modelText, sources: mappedSources, isOffline: true, answerLevel, action: 'answer', ...citationPayload(modelText, cappedChunks), ...gatePayload(retrievalResult) })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      console.warn(`[Backend] Model provider not used: ${modelResult.reason}`);
    }
  }

  const legalInstruction = `System Rule for AI: You are an elite, highly experienced Pakistani Legal Expert and Constitutional Advisor.
You must answer the user's query ONLY using the provided retrieved evidence.
DO NOT use any external or generic model memory to state legal facts.
OUT-OF-SCOPE POLICY (Part X): NEVER reply with a bare "I don't have this data", "knowledge unavailable" or similar. Instead classify the request and respond helpfully:
- If it is a legal question but the supplied evidence does not contain the answer, say honestly that you could not find a verified Pakistani legal source for that exact point, that you will not guess legal facts, and give the user a concrete next step (rephrase with the law/section and city, ask about the procedure, or use the Library / lawyer directory). NEVER fabricate a section, case, citation or fee.
- If it is a non-legal but harmless general life/community question (for example a high electricity bill), give safe, practical general steps and name the right authority or complaint channel, without inventing legal facts, phone numbers or URLs.
- If it needs real-time/current data (market price, weather, score), explain that a live source is required and do not fabricate a value.
- If it requests dangerous or illegal assistance, refuse clearly and briefly.

${langInstruction}

${jurisdictionInstruction}

CRITICAL INSTRUCTIONS — ANSWER-FIRST RESPONSE STRUCTURE:
1. DIRECT ANSWER FIRST (most important rule): Your VERY FIRST sentence must directly answer the user's question in plain language. NEVER begin with a statute name, section number, document title, source metadata, or "According to...". The user asked a question — answer it immediately, then explain.
   - GOOD: "Yes, you can file a complaint with the Human Rights Commission. Here is how..."
   - BAD: "Section 12 of the Protection of Women Act states that..."
   - BAD: "Under the Pakistani legal framework, the relevant provision is..."
2. AFTER the direct answer, structure the rest of your response as follows (include only what is relevant — skip sections that do not apply):
   a) **What this means** — explain the answer in simple, everyday language (1-2 sentences)
   b) **What to do** — concrete, actionable steps the user can take right now
   c) **Next steps** — what happens after they take action, timelines, what to expect
   d) **Evidence/Documents needed** — what papers or proof they should gather
   e) **Authority/Forum** — which office, court, or authority handles this
   f) **Legal basis** — cite the specific law/section/article that grounds the answer (AFTER the plain-language answer, not before)
   g) **Sources** — name the source documents (the system handles formatting)
3. Keep your answer SHORT, DIRECT, and CONCISE: maximum 2–5 sentences for the direct answer, then brief bullets for the structured sections.
${detailInstruction}
${levelInstruction}
4. The answer MUST BE COMPLETE. DO NOT truncate or cut off mid-sentence.
5. Answer ONLY what the user explicitly asked — do not volunteer unrelated laws or background.
6. DO NOT write a Sources block at the end. The system will handle citations automatically.
7. DO NOT use raw HTML tags. Use clean text or markdown.
8. NEVER introduce yourself (e.g. 'Greetings! I am Insaaf AI'). Start your legal response immediately with the direct answer.
9. CASE LAW CITATIONS (F15): When the answer is grounded in a judgment, cite it compactly IN-LINE as "Case: {Title} ({Citation}, {Court} {Year})". State ONLY the holding, outcome and significance that appear in the retrieved evidence. NEVER invent case names, citations, facts, or reasoning.
10. CASE COMPARISONS (F15): NEVER state that two cases are "exactly the same" or "identical". Use hedged language such as "may be similar to" or "can be distinguished from". Precedent guides — it does not decide.
11. STUDENT / UNIVERSITY QUERIES: When the query relates to university or college matters (admissions, fees, examinations, harassment, discipline, hostel, scholarships, degree attestation, student rights, transport, academic probation, show-cause notices), use the retrieved student-domain evidence. Where a rule or policy is university-specific, state clearly that it "depends on your university's applicable regulations" and do NOT present one university's rule as a universal Pakistan-wide standard. When the user is in Hyderabad or mentions a Hyderabad university (University of Sindh, MUET, Liaquat University), prioritize Hyderabad-relevant information from the evidence. Respond in the user's language — English or Roman Urdu.

${contextStr}`;

  // Track provider call
  metrics.requestCount++;
  metrics.aiGeneratedResponses++;
  metrics.estimatedTokens += estimateTokens(legalInstruction) + estimateTokens(userQuery);

  let accumulatedResponse = '';
  const fallbackChain = AIProviderFactory.getFallbackChain();

  // Write initial metadata payload (sources and online/offline status)
  const isOnline = fallbackChain.length > 0;
  res.write(`data: ${JSON.stringify({ meta: { sources: mappedSources, isOffline: !isOnline } })}\n\n`);

  let providerSuccess = false;
  let lastError = null;

  // F3: provider_ms measures the full fallback-chain generation time
  const providerStart = Date.now();
  for (const provider of fallbackChain) {
    try {
      console.log(`[Backend] Attempting provider: ${provider.getProviderName()}`);
      await new Promise((resolve, reject) => {
        provider.generateStream(
          userQuery,
          history,
          legalInstruction,
          (chunk) => {
            if (!providerSuccess) providerSuccess = true;
            accumulatedResponse += chunk;
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          },
          () => resolve(),
          (err) => reject(err)
        ).catch(reject);
      });
      if (providerSuccess) break; // Break out of loop on success
    } catch (err) {
      console.error(`[Backend] Provider ${provider.getProviderName()} error:`, err.message);
      lastError = err;
    }
  }
  const provider_ms = Date.now() - providerStart;

  if (providerSuccess) {
    metrics.estimatedTokens += estimateTokens(accumulatedResponse);
    if (queryIsSafeToCache && accumulatedResponse) {
      cacheResponse(cacheKey, accumulatedResponse);
    }
    const timings = { retrieval_ms, provider_ms, total_ms: Date.now() - requestStart };
    logTimings('/api/ai/chat', timings);
    const debugPayload = debugTimingsPayload(timings);
    if (debugPayload) {
      res.write(`data: ${JSON.stringify(debugPayload)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    // Offline VERIFIED KNOWLEDGE fallback — build a structured answer from retrieved passages
    const curated = curatedOfflineAnswer(userQuery, activeLang, { legalSituation: !!everyday.situation });
    // A curated paragraph is generic and cites nothing. When the evidence gate
    // rates the retrieved corpus records as directly on point, the grounded
    // composer below must answer instead — otherwise an official provincial or
    // institutional record is hidden behind boilerplate. A resolved everyday
    // dispute is answered the same way: naming a lawyer directory is not an
    // answer to "my landlord is keeping my deposit".
    const gateVerdict = (retrievalResult.evidence || {}).verdict;
    if (curated && gateVerdict !== 'strong' && !everyday.situation) {
      const curatedAbstains = curatedAction(curated) === 'abstain';
      res.write(`data: ${JSON.stringify({ chunk: curated.text, sources: curatedAbstains ? [] : mappedSources, isOffline: true, action: curatedAction(curated), ...gatePayload(retrievalResult) })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Any abstention (unverified provision, no legal subject, another country's
    // own rule) already returned above, so reaching here means the corpus does
    // have something to say — and the only remaining refusal is a true empty
    // retrieval, which gets the information-limitation reply below.
    const isRefusalOnly = !(retrievedChunks && retrievedChunks.length > 0);
    let offlineText = offlineKnowledgeHeader(activeLang, isRefusalOnly ? 'refusal' : (retrievalResult.evidence || {}).verdict,
      isRefusalOnly ? '' : jurisdictionNoteFor(userQuery, retrievedChunks, activeLang));
    if (retrievedChunks && retrievedChunks.length > 0) {
      // Part AD / Phase 3 — Insaaf AI owned-model inference. Whenever the RAG layer
      // returned records we ANSWER FROM THEM (never a cold "not available"). We
      // compose the structured professional guidance answer (Issue -> Law that
      // may apply -> What the law says -> Procedure -> Remedy -> Precedent ->
      // Forum -> Source -> Limitation) strictly from the retrieved corpus. The
      // A/B/C distinction is driven by the retrieval relevance tier: a HIGH tier
      // (strong exact/provision match) answers directly; a LOW tier (weak/partial
      // context) still answers from the grounded records but adds the minimum
      // clarification prompt so the user can sharpen the question. Only the true
      // empty case (below, C) produces the information-limitation reply.
      const ev = retrievalResult.evidence || null;
      const composed = composeOwnedModelAnswer(userQuery, retrievedChunks, activeLang, retrievalResult.domain, answerLevel, ev ? {
        verdict: ev.verdict,
        supportedCount: ev.supportedCount,
        rejected: ev.rejected,
        corrections: (retrievalResult.correction && retrievalResult.correction.attempts) || 0
      } : null);
      if (composed) {
        offlineText += composed;
        // Phase 2: answered from generic cross-border context — ask the MINIMUM
        // country/purpose follow-up so the guidance can be sharpened (official
        // country-specific details are never guessed).
        if (retrievalResult.domain === 'cross-border') {
          const cbNudge = crossBorderNudge(userQuery, activeLang);
          if (cbNudge) offlineText += cbNudge;
        }
      } else {
        const topChunk = retrievedChunks[0];

        // Clean up internal keys (e.g., REMEDY_CYBER_BLACKMAIL -> avoid showing)
        const isInternalKey = topChunk.key && (topChunk.key.includes('_') || topChunk.key.length > 10);
        const displayKey = isInternalKey ? '' : `${topChunk.type === 'ARTICLE' ? 'Article' : 'Section'} ${topChunk.key}`;

        const titleLine = displayKey ? `### ${displayKey} — ${topChunk.title}` : `### ${topChunk.title}`;
        if (activeLang === 'roman_urdu') {
          const provLabel = [displayKey, topChunk.title].filter(Boolean).join(' — ');
          offlineText += `Aap ke sawal ka jawab ${provLabel || 'mutaliqa qanooni hawale'} mein milta hai. Verified qanooni matn neechay darj hai:\n\n`;
        }
        offlineText += `${titleLine}\n\n`;

        let completeText = topChunk.text;
        const paragraphs = completeText.split(/\n\n+/);
        if (paragraphs.length > 3) {
           completeText = paragraphs.slice(0, 3).join('\n\n');
        }
        if (completeText.length > 1200) {
          const truncated = completeText.slice(0, 1200);
          const lastBreak = truncated.lastIndexOf('\n\n');
          completeText = lastBreak > 600 ? truncated.slice(0, lastBreak) : truncated;
        }
        offlineText += `${completeText}`;
      }
    } else {
      offlineText += activeLang === 'roman_urdu'
        ? "Is sawal ke liye verified qanooni source nahi mila. Main qanooni baat andaaze se nahi bataunga. Baraye meharbani mutalqa dafa/qanoon aur shehar ke saath dobara poochein, ya procedure ke baare mein poochein."
        : "A verified legal source was not found for this question, and I will not guess legal facts. Please rephrase with the relevant section/law and your city, or ask me about the procedure.";
    }

    const timings = { retrieval_ms, provider_ms, total_ms: Date.now() - requestStart };
    logTimings('/api/ai/chat', { ...timings, cached: 'offline-fallback' });
    // Citation audit of what we just wrote: which provisions this answer cites are
    // backed by the evidence shown, which exist in the verified corpus but were not
    // retrieved, and which cannot be found at all. Reported, never rewritten into
    // the answer, so a citation the corpus cannot back is surfaced instead of hidden.
    res.write(`data: ${JSON.stringify({
      chunk: offlineText, sources: isRefusalOnly ? [] : mappedSources, isOffline: true, answerLevel,
      action: isRefusalOnly ? 'abstain' : 'answer',
      ...citationPayload(offlineText, retrievedChunks, !isRefusalOnly),
      ...gatePayload(retrievalResult)
    })}\n\n`);
    const debugPayload = debugTimingsPayload(timings);
    if (debugPayload) {
      res.write(`data: ${JSON.stringify(debugPayload)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }
}));

// Non-streaming Legal Advice endpoint
/**
 * The one selected-mode answer path, shared by /api/ai/chat (streaming) and
 * /api/ai/advice (JSON) so neither route re-implements the composers.
 * `mode` is 'islamic' or 'combined'. The legal gate runs for every combined
 * request and for an islamic request only when the question itself asks about
 * enacted law; the gate is called untouched, so the Islamic layer can never
 * widen what the legal section is allowed to cite.
 */
async function buildModeAnswer(userQuery, mode, activeLang, answerLevel = null) {
  const isRoman = activeLang === 'roman_urdu';
  const isl = retrieveIslamic(userQuery, { limit: 5 });
  let lawResult = null;
  if (mode === 'combined' || asksAboutLaw(userQuery)) {
    lawResult = await retrieveCorrected(userQuery, { isOnline: false });
  }
  const lawChunks = lawResult && lawResult.evidence && lawResult.evidence.verdict !== 'none'
    ? (lawResult.chunks || []) : [];
  const composed = mode === 'combined'
    ? composeCombinedAnswer({
      userQuery,
      isRoman,
      islamicChunks: isl.chunks,
      disputed: isl.disputed,
      lawChunks,
      lawUsed: !!lawResult,
      lawVerdict: lawResult && lawResult.evidence ? lawResult.evidence.verdict : null,
      lawDomain: lawResult ? lawResult.domain : null,
      islamicTopicHit: isl.topicHit,
      answerLevel,
    })
    : composeIslamicAnswer({
      userQuery,
      isRoman,
      islamicChunks: isl.chunks,
      disputed: isl.disputed,
      lawChunks,
      lawUsed: !!lawResult,
    });
  return { isRoman, isl, lawResult, lawChunks, composed };
}

app.post('/api/ai/advice', rateLimiterMiddleware, async (req, res) => {
  const validationError = validateChatInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { userQuery, history: rawHistory = [], preferredLanguage } = req.body;
  const history = normalizeHistory(rawHistory);
  // Part 4: answer level — depth only, identical evidence rules at every level.
  const answerLevel = normalizeAnswerLevel(req.body.answerLevel);
  const overseasMode = req.body.overseasMode === true;
  const preferredCountry = String(req.body.preferredCountry || '').replace(/[<>]/g, '').trim().slice(0, 60);
  // The evidence gate runs once per query. With the owned model primary the
  // provider chain is empty, so the catch below is the NORMAL path — reusing the
  // already-gated retrieval keeps the bounded correction loop at its 1–2 attempts.
  let gatedRetrieval = null;
  // Resolved before the try: with the owned model primary the catch below is the
  // NORMAL response path, and it must route a named citizen dispute the same way
  // the try block does.
  const adviceLang = resolveChatLanguage(preferredLanguage, userQuery);
  const thread = resolveThread(userQuery, history);
  const everyday = resolveEverydayIntent(userQuery, thread.priorUser, thread.priorModel);
  try {
    // 0. Cache Invalidation Check (P47)
    checkCacheInvalidation();

    // F3: development timing diagnostics
    const requestStart = Date.now();

    const activeLang = adviceLang;

    // Selected evidence paths, identical to the streaming route: an Islamic or
    // combined request on this endpoint is answered from the same composers, not
    // from the legal path alone. Runs before the Document Intelligence and
    // curated intercepts, which are legal-mode branches.
    const adviceMode = ['islamic', 'combined'].includes(String(req.body.mode || '').toLowerCase().trim())
      ? String(req.body.mode).toLowerCase().trim() : 'legal';
    if (adviceMode !== 'legal') {
      const { isRoman, lawResult, lawChunks, composed } = await buildModeAnswer(userQuery, adviceMode, activeLang, answerLevel);
      const islamicPool = adviceMode === 'combined' ? composed.islamicSources : composed.sources;
      const lawPool = adviceMode === 'combined' ? composed.lawSources : lawChunks;
      const cards = toSourceMeta(islamicPool, 'islamic')
        .concat(lawPool.length ? toSourceMeta(lawPool.slice(0, 3), lawResult.domain) : []);
      const lawAudit = lawChunks.length
        ? (() => {
          const a = auditCitations(composed.text, lawChunks, RAGEngine.provisionCorpus());
          return {
            citationAudit: {
              checked: a.checked,
              verified: a.verified.length,
              notInEvidence: a.notInEvidence.map(c => c.raw),
              unknownProvisions: a.unknown.map(c => c.raw)
            },
            citationWarning: citationAdvisory(a, isRoman ? 'roman_urdu' : 'en')
          };
        })()
        : {};
      return res.json({
        text: composed.text,
        isOffline: true,
        mode: adviceMode,
        answerLevel,
        sources: cards,
        ...(lawResult ? gatePayload(lawResult) : { evidence: { verdict: composed.verdict, domain: 'islamic', supportedCount: composed.sources.length } }),
        ...lawAudit,
      });
    }

    // Document Intelligence quick actions (Summarize / Explain / Analyze Risks):
    // MUST run before curated answers — the embedded document text can contain
    // numbers/patterns that trigger false curated-answer matches (e.g. calculator).
    const diAction = detectDocIntelligenceAction(userQuery);
    if (diAction) {
      const analysis = analyzeDocumentText(diAction.text, '', { preferredLanguage: activeLang });
      const formatted = formatDocIntelligenceResponse(diAction.action, analysis, activeLang);
      return res.json({ text: formatted, isOffline: true });
    }

    // Same order as /api/ai/chat: a safety refusal is never delayed behind a
    // clarifying question, and a clarifying question is never answered by a
    // directory pointer.
    const safetyAnswer = curatedOfflineAnswer(userQuery, activeLang, { safetyOnly: true });
    if (safetyAnswer) {
      return res.json({ text: safetyAnswer.text, isOffline: true });
    }

    const everydayAsk = everydayClarification(everyday, activeLang);

    // Same guard as /api/ai/chat: a subjectless complaint gets the one question
    // that picks its forum instead of the FIR-refusal remedy record.
    const bareComplaint = thread.followUp ? null : bareComplaintClarification(userQuery, activeLang);
    if (bareComplaint) {
      return res.json({
        text: bareComplaint, sources: [], isOffline: true, answerLevel, action: 'clarify', relevance: 'clarify',
        evidence: { verdict: 'clarify', reasons: ['ambiguous_complaint'], domain: 'general', supportedCount: 0, rejected: 0 }
      });
    }

    // Curated answers next: directory/app pointers and small
    // talk are answered instantly from verified app knowledge.
    const curatedAnswer = curatedOfflineAnswer(userQuery, activeLang, { legalSituation: !!everyday.situation });
    if (curatedAnswer) {
      return res.json({ text: curatedAnswer.text, isOffline: true });
    }

    // Part T — "Explain This Document": the Drafter sends a fixed 11-point
    // template `Explain the Pakistani legal document type: "<name>".`. Route it
    // to the grounded local explainer (verified statutes/forums; fees & deadlines
    // stated honestly, never invented) instead of a RAG keyword-match dump.
    let explainDocName = null;
    const explainQuoted = /explain the (?:pakistani )?legal document type:\s*"(.+?)"\s*\./i.exec(userQuery || '');
    if (explainQuoted) explainDocName = explainQuoted[1];
    else {
      const explainBare = /explain the (?:pakistani )?legal document type:\s*(.+?)\s*\.\s*\n/i.exec(userQuery || '');
      if (explainBare) explainDocName = explainBare[1];
    }
    if (explainDocName) {
      return res.json({ text: explainDocumentType(explainDocName, activeLang), isOffline: true });
    }

    // Retrieve RAG context with caching (P47). The thread query carries the
    // subject a follow-up turn only points at, so caching and retrieval agree
    // with what the user is actually still asking about.
    const ragCacheKey = cacheKeyFor('rag', thread.retrievalQuery, activeLang, lastIndexModified, everyday.situation || '');
    
    let retrievalResult;
    let retrieval_ms = 0;
    const retrievalStart = Date.now();
    if (ragCache.has(ragCacheKey)) {
      metrics.ragCacheHits++;
      retrievalResult = ragCache.get(ragCacheKey);
      retrieval_ms = Date.now() - retrievalStart;
    } else {
      metrics.ragCacheMisses++;
      retrievalResult = await retrieveCorrected(thread.retrievalQuery, { isOnline: false, extraQuery: everyday.retrievalQuery });
      retrieval_ms = Date.now() - retrievalStart;
      cacheRagResult(ragCacheKey, retrievalResult);
    }
    const retrievedChunks = retrievalResult.chunks;
    gatedRetrieval = retrievalResult;
    gateMetrics(retrievalResult);

    // Same decision order as /api/ai/chat: an ask the verified corpus cannot
    // answer abstains here, ahead of every branch that would otherwise ask a
    // clarifying question or answer from the nearest record.
    const abstentionText = abstentionFor(userQuery, activeLang, retrievalResult.evidence, retrievedChunks);
    if (abstentionText) {
      return res.json({
        text: offlineKnowledgeHeader(activeLang, 'refusal', '') + abstentionText,
        sources: [], isOffline: true, answerLevel, action: 'abstain',
        ...gatePayload(retrievalResult)
      });
    }

    // Same rule as /api/ai/chat: the everyday-situation question is asked only
    // when retrieval cannot place the dispute in the corpus. One pipeline, one
    // decision order, whichever route the caller used.
    if (everydayAsk && retrievalResult.evidence && retrievalResult.evidence.verdict !== 'strong') {
      return res.json({
        text: everydayAsk, isOffline: true, answerLevel, relevance: 'clarify', action: 'clarify',
        evidence: clarifyEvidence(retrievalResult, { reasons: ['ambiguous_situation'], candidates: everyday.candidates, supportedCount: 0, rejected: 0 })
      });
    }

    // Refusal Check — Phase 1/2 (A/B/C): zero verified matches never produce a
    // cold "outside scope" reply; the minimum clarifying question is returned
    // instead (country + purpose for overseas/move questions; issue-area probe
    // otherwise) with Library / legal-aid / lawyer routing as next steps.
    if (!retrievedChunks || retrievedChunks.length === 0) {
      const clarificationText = everydayUnverifiedNote(everyday, activeLang) || askClarification(userQuery, activeLang);
      return res.json({ text: clarificationText, sources: [], isOffline: true, answerLevel, action: /[?؟]/.test(clarificationText) ? 'clarify' : 'abstain', ...gatePayload(retrievalResult) });
    }

    // 1. Caching Layer Check (P45 Cost Control)
    const cacheKey = cacheKeyFor('ans', userQuery, activeLang, answerLevel);
    const queryIsSafeToCache = isSafeToCache(userQuery, retrievalResult.domain);
    if (queryIsSafeToCache && responseCache.has(cacheKey)) {
      metrics.cacheHits++;
      return res.json({ text: responseCache.get(cacheKey), sources: toSourceMeta(retrievedChunks.slice(0, 4), retrievalResult.domain), action: 'answer', ...gatePayload(retrievalResult) });
    }
    if (queryIsSafeToCache) {
      metrics.cacheMisses++;
    }

    // 2. RAG-First Direct Response Check (P45 Cost Control)
    const topChunk = retrievedChunks[0];
    const hasExactMatch = topChunk && topChunk.exactScore >= 8.0;
    if (hasExactMatch && isPureLookupQuery(userQuery, [{ key: topChunk.key, type: topChunk.type }])) {
      const direct = directLookupAnswer(userQuery, retrievedChunks, activeLang);
      if (direct.refusal) return res.json({ text: direct.refusal, sources: [], action: 'abstain', ...gatePayload(retrievalResult) });
      metrics.retrievalOnlyResponses++;
      const directResponse = direct.text;
      if (queryIsSafeToCache) {
        cacheResponse(cacheKey, directResponse);
      }
      return res.json({ text: directResponse, sources: toSourceMeta(direct.chunks, retrievalResult.domain), action: 'answer', ...gatePayload(retrievalResult) });
    }

    let langInstruction = "Respond in the user's language. NEVER respond in Urdu script (اردو). Respond only in English or Roman Urdu (Latin alphabet).";
    if (activeLang === 'roman_urdu') {
      langInstruction = "RESPONSE SCRIPT MANDATE: You MUST respond strictly in ROMAN URDU (Urdu written in Latin English letters). Keep legal terms accurate. NEVER use Urdu script (اردو).";
    } else if (activeLang === 'en') {
      langInstruction = "RESPONSE SCRIPT MANDATE: You MUST respond strictly in ENGLISH.";
    }

    // Construct Grounding Context (Part 4: depth follows the Answer Level; the
    // evidence pool itself is level-independent and never grows past the gate).
    const cappedChunks = retrievedChunks.slice(0, Math.max(4, ANSWER_LEVELS[answerLevel].chunkCap));

    // Same optional model-backed path as /api/ai/chat, on the same shared client and
    // the same contract. A failure here is logged and the route continues to the
    // deterministic providers below — never a half-model answer.
    if (modelInferenceEnabled()) {
      const modelResult = await answerWithModel({
        question: userQuery,
        chunks: cappedChunks,
        language: activeLang,
        answerLevel,
        history
      });
      if (modelResult.ok) {
        if (queryIsSafeToCache) cacheResponse(cacheKey, modelResult.text);
        const timings = { retrieval_ms, provider_ms: Date.now() - requestStart, total_ms: Date.now() - requestStart };
        logTimings('/api/ai/advice', timings);
        return res.json({
          text: modelResult.text,
          sources: toSourceMeta(cappedChunks, retrievalResult.domain),
          isOffline: true,
          answerLevel,
          action: 'answer',
          provider: modelResult.provider,
          ...citationPayload(modelResult.text, cappedChunks),
          ...gatePayload(retrievalResult),
          ...debugTimingsPayload(timings)
        });
      }
      console.warn(`[Backend] Model provider not used in advice: ${modelResult.reason}`);
    }

    let contextStr = "Retrieved Authoritative Evidence:\n\n";
    cappedChunks.forEach((c, index) => {
      contextStr += `[Source ${index + 1}]:\nTitle: ${c.title}\nAuthority: ${c.issuingAuthority}\nProvision: ${c.type} ${c.key}\nText: ${c.text}\n\n`;
    });

    const sysPrompt = `System Rule for AI: You are an elite, highly experienced legal expert (Pakistan + cross-border).
${langInstruction}
${answerLevelInstruction(answerLevel)}
Answer ONLY using the provided retrieved evidence. Cite your sources with [1], [2], etc.
If the evidence is insufficient, say "Verified legal source material was not found for this question."
JURISDICTION RULE: ${retrievalResult.domain === 'cross-border' || overseasMode ? 'This is a CROSS-BORDER / overseas-Pakistani matter. Do NOT answer using only Pakistani law. Separate Layer A (Pakistan law/consular) from Layer B (the foreign country own law/procedure) and say which applies. Foreign-country current visa/immigration/fee/deadline/treaty/embassy rules are time-sensitive: if not in the evidence, do NOT fabricate them - name the official source to verify and the Pakistani mission pathway. Never claim to cover all countries.' : 'If the matter actually involves another country, do NOT assume Pakistani law applies; distinguish Pakistan law from foreign law and route country-specific, time-sensitive facts to the official source.'}

CRITICAL INSTRUCTIONS — ANSWER-FIRST:
1. DIRECT ANSWER FIRST (most important rule): Your VERY FIRST sentence must directly answer the user's question in plain language. NEVER begin with a statute name, section number, document title, or "According to...". Answer immediately, then explain.
2. AFTER the direct answer, structure the rest as appropriate: what it means, what to do, next steps, evidence needed, authority/forum, legal basis, sources.
3. Keep your answer SHORT, DIRECT, and CONCISE.
4. The answer MUST BE COMPLETE. DO NOT truncate or cut off mid-sentence.
5. NEVER provide long legal background or unrelated laws.
6. CASE LAW (F15): cite judgments compactly in-line ("Case: {Title} ({Citation}, {Court} {Year})"); state only holdings present in the evidence; NEVER invent citations; NEVER call two cases "exactly the same" — use "may be similar to".

${contextStr}`;

    // Track provider call
    metrics.requestCount++;
    metrics.aiGeneratedResponses++;
    metrics.estimatedTokens += estimateTokens(sysPrompt) + estimateTokens(userQuery);

    const fallbackChain = AIProviderFactory.getFallbackChain();
    let text = '';
    let providerSuccess = false;
    let lastError = null;

    // F3: provider_ms measures the full fallback-chain generation time
    const providerStart = Date.now();
    for (const provider of fallbackChain) {
      try {
        text = await provider.generateContent(userQuery, sysPrompt);
        providerSuccess = true;
        break;
      } catch (err) {
        console.error(`[Backend] Provider ${provider.getProviderName()} error in advice:`, err.message);
        lastError = err;
      }
    }
    const provider_ms = Date.now() - providerStart;

    if (providerSuccess) {
      metrics.estimatedTokens += estimateTokens(text);
      if (queryIsSafeToCache && text) {
        cacheResponse(cacheKey, text);
      }
      const timings = { retrieval_ms, provider_ms, total_ms: Date.now() - requestStart };
      logTimings('/api/ai/advice', timings);
      const payload = { text, action: 'answer', ...gatePayload(retrievalResult) };
      const debugPayload = debugTimingsPayload(timings);
      if (debugPayload) {
        Object.assign(payload, debugPayload);
      }
      res.json(payload);
    } else {
      throw lastError || new Error("All providers failed.");
    }
  } catch (err) {
    // Part C/AE: with the owned model primary the online chain is empty, so
    // reaching this catch is the EXPECTED local-inference path — log as info,
    // not an error (avoids false production alerts). A real provider failure is
    // still logged as an error when an external provider is primary.
    if (isOwnedModelPrimary) {
      console.info('[Backend] Non-streaming advice: Insaaf AI owned-model local inference (no external provider).');
    } else {
      console.error(`[Backend] Non-streaming advice error:`, err.message);
    }
    const retrievalResult = gatedRetrieval || await retrieveCorrected(thread.retrievalQuery, { isOnline: false, extraQuery: everyday.retrievalQuery });
    const retrievedChunks = retrievalResult.chunks;
    if (!gatedRetrieval) gateMetrics(retrievalResult);

    // Recompute the response language — activeLang is scoped to the try block.
    // Same resolver as /chat and /agent, otherwise this route answers Urdu-script
    // input in English while the other two answer it in Roman Urdu.
    const fallbackLang = resolveChatLanguage(preferredLanguage, userQuery);

    const mappedSources = toSourceMeta(retrievedChunks, retrievalResult.domain);

    const curated = curatedOfflineAnswer(userQuery, fallbackLang, { legalSituation: !!everyday.situation });
    if (curated && !everyday.situation) {
      const curatedAbstains = curatedAction(curated) === 'abstain';
      return res.json({
        text: curated.text, sources: curatedAbstains ? [] : mappedSources, isOffline: true,
        action: curatedAction(curated), ...gatePayload(retrievalResult)
      });
    }

    // Any abstention already returned above, so the only refusal left to compose
    // here is a true empty retrieval — and a refusal is not a verified answer:
    // with no record to stand behind the text, the header must say
    // "no verified match", not "partially verified".
    const isRefusalOnly = !(retrievedChunks && retrievedChunks.length > 0);
    let offlineText = offlineKnowledgeHeader(fallbackLang, isRefusalOnly ? 'refusal' : (retrievalResult.evidence || {}).verdict,
      isRefusalOnly ? '' : jurisdictionNoteFor(userQuery, retrievedChunks, fallbackLang));
    if (retrievedChunks && retrievedChunks.length > 0) {
      // Part AD — Insaaf AI owned-model inference (non-streaming advice endpoint).
      // Same rule as chat: whenever records were retrieved, answer FROM them at
      // the requested Answer Level (the raw-chunk dump below stays as fallback).
      const ev = retrievalResult.evidence || null;
      const composed = composeOwnedModelAnswer(userQuery, retrievedChunks, fallbackLang, retrievalResult.domain, answerLevel, ev ? {
        verdict: ev.verdict,
        supportedCount: ev.supportedCount,
        rejected: ev.rejected,
        corrections: (retrievalResult.correction && retrievalResult.correction.attempts) || 0
      } : null);
      if (composed) {
        offlineText += composed;
        // Phase 2: answered from generic cross-border context — ask the minimum
        // country/purpose follow-up so the guidance can be sharpened.
        if (retrievalResult.domain === 'cross-border') {
          const cbNudge = crossBorderNudge(userQuery, fallbackLang);
          if (cbNudge) offlineText += cbNudge;
        }
      } else {
        const topChunk = retrievedChunks[0];

        const isInternalKey = topChunk.key && (topChunk.key.includes('_') || topChunk.key.length > 10);
        const displayKey = isInternalKey ? '' : `${topChunk.type === 'ARTICLE' ? 'Article' : 'Section'} ${topChunk.key}`;

        const titleLine = displayKey ? `### ${displayKey} — ${topChunk.title}` : `### ${topChunk.title}`;
        if (fallbackLang === 'roman_urdu') {
          const provLabel = [displayKey, topChunk.title].filter(Boolean).join(' — ');
          offlineText += `Aap ke sawal ka jawab ${provLabel || 'mutaliqa qanooni hawale'} mein milta hai. Verified qanooni matn neechay darj hai:\n\n`;
        }
        offlineText += `${titleLine}\n\n`;

        let completeText = topChunk.text;
        const paragraphs = completeText.split(/\n\n+/);
        if (paragraphs.length > 3) {
           completeText = paragraphs.slice(0, 3).join('\n\n');
        }
        if (completeText.length > 1200) {
          const truncated = completeText.slice(0, 1200);
          const lastBreak = truncated.lastIndexOf('\n\n');
          completeText = lastBreak > 600 ? truncated.slice(0, lastBreak) : truncated;
        }
        offlineText += `${completeText}`;
      }
    } else {
      offlineText += everydayUnverifiedNote(everyday, fallbackLang) || askClarification(userQuery, fallbackLang);
    }
    res.json({
      text: offlineText, sources: isRefusalOnly ? [] : mappedSources, isOffline: true, answerLevel,
      action: isRefusalOnly ? (/[?؟]/.test(offlineText) ? 'clarify' : 'abstain') : 'answer',
      ...gatePayload(retrievalResult)
    });
  }
});

// Document Generation Endpoint
app.post('/api/ai/generate', rateLimiterMiddleware, asyncRoute(async (req, res) => {
  const { type, details, categoryId, preferredLanguage, structure, requestText } = req.body || {};

  // Drafting inputs are user text; an unbounded one is fed straight into the
  // composer and the retrieval slice, so it gets an explicit ceiling.
  const requestTextLength = String(requestText || '').length;
  const detailsLength = details ? JSON.stringify(details).length : 0;
  if (requestTextLength > 20000 || detailsLength > 60000) {
    return res.status(400).json({
      error: 'Document request is too large. Keep the description under 20,000 characters and the case details under 60,000.'
    });
  }

  // Phase 5/6 — FREE-TEXT drafting: the user describes the document they want in
  // their own words ("Draft a legal notice for recovery of unpaid money. I gave a
  // loan of Rs 20 lakh to Ahmed in Lahore in 2023…"). Detect the document type,
  // interpret the facts into professional numbered paragraphs and compose the
  // COMPLETE document offline — never a form, never a generic template. Phase 8:
  // missing mandatory items are returned (missingInformation) as clearly-marked
  // placeholders/questions while the document still completes.
  if (String(requestText || '').trim().length > 0 && !type) {
    let draftChunks = [];
    try {
      // §7: one evidence path for every mode. A draft that quotes law is held to
      // the same gate as a chat answer, and records the gate rejects are not
      // passed on to be printed in a document a person will file.
      const gated = await retrieveCorrected(String(requestText).slice(0, 400), { isOnline: ragSemanticOnline });
      if (gated && gated.evidence && gated.evidence.verdict !== 'none') draftChunks = gated.chunks || [];
    } catch (ragErr) {
      console.warn('[Backend] RAG failed for free-text document request:', ragErr.message);
    }
    const composed = composeDraftFromRequest(requestText, {
      language: preferredLanguage === 'ur' ? 'ur' : 'en',
      // P0: the document BODY uses the explicit document language; the missing-info
      // asks are answer prose and follow the language the request was written in.
      metaLanguage: resolveChatLanguage(preferredLanguage, requestText),
      chunks: draftChunks
    });
    return res.json(composed);
  }

  // Part A: Document output language is English + Urdu Script ONLY.
  // Roman Urdu is NOT a valid document-generation language (removed).
  let langDirective = "Draft the document in formal English.";
  if (preferredLanguage === 'ur') {
    langDirective = "Draft the document in formal Urdu script (اردو). Main headings, body paragraphs, and declarations must be in Urdu script.";
  }

  // F4: per-document-type professional structure supplied by the client schema.
  // Each document must follow the actual legal format of its type.
  let structureDirective = '';
  if (structure && Array.isArray(structure.sections) && structure.sections.length > 0) {
    const sectionList = structure.sections
      .map((s, i) => `  ${i + 1}. ${s.label}${s.hint ? ` — ${s.hint}` : ''}`)
      .join('\n');
    structureDirective = `
DOCUMENT STRUCTURE (mandatory):
- Centered heading: "${structure.heading || type}"
- Court/Authority line under the heading: "${promptCourtLine(structure, details)}"
- The document MUST contain the following sections in this exact order:
${sectionList}
- End with the date & place and a signature area.${structure.authorityNote ? `\n- Verified format note to include (italic, top of document): "${structure.authorityNote}"` : ''}
- DO NOT fabricate legal requirements, fees, deadlines or mandatory documents.
- If the exact format may vary by court/authority, add a small italic note at the end: "Note: Formats may vary by court or authority. Verify the exact format with the relevant office before submission."`;
  }

  const sysPrompt = `You are an expert Pakistani Legal Drafter. Generate a formal legal document for: ${type}.
LANGUAGE DIRECTIVE: ${langDirective}
${structureDirective}
CRITICAL REQUIREMENTS:
- Output MUST be pure HTML only. No Markdown formatting or backticks like \`\`\`html.
- Use Times New Roman or Urdu font styling (inline CSS: font-family: 'Jameel Noori Nastaleeq', 'Times New Roman', serif;).
- The document must have professional formatting with justified paragraphs (text-align: justify;).
- Any dates should be right-aligned where appropriate.
- For missing data or user-fillable fields, use 15+ underscores (e.g., _________________).
- Format as a complete, ready-to-print legal document.`;

  // Retrieve relevant RAG legal context for drafting
  let contextInstructions = "";
  let draftChunks = [];
  try {
    const retrievalResult = await RAGEngine.retrieve(`${type} ${JSON.stringify(details)}`, ragSemanticOnline);
    const retrievedChunks = retrievalResult.chunks;
    draftChunks = retrievedChunks || [];
    if (retrievedChunks && retrievedChunks.length > 0) {
      contextInstructions = "\nUse the following retrieved official legal resources to guide the drafting details:\n";
      retrievedChunks.forEach((c, idx) => {
        contextInstructions += `[Resource ${idx + 1}]:\nTitle: ${c.title}\nProvision: ${c.type} ${c.key}\nLegal Status: ${c.legalStatus}\nText: ${c.text}\n\n`;
      });
    }
  } catch (ragErr) {
    console.warn("[Backend] RAG failed for document generator:", ragErr.message);
  }

  const completePrompt = `Details: ${JSON.stringify(details)}
Language Directive: ${langDirective}
${contextInstructions}`;

  try {
    const responseText = await generateWithFallback(completePrompt, sysPrompt);
    res.json({ html: responseText.replace(/```html|```/g, '').trim() });
  } catch (err) {
    if (isOwnedModelPrimary) console.info('[Backend] Generate: Insaaf AI owned-model offline document rendering (no external provider).');
    else console.error(`[Backend] Generate error:`, err.message);
    // Part A / Phase AJ: when the user chose Urdu Script, render the SAME
    // type-specific structure in Urdu (RTL) — never fall through to the English
    // template. Structural strings are localized in server/docUrdu.js; user facts
    // are preserved verbatim and any unmapped string falls back to English.
    if (preferredLanguage === 'ur') {
      const urduHtml = renderUrduOfflineDocument(structure, type, details);
      return res.json({ html: urduHtml, isOffline: true });
    }
    // Phase 5 / 9: offline fallback now writes the COMPLETE professional legal
    // document (opening, numbered fact paragraphs, corpus-grounded legal basis,
    // demand/prayer, reservation of rights, verification, signature block, footer)
    // instead of the old "Label: ______" field lines. Missing facts become inline
    // bracketed placeholders; nothing is fabricated and legal-basis citations come
    // only from records the RAG layer actually retrieved (draftChunks).
    const offlineHtml = renderFullLegalDocument({ type, structure, details, chunks: draftChunks }) + INSAF_DOC_FOOTER;
    res.json({ html: offlineHtml, isOffline: true });
  }
}));

// J2.3: Server-side OCR endpoint. Browser WASM Tesseract hangs in headless
// Chrome (worker loads, language data downloads, but recognize() never resolves).
// Running Tesseract in Node.js works reliably (86% confidence on test document).
// Accepts { fileBase64, mimeType } and returns { text, confidence, source }.
app.post('/api/ai/ocr', rateLimiterMiddleware, async (req, res) => {
  const { fileBase64, mimeType } = req.body || {};
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return res.status(400).json({ error: 'fileBase64 is required (base64-encoded image or PDF)' });
  }
  if (!mimeType || !mimeType.startsWith('image/')) {
    return res.status(400).json({ error: 'mimeType must be an image type (e.g. image/png, image/jpeg)' });
  }

  let worker;
  try {
    const Tesseract = (await import('tesseract.js')).default;
    const buffer = Buffer.from(fileBase64, 'base64');
    // FIX 3: an invalid base64 string does not throw — it decodes to garbage,
    // which OCR then reports as an empty document. Fail the corrupt upload
    // instead of describing it as a page with no text.
    if (buffer.length < 24) {
      return res.status(400).json({ error: 'The uploaded file is empty or truncated. Please re-upload the image or photo.' });
    }
    const looksLikeImage =
      (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) ||  // png
      (buffer[0] === 0xff && buffer[1] === 0xd8) ||                                              // jpeg
      (buffer.slice(0, 6).toString('ascii').startsWith('GIF8')) ||                              // gif
      (buffer.slice(0, 4).toString('ascii') === '%PDF') ||                                      // pdf
      (buffer[0] === 0x42 && buffer[1] === 0x4d);                                              // bmp
    if (!looksLikeImage) {
      return res.status(400).json({ error: 'The uploaded file is not a readable image — its data appears corrupt or was damaged in transfer. Please upload the photo or scan again.' });
    }

    // eng-only: Urdu traineddata CDN is unreliable (socket hang up observed).
    // English covers the vast majority of legal documents; any Urdu text in
    // mixed documents will be skipped but English content is preserved.
    worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
    const { data } = await Promise.race([
      worker.recognize(buffer),
      new Promise((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), 60_000))
    ]);
    const confidence = typeof data?.confidence === 'number' ? Math.round(data.confidence) : 0;
    res.json({ text: data?.text || '', confidence, source: 'image-ocr' });
  } catch (err) {
    console.error('[Backend] OCR error:', err.message);
    res.json({ text: '', confidence: 0, source: 'image-ocr', error: 'OCR could not read this image. Try a clearer photo or a different page.' });
  } finally {
    if (worker) { try { await worker.terminate(); } catch (e) { console.warn('[Backend] OCR worker terminate failed:', e.message); } }
  }
});

// Document Analysis Endpoint
app.post('/api/ai/analyze', rateLimiterMiddleware, async (req, res) => {
  const validationError = validateAnalyzeInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  // Canonical schema: accept { text } (extracted document text) or { fileBase64, mimeType } (raw file)
  // Prefer text if provided; otherwise decode fileBase64
  let { text, fileBase64, mimeType } = req.body;

  if (!text && fileBase64) {
    // This endpoint analyses extracted text only. A raw image or PDF is binary data;
    // UTF-8 decoding it produces garbage that would otherwise be reported as a
    // successfully parsed document with no fields. Scans go through /api/ai/ocr.
    if (mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf')) {
      return res.status(400).json({
        error: 'Send the extracted document text to analyse it. For an image or scanned PDF, use /api/ai/ocr first and pass the returned text.'
      });
    }
    try {
      text = Buffer.from(fileBase64, 'base64').toString('utf8');
    } catch {
      text = '';
    }
    const sample = text.slice(0, 4000);
    const printable = (sample.match(/[\x09\x0a\x0d\x20-\x7e\u00a0-\u06ff\u0700-\u074f]/g) || []).length;
    if (!text.trim() || (sample.length > 0 && printable / sample.length < 0.85)) {
      return res.status(400).json({
        error: 'The uploaded file does not contain readable text. Upload a clearer scan, or paste the document text directly.'
      });
    }
  }

  const sysPrompt = `Analyze the provided legal document text.
Output a JSON object exactly matching this schema:
{
  "classification": "simple" | "complex",
  "fields": [
    { "fieldId": "unique_string", "label": "Human readable label", "type": "text|date|number|signature" }
  ]
}
Identify all fillable fields or missing information placeholders (like underscores or brackets). Determine if the document structure is simple or complex.
Return ONLY valid JSON.`;

  try {
    const responseText = await generateWithFallback(text || '', sysPrompt);
    const result = JSON.parse(extractJson(responseText));
    res.json(result);
  } catch (err) {
    console.error(`[Backend] Analyze error:`, err.message);
    const fields = [];
    let match;
    const regex = /_{3,}|\[([^\]]+)\]/g;
    let i = 0;
    while ((match = regex.exec(text || '')) !== null) {
      fields.push({
        fieldId: `field_${i++}`,
        label: match[1] || 'Fillable Field',
        type: 'text'
      });
    }
    res.json({ classification: 'simple', fields, isOffline: true });
  }
});

// F6: Document Understanding / OCR assistant
// Analyzes uploaded document text (PDF/image/OCR) and answers the user's
// specific question ("What do I need to know?", "Iska kya jawab dena hai?"...)
app.post('/api/ai/document-understanding', rateLimiterMiddleware, async (req, res) => {
  const validationError = validateAnalyzeInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { text, question, ocrQuality, preferredLanguage } = req.body;
  const cleanText = String(text || '').trim();
  const minChars = 20;
  // P0 — the Document Assistant answers in the language the user wrote in. An
  // Urdu-script question (or an Urdu-script document when no question was typed)
  // resolves to a Roman Urdu answer, exactly as chat/advice/agent do.
  const responseLang = resolveChatLanguage(preferredLanguage, String(question || '').trim() || cleanText);

  const emptyAnalysis = (answer, note) => ({
    documentType: null,
    summary: null,
    parties: [], dates: [], authorities: [], requirements: [], nextSteps: [], risks: [],
    caseNumbers: [], amounts: [],
    categorizedRisks: { deadline: [], legalIssue: [], missingInfo: [], unusualClause: [], ambiguousWording: [], inconsistency: [] },
    relevantProcedure: null,
    answer,
    ocrQualityNote: note,
    isOffline: false
  });

  // F6: never generate a generic answer from empty text
  if (cleanText.length < minChars) {
    return res.json(emptyAnalysis(
      prose(responseLang,
        "No readable text could be extracted from this document, so no analysis can be performed. Please upload a clearer scan or photo, or type the key text manually.",
        "Is dastawez se parhne layak text nahi nikla, is liye tajziya nahi kiya ja sakta. Baraye meharbani saaf scan ya photo upload karein, ya khaas text khud type karke bhejen."),
      prose(responseLang,
        "The uploaded file produced no usable text. Please provide a clearer document.",
        "Upload ki gayi file se istemal layak text nahi mila. Baraye meharbani saaf dastawez dein.")
    ));
  }

  // FIX 3: text that is present but is not language (base64 of a raw file,
  // decoded binary, a number dump) must be refused, not summarised as though
  // the document had parsed successfully.
  const readability = assessDocumentReadability(cleanText);
  if (!readability.readable) {
    const whatEn = ({ binary: 'binary file data', notText: 'a code or reference string', numbers: 'numbers without wording', notLanguage: 'raw file code instead of its wording', tooShort: 'too little text' }[readability.reason] || 'unreadable data');
    const whatRoman = ({ binary: 'bainari file ka data', notText: 'koi code ya reference string', numbers: 'raqamein bina alfaz ke', notLanguage: 'alfaz ke bajaye file ka code', tooShort: 'bohat kam text' }[readability.reason] || 'parhne layak nahi');
    return res.json(emptyAnalysis(
      prose(responseLang,
        "This upload did not contain readable document text, so there is nothing to analyse. What was received looks like " +
        whatEn +
        ". Please upload a clearer scan or photo of the document, or type the key text manually and try again.",
        "Is upload mein parhne layak document text nahi tha, is liye kuch tajziya nahi kiya ja sakta. Jo mila hai woh " +
        whatRoman +
        " lag raha hai. Baraye meharbani dastawez ka saaf scan ya photo upload karein, ya khaas text khud type karke dobara bhejen."),
      prose(responseLang,
        "No document text could be read from this input. The file was not analysed.",
        "Is input se document text parha nahi ja saka. File ka tajziya nahi kiya gaya.")
    ));
  }

  const lowQuality = typeof ocrQuality === 'number' && ocrQuality > 0 && ocrQuality < 55;
  const qualityDirective = lowQuality
    ? `\nOCR QUALITY WARNING: extraction confidence is LOW (${Math.round(ocrQuality)}%). Treat the text as uncertain. Begin the answer by clearly telling the user that OCR quality is poor and they should upload a clearer document. Never state uncertain details as verified facts.`
    : '';

  const sysPrompt = `You are an expert Legal Document Analyst (Pakistan + cross-border).
Analyze the provided document text ONLY. Never invent details that are not present in the text.
${qualityDirective}
JURISDICTION RULE: First decide which legal system the document belongs to. If it is issued by a FOREIGN court, authority, employer, university or immigration body (e.g. a U.S./UK/Canada/Gulf court notice, visa decision, removal/deportation notice, foreign police or tax letter), it is a FOREIGN-jurisdiction document — do NOT apply Pakistani law or Pakistani court procedure to it. Identify the issuing country/authority, what the document commands, and its stated deadline, and answer under that country's own procedure (recommend a qualified local lawyer there; a Pakistani mission gives consular support only). Only treat it as Pakistani law when the issuing authority/jurisdiction is genuinely Pakistani. Never fabricate foreign law, fees, deadlines or contacts.
Return ONLY valid JSON exactly matching:
{
  "documentType": "string or null",
  "jurisdiction": "Pakistani OR the named foreign country/authority the document comes from",
  "summary": "2-4 sentence summary of what the document says",
  "parties": ["parties identified in the document"],
  "dates": ["important dates with their context"],
  "authorities": ["courts, police stations or government offices mentioned"],
  "requirements": ["what the document appears to require from the recipient"],
  "nextSteps": ["practical next steps the recipient should take"],
  "risks": ["important risks or deadlines IF identifiable from the text, otherwise empty"],
  "caseNumbers": ["case numbers, FIR numbers, reference numbers, roll numbers found in the text"],
  "amounts": ["monetary amounts mentioned in the document with context"],
  "categorizedRisks": {
    "deadline": ["deadline-related risks"],
    "legalIssue": ["legal risks and concerns"],
    "missingInfo": ["information that should be present but is missing"],
    "unusualClause": ["unusual or onerous clauses detected"],
    "ambiguousWording": ["ambiguous or vague wording detected"],
    "inconsistency": ["inconsistencies within the document"]
  },
  "relevantProcedure": "the relevant legal procedure and WHICH jurisdiction's law governs IF clearly identifiable, otherwise null",
  "answer": "direct answer to the user's specific question",
  "ocrQualityNote": "null, or a clear note when OCR quality is poor"
}
Rules:
- If a field cannot be determined from the text, use null or [] — never guess.
- The "answer" field MUST directly answer the user's question using the document content.`;

  const userPrompt = `Document text:\n${cleanText}\n\nUser's question: ${question || 'What do I need to know from this document?'}`;

  // Part C/N/O/T — when the Insaaf AI owned model is primary, analyze the document
  // entirely LOCALLY: no external LLM call, every field grounded in the text.
  if (isOwnedModelPrimary) {
    return res.json(analyzeDocumentText(cleanText, question, { preferredLanguage: responseLang, ocrQuality }));
  }

  try {
    const responseText = await generateWithFallback(userPrompt, sysPrompt);
    res.json(JSON.parse(extractJson(responseText)));
  } catch (err) {
    // Even with an external provider configured, if generation fails fall back to
    // the local analyzer rather than returning a generic non-answer (Part N).
    console.error(`[Backend] Document understanding error:`, err.message);
    res.json(analyzeDocumentText(cleanText, question, { preferredLanguage: responseLang, ocrQuality }));
  }
});

// Document Comparison: compare two uploaded documents structurally.
// All differences are grounded in the actual text — never fabricated.
app.post('/api/ai/document-compare', rateLimiterMiddleware, async (req, res) => {
  const { textA, textB, preferredLanguage } = req.body || {};
  const a = String(textA || '').trim();
  const b = String(textB || '').trim();
  // P0 — this route has no question of its own, so the two documents are the text
  // the response language is resolved from.
  const responseLang = resolveChatLanguage(preferredLanguage, `${a}\n${b}`);

  if (a.length < 20 || b.length < 20) {
    return res.status(400).json({ error: prose(responseLang,
      'Both documents must contain at least 20 characters of readable text.',
      'Dono dastawezat mein kam az kam 20 haroof parhne layak text hona chahiye.') });
  }
  if (a.length > 200000 || b.length > 200000) {
    return res.status(400).json({ error: prose(responseLang,
      'Each document is limited to 200,000 characters for comparison.',
      'Muqablay ke liye har dastawez 200,000 haroof tak mehdood hai.') });
  }
  const readA = assessDocumentReadability(a);
  const readB = assessDocumentReadability(b);
  if (!readA.readable || !readB.readable) {
    const whichEn = !readA.readable && !readB.readable ? 'Both documents'
      : !readA.readable ? 'The first document' : 'The second document';
    const whichRoman = !readA.readable && !readB.readable ? 'Dono dastawez'
      : !readA.readable ? 'Pehla dastawez' : 'Doosra dastawez';
    return res.status(400).json({
      error: prose(responseLang,
        `${whichEn} does not contain readable document text — it looks like file code or binary data rather than wording. Provide extracted text from a clearer scan of each document.`,
        `${whichRoman} mein parhne layak document text nahi hai — yeh alfaz ke bajaye file code ya bainari data lag raha hai. Har dastawez ka saaf scan se nikala gaya text dein.`)
    });
  }

  try {
    const result = compareDocumentsLocal(a, b, { preferredLanguage: responseLang });
    res.json(result);
  } catch (err) {
    console.error('[Backend] Document comparison error:', err.message);
    res.json({
      summary: prose(responseLang,
        'The comparison could not be completed. Please try again.',
        'Muqabla mukammal nahi ho saka. Dobara koshish karen.'),
      partiesChanged: [], datesChanged: [], amountsChanged: [],
      obligationsAdded: [], obligationsRemoved: [],
      deadlinesChanged: [], clausesAdded: [], clausesRemoved: [],
      overallRisk: prose(responseLang, 'Comparison failed', 'Muqabla nahi ho saka'),
      isOffline: true
    });
  }
});

// Readiness Checklist: returns a structured checklist for a given document/application type.
// Fully local — no AI provider needed. Student-first: university document types get priority.
app.post('/api/ai/readiness-checklist', rateLimiterMiddleware, async (req, res) => {
  const { description, preferredLanguage } = req.body || {};
  const desc = String(description || '').trim();
  // P0 — one language for the whole response. Resolving only in the catch block
  // let a single request answer in English and report the failure in Roman Urdu.
  const responseLang = resolveChatLanguage(preferredLanguage, desc);

  if (desc.length < 3) {
    return res.status(400).json({ error: prose(responseLang,
      'Please describe the document or application you need help with.',
      'Baraye meharbani batayen ke aap kis document ya application ke liye madad chahte hain.') });
  }

  try {
    const result = getReadinessChecklist(desc, { preferredLanguage: responseLang });
    res.json(result);
  } catch (err) {
    console.error('[Backend] Readiness checklist error:', err.message);
    const romanGuidance = responseLang === 'roman_urdu';
    res.json({
      matchedType: 'unknown',
      label: 'General Document',
      items: [],
      requiredItems: [],
      optionalItems: [],
      readinessScore: 0,
      studentSpecific: false,
      guidance: romanGuidance
        ? 'Baraye meharbani document ki qisam thori wazeh likhein (maslan "bail application", "legal notice ka jawab", "domicile") taake aap ke liye usi qism ki checklist bana sakoon.'
        : 'Please describe the document type more specifically so we can provide a tailored checklist.',
      isOffline: true
    });
  }
});

// Translate: reports the honest capability state. See UNSUPPORTED_TRANSLATION below.
app.post('/api/ai/translate', rateLimiterMiddleware, async (req, res) => {
  const { text, direction } = req.body || {};
  const cleanText = String(text || '').trim();

  if (!cleanText || cleanText.length < 2) {
    return res.status(400).json({ error: 'Please provide text to translate.' });
  }
  if (cleanText.length > 20000) {
    return res.status(400).json({ error: 'Translation is limited to 20,000 characters per request. Please translate a shorter passage.' });
  }

  const VALID_DIRECTIONS = ['en-to-ur', 'ur-to-en', 'roman-to-ur'];
  const dir = VALID_DIRECTIONS.includes(direction) ? direction : 'en-to-ur';

  // TRUTHFUL STATE: no sentence-level translation is available in this build.
  // The owned runtime is deterministic English/Roman Urdu; it has no local
  // translator model, and an external translation API is not permitted here.
  // The old word-substitution path returned mixed-script output ("file an اپیل
  // within 30 دن") and the other two directions returned the source text wrapped
  // in a bracketed failure string — all with HTTP 200. A failed or partial
  // translation is an error, so it is reported as one.
  //
  // What IS available, and is not a translation: answers written in Roman Urdu
  // for Roman Urdu or Urdu-script questions (resolveChatLanguage), and legal
  // documents rendered in Urdu Script when the user explicitly chooses it.
  return res.status(501).json({
    error: 'Sentence-level translation is not available in Insaaf AI offline mode. Ask your question in English or Roman Urdu and the answer is written in that language; a generated legal document can also be produced in Urdu Script when you choose it.',
    code: 'UNSUPPORTED_TRANSLATION',
    supported: false,
    direction: dir,
    translatedText: null
  });
});

// F7: Document → Action → Draft.
// Drafts a legally structured response (reply / application / complaint /
// legal notice) from the ACTUAL uploaded document text. Facts are preserved
// from the source document only; missing information is marked, never invented.
app.post('/api/ai/document-reply', rateLimiterMiddleware, async (req, res) => {
  const validationError = validateAnalyzeInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { text, instruction, replyType, language, structure } = req.body;
  const cleanText = String(text || '').trim();
  const minChars = 20;
  // P0 — the drafted DOCUMENT keeps the language the user explicitly chose for it
  // (`language`, which may be Urdu Script); the assistant's own META prose follows
  // the product language contract, resolved from the user's instruction.
  const metaLang = resolveChatLanguage(language, String(instruction || '').trim() || cleanText);

  const VALID_REPLY_TYPES = ['reply', 'application', 'complaint', 'legal_notice'];
  const validType = VALID_REPLY_TYPES.includes(replyType) ? replyType : 'reply';

  // F7: never draft a generic answer from empty text
  const readability = assessDocumentReadability(cleanText);
  if (!readability.readable) {
    return res.json({
      html: null,
      explanation: cleanText.length < minChars
        ? prose(metaLang,
          'No readable text could be extracted from the uploaded document, so a response cannot be drafted from it. Please upload a clearer scan or photo.',
          'Upload kiye gaye document se parhne layak text nahi nikla, is liye us se jawab taiyar nahi kiya ja sakta. Baraye meharbani saaf scan ya photo upload karein.')
        : prose(metaLang,
          'The uploaded file did not contain readable document text — what arrived was file data rather than wording, so nothing could be drafted from it. Please upload a clearer scan or photo, or paste the document text.',
          'Upload ki gayi file mein parhne layak document text nahi tha — jo aaya woh alfaz ke bajaye file data hai, is liye kuch taiyar nahi kiya ja saka. Baraye meharbani saaf scan ya photo upload karein, ya document ka text khud paste karein.'),
      nextSteps: [],
      submission: null,
      missingInformation: [prose(metaLang, 'Readable source document text', 'Parhne layak source document text')],
      isOffline: false
    });
  }

  let langDirective = 'Draft the document in formal English.';
  if (language === 'ur') {
    langDirective = 'Draft the document in formal Urdu script (اردو). Main headings, body paragraphs, and declarations must be in Urdu script.';
  } else if (language === 'roman_urdu') {
    langDirective = 'Draft the document in formal Roman Urdu (Urdu written in Latin English alphabet).';
  }

  let structureDirective = '';
  if (structure && Array.isArray(structure.sections) && structure.sections.length > 0) {
    const sectionList = structure.sections
      .map((s, i) => `  ${i + 1}. ${s.label}${s.hint ? ` — ${s.hint}` : ''}`)
      .join('\n');
    structureDirective = `
DOCUMENT STRUCTURE (mandatory):
- Centered heading: "${structure.heading || validType}"
- Court/Authority line under the heading: "${promptCourtLine(structure, String(text || ''))}"
- The document MUST contain the following sections in this exact order:
${sectionList}${structure.authorityNote ? `\n- Verified format note to include (italic, top of document): "${structure.authorityNote}"` : ''}
- DO NOT fabricate legal requirements, fees, deadlines or mandatory documents.`;
  }

  const sysPrompt = `You are an expert Legal Drafter (Pakistan + cross-border).
The user uploaded a legal document and asked: "${instruction || 'Iska jawab bana do (draft a reply)'}".
Draft a formal ${validType.replace('_', ' ')} based ONLY on facts present in the source document text.
JURISDICTION RULE: If the source document is from a FOREIGN court/authority (a foreign country's court notice, visa/immigration decision, employer, university or tax body), draft the response to follow THAT country's procedure and address it to the correct foreign authority — do NOT apply Pakistani court format or Pakistani law to a foreign matter, and do NOT invent foreign rules, fees or deadlines. Only use Pakistani legal format/procedure when the source document is genuinely Pakistani. When unsure of the foreign procedure, keep the draft factual and mark unknowns [MISSING].
${structureDirective}
LANGUAGE DIRECTIVE: ${langDirective}
CRITICAL REQUIREMENTS:
- Never invent facts, names, dates or amounts that are not present in the source document.
- Where a needed fact is absent from the source document, write "[MISSING: short label]" in its place inside the HTML.
- Preserve the facts of the source document faithfully.
- Output MUST be pure HTML only (no Markdown or backticks), with justified paragraphs and professional font styling (font-family: 'Jameel Noori Nastaleeq', 'Times New Roman', serif;).
Return ONLY valid JSON exactly matching:
{
  "html": "the complete drafted document as pure HTML",
  "explanation": "1-3 sentences explaining what this generated document is and what it responds to",
  "nextSteps": ["practical next steps for the user"],
  "submission": "where/how this document is normally submitted ONLY if verified, otherwise null",
  "missingInformation": ["facts needed from the user but absent from the source document"]
}`;

  const userPrompt = `SOURCE DOCUMENT TEXT:\n${cleanText}\n\nUSER INSTRUCTION: ${instruction || 'Iska jawab bana do (draft a reply)'}`;

  // Part C/P — when the Insaaf AI owned model is primary, draft the response
  // entirely LOCALLY from the uploaded text (grounded; [MISSING] for unknowns).
  if (isOwnedModelPrimary) {
    return res.json(draftFromDocument(cleanText, { replyType: validType, language, metaLanguage: metaLang, structure, instruction }));
  }

  try {
    const responseText = await generateWithFallback(userPrompt, sysPrompt);
    res.json(JSON.parse(extractJson(responseText)));
  } catch (err) {
    // External provider configured but failed — still draft locally (Part P),
    // never a bare skeleton: facts are preserved and unknowns marked [MISSING].
    console.error(`[Backend] Document reply error:`, err.message);
    res.json(draftFromDocument(cleanText, { replyType: validType, language, metaLanguage: metaLang, structure, instruction }));
  }
});

// Iterative Document Chat Endpoint
app.post('/api/ai/document-chat', rateLimiterMiddleware, async (req, res) => {
  const validationError = validateDocumentChatInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { context, history, userInput } = req.body;
  // F8: Document change / edit loop. The editor must update ONLY the
  // requested part and report exactly what changed and what to do next.
  const sysPrompt = `You are an expert Legal Document Editor.
The user provides the current document HTML and an editing request in English or Roman Urdu.
Apply ONLY the requested change. Everything else must remain exactly the same.
Supported operations:
- Targeted value changes, e.g. "salary 100,000 se 150,000 karo" → change only that value.
- Removing a paragraph, e.g. "ye paragraph remove karo" → remove only the paragraph the user refers to (the most recently discussed one).
- Changing a name/party, e.g. "applicant ka naam change karo" → use the name the user provides in the request; if no new name is given, write "[MISSING: name]".
- Full language conversion: "isko Urdu Script mein karo" / "isko Roman Urdu mein karo" / "make it English" → convert the ENTIRE document language while preserving meaning and structure.
Rules:
- Never invent facts; change only what the user asked for.
- Preserve professional formatting, Times New Roman / Urdu font styling, and justified text.
Return ONLY valid JSON exactly matching:
{
  "summary": "What changed — 1-2 sentences describing ONLY the applied change",
  "html": "the complete updated HTML of the document",
  "nextSteps": ["2-3 practical things the user should do now, e.g. review the changed part, verify facts, save or print"]
}`;

  // Part C/Q — offline/owned-model: apply a safe, deterministic edit when the
  // user gives an explicit X→Y replacement; otherwise be honest that nothing
  // changed (never fake an edit).
  if (isOwnedModelPrimary) {
    // P0 — the edit confirmation and the next steps are the assistant's own
    // prose, so they follow the language the user wrote their instruction in.
    const responseLang = resolveChatLanguage(req.body.preferredLanguage, String(userInput || ''));
    const edit = applyLocalEdit(context, userInput);
    // The change description itself quotes the document's legal wording, and a
    // legal document is written in English or Urdu Script — never Roman Urdu.
    // Same honest framing the verified-law path uses for corpus quotations.
    const frame = prose(responseLang,
      '',
      'Aap ki draft mein jo tabdeeli ki gayi hai, us ka bayan neeche document ke apne qanooni matan mein hai (draft English ya Urdu Script mein hota hai, is liye us ka bayan bhi usi zaban mein rakha gaya hai). Aap chahein to main is ka aasan Roman Urdu matlab bhi bata sakta hoon.\n\n');
    if (edit.changed) {
      return res.json({
        summary: frame + edit.summary,
        html: edit.html,
        nextSteps: prose(responseLang,
          ['Review the changed part to confirm it reads correctly.', 'Verify the updated value or fact is accurate.', 'Save or print the updated document.'],
          ['Tabdeeli shuda hissa dobara parh kar tasdeeq karein ke theek likha hai.', 'Nayi qeemat ya baat ki apne record se milatulasdeeq karein.', 'Updated document save ya print kar len.']),
        isOffline: true
      });
    }
    return res.json({
      summary: frame + (edit.summary || prose(responseLang,
        'I could not detect a specific replacement in that request, so the document is unchanged. Try a direct instruction like "change 100,000 to 150,000", or edit the value in the preview.',
        'Aap ke message se mujhe yeh samajh nahi aya ke exactly kya badalna hai, is liye document jaisa tha waisa hi hai. Seedha likhein — maslan "100,000 ko 150,000 kar do" — ya preview mein value badal den.')),
      html: context,
      nextSteps: prose(responseLang,
        ['Review the guidance above and rephrase the change request (or fill the detail in the form).', 'Or edit the value directly in the document preview.'],
        ['Upar di gayi hidaayat dekh kar apni request dobara likhein (ya form mein woh detail bhar den).', 'Ya document ke preview mein value khud badal den.']),
      isOffline: true
    });
  }

  try {
    const responseText = await generateWithFallback(`Current Document:\n${context}\n\nUser Request: ${userInput}`, sysPrompt);
    const result = JSON.parse(extractJson(responseText));
    res.json(result);
  } catch (err) {
    console.error(`[Backend] Document chat error:`, err.message);
    // External provider failed — still try a safe local replacement edit.
    const edit = applyLocalEdit(context, userInput);
    if (edit.changed) {
      return res.json({ summary: edit.summary, html: edit.html, nextSteps: ['Review the changed part to confirm it reads correctly.', 'Verify the updated value or fact is accurate.', 'Save or print the updated document.'], isOffline: true });
    }
    // F8 offline fallback: the document is returned unchanged and the user is
    // told honestly that the edit was not applied — never a fake edit.
    res.json({ summary: 'The requested change could not be applied right now, so the document is unchanged. Please try the change again in a moment.', html: context, nextSteps: ['Try the change again in a moment.'], isOffline: true });
  }
});

// F12/F13: Insaaf AI Legal Agent — legal Q&A + app self-knowledge + deep-link markers.
// The route manifest below MUST mirror src/config/appRoutes.ts APP_ROUTES.
const AGENT_ROUTE_MANIFEST = [
  { id: 'chat', label: 'Legal Chat' },
  { id: 'agent', label: 'Insaaf AI Legal Agent' },
  { id: 'library', label: 'Legal Library' },
  { id: 'analyze', label: 'Document Analyzer' },
  { id: 'draft', label: 'Document Drafter' },
  { id: 'lawyers', label: 'Lawyer Directory' },
  { id: 'procedures', label: 'Legal Procedures' },
  { id: 'legalaid', label: 'Legal Aid & NGOs' },
  { id: 'emergency', label: 'Emergency Helplines' },
  { id: 'vault', label: 'My Vault' },
  { id: 'settings', label: 'Settings' },
  { id: 'language', label: 'Language Settings' },
  { id: 'voice', label: 'Voice Assistant' }
];

/**
 * Search the law itself — no model writing, no paraphrase. Every result is a
 * record from the verified corpus with the canonical source URL that was indexed
 * with it, so a person can read the exact statutory wording before acting on it.
 */
app.post('/api/ai/law-search', rateLimiterMiddleware, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) return res.status(400).json({ error: 'Missing required field: query (non-empty string).' });
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `query exceeds the maximum length of ${MAX_QUERY_LENGTH} characters.` });
  }
  const limit = Math.min(Math.max(parseInt(body.limit, 10) || 10, 1), 25);
  try {
    const result = await RAGEngine.retrieve(query);
    const metadataLine = (text, label) => {
      const m = new RegExp(`${label}:\\s*(.+)`, 'i').exec(String(text || '').slice(0, 1200));
      return m ? m[1].trim().slice(0, 220) : '';
    };
    // Corpus Source URL lines can trail verification prose after the link; only the
    // URL itself is a clickable reference.
    const urlOf = value => {
      const m = /(https?:\/\/\S+)/i.exec(String(value || ''));
      return m ? m[1].replace(/[.,;)]+$/, '') : '';
    };
    const results = (result.chunks || []).slice(0, limit).map(c => {
      // Chunk text wins when it carries the line; otherwise the value comes from the
      // corpus registry, which is the only record of a document's issuer and status.
      const doc = documentMetadata(c.docId) || {};
      return {
        chunkId: c.chunkId || c.id || null,
        docId: c.docId || null,
        provision: c.key && /^\d+[a-f]*$/i.test(String(c.key)) ? { type: c.type || 'SECTION', number: c.key } : null,
        title: c.title || metadataLine(c.text, 'Title') || null,
        authority: metadataLine(c.text, 'Authority') || doc.authority || null,
        legalStatus: metadataLine(c.text, 'Legal Status') || doc.legalStatus || null,
        sourceUrl: urlOf(c.sourceUrl) || urlOf(metadataLine(c.text, 'Source URL')) || doc.sourceUrl || null,
        score: Number((c.score ?? 0).toFixed(3)),
        exactMatch: Boolean(c.exactScore >= 8),
        excerpt: String(c.text || '').replace(/\s+/g, ' ').slice(0, 700),
      };
    });
    res.json({
      query,
      results,
      total: results.length,
      domain: result.domain || 'unknown',
      relevance: result.relevance || 'none',
      isOffline: true,
      generatedBy: 'corpus-retrieval',
    });
  } catch (err) {
    console.error('[law-search] retrieval failed:', err?.message || err);
    res.status(500).json({ error: 'Legal search is temporarily unavailable.' });
  }
});

/**
 * Student assignment workspace (Phase 2 §B). The pack is a scaffold: every citation it
 * carries is a record this corpus retrieval actually returned for that section, and a
 * section with no matched record reports the gap instead of receiving a reference.
 */
app.post('/api/ai/assignment', rateLimiterMiddleware, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : '';
  if (!instructions) {
    return res.status(400).json({ error: 'Missing required field: instructions (paste the assignment brief text).' });
  }
  if (instructions.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `instructions exceeds the maximum length of ${MAX_QUERY_LENGTH} characters.` });
  }
  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 400) : '';
  const lang = ['en', 'roman_urdu', 'ur'].includes(body.lang) ? body.lang : 'en';
  try {
    const pack = await buildAssignmentPack({ instructions, topic, lang });
    res.json({ ...pack, isOffline: true, generatedBy: 'corpus-retrieval' });
  } catch (err) {
    console.error('[assignment] pack failed:', err?.message || err);
    res.status(500).json({ error: 'Assignment support is temporarily unavailable.' });
  }
});

/**
 * Incident documents assembled by code from the client's reviewed facts.
 * Nothing here is model-generated: the complaint quotes only stated facts and cites
 * no offence section, and the lawyer brief can list only provisions the retrieval
 * actually returned for this matter.
 */
app.post('/api/ai/incident-package', rateLimiterMiddleware, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }
  const narrative = typeof body.narrative === 'string' ? body.narrative.trim() : '';
  if (!narrative) return res.status(400).json({ error: 'Missing required field: narrative (non-empty string).' });
  if (narrative.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `narrative exceeds the maximum length of ${MAX_QUERY_LENGTH} characters.` });
  }
  const activeLang = resolveChatLanguage(body.preferredLanguage, narrative);
  const agentContext = sanitizeAgentContext(body.context);
  const intake = (body.intake && typeof body.intake === 'object' && !Array.isArray(body.intake))
    ? body.intake
    : deriveIntake(narrative, agentContext, null);
  try {
    // Provisions come from retrieval, never from the request body, so a caller
    // cannot plant a section number that the corpus does not carry.
    let retrieval = await retrieveCorrected(narrative, { isOnline: false });
    // A narrated incident is a statement of facts, not a question: the gate compares
    // every record against all of the narrative's words — names, dates, amounts — and
    // can reject a pass even after the cascade has routed those facts to the right
    // statute. Retry once on the statutory wording the cascade itself derived for the
    // same narrative. Both passes are corpus retrieval; if neither is supported, the
    // honest refusal stands.
    if (!(retrieval.chunks || []).length) {
      const derived = RAGEngine.processQuery(narrative).rewrittenQuery;
      if (derived && derived.trim().toLowerCase() !== narrative.toLowerCase()) {
        const retry = await retrieveCorrected(derived, { isOnline: false });
        if ((retry.chunks || []).length) retrieval = retry;
      }
    }
    const sources = (retrieval.chunks || []).slice(0, 6).map(c => {
      const title = c.title || String(c.text || '').split('\n')[0] || '';
      const numbered = c.key && /^\d{1,4}[a-f]{0,2}$/i.test(String(c.key));
      const provision = numbered ? `${c.type === 'ARTICLE' ? 'Article' : 'Section'} ${c.key}` : '';
      return {
        label: [provision, title].filter(Boolean).join(' — '),
        docId: c.docId || null,
        provision: numbered ? { type: c.type || 'SECTION', number: String(c.key).toLowerCase() } : null,
      };
    }).filter(s => s.label);
    res.json({
      lang: activeLang,
      complaint: buildComplaintDraft(intake, narrative, activeLang),
      brief: buildLawyerBrief({ intake, narrative, lang: activeLang, sources }),
      intake,
      evidence: {
        verdict: retrieval.evidence?.verdict || null,
        domain: retrieval.evidence?.domain || null,
        provisionsListed: sources.filter(s => s.label).length,
      },
      isOffline: true,
    });
  } catch (err) {
    console.error('[incident-package] failed:', err?.message || err);
    res.status(500).json({ error: 'Incident documents are temporarily unavailable.' });
  }
});

app.post('/api/ai/agent', rateLimiterMiddleware, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ error: 'Missing required field: message (non-empty string).' });
  }
  if (message.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `message exceeds the maximum length of ${MAX_QUERY_LENGTH} characters.` });
  }
  // No default here: an unset preference must reach resolveChatLanguage as
  // "auto-detect", exactly as it does on /chat and /advice.
  const preferredLanguage = body.preferredLanguage;
  // Part 4: the Legal Agent honours the same Answer Level as chat/advice.
  const answerLevel = normalizeAnswerLevel(body.answerLevel);
  const history = normalizeHistory(body.history).slice(-6);
  // Voice / multi-turn continuity: remembered facts only. `context` is never
  // concatenated into the retrieval query or the cache key, so it cannot shift
  // evidence. History is different: it is what the citizen themselves said, and a
  // follow-up turn that names no subject is unsearchable without it.
  const agentContext = sanitizeAgentContext(body.context);
  const overseasMode = body.overseasMode === true;
  const preferredCountry = String(body.preferredCountry || '').replace(/[<>]/g, '').trim().slice(0, 60);

  const requestStart = Date.now();
  checkCacheInvalidation();

  const activeLang = resolveChatLanguage(preferredLanguage, message);

  // Same ordering as /api/ai/chat. Safety first: an unlawful ask or a person in
  // danger is answered before the system worries about what the dispute is.
  const safetyAnswer = curatedOfflineAnswer(message, activeLang, { safetyOnly: true });
  if (safetyAnswer) {
    return res.json({
      reply: safetyAnswer.text,
      actions: safetyAnswer.actions.filter(id => AGENT_ROUTE_MANIFEST.some(r => r.id === id)),
      sources: [], isOffline: true, intake: deriveIntake(message, agentContext, null)
    });
  }

  // Retrieval matches words, not who owes whom, so the agent route sees the same
  // "tenant … paise … wapis" / "tenant … rent nahi de raha" collision chat does.
  // When the direction cannot be told from the user's own words AND the corpus
  // cannot place the dispute, the reply is the ONE question that decides it.
  const thread = resolveThread(message, history);
  const everyday = resolveEverydayIntent(message, thread.priorUser, thread.priorModel);
  const everydayAsk = everydayClarification(everyday, activeLang);

  // Curated answers next: directory/app pointers and small talk are answered from
  // verified app knowledge. A resolved everyday dispute is not a directory
  // request, so the pointer rules stand down when the citizen named a real problem.
  const curatedAnswer = curatedOfflineAnswer(message, activeLang, { legalSituation: !!everyday.situation });
  if (curatedAnswer) {
    const curatedActions = curatedAnswer.actions.filter(id => AGENT_ROUTE_MANIFEST.some(r => r.id === id));
    return res.json({ reply: curatedAnswer.text, actions: curatedActions, sources: [], isOffline: true, action: curatedAction(curatedAnswer), intake: deriveIntake(message, agentContext, null) });
  }

  // RAG retrieval (cached, mirroring /api/ai/chat). A follow-up turn is searched —
  // and cached — with the subject the citizen already gave, not the fragment alone.
  const ragCacheKey = cacheKeyFor('agent', thread.retrievalQuery, activeLang, lastIndexModified, everyday.situation || '');
  let retrievalResult;
  let retrieval_ms = 0;
  const retrievalStart = Date.now();
  if (ragCache.has(ragCacheKey)) {
    metrics.ragCacheHits++;
    retrievalResult = ragCache.get(ragCacheKey);
    retrieval_ms = Date.now() - retrievalStart;
  } else {
    metrics.ragCacheMisses++;
    retrievalResult = await retrieveCorrected(thread.retrievalQuery, { isOnline: false, extraQuery: everyday.retrievalQuery });
    retrieval_ms = Date.now() - retrievalStart;
    cacheRagResult(ragCacheKey, retrievalResult);
  }
  const retrievedChunks = retrievalResult.chunks || [];
  gateMetrics(retrievalResult);

  // One decision order on every route: an ask the verified corpus cannot answer
  // abstains here, instead of becoming a clarifying question or an answer built
  // from the nearest record.
  const agentAbstention = abstentionFor(message, activeLang, retrievalResult.evidence, retrievedChunks);
  if (agentAbstention) {
    return res.json({
      reply: offlineKnowledgeHeader(activeLang, 'refusal', '') + agentAbstention,
      actions: [], sources: [], isOffline: true, answerLevel, action: 'abstain',
      intake: deriveIntake(message, agentContext, retrievalResult),
      ...gatePayload(retrievalResult)
    });
  }

  // One decision order on every route: the situation question is asked only when
  // retrieval could not place the dispute in the corpus. Before this, an agent
  // question the records answer directly (a wife's maintenance, an inheritance
  // share) was met with "whose money is it?".
  if (everydayAsk && retrievalResult.evidence && retrievalResult.evidence.verdict !== 'strong') {
    return res.json({
      reply: everydayAsk, actions: [], sources: [], isOffline: true, answerLevel, action: 'clarify',
      intake: deriveIntake(message, agentContext, retrievalResult),
      evidence: clarifyEvidence(retrievalResult, { reasons: ['ambiguous_situation'], candidates: everyday.candidates, supportedCount: 0, rejected: 0 }),
      relevance: 'clarify'
    });
  }

  // A named dispute the corpus does not actually cover gets said out loud, rather
  // than being answered from an empty evidence pool. Other queries keep their
  // existing path — this only fires when the citizen named a real situation.
  if (retrievedChunks.length === 0 && everyday.situation) {
    const timings = { retrieval_ms, provider_ms: 0, total_ms: Date.now() - requestStart };
    logTimings('/api/ai/agent', timings);
    return res.json({
      reply: everydayUnverifiedNote(everyday, activeLang), actions: ['library', 'lawyers'], sources: [],
      isOffline: true, answerLevel, action: 'abstain', intake: deriveIntake(message, agentContext, retrievalResult),
      ...gatePayload(retrievalResult), ...debugTimingsPayload(timings)
    });
  }

  // The reply is composed from the scoped, ordered evidence pool, so the cards
  // and the provider context must come from that SAME pool — raw retrieval order
  // paired a BISP programme answer with a passport or case-law card, and the
  // document-level manifest URL mislabeled which record a civic answer cited.
  const cappedChunks = answerEvidenceOrder(message, retrievedChunks, answerLevel).slice(0, 4);
  const mappedSources = toSourceMeta(cappedChunks, retrievalResult.domain, message);

  // Same optional model-backed path as /ai/chat and /ai/advice, through the shared
  // client and contract. A route the model names is only accepted when it exists
  // in the manifest, and any failure falls through to the deterministic agent.
  if (modelInferenceEnabled()) {
    const modelResult = await answerWithModel({
      question: message,
      chunks: cappedChunks,
      language: activeLang,
      answerLevel,
      history,
      navAllowList: AGENT_ROUTE_MANIFEST.map(r => r.id)
    });
    if (modelResult.ok) {
      const timings = { retrieval_ms, provider_ms: Date.now() - requestStart, total_ms: Date.now() - requestStart };
      logTimings('/api/ai/agent', timings);
      return res.json({
        reply: String(modelResult.text).replace(/^NAV:.*$/gim, '').trim(),
        actions: modelResult.navIds || [],
        sourceUrls: modelResult.sourceUrls || [],
        sources: mappedSources,
        isOffline: true,
        answerLevel,
        action: 'answer',
        intake: deriveIntake(message, agentContext, retrievalResult),
        provider: modelResult.provider,
        ...gatePayload(retrievalResult),
        ...debugTimingsPayload(timings)
      });
    }
    console.warn(`[Backend] Model provider not used in agent: ${modelResult.reason}`);
  }

  let contextStr = "Retrieved Authoritative Evidence:\n\n";
  cappedChunks.forEach((c, index) => {
    contextStr += `[Source ${index + 1}]: Title: ${c.title} | Authority: ${c.issuingAuthority} | Provision: ${c.type} ${c.key} | URL: ${c.sourceURL}\nText: ${c.text}\n\n`;
  });

  let langInstruction = "Respond in the user's language. NEVER respond in Urdu script (اردو). Respond only in English or Roman Urdu (Latin alphabet).";
  if (activeLang === 'roman_urdu') {
    langInstruction = "RESPONSE SCRIPT MANDATE: You MUST respond strictly in ROMAN URDU (Urdu written in Latin English alphabet). Keep section numbers and legal terms accurate. NEVER use Urdu script (اردو).";
  } else if (activeLang === 'en') {
    langInstruction = "RESPONSE SCRIPT MANDATE: You MUST respond strictly in ENGLISH.";
  }

  const sysPrompt = `You are "Insaaf AI Legal Agent", the assistant inside the Insaaf AI legal application for Pakistan.
You help citizens with TWO things: (1) Pakistani legal questions, and (2) using the Insaaf AI app itself.

APP SELF-KNOWLEDGE — the app has these sections with these EXACT route ids:
${AGENT_ROUTE_MANIFEST.map(r => `- ${r.id}: ${r.label}`).join('\n')}

${langInstruction}
${answerLevelInstruction(answerLevel)}

RULES:
1. Legal questions: answer ONLY from the provided retrieved evidence. Be short and direct (2-5 sentences or 3-5 short bullet points). NEVER reply with a bare "data unavailable" / "source not found" message (Part X). If the evidence does not contain the answer, say honestly that you could not find a verified Pakistani legal source for that exact point and that you will not guess legal facts, then give a concrete next step (rephrase with the law/section and city, ask about the procedure, or use the Library / lawyer directory). NEVER fabricate a section, case, citation, fee, or phone number.
   ANSWER-FIRST: Your VERY FIRST sentence must directly answer the user's question in plain language. NEVER begin with a statute name, section number, or "According to...". Answer immediately, then explain.
2. App questions ("how do I ...", "where is ..."): explain the feature briefly in 1-3 sentences, then give a navigation marker (rule 3).
3. NAVIGATION MARKER: finish your reply with exactly one line: NAV: <route_id>
   Use ONLY ids from the list above. You may give up to two ids separated by a space (e.g. "NAV: lawyers legalaid"). NEVER invent route ids, URLs, or link text.
4. Directory questions (find a lawyer / NGO / legal aid / helpline): NEVER fabricate names or phone numbers. Explain briefly what the directory offers and emit the matching NAV marker (lawyers, legalaid, or emergency) so the app opens the real verified directory.
5. Do NOT include raw HTML tags. Clean markdown only.
6. Do NOT introduce yourself. Start answering immediately with the direct answer.
7. CASE LAW CITATIONS (F15): cite a judgment compactly in-line as "Case: {Title} ({Citation}, {Court} {Year})" and state only the holding/significance present in the retrieved evidence. NEVER invent case names, citations, or facts.
8. CASE COMPARISONS (F15): NEVER say two cases are "exactly the same". Use "may be similar to" / "can be distinguished from".
9. PROFESSIONAL GUIDANCE MODEL (F16): for legal-problem questions, AFTER the direct answer, structure the rest as appropriate with: what it means, what to do now, documents/evidence needed, authority/court, remedy/procedure, limitations/risks, next step. DO NOT overstate certainty — use "may"/"could"/"depending on the facts".
10. CROSS-BORDER / OVERSEAS JURISDICTION: when ${retrievalResult.domain === 'cross-border' || overseasMode ? 'THIS is a cross-border / overseas-Pakistani matter' : 'a matter involves another country (abroad, visa, immigration, foreign employment, study abroad, foreign court, consular, remittance/tax)'}, do NOT answer as if only Pakistani law applies. Distinguish Layer A (Pakistan law / consular / mission process) from Layer B (the foreign country's own law/procedure) and say which governs. Never fabricate a foreign country's current visa/immigration/fee/deadline/treaty/embassy/scholarship facts — name the official source to verify and, for citizen welfare, the Pakistani mission (MOFA). If the user is arrested, detained, trafficked or in danger abroad, give the safety/consular routing FIRST. For these, emit a NAV marker (e.g. "NAV: library emergency" for the Pakistanis-Abroad library section and helplines). Never claim to cover every country.
11. STUDENT / UNIVERSITY QUERIES: When the query relates to university or college matters (admissions, fees, examinations, harassment, discipline, hostel, scholarships, degree attestation, student rights, transport, academic probation, show-cause notices), use the retrieved student-domain evidence. Where a rule or policy is university-specific, state clearly that it "depends on your university's applicable regulations" and do NOT present one university's rule as a universal Pakistan-wide standard. When the user is in Hyderabad or mentions a Hyderabad university (University of Sindh, MUET, Liaquat University), prioritize Hyderabad-relevant information from the evidence. Respond in the user's language — English or Roman Urdu. For student complaints (harassment, discipline, fee disputes), you may emit NAV markers for drafting (e.g. "NAV: draft") so the student can generate the appropriate application or complaint.

${contextStr}`;

  metrics.requestCount++;

  const providerStart = Date.now();
  let provider_ms = 0;
  try {
    const responseText = await generateWithFallback(message, sysPrompt);
    provider_ms = Date.now() - providerStart;
    metrics.aiGeneratedResponses++;
    metrics.estimatedTokens += estimateTokens(sysPrompt) + estimateTokens(message) + estimateTokens(responseText);

    // Parse navigation markers — only valid manifest ids are accepted
    let reply = String(responseText).replace(/^NAV:.*$/gim, '').trim();
    const navLine = String(responseText).match(/NAV:\s*([a-z][a-z_ ]*)/im);
    const actions = navLine
      ? navLine[1].split(/[\s,]+/).map(s => s.trim()).filter(id => AGENT_ROUTE_MANIFEST.some(r => r.id === id))
      : [];

    const timings = { retrieval_ms, provider_ms, total_ms: Date.now() - requestStart };
    logTimings('/api/ai/agent', timings);
    return res.json({ reply, actions, sources: mappedSources, isOffline: false, action: 'answer', intake: deriveIntake(message, agentContext, retrievalResult), ...gatePayload(retrievalResult), ...debugTimingsPayload(timings) });
  } catch (err) {
    provider_ms = Date.now() - providerStart;
    // Part C/AE: with the owned model primary the online chain is empty, so this
    // catch is the EXPECTED local-inference path — log as info, not an error.
    if (isOwnedModelPrimary) {
      console.info('[Backend] Legal Agent: Insaaf AI owned-model local inference (no external provider).');
    } else {
      console.error('[Backend] Legal Agent provider error:', err.message);
    }

    // Curated answers (safety refusals, directory/app pointers, small talk)
    const curated = curatedOfflineAnswer(message, activeLang, { legalSituation: !!everyday.situation });
    if (curated) {
      const timings = { retrieval_ms, provider_ms, total_ms: Date.now() - requestStart };
      logTimings('/api/ai/agent', { ...timings, cached: 'offline-fallback' });
      return res.json({ reply: curated.text, actions: curated.actions, sources: curatedAction(curated) === 'abstain' ? [] : mappedSources, isOffline: true, action: curatedAction(curated), intake: deriveIntake(message, agentContext, retrievalResult), ...gatePayload(retrievalResult), ...debugTimingsPayload(timings) });
    }

    // Part 3 — the Legal Agent orchestration layer runs ABOVE retrieval and
    // generation: it takes the already-gated retrieval (so the bounded
    // correction loop never runs twice), walks the 10-step workflow, and returns
    // the same verified-knowledge reply the inline path produced plus the ledger.
    const agentRun = await runLegalAgent({
      message, activeLang, answerLevel, retrieval: retrievalResult, context: agentContext,
      headerFor: offlineKnowledgeHeader, sectionNotFoundFor: sectionNotFoundText
    });
    const offlineReply = agentRun.reply;
    const timings = { retrieval_ms, provider_ms, total_ms: Date.now() - requestStart };
    logTimings('/api/ai/agent', { ...timings, cached: 'offline-fallback' });
    const agentProbe = parseOverseasIntent(message);
    // Offline-fallback actions: emit navigation chips based on query intent so
    // the student/user can act on the information. When no chunks matched, offer
    // the general discovery trio; when chunks DID match, infer the best action
    // from the query itself (drafting, analysis, library, or directory).
    let agentClarifyActions;
    if (retrievedChunks.length === 0) {
      agentClarifyActions = agentProbe.isOverseas ? ['library'] : ['library', 'lawyers', 'legalaid'];
    } else {
      const msgLow = message.toLowerCase();
      const wantsDraft = /\b(draft|write|create|prepare|compose|complaint|application|notice|response|reply|show.cause|bana|likh|taiyar|karo)\b/i.test(msgLow);
      const wantsAnalyze = /\b(analy[sz]e|examine|check|review|understand|samjh|dekh)\b.*\b(document|notice|letter|order|transcript|challan|card)\b|\b(document|notice|letter|order|transcript|challan|card)\b.*\b(analy[sz]e|examine|check|review|samjh)\b/i.test(msgLow);
      const wantsLawyer = /\b(lawyer|wakil|vakeel|advocate|attorney|find.*lawyer|lawyer.*find)\b/i.test(msgLow);
      const wantsLegalAid = /\b(legal aid|free.*help|muft.*madad|can'?t afford|nahi afford)\b/i.test(msgLow);
      if (wantsDraft) {
        agentClarifyActions = ['draft'];
      } else if (wantsAnalyze) {
        agentClarifyActions = ['analyze'];
      } else if (wantsLawyer) {
        agentClarifyActions = ['lawyers'];
      } else if (wantsLegalAid) {
        agentClarifyActions = ['legalaid'];
      } else {
        agentClarifyActions = ['library'];
      }
    }
    return res.json({
      reply: offlineReply, actions: agentClarifyActions, sources: mappedSources, isOffline: true,
      answerLevel: agentRun.answerLevel, steps: agentRun.steps, intake: agentRun.intake,
      evidence: agentRun.evidence, correction: agentRun.correction, relevance: agentRun.relevance,
      ...debugTimingsPayload(timings)
    });
  }
});


// P-AR cloud readiness: in a production / single-container deployment the same
// Express service also serves the built frontend (dist/) so ONE cloud service
// serves both the UI and the /api — no separate static host or dev proxy needed,
// and the owned model (corpus + composer) runs server-side on cloud infra, never
// on the user's device. Guarded by the existence of dist/ so local `npm run dev`
// (Vite on :3000 proxying /api here) is completely unaffected.
const DIST_DIR = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback: any GET that is not an /api route and did not match a static
  // file returns index.html so client-side routing works on refresh/deep-links.
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
    next();
  });
  console.log(`[Insaaf AI Backend] Serving built frontend from ${DIST_DIR}`);
}

// P21 security: global error handler — malformed/oversized JSON and unexpected
// errors return clean JSON, never HTML stack traces.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Invalid or oversized JSON body.' });
  }
  console.error('[Backend] Unhandled error:', err && err.message ? err.message : err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// A serverless runtime (Vercel sets VERCEL=1) imports this module and calls the
// exported app per invocation; opening a listening socket there would keep the
// invocation alive and never serve a request. Local `npm start` is unaffected.
const IS_SERVERLESS = Boolean(process.env.VERCEL);

if (!IS_SERVERLESS) {
  const httpServer = http.createServer(app);

  // A stalled or half-closed request must not hold a socket open forever: under
  // load those pile up and the service stops answering even though the process is
  // still alive. Bounds are generous enough for streamed legal answers.
  httpServer.requestTimeout = 120000;
  httpServer.headersTimeout = 65000;
  httpServer.keepAliveTimeout = 61000;
  httpServer.on('clientError', (err, socket) => {
    console.warn('[Backend] Client error ignored:', err && err.code ? err.code : err && err.message);
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n{"error":"Malformed request."}\r\n\r\n');
    } else {
      socket.destroy();
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`[Insaaf AI Backend] Server running cleanly on port ${PORT}`);
  });
}

// A serverless catch-all handler imports this module and calls the app with the
// platform's req/res, so every existing /api/* route is served unchanged.
export default app;

// A single rejected promise must not take the whole service down: Node 15+ exits
// on an unhandled rejection by default, which earlier killed the backend with no
// trace in its own log. Report it, keep serving.
process.on('unhandledRejection', reason => {
  console.error('[Backend] Unhandled rejection (service kept alive):', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', err => {
  console.error('[Backend] Uncaught exception (service kept alive):', err && err.message ? err.message : err);
});
