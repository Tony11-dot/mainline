import type { EvalLine, ExplorerData } from './api';
import { winningChances } from './eval';
import type { Color } from './chess';

export interface MoveSuggestion {
  uci: string;
  san?: string;
  /** Our expected score from the engine, 0..1 (winning-chance curve). */
  engine?: number;
  /** Our score (win + ½ draw) at the user's rating in the Lichess database, 0..1. */
  practical?: number;
  practicalGames: number;
  /** Share of master games that chose this move, 0..1. */
  masterShare?: number;
  score: number;
}

const W = { engine: 0.45, practical: 0.35, master: 0.2 };

/**
 * Ranks candidate moves for the side to move. Every number comes from the engine or a game database;
 * missing signals are dropped and the remaining weights renormalised (never invented).
 */
export function rankMoves(opts: { color: Color; engineLines?: EvalLine[]; lichess?: ExplorerData; masters?: ExplorerData; minGames?: number }): MoveSuggestion[] {
  const { color, engineLines = [], lichess, masters, minGames = 30 } = opts;
  const byUci = new Map<string, MoveSuggestion>();
  const get = (uci: string, san?: string) => {
    let s = byUci.get(uci);
    if (!s) byUci.set(uci, (s = { uci, san, practicalGames: 0, score: 0 }));
    if (san && !s.san) s.san = san;
    return s;
  };
  for (const l of engineLines) {
    const first = l.moves[0];
    if (!first) continue;
    const wc = winningChances(l); // White POV, -1..1
    get(first).engine = (color === 'white' ? wc : -wc) / 2 + 0.5;
  }
  for (const m of lichess?.moves ?? []) {
    if (m.total < minGames) continue;
    const s = get(m.uci, m.san);
    const ours = color === 'white' ? m.white : m.black;
    s.practical = (ours + m.draws / 2) / m.total;
    s.practicalGames = m.total;
  }
  const mTotal = masters?.total ?? 0;
  for (const m of masters?.moves ?? []) {
    if (!mTotal) break;
    get(m.uci, m.san).masterShare = m.total / mTotal;
  }
  const maxShare = Math.max(0.0001, ...[...byUci.values()].map((s) => s.masterShare ?? 0));
  for (const s of byUci.values()) {
    let sum = 0;
    let wsum = 0;
    if (s.engine !== undefined) {
      sum += W.engine * s.engine;
      wsum += W.engine;
    }
    if (s.practical !== undefined) {
      sum += W.practical * s.practical;
      wsum += W.practical;
    }
    if (s.masterShare !== undefined) {
      sum += W.master * (s.masterShare / maxShare);
      wsum += W.master;
    }
    // A move with only one weak signal shouldn't outrank well-supported moves.
    s.score = wsum ? (sum / wsum) * Math.min(1, 0.55 + wsum) : 0;
  }
  return [...byUci.values()].filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}

/** Opponent replies worth preparing for: at least `minShare` of games at the user's level. */
export function popularReplies(data: ExplorerData, minShare: number, max = 6): { uci: string; san: string; share: number }[] {
  if (!data.total) return [];
  return data.moves
    .map((m) => ({ uci: m.uci, san: m.san, share: m.total / data.total }))
    .filter((m) => m.share >= minShare)
    .slice(0, max);
}
