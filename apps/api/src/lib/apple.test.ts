import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { APPLE_AUDIENCE, verifyAppleIdentityToken } from './apple';
import { sha256 } from './crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
const keys = async () => [jwk];
const NOW = 1_800_000_000_000;

function token(claims: Record<string, unknown>, key = privateKey, kid = 'k1') {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${b64({ alg: 'RS256', kid })}.${b64({ iss: 'https://appleid.apple.com', aud: APPLE_AUDIENCE, exp: NOW / 1000 + 600, sub: 'apple-user-1', nonce: sha256('raw-nonce-123456'), ...claims })}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), key).toString('base64url')}`;
}

describe('verifyAppleIdentityToken', () => {
  it('accepts a valid token with the matching nonce', async () => {
    expect(await verifyAppleIdentityToken(token({}), 'raw-nonce-123456', NOW, keys)).toEqual({ sub: 'apple-user-1', email: undefined });
  });
  it('rejects a bad signature, an unknown key, another audience, an expired token and a wrong nonce', async () => {
    expect(await verifyAppleIdentityToken(token({}, other.privateKey), 'raw-nonce-123456', NOW, keys)).toBeUndefined();
    expect(await verifyAppleIdentityToken(token({}, privateKey, 'k2'), 'raw-nonce-123456', NOW, keys)).toBeUndefined();
    expect(await verifyAppleIdentityToken(token({ aud: 'com.example.other' }), 'raw-nonce-123456', NOW, keys)).toBeUndefined();
    expect(await verifyAppleIdentityToken(token({ iss: 'https://evil.example' }), 'raw-nonce-123456', NOW, keys)).toBeUndefined();
    expect(await verifyAppleIdentityToken(token({ exp: NOW / 1000 - 3600 }), 'raw-nonce-123456', NOW, keys)).toBeUndefined();
    expect(await verifyAppleIdentityToken(token({}), 'another-nonce-0000', NOW, keys)).toBeUndefined();
    expect(await verifyAppleIdentityToken('not.a.jwt', 'raw-nonce-123456', NOW, keys)).toBeUndefined();
  });
});
