import { describe, expect, it } from 'vitest';
import { INITIAL_EPD, importPgn } from '@mainline/shared';
import { TEMPLATES } from './templates';

describe('ready-made repertoires', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s is legal, substantial and never contradicts itself', (_id, t) => {
    const res = importPgn(t.pgn, { id: 'x', color: t.color, rootEpd: INITIAL_EPD });
    expect(res.errors).toEqual([]);
    expect(res.moves.length).toBeGreaterThan(t.starter ? 10 : 40);
    // One answer per position on your side, even where lines transpose into each other.
    const turn = t.color === 'white' ? 'w' : 'b';
    const own = new Map<string, Set<string>>();
    for (const m of res.moves) if (m.fromEpd.split(' ')[1] === turn) (own.get(m.fromEpd) ?? own.set(m.fromEpd, new Set()).get(m.fromEpd)!).add(m.san);
    const twice = [...own].filter(([, s]) => s.size > 1).map(([epd, s]) => `${epd}: ${[...s].join('/')}`);
    expect(twice).toEqual([]);
  });

  it('has unique ids', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
});
