import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
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
export const DESKTOP_SCHEME = 'mainline';
const nativeCodes = new Lru<string>(1000, 120_000);

interface OAuthCookie {
  v: string; // PKCE verifier
  s: string; // state
  r: string; // return path
  n: 0 | 1 | 2; // 0 web, 1 mobile app (app.mainline.chess://), 2 desktop app (mainline://)
  /** Chess.com only: link to this signed-in user instead of signing in as a Chess.com account. */
  u?: string;
}

export function toMe(u: User): Me {
  return {
    id: u.id,
    lichessUsername: u.lichessUsername,
    rating: u.rating,
    ratingSpeed: u.ratingSpeed as Me['ratingSpeed'],
    chesscomUsername: u.chesscomUsername,
    chesscomVerified: !!u.chesscomId,
  };
}

type Provider = 'lichess' | 'chesscom';
const redirectUri = (p: Provider) => `${env.PUBLIC_URL.replace(/\/$/, '')}/api/auth/${p}/callback`;
const linkTickets = new Lru<string>(1000, 300_000);

export const chesscomEnabled = () => !!env.CHESSCOM_CLIENT_ID;

export async function authRoutes(app: FastifyInstance) {
  /** Which sign-in buttons the apps should show. */
  app.get('/api/auth/providers', async () => ({ lichess: true, chesscom: chesscomEnabled() }));

  /** Signed-in apps (bearer token) get a short-lived ticket to link Chess.com from the system browser. */
  app.post('/api/auth/link-ticket', async (req) => {
    const u = await requireUser(req);
    const ticket = randomToken(24);
    linkTickets.set(ticket, u.id);
    return { ticket };
  });

  const start = (provider: Provider) => async (req: FastifyRequest, reply: FastifyReply) => {
    if (!getDb()) throw new MissingConfigError('DATABASE_URL', 'Accounts');
    requireEnv('TOKEN_ENC_KEY', 'Token encryption');
    if (provider === 'chesscom') requireEnv('CHESSCOM_CLIENT_ID', 'Sign in with Chess.com');
    const q = z
      .object({ return: z.string().startsWith('/').max(200).default('/'), native: z.enum(['0', '1', 'desktop']).default('0'), link: z.string().max(64).optional() })
      .parse(req.query);
    // Linking: a ticket from the app, or the web session cookie.
    let linkUser: string | undefined;
    if (provider === 'chesscom') {
      if (q.link) {
        linkUser = linkTickets.get(q.link);
        linkTickets.delete(q.link);
      } else linkUser = (await currentUser(req))?.id;
    }
    const verifier = randomToken(48);
    const state = randomToken(16);
    const cookie: OAuthCookie = { v: verifier, s: state, r: q.return.startsWith('//') ? '/' : q.return, n: q.native === 'desktop' ? 2 : q.native === '1' ? 1 : 0, u: linkUser };
    reply.setCookie(OAUTH_COOKIE, sign(cookie, 600), {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.PUBLIC_URL.startsWith('https'),
      maxAge: 600,
    });
    const url = new URL(provider === 'lichess' ? 'https://lichess.org/oauth' : 'https://oauth.chess.com/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', provider === 'lichess' ? env.LICHESS_CLIENT_ID : env.CHESSCOM_CLIENT_ID!);
    url.searchParams.set('redirect_uri', redirectUri(provider));
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', sha256b64url(verifier));
    url.searchParams.set('state', state);
    if (provider === 'chesscom') url.searchParams.set('scope', 'openid');
    return reply.redirect(url.toString());
  };
  app.get('/api/auth/lichess/start', start('lichess'));
  app.get('/api/auth/chesscom/start', start('chesscom'));

  /** Shared callback plumbing: validates state, then hands the code to the provider-specific part. */
  const callback = (provider: Provider, signIn: (code: string, c: OAuthCookie) => Promise<User | string>) => async (req: FastifyRequest, reply: FastifyReply) => {
    const q = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }).parse(req.query);
    const raw = req.cookies[OAUTH_COOKIE];
    const c = raw ? verify<OAuthCookie>(raw) : undefined;
    reply.clearCookie(OAUTH_COOKIE, { path: '/api/auth' });
    const fail = (why: string) => {
      // Apps get the error back through their own scheme, so the in-app browser closes.
      if (c?.n) return reply.redirect(`${c.n === 2 ? DESKTOP_SCHEME : NATIVE_SCHEME}://auth?auth_error=${encodeURIComponent(why)}`);
      const r = c?.r ?? '/';
      return reply.redirect(`${r}${r.includes('?') ? '&' : '?'}auth_error=${encodeURIComponent(why)}`);
    };
    if (q.error) return fail(q.error === 'access_denied' ? 'cancelled' : q.error);
    if (!c || !q.code || q.state !== c.s) return fail('expired');
    let user: User | string;
    try {
      user = await signIn(q.code, c);
    } catch (e) {
      req.log.warn({ err: e, provider }, 'oauth sign-in failed');
      return fail('server');
    }
    if (typeof user === 'string') return fail(user);
    const session = await createSession(user.id);
    if (c.n) {
      const oneTime = randomToken(24);
      nativeCodes.set(oneTime, session);
      return reply.redirect(`${c.n === 2 ? DESKTOP_SCHEME : NATIVE_SCHEME}://auth?code=${oneTime}`);
    }
    setSessionCookie(reply, session);
    return reply.redirect(c.r);
  };

  app.get(
    '/api/auth/lichess/callback',
    callback('lichess', async (code, c) => {
      const tokenRes = await fetch('https://lichess.org/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: c.v, redirect_uri: redirectUri('lichess'), client_id: env.LICHESS_CLIENT_ID }),
      });
      if (!tokenRes.ok) return 'token_exchange';
      const { access_token } = (await tokenRes.json()) as { access_token: string };
      const accRes = await fetch('https://lichess.org/api/account', { headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': USER_AGENT } });
      if (!accRes.ok) return 'account';
      const acc = (await accRes.json()) as { username: string; perfs?: Record<string, { rating?: number; games?: number }> };
      return upsertLichessUser(acc, access_token);
    }),
  );

  app.get(
    '/api/auth/chesscom/callback',
    callback('chesscom', async (code, c) => {
      const body = new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: c.v, redirect_uri: redirectUri('chesscom'), client_id: env.CHESSCOM_CLIENT_ID! });
      if (env.CHESSCOM_CLIENT_SECRET) body.set('client_secret', env.CHESSCOM_CLIENT_SECRET);
      const tokenRes = await fetch('https://oauth.chess.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': USER_AGENT },
        body,
      });
      if (!tokenRes.ok) return 'token_exchange';
      const tok = (await tokenRes.json()) as { id_token?: string; access_token?: string };
      // The ID token came straight from Chess.com's token endpoint over TLS, which authenticates it
      // (OpenID Connect Core §3.1.3.7), so its claims are read without a separate signature check.
      const claims = tok.id_token ? chesscomClaims(tok.id_token) : undefined;
      if (!claims) return 'account';
      return upsertChesscomUser(claims, c.u);
    }),
  );

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

/** Chess.com identity from the ID token: a stable id plus the username (claim names vary by setup). */
export function chesscomClaims(idToken: string): { id: string; username: string } | undefined {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
    const str = (k: string) => (typeof payload[k] === 'string' && payload[k] ? (payload[k] as string) : undefined);
    const username = str('preferred_username') ?? str('username') ?? str('nickname') ?? str('name');
    const id = str('sub') ?? username;
    if (!id || !username || !/^[A-Za-z0-9_-]{2,40}$/.test(username)) return undefined;
    return { id, username };
  } catch {
    return undefined;
  }
}

async function upsertChesscomUser(claims: { id: string; username: string }, linkUserId?: string): Promise<User | string> {
  const db = getDb()!;
  const owner = (await db.select().from(schema.users).where(eq(schema.users.chesscomId, claims.id)).limit(1))[0];
  if (linkUserId) {
    // Linking to the signed-in account: refuse if another MainLine account already owns it.
    if (owner && owner.id !== linkUserId) return 'already_linked';
    const [u] = await db.update(schema.users).set({ chesscomId: claims.id, chesscomUsername: claims.username }).where(eq(schema.users.id, linkUserId)).returning();
    return u ?? 'account';
  }
  if (owner) {
    const [u] = await db.update(schema.users).set({ chesscomUsername: claims.username }).where(eq(schema.users.id, owner.id)).returning();
    return u!;
  }
  const [u] = await db.insert(schema.users).values({ chesscomId: claims.id, chesscomUsername: claims.username }).returning();
  return u!;
}
