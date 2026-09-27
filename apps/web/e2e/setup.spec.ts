import { expect, test } from '@playwright/test';
import { stubApi } from './stubs';
import { pieceAt, squareCenter } from './helpers';

test('board editor: place pieces, validate, analyse with the engine', async ({ page }, info) => {
  await stubApi(page);
  await page.addInitScript(() => localStorage.setItem('mainline.prefs', JSON.stringify({ onboarded: true })));
  await page.goto('/explore');
  await page.getByRole('link', { name: 'Set up position' }).click();
  await expect(page.getByRole('heading', { name: 'Set up position' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/Legal position/);

  await page.getByRole('button', { name: 'Clear board' }).click();
  await expect(page.getByRole('status')).toHaveText(/board is empty/);

  // Tap a palette piece, then squares.
  const place = async (label: string, sq: string) => {
    await page.getByRole('button', { name: label }).click();
    await page.locator('.ml-board').scrollIntoViewIfNeeded();
    const c = await squareCenter(page, sq);
    await page.mouse.click(c.x, c.y);
  };
  await place('Place white king', 'g1');
  await expect(page.getByRole('status')).toHaveText(/one king/);
  await place('Place black king', 'g8');
  await place('Place white queen', 'd4');
  await expect(page.locator('#setup-fen')).toHaveValue(/^6k1\/8\/8\/8\/3Q4\/8\/8\/6K1 w - - 0 1$/);
  await expect(page.getByRole('status')).toHaveText(/Legal position/);

  // A pasted FEN applies straight away.
  await page.locator('#setup-fen').fill('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
  await expect(page.getByRole('status')).toHaveText(/Legal position/);
  await page.screenshot({ path: `test-results/shots/setup-${info.project.name}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Analyse with engine' }).click();
  await expect(page).toHaveURL(/\/explore\?fen=/);
  await expect(page.getByLabel('Engine analysis')).toBeChecked();
  // The analysis board shows the set-up position, not the starting one.
  await expect.poll(() => pieceAt(page, 'f3')).toBe('white knight');
  await expect.poll(() => pieceAt(page, 'c6')).toBe('black knight');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/shots/setup-analyse-${info.project.name}.png` });
});
