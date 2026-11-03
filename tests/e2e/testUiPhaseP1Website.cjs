/**
 * P1: the website stays visible before and after every answer.
 * Verifies the search-first shell in both modes, the answer section, topic and
 * service discovery, the optional conversation view, and four viewports.
 * Exercises the real chat API through the UI (no mocked answers).
 * Run: APP_URL=http://127.0.0.1:3005 node tests/e2e/testUiPhaseP1Website.cjs
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
const countVisible = (page, sel) => page.$$eval(sel, els => els.filter(e => e.isConnected && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).length).catch(() => 0);
const mainText = page => page.evaluate(() => {
  const main = document.querySelector('main');
  return main ? (main.innerText || '') : '';
});

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

async function clearAndType(page, sel, value) {
  await page.click(sel);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.type(sel, value);
}

// Arrival markers for every explore destination on the answer page, verified
// against each screen's real rendered content.
const DESTINATIONS = [
  { tab: 'learning', label: 'Legal Library', marker: '[data-testid^="library-"]' },
  { tab: 'gov', label: 'Government Services', text: /Government Services|Sarkari Khidmat/i },
  { tab: 'docintel', label: 'Document Assistant', text: /DOCUMENT INTELLIGENCE|Document Assistant|Dastaveez/i },
  { tab: 'draft', label: 'Document Drafter', text: /Draft|Dastaveez|Darkhwast|Document Drafter/i },
  { tab: 'voice', label: 'Voice Agent', marker: '[data-testid="voice-controls"]' },
  { tab: 'legalaid', label: 'Legal Aid & Lawyers', text: /Legal Aid|Wakeel|Lawyer/i },
  { tab: 'civic', label: 'Civic Issues', text: /Civic Issues|Civic Masail/i },
  { tab: 'community', label: 'Community', marker: '[data-testid="community-section"]' },
  { tab: 'islamic', label: 'Islamic Guidance', marker: '[data-testid="home-search-input"]' }
];

(async () => {
  const executablePath = CHROME_PATHS.find(p => { try { return require('fs').existsSync(p); } catch { return false; } });
  if (!executablePath) { console.error('Chrome not found'); process.exit(2); }
  const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(800);

  // ---- A. The initial homepage is a website, not an empty conversation panel
  const scroll0 = await page.evaluate(() => window.scrollY);
  if (scroll0 === 0) ok('A1', 'initial load does not scroll the page');
  else bad('A1', `initial load scrolled to ${scroll0}`);

  const heroVisible = await visible(page, '#home-hero-title');
  const searchVisible = await visible(page, '[data-testid="home-search-input"]');
  const topicsVisible = await visible(page, '#home-topics-title');
  if (heroVisible && searchVisible && topicsVisible) ok('A2', 'hero, search field and Browse by Topic are all on the initial page');
  else bad('A2', `initial page incomplete (hero=${heroVisible}, search=${searchVisible}, topics=${topicsVisible})`);

  if (!(await page.$('[data-testid="answer-result"]'))) ok('A3', 'no answer section before a question is asked');
  else bad('A3', 'an answer section is present on the initial page');

  const emptyPanel = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('main div').forEach(n => {
      // The floating agent panel is chrome: it is mounted closed (invisible) by design.
      if (n.closest('[role="dialog"]')) return;
      if (!n.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return;
      const r = n.getBoundingClientRect();
      if (r.height > 420 && r.top < window.innerHeight && (n.innerText || '').trim().length < 40) {
        bad.push({ h: Math.round(r.height), cls: (n.className || '').toString().slice(0, 60) });
      }
    });
    return bad;
  });
  if (emptyPanel.length === 0) ok('A4', 'no large empty visible panel on the homepage');
  else bad('A4', `large empty visible panel(s): ${JSON.stringify(emptyPanel).slice(0, 200)}`);

  // Fingerprint of the fixed-height conversation panel the old flow switched into.
  const legacyPanel = await page.evaluate(() => [...document.querySelectorAll('main div')]
    .filter(e => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      && e.classList.contains('max-h-[calc(100vh-7rem)]')).length);
  if (legacyPanel === 0) ok('A6', 'the fixed-height conversation panel is not on the homepage');
  else bad('A6', `${legacyPanel} fixed-height conversation panel(s) on the homepage`);

  const topicCards = await countVisible(page, '[data-testid^="home-topic-"]');
  if (topicCards >= 9) ok('A5', `${topicCards} topic/service cards visible on the homepage`);
  else bad('A5', `only ${topicCards} topic cards visible`);

  // ---- B. Submitting keeps the full website layout and shows the answer below
  await page.type('[data-testid="home-search-input"]', 'What is Section 489-F PPC about?');
  await page.click('[data-testid="home-search-submit"]');
  const first = await waitForAnswer(page, '489-F');
  if (first.a.length > 60) ok('B1', `answer rendered inside the page (${first.a.length} chars)`);
  else bad('B1', `no answer rendered (${first.a.length} chars)`);

  const navVisible = await visible(page, '[data-testid="nav-all-services"]');
  if (navVisible) ok('B2', 'the shared header navigation is still visible after submitting');
  else bad('B2', 'header navigation disappeared after submitting');

  const formBox = await page.$eval('[data-testid="result-search-form"]', el => { const r = el.getBoundingClientRect(); return { top: r.top, width: r.width }; }).catch(() => null);
  const answerBox = await page.$eval('[data-testid="result-answer"]', el => { const r = el.getBoundingClientRect(); return { top: r.top }; }).catch(() => null);
  if (formBox && answerBox && formBox.top < answerBox.top && formBox.width > 200) {
    ok('B3', `the search field stays above the answer section (form ${Math.round(formBox.top)}px < answer ${Math.round(answerBox.top)}px)`);
  } else bad('B3', `search field/answer order wrong (${JSON.stringify(formBox)} / ${JSON.stringify(answerBox)})`);

  const bubbles = await countVisible(page, '[data-testid="chat-website-view"]');
  if (bubbles === 0) ok('B4', 'the page did not switch into the conversation panel');
  else bad('B4', 'the conversation panel replaced the answer page');
  if (!(await visible(page, '[data-testid="chat-transcript"]'))) ok('B5', 'no stacked chat transcript is shown by default');
  else bad('B5', 'a stacked chat transcript is visible by default');

  const exploreAfterAnswer = await countVisible(page, '[data-testid^="result-explore-"]');
  if (exploreAfterAnswer >= 10) ok('B6', `${exploreAfterAnswer} services/topics remain reachable below the answer`);
  else bad('B6', `only ${exploreAfterAnswer} destinations after answering`);

  const actions = {
    askAnother: await visible(page, '[data-testid="result-ask-another"]'),
    newSearch: await visible(page, '[data-testid="result-new-search"]'),
    topics: await visible(page, '[data-testid="result-back-topics"]'),
    copy: await page.evaluate(() => [...document.querySelectorAll('main button')].some(b => /copy|copied/i.test(b.innerText || '')))
  };
  if (actions.askAnother && actions.newSearch && actions.topics && actions.copy) ok('B7', 'Ask another question, New search, Browse topics and Copy are all present');
  else bad('B7', `missing actions: ${JSON.stringify(actions)}`);

  // ---- C. The conversation view is preserved but is never the default
  await page.click('[data-testid="result-conversation-view"]');
  await sleep(700);
  const transcriptShown = await visible(page, '[data-testid="chat-website-view"]');
  if (transcriptShown) ok('C1', 'conversation view opens the existing chat interface');
  else bad('C1', 'conversation view did not open the chat interface');
  await page.click('[data-testid="chat-website-view"]');
  await sleep(700);
  if (await visible(page, '[data-testid="answer-result"]')) ok('C2', 'returning from the conversation view restores the answer page');
  else bad('C2', 'could not return from the conversation view to the answer page');

  // ---- D. A second question replaces the answer without stale or oversized state
  await sleep(11000);
  await clearAndType(page, '[data-testid="result-search-input"]', 'Sindh mein scholarship ke liye apply kaise karun?');
  await page.keyboard.press('Enter');
  const second = await waitForAnswer(page, 'scholarship');
  if (second.q.includes('scholarship') && !second.q.includes('489-F')) ok('D1', 'the second question replaced the first question heading');
  else bad('D1', `question heading stale: "${second.q.slice(0, 100)}"`);
  if (second.a.length > 60 && !second.a.includes('489-F')) ok('D2', `second answer is clean (${second.a.length} chars, no stale text)`);
  else bad('D2', `stale or empty second answer (${second.a.length} chars)`);

  // ---- E. Every explore destination opens its existing feature
  for (const d of DESTINATIONS) {
    await page.click(`[data-testid="result-explore-${d.tab}"]`).catch(() => {});
    await sleep(1100);
    const leftAnswer = !(await visible(page, '[data-testid="answer-result"]'));
    const arrived = d.marker ? await visible(page, d.marker) : d.text.test(await mainText(page));
    if (leftAnswer && arrived) ok(`E-${d.tab}`, `explore card opened ${d.label}`);
    else bad(`E-${d.tab}`, `${d.label} not reached (leftAnswerPage=${leftAnswer}, arrived=${arrived})`);
    // Return to the answer page through the shared navigation.
    await page.evaluate(() => {
      const more = document.querySelector('[data-testid="nav-all-services"]');
      if (more) more.click();
    });
    await sleep(400);
    await page.click('[data-testid="nav-menu-chat"]').catch(() => {});
    await sleep(900);
  }
  if (await visible(page, '[data-testid="answer-result"]')) ok('E-return', 'the answer page survives navigation and is restored on return');
  else bad('E-return', 'the answer page was lost after navigating away');

  // ---- F. Islamic Guidance is the same search-first page, not a second application
  await page.evaluate(() => {
    const more = document.querySelector('[data-testid="nav-all-services"]');
    if (more) more.click();
  });
  await sleep(400);
  await page.click('[data-testid="nav-menu-islamic"]');
  await sleep(1200);

  const islamicSearch = await countVisible(page, '[data-testid="home-search-input"]');
  if (islamicSearch === 1) ok('F1', 'Islamic Guidance shows exactly one search field (no duplicated chat interface)');
  else bad('F1', `${islamicSearch} search fields in the DOM on the Islamic tab`);
  const domAudit = await page.evaluate(() => ({
    heroes: document.querySelectorAll('#home-hero-title').length,
    cards: document.querySelectorAll('[data-testid^="home-topic-"]').length,
    visibleCards: [...document.querySelectorAll('[data-testid^="home-topic-"]')].filter(e => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).length
  }));
  if (domAudit.heroes === 1 && domAudit.cards === domAudit.visibleCards && domAudit.cards >= 9) {
    ok('F2', `${domAudit.cards} topic cards, none duplicated in a hidden mode (single hero)`);
  } else bad('F2', `duplicate or missing topic DOM: ${JSON.stringify(domAudit)}`);
  const paths = {
    islamic: await visible(page, '[data-testid="home-evidence-path-islamic"]'),
    law: await visible(page, '[data-testid="home-evidence-path-law"]'),
    combined: await visible(page, '[data-testid="home-evidence-path-combined"]')
  };
  if (paths.islamic && paths.law && paths.combined) ok('F3', 'the three evidence paths are selectable on the same page');
  else bad('F3', `evidence path selector incomplete: ${JSON.stringify(paths)}`);
  const islamicPanel = await countVisible(page, '[data-testid="chat-website-view"]');
  if (islamicPanel === 0) ok('F4', 'Islamic Guidance does not open a conversation panel');
  else bad('F4', 'Islamic Guidance opened a conversation panel');

  await page.type('[data-testid="home-search-input"]', 'Islam mein aurat ke huqooq kya hain?');
  await page.click('[data-testid="home-search-submit"]');
  const islamicAnswer = await waitForAnswer(page, 'aurat');
  if (islamicAnswer.a.length > 60) ok('F5', `Islamic question answered on the same page (${islamicAnswer.a.length} chars)`);
  else bad('F5', `Islamic question got no answer (${islamicAnswer.a.length} chars)`);
  const resultPaths = await countVisible(page, '[role="group"] [aria-pressed]');
  if (await visible(page, '[data-testid="answer-result"]') && resultPaths >= 3) ok('F6', `the answer page keeps the evidence path selector (${resultPaths} options)`);
  else bad('F6', `answer page lost the evidence path selector (${resultPaths})`);

  // Combined path stays on the same result page and keeps its own section.
  await page.click('[data-testid="home-evidence-path-combined"]').catch(() => {});
  await sleep(300);
  await clearAndType(page, '[data-testid="result-search-input"]', 'Cheque bounce in Islam and Pakistani law');
  await page.keyboard.press('Enter');
  const combinedAns = await waitForAnswer(page, 'Cheque');
  const combinedText = await text(page, '[data-testid="result-answer"]');
  if (combinedAns.a.length > 60 && await visible(page, '[data-testid="answer-result"]')) ok('F7', `combined answer stays on the result page (${combinedAns.a.length} chars)`);
  else bad('F7', `combined answer did not render (${combinedAns.a.length} chars)`);
  info('F7-text', combinedText.slice(0, 160).replace(/\s+/g, ' '));

  // ---- G. Four viewports: no overflow, visible search field, no clipped input
  for (const vp of [{ n: 'desktop', w: 1440, h: 1000 }, { n: 'tablet', w: 768, h: 1024 }, { n: 'mobile390', w: 390, h: 844 }, { n: 'mobile400', w: 400, h: 800 }]) {
    await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: vp.w < 500 });
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(900);
    const m = await page.evaluate(() => {
      const input = document.querySelector('[data-testid="home-search-input"]');
      const r = input ? input.getBoundingClientRect() : null;
      return {
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
        y: window.scrollY,
        inputVisible: !!input && !!input.checkVisibility() && r.width > 80 && r.left >= -1 && r.right <= window.innerWidth + 1,
        heroVisible: !!document.querySelector('#home-hero-title')
      };
    });
    if (m.scroll <= m.inner + 2) ok(`G-${vp.n}-width`, `no horizontal overflow (${m.scroll} <= ${m.inner})`);
    else bad(`G-${vp.n}-width`, `horizontal overflow (${m.scroll} > ${m.inner})`);
    if (m.inputVisible) ok(`G-${vp.n}-input`, 'search field fully inside the viewport');
    else bad(`G-${vp.n}-input`, `search field clipped or hidden: ${JSON.stringify(m)}`);
    if (m.y === 0) ok(`G-${vp.n}-top`, 'page opens at the top');
    else bad(`G-${vp.n}-top`, `page opened scrolled to ${m.y}`);
  }

  const fatal = consoleErrors.filter(e => !/Firestore|QUIC|ERR_|Failed to fetch|net::/i.test(e));
  info('console', `${consoleErrors.length} errors captured, ${fatal.length} non-network`);
  if (fatal.length) bad('H1', `unexpected console errors: ${fatal.slice(0, 2).join(' | ').slice(0, 300)}`);
  else ok('H1', 'no unexpected console errors');

  await browser.close();
  console.log(`\nRESULT ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });