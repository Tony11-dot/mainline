import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import type { Speed } from '@mainline/shared';

export type Theme = 'system' | 'light' | 'dark';
export type BoardTheme = 'blue' | 'brown' | 'green' | 'slate';

export interface Prefs {
  theme: Theme;
  boardTheme: BoardTheme;
  sound: boolean;
  volume: number; // 0..1
  haptics: boolean;
  coordinates: boolean;
  showDests: boolean;
  animationMs: number;
  rating: number;
  speeds: Speed[];
  engineOn: boolean;
  engineLines: number;
  brand?: string;
  reduceTransparency: boolean;
  set: (p: Partial<Omit<Prefs, 'set'>>) => void;
}

/** Stores the flat prefs object (index.html's boot script reads it before React loads). */
const flatStorage: PersistStorage<Partial<Prefs>> = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      return raw ? { state: JSON.parse(raw) as Partial<Prefs>, version: 0 } : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, JSON.stringify(value.state));
    } catch {
      /* storage unavailable (private mode) — prefs live for this session only */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      theme: 'system',
      boardTheme: 'blue',
      sound: true,
      volume: 0.7,
      haptics: true,
      coordinates: true,
      showDests: true,
      animationMs: 200,
      rating: 1600,
      speeds: ['blitz', 'rapid'],
      engineOn: true,
      engineLines: 3,
      reduceTransparency: false,
      set: (p) => set(p),
    }),
    {
      name: 'mainline.prefs',
      storage: flatStorage,
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);

/** Applies theme/board/brand prefs to <html>. Call once at startup; re-applies on change. */
export function bindPrefsToDocument() {
  const apply = (p: Prefs) => {
    const root = document.documentElement;
    const dark = p.theme === 'dark' || (p.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.board = p.boardTheme;
    if (p.brand) root.style.setProperty('--brand', p.brand);
    else root.style.removeProperty('--brand');
    if (p.reduceTransparency) root.dataset.reduceTransparency = '';
    else delete root.dataset.reduceTransparency;
  };
  apply(usePrefs.getState());
  usePrefs.subscribe(apply);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(usePrefs.getState()));
}
