import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { testDatabaseUrl, useTestDatabase } from '../db/testing';

// Needs Postgres: TEST_DATABASE_URL (CI provides one; locally `createdb mainline_test`).
const run = testDatabaseUrl ? describe : describe.skip;

run('push subscriptions', () => {
  let app: FastifyInstance;
  let db: typeof import('../db/client');
  let token = '';
  let userId = '';
  beforeAll(async () => {
    process.env.TOKEN_ENC_KEY ??= Buffer.alloc(32, 1).toString('base64');
    process.env.SESSION_SECRET ??= Buffer.alloc(32, 2).toString('base64');
    await useTestDatabase();
    db = await import('../db/client');
    const { createSession } = await import('../lib/session');
    const { buildApp } = await import('../app');
    const [u] = await db.getDb()!.insert(db.schema.users).values({ lichessUsername: `t_${randomUUID()}` }).returning();
    userId = u!.id;
    token = await createSession(userId);
    app = await buildApp({ logger: false });
  });
  afterAll(async () => {
    await app?.close();
    await db?.closeDb();
  });

  const endpoint = () => `https://push.example.test/${randomUUID()}`;
  const subscription = (url: string) => ({ endpoint: url, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } });
  const post = (url: string, payload: object, headers: Record<string, string> = {}) => app.inject({ method: 'POST', url, payload, headers });
  const row = async (url: string) => (await db.getDb()!.select().from(db.schema.pushSubs).where(eq(db.schema.pushSubs.endpoint, url)))[0];

  it('subscribes a guest with defaults, and a signed-in player to their account', async () => {
    const guest = endpoint();
    expect((await post('/api/push/subscribe', { subscription: subscription(guest) })).json()).toEqual({ ok: true });
    expect(await row(guest)).toMatchObject({ userId: null, timezone: 'UTC', reminderTime: '19:00', lang: 'en', keysJson: { p256dh: 'p256dh-key', auth: 'auth-key' } });

    const mine = endpoint();
    await post('/api/push/subscribe', { subscription: subscription(mine), timezone: 'Asia/Jerusalem', reminderTime: '08:30', lang: 'he', streak: 4 }, { authorization: `Bearer ${token}` });
    expect(await row(mine)).toMatchObject({ userId, timezone: 'Asia/Jerusalem', reminderTime: '08:30', lang: 'he', streak: 4 });
  });

  it('updates a device that subscribes again instead of adding it twice', async () => {
    const url = endpoint();
    await post('/api/push/subscribe', { subscription: subscription(url), lang: 'fr' });
    await post('/api/push/subscribe', { subscription: subscription(url), lang: 'de', reminderTime: '21:00' });
    const rows = await db.getDb()!.select().from(db.schema.pushSubs).where(eq(db.schema.pushSubs.endpoint, url));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ lang: 'de', reminderTime: '21:00' });
  });

  it('rejects malformed subscriptions', async () => {
    for (const body of [
      {},
      { subscription: { endpoint: 'not a url', keys: { p256dh: 'a', auth: 'b' } } },
      { subscription: subscription(endpoint()), lang: 'eng' },
      { subscription: subscription(endpoint()), reminderTime: '7pm' },
      { subscription: subscription(endpoint()), lastReviewDay: '19/10/2026' },
      { subscription: subscription(endpoint()), freezes: 11 },
    ]) {
      expect((await post('/api/push/subscribe', body)).statusCode).toBe(400);
    }
  });

  it('keeps the streak and due count current, then unsubscribes', async () => {
    const url = endpoint();
    await post('/api/push/subscribe', { subscription: subscription(url) });
    await post('/api/push/state', { endpoint: url, dueCount: 12, streak: 9, freezes: 1, lastReviewDay: '2026-10-18', lang: 'ar' });
    expect(await row(url)).toMatchObject({ dueCount: 12, streak: 9, freezes: 1, lastReviewDay: '2026-10-18', lang: 'ar' });
    expect((await post('/api/push/state', { endpoint: endpoint(), streak: 1 })).json()).toEqual({ ok: true });
    await post('/api/push/unsubscribe', { endpoint: url });
    expect(await row(url)).toBeUndefined();
  });
});
