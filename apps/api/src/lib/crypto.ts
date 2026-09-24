import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { requireEnv } from '../env';

/** AES-256-GCM with TOKEN_ENC_KEY. Output: base64(iv | tag | ciphertext). */
export function encryptSecret(plain: string): string {
  const key = keyBytes();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decryptSecret(enc: string): string {
  const buf = Buffer.from(enc, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

function keyBytes(): Buffer {
  const key = Buffer.from(requireEnv('TOKEN_ENC_KEY', 'Token encryption'), 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must be 32 bytes, base64-encoded');
  return key;
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const sha256b64url = (s: string) => createHash('sha256').update(s).digest('base64url');

/** HMAC-signed, expiring, compact payloads (OAuth state etc.). */
export function sign(payload: object, ttlSec: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSec * 1000 })).toString('base64url');
  return `${body}.${hmac(body)}`;
}

export function verify<T>(token: string): T | undefined {
  const [body, mac] = token.split('.');
  if (!body || !mac || hmac(body) !== mac) return undefined;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T & { exp: number };
  return data.exp > Date.now() ? data : undefined;
}

function hmac(s: string) {
  return createHmac('sha256', Buffer.from(requireEnv('SESSION_SECRET', 'Sessions'), 'base64')).update(s).digest('base64url');
}
