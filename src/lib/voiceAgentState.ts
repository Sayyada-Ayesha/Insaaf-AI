/**
 * src/lib/voiceAgentState.ts — the Voice Agent session state.
 *
 * Pure in-memory state for ONE voice session. It owns the conversation slots the
 * Legal Agent is allowed to carry between turns, and the plain-language Client
 * Intake Summary built from them.
 *
 * It imports no storage service and writes nothing anywhere: there is no
 * localStorage/sessionStorage call and no audio here, so there is nothing to
 * persist by accident. Saving happens only when the user presses "Save to Vault",
 * and that call goes through the app's existing chat storage. A reload, a page
 * close, End session or Clear conversation therefore discards the session.
 */
import type { AgentContext, AgentSource, IntakeSummary } from '../services/aiRuntime';
import type { LocalChat, LocalChatMessage, SourceMetadata } from '../services/storage';

export type VoicePhase = 'idle' | 'consent' | 'listening' | 'processing' | 'speaking';

export interface VoiceTurn {
  role: 'user' | 'agent';
  text: string;
  ts: number;
  sources?: AgentSource[];
}

export interface VoiceSessionState {
  phase: VoicePhase;
  /** True once the user has accepted the voice notice in this session. */
  consented: boolean;
  /** What the microphone is hearing right now (interim). Never persisted. */
  liveTranscript: string;
  turns: VoiceTurn[];
  issue: string;
  domain: string;
  jurisdiction: string;
  location: string;
  institution: string;
  facts: string[];
  timeline: string[];
  deadlines: string[];
  documents: string[];
  requestedOutcome: string;
  missingFacts: string[];
  evidenceStatus: string;
  professionalSupportNeeded: boolean | 'unclear';
  /** The most recent structured intake, exactly as the server returned it. */
  lastIntake: IntakeSummary | null;
  /**
   * Slots the CLIENT has edited. A slot named here holds the client's own words
   * and is never overwritten by a later derived intake, because the assistant's
   * reading of a hearing is not evidence of what happened at it.
   */
  correctedSlots: string[];
  /** Set only after an explicit Save to Vault succeeds. */
  savedChatId: string | null;
  /** The answer last spoken aloud, so Replay can re-queue it. */
  lastSpoken: string;
}

export const initialVoiceSession: VoiceSessionState = {
  phase: 'idle',
  consented: false,
  liveTranscript: '',
  turns: [],
  issue: '',
  domain: '',
  jurisdiction: '',
  location: '',
  institution: '',
  facts: [],
  timeline: [],
  deadlines: [],
  documents: [],
  requestedOutcome: '',
  missingFacts: [],
  evidenceStatus: '',
  professionalSupportNeeded: 'unclear',
  lastIntake: null,
  correctedSlots: [],
  savedChatId: null,
  lastSpoken: ''
};

/**
 * The slots a client may correct by hand. Factual slots only: the evidence
 * status and the professional-support flag are readings of the verified corpus,
 * not things the client was present for.
 */
export type IntakeFields = Pick<VoiceSessionState,
  'issue' | 'jurisdiction' | 'location' | 'institution'
  | 'facts' | 'timeline' | 'deadlines' | 'documents' | 'requestedOutcome'>;

export type VoiceAction =
  | { type: 'REQUEST_VOICE' }
  | { type: 'CONSENT_GRANTED' }
  | { type: 'DECLINE_VOICE' }
  | { type: 'LIVE_TRANSCRIPT'; text: string }
  | { type: 'USER_TURN'; text: string }
  | { type: 'AGENT_ANSWER'; text: string; intake: IntakeSummary | null; sources: AgentSource[] }
  | { type: 'EDIT_INTAKE'; patch: Partial<IntakeFields> }
  | { type: 'PHASE'; phase: VoicePhase }
  | { type: 'SPOKEN'; text: string }
  | { type: 'MARK_SAVED'; chatId: string }
  | { type: 'CLEAR_TRANSCRIPT' }
  | { type: 'RESET' };

/** Same caps the server applies to a carried context, enforced at the source. */
const CAPS = { item: 120, field: 160, facts: 20, timeline: 12, deadlines: 8, documents: 12, missingFacts: 12, turns: 60, spoken: 12000 };

function clean(text: string, cap = CAPS.item): string {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, cap);
}

function union(existing: string[], incoming: string[], cap: number): string[] {
  const out = [...existing];
  for (const raw of incoming || []) {
    const v = clean(raw);
    if (v && !out.some(k => k.toLowerCase() === v.toLowerCase())) out.push(v);
    if (out.length > cap) out.shift();
  }
  return out.slice(-cap);
}

/**
 * Fold one server intake into the session slots. Anything the user has now
 * answered leaves `missingFacts`, so the same question is never asked twice.
 */
export function mergeIntake(state: VoiceSessionState, intake: IntakeSummary | null): VoiceSessionState {
  if (!intake) return state;
  // A slot the client has corrected by hand keeps the client's wording: the
  // assistant's reading of what was said is not a better record of it than the
  // person who was there.
  const kept = <T>(slot: keyof IntakeFields, derived: T, fallback: T): T =>
    state.correctedSlots.includes(slot) ? fallback : derived;
  return {
    ...state,
    issue: kept('issue', clean(intake.issue, CAPS.field) || state.issue, state.issue),
    domain: intake.domain || state.domain,
    jurisdiction: kept('jurisdiction', intake.jurisdiction || state.jurisdiction, state.jurisdiction),
    location: kept('location', intake.location || state.location, state.location),
    institution: kept('institution', intake.institution || state.institution, state.institution),
    facts: kept('facts', union(state.facts, intake.keyFacts || [], CAPS.facts), state.facts),
    timeline: kept('timeline', union(state.timeline, intake.timeline || [], CAPS.timeline), state.timeline),
    documents: kept('documents', union(state.documents, intake.documentsMentioned || [], CAPS.documents), state.documents),
    requestedOutcome: kept('requestedOutcome', clean(intake.requestedOutcome, CAPS.field) || state.requestedOutcome, state.requestedOutcome),
    // The server already drops answered slots; deadlines are the urgency slot.
    missingFacts: (intake.missingMandatoryFacts || []).map(m => clean(m)).filter(Boolean).slice(0, CAPS.missingFacts),
    deadlines: intake.urgency && !state.correctedSlots.includes('deadlines')
      ? union(state.deadlines, [intake.urgency], CAPS.deadlines) : state.deadlines,
    evidenceStatus: intake.evidenceStatus || state.evidenceStatus,
    professionalSupportNeeded: intake.professionalSupportNeeded,
    lastIntake: intake
  };
}

export function voiceReducer(state: VoiceSessionState, action: VoiceAction): VoiceSessionState {
  switch (action.type) {
    case 'REQUEST_VOICE':
      return { ...state, phase: state.consented ? 'listening' : 'consent' };
    case 'CONSENT_GRANTED':
      return { ...state, consented: true, phase: 'listening' };
    case 'DECLINE_VOICE':
      return { ...state, phase: 'idle' };
    case 'LIVE_TRANSCRIPT':
      return { ...state, liveTranscript: clean(action.text, CAPS.field) };
    case 'USER_TURN': {
      const text = clean(action.text, CAPS.field * 3);
      if (!text) return state;
      return {
        ...state,
        liveTranscript: '',
        turns: [...state.turns, { role: 'user' as const, text, ts: Date.now() }].slice(-CAPS.turns),
        phase: 'processing'
      };
    }
    case 'AGENT_ANSWER': {
      const text = String(action.text || '');
      const withAnswer: VoiceSessionState = {
        ...state,
        turns: [...state.turns, { role: 'agent' as const, text, ts: Date.now(), sources: action.sources || [] }].slice(-CAPS.turns)
      };
      return mergeIntake(withAnswer, action.intake);
    }
    case 'EDIT_INTAKE': {
      const patch = action.patch;
      if (!patch || !Object.keys(patch).length) return state;
      const next: VoiceSessionState = { ...state };
      const touched = [...state.correctedSlots];
      const mark = (slot: keyof IntakeFields) => { if (!touched.includes(slot)) touched.push(slot); };
      for (const slot of ['issue', 'jurisdiction', 'location', 'institution', 'requestedOutcome'] as const) {
        if (slot in patch) {
          next[slot] = clean(String(patch[slot] ?? ''), slot === 'issue' || slot === 'requestedOutcome' ? CAPS.field : CAPS.item);
          mark(slot);
        }
      }
      for (const slot of ['facts', 'timeline', 'deadlines', 'documents'] as const) {
        if (slot in patch) {
          next[slot] = (patch[slot] || []).map(v => clean(v)).filter(Boolean).slice(0, CAPS[slot]);
          mark(slot);
        }
      }
      next.correctedSlots = touched;
      return next;
    }
    case 'PHASE':
      return { ...state, phase: action.phase };
    case 'SPOKEN':
      // Stored untouched and never summarised: this is the exact string handed to the
      // speech engine, so displayed text, spoken text and Replay stay one object.
      return { ...state, lastSpoken: String(action.text || '').slice(0, CAPS.spoken) };
    case 'MARK_SAVED':
      return { ...state, savedChatId: action.chatId };
    case 'CLEAR_TRANSCRIPT':
      return { ...initialVoiceSession, consented: state.consented, phase: 'listening' };
    case 'RESET':
      return { ...initialVoiceSession };
    default:
      return state;
  }
}

/** The carried context sent with the next turn — continuity and intake only. */
export function toAgentContext(state: VoiceSessionState): AgentContext {
  const ctx: AgentContext = {};
  if (state.issue) ctx.issue = clean(state.issue, CAPS.field);
  if (state.domain) ctx.domain = state.domain;
  if (state.jurisdiction) ctx.jurisdiction = clean(state.jurisdiction);
  if (state.location) ctx.location = clean(state.location);
  if (state.institution) ctx.institution = clean(state.institution, CAPS.field);
  if (state.facts.length) ctx.facts = state.facts.slice(-CAPS.facts);
  if (state.timeline.length) ctx.timeline = state.timeline.slice(-CAPS.timeline);
  if (state.deadlines.length) ctx.deadlines = state.deadlines.slice(-CAPS.deadlines);
  if (state.documents.length) ctx.documents = state.documents.slice(-CAPS.documents);
  if (state.requestedOutcome) ctx.requestedOutcome = clean(state.requestedOutcome, CAPS.field);
  if (state.missingFacts.length) ctx.missingFacts = state.missingFacts.slice(0, CAPS.missingFacts);
  return ctx;
}

const NOT_STATED = 'Not stated';

function line(label: string, value: string): string {
  return `${label}: ${value && value.trim() ? clean(value, 400) : NOT_STATED}`;
}

function bulletList(items: string[]): string {
  if (!items.length) return NOT_STATED;
  return `\n${items.map(i => `  - ${clean(i, 300)}`).join('\n')}`;
}

/** Plain-language rendering of the tri-state support flag — no upsell, no hedging into a claim. */
export function supportLabel(value: boolean | 'unclear', domain: string): string {
  if (value === true) {
    return domain === 'education'
      ? 'Worth taking to the university\'s official office first, and to a lawyer or legal aid service if that does not resolve it.'
      : 'A lawyer or a legal aid organisation should look at this. Ask to see the verified lawyer and legal aid lists.';
  }
  if (value === false) return 'You can take this step yourself using the guidance above.';
  return 'This may benefit from a lawyer — you can check the verified directory.';
}

/**
 * The copyable Client Intake Summary. Professional formatting, plain language,
 * and no internal fields: no scores, no verdicts, no strategy names.
 */
export function buildIntakeSummary(state: VoiceSessionState): string {
  const head = state.issue ? clean(state.issue, CAPS.field) : NOT_STATED;
  const place = [state.location, state.jurisdiction].filter(Boolean).join(', ');
  const block = [
    'Insaaf AI — Client Intake Summary',
    ''.padEnd(38, '='),
    line('Issue', head),
    line('Subject area', state.domain),
    line('Location / area', place),
    line('Institution involved', state.institution),
    `Key facts:${bulletList(state.facts)}`,
    `Timeline:${bulletList(state.timeline)}`,
    line('Urgency / deadline', state.deadlines.join('; ')),
    `Documents and evidence mentioned:${bulletList(state.documents)}`,
    line('Outcome the client is seeking', state.requestedOutcome),
    line('Possible next step', state.lastIntake?.suggestedNextStep || ''),
    line('Suggested legal support', supportLabel(state.professionalSupportNeeded, state.domain)),
    `Still to confirm:${bulletList(state.missingFacts)}`,
    '',
    `Recorded on ${new Date().toLocaleString()}.`,
    'This summary is prepared by an AI legal assistant for preliminary information and client intake. '
      + 'It is not a lawyer and does not replace professional legal advice.'
  ];
  return block.join('\n');
}

/**
 * The nine-part case brief for a lawyer or legal-aid officer.
 *
 * Parts 1–8 are the client's case in the client's own terms; part 9 is the only
 * place anything from the verified law collection appears. The two are never
 * blended: a fact the assistant inferred from speech is labelled as such, and a
 * legal proposition is never presented as something the client said.
 */
export function buildCaseBrief(state: VoiceSessionState, sources: AgentSource[] = []): string {
  const confirmed = (slot: keyof IntakeFields) => state.correctedSlots.includes(slot);
  const provenance = (slot: keyof IntakeFields) =>
    confirmed(slot) ? ' [confirmed by the client]' : ' [as heard — the client has not confirmed this]';
  const place = [state.location, state.jurisdiction].filter(Boolean).join(', ');
  const part = (n: number, title: string, body: string) => `${n}. ${title}\n${body.trim() || NOT_STATED}\n`;
  const parts = [
    part(1, 'Issue', line('Matter', state.issue)),
    part(2, 'Jurisdiction and place', line('Place / jurisdiction', place)),
    part(3, 'Institution or opposite side', line('Named institution / party', state.institution)),
    part(4, `Facts of the case${provenance('facts')}`, bulletList(state.facts)),
    part(5, `Timeline${provenance('timeline')}`, bulletList(state.timeline)),
    part(6, `Deadlines and urgency${provenance('deadlines')}`, bulletList(state.deadlines)),
    part(7, `Documents and evidence held${provenance('documents')}`, bulletList(state.documents)),
    part(8, `Relief or outcome sought${provenance('requestedOutcome')}`, line('Seeking', state.requestedOutcome)),
    part(9, 'Verified legal basis and outstanding questions', [
      sources.length
        ? `From the verified collection:\n${sources.slice(0, 6)
            .map(s => `  - ${s.title || 'Verified legal record'}${s.authority ? ` — ${s.authority}` : ''}${s.sourceURL ? ` (${s.sourceURL})` : ''}`)
            .join('\n')}`
        : '  - No legal record was retrieved for this matter, so the brief states no legal basis.',
      state.missingFacts.length ? `Still to confirm with the client:${bulletList(state.missingFacts)}` : '',
      state.evidenceStatus ? `Evidence status read from the records: ${clean(state.evidenceStatus, CAPS.field)}` : ''
    ].filter(Boolean).join('\n'))
  ];
  return [
    'Insaaf AI — Case Brief',
    ''.padEnd(38, '='),
    ...parts,
    `Prepared ${new Date().toLocaleString()} from one voice session.`,
    'Parts 1–8 are the client\'s account. Part 9 is the only part drawn from the verified law '
      + 'collection. This brief is prepared by an AI legal assistant for intake and handoff; '
      + 'it is not legal advice and has not been checked by a lawyer.'
  ].join('\n');
}

/** Honest statement of what is missing before a save or handoff can be useful. */
export function sessionIsEmpty(state: VoiceSessionState): boolean {
  return state.turns.length === 0;
}

/**
 * Convert the session to the app's existing chat shape, so "Save to Vault" writes
 * into the vault the rest of the app already reads — no new storage system.
 */
export function toLocalChat(state: VoiceSessionState): LocalChat {
  const messages: LocalChatMessage[] = state.turns.map(t => ({
    role: t.role === 'user' ? 'user' as const : 'model' as const,
    text: t.text,
    timestamp: t.ts,
    sources: (t.sources || []).map(s => ({
      title: s.title || 'Verified legal record',
      authority: s.authority,
      type: s.type,
      key: s.key,
      sourceURL: s.sourceURL,
      domain: s.domain
    } satisfies SourceMetadata))
  }));
  const title = (state.issue || messages[0]?.text || 'Voice session')
    .slice(0, 40);
  return {
    id: `voice-${Date.now()}`,
    title: `${title}${(state.issue || '').length > 40 ? '...' : ''}`,
    updatedAt: Date.now(),
    messages
  };
}
