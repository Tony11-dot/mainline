import { buildApp } from './app';
import { env } from './env';
import { runMigrations } from './db/migrate';
import { closeDb } from './db/client';

const app = await buildApp();
try {
  if (await runMigrations()) app.log.info('database migrations applied');
  else app.log.warn('DATABASE_URL not set — running without persistence (in-memory caches only)');
} catch (err) {
  app.log.error({ err }, 'migration failed');
  process.exit(1);
}

await app.listen({ port: env.PORT, host: env.HOST });

const { startBackground } = await import('./jobs/background');
startBackground(app.log);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    await closeDb();
    process.exit(0);
  });
}
