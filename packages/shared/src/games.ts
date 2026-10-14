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

/** One move they chose, counted over their games. */
export interface PrepChoice {
  uci: string;
  games: number;
  /** In your repertoire as a reply you've prepared. */
  prepared: boolean;
}

/** One of their first decisions: their first move (you're Black), or their answer to one of your first moves (you're White). */
export interface PrepFork {
  /** Moves leading here; empty at the start. */
  path: string[];
  /** Their games that reached this position. */
  games: number;
  choices: PrepChoice[];
}

/**
 * How a line meets your repertoire:
 * - covered: every move of it is in your repertoire
 * - they_leave: at `ply` they play a move you haven't prepared (you have other replies there)
 * - prep_ends: your repertoire stops at `ply`
 * - none: your repertoire for this colour doesn't reach it
 */
export type PrepBook = 'covered' | 'they_leave' | 'prep_ends' | 'none';

export interface PrepLine {
  /** From the start, UCI. */
  path: string[];
  /** Their games that followed every move of the line. */
  games: number;
  win: number;
  draw: number;
  loss: number;
  /** Their score in those games (win + ½ draw), 0..1. */
  score: number;
  lastPlayed: number;
  book: PrepBook;
  ply: number;
  /** The line stops because they've rarely faced your next move: that move and in how many of these games. */
  rare?: { uci: string; games: number };
}

export interface OpponentPrep {
  /** Your colour. */
  color: Color;
  /** Their games with the other colour. */
  games: number;
  /** A line goes on while at least this many of their games follow it. */
  minGames: number;
  forks: PrepFork[];
  /** Most played first. */
  lines: PrepLine[];
}

/**
 * Prep against one opponent, from their games with the colour opposite yours. Their opening tree is walked
 * the way your game would go: at your turn your repertoire move (each, if you have several; once your
 * repertoire ends, the move most of their opponents played, if most did), at theirs every move they play often
 * enough. A line ends where their games thin out (under `minGames` follow the next move), where play branches
 * after your repertoire, at `maxPly`, or where they've rarely faced your move.
 * Every count is a count of their real games, so "12 games" means 12 of their games went exactly that way.
 */
export function opponentPrep(theirGames: PlayedGame[], book: Book, opts: { maxPly?: number; minGames?: number; branch?: number } = {}): OpponentPrep {
  const theirColor: Color = book.color === 'white' ? 'black' : 'white';
  const games = theirGames.filter((g) => g.color === theirColor);
  const minGames = opts.minGames ?? Math.max(2, Math.round(games.length * 0.02));
  const maxPly = opts.maxPly ?? 20;
  const branch = opts.branch ?? 0.1;
  const start = positionFromFen(INITIAL_FEN);

  const byMove = (gs: PlayedGame[], ply: number) => {
    const m = new Map<string, PlayedGame[]>();
    for (const g of gs) {
      const u = g.ucis[ply];
      if (u) (m.get(u) ?? m.set(u, []).get(u)!).push(g);
    }
    return [...m].sort((a, b) => b[1].length - a[1].length);
  };
  const ownMoves = (epd: string) => [...new Set((book.own.get(epd) ?? []).map((o) => o.uci))];

  // Their first decisions.
  const fork = (gs: PlayedGame[], path: string[], pos: ReturnType<typeof positionFromFen>): PrepFork => {
    const replies = book.replies.get(toEpd(pos));
    return { path, games: gs.length, choices: byMove(gs, path.length).map(([uci, list]) => ({ uci, games: list.length, prepared: !!replies?.has(uci) })) };
  };
  const forks: PrepFork[] = [];
  if (theirColor === 'white') forks.push(fork(games, [], start));
  else {
    const first = byMove(games, 0);
    const mine = ownMoves(toEpd(start));
    const yours = mine.length ? mine.map((u) => [u, first.find(([x]) => x === u)?.[1] ?? []] as const) : first.filter(([, gs]) => gs.length >= minGames).slice(0, 3);
    for (const [u, gs] of yours) forks.push(fork(gs, [u], playUci(start, u).pos));
  }

  // Their lines.
  const leaves: { path: string[]; games: PlayedGame[]; rare?: PrepLine['rare'] }[] = [];
  const walk = (gs: PlayedGame[], path: string[], pos: ReturnType<typeof positionFromFen>) => {
    const ply = path.length;
    const moves = byMove(gs, ply);
    let next: (readonly [string, PlayedGame[]])[] = [];
    let rare: PrepLine['rare'];
    if (ply < maxPly) {
      if (pos.turn === theirColor) {
        next = moves.filter(([, list], i) => list.length >= minGames && (i === 0 || list.length >= gs.length * branch)).slice(0, 3);
      } else {
        const mine = ownMoves(toEpd(pos));
        if (mine.length) {
          const faced = mine.map((u) => [u, moves.find(([x]) => x === u)?.[1] ?? []] as const);
          next = faced.filter(([, list]) => list.length >= minGames);
          if (!next.length) {
            const best = faced.reduce((a, b) => (b[1].length > a[1].length ? b : a));
            rare = { uci: best[0], games: best[1].length };
          }
        } else {
          // Past your repertoire the line goes on only while one move is what most of their opponents played.
          next = moves.slice(0, 1).filter(([, list]) => list.length >= minGames && list.length * 2 >= gs.length);
        }
      }
    }
    if (!next.length) {
      if (ply > 0) leaves.push({ path, games: gs, rare });
      return;
    }
    for (const [u, list] of next) walk(list, [...path, u], playUci(pos, u).pos);
  };
  walk(games, [], start);

  const lines = leaves.map(({ path, games: gs, rare }): PrepLine => {
    const win = gs.filter((g) => g.result === 'win').length;
    const draw = gs.filter((g) => g.result === 'draw').length;
    return {
      path,
      games: gs.length,
      win,
      draw,
      loss: gs.length - win - draw,
      score: (win + draw / 2) / gs.length,
      lastPlayed: Math.max(...gs.map((g) => g.playedAt)),
      ...prepBook(path, book),
      rare,
    };
  });
  lines.sort((a, b) => b.games - a.games || b.path.length - a.path.length);
  return { color: book.color, games: games.length, minGames, forks, lines };
}

/** Where a line (from the start) leaves your repertoire. */
export function prepBook(path: string[], book: Book): { book: PrepBook; ply: number } {
  let pos = positionFromFen(INITIAL_FEN);
  for (let ply = 0; ply < path.length; ply++) {
    const epd = toEpd(pos);
    const u = path[ply]!;
    const ends = { book: ply === 0 ? 'none' : 'prep_ends', ply } as const;
    if (!book.positions.has(epd)) return ends;
    if (pos.turn === book.color) {
      if (!book.own.get(epd)?.some((o) => o.uci === u)) return ends;
    } else {
      const replies = book.replies.get(epd);
      if (!replies?.size) return ends;
      if (!replies.has(u)) return { book: 'they_leave', ply };
    }
    pos = playUci(pos, u).pos;
  }
  return { book: 'covered', ply: path.length };
}

/* ---------------- Your own results, per position ---------------- */

export interface MyMoveStats {
  games: number;
  /** Your score in those games (win + ½ draw), 0..1. */
  score: number;
}

/**
 * What happened in your games from each position, by the move played there (yours or your opponent's):
 * epd → uci → how many games and how you scored. Only games where you had `color`.
 */
export function myMovesByPosition(games: PlayedGame[], color: Color, maxPly = OPENING_PLIES): Map<string, Map<string, MyMoveStats>> {
  const acc = new Map<string, Map<string, { games: number; points: number }>>();
  for (const g of games) {
    if (g.color !== color) continue;
    const points = g.result === 'win' ? 1 : g.result === 'draw' ? 0.5 : 0;
    let pos = positionFromFen(INITIAL_FEN);
    for (const uci of g.ucis.slice(0, maxPly)) {
      const epd = toEpd(pos);
      let next;
      try {
        next = playUci(pos, uci);
      } catch {
        break;
      }
      const byMove = acc.get(epd) ?? acc.set(epd, new Map()).get(epd)!;
      const s = byMove.get(next.uci) ?? byMove.set(next.uci, { games: 0, points: 0 }).get(next.uci)!;
      s.games++;
      s.points += points;
      pos = next.pos;
    }
  }
  const out = new Map<string, Map<string, MyMoveStats>>();
  for (const [epd, byMove] of acc) out.set(epd, new Map([...byMove].map(([u, s]) => [u, { games: s.games, score: s.points / s.games }])));
  return out;
}
