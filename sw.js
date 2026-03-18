/* ============================================
   CLUBE DO NATURAL — Service Worker
   Cache-first para assets, offline support para POS
   ============================================ */

const CACHE_NAME = 'cdn-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/catalogo.html',
  '/checkout.html',
  '/pedido.html',
  '/admin/index.html',
  '/admin/pedidos.html',
  '/admin/estoque.html',
  '/admin/caixa.html',
  '/admin/nf.html',
  '/admin/funcionarios.html',
  '/admin/produtos.html',
  '/admin/lojas.html',
  '/admin/clientes.html',
  '/admin/relatorios.html',
  '/admin/assinaturas.html',
  '/admin/config.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/landing.css',
  '/css/catalogo.css',
  '/css/checkout.css',
  '/css/admin.css',
  '/css/dashboard.css',
  '/css/forms.css',
  '/css/tables.css',
  '/js/core/state.js',
  '/js/core/storage.js',
  '/js/core/utils.js',
  '/js/core/auth.js',
  '/js/core/router.js',
  '/js/data/products.js',
  '/js/data/stores.js',
  '/js/data/categories.js',
  '/js/data/employees.js',
  '/js/components/toast.js',
  '/js/app.js',
  '/manifest.json',
];

// Install — cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Cache what we can, skip failures
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url).catch(() => null))
        );
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Cache-first for static, network-first for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // API calls — network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets — cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Background sync for offline POS operations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOfflineOrders());
  }
  if (event.tag === 'sync-caixa') {
    event.waitUntil(syncOfflineCaixa());
  }
  if (event.tag === 'sync-estoque') {
    event.waitUntil(syncOfflineEstoque());
  }
});

async function syncOfflineOrders() {
  // Future: send queued orders to server
  // For now, data stays in localStorage/IndexedDB
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE', entity: 'orders' });
  });
}

async function syncOfflineCaixa() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE', entity: 'caixa' });
  });
}

async function syncOfflineEstoque() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE', entity: 'estoque' });
  });
}
