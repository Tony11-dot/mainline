import { Chess, castlingSide, normalizeMove } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { makeSan, parseSan } from 'chessops/san';
import { kingCastlesTo, makeSquare, makeUci, parseUci } from 'chessops/util';
import type { Move, NormalMove, SquareName } from 'chessops/types';
import { positionFromFen, toEpd, toFen } from './epd';

export type Color = 'white' | 'black';
export type { Chess };

/** Legal destinations keyed by origin square, in chessground's format (both castling encodings). */
export function legalDests(pos: Chess): Map<SquareName, SquareName[]> {
  return chessgroundDests(pos);
}

/** Standard UCI for a move in this position (castling as king two squares: e1g1, never e1h1). */
export function standardUci(pos: Chess, move: Move): string {
  if ('from' in move) {
    const side = castlingSide(pos, move);
    if (side) return makeSquare(move.from) + makeSquare(kingCastlesTo(pos.turn, side));
  }
  return makeUci(move);
}

/** Parse UCI in either castling encoding into a legal move for `pos`, or undefined if illegal. */
export function parseLegalUci(pos: Chess, uci: string): NormalMove | undefined {
  const raw = parseUci(uci);
  if (!raw || !('from' in raw)) return undefined;
  const move = normalizeMove(pos, raw) as NormalMove;
  return pos.isLegal(move) ? move : undefined;
}

export interface PlayedMove {
  uci: string;
  san: string;
  /** Position after the move (a fresh object). */
  pos: Chess;
  epd: string;
  fen: string;
  capture: boolean;
  check: boolean;
  castle: boolean;
  promotion: boolean;
}

/** Plays a UCI move on a copy of `pos`. Throws if illegal. */
export function playUci(pos: Chess, uci: string): PlayedMove {
  const move = parseLegalUci(pos, uci);
  if (!move) throw new Error(`illegal move ${uci} in ${toFen(pos)}`);
  const san = makeSan(pos, move);
  const capture = pos.board.occupied.has(move.to) && !castlingSide(pos, move) ? true : isEnPassant(pos, move);
  const castle = !!castlingSide(pos, move);
  const std = standardUci(pos, move);
  const next = pos.clone();
  next.play(move);
  return {
    uci: std,
    san,
    pos: next,
    epd: toEpd(next),
    fen: toFen(next),
    capture,
    check: next.isCheck(),
    castle,
    promotion: !!move.promotion,
  };
}

function isEnPassant(pos: Chess, move: NormalMove): boolean {
  return pos.board.getRole(move.from) === 'pawn' && move.to === pos.epSquare;
}

export function sanToUci(pos: Chess, san: string): string | undefined {
  const move = parseSan(pos, san);
  return move ? standardUci(pos, move) : undefined;
}

export function uciToSan(pos: Chess, uci: string): string | undefined {
  const move = parseLegalUci(pos, uci);
  return move ? makeSan(pos, move) : undefined;
}

/** Converts a UCI line from a FEN into SAN; stops at the first illegal move. */
export function uciLineToSan(fen: string, ucis: string[]): string[] {
  let pos = positionFromFen(fen);
  const out: string[] = [];
  for (const u of ucis) {
    const move = parseLegalUci(pos, u);
    if (!move) break;
    out.push(makeSan(pos, move));
    pos = pos.clone();
    pos.play(move);
  }
  return out;
}

/** Plays a sequence of UCI moves from a FEN; throws on the first illegal one. */
export function playLine(fen: string, ucis: string[]): { pos: Chess; moves: PlayedMove[] } {
  let pos = positionFromFen(fen);
  const moves: PlayedMove[] = [];
  for (const u of ucis) {
    const m = playUci(pos, u);
    moves.push(m);
    pos = m.pos;
  }
  return { pos, moves };
}

/** Is `uci` a pawn move to the last rank (needs a promotion piece)? */
export function isPromotion(pos: Chess, from: SquareName, to: SquareName): boolean {
  const piece = pos.board.get(parseSquareName(from));
  if (!piece || piece.role !== 'pawn') return false;
  return (piece.color === 'white' && to[1] === '8') || (piece.color === 'black' && to[1] === '1');
}

function parseSquareName(s: SquareName): number {
  return (s.charCodeAt(0) - 97) + 8 * (s.charCodeAt(1) - 49);
}

/** Move number label for a ply index (0-based ply from the start of the game). */
export function moveLabel(ply: number, san: string, forceNumber = false): string {
  const n = Math.floor(ply / 2) + 1;
  if (ply % 2 === 0) return `${n}. ${san}`;
  return forceNumber ? `${n}… ${san}` : san;
}

/** Full-move ply of a position from its FEN (0 = white's first move). */
export function plyFromFen(fen: string): number {
  const parts = fen.split(/\s+/);
  const full = Number(parts[5] ?? 1) || 1;
  return (full - 1) * 2 + (parts[1] === 'b' ? 1 : 0);
}
