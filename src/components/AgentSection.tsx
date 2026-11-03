/**
 * F12: INSAaf Legal Agent — legal Q&A + app self-knowledge + deep links.
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
import { Bot, Send, Loader2, Sparkles, MapPin, Scale, Phone, ExternalLink, Building2, ShieldCheck, Navigation, Briefcase, BookOpen, ClipboardList, AlertCircle, CheckCircle2 } from "lucide-react";
import { MarkdownBody } from "./MarkdownBody";
import { askLegalAgent, type AgentSource } from "../services/aiRuntime";
import { FirestoreService } from "../services/firestoreService";
import { findCityInText, searchLawyerCards, searchOrgCards, searchEmergencyCards, type DirectoryCard } from "../lib/directorySearch";
import { APP_ROUTES, getRoute, type AppRoute } from "../config/appRoutes";
import { getLibrarySectionId } from "../config/ragDomainMap";
import { getCurrentLanguage, useLanguageVersion } from "../lib/i18n";
import { useSettings } from "../lib/settings";
import { cn } from "./Layout";

type AgentMsg =
  | { role: 'user'; text: string }
  | { role: 'agent'; text: string; actions?: AppRoute[]; sources?: AgentSource[]; isOffline?: boolean; cards?: DirectoryCard[] };

const SUGGESTIONS = [
  { en: "Find a criminal lawyer in Lahore", roman: "Lahore mein criminal vakeel dhounden" },
  { en: "FIR not registered — what can I do?", roman: "FIR register nahi ho rahi, kya karun?" },
  { en: "Where is the Legal Library?", roman: "Legal Library kahan hai?" },
  { en: "I need free legal aid", roman: "Mujhe muft qanooni madad chahiye" }
];

const GREETING_EN = "Assalam-o-Alaikum! I am the **INSAaf Legal Agent** — your guide to Pakistani law *and* to this app.\n\nAsk me about the law, about legal procedures, or how any feature of Insaaf AI works. I can also search the verified lawyer directory by city and specialization.";
const GREETING_ROMAN = "Assalam-o-Alaikum! Main **INSAaf Qanooni Agent** hoon — Pakistani qanoon *aur* is app ke liye aap ka guide.\n\nMujh se qanoon, qanooni karwaiyan, ya Insaaf AI ki koi feature kaise use karein, ke baare mein poochein. Main verified vakeel directory ko shehar aur specialization se bhi talaash kar sakta hoon.";

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

  // Structured Case Intake
  const [showCaseIntake, setShowCaseIntake] = useState(false);
  const [caseIntakeStep, setCaseIntakeStep] = useState(0);
  const [caseIntakeData, setCaseIntakeData] = useState<Record<string, string>>({});

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
        isOffline: reply.isOffline
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: label(
          "The Legal Agent could not respond right now. Please try again — the lawyer directory and app guidance are still available.",
          "Qanooni Agent abhi jawab nahi de paya. Dobara koshish karein — wakilon ki directory aur app rehnumai ab bhi mojood hain."
        )
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------

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
            {label("INSAaf Legal Agent", "INSAaf Qanooni Agent")}
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
                      {m.sources.map((s, si) => (
                        <div key={si} className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <ShieldCheck className="w-3 h-3 shrink-0 text-[#01411C]" />
                          {s.title || 'Verified source'}
                          {s.authority ? ` · ${s.authority}` : ''}
                          {s.key && s.type ? ` · ${s.type} ${s.key}` : ''}
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
                      ))}
                    </div>
                  )}

                  {m.isOffline && (
                    <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3" />
                      {label("Verified legal knowledge", "Tasdeeq shuda qanooni maloomat")}
                    </p>
                  )}
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
          onClick={() => { setShowCaseIntake(!showCaseIntake); setCaseIntakeStep(0); setCaseIntakeData({}); }}
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

      {/* Structured Case Intake Panel */}
      {showCaseIntake && (
        <div className="shrink-0 pt-4 border-t border-gray-100 mt-2">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#01411C]/10 text-[#01411C] flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">{label("Structured Case Intake", "Structured Case Intake")}</h3>
                  <p className="text-[10px] text-gray-400 font-medium">{label("Step", "Qadam")} {caseIntakeStep + 1} / 6</p>
                </div>
              </div>
              <button onClick={() => { setShowCaseIntake(false); setCaseIntakeStep(0); setCaseIntakeData({}); }} aria-label={label("Close", "Band karen")} title={label("Close", "Band karen")} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900">
                ✕
              </button>
            </div>

            {caseIntakeStep === 0 && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label("What happened? Brief facts", "Kya hua? Mukhtasir waqiyat")}</label>
                <textarea
                  value={caseIntakeData.facts || ''}
                  onChange={(e) => setCaseIntakeData({ ...caseIntakeData, facts: e.target.value })}
                  rows={3}
                  placeholder={label("Describe the issue briefly...", "Masla mukhtasir likhein...")}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-sm font-medium text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-[#01411C]/5 outline-none resize-none"
                />
              </div>
            )}

            {caseIntakeStep === 1 && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label("Who is involved? (Parties)", "Kaun shamil hai? (Fareeqain)")}</label>
                <input
                  type="text"
                  value={caseIntakeData.parties || ''}
                  onChange={(e) => setCaseIntakeData({ ...caseIntakeData, parties: e.target.value })}
                  placeholder={label("e.g. I am the tenant, landlord is Ahmed", "Masalan: Main kirayedar hoon, malik Ahmed hai")}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-sm font-medium text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-[#01411C]/5 outline-none"
                />
              </div>
            )}

            {caseIntakeStep === 2 && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label("Where? (City / Jurisdiction)", "Kahan? (Shehar / Adalat)")}</label>
                <input
                  type="text"
                  value={caseIntakeData.jurisdiction || ''}
                  onChange={(e) => setCaseIntakeData({ ...caseIntakeData, jurisdiction: e.target.value })}
                  placeholder={label("e.g. Lahore, District Court", "Masalan: Lahore, Zila Adalat")}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-sm font-medium text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-[#01411C]/5 outline-none"
                />
              </div>
            )}

            {caseIntakeStep === 3 && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label("How urgent is it?", "Kitni jaldi hai?")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {['low', 'medium', 'high'].map((urg) => (
                    <button
                      key={urg}
                      onClick={() => setCaseIntakeData({ ...caseIntakeData, urgency: urg })}
                      className={cn("px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all",
                        caseIntakeData.urgency === urg
                          ? urg === 'high' ? 'bg-red-100 border-red-300 text-red-800'
                            : urg === 'medium' ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : 'bg-green-100 border-green-300 text-green-800'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400')}
                    >
                      {urg === 'high' ? label("Urgent", "Fauri") : urg === 'medium' ? label("Soon", "Jald") : label("Normal", "Aam")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {caseIntakeStep === 4 && (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label("What evidence do you have?", "Kya saboot hai?")}</label>
                <textarea
                  value={caseIntakeData.evidence || ''}
                  onChange={(e) => setCaseIntakeData({ ...caseIntakeData, evidence: e.target.value })}
                  rows={2}
                  placeholder={label("e.g. Written agreement, WhatsApp messages, witnesses", "Masalan: Likhita muahida, WhatsApp messages, gawah")}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 text-sm font-medium text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-[#01411C]/5 outline-none resize-none"
                />
              </div>
            )}

            {caseIntakeStep === 5 && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#01411C]/5 border border-[#01411C]/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#01411C] mb-2">{label("Case Summary", "Case Khulasa")}</p>
                  <div className="space-y-2 text-xs text-gray-700">
                    {caseIntakeData.facts && <p><b>{label("Facts:", "Waqiyat:")}</b> {caseIntakeData.facts}</p>}
                    {caseIntakeData.parties && <p><b>{label("Parties:", "Fareeqain:")}</b> {caseIntakeData.parties}</p>}
                    {caseIntakeData.jurisdiction && <p><b>{label("Jurisdiction:", "Adalat:")}</b> {caseIntakeData.jurisdiction}</p>}
                    {caseIntakeData.urgency && <p><b>{label("Urgency:", "Jaldi:")}</b> {caseIntakeData.urgency}</p>}
                    {caseIntakeData.evidence && <p><b>{label("Evidence:", "Saboot:")}</b> {caseIntakeData.evidence}</p>}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-green-800 mb-2">{label("Suggested Next Steps", "Agla Qadam")}</p>
                  <ul className="list-disc list-inside text-green-700 space-y-1 text-xs">
                    <li>{label("Consult a lawyer in your area for detailed advice", "Apne ilaqe mein wakeel se mashwara karen")}</li>
                    <li>{label("Gather and organize all evidence documents", "Tamam saboot documents jama aur tarteeb den")}</li>
                    <li>{label("Check if legal aid is available if you cannot afford a lawyer", "Agar wakeel ki fee nahi de sakte to muft qanooni madad check karen")}</li>
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setShowCaseIntake(false); onNavigate(getRoute('lawyers')!); }} className="px-4 py-2 bg-[#01411C] text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:scale-105 transition-all flex items-center justify-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" /> {label("Find Lawyer", "Wakeel Dhundhen")}
                  </button>
                  <button onClick={() => { setShowCaseIntake(false); onNavigate(getRoute('legalaid')!); }} className="px-4 py-2 bg-white border border-[#01411C] text-[#01411C] rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-[#01411C] hover:text-white transition-all flex items-center justify-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" /> {label("Legal Aid", "Muft Madad")}
                  </button>
                </div>
              </div>
            )}

            {caseIntakeStep < 5 && (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setCaseIntakeStep(Math.max(0, caseIntakeStep - 1))}
                  disabled={caseIntakeStep === 0}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:border-gray-400 disabled:opacity-30 transition-all"
                >
                  {label("Back", "Wapas")}
                </button>
                <button
                  onClick={() => setCaseIntakeStep(Math.min(5, caseIntakeStep + 1))}
                  className="px-4 py-2 rounded-xl bg-[#01411C] text-white text-[10px] font-black uppercase tracking-wider hover:scale-105 transition-all flex items-center gap-1.5"
                >
                  {caseIntakeStep === 4 ? label("Review", "Jaiza") : label("Next", "Agla")} <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
