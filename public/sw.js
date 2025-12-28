// Service Worker for Push Notifications ONLY
// Version 5 - HARD FIX: Navigation requests are NEVER intercepted
// Offline page is NEVER served for HTML/page loads

const SW_VERSION = 'v5';
const STATIC_CACHE_NAME = `plagaiscans-static-${SW_VERSION}`;

// Only cache static assets (not HTML)
const STATIC_ASSETS = [
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/favicon.png',
];

// Install - cache only static assets
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - remove ALL old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating...`);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.map((name) => {
          // Delete ALL caches except current static cache
          if (name !== STATIC_CACHE_NAME) {
            console.log(`[SW ${SW_VERSION}] Deleting old cache:`, name);
            return caches.delete(name);
          }
        })
      )
    ).then(() => {
      console.log(`[SW ${SW_VERSION}] Now controlling all clients`);
      return self.clients.claim();
    })
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1️⃣ NAVIGATION REQUESTS: NEVER INTERCEPT
  // Let browser handle directly - no cache, no offline page
  if (request.mode === 'navigate') {
    // Do NOT call event.respondWith() - browser handles natively
    return;
  }

  // Skip non-GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip API/backend requests
  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/rest/') ||
      url.pathname.startsWith('/functions/') ||
      url.pathname.startsWith('/@vite') ||
      url.pathname.startsWith('/src/') ||
      url.pathname.startsWith('/node_modules/')) {
    return;
  }

  // Skip HTML files entirely
  if (url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.')) {
    return;
  }

  // Only cache-first for static assets (images, fonts)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStatic(request));
  }
  // Everything else: network only (no interception)
});

function isStaticAsset(pathname) {
  return (
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

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return empty response for failed static assets
    return new Response('', { status: 404 });
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log(`[SW ${SW_VERSION}] Push received`);

  let data = {
    title: 'PlagaiScans',
    body: 'You have a new notification',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    tag: null,
    data: {},
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  // Use unique tag from payload, or generate one to prevent notifications replacing each other
  const notificationTag = data.tag || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  console.log(`[SW ${SW_VERSION}] Showing notification with tag: ${notificationTag}`);

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/pwa-icon-192.png',
      badge: data.badge || '/pwa-icon-192.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'close', title: 'Dismiss' },
      ],
      requireInteraction: false,
      tag: notificationTag,
      renotify: true,
    })
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
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
      return clients.openWindow(event.notification.data?.url || '/dashboard');
    })
  );
});

console.log(`[SW ${SW_VERSION}] Loaded`);
