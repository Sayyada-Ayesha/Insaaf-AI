import { useState, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { MarkdownBody } from './MarkdownBody';
import {
  Landmark, Search, Loader2, AlertTriangle, ExternalLink, ThumbsUp, ThumbsDown,
  Building2, ArrowRight, RotateCcw, BookOpen, FileText, ScanSearch, Scale
} from 'lucide-react';
import { cn } from './Layout';
import { getCurrentLanguage, useLanguageVersion } from '../lib/i18n';
import { askLegalAgent, describeApiFailure, AgentReply } from '../services/aiRuntime';
import { getRoute } from '../config/appRoutes';
import {
  GOV_SOURCES, GOV_TOPICS, CATEGORY_LABELS, CORPUS_STATS, REGISTRY_COUNTS,
  GovSource, GovCategory, searchGovSources, officialDestinationsFor
} from '../data/govSourceRegistry';

type GovMode = 'ask' | 'directory';

function displayHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}

const JURISDICTIONS = ['Federal', 'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan'];

export default function GovernmentServicesSection({
  onNavigate,
  onOpenLibrary,
  onOpenDrafting,
  onOpenDocumentAssistant
}: {
  onNavigate?: (tab: string) => void;
  onOpenLibrary?: (sectionId: string) => void;
  onOpenDrafting?: () => void;
  onOpenDocumentAssistant?: () => void;
}) {
  const currentLang = getCurrentLanguage();
  useLanguageVersion();
  const isRoman = currentLang === 'roman_urdu';

  const [mode, setMode] = useState<GovMode>('ask');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AgentReply | null>(null);
  const [askedQuestion, setAskedQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [showFeedbackNote, setShowFeedbackNote] = useState(false);

  const [dirQuery, setDirQuery] = useState('');
  const [dirCategory, setDirCategory] = useState<GovCategory | 'all'>('all');
  const [dirJurisdiction, setDirJurisdiction] = useState('all');

  const directoryResults = useMemo<GovSource[]>(() => {
    const bySearch = dirQuery.trim() ? searchGovSources(dirQuery) : GOV_SOURCES;
    return bySearch.filter(s =>
      (dirCategory === 'all' || s.category === dirCategory) &&
      (dirJurisdiction === 'all' || s.jurisdiction === dirJurisdiction)
    );
  }, [dirQuery, dirCategory, dirJurisdiction]);

  const destinations = useMemo(
    () => (askedQuestion ? officialDestinationsFor(askedQuestion) : []),
    [askedQuestion]
  );

  const ask = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (q.length < 5) {
      setError(isRoman
        ? 'Baraye meharbani poora sawal likhen (kam az kam 5 haroof).'
        : 'Please write the full question — at least a few words.');
      return;
    }
    setIsLoading(true);
    setError('');
    setAnswer(null);
    setFeedback(null);
    setFeedbackNote('');
    setShowFeedbackNote(false);
    try {
      // Language is resolved by the backend from the question itself, so the
      // existing English → English / Roman → Roman / Urdu-script → Roman contract holds.
      const reply = await askLegalAgent(q);
      setAnswer(reply);
      setAskedQuestion(q);
      if (!reply?.reply) {
        setError(isRoman
          ? 'Is sawal ka jawab nahi mil saka. Dobara koshish karen ya sawal doosre alfaaz mein likhen.'
          : 'No answer came back for this question. Try again, or rephrase it.');
      }
    } catch (err) {
      // "The server could not be reached" was printed for every failure, including
      // a deployment whose /api/ai/agent route simply is not there (HTTP 404).
      // The status is carried up from the service so the notice names the cause.
      setError(describeApiFailure(err, isRoman ? 'roman_urdu' : 'en'));
    } finally {
      setIsLoading(false);
    }
  }, [isRoman]);

  const openTopic = (topicId: string) => {
    const topic = GOV_TOPICS.find(x => x.id === topicId);
    if (!topic) return;
    const q = isRoman ? topic.questionRoman : topic.questionEn;
    setQuestion(q);
    setMode('ask');
    void ask(q);
  };

  const handleAction = (actionId: string) => {
    const route = getRoute(actionId);
    if (!route) return;
    if (route.tab === 'learning' && route.id === 'library') onOpenLibrary?.(actionId);
    else if (route.id === 'draft') onOpenDrafting?.();
    else if (route.id === 'analyze') onOpenDocumentAssistant?.();
    else onNavigate?.(route.tab);
  };

  const sendFeedback = (kind: 'up' | 'down') => {
    setFeedback(kind);
    setShowFeedbackNote(true);
    setFeedbackNote(isRoman
      ? 'Aap ki raye isi device par mehfooz hui hai — kahin bheji nahi gayi. Abhi koi feedback storage mojood nahi.'
      : 'Saved on this device only — it has not been sent anywhere. There is no feedback storage in this build yet.');
  };

  const statusBadge = (s: GovSource) => (
    <span className={cn(
      'text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap',
      s.linkStatus === 'corpus_verified'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'
    )}>
      {s.linkStatus === 'corpus_verified'
        ? (isRoman ? `Corpus mein ${s.corpusDocs ?? 0} dastawez` : `${s.corpusDocs ?? 0} corpus doc${(s.corpusDocs ?? 0) === 1 ? '' : 's'}`)
        : (isRoman ? 'Sirf registry mein' : 'Registered, not indexed')}
    </span>
  );

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[#01411C] font-bold text-xs uppercase tracking-wider mb-1">
              <Landmark className="w-4 h-4" />
              {isRoman ? 'Sarkari Services' : 'Government Services'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {isRoman ? 'Sarkari kaam, idaray aur asli websites' : 'Government work, departments and official websites'}
            </h1>
            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
              {isRoman
                ? 'Apna sawal likhen — jawab mohaal corpus ke record se hota hai aur saath asli sarkari website ka link milta hai.'
                : 'Ask what you need done. Answers are drawn from the verified official-source corpus and always show the official destination.'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setMode('ask')}
              aria-pressed={mode === 'ask'}
              className={cn('px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors',
                mode === 'ask' ? 'bg-[#01411C] text-white border-[#01411C]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#01411C]')}
            >
              {isRoman ? 'Sawal karen' : 'Ask'}
            </button>
            <button
              onClick={() => setMode('directory')}
              aria-pressed={mode === 'directory'}
              className={cn('px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors',
                mode === 'directory' ? 'bg-[#01411C] text-white border-[#01411C]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#01411C]')}
            >
              {isRoman ? 'Official Sources Directory' : 'Official sources'}
            </button>
          </div>
        </div>

        {/* Disclaimer — product truth */}
        <div className="mb-6 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            {isRoman
              ? 'INSAaf AI sarkari idara nahi, aik aazad maloomati platform hai. Yahan diya gaya link aap ko asli authority ki website le jata hai — INSAaf AI woh kaam khud nahi karta. Fees, ahmiyat aur procedure badal sakte hain; khaas zaroorat asli website se confirm karen.'
              : 'INSAaf AI is an independent information platform, not a government department. An official link takes you to the authority’s own website — INSAaf AI does not perform that service. Eligibility, fees and procedures change, so confirm critical requirements with the official source.'}
          </p>
        </div>

        {mode === 'ask' && (
          <>
            {/* Ask box */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-3xl bg-white border-2 border-gray-100 shadow-sm mb-6">
              <label htmlFor="gov-question" className="block text-sm font-bold text-gray-800 mb-2">
                {isRoman ? 'Aap ka sawal' : 'Your question'}
              </label>
              <textarea
                id="gov-question"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void ask(question); }}
                rows={3}
                placeholder={isRoman
                  ? 'Maslan: CNIC renew karne ka tareeqa kya hai aur kaun se documents chahiye?'
                  : 'For example: How do I renew my CNIC and which documents do I need?'}
                className="w-full p-3 rounded-2xl border-2 border-gray-200 focus:border-[#01411C] outline-none text-sm resize-y"
              />
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <button
                  onClick={() => void ask(question)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#01411C] text-white font-bold rounded-full hover:bg-[#01411C]/90 disabled:opacity-60 text-sm"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {isLoading ? (isRoman ? 'Maloomat dhoonda ja raha hai…' : 'Searching official sources…') : (isRoman ? 'Jawab len' : 'Get answer')}
                </button>
                {answer && (
                  <button
                    onClick={() => { setAnswer(null); setAskedQuestion(''); setQuestion(''); setFeedback(null); setShowFeedbackNote(false); }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />{isRoman ? 'Naya sawal' : 'Clear'}
                  </button>
                )}
                <span className="text-[11px] text-gray-400">
                  {isRoman ? 'Control + Enter bhi chalta hai' : 'Ctrl+Enter also submits'}
                </span>
              </div>
              {error && (
                <p role="alert" className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">{error}</p>
              )}
            </motion.div>

            {/* Answer */}
            {isLoading && (
              <div className="p-6 rounded-3xl bg-white border-2 border-gray-100 text-center text-gray-500 text-sm mb-6">
                {isRoman ? 'Corpus se motabar records nikale ja rahe hain…' : 'Retrieving matching official records…'}
              </div>
            )}

            {!isLoading && answer && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mb-8">
                <div className="p-5 rounded-3xl bg-white border-2 border-gray-100 shadow-sm">
                  <div className="prose prose-sm max-w-none text-gray-800">
                    <MarkdownBody text={answer.reply} />
                  </div>
                </div>

                {/* Evidence verdict — never hidden, so an unsupported answer does not look authoritative */}
                {answer.evidence && (
                  <div className={cn('p-4 rounded-2xl border-2 text-xs',
                    answer.evidence.verdict === 'strong' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-orange-50 border-orange-200 text-orange-800')}>
                    <p className="font-bold mb-1">
                      {isRoman ? 'Daleel ka hukm' : 'Evidence verdict'}: {answer.evidence.verdict || 'unknown'}
                      {typeof answer.evidence.supportedCount === 'number' ? ` · ${answer.evidence.supportedCount}` : ''}
                      {typeof answer.evidence.rejected === 'number' ? ` (${answer.evidence.rejected} ${isRoman ? 'mirr' : 'rejected'})` : ''}
                    </p>
                    {Array.isArray(answer.evidence.reasons) && answer.evidence.reasons.length > 0 && (
                      <ul className="list-disc pl-4 space-y-0.5">
                        {answer.evidence.reasons.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Retrieved corpus sources with real links */}
                {answer.sources?.length > 0 && (
                  <div className="p-5 rounded-3xl bg-white border-2 border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-[#01411C]" />
                      {isRoman ? 'Is jawab ke makhaz (corpus)' : 'Sources behind this answer (corpus)'}
                    </h3>
                    <ul className="space-y-2">
                      {answer.sources.slice(0, 6).map((s, i) => (
                        <li key={i} className="text-xs">
                          <span className="font-bold text-gray-800">{s.title || s.authority || s.key || 'Official record'}</span>
                          {s.type ? <span className="text-gray-500"> · {s.type}</span> : null}
                          {s.sourceURL ? (
                            <a href={s.sourceURL} target="_blank" rel="noopener noreferrer nofollow"
                              className="ml-2 inline-flex items-center gap-1 text-[#01411C] font-bold underline underline-offset-2 break-all">
                              {displayHost(s.sourceURL)}<ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="ml-2 text-gray-400 italic">{isRoman ? 'link record mein nahi' : 'no link on this record'}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Official destination from the registry */}
                {destinations.length > 0 && (
                  <div className="p-5 rounded-3xl bg-white border-2 border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#01411C]" />
                      {isRoman ? 'Asli sarkari website' : 'Where to do this officially'}
                    </h3>
                    <p className="text-[11px] text-gray-500 mb-3">
                      {isRoman
                        ? 'Yeh bahar ki authority ki website hai. Link kholne se aap ki application INSAaf AI se nahi bheji ja rahi.'
                        : 'These are external authority websites. Opening a link does not submit anything through INSAaf AI.'}
                    </p>
                    <ul className="grid sm:grid-cols-2 gap-3">
                      {destinations.map(s => (
                        <li key={s.id} className="p-3 rounded-2xl border-2 border-gray-100 bg-gray-50">
                          <p className="text-xs font-bold text-gray-800">{s.org}</p>
                          <p className="text-[11px] text-gray-500">{s.jurisdiction} · {CATEGORY_LABELS[s.category].en}</p>
                          <div className="flex items-center justify-between gap-2 mt-2">
                            {statusBadge(s)}
                            <a href={s.url} target="_blank" rel="noopener noreferrer nofollow"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#01411C] underline underline-offset-2">
                              {isRoman ? 'Website kholen' : 'Open site'}<ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          {s.note && <p className="text-[11px] text-gray-500 mt-2 italic">{s.note}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* In-app next steps: only the ones that genuinely exist */}
                <div className="flex flex-wrap gap-2">
                  {(answer.actions || []).slice(0, 4).map(id => {
                    const r = getRoute(id);
                    if (!r) return null;
                    return (
                      <button key={id} onClick={() => handleAction(id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border-2 border-gray-200 hover:border-[#01411C] text-xs font-bold text-gray-700">
                        {id === 'library' ? <BookOpen className="w-3.5 h-3.5" /> : id === 'draft' ? <FileText className="w-3.5 h-3.5" /> : id === 'analyze' ? <ScanSearch className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                        {isRoman ? r.labelRoman : r.labelEn}
                      </button>
                    );
                  })}
                  {/\b(shikayat|complaint|notice|application|darakhwast|appeal)\b/i.test(askedQuestion) && (
                    <button onClick={() => onOpenDrafting?.()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#01411C] text-white text-xs font-bold">
                      <FileText className="w-3.5 h-3.5" />{isRoman ? 'Application/notice draft karen' : 'Draft the application or notice'}
                    </button>
                  )}
                </div>

                {/* Feedback — device-local, honestly labelled */}
                <div className="p-4 rounded-2xl bg-white border-2 border-gray-100">
                  <p className="text-xs font-bold text-gray-700 mb-2">
                    {isRoman ? 'Kya yeh jawab madadgar tha?' : 'Was this answer useful?'}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => sendFeedback('up')} aria-pressed={feedback === 'up'}
                      className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-bold',
                        feedback === 'up' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-gray-200 text-gray-600 hover:border-emerald-300')}>
                      <ThumbsUp className="w-3.5 h-3.5" />{isRoman ? 'Haan' : 'Helpful'}
                    </button>
                    <button onClick={() => sendFeedback('down')} aria-pressed={feedback === 'down'}
                      className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-bold',
                        feedback === 'down' ? 'bg-red-50 border-red-300 text-red-800' : 'border-gray-200 text-gray-600 hover:border-red-300')}>
                      <ThumbsDown className="w-3.5 h-3.5" />{isRoman ? 'Nahi / ghalat' : 'No / incorrect'}
                    </button>
                  </div>
                  {showFeedbackNote && (
                    <label className="block mt-3">
                      <span className="text-[11px] text-gray-500">{isRoman ? 'Ikhtiyari wazahat (sirf is device par)' : 'Optional note (stays on this device)'}</span>
                      <input value={feedbackNote} onChange={e => setFeedbackNote(e.target.value)}
                        className="mt-1 w-full p-2 rounded-xl border-2 border-gray-200 text-xs outline-none focus:border-[#01411C]" />
                      <p className="mt-1 text-[11px] text-gray-500">{feedbackNote ? '' : ''}{isRoman
                        ? 'Yeh note kahin upload nahi hota — feedback server se rabta abhi maujood nahi.'
                        : 'This note is not uploaded anywhere — feedback is not wired to a server in this build.'}</p>
                    </label>
                  )}
                </div>
              </motion.div>
            )}

            {/* Topic cards */}
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-3">{isRoman ? 'Mamooli sarkari kaam' : 'Browse by topic'}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {GOV_TOPICS.map(topic => (
                  <button key={topic.id} onClick={() => openTopic(topic.id)}
                    className="p-3 rounded-2xl bg-white border-2 border-gray-100 hover:border-[#01411C] text-left transition-colors group">
                    <p className="text-xs font-bold text-gray-800 group-hover:text-[#01411C]">
                      {isRoman ? topic.roman : topic.en}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                      {isRoman ? topic.questionRoman : topic.questionEn}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {mode === 'directory' && (
          <div>
            {/* Counts — registered vs indexed kept strictly apart */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { k: isRoman ? 'Registry mein sources' : 'Registered sources', v: REGISTRY_COUNTS.registered, sub: `${REGISTRY_COUNTS.uniqueDomains} domains` },
                { k: isRoman ? 'Corpus se mutateq' : 'Verified in corpus', v: REGISTRY_COUNTS.corpusVerified, sub: isRoman ? 'asli record maloom' : 'documented records' },
                { k: isRoman ? 'Corpus dastawezat' : 'Indexed corpus documents', v: CORPUS_STATS.manifestDocuments, sub: `${isRoman ? 'aakhri tasdeeq' : 'last verified'} ${CORPUS_STATS.corpusLastVerified}` },
                { k: isRoman ? 'Crawl shuda pages' : 'Pages crawled', v: CORPUS_STATS.crawledPages ?? '?', sub: isRoman ? 'crawler mojood nahi' : 'no crawler in this build' }
              ].map((c, i) => (
                <div key={i} className="p-3 rounded-2xl bg-white border-2 border-gray-100">
                  <p className="text-xl font-extrabold text-[#01411C]">{c.v}</p>
                  <p className="text-[11px] font-bold text-gray-700">{c.k}</p>
                  <p className="text-[10px] text-gray-400">{c.sub}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-3xl bg-white border-2 border-gray-100 mb-4 space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-gray-700">{isRoman ? 'Idara ya domain dhoonden' : 'Search by organisation or domain'}</span>
                <input
                  value={dirQuery}
                  onChange={e => setDirQuery(e.target.value)}
                  placeholder={isRoman ? 'maslan: passport, FBR, HEC, nadra.gov.pk' : 'e.g. passport, FBR, HEC, nadra.gov.pk'}
                  className="mt-1 w-full p-2.5 rounded-2xl border-2 border-gray-200 text-sm outline-none focus:border-[#01411C]"
                />
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={dirCategory} onChange={e => setDirCategory(e.target.value as GovCategory | 'all')}
                  aria-label={isRoman ? 'Category' : 'Category filter'}
                  className="p-2 rounded-xl border-2 border-gray-200 text-xs font-bold text-gray-700 outline-none focus:border-[#01411C]">
                  <option value="all">{isRoman ? 'Tamam categories' : 'All categories'}</option>
                  {(Object.keys(CATEGORY_LABELS) as GovCategory[]).map(c => (
                    <option key={c} value={c}>{isRoman ? CATEGORY_LABELS[c].roman : CATEGORY_LABELS[c].en}</option>
                  ))}
                </select>
                <select value={dirJurisdiction} onChange={e => setDirJurisdiction(e.target.value)}
                  aria-label={isRoman ? 'Jurisdiction' : 'Jurisdiction filter'}
                  className="p-2 rounded-xl border-2 border-gray-200 text-xs font-bold text-gray-700 outline-none focus:border-[#01411C]">
                  <option value="all">{isRoman ? 'Tamam ilaqay' : 'All jurisdictions'}</option>
                  {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
                <span className="text-[11px] text-gray-500">
                  {directoryResults.length} {isRoman ? 'natij' : 'results'}
                </span>
              </div>
            </div>

            {directoryResults.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white border-2 border-dashed border-gray-200 text-center">
                <p className="text-sm font-bold text-gray-700">
                  {isRoman ? 'Is search se koi official source nahi mila' : 'No official source matches this search'}
                </p>
                <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
                  {isRoman
                    ? 'Registry mein abhi sirf woh idaray hain jo yahan shamil kiye gaye hain. Doosre alfaaz mein azmaien, ya filter hatayen. Jo source registry mein nahi, us ka naam ya URL INSAaf AI tasdeeq nahi karta.'
                    : 'This directory only lists the organisations registered here. Try different words or clear the filters. INSAaf AI does not vouch for a department or URL that is not in this registry.'}
                </p>
                <button onClick={() => { setDirQuery(''); setDirCategory('all'); setDirJurisdiction('all'); }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#01411C] text-white text-xs font-bold">
                  <RotateCcw className="w-3.5 h-3.5" />{isRoman ? 'Filter hatayen' : 'Clear filters'}
                </button>
              </div>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-3">
                {directoryResults.map(s => (
                  <li key={s.id} className="p-4 rounded-2xl bg-white border-2 border-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-gray-900">{s.org}</p>
                      {statusBadge(s)}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {s.jurisdiction} · {isRoman ? CATEGORY_LABELS[s.category].roman : CATEGORY_LABELS[s.category].en} · {s.sourceType}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-2">{s.services.slice(0, 6).join(', ')}</p>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#01411C] underline underline-offset-2 break-all">
                        {s.domain}<ExternalLink className="w-3 h-3" />
                      </a>
                      <button onClick={() => { const q = isRoman ? `${s.org} ki service ke liye sarkari procedure kya hai?` : `What is the official procedure for ${s.org} services?`; setMode('ask'); setQuestion(q); void ask(q); }}
                        className="text-[11px] font-bold text-gray-500 hover:text-[#01411C]">
                        {isRoman ? 'Is ke baare mein sawal' : 'Ask about this'}
                      </button>
                    </div>
                    {s.note && <p className="text-[11px] text-gray-500 mt-2 italic">{s.note}</p>}
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-5 text-[11px] text-gray-400">
              {isRoman
                ? `Registry ke ${REGISTRY_COUNTS.registered} sources mein se ${REGISTRY_COUNTS.corpusVerified} ke records corpus mein mojood hain. ${REGISTRY_COUNTS.registeredOnly} sirf address ke taur par darge hain — un ka content crawl nahi hua.`
                : `${REGISTRY_COUNTS.corpusVerified} of ${REGISTRY_COUNTS.registered} directory entries have documents in the retrieval corpus. ${REGISTRY_COUNTS.registeredOnly} are addresses only — their content has not been crawled or indexed.`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
