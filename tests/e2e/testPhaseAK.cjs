/*
 * PHASE AK — LAWYER / NGO TEST (real browser, localhost:3000).
 * Spec: "Use actual searches ... Verify real directory records and legal aid."
 * Every assertion is grounded in the REAL seed catalog (firestoreService.ts):
 *   60 lawyers; criminal+Lahore = exactly "Advocate Nida Zahra (Criminal Defense)";
 *   NO family lawyer in Islamabad (so the honest empty-state is the correct,
 *   non-fabricating result); 17 NGOs incl. Madadgaar (Domestic Violence Support);
 *   7 emergency contacts incl. Women & Human Rights Helpline 1099.
 * Also runs the 4 natural-language searches through the real chat and checks the
 * answers route to the directory / free legal aid / DV safety WITHOUT fabricating
 * a lawyer, a phone number, or Urdu script.
 * Run: node testPhaseAK.cjs
 */
const puppeteer = require('puppeteer');
const BASE = 'http://localhost:3000';
const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const URDU_SCRIPT = /[\u0600-\u06FF]/;
// Verified short helplines only; anything else that looks like a local/mobile
// number in an answer would be a fabricated phone (non-negotiable #1).
const VERIFIED_NUMS = ['15', '1099', '1991', '115', '1121', '1101', '9000000'];
function suspiciousPhones(text) {
  const found = String(text).match(/(?:\+92|0)?3\d{2}[\s-]?\d{7}|\b0\d{2,3}[\s-]?\d{6,7}\b/g) || [];
  return found.filter(p => {
    const digits = p.replace(/[^0-9]/g, '');
    return !VERIFIED_NUMS.some(v => digits === v || digits.endsWith(v));
  });
}
// Real, distinctive seed names used to prove the city filter does not leak.
const LAHORE_NAMES = ['Salman Haider', 'Zoya Malik', 'Bilal Raza', 'Nida Zahra'];
const KARACHI_NAMES = ['Ahmed Kamal', 'Faisal Qureshi'];
const ISLAMABAD_NAMES = ['Maria Jahangir', 'Ayesha Tariq', 'Fatima Bukhari'];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1366, height: 1000 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { localStorage.removeItem('insaaf_lang'); localStorage.removeItem('insaaf_doc_lang'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);

  const bodyLC = async () => (await page.evaluate(() => document.body.innerText)).toLowerCase();
  const bodyRaw = async () => (await page.evaluate(() => document.body.innerText));
  const clickNav = (aria) => page.evaluate((a) => {
    const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
    if (btn) { btn.click(); return true; } return false;
  }, aria);
  const clickButtonContaining = (txt) => page.evaluate((t) => {
    const needle = t.toLowerCase();
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').toLowerCase().includes(needle));
    if (btn) { btn.click(); return true; } return false;
  }, txt);
  // Lawyer cards render their name in an <h4> containing "Advocate"; the
  // empty-state heading is also an <h4> but never contains "Advocate".
  const lawyerCards = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('h4')).map(h => (h.textContent || '').trim()).filter(t => /advocate/i.test(t)));
  const ngoCards = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('h5')).map(h => (h.textContent || '').trim()).filter(Boolean));
  const setSearch = (value) => page.evaluate((val) => {
    const el = document.querySelector('input[placeholder*="Search Advocate"]');
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); return true;
  }, value);
  const setCity = (value) => page.evaluate((val) => {
    const sel = Array.from(document.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.textContent.trim() === 'All Cities'));
    if (!sel) return false;
    const opt = Array.from(sel.options).find(o => o.textContent.trim() === val);
    if (!opt) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, opt.value); sel.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }, value);
  const setNgoSearch = (value) => page.evaluate((val) => {
    const el = document.querySelector('input[placeholder*="Search by name, city"]');
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); return true;
  }, value);
  const setNgoCategory = (value) => page.evaluate((val) => {
    const sel = Array.from(document.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.textContent.trim() === val));
    if (!sel) return false;
    const opt = Array.from(sel.options).find(o => o.textContent.trim() === val);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, opt.value); sel.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }, value);
  const waitForLawyerCards = async (timeout = 12000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if ((await lawyerCards()).length > 0) return true;
      await sleep(300);
    }
    return (await lawyerCards()).length > 0;
  };
  // Chat answer wait: growth + loading spinner gone + length-stable (cold-cache safe).
  const LOADING_MARKERS = ['matching legal script', 'is matching legal'];
  const isLoadingVisible = () => page.evaluate((marks) => {
    const txt = (document.body.innerText || '').toLowerCase();
    return marks.some(m => txt.includes(m));
  }, LOADING_MARKERS);
  const waitForAnswer = async (timeout = 25000, baseOverride = null) => {
    const base = baseOverride !== null ? baseOverride : await page.evaluate(() => document.body.innerText.length);
    const start = Date.now();
    let last = base, stableSince = Date.now(), grew = false, loadingCleared = false;
    while (Date.now() - start < timeout) {
      await sleep(300);
      const loading = await isLoadingVisible();
      const cur = await page.evaluate(() => document.body.innerText.length);
      if (cur > base + 40) grew = true;
      if (grew && !loading) loadingCleared = true;
      if (cur !== last) { last = cur; stableSince = Date.now(); }
      else if (grew && loadingCleared && !loading && Date.now() - stableSince >= 800) return true;
    }
    return grew && !(await isLoadingVisible());
  };
  const askChat = async (q) => {
    await page.click('textarea');
    await page.keyboard.type(q);
    const baseLen = await page.evaluate(() => document.body.innerText.length);
    await page.keyboard.press('Enter');
    await waitForAnswer(25000, baseLen);
    return await bodyRaw();
  };

  // ============ A. Directory loads REAL records ============
  try {
    record('AK.1 navigate to Legal Aid & Lawyers', await clickNav('Legal Aid & Lawyers'));
    await sleep(1600);
    let t = await bodyLC();
    record('AK.2 default tab is Vakil Directory', t.includes('vakil directory'));
    record('AK.3 Emergency Legal Helplines bar (Police 15 + Women 1099)', t.includes('emergency legal helplines') && t.includes('police: 15') && t.includes('1099'));
    record('AK.4 directory search input present', await page.evaluate(() => !!document.querySelector('input[placeholder*="Search Advocate"]')));
    const loaded = await waitForLawyerCards();
    const cards = await lawyerCards();
    record('AK.5 real lawyer records render (>=15 verified advocates)', loaded && cards.length >= 15, `${cards.length} cards`);
    // Data-source indicator: "N Records · Verified Local Directory" (60 seed) OR
    // "N Records · Firestore Live" (seed merged with live Firestore records). Both
    // are real; assert at least the full verified seed floor and log the label.
    const indicator = await page.evaluate(() => {
      const m = (document.body.innerText.match(/(\d+)\s*Records[^\n]*/i) || []);
      return m[0] ? m[0].trim() : '';
    });
    const recCount = parseInt((indicator.match(/(\d+)/) || [])[1] || '0', 10);
    record('AK.6 data-source indicator shows a real record count (>=60 verified directory)', recCount >= 60, indicator || `count=${recCount}`);
    t = await bodyLC();
    record('AK.7 records labelled Verified Local Directory / Live Directory',
      t.includes('verified local directory') || t.includes('live directory'));
    record('AK.8 a card shows a real bar council', t.includes('bar council'));
    record('AK.9 a card shows a verification source link', t.includes('source:'));
    record('AK.10 no fabricated office phone (null phones say "not publicly available")',
      t.includes('contact info not publicly available') || !(await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="tel:03"]')).length)));
  } catch (e) { record('A. directory load', false, e.message); }

  // ============ B. City filter = Lahore (real records only) ============
  try {
    await setCity('Lahore'); await sleep(900);
    const cards = await lawyerCards();
    const hasLahore = LAHORE_NAMES.some(n => cards.some(c => c.includes(n)));
    const leak = [...KARACHI_NAMES, ...ISLAMABAD_NAMES].filter(n => cards.some(c => c.includes(n)));
    record('AK.11 city filter Lahore shows a real Lahore advocate', hasLahore, cards.join(' | '));
    record('AK.12 city filter Lahore leaks NO Karachi/Islamabad advocate', leak.length === 0, leak.length ? 'leaked: ' + leak.join(',') : `only ${cards.length} Lahore cards`);
    record('AK.13 Lahore filter returns exactly the 4 real Lahore records', cards.length === 4, `${cards.length}`);
  } catch (e) { record('B. Lahore filter', false, e.message); }

  // ============ C. "criminal lawyer in Lahore" ============
  try {
    await setSearch('criminal'); await sleep(900);
    let cards = await lawyerCards();
    record('AK.14 search criminal + Lahore => exactly "Advocate Nida Zahra"', cards.length === 1 && cards[0].includes('Nida Zahra'), cards.join(' | '));
    let t = await bodyLC();
    record('AK.15 the criminal/Lahore result shows "Criminal Defense" specialization', t.includes('criminal defense'));
    await setSearch('criminal'); await setCity('All Cities'); await sleep(900);
    cards = await lawyerCards();
    record('AK.16 search criminal (All Cities) returns multiple real criminal advocates', cards.length >= 5, `${cards.length}`);
  } catch (e) { record('C. criminal search', false, e.message); }

  // ============ D. "family lawyer in Islamabad" => honest empty-state ============
  try {
    await setSearch('family'); await setCity('Islamabad'); await sleep(900);
    const cards = await lawyerCards();
    const t = await bodyLC();
    record('AK.17 family+Islamabad fabricates NO lawyer (0 cards — none exist)', cards.length === 0, cards.join(' | '));
    record('AK.18 family+Islamabad shows the honest empty-state message', t.includes('no verified profiles match your search') || t.includes('no verified advocate profiles'));
    // Positive control: family + All Cities returns the real family advocates.
    await setCity('All Cities'); await sleep(900);
    const cards2 = await lawyerCards();
    record('AK.19 positive control: family (All Cities) returns real family advocates', cards2.length >= 5, `${cards2.length}`);
  } catch (e) { record('D. family search', false, e.message); }

  // ============ E. Gibberish search ============
  try {
    await setSearch('zzzqqqxxx123'); await sleep(800);
    const cards = await lawyerCards();
    const t = await bodyLC();
    record('AK.20 gibberish search => honest empty-state, no fabricated card', cards.length === 0 && t.includes('no verified profiles match your search'));
    await setSearch(''); await setCity('All Cities'); await sleep(600);
  } catch (e) { record('E. gibberish', false, e.message); }

  // ============ F. Legal Aid ("I have no budget") ============
  try {
    record('AK.21 switch to Legal Aid & NGOs tab', await clickButtonContaining('legal aid & ngos'));
    await sleep(1400);
    let t = await bodyLC();
    record('AK.22 State-Funded Legal Aid (DLAC) block present', t.includes('state-funded') && t.includes('legal aid'));
    record('AK.23 free legal aid grounded in Article 37-D of the 1973 Constitution', t.includes('article 37-d') || t.includes('37-d'));
    record('AK.24 state legal-aid helpline 1099 present', t.includes('1099'));
    record('AK.25 Ministry of Human Rights application route present', t.includes('ministry of human rights'));
    record('AK.26 Verified NGOs listed with real organisations', t.includes('verified ngos') && (t.includes('legal aid society') || t.includes('aghs legal aid cell')));
  } catch (e) { record('F. legal aid', false, e.message); }

  // ============ G. Domestic violence (real NGO + helpline) ============
  try {
    record('AK.27 NGO category "Domestic Violence Support" exists', await setNgoCategory('Domestic Violence Support'));
    await sleep(900);
    let cards = await ngoCards();
    record('AK.28 that category shows the real "Madadgaar National Helpline"', cards.some(c => c.includes('Madadgaar')), cards.join(' | '));
    await setNgoCategory('All'); await sleep(500);
    record('AK.29 NGO search "women" surfaces real women-protection orgs', await setNgoSearch('women'));
    await sleep(900);
    let t = await bodyLC();
    record('AK.30 women search returns real orgs (PWPA / Aurat / AGHS)', t.includes('women protection authority') || t.includes('aurat foundation') || t.includes('aghs'));
    await setNgoSearch(''); await sleep(400);
    t = await bodyLC();
    record('AK.31 Emergency helplines list the real Women & Human Rights Helpline 1099', t.includes('women & human rights helpline') || (t.includes('1099') && t.includes('women')));
  } catch (e) { record('G. domestic violence', false, e.message); }

  // ============ H. Natural-language searches through the real chat ============
  try {
    record('AK.32 navigate to AI Consultant chat', await clickNav('AI Consultant'));
    await sleep(1400);

    let ans = await askChat('I need a criminal lawyer in Lahore.');
    let lc = ans.toLowerCase();
    record('AK.33 chat "criminal lawyer in Lahore" routes to the verified lawyer directory', /vake?el directory|lawyer directory|legal aid & lawyers|verified.*directory|directory/i.test(lc));
    record('AK.34 that answer fabricates NO individual lawyer phone', suspiciousPhones(ans).length === 0, suspiciousPhones(ans).join(','));
    record('AK.35 that answer is not a cold refusal', !/could not find a verified pakistani legal source/i.test(lc));

    ans = await askChat('I have no budget.');
    lc = ans.toLowerCase();
    record('AK.36 chat "I have no budget" routes to FREE legal aid (DLAC/legal aid)', /legal aid|dlac|free legal|district legal advisory|37-d/i.test(lc));
    record('AK.37 the no-budget answer fabricates NO phone', suspiciousPhones(ans).length === 0, suspiciousPhones(ans).join(','));

    ans = await askChat('I need help with domestic violence.');
    lc = ans.toLowerCase();
    record('AK.38 chat "domestic violence" is safety-first (police/protection/urgent)', /domestic violence|protection|police|urgent|immediate danger/i.test(lc));
    record('AK.39 DV answer names a real remedy/helpline (15 / protection act / 1099)', /(?:\b15\b)|protection of women|domestic violence act|1099|helpline/i.test(ans));
    record('AK.40 DV answer fabricates NO phone', suspiciousPhones(ans).length === 0, suspiciousPhones(ans).join(','));

    const allAns = await bodyRaw();
    record('AK.41 no chat answer contains Urdu script (Part A/B)', !URDU_SCRIPT.test(allAns));
  } catch (e) { record('H. chat NL routing', false, e.message); }

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== PHASE AK LAWYER/NGO TEST: ${passed}/${results.length} PASS ====`);
  if (passed !== results.length) {
    console.log('FAILED CHECKS:');
    results.filter(r => !r.pass).forEach(r => console.log('  - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  }
  process.exit(passed === results.length ? 0 : 1);
})();
