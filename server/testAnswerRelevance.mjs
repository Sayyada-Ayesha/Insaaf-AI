/**
 * server/testAnswerRelevance.mjs — answer-relevance evaluation suite.
 *
 * Runs real questions against the live /api/ai/chat endpoint and grades the
 * ANSWER, not the HTTP status. Every expectation is grounded in an identifiable
 * corpus record (cited next to the case below); nothing here asserts an invented
 * "correct legal answer".
 *
 * Usage:  node server/testAnswerRelevance.mjs [--verbose]
 * Env:    INSAAF_BASE (default http://localhost:3001)
 *
 * RUBRIC (a 0-100 number is NOT produced; these are counts, not probabilities)
 *   PASS      — the answer addresses the actual issue, every required fact is
 *               present, no forbidden wrong-issue framing, zero unsupported
 *               provisions, zero answer URLs outside its own evidence cards,
 *               zero multi-word quotations absent from its own evidence cards,
 *               and the jurisdiction expectation holds.
 *   PARTIAL   — addresses the issue and stays safe, but a required fact is
 *               missing or the jurisdiction expectation is only implied.
 *   ABSTAIN   — the corpus does not establish the answer and the app said so
 *               (stated limitation + human/legal-aid routing). PASS when
 *               abstention is the correct behaviour (gap: true).
 *   FAIL      — wrong issue, invented content, or a silent generic answer to a
 *               question the corpus cannot support.
 */
const BASE = process.env.INSAAF_BASE || 'http://localhost:3001';
const VERBOSE = process.argv.includes('--verbose');

const URL_RE = /https?:\/\/[^\s)"'\]]+/g;
// A quoted span must stay inside one line and carry no markup: the composer's
// own bold headings contain " characters, and a regex that crossed them
// reported the whole answer body as one invented quotation.
const QUOTE_RE = /["“”]([^"“”\n*]{18,})["“”]/g;

// Normalise a quoted span for verbatim comparison against record text.
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?–—-]+/g, ' ').trim();

const CASES = [
  {
    id: 'R1_ragging_not_recovery',
    label: 'ragging complaint stays a university complaint (never a Recovery Suit)',
    // corpus: student/discipline_grievance.txt:157 + student/hostel_accommodation.txt:147
    question: 'Final-year students in my hostel at a university in Sindh keep ragging the first-year students, forcing them to do things they do not want to do and humiliating them. I want to complain about the seniors.',
    issue: 'university ragging / harassment complaint',
    jurisdiction: 'Sindh',
    issueCues: [/ragging|hazing/i, /harassment|disciplinary|committee|warden/i],
    factGroups: [[/disciplinary committee|anti-harassment|committee|warden/i, /police|fir/i]],
    // A recovery suit / money-recovery framing is the reported defect.
    forbidden: [/recovery suit|civil suit|\bplaint\b|recovery of (?:money|damages)/i, /consumer (?:court|complaint)/i],
    gap: false
  },
  {
    id: 'R2_fee_refund_not_consumer',
    label: 'university fee refund answers from the HEC refund tiers (never a Consumer Complaint)',
    // corpus: student/admissions_fees.txt:42-46,51
    question: 'I cancelled my university admission five days after classes started. I had paid the semester tuition fee and the security deposit. What refund am I entitled to?',
    issue: 'university fee refund entitlement',
    jurisdiction: 'national (HEC)',
    issueCues: [/refund/i, /tuition|fee|deposit/i],
    factGroups: [[/100%|full|complete\s*refund/i], [/security deposit/i], [/30 days/i]],
    forbidden: [/consumer (?:court|complaint|protection) act|consumer (?:court|complaint)/i, /recovery suit|civil suit|\bplaint\b/i],
    gap: false
  },
  {
    id: 'R3_internal_appeal_not_court',
    label: 'internal suspension appeal routes to the university appellate authority first',
    // corpus: student/discipline_grievance.txt:100-121
    question: 'My university suspended me for one semester after a disciplinary inquiry. I want to challenge the suspension inside the university system. What is the appeal process and how long do I have?',
    issue: 'internal university disciplinary appeal',
    jurisdiction: 'institutional (university statutes)',
    issueCues: [/appeal/i, /vice[\s-]?chancellor|syndicate|appellate authority|i\s+can\s+appeal|university/i],
    factGroups: [[/15|30 days|within 30/i]],
    // The court route may be mentioned as a LATER option; it must not be the answer's own framing.
    forbidden: [/file (?:a|your) (?:petition| writ petition|case)|writ petition in the high court|hon\'?able court/i],
    gap: false
  },
  {
    id: 'R4_student_rights_context',
    label: 'withheld-transcript question answered in university context, not Article 25A alone',
    // corpus: student/academic_rules.txt:111, student/examination_rules.txt:152, education/education.txt:58
    question: 'My university is refusing to issue my transcript until I clear unpaid hostel dues. As a student, what are my rights in this situation?',
    issue: 'student rights — transcript with withheld dues',
    jurisdiction: 'institutional / national higher-education policy',
    issueCues: [/transcript/i, /hostel|due|university/i],
    factGroups: [[/withhold|cannot withhold|clear|outstanding|receipt|NOC|objection/i]],
    // Article 25A is the right to education (5-16) — it does not resolve a transcript dispute.
    forbidden: [/article\s*25a/i],
    forbiddenNote: 'Article 25A is only acceptable when the answer ALSO names the transcript rule',
    gap: false
  },
  {
    id: 'R5_sindh_not_punjab',
    label: 'a Sindh-specific question is not answered with Punjab procedure',
    // corpus: civic/civic_workflows.txt:55-69 (domicile workflow, provincial domicile rules)
    question: 'I live in Karachi, Sindh and need a domicile certificate for a government job. What is the procedure and what documents do I need in Sindh?',
    issue: 'Sindh domicile certificate procedure',
    jurisdiction: 'Sindh',
    issueCues: [/domicile/i, /sindh|karachi/i],
    factGroups: [[/deputy commissioner|tasildar|commissioner|application|form|NADRA|proof/i]],
    forbidden: [/punjab/i],
    gap: false
  },
  {
    id: 'R6_unsupported_gap_says_so',
    label: 'a question the corpus cannot support gets a limitation, not a generic answer',
    // corpus: no record mentions drones (verified: grep -rli drone rag/documents -> no files)
    question: 'A commercial drone keeps flying over my house in Islamabad and films my garden. Which Pakistani law specifically governs residential drone overflight and filming?',
    issue: 'drone overflight / aerial filming — outside the corpus',
    jurisdiction: 'ICT',
    issueCues: [/drone/i],
    factGroups: [[/do not have|not (?:found|available|verified)|no verified|cannot (?:confirm|verify)|limitation|currently (?:not|no)|unsure|not in (?:my|our) (?:verified )?(?:sources|data|corpus)|speak|consult|lawyer|legal aid|advocate/i]],
    forbidden: [],
    // This case must NOT produce a confident statutory answer.
    gap: true,
    mustNotInvent: true
  }
];

async function ask(question) {
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: question, preferredLanguage: 'en', responseDetail: 'standard', answerLevel: 'intermediate' })
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status} — not a payload problem, a transport problem`);
  const raw = await res.text();
  let text = '';
  const frames = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const body = line.slice(6).trim();
    if (!body || body === '[DONE]') continue;
    try { frames.push(JSON.parse(body)); } catch { /* ignore */ }
  }
  for (const f of frames) if (typeof f.chunk === 'string') text += (text ? '\n' : '') + f.chunk;
  const cards = [];
  for (const f of frames) if (Array.isArray(f.meta?.sources)) cards.push(...f.meta.sources);
  const last = frames[frames.length - 1] || {};
  return {
    text,
    cards,
    evidence: last.evidence || null,
    citationAudit: last.citationAudit || null,
    domain: last.evidence?.domain ?? null
  };
}

function grade(c, r) {
  const reasons = [];
  const cardUrls = new Set(r.cards.map(x => String(x.sourceURL || '')).filter(Boolean));
  const cardText = r.cards.map(x => norm(x.text)).join(' ||| ');
  // The composer echoes the question under an **Issue** heading. Grading the echo
  // would let any answer "address" any question — the baseline run passed a
  // ragging answer whose own body was scholarship-eligibility text. The echo is
  // removed before anything is scored.
  const a = r.text.replace(/\*\*Issue\*\*\s*\n[\s\S]*?(?=\n\*\*|$)/, '');
  // The direct-answer block is what must address the question. Crediting the
  // whole body let a ragging answer "pass" on words that appeared only in its
  // supporting list, while the Answer block was still scholarship criteria.
  const ansBlock = (() => {
    const m = /\*\*Answer\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/.exec(r.text);
    return m ? m[1].trim() : '';
  })();
  const direct = ansBlock || a;

  // 1. issue addressed — by the direct answer
  const issueHit = c.gap ? true : c.issueCues.every(re => re.test(direct));
  if (!issueHit) reasons.push('issue not addressed by the direct answer');

  // 2. jurisdiction expectation — the named jurisdiction must appear
  const jurHit = new RegExp(c.jurisdiction.replace(/\(.*?\)/g, '').trim(), 'i').test(a)
    || (/university|institution|statutes/i.test(c.jurisdiction) && /university|institution|statutes/i.test(a))
    || /national/i.test(c.jurisdiction);

  // 3. required facts — anywhere in the answer body
  const missingFacts = [];
  for (const group of c.factGroups) {
    if (!group.some(re => re.test(a))) missingFacts.push(String(group[0]));
  }

  // 4. wrong-issue framing
  const forbiddenHits = c.forbidden.filter(re => re.test(a)).map(String);

  // 5. invented URLs — an answer URL outside its own evidence cards
  const urls = [...new Set(r.text.match(URL_RE) || [])];
  const inventedUrls = urls.filter(u => !cardUrls.has(u));

  // 6. invented quotations — a multi-word quote not verbatim in the evidence.
  //    Only meaningful when the answer attributes anything to a record at all.
  const quotes = r.cards.length
    ? [...a.matchAll(QUOTE_RE)].map(m => norm(m[1])).filter(q => q.split(' ').length >= 4)
    : [];
  const inventedQuotes = quotes.filter(q => !cardText.includes(q));

  // 7. unsupported provisions — the server's own citation audit
  const audit = r.citationAudit || {};
  const unsupportedProvisions = [...(audit.notInEvidence || []), ...(audit.unknownProvisions || [])];

  // 8. generic legal padding that the question did not ask for
  const irrelevantSections = [];
  if (!/court|suit|petition|litigation/i.test(c.question)) {
    for (const heading of [/Recovery Suit/i, /Civil Court/i, /Consumer Court/i, /police station|FIR/i]) {
      if (heading.test(r.text) && !/fir|police/i.test(c.question)) irrelevantSections.push(String(heading));
    }
  }

  const safe = inventedUrls.length === 0 && inventedQuotes.length === 0 && unsupportedProvisions.length === 0;
  const routesRight = issueHit && forbiddenHits.length === 0;

  let result;
  if (c.gap) {
    // The correct behaviour is a visible limitation. A confident answer here is a FAIL.
    const refused = /not (?:found|available|verified|cover)|do not have|no verified|cannot (?:confirm|verify)|limitation|consult|lawyer|legal aid|advocate|currently/i.test(r.text);
    result = refused && safe ? 'PASS' : 'FAIL';
    if (!refused) reasons.push('answered an unsupported question without stating the limitation');
  } else if (!routesRight) {
    result = 'FAIL';
  } else if (!safe) {
    result = 'FAIL';
  } else if (missingFacts.length > 0 || !jurHit) {
    result = 'PARTIAL';
    if (missingFacts.length) reasons.push(`required fact missing: ${missingFacts.join(', ')}`);
    if (!jurHit) reasons.push(`jurisdiction "${c.jurisdiction}" not made explicit`);
  } else {
    result = 'PASS';
  }

  return {
    result,
    reasons,
    issueHit,
    jurHit,
    wrongIssue: forbiddenHits,
    irrelevantSections,
    inventedUrls,
    inventedQuotes,
    unsupportedProvisions,
    missingFacts,
    verdict: r.evidence?.verdict || null,
    gateReasons: r.evidence?.reasons || null,
    domain: r.domain,
    sources: r.cards.map(x => `${String(x.title || '').slice(0, 48)} [${String(x.jurisdiction || '?')}] score=${x.exactScore ?? r.evidence?.quality?.score ?? '-'}`),
    evidenceSnippet: String(r.cards[0]?.text || '').replace(/\s+/g, ' ').slice(0, 140)
  };
}

function main() {
  const rows = [];
  return (async () => {
    for (const c of CASES) {
      let graded;
      try {
        const r = await ask(c.question);
        graded = grade(c, r);
        graded.id = c.id; graded.label = c.label; graded.gap = c.gap; graded.q = c.question;
        if (VERBOSE) {
          console.log(`\n########## ${c.id} — ${c.label}\nQ: ${c.question}`);
          console.log(`--- ANSWER ---\n${r.text}`);
          console.log(`--- SOURCES ---\n${graded.sources.join('\n')}`);
          console.log(`--- EVIDENCE ---\n${graded.evidenceSnippet}`);
          console.log(`--- GATE --- verdict=${graded.verdict} reasons=${JSON.stringify(graded.gateReasons)} domain=${graded.domain}`);
        }
      } catch (e) {
        graded = { id: c.id, label: c.label, gap: c.gap, q: c.question, result: 'FAIL', reasons: [`request failed: ${e.message}`],
          wrongIssue: [], inventedUrls: [], inventedQuotes: [], unsupportedProvisions: [], missingFacts: [], sources: [],
          issueHit: false, jurHit: false, irrelevantSections: [] };
      }
      rows.push(graded);
      console.log(`${graded.result.padEnd(7)} ${graded.id}  verdict=${graded.verdict}  wrongIssue=${graded.wrongIssue.length} invUrl=${graded.inventedUrls.length} invQuote=${graded.inventedQuotes.length} badProv=${graded.unsupportedProvisions.length}${graded.reasons.length ? '  — ' + graded.reasons.join('; ') : ''}`);
    }

    const n = rows.length;
    const pass = rows.filter(r => r.result === 'PASS').length;
    const partial = rows.filter(r => r.result === 'PARTIAL').length;
    const fail = rows.filter(r => r.result === 'FAIL').length;
    const abstainCorrect = rows.filter(r => r.gap && r.result === 'PASS').length;
    const wrongIssue = rows.filter(r => r.wrongIssue.length > 0 || r.irrelevantSections.length > 0).length;
    const invUrls = rows.reduce((a, r) => a + r.inventedUrls.length, 0);
    const invQuotes = rows.reduce((a, r) => a + r.inventedQuotes.length, 0);
    const badProv = rows.reduce((a, r) => a + r.unsupportedProvisions.length, 0);
    const routed = rows.filter(r => r.issueHit && r.wrongIssue.length === 0).length;
    const jurOk = rows.filter(r => r.jurHit).length;

    console.log('\n===== ANSWER-QUALITY METRICS (counts, denominators in parentheses) =====');
    console.log(`1. Questions attempted                    : ${n}/${n}`);
    console.log(`2. Supported answers (PASS)               : ${pass}/${n}`);
    console.log(`3. Partial answers (PARTIAL)              : ${partial}/${n}`);
    console.log(`4. Safe abstentions (correct on gaps)     : ${abstainCorrect}/${rows.filter(r => r.gap).length} gap cases`);
    console.log(`5. Irrelevant / wrong-issue answers       : ${wrongIssue}/${n}`);
    console.log(`6. Answer-contract pass rate              : ${pass}/${n} = ${Math.round((pass / n) * 100)}% (diagnostic indicator, not a probability of legal correctness)`);
    console.log(`7. Unsupported provision/URL/quotation    : provisions ${badProv}, URLs ${invUrls}, quotations ${invQuotes}`);
    console.log(`8. Correct issue AND jurisdiction routing : ${routed}/${n} issue, ${jurOk}/${n} jurisdiction`);
    console.log(`   FAIL cases                             : ${fail}/${n} -> ${rows.filter(r => r.result === 'FAIL').map(r => r.id).join(', ') || 'none'}`);

    const failed = rows.filter(r => r.result === 'FAIL');
    if (failed.length) {
      console.log('\n===== FAIL DETAIL =====');
      for (const f of failed) console.log(`\n[${f.id}] ${f.label}\n  reasons: ${f.reasons.join('; ') || 'n/a'}\n  wrongIssue: ${JSON.stringify(f.wrongIssue)}\n  inventedUrls: ${JSON.stringify(f.inventedUrls)}\n  inventedQuotes: ${JSON.stringify(f.inventedQuotes)}\n  unsupportedProvisions: ${JSON.stringify(f.unsupportedProvisions)}\n  sources: ${f.sources.join(' | ')}`);
    }

    console.log(`\nRESULT: ${pass} PASS / ${partial} PARTIAL / ${fail} FAIL of ${n}`);
    process.exitCode = fail > 0 ? 1 : 0;
  })();
}

main();
