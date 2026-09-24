import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyCompress from '@fastify/compress';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, MissingConfigError } from './env';
import { getDb } from './db/client';

export const NATIVE_ORIGINS = [
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
];

function webDistDir(): string | undefined {
  if (env.WEB_DIST) return env.WEB_DIST;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [path.resolve(here, '../../web/dist'), path.resolve(here, '../web/dist')].find((p) => existsSync(p));
}

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? env.NODE_ENV !== 'test',
    trustProxy: true,
    bodyLimit: 5 * 1024 * 1024,
  });

  const allowed = new Set([env.PUBLIC_URL, ...NATIVE_ORIGINS, ...env.EXTRA_CORS_ORIGINS.split(',').filter(Boolean)]);
  await app.register(fastifyCors, {
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin) || env.NODE_ENV !== 'production'),
    credentials: true,
  });
  await app.register(fastifyCookie);
  await app.register(fastifyCompress, { global: true, encodings: ['br', 'gzip'] });

  // Cross-origin isolation → SharedArrayBuffer → multi-threaded Stockfish on the web.
  app.addHook('onSend', async (req, reply) => {
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Embedder-Policy', 'require-corp');
    reply.header('Cross-Origin-Resource-Policy', req.url.startsWith('/api/') ? 'cross-origin' : 'same-origin');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof MissingConfigError) {
      return reply.status(503).send({ error: 'not_configured', message: err.message });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.status(status).send({ error: (err as Error).name, message: (err as Error).message });
  });

  app.get('/api/health', async () => {
    let db: 'ok' | 'down' | 'not_configured' = 'not_configured';
    const d = getDb();
    if (d) {
      try {
        await d.execute('select 1');
        db = 'ok';
      } catch {
        db = 'down';
      }
    }
    return { ok: true, version: process.env.npm_package_version ?? '0.1.0', db };
  });

  // Registered by later phases.
  const { registerRoutes } = await import('./routes/index');
  await registerRoutes(app);

  const dist = webDistDir();
  if (dist) {
    const indexHtml = readFileSync(path.join(dist, 'index.html'), 'utf8');
    await app.register(fastifyStatic, {
      root: dist,
      wildcard: false,
      setHeaders(res, filePath) {
        if (/[.-][A-Za-z0-9_-]{8,}\.(js|css|wasm|woff2|png|svg|webp|mp3)$/.test(filePath) || filePath.includes('/assets/')) {
          res.header('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('sw.js') || filePath.endsWith('.html') || filePath.endsWith('.webmanifest')) {
          res.header('Cache-Control', 'no-cache');
        }
      },
    });
    app.get('/*', async (req, reply) => {
      const url = req.url.split('?')[0] ?? '/';
      if (url.startsWith('/api/')) return reply.status(404).send({ error: 'not_found' });
      const file = path.join(dist, decodeURIComponent(url));
      if (file.startsWith(dist) && url !== '/' && existsSync(file)) return reply.sendFile(url.slice(1));
      return reply.header('Cache-Control', 'no-cache').type('text/html').send(indexHtml);
    });
  } else {
    app.get('/', async () => ({ ok: true, note: 'web build not found; run `pnpm --filter @mainline/web build`' }));
  }

  return app;
}
