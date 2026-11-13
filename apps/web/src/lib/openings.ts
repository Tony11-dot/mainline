import { indexOpenings, searchOpenings as search, toEpd, type Opening, type OpeningRow, type OpeningTable } from '@mainline/shared';

export type OpeningInfo = Opening;

let index: Promise<OpeningTable> | undefined;

/** Loads the CC0 lichess-org/chess-openings table (bundled, works offline). */
export function openingIndex() {
  index ??= fetch('/data/openings.json')
    .then((r) => r.json() as Promise<OpeningRow[]>)
    .then(indexOpenings);
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

export async function searchOpenings(q: string, limit = 60): Promise<OpeningInfo[]> {
  return search(await openingIndex(), q, limit);
}
