/*
 * Offline support for the installed app.
 *
 * - Navigations: network first (so a fresh deploy is picked up), falling
 *   back to the cached app shell when offline.
 * - Hashed build assets (/assets/*): cache first — their names change
 *   whenever their contents do.
 * - Everything else same-origin: stale-while-revalidate.
 *
 * Bump CACHE_VERSION to force-drop old caches.
 */
const CACHE_VERSION = 'v1';
const CACHE = `stage-tycoon-${CACHE_VERSION}`;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('stage-tycoon-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))),
    );
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        cached =>
          cached ||
          fetch(request).then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(cache => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
