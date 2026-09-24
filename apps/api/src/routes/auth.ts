import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { SPEEDS, type Me } from '@mainline/shared';
import { env, MissingConfigError, requireEnv } from '../env';
import { getDb, schema } from '../db/client';
import { decryptSecret, encryptSecret, randomToken, sha256b64url, sign, verify } from '../lib/crypto';
import { createSession, currentUser, destroySession, requireUser, setSessionCookie, type User } from '../lib/session';
import { USER_AGENT } from '../lib/lichess';
import { Lru } from '../lib/lru';

const OAUTH_COOKIE = 'ml_oauth';
export const NATIVE_SCHEME = 'app.mainline.chess';
const nativeCodes = new Lru<string>(1000, 120_000);

interface OAuthCookie {
  v: string; // PKCE verifier
  s: string; // state
  r: string; // return path
  n: 0 | 1; // native app flow
}

export function toMe(u: User): Me {
  return {
    id: u.id,
    lichessUsername: u.lichessUsername,
    rating: u.rating,
    ratingSpeed: u.ratingSpeed as Me['ratingSpeed'],
    chesscomUsername: u.chesscomUsername,
  };
}

const redirectUri = () => `${env.PUBLIC_URL.replace(/\/$/, '')}/api/auth/lichess/callback`;

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/auth/lichess/start', async (req, reply) => {
    if (!getDb()) throw new MissingConfigError('DATABASE_URL', 'Accounts');
    requireEnv('TOKEN_ENC_KEY', 'Token encryption');
    const q = z.object({ return: z.string().startsWith('/').max(200).default('/'), native: z.coerce.number().default(0) }).parse(req.query);
    const verifier = randomToken(48);
    const state = randomToken(16);
    const cookie: OAuthCookie = { v: verifier, s: state, r: q.return.startsWith('//') ? '/' : q.return, n: q.native ? 1 : 0 };
    reply.setCookie(OAUTH_COOKIE, sign(cookie, 600), {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.PUBLIC_URL.startsWith('https'),
      maxAge: 600,
    });
    const url = new URL('https://lichess.org/oauth');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', env.LICHESS_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', sha256b64url(verifier));
    url.searchParams.set('state', state);
    return reply.redirect(url.toString());
  });

  app.get('/api/auth/lichess/callback', async (req, reply) => {
    const q = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }).parse(req.query);
    const raw = req.cookies[OAUTH_COOKIE];
    const c = raw ? verify<OAuthCookie>(raw) : undefined;
    reply.clearCookie(OAUTH_COOKIE, { path: '/api/auth' });
    const fail = (why: string) => reply.redirect(`${c?.r ?? '/'}${(c?.r ?? '/').includes('?') ? '&' : '?'}auth_error=${encodeURIComponent(why)}`);
    if (q.error) return fail(q.error === 'access_denied' ? 'cancelled' : q.error);
    if (!c || !q.code || q.state !== c.s) return fail('expired');

    const tokenRes = await fetch('https://lichess.org/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: q.code,
        code_verifier: c.v,
        redirect_uri: redirectUri(),
        client_id: env.LICHESS_CLIENT_ID,
      }),
    });
    if (!tokenRes.ok) return fail('token_exchange');
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const accRes = await fetch('https://lichess.org/api/account', {
      headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': USER_AGENT },
    });
    if (!accRes.ok) return fail('account');
    const acc = (await accRes.json()) as { username: string; perfs?: Record<string, { rating?: number; games?: number }> };
    const user = await upsertLichessUser(acc, access_token);
    const session = await createSession(user.id);
    if (c.n) {
      const oneTime = randomToken(24);
      nativeCodes.set(oneTime, session);
      return reply.redirect(`${NATIVE_SCHEME}://auth?code=${oneTime}`);
    }
    setSessionCookie(reply, session);
    return reply.redirect(c.r);
  });

  /** Native apps trade the one-time code from the custom-scheme redirect for a bearer session token. */
  app.post('/api/auth/exchange', async (req) => {
    const { code } = z.object({ code: z.string().min(10) }).parse(req.body);
    const token = nativeCodes.get(code);
    nativeCodes.delete(code);
    if (!token) throw Object.assign(new Error('code expired'), { statusCode: 400 });
    return { token };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await destroySession(req, reply);
    return { ok: true };
  });

  app.get('/api/me', async (req) => {
    const u = await currentUser(req);
    return { me: u ? toMe(u) : null };
  });

  app.patch('/api/me', async (req) => {
    const u = await requireUser(req);
    const body = z
      .object({
        rating: z.number().int().min(400).max(3200).optional(),
        ratingSpeed: z.enum(SPEEDS).optional(),
        chesscomUsername: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/).nullable().optional(),
        timezone: z.string().max(60).optional(),
        reminderTime: z.string().regex(/^\d\d:\d\d$/).optional(),
        dailyNewLimit: z.number().int().min(0).max(100).optional(),
      })
      .parse(req.body);
    const [updated] = await getDb()!.update(schema.users).set(body).where(eq(schema.users.id, u.id)).returning();
    return { me: toMe(updated!) };
  });

  /** App Store 5.1.1(v): in-app account deletion. Revokes the Lichess token and deletes every row. */
  app.delete('/api/me', async (req, reply) => {
    const u = await requireUser(req);
    if (u.lichessTokenEnc) {
      try {
        await fetch('https://lichess.org/api/token', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${decryptSecret(u.lichessTokenEnc)}`, 'User-Agent': USER_AGENT },
        });
      } catch {
        /* best effort */
      }
    }
    const db = getDb()!;
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
    await destroySession(req, reply);
    return { deleted: true };
  });
}

async function upsertLichessUser(acc: { username: string; perfs?: Record<string, { rating?: number; games?: number }> }, token: string) {
  const db = getDb()!;
  const perfs = acc.perfs ?? {};
  const best = (['blitz', 'rapid', 'bullet', 'classical'] as const)
    .map((s) => ({ s, games: perfs[s]?.games ?? 0, rating: perfs[s]?.rating }))
    .sort((a, b) => b.games - a.games)[0];
  const enc = encryptSecret(token);
  const [user] = await db
    .insert(schema.users)
    .values({
      lichessUsername: acc.username,
      lichessTokenEnc: enc,
      rating: best?.rating ? Math.round(best.rating) : 1500,
      ratingSpeed: best?.games ? best.s : 'blitz',
    })
    .onConflictDoUpdate({ target: schema.users.lichessUsername, set: { lichessTokenEnc: enc } })
    .returning();
  return user!;
}
