/**
 * §13 Case-Agent regression (sprint §4).
 *
 * Guards the data flow the previous build broke: the Legal Agent collected a case
 * intake and then called /api/ai/agent with a literal `null` context, so every
 * answer was produced as if no intake had happened. These checks prove that
 * nothing collected is dropped between the first intake question and the analysis
 * call, that the brief carries all eleven A–K sections, and that honesty rules
 * (no invented facts, no predicted outcome, per-user storage) hold.
 *
 * Run: npx tsx tests/unit/testCaseIntakeFlow.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CASE_INTAKE_FIELDS, INTAKE_STEPS, fieldStep, intakeToAgentContext, intakeQuery,
  outstandingFieldKeys, buildCaseBrief, caseBriefToText, intakeStorageKey,
  NOT_STATED_EN, CASE_BRIEF_DISCLAIMER_EN, CASE_BRIEF_DISCLAIMER_ROMAN
} from '../../src/lib/caseIntake';
import { auth } from '../../src/lib/firebase';
import { sanitizeAgentContext, CONTEXT_LIMITS } from '../../server/legalAgent.js';

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`PASS ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ''}`); console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

/** A fully answered intake, each field carrying a value unique enough to search for. */
const FULL: Record<string, string> = {
  matter: 'fee refund after forced withdrawal',
  facts: 'I was withdrawn in 12 March 2026 and the hostel fee was not returned',
  parties: 'Syed Ali Raza and GCU Hyderabad',
  dates: 'filed application 12 March 2026, reply due 30 April 2026',
  place: 'Hyderabad',
  forum: 'Sindh Consumer Court',
  institution: 'Government College University Hyderabad',
  documents: 'withdrawal application, fee challan, email reply',
  witnesses: 'room mate Bilal Ahmed',
  priorSteps: 'submitted a written request to the vice chancellor office',
  urgency: 'high',
  deadline: '30 April 2026',
  outcome: 'refund of Rs. 85,000 hostel fee'
};

// --- CA1: the intake itself ---------------------------------------------------
ok('CA1.1 intake declares at least the 12 required items', CASE_INTAKE_FIELDS.length >= 12, `got ${CASE_INTAKE_FIELDS.length}`);
ok('CA1.2 every field key is unique', new Set(CASE_INTAKE_FIELDS.map(f => f.key)).size === CASE_INTAKE_FIELDS.length);
ok('CA1.3 every field maps to a step that exists', CASE_INTAKE_FIELDS.every(f => INTAKE_STEPS.includes(f.step)));
ok('CA1.4 fieldStep resolves a known key and never crashes on an unknown one',
  fieldStep('documents') === CASE_INTAKE_FIELDS.find(f => f.key === 'documents')!.step && fieldStep('nope') === 0);
ok('CA1.5 every field is filled by the sample intake (no untested slot)',
  CASE_INTAKE_FIELDS.every(f => FULL[f.key] !== undefined));

// --- CA2: nothing collected is silently discarded -----------------------------
const q = intakeQuery(FULL);
const missingFromQuery = CASE_INTAKE_FIELDS
  .filter(f => f.kind !== 'choice')
  .filter(f => !q.toLowerCase().includes(FULL[f.key].toLowerCase()))
  .map(f => f.key);
const ctx = intakeToAgentContext(FULL)!;
const droppedAnywhere = missingFromQuery.filter(k => {
  const v = FULL[k].toLowerCase();
  return !JSON.stringify(ctx).toLowerCase().includes(v);
});
ok('CA2.1 every free-text intake answer reaches the query or the structured context',
  droppedAnywhere.length === 0, `dropped: ${droppedAnywhere.join(', ')}`);
ok('CA2.2 the retrieval query carries the case facts, not just a label',
  q.startsWith('Legal problem from a structured case intake:') && q.includes('hostel fee was not returned'));
ok('CA2.3 a query longer than the cap is bounded, not discarded',
  intakeQuery({ ...FULL, facts: 'x'.repeat(4000) }, 400).length <= 400);
ok('CA2.4 scalar slots land in the context',
  ctx.issue === FULL.matter && ctx.location === 'Hyderabad'
  && ctx.jurisdiction === 'Sindh Consumer Court' && ctx.institution === FULL.institution
  && ctx.requestedOutcome === FULL.outcome);
ok('CA2.5 documents become a list, dates a timeline, deadline+urgency one deadline entry',
  ctx.documents.length === 3
  && ctx.timeline[0] === FULL.dates
  && ctx.deadlines[0].includes('30 April 2026') && ctx.deadlines[0].includes('stated urgency: high'));
ok('CA2.6 parties, witnesses and prior steps are carried as facts',
  ctx.facts.some(f => f.startsWith('Parties:')) && ctx.facts.some(f => f.startsWith('Witnesses:'))
  && ctx.facts.some(f => f.startsWith('Already done:')));
ok('CA2.7 urgency alone still produces a context (never a null after one answer)',
  intakeToAgentContext({ urgency: 'low' })?.deadlines[0] === 'Stated urgency: low');
ok('CA2.8 an empty intake yields no context so the UI can refuse honestly',
  intakeToAgentContext({}) === null && intakeToAgentContext({ facts: '   ' }) === null);

// --- CA3: the payload survives the server's own bounds ------------------------
const serverCtx = sanitizeAgentContext(ctx);
ok('CA3.1 the server accepts the intake context rather than discarding it',
  serverCtx !== null && serverCtx.issue === FULL.matter && serverCtx.location === 'Hyderabad');
ok('CA3.2 the serialized context stays inside CONTEXT_LIMITS.total',
  JSON.stringify(serverCtx).length <= CONTEXT_LIMITS.total);
ok('CA3.3 oversized intake is bounded, not blanked',
  (() => {
    const big = sanitizeAgentContext(intakeToAgentContext({ ...FULL, facts: 'a'.repeat(5000) }))!;
    return big !== null && big.facts.length > 0 && JSON.stringify(big).length <= CONTEXT_LIMITS.total;
  })());
ok('CA3.4 the query stays inside the endpoint limit (MAX_QUERY_LENGTH 4000)',
  intakeQuery(FULL).length <= 4000);

// --- CA4: adaptivity is driven by the server, and answered slots drop out -----
const fakeIntake = {
  issue: '', domain: 'student', jurisdiction: 'Sindh', location: 'Hyderabad', institution: '',
  keyFacts: [], timeline: [], urgency: '', documentsMentioned: [], requestedOutcome: '',
  missingMandatoryFacts: ['the amount involved', 'what outcome you are seeking', 'the city or district this happened in'],
  suggestedNextStep: '', professionalSupportNeeded: false as const, evidenceStatus: 'supported'
} as any;
ok('CA4.1 an answered slot is never re-asked',
  !outstandingFieldKeys(FULL, fakeIntake).includes('outcome'));
ok('CA4.2 an unanswered slot surfaces as a jump target',
  outstandingFieldKeys({ ...FULL, place: '', forum: '' }, fakeIntake).includes('place'));
ok('CA4.3 no intake answer and no server verdict means no outstanding chips',
  outstandingFieldKeys({}, null).length === 0);

// --- CA5: the A–K brief -------------------------------------------------------
const brief = buildCaseBrief({ data: FULL, intake: fakeIntake, sources: [
  { title: 'HEC dispute resolution / fee refund policy', authority: 'HEC', key: '12', type: 'SECTION', sourceURL: 'https://hec.gov.cn/fee' } as any
], rom: false });
const ids = brief.sections.map(s => s.id).join('');
ok('CA5.1 the brief has exactly sections A to K in order', ids === 'ABCDEFGHIJK', `got ${ids}`);
const requiredTitles = ['Case summary', 'Issues identified', 'Jurisdiction', 'Relevant law',
  'Possible legal routes', 'Evidence checklist', 'Missing information', 'Practical next steps',
  'Urgency and deadlines', 'Document assistance', 'Human assistance'];
ok('CA5.2 each section is the one §4 names',
  requiredTitles.every((t, i) => brief.sections[i].title.includes(t)),
  brief.sections.map(s => s.title).join(' | '));
const text = caseBriefToText(brief);
ok('CA5.3 the user’s own facts appear in section A', text.includes('Syed Ali Raza') && text.includes('GCU Hyderabad'));
ok('CA5.4 a stated amount is preserved, not rounded or dropped', text.includes('Rs. 85,000'));
ok('CA5.5 section D cites a retrieved record, verbatim from its metadata',
  brief.sections[3].lines.some(l => l.includes('Section 12') && l.includes('https://hec.gov.cn/fee')));
ok('CA5.6 section G reports the server’s missing facts',
  brief.sections[6].lines.some(l => l.includes('the amount involved')));
ok('CA5.7 a full name is never shortened', text.includes('Syed Ali Raza') && !/\bMr\. Ali\b/.test(text));

// --- CA6: honesty — an empty case states that instead of inventing -------------
const emptyBrief = buildCaseBrief({ data: { matter: '' }, intake: null, sources: [], rom: false });
ok('CA6.1 an unrecorded point is reported as a gap, never as law',
  emptyBrief.sections[3].lines[0].startsWith('No provision in the verified collection matched these facts'));
ok('CA6.2 a blank field reads "Not stated" rather than a guess',
  emptyBrief.sections[2].lines.some(l => l.includes(`Place stated: ${NOT_STATED_EN}`)));
ok('CA6.3 no invented section number appears when no record matched',
  !/Section \d+|Article \d+/.test(emptyBrief.sections[3].lines.join(' ')));
ok('CA6.4 an unconfirmed deadline is qualified, never promised',
  emptyBrief.sections[8].lines.join(' ').includes('is not a safe date'));
ok('CA6.5 INSAaf claims no contact or booking capability',
  emptyBrief.sections[10].lines.join(' ').includes('does not contact anyone for you'));

// --- CA7: disclaimer and the no-guarantee rule ---------------------------------
ok('CA7.1 the English brief says it is not personalised professional legal advice',
  CASE_BRIEF_DISCLAIMER_EN.includes('not personalised professional legal advice')
  && CASE_BRIEF_DISCLAIMER_EN.includes('No outcome is predicted or guaranteed.'));
ok('CA7.2 the Roman brief carries the same disclaimer, not the English one',
  buildCaseBrief({ data: FULL, intake: null, sources: [], rom: true }).disclaimer === CASE_BRIEF_DISCLAIMER_ROMAN
  && CASE_BRIEF_DISCLAIMER_ROMAN.includes('Kisi natijay ki pishan-goi ya guarantee nahi ki gayi'));
ok('CA7.3 the brief never predicts a result',
  !/\b(you will win|sure win|guaranteed outcome|certain victory)\b/i.test(text));

// --- CA8: per-user isolation ----------------------------------------------------
ok('CA8.1 a signed-out visitor gets the guest key', intakeStorageKey() === 'insaaf_case_intake_guest');
const savedUser = (auth as any).currentUser;
let signedInKey = '';
try {
  (auth as any).currentUser = { uid: 'user-AAA' };
  signedInKey = intakeStorageKey();
} finally {
  (auth as any).currentUser = savedUser;
}
ok('CA8.2 the key follows the signed-in account, so another user cannot read it',
  signedInKey === 'insaaf_case_intake_user-AAA', `got ${signedInKey || '(auth.currentUser is read-only)'}`);
ok('CA8.3 the key returns to guest once the session is cleared',
  intakeStorageKey() === 'insaaf_case_intake_guest' && auth.currentUser === savedUser);

// --- CA9: the component is wired to this module, not to a null context ---------
const ui = readFileSync(path.resolve(process.cwd(), 'src/components/AgentSection.tsx'), 'utf8');
ok('CA9.1 the analysis call passes the intake as structured context',
  /askLegalAgent\(query, currentLang, context/.test(ui));
ok('CA9.2 the analysis call sends the intake as the retrieval query too',
  ui.includes('const query = intakeQuery(caseIntakeData)') && ui.includes('const context = intakeToAgentContext(caseIntakeData)'));
ok('CA9.3 the brief is rendered, copied and downloadable',
  ui.includes('data-testid="case-brief"') && ui.includes('case-brief-copy') && ui.includes('case-brief-download'));
ok('CA9.4 intake answers are persisted per user and restored, and closing the panel does not clear them',
  ui.includes('useState<CaseIntakeData>(() => loadCaseIntake())') && /saveCaseIntake\(next\)/.test(ui));
ok('CA9.5 every item is skippable and there is a review step before analysis',
  ui.includes('data-testid="case-intake-skip"') && ui.includes('isReviewStep') && ui.includes('data-testid="case-intake-analyse"'));
ok('CA9.6 clearing the intake is an explicit labelled action, never silent',
  ui.includes('data-testid="case-intake-clear"') && ui.includes('clearCaseIntake()'));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
process.exit(0);
