import { expect, test } from '@playwright/test';
import { dragMove, tapMove } from './helpers';

test('first run: level → starter repertoires → learning', async ({ page }, info) => {
  test.skip(info.project.name === 'android');
  await page.route('**/api/**', (r) => r.fulfill({ json: { me: null, eval: null } }));
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('radio', { name: '1800 – 2200' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  // Italian + Caro-Kann are preselected; add the London too.
  await page.getByRole('button', { name: /London System/ }).click();
  await page.getByRole('button', { name: 'Start learning' }).click();
  await expect(page).toHaveURL(/\/train\?mode=learn/);
  await expect(page.getByRole('heading', { name: /New move:/ })).toBeVisible();
  const move = info.project.name === 'phone' ? tapMove : dragMove;
  const phase = page.locator('[data-phase]');
  const uci = (await phase.getAttribute('data-expected'))!;
  await move(page, uci.slice(0, 2), uci.slice(2, 4));
  await page.goto('/library');
  for (const name of ['Italian Game', 'London System', 'Caro-Kann Defence']) await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  // Rating chosen during onboarding is kept.
  await page.goto('/settings');
  await expect(page.getByLabel('Rating')).toHaveValue('2000');
});
