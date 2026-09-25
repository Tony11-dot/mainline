import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stubApi } from './stubs';
import { clickMove } from './helpers';

/**
 * Store screenshots, straight from the app: `STORE_SHOTS=1 pnpm e2e store --project=desktop`.
 * Output: apps/mobile/store/screenshots/{iphone,ipad,android}/NN-name.png at the exact sizes each store asks for.
 */
test.skip(!process.env.STORE_SHOTS, 'set STORE_SHOTS=1 to regenerate store screenshots');

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mobile/store/screenshots');

const devices = {
  // App Store 6.9" iPhone: 1320 × 2868
  iphone: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  // App Store 13" iPad: 2064 × 2752
  ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  // Google Play phone: 1080 × 1920 (16:9)
  android: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
} as const;

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

async function shot(page: Page, device: string, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, device, `${name}.png`), animations: 'disabled', caret: 'hide' });
}

for (const [device, use] of Object.entries(devices)) {
  test.describe(device, () => {
    test.use(use);

    test(`${device} store screenshots`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop');
      test.setTimeout(120_000);
      await seed(page);

      // 1. Build: the repertoire builder with real-game stats.
      await page.goto('/library');
      await page.getByRole('link', { name: /Italian Game/ }).first().click();
      const tree = page.getByRole('tree', { name: 'Moves' });
      await tree.getByRole('treeitem', { name: 'Bc4' }).first().click();
      await page.getByRole('tab', { name: 'Explorer' }).click();
      await expect(page.getByText('Bc5').first()).toBeVisible();
      await shot(page, device, '01-build');

      // 2. Today: what to practise.
      await page.goto('/');
      await expect(page.getByRole('link', { name: /Learn new moves/ })).toBeVisible();
      await shot(page, device, '02-today');

      // 3. Learn: new moves are shown, then played from memory.
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
      await shot(page, device, '03-learn');

      // 4. Library: every repertoire, with mastery at a glance.
      await page.goto('/library');
      await expect(page.getByRole('link', { name: /Queen's Gambit Declined/ }).first()).toBeVisible();
      await shot(page, device, '04-repertoires');

      // 5. Themes: the same builder in a dark theme.
      await page.goto('/settings');
      await page.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('mainline.prefs') ?? '{}');
        localStorage.setItem('mainline.prefs', JSON.stringify({ ...p, appTheme: 'midnight' }));
      });
      await page.goto('/library');
      await page.getByRole('link', { name: /Caro-Kann/ }).first().click();
      await page.getByRole('tree', { name: 'Moves' }).getByRole('treeitem', { name: 'Nd7' }).first().click();
      await shot(page, device, '05-dark');
    });
  });
}
