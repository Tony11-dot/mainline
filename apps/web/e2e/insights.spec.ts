import { expect, test, type Page } from '@playwright/test';
import { stubApi } from './stubs';

const ex = (moves: [string, string, number][]) => {
  const ms = moves.map(([uci, san, n]) => ({ uci, san, white: Math.round(n * 0.5), draws: Math.round(n * 0.1), black: n - Math.round(n * 0.5) - Math.round(n * 0.1), total: n }));
  const t = ms.reduce((a, m) => a + m.total, 0);
  return { source: 'lichess', epd: '', white: t / 2, draws: 0, black: t / 2, total: t, moves: ms, topGames: [], opening: null, fetchedAt: '', cached: true };
};

async function setup(page: Page) {
  await stubApi(page, {
    explorer: (url) => {
      const fen = url.searchParams.get('fen') ?? '';
      if (fen.startsWith('rnbqkbnr/pppppppp/8/8/4P3/')) return ex([['e7e5', 'e5', 500], ['c7c5', 'c5', 400], ['e7e6', 'e6', 100]]);
      if (fen.startsWith('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/')) return ex([['b8c6', 'Nc6', 900]]);
      return ex([]);
    },
  });
  await page.route('**/api/coach', (r) => {
    const body = r.request().postDataJSON();
    const text = body.kind === 'mistake' ? 'Your prep move is [[Nf3]], which develops with tempo.' : 'The engine prefers [[Bb5]] here; it pins the knight.\n\n- Plan: castle with [[O-O]]';
    return r.fulfill({ json: { text, source: 'ai', model: 'test', facts: {} } });
  });
}

async function importRep(page: Page, pgn: string) {
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import PGN' }).click();
  await page.getByRole('dialog', { name: 'Import PGN' }).locator('textarea').fill(pgn);
  await page.getByRole('dialog', { name: 'Import PGN' }).getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported \d+ moves/)).toBeVisible();
}

test('coach, stats and coverage in the builder', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await setup(page);
  await importRep(page, '[Event "Ruy"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *');
  const tree = page.getByRole('tree', { name: 'Moves' });
  await tree.getByRole('treeitem', { name: 'Nc6' }).click();

  await page.getByRole('tab', { name: 'Coach' }).click();
  await page.getByRole('tab', { name: 'Ask' }).click();
  await page.getByLabel('Ask the coach').fill('What is the plan?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const chip = page.getByRole('button', { name: 'Bb5' });
  await expect(chip).toBeVisible();
  await expect(page.getByText('Plan: castle with')).toBeVisible();
  await chip.click(); // plays the move from the coach's text
  await page.getByRole('tab', { name: 'Moves' }).click();
  await expect(tree.getByRole('treeitem', { name: 'Bb5' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: 'Stats' }).click();
  await expect(page.getByText('Your training')).toBeVisible();

  await page.getByRole('tab', { name: 'Coverage' }).click();
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.getByText(/Handles 50% of games/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('1… c5')).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await expect(page.getByText(/Added c5/)).toBeVisible();
});

test('why was I wrong, from the session summary', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await setup(page);
  await importRep(page, '[Event "Short"]\n\n1. e4 e5 2. Nf3 *');
  await page.goto('/train?mode=learn');
  for (const [a, b] of [['e2', 'e4'], ['g1', 'f3']]) {
    await expect(page.locator('[data-phase="learn"]')).toBeVisible();
    const { dragMove } = await import('./helpers');
    await dragMove(page, a!, b!);
  }
  await page.goto('/train?mode=quiz');
  const { dragMove } = await import('./helpers');
  const phase = page.locator('[data-phase]');
  for (let i = 0; i < 20 && (await phase.count()); i++) {
    const p = await phase.getAttribute('data-phase', { timeout: 500 }).catch(() => null);
    if (p === null) break;
    const uci = (await phase.getAttribute('data-expected', { timeout: 500 }).catch(() => '')) ?? '';
    if (p === 'await' && i === 0) await dragMove(page, 'a2', 'a3');
    else if ((p === 'await' || p === 'wrong') && uci) await dragMove(page, uci.slice(0, 2), uci.slice(2, 4));
    else await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name: 'Why?' }).first().click();
  await expect(page.getByText('which develops with tempo').or(page.getByText('Your prep move is'))).toBeVisible();
});
