// Downloads lichess-org/chess-openings (CC0) and writes EPD-keyed opening data for the API and web app.
// Usage: pnpm --filter @mainline/shared exec tsx scripts/build-openings.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { INITIAL_FEN, positionFromFen, toEpd } from '../src/epd';
import { sanToUci, playUci } from '../src/chess';

const root = new URL('../../../', import.meta.url).pathname;
const rows: { epd: string; eco: string; name: string; pgn: string; uci: string }[] = [];
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const res = await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/master/${f}.tsv`);
  const text = await res.text();
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split('\t') as [string, string, string];
    let pos = positionFromFen(INITIAL_FEN);
    const ucis: string[] = [];
    for (const tok of pgn.split(/\s+/)) {
      if (/^\d+\.+$/.test(tok) || !tok) continue;
      const san = tok.replace(/^\d+\.+/, '');
      const uci = sanToUci(pos, san);
      if (!uci) throw new Error(`bad san ${san} in ${pgn}`);
      ucis.push(uci);
      pos = playUci(pos, uci).pos;
    }
    rows.push({ epd: toEpd(pos), eco, name, pgn, uci: ucis.join(' ') });
  }
}
rows.sort((a, b) => a.uci.split(' ').length - b.uci.split(' ').length || a.name.localeCompare(b.name));
const compact = rows.map((r) => [r.epd, r.eco, r.name, r.uci]);
mkdirSync(`${root}apps/api/data`, { recursive: true });
mkdirSync(`${root}apps/web/public/data`, { recursive: true });
writeFileSync(`${root}apps/api/data/openings.json`, JSON.stringify(compact));
writeFileSync(`${root}apps/web/public/data/openings.json`, JSON.stringify(compact));
console.log(`${rows.length} openings written`);
