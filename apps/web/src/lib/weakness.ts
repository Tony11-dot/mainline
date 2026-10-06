import { INITIAL_FEN, epdToFen, isOwnTurn, playUci, positionFromFen, toEpd, type Color, type Folder, type PlayedGame, type RepMove, type Repertoire, type ReviewEntry, type TrainCard } from '@mainline/shared';
import type { Scope } from './practice';

/**
 * Where you're weakest, from two kinds of evidence:
 *  - training: how often you miss your own move in a position (review, drill and quiz answers, last 90 days);
 *  - games: how you score in imported games that went down that road.
 * Measured for every line, every folder (an opening, a system, a first move) and every move in your
 * repertoire — a move's score covers everything that follows it, so "you're bad after 2.Nf3" shows up even
 * when no single line stands out.
 */

export interface Evidence {
  attempts: number;
  misses: number;
  games: number;
  /** Points scored in those games (win 1, draw ½). */
  points: number;
}

export interface WeakItem {
  kind: 'line' | 'folder' | 'move';
  key: string;
  label: string;
  /** For moves: the moves leading there, e.g. "1.e4 c5 2.Nf3". For lines and folders: where they live. */
  context: string;
  color: Color;
  scope: Scope;
  ev: Evidence;
  /** Positions where you have a move to know, and how many of those are learned. */
  positions: number;
  learned: number;
  /** 1 = typical; 2 = twice as bad as typical. */
  badness: number;
  /** How sure we are (0–1): grows with answers and games. */
  confidence: number;
}

const TRAIN_PRIOR = 0.2; // a typical miss rate
const GAME_PRIOR = 0.5; // an even score
const WINDOW = 90 * 86_400_000;

export function rate(ev: Evidence): { badness: number; confidence: number; missRate: number | null; score: number | null } {
  const missRate = ev.attempts ? ev.misses / ev.attempts : null;
  const score = ev.games ? ev.points / ev.games : null;
  const trainRel = (ev.misses + TRAIN_PRIOR * 5) / (ev.attempts + 5) / TRAIN_PRIOR;
  const gameRel = (ev.games - ev.points + GAME_PRIOR * 5) / (ev.games + 5) / GAME_PRIOR;
  const wT = ev.attempts / (ev.attempts + 10);
  const wG = ev.games / (ev.games + 5);
  const confidence = Math.min(1, wT + wG);
  const badness = wT + wG ? (trainRel * wT + gameRel * wG) / (wT + wG) : 1;
  return { badness, confidence, missRate, score };
}

const add = (a: Evidence, b: Evidence): Evidence => ({ attempts: a.attempts + b.attempts, misses: a.misses + b.misses, games: a.games + b.games, points: a.points + b.points });
const ZERO: Evidence = { attempts: 0, misses: 0, games: 0, points: 0 };

/** Every position a game went through (first 30 plies), cached per game. */
const gameEpdCache = new Map<string, string[]>();
function gameEpds(g: PlayedGame): string[] {
  let out = gameEpdCache.get(g.id);
  if (out) return out;
  out = [toEpd(INITIAL_FEN)];
  let pos = positionFromFen(INITIAL_FEN);
  for (const u of g.ucis.slice(0, 30)) {
    try {
      const p = playUci(pos, u);
      pos = p.pos;
      out.push(p.epd);
    } catch {
      break;
    }
  }
  gameEpdCache.set(g.id, out);
  return out;
}

export interface WeaknessInput {
  folders: Folder[];
  reps: Repertoire[];
  moves: RepMove[];
  cards: TrainCard[];
  reviews: ReviewEntry[];
  games: PlayedGame[];
  now?: number;
}

export interface WeaknessReport {
  lines: WeakItem[];
  folders: WeakItem[];
  moves: WeakItem[];
  byColor: Record<Color, { ev: Evidence; positions: number; learned: number }>;
}

export function analyseWeakness(input: WeaknessInput): WeaknessReport {
  const now = input.now ?? Date.now();
  const reps = input.reps.filter((r) => !r.deleted);
  const folders = input.folders.filter((f) => !f.deleted);
  const live = input.moves.filter((m) => !m.deleted);

  // Training answers per position.
  const train = new Map<string, { attempts: number; misses: number }>();
  for (const r of input.reviews) {
    if (r.mode === 'learn' || now - r.reviewedAt > WINDOW) continue;
    const k = `${r.color}|${r.cardEpd}`;
    const t = train.get(k) ?? { attempts: 0, misses: 0 };
    t.attempts++;
    if (r.rating === 1) t.misses++;
    train.set(k, t);
  }
  const learned = new Set(input.cards.filter((c) => !c.deleted && c.kind === 'repertoire').map((c) => `${c.color}|${c.epd}`));

  // Per repertoire: own positions and every position (incl. the moves leading to its root).
  const byRep = new Map<string, RepMove[]>();
  for (const m of live) (byRep.get(m.repertoireId) ?? byRep.set(m.repertoireId, []).get(m.repertoireId)!).push(m);
  const repInfo = new Map<string, { own: Set<string>; all: Set<string>; rootPly: number }>();
  for (const rep of reps) {
    const own = new Set<string>();
    const all = new Set<string>();
    let pos = positionFromFen(INITIAL_FEN);
    all.add(toEpd(pos));
    for (const u of rep.rootMovesUci) {
      try {
        const p = playUci(pos, u);
        pos = p.pos;
        all.add(p.epd);
      } catch {
        break;
      }
    }
    for (const m of byRep.get(rep.id) ?? []) {
      all.add(m.fromEpd);
      all.add(m.toEpd);
      if (m.isMainline && isOwnTurn(rep.color, m.fromEpd)) own.add(m.fromEpd);
    }
    repInfo.set(rep.id, { own, all, rootPly: rep.rootMovesUci.length });
  }

  // Each game belongs to the line(s) of its colour it followed longest — at least a couple of moves past the root.
  const gamesOfRep = new Map<string, PlayedGame[]>();
  for (const g of input.games) {
    const epds = gameEpds(g);
    let best = -1;
    let owners: string[] = [];
    for (const rep of reps) {
      if (rep.color !== g.color) continue;
      const info = repInfo.get(rep.id)!;
      let depth = -1;
      for (let i = 0; i < epds.length && info.all.has(epds[i]!); i++) depth = i;
      if (depth < info.rootPly + 2) continue;
      if (depth > best) {
        best = depth;
        owners = [rep.id];
      } else if (depth === best) owners.push(rep.id);
    }
    for (const id of owners) (gamesOfRep.get(id) ?? gamesOfRep.set(id, []).get(id)!).push(g);
  }
  const points = (g: PlayedGame) => (g.result === 'win' ? 1 : g.result === 'draw' ? 0.5 : 0);

  const evOf = (color: Color, own: Iterable<string>, games: Iterable<PlayedGame>): Evidence => {
    let ev = ZERO;
    for (const epd of own) {
      const t = train.get(`${color}|${epd}`);
      if (t) ev = add(ev, { attempts: t.attempts, misses: t.misses, games: 0, points: 0 });
    }
    for (const g of games) ev = add(ev, { attempts: 0, misses: 0, games: 1, points: points(g) });
    return ev;
  };
  const learnedIn = (color: Color, own: Set<string>) => [...own].filter((e) => learned.has(`${color}|${e}`)).length;

  const path = (folderId: string | null) => {
    const out: string[] = [];
    let cur = folders.find((f) => f.id === folderId);
    while (cur && cur.parentId !== null) {
      out.unshift(cur.name);
      cur = folders.find((f) => f.id === cur!.parentId);
    }
    return out.join(' › ');
  };
  const item = (kind: WeakItem['kind'], key: string, label: string, context: string, color: Color, scope: Scope, own: Set<string>, ev: Evidence): WeakItem => {
    const r = rate(ev);
    return { kind, key, label, context, color, scope, ev, positions: own.size, learned: learnedIn(color, own), badness: r.badness, confidence: r.confidence };
  };

  const lines = reps.map((rep) => {
    const info = repInfo.get(rep.id)!;
    return item('line', rep.id, rep.name, path(rep.folderId), rep.color, { kind: 'rep', id: rep.id }, info.own, evOf(rep.color, info.own, gamesOfRep.get(rep.id) ?? []));
  });

  const childrenOf = new Map<string | null, Folder[]>();
  for (const f of folders) (childrenOf.get(f.parentId) ?? childrenOf.set(f.parentId, []).get(f.parentId)!).push(f);
  const repsUnder = (id: string): Repertoire[] => {
    const out = reps.filter((r) => r.folderId === id);
    for (const c of childrenOf.get(id) ?? []) out.push(...repsUnder(c.id));
    return out;
  };
  const folderItems = folders
    .filter((f) => f.parentId !== null)
    .map((f) => {
      const inside = repsUnder(f.id);
      const own = new Set<string>();
      const games = new Set<PlayedGame>();
      for (const r of inside) {
        for (const e of repInfo.get(r.id)!.own) own.add(e);
        for (const g of gamesOfRep.get(r.id) ?? []) games.add(g);
      }
      return item('folder', f.id, f.name, path(f.parentId), f.color, { kind: 'folder', id: f.id }, own, evOf(f.color, own, games));
    })
    .filter((x) => x.positions > 0);

  // Moves: one merged tree per colour (every repertoire's moves plus the moves leading to each root).
  const moveItems: WeakItem[] = [];
  const byColor = {} as WeaknessReport['byColor'];
  for (const color of ['white', 'black'] as Color[]) {
    const edges = new Map<string, Map<string, string>>(); // from → uci → to
    const own = new Set<string>();
    const addEdge = (from: string, uci: string, to: string) => (edges.get(from) ?? edges.set(from, new Map()).get(from)!).set(uci, to);
    for (const rep of reps.filter((r) => r.color === color)) {
      let pos = positionFromFen(INITIAL_FEN);
      for (const u of rep.rootMovesUci) {
        try {
          const p = playUci(pos, u);
          addEdge(toEpd(pos), p.uci, p.epd);
          pos = p.pos;
        } catch {
          break;
        }
      }
      for (const m of byRep.get(rep.id) ?? []) {
        if (isOwnTurn(color, m.fromEpd) && !m.isMainline) continue;
        addEdge(m.fromEpd, m.uci, m.toEpd);
      }
      for (const e of repInfo.get(rep.id)!.own) own.add(e);
    }
    const colorGames = input.games.filter((g) => g.color === color);
    const inBook = new Set<PlayedGame>();
    for (const rep of reps) if (rep.color === color) for (const g of gamesOfRep.get(rep.id) ?? []) inBook.add(g);
    byColor[color] = { ev: evOf(color, own, inBook), positions: own.size, learned: learnedIn(color, own) };

    // Walk from the start; each edge's subtree is everything reachable after it.
    const start = toEpd(INITIAL_FEN);
    const seen = new Set<string>([start]);
    const queue: { epd: string; sans: string[]; ply: number }[] = [{ epd: start, sans: [], ply: 0 }];
    const subtreeCache = new Map<string, Set<string>>();
    const subtree = (epd: string): Set<string> => {
      let s = subtreeCache.get(epd);
      if (s) return s;
      s = new Set([epd]);
      const stack = [epd];
      while (stack.length) {
        for (const to of edges.get(stack.pop()!)?.values() ?? []) {
          if (s.has(to)) continue;
          s.add(to);
          stack.push(to);
        }
      }
      subtreeCache.set(epd, s);
      return s;
    };
    while (queue.length) {
      const { epd, sans, ply } = queue.shift()!;
      if (ply >= 16) continue;
      const pos = positionFromFen(epdToFen(epd));
      for (const [uci, to] of edges.get(epd) ?? []) {
        if (seen.has(to)) continue;
        seen.add(to);
        let san = uci;
        try {
          san = playUci(pos, uci).san;
        } catch {
          /* keep uci */
        }
        const moveNo = Math.floor(ply / 2) + 1;
        const label = ply % 2 === 0 ? `${moveNo}.${san}` : `${moveNo}…${san}`;
        const next = [...sans, ply % 2 === 0 ? `${moveNo}.${san}` : san];
        const sub = subtree(to);
        const subOwn = new Set([...sub].filter((e) => own.has(e)));
        if (subOwn.size >= 2 && ply >= 1) {
          const games = colorGames.filter((g) => gameEpds(g).includes(to));
          moveItems.push(item('move', `${color}|${to}`, label, next.join(' '), color, { kind: 'at', color, epd: to }, subOwn, evOf(color, subOwn, games)));
        }
        queue.push({ epd: to, sans: next, ply: ply + 1 });
      }
    }
  }

  return { lines: rank(lines), folders: rank(folderItems), moves: rankMoves(moveItems), byColor };
}

/** Worst first, among those with enough evidence to say. */
function rank(items: WeakItem[]): WeakItem[] {
  return items.filter((x) => x.confidence >= 0.3).sort((a, b) => b.badness * (0.5 + b.confidence) - a.badness * (0.5 + a.confidence));
}

/** Moves nest: keep the most telling one of a chain (a worse descendant beats its ancestor, and vice versa). */
function rankMoves(items: WeakItem[]): WeakItem[] {
  // When the move before is nearly as bad, it's the real culprit (all its answers go wrong): show that instead.
  const byContext = new Map(items.map((m) => [`${m.color}|${m.context}`, m]));
  const lift = (m: WeakItem): WeakItem => {
    const words = m.context.split(' ');
    for (let n = 1; n < words.length; n++) {
      const a = byContext.get(`${m.color}|${words.slice(0, n).join(' ')}`);
      if (a && a.confidence >= 0.3 && a.badness >= 0.85 * m.badness) return a;
    }
    return m;
  };
  const ranked = rank([...new Set(items.map(lift))]);
  const chosen: WeakItem[] = [];
  for (const m of ranked) {
    const related = chosen.some((c) => c.color === m.color && (c.context.startsWith(m.context + ' ') || m.context.startsWith(c.context + ' ')));
    if (!related) chosen.push(m);
  }
  return chosen;
}

/** Items you haven't learned fully yet, biggest gap first. */
export function notLearned(items: WeakItem[]): WeakItem[] {
  return items.filter((x) => x.positions > x.learned).sort((a, b) => b.positions - b.learned - (a.positions - a.learned));
}
