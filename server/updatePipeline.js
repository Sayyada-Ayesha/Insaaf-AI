/**
 * server/updatePipeline.js — monitored official sources, change detection, and a
 * candidate queue that only an authorized administrator can publish from.
 *
 * What this module is allowed to do: fetch a URL, hash what came back, record that
 * something changed, and hold the change as a *candidate*.
 * What it is never allowed to do: write scraped text into the trusted corpus, alter a
 * retrieval index, or mark its own candidate verified. Those are separate actions, and
 * publishing additionally requires an approver identity that this code refuses to
 * invent. A production answer therefore cannot be replaced by unreviewed page text.
 *
 * Every network call goes through an injected `fetcher`, so the queue logic can be
 * exercised without internet access and so a test cannot accidentally be the only thing
 * that ever touched a live URL.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

export const UPDATE_DIR = path.join(ROOT, 'rag', 'updates');
export const SOURCES_FILE = path.join(UPDATE_DIR, 'sources.json');
export const CANDIDATES_FILE = path.join(UPDATE_DIR, 'candidates.json');
export const HISTORY_DIR = path.join(UPDATE_DIR, 'history');

/** Candidate lifecycle. `published` is reachable only through publish() with an approver. */
export const CANDIDATE_STATES = Object.freeze(['candidate', 'verified', 'rejected', 'stale', 'published']);
const PUBLISHABLE = new Set(['verified']);

export const CHECK_STATUSES = Object.freeze(['unchanged', 'changed', 'inaccessible', 'redirected-offsite', 'empty-body', 'timeout']);

function nowIso() { return new Date().toISOString(); }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Build the registry from what the repository already declares as primary sources and
 * from the URLs the indexed corpus records actually cite. Nothing here is a hand-typed
 * URL: an entry exists only because one of those two files already names it, which is
 * what keeps "approved source" an evidenced claim rather than a guess.
 */
export function initRegistry({ sourceRegistryFile = path.join(ROOT, 'rag', 'corpus_expansion', 'source_registry.json'), manifestFile = path.join(ROOT, 'rag', 'manifest.json'), force = false } = {}) {
  if (!force && fs.existsSync(SOURCES_FILE)) return { created: false, sources: readJson(SOURCES_FILE, []).length };

  const declared = readJson(sourceRegistryFile, { primary_sources: [] });
  const manifest = readJson(manifestFile, { documents: [] });
  const byId = new Map();

  for (const s of (declared.primary_sources || [])) {
    const url = String(s.url || '').trim();
    if (!/^https:\/\//i.test(url)) continue;
    byId.set(`src-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 10)}`, {
      id: `src-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 10)}`,
      name: String(s.name || url).slice(0, 120),
      url,
      kind: 'declared-primary',
      issuer: String(s.type || '').slice(0, 60),
      statusClaim: String(s.status || '').slice(0, 60),
      jurisdiction: 'Pakistan',
      frequencyHours: 168,
      lastCheckedAt: null,
      lastHash: null,
      lastBytes: null,
      lastGoodAt: null,
      consecutiveFailures: 0
    });
  }

  const docs = manifest.documents || manifest || [];
  for (const d of docs) {
    const url = String(d.sourceURL || '').trim();
    if (!/^https:\/\//i.test(url)) continue;
    const id = `doc-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 10)}`;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      name: String(d.title || d.docId || url).slice(0, 120),
      url,
      kind: 'cited-by-corpus',
      docId: String(d.docId || d.id || '').slice(0, 80),
      issuer: String(d.issuingAuthority || d.publisher || '').slice(0, 60),
      jurisdiction: String(d.jurisdiction || 'Pakistan').slice(0, 60),
      frequencyHours: 720,
      lastCheckedAt: null,
      lastHash: null,
      lastBytes: null,
      lastGoodAt: null,
      consecutiveFailures: 0
    });
  }

  const sources = [...byId.values()];
  writeJson(SOURCES_FILE, sources);
  return { created: true, sources: sources.length, fromDeclared: (declared.primary_sources || []).length, fromManifest: docs.length };
}

export function loadSources() { return readJson(SOURCES_FILE, []); }
export function loadCandidates() { return readJson(CANDIDATES_FILE, []); }

/**
 * One source, one fetch. `fetcher` must return {status, body, finalUrl} — the real
 * caller passes fetch(); a test passes a double. Nothing is thrown out of here: a dead
 * site is a recorded state, not an exception that stops a whole sweep.
 */
export async function checkSource(source, { fetcher, timeoutMs = 15000 } = {}) {
  const startedAt = nowIso();
  let result;
  try {
    const res = await withTimeout(fetcher(source.url), timeoutMs);
    const body = res && res.body != null ? (Buffer.isBuffer(res.body) ? res.body : Buffer.from(String(res.body), 'utf8')) : Buffer.alloc(0);
    const finalUrl = String(res && res.finalUrl || source.url);
    const offsite = !sameHost(finalUrl, source.url);
    if (!res || Number(res.status) >= 400) result = { outcome: 'inaccessible', httpStatus: Number(res && res.status) || 0, bytes: body.length };
    else if (body.length === 0) result = { outcome: 'empty-body', httpStatus: Number(res.status), bytes: 0 };
    else if (offsite) result = { outcome: 'redirected-offsite', httpStatus: Number(res.status), bytes: body.length, finalUrl };
    else result = { outcome: 'unchanged', httpStatus: Number(res.status), bytes: body.length, hash: sha(body), finalUrl };
  } catch (err) {
    result = { outcome: String(err && err.code === 'ETIMEDOUT' || /timeout/i.test(String(err && err.message))) ? 'timeout' : 'inaccessible', error: String((err && err.message) || err).slice(0, 160), bytes: 0 };
  }

  const prevHash = source.lastHash || null;
  if (result.outcome === 'unchanged' && prevHash && result.hash !== prevHash) result.outcome = 'changed';

  const next = {
    ...source,
    lastCheckedAt: startedAt,
    lastOutcome: result.outcome,
    ...(result.httpStatus ? { lastHttpStatus: result.httpStatus } : {}),
    ...(result.outcome === 'unchanged' || result.outcome === 'changed' ? { lastHash: result.hash, lastBytes: result.bytes, lastGoodAt: startedAt, consecutiveFailures: 0 } : { consecutiveFailures: (Number(source.consecutiveFailures) || 0) + 1 })
  };
  if (result.outcome === 'changed' || result.outcome === 'unchanged') {
    appendHistory(source.id, { at: startedAt, outcome: result.outcome, hash: result.hash, bytes: result.bytes, httpStatus: result.httpStatus || null, previousHash: prevHash });
  }
  if (result.outcome === 'changed') {
    next.pendingCandidate = { at: startedAt, fromHash: prevHash, toHash: result.hash, bytes: result.bytes };
  } else if (result.outcome === 'inaccessible' || result.outcome === 'timeout' || result.outcome === 'empty-body') {
    next.inaccessibleSince = source.inaccessibleSince || startedAt;
  }
  return next;
}

function sameHost(a, b) {
  try { return new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase(); } catch { return false; }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), ms);
    Promise.resolve(promise).then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function appendHistory(sourceId, entry) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  fs.appendFileSync(path.join(HISTORY_DIR, `${String(sourceId).replace(/[^A-Za-z0-9_-]/g, '')}.jsonl`), `${JSON.stringify(entry)}\n`, 'utf8');
}

export function readHistory(sourceId, { limit = 20 } = {}) {
  const file = path.join(HISTORY_DIR, `${String(sourceId).replace(/[^A-Za-z0-9_-]/g, '')}.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean).slice(-limit).reverse();
}

/** Sweep every source once. Returns the updated registry and the candidate ids raised. */
export async function sweep({ fetcher, sources = loadSources(), timeoutMs = 15000 } = {}) {
  const checkedIds = new Set(sources.map(s => s.id));
  const updated = [];
  const raised = [];
  for (const s of sources) {
    const next = await checkSource(s, { fetcher, timeoutMs });
    updated.push(next);
    if (next.pendingCandidate) {
      const c = enqueueCandidate({
        sourceId: next.id, sourceUrl: next.url, sourceName: next.name, docId: next.docId || null,
        fromHash: next.pendingCandidate.fromHash, toHash: next.pendingCandidate.toHash,
        bytes: next.pendingCandidate.bytes, detectedAt: next.pendingCandidate.at
      });
      raised.push(c.id);
    }
    if (next.consecutiveFailures >= 3) next.flagged = 'inaccessible';
  }
  // A partial sweep must not drop the entries it did not touch.
  const registry = loadSources();
  const merged = registry.filter(s => !checkedIds.has(s.id));
  for (const s of updated) merged.push(s);
  merged.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  writeJson(SOURCES_FILE, merged);
  return { checked: updated.length, registrySize: merged.length, raised, flagged: updated.filter(s => s.flagged).map(s => s.id), at: nowIso() };
}

/**
 * A candidate is a note that something moved. It carries a hash and a pointer, never
 * the scraped text into a trusted path — the text stays in the history file until a
 * human promotes it through the corpus pipeline, which is a separate, reviewed command.
 */
export function enqueueCandidate(input) {
  const list = loadCandidates();
  const id = `upd-${crypto.createHash('sha1').update(`${input.sourceId}${input.toHash}${input.detectedAt}`).digest('hex').slice(0, 10)}`;
  const existing = list.find(c => c.id === id);
  if (existing) return existing;
  const candidate = {
    id,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    sourceName: String(input.sourceName || '').slice(0, 120),
    docId: input.docId || null,
    detectedAt: input.detectedAt,
    fromHash: input.fromHash || null,
    toHash: input.toHash || null,
    bytes: Number(input.bytes) || 0,
    state: 'candidate',
    verification: null,
    conflict: null,
    reviewedBy: null,
    reviewedAt: null,
    publishedAt: null,
    history: readHistory(input.sourceId, { limit: 5 })
  };
  list.push(candidate);
  writeJson(CANDIDATES_FILE, list.slice(-500));
  return candidate;
}

/**
 * Record a verification *decision made by a named caller*. This does not fetch or
 * compare legal text itself: an administrator (or the legal-verification agent) states
 * what they confirmed, and the entry records who said it and when, so the claim is
 * attributable rather than self-certified by the scraper.
 */
export function markVerified({ candidateId, by, checks, notes }) {
  const list = loadCandidates();
  const c = list.find(x => x.id === candidateId);
  if (!c) return { ok: false, reason: 'NOT_FOUND' };
  if (c.state === 'published') return { ok: false, reason: 'ALREADY_PUBLISHED' };
  const clearedConflict = c.conflict || null;
  c.state = 'verified';
  c.conflict = null;
  if (clearedConflict) c.conflictCleared = { by: String(by || '').slice(0, 120), at: nowIso(), was: clearedConflict };
  c.verification = { by: String(by || '').slice(0, 120), at: nowIso(), checks: Array.isArray(checks) ? checks.slice(0, 20) : [], notes: String(notes || '').slice(0, 600) };
  writeJson(CANDIDATES_FILE, list);
  return { ok: true, candidate: c };
}

export function markRejected({ candidateId, by, reason }) {
  const list = loadCandidates();
  const c = list.find(x => x.id === candidateId);
  if (!c) return { ok: false, reason: 'NOT_FOUND' };
  c.state = 'rejected';
  c.reviewedBy = String(by || '').slice(0, 120);
  c.reviewedAt = nowIso();
  c.rejectReason = String(reason || '').slice(0, 400);
  writeJson(CANDIDATES_FILE, list);
  return { ok: true, candidate: c };
}

/** A candidate that contradicts a corpus record it would overwrite. */
export function flagConflict(candidateId, { field, detail }) {
  const list = loadCandidates();
  const c = list.find(x => x.id === candidateId);
  if (!c) return { ok: false, reason: 'NOT_FOUND' };
  c.conflict = { field: String(field || '').slice(0, 60), detail: String(detail || '').slice(0, 400), at: nowIso() };
  if (c.state === 'published') c.state = 'stale';
  writeJson(CANDIDATES_FILE, list);
  return { ok: true, candidate: c };
}

/**
 * The only transition that could ever influence a production answer, and it is gated
 * three ways: the candidate must be `verified`, the approver must be a real identity
 * supplied by the caller (an administrator uid from a verified token), and the role
 * must be `administrator`. Even then it writes a *record of approval* — the corpus
 * change itself is made by the reviewed `rag:build` command, not by this function.
 */
export function publish({ candidateId, approvedBy, role }) {
  if (!approvedBy || typeof approvedBy !== 'string') return { ok: false, reason: 'NO_APPROVER' };
  if (role !== 'administrator') return { ok: false, reason: 'NOT_AUTHORIZED' };
  const list = loadCandidates();
  const c = list.find(x => x.id === candidateId);
  if (!c) return { ok: false, reason: 'NOT_FOUND' };
  if (!PUBLISHABLE.has(c.state)) return { ok: false, reason: 'NOT_VERIFIED', state: c.state };
  if (c.conflict) return { ok: false, reason: 'UNRESOLVED_CONFLICT', conflict: c.conflict };
  c.state = 'published';
  c.publishedAt = nowIso();
  c.reviewedBy = approvedBy.slice(0, 120);
  c.reviewedAt = c.publishedAt;
  writeJson(CANDIDATES_FILE, list);
  appendHistory(c.sourceId, { at: c.publishedAt, outcome: 'published', candidateId: c.id, approvedBy: approvedBy.slice(0, 120) });
  return { ok: true, candidate: c, effect: 'Approval recorded. The trusted corpus is only changed by a reviewed rag:build run, not by this call.' };
}

/** Commands a candidate must clear before it may be marked verified. */
export function regressionPlan(candidate) {
  const domainHint = candidate.docId ? [candidate.docId] : [];
  return {
    candidateId: candidate.id,
    commands: [
      'npm run rag:validate',
      'npx tsc --noEmit',
      'node tests/unit/testCommunityAuthz.cjs',
      'node tests/unit/testCivicAuthz.cjs',
      'node server/testRAG.js',
      ...(domainHint.length ? [`node server/testDomainRetrieval.js ${domainHint[0]}`] : [])
    ],
    rule: 'A candidate may not be marked verified while any listed command fails.',
    requiredEvidence: ['affected retrieval queries before/after', 'citation audit on the changed record', 'language check in en and roman_urdu']
  };
}

/**
 * Scheduler wiring. It stays inert unless the operator opts in with
 * INSAaf_UPDATES_ENABLED=1; the string it reports is what a deployment can show as
 * evidence of a real configured timer rather than a claim of background monitoring.
 */
export function describeScheduler(env = process.env) {
  const enabled = String(env.INSAaf_UPDATES_ENABLED || '') === '1';
  const intervalMs = Number(env.INSAaf_UPDATE_INTERVAL_MS || 6 * 60 * 60 * 1000);
  return {
    enabled,
    intervalMs,
    invalidInterval: enabled && !(Number.isFinite(intervalMs) && intervalMs >= 60000),
    note: enabled ? 'A timer will be registered in-process at boot.' : 'No timer registered: no continuous monitoring is running.'
  };
}

export function startScheduler({ env = process.env, run, log = console.error } = {}) {
  const cfg = describeScheduler(env);
  if (!cfg.enabled || cfg.invalidInterval) return { started: false, reason: cfg.enabled ? 'invalid interval' : 'disabled by environment', config: cfg };
  const timer = setInterval(() => { Promise.resolve(run()).catch(err => log('[updates] sweep failed:', String(err && err.message || err).slice(0, 160))); }, cfg.intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return { started: true, timer, config: cfg };
}
