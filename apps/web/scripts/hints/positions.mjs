// Step 1 of the pack-hint pipeline: every position the ready-made packs train.
// A position is trained when it is the pack's side to move and the line prescribes a main move; the
// same (position, move) reached through several packs or lines is one entry. Writes work/positions.json.
//   node scripts/hints/positions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { loadApp, WEB, WORK } from './load.mjs';

const { packs: P, shared: S, close } = await loadApp();

// The CC0 opening table the app ships; the most specific name along the path to a position.
const openings = new Map();
for (const [epd, eco, name] of JSON.parse(fs.readFileSync(path.join(WEB, 'public/data/openings.json'), 'utf8'))) if (!openings.has(epd)) openings.set(epd, { eco, name });

const out = new Map();
let lineCount = 0;
for (const p of P.PACKS) {
  const rootMoves = P.packMoves(p);
  const root = S.rootFromMoves(rootMoves);
  for (const l of p.lines) {
    lineCount++;
    const res = S.importPgn(l.pgn, { id: `${p.id}:${l.id}`, color: p.color, rootEpd: root.epd });
    if (res.errors.length) throw new Error(`${p.id}:${l.id}: ${res.errors.join('; ')}`);
    const g = S.buildGraph(res.moves);
    for (const line of S.lines(g, root.epd, { mainlineOnlyFor: p.color })) {
      let pos = S.positionFromFen(S.INITIAL_FEN);
      const path = [];
      let opening = null;
      const step = (uci) => {
        const played = S.playUci(pos, uci);
        pos = played.pos;
        path.push(played.uci);
        opening = openings.get(played.epd) ?? opening;
      };
      for (const u of rootMoves) step(u);
      for (const m of line.moves) {
        if (S.isOwnTurn(p.color, m.fromEpd)) {
          const key = `${m.fromEpd} ${m.uci}`;
          const e = out.get(key) ?? { key, epd: m.fromEpd, fen: S.toFen(pos), uci: m.uci, san: m.san, color: p.color, ply: path.length, path: [...path], opening, sources: [] };
          const src = `${p.id}:${l.id}`;
          if (!e.sources.includes(src)) e.sources.push(src);
          out.set(key, e);
        }
        step(m.uci);
      }
    }
  }
}
const positions = [...out.values()].sort((a, b) => a.ply - b.ply || a.key.localeCompare(b.key));
fs.mkdirSync(WORK, { recursive: true });
fs.writeFileSync(path.join(WORK, 'positions.json'), JSON.stringify({ generated: new Date().toISOString(), packs: P.PACKS.length, lines: lineCount, count: positions.length, positions }, null, 1));
const byColor = positions.reduce((a, p) => ((a[p.color] = (a[p.color] ?? 0) + 1), a), {});
console.log(`${P.PACKS.length} packs, ${lineCount} lines → ${positions.length} trained positions (${JSON.stringify(byColor)}); plies ${positions[0].ply}–${positions.at(-1).ply}; ${positions.filter((p) => p.opening).length} with an opening name`);
await close();
