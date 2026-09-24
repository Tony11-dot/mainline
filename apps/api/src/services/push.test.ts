import { describe, expect, it } from 'vitest';
import { decide, localParts } from './push';

const base = { timezone: 'Asia/Jerusalem', reminderTime: '19:00', dueCount: 12, streak: 4, lastReviewDay: null, lastNotifiedOn: null, lastNudgeOn: null, lastWeeklyOn: null };
// 2026-09-24 is a Thursday; Jerusalem is UTC+3 (IDT) → 19:02 local = 16:02 UTC.
const at = (iso: string) => new Date(iso);

describe('push schedule', () => {
  it('uses the device timezone', () => {
    expect(localParts(at('2026-09-24T16:02:00Z'), 'Asia/Jerusalem')).toMatchObject({ date: '2026-09-24', minutes: 19 * 60 + 2 });
  });
  it('sends the due reminder once, only with cards due and no review today', () => {
    const now = at('2026-09-24T16:02:00Z');
    expect(decide(base, now)?.kind).toBe('due');
    expect(decide(base, now)?.title).toBe('12 positions due');
    expect(decide({ ...base, lastNotifiedOn: '2026-09-24' }, now)).toBeNull();
    expect(decide({ ...base, dueCount: 0 }, now)).toBeNull();
    expect(decide({ ...base, lastReviewDay: '2026-09-24' }, now)).toBeNull();
    expect(decide(base, at('2026-09-24T16:30:00Z'))).toBeNull();
  });
  it('nudges at 20:30 only if the streak is at risk', () => {
    const now = at('2026-09-24T17:31:00Z');
    expect(decide(base, now)?.kind).toBe('nudge');
    expect(decide({ ...base, streak: 0 }, now)).toBeNull();
    expect(decide({ ...base, lastReviewDay: '2026-09-24' }, now)).toBeNull();
  });
  it('sends a weekly summary on Sunday 18:00', () => {
    expect(decide(base, at('2026-09-27T15:01:00Z'))?.kind).toBe('weekly');
    expect(decide(base, at('2026-09-26T15:01:00Z'))).toBeNull();
  });
  it('survives unknown timezones', () => {
    expect(localParts(at('2026-09-24T16:02:00Z'), 'Not/AZone').date).toBe('2026-09-24');
  });
});
