import { expect, test } from '@playwright/test';
import { dragMove, expectPiece, tapMove } from './helpers';
import { stubApi } from './stubs';

test.beforeEach(async ({ page }) => stubApi(page));

test('create a repertoire, add a line, alternates, delete + undo, PGN import', async ({ page }, info) => {
  test.skip(info.project.name === 'android');
  const move = info.project.name === 'phone' ? tapMove : dragMove;
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Build your first repertoire' })).toBeVisible();
  await page.getByRole('button', { name: 'New repertoire' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'New repertoire' });
  await sheet.getByPlaceholder('e.g. London System').fill('Italian');
  await sheet.getByPlaceholder('1.e4 c5').fill('1.e4 e5 2.Nf3 Nc6');
  await sheet.getByRole('button', { name: 'Create & open' }).click();

  await expect(page.getByRole('heading', { name: 'Italian' })).toBeVisible();
  await expectPiece(page, 'c6', 'black knight');
  await expect(page.getByText('Your move — not decided yet')).toBeVisible();

  await move(page, 'f1', 'c4');
  await expect(page.getByText('2 repl').or(page.getByText('Their move — no replies yet'))).toBeVisible();
  await move(page, 'f8', 'c5');
  await move(page, 'c2', 'c3');
  await expect(page.getByRole('tree', { name: 'Moves' }).getByRole('treeitem', { name: 'c3' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const tree = page.getByRole('tree', { name: 'Moves' });
  await expect(tree.getByRole('treeitem', { name: 'Bc4' })).toHaveAttribute('aria-selected', 'true');
  await move(page, 'g8', 'f6'); // second opponent reply
  await move(page, 'd2', 'd3');
  await expect(tree.getByRole('treeitem', { name: 'Nf6' })).toBeVisible();
  await expect(tree.getByRole('treeitem', { name: 'c3' })).toBeVisible();

  // Alternate at own move
  await page.keyboard.press('ArrowLeft');
  await move(page, 'f3', 'g5');
  await expect(page.getByText(/as an alternate — you play d3 here/)).toBeVisible();
  await page.getByRole('button', { name: 'Make main', exact: true }).click();
  await expect(page.getByText('You play Ng5')).toBeVisible({ timeout: 3000 }).catch(async () => {
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('You play Ng5')).toBeVisible();
  });

  // Delete a branch and undo
  await tree.getByRole('treeitem', { name: 'Nf6' }).click();
  await page.getByRole('button', { name: 'Delete from here' }).click();
  await expect(tree.getByRole('treeitem', { name: 'Nf6' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(tree.getByRole('treeitem', { name: 'Nf6' })).toBeVisible();

  // Persisted across reload (IndexedDB)
  await page.reload();
  await expect(page.getByRole('tree', { name: 'Moves' }).getByRole('treeitem', { name: 'Bc5' })).toBeVisible();

  // Library shows it
  await page.goto('/library');
  await expect(page.getByRole('link', { name: /Italian/ })).toBeVisible();
  await expect(page.getByText(/positions? to know/)).toBeVisible();

  // PGN import into a new repertoire
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Import PGN' }).click();
  const imp = page.getByRole('dialog', { name: 'Import PGN' });
  await imp.locator('textarea').fill('[Event "London"]\n\n1. d4 d5 2. Bf4 (2. Nf3 Nf6 3. Bf4) 2... Nf6 3. e3 *');
  await imp.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported 8 moves/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'London' })).toBeVisible();
});

test('opening library starts a repertoire', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/library/openings');
  await page.getByLabel('Search openings').fill('najdorf english attack');
  await page.getByRole('button', { name: /Najdorf Variation, English Attack/ }).first().click();
  await page.getByRole('button', { name: 'Play as Black' }).click();
  await expect(page.getByRole('heading', { name: /English Attack/ })).toBeVisible();
  await expectPiece(page, 'e3', 'white bishop');
});
