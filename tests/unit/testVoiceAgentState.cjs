/*
 * STEP C RUNTIME TEST — the Voice Agent session reducer.
 *
 * src/lib/voiceAgentState.ts is compiled from source with esbuild and executed in
 * Node, exactly as the browser runs it. Nothing here is judged by reading the file.
 *
 * What it proves:
 *   - the session lives in memory only: a recording localStorage/sessionStorage
 *     spy sees ZERO writes across a full multi-turn session (adjustment #2),
 *   - facts carry between turns and answered facts leave missingFacts,
 *   - intake summary content, plain language, no internal fields, disclaimer,
 *   - professionalSupportNeeded stays a genuine tri-state,
 *   - End / Clear reset, and nothing else discards turns (tab switching has no
 *     reducer action at all, so a hidden-mounted session cannot be lost),
 *   - memory caps are enforced, and toLocalChat matches the app's existing
 *     chat shape so "Save to Vault" reuses the vault instead of replacing it.
 *
 * Run: node tests/unit/testVoiceAgentState.cjs
 */
const { execSync } = require('child_process');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, '_voiceAgentStateCompiled.mjs');
const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const JARGON = /\bRAG\b|evidence gate|corrective|verdict|confidence|score|provider|retrieval|embedding|model|\bnot_evaluated\b|\bunclear\b|\bstrength\b/i;

(async () => {
  // ---- storage spies installed BEFORE the module is loaded ----
  const writes = [];
  const mkStore = (tag) => ({
    getItem: () => null,
    setItem: (k, v) => { writes.push(`${tag}:${String(k)}=${String(v).slice(0, 40)}`); },
    removeItem: (k) => { writes.push(`${tag}:remove:${String(k)}`); },
    clear: () => { writes.push(`${tag}:clear`); },
    key: () => null,
    get length() { return 0; }
  });
  globalThis.localStorage = mkStore('local');
  globalThis.sessionStorage = mkStore('session');

  let M = null;
  try {
    execSync('node_modules\\.bin\\esbuild.cmd src/lib/voiceAgentState.ts --format=esm --platform=node --outfile="' + OUT + '"',
      { cwd: ROOT, stdio: 'pipe' });
    M = await import(pathToFileURL(OUT).href);
    record('C.0 real voiceAgentState.ts compiled with esbuild and imported',
      !!M && typeof M.voiceReducer === 'function' && typeof M.buildIntakeSummary === 'function'
        && typeof M.toAgentContext === 'function' && typeof M.toLocalChat === 'function'
        && typeof M.supportLabel === 'function', `exports=${Object.keys(M).sort().join(',')}`);
  } catch (e) {
    record('C.0 real voiceAgentState.ts compiled with esbuild and imported', false, String(e.message || e));
  }
  if (!M) { console.log('Cannot continue without the compiled module.'); process.exit(1); }

  const compiled = fs.readFileSync(OUT, 'utf8');
  record('C.1 the compiled session module references no storage or audio API',
    !/localStorage|sessionStorage|indexedDB|MediaRecorder|AudioContext|Blob\(|createObjectURL|fetch\(|XMLHttpRequest/.test(compiled),
    `bytes=${compiled.length}`);

  // ---- build a realistic two-turn session ----
  const TURN1_INTAKE = {
    issue: 'Landlord is keeping the security deposit',
    domain: 'civil', jurisdiction: 'Sindh', location: 'Hyderabad', institution: '',
    keyFacts: ['Deposit of 150000 rupees paid at handover', 'Tenancy ended in March 2026'],
    timeline: ['Agreement signed 01/01/2025', 'Notice to vacate 28/02/2026'],
    urgency: 'No deadline stated',
    documentsMentioned: ['Written tenancy agreement', 'WhatsApp messages'],
    requestedOutcome: 'Refund of the deposit',
    missingMandatoryFacts: ['The exact date the deposit was demanded in writing', 'Whether the agreement has an arbitration clause'],
    suggestedNextStep: 'Send a written demand for the deposit, then file a summary suit if it is ignored.',
    professionalSupportNeeded: 'unclear',
    evidenceStatus: 'strong'
  };

  let s = M.initialVoiceSession;
  s = M.voiceReducer(s, { type: 'REQUEST_VOICE' });
  record('C.2 pressing the mic without prior consent enters the consent phase, not listening',
    s.phase === 'consent' && s.consented === false, `phase=${s.phase}`);
  s = M.voiceReducer(s, { type: 'CONSENT_GRANTED' });
  record('C.3 accepting consent records consent once and moves to listening',
    s.consented === true && s.phase === 'listening');

  s = M.voiceReducer(s, { type: 'LIVE_TRANSCRIPT', text: 'My landlord in' });
  record('C.4 interim speech is held as a live transcript only',
    s.liveTranscript === 'My landlord in' && s.turns.length === 0);

  s = M.voiceReducer(s, { type: 'USER_TURN', text: 'My landlord is keeping my security deposit of 150000 rupees' });
  s = M.voiceReducer(s, { type: 'AGENT_ANSWER', text: 'ANSWER ONE', intake: TURN1_INTAKE, sources: [{ title: 'Sindh Rental Act record' }] });
  record('C.5 a completed turn stores question and answer with its sources',
    s.turns.length === 2 && s.turns[0].role === 'user' && s.turns[1].role === 'agent'
      && s.turns[1].sources.length === 1 && s.liveTranscript === '');

  const ctx1 = M.toAgentContext(s);
  record('C.6 the carried context holds the slots the agent may reuse (never the transcript)',
    ctx1.issue === TURN1_INTAKE.issue && ctx1.domain === 'civil' && ctx1.location === 'Hyderabad'
      && ctx1.facts.length === 2 && ctx1.documents.length === 2 && ctx1.timeline.length === 2
      && !('transcript' in ctx1) && !('turns' in ctx1) && !('messages' in ctx1),
    `keys=${Object.keys(ctx1).sort().join(',')}`);

  // ---- turn 2: the client answers one of the two outstanding questions ----
  const TURN2_INTAKE = {
    ...TURN1_INTAKE,
    keyFacts: [...TURN1_INTAKE.keyFacts, 'Written demand sent on 10/04/2026'],
    missingMandatoryFacts: ['Whether the agreement has an arbitration clause'],
    professionalSupportNeeded: false,
    evidenceStatus: 'strong'
  };
  s = M.voiceReducer(s, { type: 'USER_TURN', text: 'I sent the written demand on 10 April 2026' });
  s = M.voiceReducer(s, { type: 'AGENT_ANSWER', text: 'ANSWER TWO', intake: TURN2_INTAKE, sources: [] });
  record('C.7 facts accumulate across turns instead of being re-asked',
    s.facts.length === 3 && s.facts.some(f => /150000/.test(f)) && s.facts.some(f => /10\/04\/2026/.test(f)),
    `facts=${JSON.stringify(s.facts)}`);
  record('C.8 an answered question leaves the missing-facts list',
    s.missingFacts.length === 1 && !s.missingFacts.some(m => /date the deposit was demanded/i.test(m)),
    `missing=${JSON.stringify(s.missingFacts)}`);
  record('C.9 the tri-state support flag is stored as delivered, not coerced',
    s.professionalSupportNeeded === false && M.supportLabel(false, 'civil').includes('yourself'),
    `value=${JSON.stringify(s.professionalSupportNeeded)}`);

  // ---- tab switching / phase churn must never lose the session ----
  const turnsBefore = s.turns.length;
  for (const phase of ['listening', 'processing', 'speaking', 'listening', 'idle']) {
    s = M.voiceReducer(s, { type: 'PHASE', phase });
  }
  s = M.voiceReducer(s, { type: 'SPOKEN', text: 'ANSWER TWO' });
  record('C.10 phase changes and speaking state never discard turns (tab switching has no reset action)',
    s.turns.length === turnsBefore && s.issue === TURN1_INTAKE.issue && s.facts.length === 3);
  const spokenAgain = M.voiceReducer(s, { type: 'SPOKEN', text: 'A'.repeat(20000) });
  record('C.11 the exact spoken text is kept verbatim so Replay repeats the same answer, not a trimmed copy',
    s.lastSpoken === 'ANSWER TWO' && spokenAgain.lastSpoken.length === 12000 && spokenAgain.lastSpoken === 'A'.repeat(12000),
    `stored=${s.lastSpoken.length} oversizedStored=${spokenAgain.lastSpoken.length}`);

  // ---- intake summary ----
  const summary = M.buildIntakeSummary(s);
  const lines = summary.split('\n').map(l => l.trim()).filter(Boolean);
  const needed = ['Issue', 'Subject area', 'Location / area', 'Key facts', 'Timeline',
    'Urgency / deadline', 'Documents and evidence mentioned', 'Outcome the client is seeking',
    'Possible next step', 'Suggested legal support', 'Still to confirm'];
  record('C.12 the Client Intake Summary carries every required section',
    needed.every(n => summary.includes(n)), `missing=${needed.filter(n => !summary.includes(n)).join(',')}`);
  record('C.13 the summary repeats the disclaimer verbatim',
    /not a lawyer and does not replace professional legal advice/i.test(summary));
  record('C.14 the summary is plain language with no internal or debug fields',
    !JARGON.test(summary), (summary.match(JARGON) || [''])[0]);
  record('C.15 the summary states the facts the client actually gave, and nothing invented',
    /150000/.test(summary) && /10\/04\/2026/.test(summary) && /Hyderabad/.test(summary)
      && lines.length >= 12 && lines.length <= 30, `lines=${lines.length}`);

  const empty = M.buildIntakeSummary(M.initialVoiceSession);
  record('C.16 with nothing said yet the summary says "Not stated" instead of inventing a case',
    /Issue: Not stated/.test(empty) && /Not stated/.test(empty) && !/150000|Hyderabad/.test(empty));

  // ---- tri-state rendering of the support line ----
  const tri = [
    { v: true, expect: /lawyer|legal aid/i, name: 'true → asks for verified professional help' },
    { v: false, expect: /yourself/i, name: 'false → self-service next step, no upsell' },
    { v: 'unclear', expect: /may benefit from a lawyer/, name: 'unclear → hedged, never a claim either way' }
  ];
  for (const t of tri) {
    const label = M.supportLabel(t.v, 'civil');
    record(`C.17 supportLabel ${t.name}`, t.expect.test(label) && !/\btrue\b|\bfalse\b/.test(label), label.slice(0, 72));
  }
  const eduLabel = M.supportLabel(true, 'education');
  record('C.18 an education-domain escalation points at the university office first (student-first hierarchy)',
    /university/.test(eduLabel), eduLabel.slice(0, 80));

  // ---- memory caps ----
  let big = M.initialVoiceSession;
  for (let i = 0; i < 200; i++) big = M.voiceReducer(big, { type: 'USER_TURN', text: `question ${i}` });
  record('C.19 transcript memory is capped so a long session cannot grow unbounded',
    big.turns.length <= 60 && big.turns.length > 0, `turns=${big.turns.length}`);
  let factsState = M.initialVoiceSession;
  factsState = M.voiceReducer(factsState, {
    type: 'AGENT_ANSWER', text: 'x', sources: [],
    intake: { ...TURN1_INTAKE, keyFacts: Array.from({ length: 60 }, (_, i) => `fact ${i}`) }
  });
  record('C.20 fact slots are capped independently of how much was said',
    factsState.facts.length <= 20, `facts=${factsState.facts.length}`);

  // ---- Clear keeps consent, End resets everything ----
  s = M.voiceReducer(s, { type: 'CLEAR_TRANSCRIPT' });
  record('C.21 Clear conversation empties the transcript but keeps the consent the user already gave',
    s.turns.length === 0 && s.consented === true && s.facts.length === 0 && s.missingFacts.length === 0
      && s.lastSpoken === '' && s.phase === 'listening');
  s = M.voiceReducer(s, { type: 'RESET' });
  record('C.22 End session resets the whole session, consent included',
    s.turns.length === 0 && s.consented === false && s.phase === 'idle' && s.issue === '' && s.lastIntake === null);

  // ---- the vault shape is the app's existing one ----
  let saveState = M.voiceReducer(M.initialVoiceSession, { type: 'CONSENT_GRANTED' });
  saveState = M.voiceReducer(saveState, { type: 'USER_TURN', text: 'My landlord is keeping my deposit' });
  saveState = M.voiceReducer(saveState, {
    type: 'AGENT_ANSWER', text: 'Here is the verified position.',
    intake: TURN1_INTAKE, sources: [{ title: 'Rent control record', authority: 'Sindh', key: 'rc-1', sourceURL: 'https://example.gov.pk/rc', domain: 'civil' }]
  });
  const chat = M.toLocalChat(saveState);
  record('C.23 toLocalChat produces the app\'s existing LocalChat shape with a voice-namespaced id',
    /^voice-\d+$/.test(chat.id) && Array.isArray(chat.messages) && chat.messages.length === 2
      && chat.messages[0].role === 'user' && chat.messages[1].role === 'model'
      && typeof chat.updatedAt === 'number' && chat.title.length <= 44,
    `id=${chat.id} title="${chat.title}" keys=${Object.keys(chat).join(',')}`);
  record('C.24 saved sources keep their verified metadata so the vault entry stays traceable',
    chat.messages[1].sources.length === 1 && chat.messages[1].sources[0].title === 'Rent control record'
      && !!chat.messages[1].sources[0].sourceURL, JSON.stringify(chat.messages[1].sources[0]));

  // ---- the whole journey above ran with a storage spy attached ----
  record('C.25 ZERO writes to localStorage or sessionStorage occurred across the full session',
    writes.length === 0, JSON.stringify(writes));

  // ---- STEP D: editable fact review (EDIT_INTAKE) + nine-part case brief ----
  {
    const DERIVED = {
      issue: 'Landlord is keeping the security deposit', domain: 'property', jurisdiction: 'Sindh',
      location: 'Karachi', institution: '', keyFacts: ['Deposit of 100,000 was paid in cash'],
      timeline: ['Tenancy ended in March'], documentsMentioned: ['Rent agreement'],
      requestedOutcome: 'Get the deposit back', missingMandatoryFacts: ['Written demand sent?'],
      urgency: '30 days', evidenceStatus: 'partially documented', professionalSupportNeeded: 'unclear',
      suggestedNextStep: 'Send a written demand'
    };
    let d = M.voiceReducer(M.initialVoiceSession, { type: 'AGENT_ANSWER', text: 'A1', intake: DERIVED, sources: [] });
    d = M.voiceReducer(d, { type: 'EDIT_INTAKE', patch: { facts: ['Deposit of PKR 100,000 paid by bank transfer on 4 March'] } });
    record('D.1 EDIT_INTAKE replaces the derived wording instead of appending to it',
      d.facts.length === 1 && /bank transfer/.test(d.facts[0]) && !/in cash/.test(d.facts.join(' ')),
      JSON.stringify(d.facts));
    d = M.voiceReducer(d, { type: 'AGENT_ANSWER', text: 'A2', sources: [], intake: { ...DERIVED, keyFacts: ['Deposit paid in cash at the office'] } });
    record('D.2 a corrected slot is not overwritten by the next derived intake',
      d.facts.length === 1 && /bank transfer/.test(d.facts[0]), JSON.stringify(d.facts));
    record('D.3 an uncorrected slot still takes the newer derived value',
      d.timeline.length >= 1 && /march/i.test(d.timeline.join(' ')) && !d.correctedSlots.includes('timeline'),
      JSON.stringify(d.timeline) + ' corrected=' + JSON.stringify(d.correctedSlots));
    d = M.voiceReducer(d, { type: 'EDIT_INTAKE', patch: { documents: ['', '  '] } });
    d = M.voiceReducer(d, { type: 'AGENT_ANSWER', text: 'A3', sources: [], intake: { ...DERIVED, documentsMentioned: ['Rent agreement'] } });
    record('D.4 the client can clear a slot and it stays cleared through later merges',
      d.documents.length === 0 && d.correctedSlots.includes('documents'),
      JSON.stringify(d.documents) + ' corrected=' + JSON.stringify(d.correctedSlots));
    d = M.voiceReducer(d, { type: 'EDIT_INTAKE', patch: { institution: 'ABC Co-operative Housing Society, Karachi' } });
    const dctx = M.toAgentContext(d);
    record('D.5 corrections persist into the next request through the carried agent context',
      dctx.institution === 'ABC Co-operative Housing Society, Karachi'
        && /bank transfer/.test((dctx.facts || []).join(' ')) && !dctx.documents,
      JSON.stringify(dctx));
    record('D.6 an empty patch changes nothing',
      M.voiceReducer(d, { type: 'EDIT_INTAKE', patch: {} }) === d);

    const BRIEF_SRC = [{ title: 'Sindh Rented Premises Act record', authority: 'Sindh Assembly', sourceURL: 'https://example.gov.pk/srpa' }];
    const brief = M.buildCaseBrief(d, BRIEF_SRC);
    const parts = (brief.match(/^(\d)\./gm) || []).map(x => x[0]);
    record('D.7 the brief carries exactly nine numbered parts',
      parts.join('') === '123456789', parts.join(','));
    record('D.8 a slot the client corrected is marked confirmed by the client',
      /Facts of the case \[confirmed by the client\]/.test(brief),
      (brief.match(/^4\..*$/m) || [''])[0]);
    record('D.9 a slot still only as heard is labelled as heard, not as client-confirmed',
      /Timeline \[as heard/.test(brief) && !/Timeline \[confirmed by the client\]/.test(brief),
      (brief.match(/^5\..*$/m) || [''])[0]);
    const p9 = brief.slice(brief.indexOf('9. Verified legal basis'));
    record('D.10 retrieved law appears only in part 9, as named records with their source',
      p9.includes('Sindh Rented Premises Act record') && p9.includes('example.gov.pk')
        && !brief.slice(0, brief.indexOf('9. Verified legal basis')).includes('Sindh Rented Premises Act record'),
      p9.slice(0, 260));
    const briefNone = M.buildCaseBrief(d, []);
    record('D.11 with nothing retrieved the brief states that no legal basis is available',
      /no legal record was retrieved/i.test(briefNone.slice(briefNone.indexOf('9. Verified legal basis'))),
      briefNone.slice(briefNone.indexOf('9. Verified legal basis'), briefNone.indexOf('9. Verified legal basis') + 200));
    const briefEmpty = M.buildCaseBrief(M.initialVoiceSession, []);
    record('D.12 an unstated slot prints Not stated rather than a guess',
      /Not stated/.test(briefEmpty) && !/Karachi|landlord/i.test(briefEmpty), briefEmpty.slice(0, 260));
    record('D.13 the brief separates the client account from the verified collection',
      /Parts 1.?8 are the client/.test(briefEmpty) && /not legal advice/i.test(briefEmpty), briefEmpty.slice(-320));
  }

  const pass = results.filter(r => r.pass).length;
  const fail = results.length - pass;
  console.log(`\n==== STEP C VOICE SESSION STATE: ${pass} PASS / ${fail} FAIL (of ${results.length}) ====`);
  results.filter(r => !r.pass).forEach(r => console.log('  x ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  try { fs.rmSync(OUT, { force: true }); } catch (e) { /* scratch artifact only */ }
  process.exit(fail === 0 ? 0 : 1);
})().catch(err => {
  console.error('\n SUITE CRASHED:\n', err);
  process.exit(2);
});
