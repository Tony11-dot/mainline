import { Chess } from 'chessops/chess';
import { makeFen, parseFen, INITIAL_FEN } from 'chessops/fen';

export { INITIAL_FEN };
export const INITIAL_EPD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';

/** Parse a FEN (or EPD) into a legal chessops position, throwing on invalid input. */
export function positionFromFen(fen: string): Chess {
  const parts = fen.trim().split(/\s+/);
  // Accept EPD (4 fields) by padding the move counters.
  const full = parts.length === 4 ? `${parts.join(' ')} 0 1` : parts.join(' ');
  const setup = parseFen(full).unwrap();
  return Chess.fromSetup(setup).unwrap();
}

/**
 * Normalize any FEN to an EPD key: the first four fields, with castling rights
 * reduced to those that are actually possible and the en-passant square kept
 * only when an en-passant capture is legal. Transpositions share one key.
 */
export function toEpd(fenOrPos: string | Chess): string {
  const pos = typeof fenOrPos === 'string' ? positionFromFen(fenOrPos) : fenOrPos;
  return makeFen(pos.toSetup(), { epd: true });
}

/** Full FEN for a position (move counters included). */
export function toFen(pos: Chess): string {
  return makeFen(pos.toSetup());
}

/** A FEN with dummy counters, derived from an EPD — for APIs that insist on six fields. */
export function epdToFen(epd: string): string {
  const parts = epd.trim().split(/\s+/);
  return parts.length >= 6 ? parts.slice(0, 6).join(' ') : `${parts.slice(0, 4).join(' ')} 0 1`;
}

export function sideToMove(epdOrFen: string): 'white' | 'black' {
  return epdOrFen.trim().split(/\s+/)[1] === 'b' ? 'black' : 'white';
}
