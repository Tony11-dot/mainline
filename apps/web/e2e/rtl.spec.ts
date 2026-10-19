import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectPiece } from './helpers';
import { stubApi } from './stubs';

const he = JSON.parse(readFileSync(new URL('../../../packages/shared/locales/he.json', import.meta.url), 'utf8')) as Record<string, string>;

test.beforeEach(async ({ page }) => {
  await stubApi(page);
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('mainline.prefs') ?? '{}');
    localStorage.setItem('mainline.prefs', JSON.stringify({ ...prefs, locale: 'he' }));
  });
});

test('Hebrew lays the app out right to left, but never the board', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('link', { name: he['Explore'] }).first()).toBeVisible();

  // White's pieces stay bottom-left to bottom-right, a1 to h1, as on a real board.
  await expect(page.locator('.ml-board piece').first()).toBeVisible();
  expect(await page.locator('.ml-board').first().evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
  await expectPiece(page, 'a1', 'white rook');
  await expectPiece(page, 'e1', 'white king');
  await expectPiece(page, 'h8', 'black rook');

  // Mirrored layouts often push something off the side of the screen.
  for (const path of ['/', '/library', '/explore', '/settings']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
});
