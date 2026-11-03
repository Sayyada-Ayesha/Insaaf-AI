/**
 * Part Z: Centralized user settings store.
 *
 * Every setting here is REAL: it persists to localStorage, broadcasts a change
 * event so all components re-render, and is wired to actual behaviour somewhere
 * in the app (no fake toggles). Settings:
 *   - responseDetail : 'concise' | 'standard' | 'detailed'  → answer verbosity
 *   - autoSaveChats  : boolean                              → vault auto-save
 *   - voiceAutoRead  : boolean                              → auto TTS of answers
 *   - fontSize       : 'standard' | 'larger'                 → root text scaling
 *   - reducedMotion  : boolean                              → disable animations
 *   - overseasMode   : boolean  → always apply Pakistan+foreign cross-border
 *                                  jurisdiction framing in Chat/Agent answers
 *   - preferredCountry: string   → country of residence used to tailor overseas
 *                                  guidance (never used to fabricate its law)
 *   - showSourceDetails: boolean → show/hide the "Sources" citation panel
 *   - answerLevel    : 'beginner' | 'intermediate' | 'advanced' → HOW deeply a
 *       legal answer is explained (difficulty). Separate from responseDetail,
 *       which only sets verbosity. It never changes which records are evidence.
 */
import { useEffect, useReducer } from 'react';

export type ResponseDetail = 'concise' | 'standard' | 'detailed';
export type FontSize = 'standard' | 'larger';
export type AnswerLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Settings {
  responseDetail: ResponseDetail;
  autoSaveChats: boolean;
  voiceAutoRead: boolean;
  fontSize: FontSize;
  reducedMotion: boolean;
  overseasMode: boolean;
  preferredCountry: string;
  showSourceDetails: boolean;
  answerLevel: AnswerLevel;
}

export const SETTINGS_CHANGED_EVENT = 'insaaf_settings_changed';

const STORAGE_KEY = 'insaaf_settings';

export const DEFAULT_SETTINGS: Settings = {
  responseDetail: 'standard',
  autoSaveChats: true,
  voiceAutoRead: false,
  fontSize: 'standard',
  reducedMotion: false,
  overseasMode: false,
  preferredCountry: '',
  showSourceDetails: true,
  answerLevel: 'beginner',
};

function readSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Apply the visual settings (font size + reduced motion) to the document root. */
function applyVisualSettings(s: Settings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('insaaf-font-large', s.fontSize === 'larger');
  root.classList.toggle('insaaf-reduced-motion', s.reducedMotion);
}

let current: Settings = readSettings();
applyVisualSettings(current);

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  current = { ...current, ...patch };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  }
  applyVisualSettings(current);
  return current;
}

export function clearLocalData() {
  if (typeof window === 'undefined') return;
  // Preserve nothing user-facing: clear all insaaf_* keys, then restore defaults.
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith('insaaf_')) keys.push(k);
  }
  keys.forEach(k => window.localStorage.removeItem(k));
  current = DEFAULT_SETTINGS;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  applyVisualSettings(current);
}

/**
 * React hook: subscribes a component to settings changes. Returns the live
 * settings object; re-renders the component whenever any setting changes.
 */
export function useSettings(): Settings {
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const handler = () => forceRender();
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return current;
}
