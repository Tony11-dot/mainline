import pg from 'pg';

/** Postgres for tests: TEST_DATABASE_URL (CI provides one), else a local `createdb mainline_test`; none on CI without one. */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? (process.env.CI ? undefined : 'postgres://localhost:5432/mainline_test');

/**
 * Points the app at the test database and migrates it. Call it before anything imports ../env.
 * Test files run in parallel against one fresh database on CI, so they migrate one at a time.
 */
export async function useTestDatabase(): Promise<void> {
  process.env.DATABASE_URL = testDatabaseUrl;
  const lock = new pg.Client({ connectionString: testDatabaseUrl });
  await lock.connect();
  try {
    await lock.query('select pg_advisory_lock(7419)');
    const { runMigrations } = await import('./migrate');
    await runMigrations();
  } finally {
    await lock.end();
  }
}
