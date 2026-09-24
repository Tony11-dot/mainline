import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '../db/client';
import { MissingConfigError, requireEnv } from '../env';
import { currentUser } from '../lib/session';

const state = z.object({
  timezone: z.string().max(60).default('UTC'),
  reminderTime: z.string().regex(/^\d\d:\d\d$/).default('19:00'),
  dueCount: z.number().int().min(0).max(100000).default(0),
  streak: z.number().int().min(0).max(100000).default(0),
  lastReviewDay: z.string().regex(/^\d{4}-\d\d-\d\d$/).nullable().optional(),
});
const subscription = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function pushRoutes(app: FastifyInstance) {
  app.get('/api/push/vapid', async () => ({ publicKey: requireEnv('VAPID_PUBLIC_KEY', 'Web Push') }));

  app.post('/api/push/subscribe', async (req) => {
    const db = getDb();
    if (!db) throw new MissingConfigError('DATABASE_URL', 'Reminders');
    const body = state.extend({ subscription }).parse(req.body);
    const user = await currentUser(req);
    const values = { endpoint: body.subscription.endpoint, keysJson: body.subscription.keys, userId: user?.id ?? null, timezone: body.timezone, reminderTime: body.reminderTime, dueCount: body.dueCount, streak: body.streak, lastReviewDay: body.lastReviewDay ?? null, updatedAt: new Date() };
    await db.insert(schema.pushSubs).values(values).onConflictDoUpdate({ target: schema.pushSubs.endpoint, set: values });
    return { ok: true };
  });

  /** Keeps the server's view of due count / streak current (sent after training and on app open). */
  app.post('/api/push/state', async (req) => {
    const db = getDb();
    if (!db) return { ok: false };
    const body = state.extend({ endpoint: z.string().url().max(1000) }).parse(req.body);
    const { endpoint, ...rest } = body;
    await db.update(schema.pushSubs).set({ ...rest, updatedAt: new Date() }).where(eq(schema.pushSubs.endpoint, endpoint));
    return { ok: true };
  });

  app.post('/api/push/unsubscribe', async (req) => {
    const db = getDb();
    if (!db) return { ok: true };
    const { endpoint } = z.object({ endpoint: z.string().url().max(1000) }).parse(req.body);
    await db.delete(schema.pushSubs).where(eq(schema.pushSubs.endpoint, endpoint));
    return { ok: true };
  });
}
