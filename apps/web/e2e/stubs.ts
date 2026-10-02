import type { Page } from '@playwright/test';

/** Hermetic network: explorer/guide/eval/me stubbed so tests don't depend on Lichess. */
export async function stubApi(page: Page, opts: { explorer?: (url: URL) => unknown } = {}) {
  await page.route('**/api/explorer**', (r) => {
    const url = new URL(r.request().url());
    const body = opts.explorer?.(url) ?? { source: url.searchParams.get('source'), epd: '', white: 0, draws: 0, black: 0, total: 0, moves: [], topGames: [], opening: null, fetchedAt: new Date().toISOString(), cached: true };
    return r.fulfill({ json: body });
  });
  // The guide bundle: the same explorer stub for both sources, no evals (the device engine fills in).
  await page.route('**/api/guide**', (r) => {
    const url = new URL(r.request().url());
    const ex = (source: string) => {
      const u = new URL(url);
      u.searchParams.set('source', source);
      return opts.explorer?.(u) ?? { source, epd: '', white: 0, draws: 0, black: 0, total: 0, moves: [], topGames: [], opening: null, fetchedAt: new Date().toISOString(), cached: true };
    };
    return r.fulfill({ json: { epd: '', lichess: ex('lichess'), masters: ex('masters'), eval: null, children: {} } });
  });
  await page.route('**/api/eval**', (r) => r.fulfill({ json: { eval: null } }));
  await page.route('**/api/me', (r) => r.fulfill({ json: { me: null } }));
  await page.addInitScript(() => {
    (window as unknown as { __mlSoundLog: string[] }).__mlSoundLog = [];
    if (!localStorage.getItem('mainline.prefs')) localStorage.setItem('mainline.prefs', JSON.stringify({ engineOn: false, onboarded: true }));
  });
}
