import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import type { Speed } from '@mainline/shared';

import { fontDef, pieceCss, resolveTheme, themeVars, type BoardTheme, type FontId, type PieceSet, type ThemeId } from './appearance';

export type { BoardTheme, FontId, PieceSet, ThemeId };

export interface Prefs {
  appTheme: ThemeId;
  font: FontId;
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  sound: boolean;
  volume: number; // 0..1
  haptics: boolean;
  coordinates: boolean;
  showDests: boolean;
  animationMs: number;
  rating: number;
  speeds: Speed[];
  engineOn: boolean;
  dailyNewLimit: number;
  dailyGoal: number;
  engineLines: number;
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
      appTheme: 'system',
      font: 'system',
      boardTheme: 'match',
      pieceSet: 'cburnett',
      sound: true,
      volume: 0.7,
      haptics: true,
      coordinates: true,
      showDests: true,
      animationMs: 200,
      rating: 1600,
      speeds: ['blitz', 'rapid'],
      engineOn: true,
      dailyNewLimit: 10,
      dailyGoal: 20,
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

/** Applies theme, font, board and pieces to <html>; re-applies on change and on OS light/dark switches. */
export function bindPrefsToDocument() {
  let pieceStyle: HTMLStyleElement | null = null;
  const apply = (p: Prefs) => {
    const root = document.documentElement;
    const { tokens, dark } = resolveTheme(p.appTheme);
    const vars = themeVars(tokens, dark);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.board = p.boardTheme;
    const font = fontDef(p.font);
    root.style.setProperty('--font-sans-live', font.stack);
    void font.load?.();
    if (p.reduceTransparency) root.dataset.reduceTransparency = '';
    else delete root.dataset.reduceTransparency;
    pieceStyle ??= Object.assign(document.createElement('style'), { id: 'ml-pieces' });
    if (!pieceStyle.isConnected) document.head.appendChild(pieceStyle);
    pieceStyle.textContent = pieceCss(p.pieceSet);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', tokens.surface));
    try {
      localStorage.setItem('mainline.boot', JSON.stringify({ vars, dark, board: p.boardTheme, font: font.stack }));
    } catch {
      /* private mode */
    }
  };
  apply(usePrefs.getState());
  usePrefs.subscribe(apply);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(usePrefs.getState()));
}
