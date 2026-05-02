// ══════════════════════════════════════════
//  PurchaseLog Service Worker
//  Version bump this string to force cache refresh
// ══════════════════════════════════════════
const CACHE_NAME = 'purchaselog-v1';

// Files to cache for offline use
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

// External resources to cache (fonts)
const EXTERNAL = [
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Syne:wght@400;500;600;700;800&display=swap'
];

// ── INSTALL: cache all assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache local assets
      await cache.addAll(ASSETS);

      // Cache external fonts — best effort (don't fail install if offline)
      for (const url of EXTERNAL) {
        try {
          const resp = await fetch(url, { mode: 'cors' });
          if (resp.ok) await cache.put(url, resp);
        } catch (_) {}
      }
    })
  );
  // Take control immediately without waiting for old SW to finish
  self.skipWaiting();
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(response => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Don't cache POST, chrome-extension, etc.
        if (event.request.method !== 'GET') return response;

        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, toCache);
        });

        return response;
      }).catch(() => {
        // Network failed — return index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── MESSAGE: handle skip waiting from app ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
