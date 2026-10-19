import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.TOKEN_ENC_KEY = Buffer.alloc(32, 1).toString('base64');
process.env.SESSION_SECRET = Buffer.alloc(32, 2).toString('base64');
const { decryptSecret, encryptSecret, sign, verify } = await import('./crypto');
const { env } = await import('../env');

afterEach(() => vi.useRealTimers());

describe('token encryption', () => {
  it('round-trips, with a fresh IV every time', () => {
    const a = encryptSecret('lio_token_ü');
    const b = encryptSecret('lio_token_ü');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('lio_token_ü');
    expect(decryptSecret(b)).toBe('lio_token_ü');
  });

  it('refuses a tampered ciphertext', () => {
    const buf = Buffer.from(encryptSecret('lio_token'), 'base64');
    buf[buf.length - 1]! ^= 1;
    expect(() => decryptSecret(buf.toString('base64'))).toThrow();
  });

  it('refuses another key, and a key that is not 32 bytes', () => {
    const enc = encryptSecret('lio_token');
    const key = env.TOKEN_ENC_KEY;
    try {
      env.TOKEN_ENC_KEY = Buffer.alloc(32, 9).toString('base64');
      expect(() => decryptSecret(enc)).toThrow();
      env.TOKEN_ENC_KEY = Buffer.alloc(16, 1).toString('base64');
      expect(() => encryptSecret('x')).toThrow(/32 bytes/);
    } finally {
      env.TOKEN_ENC_KEY = key;
    }
  });
});

describe('signed payloads', () => {
  it('round-trips until they expire', () => {
    vi.useFakeTimers({ now: new Date('2026-10-01T12:00:00Z') });
    const token = sign({ s: 'state', r: '/library' }, 600);
    expect(verify<{ s: string; r: string }>(token)).toMatchObject({ s: 'state', r: '/library' });
    vi.setSystemTime(new Date('2026-10-01T12:09:59Z'));
    expect(verify(token)).toBeDefined();
    vi.setSystemTime(new Date('2026-10-01T12:10:01Z'));
    expect(verify(token)).toBeUndefined();
  });

  it('refuses a changed payload, a changed signature and malformed tokens', () => {
    const token = sign({ r: '/library' }, 600);
    const [body, mac] = token.split('.') as [string, string];
    const forged = Buffer.from(JSON.stringify({ r: '/elsewhere', exp: Date.now() + 600_000 })).toString('base64url');
    expect(verify(`${forged}.${mac}`)).toBeUndefined();
    expect(verify(`${body}.${mac.startsWith('A') ? 'B' : 'A'}${mac.slice(1)}`)).toBeUndefined();
    for (const bad of ['', '.', body, `${body}.`, `.${mac}`]) expect(verify(bad)).toBeUndefined();
  });

  it('is bound to the session secret', () => {
    const token = sign({ r: '/' }, 600);
    const secret = env.SESSION_SECRET;
    try {
      env.SESSION_SECRET = Buffer.alloc(32, 3).toString('base64');
      expect(verify(token)).toBeUndefined();
    } finally {
      env.SESSION_SECRET = secret;
    }
  });
});
