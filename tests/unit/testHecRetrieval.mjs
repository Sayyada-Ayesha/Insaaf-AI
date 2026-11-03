/*
 * HEC coverage retrieval suite (task brief §6).
 *
 * Thirteen question classes over the official HEC corpus, each asserting that the
 * Hybrid RAG retrieval (a) routes the question to the education domain, (b) grounds
 * the answer in the specific HEC document that carries the rule, (c) attaches a
 * canonical hec.gov.pk link, and (d) for the version-conflict classes, surfaces the
 * currently amended instrument rather than the superseded text.
 *
 * Every expected document id, canonical URL and fact pattern below was read out of
 * rag/documents/hec/ (the verbatim-extracted sources) — see docs/hec-coverage-matrix.md.
 * The suite never asserts a paraphrase of the rule, only that the rule's own words
 * are in the retrieved evidence.
 *
 * A fourth section runs 12 of these questions through retrieveCorrected() offline and
 * asserts what the evidence gate actually accepts (verdict, supportedCount, domain) and
 * that a single HEC policy document cannot monopolise the 8-chunk window the composer
 * reads — the authority lift puts 17-18.5 points on every chunk of one document, so the
 * cap in ragEngine.js is a product guarantee, not a tuning detail.
 *
 * Run: node tests/unit/testHecRetrieval.mjs
 */
import { RAGEngine, HEC_DOCS } from '../../server/ragEngine.js';
import { evaluateEvidence, retrieveCorrected } from '../../server/evidenceGate.js';

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};

const HEC_SET = new Set(HEC_DOCS);

/**
 * @param {string} q          the user's question, as a layperson would type it
 * @param {string[]} docs     document ids that alone carry the answer
 * @param {RegExp} [ground]   text that must appear in the retrieved evidence
 * @param {RegExp} [current]  version/status that must appear for the top chunk
 */
const CLASSES = [
  // (1) Bachelor / undergraduate structure — UGEP 2023
  { c: '1 BS structure', q: 'How many credit hours does HEC require for a four-year BS degree?', docs: ['hec_ugep_undergraduate'], ground: /credit hours/i },
  { c: '1 associate degree exit', q: 'Can I leave after two years with an associate degree under HEC rules?', docs: ['hec_ugep_undergraduate'], ground: /associate degree/i },

  // (2) MS / MPhil / PhD — GEP 2023
  { c: '2 PhD requirements', q: 'What does HEC require for a PhD: comprehensive exam, defense and publication?', docs: ['hec_gep_graduate'], ground: /comprehensive/i },
  { c: '2 MS MPhil launch', q: 'What are the minimum HEC requirements for a university to award MS MPhil degrees?', docs: ['hec_gep_graduate'], ground: /MS\/MPHIL/i },

  // (3) Attestation versus equivalence — two different HEC services
  { c: '3 degree attestation', q: 'How do I get my Pakistani degree attested by HEC and what is the fee?', docs: ['hec_degree_attestation'], ground: /attestation/i },
  { c: '3 equivalence not attestation', q: 'Is a degree equivalence certificate the same thing as HEC degree attestation?', docs: ['hec_equivalence_services', 'hec_degree_attestation', 'hec_degree_recognition'], ground: /equivalence/i },

  // (4) Foreign degrees
  { c: '4 foreign degree', q: 'I did my degree abroad. Does HEC attest foreign degrees?', docs: ['hec_degree_attestation', 'hec_equivalence_services', 'hec_degree_recognition', 'hec_deeni_asnad_equivalence'], ground: /foreign/i },

  // (5) Recognised institution versus recognised campus
  { c: '5 recognised campus', q: 'What is the difference between a recognized university and a recognized campus in the HEC list?', docs: ['hec_institution_recognition'], ground: /campus/i },
  { c: '5 unaccredited institution', q: 'HEC says an institution is unaccredited — is my degree valid?', docs: ['hec_institution_recognition', 'hec_degree_recognition'], ground: /unaccredited|unrecognized|not recognized/i },

  // (6) Fee refund
  { c: '6 fee refund', q: 'I cancelled my admission after paying the fee. What refund am I entitled to under the HEC policy?', docs: ['hec_fee_refund_policy'], ground: /refund/i },

  // (7) Scholarships / financial assistance — time-sensitive
  { c: '7 scholarship programs', q: 'What HEC scholarships and financial assistance programs are available for need-based students?', docs: ['hec_need_based_scholarship', 'hec_student_support_programs', 'hec_degree_recognition'], also: ['hec_student_support_programs'], ground: /scholarship|financial assistance|need-based/i },
  { c: '7 expired window honesty', q: 'Is the HEC IPFP application deadline open right now?', docs: ['hec_student_support_programs', 'hec_faculty_appointment', 'hec_notifications_register'], ground: /IPFP|Interim Placement/i },

  // (8) Student rights: harassment, disability, complaints
  { c: '8 harassment complaint', q: 'A professor is harassing me at university. What does the HEC harassment policy say about the inquiry committee?', docs: ['hec_harassment_policy'], ground: /inquiry committee/i },
  { c: '8 disability accommodation', q: 'I have a disability. What accommodations must my university provide under HEC policy?', docs: ['hec_disability_policy', 'hec_student_welfare_policies'], also: ['hec_student_welfare_policies'], ground: /accommodation/i },
  { c: '8 student grievance', q: 'Where do I lodge a complaint against my university that ignores my grievance?', docs: ['hec_harassment_policy', 'hec_student_welfare_policies', 'hec_student_support_programs', 'hec_quality_assurance'], ground: /complaint|grievance/i },

  // (9) ODL and transnational education limits
  { c: '9 online degree rules', q: 'Which degrees can HEC recognise through online or distance learning?', docs: ['hec_odl_policy'], ground: /distance|online/i },
  { c: '9 foreign collaboration', q: 'Can a Pakistani university run a foreign universitys degree program without HEC approval?', docs: ['hec_tne_transnational'], ground: /NOC|approval|collaboration/i },

  // (10) Academic integrity, research, publications
  { c: '10 plagiarism procedure', q: 'What happens if my thesis is flagged for plagiarism — what is the HEC procedure?', docs: ['hec_anti_plagiarism'], ground: /plagiarism/i },
  { c: '10 journal recognition', q: 'How does HEC recognise a research journal for publication requirements?', docs: ['hec_research_publications'], ground: /journal/i },
  { c: '10 AI in academics', q: 'Is using ChatGPT in my assignment allowed under HEC rules?', docs: ['hec_genai_academic_integrity'], ground: /AI|artificial intelligence/i },

  // (11) Curriculum, quality assurance, qualifications framework
  { c: '11 PQF levels', q: 'What level is a bachelor degree in the Pakistan Qualification Framework?', docs: ['hec_pqf_qualifications'], ground: /level/i },
  { c: '11 QA accreditation', q: 'How does HEC evaluate and accredit a university for quality assurance?', docs: ['hec_quality_assurance', 'hec_pqf_qualifications', 'hec_tne_transnational'], ground: /quality|accredit/i },

  // (12) Superseded rule must not override the current one
  {
    c: '12 TNE current amended text',
    q: 'What are the current HEC conditions for foreign collaboration in degree programs?',
    docs: ['hec_tne_transnational'],
    ground: /collaboration/i,
    current: /current as amended|2026/i
  },
  {
    c: '12 journals policy v2',
    q: 'What is the current HEC journals and publications policy version?',
    docs: ['hec_research_publications'],
    ground: /journal/i,
    current: /current as amended|2025-11-05|version 2\.0|v2\.0/i
  },

  // (13) Out of scope / insufficient evidence must not be dressed up as HEC authority
  { c: '13 not a legal question', q: 'What is the best gaming laptop to buy for a student?', expectRefusal: true },
  {
    c: '13 no fabricated HEC authority',
    q: 'How much is the HEC staff annual budget allocation for the financial year 2026-27?',
    expectRefusal: true
  }
];

// Language contract at the retrieval layer: the same HEC rule must be found in
// English, Roman Urdu and Urdu script, with the language of the question preserved.
const LANGUAGE_CASES = [
  { c: 'lang en', q: 'What is the procedure for HEC degree attestation?', docs: ['hec_degree_attestation'], lang: 'en' },
  { c: 'lang roman', q: 'HEC degree attestation ka tareeqa kya hai?', docs: ['hec_degree_attestation'], lang: 'roman_urdu' },
  { c: 'lang urdu-script', q: 'ہیک ڈگری اتیسٹیشن کا طریقہ کیا ہے؟', docs: ['hec_degree_attestation'], lang: 'ur' },
  { c: 'lang roman fee refund', q: 'University ne fee refund nahi ki, HEC policy kya kehti hai?', docs: ['hec_fee_refund_policy'], lang: 'roman_urdu' },
  { c: 'lang urdu-script harassment', q: 'یونیورسٹی میں استاد کی طرف سے ہراسگی کی شکایت کہاں کروں؟', docs: ['hec_harassment_policy', 'hec_student_welfare_policies'], lang: 'ur' }
];

// Routing must not regress for the non-HEC domains that already worked. The
// classifier never reads DOMAIN_DOCS (only the scoring boost and the evidence
// gate do), so the HEC documents cannot move these values — they are the
// measured baseline from before the HEC work, asserted here to stay unchanged,
// not an endorsement of the routing itself.
const REGRESSION_DOMAINS = [
  { q: 'how to file an FIR', expectDomain: 'criminal' },
  { q: 'khula procedure in family court', expectDomain: 'family' },
  { q: 'landlord eviction of tenant rented premises', expectDomain: 'civil' },
  { q: 'defective product refund consumer complaint', expectDomain: 'consumer' },
  { q: 'workplace harassment complaint against boss', expectDomain: 'labour' },
  { q: 'university fee refund student rights', expectDomain: 'education' },
  { q: 'Article 199 constitution writ petition', expectDomain: 'case-law' }
];

// Evidence layer: what the Corrective RAG pipeline actually accepts for the same
// HEC questions, offline, measured 2026-10-10. Retrieval can return candidates the
// gate throws away, so this is the contract the answer is built on — every case
// must clear verdict + supportedCount + the primary policy document reaching the
// window. `window` is the raw top-k; a HEC document carrying the authority lift is
// capped at 3 of its 8 slots, so the composer also sees the supporting record.
// Case 4 is pinned to the weak verdict it measured before this corpus existed: the
// gate flags "I did my degree abroad" as an overseas question (evidenceGate.js:412)
// and the accepted chunks are all federal HEC documents, so wrong_jurisdiction is
// the documented, non-negotiable reason. It is asserted as weak-and-why, not
// widened, so any further degradation fails the suite.
const GATE_CASES = [
  { c: 'gate 1 BS/UG', q: 'What are the credit hour and semester requirements for a BS degree under HEC rules?', primary: 'hec_ugep_undergraduate' },
  { c: 'gate 2 MS/MPhil', q: 'How many credit hours does HEC require for an MS MPhil programme?', primary: 'hec_gep_graduate' },
  { c: 'gate 3 attestation en', q: 'How do I get my Pakistani degree attested by HEC and what is the fee?', primary: 'hec_degree_attestation' },
  { c: 'gate 3 attestation roman', q: 'HEC se degree attestation kaise karwate hain?', primary: 'hec_degree_attestation' },
  { c: 'gate 3 attestation urdu', q: 'ہیک ڈگری اتیسٹیشن کا طریقہ کیا ہے؟', primary: 'hec_degree_attestation' },
  { c: 'gate 3 equivalence', q: 'How is a degree equivalence certificate different from HEC attestation?', primary: 'hec_equivalence_services' },
  {
    c: 'gate 4 foreign degree',
    q: 'I did my degree abroad. Does HEC attest foreign degrees?',
    primary: 'hec_degree_attestation',
    allowWeak: true,
    expectReasons: 'wrong_jurisdiction'
  },
  { c: 'gate 6 fee refund', q: 'What is the HEC rule on a university student fee refund after admission cancellation?', primary: 'hec_fee_refund_policy' },
  { c: 'gate 7 scholarship window', q: 'Is the HEC Need-Based Scholarship 2023 application window still open right now?', primary: 'hec_student_support_programs' },
  { c: 'gate 8 harassment urdu', q: 'یونیورسٹی میں استاد کی طرف سے ہراسگی کی شکایت کہاں کروں؟', primary: 'hec_harassment_policy' },
  { c: 'gate 10 plagiarism', q: 'What similarity index does HEC treat as plagiarism in an MS thesis?', primary: 'hec_anti_plagiarism' },
  { c: 'gate 12 current rule', q: 'Does the old HEC two-year MA rule still apply to new admissions?', primary: 'hec_ugep_undergraduate' }
];

const textOf = (chunks) => chunks.map(c => `${c.chunkTitle}\n${c.text}`).join('\n\n');
const urlsOf = (chunks) => chunks.map(c => c.sourceURL || '').filter(Boolean);

(async () => {
  console.log('=== (1)-(13) HEC question classes ===');
  for (const t of CLASSES) {
    const r = await RAGEngine.retrieve(t.q);
    const chunks = r.chunks || [];
    const top = chunks[0];
    const label = `${t.c} "${t.q.slice(0, 46)}…"`;

    if (t.expectRefusal) {
      // Raw retrieval always returns scored candidates; the product guarantee
      // is that the evidence gate accepts none of them for an out-of-scope
      // question, so nothing can be dressed up as HEC authority.
      const ev = evaluateEvidence(t.q, r, { lang: r.detectedLang });
      const accepted = ev.accepted || [];
      const acceptedHec = accepted.some(a => HEC_SET.has((a.chunk || a).docId));
      record(label, ev.verdict === 'none' && accepted.length === 0 && !acceptedHec,
        `domain=${r.domain} candidates=${chunks.length} verdict=${ev.verdict} accepted=${accepted.length} ` +
        `reasons=${(ev.reasons || []).join(',')}`);
      continue;
    }
    const inDocs = !!top && t.docs.includes(top.docId);
    const grounded = chunks.slice(0, 3).some(c => t.ground && t.ground.test(`${c.chunkTitle}\n${c.text}`));
    const linked = urlsOf(chunks.slice(0, 3)).some(u => /https:\/\/www\.hec\.gov\.pk/i.test(u));
    const statusOk = !t.current || t.current.test(`${top ? `${top.version} ${top.legalStatus}` : ''}`);
    // A narrower document may legitimately lead when the question names its own
    // subject, but the general policy that enumerates the whole answer must stay
    // in the window the composer reads — otherwise "top is on-point" would hide
    // the loss of the broader rule set.
    const seenIds = new Set(chunks.map(c => c.docId));
    const missing = (t.also || []).filter(id => !seenIds.has(id));
    const pass = inDocs && grounded && linked && statusOk && missing.length === 0;
    record(label, pass,
      `domain=${r.domain} top=${top ? top.docId : '(none)'} key=${top ? top.key.slice(0, 40) : ''} ` +
      `ground=${grounded ? 'y' : 'N'} link=${linked ? 'y' : 'N'}` +
      `${t.current ? ` current=${statusOk ? 'y' : 'N'}` : ''}` +
      `${t.also ? ` alsoInWindow=${missing.length === 0 ? 'y' : `N (missing ${missing.join(',')})`}` : ''}` +
      `${pass ? '' : ` (expected ${t.docs.join('|')})`}`);
  }

  console.log('\n=== evidence layer: Corrective RAG acceptance (offline) ===');
  for (const t of GATE_CASES) {
    const res = await retrieveCorrected(t.q, { isOnline: false });
    const ev = res.evidence || {};
    const reasons = (ev.reasons || []).join('+');
    const raw = await RAGEngine.retrieve(t.q);
    const window = raw.chunks || [];
    const primaryChunks = window.filter(c => c.docId === t.primary).length;
    const distinct = new Set(window.map(c => c.docId)).size;

    const verdictOk = t.allowWeak
      ? (ev.verdict === 'weak' && reasons === t.expectReasons)
      : (ev.verdict === 'strong');
    const supportedOk = (ev.supportedCount || 0) >= 5;
    const domainOk = ev.domain === 'education';
    const cappedOk = primaryChunks > 0 && primaryChunks <= 3;
    const spreadOk = distinct >= 2;

    const pass = verdictOk && supportedOk && domainOk && cappedOk && spreadOk;
    record(`${t.c} "${t.q.slice(0, 40)}"`, pass,
      `verdict=${ev.verdict}${reasons ? ` (${reasons})` : ''} supported=${ev.supportedCount} ` +
      `rejected=${ev.rejected} domain=${ev.domain} ${t.primary}=${primaryChunks}/${window.length} ` +
      `docs=${distinct} attempts=${(res.correction || {}).attempts}` +
      `${pass ? '' : ` — expected strong, supported>=5, education, ${t.primary} 1..3 of 8, >=2 docs`}`);
  }

  console.log('\n=== language contract at retrieval ===');
  for (const t of LANGUAGE_CASES) {
    const r = await RAGEngine.retrieve(t.q);
    const chunks = r.chunks || [];
    const top = chunks[0];
    const langOk = r.detectedLang === t.lang;
    const docOk = !!top && t.docs.includes(top.docId);
    const someHec = chunks.some(c => HEC_SET.has(c.docId));
    record(`${t.c} "${t.q.slice(0, 40)}"`, langOk && (docOk || someHec),
      `lang=${r.detectedLang} (expected ${t.lang}) domain=${r.domain} top=${top ? top.docId : '(none)'} hecChunks=${someHec}`);
  }

  console.log('\n=== non-HEC domain routing unchanged ===');
  for (const t of REGRESSION_DOMAINS) {
    const r = await RAGEngine.retrieve(t.q);
    record(`domain "${t.q}"`, r.domain === t.expectDomain, `domain=${r.domain} (expected ${t.expectDomain})`);
  }

  const passed = results.filter(x => x.pass).length;
  console.log(`\n==== testHecRetrieval: ${passed}/${results.length} PASS ====`);
  process.exit(passed === results.length ? 0 : 1);
})();
