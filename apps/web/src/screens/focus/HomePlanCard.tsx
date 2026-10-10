import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarDays, ChevronRight, Target } from 'lucide-react';
import { dayIndex, usePlan } from '../../lib/plan';
import { practiceHref } from '../../lib/practice';
import { useWeakness } from '../../lib/useWeakness';
import { TaskRow } from '../PlanScreen';
import { evidenceText, planHref } from './WeakRow';
import { Card, Pill } from '../../ui/kit';
import { t } from '../../lib/i18n';

/** Today: the plan's sessions for today, or — with no plan — the one thing your numbers say to work on. */
export function HomePlanCard() {
  const plan = usePlan((s) => s.plan);
  const toggle = usePlan((s) => s.toggle);
  const nav = useNavigate();
  const { report } = useWeakness();
  const top = useMemo(() => (report ? [...report.moves, ...report.folders, ...report.lines].filter((x) => x.badness >= 1.15).sort((a, b) => b.badness - a.badness)[0] : undefined), [report]);

  if (plan) {
    const today = dayIndex(plan);
    const tasks = plan.tasks.filter((x) => x.day === today || (x.day < today && !x.done));
    return (
      <Card as="section" className="mt-3" aria-label={t('Study plan')}>
        <Link to="/plan" className="pressable -m-2 flex items-center gap-3 rounded-[var(--radius-m)] p-2 hover:bg-surface-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-s)] bg-brand-soft text-brand-ink" aria-hidden>
            <CalendarDays size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink-2">{today >= plan.days ? t('Plan finished') : t('Day {day} of {days}', { day: Math.max(1, today + 1), days: plan.days })}</span>
            <span className="block truncate text-md font-bold">{plan.title}</span>
          </span>
          <ChevronRight size={20} className="text-ink-3 rtl:rotate-180" aria-hidden />
        </Link>
        {tasks.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={() => toggle(task.id)} onStart={() => nav(practiceHref(task.scope, task.how))} />
            ))}
          </ul>
        )}
      </Card>
    );
  }
  if (!top) return null;
  const label = top.kind === 'move' ? `${t('After')} ${top.context}` : t(top.label);
  return (
    <Card as="section" className="mt-3" aria-label={t('Work on this')}>
      <Pill tone="bad" icon={Target}>
        {t('Work on this')}
      </Pill>
      <p className="mt-2.5 text-xl font-bold">
        <bdi dir="ltr">{label}</bdi>
      </p>
      <p className="tnum text-base text-ink-2">{evidenceText(top)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={practiceHref(top.scope, 'test')} className="pressable inline-flex h-11 items-center rounded-[var(--radius-control)] bg-brand px-4 font-semibold text-on-brand">
          {t('Test me')}
        </Link>
        <Link to={planHref(top.scope, label)} className="pressable inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-brand-soft px-4 font-semibold text-brand-ink hover:bg-brand-soft-2">
          <CalendarDays size={17} aria-hidden /> {t('Make a plan')}
        </Link>
        <Link to="/focus" className="pressable inline-flex h-11 items-center rounded-[var(--radius-control)] px-3 font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
          {t('All weak spots')}
        </Link>
      </div>
    </Card>
  );
}
