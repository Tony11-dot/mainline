import { describe, expect, it } from 'vitest';
import { guideCandidates, guideReply } from './guide';
import type { ExplorerData } from './api';

const ex = (moves: [string, number, number, number][], source: ExplorerData['source'] = 'lichess'): ExplorerData => {
  const ms = moves.map(([uci, w, d, b]) => ({ uci, san: uci, white: w, draws: d, black: b, total: w + d + b }));
  const t = ms.reduce((a, m) => a + m.total, 0);
  return { source, epd: '', white: 0, draws: 0, black: 0, total: t, moves: ms, topGames: [], opening: null, fetchedAt: '', cached: false };
};

describe('guideCandidates', () => {
  const lichess = ex([['e2e4', 500, 100, 400], ['d2d4', 400, 150, 350], ['b2b3', 40, 5, 20], ['g2g4', 200, 20, 300]]);
  const masters = ex([['e2e4', 400, 400, 200], ['d2d4', 500, 400, 200]], 'masters');
  const engineLines = [{ moves: ['d2d4'], cp: 30 }, { moves: ['e2e4'], cp: 28 }, { moves: ['b2b3'], cp: 20 }, { moves: ['g2g4'], cp: -110 }];

  it('tags the book move, the engine pick, hidden gems and risky tries', () => {
    const c = guideCandidates({ color: 'white', engineLines, lichess, masters });
    const tags = Object.fromEntries(c.map((x) => [x.uci, x.tags]));
    expect(tags['d2d4']).toContain('book');
    expect(tags['d2d4']).toContain('engine');
    expect(tags['b2b3']).toContain('gem');
    expect(tags['g2g4']).toContain('risky');
    expect(c.find((x) => x.uci === 'e2e4')!.line?.cp).toBe(28);
  });

  it('marks moves already in (or fitting) your repertoires', () => {
    const c = guideCandidates({ color: 'white', engineLines, lichess, masters, inRep: new Set(['e2e4']), fitsRep: new Set(['d2d4']) });
    expect(c.find((x) => x.uci === 'e2e4')!.tags[0]).toBe('yours');
    expect(c.find((x) => x.uci === 'd2d4')!.tags[0]).toBe('fits');
  });

  it('caps the list', () => {
    expect(guideCandidates({ color: 'white', engineLines, lichess, masters, max: 2 })).toHaveLength(2);
  });
});

describe('guideReply', () => {
  it('prefers what players at your level answer most', () => {
    expect(guideReply({ lichess: ex([['e7e5', 10, 0, 5], ['c7c5', 30, 2, 20]]) })).toBe('c7c5');
  });
  it('falls back to masters, then the engine', () => {
    expect(guideReply({ masters: ex([['e7e6', 1, 1, 1]], 'masters') })).toBe('e7e6');
    expect(guideReply({ engineLines: [{ moves: ['g8f6'], cp: 0 }] })).toBe('g8f6');
    expect(guideReply({})).toBeUndefined();
  });
});
