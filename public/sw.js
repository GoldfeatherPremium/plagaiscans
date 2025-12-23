// Service Worker for Push Notifications and Offline Support
// Version 3 - Fixed false offline on pull-to-refresh + avoid caching dev server assets

const CACHE_NAME = 'plagaiscans-v3';
const STATIC_CACHE_NAME = 'plagaiscans-static-v3';

// Static assets to cache (cache-first strategy)
const STATIC_ASSETS = [
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/favicon.png',
  '/offline.html',
];

// Install event - cache static assets and offline page
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v3...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
    ])
  );
  // Force immediate activation
  self.skipWaiting();
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v3...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Now controlling all clients');
      return self.clients.claim();
    })
  );
});

// Helper: Check if request is for static asset
function isStaticAsset(url) {
  const pathname = new URL(url).pathname;
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

// Helper: Check if request is an API call / should bypass SW
function isApiRequest(url) {
  const { pathname, origin } = new URL(url);

  // Bypass any dev-server / HMR assets to avoid caching issues ("server connection lost")
  if (pathname.startsWith('/@vite') || pathname.startsWith('/src/')) return true;

  // Our backend/api paths
  if (pathname.startsWith('/api/') || pathname.startsWith('/rest/') || pathname.startsWith('/functions/')) return true;

  // External backends
  if (!url.startsWith(origin)) return true;
  if (url.includes('supabase.co')) return true;

  return false;
}

// Fetch event - Network-first for navigation, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests - let them go directly to network
  if (isApiRequest(url)) {
    return;
  }

  // Handle navigation requests (page loads, pull-to-refresh) - NETWORK FIRST
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static assets - CACHE FIRST with network fallback
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Default: Network first with cache fallback
  event.respondWith(handleDefaultRequest(request));
});

// Network-first strategy for navigation (critical for pull-to-refresh)
async function handleNavigationRequest(request) {
  // Force a real network revalidation on refresh/navigation
  const networkRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    mode: request.mode,
    credentials: request.credentials,
    redirect: request.redirect,
    // Chrome respects this for navigation-style fetches
    cache: 'reload',
  });

  try {
    // Always try network first for navigation
    const networkResponse = await fetch(networkRequest);

    // Cache successful responses for offline fallback
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[SW] Navigation fetch failed, trying cache:', message);

    // Network failed - try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Returning cached navigation response');
      return cachedResponse;
    }

    // IMPORTANT: only show offline page when the device is actually offline.
    // This prevents false offline screens during flaky pull-to-refresh.
    const isOffline = self.navigator && self.navigator.onLine === false;
    if (isOffline) {
      console.log('[SW] Device offline, returning offline page');
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) return offlineResponse;
    }

    // If we're "online" but the fetch failed, return a proper error response (not offline page)
    // so the browser can retry normally.
    return new Response('Network error. Please try again.', {
      status: 504,
      statusText: 'Gateway Timeout',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Cache-first strategy for static assets
async function handleStaticAsset(request) {
  try {
    // Check cache first for static assets
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Return cached version immediately, but update cache in background
      fetchAndCache(request);
      return cachedResponse;
    }
    
    // Not in cache - fetch from network
    return await fetchAndCache(request);
  } catch (error) {
    console.log('[SW] Static asset fetch failed:', error.message);
    // Return empty response for failed static assets
    return new Response('', { status: 404 });
  }
}

// Helper to fetch and cache
async function fetchAndCache(request) {
  const response = await fetch(request);
  
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    cache.put(request, response.clone());
  }
  
  return response;
}

// Default network-first handler
async function handleDefaultRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
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

  console.log('[SW] Showing notification:', data);

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

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Focus or open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          // Navigate to specific page if data contains url
          if (event.notification.data?.url) {
            client.navigate(event.notification.data.url);
          }
          return;
        }
      }
      // Open new window if none exists
      const url = event.notification.data?.url || '/dashboard';
      return clients.openWindow(url);
    })
  );
});

// Push subscription change event
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.applicationServerKey,
    }).then((subscription) => {
      // Re-sync subscription with server
      return fetch('/api/update-push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
    })
  );
});

console.log('[SW] Service worker v2 loaded');
