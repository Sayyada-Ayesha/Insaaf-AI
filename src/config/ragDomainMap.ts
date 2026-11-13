/**
 * F14: RAG domain → Insaaf AI Library section mapping.
 *
 * The backend RAG engine returns a short `domain` id (e.g. "ppc", "case-law").
 * The Insaaf AI Library (src/data/libraryDomains.ts) uses its own section ids
 * (e.g. "domain_ppc", "domain_case_law"). This registry maps between them so
 * the UI can offer "Open in Insaaf AI Library" links that ALWAYS resolve to a
 * real library section — never a guessed or broken id.
 */
export const RAG_DOMAIN_TO_LIBRARY: Record<string, string> = {
  constitution: 'domain_constitution',
  ppc: 'domain_ppc',
  crpc: 'domain_crpc',
  cpc: 'domain_cpc',
  peca: 'domain_peca',
  family: 'domain_family_law',
  property: 'domain_property',
  labour: 'domain_labour',
  consumer: 'domain_consumer',
  student: 'domain_education',
  education: 'domain_education',
  'legal-aid': 'domain_legal_aid',
  'court-procedure': 'domain_court_procedures',
  'case-law': 'domain_case_law',
  'cross-border': 'cb_overseas_emergency'
};

/** Returns the library section id for a RAG domain, or undefined when no exact section exists. */
export function getLibrarySectionId(ragDomain?: string): string | undefined {
  if (!ragDomain) return undefined;
  return RAG_DOMAIN_TO_LIBRARY[ragDomain];
}
