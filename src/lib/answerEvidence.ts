import type { EvidenceVerdict } from "../services/storage";

type EvidenceMode = 'islamic' | 'combined' | 'legal';

/** Badge when the gate rates the retrieved record as directly on point. */
const VERIFIED_BADGE: Record<EvidenceMode, string> = {
  combined: 'VERIFIED ISLAMIC + PAKISTAN LAW SOURCES',
  islamic: 'VERIFIED ISLAMIC SOURCE',
  legal: 'VERIFIED LEGAL KNOWLEDGE',
};

/** Badge per evidence class, keyed to the gate's verdict for THIS answer — never
 *  to the fact that retrieval returned some documents. Mirrors the server's
 *  offlineKnowledgeHeader, which already refuses an unconditional "verified"
 *  claim under a weak/none verdict. */
export function evidenceBadge(
  verdict: EvidenceVerdict | undefined,
  mode: EvidenceMode | 'law',
  hasSources: boolean
): { label: string; grounded: boolean } | null {
  const path: EvidenceMode = mode === 'law' ? 'legal' : mode;
  switch (verdict) {
    case 'strong':
      return { label: VERIFIED_BADGE[path], grounded: true };
    case 'weak':
      return {
        label: path === 'islamic' ? 'PARTIAL MATCH — CLOSEST ISLAMIC RECORD'
          : path === 'combined' ? 'PARTIAL MATCH — CLOSEST ISLAMIC + LAW RECORDS'
            : 'PARTIAL MATCH — CLOSEST LEGAL RECORD',
        grounded: false
      };
    case 'none':
      return { label: 'GENERAL GUIDANCE — NO MATCHING RECORD', grounded: false };
    case 'clarify':
      return { label: 'MORE INFORMATION NEEDED', grounded: false };
    default:
      // No verdict reported. A card on screen still may not claim verification, but
      // an answer with neither verdict nor record (curated pointer, safety notice,
      // connection error) carries no evidence claim to make, so it gets no chip.
      return hasSources
        ? { label: 'PARTIAL MATCH — CLOSEST LEGAL RECORD', grounded: false }
        : null;
  }
}
