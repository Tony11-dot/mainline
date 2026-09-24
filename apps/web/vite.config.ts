import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        // App shell + small data. Engines, pieces, fonts are cached at runtime on first use.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}', 'data/openings.json', 'launch.json'],
        globIgnores: ['engine/**', 'pieces/**', '**/*.map'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        rollupFormat: 'iife',
      },
      devOptions: { enabled: false },
      manifest: {
        id: '/',
        name: 'MainLine',
        short_name: 'MainLine',
        description: 'Master your chess openings, branch by branch.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F9FAFD',
        theme_color: '#F9FAFD',
        categories: ['education', 'games'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Train now', url: '/train?mode=review', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Repertoire', url: '/library', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        ],
        // Share a PGN (or text) to MainLine from other apps → import sheet.
        share_target: {
          action: '/import',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { title: 'title', text: 'text', files: [{ name: 'pgn', accept: ['.pgn', 'application/x-chess-pgn', 'text/plain'] }] },
        },
        file_handlers: [{ action: '/import', accept: { 'application/x-chess-pgn': ['.pgn'] } }],
      } as never,
    }),
  ],
  server: {
    port: 5173,
    headers: isolation,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false }, '^/(privacy|terms)$': 'http://localhost:8787' },
  },
  preview: { port: 4173, headers: isolation, proxy: { '/api': 'http://localhost:8787', '^/(privacy|terms)$': 'http://localhost:8787' } },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 900 },
  worker: { format: 'es' },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
