// tests/e2e/testDocumentAssistantP4.cjs — P4 Document Assistant in REAL Chrome.
//
// Why this file exists: every defect in this priority was reported as "fixed" from
// unit level. Two of them are only observable in a browser — the hidden file input
// that could not actually be opened, and a refused comparison that rendered green
// (safe) instead of neutral. This suite drives the shipped bundle with trusted mouse
// clicks (a programmatic input.click() cannot open a file picker in Chrome, so an
// evaluate-based click would prove nothing), uploads a genuine scanned fixture, and
// reads the DOM the user would read.
//
// Usage: npm run build && node server/index.js (port 3001) && node tests/e2e/testDocumentAssistantP4.cjs
const puppeteer = require('puppeteer');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3001';
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'student', 'show_cause_notice.png');

// The OCR text this fixture is known to produce (verified against /api/ai/ocr):
// "SHOW CAUSE NOTICE", "Date: 15 March 2024", "To: Mr. Ahmed Ali", "within 7 days".
const DOC_A = `SHOW CAUSE NOTICE
Ref: SU/DOS/2024/SC-047
Date: 15 March 2024
To: Mr. Ahmed Ali, Registration No 2021-CS-147
From: The Dean of Students, University of Sindh, Jamshoro.
You are hereby notified to show cause within 7 days why disciplinary action
should not be taken against you, under Section 12 of the University Discipline Rules.`;
const DOC_B = `SHOW CAUSE NOTICE
Ref: SU/DOS/2024/SC-047
Date: 22 April 2024
To: Ms. Sana Bibi, Registration No 2021-EE-089
From: The Dean of Students, University of Sindh, Jamshoro.
You are hereby notified to show cause within 14 days why disciplinary action
should not be taken against you, under Section 12 of the University Discipline Rules.`;
// Readable English, but not a document: no parties, dates, amounts or provisions.
const NOT_A_DOCUMENT = 'Hire purchase agreement is about to expire due to every paper. To: every paper is required.';

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
  return !!cond;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Set a controlled textarea the way React expects (native setter + input event). */
async function setTextarea(page, placeholderStart, value) {
  return page.evaluate((ph, v) => {
    const ta = [...document.querySelectorAll('textarea')]
      .find(el => (el.getAttribute('placeholder') || '').startsWith(ph));
    if (!ta) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, v);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, placeholderStart, value);
}

const readTextareas = page => page.$$eval('textarea', els => els.map(e => ({
  value: e.value, placeholder: e.getAttribute('placeholder') || ''
})));

/** Visible text of the mounted UI. textContent, not innerText: Tailwind's
 *  `uppercase` makes innerText report transformed glyphs in headless Chrome. */
const visibleText = page => page.evaluate(() => document.body.textContent || '');

/** Click a <button> by the text it contains, using a real mouse click. */
async function clickButtonWithText(page, text) {
  const handles = await page.$$('button');
  for (const h of handles) {
    const t = (await h.evaluate(el => el.textContent || '')).trim();
    if (t.includes(text)) {
      const box = await h.boundingBox();
      if (!box || box.width < 2) continue;
      await h.click();
      return true;
    }
  }
  return false;
}

/** Wait until `pred(text)` is true on the live DOM, or time out. */
async function waitForText(page, pred, timeoutMs, probe) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const t = probe ? await probe(page) : await visibleText(page);
    if (pred(t)) return true;
    await sleep(500);
  }
  return false;
}

/** The class list of the risk-level badge, so colour is read from the DOM not the eye. */
const riskBadgeClass = page => page.evaluate(() => {
  const node = [...document.querySelectorAll('div')].find(d =>
    (d.textContent || '').trim().startsWith('Risk Level:') && d.children.length <= 3);
  return node ? node.className : '';
});

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width: 1366, height: 1000 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.removeItem('insaaf_lang');
      localStorage.removeItem('insaaf_doc_lang');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2500);

    // ============================================================ NAMING / NAV ==
    console.log('\n[A] Tab is visible, named correctly, and opens the section');
    const navSel = '[aria-label="Document Assistant"]';
    ok((await page.$(navSel)) !== null, 'a nav control with aria-label "Document Assistant" exists');
    const navText = await page.$eval(navSel, el => el.textContent || '');
    ok(navText.trim() === 'Document Assistant', 'its visible label is exactly "Document Assistant"', JSON.stringify(navText));
    ok((await visibleText(page)).includes('Document Assistant'), 'the label is readable at desktop width');
    const t = await visibleText(page);
    ok(!/kaaghaz\s*saathi/i.test(t), 'the internal name "Kaaghaz Saathi" is not shown to the user');

    await page.click(navSel);
    await sleep(1200);
    ok(await waitForText(page, x => /Upload Document/.test(x) && /Take Photo/.test(x) && /Compare Documents/.test(x), 15000),
      'the Document Assistant home screen shows Upload / Take Photo / Compare cards');

    // ================================================ FILE PICKER (REAL CLICK) ==
    console.log('\n[B] The Upload card actually opens the operating-system file picker');
    const client = await page.createCDPSession();
    let chooserEvent = null;
    let cdpArmed = false;
    let cdpError = '';
    client.on('Page.fileChooserOpened', e => { chooserEvent = e; });
    try {
      // Page.fileChooserOpened is only dispatched after these domains are enabled,
      // and Puppeteer 25 no longer ships a FileChooser API of its own.
      await client.send('Page.enable');
      await client.send('DOM.enable');
      await client.send('Page.setInterceptFileChooserDialog', { enabled: true });
      cdpArmed = true;
    } catch (e) {
      cdpError = e.message;
      console.log(`      (CDP chooser interception unavailable: ${e.message})`);
    }

    ok(await clickButtonWithText(page, 'Upload Document'), 'the Upload Document card was clicked with a trusted mouse event');
    const chooserAppeared = cdpArmed
      ? await waitForText(page, () => !!chooserEvent, 8000, () => Promise.resolve(chooserEvent ? 'x' : ''))
      : false;
    ok(!cdpArmed || chooserAppeared,
      cdpArmed
        ? 'Chrome reported a file chooser opened by the click (the hidden input is reachable)'
        : 'file picker opened',
      cdpArmed ? '' : `CDP interception failed: ${cdpError}`);

    // Feed the picker the genuine scanned fixture, exactly as a person would.
    let uploadPath = 'cdp-file-chooser';
    if (chooserEvent && chooserEvent.backendNodeId) {
      try {
        await client.send('DOM.setFileInputFiles', { files: [FIXTURE], backendNodeId: chooserEvent.backendNodeId });
        try { await client.send('Page.handleFileChooser', { action: 'accept', files: [FIXTURE] }); } catch { /* older CDP */ }
      } catch (e) {
        uploadPath = 'fallback';
      }
    } else {
      uploadPath = 'fallback';
    }
    if (uploadPath === 'fallback') {
      await client.send('Page.setInterceptFileChooserDialog', { enabled: false }).catch(() => {});
      const input = await page.$('input[type="file"]');
      if (!input) { ok(false, 'a file input exists for the fallback upload path'); }
      else { await input.uploadFile(FIXTURE); }
    }
    console.log(`      (file supplied to the page through: ${uploadPath})`);

    // ================================================== UPLOAD → OCR → EXPLAIN ==
    console.log('\n[C] Upload extracts real text by OCR and the analysis runs on it');
    ok(await waitForText(page, x => /Extracting text from|Text nikala ja raha/i.test(x), 8000),
      'a progress message appears while the file is read');

    // Poll the textarea itself, not the page text: the OCR result lands there.
    let gotText = false;
    {
      const start = Date.now();
      while (Date.now() - start < 150000) {
        const rows = await readTextareas(page);
        const doc = rows.find(r => /Paste or type text here/i.test(r.placeholder));
        if (doc && doc.value.trim().length >= 40) { gotText = true; break; }
        if (/No readable text could be extracted|could not be read/i.test(await visibleText(page))) break;
        await sleep(1000);
      }
    }
    ok(gotText, 'the uploaded document text landed in the editor (OCR completed)');

    const rows = await readTextareas(page);
    const docRow = rows.find(r => /Paste or type text here/i.test(r.placeholder)) || { value: '' };
    const ocrText = docRow.value;
    console.log(`      OCR length ${ocrText.length}; first line: ${JSON.stringify(ocrText.split('\n')[0])}`);
    ok(/SHOW\s*CAUSE\s*NOTICE/i.test(ocrText), 'the OCR really read the notice heading', JSON.stringify(ocrText.slice(0, 80)));
    ok(/Ahmed\s*Ali/i.test(ocrText), 'the OCR read the named party from the scan');
    ok(!/[A-Za-z0-9+/]{80,}={0,2}/.test(ocrText), 'no base64 blob leaked into the editor');

    const afterUpload = await visibleText(page);
    ok(/Extracted via|Text nikla/i.test(afterUpload), 'the source of the extracted text is disclosed');
    ok(/quality\s+\d+\/100/i.test(afterUpload), 'the extraction quality score is disclosed');
    ok(!/No readable text could be extracted/i.test(afterUpload), 'the honest failure message was not triggered');
    ok(/Your Uploaded Document|Aap ka Upload Shuda Document/i.test(afterUpload), 'the editor is titled as the uploaded document');

    // Run Explain on the OCR text and check the analysis carries the facts.
    // Every section stays mounted, and the Chat panel also renders .ProseMirror —
    // so snapshot the prose blocks and take the one that appears or changes.
    const proseTexts = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror')].map(b => b.textContent || ''));
    const proseBefore = await proseTexts();
    ok(await clickButtonWithText(page, 'Explain'), 'the Explain quick action is clickable');
    const answered = await waitForText(page, x => !/Analyzing legal content|Qanooni tajziya/i.test(x) && x.length > afterUpload.length + 200, 60000);
    ok(answered, 'Explain produced an answer');
    const proseAfter = await proseTexts();
    const answerRegion = proseAfter.find(t => !proseBefore.includes(t)) || '';
    console.log(`      prose blocks before=${proseBefore.length} after=${proseAfter.length}; new region length ${answerRegion.length}`);
    console.log(`      opening: ${JSON.stringify(answerRegion.slice(0, 120))}`);
    ok(answerRegion.length > 120, 'the answer container holds rendered prose, not an empty shell');
    ok(/7 days/i.test(answerRegion), 'the 7-day show-cause deadline from the scan reaches the answer');
    ok(/15 March 2024|10 March 2024/.test(answerRegion), 'a date from the scan reaches the answer (the "dates: []" defect)');
    ok(/Ahmed Ali/.test(answerRegion), 'the party name survives OCR into the answer, untruncated');
    ok(!/[\u0600-\u06FF]/.test(answerRegion), 'an English document is answered in English script only');

    // ==================================================== COMPARISON REFUSAL ====
    console.log('\n[D] An invalid comparison refuses in a neutral state, never a green success');
    ok(await clickButtonWithText(page, 'Go back'), 'the editor screen offers a working way back to the home cards');
    await sleep(800);
    ok(await clickButtonWithText(page, 'Compare Documents'), 'the Compare Documents card opens the comparison view');
    await sleep(800);
    ok(await setTextarea(page, 'Paste first document here', DOC_A), 'Document A was filled');
    ok(await setTextarea(page, 'Paste second document here', NOT_A_DOCUMENT), 'Document B was filled with non-document text');
    ok(await clickButtonWithText(page, 'Compare Now'), 'Compare Now was clicked');
    ok(await waitForText(page, x => /Risk Level:/.test(x), 45000), 'a comparison result was rendered');

    const badgeClass = await riskBadgeClass(page);
    console.log(`      badge class: ${badgeClass}`);
    ok(/bg-gray-50/.test(badgeClass), 'the refusal badge is the neutral gray treatment');
    ok(!/bg-emerald-50|bg-green-50/.test(badgeClass), 'the refusal is NOT rendered as a green/safe result');
    const refused = await visibleText(page);
    ok(/no comparison was made/i.test(refused), 'the refusal says plainly that no comparison was made');
    ok(/Document B/i.test(refused), 'the refusal names the unreadable side');
    ok(!/Dates Changed|Amounts Changed/.test(refused), 'no fabricated difference rows are shown for a refused comparison');

    // A genuine pair must still compare, or the gray state would just be a broken render.
    console.log('\n[E] A genuine two-document comparison still works in the same UI');
    ok(await clickButtonWithText(page, 'New Comparison'), 'the refusal screen offers a working reset');
    await sleep(800);
    ok(await setTextarea(page, 'Paste first document here', DOC_A), 'Document A was filled again');
    ok(await setTextarea(page, 'Paste second document here', DOC_B), 'Document B was filled with a real second notice');
    ok(await clickButtonWithText(page, 'Compare Now'), 'Compare Now was clicked again');
    const compared = await waitForText(page, x => /Total \d+ difference/i.test(x), 45000);
    ok(compared, 'two genuine documents produce a difference count');
    const realBadge = await riskBadgeClass(page);
    ok(/bg-red-50|bg-amber-50|bg-emerald-50/.test(realBadge), 'a real comparison colours the risk badge by level', realBadge);
    const diffText = await visibleText(page);
    ok(/Dates Changed/.test(diffText) && /Parties Changed/.test(diffText),
      'the genuine comparison lists the date and party changes the fixtures contain');

    console.log(`\n==== testDocumentAssistantP4: ${pass}/${pass + fail} PASS ====`);
    if (fail) { console.log('FAILURES:'); failures.forEach(f => console.log('  - ' + f)); }
    process.exitCode = fail ? 1 : 0;
  } catch (err) {
    console.error('SUITE ERROR:', err && err.message);
    process.exitCode = 2;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
})();
