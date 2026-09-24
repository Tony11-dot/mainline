import { and, eq } from 'drizzle-orm';
import { epdToFen, toEpd, type ExplorerData, type ExplorerGame, type ExplorerMove } from '@mainline/shared';
import { getDb, schema } from '../db/client';
import { MissingConfigError } from '../env';
import { lichessJson } from '../lib/lichess';
import { Lru } from '../lib/lru';
import { sha256 } from '../lib/crypto';

const DAY = 86_400_000;
export const EXPLORER_TTL = { masters: 90 * DAY, lichess: 14 * DAY, player: 1 * DAY } as const;

const hot = new Lru<ExplorerData>(5000, 6 * 3600_000);

export interface ExplorerParams {
  source: 'masters' | 'lichess';
  fen: string;
  ratings?: number[];
  speeds?: string[];
}

interface LichessExplorerResponse {
  white: number;
  draws: number;
  black: number;
  moves: { uci: string; san: string; white: number; draws: number; black: number; averageRating?: number; opening?: { eco: string; name: string } | null }[];
  topGames?: { uci?: string; id: string; winner: 'white' | 'black' | null; white: { name: string; rating: number }; black: { name: string; rating: number }; year?: number; month?: string }[];
  opening?: { eco: string; name: string } | null;
}

export function paramsKey(p: ExplorerParams): string {
  if (p.source === 'masters') return 'm';
  const r = [...(p.ratings ?? [])].sort((a, b) => a - b).join(',');
  const s = [...(p.speeds ?? [])].sort().join(',');
  return sha256(`${r}|${s}`).slice(0, 16);
}

export function normalizeExplorer(source: ExplorerData['source'], epd: string, raw: LichessExplorerResponse, cached: boolean, fetchedAt: Date): ExplorerData {
  const moves: ExplorerMove[] = raw.moves.map((m) => ({
    uci: normalizeCastlingUci(m.uci, m.san),
    san: m.san,
    white: m.white,
    draws: m.draws,
    black: m.black,
    total: m.white + m.draws + m.black,
    averageRating: m.averageRating ?? null,
    opening: m.opening ?? null,
  }));
  const topGames: ExplorerGame[] = (raw.topGames ?? []).map((g) => ({
    id: g.id,
    uci: g.uci ? normalizeCastlingUci(g.uci) : undefined,
    winner: g.winner,
    white: g.white,
    black: g.black,
    year: g.year,
    month: g.month,
  }));
  return {
    source,
    epd,
    white: raw.white,
    draws: raw.draws,
    black: raw.black,
    total: raw.white + raw.draws + raw.black,
    moves,
    topGames,
    opening: raw.opening ?? null,
    fetchedAt: fetchedAt.toISOString(),
    cached,
  };
}

/** Lichess explorer may encode castling king-to-rook (e1h1); we use e1g1 everywhere. */
function normalizeCastlingUci(uci: string, san?: string): string {
  const map: Record<string, string> = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };
  if (san && !san.startsWith('O-O')) return uci;
  return map[uci] ?? uci;
}

export async function getExplorer(p: ExplorerParams, token: string | undefined): Promise<ExplorerData> {
  const epd = toEpd(p.fen);
  const key = paramsKey(p);
  const hotKey = `${p.source}|${epd}|${key}`;
  const h = hot.get(hotKey);
  if (h) return h;

  const db = getDb();
  if (db) {
    const row = await db.query.explorerCache.findFirst({
      where: and(eq(schema.explorerCache.source, p.source), eq(schema.explorerCache.epd, epd), eq(schema.explorerCache.paramsHash, key)),
    });
    if (row && row.fetchedAt.getTime() > Date.now() - EXPLORER_TTL[p.source]) {
      const data = normalizeExplorer(p.source, epd, row.payloadJson as LichessExplorerResponse, true, row.fetchedAt);
      hot.set(hotKey, data);
      return data;
    }
  }

  if (!token) throw new MissingConfigError('LICHESS_FALLBACK_TOKEN', 'Opening explorer (sign in with Lichess, or ask the server owner to)');
  const url = new URL(`https://explorer.lichess.org/${p.source}`);
  url.searchParams.set('fen', epdToFen(epd));
  url.searchParams.set('moves', '15');
  url.searchParams.set('topGames', p.source === 'masters' ? '8' : '4');
  if (p.source === 'lichess') {
    url.searchParams.set('recentGames', '0');
    if (p.ratings?.length) url.searchParams.set('ratings', p.ratings.join(','));
    if (p.speeds?.length) url.searchParams.set('speeds', p.speeds.join(','));
  }
  const raw = await lichessJson<LichessExplorerResponse>(url.toString(), { token });
  if (!raw) throw Object.assign(new Error('explorer returned nothing'), { statusCode: 502 });
  const now = new Date();
  if (db) {
    await db
      .insert(schema.explorerCache)
      .values({ source: p.source, epd, paramsHash: key, payloadJson: raw, fetchedAt: now })
      .onConflictDoUpdate({
        target: [schema.explorerCache.source, schema.explorerCache.epd, schema.explorerCache.paramsHash],
        set: { payloadJson: raw, fetchedAt: now },
      });
  }
  const data = normalizeExplorer(p.source, epd, raw, false, now);
  hot.set(hotKey, data);
  return data;
}
