/*
 * Part N/O/P/Q/S/T — API-level test of the document endpoints with the INSAaf
 * owned model primary (fully offline, no external LLM). Verifies each endpoint
 * returns GROUNDED output (facts come from the supplied text), never the old
 * weak "could not be analyzed" non-answer, and carries the Part S footer.
 *
 * These use representative TEXT payloads (the endpoints receive already-extracted
 * text). The full upload→OCR→analyze E2E is verified separately in the browser
 * with a real user-provided file (per the task's non-negotiable on OCR testing).
 */
const BASE = 'http://localhost:3001/api/ai';

let pass = 0, fail = 0;
function check(ok, label, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}${extra ? ' :: ' + extra : ''}`);
  ok ? pass++ : fail++;
}
async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

const NOTICE = `LEGAL NOTICE
Under instructions from and on behalf of my client Mr. Ahmad Raza Khan, resident of House 12, Gulberg III, Lahore, I hereby serve upon you this legal notice.
To, Mr. Bilal Shah, Resident of Model Town, Lahore.
Whereas you entered into a Rental Agreement dated 05/03/2025 with my client for the premises situated at House 12, Gulberg III, Lahore, at a monthly rent of PKR 25,000.
You are required to pay the outstanding rent of PKR 75,000 within 14 days of receipt of this notice, failing which legal proceedings shall be initiated against you in the competent Civil Court at Lahore.
Dated: 20 August 2025.
Advocate: Sara Malik, District Courts Lahore.`;

const STRUCTURE = {
  heading: 'REPLY TO LEGAL NOTICE',
  courtLine: 'To, The Civil Court, Lahore',
  authorityNote: 'Format may vary by court or authority.',
  sections: [{ label: 'Para-wise Reply', hint: 'your response to each paragraph' }, { label: 'Prayer', hint: 'relief sought' }]
};

(async () => {
  // ---- Part N/O: document-understanding (EN) ----
  const du = await post('/document-understanding', { text: NOTICE, question: 'What do I need to do?', preferredLanguage: 'en', ocrQuality: 95 });
  check(du.status === 200, 'DU: HTTP 200', `status=${du.status}`);
  check(du.json.documentType === 'Legal Notice', 'DU: classified Legal Notice', du.json.documentType);
  check(Array.isArray(du.json.parties) && du.json.parties.length >= 2, 'DU: parties extracted (grounded)', `${(du.json.parties || []).length}`);
  check((du.json.dates || []).some(d => /20 August 2025|05\/03\/2025/.test(d)), 'DU: real dates extracted', (du.json.dates || []).length + ' dates');
  check((du.json.authorities || []).some(a => /Civil Court/i.test(a)), 'DU: Civil Court authority extracted', (du.json.authorities || []).join(', '));
  check((du.json.requirements || []).some(r => /pay the outstanding rent/i.test(r)), 'DU: requested action grounded', (du.json.requirements || [])[0] || '');
  check(typeof du.json.answer === 'string' && /pay|rent|14 days|respond/i.test(du.json.answer), 'DU: answer is on-topic & grounded', (du.json.answer || '').slice(0, 80));
  check(!/could not be (?:fully )?analyzed/i.test(du.json.answer || ''), 'DU: NO weak "could not be analyzed" fallback');
  check(du.json.isOffline === true, 'DU: isOffline flag true (owned-model local)');

  // ---- Part O: Roman Urdu answer, no Urdu script ----
  const dur = await post('/document-understanding', { text: NOTICE, question: 'Mujhe kya karna chahiye?', preferredLanguage: 'roman_urdu', ocrQuality: 90 });
  check(typeof dur.json.answer === 'string' && !/[\u0600-\u06FF]/.test(dur.json.answer), 'DU(roman): answer has NO Urdu script');
  check(dur.json.isOffline === true, 'DU(roman): isOffline true');

  // ---- Part N: low OCR quality honest warning ----
  const dul = await post('/document-understanding', { text: NOTICE, question: 'What is this document?', preferredLanguage: 'en', ocrQuality: 40 });
  check(!!dul.json.ocrQualityNote, 'DU(low-ocr): ocrQualityNote present', dul.json.ocrQualityNote || '');
  check(/OCR quality is low/i.test(dul.json.answer || ''), 'DU(low-ocr): answer begins with honest OCR warning');

  // ---- Part N: unreadable/empty text never yields a fabricated analysis ----
  const due = await post('/document-understanding', { text: '   ', question: 'What is written here?', preferredLanguage: 'en' });
  check(due.json.documentType === null && /No readable text/i.test(due.json.answer || ''), 'DU(empty): honest no-text message, null type', (due.json.answer || '').slice(0, 50));

  // ---- Part P: document-reply offline draft ----
  const dr = await post('/document-reply', { text: NOTICE, instruction: 'Iska jawab bana do', replyType: 'reply', language: 'en', structure: STRUCTURE });
  check(dr.status === 200 && typeof dr.json.html === 'string', 'DR: HTTP 200 + html present', `status=${dr.status}`);
  check((dr.json.html || '').includes('REPLY TO LEGAL NOTICE'), 'DR: uses the provided professional heading');
  check((dr.json.html || '').includes('Prepared with INSAaf AI'), 'DR: carries Part S footer');
  check(/Ahmad Raza Khan|Bilal Shah|Gulberg|Civil Court/i.test(dr.json.html || ''), 'DR: preserves real source facts');
  check(/\[MISSING/.test(dr.json.html || ''), 'DR: marks unknowns as [MISSING] (no fabrication)');
  check(dr.json.isOffline === true && Array.isArray(dr.json.nextSteps) && dr.json.nextSteps.length >= 3, 'DR: offline + next steps');
  check(typeof dr.json.submission === 'string' && /Civil Court/i.test(dr.json.submission), 'DR: submission grounded in named authority');

  // ---- Part S: /generate offline HTML footer ----
  const gen = await post('/generate', { type: 'Legal Notice', details: {}, categoryId: 'legal', preferredLanguage: 'en', structure: { heading: 'LEGAL NOTICE', courtLine: '', sections: [{ label: 'Facts' }, { label: 'Demand' }] } });
  check(gen.status === 200 && typeof gen.json.html === 'string', 'GEN: HTTP 200 + html', `status=${gen.status}`);
  check((gen.json.html || '').includes('Prepared with INSAaf AI'), 'GEN: carries Part S footer');
  check(gen.json.isOffline === true, 'GEN: isOffline true (owned-model local render)');

  // ---- Part Q: document-chat deterministic offline edit ----
  const dc = await post('/document-chat', { context: '<div><p>Monthly rent: 25,000 PKR.</p></div>', userInput: 'change 25,000 to 30,000', history: [] });
  check(dc.status === 200 && (dc.json.html || '').includes('30,000'), 'DC: applied the explicit value edit', (dc.json.summary || '').slice(0, 60));
  check(/Replaced/i.test(dc.json.summary || ''), 'DC: reports exactly what changed');
  check(dc.json.isOffline === true, 'DC: isOffline true');
  const dcNone = await post('/document-chat', { context: '<div><p>Monthly rent: 25,000 PKR.</p></div>', userInput: 'make it nicer', history: [] });
  check(dcNone.json.html.includes('25,000') && /nothing was changed|unchanged/i.test(dcNone.json.summary || ''), 'DC: honest "unchanged" when no explicit edit', (dcNone.json.summary || '').slice(0, 70));

  console.log(`\n==== testDocEndpoints: ${pass}/${pass + fail} PASS ====`);
  process.exit(fail === 0 ? 0 : 1);
})();
