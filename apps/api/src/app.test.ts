import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { absoluteSocialMeta, buildApp } from './app';
import { env } from './env';

describe('app', () => {
  it('points the share preview at the public origin and leaves other links alone', () => {
    const html = '<meta property="og:image" content="/social.png" /><meta property="og:url" content="/" /><link rel="icon" href="/favicon-32.png" />';
    expect(absoluteSocialMeta(html, 'https://mainline.example/')).toBe(
      '<meta property="og:image" content="https://mainline.example/social.png" /><meta property="og:url" content="https://mainline.example/" /><link rel="icon" href="/favicon-32.png" />',
    );
  });

  it('serves the app shell with absolute share-preview URLs at the root and on app routes', async () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'mainline-dist-'));
    writeFileSync(path.join(dist, 'index.html'), '<meta property="og:image" content="/social.png" />');
    const saved = env.WEB_DIST;
    env.WEB_DIST = dist;
    try {
      const app = await buildApp({ logger: false });
      for (const url of ['/', '/today']) {
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe(`<meta property="og:image" content="${env.PUBLIC_URL.replace(/\/$/, '')}/social.png" />`);
      }
      await app.close();
    } finally {
      env.WEB_DIST = saved;
    }
  });

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
    for (const [url, title] of [['/privacy', 'Privacy policy'], ['/terms', 'Terms of use'], ['/cookies', 'Cookies and local storage'], ['/accessibility', 'Accessibility statement']] as const) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain(`<h1>${title}</h1>`);
      expect(res.body).not.toContain('<script');
    }
    await app.close();
  });
});
