import { epdToFen, guideMoves, playUci, positionFromFen, toEpd, type EvalData, type ExplorerData, type GuideBundle } from '@mainline/shared';
import { getEval } from './evals';
import { getExplorer } from './explorer';
import { Lru } from '../lib/lru';

const hot = new Lru<GuideBundle>(1500, 3600_000);

/** Resolves to undefined after `ms` (the work carries on and lands in the cache for next time). */
function within<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms).unref?.())]);
}

/**
 * Everything the guided builder needs for one position in one round trip, all from our caches when warm:
 * explorer numbers (your rating band and masters), the position's own eval and, with `evals`, the eval
 * after each popular move the position's eval doesn't already cover.
 */
export async function getGuide(p: { fen: string; ratings?: number[]; speeds?: string[]; evals: boolean }, token: string | undefined, waitMs = 3500): Promise<GuideBundle> {
  const epd = toEpd(p.fen);
  const key = `${epd}|${p.ratings?.join(',')}|${p.speeds?.join(',')}|${p.evals ? 1 : 0}`;
  const h = hot.get(key);
  if (h) return h;

  const fen = epdToFen(epd);
  const quiet = <T>(x: Promise<T>) => x.catch(() => undefined);
  const [lichess, masters, ev] = await Promise.all([
    quiet(getExplorer({ source: 'lichess', fen, ratings: p.ratings, speeds: p.speeds }, token)),
    quiet(getExplorer({ source: 'masters', fen }, token)),
    p.evals ? quiet(getEval(fen, 5)) : Promise.resolve(undefined),
  ]);
  const bundle: GuideBundle = { epd, lichess: lichess as ExplorerData | undefined, masters: masters as ExplorerData | undefined, eval: ev ?? null };
  let complete = !!lichess && !!masters;
  if (p.evals) {
    const covered = new Set((ev?.lines ?? []).map((l) => l.moves[0]));
    const pos = positionFromFen(fen);
    const todo = guideMoves(bundle.lichess, bundle.masters, 10).filter((u) => !covered.has(u));
    const children: Record<string, EvalData | null> = {};
    await Promise.all(
      todo.map(async (uci) => {
        let child: string;
        try {
          child = playUci(pos, uci).fen;
        } catch {
          return;
        }
        const r = await within(quiet(getEval(child, 1)), waitMs);
        if (r === undefined) complete = false;
        else children[uci] = r ?? null;
      }),
    );
    bundle.children = children;
  }
  // Partial answers (Lichess slow or unreachable) aren't kept, so the next request can fill the gaps.
  if (complete) hot.set(key, bundle);
  return bundle;
}
