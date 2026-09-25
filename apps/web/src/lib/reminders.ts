/**
 * Keeps reminders in step with local training data: Web Push on the web (the server needs the due
 * count), local notifications scheduled on-device in the native apps (no server involved).
 */
import { nudgesForDay, streakInfo, trainingSummary, type DayNudge } from '@mainline/shared';
import { platform, type ReminderPlan } from '../platform';
import { useLibrary } from './library';
import { useTraining } from './training';
import { usePrefs } from './prefs';

const DAY = 86_400_000;
const localDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function currentPlan(now = Date.now()): ReminderPlan {
  const { remindersOn, reminderTime, dailyNewLimit } = usePrefs.getState();
  const lib = useLibrary.getState();
  const tr = useTraining.getState();
  const data = { reps: lib.reps, moves: lib.moves };
  const sum = trainingSummary(data, tr.cards, now, dailyNewLimit, 0);
  const times = tr.reviews.map((r) => r.reviewedAt);
  const last = times.length ? Math.max(...times) : null;
  // Due counts for the next 7 days at the reminder time (cards only become more due over time).
  const [h, m] = reminderTime.split(':').map(Number);
  const dueByDay = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const at = new Date(now + d * DAY);
    at.setHours(h ?? 19, m ?? 0, 0, 0);
    return tr.cards.filter((c) => !c.deleted && c.due <= at.getTime()).length;
  });
  const streak = streakInfo(times, now, new Date().getTimezoneOffset());
  return {
    enabled: remindersOn,
    time: reminderTime,
    dueCount: sum.due,
    streakDays: streak.current,
    freezesAtLast: streak.freezesAtLast,
    lastReviewDay: last ? localDay(last) : null,
    dueByDay,
  };
}

/**
 * Every reminder for today and the next 7 days, as local times — for platforms that schedule on the
 * device. Re-planned whenever training changes or the app opens, so practising cancels the rest.
 */
export function plannedNotifications(plan: ReminderPlan, now = new Date()): (DayNudge & { id: number; at: Date })[] {
  const [h, m] = plan.time.split(':').map(Number);
  const out: (DayNudge & { id: number; at: Date })[] = [];
  for (let k = 0; k <= 7; k++) {
    const day = new Date(now);
    day.setDate(day.getDate() + k);
    day.setHours(0, 0, 0, 0);
    const nudges = nudgesForDay({
      streak: plan.streakDays,
      freezesAtLast: plan.freezesAtLast,
      lastReviewDay: plan.lastReviewDay,
      date: localDay(day.getTime()),
      due: k === 0 ? plan.dueCount : (plan.dueByDay[k - 1] ?? plan.dueCount),
      reminderMinutes: (h ?? 19) * 60 + (m ?? 0),
    });
    nudges.forEach((n, slot) => {
      const at = new Date(day);
      at.setHours(Math.floor(n.minutes / 60), n.minutes % 60, 0, 0);
      if (at > now) out.push({ ...n, id: 1000 + k * 10 + slot, at });
    });
  }
  return out;
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function refreshReminders(delay = 1500) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const plan = currentPlan();
    if (!plan.enabled && !usePrefs.getState().remindersEverEnabled) return;
    void platform().scheduleReminders(plan).catch(() => undefined);
  }, delay);
}

export function startReminderSync() {
  useTraining.subscribe((s, p) => s.version !== p.version && refreshReminders());
  usePrefs.subscribe((s, p) => (s.remindersOn !== p.remindersOn || s.reminderTime !== p.reminderTime) && refreshReminders(100));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshReminders());
  refreshReminders(4000);
}
