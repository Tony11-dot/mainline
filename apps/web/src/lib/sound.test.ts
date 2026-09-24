import { describe, expect, it } from 'vitest';
import { renderSound, type SoundKind } from './sound';

const kinds: SoundKind[] = ['move', 'capture', 'check', 'castle', 'promote', 'error', 'correct', 'complete'];

describe('synthesized sounds', () => {
  it.each(kinds)('%s is short, not clipping, and silent at the tail', (k) => {
    const s = renderSound(k);
    let peak = 0;
    let energyFirst80 = 0;
    let energyTotal = 0;
    for (let i = 0; i < s.length; i++) {
      const v = Math.abs(s[i]!);
      peak = Math.max(peak, v);
      energyTotal += v * v;
      if (i < 0.08 * 44100) energyFirst80 += v * v;
    }
    expect(peak).toBeLessThanOrEqual(0.71);
    expect(peak).toBeGreaterThan(0.3);
    expect(Math.abs(s[s.length - 1]!)).toBeLessThan(1e-3);
    // Board sounds must be percussive: most energy in the first 80 ms.
    if (['move', 'capture', 'error'].includes(k)) expect(energyFirst80 / energyTotal).toBeGreaterThan(0.85);
  });
});
