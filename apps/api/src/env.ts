import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  TOKEN_ENC_KEY: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  LICHESS_CLIENT_ID: z.string().default('mainline'),
  LICHESS_FALLBACK_TOKEN: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  AI_MODEL_FAST: z.string().default('gemini-flash-lite-latest'),
  AI_MODEL_LONG: z.string().default('gemini-flash-lite-latest'),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  AI_DAILY_BUDGET: z.coerce.number().default(400),
  WEB_DIST: z.string().optional(),
  EXTRA_CORS_ORIGINS: z.string().default(''),
  /** Shown on /privacy and /terms: an email address or a URL. */
  LEGAL_CONTACT: z.string().default('https://github.com/Tony11-dot/mainline/issues'),
});

export type Env = z.infer<typeof schema>;
export const env: Env = schema.parse(process.env);

/** Thrown when a feature needs a secret that isn't configured — surfaced to clients as HTTP 503. */
export class MissingConfigError extends Error {
  constructor(public readonly key: string, feature: string) {
    super(`${feature} is not configured: set ${key} in the server environment (see .env.example).`);
    this.name = 'MissingConfigError';
  }
}

export function requireEnv<K extends keyof Env>(key: K, feature: string): NonNullable<Env[K]> {
  const v = env[key];
  if (v === undefined || v === null || v === '') throw new MissingConfigError(String(key), feature);
  return v as NonNullable<Env[K]>;
}
