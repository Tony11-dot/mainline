import { toEpd } from '@mainline/shared';

export interface OpeningInfo {
  eco: string;
  name: string;
  uci: string;
  epd: string;
}

let index: Promise<{ byEpd: Map<string, OpeningInfo>; all: OpeningInfo[] }> | undefined;

/** Loads the CC0 lichess-org/chess-openings table (bundled, works offline). */
export function openingIndex() {
  index ??= fetch('/data/openings.json')
    .then((r) => r.json() as Promise<[string, string, string, string][]>)
    .then((rows) => {
      const all = rows.map(([epd, eco, name, uci]) => ({ epd, eco, name, uci }));
      const byEpd = new Map<string, OpeningInfo>();
      for (const o of all) if (!byEpd.has(o.epd)) byEpd.set(o.epd, o);
      return { byEpd, all };
    });
  return index;
}

/** The most specific named opening along a sequence of positions (last one that has a name). */
export async function openingForLine(fens: string[]): Promise<OpeningInfo | undefined> {
  const { byEpd } = await openingIndex();
  for (let i = fens.length - 1; i >= 0; i--) {
    const o = byEpd.get(toEpd(fens[i]!));
    if (o) return o;
  }
  return undefined;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');

export async function searchOpenings(q: string, limit = 60): Promise<OpeningInfo[]> {
  const { all } = await openingIndex();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out: OpeningInfo[] = [];
  for (const o of all) {
    const hay = `${norm(o.name)} ${o.eco.toLowerCase()}`;
    if (terms.every((t) => hay.includes(t))) {
      out.push(o);
      if (out.length >= limit) break;
    }
  }
  return out;
}
