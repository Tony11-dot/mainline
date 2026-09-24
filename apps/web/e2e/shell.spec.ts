import { expect, test } from '@playwright/test';

test('app shell renders and is cross-origin isolated', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mainline.prefs', JSON.stringify({ onboarded: true })));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(true);
});
