import cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import { sql } from 'drizzle-orm';
import { epdToFen, INITIAL_FEN, playUci, positionFromFen, ratingBandsFor, toEpd } from '@mainline/shared';
import { getDb } from '../db/client';
import { env } from '../env';
import { getEval } from '../services/evals';
import { getExplorer } from '../services/explorer';
import { sleep } from '../lib/queue';
import { LichessRateLimited, lichessPauseMs, lichessStats } from '../lib/lichess';
import { getGuide } from '../services/guide';
import { allOpenings } from '../services/openings';
import { sendDueNotifications } from '../services/push';

const NIGHTLY_CAP = 2000;

/** Lichess asked for a pause: a background job waits it out here instead of failing position after position. */
async function waitOutPause() {
  const pause = Math.max(lichessPauseMs({ token: env.LICHESS_FALLBACK_TOKEN }), lichessPauseMs({ bucket: 'cloud-eval' }));
  if (pause > 0) await sleep(pause + 500);
}

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
    await waitOutPause();
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

/** Rating band and speeds new users start with (the app's default prefs), so their first guide is cached. */
const DEFAULT_BANDS = ratingBandsFor(1600);
const DEFAULT_SPEEDS = ['blitz', 'rapid'];

/** Every position along the opening library's lines, shallowest first (the ones guides reach first). */
export function libraryPositions(): string[] {
  const seen = new Map<string, number>();
  for (const o of allOpenings()) {
    let fen = INITIAL_FEN;
    const moves = o.uci.split(' ');
    for (let i = 0; i <= moves.length; i++) {
      const epd = toEpd(fen);
      if (!seen.has(epd) || seen.get(epd)! > i) seen.set(epd, i);
      if (i === moves.length) break;
      try {
        fen = playUci(positionFromFen(fen), moves[i]!).fen;
      } catch {
        break;
      }
    }
  }
  return [...seen].sort((a, b) => a[1] - b[1]).map(([epd]) => epd);
}

/**
 * Nightly warm-up of the guided builder: explorer numbers and per-move evals for the opening library's
 * positions, so picking an opening is instant. Cached positions cost nothing, so each night picks up
 * where the last one's Lichess budget ran out.
 */
export async function warmGuides(log: FastifyBaseLogger, budget = 3000) {
  if (!getDb() || !env.LICHESS_FALLBACK_TOKEN) return 0;
  const start = lichessStats.calls;
  let n = 0;
  for (const epd of libraryPositions()) {
    if (lichessStats.calls - start >= budget) break;
    await waitOutPause();
    const before = lichessStats.calls;
    try {
      await getGuide({ fen: epdToFen(epd), ratings: DEFAULT_BANDS, speeds: DEFAULT_SPEEDS, evals: true }, env.LICHESS_FALLBACK_TOKEN, 60_000);
      n++;
    } catch (e) {
      if (e instanceof LichessRateLimited) await sleep(61_000);
    }
    // Gentle on Lichess: pause only when we actually asked it something.
    if (lichessStats.calls > before) await sleep(1000);
  }
  log.info({ positions: n, lichessCalls: lichessStats.calls - start }, 'guide warm-up done');
  return n;
}

export function startBackground(log: FastifyBaseLogger) {
  // 03:17 UTC — off-peak for Lichess.
  cron.schedule('17 3 * * *', () =>
    void prefetchRepertoirePositions(log)
      .then(() => warmGuides(log))
      .catch((err) => log.error({ err }, 'prefetch failed')),
  );
  // Reminders: every 5 minutes, each device gets its own local-time schedule.
  cron.schedule('*/5 * * * *', () => void sendDueNotifications(log).catch((err) => log.error({ err }, 'push job failed')));
  log.info('background jobs: nightly prefetch + guide warm-up (03:17 UTC), reminders (every 5 min)');
}
