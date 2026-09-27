import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { chesscomClaims } from './auth';
import { sign } from '../lib/crypto';
import { env } from '../env';

beforeAll(() => {
  env.SESSION_SECRET ??= 'test-session-secret-0123456789abcdef';
});

const jwt = (claims: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

describe('Chess.com sign-in', () => {
  it('reads the id and username from the ID token', () => {
    expect(chesscomClaims(jwt({ sub: '123', preferred_username: 'Hikaru' }))).toEqual({ id: '123', username: 'Hikaru' });
    expect(chesscomClaims(jwt({ sub: '9', username: 'magnus_c' }))).toEqual({ id: '9', username: 'magnus_c' });
    expect(chesscomClaims(jwt({ sub: '9' }))).toBeUndefined();
    expect(chesscomClaims(jwt({ sub: '9', preferred_username: 'bad name!' }))).toBeUndefined();
    expect(chesscomClaims('not-a-jwt')).toBeUndefined();
  });

  it('is offered only once credentials are configured', async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/auth/providers' });
    expect(res.json()).toEqual({ lichess: true, chesscom: !!process.env.CHESSCOM_CLIENT_ID });
    if (!process.env.CHESSCOM_CLIENT_ID) {
      const start = await app.inject({ method: 'GET', url: '/api/auth/chesscom/start' });
      expect(start.statusCode).toBe(503);
    }
    await app.close();
  });

  it('sends in-app sign-in errors back to the app, not to a web page', async () => {
    const app = await buildApp({ logger: false });
    const cookie = sign({ v: 'v', s: 'state', r: '/settings', n: 1 }, 600);
    const res = await app.inject({ method: 'GET', url: '/api/auth/chesscom/callback?error=access_denied&state=state', cookies: { ml_oauth: cookie } });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('app.mainline.chess://auth?auth_error=cancelled');
    const web = await app.inject({ method: 'GET', url: '/api/auth/lichess/callback?error=access_denied', cookies: { ml_oauth: sign({ v: 'v', s: 's', r: '/settings', n: 0 }, 600) } });
    expect(web.headers.location).toBe('/settings?auth_error=cancelled');
    await app.close();
  });
});
