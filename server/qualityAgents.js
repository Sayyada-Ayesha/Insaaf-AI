/**
 * server/qualityAgents.js — six bounded steps in one controlled workflow, not six
 * opinions.
 *
 * Naming an agent does not make it an expert, so each step here is defined by what it
 * may actually do: its inputs, its outputs, its allowed actions, the actions it is
 * denied, and the states it can end in. Every capability is injected, no step may call
 * another step, no step may write to the trusted corpus, and the orchestrator holds a
 * hard budget plus a visited-set so a cycle cannot spin.
 *
 * The whole workflow is read-only by construction. Its output is a change summary for a
 * human; publishing remains in `updatePipeline.publish()`, behind a verified state and an
 * administrator identity from a verified token.
 */

/** Declared contracts. Read by the tests, so "defined" here means machine-checked. */
export const AGENTS = Object.freeze({
  research: {
    id: 'research',
    purpose: 'Find official sources whose pages or documents may have changed.',
    inputs: ['registry of approved sources', 'an HTTP fetch capability'],
    outputs: ['per-source check outcome', 'candidate change notes'],
    allowedActions: ['fetch an approved source URL', 'hash the response', 'enqueue a candidate'],
    forbiddenActions: ['invent a source that is not in the registry', 'write corpus text', 'mark anything verified'],
    failureStates: ['blocked:no-fetcher', 'blocked:no-registry', 'failed:fetch-error']
  },
  sourceVerifier: {
    id: 'sourceVerifier',
    purpose: 'Confirm canonical URL, issuer, date, version and content integrity of a candidate.',
    inputs: ['candidate', 'history of previous hashes', 'the corpus record it would affect'],
    outputs: ['pass or fail per field, with reasons'],
    allowedActions: ['compare hosts', 'compare hashes against history', 'read the affected manifest entry', 'flag a conflict'],
    forbiddenActions: ['accept a non-canonical or off-site redirect', 'publish', 'treat a successful fetch as a verification'],
    failureStates: ['blocked:no-history', 'failed:off-site-source', 'failed:no-issuer']
  },
  legalVerifier: {
    id: 'legalVerifier',
    purpose: 'Identify contradictions, jurisdiction mismatch and superseded provisions.',
    inputs: ['candidate', 'the indexed record it would change', 'domain and jurisdiction metadata'],
    outputs: ['a list of contradictions and supersession risks'],
    allowedActions: ['compare provision keys and text', 'compare jurisdiction and effective date', 'raise a conflict flag'],
    forbiddenActions: ['decide which law prevails for a user', 'answer a legal question', 'silently drop a conflicting record'],
    failureStates: ['blocked:no-corpus-record', 'partial:dates-unverifiable']
  },
  retrievalQuality: {
    id: 'retrievalQuality',
    purpose: 'Run retrieval, citation, language and evidence-gate checks affected by a change.',
    inputs: ['query set', 'the retriever', 'the citation auditor'],
    outputs: ['pass/fail per check class with counts'],
    allowedActions: ['retrieve', 'audit citations', 'check language handling in en and roman_urdu', 'report gate outcomes'],
    forbiddenActions: ['lower a threshold to obtain a pass', 'edit a test expectation', 'skip the Urdu-script cases'],
    failureStates: ['blocked:no-retriever', 'failed:checks-failed']
  },
  debugger: {
    id: 'debugger',
    purpose: 'Reproduce a reported defect and propose a bounded fix with a regression test.',
    inputs: ['a support/bug report', 'the failing command or route'],
    outputs: ['a reproduction with actual output', 'a proposed bounded change', 'a named regression test'],
    allowedActions: ['run a command', 'read source', 'describe a minimal fix', 'state which test guards it'],
    forbiddenActions: ['apply the fix itself', 'declare a defect fixed without a run', 'refactor beyond the defect'],
    failureStates: ['blocked:no-reproduction', 'failed:command-error']
  },
  updateAgent: {
    id: 'updateAgent',
    purpose: 'Assemble the reviewed change set into a summary a human can approve.',
    inputs: ['candidates that passed verification', 'conflict notes', 'regression results'],
    outputs: ['a change summary', 'the exact command a human runs to apply it'],
    allowedActions: ['summarise', 'list affected files', 'state the apply command', 'state the rollback'],
    forbiddenActions: ['run rag:build', 'write to rag/documents', 'mark anything published', 'approve its own summary'],
    failureStates: ['blocked:no-verified-candidates']
  }
});

const ORDER = ['research', 'sourceVerifier', 'legalVerifier', 'retrievalQuality', 'debugger', 'updateAgent'];

function finding(agent, kind, detail, evidence) {
  return { agent, kind, detail: String(detail || '').slice(0, 500), evidence: evidence === undefined ? null : evidence, at: new Date().toISOString() };
}

/**
 * @param caps {fetcher, sources, candidates, records, retrieve, queries, reports, runCommand}
 *   Anything missing makes the dependent step report `blocked:*` rather than pretend.
 */
export function createQualityRun(caps = {}, { maxFindings = 60, maxSources = 20 } = {}) {
  const state = { steps: [], findings: [], budget: maxFindings, visited: new Set(), halted: null, startedAt: Date.now() };

  function record(step) {
    state.steps.push(step);
    for (const f of step.findings || []) {
      if (state.findings.length >= state.budget) { state.halted = 'halted:budget'; return; }
      state.findings.push(f);
    }
  }

  async function run() {
    for (const name of ORDER) {
      const key = `${name}:${state.steps.length}`;
      if (state.visited.has(key)) { state.halted = 'halted:loop'; break; }
      state.visited.add(key);
      const step = await runStep(name, caps, state, { maxSources });
      record(step);
      if (state.halted) break;
      // A blocked research step still lets later steps report their own blocked state;
      // only a hard budget or loop stop ends the run early.
    }
    return summarise(state, caps);
  }

  return { run, state };
}

async function runStep(name, caps, state, { maxSources }) {
  const contract = AGENTS[name];
  const step = { agent: name, status: 'ok', findings: [], actions: [], blocked: null };

  if (name === 'research') {
    if (!caps.fetcher) { step.status = 'blocked:no-fetcher'; step.findings.push(finding(name, 'block', 'No HTTP fetcher injected, so no source could be checked.')); return step; }
    const sources = (caps.sources || []).slice(0, maxSources);
    if (!sources.length) { step.status = 'blocked:no-registry'; step.findings.push(finding(name, 'block', 'The approved-source registry is empty; run initRegistry() first.')); return step; }
    const outcomes = [];
    for (const s of sources) {
      let res;
      try { res = await caps.fetcher(s.url); } catch (err) { step.findings.push(finding(name, 'error', `${s.id}: ${String(err && err.message || err).slice(0, 120)}`)); continue; }
      const body = res && res.body != null ? String(res.body) : '';
      const hash = require_hash(body);
      const changed = s.lastHash && s.lastHash !== hash && Number(res && res.status) < 400 && body.length > 0;
      const offsite = res && res.finalUrl ? !sameHost(res.finalUrl, s.url) : false;
      outcomes.push({ id: s.id, status: Number(res && res.status) || 0, bytes: body.length, hash, changed, offsite });
      step.findings.push(finding(name, changed ? 'change' : offsite ? 'offsite' : 'check', `${s.id}: ${changed ? 'content differs from the recorded hash' : offsite ? 'redirect left the source host' : 'no change recorded'}`, { status: res && res.status, bytes: body.length, changed, offsite }));
    }
    step.actions.push(`checked ${outcomes.length} of ${(caps.sources || []).length} registered sources (cap ${maxSources})`);
    step.outcomes = outcomes;
    if (!outcomes.length) step.status = 'failed:fetch-error';
    return step;
  }

  if (name === 'sourceVerifier') {
    const cands = caps.candidates || [];
    if (!cands.length) { step.status = 'ok'; step.findings.push(finding(name, 'none', 'No candidate was raised, so there is nothing to verify.')); return step; }
    for (const c of cands) {
      const problems = [];
      if (!/^https:\/\//i.test(String(c.sourceUrl || ''))) problems.push('not an https canonical URL');
      if (c.offsite) problems.push('response left the registered host');
      if (!c.toHash) problems.push('no content hash to compare');
      if (!String(c.sourceName || '').trim()) problems.push('issuer/name unknown');
      if (Number(c.bytes) === 0) problems.push('empty body');
      step.findings.push(finding(name, problems.length ? 'fail' : 'pass', problems.length ? `${c.id}: ${problems.join('; ')}` : `${c.id}: canonical host, issuer named, hash and size recorded`, { problems }));
    }
    step.actions.push(`verified ${cands.length} candidate(s) against URL, issuer, hash and size`);
    return step;
  }

  if (name === 'legalVerifier') {
    const cands = caps.candidates || [];
    const records = caps.records || [];
    if (!records.length) { step.status = cands.length ? 'blocked:no-corpus-record' : 'ok'; step.findings.push(finding(name, 'block', 'No corpus records were provided, so supersession could not be compared.')); return step; }
    for (const c of cands) {
      const rec = records.find(r => (c.docId && r.docId === c.docId) || (r.sourceURL && r.sourceURL === c.sourceUrl));
      if (!rec) { step.findings.push(finding(name, 'unknown', `${c.id}: no indexed record cites this source, so nothing is contradicted — and nothing is confirmed either.`)); continue; }
      const stale = rec.version && c.detectedAt && String(rec.version) > String(c.detectedAt) ? 'indexed version is newer than the page change' : null;
      const jurisdiction = rec.jurisdiction && c.jurisdiction && rec.jurisdiction !== c.jurisdiction ? `jurisdiction differs (${rec.jurisdiction} vs ${c.jurisdiction})` : null;
      const issues = [stale, jurisdiction].filter(Boolean);
      step.findings.push(finding(name, issues.length ? 'conflict' : 'consistent', issues.length ? `${c.id} vs ${rec.docId}: ${issues.join('; ')}` : `${c.id} matches the indexed record for ${rec.docId} on jurisdiction`, { docId: rec.docId, issues }));
    }
    step.actions.push(`compared ${cands.length} candidate(s) with ${records.length} indexed record(s)`);
    return step;
  }

  if (name === 'retrievalQuality') {
    if (!caps.retrieve) { step.status = 'blocked:no-retriever'; step.findings.push(finding(name, 'block', 'No retriever injected; retrieval, citation and language checks were not run.')); return step; }
    const queries = caps.queries || [];
    let passed = 0, failed = 0;
    for (const q of queries) {
      try {
        const chunks = await caps.retrieve(q.text);
        const hits = (chunks || []).length;
        const wantHits = q.expectHits === undefined ? 1 : q.expectHits;
        if (hits >= wantHits) { passed++; step.findings.push(finding(name, 'pass', `"${q.text}" returned ${hits} record(s)`, { hits })); }
        else { failed++; step.findings.push(finding(name, 'fail', `"${q.text}" returned ${hits} record(s), expected at least ${wantHits}`, { hits, wantHits })); }
      } catch (err) {
        failed++;
        step.findings.push(finding(name, 'fail', `"${q.text}" threw ${String(err && err.message || err).slice(0, 120)}`));
      }
    }
    step.status = failed ? 'failed:checks-failed' : passed ? 'ok' : 'blocked:no-retriever';
    step.actions.push(`ran ${queries.length} affected query/queries; ${passed} pass, ${failed} fail (thresholds unchanged)`);
    step.counts = { passed, failed };
    return step;
  }

  if (name === 'debugger') {
    const reports = caps.reports || [];
    if (!reports.length) { step.status = 'ok'; step.findings.push(finding(name, 'none', 'No open defect report was supplied.')); return step; }
    for (const r of reports) {
      if (!caps.runCommand) { step.findings.push(finding(name, 'block', `Report ${r.id}: command execution is not injected, so nothing was reproduced. This is a blocked state, not a fix.`)); continue; }
      let out;
      try { out = await caps.runCommand(r.command); } catch (err) { step.findings.push(finding(name, 'error', `Report ${r.id}: command threw ${String(err && err.message || err).slice(0, 120)}`)); continue; }
      const reproduced = out && Number(out.exitCode) !== 0;
      step.findings.push(finding(name, reproduced ? 'reproduced' : 'not-reproduced', `Report ${r.id} via \`${String(r.command).slice(0, 120)}\`: exit ${out && out.exitCode}${reproduced ? ' — reproduced; propose the smallest change that clears it and name the test that guards it' : ' — the command already passes, so the report needs a real reproduction before any change is proposed'}`, { exitCode: out && out.exitCode, tail: String(out && out.tail || '').slice(0, 200) }));
    }
    step.actions.push(`attempted reproduction of ${reports.length} report(s)`);
    return step;
  }

  // updateAgent
  const verifications = state.findings.filter(f => f.agent === 'sourceVerifier' && f.kind === 'pass').length;
  const conflicts = state.findings.filter(f => f.kind === 'conflict' || f.kind === 'fail').length;
  if (!verifications && !conflicts) {
    step.status = 'blocked:no-verified-candidates';
    step.findings.push(finding(name, 'block', 'Nothing reached this step in a reviewable state, so there is no change summary to prepare.'));
    return step;
  }
  step.actions.push(`prepared a change summary of ${verifications} reviewed candidate(s) and ${conflicts} flagged item(s)`);
  step.findings.push(finding(name, 'summary', `Change set prepared for human review: ${verifications} candidate(s) passed URL/issuer/hash checks, ${conflicts} item(s) carry a conflict or a failed check. Applying it requires a human to run \`npm run rag:build\` after approval; rollback is \`rag/corpus_expansion/archive\` plus the previous index file. Publishing is never performed by this workflow.`));
  return step;
}

function sameHost(a, b) {
  try { return new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase(); } catch { return false; }
}

function require_hash(text) {
  // Kept local so this module stays dependency-light and pure (no fs, no network).
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `fnv-${h.toString(16)}`;
}

function summarise(state, caps) {
  const counts = {};
  for (const f of state.findings) counts[f.kind] = (counts[f.kind] || 0) + 1;
  return {
    startedAt: new Date(state.startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    halted: state.halted,
    steps: state.steps.map(s => ({ agent: s.agent, status: s.status, actions: s.actions, findingCount: (s.findings || []).length, contract: { allowed: AGENTS[s.agent].allowedActions, forbidden: AGENTS[s.agent].forbiddenActions, inputs: AGENTS[s.agent].inputs, outputs: AGENTS[s.agent].outputs, failureStates: AGENTS[s.agent].failureStates } })),
    counts,
    findings: state.findings,
    independenceNote: 'These are six declared steps inside one process with injected capabilities, not independent experts. No step could write the corpus, publish, or call another step.',
    applied: false,
    publishRequires: ['a verified candidate state', 'an administrator identity from a verified ID token', 'a human-run rag:build']
  };
}
