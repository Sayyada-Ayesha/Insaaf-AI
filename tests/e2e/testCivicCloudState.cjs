/**
 * Civic Issues — browser verification of the cloud filing UI (province field,
 * filing state, My Reports server section).
 * Run: node tests/e2e/testCivicCloudState.cjs   (server on http://localhost:3001)
 *
 * This machine has no Firebase credentials, so every assertion here is about the
 * honest unfiled state. A green run is NOT evidence that a real filing worked.
 */
const puppeteer = require('puppeteer');

const URL = 'http://localhost:3001/';
let pass = 0, fail = 0;
const log = (n, c, d) => { c ? (pass++, console.log(`PASS  ${n}`)) : (fail++, console.log(`FAIL  ${n}${d ? ` — ${d}` : ''}`)); };

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.setViewport({ width: 1440, height: 950 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

  const bodyText = () => page.evaluate(() => document.body.innerText);
  const clickAria = (label) => page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll('button[aria-label]'))
      .find((b) => b.getAttribute('aria-label') === t && b.offsetParent !== null);
    if (!el) return false; el.click(); return true;
  }, label);
  const clickText = (txt) => page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll('button'))
      .find((b) => (b.textContent || '').trim().includes(t) && b.offsetParent !== null);
    if (!el) return false; el.click(); return true;
  }, txt);
  const typeAt = async (tag, ph, text) => {
    const handle = await page.evaluateHandle((cfg) => Array.from(document.querySelectorAll(cfg.tag))
      .find((e) => (e.placeholder || '').includes(cfg.ph) && e.offsetParent !== null), { tag, ph });
    const el = handle.asElement();
    if (!el) return false;
    await el.click({ clickCount: 3 });
    await el.type(text);
    return true;
  };
  const cloudBlock = () => page.evaluate(() => {
    const el = document.querySelector('[data-testid="civic-cloud-state"]');
    return el && el.offsetParent !== null ? el.innerText : null;
  });

  console.log('\n=== 1. the filing fields render ===');
  log('Civic Issues opens', await clickAria('Civic Issues'));
  await new Promise((r) => setTimeout(r, 700));
  const prov = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('select'))
      .find((e) => e.getAttribute('aria-label') === 'Choose a province or territory' && e.offsetParent !== null);
    return s ? { options: s.options.length, values: Array.from(s.options).map((o) => o.value) } : null;
  });
  log('province selector exists with the 7 listed territories',
    Boolean(prov) && prov.options === 8 && prov.values.includes('Punjab') && prov.values.includes('Gilgit-Baltistan'),
    JSON.stringify(prov));
  log('province starts unselected (no silent default)', Boolean(prov) && prov.values[0] === '');
  const txt0 = await bodyText();
  log('device-only banner still states the unconfigured reality',
    txt0.includes('device-local') && txt0.includes('NOT AVAILABLE IN THIS BUILD'));

  console.log('\n=== 2. filing attempts the server, and says what happened ===');
  await typeAt('textarea', 'own words', 'The streetlight outside house 12 has been out for two weeks and the lane is dark at night.');
  await typeAt('input', 'Street / neighbourhood', 'Lane 4, Test Area');
  await new Promise((r) => setTimeout(r, 300));
  log('complaint drafted', await clickText('Draft the complaint'));
  await new Promise((r) => setTimeout(r, 500));
  log('report recorded', await clickText('Record this report'));
  await new Promise((r) => setTimeout(r, 1800));

  const block = await cloudBlock();
  log('cloud filing state element renders', block !== null, String(block));
  log('state names sign-in as the reason it was not filed',
    Boolean(block) && /signed in|sign in/i.test(block), block || '');
  log('state does not claim a server reference', Boolean(block) && !/Server reference/i.test(block));
  log('state does not claim the report reached anybody',
    Boolean(block) && !/sent to|submitted to|government department ha/i.test(block), block || '');
  const savedTxt = await bodyText();
  log('device tracking reference still issued', /CI-[A-Z0-9]{4}-[A-Z0-9]{4}/.test(savedTxt));

  console.log('\n=== 3. My Reports shows the server section honestly ===');
  log('My Reports opens', await clickText('My Reports'));
  await new Promise((r) => setTimeout(r, 700));
  const mineTxt = await bodyText();
  log('a distinct cloud filing section is present', mineTxt.includes('Cloud filing'));
  const refresh = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button'))
      .find((x) => (x.textContent || '').includes('Refresh my reports from the server'));
    return b ? { disabled: b.disabled } : null;
  });
  log('refresh is disabled while sign-in/server config is missing', Boolean(refresh) && refresh.disabled === true,
    JSON.stringify(refresh));
  log('device copy is labelled device-local, not filed', mineTxt.includes('Device-local') && !mineTxt.includes('Filed with the report service'));
  log('no status editor appeared for a citizen', await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll('select')).filter((s) =>
      Array.from(s.options).some((o) => /IN_PROGRESS|RESOLVED|CLOSED/.test(o.value)));
    return sels.length === 0;
  }));

  console.log('\n=== 4. Roman Urdu renders the same honest state ===');
  await page.evaluate(() => localStorage.setItem('insaaf_lang', 'roman_urdu'));
  await page.reload({ waitUntil: 'networkidle2' });
  const openedRoman = await clickAria('Civic Issues');
  if (!openedRoman) await clickText('Shehri Masail');
  await new Promise((r) => setTimeout(r, 700));
  await typeAt('textarea', 'apne alfazon', 'Lane 4 ki streetlight do hafte se kharab hai aur raat mein andhera rehta hai.');
  await typeAt('input', 'Gali / mohalla', 'Lane 4, Test Area');
  await new Promise((r) => setTimeout(r, 300));
  await clickText('Darkhwast ka maswada banayein');
  await new Promise((r) => setTimeout(r, 500));
  await clickText('Report record karein');
  await new Promise((r) => setTimeout(r, 1800));
  const romanBlock = await cloudBlock();
  log('Roman cloud state renders', romanBlock !== null, String(romanBlock));
  log('Roman state stays in Roman Urdu', Boolean(romanBlock) && !/NOT AVAILABLE IN THIS BUILD/.test(romanBlock));
  log('Roman state mentions sign-in', Boolean(romanBlock) && /sign in/i.test(romanBlock), romanBlock || '');
  log('Roman province selector labelled in Roman Urdu', await page.evaluate(() => Boolean(
    Array.from(document.querySelectorAll('label')).find((l) => (l.textContent || '').includes('Province (suhba)')))));

  log('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('SUITE CRASHED:', e); process.exit(1); });
