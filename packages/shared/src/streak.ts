/**
 * Duolingo-style streaks, derived purely from the review log (so they sync with the reviews and need
 * no extra storage):
 * - Any practice on a local day keeps the streak alive for that day.
 * - Every 7 streak days earn a streak freeze (hold at most 2). A missed day spends one automatically.
 * - The streak is "at risk" until you practise today.
 */

const DAY = 86_400_000;

export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 250, 365, 500, 730, 1000];

export type DayMark = 'done' | 'frozen' | 'missed' | 'pending';

export interface StreakInfo {
  /** Days in the streak (frozen days keep it alive but don't count). 0 = no streak. */
  current: number;
  longest: number;
  doneToday: boolean;
  /** Freezes in hand right now. */
  freezes: number;
  /** Freezes in hand at the end of the last practised day (what reminder schedulers project from). */
  freezesAtLast: number;
  /** Streak alive but not yet extended today. */
  atRisk: boolean;
  /** Last 7 local days, oldest first; the last entry is today. */
  week: { day: number; mark: DayMark }[];
  /** A freeze was spent on the most recent missed day(s) since the last practice. */
  freezeUsed: boolean;
  nextMilestone: number;
}

/** Local day number (days since the epoch in the user's timezone). */
export const dayIndex = (t: number, tzOffsetMin = 0) => Math.floor((t - tzOffsetMin * 60_000) / DAY);

export function streakInfo(reviewTimes: number[], now: number, tzOffsetMin = 0): StreakInfo {
  const today = dayIndex(now, tzOffsetMin);
  const days = new Set(reviewTimes.map((t) => dayIndex(t, tzOffsetMin)));
  const marks = new Map<number, DayMark>();
  let streak = 0;
  let longest = 0;
  let freezes = 0;
  let freezesAtLast = 0;
  let freezeUsed = false;
  const first = days.size ? Math.min(...days) : today;
  for (let d = first; d <= today; d++) {
    if (days.has(d)) {
      streak++;
      longest = Math.max(longest, streak);
      if (streak % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      freezesAtLast = freezes;
      freezeUsed = false;
      marks.set(d, 'done');
    } else if (d === today) {
      marks.set(d, 'pending');
    } else if (streak > 0 && freezes > 0) {
      freezes--;
      freezeUsed = true;
      marks.set(d, 'frozen');
    } else {
      streak = 0;
      freezeUsed = false;
      marks.set(d, 'missed');
    }
  }
  const doneToday = days.has(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = today - 6 + i;
    return { day, mark: marks.get(day) ?? (day === today ? 'pending' : 'missed') };
  });
  return {
    current: streak,
    longest,
    doneToday,
    freezes,
    freezesAtLast,
    atRisk: streak > 0 && !doneToday,
    week,
    freezeUsed: freezeUsed && streak > 0,
    nextMilestone: STREAK_MILESTONES.find((m) => m > streak) ?? Math.ceil((streak + 1) / 100) * 100,
  };
}

/** Days between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a: string, b: string) {
  const t = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((t(b) - t(a)) / DAY);
}

/**
 * Projects a streak forward to `date` assuming no practice since `lastReviewDay` — used by the push
 * server and the on-device scheduler to word reminders for days the app isn't opened.
 */
export function streakOn(s: { streak: number; freezesAtLast: number; lastReviewDay: string | null }, date: string) {
  if (!s.lastReviewDay) return { streak: 0, freezeUsed: false, away: null as number | null, doneToday: false };
  const away = daysBetween(s.lastReviewDay, date);
  if (away <= 0) return { streak: s.streak, freezeUsed: false, away: 0, doneToday: true };
  const missed = away - 1;
  const alive = s.streak > 0 && missed <= s.freezesAtLast;
  return { streak: alive ? s.streak : 0, freezeUsed: alive && missed > 0, away, doneToday: false };
}

export type NudgeKind = 'daily' | 'nudge' | 'late' | 'comeback' | 'weekly';
export interface NudgeCtx {
  streak: number;
  due: number;
  /** Days since the last practice (null = never practised). */
  away: number | null;
  freezeUsed: boolean;
  /** Rotates the wording day to day (e.g. the local day number). */
  seed: number;
}

/** Days after the last practice on which a lapsed player hears from us. Then we stop. */
export const COMEBACK_DAYS = [2, 3, 5, 7, 14, 30];

const pick = <T>(xs: T[], seed: number) => xs[((seed % xs.length) + xs.length) % xs.length]!;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Reminder wording. Short, specific, a little cheeky — never guilt-heavy. */
export function nudgeText(kind: NudgeKind, c: NudgeCtx): { title: string; body: string } {
  const mins = Math.max(1, Math.round((c.due * 8) / 60));
  const due = plural(c.due, 'position');
  const s = c.streak;
  switch (kind) {
    case 'daily':
      if (c.freezeUsed && s > 0) return { title: '❄️ Streak freeze used', body: `Your ${s}-day streak survived yesterday. Train today to keep it going.` };
      if (s > 0 && c.due > 0)
        return pick(
          [
            { title: `🔥 Day ${s + 1} is waiting`, body: `${due} due · about ${mins} min.` },
            { title: `${due} due`, body: `About ${mins} min to keep your ${s}-day streak alive.` },
            { title: 'Your openings called', body: `${due} want a quick look. Keep the ${s}-day streak going.` },
            { title: `Keep the flame lit 🔥`, body: `${s} days strong. ${due} due today.` },
          ],
          c.seed,
        );
      if (s > 0) return pick([{ title: `🔥 ${s}-day streak`, body: 'Nothing due — learn one new move to make it one more.' }, { title: 'Quick one today?', body: `Learn a new move or drill a line to keep your ${s}-day streak.` }], c.seed);
      return pick(
        [
          { title: `${due} due`, body: `About ${mins} min to keep your openings sharp.` },
          { title: 'Time for your openings', body: `${due} ready for review. Start a streak today.` },
        ],
        c.seed,
      );
    case 'nudge':
      return pick(
        [
          { title: `Your ${s}-day streak is at risk`, body: 'A two-minute review keeps it alive.' },
          { title: `Don't let ${s} days slip`, body: c.due ? `${due} due. Two minutes is enough.` : 'One quick drill keeps the streak.' },
          { title: '🔥 Still time today', body: `Protect your ${s}-day streak before midnight.` },
        ],
        c.seed,
      );
    case 'late':
      return pick(
        [
          { title: `⏳ Last call for your ${s}-day streak`, body: 'About 90 minutes left today. One line is enough.' },
          { title: `${s} days on the line`, body: 'Play one line before midnight to save your streak.' },
        ],
        c.seed,
      );
    case 'comeback': {
      const a = c.away ?? 0;
      if (a >= 14) return { title: 'Your repertoire misses you', body: c.due ? `${due} are waiting. Five minutes gets you back on track.` : 'Five minutes gets you back on track.' };
      if (a >= 5) return { title: 'Openings fade without practice', body: c.due ? `${due} are slipping. A quick review brings them back.` : 'A quick review brings them back.' };
      return pick(
        [
          { title: 'Start a new streak today', body: c.due ? `${due} due. Day 1 starts with one line.` : 'Day 1 starts with one line.' },
          { title: 'Ready for a comeback?', body: c.due ? `${due} are waiting for you.` : 'Your repertoire is waiting for you.' },
        ],
        c.seed,
      );
    }
    case 'weekly':
      return { title: 'Your week in openings', body: s > 0 ? `${s}-day streak · ${due} due now.` : `${due} are waiting for you.` };
  }
}

export interface DayNudge {
  kind: NudgeKind;
  /** Local minutes after midnight. */
  minutes: number;
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * Every reminder due on a local `date` if the player doesn't practise first. Shared by the push server
 * (web) and the on-device scheduler (iOS/Android/desktop), so both say the same thing at the same time.
 * Duolingo-style escalation for a live streak: the daily reminder, a 20:30 nudge, a 22:30 last call
 * (3+ day streaks). Lapsed players get a comeback note on a thinning schedule, then silence.
 */
export function nudgesForDay(o: { streak: number; freezesAtLast: number; lastReviewDay: string | null; date: string; due: number; reminderMinutes: number; sunday?: boolean }): DayNudge[] {
  const s = streakOn(o, o.date);
  if (s.doneToday) return [];
  const ctx: NudgeCtx = { streak: s.streak, due: o.due, away: s.away, freezeUsed: s.freezeUsed, seed: daysBetween('2026-01-01', o.date) };
  const url = o.due > 0 ? '/train?mode=review' : '/';
  const make = (kind: NudgeKind, minutes: number, tag: string): DayNudge => ({ kind, minutes, ...nudgeText(kind, ctx), url, tag });
  const out: DayNudge[] = [];
  if (s.streak > 0 || (o.due > 0 && (s.away === null || s.away <= 1))) out.push(make('daily', o.reminderMinutes, 'due'));
  else if (s.away !== null && COMEBACK_DAYS.includes(s.away)) out.push(make('comeback', o.reminderMinutes, 'due'));
  if (s.streak > 0) out.push(make('nudge', 20 * 60 + 30, 'streak'));
  if (s.streak >= 3) out.push(make('late', 22 * 60 + 30, 'streak'));
  if (o.sunday && (s.streak > 0 || o.due > 0) && (s.away ?? 99) <= 7) out.push(make('weekly', 18 * 60, 'weekly'));
  return out;
}
