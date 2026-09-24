import { GoogleGenAI } from '@google/genai';
import { sql } from 'drizzle-orm';
import { env } from '../env';
import { getDb, schema } from '../db/client';
import { sleep } from './queue';

export interface AiRequest {
  system: string;
  prompt: string;
  long?: boolean;
  maxTokens?: number;
}

export interface AiProvider {
  name: string;
  available(): boolean;
  generate(req: AiRequest): Promise<{ text: string; model: string }>;
}

export class AiRateLimited extends Error {
  constructor() {
    super('AI provider rate-limited');
  }
}

class GeminiProvider implements AiProvider {
  name = 'gemini';
  private client?: GoogleGenAI;
  available() {
    return !!env.GEMINI_API_KEY;
  }
  async generate(req: AiRequest) {
    this.client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });
    const model = req.long ? env.AI_MODEL_LONG : env.AI_MODEL_FAST;
    try {
      const res = await this.client.models.generateContent({
        model,
        contents: req.prompt,
        config: { systemInstruction: req.system, temperature: 0.4, maxOutputTokens: req.maxTokens ?? 500 },
      });
      return { text: res.text ?? '', model };
    } catch (e) {
      const status = (e as { status?: number; code?: number }).status ?? (e as { code?: number }).code;
      if (status === 429 || /RESOURCE_EXHAUSTED|429/.test(String((e as Error).message))) throw new AiRateLimited();
      throw e;
    }
  }
}

class GroqProvider implements AiProvider {
  name = 'groq';
  available() {
    return !!env.GROQ_API_KEY;
  }
  async generate(req: AiRequest) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: 0.4,
        max_tokens: req.maxTokens ?? 500,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
      }),
    });
    if (res.status === 429) throw new AiRateLimited();
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return { text: data.choices[0]?.message.content ?? '', model: env.GROQ_MODEL };
  }
}

export const providers: AiProvider[] = [new GeminiProvider(), new GroqProvider()];
export const aiConfigured = () => providers.some((p) => p.available());

/* ---------------- Queue (concurrency 1) + daily budget ---------------- */

let tail: Promise<unknown> = Promise.resolve();
let memUsage = { day: '', n: 0 };

/** Gemini's free-tier quota resets at midnight Pacific. */
export function pacificDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function takeBudget(): Promise<boolean> {
  const day = pacificDay();
  const db = getDb();
  if (!db) {
    if (memUsage.day !== day) memUsage = { day, n: 0 };
    if (memUsage.n >= env.AI_DAILY_BUDGET) return false;
    memUsage.n++;
    return true;
  }
  const rows = await db
    .insert(schema.aiUsage)
    .values({ day, requests: 1 })
    .onConflictDoUpdate({ target: schema.aiUsage.day, set: { requests: sql`${schema.aiUsage.requests} + 1` } })
    .returning();
  return (rows[0]?.requests ?? 0) <= env.AI_DAILY_BUDGET;
}

export async function budgetLeft(): Promise<number> {
  const day = pacificDay();
  const db = getDb();
  if (!db) return env.AI_DAILY_BUDGET - (memUsage.day === day ? memUsage.n : 0);
  const row = await db.query.aiUsage.findFirst({ where: (t, { eq }) => eq(t.day, day) });
  return env.AI_DAILY_BUDGET - (row?.requests ?? 0);
}

export class AiResting extends Error {
  constructor() {
    super('The coach is resting — daily AI budget reached. Back tomorrow.');
  }
}

/** Runs one generation at a time, with jittered exponential back-off on 429 and provider fallback. */
export function generate(req: AiRequest): Promise<{ text: string; model: string }> {
  const job = tail.then(async () => {
    if (!(await takeBudget())) throw new AiResting();
    let lastErr: unknown;
    for (const p of providers.filter((x) => x.available())) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await p.generate(req);
        } catch (e) {
          lastErr = e;
          if (!(e instanceof AiRateLimited)) break;
          await sleep(Math.min(8000, 800 * 2 ** attempt) + Math.random() * 400);
        }
      }
    }
    throw lastErr ?? new Error('no AI provider available');
  });
  tail = job.catch(() => undefined);
  return job;
}
