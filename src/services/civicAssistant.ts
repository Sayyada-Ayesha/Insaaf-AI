/**
 * src/services/civicAssistant.ts — browser half of the Civic assistant.
 *
 * The server returns a discriminated analysis: either a service with a route and
 * draft, a clarification question, or an honest "not recognised" result. Nothing
 * in this module submits an application, and a portal link is never treated as
 * proof of submission.
 */

export type CivicLanguage = 'en' | 'roman_urdu' | 'ur';

export interface CivicAssistInput {
  description: string;
  language: CivicLanguage;
  city?: string;
  district?: string;
  province?: string;
  whatTried?: string;
  evidence?: string[];
}

export interface CivicStep { n: number; text: string }

export interface CivicSource { title: string; url: string | null; verification: string }

export interface CivicAssistResult {
  status: 'analysed' | 'clarify' | 'unsupported' | 'invalid';
  language: CivicLanguage;
  service: {
    id: string;
    label: string;
    confidence: 'high' | 'medium' | 'low' | 'none';
    matchedKeywords: string[];
  } | null;
  analysis?: {
    method: string;
    confidence: string;
    matchedKeywords: string[];
    alternatives?: string[];
    level?: string;
    why?: string;
    procedureVerification?: string;
  };
  location?: { city: string; district: string; province: string };
  authority?: { name: string; why: string };
  route?: {
    channel: string;
    label: string;
    url: string | null;
    urlVerified: boolean;
    note: string;
  } | null;
  steps: CivicStep[];
  documents: string[];
  limitations?: string;
  clarifyQuestion: string | null;
  draft: { text: string; language: CivicLanguage; placeholders: string[] } | null;
  sources: CivicSource[];
  disclosure: string;
  submission: { state: string; note: string; userReportedStates?: string[] };
  message?: string;
}

export type CivicAssistOutcome =
  | { state: 'ok'; result: CivicAssistResult }
  | { state: 'invalid'; message: string }
  | { state: 'rate-limited'; message: string }
  | { state: 'unreachable'; message: string };

export async function analyseCivicProblem(input: CivicAssistInput): Promise<CivicAssistOutcome> {
  let res: Response;
  try {
    res = await fetch('/api/civic/assist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });
  } catch {
    return { state: 'unreachable', message: 'The civic assistant could not be reached. Nothing was submitted.' };
  }

  let payload: any = null;
  try { payload = await res.json(); } catch { /* non-JSON error page */ }

  if (res.status === 429) {
    return { state: 'rate-limited', message: String(payload?.message || 'Too many requests right now. Please wait a moment and try again.') };
  }
  if (res.status === 400) {
    return { state: 'invalid', message: String(payload?.message || 'Please describe the problem in at least one sentence.') };
  }
  if (!res.ok || !payload) {
    return { state: 'unreachable', message: String(payload?.message || 'The civic assistant could not analyse this request. Nothing was submitted.') };
  }

  return { state: 'ok', result: payload as CivicAssistResult };
}
