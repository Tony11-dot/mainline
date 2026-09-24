import { expect, test } from '@playwright/test';
import { dragMove, expectPiece } from './helpers';

test.use({ serviceWorkers: 'allow' });

test('installable, works offline, stays cross-origin isolated', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('MainLine');
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  expect(manifest.share_target.action).toBe('/import');

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the SW
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Warm the runtime caches used offline.
  await page.goto('/explore');
  await expect(page.locator('.ml-board piece').first()).toBeVisible();

  await context.setOffline(true);
  await page.goto('/explore?moves=e2e4');
  await expect(page.locator('.ml-board piece').first()).toBeVisible();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  await dragMove(page, 'e7', 'e5');
  await expectPiece(page, 'e5', 'black pawn');
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Repertoire', exact: true })).toBeVisible();
  await context.setOffline(false);
});
