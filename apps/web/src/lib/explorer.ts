import { ratingBandsFor, toEpd, type ExplorerData, type Speed } from '@mainline/shared';
import { api, ApiError } from './api';
import { deviceCache } from './cache';

export type ExplorerSource = 'masters' | 'lichess';
const cache = deviceCache<ExplorerData>('explorer');

/** The rating buckets and speeds an explorer request is made (and cached) for, in one canonical order. */
export function explorerQuery(rating: number, speeds: Speed[]) {
  return { ratings: ratingBandsFor(rating).join(','), speeds: [...speeds].sort().join(',') };
}

export function explorerKey(source: ExplorerSource, fen: string, rating: number, speeds: Speed[]) {
  const epd = toEpd(fen);
  if (source === 'masters') return `m|${epd}`;
  const q = explorerQuery(rating, speeds);
  return `l|${epd}|${q.ratings}|${q.speeds}`;
}

/** Explorer data: memory → server (which caches) → IndexedDB fallback when offline. */
export async function fetchExplorer(source: ExplorerSource, fen: string, rating: number, speeds: Speed[], signal?: AbortSignal): Promise<ExplorerData> {
  const key = explorerKey(source, fen, rating, speeds);
  const hit = cache.peek(key);
  if (hit) return hit;
  const params = new URLSearchParams({ source, fen });
  if (source === 'lichess') {
    const q = explorerQuery(rating, speeds);
    params.set('ratings', q.ratings);
    params.set('speeds', q.speeds);
  }
  try {
    const data = await api<ExplorerData>(`/api/explorer?${params}`, { signal });
    cache.put(key, data);
    return data;
  } catch (e) {
    if (e instanceof ApiError) {
      const saved = await cache.fromDisk(key);
      if (saved) return { ...saved, cached: true };
    }
    throw e;
  }
}

/** Stores explorer data that arrived another way (the guide bundle), as if fetched. */
export function primeExplorer(source: ExplorerSource, fen: string, rating: number, speeds: Speed[], data: ExplorerData) {
  cache.put(explorerKey(source, fen, rating, speeds), data);
}

/** Peek without network (for offline training / instant paint). */
export async function cachedExplorer(source: ExplorerSource, fen: string, rating: number, speeds: Speed[]) {
  return (await cache.get(explorerKey(source, fen, rating, speeds))) ?? undefined;
}

/** Game counts per reply from explorer data already in memory (no network) — used to weight drills. */
export function peekReplyWeights(epd: string): Map<string, number> | undefined {
  for (const prefix of ['l|', 'm|']) {
    for (const [key, data] of cache.entries()) {
      if (key.startsWith(prefix) && data?.epd === epd) return new Map(data.moves.map((m) => [m.uci, m.total]));
    }
  }
  return undefined;
}
