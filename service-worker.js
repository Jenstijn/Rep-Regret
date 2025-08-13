const CACHE = 'repregret-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null))))
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(networkResponse => {
        // Cache GET requests for future offline use
        if (request.method === 'GET') {
          const copy = networkResponse.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return networkResponse;
      }).catch(() => cached || caches.match('/'));
      return cached || fetchPromise;
    })
  );
});
