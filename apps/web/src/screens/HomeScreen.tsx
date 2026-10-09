import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { BarChart3, CalendarDays, Cpu, Target, Dumbbell, Flame, GraduationCap, Play, Shuffle, Snowflake, Sparkles } from 'lucide-react';
import { trainingSummary } from '@mainline/shared';
import { StreakBadge, useStreak } from '../ui/streak';
import { useLibrary } from '../lib/library';
import { useTraining, reviewsToday } from '../lib/training';
import { usePrefs } from '../lib/prefs';
import { useGames } from '../lib/games';
import type { weakSpots } from '../lib/packs';

// The opening catalogue is big: Today loads it only once there are games to judge.
const WeakSpotCard = lazy(async () => ({ default: (await import('./library/WeakSpotCard')).WeakSpotCard }));
const HomePlanCard = lazy(async () => ({ default: (await import('./focus/HomePlanCard')).HomePlanCard }));
import { LogoMark } from '../ui/Logo';
import { Card, ListGroup, ListRow, PageHeader, SectionHeader } from '../ui/kit';
import { fmtPercent, t, tn } from '../lib/i18n';

export function HomeScreen() {
  const lib = useLibrary();
  const tr = useTraining();
  const newLimit = usePrefs((s) => s.dailyNewLimit);
  const goal = usePrefs((s) => s.dailyGoal);
  useEffect(() => {
    void lib.load();
    void tr.load();
    void useGames.getState().load();
  }, [lib, tr]);
  const games = useGames((g) => g.games);
  const [spot, setSpot] = useState<ReturnType<typeof weakSpots>[number]>();
  useEffect(() => {
    if (!games.length) return;
    let live = true;
    void import('../lib/packs').then((m) => live && setSpot(m.weakSpots(games)[0]));
    return () => {
      live = false;
    };
  }, [games]);

  const now = Date.now();
  const today = reviewsToday(tr.reviews, now);
  const learnedToday = today.filter((r) => r.mode === 'learn').length;
  const sum = useMemo(
    () => trainingSummary({ reps: lib.reps, moves: lib.moves }, tr.cards, now, newLimit, learnedToday),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lib.version, tr.version, newLimit, learnedToday],
  );
  const streak = useStreak();
  const hasReps = lib.reps.some((r) => !r.deleted);
  const onboarded = usePrefs((s) => s.onboarded);
  if (lib.loaded && !hasReps && !onboarded) return <Navigate to="/welcome" replace />;
  const primary = sum.due > 0 ? { to: '/train?mode=review', label: t('Train now'), sub: t('{due} due · ~{min} min', { due: sum.due, min: sum.minutes }) } : sum.newToday > 0 ? { to: '/train?mode=learn', label: t('Learn new moves'), sub: t('{count} new today · ~{min} min', { count: sum.newToday, min: sum.minutes }) } : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title={t('Today')} large trailing={hasReps ? <StreakBadge /> : undefined}>
        <LogoMark size={34} className="md:hidden" />
      </PageHeader>
      {hasReps && streak.atRisk && (
        <p className="mt-3 flex items-center gap-2.5 rounded-[var(--radius-m)] bg-flame-soft px-4 py-3 text-sm font-semibold text-flame-ink" data-testid="streak-at-risk">
          {streak.freezeUsed ? <Snowflake size={16} className="shrink-0 text-freeze" aria-hidden /> : <Flame size={16} className="shrink-0 text-flame" aria-hidden />}
          {streak.freezeUsed
            ? tn(streak.current, 'A streak freeze saved your {n}-day streak. Practise today to keep it.', 'A streak freeze saved your {n}-day streak. Practise today to keep it.')
            : tn(streak.current, 'Practise today to keep your {n}-day streak.', 'Practise today to keep your {n}-day streak.')}
        </p>
      )}

      {!lib.loaded ? null : !hasReps ? (
        <Card className="mt-6 p-6">
          <h2 className="text-xl font-bold">{t('Start your first repertoire')}</h2>
          <p className="mt-1 max-w-[52ch] text-ink-2">{t('Pick an opening, play the moves you want on the board, and MainLine turns every position into spaced-repetition training.')}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/library/ready" className="pressable inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-5 font-semibold text-on-brand">
              <Sparkles size={18} aria-hidden /> {t('Ready-made openings')}
            </Link>
            <Link to="/library" className="pressable inline-flex h-12 items-center rounded-[var(--radius-control)] border border-line bg-surface px-5 font-semibold shadow-1 hover:bg-surface-2">
              {t('Build from scratch')}
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {primary ? (
            // The one thing to do now: the only filled surface on the page.
            <Link to={primary.to} className="pressable mt-5 flex items-center gap-4 rounded-[var(--radius-xl)] bg-brand p-5 text-on-brand shadow-3">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--on-brand)_18%,transparent)]">
                <Play size={26} fill="currentColor" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-bold">{primary.label}</span>
                <span className="tnum block opacity-85">{primary.sub}</span>
              </span>
            </Link>
          ) : (
            <Card className="mt-5 p-5">
              <p className="text-lg font-bold">{t('All caught up')}</p>
              <p className="text-ink-2">{t('Nothing is due. Drill a line or add moves to your repertoire.')}</p>
            </Card>
          )}

          <Suspense>
            <HomePlanCard />
          </Suspense>
          {spot && (
            <Suspense>
              <div className="mt-3">
                <WeakSpotCard spot={spot} />
              </div>
            </Suspense>
          )}

          <Progress done={today.length} goal={goal} learned={sum.learned} positions={sum.positions} retention={sum.learned ? sum.retention : null} />

          <SectionHeader title={t('Practice')} className="mt-[var(--section-gap)]" />
          <ListGroup>
            <ListRow to="/train?mode=learn" icon={GraduationCap} title={t('Learn')} sub={sum.newToday ? t('{count} new today', { count: sum.newToday }) : t('Nothing new today')} />
            <ListRow to="/train?mode=drill" icon={Shuffle} title={t('Drill')} sub={t('Random lines, real reply odds')} />
            <ListRow to="/train?mode=quiz" icon={Dumbbell} title={t('Position quiz')} sub={t('Weakest positions first')} />
          </ListGroup>
        </>
      )}
      <SectionHeader title={t('Tools')} className="mt-[var(--section-gap)]" />
      <ListGroup>
        <ListRow to="/focus" icon={Target} title={t('Weak spots')} sub={t('Your weakest moves, openings and lines')} />
        <ListRow to="/plan" icon={CalendarDays} title={t('Study plan')} sub={t('A few days of sessions, built around your focus')} />
        <ListRow to="/stats" icon={BarChart3} title={t('Statistics')} sub={t('Accuracy, repertoires, openings, games')} />
        <ListRow to="/setup" icon={Cpu} title={t('Analysis board')} sub={t('Set up any position, run Stockfish')} />
      </ListGroup>
    </div>
  );
}

/** Today at a glance: the daily goal ring, then learned and retention, in one quiet panel. */
function Progress({ done, goal, learned, positions, retention }: { done: number; goal: number; learned: number; positions: number; retention: number | null }) {
  const pct = goal ? Math.min(1, done / goal) : 0;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <Card as="dl" pad={false} className="tnum mt-3 flex items-stretch">
      <div className="flex min-w-0 flex-[1.25] items-center gap-2.5 py-3 ps-3.5 pe-2 sm:gap-3 sm:px-4">
        <svg viewBox="0 0 38 38" className="size-8 shrink-0 -rotate-90 sm:size-9" aria-hidden>
          <circle cx="19" cy="19" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
          <circle cx="19" cy="19" r={r} fill="none" stroke={pct >= 1 ? 'var(--good)' : 'var(--brand)'} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-500" />
        </svg>
        <div className="min-w-0">
          <dt className="text-xs whitespace-nowrap text-ink-3">{t('Daily goal')}</dt>
          <dd className="text-md font-bold">
            {done}
            <span className="font-semibold text-ink-3">/{goal}</span>
          </dd>
        </div>
      </div>
      <Stat label={t('Learned')} value={learned} of={positions} />
      <Stat label={t('Retention')} value={retention === null ? '—' : fmtPercent(retention)} />
    </Card>
  );
}

function Stat({ label, value, of }: { label: string; value: number | string; of?: number }) {
  return (
    <div className="min-w-0 flex-1 border-s border-line px-3.5 py-3 sm:px-4">
      <dt className="truncate text-xs text-ink-3">{label}</dt>
      <dd className="text-md font-bold">
        {value}
        {of !== undefined && <span className="font-semibold text-ink-3">/{of}</span>}
      </dd>
    </div>
  );
}
