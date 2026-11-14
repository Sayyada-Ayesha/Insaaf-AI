// ============================================================================
// LOCAL-ONLY ANSWER TRACE
//
// When an answer carries the generic "no verified record" line it can mean six
// different things: the corpus really has no match, the index was unavailable,
// retrieval threw, the gate rejected what was found, a clarification is required,
// composition failed, or the language layer failed. From the outside they are one
// sentence. This module records which one it was, plus the routing that led there,
// so a local probe can be diffed instead of guessed.
//
// It is attached to the response payload ONLY when INSAF_TRACE=1 (local tests);
// it never enters the public answer text and is never read by the frontend.
// ============================================================================

export const FALLBACK_REASONS = [
  'none',                 // a real, grounded answer (or a deliberate clarification)
  'no_match',             // retrieval ran, nothing relevant existed
  'index_unavailable',    // the corpus index failed to load
  'retrieval_error',      // retrieval threw
  'evidence_rejected',    // chunks existed but the gate refused to assert them
  'clarification_required',
  'composition_failure',  // composer produced nothing usable
  'language_failure',     // answer text did not honour the requested language
];

export function traceEnabled() {
  return process.env.INSAF_TRACE === '1';
}

/** Choose the fallback reason from the evidence object when the caller has no
 *  better information. Explicit `reason` always wins. */
function deriveReason({ action, verdict, chunks, error }) {
  if (error) return String(error).includes('index') ? 'index_unavailable' : 'retrieval_error';
  if (action === 'clarify') return 'clarification_required';
  if (action === 'abstain') {
    if (verdict === 'refusal') return 'none';
    if (chunks > 0) return 'evidence_rejected';
    return 'no_match';
  }
  if (action === 'answer' && chunks === 0) return 'composition_failure';
  return 'none';
}

/**
 * @param {object} ctx
 * @param {string} ctx.query            the raw user question
 * @param {string} ctx.lang             active language (en | roman_urdu | ur)
 * @param {object} ctx.processed        RAGEngine.processQuery result, if available
 * @param {object} ctx.retrieval        gate result: { chunks, domain, relevance, evidence, correction }
 * @param {string} ctx.action           answer | clarify | abstain
 * @param {string} [ctx.composerPath]   which synthesiser produced the text
 * @param {string} [ctx.finalLanguage]  language actually detected in the answer
 * @param {string} [ctx.reason]         explicit FALLBACK_REASONS value
 * @param {string} [ctx.error]          thrown error message, when the path failed
 */
export function buildAnswerTrace(ctx = {}) {
  if (!traceEnabled()) return null;
  const r = ctx.retrieval || {};
  const ev = r.evidence || {};
  const chunks = Array.isArray(r.chunks) ? r.chunks : [];
  const corr = r.correction || {};
  const scope = ev.scope || {};
  const action = ctx.action || 'answer';
  const reason = ctx.reason || deriveReason({ action, verdict: ev.verdict, chunks: chunks.length, error: ctx.error });
  return {
    query: String(ctx.query || '').slice(0, 400),
    language: ctx.lang || null,
    normalizedQuery: ctx.processed ? ctx.processed.normalizedQuery : null,
    rewrittenQuery: ctx.processed ? ctx.processed.rewrittenQuery : null,
    intent: ctx.intent || ev.intent || null,
    domain: (ctx.processed && ctx.processed.domain) || r.domain || null,
    jurisdiction: scope.province || scope.city || scope.scopeLevel || null,
    scope: scope.scopeLevel || null,
    candidates: chunks.length,
    top: chunks.slice(0, 3).map(c => ({
      id: c.id || c.docId || null,
      docId: c.docId || null,
      authority: c.authority || c.metadata?.authority || null,
      score: c.score ?? c.relevance ?? null,
    })),
    gate: {
      verdict: ev.verdict || null,
      reasons: ev.reasons || [],
      rejected: ev.rejected ?? null,
      supportedCount: ev.supportedCount ?? null,
    },
    correction: { attempts: corr.attempts || 0, strategies: corr.strategies || [] },
    action,
    composerPath: ctx.composerPath || null,
    finalLanguage: ctx.finalLanguage || null,
    fallbackReason: reason,
  };
}

/** Spread helper: `...traceFields(ctx)` adds `trace` only under INSAF_TRACE=1. */
export function traceFields(ctx) {
  const trace = buildAnswerTrace(ctx);
  return trace ? { trace } : {};
}
