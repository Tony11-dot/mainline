import { INITIAL_FEN, positionFromFen, toEpd } from './epd';
import { playUci } from './chess';

/**
 * A move tree with variations (analysis board, PGN import).
 * A node is addressed by its path: the UCI moves from the root joined by spaces ('' = root).
 * Children are ordered; children[0] is the mainline continuation.
 */
export interface TreeNode {
  uci: string; // '' for the root
  san: string;
  ply: number; // ply of the position *after* this move (root = starting ply)
  fen: string;
  epd: string;
  check: boolean;
  capture: boolean;
  castle: boolean;
  comment?: string;
  shapes?: DrawShape[];
  children: TreeNode[];
}

export interface DrawShape {
  orig: string;
  dest?: string;
  brush?: string;
}

export function createRoot(fen: string = INITIAL_FEN, ply?: number): TreeNode {
  const pos = positionFromFen(fen);
  const parts = fen.split(/\s+/);
  const startPly = ply ?? ((Number(parts[5] ?? 1) || 1) - 1) * 2 + (parts[1] === 'b' ? 1 : 0);
  return {
    uci: '',
    san: '',
    ply: startPly,
    fen,
    epd: toEpd(pos),
    check: pos.isCheck(),
    capture: false,
    castle: false,
    children: [],
  };
}

export const pathToUcis = (path: string): string[] => (path ? path.split(' ') : []);
export const ucisToPath = (ucis: string[]): string => ucis.join(' ');
export const parentPath = (path: string): string => ucisToPath(pathToUcis(path).slice(0, -1));
export const childPath = (path: string, uci: string): string => (path ? `${path} ${uci}` : uci);

/** Nodes along a path, root first. Stops early if the path leaves the tree. */
export function nodesOnPath(root: TreeNode, path: string): TreeNode[] {
  const out = [root];
  let node = root;
  for (const u of pathToUcis(path)) {
    const next = node.children.find((c) => c.uci === u);
    if (!next) break;
    out.push(next);
    node = next;
  }
  return out;
}

export function nodeAt(root: TreeNode, path: string): TreeNode | undefined {
  const nodes = nodesOnPath(root, path);
  return nodes.length === pathToUcis(path).length + 1 ? nodes[nodes.length - 1] : undefined;
}

/**
 * Adds (or finds) the child `uci` under `path`. Mutates the tree. Returns the child's path
 * and whether it was newly created.
 */
export function addMove(root: TreeNode, path: string, uci: string): { path: string; node: TreeNode; created: boolean } {
  const parent = nodeAt(root, path);
  if (!parent) throw new Error(`no node at path "${path}"`);
  const existing = parent.children.find((c) => c.uci === uci);
  if (existing) return { path: childPath(path, uci), node: existing, created: false };
  const played = playUci(positionFromFen(parent.fen), uci);
  const node: TreeNode = {
    uci: played.uci,
    san: played.san,
    ply: parent.ply + 1,
    fen: played.fen,
    epd: played.epd,
    check: played.check,
    capture: played.capture,
    castle: played.castle,
    children: [],
  };
  parent.children.push(node);
  return { path: childPath(path, played.uci), node, created: true };
}

/** Plays a UCI line from `path`, adding nodes as needed. Returns the final path. */
export function addLine(root: TreeNode, path: string, ucis: string[]): string {
  let p = path;
  for (const u of ucis) p = addMove(root, p, u).path;
  return p;
}

/** Removes the node at `path` (and its subtree). */
export function deleteAt(root: TreeNode, path: string): void {
  const parent = nodeAt(root, parentPath(path));
  const last = pathToUcis(path).at(-1);
  if (!parent || !last) return;
  parent.children = parent.children.filter((c) => c.uci !== last);
}

/** Makes the node at `path` the mainline continuation of its parent. */
export function promoteAt(root: TreeNode, path: string): void {
  const parent = nodeAt(root, parentPath(path));
  const last = pathToUcis(path).at(-1);
  if (!parent || !last) return;
  const idx = parent.children.findIndex((c) => c.uci === last);
  if (idx > 0) {
    const [n] = parent.children.splice(idx, 1);
    parent.children.unshift(n!);
  }
}

/** Follows first children from `path` to the end of the line. */
export function mainlineEnd(root: TreeNode, path: string): string {
  let p = path;
  let node = nodeAt(root, path);
  while (node && node.children.length) {
    node = node.children[0]!;
    p = childPath(p, node.uci);
  }
  return p;
}

/** Path for "next move": first child, if any. */
export function nextPath(root: TreeNode, path: string): string | undefined {
  const node = nodeAt(root, path);
  const first = node?.children[0];
  return first ? childPath(path, first.uci) : undefined;
}

/** Sibling navigation (↑/↓): cycles between alternatives at the current ply. */
export function siblingPath(root: TreeNode, path: string, dir: 1 | -1): string | undefined {
  if (!path) return undefined;
  const parent = nodeAt(root, parentPath(path));
  const last = pathToUcis(path).at(-1);
  if (!parent || parent.children.length < 2) return undefined;
  const idx = parent.children.findIndex((c) => c.uci === last);
  const next = parent.children[(idx + dir + parent.children.length) % parent.children.length]!;
  return childPath(parentPath(path), next.uci);
}

/** All root→leaf lines (as UCI arrays). */
export function allLines(root: TreeNode): string[][] {
  const out: string[][] = [];
  const walk = (n: TreeNode, acc: string[]) => {
    if (!n.children.length) {
      if (acc.length) out.push(acc);
      return;
    }
    for (const c of n.children) walk(c, [...acc, c.uci]);
  };
  walk(root, []);
  return out;
}

export function countNodes(root: TreeNode): number {
  let n = 0;
  const walk = (x: TreeNode) => {
    n++;
    x.children.forEach(walk);
  };
  walk(root);
  return n;
}
