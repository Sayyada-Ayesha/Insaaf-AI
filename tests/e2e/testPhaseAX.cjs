/**
 * Phase AX — Document Intelligence end-to-end in a real browser.
 *
 * Covers the §7 action surface on the built app served by :3001:
 * Explain / Summarize / Analyze Risks / Translate (EN->UR, Roman->Urdu) /
 * Compare / Checklist / Copy / Share / Print / New / Retry.
 *
 * Every assertion is on what the rendered DOM actually shows, never on the
 * existence of a handler.
 */
const puppeteer = require('d:/insaaf-ai/node_modules/puppeteer');
const BASE = process.env.DI_BASE || 'http://127.0.0.1:3001';

const NOTICE_A = `LEGAL NOTICE
To: Mr. Imran Shaikh, Shop No 4, Saddar, Karachi.
From: Ayesha Khan, DHA Phase 5, Karachi.
Date: 1 January 2026.
You sold me a washing machine on 15 December 2025 for Rs 85,000 against Receipt No. AK-771. The machine stopped working within seven days and you refuse to refund the amount or replace the product. I demand a refund of Rs 85,000 within 15 days of this notice, failing which I will file a complaint before the District Consumer Court, Karachi under the Sindh Consumer Protection Act, 2014 and claim costs.`;
const NOTICE_B = NOTICE_A
  .replace('1 January 2026', '20 February 2026')
  .replace('Rs 85,000 within 15 days', 'Rs 60,000 within 30 days')
  .replace('you refuse to refund', 'you have offered a partial refund and I refuse it');
const ROMAN_NOTICE = `Main Karachi ki rehne wali hoon. Mera Makan malik security deposit wapas nahi kar raha. Notice bheja magar koi jawab nahi aaya.`;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};

const textOf = (page) => page.evaluate(() => document.body.innerText || '');
async function clickByText(page, re, scope = 'button') {
  const handle = await page.evaluateHandle((src, flags, sel) => {
    const rx = new RegExp(src, flags);
    // innerText (not textContent) keeps the newline between an <h3> title and a
    // <p> description, so word-boundary regexes match what the user reads.
    return Array.from(document.querySelectorAll(sel)).find(b => {
      const r = b.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return false;
      return rx.test((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || ''));
    }) || null;
  }, re.source, re.flags.includes('i') ? 'i' : '', scope);
  const el = handle.asElement();
  if (!el) return null;
  await el.click();
  return el;
}
async function waitFor(page, fn, ms = 45000, label = '') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await fn(page)) return true; } catch (e) { /* re-render in flight */ }
    await new Promise(r => setTimeout(r, 400));
  }
  console.log(`      (timed out waiting for ${label})`);
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--window-size=1400,1400']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 1400 });
  page.on('pageerror', e => console.log(`      [pageerror] ${e.message}`));

  // Capture every window.open. A real popup inside headless Chrome (wa.me, or a
  // document that calls window.print()) stalls the renderer and every later CDP
  // call times out, and both targets need a desktop session headless has no
  // access to. The assertions below run on the exact URL and printable markup
  // the components generated — only the browser chrome is left to the user.
  await page.evaluateOnNewDocument(() => {
    window.__opens = [];
    window.__printDoc = '';
    window.open = function (u, t, f) {
      const url = String(u || '');
      window.__opens.push({ url, target: String(t || '') });
      let buf = '';
      window.__printDoc = '';
      return {
        document: {
          write: (s) => { buf += String(s); window.__printDoc = buf; },
          writeln: (s) => { buf += String(s) + '\n'; window.__printDoc = buf; },
          close: () => { window.__printDoc = buf; }
        },
        focus: () => {}, blur: () => {}, close: () => {}, print: () => {}
      };
    };
  });

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });

  // -- open Document Intelligence -------------------------------------------
  const opened = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button[aria-label]'))
      .find(x => /^(documents|document assistant)$/i.test((x.getAttribute('aria-label') || '').trim()));
    if (b) { b.click(); return b.getAttribute('aria-label'); }
    return null;
  });
  ok('AX0 Document Intelligence tab is reachable', Boolean(opened), `aria-label=${opened}`);
  await new Promise(r => setTimeout(r, 900));
  let body = await textOf(page);
  ok('AX0b the DI screen renders its entry choices', /paste|upload|compare|checklist/i.test(body), body.slice(0, 90));

  // Chat and the other DI modes keep textareas in the DOM, so document order is
  // not a stable address. The compare panels and the checklist box are addressed
  // by the placeholder the user reads on screen.
  const typeIntoPlaceholder = async (placeholderRe, text) => {
    const boxes = await page.$$('textarea');
    for (const el of boxes) {
      const ph = await page.evaluate(t => String(t.getAttribute('placeholder') || ''), el);
      if (placeholderRe.test(ph)) {
        await el.click();
        await page.evaluate(t => { t.value = ''; }, el);
        await el.type(text, { delay: 0 });
        return ph;
      }
    }
    throw new Error(`no textarea for placeholder ${placeholderRe}`);
  };

  // The run/copy control a test means is the one INSIDE the open panel. Entry
  // cards carry the same words ("Compare two documents to find differences"), and
  // they render before the panel's own controls, so the last visible match is the
  // real control and an exact-text match keeps the click honest.
  const clickControl = (re) => page.evaluate((src, flags) => {
    const rx = new RegExp(src, flags);
    const bs = Array.from(document.querySelectorAll('button')).filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 10 && r.height > 10 && rx.test((b.innerText || '').trim());
    });
    const b = bs[bs.length - 1];
    if (!b) return null;
    b.click();
    return (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 44);
  }, re.source, re.flags.includes('i') ? 'i' : '');

  // A click that opens a panel is not evidence a run happened. Every /api/
  // response is recorded so each result assertion can prove its request landed.
  const apiCalls = [];
  page.on('response', (r) => {
    const u = String(r.url() || '');
    if (u.includes('/api/')) apiCalls.push({ path: u.replace(BASE, '').split('?')[0], status: r.status() });
  });
  const apiOk = (needle) => apiCalls.some(c => c.path.includes(needle) && c.status === 200);

  // The chat tab keeps a zero-size textarea in the DOM, so index by visibility,
  // never by document order.
  const typeInto = async (text, idx = 0) => {
    const boxes = await page.$$('textarea');
    const rects = await page.evaluate(() => Array.from(document.querySelectorAll('textarea'))
      .map(t => { const r = t.getBoundingClientRect(); return r.width > 10 && r.height > 10; }));
    const visible = boxes.filter((_, i) => rects[i]);
    if (!visible[idx]) throw new Error(`no visible textarea at index ${idx} (textareas=${boxes.length}, visible=${visible.length})`);
    await visible[idx].click();
    await page.evaluate(el => { el.value = ''; }, visible[idx]);
    await visible[idx].type(text, { delay: 0 });
    return visible.length;
  };

  // -- Paste mode -------------------------------------------------------------
  ok('AX1 "Paste text" entry opens', Boolean(await clickByText(page, /\bpaste\b/i)));
  await new Promise(r => setTimeout(r, 600));
  await typeInto(NOTICE_A);
  await new Promise(r => setTimeout(r, 700));
  body = await textOf(page);
  ok('AX1b quick actions appear once enough text is pasted', /explain|summar|risk|translat/i.test(body));

  const readResult = () => page.evaluate(() => {
    // The inactive chat tab keeps its own .ProseMirror in the DOM; only a
    // rendered, sized panel is the Document Intelligence result.
    const boxes = Array.from(document.querySelectorAll('.ProseMirror')).filter(p => {
      const r = p.getBoundingClientRect();
      return r.width > 10 && r.height > 10;
    });
    return boxes.map(b => b.innerText || '').sort((a, c) => c.length - a.length)[0] || '';
  });

  // Explain
  ok('AX2 Explain clicked', Boolean(await clickByText(page, /\bexplain\b/i)));
  const explained = await waitFor(page, async p => (await readResult(p)).trim().length > 80, 60000, 'explain result');
  const exText = await readResult(page);
  ok('AX2b Explain returns a substantive answer', explained && /washing machine|refund|Rs 85,000|consumer|notice/i.test(exText), `len=${exText.length} :: ${exText.slice(0, 120)}`);
  ok('AX2c Explain does not silently leak an error as success', !/^\s*(Could not|failed|error)/i.test(exText), exText.slice(0, 80));

  // Copy / Share / Print on the live result
  const copied = await clickByText(page, /copy|copied/i);
  ok('AX3 Copy control exists on the result', Boolean(copied));
  if (copied) {
    await new Promise(r => setTimeout(r, 800));
    const after = await textOf(page);
    ok('AX3b Copy reports an explicit outcome', /copied|copy ho gaya|copy failed/i.test(after), after.slice(0, 60));
  }
  const before = await page.evaluate(() => (window.__opens || []).length);
  ok('AX4 Share control exists', Boolean(await clickByText(page, /share|whatsapp/i)));
  await new Promise(r => setTimeout(r, 700));
  const opensAfterShare = await page.evaluate(() => (window.__opens || []).map(o => o.url));
  const shareUrl = opensAfterShare.join('|');
  ok('AX4b Share actually hands the text to a share target',
    opensAfterShare.length > before && /wa\.me|mailto|https?:/i.test(shareUrl), `opens=${before}->${opensAfterShare.length}`);
  ok('AX4c the share target carries the result text',
    /wa\.me\/\?text=.+/i.test(shareUrl) && decodeURIComponent(shareUrl).toLowerCase().includes('washing machine'), shareUrl.slice(0, 60));
  ok('AX5 Print control exists', Boolean(await clickByText(page, /print/i)));
  await new Promise(r => setTimeout(r, 900));
  const printDoc = await page.evaluate(() => String(window.__printDoc || ''));
  ok('AX5b Print builds a printable document from the live result', /washing machine|refund|Rs 85,000|consumer/i.test(printDoc), `len=${printDoc.length}`);
  ok('AX5c the printable document requests printing', /window\.print\(\)/.test(printDoc), printDoc.slice(-80));

  // New / Reset
  ok('AX6 New clears the result', Boolean(await clickByText(page, /^\s*new\s*$/i)));
  await new Promise(r => setTimeout(r, 600));
  ok('AX6b result panel gone after New', (await readResult(page)).length === 0 || !await page.$('.ProseMirror'));

  // Summarize + Risks
  await typeInto(NOTICE_A);
  ok('AX7 Summarize clicked', Boolean(await clickByText(page, /summar/i)));
  const summarized = await waitFor(page, async p => (await readResult(p)).trim().length > 60, 60000, 'summary');
  ok('AX7b Summarize produces a summary', summarized, `len=${(await readResult(page)).length}`);

  await clickByText(page, /^\s*new\s*$/i);
  await new Promise(r => setTimeout(r, 500));
  await typeInto(NOTICE_A);
  ok('AX8 Analyze Risks clicked', Boolean(await clickByText(page, /risk/i)));
  const risked = await waitFor(page, async p => (await readResult(p)).trim().length > 60, 60000, 'risks');
  const riskText = await readResult(page);
  ok('AX8b Risks names concrete risks', risked && /deadline|15 days|refund|amount|evidence|consumer court/i.test(riskText), riskText.slice(0, 120));

  // Translation both ways
  await clickByText(page, /^\s*new\s*$/i);
  await new Promise(r => setTimeout(r, 500));
  await typeInto(NOTICE_A);
  ok('AX9 Translate clicked', Boolean(await clickByText(page, /text between english and urdu/i)));
  const translated = await waitFor(page, async p => (await readResult(p)).trim().length > 30, 60000, 'translation');
  const trText = await readResult(page);
  ok('AX9b English -> Urdu returns Urdu script', translated && /[\u0600-\u06FF]/.test(trText), trText.slice(0, 100));

  await clickByText(page, /^\s*new\s*$/i);
  await new Promise(r => setTimeout(r, 500));
  await typeInto(ROMAN_NOTICE);
  ok('AX10 Roman -> Urdu clicked', Boolean(await clickByText(page, /roman.*urdu|urdu.*roman/i)));
  const romanOut = await waitFor(page, async p => (await readResult(p)).trim().length > 20, 60000, 'roman translation');
  const romanText = await readResult(page);
  ok('AX10b Roman Urdu is rendered in Urdu script', romanOut && /[\u0600-\u06FF]/.test(romanText), romanText.slice(0, 100));

  // -- Compare ---------------------------------------------------------------
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button[aria-label]')).find(x => /^documents$/i.test((x.getAttribute('aria-label') || '').trim()));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));
  ok('AX11 Compare entry opens', Boolean(await clickByText(page, /\bcompare\b/i)));
  await new Promise(r => setTimeout(r, 600));
  const panelCount = await page.$$eval('textarea', els => els.filter(t => {
    const p = String(t.getAttribute('placeholder') || '');
    return /paste first document here|paste second document here|pehla dastawez|dusra dastawez/i.test(p);
  }).length);
  ok('AX11b Compare shows two text panels', panelCount === 2, `comparePanelTextareas=${panelCount}`);
  await typeIntoPlaceholder(/paste first document here|pehla dastawez/i, NOTICE_A);
  await typeIntoPlaceholder(/paste second document here|dusra dastawez/i, NOTICE_B);
  ok('AX12 Compare run clicked', Boolean(await clickControl(/^\s*(compare now|muqabla kare[nm]?)\s*$/i)));
  const compared = await waitFor(page, async p => /dates changed|amounts changed|clauses (added|removed)|risk level|tareekhen tabdeel|raqmein tabdeel|khatre ki satah/i.test(await textOf(p)), 60000, 'comparison report');
  const cmpBody = await textOf(page);
  if (!compared) {
    const diag = await page.evaluate(() => ({
      buttons: Array.from(document.querySelectorAll('button')).filter(b => b.getBoundingClientRect().width > 10)
        .map(b => (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean),
      tail: (document.body.innerText || '').slice(-400)
    }));
    console.log(`      [compare diag] buttons=${JSON.stringify(diag.buttons)} tail=${JSON.stringify(diag.tail)}`);
  }
  ok('AX12a the comparison really ran against the backend', apiOk('/api/ai/document-compare'), JSON.stringify(apiCalls.filter(c => c.path.includes('compare'))));
  ok('AX12b Compare reports the date change', compared && /(20 February 2026|1 January 2026)/.test(cmpBody), cmpBody.slice(0, 140));
  ok('AX12c Compare reports the amount change', /(60,000|85,000)/.test(cmpBody));

  // -- Checklist -------------------------------------------------------------
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button[aria-label]')).find(x => /^documents$/i.test((x.getAttribute('aria-label') || '').trim()));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));
  ok('AX13 Checklist entry opens', Boolean(await clickByText(page, /readiness checklist/i)));
  await new Promise(r => setTimeout(r, 600));
  const chips = await page.$$eval('button', bs => bs
    .filter(b => { const r = b.getBoundingClientRect(); return r.width > 10 && r.height > 10; })
    .map(b => (b.innerText || '').replace(/\s+/g, ' ').trim())
    .filter(t => t && t.length < 70));
  ok('AX13b checklist categories are offered', chips.length > 5, `chips=${chips.slice(0, 5).join(' / ')}`);
  ok('AX13c a rent/tenancy category is offered', /rent|tenanc|kirayadaari/i.test(chips.join(' | ')), chips.join(' / ').slice(0, 120));
  ok('AX14 Rent category chip clicked', Boolean(await clickByText(page, /rent \/ tenancy|tenancy dispute|kirayadaari/i)));
  await new Promise(r => setTimeout(r, 400));
  const descFilled = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('textarea'))
      .find(x => /e\.g\.|maslan/i.test(String(x.getAttribute('placeholder') || '')));
    return t ? String(t.value || '') : '';
  });
  ok('AX14b the chip fills the description box', descFilled.trim().length >= 5, descFilled.slice(0, 60));
  const runOk = Boolean(await clickControl(/^\s*(get checklist|checklist hasil.*)\s*$/i));
  ok('AX14c Checklist run clicked', runOk);
  const checked = await waitFor(page, async p => /required items|readiness/i.test(await textOf(p)), 60000, 'checklist output');
  const chkBody = await textOf(page);
  ok('AX14ca the checklist really ran against the backend', apiOk('/api/ai/readiness-checklist'),
    JSON.stringify(apiCalls.filter(c => c.path.includes('readiness'))));
  ok('AX14d Checklist names concrete required documents',
    checked && /tenancy agreement|rent receipt|security deposit|CNIC/i.test(chkBody), chkBody.slice(-260));
  ok('AX14e Checklist names the rent court authority', /rent controller|rent tribunal/i.test(chkBody));
  ok('AX14f Checklist is not an apology dressed as a result', !/could not generate|nahi ban saki|not available for this document/i.test(chkBody));
  ok('AX15 Checklist copy/share/print controls present', await page.$$eval('button', bs => bs
    .filter(b => { const r = b.getBoundingClientRect(); return r.width > 10 && r.height > 10; })
    .filter(b => /^(copy|share|print|copied)\b/i.test((b.innerText || '').trim())).length) >= 3);
  ok('AX15b Checklist copy reports an explicit outcome',
    Boolean(await clickControl(/^\s*(copy|copied|copy ho gaya)\s*$/i))
    && await waitFor(page, async p => /copied|copy ho gaya|copy nahi hua|copy failed/i.test(await textOf(p)), 8000, 'copy outcome'));

  console.log(`\n=================  AX: ${pass} passed / ${fail} failed  ==================`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('AX harness error:', e); process.exit(2); });
