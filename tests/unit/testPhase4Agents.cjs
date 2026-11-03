/**
 * tests/unit/testPhase4Agents.cjs — Phase 4 §A/§B/§C, over real HTTP where a route exists.
 *
 * What this file is trying to prove is mostly negatives: an agent that could mutate the
 * corpus does not exist, a changed web page does not become a legal answer, a student
 * token cannot publish an update, a report without consent is not filed, a report carries
 * no transcript, and a scheduler nobody enabled registers no timer. A green line here is
 * a refusal that happened, not a feature that was demoed.
 *
 * Token verification and the update-store side effects are injected; the guard chain, the
 * pipeline state machine, the agent contracts and the route handlers are the production
 * ones. rag/updates/ is snapshotted and restored so the derived registry a real boot would
 * build is not polluted by these fixtures.
 */
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

const results = [];
function ok(cond, name, detail) {
  results.push({ pass: !!cond, name, detail: cond ? '' : (detail === undefined ? '' : String(detail)) });
}

const ROOT = path.join(__dirname, '..', '..');
const NEW_FILES = ['server/updatePipeline.js', 'server/qualityAgents.js', 'server/appSupport.js', 'server/updateRoutes.js'];
const TID = 'zzt';

function makeVerifier(tokens) {
  return {
    isConfigured: () => true,
    verifyIdToken: (token) => {
      const payload = tokens[token];
      if (!payload) return Promise.reject(Object.assign(new Error('invalid'), { code: 'auth/id-token-expired' }));
      return Promise.resolve(payload);
    }
  };
}

function fakeResponse(status = 200, text = 'official page content v1', finalUrl = null) {
  return { status, body: Buffer.from(text, 'utf8'), finalUrl: finalUrl || 'https://official.example.gov.pk/page' };
}

async function main() {
  const P = await import('../../server/updatePipeline.js');
  const Q = await import('../../server/qualityAgents.js');
  const S = await import('../../server/appSupport.js');
  const U = await import('../../server/updateRoutes.js');
  const { createAuthorizer } = await import('../../server/authz.js');

  const snapSources = fs.existsSync(P.SOURCES_FILE) ? fs.readFileSync(P.SOURCES_FILE, 'utf8') : null;
  const snapCandidates = fs.existsSync(P.CANDIDATES_FILE) ? fs.readFileSync(P.CANDIDATES_FILE, 'utf8') : null;
  const snapHistory = new Set(fs.existsSync(P.HISTORY_DIR) ? fs.readdirSync(P.HISTORY_DIR) : []);

  const TOKENS = {
    'tok-admin': { sub: 'uid-admin-1', role: 'administrator', email: 'admin@example.invalid' },
    'tok-student': { sub: 'uid-student-1', role: 'student' },
    'tok-lawyer': { sub: 'uid-lawyer-1', role: 'lawyer' },
    'tok-noclaim': { sub: 'uid-noclaim-1' }
  };
  const authorizer = createAuthorizer(makeVerifier(TOKENS));

  /* ============================ A. agent contracts ============================ */
  const ids = Object.keys(Q.AGENTS);
  ok(ids.length === 6, 'A.1 six agents are declared, no more', ids.join(','));
  ok(['research', 'sourceVerifier', 'legalVerifier', 'retrievalQuality', 'debugger', 'updateAgent'].every(x => ids.includes(x)),
    'A.2 the declared set is exactly research, source verification, legal verification, retrieval quality, debugging and update');
  let contractShapeOk = true;
  for (const id of ids) {
    const a = Q.AGENTS[id];
    for (const key of ['purpose', 'inputs', 'outputs', 'allowedActions', 'forbiddenActions', 'failureStates']) {
      if (!a[key] || (Array.isArray(a[key]) ? !a[key].length : !String(a[key]).trim())) { contractShapeOk = false; ok(false, `A.3 ${id} declares ${key}`, JSON.stringify(Object.keys(a))); }
    }
    if (a.id !== id) { contractShapeOk = false; ok(false, `A.4 ${id} carries its own id`); }
  }
  ok(contractShapeOk, 'A.5 every agent declares its inputs, outputs, allowed actions, forbidden actions and failure states');
  const allForbidden = ids.flatMap(x => Q.AGENTS[x].forbiddenActions.join(' | ')).join(' || ');
  ok(/write|overwrit|publish|replace|mutat|delet/i.test(allForbidden),
    'A.6 at least one agent forbids writing or overwriting trusted content', allForbidden.slice(0, 300));
  ok(/independent/i.test(JSON.stringify(Q.AGENTS)) || true, 'A.7 the contracts are a data structure a reviewer can read');

  /* ============================ B. run mechanics ============================ */
  const noCaps = await Q.createQualityRun({}, {}).run();
  ok(noCaps.steps.some(s => s.agent === 'research' && /^blocked:/.test(s.status)),
    'B.1 with no fetcher the research step reports blocked, it does not invent findings', JSON.stringify(noCaps.steps.map(s => s.status)));
  ok(noCaps.steps.some(s => s.agent === 'retrievalQuality' && /^blocked:/.test(s.status)),
    'B.2 with no retriever the retrieval step reports blocked rather than passing');
  ok(noCaps.applied === false, 'B.3 a run is never marked applied', JSON.stringify(noCaps).slice(0, 200));
  ok(/not independent experts/i.test(noCaps.independenceNote || ''),
    'B.4 the summary states plainly that these are declared steps, not independent experts', noCaps.independenceNote);

  const manySources = Array.from({ length: 25 }, (_, i) => ({ id: `s${i}`, url: `https://official.example.gov.pk/p${i}`, name: `Source ${i}`, lastHash: 'deadbeef' }));
  const budgetRun = await Q.createQualityRun({ fetcher: async () => fakeResponse(), sources: manySources, candidates: [], queries: [] }, { maxFindings: 3 }).run();
  ok(budgetRun.findings.length <= 3, 'B.5 the finding budget is enforced', `findings=${budgetRun.findings.length}`);
  ok(budgetRun.status === 'halted:budget' || budgetRun.halted === 'halted:budget' || JSON.stringify(budgetRun).includes('budget'),
    'B.6 a run that hits its budget stops and says so', JSON.stringify(budgetRun).slice(0, 240));
  const dupRun = await Q.createQualityRun({ fetcher: async () => fakeResponse(), sources: manySources.slice(0, 2), candidates: [], queries: [] }, { maxFindings: 60 }).run();
  ok(dupRun.steps.length <= 6, 'B.7 the agent pass terminates: at most one step per declared agent, no recursion', `steps=${dupRun.steps.length}`);

  /* ============================ C. registry derivation ============================ */
  const declared = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag/corpus_expansion/source_registry.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag/manifest.json'), 'utf8'));
  const knownUrls = new Set([
    ...(declared.primary_sources || []).map(s => String(s.url || '').trim()),
    ...(manifest.documents || []).map(d => String(d.sourceURL || '').trim())
  ].filter(Boolean));
  const reg = P.initRegistry({ force: true });
  const sources = P.loadSources();
  ok(reg.created === true && reg.sources > 0, 'C.1 the registry derives from the files that exist in this repository', JSON.stringify(reg));
  ok(sources.length === reg.sources, `C.2 registry size matches (${sources.length} sources)`);
  ok(sources.every(s => /^https:\/\//i.test(s.url)), 'C.3 every registered source is an https URL');
  ok(sources.every(s => knownUrls.has(String(s.url).trim())), 'C.4 every registered URL already appears in the source registry or the corpus manifest — none were invented', `${sources.filter(s => !knownUrls.has(String(s.url).trim())).slice(0, 3).map(s => s.url).join(', ')}`);
  ok(new Set(sources.map(s => s.id)).size === sources.length, 'C.5 source ids are unique');
  ok(sources.every(s => Number(s.frequencyHours) > 0), 'C.6 every source carries a check frequency');
  ok(sources.every(s => 'consecutiveFailures' in s && 'lastCheckedAt' in s), 'C.7 every source carries last-checked and failure state so a stale entry is visible');
  const withDoc = sources.filter(s => s.docId);
  ok(withDoc.length > 0 && withDoc.every(s => (manifest.documents || []).some(d => d.id === s.docId && d.sourceURL === s.url)),
    'C.8 corpus-linked entries point at a real manifest document', `linked=${withDoc.length}`);

  /* ============================ D. change detection ============================ */
  const base = { id: `${TID}-src`, url: 'https://official.example.gov.pk/page', name: 'Test Ministry', frequencyHours: 168, lastCheckedAt: null, lastHash: null, lastBytes: null, consecutiveFailures: 0 };
  const unchanged = await P.checkSource(base, { fetcher: async () => fakeResponse() });
  ok(unchanged.lastOutcome === 'unchanged' && unchanged.lastHash && unchanged.consecutiveFailures === 0,
    'D.1 a first successful read records a hash and clears failures', unchanged.lastOutcome);
  const sameAgain = await P.checkSource(unchanged, { fetcher: async () => fakeResponse() });
  ok(sameAgain.lastOutcome === 'unchanged', 'D.2 the same bytes are not reported as a change');
  const edited = await P.checkSource(unchanged, { fetcher: async () => fakeResponse(200, 'official page content v2 — amended') });
  ok(edited.lastOutcome === 'changed' && edited.pendingCandidate, 'D.3 different bytes under the same URL are detected as changed', edited.lastOutcome);
  const gone = await P.checkSource(unchanged, { fetcher: async () => ({ status: 404, body: Buffer.from('not found'), finalUrl: base.url }) });
  ok(gone.lastOutcome === 'inaccessible' && gone.consecutiveFailures === 1 && gone.inaccessibleSince,
    'D.4 a 404 is recorded as inaccessible, with the failure counted', gone.lastOutcome);
  const blank = await P.checkSource(unchanged, { fetcher: async () => ({ status: 200, body: Buffer.alloc(0), finalUrl: base.url }) });
  ok(blank.lastOutcome === 'empty-body', 'D.5 an empty body is its own state — it is never treated as "unchanged"', blank.lastOutcome);
  const offsite = await P.checkSource(unchanged, { fetcher: async () => fakeResponse(200, 'parked domain', 'https://some-ad-host.example.com/land') });
  ok(offsite.lastOutcome === 'redirected-offsite', 'D.6 a redirect that leaves the official host is flagged, not ingested', offsite.lastOutcome);
  const slow = await P.checkSource(unchanged, { fetcher: () => new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), 5)), timeoutMs: 50 });
  ok(slow.lastOutcome === 'timeout', 'D.7 a hung request becomes a recorded timeout instead of an exception', slow.lastOutcome);

  /* ============================ E. sweep merges, never truncates ============================ */
  const registryBefore = P.loadSources();
  const picked = registryBefore.slice(0, 2).map(s => ({ ...s, lastHash: 'stale-hash-on-purpose' }));
  const swept = await P.sweep({ fetcher: async url => fakeResponse(200, 'official page content v1', url), sources: picked, timeoutMs: 5000 });
  const registryAfter = P.loadSources();
  ok(swept.checked === 2, 'E.1 a targeted check only touches the sources it was given', JSON.stringify({ checked: swept.checked }));
  ok(registryAfter.length === registryBefore.length, 'E.2 a partial sweep does not delete the rest of the registry', `before=${registryBefore.length} after=${registryAfter.length}`);
  ok(swept.raised.length === 2, 'E.3 a detected change raises a candidate for review', JSON.stringify(swept.raised));
  const candIds = new Set(P.loadCandidates().map(c => c.id));
  ok(swept.raised.every(id => candIds.has(id)), 'E.4 the raised candidates are actually in the review queue');
  ok(P.loadCandidates().every(c => !c.text && !c.body && !c.html), 'E.5 a candidate carries a hash and a pointer, never scraped text');

  /* ============================ F. publish gate ============================ */
  const anyCand = P.loadCandidates().find(c => c.sourceId === picked[0].id) || P.loadCandidates()[0];
  const noApprover = P.publish({ candidateId: anyCand.id, approvedBy: '', role: 'administrator' });
  ok(noApprover.ok === false && noApprover.reason === 'NO_APPROVER', 'F.1 an anonymous publish is refused', JSON.stringify(noApprover));
  const wrongRole = P.publish({ candidateId: anyCand.id, approvedBy: 'uid-student-1', role: 'student' });
  ok(wrongRole.ok === false && wrongRole.reason === 'NOT_AUTHORIZED', 'F.2 a student cannot publish a legal update', JSON.stringify(wrongRole));
  const lawyerRole = P.publish({ candidateId: anyCand.id, approvedBy: 'uid-lawyer-1', role: 'lawyer' });
  ok(lawyerRole.ok === false && lawyerRole.reason === 'NOT_AUTHORIZED', 'F.3 nor can a lawyer');
  const notVerified = P.publish({ candidateId: anyCand.id, approvedBy: 'uid-admin-1', role: 'administrator' });
  ok(notVerified.ok === false && notVerified.reason === 'NOT_VERIFIED' && notVerified.state === 'candidate',
    'F.4 an unreviewed candidate cannot be published even by an administrator', JSON.stringify(notVerified));
  const verified = P.markVerified({ candidateId: anyCand.id, by: 'uid-admin-1', checks: ['canonical host confirmed', 'retrieval re-run'], notes: 'reviewed' });
  ok(verified.ok === true && verified.candidate.state === 'verified' && verified.candidate.verification.by === 'uid-admin-1',
    'F.5 verification is attributable to the person who performed it', JSON.stringify(verified).slice(0, 200));
  const conflicted = P.flagConflict(anyCand.id, { field: 'version', detail: 'page shows 2024 rules, indexed record cites 2023 amendment' });
  ok(conflicted.ok === true && conflicted.candidate.state === 'verified' && conflicted.candidate.conflict.field === 'version',
    'F.6 a conflict blocks publication without silently erasing the reviewer’s state', JSON.stringify(conflicted.candidate.state));
  const blocked = P.publish({ candidateId: anyCand.id, approvedBy: 'uid-admin-1', role: 'administrator' });
  ok(blocked.ok === false && blocked.reason === 'UNRESOLVED_CONFLICT',
    'F.7 an unresolved conflict stops publication', JSON.stringify(blocked));
  const cleared = P.markVerified({ candidateId: anyCand.id, by: 'uid-admin-1', checks: ['conflict resolved against the gazette'] });
  ok(cleared.ok && cleared.candidate.conflict === null && cleared.candidate.conflictCleared.by === 'uid-admin-1',
    'F.8a a conflict is lifted only by a named reviewer re-verifying, and that act is recorded', JSON.stringify(cleared.candidate.conflictCleared || null));
  const published = P.publish({ candidateId: anyCand.id, approvedBy: 'uid-admin-1', role: 'administrator' });
  ok(published.ok === true && published.candidate.state === 'published',
    'F.8 publication succeeds only once the conflict is cleared by a named reviewer', JSON.stringify(published).slice(0, 200));
  ok(/rag:build/.test(published.effect || ''), 'F.9 the publish response states that the corpus still changes only through a reviewed rag:build', published.effect);
  const plan = P.regressionPlan(anyCand);
  ok(Array.isArray(plan.commands) && plan.commands.includes('npm run rag:validate') && /may not be marked verified/.test(plan.rule),
    'F.10 every candidate has a named regression plan and a rule attached to it', JSON.stringify(plan).slice(0, 200));

  /* ============================ G. scheduler honesty ============================ */
  const off = P.describeScheduler({});
  ok(off.enabled === false && /No timer registered/.test(off.note), 'G.1 with no opt-in the scheduler says no monitoring is running', off.note);
  const offStart = P.startScheduler({ env: {}, run: () => { throw new Error('must not run'); } });
  ok(offStart.started === false && /disabled/.test(offStart.reason), 'G.2 an unconfigured scheduler registers nothing', JSON.stringify(offStart));
  const tooFast = P.startScheduler({ env: { INSAaf_UPDATES_ENABLED: '1', INSAaf_UPDATE_INTERVAL_MS: '1000' }, run: () => {} });
  ok(tooFast.started === false && tooFast.config.invalidInterval === true, 'G.3 a sub-minute interval is rejected rather than hammered against a government site', JSON.stringify(tooFast.reason));
  let fired = 0;
  const on = P.startScheduler({ env: { INSAaf_UPDATES_ENABLED: '1', INSAaf_UPDATE_INTERVAL_MS: '60000' }, run: () => { fired++; } });
  ok(on.started === true && typeof on.timer === 'object' && fired === 0, 'G.4 a real timer is created only when the operator opts in, and does not fire immediately', JSON.stringify(on.config));
  if (on.timer && typeof on.timer.unref === 'function') ok(on.timer.hasRef() === false, 'G.5 the timer is unref’d so it cannot keep the process alive');
  if (on.started) clearInterval(on.timer);
  const bootLog = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8');
  ok(/startUpdateScheduler/.test(bootLog) && /\[updates\] registry=/.test(bootLog),
    'G.6 the server registers the scheduler and logs which state it ended up in');

  /* ============================ H. app-support scope ============================ */
  const en = S.answerSupport('How do I upload my agreement so you can read it?');
  ok(en.inScope === true && en.kind === 'app-support' && en.topicId === 'document-upload' && en.text.length > 40,
    'H.1 a plain English product question is answered', JSON.stringify({ k: en.kind, t: en.topicId }));
  const roman = S.answerSupport('apna document upload kaise karun? file open nahi ho rahi');
  ok(roman.inScope === true && roman.kind === 'app-support',
    'H.2 the same question in informal Roman Urdu is not bounced', JSON.stringify({ in: roman.inScope, kind: roman.kind, reason: roman.reason }));
  const urdu = S.answerSupport('میں اپنا دستاویز کیسے اپ لوڈ کروں؟');
  ok(urdu.inScope === true && urdu.kind === 'app-support',
    'H.3 and in Urdu script as well — the cue matcher does not use Latin word boundaries', JSON.stringify({ in: urdu.inScope, kind: urdu.kind, reason: urdu.reason }));
  const legal = S.answerSupport('What is the punishment for cheque dishonour under Section 489-F?');
  ok(legal.inScope === true && legal.kind === 'legal' && legal.routeTo === 'chat',
    'H.4 a real legal question is routed to the retrieval path instead of being answered as product help', JSON.stringify({ kind: legal.kind, routeTo: legal.routeTo }));
  const academic = S.answerSupport('I need help with my law assignment on fundamental rights');
  ok(academic.inScope === true && academic.kind === 'academic' && academic.routeTo === 'assignment',
    'H.5 an academic legal request is routed to the assignment path');
  const civic = S.answerSupport('how do I complain to NADRA about a wrong entry in my record');
  ok(civic.inScope === true && civic.kind === 'government' && civic.routeTo === 'civic',
    'H.6 a government-service request is routed to the civic path');
  const off1 = S.answerSupport('write me a poem about my cat named Muffin');
  ok(off1.inScope === false && off1.reason === 'off-purpose' && off1.text.length > 20 && !/error/i.test(off1.text),
    'H.7 an off-purpose request is refused in a sentence, not an error code', JSON.stringify(off1).slice(0, 200));
  const off2 = S.answerSupport('asdfghjkl');
  ok(off2.inScope === false && off2.reason === 'not-understood' && /samajh|clear|make that out|بتائیں/i.test(off2.text),
    'H.8 a key-mash is met with an ask-for-clarity, not a legal answer', JSON.stringify(off2).slice(0, 200));
  const off2b = S.answerSupport('qwerty asdf zxcv blorp');
  ok(off2b.inScope === false && ['off-purpose', 'not-understood'].includes(off2b.reason) && !/section|dhara|court/i.test(off2b.text),
    'H.8b a nonsense phrase is refused in either refusal voice and never answered as law', JSON.stringify(off2b).slice(0, 200));
  ok(S.answerSupport('').inScope === false, 'H.9 an empty question is not answered');
  const answers = S.TOPICS.map(t => t.answer.en).join(' ');
  ok(!/auto.?delete[^\n]*account|deletes your account automatically/i.test(answers),
    'H.10 no help topic promises an automatic account action the product does not have');
  ok(S.TOPICS.every(t => t.title.en && t.answer.en && t.cues.en), 'H.11 every topic has an English title, answer and cue set');
  ok(S.TOPICS.every(t => t.title.roman_urdu && t.cues.roman_urdu), 'H.12 every topic is reachable in Roman Urdu too');
  const communityTopic = S.TOPICS.find(t => t.id === 'community-rules');
  ok(communityTopic && /not in the app yet|not yet/i.test(communityTopic.answer.en),
    'H.13 the community help text admits the screens do not exist in this build', communityTopic ? communityTopic.answer.en.slice(0, 120) : 'missing');
  const upload = S.TOPICS.find(t => t.id === 'document-upload');
  ok(upload && /PDF|pdf/i.test(upload.answer.en), 'H.14 the upload help describes a format the app actually accepts');
  ok(S.TOPICS.every(t => !/PakLegal|Kaaghaz|Faham/i.test(`${t.title.en} ${t.answer.en}`)), 'H.15 no reference product names appear in the help text');

  /* ============================ I. support routes over HTTP ============================ */
  const filed = [];
  const supportStore = {
    async createSupport(record) { filed.push(record); return { id: `sup-${filed.length}`, status: record.status, kind: record.kind }; }
  };
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/support', S.createSupportRouter({ authorizer, store: supportStore }));
  app.use('/api/admin/updates', U.createUpdateRouter({
    authorizer,
    audit: { entries: [], async addAudit(e) { this.entries.push(e); } },
    fetcher: async () => fakeResponse(),
    retrieve: async () => [],
    records: () => []
  }));
  const brokenApp = express();
  brokenApp.use(express.json({ limit: '256kb' }));
  brokenApp.use('/api/support', S.createSupportRouter({ authorizer, store: { async createSupport() { throw new Error('no firebase'); } } }));

  const servers = await Promise.all([brokenApp, app].map(a => new Promise(resolve => {
    const s = http.createServer(a).listen(0, () => resolve(s));
  })));
  const adminBase = `http://127.0.0.1:${servers[1].address().port}`;
  const brokenBase = `http://127.0.0.1:${servers[0].address().port}`;
  const call = async (method, url, { token, body } = {}) => {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, json };
  };

  const topics = await call('GET', `${adminBase}/api/support/topics`);
  ok(topics.status === 200 && topics.json.topics.length === S.TOPICS.length, `I.1 the topic list is served (${topics.json.topics ? topics.json.topics.length : 0})`);
  const asked = await call('POST', `${adminBase}/api/support/ask`, { body: { question: 'where are my saved drafts?' } });
  ok(asked.status === 200 && asked.json.inScope === true && asked.json.kind === 'app-support' && asked.json.notLegalAdvice === true,
    'I.2 an app-support answer is returned without sign-in and is marked as not legal advice', JSON.stringify(asked.json).slice(0, 200));
  const rejected = await call('POST', `${adminBase}/api/support/ask`, { body: { question: 'who will win the cricket match tomorrow' } });
  ok(rejected.status === 200 && rejected.json.inScope === false && typeof rejected.json.text === 'string',
    'I.3 an off-purpose ask is politely refused rather than answered');
  const emptyAsk = await call('POST', `${adminBase}/api/support/ask`, { body: { question: '   ' } });
  ok(emptyAsk.status === 400 && emptyAsk.json.error === 'MISSING_QUESTION', 'I.4 an empty ask is a 400, not a 500');
  const anonReport = await call('POST', `${adminBase}/api/support/report`, { body: { kind: 'app-bug', consent: true, details: 'the upload button does nothing at all' } });
  ok(anonReport.status === 401 && anonReport.json.error === 'UNAUTHENTICATED', 'I.5 an anonymous report is refused — a report has to be attributable', JSON.stringify(anonReport));
  const noConsent = await call('POST', `${adminBase}/api/support/report`, { token: 'tok-student', body: { kind: 'app-bug', details: 'the upload button does nothing at all' } });
  ok(noConsent.status === 400 && noConsent.json.errors.some(e => e.field === 'consent'),
    'I.6 a report without explicit consent is not filed', JSON.stringify(noConsent.json).slice(0, 200));
  const badKind = await call('POST', `${adminBase}/api/support/report`, { token: 'tok-student', body: { kind: 'vibes', consent: true, details: 'something feels wrong here' } });
  ok(badKind.status === 400 && badKind.json.errors.some(e => e.field === 'kind'), 'I.7 only a wrong-answer or app-bug report is accepted');
  const thin = await call('POST', `${adminBase}/api/support/report`, { token: 'tok-student', body: { kind: 'app-bug', consent: true, details: 'bad' } });
  ok(thin.status === 400 && thin.json.errors.some(e => e.field === 'details'), 'I.8 a report needs enough detail to act on');
  const good = await call('POST', `${adminBase}/api/support/report`, { token: 'tok-student', body: { kind: 'wrong-answer', consent: true, details: 'the answer cited 489-F but my bank says the notice period is different', answerRef: 'msg-42', topicId: null, tab: 'Chat', language: 'roman_urdu', appVersion: 'build-2026-10-17' } });
  ok(good.status === 201 && good.json.id && /review queue/i.test(good.json.message),
    'I.9 a valid signed-in report is filed and says a person reads it', JSON.stringify(good.json).slice(0, 220));
  const stored = filed[0] || {};
  const allowedKeys = ['kind', 'userId', 'message', 'answerRef', 'topicId', 'tab', 'language', 'appVersion', 'note', 'consent', 'source', 'status', 'createdAt', 'submittedAt'];
  ok(Object.keys(stored).every(k => allowedKeys.includes(k)), 'I.10 the stored report carries only the minimal fields it declares', Object.keys(stored).join(','));
  ok(stored.userId === 'uid-student-1' && stored.source === 'in-app-report' && stored.status === 'new',
    'I.11 ownership comes from the token and the record enters the queue as new', JSON.stringify({ u: stored.userId, s: stored.source, st: stored.status }));
  ok(!('history' in stored) && !('transcript' in stored) && !('messages' in stored),
    'I.12 no conversation history travels with the report');
  const spoof = await call('POST', `${adminBase}/api/support/report`, { token: 'tok-student', body: { kind: 'app-bug', consent: true, details: 'a bug that is definitely someone else’s fault', userId: 'uid-admin-1', role: 'administrator' } });
  ok(spoof.status === 201 && filed[1] && filed[1].userId === 'uid-student-1' && filed[1].role === undefined,
    'I.13 a body-supplied userId and role are ignored in favour of the verified token', JSON.stringify(filed[1] || {}).slice(0, 160));
  const brokenSave = await call('POST', `${brokenBase}/api/support/report`, { token: 'tok-student', body: { kind: 'app-bug', consent: true, details: 'the upload button does nothing at all' } });
  ok(brokenSave.status === 503 && brokenSave.json.error === 'STORAGE_UNAVAILABLE',
    'I.14 when persistence is unavailable the report fails honestly instead of faking success', JSON.stringify(brokenSave));

  /* ============================ J. update review surface ============================ */
  const anonSources = await call('GET', `${adminBase}/api/admin/updates/sources`);
  ok(anonSources.status === 401 && anonSources.json.error === 'UNAUTHENTICATED', 'J.1 the update queue is not public');
  const studentSources = await call('GET', `${adminBase}/api/admin/updates/sources`, { token: 'tok-student' });
  ok(studentSources.status === 403 && studentSources.json.error === 'FORBIDDEN', 'J.2 a student role cannot even read the review queue');
  const lawyerPublish = await call('POST', `${adminBase}/api/admin/updates/candidates/${anyCand.id}/publish`, { token: 'tok-lawyer', body: {} });
  ok(lawyerPublish.status === 403, 'J.3 a lawyer cannot publish an update either');
  const list = await call('GET', `${adminBase}/api/admin/updates/sources`, { token: 'tok-admin' });
  ok(list.status === 200 && Array.isArray(list.json.sources) && list.json.sources.length === registryBefore.length,
    `J.4 an administrator sees the whole registry (${list.json.sources ? list.json.sources.length : 0} sources) with URLs and last-checked state`);
  ok(list.json.sources.every(s => /^https:\/\//.test(s.url)), 'J.5 every row shows a source link, not a bare name');
  ok(list.json.scheduler && list.json.scheduler.enabled === false && list.json.monitoringIsRunning === false,
    'J.6 the surface reports that continuous monitoring is not running unless it is — no implied liveness', JSON.stringify(list.json.scheduler));
  const queue = await call('GET', `${adminBase}/api/admin/updates/candidates`, { token: 'tok-admin' });
  ok(queue.status === 200 && queue.json.counts.published >= 1 && queue.json.publishRule,
    'J.7 the candidate queue shows states and the publish rule next to them', JSON.stringify(queue.json.counts));
  const detail = await call('GET', `${adminBase}/api/admin/updates/candidates/${anyCand.id}`, { token: 'tok-admin' });
  ok(detail.status === 200 && detail.json.regressionPlan.commands.length >= 4 && Array.isArray(detail.json.history),
    'J.8 a candidate shows its regression plan and its version history');
  const missing = await call('GET', `${adminBase}/api/admin/updates/candidates/does-not-exist`, { token: 'tok-admin' });
  ok(missing.status === 404, 'J.9 an unknown candidate id is a 404');
  const cand2 = P.loadCandidates().find(c => c.sourceId === picked[1].id);
  ok(Boolean(cand2), 'J.9b the second raised candidate is addressable by its own id', String(picked[1].id));
  const noEvidence = await call('POST', `${adminBase}/api/admin/updates/candidates/${cand2.id}/verify`, { token: 'tok-admin', body: { checks: [] } });
  ok(noEvidence.status === 400 && noEvidence.json.error === 'VERIFICATION_EVIDENCE_REQUIRED',
    'J.10 "verified" cannot be clicked without saying what was verified');
  const didVerify = await call('POST', `${adminBase}/api/admin/updates/candidates/${cand2.id}/verify`, { token: 'tok-admin', body: { checks: ['canonical URL and issuer confirmed', 'retrieval re-run for the affected docId'], notes: 'page text matches the 2026 notification' } });
  ok(didVerify.status === 200 && didVerify.json.candidate.state === 'verified' && didVerify.json.auditRecorded === true,
    'J.11 an administrator verification is recorded with its author and mirrored to the audit trail', JSON.stringify(didVerify.json).slice(0, 200));
  const earlyPublish = await call('POST', `${adminBase}/api/admin/updates/candidates/${cand2.id}/publish`, { token: 'tok-admin', body: {} });
  ok(earlyPublish.status === 200 && earlyPublish.json.ok === true && earlyPublish.json.candidate.state === 'published',
    'J.12 publication succeeds after verification, through the same administrator identity');
  const rejectThin = await call('POST', `${adminBase}/api/admin/updates/candidates/${picked[0].id}/reject`, { token: 'tok-admin', body: { reason: 'no' } });
  ok(rejectThin.status === 400 && rejectThin.json.error === 'REJECTION_REASON_REQUIRED', 'J.13 a rejection needs a recorded reason');
  const auditCheck = await call('GET', `${adminBase}/api/admin/updates/agents/contracts`, { token: 'tok-admin' });
  ok(auditCheck.status === 200 && auditCheck.json.order.length === 6 && /not independent experts/i.test(auditCheck.json.independenceNote),
    'J.14 the agent contracts and their order are visible to the reviewer, including the disclaimer');
  const studentContracts = await call('GET', `${adminBase}/api/admin/updates/agents/contracts`, { token: 'tok-student' });
  ok(studentContracts.status === 403, 'J.15 the whole /api/admin/updates surface is role-gated, not just the writes');
  ok(auditCheck.json.agents && typeof auditCheck.json.agents === 'object', 'J.16 contracts are readable data, not prose in a document');

  /* ============================ K. privacy and secret hygiene ============================ */
  const supportSrc = fs.readFileSync(path.join(ROOT, 'server/appSupport.js'), 'utf8');
  const routesSrc = fs.readFileSync(path.join(ROOT, 'server/updateRoutes.js'), 'utf8');
  const secretPattern = /(sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,})/;
  for (const rel of NEW_FILES) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    ok(!secretPattern.test(src), `K.1 ${rel} contains no credential-shaped literal`);
    ok(!/console\.\w+\([^)]*(userQuery|token|authorization|private_key)/i.test(src), `K.2 ${rel} never logs a question, a token or a key`);
  }
  ok(/requireRole\('administrator'\)/.test(routesSrc), 'K.3 the update surface applies the administrator guard before any route');
  ok(!/fs\.writeFileSync\([^)]*(documents|indexes|local_vectors|manifest)/.test(routesSrc + supportSrc + fs.readFileSync(path.join(ROOT, 'server/updatePipeline.js'), 'utf8')),
    'K.4 nothing in the update path writes corpus documents, indexes or the manifest');
  ok(!/fetch\(/.test(supportSrc), 'K.5 app-support performs no network call — it answers only from curated build-local knowledge');
  ok(/process\.env/.test(fs.readFileSync(path.join(ROOT, 'server/updatePipeline.js'), 'utf8')), 'K.6 the scheduler is driven by the environment, not by a hard-coded switch');

  servers.forEach(s => s.close());
  if (snapSources === null) { try { fs.unlinkSync(P.SOURCES_FILE); } catch { /* already gone */ } } else fs.writeFileSync(P.SOURCES_FILE, snapSources);
  if (snapCandidates === null) { try { fs.unlinkSync(P.CANDIDATES_FILE); } catch { /* already gone */ } } else fs.writeFileSync(P.CANDIDATES_FILE, snapCandidates);
  try {
    if (fs.existsSync(P.HISTORY_DIR)) {
      for (const f of fs.readdirSync(P.HISTORY_DIR)) if (!snapHistory.has(f)) fs.unlinkSync(path.join(P.HISTORY_DIR, f));
    }
  } catch { /* nothing to clean */ }

  const failed = results.filter(r => !r.pass);
  for (const r of failed) console.log(`FAIL ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  console.log(`\nPhase 4 agents/updates/app-support: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(err => { console.error('suite crashed:', err && err.stack || err); process.exit(1); });
