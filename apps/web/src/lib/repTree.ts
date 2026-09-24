import { buildGraph, childPath, createRoot, epdToFen, nodeAt, pathToUcis, playUci, positionFromFen, rootFromMoves, transpositionEpds, type RepMove, type Repertoire, type TreeNode } from '@mainline/shared';

const MAX_NODES = 6000;

/**
 * Builds a navigable move tree from a repertoire's EPD graph. Transposed positions are expanded
 * wherever they're reached (so the builder can continue from any path) and tagged 'tr'.
 */
export function repertoireTree(rep: Repertoire, moves: RepMove[]): TreeNode {
  const root = createRoot(rootFen(rep));
  const g = buildGraph(moves);
  const trans = transpositionEpds(g, rep.rootEpd);
  let count = 0;
  const expand = (node: TreeNode, onPath: Set<string>) => {
    const list = g.get(node.epd) ?? [];
    for (const m of list) {
      if (count++ > MAX_NODES || onPath.has(m.toEpd)) continue;
      const played = playUci(positionFromFen(node.fen), m.uci);
      const child: TreeNode = {
        uci: played.uci,
        san: played.san,
        ply: node.ply + 1,
        fen: played.fen,
        epd: played.epd,
        check: played.check,
        capture: played.capture,
        castle: played.castle,
        comment: m.note ?? undefined,
        shapes: (m.shapes as TreeNode['shapes']) ?? undefined,
        tags: [!m.isMainline && 'alt', trans.has(m.toEpd) && 'tr', m.note && 'note'].filter(Boolean) as string[],
        children: [],
      };
      node.children.push(child);
      onPath.add(child.epd);
      expand(child, onPath);
      onPath.delete(child.epd);
    }
  };
  expand(root, new Set([root.epd]));
  return root;
}

export function rootFen(rep: Repertoire): string {
  try {
    const r = rootFromMoves(rep.rootMovesUci);
    if (r.epd === rep.rootEpd) return r.fen;
  } catch {
    /* fall through */
  }
  return epdToFen(rep.rootEpd);
}

/** Longest prefix of `path` that still exists in `root`. */
export function validPrefix(root: TreeNode, path: string): string {
  let p = '';
  for (const u of pathToUcis(path)) {
    const next = childPath(p, u);
    if (!nodeAt(root, next)) break;
    p = next;
  }
  return p;
}

/** Path to the first node whose position is `epd` (BFS, shortest). */
export function pathToEpd(root: TreeNode, epd: string): string | undefined {
  const q: [TreeNode, string][] = [[root, '']];
  while (q.length) {
    const [n, p] = q.shift()!;
    if (n.epd === epd) return p;
    for (const c of n.children) q.push([c, childPath(p, c.uci)]);
  }
  return undefined;
}
