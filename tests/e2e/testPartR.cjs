/*
 * Part R / Part S — browser verification against the RUNNING app (localhost:3000).
 *  - Part R: the 7 newly added legal document formats render in the Document
 *    Drafter (Legal category) and open their own type-specific field forms.
 *  - Part S: generating a document produces the per-type professional structure
 *    (heading from documentStructures.ts) AND the "Prepared with INSAaf AI"
 *    footer + disclaimer in the printable document.
 * Run: node testPartR.cjs
 */
const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';
const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// EN labels as rendered by getLocalizedLabel (text before the first "/").
const NEW_FORMATS = [
  'reply to legal notice', 'pre-arrest bail', 'post-arrest bail', 'injunction',
  'maintenance application', 'guardianship application', 'writ petition'
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1366, height: 1000 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.removeItem('insaaf_lang')); // force EN
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2200);

  const bodyLC = async () => (await page.evaluate(() => document.body.innerText)).toLowerCase();
  const clickNav = (aria) => page.evaluate((a) => {
    const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
    if (btn) { btn.click(); return true; } return false;
  }, aria);
  // Category buttons contain an <h3>; subcategory buttons contain a <span>.
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
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, value);

  // ---------------- Part R: new formats present ----------------
  try {
    record('R.0 navigate to Document Drafter', await clickNav('Document Drafter'), '');
    await sleep(1400);
    record('R.1 open Legal category', await clickCategory('Legal'), '');
    await sleep(900);
    const t = await bodyLC();
    const present = NEW_FORMATS.filter(f => t.includes(f));
    record('R.2 all 7 new legal formats listed', present.length === 7,
      `${present.length}/7` + (present.length < 7 ? ` missing: ${NEW_FORMATS.filter(x => !present.includes(x)).join(' | ')}` : ''));
  } catch (e) { record('R formats', false, e.message); }

  // ---------------- Part R: Pre-Arrest Bail form + structure ----------------
  try {
    record('R.3 open Pre-Arrest Bail', await clickSub('pre-arrest bail'), '');
    await sleep(800);
    let t = await bodyLC();
    record('R.4 pre-arrest bail shows its own fields', t.includes('grounds for pre-arrest bail') && t.includes('surety'), '');

    // Fill one field, choose English, generate -> step 3.
    await setFirstInput('Court of Sessions Judge, Lahore');
    await clickButtonContaining('english');
    await sleep(200);
    record('R.5 generate the document', await clickButtonContaining('generate document'), '');
    await sleep(3500);
    t = await bodyLC();
    record('R.6 per-type professional heading used (Section 498 CrPC)', t.includes('pre-arrest bail application') && t.includes('498'), t.slice(0, 0));
    // ---------------- Part S: footer ----------------
    record('S.1 generated doc carries "Prepared with INSAaf AI" footer', t.includes('prepared with insaaf ai'), '');
    record('S.2 footer carries a not-legal-advice disclaimer', t.includes('not legal advice') || t.includes('guidance only'), '');
  } catch (e) { record('R/S pre-arrest bail', false, e.message); }

  // ---------------- Part R: Writ Petition form ----------------
  try {
    await clickButtonContaining('new draft');
    await sleep(900);
    await clickCategory('Legal');
    await sleep(700);
    record('R.7 open Writ Petition', await clickSub('writ petition'), '');
    await sleep(800);
    const t = await bodyLC();
    record('R.8 writ petition shows Article 199 fields', t.includes('nature of writ') && t.includes('article 199'), '');
  } catch (e) { record('R writ petition', false, e.message); }

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== testPartR: ${passed}/${results.length} PASS ====`);
  if (passed !== results.length) {
    console.log('FAILED CHECKS:');
    results.filter(r => !r.pass).forEach(r => console.log('  - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  }
  process.exit(passed === results.length ? 0 : 1);
})();
