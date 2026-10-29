// Step 2 of the pack-hint pipeline: a facts packet per trained position, built by the app's own
// buildFacts from Lichess cloud evals and explorer statistics — the same sources the coach uses.
// Nothing here is invented: a position Lichess has no cloud eval for gets a packet with the opening
// name, pawn structure and whatever explorer data exists, marked basis "partial".
//   node scripts/hints/facts.mjs [--no-cloud]   (resumable: every Lichess answer is cached under work/lichess/)
// --no-cloud: ask Lichess for explorer data only; engine lines come from the cache (cloud evals already
// fetched, or local-eval.mjs results), and a position with neither is marked partial.
// Lichess etiquette: one request at a time, a short gap between them, a full 60 s pause after a 429.
// The explorer needs the app's own Lichess token (LICHESS_FALLBACK_TOKEN), read from the main
// checkout's .env and never printed.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadApp, WORK } from './load.mjs';

const ENV_FILE = process.env.MAINLINE_ENV ?? '/Users/tonyaboud/Dev/mainline/.env';
const token = (() => {
  const line = fs.readFileSync(ENV_FILE, 'utf8').split('\n').find((l) => l.startsWith('LICHESS_FALLBACK_TOKEN='));
  const v = line?.slice('LICHESS_FALLBACK_TOKEN='.length).trim().replace(/^"|"$/g, '');
  if (!v) throw new Error(`LICHESS_FALLBACK_TOKEN missing from ${ENV_FILE}`);
  return v;
})();
const NO_CLOUD = process.argv.includes('--no-cloud');
const UA = 'Mainline/0.1 (+https://mainline.app; chess opening trainer; one-time content job)';
/** Club players: the middle of the app's 1200–2200 audience, in the speeds people actually train for. */
const CLUB = { ratings: [1600, 1800], speeds: ['blitz', 'rapid'] };

const { shared: S, close } = await loadApp();
const { positions } = JSON.parse(fs.readFileSync(path.join(WORK, 'positions.json'), 'utf8'));
// --first <json with [{key}]>: gather these positions before the rest (a sample to start evaluating early).
const firstArg = process.argv.indexOf('--first');
const first = new Set(firstArg > 0 ? JSON.parse(fs.readFileSync(process.argv[firstArg + 1], 'utf8')).map((p) => p.key) : []);
positions.sort((x, y) => Number(first.has(y.key)) - Number(first.has(x.key)));
const CACHE = path.join(WORK, 'lichess');
fs.mkdirSync(CACHE, { recursive: true });

const stats = { requests: 0, cached: 0, misses: 0, pauses: 0, timeouts: 0 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Gap between requests per host: the explorer rate-limits harder than cloud-eval.
const GAP = { 'lichess.org': 1500, 'explorer.lichess.org': 1300 };
const last = {};
const strikes = {}; // consecutive 429s per host: the pause doubles each time (60 s, 120 s, 240 s …)
/** JSON from Lichess, or null for a 404 (no data). Cached on disk by URL. */
async function lichess(url, withToken) {
  const file = path.join(CACHE, createHash('sha1').update(url).digest('hex') + '.json');
  if (fs.existsSync(file)) {
    stats.cached++;
    return JSON.parse(fs.readFileSync(file, 'utf8')).body;
  }
  for (let attempt = 0; ; attempt++) {
    const host = new URL(url).host;
    const wait = (GAP[host] ?? 500) - (Date.now() - (last[host] ?? 0));
    if (wait > 0) await sleep(wait);
    last[host] = Date.now();
    stats.requests++;
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': UA, Accept: 'application/json', ...(withToken ? { Authorization: `Bearer ${token}` } : {}) } });
    } catch (e) {
      stats.timeouts++;
      if (attempt >= 4) throw e;
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.status === 429) {
      stats.pauses++;
      strikes[host] = (strikes[host] ?? 0) + 1;
      const pause = 60_000 * 2 ** Math.min(3, strikes[host] - 1);
      process.stdout.write(` [429 from ${host}: pausing ${pause / 1000} s] `);
      await sleep(pause);
      continue;
    }
    strikes[host] = 0;
    if (res.status === 404) {
      stats.misses++;
      fs.writeFileSync(file, JSON.stringify({ url, status: 404, body: null }));
      return null;
    }
    if (!res.ok) {
      if (res.status >= 500 && attempt < 4) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new Error(`Lichess ${res.status} for ${new URL(url).pathname}`);
    }
    const body = await res.json();
    fs.writeFileSync(file, JSON.stringify({ url, status: 200, body }));
    return body;
  }
}

// Lichess may encode castling king-to-rook (e1h1); the app uses e1g1 everywhere (as apps/api/src/services/evals.ts does).
const castling = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };
const normUci = (uci, san) => (san && !san.startsWith('O-O') ? uci : (castling[uci] ?? uci));

/** Cloud eval, or the local Stockfish result local-eval.mjs left in the same cache slot (source "local"). */
async function cloudEval(epd, multiPv) {
  const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(S.epdToFen(epd))}&multiPv=${multiPv}`;
  const cached = path.join(CACHE, createHash('sha1').update(url).digest('hex') + '.json');
  if (NO_CLOUD && !fs.existsSync(cached)) return null;
  // Authenticated like the explorer calls: anonymous cloud-eval requests from one address get rate-limited for long stretches.
  const j = await lichess(url, true);
  if (!j) return null;
  const file = path.join(CACHE, createHash('sha1').update(url).digest('hex') + '.json');
  const source = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')).source ?? 'cloud') : 'cloud';
  return { depth: j.depth, source, lines: j.pvs.map((pv) => ({ moves: pv.moves.split(' ').map((u) => normUci(u)), ...(pv.mate !== undefined ? { mate: pv.mate } : { cp: pv.cp ?? 0 }) })) };
}

/** The shape buildFacts expects (mirrors normalizeExplorer in apps/api/src/services/explorer.ts). */
async function explorer(source, epd) {
  const url = new URL(`https://explorer.lichess.org/${source}`);
  url.searchParams.set('fen', S.epdToFen(epd));
  url.searchParams.set('moves', '15');
  url.searchParams.set('topGames', source === 'masters' ? '8' : '4');
  if (source === 'lichess') {
    url.searchParams.set('recentGames', '0');
    url.searchParams.set('ratings', CLUB.ratings.join(','));
    url.searchParams.set('speeds', CLUB.speeds.join(','));
  }
  const raw = await lichess(url.toString(), true);
  if (!raw) return undefined;
  const total = raw.white + raw.draws + raw.black;
  if (!total) return undefined;
  return {
    source,
    epd,
    white: raw.white,
    draws: raw.draws,
    black: raw.black,
    total,
    moves: raw.moves.map((m) => ({ uci: normUci(m.uci, m.san), san: m.san, white: m.white, draws: m.draws, black: m.black, total: m.white + m.draws + m.black, averageRating: m.averageRating ?? null, opening: m.opening ?? null })),
    topGames: (raw.topGames ?? []).map((g) => ({ id: g.id, uci: g.uci ? normUci(g.uci) : undefined, winner: g.winner, white: g.white, black: g.black, year: g.year, month: g.month })),
    opening: raw.opening ?? null,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
}

const outFile = path.join(WORK, 'facts.json');
const facts = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')).facts : {};
const todo = positions.filter((p) => !facts[p.key]);
const afterEpdOf = (p) => S.playUci(S.positionFromFen(S.epdToFen(p.epd)), p.uci).epd;
const t0 = Date.now();
const minutes = () => ((Date.now() - t0) / 60000).toFixed(1);

// Phase 1: fill the cache — one serial chain per host, side by side, so a host in a long 429
// cooldown only slows its own chain. Phase 2 then builds every packet from the cache.
let evalDone = 0;
let exDone = 0;
await Promise.all([
  (async () => {
    if (NO_CLOUD) return;
    for (const p of todo) {
      await cloudEval(p.epd, 3);
      await cloudEval(afterEpdOf(p), 1);
      if (++evalDone % 50 === 0) console.log(`prefetch cloud-eval ${evalDone}/${todo.length}  (requests ${stats.requests}, cached ${stats.cached}, 429s ${stats.pauses})  ${minutes()} min`);
    }
    console.log(`prefetch cloud-eval done: ${evalDone}/${todo.length}  ${minutes()} min`);
  })(),
  (async () => {
    for (const p of todo) {
      await explorer('masters', p.epd);
      await explorer('lichess', p.epd);
      if (++exDone % 50 === 0) console.log(`prefetch explorer ${exDone}/${todo.length}  (requests ${stats.requests}, cached ${stats.cached}, 429s ${stats.pauses})  ${minutes()} min`);
    }
    console.log(`prefetch explorer done: ${exDone}/${todo.length}  ${minutes()} min`);
  })(),
]);

let done = Object.keys(facts).length;
for (const p of todo) {
  const fen = S.epdToFen(p.epd);
  const [engine, after, masters, club] = [await cloudEval(p.epd, 3), await cloudEval(afterEpdOf(p), 1), await explorer('masters', p.epd), await explorer('lichess', p.epd)];
  const packet = S.buildFacts({ kind: 'move', fen, moveUci: p.uci, opening: p.opening, engine: engine ?? undefined, evalAfterMove: after?.lines[0], lichess: club, masters });
  facts[p.key] = {
    basis: engine ? 'full' : 'partial',
    engineSource: engine?.source ?? null,
    depth: engine?.depth ?? 0,
    mastersGames: masters?.total ?? 0,
    clubGames: club?.total ?? 0,
    facts: packet,
  };
  done++;
  if (done % 100 === 0) fs.writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), club: CLUB, facts }));
}
fs.writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), club: CLUB, facts }));
const full = Object.values(facts).filter((f) => f.basis === 'full').length;
const local = Object.values(facts).filter((f) => f.engineSource === 'local').length;
console.log(`done: ${Object.keys(facts).length}/${positions.length} packets, ${full} full (${local} with local engine lines), ${Object.keys(facts).length - full} partial; ${stats.requests} requests, ${stats.misses} 404s, ${stats.pauses} 429 pauses, ${minutes()} min`);
await close();
