/**
 * F14: Browser retest of the fixed flows against the running app.
 * Covers: f1 (no provider leak), f2 (chat state), f3 (greeting language),
 * f4 (library toggle), f5 (lawyer empty state), f6 (agent city), f7 (auth
 * modal language), f8 (draft empty block), f9 (nav aria-labels).
 * Run: node retestFixedFlows.cjs
 */
const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';
const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  const bodyText = () => page.evaluate(() => document.body.innerText);
  const hasText = async (t) => (await bodyText()).includes(t);

  // ---------- F9: nav aria-labels (all six nav buttons) ----------
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.removeItem('insaaf_lang'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const ariaInfo = await page.evaluate(() =>
    Array.from(document.querySelectorAll('nav button')).map(b => b.getAttribute('aria-label') || null)
  );
  const labeled = ariaInfo.filter(a => a && a.trim().length > 0).length;
  record('f9 nav aria-labels', labeled >= 6, `${labeled}/${ariaInfo.length} nav buttons labeled: ${JSON.stringify(ariaInfo)}`);

  // ---------- F3: EN greeting on fresh session ----------
  record('f3 EN greeting', await hasText('I am Insaaf AI'), '');

  // ---------- F1/F2: chat sends, no provider leak, history persists ----------
  try {
    const ta = await page.waitForSelector('textarea', { timeout: 10000 });
    await ta.type('What is section 154 of the Criminal Procedure Code about?');
    await page.keyboard.press('Enter');
    // wait for a model reply (poll up to 45s — provider chain falls back to RAG)
    let ok = false;
    for (let i = 0; i < 45; i++) {
      await sleep(1000);
      const t = await bodyText();
      if (t.includes('Section 154') || t.includes('VERIFIED')) { ok = true; break; }
    }
    record('f1 chat answers without leak (Section 154)', ok, '');
    const leak = (await bodyText()).match(/temporarily unavailable|Live AI|429|API key not valid|rate limit/i);
    record('f1 no provider-state leak in chat', !leak, leak ? leak[0] : '');

    // F2: switch to Library and back — history must persist
    const clickNav = async (aria) => {
      const clicked = await page.evaluate((a) => {
        const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
        if (btn) { btn.click(); return true; }
        return false;
      }, aria);
      return clicked;
    };
    await clickNav('Legal Library');
    await sleep(800);
    await clickNav('AI Consultant');
    await sleep(1000);
    record('f2 chat history persists after tab switch', await hasText('section 154 of the Criminal Procedure Code'), '');
  } catch (e) {
    record('f1/f2 chat flow', false, e.message);
  }

  // ---------- F7: auth modal localized in Roman Urdu ----------
  try {
    await page.evaluate(() => { localStorage.setItem('insaaf_lang', 'roman_urdu'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const signInClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Sign In');
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!signInClicked) { record('f7 auth modal opens', false, 'Sign In button not found'); }
    else {
      await sleep(800);
      const t = (await bodyText()).toLowerCase();
      record('f7 auth modal Roman Urdu', t.includes('khush aamdeed') && t.includes('password bhool gaye?'), '');
      record('f7 auth modal labels Roman Urdu', t.includes('mehfooz password') && t.includes('email address'), '');
      // close the modal via guest mode button
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Guest Mode'));
        if (btn) btn.click();
      });
      await sleep(500);
    }
  } catch (e) {
    record('f7 auth modal', false, e.message);
  }

  // ---------- F6: agent bare city + lawyer clarification ----------
  try {
    // The Legal Agent is a floating dialog, not a nav tab. Its input shares a
    // placeholder with the home search box, so everything below is scoped to
    // [role="dialog"] — otherwise the harness types into Chat and reports an
    // agent answer that never happened.
    const openAgent = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        /open legal agent|qanooni agent kholein/i.test(b.getAttribute('aria-label') || ''));
      if (!btn) return false;
      btn.click();
      return true;
    });
    record('f6 Legal Agent dialog opens', openAgent, '');
    const AGENT_INPUT = '[role="dialog"]:not([aria-hidden="true"]) input';
    let inputSel = false;
    try {
      await page.waitForSelector(AGENT_INPUT, { timeout: 8000 });
      const box = await page.evaluate(sel => {
        const i = document.querySelector(sel);
        return i ? { w: i.getBoundingClientRect().width } : null;
      }, AGENT_INPUT);
      inputSel = !!box && box.w > 0;
    } catch (e) { inputSel = false; }
    record('f6 agent dialog input is present', inputSel, '');
    if (inputSel) {
      const agentText = () => page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]:not([aria-hidden="true"])');
        return dlg ? dlg.innerText.replace(/\s+/g, ' ') : '';
      });
      // An in-page inp.focus() does not survive the panel's open transition, and
      // this field submits through its Send button; drive both explicitly.
      const sendAgent = async (text) => {
        const before = await agentText();
        const el = await page.$(AGENT_INPUT);
        await el.click();
        await el.type(text, { delay: 12 });
        await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]:not([aria-hidden="true"])');
          const b = Array.from(d.querySelectorAll('button')).find(x => /^(send|bhejen)$/i.test((x.getAttribute('aria-label') || '').trim()));
          if (b && !b.disabled) b.click();
        });
        // The reply arrives after the "thinking" placeholder clears; the directory
        // rows are resolved in the browser, so no network call marks completion.
        let last = before;
        for (let i = 0; i < 25; i++) {
          await sleep(1000);
          last = await agentText();
          if (last.length > before.length + text.length + 40 && !/soch raha hai|thinking/i.test(last)) break;
        }
        return last;
      };
      // Approved contract: a bare city is a directory lookup, answered from the
      // bundled verified records — never from an invented law quote.
      const bareReply = await sendAgent('Islamabad');
      record('f6 bare city returns verified directory rows',
        /Islamabad/.test(bareReply) && /Bar Council|Public Record|verified vakeel|tasdeeq/i.test(bareReply), '');
      record('f6 bare city invents no phone number and claims no law verification',
        !/\+92\s?3\d{2}[\s-]?\d{7}|\b03\d{2}[\s-]?\d{7}\b/.test(bareReply)
        && !/PARTIALLY VERIFIED|VERIFIED ANSWER|SECTION: ?\d|§ ?\d/i.test(bareReply), '');
      // lawyer without city → ask which city before listing anyone
      const lawyerReply = await sendAgent('I need a lawyer');
      record('f6 lawyer request without a city asks for the city',
        /kis shehar mein vakeel chahiye|which city/i.test(lawyerReply), '');
      record('f6 lawyer request invents no contact number',
        !/\+92\s?3\d{2}[\s-]?\d{7}|\b03\d{2}[\s-]?\d{7}\b/.test(lawyerReply), '');
    }
  } catch (e) {
    record('f6 agent', false, e.message);
  }

  // ---------- F8: draft blocks all-empty form ----------
  try {
    const clickNav = async (aria) => {
      const clicked = await page.evaluate((a) => {
        const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
        if (btn) { btn.click(); return true; }
        return false;
      }, aria);
      return clicked;
    };
    await clickNav('Document Creator');
    await sleep(1000);
    // select first category (Legal) — match on textContent (CSS uppercase not applied)
    const catOk = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'legal');
      if (btn) { btn.click(); return true; }
      return false;
    });
    await sleep(800);
    // select first subcategory (FIR Application)
    const subOk = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'fir application');
      if (btn) { btn.click(); return true; }
      return false;
    });
    await sleep(800);
    // click the generate button with the form empty
    const genOk = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'document create karen');
      if (btn) { btn.click(); return true; }
      return false;
    });
    await sleep(1000);
    const t = (await bodyText()).toLowerCase();
    const blocked = t.includes('kam az kam ek field');
    const noResult = !(await page.evaluate(() => !!document.getElementById('printable-doc')));
    record('f8 empty form blocked with message', blocked, `cat=${catOk} sub=${subOk} gen=${genOk}`);
    record('f8 no document generated from empty form', noResult, '');
  } catch (e) {
    record('f8 draft', false, e.message);
  }

  // ---------- F4: library sidebar toggle visible on narrow screens ----------
  try {
    await page.setViewport({ width: 400, height: 800 });
    const clickNav = async (aria) => {
      const clicked = await page.evaluate((a) => {
        const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
        if (btn) { btn.click(); return true; }
        return false;
      }, aria);
      return clicked;
    };
    await clickNav('Qanoon Khana');
    await sleep(1200);
    const toggle = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-expanded') !== null);
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      const cs = getComputedStyle(btn);
      // Scroll position says nothing about whether a control exists for the user;
      // rendered size, display and opacity do.
      return {
        visible: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0,
        expanded: btn.getAttribute('aria-expanded'),
        text: btn.textContent.trim().slice(0, 40)
      };
    });
    record('f4 library toggle visible on narrow screen', !!toggle && toggle.visible, JSON.stringify(toggle));
    const flipped = await page.evaluate(async () => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-expanded') !== null);
      if (!btn) return { ok: false, why: 'no toggle found' };
      const was = btn.getAttribute('aria-expanded');
      btn.click();
      await new Promise(r => setTimeout(r, 500));
      return { ok: btn.getAttribute('aria-expanded') !== was, was, now: btn.getAttribute('aria-expanded') };
    });
    record('f4 library toggle actually collapses the sidebar', flipped.ok === true, JSON.stringify(flipped));
  } catch (e) {
    record('f4 library toggle', false, e.message);
  }

  // ---------- F5: lawyer search honest empty state ----------
  try {
    const clickNav = async (aria) => {
      const clicked = await page.evaluate((a) => {
        const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
        if (btn) { btn.click(); return true; }
        return false;
      }, aria);
      return clicked;
    };
    await clickNav('Legal Aid & Vakeel');
    await sleep(1500);
    const typed = await page.evaluate(() => {
      const inp = Array.from(document.querySelectorAll('input[type="text"]')).find(i => (i.placeholder || '').includes('Vakeel') || (i.placeholder || '').toLowerCase().includes('talaash'));
      if (!inp) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, 'zzzznomatch123');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
    await sleep(800);
    const t = (await bodyText()).toLowerCase();
    record('f5 lawyer search empty state (Roman Urdu)', typed && t.includes('koi verified profile nahi mili'), '');
  } catch (e) {
    record('f5 lawyer search', false, e.message);
  }

  await browser.close();

  const passed = results.filter(r => r.pass).length;
  console.log(`\n=== F14 RETEST SUMMARY: ${passed}/${results.length} checks passed ===`);
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
