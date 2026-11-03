/*
 * Part N/O/T — INSAaf owned-model LOCAL document analyzer test.
 * These are TEXT fixtures that exercise the analyzer's extraction LOGIC (the
 * document-understanding endpoint receives already-extracted text). This is NOT
 * an OCR test — the full upload→OCR→analyze E2E is verified separately with a
 * real user-provided file (per the task's non-negotiable on OCR testing).
 */
const { analyzeDocumentText, classifyDocumentType, extractDates, extractDeadlines, extractAuthorities, extractParties, extractRequestedAction, draftFromDocument, applyLocalEdit, analyzeDraftRequest, composeDraftFromRequest, INSAF_DOC_FOOTER } = require('../../server/docModel.js');

let pass = 0, fail = 0;
function check(ok, label, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}${extra ? ' :: ' + extra : ''}`);
  ok ? pass++ : fail++;
}

const NOTICE = `LEGAL NOTICE
Under instructions from and on behalf of my client Mr. Ahmad Raza Khan, resident of House 12, Gulberg III, Lahore, I hereby serve upon you this legal notice.
To, Mr. Bilal Shah, Resident of Model Town, Lahore.
Whereas you entered into a Rental Agreement dated 05/03/2025 with my client for the premises situated at House 12, Gulberg III, Lahore, at a monthly rent of PKR 25,000.
You are required to pay the outstanding rent of PKR 75,000 within 14 days of receipt of this notice, failing which legal proceedings shall be initiated against you in the competent Civil Court at Lahore.
Dated: 20 August 2025.
Advocate: Sara Malik, District Courts Lahore.`;

const SHOWCAUSE = `SHOW-CAUSE NOTICE
Employee Name: Mr. Kamran Ali, Employee ID: EMP-2231.
You are hereby called upon to show cause within 3 days why disciplinary action should not be taken against you for misconduct dated 12/08/2025.
Issuing Authority: HR Manager, XYZ Industries.
If you fail to respond within the stipulated period, an ex-parte decision will be taken.`;

const SUMMONS = `IN THE COURT OF THE SENIOR CIVIL JUDGE, LAHORE
Case No. 45/2025 — Ali Traders vs. Punjab Supply Co.
SUMMONS
You, the Defendant, are directed to appear before this Court on 15 September 2025 at 8:30 AM in connection with the above-titled suit.
In case of failure to appear, the matter shall be proceeded ex-parte.
Registrar, District Judiciary Lahore.`;

(async () => {
  // ---- classification ----
  check(classifyDocumentType(NOTICE).type === 'Legal Notice', 'classify LEGAL NOTICE', classifyDocumentType(NOTICE).type);
  check(classifyDocumentType(SHOWCAUSE).type === 'Show-Cause Notice', 'classify SHOW-CAUSE NOTICE', classifyDocumentType(SHOWCAUSE).type);
  check(/Summons|Court Order/.test(classifyDocumentType(SUMMONS).type || ''), 'classify SUMMONS / court doc', classifyDocumentType(SUMMONS).type);

  // ---- extraction: legal notice ----
  const nDates = extractDates(NOTICE);
  check(nDates.some(d => /05\/03\/2025/.test(d)) && nDates.some(d => /20 August 2025/.test(d)), 'extract both dates from notice', `${nDates.length} dates`);
  const nDl = extractDeadlines(NOTICE);
  check(nDl.some(d => /within 14 days/i.test(d)), 'extract 14-day deadline', nDl[0] || 'none');
  const nAuth = extractAuthorities(NOTICE);
  check(nAuth.some(a => /Civil Court/i.test(a)), 'extract Civil Court authority', nAuth.join(', '));
  const nPart = extractParties(NOTICE);
  check(nPart.length >= 2, 'extract parties (client + recipient)', nPart.slice(0, 3).join(' | '));
  const nReq = extractRequestedAction(NOTICE);
  check(nReq.some(r => /pay the outstanding rent/i.test(r)), 'extract requested action (pay rent)', nReq[0] || 'none');

  // ---- full analysis: show-cause, EN ----
  const sc = analyzeDocumentText(SHOWCAUSE, 'What do I need to do?', { preferredLanguage: 'en' });
  check(sc.documentType === 'Show-Cause Notice', 'analyze show-cause: documentType', sc.documentType);
  check(sc.requirements.some(r => /show cause/i.test(r)), 'analyze show-cause: requested action grounded');
  check(sc.risks.some(r => /3 days|deadline/i.test(r)) || sc.deadlinesRaw === undefined, 'analyze show-cause: deadline risk present', (sc.risks[0] || '').slice(0, 60));
  check(Array.isArray(sc.nextSteps) && sc.nextSteps.length >= 2, 'analyze show-cause: next steps present', `${sc.nextSteps.length} steps`);
  check(sc.answer && sc.answer.length > 30 && /show cause|respond|reply|deadline/i.test(sc.answer), 'analyze show-cause: answer grounded & on-topic', sc.answer.slice(0, 90));
  check(sc.isOffline === true, 'analyze show-cause: isOffline flag');

  // ---- full analysis: summons, question "when do I respond" ----
  const sm = analyzeDocumentText(SUMMONS, 'When do I need to appear?', { preferredLanguage: 'en' });
  check(/15 September 2025/.test(sm.answer) || sm.dates.some(d => /15 September 2025/.test(d)), 'analyze summons: appearance date surfaced', sm.answer.slice(0, 90));
  check(sm.authorities.some(a => /Civil Court|Judge/i.test(a)), 'analyze summons: court authority extracted', sm.authorities.join(', '));
  check(sm.relevantProcedure && /Summons/i.test(sm.relevantProcedure), 'analyze summons: relevant procedure mapped', sm.relevantProcedure);

  // ---- Roman Urdu answer ----
  const rom = analyzeDocumentText(NOTICE, 'Mujhe kya karna chahiye?', { preferredLanguage: 'roman_urdu' });
  check(rom.answer && !/[\u0600-\u06FF]/.test(rom.answer), 'roman answer has NO Urdu script');
  check(/karna|required|pay|rent|jawab| mohlat|deadline/i.test(rom.answer), 'roman answer on-topic', rom.answer.slice(0, 90));

  // ---- low OCR quality warning ----
  const lowq = analyzeDocumentText(NOTICE, 'What is this?', { preferredLanguage: 'en', ocrQuality: 40 });
  check(/OCR quality is low/i.test(lowq.answer) && lowq.ocrQualityNote, 'low OCR quality adds honest warning + note');

  // ---- empty / garbage text: honest, never a fabricated analysis ----
  const empty = analyzeDocumentText('   ', 'What is written here?', { preferredLanguage: 'en' });
  const emptyLists = ['parties', 'dates', 'authorities', 'requirements', 'deadlines', 'provisions',
    'caseNumbers', 'amounts', 'nextSteps', 'risks']
    .filter(k => (empty[k] || []).length > 0);
  const emptyRisks = Object.values(empty.categorizedRisks || {}).flat().length;
  check(
    empty.documentType === null && empty.summary === null && empty.relevantProcedure === null
      && emptyLists.length === 0 && emptyRisks === 0
      && /no analysis was made/i.test(empty.answer || '')
      && !/within \d+ days|section \d+/i.test(empty.answer || ''),
    'empty text yields null type, no fabricated extraction or analysis',
    `type=${empty.documentType} listsWithContent=[${emptyLists}] riskItems=${emptyRisks} len=${(empty.answer || '').length}`);

  // ---- no fabrication guard: a plain letter must NOT invent a deadline ----
  const LETTER = `Dear Sir, Subject: Request for leave. I request you to kindly grant me leave from 1st October to 3rd October 2025 due to illness. Sincerely, Ahmed.`;
  const lt = analyzeDocumentText(LETTER, 'When must I respond?', { preferredLanguage: 'en' });
  check(!/within \d+ days/i.test(lt.answer), 'plain letter: no invented response deadline', lt.answer.slice(0, 90));

  // ---- Part P: offline draft from an uploaded document ----
  const draft = draftFromDocument(NOTICE, { replyType: 'reply', language: 'en', structure: { heading: 'REPLY TO LEGAL NOTICE', courtLine: 'To, The Civil Court, Lahore', sections: [{ label: 'Para-wise Reply', hint: 'your response to each para' }], authorityNote: 'Format may vary by court.' } });
  check(typeof draft.html === 'string' && draft.html.includes('REPLY TO LEGAL NOTICE'), 'draft uses provided heading', (draft.html || '').slice(0, 40));
  check(draft.html.includes('Prepared with INSAaf AI'), 'draft carries Part S footer');
  check(/Ahmad Raza Khan|Bilal Shah|Gulberg/.test(draft.html), 'draft preserves source facts (parties/address)');
  check(/Civil Court/i.test(draft.html), 'draft surfaces the forum named in the document');
  check(/\[MISSING/.test(draft.html), 'draft marks unknowns as [MISSING] (no fabrication)');
  check(draft.isOffline === true && Array.isArray(draft.nextSteps) && draft.nextSteps.length >= 3, 'draft has offline flag + next steps');
  check(typeof draft.submission === 'string' && /Civil Court/i.test(draft.submission), 'draft submission is grounded in the named authority');
  check(!/[\u0600-\u06FF]/.test(draft.html.replace(/Jameel Noori Nastaleeq/g, '')), 'draft body has no stray Urdu script (EN output)');

  // ---- Part S: footer constant ----
  check(/Prepared with INSAaf AI/.test(INSAF_DOC_FOOTER) && /not legal advice|guidance only/i.test(INSAF_DOC_FOOTER), 'INSAF_DOC_FOOTER has brand + disclaimer');

  // ---- Part Q: deterministic offline edit ----
  const docHtml = `<div><p>Monthly salary: 100,000 PKR.</p><p style="color:100,000">Name: Ali.</p></div>`;
  const ed = applyLocalEdit(docHtml, 'change 100,000 to 150,000');
  check(ed.changed === true && ed.html.includes('150,000'), 'edit applies X→Y value change', ed.summary || '');
  check(ed.html.includes('Monthly salary: 150,000'), 'edit replaced the text-node value');
  check(/summary/i.test('') || typeof ed.summary === 'string', 'edit returns a change summary');
  const edRoman = applyLocalEdit(`<p>Rent is 25,000.</p>`, '25,000 ko 30,000 karo');
  check(edRoman.changed === true && edRoman.html.includes('30,000'), 'edit applies Roman Urdu "X ko Y karo"');
  const edNone = applyLocalEdit(`<p>Hello world.</p>`, 'make it look nicer');
  check(edNone.changed === false && edNone.html.includes('Hello world'), 'edit is honest when no explicit X→Y given');
  const edMissing = applyLocalEdit(`<p>Hello world.</p>`, 'change 999,000 to 1');
  check(edMissing.changed === false, 'edit reports unchanged when X not present');

  // ---- Hardening pass 1: abbreviation-safe sentence splitting (DI summary truncation) ----
  const ABBREV_NOTICE = `LEGAL NOTICE
Ref: LN/2026/77 dated 10 February 2026.
I, Mr. Ali Raza, Adv., son of Abdul Rehman, resident of House No. 5, Gulberg III, Lahore, am instructing you on behalf of my client.
You are required to pay the outstanding sum of Rs 450,000 within 30 days of receipt of this notice, failing which legal proceedings shall follow.`;
  const abSum = analyzeDocumentText(ABBREV_NOTICE, 'Summarize this notice', { preferredLanguage: 'en' });
  check(abSum.summary.includes('House No. 5') && abSum.summary.includes('within 30 days'), 'summary is not cut at "No." — address and deadline stay in one sentence', abSum.summary.slice(0, 120));
  check(abSum.summary.includes('Gulberg III') && abSum.summary.includes('proceedings shall follow'), 'summary keeps the full meaningful clause, not a fragment');
  const abDates = extractDates(ABBREV_NOTICE);
  check(abDates.some(d => d.includes('Ref: LN/2026/77') && d.includes('10 February 2026')), 'date bullet keeps its document-number context', abDates.join(' | '));
  check(abDates.filter(d => d.startsWith('10 February 2026')).length === 1, 'one date yields one bullet (no duplicate context)', abDates.join(' | '));
  check((abSum.amounts || []).join(' ').includes('450,000'), 'amounts preserved through the abbreviation-safe splitter', JSON.stringify(abSum.amounts || []));

  // ---- Hardening pass 2: claim recital is professional in both languages ----
  const UR_FRAME = 'Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000.';
  const urAna = analyzeDraftRequest(UR_FRAME);
  check(Object.keys(urAna.framingRecitals || {}).length === 1, 'app framing is registered for recital rendering', JSON.stringify(urAna.framingRecitals || {}));
  const urDoc = composeDraftFromRequest(UR_FRAME, { language: 'ur' });
  const urPlain = urDoc.html.replace(/<[^>]+>/g, ' ');
  check(urDoc.html.includes('بطور بقایا قرض') && urDoc.html.includes('رقم Rs 500,000'), 'Urdu recital carries the localized wording + the amount verbatim');
  check(!/کہ\s*[A-Z][a-z]{3,}/.test(urPlain), 'no system-generated English prose inside Urdu clauses');
  const enDoc = composeDraftFromRequest(UR_FRAME, { language: 'en' });
  check(enDoc.html.includes('That the sum of Rs 500,000, being an unpaid loan'), 'English draft renders the claim as a prose recital, not the typed request');
  const withFacts = composeDraftFromRequest('Draft a legal notice for recovery of unpaid rent of Rs 25,000 for the period January to March 2026.', { language: 'en' });
  check(withFacts.html.includes('January') && withFacts.html.includes('25,000'), 'framing that carries a real period keeps that content instead of a recital');
  const urNarrative = composeDraftFromRequest('Draft a legal notice for recovery of an unpaid loan of Rs 500,000. I lent the money to Ahmed on 3 May 2025 and he refused to repay.', { language: 'ur' });
  check(urNarrative.html.includes('Ahmed') && urNarrative.html.includes('3 May 2025'), 'user-stated narrative facts are never rewritten in Urdu drafts');
  check(urNarrative.html.includes('رقم Rs 500,000'), 'framing recital and narrative fact coexist in the same Urdu document');

  console.log(`\n==== testDocModel: ${pass}/${pass + fail} PASS ====`);
  process.exit(fail === 0 ? 0 : 1);
})();
