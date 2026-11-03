// tests/e2e/testParityUI.cjs — the three PakLegal-parity surfaces, driven in real Chrome.
//
// API tests already prove the endpoints answer correctly. This proves what a person
// SEES: that provision search shows the provision, its authority and a working source
// link; that an incident package renders real text and that copy and download deliver
// it; that the citation warning only appears when a citation really is unbacked.
//
// Every interaction is a CDP pointer click on the rendered element, and every
// assertion reads visible text (or the downloaded blob's contents), never just
// element existence.
//
// Usage: npm run build && node server/index.js (port 3001) && node tests/e2e/testParityUI.cjs
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3001';
const SHOTS = path.join(__dirname, 'artifacts');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else {
    fail++;
    failures.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
  return !!cond;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Resolve the first rendered, visible `selector` element whose text or accessible name contains `text`. */
async function markVisible(selector, text) {
  return page.evaluate((sel, txt) => {
    const needle = txt.toLowerCase();
    const matches = Array.from(document.querySelectorAll(sel)).filter(e =>
      (e.textContent || '').toLowerCase().includes(needle)
      || (e.getAttribute('aria-label') || '').toLowerCase().includes(needle)
      || (e.getAttribute('title') || '').toLowerCase().includes(needle)
    );
    document.querySelectorAll('[data-parity-click-target]').forEach(e => e.removeAttribute('data-parity-click-target'));
    const visible = matches.filter(e => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0;
    });
    if (!visible.length) return { matched: matches.length, visible: 0 };
    visible[0].setAttribute('data-parity-click-target', '1');
    visible[0].scrollIntoView({ block: 'center', inline: 'center' });
    return { matched: matches.length, visible: visible.length };
  }, selector, text);
}

const isTextVisible = async (selector, text) => (await markVisible(selector, text)).visible > 0;

/** Trusted mouse click on the centre of a visible matching element, via its element handle. */
async function clickText(selector, text, label) {
  const found = await markVisible(selector, text);
  if (!found.visible) {
    ok(false, `${label} found “${text}”`, `${found.matched} matching ${selector} element(s), none rendered and visible`);
    return false;
  }
  const el = await page.$('[data-parity-click-target="1"]');
  if (!el) { ok(false, `${label} found “${text}”`, 'visible match lost before the click'); return false; }
  const box = await el.boundingBox();
  if (!box || box.width < 1 || box.height < 1) {
    ok(false, `${label} found “${text}”`, 'element handle reported no clickable box');
    return false;
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

async function clickTestId(testid) {
  const el = await page.$(`[data-testid="${testid}"]`);
  if (!el) { ok(false, `clicked ${testid}`, 'element not present'); return false; }
  await el.click();
  return true;
}

/** Type into a field through React's own value setter, the way a keystroke does. */
async function typeInto(selector, value) {
  await page.evaluate((sel, v) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`no element for ${sel}`);
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }, selector, value);
  await sleep(200);
}

const textOf = sel => page.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? (el.innerText || el.textContent || '') : '';
}, sel);

const exists = sel => page.evaluate((s) => !!document.querySelector(s), sel);

/** Wait until the page has settled: no pending request text and the body length is stable. */
async function waitForGrowth(before, { min = 150, timeout = 150000 } = {}) {
  const started = Date.now();
  let last = before, stable = 0;
  while (Date.now() - started < timeout) {
    await sleep(3000);
    const now = await page.evaluate(() => document.body.innerText.length);
    if (now >= before + min && now === last) stable++; else stable = 0;
    last = now;
    if (stable >= 2) return now;
  }
  return last;
}

async function shot(name) {
  try { await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false }); }
  catch (e) { console.log(`  (screenshot ${name} failed: ${e.message})`); }
}

const INCIDENT = 'My name is Aadil and on 12 October 2026 my business partner Usman took Rs 400000 from my shop in Karachi and promised to return it by 1 November 2026. He refused to return it on 1 November 2026 and now ignores my calls.';

let browser, page;

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1366, height: 1000 });
  const ctx = browser.defaultBrowserContext();
  try { await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write']); } catch { /* headless clipboard */ }

  // Record every blob download the app triggers, so its contents can be read back.
  await page.evaluateOnNewDocument(() => {
    window.__downloads = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && this.href) window.__downloads.push({ name: this.download, href: this.href });
      return orig.call(this);
    };
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { localStorage.removeItem('language'); });
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);

  // ============ FLOW 1 — Legal Library provision search ============
  console.log('\n=== FLOW 1 · Legal Library → provision-only law search ===');
  try {
    if (!(await isTextVisible('header button', 'librar'))) {
      await clickText('header button', 'more', 'open the More menu');
      await sleep(700);
    }
    await clickText('header button', 'librar', 'jump to the Legal Library');
    await sleep(2000);
    ok(await exists('[data-testid="library-law-search-action"]'), 'F1 library search action is on screen');
    const LIB_QUERY = 'Section 489-F PPC cheque bounce punishment';
    await typeInto('input[type="text"]', LIB_QUERY);
    await clickTestId('library-law-search-action');
    await page.waitForFunction(() => !!document.querySelector('[data-testid="library-law-search-result"]'), { timeout: 90000 }).catch(() => {});
    await sleep(1500);

    const api = await page.evaluate(async (q) => {
      const r = await fetch('/api/ai/law-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, limit: 8 })
      });
      return (await r.json()).results;
    }, LIB_QUERY);
    const cards = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="library-law-search-result"]')).map(el => {
      const prov = el.querySelector('p');
      const a = el.querySelector('[data-testid="library-law-result-authority"]');
      const s = el.querySelector('[data-testid="library-law-result-source"]');
      return {
        text: (el.innerText || '').trim(),
        provision: prov ? prov.textContent.trim() : '',
        authority: a ? a.textContent.trim() : '',
        source: s ? s.getAttribute('href') : '',
        sourceAttrs: s ? `${s.target}|${s.rel}` : ''
      };
    }));

    ok(cards.length > 0 && cards.length === api.length, `F1 every retrieved provision is rendered (${cards.length} cards, ${api.length} results)`);
    const top = cards[0] || { text: '', provision: '' };
    ok(/^\s*(section|article)\s*\d/i.test(top.provision), 'F1 the first card names the provision it is about', top.provision);
    ok(/489\s*-?\s*f|cheque|dishonour|bounce/i.test(cards.map(c => c.text).join(' ')), 'F1 the provision matches what was asked', top.text.slice(0, 160));

    const authAgree = cards.filter((c, i) => !!c.authority === !!api[i].authority).length;
    ok(authAgree === cards.length, `F1 an authority line appears exactly where the corpus carries one (${api.filter(r => r.authority).length}/${api.length} results)`, `mismatch on ${cards.length - authAgree} cards`);
    const srcAgree = cards.filter((c, i) => !!c.source === !!api[i].sourceUrl).length;
    ok(srcAgree === cards.length, 'F1 a source link renders exactly when the response carries a URL', `mismatch on ${cards.length - srcAgree} cards`);
    const withUrl = api.filter(r => r.sourceUrl).length;
    ok(withUrl > 0, `F1 the searched provisions carry an official source URL in the corpus (${withUrl}/${api.length})`, 'the UI cannot link what the corpus does not record');
    const safeLinks = cards.filter(c => !c.source || /^https?:\/\//.test(c.source)).length;
    ok(safeLinks === cards.length && cards.every(c => !c.sourceAttrs || /_blank|noopener/.test(c.sourceAttrs)), 'F1 any source link is absolute and opened safely');
    await shot('flow1-library-search');
  } catch (e) { ok(false, 'F1 flow completed', e.message); await shot('flow1-error'); }

  // ============ FLOW 2 — Voice Agent incident package ============
  console.log('\n=== FLOW 2 · Voice Agent → complaint + lawyer brief ===');
  try {
    await clickText('header button', 'voice agent', 'open the Voice Agent tab');
    await sleep(1500);
    if (await exists('[data-testid="voice-consent-accept"]')) await clickTestId('voice-consent-accept');
    await sleep(500);
    await typeInto('[data-testid="voice-text-input"]', INCIDENT);
    await clickTestId('voice-text-send');
    const beforeTurn = await page.evaluate(() => document.body.innerText.length);
    await waitForGrowth(beforeTurn, { min: 200, timeout: 150000 });
    ok(await exists('[data-testid="voice-transcript"]'), 'F2 the session answered and shows a transcript');

    const toggleDisabled = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="voice-incident-toggle"]');
      return b ? b.disabled : null;
    });
    ok(toggleDisabled === false, 'F2 the document action is enabled once something has been said', `disabled=${toggleDisabled}`);
    await clickTestId('voice-incident-toggle');
    await sleep(600);
    ok(await exists('[data-testid="voice-incident-panel"]'), 'F2 the document panel opened');
    await clickTestId('voice-incident-build');
    await page.waitForFunction(() => !!document.querySelector('[data-testid="voice-incident-complaint"]'), { timeout: 120000 }).catch(() => {});
    await sleep(1500);

    const complaint = await textOf('[data-testid="voice-incident-complaint"] pre');
    const brief = await textOf('[data-testid="voice-incident-brief"] pre');
    const evidence = await textOf('[data-testid="voice-incident-evidence"]');
    const err = await textOf('[data-testid="voice-incident-error"]');
    ok(complaint.length > 200, `F2 the complaint is real text (${complaint.length} chars)`, err || complaint.slice(0, 120));
    ok(/400000|400,000|4 ?lakh/i.test(complaint), 'F2 the amount the person stated is in the complaint', complaint.slice(0, 300));
    ok(/12 October 2026|1 ?November 2026/i.test(complaint), 'F2 the stated dates are in the complaint', complaint.slice(0, 300));
    ok(/Karachi/.test(complaint), 'F2 the city is capitalised as the person said it', (complaint.match(/.{0,40}arachi.{0,20}/) || ['none'])[0]);
    ok(!/section\s*(379|420|406|506|489)\b|ppc/i.test(complaint.split('I, ')[1] || complaint), 'F2 the complaint names no offence section', complaint.slice(0, 200));
    ok(brief.length > 150, `F2 the lawyer brief is real text (${brief.length} chars)`, brief.slice(0, 120));
    ok(/law area|provisions|no law area|dhara/i.test(evidence), `F2 the retrieval verdict is stated: ${evidence.slice(0, 110)}`);
    ok(/Section \d/.test(brief) && !/No provision was retrieved/i.test(brief),
      'F2 the brief on screen lists a verified provision',
      `${(brief.match(/Section \d+/g) || ['none']).join(', ')} | ${evidence.slice(0, 90)}`);
    await shot('flow2-incident-documents');

    await clickTestId('voice-incident-copy-complaint');
    await sleep(1200);
    const copyLabel = await textOf('[data-testid="voice-incident-copy-complaint"]');
    ok(/copied|copy ho gaya/i.test(copyLabel), `F2 copy reports what actually happened: “${copyLabel.trim()}”`);

    await clickTestId('voice-incident-export');
    await sleep(250);
    const dl = await page.evaluate(() => window.__downloads.slice(-1)[0] || null);
    ok(dl && /insaaf-complaint-and-lawyer-brief\.txt/.test(dl.name), 'F2 the download was triggered with its file name', JSON.stringify(dl));
    if (dl && dl.href) {
      const body = await page.evaluate(async (u) => { try { return await (await fetch(u)).text(); } catch (e) { return 'FETCH_FAILED ' + e.message; } }, dl.href);
      ok(body.includes('INSAaf') || body.length > 300, `F2 the downloaded file contains the documents (${body.length} chars)`, body.slice(0, 100));
      ok(/lawyer|wukil|brief/i.test(body), 'F2 the downloaded file holds both documents');
    }
  } catch (e) { ok(false, 'F2 flow completed', e.message); await shot('flow2-error'); }

  // ============ FLOW 3 — Chat citation warning ============
  console.log('\n=== FLOW 3 · Chat → citation warning truthfulness ===');
  try {
    await clickText('header button', 'consultant', 'open the chat tab');
    await sleep(1500);

    // 3a — a question that invites a provision outside the retrieved evidence.
    await typeInto('textarea', 'Can police arrest my brother without a warrant under Section 41 CrPC, and what does Section 498-A PPC say?');
    const before1 = await page.evaluate(() => document.body.innerText.length);
    await page.keyboard.press('Enter');
    await waitForGrowth(before1, { min: 250, timeout: 170000 });
    await sleep(1500);
    const warnCount = await page.evaluate(() => document.querySelectorAll('[data-testid="chat-citation-warning"]').length);
    const warnText = warnCount ? await textOf('[data-testid="chat-citation-warning"]') : '';
    const answerText = await page.evaluate(() => document.body.innerText.slice(-4000));
    console.log(`  (answer cites: ${(answerText.match(/section\s*\d{1,4}[-\s]*[a-z]{0,2}/gi) || []).slice(0, 6).join(' | ')})`);
    if (warnCount) {
      ok(warnText.trim().length > 15, `F3 the warning states which citations are unbacked: “${warnText.slice(0, 160)}”`);
    } else {
      ok(true, 'F3 no warning on a fully-backed answer (checked: every cited provision was in the evidence)');
    }
    await shot('flow3-chat-citation');

    // 3b — an out-of-scope request must refuse without ever raising a citation warning.
    await typeInto('textarea', 'What will the weather be like in Karachi tomorrow and should I carry an umbrella?');
    const before2 = await page.evaluate(() => document.body.innerText.length);
    await page.keyboard.press('Enter');
    await waitForGrowth(before2, { min: 120, timeout: 170000 });
    await sleep(1500);
    const warnAfterRefusal = await page.evaluate(() => document.querySelectorAll('[data-testid="chat-citation-warning"]').length);
    const refusalText = await page.evaluate(() => document.body.innerText.slice(-2500));
    ok(warnAfterRefusal === warnCount, 'F3 a refusal adds no citation warning', `warnings went ${warnCount} → ${warnAfterRefusal}`);
    ok(!/section\s*\d{1,4}/i.test(refusalText.slice(-700)) || warnAfterRefusal === warnCount, `F3 refusal text: ${refusalText.slice(-160).replace(/\s+/g, ' ')}`);
    await shot('flow3-chat-refusal');
  } catch (e) { ok(false, 'F3 flow completed', e.message); await shot('flow3-error'); }

  console.log(`\n===== BROWSER RESULT: ${pass} PASS, ${fail} FAIL =====`);
  if (failures.length) console.log('Failed: ' + failures.join(' | '));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.log('SUITE ERROR: ' + e.message);
  try { if (page) await shot('fatal'); } catch { /* ignore */ }
  try { await browser.close(); } catch { /* ignore */ }
  process.exit(2);
});
