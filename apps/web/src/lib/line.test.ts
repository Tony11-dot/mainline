import { describe, expect, it } from 'vitest';
import { formatLine, sanLineOf } from './line';
import { FIRST_BY_UCI, FIRST_MOVES, firstOf } from './packs';

describe('line text', () => {
  it('numbers White moves only', () => {
    expect(formatLine(['e4', 'e5', 'Nf3'])).toBe('1.e4 e5 2.Nf3');
  });

  it('says where a line that starts on Black\'s move picks up', () => {
    expect(formatLine(['Nf6', 'Nc3'], { startPly: 3, ellipsis: true })).toBe('2…Nf6 3.Nc3');
    expect(formatLine(['Nf6'], { startPly: 3 })).toBe('Nf6');
  });

  it('plays UCI from the start, hiding the skipped moves, and gives \'\' for an unplayable line', () => {
    expect(sanLineOf(['e2e4', 'e7e5', 'g1f3'])).toBe('1.e4 e5 2.Nf3');
    expect(sanLineOf(['e2e4', 'e7e5', 'g1f3'], 2)).toBe('2.Nf3');
    expect(sanLineOf(['e2e5'])).toBe('');
  });
});

describe('first moves', () => {
  it('has one UCI for every first move the library knows', () => {
    expect(Object.values(FIRST_BY_UCI).sort()).toEqual([...FIRST_MOVES].sort());
    expect(firstOf('g1f3')).toBe('Nf3');
    expect(firstOf('a2a3')).toBeUndefined();
  });
});
