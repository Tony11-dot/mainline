// Engine lines from the app's own Stockfish 19 build (the `stockfish` package, full NNUE, single
// thread, run under Node) for every trained position that Lichess has no cloud eval for — or when
// cloud-eval is rate-limiting. Results are written in the cloud-eval response shape into the same
// cache facts.mjs reads (marked source "local"), so the packets look the same either way.
//   node scripts/hints/local-eval.mjs [--workers 8] [--depth 20] [--only-missing]
// Scores are converted to White's point of view, as Lichess reports them.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(HERE, 'work');
const CACHE = path.join(WORK, 'lichess');
const flag = (n, d) => (process.argv.indexOf(n) > 0 ? process.argv[process.argv.indexOf(n) + 1] : d);
const DEPTH = Number(flag('--depth', '20'));
const WORKERS = Number(flag('--workers', '8'));

const epdToFen = (epd) => `${epd.trim().split(/\s+/).slice(0, 4).join(' ')} 0 1`;
const urlFor = (epd, multiPv) => `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(epdToFen(epd))}&multiPv=${multiPv}`;
const fileFor = (url) => path.join(CACHE, createHash('sha1').update(url).digest('hex') + '.json');

if (process.argv.includes('--worker')) {
  // Child: evaluate the jobs from stdin JSON, one engine, one at a time.
  const jobs = JSON.parse(fs.readFileSync(0, 'utf8'));
  const require = createRequire(import.meta.url);
  const engine = await require('stockfish')('single');
  let lines = [];
  let resolveDone;
  engine.listener = (line) => {
    lines.push(line);
    if (line.startsWith('bestmove') || line === 'uciok' || line === 'readyok') resolveDone?.();
  };
  const send = (cmd) => new Promise((r) => { resolveDone = r; engine.sendCommand(cmd); });
  const fire = (cmd) => engine.sendCommand(cmd);
  await send('uci');
  fire('setoption name Threads value 1');
  fire('setoption name Hash value 64');
  await send('isready');
  let n = 0;
  for (const { epd, multiPv } of jobs) {
    const file = fileFor(urlFor(epd, multiPv));
    if (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).status === 200) continue;
    fire(`setoption name MultiPV value ${multiPv}`);
    fire('ucinewgame');
    fire(`position fen ${epdToFen(epd)}`);
    lines = [];
    await send(`go depth ${DEPTH}`);
    const black = epd.split(/\s+/)[1] === 'b';
    const best = new Map(); // multipv index → last info line at the deepest depth
    for (const l of lines) {
      const m = /^info depth (\d+) seldepth \d+ multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/.exec(l);
      if (!m) continue;
      const [, depth, idx, kind, val, pv] = m;
      const prev = best.get(idx);
      if (!prev || Number(depth) >= prev.depth) best.set(idx, { depth: Number(depth), kind, val: Number(val), pv });
    }
    const pvs = [...best.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([, b]) => {
      const sign = black ? -1 : 1;
      return { moves: b.pv.split(' ').slice(0, 10).join(' '), ...(b.kind === 'mate' ? { mate: sign * b.val } : { cp: sign * b.val }) };
    });
    if (!pvs.length) continue;
    const depth = Math.min(...[...best.values()].map((b) => b.depth));
    fs.writeFileSync(file, JSON.stringify({ url: urlFor(epd, multiPv), status: 200, source: 'local', body: { fen: epdToFen(epd), knodes: 0, depth, pvs } }));
    n++;
    if (n % 10 === 0) process.send?.({ n });
  }
  process.send?.({ done: n });
  process.exit(0);
}

// Parent: the jobs are every trained position (multiPv 3) and the position after its move (multiPv 1)
// that has no 200 answer cached yet (a cloud eval, or an earlier local one).
const { positions } = JSON.parse(fs.readFileSync(path.join(WORK, 'positions.json'), 'utf8'));
const { Chess } = await import('chessops/chess');
const { parseFen, makeFen } = await import('chessops/fen');
const { parseUci } = await import('chessops/util');
const afterEpd = (epd, uci) => {
  const pos = Chess.fromSetup(parseFen(epdToFen(epd)).unwrap()).unwrap();
  pos.play(parseUci(uci));
  return makeFen(pos.toSetup(), { epd: true });
};
const seen = new Set();
const jobs = [];
for (const p of positions) {
  for (const [epd, multiPv] of [[p.epd, 3], [afterEpd(p.epd, p.uci), 1]]) {
    const key = `${epd}|${multiPv}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const f = fileFor(urlFor(epd, multiPv));
    if (fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).status === 200) continue;
    jobs.push({ epd, multiPv });
  }
}
console.log(`${jobs.length} evaluations to compute locally (depth ${DEPTH}, ${WORKERS} workers)`);
if (!jobs.length) process.exit(0);
const t0 = Date.now();
let total = 0;
await Promise.all(
  Array.from({ length: WORKERS }, (_, i) => {
    const shard = jobs.filter((_, j) => j % WORKERS === i);
    return new Promise((resolve, reject) => {
      const child = fork(fileURLToPath(import.meta.url), ['--worker', '--depth', String(DEPTH)], { stdio: ['pipe', 'inherit', 'inherit', 'ipc'] });
      child.on('message', (m) => {
        if (m.n) {
          total += 10;
          if (total % 100 === 0) console.log(`local evals ${total}/${jobs.length}  ${((Date.now() - t0) / 60000).toFixed(1)} min`);
        }
      });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker ${i} exited ${code}`))));
      child.stdin.end(JSON.stringify(shard));
    });
  }),
);
console.log(`done: ${jobs.length} local evaluations in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
