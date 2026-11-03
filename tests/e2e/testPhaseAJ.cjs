/*
 * PHASE AJ — DRAFTING TEST (real Puppeteer/Chrome against localhost:3000).
 * Verifies the Document Drafter end-to-end in ENGLISH and URDU SCRIPT (Part A:
 * Roman Urdu is NOT a document language). Per the spec it checks: structure,
 * legal format, facts, headings, signature, date, authority, source-of-law,
 * print, PDF, footer and edits. Run: node testPhaseAJ.cjs
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const CHROME_PATHS = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const URDU_RE = /[\u0600-\u06FF]/g;

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function launchBrowser() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) {
      try { return await puppeteer.launch({ headless: true, executablePath: p, args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
      catch (e) { /* fall through */ }
    }
  }
  return await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1366, height: 1000 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { localStorage.removeItem('insaaf_lang'); localStorage.removeItem('insaaf_doc_lang'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2200);

  const bodyLC = async () => (await page.evaluate(() => document.body.innerText)).toLowerCase();
  const clickNav = (aria) => page.evaluate((a) => {
    const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
    if (btn) { btn.click(); return true; } return false;
  }, aria);
  const clickCategory = (label) => page.evaluate((lbl) => {
    const needle = lbl.toLowerCase();
    const btn = Array.from(document.querySelectorAll('button')).find(b => {
      const h3 = b.querySelector('h3');
      return h3 && h3.textContent.trim().toLowerCase() === needle;
    });
    if (btn) { btn.click(); return true; } return false;
  }, label);
  const clickSub = (label) => page.evaluate((lbl) => {
    const needle = lbl.toLowerCase();
    const btn = Array.from(document.querySelectorAll('button')).find(b => {
      const span = b.querySelector('span');
      return span && span.textContent.trim().toLowerCase().includes(needle);
    });
    if (btn) { btn.click(); return true; } return false;
  }, label);
  const clickButtonContaining = (txt) => page.evaluate((t) => {
    const needle = t.toLowerCase();
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').toLowerCase().includes(needle));
    if (btn) { btn.click(); return true; } return false;
  }, txt);
  const setFirstInput = (value) => page.evaluate((val) => {
    const el = document.querySelector('input[type="text"]');
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, value);
  // The generated document renders inside #printable-doc (dangerouslySetInnerHTML).
  const printable = () => page.evaluate(() => {
    const el = document.querySelector('#printable-doc');
    return el ? { text: el.innerText, html: el.innerHTML } : { text: '', html: '' };
  });
  // Enumerate the Document Output Language buttons — scoped to the control that
  // follows the "Document Output Language" label (a document-wide query would also
  // match the header's UI-language "English" toggle and give a false extra button).
  const langButtons = () => page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('label'))
      .find(l => /document output language|document ki zaban/i.test(l.textContent || ''));
    const scope = label ? label.parentElement : document;
    return Array.from(scope.querySelectorAll('button')).map(b => (b.textContent || '').trim());
  });
  const waitForPrintable = async (timeout = 12000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const { text } = await printable();
      if (text && text.trim().length > 40) return true;
      await sleep(300);
    }
    return false;
  };

  // ================= A. Drafter loads =================
  record('AJ.1 navigate to Document Drafter', await clickNav('Document Drafter'), '');
  await sleep(1500);
  let t = await bodyLC();
  record('AJ.2 "Drafting Engine." heading present', t.includes('drafting engine'), '');

  // ================= B. Language options: EN + Urdu Script ONLY =================
  record('AJ.3 open Legal category', await clickCategory('Legal'), '');
  await sleep(800);
  record('AJ.4 open FIR Application sub-form', await clickSub('fir application'), '');
  await sleep(900);
  t = await bodyLC();
  record('AJ.5 "Document Output Language" selector shown', t.includes('document output language'), '');
  const langs = await langButtons();
  record('AJ.6 offers English document language', langs.some(x => /english/i.test(x)), JSON.stringify(langs));
  record('AJ.7 offers Urdu Script document language', langs.some(x => /urdu script/i.test(x)), JSON.stringify(langs));
  record('AJ.8 offers EXACTLY two doc languages (no Roman Urdu option)', langs.length === 2, JSON.stringify(langs));
  record('AJ.9 no "Roman Urdu" document-language option anywhere in the form', !t.includes('roman urdu'), '');

  // ================= C. English document generation + structure =================
  await setFirstInput('Gulberg PS Lahore');
  await clickButtonContaining('english');
  await sleep(200);
  record('AJ.10 generate the English document', await clickButtonContaining('generate document'), '');
  const enReady = await waitForPrintable();
  record('AJ.11 English document rendered', enReady, '');
  let doc = await printable();
  let d = doc.text;
  let dh = doc.html;
  record('AJ.12 EN heading = APPLICATION FOR REGISTRATION OF FIR (154)', /application for registration of fir/i.test(d) && /154/.test(d), '');
  record('AJ.13 EN court/authority line (SHO / Station House Officer)', /station house officer|sho/i.test(d), '');
  record('AJ.14 EN verified source-of-law note (154 CrPC cognizable)', /154 crpc/i.test(d) && /cognizable/i.test(d), '');
  record('AJ.15 EN subject, numbered body paragraph and prayer are all present',
    /subject\s*:/i.test(d) && /\b1\.\s/i.test(d) && /prayer\s*:/i.test(d), '');
  record('AJ.16 EN signature block present (closing + attestation rule line)',
    /yours faithfully|signature/i.test(d) && /_{4,}/.test(d), '');
  record('AJ.17 EN date & place present', /date/i.test(d) && /place/i.test(d), '');
  record('AJ.18 EN verification/declaration present', /solemnly affirm|solemnly declar|hereby declar/i.test(d), '');
  record('AJ.19 EN footer "Prepared with INSAaf AI"', /prepared with insaaf ai/i.test(d), '');
  record('AJ.20 EN footer disclaimer (not legal advice / guidance only)', /not legal advice|guidance only/i.test(d), '');
  record('AJ.21 EN format-variation note', /formats may vary by court/i.test(d), '');
  record('AJ.22 user fact preserved in document (Gulberg PS Lahore)', /gulberg ps lahore/i.test(d), '');
  record('AJ.23 EN document is NOT Urdu (0 Urdu-script chars)', (d.match(URDU_RE) || []).length === 0, `${(d.match(URDU_RE) || []).length} urdu chars`);

  // ================= D. Toolbar: print / PDF / explain / edit / save =================
  t = await bodyLC();
  record('AJ.24 "Print / PDF" button present', t.includes('print / pdf'), '');
  record('AJ.25 "Explain This Document" button present', t.includes('explain this document'), '');
  record('AJ.26 "Edit Document" button present', t.includes('edit document'), '');
  record('AJ.27 "Save Draft" button present', t.includes('save draft'), '');
  const printWiring = await page.evaluate(() => {
    const pd = document.querySelector('#printable-doc');
    const wrap = pd ? pd.closest('.printable-document') : null;
    const toolbarNoPrint = !!document.querySelector('.no-print');
    return { hasPrintableDoc: !!pd, hasPrintableWrapper: !!wrap, a4: !!document.querySelector('.a4-page'), toolbarNoPrint };
  });
  record('AJ.28 print/PDF wiring (printable-document + a4-page + no-print toolbar)',
    printWiring.hasPrintableDoc && printWiring.hasPrintableWrapper && printWiring.a4 && printWiring.toolbarNoPrint,
    JSON.stringify(printWiring));

  // ================= E. Edits (F8 document edit loop) =================
  record('AJ.29 open the document editor', await clickButtonContaining('edit document'), '');
  await sleep(700);
  const editorOpen = await page.evaluate(() => !!document.querySelector('input[placeholder*="changes"], input[placeholder*="Tabdeeli"]'));
  record('AJ.30 editor chat input visible', editorOpen, '');
  const suggestions = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').trim())
      .filter(x => /remove karo|change karo|urdu script mein|english mein|naam change|remove this paragraph|change the applicant name|convert to urdu script|make it more formal|increase salary/i.test(x)));
  record('AJ.31 quick-edit suggestions offered', suggestions.length >= 3, `${suggestions.length} suggestions`);
  // Apply a real edit through the backend document-chat (applyLocalEdit).
  await page.evaluate(() => {
    const el = document.querySelector('input[placeholder*="changes"], input[placeholder*="Tabdeeli"]');
    if (el) { el.focus(); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(el, 'change the police station to Model Town Lahore'); el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.keyboard.press('Enter');
  const editStart = Date.now();
  let editApplied = false;
  while (Date.now() - editStart < 15000) {
    const bt = await bodyLC();
    if (bt.includes('what changed') || bt.includes('kya tabdeel hua')) { editApplied = true; break; }
    await sleep(400);
  }
  record('AJ.32 applying an edit reports "What changed" (edit loop works)', editApplied, '');

  // ================= F. Urdu Script generation (Part A fix) =================
  await clickButtonContaining('new draft');
  await sleep(1000);
  await clickCategory('Legal');
  await sleep(700);
  await clickSub('fir application');
  await sleep(800);
  await setFirstInput('Gulberg PS Lahore');
  record('AJ.33 select Urdu Script document language', await clickButtonContaining('urdu script'), '');
  await sleep(200);
  record('AJ.34 generate the Urdu Script document', await clickButtonContaining('generate document'), '');
  const urReady = await waitForPrintable();
  record('AJ.35 Urdu document rendered', urReady, '');
  doc = await printable();
  d = doc.text; dh = doc.html;
  const urCount = (d.match(URDU_RE) || []).length;
  record('AJ.36 Urdu output is in Urdu script (RTL, 200+ Urdu chars)', urCount >= 200 && /dir="rtl"/i.test(dh), `${urCount} urdu chars, rtl=${/dir="rtl"/i.test(dh)}`);
  record('AJ.37 Urdu heading present (درخواست برائے اندراج ایف آئی آر)', d.includes('درخواست برائے اندراج ایف آئی آر'), '');
  record('AJ.38 Urdu statute reference present (دفعہ 154)', d.includes('دفعہ 154'), '');
  record('AJ.39 Urdu signature block present (دستخط)', d.includes('دستخط'), '');
  record('AJ.40 Urdu footer present (انصاف اے آئی کی مدد سے تیار کردہ)', d.includes('انصاف اے آئی کی مدد سے تیار کردہ'), '');
  record('AJ.41 Urdu doc does NOT leak the English heading', !/application for registration of fir/i.test(d), '');
  record('AJ.42 Urdu doc does NOT leak English section labels (Subject/Prayer/Witnesses)', !/(^|\s)(subject|prayer|witnesses):/i.test(d), '');

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== PHASE AJ DRAFTING TEST: ${passed}/${results.length} PASS ====`);
  if (passed !== results.length) {
    console.log('FAILED CHECKS:');
    results.filter(r => !r.pass).forEach(r => console.log('  - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  }
  process.exit(passed === results.length ? 0 : 1);
})();
