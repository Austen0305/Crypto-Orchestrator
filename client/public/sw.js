/* eslint-disable no-restricted-globals */
// Service Worker for CryptoOrchestrator
// Provides offline support and caching

const CACHE_NAME = 'crypto-orchestrator-v1';
const STATIC_CACHE = 'crypto-orchestrator-static-v1';
const DYNAMIC_CACHE = 'crypto-orchestrator-dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all pages
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests (API calls, WebSocket)
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api')) {
    return;
  }

  // Cache strategy: Cache First for static assets, Network First for API
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'image') {
    // Cache First for static assets
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // Don't cache if not successful
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
    );
  } else if (url.pathname.startsWith('/api')) {
    // Network First for API calls
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response
          const responseToCache = response.clone();

          // Cache successful GET requests
          if (request.method === 'GET' && response.status === 200) {
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }

          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Return offline page if available
            return caches.match('/offline.html');
          });
        })
    );
  } else {
    // Network First for HTML pages
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return index.html for SPA routing
            return caches.match('/index.html');
          });
        })
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-trades') {
    event.waitUntil(
      // Sync pending trades when online
      syncPendingTrades()
    );
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  const options = {
    body: event.data?.text() || 'New update available',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    tag: 'crypto-orchestrator-notification',
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification('CryptoOrchestrator', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Helper function to sync pending trades
async function syncPendingTrades() {
  try {
    // Get pending trades from IndexedDB
    const pendingTrades = await getPendingTrades();
    
    // Sync each trade
    for (const trade of pendingTrades) {
      try {
        await fetch('/api/trades', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(trade),
        });
        
        // Remove from pending trades
        await removePendingTrade(trade.id);
      } catch (error) {
        console.error('[Service Worker] Failed to sync trade:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Failed to sync trades:', error);
  }
}

// Helper functions for IndexedDB (simplified)
async function getPendingTrades() {
  // In production, use IndexedDB to store pending trades
  return [];
}

async function removePendingTrade(id: string) {
  // In production, remove from IndexedDB
  console.log('[Service Worker] Removing pending trade:', id);
}
