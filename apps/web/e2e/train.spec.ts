import { expect, test, type Page } from '@playwright/test';
import { dragMove, tapMove } from './helpers';
import { stubApi } from './stubs';

test.beforeEach(async ({ page }) => stubApi(page));

async function importRep(page: Page, pgn: string, color: 'White' | 'Black' = 'White') {
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import PGN' }).click();
  const imp = page.getByRole('dialog', { name: 'Import PGN' });
  await imp.locator('textarea').fill(pgn);
  if (color === 'Black') await imp.getByRole('tab', { name: 'Black' }).click();
  await imp.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported \d+ moves/)).toBeVisible();
}

test('learn, then quiz with a mistake, summary', async ({ page }, info) => {
  test.skip(info.project.name === 'android');
  const move = info.project.name === 'phone' ? tapMove : dragMove;
  const sounds = () => page.evaluate(() => (window as unknown as { __mlSoundLog: string[] }).__mlSoundLog);
  await importRep(page, '[Event "Italian"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 *');

  await page.goto('/');
  await expect(page.getByRole('link', { name: /Learn new moves/ })).toContainText('3 new today');
  await page.getByRole('link', { name: /Learn new moves/ }).click();

  // Learn: each new move is announced, then played by the user; opponent replies are automatic.
  for (const [from, to, san] of [['e2', 'e4', 'e4'], ['g1', 'f3', 'Nf3'], ['f1', 'c4', 'Bc4']] as const) {
    await expect(page.getByRole('heading', { name: `New move: ${san}` })).toBeVisible();
    await move(page, from, to);
  }
  await expect(page.getByRole('heading', { name: 'Learn complete' })).toBeVisible();
  await expect(page.getByText('Learned').locator('..')).toContainText('3');

  // Nothing due immediately after learning.
  await page.goto('/train?mode=review');
  await expect(page.getByRole('heading', { name: 'Nothing due right now' })).toBeVisible();

  // Quiz: weakest positions first; play a wrong move once.
  await page.goto('/train?mode=quiz');
  await expect(page.getByRole('heading', { name: 'Your move' })).toBeVisible();
  const board = await page.locator('.ml-board').getAttribute('aria-label');
  expect(board).toContain('Your move');
  await page.evaluate(() => ((window as unknown as { __mlSoundLog: string[] }).__mlSoundLog = []));
  await move(page, 'a2', 'a3'); // legal in every quiz position of this repertoire, never correct
  await expect(page.getByRole('heading', { name: /Not quite — it's/ })).toBeVisible();
  expect(await sounds()).toContain('error');
  // Answer everything else correctly (the prompt exposes the expected move for tests).
  const phaseEl = page.locator('[data-phase]');
  for (let i = 0; i < 30; i++) {
    if (!(await phaseEl.count())) break;
    const phase = await phaseEl.getAttribute('data-phase');
    const uci = await phaseEl.getAttribute('data-expected');
    if ((phase === 'await' || phase === 'wrong') && uci) {
      await move(page, uci.slice(0, 2), uci.slice(2, 4));
    }
    else await page.waitForTimeout(250);
  }
  await expect(page.getByRole('heading', { name: 'Position quiz complete' })).toBeVisible();
  await expect(page.getByText('To look at again')).toBeVisible();
});
