import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { chessRoutes } from './chess';
import { syncRoutes } from './sync';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes);
  await app.register(chessRoutes);
  await app.register(syncRoutes);
}
