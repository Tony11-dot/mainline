import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    headers: isolation,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } },
  },
  preview: { port: 4173, headers: isolation, proxy: { '/api': 'http://localhost:8787' } },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 900 },
  worker: { format: 'es' },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
