/**
 * F12: Insaaf AI Legal Agent — legal Q&A + app self-knowledge + deep links.
 *
 * Two-layer design (never hallucinate):
 *  1. LOCAL RULE-BASED LAYER (offline-capable): directory intents are answered
 *     with REAL records from the verified local directory (lawyers / legal-aid
 *     organizations / emergency contacts), app-usage intents are answered with
 *     descriptions from the app route registry (src/config/appRoutes.ts) and
 *     rendered as navigation chips. No URLs are invented — only registry ids.
 *  2. SERVER AI LAYER (legal questions): POST /api/ai/agent grounds the
 *     answer in the verified RAG corpus and returns optional action ids that
 *     are validated against the same route manifest on the server.
 */
import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Bot, Send, Loader2, Sparkles, MapPin, Scale, Phone, ExternalLink, Building2, ShieldCheck, Navigation, Briefcase, BookOpen, ClipboardList, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { MarkdownBody } from "./MarkdownBody";
import { askLegalAgent, describeApiFailure, type AgentSource } from "../services/aiRuntime";
import { FirestoreService } from "../services/firestoreService";
import { findCityInText, searchLawyerCards, searchOrgCards, searchEmergencyCards, type DirectoryCard } from "../lib/directorySearch";
import { APP_ROUTES, getRoute, type AppRoute } from "../config/appRoutes";
import { getLibrarySectionId } from "../config/ragDomainMap";
import { getCurrentLanguage, useLanguageVersion } from "../lib/i18n";
import { evidenceBadge } from "../lib/answerEvidence";
import { provisionLabel } from "../lib/sourceLabel";
import type { EvidenceVerdict } from "../services/storage";
import { useSettings } from "../lib/settings";
import {
  CASE_INTAKE_FIELDS, INTAKE_STEPS, fieldLabel, fieldStep, intakeToAgentContext, intakeQuery,
  outstandingFieldKeys, buildCaseBrief, caseBriefToText, saveCaseIntake, loadCaseIntake,
  clearCaseIntake, type CaseBriefSection, type CaseIntakeData
} from "../lib/caseIntake";
import { copyTextToClipboard } from "../lib/clipboard";
import { cn } from "./Layout";

type AgentMsg =
  | { role: 'user'; text: string }
  | { role: 'agent'; text: string; actions?: AppRoute[]; sources?: AgentSource[]; isOffline?: boolean; evidenceVerdict?: EvidenceVerdict; cards?: DirectoryCard[]; brief?: CaseBriefSection[]; disclaimer?: string };

const SUGGESTIONS = [
  { en: "Find a criminal lawyer in Lahore", roman: "Lahore mein criminal vakeel dhounden" },
  { en: "FIR not registered — what can I do?", roman: "FIR register nahi ho rahi, kya karun?" },
  { en: "Where is the Legal Library?", roman: "Legal Library kahan hai?" },
  { en: "I need free legal aid", roman: "Mujhe muft qanooni madad chahiye" }
];

const GREETING_EN = "Assalam-o-Alaikum! I am the **Insaaf AI Legal Agent** — your guide to Pakistani law *and* to this app.\n\nAsk me about the law, about legal procedures, or how any feature of Insaaf AI works. I can also search the verified lawyer directory by city and specialization.";
const GREETING_ROMAN = "Assalam-o-Alaikum! Main **Insaaf AI Qanooni Agent** hoon — Pakistani qanoon *aur* is app ke liye aap ka guide.\n\nMujh se qanoon, qanooni karwaiyan, ya Insaaf AI ki koi feature kaise use karein, ke baare mein poochein. Main verified vakeel directory ko shehar aur specialization se bhi talaash kar sakta hoon.";

/** Internal app route intents — ids only, never invented URLs (F13). */
const ROUTE_RULES: [RegExp, string][] = [
  [/open.*(library|guide)|28 domains|library section|qanoon library/i, 'library'],
  [/legal library|law guide|qanoon maloomat/i, 'library'],
  // Student / university intents — must precede generic /application|appeal|draft/ rules
  [/university.*(?:harass|complai|shikayat)|harass.*(?:professor|teacher|university|college|campus)|university.*shikayat/i, 'draft'],
  [/show.?cause|disciplin.*(?:notice|action|proceeding)|expulsi|suspensio.*(?:university|college)|ragging|rag(?:s|ging)?\b/i, 'draft'],
  [/university.*(?:appeal|fee refund|transcript|degree attest|noc|bonafide)|appeal.*(?:university|college|exam)|fee.*refund.*university/i, 'draft'],
  [/university|college|admission.*university|fee.*structure|scholarship|hec|hostel.*(?:application|allot)|exam.*(?:appeal|result|re-eval)|degree.*(?:attest|equivalen)|student.*rights|university.*(?:transport|welfare)|academic.*probatio/i, 'chat'],
  [/draft|legal notice|notice ban|application|affidavit|contract|agreement|dastaveez/i, 'draft'],
  [/analy[sz]e|document review|explain this document|upload|review my/i, 'analyze'],
  [/procedure|karwai|workflow|fir kaise|steps|appeal|bail process|adr/i, 'procedures'],
  [/free legal|legal aid|ngo|muft/i, 'legalaid'],
  [/emergency|helpline/i, 'emergency'],
  [/settings|theme|zaban badal|preference/i, 'settings'],
  [/language|english|roman urdu|zaban/i, 'language'],
  [/voice|speak|awaaz|bolna|mic/i, 'voice'],
  [/vault|saved chat|saved document|history/i, 'vault'],
  [/lawyer|vakeel|wakil|advocate|attorney/i, 'lawyers'],
  [/chat|consult|sawal puchh/i, 'chat'],
];

export default function AgentSection({ onNavigate, onOpenLibrary, embedded = false }: { onNavigate: (route: AppRoute) => void; onOpenLibrary?: (sectionId: string) => void; embedded?: boolean }) {
  const currentLang = getCurrentLanguage();
  const rom = currentLang === 'roman_urdu';
  const showSources = useSettings().showSourceDetails;
  useLanguageVersion(); // re-render when the system language changes

  const [messages, setMessages] = useState<AgentMsg[]>(() => [
    { role: 'agent', text: rom ? GREETING_ROMAN : GREETING_EN }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Structured Case Intake. Restored per user so closing the panel, navigating
  // away or a page refresh never throws away a case someone spent time describing.
  const [showCaseIntake, setShowCaseIntake] = useState(false);
  const [caseIntakeStep, setCaseIntakeStep] = useState(0);
  const [caseIntakeData, setCaseIntakeData] = useState<CaseIntakeData>(() => loadCaseIntake());
  const [caseIntakeOutstanding, setCaseIntakeOutstanding] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isReviewStep = caseIntakeStep >= INTAKE_STEPS.length;
  const byKeyStep = (key: string) => Math.max(0, INTAKE_STEPS.indexOf(fieldStep(key)));
  const [briefCopied, setBriefCopied] = useState<string | null>(null);
  const copyBrief = async (text: string) => {
    const ok = await copyTextToClipboard(text);
    setBriefCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setBriefCopied(null), 3000);
  };
  const downloadBrief = (text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'insaaf-case-brief.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const setIntakeField = (key: string, value: string) => {
    setCaseIntakeData(prev => {
      const next = { ...prev, [key]: value };
      saveCaseIntake(next);
      return next;
    });
  };

  useEffect(() => {
    // Scroll only the panel. scrollIntoView on the sentinel also scrolls the
    // window, and this panel stays mounted inside the floating (hidden) widget.
    const el = messagesContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Update the greeting when the system language changes and no chat has happened yet
    setMessages(prev => {
      if (prev.length === 1 && prev[0].role === 'agent' && !prev[0].cards) {
        return [{ role: 'agent', text: rom ? GREETING_ROMAN : GREETING_EN }];
      }
      return prev;
    });
  }, [rom]);

  const label = (en: string, r: string) => (rom ? r : en);

  // Navigation chips: the voice chip also hands the current question to the Voice
  // Agent screen, so "ask it out loud" continues the same conversation.
  const handleChipNavigate = (a: AppRoute) => {
    if (a.id === 'voice') {
      const lastQuestion = [...messages].reverse().find(m => m.role === 'user')?.text || '';
      window.dispatchEvent(new CustomEvent('insaaf_handoff_to_voice', { detail: { text: lastQuestion } }));
    }
    onNavigate(a);
  };

  // ---------------------------------------------------------------
  // LOCAL RULE-BASED LAYER — verified directory data + route registry
  // ---------------------------------------------------------------

  // Directory search (findCityInText / searchLawyerCards / searchOrgCards /
  // searchEmergencyCards) lives in ../lib/directorySearch.ts so the Voice Agent
  // queries the same verified records with the same rules.

  const matchRouteIntent = (text: string): AppRoute | null => {
    for (const [re, id] of ROUTE_RULES) {
      if (re.test(text)) {
        const route = getRoute(id);
        if (route) return route;
      }
    }
    return null;
  };

  /** Returns a fully-formed agent message when the intent can be answered locally. */
  const tryLocalIntent = async (text: string): Promise<AgentMsg | null> => {
    // Affordability / free-aid intent — "no budget for a lawyer", "can't afford",
    // "no money", "budget/paise/fees nahi", "muft/free wakeel", "pro bono" — is a
    // request for FREE legal aid, NOT the paid lawyer directory. Detected first so
    // the legal-aid rule (2) claims it even though the word "lawyer" is present,
    // and the lawyer-directory rule (3) defers. Mirrors the backend curated rule.
    const affordSignal = /(?:can'?t|cannot|can not|could not|couldn'?t|unable to|not able to)\s+(?:afford|pay|hire)|\bno\s+(?:money|budget|funds|resources|cash)\b|\b(?:budget|paise|paisa|afford|fees)\s+nahi\b|\bafford\s+(?:nahi|karne)\b|\bnahi\s+(?:afford|bhar|de|kar)\b|\bpro\s*bono\b|\bgarib\b/i.test(text);
    const freeLawyerSignal = /\b(?:muft|free)\s+(?:wakeel|vakeel|advocate|lawyer|legal)\b/i.test(text);
    const lawyerWord = /\b(?:lawyer|wakil|vakeel|wakeel|advocate|attorney|barrister|fees)\b/i.test(text);
    const cannotAffordLawyer = freeLawyerSignal || (affordSignal && lawyerWord);

    // 1. Emergency helplines
    if (/helpline|emergency|dial\s*1\d\d|1099|1991/i.test(text) && !/lawyer|vakeel/i.test(text)) {
      const cards = await searchEmergencyCards(text);
      return {
        role: 'agent',
        text: label(
          "Here are the verified emergency helplines from the national directory. For immediate danger always call **Police 15** first.",
          "Ye verified emergency helplines hain jo national directory se li gayi hain. Khatre ki soorat mein sab se pehle **Police 15** par call karein."
        ),
        cards,
        actions: [getRoute('emergency')].filter(Boolean) as AppRoute[]
      };
    }

    // 2. Legal aid organizations — also claims "can't afford / no budget for a
    // lawyer": a free-aid request routed here (real verified NGOs) rather than to
    // the paid lawyer directory, so a citizen with no money is never asked which
    // city they want a (paid) advocate in.
    if ((/free legal|legal aid|ngo|muft qanooni|organization|foundation|mohtasib|khiradmand/i.test(text) && !/lawyer|vakeel/i.test(text)) || cannotAffordLawyer) {
      const { cards, usedCity } = await searchOrgCards(text);
      if (cards.length > 0) {
        return {
          role: 'agent',
          text: label(
            `I found ${cards.length} verified legal aid organization${cards.length > 1 ? 's' : ''}${usedCity ? ` in ${usedCity}` : ''} for you. All details below come from the verified directory — no fabricated contacts.`,
            `Main ne aap ke liye ${cards.length} verified legal aid organization${cards.length > 1 ? '' : ''}${usedCity ? ` ${usedCity} mein` : ''} dhoundi hain. Neeche di gayi tamam details verified directory se hain — koi jaali contact nahi.`
          ),
          cards,
          actions: [getRoute('legalaid')].filter(Boolean) as AppRoute[]
        };
      }
    }

    // 3. Lawyer directory search (city / specialization / budget) — but NOT when
    // the user cannot afford one; that free-aid case is claimed by rule 2 above.
    if (/lawyer|vakeel|wakil|advocate|attorney|bar council/i.test(text) && !cannotAffordLawyer) {
      const { cards, usedCity, usedSpec, budgetAsked } = await searchLawyerCards(text, rom);
      if (usedCity && cards.length > 0) {
        const feeNote = budgetAsked
          ? label(
            " Note: the Bar Councils do not publish verified fee schedules, so fees cannot be matched from public records. Always confirm fees directly with the advocate.",
            " Note: Bar Councils verified fee schedule publish nahi karte, is liye public records se fee matching mumkin nahi. Fee ki tasdeeq hamesha vakeel se khud karein."
          )
          : "";
        return {
          role: 'agent',
          text: label(
            `Here ${cards.length > 1 ? 'are' : 'is'} ${cards.length} verified advocate${cards.length > 1 ? 's' : ''} in ${usedCity}${usedSpec ? ` (${usedSpec})` : ''}. These are real bar-roll records from the verified directory.${feeNote}`,
            `Ye ${cards.length} verified advocate${usedCity ? ` ${usedCity} mein` : ''}${usedSpec ? ` (${usedSpec})` : ''} hain. Ye asli bar-roll records hain jo verified directory se liye gaye hain.${feeNote}`
          ),
          cards,
          actions: [getRoute('lawyers')].filter(Boolean) as AppRoute[]
        };
      }
      // F6: no city detected — ask for the city instead of showing mixed-city records
      if (!usedCity) {
        return {
          role: 'agent',
          text: label(
            `Which city do you need an advocate in? The verified directory is organized by city, so tell me your city${usedSpec ? ` — I can also narrow the search to ${usedSpec}` : ''} and I will show the verified bar-roll records there.`,
            `Aap ko kis shehar mein vakeel chahiye? Verified directory shehar ke mutabiq hai, is liye apna shehar batayen${usedSpec ? ` — main ${usedSpec} tak talaash seemit bhi kar sakta hoon` : ''} aur main wahan ke verified bar-roll records dikhaunga.`
          ),
          actions: [getRoute('lawyers')].filter(Boolean) as AppRoute[]
        };
      }
      // F6: city given but no verified records there yet — say so honestly
      return {
        role: 'agent',
        text: label(
          `I could not find verified bar-roll records for ${usedCity} in the directory yet. The directory keeps growing — you can open the lawyers page to browse the latest verified entries.`,
          `Directory mein abhi tak ${usedCity} ke verified bar-roll records nahi mile. Directory mein izafa hota rehta hai — taaza verified entries dekhne ke liye lawyers page kholein.`
        ),
        actions: [getRoute('lawyers')].filter(Boolean) as AppRoute[]
      };
    }

    // 3b. F6: bare city name — answer locally with that city's verified directory
    {
      const trimmed = text.trim().toLowerCase();
      if (trimmed.length <= 24 && /^[a-z\s.'\-]+$/.test(trimmed)) {
        const all = await FirestoreService.getLawyers();
        const city = findCityInText(trimmed, all);
        if (city && trimmed === city.toLowerCase()) {
          const { cards } = await searchLawyerCards(city);
          if (cards.length > 0) {
            return {
              role: 'agent',
              text: label(
                `Here ${cards.length > 1 ? 'are' : 'is'} ${cards.length} verified advocate${cards.length > 1 ? 's' : ''} in **${city}** from the verified directory. You can also ask me for a specific specialization or city.`,
                `**${city}** mein ${cards.length} verified advocate hain jo verified directory se hain. Aap kisi khaas specialization ya doosre shehar ke liye bhi pooch sakte hain.`
              ),
              cards,
              actions: [getRoute('lawyers')].filter(Boolean) as AppRoute[]
            };
          }
        }
      }
    }

    // 3c. Student / university intents — return multi-action guidance
    const studentSignal = /university|college|admission|fee.*(?:structur|refund)|scholarship|hec|hostel|exam.*(?:result|appeal|re-eval)|degree.*(?:attest|equivalen)|student.*rights|show.?cause|disciplin.*(?:notice|action)|expulsi|suspensio|ragging|harass.*(?:professor|teacher|campus)|academic.*probatio|transcript|bonafide|noc.*university|university.*(?:transport|welfare|complai|shikayat)/i;
    if (studentSignal.test(text)) {
      const isComplaint = /harass|complai|shikayat|show.?cause|disciplin|ragging|expulsi|suspensio/i.test(text);
      const isApplication = /fee.*refund|transcript|degree.*attest|noc|bonafide|hostel.*appl|scholarship.*appl|exam.*appeal/i.test(text);
      if (isComplaint) {
        return {
          role: 'agent',
          text: label(
            "I can help you with a university complaint. You can **draft** a formal complaint or application using the verified templates (anti-harassment complaint, reply to show-cause notice, disciplinary appeal). You can also **chat** for legal guidance based on the Protection Against Harassment of Women at the Workplace Act 2010 and your university's applicable regulations.",
            "Main aap ko university complaint mein madad kar sakta hoon. Aap verified templates ke zariye formal complaint ya application **draft** kar sakte hain (anti-harassment complaint, show-cause notice ka jawab, disciplinary appeal). Aap qanooni rehnumai ke liye **chat** bhi kar sakte hain — Protection Against Harassment of Women at the Workplace Act 2010 aur aap ki university ke applicable regulations ke mutabiq."
          ),
          actions: [getRoute('draft'), getRoute('chat')].filter(Boolean) as AppRoute[]
        };
      }
      if (isApplication) {
        return {
          role: 'agent',
          text: label(
            "I can help you draft a university application. Verified templates are available for fee refund, transcript request, degree attestation, hostel application, scholarship application, examination appeal, and NOC/bonafide certificate requests.",
            "Main aap ko university application likhne mein madad kar sakta hoon. Verified templates maujood hain: fee refund, transcript request, degree attestation, hostel application, scholarship application, examination appeal, aur NOC/bonafide certificate."
          ),
          actions: [getRoute('draft')].filter(Boolean) as AppRoute[]
        };
      }
      return {
        role: 'agent',
        text: label(
          "I can help with student and university legal questions. You can **chat** for legal guidance grounded in Pakistani law (Article 25-A, HEC policies, Protection Against Harassment Act, university regulations). You can also browse the **Library** section on Education Rights for detailed guidance. Where a rule is university-specific, I will tell you to check your university's applicable regulations.",
          "Main student aur university ke qanooni sawalon mein madad kar sakta hoon. Aap Pakistani law (Article 25-A, HEC policies, Protection Against Harassment Act, university regulations) ki bunyad par qanooni rehnumai ke liye **chat** kar sakte hain. Aap **Library** mein Education Rights ki tafseeli rehnumai bhi dekh sakte hain. Jahan qaida university-specific hota hai, main aap ko aap ki university ke applicable regulations check karne ka bataunga."
        ),
        actions: [getRoute('chat'), getRoute('library')].filter(Boolean) as AppRoute[]
      };
    }

    // 4. App-usage / navigation intents (route registry only — no invented URLs)
    const route = matchRouteIntent(text);
    if (route) {
      return {
        role: 'agent',
        text: label(
          `You can do that in **${route.labelEn}**. ${route.description} Tap the button below and I will take you straight there.`,
          `Ye aap **${route.labelRoman}** mein kar sakte hain. ${route.description} Neeche button dabayen, main aap ko seedha wahan le jaunga.`
        ),
        actions: [route]
      };
    }

    // 5. Greeting / general help
    if (/^(hi|hello|hey|salam|assalam|aadaab|help|madad|start|begin)\b/i.test(text.trim())) {
      return {
        role: 'agent',
        text: label(
          "Here is what I can do for you:\n\n1. **Answer legal questions** — grounded in the verified Pakistani law corpus.\n2. **Find lawyers** — by city and specialization from the verified directory.\n3. **Find legal aid** — verified NGOs and free legal aid organizations.\n4. **Guide you in the app** — library, drafting, procedures, settings, voice and more.\n\nTry one of the suggestions below.",
          "Main aap ke liye ye kar sakta hoon:\n\n1. **Qanooni sawalon ke jawab** — verified Pakistani law corpus se.\n2. **Vakeel talaash** — shehar aur specialization ke mutabiq verified directory se.\n3. **Legal aid talaash** — verified NGOs aur muft qanooni madad ki organizations.\n4. **App mein rehnumai** — library, drafting, procedures, settings, voice waghera.\n\nNeeche di gayi suggestions mein se koi try karein."
        )
      };
    }

    return null;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsLoading(true);
    try {
      const local = await tryLocalIntent(text);
      if (local) {
        setMessages(prev => [...prev, local]);
        return;
      }
      // SERVER AI LAYER — legal questions grounded in the RAG corpus
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'agent')
        .slice(-6)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'model', content: m.text }));
      const reply = await askLegalAgent(text, currentLang, null, history);
      const actions = reply.actions
        .map(id => getRoute(id))
        .filter((r): r is AppRoute => !!r);
      setMessages(prev => [...prev, {
        role: 'agent',
        text: reply.reply,
        actions,
        sources: reply.sources,
        isOffline: reply.isOffline,
        evidenceVerdict: reply.evidence?.verdict
      }]);
    } catch (err) {
      // Name the real fault: an absent API route is a deployment problem, not a
      // user connection problem, and must not be reported as a retry nudge.
      const detail = describeApiFailure(err, currentLang === 'roman_urdu' ? 'roman_urdu' : 'en');
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `${detail}\n\n${label(
          "The lawyer directory and app guidance are still available.",
          "Wakilon ki directory aur app rehnumai ab bhi mojood hain."
        )}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Analyse the collected intake. `intakeQuery` puts the facts themselves into the
   * retrieval query and `intakeToAgentContext` carries them as structured context —
   * the previous build passed `null` here, so the case was collected and then thrown away.
   */
  const handleCaseAnalysis = async () => {
    if (isAnalyzing) return;
    const context = intakeToAgentContext(caseIntakeData);
    if (!context) {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: label(
          "There is nothing in the intake to analyse yet. At least tell me what happened.",
          "Intake mein abhi koi maloomat nahi ke un ka jaiza liya ja sake. Kam az kam yeh batayen ke hua kya."
        )
      }]);
      return;
    }
    const query = intakeQuery(caseIntakeData);
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setIsAnalyzing(true);
    try {
      const reply = await askLegalAgent(query, currentLang, context, []);
      const actions = reply.actions
        .map(id => getRoute(id))
        .filter((r): r is AppRoute => !!r);
      const brief = buildCaseBrief({ data: caseIntakeData, intake: reply.intake, sources: reply.sources, rom });
      setCaseIntakeOutstanding(outstandingFieldKeys(caseIntakeData, reply.intake));
      setMessages(prev => [...prev, {
        role: 'agent',
        text: reply.reply,
        actions,
        sources: reply.sources,
        isOffline: reply.isOffline,
        evidenceVerdict: reply.evidence?.verdict,
        brief: brief.sections,
        disclaimer: brief.disclaimer
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: label(
          "The case could not be analysed right now. Your intake answers are kept — try again in a moment.",
          "Abhi case ka jaiza nahi ho saka. Aap ke intake javab mehfooz hain — thori der baad dobara koshish karein."
        )
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };



  return (
    <div className={cn(
      "flex flex-col",
      embedded ? "h-full w-full" : "max-w-3xl mx-auto h-[calc(100vh-16rem)] min-h-[480px]"
    )}>
      {/* Header */}
      <div className={cn("flex items-center gap-4", embedded ? "mb-3" : "mb-6")}>
        <div className={cn("bg-[#01411C] rounded-2xl flex items-center justify-center shadow-lg shadow-[#01411C]/20 shrink-0", embedded ? "w-9 h-9" : "w-12 h-12")}>
          <Bot className={cn("text-white", embedded ? "w-5 h-5" : "w-6 h-6")} />
        </div>
        <div>
          <h2 className={cn("font-black tracking-tight text-gray-900", embedded ? "text-base" : "text-2xl")}>
            {label("Insaaf AI Legal Agent", "Insaaf AI Qanooni Agent")}
          </h2>
          {!embedded && (
            <p className="text-xs font-medium text-gray-400 mt-0.5">
              {label("Law + app guidance, grounded in verified knowledge", "Qanoon + app rehnumai, verified maloomat par mabni")}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto pr-1 space-y-4 pb-4">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}
          >
            <div className={cn(
              "max-w-[85%] rounded-3xl px-5 py-4 text-sm leading-relaxed",
              m.role === 'user'
                ? "bg-[#01411C] text-white rounded-br-lg"
                : "bg-white border border-gray-100 shadow-sm text-gray-700 rounded-bl-lg"
            )}>
              {m.role === 'user' ? (
                <p className="whitespace-pre-wrap font-medium">{m.text}</p>
              ) : (
                <div className="space-y-3">
                  <div className="markdown-body text-sm">
                    <MarkdownBody text={m.text} />
                  </div>

                  {/* Case brief A–K — the structured result of the intake analysis */}
                  {m.brief && m.brief.length > 0 && (
                    <div data-testid="case-brief" className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#01411C]">
                          {label("Case brief", "Case brief")}
                        </p>
                        <div className="flex gap-2 shrink-0">
                          <button
                            data-testid="case-brief-copy"
                            onClick={() => copyBrief(caseBriefToText({ sections: m.brief!, disclaimer: m.disclaimer || '' }))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[10px] font-bold text-gray-600 hover:border-[#01411C] hover:text-[#01411C] transition-all"
                          >
                            {briefCopied === 'ok'
                              ? <><CheckCircle2 className="w-3 h-3" /> {label("Copied", "Copy ho gaya")}</>
                              : briefCopied === 'fail'
                                ? <><AlertCircle className="w-3 h-3" /> {label("Copy failed", "Copy nahi hua")}</>
                                : <><ClipboardList className="w-3 h-3" /> {label("Copy", "Copy")}</>}
                          </button>
                          <button
                            data-testid="case-brief-download"
                            onClick={() => downloadBrief(caseBriefToText({ sections: m.brief!, disclaimer: m.disclaimer || '' }))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[10px] font-bold text-gray-600 hover:border-[#01411C] hover:text-[#01411C] transition-all"
                          >
                            <Download className="w-3 h-3" /> {label("Download", "Download")}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        {m.brief.map(s => (
                          <div key={s.id}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{s.title}</p>
                            <ul className="mt-0.5 space-y-1">
                              {s.lines.map((line, li) => (
                                <li key={li} className="text-xs text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{line}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      {m.disclaimer && (
                        <p className="text-[10px] text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
                          {m.disclaimer}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Directory cards (verified local data) */}
                  {m.cards && m.cards.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {m.cards.map((c, ci) => (
                        <div key={ci} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          {c.kind === 'lawyer' && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                                <Scale className="w-4 h-4 text-[#01411C]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-gray-900 truncate">{c.record.fullName}</p>
                                <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 shrink-0" /> {c.record.city}{c.record.province ? `, ${c.record.province}` : ''}
                                </p>
                                <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                  <Briefcase className="w-3 h-3 shrink-0" /> {c.record.specialization}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {c.record.enrollmentNumber ? `${label("Enrollment", "Enrollment")}: ${c.record.enrollmentNumber} · ` : ''}
                                  {c.record.barCouncil || ''} · {c.record.verifiedStatus}
                                </p>
                              </div>
                            </div>
                          )}
                          {c.kind === 'org' && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                                <Building2 className="w-4 h-4 text-blue-700" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-gray-900 truncate">{c.record.name}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{c.record.description}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-400">
                                  {c.record.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.record.phone}</span>}
                                  {c.record.website && (
                                    <a href={c.record.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#01411C] hover:underline">
                                      {label("Website", "Website")} <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          {c.kind === 'emergency' && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                                <Phone className="w-4 h-4 text-red-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-gray-900 truncate">{c.record.name}</p>
                                <p className="text-[11px] font-bold text-red-600 mt-0.5">{c.record.phone}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{c.record.description}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Navigation action chips — only ids from the route registry */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {m.actions.map(a => (
                        <button
                          key={a.id}
                          onClick={() => handleChipNavigate(a)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#01411C] text-white text-[11px] font-bold hover:scale-105 active:scale-95 transition-all shadow-sm"
                        >
                          <Navigation className="w-3 h-3" />
                          {label(`Open ${a.labelEn}`, `Kholen ${a.labelRoman}`)} →
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Sources — compact citations (F14: never bulky citation blocks) */}
                  {showSources && m.sources && m.sources.length > 0 && (
                    <div className="pt-1 border-t border-gray-100">
                      {m.sources.map((s, si) => {
                        const ref = provisionLabel(s);
                        const heading = s.title || ref;
                        if (!heading) return null;
                        return (
                        <div key={si} className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <ShieldCheck className="w-3 h-3 shrink-0 text-[#01411C]" />
                          {heading}
                          {s.authority ? ` · ${s.authority}` : ''}
                          {s.title && ref ? ` · ${ref}` : ''}
                          {onOpenLibrary && getLibrarySectionId(s.domain) && (
                            <button
                              onClick={() => onOpenLibrary(getLibrarySectionId(s.domain)!)}
                              className="text-[#01411C] hover:underline flex items-center gap-0.5 shrink-0 font-bold"
                            >
                              <BookOpen className="w-3 h-3" /> {label("Library", "Library")}
                            </button>
                          )}
                          {s.sourceURL && (
                            <a href={s.sourceURL} target="_blank" rel="noopener noreferrer" className="text-[#01411C] hover:underline flex items-center gap-0.5 shrink-0">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {(() => {
                    const badge = evidenceBadge(m.evidenceVerdict, 'legal', (m.sources || []).length > 0);
                    if (!badge) return null;
                    return (
                      <p className={cn(
                        "text-[10px] font-bold rounded-full px-3 py-1 inline-flex items-center gap-1.5 border",
                        badge.grounded
                          ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                          : "text-amber-700 bg-amber-50 border-amber-100"
                      )}>
                        {badge.grounded
                          ? <CheckCircle2 className="w-3 h-3" />
                          : <AlertCircle className="w-3 h-3" />}
                        {badge.label}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 shadow-sm rounded-3xl rounded-bl-lg px-5 py-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#01411C]" />
              <span className="text-xs font-bold text-gray-400">
                {label("Legal Agent is thinking...", "Qanooni Agent soch raha hai...")}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 shrink-0">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => { setInput(rom ? s.roman : s.en); }}
            className="px-3.5 py-2 rounded-full bg-white border border-gray-200 text-[11px] font-bold text-gray-500 hover:border-[#01411C] hover:text-[#01411C] transition-all whitespace-nowrap shrink-0"
          >
            {rom ? s.roman : s.en}
          </button>
        ))}
        <button
          data-testid="case-intake-toggle"
          onClick={() => { setShowCaseIntake(!showCaseIntake); setCaseIntakeStep(0); }}
          className={cn("px-3.5 py-2 rounded-full border text-[11px] font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5",
            showCaseIntake ? "bg-[#01411C] border-[#01411C] text-white" : "bg-white border-gray-200 text-gray-500 hover:border-[#01411C] hover:text-[#01411C]")}
        >
          <ClipboardList className="w-3.5 h-3.5" /> {label("Case Intake", "Case Intake")}
        </button>
      </div>

      {/* Input */}
      <div className="shrink-0 pt-2">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full p-2 shadow-sm focus-within:ring-4 focus-within:ring-[#01411C]/5 transition-all">
          <Sparkles className="w-4 h-4 text-[#01411C] ml-3 shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={label(
              "Ask about the law, procedures, or this app...",
              "Qanoon, karwaiyan, ya is app ke baare mein poochein..."
            )}
            className="flex-1 text-sm font-medium bg-transparent outline-none placeholder:text-gray-300 py-2"
            maxLength={2000}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-[#01411C] text-white flex items-center justify-center disabled:opacity-40 hover:scale-105 active:scale-95 transition-all shrink-0"
            aria-label={label("Send", "Bhejen")}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-300 font-medium mt-2">
          {label(
            "Directory answers come from the verified local directory. Legal answers are grounded in the verified law corpus.",
            "Directory ke jawab verified local directory se aate hain. Qanooni jawab verified law corpus par mabni hote hain."
          )}
        </p>
      </div>

      {/* Structured Case Intake Panel — 12 items, every one skippable, reviewed
          and editable before anything is analysed. */}
      {showCaseIntake && (
        <div className="shrink-0 pt-4 border-t border-gray-100 mt-2">
          <div data-testid="case-intake-panel" className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#01411C]/10 text-[#01411C] flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">{label("Structured Case Intake", "Structured Case Intake")}</h3>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {isReviewStep
                      ? label("Review before analysis", "Jaiza se pehle check karen")
                      : `${label("Step", "Qadam")} ${caseIntakeStep + 1} / ${INTAKE_STEPS.length + 1}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCaseIntake(false)} aria-label={label("Close", "Band karen")} title={label("Close", "Band karen")} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900">
                ✕
              </button>
            </div>

            <p className="text-[10px] text-gray-400 font-medium">
              {label(
                "Anything you leave blank is reported as missing — Insaaf AI never fills a case fact in for you. Your answers are kept on this device for you alone.",
                "Jo jagah aap khali chhoren ge, wohi kami batayi jayegi — Insaaf AI aap ke liye koi qanooni baat ijadah nahi karta. Aap ke javab sirf aap ke liye is device par mehfooz hain."
              )}
            </p>

            {caseIntakeOutstanding.length > 0 && (
              <div data-testid="case-intake-still-needed" className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-1">
                  {label("The verified records still need", "Tasdeeq shuda records ko abhi yeh chahiye")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {caseIntakeOutstanding.map(k => (
                    <button
                      key={k}
                      data-testid={`intake-jump-${k}`}
                      onClick={() => setCaseIntakeStep(byKeyStep(k))}
                      className="px-2 py-1 rounded-lg bg-white border border-amber-300 text-[10px] font-bold text-amber-800 hover:bg-amber-100"
                    >
                      {fieldLabel(k, rom)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isReviewStep && CASE_INTAKE_FIELDS.filter(f => f.step === INTAKE_STEPS[caseIntakeStep]).map(f => (
              <div key={f.key} className="space-y-2">
                <label htmlFor={`intake-${f.key}`} className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {rom ? f.labelRoman : f.labelEn}
                  <span className="normal-case font-medium text-gray-300"> · {label("optional", "ikhtiyari")}</span>
                </label>
                {f.kind === 'choice' ? (
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label={rom ? f.labelRoman : f.labelEn}>
                    {(f.options || []).map(o => (
                      <button
                        key={o.value}
                        type="button"
                        id={`intake-${f.key}-${o.value}`}
                        data-testid={`intake-${f.key}-${o.value}`}
                        aria-pressed={caseIntakeData[f.key] === o.value}
                        onClick={() => setIntakeField(f.key, caseIntakeData[f.key] === o.value ? '' : o.value)}
                        className={cn("px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all",
                          caseIntakeData[f.key] === o.value
                            ? o.value === 'high' ? 'bg-red-100 border-red-300 text-red-800'
                              : o.value === 'medium' ? 'bg-amber-100 border-amber-300 text-amber-800'
                              : 'bg-green-100 border-green-300 text-green-800'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400')}
                      >
                        {rom ? o.roman : o.en}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    id={`intake-${f.key}`}
                    data-testid={`intake-${f.key}`}
                    value={caseIntakeData[f.key] || ''}
                    onChange={(e) => setIntakeField(f.key, e.target.value)}
                    rows={f.kind === 'area' ? 3 : 1}
                    maxLength={1200}
                    placeholder={rom ? (f.helpRoman || "Likhein…") : (f.helpEn || "Type here…")}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-sm font-medium text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-[#01411C]/5 outline-none resize-none"
                  />
                )}
                {f.kind === 'choice' && (f.helpEn || f.helpRoman) && (
                  <p className="text-[10px] text-gray-400">{rom ? f.helpRoman : f.helpEn}</p>
                )}
              </div>
            ))}

            {isReviewStep && (
              <div className="space-y-2">
                {CASE_INTAKE_FIELDS.map(f => (
                  <div key={f.key} data-testid={`intake-review-${f.key}`} className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{rom ? f.labelRoman : f.labelEn}</p>
                      <p className={cn("text-xs mt-0.5 whitespace-pre-wrap break-words", caseIntakeData[f.key] ? "text-gray-800" : "text-gray-400 italic")}>
                        {caseIntakeData[f.key] || label("Not stated", "Bayan nahi kiya gaya")}
                      </p>
                    </div>
                    <button
                      onClick={() => setCaseIntakeStep(INTAKE_STEPS.indexOf(f.step))}
                      className="text-[10px] font-black uppercase tracking-wider text-[#01411C] hover:underline shrink-0"
                    >
                      {label("Edit", "Tarmeem")}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setCaseIntakeStep(Math.max(0, caseIntakeStep - 1))}
                disabled={caseIntakeStep === 0}
                className="px-4 py-2 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:border-gray-400 disabled:opacity-30 transition-all"
              >
                {label("Back", "Wapas")}
              </button>
              <div className="flex flex-wrap gap-2">
                {!isReviewStep && (
                  <button
                    data-testid="case-intake-skip"
                    onClick={() => setCaseIntakeStep(Math.min(INTAKE_STEPS.length, caseIntakeStep + 1))}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:border-gray-400 transition-all"
                  >
                    {label("Skip question", "Sawal chhoren")}
                  </button>
                )}
                {!isReviewStep ? (
                  <button
                    data-testid="case-intake-next"
                    onClick={() => setCaseIntakeStep(Math.min(INTAKE_STEPS.length, caseIntakeStep + 1))}
                    className="px-4 py-2 rounded-xl bg-[#01411C] text-white text-[10px] font-black uppercase tracking-wider hover:scale-105 transition-all flex items-center gap-1.5"
                  >
                    {caseIntakeStep === INTAKE_STEPS.length - 1 ? label("Review", "Jaiza") : label("Next", "Agla")} <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    data-testid="case-intake-analyse"
                    onClick={handleCaseAnalysis}
                    disabled={isAnalyzing}
                    className="px-4 py-2 rounded-xl bg-[#01411C] text-white text-[10px] font-black uppercase tracking-wider hover:scale-105 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {isAnalyzing
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Scale className="w-3.5 h-3.5" />}
                    {label("Analyse my case", "Mera case jaizen")}
                  </button>
                )}
                <button
                  data-testid="case-intake-clear"
                  onClick={() => { clearCaseIntake(); setCaseIntakeData({}); setCaseIntakeOutstanding([]); setCaseIntakeStep(0); }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-400 hover:border-red-300 hover:text-red-600 transition-all"
                >
                  {label("Clear intake", "Intake mitayen")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
