import { describe, expect, it } from 'vitest';
import { decide, localParts, tzOffsetMin, withSyncedStreak } from './push';

// Practised yesterday with a 4-day streak and no freezes.
const base = { timezone: 'Asia/Jerusalem', reminderTime: '19:00', dueCount: 12, streak: 4, freezes: 0, lastReviewDay: '2026-09-23', lastNotifiedOn: null, lastNudgeOn: null, lastWeeklyOn: null, lastLateOn: null };
// 2026-09-24 is a Thursday; Jerusalem is UTC+3 (IDT) → 19:02 local = 16:02 UTC.
const at = (iso: string) => new Date(iso);
const REMIND = at('2026-09-24T16:02:00Z');
const NUDGE = at('2026-09-24T17:31:00Z');
const LATE = at('2026-09-24T19:31:00Z');

describe('push schedule', () => {
  it('uses the device timezone', () => {
    expect(localParts(REMIND, 'Asia/Jerusalem')).toMatchObject({ date: '2026-09-24', minutes: 19 * 60 + 2 });
  });
  it('sends the daily reminder once, never after practice today', () => {
    expect(decide(base, REMIND)?.kind).toBe('daily');
    expect(decide(base, REMIND)?.url).toBe('/train?mode=review');
    expect(decide({ ...base, lastNotifiedOn: '2026-09-24' }, REMIND)).toBeNull();
    expect(decide({ ...base, lastReviewDay: '2026-09-24' }, REMIND)).toBeNull();
    expect(decide(base, at('2026-09-24T16:30:00Z'))).toBeNull();
  });
  it('keeps a live streak going even with nothing due', () => {
    const m = decide({ ...base, dueCount: 0 }, REMIND);
    expect(m?.kind).toBe('daily');
    expect(m?.url).toBe('/');
    expect(`${m?.title} ${m?.body}`).toMatch(/4-day/);
    expect(decide({ ...base, dueCount: 0, streak: 0 }, REMIND)).toBeNull();
  });
  it('escalates: 20:30 nudge, then 22:30 last call for 3+ day streaks', () => {
    expect(decide(base, NUDGE)?.kind).toBe('nudge');
    expect(decide({ ...base, lastNudgeOn: '2026-09-24' }, NUDGE)).toBeNull();
    expect(decide(base, LATE)?.kind).toBe('late');
    expect(decide({ ...base, streak: 2 }, LATE)).toBeNull();
    expect(decide({ ...base, lastLateOn: '2026-09-24' }, LATE)).toBeNull();
    expect(decide({ ...base, lastReviewDay: '2026-09-24' }, NUDGE)).toBeNull();
  });
  it('announces a used freeze and treats an expired streak as lapsed', () => {
    const frozen = decide({ ...base, lastReviewDay: '2026-09-22', freezes: 1 }, REMIND);
    expect(frozen?.title).toMatch(/freeze/i);
    // Two days away without a freeze → the streak is gone; day 2 gets a comeback note, no streak nudges.
    const lapsed = { ...base, lastReviewDay: '2026-09-22' };
    expect(decide(lapsed, REMIND)?.kind).toBe('comeback');
    expect(decide(lapsed, NUDGE)).toBeNull();
    // Day 4 away is not on the comeback schedule; day 5 is.
    expect(decide({ ...base, lastReviewDay: '2026-09-20' }, REMIND)).toBeNull();
    expect(decide({ ...base, lastReviewDay: '2026-09-19' }, REMIND)?.kind).toBe('comeback');
    expect(decide({ ...base, lastReviewDay: '2026-06-01' }, REMIND)).toBeNull();
  });
  it('reminds new players with cards due', () => {
    expect(decide({ ...base, streak: 0, lastReviewDay: null }, REMIND)?.title).toBe('12 positions due');
  });
  it('sends a weekly summary on Sunday 18:00 to active players', () => {
    const sunday = { ...base, lastReviewDay: '2026-09-26' };
    expect(decide(sunday, at('2026-09-27T15:01:00Z'))?.kind).toBe('weekly');
    expect(decide(sunday, at('2026-09-26T15:01:00Z'))).toBeNull();
    expect(decide({ ...sunday, lastReviewDay: '2026-08-01' }, at('2026-09-27T15:01:00Z'))).toBeNull();
  });
  it('survives unknown timezones', () => {
    expect(localParts(REMIND, 'Not/AZone').date).toBe('2026-09-24');
  });

  it('reads the streak from practice synced from any device', () => {
    expect(tzOffsetMin(REMIND, 'Asia/Jerusalem')).toBe(-180);
    // The browser last reported a 4-day streak on the 23rd, but the phone practised on the 24th: no reminder.
    const noon = (d: string) => new Date(`${d}T09:00:00Z`).getTime();
    const days = ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
    const synced = withSyncedStreak(base, days.map(noon), REMIND);
    expect(synced).toMatchObject({ lastReviewDay: '2026-09-24', streak: 6 });
    expect(decide(synced, REMIND)).toBeNull();
  });
  it('drops a lost streak even when the browser still remembers it', () => {
    // The browser says 12 days as of the 23rd; the synced log shows the last practice on the 20th.
    const stale = { ...base, streak: 12, lastReviewDay: '2026-09-23' };
    const noon = (d: string) => new Date(`${d}T09:00:00Z`).getTime();
    const synced = withSyncedStreak({ ...stale, lastReviewDay: '2026-09-20' }, ['2026-09-18', '2026-09-19', '2026-09-20'].map(noon), REMIND);
    expect(synced.streak).toBe(0);
    const m = decide(synced, REMIND);
    expect(`${m?.title} ${m?.body}`).not.toMatch(/12|3-day/);
    // A newer report from the device itself (practice not synced yet) wins.
    expect(withSyncedStreak(stale, ['2026-09-20'].map(noon), REMIND).streak).toBe(12);
  });
});
