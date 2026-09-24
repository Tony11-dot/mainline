import { expect, test } from '@playwright/test';
import { stubApi } from './stubs';

test.beforeEach(async ({ page }) => stubApi(page));

test('guests can erase every byte on the device from Settings', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import PGN' }).click();
  const imp = page.getByRole('dialog', { name: 'Import PGN' });
  await imp.locator('textarea').fill('[Event "Scotch"]\n\n1. e4 e5 2. Nf3 Nc6 3. d4 *');
  await imp.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported \d+ moves/)).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Erase data' }).click();
  const sheet = page.getByRole('dialog', { name: 'Erase all data on this device' });
  await expect(sheet).toContainText("can't be undone");
  await sheet.getByRole('button', { name: 'Delete permanently' }).click();

  await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/welcome');
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Build your first repertoire' })).toBeVisible();
  await expect(page.getByText('Scotch')).toHaveCount(0);
});

test('privacy and terms are linked from Settings', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', /\/privacy$/);
  await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', /\/terms$/);
});
