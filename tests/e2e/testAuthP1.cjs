// tests/e2e/testAuthP1.cjs — P1 in the REAL UI: what a person sees when sign-in fails.
//
// The unit suite (tests/unit/testAuthErrors.ts) proves the mapper. This proves the
// screen: an actual sign-in attempt against the actual project must produce a
// sentence a citizen can act on, must never print the SDK's own text, must remember
// a deployment-level refusal across a reload, and must leave guest mode working.
//
// Only sign-IN is attempted (a sign-in attempt creates no account), with a reserved
// .invalid address, so no fake user is created anywhere.
//
// Usage: npm run build && node server/index.js (port 3001) && node tests/e2e/testAuthP1.cjs
const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = process.env.APP_URL || 'http://localhost:3001';
const CHROME_PATHS = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

function launchBrowser() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) {
      try {
        return puppeteer.launch({ headless: true, executablePath: p, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
      } catch { /* try the next one */ }
    }
  }
  return puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}
// Anything from the plumbing rather than the product.
const LEAK = /auth\/[a-z-]+|firebase|ERR_[A-Z_]+|Error \(|identitytoolkit|apiKey|api-key|projectId|operation-not-allowed|configuration-not-found/i;
const PROBE_EMAIL = 'sign-in-probe@example.invalid'; // RFC 2606 reserved: can never be a real mailbox
const PROBE_PASS = 'probe-only-not-a-secret';
const PRODUCT_SENTENCES = [
  'not switched on for this app', 'Network error', 'The email or password is incorrect',
  'Sign-in is busy', 'cannot be used from this web address', 'cannot open from this browser view',
  'not connected to an account service', 'An authentication error occurred', 'No account found',
  'stronger password', 'been switched off', "doesn't look right", 'cancelled', 'allow popups'
];

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
  return !!cond;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// innerText would report "LOG IN" for a Tailwind-uppercase control: read what React wrote.
const readDialog = () => page.evaluate(() => {
  const panel = Array.from(document.querySelectorAll('div'))
    .find(d => d.offsetParent !== null && String(d.className).includes('rounded-[3rem]'));
  return panel ? panel.textContent || '' : '';
});
const readBanner = () => page.evaluate(() => {
  const el = document.querySelector('[data-testid="auth-capability"]');
  return el && el.offsetParent !== null ? el.textContent || '' : '';
});
const bannerVisible = () => page.evaluate(() => {
  const el = document.querySelector('[data-testid="auth-capability"]');
  return !!(el && el.offsetParent !== null);
});

async function clickVisible(textRe) {
  return page.evaluate((re) => {
    const rx = new RegExp(re);
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.offsetParent !== null && rx.test((b.textContent || '').trim()));
    if (!btn) return false;
    btn.click();
    return true;
  }, textRe.source);
}

async function openLoginDialog() {
  const opened = page.evaluate(() => !!Array.from(document.querySelectorAll('button'))
    .find(b => b.offsetParent !== null && b.getAttribute('aria-label') === 'Login / Sign Up'));
  ok(opened, 'the header offers a named sign-in control');
  await page.evaluate(() => Array.from(document.querySelectorAll('button'))
    .find(b => b.getAttribute('aria-label') === 'Login / Sign Up')?.click());
  const start = Date.now();
  while (Date.now() - start < 8000) {
    await sleep(200);
    if (/welcome back/i.test(await readDialog())) return true;
  }
  return false;
}

async function submitSignIn() {
  await page.evaluate(({ email, password }) => {
    const set = (el, value) => {
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const mail = Array.from(document.querySelectorAll('input[type=email]')).find(i => i.offsetParent !== null);
    const passEl = Array.from(document.querySelectorAll('input[type=password]')).find(i => i.offsetParent !== null);
    if (!mail || !passEl) throw new Error('sign-in fields not found');
    set(mail, email);
    set(passEl, password);
  }, { email: PROBE_EMAIL, password: PROBE_PASS });
  await sleep(200);
  const clicked = await clickVisible(/^Log In$|^Sign Up$/i);
  ok(clicked, 'the dialog submit control is clickable');
}

async function waitForOutcome(ms = 30000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    await sleep(400);
    const dialog = await readDialog();
    if (await bannerVisible()) return { kind: 'capability', dialog };
    // the red inline error block carries AlertCircle text inside the dialog
    if (PRODUCT_SENTENCES.some(s => dialog.includes(s))) return { kind: 'inline', dialog };
  }
  return { kind: 'timeout', dialog: await readDialog() };
}

let page;

(async () => {
  const browser = await launchBrowser();
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const pageErrors = [];
  const firestorePaths = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('request', req => {
    const url = req.url();
    if (url.includes('firestore.googleapis.com')) firestorePaths.push(url);
  });

  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1500);

  // ---- 1. the dialog is reachable and starts clean ----
  ok(await openLoginDialog(), 'the sign-in dialog opens');
  ok(!(await bannerVisible()), 'a first visit claims no unavailability it has not seen');

  // ---- 2. a real sign-in attempt ----
  await submitSignIn();
  const outcome = await waitForOutcome();
  console.log(`  INFO  outcome: ${outcome.kind}`);

  ok(outcome.kind !== 'timeout',
    'the attempt ends with something the person can read (not silence)',
    outcome.kind === 'timeout' ? `dialog text: ${outcome.dialog.slice(0, 160)}` : '');

  const dialog = outcome.dialog;
  ok(!LEAK.test(dialog), 'no SDK or plumbing text reaches the dialog',
    (dialog.match(LEAK) || []).join(' | ').slice(0, 120));
  ok(!dialog.includes(PROBE_EMAIL) && !dialog.includes(PROBE_PASS),
    'the typed address and password are not echoed back into the screen');
  ok(PRODUCT_SENTENCES.some(s => dialog.includes(s)),
    'the failure is worded as a product sentence', dialog.slice(-180));

  // ---- 3. capability memory, if the deployment answered "not switched on" ----
  const storedCaps = await page.evaluate(() => sessionStorage.getItem('insaaf_auth_capability'));
  if (outcome.kind === 'capability') {
    const banner = await readBanner();
    ok(banner.includes('Sign-in is not available here yet'), 'the banner names the situation plainly');
    ok(/not switched on for this app/.test(banner), 'the banner says which path is closed and why');
    ok(banner.includes('Everything else still works as a guest'), 'the banner says what the person can still do');
    ok(storedCaps && /"password"/.test(storedCaps), 'the refusal is remembered for this tab', String(storedCaps));
    console.log(`  INFO  the project answered: ${JSON.parse(storedCaps || '{}').password?.code}`);

    ok(await clickVisible(/^Try sign-in again$/i), 'the banner offers a working retry control');
    ok(!(await bannerVisible()), 'retry clears the memory and re-opens the form');

    // reload: the record must survive, and the form must remain usable
    await submitSignIn();
    const again = await waitForOutcome();
    ok(again.kind === 'capability', 'a second attempt repeats the same honest answer');
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1500);
    ok(await openLoginDialog(), 'the dialog opens again after a reload');
    ok(await bannerVisible(), 'the remembered unavailability survives a page reload');
    const capsAfterReload = await page.evaluate(() => sessionStorage.getItem('insaaf_auth_capability'));
    ok(capsAfterReload && JSON.parse(capsAfterReload).password?.code?.startsWith('auth/'),
      'the remembered record holds a code for diagnostics', String(capsAfterReload));
    await clickVisible(/^Try sign-in again$/i);
  } else {
    console.log(`  INFO  the deployment answered ${outcome.kind}; the capability banner path is exercised by section 4 instead`);
    ok(outcome.kind === 'inline', 'a non-capability failure still shows the inline product sentence');
  }

  // ---- 4. the Google branch of the banner renders its own wording ----
  // Not a claim that Google was probed: this writes the remembered record the app
  // would write and checks that the screen tells the truth about that case too.
  await page.evaluate(() => sessionStorage.setItem('insaaf_auth_capability',
    JSON.stringify({ google: { i18nKey: 'errGoogleNotEnabled', code: 'auth/configuration-not-found' } })));
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1500);
  ok(await openLoginDialog(), 'the dialog opens with a remembered Google record');
  const googleBanner = await readBanner();
  ok(googleBanner.includes('Google sign-in is not switched on for this app yet'),
    'the banner names Google as the closed path, not email and password');
  ok(!/email and password/i.test(googleBanner), 'the Google record does not misdescribe itself');
  ok(!LEAK.test(googleBanner), 'the banner leaks no code or SDK text', googleBanner.slice(0, 120));
  await page.evaluate(() => sessionStorage.removeItem('insaaf_auth_capability'));

  // ---- 5. guest mode keeps working, locally ----
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.offsetParent !== null && /Continue in Guest Mode/i.test((b.textContent || '').trim()));
    if (btn) btn.click();
  });
  await sleep(600);
  const dialogClosed = !/welcome back/i.test(await readDialog());
  ok(dialogClosed, 'guest mode closes the dialog instead of stranding the person there');

  await page.evaluate(() => {
    const ta = Array.from(document.querySelectorAll('textarea')).find(t => t.offsetParent !== null);
    if (!ta) throw new Error('no visible chat box');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      .call(ta, 'What can I do if my landlord keeps my security deposit?');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
  });
  await sleep(250);
  await page.keyboard.press('Enter');
  const guestSaved = await (async () => {
    const start = Date.now();
    while (Date.now() - start < 60000) {
      await sleep(700);
      const found = await page.evaluate(() => {
        const chats = JSON.parse(localStorage.getItem('insaaf_chats') || '[]');
        return chats.some(c => (c.messages || []).some(m => m.role === 'model'));
      });
      if (found) return true;
    }
    return false;
  })();
  ok(guestSaved, 'a guest conversation is stored on the device without signing in');

  const userScopedWrites = firestorePaths.filter(u => /documents\/users\b|users%2F/.test(u));
  ok(userScopedWrites.length === 0,
    'guest activity never addresses a user collection in Firestore',
    userScopedWrites.slice(0, 2).join(' | '));

  const pageText = await page.evaluate(() => document.body.textContent || '');
  ok(!LEAK.test(pageText), 'no uncaught SDK text is visible anywhere on the screen',
    (pageText.match(LEAK) || []).join(' | ').slice(0, 120));
  ok(pageErrors.length === 0, 'the sign-in attempt left no uncaught error', pageErrors.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
  if (failures.length) console.log('FAILURES:\n - ' + failures.join('\n - '));
  process.exit(fail ? 1 : 0);
})().catch(async (err) => {
  console.error('HARNESS ERROR:', err);
  if (page) { try { console.error('dialog at failure:', (await readDialog()).slice(0, 300)); } catch { /* gone */ } }
  process.exit(2);
});
