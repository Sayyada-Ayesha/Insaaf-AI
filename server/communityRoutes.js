/**
 * server/communityRoutes.js — authenticated Community API.
 *
 * Same construction as `civicRoutes.js`: the store is injected so the transport and
 * the guards can be exercised over real HTTP against an in-memory store in tests,
 * while the only store wired into the running server is the Firestore one below.
 *
 * Authorization is entirely delegated to the verified-token guards in `authz.js`.
 * Nothing in this file reads a role, an owner uid or a status off the request body.
 */
import express from 'express';
import {
  buildPost, canViewPost, feedFilter, applyDecision, applyStrike, buildAppeal,
  buildReportEntry, memberStanding, POST_TRANSITIONS, POST_STATUSES, POST_KINDS,
  POST_CATEGORIES, PROVINCES, SUSPENSION_THRESHOLD
} from './communityDomain.js';

export const COMMUNITY_POSTS = 'communityPosts';
export const COMMUNITY_MEMBERS = 'communityMembers';

export function createCommunityRouter({ authorizer, store, rateLimiters = {} }) {
  const router = express.Router();
  const write = rateLimiters.write || null;
  const signedIn = authorizer.requireSignedIn;
  const admin = authorizer.requireRole('administrator');

  async function memberState(uid) {
    try { return await store.getMember(uid); } catch { return null; }
  }

  router.post('/posts', ...(write ? [write] : []), signedIn, async (req, res) => {
    try {
      const standing = memberStanding(await memberState(req.auth.uid));
      if (!standing.canPost) {
        return res.status(403).json({
          error: 'MEMBER_SUSPENDED',
          message: 'Posting is paused on this account after confirmed violations. An administrator can review it.',
          standing
        });
      }
      const { post, errors, warning } = buildPost(req.body, req.auth.uid);
      if (errors.length) return res.status(400).json({ error: 'INVALID_POST', errors });
      const saved = await store.create(post);
      return res.status(201).json({
        id: saved.id,
        status: saved.status,
        createdAt: saved.createdAt,
        reviewNote: warning,
        message: 'Your post is saved as pending. A moderator reviews new posts before members can see them.'
      });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'Posts could not be saved right now. Try again shortly.' });
    }
  });

  router.get('/feed', signedIn, async (req, res) => {
    try {
      const scope = feedFilter(req.auth);
      const posts = await store.listFeed({
        ...scope,
        kind: String(req.query.kind || ''),
        category: String(req.query.category || ''),
        province: String(req.query.province || ''),
        limit: Number(req.query.limit) || 30
      });
      return res.json({ posts, visibility: req.auth.role === 'administrator' ? 'all' : 'approved-only' });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'The community feed could not be loaded right now.' });
    }
  });

  router.get('/posts/mine', signedIn, async (req, res) => {
    try {
      const posts = await store.listByOwner(req.auth.uid);
      return res.json({ posts, standing: memberStanding(await memberState(req.auth.uid)) });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'Your posts could not be loaded right now.' });
    }
  });

  router.get('/me', signedIn, async (req, res) => {
    try {
      return res.json({ standing: memberStanding(await memberState(req.auth.uid)), threshold: SUSPENSION_THRESHOLD });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'Your account standing could not be loaded right now.' });
    }
  });

  /**
   * The choices the form is allowed to offer. Served from the domain lists rather than
   * duplicated in the client, so a topic added here appears in the UI and stays the
   * same list the POST /posts validator checks against.
   */
  router.get('/options', signedIn, (_req, res) => {
    res.json({
      kinds: POST_KINDS,
      categories: POST_CATEGORIES,
      statuses: POST_STATUSES,
      provinces: PROVINCES,
      suspensionThreshold: SUSPENSION_THRESHOLD
    });
  });

  router.get('/posts/:id', signedIn, async (req, res) => {
    try {
      const found = await store.get(req.params.id);
      // 404 rather than 403: a pending post belonging to someone else is not confirmed to exist.
      if (!canViewPost(req.auth, found)) return res.status(404).json({ error: 'NOT_FOUND', message: 'That post could not be found.' });
      return res.json({ post: found });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'That post could not be loaded right now.' });
    }
  });

  router.post('/posts/:id/report', ...(write ? [write] : []), signedIn, async (req, res) => {
    try {
      const found = await store.get(req.params.id);
      if (!canViewPost(req.auth, found)) return res.status(404).json({ error: 'NOT_FOUND', message: 'That post could not be found.' });
      const result = buildReportEntry(found, req.body, req.auth);
      if (!result.ok) return res.status(result.status).json({ error: result.code, message: result.message });
      const updated = await store.applyPatch(req.params.id, result.patch);
      return res.json({
        reportCount: (updated.reports || []).length,
        message: 'Reported to a moderator. A report is a request for review, not a decision, and nothing has been removed from this report alone.'
      });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'That report could not be saved right now.' });
    }
  });

  router.post('/posts/:id/appeal', ...(write ? [write] : []), signedIn, async (req, res) => {
    try {
      const found = await store.get(req.params.id);
      const result = buildAppeal(found, req.body, req.auth);
      if (!result.ok) return res.status(result.status).json({ error: result.code, message: result.message });
      const updated = await store.applyPatch(req.params.id, result.patch);
      return res.json({
        appeal: updated.appeal,
        message: 'Your appeal is recorded and put back in front of a moderator. It does not restore visibility by itself.'
      });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'That appeal could not be saved right now.' });
    }
  });

  router.get('/admin/queue', admin, async (req, res) => {
    try {
      return res.json({
        queue: await store.listQueue({ status: String(req.query.status || 'pending'), limit: Number(req.query.limit) || 50 }),
        statuses: POST_STATUSES,
        kinds: POST_KINDS,
        categories: POST_CATEGORIES,
        transitions: POST_TRANSITIONS,
        suspensionThreshold: SUSPENSION_THRESHOLD
      });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'The review queue could not be loaded right now.' });
    }
  });

  /**
   * The only place a strike can be born. `confirmViolation` arrives from the
   * administrator's action; the stored AI flag is read back into the audit entry
   * but is never consulted as permission to strike or to delete anything.
   */
  router.patch('/admin/posts/:id', admin, async (req, res) => {
    try {
      const found = await store.get(req.params.id);
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const result = applyDecision(found, {
        action: body.action,
        note: body.note,
        confirmViolation: body.confirmViolation,
        actorUid: req.auth.uid
      });
      if (!result.ok) return res.status(result.status).json({ error: result.code, message: result.message, allowed: result.allowed });
      const updated = await store.applyPatch(req.params.id, result.patch);

      const before = await memberState(found.ownerUid);
      const strike = applyStrike(before, {
        confirmed: result.confirmed,
        actorUid: req.auth.uid,
        postId: req.params.id,
        reason: body.note
      });
      if (strike.patch && Object.keys(strike.patch).length > 1) {
        await store.putMember(found.ownerUid, { ...strike.patch, uid: found.ownerUid });
      }
      return res.json({
        post: updated,
        violationConfirmed: result.confirmed,
        strike: strike.applied ? { violations: strike.violations, state: strike.state, notice: strike.notice } : { applied: false, message: strike.message },
        moderationNote: 'This decision was recorded with your uid and the time. The member may appeal it.'
      });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'That decision could not be saved right now.' });
    }
  });

  router.get('/admin/members/:uid', admin, async (req, res) => {
    try {
      const uid = String(req.params.uid || '');
      return res.json({
        standing: memberStanding(await memberState(uid)),
        posts: await store.listByOwner(uid)
      });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'That member could not be loaded right now.' });
    }
  });

  router.get('/health', signedIn, (_req, res) => res.json({ authorized: true }));

  return router;
}

/* ------------------------------------------------------------------ *
 * Production store — Firestore through the Admin SDK.
 * ------------------------------------------------------------------ */

function idOk(id) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(String(id));
}

export function createCommunityStore({
  admin,
  postsCollection = COMMUNITY_POSTS,
  membersCollection = COMMUNITY_MEMBERS
}) {
  const posts = () => admin.firestore().collection(postsCollection);
  const members = () => admin.firestore().collection(membersCollection);

  return {
    async create(post) {
      const ref = posts().doc();
      const saved = { ...post, id: ref.id };
      await ref.set(saved);
      return saved;
    },
    async get(id) {
      if (!idOk(id)) return null;
      const snap = await posts().doc(String(id)).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },
    async listFeed({ status, kind, category, province, limit = 30 }) {
      let q = posts();
      if (status) q = q.where('status', '==', status);
      const snap = await q.orderBy('createdAt', 'desc').limit(Math.min(100, Math.max(1, Number(limit) || 30))).get();
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Category/province filters are applied in-process so no composite index is
      // required for a launch-sized collection; the server still enforces them.
      if (kind) docs = docs.filter(p => p.kind === kind);
      if (category) docs = docs.filter(p => p.category === category);
      if (province) docs = docs.filter(p => p.province === province);
      return docs;
    },
    async listByOwner(uid) {
      const snap = await posts().where('ownerUid', '==', uid).orderBy('createdAt', 'desc').limit(50).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async listQueue({ status, limit = 50 }) {
      let q = posts();
      if (status) q = q.where('status', '==', status);
      const snap = await q.orderBy('createdAt', 'desc').limit(Math.min(100, Math.max(1, Number(limit) || 50))).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async applyPatch(id, patch) {
      const ref = posts().doc(String(id));
      await ref.update(patch);
      const snap = await ref.get();
      return { id: snap.id, ...snap.data() };
    },
    async getMember(uid) {
      if (!idOk(uid)) return null;
      const snap = await members().doc(String(uid)).get();
      return snap.exists ? { uid: snap.id, ...snap.data() } : null;
    },
    async putMember(uid, patch) {
      if (!idOk(uid)) throw new Error('bad member uid');
      const ref = members().doc(String(uid));
      await ref.set(patch, { merge: true });
      const snap = await ref.get();
      return { uid: snap.id, ...snap.data() };
    }
  };
}
