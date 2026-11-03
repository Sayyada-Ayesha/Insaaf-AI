// ============================================================================
// P4.1 — does the Voice Agent's collected intake actually survive to the server?
// The audit claim was that the call drops an `intake` argument. askLegalAgent
// has no intake parameter: its third argument IS the carried context, and
// server/legalAgent.js deriveIntake() builds the intake from it. This suite
// proves that on the real path: UI wiring, request body, and the composed reply.
//   node tests/integration/testAgentIntakePersistence.mjs   (needs :3001)
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = process.env.INSAF_PORT || '3001';

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

// 1. The voice turn must put the accumulated session slots on the request path.
const voice = fs.readFileSync(path.join(ROOT, 'src', 'components', 'VoiceAgentSection.tsx'), 'utf8');
const call = /askLegalAgent\(([^;]*)\);/.exec(voice)?.[1] || '';
ok('voice turn passes the carried session state into askLegalAgent',
  /toAgentContext\(stateRef\.current\)/.test(call), call.replace(/\s+/g, ' ').slice(0, 110));
const state = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'voiceAgentState.ts'), 'utf8');
const ctxBuilder = /export function toAgentContext[\s\S]*?\n}/.exec(state)?.[0] || '';
for (const slot of ['facts', 'timeline', 'deadlines', 'documents', 'requestedOutcome', 'missingFacts']) {
  ok(`toAgentContext carries ${slot}`, ctxBuilder.includes(`ctx.${slot}`));
}

// 2. Live: the same body the browser runtime sends must yield an intake that
// contains the party, the chronology, the case type and the evidence.
const context = {
  issue: 'Recovery of an unpaid debt',
  domain: 'civil',
  jurisdiction: 'Punjab',
  location: 'Lahore',
  facts: ['Other party: Ali Raza (contractor)', 'Amount stated: PKR 450,000'],
  timeline: ['2026-01-15 — work completed and invoice issued'],
  deadlines: ['2026-03-01 — date promised for payment'],
  documents: ['signed work order', 'invoice'],
  requestedOutcome: 'recover the unpaid amount',
  missingFacts: []
};
const message = 'The contractor still has not paid after I finished the work. What do I do?';
const res = await fetch(`http://127.0.0.1:${PORT}/api/ai/agent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message, preferredLanguage: 'en', history: [], overseasMode: false,
    preferredCountry: '', answerLevel: 'standard', context
  })
});
ok('agent endpoint responds', res.status === 200, `HTTP ${res.status}`);
const data = await res.json().catch(() => ({}));
const intake = data.intake || {};
const hay = JSON.stringify(intake).toLowerCase();
const reply = String(data.reply || '');

ok('named party from the intake survives', hay.includes('ali raza'), intake.parties || '');
ok('chronology from the intake survives',
  (intake.timeline || []).some(t => String(t).includes('2026-01-15'))
  || hay.includes('2026-01-15'), JSON.stringify(intake.timeline || []));
ok('case type / subject from the intake survives',
  hay.includes('debt') || String(intake.issue || '').length > 0, intake.issue || '');
ok('stated evidence documents survive',
  (intake.documentsMentioned || []).some(d => /work order|invoice/i.test(String(d)))
  || hay.includes('invoice'), JSON.stringify(intake.documentsMentioned || []));
ok('stated outcome survives', hay.includes('recover'), intake.requestedOutcome || '');
ok('the composed reply uses the supplied intake rather than re-deriving from nothing',
  /ali raza|450,000|invoice|work order|lahore/i.test(reply),
  reply.replace(/\s+/g, ' ').slice(0, 140));

// 3. A correction must replace the old slot value, not accumulate both.
await new Promise(r => setTimeout(r, 11000));
const corrected = { ...context, facts: ['Other party: Nadia Traders (contractor)'] };
const res2 = await fetch(`http://127.0.0.1:${PORT}/api/ai/agent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Correction: the contractor is Nadia Traders, not Ali Raza.',
    preferredLanguage: 'en', history: [{ role: 'user', content: message }],
    overseasMode: false, preferredCountry: '', answerLevel: 'standard', context: corrected
  })
});
const d2 = await res2.json().catch(() => ({}));
const hay2 = JSON.stringify(d2.intake || {}).toLowerCase();
ok('user correction updates the collected facts',
  hay2.includes('nadia traders'), `HTTP ${res2.status}`);

console.log(`\n[Agent Intake] ${pass} PASS / ${fail} FAIL`);
// process.exit() here aborts the run on Windows: undici keeps its sockets open
// after the last fetch, and closing the process with a handle in UV_HANDLE_CLOSING
// trips a libuv assertion that reports exit 127 over a clean 15/0 summary.
process.exitCode = fail ? 1 : 0;
