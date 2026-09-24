import type { FastifyBaseLogger } from 'fastify';

/** Starts in-process cron jobs. Filled in by later phases. */
export function startBackground(log: FastifyBaseLogger) {
  log.info('background jobs: none registered yet');
}
