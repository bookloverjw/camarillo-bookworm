// Bump this on breaking cache-strategy changes; old caches are purged on activate.
const CACHE_NAME = 'bookworm-v2';

// Core assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
];

// Install: pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches (purges the unversioned bookworm-v1 cache,
// which served first-visit assets forever and white-screened after deploys)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy: network-first everywhere, cache as offline fallback.
// The old cache-first asset branch pinned the first-ever-fetched JS/CSS
// permanently; after a deploy the cached index.html referenced bundle
// hashes that no longer existed. Network-first trades a little latency
// for always-fresh content, and the cache still covers offline visits.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (CDNs, APIs, etc.)
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
            // Keep the offline navigation fallback fresh too
            if (request.mode === 'navigate') {
              cache.put('/index.html', response.clone());
            }
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('/index.html');
          return Response.error();
        })
      )
  );
});
