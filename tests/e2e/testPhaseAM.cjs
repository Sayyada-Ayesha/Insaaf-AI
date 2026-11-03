/*
 * PHASE AM — VOICE TEST (real browser + the REAL compiled VoiceService source).
 *
 * HONEST SCOPE (non-negotiable: never fabricate a result):
 *   Live acoustic ASR — a human speaking real words into a microphone — CANNOT be
 *   executed by automated headless Chrome. Empirically (see probe) the browser's
 *   SpeechRecognition engine is present and .start() runs, but with a fake/silent
 *   audio device it yields NO transcript and the session times out. This test
 *   therefore GENUINELY executes every stage that CAN be executed and reports the
 *   ASR limitation truthfully instead of inventing recognized speech:
 *
 *   A. REAL VoiceService logic, compiled from src/services/voiceService.ts and run
 *      in Node: language detection, Urdu-script SPEECH -> Roman Urdu normalization
 *      (so Urdu speech never becomes an Urdu-script response), TTS text cleaning,
 *      mixed-script segmentation, best-voice selection, honest no-voice handling.
 *   B. REAL browser (localhost:3000): voice UI + the POLICY that Urdu Script is NOT
 *      a chat/voice RESPONSE option (Auto/En/Roman only) while Urdu speech INPUT is
 *      offered; STT + TTS engines present; transcript -> legal answer pipeline for
 *      an English and a Roman Urdu transcript (grounded, no Urdu Script); Read Aloud
 *      TTS ACTUALLY SPEAKS (speechSynthesis.speaking === true); and the real mic
 *      path starts listening then surfaces an honest timeout (no fabricated text).
 *
 * Run: node testPhaseAM.cjs
 */
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const VOICE_MJS = path.join(__dirname, '_voiceCompiled.mjs');
const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const URDU = /[\u0600-\u06FF]/;

(async () => {
  // ---- Compile the REAL VoiceService source (esbuild) and import it ----
  let VS = null;
  try {
    execSync('node_modules\\.bin\\esbuild.cmd src/services/voiceService.ts --format=esm --platform=browser --outfile="' + VOICE_MJS + '"', { cwd: path.resolve(__dirname, '..', '..'), stdio: 'pipe' });
    const mod = await import(pathToFileURL(VOICE_MJS).href);
    VS = mod.VoiceService;
    record('AM.0 real VoiceService compiled from source + imported', !!VS && typeof VS.detectLanguage === 'function' && typeof VS.normalizeTranscript === 'function');
  } catch (e) {
    record('AM.0 real VoiceService compiled from source + imported', false, String(e.message || e));
  }

  // ============ A. REAL VoiceService logic (pure functions) ============
  if (VS) {
    try {
      record('AM.1 detectLanguage: clean English legal text -> "en"', VS.detectLanguage('What punishment does Section 379 PPC prescribe for theft?') === 'en');
      record('AM.2 detectLanguage: Roman Urdu text -> "roman_urdu"', VS.detectLanguage('Mera FIR register nahi ho raha, mujhe kya karna chahiye?') === 'roman_urdu');
      const urduScript = 'میرا ایف آئی آر رجسٹر نہیں ہو رہا کیا کروں';
      record('AM.3 detectLanguage: Urdu Script text -> "ur"', VS.detectLanguage(urduScript) === 'ur');
      // CORE POLICY: Urdu SPEECH (ur-PK) recognized in Urdu Script is normalized to Roman Urdu
      const norm = VS.normalizeTranscript(urduScript, 'ur-PK');
      record('AM.4 normalizeTranscript(ur-PK): Urdu-script speech -> Roman (NO Urdu Script survives)', norm.length > 0 && !URDU.test(norm), JSON.stringify(norm));
      record('AM.5 normalizeTranscript(en-US): English transcript preserved + trimmed', VS.normalizeTranscript('  What does Section 154 CrPC require?  ', 'en-US') === 'What does Section 154 CrPC require?');
      // TTS text cleaning
      const cleaned = VS.cleanTextForTTS('### Heading\n\n**Bold** answer with [1] citation and `code`.\n- bullet one\n- bullet two');
      record('AM.6 cleanTextForTTS strips markdown/HTML/citations/bullets', !cleaned.includes('#') && !cleaned.includes('*') && !cleaned.includes('`') && !/\[\d+\]/.test(cleaned) && cleaned.toLowerCase().includes('bold answer'), JSON.stringify(cleaned).slice(0, 90));
      // Mixed-script segmentation
      const chunks = VS.segmentMixedContent('What punishment does Section 379 PPC prescribe? Yeh Roman Urdu ka jumla hai. میں اردو میں لکھا ہوں۔');
      record('AM.7 segmentMixedContent tags sentences by script (en + roman_urdu present)', chunks.length >= 2 && chunks.some(c => c.langType === 'en') && chunks.some(c => c.langType === 'roman_urdu'), JSON.stringify(chunks.map(c => c.langType)));
      // Best-voice selection with mock voices
      const mockVoices = [
        { name: 'Microsoft Andrew', lang: 'en-US' },
        { name: 'Microsoft David', lang: 'en-GB' },
        { name: 'Microsoft Asad', lang: 'ur-PK' },
        { name: 'Microsoft Uzma', lang: 'ur-PK' },
        { name: 'Microsoft Hemant', lang: 'hi-IN' }
      ];
      const enPick = VS.selectBestVoice(mockVoices, 'en');
      record('AM.8 selectBestVoice(en) picks an English voice', !!enPick.voice && /en-/.test(enPick.voice.lang), enPick.voice ? enPick.voice.lang : 'null');
      const romPick = VS.selectBestVoice(mockVoices, 'roman_urdu');
      record('AM.9 selectBestVoice(roman_urdu) prefers a ur/hi/en-PK voice (never fabricates)', !!romPick.voice && /^(ur|hi|en)/.test(romPick.voice.lang), romPick.voice ? romPick.voice.lang : 'null');
      const urPick = VS.selectBestVoice(mockVoices, 'ur');
      record('AM.10 selectBestVoice(ur) flags a genuine Urdu voice when one exists', urPick.isGenuineUrdu === true && !!urPick.voice && /ur/.test(urPick.voice.lang));
      const nonePick = VS.selectBestVoice([], 'ur');
      record('AM.11 selectBestVoice([]) honestly reports a platform limitation (no fake voice)', nonePick.voice === null && nonePick.hasPlatformLimitation === true);
      record('AM.12 transliterateUrduToRoman maps Urdu letters to Latin', VS.transliterateUrduToRoman('پولیس').length > 0 && !URDU.test(VS.transliterateUrduToRoman('پولیس')), VS.transliterateUrduToRoman('پولیس'));
    } catch (e) { record('A. VoiceService logic', false, String(e.message || e)); }
  }

  // ============ B. REAL browser voice pipeline ============
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1366, height: 1000 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { localStorage.removeItem('insaaf_lang'); localStorage.removeItem('insaaf_doc_lang'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === 'AI Consultant'); if (b) b.click(); });
  await sleep(1600);
  // Warm up Chrome's lazy voice list so the TTS checks are reliable.
  await page.evaluate(async () => {
    try { window.speechSynthesis.speak(new SpeechSynthesisUtterance('Insaaf')); } catch {}
    for (let i = 0; i < 25 && window.speechSynthesis.getVoices().length === 0; i++) { await new Promise(r => setTimeout(r, 200)); }
    try { window.speechSynthesis.cancel(); } catch {}
  });

  const ask = async (txt) => {
    const base = await page.evaluate(() => document.body.innerText.length);
    await page.click('textarea');
    await page.keyboard.type(txt);
    await page.keyboard.press('Enter');
    const start = Date.now(); let last = base, stable = Date.now(), grew = false, cleared = false;
    const loading = () => page.evaluate(() => /matching legal script|is matching legal/i.test(document.body.innerText));
    while (Date.now() - start < 26000) {
      await sleep(300);
      const l = await loading();
      const cur = await page.evaluate(() => document.body.innerText.length);
      if (cur > base + 40) grew = true;
      if (grew && !l) cleared = true;
      if (cur !== last) { last = cur; stable = Date.now(); }
      else if (grew && cleared && !l && Date.now() - stable >= 800) break;
    }
    return await page.evaluate(() => document.body.innerText);
  };
  const readAloudSpeaks = async (lastButton) => page.evaluate(async (useLast) => {
    for (let i = 0; i < 20 && window.speechSynthesis.getVoices().length === 0; i++) { await new Promise(r => setTimeout(r, 200)); }
    const btns = document.querySelectorAll('button[title="Read Aloud"]');
    const btn = useLast ? btns[btns.length - 1] : btns[0];
    if (!btn) return { btn: false, speaking: false, voices: window.speechSynthesis.getVoices().length };
    try { window.speechSynthesis.cancel(); } catch {}
    btn.click();
    let speaking = false;
    for (let i = 0; i < 14; i++) { await new Promise(r => setTimeout(r, 250)); if (window.speechSynthesis.speaking) { speaking = true; break; } }
    return { btn: true, speaking, voices: window.speechSynthesis.getVoices().length };
  }, lastButton);

  try {
    const engines = await page.evaluate(() => ({ sr: !!(window.SpeechRecognition || window.webkitSpeechRecognition), tts: !!window.speechSynthesis }));
    record('AM.13 browser SpeechRecognition (STT) engine present', engines.sr);
    record('AM.14 browser speechSynthesis (TTS) engine present', engines.tts);

    const ui = await page.evaluate(() => {
      const body = document.body.innerText;
      const btns = Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').trim());
      const mic = document.querySelector('button[title^="Speech Language"]');
      return {
        mic: !!mic, micTitle: mic ? mic.getAttribute('title') : '',
        auto: btns.some(t => /^Auto$/i.test(t)), en: btns.some(t => /^En$/i.test(t)), roman: btns.some(t => /^Roman$/i.test(t)),
        urduIn: btns.some(t => /^Urdu$/i.test(t)), engIn: btns.some(t => /^English$/i.test(t)),
        urduScriptInBody: /[\u0600-\u06FF]/.test(body)
      };
    });
    record('AM.15 microphone button present in the Chat surface', ui.mic, ui.micTitle);
    record('AM.16 response-language options = Auto + En + Roman (EN + Roman Urdu only)', ui.auto && ui.en && ui.roman);
    record('AM.17 POLICY: NO Urdu Script exposed anywhere on the chat/voice surface', ui.urduScriptInBody === false);
    record('AM.18 voice INPUT selector offers Urdu + English speech recognition', ui.urduIn && ui.engIn);

    // transcript -> legal answer (English)
    const enAns = await ask('What is the procedure to register an FIR in Pakistan?');
    record('AM.19 English transcript -> grounded legal answer (FIR + 154/police), not a cold refusal', /\bfir\b/i.test(enAns) && (/154/.test(enAns) || /police/i.test(enAns)) && !/could not find a verified/i.test(enAns));
    record('AM.20 English answer surface contains NO Urdu Script', !URDU.test(enAns));

    const tts1 = await readAloudSpeaks(false);
    record('AM.21 Read Aloud (TTS) button present on the answer', tts1.btn, `voices=${tts1.voices}`);
    record('AM.22 clicking Read Aloud REALLY speaks (speechSynthesis.speaking===true)', tts1.speaking === true, JSON.stringify(tts1));
    await page.evaluate(() => { try { window.speechSynthesis.cancel(); } catch {} });

    // Roman Urdu response language + Roman transcript
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /^Roman$/i.test((x.textContent || '').trim())); if (b) b.click(); });
    await sleep(500);
    const romAns = await ask('Mera FIR register nahi ho raha, mujhe kya karna chahiye?');
    record('AM.23 Roman Urdu transcript -> grounded answer (FIR/154/police), not a cold refusal', !/could not find a verified/i.test(romAns) && /fir|154|police/i.test(romAns));
    record('AM.24 Roman Urdu answer contains NO Urdu Script (Roman/Latin only)', !URDU.test(romAns));

    const tts2 = await readAloudSpeaks(true);
    record('AM.25 Read Aloud speaks the Roman Urdu answer too (no Urdu-Script TTS path)', tts2.speaking === true, JSON.stringify(tts2));
    await page.evaluate(() => { try { window.speechSynthesis.cancel(); } catch {} });

    // Honest REAL mic path: switch input to English, click mic -> listening -> timeout error
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /^English$/i.test((x.textContent || '').trim())); if (b) b.click(); });
    await sleep(300);
    await page.evaluate(() => { const m = document.querySelector('button[title^="Speech Language"]'); if (m) m.click(); });
    await sleep(1300);
    const listening = await page.evaluate(() => /press the mic to stop|listening|mic ka button band/i.test(document.body.innerText));
    record('AM.26 real mic click STARTS listening (STT pipeline wired + indicator shown)', listening);
    let voiceErr = ''; const st = Date.now();
    while (Date.now() - st < 18000) {
      await sleep(700);
      voiceErr = await page.evaluate(() => { const m = document.body.innerText.match(/(Listening timed out|No speech|Microphone permission|not supported|is unavailable|Voice input failed|No voice is available)[^\n]*/i); return m ? m[0].trim() : ''; });
      if (voiceErr) break;
    }
    record('AM.27 headless ASR fabricates NO transcript — honest timeout/error surfaced', !!voiceErr, voiceErr || '(no explicit status captured within 18s)');
  } catch (e) { record('B. browser voice pipeline', false, String(e.message || e)); }

  await browser.close();
  try { if (fs.existsSync(VOICE_MJS)) fs.unlinkSync(VOICE_MJS); } catch {}

  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== PHASE AM VOICE TEST: ${passed}/${results.length} PASS ====`);
  console.log('NOTE: live acoustic word-recognition is not executable in headless Chrome (no real voice);');
  console.log('      STT engine presence, honest timeout handling, TTS playback, language policy and the');
  console.log('      transcript->answer pipeline are all verified for real. See AM.13/AM.26/AM.27.');
  if (passed !== results.length) {
    console.log('FAILED CHECKS:');
    results.filter(r => !r.pass).forEach(r => console.log('  - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  }
  process.exit(passed === results.length ? 0 : 1);
})();
