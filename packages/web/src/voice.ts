import { pref } from './store';

/**
 * Voices for coaches and bots.
 *  - Default: the browser's built-in speech engine (free, instant, offline-capable).
 *  - "HD voices": neural Piper voices running in the browser (vits-web). Each character gets a
 *    distinct model; it downloads once (~20–60 MB per voice) and is cached on the device.
 */
type PiperVoice =
  | 'en_US-ryan-medium'
  | 'en_GB-alan-medium'
  | 'en_GB-northern_english_male-medium'
  | 'en_US-hfc_male-medium'
  | 'en_US-kusal-medium'
  | 'en_US-joe-medium'
  | 'en_US-lessac-medium'
  | 'en_US-amy-medium'
  | 'en_US-kristin-medium'
  | 'en_GB-alan-low'
  | 'en_US-ryan-high';

interface Profile {
  piper: PiperVoice;
  /** Browser-voice shaping. */
  pitch: number;
  rate: number;
  /** Preferred system voices, most specific first. */
  prefer: RegExp[];
  female?: boolean;
}

const MALE = [/Google UK English Male/i, /Daniel/i, /Microsoft (Guy|Ryan|Christopher|Eric)/i, /Alex/i, /Fred/i, /male/i];
const FEMALE = [/Google US English/i, /Samantha/i, /Microsoft (Aria|Jenny|Zira)/i, /Karen/i, /female/i];

export const VOICES: Record<string, Profile> = {
  // coaches
  kiyo: { piper: 'en_US-ryan-medium', pitch: 0.8, rate: 0.9, prefer: MALE },
  lumen: { piper: 'en_GB-alan-medium', pitch: 1.0, rate: 1.0, prefer: [/Google UK English Male/i, /Daniel/i, ...MALE] },
  karasu: { piper: 'en_GB-northern_english_male-medium', pitch: 0.7, rate: 0.85, prefer: MALE },
  tenka: { piper: 'en_US-hfc_male-medium', pitch: 0.5, rate: 0.92, prefer: MALE },
  flint: { piper: 'en_US-kusal-medium', pitch: 1.3, rate: 1.18, prefer: MALE },
  shuji: { piper: 'en_US-joe-medium', pitch: 1.12, rate: 1.05, prefer: MALE },
  namenlos: { piper: 'en_US-lessac-medium', pitch: 0.9, rate: 0.82, prefer: MALE },
  // bots
  showman: { piper: 'en_US-ryan-high', pitch: 1.2, rate: 1.1, prefer: MALE },
  diplomat: { piper: 'en_GB-alan-low', pitch: 1.0, rate: 0.95, prefer: [/Google UK English Male/i, ...MALE] },
  bookworm: { piper: 'en_US-kristin-medium', pitch: 1.1, rate: 1.05, prefer: FEMALE, female: true },
  professor: { piper: 'en_GB-northern_english_male-medium', pitch: 0.85, rate: 0.88, prefer: MALE },
  underdog: { piper: 'en_US-amy-medium', pitch: 1.2, rate: 1.0, prefer: FEMALE, female: true },
  warlord: { piper: 'en_US-hfc_male-medium', pitch: 0.45, rate: 0.9, prefer: MALE },
  narrator: { piper: 'en_US-lessac-medium', pitch: 1.0, rate: 1.0, prefer: MALE },
};

let current: HTMLAudioElement | null = null;
let token = 0;
const listeners = new Set<(who: string | null) => void>();

/** Subscribe to "who is speaking" changes (for avatar glow). */
export function onSpeaking(fn: (who: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = (who: string | null) => listeners.forEach((l) => l(who));

export function voiceOn(): boolean {
  return pref('voice', true);
}

export function stopSpeaking(): void {
  token++;
  try {
    speechSynthesis.cancel();
  } catch {
    /* unsupported */
  }
  current?.pause();
  current = null;
  emit(null);
}

function pickBrowserVoice(p: Profile, who: string): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (!voices.length) return undefined;
  for (const re of p.prefer) {
    const hits = voices.filter((v) => re.test(v.name));
    if (hits.length) return hits[[...who].reduce((a, c) => a + c.charCodeAt(0), 0) % hits.length];
  }
  return voices[[...who].reduce((a, c) => a + c.charCodeAt(0), 0) % voices.length];
}

/** Speak `text` as `who` (a coach or bot id). Interrupts whatever was playing. */
export async function speak(who: string, text: string, opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force && !voiceOn()) return;
  const clean = text.replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  stopSpeaking();
  const my = ++token;
  const p = VOICES[who] ?? VOICES.narrator;
  if (pref('hdVoices', false)) {
    try {
      const tts = await import('@diffusionstudio/vits-web');
      const wav = await tts.predict({ text: clean, voiceId: p.piper });
      if (my !== token) return;
      const audio = new Audio(URL.createObjectURL(wav));
      audio.playbackRate = Math.max(0.8, Math.min(1.25, p.rate));
      current = audio;
      emit(who);
      audio.onended = () => my === token && emit(null);
      await audio.play();
      return;
    } catch {
      /* fall back to the browser voice */
    }
  }
  try {
    const u = new SpeechSynthesisUtterance(clean);
    const v = pickBrowserVoice(p, who);
    if (v) u.voice = v;
    u.pitch = p.pitch;
    u.rate = p.rate;
    u.onstart = () => my === token && emit(who);
    u.onend = () => my === token && emit(null);
    speechSynthesis.speak(u);
  } catch {
    /* no speech support */
  }
}

/** Pre-download HD voices so the first line plays instantly. */
export async function warmHdVoice(who: string, onProgress?: (pct: number) => void): Promise<void> {
  const tts = await import('@diffusionstudio/vits-web');
  await tts.download((VOICES[who] ?? VOICES.narrator).piper, (p) => onProgress?.(Math.round((100 * p.loaded) / Math.max(1, p.total))));
}

// Some browsers load voices lazily.
try {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
} catch {
  /* unsupported */
}

/* ------------------------------------------------------------------ listening (Voice Mode) */

type Rec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function canListen(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Listen continuously and hand every final phrase (with alternatives) to `onPhrase`.
 * Returns a stop function.
 */
export function listen(onPhrase: (alternatives: string[]) => void, onState?: (s: 'listening' | 'stopped' | 'error', msg?: string) => void): () => void {
  const w = window as unknown as Record<string, new () => Rec>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    onState?.('error', 'Speech recognition is not supported in this browser (try Chrome or Edge).');
    return () => {};
  }
  let stopped = false;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';
  rec.maxAlternatives = 5;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (!r.isFinal) continue;
      const alts: string[] = [];
      for (let j = 0; j < r.length; j++) alts.push(r[j].transcript);
      onPhrase(alts);
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed') {
      stopped = true;
      onState?.('error', 'Microphone permission denied.');
    }
  };
  rec.onend = () => {
    if (!stopped) {
      try {
        rec.start(); // keep listening (browsers end sessions after silence)
      } catch {
        /* already started */
      }
    } else onState?.('stopped');
  };
  try {
    rec.start();
    onState?.('listening');
  } catch {
    onState?.('error', 'Could not start the microphone.');
  }
  return () => {
    stopped = true;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  };
}
