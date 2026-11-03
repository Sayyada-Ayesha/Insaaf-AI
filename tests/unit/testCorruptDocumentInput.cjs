/**
 * Audit FIX 3 — corrupt / unreadable document input must fail honestly.
 *
 * A raw file handed to a text route (base64 of the file, decoded binary, a dump
 * of numbers) used to be summarised as if it had parsed. These cases lock in:
 *   1. the readability gate rejects garbage but never rejects real document text
 *      (checked against every chunk of the shipped RAG corpus), and
 *   2. each document route returns an honest refusal instead of an analysis.
 *
 * HTTP cases need the backend on :3001; unit cases always run.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

function post(urlPath, body, token) {
  return new Promise((resolve) => {
    const s = JSON.stringify(body);
    const q = http.request({ host: '127.0.0.1', port: 3001, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, timeout: 90000 }, (res) => {
      let d = ''; res.setEncoding('utf8');
      res.on('data', c => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    q.on('timeout', () => { q.destroy(new Error('timeout')); });
    q.on('error', e => resolve({ status: 0, body: '', error: e.message }));
    q.write(s); q.end();
  });
}

const TENANCY_DOC = 'TENANCY AGREEMENT\nThis agreement is made between Ahmed Raza, tenant, and Bilal Ahmed, landlord, for the premises at Shahrah-e-Faisal, Karachi, on a monthly rent of Rs. 45,000 payable by the 7th of each month. The tenant has deposited Rs. 90,000 as security deposit, refundable on vacation of the premises. The landlord may recover possession only through an order of the Rent Controller.';
const URDU_DOC = 'یہ نوٹس بہت ادب کے ساتھ روانہ کیا جاتا ہے کہ آپ کرایہدار کی حیثیت سے پندرہ لاکھ روپے ادا کریں ورنہ قانونی کارwai عمل میں لائی جائے گی۔';
const URDU_DOC_CLEAN = 'یہ نوٹس بہت ادب کے ساتھ روانہ کیا جاتا ہے کہ آپ کرایہ دار کی حیثیت سے پندرہ لاکھ روپے ادا کریں ورنہ قانونی کارروائی عمل میں لائی جائے گی۔';
const ROMAN_DOC = 'Aap ko ye notice is liye bheja ja raha hai ke aap ne pichlay saat mahinon se kiraya ada nahi kiya hai. Agar pandah din mein baqaya raqam ada na ki gayi to qanooni karwai amaal mein layi jayegi.';
const BLOB = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const NUMBER_DUMP = '1234 5678 9012 3456 7890 1234 5678 90 12 34 56 78 90 21 43 65 87 09 20 31 42 53 64 75 86 97';
const BINARY_JUNK = Buffer.from(Array.from({ length: 400 }, (_, i) => (i * 37) % 256)).toString('latin1');

(async () => {
  console.log('\n===== FIX 3 corrupt document input =====');
  const docModel = await import(pathToFileURL(path.join(ROOT, 'server', 'docModel.js')));
  const { assessDocumentReadability, analyzeDocumentText } = docModel;

  // --- gate rejects non-language input ---
  ok('U1 base64 blob rejected', !assessDocumentReadability(BLOB).readable, assessDocumentReadability(BLOB).reason);
  ok('U2 binary junk rejected', !assessDocumentReadability(BINARY_JUNK).readable, assessDocumentReadability(BINARY_JUNK).reason);
  ok('U3 number dump rejected', !assessDocumentReadability(NUMBER_DUMP).readable, assessDocumentReadability(NUMBER_DUMP).reason);
  ok('U4 short text rejected', !assessDocumentReadability('Kiraya do.').readable, assessDocumentReadability('Kiraya do.').reason);

  // --- gate accepts real documents ---
  ok('U5 English tenancy accepted', assessDocumentReadability(TENANCY_DOC).readable, assessDocumentReadability(TENANCY_DOC).reason);
  ok('U6 Urdu-script notice accepted', assessDocumentReadability(URDU_DOC_CLEAN).readable, assessDocumentReadability(URDU_DOC_CLEAN).reason);
  ok('U7 Roman Urdu notice accepted', assessDocumentReadability(ROMAN_DOC).readable, assessDocumentReadability(ROMAN_DOC).reason);
  const mixedHtml = '<p style="text-align:justify;">REFUND APPLICATION</p><p>The applicant, Sana Tariq, roll no 2021-CS-44, states that the fee of Rs. 185,000 was deposited on 12 March 2024 and requests refund under the university policy.</p>';
  ok('U8 drafted HTML document accepted', assessDocumentReadability(mixedHtml).readable, assessDocumentReadability(mixedHtml).reason);
  // A PDF table of contents is layout filler, not garbage: the HEC anti-plagiarism
  // policy used to be rejected wholesale because dot leaders ate 60% of the chunk.
  const dotLeaders = 'ANTI-PLAGIARISM POLICY VERSION 2.0 August 2023 Table of Contents List of Abbreviations .................................................... 2 Purpose and Scope of the Policy ........................................ 3 Role of the University Anti-Plagiarism Standing Committee ................ 9 Submission of Findings by the Committee .................................. 10 Penalties for Academic Misconduct by Students and Staff .................. 12 Appeals Against a Finding of Plagiarism ................................. 15 Annexure-1: Undertaking Form ............................................. 19 Frequently Asked Questions and References ................................ 23';
  ok('U14 dot-leader table of contents accepted', assessDocumentReadability(dotLeaders).readable, assessDocumentReadability(dotLeaders).reason);
  ok('U15 dot filler alone still rejected', !assessDocumentReadability('..........................................................').readable,
    assessDocumentReadability('..........................................................').reason);
  // The corpus sweep excludes windows with no wording; this proves the gate still
  // refuses that residue instead of accepting it.
  const residuePage = ' ' + String.fromCharCode(0xF05A, 0xF067, 0xF03B).repeat(40) + ' ';
  ok('U16 blank page / symbol-font residue still rejected', !assessDocumentReadability(residuePage).readable,
    assessDocumentReadability(residuePage).reason);
  const sourceCode = 'function computeTotal(items) {\n  const tax = items.reduce((a, b) => a + b.price * 0.17, 0);\n  return { gross: items.length ? total + tax : 0, net: Math.round(gross) };\n}';
  ok('U17 source code still rejected as a document', !assessDocumentReadability(sourceCode).readable,
    assessDocumentReadability(sourceCode).reason);
  const challan = 'UNIVERSITY OF SINDH FEES CHALLAN\n============================================\nStudent Name: ____________________  Roll No: 2021-CS-44\nVoucher No: 88912345   Date of Issue: 14/02/2025\nB.Tech Semester 1 — Tuition Fee .......... 45,000\nExamination Fee .......... 12,500\nStudent Activity Fee .......... 2,000\n--------------------------------------------\nTOTAL PAYABLE: Rs. 59,500\nPayable at any HBL branch on or before 28/02/2025.\n--------------------------------------------';
  ok('U18 fee challan with rules and figures still readable', assessDocumentReadability(challan).readable,
    assessDocumentReadability(challan).reason);

  // --- no false rejections across the whole shipped corpus ---
  // This sweep claims what the gate can honour: every window that carries wording
  // must read as document language. Windows made of page whitespace or of
  // symbol-font glyphs (Urdu Nastaliq extracted as U+F0xx private-use marks) hold
  // no wording at all, so they are excluded here — and U16 proves the gate refuses
  // that very residue, which is what keeps the exclusion from hiding a false
  // rejection. Both counts are printed.
  const corpusDir = path.join(ROOT, 'rag', 'documents');
  let chunks = 0, residue = 0, rejected = [];
  if (fs.existsSync(corpusDir)) {
    for (const domain of fs.readdirSync(corpusDir)) {
      const dir = path.join(corpusDir, domain);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.txt')) continue;
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        for (let i = 0; i + 900 < raw.length; i += 1500) {
          const chunk = raw.slice(i, i + 900).trim();
          if (chunk.length < 120) continue;
          const letters = (chunk.match(/[A-Za-z؀-ۿ݀-ݏ]/g) || []).length;
          if ((chunk.match(/\S/g) || []).length < 20 || letters < 12) { residue++; continue; }
          chunks++;
          if (!assessDocumentReadability(chunk).readable) rejected.push(`${domain}/${f}@${i}:${assessDocumentReadability(chunk).reason}`);
        }
      }
    }
    ok('U9 every corpus window with wording reads as document language', rejected.length === 0,
      `${chunks} windows tested, ${residue} residue-only windows excluded; rejected=${rejected.length}${rejected.length ? ': ' + rejected.slice(0, 6).join(', ') : ''}`);
  } else {
    ok('U9 corpus present for the false-rejection sweep', false, 'rag/documents missing');
  }

  // --- analysis refuses instead of fabricating ---
  const refused = analyzeDocumentText(BLOB, '', { preferredLanguage: 'en' });
  ok('U10 analyzeDocumentText returns no fabricated summary for a blob',
    refused.documentType === null && refused.summary === null && refused.nextSteps.length === 0 && refused.risks.length === 0,
    JSON.stringify({ t: refused.documentType, s: (refused.summary || '').slice(0, 30) }));
  ok('U11 the refusal explains what happened', /not contain readable document text/i.test(refused.answer), refused.answer.slice(0, 90));
  const refusedRoman = analyzeDocumentText(BLOB, '', { preferredLanguage: 'roman_urdu' });
  ok('U12 refusal is localised for Roman Urdu', /parhne layak document text nahi/i.test(refusedRoman.answer), refusedRoman.answer.slice(0, 80));
  const analysed = analyzeDocumentText(TENANCY_DOC, '', { preferredLanguage: 'en' });
  ok('U13 a real document still analyses', /Tenancy|Rental/i.test(String(analysed.documentType)) && analysed.summary !== null,
    `type=${analysed.documentType}`);

  // --- routes ---
  let serverUp = true;
  const ping = await post('/api/ai/document-understanding', { text: TENANCY_DOC }, 'warmup-noise');
  if (ping.status === 0) serverUp = false;

  if (serverUp) {
    const t = 'fix3-' + Date.now();
    let r = await post('/api/ai/document-understanding', { text: BLOB }, t);
    let j = {}; try { j = JSON.parse(r.body); } catch {}
    ok('R1 document-understanding refuses a blob', r.status === 200 && j.summary === null && j.nextSteps.length === 0,
      `${r.status} summary=${JSON.stringify(j.summary)}`);
    ok('R2 the refusal names the problem', /did not contain readable document text/i.test(String(j.answer)), String(j.answer).slice(0, 80));

    r = await post('/api/ai/document-understanding', { text: NUMBER_DUMP }, t);
    j = {}; try { j = JSON.parse(r.body); } catch {}
    ok('R3 a number dump is refused, not analysed', j.summary === null && /numbers without wording/i.test(String(j.answer)), String(j.answer).slice(0, 90));

    r = await post('/api/ai/document-understanding', { text: TENANCY_DOC }, t);
    j = {}; try { j = JSON.parse(r.body); } catch {}
    ok('R4 a valid document still analyses over HTTP', r.status === 200 && j.summary !== null && /Tenancy|Rental/i.test(String(j.documentType)),
      `type=${j.documentType} parties=${(j.parties || []).length}`);

    r = await post('/api/ai/document-compare', { textA: BLOB, textB: TENANCY_DOC }, t);
    ok('R5 compare rejects an unreadable side with a controlled 400', r.status === 400 && /first document does not contain readable/i.test(r.body), `${r.status}`);

    r = await post('/api/ai/document-reply', { text: BLOB, instruction: 'reply banao' }, t);
    j = {}; try { j = JSON.parse(r.body); } catch {}
    ok('R6 document-reply drafts nothing from a blob', j.html === null && /did not contain readable document text/i.test(String(j.explanation)), String(j.explanation).slice(0, 80));

    r = await post('/api/ai/ocr', { fileBase64: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpAQUJD', mimeType: 'image/png' }, t);
    ok('R7 OCR refuses data that is not an image', r.status === 400 && /not a readable image/i.test(r.body), `${r.status} ${r.body.slice(0, 70)}`);

    r = await post('/api/ai/advice', { userQuery: `Summarize this document. Provide a concise, structured summary.\n---\n${BLOB}\n---` }, t);
    j = {}; try { j = JSON.parse(r.body); } catch {}
    ok('R8 chat document-intelligence reports the refusal instead of an empty summary',
      /could not be read|readable document text/i.test(String(j.text)) && !/PARTIALLY VERIFIED/i.test(String(j.text)),
      String(j.text).slice(0, 90));
  } else {
    console.log('  SKIP R1-R8 — backend not reachable on :3001 (start it with: node server/index.js)');
  }

  console.log(`\n=================  FIX 3: ${pass} passed / ${fail} failed  ==================`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(2); });
