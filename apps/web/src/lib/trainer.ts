import { createStore, type StoreApi } from 'zustand';
import {
  alternateMoves,
  autoGrade,
  expectedMoves,
  graphsByRep,
  playUci,
  positionFromFen,
  type Color,
  type RepData,
  type SessionLine,
  type TrainMode,
} from '@mainline/shared';
import { playSound, soundForMove } from './sound';
import { announce, announceMove, sanToSpeech } from './announce';
import { useTraining } from './training';
import { usePrefs } from './prefs';
import { platform } from '../platform';

export type Phase = 'idle' | 'auto' | 'await' | 'learn' | 'wrong' | 'lineDone' | 'done';

export interface Mistake {
  epd: string;
  fen: string;
  color: Color;
  played: string;
  expected: string[];
  repId: string;
}

export interface TrainerState {
  mode: TrainMode;
  lines: SessionLine[];
  lineIdx: number;
  ply: number;
  fen: string;
  lastMove?: string;
  phase: Phase;
  /** Moves that would be accepted right now. */
  expected: string[];
  /** Arrow to show (learn: the new move; wrong: the correct move). */
  hint?: string;
  syncKey: number;
  feedback?: { kind: 'wrong' | 'right'; key: number };
  message?: string;
  stats: { graded: number; correct: number; learned: number; startedAt: number; endedAt?: number };
  mistakes: Mistake[];
  /** true once the current position was answered wrongly (so the later correct move isn't graded again). */
  failedHere: boolean;
  shownAt: number;
  start: () => void;
  userMove: (uci: string) => void;
  revealMove: () => void;
  skipLine: () => void;
}

const AUTO_DELAY = 420; // lets the previous move's animation + sound land before the reply
const OWN_AUTO_DELAY = 260;

export function createTrainer(mode: TrainMode, lines: SessionLine[], data: RepData): StoreApi<TrainerState> {
  const graphs = graphsByRep(data);
  let timer: ReturnType<typeof setTimeout> | undefined;

  return createStore<TrainerState>((set, get) => {
    const line = () => get().lines[get().lineIdx];
    const haptic = (k: 'success' | 'error' | 'light') => usePrefs.getState().haptics && platform().haptic(k);

    const play = (uci: string) => {
      const before = positionFromFen(get().fen);
      const played = playUci(before, uci);
      playSound(soundForMove(played));
      announceMove(before.turn, played.san);
      set({ fen: played.fen, lastMove: played.uci, hint: undefined });
    };

    const advance = () => {
      clearTimeout(timer);
      const l = line();
      if (!l) {
        set({ phase: 'done', stats: { ...get().stats, endedAt: Date.now() } });
        playSound('complete');
        return;
      }
      const { ply } = get();
      if (ply >= l.ucis.length) {
        set({ phase: 'lineDone' });
        timer = setTimeout(() => {
          const next = get().lineIdx + 1;
          if (next >= get().lines.length) return advanceTo(next);
          advanceTo(next);
        }, 700);
        return;
      }
      const step = l.steps[ply]!;
      const epd = l.epds[ply]!;
      if (step === 'auto') {
        const own = positionFromFen(get().fen).turn === l.color;
        set({ phase: 'auto', expected: [], message: undefined });
        timer = setTimeout(() => {
          play(l.ucis[ply]!);
          set({ ply: ply + 1 });
          advance();
        }, own ? OWN_AUTO_DELAY : AUTO_DELAY);
        return;
      }
      const expected = step === 'learn' ? [l.ucis[ply]!] : withLineMove(expectedMoves(data, graphs, l.color, epd), l.ucis[ply]!);
      set({
        phase: step === 'learn' ? 'learn' : 'await',
        expected,
        hint: step === 'learn' ? l.ucis[ply] : undefined,
        failedHere: false,
        shownAt: Date.now(),
        message: undefined,
      });
    };

    const advanceTo = (lineIdx: number) => {
      const l = get().lines[lineIdx];
      set({ lineIdx, ply: 0, fen: l?.rootFen ?? get().fen, lastMove: undefined, syncKey: get().syncKey + 1 });
      advance();
    };

    return {
      mode,
      lines,
      lineIdx: 0,
      ply: 0,
      fen: lines[0]?.rootFen ?? '',
      phase: 'idle',
      expected: [],
      syncKey: 0,
      stats: { graded: 0, correct: 0, learned: 0, startedAt: Date.now() },
      mistakes: [],
      failedHere: false,
      shownAt: Date.now(),
      start: () => {
        set({ stats: { graded: 0, correct: 0, learned: 0, startedAt: Date.now() } });
        advanceTo(0);
      },
      userMove: (uci) => {
        const s = get();
        const l = line();
        if (!l || !['await', 'learn', 'wrong'].includes(s.phase)) {
          set({ syncKey: s.syncKey + 1 }); // not your turn: put the piece back
          return;
        }
        let std: string;
        try {
          std = playUci(positionFromFen(s.fen), uci).uci;
        } catch {
          set({ syncKey: s.syncKey + 1 });
          return;
        }
        const epd = l.epds[s.ply]!;
        const ms = Date.now() - s.shownAt;
        if (s.expected.includes(std)) {
          const lineMove = l.ucis[s.ply]!;
          if (s.phase === 'learn') {
            void useTraining.getState().record({ color: l.color, epd, rating: 3, played: std, expected: s.expected, mode: 'learn', msTaken: ms });
            set({ stats: { ...s.stats, learned: s.stats.learned + 1 } });
          } else if (!s.failedHere) {
            const card = useTraining.getState().cards.find((c) => c.color === l.color && c.epd === epd);
            const rating = autoGrade({ correct: true, msTaken: ms, reps: card?.fsrs.reps ?? 0 });
            void useTraining.getState().record({ color: l.color, epd, rating, played: std, expected: s.expected, mode: s.mode, msTaken: ms });
            set({ stats: { ...s.stats, graded: s.stats.graded + 1, correct: s.stats.correct + 1 } });
          }
          haptic('light');
          if (std === lineMove) {
            play(std);
          } else {
            // Another repertoire's main move here (conflict): accepted, but the line continues with its own move.
            set({ message: 'Also in your repertoire — continuing this line', syncKey: s.syncKey + 1 });
            play(lineMove);
          }
          set({ ply: s.ply + 1, phase: 'auto', hint: undefined, expected: [], feedback: { kind: 'right', key: Date.now() } });
          timer = setTimeout(advance, 60);
          return;
        }
        // Wrong
        const alternates = alternateMoves(data, graphs, l.color, epd);
        const isAlt = alternates.includes(std);
        if (s.phase !== 'wrong' && s.phase !== 'learn') {
          void useTraining.getState().record({ color: l.color, epd, rating: 1, played: std, expected: s.expected, mode: s.mode, msTaken: ms });
          set({
            stats: { ...s.stats, graded: s.stats.graded + 1 },
            mistakes: [...s.mistakes, { epd, fen: s.fen, color: l.color, played: std, expected: s.expected, repId: l.repId }],
          });
        }
        playSound('error');
        haptic('error');
        {
          const correct = s.expected[0] ? playUci(positionFromFen(s.fen), s.expected[0]).san : '';
          announce(`Not quite. The move is ${sanToSpeech(correct)}.`);
        }
        set({
          phase: s.phase === 'learn' ? 'learn' : 'wrong',
          failedHere: true,
          feedback: { kind: 'wrong', key: Date.now() },
          message: isAlt ? 'That’s your alternate — the main move is shown' : undefined,
        });
        // Let the wrong move register visually, then take it back and show the right one.
        timer = setTimeout(() => set({ syncKey: get().syncKey + 1, hint: get().expected[0] }), 420);
      },
      revealMove: () => {
        const s = get();
        const l = line();
        if (!l || !['await', 'wrong'].includes(s.phase)) return;
        if (!s.failedHere) {
          const epd = l.epds[s.ply]!;
          void useTraining.getState().record({ color: l.color, epd, rating: 1, played: null, expected: s.expected, mode: s.mode, msTaken: Date.now() - s.shownAt });
          set({ stats: { ...s.stats, graded: s.stats.graded + 1 }, mistakes: [...s.mistakes, { epd, fen: s.fen, color: l.color, played: '', expected: s.expected, repId: l.repId }] });
        }
        set({ phase: 'wrong', failedHere: true, hint: s.expected[0] });
      },
      skipLine: () => {
        clearTimeout(timer);
        advanceTo(get().lineIdx + 1);
      },
    };
  });
}

const withLineMove = (expected: string[], lineMove: string) => (expected.includes(lineMove) ? expected : [lineMove, ...expected]);
