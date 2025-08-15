// service-worker.js
const CACHE = 'repregret-v8'; // <-- nieuw versienummer

const BASE = new URL('.', self.location).href; // eindigt op .../Rep-Regret/
const abs = (p) => new URL(p, BASE).toString();

const APP_SHELL = [
  abs('./'),
  abs('index.html'),
  abs('manifest.webmanifest'),
];

// Installeer nieuwe SW en sla direct de wachtfase over
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Verwijder oude caches en claim meteen controle over clients
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (request.method === 'GET') {
            const copy = networkResponse.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cached || caches.match(abs('index.html')));
      return cached || fetchPromise;
    })
  );
});