import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { decryptSecret, randomToken, sha256 } from './crypto';
import { env } from '../env';

export const SESSION_COOKIE = 'ml_session';
export type User = typeof schema.users.$inferSelect;

function tokenFrom(req: FastifyRequest): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.cookies[SESSION_COOKIE];
}

const seen = new Map<string, number>();

/** The signed-in user, or undefined for guests. Cached on the request. */
export async function currentUser(req: FastifyRequest): Promise<User | undefined> {
  const r = req as FastifyRequest & { _user?: User | null };
  if (r._user !== undefined) return r._user ?? undefined;
  const token = tokenFrom(req);
  const db = getDb();
  if (!token || !db) {
    r._user = null;
    return undefined;
  }
  const idHash = sha256(token);
  const rows = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.idHash, idHash))
    .limit(1);
  const user = rows[0]?.user;
  r._user = user ?? null;
  if (user && (seen.get(idHash) ?? 0) < Date.now() - 3600_000) {
    seen.set(idHash, Date.now());
    void db.update(schema.sessions).set({ lastSeenAt: new Date() }).where(eq(schema.sessions.idHash, idHash));
  }
  return user;
}

export async function requireUser(req: FastifyRequest): Promise<User> {
  const u = await currentUser(req);
  if (!u) throw Object.assign(new Error('Sign in with Lichess to use this feature'), { statusCode: 401, name: 'unauthorized' });
  return u;
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb()!;
  const token = randomToken(32);
  await db.insert(schema.sessions).values({ idHash: sha256(token), userId });
  return token;
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.PUBLIC_URL.startsWith('https'),
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const token = tokenFrom(req);
  const db = getDb();
  if (token && db) await db.delete(schema.sessions).where(eq(schema.sessions.idHash, sha256(token)));
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Lichess token for explorer calls: the user's own, else the owner's fallback token. */
export function explorerToken(user: User | undefined): string | undefined {
  if (user?.lichessTokenEnc) {
    try {
      return decryptSecret(user.lichessTokenEnc);
    } catch {
      /* fall through */
    }
  }
  return env.LICHESS_FALLBACK_TOKEN || undefined;
}
