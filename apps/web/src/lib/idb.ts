import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EvalData, ExplorerData, Folder, PlayedGame, RepMove, Repertoire, ReviewEntry, TrainCard } from '@mainline/shared';

export type SyncTable = 'folders' | 'repertoires' | 'moves' | 'cards' | 'reviews';

export interface CacheEntry<T> {
  key: string;
  value: T;
  at: number;
}

export interface MainlineDB extends DBSchema {
  explorer: { key: string; value: CacheEntry<ExplorerData> };
  evals: { key: string; value: CacheEntry<EvalData> };
  kv: { key: string; value: { key: string; value: unknown } };
  folders: { key: string; value: Folder };
  repertoires: { key: string; value: Repertoire };
  moves: { key: [string, string, string]; value: RepMove; indexes: { byRep: string } };
  dirty: { key: string; value: { key: string; table: SyncTable; at: number } };
  cards: { key: [string, string, string]; value: TrainCard };
  reviews: { key: string; value: ReviewEntry; indexes: { byTime: number } };
  games: { key: string; value: PlayedGame };
}

let dbp: Promise<IDBPDatabase<MainlineDB>> | undefined;
export const DB_VERSION = 4;

export function db(): Promise<IDBPDatabase<MainlineDB>> {
  dbp ??= openDB<MainlineDB>('mainline', DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('explorer', { keyPath: 'key' });
        d.createObjectStore('evals', { keyPath: 'key' });
        d.createObjectStore('kv', { keyPath: 'key' });
      }
      if (oldVersion < 2) {
        d.createObjectStore('folders', { keyPath: 'id' });
        d.createObjectStore('repertoires', { keyPath: 'id' });
        const moves = d.createObjectStore('moves', { keyPath: ['repertoireId', 'fromEpd', 'uci'] });
        moves.createIndex('byRep', 'repertoireId');
        d.createObjectStore('dirty', { keyPath: 'key' });
      }
      if (oldVersion < 3) {
        d.createObjectStore('cards', { keyPath: ['color', 'epd', 'kind'] });
        d.createObjectStore('reviews', { keyPath: 'id' }).createIndex('byTime', 'reviewedAt');
      }
      if (oldVersion < 4) d.createObjectStore('games', { keyPath: 'id' });
    },
  });
  return dbp;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await (await db()).get('kv', key))?.value as T | undefined;
  } catch {
    return undefined;
  }
}
export async function kvSet(key: string, value: unknown) {
  try {
    await (await db()).put('kv', { key, value });
  } catch {
    /* ignore */
  }
}
