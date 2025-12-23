// Service Worker for Push Notifications and Offline Support
// Version 4 - HARD FIX
// Rules:
// 1) Navigation requests are NETWORK ONLY and are NOT intercepted with offline UI.
// 2) Offline page is NEVER used for HTML/page loads.
// 3) Static assets are cache-first.

const STATIC_CACHE_NAME = 'plagaiscans-static-v4';

const STATIC_ASSETS = [
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/favicon.png',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v4...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v4...');
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== STATIC_CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

function isStaticAssetRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Cache-first only for true static assets
  return (
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.ttf')
  );
}

function shouldBypassServiceWorker(request) {
  const url = new URL(request.url);

  // Never touch non-GET
  if (request.method !== 'GET') return true;

  // Never touch navigation in bypass function (handled separately)

  // Never intercept dev server / HMR requests
  if (url.pathname.startsWith('/@vite') || url.pathname.startsWith('/src/')) return true;

  // Never intercept backend/API requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rest/') || url.pathname.startsWith('/functions/')) return true;

  // Never intercept external requests
  if (url.origin !== self.location.origin) return true;

  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1️⃣ COMPLETELY BYPASS SERVICE WORKER FOR NAVIGATION
  // Network only, no cache, no offline UI, no try/catch fallback.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  // Bypass everything else we shouldn't handle
  if (shouldBypassServiceWorker(request)) return;

  // 5️⃣ Static assets: cache-first (offline allowed via cache only)
  if (isStaticAssetRequest(request)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // For any other same-origin GETs (rare): network-only (no offline UI)
  event.respondWith(fetch(request));
});

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Update in background
    eventWait(fetchAndCacheStatic(request));
    return cached;
  }

  return fetchAndCacheStatic(request);
}

async function fetchAndCacheStatic(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

function eventWait(promise) {
  try {
    // no-op helper: safely attach background work
    // eslint-disable-next-line no-undef
    self.__bg = self.__bg || [];
    // eslint-disable-next-line no-undef
    self.__bg.push(promise);
  } catch {
    // ignore
  }
}

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  let data = {
    title: 'PlagaiScans',
    body: 'You have a new notification',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    data: {},
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-icon-192.png',
    badge: data.badge || '/pwa-icon-192.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'close', title: 'Dismiss' },
    ],
    requireInteraction: true,
    tag: data.tag || 'default',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (event.notification.data?.url) client.navigate(event.notification.data.url);
          return;
        }
      }
      const url = event.notification.data?.url || '/dashboard';
      return clients.openWindow(url);
    })
  );
});

console.log('[SW] Service worker v4 loaded');
