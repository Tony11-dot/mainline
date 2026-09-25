import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useStore } from 'zustand';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { CheckCircle2, Eye, Flame, RotateCcw, SkipForward, X } from 'lucide-react';
import { useStreak } from '../ui/streak';
import { StreakCelebration } from '../ui/streakViews';
import { legalDests, planSession, positionFromFen, uciToSan, type TrainMode } from '@mainline/shared';
import { Board } from '../board/Board';
import { MoveInput } from '../board/MoveInput';
import { useOpeningName } from '../board/useOpeningName';
import { createTrainer, type TrainerState } from '../lib/trainer';
import { useLibrary } from '../lib/library';
import { useTraining } from '../lib/training';
import { usePrefs } from '../lib/prefs';
import { peekReplyWeights } from '../lib/explorer';
import { Button, IconButton, PanelNote } from '../ui/primitives';
import { CoachAnswer } from '../panels/CoachPanel';
import type { StoreApi } from 'zustand';

const MODE_NAMES: Record<TrainMode, string> = { learn: 'Learn', review: 'Review', drill: 'Drill', quiz: 'Position quiz' };

export function TrainScreen() {
  const [params] = useSearchParams();
  const mode = (params.get('mode') as TrainMode) ?? 'review';
  const repIds = params.get('reps')?.split(',').filter(Boolean);
  const lib = useLibrary();
  const training = useTraining();
  const newLimit = usePrefs((s) => s.dailyNewLimit);
  const [trainer, setTrainer] = useState<StoreApi<TrainerState> | null>(null);
  const [empty, setEmpty] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    void lib.load();
    void training.load();
  }, [lib, training]);

  useEffect(() => {
    if (!lib.loaded || !training.loaded) return;
    const data = { reps: lib.reps, moves: lib.moves };
    const learnedToday = training.reviews.filter((r) => r.mode === 'learn' && r.reviewedAt >= startOfDay()).length;
    const lines = planSession({
      mode,
      data,
      cards: training.cards,
      now: Date.now(),
      newLimit: Math.max(0, newLimit - learnedToday),
      repIds,
      maxLines: mode === 'drill' ? 8 : mode === 'quiz' ? 15 : undefined,
      replyWeights: peekReplyWeights,
    });
    if (!lines.length) {
      setEmpty(true);
      setTrainer(null);
      return;
    }
    setEmpty(false);
    const t = createTrainer(mode, lines, data);
    setTrainer(t);
    t.getState().start();
    // Plan once per session start; later library/card changes shouldn't reshuffle a running session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.loaded, training.loaded, mode, params.get('reps'), run]);

  if (empty) return <EmptySession mode={mode} />;
  if (!trainer) return null;
  return <Session key={run} store={trainer} mode={mode} onAgain={() => setRun((r) => r + 1)} />;
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Session({ store, mode, onAgain }: { store: StoreApi<TrainerState>; mode: TrainMode; onAgain: () => void }) {
  const s = useStore(store);
  const nav = useNavigate();
  const line = s.lines[s.lineIdx];
  const pos = useMemo(() => positionFromFen(s.fen || s.lines[0]!.rootFen), [s.fen, s.lines]);
  const opening = useOpeningName(s.fen ? [s.fen] : []);
  const color = line?.color ?? s.lines[0]!.color;
  const yourTurn = s.phase === 'await' || s.phase === 'learn' || s.phase === 'wrong';
  const totalSteps = s.lines.reduce((n, l) => n + l.steps.filter((x) => x !== 'auto').length, 0);
  const doneSteps = s.lines.slice(0, s.lineIdx).reduce((n, l) => n + l.steps.filter((x) => x !== 'auto').length, 0) + (line ? line.steps.slice(0, s.ply).filter((x) => x !== 'auto').length : 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') nav(-1);
      if (e.key === 'h') store.getState().revealMove();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, store]);

  if (s.phase === 'done') return <Summary s={s} mode={mode} onAgain={onAgain} />;

  const shapes: DrawShape[] = s.hint ? [{ orig: s.hint.slice(0, 2) as Key, dest: s.hint.slice(2, 4) as Key, brush: s.phase === 'wrong' ? 'green' : 'blue' }] : [];
  const expectedSan = s.expected[0] ? uciToSan(pos, s.expected[0]) : undefined;
  const note = s.phase === 'learn' || s.phase === 'wrong' ? moveNote(line?.repId, line?.epds[s.ply], s.expected[0]) : undefined;

  return (
    <div className="mx-auto flex max-w-[640px] flex-col lg:max-w-[1100px] lg:flex-row lg:items-start lg:gap-8 lg:px-6 lg:py-6">
      <div className="lg:w-[min(calc(100dvh-8rem),640px)] lg:shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 lg:px-0">
          <IconButton icon={X} label="End session (Esc)" onClick={() => nav(-1)} />
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={totalSteps} aria-valuenow={doneSteps} aria-label="Session progress">
            <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-[var(--ease-out)]" style={{ width: `${totalSteps ? (doneSteps / totalSteps) * 100 : 0}%` }} />
          </div>
          <span className="tnum w-14 text-right text-sm font-semibold text-ink-2">
            {doneSteps}/{totalSteps}
          </span>
        </div>
        <Board
          fen={s.fen}
          orientation={color}
          turnColor={pos.turn}
          movable={yourTurn ? color : undefined}
          dests={yourTurn ? (legalDests(pos) as Map<Key, Key[]>) : new Map()}
          lastMove={s.lastMove ? [s.lastMove.slice(0, 2) as Key, s.lastMove.slice(2, 4) as Key] : undefined}
          check={pos.isCheck()}
          autoShapes={shapes}
          onMove={(u) => store.getState().userMove(u)}
          flash={s.feedback}
          syncKey={s.syncKey}
          ariaLabel={`Training board. ${pos.turn} to move. ${yourTurn ? 'Your move' : 'Opponent to move'}.`}
        />
      </div>
      <div className="flex flex-col gap-3 px-4 pt-4 lg:w-[360px] lg:px-0 lg:pt-14">
        <p className="text-xs font-semibold text-ink-3">
          {MODE_NAMES[mode]}
          {opening ? ` · ${opening.name}` : ''}
        </p>
        <div data-expected={s.expected[0] ?? ''} data-phase={s.phase}>
          <Prompt phase={s.phase} expectedSan={expectedSan} message={s.message} color={color} />
        </div>
        {note && <p className="rounded-[12px] bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">{note}</p>}
        <div className="flex flex-wrap gap-2">
          <span className="hidden md:inline-flex">
            <MoveInput fen={s.fen} onMove={(u) => store.getState().userMove(u)} disabled={!yourTurn} />
          </span>
          {s.phase === 'await' && (
            <Button size="sm" icon={Eye} onClick={() => store.getState().revealMove()}>
              Show move
            </Button>
          )}
          {mode !== 'quiz' && (
            <Button size="sm" variant="ghost" icon={SkipForward} onClick={() => store.getState().skipLine()}>
              Skip line
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function moveNote(repId?: string, epd?: string, uci?: string) {
  if (!repId || !epd || !uci) return undefined;
  return useLibrary.getState().moves.find((m) => m.repertoireId === repId && m.fromEpd === epd && m.uci === uci)?.note ?? undefined;
}

function Prompt({ phase, expectedSan, message, color }: { phase: TrainerState['phase']; expectedSan?: string; message?: string; color: string }) {
  const text =
    phase === 'learn'
      ? { title: `New move: ${expectedSan}`, sub: 'Play it on the board to learn it.', tone: 'brand' }
      : phase === 'await'
        ? { title: 'Your move', sub: `Find your repertoire move for ${color}.`, tone: 'ink' }
        : phase === 'wrong'
          ? { title: `Not quite — it's ${expectedSan}`, sub: message ?? 'Play the move shown to continue.', tone: 'bad' }
          : phase === 'lineDone'
            ? { title: 'Line complete', sub: 'Next line…', tone: 'good' }
            : { title: 'Opponent is moving…', sub: message ?? ' ', tone: 'muted' };
  const tones: Record<string, string> = { brand: 'text-brand-ink', ink: 'text-ink', bad: 'text-bad', good: 'text-good', muted: 'text-ink-2' };
  return (
    <div aria-live="polite">
      <h2 className={`text-xl font-bold tracking-tight ${tones[text.tone]}`}>{text.title}</h2>
      <p className="mt-0.5 text-sm text-ink-2">{text.sub}</p>
    </div>
  );
}

function Summary({ s, mode, onAgain }: { s: TrainerState; mode: TrainMode; onAgain: () => void }) {
  const [why, setWhy] = useState<number | null>(null);
  const reviews = useTraining((t) => t.reviews);
  const goal = usePrefs((p) => p.dailyGoal);
  const before = useStreak(s.stats.startedAt);
  const after = useStreak();
  const streak = after.current;
  // Duolingo moment: the first session that makes today count gets the full-screen celebration.
  const [celebrate, setCelebrate] = useState(() => !before.doneToday && after.doneToday);
  const todayCount = reviews.filter((r) => r.reviewedAt >= startOfDay()).length;
  const beforeCount = reviews.filter((r) => r.reviewedAt >= startOfDay() && r.reviewedAt < s.stats.startedAt).length;
  const goalHit = beforeCount < goal && todayCount >= goal;
  if (celebrate) return <StreakCelebration before={before} after={after} goalHit={goalHit} onDone={() => setCelebrate(false)} />;
  const secs = Math.round(((s.stats.endedAt ?? Date.now()) - s.stats.startedAt) / 1000);
  const acc = s.stats.graded ? Math.round((s.stats.correct / s.stats.graded) * 100) : 100;
  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center">
      <CheckCircle2 size={48} className="mx-auto text-good" aria-hidden />
      <h1 className="mt-3 text-2xl font-bold">{MODE_NAMES[mode]} complete</h1>
      <dl className="tnum mt-6 grid grid-cols-3 gap-2 rounded-[var(--radius-l)] border border-line bg-surface p-4 shadow-1">
        <Stat label={mode === 'learn' ? 'Learned' : 'Reviewed'} value={mode === 'learn' ? s.stats.learned : s.stats.graded} />
        <Stat label="Accuracy" value={`${acc}%`} />
        <Stat label="Time" value={secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`} />
      </dl>
      {(streak > 0 || goalHit) && (
        <p className="mt-4 flex flex-wrap justify-center gap-2 text-sm font-semibold">
          {streak > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-flame-soft px-3 py-1 text-flame-ink">
              <Flame size={15} fill="currentColor" aria-hidden /> {streak}-day streak
            </span>
          )}
          {goalHit && <span className="rounded-full bg-good-soft px-3 py-1 text-good">🎯 Daily goal complete</span>}
        </p>
      )}
      {s.mistakes.length > 0 && (
        <div className="mt-6 text-left">
          <h2 className="mb-2 text-sm font-semibold text-ink-2">To look at again</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
            {s.mistakes.map((m, i) => {
              const pos = positionFromFen(m.fen);
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    {m.played ? (
                      <>
                        You played <b className="text-bad">{uciToSan(pos, m.played)}</b>,{' '}
                      </>
                    ) : null}
                    the move is <b className="text-good">{m.expected.map((u) => uciToSan(pos, u)).join(' / ')}</b>
                  </span>
                  <span className="flex shrink-0 gap-3">
                    <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setWhy(why === i ? null : i)} aria-expanded={why === i}>
                      Why?
                    </button>
                    <Link to={`/explore?fen=${encodeURIComponent(m.fen)}&color=${m.color}`} className="font-semibold text-brand hover:underline">
                      Explore
                    </Link>
                  </span>
                  {why === i && (
                    <div className="basis-full border-t border-line pt-3">
                      <CoachAnswer req={{ kind: 'mistake', fen: m.fen, moveUci: m.expected[0], playedUci: m.played || undefined }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="mt-8 flex justify-center gap-2">
        <Button icon={RotateCcw} onClick={onAgain}>
          Again
        </Button>
        <Link to="/" className="inline-flex h-11 items-center rounded-[12px] bg-brand px-5 font-semibold text-on-brand">
          Done
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-xl font-bold">{value}</dd>
    </div>
  );
}

function EmptySession({ mode }: { mode: TrainMode }) {
  const nav = useNavigate();
  const copy: Record<TrainMode, { title: string; body: string }> = {
    review: { title: 'Nothing due right now', body: 'Every position you’ve learned is fresh. Learn new moves or come back later.' },
    learn: { title: 'No new moves to learn', body: 'You’ve learned everything in your repertoire (or hit today’s new-move limit).' },
    drill: { title: 'Nothing to drill yet', body: 'Add a repertoire with a few moves first.' },
    quiz: { title: 'No positions learned yet', body: 'Learn some moves first — the quiz tests positions you know.' },
  };
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <PanelNote
        icon={CheckCircle2}
        title={copy[mode].title}
        action={
          <div className="flex gap-2">
            {mode !== 'learn' && <Button onClick={() => nav('/train?mode=learn')}>Learn new moves</Button>}
            <Button variant="primary" onClick={() => nav('/library')}>
              Open repertoire
            </Button>
          </div>
        }
      >
        {copy[mode].body}
      </PanelNote>
    </div>
  );
}
