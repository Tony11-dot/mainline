import { expect, test } from '@playwright/test';
import { dragMove, expectPiece, item, openItem, tapMove } from './helpers';
import { stubApi } from './stubs';

test.beforeEach(async ({ page }) => stubApi(page));

test('a repertoire holds lines; build one, alternates, delete + undo, PGN import', async ({ page }, info) => {
  test.skip(info.project.name === 'android');
  const move = info.project.name === 'phone' ? tapMove : dragMove;
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Build your first repertoire' })).toBeVisible();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New repertoire…' }).click();
  const sheet = page.getByRole('dialog', { name: 'New repertoire' });
  await sheet.getByPlaceholder('e.g. London System').fill('Italian');
  await sheet.getByPlaceholder('1.e4 c5').fill('1.e4 e5 2.Nf3 Nc6');
  await sheet.getByRole('button', { name: 'Create', exact: true }).click();

  // The repertoire opens like a folder; its lines start from its moves.
  await expect(page.getByRole('heading', { name: 'Italian' })).toBeVisible();
  await page.getByRole('button', { name: /^New line/ }).click();
  await expect(page.getByRole('heading', { name: 'Line 1' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Delete Nf6' }).click();
  await expect(tree.getByRole('treeitem', { name: 'Nf6' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(tree.getByRole('treeitem', { name: 'Nf6' })).toBeVisible();

  // Persisted across reload (IndexedDB)
  await page.reload();
  await expect(page.getByRole('tree', { name: 'Moves' }).getByRole('treeitem', { name: 'Bc5' })).toBeVisible();

  // Library shows the repertoire, and the line inside it
  await page.goto('/library');
  await openItem(page, /Italian/);
  await expect(item(page, /Line 1/)).toBeVisible();
  await expect(page.getByText('Your line')).toBeVisible();

  // PGN import into a new repertoire
  await page.getByRole('button', { name: 'New', exact: true }).click();
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

test('ready-made lines: added into White › 1.e4 › vs Sicilian, practised as is, walked through with moves shown', async ({ page }, info) => {
  test.skip(info.project.name === 'android');
  const move = info.project.name === 'phone' ? tapMove : dragMove;
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Ready-made openings' }).click();
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Open Sicilian', exact: true }) });
  await expect(card.getByText('vs Najdorf (5…a6)')).toBeVisible();
  await card.getByRole('button', { name: 'Add' }).click();

  // Lands in the system's own folder: White › 1.e4 › Sicilian (1…c5) › Open Sicilian.
  await expect(page.getByRole('heading', { name: 'Open Sicilian', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('1.e4');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Sicilian (1…c5)');
  await expect(page.getByText('5 lines').first()).toBeVisible();
  await openItem(page, 'vs Najdorf (5…a6)');

  // A ready-made line is practised, not rebuilt: no guide, and only the line's own moves can be played.
  await expect(page.getByRole('heading', { name: 'vs Najdorf (5…a6)' })).toBeVisible();
  await expect(page.getByText('Ready-made', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guided' })).toHaveCount(0);
  await expectPiece(page, 'c5', 'black pawn');
  await move(page, 'b1', 'c3');
  await expectPiece(page, 'b1', 'white knight');
  await move(page, 'g1', 'f3');
  await expectPiece(page, 'f3', 'white knight');
  await expect(page.getByRole('button', { name: 'Edit this line' })).toBeVisible();

  // Walk the whole opening with the moves shown.
  await page.goBack();
  await page.getByRole('link', { name: 'Show me' }).first().click();
  await expect(page.getByRole('heading', { name: 'You play Nf3' })).toBeVisible();
});

test('a line: pick where it stops, change a move, branch a new line off it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New repertoire…' }).click();
  const sheet = page.getByRole('dialog', { name: 'New repertoire' });
  await sheet.getByPlaceholder('e.g. London System').fill('Open games');
  await sheet.getByPlaceholder('1.e4 c5').fill('1.e4 e5');
  await sheet.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: /^New line/ }).click();
  await expect(page.getByRole('heading', { name: 'Line 1' })).toBeVisible();

  for (const [f, t] of [['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'], ['f8', 'c5']]) await dragMove(page, f!, t!);
  const line = page.getByRole('list', { name: 'Moves in this line' });
  await expect(line).toContainText('1.e4 e5');
  await expect(line).toContainText('2.Nf3');
  await expect(line).toContainText('Bc5');
  await expect(page.getByText(/branches off this line/)).toHaveCount(0);

  // Stop the line after 3.Bc4: Bc5 goes, undo brings it back.
  await line.getByRole('button', { name: '3.Bc4' }).click();
  await page.getByRole('button', { name: 'End the line here' }).click();
  await expect(line.getByRole('button', { name: 'Bc5' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(line.getByRole('button', { name: 'Bc5' })).toBeVisible();

  // Change 3.Bc4 to 3.Bb5.
  await line.getByRole('button', { name: '3.Bc4' }).click();
  await page.getByRole('button', { name: 'Change Bc4' }).click();
  await expect(page.getByText('Play the move that replaces Bc4')).toBeVisible();
  await dragMove(page, 'f1', 'b5');
  await expect(line.getByRole('button', { name: '3.Bb5' })).toBeVisible();
  await expect(line.getByRole('button', { name: '3.Bc4' })).toHaveCount(0);

  // Branch a new line after 2...Nc6: it keeps the moves so far, and the old line stays as it was.
  await line.getByRole('button', { name: 'Nc6' }).click();
  await page.getByRole('button', { name: 'New line from here' }).click();
  await expect(page.getByText(/New line “.+” — play its next move/)).toBeVisible();
  await expect(line.getByRole('button', { name: 'Nc6' })).toHaveAttribute('aria-current', 'step');
  await expect(line.getByRole('button', { name: '3.Bb5' })).toHaveCount(0);
  await dragMove(page, 'd2', 'd4');
  await expect(line.getByRole('button', { name: '3.d4' })).toBeVisible();

  // A different reply played mid-line branches; one tap makes it a line of its own.
  await line.getByRole('button', { name: '2.Nf3' }).click();
  await dragMove(page, 'g8', 'f6');
  await expect(page.getByText('Nf6 branches off this line')).toBeVisible();
  await page.getByRole('button', { name: 'Make it a new line' }).click();
  await expect(page.getByRole('heading', { name: /· Nf6$/ })).toBeVisible();
  await expect(line.getByRole('button', { name: 'Nf6' })).toBeVisible();
  await expect(line.getByRole('button', { name: 'Nc6' })).toHaveCount(0);

  await page.goto('/library');
  await openItem(page, /Open games/);
  await expect(item(page, /Line 1/)).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(3);
});
