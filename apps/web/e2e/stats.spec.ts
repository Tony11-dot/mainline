import { expect, test } from '@playwright/test';
import { stubApi } from './stubs';

const game = (id: string, color: 'white' | 'black', ucis: string[], result = 'win', speed = 'blitz') => ({ id: `lichess:${id}`, site: 'lichess', url: `https://lichess.org/${id}`, color, opponent: `opp${id}`, opponentRating: 1700, result, speed, playedAt: 1790000000000 - Number(id) * 1000, ucis });

test('statistics: training, repertoires, openings and games', async ({ page }, info) => {
  await stubApi(page);
  await page.addInitScript(() => localStorage.setItem('mainline.prefs', JSON.stringify({ onboarded: true })));
  await page.route('**/api/games?**', (r) =>
    r.fulfill({
      json: {
        games: [
          game('1', 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6']),
          game('2', 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'], 'loss'),
          game('3', 'white', ['e2e4', 'c7c5', 'g1f3'], 'draw', 'rapid'),
          game('4', 'black', ['d2d4', 'd7d5', 'c2c4', 'e7e6'], 'win'),
        ],
      },
    }),
  );
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import PGN' }).click();
  await page.getByRole('dialog', { name: 'Import PGN' }).locator('textarea').fill('[Event "Ruy"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *');
  await page.getByRole('dialog', { name: 'Import PGN' }).getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported 5 moves/)).toBeVisible();
  await page.goto('/games');
  await page.getByLabel('Lichess username').fill('Me');
  await page.getByRole('button', { name: 'Import games' }).click();
  await expect(page.getByText(/Imported 4 games/)).toBeVisible();

  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Reviews per day' }).getByRole('listitem')).toHaveCount(30);
  // The Ruy repertoire: all three White games played 1.e4 from it.
  await expect(page.locator('a[href^="/rep/"]')).toContainText('+1 =1 −1');
  await expect(page.getByRole('heading', { name: 'Games', exact: true })).toBeVisible();
  await expect(page.locator('span', { hasText: /^As White$/ }).locator('..')).toContainText('+1 =1 −1');
  await expect(page.getByRole('heading', { name: 'Openings you play' })).toBeVisible();
  await expect(page.getByText('Ruy Lopez', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'As Black' }).click();
  await expect(page.getByText(/Queen's Gambit/).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/shots/stats-${info.project.name}.png`, fullPage: true });

  // Per repertoire: the Stats pane opens with the repertoire summary.
  await page.locator('a[href^="/rep/"]').click();
  await page.getByRole('tab', { name: 'Stats' }).click();
  await expect(page.getByRole('region', { name: 'Repertoire statistics' })).toContainText('Moves');
  await page.screenshot({ path: `test-results/shots/rep-stats-${info.project.name}.png`, fullPage: true });
});
