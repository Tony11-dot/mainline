import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lru } from './lru';

afterEach(() => vi.useRealTimers());

describe('Lru', () => {
  it('forgets entries once their time is up, with a per-entry override', () => {
    vi.useFakeTimers({ now: 0 });
    const c = new Lru<string>(10, 1000);
    c.set('a', 'A');
    c.set('b', 'B', 5000);
    vi.setSystemTime(1000);
    expect(c.get('a')).toBe('A');
    vi.setSystemTime(1001);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe('B');
    vi.setSystemTime(5001);
    expect(c.get('b')).toBeUndefined();
  });

  it('evicts the least recently used entry when full', () => {
    const c = new Lru<number>(2, 60_000);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // a is now the most recent
    c.set('c', 3);
    expect([c.get('a'), c.get('b'), c.get('c')]).toEqual([1, undefined, 3]);
  });

  it('replaces a key in place and deletes on request', () => {
    const c = new Lru<number>(2, 60_000);
    c.set('a', 1);
    c.set('a', 2);
    c.set('b', 3);
    expect(c.get('a')).toBe(2);
    c.delete('a');
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(3);
  });
});
