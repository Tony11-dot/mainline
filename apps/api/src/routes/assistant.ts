import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ask } from '../services/assistant';

const body = z.object({
  question: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(6000) })).max(20).optional(),
  context: z.string().max(30000).optional(),
  lang: z.string().regex(/^[a-z]{2}$/).optional(),
});

export async function assistantRoutes(app: FastifyInstance) {
  await app.register(import('@fastify/rate-limit'), { global: false });
  app.post('/api/assistant', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } }, bodyLimit: 128 * 1024 }, async (req) => ask(body.parse(req.body)));
}
