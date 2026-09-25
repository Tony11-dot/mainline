/**
 * Board sounds, synthesized once into AudioBuffers (no third-party sound assets; we own these).
 * A "tock" is a short band-passed noise transient over a low body resonance — the sound of a wooden
 * piece set down on a board. Latency matters more than fidelity: buffers are pre-rendered and played
 * through a single shared AudioContext.
 */
import { usePrefs } from './prefs';

export type SoundKind = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'error' | 'correct' | 'complete' | 'streak';

const SR = 44100;
let ctx: AudioContext | undefined;
let buffers: Partial<Record<SoundKind, AudioBuffer>> = {};
let rendering: Promise<void> | undefined;

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

/** Wooden tap: filtered noise transient + decaying body tone. Pure DSP, deterministic. */
function tock(out: Float32Array, at: number, { gain = 1, body = 170, bright = 2200, decay = 0.045, seed = 7 } = {}) {
  const start = Math.floor(at * SR);
  const n = Math.floor(0.12 * SR);
  const rand = rng(seed);
  // 2-pole band-pass (RBJ) over white noise
  const w0 = (2 * Math.PI * bright) / SR;
  const q = 1.1;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    const noiseEnv = Math.exp(-t / 0.0045);
    const x = rand() * noiseEnv;
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    const attack = Math.min(1, t / 0.0008);
    const bodyTone = Math.sin(2 * Math.PI * body * t) * Math.exp(-t / decay) * 0.55 + Math.sin(2 * Math.PI * body * 2.02 * t) * Math.exp(-t / (decay * 0.5)) * 0.18;
    out[start + i]! += gain * attack * (y * 1.6 + bodyTone);
  }
}

function chime(out: Float32Array, at: number, freqs: number[], { gain = 0.16, dur = 0.35, gap = 0 } = {}) {
  freqs.forEach((f, k) => {
    const start = Math.floor((at + k * gap) * SR);
    const n = Math.floor(dur * SR);
    for (let i = 0; i < n && start + i < out.length; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.004) * Math.exp(-t / (dur / 4));
      out[start + i]! += gain * env * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t));
    }
  });
}

function thud(out: Float32Array, at: number) {
  const start = Math.floor(at * SR);
  const n = Math.floor(0.16 * SR);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    const f = 150 - 60 * (t / 0.16);
    const env = Math.min(1, t / 0.003) * Math.exp(-t / 0.05);
    out[start + i]! += 0.5 * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 3 * t));
  }
}

export function renderSound(kind: SoundKind): Float32Array {
  const out = new Float32Array(Math.floor(0.5 * SR));
  switch (kind) {
    case 'move':
      tock(out, 0, { gain: 0.8 });
      break;
    case 'capture':
      tock(out, 0, { gain: 0.95, body: 150, bright: 1700, seed: 11 });
      tock(out, 0.028, { gain: 0.5, body: 210, bright: 2600, decay: 0.03, seed: 23 });
      break;
    case 'castle':
      tock(out, 0, { gain: 0.7, seed: 3 });
      tock(out, 0.085, { gain: 0.75, body: 160, seed: 5 });
      break;
    case 'check':
      tock(out, 0, { gain: 0.85, seed: 13 });
      chime(out, 0.01, [1318.5], { gain: 0.07, dur: 0.3 });
      break;
    case 'promote':
      tock(out, 0, { gain: 0.8, seed: 17 });
      chime(out, 0.02, [987.8, 1318.5], { gain: 0.08, dur: 0.3, gap: 0.07 });
      break;
    case 'error':
      thud(out, 0);
      break;
    case 'correct':
      chime(out, 0, [880, 1318.5], { gain: 0.12, dur: 0.32, gap: 0.075 });
      break;
    case 'complete':
      chime(out, 0, [659.3, 880, 1318.5], { gain: 0.11, dur: 0.5, gap: 0.09 });
      break;
    case 'streak':
      // A rising major arpeggio that lands on a bright octave: the "streak extended" fanfare.
      chime(out, 0, [523.3, 659.3, 784, 1046.5], { gain: 0.1, dur: 0.42, gap: 0.075 });
      chime(out, 0.3, [1568], { gain: 0.06, dur: 0.2 });
      break;
  }
  // Normalize to a safe peak and fade the tail to avoid clicks.
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const target = kind === 'correct' || kind === 'complete' || kind === 'streak' ? 0.5 : 0.7;
  const k = peak > 0 ? target / peak : 1;
  const fade = Math.floor(0.02 * SR);
  for (let i = 0; i < out.length; i++) {
    out[i]! *= k * (i > out.length - fade ? (out.length - i) / fade : 1);
  }
  return out;
}

function ensureContext(): AudioContext | undefined {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return undefined;
  ctx = new AC({ latencyHint: 'interactive' });
  return ctx;
}

function prepare() {
  if (rendering) return rendering;
  rendering = (async () => {
    const c = ensureContext();
    if (!c) return;
    const kinds: SoundKind[] = ['move', 'capture', 'check', 'castle', 'promote', 'error', 'correct', 'complete', 'streak'];
    const next: typeof buffers = {};
    for (const k of kinds) {
      const data = renderSound(k);
      const buf = c.createBuffer(1, data.length, SR);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      next[k] = buf;
    }
    buffers = next;
  })();
  return rendering;
}

/** iOS/Safari only allow audio after a user gesture: unlock on the first touch/click/key. */
export function installAudioUnlock() {
  const unlock = () => {
    const c = ensureContext();
    if (c?.state === 'suspended') void c.resume();
    void prepare();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, unlock, { capture: true, passive: true });
}

export function playSound(kind: SoundKind) {
  (window as unknown as { __mlSoundLog?: string[] }).__mlSoundLog?.push(kind);
  const { sound, volume } = usePrefs.getState();
  if (!sound) return;
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const buf = buffers[kind];
  if (!buf) {
    void prepare().then(() => playSoundNow(kind, volume));
    return;
  }
  playSoundNow(kind, volume);
}

function playSoundNow(kind: SoundKind, volume: number) {
  const c = ctx;
  const buf = buffers[kind];
  if (!c || !buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = volume;
  src.connect(g).connect(c.destination);
  src.start();
}

export function soundForMove(m: { capture: boolean; check: boolean; castle: boolean; promotion?: boolean }): SoundKind {
  if (m.check) return 'check';
  if (m.promotion) return 'promote';
  if (m.castle) return 'castle';
  if (m.capture) return 'capture';
  return 'move';
}
