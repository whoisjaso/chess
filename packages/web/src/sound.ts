import { pref } from './store';

/** Synthesised board sounds (original; no audio files). */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!pref('sound', true)) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A short wooden "tock": filtered noise burst + low body resonance. */
function tock(c: AudioContext, at: number, gain = 0.5, pitch = 1): void {
  const len = 0.09;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 6);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400 * pitch;
  bp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(c.destination);
  src.start(at);

  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(220 * pitch, at);
  osc.frequency.exponentialRampToValueAtTime(110 * pitch, at + 0.08);
  const og = c.createGain();
  og.gain.setValueAtTime(gain * 0.35, at);
  og.gain.exponentialRampToValueAtTime(0.001, at + 0.1);
  osc.connect(og).connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.12);
}

function tone(c: AudioContext, at: number, f: number, dur: number, gain = 0.15): void {
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = f;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export type Sound = 'move' | 'capture' | 'check' | 'castle' | 'start' | 'end' | 'correct' | 'wrong' | 'notify';

export function play(s: Sound): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.005;
  switch (s) {
    case 'move':
      return tock(c, t, 0.55);
    case 'capture':
      tock(c, t, 0.7, 0.85);
      return tock(c, t + 0.045, 0.45, 1.1);
    case 'castle':
      tock(c, t, 0.5);
      return tock(c, t + 0.09, 0.5, 1.05);
    case 'check':
      tock(c, t, 0.6);
      return tone(c, t + 0.02, 880, 0.18, 0.08);
    case 'start':
      tone(c, t, 523, 0.18);
      return tone(c, t + 0.12, 784, 0.28);
    case 'end':
      tone(c, t, 784, 0.18);
      return tone(c, t + 0.14, 523, 0.35);
    case 'correct':
      tone(c, t, 659, 0.12);
      return tone(c, t + 0.1, 988, 0.25);
    case 'wrong':
      return tone(c, t, 196, 0.3, 0.12);
    case 'notify':
      return tone(c, t, 988, 0.15, 0.08);
  }
}

/** Pick the right sound for a SAN move. */
export function moveSound(san: string): void {
  if (san.includes('#') || san.includes('+')) play('check');
  else if (san.startsWith('O-O')) play('castle');
  else if (san.includes('x')) play('capture');
  else play('move');
}
