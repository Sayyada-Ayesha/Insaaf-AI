/**
 * server/updateRoutes.js — the administrator-facing review surface for Phase 4 §B.
 *
 * The rule this file exists to enforce: a scrape can raise a candidate, only a named
 * administrator can move it. Nothing here writes trusted corpus text. `publish` records
 * an approval decision and says in its own response that the corpus still changes only
 * through a reviewed `rag:build`; an automated sweep that found a changed page does not
 * make the new page text an answer in the product.
 *
 * Every route requires the verified `administrator` role. The pipeline state lives in
 * rag/updates/ — a local, reviewable record — and each decision is mirrored into the
 * Phase 3 admin audit trail when that store is configured.
 */

import express from 'express';
import {
  loadSources, loadCandidates, readHistory, sweep, regressionPlan,
  markVerified, markRejected, flagConflict, publish, describeScheduler,
  CHECK_STATUSES, CANDIDATE_STATES, SOURCES_FILE, CANDIDATES_FILE
} from './updatePipeline.js';
import { AGENTS, createQualityRun } from './qualityAgents.js';

const MAX_CHECK_PER_REQUEST = 8;
const FETCH_TIMEOUT_MS = 12000;

export async function defaultFetcher(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'INSAafAI-source-monitor (+admin review)', 'accept': 'text/html,application/pdf,*/*' }
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body: buf, finalUrl: res.url };
  } finally {
    clearTimeout(t);
  }
}

/**
 * The admin audit mirror is best-effort: a decision a person already made is never
 * discarded because the audit store was unreachable. The failure is reported back as
 * `auditRecorded: false` instead of being hidden, so the queue never claims a trail it
 * does not have.
 */
function auditAction(audit, entry) {
  if (!audit || typeof audit.addAudit !== 'function') return Promise.resolve({ recorded: false, reason: 'no audit store' });
  try {
    return Promise.resolve(audit.addAudit(entry)).then(() => ({ recorded: true })).catch(err => ({ recorded: false, reason: String(err && err.message || err).slice(0, 120) }));
  } catch (err) {
    return Promise.resolve({ recorded: false, reason: String(err && err.message || err).slice(0, 120) });
  }
}

export function createUpdateRouter({ authorizer, audit = null, fetcher = defaultFetcher, runCommand = null, retrieve = null, records = () => [], env = process.env }) {
  const router = express.Router();
  router.use(authorizer.requireRole('administrator'));
  const lastRun = { at: null, summary: null };

  router.get('/sources', (_req, res) => {
    const sources = loadSources();
    res.json({
      sources: sources.map(s => ({
        id: s.id, name: s.name, url: s.url, kind: s.kind, docId: s.docId || null,
        jurisdiction: s.jurisdiction || null, frequencyHours: s.frequencyHours,
        lastCheckedAt: s.lastCheckedAt || null, lastOutcome: s.lastOutcome || null,
        lastHttpStatus: s.lastHttpStatus || null, lastBytes: s.lastBytes || null,
        lastGoodAt: s.lastGoodAt || null, consecutiveFailures: s.consecutiveFailures || 0,
        inaccessibleSince: s.inaccessibleSince || null, flagged: s.flagged || null,
        pendingCandidate: s.pendingCandidate || null
      })),
      total: sources.length,
      neverChecked: sources.filter(s => !s.lastCheckedAt).length,
      failing: sources.filter(s => (s.consecutiveFailures || 0) > 0).map(s => ({ id: s.id, failures: s.consecutiveFailures })),
      outcomes: CHECK_STATUSES,
      scheduler: describeScheduler(env),
      // A live claim would need an observed timer; this says which it is.
      monitoringIsRunning: false,
      files: { sources: SOURCES_FILE, candidates: CANDIDATES_FILE }
    });
  });

  /**
   * One sweep, triggered by a person, capped at a handful of sources so an administrator
   * cannot be frozen by a slow government site. Results are whatever the network actually
   * returned — including failures, which are recorded as states rather than retried here.
   */
  router.post('/sources/check', async (req, res) => {
    try {
      const all = loadSources();
      const ids = Array.isArray(req.body?.sourceIds) ? req.body.sourceIds.map(String) : [];
      const limit = Math.min(MAX_CHECK_PER_REQUEST, Math.max(1, Number(req.body?.limit) || 3));
      const targets = ids.length ? all.filter(s => ids.includes(s.id)) : [...all].sort((a, b) => Number(Boolean(a.lastCheckedAt)) - Number(Boolean(b.lastCheckedAt)));
      if (!targets.length) return res.status(400).json({ error: 'NO_MATCHING_SOURCE', registrySize: all.length });
      const picked = targets.slice(0, limit);
      const out = await sweep({ fetcher, sources: picked, timeoutMs: FETCH_TIMEOUT_MS });
      const trail = await auditAction(audit, {
        at: new Date().toISOString(), by: req.auth.uid, targetUid: 'updates',
        action: 'updates.sweep', from: null, to: null,
        reason: `checked ${out.checked}, raised ${out.raised.length}, flagged ${out.flagged.length}`
      });
      return res.json({ auditRecorded: trail.recorded, checked: out.checked, registrySize: out.registrySize, raised: out.raised, flagged: out.flagged, at: out.at, results: loadSources().filter(s => picked.some(p => p.id === s.id)).map(s => ({ id: s.id, outcome: s.lastOutcome, httpStatus: s.lastHttpStatus || null, bytes: s.lastBytes || null, failures: s.consecutiveFailures || 0 })) });
    } catch (err) {
      return res.status(500).json({ error: 'SWEEP_FAILED', detail: String(err && err.message || err).slice(0, 200) });
    }
  });

  router.get('/candidates', (req, res) => {
    const state = String(req.query.state || '');
    const all = loadCandidates();
    res.json({
      candidates: state ? all.filter(c => c.state === state) : all,
      states: CANDIDATE_STATES,
      counts: CANDIDATE_STATES.reduce((acc, s) => ({ ...acc, [s]: all.filter(c => c.state === s).length }), {}),
      publishRule: 'Only a verified candidate with no unresolved conflict may be published, and only by an administrator.'
    });
  });

  router.get('/candidates/:id', (req, res) => {
    const c = loadCandidates().find(x => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
    return res.json({ candidate: c, history: readHistory(c.sourceId, { limit: 20 }), regressionPlan: regressionPlan(c) });
  });

  router.post('/candidates/:id/verify', async (req, res) => {
    const checks = Array.isArray(req.body?.checks) ? req.body.checks.filter(x => typeof x === 'string' && x.trim()).slice(0, 20) : [];
    if (!checks.length) return res.status(400).json({ error: 'VERIFICATION_EVIDENCE_REQUIRED', rule: 'State what you compared: URL, issuer, date/version, and the retrieval and citation results.' });
    const out = markVerified({ candidateId: req.params.id, by: req.auth.uid, checks, notes: String(req.body?.notes || '').slice(0, 1000) });
    if (!out.ok) return res.status(out.reason === "NOT_FOUND" ? 404 : 409).json({ error: out.reason });
    const trail = await auditAction(audit, { at: out.candidate.reviewedAt, by: req.auth.uid, targetUid: out.candidate.id, action: 'update.verify', from: 'candidate', to: 'verified', reason: checks.join(' | ').slice(0, 500) });
    return res.json({ ...out, auditRecorded: trail.recorded });
  });

  router.post('/candidates/:id/reject', async (req, res) => {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 10) return res.status(400).json({ error: 'REJECTION_REASON_REQUIRED' });
    const out = markRejected({ candidateId: req.params.id, by: req.auth.uid, reason });
    if (!out.ok) return res.status(out.reason === "NOT_FOUND" ? 404 : 409).json({ error: out.reason });
    const trail = await auditAction(audit, { at: out.candidate.reviewedAt, by: req.auth.uid, targetUid: out.candidate.id, action: 'update.reject', from: 'candidate', to: 'rejected', reason: reason.slice(0, 500) });
    return res.json({ ...out, auditRecorded: trail.recorded });
  });

  router.post('/candidates/:id/conflict', (req, res) => {
    const field = String(req.body?.field || '').trim();
    const detail = String(req.body?.detail || '').trim();
    if (!field || !detail) return res.status(400).json({ error: 'CONFLICT_DETAIL_REQUIRED' });
    const out = flagConflict(req.params.id, { field, detail });
    return res.status(out.ok ? 200 : 404).json(out.ok ? out : { error: out.reason });
  });

  /**
   * The only write-gate that matters for legal answers: an administrator identity taken
   * from the verified token, a candidate already in `verified` state, no open conflict.
   * Passing it records a decision — it does not inject scraped text anywhere.
   */
  router.post('/candidates/:id/publish', async (req, res) => {
    const out = publish({ candidateId: req.params.id, approvedBy: req.auth.uid, role: req.auth.role });
    if (!out.ok) {
      const status = out.reason === 'NOT_FOUND' ? 404 : 403;
      return res.status(status).json({ error: out.reason, ...('state' in out ? { state: out.state } : {}), ...('conflict' in out ? { conflict: out.conflict } : {}) });
    }
    const trail = await auditAction(audit, { at: out.candidate.publishedAt, by: req.auth.uid, targetUid: out.candidate.id, action: 'update.publish', from: 'verified', to: 'published', reason: out.effect });
    return res.json({ ...out, auditRecorded: trail.recorded });
  });

  /**
   * Multi-agent pass (§A). Read-only by construction: the run gets a fetcher, the registry,
   * the candidate list, a retriever and, if the caller supplied one, a command runner.
   * `applied` is always false in the response — an agent finding can open a candidate, it
   * cannot close one.
   */
  router.post('/agents/run', async (req, res) => {
    const limit = Math.min(8, Math.max(1, Number(req.body?.sources) || 3));
    const sources = loadSources().slice(0, limit);
    const candidates = loadCandidates().filter(c => c.state === 'candidate' || c.state === 'verified').slice(0, 10);
    const queries = (Array.isArray(req.body?.queries) ? req.body.queries : [
      { text: 'What is the punishment for cheque dishonour in Pakistan?', expectDocIds: [] },
      { text: 'HEC fee refund rules for semester admission', expectDocIds: [] }
    ]).slice(0, 8);
    const run = createQualityRun({
      fetcher, sources, candidates,
      records: (typeof records === 'function' ? records() : records) || [],
      retrieve: retrieve || null,
      queries,
      runCommand,
      reports: []
    }, { maxFindings: 60, maxSources: limit });
    const summary = await run.run();
    lastRun.at = new Date().toISOString();
    lastRun.summary = summary;
    const trail = await auditAction(audit, { at: lastRun.at, by: req.auth.uid, targetUid: 'quality-run', action: 'updates.agents-run', from: null, to: summary.status, reason: `${summary.counts.total} finding(s), applied=false` });
    return res.json({ ...summary, startedAt: lastRun.at, auditRecorded: trail.recorded });
  });

  router.get('/agents/latest', (_req, res) => res.json({ at: lastRun.at, summary: lastRun.summary }));

  router.get('/agents/contracts', (_req, res) => res.json({
    agents: AGENTS,
    order: ['research', 'sourceVerifier', 'legalVerifier', 'retrievalQuality', 'debugger', 'updateAgent'],
    independenceNote: 'Six declared steps in one process with one code path. They are not independent experts.'
  }));

  router.get('/health', (_req, res) => res.json({ ok: true, scheduler: describeScheduler(env) }));

  return router;
}
