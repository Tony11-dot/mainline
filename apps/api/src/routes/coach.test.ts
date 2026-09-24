import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

process.env.GEMINI_API_KEY = 'test-key';
process.env.AI_DAILY_BUDGET = '3';
delete process.env.DATABASE_URL;
const { buildApp } = await import('../app');
const ai = await import('../lib/ai');

const FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp({ logger: false });
});
afterAll(() => app.close());
beforeEach(() => {
  vi.restoreAllMocks();
  // Cloud eval for the position; nothing for children; no explorer token in tests.
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
    String(input).includes('cloud-eval') && decodeURIComponent(String(input)).includes('4p3/4P3/8/PPPP1PPP/RNBQKBNR w')
      ? Response.json({ fen: FEN, depth: 40, knodes: 1, pvs: [{ moves: 'g1f3 b8c6 f1b5', cp: 30 }] })
      : new Response('{}', { status: 404 }),
  );
});

const ask = (body: object) => app.inject({ method: 'POST', url: '/api/coach', payload: body });

describe('coach', () => {
  it('uses the AI when its moves validate, and caches', async () => {
    const gen = vi.spyOn(ai.providers[0]!, 'generate').mockResolvedValue({ text: '[[Nf3]] develops and attacks e5; after [[Nc6]] White continues [[Bb5]].', model: 'm' });
    const r = await ask({ kind: 'move', fen: FEN, moveUci: 'g1f3' });
    expect(r.json().source).toBe('ai');
    expect(r.json().facts.engine.lines[0].san).toEqual(['Nf3', 'Nc6', 'Bb5']);
    const again = await ask({ kind: 'move', fen: FEN, moveUci: 'g1f3' });
    expect(again.json().source).toBe('cache');
    expect(gen).toHaveBeenCalledTimes(1);
    // The system prompt carries the grounding rules and the facts go in the prompt.
    expect(gen.mock.calls[0]![0].system).toContain('ONLY with the facts');
    expect(gen.mock.calls[0]![0].prompt).toContain('"move":"Nf3"');
  });

  it('regenerates once on invented moves, then falls back to the template', async () => {
    const gen = vi.spyOn(ai.providers[0]!, 'generate').mockResolvedValue({ text: 'White should play [[Qh5]] and [[Qxf7#]].', model: 'm' });
    const r = await ask({ kind: 'move', fen: FEN, moveUci: 'b1c3' });
    expect(gen).toHaveBeenCalledTimes(2);
    expect(r.json().source).toBe('template');
    expect(r.json().text).toContain('[[Nc3]]');
  });

  it('rests when the daily budget is spent', async () => {
    vi.spyOn(ai.providers[0]!, 'generate').mockResolvedValue({ text: 'ok [[d4]]', model: 'm' });
    // budget 3: two used above (1 + 2)… spend the rest
    await ask({ kind: 'move', fen: FEN, moveUci: 'd2d4' });
    const r = await ask({ kind: 'move', fen: FEN, moveUci: 'f1c4' });
    expect(r.json().resting).toBe(true);
    expect(r.json().source).toBe('template');
    const status = await app.inject({ url: '/api/coach/status' });
    expect(status.json().budgetLeft).toBeLessThanOrEqual(0);
  });

  it('validates input', async () => {
    expect((await ask({ kind: 'move', fen: 'bad fen here x' })).statusCode).toBe(400);
    expect((await ask({ kind: 'nope', fen: FEN })).statusCode).toBe(400);
  });
});
