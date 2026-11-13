// ============================================================================
// MODEL INFERENCE CLIENT — the one door between the Express backend and a
// fine-tuned model, whichever transport serves it.
//
// Transports (`INSAF_MODEL_PROVIDER`):
//   deterministic  (default) the corpus composer in server/ownedModel.js answers;
//                  nothing is inferred, and no model is ever implied.
//   cloudflare     Cloudflare Workers AI serves `@cf/qwen/qwen3.8-27b` over its
//                  REST API. This is a hosted general model, NOT our fine-tuned
//                  Qwen2.5 adapter, and every provider object says so.
//   gradio         the Hugging Face ZeroGPU Space in hf-space/ is called with the
//                  official @gradio/client and its own /generate endpoint.
//   lora-service   the private Python service in training/inference/ is called
//                  through server/loraProvider.js (the pre-existing transport).
//
// Every transport returns the SAME validated shape, because all three feed the
// same contract (training/contracts/legal_answer_contract_v1.json) and the same
// formatter, so the chat, advice and agent routes cannot drift apart:
//
//   answerWithModel() -> { ok:true, text, sourceUrls, provider, evidence, validation }
//                     | { ok:false, reason, ... }
//
// Rules enforced here:
//   * The model only ever sees evidence the RAG layer actually retrieved.
//   * The model is never asked for a URL. validateLoraAnswer() rejects any URL it
//     writes that is not a supplied record's URL, and formatLoraAnswer() emits
//     links taken from the records themselves. Backend metadata stays authoritative.
//   * Everything fails closed to the deterministic composer. A timeout, an empty
//     Space, a missing token, a missing package or a malformed reply is a
//     {ok:false} — never a partial answer and never a silent base-model answer.
//   * Credentials live in the server environment only (HF_TOKEN, never VITE_*).
//     History is trimmed and credential-shaped lines are dropped before anything
//     leaves the machine.
// ============================================================================

import {
  answerWithLora,
  attachTrustedUrls,
  buildLoraEvidence,
  formatLoraAnswer,
  loraEnabled,
  loraHealth,
  loraServiceConfigured,
  validateLoraAnswer,
} from './loraProvider.js';

export const MODEL_PROVIDERS = ['deterministic', 'cloudflare', 'gradio', 'lora-service'];

const DEFAULT_CLOUDFLARE_MODEL = '@cf/qwen/qwen3.8-27b';
// The model id becomes part of a URL path, so it is validated instead of encoded.
// Workers AI ids are `@cf/<vendor>/<model>` (two path segments after the @); a
// value that could escape that shape is refused rather than turned into a request.
const CLOUDFLARE_MODEL_RE = /^@[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*){1,3}$/i;

// INSAF_MODEL_PROVIDER wins when it names a transport. When it is unset, the
// pre-existing INSAF_LORA_ENABLED=1 switch still selects the lora-service
// transport, so deployments and suites written before this module keep working.
const PROVIDER = () => {
  const explicit = (process.env.INSAF_MODEL_PROVIDER || '').trim().toLowerCase();
  if (MODEL_PROVIDERS.includes(explicit)) return explicit;
  return process.env.INSAF_LORA_ENABLED === '1' ? 'lora-service' : 'deterministic';
};
const SPACE_ID = () => (process.env.HF_SPACE_ID || '').trim();
const HF_TOKEN = () => (process.env.HF_TOKEN || '').trim();
const CF_ACCOUNT_ID = () => (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const CF_API_TOKEN = () => (process.env.CLOUDFLARE_API_TOKEN || '').trim();
const CF_MODEL_ID = () => (process.env.CLOUDFLARE_MODEL_ID || '').trim() || DEFAULT_CLOUDFLARE_MODEL;
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

const TIMEOUT_MS = () => {
  const provider = modelProviderName();
  const fallback = provider === 'cloudflare' ? 45000 : 120000;
  const value = Number(process.env.INSAF_MODEL_TIMEOUT_MS || fallback);
  if (!Number.isFinite(value)) return fallback;
  // Vercel Hobby stops the function at 60 s and retrieval runs before the model,
  // so the ceiling leaves headroom for the rest of the request.
  const ceiling = process.env.VERCEL ? 50000 : 300000;
  return Math.min(Math.max(value, 5000), ceiling);
};

const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CHARS = 600;

// A line that looks like a credential must never leave the machine, even if a
// citizen pasted it into the chat. Narrow on purpose: it matches "password: ...",
// "otp 123456", "api key = ..." and nothing else.
const SECRET_LINE = /\b(password|passcode|pass\s?word|otp|one[- ]time\s+code|pin|api[_-]?\s?key|secret|token)\b\s*[:=]?\s*\S+/i;

export function modelProviderName() {
  const provider = PROVIDER();
  return MODEL_PROVIDERS.includes(provider) ? provider : 'deterministic';
}

/** True only when a transport is selected AND configured. Never a guess. */
export function modelInferenceEnabled() {
  const provider = modelProviderName();
  if (provider === 'cloudflare') return Boolean(CF_ACCOUNT_ID() && CF_API_TOKEN());
  if (provider === 'gradio') return Boolean(SPACE_ID());
  if (provider === 'lora-service') return loraEnabled() && loraServiceConfigured();
  return false;
}

export function modelInferenceConfigured() {
  const provider = modelProviderName();
  if (provider === 'cloudflare') return Boolean(CF_ACCOUNT_ID() && CF_API_TOKEN());
  if (provider === 'gradio') return Boolean(SPACE_ID());
  if (provider === 'lora-service') return loraServiceConfigured();
  return false;
}

/** The label the UI and health route must show for what actually generates text. */
export function activeProviderLabel() {
  const provider = modelProviderName();
  if (provider === 'cloudflare' && modelInferenceEnabled()) return 'cloudflare-workers-ai';
  if (provider === 'gradio' && SPACE_ID()) return 'huggingface-zerogpu-space';
  if (provider === 'lora-service' && modelInferenceEnabled()) return 'lora-inference-service';
  return 'deterministic-corpus-composer';
}

/**
 * Only the prose of the last few turns, trimmed, with credential-shaped lines
 * dropped. No ids, no emails, no document text: the backend never puts those in
 * history, and this filter keeps a pasted secret from leaving the machine.
 */
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const turns = [];
  for (const item of history.slice(-MAX_HISTORY_TURNS)) {
    const role = String(item?.role || '').toLowerCase();
    if (role !== 'user' && role !== 'assistant') continue;
    let content = String(item?.content ?? item?.text ?? '').trim();
    if (!content) continue;
    content = content
      .split(/\r?\n/)
      .filter((line) => !SECRET_LINE.test(line))
      .join('\n')
      .slice(0, MAX_HISTORY_CHARS);
    if (content) turns.push({ role, content });
  }
  return turns;
}

function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: `${what} did not answer within ${ms} ms` }), ms);
  });
  return Promise.race([
    Promise.resolve(promise)
      .then((value) => ({ ok: true, value }))
      .catch((err) => ({ ok: false, reason: `${what} failed: ${err?.message || err}` })),
    timeout,
  ]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// Cloudflare Workers AI transport
// ---------------------------------------------------------------------------

const CLOUDFLARE_LANGUAGE = {
  en: 'Write every field in clear, simple English.',
  roman_urdu:
    'Write every field in ROMAN URDU (Urdu written in Latin letters). Never use Urdu script.',
  ur: 'Write every field in Urdu script (اردو). Keep section numbers exact.',
};

const CLOUDFLARE_LEVEL = {
  beginner: 'Use everyday words, 3-5 short sentences, no legal jargon.',
  intermediate: 'Use plain language, 5-7 sentences, name the law only where the evidence names it.',
  advanced: 'Be precise and concise; name provisions only where they appear in the evidence.',
};

/**
 * One strict JSON contract, the same fields the runtime validator checks. The
 * model is never asked for a URL: the server attaches each cited record's own URL.
 */
function buildCloudflareMessages({ question, evidence, language, answerLevel, history }) {
  const languageRule =
    CLOUDFLARE_LANGUAGE[language === 'roman_urdu' || language === 'ur' ? language : 'en'];
  const levelRule = CLOUDFLARE_LEVEL[answerLevel] || CLOUDFLARE_LEVEL.beginner;

  const system = `You are the legal-information assistant inside Insaaf AI (Pakistan).
You answer ONLY from the EVIDENCE records supplied in the user message. Treat them as the complete record: if they do not state a fact, you do not know it.

Return ONE JSON object and nothing else - no markdown fence, no commentary before or after:
{"answer":"...","law":"...","procedure":"...","nextStep":"...","limitation":"...","sources":["E1"]}

Field rules:
- answer (required): answer the question first, directly, in plain language. ${levelRule}
- law (required): the Act/Ordinance/Rule and section that the evidence names. If the evidence names none, say so; never invent a section, case or citation.
- procedure (optional): the practical path the evidence describes.
- nextStep (required): the concrete office, portal or forum the evidence names. If none is named, say to confirm with the relevant court/office and do not invent an authority, phone number or fee.
- limitation (required): one sentence on what the evidence does not cover for this question.
- sources (required): at least one id from the EVIDENCE list (E1, E2, ...). Use only ids that were supplied.
- NEVER write URLs. NEVER invent statutes, deadlines, fees, phone numbers, case numbers or authorities.
- If the evidence cannot answer the question, say that honestly in answer and still cite the closest supplied record.
- ${languageRule}`;

  const evidenceBlock = evidence
    .map(
      (item) =>
        `[${item.id}] Title: ${item.title}\n` +
        `Authority: ${item.authority || 'not stated'}\n` +
        `Jurisdiction: ${item.jurisdiction || 'not stated'}\n` +
        `Provision: ${item.provision || 'not stated'}\n` +
        `Text: ${item.text}`
    )
    .join('\n\n');

  const user = `QUESTION:\n${question}\n\nEVIDENCE (retrieved from the verified Pakistani legal corpus):\n\n${evidenceBlock}`;

  return [
    { role: 'system', content: system },
    ...sanitizeHistory(history),
    { role: 'user', content: user },
  ];
}

/** Parse the contract JSON out of a reply that may still carry a fence or prose. */
export function extractContractJson(text) {
  if (typeof text !== 'string') return null;
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Tolerate only representation differences a model routinely produces (a joined
 * string instead of an array, `next_step` spelling). Facts are never repaired:
 * an answer that still fails the contract is rejected.
 */
function normalizeContractAnswer(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const out = { ...parsed };
  if (out.next_step && !out.nextStep) out.nextStep = out.next_step;
  if (typeof out.sources === 'string') {
    out.sources = out.sources.match(/E\d+/g) || [];
  }
  for (const field of ['answer', 'law', 'procedure', 'nextStep', 'limitation']) {
    if (Array.isArray(out[field])) out[field] = out[field].join('\n');
  }
  return out;
}

function describeCloudflareError(status, body) {
  const detail = Array.isArray(body?.errors)
    ? body.errors.map((e) => e?.message).filter(Boolean).join('; ')
    : '';
  if (status === 401) return 'Cloudflare rejected the API token (HTTP 401)';
  if (status === 403) return `Cloudflare refused access to Workers AI (HTTP 403)${detail ? `: ${detail}` : ''}`;
  if (status === 429) return 'Cloudflare Workers AI free daily allocation is exhausted or rate limited (HTTP 429)';
  if (status === 400) return `Cloudflare rejected the request (HTTP 400)${detail ? `: ${detail}` : ''}`;
  return `Cloudflare returned HTTP ${status}${detail ? `: ${detail}` : ''}`;
}

async function cloudflareFetch(url, init, fetchImpl, timeoutMs, what) {
  const doFetch = fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { ok: true, res, body };
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { ok: false, reason: `${what} did not answer within ${timeoutMs} ms` };
    }
    return { ok: false, reason: `${what} failed: ${err?.message || err}` };
  } finally {
    clearTimeout(timer);
  }
}

/** One generation call. Returns {ok:false, reason} on every failure. */
async function callCloudflare({ messages, fetchImpl = null, timeoutMs = TIMEOUT_MS() }) {
  const account = CF_ACCOUNT_ID();
  const token = CF_API_TOKEN();
  const model = CF_MODEL_ID();
  if (!account) return { ok: false, reason: 'CLOUDFLARE_ACCOUNT_ID is not configured' };
  if (!token) return { ok: false, reason: 'CLOUDFLARE_API_TOKEN is not configured' };
  if (!CLOUDFLARE_MODEL_RE.test(model)) {
    return { ok: false, reason: 'CLOUDFLARE_MODEL_ID is not a valid Workers AI model id' };
  }

  const started = Date.now();
  const url = `${CF_API_BASE}/accounts/${encodeURIComponent(account)}/ai/run/${model}`;
  const called = await cloudflareFetch(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        temperature: 0.2,
        max_tokens: 900,
        stream: false,
      }),
    },
    fetchImpl,
    timeoutMs,
    'Cloudflare Workers AI'
  );
  if (!called.ok) return called;

  const { res, body } = called;
  if (!res.ok || body?.success === false) {
    return {
      ok: false,
      status: res.status,
      reason: describeCloudflareError(res.status, body),
    };
  }
  const result = body?.result || {};
  const content = result?.choices?.[0]?.message?.content ?? result?.response;
  if (typeof content !== 'string' || !content.trim()) {
    return { ok: false, status: res.status, reason: 'Cloudflare returned no answer text' };
  }
  return {
    ok: true,
    content,
    usage: result?.usage || null,
    model,
    latencyMs: Date.now() - started,
  };
}

/**
 * Ask Workers AI for one grounded answer. `fetchImpl` is injectable so the
 * focused suite runs without a Cloudflare account.
 */
async function answerWithCloudflare({
  question,
  chunks,
  language,
  answerLevel,
  history,
  navAllowList,
  fetchImpl = null,
}) {
  if (!chunks || !chunks.length) return { ok: false, reason: 'no evidence to answer from' };

  const evidence = buildLoraEvidence(chunks);
  const messages = buildCloudflareMessages({ question, evidence, language, answerLevel, history });
  const called = await callCloudflare({ messages, fetchImpl });
  const provider = {
    provider: 'cloudflare-workers-ai',
    model: called.model || CF_MODEL_ID(),
    transport: 'cloudflare-rest',
    stub: false,
    hosted: true,
    fineTuned: false,
  };
  if (!called.ok) return { ...called, provider };

  const parsed = normalizeContractAnswer(extractContractJson(called.content));
  if (!parsed) {
    return {
      ok: false,
      reason: 'the model did not return the answer JSON contract',
      provider: { ...provider, latencyMs: called.latencyMs },
    };
  }

  const validation = validateLoraAnswer(parsed, evidence);
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.reason,
      validation,
      provider: { ...provider, latencyMs: called.latencyMs },
    };
  }

  const attached = attachTrustedUrls(parsed, evidence);
  return {
    ok: true,
    text: formatLoraAnswer(parsed, language, evidence),
    sourceUrls: attached.sourceUrls || [],
    provider: {
      ...provider,
      latencyMs: called.latencyMs,
      tokens: called.usage?.total_tokens ?? null,
    },
    evidence,
    validation,
    navIds: extractNavIds(parsed, navAllowList),
  };
}

/**
 * Probe account + model availability without spending Neurons: Workers AI's
 * model search needs the same token and proves both, and nothing is loaded
 * ahead of a request because the platform is serverless.
 */
async function probeCloudflare({ fetchImpl = null } = {}) {
  const account = CF_ACCOUNT_ID();
  const token = CF_API_TOKEN();
  const model = CF_MODEL_ID();
  if (!account) return { reachable: false, reason: 'CLOUDFLARE_ACCOUNT_ID is not configured' };
  if (!token) return { reachable: false, reason: 'CLOUDFLARE_API_TOKEN is not configured' };
  if (!CLOUDFLARE_MODEL_RE.test(model)) {
    return { reachable: false, reason: 'CLOUDFLARE_MODEL_ID is not a valid Workers AI model id' };
  }

  const url = `${CF_API_BASE}/accounts/${encodeURIComponent(account)}/ai/models/search?search=${encodeURIComponent(model)}`;
  const called = await cloudflareFetch(
    url,
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
    fetchImpl,
    TIMEOUT_MS(),
    'Cloudflare model lookup'
  );
  if (!called.ok) return { reachable: false, reason: called.reason };
  const { res, body } = called;
  if (!res.ok || body?.success === false) {
    return { reachable: false, reason: describeCloudflareError(res.status, body) };
  }
  const names = Array.isArray(body?.result)
    ? body.result.map((entry) => String(entry?.name || ''))
    : [];
  const available = names.includes(model);
  return {
    reachable: true,
    modelAvailable: available,
    modelId: model,
    reason: available ? null : `Workers AI is reachable but did not list ${model} for this account`,
  };
}

/**
 * Connect with the official Gradio client. Returns {ok:false} when the package is
 * absent instead of throwing: a deployment that forgot `npm install` must degrade
 * to the deterministic composer, not crash the server.
 */
async function connectSpace(spaceId, token) {
  let Client;
  try {
    ({ Client } = await import('@gradio/client'));
  } catch {
    return {
      ok: false,
      reason: 'the @gradio/client package is not installed on this server (run: npm install @gradio/client)',
    };
  }
  const options = token ? { token } : {};
  const connected = await withTimeout(Client.connect(spaceId, options), TIMEOUT_MS(), 'HF Space connection');
  if (!connected.ok) return connected;
  return { ok: true, app: connected.value };
}

/**
 * Ask the ZeroGPU Space for one grounded answer.
 * `connect` is injectable so the wiring test can run without a live Space.
 */
async function answerWithGradioSpace({ question, chunks, language, answerLevel, history, navAllowList, connect }) {
  if (!SPACE_ID()) return { ok: false, reason: 'HF_SPACE_ID is not configured' };
  if (!chunks || !chunks.length) return { ok: false, reason: 'no evidence to answer from' };

  const evidence = buildLoraEvidence(chunks);
  const connector = connect || ((id, token) => connectSpace(id, token));
  let connection;
  try {
    connection = await connector(SPACE_ID(), HF_TOKEN() || null);
  } catch (err) {
    return { ok: false, reason: `HF Space connection failed: ${err?.message || err}` };
  }
  if (!connection || !connection.ok) {
    return { ok: false, reason: connection?.reason || 'HF Space connection failed' };
  }
  const app = connection.app || connection.client;
  if (!app || typeof app.predict !== 'function') {
    return { ok: false, reason: 'the Gradio client returned no callable app' };
  }

  const payload = {
    question,
    evidence,
    language: language === 'roman_urdu' || language === 'ur' ? language : 'en',
    answer_level: answerLevel || 'standard',
    history: sanitizeHistory(history),
  };

  const called = await withTimeout(app.predict('/generate', payload), TIMEOUT_MS(), 'model generation');
  if (!called.ok) return { ok: false, reason: called.reason };

  const result = called.value;
  const body = Array.isArray(result?.data) ? result.data[0] : result;
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'the Space returned no answer object' };
  }
  if (body.error) {
    return { ok: false, reason: `the Space reported: ${String(body.error).slice(0, 300)}`, provider: body.provider || null };
  }

  const provider = body.provider || {};
  if (provider.stub === true) {
    return { ok: false, reason: 'the Space is in stub mode; no model was used', provider };
  }

  // Same contract and same evidence rule as the local service. An answer that
  // fails is not shown at all.
  const validation = validateLoraAnswer(body, evidence);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason, validation, provider };
  }

  const attached = attachTrustedUrls(body, evidence);
  const navIds = extractNavIds(body, navAllowList);

  return {
    ok: true,
    text: formatLoraAnswer(body, language, evidence),
    sourceUrls: attached.sourceUrls || [],
    provider: {
      ...provider,
      provider: provider.provider || 'huggingface-zerogpu-space',
      transport: 'gradio-space',
      latencyMs: body.latencyMs,
      tokens: body.tokens,
    },
    evidence,
    validation,
    navIds,
  };
}

/**
 * A NAV marker is only accepted when the id exists in the caller's allow-list,
 * so the model can never invent a route. Mirrors the agent route's own parser.
 */
export function extractNavIds(body, allowList) {
  if (!Array.isArray(allowList) || !allowList.length) return [];
  const text = [body?.answer, body?.nextStep, body?.procedure].filter(Boolean).join('\n');
  const match = text.match(/NAV:\s*([a-z][a-z_ ]*)/i);
  if (!match) return [];
  return match[1]
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter((id, index, all) => id && allowList.includes(id) && all.indexOf(id) === index);
}

/**
 * The one call site every answer route uses. Dispatches by provider, always
 * returns a validated result or an honest failure.
 */
export async function answerWithModel({
  question,
  chunks,
  language = 'en',
  answerLevel = 'standard',
  history = null,
  navAllowList = null,
  connect = null,
  fetchImpl = null,
} = {}) {
  const provider = modelProviderName();
  if (provider === 'deterministic') {
    return { ok: false, reason: 'INSAF_MODEL_PROVIDER=deterministic: the corpus composer generated this answer' };
  }
  if (provider === 'lora-service') {
    const result = await answerWithLora({ question, chunks, language, answerLevel });
    return { ...result, navIds: result.ok ? extractNavIds({ answer: result.text }, navAllowList) : [] };
  }
  if (provider === 'cloudflare') {
    return answerWithCloudflare({ question, chunks, language, answerLevel, history, navAllowList, fetchImpl });
  }
  return answerWithGradioSpace({ question, chunks, language, answerLevel, history, navAllowList, connect });
}

/**
 * Truthful provider state for /api/ai/health and /api/ai/lora-status.
 * `probe:true` really calls the provider; without it this reports configuration
 * only. Workers AI is serverless, so `modelLoaded` stays false and the measured
 * facts are `modelAvailable` and `reachable`.
 */
export async function modelInferenceHealth({ probe = false, connect = null, fetchImpl = null } = {}) {
  const provider = modelProviderName();
  const base = {
    provider,
    activeProviderLabel: activeProviderLabel(),
    enabled: modelInferenceEnabled(),
    configured: modelInferenceConfigured(),
    timeoutMs: TIMEOUT_MS(),
  };

  if (provider === 'cloudflare') {
    const cfBase = {
      ...base,
      accountConfigured: Boolean(CF_ACCOUNT_ID()),
      tokenConfigured: Boolean(CF_API_TOKEN()),
      modelId: CF_MODEL_ID(),
      fineTuned: false,
      note: 'Workers AI is serverless: nothing is loaded ahead of a request',
    };
    if (!modelInferenceConfigured()) {
      return {
        ...cfBase,
        reachable: false,
        modelLoaded: false,
        modelAvailable: false,
        reason: 'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are both required',
      };
    }
    if (!probe) {
      return { ...cfBase, reachable: null, modelLoaded: false, modelAvailable: null, reason: 'not probed' };
    }
    const probed = await probeCloudflare({ fetchImpl });
    return {
      ...cfBase,
      reachable: probed.reachable,
      modelLoaded: false,
      modelAvailable: probed.modelAvailable === true,
      modelId: probed.modelId || cfBase.modelId,
      reason: probed.reason || null,
    };
  }

  const gradioBase = {
    ...base,
    spaceId: provider === 'gradio' ? SPACE_ID() || null : null,
    tokenConfigured: provider === 'gradio' ? Boolean(HF_TOKEN()) : null,
  };

  if (provider === 'lora-service') {
    return { ...gradioBase, ...(await loraHealth()) };
  }
  if (provider !== 'gradio') {
    return {
      ...gradioBase,
      reachable: false,
      modelLoaded: false,
      adapterAttached: false,
      reason: 'INSAF_MODEL_PROVIDER=deterministic: answers come from the corpus composer, not from model weights',
    };
  }
  if (!SPACE_ID()) {
    return {
      ...gradioBase,
      reachable: false,
      modelLoaded: false,
      adapterAttached: false,
      reason: 'HF_SPACE_ID is not configured',
    };
  }
  if (!probe) {
    return {
      ...gradioBase,
      reachable: null,
      modelLoaded: false,
      adapterAttached: false,
      reason: 'not probed',
    };
  }

  const connector = connect || ((id, token) => connectSpace(id, token));
  let connection;
  try {
    connection = await connector(SPACE_ID(), HF_TOKEN() || null);
  } catch (err) {
    return { ...gradioBase, reachable: false, modelLoaded: false, reason: `connection failed: ${err?.message || err}` };
  }
  if (!connection || !connection.ok) {
    return { ...gradioBase, reachable: false, modelLoaded: false, reason: connection?.reason || 'connection failed' };
  }
  const app = connection.app || connection.client;
  const probed = await withTimeout(app.predict('/status'), TIMEOUT_MS(), 'Space status');
  if (!probed.ok) {
    return { ...gradioBase, reachable: false, modelLoaded: false, reason: probed.reason };
  }
  const status = Array.isArray(probed.value?.data) ? probed.value.data[0] : probed.value;
  return {
    ...gradioBase,
    reachable: true,
    modelLoaded: status?.modelLoaded === true,
    adapterAttached: status?.adapterAttached === true,
    baseModel: status?.baseModel || null,
    baseRevision: status?.baseRevision || null,
    loraLayers: status?.loraLayers || 0,
    device: status?.device || null,
    lastGenerationAt: status?.lastGenerationAt || null,
    error: status?.error || null,
    reason: status?.modelLoaded === true ? null : status?.error || 'the Space is running but reported no loaded model',
  };
}
