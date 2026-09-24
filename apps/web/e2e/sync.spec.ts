import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { dragMove } from './helpers';

// Two "devices" (browser contexts) sharing one account through the real API + Postgres.
// Runs when the API is up with a database (local dev / CI with Postgres); skipped otherwise.
const DB = process.env.E2E_DATABASE_URL ?? (process.env.CI ? '' : 'postgres://localhost:5432/mainline');

function makeSession(): string {
  const token = randomBytes(32).toString('base64url');
  const uid = randomUUID();
  const hash = createHash('sha256').update(token).digest('hex');
  execFileSync('psql', [DB, '-qc', `insert into users (id, lichess_username) values ('${uid}', 'e2e_${uid.slice(0, 8)}'); insert into sessions (id_hash, user_id) values ('${hash}', '${uid}');`]);
  return token;
}

test('repertoire and training progress sync between devices', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop' || !DB, 'needs the API with a database');
  const health = await (await fetch('http://localhost:8787/api/health').catch(() => null))?.json().catch(() => null);
  test.skip(health?.db !== 'ok', 'API with database not running');
  const token = makeSession();
  const device = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript((t) => {
      localStorage.setItem('mainline.session', t);
      if (!localStorage.getItem('mainline.prefs')) localStorage.setItem('mainline.prefs', JSON.stringify({ engineOn: false, onboarded: true }));
    }, token);
    await ctx.route('**/api/explorer**', (r) => r.fulfill({ json: { source: 'masters', epd: '', white: 0, draws: 0, black: 0, total: 0, moves: [], topGames: [], opening: null, fetchedAt: '', cached: true } }));
    await ctx.route('**/api/eval**', (r) => r.fulfill({ json: { eval: null } }));
    return ctx.newPage();
  };

  const a = await device();
  await a.goto('/library');
  await a.getByRole('button', { name: 'New', exact: true }).click();
  await a.getByRole('menuitem', { name: 'Import PGN' }).click();
  await a.getByRole('dialog', { name: 'Import PGN' }).locator('textarea').fill('[Event "Synced London"]\n\n1. d4 d5 2. Bf4 *');
  await a.getByRole('dialog', { name: 'Import PGN' }).getByRole('button', { name: 'Import' }).click();
  await expect(a.getByRole('heading', { name: 'Synced London' })).toBeVisible();
  await a.goto('/train?mode=learn');
  await expect(a.getByRole('heading', { name: 'New move: d4' })).toBeVisible();
  await dragMove(a, 'd2', 'd4');
  await expect(a.getByRole('heading', { name: 'New move: Bf4' })).toBeVisible();
  await dragMove(a, 'c1', 'f4');
  await expect(a.getByRole('heading', { name: 'Learn complete' })).toBeVisible();
  // Let the debounced sync push.
  await expect.poll(async () => a.evaluate(async () => (await (await indexedDB.databases()).length) >= 1), { timeout: 2000 }).toBe(true);
  await a.waitForTimeout(3500);

  const b = await device();
  await b.goto('/library');
  await expect(b.getByRole('link', { name: /Synced London/ })).toBeVisible({ timeout: 10_000 });
  await b.goto('/');
  await expect(b.getByText('Positions learned').locator('..')).toContainText('2/2', { timeout: 10_000 });
});
