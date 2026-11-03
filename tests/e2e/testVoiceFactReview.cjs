// tests/e2e/testVoiceFactReview.cjs — the Voice Agent editable fact review and the
// nine-part case brief, driven in REAL Chrome against the shipped bundle.
//
// Why this file exists: the reducer and the brief builder are covered in-process by
// tests/unit/testVoiceAgentState.cjs, but that proves nothing about the screen a
// citizen uses — whether the fields exist, whether typing into one actually changes
// the rendered record, and whether the brief appears. This suite reads the DOM.
//
// Usage: npm run build && node server/index.js (port 3001) && node tests/e2e/testVoiceFactReview.cjs
const puppeteer = require('puppeteer');

const BASE = process.env.APP_URL || 'http://localhost:3001';
const QUESTION = 'My landlord in Karachi is keeping my security deposit of 100000 rupees even though the tenancy ended in March. What do I do?';
const CORRECTION = 'The deposit was PKR 100,000 paid by bank transfer on 4 March, not in cash';

let pass = 0, fail = 0, skipped = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
  return !!cond;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const textOf = sel => page.$eval(sel, el => el.textContent || '').catch(() => '');
const visibleText = () => page.evaluate(() => document.body.textContent || '');
async function waitForSelector(sel, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await page.$(sel)) return true;
    await sleep(400);
  }
  return false;
}
/** A control the user can actually operate: present AND not disabled. */
async function waitForEnabled(sel, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const usable = await page.$eval(sel, el => !el.disabled).catch(() => false);
    if (usable) return true;
    await sleep(400);
  }
  return false;
}
let page;

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    page = await browser.newPage();
    page.setDefaultTimeout(90000);
    await page.setViewport({ width: 1366, height: 1100 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => { localStorage.removeItem('insaaf_lang'); localStorage.removeItem('insaaf_doc_lang'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2500);

    console.log('\n[A] Opening the Voice Agent and asking one question by keyboard');
    const navSel = '[aria-label="Voice Agent"]';
    ok((await page.$(navSel)) !== null, 'the Voice Agent tab is reachable', navSel);
    await page.click(navSel);
    await sleep(1500);
    if (await page.$('[data-testid="voice-consent-accept"]')) {
      await page.click('[data-testid="voice-consent-accept"]');
      await sleep(600);
    }
    ok(await waitForSelector('[data-testid="voice-text-input"]', 15000), 'the keyboard fallback is present (no microphone needed)');
    await page.type('[data-testid="voice-text-input"]', QUESTION, { delay: 4 });
    await page.click('[data-testid="voice-text-send"]');
    ok(await waitForSelector('[data-testid="voice-intake-toggle"]', 20000), 'the intake entry point is rendered');
    const intakeReady = await waitForEnabled('[data-testid="voice-intake-toggle"]', 60000);
    ok(intakeReady, 'an intake was returned, so the review entry point can actually be clicked');
    if (!intakeReady) {
      console.log('\n==== voice fact review browser suite: ' + pass + ' PASS / ' + (fail + 1) + ' FAIL — stopped: no intake returned ====');
      process.exitCode = 1;
      return;
    }

    console.log('\n[B] The fact-review stage is on screen and editable');
    await page.click('[data-testid="voice-intake-toggle"]');
    ok(await waitForSelector('[data-testid="voice-review-panel"]', 10000), 'the review panel opens inside the intake summary');
    const slots = ['issue', 'location', 'jurisdiction', 'institution', 'requestedOutcome', 'facts', 'timeline', 'deadlines', 'documents'];
    const present = {};
    for (const s of slots) present[s] = !!(await page.$(`[data-testid="voice-review-${s}"]`));
    ok(slots.every(s => present[s]), 'all nine correctable slots have a field', JSON.stringify(present));
    const preSummary = await textOf('[data-testid="voice-intake-summary"]');
    ok(/security deposit/i.test(preSummary), 'the record shown for review contains what was heard', preSummary.slice(0, 200));

    // Correct a fact the assistant derived, in the field the client would use.
    const setReactValue = (sel, value) => page.evaluate((s, v) => {
      const el = document.querySelector(s);
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, sel, value);
    await setReactValue('[data-testid="voice-review-facts"]', CORRECTION);
    await sleep(700);
    const afterFacts = await page.$eval('[data-testid="voice-review-facts"]', el => el.value);
    ok(afterFacts.includes('bank transfer'), 'the typed correction is held by the field', afterFacts.slice(0, 160));
    const postSummary = await textOf('[data-testid="voice-intake-summary"]');
    ok(postSummary.includes('bank transfer'), 'the correction reaches the rendered client record, not just the input', postSummary.slice(0, 260));
    ok(!/paid in cash/i.test(postSummary), 'the derived wording the client rejected is gone from the record', postSummary.slice(0, 260));

    await setReactValue('[data-testid="voice-review-institution"]', 'ABC Co-operative Housing Society, Karachi');
    await sleep(700);
    const withInstitution = await textOf('[data-testid="voice-intake-summary"]');
    ok(/ABC Co-operative Housing Society/.test(withInstitution),
      'a corrected institution appears in the record', withInstitution.slice(0, 300));

    console.log('\n[C] The nine-part case brief renders, with provenance kept apart');
    await page.click('[data-testid="voice-toggle-brief"]');
    ok(await waitForSelector('[data-testid="voice-case-brief"]', 10000), 'the brief renders');
    const brief = await textOf('[data-testid="voice-case-brief"]');
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      ok(new RegExp(`${n}\\.`).test(brief), `part ${n} of the brief is present`);
    }
    ok(/Facts of the case \[confirmed by the client\]/.test(brief),
      'the slot the client edited is marked confirmed', (brief.match(/^4\..*$/m) || [''])[0]);
    ok(/Timeline \[as heard/.test(brief),
      'a slot nobody confirmed is still marked as only heard', (brief.match(/^5\..*$/m) || [''])[0]);
    ok(/bank transfer/.test(brief), 'the brief carries the client correction');
    ok(/not legal advice/i.test(brief), 'the brief states it is not legal advice');

    console.log('\n[D] Nothing is invented on the handoff surface');
    const bodyText = await visibleText();
    ok(/verified/i.test(bodyText), 'the screen keeps saying the records are verified');
    const visibleLinks = kind => page.$$eval(kind, as => as
      .filter(a => a.offsetParent !== null)
      .map(a => a.getAttribute('href')));
    const telHrefs = await visibleLinks('a[href^="tel:"]');
    const mailHrefs = await visibleLinks('a[href^="mailto:"]');
    // A two-digit national helpline ("15" police, "1122" rescue) is a real number;
    // an empty, all-zero or xxx placeholder is not.
    const realDial = h => /^tel:\+?\d[\d\s-]{1,19}$/.test(h) && !/^tel:0+$/.test(h);
    ok(telHrefs.every(realDial), 'every shown phone link holds a dialable number, never a placeholder',
      `visible tel links=${telHrefs.length} ${JSON.stringify(telHrefs)}`);
    ok(mailHrefs.every(h => /^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(h)), 'every shown email link holds a real address',
      `visible mailto links=${mailHrefs.length} ${JSON.stringify(mailHrefs)}`);
    const cardRows = await page.$$eval('[data-testid="voice-cards"] .bg-gray-50', els => els.length).catch(() => 0);
    const provenanceNodes = await page.$$eval('[data-testid^="voice-card-verification-"], [data-testid^="voice-card-no-verification-"]',
      els => els.map(e => e.getAttribute('data-testid')));
    if (cardRows > 0) {
      ok(provenanceNodes.length === cardRows,
        `every one of the ${cardRows} directory cards states its verification provenance`, JSON.stringify(provenanceNodes));
    } else {
      skipped++;
      console.log(`  SKIP  directory cards did not render for this question, so card provenance was not exercised`);
    }

    console.log('\n[E] Copying the brief is honest about failure');
    await page.click('[data-testid="voice-copy-brief"]').catch(() => { });
    await sleep(900);
    const afterCopy = await visibleText();
    ok(/Brief copied|Copy failed/i.test(afterCopy),
      'the copy action reports what actually happened', afterCopy.match(/Brief copied|Copy failed[^.]*/i)?.[0] || '');

    console.log(`\n==== voice fact review browser suite: ${pass} PASS / ${fail} FAIL / ${skipped} SKIP ====`);
    if (fail) console.log('FAILING: ' + failures.join(' | '));
    process.exitCode = fail ? 1 : 0;
  } catch (err) {
    console.error('SUITE CRASHED:', err);
    process.exitCode = 2;
  } finally {
    if (browser) await browser.close();
  }
})();
