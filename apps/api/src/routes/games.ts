import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { chesscomGames, lichessGames } from '../services/games';
import { currentUser, explorerToken } from '../lib/session';

export async function gamesRoutes(app: FastifyInstance) {
  /** Normalised recent games (openings only) — used for "your games vs your prep" and opponent prep. */
  app.get('/api/games', async (req) => {
    const q = z
      .object({
        site: z.enum(['lichess', 'chesscom']),
        user: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/),
        since: z.coerce.number().int().min(0).optional(),
        max: z.coerce.number().int().min(1).max(500).default(200),
      })
      .parse(req.query);
    const user = await currentUser(req);
    const games = q.site === 'lichess' ? await lichessGames(q.user, { since: q.since, max: q.max, token: explorerToken(user) }) : await chesscomGames(q.user, { since: q.since, months: q.since ? 12 : 3 });
    return { games: games.slice(0, q.max) };
  });
}
