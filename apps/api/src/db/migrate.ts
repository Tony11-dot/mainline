import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { getDb } from './client';

/** Runs pending migrations. Works both from src (tsx) and from the bundled dist. */
export async function runMigrations() {
  const db = getDb();
  if (!db) return false;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, '../drizzle'), path.resolve(here, '../../drizzle')];
  const migrationsFolder = candidates.find((p) => existsSync(p));
  if (!migrationsFolder) throw new Error('drizzle migrations folder not found');
  await migrate(db, { migrationsFolder });
  return true;
}
