import { ratingBandsFor, toEpd, type ExplorerData, type Speed } from '@mainline/shared';
import { api, ApiError } from './api';
import { db } from './idb';

export type ExplorerSource = 'masters' | 'lichess';
const mem = new Map<string, ExplorerData>();

export function explorerKey(source: ExplorerSource, fen: string, rating: number, speeds: Speed[]) {
  const epd = toEpd(fen);
  return source === 'masters' ? `m|${epd}` : `l|${epd}|${ratingBandsFor(rating).join(',')}|${[...speeds].sort().join(',')}`;
}

/** Explorer data: memory → server (which caches) → IndexedDB fallback when offline. */
export async function fetchExplorer(source: ExplorerSource, fen: string, rating: number, speeds: Speed[], signal?: AbortSignal): Promise<ExplorerData> {
  const key = explorerKey(source, fen, rating, speeds);
  const hit = mem.get(key);
  if (hit) return hit;
  const params = new URLSearchParams({ source, fen });
  if (source === 'lichess') {
    params.set('ratings', ratingBandsFor(rating).join(','));
    params.set('speeds', speeds.join(','));
  }
  try {
    const data = await api<ExplorerData>(`/api/explorer?${params}`, { signal });
    mem.set(key, data);
    void db().then((d) => d.put('explorer', { key, value: data, at: Date.now() })).catch(() => undefined);
    return data;
  } catch (e) {
    if (e instanceof ApiError) {
      const local = await db().then((d) => d.get('explorer', key)).catch(() => undefined);
      if (local) return { ...local.value, cached: true };
    }
    throw e;
  }
}

/** Peek without network (for offline training / instant paint). */
export async function cachedExplorer(source: ExplorerSource, fen: string, rating: number, speeds: Speed[]) {
  const key = explorerKey(source, fen, rating, speeds);
  return mem.get(key) ?? (await db().then((d) => d.get('explorer', key)).catch(() => undefined))?.value;
}
