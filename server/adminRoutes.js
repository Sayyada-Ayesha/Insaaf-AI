/**
 * server/adminRoutes.js — administrator provisioning, audit records and the
 * aggregate figures an admin dashboard needs.
 *
 * Why this file exists: `firestore.rules` decides "administrator" from the verified
 * ID-token claim `token.role`, and nothing in the repository wrote that claim. A role
 * could therefore only ever come from the `INSAaf_ADMIN_UIDS` environment allowlist,
 * which means a browser could never satisfy the rule. Provisioning here is the only
 * way a claim is set, and it is reachable only by a caller the token guards have
 * already accepted as an administrator.
 *
 * Deliberately absent: any route that reads private chat transcripts, message bodies
 * or raw user questions. The overview reports counts only.
 */
import express from 'express';
import { ROLES } from './authz.js';

export const ADMIN_AUDIT = 'adminAudit';

function idOk(id) {
  return /^[A-Za-z0-9_-]{6,128}$/.test(String(id));
}

function note(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function createAdminRouter({ authorizer, store, rateLimiters = {} }) {
  const router = express.Router();
  const admin = authorizer.requireRole('administrator');
  const write = rateLimiters.write || null;

  router.use(admin);

  /** The provisioning endpoint: writes the trusted claim, then the audit record. */
  router.patch('/users/:uid/role', ...(write ? [write] : []), async (req, res) => {
    const uid = String(req.params.uid || '');
    if (!idOk(uid)) return res.status(400).json({ error: 'BAD_UID', message: 'That user id is not usable.' });
    const role = String((req.body && req.body.role) || '').trim();
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'BAD_ROLE', message: 'Choose a listed role.', allowed: ROLES });
    }
    try {
      const before = await store.getAccount(uid);
      if (!before) return res.status(404).json({ error: 'NO_SUCH_USER', message: 'No account exists with that uid.' });
      const applied = await store.setRole(uid, role, note(req.body && req.body.reason));
      await store.addAudit({
        at: new Date().toISOString(),
        by: req.auth.uid,
        targetUid: uid,
        action: 'role.set',
        from: (before.customClaims && before.customClaims.role) || null,
        to: role,
        reason: note(req.body && req.body.reason) || null
      });
      return res.json({ target: uid, role, previous: applied.previous, audited: true });
    } catch {
      return res.status(503).json({ error: 'PROVISIONING_UNAVAILABLE', message: 'The role could not be written right now.' });
    }
  });

  /** Account standing for one user: role claim and disabled flag, nothing more. */
  router.get('/users/:uid', async (req, res) => {
    const uid = String(req.params.uid || '');
    if (!idOk(uid)) return res.status(400).json({ error: 'BAD_UID', message: 'That user id is not usable.' });
    try {
      const acct = await store.getAccount(uid);
      if (!acct) return res.status(404).json({ error: 'NO_SUCH_USER', message: 'No account exists with that uid.' });
      return res.json({
        uid,
        role: (acct.customClaims && acct.customClaims.role) || 'unassigned',
        disabled: Boolean(acct.disabled),
        emailProvided: Boolean(acct.email)
      });
    } catch {
      return res.status(503).json({ error: 'ACCOUNT_UNAVAILABLE', message: 'That account could not be read right now.' });
    }
  });

  /**
   * Manual moderation action. An account can be paused and reinstated, never
   * deleted from here — no path in this API removes a user's account, and a model
   * flag has no way to reach it without a human decision first.
   */
  router.patch('/users/:uid/status', ...(write ? [write] : []), async (req, res) => {
    const uid = String(req.params.uid || '');
    if (!idOk(uid)) return res.status(400).json({ error: 'BAD_UID', message: 'That user id is not usable.' });
    const disabled = req.body && req.body.disabled === true;
    if (uid === req.auth.uid && disabled) {
      return res.status(409).json({ error: 'SELF_LOCKOUT', message: 'You cannot pause the account you are signed in with.' });
    }
    try {
      const acct = await store.getAccount(uid);
      if (!acct) return res.status(404).json({ error: 'NO_SUCH_USER', message: 'No account exists with that uid.' });
      await store.setDisabled(uid, disabled);
      await store.addAudit({
        at: new Date().toISOString(),
        by: req.auth.uid,
        targetUid: uid,
        action: disabled ? 'account.pause' : 'account.reinstate',
        reason: note(req.body && req.body.reason) || null
      });
      return res.json({ target: uid, disabled, audited: true });
    } catch {
      return res.status(503).json({ error: 'ACCOUNT_UNAVAILABLE', message: 'That change could not be saved right now.' });
    }
  });

  /** Aggregate figures only — counts and statuses, never message content. */
  router.get('/overview', async (_req, res) => {
    try {
      return res.json(await store.overview());
    } catch {
      return res.status(503).json({ error: 'OVERVIEW_UNAVAILABLE', message: 'The dashboard figures could not be loaded right now.' });
    }
  });

  router.get('/audit', async (req, res) => {
    try {
      return res.json({ entries: await store.listAudits({ limit: Number(req.query.limit) || 50, targetUid: String(req.query.targetUid || '') }) });
    } catch {
      return res.status(503).json({ error: 'AUDIT_UNAVAILABLE', message: 'The audit history could not be loaded right now.' });
    }
  });

  /**
   * Bug reports and feedback submitted through the app. These are the only
   * free-text records an administrator may read here, because a user filed them
   * about the product with the explicit intent that a human read them.
   */
  router.get('/support-requests', async (req, res) => {
    try {
      return res.json({ requests: await store.listSupport({ status: String(req.query.status || ''), limit: Number(req.query.limit) || 50 }) });
    } catch {
      return res.status(503).json({ error: 'SUPPORT_UNAVAILABLE', message: 'The feedback queue could not be loaded right now.' });
    }
  });

  router.patch('/support-requests/:id', ...(write ? [write] : []), async (req, res) => {
    const id = String(req.params.id || '');
    if (!idOk(id)) return res.status(400).json({ error: 'BAD_ID', message: 'That request id is not usable.' });
    const status = String((req.body && req.body.status) || '').trim();
    const ALLOWED = ['triaged', 'in-progress', 'resolved', 'wont-fix'];
    if (!ALLOWED.includes(status)) return res.status(400).json({ error: 'BAD_STATUS', message: 'Choose a listed status.', allowed: ALLOWED });
    try {
      const updated = await store.patchSupport(id, {
        status,
        triageNote: note(req.body && req.body.note),
        triagedBy: req.auth.uid,
        triagedAt: new Date().toISOString()
      });
      await store.addAudit({
        at: new Date().toISOString(),
        by: req.auth.uid,
        targetUid: null,
        action: 'support.status',
        from: null,
        to: status,
        requestId: id,
        reason: note(req.body && req.body.note) || null
      });
      return res.json({ request: updated });
    } catch {
      return res.status(503).json({ error: 'SUPPORT_UNAVAILABLE', message: 'That update could not be saved right now.' });
    }
  });

  return router;
}

/* ------------------------------------------------------------------ *
 * Production services: Admin SDK for claims, Firestore for audit/counts.
 * ------------------------------------------------------------------ */

export function createAdminServices({
  admin,
  auditCollection = ADMIN_AUDIT,
  usersCollection = 'users',
  civicCollection = 'civicIssues',
  postsCollection = 'communityPosts',
  supportCollection = 'supportRequests',
  memberCollection = 'communityMembers'
}) {
  const db = () => admin.firestore();
  const col = name => db().collection(name);

  async function countByStatus(collection, field = 'status') {
    const snap = await col(collection).get();
    const by = {};
    for (const d of snap.docs) {
      const key = String((d.data() || {})[field] ?? 'unknown');
      by[key] = (by[key] || 0) + 1;
    }
    return { total: snap.size, by };
  }

  return {
    async getAccount(uid) {
      const acct = await admin.auth().getUser(String(uid));
      return { uid: acct.uid, email: acct.email || '', customClaims: acct.customClaims || {}, disabled: Boolean(acct.disabled) };
    },
    async setRole(uid, role, reason) {
      const before = await admin.auth().getUser(String(uid));
      const previous = (before.customClaims && before.customClaims.role) || null;
      await admin.auth().setCustomUserClaims(String(uid), { ...(before.customClaims || {}), role });
      return { previous, role, reason };
    },
    async setDisabled(uid, disabled) {
      await admin.auth().updateUser(String(uid), { disabled: Boolean(disabled) });
      return { disabled: Boolean(disabled) };
    },
    async addAudit(entry) {
      await col(auditCollection).add(entry);
      return entry;
    },
    async listAudits({ limit = 50, targetUid = '' }) {
      let q = col(auditCollection);
      if (targetUid) q = q.where('targetUid', '==', targetUid);
      const snap = await q.orderBy('at', 'desc').limit(Math.min(100, Math.max(1, Number(limit) || 50))).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async overview() {
      const [civic, community, support, memberProfiles, appProfiles] = await Promise.all([
        countByStatus(civicCollection),
        countByStatus(postsCollection),
        countByStatus(supportCollection),
        col(memberCollection).count().get().catch(() => null),
        col(usersCollection).count().get().catch(() => null)
      ]);
      const flagged = await col(postsCollection).where('status', '==', 'pending').count().get().catch(() => null);
      return {
        generatedAt: new Date().toISOString(),
        civicReports: civic,
        communityPosts: community,
        communityPendingReview: flagged ? flagged.data().count : null,
        supportRequests: support,
        memberProfileCount: memberProfiles ? memberProfiles.data().count : null,
        appProfileCount: appProfiles ? appProfiles.data().count : null,
        // Stated explicitly because it is true: this endpoint never reads chats,
        // messages, drafts or any private question text.
        privacy: { privateChatContentRead: false, rawQuestionTextRead: false, authUserListRead: false }
      };
    },
    async createSupport(record) {
      const ref = await col(supportCollection).add(record);
      return { id: ref.id, status: record.status, kind: record.kind };
    },
    async listSupport({ status, limit = 50 }) {
      let q = col(supportCollection);
      if (status) q = q.where('status', '==', status);
      const snap = await q.orderBy('createdAt', 'desc').limit(Math.min(100, Math.max(1, Number(limit) || 50))).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async patchSupport(id, patch) {
      const ref = col(supportCollection).doc(String(id));
      await ref.update(patch);
      const snap = await ref.get();
      return { id: snap.id, ...snap.data() };
    }
  };
}
