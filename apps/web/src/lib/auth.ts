import { create } from 'zustand';
import type { Me } from '@mainline/shared';
import { api, apiUrl, sessionToken } from './api';
import { platform } from '../platform';

interface AuthState {
  me: Me | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
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
}));

/** Full-page redirect on the web (COOP forbids popups); system browser on native (Phase 5). */
export function startLichessLogin(returnPath = location.pathname + location.search) {
  const p = platform();
  const native = p.kind === 'desktop' ? '&native=desktop' : p.isNative ? '&native=1' : '';
  const url = apiUrl(`/api/auth/lichess/start?return=${encodeURIComponent(returnPath)}${native}`);
  if (p.isNative) void p.openExternal(url.startsWith('http') ? url : `${location.origin}${url}`);
  else location.href = url;
}
