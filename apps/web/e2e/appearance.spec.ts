import { expect, test } from '@playwright/test';
import { stubApi } from './stubs';

test.beforeEach(async ({ page }) => stubApi(page));

test('launch animation plays, is watermark-free, and hands off to the app', async ({ page }, info) => {
  test.skip(info.project.name === 'android');
  await page.goto('/?launch=1');
  const launch = page.getByTestId('launch-screen');
  await expect(launch).toBeVisible();
  await expect(launch.locator('svg').first()).toBeVisible();
  // The Jitter watermark precomp is gone from the shipped animation.
  const anim = await (await page.request.get('/launch.json')).json();
  expect(anim.layers.some((l: { ind: number }) => l.ind === 3)).toBe(false);
  await expect(launch).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

test('launch can be skipped with a tap', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/?launch=1');
  await page.getByTestId('launch-screen').click();
  await expect(page.getByTestId('launch-screen')).toHaveCount(0, { timeout: 1500 });
});

test('theme, font, board and pieces pickers apply everywhere and persist', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/settings');
  await page.getByRole('radio', { name: /Dracula/ }).click();
  await page.getByRole('radio', { name: /Georgia/ }).click();
  await page.getByRole('radio', { name: 'Merida' }).click();
  const vars = () =>
    page.evaluate(() => ({
      brand: document.documentElement.style.getPropertyValue('--brand'),
      theme: document.documentElement.dataset.theme,
      font: document.documentElement.style.getPropertyValue('--font-sans-live'),
      pieces: document.getElementById('ml-pieces')?.textContent ?? '',
    }));
  let v = await vars();
  expect(v.brand).toBe('#BD93F9');
  expect(v.theme).toBe('dark');
  expect(v.font).toContain('Georgia');
  expect(v.pieces).toContain('/pieces/merida/');
  await page.reload();
  v = await vars();
  expect(v.brand).toBe('#BD93F9');
  await page.goto('/explore');
  const bg = await page.locator('.ml-board piece.white.knight').first().evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain('merida');
  await page.goto('/settings');
  await page.getByRole('radio', { name: /System default/ }).click();
  expect((await vars()).brand).toBe('#072EB8');
});
