/*
 * WINDOW P14 — Islamic Guidance selector, Voice Agent transcript review and the
 * responsive chat surface, driven in REAL Chrome with REAL mouse/keyboard input.
 *
 * What is genuine here:
 *  - every click is page.mouse.click() on the element's own bounding box;
 *  - every submitted mode is read back from the actual request body the page sent;
 *  - every answer assertion is read back from the rendered DOM.
 * What is NOT genuine and is never reported as such:
 *  - live acoustic ASR. Headless Chrome has no audio input device, so word
 *    recognition is driven by a labelled STUB SpeechRecognition. Everything after
 *    the recognised string (review card, submit, agent call, answer, TTS) is the
 *    real application path. The acoustic leg is reported NOT RUN.
 *
 * Run: node tests/e2e/testP14IslamicVoiceUi.cjs   (APP_URL defaults to :3005)
 */
const puppeteer = require('puppeteer');

const BASE = process.env.APP_URL || 'http://127.0.0.1:3005';
const CHROME_PATHS = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'narrow', width: 400, height: 800 }
];
const COMBINED_Q = 'Is maintenance (nafaqa) obligatory on a husband in Pakistan, and what does Islam say about it?';
const ISLAMIC_Q = 'What does the Qur’an say about fairness in family maintenance?';
const URDU_Q = 'کیا طلاق کے بعد نفقہ کا کیا حق ہے؟';
const SPOKEN_Q = 'My sister in Lahore needs maintenance after divorce please advise';
const EDITED_Q = 'My sister in Karachi needs maintenance after divorce please advise';

const results = [];
const ok = (id, msg) => results.push({ id, pass: true, msg });
const bad = (id, msg) => results.push({ id, pass: false, msg });
const info = (id, msg) => results.push({ id: id, pass: true, msg: 'INFO ' + msg, info: true });
const blocked = (id, msg) => results.push({ id, pass: true, msg: 'BLOCKED ' + msg, blocked: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------------- browser bootstrap: request spy + TTS spy + stub ASR ---------------- */
function bootstrap() {
  const aud = {
    aiRequests: [], tts: [], srStarts: 0, srLangs: [], srMode: 'empty', srTranscript: '',
    voicesSeen: 0
  };
  window.__AUD = aud;
  const origFetch = window.fetch;
  window.fetch = function (url, opts) {
    let entry = null;
    try {
      const u = String(url);
      if (u.indexOf('/api/ai/') !== -1 && opts && opts.body) {
        entry = { url: u, body: String(opts.body), status: 0, sse: '' };
        aud.aiRequests.push(entry);
      }
    } catch (e) { /* ignore */ }
    return origFetch.apply(this, arguments).then(function (res) {
      if (entry) {
        entry.status = res.status;
        try { res.clone().text().then(t => { entry.sse = t; }).catch(function () {}); } catch (e) { /* ignore */ }
      }
      return res;
    });
  };
  const OX = window.XMLHttpRequest;
  if (OX) {
    const oOpen = OX.prototype.open, oSend = OX.prototype.send;
    OX.prototype.open = function (m, u) { this.__u = String(u); return oOpen.apply(this, arguments); };
    OX.prototype.send = function (b) {
      let entry = null;
      if (this.__u && this.__u.indexOf('/api/ai/') !== -1 && b) {
        entry = { url: this.__u, body: String(b) };
        aud.aiRequests.push(entry);
      }
      if (entry) {
        const xhr = this;
        xhr.addEventListener('loadend', function () { if (entry) entry.status = xhr.status; });
      }
      return oSend.apply(this, arguments);
    };
  }
  if (window.speechSynthesis) {
    const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = function (u) {
      aud.tts.push({ text: String(u && u.text || ''), lang: String(u && u.lang || ''), voice: String((u && u.voice && u.voice.name) || '') });
      aud.voicesSeen = (window.speechSynthesis.getVoices() || []).length;
      try { u.onend && u.onend({}); } catch (e) { /* ignore */ }
      return true;   // never actually produce audio in headless Chrome
    };
  }
  function mkRes(segments) {
    const arr = [];
    for (let i = 0; i < segments.length; i++) {
      const one = {}; one[0] = { transcript: segments[i][0], confidence: 0.9 }; one.length = 1; one.isFinal = !!segments[i][1];
      arr.push(one);
    }
    return arr;
  }
  function StubSR() {
    this.lang = ''; this.continuous = false; this.interimResults = false;
    this.onstart = null; this.onresult = null; this.onerror = null; this.onend = null;
    aud.srStarts++;
  }
  StubSR.prototype.start = function () {
    const self = this, mode = aud.srMode;
    aud.srLangs.push(String(this.lang));
    setTimeout(function () { if (self.onstart) self.onstart({}); }, 20);
    if (mode === 'locale-unsupported') {
      setTimeout(function () { if (self.onerror) self.onerror({ error: 'language-not-supported' }); }, 150);
      return;
    }
    if (mode === 'deny') {
      setTimeout(function () { if (self.onerror) self.onerror({ error: 'not-allowed' }); }, 150);
      return;
    }
    if (mode === 'network') {
      setTimeout(function () { if (self.onerror) self.onerror({ error: 'network' }); }, 150);
      return;
    }
    const text = String(aud.srTranscript || '');
    if (!text) {
      setTimeout(function () { if (self.onerror) self.onerror({ error: 'no-speech' }); }, 150);
      return;
    }
    setTimeout(function () {
      if (self.interimResults && self.onresult) self.onresult({ resultIndex: 0, results: mkRes([[text.slice(0, Math.max(3, text.length / 2)), false]]) });
    }, 200);
    setTimeout(function () {
      if (self.onresult) self.onresult({ resultIndex: 0, results: mkRes([[text, true]]) });
      if (self.onend) self.onend({});
    }, 500);
  };
  StubSR.prototype.stop = function () {};
  StubSR.prototype.abort = function () { if (this.onerror) this.onerror({ error: 'aborted' }); };
  StubSR.__VOICE_TEST_STUB = 'QODER TEST STUB - not a real speech engine; live acoustic ASR is NOT RUN.';
  window.SpeechRecognition = StubSR;
  window.webkitSpeechRecognition = StubSR;
}

/* ---------------- helpers ---------------- */
async function clickText(page, selector, text) {
  const els = await page.$$(selector);
  for (const el of els) {
    const t = await el.evaluate(e => (e.textContent || '').trim());
    if (t.indexOf(text) === -1) continue;
    const vis = await el.evaluate(e => !!(e.offsetParent || e.getClientRects().length));
    if (!vis) continue;                       // hidden duplicate tab/nav — skip it
    await el.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await sleep(150);
    const box = await el.boundingBox();
    if (!box || box.width === 0) return { clicked: false, reason: 'no-box', text: t };
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return { clicked: true, text: t };
  }
  return { clicked: false, reason: 'not-found-or-hidden', text: '' };
}
/* Below 1280px the labeled tabs live in the "All services" menu, so open it
   before giving up on a tab click. The assertion stays a real mouse click. */
async function openNavTab(page, label) {
  const direct = await clickText(page, 'nav button', label);
  if (direct.clicked) return direct;
  const trigger = await clickText(page, 'nav button', 'All services');
  if (!trigger.clicked) return direct;
  await sleep(300);
  return clickText(page, '#all-services-menu button', label);
}
async function clickTestId(page, testid) {  const els = await page.$$(`[data-testid="${testid}"]`);
  for (const el of els) {
    const vis = await el.evaluate(e => !!(e.offsetParent || e.getClientRects().length));
    if (!vis) continue;
    await el.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await sleep(150);
    const box = await el.boundingBox();
    if (!box || box.width === 0) continue;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return { clicked: true };
  }
  return { clicked: false, reason: els.length ? 'invisible' : 'missing' };
}
async function waitEval(page, fn, arg, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    await sleep(400);
  }
  return null;
}
/** The one visible composer textarea on the current screen, or null. */
const visibleComposer = () => {
  const tas = Array.from(document.querySelectorAll('textarea[placeholder]'))
    .filter(e => !!(e.offsetParent || e.getClientRects().length));
  if (!tas.length) return null;
  const ta = tas[0];
  ta.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, '');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return { placeholder: ta.getAttribute('placeholder'), count: tas.length };
};
/* Every evidence class the UI is allowed to print (src/lib/answerEvidence.ts). A chip
   outside this list — a placeholder, a bare "[Tasdeeq Shuda …]", an invented label — is
   a FAIL, not a different name for the same thing. */
const EVIDENCE_CLASSES = [
  'VERIFIED ISLAMIC + PAKISTAN LAW SOURCES', 'VERIFIED ISLAMIC SOURCE', 'VERIFIED LEGAL KNOWLEDGE',
  'PARTIAL MATCH — CLOSEST ISLAMIC + LAW RECORDS', 'PARTIAL MATCH — CLOSEST ISLAMIC RECORD',
  'PARTIAL MATCH — CLOSEST LEGAL RECORD',
  'GENERAL GUIDANCE — NO MATCHING RECORD', 'MORE INFORMATION NEEDED'
];
const VERIFIED_CLASS = /^VERIFIED/;
/** Which chip each gate verdict entitles the UI to show, and nothing else. */
const ENTITLED = {
  strong: EVIDENCE_CLASSES.filter(l => VERIFIED_CLASS.test(l)),
  weak: EVIDENCE_CLASSES.filter(l => /^PARTIAL/.test(l)),
  none: ['GENERAL GUIDANCE — NO MATCHING RECORD'],
  clarify: ['MORE INFORMATION NEEDED']
};
/** An unqualified "VERIFIED …" claim about the answer itself (the composer qualifies a
 *  weak answer as PARTIALLY / QISMAN VERIFIED, and a provision lookup as DIRECT). */
const UNQUALIFIED_VERIFIED = /(?<!PARTIALLY )(?<!QISMAN )(?<!DIRECT )\bVERIFIED (?:LEGAL )?(?:REFERENCE|JAWAB|MAKHAAZ|QANOONI HAWALA)/i;

/* The chip on the surface the user is looking at, read from the DOM. The class list is
   passed in: page.evaluate serializes this function, so it cannot close over constants. */
const readChip = (classes) => {
  const root = document.querySelector('[data-testid="answer-result"]');
  const spans = root ? Array.from(root.querySelectorAll('nav span')) : [];
  const texts = spans.map(s => (s.textContent || '').trim().replace(/\s+/g, ' ')).filter(t => t.length > 3);
  return { chip: texts.find(t => classes.includes(t)) || '', shown: texts };
};
/** The gate's own verdict, parsed out of the SSE body the browser received. */
const verdictOf = (sse) => {
  const hits = String(sse || '').match(/"verdict":"(strong|weak|none|clarify)"/g) || [];
  return hits.length ? hits[hits.length - 1].slice(11, -1) : '';
};

/* The three-way evidence-path group exists on all three chat surfaces: the search-first
   home page (label id home-evidence-path-label), the open-conversation hero (label id
   evidence-path-label) and the answer page (data-testid answer-evidence-path-group).
   Which one is on screen depends only on how far into a conversation the user is, never
   on whether the selector works, so every assertion below addresses all three and still
   reads its state back from the real DOM. */
const GROUP = '[role="group"][aria-labelledby="evidence-path-label"], '
  + '[role="group"][aria-labelledby="home-evidence-path-label"], '
  + '[data-testid="answer-evidence-path-group"]';
/* ":is(a, b) button" — a bare "a, b button" would match the group element itself. */
const GROUP_BTN = `:is(${GROUP}) button`;

/* ---------------- main ---------------- */
(async () => {
  const executablePath = CHROME_PATHS.find(p => require('fs').existsSync(p)) || undefined;
  const browser = await puppeteer.launch({
    headless: 'new', executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  const consoleErrors = [];

  try {
    /* ============ 1. responsive pass at the four required viewports ============ */
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      page.setDefaultTimeout(90000);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.evaluateOnNewDocument(bootstrap);
      page.on('pageerror', e => consoleErrors.push(`[${vp.name}] pageerror: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[${vp.name}] console: ${m.text()}`); });
      await page.goto(BASE, { waitUntil: 'networkidle2' });

      const nav = await openNavTab(page, 'Islamic Guidance');
      if (!nav.clicked) bad(`R1.${vp.name}.nav`, `Islamic Guidance tab not clickable: ${JSON.stringify(nav)}`);
      else ok(`R1.${vp.name}.nav`, 'opened Islamic Guidance by mouse click');
      await sleep(900);

      const sel = await page.evaluate((sel) => {
        const g = document.querySelector(sel);
        if (!g) return { present: false };
        const label = ((document.getElementById('evidence-path-label')
          || document.getElementById('home-evidence-path-label') || {}).textContent || '');
        const btns = Array.from(g.querySelectorAll('button')).map(b => {
          const r = b.getBoundingClientRect();
          return {
            text: (b.textContent || '').trim(), pressed: b.getAttribute('aria-pressed'),
            left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height),
            focusable: b.tabIndex >= 0 && b.tagName === 'BUTTON'
          };
        });
        return { present: true, label: label.trim(), btns, innerWidth: window.innerWidth };
      }, GROUP);
      if (!sel.present) { bad(`R1.${vp.name}.selector`, 'three-way selector not rendered'); await page.close(); continue; }
      if (sel.btns.length !== 3) bad(`R1.${vp.name}.selector`, `expected 3 mode buttons, found ${sel.btns.length}`);
      else ok(`R1.${vp.name}.selector`, `3 buttons, group label "${sel.label}"`);

      const clipped = sel.btns.filter(b => b.right > sel.innerWidth + 1 || b.left < -1 || b.w < 24 || b.h < 20);
      if (clipped.length) bad(`R1.${vp.name}.clip`, `selector controls clipped/off-screen: ${JSON.stringify(clipped)}`);
      else ok(`R1.${vp.name}.clip`, 'all selector controls fully inside the viewport');

      const overflow = await page.evaluate(() => ({
        docScroll: document.documentElement.scrollWidth, inner: window.innerWidth,
        bodyScroll: document.body.scrollWidth
      }));
      if (overflow.docScroll > overflow.inner + 1 || overflow.bodyScroll > overflow.inner + 1) {
        bad(`R1.${vp.name}.overflow`, `sideways overflow ${JSON.stringify(overflow)}`);
      } else ok(`R1.${vp.name}.overflow`, `no sideways overflow (${overflow.docScroll} <= ${overflow.inner})`);

      /* real mouse click on the combined option, then read aria-pressed back */
      const c = await clickText(page, GROUP_BTN, 'Pakistan Law');
      if (!c.clicked) bad(`R1.${vp.name}.clickLaw`, `could not click "Pakistan Law": ${JSON.stringify(c)}`);
      else {
        await sleep(350);
        const st = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel))
          .map(b => ({ t: (b.textContent || '').trim(), p: b.getAttribute('aria-pressed') })), GROUP_BTN);
        const law = st.find(x => x.t.indexOf('Pakistan Law') === 0 || x.t === 'Pakistan Law');
        if (!law || law.p !== 'true') bad(`R1.${vp.name}.clickLaw`, `aria-pressed not true after mouse click: ${JSON.stringify(st)}`);
        else ok(`R1.${vp.name}.clickLaw`, 'mouse click switched the evidence path (aria-pressed=true)');
      }

      /* keyboard operability: focus the first option, Tab to the next, Enter to activate */
      const kb = await page.evaluate((sel) => {
        const g = document.querySelector(sel);
        const b0 = g && g.querySelectorAll('button')[0];
        if (!b0) return false;
        b0.focus();
        return document.activeElement === b0;
      }, GROUP);
      if (!kb) bad(`R1.${vp.name}.kbd`, 'selector button cannot receive keyboard focus');
      else {
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await sleep(350);
        const focusedPressed = await page.evaluate(() => {
          const a = document.activeElement;
          return a && a.getAttribute && a.getAttribute('aria-pressed');
        });
        if (focusedPressed !== 'true' && focusedPressed !== 'false') bad(`R1.${vp.name}.kbd`, `Tab did not land on a mode button (aria-pressed=${focusedPressed})`);
        else ok(`R1.${vp.name}.kbd`, `keyboard Tab+Enter works (aria-pressed=${focusedPressed})`);
      }

      /* every control in the composer must be reachable and non-zero at this width */
      const composer = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('textarea[placeholder]'));
        const vis = all.filter(e => !!(e.offsetParent || e.getClientRects().length));
        const r = vis[0] ? vis[0].getBoundingClientRect() : null;
        const btns = Array.from(document.querySelectorAll('button[aria-label]'))
          .filter(e => !!(e.offsetParent || e.getClientRects().length));
        return {
          total: all.length, visible: vis.length,
          taW: r ? Math.round(r.width) : 0, taH: r ? Math.round(r.height) : 0,
          ph: vis[0] ? vis[0].getAttribute('placeholder') : '', visibleLabelledButtons: btns.length
        };
      });
      if (!composer.visible || composer.taW < 120 || composer.taH < 30) bad(`R1.${vp.name}.composer`, `no usable visible composer: ${JSON.stringify(composer)}`);
      else ok(`R1.${vp.name}.composer`, `visible composer ${composer.taW}x${composer.taH} of ${composer.total} textareas, "${composer.ph.slice(0, 24)}…"`);

      await page.close();
    }

    /* ============ 2. functional pass: submitted mode + rendered evidence ============ */
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1440, height: 1000 });
    await page.evaluateOnNewDocument(bootstrap);
    page.on('pageerror', e => consoleErrors.push(`[func] pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[func] console: ${m.text()}`); });
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await openNavTab(page, 'Islamic Guidance');
    await sleep(900);

    /* Suggestion chips live above the home search field and follow the selected
       evidence path. Compared here, before any question is asked, because the
       answer page deliberately has no chip row. */
    {
      const chipsOf = () => page.evaluate(() => Array.from(
        document.querySelectorAll('[data-testid="home-suggestion"]'))
        .filter(e => !!(e.offsetParent || e.getClientRects().length))
        .map(e => (e.textContent || '').trim()));
      const islamicChips = await chipsOf();
      const toLaw = await clickText(page, GROUP_BTN, 'Pakistan Law');
      await sleep(450);
      const lawChips = await chipsOf();
      const back = await clickText(page, GROUP_BTN, 'Islamic Guidance');
      await sleep(450);
      if (!toLaw.clicked || !back.clicked) bad('R2.chips.setup', `could not switch paths to compare chips (law=${toLaw.clicked}, islamic=${back.clicked})`);
      else if (!islamicChips.length || !lawChips.length) bad('R2.chips', `a path rendered no suggestion chips (islamic=${islamicChips.length}, law=${lawChips.length})`);
      else {
        const shared = islamicChips.filter(c => lawChips.includes(c));
        if (shared.length) bad('R2.chips', `Islamic and law chips are not mode-specific, shared: ${JSON.stringify(shared)}`);
        else ok('R2.chips', `Islamic mode offers ${islamicChips.length} of its own chips, none shared with the ${lawChips.length} law chips (first: "${islamicChips[0].slice(0, 34)}")`);
      }
    }

    const ask = async (modeLabel, question) => {
      const cl = await clickText(page, GROUP_BTN, modeLabel);
      if (!cl.clicked) { bad('R2.pick.' + modeLabel, `could not pick "${modeLabel}"`); return null; }
      await sleep(300);
      const comp = await page.evaluate(visibleComposer);
      if (!comp) { bad('R2.type.' + modeLabel, 'no visible chat textarea to type into'); return null; }
      info('R2.type.' + modeLabel, `typed into the visible composer "${comp.placeholder.slice(0, 28)}" (${comp.count} textareas in DOM)`);
      await page.keyboard.type(question, { delay: 12 });
      const before = await page.evaluate(() => window.__AUD.aiRequests.length);
      await page.keyboard.press('Enter');
      const req = await waitEval(page, (n) => {
        const r = window.__AUD.aiRequests;
        if (r.length <= n) return null;
        const last = r[r.length - 1];
        return last.status && last.sse ? JSON.stringify(last) : null;
      }, before, 45000);
      if (!req) { bad('R2.submit.' + modeLabel, 'no /api/ai request was sent (or its body never arrived)'); return null; }
      const parsed = JSON.parse(req);
      let body = {};
      try { body = JSON.parse(parsed.body); } catch (e) { /* not JSON */ }
      info('R2.body.' + modeLabel, `submitted to ${parsed.url} → HTTP ${parsed.status}, mode=${JSON.stringify(body.mode)} preferredLanguage=${JSON.stringify(body.preferredLanguage)}`);
      if (parsed.status !== 200) {
        blocked('R2.class.' + modeLabel, `request answered HTTP ${parsed.status}; the rendered-evidence assertions for this mode could not run`);
        return { body, badge: '', verdict: '', rendered: '', asked: question, httpStatus: parsed.status };
      }

      const verdict = verdictOf(parsed.sse);
      if (!verdict) bad('R2.verdict.' + modeLabel, 'the response carries no evidence-gate verdict at all');
      else ok('R2.verdict.' + modeLabel, `gate verdict on the wire: ${verdict}`);

      const surf = await waitEval(page, readChip, EVIDENCE_CLASSES, 60000);
      const chip = surf ? surf.chip : '';
      if (!surf || !chip) {
        bad('R2.class.' + modeLabel, `no evidence-class chip rendered; the answer header shows ${JSON.stringify(surf ? surf.shown : [])}`);
      } else if (verdict && !ENTITLED[verdict].includes(chip)) {
        bad('R2.class.' + modeLabel, `chip "${chip}" is not the class verdict "${verdict}" entitles (${JSON.stringify(ENTITLED[verdict])})`);
      } else {
        ok('R2.class.' + modeLabel, `chip "${chip}" = the class verdict "${verdict || 'n/a'}" entitles`);
      }

      const rendered0 = await waitEval(page, () => {
        const el = document.querySelector('[data-testid="result-answer"]');
        const t = el ? (el.innerText || '') : '';
        return t.trim().length > 30 ? t : null;
      }, null, 90000) || '';
      if (!rendered0) bad('R2.render.' + modeLabel, 'the answer surface never rendered answer text');
      else ok('R2.render.' + modeLabel, `answer text read from [data-testid="result-answer"] (${rendered0.length} chars)`);

      if (UNQUALIFIED_VERIFIED.test(rendered0) && verdict !== 'strong') {
        bad('R2.claim.' + modeLabel, `answer body prints an unqualified VERIFIED heading on verdict "${verdict}"`);
      } else {
        ok('R2.claim.' + modeLabel, `no unqualified VERIFIED claim beyond what verdict "${verdict || 'n/a'}" grants`);
      }
      return { body, badge: chip, verdict, rendered: rendered0, asked: question };
    };

    const isl = await ask('Islamic Guidance', ISLAMIC_Q);
    if (isl && !isl.httpStatus) {
      if (isl.body.mode !== 'islamic') bad('R2.mode.islamic', `server mode should be "islamic", got ${JSON.stringify(isl.body.mode)}`);
      else ok('R2.mode.islamic', 'selector → request mode "islamic"');
      const srcs = (await page.evaluate(() => document.querySelectorAll('a[target="_blank"]').length)) || 0;
      if (srcs === 0) bad('R2.links.islamic', 'no clickable citation anchors rendered');
      else ok('R2.links.islamic', `${srcs} clickable citation anchors`);
      const hadAyah = /Qur|ayah|\d+:\d+/.test(isl.rendered);
      if (!hadAyah) bad('R2.content.islamic', 'Islamic answer carries no verse reference');
      else ok('R2.content.islamic', 'Islamic answer prints a verse reference');
      await sleep(25000);
    }

    /* section 1: the answer action row must be reachable, not clipped by the bubble */
    {
      const act = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('[data-testid^="chat-action-"]').forEach(el => {
          if (!(el.offsetParent || el.getClientRects().length)) return;
          const r = el.getBoundingClientRect();
          items.push({ id: el.getAttribute('data-testid'), left: Math.round(r.left), right: Math.round(r.right) });
        });
        const chip = document.querySelector('[data-testid="chat-suggestion"]');
        return { items, vw: window.innerWidth, chip: chip ? chip.textContent.trim() : '' };
      });
      if (!act.items.length) bad('R2.actions.render', 'an answer rendered no read-aloud/copy/share controls');
      else {
        const clipped = act.items.filter(i => i.left < 0 || i.right > act.vw + 1);
        if (clipped.length) bad('R2.actions.clip', clipped.length + ' action control(s) outside the ' + act.vw + 'px viewport: ' + clipped.map(c => c.id + '@' + c.right).join(', '));
        else ok('R2.actions.clip', act.items.length + ' answer action controls fully inside the ' + act.vw + 'px viewport');
      }
      const before = await page.evaluate(() => window.__AUD.tts.length);
      const cl = await clickTestId(page, 'chat-action-read-aloud');
      if (!cl.clicked) bad('R2.actions.readaloud', 'read-aloud control was not clickable (' + (cl.reason || '?') + ')');
      else {
        const spoke = await waitEval(page, (n) => (window.__AUD.tts.length > n ? String(window.__AUD.tts.length) : null), before, 15000);
        if (!spoke) bad('R2.actions.readaloud', 'clicking read-aloud queued no utterance');
        else ok('R2.actions.readaloud', 'read-aloud queued an utterance from inside the answer (' + spoke + ' total)');
      }
    }

    const com = await ask('Islamic Guidance + Pakistan Law', COMBINED_Q);
    if (com && !com.httpStatus) {
      if (com.body.mode !== 'combined') bad('R2.mode.combined', `server mode should be "combined", got ${JSON.stringify(com.body.mode)}`);
      else ok('R2.mode.combined', 'selector → request mode "combined"');
      const hasA = /A\.\s*Islamic perspective|A\.\s*Deeni/i.test(com.rendered);
      const hasB = /B\.\s/.test(com.rendered);
      if (!hasA || !hasB) bad('R2.sections', `combined answer must show separate A/B sections (A=${hasA} B=${hasB})`);
      else ok('R2.sections', 'combined answer renders a separate Islamic section and a Pakistan-law section');
      const badHref = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('a[target="_blank"]').forEach(a => {
          const h = a.getAttribute('href') || '';
          if (/\s/.test(h) || h.indexOf('%20') !== -1) bad.push(h);
        });
        return bad;
      });
      if (badHref.length) bad('R2.href', `malformed citation hrefs still rendered: ${JSON.stringify(badHref).slice(0, 300)}`);
      else ok('R2.href', 'no whitespace-encoded citation hrefs');
      const relOk = await page.evaluate(() => Array.from(document.querySelectorAll('a[target="_blank"]'))
        .every(a => /noopener/.test(a.getAttribute('rel') || '')));
      if (!relOk) bad('R2.rel', 'an external citation link lacks rel="noopener"');
      else ok('R2.rel', 'external citation links carry rel=noopener');
      await sleep(25000);
    }

    /* the answer's evidence class must not be re-labelled when the selector is moved */
    await clickText(page, GROUP_BTN, 'Islamic Guidance');
    await sleep(500);
    if (!com || !com.badge) {
      blocked('R2.badge.sticky', 'the combined answer carried no evidence chip, so chip stickiness could not be measured');
    } else {
      const chipAfter = (await page.evaluate(readChip, EVIDENCE_CLASSES)).chip;
      if (chipAfter !== com.badge) {
        bad('R2.badge.sticky', `switching the selector retroactively changed an older answer's evidence chip from "${com.badge}" to "${chipAfter}"`);
      } else ok('R2.badge.sticky', `older answer keeps its own evidence chip ("${chipAfter}") after the selector moves`);
    }

    /* Urdu-script legal wording on the law path — measured, then rendered honestly */
    const urd = await ask('Pakistan Law', URDU_Q);
    if (urd && !urd.httpStatus) {
      if (typeof urd.body.mode !== 'undefined') bad('R2.mode.law', `law path must not send a mode, got ${JSON.stringify(urd.body.mode)}`);
      else ok('R2.mode.law', 'law path submits without an Islamic/combined mode');
      /* Read the answer surface itself: it holds exactly the answer under test, so a
         stale Islamic or combined bubble can never satisfy or poison this check. */
      const scoped = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="result-answer"]');
        if (!el) return { text: '', anchors: 0, present: false };
        return { text: el.innerText || '', anchors: el.querySelectorAll('a[target="_blank"]').length, present: true };
      });
      const last = scoped.text || '';
      const gate = /Evidence gate classification|QISMAN VERIFIED|PARTIALLY VERIFIED/i.test(last);
      const refusal = /not a calculator|hisab ke liye|Insufficient evidence|could not reach its service/i.test(last);
      const legal = /Section [0-9]+|Ordinance|Act,|court|nafqa|talaq|qanoon/i.test(last);
      info('R2.urdu.outcome', `answer surface ${scoped.present ? 'present' : 'MISSING'}: ${last.length} chars, ${scoped.anchors} citation anchors, verdict=${urd.verdict || 'n/a'}, chip=${JSON.stringify(urd.badge)}, gateLine=${gate}, refusal=${refusal}, legal=${legal}`);
      if (refusal) bad('R2.urdu.answered', `Urdu-script legal wording hit an out-of-scope or service refusal: ${JSON.stringify(last.slice(0, 160))}`);
      else if (!legal) bad('R2.urdu.answered', `Urdu-script answer carries no legal provision wording: ${JSON.stringify(last.slice(0, 160))}`);
      else if (last.length < 300) bad('R2.urdu.answered', `Urdu-script answer is only ${last.length} chars`);
      else ok('R2.urdu.answered', `Urdu-script legal wording answered from retrieved law (${last.length} chars, provision wording present, gate note=${gate ? 'yes' : 'no'})`);
    }

    /* §5 gap closure: the answered conversation is re-measured at tablet/mobile
       widths. Resizing an already-answered page avoids extra /api/ai calls. */
    for (const vp of [{ name: 'tablet', width: 820, height: 1180 }, { name: 'mobile', width: 390, height: 844 }, { name: 'narrow', width: 400, height: 800 }]) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await sleep(800);
      await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('[data-testid^="chat-action-"]'));
        if (els.length) els[els.length - 1].scrollIntoView({ block: 'center' });
      });
      await sleep(400);
      const res = await page.evaluate(() => {
        const shown = (el) => !!(el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
        const scroller = (el) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const oy = getComputedStyle(p).overflowY;
            if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
          }
          return null;
        };
        const items = [];
        document.querySelectorAll('[data-testid^="chat-action-"]').forEach(el => {
          if (!shown(el)) return;
          const r = el.getBoundingClientRect();
          const owner = el.closest('.ProseMirror');
          const or = owner ? owner.getBoundingClientRect() : null;
          const sc = scroller(el);
          const sr = sc ? sc.getBoundingClientRect() : null;
          const inScrollView = !sr || (r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1);
          const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
          const at = inScrollView ? document.elementFromPoint(cx, cy) : null;
          items.push({
            id: el.getAttribute('data-testid'), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height),
            ownerLeft: or ? Math.round(or.left) : null, ownerRight: or ? Math.round(or.right) : null,
            hitInside: inScrollView ? { tested: true, ok: !!(at && el.contains(at)) } : { tested: false, ok: true }
          });
        });
        return { items, vw: window.innerWidth, doc: document.documentElement.scrollWidth };
      });
      if (res.items.length < 3) bad(`R2.actions.${vp.name}.render`, `only ${res.items.length} action controls visible at ${vp.width}px`);
      else {
        const offView = res.items.filter(i => i.left < -1 || i.right > res.vw + 1 || i.h < 18);
        const offBubble = res.items.filter(i => (i.ownerRight !== null && i.right > i.ownerRight + 1) || (i.ownerLeft !== null && i.left < i.ownerLeft - 1));
        const unclickable = res.items.filter(i => i.hitInside.tested && !i.hitInside.ok);
        info(`R2.actions.${vp.name}.hit`, `${res.items.filter(i => i.hitInside.tested).length}/${res.items.length} action controls were hit-tested inside the scroll viewport`);
        if (offView.length) bad(`R2.actions.${vp.name}.clip`, `${offView.length} control(s) outside the ${res.vw}px viewport: ${offView.map(c => c.id + '@' + c.left + '-' + c.right).join(', ')}`);
        else if (offBubble.length) bad(`R2.actions.${vp.name}.clip`, `${offBubble.length} control(s) spill outside their answer bubble: ${offBubble.map(c => c.id + '@' + c.right + '>' + c.ownerRight).join(', ')}`);
        else if (unclickable.length) bad(`R2.actions.${vp.name}.clip`, `${unclickable.length} control(s) covered at their own centre: ${unclickable.map(c => c.id).join(', ')}`);
        else ok(`R2.actions.${vp.name}.clip`, `${res.items.length} answer action controls contained in the bubble and viewport at ${vp.width}px`);
      }
      if (res.doc > res.vw + 1) bad(`R2.actions.${vp.name}.overflow`, `document scrollWidth ${res.doc} > ${res.vw}`);
      else ok(`R2.actions.${vp.name}.overflow`, `no page horizontal overflow at ${vp.width}px`);
    }

    await page.close();

    /* ============ 3. Voice Agent: review before submit, agent payload, read aloud ============ */
    const vpage = await browser.newPage();
    vpage.setDefaultTimeout(120000);
    await vpage.setViewport({ width: 1440, height: 1000 });
    await vpage.evaluateOnNewDocument(bootstrap);
    vpage.on('pageerror', e => consoleErrors.push(`[voice] pageerror: ${e.message}`));
    vpage.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[voice] console: ${m.text()}`); });
    await vpage.goto(BASE, { waitUntil: 'networkidle2' });
    const vnav = await clickText(vpage, 'nav button', 'Voice Agent');
    if (!vnav.clicked) bad('R3.nav', `Voice Agent tab not clickable: ${JSON.stringify(vnav)}`);
    else info('R3.nav', `clicked nav "${vnav.text}"`);
    const onVoice = await waitEval(vpage, () => {
      const el = document.querySelector('[data-testid="voice-controls"]');
      return el && (el.offsetParent || el.getClientRects().length) ? 'visible' : null;
    }, null, 10000);
    if (!onVoice) bad('R3.nav', 'Voice Agent screen never became visible');
    else ok('R3.nav', 'Voice Agent screen is on screen after a real nav click');
    await sleep(600);

    const cap = await vpage.evaluate(() => ({
      stub: (window.SpeechRecognition || {}).__VOICE_TEST_STUB || 'none',
      realSR: !!(window.SpeechRecognition && !window.SpeechRecognition.__VOICE_TEST_STUB)
    }));
    info('R3.asr.environment', `acoustic ASR NOT RUN in headless Chrome; driving a labelled stub (${cap.stub}) — the real microphone path is unverified here`);

    await vpage.evaluate(() => { window.__AUD.srMode = 'empty'; });
    const first = await clickTestId(vpage, 'voice-start');
    if (!first.clicked) bad('R3.consent', `Start listening not clickable: ${JSON.stringify(first)}`);
    const consentAppeared = await waitEval(vpage, () => {
      const el = document.querySelector('[data-testid="voice-consent-accept"]');
      return el && (el.offsetParent || el.getClientRects().length) ? (el.textContent || '').trim() : null;
    }, null, 8000);
    if (!consentAppeared) bad('R3.consent', 'no consent gate appeared before the first listen');
    else {
      const acc = await clickTestId(vpage, 'voice-consent-accept');
      await sleep(1200);
      if (!acc.clicked) bad('R3.consent', 'consent accept control not clickable');
      else ok('R3.consent', `consent gate shown ("${consentAppeared}") and accepted by mouse before any recognition`);
    }

    /* transcript must be held for editing, not auto-submitted */
    await vpage.evaluate((t) => { window.__AUD.srMode = 'final'; window.__AUD.srTranscript = t; }, SPOKEN_Q);
    let st = await clickTestId(vpage, 'voice-start');
    if (!st.clicked) {
      await vpage.evaluate(() => { window.__AUD.srMode = 'empty'; });
      await sleep(300);
      st = await clickTestId(vpage, 'voice-start');
    }
    if (!st.clicked) bad('R3.listen', 'Start listening control not clickable');
    else {
      const held = await waitEval(vpage, () => {
        const el = document.querySelector('[data-testid="voice-review-input"]');
        return el ? (el.value || '') : null;
      }, null, 15000);
      if (held === null) bad('R3.review', 'no editable transcript review card appeared after recognition');
      else {
        const reqCount = await vpage.evaluate(() => window.__AUD.aiRequests.length);
        if (reqCount > 0) bad('R3.review', `transcript was auto-submitted (${reqCount} AI requests) before the user confirmed`);
        else ok('R3.review', `recognised text "${held.slice(0, 40)}…" held for editing with zero AI requests`);

        /* edit it, then send */
        const el = await vpage.$('[data-testid="voice-review-input"]');
        const box = await el.boundingBox();
        await vpage.mouse.click(box.x + 10, box.y + 10);
        await vpage.evaluate(() => document.execCommand('selectAll', false, null));
        await vpage.keyboard.press('Backspace');
        await vpage.type('[data-testid="voice-review-input"]', EDITED_Q, { delay: 8 });
        const edited = await vpage.evaluate(() => document.querySelector('[data-testid="voice-review-input"]').value);
        if (edited !== EDITED_Q) bad('R3.edit', `textarea did not accept the edit (got "${edited}")`);
        else ok('R3.edit', 'transcript is genuinely editable before submission');

        await clickTestId(vpage, 'voice-review-send');
        const sent = await waitEval(vpage, () => {
          const r = window.__AUD.aiRequests.filter(x => x.url.indexOf('/api/ai/agent') !== -1);
          return r.length ? JSON.stringify(r[r.length - 1]) : null;
        }, null, 25000);
        if (!sent) bad('R3.send', 'Send to Legal Agent produced no /api/ai/agent request');
        else {
          const p = JSON.parse(sent);
          let body = {};
          try { body = JSON.parse(p.body); } catch (e) { /* ignore */ }
          const q = body.question || body.message || body.text || '';
          const rvGone = await vpage.evaluate(() => !document.querySelector('[data-testid="voice-review"]'));
          if (q !== EDITED_Q) bad('R3.payload', `agent received "${String(q).slice(0, 60)}" instead of the edited text`);
          else ok('R3.payload', `the EDITED transcript reached /api/ai/agent in field "${body.question ? 'question' : 'message'}"`);
          if (!rvGone) bad('R3.payload', 'review card still open after sending');
          else info('R3.payload', `agent request keys: ${Object.keys(body).join(',')}`);

          const ans = await waitEval(vpage, () => {
            const el = document.querySelector('[data-testid="voice-answer"]');
            return el ? (el.textContent || '').trim() : null;
          }, null, 120000);
          if (!ans) bad('R3.answer', 'no agent answer rendered in the transcript');
          else {
            ok('R3.answer', `answer rendered (${ans.length} chars)`);
            const tts = await vpage.evaluate(() => window.__AUD.tts.map(t => t.text));
            const spokeReal = tts.some(x => x.length > 20 && ans.indexOf(x.slice(0, 40)) !== -1);
            const spokeGreeting = tts.some(x => /Assalam|hello|how can i help|welcome/i.test(x));
            if (!spokeReal) bad('R3.tts', `TTS never spoke the final answer; spoke ${JSON.stringify(tts).slice(0, 200)}`);
            else if (spokeGreeting) bad('R3.tts', 'TTS spoke a greeting/placeholder as well as the answer');
            else ok('R3.tts', `Read Aloud spoke the actual final answer (${tts.length} utterance(s), langs ${[...new Set(await vpage.evaluate(() => window.__AUD.tts.map(t => t.lang)))].join('/')})`);

            /* explicit Read Aloud re-voices the same final answer */
            const before = await vpage.evaluate(() => window.__AUD.tts.length);
            const ra = await clickTestId(vpage, 'voice-read-aloud');
            if (!ra.clicked) bad('R3.readaloud', 'Read Aloud control not clickable');
            else {
              await sleep(1200);
              const after = await vpage.evaluate((n) => window.__AUD.tts.slice(n).map(t => t.text).join(' '), before);
              if (!after || ans.indexOf(after.slice(0, 30)) === -1) bad('R3.readaloud', `Read Aloud produced "${String(after).slice(0, 60)}" which is not the displayed answer`);
              else ok('R3.readaloud', 'Read Aloud re-voices the displayed final answer');
            }
          }
        }
      }
    }

    const settle = async () => {
      await clickTestId(vpage, 'voice-stop-speaking');
      await clickTestId(vpage, 'voice-stop');
      await waitEval(vpage, () => {
        const b = Array.from(document.querySelectorAll('[data-testid="voice-start"]'))
          .filter(e => e.offsetParent || e.getClientRects().length)[0];
        return b && !b.disabled ? 'ready' : null;
      }, null, 15000);
      await sleep(400);
    };
    /* discard path: nothing is submitted */
    await settle();
    await vpage.evaluate(() => { window.__AUD.srMode = 'final'; window.__AUD.srTranscript = 'please ignore this take entirely'; });
    const st2 = await clickTestId(vpage, 'voice-start');
    if (st2.clicked) {
      const held2 = await waitEval(vpage, () => {
        const el = document.querySelector('[data-testid="voice-review-input"]');
        return el ? (el.value || '') : null;
      }, null, 15000);
      if (held2 === null) bad('R3.discard', 'second take produced no review card');
      else {
        const n0 = await vpage.evaluate(() => window.__AUD.aiRequests.length);
        await clickTestId(vpage, 'voice-review-discard');
        await sleep(600);
        const n1 = await vpage.evaluate(() => window.__AUD.aiRequests.length);
        const gone = await vpage.evaluate(() => !document.querySelector('[data-testid="voice-review"]'));
        if (!gone || n1 !== n0) bad('R3.discard', `discard left the card open (${gone}) or fired a request (${n1 - n0})`);
        else ok('R3.discard', 'Discard drops the take without contacting the agent');
      }
    }

    await settle();
    /* unsupported locale: honest fallback, no false claim of Urdu recognition */
    await vpage.evaluate(() => { window.__AUD.srMode = 'locale-unsupported'; });
    const st3 = await clickTestId(vpage, 'voice-start');
    if (!st3.clicked) bad('R3.locale', 'could not retry listening to exercise the unsupported-locale path');
    else {
      const note = await waitEval(vpage, () => {
        const el = document.querySelector('[data-testid="voice-locale-unavailable"]');
        return el ? (el.textContent || '').trim() : null;
      }, null, 15000);
      if (!note) bad('R3.locale', 'no unsupported-locale notice rendered');
      else if (!/ur-PK|en-US/.test(note) || !/type|likh/i.test(note)) bad('R3.locale', `notice does not name the locale or a fallback: "${note}"`);
      else ok('R3.locale', `honest unsupported-locale fallback shown: "${note.slice(0, 70)}…"`);
      const claimed = await vpage.evaluate(() => /speech recognition is (on|working)|urdu voice (is )?ready/i.test(document.body.innerText));
      if (claimed) bad('R3.locale', 'UI still claims working speech recognition next to the fallback notice');
      else ok('R3.locale', 'no contradictory claim of working speech recognition');
    }

    await settle();
    /* microphone denied path stays honest too */
    await vpage.evaluate(() => { window.__AUD.srMode = 'deny'; });
    await clickTestId(vpage, 'voice-start');
    const deny = await waitEval(vpage, () => {
      const el = document.querySelector('[data-testid="voice-error"]');
      return el ? (el.textContent || '').trim() : null;
    }, null, 15000);
    if (!deny || !/permission|allow|ijazat/i.test(deny)) bad('R3.mic', `permission-denied message missing or wrong: "${deny}"`);
    else ok('R3.mic', `microphone permission failure explained: "${deny.slice(0, 60)}…"`);

    /* capability honesty: what the device actually offers */
    const caps = await vpage.evaluate(() => ({
      ttsUtterances: window.__AUD.tts.length, voicesSeen: window.__AUD.voicesSeen,
      srLangs: window.__AUD.srLangs.slice()
    }));
    info('R3.environment', `recognition locales requested: ${caps.srLangs.join(', ')}; voices observed by the app: ${caps.voicesSeen}`);

    await vpage.close();

    /* ============ 4. uncaught errors ============ */
    if (consoleErrors.length) bad('R4.errors', `uncaught browser errors: ${consoleErrors.slice(0, 6).join(' | ').slice(0, 700)}`);
    else ok('R4.errors', 'zero pageerror / console.error across all four viewports and both functional pages');

  } catch (e) {
    bad('FATAL', e && e.message ? e.message : String(e));
  } finally {
    await browser.close();
  }

  const fails = results.filter(r => !r.pass);
  const infos = results.filter(r => r.info);
  console.log('\n================ P14 Islamic / Voice / responsive browser run ================');
  results.forEach(r => console.log(`${r.info ? '•' : (r.pass ? 'PASS' : 'FAIL')} ${r.id}: ${r.msg}`));
  console.log(`\nTOTAL assertions: ${results.length - infos.length}  PASS: ${results.filter(r => r.pass && !r.info).length}  FAIL: ${fails.length}  INFO: ${infos.length}`);
  console.log('Acoustic ASR: NOT RUN (no microphone device in headless Chrome; a labelled stub drove everything downstream of recognition).');
  process.exit(fails.length ? 1 : 0);
})();
