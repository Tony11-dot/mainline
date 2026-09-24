import { useEffect, useMemo } from 'react';
import { Link, Navigate } from 'react-router';
import { BookOpen, Dumbbell, Flame, GraduationCap, Play, Shuffle } from 'lucide-react';
import { streakDays, trainingSummary } from '@mainline/shared';
import { useLibrary } from '../lib/library';
import { useTraining, reviewsToday } from '../lib/training';
import { usePrefs } from '../lib/prefs';
import { LogoMark } from '../ui/Logo';
import { useT } from '../lib/i18n';

export function HomeScreen() {
  const t = useT();
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
  const streak = streakDays(tr.reviews.map((r) => r.reviewedAt), now, new Date().getTimezoneOffset());
  const hasReps = lib.reps.some((r) => !r.deleted);
  const onboarded = usePrefs((s) => s.onboarded);
  if (lib.loaded && !hasReps && !onboarded) return <Navigate to="/welcome" replace />;
  const primary = sum.due > 0 ? { to: '/train?mode=review', label: t('today.trainNow'), sub: `${sum.due} due · ~${sum.minutes} min` } : sum.newToday > 0 ? { to: '/train?mode=learn', label: t('today.learnNew'), sub: `${sum.newToday} new today · ~${sum.minutes} min` } : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center gap-3">
        <LogoMark size={34} className="md:hidden" />
        <h1 className="text-3xl font-bold">{t('today.title')}</h1>
        {streak > 0 && (
          <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-warn-soft px-3 py-1 text-sm font-semibold text-[oklch(0.45_0.1_70)] dark:text-warn" title="Days in a row with training">
            <Flame size={15} aria-hidden /> {streak}
          </span>
        )}
      </div>

      {!lib.loaded ? null : !hasReps ? (
        <div className="mt-8 rounded-[var(--radius-xl)] border border-line bg-surface p-6 shadow-1">
          <h2 className="text-xl font-bold">Start your first repertoire</h2>
          <p className="mt-1 max-w-[52ch] text-ink-2">Pick an opening, play the moves you want on the board, and MainLine turns every position into spaced-repetition training.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/library/openings" className="inline-flex h-12 items-center gap-2 rounded-[14px] bg-brand px-5 font-semibold text-on-brand">
              <BookOpen size={18} aria-hidden /> Browse openings
            </Link>
            <Link to="/library" className="inline-flex h-12 items-center rounded-[14px] border border-line bg-surface px-5 font-semibold shadow-1">
              Build from scratch
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
              <p className="text-lg font-bold">All caught up</p>
              <p className="text-ink-2">Nothing is due. Drill a line or add moves to your repertoire.</p>
            </div>
          )}

          <dl className="tnum mt-4 grid grid-cols-3 gap-2">
            <Tile label="Positions learned" value={`${sum.learned}/${sum.positions}`} />
            <Tile label="Retention" value={sum.learned ? `${Math.round(sum.retention * 100)}%` : '—'} />
            <GoalTile done={today.length} goal={goal} />
          </dl>

          <h2 className="mt-8 mb-2 text-sm font-semibold text-ink-2">Practice</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <ModeLink to="/train?mode=learn" icon={GraduationCap} title="Learn" sub={sum.newToday ? `${sum.newToday} new today` : 'Nothing new'} />
            <ModeLink to="/train?mode=drill" icon={Shuffle} title="Drill" sub="Random lines, real reply odds" />
            <ModeLink to="/train?mode=quiz" icon={Dumbbell} title="Position quiz" sub="Weakest positions first" />
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-m)] border border-line bg-surface px-3 py-2.5 shadow-1">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-lg font-bold">{value}</dd>
    </div>
  );
}

function ModeLink({ to, icon: Icon, title, sub }: { to: string; icon: typeof Play; title: string; sub: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-[var(--radius-m)] border border-line bg-surface px-4 py-3 shadow-1 transition-colors hover:bg-surface-2">
      <Icon size={20} className="text-brand" aria-hidden />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-ink-2">{sub}</span>
      </span>
    </Link>
  );
}

function GoalTile({ done, goal }: { done: number; goal: number }) {
  const pct = goal ? Math.min(1, done / goal) : 0;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-m)] border border-line bg-surface px-3 py-2.5 shadow-1">
      <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90 shrink-0" aria-hidden>
        <circle cx="19" cy="19" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
        <circle cx="19" cy="19" r={r} fill="none" stroke={pct >= 1 ? 'var(--good)' : 'var(--brand)'} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-500" />
      </svg>
      <div>
        <dt className="text-xs text-ink-3">Daily goal</dt>
        <dd className="text-lg font-bold">
          {done}/{goal}
        </dd>
      </div>
    </div>
  );
}
