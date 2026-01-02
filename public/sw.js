// Service Worker for Malleabite PWA
// Implements offline-first caching strategy

const CACHE_VERSION = 'v1.0.1'; // Bumped to force cache refresh for drag fix
const STATIC_CACHE = `malleabite-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `malleabite-dynamic-${CACHE_VERSION}`;
const API_CACHE = `malleabite-api-${CACHE_VERSION}`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // Add other critical assets here
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old versions
              return name.startsWith('malleabite-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API requests - Network-first strategy
  if (url.pathname.startsWith('/api/') || url.hostname.includes('firebase')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Static assets - Cache-first strategy
  event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
});

// Cache-first strategy for static assets
async function cacheFirstStrategy(request, cacheName) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }

    // If not in cache, fetch from network
    console.log('[SW] Fetching from network:', request.url);
    const networkResponse = await fetch(request);

    // Cache the new response
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first strategy failed:', error);
    
    // Return offline page or fallback
    return new Response('Offline - content not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain',
      }),
    });
  }
}

// Network-first strategy for API calls
async function networkFirstStrategy(request, cacheName) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    // Fall back to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return error response
    return new Response(JSON.stringify({ error: 'Offline - data not available' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });
  }
}

// Background sync for offline event creation
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-events') {
    event.waitUntil(syncOfflineEvents());
  }
});

async function syncOfflineEvents() {
  try {
    // Get pending events from IndexedDB
    const db = await openDatabase();
    const pendingEvents = await getPendingEvents(db);

    console.log('[SW] Syncing', pendingEvents.length, 'offline events');

    // Send each event to the server
    for (const event of pendingEvents) {
      try {
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        if (response.ok) {
          // Remove from pending queue
          await deletePendingEvent(db, event.id);
          console.log('[SW] Synced event:', event.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync event:', event.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// IndexedDB helpers for offline event queue
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MalleabiteOffline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingEvents')) {
        db.createObjectStore('pendingEvents', { keyPath: 'id' });
      }
    };
  });
}

function getPendingEvents(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingEvents'], 'readonly');
    const store = transaction.objectStore('pendingEvents');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deletePendingEvent(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingEvents'], 'readwrite');
    const store = transaction.objectStore('pendingEvents');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Push notification support
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Malleabite';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

console.log('[SW] Service worker script loaded');
