/// <reference lib="webworker" />
/**
 * Service worker: offline app shell, runtime caches for the engine / pieces / fonts, Web Push
 * reminders, and the PWA share target (a shared PGN is stashed and handed to the app's import sheet).
 * Cached responses keep their COOP/COEP headers, so the offline app stays cross-origin isolated.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigations → cached index.html (except API and the share-target POST).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/import/, /^\/privacy/, /^\/terms/] }));

registerRoute(({ url }) => url.pathname.startsWith('/engine/'), new CacheFirst({ cacheName: 'engine', plugins: [new ExpirationPlugin({ maxEntries: 8 })] }));
registerRoute(({ url }) => url.pathname.startsWith('/pieces/'), new CacheFirst({ cacheName: 'pieces', plugins: [new ExpirationPlugin({ maxEntries: 200 })] }));
registerRoute(({ request }) => request.destination === 'font', new CacheFirst({ cacheName: 'fonts', plugins: [new ExpirationPlugin({ maxEntries: 60 })] }));
registerRoute(({ url }) => url.pathname === '/api/openings/at' || url.pathname === '/api/eval', new StaleWhileRevalidate({ cacheName: 'evals', plugins: [new ExpirationPlugin({ maxEntries: 2000, maxAgeSeconds: 30 * 86400 })] }));

// Share target: stash the shared PGN, then open the app on the import screen.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname !== '/import' || event.request.method !== 'POST') return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const file = form.get('pgn');
      const text = file instanceof File ? await file.text() : String(form.get('text') ?? '');
      const cache = await caches.open('share');
      await cache.put('/shared-pgn', new Response(text, { headers: { 'Content-Type': 'text/plain' } }));
      return Response.redirect('/library?import=shared', 303);
    })(),
  );
});

// Web Push: daily due reminder, streak nudge, weekly summary.
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string };
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'MainLine', {
      body: data.body ?? 'Your openings are waiting.',
      icon: '/icon-192.png',
      badge: '/favicon-32.png',
      tag: data.tag ?? 'mainline',
      data: { url: data.url ?? '/train?mode=review' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string })?.url ?? '/';
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if ('focus' in w) {
          await (w as WindowClient).navigate(target).catch(() => undefined);
          return (w as WindowClient).focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
