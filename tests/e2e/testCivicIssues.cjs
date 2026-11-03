/**
 * Civic Issues — focused browser verification (tab render, navigation at three
 * widths, real report submission, ownership, evidence upload, regressions).
 * Run: node tests/e2e/testCivicIssues.cjs   (server on http://localhost:3001)
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:3001/';
const FIX = path.join(__dirname, 'fixtures', 'civic');
let pass = 0, fail = 0;
const log = (n, c, d) => { c ? (pass++, console.log(`PASS  ${n}`)) : (fail++, console.log(`FAIL  ${n}${d ? ` — ${d}` : ''}`)); };

(async () => {
  fs.mkdirSync(FIX, { recursive: true });
  // 1x1 real PNG (Chrome decodes it, so compressEvidence takes the success path).
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  fs.writeFileSync(path.join(FIX, 'street.png'), png);
  fs.writeFileSync(path.join(FIX, 'notes.pdf'), Buffer.from('%PDF-1.4 fake\n'));
  fs.writeFileSync(path.join(FIX, 'big.jpg'), Buffer.alloc(6 * 1024 * 1024, 7));

  const browser = await puppeteer.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
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
  const typeAt = async (tag, phIncludes, text) => {
    const handle = await page.evaluateHandle((cfg) => Array.from(document.querySelectorAll(cfg.tag))
      .find((e) => (e.placeholder || '').includes(cfg.ph) && e.offsetParent !== null), { tag, ph: phIncludes });
    const el = handle.asElement();
    if (!el) return false;
    await el.click({ clickCount: 3 });
    await el.type(text);
    return true;
  };
  const selectValue = async (value) => {
    const handle = await page.evaluateHandle((v) => Array.from(document.querySelectorAll('select'))
      .find((s) => s.offsetParent !== null && Array.from(s.options).some((o) => o.value === v)), value);
    const el = handle.asElement();
    if (!el) return false;
    await el.select(value);
    return true;
  };
  const shownValue = () => page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('select')).find((e) => e.offsetParent !== null);
    return s ? s.value : null;
  });

  console.log('\n=== 1. tab renders at desktop 1440 ===');
  log('Civic Issues nav button exists', await clickAria('Civic Issues'));
  await new Promise((r) => setTimeout(r, 600));
  let txt = await bodyText();
  log('Civic Issues heading renders', txt.includes('Civic Issues'));
  log('local-only labelling is visible', txt.includes('device-local') && txt.includes('NOT AVAILABLE IN THIS BUILD'));
  log('no municipal delivery claim', !/has been submitted to|sent to the municipality/i.test(txt));
  log('sub-tabs: Report / My Reports / Civic Assistant',
    txt.includes('Report an Issue') && txt.includes('My Reports') && txt.includes('Civic Assistant'));
  log('no admin entry is displayed', !/Administrative Review|admin review dashboard\s*$/im.test(
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.textContent || '').join('|'))));

  console.log('\n=== 2. category suggestion + citizen override ===');
  const typed = await typeAt('textarea', 'Describe it in your own words',
    'The streetlight outside house 12 has not worked for two weeks and the lane is dark.');
  log('description typed into the form', typed);
  await new Promise((r) => setTimeout(r, 400));
  txt = await bodyText();
  log('suggestion appears', txt.includes('Suggested category'));
  log('method is honestly labelled (not an AI model)',
    txt.includes('keyword matching') && txt.includes('not an AI model'));
  log('streetlight suggested', txt.includes('Streetlight not working'));
  log('manual override offered', txt.includes('your choice is what gets recorded') || txt.includes('you can override'));
  log('override to "other" accepted', await selectValue('other'));
  await new Promise((r) => setTimeout(r, 300));
  log('citizen choice survives further typing', (await shownValue()) === 'other');
  await typeAt('textarea', 'Describe it in your own words', ' Also garbage is piling up.');
  await new Promise((r) => setTimeout(r, 400));
  log('suggestion did not overwrite the citizen choice', (await shownValue()) === 'other');
  await selectValue('streetlight');

  console.log('\n=== 3. required-field detection ===');
  await clickText('Record this report');
  await new Promise((r) => setTimeout(r, 500));
  txt = await bodyText();
  log('missing location is reported as a blocker', txt.includes('Needed before the report can be recorded') && txt.includes('Location'));
  log('nothing was recorded', !txt.includes('Report recorded in this browser'));

  console.log('\n=== 4. manual location + complaint draft from the citizen\'s words ===');
  await typeAt('input', 'Street / neighbourhood / landmark', 'Lane 4, Khayaban-e-Johar, Clifton');
  await typeAt('input', 'e.g. Gulberg, Lahore', 'Karachi');
  await typeAt('input', 'e.g. 2 weeks', 'two weeks');
  await clickText('Draft the complaint');
  await new Promise((r) => setTimeout(r, 700));
  const draftArea = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('textarea'))
      .find((e) => e.value.includes('Civic Issue Complaint') && e.offsetParent !== null);
    return t ? t.value : null;
  });
  log('editable complaint draft appears', Boolean(draftArea));
  const liveDescription = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('textarea'))
      .find((e) => (e.placeholder || '').includes('Describe it in your own words'));
    return t ? t.value : null;
  });
  log('draft preserves the citizen sentence verbatim',
    Boolean(draftArea) && Boolean(liveDescription) && draftArea.includes(liveDescription), JSON.stringify(liveDescription));
  log('draft preserves the location verbatim',
    Boolean(draftArea) && draftArea.includes('Lane 4, Khayaban-e-Johar, Clifton'));
  log('draft refuses to invent a recipient',
    Boolean(draftArea) && /no verified authority record/i.test(draftArea));
  log('draft states nothing was filed',
    Boolean(draftArea) && /has not been submitted to any government department/i.test(draftArea));
  log('draft is editable', await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('textarea')).find((e) => e.value.includes('Civic Issue Complaint'));
    return t ? !t.readOnly && t.disabled === false : false;
  }));

  const civicFileInput = async () => {
    const handle = await page.evaluateHandle(() => Array.from(document.querySelectorAll('input[type=file]'))
      .find((e) => (e.accept || '').includes('image/webp')));
    return handle.asElement();
  };
  console.log('\n=== 5. evidence upload (valid accepted, invalid rejected) ===');
  const fileInput = await civicFileInput();
  log('evidence picker is a real file input with an accept filter', Boolean(fileInput));
  await fileInput.uploadFile(path.join(FIX, 'notes.pdf'));
  await new Promise((r) => setTimeout(r, 600));
  txt = await bodyText();
  log('invalid type rejected with a message', txt.includes('Unsupported file type'));
  const fi2 = await civicFileInput();
  await fi2.uploadFile(path.join(FIX, 'street.png'));
  await new Promise((r) => setTimeout(r, 1200));
  const preview = await page.evaluate(() => {
    const img = Array.from(document.querySelectorAll('img'))
      .find((i) => (i.src || '').startsWith('data:image/jpeg') && i.offsetParent !== null);
    return img ? { src: img.src.length, alt: img.alt } : null;
  });
  log('valid image accepted, preview rendered from a re-encoded JPEG', Boolean(preview), JSON.stringify(preview));
  const fi3 = await civicFileInput();
  await fi3.uploadFile(path.join(FIX, 'big.jpg'));
  await new Promise((r) => setTimeout(r, 700));
  txt = await bodyText();
  log('oversized image rejected in the browser with a message', /too large/i.test(txt));
  const acceptOk = await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input[type=file]')).find((e) => (e.accept || '').includes('image/webp'));
    return inp ? /jpeg|png|webp/.test(inp.accept) : false;
  });
  log('upload is type-constrained in the DOM too', acceptOk);
  log('privacy note about metadata stripping is shown',
    (await bodyText()).includes('camera metadata (including GPS) is removed'));

  console.log('\n=== 6. geolocation button on the real browser path (no permission granted) ===');
  await clickText('Use my location');
  await new Promise((r) => setTimeout(r, 1500));
  txt = await bodyText();
  const geoHonest = txt.includes('did not allow location access') || txt.includes('Coordinates:') || txt.includes('could not be retrieved');
  log('geolocation reports a truthful outcome (no fake success)', geoHonest);

  console.log('\n=== 7. submission + tracking reference + ownership ===');
  await clickText('Record this report');
  await new Promise((r) => setTimeout(r, 1200));
  txt = await bodyText();
  const refMatch = txt.match(/CI-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  log('report recorded, reference shown', Boolean(refMatch), txt.slice(0, 200));
  log('recorded card is labelled as browser-local', txt.includes('Report recorded in this browser'));
  const savedRef = refMatch ? refMatch[0] : '';
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('insaaf_civic_reports_v1');
    const arr = raw ? JSON.parse(raw) : [];
    const tok = localStorage.getItem('insaaf_civic_citizen_token_v1');
    return { n: arr.length, status: arr[0] && arr[0].status, ownerHash: arr[0] && arr[0].ownerHash, tokInStore: JSON.stringify(arr).includes(tok), hasToken: Boolean(tok) };
  });
  log('report really persisted in localStorage', stored.n >= 1, JSON.stringify(stored));
  log('persisted status is SUBMITTED', stored.status === 'SUBMITTED');
  log('raw citizen token is not stored in the report', stored.tokInStore === false && stored.hasToken);
  log('ownership is stored as a hash', /^[0-9a-f]{64}$/.test(String(stored.ownerHash)));

  await clickText('My Reports');
  await new Promise((r) => setTimeout(r, 800));
  txt = await bodyText();
  log('own report listed in My Reports', txt.includes(savedRef));
  log('status explanation shown', txt.includes('Your report has been recorded in this system.'));
  await clickText('View details');
  await new Promise((r) => setTimeout(r, 500));
  txt = await bodyText();
  log('status truthfulness note shown', txt.includes('not proof that a government department'));
  await typeAt('input', 'CI-XXXX-XXXX', 'CI-QQQQ-QQQQ');
  const searchBtn = await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input'))
      .find((e) => (e.placeholder || '').includes('CI-XXXX'));
    const b = inp && inp.parentElement ? inp.parentElement.querySelector('button') : null;
    if (!b) return false; b.click(); return true;
  });
  await new Promise((r) => setTimeout(r, 600));
  log('unknown reference gives an honest miss', searchBtn && (await bodyText()).includes('No report with that reference was found'));
  log('no cross-device promise', (await bodyText()).includes('another device'));

  console.log('\n=== 8. no citizen-facing status change path ===');
  const statusControls = await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll('select')).filter((s) =>
      Array.from(s.options).some((o) => /IN_PROGRESS|RESOLVED|CLOSED/.test(o.value)));
    const btns = Array.from(document.querySelectorAll('button')).filter((b) =>
      /mark .*(resolved|in progress|assigned)|change status|update status/i.test(b.textContent || ''));
    return { sels: sels.length, btns: btns.length };
  });
  log('no status editor in the citizen UI', statusControls.sels === 0 && statusControls.btns === 0, JSON.stringify(statusControls));

  console.log('\n=== 9. Civic Assistant content is honest ===');
  await clickText('Civic Assistant');
  await new Promise((r) => setTimeout(r, 500));
  txt = await bodyText();
  log('assistant explains what is not available', txt.includes('What is not available here') && txt.includes('Cross-device tracking'));
  log('map selection reported as not implemented', txt.includes('Map pin selection is not implemented'));
  log('admin review reported as not present', txt.includes('administrative review dashboard is not present'));
  const assistantOnly = await page.evaluate(() => Array.from(document.querySelectorAll('article'))
    .filter((a) => a.offsetParent !== null).map((a) => a.innerText).join('\n'));
  const invented = assistantOnly.match(/\b(1099|1991|15|KMC|Karachi Municipal|LESCO|SSGC|Sui Southern|DEA|NHA)\b/i);
  log('assistant names no unverified department or helpline', !invented, invented ? `matched "${invented[0]}"` : '');
  log('assistant text really rendered', assistantOnly.includes('How to describe an issue'));

  console.log('\n=== 10. navigation at three widths ===');
  const navVisible = () => page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button[aria-label="Civic Issues"]'))
      .find((b) => b.offsetParent !== null && getComputedStyle(b).display !== 'none');
    return Boolean(el);
  });
  await page.setViewport({ width: 1440, height: 950 });
  await new Promise((r) => setTimeout(r, 400));
  log('1440: top-level button visible', await navVisible());
  await page.setViewport({ width: 820, height: 900 });
  await new Promise((r) => setTimeout(r, 400));
  log('820 (tablet): top-level button visible', await navVisible());
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 500));
  log('390 (mobile): inline button hidden', (await navVisible()) === false);
  const moreOpened = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button[aria-label]'))
      .find((b) => /more/i.test(b.getAttribute('aria-label') || '') && b.offsetParent !== null);
    if (!el) return false; el.click(); return true;
  });
  await new Promise((r) => setTimeout(r, 500));
  const inMoreMenu = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button')).filter((b) =>
      (b.textContent || '').trim().includes('Civic Issues') && b.offsetParent !== null);
    return els.length;
  });
  log('390: More menu opens', moreOpened);
  log('390: Civic Issues reachable from More menu', inMoreMenu >= 1, `matches=${inMoreMenu}`);
  await page.setViewport({ width: 1440, height: 950 });
  await new Promise((r) => setTimeout(r, 400));

  console.log('\n=== 11. regressions: existing features still reachable ===');
  log('Government Services opens', await clickAria('Government Services'));
  await new Promise((r) => setTimeout(r, 700));
  txt = await bodyText();
  log('Government Services renders', txt.includes('Government Services') && !txt.includes('Something went wrong'));
  log('Civic Issues still reachable after switching', await clickAria('Civic Issues'));
  await new Promise((r) => setTimeout(r, 500));
  log('civic view restored', (await bodyText()).includes('My Reports'));
  log('Document Assistant opens', await clickAria('Document Assistant'));
  await new Promise((r) => setTimeout(r, 700));
  txt = await bodyText();
  log('Document Assistant renders', !txt.includes('Something went wrong') && (txt.includes('Document') || txt.includes('Explain')));
  log('Legal Library opens', await clickAria('Legal Library'));
  await new Promise((r) => setTimeout(r, 700));
  log('Legal Library renders', (await bodyText()).includes('Legal Library'));
  log('Draft tab opens', await clickAria('Document Drafter'));
  await new Promise((r) => setTimeout(r, 700));
  txt = await bodyText();
  log('Drafting renders without error boundary', txt.length > 200 && !txt.includes('Something went wrong'));

  console.log('\n=== 12. runtime errors ===');
  log('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n=== 13. Roman Urdu rendering of the same flow ===');
  await page.setViewport({ width: 1440, height: 950 });
  await page.evaluate(() => localStorage.setItem('insaaf_lang', 'roman_urdu'));
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));
  const civicExists = await page.evaluate(() => Boolean(Array.from(document.querySelectorAll('button[aria-label]'))
    .find((b) => b.getAttribute('aria-label') === 'Shehri Masail' && b.offsetParent !== null)));
  log('nav label is localized', civicExists);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button[aria-label]'))
      .find((b) => b.getAttribute('aria-label') === 'Shehri Masail' && b.offsetParent !== null);
    if (el) el.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await typeAt('textarea', 'Masla apne alfazon mein likhein', 'streetlight kharab hai');
  await new Promise((r) => setTimeout(r, 500));
  const rom = await bodyText();
  log('Roman heading + sub-tabs render', rom.includes('Shehri Masail') && rom.includes('Issue darj karein') && rom.includes('Meri Reports'));
  log('Roman local-only disclaimer renders', rom.includes('MOOSAR NAHI') && rom.includes('sarkari idaray ko nahi jaati'));
  log('Roman honest classification note renders', rom.includes('deterministic') || rom.includes('lafzi jaanch'));
  log('no English-only copy leaks into the Roman view', !rom.includes('Report an Issue') && !rom.includes('NOT AVAILABLE IN THIS BUILD'));
  log('citizen token survives the language switch', await page.evaluate(() =>
    Boolean(localStorage.getItem('insaaf_civic_citizen_token_v1'))));
  log('earlier report still visible in Roman mode', await page.evaluate(async () => {
    const el = Array.from(document.querySelectorAll('button'))
      .find((b) => (b.textContent || '').includes('Meri Reports') && b.offsetParent !== null);
    if (el) el.click();
    await new Promise((r) => setTimeout(r, 700));
    return /CI-[A-Z0-9]{4}-[A-Z0-9]{4}/.test(document.body.innerText);
  }));
  await page.evaluate(() => localStorage.setItem('insaaf_lang', 'en'));

  console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
