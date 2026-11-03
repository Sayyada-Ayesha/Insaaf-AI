/**
 * Phase UI-5: website-style answer flow, discoverability and policy pages.
 * Exercises the real chat API through the UI (no mocked answers).
 * Run: APP_URL=http://127.0.0.1:3005 node tests/e2e/testUiPhaseAnswer.cjs
 */
const puppeteer = require('puppeteer-core');

const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
];
const BASE = process.env.APP_URL || 'http://127.0.0.1:3005';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (k, m) => { pass++; console.log('PASS ' + k + ': ' + m); };
const bad = (k, m) => { fail++; console.log('FAIL ' + k + ': ' + m); };
const info = (k, m) => console.log('• ' + k + ': ' + m);

const text = (page, sel) => page.$eval(sel, el => (el.innerText || el.textContent || '').trim()).catch(() => '');
const visible = (page, sel) => page.$eval(sel, el => !!(el && el.isConnected && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))).catch(() => false);

async function waitForAnswer(page, needle, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const q = await text(page, '[data-testid="result-question"]');
    const a = await text(page, '[data-testid="result-answer"]');
    const stillLoading = await page.$eval('[data-testid="result-answer"] [role="status"]', el => !!el).catch(() => false);
    if (q.includes(needle) && !stillLoading && a.length > 200) return { q, a };
    await sleep(1000);
  }
  return { q: await text(page, '[data-testid="result-question"]'), a: await text(page, '[data-testid="result-answer"]') };
}

(async () => {
  const executablePath = CHROME_PATHS.find(p => { try { return require('fs').existsSync(p); } catch { return false; } });
  if (!executablePath) { console.error('Chrome not found'); process.exit(2); }
  const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });

  // ---- A. A real question opens the document-style result surface
  const homeInput = await page.$('[data-testid="home-search-input"]');
  if (homeInput) ok('A0', 'home search field is present');
  else bad('A0', 'home search field missing');
  await page.type('[data-testid="home-search-input"]', 'What is Section 489-F PPC about?');
  await page.click('[data-testid="home-search-submit"]');

  let first = await waitForAnswer(page, '489-F');
  if (first.a.length > 60) ok('A1', `result answer rendered (${first.a.length} chars)`);
  else bad('A1', `no result answer rendered (got ${first.a.length} chars)`);
  if (await visible(page, '[data-testid="answer-result"]')) ok('A2', 'answer-result surface visible after submit');
  else bad('A2', 'answer-result surface not visible');
  if (first.q.toLowerCase().includes('489-f')) ok('A3', `question preserved distinctly: "${first.q.slice(0, 80)}"`);
  else bad('A3', `question heading missing/incorrect: "${first.q.slice(0, 80)}"`);
  if (first.a.toLowerCase().includes('cheque') || first.a.toLowerCase().includes('dishonour') || first.a.toLowerCase().includes('dishonor')) {
    ok('A4', 'answer addresses the dishonoured-cheque subject directly');
  } else bad('A4', `answer did not address the subject: "${first.a.slice(0, 160)}"`);
  const sourceCount = await page.$$eval('[data-testid="result-sources"] a', as => as.length).catch(() => 0);
  if (sourceCount > 0) ok('A5', `${sourceCount} official source link(s) shown`);
  else bad('A5', 'no official source link shown');
  const exploreCount = await page.$$eval('[data-testid^="result-explore-"]', els => els.length).catch(() => 0);
  if (exploreCount >= 9) ok('A6', `${exploreCount} explore destinations available on the answer page`);
  else bad('A6', `only ${exploreCount} explore destinations`);
  const searchVisible = await visible(page, '[data-testid="result-search-form"]');
  if (searchVisible) ok('A7', 're-usable search field visible on the answer page');
  else bad('A7', 'no re-usable search field on the answer page');

  // ---- B. A second question replaces the first answer (no stale state)
  await sleep(11000);
  await page.click('[data-testid="result-search-input"]');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.type('[data-testid="result-search-input"]', 'Sindh mein scholarship ke liye apply kaise karun?');
  await page.keyboard.press('Enter');
  const second = await waitForAnswer(page, 'scholarship');
  if (second.a.length > 60) ok('B1', `second answer rendered (${second.a.length} chars)`);
  else bad('B1', `second answer missing (${second.a.length} chars)`);
  if (second.q.includes('scholarship') && !second.q.includes('489-F')) ok('B2', 'second question replaced the first question heading');
  else bad('B2', `question heading stale: "${second.q.slice(0, 100)}"`);
  if (!second.a.includes('489-F')) ok('B3', 'previous answer did not leak into the new answer');
  else bad('B3', 'previous answer text leaked into the second answer');
  if (/scholarship|sindh|apply|darkhwast|sikholarship/i.test(second.a)) ok('B4', 'second answer stays on the scholarship question');
  else bad('B4', `second answer off-topic: "${second.a.slice(0, 160)}"`);

  // ---- C. Back to topics returns to the visible topic directory
  await page.click('[data-testid="result-back-topics"]');
  await sleep(1200);
  if (await visible(page, '#home-topics-title')) ok('C1', 'Back to topics shows the Browse by Topic directory');
  else bad('C1', 'Back to topics did not reveal the topic directory');
  const topicCards = await page.$$eval('[data-testid^="home-topic-"]', els => els.filter(e => e.checkVisibility()).length).catch(() => 0);
  if (topicCards >= 9) ok('C2', `${topicCards} topic cards reachable from home`);
  else bad('C2', `only ${topicCards} topic cards visible`);

  // ---- D. Footer policy pages are real pages with headings and sections
  for (const [id, label] of [['privacy', 'Privacy'], ['terms', 'Terms'], ['copyright', 'Disclaimer']]) {
    const clicked = await page.evaluate((label) => {
      const btn = [...document.querySelectorAll('footer button')].find(b => (b.textContent || '').toLowerCase().includes(label.toLowerCase()));
      if (!btn) return false;
      btn.click();
      return true;
    }, label);
    if (!clicked) { bad('D-' + id, `footer ${label} link not found`); continue; }
    await sleep(700);
    const shown = await visible(page, `[data-testid="policy-${id}"]`);
    const h1 = shown ? await text(page, `[data-testid="policy-${id}"] h1`) : '';
    const sections = shown ? await page.$$eval(`[data-testid="policy-${id}"] article section`, els => els.length) : 0;
    if (shown && h1 && sections >= 5) ok('D-' + id, `${id} page opened: "${h1}" with ${sections} sections`);
    else bad('D-' + id, `${id} page incomplete (shown=${shown}, h1="${h1}", sections=${sections})`);
    await page.click('[data-testid="policy-back"]');
    await sleep(500);
  }

  // ---- E. Explore links on the answer surface reach the correct screen
  // Re-ask once (the previous conversation was replaced by "back to topics").
  await sleep(11000);
  await page.type('[data-testid="home-search-input"]', 'Mera cheque bounce hua hai, Section 489-F kya kehta hai?');
  await page.click('[data-testid="home-search-submit"]');
  const third = await waitForAnswer(page, 'cheque');
  if (third.a.length > 60) ok('E0', 'Roman Urdu question produced a result page');
  else bad('E0', 'Roman Urdu question produced no answer');
  const roman = /cheque|bounce|489|jawab|qanoon|section/i.test(third.a);
  if (roman) ok('E1', 'answer text is readable and relevant for the Roman Urdu question');
  else bad('E1', `answer not readable/relevant: "${third.a.slice(0, 160)}"`);
  await page.click('[data-testid="result-explore-learning"]');
  await sleep(1200);
  const libraryVisible = await page.evaluate(() => {
    const main = document.querySelector('main');
    return !!main && /Legal Library|law library|library/i.test(main.innerText || '');
  });
  if (libraryVisible) ok('E2', 'explore link opened the Legal Library screen');
  else bad('E2', 'explore link did not open the Legal Library screen');

  // ---- F. Mobile layout has no horizontal overflow on results/policies
  await page.setViewport({ width: 390, height: 844 });
  await sleep(800);
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  if (overflow.scroll <= overflow.inner + 2) ok('F1', `mobile width clean (${overflow.scroll} <= ${overflow.inner})`);
  else bad('F1', `mobile horizontal overflow (${overflow.scroll} > ${overflow.inner})`);

  const fatal = consoleErrors.filter(e => !/Firestore|QUIC|ERR_|Failed to fetch|net::/i.test(e));
  info('console', `${consoleErrors.length} errors captured, ${fatal.length} non-network`);
  if (fatal.length) bad('G1', `unexpected console errors: ${fatal.slice(0, 2).join(' | ').slice(0, 300)}`);
  else ok('G1', 'no unexpected console errors');

  await browser.close();
  console.log(`\nRESULT ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
