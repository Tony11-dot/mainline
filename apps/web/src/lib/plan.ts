import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { practiceHref, type Practice, type Scope } from './practice';
import { uid } from './library';

/**
 * A study plan: a focus (anything from one line to everything), a number of days and a daily budget, turned
 * into concrete sessions per day. Sessions tick themselves off when you finish them; you can also tick,
 * remove or add them by hand.
 */
export interface PlanTask {
  id: string;
  day: number;
  how: Practice;
  scope: Scope;
  label: string;
  done?: boolean;
}

export interface Plan {
  id: string;
  title: string;
  focus: { scope: Scope; label: string };
  /** Local date the plan starts, YYYY-MM-DD. */
  start: string;
  days: number;
  minutes: number;
  tasks: PlanTask[];
}

export interface PlanOptions {
  focus: { scope: Scope; label: string };
  days: number;
  minutes: number;
  kinds: Record<'show' | 'test' | 'quiz' | 'learn', boolean>;
  /** Parts of the focus, weakest first (lines, sub-openings or moves), to rotate through. */
  weakParts: { scope: Scope; label: string }[];
  /** The focus still has moves you haven't learned. */
  unlearned: boolean;
  start?: Date;
}

export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Which day of the plan today is (0-based); can be past the end. */
export function dayIndex(plan: Pick<Plan, 'start'>, now = new Date()): number {
  const [y, m, d] = plan.start.split('-').map(Number);
  const start = new Date(y!, m! - 1, d!);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Day 1 shows the moves (and teaches what's new), then tests the whole focus. The middle days work through the
 * weakest parts, one or two a day, with position quizzes in between. The last day is an exam on everything.
 */
export function makePlan(o: PlanOptions): Plan {
  const perDay = Math.max(1, Math.min(4, Math.round(o.minutes / 10)));
  const tasks: PlanTask[] = [];
  const push = (day: number, how: Practice, scope: Scope, label: string) => {
    if (how in o.kinds && !o.kinds[how as keyof PlanOptions['kinds']]) return;
    if (tasks.filter((x) => x.day === day).length >= perDay + 1) return;
    if (tasks.some((x) => x.day === day && x.how === how && JSON.stringify(x.scope) === JSON.stringify(scope))) return;
    tasks.push({ id: uid(), day, how, scope, label });
  };
  const f = o.focus;
  const parts = o.weakParts.length ? o.weakParts : [f];
  let next = 0;
  const part = () => parts[next++ % parts.length]!;

  for (let day = 0; day < o.days; day++) {
    const last = day === o.days - 1 && o.days > 1;
    if (day === 0) {
      push(day, 'show', f.scope, f.label);
      if (o.unlearned) push(day, 'learn', f.scope, f.label);
      push(day, 'test', f.scope, f.label);
    } else if (last) {
      push(day, 'test', f.scope, f.label);
      push(day, 'quiz', f.scope, f.label);
    } else {
      const p = part();
      if (day % 2 === 1) push(day, 'show', p.scope, p.label);
      push(day, 'test', p.scope, p.label);
      if (o.unlearned) push(day, 'learn', f.scope, f.label);
      push(day, 'quiz', f.scope, f.label);
      if (perDay >= 3) {
        const q = part();
        push(day, 'test', q.scope, q.label);
      }
    }
    // Always something to do, whatever was switched off.
    if (!tasks.some((x) => x.day === day)) tasks.push({ id: uid(), day, how: 'test', scope: f.scope, label: f.label });
    // Keep to the budget (the exam day may run one over).
    const today = tasks.filter((x) => x.day === day);
    for (const extra of today.slice(perDay + (last ? 1 : 0))) tasks.splice(tasks.indexOf(extra), 1);
  }
  return { id: uid(), title: f.label, focus: f, start: localDay(o.start), days: o.days, minutes: o.minutes, tasks };
}

/** The URL behind a session's query string, reduced to what identifies its kind and scope. */
export function sessionKey(params: URLSearchParams): string {
  const mode = params.get('mode');
  const how = mode === 'learn' && params.get('show') === '1' ? 'show' : mode === 'drill' ? 'test' : mode;
  const at = params.get('at');
  const scope = at ? `at:${params.get('color')}:${at}` : params.get('folder') ? `folder:${params.get('folder')}` : params.get('reps') ? `rep:${params.get('reps')}` : params.get('color') ? `color:${params.get('color')}` : 'all';
  return `${how}|${scope}`;
}

export const taskKey = (t: Pick<PlanTask, 'how' | 'scope'>) => sessionKey(new URL(practiceHref(t.scope, t.how), 'https://x').searchParams);

interface PlanState {
  plan: Plan | null;
  setPlan: (p: Plan | null) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  addTask: (t: Omit<PlanTask, 'id'>) => void;
  /** A session finished: tick the matching task, today's first, else the earliest one still open. */
  completed: (params: URLSearchParams) => void;
}

export const usePlan = create<PlanState>()(
  persist(
    (set, get) => ({
      plan: null,
      setPlan: (plan) => set({ plan }),
      toggle: (id) => set((s) => (s.plan ? { plan: { ...s.plan, tasks: s.plan.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) } } : s)),
      remove: (id) => set((s) => (s.plan ? { plan: { ...s.plan, tasks: s.plan.tasks.filter((t) => t.id !== id) } } : s)),
      addTask: (t) => set((s) => (s.plan ? { plan: { ...s.plan, tasks: [...s.plan.tasks, { ...t, id: uid() }].sort((a, b) => a.day - b.day) } } : s)),
      completed: (params) => {
        const plan = get().plan;
        if (!plan) return;
        const key = sessionKey(params);
        const today = dayIndex(plan);
        const open = plan.tasks.filter((t) => !t.done && t.day <= today && taskKey(t) === key);
        const hit = open.find((t) => t.day === today) ?? open[0];
        if (hit) set({ plan: { ...plan, tasks: plan.tasks.map((t) => (t.id === hit.id ? { ...t, done: true } : t)) } });
      },
    }),
    {
      name: 'mainline.plan',
      storage: {
        getItem: (k) => {
          try {
            const v = localStorage.getItem(k);
            return v ? JSON.parse(v) : null;
          } catch {
            return null;
          }
        },
        setItem: (k, v) => {
          try {
            localStorage.setItem(k, JSON.stringify(v));
          } catch {
            /* private mode: the plan lasts this visit */
          }
        },
        removeItem: (k) => {
          try {
            localStorage.removeItem(k);
          } catch {
            /* ignore */
          }
        },
      },
    },
  ),
);
