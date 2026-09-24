import { expect, test } from '@playwright/test';
import { stubApi } from './stubs';

const game = (id: string, color: 'white' | 'black', ucis: string[], result = 'win') => ({ id: `lichess:${id}`, site: 'lichess', url: `https://lichess.org/${id}`, color, opponent: `opp${id}`, opponentRating: 1700, result, speed: 'blitz', playedAt: 1790000000000 - Number(id.replace(/\D/g, '')) * 1000, ucis });

test('games vs prep: import, breaks, add reply, forgotten move becomes due, opponent prep', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await stubApi(page);
  await page.route('**/api/games?**', (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('user') === 'Rival')
      return r.fulfill({ json: { games: [game('r1', 'black', ['e2e4', 'c7c5']), game('r2', 'black', ['e2e4', 'c7c5']), game('r3', 'black', ['e2e4', 'e7e5', 'g1f3', 'b8c6'])] } });
    return r.fulfill({
      json: {
        games: [
          game('1', 'white', ['e2e4', 'd7d5', 'e4d5']), // opponent left book
          game('2', 'white', ['e2e4', 'd7d5', 'e4e5'], 'loss'),
          game('3', 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4']), // you left book (Bb5)
          game('4', 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6']), // end of prep
          game('5', 'black', ['d2d4', 'd7d5']), // not covered
        ],
      },
    });
  });
  // Repertoire: 1.e4 e5 2.Nf3 Nc6 3.Bb5
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import PGN' }).click();
  await page.getByRole('dialog', { name: 'Import PGN' }).locator('textarea').fill('[Event "Ruy"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *');
  await page.getByRole('dialog', { name: 'Import PGN' }).getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported 5 moves/)).toBeVisible();

  await page.goto('/games');
  await page.getByLabel('Lichess username').fill('Me');
  await page.getByRole('button', { name: 'Import games' }).click();
  await expect(page.getByText(/Imported 5 games · 1 position you forgot/)).toBeVisible();
  await expect(page.getByText('In your repertoire', { exact: true }).locator('..')).toContainText('4/5');
  await expect(page.getByText('Opponent left book', { exact: true }).locator('..')).toContainText('2');

  // They surprised you: 1.e4 d5 (2 games) → add it.
  await expect(page.getByText('They played')).toBeVisible();
  await page.getByRole('button', { name: 'Add d5' }).click();
  await expect(page.getByText(/Added d5/)).toBeVisible();

  await page.getByRole('tab', { name: 'Forgotten' }).click();
  await expect(page.getByText(/You played Bc4 instead of Bb5/)).toBeVisible();

  await page.getByRole('link', { name: 'Today' }).first().click();
  await expect(page.getByRole('link', { name: /Train now/ })).toContainText('1 due');

  await page.goto('/games');
  await page.getByLabel('Opponent username').fill('Rival');
  await page.getByRole('button', { name: 'Analyse' }).click();
  await expect(page.getByText('3 recent games analysed.')).toBeVisible();
  await expect(page.getByText(/they play c5/)).toBeVisible();
  await expect(page.getByText(/not in your repertoire/).first()).toBeVisible();
  if (process.env.SHOTS) {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.screenshot({ path: `${process.env.SHOTS}/games-phone.png`, fullPage: true });
  }
});
