import { describe, expect, it } from 'vitest';
import { INITIAL_EPD } from './epd';
import { importPgn, rootFromMoves, type Repertoire } from './repertoire';
import { breakPoints, buildBook, firstDeviation, myMovesByPosition, opponentPrep, resultsByLine, sanListToUcis, type PlayedGame } from './games';

const rep = (id: string, color: 'white' | 'black', rootMovesUci: string[] = []): Repertoire => ({
  id, folderId: null, name: id, color, rootEpd: rootMovesUci.length ? rootFromMoves(rootMovesUci).epd : INITIAL_EPD, rootMovesUci, sortIndex: 0, createdAt: 0, updatedAt: 0,
});
const white = rep('w', 'white');
const najdorf = rep('b', 'black', ['e2e4', 'c7c5']);
const moves = [
  ...importPgn('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 3. Bb5 *', white).moves,
  ...importPgn('1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 *', najdorf).moves,
];
const data = { reps: [white, najdorf], moves };
const g = (id: string, color: 'white' | 'black', sans: string, result: PlayedGame['result'] = 'win'): PlayedGame => ({
  id, site: 'lichess', url: '', color, opponent: 'x', result, speed: 'blitz', playedAt: 0, ucis: sanListToUcis(sans.split(' ')),
});

describe('first deviation', () => {
  const wb = buildBook(data, 'white');
  const bb = buildBook(data, 'black');
  it('you left book', () => {
    const d = firstDeviation(g('1', 'white', 'e4 e5 Nf3 Nc6 Bc4'), wb);
    expect(d.kind).toBe('you_left_book');
    expect(d.ply).toBe(4);
    expect(d.expected).toEqual(['f1b5']);
  });
  it('opponent left book', () => {
    const d = firstDeviation(g('2', 'white', 'e4 d5 exd5'), wb);
    expect(d.kind).toBe('opponent_left_book');
    expect(d.played).toBe('d7d5');
  });
  it('end of prep', () => {
    expect(firstDeviation(g('3', 'white', 'e4 e5 Nf3 Nc6 Bb5 a6'), wb).kind).toBe('end_of_prep');
  });
  it('black repertoire rooted after 1.e4 c5 — root moves are book', () => {
    expect(firstDeviation(g('4', 'black', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3'), bb).kind).toBe('end_of_prep');
    const left = firstDeviation(g('5', 'black', 'e4 c5 Nf3 Nc6'), bb);
    expect(left.kind).toBe('you_left_book');
    expect(left.expected).toEqual(['d7d6']);
    expect(firstDeviation(g('6', 'black', 'd4 Nf6'), bb).kind).toBe('not_covered');
    expect(firstDeviation(g('7', 'black', 'e4 e5'), bb).kind).toBe('you_left_book');
  });
});

describe('aggregation', () => {
  const wb = buildBook(data, 'white');
  const games = [g('a', 'white', 'e4 d5 exd5'), g('b', 'white', 'e4 d5 e5', 'loss'), g('c', 'white', 'e4 e5 Nf3 Nc6 Bb5 a6', 'draw'), g('d', 'white', 'e4 e5 Nf3 Nc6 Bb5 Nf6')];
  const devs = new Map(games.map((x) => [x.id, firstDeviation(x, wb)]));
  it('groups break points', () => {
    const bps = breakPoints(games, devs);
    expect(bps[0]!.kind).toBe('opponent_left_book');
    expect(bps[0]!.count).toBe(2);
    expect(bps[0]!.played[0]).toEqual({ uci: 'd7d5', count: 2 });
  });
  it('results by line', () => {
    const r = resultsByLine(games, devs, 4);
    expect(r[0]!.games).toBe(2);
    expect(r[0]!.score).toBeCloseTo(0.75);
  });
});

describe('opponent prep', () => {
  const times = (n: number, color: 'white' | 'black', sans: string, result: PlayedGame['result'] = 'win') => Array.from({ length: n }, (_, i) => g(`${sans}#${i}`, color, sans, result));
  const ucis = (sans: string) => sanListToUcis(sans.split(' '));

  it('as White: their answers to your first move, and their lines with real game counts', () => {
    const theirs = [
      ...times(3, 'black', 'e4 c5 Nf3 d6 d4 cxd4'),
      ...times(2, 'black', 'e4 e5 Nf3 Nc6 Bb5 a6', 'loss'),
      ...times(2, 'black', 'e4 d5 exd5 Qxd5', 'draw'),
      ...times(3, 'black', 'd4 d5 c4'),
      g('w', 'white', 'e4 e5'),
    ];
    const p = opponentPrep(theirs, buildBook(data, 'white'), { minGames: 2 });
    expect(p.games).toBe(10);
    expect(p.forks).toEqual([
      {
        path: ['e2e4'],
        games: 7,
        choices: [
          { uci: 'c7c5', games: 3, prepared: true },
          { uci: 'e7e5', games: 2, prepared: true },
          { uci: 'd7d5', games: 2, prepared: false },
        ],
      },
    ]);
    expect(p.lines.map((l) => [l.path, l.games, l.book, l.ply])).toEqual([
      // Your 1...c5 line is only 2.Nf3; past it you get their usual moves.
      [ucis('e4 c5 Nf3 d6 d4 cxd4'), 3, 'prep_ends', 3],
      [ucis('e4 e5 Nf3 Nc6 Bb5 a6'), 2, 'prep_ends', 5],
      [ucis('e4 d5 exd5 Qxd5'), 2, 'they_leave', 1],
    ]);
    expect(p.lines[1]).toMatchObject({ win: 0, draw: 0, loss: 2, score: 0 });
    expect(p.lines[2]!.score).toBe(0.5);
  });

  it('as Black: their first moves, your repertoire root followed, unprepared first moves flagged', () => {
    const theirs = [...times(3, 'white', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3'), g('e5', 'white', 'e4 e5 Nf3'), ...times(2, 'white', 'd4 Nf6 c4 e6')];
    const p = opponentPrep(theirs, buildBook(data, 'black'), { minGames: 2 });
    expect(p.forks).toEqual([{ path: [], games: 6, choices: [{ uci: 'e2e4', games: 4, prepared: true }, { uci: 'd2d4', games: 2, prepared: false }] }]);
    expect(p.lines.map((l) => [l.path.length, l.games, l.book, l.ply])).toEqual([
      [11, 3, 'prep_ends', 10],
      [4, 2, 'they_leave', 0],
    ]);
  });

  it('stops where they have rarely faced your move', () => {
    const theirs = [...times(3, 'white', 'e4 e5 Nf3 Nc6'), g('c5', 'white', 'e4 c5 Nf3')];
    const p = opponentPrep(theirs, buildBook(data, 'black'), { minGames: 2 });
    expect(p.lines).toHaveLength(1);
    expect(p.lines[0]).toMatchObject({ path: ['e2e4'], games: 4, book: 'covered', rare: { uci: 'c7c5', games: 1 } });
  });

  it('without a repertoire for the colour, still shows what they play', () => {
    const theirs = [...times(4, 'white', 'd4 d5 c4 e6'), ...times(2, 'white', 'e4 e5')];
    const empty = buildBook({ reps: [], moves: [] }, 'black');
    const p = opponentPrep(theirs, empty, { minGames: 2 });
    expect(p.forks[0]!.choices.map((c) => [c.uci, c.games, c.prepared])).toEqual([['d2d4', 4, false], ['e2e4', 2, false]]);
    expect(p.lines.map((l) => [l.path.length, l.games, l.book])).toEqual([[4, 4, 'none'], [2, 2, 'none']]);
  });

  it('past your repertoire, a line stops where their opponents split', () => {
    const theirs = [...times(2, 'white', 'e4 e5 Nf3'), ...times(2, 'white', 'e4 c5 Nf3'), g('e6', 'white', 'e4 e6 d4')];
    const p = opponentPrep(theirs, buildBook({ reps: [], moves: [] }, 'black'), { minGames: 2 });
    expect(p.lines.map((l) => [l.path, l.games])).toEqual([[['e2e4'], 5]]);
  });
});

describe('my moves by position', () => {
  it('counts each move played from a position and your score after it, for your colour only', () => {
    const idx = myMovesByPosition([g('1', 'white', 'e4 e5 Nf3', 'win'), g('2', 'white', 'e4 c5 Nf3', 'loss'), g('3', 'white', 'e4 e5 Bc4', 'draw'), g('4', 'black', 'e4 e5 Nf3', 'loss')], 'white');
    expect(idx.get(INITIAL_EPD)!.get('e2e4')).toEqual({ games: 3, score: 0.5 });
    const afterE4 = idx.get(sanEpd('e4'))!;
    expect(afterE4.get('e7e5')).toEqual({ games: 2, score: 0.75 });
    expect(afterE4.get('c7c5')).toEqual({ games: 1, score: 0 });
  });
});

function sanEpd(sans: string) {
  return importPgn(`${sans} *`, white).moves.at(-1)!.toEpd;
}
