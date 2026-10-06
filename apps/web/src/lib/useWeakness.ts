import { useEffect, useMemo } from 'react';
import { useLibrary } from './library';
import { useTraining } from './training';
import { useGames } from './games';
import { analyseWeakness, type WeakItem, type WeaknessReport } from './weakness';
import { practiceHref, scopeRepIds, type Scope } from './practice';
import type { Repertoire } from '@mainline/shared';

/** The weakness report over everything on this device, recomputed when the library, training or games change. */
export function useWeakness(): { report: WeaknessReport | null; loaded: boolean } {
  const lib = useLibrary();
  const tr = useTraining();
  const games = useGames((g) => g.games);
  const gamesLoaded = useGames((g) => g.loaded);
  useEffect(() => {
    void lib.load();
    void tr.load();
    void useGames.getState().load();
  }, [lib, tr]);
  const loaded = lib.loaded && tr.loaded;
  const report = useMemo(
    () => (loaded ? analyseWeakness({ folders: lib.folders, reps: lib.reps, moves: lib.moves, cards: tr.cards, reviews: tr.reviews, games }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, lib.version, tr.version, games],
  );
  return { report, loaded: loaded && gamesLoaded };
}

/** The lines a scope covers. */
export function scopeReps(scope: Scope): Repertoire[] {
  const { folders, reps, moves } = useLibrary.getState();
  const ids = scopeRepIds(new URL(practiceHref(scope, 'test'), 'https://x').searchParams, folders, reps, moves);
  const live = reps.filter((r) => !r.deleted);
  return ids ? live.filter((r) => ids.includes(r.id)) : live;
}

/** The weak parts of a focus, worst first: its lines, folders and moves that the report ranks. */
export function weakPartsOf(report: WeaknessReport, scope: Scope): WeakItem[] {
  const inside = new Set(scopeReps(scope).map((r) => r.id));
  const all = [...report.moves, ...report.folders, ...report.lines].sort((a, b) => b.badness - a.badness);
  return all.filter((it) => {
    if (JSON.stringify(it.scope) === JSON.stringify(scope)) return false;
    const reps = scopeReps(it.scope);
    return reps.length > 0 && reps.every((r) => inside.has(r.id)) && reps.length < inside.size + (it.kind === 'line' ? 1 : 0);
  });
}
