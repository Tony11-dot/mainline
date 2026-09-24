import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

delete process.env.DATABASE_URL;
const { buildApp } = await import('../app');
const { _resetLichessLimits } = await import('../lib/lichess');
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp({ logger: false });
});
afterAll(() => app.close());
beforeEach(() => {
  vi.restoreAllMocks();
  _resetLichessLimits();
});

describe('games proxy', () => {
  it('normalises Lichess NDJSON (standard only, colour, result, UCI)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        [
          { id: 'g1', variant: 'standard', speed: 'blitz', createdAt: 1, lastMoveAt: 2, status: 'mate', winner: 'black', moves: 'e4 c5 Nf3 d6 d4', players: { white: { user: { name: 'Opp' }, rating: 1700 }, black: { user: { name: 'Me' }, rating: 1650 } } },
          { id: 'g2', variant: 'chess960', speed: 'blitz', createdAt: 1, status: 'draw', moves: 'e4', players: { white: { user: { name: 'Me' } }, black: { user: { name: 'X' } } } },
        ]
          .map((x) => JSON.stringify(x))
          .join('\n'),
      ),
    );
    const res = await app.inject({ url: '/api/games?site=lichess&user=Me' });
    const games = res.json().games;
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ id: 'lichess:g1', color: 'black', result: 'win', opponent: 'Opp', ucis: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4'] });
  });

  it('normalises Chess.com archives', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const u = String(input);
      if (u.endsWith('/archives')) return Response.json({ archives: ['https://api.chess.com/pub/player/me/games/2026/09'] });
      return Response.json({
        games: [
          { url: 'https://www.chess.com/game/live/123', rules: 'chess', time_class: 'rapid', end_time: 1790000000, pgn: '[Event "Live"]\n\n1. d4 Nf6 2. c4 e6 *', white: { username: 'Me', rating: 1500, result: 'agreed' }, black: { username: 'Opp', rating: 1520, result: 'agreed' } },
        ],
      });
    });
    const res = await app.inject({ url: '/api/games?site=chesscom&user=Me' });
    expect(res.json().games[0]).toMatchObject({ id: 'chesscom:123', color: 'white', result: 'draw', ucis: ['d2d4', 'g8f6', 'c2c4', 'e7e6'] });
  });

  it('rejects bad usernames', async () => {
    expect((await app.inject({ url: '/api/games?site=lichess&user=a%20b' })).statusCode).toBe(400);
  });
});
