import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexOpenings, openingAtFen, searchOpenings as search, type Opening, type OpeningRow, type OpeningTable } from '@mainline/shared';

export type { Opening };

const table: OpeningTable = (() => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = [path.resolve(here, '../../data/openings.json'), path.resolve(here, '../data/openings.json')].find(existsSync);
  return indexOpenings(file ? (JSON.parse(readFileSync(file, 'utf8')) as OpeningRow[]) : []);
})();

export const openingAt = (fen: string): Opening | undefined => openingAtFen(table, fen);
export const searchOpenings = (q: string, limit = 40): Opening[] => search(table, q, limit);

/** Every named opening (shortest lines first). */
export const allOpenings = (): readonly Opening[] => table.all;
