import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { chessRoutes } from './chess';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes);
  await app.register(chessRoutes);
}
