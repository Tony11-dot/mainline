import { describe, expect, it } from 'vitest';
import { importPgn, playLine, rootFromMoves, INITIAL_FEN, type PlayedGame, type Repertoire, type ReviewEntry } from '@mainline/shared';
import { analyseWeakness, rate } from './weakness';

const rep = (id: string, name: string, pgn: string, root: string[] = []): { rep: Repertoire; moves: ReturnType<typeof importPgn>['moves'] } => {
  const r: Repertoire = { id, folderId: 'f', name, color: 'white', rootEpd: rootFromMoves(root).epd, rootMovesUci: root, sortIndex: 0, createdAt: 0, updatedAt: 0 };
  return { rep: r, moves: importPgn(pgn, r).moves };
};

describe('weakness', () => {
  const now = Date.UTC(2026, 9, 6);
  const alapin = rep('a', 'Alapin', '1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 *', ['e2e4', 'c7c5']);
  const caro = rep('c', 'Caro', '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 *', ['e2e4', 'c7c6']);
  const epds = (ucis: string[]) => playLine(INITIAL_FEN, ucis).moves.map((m) => m.epd);
  // Alapin positions where it's your move: after 1…c5, 2…Nf6, 3…Nd5.
  const [, afterC5, , afterNf6, , afterNd5] = epds(['e2e4', 'c7c5', 'c2c3', 'g8f6', 'e4e5', 'f6d5']);
  const review = (epd: string, rating: 1 | 3, i: number): ReviewEntry => ({ id: `r${epd}${i}`, cardEpd: epd, color: 'white', rating, playedUci: null, expectedUci: [], mode: 'review', msTaken: 1, reviewedAt: now - i * 1000, updatedAt: 0 });
  const reviews = [
    ...[afterNf6!, afterNd5!].flatMap((e) => Array.from({ length: 8 }, (_, i) => review(e, i < 5 ? 1 : 3, i))),
    ...Array.from({ length: 10 }, (_, i) => review(afterC5!, 3, 100 + i)),
  ];
  const game = (ucis: string[], result: PlayedGame['result'], i: number): PlayedGame => ({ id: `g${i}`, site: 'lichess', url: '', color: 'white', opponent: 'x', result, speed: 'blitz', playedAt: 0, ucis });
  const games = [...Array.from({ length: 6 }, (_, i) => game(['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5'], 'win', i))];

  const report = analyseWeakness({ folders: [{ id: 'f', parentId: 'root', name: 'Sicilian', color: 'white', sortIndex: 0, updatedAt: 0 }, { id: 'root', parentId: null, name: 'White', color: 'white', sortIndex: 0, updatedAt: 0 }], reps: [alapin.rep, caro.rep], moves: [...alapin.moves, ...caro.moves], cards: [], reviews, games, now });

  it('ranks the line you keep missing first and the one you win with last', () => {
    expect(report.lines[0]!.label).toBe('Alapin');
    expect(report.lines.at(-1)!.label).toBe('Caro');
    expect(report.lines[0]!.badness).toBeGreaterThan(1.5);
  });

  it('finds the move after which things go wrong', () => {
    expect(report.moves[0]!.context).toMatch(/^1\.e4 c5 2\.c3/);
    expect(report.moves[0]!.scope).toMatchObject({ kind: 'at', color: 'white' });
  });

  it('weighs little evidence as little', () => {
    expect(rate({ attempts: 1, misses: 1, games: 0, points: 0 }).confidence).toBeLessThan(0.3);
    expect(rate({ attempts: 40, misses: 20, games: 0, points: 0 }).badness).toBeGreaterThan(rate({ attempts: 4, misses: 2, games: 0, points: 0 }).badness);
  });
});
