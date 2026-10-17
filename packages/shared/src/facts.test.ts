import { describe, expect, it } from 'vitest';
import { buildFacts, invalidMoves, moveTokens, sameMoveTokens } from './facts';
import { INITIAL_FEN } from './epd';

describe('facts: move tokens', () => {
  it('finds and compares [[move]] tokens regardless of order and surrounding text', () => {
    expect(moveTokens('Play [[Nf3]] then [[O-O]].')).toEqual(['Nf3', 'O-O']);
    expect(sameMoveTokens('[[Nf3]] prepares [[O-O]]', 'Rochieren mit [[O-O]] nach [[Nf3]]')).toBe(true);
    expect(sameMoveTokens('[[Nf3]] prepares [[O-O]]', '[[Nf3]] bereitet vor')).toBe(false);
    expect(sameMoveTokens('[[Nf3]] and [[Nf3]]', '[[Nf3]]')).toBe(false);
  });

  it('accepts moves legal now or in the engine lines, rejects the rest', () => {
    const facts = buildFacts({ kind: 'move', fen: INITIAL_FEN, moveUci: 'e2e4', engine: { depth: 20, lines: [{ moves: ['e2e4', 'e7e5', 'g1f3'], cp: 30 }] } });
    expect(invalidMoves('[[e4]] opens lines; [[Nf3]] follows [[e5]].', facts)).toEqual([]);
    expect(invalidMoves('Not [[Qxf7]] or [[Bc4]] yet.', facts)).toEqual(['Qxf7', 'Bc4']);
  });
});
