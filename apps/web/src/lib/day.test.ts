import { describe, expect, it } from 'vitest';
import { localDay, startOfDay } from './day';

describe('day helpers', () => {
  it('names the local calendar day, zero-padded', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDay(new Date(2026, 11, 31, 0, 0).getTime())).toBe('2026-12-31');
  });

  it('starts the day at local midnight, and a time just after midnight is the same day', () => {
    const noon = new Date(2026, 5, 15, 12, 30).getTime();
    const midnight = startOfDay(noon);
    expect(new Date(midnight).getHours()).toBe(0);
    expect(localDay(midnight)).toBe(localDay(noon));
    expect(startOfDay(midnight)).toBe(midnight);
    expect(localDay(midnight - 1)).not.toBe(localDay(noon));
  });
});
