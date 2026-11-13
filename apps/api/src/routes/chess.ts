import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { positionFromFen } from '@mainline/shared';
import { evalSubmitSchema, explorerQuerySchema, fenSchema, parseRatingsCsv, parseSpeedsCsv, ratingsCsvSchema, speedsCsvSchema } from '@mainline/shared/schemas';
import { getExplorer } from '../services/explorer';
import { getEval, submitLocalEval } from '../services/evals';
import { getGuide } from '../services/guide';
import { openingAt, searchOpenings } from '../services/openings';
import { currentUser, explorerToken } from '../lib/session';

function assertFen(fen: string) {
  try {
    positionFromFen(fen);
  } catch {
    throw Object.assign(new Error('invalid FEN'), { statusCode: 400 });
  }
}

export async function chessRoutes(app: FastifyInstance) {
  app.get('/api/explorer', async (req, reply) => {
    const q = explorerQuerySchema.parse(req.query);
    assertFen(q.fen);
    const user = await currentUser(req);
    const data = await getExplorer(
      {
        source: q.source,
        fen: q.fen,
        ratings: parseRatingsCsv(q.ratings),
        speeds: parseSpeedsCsv(q.speeds),
      },
      explorerToken(user),
    );
    reply.header('Cache-Control', 'private, max-age=3600');
    return data;
  });

  app.get('/api/guide', async (req, reply) => {
    const q = z
      .object({ fen: fenSchema, ratings: ratingsCsvSchema.optional(), speeds: speedsCsvSchema.optional(), evals: z.enum(['0', '1']).default('1') })
      .parse(req.query);
    assertFen(q.fen);
    const user = await currentUser(req);
    const data = await getGuide(
      { fen: q.fen, ratings: parseRatingsCsv(q.ratings), speeds: parseSpeedsCsv(q.speeds), evals: q.evals === '1' },
      explorerToken(user),
    );
    reply.header('Cache-Control', 'private, max-age=3600');
    return data;
  });

  app.get('/api/eval', async (req, reply) => {
    const q = z.object({ fen: fenSchema, multiPv: z.coerce.number().int().min(1).max(5).default(3) }).parse(req.query);
    assertFen(q.fen);
    const data = await getEval(q.fen, q.multiPv);
    reply.header('Cache-Control', 'private, max-age=3600');
    return { eval: data };
  });

  app.post('/api/eval', async (req) => {
    const body = evalSubmitSchema.parse(req.body);
    assertFen(body.fen);
    return { result: await submitLocalEval(body.fen, body.depth, body.lines) };
  });

  app.get('/api/openings/at', async (req) => {
    const q = z.object({ fen: fenSchema }).parse(req.query);
    assertFen(q.fen);
    return { opening: openingAt(q.fen) ?? null };
  });

  app.get('/api/openings/search', async (req) => {
    const q = z.object({ q: z.string().max(80) }).parse(req.query);
    return { results: searchOpenings(q.q) };
  });
}
