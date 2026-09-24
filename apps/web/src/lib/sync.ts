/**
 * Background sync for signed-in users (guests stay purely local). Pushes rows in the dirty set, pulls
 * rows changed on other devices, and keeps a server-time cursor. Rows created before signing in are
 * already dirty, so a guest's library uploads on first sign-in.
 */
import { create } from 'zustand';
import type { Folder, RepMove, Repertoire, ReviewEntry, TrainCard } from '@mainline/shared';
import { api, ApiError } from './api';
import { db, kvGet, kvSet } from './idb';
import { useLibrary } from './library';
import { useTraining } from './training';
import { useAuth } from './auth';

interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: number | null;
  error?: string;
}

export const useSync = create<SyncState>(() => ({ status: 'idle', lastSyncedAt: null }));

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = doSync().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

async function doSync() {
  if (!useAuth.getState().me) return;
  useSync.setState({ status: 'syncing', error: undefined });
  try {
    const d = await db();
    const dirty = await d.getAll('dirty');
    const pushStartedAt = Date.now();
    const pick = (table: string) => dirty.filter((x) => x.table === table).map((x) => x.key.slice(table.length + 1));
    const [folders, reps, moves, cards, reviews] = await Promise.all([
      Promise.all(pick('folders').map((id) => d.get('folders', id))),
      Promise.all(pick('repertoires').map((id) => d.get('repertoires', id))),
      Promise.all(pick('moves').map((k) => d.get('moves', splitKey(k) as [string, string, string]))),
      Promise.all(pick('cards').map((k) => d.get('cards', splitKey(k) as [string, string, string]))),
      Promise.all(pick('reviews').map((id) => d.get('reviews', id))),
    ]);
    const cursor = (await kvGet<string>('sync.cursor')) ?? null;
    const res = await api<{
      cursor: string;
      pull: { folders: Folder[]; repertoires: Repertoire[]; moves: RepMove[]; cards: TrainCard[]; reviews: ReviewEntry[] };
    }>('/api/sync', {
      method: 'POST',
      json: {
        cursor,
        changes: {
          folders: defined(folders),
          repertoires: defined(reps),
          moves: defined(moves).map(({ note, shapes, ...m }) => ({ ...m, note: note ?? null, shapes: shapes ?? null })),
          cards: defined(cards),
          reviews: defined(reviews),
        },
      },
    });
    // Clear only what we pushed and that hasn't changed again since.
    const tx = d.transaction('dirty', 'readwrite');
    for (const x of dirty) {
      const cur = await tx.store.get(x.key);
      if (cur && cur.at <= pushStartedAt) await tx.store.delete(x.key);
    }
    await tx.done;
    await useLibrary.getState().applyRemote({ folders: res.pull.folders, reps: res.pull.repertoires, moves: res.pull.moves.map(fixNulls) });
    await useTraining.getState().applyRemote({ cards: res.pull.cards, reviews: res.pull.reviews });
    await kvSet('sync.cursor', res.cursor);
    useSync.setState({ status: 'idle', lastSyncedAt: Date.now() });
  } catch (e) {
    if (e instanceof ApiError && e.offline) useSync.setState({ status: 'offline' });
    else if (e instanceof ApiError && e.status === 401) useSync.setState({ status: 'idle' });
    else useSync.setState({ status: 'error', error: (e as Error).message });
  }
}

/** Moves are keyed [repertoireId, fromEpd, uci]; ids are uuids (no '|'), EPDs contain no '|'. */
function splitKey(k: string) {
  return k.split('|');
}
const defined = <T>(xs: (T | undefined)[]) => xs.filter((x): x is T => !!x);
const fixNulls = (m: RepMove): RepMove => ({ ...m, note: m.note ?? null, shapes: m.shapes ?? null });

let started = false;
export function startSync() {
  if (started) return;
  started = true;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const soon = (ms = 2000) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void syncNow(), ms);
  };
  window.addEventListener('mainline:dirty', () => soon());
  window.addEventListener('online', () => soon(200));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && soon(300));
  setInterval(() => void syncNow(), 5 * 60_000);
  useAuth.subscribe((s, prev) => {
    if (s.me && s.me.id !== prev.me?.id) soon(100);
  });
  if (useAuth.getState().me) soon(100);
}
