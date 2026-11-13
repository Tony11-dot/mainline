import { eq, sql } from 'drizzle-orm';
import { EVAL_ACCEPT_MIN_DEPTH, EVAL_FINAL_DEPTH, castlingAsKingMove, playLine, positionFromFen, toEpd, epdToFen, type EvalData, type EvalLine } from '@mainline/shared';
import { getDb, schema } from '../db/client';
import { lichessJson } from '../lib/lichess';
import { Lru } from '../lib/lru';

/** What we know about a position, and how many lines it was asked for with: a one-line answer must not satisfy a request for five. */
interface Known {
  data: EvalData | null;
  multiPv: number;
}
const hot = new Lru<Known>(20000, 24 * 3600_000);
const MISS_TTL = 30 * 86_400_000;

interface CloudEval {
  fen: string;
  knodes: number;
  depth: number;
  pvs: { moves: string; cp?: number; mate?: number }[];
}

const inflight = new Map<string, { multiPv: number; promise: Promise<EvalData | null> }>();

/** Deep eval for a position: our cache → Lichess cloud eval → null (client falls back to local Stockfish). */
export async function getEval(fen: string, multiPv = 3): Promise<EvalData | null> {
  const epd = toEpd(fen);
  const cached = hot.get(epd);
  if (cached && (cached.data === null || cached.multiPv >= multiPv)) return cached.data;
  // The same position is often wanted twice at once (a guide and the engine panel, a prefetch and the
  // visit it predicted): one Lichess request serves them all.
  const running = inflight.get(epd);
  if (running && running.multiPv >= multiPv) return running.promise;
  const promise = lookup(epd, multiPv).finally(() => {
    if (inflight.get(epd)?.promise === promise) inflight.delete(epd);
  });
  inflight.set(epd, { multiPv, promise });
  return promise;
}

async function lookup(epd: string, multiPv: number): Promise<EvalData | null> {
  const db = getDb();
  if (db) {
    const row = await db.query.engineEvals.findFirst({ where: eq(schema.engineEvals.epd, epd) });
    // A remembered miss (depth 0, no lines): Lichess had no cloud eval; ask again only after a while.
    if (row && row.depth === 0) {
      if (row.updatedAt.getTime() > Date.now() - MISS_TTL) {
        hot.set(epd, { data: null, multiPv }, 6 * 3600_000);
        return null;
      }
    } else if (row) {
      const data: EvalData = { epd, depth: row.depth, lines: row.multipvJson as EvalLine[], source: row.source };
      // Local evals below depth 30 might be superseded by the cloud; cloud hits are final.
      if (row.source === 'cloud' || row.depth >= EVAL_FINAL_DEPTH) {
        hot.set(epd, { data, multiPv });
        return data;
      }
    }
  }
  const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(epdToFen(epd))}&multiPv=${multiPv}`;
  const cloud = await lichessJson<CloudEval>(url, { bucket: 'cloud-eval' });
  if (!cloud) {
    hot.set(epd, { data: null, multiPv }, 6 * 3600_000);
    const row = db ? await db.query.engineEvals.findFirst({ where: eq(schema.engineEvals.epd, epd) }) : undefined;
    if (db && (!row || row.depth === 0)) {
      // Remember the miss, so background warm-ups don't ask Lichess about it every night.
      await db
        .insert(schema.engineEvals)
        .values({ epd, depth: 0, multipvJson: [], source: 'cloud', updatedAt: new Date() })
        .onConflictDoUpdate({ target: schema.engineEvals.epd, set: { updatedAt: new Date() }, setWhere: sqlDeeper(1) });
      return null;
    }
    return row ? { epd, depth: row.depth, lines: row.multipvJson as EvalLine[], source: row.source } : null;
  }
  const lines: EvalLine[] = cloud.pvs.map((pv) => ({
    moves: pv.moves.split(' ').map(castlingAsKingMove),
    ...(pv.mate !== undefined ? { mate: pv.mate } : { cp: pv.cp ?? 0 }),
  }));
  const data: EvalData = { epd, depth: cloud.depth, knodes: cloud.knodes, lines, source: 'cloud' };
  if (db) await upsertEval(data);
  hot.set(epd, { data, multiPv });
  return data;
}

async function upsertEval(data: EvalData) {
  const db = getDb()!;
  await db
    .insert(schema.engineEvals)
    .values({ epd: data.epd, depth: data.depth, multipvJson: data.lines, source: data.source, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.engineEvals.epd,
      set: { depth: data.depth, multipvJson: data.lines, source: data.source, updatedAt: new Date() },
      setWhere: sqlDeeper(data.depth),
    });
}

const sqlDeeper = (depth: number) => sql`${schema.engineEvals.depth} < ${depth}`;

/**
 * Accepts a client-computed (local Stockfish) eval. Validated: every PV must be legal from the FEN,
 * depth sane, and it only replaces a shallower eval.
 */
export async function submitLocalEval(fen: string, depth: number, lines: EvalLine[]): Promise<'stored' | 'ignored'> {
  const db = getDb();
  if (!db) return 'ignored';
  const pos = positionFromFen(fen);
  for (const l of lines) {
    try {
      playLine(epdToFen(toEpd(pos)), l.moves);
    } catch {
      throw Object.assign(new Error('illegal PV'), { statusCode: 400 });
    }
    if (l.cp === undefined && l.mate === undefined) throw Object.assign(new Error('missing score'), { statusCode: 400 });
  }
  if (depth < EVAL_ACCEPT_MIN_DEPTH) return 'ignored';
  const data: EvalData = { epd: toEpd(pos), depth, lines, source: 'local' };
  await upsertEval(data);
  hot.delete(data.epd);
  return 'stored';
}
