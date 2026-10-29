// Loads the app's own modules (packs, shared chess utils) outside the browser through Vite's SSR
// transform, so the hint pipeline enumerates exactly the positions the trainer trains.
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** Scratch output of the pipeline (not committed): positions, Lichess facts, raw model output. */
export const WORK = path.join(WEB, 'scripts/hints/work');

let server;
export async function loadApp() {
  server ??= await createServer({ configFile: path.join(WEB, 'vite.config.ts'), root: WEB, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  const [packs, shared] = await Promise.all([server.ssrLoadModule('/src/lib/packs.ts'), server.ssrLoadModule('@mainline/shared')]);
  return { packs, shared, close: () => server.close() };
}
