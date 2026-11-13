import { db } from './idb';

type Store = 'explorer' | 'evals';

/**
 * A two-level cache for data that is expensive to fetch and fine to reuse: memory for this visit, IndexedDB
 * for the next one and for offline. A disk failure only costs the next visit, so it is never surfaced.
 */
export function deviceCache<V>(store: Store) {
  const mem = new Map<string, V | null>();
  const disk = {
    read: (key: string) => db().then((d) => d.get(store, key) as Promise<{ value: V } | undefined>).then((r) => r?.value, () => undefined),
    write: (key: string, value: V) => void db().then((d) => d.put(store, { key, value, at: Date.now() } as never)).catch(() => undefined),
  };
  return {
    /** Memory only. undefined = not known, null = known to have nothing. */
    peek: (key: string) => mem.get(key),
    entries: () => mem.entries(),
    /** Memory, then disk. */
    async get(key: string): Promise<V | null | undefined> {
      return mem.has(key) ? mem.get(key) : disk.read(key);
    },
    /** Disk only (the fallback when the network is down). */
    fromDisk: disk.read,
    /** Remembers a value in memory and on disk; null (a known miss) is kept in memory only. */
    put(key: string, value: V | null) {
      mem.set(key, value);
      if (value !== null) disk.write(key, value);
    },
  };
}
