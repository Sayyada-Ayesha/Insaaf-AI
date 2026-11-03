/**
 * Insaaf AI — Voice & Speech Engine (Feature 2)
 *
 * BROWSER-ONLY VOICE ARCHITECTURE (non-negotiable):
 *  - Speech-to-text: Web Speech API `SpeechRecognition` / `webkitSpeechRecognition`.
 *  - Text-to-speech: Web Speech API `speechSynthesis` using the operating system's
 *    installed voices (e.g. Windows "Microsoft Urdu" when the OS provides one).
 *  - The application makes NO external speech/AI provider API call. Any processing
 *    done by the browser or operating system underneath these APIs is not an
 *    application integration and is reported only as the engine actually used.
 *  - Capability is reported honestly: when the browser offers no Urdu voice the UI
 *    says so instead of claiming one. This app NEVER claims a "Pakistani accent".
 *
 * PIPELINE: microphone → speech recognition → language detection → normalized text
 *           → legal assistant → response → TTS.
 *
 * Failure handling: microphone permission, unsupported browser, no voice available,
 * speech API unavailable, timeout, no speech / noisy input, mixed
 * English/Roman Urdu — each surfaced with a dedicated error code.
 */

export type VoiceLangType = 'ur' | 'roman_urdu' | 'en';

export interface TextChunk {
  text: string;
  langType: VoiceLangType;
}

export interface TranscriptResult {
  text: string;
  detectedLang: VoiceLangType;
  engine: 'browser';
}

export interface VoiceCapabilities {
  browserSTT: boolean;
  browserTTS: boolean;
  urduVoiceAvailable: boolean;
  urduVoiceName: string | null;
  totalVoices: number;
}

export type VoiceErrorCode =
  | 'unsupported'
  | 'unsupported-locale'
  | 'permission-denied'
  | 'no-speech'
  | 'microphone-busy'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'tts-unavailable'
  | 'unknown';

export class VoiceError extends Error {
  code: VoiceErrorCode;
  constructor(code: VoiceErrorCode, message: string) {
    super(message);
    this.name = 'VoiceError';
    this.code = code;
  }
}

export class VoiceService {
  private static activeRecognition: any = null;

  /**
   * Incremented by stop(). speak() awaits one chunk at a time, and cancelling the
   * current utterance alone would let the very next chunk start — so every chunk
   * boundary checks this token and abandons the rest of the answer when it moved.
   */
  private static speakGeneration = 0;

  /** Honest capability snapshot used by the UI to label voice support accurately. */
  static getCapabilities(): VoiceCapabilities {
    const browserSTT = !!(typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    const browserTTS = !!(typeof window !== 'undefined' && window.speechSynthesis);
    const voices = this.getAvailableVoices();
    const urduVoice = voices.find(v => /ur/.test((v.lang || '').toLowerCase()) || /urdu/i.test(v.name || ''));
    return {
      browserSTT,
      browserTTS,
      urduVoiceAvailable: !!urduVoice,
      urduVoiceName: urduVoice ? urduVoice.name : null,
      totalVoices: voices.length
    };
  }

  /**
   * Cleans text before passing to TTS.
   * Strips HTML, Markdown formatting, bullet points, citations, and code blocks while preserving punctuation.
   */
  static cleanTextForTTS(rawText: string): string {
    if (!rawText) return "";

    return rawText
      .replace(/<[^>]*>/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\[\d+\]/g, '')
      .replace(/_{3,}/g, '')
      .replace(/-{3,}/g, '')
      .replace(/^[\s*•\-]+\s*/gm, '')
      .replace(/\n+/g, ' . ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detects text language and script type for a given text segment.
   */
  static detectLanguage(text: string, preferredLang?: string): VoiceLangType {
    const isUrduScript = /[\u0600-\u06FF]/.test(text);
    if (isUrduScript) return 'ur';

    const isRomanUrdu = /\b(kya|hai|hein|bataen|masla|mera|meri|mujhe|zaroori|tareeqa|police|thana|chahiye|pehle|baad|mutabiq|shukriya|gaya|gayi|tha|thi|the|ke|ka|ki|ko|se|per|par|aur|mein|main|ap|aap|haan|na|nahi|nahin|hum|tum|unhon|unho|us|iss|is|kiya|kara|karein|karna|karta|karte)\b/i.test(text);
    if (isRomanUrdu) return 'roman_urdu';

    const isPurelyEnglish = /^[a-zA-Z0-9\s.,!?:;@#%&*()_\-+=/\\'"[\]{}<>’“”‘`~]*$/.test(text);
    if (isPurelyEnglish) return 'en';

    if (preferredLang === 'roman_urdu') return 'roman_urdu';
    if (preferredLang === 'ur') return 'ur';
    if (preferredLang === 'en') return 'en';

    return 'en';
  }

  /**
   * Splits mixed text into script-aware chunks for multi-voice delivery.
   */
  static segmentMixedContent(text: string, preferredLang?: string): TextChunk[] {
    const cleaned = this.cleanTextForTTS(text);
    if (!cleaned) return [];

    const sentences = cleaned.split(/(?<=[.!?،؟۔])\s+/);
    const chunks: TextChunk[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      const langType = this.detectLanguage(trimmed, preferredLang);
      chunks.push({ text: trimmed, langType });
    }

    return chunks.length > 0 ? chunks : [{ text: cleaned, langType: this.detectLanguage(cleaned, preferredLang) }];
  }

  /** Retrieves all available browser SpeechSynthesis voices. */
  private static voiceCache: SpeechSynthesisVoice[] = [];
  private static voiceListenerAttached = false;

  static getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];
    const live = window.speechSynthesis.getVoices();
    // Chrome fills getVoices() asynchronously; keep the longest list seen so a
    // read that lands before voiceschanged does not report an empty device.
    if (live.length >= this.voiceCache.length) this.voiceCache = live;
    if (!this.voiceListenerAttached) {
      this.voiceListenerAttached = true;
      try {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          this.voiceCache = window.speechSynthesis.getVoices();
        });
      } catch { /* older engines expose no addEventListener */ }
    }
    return this.voiceCache;
  }

  /**
   * Resolves once the engine has populated its voice list, or after `timeoutMs`
   * if it never does — so the first Read Aloud on a fresh page is not reported as
   * "no voice on this device" merely because voices were still loading.
   */
  static whenVoicesReady(timeoutMs = 1200): Promise<SpeechSynthesisVoice[]> {
    const now = this.getAvailableVoices();
    if (now.length > 0) return Promise.resolve(now);
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          try { window.speechSynthesis.removeEventListener('voiceschanged', onChange); } catch { /* noop */ }
        }
        resolve(this.getAvailableVoices());
      };
      const onChange = () => { if (this.getAvailableVoices().length > 0) finish(); };
      const timer = setTimeout(finish, timeoutMs);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.addEventListener('voiceschanged', onChange); } catch { /* noop */ }
      }
    });
  }

  /**
   * Selects the optimal SpeechSynthesisVoice based on language detection and scoring heuristic.
   */
  static selectBestVoice(
    voices: SpeechSynthesisVoice[],
    langType: VoiceLangType
  ): { voice: SpeechSynthesisVoice | null; isGenuineUrdu: boolean; hasPlatformLimitation: boolean } {
    if (!voices || voices.length === 0) {
      return { voice: null, isGenuineUrdu: false, hasPlatformLimitation: true };
    }

    let bestVoice: SpeechSynthesisVoice | null = null;
    let maxScore = 0;
    let isGenuineUrdu = false;

    for (const v of voices) {
      let score = 0;
      const vLang = (v.lang || '').toLowerCase();
      const vName = (v.name || '').toLowerCase();

      if (langType === 'ur') {
        if (vLang.includes('ur-pk') || vName.includes('pakistan') || vName.includes('urdu (pakistan)')) {
          score += 1000;
          isGenuineUrdu = true;
        } else if (vLang.includes('ur') || vName.includes('urdu')) {
          score += 800;
          isGenuineUrdu = true;
        } else if (vLang.includes('hi-in') || vLang.includes('hi') || vName.includes('hindi')) {
          score += 500;
        } else if (vLang.includes('-in') || vLang.includes('-pk')) {
          score += 200;
        }
      } else if (langType === 'roman_urdu') {
        if (vLang.includes('ur-pk') || vLang.includes('ur')) score += 1000;
        else if (vLang.includes('hi-in') || vLang.includes('hi')) score += 800;
        else if (vLang.includes('en-pk') || vLang.includes('en-in')) score += 600;
        else if (vLang.includes('en-us') || vLang.includes('en-gb') || vLang.includes('en')) score += 300;
      } else {
        if (vLang.includes('en-pk')) score += 1000;
        else if (vLang.includes('en-us')) score += 900;
        else if (vLang.includes('en-gb')) score += 850;
        else if (vLang.includes('en')) score += 500;
      }

      if (score > maxScore) {
        maxScore = score;
        bestVoice = v;
      }
    }

    const hasPlatformLimitation = (langType === 'ur' && !isGenuineUrdu);

    return { voice: bestVoice, isGenuineUrdu, hasPlatformLimitation };
  }

  /**
   * Best-effort Urdu-script → Roman Urdu transliteration for speech transcripts.
   * Approximate phonetic mapping (Feature 2 pipeline: Urdu speech → Roman Urdu text).
   */
  static transliterateUrduToRoman(text: string): string {
    const map: Record<string, string> = {
      'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
      'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
      'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
      'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
      'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'w',
      'ہ': 'h', 'ھ': 'h', 'ء': '', 'ی': 'y', 'ے': 'e', 'ئ': 'i', 'ؤ': 'o',
      'ۃ': 'h', 'ۂ': 'a',
      '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
      '۔': '.', '،': ',', '؛': ';', '؟': '?'
    };

    const chars = Array.from(text);
    let out = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const mapped = map[ch];
      if (mapped === undefined) {
        // Diacritics and combining marks are dropped
        if (/[\u064B-\u065F\u0670]/.test(ch)) continue;
        out += ch;
        continue;
      }
      if (ch === 'ی' && (i === chars.length - 1 || !/[\u0600-\u06FF]/.test(chars[i + 1] || ''))) {
        out += 'i'; // terminal 'ی' usually reads as short i (pani, khwatin)
      } else if (ch === 'ے') {
        out += 'e';
      } else if (ch === 'و' && i === chars.length - 1) {
        out += 'o'; // terminal 'و' usually reads as o (do, ko)
      } else if (ch === 'ہ' && i === chars.length - 1) {
        out += 'a'; // terminal 'ہ' usually reads as a (kaha, safa)
      } else {
        out += mapped;
      }
    }
    return out;
  }

  /**
   * Normalizes a speech transcript: script punctuation, whitespace, and (for Urdu
   * recognition) Urdu script → Roman Urdu so the user-facing pipeline stays in
   * Latin script (Feature 1/2: Urdu Script is not forced as the chat language).
   */
  static normalizeTranscript(raw: string, lang: 'ur-PK' | 'en-US'): string {
    let text = (raw || '').trim();
    if (!text) return '';
    text = text.replace(/[،]/g, ',').replace(/[۔]/g, '.').replace(/[؟]/g, '?');

    if (lang === 'ur-PK') {
      const hasUrduScript = /[\u0600-\u06FF]/.test(text);
      if (hasUrduScript) {
        const roman = this.transliterateUrduToRoman(text);
        const latinCount = (roman.replace(/[^a-zA-Z]/g, '') || '').length;
        const coverage = latinCount / Math.max(1, text.length);
        if (coverage > 0.3) text = roman;
      }
    }

    return text.replace(/\s+/g, ' ').trim();
  }

  /** Stops an active recognition session (used to cancel listening). */
  static stopRecognition(): void {
    if (this.activeRecognition) {
      try { this.activeRecognition.abort(); } catch { /* already stopped */ }
      this.activeRecognition = null;
    }
  }

  /**
   * Speech-to-text with the full failure matrix:
   * unsupported browser / permission denied / no speech (noisy or empty input) /
   * microphone busy / network failure / timeout.
   */
  static transcribe(
    lang: 'ur-PK' | 'en-US',
    timeoutMs = 12000,
    onInterim?: (text: string) => void
  ): Promise<TranscriptResult> {
    const SR = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) {
      return Promise.reject(new VoiceError('unsupported', 'Voice input is not supported in this browser.'));
    }

    this.stopRecognition();
    const recognition = new SR();
    this.activeRecognition = recognition;
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = typeof onInterim === 'function';

    return new Promise<TranscriptResult>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { recognition.abort(); } catch { /* noop */ }
        reject(new VoiceError('timeout', 'Listening timed out. Please try again and speak clearly.'));
      }, timeoutMs);

      recognition.onstart = () => { /* listening started */ };

      recognition.onresult = (event: any) => {
        if (settled) return;
        let interim = '';
        let finalText = '';
        for (let i = 0; i < (event?.results?.length || 0); i++) {
          const result = event.results[i];
          const spoken = result?.[0]?.transcript || '';
          if (result.isFinal) finalText += spoken; else interim += spoken;
        }
        if (finalText) {
          settled = true;
          clearTimeout(timer);
          const normalized = this.normalizeTranscript(finalText, lang);
          const detectedLang = this.detectLanguage(normalized, lang === 'ur-PK' ? 'roman_urdu' : 'en');
          resolve({ text: normalized, detectedLang, engine: 'browser' });
          return;
        }
        if (interim && onInterim) onInterim(this.normalizeTranscript(interim, lang));
      };

      recognition.onerror = (event: any) => {
        if (settled) return;
        const err = event?.error || 'unknown';
        if (err === 'aborted') {
          settled = true;
          clearTimeout(timer);
          reject(new VoiceError('cancelled', 'Listening cancelled.'));
          return;
        }
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          settled = true;
          clearTimeout(timer);
          reject(new VoiceError('permission-denied', 'Microphone permission was denied. Allow microphone access in browser settings and try again.'));
          return;
        }
        if (err === 'no-speech') {
          settled = true;
          clearTimeout(timer);
          reject(new VoiceError('no-speech', 'No speech was detected. Speak clearly near the microphone.'));
          return;
        }
        if (err === 'audio-capture') {
          settled = true;
          clearTimeout(timer);
          reject(new VoiceError('microphone-busy', 'The microphone is unavailable or in use by another application.'));
          return;
        }
        if (err === 'network') {
          settled = true;
          clearTimeout(timer);
          reject(new VoiceError('network', 'The speech recognition service is unavailable. Check your connection.'));
          return;
        }
        if (err === 'language-not-supported') {
          settled = true;
          clearTimeout(timer);
          reject(new VoiceError('unsupported-locale',
            `This browser has no speech engine for ${lang}. Try the other voice language, or type your question.`));
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(new VoiceError('unknown', 'Voice input failed. Please try again.'));
      };

      recognition.onend = () => {
        if (this.activeRecognition === recognition) this.activeRecognition = null;
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new VoiceError('no-speech', 'No speech was recognized.'));
        }
      };

      try {
        recognition.start();
      } catch (e) {
        settled = true;
        clearTimeout(timer);
        reject(new VoiceError('unknown', 'Could not start the microphone.'));
      }
    });
  }

  /** Browser SpeechSynthesis chunk with a watchdog so stuck synthesis can't hang the UI. */
  private static browserSpeakChunk(text: string, langType: VoiceLangType, voices: SpeechSynthesisVoice[]): Promise<void> {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = (langType === 'ur' || langType === 'roman_urdu') ? 'ur-PK' : 'en-US';
      const { voice } = this.selectBestVoice(voices, langType);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      const estMs = Math.min(25000, Math.max(4000, text.length * 80 + 1500));
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
        resolve();
      }, estMs);

      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Speaks text through the browser SpeechSynthesis engine, chunk by chunk, using
   * the best locally available voice for each chunk's script. Roman Urdu is spoken
   * with the best available voice rather than routed to any external service.
   */
  static async speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void,
    preferredLang?: string
  ): Promise<void> {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onError) onError(new VoiceError('unsupported', 'Speech output is not supported in this browser.'));
      if (onEnd) onEnd();
      return;
    }

    this.stop();
    const generation = VoiceService.speakGeneration;

    const activePreferredLang = preferredLang || (typeof localStorage !== 'undefined' ? localStorage.getItem('insaaf_lang') || undefined : undefined);
    const chunks = this.segmentMixedContent(text, activePreferredLang);
    if (chunks.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    const voices = await this.whenVoicesReady();
    if (voices.length === 0) {
      if (onError) onError(new VoiceError('tts-unavailable', 'No voice is available on this device.'));
      if (onEnd) onEnd();
      return;
    }

    let started = false;

    for (const chunk of chunks) {
      if (generation !== VoiceService.speakGeneration) break;
      try {
        await this.browserSpeakChunk(chunk.text, chunk.langType, voices);
        if (!started) {
          started = true;
          if (onStart) onStart();
        }
      } catch (err) {
        if (onError) onError(err);
      }
      if (generation !== VoiceService.speakGeneration) break;
    }

    if (onEnd) onEnd();
  }

  /** Stops ongoing speech (browser engine) and abandons any chunks not yet started. */
  static stop(): void {
    VoiceService.speakGeneration++;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
