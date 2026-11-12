/**
 * The App Store screenshot demo (tools/store-screenshots/capture.sh).
 *
 * Compiled in ONLY when the web app is built with VITE_STORE_DEMO=1: main.tsx imports this module behind
 * that flag, so a store build has no trace of it. On a simulator it gives the app a believable player —
 * a library of real lines, a few weeks of training history, a streak, their own games and a next opponent —
 * with every /api/ call answered here (nothing reaches the server). The capture script writes the scene to
 * play into the app's `Documents/store-demo/scene.txt`, launches the app and waits for `ready.txt` beside it.
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { cardEpds, graphsByRep, newCardState, rootFromMoves, scheduleCard, type Color, type PlayedGame, type ReviewEntry, type TrainCard } from '@mainline/shared';
import { db } from '../lib/idb';
import { useLibrary } from '../lib/library';
import { useTraining } from '../lib/training';
import { usePrefs, type Prefs } from '../lib/prefs';
import { useGames } from '../lib/games';
import { useLaunch } from '../launch/LaunchScreen';

const SEED = 'store-demo-2';
const DAY = 86_400_000;
const ME = 'tony_plays';
const RIVAL = 'ClubRival';

/* ── Explorer numbers ────────────────────────────────────────────────────────────────────────────
 * Club-level (1600–1800, blitz + rapid) and master-game counts for the positions on screen:
 * [uci, san, games, white win %, draw %]. Shaped like the real databases: 1.e4/1.d4 lead, the Italian's
 * 3...Bc5 and 3...Nf6 split, the Caro-Kann's 3.e5 is White's most popular reply at this level.
 */
type Row = [string, string, number, number, number];
const CLUB: Record<string, Row[]> = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': [['e2e4', 'e4', 4_120_000, 50, 4], ['d2d4', 'd4', 3_010_000, 51, 5], ['g1f3', 'Nf3', 880_000, 50, 6], ['c2c4', 'c4', 410_000, 51, 6]],
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': [['e7e5', 'e5', 1_560_000, 49, 4], ['c7c5', 'c5', 1_210_000, 48, 4], ['e7e6', 'e6', 520_000, 50, 5], ['c7c6', 'c6', 440_000, 49, 5], ['d7d5', 'd5', 310_000, 52, 4]],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w': [['g1f3', 'Nf3', 980_000, 51, 4], ['f1c4', 'Bc4', 220_000, 52, 4], ['b1c3', 'Nc3', 140_000, 50, 5], ['d2d4', 'd4', 96_000, 51, 4]],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b': [['b8c6', 'Nc6', 610_000, 50, 4], ['d7d6', 'd6', 180_000, 54, 4], ['g8f6', 'Nf6', 110_000, 51, 5]],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w': [['f1c4', 'Bc4', 240_000, 53, 4], ['f1b5', 'Bb5', 150_000, 52, 5], ['d2d4', 'd4', 120_000, 53, 4], ['b1c3', 'Nc3', 52_000, 51, 5]],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b': [['f8c5', 'Bc5', 84_000, 50, 5], ['g8f6', 'Nf6', 79_000, 49, 4], ['h7h6', 'h6', 23_000, 56, 3], ['f8e7', 'Be7', 19_000, 55, 4], ['d7d6', 'd6', 16_000, 55, 4]],
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w': [['c2c3', 'c3', 31_000, 52, 5], ['e1g1', 'O-O', 18_000, 50, 5], ['d2d3', 'd3', 14_000, 51, 6], ['b2b4', 'b4', 6_100, 52, 4]],
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b': [['g8f6', 'Nf6', 22_000, 51, 5], ['d7d6', 'd6', 4_300, 53, 5], ['d8e7', 'Qe7', 2_900, 50, 6]],
  'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w': [['d2d4', 'd4', 96_000, 52, 4], ['f1b5', 'Bb5', 31_000, 51, 6], ['b1c3', 'Nc3', 21_000, 51, 5]],
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w': [['d2d4', 'd4', 260_000, 51, 5], ['b1c3', 'Nc3', 72_000, 50, 5], ['g1f3', 'Nf3', 41_000, 50, 6]],
  'rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR b': [['d7d5', 'd5', 230_000, 51, 5]],
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w': [['e4e5', 'e5', 92_000, 51, 5], ['b1c3', 'Nc3', 51_000, 50, 6], ['e4d5', 'exd5', 47_000, 50, 6], ['b1d2', 'Nd2', 12_000, 50, 6]],
  'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b': [['c8f5', 'Bf5', 71_000, 50, 6], ['c6c5', 'c5', 13_000, 52, 5], ['e7e6', 'e6', 4_800, 54, 5]],
  'rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/8/PPP2PPP/RNBQKBNR w': [['g1f3', 'Nf3', 26_000, 51, 6], ['b1c3', 'Nc3', 12_000, 52, 5], ['f1d3', 'Bd3', 9_600, 48, 6], ['c2c3', 'c3', 4_100, 50, 7]],
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w': [['c2c4', 'c4', 210_000, 51, 6], ['c1f4', 'Bf4', 160_000, 51, 5], ['g1f3', 'Nf3', 120_000, 50, 6], ['e2e3', 'e3', 64_000, 49, 6]],
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b': [['e7e6', 'e6', 72_000, 51, 7], ['c7c6', 'c6', 41_000, 50, 7], ['d5c4', 'dxc4', 48_000, 52, 6], ['b8c6', 'Nc6', 9_000, 55, 4]],
};
/** Master games (2200+ over the board) for the same positions. */
const MASTERS: Record<string, Row[]> = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': [['e2e4', 'e4', 1_010_000, 33, 37], ['d2d4', 'd4', 820_000, 34, 40], ['g1f3', 'Nf3', 270_000, 33, 42], ['c2c4', 'c4', 190_000, 34, 41]],
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': [['c7c5', 'c5', 420_000, 32, 34], ['e7e5', 'e5', 230_000, 34, 39], ['e7e6', 'e6', 140_000, 33, 37], ['c7c6', 'c6', 98_000, 31, 41]],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w': [['g1f3', 'Nf3', 190_000, 35, 39], ['b1c3', 'Nc3', 14_000, 33, 37], ['f1c4', 'Bc4', 6_200, 34, 33]],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b': [['b8c6', 'Nc6', 150_000, 35, 39], ['g8f6', 'Nf6', 25_000, 31, 46], ['d7d6', 'd6', 9_800, 38, 35]],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w': [['f1b5', 'Bb5', 92_000, 34, 43], ['f1c4', 'Bc4', 29_000, 35, 36], ['d2d4', 'd4', 16_000, 37, 33], ['b1c3', 'Nc3', 8_400, 31, 44]],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b': [['f8c5', 'Bc5', 15_000, 35, 38], ['g8f6', 'Nf6', 11_000, 34, 37], ['f8e7', 'Be7', 1_300, 38, 37]],
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w': [['c2c3', 'c3', 6_900, 36, 39], ['e1g1', 'O-O', 3_100, 33, 39], ['d2d3', 'd3', 2_400, 35, 41], ['b2b4', 'b4', 1_500, 38, 31]],
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w': [['d2d4', 'd4', 82_000, 34, 41], ['b1c3', 'Nc3', 9_000, 33, 40], ['g1f3', 'Nf3', 5_100, 35, 37]],
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w': [['e4e5', 'e5', 31_000, 35, 40], ['b1c3', 'Nc3', 23_000, 34, 42], ['b1d2', 'Nd2', 13_000, 33, 45], ['e4d5', 'exd5', 9_800, 31, 47]],
  'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b': [['c8f5', 'Bf5', 26_000, 35, 40], ['c6c5', 'c5', 3_900, 37, 37]],
};

function explorerAnswer(url: URL) {
  const key = (url.searchParams.get('fen') ?? '').split(' ').slice(0, 2).join(' ');
  const source = url.searchParams.get('source') === 'masters' ? 'masters' : 'lichess';
  const rows = (source === 'masters' ? MASTERS : CLUB)[key] ?? [];
  const moves = rows.map(([uci, san, total, w, d]) => {
    const white = Math.round((total * w) / 100);
    const draws = Math.round((total * d) / 100);
    return { uci, san, white, draws, black: total - white - draws, total, averageRating: source === 'masters' ? 2410 : 1690 };
  });
  const sum = (k: 'white' | 'draws' | 'black' | 'total') => moves.reduce((a, m) => a + m[k], 0);
  return { source, epd: '', white: sum('white'), draws: sum('draws'), black: sum('black'), total: sum('total'), moves, topGames: [], opening: null, fetchedAt: new Date().toISOString(), cached: true };
}

/* ── Games ───────────────────────────────────────────────────────────────────────────────────── */

const HANDLES = ['pawnstorm', 'knightowl', 'rook_lift', 'bishoppair', 'zugzwanger', 'fianchetto', 'castle_long', 'endgame_eli', 'tempo_tom', 'gambit_gal', 'outpost', 'hanging_pawn'];
/** `n` games down one line, spread over the last few weeks, with a believable spread of results. */
function games(tag: string, n: number, color: Color, line: string, wins: number): PlayedGame[] {
  const seed = [...tag].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  return Array.from({ length: n }, (_, i) => {
    const k = (seed + i * 97) % 1009;
    return {
      id: `lichess:${tag}${i}`,
      site: 'lichess',
      url: `https://lichess.org/${tag}${i}`,
      color,
      opponent: HANDLES[k % HANDLES.length]!,
      opponentRating: 1540 + (k % 210),
      result: i / n < wins ? 'win' : i % 3 === 0 ? 'draw' : 'loss',
      speed: k % 4 === 0 ? 'rapid' : 'blitz',
      playedAt: Date.now() - ((k % 40) + 1) * DAY + k * 60_000,
      ucis: line.split(' '),
    };
  });
}

/** Your own games: some reach the end of your prep, some leave it (your slip or their surprise). */
const MY_GAMES = [
  ...games('it', 6, 'white', 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6 e1g1 e8g8 f1e1 a7a6 a2a4 h7h6', 0.6),
  ...games('tk', 4, 'white', 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5', 0.3),
  ...games('si', 5, 'white', 'e2e4 c7c5 g1f3 d7d6', 0.4),
  ...games('ph', 3, 'white', 'e2e4 e7e5 g1f3 d7d6', 0.7),
  ...games('qp', 2, 'white', 'd2d4 d7d5', 0.5),
  ...games('ck', 5, 'black', 'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 b8d7 e1g1 g8e7 c2c3', 0.6),
  ...games('cn', 3, 'black', 'e2e4 c7c6 b1c3 d7d5', 0.3),
  ...games('qh', 3, 'black', 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 h7h6', 0.3),
  ...games('qg', 4, 'black', 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6 g5h4 b7b6 c4d5', 0.5),
  ...games('en', 2, 'black', 'c2c4 e7e5', 0.5),
];

/** The next opponent's games (their colour): what they answer to 1.e4, and what they open with. */
const RIVAL_GAMES = [
  ...games('rtk', 22, 'black', 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5 c2c3 d7d6', 0.55),
  ...games('rsv', 14, 'black', 'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5', 0.6),
  ...games('rgp', 8, 'black', 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6 e1g1 e8g8 f1e1 a7a6 a2a4', 0.4),
  ...games('rfr', 5, 'black', 'e2e4 e7e6 d2d4 d7d5', 0.4),
  ...games('rca', 18, 'white', 'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 b8d7 e1g1 g8e7', 0.5),
  ...games('rcn', 12, 'white', 'e2e4 c7c6 b1c3 d7d5 g1f3 c8g4 h2h3 g4f3 d1f3 e7e6', 0.6),
  ...games('rqx', 9, 'white', 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c4d5 e6d5 c1g5 c7c6 e2e3 f8e7', 0.5),
  ...games('rre', 4, 'white', 'g1f3 d7d5 g2g3', 0.5),
];

/* ── What the coach and the assistant say ────────────────────────────────────────────────────── */

/** The coach on 3.Bc4 in the Italian, in line with the explorer numbers above. */
const COACH =
  '3.Bc4 points the bishop at f7, the one square only the king defends, and gets White ready to castle. ' +
  'Against 3...Bc5 the usual plan is c3 and d3: a slow centre where both sides finish developing first, then White looks for d4. ' +
  'If Black plays 3...Nf6 instead, 4.d3 keeps the game calm, while 4.Ng5 goes straight for f7. ' +
  'At your level 3.Bc4 is the most played move here and scores 53% for White.';

const ASSISTANT =
  'Against the Two Knights (3...Nf6) your line plays **4.d3**: no early fight, just a sound centre. Three things to know:\n\n' +
  '1. **Castle first.** After 4...Be7 5.O-O O-O 6.Re1 d6 7.c3, White keeps d4 in reserve and the bishop on c4 stays useful.\n' +
  '2. **Watch ...d5.** If Black frees the game with ...d5, take on d5 and keep the bishop: it has nowhere better.\n' +
  '3. **Your games.** You left your prep at move 4 in two of your last four games here. Review the line once before your next game.';

/* ── Network ─────────────────────────────────────────────────────────────────────────────────── */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function answer(url: URL, init?: RequestInit): Response {
  const path = url.pathname.replace(/^.*?\/api\//, '/api/');
  if (path === '/api/explorer') return json(explorerAnswer(url));
  if (path === '/api/guide') {
    const ex = (source: string) => {
      const u = new URL(url);
      u.searchParams.set('source', source);
      return explorerAnswer(u);
    };
    return json({ epd: '', lichess: ex('lichess'), masters: ex('masters'), eval: null, children: {} });
  }
  if (path === '/api/eval' || path === '/api/openings/at') return json({ eval: null });
  if (path === '/api/me') return json({ me: null });
  if (path === '/api/auth/providers') return json({ lichess: true, chesscom: true });
  if (path === '/api/games') {
    const user = url.searchParams.get('user');
    if (url.searchParams.get('site') !== 'lichess') return json({ games: [] });
    return json({ games: user === RIVAL ? RIVAL_GAMES : user === ME ? MY_GAMES : [] });
  }
  if (path === '/api/coach') return json({ text: COACH, source: 'ai', facts: {} });
  if (path === '/api/assistant') return json({ text: ASSISTANT });
  void init;
  // Anything else (sync, push, sign-in) is out of reach in the demo: the app treats it as not configured.
  return json({ error: 'not_configured', message: 'Not in the screenshot demo' }, 503);
}

function stubNetwork() {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, location.href);
    if (url.pathname.includes('/api/')) {
      await new Promise((r) => setTimeout(r, 60));
      return answer(url, init);
    }
    return real(input, init);
  };
}

/* ── The player ──────────────────────────────────────────────────────────────────────────────── */

/** Deterministic randomness, so every capture shows the same history. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LIBRARY: { folder: string; color: Color; parent?: string; lines: { name: string; pgn: string }[] }[] = [
  {
    folder: 'Italian Game',
    color: 'white',
    lines: [
      { name: 'Giuoco Piano', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 (5... a6 6. O-O d6 7. a4) 6. O-O O-O 7. Re1 a6 (7... a5 8. Nbd2) 8. a4 *' },
      { name: 'Two Knights, 4.d3', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Be7 (4... Bc5 5. c3 d6 6. O-O) 5. O-O O-O 6. Re1 d6 7. c3 *' },
      { name: 'Philidor and Petrov', pgn: '1. e4 e5 2. Nf3 d6 (2... Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4) 3. d4 exd4 (3... Nf6 4. Nc3 Nbd7 5. Bc4) 4. Nxd4 Nf6 5. Nc3 Be7 6. Be2 *' },
    ],
  },
  {
    folder: 'Caro-Kann',
    color: 'black',
    lines: [
      { name: 'Advance, 4.Nf3', pgn: '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 Nd7 (5... c5 6. O-O Nc6) 6. O-O Ne7 7. c3 h6 *' },
      { name: 'Classical', pgn: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 *' },
      { name: 'Exchange', pgn: '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3 Nc6 5. c3 Nf6 6. Bf4 Bg4 7. Qb3 Qd7 *' },
    ],
  },
  {
    folder: "Queen's Gambit Declined",
    color: 'black',
    lines: [
      { name: 'Orthodox, 4.Bg5', pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6 8. cxd5 Nxd5 *' },
      { name: 'Exchange', pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 c6 6. e3 Be7 7. Bd3 O-O *' },
    ],
  },
];

async function seedLibrary() {
  const lib = useLibrary.getState();
  await lib.load();
  for (const group of LIBRARY) {
    const root = useLibrary.getState().folders.find((f) => !f.deleted && f.parentId === null && f.color === group.color);
    const folder = await useLibrary.getState().createFolder(group.folder, group.color, root?.id ?? null);
    for (const line of group.lines) {
      const rep = await useLibrary.getState().createRepertoire({ name: line.name, color: group.color, folderId: folder.id });
      await useLibrary.getState().importPgn(rep.id, `[Event "${line.name}"]\n\n${line.pgn}`);
    }
  }
}

/**
 * A few weeks of training: most positions learned on the days the player added them, then reviewed when
 * FSRS asked, with the odd slip; a handful are due now and the newest lines are still to learn.
 */
async function seedTraining() {
  const { reps, moves } = useLibrary.getState();
  const graphs = graphsByRep({ reps, moves });
  const rand = rng(1601);
  const now = Date.now();
  const cards = new Map<string, TrainCard>();
  const mainMove = new Map<string, string>();
  const reviews: ReviewEntry[] = [];
  let id = 0;
  const live = reps.filter((r) => !r.deleted);
  live.forEach((rep, ri) => {
    const epds = cardEpds(graphs.get(rep.id)!, rep.rootEpd, rep.color);
    // The last line of each folder was added recently: some of it is still to learn.
    const fresh = ri === live.length - 1 || rep.name === 'Exchange';
    epds.forEach((epd, i) => {
      const key = `${rep.color}|${epd}`;
      if (cards.has(key)) return;
      if (fresh && i >= 2) return;
      const expected = [graphs.get(rep.id)!.get(epd)!.find((m) => m.isMainline)!.uci];
      mainMove.set(key, expected[0]!);
      let t = now - (34 - ri * 3 - Math.floor(rand() * 4)) * DAY + Math.floor(rand() * 8) * 3600_000;
      let state = newCardState(t);
      let mode: ReviewEntry['mode'] = 'learn';
      for (let n = 0; n < 12 && t < now - 3600_000; n++) {
        const r = rand();
        const rating = (mode === 'learn' ? 3 : r < 0.08 ? 1 : r < 0.2 ? 2 : r < 0.9 ? 3 : 4) as 1 | 2 | 3 | 4;
        state = scheduleCard(state, rating, t);
        reviews.push({ id: `demo-r${id++}`, cardEpd: epd, color: rep.color, rating, playedUci: rating === 1 ? null : expected[0]!, expectedUci: expected, mode, msTaken: 1800 + Math.floor(rand() * 4200), reviewedAt: t, updatedAt: t });
        mode = 'review';
        // Players review when it is due, give or take a day.
        t = Math.max(t + 3600_000, state.due + Math.floor(rand() * DAY));
      }
      cards.set(key, { color: rep.color, epd, kind: 'repertoire', fsrs: state, due: state.due, lastReview: state.last_review ?? null, updatedAt: now });
    });
  });
  // The Two Knights is the player's weak line: the moves after 4.d3 keep slipping (as in their games).
  const twoKnights = live.find((r) => r.name === 'Two Knights, 4.d3');
  if (twoKnights) {
    cardEpds(graphs.get(twoKnights.id)!, twoKnights.rootEpd, twoKnights.color).forEach((epd, i) => {
      const move = mainMove.get(`white|${epd}`);
      if (!move || i < 3) return;
      for (let k = 0; k < 3; k++) {
        const at = now - (2 + k * 4 + i) * DAY + 20 * 3600_000 - now % 3600_000;
        reviews.push({ id: `demo-r${id++}`, cardEpd: epd, color: 'white', rating: 1, playedUci: null, expectedUci: [move], mode: 'review', msTaken: 9000, reviewedAt: at, updatedAt: at });
      }
    });
  }
  // Practice every day for the last 23 days (drills keep the streak without moving the schedule), and
  // part of today's goal done already.
  const startToday = new Date(now).setHours(0, 0, 0, 0);
  const days = new Set(reviews.map((r) => new Date(r.reviewedAt).setHours(0, 0, 0, 0)));
  const any = [...cards.values()];
  for (let d = 0; d < 23; d++) {
    const day = startToday - d * DAY;
    const count = d === 0 ? 14 : days.has(day) ? 0 : 6;
    for (let k = 0; k < count; k++) {
      const c = any[Math.floor(rand() * any.length)]!;
      // Today's: the last half hour (never before midnight); other days': the evening.
      const at = d === 0 ? Math.max(day + 60_000 + k * 1000, now - 30 * 60_000 + k * 90_000) : day + 19 * 3600_000 + k * 60_000;
      if (at > now - 30_000) continue;
      const move = mainMove.get(`${c.color}|${c.epd}`)!;
      reviews.push({ id: `demo-r${id++}`, cardEpd: c.epd, color: c.color, rating: 3, playedUci: move, expectedUci: [move], mode: d === 0 ? 'review' : 'drill', msTaken: 2500, reviewedAt: at, updatedAt: at });
    }
  }
  const d = await db();
  const tx = d.transaction(['cards', 'reviews'], 'readwrite');
  for (const c of cards.values()) await tx.objectStore('cards').put(c);
  for (const r of reviews) await tx.objectStore('reviews').put(r);
  await tx.done;
  useTraining.setState({ loaded: false, cards: [], reviews: [] });
  await useTraining.getState().load();
}

async function seed() {
  if (localStorage.getItem('mainline.demo.seed') === SEED) return;
  await seedLibrary();
  await seedTraining();
  usePrefs.getState().set({ lichessUser: ME });
  await useGames.getState().importAll({ quiet: true });
  localStorage.setItem('mainline.demo.seed', SEED);
}

/* ── Scenes ──────────────────────────────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function waitFor<T>(find: () => T | null | undefined | false, what: string, timeout = 20_000): Promise<T> {
  const until = Date.now() + timeout;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() > until) throw new Error(`demo: ${what} never appeared`);
    await sleep(120);
  }
}

const all = <E extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<E>(sel)];
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === 'fixed';
const button = (label: string | RegExp) => all('button, a, [role=tab], [role=treeitem], [role=option], [role=menuitem]').find((e) => visible(e) && (typeof label === 'string' ? text(e) === label || e.getAttribute('aria-label') === label : label.test(text(e))));
const labelled = <E extends Element = HTMLElement>(label: string) => all<E>(`[aria-label="${label}"]`).find(visible);

function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Scrolls the page so `el` sits `gap` points below the status bar. */
function scrollBelowTop(el: Element, gap = 12) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;padding-top:env(safe-area-inset-top);visibility:hidden';
  document.body.appendChild(probe);
  const safe = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - safe - gap);
}

async function navigate(to: string) {
  const { router } = await import('../App');
  await router.navigate(to);
}

/** Every scene starts from the same look: MainLine's own light theme, the engine off, the guide off. */
function look(p: Partial<Pick<Prefs, 'appTheme' | 'engineOn' | 'guided'>> = {}) {
  usePrefs.getState().set({ appTheme: 'system', engineOn: false, guided: false, ...p });
}

/** Opens a line of the library at the position after `ucis` (from the start), optionally on a panel. */
async function openLine(name: string, ucis: string[], pane?: string) {
  const rep = await waitFor(() => useLibrary.getState().reps.find((r) => !r.deleted && r.name === name), `the line ${name}`);
  await navigate(`/rep/${rep.id}?at=${encodeURIComponent(rootFromMoves(ucis).epd)}`);
  await waitFor(() => document.querySelector('.cg-wrap piece'), 'the board');
  if (pane) {
    (await waitFor(() => all('[role=tab]').find((e) => visible(e) && text(e) === pane), `the ${pane} tab`)).click();
  }
}

const ITALIAN = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'];

/** Phones show one column: scenes scroll what they are about into view there. */
const narrow = () => window.innerWidth < 768;
/** Waits for something that usually comes, but carries on without it after `ms`. */
async function settleFor(find: () => unknown, ms: number) {
  const until = Date.now() + ms;
  while (!find() && Date.now() < until) await sleep(150);
}
const hasText = (sel: string, re: RegExp) => all(sel).find((e) => visible(e) && re.test(text(e)));

/** The line editor's "The line" card (on a phone, scrolled to the top so the panels under it show). */
const lineCard = () => hasText('h2, h3', /^The line$/)!;


/** The phone's line editor stacks header, board, controls, "The line", then the rest; these find the pieces. */
function phoneStack() {
  let w = lineCard() as HTMLElement;
  while (w.parentElement && !w.parentElement.className.includes('max-w-[640px]')) w = w.parentElement;
  const kids = Array.from(w.parentElement!.children) as HTMLElement[];
  return { kids, line: kids.indexOf(w), board: kids.findIndex((k) => k.querySelector('.cg-wrap')), tabs: kids.findIndex((k) => k.querySelector('[role=tablist]')) };
}
function stackOrNull() {
  try { return phoneStack(); } catch { return null; }
}
/** A phone's board as one part of the screen, not all of it: narrower, so the list under it shows. */
function shrinkBoard(frac: number) {
  const s = stackOrNull();
  if (!s || s.board < 0) return;
  s.kids[s.board]!.style.maxWidth = `${(narrow() ? frac : frac * 0.85) * 100}vw`;
  // The engine's bar above the board is hidden: at this size it reads as a stray black rule.
  if (s.board > 1) s.kids[s.board - 1]!.style.display = 'none';
}
/** Hides the stack's pieces from `from` up to (not including) `to`. */
function hideKids(from: (s: ReturnType<typeof phoneStack>) => number, to: (s: ReturnType<typeof phoneStack>) => number) {
  const s = stackOrNull();
  if (!s || s.tabs < 0) return;
  s.kids.slice(from(s), to(s)).forEach((k) => (k.style.display = 'none'));
}

const SCENES: Record<string, () => Promise<void>> = {
  // Today: what to practise, the streak, the goal.
  today: async () => {
    look();
    await navigate('/');
    await waitFor(() => button(/Train now|Learn new moves/), 'Today’s primary action');
    await settleFor(() => hasText('span, p', /^Work on this$/), 8000);
  },
  // Opponent prep: a rival's real lines against your repertoire.
  opponent: async () => {
    look();
    await navigate('/games');
    const input = await waitFor(() => labelled<HTMLInputElement>('Opponent username'), 'opponent field');
    fill(input, RIVAL);
    await frames();
    button('Analyse')!.click();
    await waitFor(() => all('h3, h2, p, span').find((e) => text(e).startsWith(`${RIVAL}:`)), 'opponent results');
    await sleep(400);
    const sec = document.getElementById('opponent')!;
    for (let p = sec.previousElementSibling as HTMLElement | null; p; p = p.previousElementSibling as HTMLElement | null) p.style.display = 'none';
    await frames();
    scrollBelowTop(sec, 14);
  },
  // Your games: where each one left your prep.
  games: async () => {
    look();
    await navigate('/games');
    await waitFor(() => all('dl').find(visible), 'games summary');
    await sleep(300);
  },
  // Building: the Italian after 3.Bc4, Black's replies at club level.
  build: async () => {
    look({ engineOn: true });
    await openLine('Giuoco Piano', ITALIAN, 'Explorer');
    (await waitFor(() => all('[role=tab]').find((e) => visible(e) && /^Lichess ·/.test(text(e))), 'the club tab')).click();
    shrinkBoard(0.5);
    hideKids((s) => s.line, (s) => s.tabs);
    await sleep(3500);
  },
  // The explorer on its own: the same position, club games, the engine on.
  explore: async () => {
    look({ engineOn: true });
    await navigate(`/explore?moves=${ITALIAN.join(',')}`);
    await waitFor(() => document.querySelector('.cg-wrap piece'), 'the board');
    (await waitFor(() => all('[role=tab]').find((e) => visible(e) && /^Lichess ·/.test(text(e))), 'the club tab')).click();
    await sleep(5000);
  },
  // The guide: your move after 2...Nc6, rated for you.
  guide: async () => {
    look({ guided: true, engineOn: true });
    await openLine('Giuoco Piano', ITALIAN.slice(0, 4));
    await waitFor(() => all('section[aria-label]').find((e) => /Your move|Their move/.test(e.getAttribute('aria-label') ?? '') && e.querySelectorAll('button').length > 3), 'the guide’s candidates');
    shrinkBoard(0.5);
    hideKids((s) => s.line, (s) => s.line + 1);
    await sleep(7000);
  },
  // The coach on 3.Bc4, at night.
  coach: async () => {
    look({ appTheme: 'midnight' });
    await openLine('Giuoco Piano', ITALIAN, 'Coach');
    await waitFor(() => all('p, span, div').find((e) => text(e).startsWith('3.Bc4 points the bishop')), 'the coach’s answer');
    hideKids((s) => 1, (s) => s.line);
    await sleep(500);
  },
  library: async () => {
    look();
    await navigate('/library');
  },
  focus: async () => {
    look();
    await navigate('/focus');
    await settleFor(() => hasText('h2, h3', /lead to trouble|Openings|Lines/), 10000);
    await sleep(600);
  },
  plan: async () => {
    look();
    await navigate('/plan');
  },
  stats: async () => {
    look();
    await navigate('/stats');
    await waitFor(() => hasText('figcaption span', /^Reviews per day$/), 'the reviews chart');
    await sleep(800);
  },
  learn: async () => {
    look();
    await navigate('/train?mode=learn');
    await waitFor(() => document.querySelector('[data-phase=learn]'), 'a new move');
    await sleep(2500);
  },
  review: async () => {
    look();
    await navigate('/train?mode=review');
    await waitFor(() => document.querySelector('[data-phase=await]'), 'your turn');
    await sleep(800);
  },
  settings: async () => {
    look();
    await navigate('/settings');
  },
};

async function writeReady(scene: string, error?: string) {
  document.documentElement.dataset.demoReady = error ? `ERROR ${error}` : scene;
  try {
    await Filesystem.writeFile({ path: 'store-demo/ready.txt', directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true, data: error ? `${scene}\nERROR ${error}` : scene });
  } catch {
    /* the capture script times out and says so */
  }
}

/** The scene to play, written by the capture script into the app's Documents before it launches the app. */
async function sceneToPlay(): Promise<string | null> {
  // In a browser (a quick look at a scene without the simulator): ?demo=<scene>.
  const asked = new URLSearchParams(location.search).get('demo');
  if (asked) return asked;
  try {
    const { data } = await Filesystem.readFile({ path: 'store-demo/scene.txt', directory: Directory.Documents, encoding: Encoding.UTF8 });
    return String(data).trim() || null;
  } catch {
    return null;
  }
}

async function playScene() {
  const asked = await sceneToPlay();
  if (!asked) return;
  // "z-<scene>": the same scene with everything drawn 1.3x larger (iPad panels, where the UI is small on a big screen).
  const zoomed = asked.startsWith('z-');
  const scene = zoomed ? asked.slice(2) : asked;
  try {
    await waitFor(() => localStorage.getItem('mainline.demo.seed') === SEED, 'the seed', 90_000);
    // The launch animation is switched on just before the first render: wait for the app, then for it to finish.
    await waitFor(() => document.querySelector('main'), 'the app');
    await sleep(400);
    await waitFor(() => !useLaunch.getState().active && !document.querySelector('[data-testid=launch-screen]'), 'the end of the launch animation', 30_000);
    await sleep(300);
    if (zoomed) (document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = '1.3';
    const run = SCENES[scene];
    if (!run) throw new Error(`no scene ${scene}`);
    await run();
    await document.fonts.ready;
    await sleep(900);
    await frames();
    await writeReady(asked);
  } catch (e) {
    await writeReady(asked, (e as Error).message);
  }
}

export async function installStoreDemo() {
  stubNetwork();
  usePrefs.getState().set({ rating: 1600, engineOn: false, onboarded: true, guideSeen: true, remindersOn: false });
  void seed().catch((e) => console.error('demo seed failed', e));
  void playScene();
}
