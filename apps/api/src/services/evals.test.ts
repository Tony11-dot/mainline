import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { testDatabaseUrl, useTestDatabase } from '../db/testing';

// Needs Postgres: TEST_DATABASE_URL (CI provides one; locally `createdb mainline_test`).
const run = testDatabaseUrl ? describe : describe.skip;

// 1.e4 e5, White to move; its EPD is the row key.
const FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const EPD = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -';

run('local engine evals', () => {
  let app: FastifyInstance;
  let db: typeof import('../db/client');
  beforeAll(async () => {
    await useTestDatabase();
    db = await import('../db/client');
    const { buildApp } = await import('../app');
    app = await buildApp({ logger: false });
  });
  afterAll(async () => {
    await app?.close();
    await db?.closeDb();
  });
  beforeEach(async () => {
    await db.getDb()!.delete(db.schema.engineEvals).where(eq(db.schema.engineEvals.epd, EPD));
  });

  const submit = (depth: number, lines: object[], fen = FEN) => app.inject({ method: 'POST', url: '/api/eval', payload: { fen, depth, lines } });
  const stored = async () => (await db.getDb()!.select().from(db.schema.engineEvals).where(eq(db.schema.engineEvals.epd, EPD)))[0];

  it('stores a deep enough eval whose lines are all legal', async () => {
    const res = await submit(24, [{ moves: ['g1f3', 'b8c6', 'f1b5'], cp: 31 }, { moves: ['f1c4'], cp: 20 }]);
    expect(res.json()).toEqual({ result: 'stored' });
    expect(await stored()).toMatchObject({ depth: 24, source: 'local', multipvJson: [{ moves: ['g1f3', 'b8c6', 'f1b5'], cp: 31 }, { moves: ['f1c4'], cp: 20 }] });
  });

  it('rejects a line with an illegal move anywhere in it, or without a score', async () => {
    for (const lines of [[{ moves: ['g1f3', 'g1f3'], cp: 10 }], [{ moves: ['e7e5'], cp: 10 }], [{ moves: ['g1f3'], cp: 10 }, { moves: ['e1g1'], cp: 0 }], [{ moves: ['g1f3'] }]]) {
      const res = await submit(24, lines);
      expect(res.statusCode).toBe(400);
    }
    expect(await stored()).toBeUndefined();
  });

  it('ignores shallow evals', async () => {
    expect((await submit(15, [{ moves: ['g1f3'], cp: 30 }])).json()).toEqual({ result: 'ignored' });
    expect(await stored()).toBeUndefined();
  });

  it('only ever replaces an eval with a deeper one', async () => {
    await submit(30, [{ moves: ['g1f3'], cp: 30 }]);
    await submit(20, [{ moves: ['d1h5'], cp: -400 }]);
    expect(await stored()).toMatchObject({ depth: 30, multipvJson: [{ moves: ['g1f3'], cp: 30 }] });
    await submit(36, [{ moves: ['b1c3'], mate: 12 }]);
    expect(await stored()).toMatchObject({ depth: 36, multipvJson: [{ moves: ['b1c3'], mate: 12 }] });
  });

  it('keys the eval by position, so a transposition finds it', async () => {
    // Same position, other move counters.
    await submit(24, [{ moves: ['g1f3'], cp: 30 }], 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 4 7');
    expect(await stored()).toMatchObject({ depth: 24 });
  });
});
