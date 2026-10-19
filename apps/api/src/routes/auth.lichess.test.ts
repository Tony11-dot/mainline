import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { testDatabaseUrl, useTestDatabase } from '../db/testing';

// Needs Postgres: TEST_DATABASE_URL (CI provides one; locally `createdb mainline_test`).
const run = testDatabaseUrl ? describe : describe.skip;

type Perfs = Record<string, { rating?: number; games?: number }>;

run('Lichess sign-in', () => {
  let app: FastifyInstance;
  let crypto: typeof import('../lib/crypto');
  let db: typeof import('../db/client');
  beforeAll(async () => {
    process.env.TOKEN_ENC_KEY ??= Buffer.alloc(32, 1).toString('base64');
    process.env.SESSION_SECRET ??= Buffer.alloc(32, 2).toString('base64');
    await useTestDatabase();
    crypto = await import('../lib/crypto');
    db = await import('../db/client');
    const { buildApp } = await import('../app');
    app = await buildApp({ logger: false });
  });
  afterAll(async () => {
    await app?.close();
    await db?.closeDb();
  });
  beforeEach(() => vi.restoreAllMocks());

  /** Lichess, as far as the callback can tell: checks the PKCE exchange and answers with this account. */
  function lichess(account: { username: string; perfs?: Perfs }, challenge: () => string, opts: { tokenStatus?: number } = {}) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === 'https://lichess.org/api/token' && init?.method === 'POST') {
        const body = new URLSearchParams(String(init.body));
        expect(body.get('grant_type')).toBe('authorization_code');
        expect(body.get('code')).toBe('lichess-code');
        expect(body.get('redirect_uri')).toBe('http://localhost:5173/api/auth/lichess/callback');
        expect(crypto.sha256b64url(body.get('code_verifier')!)).toBe(challenge());
        return opts.tokenStatus ? new Response('{}', { status: opts.tokenStatus }) : Response.json({ access_token: `lio_${account.username}` });
      }
      if (url === 'https://lichess.org/api/account') {
        expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer lio_${account.username}`);
        return Response.json(account);
      }
      if (url === 'https://lichess.org/api/token' && init?.method === 'DELETE') return new Response(null, { status: 204 });
      throw new Error(`unexpected fetch ${url}`);
    });
  }

  async function start(query = '') {
    const res = await app.inject({ url: `/api/auth/lichess/start${query}` });
    expect(res.statusCode).toBe(302);
    const to = new URL(res.headers.location as string);
    const cookie = res.cookies.find((c) => c.name === 'ml_oauth')!;
    return { to, cookie };
  }

  async function signIn(username: string, opts: { query?: string; perfs?: Perfs } = {}) {
    const { to, cookie } = await start(opts.query);
    const fetch = lichess({ username, perfs: opts.perfs }, () => to.searchParams.get('code_challenge')!);
    const res = await app.inject({ url: `/api/auth/lichess/callback?code=lichess-code&state=${to.searchParams.get('state')}`, cookies: { ml_oauth: cookie.value } });
    return { res, fetch, session: res.cookies.find((c) => c.name === 'ml_session')?.value };
  }

  const me = (headers: Record<string, string>) => app.inject({ url: '/api/me', headers }).then((r) => r.json().me);
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const cookie = (token: string) => ({ cookie: `ml_session=${token}` });
  const name = () => `t_${randomUUID().slice(0, 8)}`;

  it('sends the player to Lichess with PKCE and a state, kept in a short-lived signed cookie', async () => {
    const { to, cookie } = await start('?return=/library');
    expect(to.origin + to.pathname).toBe('https://lichess.org/oauth');
    expect(to.searchParams.get('code_challenge_method')).toBe('S256');
    expect(to.searchParams.get('client_id')).toBe('mainline');
    expect(cookie).toMatchObject({ path: '/api/auth', httpOnly: true, maxAge: 600 });
    const saved = crypto.verify<{ v: string; s: string; r: string }>(cookie.value)!;
    expect(saved.s).toBe(to.searchParams.get('state'));
    expect(crypto.sha256b64url(saved.v)).toBe(to.searchParams.get('code_challenge'));
    expect(saved.r).toBe('/library');
  });

  it('signs in on the web: a session cookie, the token stored encrypted, the rating from the busiest speed', async () => {
    const username = name();
    const { res, session } = await signIn(username, { query: '?return=/library', perfs: { blitz: { rating: 1650, games: 40 }, rapid: { rating: 1820.6, games: 300 } } });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/library');
    expect(res.cookies.find((c) => c.name === 'ml_session')).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(await me(cookie(session!))).toMatchObject({ lichessUsername: username, rating: 1821, ratingSpeed: 'rapid' });
    const [row] = await db.getDb()!.select().from(db.schema.users).where(eq(db.schema.users.lichessUsername, username));
    expect(row!.lichessTokenEnc).not.toContain(`lio_${username}`);
    expect(crypto.decryptSecret(row!.lichessTokenEnc!)).toBe(`lio_${username}`);
  });

  it('starts a new player at 1500 blitz when Lichess has no games', async () => {
    const { session } = await signIn(name());
    expect(await me(cookie(session!))).toMatchObject({ rating: 1500, ratingSpeed: 'blitz' });
  });

  it('keeps the account and its settings when the player signs in again', async () => {
    const username = name();
    const first = await signIn(username, { perfs: { blitz: { rating: 1700, games: 10 } } });
    const id = (await me(cookie(first.session!))).id;
    await app.inject({ method: 'PATCH', url: '/api/me', headers: cookie(first.session!), payload: { rating: 1900 } });
    const second = await signIn(username, { perfs: { blitz: { rating: 1400, games: 10 } } });
    expect(second.session).not.toBe(first.session);
    expect(await me(cookie(second.session!))).toMatchObject({ id, rating: 1900 });
  });

  it('refuses a callback whose state doesn’t match, or that has no cookie, before asking Lichess', async () => {
    const { cookie } = await start('?return=/library');
    const fetch = vi.spyOn(globalThis, 'fetch');
    const wrong = await app.inject({ url: '/api/auth/lichess/callback?code=lichess-code&state=nope', cookies: { ml_oauth: cookie.value } });
    expect(wrong.headers.location).toBe('/library?auth_error=expired');
    const none = await app.inject({ url: '/api/auth/lichess/callback?code=lichess-code&state=nope' });
    expect(none.headers.location).toBe('/?auth_error=expired');
    expect(fetch).not.toHaveBeenCalled();
    expect([...wrong.cookies, ...none.cookies].some((c) => c.name === 'ml_session')).toBe(false);
  });

  it('explains a failed token exchange', async () => {
    const { to, cookie } = await start('?return=/settings');
    lichess({ username: name() }, () => to.searchParams.get('code_challenge')!, { tokenStatus: 400 });
    const res = await app.inject({ url: `/api/auth/lichess/callback?code=lichess-code&state=${to.searchParams.get('state')}`, cookies: { ml_oauth: cookie.value } });
    expect(res.headers.location).toBe('/settings?auth_error=token_exchange');
  });

  it('hands the apps a one-time code for their bearer token', async () => {
    const username = name();
    const { res } = await signIn(username, { query: '?native=1' });
    const code = /^app\.mainline\.chess:\/\/auth\?code=(.+)$/.exec(res.headers.location as string)![1]!;
    expect(res.cookies.some((c) => c.name === 'ml_session')).toBe(false);
    const swap = () => app.inject({ method: 'POST', url: '/api/auth/exchange', payload: { code } });
    const first = await swap();
    expect(first.statusCode).toBe(200);
    expect(await me(bearer(first.json().token))).toMatchObject({ lichessUsername: username });
    expect((await swap()).statusCode).toBe(400);

    const desktop = await signIn(name(), { query: '?native=desktop' });
    expect(desktop.res.headers.location).toMatch(/^mainline:\/\/auth\?code=/);
  });

  it('signs out', async () => {
    const { session } = await signIn(name());
    expect(await me(bearer(session!))).not.toBeNull();
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(session!) });
    expect(await me(bearer(session!))).toBeNull();
  });

  it('validates profile edits and needs a signed-in player', async () => {
    const { session } = await signIn(name());
    expect((await app.inject({ method: 'PATCH', url: '/api/me', payload: { rating: 1600 } })).statusCode).toBe(401);
    for (const payload of [{ rating: 5000 }, { ratingSpeed: 'hyper' }, { reminderTime: '7pm' }, { chesscomUsername: 'no spaces' }]) {
      expect((await app.inject({ method: 'PATCH', url: '/api/me', headers: bearer(session!), payload })).statusCode).toBe(400);
    }
    const ok = await app.inject({ method: 'PATCH', url: '/api/me', headers: bearer(session!), payload: { rating: 1600, ratingSpeed: 'rapid', chesscomUsername: 'some_player' } });
    expect(ok.json().me).toMatchObject({ rating: 1600, ratingSpeed: 'rapid', chesscomUsername: 'some_player', chesscomVerified: false });
  });

  it('deletes the account: revokes the Lichess token and removes the player', async () => {
    const username = name();
    const { session, fetch } = await signIn(username);
    const res = await app.inject({ method: 'DELETE', url: '/api/me', headers: bearer(session!) });
    expect(res.json()).toEqual({ deleted: true });
    const revoke = fetch.mock.calls.find(([, init]) => init?.method === 'DELETE')!;
    expect((revoke[1]!.headers as Record<string, string>).Authorization).toBe(`Bearer lio_${username}`);
    expect(await me(bearer(session!))).toBeNull();
    expect(await db.getDb()!.select().from(db.schema.users).where(eq(db.schema.users.lichessUsername, username))).toEqual([]);
  });
});
