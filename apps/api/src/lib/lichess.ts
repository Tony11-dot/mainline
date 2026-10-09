import { env } from '../env';
import { KeyedSerialQueue } from './queue';

export class LichessRateLimited extends Error {
  statusCode = 429;
  constructor(public retryAfterSec: number) {
    super(`Lichess is rate-limiting us; retry in ${retryAfterSec}s`);
    this.name = 'LichessRateLimited';
  }
}

export class LichessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'LichessError';
  }
  get statusCode() {
    return this.status === 401 ? 502 : this.status >= 500 ? 502 : this.status;
  }
}

const queue = new KeyedSerialQueue();
const blockedUntil = new Map<string, number>();
/** Requests actually sent to Lichess (cache hits never get here): lets background jobs keep a budget. */
export const lichessStats = { calls: 0 };
export const USER_AGENT = `Mainline/0.1 (+${env.PUBLIC_URL}; chess opening trainer)`;

type Bucket = { token?: string; bucket?: string };
const keyFor = (opts: Bucket) => (opts.token ? `t:${opts.token.slice(-8)}` : `anon:${opts.bucket ?? 'default'}`);

/** How much longer Lichess has asked us to stay quiet on this token or bucket (0 when it hasn't). */
export function lichessPauseMs(opts: Bucket = {}): number {
  return Math.max(0, (blockedUntil.get(keyFor(opts)) ?? 0) - Date.now());
}

/**
 * Fetches from Lichess with API etiquette enforced: one request at a time per token (or per
 * anonymous bucket), and a full 60 s pause after any HTTP 429.
 *
 * During that pause every request fails at once with LichessRateLimited — including ones already
 * queued behind the request that got the 429. Someone is waiting on each of them, and sleeping them
 * through the pause only turned one slow answer into a minute-long one for everyone (then a burst, and
 * another 429). Callers fall back to their caches or the device's engine; background jobs check
 * `lichessPauseMs` and wait the pause out themselves.
 */
export async function lichessFetch(url: string, opts: Bucket & { accept?: string; init?: RequestInit } = {}) {
  const key = keyFor(opts);
  const pause = () => (blockedUntil.get(key) ?? 0) - Date.now();
  if (pause() > 0) throw new LichessRateLimited(Math.ceil(pause() / 1000));
  return queue.run(key, async () => {
    const w = pause();
    if (w > 0) throw new LichessRateLimited(Math.ceil(w / 1000));
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: opts.accept ?? 'application/json' };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    lichessStats.calls++;
    const res = await fetch(url, { ...opts.init, headers: { ...headers, ...(opts.init?.headers as Record<string, string>) } });
    if (res.status === 429) {
      blockedUntil.set(key, Date.now() + 60_000);
      throw new LichessRateLimited(60);
    }
    return res;
  });
}

export async function lichessJson<T>(url: string, opts: Parameters<typeof lichessFetch>[1] = {}): Promise<T | undefined> {
  const res = await lichessFetch(url, opts);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new LichessError(res.status, `Lichess ${res.status} for ${new URL(url).pathname}`);
  return (await res.json()) as T;
}

/** Test hook */
export function _resetLichessLimits() {
  blockedUntil.clear();
}
