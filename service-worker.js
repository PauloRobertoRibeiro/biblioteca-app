const CACHE_NAME = "biblioteca-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://unpkg.com/html5-qrcode"   // lib externa
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(resp =>
      resp ||
      fetch(e.request).then(fetchResp => {
        // opcional: salva novos assets em cache
        const clone = fetchResp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return fetchResp;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
