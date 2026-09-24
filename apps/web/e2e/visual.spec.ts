import { expect, test, type Page } from '@playwright/test';
import { stubApi } from './stubs';

/**
 * Visual regression: key screens at phone / tablet / desktop × light / dark.
 * Opt-in (pixel baselines are OS-specific): `VISUAL=1 pnpm e2e visual` — add `--update-snapshots` to re-baseline.
 */
test.skip(!process.env.VISUAL, 'set VISUAL=1 to run visual regression');

const viewports = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
} as const;

async function seed(page: Page) {
  await page.goto('/library');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import PGN' }).click();
  const imp = page.getByRole('dialog', { name: 'Import PGN' });
  await imp.locator('textarea').fill('[Event "Italian"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 (3. Bb5 a6 4. Ba4) 3... Bc5 4. c3 Nf6 5. d3 *');
  await imp.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported \d+ moves/)).toBeVisible();
}

const screens: { name: string; path: string | ((page: Page) => Promise<void>); ready: (page: Page) => Promise<void> }[] = [
  { name: 'today', path: '/', ready: (p) => expect(p.getByRole('link', { name: /Learn new moves/ })).toBeVisible() },
  { name: 'library', path: '/library', ready: (p) => expect(p.getByRole('link', { name: /Italian/ }).first()).toBeVisible() },
  {
    name: 'builder',
    path: async (p) => {
      await p.goto('/library');
      await p.getByRole('link', { name: /Italian/ }).first().click();
    },
    ready: (p) => expect(p.getByRole('tree', { name: 'Moves' })).toBeVisible(),
  },
  { name: 'settings', path: '/settings', ready: (p) => expect(p.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible() },
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const s of screens) {
      test(`${s.name} (${scheme})`, async ({ page }, info) => {
        test.skip(info.project.name === 'android');
        await stubApi(page);
        await seed(page);
        const sizes: [string, { width: number; height: number } | null][] =
          info.project.name === 'phone' ? [['phone', null]] : Object.entries(viewports);
        for (const [label, vp] of sizes) {
          if (vp) await page.setViewportSize(vp);
          if (typeof s.path === 'string') await page.goto(s.path);
          else await s.path(page);
          await s.ready(page);
          await page.evaluate(() => document.fonts.ready);
          await expect(page).toHaveScreenshot(`${s.name}-${label}-${scheme}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 });
        }
      });
    }
  });
}
