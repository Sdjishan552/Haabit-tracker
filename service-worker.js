const CACHE_NAME = "discipline-tracker-v9";  // ← bump to v7 (or higher)

self.addEventListener('install', event => {
  self.skipWaiting();  // Force immediate activation
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches
      caches.keys().then(keys => {
        return Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      }),
      // Take control of all open pages/tabs immediately
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  // Simple network-first + fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Optional: Force update check on every load (helps stubborn phones)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

