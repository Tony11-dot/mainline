import { createStore, useStore, type StoreApi } from 'zustand';
import {
  INITIAL_FEN,
  addMove,
  childPath,
  createRoot,
  deleteAt,
  legalDests,
  mainlineEnd,
  nextPath,
  nodeAt,
  nodesOnPath,
  parentPath,
  pathToUcis,
  positionFromFen,
  promoteAt,
  siblingPath,
  type DrawShape,
  type TreeNode,
} from '@mainline/shared';
import type { Key } from 'chessground/types';
import { playSound, soundForMove } from '../lib/sound';
import { announceMove } from '../lib/announce';

export interface AnalysisState {
  root: TreeNode;
  path: string;
  orientation: 'white' | 'black';
  /** Bumped on every tree mutation (the tree is mutated in place). */
  version: number;
  collapsed: Set<string>;
  reset: (fen?: string, ucis?: string[]) => void;
  /** Plays `uci`; with `fromFen`, from the node showing that position (the board's view when moved). */
  play: (uci: string, fromFen?: string) => void;
  goto: (path: string, opts?: { sound?: boolean }) => void;
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
  sibling: (dir: 1 | -1) => void;
  flip: () => void;
  setOrientation: (c: 'white' | 'black') => void;
  remove: (path: string) => void;
  promote: (path: string) => void;
  setShapes: (shapes: DrawShape[]) => void;
  toggleCollapsed: (path: string) => void;
}

export type AnalysisStore = StoreApi<AnalysisState>;

export function createAnalysisStore(fen = INITIAL_FEN): AnalysisStore {
  return createStore<AnalysisState>((set, get) => {
    const bump = () => set((s) => ({ version: s.version + 1 }));
    const soundFor = (n: TreeNode | undefined) => {
      if (!n?.uci) return;
      playSound(soundForMove({ ...n, promotion: n.uci.length === 5 }));
      announceMove(n.ply % 2 === 1 ? 'white' : 'black', n.san);
    };
    return {
      root: createRoot(fen),
      path: '',
      orientation: 'white',
      version: 0,
      collapsed: new Set(),
      reset: (f = INITIAL_FEN, ucis = []) => {
        const root = createRoot(f);
        let p = '';
        for (const u of ucis) p = addMove(root, p, u).path;
        set((s) => ({ root, path: p, version: s.version + 1, collapsed: new Set() }));
      },
      play: (uci, fromFen) => {
        const { root, path: current } = get();
        const path = fromFen ? locate(root, current, fromFen) : current;
        let added;
        try {
          added = addMove(root, path, uci);
        } catch {
          return;
        }
        const { path: p, node } = added;
        soundFor(node);
        set((s) => ({ path: p, version: s.version + 1 }));
      },
      goto: (path, opts) => {
        const { root } = get();
        if (!nodeAt(root, path)) return;
        if (opts?.sound) soundFor(nodeAt(root, path));
        set({ path });
      },
      next: () => {
        const { root, path } = get();
        const n = nextPath(root, path);
        if (n !== undefined) {
          soundFor(nodeAt(root, n));
          set({ path: n });
        }
      },
      prev: () => {
        const { path } = get();
        if (path) set({ path: parentPath(path) });
      },
      first: () => set({ path: '' }),
      last: () => {
        const { root, path } = get();
        set({ path: mainlineEnd(root, path) });
      },
      sibling: (dir) => {
        const { root, path } = get();
        const s = siblingPath(root, path, dir);
        if (s !== undefined) set({ path: s });
      },
      flip: () => set((s) => ({ orientation: s.orientation === 'white' ? 'black' : 'white' })),
      setOrientation: (c) => set({ orientation: c }),
      remove: (p) => {
        const { root, path } = get();
        deleteAt(root, p);
        set({ path: path.startsWith(p) ? parentPath(p) : path });
        bump();
      },
      promote: (p) => {
        promoteAt(get().root, p);
        bump();
      },
      setShapes: (shapes) => {
        const node = nodeAt(get().root, get().path);
        if (node) node.shapes = shapes;
        bump();
      },
      toggleCollapsed: (p) =>
        set((s) => {
          const c = new Set(s.collapsed);
          if (c.has(p)) c.delete(p);
          else c.add(p);
          return { collapsed: c };
        }),
    };
  });
}

/** Path of the node showing `fen`: the current path, one of its ancestors, or anywhere in the tree. */
export function locate(root: TreeNode, path: string, fen: string): string {
  const epd = fen.split(' ').slice(0, 4).join(' ');
  const ucis = pathToUcis(path);
  for (let i = ucis.length; i >= 0; i--) {
    const p = ucis.slice(0, i).join(' ');
    if (nodeAt(root, p)?.epd === epd) return p;
  }
  const q: [TreeNode, string][] = [[root, '']];
  while (q.length) {
    const [n, p] = q.shift()!;
    if (n.epd === epd) return p;
    for (const c of n.children) q.push([c, childPath(p, c.uci)]);
  }
  return path;
}

/** Derived board view of the current node. */
export function useBoardView(store: AnalysisStore) {
  const root = useStore(store, (s) => s.root);
  const path = useStore(store, (s) => s.path);
  useStore(store, (s) => s.version);
  const node = nodeAt(root, path) ?? root;
  const pos = positionFromFen(node.fen);
  const turn = pos.turn;
  const lastMove = node.uci ? ([node.uci.slice(0, 2), node.uci.slice(2, 4)] as [Key, Key]) : undefined;
  return {
    root,
    path,
    node,
    nodes: nodesOnPath(root, path),
    turn,
    dests: legalDests(pos) as Map<Key, Key[]>,
    lastMove,
    check: node.check,
    childPath: (uci: string) => childPath(path, uci),
  };
}

/** Keyboard navigation: ←/→ move, ↑/Home first, ↓/End last, Shift+↑/↓ switch variation, f flip. */
export function bindAnalysisKeys(store: AnalysisStore, extra?: (e: KeyboardEvent) => boolean) {
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (extra?.(e)) return;
    const s = store.getState();
    const map: Record<string, () => void> = {
      ArrowLeft: s.prev,
      ArrowRight: s.next,
      ArrowUp: e.shiftKey ? () => s.sibling(-1) : s.first,
      ArrowDown: e.shiftKey ? () => s.sibling(1) : s.last,
      Home: s.first,
      End: s.last,
      f: s.flip,
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
