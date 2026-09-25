import { describe, expect, it } from 'vitest';
import { COMEBACK_DAYS, daysBetween, nudgeText, streakInfo, streakOn } from './streak';

const D = 86_400_000;
const now = Date.UTC(2026, 8, 24, 12); // noon, UTC
const on = (...daysAgo: number[]) => daysAgo.map((a) => now - a * D);

describe('streakInfo', () => {
  it('counts consecutive days and waits for today', () => {
    expect(streakInfo(on(0, 1, 2), now)).toMatchObject({ current: 3, doneToday: true, atRisk: false });
    expect(streakInfo(on(1, 2), now)).toMatchObject({ current: 2, doneToday: false, atRisk: true });
    expect(streakInfo([], now)).toMatchObject({ current: 0, longest: 0, atRisk: false, freezes: 0 });
  });
  it('breaks without a freeze', () => {
    expect(streakInfo(on(2, 3, 4), now)).toMatchObject({ current: 0, longest: 3 });
  });
  it('earns a freeze every 7 days and spends it on a missed day', () => {
    const week = on(2, 3, 4, 5, 6, 7, 8); // 7 days, then yesterday missed
    const s = streakInfo(week, now);
    expect(s).toMatchObject({ current: 7, freezes: 0, freezesAtLast: 1, freezeUsed: true, atRisk: true });
    expect(s.week.map((w) => w.mark)).toEqual(['done', 'done', 'done', 'done', 'done', 'frozen', 'pending']);
    // Practising today continues the streak through the frozen day.
    expect(streakInfo([...week, now], now)).toMatchObject({ current: 8, freezeUsed: false, doneToday: true });
    // Two missed days with one freeze: gone.
    expect(streakInfo(on(3, 4, 5, 6, 7, 8, 9), now).current).toBe(0);
  });
  it('holds at most two freezes', () => {
    const days = Array.from({ length: 30 }, (_, i) => i);
    expect(streakInfo(on(...days), now)).toMatchObject({ current: 30, freezes: 2 });
  });
  it('respects the local timezone', () => {
    // 23:30 local (UTC+3 → 20:30 UTC) and 00:30 local next day are different local days.
    const a = Date.UTC(2026, 8, 23, 20, 30);
    const b = Date.UTC(2026, 8, 23, 21, 30);
    expect(streakInfo([a, b], b, -180).current).toBe(2);
    expect(streakInfo([a, b], b, 0).current).toBe(1);
  });
  it('names the next milestone', () => {
    expect(streakInfo(on(0, 1, 2), now).nextMilestone).toBe(7);
    expect(streakInfo(on(0), now).nextMilestone).toBe(3);
  });
});

describe('streakOn (projection for reminders)', () => {
  const s = { streak: 9, freezesAtLast: 1, lastReviewDay: '2026-09-20' };
  it('projects forward without practice', () => {
    expect(daysBetween('2026-09-20', '2026-09-22')).toBe(2);
    expect(streakOn(s, '2026-09-20')).toMatchObject({ streak: 9, doneToday: true, away: 0 });
    expect(streakOn(s, '2026-09-21')).toMatchObject({ streak: 9, freezeUsed: false, away: 1 });
    expect(streakOn(s, '2026-09-22')).toMatchObject({ streak: 9, freezeUsed: true, away: 2 });
    expect(streakOn(s, '2026-09-23')).toMatchObject({ streak: 0, away: 3 });
    expect(streakOn({ ...s, lastReviewDay: null }, '2026-09-23')).toMatchObject({ streak: 0, away: null });
  });
});

describe('nudgeText', () => {
  const ctx = { streak: 5, due: 12, away: 1, freezeUsed: false, seed: 0 };
  it('mentions the streak and the due count', () => {
    for (let seed = 0; seed < 6; seed++) {
      const t = nudgeText('daily', { ...ctx, seed });
      expect(`${t.title} ${t.body}`).toMatch(/12 positions|5-day|5 days|Day 6/);
    }
    expect(nudgeText('nudge', ctx).title).toMatch(/5/);
    expect(nudgeText('late', ctx).title).toMatch(/5/);
  });
  it('announces a used freeze', () => {
    expect(nudgeText('daily', { ...ctx, freezeUsed: true }).title).toMatch(/freeze/i);
  });
  it('has comeback wording for every comeback day', () => {
    for (const away of COMEBACK_DAYS) expect(nudgeText('comeback', { ...ctx, streak: 0, away }).title.length).toBeGreaterThan(5);
  });
  it('handles singulars', () => {
    expect(nudgeText('daily', { ...ctx, streak: 0, due: 1 }).title).toBe('1 position due');
  });
});
