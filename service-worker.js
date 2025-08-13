//service-worker.js
const CACHE = 'repregret-v6'
const BASE = new URL('.', self.location).href  // eindigt op .../Rep-Regret/

function abs(path) { return new URL(path, BASE).toString() }

const APP_SHELL = [
  abs('./'),
  abs('index.html'),
  abs('manifest.webmanifest'),
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null))))
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(networkResponse => {
        if (request.method === 'GET') {
          const copy = networkResponse.clone()
          caches.open(CACHE).then(cache => cache.put(request, copy))
        }
        return networkResponse
      }).catch(() => cached || caches.match(abs('index.html')))
      return cached || fetchPromise
    })
  )
})