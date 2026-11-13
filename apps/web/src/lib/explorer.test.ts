import { describe, expect, it } from 'vitest';
import { explorerKey, explorerQuery } from './explorer';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('explorer query', () => {
  it('asks for the rating band and the one above, with speeds in one canonical order', () => {
    expect(explorerQuery(1650, ['rapid', 'blitz'])).toEqual({ ratings: '1600,1800', speeds: 'blitz,rapid' });
  });

  it('keys the same request the same way however the speeds were listed, and masters ignore rating and speeds', () => {
    expect(explorerKey('lichess', START, 1650, ['rapid', 'blitz'])).toBe(explorerKey('lichess', START, 1700, ['blitz', 'rapid']));
    expect(explorerKey('lichess', START, 1650, ['blitz'])).not.toBe(explorerKey('lichess', START, 1650, ['rapid']));
    expect(explorerKey('masters', START, 900, ['bullet'])).toBe(explorerKey('masters', START, 2400, ['rapid']));
  });
});
