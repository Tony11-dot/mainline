import { INITIAL_FEN, playLine } from '@mainline/shared';

/** One move as written in a line: White's carries its number ("3.Bc4"), Black's is bare ("Nf6"). `ply` counts from 0. */
export const numbered = (ply: number, san: string) => (ply % 2 === 0 ? `${ply / 2 + 1}.${san}` : san);

/** "1.e4 e5 2.Nf3". `startPly` is where the first move sits in the game; with `ellipsis`, a line that begins on Black's move says "2…Nf6". */
export function formatLine(sans: string[], { startPly = 0, ellipsis = false }: { startPly?: number; ellipsis?: boolean } = {}): string {
  return sans
    .map((san, i) => {
      const ply = startPly + i;
      return ellipsis && i === 0 && ply % 2 === 1 ? `${Math.ceil(ply / 2)}…${san}` : numbered(ply, san);
    })
    .join(' ');
}

/**
 * A UCI line from the start position as text, or '' if it isn't playable (stale data). `skip` leaves out the
 * first moves, which are played but not shown.
 */
export function sanLineOf(ucis: string[], skip = 0, ellipsis = false): string {
  try {
    const sans = playLine(INITIAL_FEN, ucis).moves.map((m) => m.san);
    return formatLine(sans.slice(skip), { startPly: skip, ellipsis });
  } catch {
    return '';
  }
}
