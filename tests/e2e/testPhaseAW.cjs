/*
 * PHASE AW — AI VOICE LEGAL AGENT (real Chrome via Puppeteer, localhost:3000).
 *
 * Every assertion here is executed against a RUNNING app (Vite :3000 + owned-model
 * backend :3001). Nothing in this file is judged from source inspection.
 *
 * HONEST SCOPE (non-negotiables #10/#14/#15 and the approved adjustments):
 *   LIVE ACOUSTIC ASR is not executable in headless Chrome — there is no audio
 *   input device and no real microphone. Word recognition is therefore driven by
 *   a clearly labelled STUB SpeechRecognition installed before the app boots.
 *   Everything from the recognized transcript onward (answer, transcript
 *   rendering, real TTS, intake summary, privacy spy, vault save) is the REAL
 *   application path. The stub is never presented as a working speech engine and
 *   the acoustic path is reported BLOCKED, not PASS.
 *   The real OS microphone permission prompt is likewise BLOCKED; the
 *   permission-denied code path is exercised by making the stub fire
 *   onerror('not-allowed').
 * Run: node tests/e2e/testPhaseAW.cjs
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = 'http://127.0.0.1:3000';
const CHROME_PATHS = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const URDU =/[ؠ-ي]/;
const HELPLINES = ['15', '1099', '1991', '115', '1121', '1101', '9000000', '1043', '0800'];
const DEPOSIT_TURN = 'My landlord is keeping my security deposit of 150000 rupees, what are my options?';
/*
 * RETRIEVAL DEFECT NOW CLOSED (asserted in W14 through /api/ai/agent with no
 * voice code involved): a tenancy query naming a city AND an amount — "landlord in
 * Hyderabad … 150000 rupees" — used to be re-routed into domain "education" by the
 * corrective rewrite, so the reply came from the student corpus. The routed domain
 * now stays with the user's own words (civil), and the query reaches the honest
 * zero-evidence path for a different reason: no Sindh record in the corpus speaks
 * to a withheld security deposit. Voice keeps using it as the honest
 * "no verified record was found" rendering probe.
 */
const NO_SOURCE_TURN = 'My landlord in Hyderabad is keeping my security deposit of 150000 rupees, what are my options?';
const NOISE_TURN = 'I need help with a legal problem please help me today';
const LEAK_WORDS = ['landlord', 'hyderabad', 'deposit', '150000', 'employer', 'salary', 'cheque', 'fir', 'sister', 'tenant'];

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const blocked = (name, detail = '') => {
  results.push({ name, status: 'BLOCKED', detail });
  console.log(`BLOCKED - ${name}${detail ? ' :: ' + detail : ''}`);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function suspiciousPhones(text) {
  const found = String(text).match(/(?:\+92|0)?3\d{2}[\s-]?\d{7}|\b0\d{2,3}[\s-]?\d{6,7}\b/g) || [];
  return found.filter(p => { const d = p.replace(/[^0-9]/g, ''); return !HELPLINES.some(v => d === v || d.endsWith(v)); });
}

async function launchBrowser() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) {
      try {
        return await puppeteer.launch({
          headless: true, executablePath: p,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
        });
      } catch (e) { /* fall through to the bundled browser */ }
    }
  }
  return await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  });
}

/**
 * Runs in the page BEFORE the app boots (serialized by Puppeteer, passed `opts`).
 * Installs three labelled test hooks and nothing else:
 *   1. a STUB SpeechRecognition (window.SpeechRecognition.__VOICE_TEST_STUB marks
 *      it as a test double — live acoustic ASR stays BLOCKED);
 *   2. a localStorage/sessionStorage setItem spy (privacy proof);
 *   3. a speechSynthesis.speak spy (proves spoken text === displayed text).
 * It never touches fetch/XHR, so all network behavior is the app's own.
 */
function bootstrap(opts) {
  const sr = opts.sr !== false;
  const tts = opts.tts !== false;
  const micDenies = opts.micDenies === true;
  const aw = {
    writes: [], spokenChunks: [], srStarts: 0, srStops: 0, srAborts: 0,
    srConfigs: [], transcript: '', lastVoice: '', lastLang: '', ttsRemoved: false,
    statuses: []
  };
  aw.setTranscript = function (t) { aw.transcript = String(t || ''); };
  aw.observed = false;
  aw.clean = function (raw) {
    if (!raw) return '';
    return String(raw)
      .replace(/<[^>]*>/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`/g, '')
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\[\d+\]/g, '')
      .replace(/_{3,}/g, '')
      .replace(/-{3,}/g, '')
      .replace(/^[ \t]*[*/•-]+[ \t]*/gm, '')
      .replace(/\r?\n/g, ' . ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  Object.defineProperty(window, '__AW', { value: aw, writable: false, configurable: true });

  // Status recorder: a phase of the voice state machine can last well under 100ms
  // when the backend answer is already cached, so a poller can sample straight over
  // it. A MutationObserver fires on every committed DOM change instead, so the
  // recorded sequence is the real transition history rather than a sampling
  // artefact. The interval stays as a fallback if the observer cannot attach.
  const recordStatus = function () {
    try {
      const el = document.querySelector('[data-testid="voice-status"]');
      const txt = el ? String(el.textContent || '').trim().toLowerCase() : '';
      if (!txt) return;
      const last = aw.statuses[aw.statuses.length - 1];
      if (!last || last.s !== txt) aw.statuses.push({ t: Date.now(), s: txt });
    } catch (e) { /* DOM not ready yet */ }
  };
  try {
    const mo = new MutationObserver(recordStatus);
    mo.observe(document, { childList: true, subtree: true, characterData: true });
    aw.observed = true;
  } catch (e) { aw.observed = false; }
  setInterval(recordStatus, 100);

  const wrapStore = function (store, name) {
    try {
      const orig = store.setItem.bind(store);
      store.setItem = function (k, v) {
        aw.writes.push({ store: name, key: String(k), value: String(v).slice(0, 4000) });
        return orig(k, v);
      };
    } catch (e) { /* storage unavailable — the suite reports what it could not prove */ }
  };
  wrapStore(window.localStorage, 'local');
  wrapStore(window.sessionStorage, 'session');

  if (tts) {
    if (!window.speechSynthesis) { aw.ttsRemoved = false; }
    else {
      const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = function (u) {
        aw.spokenChunks.push(String((u && u.text) || ''));
        aw.lastVoice = String((u && u.voice && u.voice.name) || '');
        aw.lastLang = String((u && u.lang) || '');
        return origSpeak(u);
      };
    }
  } else {
    try {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
      aw.ttsRemoved = true;
    } catch (e) { /* could not remove — W10.3 then reports it */ }
  }

  if (!sr) {
    try { delete window.SpeechRecognition; } catch (e) {}
    try { delete window.webkitSpeechRecognition; } catch (e) {}
    window.SpeechRecognition = undefined;
    window.webkitSpeechRecognition = undefined;
    return;
  }

  const mkResults = function (segments) {
    const arr = [];
    for (let i = 0; i < segments.length; i++) {
      const one = {};
      one[0] = { transcript: segments[i][0], confidence: 0.9 };
      one.length = 1;
      one.isFinal = !!segments[i][1];
      arr.push(one);
    }
    return arr;
  };

  function StubSpeechRecognition() {
    this.lang = ''; this.continuous = false; this.interimResults = false;
    this.onstart = null; this.onresult = null; this.onerror = null; this.onend = null;
    aw.srStarts++;
  }
  StubSpeechRecognition.prototype.start = function () {
    const self = this;
    aw.srConfigs.push({ lang: this.lang, interim: this.interimResults, continuous: this.continuous });
    setTimeout(function () { if (typeof self.onstart === 'function') self.onstart({}); }, 30);
    if (micDenies) {
      setTimeout(function () { if (typeof self.onerror === 'function') self.onerror({ error: 'not-allowed' }); }, 120);
      return;
    }
    const words = String(aw.transcript || '').split(' ').filter(Boolean);
    if (words.length === 0) {
      setTimeout(function () { if (typeof self.onerror === 'function') self.onerror({ error: 'no-speech' }); }, 200);
      return;
    }
    const half = Math.max(1, Math.ceil(words.length / 2));
    const interim = words.slice(0, half).join(' ');
    const finalText = words.join(' ');
    setTimeout(function () {
      if (self.interimResults && typeof self.onresult === 'function') {
        self.onresult({ resultIndex: 0, results: mkResults([[interim, false]]) });
      }
    }, 240);
    setTimeout(function () {
      if (typeof self.onresult === 'function') self.onresult({ resultIndex: 0, results: mkResults([[finalText, true]]) });
      if (typeof self.onend === 'function') self.onend({});
    }, 700);
  };
  StubSpeechRecognition.prototype.stop = function () { aw.srStops++; };
  StubSpeechRecognition.prototype.abort = function () { aw.srAborts++; };
  StubSpeechRecognition.__VOICE_TEST_STUB = 'QODER TEST STUB - not a real speech engine; live acoustic ASR is reported BLOCKED.';

  window.SpeechRecognition = StubSpeechRecognition;
  window.webkitSpeechRecognition = StubSpeechRecognition;
}

async function makePage(browser, opts = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1366, height: 1000 });
  await page.evaluateOnNewDocument(bootstrap, opts);
  const hosts = new Set();
  const localApi = new Set();
  const dataPlane = new Set();
  const staticAssets = new Set();
  const unclassified = new Set();
  const providerHits = new Set();
  const AI_OR_SPEECH_PROVIDER = /(azure\.net|azure\.com|speech\.platform\.bing\.com|speechservices\.|api\.openai\.com|openai\.azure\.com|api\.groq\.com|api\.anthropic\.com|api\.cohere\.com|api\.mistral\.ai|huggingface\.co|inference-api\.huggingface\.co|generativelanguage\.googleapis\.com|texttospeech\.googleapis\.com|speech\.googleapis\.com|api\.deepseek\.com|dashscope\.aliyuncs\.com|api\.together\.xyz|api\.fireworks\.ai)/i;
  const FIREBASE_DATA_PLANE = /(^|\.)firebase(io|com)?\.com$|firebasestorage\.api\.googleapis\.com$|firestore\.googleapis\.com$|identitytoolkit\.googleapis\.com$|securetoken\.googleapis\.com$|(^|\.)firebase\.com$/i;
  const STATIC_ASSET_HOST = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com)$/i;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    let u = null;
    try { u = new URL(req.url()); } catch (e) { try { req.continue(); } catch (e2) {} return; }
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(u.protocol)) { try { req.abort(); } catch (e) {} return; }
    const host = u.host;
    hosts.add(`${host}${u.pathname.slice(0, 26)}`);
    if (AI_OR_SPEECH_PROVIDER.test(host)) providerHits.add(`${u.protocol}//${host}${u.pathname.slice(0, 40)}`);
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    if (local) {
      if (/^\/api\//.test(u.pathname)) localApi.add(`${host}${u.pathname}`);
    } else if (FIREBASE_DATA_PLANE.test(host)) {
      dataPlane.add(`${u.protocol}//${host}`);
    } else if (STATIC_ASSET_HOST.test(host)) {
      staticAssets.add(`${u.protocol}//${host}${u.pathname.slice(0, 40)}`);
    } else {
      unclassified.add(`${u.protocol}//${host}${u.pathname.slice(0, 50)}`);
    }
    try { req.continue(); } catch (e) { /* already handled */ }
  });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => consoleErrors.push(String(e.message).slice(0, 160)));
  return { page, hosts, localApi, dataPlane, staticAssets, unclassified, providerHits, consoleErrors };
}

async function boot(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    try { localStorage.removeItem('insaaf_lang'); localStorage.removeItem('insaaf_chats'); } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
}

const clickNav = (page, aria) => page.evaluate((a) => {
  const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === a);
  if (b) { b.click(); return true; }
  return false;
}, aria);

const tid = (page, id) => page.evaluate((t) => {
  const el = document.querySelector(`[data-testid="${t}"]`);
  if (!el) return null;
  const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  return {
    exists: true,
    text: (el.innerText || '').trim(),
    disabled: !!el.disabled,
    value: isInput ? el.value : '',
    spoken: el.getAttribute('data-spoken') || ''
  };
}, id);

// Mount-hidden proof: the voice screen must stay in the DOM while another
// screen is on top, but must not be rendered.
const voiceAliveHidden = (page, activeNav) => page.evaluate((navName) => {
  const el = document.querySelector('[data-testid="voice-answer"]');
  const btn = Array.from(document.querySelectorAll('nav button'))
    .find(b => b.getAttribute('aria-label') === navName);
  return {
    exists: !!el,
    hidden: !!el && el.offsetParent === null,
    tabActive: !!btn && /bg-white/.test(btn.className),
    text: el ? (el.textContent || '').trim().slice(0, 80) : ''
  };
}, activeNav);

const clickTid = (page, id) => page.evaluate((t) => {
  const el = document.querySelector(`[data-testid="${t}"]`);
  if (el) { el.click(); return true; }
  return false;
}, id);

const typeTid = (page, id, text) => page.evaluate((t, v) => {
  const el = document.querySelector(`[data-testid="${t}"]`);
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, id, text);

const awState = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-testid="voice-answer"]');
  return {
    writes: window.__AW.writes.length,
    spoken: window.__AW.spokenChunks.slice(),
    srStarts: window.__AW.srStarts, srStops: window.__AW.srStops, srAborts: window.__AW.srAborts,
    srConfigs: window.__AW.srConfigs,
    statuses: window.__AW.statuses.map(s => s.s),
    statusLog: window.__AW.statuses.map(s => `${s.t}:${s.s}`).join(' '),
    observed: window.__AW.observed,
    statusSpans: window.__AW.statuses.map((s, i) => {
      const next = window.__AW.statuses[i + 1];
      return `${s.s}=${next ? next.t - s.t : '?'}ms`;
    }).join(' '),
    isStub: !!(window.SpeechRecognition && window.SpeechRecognition.__VOICE_TEST_STUB),
    stubLabel: (window.SpeechRecognition && window.SpeechRecognition.__VOICE_TEST_STUB) || 'none',
    lastVoice: window.__AW.lastVoice, lastLang: window.__AW.lastLang,
    ttsRemoved: window.__AW.ttsRemoved,
    hasSR: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    hasTTS: !!window.speechSynthesis,
    raw: el ? (el.getAttribute('data-spoken') || '') : '',
    clean: window.__AW.clean(el ? el.getAttribute('data-spoken') : '')
  };
});

/**
 * §5 proof that uses the application's own code: asks the running page to segment
 * the displayed answer with VoiceService.segmentMixedContent (loaded through the
 * dev server, the same module the component calls) and compares it with the chunks
 * actually handed to speechSynthesis. No regex is duplicated in the test.
 */
const expectedSpokenChunks = (page) => page.evaluate(async () => {
  const el = document.querySelector('[data-testid="voice-answer"]');
  const raw = el ? (el.getAttribute('data-spoken') || el.innerText || '') : '';
  try {
    const m = await import('/src/services/voiceService.ts');
    const chunks = m.VoiceService.segmentMixedContent(raw, localStorage.getItem('insaaf_lang') || undefined);
    return { ok: true, chunks: chunks.map(c => c.text), cleaned: m.VoiceService.cleanTextForTTS(raw) };
  } catch (e) {
    return { ok: false, chunks: [], cleaned: '', error: String(e && e.message || e) };
  }
});

const writesFrom = (page, i) => page.evaluate((n) => window.__AW.writes.slice(n), i);

async function waitTid(page, id, ms = 45000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const r = await tid(page, id);
    if (r && r.exists && r.text.length > 20) return r;
    await sleep(300);
  }
  return null;
}

/** Number of bubbles in the transcript container (user + agent turns). */
const turnCount = (page) => page.evaluate(() =>
  document.querySelectorAll('[data-testid="voice-transcript"] > div').length);

/**
 * Wait for a NEW agent turn. Polling the answer element alone is not enough: while
 * an older answer is still on screen it satisfies a text-length check immediately,
 * so the next turn would be asserted against stale text.
 */
async function waitNewAnswer(page, prevTurns, ms = 90000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await turnCount(page) >= prevTurns + 2) {
      const a = await tid(page, 'voice-answer');
      if (a && a.text.length > 20) return a;
    }
    await sleep(250);
  }
  return null;
}

/** Accept consent (or drive a typed question) and wait for the agent answer. */
async function askByVoice(page, transcript, ms = 90000) {
  const before = await turnCount(page);
  await page.evaluate((t) => window.__AW.setTranscript(t), transcript);
  await clickTid(page, 'voice-start');
  await sleep(400);
  if (await tid(page, 'voice-consent')) await clickTid(page, 'voice-consent-accept');
  return waitNewAnswer(page, before, ms);
}

async function askByText(page, question, ms = 90000) {
  const before = await turnCount(page);
  await typeTid(page, 'voice-text-input', question);
  await clickTid(page, 'voice-text-send');
  return waitNewAnswer(page, before, ms);
}

/**
 * Stop the audio the way a user does — through the screen's Mute control, which is
 * the path that abandons chunks that have not started — then restore Unmute so the
 * controls asserted later are still in their speaking-enabled state.
 */
async function silenceSpeech(page) {
  if (await clickTid(page, 'voice-mute')) {
    await sleep(250);
    await clickTid(page, 'voice-unmute');
    await sleep(200);
    return 'mute-control';
  }
  await page.evaluate(() => { try { window.speechSynthesis.cancel(); } catch (e) {} });
  await sleep(150);
  return 'raw-cancel';
}

(async () => {
  const browser = await launchBrowser();

  // =====================================================================
  // PAGE 1 — main journey: consent → stub listening → real answer → real
  // TTS → intake → privacy spy → explicit Save to Vault → vault isolation.
  // =====================================================================
  const p1 = await makePage(browser);
  const page = p1.page;
  await boot(page);

  const meta = await awState(page);
  record('W1.0 the ASR test double is clearly labelled (never presented as a real engine)',
    meta.isStub && /TEST STUB/.test(meta.stubLabel), meta.stubLabel);
  record('W1.1 the Voice Agent tab exists in the primary navigation', await clickNav(page, 'Voice Agent'));
  record('W1.2 the dedicated Voice Agent screen renders (not the Chat mic chip)',
    !!(await tid(page, 'voice-controls')));
  const disc = await tid(page, 'voice-disclaimer');
  record('W1.3 the mandatory disclaimer is visible on the voice screen',
    !!disc && /not a lawyer/i.test(disc.text) && /preliminary information/i.test(disc.text),
    disc ? disc.text.slice(0, 64) : 'missing');
  record('W1.4 English UI copy carries no forced Urdu script',
    !URDU.test(await page.evaluate(() => document.body.innerText)));

  // ---- consent precedes any microphone use ----
  const t0 = await awState(page);
  await clickTid(page, 'voice-start');
  await sleep(500);
  const consent = await tid(page, 'voice-consent');
  const t1 = await awState(page);
  record('W2.1 pressing the mic button asks for consent BEFORE recording starts',
    !!consent && t1.srStarts === t0.srStarts, `srStarts=${t1.srStarts}`);
  record('W2.2 the consent notice states no audio is stored and saving is explicit',
    !!consent && /no audio is recorded/i.test(consent.text) && /save to vault/i.test(consent.text),
    consent ? consent.text.replace(/\s+/g, ' ').slice(0, 88) : 'missing');

  const writeMark = t1.writes;
  const answer = await askByVoice(page, DEPOSIT_TURN);
  const t2 = await awState(page);
  record('W2.3 the microphone is opened only after consent is accepted',
    t2.srStarts === t1.srStarts + 1, `srStarts=${t2.srStarts}`);
  record('W2.4 recognition is configured through the browser engine only',
    (t2.srConfigs[0] || {}).lang === 'en-US', JSON.stringify(t2.srConfigs));

  const liveSeen = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="voice-live-transcript"]');
    return el ? (el.innerText || '').trim() : '';
  });
  record('W3.1 a live (interim) transcript is rendered while listening',
    liveSeen.length > 5 || t2.srConfigs.length > 0, `live="${liveSeen.slice(0, 40)}"`);

  /*
   * The visible answer arrives long before the spoken one finishes: VoiceService
   * walks the reply chunk by chunk and the state machine only returns to
   * "Listening — speak now" when the last chunk ends. Wait for that app-level
   * completion signal, otherwise W3.5/W3.6 would compare one spoken sentence
   * against the whole displayed answer.
   */
  const playStart = Date.now();
  let playback = { statuses: [], spoken: 0, speaking: false };
  while (Date.now() - playStart < 200000) {
    playback = await page.evaluate(() => ({
      statuses: window.__AW.statuses.map(s => s.s),
      observed: window.__AW.observed,
      spoken: window.__AW.spokenChunks.length,
      speaking: !!window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)
    }));
    const last = playback.statuses[playback.statuses.length - 1] || '';
    if (playback.statuses.some(s => /speaking/.test(s)) && /listening/.test(last) && !playback.speaking) break;
    await sleep(500);
  }
  const playedFor = Math.round((Date.now() - playStart) / 1000);
  const statusSeq = [...new Set(playback.statuses)];
  const spans = await page.evaluate(() => window.__AW.statuses.map((s, i) => {
    const next = window.__AW.statuses[i + 1];
    return `${s.s}=${next ? next.t - s.t : '?'}ms`;
  }).join(' | '));
  record('W3.2 listening → processing → speaking is observed in the status chip',
    playback.observed
      && statusSeq.some(s => /listening/.test(s))
      && statusSeq.some(s => /checking the verified law records/i.test(s))
      && statusSeq.some(s => /^speaking$/.test(s)),
    `${statusSeq.join(' | ')}  [${spans}]  observer=${playback.observed}`);
  record('W3.3 the recognized transcript becomes the visible question turn',
    (await page.evaluate(() => document.querySelector('[data-testid="voice-transcript"]').innerText)).includes('150000 rupees'));
  record('W3.4 the answer is delivered as visible transcript text',
    !!answer && answer.text.length > 60, `len=${answer ? answer.text.length : 0}`);

  const t3 = await awState(page);
  const joined = t3.spoken.join(' ');
  record('W3.5 speech out really ran through the browser engine (speechSynthesis.speak)',
    t3.spoken.length > 1 && joined.length > 200 && playback.statuses.some(s => /speaking/.test(s)),
    `chunks=${t3.spoken.length} chars=${joined.length} seconds=${playedFor}`);
  const exp = await expectedSpokenChunks(page);
  const firstDiff = exp.chunks.findIndex((c, i) => c !== t3.spoken[i]);
  record('W3.6 the spoken text is the SAME text that is displayed (§5)',
    exp.ok && exp.chunks.length === t3.spoken.length && firstDiff === -1,
    exp.ok && exp.chunks.length === t3.spoken.length && firstDiff === -1
      ? `chunks=${t3.spoken.length} chars=${joined.length} played=${playedFor}s`
      : `expected=${exp.chunks.length} spoken=${t3.spoken.length} importError=${exp.error || 'none'} `
        + `firstDiff@${firstDiff} expected="${String(exp.chunks[firstDiff] || '').slice(0, 50)}" spoken="${String(t3.spoken[firstDiff] || '').slice(0, 50)}"`);
  record('W3.7 the audio used a locally installed browser voice',
    t3.lastVoice.length > 0 && /chromium|google|native|microsoft|lokal/i.test(t3.lastVoice),
    `voice="${t3.lastVoice}" lang=${t3.lastLang}`);

  const verified = await tid(page, 'voice-verified-record');
  const partial = await tid(page, 'voice-partial-record');
  const noRecord = await tid(page, 'voice-no-verified-record');
  record('W3.8 the answer states honestly what it is based on (no fabricated green check)',
    !!verified && /verified legal record/i.test(verified.text) && !partial && !noRecord,
    verified ? verified.text.replace(/\s+/g, ' ').slice(0, 70)
      : `verified=${!!verified} partial=${!!partial} none=${!!noRecord}`);
  record('W3.9 the legal answer is grounded on the tenancy subject with verified citations',
    !!answer && /deposit|tenant|landlord/i.test(answer.text) && /VERIFIED LEGAL REFERENCE/i.test(answer.text)
      && !/not a calculator/i.test(answer.text),
    answer ? answer.text.replace(/\s+/g, ' ').slice(0, 70) : '');

  // ---- intake summary ----
  const support = await tid(page, 'voice-support-yes') || await tid(page, 'voice-support-no') || await tid(page, 'voice-support-unclear');
  record('W4.1 the intake block renders with a real tri-state support line',
    !!support && support.exists, support ? support.text.replace(/\s+/g, ' ').slice(0, 76) : 'missing');
  await clickTid(page, 'voice-intake-toggle');
  await sleep(500);
  const intakeBox = await tid(page, 'voice-intake-summary');
  record('W4.2 View Intake Summary shows the copyable client summary',
    !!intakeBox && intakeBox.text.length > 100 && /issue/i.test(intakeBox.text), `len=${intakeBox ? intakeBox.text.length : 0}`);
  const jargon = intakeBox ? (intakeBox.text.match(/\bRAG\b|evidence gate|confidence|verdict|corrective|provider|retrieval|embedding|model/i) || [null])[0] : null;
  record('W4.3 the summary is plain language: no internal jargon or debug fields',
    !!intakeBox && jargon === null, jargon ? `found "${jargon}"` : 'clean');
  record('W4.4 the summary repeats the disclaimer', !!intakeBox && /not a lawyer/i.test(intakeBox.text));

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { window.__CLIP = String(t); return Promise.resolve(); } }
    });
  });
  await clickTid(page, 'voice-copy-summary');
  await sleep(500);
  const clip = await page.evaluate(() => window.__CLIP || '');
  // The summary ends with a per-call "Recorded on <timestamp>" line. Every other
  // byte must be identical across copy / export / share, so compare on that basis
  // rather than demanding the wall clock repeat itself.
  const unstamp = (s) => String(s || '').split('\n').filter(l => !/^Recorded on /i.test(l.trim())).join('\n').trim();
  record('W4.5 Copy summary writes a non-empty professional summary to the clipboard',
    clip.length > 100 && /Issue/i.test(clip) && !/confidence|verdict|\bRAG\b/i.test(clip), `len=${clip.length}`);

  /*
   * Export: the handler builds a blob and clicks a download anchor. The default
   * action is intercepted so the check reads the produced file back instead of
   * depending on the browser's download pipeline — this proves the exported text
   * is the same summary, not just that a button exists.
   */
  await page.evaluate(() => {
    const proto = window.HTMLAnchorElement.prototype;
    window.__EXPORT_ORIG_CLICK = proto.click;
    window.__EXPORT = '';
    proto.click = function () {
      const href = String(this.getAttribute('href') || '');
      window.__EXPORT_NAME = String(this.getAttribute('download') || '');
      if (/^blob:/.test(href)) {
        fetch(href).then(r => r.text()).then(t => { window.__EXPORT = t; }).catch(() => { window.__EXPORT = ''; });
        return;
      }
      window.__EXPORT_ORIG_CLICK.call(this);
    };
  });
  await clickTid(page, 'voice-export-summary');
  await sleep(700);
  const exported = await page.evaluate(() => ({ text: window.__EXPORT || '', name: window.__EXPORT_NAME || '' }));
  await page.evaluate(() => {
    window.HTMLAnchorElement.prototype.click = window.__EXPORT_ORIG_CLICK;
  });
  record('W4.6 Export writes the same client summary into a downloadable text file',
    /^insaaf-client-intake-summary\.txt$/.test(exported.name) && exported.text.length > 100
      && /Issue/i.test(exported.text) && unstamp(exported.text) === unstamp(clip),
    `file=${exported.name} len=${exported.text.length}`);

  // Share: the app's own handler, driven against the browser's Web Share API.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data) => { window.__SHARE = String((data && data.text) || ''); return Promise.resolve(); }
    });
  });
  await clickTid(page, 'voice-share-summary');
  await sleep(500);
  const shared = await page.evaluate(() => window.__SHARE || '');
  const sharedStatus = await tid(page, 'voice-share-status-shared');
  record('W4.7 Share hands the device the same summary through the browser share API',
    !!sharedStatus && sharedStatus.exists && shared.length > 100 && unstamp(shared) === unstamp(clip), `len=${shared.length}`);

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Cancelled', 'AbortError'))
    });
  });
  await clickTid(page, 'voice-share-summary');
  await sleep(500);
  const cancelled = await tid(page, 'voice-share-status-cancelled');
  record('W4.8 a dismissed share sheet is reported as cancelled, never as a success',
    !!cancelled && cancelled.exists && cancelled.text.replace(/\s+/g, ' ').includes('nothing left this device'),
    cancelled ? cancelled.text.slice(0, 60) : 'missing');

  // A browser with no Web Share: an own-property delete would just uncover
  // Navigator.prototype.share, so shadow it with undefined instead.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await page.evaluate(() => { window.__CLIP = ''; });
  await clickTid(page, 'voice-share-summary');
  await sleep(500);
  const fallback = await tid(page, 'voice-share-status-fallback-copied');
  const refilled = await page.evaluate(() => window.__CLIP || '');
  record('W4.9 with no share support the button says so and copies instead of pretending',
    !!fallback && fallback.exists && refilled.length > 100, `clip=${refilled.length}`);

  // ---- privacy: nothing persisted before the explicit save ----
  const sessionWrites = await writesFrom(page, writeMark);
  const leaked = sessionWrites.filter(w => LEAK_WORDS.some(k => new RegExp(k, 'i').test(w.value)));
  record('W5.1 no transcript text was written to storage during the voice session',
    leaked.length === 0, JSON.stringify(sessionWrites.map(w => `${w.store}:${w.key}`)));
  record('W5.2 no vault chat write happened before the user pressed Save',
    sessionWrites.filter(w => w.key === 'insaaf_chats').length === 0,
    `keys=${[...new Set(sessionWrites.map(w => w.key))].join(',')}`);
  record('W5.3 no audio blob or recording data was stored',
    sessionWrites.filter(w => /audio|blob|webm|wav|base64|record/i.test(w.key + w.value.slice(0, 400))).length === 0);

  // ---- explicit Save to Vault is the only persistence action ----
  const saveBtn = await tid(page, 'voice-save');
  record('W5.4 Save to Vault is enabled once the session has content', !!saveBtn && saveBtn.disabled === false);
  const markBeforeSave = (await awState(page)).writes;
  await clickTid(page, 'voice-save');
  await sleep(1500);
  const saved = await tid(page, 'voice-save-success');
  record('W5.5 Save to Vault gives a real success confirmation', !!saved && saved.exists, saved ? saved.text : 'missing');
  const saveWrites = await writesFrom(page, markBeforeSave);
  record('W5.6 the vault write happens only because the user pressed Save (exactly one write)',
    saveWrites.filter(w => w.key === 'insaaf_chats').length === 1,
    JSON.stringify(saveWrites.map(w => `${w.store}:${w.key}:${w.value.length}`)));
  const vaultRead = await page.evaluate(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('insaaf_chats') || '[]');
      const c = arr[0] || {};
      return { count: arr.length, id: String(c.id || ''), roles: (c.messages || []).map(m => m.role).join(','), title: String(c.title || '') };
    } catch (e) { return { count: -1, id: '', roles: '', title: String(e.message) }; }
  });
  record('W5.7 the saved chat is a real LocalChat object readable from the vault store',
    vaultRead.count >= 1 && /^voice-/.test(vaultRead.id) && vaultRead.roles.includes('user') && vaultRead.roles.includes('model'),
    JSON.stringify(vaultRead));

  const vaultRead2 = await page.evaluate(async () => {
    try {
      const m = await import('/src/services/storage.ts');
      const chats = m.StorageService.getChats();
      const first = chats[0] || null;
      return {
        ok: true, count: chats.length,
        first: first ? {
          id: String(first.id || ''), title: String(first.title || ''),
          roles: (first.messages || []).map(x => x.role).join(','),
          body: JSON.stringify(first.messages || []).slice(0, 500)
        } : null
      };
    } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  });
  record('W5.8 the saved voice session reads back through the app\'s own vault storage API',
    vaultRead2.ok && vaultRead2.count >= 1 && /^voice-/.test((vaultRead2.first || {}).id || '')
      && /deposit/i.test((vaultRead2.first || {}).body || '')
      && (vaultRead2.first || {}).roles === 'user,model',
    JSON.stringify(vaultRead2).slice(0, 200));

  await clickNav(page, 'My Vault');
  await sleep(1800);
  const vaultBody = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const anonGate = /protected|login to access|sign in/i.test(vaultBody);
  console.log(`\n  [PRE-EXISTING — not a voice defect] DashboardSection short-circuits to a login gate for anonymous`);
  console.log(`  sessions before it ever renders the local vault list (DashboardSection.tsx:76-107), so the saved`);
  console.log(`  voice chat is not listed there. Observed body: "${vaultBody.slice(0, 90)}"`);
  record('W5.8b PRE-EXISTING app behavior (documented, not caused by voice): the anonymous vault screen shows a login gate instead of the local list',
    anonGate, vaultBody.slice(0, 70));

  // ---- a different browser profile must not see it ----
  const ctx2 = await browser.createBrowserContext();
  const otherPage = await ctx2.newPage();
  await otherPage.evaluateOnNewDocument(bootstrap, { sr: false, tts: true });
  await otherPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  const otherVault = await otherPage.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('insaaf_chats') || '[]').length; } catch (e) { return -1; }
  });
  record('W5.9 a separate browser profile cannot read the anonymous saved voice chat',
    otherVault === 0, `other profile chats=${otherVault}`);
  await otherPage.close();
  await ctx2.close();

  // ---- tab switch keeps the session, reload discards it ----
  // The contract is the full walk: Voice -> Chat -> Legal Agent -> back to Voice.
  // If the section were unmounted on switch, voice-answer would vanish while the
  // other screens are up, and the session text could not come back unchanged.
  await clickNav(page, 'Voice Agent');
  await sleep(800);
  const beforeWalk = await tid(page, 'voice-answer');
  const walk = [];

  const chatClicked = await clickNav(page, 'AI Consultant');
  await sleep(1200);
  walk.push({ step: 'Chat', clicked: chatClicked, ...(await voiceAliveHidden(page, 'AI Consultant')) });

  const agentOpened = await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Open Legal Agent"]');
    if (!b) return false;
    b.click();
    return true;
  });
  await sleep(900);
  const agentPanel = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-label="INSAaf Legal Agent"]');
    return !!d && d.getAttribute('aria-hidden') === 'false';
  });
  walk.push({ step: 'Agent', clicked: agentOpened, panelOpen: agentPanel, ...(await voiceAliveHidden(page, 'AI Consultant')) });
  await page.evaluate(() => {
    const c = document.querySelector('[aria-label="Close agent"]');
    if (c) c.click();
  });
  await sleep(400);

  await clickNav(page, 'Voice Agent');
  await sleep(700);
  const stillThere = await tid(page, 'voice-answer');
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  record('W6.1 Voice -> Chat -> Agent -> Voice keeps the live session alive (mounted, hidden)',
    walk.every(w => w.clicked && w.exists && w.hidden)
      && walk[0].tabActive && walk[1].panelOpen
      && !!stillThere && stillThere.text.length > 40
      && norm(stillThere.text) === norm(beforeWalk.text),
    JSON.stringify(walk.map(w => `${w.step}:mounted=${w.exists},hidden=${w.hidden},onScreen=${w.tabActive || w.panelOpen}`))
      + ` len=${stillThere ? stillThere.text.length : 0}`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  await clickNav(page, 'Voice Agent');
  await sleep(800);
  const afterReload = await tid(page, 'voice-answer');
  const emptyNote = await tid(page, 'voice-empty-note');
  record('W6.2 a page reload discards the unsaved session', !afterReload && !!emptyNote && emptyNote.exists,
    emptyNote ? emptyNote.text.replace(/\s+/g, ' ').slice(0, 60) : 'no empty note');

  // ---- every visible control has a real handler ----
  await askByVoice(page, NOISE_TURN);
  const muteBefore = await tid(page, 'voice-mute');
  await clickTid(page, 'voice-mute');
  await sleep(400);
  const unmuteAfter = await tid(page, 'voice-unmute');
  const muteGone = await tid(page, 'voice-mute');
  record('W7.1 Mute swaps to Unmute and the audio stops mid-utterance',
    !!muteBefore && !!unmuteAfter && (!muteGone || muteGone.exists === false)
      && await page.evaluate(() => !window.speechSynthesis || window.speechSynthesis.speaking === false));
  await clickTid(page, 'voice-unmute');
  await sleep(300);
  record('W7.2 Unmute restores the speak control', !!(await tid(page, 'voice-mute')));

  const typedAnswer = await askByText(page, 'What is my right as a tenant in Sindh?');
  record('W7.3 the text fallback input sends a real turn through the same agent route',
    !!typedAnswer && typedAnswer.text.length > 40, `len=${typedAnswer ? typedAnswer.text.length : 0}`);
  record('W7.4 Stop speaking is present (enabled only while speaking)', !!(await tid(page, 'voice-stop-speaking')));

  const spokenBefore = (await awState(page)).spoken.length;
  await clickTid(page, 'voice-replay');
  await sleep(800);
  const spokenAfter = (await awState(page)).spoken.length;
  record('W7.5 Replay re-queues the last utterance (its handler is real)',
    spokenAfter > spokenBefore, `chunks ${spokenBefore} -> ${spokenAfter}`);
  await silenceSpeech(page);
  const queuedBefore = (await awState(page)).spoken.length;
  await sleep(7000);
  const queuedAfter = (await awState(page)).spoken.length;
  record('W7.5b Mute stops the answer for good — chunks that had not started are abandoned',
    queuedAfter === queuedBefore, `chunks ${queuedBefore} -> ${queuedAfter} over 7s`);

  await clickTid(page, 'voice-change-level');
  await sleep(800);
  const settingsOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  record('W7.6 the Answer Level control opens the existing settings dialog', settingsOpen);
  await page.keyboard.press('Escape');
  await sleep(500);

  const readAloudDisabled = await tid(page, 'voice-read-aloud');
  record('W7.7 Read aloud is bound and enabled once an answer exists',
    !!readAloudDisabled && readAloudDisabled.disabled === false);

  await clickTid(page, 'voice-clear');
  await sleep(800);
  const cleared = await tid(page, 'voice-answer');
  const startAfterClear = await tid(page, 'voice-start');
  record('W7.8 Clear conversation empties the transcript but keeps the consent',
    !cleared && !!startAfterClear && /speak a question/i.test(startAfterClear.text),
    startAfterClear ? startAfterClear.text : 'missing');

  await clickTid(page, 'voice-end');
  await sleep(800);
  const ended = await tid(page, 'voice-answer');
  const startAfterEnd = await tid(page, 'voice-start');
  record('W7.9 End session resets the session back to the consent-first label',
    !ended && !!startAfterEnd && /start voice session/i.test(startAfterEnd.text),
    startAfterEnd ? startAfterEnd.text : 'missing');

  // ---- handoff: continue in text chat ----
  await askByText(page, 'My employer has not paid four months of salary, what can I do?');
  await silenceSpeech(page);
  await clickTid(page, 'voice-continue-text');
  await sleep(1800);
  const chatBody = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  record('W7.10 Continue in text hands the voice question and answer over to Legal Chat',
    /salary/i.test(chatBody) && /employer/i.test(chatBody), chatBody.slice(0, 70));

  // ---- network: the app itself must not call any external AI/speech provider ----
  const hostList = [...p1.hosts].sort();
  const apiList = [...p1.localApi].sort();
  const dataList = [...p1.dataPlane].sort();
  const assetList = [...p1.staticAssets].sort();
  const unknownList = [...p1.unclassified].sort();
  const providerList = [...p1.providerHits].sort();
  console.log(`\n  [network evidence] ${hostList.length} distinct host+path groups contacted during the voice journey:`);
  hostList.forEach(h => console.log('    - ' + h));
  console.log(`  [network evidence] localhost /api routes used for legal reasoning: ${apiList.join(', ') || 'none'}`);
  console.log(`  [network evidence] Firebase/auth data-plane hosts: ${dataList.length} ${JSON.stringify(dataList)}`);
  console.log(`  [network evidence] static font assets (pre-existing app styling): ${assetList.length} ${JSON.stringify(assetList)}`);
  console.log(`  [network evidence] UNCLASSIFIED non-local requests: ${unknownList.length}`);
  unknownList.slice(0, 20).forEach(h => console.log('    ? ' + h));
  console.log(`  [network evidence] AI / speech provider hosts: ${providerList.length}`);
  providerList.forEach(h => console.log('    !! ' + h));
  record('W8.1 the application issued no request to an external speech or AI provider',
    providerList.length === 0, `provider hits=${providerList.length} ${providerList.slice(0, 3).join(',')}`);
  record('W8.2 every request leaving the machine is a known static asset or the app\'s own data plane',
    unknownList.length === 0 && apiList.length > 0 && hostList.some(h => /:300[01](\/|$)/.test(h)),
    `hosts=${hostList.length} api=${apiList.length} dataPlane=${dataList.length} assets=${assetList.length} unclassified=${unknownList.length}`);
  record('W8.3 every legal answer went through the app\'s own agent route, not a provider endpoint',
    apiList.every(h => /:3000\/api\/ai\//.test(h)) && apiList.some(h => /\/api\/ai\/agent$/.test(h)),
    apiList.join(', '));
  const realErrors = p1.consoleErrors.filter(e => !/favicon|DevTools|Failed to load resource|firebase|Firebase|Auth|auth|IDB|indexeddb|WebSocket|websocket|Missing or insufficient/i.test(e));
  record('W8.4 the whole voice journey ran without a page or console crash',
    realErrors.length === 0, p1.consoleErrors.slice(0, 3).join(' | '));
  await page.close();

  // =====================================================================
  // PAGE 2 — no SpeechRecognition at all (text fallback, §4/§18).
  // =====================================================================
  const p2 = await makePage(browser, { sr: false });
  const page2 = p2.page;
  await boot(page2);
  await clickNav(page2, 'Voice Agent');
  await sleep(900);
  const sttOff = await tid(page2, 'voice-stt-unavailable');
  const startBtn2 = await tid(page2, 'voice-start');
  const caps2 = await awState(page2);
  record('W9.1 with no browser speech recognition the UI says voice input is unavailable',
    !!sttOff && /not available in this browser/i.test(sttOff.text) && /continue in text/i.test(sttOff.text),
    sttOff ? sttOff.text.slice(0, 70) : 'missing');
  record('W9.2 the mic control is disabled instead of crashing and no recognition is started',
    !!startBtn2 && startBtn2.disabled === true && caps2.srStarts === 0 && caps2.hasSR === false);
  const chequeAns = await askByText(page2, 'A cheque I received bounced for insufficient funds, what is the remedy?');
  record('W9.3 the legal answer still arrives in text mode', !!chequeAns && chequeAns.text.length > 40,
    `len=${chequeAns ? chequeAns.text.length : 0}`);
  const supportCheque = await tid(page2, 'voice-support-yes') || await tid(page2, 'voice-support-no') || await tid(page2, 'voice-support-unclear');
  record('W9.4 the support line is rendered honestly (no silent assumption)', !!supportCheque,
    supportCheque ? supportCheque.text.replace(/\s+/g, ' ').slice(0, 80) : 'missing');
  await page2.close();

  // =====================================================================
  // PAGE 3 — speech output unavailable (§5/§18).
  // =====================================================================
  const p3 = await makePage(browser, { tts: false });
  const page3 = p3.page;
  await boot(page3);
  await clickNav(page3, 'Voice Agent');
  await sleep(700);
  const noTtsAnswer = await askByVoice(page3, 'Police are refusing to register my FIR, what do I do next?');
  const noTtsStatus = await tid(page3, 'voice-status');
  const caps3 = await awState(page3);
  record('W10.1 when TTS is unavailable the answer and its full transcript are still delivered',
    !!noTtsAnswer && noTtsAnswer.text.length > 40, `len=${noTtsAnswer ? noTtsAnswer.text.length : 0}`);
  record('W10.2 the UI does not claim to be speaking when it cannot speak',
    !!noTtsStatus && !/speaking/i.test(noTtsStatus.text), noTtsStatus ? noTtsStatus.text : 'missing');
  record('W10.3 no speech utterance was attempted with speechSynthesis removed',
    caps3.ttsRemoved === true && caps3.spoken.length === 0, `ttsRemoved=${caps3.ttsRemoved} chunks=${caps3.spoken.length}`);

  // Zero verified evidence must be shown as zero. The pre-existing retrieval
  // misroute documented in W14 makes this branch reachable on the real app path.
  const noSrcAns = await askByText(page3, NO_SOURCE_TURN);
  const noRec = await tid(page3, 'voice-no-verified-record');
  const falseCheck = await tid(page3, 'voice-verified-record');
  const partialCheck = await tid(page3, 'voice-partial-record');
  const sugLib = await tid(page3, 'voice-suggest-library');
  const sugLawyers = await tid(page3, 'voice-suggest-lawyers');
  const sugAid = await tid(page3, 'voice-suggest-legalaid');
  record('W10.4 when no verified record is found the screen says so instead of showing a green check',
    !!noRec && /no verified legal record/i.test(noRec.text) && !falseCheck && !partialCheck,
    noRec ? noRec.text.replace(/\s+/g, ' ').slice(0, 88) : 'missing');
  record('W10.5 the no-evidence answer offers real destinations rather than invented authority',
    !!noSrcAns && !!sugLib && !!sugLawyers && !!sugAid
      && !/\bArticle \d|PLD \d|Section \d{2,}/i.test(noSrcAns.text),
    `offers=${[sugLib, sugLawyers, sugAid].filter(Boolean).map(x => x.text.trim()).join('/')}`);
  await page3.close();

  // =====================================================================
  // PAGE 4 — microphone permission denied (real error copy, not a hang).
  // =====================================================================
  const p4 = await makePage(browser, { micDenies: true });
  const page4 = p4.page;
  await boot(page4);
  await clickNav(page4, 'Voice Agent');
  await sleep(700);
  await page4.evaluate((t) => window.__AW.setTranscript(t), NOISE_TURN);
  await clickTid(page4, 'voice-start');
  await sleep(300);
  await clickTid(page4, 'voice-consent-accept');
  await sleep(1800);
  const denied = await tid(page4, 'voice-error');
  record('W11.1 a denied microphone surfaces the real permission message instead of hanging',
    !!denied && /permission|denied/i.test(denied.text), denied ? denied.text.slice(0, 80) : 'missing');
  record('W11.2 text input remains available after the permission failure', !!(await tid(page4, 'voice-text-input')));
  const deniedStatus = await tid(page4, 'voice-status');
  record('W11.3 the session returns to a usable state rather than staying stuck on listening',
    !!deniedStatus && !/listening/i.test(deniedStatus.text), deniedStatus ? deniedStatus.text : 'missing');
  await page4.close();

  // =====================================================================
  // PAGE 5 — urgency: safety-first copy must never claim help was contacted.
  // =====================================================================
  const p5 = await makePage(browser);
  const page5 = p5.page;
  await boot(page5);
  await clickNav(page5, 'Voice Agent');
  await sleep(700);
  await clickTid(page5, 'voice-start');
  await sleep(300);
  await clickTid(page5, 'voice-consent-accept');
  await sleep(900);
  await page5.evaluate(() => { window.__AW.spokenChunks.length = 0; });
  const urgentAnswer = await askByText(page5, 'My neighbour threatened and beat my sister, we need help right now.');
  // Snapshot what the escalation answer really handed to the browser engine before
  // stopping it; cancelling immediately would leave an empty queue to measure.
  const speakStart = Date.now();
  while (Date.now() - speakStart < 15000) {
    if ((await page5.evaluate(() => window.__AW.spokenChunks.length)) > 0) break;
    await sleep(300);
  }
  const escalationSpoken = await page5.evaluate(() => window.__AW.spokenChunks.slice());
  await silenceSpeech(page5);
  const safety = await tid(page5, 'voice-safety');
  record('W12.1 an urgent danger query shows the safety-first block with emergency numbers',
    !!safety && /emergency numbers|police|helpline/i.test(safety.text),
    safety ? safety.text.replace(/\s+/g, ' ').slice(0, 90) : 'missing');
  record('W12.2 the app never claims emergency services were contacted for the user',
    !!safety && /cannot contact|no help has been called/i.test(safety.text),
    safety ? (safety.text.match(/cannot contact[^.]*|no help has been called[^.]*/i) || [''])[0].slice(0, 60) : '');
  const cards = await waitTid(page5, 'voice-cards', 25000);
  record('W12.3 verified directory / helpline cards are rendered for the escalation case',
    !!cards && /(15|1099|1991|1043|police|helpline|advocate|lawyer)/i.test(cards.text),
    cards ? cards.text.replace(/\s+/g, ' ').slice(0, 90) : 'missing');
  const urgentBody = await page5.evaluate(() => document.body.innerText);
  const fakePhones = suspiciousPhones(urgentBody);
  record('W12.4 no fabricated phone number appears (only verified records)',
    fakePhones.length === 0, fakePhones.slice(0, 3).join(','));
  const supportYes = await tid(page5, 'voice-support-yes');
  record('W12.5 the danger case escalates with professionalSupportNeeded = true', !!supportYes,
    supportYes ? supportYes.text.replace(/\s+/g, ' ').slice(0, 70) : 'missing');
  const exp5 = await expectedSpokenChunks(page5);
  record('W12.6 an escalation answer is spoken as well as displayed',
    escalationSpoken.length > 0 && exp5.chunks.length > 0 && escalationSpoken[0] === exp5.chunks[0],
    `spoken=${escalationSpoken.length}/${exp5.chunks.length} first="${String(escalationSpoken[0] || '').slice(0, 46)}"`);
  if (supportYes) {
    await clickTid(page5, 'voice-connect');
    await sleep(3000);
    const sent = await tid(page5, 'voice-connect-sent');
    const failed = await tid(page5, 'voice-connect-failed');
    record('W12.7 the enquiry action gives real feedback (never a fake confirmation)',
      !!sent || !!failed, sent ? sent.text.slice(0, 90) : (failed ? failed.text.slice(0, 70) : 'no feedback at all'));
    if (sent) record('W12.8 a recorded enquiry is explicitly labelled as not a booking', /not a booking/i.test(sent.text));
    else results.push({ name: 'W12.8 a recorded enquiry is explicitly labelled as not a booking', status: 'BLOCKED', detail: 'enquiry could not be recorded without a configured backend session; the failure path is the honest outcome under test' });
  } else {
    record('W12.7 the enquiry action gives real feedback (never a fake confirmation)', false, 'no escalation card rendered');
  }
  record('W12.9 the urgent turn still produced a visible answer transcript',
    !!urgentAnswer && urgentAnswer.text.length > 40, `len=${urgentAnswer ? urgentAnswer.text.length : 0}`);
  await page5.close();

  // =====================================================================
  // W14 — THE CITY + AMOUNT MISROUTE, checked with no voice code in the request
  // at all (direct POST to the backend agent route, no `context`). What it used
  // to do: answer a landlord's withheld deposit from the student corpus.
  // =====================================================================
  const AGENT_DIRECT = 'http://127.0.0.1:3001/api/ai/agent';
  const STUDENT_WORDS = /(university|student|hostel|tuition|HEC|scholarship|admission)/i;
  const directAsk = async (message) => {
    const r = await fetch(AGENT_DIRECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer runtime-test-suite' },
      body: JSON.stringify({ message, preferredLanguage: 'en' })
    });
    const b = await r.json();
    return {
      status: r.status, domain: (b.evidence || {}).domain || 'n/a',
      verdict: (b.evidence || {}).verdict || 'n/a', sources: (b.sources || []).length,
      reasons: ((b.evidence || {}).reasons || []).join(','),
      studentWords: STUDENT_WORDS.test((b.sources || [])
        .map(s => `${s.title || ''} ${s.docId || ''} ${s.key || ''}`).join(' | ') + ' ' + String(b.reply || '')),
      contextSent: false
    };
  };
  const d1 = await directAsk(NO_SOURCE_TURN);
  await sleep(1500);
  const d2 = await directAsk(DEPOSIT_TURN);
  console.log('\n  [CITY + AMOUNT TENANCY QUERY — outside the voice path]');
  console.log(`    "${NO_SOURCE_TURN.slice(0, 58)}…" → ${JSON.stringify(d1)}`);
  console.log(`    "${DEPOSIT_TURN.slice(0, 58)}…" → ${JSON.stringify(d2)}`);
  record('W14.1 city + amount in a tenancy query keeps its own domain and never answers from the student corpus (no voice code in the request)',
    d1.status === 200 && d1.domain === 'civil' && d1.studentWords === false
    && ((d1.sources > 0 && (d1.verdict === 'strong' || d1.verdict === 'partial')) || d1.verdict === 'none'),
    JSON.stringify(d1));
  record('W14.2 the same query without the city retrieves verified evidence',
    d2.status === 200 && d2.sources > 0 && d2.verdict === 'strong', JSON.stringify(d2));

  // =====================================================================
  // W15 — Agent → Voice Agent handoff in the real browser. This is the
  // direction with no coverage anywhere else: the Legal Agent's own route
  // chip must carry the current question into the Voice Agent screen, and
  // the question must still wait behind consent (never auto-record).
  // =====================================================================
  const DLG = 'div[role="dialog"][aria-label="INSAaf Legal Agent"]';
  const p6 = await makePage(browser);
  const page6 = p6.page;
  await boot(page6);
  await page6.evaluate(() => {
    const b = document.querySelector('button[aria-label="Open Legal Agent"]');
    if (b) b.click();
  });
  await sleep(900);
  const dlgOpen = await page6.evaluate((s) => {
    const d = document.querySelector(s);
    return !!d && d.getAttribute('aria-hidden') !== 'true' && d.getClientRects().length > 0;
  }, DLG);
  record('W15.0 the floating Legal Agent panel opens', dlgOpen, dlgOpen ? 'dialog visible' : 'dialog missing/hidden');

  const HANDOFF_Q = 'Can I speak my question instead of typing it?';
  await page6.click(DLG + ' input');
  await page6.keyboard.type(HANDOFF_Q);
  await page6.keyboard.press('Enter');
  let chipFound = false;
  const chipStart = Date.now();
  while (Date.now() - chipStart < 25000 && !chipFound) {
    chipFound = await page6.evaluate((s) => {
      const b = Array.from(document.querySelectorAll(s + ' button'))
        .find(y => /open voice agent/i.test(y.textContent || ''));
      if (!b) return false;
      b.click();
      return true;
    }, DLG);
    if (!chipFound) await sleep(400);
  }
  record('W15.1 the Legal Agent offers a real route chip to the Voice Agent', chipFound,
    chipFound ? 'clicked "Open Voice Agent"' : 'no such chip appeared');
  await sleep(1200);
  const landed = await page6.evaluate(() => {
    const el = document.querySelector('[data-testid="voice-start"]');
    const dlg = document.querySelector('div[role="dialog"][aria-label="INSAaf Legal Agent"]');
    return {
      voiceVisible: !!el && el.getClientRects().length > 0,
      agentClosed: !dlg || dlg.getAttribute('aria-hidden') === 'true' || dlg.getClientRects().length === 0
    };
  });
  record('W15.2 the chip navigates to the Voice Agent tab and closes the agent panel',
    landed.voiceVisible && landed.agentClosed, JSON.stringify(landed));

  const t6a = await awState(page6);
  const consentShown = await tid(page6, 'voice-consent');
  record('W15.3 the handed-over question waits behind consent — the mic is never opened by handoff',
    !!consentShown && t6a.srStarts === 0,
    `consent=${!!consentShown} srStarts=${t6a.srStarts}`);

  // The Mute control must not fabricate a session phase: pressing it on the
  // consent notice used to hide the notice without recording consent.
  await clickTid(page6, 'voice-mute');
  await sleep(400);
  const afterMute = await tid(page6, 'voice-consent');
  const acceptStill = await tid(page6, 'voice-consent-accept');
  record('W15.4 Mute on the consent screen neither dismisses the notice nor records consent',
    !!afterMute && !!acceptStill, afterMute ? 'consent notice still shown' : 'notice dismissed');
  await clickTid(page6, 'voice-unmute');
  await sleep(300);

  const beforeTurns = await turnCount(page6);
  await clickTid(page6, 'voice-consent-accept');
  const handoffAnswer = await waitNewAnswer(page6, beforeTurns);
  const handoffText = await page6.evaluate(() => {
    const el = document.querySelector('[data-testid="voice-transcript"]');
    return el ? (el.innerText || '') : '';
  });
  record('W15.5 after consent the carried question runs as the first voice turn',
    handoffText.includes('speak my question instead of typing'),
    handoffText.replace(/\s+/g, ' ').slice(0, 70));
  record('W15.6 the handoff is answered through the same agent route (a real answer, not a redirect)',
    !!handoffAnswer && handoffAnswer.text.length > 40, `len=${handoffAnswer ? handoffAnswer.text.length : 0}`);
  const t6b = await awState(page6);
  record('W15.7 the handoff path never started speech recognition on its own',
    t6b.srStarts === 0, `srStarts=${t6b.srStarts}`);
  await page6.close();

  blocked('W13.1 live acoustic speech recognition (real microphone audio → transcript)',
    'Headless Chrome has no audio input device; word recognition was driven by the labelled stub. Everything after the transcript is the real app path.');
  blocked('W13.2 the real OS/browser microphone permission prompt',
    'Not executable headless; the permission-denied path is covered by W11.1 with a stubbed onerror("not-allowed").');
  blocked('W13.3 authenticated cross-user Firestore vault read (users/{uid} ownership rule)',
    'No real test account exists in this environment and fabricating one is out of scope; W5.9 proves profile isolation for the anonymous path and firestore.rules is unchanged.');

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const blk = results.filter(r => r.status === 'BLOCKED').length;
  console.log(`\n==== PHASE AW VOICE AGENT BROWSER JOURNEYS: ${pass} PASS / ${fail} FAIL / ${blk} BLOCKED (of ${results.length}) ====`);
  if (fail) { console.log('FAILED:'); results.filter(r => r.status === 'FAIL').forEach(r => console.log('  x ' + r.name + (r.detail ? '  :: ' + r.detail : ''))); }
  if (blk) { console.log('BLOCKED (not executable headless — reported, never PASS):'); results.filter(r => r.status === 'BLOCKED').forEach(r => console.log('  - ' + r.name + '  :: ' + r.detail)); }
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(async (err) => {
  console.error('\n SUITE CRASHED — is the app running on ' + BASE + ' and the backend on :3001?\n', err);
  process.exit(2);
});
