import { describe, expect, it } from 'vitest';
import { buildApp } from './app';

describe('app', () => {
  it('serves health with cross-origin isolation headers', async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-embedder-policy']).toBe('require-corp');
    await app.close();
  });

  it('serves the privacy policy and terms as standalone pages', async () => {
    const app = await buildApp({ logger: false });
    for (const [url, title] of [['/privacy', 'Privacy policy'], ['/terms', 'Terms of use'], ['/cookies', 'Cookies and local storage']] as const) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain(`<h1>${title}</h1>`);
      expect(res.body).not.toContain('<script');
    }
    await app.close();
  });
});
