import { describe, expect, it } from 'vitest';
import { plannedNotifications } from './reminders';

const plan = { enabled: true, time: '19:00', dueCount: 5, streakDays: 6, freezesAtLast: 1, lastReviewDay: '2026-09-23', dueByDay: [6, 7, 8, 9, 10, 11, 12] };
const now = new Date(2026, 8, 24, 9, 0); // 09:00 local, the day after the last practice

describe('plannedNotifications', () => {
  it('escalates today and projects the streak (with its freeze) forward', () => {
    const list = plannedNotifications(plan, now);
    const today = list.filter((n) => n.at.getDate() === 24).map((n) => [n.kind, n.at.getHours()]);
    expect(today).toEqual([['daily', 19], ['nudge', 20], ['late', 22]]);
    // Tomorrow the freeze covers today → the streak is still alive, and the reminder says so.
    const tomorrow = list.filter((n) => n.at.getDate() === 25);
    expect(tomorrow[0]?.title).toMatch(/freeze/i);
    // The day after, the streak is gone: day 3 away gets a comeback note and no streak nudges.
    expect(list.filter((n) => n.at.getDate() === 26).map((n) => n.kind)).toEqual(['comeback']);
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length);
  });
  it('schedules nothing more for today after practice', () => {
    const list = plannedNotifications({ ...plan, lastReviewDay: '2026-09-24', streakDays: 7 }, now);
    expect(list.some((n) => n.at.getDate() === 24)).toBe(false);
    expect(list.filter((n) => n.at.getDate() === 25).map((n) => n.kind)).toEqual(['daily', 'nudge', 'late']);
  });
  it('skips times that have already passed', () => {
    const late = new Date(2026, 8, 24, 21, 0);
    expect(plannedNotifications(plan, late).filter((n) => n.at.getDate() === 24).map((n) => n.kind)).toEqual(['late']);
  });
});
