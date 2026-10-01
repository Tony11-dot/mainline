import { createPublicKey, verify as verifySig, type webcrypto } from 'node:crypto';
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
