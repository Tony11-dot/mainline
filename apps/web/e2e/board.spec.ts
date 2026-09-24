import { expect, test } from '@playwright/test';
import { clickMove, dragMove, expectPiece, tapMove, touchDrag, squareCenter } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __mlSoundLog: string[] }).__mlSoundLog = [];
  });
  // Explorer/eval need the network; stub them so board tests are hermetic.
  await page.route('**/api/explorer**', (r) => r.fulfill({ json: { source: 'masters', epd: '', white: 0, draws: 0, black: 0, total: 0, moves: [], topGames: [], opening: null, fetchedAt: new Date().toISOString(), cached: true } }));
  await page.route('**/api/eval**', (r) => r.fulfill({ json: { eval: null } }));
});

const sounds = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __mlSoundLog: string[] }).__mlSoundLog);

test('drag and click moves, with animation and sounds (desktop)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/explore');
  await expect(page.locator('.ml-board piece').first()).toBeVisible();
  await dragMove(page, 'e2', 'e4');
  await expectPiece(page, 'e4', 'white pawn');
  await expectPiece(page, 'e2', null);

  // Click-click move animates (piece.anim present during the 200 ms glide).
  const a = await squareCenter(page, 'e7');
  const b = await squareCenter(page, 'e5');
  await page.mouse.click(a.x, a.y);
  await expect(page.locator('.ml-board square.move-dest')).toHaveCount(2);
  await page.evaluate(() => {
    const w = window as unknown as { __sawAnim: boolean };
    w.__sawAnim = false;
    new MutationObserver(() => {
      if (document.querySelector('.ml-board piece.anim')) w.__sawAnim = true;
    }).observe(document.querySelector('.ml-board')!, { subtree: true, attributes: true, childList: true });
  });
  await page.mouse.click(b.x, b.y);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sawAnim: boolean }).__sawAnim)).toBe(true);
  await expectPiece(page, 'e5', 'black pawn');

  await clickMove(page, 'g1', 'f3');
  await dragMove(page, 'b8', 'c6');
  await clickMove(page, 'f1', 'b5');
  await dragMove(page, 'g8', 'f6');
  await clickMove(page, 'e1', 'g1'); // castles by king two squares
  await expectPiece(page, 'f1', 'white rook');
  await expect(page.getByRole('heading', { name: /Berlin/ })).toBeVisible();
  expect(await sounds(page)).toEqual(['move', 'move', 'move', 'move', 'move', 'move', 'castle']);

  // Illegal drop snaps back
  await dragMove(page, 'd7', 'd3');
  await expectPiece(page, 'd7', 'black pawn');

  // Keyboard navigation
  await page.keyboard.press('ArrowLeft');
  await expectPiece(page, 'e1', 'white king');
  await page.keyboard.press('ArrowUp');
  await expectPiece(page, 'e2', 'white pawn');
  await page.keyboard.press('ArrowDown');
  await expectPiece(page, 'g1', 'white king');
  await page.keyboard.press('f');
  await expect(page.locator('.ml-board .cg-wrap.orientation-black')).toHaveCount(1);
  await page.screenshot({ path: `test-results/shots/desktop-explore.png` });
});

test('variations appear in the move tree', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/explore');
  await dragMove(page, 'e2', 'e4');
  await dragMove(page, 'c7', 'c5');
  await page.keyboard.press('ArrowLeft');
  await dragMove(page, 'e7', 'e5');
  const tree = page.getByRole('tree', { name: 'Moves' });
  await expect(tree.getByRole('treeitem', { name: 'c5' })).toBeVisible();
  await expect(tree.getByRole('treeitem', { name: 'e5' })).toHaveAttribute('aria-selected', 'true');
  await tree.getByRole('treeitem', { name: 'c5' }).click();
  await expectPiece(page, 'c5', 'black pawn');
});

test('promotion picker', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/explore?fen=' + encodeURIComponent('8/P7/8/8/8/7k/8/7K w - - 0 1'));
  await dragMove(page, 'a7', 'a8');
  const picker = page.getByRole('dialog', { name: 'Choose promotion piece' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Promote to knight' }).dispatchEvent('pointerdown');
  await expectPiece(page, 'a8', 'white knight');
  expect(await sounds(page)).toEqual(['promote']);
});

test('tap-tap moves on iPhone (WebKit)', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone');
  await page.goto('/explore');
  await expect(page.locator('.ml-board piece').first()).toBeVisible();
  await tapMove(page, 'd2', 'd4');
  await expectPiece(page, 'd4', 'white pawn');
  await tapMove(page, 'g8', 'f6');
  await expectPiece(page, 'f6', 'black knight');
  // Board fills the phone width and there's no horizontal scroll.
  const box = (await page.locator('.ml-board').boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(box.width).toBeGreaterThan(vw - 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/shots/iphone-explore.png` });
});

test('touch drag and long-press arrows on Android (Chromium)', async ({ page }, info) => {
  test.skip(info.project.name !== 'android');
  await page.goto('/explore');
  await expect(page.locator('.ml-board piece').first()).toBeVisible();
  await touchDrag(page, 'e2', 'e4');
  await expectPiece(page, 'e4', 'white pawn');
  await touchDrag(page, 'c7', 'c5');
  await expectPiece(page, 'c5', 'black pawn');
  // Long-press then drag draws an arrow instead of moving.
  await touchDrag(page, 'g1', 'f3', 520);
  await expectPiece(page, 'g1', 'white knight');
  await expect(page.locator('.ml-board .cg-shapes g, .ml-board .cg-shapes line')).not.toHaveCount(0);
  await page.screenshot({ path: `test-results/shots/android-explore.png` });
});
