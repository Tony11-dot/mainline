import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarDays, ChevronRight, Target } from 'lucide-react';
import { dayIndex, usePlan } from '../../lib/plan';
import { practiceHref } from '../../lib/practice';
import { useWeakness } from '../../lib/useWeakness';
import { TaskRow } from '../PlanScreen';
import { evidenceText, planHref } from './WeakRow';
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
      <section className="mt-3 rounded-[var(--radius-l)] border border-line bg-surface p-4 shadow-1" aria-label={t('Study plan')}>
        <Link to="/plan" className="flex items-center gap-2">
          <CalendarDays size={18} className="text-brand" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink-3">{today >= plan.days ? t('Plan finished') : t('Day {day} of {days}', { day: Math.max(1, today + 1), days: plan.days })}</span>
            <span className="block truncate font-bold">{plan.title}</span>
          </span>
          <ChevronRight size={18} className="text-ink-3 rtl:rotate-180" aria-hidden />
        </Link>
        {tasks.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={() => toggle(task.id)} onStart={() => nav(practiceHref(task.scope, task.how))} />
            ))}
          </ul>
        )}
      </section>
    );
  }
  if (!top) return null;
  const label = top.kind === 'move' ? `${t('After')} ${top.context}` : t(top.label);
  return (
    <section className="mt-3 rounded-[var(--radius-l)] border border-line bg-surface p-4 shadow-1" aria-label={t('Work on this')}>
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-bad uppercase">
        <Target size={14} aria-hidden /> {t('Work on this')}
      </p>
      <p className="mt-1 font-bold">
        <bdi dir="ltr">{label}</bdi>
      </p>
      <p className="tnum text-sm text-ink-2">{evidenceText(top)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={practiceHref(top.scope, 'test')} className="inline-flex h-10 items-center rounded-[12px] bg-brand px-4 font-semibold text-on-brand">
          {t('Test me')}
        </Link>
        <Link to={planHref(top.scope, label)} className="inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-line px-4 font-semibold hover:bg-surface-2">
          <CalendarDays size={16} aria-hidden /> {t('Make a plan')}
        </Link>
        <Link to="/focus" className="inline-flex h-10 items-center rounded-[12px] px-3 font-semibold text-ink-2 hover:bg-surface-3">
          {t('All weak spots')}
        </Link>
      </div>
    </section>
  );
}
