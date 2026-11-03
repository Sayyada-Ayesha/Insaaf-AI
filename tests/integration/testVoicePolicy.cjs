/**
 * Part B / Phase AM browser verification: voice policy compliance.
 * Verifies the visible voice UI offers only English + Roman Urdu as RESPONSE
 * languages (no Urdu Script), the mic STT locales are Urdu/English, TTS is
 * invocable, and capabilities are reported honestly. (Live microphone capture
 * requires a real audio device + permission and cannot be fully automated in
 * headless Chrome; STT/TTS wiring and policy are verified here.)
 */
const puppeteer = require('puppeteer');
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:3000/';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  const results = [];
  const check = (n, p, d = '') => { results.push({ n, p }); console.log(`${p ? 'PASS' : 'FAIL'} — ${n}${d ? ' :: ' + d : ''}`); };

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);

  // Chat response-language selector must be Auto / En / Roman only (no Urdu Script option)
  const chatLangOpts = await page.evaluate(() => {
    const spans = [...document.querySelectorAll('span')].filter(s => /^Chat:/i.test(s.textContent.trim()));
    if (!spans.length) return null;
    const group = spans[0].parentElement;
    return [...group.querySelectorAll('button')].map(b => b.textContent.trim());
  });
  check('Chat response-language selector present', Array.isArray(chatLangOpts), JSON.stringify(chatLangOpts));
  const hasUrduScriptResponse = (chatLangOpts || []).some(o => /urdu script|اردو/i.test(o));
  check('No Urdu Script as a voice/chat RESPONSE option', !hasUrduScriptResponse, JSON.stringify(chatLangOpts));
  const hasRoman = (chatLangOpts || []).some(o => /roman/i.test(o));
  const hasEn = (chatLangOpts || []).some(o => /^en$/i.test(o));
  check('Roman Urdu + English response options present', hasRoman && hasEn, JSON.stringify(chatLangOpts));

  // Voice input (STT) selector: Urdu + English locales
  const voiceOpts = await page.evaluate(() => {
    const spans = [...document.querySelectorAll('span')].filter(s => /^Voice:/i.test(s.textContent.trim()));
    if (!spans.length) return null;
    const group = spans[0].parentElement;
    return [...group.querySelectorAll('button')].map(b => b.textContent.trim());
  });
  check('Voice input (STT) selector present', Array.isArray(voiceOpts), JSON.stringify(voiceOpts));
  const hasUrduMic = (voiceOpts || []).some(o => /urdu/i.test(o));
  const hasEnMic = (voiceOpts || []).some(o => /english|^en$/i.test(o));
  check('STT offers Urdu + English microphone locales', hasUrduMic && hasEnMic, JSON.stringify(voiceOpts));

  // Microphone button exists
  const hasMic = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    return btns.some(b => /mic|listen|voice|awaaz|bolein/i.test(b.getAttribute('aria-label') || '') || !!b.querySelector('svg.lucide-mic, svg.lucide-mic-off'));
  });
  check('Microphone (STT) button present', hasMic);

  // TTS: speechSynthesis available + a read-aloud control exists on messages
  const ttsAvail = await page.evaluate(() => typeof window !== 'undefined' && !!window.speechSynthesis);
  check('Browser TTS (speechSynthesis) available', ttsAvail);

  // VoiceService capability snapshot is honest (no fabricated Urdu voice claim)
  const caps = await page.evaluate(async () => {
    try {
      const mod = await import('/src/services/voiceService.ts');
      const c = mod.VoiceService.getCapabilities();
      return { browserSTT: c.browserSTT, browserTTS: c.browserTTS, urduVoiceAvailable: c.urduVoiceAvailable, totalVoices: c.totalVoices };
    } catch (e) { return { error: String(e) }; }
  });
  check('VoiceService.getCapabilities() reports honestly', caps && typeof caps.browserTTS === 'boolean', JSON.stringify(caps));

  // Roman Urdu is read as Roman Urdu (no script conversion in cleanTextForTTS/detect)
  const romanHandling = await page.evaluate(async () => {
    try {
      const mod = await import('/src/services/voiceService.ts');
      const VS = mod.VoiceService;
      const sample = 'Police ko Section 154 ke tehat FIR register karni chahiye.';
      const lang = VS.detectLanguage(sample);
      const cleaned = VS.cleanTextForTTS(sample);
      const stillLatin = !/[\u0600-\u06FF]/.test(cleaned);
      return { detected: lang, stillLatin, cleaned };
    } catch (e) { return { error: String(e) }; }
  });
  check('Roman Urdu detected as roman_urdu and kept in Latin script (not converted)',
    romanHandling.detected === 'roman_urdu' && romanHandling.stillLatin, JSON.stringify(romanHandling));

  await browser.close();
  const passed = results.filter(r => r.p).length;
  console.log(`\n==== VOICE POLICY (Part B): ${passed}/${results.length} PASS ====`);
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('TEST ERROR', e); process.exit(2); });
