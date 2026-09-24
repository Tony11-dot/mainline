import { eq, sql } from 'drizzle-orm';
import { playLine, positionFromFen, toEpd, epdToFen, type EvalData, type EvalLine } from '@mainline/shared';
import { getDb, schema } from '../db/client';
import { lichessJson } from '../lib/lichess';
import { Lru } from '../lib/lru';

const hot = new Lru<EvalData | null>(20000, 24 * 3600_000);

interface CloudEval {
  fen: string;
  knodes: number;
  depth: number;
  pvs: { moves: string; cp?: number; mate?: number }[];
}

/** Deep eval for a position: our cache → Lichess cloud eval → null (client falls back to local Stockfish). */
export async function getEval(fen: string, multiPv = 3): Promise<EvalData | null> {
  const epd = toEpd(fen);
  const cached = hot.get(epd);
  if (cached !== undefined) return cached;
  const db = getDb();
  if (db) {
    const row = await db.query.engineEvals.findFirst({ where: eq(schema.engineEvals.epd, epd) });
    if (row) {
      const data: EvalData = { epd, depth: row.depth, lines: row.multipvJson as EvalLine[], source: row.source };
      // Local evals below depth 30 might be superseded by the cloud; cloud hits are final.
      if (row.source === 'cloud' || row.depth >= 30) {
        hot.set(epd, data);
        return data;
      }
    }
  }
  const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(epdToFen(epd))}&multiPv=${multiPv}`;
  const cloud = await lichessJson<CloudEval>(url, { bucket: 'cloud-eval' });
  if (!cloud) {
    hot.set(epd, null, 6 * 3600_000);
    const row = db ? await db.query.engineEvals.findFirst({ where: eq(schema.engineEvals.epd, epd) }) : undefined;
    return row ? { epd, depth: row.depth, lines: row.multipvJson as EvalLine[], source: row.source } : null;
  }
  const lines: EvalLine[] = cloud.pvs.map((pv) => ({
    moves: pv.moves.split(' ').map(normalizeCastling),
    ...(pv.mate !== undefined ? { mate: pv.mate } : { cp: pv.cp ?? 0 }),
  }));
  const data: EvalData = { epd, depth: cloud.depth, knodes: cloud.knodes, lines, source: 'cloud' };
  if (db) await upsertEval(data);
  hot.set(epd, data);
  return data;
}

function normalizeCastling(uci: string) {
  return ({ e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' } as Record<string, string>)[uci] ?? uci;
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
  if (depth < 16) return 'ignored';
  const data: EvalData = { epd: toEpd(pos), depth, lines, source: 'local' };
  await upsertEval(data);
  hot.delete(data.epd);
  return 'stored';
}
