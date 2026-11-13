import { EVAL_SHARE_MIN_DEPTH, toEpd, type EvalData } from '@mainline/shared';
import { api } from './api';
import { deviceCache } from './cache';

const cache = deviceCache<EvalData>('evals');

/** Cloud eval via our server (cached forever server-side). null = not in the cloud. */
export async function fetchCloudEval(fen: string, signal?: AbortSignal): Promise<EvalData | null> {
  const epd = toEpd(fen);
  const known = cache.peek(epd);
  if (known !== undefined) return known;
  try {
    const { eval: ev } = await api<{ eval: EvalData | null }>(`/api/eval?fen=${encodeURIComponent(fen)}`, { signal });
    cache.put(epd, ev);
    return ev;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return (await cache.fromDisk(epd)) ?? null;
  }
}

export function rememberLocalEval(fen: string, ev: EvalData) {
  cache.put(toEpd(fen), ev);
  // Share deep local evals with everyone (server validates the PV and keeps the deepest).
  if (ev.depth >= EVAL_SHARE_MIN_DEPTH) void api('/api/eval', { method: 'POST', json: { fen, depth: ev.depth, lines: ev.lines } }).catch(() => undefined);
}

/** Stores an eval that arrived another way (the guide bundle), as if fetched. null = not in the cloud. */
export const primeEval = cache.put;

/** A known eval without network: memory, then IndexedDB. undefined = unknown, null = known miss. */
export const cachedEval = cache.get;
