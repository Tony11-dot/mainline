import { epdToFen, isOwnTurn, popularReplies, positionFromFen, playUci, type Color } from '@mainline/shared';
import { fetchExplorer } from './explorer';
import { useLibrary } from './library';
import { usePrefs } from './prefs';

export interface AutoBuildProgress {
  added: number;
  visited: number;
  needsYourMove: number;
  current?: string;
}

/**
 * "Add popular replies": from `startFen`, walk the repertoire to `maxPlies` deep. At opponent positions
 * add every reply played in ≥ minShare of games at the user's rating; at own positions follow the main
 * move (or stop and count it as "needs your move"). One explorer request at a time (server enforces it too).
 */
export async function addPopularReplies(opts: { repId: string; color: Color; startFen: string; maxPlies: number; minShare: number; signal: AbortSignal; onProgress: (p: AutoBuildProgress) => void }) {
  const { rating, speeds } = usePrefs.getState();
  const lib = useLibrary.getState;
  const progress: AutoBuildProgress = { added: 0, visited: 0, needsYourMove: 0 };
  const seen = new Set<string>();
  const queue: { fen: string; depth: number }[] = [{ fen: opts.startFen, depth: 0 }];
  while (queue.length) {
    if (opts.signal.aborted) break;
    const { fen, depth } = queue.shift()!;
    const epd = fen.split(' ').slice(0, 4).join(' ');
    if (seen.has(epd) || depth >= opts.maxPlies) continue;
    seen.add(epd);
    progress.visited++;
    const moves = lib().moves.filter((m) => m.repertoireId === opts.repId && !m.deleted && m.fromEpd === epd);
    if (isOwnTurn(opts.color, epd)) {
      const main = moves.find((m) => m.isMainline);
      if (!main) {
        progress.needsYourMove++;
        continue;
      }
      queue.push({ fen: playUci(positionFromFen(fen), main.uci).fen, depth: depth + 1 });
    } else {
      progress.current = epd;
      opts.onProgress({ ...progress });
      let data;
      try {
        data = await fetchExplorer('lichess', fen, rating, speeds, opts.signal);
      } catch (e) {
        if ((e as Error).name === 'AbortError') break;
        throw e;
      }
      for (const r of popularReplies(data, opts.minShare)) {
        if (!moves.some((m) => m.uci === r.uci)) {
          await lib().addMove(opts.repId, fen, r.uci);
          progress.added++;
        }
      }
      for (const m of lib().moves.filter((x) => x.repertoireId === opts.repId && !x.deleted && x.fromEpd === epd)) {
        queue.push({ fen: epdToFen(m.toEpd), depth: depth + 1 });
      }
    }
    opts.onProgress({ ...progress });
  }
  return progress;
}
