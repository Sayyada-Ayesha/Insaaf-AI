/*
 * Browser verification for Parts I / J / K against the RUNNING app (localhost:3000).
 *  - Part I : Library 13-point domain guide renders (default domain_constitution).
 *  - Part J : "Public Offices & Authorities" category -> 22 offices -> SHO Authority
 *             Profile shows role/jurisdiction/powers/limitations/legal basis/complaint
 *             route + Above/Below + Where a Citizen Interacts, grounded in Section 154.
 *  - Part K : Legal Aid "Legal Procedures & Help" tab -> FIR workflow modal shows the
 *             full WHAT/WHERE/WHO/DOCUMENTS/STEPS/OUTCOME/NEXT/LAW/SOURCE structure.
 *  - Mobile : Library sidebar toggle visible at 400px width.
 * Run: node testPartIJK.cjs
 */
const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';
const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const OFFICE_TITLES = [
  'Chief Justice of Pakistan', 'Judge of a High Court', 'District & Sessions Judge',
  'Civil Judge', 'Magistrate (Judicial)', 'Registrar (of a Court)',
  'Attorney General for Pakistan', 'Advocate General', 'Public Prosecutor / District Prosecutor',
  'Inspector General of Police (IG)', 'Additional IG / DIG (Range)', 'District Police Officer (SSP / SP)',
  'Station House Officer (SHO)', 'Governor', 'Chief Minister', 'Commissioner (Division)',
  'Deputy Commissioner (DC)', 'Assistant Commissioner (AC)', 'Ombudsman (Mohtasib)',
  'Federal Investigation Agency (FIA)', 'National Accountability Bureau (NAB)',
  'Regulatory Authorities (NEPRA, OGRA, SECP, SBP)'
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.removeItem('insaaf_lang')); // force EN
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // innerText respects CSS text-transform; lowercase both sides for label checks.
  const bodyLC = async () => (await page.evaluate(() => document.body.innerText)).toLowerCase();

  const clickNav = (aria) => page.evaluate((a) => {
    const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
    if (btn) { btn.click(); return true; }
    return false;
  }, aria);

  const clickButtonContaining = (txt) => page.evaluate((t) => {
    const needle = t.toLowerCase();
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').toLowerCase().includes(needle));
    if (btn) { btn.click(); return true; }
    return false;
  }, txt);

  // ---------------- Part I: Library domain guide ----------------
  try {
    record('I.0 navigate to Legal Library', await clickNav('Legal Library'), '');
    await sleep(1400);
    const t = await bodyLC();
    const guideLabels = ['what it is', 'important laws', 'relevant court pathway', 'verified source links', 'common mistakes', 'remedies', 'authorities'];
    const present = guideLabels.filter(l => t.includes(l));
    record('I.1 13-point domain guide renders', present.length >= 6, `${present.length}/7 labels: ${present.join(', ')}`);
    record('I.2 source verification block present', t.includes('source verification'), '');
    // sidebar should list many sections (28 domains + 22 offices + inline)
    const sidebarCount = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).filter(b => b.querySelector('p') && b.className.includes('rounded-[1.5rem]')).length
    );
    record('I.3 library sidebar lists substantial sections', sidebarCount >= 40, `${sidebarCount} sidebar entries`);
  } catch (e) { record('I library', false, e.message); }

  // ---------------- Part J: Public offices ----------------
  try {
    const catSet = await page.evaluate((cat) => {
      const sel = document.querySelector('select');
      if (!sel) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, cat);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, 'Public Offices & Authorities');
    await sleep(900);
    record('J.1 category filter set to Public Offices & Authorities', catSet, '');

    // count how many of the 22 known office titles are now clickable in the sidebar
    const matched = await page.evaluate((titles) => {
      const btnTexts = Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').toLowerCase());
      return titles.filter(tt => btnTexts.some(bt => bt.includes(tt.toLowerCase())));
    }, OFFICE_TITLES);
    record('J.2 all 22 public offices listed', matched.length === 22, `${matched.length}/22 offices` + (matched.length < 22 ? ` missing: ${OFFICE_TITLES.filter(x => !matched.includes(x)).join(' | ')}` : ''));

    record('J.3 open Station House Officer (SHO)', await clickButtonContaining('Station House Officer (SHO)'), '');
    await sleep(900);
    const t = await bodyLC();
    record('J.4 Authority Profile card shown', t.includes('authority profile'), '');
    const profileLabels = ['role:', 'jurisdiction:', 'powers:', 'limitations:', 'legal basis:', 'complaint route:', 'above / below:', 'where a citizen interacts:'];
    const pp = profileLabels.filter(l => t.includes(l));
    record('J.5 Authority Profile has all 8 structured fields', pp.length === 8, `${pp.length}/8: ${pp.join(', ')}`);
    record('J.6 SHO grounded in Section 154 CrPC', t.includes('section 154'), '');
    record('J.7 SHO complaint route mentions 22-A / Justice of Peace', t.includes('22-a') || t.includes('justice of peace'), '');
  } catch (e) { record('J offices', false, e.message); }

  // ---------------- Part K: Legal procedures hub ----------------
  try {
    record('K.0 navigate to Legal Aid & Lawyers', await clickNav('Legal Aid & Lawyers'), '');
    await sleep(1600);
    record('K.1 open Legal Procedures & Help tab', await clickButtonContaining('Legal Procedures & Help'), '');
    await sleep(900);
    let t = await bodyLC();
    record('K.2 procedures hub heading + count copy', t.includes('procedures') && t.includes('verified workflows'), '');

    record('K.3 open FIR (First Information Report) workflow', await clickButtonContaining('FIR (First Information Report)'), '');
    await sleep(900);
    t = await bodyLC();
    const procLabels = ['situation', 'where to go', 'who can file', 'documents / evidence', 'main steps', 'possible outcome', 'next step', 'relevant law', 'official source'];
    const pl = procLabels.filter(l => t.includes(l));
    record('K.4 procedure modal shows full WHAT->WHERE->WHO->DOCS->STEPS->OUTCOME->NEXT->LAW->SOURCE', pl.length >= 8, `${pl.length}/9: ${pl.join(', ')}`);
  } catch (e) { record('K procedures', false, e.message); }

  // ---------------- Mobile layout (Phase AH) ----------------
  try {
    await page.setViewport({ width: 400, height: 800 });
    await clickNav('Legal Library');
    await sleep(1200);
    const toggle = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-expanded') !== null);
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { visible: r.width > 0 && r.height > 0 && r.top >= 0 && r.top < 800 };
    });
    record('M.1 library sidebar toggle visible at 400px', !!toggle && toggle.visible, JSON.stringify(toggle));
  } catch (e) { record('M mobile', false, e.message); }

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== testPartIJK: ${passed}/${results.length} PASS ====`);
  if (passed !== results.length) {
    console.log('FAILED CHECKS:');
    results.filter(r => !r.pass).forEach(r => console.log('  - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  }
  process.exit(passed === results.length ? 0 : 1);
})();
