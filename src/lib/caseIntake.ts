/**
 * §4 Structured Case Intake — the single source of truth for the Legal Agent's
 * case data flow.
 *
 * Before this module existed the intake form collected answers into component
 * state that was never handed to the analysis call (askLegalAgent received a
 * literal null context), so the legal answer was produced as if no intake had
 * happened. Every function here is what that call needs: the 12 items, the
 * mapping from collected answers to the server's AgentContext, the query the
 * evidence gate retrieves with, the outstanding-question computation and the
 * A–K case brief.
 */
import { auth } from './firebase';
import type { AgentContext, AgentSource, IntakeSummary } from '../services/aiRuntime';

export type CaseIntakeData = Record<string, string>;

export const NOT_STATED_EN = 'Not stated';
export const NOT_STATED_ROMAN = 'Bayan nahi kiya gaya';

export interface IntakeField {
  key: string;
  step: number;
  labelEn: string;
  labelRoman: string;
  helpEn?: string;
  helpRoman?: string;
  kind: 'text' | 'area' | 'choice';
  options?: { value: string; en: string; roman: string }[];
  /** Maps to a slot the server can report as missing, so intake stays adaptive. */
  slot?: string;
}

export const CASE_INTAKE_FIELDS: IntakeField[] = [
  { key: 'matter', step: 0, labelEn: 'What is this case about?', labelRoman: 'Yeh muqadma kis baare mein hai?', kind: 'text', slot: 'matter' },
  { key: 'facts', step: 0, labelEn: 'Brief facts — what happened', labelRoman: 'Mukhtasir waqiyat — kya hua', kind: 'area' },
  { key: 'parties', step: 1, labelEn: 'Who is involved (parties)', labelRoman: 'Kaun shamil hai (fareeqain)', kind: 'text', slot: 'institution' },
  { key: 'dates', step: 1, labelEn: 'When did it happen (dates)', labelRoman: 'Kab hua (tareekhein)', kind: 'text', slot: 'dates' },
  { key: 'place', step: 2, labelEn: 'City or district', labelRoman: 'Shehar ya zila', kind: 'text', slot: 'location' },
  { key: 'forum', step: 2, labelEn: 'Court, office or committee involved', labelRoman: 'Adalat, office ya committee', kind: 'text', helpEn: 'Leave blank if you do not know — Insaaf AI works out the forum from the verified records.', helpRoman: 'Na jaante hon to khali chhoren — tasdeeq shuda records se forum maloom ho jata hai.' },
  { key: 'institution', step: 2, labelEn: 'Institution or opposite party named', labelRoman: 'Institution ya doosre fareeq ka naam', kind: 'text', slot: 'institution' },
  { key: 'documents', step: 3, labelEn: 'Documents or evidence you already have', labelRoman: 'Jo documents ya saboot aap ke paas hain', kind: 'area', slot: 'documents' },
  { key: 'witnesses', step: 3, labelEn: 'Witnesses available (if any)', labelRoman: 'Gawah (agar hon)', kind: 'text' },
  { key: 'priorSteps', step: 4, labelEn: 'Steps already taken', labelRoman: 'Pehle ke gaye qadam', kind: 'text', helpEn: 'e.g. FIR registered, notice sent, application or appeal filed.', helpRoman: 'Masalan FIR darj, notice bheja, darkhwast ya appeal jama.' },
  { key: 'urgency', step: 4, labelEn: 'How urgent is it?', labelRoman: 'Kitni jaldi hai?', kind: 'choice', options: [
    { value: 'high', en: 'Urgent — a date is close', roman: 'Fauri — tareekh qareeb hai' },
    { value: 'medium', en: 'Soon — within weeks', roman: 'Jald — hafton mein' },
    { value: 'low', en: 'Normal — no date pressure', roman: 'Aam — koi tareekh ki jaldi nahi' }
  ] },
  { key: 'deadline', step: 4, labelEn: 'Deadline or hearing date', labelRoman: 'Deadline ya peshi ki tareekh', kind: 'text', slot: 'dates' },
  { key: 'outcome', step: 5, labelEn: 'What outcome are you seeking?', labelRoman: 'Aap kis natije ki talabgar hain?', kind: 'text', slot: 'outcome' }
];

export const INTAKE_STEPS = [...new Set(CASE_INTAKE_FIELDS.map(f => f.step))].sort((a, b) => a - b);

const byKey = new Map(CASE_INTAKE_FIELDS.map(f => [f.key, f]));
export const fieldLabel = (key: string, rom: boolean): string => {
  const f = byKey.get(key);
  if (!f) return key;
  return rom ? f.labelRoman : f.labelEn;
};

export const fieldStep = (key: string): number => (byKey.get(key) || { step: 0 }).step;

const clean = (v?: string) => String(v || '').replace(/[<>]/g, '').trim();

/** Collected answers -> the server's AgentContext. No field is dropped. */
export function intakeToAgentContext(data: CaseIntakeData): AgentContext | null {
  const facts: string[] = [];
  if (clean(data.parties)) facts.push(`Parties: ${clean(data.parties)}`);
  if (clean(data.witnesses)) facts.push(`Witnesses: ${clean(data.witnesses)}`);
  if (clean(data.priorSteps)) facts.push(`Already done: ${clean(data.priorSteps)}`);
  const context: AgentContext = {
    issue: clean(data.matter) || undefined,
    location: clean(data.place) || undefined,
    jurisdiction: clean(data.forum) || undefined,
    institution: clean(data.institution) || undefined,
    requestedOutcome: clean(data.outcome) || undefined,
    facts: [clean(data.facts), ...facts].filter(Boolean),
    timeline: clean(data.dates) ? [clean(data.dates)] : [],
    deadlines: clean(data.deadline)
      ? [`${clean(data.deadline)}${clean(data.urgency) ? ` (stated urgency: ${data.urgency})` : ''}`]
      : (clean(data.urgency) ? [`Stated urgency: ${data.urgency}`] : []),
    documents: clean(data.documents) ? clean(data.documents).split(/[\n,;]+/).map(s => s.trim()).filter(Boolean) : []
  };
  const hasAnything = Object.values(context).some(v => (typeof v === 'string' ? v.length > 0 : Array.isArray(v) && v.length > 0));
  return hasAnything ? context : null;
}

/**
 * The retrieval query. /api/ai/agent uses `message` as its ONLY query, so the
 * intake facts must be in it — otherwise the evidence gate sees a one-line label
 * and the collected case never reaches the law.
 */
export function intakeQuery(data: CaseIntakeData, maxChars = 1800): string {
  const parts = [
    clean(data.matter),
    clean(data.facts),
    clean(data.parties) && `Parties: ${clean(data.parties)}`,
    clean(data.dates) && `When: ${clean(data.dates)}`,
    clean(data.place) && `Where: ${clean(data.place)}`,
    clean(data.forum) && `Forum: ${clean(data.forum)}`,
    clean(data.institution) && `Against/institution: ${clean(data.institution)}`,
    clean(data.documents) && `Documents: ${clean(data.documents)}`,
    clean(data.priorSteps) && `Already done: ${clean(data.priorSteps)}`,
    clean(data.deadline) && `Deadline: ${clean(data.deadline)}`,
    clean(data.outcome) && `Seeking: ${clean(data.outcome)}`
  ].filter(Boolean) as string[];
  const joined = parts.join('. ').replace(/\.{2,}/g, '.');
  const lead = 'Legal problem from a structured case intake: ';
  const room = maxChars - lead.length;
  return lead + (joined.length > room ? `${joined.slice(0, Math.max(0, room - 1))}…` : joined);
}

/**
 * Which intake items are still outstanding. The server already computes
 * missingMandatoryFacts from everything now known, so an answered item is never
 * asked again — that is what keeps the intake adaptive instead of a fixed loop.
 *
 * The server reports a missing fact as a sentence ("the city or district this
 * happened in"), so the slot is recognised by the same keywords the server's own
 * SLOT_KEYWORDS table uses — matching on the slot name alone never fires.
 */
const SLOT_TO_KEYS: [RegExp, string[]][] = [
  [/city|district|shehar|ilaqa|area|location|place|address/i, ['place', 'forum']],
  [/date|timeline|tareekh|waqt|when/i, ['dates', 'deadline']],
  [/amount|raqqam|sum|money|fee|salary/i, ['facts']],
  [/document|dastavez|paper|record|evidence|proof/i, ['documents']],
  [/outcome|result|target|maqsad|what you want|relief/i, ['outcome']],
  [/university|college|institute|school|hostel|office|court|police station/i, ['institution', 'parties']]
];

export function outstandingFieldKeys(data: CaseIntakeData, intake?: IntakeSummary | null): string[] {
  const missing = (intake && intake.missingMandatoryFacts) || [];
  const keys = new Set<string>();
  for (const phrase of missing) {
    const slot = SLOT_TO_KEYS.find(([re]) => re.test(String(phrase)));
    for (const key of slot ? slot[1] : []) {
      if (!clean(data[key])) keys.add(key);
    }
  }
  return [...keys];
}

export interface CaseBriefSection {
  id: string;
  title: string;
  lines: string[];
}

export const CASE_BRIEF_DISCLAIMER_EN =
  'This case brief is prepared by the Insaaf AI legal assistant from the facts you entered and the '
  + 'verified records retrieved for them. It is general legal information for intake and handoff, not '
  + 'personalised professional legal advice, and it has not been checked by a lawyer. No outcome is '
  + 'predicted or guaranteed.';
export const CASE_BRIEF_DISCLAIMER_ROMAN =
  'Y case brief Insaaf AI legal assistant ne aap ke diay gaye haqaiq aur tasdeeq shuda records se banaya '
  + 'hai. Yeh aam qanooni maloomat hai — intake aur handoff ke liye — kisi licensed wakeel ke mashware ka '
  + 'mutabadil nahi, aur isay kisi wakeel ne check nahi kiya. Kisi natijay ki pishan-goi ya guarantee nahi ki gayi.';

/**
 * A–K. Sections that have nothing verified to say state that instead of being
 * filled in: an empty section is a finding about the case, not a gap to invent into.
 */
export function buildCaseBrief(opts: {
  data: CaseIntakeData;
  intake?: IntakeSummary | null;
  sources?: AgentSource[];
  rom: boolean;
}): { sections: CaseBriefSection[]; disclaimer: string } {
  const { data, intake, sources = [], rom } = opts;
  const none = rom ? NOT_STATED_ROMAN : NOT_STATED_EN;
  const st = (v?: string) => (clean(v) || none);
  const list = (items: string[]) => (items.length ? items : [none]);
  const lawLines = sources
    .filter(s => s && (s.title || s.key))
    .slice(0, 6)
    .map(s => {
      const provision = s.key ? `${s.type === 'ARTICLE' ? 'Article' : 'Section'} ${s.key}` : '';
      return [s.title || 'Verified legal record', s.authority || '', provision, s.sourceURL || ''].filter(Boolean).join(' — ');
    });
  const userDocs = clean(data.documents).split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const routeLines = [
    clean(data.forum) && `Named forum: ${clean(data.forum)}`,
    intake && intake.domain && `Subject area in the verified records: ${intake.domain}`,
    intake && intake.suggestedNextStep && `Route the records support: ${intake.suggestedNextStep}`
  ].filter(Boolean) as string[];

  const T = (en: string, roman: string) => (rom ? roman : en);
  const sections: CaseBriefSection[] = [
    {
      id: 'A', title: T('A. Case summary', 'A. Case ka khulasa'),
      lines: list([
        clean(data.matter) && `Matter: ${clean(data.matter)}`,
        clean(data.facts),
        clean(data.parties) && `Parties: ${clean(data.parties)}`,
        clean(data.institution) && `Institution / other side: ${clean(data.institution)}`
      ] as string[])
    },
    {
      id: 'B', title: T('B. Issues identified', 'B. Nishandehi shuda masail'),
      lines: list([
        ...(intake && intake.keyFacts && intake.keyFacts.length ? intake.keyFacts.map(f => `- ${f}`) : []),
        clean(data.outcome) ? `Sought outcome: ${clean(data.outcome)}` : ''
      ] as string[])
    },
    {
      id: 'C', title: T('C. Jurisdiction', 'C. Adalat ka ilaqa / jurisdiction'),
      lines: list([
        `Place stated: ${st(data.place)}`,
        `Forum stated: ${st(data.forum)}`,
        intake && intake.jurisdiction ? `Province from the records: ${intake.jurisdiction}` : ''
      ] as string[])
    },
    {
      id: 'D', title: T('D. Relevant law (from the verified records)', 'D. Mutaliqa qanoon (tasdeeq shuda records se)'),
      lines: lawLines.length ? lawLines.map(l => `- ${l}`) : [T(
        'No provision in the verified collection matched these facts, so this brief states no law. Add the law or section name, or take these facts to a lawyer.',
        'Tasdeeq shuda zakhire mein in haqaiq se milti julti koi dhara nahi mili, is liye yeh brief koi qanoon nahi batata. Qanoon ya dhara ka naam izafa karein, ya yeh haqaiq wakeel le jayen.'
      )]
    },
    {
      id: 'E', title: T('E. Possible legal routes', 'E. Mumkin qanooni raastey'),
      lines: list(routeLines)
    },
    {
      id: 'F', title: T('F. Evidence checklist', 'F. Saboot ki check list'),
      lines: list([
        ...userDocs.map(d => `- Held: ${d}`),
        clean(data.witnesses) ? `- Witnesses stated: ${clean(data.witnesses)}` : '',
        clean(data.dates) ? `- Dates to prove: ${clean(data.dates)}` : '',
        `- ${T('Keep originals plus one copy of every document you file or receive.',
          'Har document ki asli aur ek copy mehfooz rakhein jo aap jama karte hain ya dete hain.')}`
      ] as string[])
    },
    {
      id: 'G', title: T('G. Missing information', 'G. Kami shuda maloomat'),
      lines: (intake && intake.missingMandatoryFacts && intake.missingMandatoryFacts.length)
        ? intake.missingMandatoryFacts.map(m => `- Still needed: ${m}`)
        : [T('The verified records had no outstanding mandatory fact for this matter.',
            'Tasdeeq shuda records ke mutabiq is matter mein koi zaroori maloomat kami nahi.')]
    },
    {
      id: 'H', title: T('H. Practical next steps', 'H. Amali agley qadam'),
      lines: list([
        intake && intake.suggestedNextStep ? intake.suggestedNextStep : '',
        clean(data.priorSteps) ? `Already done (say so once, keep proof): ${clean(data.priorSteps)}` : ''
      ] as string[])
    },
    {
      id: 'I', title: T('I. Urgency and deadlines', 'I. Jaldi aur deadlines'),
      lines: list([
        clean(data.deadline) ? `Deadline stated: ${clean(data.deadline)}` : '',
        clean(data.urgency) ? `Urgency stated: ${clean(data.urgency)}` : '',
        ...(intake && intake.timeline && intake.timeline.length ? [`Timeline from the intake: ${intake.timeline.join('; ')}`] : []),
        `- ${T('A deadline you have not confirmed with the court or office is not a safe date. Confirm it before acting.',
            'Jo deadline adalat ya office se tasdeeq na ho, woh mehfooz tareekh nahi. Qadam uthane se pehle tasdeeq karein.')}`
      ] as string[])
    },
    {
      id: 'J', title: T('J. Document assistance', 'J. Document ki madad'),
      lines: [T(
        'Insaaf AI can draft the notice, application, complaint or appeal this matter needs from these facts in the Document Assistant — the draft states as [MISSING: …] anything the intake did not answer, and never invents a fact to fill a blank.',
        'Insaaf AI Document Assistant mein in haqaiq se zaroori notice, darkhwast, shikayat ya appeal ka maswoda tayyar kar sakta hai — jahan intake mein jawab na ho, wahan maswoda [MISSING: …] likhta hai, khaali jagah bharne ke liye koi baat ijadah nahi karta.'
      )]
    },
    {
      id: 'K', title: T('K. Human assistance', 'K. Insani madad'),
      lines: [
        intake && intake.professionalSupportNeeded === true
          ? T('A lawyer or legal aid organisation should look at this matter before you act.',
              'Aap ko qadam uthane se pehle yeh matter wakeel ya muft qanooni madad ke organisation ko dikhana chahiye.')
          : T('You may still want an advocate to confirm these facts and the forum before you file anything.',
              'Koi bhi darkhwast jama karne se pehle ek advocate se haqaiq aur forum tasdeeq karana behtar hai.'),
        T('Open the verified lawyer directory or the free legal aid list to find someone near you. Insaaf AI does not contact anyone for you and cannot book an appointment.',
          'Apne qareeb kisi vakeel ke liye verified lawyer directory, ya muft madad ke liye legal aid list kholein. Insaaf AI aap ki taraf se kisi se raabta nahi karta aur appointment book nahi kar sakta.')
      ]
    }
  ];
  return { sections, disclaimer: rom ? CASE_BRIEF_DISCLAIMER_ROMAN : CASE_BRIEF_DISCLAIMER_EN };
}

export function caseBriefToText(brief: { sections: CaseBriefSection[]; disclaimer: string }): string {
  return [
    'Insaaf AI — Case Brief (Legal Agent intake)',
    '='.repeat(46),
    ...brief.sections.map(s => `${s.title}\n${s.lines.join('\n')}`),
    '',
    brief.disclaimer
  ].join('\n');
}

/** Per-user isolation: a different account or a guest never reads this intake. */
export function intakeStorageKey(): string {
  const uid = (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.uid) || 'guest';
  return `insaaf_case_intake_${uid}`;
}

export function saveCaseIntake(data: CaseIntakeData): void {
  try { localStorage.setItem(intakeStorageKey(), JSON.stringify(data)); } catch { /* storage full or blocked */ }
}

export function loadCaseIntake(): CaseIntakeData {
  try {
    const raw = localStorage.getItem(intakeStorageKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as CaseIntakeData : {};
  } catch {
    return {};
  }
}

export function clearCaseIntake(): void {
  try { localStorage.removeItem(intakeStorageKey()); } catch { /* ignore */ }
}
