import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Loader2, AlertTriangle, RefreshCw, Check, X, Users, Inbox,
  Megaphone, LifeBuoy, ScrollText, BookMarked, Ban
} from 'lucide-react';
import { cn } from './Layout';
import { getCurrentLanguage, useLanguageVersion } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import {
  CommunityPost, Overview, AuditEntry, SupportRequest,
  fetchOverview, fetchAdminQueue, decidePost, fetchMemberDetail, fetchAudit, fetchSupport,
  triageSupport, setRole, setAccountStatus, fetchCivicQueue, transitionCivic, fetchAccount,
  fetchUpdateSources, MemberStanding, CloudResult
} from '../services/communityCloud';

type AdminTab = 'overview' | 'community' | 'civic' | 'support' | 'users' | 'audit' | 'updates';
const ROLES = ['student', 'lawyer', 'administrator'];

function labels(roman: boolean) {
  return roman ? {
    heading: 'Administrator Dashboard',
    sub: 'Faislay sirf verified administrator claim se hote hain. Server har action ki authorization khud karta hai.',
    tabs: { overview: 'Khulasa', community: 'Community queue', civic: 'Shehri reports', support: 'App reports', users: 'Users aur roles', audit: 'Audit', updates: 'Legal sources' },
    loading: 'Load ho raha hai...',
    reload: 'Dobara load karein',
    signin: 'Administrator ke liye bhi sign-in zaroori hai.',
    forbidden: 'Aap ke verified token mein administrator role nahi hai. Admin ka koi bhi action server reject karta hai — yeh screen koi chaalaak button nahi hai.',
    notConfigured: 'Server abhi token verify nahi kar sakta: Firebase service account set nahi hai (FIREBASE_PROJECT_ID aur FIREBASE_SERVICE_ACCOUNT_JSON/_B64 ya GOOGLE_APPLICATION_CREDENTIALS). Is liye koi figure, queue ya faisla moosar nahi.',
    unreachable: 'Admin service tak rasai nahi hui.',
    privacyNote: 'Yeh dashboard koi khaali chat matan, pareshani wale sawal ya private transcript nahi dikhata — sirf counts, statuses aur moderation records.',
    approve: 'Approve', reject: 'Reject', remove: 'Remove',
    confirmViolation: 'Is post par tasedeeq shuda khilaf darj karein (strike)',
    violationHelp: 'Strike sirf aap ke is insani faisla se banti hai, machine ke signal se nahi. Ek prediction se account kabhi delete nahi hota.',
    notePh: 'Faislay ki wazahat (reviewer aur member ke liye)',
    acting: 'Kaam ho raha hai...',
    queueEmpty: 'Is status mein koi post nahi.',
    signal: 'Machine signal', by: 'Decision by', submitted: 'Bheja',
    status: 'Status', transition: 'Status badlein', apply: 'Lagayein',
    assigneeNote: 'Note (ikhtiyari)',
    uidQ: 'User ID (uid)', uidPh: 'Woh uid jo aap ke paas hai',
    roleQ: 'Role', reasonQ: 'Wajah', saveRole: 'Role set karein',
    pause: 'Account moatariz karein', reinstate: 'Account chalu karein',
    noUserList: 'User ki list yahan nahi di jaati — admin kisi uid ko seedha parh sakta hai, is liye uid likhein.',
    account: 'Account', role: 'Role', disabled: 'Moatariz', active: 'Chalu',
    triageQ: 'Support report ka status', triage: 'Update karein',
    auditEmpty: 'Koi audit record nahi.',
    sources: 'Registered sources', sourceNote: 'Source update registry ka halat, jahan API moosar ho.',
    counts: 'Reports / posts / requests', generated: 'Figures bani'
  } : {
    heading: 'Administrator Dashboard',
    sub: 'Every action here goes through the server guard: the role is read from the verified ID token, never from this page.',
    tabs: { overview: 'Overview', community: 'Community queue', civic: 'Civic reports', support: 'App reports', users: 'Users and roles', audit: 'Audit', updates: 'Legal sources' },
    loading: 'Loading...',
    reload: 'Reload',
    signin: 'Sign in is required for administrator actions too.',
    forbidden: 'Your verified token does not carry the administrator role. The server refuses every admin action for this account — hiding a button would not be security, and this screen is not offering one.',
    notConfigured: 'The server cannot verify tokens yet: no Firebase service account is configured (FIREBASE_PROJECT_ID with FIREBASE_SERVICE_ACCOUNT_JSON/_B64 or GOOGLE_APPLICATION_CREDENTIALS). Until it is, no figure, queue or decision is available.',
    unreachable: 'The admin service could not be reached.',
    privacyNote: 'This dashboard never reads private chat transcripts, saved drafts or raw question text — only counts, statuses and moderation records.',
    approve: 'Approve', reject: 'Reject', remove: 'Remove',
    confirmViolation: 'Record a confirmed violation for this post (adds a strike)',
    violationHelp: 'A strike is born only from this human decision, never from a machine signal. No single prediction deletes an account.',
    notePh: 'Reason for the decision (shown to the member and kept in the audit)',
    acting: 'Working...',
    queueEmpty: 'No posts with this status.',
    signal: 'Advisory signal', by: 'Decision by', submitted: 'Submitted',
    status: 'Status', transition: 'Move status to', apply: 'Apply',
    assigneeNote: 'Note (optional)',
    uidQ: 'User ID (uid)', uidPh: 'The uid you are acting on',
    roleQ: 'Role', reasonQ: 'Reason', saveRole: 'Set role',
    pause: 'Pause account', reinstate: 'Reinstate account',
    noUserList: 'There is no user directory here: an administrator reads a specific uid, so enter it.',
    account: 'Account', role: 'Role', disabled: 'Paused', active: 'Active',
    triageQ: 'Triage status', triage: 'Update',
    auditEmpty: 'No audit records yet.',
    sources: 'Registered sources', sourceNote: 'Legal-source update registry status, where the API exposes it.',
    counts: 'Reports / posts / requests', generated: 'Figures generated'
  };
}

/** One honest sentence per non-ok state, so a failure is never rendered as an empty success. */
function messageFor<T>(res: CloudResult<T>, L: ReturnType<typeof labels>): string | null {
  if (res.state === 'ok') return null;
  if (res.state === 'needs-signin') return L.signin;
  if (res.state === 'forbidden') return L.forbidden;
  if (res.state === 'server-not-configured') return L.notConfigured;
  return res.message || (res.state === 'rejected' ? res.errors.map(e => e.message).join(' ') : L.unreachable);
}

export default function AdminDashboardSection() {
  const roman = getCurrentLanguage() === 'roman_urdu';
  useLanguageVersion();
  const L = useMemo(() => labels(roman), [roman]);
  const { isAuthenticated, setShowLoginModal } = useAuth();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [queueStatus, setQueueStatus] = useState('pending');
  const [queue, setQueue] = useState<CommunityPost[]>([]);
  const [transitions, setTransitions] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [strikes, setStrikes] = useState<Record<string, boolean>>({});
  const [civicQueue, setCivicQueue] = useState<any[]>([]);
  const [civicTransitions, setCivicTransitions] = useState<Record<string, string[]>>({});
  const [civicStatus, setCivicStatus] = useState<Record<string, string>>({});
  const [support, setSupport] = useState<SupportRequest[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [uid, setUid] = useState('');
  const [role, setRole2] = useState('student');
  const [reason, setReason] = useState('');
  const [account, setAccount] = useState<{ uid: string; role: string; disabled: boolean } | null>(null);
  const [memberStanding, setMemberStanding] = useState<MemberStanding | null>(null);
  const [sources, setSources] = useState<any | null>(null);

  async function load(which: AdminTab) {
    setBusy(true); setError(null);
    const done = (res: CloudResult<any>) => { if (res.state !== 'ok') setError(messageFor(res, L)); };
    if (which === 'overview') { const r = await fetchOverview(); setOverview(r.data); done(r); }
    if (which === 'community') {
      const r = await fetchAdminQueue(queueStatus);
      setQueue(r.data?.queue || []); setTransitions(r.data?.transitions || {}); done(r);
    }
    if (which === 'civic') {
      const r = await fetchCivicQueue();
      setCivicQueue(r.data?.queue || []); setCivicTransitions(r.data?.transitions || {}); done(r);
    }
    if (which === 'support') { const r = await fetchSupport(''); setSupport(r.data?.requests || []); done(r); }
    if (which === 'audit') { const r = await fetchAudit(50); setAudit(r.data?.entries || []); done(r); }
    if (which === 'updates') { const r = await fetchUpdateSources(); setSources(r.data); done(r); }
    if (which === 'users') { const r = await fetchAudit(10); setAudit(r.data?.entries || []); done(r); }
    setBusy(false);
  }

  useEffect(() => { if (isAuthenticated) void load(tab); else setError(L.signin); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, isAuthenticated]);

  async function decide(post: CommunityPost, action: 'approve' | 'reject' | 'remove') {
    setBusy(true); setNotice('');
    const r = await decidePost(post.id, action, notes[post.id] || '', strikes[post.id] === true);
    const m = messageFor(r, L);
    if (m) setError(m);
    else {
      const strike = r.data?.strike;
      setNotice(strike?.applied
        ? `${action === 'approve' ? '' : 'Violation recorded. '}${strike.notice || ''}`
        : `Decision applied: ${r.data?.post?.status}. ${strike?.message || ''}`);
      void load('community');
    }
    setBusy(false);
  }

  async function moveCivic(report: any) {
    const target = civicStatus[report.id] || '';
    if (!target) return;
    setBusy(true); setNotice('');
    const r = await transitionCivic(report.id, target, notes[report.id] || '');
    const m = messageFor(r, L);
    if (m) setError(m); else { setNotice(`Report ${report.ref || report.id} → ${target}.`); void load('civic'); }
    setBusy(false);
  }

  async function readAccount() {
    if (!uid.trim()) return;
    setBusy(true); setError(null); setMemberStanding(null); setAccount(null);
    const [a, m] = await Promise.all([fetchAccount(uid.trim()), fetchMemberDetail(uid.trim())]);
    if (a.state === 'ok' && a.data) setAccount({ uid: uid.trim(), role: String(a.data.role || 'unassigned'), disabled: Boolean(a.data.disabled) });
    else if (a.state !== 'ok') setError(messageFor(a, L));
    if (m.state === 'ok' && m.data) setMemberStanding(m.data.standing);
    setBusy(false);
  }

  async function applyRole() {
    setBusy(true); setNotice('');
    const r = await setRole(uid.trim(), role, reason);
    const m = messageFor(r, L);
    if (m) setError(m); else { setNotice(`Role set to ${role} for ${uid}. The change is audited.`); void load('users'); }
    setBusy(false);
  }

  async function applyStatus(disabled: boolean) {
    setBusy(true); setNotice('');
    const r = await setAccountStatus(uid.trim(), disabled, reason);
    const m = messageFor(r, L);
    if (m) setError(m); else { setNotice(disabled ? 'Account paused. Nothing was deleted.' : 'Account reinstated.'); void readAccount(); }
    setBusy(false);
  }

  async function applyTriage(req: SupportRequest, status: string) {
    setBusy(true);
    const r = await triageSupport(req.id, status, notes[req.id] || '');
    const m = messageFor(r, L);
    if (m) setError(m); else { setNotice(`Request ${req.id} → ${status}.`); void load('support'); }
    setBusy(false);
  }

  const card = 'bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 p-6';
  const field = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20';

  if (!isAuthenticated) {
    return (
      <section className="max-w-4xl mx-auto px-4 py-12" data-testid="admin-signin-gate">
        <div className={card}>
          <ShieldCheck className="w-6 h-6 text-[#01411C]" />
          <h2 className="text-xl font-black text-gray-900 mt-3">{L.heading}</h2>
          <p className="text-sm text-gray-600 mt-2">{L.signin}</p>
          <button onClick={() => setShowLoginModal(true)} className="mt-5 px-6 py-3 rounded-full bg-[#01411C] text-white text-xs font-black">
            {roman ? 'Sign in karein' : 'Sign in'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 py-12 space-y-6" data-testid="admin-dashboard">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#01411C]/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-7 h-7 text-[#01411C]" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-900">{L.heading}</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{L.sub}</p>
          <p className="text-[11px] text-gray-400 mt-1 max-w-2xl">{L.privacyNote}</p>
        </div>
      </div>

      <nav className="flex gap-2 flex-wrap">
        {(Object.keys(L.tabs) as AdminTab[]).map(id => (
          <button
            key={id} onClick={() => setTab(id)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black border transition-all',
              tab === id ? 'bg-[#01411C] text-white border-[#01411C]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}
          >
            {id === 'overview' && <Users className="w-3.5 h-3.5" />}
            {id === 'community' && <Inbox className="w-3.5 h-3.5" />}
            {id === 'civic' && <Megaphone className="w-3.5 h-3.5" />}
            {id === 'support' && <LifeBuoy className="w-3.5 h-3.5" />}
            {id === 'users' && <Users className="w-3.5 h-3.5" />}
            {id === 'audit' && <ScrollText className="w-3.5 h-3.5" />}
            {id === 'updates' && <BookMarked className="w-3.5 h-3.5" />}
            {L.tabs[id]}
          </button>
        ))}
        <button onClick={() => void load(tab)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black text-gray-500 hover:text-gray-900">
          <RefreshCw className="w-3.5 h-3.5" />{L.reload}
        </button>
      </nav>

      {busy && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />{L.loading}</p>}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex items-start gap-3 text-sm text-red-800" data-testid="admin-error">
          <AlertTriangle className="w-5 h-5 shrink-0" /><p>{error}</p>
        </div>
      )}
      {notice && <p className="text-xs text-emerald-800 bg-emerald-50 rounded-xl p-4" data-testid="admin-notice">{notice}</p>}

      {tab === 'overview' && overview && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="admin-overview">
          <Stat label={L.tabs.civic} total={overview.civicReports?.total} by={overview.civicReports?.by} />
          <Stat label="Community posts" total={overview.communityPosts?.total} by={overview.communityPosts?.by} />
          <Stat label="Support requests" total={overview.supportRequests?.total} by={overview.supportRequests?.by} />
          <div className={card}>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.counts}</p>
            <p className="text-2xl font-black text-gray-900 mt-2">{overview.civicReports?.total ?? '—'} / {overview.communityPosts?.total ?? '—'} / {overview.supportRequests?.total ?? '—'}</p>
            <p className="text-[11px] text-gray-500 mt-2">Members: {overview.memberProfileCount ?? '—'} · Profiles: {overview.appProfileCount ?? '—'}</p>
            <p className="text-[11px] text-gray-400 mt-2">{L.generated}: {overview.generatedAt ? new Date(overview.generatedAt).toLocaleString() : '—'}</p>
          </div>
        </div>
      )}

      {tab === 'community' && (
        <div className="space-y-4">
          <select value={queueStatus} onChange={e => setQueueStatus(e.target.value)} className={cn(field, 'max-w-[200px]')}>
            {['pending', 'approved', 'rejected', 'removed', ''].map(s => <option key={s} value={s}>{s || 'all'}</option>)}
          </select>
          {queue.length === 0 && !busy && <p className="text-sm text-gray-500">{L.queueEmpty}</p>}
          {queue.map(post => (
            <div key={post.id} className={card} data-testid={`admin-post-${post.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 break-words">{post.title || post.body.slice(0, 60)}</p>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">
                    {post.kind} · {post.category} · {L.submitted} {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-gray-100 text-gray-600">{post.status}</span>
              </div>
              <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap break-words">{post.body}</p>
              {post.aiFlag?.groups?.length > 0 && (
                <p className="text-[11px] text-amber-800 mt-2">{L.signal}: {post.aiFlag.groups.join(', ')} ({post.aiFlag.conclusive ? 'conclusive' : 'advisory only'})</p>
              )}
              {post.reports?.length > 0 && <p className="text-[11px] text-gray-500 mt-1">Member reports: {post.reports.length}</p>}
              <div className="mt-4 space-y-3">
                <input value={notes[post.id] || ''} onChange={e => setNotes(n => ({ ...n, [post.id]: e.target.value }))} placeholder={L.notePh} className={field} />
                <label className="flex items-start gap-2 text-[11px] text-gray-600">
                  <input
                    type="checkbox" checked={strikes[post.id] === true}
                    onChange={e => setStrikes(s => ({ ...s, [post.id]: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>{L.confirmViolation}<br /><span className="text-gray-400">{L.violationHelp}</span></span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(transitions[post.status] || []).includes('approved') && (
                    <button onClick={() => void decide(post, 'approve')} disabled={busy}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 text-white text-[11px] font-black disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" />{L.approve}
                    </button>
                  )}
                  {(transitions[post.status] || []).includes('rejected') && (
                    <button onClick={() => void decide(post, 'reject')} disabled={busy}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-[11px] font-black disabled:opacity-50">
                      <X className="w-3.5 h-3.5" />{L.reject}
                    </button>
                  )}
                  {(transitions[post.status] || []).includes('removed') && (
                    <button onClick={() => void decide(post, 'remove')} disabled={busy}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 text-white text-[11px] font-black disabled:opacity-50">
                      <Ban className="w-3.5 h-3.5" />{L.remove}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'civic' && (
        <div className="space-y-4">
          {civicQueue.length === 0 && !busy && <p className="text-sm text-gray-500">{L.queueEmpty}</p>}
          {civicQueue.map((report: any) => (
            <div key={report.id} className={cn(card, 'flex flex-wrap items-center gap-3')}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-gray-900 truncate">{report.title}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">{report.ref || report.id} · {report.status}</p>
              </div>
              <select value={civicStatus[report.id] || ''} onChange={e => setCivicStatus(s => ({ ...s, [report.id]: e.target.value }))} className={cn(field, 'max-w-[180px]')}>
                <option value="">{L.transition}</option>
                {(civicTransitions[report.status] || []).map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => void moveCivic(report)} disabled={busy || !civicStatus[report.id]}
                className="px-4 py-2 rounded-xl bg-[#01411C] text-white text-[11px] font-black disabled:opacity-40">{L.apply}</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'support' && (
        <div className="space-y-4">
          {support.length === 0 && !busy && <p className="text-sm text-gray-500">{L.queueEmpty}</p>}
          {support.map(req => (
            <div key={req.id} className={cn(card, 'space-y-3')}>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{req.id} · {req.status} · {req.kind || 'report'} · {req.createdAt ? new Date(req.createdAt).toLocaleString() : ''}</p>
              {req.message && <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{req.message}</p>}
              <input value={notes[req.id] || ''} onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))} placeholder={L.assigneeNote} className={field} />
              <div className="flex gap-2 flex-wrap">
                {['triaged', 'in-progress', 'resolved', 'wont-fix'].map(s => (
                  <button key={s} onClick={() => void applyTriage(req, s)} disabled={busy}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-[10px] font-black text-gray-700 hover:border-gray-400 disabled:opacity-40">{s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className={cn(card, 'space-y-4')}>
          <p className="text-[11px] text-gray-500">{L.noUserList}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block"><span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.uidQ}</span>
              <input value={uid} onChange={e => setUid(e.target.value)} placeholder={L.uidPh} className={cn(field, 'mt-2')} data-testid="admin-uid-input" /></label>
            <label className="block"><span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.reasonQ}</span>
              <input value={reason} onChange={e => setReason(e.target.value)} className={cn(field, 'mt-2')} maxLength={300} /></label>
          </div>
          <button onClick={() => void readAccount()} disabled={busy || !uid.trim()}
            className="px-4 py-2 rounded-xl border border-gray-200 text-[11px] font-black text-gray-700 disabled:opacity-40">{roman ? 'Parhein' : 'Read account'}</button>
          {account && (
            <div className="rounded-xl bg-gray-50 p-4 text-xs text-gray-700" data-testid="admin-account">
              {L.account}: {account.uid}<br />{L.role}: <b>{account.role}</b> · {account.disabled ? L.disabled : L.active}
            </div>
          )}
          {memberStanding && (
            <div className="rounded-xl bg-gray-50 p-4 text-xs text-gray-700">
              {L.tabs.community}: {memberStanding.state} · {memberStanding.violations} confirmed · posting {memberStanding.canPost ? L.active : L.disabled}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-gray-100">
            <label className="block"><span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{L.roleQ}</span>
              <select value={role} onChange={e => setRole2(e.target.value)} className={cn(field, 'mt-2')}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
            <button onClick={() => void applyRole()} disabled={busy || !uid.trim()}
              className="px-4 py-2 rounded-xl bg-[#01411C] text-white text-[11px] font-black disabled:opacity-40">{L.saveRole}</button>
            <button onClick={() => void applyStatus(true)} disabled={busy || !uid.trim()}
              className="px-4 py-2 rounded-xl bg-red-700 text-white text-[11px] font-black disabled:opacity-40">{L.pause}</button>
            <button onClick={() => void applyStatus(false)} disabled={busy || !uid.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-[11px] font-black disabled:opacity-40">{L.reinstate}</button>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-2">
          {audit.length === 0 && !busy && <p className="text-sm text-gray-500">{L.auditEmpty}</p>}
          {audit.map(e => (
            <div key={e.id} className="rounded-2xl bg-white border border-gray-100 p-4 text-xs text-gray-700">
              <b>{e.action}</b> · {new Date(e.at).toLocaleString()} · by {e.by}
              {e.targetUid ? ` · on ${e.targetUid}` : ''}{e.to ? ` · → ${e.to}` : ''}{e.reason ? ` · ${e.reason}` : ''}
            </div>
          ))}
        </div>
      )}

      {tab === 'updates' && (
        <div className="space-y-3">
          <p className="text-[11px] text-gray-500">{L.sourceNote}</p>
          {!sources && !busy && <p className="text-sm text-gray-500">{L.queueEmpty}</p>}
          {sources && (
            <div className="space-y-2" data-testid="admin-sources">
              <p className="text-xs text-gray-600">{L.sources}: {Array.isArray(sources?.sources) ? sources.sources.length : '—'}</p>
              {(Array.isArray(sources?.sources) ? sources.sources : []).slice(0, 40).map((s: any, i: number) => (
                <div key={s.id || i} className="rounded-2xl bg-white border border-gray-100 p-4 text-xs text-gray-700 flex items-center justify-between gap-3">
                  <span className="truncate">{s.title || s.id}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 shrink-0">{s.status || s.state || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, total, by }: { label: string; total?: number | null; by?: Record<string, number> }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 p-6">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-3xl font-black text-gray-900 mt-2">{total ?? '—'}</p>
      {by && Object.keys(by).length > 0 && (
        <p className="text-[11px] text-gray-500 mt-2">{Object.entries(by).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
      )}
    </div>
  );
}
