const CACHE_NAME = 'wg-app-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first Strategy
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
