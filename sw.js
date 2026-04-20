const CACHE_NAME = 'auooshadh-cache-v3'; 
const urlsToCache = []; // We will not cache anything right now during active development

self.addEventListener('install', event => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Tell the active service worker to take control of the page immediately
  event.waitUntil(self.clients.claim());
  
  // Clear EVERY OLD CACHE
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// PASS-THROUGH ONLY (Pure network, no offline caching for development)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("Offline mode is disabled during development.");
    })
  );
});
