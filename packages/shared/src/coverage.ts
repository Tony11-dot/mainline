import { isOwnTurn, mainMoveAt, type Graph } from './repertoire';
import type { ExplorerData } from './api';
import type { Color } from './chess';

export interface Gap {
  /** Position where the opponent's reply isn't prepared. */
  epd: string;
  /** Opponent reply (uci/san) and its share at this node. */
  uci: string;
  san: string;
  share: number;
  /** Probability of reaching this gap from the root, in real games at your level. */
  reach: number;
  games: number;
  ply: number;
}

export interface CoverageResult {
  /** Share of games (at your level) that stay inside your repertoire through `maxPly` (0..1). */
  covered: number;
  gaps: Gap[];
  /** Opponent positions whose explorer data wasn't available (not counted either way). */
  missing: string[];
  /** Your positions with no prepared move (you'd be on your own there). */
  undecided: { epd: string; reach: number; ply: number }[];
}

/**
 * Coverage: walks the repertoire from its root following real-game frequencies at opponent positions.
 * Probability mass that reaches the ply limit (or a leaf of *prepared* play) inside the repertoire is
 * "covered"; mass that leaves through an unprepared opponent reply becomes a gap.
 *
 *   covered + Σ gap.reach + Σ undecided.reach + (unknown mass) = 1
 */
export function coverage(opts: {
  graph: Graph;
  rootEpd: string;
  color: Color;
  maxPly: number;
  explorer: (epd: string) => ExplorerData | undefined;
  /** Ignore replies below this share (noise). */
  minShare?: number;
}): CoverageResult {
  const { graph, color, maxPly, explorer } = opts;
  const minShare = opts.minShare ?? 0.01;
  const res: CoverageResult = { covered: 0, gaps: [], missing: [], undecided: [] };
  const walk = (epd: string, reach: number, ply: number, seen: Set<string>) => {
    if (reach < 1e-6) return;
    if (ply >= maxPly || seen.has(epd)) {
      res.covered += reach;
      return;
    }
    const next = new Set(seen).add(epd);
    if (isOwnTurn(color, epd)) {
      const main = mainMoveAt(graph, epd);
      if (!main) {
        // Opponent left us here with nothing prepared: count as undecided (not covered).
        res.undecided.push({ epd, reach, ply });
        return;
      }
      walk(main.toEpd, reach, ply + 1, next);
      return;
    }
    const data = explorer(epd);
    const prepared = graph.get(epd) ?? [];
    if (!data || !data.total) {
      res.missing.push(epd);
      // Unknown frequencies: split evenly across prepared replies so the rest of the tree still counts.
      if (!prepared.length) {
        res.covered += reach;
        return;
      }
      for (const m of prepared) walk(m.toEpd, reach / prepared.length, ply + 1, next);
      return;
    }
    const byUci = new Map(prepared.map((m) => [m.uci, m]));
    let accounted = 0;
    for (const m of data.moves) {
      const share = m.total / data.total;
      accounted += share;
      const mine = byUci.get(m.uci);
      if (mine) walk(mine.toEpd, reach * share, ply + 1, next);
      else if (share >= minShare) res.gaps.push({ epd, uci: m.uci, san: m.san, share, reach: reach * share, games: m.total, ply });
    }
    // Moves outside the explorer's top list (tiny tail): treat as covered noise, don't punish.
    if (accounted < 1) res.covered += reach * (1 - accounted);
  };
  walk(opts.rootEpd, 1, 0, new Set());
  res.gaps.sort((a, b) => b.reach - a.reach);
  res.undecided.sort((a, b) => b.reach - a.reach);
  return res;
}
