/**
 * Statistics over everything stored on the device: the review log, FSRS cards, repertoires and
 * imported games. Pure functions (no stores) so every screen can slice the same numbers.
 */
import { buildGraph, isOwnTurn, playUci, positionFromFen, toEpd, INITIAL_FEN, type Deviation, type PlayedGame, type Repertoire, type RepMove, type ReviewEntry, type TrainCard } from '@mainline/shared';
import type { OpeningInfo } from './openings';

const DAY = 86_400_000;

export interface Record3 {
  games: number;
  win: number;
  draw: number;
  loss: number;
  /** 0..1, draws count half. */
  score: number;
}

export function record(games: Pick<PlayedGame, 'result'>[]): Record3 {
  const r = { games: games.length, win: 0, draw: 0, loss: 0, score: 0 };
  for (const g of games) r[g.result]++;
  r.score = r.games ? (r.win + r.draw / 2) / r.games : 0;
  return r;
}

/* ---------------- Training ---------------- */

export type Maturity = 'new' | 'learning' | 'young' | 'mature';
export const MATURITY: Maturity[] = ['new', 'learning', 'young', 'mature'];

/** FSRS state → how well a position is known (Anki's buckets: mature = stability ≥ 21 days). */
export function maturity(c: TrainCard | undefined): Maturity {
  if (!c || c.fsrs.reps === 0) return 'new';
  if (c.fsrs.state === 1 || c.fsrs.state === 3) return 'learning';
  return c.fsrs.stability >= 21 ? 'mature' : 'young';
}

export interface TrainingStats {
  reviews: number;
  correct: number;
  /** 0..1 over all graded answers (null when there are none). */
  accuracy: number | null;
  accuracy7: number | null;
  accuracy30: number | null;
  /** Median answer time in ms (correct answers). */
  medianMs: number | null;
  /** Reviews per local day, oldest first, ending today. */
  daily: { day: number; reviews: number; correct: number }[];
  activeDays30: number;
  due: number;
  lapses: number;
  maturity: Record<Maturity, number>;
  /** Positions answered wrong most often. */
  hardest: { color: 'white' | 'black'; epd: string; wrong: number; total: number }[];
}

const isCorrect = (r: ReviewEntry) => r.rating > 1;
const acc = (rs: ReviewEntry[]) => (rs.length ? rs.filter(isCorrect).length / rs.length : null);

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * `positions` narrows everything to one repertoire's own-move positions (colour|epd keys); by
 * default all cards and reviews count.
 */
export function trainingStats(reviews: ReviewEntry[], cards: TrainCard[], opts: { positions?: Set<string>; days?: number; now?: number } = {}): TrainingStats {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? 30;
  const inScope = (color: string, epd: string) => !opts.positions || opts.positions.has(`${color}|${epd}`);
  const rs = reviews.filter((r) => !r.deleted && inScope(r.color, r.cardEpd));
  const cs = cards.filter((c) => !c.deleted && c.kind === 'repertoire' && inScope(c.color, c.epd));

  const today = startOfDay(now);
  // Local days, stepping by calendar date (DST-safe).
  const daily: TrainingStats['daily'] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    daily.push({ day: d.getTime(), reviews: 0, correct: 0 });
  }
  const index = new Map(daily.map((d, i) => [d.day, i]));
  for (const r of rs) {
    const i = index.get(startOfDay(r.reviewedAt));
    if (i === undefined) continue;
    daily[i]!.reviews++;
    if (isCorrect(r)) daily[i]!.correct++;
  }

  const times = rs.filter(isCorrect).map((r) => r.msTaken).filter((t) => t > 0 && t < 10 * 60_000).sort((a, b) => a - b);
  const mat: Record<Maturity, number> = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const c of cs) mat[maturity(c)]++;
  if (opts.positions) mat.new += Math.max(0, opts.positions.size - cs.length);

  const wrongBy = new Map<string, { color: 'white' | 'black'; epd: string; wrong: number; total: number }>();
  for (const r of rs) {
    const k = `${r.color}|${r.cardEpd}`;
    const h = wrongBy.get(k) ?? { color: r.color, epd: r.cardEpd, wrong: 0, total: 0 };
    h.total++;
    if (!isCorrect(r)) h.wrong++;
    wrongBy.set(k, h);
  }

  return {
    reviews: rs.length,
    correct: rs.filter(isCorrect).length,
    accuracy: acc(rs),
    accuracy7: acc(rs.filter((r) => r.reviewedAt >= today - 6 * DAY)),
    accuracy30: acc(rs.filter((r) => r.reviewedAt >= today - 29 * DAY)),
    medianMs: times.length ? times[Math.floor(times.length / 2)]! : null,
    daily,
    activeDays30: daily.slice(-30).filter((d) => d.reviews > 0).length,
    due: cs.filter((c) => c.due <= now).length,
    lapses: cs.reduce((n, c) => n + (c.fsrs.lapses ?? 0), 0),
    maturity: mat,
    hardest: [...wrongBy.values()]
      .filter((h) => h.wrong > 0)
      .sort((a, b) => b.wrong / b.total - a.wrong / a.total || b.wrong - a.wrong)
      .slice(0, 5),
  };
}

/* ---------------- Repertoires ---------------- */

export interface RepertoireShape {
  moves: number;
  /** Positions where it's your move (the ones you train). */
  ownPositions: number;
  /** Opponent replies you've prepared for. */
  replies: number;
  /** Complete lines (leaves). */
  lines: number;
  /** Longest line in plies from the repertoire's start. */
  depth: number;
  /** Average plies per line. */
  avgDepth: number;
  /** colour|epd keys of own-move positions (to scope training stats). */
  positions: Set<string>;
}

export function repertoireShape(rep: Repertoire, moves: RepMove[]): RepertoireShape {
  const live = moves.filter((m) => m.repertoireId === rep.id && !m.deleted);
  const g = buildGraph(live);
  const positions = new Set<string>();
  let replies = 0;
  let lines = 0;
  let depth = 0;
  let totalDepth = 0;
  const seen = new Set<string>();
  const stack: [string, number][] = [[rep.rootEpd, 0]];
  while (stack.length) {
    const [epd, ply] = stack.pop()!;
    if (seen.has(epd)) continue;
    seen.add(epd);
    const next = g.get(epd) ?? [];
    const own = isOwnTurn(rep.color, epd);
    if (own && next.length) positions.add(`${rep.color}|${epd}`);
    if (!own) replies += next.length;
    if (!next.length) {
      if (ply > 0) {
        lines++;
        totalDepth += ply;
        depth = Math.max(depth, ply);
      }
      continue;
    }
    for (const m of next) stack.push([m.toEpd, ply + 1]);
  }
  return { moves: live.length, ownPositions: positions.size, replies, lines, depth, avgDepth: lines ? totalDepth / lines : 0, positions };
}

export interface RepertoireGames extends Record3 {
  /** Where games that used this repertoire left it. */
  youLeft: number;
  theyLeft: number;
  prepEnded: number;
  /** Average ply at which games left the book (how deep your prep held). */
  avgBookPly: number | null;
}

/**
 * Games that used a repertoire: same colour, and at least one of its moves was played (from the
 * position it belongs to). Deviation kinds come from the whole book (`devs`, see analyse()).
 */
export function repertoireGames(rep: Repertoire, moves: RepMove[], games: PlayedGame[], devs: Map<string, Deviation>): RepertoireGames {
  const own = new Set(moves.filter((m) => m.repertoireId === rep.id && !m.deleted).map((m) => `${m.fromEpd}|${m.uci}`));
  const used = own.size ? games.filter((g) => g.color === rep.color && playedAny(g, own)) : [];
  const ds = used.map((g) => devs.get(g.id)).filter((d): d is Deviation => !!d && d.kind !== 'not_covered');
  return {
    ...record(used),
    youLeft: ds.filter((d) => d.kind === 'you_left_book').length,
    theyLeft: ds.filter((d) => d.kind === 'opponent_left_book').length,
    prepEnded: ds.filter((d) => d.kind === 'end_of_prep').length,
    avgBookPly: ds.length ? ds.reduce((n, d) => n + d.ply, 0) / ds.length : null,
  };
}

function playedAny(g: PlayedGame, keys: Set<string>): boolean {
  let pos = positionFromFen(INITIAL_FEN);
  for (const uci of g.ucis.slice(0, 30)) {
    if (keys.has(`${toEpd(pos)}|${uci}`)) return true;
    try {
      pos = playUci(pos, uci).pos;
    } catch {
      return false;
    }
  }
  return false;
}

/* ---------------- Games ---------------- */

export interface GameStats {
  all: Record3;
  white: Record3;
  black: Record3;
  bySpeed: { speed: string; rec: Record3 }[];
  bySite: { site: PlayedGame['site']; rec: Record3 }[];
  /** Last 10 results, newest first. */
  form: PlayedGame['result'][];
  /** Average opponent rating (rated games). */
  avgOpponent: number | null;
  /** Rating performance: avg opponent + 400·(W−L)/N, the classic linear estimate. */
  performance: number | null;
}

export function gameStats(games: PlayedGame[]): GameStats {
  const sorted = [...games].sort((a, b) => b.playedAt - a.playedAt);
  const group = <K extends string>(key: (g: PlayedGame) => K) => {
    const m = new Map<K, PlayedGame[]>();
    for (const g of games) m.set(key(g), [...(m.get(key(g)) ?? []), g]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  };
  const rated = games.filter((g) => g.opponentRating);
  const avgOpponent = rated.length ? rated.reduce((n, g) => n + g.opponentRating!, 0) / rated.length : null;
  const rr = record(rated);
  return {
    all: record(games),
    white: record(games.filter((g) => g.color === 'white')),
    black: record(games.filter((g) => g.color === 'black')),
    bySpeed: group((g) => g.speed || 'other').map(([speed, gs]) => ({ speed, rec: record(gs) })),
    bySite: group((g) => g.site).map(([site, gs]) => ({ site, rec: record(gs) })),
    form: sorted.slice(0, 10).map((g) => g.result),
    avgOpponent,
    performance: avgOpponent !== null && rr.games ? Math.round(avgOpponent + (400 * (rr.win - rr.loss)) / rr.games) : null,
  };
}

/* ---------------- Openings ---------------- */

export interface OpeningStat {
  opening: OpeningInfo;
  color: 'white' | 'black';
  rec: Record3;
  avgOpponent: number | null;
  lastPlayed: number;
}

/** The most specific named opening each game reached (within its first 30 plies). */
export function openingOfGame(g: PlayedGame, byEpd: Map<string, OpeningInfo>): OpeningInfo | undefined {
  let pos = positionFromFen(INITIAL_FEN);
  let found: OpeningInfo | undefined;
  for (const uci of g.ucis.slice(0, 30)) {
    try {
      const played = playUci(pos, uci);
      pos = played.pos;
      found = byEpd.get(toEpd(played.fen)) ?? found;
    } catch {
      break;
    }
  }
  return found;
}

/**
 * Your record per opening and colour. `family` groups variations under their opening's name
 * ("Sicilian Defense: Najdorf Variation" → "Sicilian Defense").
 */
export function openingStats(games: PlayedGame[], byEpd: Map<string, OpeningInfo>, opts: { family?: boolean } = {}): OpeningStat[] {
  const by = new Map<string, { opening: OpeningInfo; color: 'white' | 'black'; games: PlayedGame[] }>();
  for (const g of games) {
    const o = openingOfGame(g, byEpd);
    if (!o) continue;
    const name = opts.family ? o.name.split(':')[0]!.trim() : o.name;
    const key = `${g.color}|${name}`;
    const e = by.get(key) ?? { opening: { ...o, name }, color: g.color, games: [] };
    e.games.push(g);
    by.set(key, e);
  }
  return [...by.values()]
    .map(({ opening, color, games: gs }) => {
      const rated = gs.filter((g) => g.opponentRating);
      return {
        opening,
        color,
        rec: record(gs),
        avgOpponent: rated.length ? Math.round(rated.reduce((n, g) => n + g.opponentRating!, 0) / rated.length) : null,
        lastPlayed: Math.max(...gs.map((g) => g.playedAt)),
      };
    })
    .sort((a, b) => b.rec.games - a.rec.games || b.lastPlayed - a.lastPlayed);
}

export const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);

const positionsCache = new WeakMap<PlayedGame, Set<string>>();

/** EPDs a game passed through in its first 30 plies (cached per game object). */
function positionsOf(g: PlayedGame): Set<string> {
  let s = positionsCache.get(g);
  if (s) return s;
  s = new Set([toEpd(INITIAL_FEN)]);
  let pos = positionFromFen(INITIAL_FEN);
  for (const uci of g.ucis.slice(0, 30)) {
    try {
      const played = playUci(pos, uci);
      pos = played.pos;
      s.add(toEpd(played.fen));
    } catch {
      break;
    }
  }
  positionsCache.set(g, s);
  return s;
}

/** Your games that reached a position (any move order), split by the colour you had. */
export function gamesThrough(games: PlayedGame[], epd: string): { white: Record3; black: Record3; all: PlayedGame[] } {
  const hit = games.filter((g) => positionsOf(g).has(epd));
  return { white: record(hit.filter((g) => g.color === 'white')), black: record(hit.filter((g) => g.color === 'black')), all: hit };
}
