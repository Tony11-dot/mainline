import { expect, test } from '@playwright/test';
import { expectPiece } from './helpers';
import { stubApi } from './stubs';

const ex = (moves: [string, string, number][]) => {
  const ms = moves.map(([uci, san, n]) => ({ uci, san, white: Math.round(n * 0.45), draws: Math.round(n * 0.2), black: n - Math.round(n * 0.45) - Math.round(n * 0.2), total: n }));
  const t = ms.reduce((a, m) => a + m.total, 0);
  return { source: 'lichess', epd: '', white: t / 2, draws: 0, black: t / 2, total: t, moves: ms, topGames: [], opening: null, fetchedAt: '', cached: true };
};

test('guided: suggestions for both sides; their reply is always yours to pick; your other lines come first', async ({ page }, info) => {
  test.skip(info.project.name === 'android');
  await stubApi(page, {
    explorer: (url) => {
      const fen = url.searchParams.get('fen') ?? '';
      if (fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/')) return ex([['e2e4', 'e4', 900], ['d2d4', 'd4', 700], ['g1f3', 'Nf3', 200]]);
      if (fen.startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/')) return ex([['c7c5', 'c5', 600], ['e7e5', 'e5', 400]]);
      return ex([]);
    },
  });
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New folder…' }).click();
  const sheet = page.getByRole('dialog', { name: 'New folder' });
  await sheet.getByLabel(/^Name/).fill('Guided');
  await sheet.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: /^New line/ }).click();

  const panel = page.getByRole('region', { name: 'Your move' });
  await expect(panel.getByRole('button', { name: /^e4/ })).toBeVisible();
  await panel.getByRole('button', { name: /^e4/ }).click();
  // Their likely replies are suggested, not played for them.
  const theirs = page.getByRole('region', { name: 'Their move' });
  await expect(theirs.getByRole('button', { name: /^c5/ })).toBeVisible();
  await expect(theirs.getByRole('button', { name: /^e5/ })).toBeVisible();
  await page.waitForTimeout(800);
  await expectPiece(page, 'c5', null);
  await theirs.getByRole('button', { name: /^e5/ }).click();
  await expectPiece(page, 'e5', 'black pawn');
  const tree = page.getByRole('tree', { name: 'Moves' });
  await expect(tree.getByRole('treeitem', { name: 'e5' })).toHaveAttribute('aria-selected', 'true');

  // Nothing plays for them: back on e4, their move waits for you.
  await tree.getByRole('treeitem', { name: 'e4' }).click();
  await page.waitForTimeout(800);
  await expect(tree.getByRole('treeitem', { name: 'e4' })).toHaveAttribute('aria-selected', 'true');

  // Rename from the header.
  await page.getByRole('button', { name: /^Rename/ }).click();
  await page.getByRole('textbox', { name: 'Rename' }).fill('Sicilian prep');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Sicilian prep' })).toBeVisible();

  // A second line in the folder: what the first line plays is suggested first.
  await page.getByRole('link', { name: 'Back to repertoire' }).click();
  await page.getByRole('button', { name: /^New line/ }).click();
  await expect(page.getByRole('heading', { name: 'Line 2' })).toBeVisible();
  const first = page.getByRole('region', { name: 'Your move' }).getByRole('listitem').first();
  await expect(first.getByRole('button', { name: /^e4/ })).toBeVisible();
  await expect(first).toContainText('In your other lines');
});
