import offlineKnowledge from '../../rag/knowledge/offlineKnowledge.json';
import { getDraftTemplate } from '../templates/legalDocumentTemplates';
import { fillCourtLineTokens } from '../lib/courtLineTokens';
import { getSettings } from '../lib/settings';
import { resolveResponseLanguage } from '../lib/responseLanguage';
import type { SupportedLanguage } from '../lib/i18n';
import type { EvidenceVerdict } from './storage';

let lastResponseSource: 'LIVE_AI' | 'OFFLINE_KNOWLEDGE' | 'ERROR' = 'LIVE_AI';
export function getLastResponseSource() { return lastResponseSource; }

/**
 * A failed API call is a statement about the server, not the citizen's internet.
 * This screen used to print "check your internet connection" for every non-2xx,
 * so a deployment whose /api/ai/chat route answered 404 told users their
 * connection was broken while the corpus was intact. The HTTP status decides the
 * wording; only a fetch that never received a response may blame the connection.
 */
export type BackendFailureKind = 'route-missing' | 'server-error' | 'timeout' | 'network';

export function backendFailureKind(status?: number | null, err?: unknown): BackendFailureKind {
  if (typeof status === 'number' && Number.isFinite(status) && status > 0) {
    if (status === 404 || status === 405 || status === 501) return 'route-missing';
    if (status >= 500) return 'server-error';
  }
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') return 'timeout';
  // fetch() rejects with TypeError only when no HTTP response arrived at all.
  if (err instanceof TypeError) return 'network';
  return 'server-error';
}

export function backendFailureNotice(kind: BackendFailureKind, lang: 'en' | 'roman_urdu', status?: number | null): string {
  const code = status ? ` (HTTP ${status})` : '';
  if (lang === 'roman_urdu') {
    if (kind === 'route-missing') return `⚠️ **Backend Ka Masla:** Insaaf AI ka jawab dene wala server is deployment par mojood nahi${code}. Yeh aap ke internet ka masla nahi — server deployment theek karna zaroori hai. Aap ka sawal khoya nahi hai.`;
    if (kind === 'timeout') return '⚠️ **Waqt Ki Had:** Server ne waqt par jawab nahi diya. Thori der baad dobara koshish karen — aap ka sawal khoya nahi hai.';
    if (kind === 'network') return '⚠️ **Rubat Ki Khabar:** Server tak rasai nahi hui. Apna internet check karen aur dobara koshish karen.';
    return `⚠️ **Server Ki Kharabi:** Backend ne server error diya${code}. Yeh aap ke internet ka masla nahi — thori der baad dobara koshish karen.`;
  }
  if (kind === 'route-missing') return `⚠️ **Backend Problem:** The Insaaf AI answer service is not available on this deployment${code}. This is a server/deployment fault, not your internet connection. Your question was not lost.`;
  if (kind === 'timeout') return '⚠️ **Timed Out:** The server did not answer in time. Please try again shortly — your question was not lost.';
  if (kind === 'network') return '⚠️ **Connection Notice:** The Insaaf AI server could not be reached. Please check your internet connection and try again in a moment.';
  return `⚠️ **Server Error:** The Insaaf AI backend returned a server error${code}. This is not your internet connection — please try again shortly.`;
}

/** A backend failure that keeps its HTTP status and cause for the caller's UI. */
export class ApiFailure extends Error {
  status: number | null;
  kind: BackendFailureKind;
  constructor(message: string, status: number | null, cause?: unknown) {
    super(message);
    this.name = 'ApiFailure';
    this.status = status;
    this.kind = backendFailureKind(status, cause);
  }
}

export function describeApiFailure(err: unknown, lang: 'en' | 'roman_urdu'): string {
  if (err instanceof ApiFailure) return backendFailureNotice(err.kind, lang, err.status);
  return backendFailureNotice(backendFailureKind(null, err), lang);
}

function getBoundedLocalKnowledge(userQuery: string, preferredLanguage?: SupportedLanguage): string | null {
  const query = userQuery.toLowerCase();

  // A single shared word is not a topic match: "tenant" alone used to pull the whole
  // tenancy digest under a "verified" banner, answering a question the app never
  // actually resolved. Requiring two of the entry's own words keeps the digest for
  // questions that genuinely name that subject.
  let content = "";

  for (const entry of offlineKnowledge) {
    const matched = entry.keywords.filter(kw => query.includes(kw)).length;
    if (matched >= 2) {
      content = entry.content;
      break;
    }
  }

  if (content) {
    // P0 — this block is answer prose, so it is never rendered in Urdu script:
    // an Urdu-script preference resolves to Roman Urdu, exactly as the server's
    // resolveChatLanguage does for the composed answer.
    const roman = resolveResponseLanguage(preferredLanguage, userQuery) === 'roman_urdu';
    const header = roman
      ? '**⚠️ AAM MAALOOMAT — AAP KE KHAAS HALAAT KE LIYE TASDEEQ SHUDA NAHI**\n\n*Neeche di gayi baat app ke aam notes hai, is sawal ka verified record nahi. Koi bhi percentage, muddat, fee ya registration ka rule likha ho to woh soobe-khaas hai; har soobe ka qanoon alag hai, is liye amal se pehle apne sheher ke authority se tasdeeq karein.*\n\n'
      : '**⚠️ GENERAL REFERENCE — NOT VERIFIED FOR YOUR CASE**\n\n*What follows is the app\'s built-in general notes, not a verified record answering this question. Any percentage, deadline, fee or registration requirement named below is province-specific; the laws differ by province, so confirm with the authority in your city before acting.*\n\n';
    const footer = roman
      ? '*Yeh tasdeeq shuda jawab nahi. Insaaf AI se dobara rabta kar ke apne soobe/shahar ka verified record maloom karein.*'
      : '*This is not a verified answer. Reconnect to Insaaf AI to get the verified record for your province and city.*';

    return `${header}${content}\n\n${footer}`;
  }

  return null;
}

export async function* streamLegalAdvice(
  userQuery: string, 
  history: { role: 'user' | 'model', text: string }[],
  preferredLanguage?: SupportedLanguage,
  signal?: AbortSignal,
  responseDetail?: 'concise' | 'standard' | 'detailed',
  mode?: 'islamic' | 'combined'
) {
  lastResponseSource = 'LIVE_AI';
  try {
    const s = getSettings();
    const overseasMode = s.overseasMode;
    const preferredCountry = s.preferredCountry || '';
    const answerLevel = s.answerLevel;
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuery, history, preferredLanguage, responseDetail, overseasMode, preferredCountry, answerLevel, ...(mode ? { mode } : {}) }),
      signal
    });

    if (!response.ok || !response.body) {
      // F3: if the request was canceled, propagate the abort instead of running fallbacks
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      // A 429 is a timing denial, not missing knowledge. Retrying /advice would burn a
      // second budget slot and the offline block would present a throttle as a normal answer.
      if (response.status === 429) {
        lastResponseSource = 'ERROR';
        let retryIn = 0;
        try {
          const j = await response.json();
          retryIn = Number(j?.retryAfterSeconds) || 0;
        } catch {
          retryIn = Number(response.headers.get('retry-after')) || 0;
        }
        const when = retryIn > 0 ? ` Please try again in about ${retryIn} second${retryIn === 1 ? '' : 's'}.` : ' Please try again in a moment.';
        // P0 — a throttle notice is still an answer: Urdu script never appears in it.
        const throttleMsg = resolveResponseLanguage(preferredLanguage, userQuery) === 'roman_urdu'
          ? `⏳ **Bohat zyada requests.** Aap ne lagatar kai sawal bheje hain.${retryIn > 0 ? ` Karib ${retryIn} second baad dobara koshish karen.` : ' Thori der baad dobara koshish karen.'} Aap ka sawal khoya nahi hai — thahar ke baad dobara bhejen.`
          : `⏳ **Too many requests.** You have sent several questions in quick succession.${when} Your question has not been lost — send it again after the wait.`;
        yield {
          chunk: throttleMsg,
          isOffline: true
        };
        return;
      }
      lastResponseSource = 'OFFLINE_KNOWLEDGE';
      // The second endpoint's own status is the truest description of the service:
      // if /chat answers 404, /advice answering 404 too means the whole API prefix
      // is absent from this deployment, not that the user is offline.
      let adviceStatus: number | null = null;
      let adviceError: unknown = null;
      // /api/ai/advice answers only from the legal corpus. Using it for a mode-selected
      // question would put a legal paragraph under an Islamic-source badge, so Islamic
      // and combined requests report the connection failure instead of re-routing.
      if (!mode) try {
        const nonStreamingRes = await fetch('/api/ai/advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userQuery, history, preferredLanguage, responseDetail, answerLevel, ...(mode ? { mode } : {}) }),
          signal
        });
        if (nonStreamingRes.ok) {
          const data = await nonStreamingRes.json();
          if (data && data.text) {
            yield { chunk: data.text, isOffline: true, ...(data.evidence ? { evidence: data.evidence } : {}) };
            return;
          }
        } else {
          adviceStatus = nonStreamingRes.status;
        }
      } catch (e) {
        adviceError = e;
        // Fallback to local
      }

      const fallback = mode ? null : getBoundedLocalKnowledge(userQuery, preferredLanguage);
      if (fallback) {
        // The digest is the browser's own general note, never a record answering this
        // question, so it is reported as 'none' and badged as general guidance.
        yield { chunk: fallback, isOffline: true, evidence: { verdict: 'none' } };
      } else {
        lastResponseSource = 'ERROR';
        const lang = resolveResponseLanguage(preferredLanguage, userQuery) === 'roman_urdu' ? 'roman_urdu' : 'en';
        const status = adviceStatus ?? response.status;
        yield {
          chunk: backendFailureNotice(backendFailureKind(status, adviceError), lang, status),
          isOffline: true
        };
      }
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.replace(/^data:\s*/, '').trim();
          if (dataStr === '[DONE]') return;
          try {
            const parsed = JSON.parse(dataStr);
            yield parsed;
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (err: any) {
    // F3: stale-request cancellation — propagate the abort so the caller stops silently
    if (signal?.aborted || (err && (err.name === 'AbortError' || err.code === 20))) {
      throw err;
    }
    console.warn("[Frontend] Backend stream error, using local fallback:", err);
    lastResponseSource = 'OFFLINE_KNOWLEDGE';

    // Attempt non-streaming endpoint fallback
    let adviceStatus: number | null = null;
    let adviceError: unknown = null;
    try {
      const nonStreamingRes = await fetch('/api/ai/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery, history, preferredLanguage, answerLevel: getSettings().answerLevel, ...(mode ? { mode } : {}) }),
        signal
      });
      if (nonStreamingRes.ok) {
        const data = await nonStreamingRes.json();
        if (data && data.text) {
          yield { chunk: data.text, isOffline: true, ...(data.evidence ? { evidence: data.evidence } : {}) };
          return;
        }
      } else {
        adviceStatus = nonStreamingRes.status;
      }
    } catch (e) {
      adviceError = e;
      // Fallback
    }

    const fallback = getBoundedLocalKnowledge(userQuery, preferredLanguage);
    if (fallback) {
      yield { chunk: fallback, isOffline: true, evidence: { verdict: 'none' } };
    } else {
      lastResponseSource = 'ERROR';
      const lang = resolveResponseLanguage(preferredLanguage, userQuery) === 'roman_urdu' ? 'roman_urdu' : 'en';
      yield {
        chunk: backendFailureNotice(backendFailureKind(adviceStatus, adviceError || err), lang, adviceStatus),
        isOffline: true
      };
    }
  }
}

export async function getLegalAdvice(
  userQuery: string, 
  history: { role: 'user' | 'model', text: string }[],
  preferredLanguage?: SupportedLanguage,
  signal?: AbortSignal
) {
  // P0 — the no-answer notice is answer prose: English only for English input,
  // Roman Urdu for Roman Urdu and Urdu-script input.
  const unavailable = resolveResponseLanguage(preferredLanguage, userQuery) === 'roman_urdu'
    ? 'Maaf karen, is waqt jawab taiyar nahi ho saka.'
    : "I'm sorry, I couldn't generate a response at this time.";
  try {
    const res = await fetch('/api/ai/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuery, history, preferredLanguage }),
      signal
    });
    if (!res.ok) {
      return getBoundedLocalKnowledge(userQuery, preferredLanguage) || unavailable;
    }
    const data = await res.json();
    return data.text || getBoundedLocalKnowledge(userQuery, preferredLanguage) || unavailable;
  } catch (err) {
    return getBoundedLocalKnowledge(userQuery, preferredLanguage) || unavailable;
  }
}

// Phase 5/6 — FREE-TEXT drafting: the user describes the document they need in
// plain language ("Draft a legal notice for recovery of unpaid money of Rs 20
// lakh"). The backend detects the document type, interprets the stated facts
// into professional paragraphs, marks only genuinely missing essentials, and
// returns a COMPLETE document — never a blank form.
export interface DraftFromRequestResult {
  html: string | null;
  type?: string;
  missingInformation?: string[];
  isOffline?: boolean;
}

export async function generateDraftFromRequest(requestText: string, preferredLanguage?: 'en' | 'ur'): Promise<DraftFromRequestResult> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestText, preferredLanguage })
  });
  if (!res.ok) throw new Error("The backend could not draft this document right now. Please try again.");
  const data = await res.json();
  return {
    html: typeof data.html === 'string' ? data.html : null,
    type: typeof data.type === 'string' ? data.type : undefined,
    missingInformation: Array.isArray(data.missingInformation) ? data.missingInformation.map(String) : [],
    isOffline: !!data.isOffline
  };
}

export async function generateDraft(type: string, details: string, categoryId?: string, preferredLanguage?: 'en' | 'ur' | 'roman_urdu', structure?: { heading?: string; courtLine?: string; authorityNote?: string; sections?: { label: string; hint?: string }[] }) {
  try {
    const lang = preferredLanguage || (typeof window !== 'undefined' ? (localStorage.getItem('insaaf_lang') as any) : undefined);
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, details, categoryId, preferredLanguage: lang, structure })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.html) return data.html;
    }
  } catch (err) {
    console.warn("generateDraft backend error, using local fallback", err);
  }

  // Parse key-value pairs from details string
  const fieldsObj: Record<string, string> = {};
  if (details) {
    details.split(',').forEach(part => {
      const idx = part.indexOf(':');
      if (idx !== -1) {
        const k = part.substring(0, idx).trim();
        const v = part.substring(idx + 1).trim();
        if (k && v) fieldsObj[k] = v;
      }
    });
  }

  return getDraftTemplate(type, details, categoryId, fieldsObj, structure);
}

export async function classifyDocument(text: string): Promise<"simple" | "complex"> {
  if (text.length > 5000 || text.includes("Proposal") || text.includes("Thesis") || text.includes("Chapter")) {
    return "complex";
  }
  return "simple";
}

// F8: Document change / edit loop. Returns the updated document plus
// "What changed" and "What you should do next" — the edit updates ONLY
// the requested part; nothing else is touched.
export interface DocumentEditResult {
  summary: string;
  html: string;
  nextSteps: string[];
  isOffline?: boolean;
}

export async function chatAboutDocument(context: string, history: { role: string; content: string }[], userInput: string, preferredLanguage?: string): Promise<DocumentEditResult> {
  try {
    const res = await fetch('/api/ai/document-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, history, userInput, preferredLanguage })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.html && typeof data.html === 'string') return data as DocumentEditResult;
    }
    throw new Error("Backend response not ok or missing html.");
  } catch (err) {
    console.error("chatAboutDocument backend error", err);
    // F8 local fallback: only a safe numeric value swap is applied locally
    // ("100,000 se 150,000 karo" / "change 100,000 to 150,000"). Any other
    // edit is reported honestly instead of faking a change.
    const numSwap = userInput.match(/([\d][\d,\.]*)\s*(?:se|ko|to)\s+([\d][\d,\.]*)/i);
    if (numSwap && numSwap[1] && numSwap[2] && numSwap[1] !== numSwap[2]) {
      const updated = context.split(numSwap[1]).join(numSwap[2]);
      if (updated !== context) {
        return {
          summary: `Changed "${numSwap[1]}" to "${numSwap[2]}" (local fallback — only this numeric change was applied).`,
          html: updated,
          nextSteps: ['Review the changed value carefully.', 'Other changes require an active AI connection — try again when the service is available.'],
          isOffline: true
        };
      }
    }
    throw new Error("This edit could not be applied right now. Please try the change again in a moment.");
  }
}

export async function analyzeDocument(text: string) {
  try {
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.fields && Array.isArray(data.fields)) {
        return data.fields;
      }
    }
    throw new Error("Backend response not ok or missing fields.");
  } catch (err) {
    console.error("analyzeDocument backend error", err);
    throw new Error("The document could not be read. Please try another file or a clearer scan.");
  }
}

// F6: Document Understanding / OCR assistant — analyzes uploaded document text
// and answers the user's specific question with type/dates/authorities/parties,
// summary, requirements, next steps, risks and OCR-quality warnings.
export interface DocumentUnderstandingResult {
  documentType: string | null;
  summary: string | null;
  parties: string[];
  dates: string[];
  deadlines?: string[];
  provisions?: string[];
  authorities: string[];
  requirements: string[];
  nextSteps: string[];
  risks: string[];
  caseNumbers: string[];
  amounts: string[];
  categorizedRisks: {
    deadline: string[];
    legalIssue: string[];
    missingInfo: string[];
    unusualClause: string[];
    ambiguousWording: string[];
    inconsistency: string[];
  } | null;
  relevantProcedure: string | null;
  answer: string | null;
  ocrQualityNote: string | null;
  isOffline?: boolean;
}

export async function understandDocument(
  text: string,
  question: string,
  preferredLanguage?: SupportedLanguage,
  ocrQuality?: number
): Promise<DocumentUnderstandingResult> {
  try {
    const res = await fetch('/api/ai/document-understanding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, question, preferredLanguage, ocrQuality })
    });
    if (res.ok) {
      const data = await res.json();
      return data as DocumentUnderstandingResult;
    }
    throw new Error("Backend response not ok.");
  } catch (err) {
    console.error("understandDocument backend error", err);
    return {
      documentType: null,
      summary: null,
      parties: [], dates: [], authorities: [], requirements: [], nextSteps: [], risks: [],
      caseNumbers: [], amounts: [],
      categorizedRisks: null,
      relevantProcedure: null,
      answer: resolveResponseLanguage(preferredLanguage, question || text) === 'roman_urdu'
        ? 'Document ka tajziya is waqt nahi ho saka. Dobara koshish karen ya document ka khaas text khud type karke bhejen.'
        : "The document could not be analyzed right now. Please try again or type the key text manually.",
      ocrQualityNote: null
    };
  }
}

// Document Comparison: structural diff between two uploaded documents.
export interface DocumentComparisonResult {
  summary: string;
  typeA?: string;
  typeB?: string;
  partiesChanged: string[];
  datesChanged: string[];
  amountsChanged: string[];
  obligationsAdded: string[];
  obligationsRemoved: string[];
  deadlinesChanged: string[];
  clausesAdded: string[];
  clausesRemoved: string[];
  overallRisk: string;
  riskLevel?: string;
  isOffline?: boolean;
}

export async function compareDocuments(
  textA: string,
  textB: string,
  preferredLanguage?: SupportedLanguage
): Promise<DocumentComparisonResult> {
  try {
    const res = await fetch('/api/ai/document-compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textA, textB, preferredLanguage })
    });
    if (res.ok) {
      const data = await res.json();
      return data as DocumentComparisonResult;
    }
    throw new Error("Backend response not ok.");
  } catch (err) {
    console.error("compareDocuments backend error", err);
    const roman = resolveResponseLanguage(preferredLanguage, `${textA}\n${textB}`) === 'roman_urdu';
    return {
      summary: roman
        ? 'Muqabla is waqt nahi ho saka. Dobara koshish karen.'
        : 'The comparison could not be completed. Please try again.',
      partiesChanged: [], datesChanged: [], amountsChanged: [],
      obligationsAdded: [], obligationsRemoved: [],
      deadlinesChanged: [], clausesAdded: [], clausesRemoved: [],
      overallRisk: roman ? 'Muqabla nahi ho saka' : 'Comparison failed',
      isOffline: true
    };
  }
}

// Readiness Checklist: structured checklist for a given document/application type.
// Fully local — no AI provider needed. Student-first: university types get priority.
export interface ReadinessChecklistItem {
  text: string;
  required: boolean;
}

export interface ReadinessChecklistResult {
  matchedType: string;
  label: string;
  items: ReadinessChecklistItem[];
  requiredItems: string[];
  optionalItems: string[];
  readinessScore: number;
  authority: string;
  studentSpecific: boolean;
  commonMistakes: string[];
  guidance: string;
  isOffline?: boolean;
}

export async function getReadinessChecklist(
  description: string,
  preferredLanguage?: SupportedLanguage
): Promise<ReadinessChecklistResult> {
  try {
    const res = await fetch('/api/ai/readiness-checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, preferredLanguage })
    });
    if (res.ok) {
      const data = await res.json();
      return data as ReadinessChecklistResult;
    }
    throw new Error("Backend response not ok.");
  } catch (err) {
    console.error("getReadinessChecklist backend error", err);
    return {
      matchedType: 'unknown',
      label: 'General Document',
      items: [],
      requiredItems: [],
      optionalItems: [],
      readinessScore: 0,
      authority: '',
      studentSpecific: false,
      commonMistakes: [],
      guidance: resolveResponseLanguage(preferredLanguage, description) === 'roman_urdu'
        ? 'Checklist is waqt nahi ban saki. Dobara koshish karen.'
        : 'The checklist could not be generated. Please try again.',
      isOffline: true
    };
  }
}

// F7: Document → Action → Draft.
// Drafts a legally structured response (reply / application / complaint /
// legal notice) from the actual uploaded document text. Facts are preserved
// from the source document only; missing information is marked, never invented.
export interface DocumentReplyResult {
  html: string | null;
  explanation: string;
  nextSteps: string[];
  submission: string | null;
  missingInformation: string[];
  isOffline?: boolean;
}

export type DocumentReplyType = 'reply' | 'application' | 'complaint' | 'legal_notice';

export async function draftDocumentReply(
  text: string,
  instruction: string,
  replyType: DocumentReplyType,
  language?: 'en' | 'ur' | 'roman_urdu',
  structure?: { heading?: string; courtLine?: string; authorityNote?: string; sections?: { label: string; hint?: string }[] }
): Promise<DocumentReplyResult> {
  try {
    const res = await fetch('/api/ai/document-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, instruction, replyType, language, structure })
    });
    if (res.ok) {
      const data = await res.json();
      return data as DocumentReplyResult;
    }
    throw new Error("Backend response not ok.");
  } catch (err) {
    console.error("draftDocumentReply backend error", err);
    // Local fallback: structure-driven skeleton that preserves the source text
    // and marks every unknown fact — never invents one.
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const heading = structure?.heading || replyType.replace('_', ' ').toUpperCase();
    // P11 hygiene — strip unresolved caption tokens (no field map in this flow)
    // so raw "[RECIPIENT]"-style template tokens are never printed.
    const courtLineClean = structure?.courtLine ? fillCourtLineTokens(structure.courtLine) : '';
    const sectionsHtml = (structure?.sections || []).length > 0
      ? structure!.sections!.map((s, i) => `<p style="margin-bottom: 12px;"><b>${i + 1}. ${s.label}:</b> <span style="border-bottom: 1px dotted #9ca3af;">[MISSING: ${s.label.toLowerCase()}]</span></p>`).join('')
      : '';
    const html = `<div style="font-family: 'Times New Roman', serif; text-align: justify; max-width: 800px; margin: 0 auto;">
<h2 style="text-align: center; text-transform: uppercase; text-decoration: underline;">${heading}</h2>
${courtLineClean ? `<p style="text-align: center; font-weight: bold;">${escapeHtml(courtLineClean)}</p>` : ''}
${structure?.authorityNote ? `<p style="font-style: italic; font-size: 0.9em; color: #4b5563;">${escapeHtml(structure.authorityNote)}</p>` : ''}
<p><b>Source document text (for reference):</b></p>
<p style="border: 1px dashed #9ca3af; padding: 12px; font-size: 0.9em;">${escapeHtml(text).replace(/\n/g, '<br/>').slice(0, 1200)}</p>
${sectionsHtml}
<p style="font-style: italic; font-size: 0.9em; color: #6b7280; margin-top: 40px;">Draft generated offline from the uploaded document text only. Fill every [MISSING: ...] field with accurate information before use.</p>
</div>`;
    const metaRoman = resolveResponseLanguage(language, instruction) === 'roman_urdu';
    return {
      html,
      explanation: metaRoman
        ? 'Yeh aap ke upload kiye gaye document ke nikale gaye text par mabni locally taiyar kiya gaya dhancha hai. Har [MISSING: ...] khaanay mein istemal se pehle durust maloomat bharen.'
        : 'This is a locally generated skeleton based only on the extracted text of your uploaded document. Every [MISSING: ...] field must be filled with accurate information before use.',
      nextSteps: metaRoman
        ? ['Har [MISSING: ...] khaana durust maloomat se parka karen.', 'Jama se pehle us idare ke asli format se tasdeeq karen.']
        : ['Fill every [MISSING: ...] field with accurate information.', 'Verify the exact format with the relevant office before submission.'],
      submission: null,
      missingInformation: metaRoman
        ? ['Source document mein maujood na hone wale waqiyat (draft mein [MISSING: ...] ke taur par nishan lagaye gaye)']
        : ['Facts not found in the source document (marked as [MISSING: ...] in the draft)'],
      isOffline: true
    };
  }
}

// F12/F13: Insaaf AI Legal Agent — legal Q&A + app self-knowledge with deep-link actions.
export interface AgentSource {
  title?: string;
  type?: string;
  key?: string;
  authority?: string;
  sourceURL?: string;
  /** F14: RAG domain id used for "Open in Insaaf AI Library" deep-links. */
  domain?: string;
}

export interface AgentReply {
  reply: string;
  actions: string[]; // valid internal route ids from the app route registry
  sources: AgentSource[];
  isOffline?: boolean;
  /** Structured Client Intake Summary — present on every agent reply. */
  intake?: IntakeSummary;
  answerLevel?: string;
  steps?: AgentStep[];
  /** Corrective-RAG evidence verdict block (absent on curated replies sent before retrieval). */
  evidence?: AgentEvidence;
  correction?: AgentCorrection;
  relevance?: string;
}

export interface AgentStep {
  n: number;
  key: string;
  label: string;
  detail: string;
}

export interface AgentEvidence {
  verdict?: EvidenceVerdict;
  reasons?: string[];
  domain?: string;
  supportedCount?: number;
  rejected?: number;
  scope?: Record<string, unknown>;
  quality?: Record<string, unknown>;
}

export interface AgentCorrection {
  attempts: number;
  maxAttempts: number;
  triggered: boolean;
  strategies: string[];
  detail?: unknown[];
}

/**
 * Facts carried from earlier turns of one conversation. The backend uses these
 * only for continuity and intake — the retrieval query stays the current message.
 */
export interface AgentContext {
  issue?: string;
  domain?: string;
  jurisdiction?: string;
  institution?: string;
  location?: string;
  facts?: string[];
  timeline?: string[];
  deadlines?: string[];
  documents?: string[];
  requestedOutcome?: string;
  missingFacts?: string[];
}

export interface IntakeSummary {
  issue: string;
  domain: string;
  jurisdiction: string;
  location: string;
  institution: string;
  keyFacts: string[];
  timeline: string[];
  urgency: string;
  documentsMentioned: string[];
  requestedOutcome: string;
  missingMandatoryFacts: string[];
  suggestedNextStep: string;
  /** true only when an escalation rule fires; a legal subject alone is never grounds. */
  professionalSupportNeeded: boolean | 'unclear';
  evidenceStatus: string;
}

export async function askLegalAgent(
  message: string,
  preferredLanguage?: 'en' | 'roman_urdu',
  context?: AgentContext | null,
  history: { role: string; content: string }[] = []
): Promise<AgentReply> {
  try {
    const s = getSettings();
    const res = await fetch('/api/ai/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message, preferredLanguage, history, overseasMode: s.overseasMode,
        preferredCountry: s.preferredCountry || '', answerLevel: s.answerLevel,
        ...(context ? { context } : {})
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.reply === 'string') {
        return {
          reply: data.reply,
          actions: Array.isArray(data.actions) ? data.actions : [],
          sources: Array.isArray(data.sources) ? data.sources : [],
          isOffline: !!data.isOffline,
          intake: data.intake || undefined,
          answerLevel: typeof data.answerLevel === 'string' ? data.answerLevel : undefined,
          steps: Array.isArray(data.steps) ? data.steps : undefined,
          evidence: data.evidence || undefined,
          correction: data.correction || undefined,
          relevance: typeof data.relevance === 'string' ? data.relevance : undefined
        };
      }
    }
    throw new ApiFailure(`Agent endpoint answered HTTP ${res.status}.`, res.status);
  } catch (err) {
    console.error("askLegalAgent backend error", err);
    // The caller (Government Services, Agent) needs the real cause: an absent
    // route is not a user connection problem and must not be reported as one.
    if (err instanceof ApiFailure) throw err;
    throw new ApiFailure("The Legal Agent could not respond right now.", null, err);
  }
}

export interface LawSearchResult {
  chunkId: string | null;
  docId: string | null;
  provision: { type: string; number: string } | null;
  title: string | null;
  authority: string | null;
  legalStatus: string | null;
  sourceUrl: string | null;
  score: number;
  exactMatch: boolean;
  excerpt: string;
}

/**
 * Search the official text itself. Nothing here is model-written: each result is a
 * corpus record with the canonical source URL that was indexed with it.
 */
export async function searchLaw(query: string, limit = 10): Promise<{ results: LawSearchResult[]; domain: string; relevance: string }> {
  const trimmed = String(query || '').trim();
  if (!trimmed) throw new Error('Enter what you want to search for.');
  const res = await fetch('/api/ai/law-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: trimmed, limit })
  });
  if (!res.ok) {
    let reason = 'Legal search could not run. Please try again.';
    try {
      const j = await res.json();
      if (j && typeof j.error === 'string') reason = j.error;
    } catch { /* keep the generic notice */ }
    throw new Error(reason);
  }
  const data = await res.json();
  return {
    results: Array.isArray(data.results) ? data.results : [],
    domain: typeof data.domain === 'string' ? data.domain : 'unknown',
    relevance: typeof data.relevance === 'string' ? data.relevance : 'none'
  };
}

export interface IncidentDocuments {
  lang: string;
  complaint: string;
  brief: string;
  evidence: { verdict: string | null; domain: string | null; provisionsListed: number };
}

/**
 * Complaint for FIR registration + lawyer case summary, assembled by code from the
 * reviewed intake. Provisions come from server-side retrieval only.
 */
export async function buildIncidentDocuments(
  narrative: string,
  intake?: Partial<IntakeSummary> | Record<string, unknown> | null,
  preferredLanguage?: 'en' | 'roman_urdu'
): Promise<IncidentDocuments> {
  const trimmed = String(narrative || '').trim();
  if (!trimmed) throw new Error('Describe what happened first.');
  const res = await fetch('/api/ai/incident-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      narrative: trimmed,
      ...(intake ? { intake } : {}),
      ...(preferredLanguage ? { preferredLanguage } : {})
    })
  });
  if (!res.ok) {
    let reason = 'The documents could not be prepared. Please try again.';
    try {
      const j = await res.json();
      if (j && typeof j.error === 'string') reason = j.error;
    } catch { /* keep the generic notice */ }
    throw new Error(reason);
  }
  const data = await res.json();
  if (typeof data.complaint !== 'string' || typeof data.brief !== 'string') {
    throw new Error('The documents could not be prepared. Please try again.');
  }
  return {
    lang: typeof data.lang === 'string' ? data.lang : 'en',
    complaint: data.complaint,
    brief: data.brief,
    evidence: data.evidence && typeof data.evidence === 'object' ? data.evidence : { verdict: null, domain: null, provisionsListed: 0 }
  };
}

export type TranslateDirection = 'en-to-ur' | 'ur-to-en' | 'roman-to-ur';

export interface TranslateResult {
  translatedText: string | null;
  direction: TranslateDirection;
  isOffline: boolean;
  supported: boolean;
  error: string | null;
}

export async function translateText(
  text: string,
  direction: TranslateDirection
): Promise<TranslateResult> {
  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, direction })
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      // An error is an error: nothing is reported as translated, and the caller
      // shows the server's own explanation instead of inventing one.
      return {
        translatedText: null,
        direction,
        isOffline: true,
        supported: false,
        error: typeof data.error === 'string' ? data.error : 'Translation failed.'
      };
    }
    return {
      translatedText: typeof data.translatedText === 'string' ? data.translatedText : null,
      direction: (data.direction || direction) as TranslateDirection,
      isOffline: !!data.isOffline,
      supported: true,
      error: null
    };
  } catch (err) {
    console.error("translateText backend error", err);
    return {
      translatedText: null, direction, isOffline: true, supported: false,
      error: 'Translation service could not be reached.'
    };
  }
}