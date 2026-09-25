import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { env, requireEnv } from '../env';
import { getDb, schema } from '../db/client';
import { nudgesForDay, type NudgeKind } from '@mainline/shared';

export type Sub = typeof schema.pushSubs.$inferSelect;

export interface PushMessage {
  kind: NudgeKind;
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Local date/time/weekday for a timezone (falls back to UTC for unknown zones). */
export function localParts(now: Date, tz: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    return localParts(now, 'UTC');
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday: get('weekday') };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 19) * 60 + (m ?? 0);
};

type DecideSub = Pick<Sub, 'timezone' | 'reminderTime' | 'dueCount' | 'streak' | 'lastReviewDay' | 'lastNotifiedOn' | 'lastNudgeOn' | 'lastWeeklyOn'> & Partial<Pick<Sub, 'freezes' | 'lastLateOn'>>;

/** Which notification (if any) a subscription should get now. Runs every 5 minutes; the rules live in nudgesForDay. */
export function decide(sub: DecideSub, now: Date, windowMin = 5): PushMessage | null {
  const { date, minutes, weekday } = localParts(now, sub.timezone);
  const sent = { daily: sub.lastNotifiedOn, comeback: sub.lastNotifiedOn, nudge: sub.lastNudgeOn, late: sub.lastLateOn, weekly: sub.lastWeeklyOn };
  const all = nudgesForDay({ streak: sub.streak, freezesAtLast: sub.freezes ?? 0, lastReviewDay: sub.lastReviewDay, date, due: sub.dueCount, reminderMinutes: toMinutes(sub.reminderTime), sunday: weekday === 'Sun' });
  const n = all.find((x) => minutes >= x.minutes && minutes < x.minutes + windowMin && sent[x.kind] !== date);
  return n ? { kind: n.kind, title: n.title, body: n.body, url: n.url, tag: n.tag } : null;
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(requireEnv('VAPID_SUBJECT', 'Web Push'), requireEnv('VAPID_PUBLIC_KEY', 'Web Push'), requireEnv('VAPID_PRIVATE_KEY', 'Web Push'));
  configured = true;
}

export async function sendDueNotifications(log: FastifyBaseLogger, now = new Date()) {
  const db = getDb();
  if (!db || !env.VAPID_PRIVATE_KEY) return 0;
  configure();
  const subs = await db.select().from(schema.pushSubs);
  let sent = 0;
  for (const sub of subs) {
    const msg = decide(sub, now);
    if (!msg) continue;
    const { date } = localParts(now, sub.timezone);
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keysJson }, JSON.stringify(msg), { TTL: 3600, urgency: 'normal', topic: msg.tag });
      sent++;
      const field = { daily: { lastNotifiedOn: date }, comeback: { lastNotifiedOn: date }, nudge: { lastNudgeOn: date }, late: { lastLateOn: date }, weekly: { lastWeeklyOn: date } }[msg.kind];
      await db.update(schema.pushSubs).set(field).where(eq(schema.pushSubs.id, sub.id));
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.delete(schema.pushSubs).where(eq(schema.pushSubs.id, sub.id));
      else log.warn({ err: (err as Error).message }, 'push failed');
    }
  }
  return sent;
}
