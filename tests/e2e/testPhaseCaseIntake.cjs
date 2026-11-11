/*
 * Sprint §4 / §13 — Structured Case Intake verified in a real browser.
 *
 * Runs against the live app (Vite :3000 proxying /api to the backend). Every
 * assertion is on what the rendered DOM shows after a real POST /api/ai/agent,
 * never on the existence of a handler: the intake must survive to the analysis,
 * produce the A–K brief, keep un-answered items honestly "Not stated", and be
 * restored after the panel is closed.
 *
 * Run: node tests/e2e/testPhaseCaseIntake.cjs
 */
const puppeteer = require('d:/insaaf-ai/node_modules/puppeteer');

const BASE = process.env.APP_URL || 'http://127.0.0.1:3000';
const DLG = 'div[role="dialog"][aria-label="INSAaf Legal Agent"]';

const F = {
  matter: 'fee refund after forced withdrawal from hostel',
  facts: 'I was withdrawn on 12 March 2026 and the hostel fee of 85000 rupees was not returned',
  parties: 'Syed Ali Raza versus Government College University Hyderabad',
  dates: 'application filed 12 March 2026',
  place: 'Hyderabad',
  forum: '',            // deliberately left blank -> must read "Not stated"
  institution: 'Government College University Hyderabad',
  documents: 'withdrawal application, fee challan',
  witnesses: '',        // deliberately left blank
  priorSteps: 'written request to the vice chancellor office, no reply',
  deadline: '30 April 2026',
  outcome: 'refund of the hostel fee'
};

const KEYS = ['matter', 'facts', 'parties', 'dates', 'place', 'forum', 'institution',
  'documents', 'witnesses', 'priorSteps', 'urgency', 'deadline', 'outcome'];

let pass = 0, fail = 0, blockedCount = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};
const blocked = (name, detail) => { blockedCount++; console.log(`  BLOCKED  ${name} ${detail}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const byTestid = (page, id) => page.$(`[data-testid="${id}"]`);
async function setValue(page, id, value) {
  const el = await byTestid(page, id);
  if (!el) return false;
  await el.click({ clickCount: 3 });
  await el.type(value);
  return true;
}
async function valueOf(page, id) {
  const el = await byTestid(page, id);
  return el ? el.evaluate(n => n.value) : null;
}
async function clickTestId(page, id) {
  const el = await byTestid(page, id);
  if (!el) return false;
  await el.click();
  return true;
}

/** Open the agent, make sure the intake panel is visible, and return to question 1. */
async function reopenIntake(page) {
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Open Legal Agent"]');
    if (b) b.click();
  });
  await sleep(900);
  if (!(await byTestid(page, 'case-intake-panel'))) {
    await clickTestId(page, 'case-intake-toggle');
    await sleep(700);
  }
  for (let i = 0; i < 12; i++) {
    const moved = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button'))
        .find(x => /^(Back|Wapas)$/i.test((x.innerText || '').trim()));
      if (!b || b.disabled) return false;
      b.click();
      return true;
    });
    if (!moved) break;
    await sleep(200);
  }
  await sleep(200);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1000'],
    defaultViewport: { width: 1400, height: 1000 }
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  const badApiResponses = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e && e.message)));
  page.on('response', r => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      badApiResponses.push(`${r.status()} ${r.url().replace(/^https?:/, '')}`);
    }
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(2500);

  // 1. Open the Legal Agent and the intake panel
  const opened = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Open Legal Agent"]');
    if (!b) return false;
    b.click();
    return true;
  });
  ok('CI1.1 the floating Legal Agent opens', opened);
  await sleep(800);
  const dlg = await page.$(DLG);
  ok('CI1.2 the agent dialog is in the DOM and visible', !!dlg && await dlg.isVisible());

  ok('CI1.3 the Case Intake control exists', !!(await byTestid(page, 'case-intake-toggle')));
  await clickTestId(page, 'case-intake-toggle');
  await sleep(500);
  ok('CI1.4 the structured intake panel renders', !!(await byTestid(page, 'case-intake-panel')));

  const fieldIdsOnPage = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-testid]'))
    .map(n => n.getAttribute('data-testid'))
    .filter(t => /^intake-[A-Za-z]+$/.test(t))
    .map(t => t.replace('intake-', '')));

  // 2. Walk every question, recording that each is presented and skippable
  const seen = new Set();
  let skippableEveryStep = true;
  let urgencyOptionsSeen = 0;
  for (let i = 0; i < 12; i++) {
    (await fieldIdsOnPage()).forEach(k => seen.add(k));
    urgencyOptionsSeen = Math.max(urgencyOptionsSeen,
      await page.evaluate(() => document.querySelectorAll('[data-testid^="intake-urgency-"]').length));
    if (!(await byTestid(page, 'case-intake-skip'))) {
      if (await byTestid(page, 'case-intake-analyse')) break;
      skippableEveryStep = false;
      break;
    }
    await clickTestId(page, 'case-intake-next');
    await sleep(300);
  }
  (await fieldIdsOnPage()).forEach(k => seen.add(k));
  urgencyOptionsSeen = Math.max(urgencyOptionsSeen,
    await page.evaluate(() => document.querySelectorAll('[data-testid^="intake-urgency-"]').length));
  const neverRendered = KEYS.filter(k => k !== 'urgency' && !seen.has(k));
  ok('CI2.1 every intake item is presented as its own question',
    neverRendered.length === 0, `missing: ${neverRendered.join(', ')}`);
  ok('CI2.2 every question can be skipped', skippableEveryStep);
  ok('CI2.3 the urgency choice is offered as three labelled options',
    urgencyOptionsSeen >= 3, `options seen: ${urgencyOptionsSeen}`);

  // 3. Return to the first question and fill the case step by step
  for (let i = 0; i < 12; i++) {
    const atStart = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /^(Back|Wapas)$/i.test((x.innerText || '').trim()));
      if (!b || b.disabled) return true;
      b.click();
      return false;
    });
    if (atStart) break;
    await sleep(200);
  }
  await setValue(page, 'intake-matter', F.matter);
  await setValue(page, 'intake-facts', F.facts);
  ok('CI3.1 step 0 answers are held in the field', (await valueOf(page, 'intake-matter')) === F.matter);
  await clickTestId(page, 'case-intake-next'); await sleep(300);
  await setValue(page, 'intake-parties', F.parties);
  await setValue(page, 'intake-dates', F.dates);
  await clickTestId(page, 'case-intake-next'); await sleep(300);
  await setValue(page, 'intake-place', F.place);
  await setValue(page, 'intake-institution', F.institution);
  await clickTestId(page, 'case-intake-next'); await sleep(300);
  await setValue(page, 'intake-documents', F.documents);
  await clickTestId(page, 'case-intake-next'); await sleep(300);
  await setValue(page, 'intake-priorSteps', F.priorSteps);
  await page.evaluate(() => {
    const b = document.querySelector('[data-testid="intake-urgency-high"]');
    if (b) b.click();
  });
  await setValue(page, 'intake-deadline', F.deadline);
  await clickTestId(page, 'case-intake-next'); await sleep(300);
  await setValue(page, 'intake-outcome', F.outcome);

  // 4. Review everything before anything is analysed
  await clickTestId(page, 'case-intake-next'); await sleep(400);
  const reviewRows = await page.evaluate(() => document.querySelectorAll('[data-testid^="intake-review-"]').length);
  ok('CI4.1 a review step lists every collected item before analysis', reviewRows >= KEYS.length, `rows=${reviewRows}`);
  const reviewText = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="intake-review-"]'))
    .map(n => n.innerText).join('\n'));
  ok('CI4.2 the review shows the facts as typed, name unshortened',
    /Syed Ali Raza/.test(reviewText) && /85000/.test(reviewText));
  ok('CI4.3 an item left blank is shown as Not stated, never filled in',
    /Not stated|Bayan nahi/i.test(reviewText), reviewText.slice(0, 120));
  const edited = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="intake-review-forum"]');
    if (!row) return 'no-row';
    const b = Array.from(row.querySelectorAll('button')).find(x => /Edit|Tarmeem/i.test(x.innerText || ''));
    if (!b) return 'no-edit';
    b.click();
    return 'ok';
  });
  await sleep(400);
  ok('CI4.4 review allows editing a specific answer', edited === 'ok', edited);
  // Edit jumps back to that question's step, so walk forward again to the review step.
  let backToReview = false;
  for (let i = 0; i < 12 && !backToReview; i++) {
    if (await byTestid(page, 'case-intake-analyse')) { backToReview = true; break; }
    if (!(await clickTestId(page, 'case-intake-next'))) break;
    await sleep(300);
    backToReview = !!(await byTestid(page, 'case-intake-analyse'));
  }
  ok('CI4.5 an edited answer returns to the same review before analysis', backToReview);

  // 5. Analyse — the request must carry the intake
  const reqs = [];
  const agentStatuses = [];
  page.on('request', r => { if (r.url().includes('/api/ai/agent')) reqs.push(r); });
  page.on('response', r => { if (r.url().includes('/api/ai/agent')) agentStatuses.push(r.status()); });
  const clicked = await clickTestId(page, 'case-intake-analyse');
  ok('CI5.1 the analyse control is enabled', clicked);
  let postData = '';
  for (let i = 0; i < 60 && !postData; i++) {
    await sleep(500);
    if (reqs.length) { try { postData = await reqs[0].postData(); } catch { /* body unavailable */ } }
  }
  ok('CI5.2 the collected facts are sent as the retrieval message, not a bare label',
    /structured case intake/i.test(postData) && /hostel fee of 85000 rupees/.test(postData));
  ok('CI5.3 the collected facts are also sent as structured context (the null-context defect)',
    /"context"\s*:\s*\{[^}]*"location"/.test(postData) && /"Hyderabad"/.test(postData),
    postData.slice(0, 200));

  // The /api/ai/* limiter is shared across the whole backend process, so a 429 or a
  // transient 5xx is an environment condition: retry the same real click, never a fake render.
  let briefEl = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (let i = 0; i < 40 && !briefEl; i++) { await sleep(1000); briefEl = await byTestid(page, 'case-brief'); }
    if (briefEl) break;
    const last = agentStatuses[agentStatuses.length - 1] || 0;
    if (last === 429 || last >= 500) {
      console.log(`  RETRY attempt ${attempt + 1}: /api/ai/agent answered ${last}, waiting out the window`);
      await sleep(25000);
      await clickTestId(page, 'case-intake-analyse');
      continue;
    }
    break;
  }
  ok('CI5.4 the analysis request reached the backend and returned 200',
    agentStatuses.includes(200), `statuses: ${agentStatuses.join(',')}`);

  // 6. The A–K brief must render
  ok('CI6.1 the case brief renders after the analysis', !!briefEl);
  const briefText = briefEl ? await briefEl.evaluate(n => n.innerText) : '';
  const letters = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'I.', 'J.', 'K.'];
  const missingLetters = letters.filter(l => !briefText.includes(l));
  ok('CI6.2 the brief contains all eleven sections A to K',
    missingLetters.length === 0, `missing ${missingLetters.join(' ')} :: ${briefText.slice(0, 160)}`);
  ok('CI6.3 section headings are the ones §4 names',
    /Case summary/i.test(briefText) && /Jurisdiction/i.test(briefText)
    && /Evidence checklist/i.test(briefText) && /Missing information/i.test(briefText)
    && /Urgency and deadlines/i.test(briefText) && /Human assistance/i.test(briefText));
  ok('CI6.4 the user’s own stated facts appear in the brief',
    /Syed Ali Raza/.test(briefText) && /Hyderabad/.test(briefText));
  ok('CI6.5 the brief carries the disclaimer that it is not personalised legal advice',
    /not personalised professional legal advice/i.test(briefText)
    && /No outcome is predicted or guaranteed/i.test(briefText));
  ok('CI6.6 nothing predicts a result or guarantees an outcome',
    !/you will win|guaranteed to win|sure win/i.test(briefText));
  const dLine = (briefText.split('\n').find((_, i, a) => /D\. Relevant law/i.test(a[Math.max(0, i - 1)] || ''))) || '';
  ok('CI6.7 section D either cites a retrieved record or states plainly that none matched',
    /No provision in the verified collection|hec\.gov|https?:\/\//i.test(briefText), dLine.slice(0, 120));

  // 7. Copy / download must be honest, never a silent fake success
  const copyState = await page.evaluate(async () => {
    const b = document.querySelector('[data-testid="case-brief-copy"]');
    if (!b) return 'missing';
    b.click();
    await new Promise(r => setTimeout(r, 900));
    return (b.innerText || '').trim();
  });
  ok('CI7.1 the copy button reports a real result, not nothing',
    /Copied|Copy ho gaya|Copy failed|Copy nahi/i.test(copyState), copyState);
  ok('CI7.2 the download control exists and is wired', !!(await byTestid(page, 'case-brief-download')));

  // 8. Adaptive: an answered slot must not be asked again
  const chips = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="intake-jump-"]'))
    .map(n => ({ id: n.getAttribute('data-testid'), label: (n.innerText || '').trim() })));
  if (chips.length === 0) {
    ok('CI8.1 answered slots are not re-asked (server reported nothing outstanding)', true, 'no outstanding chips rendered');
  } else {
    const reAsked = chips.filter(c => /city or district|documents you already have|what outcome/i.test(c.label));
    ok('CI8.1 answered slots are not re-asked', reAsked.length === 0, JSON.stringify(chips));
    const jumped = await page.evaluate(() => {
      const c = document.querySelector('[data-testid^="intake-jump-"]');
      const key = c.getAttribute('data-testid').replace('intake-jump-', '');
      c.click();
      return key;
    });
    await sleep(500);
    const atField = !!(await byTestid(page, `intake-${jumped}`)) || (await byTestid(page, `intake-${jumped}-high`)) !== null;
    ok('CI8.2 an outstanding chip jumps straight to that question', atField, `key=${jumped}`);
  }

  // 9. Closing the panel must not discard the case
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Close agent"]');
    if (b) b.click();
  });
  await sleep(700);
  await reopenIntake(page);
  const afterClose = await page.evaluate(() => {
    const n = document.querySelector('[data-testid="intake-matter"]');
    return n ? n.value : null;
  });
  ok('CI9.1 closing and reopening the panel keeps the case', afterClose === F.matter, String(afterClose));

  // 10. Reload: the intake survives a refresh for the same user
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await reopenIntake(page);
  const afterReload = await page.evaluate(() => {
    const n = document.querySelector('[data-testid="intake-matter"]');
    return n ? n.value : null;
  });
  ok('CI10.1 the intake is restored after a page refresh', afterReload === F.matter, String(afterReload));

  // 11. Explicit clear is the only way the case disappears
  const cleared = await clickTestId(page, 'case-intake-clear');
  await sleep(500);
  const afterClear = cleared ? await page.evaluate(() => {
    const n = document.querySelector('[data-testid="intake-matter"]');
    return n ? n.value : 'no-field';
  }) : 'no-button';
  ok('CI11.1 Clear intake is an explicit labelled action and does empty the case',
    afterClear === '' , `value after clear: ${JSON.stringify(afterClear)}`);

  const serverErrors = badApiResponses.filter(t => /^[45]\d\d /.test(t) && !/^429 /.test(t));
  const limited = badApiResponses.filter(t => /^429 /.test(t));
  const realErrors = consoleErrors.filter(t =>
    !/favicon|Failed to load resource|net::ERR_|429/i.test(t)
    && !serverErrors.some(s => t.includes(s.split(' ')[1])));
  ok('CI12.1 no uncaught page errors during the intake workflow',
    realErrors.length === 0 && serverErrors.length === 0,
    [...serverErrors, ...realErrors].slice(0, 4).join(' | '));
  if (limited.length) console.log(`  NOTE  shared /api/ai/* limiter returned 429 ${limited.length} time(s): ${limited.map(t => t.split(' ')[1]).join(', ')}`);

  blocked('CI13.1 a real microphone speaking Urdu into the Voice Agent',
    'no audio input device in headless Chrome — acoustic path NOT VERIFIED');

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed, ${blockedCount} blocked`);
  process.exitCode = fail ? 1 : 0;
}

main().catch(e => { console.error('HARNESS ERROR:', e && e.message); process.exitCode = 2; });
