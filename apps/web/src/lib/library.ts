/**
 * Local-first repertoire library. IndexedDB is the source of truth on the device; this zustand store is
 * the in-memory mirror the UI renders from. Every mutation writes through to IndexedDB, bumps
 * `updatedAt`, and records the row in the dirty set that the sync engine pushes when signed in.
 * Deletes are tombstones (deleted: true) so they sync and can be undone.
 */
import { create } from 'zustand';
import {
  buildGraph,
  exportPgn,
  importPgn,
  makeMove,
  moveKey,
  orphanedMoves,
  reachable,
  rootFromMoves,
  type Color,
  type Folder,
  type RepMove,
  type Repertoire,
  type Shape,
} from '@mainline/shared';
import { db, type MainlineDB, type SyncTable } from './idb';
import { t as tl } from './i18n';

export type { SyncTable };

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

interface LibraryState {
  loaded: boolean;
  folders: Folder[];
  reps: Repertoire[];
  moves: RepMove[];
  /** bumps on every change so memoized graphs can recompute */
  version: number;
  load: () => Promise<void>;
  createFolder: (name: string, color: Color, parentId: string | null, rootMovesUci?: string[]) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  /** Changes a folder's moves (the position its lines start from). Only for folders with nothing inside. */
  setFolderMoves: (id: string, rootMovesUci: string[]) => Promise<void>;
  moveFolder: (id: string, parentId: string | null, sortIndex?: number) => Promise<void>;
  deleteFolder: (id: string) => Promise<() => Promise<void>>;
  createRepertoire: (opts: { name: string; color: Color; folderId: string | null; rootMovesUci?: string[]; source?: string }) => Promise<Repertoire>;
  renameRepertoire: (id: string, name: string) => Promise<void>;
  /** Makes a ready-made line your own, to edit freely. */
  takeOver: (id: string) => Promise<void>;
  moveRepertoire: (id: string, folderId: string | null, sortIndex?: number) => Promise<void>;
  deleteRepertoire: (id: string) => Promise<() => Promise<void>>;
  addMove: (repId: string, fromFen: string, uci: string) => Promise<RepMove>;
  deleteBranch: (repId: string, fromEpd: string, uci: string) => Promise<() => Promise<void>>;
  /** Ends the line at a position: every move from there on goes (undoable). */
  cutAfter: (repId: string, epd: string) => Promise<() => Promise<void>>;
  /**
   * A new line next to this one that shares its moves up to a point (`pathUcis`, from the line's start).
   * With `take`, the move played there and everything after it moves across from this line.
   */
  branchLine: (repId: string, pathUcis: string[], opts: { name: string; take?: string }) => Promise<Repertoire>;
  makeMain: (repId: string, fromEpd: string, uci: string) => Promise<void>;
  setNote: (repId: string, fromEpd: string, uci: string, note: string) => Promise<void>;
  setShapes: (repId: string, fromEpd: string, uci: string, shapes: Shape[]) => Promise<void>;
  importPgn: (repId: string, pgn: string) => Promise<{ added: number; errors: string[] }>;
  exportPgn: (repId: string) => string;
  /** Rows arriving from the server (sync pull) — no dirty marking. */
  applyRemote: (rows: { folders?: Folder[]; reps?: Repertoire[]; moves?: RepMove[] }) => Promise<void>;
}

const now = () => Date.now();

async function markDirty(table: SyncTable, keys: string[]) {
  const d = await db();
  const tx = d.transaction('dirty', 'readwrite');
  for (const k of keys) await tx.store.put({ key: `${table}|${k}`, table, at: now() });
  await tx.done;
  window.dispatchEvent(new CustomEvent('mainline:dirty'));
}

async function putAll<T extends 'folders' | 'repertoires' | 'moves'>(store: T, rows: MainlineDB[T]['value'][]) {
  if (!rows.length) return;
  const d = await db();
  const tx = d.transaction(store, 'readwrite');
  for (const r of rows) await tx.store.put(r as never);
  await tx.done;
}

export const useLibrary = create<LibraryState>((set, get) => {
  // Memory first (synchronously, so back-to-back mutations see each other), then IndexedDB.
  const saveFolders = async (rows: Folder[]) => {
    set((s) => ({ folders: upsert(s.folders, rows, (f) => f.id), version: s.version + 1 }));
    await putAll('folders', rows);
    await markDirty('folders', rows.map((r) => r.id));
  };
  const saveReps = async (rows: Repertoire[]) => {
    set((s) => ({ reps: upsert(s.reps, rows, (r) => r.id), version: s.version + 1 }));
    await putAll('repertoires', rows);
    await markDirty('repertoires', rows.map((r) => r.id));
  };
  const saveMoves = async (rows: RepMove[]) => {
    set((s) => ({ moves: upsert(s.moves, rows, moveKey), version: s.version + 1 }));
    await putAll('moves', rows);
    await markDirty('moves', rows.map(moveKey));
  };

  const repOf = (id: string) => {
    const r = get().reps.find((x) => x.id === id);
    if (!r) throw new Error('repertoire not found');
    return r;
  };
  const movesOf = (repId: string) => get().moves.filter((m) => m.repertoireId === repId && !m.deleted);
  const findMove = (repId: string, fromEpd: string, uci: string) => get().moves.find((m) => m.repertoireId === repId && m.fromEpd === fromEpd && m.uci === uci);

  /** Deletes moves played at one position and everything only they lead to; returns the undo. */
  const removeFrom = async (repId: string, fromEpd: string, ucis: string[]) => {
    const r = repOf(repId);
    const live = movesOf(repId);
    const targets = live.filter((m) => m.fromEpd === fromEpd && ucis.includes(m.uci));
    if (!targets.length) return async () => undefined;
    const t = now();
    const after = live.map((m) => (targets.includes(m) ? { ...m, deleted: true } : m));
    const orphanKeys = new Set(orphanedMoves(after, r.rootEpd).map(moveKey));
    const removed = [...targets, ...live.filter((m) => orphanKeys.has(moveKey(m)))];
    // If the main own move went and an alternate stays, the alternate becomes main.
    const promote: RepMove[] = [];
    if (targets.some((m) => m.isMainline)) {
      const alt = after.find((m) => !m.deleted && m.fromEpd === fromEpd && !m.isMainline);
      if (alt) promote.push({ ...alt, isMainline: true, updatedAt: t });
    }
    await saveMoves([...removed.map((m) => ({ ...m, deleted: true, updatedAt: t })), ...promote]);
    return async () => {
      const t2 = now();
      await saveMoves([...removed.map((m) => ({ ...m, deleted: false, updatedAt: t2 })), ...promote.map((p) => ({ ...p, isMainline: false, updatedAt: t2 }))]);
    };
  };

  return {
    loaded: false,
    folders: [],
    reps: [],
    moves: [],
    version: 0,

    load: () => {
      if (get().loaded) return Promise.resolve();
      // Single flight: concurrent callers share one load (otherwise each would create root folders).
      return (loading ??= (async () => {
        try {
          const d = await db();
          const [folders, reps, moves] = await Promise.all([d.getAll('folders'), d.getAll('repertoires'), d.getAll('moves')]);
          set((s) => ({ folders, reps, moves, loaded: true, version: s.version + 1 }));
          await ensureRoots();
        } catch {
          set({ loaded: true });
        }
      })().finally(() => (loading = undefined)));
    },

    createFolder: async (name, color, parentId, rootMovesUci) => {
      const siblings = get().folders.filter((f) => !f.deleted && f.parentId === parentId);
      const f: Folder = { id: uid(), parentId, name: name.trim() || tl('New folder'), color, sortIndex: nextIndex(siblings), ...(rootMovesUci ? { rootMovesUci } : {}), updatedAt: now() };
      await saveFolders([f]);
      return f;
    },
    renameFolder: async (id, name) => {
      const f = get().folders.find((x) => x.id === id);
      if (f && name.trim()) await saveFolders([{ ...f, name: name.trim(), updatedAt: now() }]);
    },
    setFolderMoves: async (id, rootMovesUci) => {
      const f = get().folders.find((x) => x.id === id);
      if (!f || f.parentId === null) return;
      if (repsUnder(get().folders, get().reps, id).length || descendants(get().folders, id).length) return;
      await saveFolders([{ ...f, rootMovesUci, updatedAt: now() }]);
    },
    moveFolder: async (id, parentId, sortIndex) => {
      const f = get().folders.find((x) => x.id === id);
      if (!f || id === parentId || isDescendant(get().folders, parentId, id)) return;
      const siblings = get().folders.filter((x) => !x.deleted && x.parentId === parentId && x.id !== id);
      await saveFolders([{ ...f, parentId, sortIndex: sortIndex ?? nextIndex(siblings), updatedAt: now() }]);
    },
    deleteFolder: async (id) => {
      const all = get().folders;
      const ids = new Set([id, ...descendants(all, id)]);
      const folders = all.filter((f) => ids.has(f.id) && !f.deleted);
      const reps = get().reps.filter((r) => r.folderId && ids.has(r.folderId) && !r.deleted);
      const t = now();
      await saveFolders(folders.map((f) => ({ ...f, deleted: true, updatedAt: t })));
      await saveReps(reps.map((r) => ({ ...r, deleted: true, updatedAt: t })));
      return async () => {
        const t2 = now();
        await saveFolders(folders.map((f) => ({ ...f, deleted: false, updatedAt: t2 })));
        await saveReps(reps.map((r) => ({ ...r, deleted: false, updatedAt: t2 })));
      };
    },

    createRepertoire: async ({ name, color, folderId, rootMovesUci = [], source }) => {
      const root = rootFromMoves(rootMovesUci);
      const siblings = get().reps.filter((r) => !r.deleted && r.folderId === folderId);
      const t = now();
      const r: Repertoire = { id: uid(), folderId, name: name.trim() || tl('New repertoire'), color, rootEpd: root.epd, rootMovesUci, ...(source ? { source } : {}), sortIndex: nextIndex(siblings), createdAt: t, updatedAt: t };
      await saveReps([r]);
      return r;
    },
    takeOver: async (id) => {
      const r = repOf(id);
      if (r.source) await saveReps([{ ...r, source: '', updatedAt: now() }]);
    },
    renameRepertoire: async (id, name) => {
      const r = repOf(id);
      if (name.trim()) await saveReps([{ ...r, name: name.trim(), updatedAt: now() }]);
    },
    moveRepertoire: async (id, folderId, sortIndex) => {
      const r = repOf(id);
      const siblings = get().reps.filter((x) => !x.deleted && x.folderId === folderId && x.id !== id);
      await saveReps([{ ...r, folderId, sortIndex: sortIndex ?? nextIndex(siblings), updatedAt: now() }]);
    },
    deleteRepertoire: async (id) => {
      const r = repOf(id);
      await saveReps([{ ...r, deleted: true, updatedAt: now() }]);
      return async () => saveReps([{ ...r, deleted: false, updatedAt: now() }]);
    },

    addMove: async (repId, fromFen, uci) => {
      const r = repOf(repId);
      const m = makeMove(r, movesOf(repId), fromFen, uci);
      const existing = findMove(repId, m.fromEpd, m.uci);
      if (existing && !existing.deleted) return existing;
      const row = existing ? { ...existing, deleted: false, isMainline: m.isMainline, updatedAt: now() } : m;
      await saveMoves([row]);
      return row;
    },
    deleteBranch: async (repId, fromEpd, uci) => removeFrom(repId, fromEpd, [uci]),
    cutAfter: async (repId, epd) => removeFrom(repId, epd, movesOf(repId).filter((m) => m.fromEpd === epd).map((m) => m.uci)),
    branchLine: async (repId, pathUcis, { name, take }) => {
      const r = repOf(repId);
      const mine = movesOf(repId);
      const g = buildGraph(mine);
      const t = now();
      const copy: RepMove[] = [];
      let epd = r.rootEpd;
      for (const u of pathUcis) {
        const m = g.get(epd)?.find((x) => x.uci === u);
        if (!m) break;
        copy.push(m);
        epd = m.toEpd;
      }
      if (take) {
        const first = g.get(epd)?.find((x) => x.uci === take);
        if (first) {
          copy.push(first);
          const under = reachable(g, first.toEpd);
          // Positions the line still reaches some other way stay where they are.
          for (const m of mine) if (under.has(m.fromEpd) && m !== first) copy.push(m);
        }
      }
      const siblings = get().reps.filter((x) => !x.deleted && x.folderId === r.folderId);
      const nr: Repertoire = { id: uid(), folderId: r.folderId, name: name.trim() || r.name, color: r.color, rootEpd: r.rootEpd, rootMovesUci: r.rootMovesUci, sortIndex: nextIndex(siblings), createdAt: t, updatedAt: t };
      await saveReps([nr]);
      // The branch is your own line: whatever it came from, its moves are yours to change.
      const rows = copy.map((m) => ({ ...m, repertoireId: nr.id, deleted: false, isMainline: m.isMainline || (m.fromEpd === epd && m.uci === take), updatedAt: t }));
      await saveMoves([...new Map(rows.map((m) => [moveKey(m), m])).values()]);
      if (take) await removeFrom(repId, epd, [take]);
      return nr;
    },
    makeMain: async (repId, fromEpd, uci) => {
      const t = now();
      const siblings = movesOf(repId).filter((m) => m.fromEpd === fromEpd);
      await saveMoves(siblings.map((m) => ({ ...m, isMainline: m.uci === uci, updatedAt: t })));
    },
    setNote: async (repId, fromEpd, uci, note) => {
      const m = findMove(repId, fromEpd, uci);
      if (m) await saveMoves([{ ...m, note: note.trim() || null, updatedAt: now() }]);
    },
    setShapes: async (repId, fromEpd, uci, shapes) => {
      const m = findMove(repId, fromEpd, uci);
      if (m) await saveMoves([{ ...m, shapes: shapes.length ? shapes : null, updatedAt: now() }]);
    },
    importPgn: async (repId, pgn) => {
      const r = repOf(repId);
      const res = importPgn(pgn, r, movesOf(repId));
      await saveMoves(res.moves);
      return { added: res.moves.length, errors: res.errors };
    },
    exportPgn: (repId) => exportPgn(repOf(repId), movesOf(repId)),

    applyRemote: async ({ folders = [], reps = [], moves = [] }) => {
      const s = get();
      const newer = <T extends { updatedAt: number }>(incoming: T[], current: T[], key: (x: T) => string) => {
        const byKey = new Map(current.map((c) => [key(c), c]));
        return incoming.filter((i) => (byKey.get(key(i))?.updatedAt ?? -1) < i.updatedAt);
      };
      const f = newer(folders, s.folders, (x) => x.id);
      const r = newer(reps, s.reps, (x) => x.id);
      const m = newer(moves, s.moves, moveKey);
      await putAll('folders', f);
      await putAll('repertoires', r);
      await putAll('moves', m);
      set((st) => ({
        folders: upsert(st.folders, f, (x) => x.id),
        reps: upsert(st.reps, r, (x) => x.id),
        moves: upsert(st.moves, m, moveKey),
        version: st.version + 1,
      }));
      if (f.length) await ensureRoots();
    },
  };

  /**
   * The White and Black root folders. Every device creates its own on first run, so after syncing there
   * can be several: default-named duplicates are merged into the one with the smallest id (the same choice
   * on every device, so they converge), moving their repertoires and sub-folders across.
   */
  async function ensureRoots() {
    const { folders, reps } = get();
    const live = folders.filter((f) => !f.deleted && f.parentId === null);
    const folderChanges: Folder[] = [];
    const repChanges: Repertoire[] = [];
    for (const [color, name, idx] of [['white', 'White', 0], ['black', 'Black', 1]] as const) {
      const mine = live.filter((f) => f.color === color);
      if (!mine.length) {
        folderChanges.push({ id: uid(), parentId: null, name, color, sortIndex: idx, updatedAt: now() });
        continue;
      }
      const [keep, ...dupes] = mine.filter((f) => f.name === name).sort((x, y) => (x.id < y.id ? -1 : 1));
      if (!keep) continue;
      for (const d of dupes) {
        for (const r of reps) if (!r.deleted && r.folderId === d.id) repChanges.push({ ...r, folderId: keep.id, updatedAt: now() });
        for (const c of folders) if (!c.deleted && c.parentId === d.id) folderChanges.push({ ...c, parentId: keep.id, updatedAt: now() });
        folderChanges.push({ ...d, deleted: true, updatedAt: now() });
      }
    }
    if (folderChanges.length) await saveFolders(folderChanges);
    if (repChanges.length) await saveReps(repChanges);
  }
});

function upsert<T>(list: T[], rows: T[], key: (x: T) => string): T[] {
  if (!rows.length) return list;
  const map = new Map(list.map((x) => [key(x), x]));
  for (const r of rows) map.set(key(r), r);
  return [...map.values()];
}

let loading: Promise<void> | undefined;

const nextIndex = (siblings: { sortIndex: number }[]) => (siblings.length ? Math.max(...siblings.map((s) => s.sortIndex)) + 1 : 0);

export function descendants(folders: Folder[], id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const f of folders) {
      if (f.parentId === cur && !f.deleted) {
        out.push(f.id);
        stack.push(f.id);
      }
    }
  }
  return out;
}

function isDescendant(folders: Folder[], maybeChild: string | null, ancestor: string) {
  return !!maybeChild && descendants(folders, ancestor).includes(maybeChild);
}

/** Every live repertoire inside a folder, at any depth. */
export function repsUnder(folders: Folder[], reps: Repertoire[], folderId: string): Repertoire[] {
  const ids = new Set([folderId, ...descendants(folders, folderId)]);
  return reps.filter((r) => !r.deleted && r.folderId !== null && ids.has(r.folderId));
}

/**
 * The position a folder stands for. Folders made from the opening picker or a ready-made set carry it;
 * for older ones it's the moves every repertoire inside shares, if any.
 */
export function folderMoves(folders: Folder[], reps: Repertoire[], folderId: string): string[] {
  const f = folders.find((x) => x.id === folderId);
  if (!f) return [];
  if (f.rootMovesUci) return f.rootMovesUci;
  const inside = repsUnder(folders, reps, folderId);
  if (!inside.length || f.parentId === null) return [];
  let common = inside[0]!.rootMovesUci;
  for (const r of inside) {
    let i = 0;
    while (i < common.length && common[i] === r.rootMovesUci[i]) i++;
    common = common.slice(0, i);
  }
  return common;
}

/** "White / vs 1.e4 / Najdorf" */
export function folderPath(folders: Folder[], id: string | null): string[] {
  const out: string[] = [];
  let cur = folders.find((f) => f.id === id);
  while (cur) {
    out.unshift(cur.name);
    cur = folders.find((f) => f.id === cur!.parentId);
  }
  return out;
}

/** Live moves of a repertoire, memo-friendly. */
export function repMoves(moves: RepMove[], repId: string) {
  return moves.filter((m) => m.repertoireId === repId && !m.deleted);
}

/** Where the repertoire's main line stands a few moves in: the thumbnail that tells repertoires apart. */
export function repPreview(moves: RepMove[], rep: Repertoire, plies = 8) {
  const g = buildGraph(repMoves(moves, rep.id));
  let epd = rep.rootEpd;
  let lastUci: string | undefined;
  const seen = new Set([epd]);
  for (let i = 0; i < plies; i++) {
    const next = g.get(epd)?.[0];
    if (!next || seen.has(next.toEpd)) break;
    epd = next.toEpd;
    lastUci = next.uci;
    seen.add(epd);
  }
  return { epd, lastUci };
}

export function repStats(moves: RepMove[], rep: Repertoire) {
  const g = buildGraph(repMoves(moves, rep.id));
  let own = 0;
  let total = 0;
  for (const list of g.values()) {
    total += list.length;
    for (const m of list) if (m.isMainline && (m.fromEpd.split(' ')[1] === 'w') === (rep.color === 'white')) own++;
  }
  return { moves: total, positions: own };
}
