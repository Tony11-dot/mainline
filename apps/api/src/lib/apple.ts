import { createPrivateKey, createPublicKey, sign as signData, verify as verifySig, type webcrypto } from 'node:crypto';
import { env } from '../env';
import { sha256 } from './crypto';

/** Sign in with Apple: the identity token's audience is the iOS app's bundle id. */
export const APPLE_AUDIENCE = 'app.mainline.chess';
const ISSUER = 'https://appleid.apple.com';
const KEYS_URL = 'https://appleid.apple.com/auth/keys';

type Jwk = webcrypto.JsonWebKey & { kid: string };
let keyCache: { at: number; keys: Jwk[] } | undefined;

async function appleKeys(refresh = false): Promise<Jwk[]> {
  if (!refresh && keyCache && Date.now() - keyCache.at < 6 * 3600_000) return keyCache.keys;
  const res = await fetch(KEYS_URL);
  if (!res.ok) throw new Error(`Apple keys: HTTP ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  keyCache = { at: Date.now(), keys };
  return keys;
}

export interface AppleClaims {
  sub: string;
  email?: string;
}

/**
 * Verifies an identity token from the iOS app: RS256 signature against Apple's published keys, issuer,
 * audience, expiry, and (when the app sent one) that the token carries sha256(rawNonce).
 * Returns undefined for anything that doesn't check out.
 */
export async function verifyAppleIdentityToken(token: string, rawNonce?: string, now = Date.now(), keys = appleKeys): Promise<AppleClaims | undefined> {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  const [h, p, s] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  if (header.alg !== 'RS256' || !header.kid) return undefined;
  let jwk = (await keys()).find((k) => k.kid === header.kid);
  // Apple rotates keys: one refetch when the kid is new to us.
  if (!jwk && keys === appleKeys) jwk = (await appleKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) return undefined;
  const ok = verifySig('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  if (!ok) return undefined;
  const aud = payload.aud;
  if (payload.iss !== ISSUER || !(aud === APPLE_AUDIENCE || (Array.isArray(aud) && aud.includes(APPLE_AUDIENCE)))) return undefined;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < now - 60_000) return undefined;
  if (rawNonce !== undefined && payload.nonce !== sha256(rawNonce)) return undefined;
  if (typeof payload.sub !== 'string' || !payload.sub) return undefined;
  return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
}

/* ---------------- Token revocation (account deletion) ---------------- */

export const appleRevokeEnabled = () => !!(env.APPLE_SIWA_KEY_ID && env.APPLE_SIWA_PRIVATE_KEY);

/** The client secret Apple's token endpoints want: an ES256 JWT signed with the Sign in with Apple key. */
export function appleClientSecret(now = Date.now(), keyId = env.APPLE_SIWA_KEY_ID!, pem = env.APPLE_SIWA_PRIVATE_KEY!, teamId = env.APPLE_TEAM_ID): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const iat = Math.floor(now / 1000);
  const body = `${b64({ alg: 'ES256', kid: keyId })}.${b64({ iss: teamId, iat, exp: iat + 300, aud: ISSUER, sub: APPLE_AUDIENCE })}`;
  // Railway variables can't hold newlines everywhere, so a key pasted with literal \n works too.
  const key = createPrivateKey(pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem);
  return `${body}.${signData('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

const form = (o: Record<string, string>) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: APPLE_AUDIENCE, client_secret: appleClientSecret(), ...o }),
});

/** Trades the app's one-time authorization code for a refresh token (kept only so deletion can revoke it). */
export async function appleRefreshToken(authorizationCode: string): Promise<string | undefined> {
  if (!appleRevokeEnabled()) return undefined;
  const res = await fetch(`${ISSUER}/auth/token`, form({ grant_type: 'authorization_code', code: authorizationCode }));
  if (!res.ok) return undefined;
  return ((await res.json()) as { refresh_token?: string }).refresh_token;
}

/** Account deletion: tells Apple to drop MainLine's access (App Store guideline 5.1.1(v)). */
export async function revokeAppleToken(refreshToken: string): Promise<boolean> {
  if (!appleRevokeEnabled()) return false;
  const res = await fetch(`${ISSUER}/auth/revoke`, form({ token: refreshToken, token_type_hint: 'refresh_token' }));
  return res.ok;
}
