/*
 * Regression for the named-statute disambiguation fix (fix-rag-statute).
 * Calls RAGEngine.retrieve() directly in offline keyword mode and asserts:
 *  (A) named-statute citations scope the section number to the RIGHT document;
 *  (B) non-statute queries keep their existing domain routing (no regression).
 * Run: node testStatuteRegression.mjs
 */
import { RAGEngine } from '../../server/ragEngine.js';

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};

// (A) named-statute scoping: top chunk must come from the named statute's doc.
const scopeCases = [
  { q: 'Section 154 CrPC', expectDoc: 'crpc_1898' },
  { q: 'What is section 154 of CrPC about', expectDoc: 'crpc_1898' },
  { q: 'Section 302 PPC murder punishment', expectDoc: 'ppc_1860' },
  { q: 'Section 497 CrPC bail', expectDoc: 'crpc_1898' },
  { q: 'Order 7 CPC rule 1 plaint', expectDoc: 'cpc_1908' },
  { q: 'Section 20 PECA cyber offence', expectDoc: 'peca_2016' },
  { q: 'Section 154 of the Contract Act 1872', expectDoc: 'contract_act_1872' },
  { q: 'Section 7 Muslim Family Laws divorce', expectDoc: 'family_laws_1961' }
];

// (B) domain routing must be unchanged for queries with no named statute.
const domainCases = [
  { q: 'how to file an FIR', expectDomain: 'criminal' },
  { q: 'bail application procedure', expectDomain: 'criminal' },
  { q: 'murder punishment in pakistan', expectDomain: 'criminal' },
  { q: 'khula procedure in family court', expectDomain: 'family' },
  { q: 'landlord eviction of tenant rented premises', expectDomain: 'civil' },
  { q: 'defective product refund consumer complaint', expectDomain: 'consumer' },
  { q: 'workplace harassment complaint against boss', expectDomain: 'labour' },
  // Both labels below were pinned before two deliberate corpus/routing changes.
  //  - 'university fee refund' now routes to `education`, whose document list
  //    carries HEC's own national fee-refund policy. `rights` lifts only
  //    constitution_1973 + fundamental_rights, which say nothing about a
  //    university refund — so the old label asked for strictly worse grounding.
  { q: 'university fee refund student rights', expectDomain: 'education' },
  //  - a writ-petition question now routes to `case-law` because the corpus
  //    carries the 2026 full-text High Court writ judgments (added after this
  //    expectation was written). Article 199 itself still leads the window, which
  //    is what block (C) asserts.
  { q: 'Article 199 constitution writ petition', expectDomain: 'case-law' }
];

// (C) the records behind those two re-labelled queries must be the on-point ones.
const sourceCases = [
  {
    q: 'university fee refund student rights',
    expectDoc: 'hec_fee_refund_policy',
    expectAuthority: /higher education commission/i,
    expectUrl: /hec\.gov\.pk/i
  },
  {
    q: 'Article 199 constitution writ petition',
    expectDoc: 'constitution_1973',
    expectKey: '199',
    expectAuthority: /parliament of pakistan/i,
    expectUrl: /pakistancode\.gov\.pk/i
  }
];

(async () => {
  console.log('=== (A) named-statute scoping ===');
  for (const c of scopeCases) {
    const r = await RAGEngine.retrieve(c.q, false);
    const top = r.chunks && r.chunks[0];
    const topDoc = top ? top.docId : '(none)';
    const topKey = top ? top.key : '';
    const pass = topDoc === c.expectDoc;
    record(`scope "${c.q}"`, pass, `top=${topDoc} key=${topKey} domain=${r.domain} (expected ${c.expectDoc})`);
  }

  console.log('\n=== (B) domain routing unchanged (no named statute) ===');
  for (const c of domainCases) {
    const r = await RAGEngine.retrieve(c.q, false);
    const pass = r.domain === c.expectDomain;
    record(`domain "${c.q}"`, pass, `domain=${r.domain} (expected ${c.expectDomain})`);
  }

  console.log('\n=== (C) leading record is the on-point source ===');
  for (const c of sourceCases) {
    const r = await RAGEngine.retrieve(c.q, false);
    const top = r.chunks && r.chunks[0];
    const obs = top ? `doc=${top.docId} key=${top.key} authority=${top.issuingAuthority} url=${top.sourceURL}` : '(no records)';
    const pass = !!top
      && top.docId === c.expectDoc
      && (!c.expectKey || top.key === c.expectKey)
      && c.expectAuthority.test(String(top.issuingAuthority || ''))
      && c.expectUrl.test(String(top.sourceURL || ''));
    record(`source "${c.q}"`, pass, obs);
  }

  const passed = results.filter(x => x.pass).length;
  console.log(`\n==== testStatuteRegression: ${passed}/${results.length} PASS ====`);
  process.exit(passed === results.length ? 0 : 1);
})();
