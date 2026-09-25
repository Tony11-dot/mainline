import { lazy, Suspense, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { streakInfo, type StreakInfo } from '@mainline/shared';
import { useTraining } from '../lib/training';

// The sheet and the celebration load on demand; Home only needs the badge up front.
const StreakSheet = lazy(() => import('./streakViews').then((m) => ({ default: m.StreakSheet })));

const tz = () => new Date().getTimezoneOffset();

/** The live streak, recomputed whenever reviews change. `before` limits it to reviews older than a time. */
export function useStreak(before?: number): StreakInfo {
  const reviews = useTraining((s) => s.reviews);
  const version = useTraining((s) => s.version);
  return useMemo(
    () => streakInfo(reviews.filter((r) => before === undefined || r.reviewedAt < before).map((r) => r.reviewedAt), before ?? Date.now(), tz()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, before],
  );
}

/** Header flame: grey until today's practice, then lit — tap for details. */
export function StreakBadge() {
  const s = useStreak();
  const [open, setOpen] = useState(false);
  const lit = s.doneToday;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`tnum inline-flex h-9 items-center gap-1 rounded-full px-3 text-base font-bold transition-colors ${lit ? 'bg-flame-soft text-flame-ink' : 'bg-surface-3 text-ink-3'}`}
        aria-label={`${s.current}-day streak${s.atRisk ? ', practise today to keep it' : ''}. Show streak details.`}
        data-testid="streak-badge"
      >
        <Flame size={18} fill={lit ? 'currentColor' : 'none'} aria-hidden className={lit ? 'text-flame' : ''} />
        {s.current}
      </button>
      {open && (
        <Suspense>
          <StreakSheet open onClose={() => setOpen(false)} s={s} />
        </Suspense>
      )}
    </>
  );
}

