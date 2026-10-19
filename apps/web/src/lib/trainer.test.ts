import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { INITIAL_FEN, playLine, toEpd, type RepData, type RepMove, type SessionLine } from '@mainline/shared';
import { createTrainer } from './trainer';
import { useTraining } from './training';
import { usePrefs } from './prefs';

// White's line from 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5: 4.O-O Nf6 5.d3 (5.c3 kept as an alternate).
const ROOT_FEN = playLine(INITIAL_FEN, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5']).moves.at(-1)!.fen;
const after = (ucis: string[]) => toEpd(playLine(ROOT_FEN, ucis).pos);

const move = (from: string[], uci: string, isMainline = true): RepMove => {
  const played = playLine(ROOT_FEN, [...from, uci]).moves.at(-1)!;
  return { repertoireId: 'rep', fromEpd: after(from), uci: played.uci, san: played.san, toEpd: played.epd, isMainline, addedAt: 0, updatedAt: 0 };
};
const data: RepData = {
  reps: [{ id: 'rep', folderId: null, name: 'Italian', color: 'white', rootEpd: after([]), rootMovesUci: [], sortIndex: 0, createdAt: 0, updatedAt: 0 }],
  moves: [move([], 'e1g1'), move(['e1g1'], 'g8f6'), move(['e1g1', 'g8f6'], 'd2d3'), move(['e1g1', 'g8f6'], 'c2c3', false)],
};
const line: SessionLine = {
  repId: 'rep',
  color: 'white',
  rootFen: ROOT_FEN,
  ucis: ['e1g1', 'g8f6', 'd2d3'],
  steps: ['review', 'auto', 'review'],
  epds: [after([]), after(['e1g1']), after(['e1g1', 'g8f6'])],
};

let record: Mock<ReturnType<typeof useTraining.getState>['record']>;
beforeEach(() => {
  vi.useFakeTimers();
  usePrefs.setState({ sound: false, haptics: false });
  record = vi.fn(async () => undefined);
  useTraining.setState({ cards: [], record });
});
afterEach(() => vi.useRealTimers());

function trainer(mode: 'review' | 'learn' = 'review', l = line) {
  const store = createTrainer(mode, [l], data);
  store.getState().start();
  return store;
}

describe('trainer', () => {
  it('accepts castling dropped on the rook, grades it once and plays the reply', () => {
    const s = trainer();
    expect(s.getState()).toMatchObject({ phase: 'await', expected: ['e1g1'] });
    s.getState().userMove('e1h1');
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0]![0]).toMatchObject({ epd: after([]), played: 'e1g1', mode: 'review' });
    expect(record.mock.calls[0]![0].rating).toBeGreaterThan(1);
    vi.runOnlyPendingTimers(); // -> the reply
    vi.runOnlyPendingTimers(); // -> Nf6 is played
    expect(s.getState()).toMatchObject({ phase: 'await', ply: 2, expected: ['d2d3'], lastMove: 'g8f6' });
  });

  it('grades a wrong move once, says when it was the alternate, and doesn’t grade the retry', () => {
    const s = trainer();
    s.getState().userMove('e1g1');
    vi.runAllTimers();
    s.getState().userMove('c2c3');
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[1]![0]).toMatchObject({ rating: 1, played: 'c2c3', expected: ['d2d3'] });
    expect(s.getState()).toMatchObject({ phase: 'wrong', failedHere: true, message: 'That’s your alternate — the main move is shown' });
    expect(s.getState().mistakes).toEqual([expect.objectContaining({ played: 'c2c3', expected: ['d2d3'], repId: 'rep' })]);
    vi.advanceTimersByTime(500);
    expect(s.getState().hint).toBe('d2d3');
    s.getState().userMove('d2d3');
    expect(record).toHaveBeenCalledTimes(2);
    vi.runAllTimers();
    expect(s.getState().phase).toBe('done');
    expect(s.getState().stats).toMatchObject({ graded: 2, correct: 1 });
  });

  it('puts the piece back for illegal moves and moves out of turn, without grading', () => {
    const s = trainer();
    const key = s.getState().syncKey;
    s.getState().userMove('e1e1');
    s.getState().userMove('e4e6');
    expect(s.getState()).toMatchObject({ phase: 'await', ply: 0, syncKey: key + 2 });
    s.getState().userMove('e1g1');
    // The reply is on its way: nothing is the player's to move.
    s.getState().userMove('d2d3');
    expect(record).toHaveBeenCalledTimes(1);
    expect(s.getState().phase).toBe('auto');
  });

  it('shows new moves in learn mode and records them as learned, not graded', () => {
    const s = trainer('learn', { ...line, steps: ['learn', 'auto', 'learn'] });
    expect(s.getState()).toMatchObject({ phase: 'learn', hint: 'e1g1' });
    s.getState().userMove('e1g1');
    expect(record.mock.calls[0]![0]).toMatchObject({ rating: 3, mode: 'learn' });
    expect(s.getState().stats).toMatchObject({ learned: 1, graded: 0 });
  });
});
