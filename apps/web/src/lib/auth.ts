import { create } from 'zustand';
import type { Me } from '@mainline/shared';
import { api, apiUrl, sessionToken } from './api';
import { platform } from '../platform';

interface AuthState {
  me: Me | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  /** Deletes the server account (if signed in), then every byte stored on this device. */
  deleteEverything: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  me: null,
  loaded: false,
  refresh: async () => {
    try {
      const { me } = await api<{ me: Me | null }>('/api/me');
      set({ me, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    sessionToken.set(null);
    set({ me: null });
  },
  deleteEverything: async () => {
    if (useAuth.getState().me) await api('/api/me', { method: 'DELETE' });
    sessionToken.set(null);
    set({ me: null });
    await eraseDevice();
  },
}));

/** Local data: IndexedDB, preferences, caches and the service worker. The caller reloads. */
async function eraseDevice() {
  try {
    const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager?.getSubscription();
    if (sub) {
      await api('/api/push/unsubscribe', { method: 'POST', json: { endpoint: sub.endpoint } }).catch(() => undefined);
      await sub.unsubscribe();
    }
  } catch {
    /* no push */
  }
  try {
    (await import('./idb').then((m) => m.db())).close();
  } catch {
    /* not opened */
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('mainline');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* storage blocked */
  }
  if ('caches' in self) for (const k of await caches.keys()) await caches.delete(k);
  for (const r of (await navigator.serviceWorker?.getRegistrations?.()) ?? []) await r.unregister();
}

/** Full-page redirect on the web (COOP forbids popups); system browser on native (Phase 5). */
export function startLichessLogin(returnPath = location.pathname + location.search) {
  const p = platform();
  const native = p.kind === 'desktop' ? '&native=desktop' : p.isNative ? '&native=1' : '';
  const url = apiUrl(`/api/auth/lichess/start?return=${encodeURIComponent(returnPath)}${native}`);
  if (p.isNative) void p.openExternal(url.startsWith('http') ? url : `${location.origin}${url}`);
  else location.href = url;
}
