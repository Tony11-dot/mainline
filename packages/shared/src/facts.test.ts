import { describe, expect, it } from 'vitest';
import { buildFacts, invalidMoves, templateExplanation } from './facts';

// 1.e4 e5 2.Nf3 Nc6, White to move.
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const facts = buildFacts({
  kind: 'move',
  fen: FEN,
  moveUci: 'f1b5',
  engine: { depth: 30, lines: [{ moves: ['f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1'], cp: 30 }] },
});

describe('coach move check', () => {
  it('reads move numbers and annotations around a move', () => {
    expect(invalidMoves('After [[3.Bb5]] or [[3. Bb5]] Black answers [[3...a6]]; [[Bb5!?]] is the classic try.', facts)).toEqual([]);
  });

  it('allows moves legal now and moves further down the engine line', () => {
    // d4 and Nxe5 are legal now; O-O (not yet legal) and …Nf6 come later in the engine line.
    expect(invalidMoves('[[d4]], [[Nxe5]], then [[O-O]] after [[Nf6]].', facts)).toEqual([]);
  });

  it('rejects moves that are neither legal now nor in the packet', () => {
    // Kf1: own bishop. Bxf7+: no diagonal. Qh5: the knight blocks. d5: Black's move, not in any line.
    expect(invalidMoves('[[Kf1]] [[Bxf7+]] [[Qh5]] [[d5]] [[Bb5]]', facts)).toEqual(['Kf1', 'Bxf7+', 'Qh5', 'd5']);
  });

  it('wants one move per token, in SAN', () => {
    expect(invalidMoves('[[Bb5 a6]] [[0-0]] [[bb5]]', facts)).toEqual(['Bb5 a6', '0-0', 'bb5']);
  });

  it('keeps an engine line only up to its first illegal move', () => {
    // A cached PV that goes wrong after 3...a6 (4.Bb5 again is illegal): only Bb5 and a6 count.
    const f = buildFacts({ kind: 'move', fen: FEN, moveUci: 'f1b5', engine: { depth: 20, lines: [{ moves: ['f1b5', 'a7a6', 'f1b5', 'g8f6'], cp: 30 }] } });
    expect(f.engine!.lines[0]!.san).toEqual(['Bb5', 'a6']);
    expect(invalidMoves('[[a6]] [[Nf6]]', f)).toEqual(['Nf6']);
  });

  it('drops a move that is not legal in the position instead of explaining it', () => {
    // O-O with the bishop still on f1.
    const f = buildFacts({ kind: 'mistake', fen: FEN, moveUci: 'f1b5', playedUci: 'e1g1' });
    expect(f.move).toBe('Bb5');
    expect(f.played).toBeUndefined();
    expect(invalidMoves(templateExplanation(f), f)).toEqual([]);
  });
});
