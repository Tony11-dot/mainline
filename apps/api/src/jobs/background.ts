import cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import { sql } from 'drizzle-orm';
import { epdToFen, ratingBandsFor } from '@mainline/shared';
import { getDb } from '../db/client';
import { env } from '../env';
import { getEval } from '../services/evals';
import { getExplorer } from '../services/explorer';
import { sleep } from '../lib/queue';
import { LichessRateLimited } from '../lib/lichess';
import { sendDueNotifications } from '../services/push';

const NIGHTLY_CAP = 2000;

/**
 * Nightly prefetch: explorer data (masters + each user's rating band) and cloud evals for every
 * position in anyone's repertoire, one Lichess request at a time, capped per night. Cached data then
 * makes coverage / radar / drills instant and costs Lichess nothing during the day.
 */
export async function prefetchRepertoirePositions(log: FastifyBaseLogger, cap = NIGHTLY_CAP) {
  const db = getDb();
  if (!db || !env.LICHESS_FALLBACK_TOKEN) {
    log.info('prefetch skipped (needs DATABASE_URL and LICHESS_FALLBACK_TOKEN)');
    return 0;
  }
  const rows = (
    await db.execute(sql`
      select distinct m.from_epd as epd, u.rating, u.rating_speed as speed
      from repertoire_moves m join users u on u.id = m.user_id
      where not m.deleted
      order by 1 limit ${cap}`)
  ).rows as { epd: string; rating: number; speed: string }[];
  let n = 0;
  for (const r of rows) {
    if (n >= cap) break;
    const fen = epdToFen(r.epd);
    try {
      await getExplorer({ source: 'masters', fen }, env.LICHESS_FALLBACK_TOKEN);
      await getExplorer({ source: 'lichess', fen, ratings: ratingBandsFor(r.rating), speeds: [r.speed] }, env.LICHESS_FALLBACK_TOKEN);
      await getEval(fen, 3);
      n++;
    } catch (e) {
      if (e instanceof LichessRateLimited) await sleep(61_000);
    }
    await sleep(1000); // gentle: ≤ 3 requests/s, cached positions return instantly anyway
  }
  log.info({ positions: n }, 'nightly prefetch done');
  return n;
}

export function startBackground(log: FastifyBaseLogger) {
  // 03:17 UTC — off-peak for Lichess.
  cron.schedule('17 3 * * *', () => void prefetchRepertoirePositions(log).catch((err) => log.error({ err }, 'prefetch failed')));
  // Reminders: every 5 minutes, each device gets its own local-time schedule.
  cron.schedule('*/5 * * * *', () => void sendDueNotifications(log).catch((err) => log.error({ err }, 'push job failed')));
  log.info('background jobs: nightly prefetch (03:17 UTC), reminders (every 5 min)');
}
