import { parsePgn, startingPosition, type PgnNodeData, type Node as PgnNode } from 'chessops/pgn';
import { parseSan } from 'chessops/san';
import type { Chess } from 'chessops/chess';
import { INITIAL_FEN, epdToFen, positionFromFen, sideToMove, toEpd, toFen } from './epd';
import { playUci, standardUci, type Color } from './chess';

/* ---------------- Types (local-first rows, mirrored by the server tables) ---------------- */

export interface SyncMeta {
  updatedAt: number; // ms epoch
  deleted?: boolean;
}

export interface Folder extends SyncMeta {
  id: string;
  parentId: string | null;
  name: string;
  color: Color;
  sortIndex: number;
}

export interface Repertoire extends SyncMeta {
  id: string;
  folderId: string | null;
  name: string;
  color: Color;
  /** Starting position (after rootMovesUci from the initial position). */
  rootEpd: string;
  rootMovesUci: string[];
  sortIndex: number;
  createdAt: number;
}

export interface Shape {
  orig: string;
  dest?: string;
  brush?: string;
}

export interface RepMove extends SyncMeta {
  repertoireId: string;
  fromEpd: string;
  uci: string;
  san: string;
  toEpd: string;
  /** For the repertoire's own side: false = alternate (only one main move per position is trained). */
  isMainline: boolean;
  note?: string | null;
  shapes?: Shape[] | null;
  addedAt: number;
}

export const moveKey = (m: Pick<RepMove, 'repertoireId' | 'fromEpd' | 'uci'>) => `${m.repertoireId}|${m.fromEpd}|${m.uci}`;

/* ---------------- Graph ---------------- */

export type Graph = Map<string, RepMove[]>;

/** Adjacency by position; live moves only, mainline first then by insertion. */
export function buildGraph(moves: RepMove[]): Graph {
  const g: Graph = new Map();
  for (const m of moves) {
    if (m.deleted) continue;
    const list = g.get(m.fromEpd) ?? [];
    list.push(m);
    g.set(m.fromEpd, list);
  }
  for (const list of g.values()) list.sort((a, b) => Number(b.isMainline) - Number(a.isMainline) || a.addedAt - b.addedAt);
  return g;
}

export const isOwnTurn = (color: Color, epd: string) => sideToMove(epd) === color;

/** Epds reachable from the root (cycle-safe). */
export function reachable(g: Graph, rootEpd: string): Set<string> {
  const seen = new Set<string>([rootEpd]);
  const stack = [rootEpd];
  while (stack.length) {
    const e = stack.pop()!;
    for (const m of g.get(e) ?? []) {
      if (!seen.has(m.toEpd)) {
        seen.add(m.toEpd);
        stack.push(m.toEpd);
      }
    }
  }
  return seen;
}

/** Moves no longer reachable from the root (to be deleted after a branch is removed). */
export function orphanedMoves(moves: RepMove[], rootEpd: string): RepMove[] {
  const g = buildGraph(moves);
  const live = reachable(g, rootEpd);
  return moves.filter((m) => !m.deleted && !live.has(m.fromEpd));
}

export interface Line {
  moves: RepMove[];
  /** The line ends because the position was already expanded elsewhere (transposition). */
  transposesTo?: string;
}

/**
 * All root→leaf lines. A position reached a second time (transposition) ends that line with
 * `transposesTo` instead of re-expanding it, so lines stay finite and unique.
 */
export function lines(g: Graph, rootEpd: string, opts: { mainlineOnlyFor?: Color } = {}): Line[] {
  const out: Line[] = [];
  const expanded = new Set<string>();
  const walk = (epd: string, acc: RepMove[]) => {
    expanded.add(epd);
    let next = g.get(epd) ?? [];
    if (opts.mainlineOnlyFor && isOwnTurn(opts.mainlineOnlyFor, epd)) next = next.filter((m) => m.isMainline).slice(0, 1);
    if (!next.length) {
      if (acc.length) out.push({ moves: acc });
      return;
    }
    for (const m of next) {
      if (expanded.has(m.toEpd)) out.push({ moves: [...acc, m], transposesTo: m.toEpd });
      else walk(m.toEpd, [...acc, m]);
    }
  };
  walk(rootEpd, []);
  return out;
}

/** Positions where the repertoire's side must find a move (these become training cards). */
export function cardEpds(g: Graph, rootEpd: string, color: Color): string[] {
  const out: string[] = [];
  for (const epd of reachable(g, rootEpd)) {
    if (isOwnTurn(color, epd) && (g.get(epd) ?? []).some((m) => m.isMainline)) out.push(epd);
  }
  return out;
}

/** The trained (main) move at an own-turn position. */
export function mainMoveAt(g: Graph, epd: string): RepMove | undefined {
  const list = g.get(epd) ?? [];
  return list.find((m) => m.isMainline) ?? list[0];
}

/** Epds reached by more than one move within one graph. */
export function transpositionEpds(g: Graph, rootEpd: string): Set<string> {
  const incoming = new Map<string, number>();
  const live = reachable(g, rootEpd);
  for (const [from, list] of g) {
    if (!live.has(from)) continue;
    for (const m of list) incoming.set(m.toEpd, (incoming.get(m.toEpd) ?? 0) + 1);
  }
  return new Set([...incoming].filter(([, n]) => n > 1).map(([e]) => e));
}

export interface Conflict {
  epd: string;
  color: Color;
  /** uci → repertoire ids prescribing it */
  choices: Map<string, string[]>;
}

/**
 * Same-colour repertoires that prescribe different main moves in the same position.
 * (Cards are shared per colour+position, so the user must pick one.)
 */
export function findConflicts(reps: Repertoire[], moves: RepMove[]): Conflict[] {
  const byRep = new Map<string, RepMove[]>();
  for (const m of moves) if (!m.deleted) (byRep.get(m.repertoireId) ?? byRep.set(m.repertoireId, []).get(m.repertoireId)!).push(m);
  const acc = new Map<string, Conflict>();
  for (const r of reps) {
    if (r.deleted) continue;
    const g = buildGraph(byRep.get(r.id) ?? []);
    for (const epd of cardEpds(g, r.rootEpd, r.color)) {
      const main = mainMoveAt(g, epd)!;
      const key = `${r.color}|${epd}`;
      const c = acc.get(key) ?? { epd, color: r.color, choices: new Map() };
      const ids = c.choices.get(main.uci) ?? [];
      ids.push(r.id);
      c.choices.set(main.uci, ids);
      acc.set(key, c);
    }
  }
  return [...acc.values()].filter((c) => c.choices.size > 1);
}

/* ---------------- Editing helpers ---------------- */

/**
 * Creates the RepMove for playing `uci` at `fromEpd`. At an own-turn position that already has a
 * main move, the new move becomes an alternate.
 */
export function makeMove(
  rep: Pick<Repertoire, 'id' | 'color'>,
  existing: RepMove[],
  fromFenOrEpd: string,
  uci: string,
  now = Date.now(),
): RepMove {
  const pos = positionFromFen(fromFenOrEpd);
  const fromEpd = toEpd(pos);
  const played = playUci(pos, uci);
  const siblings = existing.filter((m) => !m.deleted && m.fromEpd === fromEpd && m.repertoireId === rep.id);
  const own = isOwnTurn(rep.color, fromEpd);
  return {
    repertoireId: rep.id,
    fromEpd,
    uci: played.uci,
    san: played.san,
    toEpd: played.epd,
    isMainline: own ? !siblings.some((m) => m.isMainline && m.uci !== played.uci) : true,
    addedAt: now,
    updatedAt: now,
  };
}

/** Root position for a repertoire that starts after some moves. */
export function rootFromMoves(ucis: string[]): { epd: string; fen: string } {
  let pos: Chess = positionFromFen(INITIAL_FEN);
  for (const u of ucis) pos = playUci(pos, u).pos;
  return { epd: toEpd(pos), fen: toFen(pos) };
}

/* ---------------- PGN ---------------- */

export interface PgnImportResult {
  moves: RepMove[];
  games: number;
  skipped: number;
  /** Moves before the repertoire root that were ignored (PGN started earlier). */
  errors: string[];
}

/**
 * Imports every game/variation of a PGN into a repertoire. Moves are merged (existing moves are kept);
 * positions before the repertoire's root are walked through but only moves from the root onward are
 * added when the PGN passes through the root.
 */
export function importPgn(pgn: string, rep: Pick<Repertoire, 'id' | 'color' | 'rootEpd'>, existing: RepMove[] = [], now = Date.now()): PgnImportResult {
  const games = parsePgn(pgn);
  const byKey = new Map(existing.filter((m) => !m.deleted).map((m) => [moveKey(m), m]));
  const added = new Map<string, RepMove>();
  const errors: string[] = [];
  let skipped = 0;
  let t = now;
  const all = () => [...byKey.values(), ...added.values()];

  games.forEach((game, gi) => {
    const start = startingPosition(game.headers);
    if (start.isErr) {
      errors.push(`Game ${gi + 1}: invalid starting position`);
      skipped++;
      return;
    }
    const walk = (node: PgnNode<PgnNodeData>, pos: Chess, inRep: boolean) => {
      for (const child of node.children) {
        const move = parseSan(pos, child.data.san);
        if (!move) {
          errors.push(`Game ${gi + 1}: illegal move ${child.data.san}`);
          continue;
        }
        const fromEpd = toEpd(pos);
        const active = inRep || fromEpd === rep.rootEpd;
        const uci = standardUci(pos, move);
        const next = pos.clone();
        next.play(move);
        if (active) {
          const key = `${rep.id}|${fromEpd}|${uci}`;
          if (!byKey.has(key) && !added.has(key)) {
            const m = makeMove(rep, all(), toFen(pos), uci, t++);
            const comment = child.data.comments?.join(' ').trim();
            if (comment) m.note = comment;
            added.set(key, m);
          }
        }
        walk(child, next, active);
      }
    };
    walk(game.moves, start.unwrap() as Chess, toEpd(start.unwrap() as Chess) === rep.rootEpd);
  });
  return { moves: [...added.values()], games: games.length, skipped, errors };
}

/** Exports a repertoire as one PGN game with variations (main moves first). */
export function exportPgn(rep: Pick<Repertoire, 'name' | 'color' | 'rootEpd' | 'rootMovesUci'>, moves: RepMove[]): string {
  const g = buildGraph(moves);
  const startFen = epdToFen(rep.rootEpd);
  const isStd = toEpd(INITIAL_FEN) === rep.rootEpd;
  const plyOf = (fen: string) => {
    const p = fen.split(' ');
    return (Number(p[5] ?? 1) - 1) * 2 + (p[1] === 'b' ? 1 : 0);
  };
  const startPly = isStd ? 0 : plyOf(fenForRoot(rep));
  const expanded = new Set<string>();

  const num = (ply: number, force: boolean) => (ply % 2 === 0 ? `${ply / 2 + 1}. ` : force ? `${Math.floor(ply / 2) + 1}... ` : '');
  const text = (m: RepMove) => (m.note ? `${m.san} {${m.note.replace(/[{}]/g, '')}}` : m.san);

  const line = (epd: string, ply: number, force: boolean): string => {
    if (expanded.has(epd)) return '';
    expanded.add(epd);
    const list = g.get(epd) ?? [];
    if (!list.length) return '';
    const [main, ...alts] = list;
    let s = num(ply, force) + text(main!);
    for (const a of alts) {
      const rest = line(a.toEpd, ply + 1, false);
      s += ` (${num(ply, true)}${text(a)}${rest ? ' ' + rest : ''})`;
    }
    const cont = line(main!.toEpd, ply + 1, alts.length > 0);
    return cont ? `${s} ${cont}` : s;
  };

  const headers = [
    `[Event "${rep.name.replace(/"/g, "'")}"]`,
    `[Site "Mainline"]`,
    `[White "${rep.color === 'white' ? 'Repertoire' : '?'}"]`,
    `[Black "${rep.color === 'black' ? 'Repertoire' : '?'}"]`,
    `[Result "*"]`,
  ];
  if (!isStd) headers.push(`[SetUp "1"]`, `[FEN "${fenForRoot(rep) ?? startFen}"]`);
  return `${headers.join('\n')}\n\n${line(rep.rootEpd, startPly, true)} *\n`;
}

function fenForRoot(rep: Pick<Repertoire, 'rootEpd' | 'rootMovesUci'>): string {
  try {
    const r = rootFromMoves(rep.rootMovesUci);
    if (r.epd === rep.rootEpd) return r.fen;
  } catch {
    /* fall through */
  }
  return epdToFen(rep.rootEpd);
}
