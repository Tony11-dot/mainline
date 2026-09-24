import { buildGraph, coverage, epdToFen, evalPawns, isOwnTurn, playUci, positionFromFen, reachable, type CoverageResult, type ExplorerData, type Repertoire, type RepMove } from '@mainline/shared';
import { fetchExplorer } from './explorer';
import { fetchCloudEval } from './evals';
import { usePrefs } from './prefs';

export interface Progress {
  done: number;
  total: number;
}

/** Opponent-to-move positions of a repertoire (where explorer frequencies matter). */
function opponentPositions(rep: Repertoire, moves: RepMove[], maxPly: number): string[] {
  const g = buildGraph(moves);
  const out: string[] = [];
  const seen = new Set<string>();
  const q: [string, number][] = [[rep.rootEpd, 0]];
  while (q.length) {
    const [epd, ply] = q.shift()!;
    if (seen.has(epd) || ply >= maxPly) continue;
    seen.add(epd);
    if (!isOwnTurn(rep.color, epd)) out.push(epd);
    for (const m of g.get(epd) ?? []) q.push([m.toEpd, ply + 1]);
  }
  return out;
}

export async function computeCoverage(rep: Repertoire, moves: RepMove[], maxPly: number, signal: AbortSignal, onProgress: (p: Progress) => void): Promise<CoverageResult> {
  const { rating, speeds } = usePrefs.getState();
  const positions = opponentPositions(rep, moves, maxPly);
  const data = new Map<string, ExplorerData>();
  let done = 0;
  onProgress({ done, total: positions.length });
  for (const epd of positions) {
    if (signal.aborted) break;
    try {
      data.set(epd, await fetchExplorer('lichess', epdToFen(epd), rating, speeds, signal));
    } catch (e) {
      if ((e as Error).name === 'AbortError') break;
    }
    onProgress({ done: ++done, total: positions.length });
  }
  return coverage({ graph: buildGraph(moves), rootEpd: rep.rootEpd, color: rep.color, maxPly, explorer: (e) => data.get(e) });
}

export interface RadarItem {
  /** Opponent-to-move position and the popular mistake played there. */
  epd: string;
  uci: string;
  san: string;
  share: number;
  games: number;
  /** Pawns the mistake gives away (for the opponent), from cloud evals. */
  drop: number;
  /** Engine's best punishment from the resulting position. */
  refutation?: string;
  afterFen: string;
  inRepertoire: boolean;
}

/**
 * Mistake radar: replies played in ≥ 5% of games at your level that lose ≥ 1.0 pawn for the opponent
 * (cloud evals before/after). Positions without a cloud eval are skipped — nothing is guessed.
 */
export async function computeRadar(rep: Repertoire, moves: RepMove[], signal: AbortSignal, onProgress: (p: Progress) => void, opts = { minShare: 0.05, minDrop: 1.0, maxPly: 16 }): Promise<RadarItem[]> {
  const { rating, speeds } = usePrefs.getState();
  const g = buildGraph(moves);
  const live = reachable(g, rep.rootEpd);
  const positions = opponentPositions(rep, moves, opts.maxPly).filter((e) => live.has(e));
  const out: RadarItem[] = [];
  let done = 0;
  onProgress({ done, total: positions.length });
  for (const epd of positions) {
    if (signal.aborted) break;
    try {
      const fen = epdToFen(epd);
      const [ex, before] = await Promise.all([fetchExplorer('lichess', fen, rating, speeds, signal), fetchCloudEval(fen, signal)]);
      const b = before?.lines[0];
      if (ex.total && b) {
        for (const m of ex.moves) {
          const share = m.total / ex.total;
          if (share < opts.minShare) continue;
          const afterFen = playUci(positionFromFen(fen), m.uci).fen;
          const after = await fetchCloudEval(afterFen, signal);
          const a = after?.lines[0];
          if (!a) continue;
          const opp = rep.color === 'white' ? 'black' : 'white';
          const drop = opp === 'white' ? evalPawns(b) - evalPawns(a) : evalPawns(a) - evalPawns(b);
          if (drop >= opts.minDrop) {
            out.push({ epd, uci: m.uci, san: m.san, share, games: m.total, drop: Math.min(drop, 99), refutation: a.moves[0], afterFen, inRepertoire: (g.get(epd) ?? []).some((x) => x.uci === m.uci) });
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') break;
    }
    onProgress({ done: ++done, total: positions.length });
  }
  return out.sort((x, y) => y.share * y.drop - x.share * x.drop);
}
