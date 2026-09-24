import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { chessRoutes } from './chess';
import { syncRoutes } from './sync';
import { coachRoutes } from './coach';
import { pushRoutes } from './push';
import { gamesRoutes } from './games';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes);
  await app.register(chessRoutes);
  await app.register(syncRoutes);
  await app.register(coachRoutes);
  await app.register(pushRoutes);
  await app.register(gamesRoutes);
}
