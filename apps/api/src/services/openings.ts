import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toEpd } from '@mainline/shared';

export interface Opening {
  epd: string;
  eco: string;
  name: string;
  uci: string;
}

let byEpd: Map<string, Opening> | undefined;
let all: Opening[] = [];

function load() {
  if (byEpd) return;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = [path.resolve(here, '../../data/openings.json'), path.resolve(here, '../data/openings.json')].find(existsSync);
  const rows: [string, string, string, string][] = file ? JSON.parse(readFileSync(file, 'utf8')) : [];
  all = rows.map(([epd, eco, name, uci]) => ({ epd, eco, name, uci }));
  byEpd = new Map();
  // Rows are sorted shortest line first; keep the first (most canonical) name per position.
  for (const o of all) if (!byEpd.has(o.epd)) byEpd.set(o.epd, o);
}

export function openingAt(fen: string): Opening | undefined {
  load();
  return byEpd!.get(toEpd(fen));
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');

export function searchOpenings(q: string, limit = 40): Opening[] {
  load();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out: Opening[] = [];
  for (const o of all) {
    const hay = `${norm(o.name)} ${o.eco.toLowerCase()}`;
    if (terms.every((t) => hay.includes(t))) {
      out.push(o);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function openingCount() {
  load();
  return all.length;
}
