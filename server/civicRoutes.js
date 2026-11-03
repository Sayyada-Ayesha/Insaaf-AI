/**
 * server/civicRoutes.js — authorized Civic Issues API.
 *
 * The store is injected so the same routes run against Firestore in production
 * and against an in-memory store in the authorization tests. That is a test seam
 * for the *transport and guards*, not a substitute database for the product: the
 * only store wired into the running server is the Firestore one below.
 */
import express from 'express';
import { buildReport, applyTransition, canRead, TRANSITIONS } from './civicDomain.js';

export const CIVIC_COLLECTION = 'civicIssues';

export function createCivicRouter({ authorizer, store, rateLimiters = {} }) {
  const router = express.Router();
  const limit = rateLimiters.write || null;

  router.post('/reports', ...(limit ? [limit] : []), authorizer.requireSignedIn, async (req, res) => {
    try {
      const { report, errors } = buildReport(req.body, req.auth.uid);
      if (errors.length) return res.status(400).json({ error: 'INVALID_REPORT', errors });
      const saved = await store.create(report);
      return res.status(201).json({ id: saved.id, ref: saved.ref, status: saved.status, createdAt: saved.createdAt });
    } catch (err) {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'Reports could not be saved right now. Try again shortly.' });
    }
  });

  router.get('/reports/mine', authorizer.requireSignedIn, async (req, res) => {
    try {
      return res.json({ reports: await store.listByOwner(req.auth.uid) });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'Your reports could not be loaded right now.' });
    }
  });

  router.get('/reports/:id', authorizer.requireSignedIn, async (req, res) => {
    try {
      const found = await store.get(req.params.id);
      // 404 rather than 403: telling a caller that someone else's id exists is a leak.
      if (!canRead(req.auth, found)) return res.status(404).json({ error: 'NOT_FOUND', message: 'That report could not be found.' });
      return res.json({ report: found });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'That report could not be loaded right now.' });
    }
  });

  router.get('/admin/queue', authorizer.requireRole('administrator'), async (req, res) => {
    try {
      return res.json({
        queue: await store.listQueue({ status: String(req.query.status || ''), limit: Number(req.query.limit) || 50 }),
        transitions: TRANSITIONS
      });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'The review queue could not be loaded right now.' });
    }
  });

  router.patch('/admin/reports/:id/status', authorizer.requireRole('administrator'), async (req, res) => {
    try {
      const found = await store.get(req.params.id);
      const result = applyTransition(found, req.body && req.body.status, req.auth.uid, req.body && req.body.note);
      if (!result.ok) return res.status(result.status).json({ error: result.code, message: result.message, allowed: result.allowed });
      const updated = await store.applyPatch(req.params.id, result.patch, found.ownerUid);
      return res.json({ report: updated });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'That update could not be saved right now.' });
    }
  });

  router.get('/health', authorizer.requireSignedIn, (_req, res) => res.json({ authorized: true }));

  return router;
}

/** Production store: Firestore through the Admin SDK, so writes are server-side. */
export function createFirestoreStore({ admin, collection = CIVIC_COLLECTION, trackingPrefix = 'CIV' }) {
  const col = () => admin.firestore().collection(collection);

  function trackingRef(doc) {
    const stamp = String(doc.createdAt || '').replace(/\D/g, '').slice(0, 12);
    return `${trackingPrefix}-${stamp}-${String(doc.id || '').slice(-6).toUpperCase()}`;
  }

  return {
    async create(report) {
      const ref = col().doc();
      const withId = { ...report, id: ref.id };
      await ref.set(withId);
      const refCode = trackingRef(withId);
      await ref.update({ ref: refCode });
      return { ...withId, ref: refCode };
    },
    async get(id) {
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(String(id))) return null;
      const snap = await col().doc(String(id)).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },
    async listByOwner(uid) {
      const snap = await col().where('ownerUid', '==', uid).orderBy('createdAt', 'desc').limit(50).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async listQueue({ status, limit = 50 }) {
      const q = status ? col().where('status', '==', status) : col();
      const snap = await q.orderBy('createdAt', 'desc').limit(Math.min(100, Math.max(1, limit))).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async applyPatch(id, patch) {
      const ref = col().doc(String(id));
      await ref.update(patch);
      const snap = await ref.get();
      return { id: snap.id, ...snap.data() };
    }
  };
}
