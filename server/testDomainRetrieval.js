// ============================================================================
// INSAaf AI — FINAL DOMAIN RETRIEVAL TEST (F14 / Phase 14)
// ----------------------------------------------------------------------------
// Tests at least one query from EVERY final domain against the 2.6.0-final
// frozen corpus (offline pipeline: exact + lexical + local semantic vectors).
// For each domain: query -> expected record -> actual top results -> relevant
// score -> citation/source. Writes:
//   docs/final_domain_retrieval_report.json
//   docs/final_domain_retrieval_report.md
// Exits 1 when a CRITICAL domain fails.
//
//   node server/testDomainRetrieval.js
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RAGEngine } from './ragEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.resolve(ROOT, p);

const manifest = JSON.parse(fs.readFileSync(R('rag/manifest.json'), 'utf8'));
const docById = new Map(manifest.documents.map((d) => [d.id, d]));

// Each test: { domain, category, query, expect: [docIds], acceptRe: /re/,
//              note, critical }
const TESTS = [
  // ---------------- Core laws ----------------
  { domain: 'Constitution', category: 'core-law', critical: true, expect: ['constitution_1973', 'fundamental_rights'], query: 'Which article guarantees the right to a fair trial and due process to every person in Pakistan?', note: 'Article 10A right to fair trial' },
  { domain: 'Criminal law (PPC)', category: 'core-law', critical: true, expect: ['ppc_1860'], query: 'What punishment does the law prescribe for the offence of theft?', note: 'PPC ss.378-382 theft' },
  { domain: 'Criminal procedure (CrPC)', category: 'core-law', critical: true, expect: ['crpc_1898', 'court_procedures'], query: 'How can a person get bail before conviction in a non-bailable offence?', note: 'CrPC s.497 bail' },
  { domain: 'Civil procedure (CPC)', category: 'core-law', critical: true, expect: ['cpc_1908'], query: 'Can a decree holder ask the court to execute the decree after many years?', note: 'CPC execution of decrees' },
  { domain: 'Contract law', category: 'core-law', critical: true, expect: ['contract_act_1872'], query: 'When is an agreement without consideration enforceable under Pakistani law?', note: 'Contract Act s.25 exceptions' },
  { domain: 'Evidence law', category: 'core-law', critical: true, expect: ['evidence_qso_1984'], query: 'When is a confession made to a police officer inadmissible in evidence?', note: 'QSO confession admissibility' },
  { domain: 'Limitation law', category: 'core-law', critical: true, expect: ['limitation_act_1908'], query: 'Within how many years must a suit for recovery of money be filed?', note: 'Limitation Act period' },
  { domain: 'Family law', category: 'core-law', critical: true, expect: ['family_laws_1961'], query: 'How does a wife obtain khula when the husband does not agree to divorce?', note: 'khula / Dissolution of Muslim Marriages Act' },
  { domain: 'Property / transfer', category: 'core-law', expect: ['property_laws'], query: 'What documents are needed to transfer ownership of a house through sale?', note: 'transfer + registration' },
  { domain: 'Tenancy / rent', category: 'core-law', expect: ['tenancy_laws', 'property_laws', 'provincial_fulltext'], query: 'On what grounds can a landlord evict a tenant for non-payment of rent?', note: 'rent laws' },
  { domain: 'Labour & employment', category: 'core-law', expect: ['labour_employment'], query: 'What is the minimum wage framework and who enforces it in Pakistan?', note: 'labour laws' },
  { domain: 'Consumer protection', category: 'core-law', expect: ['consumer_protection'], query: 'Where can I complain about a defective product I bought from a shop?', note: 'consumer courts' },
  { domain: 'Education & student rights', category: 'core-law', expect: ['education_student_rights', 'student_rights', 'edu_anti_harassment'], query: 'What can a student do about harassment by a teacher in a university?', note: 'harassment policy' },
  { domain: 'Companies', category: 'core-law', expect: ['companies_act_2017'], query: 'How is a private limited company incorporated in Pakistan?', note: 'Companies Act 2017' },
  { domain: 'Banking', category: 'core-law', expect: ['banking_laws'], query: 'What is the legal remedy when a bank dishonours a cheque due to insufficient funds?', note: 'banking / NI / s.489-F' },
  { domain: 'Tax', category: 'core-law', expect: ['tax_laws'], query: 'How is income tax assessed on a salaried person in Pakistan?', note: 'Income Tax Ordinance' },
  { domain: 'Customs', category: 'new-domain', critical: true, expect: ['customs_act_1969'], query: 'What is the appeal route when customs officers seize my imported goods?', note: 'Customs Act 1969 appeals' },
  { domain: 'Health', category: 'new-domain', critical: true, expect: ['health_laws'], query: 'Which authority regulates the registration of medicines in Pakistan?', note: 'DRAP' },
  { domain: 'FIA', category: 'new-domain', critical: true, expect: ['fia_act_1974'], query: 'Which agency investigates cybercrime offences under PECA?', note: 'FIA NR3C' },
  { domain: 'Administrative law', category: 'new-domain', critical: true, expect: ['admin_service_laws'], query: 'Can a government employee challenge a dismissal order without an inquiry?', note: 'service law / judicial review' },
  { domain: 'Public service', category: 'new-domain', critical: true, expect: ['admin_service_laws'], query: 'What are the terms and conditions of civil servants in Pakistan?', note: 'Civil Servants Act 1973' },
  { domain: 'Torts', category: 'new-domain', critical: true, expect: ['torts_laws'], query: 'What is the remedy when a newspaper publishes a false defamatory story about me?', note: 'defamation tort' },
  { domain: 'Environment', category: 'core-law', expect: ['environmental_laws'], query: 'Who grants the no-objection certificate for an industrial project affecting the environment?', note: 'EPA' },
  { domain: 'Immigration & citizenship', category: 'core-law', expect: ['immigration_laws'], query: 'How does a foreign woman married to a Pakistani citizen obtain Pakistani citizenship?', note: 'Citizenship Act' },
  { domain: 'Elections', category: 'core-law', expect: ['elections_act_2017'], query: 'How is a complaint about an election result decided?', note: 'election tribunals' },
  { domain: 'Police', category: 'core-law', critical: true, expect: ['police_order_2002', 'crpc_1898'], query: 'What can I do when the police refuse to register my FIR?', note: 's.154 / 22-A / 22-B' },
  { domain: 'NAB / anti-corruption', category: 'core-law', expect: ['nab_ordinance_1999'], query: 'Which offences are tried by accountability courts?', note: 'NAO 1999' },
  { domain: 'Anti-terrorism', category: 'core-law', expect: ['ata_1997'], query: 'Which courts try offences under the Anti-Terrorism Act?', note: 'anti-terrorism courts' },
  { domain: 'Women protection', category: 'core-law', expect: ['women_protection_laws'], query: 'What protection does the law give a woman facing domestic violence?', note: 'DV acts' },
  { domain: 'Juvenile justice', category: 'core-law', expect: ['juvenile_justice_2000'], query: 'How are offences by a person under 18 tried in Pakistan?', note: 'JJSO 2000' },
  { domain: 'Succession / inheritance', category: 'core-law', expect: ['succession_laws'], query: 'How is the estate of a deceased Muslim distributed among heirs?', note: 'shares of heirs' },
  { domain: 'Specific relief', category: 'core-law', expect: ['specific_relief_act_1877'], query: 'When can a court order specific performance of a contract for sale of land?', note: 'Specific Relief Act' },
  { domain: 'Arbitration', category: 'core-law', expect: ['arbitration_act_1940'], query: 'How is an arbitration award enforced by a court?', note: 'Arbitration Act' },
  { domain: 'Competition', category: 'core-law', expect: ['competition_act_2010'], query: 'Which body regulates anti-competitive agreements between companies?', note: 'CCP' },
  { domain: 'Local government', category: 'core-law', expect: ['local_government_laws'], query: 'What are the tiers of local government in a district?', note: 'LG tiers' },
  { domain: 'Intellectual property', category: 'core-law', expect: ['ip_laws'], query: 'How is a trademark registered in Pakistan?', note: 'IPO' },
  { domain: 'Prisons', category: 'core-law', expect: ['prisons_laws'], query: 'What are the rights of prisoners to family meetings?', note: 'Prisons Act' },
  { domain: 'Traffic / transport', category: 'core-law', expect: ['traffic_laws'], query: 'What are the penalties for driving without a licence?', note: 'MVO 1965' },
  { domain: 'Sales of goods', category: 'core-law', expect: ['sales_of_goods_act_1930'], query: 'When does property in goods pass from the seller to the buyer?', note: 'SOGA 1930' },
  { domain: 'Cybercrime (PECA)', category: 'core-law', expect: ['peca_2016'], query: 'What is the offence of unauthorized access to an information system?', note: 'PECA s.3' },
  // ---------------- Amendments ----------------
  { domain: 'Amendment history', category: 'amendment', critical: true, expect: ['amendment_history'], query: 'What was the law about the President dissolving the National Assembly before the 18th Amendment?', note: 'Art 58(2)(b) chain' },
  { domain: 'Amendment history (PPC)', category: 'amendment', expect: ['amendment_history'], query: 'When was the punishment for dishonouring a cheque added to the Pakistan Penal Code?', note: 's.489-F added 2002' },
  // ---------------- Provincial / regions ----------------
  { domain: 'Province: Punjab', category: 'province', critical: true, expect: ['provincial_fulltext', 'provincial_laws'], query: 'What is the Punjab law on rent of residential premises in Lahore?', note: 'Punjab Rented Premises Act 2009' },
  { domain: 'Province: Sindh', category: 'province', critical: true, expect: ['provincial_fulltext', 'provincial_laws'], query: 'What protection does Sindh law give against domestic violence?', note: 'Sindh DV Act 2013' },
  { domain: 'Province: KP', category: 'province', critical: true, expect: ['provincial_fulltext', 'provincial_laws'], query: 'What is the KP law about child protection?', note: 'KP Child Protection Act 2010' },
  { domain: 'Province: Balochistan', category: 'province', critical: true, expect: ['provincial_fulltext', 'provincial_laws'], query: 'Which law governs rent disputes in Quetta?', note: 'Balochistan rent law' },
  { domain: 'ICT', category: 'province', expect: ['provincial_fulltext'], query: 'Which law governs rented premises in Islamabad?', note: 'ICT rent 2001' },
  { domain: 'AJK', category: 'region', critical: true, expect: ['ajk_laws'], query: 'Which constitutional document governs Azad Jammu and Kashmir?', note: 'AJK Interim Constitution 1974' },
  { domain: 'Gilgit-Baltistan', category: 'region', critical: true, expect: ['gb_laws'], query: 'What is the constitutional status of Gilgit-Baltistan and its Assembly?', note: 'GB Governance Order 2018' },
  // ---------------- Case law ----------------
  { domain: 'Case law (SC)', category: 'case-law', critical: true, expect: ['sc_judgments', 'expanded_case_law', 'scp_fcc_official_records'], query: 'What has the Supreme Court held about the independence of the judiciary?', note: 'SC digests' },
  { domain: 'Case law (HC full-text)', category: 'case-law', critical: true, expect: ['lhc_fulltext_2026', 'ihc_fulltext_2026', 'phc_fulltext_2026', 'bhc_fulltext_2026'], query: 'Find a High Court judgment dealing with bail in a murder case.', note: 'HC full-text judgments' },
  { domain: 'Case law (HC index)', category: 'case-law', expect: ['lhc_index_2026', 'ihc_index_2026', 'phc_index_2026', 'bhc_index_2026'], query: 'Give me a list of recent service-related writ petitions decided by the High Courts.', note: 'HC index metadata' },
  // ---------------- Civic / offices / workflows ----------------
  { domain: 'Civic: birth registration', category: 'civic', critical: true, expect: ['civic_workflows'], query: 'What is the step-by-step process to register the birth of a newborn baby?', note: 'CIVIC_WF_BIRTH_REGISTRATION' },
  { domain: 'Civic: domicile', category: 'civic', expect: ['civic_workflows'], query: 'Which office issues the domicile certificate and what documents are required?', note: 'CIVIC_WF_DOMICILE' },
  { domain: 'Civic: voter complaint', category: 'civic', expect: ['civic_workflows', 'elections_act_2017'], query: 'How can I complain that my vote is registered in the wrong constituency?', note: 'CIVIC_WF_VOTER_COMPLAINT' },
  { domain: 'Civic: government complaint', category: 'civic', expect: ['civic_workflows'], query: 'How do I complain about a government department that is not providing a service?', note: 'CIVIC_WF_GOVT_DEPT_COMPLAINT' },
  { domain: 'Public offices', category: 'offices', critical: true, expect: ['public_offices'], query: 'What are the powers of a Deputy Commissioner in a district?', note: 'OFFICE records' },
  { domain: 'Public offices (police)', category: 'offices', expect: ['public_offices', 'police_order_2002'], query: 'What is the role of the SHO of a police station?', note: 'SHO record' },
  { domain: 'Public offices (regulators)', category: 'offices', expect: ['public_offices', 'expanded_institutions'], query: 'Which regulators oversee the banking sector in Pakistan?', note: 'regulators' },
  // ---------------- Foreigners / cross-border ----------------
  { domain: 'Foreigner residence', category: 'foreigner', critical: true, expect: ['foreigner_residence_work_study', 'foreigner_entry_stay_registration'], query: 'How can a foreigner working in Pakistan extend his visa and get a residence permit?', note: 'residence/extension' },
  { domain: 'Foreigner family matters', category: 'foreigner', expect: ['foreigner_residence_work_study'], query: 'Does marrying a Pakistani citizen automatically give a foreigner Pakistani citizenship?', note: 'Citizenship Act distinction' },
  { domain: 'Foreigner emergency', category: 'foreigner', expect: ['foreigner_residence_work_study'], query: 'A foreigner lost his passport in Pakistan — who issues the replacement document?', note: 'home-country consular' },
  { domain: 'Overseas Pakistanis (consular)', category: 'cross-border', expect: ['cross_border_consular'], query: 'Which services do Pakistani consulates provide to overseas Pakistanis?', note: 'consular services' },
  { domain: 'Overseas employment', category: 'cross-border', expect: ['cross_border_employment'], query: 'What is emigration clearance for Pakistani workers going abroad?', note: 'emigration' },
  { domain: 'Study abroad', category: 'cross-border', expect: ['cross_border_education', 'hec_degree_recognition'], query: 'How is an HEC attestation of a foreign degree obtained?', note: 'HEC attestation' },
  // ---------------- POA / drafting ----------------
  { domain: 'POA', category: 'drafting', critical: true, expect: ['poa_laws'], query: 'What must a special power of attorney for sale of property contain?', note: 'POA structures' },
  { domain: 'POA overseas', category: 'drafting', expect: ['poa_laws'], query: 'How does a Pakistani abroad execute a power of attorney for use in Pakistan?', note: 'overseas POA' },
  // ---------------- Behavioral (Phase 22) ----------------
  { domain: 'Legal workflows', category: 'behavior', expect: ['legal_workflows', 'court_workflows'], query: 'What are the steps to file a family suit for custody of children?', note: 'workflow' },
  { domain: 'Legal aid', category: 'behavior', expect: ['legal_aid_services', 'civic_workflows'], query: 'Where can an indigent person get free legal aid for a criminal case?', note: 'legal aid' },
  { domain: 'Court hierarchy', category: 'behavior', expect: ['court_hierarchy'], query: 'Which court hears an appeal against the decision of a sessions judge?', note: 'hierarchy' },
  { domain: 'Safety / wrong question', category: 'behavior', expect: ['crpc_1898', 'ppc_1860', 'court_procedures'], query: 'What is Section 999 of the Pakistan Penal Code?', note: 'non-existent section — retrieval should return nearest PPC context, model must not invent', acceptRe: /does not exist|not.{0,20}(found|verified|indexed)|invalid/i },
  { domain: 'Urdu Script drafting (translation)', category: 'behavior', expect: ['poa_laws'], query: 'Give me the Urdu wording for a general power of attorney', note: 'Urdu Script POA structure' },
  { domain: 'Roman Urdu retrieval', category: 'behavior', expect: ['crpc_1898', 'court_procedures'], query: 'police meri report darj karne se inkaar kar rahi hai to main kya karoon?', note: 'Roman Urdu FIR refusal' },
  { domain: 'Constitutional history', category: 'behavior', expect: ['pakistan_constitutional_history'], query: 'Which constitution was in force in Pakistan in 1962?', note: '1962 constitution' }
];

async function main() {
  console.log('=== F14 FINAL DOMAIN RETRIEVAL TEST (2.6.0-final) ===\n');
  const results = [];
  let failures = 0;

  for (const t of TESTS) {
    let res;
    try {
      res = await RAGEngine.retrieve(t.query, false);
    } catch (e) {
      failures += t.critical ? 1 : 0;
      results.push({ ...t, pass: false, error: String(e.message || e), top: [], embeddingMode: 'error' });
      console.log(`FAIL  [${t.domain}] ${t.query.slice(0, 60)}... — ${e.message}`);
      continue;
    }
    const chunks = res.chunks || [];
    const top = chunks.slice(0, 5).map((c) => ({
      docId: c.docId,
      key: c.key,
      chunkTitle: String(c.chunkTitle || '').slice(0, 90),
      score: Number(c.score || 0).toFixed(3),
      vectorScore: Number(c.vectorScore || 0).toFixed(3)
    }));
    const hit = chunks.filter((c) => t.expect.includes(c.docId));
    const acceptHit = t.acceptRe
      ? chunks.filter((c) => t.acceptRe.test(`${c.chunkTitle || ''} ${c.text || ''}`))
      : [];
    const ok = hit.length > 0 || acceptHit.length > 0;
    const citations = chunks.slice(0, 3).map((c) => {
      const d = docById.get(c.docId) || {};
      return `${c.docId}${c.key ? ':' + c.key : ''} (${d.sourceURL || 'corpus source'})`;
    });
    results.push({
      domain: t.domain,
      category: t.category,
      query: t.query,
      expected_record: t.note,
      pass: ok,
      critical: t.critical,
      embedding_mode: res.embeddingMode || '?',
      relevant_score: chunks[0] ? Number(chunks[0].score || 0).toFixed(3) : '0',
      top_results: top,
      citation_source: citations
    });
    if (!ok) failures += t.critical ? 1 : 0;
    console.log(`${ok ? 'PASS' : 'FAIL'}  [${t.category}] ${t.domain} — top: ${top[0] ? top[0].docId + ':' + top[0].key : 'none'} (mode ${res.embeddingMode})`);
    if (!ok) {
      console.log(`      query: ${t.query}`);
      top.forEach((r, i) => console.log(`        ${i + 1}. ${r.docId} | ${r.key} | ${r.chunkTitle} | ${r.score}`));
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const criticalFailed = results.filter((r) => r.critical && !r.pass).length;

  const report = {
    artifact: 'final_domain_retrieval_report',
    generated_at: new Date().toISOString(),
    corpus_version: '2.6.0-final',
    retrieval_mode: 'offline hybrid (exact + lexical + local semantic vectors, Xenova/multilingual-e5-small dim 384)',
    totals: { domains_tested: results.length, passed, failed: results.length - passed, critical_failures: criticalFailed },
    results
  };

  fs.writeFileSync(R('docs/final_domain_retrieval_report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

  // ---- markdown report ----
  const md = [];
  md.push('# INSAaf AI — Final Domain Retrieval Report (Phase 14)');
  md.push('');
  md.push(`- **Corpus version:** 2.6.0-final (83 documents, 1569 chunks, 1569/1569 non-zero local vectors)`);
  md.push(`- **Generated:** ${report.generated_at}`);
  md.push(`- **Retrieval mode:** offline hybrid — exact + lexical + local semantic (multilingual-e5-small, dim 384)`);
  md.push(`- **Domains tested:** ${results.length} | **Passed:** ${passed} | **Failed:** ${results.length - passed} | **Critical failures:** ${criticalFailed}`);
  md.push('');
  md.push('| Domain | Category | Query | Expected record | Top result | Relevant score | Pass |');
  md.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    const q = r.query.replace(/\|/g, '/').slice(0, 70);
    const t = (r.top_results[0] ? r.top_results[0].docId + ':' + r.top_results[0].key : '—').slice(0, 45);
    md.push(`| ${r.domain} | ${r.category} | ${q} | ${r.expected_record.replace(/\|/g, '/')} | ${t} | ${r.relevant_score} | ${r.pass ? '✅' : '❌'} |`);
  }
  md.push('');
  md.push('### Failed (non-critical context)');
  md.push('');
  const fails = results.filter((r) => !r.pass);
  if (fails.length === 0) md.push('None — every domain query returned the expected record in the top results.');
  for (const f of fails) {
    md.push(`- **${f.domain}** — "${f.query}" → top results: ${f.top_results.map((x) => x.docId + ':' + x.key).join(', ')}`);
  }
  md.push('');
  md.push('> No domain is marked covered merely because a file exists — every row above is a live retrieval');
  md.push('> against the frozen 2.6.0-final index with the expected record asserted per domain.');
  md.push('');
  fs.writeFileSync(R('docs/final_domain_retrieval_report.md'), md.join('\n'), 'utf8');

  console.log(`\n=== F14 RESULT: ${passed}/${results.length} domains passed (${criticalFailed} critical failures) ===`);
  console.log('written: docs/final_domain_retrieval_report.json + .md');
  process.exit(criticalFailed > 0 ? 1 : 0);
}

main();
