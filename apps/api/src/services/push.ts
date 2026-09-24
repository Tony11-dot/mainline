import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { env, requireEnv } from '../env';
import { getDb, schema } from '../db/client';

export type Sub = typeof schema.pushSubs.$inferSelect;

export interface PushMessage {
  kind: 'due' | 'nudge' | 'weekly';
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

/** Which notification (if any) a subscription should get now. Runs every 5 minutes. */
export function decide(sub: Pick<Sub, 'timezone' | 'reminderTime' | 'dueCount' | 'streak' | 'lastReviewDay' | 'lastNotifiedOn' | 'lastNudgeOn' | 'lastWeeklyOn'>, now: Date, windowMin = 5): PushMessage | null {
  const { date, minutes, weekday } = localParts(now, sub.timezone);
  const inWindow = (target: number) => minutes >= target && minutes < target + windowMin;
  const reviewedToday = sub.lastReviewDay === date;

  // Daily reminder at the chosen time — only when something is due.
  if (inWindow(toMinutes(sub.reminderTime)) && sub.dueCount > 0 && sub.lastNotifiedOn !== date && !reviewedToday) {
    const mins = Math.max(1, Math.round((sub.dueCount * 8) / 60));
    return { kind: 'due', title: `${sub.dueCount} position${sub.dueCount === 1 ? '' : 's'} due`, body: `About ${mins} min to keep your openings sharp.`, url: '/train?mode=review', tag: 'due' };
  }
  // Evening streak nudge (20:30), only if a streak is at risk.
  if (inWindow(20 * 60 + 30) && sub.streak > 0 && !reviewedToday && sub.lastNudgeOn !== date) {
    return { kind: 'nudge', title: `Keep your ${sub.streak}-day streak`, body: 'A two-minute review keeps it alive.', url: '/train?mode=review', tag: 'streak' };
  }
  // Weekly summary, Sunday 18:00.
  if (weekday === 'Sun' && inWindow(18 * 60) && sub.lastWeeklyOn !== date) {
    return { kind: 'weekly', title: 'Your week in openings', body: sub.streak > 0 ? `${sub.streak}-day streak · ${sub.dueCount} due now.` : `${sub.dueCount} positions are waiting for you.`, url: '/', tag: 'weekly' };
  }
  return null;
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
      const field = msg.kind === 'due' ? { lastNotifiedOn: date } : msg.kind === 'nudge' ? { lastNudgeOn: date } : { lastWeeklyOn: date };
      await db.update(schema.pushSubs).set(field).where(eq(schema.pushSubs.id, sub.id));
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.delete(schema.pushSubs).where(eq(schema.pushSubs.id, sub.id));
      else log.warn({ err: (err as Error).message }, 'push failed');
    }
  }
  return sent;
}
