import { toEpd } from './epd';

/** A named opening from the bundled lichess-org/chess-openings table (rows are `[epd, eco, name, uci]`). */
export interface Opening {
  epd: string;
  eco: string;
  name: string;
  uci: string;
}
export type OpeningRow = [string, string, string, string];

export interface OpeningTable {
  all: Opening[];
  byEpd: Map<string, Opening>;
}

/** Rows are sorted shortest line first; the first (most canonical) name per position wins. */
export function indexOpenings(rows: OpeningRow[]): OpeningTable {
  const all = rows.map(([epd, eco, name, uci]) => ({ epd, eco, name, uci }));
  const byEpd = new Map<string, Opening>();
  for (const o of all) if (!byEpd.has(o.epd)) byEpd.set(o.epd, o);
  return { all, byEpd };
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');

/** Openings whose name or ECO code contains every word of `q` (accent- and case-blind). */
export function searchOpenings(table: OpeningTable, q: string, limit: number): Opening[] {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out: Opening[] = [];
  for (const o of table.all) {
    const hay = `${norm(o.name)} ${o.eco.toLowerCase()}`;
    if (terms.every((t) => hay.includes(t))) {
      out.push(o);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** The named opening at a position, if any. */
export const openingAtFen = (table: OpeningTable, fen: string): Opening | undefined => table.byEpd.get(toEpd(fen));
