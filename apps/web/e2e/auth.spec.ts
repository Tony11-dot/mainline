import { expect, test } from '@playwright/test';
import { stubApi } from './stubs';

test('Sign in with Chess.com appears when the server offers it and starts OAuth', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await stubApi(page);
  await page.addInitScript(() => localStorage.setItem('mainline.prefs', JSON.stringify({ onboarded: true })));
  await page.route('**/api/auth/providers', (r) => r.fulfill({ json: { lichess: true, chesscom: false } }));
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Sign in with Lichess' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Chess\.com/ })).toHaveCount(0);

  await page.unroute('**/api/auth/providers');
  await page.route('**/api/auth/providers', (r) => r.fulfill({ json: { lichess: true, chesscom: true } }));
  let started = '';
  await page.route('**/api/auth/chesscom/start**', (r) => {
    started = r.request().url();
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>chess.com</p>' });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Sign in with Chess.com' }).click();
  await expect.poll(() => started).toContain('/api/auth/chesscom/start?return=%2Fsettings');
});

test('a failed sign-in explains itself', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await stubApi(page);
  await page.addInitScript(() => localStorage.setItem('mainline.prefs', JSON.stringify({ onboarded: true })));
  await page.goto('/settings?auth_error=already_linked');
  await expect(page.getByText('That Chess.com account is already linked to another MainLine account')).toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);
});
