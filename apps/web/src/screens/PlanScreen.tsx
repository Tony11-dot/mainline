import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, CalendarDays, Check, Eye, GraduationCap, ListChecks, Play, Shuffle, Target, Trash2, X } from 'lucide-react';
import { isReadyMade } from '@mainline/shared';
import { useLibrary } from '../lib/library';
import { useTraining } from '../lib/training';
import { useWeakness, scopeReps, weakPartsOf } from '../lib/useWeakness';
import { dayIndex, makePlan, usePlan, type Plan, type PlanTask } from '../lib/plan';
import { practiceHref, type Practice, type Scope } from '../lib/practice';
import { scopeProgress } from './library/practiceUi';
import { Sheet, Field, inputCls } from '../ui/Sheet';
import { Button, PanelNote, Segmented } from '../ui/primitives';
import { WeakRow } from './focus/WeakRow';
import { intlLocale, msg, t, tn } from '../lib/i18n';

const HOW: Record<Practice, { label: string; icon: typeof Eye }> = {
  show: { label: msg('Show me'), icon: Eye },
  test: { label: msg('Test me'), icon: Target },
  quiz: { label: msg('Position quiz'), icon: Shuffle },
  learn: { label: msg('Learn new moves'), icon: GraduationCap },
  review: { label: msg('Review'), icon: ListChecks },
};

/**
 * Your study plan: the focus, the days, and each day's sessions (ticked off as you finish them). Without one,
 * the screen suggests where to focus and builds one in two taps — fully adjustable.
 */
export function PlanScreen() {
  const [params, setParams] = useSearchParams();
  const plan = usePlan((s) => s.plan);
  const { report } = useWeakness();
  const [builder, setBuilder] = useState<{ scope: Scope; label: string } | null>(null);

  // Arriving with ?new=1&scope=…&label=… opens the builder for that focus.
  useEffect(() => {
    if (params.get('new') !== '1') return;
    try {
      const scope = JSON.parse(params.get('scope') ?? '') as Scope;
      setBuilder({ scope, label: params.get('label') ?? t('Everything') });
    } catch {
      setBuilder({ scope: { kind: 'all' }, label: t('Everything') });
    }
    setParams({}, { replace: true });
  }, [params, setParams]);

  const suggestions = useMemo(() => (report ? [...report.moves, ...report.folders, ...report.lines].filter((x) => x.badness >= 1.15).sort((a, b) => b.badness - a.badness).slice(0, 3) : []), [report]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center gap-2">
        <Link to="/" className="-ms-2 flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3" aria-label={t('Back')}>
          <ArrowLeft size={20} className="rtl:rotate-180" />
        </Link>
        <h1 className="flex-1 text-2xl font-bold">{t('Study plan')}</h1>
        <Button variant={plan ? 'secondary' : 'primary'} icon={CalendarDays} onClick={() => setBuilder(plan ? plan.focus : { scope: { kind: 'all' }, label: t('Everything') })}>
          {plan ? t('New plan') : t('Make a plan')}
        </Button>
      </div>

      {plan ? (
        <PlanView plan={plan} />
      ) : (
        <>
          <p className="mt-1 text-ink-2">{t('Pick what to work on, for how many days and how long each day. MainLine lays out the sessions — showing the moves first, then testing the weakest parts, then an exam.')}</p>
          {suggestions.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 px-1 text-sm font-semibold text-ink-2">{t('Suggested from your weak spots')}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-l)] border border-line bg-surface shadow-1">
                {suggestions.map((s) => (
                  <WeakRow key={s.kind + s.key} it={s} />
                ))}
              </ul>
            </section>
          )}
          {!suggestions.length && (
            <div className="mt-6 rounded-[var(--radius-l)] border border-dashed border-line-strong">
              <PanelNote icon={CalendarDays} title={t('No plan yet')} action={<Button variant="primary" onClick={() => setBuilder({ scope: { kind: 'all' }, label: t('Everything') })}>{t('Make a plan')}</Button>}>
                {t('Plan a few days on your whole repertoire, one colour, an opening, a line or the answers to one move.')}
              </PanelNote>
            </div>
          )}
        </>
      )}
      <PlanBuilder initial={builder} onClose={() => setBuilder(null)} />
    </div>
  );
}

function PlanView({ plan }: { plan: Plan }) {
  const nav = useNavigate();
  const { toggle, remove, setPlan } = usePlan();
  const today = dayIndex(plan);
  const done = plan.tasks.filter((t) => t.done).length;
  const over = today >= plan.days;
  const startDate = useMemo(() => {
    const [y, m, d] = plan.start.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  }, [plan.start]);
  const dateOf = (day: number) => new Date(startDate.getTime() + day * 86_400_000).toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <>
      <div className="mt-5 rounded-[var(--radius-l)] border border-line bg-surface p-4 shadow-1">
        <p className="text-xs font-semibold text-ink-3">{tn(plan.days, '{n}-day plan', '{n}-day plan')} · {tn(plan.minutes, '{n} min a day', '{n} min a day')}</p>
        <h2 className="mt-0.5 text-xl font-bold">{plan.title}</h2>
        <p className="tnum mt-1 text-sm text-ink-2">{over ? t('Plan finished — {done} of {total} sessions done.', { done, total: plan.tasks.length }) : t('Day {day} of {days} · {done} of {total} sessions done', { day: Math.max(1, today + 1), days: plan.days, done, total: plan.tasks.length })}</p>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={plan.tasks.length} aria-valuenow={done} aria-label={t('Plan progress')}>
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${plan.tasks.length ? (done / plan.tasks.length) * 100 : 0}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            onClick={() => {
              if (confirm(t('End this plan?'))) setPlan(null);
            }}
          >
            {t('End plan')}
          </Button>
        </div>
      </div>

      <ol className="mt-5 flex flex-col gap-3">
        {Array.from({ length: plan.days }, (_, day) => {
          const tasks = plan.tasks.filter((x) => x.day === day);
          const isToday = day === today;
          return (
            <li key={day} className={`rounded-[var(--radius-l)] border bg-surface p-3.5 shadow-1 ${isToday ? 'border-brand ring-1 ring-brand' : 'border-line'} ${day < today ? 'opacity-80' : ''}`}>
              <h3 className="flex items-baseline gap-2 font-bold">
                {t('Day {n}', { n: day + 1 })}
                <span className="text-sm font-medium text-ink-3">{isToday ? t('Today') : dateOf(day)}</span>
                {tasks.length > 0 && tasks.every((x) => x.done) && <Check size={16} className="text-good" aria-label={t('Done')} />}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={() => toggle(task.id)} onRemove={() => remove(task.id)} onStart={() => nav(practiceHref(task.scope, task.how))} />
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function TaskRow({ task, onToggle, onRemove, onStart }: { task: PlanTask; onToggle: () => void; onRemove?: () => void; onStart: () => void }) {
  const H = HOW[task.how];
  return (
    <li className="flex items-center gap-2.5 rounded-[12px] bg-surface-2 px-2.5 py-2">
      <button type="button" role="checkbox" aria-checked={!!task.done} aria-label={t(H.label)} onClick={onToggle} className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${task.done ? 'border-good bg-good text-white' : 'border-line-strong'}`}>
        {task.done && <Check size={14} aria-hidden />}
      </button>
      <H.icon size={16} className="shrink-0 text-ink-2" aria-hidden />
      <span className={`min-w-0 flex-1 text-sm ${task.done ? 'text-ink-3 line-through' : ''}`}>
        <span className="font-semibold">{t(H.label)}</span> · <bdi>{task.label}</bdi>
      </span>
      {!task.done && (
        <button type="button" onClick={onStart} className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-brand px-2.5 text-sm font-semibold text-on-brand">
          <Play size={13} fill="currentColor" aria-hidden /> {t('Start')}
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={t('Remove')} className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-bad">
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </li>
  );
}

/* ---------------- Builder ---------------- */

const DAYS = ['3', '5', '7', '10', '14'] as const;
const MINUTES = ['10', '20', '30', '45'] as const;

function PlanBuilder({ initial, onClose }: { initial: { scope: Scope; label: string } | null; onClose: () => void }) {
  const lib = useLibrary();
  const cards = useTraining((s) => s.cards);
  const { report } = useWeakness();
  const nav = useNavigate();
  const [focus, setFocus] = useState<{ scope: Scope; label: string }>({ scope: { kind: 'all' }, label: t('Everything') });
  const [days, setDays] = useState<(typeof DAYS)[number]>('5');
  const [minutes, setMinutes] = useState<(typeof MINUTES)[number]>('20');
  const [kinds, setKinds] = useState({ show: true, test: true, quiz: true, learn: true });
  useEffect(() => {
    if (initial) setFocus(initial);
  }, [initial]);

  // Everything you can focus on: suggestions, whole sides, every folder and line.
  const options = useMemo(() => {
    const out: { group: string; scope: Scope; label: string }[] = [];
    for (const s of report ? [...report.moves, ...report.folders, ...report.lines].filter((x) => x.badness >= 1.15).sort((a, b) => b.badness - a.badness).slice(0, 4) : []) out.push({ group: t('Suggested'), scope: s.scope, label: s.kind === 'move' ? `${t('After')} ${s.context}` : t(s.label) });
    out.push({ group: t('Whole repertoire'), scope: { kind: 'all' }, label: t('Everything') });
    out.push({ group: t('Whole repertoire'), scope: { kind: 'color', color: 'white' }, label: t('As White') });
    out.push({ group: t('Whole repertoire'), scope: { kind: 'color', color: 'black' }, label: t('As Black') });
    const live = lib.folders.filter((f) => !f.deleted);
    const pathOf = (id: string | null): string => {
      const f = live.find((x) => x.id === id);
      if (!f) return '';
      if (f.parentId === null) return f.color === 'white' ? t('As White') : t('As Black');
      return `${pathOf(f.parentId)} › ${t(f.name)}`;
    };
    for (const f of live.filter((x) => x.parentId !== null)) out.push({ group: t('Folders'), scope: { kind: 'folder', id: f.id }, label: pathOf(f.id) });
    for (const r of lib.reps.filter((x) => !x.deleted)) out.push({ group: t('Lines'), scope: { kind: 'rep', id: r.id }, label: `${pathOf(r.folderId)} › ${r.name}` });
    if (initial && !out.some((o) => JSON.stringify(o.scope) === JSON.stringify(initial.scope))) out.unshift({ group: t('Chosen'), scope: initial.scope, label: initial.label });
    return out;
  }, [report, lib.folders, lib.reps, initial]);
  const groups = [...new Set(options.map((o) => o.group))];
  const value = options.findIndex((o) => JSON.stringify(o.scope) === JSON.stringify(focus.scope));

  const reps = useMemo(() => (initial ? scopeReps(focus.scope) : []), [focus, initial, lib.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = scopeProgress(reps, lib.moves, cards);

  const create = () => {
    const parts = report ? weakPartsOf(report, focus.scope).slice(0, 4).map((p) => ({ scope: p.scope, label: p.kind === 'move' ? `${t('After')} ${p.context}` : t(p.label) })) : [];
    // No evidence yet: rotate through the lines themselves, ready-made ones first.
    const fallback = reps
      .slice()
      .sort((a, b) => Number(isReadyMade(b)) - Number(isReadyMade(a)))
      .slice(0, 4)
      .map((r) => ({ scope: { kind: 'rep', id: r.id } as Scope, label: r.name }));
    usePlan.getState().setPlan(makePlan({ focus, days: Number(days), minutes: Number(minutes), kinds, weakParts: parts.length ? parts : reps.length > 1 ? fallback : [], unlearned: progress.learned < progress.positions }));
    onClose();
    nav('/plan');
  };

  return (
    <Sheet
      open={!!initial}
      onClose={onClose}
      title={t('Make a plan')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={create} disabled={!reps.length}>
            {t('Create plan')}
          </Button>
        </>
      }
    >
      <Field label={t('Work on')} hint={reps.length ? `${tn(reps.length, '{n} line', '{n} lines')} · ${t('{learned} of {total} positions learned', { learned: progress.learned, total: progress.positions })}` : t('Nothing to practise here yet.')}>
        <select className={inputCls} value={value} onChange={(e) => setFocus(options[Number(e.target.value)]!)} aria-label={t('Work on')}>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {options.map((o, i) => (o.group === g ? <option key={i} value={i}>{o.label}</option> : null))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label={t('Days')} group>
        <Segmented label={t('Days')} value={days} onChange={setDays} options={DAYS.map((d) => ({ value: d, label: d }))} />
      </Field>
      <Field label={t('Minutes a day')} group>
        <Segmented label={t('Minutes a day')} value={minutes} onChange={setMinutes} options={MINUTES.map((m) => ({ value: m, label: m }))} />
      </Field>
      <Field label={t('Sessions to include')} group>
        <div className="flex flex-wrap gap-2">
          {(['show', 'test', 'quiz', 'learn'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kinds[k]}
              onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}
              className={`h-9 rounded-full px-3.5 text-sm font-semibold ${kinds[k] ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2'}`}
            >
              {t(HOW[k].label)}
            </button>
          ))}
        </div>
      </Field>
    </Sheet>
  );
}
