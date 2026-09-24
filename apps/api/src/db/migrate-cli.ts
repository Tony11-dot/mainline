import { closeDb } from './client';
import { runMigrations } from './migrate';

const ran = await runMigrations();
console.log(ran ? 'migrations applied' : 'DATABASE_URL not set — nothing to migrate');
await closeDb();
