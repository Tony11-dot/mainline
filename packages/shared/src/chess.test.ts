import { describe, expect, it } from 'vitest';
import { INITIAL_FEN, positionFromFen } from './epd';
import { isPromotion, playLine, playUci, sanToUci, uciLineToSan, uciToSan } from './chess';
import { addLine, addMove, allLines, createRoot, mainlineEnd, nodeAt, promoteAt, siblingPath, deleteAt } from './tree';
import { evalSwing, formatEval, wdlPercents, winningChances } from './eval';
import { ratingBandsFor } from './api';

describe('chess helpers', () => {
  it('plays moves and reports SAN, capture, check', () => {
    const { moves } = playLine(INITIAL_FEN, ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5e5']);
    expect(moves.map((m) => m.san)).toEqual(['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qe5+']);
    expect(moves[2]!.capture).toBe(true);
    expect(moves[5]!.check).toBe(true);
  });

  it('canonicalizes castling to king-two-squares UCI', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const pos = positionFromFen(fen);
    expect(playUci(pos, 'e1h1').uci).toBe('e1g1');
    expect(playUci(pos, 'e1g1').san).toBe('O-O');
    expect(playUci(pos, 'e1c1').san).toBe('O-O-O');
    expect(playUci(pos, 'e1g1').castle).toBe(true);
    expect(sanToUci(pos, 'O-O-O')).toBe('e1c1');
  });

  it('detects en passant captures', () => {
    const pos = positionFromFen('rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
    const m = playUci(pos, 'e5d6');
    expect(m.san).toBe('exd6');
    expect(m.capture).toBe(true);
  });

  it('handles promotion', () => {
    const pos = positionFromFen('8/P7/8/8/8/7k/8/7K w - - 0 1');
    expect(isPromotion(pos, 'a7', 'a8')).toBe(true);
    expect(playUci(pos, 'a7a8q').san).toBe('a8=Q');
    expect(uciToSan(pos, 'a7a8n')).toBe('a8=N');
  });

  it('rejects illegal moves', () => {
    expect(() => playUci(positionFromFen(INITIAL_FEN), 'e2e5')).toThrow();
    expect(uciLineToSan(INITIAL_FEN, ['e2e4', 'e2e4'])).toEqual(['e4']);
  });
});

describe('tree', () => {
  it('builds variations and navigates', () => {
    const root = createRoot();
    const main = addLine(root, '', ['e2e4', 'c7c5', 'g1f3']);
    addLine(root, 'e2e4', ['e7e5', 'g1f3']);
    expect(nodeAt(root, main)!.san).toBe('Nf3');
    expect(allLines(root)).toHaveLength(2);
    expect(siblingPath(root, 'e2e4 c7c5', 1)).toBe('e2e4 e7e5');
    expect(mainlineEnd(root, '')).toBe(main);
    promoteAt(root, 'e2e4 e7e5');
    expect(mainlineEnd(root, '')).toBe('e2e4 e7e5 g1f3');
    expect(addMove(root, 'e2e4', 'e7e5').created).toBe(false);
    deleteAt(root, 'e2e4 e7e5');
    expect(allLines(root)).toHaveLength(1);
  });

  it('tracks ply from a FEN root', () => {
    const root = createRoot('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(root.ply).toBe(1);
    expect(addMove(root, '', 'c7c5').node.ply).toBe(2);
  });
});

describe('eval math', () => {
  it('formats evals', () => {
    expect(formatEval({ cp: 34 })).toBe('+0.34');
    expect(formatEval({ cp: -120 })).toBe('−1.20');
    expect(formatEval({ mate: 3 })).toBe('#3');
    expect(formatEval({ mate: -2 })).toBe('#−2');
  });
  it('winning chances are symmetric and bounded', () => {
    expect(winningChances({ cp: 0 })).toBeCloseTo(0);
    expect(winningChances({ cp: 300 })).toBeCloseTo(-winningChances({ cp: -300 }));
    expect(winningChances({ mate: 1 })).toBe(1);
  });
  it('eval swing is from the mover perspective', () => {
    expect(evalSwing(0.3, -0.6, 'white')).toBeCloseTo(0.9);
    expect(evalSwing(0.3, 1.2, 'black')).toBeCloseTo(0.9);
  });
  it('wdl percents sum to 100', () => {
    const p = wdlPercents(1, 1, 1);
    expect(p.reduce((a, b) => a + b)).toBe(100);
    expect(wdlPercents(0, 0, 0)).toEqual([0, 0, 0]);
  });
  it('rating bands', () => {
    expect(ratingBandsFor(1750)).toEqual([1600, 1800]);
    expect(ratingBandsFor(2600)).toEqual([2500]);
  });
});
