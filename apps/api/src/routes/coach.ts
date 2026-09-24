import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { positionFromFen } from '@mainline/shared';
import { explain } from '../services/coach';
import { aiConfigured, budgetLeft } from '../lib/ai';
import { currentUser, explorerToken } from '../lib/session';

const uci = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
const body = z.object({
  kind: z.enum(['move', 'line', 'mistake', 'punish', 'position']),
  fen: z.string().min(10).max(120),
  moveUci: uci.optional(),
  playedUci: uci.optional(),
  lineUcis: z.array(uci).max(40).optional(),
  question: z.string().max(400).optional(),
  rating: z.number().int().min(400).max(3200).optional(),
  speeds: z.array(z.enum(['bullet', 'blitz', 'rapid', 'classical', 'correspondence'])).max(5).optional(),
});

export async function coachRoutes(app: FastifyInstance) {
  await app.register(import('@fastify/rate-limit'), { global: false });
  app.post('/api/coach', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const input = body.parse(req.body);
    try {
      positionFromFen(input.fen);
    } catch {
      throw Object.assign(new Error('invalid FEN'), { statusCode: 400 });
    }
    const user = await currentUser(req);
    return explain({ ...input, rating: input.rating ?? user?.rating }, explorerToken(user));
  });
  app.get('/api/coach/status', async () => ({ ai: aiConfigured(), budgetLeft: await budgetLeft() }));
}
