import { useEffect, useState } from 'react';
import { guideMoves, playUci, positionFromFen, ratingBandsFor, toEpd, type EvalData, type GuideBundle, type Speed } from '@mainline/shared';
import { api } from './api';
import { cachedExplorer, primeExplorer } from './explorer';
import { cachedEval, primeEval } from './evals';
import { usePrefs } from './prefs';

const mem = new Map<string, GuideBundle>();
const inflight = new Map<string, Promise<GuideBundle>>();

const keyOf = (fen: string, rating: number, speeds: Speed[], evals: boolean) => `${toEpd(fen)}|${ratingBandsFor(rating).join(',')}|${[...speeds].sort().join(',')}|${evals ? 1 : 0}`;

/** The guide's data for a position from what this device already has (no network). */
async function localGuide(fen: string, rating: number, speeds: Speed[], evals: boolean): Promise<GuideBundle | undefined> {
  const [lichess, masters] = await Promise.all([cachedExplorer('lichess', fen, rating, speeds), cachedExplorer('masters', fen, rating, speeds)]);
  if (!lichess && !masters) return undefined;
  const bundle: GuideBundle = { epd: toEpd(fen), lichess, masters };
  if (evals) {
    bundle.eval = (await cachedEval(toEpd(fen))) ?? null;
    const covered = new Set((bundle.eval?.lines ?? []).map((l) => l.moves[0]));
    const pos = positionFromFen(fen);
    const children: Record<string, EvalData | null> = {};
    for (const uci of guideMoves(lichess, masters, 10)) {
      if (covered.has(uci)) continue;
      try {
        const ev = await cachedEval(toEpd(playUci(pos, uci).fen));
        if (ev !== undefined) children[uci] = ev;
      } catch {
        /* illegal here (stale data) */
      }
    }
    bundle.children = children;
  }
  return bundle;
}

/**
 * Explorer numbers and per-move evals for the guided builder in one request, cached on the server
 * (warmed nightly for the opening library) and kept on the device for revisits and offline use.
 */
export function fetchGuide(fen: string, evals: boolean, signal?: AbortSignal): Promise<GuideBundle> {
  const { rating, speeds } = usePrefs.getState();
  const key = keyOf(fen, rating, speeds, evals);
  const hit = mem.get(key) ?? (evals ? undefined : mem.get(keyOf(fen, rating, speeds, true)));
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(key);
  if (!p) {
    const q = new URLSearchParams({ fen, ratings: ratingBandsFor(rating).join(','), speeds: speeds.join(','), evals: evals ? '1' : '0' });
    p = api<GuideBundle>(`/api/guide?${q}`)
      .then((b) => {
        if (b.lichess) primeExplorer('lichess', fen, rating, speeds, b.lichess);
        if (b.masters) primeExplorer('masters', fen, rating, speeds, b.masters);
        if (evals) {
          if (b.eval) primeEval(b.epd, b.eval);
          const pos = positionFromFen(fen);
          for (const [uci, ev] of Object.entries(b.children ?? {})) {
            try {
              primeEval(toEpd(playUci(pos, uci).fen), ev);
            } catch {
              /* ignore */
            }
          }
        }
        mem.set(key, b);
        return b;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  // A caller giving up doesn't cancel the shared request (it still fills the caches).
  if (!signal) return p;
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    p.then(resolve, reject);
  });
}

/** Warms the caches for a position the user is likely to reach next. */
export function prefetchGuide(fen: string, evals: boolean): Promise<GuideBundle | undefined> {
  return fetchGuide(fen, evals).catch(() => undefined);
}

export interface GuideState {
  bundle?: GuideBundle;
  loading: boolean;
}

/** The guide bundle for `fen`: whatever the device has, at once, then the server's answer. */
export function useGuide(fen: string, enabled: boolean, evals: boolean): GuideState {
  const rating = usePrefs((s) => s.rating);
  const speeds = usePrefs((s) => s.speeds);
  const [state, setState] = useState<GuideState>({ loading: true });
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const key = keyOf(fen, rating, speeds, evals);
    const hit = mem.get(key);
    if (hit) {
      setState({ bundle: hit, loading: false });
      return;
    }
    setState({ loading: true });
    void localGuide(fen, rating, speeds, evals).then((b) => {
      if (b && !ctrl.signal.aborted) setState((s) => (s.loading ? { bundle: b, loading: true } : s));
    });
    fetchGuide(fen, evals, ctrl.signal).then(
      (b) => !ctrl.signal.aborted && setState({ bundle: b, loading: false }),
      () => !ctrl.signal.aborted && setState((s) => ({ bundle: s.bundle, loading: false })),
    );
    return () => ctrl.abort();
  }, [fen, enabled, evals, rating, speeds]);
  return state;
}
