/**
 * src/services/civicIssuesCloud.ts — the browser half of Civic Issues cloud filing.
 *
 * A report is filed with the Firebase ID token of the signed-in citizen, and the
 * server derives the owner from that token. This module never sends a role, an
 * owner id or a status: those are the server's to decide.
 *
 * The outcome is a discriminated result, not a thrown string, because the UI has
 * to say something different for each case — and it must never say "filed" when
 * nothing reached the server.
 */
import { auth } from '../lib/firebase';
import { getIdToken } from 'firebase/auth';

export type CivicFieldError = { field?: string; message?: string };

export type CivicCloudOutcome =
  | { state: 'filed'; id: string; ref: string; status: string; createdAt: string }
  | { state: 'needs-signin' }
  | { state: 'server-not-configured' }
  | { state: 'rejected'; errors: CivicFieldError[] }
  | { state: 'forbidden' }
  | { state: 'unreachable'; message: string };

export interface CivicCloudReportInput {
  title: string;
  description: string;
  category: string;
  location: string;
  province: string;
  district?: string;
  lat?: number | null;
  lng?: number | null;
  evidence?: { name: string; type: string; bytes: number }[];
  complaintRef?: string;
}

async function authorizedFetch(path: string, init: RequestInit): Promise<Response | null> {
  const user = auth.currentUser;
  if (!user) return null;
  // A fresh token: a stale one is refused by the server as an invalid session.
  const token = await getIdToken(user, true);
  try {
    return await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers || {}) }
    });
  } catch {
    return null;
  }
}

function outcomeOf(res: Response, payload: any): CivicCloudOutcome {
  if (res.status === 201) {
    return { state: 'filed', id: String(payload.id), ref: String(payload.ref), status: String(payload.status), createdAt: String(payload.createdAt) };
  }
  if (res.status === 400) return { state: 'rejected', errors: Array.isArray(payload?.errors) ? payload.errors : [] };
  if (res.status === 401) return { state: 'needs-signin' };
  if (res.status === 403) return { state: 'forbidden' };
  if (res.status === 503 && payload?.error === 'AUTH_NOT_CONFIGURED') return { state: 'server-not-configured' };
  return { state: 'unreachable', message: 'The report service did not accept the filing.' };
}

/** File one report. Cloud success is only ever reported from a real 201. */
export async function fileCivicReport(input: CivicCloudReportInput): Promise<CivicCloudOutcome> {
  if (!auth.currentUser) return { state: 'needs-signin' };
  const res = await authorizedFetch('/api/civic/reports', { method: 'POST', body: JSON.stringify(input) });
  if (!res) return { state: 'unreachable', message: 'Could not reach the report service.' };
  let payload: any = null;
  try { payload = await res.json(); } catch { /* a non-JSON error page */ }
  return outcomeOf(res, payload);
}

/** The caller's own reports as the server sees them. null when not signed in. */
export async function listMyCivicReports(): Promise<CivicCloudReport[] | null> {
  if (!auth.currentUser) return null;
  const res = await authorizedFetch('/api/civic/reports/mine', { method: 'GET' });
  if (!res || !res.ok) return null;
  const payload = await res.json().catch(() => null);
  return Array.isArray(payload?.reports) ? payload.reports : null;
}

export interface CivicCloudReport {
  id: string;
  ref?: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  assignee?: string;
  audit?: { at: string; from: string | null; to: string; by: string; note?: string | null }[];
}

/**
 * Whether this build can file to the cloud right now — checked against the
 * server, not assumed. Used to label the storage banner truthfully.
 */
export async function civicCloudStatus(): Promise<{ signedIn: boolean; serverVerification: boolean; credentialSource: string }> {
  const signedIn = Boolean(auth.currentUser);
  let serverVerification = false;
  let credentialSource = 'unknown';
  try {
    const res = await fetch('/api/civic/auth-status');
    if (res.ok) {
      const payload = await res.json();
      serverVerification = Boolean(payload?.serverVerificationConfigured);
      credentialSource = String(payload?.credentialSource || 'none');
    }
  } catch { /* server unreachable; the caller shows the honest unknown */ }
  return { signedIn, serverVerification, credentialSource };
}
