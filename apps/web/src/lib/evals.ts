import { toEpd, type EvalData } from '@mainline/shared';
import { api } from './api';
import { db } from './idb';

const mem = new Map<string, EvalData | null>();

/** Cloud eval via our server (cached forever server-side). null = not in the cloud. */
export async function fetchCloudEval(fen: string, signal?: AbortSignal): Promise<EvalData | null> {
  const epd = toEpd(fen);
  if (mem.has(epd)) return mem.get(epd)!;
  try {
    const { eval: ev } = await api<{ eval: EvalData | null }>(`/api/eval?fen=${encodeURIComponent(fen)}`, { signal });
    mem.set(epd, ev);
    if (ev) void db().then((d) => d.put('evals', { key: epd, value: ev, at: Date.now() })).catch(() => undefined);
    return ev;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    const local = await db().then((d) => d.get('evals', epd)).catch(() => undefined);
    return local?.value ?? null;
  }
}

export function rememberLocalEval(fen: string, ev: EvalData) {
  const epd = toEpd(fen);
  void db().then((d) => d.put('evals', { key: epd, value: ev, at: Date.now() })).catch(() => undefined);
  // Share deep local evals with everyone (server validates the PV and keeps the deepest).
  if (ev.depth >= 18) void api('/api/eval', { method: 'POST', json: { fen, depth: ev.depth, lines: ev.lines } }).catch(() => undefined);
}
