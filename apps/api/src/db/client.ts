import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let db: Db | undefined;

/** The database, or undefined when DATABASE_URL isn't set (features degrade to in-memory caches). */
export function getDb(): Db | undefined {
  if (!env.DATABASE_URL) return undefined;
  if (!db) {
    const url = env.DATABASE_URL;
    const local = /localhost|127\.0\.0\.1|\.railway\.internal/.test(url);
    pool = new pg.Pool({ connectionString: url, max: 10, ssl: local ? undefined : { rejectUnauthorized: false } });
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb() {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

export { schema };
