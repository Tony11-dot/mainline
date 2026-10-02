import type { EvalLine, ExplorerData } from './api';
import type { Color } from './chess';
import { rankMoves, type MoveSuggestion } from './suggest';

/** Why a candidate is worth a look. Each maps to a short, friendly label in the app. */
export type GuideTag = 'yours' | 'fits' | 'book' | 'engine' | 'gem' | 'club' | 'crowd' | 'surprise' | 'risky';

export interface GuideCandidate extends MoveSuggestion {
  /** Engine line that starts with this move (eval after it, White POV). */
  line?: EvalLine;
  /** Games with this move at the user's rating. */
  games: number;
  tags: GuideTag[];
}

/**
 * Candidate moves for the guided builder: the ranked suggestions (engine, results at your rating, master
 * usage) plus anything already in your repertoires, each tagged with what makes it stand out.
 * `inRep`: moves this repertoire already has here. `fitsRep`: moves leading to a position another of
 * your repertoires (same colour) already covers.
 */
export function guideCandidates(opts: { color: Color; engineLines?: EvalLine[]; lichess?: ExplorerData; masters?: ExplorerData; inRep?: Set<string>; fitsRep?: Set<string>; max?: number }): GuideCandidate[] {
  const { engineLines = [], lichess, inRep = new Set(), fitsRep = new Set(), max = 8 } = opts;
  const ranked = rankMoves({ color: opts.color, engineLines, lichess, masters: opts.masters, minGames: 10 });
  const games = new Map((lichess?.moves ?? []).map((m) => [m.uci, m.total]));
  const lineOf = new Map<string, EvalLine>();
  for (const l of engineLines) if (l.moves[0] && !lineOf.has(l.moves[0])) lineOf.set(l.moves[0], l);

  // A guide shouldn't steer you into a worse position: moves the engine dislikes sink, and once the engine
  // has a few lines, moves it hasn't evaluated at all go below the ones it vouches for.
  const engineBest = Math.max(-1, ...ranked.map((c) => c.engine ?? -1));
  const adjusted = (c: MoveSuggestion) => c.score - (c.engine !== undefined ? 2 * Math.max(0, engineBest - c.engine) : engineLines.length >= 3 ? 0.1 : 0);
  ranked.sort((a, b) => adjusted(b) - adjusted(a));
  const picked = ranked.slice(0, max);
  // Your own moves always show, even when the numbers don't favour them.
  for (const s of ranked.slice(max)) if (inRep.has(s.uci) && picked.length < max + 3) picked.push(s);

  const list: GuideCandidate[] = picked.map((s) => ({ ...s, line: lineOf.get(s.uci), games: games.get(s.uci) ?? 0, tags: [] }));
  const best = Math.max(-1, ...list.map((c) => c.engine ?? -1));
  const argmax = (f: (c: GuideCandidate) => number | undefined) => {
    let out: GuideCandidate | undefined;
    for (const c of list) {
      const v = f(c);
      if (v !== undefined && (out === undefined || v > f(out)!)) out = c;
    }
    return out;
  };
  const book = argmax((c) => (c.masterShare !== undefined && c.masterShare >= 0.05 ? c.masterShare : undefined));
  const crowd = argmax((c) => (c.games >= 50 ? c.games : undefined));
  const club = argmax((c) => (c.games >= 50 && (c.practical ?? 0) >= 0.5 ? c.practical : undefined));
  // One gem at most: the soundest move masters rarely play.
  const gem = argmax((c) => (c !== book && c.engine !== undefined && best - c.engine <= 0.03 && (c.masterShare ?? 0) < 0.08 && (c.practical ?? 0.5) >= 0.5 && c.engine < best - 0.005 ? c.engine : undefined));

  for (const c of list) {
    const t = c.tags;
    if (inRep.has(c.uci)) t.push('yours');
    else if (fitsRep.has(c.uci)) t.push('fits');
    if (c === book) t.push('book');
    if (c.engine !== undefined && best >= 0 && c.engine >= best - 0.005) t.push('engine');
    else if (c === gem) t.push('gem');
    if (c === club && c !== book) t.push('club');
    else if (c === crowd && c !== book) t.push('crowd');
    if ((c.masterShare ?? 0) < 0.03 && (c.practical ?? 0) >= 0.55 && c.games >= 30 && !t.includes('gem')) t.push('surprise');
    if (c.engine !== undefined && best - c.engine > 0.07) t.push('risky');
  }
  return list;
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
