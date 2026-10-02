import { useEffect, useMemo } from 'react';
import { Link, Navigate } from 'react-router';
import { BarChart3, BookOpen, ChevronRight, Cpu, Dumbbell, Flame, GraduationCap, Play, Shuffle, Snowflake } from 'lucide-react';
import { trainingSummary } from '@mainline/shared';
import { StreakBadge, useStreak } from '../ui/streak';
import { useLibrary } from '../lib/library';
import { useTraining, reviewsToday } from '../lib/training';
import { usePrefs } from '../lib/prefs';
import { LogoMark } from '../ui/Logo';
import { fmtPercent, t, tn } from '../lib/i18n';

export function HomeScreen() {
  const lib = useLibrary();
  const tr = useTraining();
  const newLimit = usePrefs((s) => s.dailyNewLimit);
  const goal = usePrefs((s) => s.dailyGoal);
  useEffect(() => {
    void lib.load();
    void tr.load();
  }, [lib, tr]);

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
      <div className="flex items-center gap-3">
        <LogoMark size={34} className="md:hidden" />
        <h1 className="text-3xl font-bold">{t('Today')}</h1>
        {hasReps && (
          <span className="ms-auto">
            <StreakBadge />
          </span>
        )}
      </div>
      {hasReps && streak.atRisk && (
        <p className="mt-3 flex items-center gap-2 rounded-[var(--radius-m)] bg-flame-soft px-4 py-2.5 text-sm font-semibold text-flame-ink" data-testid="streak-at-risk">
          {streak.freezeUsed ? <Snowflake size={16} className="shrink-0 text-freeze" aria-hidden /> : <Flame size={16} className="shrink-0 text-flame" aria-hidden />}
          {streak.freezeUsed
            ? tn(streak.current, 'A streak freeze saved your {n}-day streak. Practise today to keep it.', 'A streak freeze saved your {n}-day streak. Practise today to keep it.')
            : tn(streak.current, 'Practise today to keep your {n}-day streak.', 'Practise today to keep your {n}-day streak.')}
        </p>
      )}

      {!lib.loaded ? null : !hasReps ? (
        <div className="mt-8 rounded-[var(--radius-xl)] border border-line bg-surface p-6 shadow-1">
          <h2 className="text-xl font-bold">{t('Start your first repertoire')}</h2>
          <p className="mt-1 max-w-[52ch] text-ink-2">{t('Pick an opening, play the moves you want on the board, and MainLine turns every position into spaced-repetition training.')}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/library/openings" className="inline-flex h-12 items-center gap-2 rounded-[14px] bg-brand px-5 font-semibold text-on-brand">
              <BookOpen size={18} aria-hidden /> {t('Browse openings')}
            </Link>
            <Link to="/library" className="inline-flex h-12 items-center rounded-[14px] border border-line bg-surface px-5 font-semibold shadow-1">
              {t('Build from scratch')}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {primary ? (
            <Link
              to={primary.to}
              className="group mt-6 flex items-center gap-4 rounded-[var(--radius-xl)] bg-brand p-5 text-on-brand shadow-3 transition-transform duration-150 active:scale-[0.99]"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--on-brand)_18%,transparent)]">
                <Play size={26} fill="currentColor" aria-hidden />
              </span>
              <span>
                <span className="block text-2xl font-bold">{primary.label}</span>
                <span className="tnum block opacity-85">{primary.sub}</span>
              </span>
            </Link>
          ) : (
            <div className="mt-6 rounded-[var(--radius-xl)] border border-line bg-surface p-5 shadow-1">
              <p className="text-lg font-bold">{t('All caught up')}</p>
              <p className="text-ink-2">{t('Nothing is due. Drill a line or add moves to your repertoire.')}</p>
            </div>
          )}

          <Progress done={today.length} goal={goal} learned={sum.learned} positions={sum.positions} retention={sum.learned ? sum.retention : null} />

          <h2 className="mt-8 mb-2 px-1 text-sm font-semibold text-ink-2">{t('Practice')}</h2>
          <ListGroup>
            <ModeLink to="/train?mode=learn" icon={GraduationCap} title={t('Learn')} sub={sum.newToday ? t('{count} new today', { count: sum.newToday }) : t('Nothing new today')} />
            <ModeLink to="/train?mode=drill" icon={Shuffle} title={t('Drill')} sub={t('Random lines, real reply odds')} />
            <ModeLink to="/train?mode=quiz" icon={Dumbbell} title={t('Position quiz')} sub={t('Weakest positions first')} />
          </ListGroup>
        </>
      )}
      <h2 className="mt-8 mb-2 px-1 text-sm font-semibold text-ink-2">{t('Tools')}</h2>
      <ListGroup>
        <ModeLink to="/stats" icon={BarChart3} title={t('Statistics')} sub={t('Accuracy, repertoires, openings, games')} />
        <ModeLink to="/setup" icon={Cpu} title={t('Analysis board')} sub={t('Set up any position, run Stockfish')} />
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
    <dl className="tnum mt-3 flex items-stretch rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
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
    </dl>
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

function ListGroup({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">{children}</div>;
}

function ModeLink({ to, icon: Icon, title, sub }: { to: string; icon: typeof Play; title: string; sub: string }) {
  return (
    <Link to={to} className="flex min-h-[60px] items-center gap-3.5 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2 active:bg-surface-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand-ink">
        <Icon size={19} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-sm text-ink-2">{sub}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink-3 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
