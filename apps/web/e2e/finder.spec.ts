import { expect, test } from '@playwright/test';
import { dragMove, item, openItem } from './helpers';
import { stubApi } from './stubs';

test.beforeEach(async ({ page }) => stubApi(page));

async function addPack(page: import('@playwright/test').Page, name: string) {
  await page.goto('/library/ready?color=white&first=e4');
  await page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
}

test('the library works like Finder: systems nest under the reply, select, new folder, rename, drag in, undo', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await addPack(page, 'Vienna Game');
  await addPack(page, 'Ruy Lopez');

  // White › 1.e4 › Open Games (1…e5) › Vienna Game / Ruy Lopez, also in the sidebar.
  await page.goto('/library');
  await openItem(page, '1.e4');
  await openItem(page, 'Open Games (1…e5)');
  await expect(item(page, 'Vienna Game')).toBeVisible();
  await expect(item(page, 'Ruy Lopez')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Folders' }).getByRole('link', { name: 'Open Games (1…e5)' })).toBeVisible();

  // ⌘-click selects several; Escape clears.
  await item(page, 'Vienna Game').click();
  await item(page, 'Ruy Lopez').click({ modifiers: ['ControlOrMeta'] });
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('2 selected')).toHaveCount(0);

  // A new folder: name it, it opens; back out and it's in the list.
  await page.getByRole('button', { name: /^New folder/ }).click();
  await page.getByRole('dialog', { name: 'New folder' }).getByLabel(/^Name/).fill('Sharp stuff');
  await page.getByRole('dialog', { name: 'New folder' }).getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sharp stuff' })).toBeVisible();
  await page.goBack();
  await expect(item(page, 'Sharp stuff')).toBeVisible();

  // Drag a system into it; undo puts it back.
  await item(page, 'Vienna Game').dragTo(item(page, 'Sharp stuff'));
  await expect(item(page, 'Vienna Game')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(item(page, 'Vienna Game')).toBeVisible();

  // Right-click → Move to… works too, and Enter renames the selection.
  await item(page, 'Vienna Game').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move to…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sharp stuff' }).click();
  await expect(item(page, 'Vienna Game')).toHaveCount(0);
  await openItem(page, 'Sharp stuff');
  await expect(item(page, 'Vienna Game')).toBeVisible();
  await item(page, 'Vienna Game').click();
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Rename' }).fill('Vienna (f4 lines)');
  await page.keyboard.press('Enter');
  await expect(item(page, 'Vienna (f4 lines)')).toBeVisible();
});

test('a study plan: built for a focus, sessions tick off as you finish them', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import PGN' }).click();
  const imp = page.getByRole('dialog', { name: 'Import PGN' });
  await imp.locator('textarea').fill('[Event "Scotch"]\n\n1. e4 e5 2. Nf3 *');
  await imp.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported \d+ moves/)).toBeVisible();

  await page.goto('/plan');
  await page.getByRole('button', { name: 'Make a plan' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Make a plan' });
  await sheet.getByRole('tab', { name: '3', exact: true }).click();
  await sheet.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByText('Day 1 of 3 · 0 of')).toBeVisible();

  // Day 1 opens with the moves shown; finishing that session ticks it off.
  await page.getByRole('listitem').filter({ hasText: /^Show me/ }).first().getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'You play e4' })).toBeVisible();
  await dragMove(page, 'e2', 'e4');
  await expect(page.getByRole('heading', { name: 'You play Nf3' })).toBeVisible();
  await dragMove(page, 'g1', 'f3');
  // Done: the summary (or today's streak celebration) replaces the board.
  await expect(page.locator('[data-phase]')).toHaveCount(0);
  await page.goto('/plan');
  await expect(page.getByText(/Day 1 of 3 · 1 of/)).toBeVisible();
  // Today shows today's sessions.
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Study plan' })).toBeVisible();
});
