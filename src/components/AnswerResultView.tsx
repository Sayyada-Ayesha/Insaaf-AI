import { useMemo } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Copy, ExternalLink, FileText,
  AlertCircle,
  GraduationCap, HeartHandshake, Landmark, Loader2, MessageSquare, Mic, MicOff,
  Scale, Search, Share2, ShieldCheck, Sparkles, Users, Volume2, VolumeX,
} from "lucide-react";
import { MarkdownBody } from "./MarkdownBody";
import { cn } from "./Layout";
import type { LocalChatMessage } from "../services/storage";
import type { Translations } from "../lib/i18n";
import { getLibrarySectionId } from "../config/ragDomainMap";
import { evidenceBadge } from "../lib/answerEvidence";
import { provisionLabel } from "../lib/sourceLabel";

const EXPLORE_TOPICS = [
  { tab: 'learning', en: 'Legal Library', ro: 'Legal Library', Icon: GraduationCap, tint: 'bg-violet-50 text-violet-700' },
  { tab: 'gov', en: 'Government Services', ro: 'Sarkari Khidmat', Icon: Landmark, tint: 'bg-blue-50 text-blue-700' },
  { tab: 'islamic', en: 'Islamic Guidance', ro: 'Islami Rahnumai', Icon: BookOpen, tint: 'bg-emerald-50 text-emerald-700' },
  { tab: 'docintel', en: 'Document Assistant', ro: 'Document Assistant', Icon: FileText, tint: 'bg-amber-50 text-amber-700' },
  { tab: 'draft', en: 'Document Drafter', ro: 'Document Drafter', Icon: FileText, tint: 'bg-orange-50 text-orange-700' },
  { tab: 'voice', en: 'Voice Agent', ro: 'Voice Agent', Icon: Mic, tint: 'bg-rose-50 text-rose-700' },
  { tab: 'legalaid', en: 'Legal Aid & Lawyers', ro: 'Legal Aid aur Wakeel', Icon: Scale, tint: 'bg-[#01411C]/10 text-[#01411C]' },
  { tab: 'civic', en: 'Civic Issues', ro: 'Civic Masail', Icon: HeartHandshake, tint: 'bg-teal-50 text-teal-700' },
  { tab: 'community', en: 'Community', ro: 'Community', Icon: Users, tint: 'bg-sky-50 text-sky-700' },
] as const;

export interface AnswerResultViewProps {
  chatMode: 'legal' | 'islamic';
  islamicView: 'islamic' | 'law' | 'combined';
  onIslamicView: (view: 'islamic' | 'law' | 'combined') => void;
  messages: LocalChatMessage[];
  resultIndex: number | null;
  onSelectResult: (index: number | null) => void;
  isLoading: boolean;
  responseSource: 'LIVE_AI' | 'OFFLINE_KNOWLEDGE' | 'ERROR' | null;
  input: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  searchRef: React.RefObject<HTMLTextAreaElement | null>;
  isListening: boolean;
  onToggleListening: () => void;
  micLang: 'ur-PK' | 'en-US';
  onMicLang: (lang: 'ur-PK' | 'en-US') => void;
  voiceStatus: { kind: 'error' | 'info'; text: string } | null;
  isRomanUI: boolean;
  isLawPath: boolean;
  t: Translations;
  onNewSearch: () => void;
  onBackToTopics: () => void;
  onExplore: (tab: string) => void;
  onOpenLibrary?: (sectionId: string) => void;
  onOpenSources: (message: LocalChatMessage) => void;
  onCopy: (text: string, index: number) => void;
  copyState: { idx: number; ok: boolean } | null;
  onReadAloud: (text: string, index: number) => void;
  isSpeaking: number | null;
  onShare: (text: string) => void;
  onShowConversation: () => void;
  /** Chat persistence outcome owned by ChatSection; null when there is nothing to say. */
  saveNotice?: React.ReactNode;
}

/** Full-page, document-style answer surface: the question stays a question, the
 *  answer is an article with its sources, and the service directory stays one
 *  click away. The conversation transcript is available as an explicit view. */
export default function AnswerResultView(props: AnswerResultViewProps) {
  const {
    chatMode, islamicView, onIslamicView, messages, resultIndex, onSelectResult,
    isLoading, responseSource, input, onInput, onSubmit, searchRef, isListening,
    onToggleListening, micLang, onMicLang, voiceStatus, isRomanUI, isLawPath, t, onNewSearch, onBackToTopics,
    onExplore, onOpenLibrary, onOpenSources, onCopy, copyState, onReadAloud,
    isSpeaking, onShare, onShowConversation, saveNotice,
  } = props;

  const tr = (en: string, ro: string) => (isRomanUI ? ro : en);
  const modelIdx = useMemo(
    () => messages.map((m, i) => (m.role === 'model' ? i : -1)).filter(i => i >= 0),
    [messages],
  );
  const userIdx = useMemo(
    () => messages.map((m, i) => (m.role === 'user' ? i : -1)).filter(i => i >= 0),
    [messages],
  );
  const lastModel = modelIdx.length ? modelIdx[modelIdx.length - 1] : -1;
  const activeIdx = resultIndex !== null && messages[resultIndex]?.role === 'model' ? resultIndex : lastModel;
  const answer = activeIdx >= 0 ? messages[activeIdx] : null;
  const questionIdx = [...userIdx].filter(i => i < activeIdx).pop();
  const question = questionIdx !== undefined ? messages[questionIdx].text : '';
  const earlier = userIdx.filter(i => i !== questionIdx).map(i => ({ idx: i, text: messages[i].text }));
  const evidenceMode = answer?.evidenceMode ?? (chatMode === 'islamic' ? islamicView : 'legal');
  const sources = answer?.sources || [];
  const isAnswering = isLoading && !answer?.text;
  const isEarlier = activeIdx !== lastModel && activeIdx >= 0;

  return (
    <section className="mx-auto w-full max-w-[1180px] pb-4" data-testid="answer-result" aria-labelledby="answer-result-title">
      <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={tr('Answer page actions', 'Jawab ke actions')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#01411C]/15 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#01411C]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {chatMode === 'islamic' ? t.navIslamic : tr('Legal information service', 'Qanooni maloomat service')}
          </span>
          {answer && (() => {
            const badge = evidenceBadge(answer.evidenceVerdict, evidenceMode, sources.length > 0);
            if (!badge) return null;
            return (
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider",
                badge.grounded ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
              )}>
                {badge.grounded ? <Sparkles className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                {badge.label}
              </span>
            );
          })()}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onShowConversation}
            data-testid="result-conversation-view"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:border-[#01411C]/30 hover:text-[#01411C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C]">
            <MessageSquare className="h-4 w-4" /> {tr('Conversation view', 'Baat-cheet view')}
          </button>
          <button type="button" onClick={onNewSearch} data-testid="result-new-search"
            className="inline-flex items-center gap-2 rounded-xl bg-[#01411C] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-[#01411C]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C] focus-visible:ring-offset-2">
            <Search className="h-4 w-4" /> {tr('New search', 'Nayi talash')}
          </button>
          <button type="button" onClick={onBackToTopics} data-testid="result-back-topics"
            className="inline-flex items-center gap-2 rounded-xl border border-[#01411C]/20 bg-[#01411C]/5 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#01411C] hover:bg-[#01411C]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C]">
            <ArrowLeft className="h-4 w-4" /> {tr('Back to topics', 'Topics par wapas')}
          </button>
        </div>
      </nav>

      <div className="mt-5 sm:mt-6">
        <h1 id="answer-result-title" className="text-balance text-2xl font-black tracking-tight text-gray-900 sm:text-3xl md:text-[2.4rem] md:leading-[1.15]">
          {question || tr('Your legal answer', 'Aap ka qanooni jawab')}
        </h1>
        <p className="mt-2 text-xs font-medium text-gray-500 sm:text-sm">
          {answer?.evidenceVerdict === 'strong' && sources.length > 0
            ? tr('Ask a follow-up below. This answer is grounded in the source records listed on this page.',
                 'Neeche follow-up poochen. Yeh jawab is page par diye gaye makhaz records par mabni hai.')
            : tr('Ask a follow-up below. This answer is general guidance — confirm the rule for your province before acting.',
                 'Neeche follow-up poochen. Yeh jawab aam rehnumai hai — amal se pehle apne soobe ka qanoon tasdeeq karein.')}
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="mt-4 sm:mt-5" data-testid="result-search-form">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white py-2 pl-4 pr-2 shadow-xl shadow-[#01411C]/5 transition-all focus-within:border-[#01411C]/30 focus-within:ring-8 focus-within:ring-[#01411C]/5">
          <Search className="h-5 w-5 shrink-0 text-[#01411C]/60" />
          <label htmlFor="result-search" className="sr-only">{tr('Ask another question', 'Doosra sawal poochen')}</label>
          <textarea
            id="result-search"
            ref={searchRef}
            data-testid="result-search-input"
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
            rows={1}
            placeholder={t.chatPlaceholder}
            className="h-[52px] sm:h-[58px] min-w-0 flex-1 resize-none bg-transparent py-2 text-xs font-bold text-gray-800 placeholder:text-gray-400 focus:outline-none sm:py-3 sm:text-sm"
          />
          <button type="button" onClick={onToggleListening}
            aria-label={isListening ? t.chatStopSpeaking : `${t.chatVoiceLabel}: ${micLang === 'ur-PK' ? 'Urdu' : 'English'}`}
            title={`Speech Language: ${micLang === 'ur-PK' ? 'Urdu (Pakistan)' : 'English (US)'}`}
            className={cn("shrink-0 rounded-xl p-2.5 transition-all sm:p-3",
              isListening ? "animate-pulse bg-rose-500 text-white" : "text-gray-400 hover:bg-[#01411C]/5 hover:text-[#01411C]")}>
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button type="submit" data-testid="result-search-submit" disabled={!input.trim() || isLoading}
            aria-label={t.chatSend} title={t.chatSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#01411C] text-white shadow-lg shadow-[#01411C]/25 transition-all hover:bg-[#01411C]/90 disabled:cursor-not-allowed disabled:opacity-30 sm:h-12 sm:w-12">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
          </button>
        </div>
        {chatMode === 'islamic' && (
          <div role="group" aria-label={t.evidencePathLabel} data-testid="answer-evidence-path-group" className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t.evidencePathLabel}</span>
            {([
              { key: 'islamic', label: t.viewIslamic },
              { key: 'law', label: t.viewLaw },
              { key: 'combined', label: t.viewCombined },
            ] as const).map(opt => (
              <button key={opt.key} type="button" onClick={() => onIslamicView(opt.key)} aria-pressed={islamicView === opt.key}
                data-testid={`answer-evidence-path-${opt.key}`}
                className={cn("rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors md:text-xs",
                  islamicView === opt.key ? "border-[#01411C] bg-[#01411C] text-white" : "border-gray-200 bg-white text-gray-600 hover:border-[#01411C]/40")}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t.chatVoiceLabel} className="flex shrink-0 items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1">
            <span className="px-2 text-[9px] font-black uppercase text-gray-400">{t.chatVoiceLabel}</span>
            {([
              { code: 'ur-PK' as const, label: 'Urdu' },
              { code: 'en-US' as const, label: 'English' },
            ]).map(opt => (
              <button key={opt.code} type="button" onClick={() => onMicLang(opt.code)} aria-pressed={micLang === opt.code}
                className={cn("rounded-lg px-2.5 py-1 text-[9px] font-black uppercase transition-all",
                  micLang === opt.code ? "bg-[#01411C] text-white shadow-sm" : "text-gray-400 hover:text-gray-600")}>
                {opt.label}
              </button>
            ))}
          </div>
          {(isListening || voiceStatus) && (
            <div role="status" aria-live="polite" data-testid="result-voice-status"
              className={cn("flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-bold",
                voiceStatus ? "border-rose-100 bg-rose-50 text-rose-600" : "border-emerald-100 bg-emerald-50 text-[#01411C]")}>
              {isListening && !voiceStatus && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t.chatListening}</span>
                </>
              )}
              {voiceStatus && (
                <>
                  <MicOff className="h-3.5 w-3.5 shrink-0" />
                  <span>{voiceStatus.text}</span>
                </>
              )}
            </div>
          )}
        </div>
      </form>

      {saveNotice}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <article className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", responseSource === 'OFFLINE_KNOWLEDGE' ? "bg-amber-500" : "animate-pulse bg-emerald-500")} />
              {responseSource === 'OFFLINE_KNOWLEDGE' ? t.chatKnowledgeOffline : t.chatKnowledgeOnline}
            </span>
            {isEarlier && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                {tr('Earlier answer', 'Purana jawab')}
              </span>
            )}
            {activeIdx !== lastModel && lastModel >= 0 && (
              <button type="button" onClick={() => onSelectResult(null)} className="text-[#01411C] underline-offset-2 hover:underline">
                {tr('Show latest answer', 'Naya jawab dekhen')}
              </button>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-gray-200 bg-gray-50/80 p-4 sm:p-5" data-testid="result-question">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{tr('You asked', 'Aap ne poocha')}</p>
            <p className="mt-2 break-words text-sm font-bold leading-relaxed text-gray-800 sm:text-base">{question}</p>
          </div>

          {answer ? (
            <div
              data-testid="result-answer"
              className={cn(
                "overflow-hidden rounded-[1.5rem] border border-gray-100 border-l-4 bg-white p-4 shadow-xl shadow-gray-100/60 sm:p-7",
                evidenceMode === 'combined' ? "border-l-teal-500" : evidenceMode === 'islamic' ? "border-l-amber-400" : "border-l-[#01411C]",
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#01411C]">
                  {evidenceMode === 'combined' ? tr('Islamic perspective and Pakistani law', 'Islami pehlu aur Pakistani qanoon')
                    : chatMode === 'islamic' && !isLawPath ? tr('Islamic perspective', 'Islami pehlu')
                      : tr('The answer', 'Jawab')}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {isAnswering ? tr('Researching sources…', 'Makhaz mein dekha ja raha hai…') : tr('Source records', 'Makhaz records')}
                </span>
              </div>
              {isAnswering ? (
                <div role="status" aria-live="polite" className="flex items-center gap-3 py-6 text-sm font-medium italic text-gray-400">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#01411C]" />
                  {isLawPath ? t.chatWorkingLaw : islamicView === 'combined' ? t.chatWorkingCombined : t.chatWorkingIslamic}
                </div>
              ) : (
                <div className="answer-prose min-w-0 break-words text-[13.5px] leading-[1.75] text-gray-800 sm:text-[15px]">
                  <MarkdownBody text={answer.text} />
                </div>
              )}

              {answer.citationWarning?.text && (
                <div data-testid="chat-citation-warning"
                  className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
                  {answer.citationWarning.lead && <span className="mb-0.5 block text-[9px] uppercase tracking-widest">{answer.citationWarning.lead}</span>}
                  {answer.citationWarning.text}
                </div>
              )}

              {answer.text && (
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                  <button type="button" onClick={() => onReadAloud(answer.text, activeIdx)}
                    data-testid="chat-action-read-aloud"
                    aria-label={isSpeaking === activeIdx ? t.chatStopSpeaking : t.chatReadAloud}
                    title={isSpeaking === activeIdx ? t.chatStopSpeaking : t.chatReadAloud}
                    className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
                      isSpeaking === activeIdx ? "bg-[#01411C] text-white" : "bg-gray-50 text-gray-500 hover:bg-[#01411C]/5 hover:text-[#01411C]")}>
                    {isSpeaking === activeIdx ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    {isSpeaking === activeIdx ? t.chatStopSpeaking : t.chatReadAloud}
                  </button>
                  <button type="button" onClick={() => onCopy(answer.text, activeIdx)}
                    data-testid="chat-action-copy"
                    aria-label={t.chatCopy}
                    className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
                      copyState?.idx === activeIdx && copyState.ok ? "bg-emerald-500 text-white"
                        : copyState?.idx === activeIdx ? "bg-red-500 text-white"
                          : "bg-gray-50 text-gray-500 hover:bg-[#01411C]/5 hover:text-[#01411C]")}>
                    <Copy className="h-4 w-4" /> {copyState?.idx === activeIdx && !copyState.ok ? tr('Copy failed', 'Copy nahi hua') : t.chatCopy}
                  </button>
                  <button type="button" onClick={() => onShare(answer.text)}
                    data-testid="chat-action-share"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 transition-colors hover:bg-green-50 hover:text-green-700">
                    <Share2 className="h-4 w-4" /> {t.chatShareWhatsApp}
                  </button>
                  <button type="button" onClick={() => searchRef.current?.focus()}
                    data-testid="result-ask-another"
                    className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#01411C]/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#01411C] hover:bg-[#01411C]/10">
                    <MessageSquare className="h-4 w-4" /> {tr('Ask another question', 'Doosra sawal')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-gray-100 bg-white p-6 text-sm text-gray-500">
              {tr('No answer has been produced for this question yet.', 'Is sawal ka jawab abhi tayyar nahi hua.')}
            </div>
          )}

          {sources.length > 0 && (
            <section aria-labelledby="answer-sources-title" data-testid="result-sources"
              className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="answer-sources-title" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#01411C]">
                  <BookOpen className="h-4 w-4" /> {t.chatVerifiedSources}
                </h2>
                <button type="button" onClick={() => onOpenSources(answer!)}
                  className="rounded-lg bg-[#01411C]/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#01411C] hover:bg-[#01411C]/10">
                  {t.chatSourceReadMore}
                </button>
              </div>
              <ol className="mt-4 space-y-3">
                {sources.map((src, i) => (
                  <li key={i} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#01411C]">{provisionLabel(src) || t.chatSourceLabel}</p>
                        <h3 className="mt-1 break-words text-sm font-bold leading-snug text-gray-900">{src.title}</h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {[src.authority, src.jurisdiction].filter(Boolean).join(' · ') || t.chatSourceUnrecorded}
                        </p>
                      </div>
                      {answer?.evidenceVerdict === 'strong' ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-2.5 w-2.5" /> {t.chatSourceVerified}
                        </span>
                      ) : answer?.evidenceVerdict === 'weak' ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                          <AlertCircle className="h-2.5 w-2.5" /> Closest related record
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {src.sourceURL?.startsWith('http') && (
                        <a href={src.sourceURL} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#01411C] underline-offset-2 hover:underline">
                          {tr('Official source', 'Asal makhaz')} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {onOpenLibrary && getLibrarySectionId(src.domain) && (
                        <button type="button" onClick={() => onOpenLibrary(getLibrarySectionId(src.domain)!)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-[#01411C]">
                          <BookOpen className="h-3 w-3" /> {t.chatSourceOpenLibrary}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {earlier.length > 0 && (
            <details data-testid="result-earlier" className="rounded-[1.5rem] border border-gray-100 bg-white p-4 sm:p-5">
              <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                {tr(`Earlier questions (${earlier.length})`, `Purane sawal (${earlier.length})`)}
              </summary>
              <ul className="mt-3 space-y-2">
                {earlier.map(({ text, idx }) => (
                  <li key={idx}>
                    <button type="button" onClick={() => onSelectResult(Math.max(0, idx))}
                      className="w-full rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 text-left text-xs font-semibold text-gray-600 hover:border-[#01411C]/25 hover:text-[#01411C]">
                      {text}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </article>

        <aside className="space-y-4">
          <nav aria-labelledby="explore-title" data-testid="result-explore"
            className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 id="explore-title" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#01411C]">
              {tr('Explore other topics and services', 'Doosre topics aur services dekhen')}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-1.5">
              {EXPLORE_TOPICS.map(({ tab, en, ro, Icon, tint }) => (
                <button key={tab} type="button" data-testid={`result-explore-${tab}`} onClick={() => onExplore(tab)}
                  className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[#01411C]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C]">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tint)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-xs font-bold text-gray-700 group-hover:text-[#01411C]">{tr(en, ro)}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-[#01411C]" />
                </button>
              ))}
            </div>
            <button type="button" onClick={onBackToTopics} data-testid="result-explore-home"
              className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:border-[#01411C]/30 hover:text-[#01411C]">
              {t.homeTopicsTitle}
            </button>
          </nav>

          <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 text-[#01411C]">
              <ShieldCheck className="h-4 w-4" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">{t.homePrivacyTitle}</h2>
            </div>
            <p className="mt-2 text-xs font-medium leading-relaxed text-gray-500">{t.homePrivacyBody}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
