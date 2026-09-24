import { describe, expect, it } from 'vitest';
import { INITIAL_EPD, INITIAL_FEN } from './epd';
import { playLine } from './chess';
import { importPgn, type Repertoire } from './repertoire';
import { autoGrade, cardKey, expectedMoves, graphsByRep, newCardState, planSession, retrievability, scheduleCard, streakDays, trainingSummary, type TrainCard } from './training';

const rep = (id: string, color: 'white' | 'black'): Repertoire => ({ id, folderId: null, name: id, color, rootEpd: INITIAL_EPD, rootMovesUci: [], sortIndex: 0, createdAt: 0, updatedAt: 0 });
const white = rep('w', 'white');
const moves = importPgn('1. e4 e5 (1... c5 2. Nf3 d6 3. d4) 2. Nf3 Nc6 3. Bb5 *', white).moves;
const data = { reps: [white], moves };
const now = Date.UTC(2026, 8, 24, 12);

const card = (epd: string, due: number, reps = 1): TrainCard => ({ color: 'white', epd, kind: 'repertoire', fsrs: { ...newCardState(now), reps }, due, lastReview: now - 86_400_000, updatedAt: now });

describe('FSRS wrapper', () => {
  it('schedules further out after Good than Again', () => {
    const good = scheduleCard(undefined, 3, now);
    const again = scheduleCard(undefined, 1, now);
    expect(good.due).toBeGreaterThan(again.due);
    const second = scheduleCard(good, 3, good.due);
    expect(second.due - good.due).toBeGreaterThan(86_400_000);
    expect(retrievability(second, second.due)).toBeGreaterThan(0.5);
  });
  it('auto grades', () => {
    expect(autoGrade({ correct: false, msTaken: 1000, reps: 5 })).toBe(1);
    expect(autoGrade({ correct: true, msTaken: 20_000, reps: 5 })).toBe(2);
    expect(autoGrade({ correct: true, msTaken: 5000, reps: 5 })).toBe(3);
    expect(autoGrade({ correct: true, msTaken: 1000, reps: 5 })).toBe(4);
  });
});

describe('planSession', () => {
  it('learn: new own positions in context, limited', () => {
    const plan = planSession({ mode: 'learn', data, cards: [], now, newLimit: 3 });
    const learnSteps = plan.flatMap((l) => l.steps).filter((s) => s === 'learn');
    expect(learnSteps).toHaveLength(3);
    // first line starts from the root and ends on a learn step
    expect(plan[0]!.steps[0]).toBe('learn');
    for (const l of plan) expect(l.steps.at(-1)).toBe('learn');
  });

  it('review: only due positions are graded; others auto-played', () => {
    const graphs = graphsByRep(data);
    const afterE5 = playLine(INITIAL_FEN, ['e2e4', 'e7e5']).moves[1]!.epd;
    const cards = [card(INITIAL_EPD, now + 86_400_000 * 5), card(afterE5, now - 1000)];
    const plan = planSession({ mode: 'review', data, cards, now });
    expect(plan).toHaveLength(1);
    expect(plan[0]!.steps).toEqual(['auto', 'auto', 'review']);
    expect(expectedMoves(data, graphs, 'white', afterE5)).toEqual(['g1f3']);
  });

  it('drill ends on the user move and uses reply weights', () => {
    const plan = planSession({
      mode: 'drill',
      data,
      cards: [],
      now,
      maxLines: 20,
      rng: () => 0.01,
      replyWeights: () => new Map([['c7c5', 1000]]),
    });
    expect(plan.length).toBeGreaterThan(0);
    for (const l of plan) expect(l.steps.at(-1)).toBe('drill');
    expect(plan[0]!.ucis[1]).toBe('c7c5');
  });

  it('quiz picks carded positions, due first', () => {
    const afterE5 = playLine(INITIAL_FEN, ['e2e4', 'e7e5']).moves[1]!.epd;
    const plan = planSession({ mode: 'quiz', data, cards: [card(INITIAL_EPD, now + 1e9), card(afterE5, now - 1)], now, rng: () => 0 });
    expect(plan[0]!.epds[0]).toBe(afterE5);
    expect(plan[0]!.ucis).toEqual(['g1f3']);
  });
});

describe('summary & streak', () => {
  it('counts due, new and minutes', () => {
    const s = trainingSummary(data, [card(INITIAL_EPD, now - 1)], now, 10, 0);
    expect(s.positions).toBe(5);
    expect(s.due).toBe(1);
    expect(s.newToday).toBe(4);
    expect(cardKey({ color: 'white', epd: 'x', kind: 'repertoire' })).toBe('white|x|repertoire');
  });
  it('streak', () => {
    const d = 86_400_000;
    expect(streakDays([now, now - d, now - 2 * d, now - 4 * d], now)).toBe(3);
    expect(streakDays([now - d], now)).toBe(1);
    expect(streakDays([now - 3 * d], now)).toBe(0);
  });
});
