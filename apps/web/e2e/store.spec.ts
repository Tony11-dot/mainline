import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stubApi } from './stubs';
import { clickMove } from './helpers';

/**
 * Store screenshots, straight from the app: `STORE_SHOTS=1 pnpm e2e store --project=desktop`.
 * Output: apps/mobile/store/screenshots/{iphone,ipad,android}/NN-name.png at the exact sizes each store asks for,
 * each one the app screen under a caption. STORE_RAW=<dir> also keeps the bare app captures there.
 */
test.skip(!process.env.STORE_SHOTS, 'set STORE_SHOTS=1 to regenerate store screenshots');
// One device at a time: three browsers running the engine at once starve each other into timeouts.
test.describe.configure({ mode: 'serial' });

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mobile/store/screenshots');

const devices = {
  // App Store 6.9" iPhone: 1320 × 2868
  iphone: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  // App Store 13" iPad: 2064 × 2752
  ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  // Google Play phone: 1080 × 1920 (16:9)
  android: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
} as const;
type Device = keyof typeof devices;

/** Caption type and spacing per canvas, in CSS px. */
const FRAME: Record<Device, { title: number; sub: number; top: number; gap: number; shot: number; pad: number; width: number; radius: number }> = {
  iphone: { title: 44, sub: 22, top: 58, gap: 14, shot: 34, pad: 26, width: 86, radius: 34 },
  ipad: { title: 58, sub: 28, top: 72, gap: 16, shot: 44, pad: 64, width: 84, radius: 44 },
  android: { title: 33, sub: 17, top: 36, gap: 10, shot: 22, pad: 20, width: 86, radius: 26 },
};

/** Plausible club-level explorer numbers for the positions on screen: [uci, san, games, white %, draw %]. */
type Row = [string, string, number, number, number];
const BOOK: Record<string, Row[]> = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': [['e2e4', 'e4', 412_000, 49, 5], ['d2d4', 'd4', 301_000, 50, 6], ['g1f3', 'Nf3', 88_000, 50, 7], ['c2c4', 'c4', 41_000, 51, 6]],
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': [['e7e5', 'e5', 156_000, 48, 5], ['c7c5', 'c5', 121_000, 47, 5], ['e7e6', 'e6', 52_000, 50, 5], ['c7c6', 'c6', 44_000, 48, 6]],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w': [['g1f3', 'Nf3', 98_000, 51, 5], ['b1c3', 'Nc3', 14_000, 50, 5], ['f1c4', 'Bc4', 22_000, 52, 4]],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b': [['b8c6', 'Nc6', 61_000, 50, 5], ['d7d6', 'd6', 18_000, 54, 5], ['g8f6', 'Nf6', 11_000, 51, 5]],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w': [['f1c4', 'Bc4', 24_000, 53, 4], ['f1b5', 'Bb5', 15_000, 52, 6], ['d2d4', 'd4', 12_000, 53, 5], ['b1c3', 'Nc3', 5_200, 51, 6]],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b': [['f8c5', 'Bc5', 8_400, 50, 6], ['g8f6', 'Nf6', 7_900, 49, 5], ['h7h6', 'h6', 2_300, 56, 4], ['f8e7', 'Be7', 1_900, 55, 5], ['d7d6', 'd6', 1_600, 55, 5]],
};

function explorer(url: URL) {
  const key = (url.searchParams.get('fen') ?? '').split(' ').slice(0, 2).join(' ');
  const moves = (BOOK[key] ?? []).map(([uci, san, total, w, d]) => {
    const white = Math.round((total * w) / 100);
    const draws = Math.round((total * d) / 100);
    return { uci, san, white, draws, black: total - white - draws, total, averageRating: 1620 };
  });
  const sum = (k: 'white' | 'draws' | 'black' | 'total') => moves.reduce((a, m) => a + m[k], 0);
  return { source: url.searchParams.get('source'), epd: '', white: sum('white'), draws: sum('draws'), black: sum('black'), total: sum('total'), moves, topGames: [], opening: null, fetchedAt: new Date().toISOString(), cached: true };
}

/** The coach on 3.Bc4 of the Italian: what the AI coach says there, grounded in the stubbed stats. */
const COACH =
  '3.Bc4 points the bishop at f7, the one square only the king defends, and gets White ready to castle. ' +
  'Against 3...Bc5 the usual plan is c3 and d3: a slow centre where both sides finish developing first. ' +
  'If Black plays 3...Nf6 instead, 4.d3 keeps the game calm, while 4.Ng5 goes straight for f7. ' +
  'At your level 3.Bc4 is the most popular move here and scores 53% for White.';

type Game = { id: string; site: 'lichess'; url: string; color: 'white' | 'black'; opponent: string; opponentRating: number; result: 'win' | 'draw' | 'loss'; speed: string; playedAt: number; ucis: string[] };
const HANDLES = ['pawnstorm', 'knightowl', 'rook_lift', 'bishoppair', 'zugzwanger', 'fianchetto', 'castle_long', 'endgame_eli', 'tempo_tom', 'gambit_gal', 'outpost', 'hanging_pawn'];
/** `n` games down one line, spread over the last few weeks, with a believable spread of results. */
function games(tag: string, n: number, color: 'white' | 'black', line: string, wins: number): Game[] {
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
      playedAt: Date.now() - ((k % 60) + 1) * 86_400_000 + k * 60_000,
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
const RIVAL = 'ClubRival';
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

async function importPgn(page: Page, pgn: string, color: 'White' | 'Black' = 'White') {
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import PGN' }).click();
  const imp = page.getByRole('dialog', { name: 'Import PGN' });
  await imp.locator('textarea').fill(pgn);
  if (color === 'Black') await imp.getByRole('tab', { name: 'Black' }).click();
  await imp.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported \d+ moves/)).toBeVisible();
}

async function seed(page: Page) {
  await stubApi(page, { explorer });
  await page.route('**/api/games?**', (r) => r.fulfill({ json: { games: new URL(r.request().url()).searchParams.get('user') === RIVAL ? RIVAL_GAMES : MY_GAMES } }));
  await page.route('**/api/coach', (r) => r.fulfill({ json: { text: COACH, source: 'ai', facts: {} } }));
  await page.addInitScript(() => {
    const p = JSON.parse(localStorage.getItem('mainline.prefs') ?? '{}');
    localStorage.setItem('mainline.prefs', JSON.stringify({ ...p, rating: 1600, engineOn: false }));
  });
  // A lit 12-day streak for the header flame.
  await page.goto('/');
  await page.evaluate(async () => {
    const day = 86_400_000;
    const req = indexedDB.open('mainline');
    const db: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const tx = db.transaction('reviews', 'readwrite');
    for (let i = 0; i < 12; i++) {
      const at = Date.now() - 60_000 - i * day;
      tx.objectStore('reviews').put({ id: `s${i}`, cardEpd: 'x', color: 'white', rating: 3, playedUci: 'e2e4', expectedUci: ['e2e4'], mode: 'review', msTaken: 1000, reviewedAt: at, updatedAt: at });
    }
    await new Promise((r) => (tx.oncomplete = r));
    db.close();
  });
  await importPgn(page, '[Event "Italian Game"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 (3... Nf6 4. d3 Be7 5. O-O) (3... Be7 4. d4) 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 a6 8. a4 *');
  await importPgn(page, '[Event "Caro-Kann"]\n\n1. e4 c6 2. d4 d5 3. e5 (3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6) (3. exd5 cxd5 4. Bd3 Nc6) 3... Bf5 4. Nf3 e6 5. Be2 Nd7 6. O-O Ne7 *', 'Black');
  await importPgn(page, '[Event "Queen\'s Gambit Declined"]\n\n1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 (4. cxd5 exd5 5. Bg5 c6) 4... Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6 *', 'Black');
}

/**
 * The app as it is on screen, scrolled (as far as the page goes) to put `top` just below the top edge.
 * `room` pads the page's end so `top` can always get there.
 */
async function capture(page: Page, top?: Locator, room = false) {
  await page.evaluate(() => document.fonts.ready);
  if (room) await page.evaluate(() => (document.body.style.paddingBottom = `${window.innerHeight}px`));
  if (top) await top.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 6));
  // Clicking a tab below the fold scrolls to it; other shots start at the top of the page (board first).
  else await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  if (process.env.STORE_RAW) {
    const dir = path.join(process.env.STORE_RAW, 'full');
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${Date.now()}.png`), fullPage: true, animations: 'disabled', caret: 'hide' });
  }
  return page.screenshot({ animations: 'disabled', caret: 'hide' });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The capture under its caption, on a brand-blue (or ink, for dark-theme shots) canvas the size of the device. */
async function frame(context: BrowserContext, device: Device, name: string, png: Buffer, title: string, sub: string, tone: 'brand' | 'ink' = 'brand') {
  if (process.env.STORE_RAW) {
    mkdirSync(path.join(process.env.STORE_RAW, device), { recursive: true });
    writeFileSync(path.join(process.env.STORE_RAW, device, `${name}.png`), png);
  }
  const f = FRAME[device];
  const bg = tone === 'brand' ? '#072eb8' : '#0c1222';
  const glow = tone === 'brand' ? 'color-mix(in oklab, #072eb8 78%, white)' : 'color-mix(in oklab, #0c1222 82%, #6f86ff)';
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; height: 100%; }
    body { display: flex; flex-direction: column; align-items: center; overflow: hidden; color: #fff;
      background: radial-gradient(130% 55% at 50% 0%, ${glow} 0%, ${bg} 70%);
      font-family: -apple-system, 'SF Pro Display', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    h1 { margin: ${f.top}px ${f.pad}px 0; font-size: ${f.title}px; line-height: 1.08; font-weight: 700; letter-spacing: -0.022em; text-align: center; text-wrap: balance; }
    p { margin: ${f.gap}px ${f.pad}px 0; max-width: 32ch; font-size: ${f.sub}px; line-height: 1.35; font-weight: 500; color: rgb(255 255 255 / 0.84); text-align: center; text-wrap: balance; }
    img { flex: none; margin-top: ${f.shot}px; width: ${f.width}%; border-radius: ${f.radius}px;
      box-shadow: 0 0 0 1px rgb(255 255 255 / 0.16), 0 28px 80px rgb(0 0 0 / 0.38); }
  </style></head><body><h1>${esc(title)}</h1><p>${esc(sub)}</p><img alt="" src="data:image/png;base64,${png.toString('base64')}"></body></html>`);
  await page.waitForFunction(() => document.images[0]?.complete);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, device, `${name}.png`), animations: 'disabled' });
  await page.close();
}

for (const [device, use] of Object.entries(devices) as [Device, (typeof devices)[Device]][]) {
  test.describe(device, () => {
    test.use(use);

    test(`${device} store screenshots`, async ({ page, context }, info) => {
      test.skip(info.project.name !== 'desktop');
      test.setTimeout(180_000);
      await seed(page);

      // Captured in this order so imported games (forgotten moves fall due) don't change Today and Learn.
      // 6. Today: a few minutes of practice, and the tools.
      await page.goto('/');
      await expect(page.getByRole('link', { name: /Learn new moves/ })).toBeVisible();
      await frame(context, device, '06-today', await capture(page), 'A few minutes a day', 'Free, with no ads and no paywall. Works offline.');

      // 5. Learn: new moves are shown, then played from memory.
      await page.goto('/');
      await page.getByRole('link', { name: /Learn new moves/ }).click();
      const prompt = page.getByRole('heading', { name: /^New move: / });
      await expect(prompt).toBeVisible();
      const first = ((await prompt.textContent()) ?? '').replace('New move: ', '').trim();
      // Learn opens with the first move of one of the seeded repertoires.
      const squares = ({ e4: ['e2', 'e4'], c6: ['c7', 'c6'], d5: ['d7', 'd5'] } as Record<string, [string, string]>)[first];
      if (!squares) throw new Error(`unexpected first move ${first}`);
      await clickMove(page, ...squares);
      await expect(prompt).not.toHaveText(`New move: ${first}`);
      await expect(prompt).toBeVisible();
      await frame(context, device, '05-learn', await capture(page), 'Remember every line', 'Spaced repetition brings each position back before you forget it');

      // 3. Build: the repertoire builder with real-game stats.
      await page.goto('/library');
      await page.getByRole('option', { name: /Italian Game/ }).first().dblclick();
      const tree = page.getByRole('tree', { name: 'Moves' });
      await tree.getByRole('treeitem', { name: 'Bc4' }).first().click();
      await page.getByRole('tab', { name: 'Explorer' }).click();
      await expect(page.getByText('Bc5').first()).toBeVisible();
      await frame(context, device, '03-build', await capture(page, page.getByRole('region', { name: device === 'ipad' ? 'The line' : 'Their move' }), device === 'ipad'), 'Pick moves that score at your level', 'Real-game stats, master games and Stockfish on your device');

      // 4. Coach: why a move is played, in a dark theme.
      await page.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('mainline.prefs') ?? '{}');
        localStorage.setItem('mainline.prefs', JSON.stringify({ ...p, appTheme: 'midnight' }));
      });
      await page.reload();
      await page.getByRole('tree', { name: 'Moves' }).getByRole('treeitem', { name: 'Bc4' }).first().click();
      await page.getByRole('tab', { name: 'Coach' }).click();
      await expect(page.getByText(/points the bishop at f7/)).toBeVisible();
      await frame(context, device, '04-coach', await capture(page, device === 'ipad' ? page.getByRole('region', { name: 'The line' }) : page.getByRole('tablist', { name: 'Panel' }), device === 'ipad'), 'Ask why a move is played', 'Answers grounded in the engine and real-game stats', 'ink');
      await page.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('mainline.prefs') ?? '{}');
        localStorage.setItem('mainline.prefs', JSON.stringify({ ...p, appTheme: undefined }));
      });

      // 1. Opponent prep: a rival's real lines against your repertoire.
      await page.goto('/games');
      await page.getByLabel('Opponent username').fill(RIVAL);
      await page.getByRole('button', { name: 'Analyse' }).click();
      await expect(page.getByText(`${RIVAL}: ${RIVAL_GAMES.length} recent games`)).toBeVisible();
      await frame(context, device, '01-opponent', await capture(page, page.locator('#opponent')), 'Know what your next opponent plays', 'Their real lines, from their own games, checked against your repertoire');

      // 2. Your games: where each one left your prep.
      await page.goto('/games');
      await page.getByLabel('Lichess username').fill('me');
      await page.getByRole('button', { name: 'Import games' }).click();
      await expect(page.getByText(/Imported \d+ games/)).toBeVisible();
      await expect(page.getByText(/Imported \d+ games/)).toBeHidden({ timeout: 15_000 });
      await page.getByRole('tab', { name: 'Forgotten' }).click();
      await frame(context, device, '02-games', await capture(page, page.locator('dl').first()), 'See where each game left your prep', 'Moves you forgot in a real game go straight back into review');
    });
  });
}
