import { createEmptyCard, fsrs, generatorParameters, Rating, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import { buildGraph, isOwnTurn, lines, mainMoveAt, rootFromMoves, type Graph, type RepMove, type Repertoire, type SyncMeta } from './repertoire';
import type { Color } from './chess';
import { epdToFen } from './epd';

export { Rating };

/* ---------------- Cards ---------------- */

/** FSRS state stored as JSON (dates as ms) so it round-trips through IndexedDB and Postgres. */
export interface CardState {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: number;
}

export interface TrainCard extends SyncMeta {
  color: Color;
  epd: string;
  kind: 'repertoire' | 'radar';
  fsrs: CardState;
  due: number;
  lastReview: number | null;
}

export type TrainMode = 'learn' | 'review' | 'drill' | 'quiz';

export interface ReviewEntry extends SyncMeta {
  id: string;
  cardEpd: string;
  color: Color;
  rating: 1 | 2 | 3 | 4;
  playedUci: string | null;
  expectedUci: string[];
  mode: TrainMode;
  msTaken: number;
  reviewedAt: number;
}

export const cardKey = (c: Pick<TrainCard, 'color' | 'epd' | 'kind'>) => `${c.color}|${c.epd}|${c.kind}`;

const scheduler = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9, maximum_interval: 365 }));

const toState = (c: FsrsCard): CardState => ({
  due: c.due.getTime(),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state,
  last_review: c.last_review?.getTime(),
});

const fromState = (s: CardState): FsrsCard => ({
  ...s,
  due: new Date(s.due),
  last_review: s.last_review ? new Date(s.last_review) : undefined,
});

export function newCardState(now: number): CardState {
  return toState(createEmptyCard(new Date(now)));
}

/** Schedules the next review. */
export function scheduleCard(state: CardState | undefined, rating: 1 | 2 | 3 | 4, now: number): CardState {
  const card = state ? fromState(state) : createEmptyCard(new Date(now));
  return toState(scheduler.next(card, new Date(now), rating as Grade).card);
}

/** Probability the move is still remembered now (0..1). New cards count as 0. */
export function retrievability(state: CardState | undefined, now: number): number {
  if (!state || !state.reps) return 0;
  return scheduler.get_retrievability(fromState(state), new Date(now), false);
}

/**
 * Automatic grading (no self-rating buttons): wrong first try → Again; correct but slow → Hard;
 * correct → Good; instant on a well-known card → Easy.
 */
export function autoGrade(opts: { correct: boolean; msTaken: number; reps: number }): 1 | 2 | 3 | 4 {
  if (!opts.correct) return Rating.Again;
  if (opts.msTaken > 15_000) return Rating.Hard;
  if (opts.msTaken < 2_500 && opts.reps >= 3) return Rating.Easy;
  return Rating.Good;
}

/* ---------------- Positions & expected moves ---------------- */

export interface RepData {
  reps: Repertoire[];
  moves: RepMove[];
}

export function graphsByRep(data: RepData): Map<string, Graph> {
  const by = new Map<string, RepMove[]>();
  for (const m of data.moves) if (!m.deleted) (by.get(m.repertoireId) ?? by.set(m.repertoireId, []).get(m.repertoireId)!).push(m);
  const out = new Map<string, Graph>();
  for (const r of data.reps) if (!r.deleted) out.set(r.id, buildGraph(by.get(r.id) ?? []));
  return out;
}

/** Main moves prescribed at `epd` by any same-colour repertoire (cards are shared per colour + position). */
export function expectedMoves(data: RepData, graphs: Map<string, Graph>, color: Color, epd: string): string[] {
  const out = new Set<string>();
  for (const r of data.reps) {
    if (r.deleted || r.color !== color) continue;
    const m = mainMoveAt(graphs.get(r.id)!, epd);
    if (m && isOwnTurn(color, epd)) out.add(m.uci);
  }
  return [...out];
}

/** Alternates at `epd` (known but not trained) — played alternates get a gentler message. */
export function alternateMoves(data: RepData, graphs: Map<string, Graph>, color: Color, epd: string): string[] {
  const out = new Set<string>();
  for (const r of data.reps) {
    if (r.deleted || r.color !== color) continue;
    for (const m of graphs.get(r.id)?.get(epd) ?? []) if (!m.isMainline) out.add(m.uci);
  }
  return [...out];
}

/* ---------------- Session planning ---------------- */

export type StepKind = 'auto' | 'learn' | 'review' | 'drill';

export interface SessionLine {
  repId: string;
  color: Color;
  rootFen: string;
  ucis: string[];
  /** For each ply: what happens there. Opponent plies are always 'auto'. */
  steps: StepKind[];
  /** Epd before each ply. */
  epds: string[];
}

export interface PlanOpts {
  mode: TrainMode;
  data: RepData;
  cards: TrainCard[];
  now: number;
  newLimit?: number;
  /** Restrict to these repertoires (folder / repertoire drill). */
  repIds?: string[];
  maxLines?: number;
  rng?: () => number;
  /** Opponent reply weights for drill: epd → uci → games. */
  replyWeights?: (epd: string) => Map<string, number> | undefined;
}

const cardIndex = (cards: TrainCard[]) => new Map(cards.filter((c) => !c.deleted && c.kind === 'repertoire').map((c) => [`${c.color}|${c.epd}`, c]));

/**
 * Builds the lines to play for a session. Review/Learn play real lines from each repertoire's root so
 * positions are met in context; own moves that aren't due are auto-played; everything after the last
 * trained position is trimmed.
 */
export function planSession(o: PlanOpts): SessionLine[] {
  const graphs = graphsByRep(o.data);
  const cards = cardIndex(o.cards);
  const reps = o.data.reps.filter((r) => !r.deleted && (!o.repIds || o.repIds.includes(r.id)));
  const rng = o.rng ?? Math.random;
  const newLimit = o.newLimit ?? 10;

  if (o.mode === 'drill') return planDrill(reps, graphs, o, rng);
  if (o.mode === 'quiz') return planQuiz(reps, graphs, cards, o, rng);

  const out: SessionLine[] = [];
  const covered = new Set<string>();
  let newBudget = newLimit;
  for (const rep of reps) {
    const g = graphs.get(rep.id)!;
    const root = safeRoot(rep);
    for (const line of lines(g, rep.rootEpd, { mainlineOnlyFor: rep.color })) {
      const steps: StepKind[] = [];
      const epds: string[] = [];
      let lastUseful = -1;
      line.moves.forEach((m, i) => {
        epds.push(m.fromEpd);
        if (!isOwnTurn(rep.color, m.fromEpd)) return steps.push('auto');
        const key = `${rep.color}|${m.fromEpd}`;
        const card = cards.get(key);
        if (covered.has(key)) return steps.push('auto');
        if (o.mode === 'review' && card && card.due <= o.now) {
          covered.add(key);
          lastUseful = i;
          return steps.push('review');
        }
        if (o.mode === 'learn' && !card && newBudget > 0) {
          covered.add(key);
          newBudget--;
          lastUseful = i;
          return steps.push('learn');
        }
        steps.push('auto');
      });
      if (lastUseful < 0) continue;
      out.push({ repId: rep.id, color: rep.color, rootFen: root, ucis: line.moves.slice(0, lastUseful + 1).map((m) => m.uci), steps: steps.slice(0, lastUseful + 1), epds: epds.slice(0, lastUseful + 1) });
      if (o.maxLines && out.length >= o.maxLines) return out;
    }
  }
  return out;
}

function safeRoot(rep: Repertoire): string {
  try {
    const r = rootFromMoves(rep.rootMovesUci);
    if (r.epd === rep.rootEpd) return r.fen;
  } catch {
    /* fall through */
  }
  return epdToFen(rep.rootEpd);
}

/** Drill: random walks from each repertoire root; opponent replies weighted by real-game frequency. */
function planDrill(reps: Repertoire[], graphs: Map<string, Graph>, o: PlanOpts, rng: () => number): SessionLine[] {
  const out: SessionLine[] = [];
  const count = o.maxLines ?? 5;
  const pool = reps.filter((r) => (graphs.get(r.id)?.get(r.rootEpd) ?? []).length);
  if (!pool.length) return out;
  for (let n = 0; n < count; n++) {
    const rep = pool[Math.floor(rng() * pool.length)]!;
    const g = graphs.get(rep.id)!;
    const line: SessionLine = { repId: rep.id, color: rep.color, rootFen: safeRoot(rep), ucis: [], steps: [], epds: [] };
    let epd = rep.rootEpd;
    const seen = new Set<string>();
    while (!seen.has(epd)) {
      seen.add(epd);
      const moves = g.get(epd) ?? [];
      if (!moves.length) break;
      let pick: RepMove;
      if (isOwnTurn(rep.color, epd)) {
        pick = mainMoveAt(g, epd)!;
        line.steps.push('drill');
      } else {
        const w = o.replyWeights?.(epd);
        const weights = moves.map((m) => Math.max(1, w?.get(m.uci) ?? 1));
        let t = rng() * weights.reduce((a, b) => a + b, 0);
        pick = moves[moves.length - 1]!;
        for (let i = 0; i < moves.length; i++) {
          t -= weights[i]!;
          if (t <= 0) {
            pick = moves[i]!;
            break;
          }
        }
        line.steps.push('auto');
      }
      line.ucis.push(pick.uci);
      line.epds.push(epd);
      epd = pick.toEpd;
    }
    // Lines must end on the user's move.
    while (line.steps.length && line.steps.at(-1) !== 'drill') {
      line.steps.pop();
      line.ucis.pop();
      line.epds.pop();
    }
    if (line.steps.length) out.push(line);
  }
  return out;
}

/** Quiz: single positions (no lead-in), due first then weakest. */
function planQuiz(reps: Repertoire[], graphs: Map<string, Graph>, cards: Map<string, TrainCard>, o: PlanOpts, rng: () => number): SessionLine[] {
  const positions: { rep: Repertoire; epd: string; score: number }[] = [];
  const seen = new Set<string>();
  for (const rep of reps) {
    const g = graphs.get(rep.id)!;
    for (const [epd, list] of g) {
      const key = `${rep.color}|${epd}`;
      if (seen.has(key) || !isOwnTurn(rep.color, epd) || !list.some((m) => m.isMainline)) continue;
      const card = cards.get(key);
      if (!card) continue;
      seen.add(key);
      const r = retrievability(card.fsrs, o.now);
      positions.push({ rep, epd, score: (card.due <= o.now ? 0 : 1) + r + rng() * 0.15 });
    }
  }
  positions.sort((a, b) => a.score - b.score);
  return positions.slice(0, o.maxLines ?? 15).map(({ rep, epd }) => ({
    repId: rep.id,
    color: rep.color,
    rootFen: epdToFen(epd),
    ucis: [mainMoveAt(graphs.get(rep.id)!, epd)!.uci],
    steps: ['review'],
    epds: [epd],
  }));
}

/* ---------------- Dashboard numbers ---------------- */

export function trainingSummary(data: RepData, cards: TrainCard[], now: number, newLimit: number, learnedToday: number) {
  const graphs = graphsByRep(data);
  const idx = cardIndex(cards);
  const positions = new Set<string>();
  for (const r of data.reps) {
    if (r.deleted) continue;
    const g = graphs.get(r.id)!;
    for (const [epd, list] of g) if (isOwnTurn(r.color, epd) && list.some((m) => m.isMainline)) positions.add(`${r.color}|${epd}`);
  }
  let due = 0;
  let unseen = 0;
  let retention = 0;
  let learned = 0;
  for (const key of positions) {
    const c = idx.get(key);
    if (!c) {
      unseen++;
      continue;
    }
    learned++;
    retention += retrievability(c.fsrs, now);
    if (c.due <= now) due++;
  }
  const newToday = Math.max(0, Math.min(unseen, newLimit - learnedToday));
  return {
    positions: positions.size,
    learned,
    unseen,
    due,
    newToday,
    retention: learned ? retention / learned : 0,
    /** ~8 s per review, ~20 s per new move (includes the lead-in moves). */
    minutes: Math.max(1, Math.round((due * 8 + newToday * 20) / 60)),
  };
}

/** Consecutive days (ending today or yesterday) with at least one review. */
export function streakDays(reviewTimes: number[], now: number, tzOffsetMin = 0): number {
  const day = (t: number) => Math.floor((t - tzOffsetMin * 60_000) / 86_400_000);
  const days = new Set(reviewTimes.map(day));
  let d = day(now);
  if (!days.has(d)) d--;
  let n = 0;
  while (days.has(d)) {
    n++;
    d--;
  }
  return n;
}
