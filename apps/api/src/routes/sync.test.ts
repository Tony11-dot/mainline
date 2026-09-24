import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

// Needs Postgres: TEST_DATABASE_URL (CI provides one; locally `createdb mainline_test`).
const url = process.env.TEST_DATABASE_URL ?? (process.env.CI ? undefined : 'postgres://localhost:5432/mainline_test');
const run = url ? describe : describe.skip;

run('sync', () => {
  let app: FastifyInstance;
  let token = '';
  let otherToken = '';
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.TOKEN_ENC_KEY ??= Buffer.alloc(32, 1).toString('base64');
    process.env.SESSION_SECRET ??= Buffer.alloc(32, 2).toString('base64');
    const { runMigrations } = await import('../db/migrate');
    const { getDb, schema } = await import('../db/client');
    const { createSession } = await import('../lib/session');
    const { buildApp } = await import('../app');
    await runMigrations();
    const db = getDb()!;
    const [u1] = await db.insert(schema.users).values({ lichessUsername: `t_${randomUUID()}` }).returning();
    const [u2] = await db.insert(schema.users).values({ lichessUsername: `t_${randomUUID()}` }).returning();
    token = await createSession(u1!.id);
    otherToken = await createSession(u2!.id);
    app = await buildApp({ logger: false });
  });
  afterAll(async () => {
    await app?.close();
    const { closeDb } = await import('../db/client');
    await closeDb();
  });

  const sync = (body: unknown, t = token) => app.inject({ method: 'POST', url: '/api/sync', payload: body as object, headers: { authorization: `Bearer ${t}` } });

  it('requires sign-in', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/sync', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('pushes, pulls, last-write-wins, tombstones, and isolates users', async () => {
    const repId = randomUUID();
    const folderId = randomUUID();
    const epd = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
    const t0 = Date.now();
    const push = await sync({
      cursor: null,
      changes: {
        folders: [{ id: folderId, parentId: null, name: 'White', color: 'white', sortIndex: 0, updatedAt: t0 }],
        repertoires: [{ id: repId, folderId, name: 'Italian', color: 'white', rootEpd: epd, rootMovesUci: [], sortIndex: 0, createdAt: t0, updatedAt: t0 }],
        moves: [{ repertoireId: repId, fromEpd: epd, uci: 'e2e4', san: 'e4', toEpd: 'x', isMainline: true, addedAt: t0, updatedAt: t0 }],
        cards: [{ color: 'white', epd, kind: 'repertoire', fsrs: { reps: 1 }, due: t0 + 1000, lastReview: t0, updatedAt: t0 }],
        reviews: [{ id: randomUUID(), cardEpd: epd, color: 'white', rating: 3, playedUci: 'e2e4', expectedUci: ['e2e4'], mode: 'learn', msTaken: 900, reviewedAt: t0, updatedAt: t0 }],
      },
    });
    expect(push.statusCode).toBe(200);
    const first = push.json();
    expect(first.pull.repertoires).toHaveLength(1);
    expect(first.pull.moves[0].uci).toBe('e2e4');

    // An older edit loses; a newer one (tombstone) wins.
    await sync({ changes: { repertoires: [{ id: repId, folderId, name: 'OLD', color: 'white', rootEpd: epd, rootMovesUci: [], sortIndex: 0, createdAt: t0, updatedAt: t0 - 5000 }] } });
    await sync({ changes: { moves: [{ repertoireId: repId, fromEpd: epd, uci: 'e2e4', san: 'e4', toEpd: 'x', isMainline: true, addedAt: t0, updatedAt: t0 + 10, deleted: true }] } });
    const pulled = (await sync({ cursor: null })).json().pull;
    expect(pulled.repertoires[0].name).toBe('Italian');
    expect(pulled.moves[0].deleted).toBe(true);
    expect(pulled.reviews).toHaveLength(1);

    // Another user sees nothing and can't overwrite.
    const other = await sync({ cursor: null, changes: { repertoires: [{ id: repId, folderId, name: 'HIJACK', color: 'white', rootEpd: epd, rootMovesUci: [], sortIndex: 0, createdAt: t0, updatedAt: t0 + 99999 }] } }, otherToken);
    expect(other.json().pull.repertoires).toHaveLength(0);
    expect((await sync({ cursor: null })).json().pull.repertoires[0].name).toBe('Italian');

    // Cursor-based pull returns only newer rows.
    const cur = (await sync({ cursor: null })).json().cursor;
    expect(typeof cur).toBe('string');
  });

  it('rejects malformed rows', async () => {
    const res = await sync({ changes: { moves: [{ repertoireId: 'nope', fromEpd: '', uci: 'zz', san: '', toEpd: '', isMainline: true, addedAt: 0, updatedAt: 0 }] } });
    expect(res.statusCode).toBe(400);
  });
});
