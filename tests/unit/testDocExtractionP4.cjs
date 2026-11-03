/*
 * P4 — Document Assistant extraction regression suite.
 * TEXT fixtures only: the document-understanding endpoint receives text that has
 * already been extracted, so this freezes the extraction and honesty rules. The
 * upload -> OCR -> analyze path is covered by the browser suite, never by
 * inventing OCR output here.
 */
const {
  analyzeDocumentText, extractDates, extractDeadlines, extractParties,
  extractAmounts, extractProvisions, compareDocumentsLocal, getReadinessChecklist
} = require('../../server/docModel.js');

let pass = 0, fail = 0;
const failures = [];
function check(ok, label, extra) {
  if (ok) { pass++; console.log(`PASS - ${label}`); }
  else { fail++; failures.push(label); console.log(`FAIL - ${label}${extra ? ' :: ' + extra : ''}`); }
}
const has = (arr, re) => (arr || []).some(x => re.test(x));

// ---------------------------------------------------------------- fixtures ----
const NOTICE = `LEGAL NOTICE
To: Mr. Asif Mehmood, Shop No. 4, Saddar, Karachi.
From: Sadia Khan, flat 12, Gulberg III, Lahore.
Dated: 15/03/2026
Under instruction from my client, you are hereby required to return the security deposit of Rs 250,000 within 30 days of receipt of this notice, failing which legal action shall follow against you under section 420 PPC.
This notice is issued on 15 March 2026 at Lahore.`;

const RENT = `RENT AGREEMENT
This agreement made on 1 April 2025 between landlord Tariq Mehmood and tenant Ali Raza for the property at House 22, DHA Phase 5, Lahore. Monthly rent Rs 45,000. Security deposit Rs 400,000 to be returned at vacating on 31 March 2026.`;

const FEE = `APPLICATION FOR REFUND OF UNIVERSITY FEES
To: The Registrar, University of Sindh, Jamshoro.
From: Ayesha Siddiqui, Roll No. 2021-CS-114.
Date: 02/11/2025
Subject: Request for refund of semester fee.
Due to medical reasons I could not attend the examination held on 20 October 2025. Kindly refund my paid fee of Rs 68,000 within 15 working days.`;

const ROMAN = `Sheri adalat mein darkhast.
Bewinder: Ali Raza, walid Raza Muhammad, kaifiyat: mulwazim, pata: 14-B Model Town, Lahore.
Aap ki khidmat mein mojooda halat yeh hai ke mera kirayedaar ne 25 March 2026 tak 2 lakh wapas karne the.
Mutabiq dhara 420 PPC.`;

const GARBAGE = 'Hire purchase agreement is about to expire due to every paper. To: every paper is required.';

const LETTER = `Dear Sir, Subject: Request for leave. I request you to kindly grant me leave from 1st October to 3rd October 2025 due to illness. Sincerely, Ahmed.`;

// A base64 blob — the shape a mis-encoded upload actually produces.
const BASE64_BLOB = 'JVpK9Q4RGVkQBQIARAQEBAQUFBQUFBQUFBQURPTUFJTkhlYWRlckRhdGFBbmRCeXRlcw=='.repeat(3);

(async () => {
  // ================================================================ DATES =====
  check(has(extractDates(NOTICE), /15\/03\/2026/), 'numeric date 15/03/2026 is extracted');
  check(has(extractDates('Notice issued on 2025-08-12 and served 12.09.2025.'), /2025-08-12/), 'ISO date is extracted');
  check(has(extractDates('Hearing on Sept 5, 2025 at 10 AM.'), /Sept 5, 2025/), 'abbreviated month date is extracted');
  check(has(extractDates('Dated 15 Mar 2026 at Lahore.'), /15 Mar 2026/), '"Dated 15 Mar 2026" is extracted');
  const bullets = extractDates(NOTICE);
  check(bullets.every(b => b.length <= 70) && bullets.some(b => /15\/03\/2026/.test(b) && /Dated/i.test(b)),
    'date context is the document line, not a run-on window', JSON.stringify(bullets));
  const dd = extractDates('Meeting on 15 March 2026. Dated 15 March 2026 at Lahore.');
  check(dd.length === 1, 'the same date is not listed twice (token dedupe)', JSON.stringify(dd));
  check(extractDates('Version 2.24.1 of the system and amount 1.200.500 are irrelevant.').length === 0,
    'version/serial numbers are NOT mistaken for dates');
  const ur = extractDates('۱۵/۰۳/۲۰۲۶ کو عملدرآمد ہوگا۔ مورخہ ۱۵ مارچ ۲۰۲۶');
  check(has(ur, /15 March 2026/) && has(ur, /15\/03\/2026/), 'Urdu-script dates normalize to Latin digits', JSON.stringify(ur));

  // =========================================================== DEADLINES =====
  check(has(extractDeadlines(NOTICE), /within 30 days of receipt of this notice/i), 'deadline keeps its qualifier', JSON.stringify(extractDeadlines(NOTICE)));
  check(extractDeadlines(NOTICE).every(d => !/\b(?:under|failing) (?:section|which)?\s*$/i.test(d)),
    'deadline tail never ends on a truncated connector', JSON.stringify(extractDeadlines(NOTICE)));
  check(has(extractDeadlines(FEE), /within 15 working days/i), '"within 15 working days" is a real deadline (not truncated mid-word)');
  check(has(extractDeadlines('You are hereby called upon to show cause within 3 days why disciplinary action should not be taken.'), /within 3 days/i), 'show-cause 3-day deadline');
  check(has(extractDeadlines('Reply within 30 dinon ke andar.'), /30 dinon/i), 'Roman Urdu deadline "30 dinon ke andar"');
  check(has(extractDeadlines(ROMAN), /25 March 2026 tak/i), 'Roman Urdu deadline with "tak"');
  check(has(extractDeadlines('The limitation period of 90 days applies.'), /limitation period of 90 days/i), 'limitation period is captured');
  check(extractDeadlines(LETTER).length === 0, 'a plain leave request invents NO response deadline', JSON.stringify(extractDeadlines(LETTER)));

  // ============================================================== PARTIES =====
  const pTo = extractParties('To, Mr. Bilal Shah, Resident of Model Town, Lahore.');
  check(pTo.some(p => /Bilal Shah/.test(p)) && !pTo.some(p => /Resident/.test(p)),
    'recipient stops at the name, does not swallow the address', JSON.stringify(pTo));
  const pLine = extractParties(NOTICE);
  check(pLine.some(p => /Asif Mehmood/.test(p)) && pLine.some(p => /Sadia Khan/.test(p)),
    'To:/From: header lines yield both parties', JSON.stringify(pLine));
  check(has(extractParties('From: Ayesha Siddiqui, Roll No. 2021-CS-114.'), /Ayesha Siddiqui/),
    'sender name survives a following roll number', JSON.stringify(extractParties('From: Ayesha Siddiqui, Roll No. 2021-CS-114.')));
  const pRole = extractParties(RENT);
  check(pRole.some(p => /landlord.*Tariq Mehmood/i.test(p)) && pRole.some(p => /tenant.*Ali Raza/i.test(p)),
    'role-labelled parties (landlord/tenant) are extracted', JSON.stringify(pRole));
  check(!pRole.some(p => /(^|\s)Ali(\s|$)/.test(p) && !/Ali Raza/.test(p)), 'name integrity: "Ali Raza" is never truncated to "Ali"');
  check(has(extractParties('petitioner: Ali Raza Khan'), /petitioner/i), 'English role label works');
  check(has(extractParties(ROMAN), /Ali Raza/i), 'Roman Urdu role label (bewinder) works');
  const pVs = extractParties('Case No. 45/2025 — Ali Traders vs. Punjab Supply Co.');
  check(pVs.some(p => /Ali Traders/.test(p)) && pVs.some(p => /Punjab Supply/.test(p)), 'vs. pairing yields both sides', JSON.stringify(pVs));
  check(extractParties(GARBAGE).length === 0, 'garbage "To: every paper" yields NO party', JSON.stringify(extractParties(GARBAGE)));
  const pEmp = extractParties('Employee Name: Mr. Kamran Ali, Employee ID: EMP-2231.');
  check(pEmp.some(p => /Kamran Ali/.test(p)) && !pEmp.some(p => /EMP-2231/.test(p)),
    'an employee ID is a reference, not a party', JSON.stringify(pEmp));
  check(extractParties('between January and June 2026 the rent was unpaid').length === 0,
    'a month range is not read as two parties');

  // ============================================================== AMOUNTS =====
  const amts = extractAmounts('Monthly rent Rs 45,000. Security deposit Rs 400,000 to be returned. Fee of Rs 68,000 and PKR 75,000 payable. Rent Rs 45,000 only.');
  check(amts.length === 4, 'one figure appears once (no "Rs 45,000 only"/"rent Rs 45,000" duplicates)', JSON.stringify(amts));
  check(has(extractAmounts(ROMAN), /2 lakh/i), 'Roman Urdu "2 lakh" is recognized as an amount');
  check(has(extractAmounts(NOTICE), /250,000/), 'deposit amount extracted');
  check(!extractAmounts('Recover Rs 2 lakh from the defaulter.').some(a => /^Rs\.?\s*2$/i.test(a)),
    '"Rs 2 lakh" never surfaces a truncated "Rs 2" fact');
  check(extractAmounts('Rs 2,00,000 (Rs 2 lakh) is payable.').length === 1,
    'the same figure written two ways is reported once');
  // A bare citation number is not money. "420 PPC" used to risk becoming an amount
  // because every other extractor in this file happily reads section numbers.
  check(extractAmounts('Charges under section 420 PPC, Article 10-A, Rule 7 of the CCC Rules 2009 and Order XXI CPC.').length === 0,
    'section/article/rule/order numbers are never read as amounts');
  check(extractAmounts('Under section 420 PPC the accused must refund Rs 45,000 to the complainant.').length === 1,
    'a real amount next to a section number is still the only amount reported');
  // --- Urdu-script money -----------------------------------------------------
  // An Urdu notice writes "رقم ۵ لاکھ روپے" and "رقم ۵۰،۰۰۰ روپے" — Urdu digits,
  // the Arabic comma as thousands separator, and روپے after the figure.
  const urLakh = extractAmounts('رقم ۵ لاکھ روپے ادا کیا جائے۔');
  check(has(urLakh, /5 lakh/i), 'Urdu-script "۵ لاکھ روپے" is extracted as an amount', JSON.stringify(urLakh));
  const urNumeric = extractAmounts('رقم ۵۰،۰۰۰ روپے وصول کی جائے۔');
  check(has(urNumeric, /50,000/), 'Urdu digits with the Arabic comma separator are extracted', JSON.stringify(urNumeric));
  check(has(extractAmounts('رقم ۲ کروڑ روپے'), /2 crore/i), 'Urdu-script "کروڑ" is read as crore');
  check([...urLakh, ...urNumeric].every(a => !/[\u0600-\u06FF]/.test(a)),
    'an Urdu-script amount is reported in Latin reading, never as Urdu script', JSON.stringify([urLakh, urNumeric]));
  check(has(extractAmounts('Rs 45,000'), /45,000/), 'plain "Rs 45,000" is unaffected');
  check(extractAmounts('شاگردوں کی فیس معاف کی گئی ہے۔').length === 0,
    'Urdu text that states no money still yields no amounts');

  // =========================================================== PROVISIONS =====
  const prov = extractProvisions('under section 420 PPC. Also Article 10-A of the Constitution was cited.');
  check(prov.length > 0 && prov.every(p => !/\.\s*[A-Z]/.test(p)),
    'a provision never runs across a sentence boundary', JSON.stringify(prov));

  // ==================================================== ANALYSIS SHAPE =====
  const an = analyzeDocumentText(NOTICE, 'What do I need to do?', { preferredLanguage: 'en' });
  check(Array.isArray(an.deadlines) && an.deadlines.length > 0, 'analysis returns deadlines');
  check(Array.isArray(an.provisions) && an.provisions.length > 0, 'analysis returns provisions');
  check(an.risks.length >= 1 && /within 30 days/.test(an.risks.join(' ')), 'risk names the real deadline');
  check(an.risks.join(' ').includes('section 420 PPC'), 'risk surfaces the invoked provision');
  check(!/PPC\.\./.test(an.risks.join(' ')), 'no doubled punctuation in generated risk text', an.risks.join(' | '));

  const rent = analyzeDocumentText(RENT, 'Any risks?', { preferredLanguage: 'en' });
  check(rent.risks.length > 0, 'a tenancy agreement is NOT returned with empty risks', JSON.stringify(rent.risks));

  const empty = analyzeDocumentText('   ', 'What is this?', {});
  const leaked = ['parties', 'dates', 'deadlines', 'provisions', 'authorities', 'amounts', 'risks']
    .filter(k => (empty[k] || []).length > 0);
  check(empty.documentType === null && leaked.length === 0, 'empty text fabricates nothing', JSON.stringify(leaked));

  const blob = analyzeDocumentText(BASE64_BLOB, 'What is this?', {});
  check(blob.documentType === null && blob.risks.length === 0 && /no analysis was made|not contained readable|readable document text/i.test(blob.answer),
    'a base64 blob is refused, not analysed', (blob.answer || '').slice(0, 70));

  const letter = analyzeDocumentText(LETTER, 'When must I respond?', { preferredLanguage: 'en' });
  check(!/within \d+ days/i.test(letter.risks.join(' ') + letter.answer), 'no invented deadline leaks into risks/answer');

  const romanAn = analyzeDocumentText(ROMAN, 'Mujhe kya karna chahiye?', { preferredLanguage: 'roman_urdu' });
  check(!/[\u0600-\u06FF]/.test(romanAn.answer), 'Roman Urdu analysis answer has no Urdu script');

  // =============================================================== COMPARE =====
  const cmpGarbage = compareDocumentsLocal(GARBAGE, RENT, {});
  check(cmpGarbage.summary.includes('no comparison was made') || cmpGarbage.summary.includes('could not be extracted'),
    'garbage on one side refuses instead of counting differences', cmpGarbage.summary.slice(0, 80));
  check(cmpGarbage.riskLevel === 'unknown', 'refused comparison reports riskLevel unknown, not low/green');
  check([cmpGarbage.partiesChanged, cmpGarbage.datesChanged, cmpGarbage.amountsChanged,
    cmpGarbage.clausesAdded, cmpGarbage.clausesRemoved].every(a => a.length === 0),
    'refused comparison carries no fabricated diff rows');

  const cmpBlob = compareDocumentsLocal(BASE64_BLOB, RENT, {});
  check(/readable document text|no comparison was made/i.test(cmpBlob.summary), 'unreadable side is refused by name');

  const cmpReal = compareDocumentsLocal(RENT, NOTICE, {});
  check(cmpReal.summary.includes('differences') && ['low', 'medium', 'high'].includes(cmpReal.riskLevel),
    'two genuine documents still compare normally', cmpReal.summary.slice(0, 60));

  // =========================================================== CHECKLIST =====
  const unmatched = getReadinessChecklist('I want to open a small bakery shop in Rawalpindi', {});
  check(unmatched.matched === false && unmatched.commonMistakes.length > 0,
    'unmatched request still returns commonMistakes', JSON.stringify(unmatched.commonMistakes));
  const unmatchedRoman = getReadinessChecklist('I want to open a small bakery shop in Rawalpindi', { preferredLanguage: 'roman_urdu' });
  check(unmatchedRoman.commonMistakes.length > 0 && !/[\u0600-\u06FF]/.test(unmatchedRoman.commonMistakes.join(' ')),
    'Roman mode commonMistakes are roman, not Urdu script');
  const matched = getReadinessChecklist('university fee refund application', {});
  check(matched.matched === true && matched.commonMistakes.length > 0,
    'a matched checklist keeps its specific mistakes', JSON.stringify(matched.commonMistakes && matched.commonMistakes[0]));

  console.log(`\n==== testDocExtractionP4: ${pass}/${pass + fail} PASS ====`);
  if (fail) { console.log('FAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
})();
