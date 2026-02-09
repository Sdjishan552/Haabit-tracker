// service-worker.js
const CACHE_NAME = 'discipline-tracker-v2'; // Bump version to force update

// Detect base path dynamically (for GitHub Pages project sites like /repo/)
const BASE_PATH = self.location.pathname.replace('/service-worker.js', '');

const STATIC_ASSETS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/admin.html',
  BASE_PATH + '/stats.html',
  BASE_PATH + '/history.html',
  BASE_PATH + '/style.css',
  BASE_PATH + '/app.js',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/assets/icon-192.png',
  BASE_PATH + '/assets/icon-512.png'
  // Add more if needed, e.g., BASE_PATH + '/assets/beep.ogg' if you host the sound locally
];

// Install event - cache core app files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.error('Caching failed:', err))
  );

  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );

  // Take control of the page immediately
  self.clients.claim();
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET or external/cross-origin requests
  if (event.request.method !== 'GET' || !url.href.startsWith(self.location.origin)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Normalize request path to include BASE_PATH if needed
  let requestPath = url.pathname;
  if (BASE_PATH && !requestPath.startsWith(BASE_PATH)) {
    requestPath = BASE_PATH + requestPath;
  }

  const normalizedRequest = new Request(requestPath);

  event.respondWith(
    caches.match(normalizedRequest)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(normalizedRequest, responseToCache);
            });

          return networkResponse;
        });
      })
      .catch(() => {
        // Fallback: You can add an offline.html later
        console.error('Fetch failed, offline');
      })
  );
});

// Optional: Background sync (unchanged)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-logs') {
    event.waitUntil(syncLogs());
  }
});

async function syncLogs() {
  console.log('Background sync: logs would be sent here');
}