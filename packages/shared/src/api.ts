/* ---------------- Explorer ---------------- */

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number | null;
  opening?: { eco: string; name: string } | null;
  total: number;
}

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

/* ---------------- Auth / user ---------------- */

export interface Me {
  id: string;
  /** Null for accounts created with Chess.com or Apple. */
  lichessUsername: string | null;
  rating: number;
  ratingSpeed: Speed;
  chesscomUsername: string | null;
  /** True once the Chess.com account was confirmed through Chess.com sign-in (not just typed in). */
  chesscomVerified: boolean;
  /** Name shared through Sign in with Apple, if any. */
  displayName: string | null;
  /** True for accounts created with Sign in with Apple. */
  appleLinked: boolean;
}

/** Display name for an account: its Lichess name, else its Chess.com name, else the name from Apple. */
export const accountName = (me: Pick<Me, 'lichessUsername' | 'chesscomUsername'> & Partial<Pick<Me, 'displayName' | 'appleLinked'>>) =>
  me.lichessUsername ?? me.chesscomUsername ?? me.displayName ?? (me.appleLinked ? 'your Apple ID' : 'your account');
