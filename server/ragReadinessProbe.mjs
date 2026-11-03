// ragReadinessProbe.mjs
// P13 readiness probe: deterministic lexical/exact retrieval across the 10
// required runtime query classes (exact section, section+question, NL legal,
// procedural, case-law, cross-border, country-specific, jurisdiction,
// source-title, Roman Urdu). Runs the RAG engine in keyword mode
// (isOnline=false, no API key) against the frozen corpus index — exactly the
// offline runtime path. Semantic embeddings are NOT available offline, so the
// pass condition is: for each of the 20 representative queries, at least one
// of the top-5 chunks matches the class's expected corpus anchor.
//
// Exit code: 0 = all 20 queries PASS (LEXICAL/EXACT RETRIEVAL = VERIFIED),
//            1 = one or more queries FAIL.
import { RAGEngine } from './ragEngine.js';

// candidate anchors per query: {docId?, key?} — a chunk matches when every
// provided field equals the chunk field. Any candidate match in top-5 = PASS.
const CASES = [
  // 1. exact section queries
  { cls: 'exact-section',  q: 'Section 302 PPC', want: [{ docId: 'ppc_1860', key: '302' }] },
  { cls: 'exact-section',  q: 'Article 25 of the Constitution', want: [{ docId: 'constitution_1973', key: '25' }] },
  // 2. section + question queries
  { cls: 'section-question', q: 'What is the punishment under Section 302 PPC?', want: [{ docId: 'ppc_1860', key: '302' }] },
  { cls: 'section-question', q: 'What does Article 14 of the Constitution say about dignity?', want: [{ docId: 'constitution_1973', key: '14' }] },
  // 3. natural-language legal questions
  { cls: 'nl-legal',       q: 'A person intentionally killed someone. What legal action can be taken?', want: [{ docId: 'ppc_1860', key: '299' }, { docId: 'ppc_1860', key: '300' }, { docId: 'ppc_1860', key: '302' }] },
  { cls: 'nl-legal',       q: 'My employer is not paying my salary for the last three months, what can I do?', want: [{ docId: 'labour_employment', key: 'MINIMUM_WAGES' }, { docId: 'labour_employment', key: 'WRONGFUL_TERMINATION' }, { docId: 'labour_employment', key: 'EMPLOYMENT_CONTRACTS' }] },
  // 4. procedural questions
  { cls: 'procedural',     q: 'How do I file an FIR in Pakistan?', want: [{ docId: 'crpc_1898', key: '154' }, { docId: 'court_procedures', key: 'FIR_REFUSAL_REMEDY' }, { docId: 'court_procedures', key: 'FIR_PROCEDURE' }] },
  { cls: 'procedural',     q: 'What is the procedure for a consumer complaint?', want: [{ docId: 'court_procedures', key: 'CONSUMER_COMPLAINT_STEPS' }, { docId: 'consumer_protection', key: 'CONSUMER_COMPLAINT_PROCEDURE' }] },
  // 5. case-law questions
  { cls: 'case-law',       q: 'Is there a Supreme Court judgment about environmental protection and public interest litigation?', want: [{ docId: 'sc_judgments', key: 'CASE_SHEHLA_ZIA_V_WAPDA' }] },
  { cls: 'case-law',       q: 'What did the Supreme Court decide in Shehla Zia v WAPDA?', want: [{ docId: 'sc_judgments', key: 'CASE_SHEHLA_ZIA_V_WAPDA' }] },
  // 6. cross-border questions
  { cls: 'cross-border',   q: 'My brother is stranded abroad without a passport, what should he do?', want: [{ docId: 'cross_border_consular', key: 'consular_assistance_limits' }, { docId: 'cross_border_consular', key: 'returning_to_pakistan' }, { docId: 'cross_border_consular', key: 'emergency_travel_document' }] },
  { cls: 'cross-border',   q: 'What happens to my property in Pakistan if I live abroad?', want: [{ docId: 'cross_border_consular', key: 'consular_assistance_limits' }, { docId: 'cross_border_consular', key: 'apostille_legalization' }, { docId: 'cross_border_consular', key: 'overseas_complaints_help' }, { docId: 'cross_border_consular', key: 'returning_to_pakistan' }] },
  // 7. country-specific queries
  { cls: 'country-specific', q: 'What are the requirements for overseas employment in Saudi Arabia?', want: [{ docId: 'cross_border_travel', key: 'gulf_gcc_official_sources' }, { docId: 'cross_border_employment', key: 'overseas_employment_overview' }, { docId: 'cross_border_employment', key: 'recruiting_agent_verification' }, { docId: 'cross_border_consular', key: 'consular_assistance_limits' }] },
  { cls: 'country-specific', q: 'Dual nationality rules for Pakistanis in the United Kingdom', want: [{ docId: 'cross_border_legal', key: 'dual_nationality_pakistan' }] },
  // 8. jurisdiction queries (foreign-country crime + foreign judgment)
  { cls: 'jurisdiction',   q: 'Which law applies if a Pakistani commits a crime in Dubai?', want: [{ docId: 'cross_border_consular', key: 'consular_assistance_limits' }, { docId: 'cross_border_consular', key: 'detained_or_arrested_abroad' }, { docId: 'cross_border_consular', key: 'lost_passport_abroad' }] },
  { cls: 'jurisdiction',   q: 'Does a foreign court judgment apply to my property in Pakistan?', want: [{ docId: 'cross_border_legal', key: 'foreign_court_document' }, { docId: 'cross_border_legal', key: 'foreign_judgment_enforcement' }] },
  // 9. source-title queries
  { cls: 'source-title',   q: 'Constitution of Pakistan 1973 fundamental rights', want: [{ docId: 'fundamental_rights' }, { docId: 'constitution_1973' }] },
  { cls: 'source-title',   q: 'Pakistan Penal Code punishment for theft', want: [{ docId: 'ppc_1860', key: '379' }, { docId: 'ppc_1860', key: '380' }, { docId: 'ppc_1860', key: '378' }] },
  // 10. Roman Urdu legal questions
  { cls: 'roman-urdu',     q: 'Mera maalik mujhe tankhwa nahi de raha, kya karun?', want: [{ docId: 'labour_employment', key: 'MINIMUM_WAGES' }] },
  { cls: 'roman-urdu',     q: 'Meri biwi khula chahti hai, procedure kya hai?', want: [{ docId: 'family_laws_1961', key: 'KHULA_PROCEDURE' }] },
];

function matches(c, want) {
  return want.some(w =>
    (!w.docId || c.docId === w.docId) &&
    (!w.key || String(c.key) === String(w.key))
  );
}

let passed = 0;
let failed = 0;
const classTotals = {};
const classPass = {};
const rows = [];

for (const { cls, q, want } of CASES) {
  classTotals[cls] = (classTotals[cls] || 0) + 1;
  let r;
  try {
    r = await RAGEngine.retrieve(q, false, '');
  } catch (e) {
    rows.push({ cls, q, ok: false, note: 'ERROR ' + e.message, top: '' });
    failed += 1;
    continue;
  }
  const top = (r.chunks || []).slice(0, 5);
  const hit = top.find(c => matches(c, want));
  const ok = Boolean(hit) && r.isOfflineRetrieval === true;
  if (ok) { passed += 1; classPass[cls] = (classPass[cls] || 0) + 1; }
  else { failed += 1; }
  const pos = hit ? top.indexOf(hit) + 1 : 0;
  rows.push({
    cls, q, ok,
    domain: r.domain,
    note: hit ? `hit@#${pos} [${hit.type} ${hit.key}|${hit.docId}]` : 'NO ANCHOR IN TOP-5',
    top: top.map(c => `[${c.type} ${c.key}|${c.docId}]`).join(' '),
  });
}

console.log('\n================ P13 RETRIEVAL READINESS ================');
console.log('Mode: RAGEngine.retrieve(q, isOnline=false, apiKey="") -> keyword/lexical path');
console.log('Pass condition: top-5 of 20 representative queries contains the class anchor,');
console.log('and the engine reports isOfflineRetrieval=true (no semantic vectors involved).');
for (const { cls, q, ok, domain, note, top } of rows) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${cls}] ${q}`);
  console.log(`       domain=${domain} | ${note}`);
  if (!ok) console.log(`       top5: ${top}`);
}
console.log('\n---------------- per class ----------------');
for (const cls of Object.keys(classTotals)) {
  console.log(`  ${cls.padEnd(17)} ${classPass[cls] || 0}/${classTotals[cls]}`);
}
console.log('-------------------------------------------');
console.log(`TOTAL: ${passed}/20 PASS, ${failed} FAIL`);
if (failed === 0) {
  console.log('SEMANTIC EMBEDDINGS = NOT AVAILABLE; LEXICAL/EXACT RETRIEVAL = VERIFIED');
  process.exitCode = 0;
} else {
  console.log('LEXICAL/EXACT RETRIEVAL = FAILED');
  process.exitCode = 1;
}
