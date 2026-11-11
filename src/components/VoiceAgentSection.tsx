/**
 * src/components/VoiceAgentSection.tsx — the Voice Agent.
 *
 * Voice is an INTERFACE, not a second brain. Every spoken or typed question goes
 * through askLegalAgent() → /api/ai/agent, i.e. the same Intent → Facts →
 * Language → Scope → Legal Agent → Hybrid RAG → Corrective RAG → Verified
 * Evidence → Answer Level → Final Answer path the rest of the app uses. There is
 * no voice-specific retrieval, no voice-specific gate, and no second composer.
 *
 * Speech in and speech out use the browser's own Web Speech APIs
 * (src/services/voiceService.ts) and nothing else — this component makes no call
 * to any external speech or AI provider.
 *
 * Session state lives in React memory only (src/lib/voiceAgentState.ts is a pure
 * reducer with no storage import). Nothing is written to localStorage or
 * sessionStorage during a session, no audio is stored, and "Save to Vault" is the
 * only action that persists anything — through the app's existing chat storage.
 * A reload, a page close, End session or Clear conversation discards the session;
 * switching tabs does not, because App keeps this component mounted and hidden.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  Mic, MicOff, Square, Volume2, VolumeX, PhoneOff, Trash2, Send, Loader2,
  Copy, Download, Save, FileText, Keyboard, ShieldAlert, Scale, Building2,
  ExternalLink, CheckCircle2, XCircle, Info, BookOpen, AlertCircle, Share2
} from "lucide-react";
import { MarkdownBody } from "./MarkdownBody";
import { askLegalAgent, buildIncidentDocuments, type AgentSource, type IncidentDocuments, type IntakeSummary } from "../services/aiRuntime";
import { VoiceService, VoiceError, type SpeakReport } from "../services/voiceService";
import { StorageService, type LocalChat } from "../services/storage";
import { FirestoreService } from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../lib/settings";
import { copyTextToClipboard } from "../lib/clipboard";
import { getCurrentLanguage, useLanguageVersion } from "../lib/i18n";
import { getRoute, type AppRoute } from "../config/appRoutes";
import { searchLawyerCards, searchOrgCards, searchEmergencyCards, type DirectoryCard } from "../lib/directorySearch";
import {
  voiceReducer, initialVoiceSession, toAgentContext, buildIntakeSummary, buildCaseBrief, toLocalChat,
  supportLabel, type IntakeFields, type VoicePhase
} from "../lib/voiceAgentState";
import { cn } from "./Layout";

const DISCLAIMER = "This is an AI legal assistant for preliminary information and client intake. It is not a lawyer and does not replace professional legal advice.";

const STATUS_TEXT: Record<VoicePhase, { en: string; roman: string }> = {
  idle: { en: "Ready", roman: "Tayar" },
  consent: { en: "Waiting for your consent", roman: "Aap ki ijazat ka intezaar" },
  listening: { en: "Listening — speak now", roman: "Sun raha hoon — boliye" },
  processing: { en: "Checking the verified law records", roman: "Verified qanooni records dekh raha hoon" },
  speaking: { en: "Speaking", roman: "Bol raha hoon" }
};

/** Plain-language statement of what the answer is based on — no internal jargon. */
function basisLine(status: string, sources: AgentSource[], rom: boolean): { text: string; tone: 'strong' | 'partial' | 'none' } {
  if (sources.length === 0) {
    return {
      tone: 'none',
      text: rom
        ? "Is sawal par verified qanoon ke records nahi mile. Ye jawab un par mabni nahi — baraye meherbani niche diye gaye qadamat dekhein."
        : "No verified legal record was found for this question, so this answer is not based on one. Please use the options below."
    };
  }
  if (status === 'strong') {
    return {
      tone: 'strong',
      text: rom
        ? `Ye jawab ${sources.length} verified qanooni record(s) par mabni hai.`
        : `This answer is based on ${sources.length} verified legal record(s).`
    };
  }
  return {
    tone: 'partial',
    text: rom
      ? "Ye records sirf qisaman milti-julti hain. Kadam uthane se pehle details tasdeeq karein."
      : "Only partially matching records were found. Confirm the details before you act on this."
  };
}

export default function VoiceAgentSection({ onNavigate }: { onNavigate?: (route: AppRoute) => void }) {
  const { user, setShowLoginModal } = useAuth();
  const settings = useSettings();
  const currentLang = getCurrentLanguage();
  const rom = currentLang === 'roman_urdu';
  useLanguageVersion();

  const [state, dispatch] = useReducer(voiceReducer, initialVoiceSession);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [cards, setCards] = useState<DirectoryCard[]>([]);
  const [voiceOut, setVoiceOut] = useState(true);
  const [showIntake, setShowIntake] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'shared' | 'cancelled' | 'fallback-copied' | 'fallback-failed'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [saveError, setSaveError] = useState('');
  const [connectStatus, setConnectStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [showIncident, setShowIncident] = useState(false);
  const [incidentDocs, setIncidentDocs] = useState<IncidentDocuments | null>(null);
  const [incidentStatus, setIncidentStatus] = useState<'idle' | 'building' | 'ready' | 'failed'>('idle');
  const [incidentError, setIncidentError] = useState('');
  const [incidentCopied, setIncidentCopied] = useState<'complaint' | 'brief' | 'fail' | null>(null);
  const [connectRef, setConnectRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [sttAvailable, setSttAvailable] = useState(true);
  /** Recognised words waiting for the user to edit or confirm them before submission. */
  const [review, setReview] = useState<string | null>(null);
  /** The recognition locale this browser rejected; keeps the honest fallback visible. */
  const [localeIssue, setLocaleIssue] = useState<string | null>(null);
  /** The voice that really produced the last spoken answer, reported not assumed. */
  const [spokenVoice, setSpokenVoice] = useState<SpeakReport | null>(null);
  /** A speech-output limitation the device actually hit, stated rather than hidden. */
  const [ttsIssue, setTtsIssue] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);

  const label = (en: string, r: string) => (rom ? r : en);
  const lastAnswer = [...state.turns].reverse().find(t => t.role === 'agent')?.text || '';
  const lastSources = [...state.turns].reverse().find(t => t.role === 'agent')?.sources || [];
  const intake: IntakeSummary | null = state.lastIntake;

  useEffect(() => {
    const caps = VoiceService.getCapabilities();
    setSttAvailable(caps.browserSTT);
  }, []);

  useEffect(() => {
    const el = endRef.current;
    // This screen stays mounted while its tab is hidden. Scrolling a hidden
    // sentinel into view still scrolls the window, which moved the home page.
    if (!el || !el.getClientRects().length || !el.checkVisibility?.({ checkVisibilityCSS: true })) return;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [state.turns, state.liveTranscript, state.phase]);

  // ---- speech out: the SAME text object that is displayed on screen ----
  const speakText = useCallback((text: string) => {
    if (!text.trim()) return;
    dispatch({ type: 'SPOKEN', text });
    dispatch({ type: 'PHASE', phase: 'speaking' });
    setTtsIssue(null);
    VoiceService.speak(
      text,
      undefined,
      () => dispatch({ type: 'PHASE', phase: 'listening' }),
      (err: any) => {
        dispatch({ type: 'PHASE', phase: 'listening' });
        if (err?.code === 'urdu-voice-missing') {
          setTtsIssue(label(
            'No Urdu voice is installed on this device, so the Urdu answer was read by another voice. The words are correct; the pronunciation is not Urdu.',
            'Is device par Urdu voice install nahi hai, is liye Urdu jawab doosri voice ne parha. Alfaaz durust hain, talaffuz Urdu nahi.'
          ));
        } else if (err?.code === 'tts-unavailable' || err?.code === 'unsupported') {
          setTtsIssue(err?.code === 'unsupported'
            ? label('This browser cannot read answers aloud.', 'Is browser mein jawab bulwana mumkeen nahi.')
            : label('No voice is available on this device.', 'Is device par koi awaaz available nahi hai.'));
        }
      },
      currentLang,
      (report) => setSpokenVoice(report)
    );
  }, [currentLang, rom]);

  // ---- one turn: current message is the only query, context is continuity only ----
  const runTurn = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question) return;
    setError(null);
    dispatch({ type: 'USER_TURN', text: question });
    try {
      const reply = await askLegalAgent(question, rom ? 'roman_urdu' : 'en', toAgentContext(stateRef.current));
      dispatch({ type: 'AGENT_ANSWER', text: reply.reply, intake: reply.intake ?? null, sources: reply.sources });

      const needSupport = reply.intake?.professionalSupportNeeded === true;
      const safetyFirst = (reply.intake?.suggestedNextStep || '').startsWith('Safety first');

      if (voiceOut) speakText(reply.reply);
      else dispatch({ type: 'PHASE', phase: 'listening' });

      if (!needSupport && !safetyFirst) { setCards([]); return; }
      // Directory enrichment must never delay or block the spoken answer.
      const needle = `${question} ${reply.intake?.location || ''} ${reply.intake?.domain || ''}`;
      try {
        const [lawyers, orgs, emergency] = await Promise.all([
          searchLawyerCards(needle, rom),
          searchOrgCards(needle),
          searchEmergencyCards(needle)
        ]);
        setCards(safetyFirst
          ? [...emergency, ...lawyers.cards.slice(0, 2)]
          : [...lawyers.cards, ...orgs.cards.slice(0, 2)]);
      } catch {
        setCards([]);
      }
    } catch (err: any) {
      dispatch({ type: 'PHASE', phase: 'listening' });
      setError(err?.message || label(
        "The Voice Agent could not respond. Please try again.",
        "Voice Agent jawab nahi de saka. Dobara koshish karein."
      ));
    }
  }, [rom, voiceOut, speakText]);

  const runTurnRef = useRef(runTurn);
  runTurnRef.current = runTurn;

  // ---- speech in ----
  const listen = useCallback(async () => {
    setError(null);
    dispatch({ type: 'LIVE_TRANSCRIPT', text: '' });
    dispatch({ type: 'PHASE', phase: 'listening' });
    try {
      const result = await VoiceService.transcribe(
        rom ? 'ur-PK' : 'en-US',
        15000,
        (partial) => dispatch({ type: 'LIVE_TRANSCRIPT', text: partial })
      );
      if (result.text) {
        setLocaleIssue(null);
        // The recognised words are held for review: a mis-heard name, amount, date
        // or city must be correctable before it reaches /api/ai/agent.
        dispatch({ type: 'PHASE', phase: 'idle' });
        setReview(result.text);
      }
    } catch (err: any) {
      dispatch({ type: 'LIVE_TRANSCRIPT', text: '' });
      if (err instanceof VoiceError && err.code === 'cancelled') {
        dispatch({ type: 'PHASE', phase: 'idle' });
        return;
      }
      if (err instanceof VoiceError && err.code === 'unsupported') {
        setSttAvailable(false);
        dispatch({ type: 'PHASE', phase: 'idle' });
        setError(label(
          "Voice input is not available in this browser. You can continue in text mode.",
          "Is browser mein awaz se baat nahi ho sakti. Aap text mode mein jaari rakh sakte hain."
        ));
        return;
      }
      if (err instanceof VoiceError && err.code === 'unsupported-locale') {
        setLocaleIssue(rom ? 'ur-PK' : 'en-US');
        dispatch({ type: 'PHASE', phase: 'idle' });
        return;
      }
      dispatch({ type: 'PHASE', phase: 'idle' });
      setError(err instanceof VoiceError
        ? err.message
        : label("Listening failed. Please try again.", "Sunna mumkin nahi hua. Dobara koshish karein."));
    }
  }, [rom]);

  const startSession = useCallback(() => {
    if (!stateRef.current.consented) { dispatch({ type: 'REQUEST_VOICE' }); return; }
    void listen();
  }, [listen]);

  const acceptConsent = useCallback(() => {
    dispatch({ type: 'CONSENT_GRANTED' });
    if (pendingRef.current) {
      const q = pendingRef.current;
      pendingRef.current = null;
      void runTurnRef.current(q);
      return;
    }
    void listen();
  }, [listen]);

  const stopListening = () => {
    VoiceService.stopRecognition();
    setReview(null);
    dispatch({ type: 'LIVE_TRANSCRIPT', text: '' });
    dispatch({ type: 'PHASE', phase: 'idle' });
  };

  // Mute and Stop speaking cancel the browser engine; they must not invent a
  // session phase the user has not entered yet, or pressing Mute on the consent
  // notice would hide the notice without recording consent.
  const quiet = () => { if (stateRef.current.consented) dispatch({ type: 'PHASE', phase: 'listening' }); };
  const mute = () => { setVoiceOut(false); VoiceService.stop(); quiet(); };
  const unmute = () => setVoiceOut(true);
  const stopSpeaking = () => { VoiceService.stop(); quiet(); };
  const replay = () => { const t = lastAnswer || state.lastSpoken; if (t) speakText(t); };

  const endSession = () => {
    VoiceService.stop();
    VoiceService.stopRecognition();
    setCards([]);
    setReview(null);
    setLocaleIssue(null);
    setSaveStatus('idle');
    setSaveError('');
    setConnectStatus('idle');
    setShowIntake(false);
    dispatch({ type: 'RESET' });
  };

  const clearConversation = () => {
    VoiceService.stop();
    setCards([]);
    setReview(null);
    setSaveStatus('idle');
    setError(null);
    dispatch({ type: 'CLEAR_TRANSCRIPT' });
  };

  // ---- intake summary: copy / export / connect (contact only, never a booking) ----
  const copySummary = async () => {
    const text = buildIntakeSummary(stateRef.current);
    const ok = await copyTextToClipboard(text);
    setCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCopied(null), 3000);
    return ok;
  };

  const exportSummary = () => {
    const text = buildIntakeSummary(stateRef.current);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'insaaf-client-intake-summary.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Web Share is a browser/OS primitive: the app itself sends nothing anywhere.
  // A sheet the user dismisses is reported as cancelled, never as a silent success,
  // and a browser without share support says so instead of pretending.
  const shareSummary = async () => {
    const text = buildIntakeSummary(stateRef.current);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'INSAaf client intake summary', text });
        setShareStatus('shared');
      } catch {
        setShareStatus('cancelled');
      }
      return;
    }
    const ok = await copySummary();
    setShareStatus(ok ? 'fallback-copied' : 'fallback-failed');
  };

  const connectToIntake = async () => {
    const text = buildIntakeSummary(stateRef.current);
    setConnectStatus('sending');
    try {
      const id = await FirestoreService.submitContactForm({
        userId: user?.uid || null,
        name: user?.displayName || '',
        email: user?.email || '',
        message: text,
        source: 'voice_agent'
      });
      setConnectRef(id);
      setConnectStatus('sent');
    } catch {
      setConnectStatus('failed');
    }
  };

  // ---- the ONLY persistence action in this screen ----
  const saveToVault = async () => {
    if (state.turns.length === 0) {
      setSaveError(label("Nothing to save yet.", "Abhi save karne ke liye kuch nahi."));
      setSaveStatus('failed');
      return;
    }
    const chat: LocalChat = toLocalChat(stateRef.current);
    setSaveStatus('saving');
    setSaveError('');
    try {
      if (user) await FirestoreService.saveChat(user.uid, chat);
      else StorageService.saveChat(chat);
      dispatch({ type: 'MARK_SAVED', chatId: chat.id });
      setSaveStatus('saved');
    } catch (err: any) {
      setSaveStatus('failed');
      setSaveError(err?.message || label(
        "Saving failed. Your session is still here — you can try again.",
        "Save nahi hua. Aap ka session yahan hai —dobara koshish karein."
      ));
      if (!user) setShowLoginModal?.(true);
    }
  };

  // ---- complaint for the SHO + one-page brief for a lawyer, assembled by code ----
  const prepareIncidentDocuments = async () => {
    const narrative = stateRef.current.turns
      .filter(t => t.role === 'user')
      .map(t => String(t.text || '').trim())
      .filter(Boolean)
      .join(' ');
    if (!narrative) {
      setIncidentStatus('failed');
      setIncidentError(label(
        "Nothing to build from yet — describe what happened first.",
        "Abhi banane ke liye kuch nahi — pehle bataein kya hua."
      ));
      return;
    }
    setIncidentStatus('building');
    setIncidentError('');
    setIncidentDocs(null);
    try {
      const docs = await buildIncidentDocuments(narrative, intake ?? null, rom ? 'roman_urdu' : 'en');
      setIncidentDocs(docs);
      setIncidentStatus('ready');
    } catch (err: any) {
      setIncidentStatus('failed');
      setIncidentError(err?.message || label(
        "The documents could not be prepared.",
        "Dastawez tayyar nahi ho sake."
      ));
    }
  };

  const copyIncidentDoc = async (which: 'complaint' | 'brief') => {
    const text = which === 'complaint' ? incidentDocs?.complaint : incidentDocs?.brief;
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    setIncidentCopied(ok ? which : 'fail');
    setTimeout(() => setIncidentCopied(null), 3000);
  };

  const exportIncidentDocs = () => {
    if (!incidentDocs) return;
    const url = URL.createObjectURL(new Blob(
      [`${incidentDocs.complaint}\n\n${'='.repeat(70)}\n\n${incidentDocs.brief}`],
      { type: 'text/plain;charset=utf-8' }
    ));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'insaaf-complaint-and-lawyer-brief.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const continueInText = () => {
    window.dispatchEvent(new CustomEvent('insaaf_handoff_to_chat', {
      detail: {
        question: [...state.turns].reverse().find(t => t.role === 'user')?.text || '',
        answer: lastAnswer
      }
    }));
    onNavigate?.(getRoute('chat')!);
  };

  // The Legal Agent's voice chip hands a question over to this screen.
  useEffect(() => {
    const onHandoff = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string } | undefined;
      const text = String(detail?.text || '').trim();
      if (!text) return;
      if (stateRef.current.consented) void runTurnRef.current(text);
      else { pendingRef.current = text; dispatch({ type: 'REQUEST_VOICE' }); }
    };
    window.addEventListener('insaaf_handoff_to_voice', onHandoff as EventListener);
    return () => window.removeEventListener('insaaf_handoff_to_voice', onHandoff as EventListener);
  }, []);

  const sendText = () => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');
    void runTurn(text);
  };

  const status = STATUS_TEXT[state.phase];
  const basis = lastAnswer
    ? basisLine(intake?.evidenceStatus || 'not_evaluated', lastSources, rom)
    : null;
  const safetyFirst = (intake?.suggestedNextStep || '').startsWith('Safety first');

  const btn = "px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl p-6 md:p-8 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-black text-[#01411C] flex items-center gap-2">
              <Mic className="w-6 h-6" /> {label("Voice Agent", "Awaz se Legal Agent")}
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              {label(
                "Speak your legal question. You can type it instead at any time.",
                "Apna qanooni sawal boliye. Chahein to likh bhi sakte hain."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span data-testid="voice-status" className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
              state.phase === 'listening' && "bg-red-50 text-red-700 border-red-100",
              state.phase === 'processing' && "bg-amber-50 text-amber-700 border-amber-100",
              state.phase === 'speaking' && "bg-emerald-50 text-[#01411C] border-emerald-100",
              (state.phase === 'idle' || state.phase === 'consent') && "bg-gray-50 text-gray-500 border-gray-100"
            )}>
              {rom ? status.roman : status.en}
            </span>
            <span className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-gray-50 text-gray-500 border border-gray-100">
              {label(`Detail: ${settings.answerLevel}`, `Tafseel: ${settings.answerLevel}`)}
              <button
                type="button"
                data-testid="voice-change-level"
                onClick={() => window.dispatchEvent(new Event('insaaf_open_settings'))}
                className="ml-2 underline text-[#01411C] font-black"
              >
                {label("Change", "Badlein")}
              </button>
            </span>
          </div>
        </div>

        {/* Mandatory disclaimer — always visible on this screen */}
        <p data-testid="voice-disclaimer" className="text-[11px] font-medium text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
          {DISCLAIMER}
        </p>

        {/* ---------------- consent, before the microphone is ever used ---------------- */}
        {state.phase === 'consent' && (
          <div data-testid="voice-consent" className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 space-y-3">
            <h3 className="text-sm font-black text-[#01411C] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> {label("Before we start", "Shuru karne se pehle")}
            </h3>
            <ul className="text-[11px] text-gray-600 space-y-1 list-disc pl-5">
              <li>{label("No audio is recorded or stored. Nothing is saved unless you press Save to Vault.", "Koi awaz record ya store nahi hoti. Jab tak aap Save to Vault na dabayein, kuch mehfooz nahi hota.")}</li>
              <li>{label("Your words stay in this session only. Closing the page or reloading discards them.", "Aap ke alfaz sirf is session tak mehdood hain. Page band ya reload karne par khatam ho jayenge.")}</li>
              <li>{label("Answers come from the verified law collection, and this assistant is not a lawyer.", "Jawab verified qanoon ke majmooe se aate hain, aur ye assistant lawyer nahi hai.")}</li>
            </ul>
            <div className="flex gap-3 flex-wrap">
              <button data-testid="voice-consent-accept" onClick={acceptConsent} className={cn(btn, "bg-[#01411C] text-white hover:bg-[#02301a]")}>
                <Mic className="w-3.5 h-3.5" /> {label("Start voice session", "Voice session shuru karein")}
              </button>
              <button data-testid="voice-consent-decline" onClick={() => dispatch({ type: 'DECLINE_VOICE' })} className={cn(btn, "bg-white border border-gray-200 text-gray-600")}>
                <Keyboard className="w-3.5 h-3.5" /> {label("Continue in text", "Text se jaari rakhein")}
              </button>
            </div>
          </div>
        )}

        {/* ---------------- controls: every one is bound to a real handler ---------------- */}
        <div className="flex flex-wrap gap-2 items-center" data-testid="voice-controls">
          <button
            data-testid="voice-start"
            onClick={startSession}
            disabled={!sttAvailable || state.phase === 'listening' || state.phase === 'processing'}
            className={cn(btn, "bg-[#01411C] text-white hover:bg-[#02301a]")}
          >
            <Mic className="w-3.5 h-3.5" />
            {state.consented ? label("Speak a question", "Sawal boliye") : label("Start Voice Session", "Voice Session Shuru")}
          </button>
          <button
            data-testid="voice-stop"
            onClick={stopListening}
            disabled={state.phase !== 'listening'}
            className={cn(btn, "bg-white border border-gray-200 text-gray-700")}
          >
            <Square className="w-3.5 h-3.5" /> {label("Stop listening", "Sunna rokein")}
          </button>
          {voiceOut ? (
            <button data-testid="voice-mute" onClick={mute} className={cn(btn, "bg-white border border-gray-200 text-gray-700")}>
              <VolumeX className="w-3.5 h-3.5" /> {label("Mute", "Khamosh")}
            </button>
          ) : (
            <button data-testid="voice-unmute" onClick={unmute} className={cn(btn, "bg-white border border-gray-200 text-gray-700")}>
              <Volume2 className="w-3.5 h-3.5" /> {label("Unmute", "Awaz on")}
            </button>
          )}
          <button
            data-testid="voice-stop-speaking"
            onClick={stopSpeaking}
            disabled={state.phase !== 'speaking'}
            className={cn(btn, "bg-white border border-gray-200 text-gray-700")}
          >
            <PhoneOff className="w-3.5 h-3.5" /> {label("Stop speaking", "Bolna rokein")}
          </button>
          <button
            data-testid="voice-read-aloud"
            onClick={() => lastAnswer && speakText(lastAnswer)}
            disabled={!lastAnswer || !voiceOut}
            className={cn(btn, "bg-white border border-gray-200 text-gray-700")}
          >
            <Volume2 className="w-3.5 h-3.5" /> {label("Read aloud", "Sunen")}
          </button>
          <button
            data-testid="voice-replay"
            onClick={replay}
            disabled={!state.lastSpoken || !voiceOut}
            className={cn(btn, "bg-white border border-gray-200 text-gray-700")}
          >
            <RefreshIcon /> {label("Replay", "Dobara sunen")}
          </button>
          <button data-testid="voice-continue-text" onClick={continueInText} className={cn(btn, "bg-white border border-gray-200 text-gray-700")}>
            <Keyboard className="w-3.5 h-3.5" /> {label("Continue in text", "Text mein jaari")}
          </button>
          <button
            data-testid="voice-intake-toggle"
            onClick={() => setShowIntake(v => !v)}
            disabled={!intake}
            className={cn(btn, "bg-white border border-gray-200 text-gray-700")}
          >
            <FileText className="w-3.5 h-3.5" /> {label(showIntake ? "Hide intake summary" : "View intake summary", label("Intake Summary", "Intake Summary"))}
          </button>
          <button
            data-testid="voice-incident-toggle"
            onClick={() => setShowIncident(v => !v)}
            disabled={state.turns.filter(t => t.role === 'user').length === 0}
            className={cn(btn, "bg-white border border-gray-200 text-gray-700")}
          >
            <FileText className="w-3.5 h-3.5" /> {label(showIncident ? "Hide my documents" : "Complaint + lawyer brief", showIncident ? "Dastawez chhupayen" : "Shikayat + wukala brief")}
          </button>
          <button
            data-testid="voice-save"
            onClick={saveToVault}
            disabled={state.turns.length === 0 || saveStatus === 'saving'}
            className={cn(btn, "bg-[#01411C] text-white hover:bg-[#02301a]")}
          >
            {saveStatus === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {label("Save to Vault", "Vault mein mehfooz")}
          </button>
          <button data-testid="voice-clear" onClick={clearConversation} className={cn(btn, "bg-white border border-gray-200 text-gray-700")}>
            <Trash2 className="w-3.5 h-3.5" /> {label("Clear conversation", "Baatcheet mitayein")}
          </button>
          <button data-testid="voice-end" onClick={endSession} className={cn(btn, "bg-white border border-red-200 text-red-600")}>
            <PhoneOff className="w-3.5 h-3.5" /> {label("End session", "Session khatam")}
          </button>
        </div>

        {saveStatus === 'saved' && (
          <p data-testid="voice-save-success" className="text-[11px] font-bold text-[#01411C] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> {label("Saved to your Vault.", "Aap ke Vault mein mehfooz ho gaya.")}
          </p>
        )}
        {saveStatus === 'failed' && (
          <p data-testid="voice-save-error" className="text-[11px] font-bold text-red-600 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> {saveError || label("Saving failed.", "Save nahi hua.")}
          </p>
        )}

        {error && (
          <p data-testid="voice-error" className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
        )}
        {!sttAvailable && (
          <p data-testid="voice-stt-unavailable" className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            {label("Voice input is not available in this browser. You can continue in text mode.", "Is browser mein awaz se baat nahi ho sakti. Aap text mode mein jaari rakh sakte hain.")}
          </p>
        )}
        {ttsIssue && (
          <p data-testid="voice-tts-issue" className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            {ttsIssue}
          </p>
        )}
        {spokenVoice && spokenVoice.voiceName && (
          <p data-testid="voice-tts-voice" className="text-[10px] font-bold text-gray-400">
            {label(`Spoken with the device voice “${spokenVoice.voiceName}” (${spokenVoice.voiceLang || 'unknown locale'})`,
              `Device voice “${spokenVoice.voiceName}” (${spokenVoice.voiceLang || 'maloom nahi'}) se parha gaya`)}
          </p>
        )}
        {localeIssue && (
          <p data-testid="voice-locale-unavailable" className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            {label(
              `No speech engine is installed for ${localeIssue}. Speech recognition does not work for this language in this browser — type your question instead; the Legal Agent and Read Aloud still work.`,
              `${localeIssue} ke liye speech engine install nahi hai. Is zuban mein speech recognition is browser mein kaam nahi karta — sawal likh kar bhejen; Legal Agent aur Read Aloud chalte rahenge.`
            )}
          </p>
        )}

        {/* ---------------- live + final transcript ---------------- */}
        <div className="space-y-3">
          {state.liveTranscript && (
            <div data-testid="voice-live-transcript" className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label("Hearing", "Sunai de rahi hai")}</p>
              <p className="text-sm text-gray-700">{state.liveTranscript}</p>
            </div>
          )}

          {review !== null && (
            <div data-testid="voice-review" className="rounded-2xl bg-white border border-emerald-200 px-4 py-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {label("Check what was heard", "Sune shude lafz check karein")}
              </p>
              <textarea
                data-testid="voice-review-input"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={2}
                aria-label={label("Edit the recognised text before sending", "Bhejne se pehle shunakht matn mein tabdeeli karein")}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-gray-500">
                {label(
                  "These words were recognised by your browser. Correct any name, amount, date or city before sending.",
                  "Ye lafz aap ke browser ne pehchane hain. Bhejne se pehle naam, raqam, tareekh ya sheher durust kar len."
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  data-testid="voice-review-send"
                  type="button"
                  disabled={review.trim().length === 0}
                  onClick={() => {
                    const q = review.trim();
                    setReview(null);
                    void runTurnRef.current(q);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> {label("Send to Legal Agent", "Legal Agent ko bhejen")}
                </button>
                <button
                  data-testid="voice-review-discard"
                  type="button"
                  onClick={() => setReview(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {label("Discard", "Rehne dein")}
                </button>
              </div>
            </div>
          )}

          {state.turns.length === 0 && state.phase !== 'consent' && (
            <p data-testid="voice-empty-note" className="text-[11px] text-gray-400">
              {label(
                "This session is not saved anywhere. It disappears if you reload or close the page — use Save to Vault to keep it.",
                "Ye session kahin mehfooz nahi hota. Reload ya page band karne par khatam ho jayega — rakhne ke liye Save to Vault dabayein."
              )}
            </p>
          )}

          <div className="space-y-3" data-testid="voice-transcript">
            {state.turns.map((t, i) => (
              <div key={`${t.ts}-${i}`} className={cn("rounded-2xl px-4 py-3 border", t.role === 'user' ? "bg-gray-50 border-gray-100" : "bg-white border-emerald-100")}>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                  {t.role === 'user' ? label("You said", "Aap ne kaha") : label("Voice Agent", "Voice Agent")}
                </p>
                {t.role === 'user' ? (
                  <p className="text-sm text-gray-800 font-medium">{t.text}</p>
                ) : (
                  <div
                    data-testid={i === state.turns.length - 1 ? "voice-answer" : undefined}
                    data-spoken={state.lastSpoken && i === state.turns.length - 1 ? state.lastSpoken : undefined}
                    className="text-sm text-gray-800 space-y-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5"
                  >
                    <MarkdownBody text={t.text} />
                  </div>
                )}
              </div>
            ))}
            {state.phase === 'processing' && (
              <div className="flex items-center gap-2 text-xs text-gray-500" data-testid="voice-processing">
                <Loader2 className="w-4 h-4 animate-spin" /> {rom ? status.roman : status.en}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {basis && (
            <p
              data-testid={basis.tone === 'none' ? 'voice-no-verified-record' : basis.tone === 'partial' ? 'voice-partial-record' : 'voice-verified-record'}
              className={cn(
                "text-[11px] font-bold rounded-xl px-3 py-2 border flex items-start gap-2",
                basis.tone === 'strong' && "bg-emerald-50 text-[#01411C] border-emerald-100",
                basis.tone === 'partial' && "bg-amber-50 text-amber-800 border-amber-100",
                basis.tone === 'none' && "bg-gray-50 text-gray-600 border-gray-100"
              )}
            >
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {basis.text}
            </p>
          )}

          {basis?.tone === 'none' && (
            <div className="flex flex-wrap gap-2">
              {['library', 'lawyers', 'legalaid'].map(id => {
                const r = getRoute(id)!;
                return (
                  <button key={id} data-testid={`voice-suggest-${id}`} onClick={() => onNavigate?.(r)} className={cn(btn, "bg-white border border-gray-200 text-gray-700")}>
                    <BookOpen className="w-3.5 h-3.5" /> {rom ? r.labelRoman : r.labelEn}
                  </button>
                );
              })}
            </div>
          )}

          {safetyFirst && (
            <div data-testid="voice-safety" className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-2">
              <p className="text-xs font-black text-red-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> {label("Safety first", "Pehle hifazat")}
              </p>
              <p className="text-[11px] text-red-700">
                {label(
                  "If someone is in danger, call the emergency numbers listed below yourself. This app cannot contact the police or anyone else for you, and no help has been called on your behalf.",
                  "Agar koi khatre mein hai to niche diye emergency number khud milayein. Ye app police ya kisi aur se raabita nahi karti, aur aap ki taraf se koi madad nahi bheji gayi."
                )}
              </p>
            </div>
          )}

          {/* tri-state professional-support line, rendered honestly */}
          {intake && (
            <div
              data-testid={intake.professionalSupportNeeded === true
                ? 'voice-support-yes'
                : intake.professionalSupportNeeded === false ? 'voice-support-no' : 'voice-support-unclear'}
              className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label("Next step", "Agla qadama")}</p>
              <p className="text-xs text-gray-700">{intake.suggestedNextStep || label("No specific next step was found in the verified records.", "Verified records mein koi khas agla qadama nahi mila.")}</p>
              <p className="text-xs text-gray-600">{supportLabel(intake.professionalSupportNeeded, intake.domain)}</p>
              {intake.missingMandatoryFacts.length > 0 && (
                <p className="text-[11px] text-gray-500">
                  {label("Still needed:", "Abhi chahiye:")} {intake.missingMandatoryFacts.join(' · ')}
                </p>
              )}
              {intake.professionalSupportNeeded === true && (
                <button
                  data-testid="voice-connect"
                  onClick={connectToIntake}
                  disabled={connectStatus === 'sending'}
                  className={cn(btn, "bg-white border border-gray-200 text-gray-700")}
                >
                  {connectStatus === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {label("Send intake summary as an enquiry", "Intake summary istefsaal ke tor par bhejein")}
                </button>
              )}
              {connectStatus === 'sent' && (
                <p data-testid="voice-connect-sent" className="text-[11px] font-bold text-[#01411C]">
                  {label(`Enquiry recorded (reference ${connectRef.slice(0, 8)}). This is not a booking — they have not been contacted for you.`, `Istefsaal mehfooz hua (reference ${connectRef.slice(0, 8)}). Ye booking nahi hai — aap ki taraf se kisi se raabita nahi kiya gaya.`)}
                </p>
              )}
              {connectStatus === 'failed' && (
                <p data-testid="voice-connect-failed" className="text-[11px] font-bold text-red-600">
                  {label("The enquiry could not be recorded. You can copy the summary instead.", "Istefsaal mehfooz nahi ho saka. Aap summary copy kar sakte hain.")}
                </p>
              )}
            </div>
          )}

          {cards.length > 0 && (
            <div data-testid="voice-cards" className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label("Verified directory", "Verified directory")}</p>
              {cards.map((c, ci) => (
                <div key={ci} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  {c.kind === 'lawyer' && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0"><Scale className="w-4 h-4 text-[#01411C]" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-gray-900 truncate">{c.record.fullName}</p>
                        <p className="text-[11px] text-gray-500">{c.record.city}{c.record.province ? `, ${c.record.province}` : ''} · {c.record.specialization}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{c.record.barCouncil || ''} · {c.record.verifiedStatus}</p>
                        <p className="text-[10px] mt-0.5">
                          {c.record.verificationSourceUrl ? (
                            <a
                              href={c.record.verificationSourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              data-testid={`voice-card-verification-${ci}`}
                              className="font-black uppercase tracking-widest text-[#01411C] flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> {label("Verified against", "Is se tasdeeq shuda")}
                            </a>
                          ) : (
                            <span data-testid={`voice-card-no-verification-${ci}`} className="font-bold text-gray-400 uppercase tracking-widest">
                              {label("No verification source on file", "Tasdeeq ka koi source record par nahi")}
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {c.record.officialPublicEmail ? (
                            <a href={`mailto:${c.record.officialPublicEmail}?subject=Legal Consultation Inquiry`} className="text-[10px] font-black uppercase tracking-widest text-[#01411C] flex items-center gap-1">
                              {label("Email counsel", "Email karein")}
                            </a>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label("Contact info not publicly available", "Raabite ki maloomat public nahi")}</span>
                          )}
                          {c.record.officialPublicPhone && (
                            <a href={`tel:${c.record.officialPublicPhone}`} className="text-[10px] font-black uppercase tracking-widest text-[#01411C] flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> {label("Call office", "Office ko call karein")}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {c.kind === 'org' && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0"><Building2 className="w-4 h-4 text-blue-700" /></div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-gray-900 truncate">{c.record.name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{c.record.description}</p>
                        {c.record.phone && <p className="text-[10px] text-gray-400 mt-1">{c.record.phone}</p>}
                      </div>
                    </div>
                  )}
                  {c.kind === 'emergency' && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center shrink-0"><AlertCircle className="w-4 h-4 text-red-600" /></div>
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
        </div>

        {/* ---------------- intake summary ---------------- */}
        {showIntake && intake && (
          <div data-testid="voice-intake-summary" className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            {/* ---- editable fact review: correct the record BEFORE it is used ---- */}
            <div data-testid="voice-review-panel" className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
              <p className="text-[11px] font-bold text-gray-800">
                {label("Review my facts before anything is drafted", "Dastawez banane se pehle apni baat-cheen dekh lein")}
              </p>
              <p className="text-[10px] text-gray-500">
                {label(
                  `What you change here becomes the record of this case, and the assistant will not overwrite it again from what it thinks it heard. ${state.correctedSlots.length} of 9 slots are confirmed by you; the rest are still only as heard.`,
                  `Jo aap yahan badalte hain wahi aap ke case ka record ban jata hai, aur assistant use dobara apni suni hua baat se nahi badlega. 9 mein se ${state.correctedSlots.length} slots aap ne khud tasdeeq kiye hain; baki sirf sunai hua hain.`
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  ['issue', label('The issue', 'Masla')],
                  ['location', label('Place / city', 'Jagah / sheher')],
                  ['jurisdiction', label('Jurisdiction', 'Jurisdiction')],
                  ['institution', label('Institution or opposite side', 'Idara ya dosra farq')],
                  ['requestedOutcome', label('Outcome you want', 'Aap ka maqsad')]
                ] as [keyof IntakeFields, string][]).map(([slot, cap]) => (
                  <label key={slot} className="block">
                    <span className="text-[10px] font-bold text-gray-500">{cap}</span>
                    <input
                      data-testid={`voice-review-${slot}`}
                      className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1 text-[11px]"
                      value={String(state[slot] ?? '')}
                      onChange={e => dispatch({ type: 'EDIT_INTAKE', patch: { [slot]: e.target.value } as Partial<IntakeFields> })}
                    />
                  </label>
                ))}
              </div>
              {([
                ['facts', label('Key facts (one per line)', 'Aham haqaiq (ek line mein ek)')],
                ['timeline', label('Timeline (one per line)', 'Waqt ka tarteeb (ek line mein ek)')],
                ['deadlines', label('Deadlines (one per line)', 'Mohlatein (ek line mein ek)')],
                ['documents', label('Documents you hold (one per line)', 'Aap ke paas dastawez (ek line mein ek)')]
              ] as [keyof IntakeFields, string][]).map(([slot, cap]) => (
                <label key={slot} className="block">
                  <span className="text-[10px] font-bold text-gray-500">{cap}</span>
                  <textarea
                    data-testid={`voice-review-${slot}`}
                    rows={2}
                    className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1 text-[11px]"
                    value={(state[slot] as string[]).join('\n')}
                    onChange={e => dispatch({ type: 'EDIT_INTAKE', patch: { [slot]: e.target.value.split('\n') } as Partial<IntakeFields> })}
                  />
                </label>
              ))}
            </div>
            <pre className="whitespace-pre-wrap text-[11px] text-gray-700 font-sans">{buildIntakeSummary(state)}</pre>
            <div className="flex gap-2 flex-wrap">
              <button data-testid="voice-copy-summary" onClick={copySummary} className={cn(btn, "bg-white border border-gray-200 text-gray-700")}>
                <Copy className="w-3.5 h-3.5" /> {copied === 'ok' ? label("Copied", "Copy ho gaya") : copied === 'fail' ? label("Copy failed — select the text above and copy it manually", "Copy nahi hua — upar ka text select karke khud copy karein") : label("Copy summary", "Summary copy")}
              </button>
              <button data-testid="voice-export-summary" onClick={exportSummary} className={cn(btn, "bg-white border border-gray-200 text-gray-700")}>
                <Download className="w-3.5 h-3.5" /> {label("Export as text file", "Text fileExport")}
              </button>
              <button data-testid="voice-share-summary" onClick={shareSummary} className={cn(btn, "bg-white border border-gray-200 text-gray-700")}>
                <Share2 className="w-3.5 h-3.5" /> {label("Share", "Share")}
              </button>
            </div>
            {shareStatus !== 'idle' && (
              <p data-testid={`voice-share-status-${shareStatus}`} className="text-[11px] text-gray-500">
                {shareStatus === 'shared' && label("The summary was handed to your device's share sheet.", "Summary aap ke device ke share sheet ko de di gayi.")}
                {shareStatus === 'cancelled' && label("Sharing was cancelled — nothing left this device.", "Sharing cancel kar di gayi — kuch bhi device se bahar nahi gaya.")}
                {shareStatus === 'fallback-copied' && label("This browser has no share sheet, so the summary was copied instead.", "Is browser mein share sheet nahi hai, is liye summary copy kar di gayi.")}
                {shareStatus === 'fallback-failed' && label("This browser has no share sheet and would not accept the copy — select the summary and copy it yourself.", "Is browser mein share sheet nahi hai aur copy bhi nahi hua — summary khud select karke copy karein.")}
              </p>
            )}

            {/* ---- nine-part case brief: client account (1–8) kept apart from verified law (9) ---- */}
            <button
              data-testid="voice-toggle-brief"
              onClick={() => setShowBrief(v => !v)}
              className={cn(btn, "bg-white border border-gray-200 text-gray-700")}
            >
              <FileText className="w-3.5 h-3.5" /> {label(showBrief ? "Hide the 9-part case brief" : "9-part case brief for a lawyer", showBrief ? "Case brief chhupayen" : "Wukil ke liye 9 hissaton ka case brief")}
            </button>
            {showBrief && (
              <div className="space-y-2">
                <pre data-testid="voice-case-brief" className="whitespace-pre-wrap text-[11px] text-gray-700 font-sans rounded-xl border border-gray-200 bg-white p-3">
                  {buildCaseBrief(state, lastSources)}
                </pre>
                <p className="text-[10px] text-gray-500">
                  {label(
                    "Parts 1–8 are your account of the matter, marked for whether you confirmed each one. Part 9 is the only part drawn from the verified law collection, and it lists the records by name rather than restating them as facts about your case.",
                    "Hissay 1–8 aap apne case ki apni Zubani hain, aur har ek par wazeh hai ke aap ne tasdeeq ki ya nahi. Hissa 9 hi verified qanoon ke records se hai — us mein records ke naam likhe hain, aap ke case ke haqaiq ke tor par nahi."
                  )}
                </p>
                <button
                  data-testid="voice-copy-brief"
                  onClick={async () => {
                    const ok = await copyTextToClipboard(buildCaseBrief(state, lastSources));
                    setCopied(ok ? 'ok' : 'fail');
                    setTimeout(() => setCopied(null), 3000);
                  }}
                  className={cn(btn, "bg-white border border-gray-200 text-gray-700")}
                >
                  <Copy className="w-3.5 h-3.5" /> {copied === 'ok' ? label("Brief copied", "Brief copy ho gaya") : copied === 'fail' ? label("Copy failed — select the brief and copy it manually", "Copy nahi hua — brief select karke khud copy karein") : label("Copy the brief", "Brief copy karein")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- incident documents: complaint + lawyer brief ---------------- */}
        {showIncident && (
          <div data-testid="voice-incident-panel" className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <p className="text-[11px] text-gray-600">
              {label(
                "Two documents assembled by INSAaf from what you told this session: a written complaint to take to the officer at the police station, and a one-page case summary for a lawyer. Under section 154 of the Code of Criminal Procedure the police record your statement themselves, so the complaint deliberately names no offence section — deciding that is the officer's job, and a wrong section in your own statement weakens you. Nothing here is filed, submitted or sent anywhere automatically.",
                "Do dastawez INSAaf ne is baat-cheet mein aap ke kaha hua se banaye hain: SHO ke liye likhi shikayat, aur wukil ke liye ek safha ka case khulasa. CrPC ki dhara 154 ke tehat police aap ka bayaan khud likhti hai, is liye shikayat jaan-boojh kar koi afraad ka section nahi likhti — yeh faisla officer ka kaam hai, aur aap ke apne bayaan mein ghalt section aap ko kamzor karta hai. Yahan se kuch bhi khud-ba-khud file ya kisi ko nahi bheja jaata."
              )}
            </p>
            <button
              data-testid="voice-incident-build"
              onClick={prepareIncidentDocuments}
              disabled={incidentStatus === 'building'}
              className={cn(btn, "bg-[#01411C] text-white hover:bg-[#02301a]")}
            >
              {incidentStatus === 'building' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {incidentStatus === 'building'
                ? label("Preparing…", "Tayyar ho raha hai…")
                : incidentDocs
                  ? label("Prepare again", "Dobara tayyar karein")
                  : label("Prepare my documents", "Mere dastawez tayyar karein")}
            </button>
            {incidentStatus === 'failed' && incidentError && (
              <p data-testid="voice-incident-error" className="text-[11px] font-bold text-red-700">{incidentError}</p>
            )}
            {incidentDocs && (
              <div className="space-y-3">
                <p data-testid="voice-incident-evidence" className="text-[11px] text-gray-500">
                  {incidentDocs.evidence.domain
                    ? label(
                      `Law area read from the verified corpus: ${incidentDocs.evidence.domain}. Provisions listed in the lawyer brief: ${incidentDocs.evidence.provisionsListed}.`,
                      `Tasdeeq-shuda corpus se parha gaya qanooni maidan: ${incidentDocs.evidence.domain}. Wukala brief mein shumaar dharaayein: ${incidentDocs.evidence.provisionsListed}.`
                    )
                    : label(
                      "No law area was confirmed from the verified corpus, so the lawyer brief lists no provisions. Your complaint is still complete.",
                      "Tasdeeq-shuda corpus se koi qanooni maidan confirm nahi hua, is liye wukala brief mein koi dhara nahi. Aap ki shikayat poori hai."
                    )}
                </p>
                {[
                  { key: 'complaint' as const, title: label("1. Written complaint for the police station", "1. Police station ke liye likhi shikayat"), body: incidentDocs.complaint },
                  { key: 'brief' as const, title: label("2. Case summary for a lawyer", "2. Wukil ke liye case khulasa"), body: incidentDocs.brief }
                ].map(doc => (
                  <div key={doc.key} data-testid={`voice-incident-${doc.key}`} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[#01411C]">{doc.title}</h4>
                      <button
                        data-testid={`voice-incident-copy-${doc.key}`}
                        onClick={() => void copyIncidentDoc(doc.key)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
                      >
                        <Copy className="w-3 h-3" />
                        {incidentCopied === doc.key
                          ? label("Copied", "Copy ho gaya")
                          : incidentCopied === 'fail'
                            ? label("Copy failed — select the text and copy it manually", "Copy nahi hua — text select karke khud copy karein")
                            : label("Copy", "Copy")}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-[11px] text-gray-700 font-sans max-h-64 overflow-y-auto">{doc.body}</pre>
                  </div>
                ))}
                <button data-testid="voice-incident-export" onClick={exportIncidentDocs} className={cn(btn, "bg-white border border-gray-200 text-gray-700")}>
                  <Download className="w-3.5 h-3.5" /> {label("Download both as a text file", "Dono text file ke tor par download karein")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- text fallback, always available ---------------- */}
        <div className="flex gap-2 items-center pt-1 border-t border-gray-100">
          <input
            data-testid="voice-text-input"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendText(); }}
            placeholder={label("Type your question instead", "Apna sawal likhein")}
            className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20"
          />
          <button data-testid="voice-text-send" onClick={sendText} disabled={!textInput.trim() || state.phase === 'processing'} className={cn(btn, "bg-[#01411C] text-white")}>
            <Send className="w-3.5 h-3.5" /> {label("Ask", "Poochein")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
    </svg>
  );
}
