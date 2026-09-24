import { describe, expect, it } from 'vitest';
import { INITIAL_EPD, INITIAL_FEN } from './epd';
import { playLine } from './chess';
import {
  buildGraph,
  cardEpds,
  exportPgn,
  findConflicts,
  importPgn,
  lines,
  mainMoveAt,
  makeMove,
  orphanedMoves,
  rootFromMoves,
  transpositionEpds,
  type RepMove,
  type Repertoire,
} from './repertoire';

const rep = (over: Partial<Repertoire> = {}): Repertoire => ({
  id: 'r1',
  folderId: null,
  name: 'Test',
  color: 'white',
  rootEpd: INITIAL_EPD,
  rootMovesUci: [],
  sortIndex: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

function addLine(r: Repertoire, moves: RepMove[], ucis: string[], fromFen = INITIAL_FEN) {
  const { moves: played } = playLine(fromFen, ucis);
  let fen = fromFen;
  let t = moves.length;
  for (let i = 0; i < ucis.length; i++) {
    const m = makeMove(r, moves, fen, ucis[i]!, t++);
    if (!moves.some((x) => x.repertoireId === m.repertoireId && x.fromEpd === m.fromEpd && x.uci === m.uci)) moves.push(m);
    fen = played[i]!.fen;
  }
  return moves;
}

describe('repertoire graph', () => {
  it('marks a second own move as an alternate', () => {
    const r = rep();
    const moves: RepMove[] = [];
    addLine(r, moves, ['e2e4', 'e7e5']);
    addLine(r, moves, ['d2d4']);
    const g = buildGraph(moves);
    expect(mainMoveAt(g, INITIAL_EPD)!.uci).toBe('e2e4');
    expect(moves.find((m) => m.uci === 'd2d4')!.isMainline).toBe(false);
    // opponent moves are never alternates
    addLine(r, moves, ['e2e4', 'c7c5']);
    expect(moves.filter((m) => m.san === 'c5')[0]!.isMainline).toBe(true);
  });

  it('computes cards only for own-turn positions with a main move', () => {
    const r = rep();
    const moves = addLine(r, [], ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']);
    addLine(r, moves, ['e2e4', 'c7c5', 'g1f3']);
    const g = buildGraph(moves);
    // start, after 1.e4 e5, after 2.Nf3 Nc6, after 1.e4 c5
    expect(cardEpds(g, r.rootEpd, 'white')).toHaveLength(4);
    expect(lines(g, r.rootEpd)).toHaveLength(2);
  });

  it('detects transpositions and ends the second line there', () => {
    const r = rep();
    const moves = addLine(r, [], ['g1f3', 'd7d5', 'd2d4', 'g8f6']);
    addLine(r, moves, ['d2d4', 'd7d5', 'g1f3']); // transposes
    const g = buildGraph(moves);
    const tr = transpositionEpds(g, r.rootEpd);
    expect(tr.size).toBe(1);
    const ls = lines(g, r.rootEpd);
    expect(ls.some((l) => l.transposesTo)).toBe(true);
  });

  it('finds conflicts across same-colour repertoires', () => {
    const a = rep({ id: 'a' });
    const b = rep({ id: 'b' });
    const moves = addLine(a, [], ['e2e4', 'e7e5', 'g1f3']);
    addLine(b, moves, ['e2e4', 'e7e5', 'f2f4']);
    const conflicts = findConflicts([a, b], moves);
    expect(conflicts).toHaveLength(1);
    expect([...conflicts[0]!.choices.keys()].sort()).toEqual(['f2f4', 'g1f3']);
  });

  it('finds orphans after deleting a branch', () => {
    const r = rep();
    const moves = addLine(r, [], ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    const e5 = moves.find((m) => m.san === 'e5')!;
    e5.deleted = true;
    expect(orphanedMoves(moves, r.rootEpd).map((m) => m.san)).toEqual(['Nf3', 'Nc6']);
  });
});

describe('PGN', () => {
  const pgn = `[Event "Italian"]

1. e4 e5 2. Nf3 Nc6 (2... d6 {Philidor} 3. d4) 3. Bc4 Bc5 (3... Nf6 4. Ng5) 4. c3 *

[Event "Second game"]

1. e4 c5 2. Nf3 *`;

  it('imports variations and comments, merges games', () => {
    const r = rep();
    const res = importPgn(pgn, r);
    expect(res.games).toBe(2);
    expect(res.errors).toEqual([]);
    expect(res.moves).toHaveLength(13);
    expect(res.moves.find((m) => m.san === 'd6')!.note).toBe('Philidor');
    // Re-import is idempotent
    expect(importPgn(pgn, r, res.moves).moves).toHaveLength(0);
  });

  it('round-trips through export', () => {
    const r = rep();
    const { moves } = importPgn(pgn, r);
    const out = exportPgn(r, moves);
    expect(out).toContain('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 (2... d6 {Philidor} 3. d4) 3. Bc4 Bc5 (3... Nf6 4. Ng5) 4. c3 *');
    const again = importPgn(out, r);
    expect(again.moves.map((m) => `${m.fromEpd} ${m.uci}`).sort()).toEqual(moves.map((m) => `${m.fromEpd} ${m.uci}`).sort());
  });

  it('only imports from the repertoire root onward', () => {
    const root = rootFromMoves(['e2e4', 'c7c5']);
    const r = rep({ color: 'white', rootEpd: root.epd, rootMovesUci: ['e2e4', 'c7c5'] });
    const res = importPgn('1. e4 c5 2. Nf3 d6 3. d4 *\n\n1. d4 d5 *', r);
    expect(res.moves.map((m) => m.san)).toEqual(['Nf3', 'd6', 'd4']);
    const out = exportPgn(r, res.moves);
    expect(out).toContain('[FEN "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"]');
    expect(out).toContain('2. Nf3 d6 3. d4 *');
  });

  it('reports illegal moves instead of throwing', () => {
    const res = importPgn('1. e4 e5 2. Ke3 *', rep());
    expect(res.errors.length).toBe(1);
    expect(res.moves).toHaveLength(2);
  });
});
