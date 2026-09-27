import { describe, expect, it } from 'vitest';
import { INITIAL_FEN, newCardState, playLine, toEpd, type PlayedGame, type Repertoire, type RepMove, type ReviewEntry, type TrainCard } from '@mainline/shared';
import { gameStats, maturity, openingOfGame, openingStats, record, repertoireShape, trainingStats } from './stats';
import type { OpeningInfo } from './openings';

const NOW = new Date(2026, 8, 27, 12).getTime();
const DAY = 86_400_000;

const review = (over: Partial<ReviewEntry>): ReviewEntry => ({
  id: Math.random().toString(36),
  cardEpd: 'x',
  color: 'white',
  rating: 3,
  playedUci: null,
  expectedUci: [],
  mode: 'review',
  msTaken: 2000,
  reviewedAt: NOW,
  updatedAt: NOW,
  ...over,
});

const game = (over: Partial<PlayedGame>): PlayedGame => ({
  id: Math.random().toString(36),
  site: 'lichess',
  url: '',
  color: 'white',
  opponent: 'x',
  result: 'win',
  speed: 'blitz',
  playedAt: NOW,
  ucis: [],
  ...over,
});

describe('record', () => {
  it('scores draws as half', () => {
    expect(record([{ result: 'win' }, { result: 'draw' }, { result: 'loss' }, { result: 'win' }])).toEqual({ games: 4, win: 2, draw: 1, loss: 1, score: 0.625 });
    expect(record([]).score).toBe(0);
  });
});

describe('trainingStats', () => {
  it('computes accuracy windows, daily buckets and the hardest positions', () => {
    const reviews = [
      review({ cardEpd: 'a', rating: 1, reviewedAt: NOW }),
      review({ cardEpd: 'a', rating: 3, reviewedAt: NOW - DAY }),
      review({ cardEpd: 'b', rating: 4, reviewedAt: NOW - 10 * DAY }),
      review({ cardEpd: 'b', rating: 1, reviewedAt: NOW - 40 * DAY }),
    ];
    const s = trainingStats(reviews, [], { now: NOW });
    expect(s.reviews).toBe(4);
    expect(s.accuracy).toBe(0.5);
    expect(s.accuracy7).toBe(0.5);
    expect(s.accuracy30).toBeCloseTo(2 / 3);
    expect(s.daily).toHaveLength(30);
    expect(s.daily.at(-1)).toMatchObject({ reviews: 1, correct: 0 });
    expect(s.daily.at(-2)).toMatchObject({ reviews: 1, correct: 1 });
    expect(s.activeDays30).toBe(3);
    expect(s.hardest[0]).toMatchObject({ epd: 'a', wrong: 1, total: 2 });
  });

  it('scopes to a repertoire and counts untrained positions as new', () => {
    const card: TrainCard = { color: 'white', epd: 'a', kind: 'repertoire', fsrs: { ...newCardState(NOW), reps: 3, state: 2, stability: 30 }, due: NOW + DAY, lastReview: NOW, updatedAt: NOW };
    const other: TrainCard = { ...card, epd: 'z' };
    const s = trainingStats([review({ cardEpd: 'z' })], [card, other], { positions: new Set(['white|a', 'white|b']), now: NOW });
    expect(s.reviews).toBe(0);
    expect(s.maturity).toEqual({ new: 1, learning: 0, young: 0, mature: 1 });
    expect(maturity(undefined)).toBe('new');
  });
});

describe('repertoireShape', () => {
  it('counts positions, replies, lines and depth', () => {
    const root = toEpd(INITIAL_FEN);
    const rep: Repertoire = { id: 'r', folderId: null, name: 'e4', color: 'white', rootEpd: root, rootMovesUci: [], sortIndex: 0, createdAt: 0, updatedAt: 0 };
    const mv = (line: string[]): RepMove[] => {
      const steps = playLine(INITIAL_FEN, line).moves;
      return steps.map((st, i) => ({ repertoireId: 'r', fromEpd: toEpd(i ? steps[i - 1]!.fen : INITIAL_FEN), uci: st.uci, san: st.san, toEpd: toEpd(st.fen), isMainline: true, addedAt: 0, updatedAt: 0 }));
    };
    const moves = [...mv(['e2e4', 'e7e5', 'g1f3']), ...mv(['e2e4', 'c7c5', 'g1f3'])];
    const uniq = [...new Map(moves.map((m) => [`${m.fromEpd}|${m.uci}`, m])).values()];
    const s = repertoireShape(rep, uniq);
    expect(s.moves).toBe(5);
    expect(s.ownPositions).toBe(3); // start, after 1…e5, after 1…c5
    expect(s.replies).toBe(2);
    expect(s.lines).toBe(2);
    expect(s.depth).toBe(3);
  });
});

describe('games and openings', () => {
  it('splits by colour and speed and estimates performance', () => {
    const gs = [game({ result: 'win', opponentRating: 1500 }), game({ color: 'black', result: 'loss', opponentRating: 1700, speed: 'rapid' }), game({ result: 'draw', opponentRating: 1600 })];
    const s = gameStats(gs);
    expect(s.all.games).toBe(3);
    expect(s.white).toMatchObject({ games: 2, win: 1, draw: 1 });
    expect(s.bySpeed[0]).toMatchObject({ speed: 'blitz' });
    expect(s.avgOpponent).toBe(1600);
    expect(s.performance).toBe(1600);
    expect(s.form).toHaveLength(3);
  });

  it('names the deepest opening reached and groups by family', () => {
    const after = (line: string[]) => toEpd(playLine(INITIAL_FEN, line).moves.at(-1)!.fen);
    const byEpd = new Map<string, OpeningInfo>([
      [after(['e2e4', 'c7c5']), { eco: 'B20', name: 'Sicilian Defense', uci: '', epd: '' }],
      [after(['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6']), { eco: 'B90', name: 'Sicilian Defense: Najdorf Variation', uci: '', epd: '' }],
    ]);
    const najdorf = game({ ucis: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'c1e3'] });
    const alapin = game({ ucis: ['e2e4', 'c7c5', 'c2c3'], result: 'loss' });
    expect(openingOfGame(najdorf, byEpd)?.eco).toBe('B90');
    expect(openingStats([najdorf, alapin], byEpd).map((o) => o.opening.name)).toEqual(expect.arrayContaining(['Sicilian Defense', 'Sicilian Defense: Najdorf Variation']));
    const fam = openingStats([najdorf, alapin], byEpd, { family: true });
    expect(fam).toHaveLength(1);
    expect(fam[0]!.rec).toMatchObject({ games: 2, win: 1, loss: 1 });
  });
});
