import { describe, expect, it } from 'vitest';
import { INITIAL_EPD, INITIAL_FEN, epdToFen, positionFromFen, sideToMove, toEpd } from './epd';

describe('toEpd', () => {
  it('drops move counters', () => {
    expect(toEpd(INITIAL_FEN)).toBe(INITIAL_EPD);
    expect(toEpd('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 40')).toBe(INITIAL_EPD);
  });

  it('accepts EPD input', () => {
    expect(toEpd(INITIAL_EPD)).toBe(INITIAL_EPD);
  });

  it('drops an en-passant square when no capture is possible (1.e4)', () => {
    expect(toEpd('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -',
    );
  });

  it('keeps an en-passant square when a capture is legal', () => {
    // 1.e4 a6 2.e5 d5 — exd6 e.p. is legal
    const fen = 'rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    expect(toEpd(fen)).toBe('rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6');
  });

  it('drops an en-passant square when the capture would be illegal (pinned pawn)', () => {
    // White king a5, white pawn b5, black rook h5; black just played c7-c5. bxc6 exposes the king.
    const fen = '8/8/8/KPp4r/8/8/8/4k3 w - c6 0 1';
    expect(toEpd(fen)).toBe('8/8/8/KPp4r/8/8/8/4k3 w - -');
  });

  it('removes impossible castling rights', () => {
    // Rook on h1 missing but FEN still claims K
    const fen = 'r3k2r/8/8/8/8/8/8/R3K3 w KQkq - 0 1';
    expect(toEpd(fen)).toBe('r3k2r/8/8/8/8/8/8/R3K3 w Qkq -');
  });

  it('makes transpositions equal', () => {
    // 1.Nf3 d5 2.d4 vs 1.d4 d5 2.Nf3
    const a = 'rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq d3 0 2';
    const b = 'rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 1 2';
    expect(toEpd(a)).toBe(toEpd(b));
  });

  it('throws on garbage', () => {
    expect(() => toEpd('not a fen')).toThrow();
    expect(() => positionFromFen('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow();
  });
});

describe('helpers', () => {
  it('epdToFen pads counters', () => {
    expect(epdToFen(INITIAL_EPD)).toBe(INITIAL_FEN);
  });
  it('sideToMove', () => {
    expect(sideToMove(INITIAL_EPD)).toBe('white');
    expect(sideToMove('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -')).toBe('black');
  });
});
