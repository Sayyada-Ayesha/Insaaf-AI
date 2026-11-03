// ============================================================================
// INSAaf AI — ROMAN URDU vs ENGLISH RETRIEVAL COVERAGE (audit FIX 5)
// ----------------------------------------------------------------------------
// The same real question is asked in English and in Roman Urdu; Roman must not
// silently lose coverage. For every pair the harness records the evidence-gate
// verdict, how many records were accepted, and the mean token coverage of the
// accepted evidence, then fails when Roman Urdu does worse than English.
//
//   node server/testRomanUrduCoverage.js
// ============================================================================
import { retrieveCorrected, evaluateEvidence } from './evidenceGate.js';

const PAIRS = [
  {
    topic: 'tenancy',
    en: 'On what grounds can a landlord evict a tenant for non-payment of rent in Punjab?',
    roman: 'Malik kirayedar ko kiraya ada na karne par makan se kaise nikal sakta hai Punjab mein?'
  },
  {
    topic: 'cheque',
    en: 'What is the punishment for dishonouring a cheque under Section 489-F of the PPC?',
    roman: '489-F ke tahet cheque barna hone par badlon ko kya saza hoti hai?'
  },
  {
    topic: 'fir-criminal',
    en: 'What can I do when the police refuse to register my FIR?',
    roman: 'Police meri FIR darj karne se inkaar kar de to main kya karun?'
  },
  {
    topic: 'family',
    en: 'How does a wife obtain khula when the husband does not agree to divorce?',
    roman: 'Shohar talak dene se inkaar kare to biwi khula kaise le sakti hai?'
  },
  {
    topic: 'student',
    en: 'What can a student do about harassment by a teacher in a university?',
    roman: 'University mein teacher ki taraf se tang kiye jaane par student kya kar sakta hai?'
  },
  {
    topic: 'property',
    en: 'What documents are needed to transfer ownership of a house through sale?',
    roman: 'Ghar ki malkiat sale ke zariye tabdeel karne ke liye kaunse zaroori kaghazat hain?'
  },
  {
    topic: 'cybercrime',
    en: 'Which agency investigates cybercrime offences under PECA 2016?',
    roman: 'PECA 2016 ke tahet cybercrime ki shikayat kaunsa idara tafteesh karta hai?'
  }
];

const RANK = { strong: 2, weak: 1, none: 0 };

function summarise(result) {
  const ev = result.evidence || {};
  // retrieveCorrected hands back only the verdict; re-judge the accepted chunks
  // so the coverage column is a measured number rather than an empty default.
  const judged = evaluateEvidence(result.__q, { chunks: result.chunks, domain: ev.domain });
  const accepted = (judged.rows || []).filter(r => r.keep);
  const coverages = accepted.map(r => r.coverage).filter(c => typeof c === 'number');
  return {
    verdict: ev.verdict || 'none',
    supported: ev.supportedCount ?? accepted.length,
    domain: ev.domain || result.domain,
    meanCoverage: coverages.length ? coverages.reduce((a, b) => a + b, 0) / coverages.length : 0,
    tokens: (judged.tokens || []).length,
    ids: accepted.slice(0, 3).map(r => r.docId || (r.chunk && r.chunk.id) || '?')
  };
}

let fail = 0;
console.log('\n===== FIX 5 Roman Urdu vs English retrieval coverage =====');
console.log('topic            | EN verdict / recs / cov | ROMAN verdict / recs / cov | delta');
console.log('-'.repeat(96));

for (const p of PAIRS) {
  const [enRes, roRes] = await Promise.all([
    retrieveCorrected(p.en, { isOnline: false }),
    retrieveCorrected(p.roman, { isOnline: false })
  ]);
  enRes.__q = p.en; roRes.__q = p.roman;
  const en = summarise(enRes), ro = summarise(roRes);
  const rankDelta = RANK[ro.verdict] - RANK[en.verdict];
  const recDelta = ro.supported - en.supported;
  const worse = rankDelta < 0 || (RANK[en.verdict] === 2 && RANK[ro.verdict] < 2) || (RANK[ro.verdict] >= 1 && ro.supported === 0);
  if (worse) fail++;
  const fmt = (s) => `${s.verdict.padEnd(6)} ${String(s.supported).padStart(2)} ${(s.meanCoverage * 100).toFixed(0).padStart(3)}%`;
  console.log(`${p.topic.padEnd(15)} | ${fmt(en).padEnd(21)} | ${fmt(ro).padEnd(24)} | ${worse ? 'WORSE  ' : 'ok     '} rank${rankDelta >= 0 ? '+' : ''}${rankDelta} recs${recDelta >= 0 ? '+' : ''}${recDelta}`);
  if (worse) {
    console.log(`    EN  q: ${p.en}`);
    console.log(`    RO  q: ${p.roman}`);
    console.log(`    EN  domains=${en.domain} ids=${en.ids.join(',')}`);
    console.log(`    RO  domains=${ro.domain} ids=${ro.ids.join(',')}`);
    console.log(`    RO  reasons: ${(roRes.evidence?.reasons || []).join(' | ').slice(0, 220)}`);
  }
}

console.log(`\n=================  FIX 5: ${PAIRS.length - fail}/${PAIRS.length} topics hold parity  ==================`);
process.exit(fail ? 1 : 0);
