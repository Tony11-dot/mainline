import { describe, expect, it } from 'vitest';
import { importPgn, rootFromMoves, type PlayedGame } from '@mainline/shared';
import { PACKS, packMoves, weakSpots } from './packs';

describe('ready-made openings', () => {
  it.each(PACKS.map((p) => [p.id, p] as const))('%s: every line is legal, starts in its opening, and the lines never disagree on your move', (_id, p) => {
    const root = rootFromMoves(packMoves(p)).epd;
    const turn = p.color === 'white' ? 'w' : 'b';
    const own = new Map<string, Set<string>>();
    for (const l of p.lines) {
      const res = importPgn(l.pgn, { id: l.id, color: p.color, rootEpd: root });
      expect(res.errors, l.id).toEqual([]);
      expect(res.moves.length, `${l.id} reaches its opening`).toBeGreaterThan(3);
      for (const m of res.moves) if (m.fromEpd.split(' ')[1] === turn) (own.get(m.fromEpd) ?? own.set(m.fromEpd, new Set()).get(m.fromEpd)!).add(m.san);
    }
    const twice = [...own].filter(([, s]) => s.size > 1).map(([epd, s]) => `${epd}: ${[...s].join('/')}`);
    expect(twice).toEqual([]);
  });

  it('has unique pack ids and line ids within each pack', () => {
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(PACKS.length);
    for (const p of PACKS) expect(new Set(p.lines.map((l) => l.id)).size).toBe(p.lines.length);
  });

  it('finds the opening that costs you the most points and offers its packs', () => {
    const game = (color: 'white' | 'black', ucis: string[], result: PlayedGame['result'], i: number): PlayedGame => ({ id: `g${i}`, site: 'lichess', url: '', color, opponent: 'x', result, speed: 'blitz', playedAt: i, ucis });
    const games = [
      ...Array.from({ length: 10 }, (_, i) => game('black', ['e2e4', 'c7c5'], i < 8 ? 'loss' : 'win', i)),
      ...Array.from({ length: 6 }, (_, i) => game('white', ['e2e4', 'c7c6'], i < 4 ? 'loss' : 'draw', 100 + i)),
      ...Array.from({ length: 2 }, (_, i) => game('white', ['d2d4', 'd7d5'], 'loss', 200 + i)),
    ];
    const spots = weakSpots(games);
    expect(spots.map((s) => `${s.color} ${s.first} ${s.reply}`)).toEqual(['black e4 c5', 'white e4 c6']);
    expect(spots[0]!.score).toBeCloseTo(0.2);
    expect(spots[0]!.packs.map((p) => p.id)).toContain('b-najdorf');
  });
});
