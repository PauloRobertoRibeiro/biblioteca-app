self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('biblioteca-cache').then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './manifest.json',
        './icon-192.png',
        './icon-512.png',
        './seu-arquivo-css.css',
        './seu-arquivo-js.js'
        // adicione outros arquivos necessários
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
