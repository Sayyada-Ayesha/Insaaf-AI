/**
 * tests/unit/testCommunityAuthz.cjs — authorization, ownership, visibility and
 * moderation-strike behaviour of the Community API, plus administrator provisioning
 * on the Admin API, exercised over real HTTP.
 *
 * Token verification and persistence are injected; the guard chain, the domain rules
 * and the route handlers under test are the production ones. Every refusal expected
 * here IS the security behaviour, so an unauthorized call that returns 200 is a FAIL
 * rather than a pass — nothing in this file trades a denial for a green line.
 */
const express = require('express');
const http = require('http');
const fs = require('fs');

const results = [];
function ok(cond, name, detail) {
  results.push({ pass: !!cond, name, detail: cond ? '' : (detail === undefined ? '' : String(detail)) });
}

function inMemoryStore() {
  const docs = new Map();
  const members = new Map();
  let n = 0;
  const id = () => `post${++n}000000`;
  const applyFilters = (list, { kind, category, province }) => list
    .filter(p => !kind || p.kind === kind)
    .filter(p => !category || p.category === category)
    .filter(p => !province || p.province === province);
  return {
    docs, members,
    async create(post) { const _id = id(); const saved = { ...post, id: _id }; docs.set(_id, saved); return saved; },
    async get(_id) { return docs.get(String(_id)) || null; },
    async listFeed(f) { const all = [...docs.values()].filter(d => !f.status || d.status === f.status); return applyFilters(all, f); },
    async listByOwner(uid) { return [...docs.values()].filter(d => d.ownerUid === uid); },
    async listQueue({ status, limit }) { const all = [...docs.values()]; return (status ? all.filter(d => d.status === status) : all).slice(0, limit || 50); },
    async applyPatch(_id, patch) { const next = { ...docs.get(_id), ...patch }; docs.set(_id, next); return next; },
    async getMember(uid) { return members.get(String(uid)) || null; },
    async putMember(uid, patch) { const next = { ...(members.get(String(uid)) || {}), ...patch, uid: String(uid) }; members.set(String(uid), next); return next; }
  };
}

function fakeAdminStore() {
  const accounts = new Map([
    ['uid-admin-1', { uid: 'uid-admin-1', email: 'admin@example.invalid', customClaims: { role: 'administrator' }, disabled: false }],
    ['uid-citizen-a', { uid: 'uid-citizen-a', email: '', customClaims: {}, disabled: false }],
    ['uid-no-role', { uid: 'uid-no-role', email: '', customClaims: {}, disabled: false }]
  ]);
  const audits = [];
  const posts = new Map([['post1000000', { id: 'post1000000', status: 'pending', message: 'kept private' }]]);
  return {
    accounts, audits, posts,
    async getAccount(uid) { return accounts.get(String(uid)) || null; },
    async setRole(uid, role) {
      const acct = accounts.get(String(uid));
      const previous = (acct.customClaims && acct.customClaims.role) || null;
      acct.customClaims = { ...acct.customClaims, role };
      return { previous, role };
    },
    async setDisabled(uid, disabled) { accounts.get(String(uid)).disabled = disabled; return { disabled }; },
    async addAudit(entry) { audits.push(entry); return entry; },
    async listAudits({ limit = 50, targetUid = '' }) {
      return (targetUid ? audits.filter(a => a.targetUid === targetUid) : audits).slice(0, limit);
    },
    async overview() {
      return {
        generatedAt: new Date().toISOString(),
        civicReports: { total: 3, by: { SUBMITTED: 2, CLOSED: 1 } },
        communityPosts: { total: 1, by: { pending: 1 } },
        communityPendingReview: 1,
        supportRequests: { total: 2, by: { new: 2 } },
        memberProfileCount: 2,
        appProfileCount: 3,
        privacy: { privateChatContentRead: false, rawQuestionTextRead: false, authUserListRead: false }
      };
    },
    async listSupport() { return [...posts.values()]; },
    async patchSupport(id, patch) { const next = { ...posts.get(id), ...patch }; posts.set(id, next); return next; }
  };
}

function makeVerifier(tokens) {
  return {
    isConfigured: () => makeVerifier.configured !== false,
    verifyIdToken: (token) => {
      const payload = tokens[token];
      if (!payload) return Promise.reject(Object.assign(new Error('invalid'), { code: 'auth/id-token-expired' }));
      return Promise.resolve(payload);
    }
  };
}

async function main() {
  const { createAuthorizer } = await import('../../server/authz.js');
  const { createCommunityRouter } = await import('../../server/communityRoutes.js');
  const { createAdminRouter } = await import('../../server/adminRoutes.js');
  const { screenPost, applyStrike, POST_TRANSITIONS, SUSPENSION_THRESHOLD } = await import('../../server/communityDomain.js');

  const TOKENS = {
    'tok-member': { sub: 'uid-citizen-a', role: 'student', email: 'a@example.invalid' },
    'tok-lawyer': { sub: 'uid-lawyer-1', role: 'lawyer' },
    'tok-admin': { sub: 'uid-admin-1', role: 'administrator' },
    'tok-other': { sub: 'uid-citizen-b', role: 'student' },
    'tok-noclaim': { sub: 'uid-no-role' },
    'tok-spoof': { sub: 'uid-citizen-c', role: 'student' }
  };
  const store = inMemoryStore();
  const adminStore = fakeAdminStore();
  const authorizer = createAuthorizer(makeVerifier(TOKENS));

  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/community', createCommunityRouter({ authorizer, store }));
  app.use('/api/admin', createAdminRouter({ authorizer, store: adminStore }));
  const server = await new Promise(resolve => {
    const s = http.createServer(app).listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { token, body } = {}) => {
    const sendBody = body && method !== 'GET' && method !== 'HEAD';
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: sendBody ? JSON.stringify(body) : undefined
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, json };
  };
  const post = (over = {}) => ({
    kind: 'discussion',
    category: 'students',
    title: 'Fee refund after a withdrawn semester',
    body: 'My semester was withdrawn in July and the portal still shows the fee as due. What does the notice board procedure say about the refund window?',
    province: 'Punjab',
    district: 'Lahore',
    ...over
  });

  // ---- A. refusal by default ----
  const anonFeed = await call('GET', '/api/community/feed');
  ok(anonFeed.status === 401 && anonFeed.json.error === 'UNAUTHENTICATED', 'A.1 an anonymous visitor cannot browse the community at all', JSON.stringify(anonFeed));
  const anonPost = await call('POST', '/api/community/posts', { body: post() });
  ok(anonPost.status === 401, 'A.2 an anonymous visitor cannot post', JSON.stringify(anonPost));
  const junk = await call('POST', '/api/community/posts', { token: 'tok-not-a-session', body: post() });
  ok(junk.status === 401 && junk.json.error === 'INVALID_TOKEN', 'A.3 a token the server cannot verify is refused', JSON.stringify(junk));
  const adminQueueAnon = await call('GET', '/api/community/admin/queue');
  ok(adminQueueAnon.status === 401, 'A.4 the moderation queue is not readable without a session', JSON.stringify(adminQueueAnon));

  makeVerifier.configured = false;
  const unconf = await call('POST', '/api/community/posts', { token: 'tok-member', body: post() });
  ok(unconf.status === 503 && unconf.json.error === 'AUTH_NOT_CONFIGURED',
    'A.5 with no verification backend a post is refused outright — never silently accepted', JSON.stringify(unconf));
  const unconfAdmin = await call('GET', '/api/admin/overview', { token: 'tok-admin' });
  ok(unconfAdmin.status === 503, 'A.6 the admin surface is closed too while verification is unavailable', JSON.stringify(unconfAdmin));
  makeVerifier.configured = true;

  const optionsAnon = await call('GET', '/api/community/options');
  ok(optionsAnon.status === 401 && optionsAnon.json.error === 'UNAUTHENTICATED',
    'A.7 the post-choices list is not readable without a session', JSON.stringify(optionsAnon));
  const domain = require('../../server/communityDomain.js');
  const optionsMember = await call('GET', '/api/community/options', { token: 'tok-member' });
  const om = optionsMember.json || {};
  ok(optionsMember.status === 200
    && JSON.stringify(om.kinds) === JSON.stringify(domain.POST_KINDS)
    && JSON.stringify(om.categories) === JSON.stringify(domain.POST_CATEGORIES)
    && JSON.stringify(om.provinces) === JSON.stringify(domain.PROVINCES)
    && om.suspensionThreshold === domain.SUSPENSION_THRESHOLD,
    'A.8 the form choices come straight from the domain rules, so no list can drift', JSON.stringify(om).slice(0, 300));

  // ---- B. a new post is pending, owned by the token subject ----
  const filed = await call('POST', '/api/community/posts', {
    token: 'tok-member',
    body: { ...post(), ownerUid: 'uid-admin-1', status: 'approved', role: 'administrator', violations: 9, createdAt: '1999-01-01T00:00:00.000Z' }
  });
  ok(filed.status === 201, 'B.1 a signed-in member can post', JSON.stringify(filed));
  const id = filed.json && filed.json.id;
  const stored = store.docs.get(id) || {};
  ok(stored.status === 'pending', 'B.2 a new post is pending, whatever the body claimed', stored.status);
  ok(stored.ownerUid === 'uid-citizen-a', 'B.3 the owner is the verified token subject, never the body', stored.ownerUid);
  ok(String(stored.createdAt).slice(0, 4) !== '1999', 'B.4 the server sets the timestamp', stored.createdAt);
  ok(!('role' in stored) && !('violations' in stored), 'B.5 a role or a violation count sent in the body is not persisted', JSON.stringify(Object.keys(stored)));
  ok(filed.json.message && /pending/i.test(filed.json.message), 'B.6 the member is told plainly that a moderator reviews first', JSON.stringify(filed.json.message));

  // ---- C. visibility of pending vs approved ----
  const feedMember = await call('GET', '/api/community/feed', { token: 'tok-other' });
  ok(feedMember.status === 200 && feedMember.json.posts.every(p => p.status === 'approved'),
    'C.1 the member feed contains no pending post', JSON.stringify(feedMember.json.posts.map(p => p.status)));
  const peek = await call('GET', `/api/community/posts/${id}`, { token: 'tok-other' });
  ok(peek.status === 404, 'C.2 another member cannot read a pending post, and is not told it exists', JSON.stringify(peek));
  const mine = await call('GET', '/api/community/posts/mine', { token: 'tok-member' });
  ok(mine.status === 200 && mine.json.posts.length === 1 && mine.json.posts[0].status === 'pending',
    'C.3 the author always sees their own pending post', JSON.stringify(mine.json.posts && mine.json.posts.length));
  const adminQueue = await call('GET', '/api/community/admin/queue', { token: 'tok-admin' });
  ok(adminQueue.status === 200 && adminQueue.json.queue.length === 1 && adminQueue.json.queue[0].id === id,
    'C.4 the administrator sees the pending post in the review queue', JSON.stringify(adminQueue.json && adminQueue.json.queue && adminQueue.json.queue.length));
  ok(adminQueue.json && Array.isArray(adminQueue.json.transitions.pending) && adminQueue.json.transitions.pending.includes('approved'),
    'C.5 the queue tells the reviewer which decisions are actually allowed', JSON.stringify(adminQueue.json && adminQueue.json.transitions));

  // ---- D. privileged routes need the verified claim ----
  const spoof = await call('GET', '/api/community/admin/queue?role=administrator', { token: 'tok-spoof', body: { role: 'administrator' } });
  ok(spoof.status === 403 && spoof.json.error === 'FORBIDDEN', 'D.1 a student claim stays a student even when the body claims administrator', JSON.stringify(spoof));
  ok((await call('GET', '/api/community/admin/queue', { token: 'tok-lawyer' })).status === 403, 'D.2 a lawyer is not an administrator');
  ok((await call('GET', '/api/community/admin/queue', { token: 'tok-noclaim' })).status === 403, 'D.3 a signed-in user with no role claim gets no moderation power');
  ok((await call('PATCH', `/api/community/admin/posts/${id}`, { token: 'tok-member', body: { action: 'approve' } })).status === 403, 'D.4 a member cannot approve their own post');

  // ---- E. advisory flags are not verdicts ----
  const leaky = await call('POST', '/api/community/posts', {
    token: 'tok-other',
    body: post({ title: 'Contact this person directly', body: 'His CNIC is 35202-1234567-1 and his number is 0300-1234567, please share it with anyone who asks.' })
  });
  const leakyDoc = store.docs.get(leaky.json.id) || {};
  ok(leaky.status === 201 && leakyDoc.status === 'pending',
    'E.1 a flagged post is still only pending — a flag never rejects or removes anything by itself', JSON.stringify([leaky.status, leakyDoc.status]));
  ok(leakyDoc.aiFlag && leakyDoc.aiFlag.conclusive === false && leakyDoc.aiFlag.groups.includes('personal-data'),
    'E.2 the flag is recorded as a non-conclusive signal naming what it saw', JSON.stringify(leakyDoc.aiFlag && leakyDoc.aiFlag.groups));
  ok(leaky.json.reviewNote && /human reviewer/i.test(leaky.json.reviewNote) && /no violation has been recorded against you/i.test(leaky.json.reviewNote),
    'E.3 the member is warned respectfully and explicitly told no violation was recorded', JSON.stringify(leaky.json.reviewNote));
  ok(screenPost('Buy now! Click here https://a.test https://b.test https://c.test', 'deal').groups.includes('spam'),
    'E.4 spam signal detection fires on its own');
  ok(screenPost('I asked about my tenancy deposit and the landlord replied politely last week, no links, plain text only.').conclusive === false,
    'E.5 an ordinary genuine post is reported as non-conclusive, never as clean by authority', JSON.stringify(screenPost('I asked about my tenancy deposit and the landlord replied politely last week, no links, plain text only.')));
  ok(screenPost('I asked about my tenancy deposit and the landlord replied politely last week, no links, plain text only.').groups.length === 0,
    'E.6 a genuine civic question carries no flag at all');

  // ---- F. decisions, audit and strikes ----
  const badAction = await call('PATCH', `/api/community/admin/posts/${id}`, { token: 'tok-admin', body: { action: 'delete' } });
  ok(badAction.status === 400 && badAction.json.error === 'BAD_ACTION', 'F.1 an unknown admin action is refused — there is no delete action', JSON.stringify(badAction));
  ok(badAction.json && badAction.json.allowed.includes('approve'), 'F.2 the refusal lists the actions that exist', JSON.stringify(badAction.json && badAction.json.allowed));
  const tooEarly = await call('PATCH', `/api/community/admin/posts/${id}`, { token: 'tok-admin', body: { action: 'remove', confirmViolation: true } });
  ok(tooEarly.status === 409 && tooEarly.json.error === 'INVALID_TRANSITION', 'F.3 a pending post cannot be jumped straight to removed', JSON.stringify(tooEarly));
  const approve = await call('PATCH', `/api/community/admin/posts/${id}`, { token: 'tok-admin', body: { action: 'approve', note: 'On topic, no personal data.' } });
  ok(approve.status === 200 && approve.json.post.status === 'approved', 'F.4 a valid approve decision is applied', JSON.stringify(approve.status));
  ok(approve.json.violationConfirmed === false && approve.json.strike.applied === false,
    'F.5 approving a post records no strike, even though a flag was attached to it', JSON.stringify(approve.json.strike));
  const audit = (approve.json.post && approve.json.post.audit) || [];
  const lastEntry = audit[audit.length - 1] || {};
  ok(lastEntry.by === 'uid-admin-1' && lastEntry.from === 'pending' && lastEntry.to === 'approved' && !!lastEntry.at && lastEntry.actor === 'administrator',
    'F.6 the audit entry records actor, previous state, new state and time', JSON.stringify(lastEntry));
  ok(audit.length === 2, 'F.7 both the submission and the decision are kept', audit.length);

  const feedAfter = await call('GET', '/api/community/feed', { token: 'tok-other' });
  ok(feedAfter.status === 200 && feedAfter.json.posts.some(p => p.id === id), 'F.8 an approved post is visible to authenticated members');
  const nowVisible = await call('GET', `/api/community/posts/${id}`, { token: 'tok-other' });
  ok(nowVisible.status === 200, 'F.9 any member can read an approved post directly', JSON.stringify(nowVisible.status));

  // three confirmed violations on the flagged post's author (uid-citizen-b)
  const leakyId = leaky.json.id;
  const reject1 = await call('PATCH', `/api/community/admin/posts/${leakyId}`, { token: 'tok-admin', body: { action: 'reject', note: 'Shares another person\u2019s CNIC.', confirmViolation: true } });
  ok(reject1.status === 200 && reject1.json.violationConfirmed === true && reject1.json.strike.violations === 1 && reject1.json.strike.state === 'warned',
    'F.10 a confirmed violation is strike one and a warning, not a penalty', JSON.stringify(reject1.json.strike));
  const unconfirmed = await call('PATCH', `/api/community/admin/posts/${leakyId}`, { token: 'tok-admin', body: { action: 'approve' } });
  ok(unconfirmed.status === 200 && unconfirmed.json.strike.applied === false,
    'F.11 a reversal without confirmation adds no strike', JSON.stringify(unconfirmed.json.strike));
  await call('PATCH', `/api/community/admin/posts/${leakyId}`, { token: 'tok-admin', body: { action: 'remove', confirmViolation: true } });
  const thirdPost = await call('POST', '/api/community/posts', {
    token: 'tok-other',
    body: post({ title: 'Personal data again', body: 'Here is her number: 0321-7654321 and her email someone@example.invalid, message her for the settlement.' })
  });
  const third = await call('PATCH', `/api/community/admin/posts/${thirdPost.json.id}`, { token: 'tok-admin', body: { action: 'reject', note: 'Personal data a second time.', confirmViolation: true } });
  ok(third.json.strike.violations === 3 && third.json.strike.state === 'suspended',
    'F.12 the third confirmed violation enforces the configured suspension', JSON.stringify(third.json.strike));
  const blocked = await call('POST', '/api/community/posts', { token: 'tok-other', body: post() });
  ok(blocked.status === 403 && blocked.json.error === 'MEMBER_SUSPENDED',
    'F.13 a suspended member cannot post again', JSON.stringify(blocked));
  ok(blocked.json.standing && blocked.json.standing.canPost === false,
    'F.14 the suspension is explained to the member with their own standing', JSON.stringify(blocked.json.standing));
  const standing = await call('GET', '/api/community/me', { token: 'tok-other' });
  ok(standing.status === 200 && standing.json.standing.state === 'suspended' && standing.json.standing.violations === 3,
    'F.15 a member can read their own standing', JSON.stringify(standing.json.standing));
  const otherStanding = await call('GET', '/api/community/admin/members/uid-citizen-b', { token: 'tok-member' });
  ok(otherStanding.status === 403, 'F.16 a member cannot read another member\u2019s moderation record');
  ok(SUSPENSION_THRESHOLD === 3 && applyStrike({ violations: 2 }, { confirmed: false, actorUid: 'x' }).applied === false,
    'F.17 the threshold is a constant and an unconfirmed call cannot strike', JSON.stringify(Object.keys(POST_TRANSITIONS)));

  // ---- G. appeal ----
  const appealEarly = await call('POST', `/api/community/posts/${id}/appeal`, { token: 'tok-member', body: { note: 'I think this was misread.' } });
  ok(appealEarly.status === 409 && appealEarly.json.error === 'NO_DECISION_TO_APPEAL', 'G.1 an approved post has nothing to appeal', JSON.stringify(appealEarly));
  const appealByStranger = await call('POST', `/api/community/posts/${leakyId}/appeal`, { token: 'tok-noclaim', body: { note: 'Not mine but I object.' } });
  ok(appealByStranger.status === 404, 'G.2 only the author can appeal a decision on their post (and the id is not confirmed)', JSON.stringify(appealByStranger));
  const appeal = await call('POST', `/api/community/posts/${leakyId}/appeal`, { token: 'tok-other', body: { note: 'The CNIC is my own, given for a fee dispute.' } });
  ok(appeal.status === 200 && appeal.json.appeal && appeal.json.appeal.status === 'open',
    'G.3 the author can put a decision back in front of a moderator', JSON.stringify(appeal.json));
  const stillRemoved = await call('GET', `/api/community/posts/${leakyId}`, { token: 'tok-other' });
  ok(stillRemoved.json.post.status !== 'approved', 'G.4 an appeal does not restore visibility by itself', JSON.stringify(stillRemoved.json.post && stillRemoved.json.post.status));
  const reinstated = await call('PATCH', `/api/community/admin/posts/${leakyId}`, { token: 'tok-admin', body: { action: 'approve', note: 'Appeal accepted: own data, redacted.' } });
  ok(reinstated.status === 200 && reinstated.json.post.status === 'approved' && reinstated.json.post.appeal === null,
    'G.5 an accepted appeal closes the open appeal and is itself audited', JSON.stringify(reinstated.json.post.appeal));
  const memberAudits = (reinstated.json.post.audit || []).filter(a => a.appeal);
  ok(memberAudits.length === 1 && memberAudits[0].actor === 'member', 'G.6 the appeal request is recorded as a member action', JSON.stringify(memberAudits.length));

  // ---- H. member reports are requests, not takedowns ----
  const reported = await call('POST', `/api/community/posts/${id}/report`, { token: 'tok-other', body: { reason: 'personal-data', note: 'Contains a phone number.' } });
  ok(reported.status === 200 && reported.json.reportCount === 1, 'H.1 a member can report an approved post', JSON.stringify(reported));
  const afterReport = await call('GET', `/api/community/posts/${id}`, { token: 'tok-admin' });
  ok(afterReport.json.post.status === 'approved', 'H.2 a report alone does not remove the post', JSON.stringify(afterReport.json.post.status));
  const selfReport = await call('POST', `/api/community/posts/${id}/report`, { token: 'tok-member', body: { reason: 'other' } });
  ok(selfReport.status === 409 && selfReport.json.error === 'SELF_REPORT', 'H.3 reporting your own post is refused rather than counted', JSON.stringify(selfReport));

  // ---- I. validation ----
  const badKind = await call('POST', '/api/community/posts', { token: 'tok-member', body: post({ kind: 'advertisement', category: 'not-a-topic' }) });
  ok(badKind.status === 400 && badKind.json.errors.length >= 2, 'I.1 an unknown kind or topic is refused with per-field reasons', JSON.stringify(badKind.json && badKind.json.errors));
  const short = await call('POST', '/api/community/posts', { token: 'tok-member', body: post({ body: 'too short' }) });
  ok(short.status === 400 && short.json.errors.some(e => e.field === 'body'), 'I.2 a one-word post cannot be filed', JSON.stringify(short.json && short.json.errors));
  const civicNoLoc = await call('POST', '/api/community/posts', { token: 'tok-member', body: post({ kind: 'civic', location: '' }) });
  ok(civicNoLoc.status === 400 && civicNoLoc.json.errors.some(e => e.field === 'location'), 'I.3 a civic post without a place is refused', JSON.stringify(civicNoLoc.json && civicNoLoc.json.errors));
  const huge = await call('POST', '/api/community/posts', { token: 'tok-member', body: post({ body: 'x'.repeat(2200) }) });
  ok(huge.status === 400 && huge.json.errors.some(e => e.code === 'BODY_TOO_LONG'), 'I.4 an over-long post is refused instead of silently truncated', JSON.stringify(huge.json && huge.json.errors));

  // ---- J. photos stay on the device ----
  const withPhoto = await call('POST', '/api/community/posts', { token: 'tok-member', body: post({ photos: [{ name: 'notice.jpg', type: 'image/jpeg', bytes: 20480, dataUrl: 'data:image/jpeg,' + 'A'.repeat(100000) }] }) });
  const photoStored = (store.docs.get(withPhoto.json.id) || {}).photos || [];
  ok(withPhoto.status === 201 && photoStored.length === 1 && photoStored[0].held === 'device' && !JSON.stringify(photoStored).includes('data:image'),
    'J.1 only photo metadata is stored — a private photograph is not copied into the database', JSON.stringify(photoStored));

  // ---- K. administrator provisioning + audit ----
  ok((await call('PATCH', '/api/admin/users/uid-no-role/role', { token: 'tok-member', body: { role: 'administrator' } })).status === 403,
    'K.1 a student cannot make themselves an administrator');
  ok((await call('GET', '/api/admin/overview', { token: 'tok-lawyer' })).status === 403, 'K.2 a lawyer cannot read the admin dashboard figures');
  ok((await call('GET', '/api/admin/audit', { token: 'tok-noclaim' })).status === 403, 'K.3 a signed-in user with no role claim cannot read the audit history');
  const grant = await call('PATCH', '/api/admin/users/uid-no-role/role', { token: 'tok-admin', body: { role: 'administrator', reason: 'Promoted after the moderation rota change.' } });
  ok(grant.status === 200 && grant.json.previous === null && grant.json.audited === true,
    'K.4 an administrator can write the trusted role claim', JSON.stringify(grant));
  ok(adminStore.accounts.get('uid-no-role').customClaims.role === 'administrator',
    'K.5 the claim is on the Auth record, which is what firestore.rules reads', JSON.stringify(adminStore.accounts.get('uid-no-role').customClaims));
  const grantAudit = adminStore.audits[adminStore.audits.length - 1] || {};
  ok(grantAudit.by === 'uid-admin-1' && grantAudit.targetUid === 'uid-no-role' && grantAudit.to === 'administrator' && !!grantAudit.at,
    'K.6 the provisioning is auditable: who, whom, from what to what, when', JSON.stringify(grantAudit));
  ok((await call('PATCH', '/api/admin/users/uid-no-role/role', { token: 'tok-admin', body: { role: 'superuser' } })).status === 400, 'K.7 an unknown role cannot be provisioned');
  ok((await call('PATCH', '/api/admin/users/uid-does-not-exist/role', { token: 'tok-admin', body: { role: 'lawyer' } })).status === 404, 'K.8 a role cannot be set on an account that does not exist');
  const selfLock = await call('PATCH', '/api/admin/users/uid-admin-1/status', { token: 'tok-admin', body: { disabled: true } });
  ok(selfLock.status === 409 && selfLock.json.error === 'SELF_LOCKOUT', 'K.9 an administrator cannot pause the account they are using', JSON.stringify(selfLock));
  const pause = await call('PATCH', '/api/admin/users/uid-citizen-a/status', { token: 'tok-admin', body: { disabled: true, reason: 'Three confirmed violations.' } });
  ok(pause.status === 200 && adminStore.accounts.get('uid-citizen-a').disabled === true, 'K.10 an account can be paused by decision');
  ok(adminStore.audits.some(a => a.action === 'account.pause' && a.by === 'uid-admin-1'), 'K.11 the pause is in the audit trail');
  ok(!adminStore.audits.some(a => /delete/i.test(String(a.action))), 'K.12 nothing in this API deletes an account — no delete action was ever recorded', JSON.stringify(adminStore.audits.map(a => a.action)));
  const overview = await call('GET', '/api/admin/overview', { token: 'tok-admin' });
  ok(overview.status === 200 && overview.json.civicReports.total === 3 && overview.json.communityPosts.by.pending === 1,
    'K.13 the dashboard gets aggregate counts for reports, posts and feedback', JSON.stringify(overview.json && overview.json.communityPosts));
  ok(overview.json.privacy.privateChatContentRead === false && overview.json.privacy.rawQuestionTextRead === false,
    'K.14 the overview states on its response that no private chat or question content was read', JSON.stringify(overview.json.privacy));
  const triage = await call('PATCH', '/api/admin/support-requests/post1000000', { token: 'tok-admin', body: { status: 'triaged', note: 'Reproduced.' } });
  ok(triage.status === 200 && triage.json.request.status === 'triaged' && triage.json.request.triagedBy === 'uid-admin-1',
    'K.15 a submitted bug report can be triaged with the triaging administrator recorded', JSON.stringify(triage.json));
  ok(adminStore.audits.some(a => a.action === 'support.status'), 'K.16 the triage is audited too');

  // ---- L. firestore.rules agrees with the server ----
  const rules = fs.readFileSync('./firestore.rules', 'utf8');
  const postsBlock = (rules.match(/match \/communityPosts\/\{postId\}\s*\{[\s\S]*?\n    \}/) || [''])[0];
  ok(/allow read: if isSignedIn\(\)/.test(postsBlock) && postsBlock.includes("resource.data.status == 'approved'"),
    'L.1 rules expose only approved community posts to a signed-in member, plus the author and the administrator', postsBlock.trim());
  ok(postsBlock.includes('allow create, update, delete: if false;'),
    'L.2 no browser can write a community post or move it out of pending', postsBlock.trim());
  const membersBlock = (rules.match(/match \/communityMembers\/\{memberId\}\s*\{[\s\S]*?\n    \}/) || [''])[0];
  ok(membersBlock.includes('allow read: if isOwner(memberId) || isAdministrator();') && membersBlock.includes('allow create, update, delete: if false;'),
    'L.3 strike state is readable by its owner and an administrator only, and writable by neither', membersBlock.trim());
  const auditBlock = (rules.match(/match \/adminAudit\/\{auditId\}\s*\{[\s\S]*?\n    \}/) || [''])[0];
  ok(auditBlock.includes('allow read: if isAdministrator();') && auditBlock.includes('allow create, update, delete: if false;'),
    'L.4 the audit trail is append-only from the server and readable only by an administrator', auditBlock.trim());
  ok(rules.trim().startsWith("rules_version = '2';") && /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/.test(rules),
    'L.5 default deny is still in place for every collection these routes do not name', '');
  ok(/function isAdministrator\(\)[\s\S]*request\.auth\.token\.role == 'administrator'/.test(rules),
    'L.6 the administrator test reads the verified token claim that provisioning now actually writes', '');

  // ---- M. private question text is not retained in server caches ----
  const serverSrc = fs.readFileSync('./server/index.js', 'utf8');
  const rawKey = /const (?:cacheKey|ragCacheKey) = `[^`]*(?:userQuery|message)\.trim\(\)/;
  ok(!rawKey.test(serverSrc),
    'M.1 no answer or retrieval cache is keyed by the raw question text any more', (serverSrc.match(rawKey) || [''])[0].slice(0, 120));
  ok(/function cacheKeyFor\(/.test(serverSrc) && /crypto\.createHash\('sha256'\)/.test(serverSrc) && /CACHE_PEPPER/.test(serverSrc),
    'M.2 the cache key is a salted digest computed in one place');
  const logged = serverSrc.match(/console\.\w+\([^)]*userQuery[^)]*\)/g) || [];
  ok(logged.length === 0,
    'M.3 the server never logs a question body', logged.join(' | '));

  server.close();
  const pass = results.filter(r => r.pass).length;
  const fail = results.length - pass;
  console.log(`\n==== COMMUNITY + MODERATION + ADMIN PROVISIONING: ${pass} PASS / ${fail} FAIL (of ${results.length}) ====`);
  results.filter(r => !r.pass).forEach(r => console.log('  x ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => { console.error('\n SUITE CRASHED:\n', err); process.exit(2); });
