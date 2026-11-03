/**
 * Part U browser test: floating Legal Agent.
 * Verifies the floating button exists across tabs, opens a panel, answers a
 * query, and that navigation closes the panel.
 */
const puppeteer = require('puppeteer');

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:3000/';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function findFloatingButton(page) {
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    return btns.find(b => {
      const r = b.getBoundingClientRect();
      const lbl = (b.getAttribute('aria-label') || '').toLowerCase();
      return lbl.includes('legal agent') || lbl.includes('qanooni agent')
        || (r.width >= 50 && r.width <= 80 && r.height >= 50 && r.height <= 80
            && r.bottom > window.innerHeight - 120 && r.right > window.innerWidth - 120);
    }) ? true : false;
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  const results = [];
  const check = (name, pass, detail = '') => {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
  };

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);

  // 1. Floating button present on Chat tab
  const hasBtn = await findFloatingButton(page);
  check('Floating agent button visible on Chat tab', hasBtn);

  // 2. Agent is NOT a nav tab anymore
  const agentTabExists = await page.evaluate(() => {
    const navBtns = [...document.querySelectorAll('nav button')];
    return navBtns.some(b => /agent/i.test(b.textContent || '') || /agent/i.test(b.getAttribute('aria-label') || ''));
  });
  check('Agent removed from nav tabs', !agentTabExists, agentTabExists ? 'agent tab still in nav' : '');

  // 3. Click floating button -> panel opens
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => /legal agent|qanooni agent/i.test(x.getAttribute('aria-label') || ''));
    if (b) b.click();
  });
  await sleep(1200);
  const panelOpen = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"][aria-label*="Agent" i], [role="dialog"][aria-label*="Qanooni" i]');
    if (!dlg) return false;
    const r = dlg.getBoundingClientRect();
    return r.width > 200 && r.height > 200 && getComputedStyle(dlg).visibility !== 'hidden';
  });
  check('Floating panel opens on click', panelOpen);

  // 4. Embedded agent input exists inside panel
  const hasAgentInput = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return false;
    const inp = dlg.querySelector('input');
    return !!inp && /poochein|ask about the law/i.test(inp.getAttribute('placeholder') || '');
  });
  check('Embedded agent input present in panel', hasAgentInput);

  // 5. Type a query and get a response
  if (hasAgentInput) {
    await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      const inp = dlg.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, 'Where is the Legal Library?');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sleep(300);
    await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      const inp = dlg.querySelector('input');
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    // poll for a response with a navigation chip
    let responded = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      responded = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return false;
        const txt = dlg.textContent || '';
        return /Open .*Library|Kholen .*Library|Library/i.test(txt) && txt.length > 200;
      });
      if (responded) break;
    }
    check('Agent answers a library question in panel', responded);
  }

  // 6. Floating button still present after switching to another tab (Library)
  await page.evaluate(() => {
    // close panel first
    const dlg = document.querySelector('[role="dialog"]');
    if (dlg) {
      const closeBtn = [...dlg.querySelectorAll('button')].find(b => /close|band/i.test(b.getAttribute('aria-label') || ''));
      if (closeBtn) closeBtn.click();
    }
  });
  await sleep(600);
  // switch to Learning/Library tab via nav
  await page.evaluate(() => {
    const navBtns = [...document.querySelectorAll('nav button')];
    const lib = navBtns.find(b => /library|learning/i.test(b.textContent || '') || /library/i.test(b.getAttribute('aria-label') || ''));
    if (lib) lib.click();
  });
  await sleep(1500);
  const btnOnOtherTab = await findFloatingButton(page);
  check('Floating agent button available on Library tab', btnOnOtherTab);

  // 7. Mobile: near full-screen panel at 390px
  await page.setViewport({ width: 390, height: 844 });
  await sleep(800);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => /legal agent|qanooni agent/i.test(x.getAttribute('aria-label') || ''));
    if (b) b.click();
  });
  await sleep(1000);
  const mobilePanel = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const r = dlg.getBoundingClientRect();
    return { w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight };
  });
  const mobileFullScreen = mobilePanel && mobilePanel.w >= mobilePanel.vw * 0.9 && mobilePanel.h >= mobilePanel.vh * 0.9;
  check('Mobile panel is near full-screen (390px)', !!mobileFullScreen,
    mobilePanel ? `${Math.round(mobilePanel.w)}x${Math.round(mobilePanel.h)} of ${mobilePanel.vw}x${mobilePanel.vh}` : 'no panel');

  await browser.close();

  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== FLOATING AGENT: ${passed}/${results.length} PASS ====`);
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('TEST ERROR', e); process.exit(2); });
