import { describe, expect, it } from 'vitest';
import { INITIAL_EPD } from './epd';
import { importPgn, rootFromMoves, type Repertoire } from './repertoire';
import { breakPoints, buildBook, firstDeviation, opponentMeets, resultsByLine, sanListToUcis, type PlayedGame } from './games';

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
  it('finds where their common moves meet your repertoire', () => {
    const wb = buildBook(data, 'white');
    const theirs = [g('x1', 'black', 'e4 c5 Nf3 d6'), g('x2', 'black', 'e4 c5 Nf3 Nc6'), g('x3', 'black', 'e4 e5 Nf3 Nc6'), g('x4', 'black', 'd4 d5')];
    const meets = opponentMeets(theirs, wb);
    // They answer 1.e4 with c5 (2/3) and e5 (1/3); both prepared. After 1.e4 c5 2.Nf3 they play d6/Nc6 — not prepared.
    const unprepared = meets.filter((m) => !m.prepared);
    expect(unprepared.length).toBeGreaterThan(0);
    expect(unprepared.some((m) => m.theirMove === 'd7d6')).toBe(true);
    expect(meets.find((m) => m.theirMove === 'c7c5')!.prepared).toBe(true);
  });
});
