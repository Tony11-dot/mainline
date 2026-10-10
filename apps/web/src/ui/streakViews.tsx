import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { BellRing, Check, Flame, Snowflake, Trophy } from 'lucide-react';
import { FREEZE_EVERY, MAX_FREEZES, STREAK_MILESTONES, type DayMark, type StreakInfo } from '@mainline/shared';
import { usePrefs } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { platform } from '../platform';
import { Sheet } from './Sheet';
import { useOverlay } from './overlay';
import { Button } from './primitives';
import { intlLocale, t, tn } from '../lib/i18n';

const tz = () => new Date().getTimezoneOffset();
const weekday = () => new Intl.DateTimeFormat(intlLocale(), { weekday: 'narrow' });
const dayDate = (day: number) => new Date(day * 86_400_000 + tz() * 60_000 + 12 * 3_600_000);

export function WeekStrip({ week, pop }: { week: StreakInfo['week']; pop?: boolean }) {
  const label: Record<DayMark, string> = { done: t('practised'), frozen: t('streak freeze used'), missed: t('missed'), pending: t('not yet') };
  return (
    <ol className="flex justify-between gap-1" aria-label={t('Last 7 days')}>
      {week.map((w, i) => {
        const today = i === week.length - 1;
        const d = dayDate(w.day);
        return (
          <li key={w.day} className="flex flex-1 flex-col items-center gap-1.5" aria-label={`${d.toLocaleDateString(intlLocale(), { weekday: 'long' })}: ${label[w.mark]}`}>
            <span className={`text-xs ${today ? 'font-bold text-ink' : 'text-ink-3'}`} aria-hidden>
              {weekday().format(d)}
            </span>
            <span
              aria-hidden
              style={today && pop && w.mark === 'done' ? { animation: 'ml-pop 520ms var(--ease-spring) 350ms both' } : undefined}
              className={`flex size-9 items-center justify-center rounded-full ${
                w.mark === 'done' ? 'bg-flame text-white' : w.mark === 'frozen' ? 'bg-freeze text-white' : w.mark === 'pending' ? 'border-2 border-dashed border-line-strong' : 'bg-surface-3'
              }`}
            >
              {w.mark === 'done' ? <Check size={18} strokeWidth={3} /> : w.mark === 'frozen' ? <Snowflake size={17} strokeWidth={2.4} /> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Freezes({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-m)] bg-freeze-soft px-4 py-3">
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: MAX_FREEZES }, (_, i) => (
          <Snowflake key={i} size={20} className={i < n ? 'text-freeze' : 'text-ink-3 opacity-40'} strokeWidth={2.4} />
        ))}
      </span>
      <p className="text-sm text-ink-2">
        <b className="text-ink">{t('{n} of {max} streak freezes', { n, max: MAX_FREEZES })}</b>
        <br />
        {t('Every {days} days in a row earns one. A missed day uses it automatically.', { days: FREEZE_EVERY })}
      </p>
    </div>
  );
}

export function StreakSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: StreakInfo }) {
  const remindersOn = usePrefs((p) => p.remindersOn);
  const prev = [...STREAK_MILESTONES].reverse().find((m) => m <= s.current) ?? 0;
  const pct = Math.min(1, (s.current - prev) / Math.max(1, s.nextMilestone - prev));
  return (
    <Sheet open={open} onClose={onClose} title={t('Streak')}>
      <div className="flex items-center gap-4 pt-1">
        <span className={`flex size-16 shrink-0 items-center justify-center rounded-full ${s.current ? 'bg-flame-soft text-flame' : 'bg-surface-3 text-ink-3'}`}>
          <Flame size={34} fill={s.doneToday ? 'currentColor' : 'none'} aria-hidden />
        </span>
        <div>
          <p className="tnum text-3xl font-bold leading-none tracking-tight">
            {tn(s.current, '{n} day', '{n} days')}
          </p>
          <p className="mt-1.5 text-base text-ink-2">
            {s.doneToday ? t('Done for today. See you tomorrow!') : s.current ? t('Practise today to keep it going.') : t('Practise today to start a streak.')}
          </p>
        </div>
      </div>
      <div className="mt-5">
        <WeekStrip week={s.week} />
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-xs text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Trophy size={13} aria-hidden /> {tn(s.nextMilestone, 'Next milestone: {n} day', 'Next milestone: {n} days')}
          </span>
          <span className="tnum">{t('Best: {n}', { n: s.longest })}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={prev} aria-valuemax={s.nextMilestone} aria-valuenow={s.current} aria-label={t('Progress to next milestone')}>
          <div className="h-full rounded-full bg-flame transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
      <div className="mt-5">
        <Freezes n={s.freezes} />
      </div>
      {!remindersOn && (
        <Link to="/settings#reminders" onClick={onClose} className="pressable mt-3 flex min-h-[48px] items-center gap-3 rounded-[var(--radius-m)] bg-brand-soft px-4 py-3 text-base font-semibold text-brand-ink hover:bg-brand-soft-2">
          <BellRing size={18} className="text-brand" aria-hidden /> {t('Turn on streak reminders')}
        </Link>
      )}
    </Sheet>
  );
}

const milestoneLine = (n: number) =>
  n === 7 ? t('One full week!') : n === 30 ? t('A whole month of openings!') : n === 365 ? t('One year. Legendary.') : STREAK_MILESTONES.includes(n) ? t('{n}-day milestone!', { n }) : null;

/**
 * Full-screen "streak extended" moment, shown once when a session makes today count.
 * Old number rolls out, new number rolls in, today's dot pops, sparks fly.
 */
export function StreakCelebration({ before, after, goalHit, onDone }: { before: StreakInfo; after: StreakInfo; goalHit: boolean; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay();
  useEffect(() => {
    ref.current?.focus();
    const t = setTimeout(() => {
      playSound('streak');
      if (usePrefs.getState().haptics) platform().haptic('success');
    }, 300);
    return () => clearTimeout(t);
  }, []);
  const earnedFreeze = after.freezes > before.freezes;
  const milestone = milestoneLine(after.current);
  const first = after.current === 1;
  return (
    <div ref={ref} tabIndex={-1} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col items-center bg-bg px-6 text-center outline-none" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }} role="dialog" aria-modal="true" aria-labelledby="streak-title">
      <div className="flex w-full flex-1 flex-col items-center justify-center">
      <div className="relative">
        <span className="absolute inset-0 -z-10 rounded-full bg-flame opacity-25 blur-2xl" aria-hidden />
        <Flame size={112} className="text-flame" fill="currentColor" style={{ animation: 'ml-pop 600ms var(--ease-spring) both, ml-flicker 1.6s ease-in-out 700ms infinite' }} aria-hidden />
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute top-1/2 left-1/2 size-2 rounded-full"
            style={{ ['--a' as string]: `${i * 36}deg`, background: i % 2 ? 'var(--flame)' : 'var(--warn)', animation: `ml-spark 900ms var(--ease-out) ${420 + (i % 3) * 60}ms both` }}
          />
        ))}
      </div>
      <div className="relative mt-4 h-[4.5rem] overflow-hidden text-7xl leading-none font-bold text-flame-ink tnum" aria-hidden>
        {!first && <span className="absolute inset-x-0" style={{ animation: 'ml-count-out 380ms var(--ease-out) 450ms both' }}>{before.current}</span>}
        <span className="block" style={{ animation: 'ml-count-in 420ms var(--ease-spring) 520ms both' }}>
          {after.current}
        </span>
      </div>
      <h1 id="streak-title" className="mt-1 text-2xl font-bold">
        {first ? t('Streak started!') : tn(after.current, 'day streak!', 'day streak!')}
        <span className="sr-only"> {tn(after.current, '{n} day', '{n} days')}.</span>
      </h1>
      <p className="mt-1 max-w-[34ch] text-ink-2" style={{ animation: 'ml-rise 400ms var(--ease-out) 800ms both' }}>
        {milestone ?? (first ? t('Come back tomorrow to make it two.') : before.freezeUsed ? t('Your streak freeze saved it. Nice comeback!') : t('You practised today. See you tomorrow!'))}
      </p>
      <div className="mt-7 w-full max-w-sm rounded-[var(--radius-l)] bg-surface p-5 shadow-card" style={{ animation: 'ml-rise 400ms var(--ease-out) 650ms both' }}>
        <WeekStrip week={after.week} pop />
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2" style={{ animation: 'ml-rise 400ms var(--ease-out) 950ms both' }}>
        {goalHit && <span className="inline-flex h-8 items-center rounded-full bg-good-soft px-3 text-sm font-semibold text-good-ink">🎯 {t('Daily goal complete')}</span>}
        {earnedFreeze && (
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-freeze-soft px-3 text-sm font-semibold text-ink">
            <Snowflake size={14} className="text-freeze" aria-hidden /> {t('Streak freeze earned')}
          </span>
        )}
      </div>
      </div>
      <Button variant="primary" size="lg" className="w-full max-w-sm" onClick={onDone}>
        {t('Continue')}
      </Button>
    </div>
  );
}
