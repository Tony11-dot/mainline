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
  // First practice of the day: the Duolingo-style streak moment, with its fanfare, before the summary.
  await expect(page.getByRole('dialog', { name: /Streak started/ })).toBeVisible();
  await expect.poll(sounds).toContain('streak');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Learn complete' })).toBeVisible();
  await expect(page.getByText('1-day streak')).toBeVisible();
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
    const phase = await phaseEl.getAttribute('data-phase', { timeout: 500 }).catch(() => null);
    if (phase === null) break;
    const uci = await phaseEl.getAttribute('data-expected', { timeout: 500 }).catch(() => null);
    if ((phase === 'await' || phase === 'wrong') && uci) {
      await move(page, uci.slice(0, 2), uci.slice(2, 4));
    }
    else await page.waitForTimeout(250);
  }
  // Today already counts, so the second session goes straight to its summary.
  await expect(page.getByRole('heading', { name: 'Position quiz complete' })).toBeVisible();
  await expect(page.getByText('To look at again')).toBeVisible();

  // Home: the flame is lit; its sheet shows the week and the freezes.
  await page.goto('/');
  await expect(page.getByTestId('streak-at-risk')).toHaveCount(0);
  await page.getByTestId('streak-badge').click();
  const sheet = page.getByRole('dialog', { name: 'Streak' });
  await expect(sheet.getByText('Done for today')).toBeVisible();
  await expect(sheet.getByText(/0 of 2 streak freezes/)).toBeVisible();
});

test('a streak at risk, saved by a freeze', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  // Seven days in a row ending the day before yesterday (earns a freeze), nothing since.
  await page.goto('/');
  await page.evaluate(async () => {
    const day = 86_400_000;
    const req = indexedDB.open('mainline');
    const db: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const tx = db.transaction('reviews', 'readwrite');
    for (let i = 2; i <= 8; i++) {
      tx.objectStore('reviews').put({ id: `r${i}`, cardEpd: 'x', color: 'white', rating: 3, playedUci: 'e2e4', expectedUci: ['e2e4'], mode: 'review', msTaken: 1000, reviewedAt: Date.now() - i * day, updatedAt: Date.now() - i * day });
    }
    await new Promise((r) => (tx.oncomplete = r));
    db.close();
  });
  await importRep(page, '[Event "Italian"]\n\n1. e4 e5 *');
  await page.goto('/');
  await expect(page.getByTestId('streak-at-risk')).toContainText('A streak freeze saved your 7-day streak');
  await expect(page.getByTestId('streak-badge')).toHaveText('7');
  await page.getByTestId('streak-badge').click();
  await expect(page.getByRole('dialog', { name: 'Streak' }).getByRole('listitem').nth(5)).toHaveAttribute('aria-label', /streak freeze used/);
});
