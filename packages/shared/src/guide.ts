import type { EvalData, EvalLine, ExplorerData } from './api';
import type { Color } from './chess';
import type { MyMoveStats } from './games';
import { rankMoves, type MoveSuggestion } from './suggest';

/** Why a candidate is worth a look. Each maps to a short, friendly label in the app. */
export type GuideTag = 'yours' | 'fits' | 'proven' | 'trouble' | 'book' | 'engine' | 'gem' | 'club' | 'crowd' | 'surprise' | 'dubious';

export interface GuideCandidate extends MoveSuggestion {
  /** Engine line that starts with this move (eval after it, White POV). */
  line?: EvalLine;
  /** Games with this move at the user's rating. */
  games: number;
  /** How you did after this move in your own games from this position. */
  mine?: MyMoveStats;
  tags: GuideTag[];
}

/** Engine-based tags wait for at least this search depth, so they don't flicker while the engine warms up. */
export const GUIDE_MIN_DEPTH = 16;
/** Club numbers need this many games before a tag claims anything about them. */
export const GUIDE_MIN_GAMES = 100;
/** Expected-score margins (0..1, from the engine's winning-chance curve; 0.01 ≈ 0.1 pawn near equality). */
const ENGINE_TIE = 0.01;
const GEM_MARGIN = 0.03;
const SOUND_MARGIN = 0.05;
const DUBIOUS_MARGIN = 0.08;
/** Your own games: enough of them, and a clear enough score, before a tag says a move works (or doesn't) for you. */
export const MINE_PROVEN = { games: 5, score: 0.6 };
export const MINE_TROUBLE = { games: 3, score: 0.4 };

/** One-sided 95% lower bound on a score from `n` games: a club tag shouldn't rest on a lucky streak. */
export function scoreLowerBound(p: number, n: number): number {
  return n > 0 ? p - 1.645 * Math.sqrt((p * (1 - p)) / n) : 0;
}

/**
 * Candidate moves for the guided builder: the ranked suggestions (engine, results at your rating, master
 * usage) plus anything already in your repertoires, each tagged with what makes it stand out.
 * `inRep`: moves this repertoire already has here. `fitsRep`: moves leading to a position another of
 * your repertoires (same colour) already covers. `engineDepth`: the shallowest search behind `engineLines`;
 * engine-based tags are held back until it reaches GUIDE_MIN_DEPTH. `mine`: what was played here in your own
 * games and how you scored after each move; moves from at least two of your games always show.
 */
export function guideCandidates(opts: { color: Color; engineLines?: EvalLine[]; engineDepth?: number; lichess?: ExplorerData; masters?: ExplorerData; inRep?: Set<string>; fitsRep?: Set<string>; mine?: Map<string, MyMoveStats>; max?: number }): GuideCandidate[] {
  const { engineLines = [], engineDepth = 0, lichess, masters, inRep = new Set(), fitsRep = new Set(), mine = new Map(), max = 8 } = opts;
  const ranked = rankMoves({ color: opts.color, engineLines, lichess, masters, minGames: 10 });
  const seen = new Set(ranked.map((r) => r.uci));
  // A move you keep meeting (or playing) belongs on the list even when the databases barely know it.
  for (const [uci, s] of mine) if (s.games >= 2 && !seen.has(uci)) ranked.push({ uci, practicalGames: 0, score: 0 });
  const kept = (uci: string) => inRep.has(uci) || (mine.get(uci)?.games ?? 0) >= 2;
  const games = new Map((lichess?.moves ?? []).map((m) => [m.uci, m.total]));
  const lineOf = new Map<string, EvalLine>();
  for (const l of engineLines) if (l.moves[0] && !lineOf.has(l.moves[0])) lineOf.set(l.moves[0], l);

  // A guide shouldn't steer you into a worse position: moves the engine dislikes sink, and once the engine
  // has a few lines, moves it hasn't evaluated at all go below the ones it vouches for.
  const engineBest = Math.max(-1, ...ranked.map((c) => c.engine ?? -1));
  const adjusted = (c: MoveSuggestion) => c.score - (c.engine !== undefined ? 2 * Math.max(0, engineBest - c.engine) : engineLines.length >= 3 ? 0.1 : 0);
  ranked.sort((a, b) => adjusted(b) - adjusted(a));
  // With a deep search in hand, a move the engine never looked at and few people play is a stab in the
  // dark: leave it out rather than show it without an eval.
  const deep = engineDepth >= GUIDE_MIN_DEPTH && engineLines.length > 0;
  const shown = deep ? ranked.filter((s) => s.engine !== undefined || s.practicalGames >= GUIDE_MIN_GAMES || (s.masterShare ?? 0) >= 0.05 || kept(s.uci)) : ranked;
  const picked = shown.slice(0, max);
  // Your own moves (saved, or from your games) always show, even when the numbers don't favour them.
  for (const s of shown.slice(max)) if (kept(s.uci) && picked.length < max + 3) picked.push(s);

  const list: GuideCandidate[] = picked.map((s) => ({ ...s, line: lineOf.get(s.uci), games: games.get(s.uci) ?? 0, mine: mine.get(s.uci), tags: [] }));
  // Every tag below is a claim about the data, so each one needs enough of it: a deep enough search,
  // enough master games for "rare" or "most played" to mean something, enough club games to beat luck.
  const sure = engineDepth >= GUIDE_MIN_DEPTH && list.some((c) => c.engine !== undefined);
  const best = Math.max(-1, ...list.map((c) => c.engine ?? -1));
  const drop = (c: GuideCandidate) => (c.engine === undefined ? undefined : best - c.engine);
  const sound = (c: GuideCandidate) => sure && drop(c) !== undefined && drop(c)! <= SOUND_MARGIN;
  const mastersTotal = masters?.total ?? 0;
  const clubLb = (c: GuideCandidate) => (c.practical !== undefined && c.games >= GUIDE_MIN_GAMES ? scoreLowerBound(c.practical, c.games) : undefined);
  const argmax = (f: (c: GuideCandidate) => number | undefined) => {
    let out: GuideCandidate | undefined;
    for (const c of list) {
      const v = f(c);
      if (v !== undefined && (out === undefined || v > f(out)!)) out = c;
    }
    return out;
  };
  const book = argmax((c) => (mastersTotal >= 50 && c.masterShare !== undefined && c.masterShare >= 0.05 ? c.masterShare : undefined));
  const crowd = argmax((c) => (c.games >= GUIDE_MIN_GAMES ? c.games : undefined));
  const club = argmax((c) => (sound(c) && (clubLb(c) ?? 0) >= 0.5 ? clubLb(c) : undefined));
  // One gem at most: the soundest move masters rarely play (with enough master games for "rarely" to hold).
  const gem = argmax((c) => {
    const d = drop(c);
    if (!sure || c === book || d === undefined || d <= ENGINE_TIE || d > GEM_MARGIN || mastersTotal < 100 || (c.masterShare ?? 0) >= 0.08) return undefined;
    if (c.games >= GUIDE_MIN_GAMES && (c.practical ?? 0) < 0.5) return undefined;
    return c.engine;
  });

  for (const c of list) {
    const t = c.tags;
    const d = drop(c);
    if (inRep.has(c.uci)) t.push('yours');
    else if (fitsRep.has(c.uci)) t.push('fits');
    const m = c.mine;
    if (m && m.games >= MINE_TROUBLE.games && m.score <= MINE_TROUBLE.score) t.push('trouble');
    else if (m && m.games >= MINE_PROVEN.games && m.score >= MINE_PROVEN.score) t.push('proven');
    // A warning outranks the compliments: it's the tag you most need to see.
    if (sure && d !== undefined && d > DUBIOUS_MARGIN) t.push('dubious');
    if (c === book) t.push('book');
    if (sure && d !== undefined && d <= ENGINE_TIE) t.push('engine');
    else if (c === gem) t.push('gem');
    if (c === club && c !== book) t.push('club');
    else if (c === crowd && c !== book) t.push('crowd');
    const lb = clubLb(c);
    if (c !== gem && c !== club && sound(c) && mastersTotal >= 100 && (c.masterShare ?? 0) < 0.03 && lb !== undefined && lb >= 0.52) t.push('surprise');
  }
  return list;
}

/** Everything the guide needs for one position, as the server bundles it. */
export interface GuideBundle {
  epd: string;
  lichess?: ExplorerData;
  masters?: ExplorerData;
  /** Multi-line eval of the position itself (null: nobody has analysed it yet). */
  eval?: EvalData | null;
  /** Eval of the position after each candidate the parent eval doesn't cover (null: not analysed). */
  children?: Record<string, EvalData | null>;
}

/** The moves worth evaluating here: the most played at club level and among masters. */
export function guideMoves(lichess?: ExplorerData, masters?: ExplorerData, max = 10): string[] {
  const out: string[] = [];
  const add = (d?: ExplorerData, n = max) => {
    for (const m of [...(d?.moves ?? [])].sort((a, b) => b.total - a.total).slice(0, n)) if (m.total > 0 && !out.includes(m.uci)) out.push(m.uci);
  };
  add(lichess, Math.ceil(max * 0.7));
  add(masters, max);
  add(lichess, max);
  return out.slice(0, max);
}

export interface GuideEngine {
  lines: EvalLine[];
  /** Shallowest search behind the lines (0 when there are none). */
  depth: number;
}

/**
 * One line per candidate from the bundle: the parent's own multi-line eval where it covers a move (one
 * search, directly comparable), else the eval of the position after the move with the move prefixed.
 */
export function bundleEngine(bundle: GuideBundle | undefined): GuideEngine {
  const lines: EvalLine[] = [];
  const depths: number[] = [];
  const seen = new Set<string>();
  if (bundle?.eval?.lines.length) {
    for (const l of bundle.eval.lines) if (l.moves[0] && !seen.has(l.moves[0])) {
      seen.add(l.moves[0]);
      lines.push(l);
    }
    depths.push(bundle.eval.depth);
  }
  for (const [uci, ev] of Object.entries(bundle?.children ?? {})) {
    const l = ev?.lines[0];
    if (!l || seen.has(uci)) continue;
    seen.add(uci);
    lines.push({ ...l, moves: [uci, ...l.moves] });
    depths.push(ev!.depth);
  }
  return { lines, depth: lines.length ? Math.min(...depths) : 0 };
}

/** Adds lines from `extra` (e.g. a local search) for moves `base` doesn't cover; depth is the shallowest used. */
export function mergeEngine(base: GuideEngine, extra: GuideEngine): GuideEngine {
  const have = new Set(base.lines.map((l) => l.moves[0]));
  const add = extra.lines.filter((l) => l.moves[0] && !have.has(l.moves[0]));
  if (!add.length) return base;
  return { lines: [...base.lines, ...add], depth: base.lines.length ? Math.min(base.depth, extra.depth) : extra.depth };
}

/**
 * The opponent's reply the guide plays for them: what players at your level answer most often,
 * else what masters play, else the engine's choice. undefined = no idea (out of book, no engine).
 */
export function guideReply(opts: { lichess?: ExplorerData; masters?: ExplorerData; engineLines?: EvalLine[] }): string | undefined {
  const top = (d?: ExplorerData) => [...(d?.moves ?? [])].sort((a, b) => b.total - a.total)[0];
  const l = top(opts.lichess);
  if (l && l.total >= 5) return l.uci;
  const m = top(opts.masters);
  if (m && m.total >= 1) return m.uci;
  return opts.engineLines?.[0]?.moves[0];
}
