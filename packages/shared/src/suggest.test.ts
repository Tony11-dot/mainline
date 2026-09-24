import { describe, expect, it } from 'vitest';
import { popularReplies, rankMoves } from './suggest';
import type { ExplorerData } from './api';

const ex = (moves: [string, number, number, number][], source: ExplorerData['source'] = 'lichess'): ExplorerData => {
  const ms = moves.map(([uci, w, d, b]) => ({ uci, san: uci, white: w, draws: d, black: b, total: w + d + b }));
  const t = ms.reduce((a, m) => a + m.total, 0);
  return { source, epd: '', white: 0, draws: 0, black: 0, total: t, moves: ms, topGames: [], opening: null, fetchedAt: '', cached: false };
};

describe('rankMoves', () => {
  it('combines engine, practical and master signals', () => {
    const r = rankMoves({
      color: 'white',
      engineLines: [{ moves: ['e2e4'], cp: 30 }, { moves: ['d2d4'], cp: 25 }, { moves: ['g2g4'], cp: -90 }],
      lichess: ex([['e2e4', 55, 5, 40], ['d2d4', 50, 10, 40], ['g2g4', 40, 5, 55]]),
      masters: ex([['e2e4', 40, 40, 20], ['d2d4', 45, 40, 15]], 'masters'),
    });
    expect(r[0]!.uci).toBe('e2e4');
    expect(r.at(-1)!.uci).toBe('g2g4');
    expect(r[0]!.practical).toBeCloseTo(0.575);
  });

  it('uses black POV for black', () => {
    const r = rankMoves({ color: 'black', engineLines: [{ moves: ['c7c5'], cp: 30 }, { moves: ['e7e5'], cp: 10 }] });
    expect(r[0]!.uci).toBe('e7e5');
  });

  it('ignores tiny samples', () => {
    const r = rankMoves({ color: 'white', lichess: ex([['a2a3', 5, 0, 0]]) });
    expect(r).toHaveLength(0);
  });
});

describe('popularReplies', () => {
  it('filters by share', () => {
    const d = ex([['c7c5', 50, 0, 50], ['e7e5', 30, 0, 30], ['a7a6', 2, 0, 1]]);
    expect(popularReplies(d, 0.1).map((m) => m.uci)).toEqual(['c7c5', 'e7e5']);
  });
});
