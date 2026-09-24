import { z } from 'zod';

export const colorSchema = z.enum(['white', 'black']);

/* ---------------- Explorer ---------------- */

export const explorerMoveSchema = z.object({
  uci: z.string(),
  san: z.string(),
  white: z.number(),
  draws: z.number(),
  black: z.number(),
  averageRating: z.number().nullable().optional(),
  opening: z.object({ eco: z.string(), name: z.string() }).nullable().optional(),
});
export type ExplorerMove = z.infer<typeof explorerMoveSchema> & { total: number };

export interface ExplorerPlayer {
  name: string;
  rating: number;
}
export interface ExplorerGame {
  id: string;
  uci?: string;
  winner: 'white' | 'black' | null;
  white: ExplorerPlayer;
  black: ExplorerPlayer;
  year?: number;
  month?: string;
}

export interface ExplorerData {
  source: 'masters' | 'lichess' | 'player';
  epd: string;
  white: number;
  draws: number;
  black: number;
  total: number;
  moves: ExplorerMove[];
  topGames: ExplorerGame[];
  opening: { eco: string; name: string } | null;
  fetchedAt: string;
  cached: boolean;
}

export const RATING_BANDS = [0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500] as const;
export const SPEEDS = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence'] as const;
export type Speed = (typeof SPEEDS)[number];

/** Lichess explorer rating buckets that bracket a player's rating (the band itself and the one above). */
export function ratingBandsFor(rating: number): number[] {
  let idx = 0;
  for (let i = 0; i < RATING_BANDS.length; i++) if (rating >= RATING_BANDS[i]!) idx = i;
  const bands = [RATING_BANDS[idx]!];
  if (idx + 1 < RATING_BANDS.length) bands.push(RATING_BANDS[idx + 1]!);
  return bands;
}

export const explorerQuerySchema = z.object({
  source: z.enum(['masters', 'lichess']),
  fen: z.string().min(10).max(120),
  ratings: z.string().regex(/^[0-9,]*$/).optional(),
  speeds: z.string().regex(/^[a-z,]*$/).optional(),
});

/* ---------------- Engine ---------------- */

export interface EvalLine {
  /** UCI moves of the principal variation. */
  moves: string[];
  /** Centipawns from White's point of view. */
  cp?: number;
  /** Mate in N from White's point of view (positive = White mates). */
  mate?: number;
}

export interface EvalData {
  epd: string;
  depth: number;
  knodes?: number;
  lines: EvalLine[];
  source: 'cloud' | 'local';
}

export const evalSubmitSchema = z.object({
  fen: z.string().min(10).max(120),
  depth: z.number().int().min(1).max(99),
  lines: z
    .array(
      z.object({
        moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).min(1).max(40),
        cp: z.number().int().min(-100000).max(100000).optional(),
        mate: z.number().int().min(-200).max(200).optional(),
      }),
    )
    .min(1)
    .max(5),
});

/* ---------------- Auth / user ---------------- */

export interface Me {
  id: string;
  lichessUsername: string;
  rating: number;
  ratingSpeed: Speed;
  chesscomUsername: string | null;
}
