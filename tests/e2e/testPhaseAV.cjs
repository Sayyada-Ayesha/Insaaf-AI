/*
 * PHASE AV — FINAL END-TO-END USER JOURNEYS (real Puppeteer/Chrome, localhost:3000).
 * Executes the 10 journeys from the spec as REAL multi-step browser flows against
 * the running owned-model app. Every assertion is grounded in behavior already
 * proven by testPhaseAF/AK/AL/AM (real directory cards, real citations, no
 * fabricated phones, EN/Roman-only chat, real TTS playback).
 *
 * HONEST SCOPE (non-negotiables #10/#14/#15):
 *   JOURNEY 2 needs a REAL uploaded legal document/photo to exercise OCR end-to-end.
 *   Per Phase AT we must NOT fabricate a test file, so J2 verifies the upload/OCR
 *   feature is present and wired, then marks the OCR-from-real-file flow BLOCKED
 *   pending a user-supplied document. BLOCKED is reported separately (never PASS).
 *   Live acoustic ASR (J7/J8) is not executable in headless Chrome; the recognized
 *   -transcript -> answer -> TTS pipeline IS executed for real (as in Phase AM).
 * Run: node testPhaseAV.cjs
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const DLG = 'div[role="dialog"][aria-label="INSAaf Legal Agent"]';
const CHROME_PATHS = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const URDU = /[\u0600-\u06FF]/;
const VERIFIED_NUMS = ['15', '1099', '1991', '115', '1121', '1101', '9000000'];

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
  return found.filter(p => { const d = p.replace(/[^0-9]/g, ''); return !VERIFIED_NUMS.some(v => d === v || d.endsWith(v)); });
}

async function launchBrowser() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) {
      try { return await puppeteer.launch({ headless: true, executablePath: p, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] }); }
      catch (e) { /* fall through */ }
    }
  }
  return await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1366, height: 1000 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { localStorage.removeItem('insaaf_lang'); localStorage.removeItem('insaaf_doc_lang'); localStorage.removeItem('insaaf_chats'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);

  // ---------- shared helpers (proven in AF/AK/AL/AM) ----------
  const bodyLC = async () => (await page.evaluate(() => document.body.innerText)).toLowerCase();
  const bodyRaw = async () => (await page.evaluate(() => document.body.innerText));
  const clickNav = (aria) => page.evaluate((a) => {
    const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === a);
    if (b) { b.click(); return true; } return false;
  }, aria);
  const clickButtonContaining = (txt) => page.evaluate((t) => {
    const n = t.toLowerCase();
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent || '').toLowerCase().includes(n));
    if (b) { b.click(); return true; } return false;
  }, txt);
  const clickCategory = (label) => page.evaluate((lbl) => {
    const n = lbl.toLowerCase();
    const b = Array.from(document.querySelectorAll('button')).find(x => { const h = x.querySelector('h3'); return h && h.textContent.trim().toLowerCase() === n; });
    if (b) { b.click(); return true; } return false;
  }, label);
  const LOADING = ['matching legal script', 'is matching legal'];
  const isLoading = () => page.evaluate((m) => { const t = (document.body.innerText || '').toLowerCase(); return m.some(x => t.includes(x)); }, LOADING);
  const waitForAnswer = async (timeout = 26000, baseOverride = null) => {
    const base = baseOverride !== null ? baseOverride : await page.evaluate(() => document.body.innerText.length);
    const start = Date.now(); let last = base, stable = Date.now(), grew = false, cleared = false;
    while (Date.now() - start < timeout) {
      await sleep(300);
      const l = await isLoading();
      const cur = await page.evaluate(() => document.body.innerText.length);
      if (cur > base + 40) grew = true;
      if (grew && !l) cleared = true;
      if (cur !== last) { last = cur; stable = Date.now(); }
      else if (grew && cleared && !l && Date.now() - stable >= 800) return true;
    }
    return grew && !(await isLoading());
  };
  const askChat = async (q) => {
    await page.click('textarea');
    await page.keyboard.type(q);
    const base = await page.evaluate(() => document.body.innerText.length);
    await page.keyboard.press('Enter');
    await waitForAnswer(26000, base);
    return await bodyRaw();
  };
  // The last model bubble (.ProseMirror) = THIS answer + its compact source footer.
  // Used where the whole accumulated body would wrongly include earlier turns.
  const lastModelMsg = () => page.evaluate(() => { const b = Array.from(document.querySelectorAll('.ProseMirror')); return b.length ? b[b.length - 1].innerText : ''; });
  // agent
  const agentOpen = () => page.evaluate((s) => { const d = document.querySelector(s); return !!d && d.getAttribute('aria-hidden') === 'false'; }, DLG);
  const agentText = () => page.evaluate((s) => { const d = document.querySelector(s); return d ? d.innerText : ''; }, DLG);
  const openAgent = async () => {
    if (await agentOpen()) return true;
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="Open Legal Agent"]'); if (b) b.click(); });
    for (let i = 0; i < 24; i++) { if (await agentOpen()) return true; await sleep(150); }
    return await agentOpen();
  };
  const closeAgent = async () => {
    if (!(await agentOpen())) return true;
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="Close agent"]'); if (b) b.click(); });
    for (let i = 0; i < 24; i++) { if (!(await agentOpen())) return true; await sleep(150); }
    return !(await agentOpen());
  };
  const waitForAgentReply = async (beforeLen, timeout = 25000) => {
    const start = Date.now(); let last = beforeLen, stable = Date.now(), grew = false;
    while (Date.now() - start < timeout) {
      await sleep(250);
      const txt = await agentText();
      const thinking = /legal agent is thinking|qanooni agent soch/i.test(txt);
      if (txt.length > beforeLen + 15) grew = true;
      if (txt.length !== last) { last = txt.length; stable = Date.now(); }
      else if (grew && !thinking && Date.now() - stable >= 700) return true;
    }
    return grew;
  };
  const askAgent = async (text) => {
    const before = (await agentText()).length;
    await page.click(DLG + ' input');
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await waitForAgentReply(before);
    return await agentText();
  };
  const hasChip = (lp) => page.evaluate((s, x) => Array.from(document.querySelectorAll(s + ' button')).some(b => (b.textContent || '').toLowerCase().includes('open ' + x.toLowerCase())), DLG, lp);
  const clickChip = (lp) => page.evaluate((s, x) => {
    const b = Array.from(document.querySelectorAll(s + ' button')).find(y => (y.textContent || '').toLowerCase().includes('open ' + x.toLowerCase()));
    if (b) { b.click(); return true; } return false;
  }, DLG, lp);
  // lawyer directory
  const lawyerCards = () => page.evaluate(() => Array.from(document.querySelectorAll('h4')).map(h => (h.textContent || '').trim()).filter(t => /advocate/i.test(t)));
  const setSearch = (v) => page.evaluate((val) => {
    const el = document.querySelector('input[placeholder*="Search Advocate"]'); if (!el) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); return true;
  }, v);
  const setCity = (v) => page.evaluate((val) => {
    const sel = Array.from(document.querySelectorAll('select')).find(s => Array.from(s.options).some(o => o.textContent.trim() === 'All Cities')); if (!sel) return false;
    const opt = Array.from(sel.options).find(o => o.textContent.trim() === val); if (!opt) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; set.call(sel, opt.value); sel.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }, v);
  // TTS
  const readAloudSpeaks = async () => page.evaluate(async () => {
    for (let i = 0; i < 20 && window.speechSynthesis.getVoices().length === 0; i++) { await new Promise(r => setTimeout(r, 200)); }
    const btns = document.querySelectorAll('button[title="Read Aloud"]');
    const btn = btns[btns.length - 1];
    if (!btn) return { btn: false, speaking: false, voices: window.speechSynthesis.getVoices().length };
    try { window.speechSynthesis.cancel(); } catch {}
    btn.click();
    let speaking = false;
    for (let i = 0; i < 16; i++) { await new Promise(r => setTimeout(r, 250)); if (window.speechSynthesis.speaking) { speaking = true; break; } }
    return { btn: true, speaking, voices: window.speechSynthesis.getVoices().length };
  });

  // Warm up Chrome's lazy TTS voice list once.
  await page.evaluate(async () => {
    try { window.speechSynthesis.speak(new SpeechSynthesisUtterance('Insaaf')); } catch {}
    for (let i = 0; i < 25 && window.speechSynthesis.getVoices().length === 0; i++) { await new Promise(r => setTimeout(r, 200)); }
    try { window.speechSynthesis.cancel(); } catch {}
  });

  // ==================== JOURNEY 1 ====================
  // Legal question -> answer -> source -> Library -> follow-up -> save
  try {
    record('J1.1 open Legal Chat (AI Consultant)', await clickNav('AI Consultant'));
    await sleep(1400);
    const a1 = await askChat('What is Section 154 CrPC?');
    const l1 = a1.toLowerCase();
    record('J1.2 legal question returns a grounded answer (154 + FIR/cognizable/police)', /154/.test(a1) && /fir|cognizable|police|information/i.test(a1) && !/could not find a verified/i.test(l1));
    record('J1.3 answer contains NO Urdu script (Part A/B)', !URDU.test(a1));
    const srcUi = await page.evaluate(() => {
      const t = document.body.innerText;
      // The exact-provision answer renders a "DIRECT VERIFIED LEGAL REFERENCE"
      // card with a "Sources" heading; other answers use the compact "Source:"
      // footer. Either way a REAL statute source must be shown with the answer.
      const hasSourceLabel = /Source:|Sources/i.test(t);
      const hasVerified = /Verified/i.test(t);
      const realSource = /Code of Criminal Procedure|Act V of 1898|Section 154|Pakistan Penal Code|Constitution of (?:the Islamic Republic of )?Pakistan/i.test(t);
      const openLib = Array.from(document.querySelectorAll('button')).some(b => /open in library/i.test(b.textContent || ''));
      return { hasSourceLabel, hasVerified, realSource, openLib };
    });
    record('J1.4 a real SOURCE is shown with the answer (statute + Verified badge)', srcUi.hasSourceLabel && srcUi.hasVerified && srcUi.realSource, JSON.stringify(srcUi));
    const a2 = await askChat('What can I do if the police refuse to register my FIR?');
    const l2 = a2.toLowerCase();
    record('J1.5 follow-up answered with the escalation route (22-A / Justice of Peace / SP / Sessions)', /fir|154/i.test(a2) && /22-a|justice of peace|session|superintendent|\bsp\b|escalate|magistrate|refus/i.test(l2) && !/could not find a verified/i.test(l2));
    const saved = await page.evaluate(() => {
      try { const raw = localStorage.getItem('insaaf_chats'); const arr = raw ? JSON.parse(raw) : []; return { n: Array.isArray(arr) ? arr.length : 0, blob: raw || '' }; }
      catch { return { n: 0, blob: '' }; }
    });
    record('J1.6 conversation auto-SAVED to the Vault (localStorage insaaf_chats)', saved.n > 0 && /154|fir/i.test(saved.blob), `chats=${saved.n}`);
    let openedLib = srcUi.openLib ? await clickButtonContaining('open in library') : false;
    if (!openedLib) openedLib = await clickNav('Legal Library');
    await sleep(1600);
    const lb = await bodyLC();
    record('J1.7 source -> Library navigation lands on the Legal Library (Insaaf Archive)', lb.includes('insaaf archive'), `viaSourceButton=${srcUi.openLib}`);
  } catch (e) { record('JOURNEY 1', false, e.message); }

  // ==================== JOURNEY 3 ====================
  // Legal problem -> Agent -> lawyer -> city -> specialization -> source
  try {
    record('J3.1 open the floating Legal Agent', await openAgent());
    const t = await askAgent('Find a criminal lawyer in Lahore');
    const lc = t.toLowerCase();
    record('J3.2 agent returns a REAL lawyer card (Nida Zahra, Criminal Defense) for the city+specialization', t.includes('Nida Zahra') && lc.includes('criminal defense') && lc.includes('lahore'));
    record('J3.3 lawyer source is a real bar council + enrollment (no fabricated phone)', lc.includes('punjab bar council') && /pbc-\d+/i.test(t) && suspiciousPhones(t).length === 0, suspiciousPhones(t).join(','));
    record('J3.4 agent offers "Open Lawyer Directory" chip', await hasChip('Lawyer Directory'));
    record('J3.5 click the chip -> navigate to the Vakil Directory', await clickChip('Lawyer Directory'));
    await sleep(1700);
    let b = await bodyLC();
    record('J3.6 directory reached (Vakil Directory + advocate records)', b.includes('vakil directory') && b.includes('advocate'));
    await setCity('Lahore'); await sleep(500); await setSearch('criminal'); await sleep(1000);
    const cards = await lawyerCards();
    b = await bodyLC();
    record('J3.7 city=Lahore + specialization=criminal filters to the real advocate (Nida Zahra)', cards.length === 1 && cards[0].includes('Nida Zahra'), cards.join(' | '));
    record('J3.8 directory result shows Criminal Defense + a verification Source', b.includes('criminal defense') && b.includes('source:'));
  } catch (e) { record('JOURNEY 3', false, e.message); }

  // ==================== JOURNEY 4 ====================
  // No budget -> Agent -> legal aid -> NGO
  try {
    await openAgent();
    const t = await askAgent('I have no budget for a lawyer. What can I do?');
    const lc = t.toLowerCase();
    // The agent deliberately does NOT name/recommend a specific NGO (anti-
    // fabrication); it routes to the verified Legal Aid & NGOs directory, where the
    // real bodies (Legal Aid Society / AGHS / Madadgaar / Art 37-D / 1099) are
    // listed and verified in J4.6-J4.8 below. The bug fixed here: "no budget" must
    // NOT be misrouted to the paid directory ("which city do you need an advocate").
    record('J4.1 "no budget" routes to FREE legal aid (verified directory, no paid-lawyer misroute)', /free legal aid|legal aid|dlac|37-d|district legal/i.test(lc) && /verified (?:directory|organizations)|legal aid & ngos|do not personally recommend/i.test(lc) && !/which city do you need an advocate/i.test(lc));
    record('J4.2 agent hands off to the REAL verified legal-aid directory (no fabricated contact/phone)', /legal aid & ngos|legal-aid organizations|verified organizations|\bngo\b/i.test(lc) && suspiciousPhones(t).length === 0 && !URDU.test(t));
    record('J4.3 no fabricated phone in the legal-aid reply', suspiciousPhones(t).length === 0, suspiciousPhones(t).join(','));
    record('J4.4 agent offers "Open Legal Aid & NGOs" chip', await hasChip('Legal Aid & NGOs'));
    record('J4.5 click the chip -> navigate to Legal Aid & NGOs', await clickChip('Legal Aid & NGOs'));
    await sleep(1800);
    let b = await bodyLC();
    if (!b.includes('verified ngos')) { await clickButtonContaining('legal aid & ngos'); await sleep(1400); b = await bodyLC(); }
    record('J4.6 legal-aid surface shows state-funded aid grounded in Article 37-D', b.includes('article 37-d') || b.includes('37-d'));
    record('J4.7 real NGOs are listed (Legal Aid Society / AGHS / Madadgaar)', b.includes('legal aid society') || b.includes('aghs') || b.includes('madadgaar'));
    record('J4.8 the state legal-aid helpline 1099 is present (no fabricated number)', b.includes('1099') && suspiciousPhones(await bodyRaw()).length === 0);
  } catch (e) { record('JOURNEY 4', false, e.message); }

  // ==================== JOURNEY 5 ====================
  // Case law -> Agent -> case -> explanation -> related law
  try {
    await openAgent();
    const t = await askAgent('Tell me about the Asma Jilani case');
    const lc = t.toLowerCase();
    record('J5.1 agent returns the REAL case citation (PLD 1972 SC / Supreme Court)', lc.includes('jilani') && (lc.includes('pld 1972') || lc.includes('supreme court')) && !/could not find a verified/i.test(lc));
    record('J5.2 the case is explained (holding: revolutionary legality / extra-constitutional acts / constitutional continuity)', /martial law|revolutionary legality|revolutionary government|extra-?constitutional|constitutional continuity|doctrine of necessity|usurper|kelsen|validate|validity|\bheld\b|significance|basic structure/i.test(lc));
    record('J5.3 related law surfaced (the Constitution / constitutional principle)', /constitution|constitutional|article/i.test(lc));
    record('J5.4 reply is grounded, not fabricated (verified source / case registry / legal reference)', lc.includes('case law registry') || lc.includes('verified legal reference') || lc.includes('verified legal knowledge') || lc.includes('pld 1972'));
    record('J5.5 case-law reply has NO Urdu script and NO fabricated phone', !URDU.test(t) && suspiciousPhones(t).length === 0);
  } catch (e) { record('JOURNEY 5', false, e.message); }
  await closeAgent();

  // ==================== JOURNEY 6 ====================
  // FIR problem -> procedure -> authority -> next step -> source
  try {
    await clickNav('AI Consultant'); await sleep(1400);
    const t = await askChat('The police are refusing to register my FIR. What is the procedure, which authority do I approach, and what is my next step?');
    const lc = t.toLowerCase();
    record('J6.1 procedure grounded (Section 154 CrPC registration + 22-A/22-B remedy)', /154/.test(t) && /22-a|22-b|justice of peace|cognizable|register/i.test(lc));
    record('J6.2 authority named (SHO -> SP/DSP/IG -> Justice of Peace / Sessions Court)', /sho|station house officer|superintendent|\bsp\b|\bdsp\b|\big\b|justice of peace|session/i.test(lc));
    record('J6.3 a concrete next step is given (written application / escalate / 22-A application)', /apply|application|escalate|approach|submit|written|senior|22-a/i.test(lc));
    record('J6.4 answer is grounded, not a cold refusal, and cites a source (CrPC / Source footer)', !/could not find a verified/i.test(lc) && (/crpc|code of criminal procedure|154|22-a/i.test(lc) || /Source:/i.test(t)));
    record('J6.5 no Urdu script and no fabricated phone', !URDU.test(t) && suspiciousPhones(t).length === 0);
  } catch (e) { record('JOURNEY 6', false, e.message); }

  // ==================== JOURNEY 7 ====================
  // English voice -> answer -> TTS
  try {
    const engines = await page.evaluate(() => ({ sr: !!(window.SpeechRecognition || window.webkitSpeechRecognition), tts: !!window.speechSynthesis }));
    record('J7.1 browser STT + TTS engines present (voice pipeline available)', engines.sr && engines.tts, JSON.stringify(engines));
    const t = await askChat('What is the procedure to register an FIR in Pakistan?');
    record('J7.2 English transcript -> grounded answer (FIR + 154/police)', /\bfir\b/i.test(t) && (/154/.test(t) || /police/i.test(t)) && !/could not find a verified/i.test(t.toLowerCase()));
    record('J7.3 English answer has NO Urdu script', !URDU.test(t));
    const tts = await readAloudSpeaks();
    record('J7.4 Read Aloud (TTS) present on the answer', tts.btn, `voices=${tts.voices}`);
    record('J7.5 clicking Read Aloud REALLY speaks (speechSynthesis.speaking===true)', tts.speaking === true, JSON.stringify(tts));
    await page.evaluate(() => { try { window.speechSynthesis.cancel(); } catch {} });
    console.log('  NOTE J7: live acoustic word-recognition is not executable headless; the recognized-transcript -> answer -> TTS path is executed for real.');
  } catch (e) { record('JOURNEY 7', false, e.message); }

  // ==================== JOURNEY 8 ====================
  // Roman Urdu voice -> answer -> TTS
  try {
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /^Roman$/i.test((x.textContent || '').trim())); if (b) b.click(); });
    await sleep(500);
    const t = await askChat('Mera FIR register nahi ho raha, mujhe kya karna chahiye?');
    record('J8.1 Roman Urdu transcript -> grounded answer (FIR/154/police)', /fir|154|police/i.test(t) && !/could not find a verified/i.test(t.toLowerCase()));
    record('J8.2 Roman Urdu answer has NO Urdu script (Latin only, Part A/B)', !URDU.test(t));
    const tts = await readAloudSpeaks();
    record('J8.3 Read Aloud speaks the Roman Urdu answer too (speaking===true)', tts.btn && tts.speaking === true, JSON.stringify(tts));
    await page.evaluate(() => { try { window.speechSynthesis.cancel(); } catch {} });
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /^Auto$/i.test((x.textContent || '').trim())); if (b) b.click(); });
    await sleep(300);
  } catch (e) { record('JOURNEY 8', false, e.message); }

  // ==================== JOURNEY 9 ====================
  // Unknown / non-legal question -> sensible response
  try {
    await askChat('What is the best recipe for chicken biryani?');
    const t = await lastModelMsg();  // scope to THIS answer, not the accumulated body
    const lc = t.toLowerCase();
    record('J9.1 non-legal question gets a sensible scope response (not a crash, not fabricated legal advice)', /outside.*(legal|scope)|don'?t handle|do not handle|general[- ]knowledge|casual chat|serious (?:assistant|legal)|help with legal|legal (?:assistant|help|matters|questions|knowledge)|not a legal|i (?:can )?(?:help|assist) with (?:pakistani )?legal|only.*legal/i.test(lc));
    record('J9.2 it does NOT invent legal facts/citations for a non-legal query', !/section \d+|article \d+|pld \d{4}|supreme court/i.test(lc));
    record('J9.3 response is civil + redirects to legal help, NO Urdu script', t.trim().length > 15 && !URDU.test(t));
  } catch (e) { record('JOURNEY 9', false, e.message); }

  // ==================== JOURNEY 10 ====================
  // Unsupported legal question -> safe, honest limitation
  try {
    await askChat('What punishment does Section 999 of the Pakistan Space Mining Regulation Act 2050 prescribe?');
    const t = await lastModelMsg();  // scope to THIS answer, not the accumulated body
    const lc = t.toLowerCase();
    record('J10.1 unsupported/fabricated legal query -> honest limitation (no verified source / will not guess)', /could not find a verified|was not found|not found in the verified|double-?check|outside.*verified.*scope|no verified.*source|will not guess|not (?:fabricate|invent)|does not exist|no such|unable to verify/i.test(lc));
    record('J10.2 it does NOT fabricate the fake statute/section or a penalty', !/space mining regulation act 2050/i.test(lc) || /not found|no verified|could not|does not exist|unable|double-?check/i.test(lc));
    record('J10.3 it offers a concrete next step (rephrase / Library / procedure / lawyer / double-check the law)', /rephrase|double-?check|library|procedure|lawyer|relevant (law|section)|legal aid|verified/i.test(lc));
    record('J10.4 no fabricated citation/phone and NO Urdu script', !/pld \d{4} (sc|clc|scmr)/i.test(t) && suspiciousPhones(t).length === 0 && !URDU.test(t));
  } catch (e) { record('JOURNEY 10', false, e.message); }

  // ==================== JOURNEY 2 (OCR needs a REAL file) ====================
  // Upload document/photo -> OCR -> explain -> next steps -> draft reply -> edit -> PDF
  try {
    await clickNav('Document Drafter'); await sleep(1600);
    let b = await bodyLC();
    record('J2.1 Document Drafter / analyzer surface reachable (Drafting Engine)', b.includes('drafting engine'));
    await clickCategory('Legal'); await sleep(1200);
    const up = await page.evaluate(() => {
      const fi = document.querySelector('input[type="file"]');
      const t = document.body.innerText;
      return {
        fileInput: !!fi,
        accept: fi ? (fi.getAttribute('accept') || '') : '',
        uploadLabel: /upload reference document|select file|upload|photo or pdf/i.test(t),
        understanding: /document understanding|extract the fields|ocr/i.test(t)
      };
    });
    record('J2.2 document upload + OCR feature is present and wired (file input accepts .pdf/image)', up.fileInput && /pdf|image/i.test(up.accept) && up.uploadLabel, JSON.stringify(up));
    blocked('J2.3 OCR of a REAL uploaded legal document -> explain -> next steps -> draft reply -> edit -> PDF',
      'Requires a REAL legal document/photo (Phase AT + non-negotiables #14/#15 forbid fabricating one). ASKING THE USER to upload a file; will execute the full OCR E2E on the real file.');
  } catch (e) { record('JOURNEY 2', false, e.message); }

  await browser.close();
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const blk = results.filter(r => r.status === 'BLOCKED').length;
  console.log(`\n==== PHASE AV END-TO-END JOURNEYS: ${pass} PASS / ${fail} FAIL / ${blk} BLOCKED (of ${results.length}) ====`);
  if (fail) { console.log('FAILED CHECKS:'); results.filter(r => r.status === 'FAIL').forEach(r => console.log('  - ' + r.name + (r.detail ? ' :: ' + r.detail : ''))); }
  if (blk) { console.log('BLOCKED (pending a real user-uploaded document):'); results.filter(r => r.status === 'BLOCKED').forEach(r => console.log('  - ' + r.name)); }
  process.exit(fail ? 1 : 0);
})();
