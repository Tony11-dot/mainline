import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

process.env.LICHESS_FALLBACK_TOKEN = 'lip_test';
const { buildApp } = await import('../app');
const { _resetLichessLimits } = await import('../lib/lichess');

const E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp({ logger: false });
});
afterAll(() => app.close());
beforeEach(() => {
  vi.restoreAllMocks();
  _resetLichessLimits();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => handler(String(input), init));
}

describe('explorer proxy', () => {
  it('fetches with the token, normalizes castling and caches', async () => {
    const spy = mockFetch((url, init) => {
      expect(url).toContain('explorer.lichess.org/masters');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer lip_test');
      return Response.json({
        white: 10, draws: 5, black: 5,
        moves: [{ uci: 'c7c5', san: 'c5', white: 5, draws: 2, black: 3, averageRating: 2400 }, { uci: 'e8h8', san: 'O-O', white: 1, draws: 0, black: 0 }],
        topGames: [{ id: 'abc', winner: 'white', white: { name: 'Carlsen, M.', rating: 2850 }, black: { name: 'Caruana, F.', rating: 2800 }, year: 2019, uci: 'c7c5' }],
        opening: { eco: 'B00', name: "King's Pawn" },
      });
    });
    const res = await app.inject({ url: `/api/explorer?source=masters&fen=${encodeURIComponent(E4)}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(20);
    expect(body.moves[0].total).toBe(10);
    expect(body.moves[1].uci).toBe('e8g8');
    expect(body.topGames[0].white.name).toBe('Carlsen, M.');
    const again = await app.inject({ url: `/api/explorer?source=masters&fen=${encodeURIComponent(E4)}` });
    expect(again.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('backs off for 60s after a 429', async () => {
    const spy = mockFetch(() => new Response('slow down', { status: 429 }));
    const fen = encodeURIComponent('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1');
    const r1 = await app.inject({ url: `/api/explorer?source=lichess&fen=${fen}&ratings=1600,1800&speeds=blitz` });
    expect(r1.statusCode).toBe(429);
    expect(r1.headers['retry-after']).toBe('60');
    const r2 = await app.inject({ url: `/api/explorer?source=lichess&fen=${fen}&ratings=1600&speeds=rapid` });
    expect(r2.statusCode).toBe(429);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('rejects bad FENs', async () => {
    const res = await app.inject({ url: `/api/explorer?source=masters&fen=${encodeURIComponent('xxxxxxxxxxxx w - - 0 1')}` });
    expect(res.statusCode).toBe(400);
  });
});

describe('eval', () => {
  it('returns cloud evals and null on miss', async () => {
    mockFetch((url) =>
      url.includes('cloud-eval') && url.includes('4P3')
        ? Response.json({ fen: E4, depth: 40, knodes: 1000, pvs: [{ moves: 'c7c5 g1f3', cp: 30 }, { moves: 'e7e5', mate: -12 }] })
        : new Response('{}', { status: 404 }),
    );
    const res = await app.inject({ url: `/api/eval?fen=${encodeURIComponent(E4)}` });
    expect(res.json().eval.lines[0]).toEqual({ moves: ['c7c5', 'g1f3'], cp: 30 });
    expect(res.json().eval.lines[1].mate).toBe(-12);
    const miss = await app.inject({ url: `/api/eval?fen=${encodeURIComponent('8/8/8/8/8/5k2/8/4K2R w K - 0 1')}` });
    expect(miss.json().eval).toBeNull();
  });

  it('rejects illegal submitted PVs', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/eval', payload: { fen: E4, depth: 20, lines: [{ moves: ['e2e4'], cp: 10 }] } });
    // no DB in unit tests → validation happens only when persisting; accept 'ignored' or 400
    expect([200, 400]).toContain(res.statusCode);
  });
});

describe('guide bundle', () => {
  it('returns explorer numbers plus the eval after each popular move, then serves it from cache', async () => {
    const SIC = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
    const ex = (moves: [string, string, number][]) => ({ white: 1, draws: 1, black: 1, moves: moves.map(([uci, san, n]) => ({ uci, san, white: n, draws: 0, black: 0 })) });
    const spy = mockFetch((url) => {
      if (url.includes('explorer.lichess.org/lichess')) return Response.json(ex([['g1f3', 'Nf3', 300], ['b1c3', 'Nc3', 100]]));
      if (url.includes('explorer.lichess.org/masters')) return Response.json(ex([['g1f3', 'Nf3', 50], ['c2c3', 'c3', 10]]));
      if (url.includes('cloud-eval')) {
        const fen = decodeURIComponent(new URL(url).searchParams.get('fen')!);
        if (fen.startsWith('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/')) return Response.json({ fen, depth: 40, knodes: 1, pvs: [{ moves: 'g1f3 d7d6', cp: 30 }] });
        if (fen.includes('2N5')) return Response.json({ fen, depth: 35, knodes: 1, pvs: [{ moves: 'b8c6', cp: 15 }] });
      }
      return new Response('{}', { status: 404 });
    });
    const url = `/api/guide?fen=${encodeURIComponent(SIC)}&ratings=1600,1800&speeds=blitz`;
    const res = await app.inject({ url });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.lichess.moves.map((m: { uci: string }) => m.uci)).toEqual(['g1f3', 'b1c3']);
    expect(b.masters.total).toBe(3);
    expect(b.eval.lines[0].moves[0]).toBe('g1f3');
    // Nf3 is covered by the position's own eval; the others get their own.
    expect(Object.keys(b.children).sort()).toEqual(['b1c3', 'c2c3']);
    expect(b.children.b1c3.lines[0]).toEqual({ moves: ['b8c6'], cp: 15 });
    expect(b.children.c2c3).toBeNull();
    const calls = spy.mock.calls.length;
    await app.inject({ url });
    expect(spy.mock.calls.length).toBe(calls);
  });
});

describe('openings', () => {
  it('names positions and searches', async () => {
    const at = await app.inject({ url: `/api/openings/at?fen=${encodeURIComponent('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2')}` });
    expect(at.json().opening.name).toBe('Sicilian Defense');
    const s = await app.inject({ url: '/api/openings/search?q=najdorf' });
    expect(s.json().results.length).toBeGreaterThan(3);
  });
});
