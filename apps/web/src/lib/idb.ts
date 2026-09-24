import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EvalData, ExplorerData } from '@mainline/shared';

export interface CacheEntry<T> {
  key: string;
  value: T;
  at: number;
}

export interface MainlineDB extends DBSchema {
  explorer: { key: string; value: CacheEntry<ExplorerData> };
  evals: { key: string; value: CacheEntry<EvalData> };
  kv: { key: string; value: { key: string; value: unknown } };
}

let dbp: Promise<IDBPDatabase<MainlineDB>> | undefined;
const upgraders: ((db: IDBPDatabase<MainlineDB>, oldVersion: number) => void)[] = [];
export const DB_VERSION = 3;

/** Later modules register their stores here (schema lives with the feature). */
export function registerUpgrade(fn: (db: IDBPDatabase<MainlineDB>, oldVersion: number) => void) {
  upgraders.push(fn);
}

export function db(): Promise<IDBPDatabase<MainlineDB>> {
  dbp ??= openDB<MainlineDB>('mainline', DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('explorer', { keyPath: 'key' });
        d.createObjectStore('evals', { keyPath: 'key' });
        d.createObjectStore('kv', { keyPath: 'key' });
      }
      for (const u of upgraders) u(d, oldVersion);
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
