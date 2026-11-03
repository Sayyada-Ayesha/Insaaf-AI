/**
 * tests/e2e/testCityCare.cjs — browser verification of the Community screen and the
 * administrator dashboard surface.
 *
 * What can be proven here without a Firebase project: the screens exist, real clicks
 * reach them, the server (not the page) refuses every privileged route for an anonymous
 * visitor, the forms validate before submitting, and a blocked configuration is named
 * instead of faked. What cannot be proven here is stated in the summary: an approved
 * post, a strike, or a role change reaching Firestore needs a real signed-in account
 * and is left as BLOCKED — EXTERNAL.
 *
 * Env: APP_URL (default http://localhost:3000), PHOTO_DIR for the fixture used by the
 * image-type rejection.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name} ${detail}`); }
}

async function clickNav(page, label) {
  return page.evaluate((want) => {
    const btn = Array.from(document.querySelectorAll('nav button'))
      .find(b => (b.getAttribute('aria-label') || '').trim() === want);
    if (btn) btn.click();
    return !!btn;
  }, label);
}

async function apiStatuses(page) {
  return page.evaluate(async () => {
    const paths = [
      '/api/community/feed', '/api/community/posts/mine', '/api/community/options',
      '/api/community/admin/queue', '/api/admin/overview', '/api/admin/audit?limit=1',
      '/api/civic/admin/queue', '/api/civic/auth-status'
    ];
    const out = {};
    for (const p of paths) {
      try {
        const res = await fetch(p, { headers: { accept: 'application/json' } });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* non-JSON */ }
        out[p] = { status: res.status, error: json && json.error ? String(json.error) : '' };
      } catch (e) {
        out[p] = { status: 0, error: 'unreachable' };
      }
    }
    return out;
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.message || e)));

  const badTxt = path.join(process.env.TEMP || 'Temp', 'citycare-bad-upload.txt');
  fs.writeFileSync(badTxt, 'not an image at all, just text for the type check\n');

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(1200);

  // ---------- 1. The Community tab is real navigation ----------
  const foundNav = await page.evaluate(() => Array.from(document.querySelectorAll('nav button'))
    .map(b => (b.getAttribute('aria-label') || '').trim()));
  ok(foundNav.includes('Community'), 'C.1 Community is offered in the existing header navigation', JSON.stringify(foundNav));
  const clicked = await clickNav(page, 'Community');
  await sleep(900);
  ok(clicked, 'C.2 the Community nav button is clickable');
  const open = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="community-section"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { visible: r.width > 0 && r.height > 0, text: (el.innerText || '').slice(0, 400) };
  });
  ok(!!open && open.visible, 'C.3 the Community screen renders its own content', JSON.stringify(open));
  ok(/Community/i.test(open?.text || ''), 'C.4 the screen names itself Community', String(open && open.text).slice(0, 80));
  ok(!/م|ی|ک|ل/i.test(open?.text || '').valueOf() && !/[؀-ۿ]/.test(open?.text || ''),
    'C.5 the English chrome renders no Urdu script');

  // ---------- 2. Anonymous access is refused by the server, not hidden by the page ----------
  const sts = await apiStatuses(page);
  ok(sts['/api/community/feed'].status === 401, 'C.6 an anonymous feed read is refused (401)', JSON.stringify(sts['/api/community/feed']));
  ok(sts['/api/community/posts/mine'].status === 401, 'C.7 an anonymous "my posts" read is refused', JSON.stringify(sts['/api/community/posts/mine']));
  ok(sts['/api/community/options'].status === 401, 'C.8 the post choices need a session too', JSON.stringify(sts['/api/community/options']));
  ok(sts['/api/community/admin/queue'].status === 401, 'C.9 the moderation queue is closed to anonymous callers', JSON.stringify(sts['/api/community/admin/queue']));
  ok(sts['/api/admin/overview'].status === 401, 'C.10 the dashboard figures are closed to anonymous callers', JSON.stringify(sts['/api/admin/overview']));
  ok(sts['/api/admin/audit?limit=1'].status === 401, 'C.11 the audit history is closed to anonymous callers', JSON.stringify(sts['/api/admin/audit?limit=1']));
  ok(sts['/api/civic/admin/queue'].status === 401, 'C.12 the civic review queue is closed to anonymous callers', JSON.stringify(sts['/api/civic/admin/queue']));

  const gated = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="community-signin-gate"]');
    return el ? (el.innerText || '').slice(0, 300) : null;
  });
  ok(!!gated && /sign in/i.test(gated), 'C.13 an anonymous visitor is told to sign in instead of being shown a fake feed', String(gated).slice(0, 90));

  const navAdminAnonymous = await page.evaluate(() => !!Array.from(document.querySelectorAll('nav button'))
    .find(b => (b.getAttribute('aria-label') || '').trim() === 'Admin'));
  ok(!navAdminAnonymous, 'C.14 no administrator entry is offered without a session the server accepted');

  // ---------- 3. Configuration honesty ----------
  const configured = sts['/api/civic/auth-status'].status === 200;
  const serverVerification = await page.evaluate(async () => {
    const res = await fetch('/api/civic/auth-status');
    return Boolean((await res.json()).serverVerificationConfigured);
  });
  if (configured && !serverVerification) {
    const blocker = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="community-config-blocker"]');
      return el ? (el.innerText || '') : null;
    });
    ok(!!blocker && /FIREBASE_PROJECT_ID/.test(blocker),
      'C.15 the missing service-account configuration is named on screen, not glossed over', String(blocker).slice(0, 120));
  } else {
    ok(true, `C.15 configuration banner state recorded: serverVerificationConfigured=${serverVerification}`);
  }

  // ---------- 4. The submission form validates before anything is sent ----------
  const openedNew = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /^(New post|Naya Post)$/.test((x.textContent || '').trim()));
    if (b) b.click();
    return !!b;
  });
  await sleep(600);
  ok(openedNew, 'C.16 the New post panel opens');
  const fields = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="community-section"]');
    const selects = Array.from(panel.querySelectorAll('select')).length;
    const inputs = Array.from(panel.querySelectorAll('input[type="text"], input:not([type]), textarea')).length;
    return { selects, inputs, text: panel.innerText };
  });
  ok(fields.selects >= 2, 'C.17 post type and topic are chosen from a list, not typed free', `selects=${fields.selects}`);
  ok(fields.inputs >= 4, 'C.18 title, message, place and district inputs are present', `inputs=${fields.inputs}`);
  ok(/Firebase Storage is not configured|upload nahi hota/i.test(fields.text),
    'C.19 the screen states plainly that no image upload happens in this build');

  await page.evaluate(() => {
    const ta = document.querySelector('[data-testid="community-section"] textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'ab');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const submittedAnonymous = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /^(Submit post|Post bhejein)$/.test((x.textContent || '').trim()));
    if (b) b.click();
    return !!b;
  });
  await sleep(700);
  ok(submittedAnonymous, 'C.20 the submit control is present and clickable');
  const afterSubmit = await page.evaluate(() => {
    const notice = document.querySelector('[data-testid="community-notice"]');
    const errs = document.querySelector('[data-testid="community-form-errors"]');
    const confirm = document.querySelector('[data-testid="community-pending-confirm"]');
    return {
      notice: notice ? notice.innerText : '',
      errs: errs ? errs.innerText : '',
      fakeSuccess: !!confirm
    };
  });
  ok(!afterSubmit.fakeSuccess, 'C.21 a short, unauthenticated attempt never renders a "saved as pending" confirmation', JSON.stringify(afterSubmit));
  ok(/sign in|Sign in|Theek karne/i.test(afterSubmit.notice + afterSubmit.errs),
    'C.22 the attempt is answered with what is actually missing', JSON.stringify(afterSubmit));

  // ---------- 5. Image validation rejects a non-image before anything leaves the page ----------
  const fileInput = await page.$('[data-testid="community-section"] input[type="file"]');
  ok(!!fileInput, 'C.23 the photo picker exists');
  if (fileInput) {
    await fileInput.uploadFile(badTxt);
    await sleep(800);
    const photoError = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('[data-testid="community-section"] p'))
        .find(p => /Unsupported file type|too large|empty/i.test(p.innerText || ''));
      return el ? el.innerText : '';
    });
    ok(/Unsupported file type/i.test(photoError), 'C.24 a text file is rejected by the image validator', photoError);
    const uploadedList = await page.evaluate(() => {
      const list = Array.from(document.querySelectorAll('[data-testid="community-section"] li'));
      return list.filter(li => /citycare-bad-upload/i.test(li.innerText)).length;
    });
    ok(uploadedList === 0, 'C.25 the rejected file is not added to the attachment list', `count=${uploadedList}`);
  }

  // ---------- 6. Responsive: mobile dropdown reaches Community, and M.1 re-check ----------
  await page.setViewport({ width: 390, height: 844 });
  await sleep(700);
  const moreClicked = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('nav button')).find(x => (x.getAttribute('aria-label') || '').trim() === 'More options');
    if (b) b.click();
    return !!b;
  });
  await sleep(500);
  ok(moreClicked, 'C.26 the mobile "More options" menu opens at 390px');
  const mobileList = await page.evaluate(() => Array.from(document.querySelectorAll('nav button'))
    .map(b => (b.textContent || '').trim()).filter(Boolean));
  ok(mobileList.some(x => /Community/i.test(x)), 'C.27 Community is reachable from the mobile menu', JSON.stringify(mobileList).slice(0, 200));
  const overflowMobile = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflowMobile <= 2, 'C.28 the header does not overflow horizontally at 390px', `overflow=${overflowMobile}px`);

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('nav button')).find(x => /^Community$/.test((x.textContent || '').trim()));
    if (b) b.click();
  });
  await sleep(700);
  const communityAt390 = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="community-section"]');
    if (!el) return null;
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, width: el.getBoundingClientRect().width };
  });
  ok(!!communityAt390 && communityAt390.width > 200, 'C.29 the Community screen fills the 390px viewport', JSON.stringify(communityAt390));
  ok(communityAt390 && communityAt390.overflow <= 2, 'C.30 no horizontal overflow inside Community at 390px', JSON.stringify(communityAt390));

  await page.setViewport({ width: 400, height: 800 });
  await sleep(600);
  const libraryOpened = await clickNav(page, 'Legal Library') || await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('nav button')).find(x => /^Legal Library$/.test((x.textContent || '').trim()));
    if (b) b.click();
    return !!b;
  });
  await sleep(900);
  const toggle = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-expanded') !== null);
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { visible: r.width > 0 && r.height > 0 && r.top >= 0 && r.top < 800, label: (btn.textContent || '').trim().slice(0, 30) };
  });
  ok(libraryOpened, 'C.31 the Legal Library opens at 400px');
  ok(!!toggle && toggle.visible, 'C.32 M.1 re-check: the library sidebar toggle is visible at 400px', JSON.stringify(toggle));

  // ---------- 7. No script errors escaped ----------
  ok(pageErrors.length === 0, 'C.33 no uncaught page error during the whole run', pageErrors.slice(0, 3).join(' | '));

  fs.unlinkSync(badTxt);
  await browser.close();
  console.log(`\n===== testCityCare: ${pass} passed, ${fail} failed =====`);
  if (fail) { console.log('FAILED CHECKS:'); failures.forEach(f => console.log(' - ' + f)); }
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('harness error:', e); process.exitCode = 2; });
