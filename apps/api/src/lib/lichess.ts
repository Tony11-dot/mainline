import { env } from '../env';
import { KeyedSerialQueue, sleep } from './queue';

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
export const USER_AGENT = `Mainline/0.1 (+${env.PUBLIC_URL}; chess opening trainer)`;

/**
 * Fetches from Lichess with API etiquette enforced: one request at a time per token (or per
 * anonymous bucket), and a full 60 s pause after any HTTP 429.
 */
export async function lichessFetch(url: string, opts: { token?: string; bucket?: string; accept?: string; init?: RequestInit } = {}) {
  const key = opts.token ? `t:${opts.token.slice(-8)}` : `anon:${opts.bucket ?? 'default'}`;
  const until = blockedUntil.get(key) ?? 0;
  const wait = until - Date.now();
  if (wait > 5000) throw new LichessRateLimited(Math.ceil(wait / 1000));
  return queue.run(key, async () => {
    const w = (blockedUntil.get(key) ?? 0) - Date.now();
    if (w > 0) await sleep(w);
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: opts.accept ?? 'application/json' };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
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
