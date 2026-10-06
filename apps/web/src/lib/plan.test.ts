import { describe, expect, it } from 'vitest';
import { dayIndex, makePlan, sessionKey, taskKey } from './plan';
import { practiceHref } from './practice';

const focus = { scope: { kind: 'folder' as const, id: 'sic' }, label: 'Sicilian' };
const parts = [
  { scope: { kind: 'rep' as const, id: 'alapin' }, label: 'Alapin' },
  { scope: { kind: 'rep' as const, id: 'closed' }, label: 'Closed' },
];
const kinds = { show: true, test: true, quiz: true, learn: true };

describe('plans', () => {
  it('shows first, works through the weakest parts, ends with an exam', () => {
    const p = makePlan({ focus, days: 5, minutes: 20, kinds, weakParts: parts, unlearned: false, start: new Date(2026, 9, 6) });
    expect(p.start).toBe('2026-10-06');
    const day = (d: number) => p.tasks.filter((t) => t.day === d);
    expect(day(0).map((t) => t.how)).toEqual(['show', 'test']);
    expect(day(1).some((t) => t.label === 'Alapin')).toBe(true);
    expect(day(2).some((t) => t.label === 'Closed')).toBe(true);
    expect(day(4).map((t) => t.how)).toEqual(['test', 'quiz']);
    for (let d = 0; d < 5; d++) expect(day(d).length).toBeGreaterThan(0);
    for (let d = 0; d < 4; d++) expect(day(d).length).toBeLessThanOrEqual(2);
  });

  it('respects switched-off kinds and still leaves something each day', () => {
    const p = makePlan({ focus, days: 3, minutes: 10, kinds: { show: false, test: true, quiz: false, learn: false }, weakParts: [], unlearned: true });
    expect(p.tasks.every((t) => t.how === 'test')).toBe(true);
    expect(new Set(p.tasks.map((t) => t.day)).size).toBe(3);
  });

  it('matches a finished session to its task', () => {
    const t = { how: 'test' as const, scope: { kind: 'at' as const, color: 'white' as const, epd: 'x y z' } };
    expect(sessionKey(new URL(practiceHref(t.scope, t.how), 'https://x').searchParams)).toBe(taskKey(t));
    expect(taskKey({ how: 'show', scope: focus.scope })).toBe('show|folder:sic');
  });

  it('counts days locally', () => {
    expect(dayIndex({ start: '2026-10-06' }, new Date(2026, 9, 8, 23, 30))).toBe(2);
  });
});
