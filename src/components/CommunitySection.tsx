import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Loader2, AlertTriangle, RefreshCw, MapPin, Image as ImageIcon, X,
  Flag, MessageSquarePlus, ShieldCheck, PenLine, Inbox
} from 'lucide-react';
import { cn } from './Layout';
import { getCurrentLanguage, useLanguageVersion } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { compressEvidence, validateEvidence, CIVIC_PROVINCES, CivicEvidence } from '../lib/civicIssues';
import {
  CommunityOptions, CommunityPost, MemberStanding, AiFlag,
  fetchCommunityOptions, fetchFeed, fetchMyPosts, submitPost, reportPost, appealPost,
  communityBackendStatus
} from '../services/communityCloud';

type SubTab = 'feed' | 'new' | 'mine';

const BODY_MIN = 15;
const BODY_MAX = 2000;
const REPORT_REASONS = ['spam', 'harassment', 'personal-data', 'misinformation', 'off-topic', 'other'];

function labels(roman: boolean) {
  return roman ? {
    heading: 'Community',
    sub: 'Shehriyon ka aapsi maidan — posts ek moderator ke pass se guzarte hain.',
    feed: 'Feed', newPost: 'Naya Post', mine: 'Meray Posts',
    signInTitle: 'Community ke liye sign-in zaroori hai',
    signInBody: 'Posts sirf verified members likh sakte hain, aur server aap ki shanakht ID token se karta hai. Koi post baghair sign-in ke nahi jaati.',
    signInBtn: 'Sign in karein',
    notConfigured: 'Backend abhi sign-in verify nahi kar sakta, is liye koi post save nahi hoti. Cloud community is deployment mein abhi mojood nahi — hum yahan jaadui khaali feed nahi dikhaenge.',
    loading: 'Posts load ho rahe hain...',
    reload: 'Dobara load karein',
    loadFailed: 'Feed load nahi ho saka.',
    empty: 'Abhi koi approved post nahi hai. Naya post moderator ke baad yahan aayega.',
    visibilityNote: 'Yeh list sirf approved posts dikhati hai. Aap ka apna pending post “Meray Posts” mein nazar aayega.',
    kindQ: 'Post ka qisam', categoryQ: 'Mauzu', titleQ: 'Unwaan (ikhtiyari)', bodyQ: 'Matan',
    locQ: 'Muqam (civic post ke liye zaroori)', locPh: 'Gali / mohalla / shehar',
    districtQ: 'Ilaqa / zila', districtPh: 'Jaise: Lahore', provinceQ: 'Sobia',
    photosQ: 'Tasveerein (ikhtiyari)', choosePhoto: 'Tasveer chunein', photoNote:
      'Tasveer isi device par rehti hai: server tak sirf naam, qisam aur size jata hai, tasveer ka data nahi. Firebase Storage is build mein set nahi hai, is liye upload nahi hota.',
    removing: 'Tasveer process ho rahi hai...',
    cannotUpload: 'Is build mein tasveer upload nahi hoti (Firebase Storage set nahi). Sirf naam aur size record hoga.',
    postIt: 'Post bhejein', posting: 'Bheja ja raha hai...',
    needSignIn: 'Bhejne se pehle sign in karein.',
    fixed: 'Theek karne ke liye:',
    pendingHdr: 'Post pending hai',
    pendingMsg: 'Aap ka post mehfooz ho gaya aur moderator ke intezar mein hai. Yeh tab tak doosron ko nazar nahi aata jab tak approve na ho.',
    screeningHdr: 'Reviewer ke liye ishara',
    standingHdr: 'Aap ka member record',
    standingActive: 'Aap ka account theek chal raha hai',
    standingWarn: (n: number) => `Tasedeeq shuda khilaf: ${n}. Suspended hone se pehle ${3 - n} bache hue.`,
    standingSuspended: 'Posting muali tor par moatariz hai kyun ke tasedeeq shuda khilaf jama ho gaye hain. Ek administrator is ka jaiza le sakta hai.',
    decisionHdr: 'Moderator ka faisla',
    appealQ: 'Appeal (agar aap ko lagta hai faisla dobara dekhna chahiye)', appealPh: 'Mukhtasar sabab',
    appealBtn: 'Appeal bhejein', appealed: 'Appeal darj ho gaya. Yeh faisla wapis nahi kholta, sirf dobara jaiza karwat hai.',
    reportBtn: 'Report', reportWhy: 'Kyun?', reportNotePh: 'Mukhtasar tafseel (ikhtiyari)',
    reportBtnSend: 'Moderator ko bhejein', reportNote:
      'Report sirf jaiza karwane ki darkhwast hai. Is se koi post hat-ta nahi aur koi nokta nahi jama hota.',
    reported: 'Report bhej di gayi.',
    aiFlagLabel: (g: string[]) => `Reviewer ke liye ishara: ${g.join(', ')} — yeh machine ka signal hai, faisla nahi.`,
    byline: 'Member', civicBadge: 'Civic',
    wordsNote: 'Kam az kam ek jumla likhein taake reviewer mauzu samajh sake.',
    offline: 'Community service tak rasai nahi.'
  } : {
    heading: 'Community',
    sub: 'A shared ground for members. New posts are held for a moderator before others can see them.',
    feed: 'Feed', newPost: 'New post', mine: 'My posts',
    signInTitle: 'Sign in to use Community',
    signInBody: 'Posts are tied to your verified sign-in — the server reads your identity from your ID token, never from the form. Nothing is filed while you are signed out.',
    signInBtn: 'Sign in',
    notConfigured: 'The server cannot verify sign-ins yet, so no post can be saved. Cloud community is not available in this deployment — this screen will not show invented posts.',
    loading: 'Loading posts...',
    reload: 'Reload',
    loadFailed: 'The feed could not be loaded.',
    empty: 'No approved posts yet. A post appears here after a moderator approves it.',
    visibilityNote: 'This list shows approved posts only. Your own pending post stays under “My posts”.',
    kindQ: 'Post type', categoryQ: 'Topic', titleQ: 'Title (optional)', bodyQ: 'Message',
    locQ: 'Place (required for a civic post)', locPh: 'Street / mohalla / city',
    districtQ: 'Area / district', districtPh: 'e.g. Lahore', provinceQ: 'Province',
    photosQ: 'Photos (optional)', choosePhoto: 'Choose image', photoNote:
      'Photos stay on this device: only the file name, type and size travel to the server, never the image bytes. Firebase Storage is not configured in this build, so there is no upload.',
    removing: 'Processing image...',
    cannotUpload: 'This build cannot upload the image (Firebase Storage is not configured). Only its name and size will be recorded.',
    postIt: 'Submit post', posting: 'Submitting...',
    needSignIn: 'Sign in before submitting.',
    fixed: 'To fix:',
    pendingHdr: 'Saved as pending',
    pendingMsg: 'Your post is stored and waiting for a moderator. It is not visible to other members until it is approved.',
    screeningHdr: 'What the reviewer sees',
    standingHdr: 'Your member standing',
    standingActive: 'Your account is in good standing',
    standingWarn: (n: number) => `Confirmed violations: ${n}. ${3 - n} short of a posting pause.`,
    standingSuspended: 'Posting is paused after confirmed violations. An administrator can review this account.',
    decisionHdr: 'Moderator decision',
    appealQ: 'Appeal (if you think the decision should be revisited)', appealPh: 'Brief reason',
    appealBtn: 'Send appeal', appealed: 'Your appeal is recorded. It asks for a second look; it does not reverse the decision.',
    reportBtn: 'Report', reportWhy: 'Reason?', reportNotePh: 'Short note (optional)',
    reportBtnSend: 'Send to a moderator', reportNote:
      'A report is a request for review. It removes nothing and records no violation against anyone.',
    reported: 'Report sent.',
    aiFlagLabel: (g: string[]) => `Advisory signal for the reviewer: ${g.join(', ')} — a machine signal, not a verdict.`,
    byline: 'Member', civicBadge: 'Civic',
    wordsNote: 'Write at least a sentence so a reviewer can understand the topic.',
    offline: 'The community service could not be reached.'
  };
}

function kindLabel(kind: string, roman: boolean) {
  if (kind === 'civic') return roman ? 'Shehri (civic)' : 'Civic report';
  if (kind === 'question') return roman ? 'Sawal' : 'Question';
  return roman ? 'Guftagu' : 'Discussion';
}

/** The advisory screening note, worded as the server wrote it. Never presented as a verdict. */
function FlagNote({ flag, L }: { flag: AiFlag | undefined; L: ReturnType<typeof labels> }) {
  if (!flag || !flag.groups || !flag.groups.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">{L.screeningHdr}</p>
      <p className="text-xs text-amber-900">{L.aiFlagLabel(flag.groups)}</p>
    </div>
  );
}

export default function CommunitySection() {
  const roman = getCurrentLanguage() === 'roman_urdu';
  useLanguageVersion();
  const L = useMemo(() => labels(roman), [roman]);
  const { isAuthenticated, setShowLoginModal } = useAuth();

  const [subTab, setSubTab] = useState<SubTab>('feed');
  const [options, setOptions] = useState<CommunityOptions | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [feed, setFeed] = useState<CommunityPost[] | null>(null);
  const [feedState, setFeedState] = useState<'idle' | 'loading' | 'ok' | 'error' | 'signin' | 'unconfigured'>('idle');
  const [mine, setMine] = useState<CommunityPost[]>([]);
  const [standing, setStanding] = useState<MemberStanding | null>(null);
  const [busy, setBusy] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  const [kind, setKind] = useState('discussion');
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [location, setLocation] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [photos, setPhotos] = useState<CivicEvidence[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [filedId, setFiledId] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [notice, setNotice] = useState('');
  const [reportingId, setReportingId] = useState('');
  const [reportReason, setReportReason] = useState('spam');
  const [reportNote, setReportNote] = useState('');
  const [appeals, setAppeals] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    communityBackendStatus().then(s => setBackendOk(s.serverVerificationConfigured));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setFeedState('signin'); return; }
    let cancelled = false;
    (async () => {
      setFeedState('loading');
      const [opt, f] = await Promise.all([fetchCommunityOptions(), fetchFeed()]);
      if (cancelled) return;
      if (opt.state === 'ok' && opt.data) {
        setOptions(opt.data);
        if (!opt.data.kinds.includes(kind)) setKind(opt.data.kinds[0]);
        if (!opt.data.categories.includes(category)) setCategory(opt.data.categories[0]);
      } else if (opt.state === 'server-not-configured') { setOptionsError(L.notConfigured); }
      if (f.state === 'ok') { setFeed(f.data?.posts || []); setFeedState('ok'); }
      else if (f.state === 'server-not-configured') { setFeedState('unconfigured'); }
      else if (f.state === 'needs-signin') { setFeedState('signin'); }
      else { setFeedState('error'); setNotice(f.message || L.loadFailed); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function loadMine() {
    setBusy(true);
    const r = await fetchMyPosts();
    if (r.state === 'ok' && r.data) { setMine(r.data.posts); setStanding(r.data.standing); }
    else if (r.state === 'server-not-configured') setNotice(L.notConfigured);
    else setNotice(r.message || L.offline);
    setBusy(false);
  }

  async function onSubmit() {
    setFormErrors([]); setNotice(''); setReviewNote('');
    if (!isAuthenticated) { setNotice(L.needSignIn); setShowLoginModal(true); return; }
    const errs: string[] = [];
    if (body.trim().length < BODY_MIN) errs.push(L.wordsNote);
    if (kind === 'civic' && !location.trim()) errs.push(L.locQ);
    if (errs.length) { setFormErrors(errs); return; }
    setBusy(true);
    const res = await submitPost({
      kind, category, title: title.trim(), body: body.trim(),
      location: location.trim(), district: district.trim(), province,
      photos: photos.map(p => ({ name: p.name, type: p.type, bytes: p.bytes })),
      lang: roman ? 'roman_urdu' : 'en'
    });
    setBusy(false);
    if (res.state === 'ok' && res.data) {
      setFiledId(res.data.id);
      setReviewNote(res.data.reviewNote || '');
      setNotice(res.data.message || L.pendingMsg);
      setSubTab('mine');
      setTitle(''); setBody(''); setLocation(''); setDistrict(''); setPhotos([]);
      void loadMine();
    } else if (res.state === 'rejected') {
      setFormErrors(res.errors.map(e => e.message || String(e.code || '')));
    } else if (res.state === 'server-not-configured') {
      setNotice(L.notConfigured);
    } else if (res.state === 'needs-signin') {
      setNotice(L.needSignIn); setShowLoginModal(true);
    } else if (res.state === 'forbidden') {
      setNotice(res.message || L.standingSuspended);
      void loadMine();
    } else {
      setNotice(res.message || L.offline);
    }
  }

  async function onPickPhoto(file: File) {
    setPhotoError('');
    const invalid = validateEvidence(file);
    if (invalid) { setPhotoError(invalid); return; }
    setPhotoBusy(true);
    try {
      const prepared = await compressEvidence(file);
      setPhotos(prev => [...prev.slice(0, 3), prepared]);
    } catch (e: any) {
      setPhotoError(e?.message || 'That image could not be read.');
    }
    setPhotoBusy(false);
  }

  async function onReport(id: string) {
    setBusy(true);
    const r = await reportPost(id, reportReason, reportNote);
    setNotice(r.state === 'ok' ? (r.message || L.reported) : (r.message || L.offline));
    setReportingId(''); setReportNote('');
    setBusy(false);
  }

  async function onAppeal(id: string) {
    const note = (appeals[id] || '').trim();
    setBusy(true);
    const r = await appealPost(id, note);
    setNotice(r.state === 'ok' ? (r.message || L.appealed) : (r.message || L.offline));
    if (r.state === 'ok') { setAppeals(a => ({ ...a, [id]: '' })); void loadMine(); }
    setBusy(false);
  }

  const cardCls = 'bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 p-8';
  const fieldCls = 'w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20';

  function PostCard({ post, showOwner }: { post: CommunityPost; showOwner?: boolean }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 break-words">{post.title || post.body.slice(0, 60)}</p>
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">
              {kindLabel(post.kind, roman)} · {post.category}{post.province ? ` · ${post.province}` : ''}
              {post.location ? ` · ${post.location}` : ''} · {new Date(post.createdAt).toLocaleDateString()}
              {showOwner ? ` · ${L.byline}` : ''}
            </p>
          </div>
          <span className={cn('shrink-0 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest',
            post.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
              : post.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600')}>
            {post.status}
          </span>
        </div>
        <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap break-words">{post.body}</p>
        {post.photos?.length > 0 && (
          <p className="text-[11px] text-gray-500 mt-3 flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5" />
            {post.photos.map(p => `${p.name} (${(p.bytes / 1024).toFixed(0)} kB, held on device)`).join(', ')}
          </p>
        )}
        <FlagNote flag={post.aiFlag} L={L} />
        {post.decisionNote || post.violationConfirmed ? (
          <div className="mt-3 rounded-xl bg-gray-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.decisionHdr}</p>
            <p className="text-xs text-gray-700 mt-1">{post.decisionNote || '—'}</p>
          </div>
        ) : null}
        {subTab === 'feed' && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setReportingId(reportingId === post.id ? '' : post.id); setNotice(''); }}
              className="flex items-center gap-2 text-[11px] font-bold text-gray-500 hover:text-gray-800"
            >
              <Flag className="w-3.5 h-3.5" />{L.reportBtn}{post.reports?.length ? ` (${post.reports.length})` : ''}
            </button>
            {reportingId === post.id && (
              <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-[11px] text-gray-600">{L.reportNote}</p>
                <select value={reportReason} onChange={e => setReportReason(e.target.value)} className={fieldCls}>
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input value={reportNote} onChange={e => setReportNote(e.target.value)} placeholder={L.reportNotePh} className={fieldCls} />
                <button
                  onClick={() => void onReport(post.id)} disabled={busy}
                  className="px-4 py-2 rounded-xl bg-[#01411C] text-white text-[11px] font-black disabled:opacity-50"
                >{L.reportBtnSend}</button>
              </div>
            )}
          </div>
        )}
        {subTab === 'mine' && (post.status === 'rejected' || post.status === 'removed') && !post.appeal && (
          <div className="mt-4 space-y-2">
            <input
              value={appeals[post.id] || ''} onChange={e => setAppeals(a => ({ ...a, [post.id]: e.target.value }))}
              placeholder={L.appealPh} className={fieldCls}
            />
            <button
              onClick={() => void onAppeal(post.id)} disabled={busy || (appeals[post.id] || '').trim().length < 5}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-[11px] font-black disabled:opacity-40"
            >{L.appealBtn}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-12 space-y-8" data-testid="community-section">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#01411C]/10 flex items-center justify-center shrink-0">
          <Users className="w-7 h-7 text-[#01411C]" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-900">{L.heading}</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">{L.sub}</p>
        </div>
      </div>

      {backendOk === false && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex items-start gap-3" data-testid="community-config-blocker">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{L.notConfigured}</p>
        </div>
      )}

      <nav className="flex gap-2 flex-wrap">
        {([['feed', Inbox], ['new', MessageSquarePlus], ['mine', PenLine]] as [SubTab, any][]).map(([id, Icon]) => (
          <button
            key={id} onClick={() => { setSubTab(id); if (id === 'mine') void loadMine(); }}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black border transition-all',
              subTab === id ? 'bg-[#01411C] text-white border-[#01411C]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}
          >
            <Icon className="w-4 h-4" />
            {id === 'feed' ? L.feed : id === 'new' ? L.newPost : L.mine}
          </button>
        ))}
      </nav>

      {notice && (
        <div className="rounded-2xl bg-gray-900 text-white p-5 text-sm flex items-start justify-between gap-4" data-testid="community-notice">
          <p>{notice}</p>
          <button onClick={() => setNotice('')} aria-label={L.fixed} className="shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      {feedState === 'signin' && (
        <div className={cardCls} data-testid="community-signin-gate">
          <ShieldCheck className="w-6 h-6 text-[#01411C]" />
          <h3 className="text-lg font-black text-gray-900 mt-3">{L.signInTitle}</h3>
          <p className="text-sm text-gray-600 mt-2">{L.signInBody}</p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="mt-5 px-6 py-3 rounded-full bg-[#01411C] text-white text-xs font-black"
          >{L.signInBtn}</button>
        </div>
      )}

      {subTab === 'feed' && feedState !== 'signin' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] text-gray-500">{L.visibilityNote}</p>
            <button
              onClick={() => { setFeedState('loading'); void fetchFeed().then(r => {
                if (r.state === 'ok') { setFeed(r.data?.posts || []); setFeedState('ok'); }
                else setFeedState(r.state === 'server-not-configured' ? 'unconfigured' : 'error');
              }); }}
              className="flex items-center gap-2 text-[11px] font-black text-gray-600 hover:text-gray-900 shrink-0"
            ><RefreshCw className="w-3.5 h-3.5" />{L.reload}</button>
          </div>
          {feedState === 'loading' && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />{L.loading}</p>}
          {feedState === 'unconfigured' && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800" data-testid="community-feed-blocker">{L.notConfigured}</div>
          )}
          {feedState === 'error' && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">{L.loadFailed}</div>}
          {feedState === 'ok' && feed && feed.length === 0 && <p className="text-sm text-gray-500">{L.empty}</p>}
          {feedState === 'ok' && feed?.map(p => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      {subTab === 'new' && (
        <div className={cardCls}>
          {optionsError && !options && <p className="text-xs text-red-700 mb-4">{optionsError}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.kindQ}</span>
              <select value={kind} onChange={e => setKind(e.target.value)} className={cn(fieldCls, 'mt-2')}>
                {(options?.kinds || ['discussion', 'question', 'civic']).map(k => <option key={k} value={k}>{kindLabel(k, roman)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.categoryQ}</span>
              <select value={category} onChange={e => setCategory(e.target.value)} className={cn(fieldCls, 'mt-2')}>
                {(options?.categories || ['general']).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="block mt-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.titleQ}</span>
            <input value={title} maxLength={140} onChange={e => setTitle(e.target.value)} className={cn(fieldCls, 'mt-2')} />
          </label>
          <label className="block mt-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.bodyQ}</span>
            <textarea value={body} onChange={e => setBody(e.target.value.slice(0, BODY_MAX))} rows={6} className={cn(fieldCls, 'mt-2 resize-y')} />
            <span className="text-[10px] text-gray-400">{body.length}/{BODY_MAX}</span>
          </label>
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.locQ}</span>
              <input value={location} maxLength={120} onChange={e => setLocation(e.target.value)} placeholder={L.locPh} className={cn(fieldCls, 'mt-2')} />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.districtQ}</span>
              <input value={district} maxLength={80} onChange={e => setDistrict(e.target.value)} placeholder={L.districtPh} className={cn(fieldCls, 'mt-2')} />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.provinceQ}</span>
              <select value={province} onChange={e => setProvince(e.target.value)} className={cn(fieldCls, 'mt-2')}>
                <option value="">—</option>
                {(options?.provinces?.length ? options.provinces : [...CIVIC_PROVINCES]).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />{L.cannotUpload}</p>

          <div className="mt-5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.photosQ}</span>
            <p className="text-[11px] text-gray-500 mt-1">{L.photoNote}</p>
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void onPickPhoto(f); e.target.value = ''; }}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-[11px] font-black text-gray-700">
                <ImageIcon className="w-3.5 h-3.5" />{L.choosePhoto}
              </button>
              {photoBusy && <span className="flex items-center gap-2 text-[11px] text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" />{L.removing}</span>}
            </div>
            {photoError && <p className="text-[11px] text-red-700 mt-2">{photoError}</p>}
            {photos.length > 0 && (
              <ul className="mt-3 space-y-1">
                {photos.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 text-[11px] text-gray-600">
                    <span>{p.name} · {(p.bytes / 1024).toFixed(0)} kB</span>
                    <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-700"><X className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {formErrors.length > 0 && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4" data-testid="community-form-errors">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-700">{L.fixed}</p>
              <ul className="text-xs text-red-800 mt-1 list-disc pl-4">{formErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}

          <button
            onClick={() => void onSubmit()} disabled={busy}
            className="mt-6 px-6 py-3 rounded-full bg-[#01411C] text-white text-xs font-black disabled:opacity-50"
          >{busy ? L.posting : L.postIt}</button>
        </div>
      )}

      {subTab === 'mine' && (
        <div className="space-y-4">
          {standing && (
            <div className={cardCls} data-testid="community-standing">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.standingHdr}</p>
              <p className="text-sm text-gray-800 mt-2">
                {standing.state === 'suspended' ? L.standingSuspended
                  : standing.violations > 0 ? L.standingWarn(standing.violations)
                    : L.standingActive}
              </p>
            </div>
          )}
          {filedId && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6" data-testid="community-pending-confirm">
              <p className="text-sm font-black text-amber-900">{L.pendingHdr}</p>
              <p className="text-xs text-amber-900 mt-1">{L.pendingMsg}</p>
            </div>
          )}
          {busy && mine.length === 0 && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />{L.loading}</p>}
          {!busy && mine.length === 0 && <p className="text-sm text-gray-500">{L.empty}</p>}
          {mine.map(p => <PostCard key={p.id} post={p} showOwner />)}
        </div>
      )}
    </section>
  );
}
