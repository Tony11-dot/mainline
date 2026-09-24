import { INITIAL_FEN, positionFromFen, toEpd, toFen } from './epd';
import { playUci, sanToUci, type Color } from './chess';
import { buildGraph, mainMoveAt, reachable, type Graph, type RepMove, type Repertoire } from './repertoire';
import type { RepData } from './training';

/** A played game, normalised from Lichess or Chess.com (openings only need the first plies). */
export interface PlayedGame {
  id: string; // site:externalId
  site: 'lichess' | 'chesscom';
  url: string;
  color: Color; // the user's colour
  opponent: string;
  opponentRating?: number;
  result: 'win' | 'draw' | 'loss';
  speed: string;
  playedAt: number;
  ucis: string[];
}

export const OPENING_PLIES = 40;

/** SAN list → standard UCI (stops at the first illegal/unknown token). */
export function sanListToUcis(sans: string[], fen = INITIAL_FEN, max = OPENING_PLIES): string[] {
  let pos = positionFromFen(fen);
  const out: string[] = [];
  for (const san of sans) {
    if (out.length >= max) break;
    const uci = sanToUci(pos, san.replace(/[!?]+$/, ''));
    if (!uci) break;
    out.push(uci);
    pos = playUci(pos, uci).pos;
  }
  return out;
}

/* ---------------- Book = your repertoire, per colour ---------------- */

export interface Book {
  color: Color;
  /** Main (trained) moves by position — any same-colour repertoire. */
  own: Map<string, { uci: string; repId: string }[]>;
  /** Prepared opponent replies by position. */
  replies: Map<string, Set<string>>;
  /** Every position that belongs to the book (incl. the moves leading to each repertoire's root). */
  positions: Set<string>;
}

export function buildBook(data: RepData, color: Color): Book {
  const book: Book = { color, own: new Map(), replies: new Map(), positions: new Set() };
  const byRep = new Map<string, RepMove[]>();
  for (const m of data.moves) if (!m.deleted) (byRep.get(m.repertoireId) ?? byRep.set(m.repertoireId, []).get(m.repertoireId)!).push(m);
  for (const rep of data.reps) {
    if (rep.deleted || rep.color !== color) continue;
    const g: Graph = buildGraph(byRep.get(rep.id) ?? []);
    addRootPath(book, rep);
    for (const epd of reachable(g, rep.rootEpd)) {
      book.positions.add(epd);
      const list = g.get(epd) ?? [];
      const ownTurn = epd.split(' ')[1] === (color === 'white' ? 'w' : 'b');
      if (ownTurn) {
        const main = mainMoveAt(g, epd);
        if (main) (book.own.get(epd) ?? book.own.set(epd, []).get(epd)!).push({ uci: main.uci, repId: rep.id });
      } else {
        const set = book.replies.get(epd) ?? book.replies.set(epd, new Set()).get(epd)!;
        for (const m of list) set.add(m.uci);
      }
    }
  }
  return book;
}

/** Moves before a repertoire's root (e.g. 1.e4 c5 for a Sicilian repertoire) are "book" too. */
function addRootPath(book: Book, rep: Repertoire) {
  let pos = positionFromFen(INITIAL_FEN);
  for (const u of rep.rootMovesUci) {
    const epd = toEpd(pos);
    book.positions.add(epd);
    const ownTurn = pos.turn === book.color;
    if (ownTurn) {
      const list = book.own.get(epd) ?? book.own.set(epd, []).get(epd)!;
      if (!list.some((x) => x.uci === u)) list.push({ uci: u, repId: rep.id });
    } else {
      (book.replies.get(epd) ?? book.replies.set(epd, new Set()).get(epd)!).add(u);
    }
    pos = playUci(pos, u).pos;
  }
  book.positions.add(toEpd(pos));
}

/* ---------------- First deviation per game ---------------- */

export type DeviationKind = 'you_left_book' | 'opponent_left_book' | 'end_of_prep' | 'not_covered';

export interface Deviation {
  gameId: string;
  kind: DeviationKind;
  ply: number;
  epd: string;
  fen: string;
  played: string;
  expected: string[];
  /** Book moves leading here (the "line" this game followed). */
  path: string[];
  repIds: string[];
}

/**
 * Walks a game through the book and reports where it left it:
 * - you_left_book: your move differs from your trained move (→ make that card due)
 * - opponent_left_book: the opponent played something you haven't prepared
 * - end_of_prep: the game stayed in book until the book ran out (your prep ended)
 * - not_covered: the game never entered your repertoire for this colour
 */
export function firstDeviation(game: PlayedGame, book: Book): Deviation {
  let pos = positionFromFen(INITIAL_FEN);
  const path: string[] = [];
  const mk = (kind: DeviationKind, ply: number, played: string, expected: string[], repIds: string[] = []): Deviation => ({
    gameId: game.id,
    kind,
    ply,
    epd: toEpd(pos),
    fen: toFen(pos),
    played,
    expected,
    path: [...path],
    repIds,
  });
  for (let ply = 0; ply < game.ucis.length; ply++) {
    const epd = toEpd(pos);
    const uci = game.ucis[ply]!;
    if (!book.positions.has(epd)) return mk(ply === 0 ? 'not_covered' : 'end_of_prep', ply, uci, []);
    const ownTurn = pos.turn === book.color;
    if (ownTurn) {
      const own = book.own.get(epd) ?? [];
      if (!own.length) return mk(ply === 0 ? 'not_covered' : 'end_of_prep', ply, uci, []);
      if (!own.some((o) => o.uci === uci)) return mk('you_left_book', ply, uci, own.map((o) => o.uci), own.map((o) => o.repId));
    } else {
      const replies = book.replies.get(epd);
      if (!replies || !replies.size) return mk('end_of_prep', ply, uci, []);
      if (!replies.has(uci)) return mk(ply === 0 ? 'not_covered' : 'opponent_left_book', ply, uci, [...replies]);
    }
    path.push(uci);
    pos = playUci(pos, uci).pos;
  }
  return mk('end_of_prep', game.ucis.length, '', []);
}

/* ---------------- Aggregation: where your prep breaks ---------------- */

export interface BreakPoint {
  kind: DeviationKind;
  epd: string;
  fen: string;
  color: Color;
  count: number;
  /** Moves actually played there, most common first. */
  played: { uci: string; count: number }[];
  expected: string[];
  path: string[];
  gameIds: string[];
  /** Average ply where it happens. */
  ply: number;
}

export function breakPoints(games: PlayedGame[], devs: Map<string, Deviation>): BreakPoint[] {
  const by = new Map<string, BreakPoint>();
  for (const g of games) {
    const d = devs.get(g.id);
    if (!d || d.kind === 'not_covered') continue;
    const key = `${d.kind}|${g.color}|${d.epd}`;
    const bp = by.get(key) ?? { kind: d.kind, epd: d.epd, fen: d.fen, color: g.color, count: 0, played: [], expected: d.expected, path: d.path, gameIds: [], ply: d.ply };
    bp.count++;
    bp.gameIds.push(g.id);
    if (d.played) {
      const p = bp.played.find((x) => x.uci === d.played);
      if (p) p.count++;
      else bp.played.push({ uci: d.played, count: 1 });
    }
    by.set(key, bp);
  }
  for (const bp of by.values()) bp.played.sort((a, b) => b.count - a.count);
  return [...by.values()].sort((a, b) => b.count - a.count);
}

export interface LineResult {
  /** The book path shared by these games, first `depth` plies. */
  path: string[];
  color: Color;
  games: number;
  win: number;
  draw: number;
  loss: number;
  score: number;
}

/** Your results grouped by the book line each game followed (first `depth` plies of book). */
export function resultsByLine(games: PlayedGame[], devs: Map<string, Deviation>, depth = 6): LineResult[] {
  const by = new Map<string, LineResult>();
  for (const g of games) {
    const d = devs.get(g.id);
    if (!d || d.kind === 'not_covered' || d.path.length < 2) continue;
    const path = d.path.slice(0, depth);
    const key = `${g.color}|${path.join(' ')}`;
    const r = by.get(key) ?? { path, color: g.color, games: 0, win: 0, draw: 0, loss: 0, score: 0 };
    r.games++;
    r[g.result === 'win' ? 'win' : g.result === 'draw' ? 'draw' : 'loss']++;
    by.set(key, r);
  }
  for (const r of by.values()) r.score = (r.win + r.draw / 2) / r.games;
  return [...by.values()].sort((a, b) => b.games - a.games);
}

/* ---------------- Opponent prep ---------------- */

export interface OpponentMeet {
  /** Where the opponent's usual play meets your repertoire. */
  epd: string;
  fen: string;
  path: string[];
  /** Share of the opponent's games (with this colour) that reach this position. */
  reach: number;
  /** Their most common move here and how often they play it. */
  theirMove: string;
  theirShare: number;
  games: number;
  prepared: boolean;
}

/**
 * Builds the opponent's opening tree from their games (as the colour opposite yours) and walks it
 * together with your book: at their turn follow their frequent moves, at yours follow your trained
 * move. Returns where they commonly go, flagging moves you haven't prepared.
 */
export function opponentMeets(theirGames: PlayedGame[], book: Book, opts = { minShare: 0.1, maxPly: 24 }): OpponentMeet[] {
  const theirColor: Color = book.color === 'white' ? 'black' : 'white';
  const relevant = theirGames.filter((g) => g.color === theirColor);
  if (!relevant.length) return [];
  const out: OpponentMeet[] = [];
  const walk = (games: PlayedGame[], ply: number, path: string[], reach: number) => {
    if (ply >= opts.maxPly || games.length === 0) return;
    let pos = positionFromFen(INITIAL_FEN);
    for (const u of path) pos = playUci(pos, u).pos;
    const epd = toEpd(pos);
    if (!book.positions.has(epd)) return;
    if (pos.turn === theirColor) {
      const counts = new Map<string, PlayedGame[]>();
      for (const g of games) {
        const u = g.ucis[ply];
        if (u) (counts.get(u) ?? counts.set(u, []).get(u)!).push(g);
      }
      const total = [...counts.values()].reduce((a, b) => a + b.length, 0);
      for (const [u, gs] of [...counts].sort((a, b) => b[1].length - a[1].length)) {
        const share = gs.length / total;
        if (share < opts.minShare) break;
        const prepared = !!book.replies.get(epd)?.has(u);
        out.push({ epd, fen: toFen(pos), path: [...path], reach: reach * share, theirMove: u, theirShare: share, games: gs.length, prepared });
        if (prepared) walk(gs, ply + 1, [...path, u], reach * share);
      }
    } else {
      const own = book.own.get(epd);
      const mine = own?.[0]?.uci;
      if (!mine) return;
      // Continue with games where they faced your move.
      walk(games.filter((g) => g.ucis[ply] === mine), ply + 1, [...path, mine], reach);
    }
  };
  walk(relevant, 0, [], 1);
  return out.sort((a, b) => Number(a.prepared) - Number(b.prepared) || b.reach - a.reach);
}
