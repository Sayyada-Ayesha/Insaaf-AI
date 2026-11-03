/**
 * src/services/communityCloud.ts — the browser half of Community and the admin
 * dashboard.
 *
 * Every call carries the signed-in user's Firebase ID token and nothing else that
 * identifies them: `server/communityRoutes.js` and `server/adminRoutes.js` derive the
 * owner, the role and the status from the verified token, so a body field claiming
 * `ownerUid`, `role` or `status: 'approved'` would simply be ignored — and saying so
 * in the UI is only honest because the server already enforces it.
 *
 * Results are discriminated unions, never thrown strings, and success is reported only
 * from a real 2xx. A 503 with AUTH_NOT_CONFIGURED is surfaced as its own state so the
 * screen can name the missing backend configuration instead of faking a feed.
 */
import { auth } from '../lib/firebase';
import { getIdToken } from 'firebase/auth';

export type CloudState =
  | 'ok'
  | 'needs-signin'
  | 'server-not-configured'
  | 'forbidden'
  | 'rejected'
  | 'unreachable';

export interface CloudResult<T> {
  state: CloudState;
  data: T | null;
  /** Server field errors, for a rejected post. */
  errors: { code?: string; field?: string; message?: string }[];
  /** Message the server meant for a human, when it sent one. */
  message: string;
  status: number;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<CloudResult<T>> {
  const fail = (state: CloudState, extra: Partial<CloudResult<T>> = {}): CloudResult<T> => ({
    state, data: null, errors: [], message: '', status: 0, ...extra
  });
  const user = auth.currentUser;
  if (!user) return fail('needs-signin');
  let res: Response;
  try {
    const token = await getIdToken(user, true);
    res = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(init.headers || {})
      }
    });
  } catch {
    return fail('unreachable', { message: 'The community service could not be reached.' });
  }
  const payload = await res.json().catch(() => null) as any;
  if (res.status === 401) return fail('needs-signin', { status: 401, message: String(payload?.message || '') });
  if (res.status === 403) return fail('forbidden', { status: 403, message: String(payload?.message || '') });
  if (res.status === 503) {
    if (payload?.error === 'AUTH_NOT_CONFIGURED') {
      return fail('server-not-configured', { status: 503 });
    }
    return fail('unreachable', { status: 503, message: String(payload?.message || '') });
  }
  if (res.status === 400 || res.status === 409) {
    return fail('rejected', {
      status: res.status,
      errors: Array.isArray(payload?.errors) ? payload.errors : (payload?.error ? [{ message: String(payload.message || payload.error) }] : []),
      message: String(payload?.message || '')
    });
  }
  if (!res.ok) return fail('unreachable', { status: res.status, message: String(payload?.message || '') });
  return { state: 'ok', data: (payload as T) ?? null, errors: [], message: String(payload?.message || ''), status: res.status };
}

/* ------------------------------------------------------------------ *
 * Shapes returned by the existing server
 * ------------------------------------------------------------------ */

export interface AiFlag {
  conclusive: boolean;
  groups: string[];
  suggestedAction?: string;
  flagged?: { code: string; group: string; count?: number }[];
}

export interface CommunityPost {
  id: string;
  ownerUid: string;
  title: string;
  body: string;
  kind: string;
  category: string;
  location: string;
  district: string;
  province: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reports: { at: string; by: string; reason: string; note: string | null }[];
  photos: { name: string; type: string; bytes: number; held: string }[];
  aiFlag: AiFlag;
  decidedBy?: string;
  decisionNote?: string;
  violationConfirmed?: boolean;
  appeal?: { status: string; at: string; by: string; note: string } | null;
  audit?: { at: string; from: string | null; to: string; by: string; actor?: string; note?: string | null }[];
}

export interface MemberStanding {
  state: string;
  violations: number;
  untilSuspension: number;
  suspendedAt: string | null;
  canPost: boolean;
  notices: { at: string; state: string }[];
}

export interface CommunityOptions {
  kinds: string[];
  categories: string[];
  statuses: string[];
  provinces: string[];
  suspensionThreshold: number;
}

export interface PostInput {
  kind: string;
  category: string;
  title: string;
  body: string;
  location: string;
  district: string;
  province: string;
  photos: { name: string; type: string; bytes: number }[];
  lang?: 'en' | 'roman_urdu';
}

export interface FiledPost {
  id: string;
  status: string;
  createdAt: string;
  reviewNote: string | null;
  message: string;
}

export async function fetchCommunityOptions(): Promise<CloudResult<CommunityOptions>> {
  return call<CommunityOptions>('/api/community/options');
}

export async function fetchFeed(params: { kind?: string; category?: string; province?: string } = {}):
  Promise<CloudResult<{ posts: CommunityPost[]; visibility: string }>> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return call(`/api/community/feed${suffix}`);
}

export async function fetchMyPosts(): Promise<CloudResult<{ posts: CommunityPost[]; standing: MemberStanding }>> {
  return call('/api/community/posts/mine');
}

export async function fetchStanding(): Promise<CloudResult<{ standing: MemberStanding; threshold: number }>> {
  return call('/api/community/me');
}

export async function submitPost(input: PostInput): Promise<CloudResult<FiledPost>> {
  return call('/api/community/posts', { method: 'POST', body: JSON.stringify(input) });
}

export async function reportPost(id: string, reason: string, note: string): Promise<CloudResult<{ reportCount: number }>> {
  return call(`/api/community/posts/${encodeURIComponent(id)}/report`, {
    method: 'POST', body: JSON.stringify({ reason, note })
  });
}

export async function appealPost(id: string, note: string): Promise<CloudResult<{ appeal: unknown }>> {
  return call(`/api/community/posts/${encodeURIComponent(id)}/appeal`, {
    method: 'POST', body: JSON.stringify({ note })
  });
}

/* ------------------------------------------------------------------ *
 * Administrator surface. Every one of these is server-guarded by the
 * verified administrator claim; the dashboard hides nothing for safety.
 * ------------------------------------------------------------------ */

export interface AdminQueue {
  queue: CommunityPost[];
  statuses: string[];
  kinds: string[];
  categories: string[];
  transitions: Record<string, string[]>;
  suspensionThreshold: number;
}

export async function fetchAdminQueue(status = 'pending'): Promise<CloudResult<AdminQueue>> {
  return call(`/api/community/admin/queue?status=${encodeURIComponent(status)}`);
}

export interface DecisionResult {
  post: CommunityPost;
  violationConfirmed: boolean;
  strike: { applied: boolean; violations?: number; state?: string; notice?: string; message?: string };
}

export async function decidePost(
  id: string, action: 'approve' | 'reject' | 'remove', note: string, confirmViolation: boolean
): Promise<CloudResult<DecisionResult>> {
  return call(`/api/community/admin/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ action, note, confirmViolation })
  });
}

export async function fetchMemberDetail(uid: string): Promise<CloudResult<{ standing: MemberStanding; posts: CommunityPost[] }>> {
  return call(`/api/community/admin/members/${encodeURIComponent(uid)}`);
}

export interface Overview {
  generatedAt: string;
  civicReports: { total: number; by: Record<string, number> };
  communityPosts: { total: number; by: Record<string, number> };
  communityPendingReview: number | null;
  supportRequests: { total: number; by: Record<string, number> };
  memberProfileCount: number | null;
  appProfileCount: number | null;
  privacy: Record<string, boolean>;
}

export interface AuditEntry { id: string; at: string; by: string; targetUid: string | null; action: string; from?: string | null; to?: string | null; reason?: string | null }
export interface SupportRequest { id: string; createdAt: string; status: string; kind?: string; message?: string; email?: string; userId?: string }
export interface CivicAdminQueue { queue: any[]; transitions: Record<string, string[]> }

/** Probe used to decide whether to offer the dashboard at all: 200 means the verified claim says administrator. */
export async function probeAdministrator(): Promise<CloudResult<{ entries: AuditEntry[] }>> {
  return call('/api/admin/audit?limit=1');
}

export async function fetchOverview(): Promise<CloudResult<Overview>> {
  return call('/api/admin/overview');
}

export async function fetchAudit(limit = 50): Promise<CloudResult<{ entries: AuditEntry[] }>> {
  return call(`/api/admin/audit?limit=${limit}`);
}

export async function fetchSupport(status = ''): Promise<CloudResult<{ requests: SupportRequest[] }>> {
  return call(`/api/admin/support-requests?status=${encodeURIComponent(status)}`);
}

export async function triageSupport(id: string, status: string, note: string): Promise<CloudResult<{ request: SupportRequest }>> {
  return call(`/api/admin/support-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ status, note })
  });
}

export async function setRole(uid: string, role: string, reason: string): Promise<CloudResult<{ target: string; role: string }>> {
  return call(`/api/admin/users/${encodeURIComponent(uid)}/role`, {
    method: 'PATCH', body: JSON.stringify({ role, reason })
  });
}

export async function setAccountStatus(uid: string, disabled: boolean, reason: string): Promise<CloudResult<{ target: string; disabled: boolean }>> {
  return call(`/api/admin/users/${encodeURIComponent(uid)}/status`, {
    method: 'PATCH', body: JSON.stringify({ disabled, reason })
  });
}

export async function fetchCivicQueue(status = ''): Promise<CloudResult<CivicAdminQueue>> {
  return call(`/api/civic/admin/queue?status=${encodeURIComponent(status)}`);
}

export async function fetchAccount(uid: string): Promise<CloudResult<{ uid: string; role: string; disabled: boolean; emailProvided: boolean }>> {
  return call(`/api/admin/users/${encodeURIComponent(uid)}`);
}

export async function transitionCivic(id: string, status: string, note: string): Promise<CloudResult<any>> {
  return call(`/api/civic/admin/reports/${encodeURIComponent(id)}/status`, {
    method: 'PATCH', body: JSON.stringify({ status, note })
  });
}

export async function fetchUpdateSources(): Promise<CloudResult<any>> {
  return call('/api/admin/updates/sources');
}

export async function fetchUpdateCandidates(): Promise<CloudResult<any>> {
  return call('/api/admin/updates/candidates');
}

/**
 * Whether the backend can verify tokens at all. Unlike the calls above this needs no
 * session: it is the public status route, used to label the configuration banner
 * truthfully instead of assuming.
 */
export async function communityBackendStatus(): Promise<{ serverVerificationConfigured: boolean; credentialSource: string }> {
  try {
    const res = await fetch('/api/civic/auth-status');
    if (!res.ok) return { serverVerificationConfigured: false, credentialSource: 'unknown' };
    const payload: any = await res.json();
    return {
      serverVerificationConfigured: Boolean(payload?.serverVerificationConfigured),
      credentialSource: String(payload?.credentialSource || 'none')
    };
  } catch {
    return { serverVerificationConfigured: false, credentialSource: 'unreachable' };
  }
}
