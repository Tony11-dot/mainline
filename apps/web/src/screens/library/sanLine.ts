import { INITIAL_FEN, playUci, positionFromFen, sanToUci, toFen } from '@mainline/shared';

/** Parses "1.e4 c5 2.Nf3" (move numbers optional) into UCI moves; reports the first bad token. */
export function parseSanLine(text: string): { ucis: string[]; sans: string[]; fen: string; error?: string } {
  let pos = positionFromFen(INITIAL_FEN);
  const ucis: string[] = [];
  const sans: string[] = [];
  const tokens = text.replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const uci = sanToUci(pos, tok);
    if (!uci) return { ucis, sans, fen: toFen(pos), error: `“${tok}” isn't legal here` };
    const played = playUci(pos, uci);
    ucis.push(played.uci);
    sans.push(played.san);
    pos = played.pos;
  }
  return { ucis, sans, fen: toFen(pos) };
}
