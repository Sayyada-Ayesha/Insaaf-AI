import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Search, User, Users, Bot, Loader2, Info, LogIn, Sparkles, MessageSquarePlus, Mic, MicOff, Volume2, VolumeX, ShieldCheck, Globe, BookOpen, ExternalLink, X, CheckCircle2, AlertCircle, Copy, Share2, Scale, Landmark, GraduationCap, FileText, HeartHandshake, ArrowRight } from "lucide-react";
import { MarkdownBody } from "./MarkdownBody";
import { getLegalAdvice, streamLegalAdvice, getLastResponseSource } from "../services/aiRuntime";
import { copyTextToClipboard } from "../lib/clipboard";
import { cn } from "./Layout";
import { useAuth } from "../contexts/AuthContext";
import { StorageService, LocalChat, LocalChatMessage, SourceMetadata, CitationWarning } from "../services/storage";
import { FirestoreService } from "../services/firestoreService";
import { VoiceService } from "../services/voiceService";
import { getTranslations, getCurrentLanguage, SupportedLanguage, useLanguageVersion } from "../lib/i18n";
import { getLibrarySectionId } from "../config/ragDomainMap";
import { getSettings, useSettings } from "../lib/settings";
import AnswerResultView from "./AnswerResultView";

/** The composers print each record's own Source URL as plain text. Turn a bare
 *  http(s) run into a link, ending it at the first space or comma so a record
 *  whose sourceURL carries a trailing annotation ("https://mis.ihc.gov.pk/
 *  (official judgments records)") links only the URL, and leave anything that
 *  does not parse as a URL as text. */
const linkifyCitations = (text: string): string => text.replace(
  /https?:\/\/[^\s,)\]]+/g,
  (m) => { try { void new URL(m); return `[${m}](${m})`; } catch { return m; } }
);

/** Badge per evidence path, keyed to the mode that produced the answer. */
const EVIDENCE_BADGE: Record<'islamic' | 'combined' | 'legal', string> = {
  combined: 'VERIFIED ISLAMIC + PAKISTAN LAW SOURCES',
  islamic: 'VERIFIED ISLAMIC SOURCE',
  legal: 'VERIFIED LEGAL KNOWLEDGE',
};

const LAW_SUGGESTIONS = [
  { label: "Women Rights", roman: "Khawateen ke Huqooq" },
  { label: "Property Fraud", roman: "Jaidad ka Fraud" },
  { label: "Child Custody", roman: "Bachon ki Hifazat" },
  { label: "Cyber Harassment", roman: "Cyber Harassment" },
  { label: "FIR Registration", roman: "FIR Darj Karwana" },
  { label: "Rent Dispute", roman: "Kirayadaari Ka Jhagra" },
  { label: "Consumer Rights", roman: "Consumer ke Huqooq" },
  { label: "Divorce Procedure", roman: "Talaq Ka Tariqa" }
];

// Questions shaped for what the Islamic source layer actually holds (Qur'an, hadith
// from sunnah.com, CII fiqh FAQs, seerah events) instead of legal-only topics.
const ISLAMIC_SUGGESTIONS = [
  { label: "One verse about patience", roman: "Sabr ke bare mein ek ayah" },
  { label: "One hadith about honesty in trade", roman: "Karobar mein imandari ke bare mein hadees" },
  { label: "What does Islam say about maintenance?", roman: "Islam nafqa ke bare mein kya kehta hai?" },
  { label: "Rights of parents in Islam", roman: "Islam mein walidain ke huqooq" },
  { label: "What does Islam say about divorce?", roman: "Islam talaq ke bare mein kya kehta hai?" },
  { label: "Treatment of orphans", roman: "Yateemon ka sulook" }
];

const COMBINED_SUGGESTIONS = [
  { label: "Is maintenance obligatory on a husband in Islam and in Pakistani law?", roman: "Kya nafqa shariat aur qanoon dono ke tehat shohar par lazim hai?" },
  { label: "What do Islam and Pakistani law say about divorce?", roman: "Islam aur Pakistani qanoon talaq ke bare mein kya kehte hain?" },
  { label: "Child custody: Islamic ruling and Pakistani law", roman: "Bachon ki hifazat: Islami hukm aur Pakistani qanoon" },
  { label: "Interest (riba) in Islam and Pakistani banking", roman: "Islam aur Pakistani banking mein sood" },
  { label: "Women's right to property in Islam and Pakistani law", roman: "Islam aur Pakistani qanoon mein khawateen ka jaidad par haq" }
];

export default function ChatSection({ chatMode, activeChatId, openChatSignal, onChatLoaded, onOpenLibrary, onNavigate, isActive = true }: { chatMode: 'legal' | 'islamic', activeChatId?: string | null, openChatSignal?: number, onChatLoaded?: () => void, onOpenLibrary?: (sectionId: string) => void, onNavigate?: (tab: string) => void, isActive?: boolean }) {
  const { user, setShowLoginModal } = useAuth();
  const showSources = useSettings().showSourceDetails;
  const currentLang = getCurrentLanguage();
  const t = getTranslations(currentLang);
  useLanguageVersion(); // re-render when the system language changes

  const [messages, setMessages] = useState<LocalChatMessage[]>(() => [
    { role: 'model', text: t.initialGreeting, timestamp: Date.now() }
  ]);
  // Both modes open as the same search-first website page: hero, search field,
  // examples and the topic directory. Only the labels and the evidence-path
  // selector differ, so neither mode is a separate chat application.
  const [landing, setLanding] = useState(!activeChatId);
  useEffect(() => {
    if (openChatSignal) setLanding(false);
  }, [openChatSignal]);
  useEffect(() => {
    if (activeChatId || messages.some(m => m.role === 'user')) setLanding(false);
  }, [activeChatId, messages]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Where the signed-in user's chat actually lives: 'cloud' once a Firestore
  // write succeeded, 'local-only' when it was refused and kept in this browser.
  const [chatSaveState, setChatSaveState] = useState<'idle' | 'cloud' | 'local-only'>('idle');
  // Website-first answer surface is the default once a question exists; the
  // conversation transcript remains available as an explicit view.
  const [transcriptView, setTranscriptView] = useState(false);
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const resultSearchRef = useRef<HTMLTextAreaElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [micLang, setMicLang] = useState<'ur-PK' | 'en-US'>('ur-PK');
  const [chatLang, setChatLang] = useState<'auto' | 'en' | 'roman_urdu'>(() => {
    // Feature 1: 'ur' (Urdu Script) is no longer a chat response language — legacy values fall back to Auto.
    const stored = localStorage.getItem('insaaf_chat_lang');
    return stored === 'en' || stored === 'roman_urdu' ? stored : 'auto';
  });
  const [islamicView, setIslamicView] = useState<'islamic' | 'law' | 'combined'>('islamic');
  // Each selection routes the query down a different evidence path server-side:
  // 'islamic' reads only the Islamic source layer, undefined uses the ordinary
  // legal retrieval chain, 'combined' runs both and keeps their sections apart.
  const requestMode = chatMode === 'islamic'
    ? (islamicView === 'islamic' ? 'islamic' as const : islamicView === 'combined' ? 'combined' as const : undefined)
    : undefined;
  const isLawPath = chatMode !== 'islamic' || islamicView === 'law';
  const [isSpeaking, setIsSpeaking] = useState<number | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string>(() => 'chat_' + Math.random().toString(36).substr(2, 9));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [responseSource, setResponseSource] = useState<'LIVE_AI' | 'OFFLINE_KNOWLEDGE' | 'ERROR' | null>(null);
  const [selectedSourceMsg, setSelectedSourceMsg] = useState<LocalChatMessage | null>(null);
  // Feature 2: voice status line for STT/TTS failures (permission, no speech, timeout, unsupported...)
  const [voiceStatus, setVoiceStatus] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => {
    if (!selectedSourceMsg) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedSourceMsg(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSourceMsg]);
  const [copyState, setCopyState] = useState<{ idx: number; ok: boolean } | null>(null);
  const autoVoiceLangRef = useRef<'en' | 'roman_urdu'>('en');
  // F3: cancel stale in-flight streams when the chat is switched, a new message is sent, or the section unmounts
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // F3: abort any in-flight stream when switching chats (prevents a stale response leaking into the new chat)
    streamAbortRef.current?.abort();
  }, [activeChatId]);

  useEffect(() => {
    return () => streamAbortRef.current?.abort();
  }, []);

  // Feature 2: map voice engine error codes to user-facing messages (EN / Roman Urdu UI only)
  const voiceErrorMessage = (code: string): string => {
    const roman = currentLang === 'roman_urdu';
    switch (code) {
      case 'unsupported': return roman ? 'Ye browser voice input support nahi karta.' : 'Voice input is not supported in this browser.';
      case 'permission-denied': return roman ? 'Microphone ki permission nahi mili. Browser settings mein mic allow karen.' : 'Microphone permission was denied. Allow mic access in browser settings.';
      case 'no-speech': return roman ? 'Aawaz samajh nahi aayi. Zara qareeb se saaf bolein.' : 'No speech detected. Speak clearly near the microphone.';
      case 'microphone-busy': return roman ? 'Microphone kisi aur app ke paas hai.' : 'The microphone is unavailable or in use by another app.';
      case 'network': return roman ? 'Speech service abhi available nahi hai. Internet check karen.' : 'The speech recognition service is unavailable. Check your connection.';
      case 'unsupported-locale': return roman
        ? 'Is browser mein is zuban ke liye speech engine nahi hai. Doosri voice language chunen ya sawal likh kar bhejen.'
        : 'This browser has no speech engine for the selected voice language. Choose the other voice language, or type your question.';
      case 'timeout': return roman ? 'Time khatam. Dobara bolein.' : 'Listening timed out. Please try again and speak clearly.';
      case 'tts-unavailable': return roman ? 'Is device par koi awaaz available nahi hai.' : 'No voice is available on this device.';
      default: return roman ? 'Voice input fail hua. Dobara koshish karen.' : 'Voice input failed. Please try again.';
    }
  };

  useEffect(() => {
    localStorage.setItem('insaaf_chat_lang', chatLang);
    if (messages.length === 1 && messages[0].role === 'model') {
      const chosenLang = chatLang === 'auto' ? currentLang : chatLang;
      const localT = getTranslations(chosenLang);
      setMessages([{ role: 'model', text: localT.initialGreeting, timestamp: messages[0].timestamp }]);
    }
  }, [chatLang, currentLang]);

  useEffect(() => {
    const loadChat = async () => {
      if (!activeChatId) return;
      if (user) {
        try {
          const chat = await FirestoreService.getChat(user.uid, activeChatId);
          if (chat) {
            setMessages(chat.messages || []);
            setCurrentChatId(chat.id);
            setChatSaveState('cloud');
            onChatLoaded?.();
            return;
          }
        } catch (error) {
          console.error('Chat could not be read from the account:', error);
          setChatSaveState('local-only');
        }
      }
      const chats = StorageService.getChats();
      const chat = chats.find(c => c.id === activeChatId);
      if (chat) {
        setMessages(chat.messages || []);
        setCurrentChatId(chat.id);
      }
      onChatLoaded?.();
    };
    loadChat();
  }, [activeChatId, onChatLoaded, user]);

  // Feature 2: microphone → recognition → normalization → input pipeline.
  const toggleListening = async () => {
    if (isListening) {
      VoiceService.stopRecognition();
      setIsListening(false);
      return;
    }
    setVoiceStatus(null);
    setIsListening(true);
    try {
      const result = await VoiceService.transcribe(micLang);
      setInput(prev => prev + (prev ? " " : "") + result.text);
      // When response language is Auto, remember the detected speech language for the reply's TTS.
      if (chatLang === 'auto') {
        autoVoiceLangRef.current = result.detectedLang === 'roman_urdu' ? 'roman_urdu' : 'en';
      }
    } catch (err: any) {
      if (err?.code === 'cancelled') {
        // User pressed stop — not an error.
      } else {
        setVoiceStatus({ kind: 'error', text: voiceErrorMessage(err?.code || 'unknown') });
      }
    } finally {
      setIsListening(false);
    }
  };

  const readAloud = (text: string, index: number) => {
    if (isSpeaking === index) {
      VoiceService.stop();
      setIsSpeaking(null);
      return;
    }

    VoiceService.stop();
    setIsSpeaking(index);
    setVoiceStatus(null);

    VoiceService.speak(
      text,
      () => setIsSpeaking(index),
      () => setIsSpeaking(null),
      (err) => {
        console.warn("TTS Error:", err);
        setIsSpeaking(null);
        setVoiceStatus({ kind: 'error', text: voiceErrorMessage(err?.code || 'tts-unavailable') });
      },
      chatLang === 'auto' ? autoVoiceLangRef.current : chatLang
    );
  };

  const copyToClipboard = async (text: string, idx: number) => {
    const ok = await copyTextToClipboard(text);
    setCopyState({ idx, ok });
    setTimeout(() => setCopyState(null), 3000);
  };

  const shareWhatsApp = (text: string) => {
    const truncated = text.length > 2000 ? text.slice(0, 2000) + '...' : text;
    window.open(`https://wa.me/?text=${encodeURIComponent(truncated)}`, '_blank');
  };

  // Voice → text handoff: "Continue in text" on the Voice Agent appends the
  // question it heard and the answer it gave. Nothing is re-asked, so the text
  // transcript is the same conversation the user just had out loud.
  useEffect(() => {
    const onHandoff = (e: Event) => {
      if (chatMode !== 'legal') return;
      const d = (e as CustomEvent).detail as { question?: string; answer?: string } | undefined;
      const question = String(d?.question || '').trim();
      const answer = String(d?.answer || '').trim();
      if (!question && !answer) return;
      setMessages(prev => {
        const stamp = Date.now();
        const added: LocalChatMessage[] = [];
        if (question) added.push({ role: 'user', text: question, timestamp: stamp });
        if (answer) added.push({ role: 'model', text: answer, timestamp: stamp + 1 });
        return [...prev, ...added];
      });
    };
    window.addEventListener('insaaf_handoff_to_chat', onHandoff as EventListener);
    return () => window.removeEventListener('insaaf_handoff_to_chat', onHandoff as EventListener);
  }, [chatMode]);

  const scrollToBottom = () => {
    // Scroll only the message panel. scrollIntoView also scrolls the window,
    // which pushed the home hero and question field off-screen on first load.
    const el = messagesContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (customInput?: string) => {
    const textToSend = typeof customInput === 'string' ? customInput : input;
    if (!textToSend.trim() || isLoading) return;

    // F3: cancel any previous in-flight stream before starting a new one
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    const userMessage = textToSend.trim();
    const timestamp = Date.now();
    setTranscriptView(false);
    setResultIndex(null);
    const isSourceRequest = /\b(source|sources|hawala|reference|references|kahan se|where did you get|proof|dalil)\b/i.test(userMessage);
    
    setInput("");
    const newUserMsg: LocalChatMessage = { role: 'user', text: userMessage, timestamp };
    const newMessages = [...messages, newUserMsg];
    
    // Add empty bot message initially to stream into
    const finalMessages = [...newMessages, { role: 'model' as const, text: "", timestamp: Date.now() }];
    setMessages(finalMessages);
    setIsLoading(true);

    // The backend rejects any history item over 8000 chars, and one long combined
    // answer is enough to fail every later question in this session. Send a bounded
    // window instead of the raw transcript.
    const HISTORY_ITEM_LIMIT = 4000;
    const history = messages.slice(-12).map(m => ({
      role: m.role,
      text: m.text.length > HISTORY_ITEM_LIMIT
        ? m.text.slice(0, HISTORY_ITEM_LIMIT) + ' […earlier answer shortened…]'
        : m.text
    }));
    const userPrefLang = chatLang === 'auto' ? undefined : chatLang;
    
    let botResponse = "";
    let botSources: SourceMetadata[] = [];
    let botIsOffline = false;
    let botCitationWarning: CitationWarning | null = null;

    try {
      const stream = streamLegalAdvice(userMessage, history, userPrefLang, controller.signal, getSettings().responseDetail, requestMode);
      for await (const data of stream) {
        setIsLoading(false); // Once streaming starts, remove loading state
        if (typeof data === 'string') {
          botResponse += data;
        } else if (data) {
          if (data.meta) {
            if (data.meta.sources) botSources = data.meta.sources;
            if (typeof data.meta.isOffline === 'boolean') botIsOffline = data.meta.isOffline;
          }
          if (data.sources) botSources = data.sources;
          if (typeof data.isOffline === 'boolean') botIsOffline = data.isOffline;
          if (data.citationWarning !== undefined) botCitationWarning = data.citationWarning;
          if (data.chunk) botResponse += data.chunk;
        }

        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = { 
            ...updated[lastIdx], 
            text: botResponse,
            sources: botSources.length > 0 ? botSources : updated[lastIdx].sources,
            isOffline: botIsOffline,
            citationWarning: botCitationWarning,
            evidenceMode: requestMode ?? 'legal'
          };
          return updated;
        });
      }
      
      if (!botResponse || botResponse.trim().length === 0) {
        botResponse = t.errorChatUnavailable;
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = { 
            ...updated[lastIdx], 
            text: botResponse,
            isOffline: true
          };
          return updated;
        });
      }

      setResponseSource(botIsOffline ? 'OFFLINE_KNOWLEDGE' : 'LIVE_AI');

      if (isSourceRequest) {
        setTimeout(() => {
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'model') {
              setSelectedSourceMsg(lastMsg);
            }
            return prev;
          });
        }, 300);
      }
    } catch (e: any) {
      // F3: stale request canceled — the UI has moved on; do not show an error or save stale state
      if (controller.signal.aborted) {
        return;
      }
      console.error(e);
      botResponse = currentLang === 'roman_urdu'
        ? 'Takneeki masla pesh aa gaya. Barah karam doosri baar koshish karen.'
        : 'A technical issue occurred. Please try again.';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], text: botResponse };
        return updated;
      });
    } finally {
      if (controller.signal.aborted) {
        // F3: stale request canceled — skip saving a partial chat
        return;
      }
      setIsLoading(false);
      const lastMsgObj = messages[messages.length - 1];
      const currentChat: LocalChat = {
        id: currentChatId,
        title: newMessages.length > 1 ? newMessages[1].text.substring(0, 40) + "..." : userMessage.substring(0, 40) + "...",
        updatedAt: Date.now(),
        messages: [...newMessages, { role: 'model', text: botResponse, timestamp: Date.now(), sources: botSources, isOffline: botIsOffline, citationWarning: botCitationWarning }]
      };
      // Part Z: respect the auto-save-chats setting.
      if (getSettings().autoSaveChats) {
        if (user) {
          FirestoreService.saveChat(user.uid, currentChat)
            .then(() => setChatSaveState('cloud'))
            .catch((error) => {
              console.error('Chat not saved to the account:', error);
              StorageService.saveChat(currentChat);
              setChatSaveState('local-only');
            });
        } else {
          StorageService.saveChat(currentChat);
        }
      }
      // Part Z: voice auto-read — speak the answer aloud when it completes.
      if (getSettings().voiceAutoRead && botResponse && botResponse.trim().length > 0) {
        const speakIdx = finalMessages.length - 1;
        VoiceService.speak(
          botResponse,
          () => setIsSpeaking(speakIdx),
          () => setIsSpeaking(null),
          () => setIsSpeaking(null),
          chatLang === 'auto' ? autoVoiceLangRef.current : chatLang
        );
      }
    }
  };

  const startNewChat = () => {
    window.speechSynthesis.cancel();
    // F3: cancel any in-flight stream before replacing the conversation
    streamAbortRef.current?.abort();
    setIsSpeaking(null);
    setCurrentChatId('chat_' + Math.random().toString(36).substr(2, 9));
    setResultIndex(null);
    setTranscriptView(false);
    // A cleared session is the search-first page again, never an empty panel.
    setLanding(true);
    // Greeting respects the selected chat language (never hardcoded Roman Urdu)
    const chosenLang = chatLang === 'auto' ? currentLang : chatLang;
    const localT = getTranslations(chosenLang);
    setMessages([
      { role: 'model', text: localT.initialGreeting, timestamp: Date.now() }
    ]);
  };

  // One notice, rendered on whichever surface the person is looking at: the
  // transcript view and the answer view are separate branches of the same chat.
  const chatSaveNotice = chatSaveState === 'idle' ? null : (
    <div data-testid="chat-save-status" role="status" className={cn(
      "order-3 flex items-center gap-2 text-[10px] font-bold px-4 py-2 rounded-xl border",
      chatSaveState === 'cloud' ? "bg-emerald-50 text-[#01411C] border-emerald-100" : "bg-amber-50 text-amber-800 border-amber-200"
    )}>
      <span>{chatSaveState === 'cloud'
        ? (currentLang === 'roman_urdu'
          ? 'Yeh chat aap ke account mein mehfooz ho gayi.'
          : 'This chat is saved to your account.')
        : (currentLang === 'roman_urdu'
          ? 'Account par save nahi ho saki — sirf is browser mein mehfooz hai.'
          : 'Could not save to your account — kept only in this browser.')}</span>
    </div>
  );

  // The inactive mode stays mounted (its state must survive tab switches) but
  // contributes no DOM, so the page never holds two search fields or two copies
  // of the topic directory.
  if (!isActive) return null;

  return (
    <>
      {landing ? (
        <section className="relative overflow-hidden pt-5 sm:pt-12 pb-2 sm:pb-5" aria-labelledby="home-hero-title">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-28 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(1,65,28,0.10),transparent_72%)]" />
          <div className="relative text-center">
            <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#01411C]/5 text-[#01411C] text-[10px] font-bold uppercase tracking-[0.2em] border border-[#01411C]/10">
              <Sparkles className="w-4 h-4" />
              {chatMode === 'islamic' && islamicView !== 'law' ? t.chatIslamicBadge : t.chatHeroBadge}
            </span>
            <h1 id="home-hero-title" className="mt-3 sm:mt-5 text-[1.9rem] leading-[1.12] sm:text-5xl md:text-6xl font-black tracking-tight text-gray-900">
              {chatMode === 'islamic' ? (
                t.navIslamic
              ) : currentLang === 'en' ? (
                <>Legal help for <span className="text-[#01411C] italic font-serif">everybody.</span></>
              ) : t.chatHeroTitle}
            </h1>
            <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-xs sm:text-base text-gray-500 font-medium leading-relaxed px-2">
              {chatMode === 'islamic' && !isLawPath ? t.chatIslamicSubtitle : t.homeHeroSubtitle}
            </p>

            {/* The evidence path is chosen here, above the search field, so the
                Islamic tab stays one page instead of a second chat application. */}
            {chatMode === 'islamic' && (
              <div role="group" aria-labelledby="home-evidence-path-label" className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span id="home-evidence-path-label" className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t.evidencePathLabel}</span>
                {([
                  { key: 'islamic', label: t.viewIslamic },
                  { key: 'law', label: t.viewLaw },
                  { key: 'combined', label: t.viewCombined },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    data-testid={`home-evidence-path-${opt.key}`}
                    onClick={() => setIslamicView(opt.key)}
                    aria-pressed={islamicView === opt.key}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] md:text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C]",
                      islamicView === opt.key
                        ? "bg-[#01411C] text-white border-[#01411C]"
                        : "bg-white text-gray-600 border-gray-200 hover:border-[#01411C]/40"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); if (input.trim() && !isLoading) handleSend(); }}
              className="relative z-10 mx-auto mt-5 sm:mt-8 w-full max-w-3xl px-1 sm:px-0"
            >
              <div className="flex items-center gap-2 rounded-2xl sm:rounded-full border border-gray-200 bg-white py-2 pl-4 pr-2 sm:pl-6 sm:pr-3 shadow-xl shadow-[#01411C]/5 focus-within:ring-8 focus-within:ring-[#01411C]/5 focus-within:border-[#01411C]/30 transition-all">
                <Search className="w-5 h-5 text-[#01411C]/60 shrink-0" />
                <label htmlFor="home-search" className="sr-only">{t.chatPlaceholder}</label>
                <textarea
                  id="home-search"
                  data-testid="home-search-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim() && !isLoading) handleSend(); }
                  }}
                  rows={1}
                  placeholder={t.chatPlaceholder}
                  className="flex-1 min-w-0 resize-none bg-transparent py-2 sm:py-3 text-xs sm:text-sm font-bold text-gray-800 placeholder:text-gray-400 focus:outline-none h-[52px] sm:h-[58px]"
                />
                <button
                  type="button"
                  onClick={toggleListening}
                  title={`Speech Language: ${micLang === 'ur-PK' ? 'Urdu (Pakistan)' : 'English (US)'}`}
                  aria-label={isListening ? t.chatStopSpeaking : `${t.chatVoiceLabel}: ${micLang === 'ur-PK' ? 'Urdu' : 'English'}`}
                  className={cn(
                    "p-2.5 sm:p-3 rounded-xl transition-all shrink-0",
                    isListening ? "bg-rose-500 text-white animate-pulse" : "text-gray-400 hover:text-[#01411C] hover:bg-[#01411C]/5"
                  )}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  type="submit"
                  data-testid="home-search-submit"
                  disabled={!input.trim() || isLoading}
                  aria-label={t.chatSend}
                  title={t.chatSend}
                  className="w-11 h-11 sm:w-12 sm:h-12 bg-[#01411C] text-white rounded-xl sm:rounded-2xl hover:bg-[#01411C]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#01411C]/25 flex items-center justify-center shrink-0"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
              {(isListening || voiceStatus) && (
                <div className={cn(
                  "mx-auto mt-3 flex max-w-2xl items-center justify-center gap-2 text-[10px] font-bold px-4 py-2 rounded-xl",
                  voiceStatus ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-[#01411C] border border-emerald-100"
                )}>
                  {isListening && !voiceStatus && (<><Loader2 className="w-3 h-3 animate-spin" /> <span>{t.chatListening}</span></>)}
                  {voiceStatus && (<><MicOff className="w-3.5 h-3.5 shrink-0" /> <span>{voiceStatus.text}</span></>)}
                </div>
              )}
              <div className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-1.5 sm:gap-2">
                {(chatMode === 'islamic'
                  ? (islamicView === 'combined' ? COMBINED_SUGGESTIONS : ISLAMIC_SUGGESTIONS)
                  : LAW_SUGGESTIONS
                ).slice(0, 6).map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid="home-suggestion"
                    onClick={() => handleSend(currentLang === 'roman_urdu' ? s.roman : s.label)}
                    title={s.label}
                    className="px-2.5 sm:px-3.5 py-1.5 bg-white/80 border border-gray-200 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-500 hover:text-[#01411C] hover:border-[#01411C]/30 hover:bg-[#01411C]/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C]"
                  >
                    {s.label} <span className="opacity-40 italic font-medium normal-case tracking-normal">{s.roman}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" /> {chatMode === 'islamic' && !isLawPath ? t.chatIslamicSourceNote : t.chatPakistaniLawExpert}
                </p>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="w-3 h-3" /> {t.chatBilingualEngine}
                </p>
              </div>
            </form>
          </div>
        </section>
      ) : (transcriptView || !messages.some(m => m.role === 'user')) ? (
      <div className="mx-auto w-full max-w-4xl">
      <div className="mb-5 sm:mb-8 md:mb-10 text-center space-y-2 sm:space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#01411C]/5 text-[#01411C] text-[10px] font-bold uppercase tracking-[0.2em] border border-[#01411C]/10"
        >
          <Sparkles className="w-4 h-4" />
          {chatMode === 'islamic' && islamicView !== 'law' ? t.chatIslamicBadge : t.chatHeroBadge}
        </motion.div>
        <h2 className="text-[1.75rem] leading-tight font-black tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
          {chatMode === 'islamic' ? (
            t.navIslamic
          ) : currentLang === 'en' ? (
            <>Legal help for <span className="text-[#01411C] italic font-serif">everybody.</span></>
          ) : (
            t.chatHeroTitle
          )}
        </h2>
        <p className="text-gray-500 max-w-2xl mx-auto text-xs sm:text-sm md:text-base leading-relaxed font-medium">
          {chatMode === 'islamic' && !isLawPath ? t.chatIslamicSubtitle : t.chatHeroSubtitle}
        </p>
        {chatMode === 'islamic' && (
          <div role="group" aria-labelledby="evidence-path-label" className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span id="evidence-path-label" className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t.evidencePathLabel}</span>
            {([
              { key: 'islamic', label: t.viewIslamic },
              { key: 'law', label: t.viewLaw },
              { key: 'combined', label: t.viewCombined },
            ] as const).map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setIslamicView(opt.key)}
                aria-pressed={islamicView === opt.key}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] md:text-xs font-bold border transition-colors",
                  islamicView === opt.key
                    ? "bg-[#01411C] text-white border-[#01411C]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#01411C]/40"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={cn(
        "flex flex-col bg-white rounded-3xl sm:rounded-[3rem] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden relative max-h-[calc(100vh-7rem)]",
        // A fresh session has only the greeting: a fixed 700px panel pushed the
        // question field below the fold on phones, so size to content until a
        // real conversation starts.
        messages.length <= 1 && !isLoading ? "h-auto" : "h-[700px]"
      )}>
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-8 scrollbar-thin scrollbar-thumb-gray-200 pt-3 sm:pt-10">
          <div className="flex justify-between items-center mb-2 sm:mb-6">
            <div className="flex items-center gap-2">
               <div className={cn(
                 "w-2 h-2 rounded-full animate-pulse",
                 responseSource === 'OFFLINE_KNOWLEDGE' ? "bg-amber-500" : "bg-emerald-500"
               )} />
               <span className={cn(
                 "text-[10px] font-black uppercase tracking-widest",
                 responseSource === 'OFFLINE_KNOWLEDGE' ? "text-amber-500" : "text-gray-400"
               )}>
                 {responseSource === 'OFFLINE_KNOWLEDGE' ? t.chatKnowledgeOffline : t.chatKnowledgeOnline}
               </span>
            </div>
            <div className="flex items-center gap-2">
              {messages.some(m => m.role === 'user') && (
                <button
                  type="button"
                  data-testid="chat-website-view"
                  onClick={() => { setTranscriptView(false); setResultIndex(null); }}
                  className="flex items-center gap-2 text-[10px] font-black text-[#01411C] uppercase tracking-widest px-4 py-2 rounded-full bg-white border border-[#01411C]/20 hover:bg-[#01411C]/5 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  Website view
                </button>
              )}
              <button 
              onClick={startNewChat}
              className="flex items-center gap-2 text-[10px] font-black text-[#01411C] uppercase tracking-widest px-4 py-2 rounded-full bg-[#01411C]/5 hover:bg-[#01411C]/10 transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              New Session
            </button>
            </div>
          </div>
          
          {messages.map((message, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-start gap-2 sm:gap-4",
                message.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-9 h-9 sm:w-12 sm:h-12 rounded-[1rem] sm:rounded-[1.2rem] flex items-center justify-center shrink-0 shadow-lg transition-transform",
                message.role === 'user' ? "bg-[#01411C] text-white scale-90" : "bg-gray-100 text-[#01411C]"
              )}>
                {message.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
              </div>
              <div className="group relative max-w-[92%] sm:max-w-[85%] space-y-2">
                {message.role === 'model' && idx > 0 && (
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5",
                      message.isOffline 
                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}>
                      {message.isOffline ? (
                        <><ShieldCheck className="w-3 h-3 text-amber-600" /> {EVIDENCE_BADGE[message.evidenceMode ?? (isLawPath ? 'legal' : islamicView)]}</>
                      ) : (
                        <><Sparkles className="w-3 h-3 text-emerald-600" /> VERIFIED ANSWER</>
                      )}
                    </span>
                  </div>
                )}
                <div className={cn(
                  "p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] text-[13px] sm:text-sm md:text-base leading-relaxed shadow-sm",
                  message.role === 'user' 
                    ? "bg-[#01411C] text-white rounded-tr-none" 
                    : cn("bg-white text-gray-800 border border-gray-100 border-l-4 rounded-tl-none ProseMirror shadow-xl shadow-gray-100/50",
                        (message.evidenceMode ?? (isLawPath ? 'legal' : islamicView)) === 'combined'
                          ? "border-l-teal-500"
                          : (message.evidenceMode ?? (isLawPath ? 'legal' : islamicView)) === 'islamic'
                            ? "border-l-amber-400"
                            : "border-l-[#01411C]")
                )}>
                  <MarkdownBody text={message.role === 'model' ? linkifyCitations(message.text) : message.text} />

                  {/* Runtime citation audit: provisions this answer cites that the
                      verified evidence does not back. Never rewritten into the answer. */}
                  {message.role === 'model' && message.citationWarning?.text && (
                    <div data-testid="chat-citation-warning"
                      className="mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
                      {message.citationWarning.lead && <span className="uppercase tracking-widest text-[9px] block mb-0.5">{message.citationWarning.lead}</span>}
                      {message.citationWarning.text}
                    </div>
                  )}

                  {/* Compact Source Footer (F14: answer first, then ONE compact citation) */}
                  {showSources && message.role === 'model' && message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5 font-medium truncate max-w-[70%]">
                        <span className="font-bold text-gray-700 dark:text-gray-300">{t.chatSourceLabel}</span>
                        <span className="truncate">{message.sources[0].title}, {message.sources[0].type || 'Section'} {message.sources[0].key || ''}</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" /> {t.chatSourceVerified}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenLibrary && getLibrarySectionId(message.sources[0].domain) && (
                          <button
                            onClick={() => onOpenLibrary(getLibrarySectionId(message.sources[0].domain)!)}
                            className="px-3 py-1 rounded-lg bg-[#01411C]/5 hover:bg-[#01411C]/10 text-[#01411C] text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> {t.chatSourceOpenLibrary}
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedSourceMsg(message)}
                          className="px-3 py-1 rounded-lg bg-[#01411C]/5 hover:bg-[#01411C]/10 text-[#01411C] text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> {t.chatSourceReadMore}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {message.role === 'model' && (
                  <div className="flex items-center gap-1.5 pt-0.5 pl-1">
                    <button
                      data-testid="chat-action-read-aloud"
                      onClick={() => readAloud(message.text, idx)}
                      aria-label={isSpeaking === idx ? t.chatStopSpeaking : t.chatReadAloud}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors",
                        isSpeaking === idx ? "bg-[#01411C] text-white" : "bg-gray-50 text-gray-500 hover:bg-[#01411C]/5 hover:text-[#01411C]"
                      )}
                      title={isSpeaking === idx ? t.chatStopSpeaking : t.chatReadAloud}
                    >
                      {isSpeaking === idx ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      <span className="hidden sm:inline">{t.chatReadAloud}</span>
                    </button>
                    <button
                      data-testid="chat-action-copy"
                      onClick={() => copyToClipboard(message.text, idx)}
                      aria-label={t.chatCopy}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors",
                        copyState?.idx === idx && copyState.ok ? "bg-emerald-500 text-white"
                          : copyState?.idx === idx ? "bg-red-500 text-white"
                          : "bg-gray-50 text-gray-500 hover:bg-[#01411C]/5 hover:text-[#01411C]"
                      )}
                      title={copyState?.idx === idx && !copyState.ok
                        ? (currentLang === 'roman_urdu' ? 'Copy nahi hua — text select karke khud copy karein' : 'Copy failed — select the text and copy it manually')
                        : t.chatCopy}
                    >
                      {copyState?.idx === idx ? (copyState.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />) : <Copy className="w-4 h-4" />}
                      <span className="hidden sm:inline">{copyState?.idx === idx && copyState.ok ? t.chatCopied : t.chatCopy}</span>
                    </button>
                    <button
                      data-testid="chat-action-share"
                      onClick={() => shareWhatsApp(message.text)}
                      aria-label={t.chatShareWhatsApp}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-700 transition-colors"
                      title={t.chatShareWhatsApp}
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="hidden sm:inline">{t.chatShareWhatsApp}</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-[1.2rem] bg-gray-100 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-[#01411C]" />
              </div>
              <div role="status" aria-live="polite"
                className="bg-gray-50 px-5 py-4 md:px-6 rounded-[1.5rem] rounded-tl-none border border-gray-100 italic text-gray-400 text-sm flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-[#01411C] shrink-0" />
                {isLawPath ? t.chatWorkingLaw : islamicView === 'combined' ? t.chatWorkingCombined : t.chatWorkingIslamic}
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 sm:p-6 md:p-8 border-t border-gray-100 bg-white flex flex-col gap-3 sm:gap-5 md:gap-6">
          <div className="order-2 sm:order-1 flex items-center justify-between gap-3 overflow-x-auto pb-2 no-scrollbar">
            <div className="flex gap-2 shrink-0">
              {(isLawPath ? LAW_SUGGESTIONS : islamicView === 'combined' ? COMBINED_SUGGESTIONS : ISLAMIC_SUGGESTIONS).map((s, i) => (
                <button 
                  key={i} 
                  type="button"
                  data-testid="chat-suggestion"
                  onClick={() => handleSend(currentLang === 'roman_urdu' ? s.roman : s.label)}
                  title={s.label}
                  className="px-3.5 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-[#01411C]/5 hover:text-[#01411C] hover:border-[#01411C]/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C] flex items-center gap-1.5 shrink-0"
                >
                  {s.label} <span className="opacity-40 italic font-medium normal-case tracking-normal">{s.roman}</span>
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Chat Response Language Selector */}
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900 p-1 rounded-xl border border-gray-100 dark:border-slate-800 shrink-0">
                <span className="text-[9px] font-black uppercase text-gray-400 dark:text-gray-500 px-2">{t.chatChatLabel}</span>
                {[
                  { id: 'auto', label: 'Auto' },
                  { id: 'en', label: 'En' },
                  { id: 'roman_urdu', label: 'Roman' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setChatLang(opt.id as any)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all",
                      chatLang === opt.id 
                        ? "bg-[#01411C] text-white shadow-sm" 
                        : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Voice Input Language Selector (Feature 2) */}
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900 p-1 rounded-xl border border-gray-100 dark:border-slate-800 shrink-0">
                <span className="text-[9px] font-black uppercase text-gray-400 dark:text-gray-500 px-2">{t.chatVoiceLabel}</span>
                <button 
                  onClick={() => setMicLang('ur-PK')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all",
                    micLang === 'ur-PK' ? "bg-[#01411C] text-white shadow-sm" : "text-gray-400 dark:text-gray-500 hover:text-gray-600"
                  )}
                >
                  Urdu
                </button>
                <button 
                  onClick={() => setMicLang('en-US')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all",
                    micLang === 'en-US' ? "bg-[#01411C] text-white shadow-sm" : "text-gray-400 dark:text-gray-500 hover:text-gray-600"
                  )}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          {/* Feature 2: voice pipeline status (listening / errors) */}
          {(isListening || voiceStatus) && (
            <div className={cn(
              "order-3 flex items-center gap-2 text-[10px] font-bold px-4 py-2 rounded-xl",
              voiceStatus ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-[#01411C] border border-emerald-100"
            )}>
              {isListening && !voiceStatus && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t.chatListening} {currentLang === 'roman_urdu' ? '(Mic ka button band karen)' : '(Press the mic to stop)'}</span>
                </>
              )}
              {voiceStatus && (
                <>
                  <MicOff className="w-3.5 h-3.5 shrink-0" />
                  <span>{voiceStatus.text}</span>
                </>
              )}
            </div>
          )}

          {/* Authenticated persistence outcome — a refused write is never silent. */}
          {chatSaveNotice}

          <div className="order-1 sm:order-2 relative flex items-center gap-2 sm:gap-4">
            <div className="relative flex-1 group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t.chatPlaceholder}
                className="w-full bg-gray-50 border border-gray-200 rounded-[1.5rem] px-5 sm:px-8 py-4 sm:py-5 pr-12 sm:pr-14 text-xs sm:text-sm font-bold focus:outline-none focus:ring-8 focus:ring-[#01411C]/5 focus:border-[#01411C]/30 transition-all resize-none h-[64px] sm:h-[72px]"
                rows={1}
              />
              <button
                onClick={toggleListening}
                title={`Speech Language: ${micLang === 'ur-PK' ? 'Urdu (Pakistan)' : 'English (US)'}`}
                className={cn(
                  "absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-xl transition-all",
                  isListening ? "bg-rose-500 text-white shadow-2xl shadow-rose-500/50 animate-pulse" : "text-gray-300 hover:text-[#01411C] hover:bg-white"
                )}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              aria-label={t.chatSend}
              title={t.chatSend}
              className="w-16 sm:w-20 h-[64px] sm:h-[72px] bg-[#01411C] text-white rounded-[1.5rem] hover:bg-[#01411C]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xl shadow-[#01411C]/30 flex items-center justify-center shrink-0 group"
            >
              <Send className="w-5 sm:w-6 h-5 sm:h-6 transition-transform group-active:translate-x-1" />
            </button>
          </div>
          <div className="order-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> {isLawPath ? t.chatPakistaniLawExpert : t.chatIslamicSourceNote}
            </p>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Globe className="w-3 h-3" /> {t.chatBilingualEngine}
            </p>
          </div>
        </div>
      </div>
      </div>
      ) : (
      <AnswerResultView
        chatMode={chatMode}
        islamicView={islamicView}
        onIslamicView={setIslamicView}
        messages={messages}
        resultIndex={resultIndex}
        onSelectResult={setResultIndex}
        isLoading={isLoading}
        responseSource={responseSource}
        input={input}
        onInput={setInput}
        onSubmit={() => handleSend()}
        searchRef={resultSearchRef}
        isListening={isListening}
        onToggleListening={toggleListening}
        isRomanUI={currentLang === 'roman_urdu'}
        isLawPath={isLawPath}
        t={t}
        onNewSearch={() => {
          startNewChat();
          // startNewChat restores the search-first page in both modes; land the
          // user on the topic directory so services stay one click away.
          requestAnimationFrame(() => document.getElementById('home-topics-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }}
        onBackToTopics={() => {
          startNewChat();
          requestAnimationFrame(() => document.getElementById('home-topics-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }}
        onExplore={(tab) => onNavigate?.(tab)}
        onOpenLibrary={onOpenLibrary}
        onOpenSources={setSelectedSourceMsg}
        onCopy={copyToClipboard}
        copyState={copyState}
        onReadAloud={readAloud}
        isSpeaking={isSpeaking}
        onShare={shareWhatsApp}
        onShowConversation={() => { setTranscriptView(true); setResultIndex(null); }}
        saveNotice={chatSaveNotice}
      />
      )}

      {/* Verified Source Inspector Modal */}
      <AnimatePresence>
        {selectedSourceMsg && selectedSourceMsg.sources && selectedSourceMsg.sources.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedSourceMsg(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog" aria-modal="true" aria-labelledby="source-inspector-title"
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-gray-100 dark:border-slate-800"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#01411C]/10 text-[#01411C] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="source-inspector-title" className="font-black text-gray-900 dark:text-white text-base">{t.chatVerifiedSources}</h3>
                    <p className="text-xs text-gray-500 font-medium">{t.chatSourcesMetadata}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSourceMsg(null)}
                  aria-label={t.closeDialog}
                  title={t.closeDialog}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
                {selectedSourceMsg.sources.map((src, i) => (
                  <div key={i} className="p-5 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        {(src.type || src.key) && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#01411C] bg-[#01411C]/10 px-2.5 py-0.5 rounded-md inline-block mb-1">
                            {[src.type, src.key].filter(Boolean).join(' ')}
                          </span>
                        )}
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm md:text-base leading-snug">
                          {src.title}
                        </h4>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${src.legalStatus ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800' : 'text-gray-500 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700'}`}>
                        {src.legalStatus || t.chatSourceUnrecorded}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                      <div>
                        <span className="font-bold text-gray-400 block text-[9px] uppercase tracking-wider">{t.chatSourceAuthority}</span>
                        <span className={`font-medium ${src.authority ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 italic'}`}>{src.authority || t.chatSourceUnrecorded}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-400 block text-[9px] uppercase tracking-wider">{t.chatSourceJurisdiction}</span>
                        <span className={`font-medium ${src.jurisdiction ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 italic'}`}>{src.jurisdiction || t.chatSourceUnrecorded}</span>
                      </div>
                      {src.version && (
                        <div>
                          <span className="font-bold text-gray-400 block text-[9px] uppercase tracking-wider">{t.chatSourceVersion}</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{src.version}</span>
                        </div>
                      )}
                    </div>

                    {src.text && (
                      <div>
                        <span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider block mb-1.5">{t.chatSourceExcerpt}</span>
                        <blockquote className="p-4 bg-white dark:bg-slate-900 border-l-4 border-[#01411C] rounded-r-xl text-xs text-gray-700 dark:text-gray-300 font-mono leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {src.text}
                        </blockquote>
                      </div>
                    )}

                    {src.sourceURL && src.sourceURL.startsWith('http') && (
                      <div className="pt-2 flex flex-wrap justify-end gap-2">
                        {onOpenLibrary && getLibrarySectionId(src.domain) && (
                          <button
                            onClick={() => onOpenLibrary(getLibrarySectionId(src.domain)!)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01411C]/5 text-[#01411C] text-xs font-bold rounded-xl hover:bg-[#01411C]/10 transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> {t.chatSourceOpenLibrary}
                          </button>
                        )}
                        <a
                          href={src.sourceURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01411C] text-white text-xs font-bold rounded-xl hover:bg-[#01411C]/90 transition-colors shadow-sm"
                        >
                          Open Official Source <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.length <= 1 && onNavigate && (
        <section className="mt-10 sm:mt-14 space-y-9 sm:space-y-10" aria-labelledby="home-topics-title">
          <div className="text-center space-y-2">
            <h3 id="home-topics-title" className="text-2xl md:text-3xl font-black tracking-tight text-gray-900">{t.homeTopicsTitle}</h3>
            <p className="text-sm text-gray-500 font-medium max-w-xl mx-auto leading-relaxed">{t.homeTopicsSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {([
              { tab: 'legalaid', title: t.navLegalAid, Icon: Scale, tint: 'bg-[#01411C]/10 text-[#01411C]' },
              { tab: 'learning', title: t.navLibrary, Icon: GraduationCap, tint: 'bg-violet-50 text-violet-700' },
              { tab: 'gov', title: t.navGovServices, Icon: Landmark, tint: 'bg-blue-50 text-blue-700' },
              { tab: 'docintel', title: t.navDocIntel, Icon: FileText, tint: 'bg-amber-50 text-amber-700' },
              { tab: 'draft', title: t.navDrafting, Icon: FileText, tint: 'bg-orange-50 text-orange-700' },
              { tab: 'islamic', title: t.navIslamic, Icon: BookOpen, tint: 'bg-emerald-50 text-emerald-700' },
              { tab: 'voice', title: t.navVoice, Icon: Mic, tint: 'bg-rose-50 text-rose-700' },
              { tab: 'civic', title: t.navCivicIssues, Icon: HeartHandshake, tint: 'bg-teal-50 text-teal-700' },
              { tab: 'community', title: t.navCommunity, Icon: Users, tint: 'bg-sky-50 text-sky-700' },
              { tab: 'chat', title: t.navChat, Icon: MessageSquarePlus, tint: 'bg-[#01411C]/10 text-[#01411C]' },
            ] as const).map(({ tab, title, Icon, tint }) => (
              <button
                key={tab}
                type="button"
                data-testid={`home-topic-${tab}`}
                onClick={() => onNavigate(tab)}
                className="group flex items-start gap-4 text-left bg-white rounded-3xl border border-gray-100 p-5 sm:p-6 min-h-[104px] sm:min-h-[124px] shadow-sm hover:shadow-xl hover:shadow-[#01411C]/5 hover:border-[#01411C]/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C] focus-visible:ring-offset-2"
              >
                <span className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", tint)}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0 pt-0.5">
                  <span className="block font-extrabold text-sm text-gray-900 leading-snug group-hover:text-[#01411C] transition-colors">{title}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-[#01411C] transition-colors">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">{t.homeShortcutsTitle}</h4>
            <div className="flex flex-wrap justify-center gap-2.5">
              {([
                { tab: 'chat', title: t.navChat, Icon: MessageSquarePlus },
                { tab: 'voice', title: t.navVoice, Icon: Mic },
                { tab: 'draft', title: t.navDrafting, Icon: FileText },
                { tab: 'vault', title: t.navDashboard, Icon: ShieldCheck },
              ] as const).map(({ tab, title, Icon }) => (
                <button
                  key={tab}
                  type="button"
                  data-testid={`home-shortcut-${tab}`}
                  onClick={() => onNavigate(tab)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-gray-200 text-xs font-bold text-gray-600 shadow-sm hover:text-[#01411C] hover:border-[#01411C]/40 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C] focus-visible:ring-offset-2"
                >
                  <Icon className="w-4 h-4" /> {title}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div data-testid="home-privacy" className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-[#01411C]">
                <ShieldCheck className="w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">{t.homePrivacyTitle}</h4>
              </div>
              <p className="mt-3 text-xs text-gray-500 leading-relaxed font-medium">{t.homePrivacyBody}</p>
            </div>
            <div data-testid="home-sources" className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-[#01411C]">
                <BookOpen className="w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">{t.chatVerifiedSources}</h4>
              </div>
              <p className="mt-3 text-xs text-gray-500 leading-relaxed font-medium">{t.chatSourcesMetadata}</p>
            </div>
            <div data-testid="home-disclaimer" className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600">
                <Info className="w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">{t.footerTerms}</h4>
              </div>
              <p className="mt-3 text-xs text-gray-500 leading-relaxed font-medium">{t.homeDisclaimerBody}</p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

