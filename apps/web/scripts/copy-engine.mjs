// Copies the Stockfish lite WASM builds (GPL-3.0) into public/engine so they are served same-origin.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const bin = path.join(path.dirname(require.resolve('stockfish/package.json')), 'bin');
const out = new URL('../public/engine/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const f of ['stockfish-19-lite.js', 'stockfish-19-lite.wasm', 'stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  const src = path.join(bin, f);
  const dst = path.join(out, f);
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) copyFileSync(src, dst);
}
console.log('stockfish lite builds ready in public/engine');
