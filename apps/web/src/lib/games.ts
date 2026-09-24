/**
 * Your games vs your prep. Games are downloaded through our API (normalised, openings only), kept in
 * IndexedDB and analysed on the device against the local repertoire — works for guests too.
 */
import { create } from 'zustand';
import { buildBook, firstDeviation, type Deviation, type PlayedGame } from '@mainline/shared';
import { api } from './api';
import { db, kvGet, kvSet } from './idb';
import { useLibrary } from './library';
import { useTraining } from './training';
import { usePrefs } from './prefs';
import { useAuth } from './auth';

interface GamesState {
  loaded: boolean;
  games: PlayedGame[];
  importing: boolean;
  lastImport: number | null;
  error?: string;
  load: () => Promise<void>;
  importAll: (opts?: { quiet?: boolean }) => Promise<{ added: number; madeDue: number }>;
  clear: () => Promise<void>;
}

export const accounts = () => {
  const p = usePrefs.getState();
  const lichess = p.lichessUser || useAuth.getState().me?.lichessUsername || '';
  return { lichess, chesscom: p.chesscomUser };
};

export const useGames = create<GamesState>((set, get) => ({
  loaded: false,
  games: [],
  importing: false,
  lastImport: null,
  load: async () => {
    if (get().loaded) return;
    try {
      const games = await (await db()).getAll('games');
      set({ games: games.sort((a, b) => b.playedAt - a.playedAt), loaded: true, lastImport: (await kvGet<number>('games.lastImport')) ?? null });
    } catch {
      set({ loaded: true });
    }
  },
  importAll: async ({ quiet } = {}) => {
    if (get().importing) return { added: 0, madeDue: 0 };
    await get().load();
    set({ importing: true, error: undefined });
    const acc = accounts();
    const added: PlayedGame[] = [];
    try {
      for (const [site, user] of [['lichess', acc.lichess], ['chesscom', acc.chesscom]] as const) {
        if (!user) continue;
        const since = (await kvGet<number>(`games.since.${site}.${user.toLowerCase()}`)) ?? 0;
        const params = new URLSearchParams({ site, user, max: '300' });
        if (since) params.set('since', String(since));
        const { games } = await api<{ games: PlayedGame[] }>(`/api/games?${params}`);
        const have = new Set(get().games.map((g) => g.id));
        const fresh = games.filter((g) => !have.has(g.id));
        added.push(...fresh);
        if (games.length) await kvSet(`games.since.${site}.${user.toLowerCase()}`, Math.max(since, ...games.map((g) => g.playedAt)));
      }
      const d = await db();
      const tx = d.transaction('games', 'readwrite');
      for (const g of added) await tx.store.put(g);
      await tx.done;
      const all = [...get().games, ...added].sort((a, b) => b.playedAt - a.playedAt);
      const now = Date.now();
      await kvSet('games.lastImport', now);
      set({ games: all, lastImport: now });
      // Where you left book in a new game, that position is due for review now.
      const madeDue = await markDeviationsDue(added);
      return { added: added.length, madeDue };
    } catch (e) {
      if (!quiet) set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ importing: false });
    }
  },
  clear: async () => {
    await (await db()).clear('games');
    set({ games: [] });
  },
}));

export function analyse(games: PlayedGame[]): Map<string, Deviation> {
  const lib = useLibrary.getState();
  const data = { reps: lib.reps, moves: lib.moves };
  const books = { white: buildBook(data, 'white'), black: buildBook(data, 'black') };
  return new Map(games.map((g) => [g.id, firstDeviation(g, books[g.color])]));
}

async function markDeviationsDue(fresh: PlayedGame[]) {
  const devs = analyse(fresh);
  let n = 0;
  const done = new Set<string>();
  for (const g of fresh) {
    const d = devs.get(g.id);
    if (d?.kind !== 'you_left_book' || done.has(g.color + d.epd)) continue;
    done.add(g.color + d.epd);
    await useTraining.getState().makeDue(g.color, d.epd);
    n++;
  }
  return n;
}

/** Background refresh on app start (at most every 6 hours). */
export async function autoImportGames() {
  await useGames.getState().load();
  const acc = accounts();
  if (!acc.lichess && !acc.chesscom) return;
  const last = useGames.getState().lastImport ?? 0;
  if (Date.now() - last < 6 * 3600_000) return;
  await useGames.getState().importAll({ quiet: true }).catch(() => undefined);
}
