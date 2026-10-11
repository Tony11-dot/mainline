import { expect, test } from '@playwright/test';
import { dragMove, tapMove } from './helpers';
import { stubApi } from './stubs';

test.beforeEach(async ({ page }) => stubApi(page));

test('the tour: every chapter, the practice board, contents, and back to Today', async ({ page }, info) => {
  test.skip(info.project.name === 'android');
  const move = info.project.name === 'phone' ? tapMove : dragMove;
  await page.goto('/guide');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to MainLine' })).toBeVisible();
  // Immersive on phones: no tab bar while the tour runs.
  await expect(page.locator('[data-web-tabbar]')).toHaveCount(0);
  const next = page.getByRole('button', { name: 'Next' });
  const progress = page.getByRole('progressbar', { name: 'How MainLine works' });

  // Walk to the training chapter with Next and the arrow keys.
  for (let i = 1; i < 7; i++) await next.click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { level: 1, name: 'How training works' })).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '8');

  // Learn with the arrow, then the same position from memory; a wrong move is corrected first.
  const phase = page.locator('[data-phase]');
  await expect(phase).toHaveAttribute('data-phase', 'learn');
  await move(page, 'f1', 'c4');
  await expect(phase).toHaveAttribute('data-phase', 'await', { timeout: 5000 });
  await move(page, 'f1', 'b5');
  await expect(phase).toHaveAttribute('data-phase', 'wrong');
  await expect(page.getByText('Not quite — it’s Bc4')).toBeVisible();
  await move(page, 'f1', 'c4');
  await expect(phase).toHaveAttribute('data-phase', 'done');
  await expect(page.getByText('Line complete')).toBeVisible();

  // Contents jumps anywhere; Back steps back.
  await page.getByRole('button', { name: 'Contents' }).click();
  await page.getByRole('dialog', { name: 'Contents' }).getByRole('button', { name: 'Check your real games' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Check your real games' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Goal, streak and reminders' })).toBeVisible();

  // To the end, and done: back to Today.
  while (await next.isVisible()) await next.click();
  await expect(page.getByRole('heading', { level: 1, name: 'You’re ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: /How MainLine works/ })).toBeVisible();
});

test('Today offers the tour until it is taken or dismissed, and it resumes where it was left', async ({ page }, info) => {
  test.skip(info.project.name === 'android');
  // A profile from before the tour existed: it has never been offered.
  await page.goto('/');
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('mainline.prefs') ?? '{}');
    localStorage.setItem('mainline.prefs', JSON.stringify({ ...p, guideSeen: false, guideAt: 0 }));
  });
  await page.reload();
  const offer = page.getByTestId('guide-offer');
  await expect(offer).toContainText('A five-minute tour of everything in the app.');
  await offer.getByRole('link').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  // "Open it in the app" leaves the tour on its chapter; Today then offers to pick it up.
  await page.getByRole('button', { name: 'Open it in the app' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(offer).toContainText('Pick up the tour where you left it.');
  await offer.getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today: your daily start' })).toBeVisible();
  await page.goto('/');
  await offer.getByRole('button', { name: 'Dismiss' }).click();
  await expect(offer).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect(offer).toHaveCount(0);
});
