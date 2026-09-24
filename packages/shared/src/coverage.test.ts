import { describe, expect, it } from 'vitest';
import { INITIAL_EPD, INITIAL_FEN } from './epd';
import { playLine } from './chess';
import { buildGraph, importPgn, type Repertoire } from './repertoire';
import { coverage } from './coverage';
import { buildFacts, invalidMoves, moveTokens, structureOf, templateExplanation } from './facts';
import type { ExplorerData } from './api';

const white: Repertoire = { id: 'w', folderId: null, name: 'w', color: 'white', rootEpd: INITIAL_EPD, rootMovesUci: [], sortIndex: 0, createdAt: 0, updatedAt: 0 };
const ex = (moves: [string, string, number][]): ExplorerData => {
  const ms = moves.map(([uci, san, n]) => ({ uci, san, white: n / 2, draws: 0, black: n / 2, total: n }));
  return { source: 'lichess', epd: '', white: 0, draws: 0, black: 0, total: ms.reduce((a, m) => a + m.total, 0), moves: ms, topGames: [], opening: null, fetchedAt: '', cached: true };
};

describe('coverage', () => {
  it('computes covered share and ranks gaps by reach', () => {
    const { moves } = importPgn('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *', white);
    const g = buildGraph(moves);
    const afterE4 = playLine(INITIAL_FEN, ['e2e4']).moves[0]!.epd;
    const data = new Map([[afterE4, ex([['e7e5', 'e5', 40], ['c7c5', 'c5', 40], ['e7e6', 'e6', 15], ['c7c6', 'c6', 5]])]]);
    const res = coverage({ graph: g, rootEpd: INITIAL_EPD, color: 'white', maxPly: 3, explorer: (e) => data.get(e) });
    expect(res.covered).toBeCloseTo(0.8);
    expect(res.gaps.map((x) => x.san)).toEqual(['e6', 'c6']);
    expect(res.gaps[0]!.reach).toBeCloseTo(0.15);
  });

  it('reports missing explorer data without penalising', () => {
    const { moves } = importPgn('1. e4 e5 2. Nf3 *', white);
    const res = coverage({ graph: buildGraph(moves), rootEpd: INITIAL_EPD, color: 'white', maxPly: 4, explorer: () => undefined });
    expect(res.missing).toHaveLength(2);
    expect(res.covered).toBeCloseTo(1);
  });

  it('flags own positions without a prepared move', () => {
    const { moves } = importPgn('1. e4 e5 *', white);
    const afterE4 = playLine(INITIAL_FEN, ['e2e4']).moves[0]!.epd;
    const res = coverage({ graph: buildGraph(moves), rootEpd: INITIAL_EPD, color: 'white', maxPly: 6, explorer: (e) => (e === afterE4 ? ex([['e7e5', 'e5', 100]]) : undefined) });
    expect(res.undecided).toHaveLength(1);
    expect(res.covered).toBe(0);
  });
});

describe('structure', () => {
  it('finds isolated, doubled, passed pawns and open files', () => {
    // White: doubled isolated a-pawns and an isolated d4; black: passed h-pawn
    const s = structureOf('4k3/7p/8/8/3P4/P7/P7/4K3 w - - 0 1');
    expect(s.white.isolated.sort()).toEqual(['a2', 'a3', 'd4']);
    expect(s.white.doubledFiles).toEqual(['a']);
    expect(s.white.islands).toBe(2);
    expect(s.black.passed).toEqual(['h7']);
    expect(s.openFiles).toContain('e');
    expect(s.material.balance).toBe(2);
  });
  it('castling status', () => {
    const s = structureOf('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 0 1');
    expect(s.white.castled).toBe('kingside');
    expect(s.black.canCastle).toEqual(['kingside', 'queenside']);
  });
});

describe('facts & validation', () => {
  const fen = playLine(INITIAL_FEN, ['e2e4', 'e7e5']).pos && 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  const facts = buildFacts({
    kind: 'move',
    fen,
    moveUci: 'g1f3',
    engine: { depth: 30, lines: [{ moves: ['g1f3', 'b8c6', 'f1b5'], cp: 30 }] },
    evalAfterMove: { moves: [], cp: 28 },
  });
  it('builds a packet with SAN and evals', () => {
    expect(facts.move).toBe('Nf3');
    expect(facts.engine!.lines[0]!.san).toEqual(['Nf3', 'Nc6', 'Bb5']);
    expect(facts.swingForMover).toBeCloseTo(0.02);
  });
  it('accepts legal and engine-line moves, rejects invented ones', () => {
    expect(moveTokens('Play [[Nf3]] then [[Bb5]]')).toEqual(['Nf3', 'Bb5']);
    expect(invalidMoves('Play [[Nf3]], later [[Bb5]] or [[Bc4]].', facts)).toEqual([]);
    expect(invalidMoves('Now [[Qxf7#]] wins.', facts)).toEqual(['Qxf7#']);
  });
  it('template explanation only states facts', () => {
    const t = templateExplanation(facts);
    expect(t).toContain('[[Nf3]]');
    expect(invalidMoves(t, facts)).toEqual([]);
  });
});
