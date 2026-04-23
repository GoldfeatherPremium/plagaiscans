// Service Worker for Push Notifications ONLY
// Version 7 - Adds pushsubscriptionchange handler for endpoint rotation
// Navigation requests are NEVER intercepted; offline page is NEVER served

const SW_VERSION = 'v7';
const STATIC_CACHE_NAME = `plagaiscans-static-${SW_VERSION}`;

// Cache static assets and key JS/CSS bundles
const STATIC_ASSETS = [
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/favicon.png',
];

// Supabase project ref for calling edge functions from the SW
const SUPABASE_PROJECT_REF = 'fyssbzgmhnolazjfwafm';
const RESUBSCRIBE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/push-resubscribe`;
const VAPID_KEY_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/get-vapid-public-key`;

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
  if (request.mode === 'navigate') {
    return;
  }

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/rest/') ||
      url.pathname.startsWith('/functions/') ||
      url.pathname.startsWith('/@vite') ||
      url.pathname.startsWith('/src/') ||
      url.pathname.startsWith('/node_modules/')) {
    return;
  }

  if (url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.')) {
    return;
  }

  if (isStaticAsset(url.pathname) || isBundleAsset(url.pathname)) {
    event.respondWith(cacheFirstStatic(request));
  }
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

function isBundleAsset(pathname) {
  return (
    pathname.startsWith('/assets/') && (
      pathname.endsWith('.js') ||
      pathname.endsWith('.css')
    )
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

  const notificationTag = data.tag || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  console.log(`[SW ${SW_VERSION}] Showing notification with tag: ${notificationTag}`);

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/pwa-icon-192.png',
      badge: data.badge || '/pwa-icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      data: data.data || {},
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'close', title: 'Dismiss' },
      ],
      requireInteraction: true,
      tag: notificationTag,
      renotify: true,
      silent: false,
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

// ─────────────────────────────────────────────────────────────────
// pushsubscriptionchange — re-subscribe when the browser rotates
// the endpoint (common on Chrome Android, FCM key rotations, etc.)
// ─────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function fetchVapidKey() {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedRes = await cache.match(VAPID_KEY_URL);
  if (cachedRes) {
    try {
      const json = await cachedRes.clone().json();
      if (json?.vapidPublicKey) return json.vapidPublicKey;
    } catch {
      // fall through to refetch
    }
  }
  const res = await fetch(VAPID_KEY_URL);
  if (!res.ok) throw new Error(`VAPID key fetch failed: ${res.status}`);
  // Cache for next rotation event
  cache.put(VAPID_KEY_URL, res.clone()).catch(() => {});
  const json = await res.json();
  if (!json?.vapidPublicKey) throw new Error('VAPID key missing in response');
  return json.vapidPublicKey;
}

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log(`[SW ${SW_VERSION}] pushsubscriptionchange fired`);

  event.waitUntil(
    (async () => {
      try {
        const oldEndpoint = event.oldSubscription?.endpoint || null;
        const vapidKey = await fetchVapidKey();

        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        const subJson = newSub.toJSON();

        await fetch(RESUBSCRIBE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint,
            newSubscription: {
              endpoint: newSub.endpoint,
              keys: subJson.keys || {},
            },
            userAgent: self.navigator?.userAgent ?? null,
            platform: null,
          }),
        });

        console.log(`[SW ${SW_VERSION}] Re-subscribed and notified backend`);
      } catch (err) {
        console.error(`[SW ${SW_VERSION}] pushsubscriptionchange failed:`, err);
      }
    })()
  );
});

console.log(`[SW ${SW_VERSION}] Loaded`);
