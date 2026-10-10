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
import { scopeRepIds } from '../lib/practice';
import { usePlan } from '../lib/plan';
import { Button, IconButton } from '../ui/primitives';
import { EmptyState } from '../ui/kit';
import { CoachAnswer } from '../panels/CoachPanel';
import type { StoreApi } from 'zustand';
import { fmtPercent, msg, t, tn } from '../lib/i18n';

const MODE_NAMES: Record<TrainMode, string> = { learn: msg('Learn'), review: msg('Review'), drill: msg('Drill'), quiz: msg('Position quiz') };
const MODE_DONE: Record<TrainMode, string> = { learn: msg('Learn complete'), review: msg('Review complete'), drill: msg('Drill complete'), quiz: msg('Position quiz complete') };

export function TrainScreen() {
  const [params] = useSearchParams();
  const mode = (params.get('mode') as TrainMode) ?? 'review';
  const showAll = mode === 'learn' && params.get('show') === '1';
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
    const repIds = scopeRepIds(params, lib.folders, lib.reps, lib.moves);
    const learnedToday = training.reviews.filter((r) => r.mode === 'learn' && r.reviewedAt >= startOfDay()).length;
    const lines = planSession({
      mode,
      data,
      cards: training.cards,
      now: Date.now(),
      newLimit: Math.max(0, newLimit - learnedToday),
      repIds,
      maxLines: mode === 'drill' ? (repIds ? Math.min(12, Math.max(6, repIds.length * 2)) : 8) : mode === 'quiz' ? 15 : undefined,
      replyWeights: peekReplyWeights,
      showAll,
      throughEpd: params.get('at') ?? undefined,
    });
    if (!lines.length) {
      setEmpty(true);
      setTrainer(null);
      return;
    }
    setEmpty(false);
    const session = createTrainer(mode, lines, data);
    setTrainer(session);
    session.getState().start();
    // Plan once per session start; later library/card changes shouldn't reshuffle a running session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.loaded, training.loaded, mode, params.toString(), run]);

  if (empty) return <EmptySession mode={mode} />;
  if (!trainer) return null;
  return <Session key={run} store={trainer} mode={mode} showAll={showAll} onAgain={() => setRun((r) => r + 1)} />;
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Session({ store, mode, showAll, onAgain }: { store: StoreApi<TrainerState>; mode: TrainMode; showAll?: boolean; onAgain: () => void }) {
  const s = useStore(store);
  const nav = useNavigate();
  const line = s.lines[s.lineIdx];
  const pos = useMemo(() => positionFromFen(s.fen || s.lines[0]!.rootFen), [s.fen, s.lines]);
  const opening = useOpeningName(s.fen ? [s.fen] : []);
  const color = line?.color ?? s.lines[0]!.color;
  const yourTurn = s.phase === 'await' || s.phase === 'learn' || s.phase === 'wrong';
  const totalSteps = s.lines.reduce((n, l) => n + l.steps.filter((x) => x !== 'auto').length, 0);
  const doneSteps = s.lines.slice(0, s.lineIdx).reduce((n, l) => n + l.steps.filter((x) => x !== 'auto').length, 0) + (line ? line.steps.slice(0, s.ply).filter((x) => x !== 'auto').length : 0);

  const [params] = useSearchParams();
  // A finished session ticks off the matching task of your plan.
  useEffect(() => {
    if (s.phase === 'done') usePlan.getState().completed(params);
  }, [s.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') nav(-1);
      if (e.key === 'h') store.getState().revealMove();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, store]);

  if (s.phase === 'done') return <Summary s={s} mode={mode} showAll={showAll} onAgain={onAgain} />;

  const shapes: DrawShape[] = s.hint ? [{ orig: s.hint.slice(0, 2) as Key, dest: s.hint.slice(2, 4) as Key, brush: s.phase === 'wrong' ? 'green' : 'blue' }] : [];
  const expectedSan = s.expected[0] ? uciToSan(pos, s.expected[0]) : undefined;
  const note = s.phase === 'learn' || s.phase === 'wrong' ? moveNote(line?.repId, line?.epds[s.ply], s.expected[0]) : undefined;

  return (
    <div className="mx-auto flex max-w-[640px] flex-col lg:max-w-[1100px] lg:flex-row lg:items-start lg:gap-8 lg:px-6 lg:py-6">
      <div className="lg:w-[min(calc(100dvh-8rem),640px)] lg:shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 lg:px-0">
          <IconButton icon={X} label={t('End session (Esc)')} onClick={() => nav(-1)} />
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={totalSteps} aria-valuenow={doneSteps} aria-label={t('Session progress')}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-[var(--ease-out)]" style={{ width: `${totalSteps ? (doneSteps / totalSteps) * 100 : 0}%` }} />
          </div>
          <span className="tnum min-w-14 text-end text-base font-bold text-ink-2">
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
          ariaLabel={`${t('Training board.')} ${pos.turn === 'white' ? t('White to move.') : t('Black to move.')} ${yourTurn ? t('Your move') : t('Opponent to move')}.`}
        />
      </div>
      <div className="flex flex-col gap-4 px-4 pt-5 lg:w-[360px] lg:px-0 lg:pt-14">
        <p className="text-sm font-semibold text-ink-2">
          {showAll ? t('Moves shown') : mode === 'drill' ? t('From memory') : t(MODE_NAMES[mode])}
          {line ? ` · ${repName(line.repId)}` : ''}
          {opening ? ` · ${opening.name}` : ''}
        </p>
        <div data-expected={s.expected[0] ?? ''} data-phase={s.phase}>
          <Prompt phase={s.phase} expectedSan={expectedSan} message={s.message} color={color} showAll={showAll} />
        </div>
        {note && <p className="rounded-[var(--radius-m)] bg-surface px-4 py-3 text-base text-ink-2 shadow-card">{note}</p>}
        <div className="flex flex-wrap gap-2">
          <span className="hidden md:inline-flex">
            <MoveInput fen={s.fen} onMove={(u) => store.getState().userMove(u)} disabled={!yourTurn} />
          </span>
          {s.phase === 'await' && (
            <Button size="sm" icon={Eye} onClick={() => store.getState().revealMove()}>
              {t('Show move')}
            </Button>
          )}
          {mode !== 'quiz' && (
            <Button size="sm" variant="ghost" icon={SkipForward} onClick={() => store.getState().skipLine()}>
              {t('Skip line')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function repName(repId: string) {
  return useLibrary.getState().reps.find((r) => r.id === repId)?.name ?? '';
}

function moveNote(repId?: string, epd?: string, uci?: string) {
  if (!repId || !epd || !uci) return undefined;
  return useLibrary.getState().moves.find((m) => m.repertoireId === repId && m.fromEpd === epd && m.uci === uci)?.note ?? undefined;
}

function Prompt({ phase, expectedSan, message, color, showAll }: { phase: TrainerState['phase']; expectedSan?: string; message?: string; color: string; showAll?: boolean }) {
  const text =
    phase === 'learn'
      ? showAll
        ? { title: t('You play {move}', { move: expectedSan ?? '' }), sub: t('Play it on the board — the line continues.'), tone: 'brand' }
        : { title: t('New move: {move}', { move: expectedSan ?? '' }), sub: t('Play it on the board to learn it.'), tone: 'brand' }
      : phase === 'await'
        ? { title: t('Your move'), sub: color === 'white' ? t('Find your repertoire move for White.') : t('Find your repertoire move for Black.'), tone: 'ink' }
        : phase === 'wrong'
          ? { title: t('Not quite — it’s {move}', { move: expectedSan ?? '' }), sub: message ?? t('Play the move shown to continue.'), tone: 'bad' }
          : phase === 'lineDone'
            ? { title: t('Line complete'), sub: t('Next line…'), tone: 'good' }
            : { title: t('Opponent is moving…'), sub: message ?? ' ', tone: 'muted' };
  const tones: Record<string, string> = { brand: 'text-brand-ink', ink: 'text-ink', bad: 'text-bad-ink', good: 'text-good-ink', muted: 'text-ink-2' };
  return (
    <div aria-live="polite">
      <h2 className={`text-3xl font-bold tracking-tight ${tones[text.tone]}`}>{text.title}</h2>
      <p className="mt-1 text-md text-ink-2">{text.sub}</p>
    </div>
  );
}

function Summary({ s, mode, showAll, onAgain }: { s: TrainerState; mode: TrainMode; showAll?: boolean; onAgain: () => void }) {
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
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-good-soft text-good" aria-hidden>
        <CheckCircle2 size={44} aria-hidden />
      </span>
      <h1 className="mt-5 text-3xl font-bold">{showAll ? t('Walkthrough complete') : t(MODE_DONE[mode])}</h1>
      <dl className="tnum mt-7 grid grid-cols-3 divide-x divide-line rounded-[var(--radius-l)] bg-surface py-5 shadow-card rtl:divide-x-reverse">
        <Stat label={showAll ? t('Moves played') : mode === 'learn' ? t('Learned') : t('Reviewed')} value={mode === 'learn' ? s.stats.learned : s.stats.graded} />
        <Stat label={t('Accuracy')} value={fmtPercent(acc / 100)} />
        <Stat label={t('Time')} value={secs >= 60 ? t('{min} min {sec} s', { min: Math.floor(secs / 60), sec: secs % 60 }) : t('{sec} s', { sec: secs })} />
      </dl>
      {(streak > 0 || goalHit) && (
        <p className="mt-4 flex flex-wrap justify-center gap-2 text-sm font-semibold">
          {streak > 0 && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-flame-soft px-3.5 text-flame-ink">
              <Flame size={15} fill="currentColor" aria-hidden /> {tn(streak, '{n}-day streak', '{n}-day streak')}
            </span>
          )}
          {goalHit && <span className="inline-flex h-9 items-center rounded-full bg-good-soft px-3.5 text-good-ink">🎯 {t('Daily goal complete')}</span>}
        </p>
      )}
      {s.mistakes.length > 0 && (
        <div className="mt-8 text-start">
          <h2 className="mb-3 px-1 text-lg font-bold">{t('To look at again')}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] bg-surface shadow-card">
            {s.mistakes.map((m, i) => {
              const pos = positionFromFen(m.fen);
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-base">
                  <span>
                    {m.played ? (
                      <>
                        {t('You played')} <b className="text-bad-ink">{uciToSan(pos, m.played)}</b>
                        {' · '}
                      </>
                    ) : null}
                    {t('The move is')} <b className="text-good-ink">{m.expected.map((u) => uciToSan(pos, u)).join(' / ')}</b>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" className="inline-flex min-h-[44px] items-center rounded-[var(--radius-s)] px-2.5 font-semibold text-brand-ink hover:bg-brand-softer" onClick={() => setWhy(why === i ? null : i)} aria-expanded={why === i}>
                      {t('Why?')}
                    </button>
                    <Link to={`/explore?fen=${encodeURIComponent(m.fen)}&color=${m.color}`} className="inline-flex min-h-[44px] items-center rounded-[var(--radius-s)] px-2.5 font-semibold text-brand-ink hover:bg-brand-softer">
                      {t('Explore')}
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
      <div className="mt-8 grid grid-cols-2 gap-2.5">
        <Button size="lg" icon={RotateCcw} onClick={onAgain}>
          {t('Again')}
        </Button>
        <Link to="/" className="pressable inline-flex h-14 items-center justify-center rounded-[var(--radius-m)] bg-brand px-6 text-md font-semibold text-on-brand">
          {t('Done')}
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 px-2">
      <dt className="text-sm font-medium text-ink-2">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold">{value}</dd>
    </div>
  );
}

function EmptySession({ mode }: { mode: TrainMode }) {
  const nav = useNavigate();
  const copy: Record<TrainMode, { title: string; body: string }> = {
    review: { title: t('You’re all caught up'), body: t('No reviews are due. Learn new moves, or come back when positions are due again.') },
    learn: { title: t('No new moves to learn'), body: t('You’ve learned everything in your repertoire (or hit today’s new-move limit).') },
    drill: { title: t('Nothing to drill yet'), body: t('Add a repertoire with a few moves first.') },
    quiz: { title: t('No positions learned yet'), body: t('Learn some moves first — the quiz tests positions you know.') },
  };
  return (
    <div className="mx-auto max-w-md px-4 py-16 md:py-24">
      <EmptyState
        icon={CheckCircle2}
        title={copy[mode].title}
        action={
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2">
              {mode !== 'learn' && (
                <Button variant="primary" onClick={() => nav('/train?mode=learn')}>
                  {t('Learn new moves')}
                </Button>
              )}
              <Button variant={mode === 'learn' ? 'primary' : 'secondary'} onClick={() => nav('/library')}>
                {t('Open repertoire')}
              </Button>
            </div>
            {/* Training hides the tab bar on phones: always offer the way back. */}
            <Button variant="ghost" size="sm" onClick={() => nav('/')}>
              {t('Back to Today')}
            </Button>
          </div>
        }
      >
        {copy[mode].body}
      </EmptyState>
    </div>
  );
}
