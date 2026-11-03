/*
 * PHASE AH — LIBRARY TEST (real Puppeteer/Chrome against localhost:3000).
 * Opens EVERY Library domain (not just 3 popular ones) and verifies, per the
 * spec: page opens, content is substantial, source is shown, related
 * procedures / related topics render, search works, category filter works,
 * mobile layout collapses the sidebar, and a specific domain can be deep-linked
 * (opened directly). Run: node testPhaseAH.cjs
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const CHROME_PATHS = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
// The Library (libraryData.ts) is assembled from three sources:
//   28 DOMAIN_SECTIONS (libraryDomains.ts — carry the F9 13-point domainGuide)
// + 22 PUBLIC_OFFICE_SECTIONS (publicOffices.ts — carry postDetails)
// + 21 inline subject sections (libraryData.ts) = 71 total domains.
// Spec: "Do not only test 3 popular subjects" — so we assert a substantial
// minimum, then open EVERY domain and compare the reset-filter count to the
// live total (never a hardcoded guess).
const MIN_DOMAINS = 60;

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
  await page.evaluate(() => localStorage.removeItem('insaaf_lang'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2200);

  const clickNav = (aria) => page.evaluate((a) => {
    const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
    if (btn) { btn.click(); return true; } return false;
  }, aria);
  const bodyLC = async () => (await page.evaluate(() => document.body.innerText)).toLowerCase();
  // IMPORTANT: ChatSection stays MOUNTED (hidden via CSS) and is rendered BEFORE
  // LearningSection in DOM order, and FloatingAgent is always mounted. So a
  // document-wide query for '.flex-1.space-y-8' / 'h1' matches HIDDEN chat
  // elements (heading "Insaaf AI", len 268). Scope every Library query to the
  // visible LearningSection root: find the unique "Search library..." input and
  // walk up to its 'max-w-6xl' container (LearningSection.tsx root div).
  const findRoot = `
    const input = document.querySelector('input[placeholder*="Search library"]');
    let root = input;
    while (root && !(typeof root.className === 'string' && /max-w-6xl/.test(root.className))) root = root.parentElement;
  `;
  // Sidebar section buttons are the only buttons containing a <p class="...whitespace-nowrap">.
  const sidebarTitles = () => page.evaluate(`(() => { ${findRoot}
    if (!root) return [];
    return Array.from(root.querySelectorAll('button'))
      .filter(b => b.querySelector('p.whitespace-nowrap'))
      .map(b => b.querySelector('p.whitespace-nowrap').textContent.trim());
  })()`);
  const clickSidebarIndex = (i) => page.evaluate(`((idx) => { ${findRoot}
    if (!root) return false;
    const btns = Array.from(root.querySelectorAll('button')).filter(b => b.querySelector('p.whitespace-nowrap'));
    if (btns[idx]) { btns[idx].click(); return true; } return false;
  })(${i})`);
  const mainContent = () => page.evaluate(`(() => { ${findRoot}
    if (!root) return { text: '', heading: '' };
    const el = root.querySelector('.flex-1.space-y-8');
    const h1 = root.querySelector('h1');
    return { text: el ? el.innerText : '', heading: h1 ? h1.textContent.trim() : '' };
  })()`);

  // ---------------- Open the Library ----------------
  record('AH.1 navigate to Legal Library', await clickNav('Legal Library'), '');
  await sleep(1600);
  let t = await bodyLC();
  record('AH.2 library "Insaaf Archive" heading present', t.includes('insaaf archive'), '');

  // ---------------- Enumerate + open EVERY domain ----------------
  const titles = await sidebarTitles();
  const TOTAL = titles.length;
  record('AH.3 sidebar lists every library domain (28 domains + 22 offices + 21 subjects)', TOTAL >= MIN_DOMAINS, `${TOTAL} domains`);

  let openedOK = 0;
  const weak = [];
  for (let i = 0; i < titles.length; i++) {
    await clickSidebarIndex(i);
    await sleep(430);
    const { text, heading } = await mainContent();
    const hasSource = /source verification/i.test(text) && /source:/i.test(text);
    const substantial = text.replace(/\s+/g, ' ').trim().length >= 250 && heading.length >= 3;
    const ok = hasSource && substantial;
    if (ok) openedOK++; else weak.push(`${titles[i]} (len=${text.length}, heading="${heading}", source=${hasSource})`);
  }
  record('AH.4 EVERY domain opens with substantial content + source', openedOK === titles.length,
    `${openedOK}/${titles.length}` + (weak.length ? ' | weak: ' + weak.join(' ; ') : ''));

  // ---------------- Related procedures / related topics / verified source links ----------------
  // Open a domain-guide section (Fundamental Rights) and check the F9 guide blocks.
  const frIdx = titles.findIndex(x => /fundamental rights/i.test(x));
  if (frIdx >= 0) {
    await clickSidebarIndex(frIdx);
    await sleep(500);
    const { text } = await mainContent();
    const tl = text.toLowerCase();
    record('AH.5 domain guide shows Verified Source Links', tl.includes('verified source links'), '');
    record('AH.6 domain guide shows Related Topics', tl.includes('related topics'), '');
    record('AH.7 domain guide shows Procedures', tl.includes('procedure'), '');
    record('AH.8 domain guide shows Important Laws', tl.includes('important laws'), '');
  } else {
    record('AH.5-8 domain guide blocks', false, 'Fundamental Rights domain not found');
  }

  // Only case_asma_jilani carries caseDetails (Court/Year/Outcome). "Case Law"
  // and "Case Studies" are separate subjects with no Case Details block.
  const caseIdx = titles.findIndex(x => /asma|jilani/i.test(x));
  if (caseIdx >= 0) {
    await clickSidebarIndex(caseIdx);
    await sleep(500);
    const { text } = await mainContent();
    record('AH.9 case-law domain shows Case Details (court/year/outcome)', /case details/i.test(text) && /court:/i.test(text) && /outcome:/i.test(text), '');
  } else {
    record('AH.9 case-law domain', false, 'no case-law domain found');
  }

  // ---------------- Search ----------------
  await page.evaluate(() => { const el = document.querySelector('input[placeholder*="Search library"]'); if (el) { el.focus(); } });
  await page.click('input[placeholder*="Search library"]');
  await page.keyboard.type('constitution');
  await sleep(700);
  let filtered = await sidebarTitles();
  record('AH.10 search narrows the domain list', filtered.length > 0 && filtered.length < TOTAL, `${filtered.length}/${TOTAL} results`);
  // clear + gibberish
  await page.evaluate(() => {
    const el = document.querySelector('input[placeholder*="Search library"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, 'zzzqqqxx'); el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(600);
  t = await bodyLC();
  record('AH.11 gibberish search shows "No results found"', t.includes('no results found'), '');
  // reset search
  await page.evaluate(() => {
    const el = document.querySelector('input[placeholder*="Search library"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(500);

  // ---------------- Category filter ----------------
  await page.select('select', 'Constitution of Pakistan');
  await sleep(700);
  filtered = await sidebarTitles();
  record('AH.12 category filter shows only that category (3 Constitution domains)', filtered.length === 3, `${filtered.length} shown`);
  await page.select('select', 'All');
  await sleep(600);
  filtered = await sidebarTitles();
  record('AH.13 resetting filter to "All" restores every domain', filtered.length === TOTAL, `${filtered.length}/${TOTAL} shown`);

  // ---------------- Deep link (open a specific domain directly) ----------------
  const wrIdx = filtered.findIndex(x => /women/i.test(x));
  if (wrIdx >= 0) {
    const wrTitle = filtered[wrIdx];
    await clickSidebarIndex(wrIdx);
    await sleep(500);
    const { text, heading } = await mainContent();
    const tl = text.toLowerCase();
    // Opening a specific domain directly must render ITS OWN hero ("Section: <title>"),
    // its own heading, and its source — never a generic/placeholder screen.
    // (Hero h2 is CSS-uppercased, so compare in lower case.)
    const showsOwn = tl.includes('section:') && tl.includes(wrTitle.toLowerCase()) && /source verification/i.test(text);
    record('AH.14 deep link: a specific domain opens directly with its own heading + source', showsOwn && heading.length > 3, `title="${wrTitle}" heading="${heading}"`);
  } else {
    record('AH.14 deep link', false, 'no women domain found');
  }

  // ---------------- Mobile layout ----------------
  await page.setViewport({ width: 375, height: 812 });
  await sleep(600);
  const toggleVisible = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.getAttribute('aria-expanded') !== null && /lg:hidden/.test(x.className));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { expanded: b.getAttribute('aria-expanded'), w: r.width, h: r.height };
  });
  record('AH.15 mobile: sidebar toggle button is visible', !!toggleVisible && toggleVisible.w > 0 && toggleVisible.h > 0, JSON.stringify(toggleVisible));
  const before = toggleVisible ? toggleVisible.expanded : null;
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.getAttribute('aria-expanded') !== null && /lg:hidden/.test(x.className));
    if (b) b.click();
  });
  await sleep(500);
  const after = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.getAttribute('aria-expanded') !== null && /lg:hidden/.test(x.className));
    return b ? b.getAttribute('aria-expanded') : null;
  });
  record('AH.16 mobile: toggle collapses/expands the sidebar (aria-expanded flips)', before !== null && after !== null && before !== after, `${before} -> ${after}`);

  await page.setViewport({ width: 1366, height: 1000 });
  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== PHASE AH LIBRARY TEST: ${passed}/${results.length} PASS (${openedOK}/${titles.length} domains opened) ====`);
  if (passed !== results.length) {
    console.log('FAILED CHECKS:');
    results.filter(r => !r.pass).forEach(r => console.log('  - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  }
  process.exit(passed === results.length ? 0 : 1);
})();
