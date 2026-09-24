import { describe, expect, it } from 'vitest';
import { INITIAL_EPD, importPgn } from '@mainline/shared';
import { TEMPLATES } from './templates';

describe('starter templates', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s is legal and non-trivial', (_id, t) => {
    const res = importPgn(t.pgn, { id: 'x', color: t.color, rootEpd: INITIAL_EPD });
    expect(res.errors).toEqual([]);
    expect(res.moves.length).toBeGreaterThan(10);
  });
});
