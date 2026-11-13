/**
 * Every browser-storage read and write goes through here. Storage can be missing or throw (private mode,
 * blocked site data), and nothing in the app may break because of it: reads give null, writes are dropped.
 */
import type { PersistStorage } from 'zustand/middleware';

function area(kind: 'localStorage' | 'sessionStorage') {
  const s = () => window[kind];
  return {
    get(key: string): string | null {
      try {
        return s().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string | null) {
      try {
        if (value === null) s().removeItem(key);
        else s().setItem(key, value);
      } catch {
        /* kept for this visit only */
      }
    },
    getJson<T>(key: string): T | null {
      try {
        const raw = s().getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    setJson(key: string, value: unknown) {
      this.set(key, JSON.stringify(value));
    },
    clear() {
      try {
        s().clear();
      } catch {
        /* storage blocked */
      }
    },
  };
}

export const local = area('localStorage');
export const session = area('sessionStorage');

/** Keys other code (index.html's boot script) depends on by name; stored values must keep these names. */
export const KEYS = {
  session: 'mainline.session',
  bootTheme: 'mainline.boot',
  webPushEndpoint: 'mainline.push.endpoint',
  packsTidied: 'ml.tidy.packs',
} as const;

/** zustand `persist` storage that keeps the middleware's `{ state, version }` envelope as JSON. */
export function persistStorage<S>(): PersistStorage<S> {
  return {
    getItem: (name) => local.getJson(name),
    setItem: (name, value) => local.setJson(name, value),
    removeItem: (name) => local.set(name, null),
  };
}
