import { expect, test } from '@playwright/test';

test('app shell renders and is cross-origin isolated', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mainline.prefs', JSON.stringify({ onboarded: true })));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(true);
});

test('tab bar: slide a finger across the tabs and lift to switch (Android)', async ({ page }, info) => {
  test.skip(info.project.name !== 'android');
  await page.addInitScript(() => localStorage.setItem('mainline.prefs', JSON.stringify({ onboarded: true })));
  await page.goto('/');
  const bar = (await page.locator('[data-web-tabbar]').boundingBox())!;
  const y = bar.y + bar.height / 2;
  const x = (i: number) => bar.x + (bar.width / 5) * (i + 0.5);
  const cdp = await page.context().newCDPSession(page);
  const tp = (px: number) => [{ x: px, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(x(0)) });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x(0) + ((x(3) - x(0)) * i) / 12) });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  }
  // While sliding, the tab under the finger lights up; the route hasn't changed yet.
  await expect(page.locator('[data-web-tabbar]').getByRole('link', { name: 'Games' })).toHaveClass(/bg-brand-soft/);
  await expect(page).toHaveURL(/\/$/);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page).toHaveURL(/\/games$/);
  // A plain tap still works.
  await page.locator('[data-web-tabbar]').getByRole('link', { name: 'Explore' }).tap();
  await expect(page).toHaveURL(/\/explore$/);
});
