const CACHE_NAME = 'biblioteca-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Adicionar aqui o arquivo de fallback caso não tenha conexão
  '/offline.html'
];

// Instala o service worker e armazena arquivos no cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Arquivos armazenados no cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Ativa o service worker e remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
});

// Intercepta as requisições e serve do cache ou da rede
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Serve do cache se encontrado
        if (response) {
          return response;
        }

        // Caso não encontrado no cache, tenta buscar na rede
        return fetch(event.request).catch(() => {
          // Se a rede falhar, serve o arquivo de fallback
          return caches.match('/offline.html');
        });
      })
  );
});
