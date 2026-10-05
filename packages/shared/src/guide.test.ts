import { describe, expect, it } from 'vitest';
import { bundleEngine, guideCandidates, guideMoves, guideReply, mergeEngine, scoreLowerBound } from './guide';
import type { ExplorerData } from './api';

const ex = (moves: [string, number, number, number][], source: ExplorerData['source'] = 'lichess'): ExplorerData => {
  const ms = moves.map(([uci, w, d, b]) => ({ uci, san: uci, white: w, draws: d, black: b, total: w + d + b }));
  const t = ms.reduce((a, m) => a + m.total, 0);
  return { source, epd: '', white: 0, draws: 0, black: 0, total: t, moves: ms, topGames: [], opening: null, fetchedAt: '', cached: false };
};

describe('guideCandidates', () => {
  const lichess = ex([['e2e4', 500, 100, 400], ['d2d4', 400, 150, 350], ['b2b3', 40, 5, 20], ['g2g4', 200, 20, 300]]);
  const masters = ex([['e2e4', 400, 400, 200], ['d2d4', 500, 400, 200]], 'masters');
  const engineLines = [{ moves: ['d2d4'], cp: 30 }, { moves: ['e2e4'], cp: 28 }, { moves: ['b2b3'], cp: 5 }, { moves: ['g2g4'], cp: -110 }];

  it('tags the book move, the engine pick, hidden gems and dubious tries', () => {
    const c = guideCandidates({ color: 'white', engineLines, engineDepth: 30, lichess, masters });
    const tags = Object.fromEntries(c.map((x) => [x.uci, x.tags]));
    expect(tags['d2d4']).toContain('book');
    expect(tags['d2d4']).toContain('engine');
    expect(tags['b2b3']).toContain('gem');
    expect(tags['g2g4']).toContain('dubious');
    expect(tags['g2g4']![0]).toBe('dubious');
    expect(c.find((x) => x.uci === 'e2e4')!.line?.cp).toBe(28);
  });

  it('shows what you played in your own games, tagging what works for you and what gives you trouble', () => {
    const mine = new Map([['e2e4', { games: 8, score: 0.7 }], ['d2d4', { games: 4, score: 0.25 }], ['h2h4', { games: 2, score: 1 }]]);
    const c = guideCandidates({ color: 'white', engineLines, engineDepth: 30, lichess, masters, mine });
    const by = Object.fromEntries(c.map((x) => [x.uci, x]));
    expect(by['e2e4']!.tags).toContain('proven');
    expect(by['e2e4']!.mine).toEqual({ games: 8, score: 0.7 });
    expect(by['d2d4']!.tags).toContain('trouble');
    // Not in any database, but you've played it twice: it still shows, without a "works for you" claim.
    expect(by['h2h4']).toBeDefined();
    expect(by['h2h4']!.tags).not.toContain('proven');
  });

  it('marks moves already in (or fitting) your repertoires', () => {
    const c = guideCandidates({ color: 'white', engineLines, lichess, masters, inRep: new Set(['e2e4']), fitsRep: new Set(['d2d4']) });
    expect(c.find((x) => x.uci === 'e2e4')!.tags[0]).toBe('yours');
    expect(c.find((x) => x.uci === 'd2d4')!.tags[0]).toBe('fits');
  });

  it('holds engine tags back until the search is deep enough', () => {
    const c = guideCandidates({ color: 'white', engineLines, engineDepth: 10, lichess, masters });
    const all = c.flatMap((x) => x.tags);
    for (const t of ['engine', 'gem', 'dubious', 'club', 'surprise'] as const) expect(all).not.toContain(t);
    expect(c.find((x) => x.uci === 'd2d4')!.tags).toContain('book');
  });

  it('only calls a move a club crusher when the score beats luck and the engine agrees', () => {
    const l = ex([['e2e4', 60, 10, 30], ['d2d4', 700, 100, 200], ['c2c4', 300, 100, 600]]);
    const lines = [{ moves: ['d2d4'], cp: 25 }, { moves: ['e2e4'], cp: 30 }, { moves: ['c2c4'], cp: 20 }];
    const tags = Object.fromEntries(guideCandidates({ color: 'white', engineLines: lines, engineDepth: 30, lichess: l }).map((x) => [x.uci, x.tags]));
    expect(tags['d2d4']).toContain('club');
    // e4's 65% over 100 games is less certain than d4's 75% over 1000; c4 scores under 50%.
    expect(tags['e2e4']).not.toContain('club');
    expect(tags['c2c4']).not.toContain('club');
    // Unsound moves never get it, however well they score.
    const bad = guideCandidates({ color: 'white', engineLines: [{ moves: ['e2e4'], cp: 30 }, { moves: ['d2d4'], cp: -90 }], engineDepth: 30, lichess: l });
    expect(bad.find((x) => x.uci === 'd2d4')!.tags).not.toContain('club');
  });

  it('needs enough master games before calling a move rare or a gem', () => {
    const fewMasters = ex([['d2d4', 5, 5, 5]], 'masters');
    const c = guideCandidates({ color: 'white', engineLines, engineDepth: 30, lichess, masters: fewMasters });
    expect(c.flatMap((x) => x.tags)).not.toContain('gem');
    expect(c.flatMap((x) => x.tags)).not.toContain('book');
  });

  it('leaves out unevaluated moves with too few games once the engine has spoken', () => {
    const l = ex([['e2e4', 500, 100, 400], ['h2h3', 2, 3, 5]]);
    const lines = [{ moves: ['e2e4'], cp: 30 }];
    expect(guideCandidates({ color: 'white', engineLines: lines, engineDepth: 30, lichess: l }).map((c) => c.uci)).toEqual(['e2e4']);
    expect(guideCandidates({ color: 'white', engineLines: lines, engineDepth: 30, lichess: l, inRep: new Set(['h2h3']) }).map((c) => c.uci)).toContain('h2h3');
  });

  it('caps the list', () => {
    expect(guideCandidates({ color: 'white', engineLines, lichess, masters, max: 2 })).toHaveLength(2);
  });
});

describe('bundles', () => {
  it('uses the parent lines first, then the eval after each move', () => {
    const e = bundleEngine({
      epd: '',
      eval: { epd: '', depth: 40, source: 'cloud', lines: [{ moves: ['e2e4', 'e7e5'], cp: 30 }] },
      children: { e2e4: { epd: '', depth: 50, source: 'cloud', lines: [{ moves: ['c7c5'], cp: 10 }] }, d2d4: { epd: '', depth: 25, source: 'cloud', lines: [{ moves: ['g8f6'], cp: 20 }] }, g2g4: null },
    });
    expect(e.lines).toEqual([{ moves: ['e2e4', 'e7e5'], cp: 30 }, { moves: ['d2d4', 'g8f6'], cp: 20 }]);
    expect(e.depth).toBe(25);
  });
  it('fills gaps from a local search and keeps the shallowest depth', () => {
    const m = mergeEngine({ lines: [{ moves: ['e2e4'], cp: 30 }], depth: 40 }, { lines: [{ moves: ['e2e4'], cp: 0 }, { moves: ['b2b3'], cp: 0 }], depth: 12 });
    expect(m.lines.map((l) => l.moves[0])).toEqual(['e2e4', 'b2b3']);
    expect(m.depth).toBe(12);
  });
  it('picks the popular moves to evaluate', () => {
    const l = ex([['e2e4', 9, 0, 0], ['d2d4', 5, 0, 0]]);
    const m = ex([['c2c4', 3, 0, 0], ['d2d4', 9, 0, 0]], 'masters');
    expect(guideMoves(l, m, 3).sort()).toEqual(['c2c4', 'd2d4', 'e2e4']);
  });
  it('lower bound shrinks with fewer games', () => {
    expect(scoreLowerBound(0.6, 50)).toBeLessThan(scoreLowerBound(0.6, 5000));
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
