// ============================================================================
// OPTIONAL LORA-BACKED ANSWER PROVIDER.
//
// This is the client side of the trained Qwen2.5-7B-Instruct LoRA adapter
// (track: legal_own_v1). It talks to the private Python inference service in
// training/inference/insaf_lora_service.py over a configurable HTTP URL.
//
// Rules this file enforces, and why they exist:
//
//   * The provider is OFF unless INSAF_LORA_ENABLED=1. The trained adapter has
//     never produced the application's answer contract, so it must not take
//     over the production chat path by accident.
//   * The model NEVER answers without retrieved evidence. The evidence is
//     supplied by the RAG layer and the model is asked to name the records it
//     used; an answer that names a record that was not supplied is rejected.
//   * Mandatory fields are checked before anything is displayed. A reply that
//     is missing fields, malformed, or cites a provision that is not in the
//     supplied evidence is REJECTED, and the caller falls back to the
//     deterministic composer. There is no "show it anyway" path.
//   * The model NEVER invents a URL or a quotation. The required-field schema
//     and the three detectors are read from the one contract file that the
//     prompt, the parser, the Python validator and the held-out evaluator also
//     read, so the runtime gate and the evaluation cannot drift apart. The
//     trusted URL of a retrieved record is attached by this server; the model
//     is only asked for the record ids it used.
//   * The mandatory legal disclaimer is appended by this server, never taken
//     from the model's text.
//   * A public tunnel gates EVERY route. The inference URL is usually an ngrok address
//     that requires HTTP Basic Auth before the request reaches this service, so the
//     provider sends `Authorization` on /health and /generate as well as
//     `X-INSAF-Lora-Token`. The credential comes from INSAF_LORA_BASIC_AUTH
//     ("user:password"); a value that cannot be used fails closed instead of being
//     guessed at, and no reason, log line or status field ever contains it.
//
// Nothing here puts a secret in the browser: the service URL, the optional shared token
// and the tunnel credential are read from the server environment only.
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findProvisionCitations } from './citationAudit.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.join(HERE, '..', 'training', 'contracts', 'legal_answer_contract_v1.json');

const ENABLED = () => process.env.INSAF_LORA_ENABLED === '1';
const SERVICE_URL = () => (process.env.INSAF_LORA_SERVICE_URL || '').trim();
const SERVICE_TOKEN = () => (process.env.INSAF_LORA_TOKEN || '').trim();
const TIMEOUT_MS = () => Number(process.env.INSAF_LORA_TIMEOUT_MS || 90000);
// A public tunnel can require HTTP Basic Auth on EVERY route, in addition to the service's
// own token. The credential is server-side only, in "user:password" form.
const TUNNEL_BASIC_AUTH = () => (process.env.INSAF_LORA_BASIC_AUTH || '').trim();

export const CONTRACT_PATH_USED = CONTRACT_PATH;

/**
 * Build the `Authorization` header for the tunnel from a "user:password" value.
 * Empty means no edge auth (a private/direct service URL) and sends no header.
 * A value without a non-empty username fails closed: the request is not attempted
 * rather than sent with a credential the operator cannot have meant.
 * The returned reason never contains the credential, so it is safe to log.
 */
export function basicAuthHeader(rawValue) {
  const raw = String(rawValue === undefined ? TUNNEL_BASIC_AUTH() : rawValue).trim();
  if (!raw) return { ok: true, header: null, configured: false };
  const separator = raw.indexOf(':');
  if (separator < 1) {
    return {
      ok: false,
      configured: true,
      reason: 'inference tunnel credentials are set but are not in user:password form',
    };
  }
  return {
    ok: true,
    configured: true,
    header: `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`,
  };
}

/** Truthful, credential-free: does this deployment expect edge auth? */
export function loraTunnelAuthConfigured() {
  return Boolean(TUNNEL_BASIC_AUTH());
}

// The contract file is the single source of truth for the required-field schema and
// the three detectors. If it cannot be read the provider fails closed: every answer
// is rejected rather than checked against a schema invented in this file.
let CONTRACT = null;
export let CONTRACT_ERROR = null;
try {
  CONTRACT = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
} catch (err) {
  CONTRACT_ERROR = `the answer contract could not be read at ${CONTRACT_PATH}: ${err.message}`;
}

export const REQUIRED_FIELDS = CONTRACT
  ? CONTRACT.response.required_fields
  : ['answer', 'law', 'nextStep', 'limitation'];
export const OPTIONAL_FIELDS = CONTRACT ? CONTRACT.response.optional_fields : ['procedure'];
export const SOURCES_FIELD = CONTRACT ? CONTRACT.response.sources_field : 'sources';
export const SERVER_ATTACHED_FIELDS = CONTRACT
  ? CONTRACT.response.server_attached_fields
  : ['sourceUrls'];

const URL_RE = CONTRACT
  ? new RegExp(CONTRACT.detectors.url_pattern, 'g')
  : /https?:\/\/[^\s"'<>)\]]+/g;
const QUOTE_RE = CONTRACT
  ? new RegExp(CONTRACT.detectors.quote_pattern, 'g')
  : /"([^"]{4,160})"/g;

const EN_LABELS = {
  law: 'Law that may apply',
  procedure: 'What to do / procedure',
  nextStep: 'Next step',
  sources: 'Sources',
  limit: 'Important limitation',
};
const ROMAN_LABELS = {
  law: 'Laagu hone wala qanoon',
  procedure: 'Kya karna chahiye / tareeqa',
  nextStep: 'Agla qadam',
  sources: 'Masdar',
  limit: 'Zaroori tahaffuz',
};

const LIMIT_EN =
  'This is general legal information assembled from the verified Pakistani law corpus, not a substitute for advice from a licensed advocate. How a case proceeds and its outcome depend on the specific facts, the evidence, and the court. If a deadline or an appearance date is involved, act promptly and confirm with a lawyer or the relevant court/office.';
const LIMIT_ROMAN =
  'Ye verified Pakistani qanooni zakhire se li gayi aam qanooni maloomat hai, kisi licensed wakeel ke mashware ka mutabadil nahi. Muqadma kaise aage barhta hai aur us ka natija aap ke khais haqaiq, shawahid aur adalat par munhasir hai. Agar koi deadline ya peshi ki tareekh shamil hai to fori qadam uthayein aur wakeel ya mutaliqa adalat/office se tasdeeq karein.';

export function loraEnabled() {
  return ENABLED();
}

export function loraServiceConfigured() {
  return Boolean(SERVICE_URL());
}

/** True only when the service reports a loaded model. Never assumed. */
export function loraModelLoaded(health) {
  return Boolean(health && health.modelLoaded === true && health.stub !== true);
}

async function request(path, { method = 'GET', body, timeoutMs } = {}) {
  const url = `${SERVICE_URL()}${path}`;
  if (!url) throw new Error('inference service URL is not configured');
  const auth = basicAuthHeader();
  if (!auth.ok) throw new Error(auth.reason);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || TIMEOUT_MS());
  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = SERVICE_TOKEN();
    if (token) headers['X-INSAF-Lora-Token'] = token;
    // A public tunnel gates every route with HTTP Basic Auth; without it both the
    // health probe and the generation call are answered 401 by the tunnel edge.
    if (auth.header) headers.Authorization = auth.header;
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    return { status: response.status, body: parsed };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The real state of the inference service. Returns a truthful object even when
 * the service is unreachable — the caller must be able to report "not loaded"
 * rather than hide the failure.
 */
export async function loraHealth() {
  const auth = basicAuthHeader();
  const tunnelAuthConfigured = loraTunnelAuthConfigured();
  if (!loraServiceConfigured()) {
    return {
      reachable: false,
      modelLoaded: false,
      stub: false,
      enabled: loraEnabled(),
      tunnelAuthConfigured,
      reason: 'INSAF_LORA_SERVICE_URL is not configured',
    };
  }
  if (!auth.ok) {
    return {
      reachable: false,
      modelLoaded: false,
      stub: false,
      enabled: loraEnabled(),
      tunnelAuthConfigured,
      reason: auth.reason,
    };
  }
  try {
    const { status, body } = await request('/health', { timeoutMs: 10000 });
    if (status !== 200 || !body) {
      return {
        reachable: false,
        modelLoaded: false,
        stub: false,
        enabled: loraEnabled(),
        tunnelAuthConfigured,
        reason: `health endpoint returned HTTP ${status}`,
      };
    }
    return {
      reachable: true,
      modelLoaded: loraModelLoaded(body),
      stub: body.stub === true,
      enabled: loraEnabled(),
      tunnelAuthConfigured,
      baseModel: body.baseModel,
      baseRevision: body.baseRevision,
      adapterPath: body.adapterPath,
      device: body.device,
      quantization: body.quantization,
      computeDtype: body.computeDtype,
      loadedAt: body.loadedAt,
      error: body.error || null,
      identity: body,
    };
  } catch (err) {
    return {
      reachable: false,
      modelLoaded: false,
      stub: false,
      enabled: loraEnabled(),
      tunnelAuthConfigured,
      reason: `inference service unreachable: ${err.message}`,
    };
  }
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[\s-]+/g, '');
}

/**
 * Build the evidence list handed to the model. Ids are short ordinals
 * (E1, E2 ...) because the model has to be able to echo them.
 */
export function buildLoraEvidence(chunks) {
  return (chunks || []).map((chunk, index) => ({
    id: `E${index + 1}`,
    title: chunk.title || '',
    authority: chunk.issuingAuthority || '',
    jurisdiction: chunk.jurisdiction || '',
    provision: [chunk.type, chunk.key].filter(Boolean).join(' '),
    url: chunk.sourceURL || '',
    text: String(chunk.text || '').slice(0, 4000),
    recordKey: chunk.key || '',
    docId: chunk.docId || '',
  }));
}

/** NFKC, casefold, collapse whitespace - the comparison form of every string. */
export function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every field the model wrote, joined - the text that must not carry an invented URL. */
export function modelProse(answer) {
  if (!answer || typeof answer !== 'object') return '';
  return [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]
    .map((field) => String(answer[field] || ''))
    .join('\n');
}

export function findUrls(text) {
  return String(text || '').match(URL_RE) || [];
}

/**
 * A URL compared by location, not by spelling. The URL detector captures the
 * sentence punctuation that follows a link ("https://x.gov.pk/,"), so comparing
 * raw strings would reject a link the record actually owns.
 */
export function urlKey(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/.,;:'"()]+$/, '');
}

export function findQuotes(text) {
  const matches = String(text || '').matchAll(QUOTE_RE);
  return [...matches].map((match) => match[1]);
}

/** The URL of every supplied record, keyed by record id. */
export function trustedUrls(evidence) {
  const urls = new Map();
  for (const item of evidence || []) {
    const recordId = String(item?.id || '');
    const url = String(item?.url || '').trim();
    if (recordId && url) urls.set(recordId, url);
  }
  return urls;
}

/**
 * Validate the model's structured answer against the evidence that was
 * supplied. Returns {ok, reason, missingFields, unsupportedSourceIds,
 * citedSourceIds, modelUrls, inventedUrls, unsupportedQuotations,
 * unsupportedProvisions}. Any failure means the answer is not shown.
 */
export function validateLoraAnswer(answer, evidence) {
  const missingFields = [];
  if (!answer || typeof answer !== 'object') {
    return {
      ok: false,
      reason: 'no answer object',
      missingFields: REQUIRED_FIELDS,
      unsupportedSourceIds: [],
      citedSourceIds: [],
      modelUrls: [],
      inventedUrls: [],
      unsupportedQuotations: [],
      unsupportedProvisions: [],
    };
  }
  for (const field of REQUIRED_FIELDS) {
    if (!String(answer[field] || '').trim()) missingFields.push(field);
  }

  const suppliedIds = new Set((evidence || []).map((item) => item.id));
  const cited = Array.isArray(answer[SOURCES_FIELD])
    ? answer[SOURCES_FIELD].map((s) => String(s))
    : [];
  const unsupportedSourceIds = cited.filter((id) => !suppliedIds.has(id));

  // A URL the model wrote must be the URL of a record that was actually supplied.
  const urls = trustedUrls(evidence);
  const suppliedUrls = new Set([...urls.values()].map(urlKey));
  const modelUrls = findUrls(modelProse(answer));
  const inventedUrls = modelUrls.filter((url) => !suppliedUrls.has(urlKey(url)));

  // A quoted span must be supported by the supplied evidence text.
  const haystack = normalizeText(
    (evidence || []).map((item) => String(item?.text || '')).join('\n')
  );
  const unsupportedQuotations = findQuotes(modelProse(answer)).filter(
    (quote) => !haystack.includes(normalizeText(quote))
  );

  // A provision the model names must exist in the supplied evidence.
  const evidenceKeys = new Set(
    (evidence || [])
      .map((item) => normalizeKey(item.recordKey))
      .filter(Boolean)
  );
  const text = [answer.answer, answer.law, answer.procedure, answer.nextStep]
    .filter(Boolean)
    .join('\n');
  const unsupportedProvisions = findProvisionCitations(text)
    .map((citation) => citation.key)
    .filter((key) => !evidenceKeys.has(key));

  const ok =
    missingFields.length === 0 &&
    cited.length > 0 &&
    unsupportedSourceIds.length === 0 &&
    inventedUrls.length === 0 &&
    unsupportedQuotations.length === 0 &&
    unsupportedProvisions.length === 0;

  let reason = null;
  if (!ok) {
    if (missingFields.length) reason = `missing fields: ${missingFields.join(', ')}`;
    else if (!cited.length) reason = 'the answer cited no supplied record';
    else if (unsupportedSourceIds.length) reason = `unsupported source ids: ${unsupportedSourceIds.join(', ')}`;
    else if (inventedUrls.length) reason = `urls the model supplied that are not in the supplied records: ${inventedUrls.join(', ')}`;
    else if (unsupportedQuotations.length) reason = `quoted values the evidence does not support: ${unsupportedQuotations.join(', ')}`;
    else reason = `provisions not in the supplied evidence: ${unsupportedProvisions.join(', ')}`;
  }

  return {
    ok,
    reason,
    missingFields,
    unsupportedSourceIds,
    citedSourceIds: cited,
    modelUrls,
    inventedUrls,
    unsupportedQuotations,
    unsupportedProvisions,
  };
}

/**
 * Attach the retrieved records' own URLs to the answer. The URL comes from the
 * record, never from the model's memory. Only the records the model actually
 * cited are attached.
 */
export function attachTrustedUrls(answer, evidence) {
  const urls = trustedUrls(evidence);
  const cited = Array.isArray(answer?.[SOURCES_FIELD])
    ? answer[SOURCES_FIELD].map((s) => String(s))
    : [];
  const attached = cited.map((id) => urls.get(id)).filter(Boolean);
  const result = { ...answer };
  for (const field of SERVER_ATTACHED_FIELDS) result[field] = attached;
  return result;
}

/**
 * Remove every URL the model wrote from the prose. The URL of a retrieved record
 * is attached by the server from the record itself, so a URL in the model's own
 * text is never displayed.
 */
export function stripModelUrls(text) {
  return String(text || '')
    .replace(URL_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/** Turn the validated fields into the answer text the chat route sends. */
export function formatLoraAnswer(answer, language, evidence = []) {
  const labels = language === 'roman_urdu' ? ROMAN_LABELS : EN_LABELS;
  const parts = [];
  parts.push(stripModelUrls(answer.answer));
  if (String(answer.law || '').trim()) {
    parts.push(`**${labels.law}**\n${stripModelUrls(answer.law)}`);
  }
  if (String(answer.procedure || '').trim()) {
    parts.push(`**${labels.procedure}**\n${stripModelUrls(answer.procedure)}`);
  }
  if (String(answer.nextStep || '').trim()) {
    parts.push(`**${labels.nextStep}**\n${stripModelUrls(answer.nextStep)}`);
  }
  const attached = attachTrustedUrls(answer, evidence);
  const sourceUrls = attached[SERVER_ATTACHED_FIELDS[0]] || [];
  if (sourceUrls.length) {
    parts.push(`**${labels.sources}**\n${sourceUrls.join('\n')}`);
  }
  // The disclaimer is the server's, never the model's.
  const limit = language === 'roman_urdu' ? LIMIT_ROMAN : LIMIT_EN;
  parts.push(`**${labels.limit}**\n${String(answer.limitation || '').trim()}\n${limit}`);
  return parts.filter(Boolean).join('\n\n');
}

/**
 * Ask the inference service for an answer built from the supplied evidence.
 * Returns {ok:false, reason} on every failure so the caller can fall back to
 * the deterministic composer. It never returns a partial success.
 */
export async function answerWithLora({ question, chunks, language = 'en', answerLevel = 'beginner' }) {
  if (!loraEnabled()) return { ok: false, reason: 'lora provider disabled' };
  if (CONTRACT_ERROR) return { ok: false, reason: CONTRACT_ERROR };
  if (!loraServiceConfigured()) return { ok: false, reason: 'inference service URL is not configured' };
  const auth = basicAuthHeader();
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!chunks || !chunks.length) return { ok: false, reason: 'no evidence to answer from' };

  const evidence = buildLoraEvidence(chunks);
  let result;
  try {
    result = await request('/generate', {
      method: 'POST',
      body: { question, evidence, language, answerLevel },
    });
  } catch (err) {
    return { ok: false, reason: `inference service unreachable: ${err.message}` };
  }

  if (result.status !== 200) {
    const detail = result.body && result.body.detail;
    let reason =
      (detail && (detail.error || detail.message)) ||
      `inference service returned HTTP ${result.status}`;
    // A tunnel edge rejects with its own plain-text 401 before the request reaches the
    // service; say which layer refused so an edge-auth gap is never read as a model fault.
    if ((result.status === 401 || result.status === 407) && !detail) {
      reason = auth.configured
        ? `the inference tunnel rejected the configured credentials (HTTP ${result.status})`
        : `the inference tunnel demands credentials that INSAF_LORA_BASIC_AUTH does not supply (HTTP ${result.status})`;
    }
    return { ok: false, reason, detail: detail || null, status: result.status };
  }

  const body = result.body || {};
  const validation = validateLoraAnswer(body, evidence);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason, validation, provider: body.provider || null };
  }

  const provider = body.provider || {};
  if (provider.stub === true) {
    return { ok: false, reason: 'inference service is in stub mode; no model was used', provider };
  }

  const attached = attachTrustedUrls(body, evidence);

  return {
    ok: true,
    text: formatLoraAnswer(body, language, evidence),
    sourceUrls: attached[SERVER_ATTACHED_FIELDS[0]] || [],
    provider: {
      ...provider,
      latencyMs: body.latencyMs,
      tokens: body.tokens,
    },
    evidence,
    validation,
  };
}
