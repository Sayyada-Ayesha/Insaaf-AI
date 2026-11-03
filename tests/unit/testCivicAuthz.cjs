/**
 * tests/unit/testCivicAuthz.cjs — authorization, ownership and status-transition
 * behaviour of the Civic Issues API, exercised over real HTTP.
 *
 * The verifier and the store are injected. That is deliberate: it lets a request
 * carrying a claimed role of "administrator" be met by the same guard chain the
 * server uses, so a hole in the guard shows up as a FAIL here rather than as a
 * production incident. Nothing in this file replaces a check with a pass — the
 * expected outcome of an unauthorized call is the refusal itself.
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
  let n = 0;
  const id = () => `issue${++n}000000`;
  return {
    docs,
    async create(report) { const _id = id(); const saved = { ...report, id: _id, ref: `CIV-${_id}` }; docs.set(_id, saved); return saved; },
    async get(_id) { return docs.get(String(_id)) || null; },
    async listByOwner(uid) { return [...docs.values()].filter(d => d.ownerUid === uid); },
    async listQueue({ status, limit }) { const all = [...docs.values()]; return (status ? all.filter(d => d.status === status) : all).slice(0, limit || 50); },
    async applyPatch(_id, patch) { const next = { ...docs.get(_id), ...patch }; docs.set(_id, next); return next; }
  };
}

/** Tokens are strings here; the map is the stand-in for Firebase's own verification. */
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
  const { createCivicRouter } = await import('../../server/civicRoutes.js');
  const { canTransition, TRANSITIONS, CIVIC_STATUSES, buildReport } = await import('../../server/civicDomain.js');

  const TOKENS = {
    'tok-citizen': { sub: 'uid-citizen-a', role: 'student', email: 'a@example.invalid' },
    'tok-lawyer': { sub: 'uid-lawyer-1', role: 'lawyer' },
    'tok-admin': { sub: 'uid-admin-1', role: 'administrator' },
    'tok-noclaim': { sub: 'uid-citizen-b' },
    'tok-spoof': { sub: 'uid-citizen-c', role: 'student' }
  };
  const store = inMemoryStore();
  const authorizer = createAuthorizer(makeVerifier(TOKENS));

  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/civic', createCivicRouter({ authorizer, store }));
  const server = await new Promise(resolve => {
    const s = http.createServer(app).listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/civic`;
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
  const goodReport = {
    title: 'Streetlight out on Block 5 lane 2',
    description: 'The pole outside shop 12 has been dark since 3 October and the lane is unsafe after 7pm.',
    category: 'streetlight', location: 'Block 5 Lane 2, near shop 12', province: 'Sindh', district: 'Karachi'
  };

  // ---- A. refusal by default ----
  const anon = await call('GET', '/reports/mine');
  ok(anon.status === 401 && anon.json.error === 'UNAUTHENTICATED', 'A.1 an unauthenticated request is refused, not served', JSON.stringify(anon));
  const junk = await call('POST', '/reports', { token: 'tok-not-a-session', body: goodReport });
  ok(junk.status === 401 && junk.json.error === 'INVALID_TOKEN', 'A.2 a token the server cannot verify is refused', JSON.stringify(junk));
  const adminAnon = await call('GET', '/admin/queue');
  ok(adminAnon.status === 401, 'A.3 the administrator queue is not readable without a session', JSON.stringify(adminAnon));

  makeVerifier.configured = false;
  const unconfigured = await call('GET', '/admin/queue', { token: 'tok-admin' });
  ok(unconfigured.status === 503 && unconfigured.json.error === 'AUTH_NOT_CONFIGURED',
    'A.4 with no verification backend even a valid-looking admin token is refused (deny-by-default)', JSON.stringify(unconfigured));
  const unconfiguredWrite = await call('POST', '/reports', { token: 'tok-citizen', body: goodReport });
  ok(unconfiguredWrite.status === 503, 'A.5 a report is never silently accepted while verification is unavailable', JSON.stringify(unconfiguredWrite));
  makeVerifier.configured = true;

  // ---- B. ownership comes from the token ----
  const filed = await call('POST', '/reports', {
    token: 'tok-citizen',
    body: { ...goodReport, ownerUid: 'uid-admin-1', status: 'RESOLVED', role: 'administrator', createdAt: '1999-01-01T00:00:00.000Z' }
  });
  ok(filed.status === 201, 'B.1 a signed-in citizen can file a report', JSON.stringify(filed));
  const savedId = filed.json && filed.json.id;
  const stored = store.docs.get(savedId) || {};
  ok(stored.ownerUid === 'uid-citizen-a', 'B.2 the owner is the verified token subject, never the body', stored.ownerUid);
  ok(stored.status === 'SUBMITTED', 'B.3 a client cannot file its own report as already resolved', stored.status);
  ok(String(stored.createdAt).slice(0, 4) !== '1999', 'B.4 the server sets the timestamp, not the caller', stored.createdAt);
  ok(!('role' in stored), 'B.5 a role sent in the body is not persisted onto the record', JSON.stringify(Object.keys(stored)));

  const mineA = await call('GET', '/reports/mine', { token: 'tok-citizen' });
  ok(mineA.status === 200 && mineA.json.reports.length === 1, 'B.6 the owner lists exactly their own reports', JSON.stringify(mineA.json && mineA.json.reports && mineA.json.reports.length));

  // ---- C. cross-user reads are denied ----
  const otherPeek = await call('GET', `/reports/${savedId}`, { token: 'tok-noclaim' });
  ok(otherPeek.status === 404, 'C.1 another signed-in user cannot read someone else\u2019s report (and is not told it exists)', JSON.stringify(otherPeek));
  const lawyerPeek = await call('GET', `/reports/${savedId}`, { token: 'tok-lawyer' });
  ok(lawyerPeek.status === 404, 'C.2 a lawyer without administrator rights cannot read a citizen report either', JSON.stringify(lawyerPeek));
  const ownerPeek = await call('GET', `/reports/${savedId}`, { token: 'tok-citizen' });
  ok(ownerPeek.status === 200 && ownerPeek.json.report.id === savedId, 'C.3 the owner can read their own report back', JSON.stringify(ownerPeek.status));

  // ---- D. privileged routes need the verified claim ----
  const spoof = await call('GET', '/admin/queue?role=administrator', { token: 'tok-spoof' });
  ok(spoof.status === 403, 'D.1 a student claim stays a student even when the body claims administrator', JSON.stringify(spoof));
  const lawyerQueue = await call('GET', '/admin/queue', { token: 'tok-lawyer' });
  ok(lawyerQueue.status === 403, 'D.2 a lawyer is not an administrator', JSON.stringify(lawyerQueue));
  const citizenless = await call('GET', '/admin/queue', { token: 'tok-noclaim' });
  ok(citizenless.status === 403, 'D.3 a signed-in user with no role claim gets no privileged access', JSON.stringify(citizenless));
  const queue = await call('GET', '/admin/queue', { token: 'tok-admin' });
  ok(queue.status === 200 && Array.isArray(queue.json.queue) && queue.json.queue.length === 1,
    'D.4 the administrator sees the review queue', JSON.stringify(queue.json && queue.json.queue && queue.json.queue.length));
  ok(queue.json && queue.json.transitions && Array.isArray(queue.json.transitions.SUBMITTED),
    'D.5 the queue tells the reviewer which transitions are actually allowed', JSON.stringify(queue.json && queue.json.transitions));

  // ---- E. status transitions ----
  const jump = await call('PATCH', `/admin/reports/${savedId}/status`, { token: 'tok-admin', body: { status: 'IN_PROGRESS' } });
  ok(jump.status === 409 && jump.json.error === 'INVALID_TRANSITION', 'E.1 a submitted report cannot jump straight to in progress', JSON.stringify(jump));
  ok(jump.json && (jump.json.allowed || []).includes('IN_REVIEW'), 'E.2 the refusal names the steps that are allowed', JSON.stringify(jump.json && jump.json.allowed));
  const review = await call('PATCH', `/admin/reports/${savedId}/status`, { token: 'tok-admin', body: { status: 'IN_REVIEW', note: 'Assigned to the SMC sanitation officer for site check.' } });
  ok(review.status === 200 && review.json.report.status === 'IN_REVIEW', 'E.3 a valid transition is applied', JSON.stringify(review.status));
  const audit = (review.json.report && review.json.report.audit) || [];
  const last = audit[audit.length - 1] || {};
  ok(last.by === 'uid-admin-1' && last.from === 'SUBMITTED' && last.to === 'IN_REVIEW' && !!last.at,
    'E.4 the audit entry records actor, previous status, new status and time', JSON.stringify(last));
  ok(audit.length === 2, 'E.5 the filing entry and the review entry are both kept', audit.length);
  const citizenSelfUpdate = await call('PATCH', `/admin/reports/${savedId}/status`, { token: 'tok-citizen', body: { status: 'RESOLVED' } });
  ok(citizenSelfUpdate.status === 403, 'E.6 a citizen cannot resolve their own report through the admin route', JSON.stringify(citizenSelfUpdate));

  // close it, then prove CLOSED is terminal
  await call('PATCH', `/admin/reports/${savedId}/status`, { token: 'tok-admin', body: { status: 'CLOSED' } });
  const reopen = await call('PATCH', `/admin/reports/${savedId}/status`, { token: 'tok-admin', body: { status: 'IN_REVIEW' } });
  ok(reopen.status === 409, 'E.7 a closed report is terminal — reopening would contradict what the citizen already saw', JSON.stringify(reopen));
  ok(CIVIC_STATUSES.includes('RESOLVED') && canTransition('ASSIGNED', 'IN_PROGRESS') && !canTransition('CLOSED', 'IN_REVIEW'),
    'E.8 the transition table itself is the single source of truth', JSON.stringify(TRANSITIONS.CLOSED));

  // ---- F. input validation ----
  const bad = await call('POST', '/reports', { token: 'tok-citizen', body: { ...goodReport, category: 'not-a-category', description: 'too short' } });
  ok(bad.status === 400 && bad.json.errors.length >= 2, 'F.1 an invalid report is refused with per-field reasons', JSON.stringify(bad.json));
  const noLoc = await call('POST', '/reports', { token: 'tok-citizen', body: { ...goodReport, location: '' } });
  ok(noLoc.status === 400 && noLoc.json.errors.some(e => e.field === 'location'), 'F.2 a report with no location cannot be filed', JSON.stringify(noLoc.json.errors));
  const huge = await call('POST', '/reports', { token: 'tok-citizen', body: { ...goodReport, description: 'x'.repeat(9000) } });
  ok(huge.status === 201, 'F.3 an over-long description is truncated to the stored limit rather than rejected or overflowed',
    JSON.stringify((store.docs.get(huge.json.id) || {}).description.length));

  // ---- G. evidence stays on the device ----
  const withEvidence = await call('POST', '/reports', {
    token: 'tok-citizen',
    body: { ...goodReport, evidence: [{ name: 'photo.jpg', type: 'image/jpeg', bytes: 12345, dataUrl: 'data:image/jpeg,' + 'A'.repeat(200000) }] }
  });
  const evStored = (store.docs.get(withEvidence.json.id) || {}).evidence || [];
  ok(withEvidence.status === 201 && evStored.length === 1 && evStored[0].held === 'device' && !JSON.stringify(evStored).includes('data:image'),
    'G.1 only evidence metadata is stored — a private photograph is not copied into the database', JSON.stringify(evStored));

  // ---- H. the rules file agrees with the server ----
  const rules = fs.readFileSync('./firestore.rules', 'utf8');
  const civicBlock = (rules.match(/match \/civicIssues\/\{issueId\}\s*\{[\s\S]*?\n    \}/) || [''])[0];
  ok(civicBlock.includes('allow read: if isOwner(resource.data.ownerUid) || isAdministrator();'),
    'H.1 firestore.rules lets an owner or an administrator read a civic report, and nobody else', civicBlock.trim());
  ok(civicBlock.includes('allow create, update, delete: if false;'),
    'H.2 no browser can write or delete a civic report — writes are server-side only', civicBlock.trim());
  ok(/function isAdministrator\(\)[\s\S]*request\.auth\.token\.role == 'administrator'/.test(rules),
    'H.3 the administrator test reads the verified token claim, not a client-writable field', '');
  ok((rules.match(/allow read, write: if false;/g) || []).length >= 1 && rules.trim().startsWith("rules_version = '2';"),
    'H.4 the file is still default-deny overall', '');

  server.close();
  const pass = results.filter(r => r.pass).length;
  const fail = results.length - pass;
  console.log(`\n==== CIVIC AUTHORIZATION + PERSISTENCE: ${pass} PASS / ${fail} FAIL (of ${results.length}) ====`);
  results.filter(r => !r.pass).forEach(r => console.log('  x ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => { console.error('\n SUITE CRASHED:\n', err); process.exit(2); });
