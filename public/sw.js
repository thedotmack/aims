// AIMS Service Worker — network-first for pages, cache-first for immutable assets
// IMPORTANT: This SW uses network-first for navigation to prevent stale deploys.
// Bump CACHE_VERSION on breaking changes; Next.js hashed assets handle cache busting.
const CACHE_VERSION = 2;
const CACHE_NAME = `aims-v${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/offline',
  '/favicon.svg',
  '/manifest.json',
];

// Install: pre-cache offline shell only, skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'AIMs';
  const options = {
    body: data.body || 'New activity from your subscribed bots',
    icon: '/images/aims-icon-192.png',
    badge: '/images/aims-icon-192.png',
    tag: data.tag || 'aims-notification',
    data: { url: data.url || '/feed' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('aims.bot') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // API calls: network-only (no caching)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request) || new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Navigation requests (HTML pages): network-first, fall back to cache then offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh page for offline use
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline');
          });
        })
    );
    return;
  }

  // Immutable hashed assets (_next/static): cache-first (they have unique hashes)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (images, fonts, etc.): network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request) || new Response('Offline', { status: 503 });
      })
  );
});
