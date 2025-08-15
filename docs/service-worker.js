//public/service-worker.js
const CACHE = 'repregret-v12'; // bump versie

const BASE = new URL('.', self.location).href;
const abs = (p) => new URL(p, BASE).toString();

const APP_SHELL = [abs('./'), abs('index.html'), abs('manifest.webmanifest')];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((resp) => {
          if (request.method === 'GET') {
            const copy = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return resp;
        })
        .catch(() => cached || caches.match(abs('index.html')));
      return cached || fetchPromise;
    })
  );
});