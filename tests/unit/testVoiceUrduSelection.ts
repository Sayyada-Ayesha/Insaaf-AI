/*
 * Sprint §3 / §13 — Voice engine regressions.
 *
 * These pin the two defects the sprint names: an Urdu voice must be chosen from the
 * voice's language METADATA (never its display name), and a speech failure must reach
 * the caller instead of being swallowed. A stubbed Web Speech engine is used because
 * the acoustic result of a real ur-PK voice can only be judged by a person — that
 * stays a manual gate, and nothing here claims it.
 *
 * Run: npx tsx tests/unit/testVoiceUrduSelection.ts
 */

let passed = 0;
let failed = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${detail}`); }
};

type MockVoice = { name: string; lang: string };

/** Records what the engine was asked to speak and how it responded. */
const engine: {
  spoken: any[];
  mode: 'end' | 'error' | 'silent';
  voices: MockVoice[];
  /** Runs while an utterance is handed to the engine, so a stop() can be timed exactly. */
  onSpeak: (() => void) | null;
} = {
  spoken: [],
  mode: 'end',
  voices: [],
  onSpeak: null
};

function installEngine() {
  (globalThis as any).SpeechSynthesisUtterance = class {
    text: string; lang = ''; voice: any = null; rate = 1; pitch = 1;
    onend: (() => void) | null = null;
    onerror: ((ev: any) => void) | null = null;
    constructor(text: string) { this.text = text; }
  };
  (globalThis as any).window = {
    speechSynthesis: {
      getVoices: () => engine.voices,
      addEventListener: () => { /* voiceschanged never fires in the stub */ },
      removeEventListener: () => { /* noop */ },
      speak: (u: any) => {
        engine.spoken.push({ text: u.text, lang: u.lang, voiceName: u.voice ? u.voice.name : null, voiceLang: u.voice ? u.voice.lang : null });
        if (engine.onSpeak) { const h = engine.onSpeak; engine.onSpeak = null; h(); }
        if (engine.mode === 'error') setTimeout(() => u.onerror && u.onerror({ error: 'synthesis-failed' }), 0);
        else if (engine.mode === 'silent') { /* never ends: the watchdog must release the UI */ }
        else setTimeout(() => u.onend && u.onend(), 0);
      },
      cancel: () => { /* noop */ }
    }
  };
  (globalThis as any).localStorage = {
    store: {} as Record<string, string>,
    getItem(k: string) { return this.store[k] ?? null; },
    setItem(k: string, v: string) { this.store[k] = v; },
    removeItem(k: string) { delete this.store[k]; }
  };
}

installEngine();
const { VoiceService } = await import('../../src/services/voiceService.ts');

const V = (name: string, lang: string) => ({ name, lang, default: false, localService: true, voiceURI: name } as any);

// ---------- V1. Urdu is decided by language metadata, not by a display name ----------
ok('V1.1 isUrduLang accepts ur and ur-PK only',
  VoiceService.isUrduLang('ur') && VoiceService.isUrduLang('ur-PK')
  && !VoiceService.isUrduLang('en-US') && !VoiceService.isUrduLang('hi-IN') && !VoiceService.isUrduLang(''));

const nameTrap = [V('Microsoft Andrew', 'en-US'), V('Urdu Voice Pack', 'en-US'), V('Microsoft Asad', 'ur-PK')];
const urPick = VoiceService.selectBestVoice(nameTrap, 'ur');
ok('V1.2 selectBestVoice(ur) picks the voice whose lang is ur-PK',
  !!urPick.voice && urPick.voice.lang === 'ur-PK' && urPick.isGenuineUrdu === true,
  `${urPick.voice && urPick.voice.name}/${urPick.voice && urPick.voice.lang}`);

const englishOnly = [V('Microsoft Andrew', 'en-US'), V('Urdu Name Only', 'en-GB')];
const trapPick = VoiceService.selectBestVoice(englishOnly, 'ur');
ok('V1.3 a voice named "Urdu" with an English locale is never reported as a genuine Urdu voice',
  trapPick.isGenuineUrdu === false && trapPick.hasPlatformLimitation === true,
  JSON.stringify({ name: trapPick.voice && trapPick.voice.name, genuine: trapPick.isGenuineUrdu }));
ok('V1.4 hasPlatformLimitation is also set when Roman Urdu has no ur/hi/en-PK voice',
  VoiceService.selectBestVoice([V('Google US English', 'en-US')], 'roman_urdu').hasPlatformLimitation === true);
ok('V1.5 an empty voice list is reported honestly, with no invented voice',
  (() => { const r = VoiceService.selectBestVoice([], 'ur'); return r.voice === null && r.hasPlatformLimitation === true; })());

// ---------- V2. Capability report cannot over-claim ----------
engine.voices = [V('Urdu Name Only', 'en-US'), V('Microsoft Andrew', 'en-US')];
let caps = VoiceService.getCapabilities();
ok('V2.1 urduVoiceAvailable is false when only an English voice carries an Urdu-looking name',
  caps.urduVoiceAvailable === false && caps.urduVoiceName === null, JSON.stringify(caps));
engine.voices = [V('Microsoft Asad', 'ur-PK')];
caps = VoiceService.getCapabilities();
ok('V2.2 urduVoiceAvailable is true only for a real ur locale voice',
  caps.urduVoiceAvailable === true && caps.urduVoiceName === 'Microsoft Asad', JSON.stringify(caps));

// ---------- V3. speak(): the engine's own failure reaches the caller ----------
async function runSpeak(text: string, voices: MockVoice[], opts: { stopDuringFirst?: boolean } = {}) {
  engine.voices = voices.map(v => V(v.name, v.lang));
  engine.spoken = [];
  if (opts.stopDuringFirst) engine.onSpeak = () => VoiceService.stop();
  const events: string[] = [];
  let err: any = null;
  let report: any = null;
  await VoiceService.speak(
    text,
    () => events.push('start'),
    () => events.push('end'),
    (e: any) => { err = e; events.push('error'); },
    'en',
    (r: any) => { report = r; }
  );
  engine.onSpeak = null;
  return { events, err, report, spoken: engine.spoken };
}

engine.mode = 'error';
{
  const r = await runSpeak('Section 379 PPC prescribes punishment.', [V('Microsoft Andrew', 'en-US')]);
  ok('V3.1 a real synthesis failure is reported to onError (was dead code)',
    r.events.includes('error') && !!r.err && r.err.code === 'tts-unavailable', JSON.stringify(r.events));
  ok('V3.2 the answer still ends instead of hanging the UI', r.events.includes('end'));
}

engine.mode = 'end';
{
  // An Urdu-script answer on a device with no Urdu voice must be announced, not hidden.
  const r = await runSpeak('یہ دفعہ تین سو انہتر کے تحت سزا ہے۔', [V('Microsoft Andrew', 'en-US')]);
  ok('V3.3 Urdu script read by an English voice is reported as urdu-voice-missing',
    !!r.err && r.err.code === 'urdu-voice-missing', JSON.stringify({ code: r.err && r.err.code }));
  ok('V3.4 the spoken locale follows the voice that actually spoke',
    r.spoken.length > 0 && r.spoken[0].lang === 'en-US' && r.spoken[0].voiceName === 'Microsoft Andrew',
    JSON.stringify(r.spoken[0]));
  ok('V3.5 the report names the voice and says the Urdu voice is missing',
    !!r.report && r.report.urduRequested === true && r.report.urduVoiceMissing === true
    && r.report.voiceName === 'Microsoft Andrew', JSON.stringify(r.report));

  const g = await runSpeak('یہ دفعہ تین سو انہتر کے تحت سزا ہے۔', [V('Microsoft Asad', 'ur-PK')]);
  ok('V3.6 with a genuine ur-PK voice no limitation is raised',
    g.err === null && g.report.urduVoiceMissing === false && g.spoken[0].lang === 'ur-PK',
    JSON.stringify({ err: g.err && g.err.code, lang: g.spoken[0].lang }));

  const e = await runSpeak('Your notice must be filed within thirty days.', [V('Microsoft Andrew', 'en-US')]);
  ok('V3.7 an English answer is not flagged as a limitation',
    e.err === null && e.report.urduRequested === false && e.report.urduVoiceMissing === false);
}

// ---------- V4. stop() abandons the chunks that have not started ----------
{
  const r = await runSpeak(
    'First chunk about the complaint. Second chunk about the forum. Third chunk about the evidence.',
    [V('Microsoft Andrew', 'en-US')],
    { stopDuringFirst: true }
  );
  ok('V4.1 stop() abandons every chunk that has not started',
    r.spoken.length === 1, `chunks spoken: ${r.spoken.length}`);
  ok('V4.2 the interrupted answer still reports its end', r.events.includes('end'));
}

// ---------- V5. stuck synthesis cannot hang the UI ----------
{
  engine.mode = 'silent';
  const started = Date.now();
  const r = await runSpeak('This utterance never reports an end back to the page.', [V('Microsoft Andrew', 'en-US')]);
  const elapsed = Date.now() - started;
  engine.mode = 'end';
  ok('V5.1 the watchdog releases the speak call', r.events.includes('end') && elapsed < 30000, `elapsed ${elapsed}ms`);
}

// ---------- V6. the Voice Agent and Chat use this one engine, not a second path ----------
{
  const fs = await import('node:fs');
  const voice = fs.readFileSync('src/components/VoiceAgentSection.tsx', 'utf8');
  const chat = fs.readFileSync('src/components/ChatSection.tsx', 'utf8');
  ok('V6.1 the Voice Agent speaks through VoiceService.speak and reports the voice used',
    /VoiceService\.speak\(/.test(voice) && /data-testid="voice-tts-voice"/.test(voice));
  ok('V6.2 the Voice Agent shows an honest speech-output limitation',
    /data-testid="voice-tts-issue"/.test(voice) && /urdu-voice-missing/.test(voice));
  ok('V6.3 a new chat stops speech through VoiceService.stop, not a raw engine cancel',
    !/window\.speechSynthesis\.cancel\(\)/.test(chat) && /VoiceService\.stop\(\)/.test(chat));
  ok('V6.4 Read Aloud keeps its error path on the voice status line',
    /setVoiceStatus\(\{ kind: 'error', text: voiceErrorMessage\(err\?\.code/.test(chat));
}

// ---------- V7. the same legal pipeline answers voice and text ----------
{
  const fs = await import('node:fs');
  const voice = fs.readFileSync('src/components/VoiceAgentSection.tsx', 'utf8');
  ok('V7.1 the Voice Agent calls the same askLegalAgent endpoint as the Legal Agent',
    /askLegalAgent\(/.test(voice) && !/\/api\/ai\/(chat|advice|search)/.test(voice));
  const svc = fs.readFileSync('src/services/aiRuntime.ts', 'utf8');
  ok('V7.2 askLegalAgent posts to /api/ai/agent for every caller',
    /api\/ai\/agent/.test(svc));
}

console.log(`\n${passed} passed, ${failed} failed`);
console.log('NOT VERIFIED HERE (manual gates, unchanged): real microphone capture, actual Urdu pronunciation,');
console.log('background-noise behaviour and speaker quality — see docs/FINAL_MANUAL_GATE_SESSION.md GATE 3.');
process.exitCode = failed ? 1 : 0;
