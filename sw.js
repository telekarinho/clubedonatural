/* ============================================
   CLUBE DO NATURAL — Service Worker (PWA)
   Cache-first for static assets
   Network-first for API calls
   Offline fallback page
   ============================================ */

const CACHE_VERSION = 'cdn-v2';
const OFFLINE_PAGE = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/catalogo.html',
  '/checkout.html',
  '/pedido.html',
  '/offline.html',
  '/manifest.json',

  // CSS
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/landing.css',
  '/css/catalogo.css',
  '/css/checkout.css',

  // JS — core
  '/js/core/storage.js',
  '/js/core/state.js',
  '/js/core/utils.js',
  '/js/core/auth.js',
  '/js/core/router.js',

  // JS — data
  '/js/data/products.js',
  '/js/data/categories.js',
  '/js/data/stores.js',
  '/js/data/employees.js',

  // JS — components & pages
  '/js/components/toast.js',
  '/js/catalogo/product-card.js',
  '/js/catalogo/product-detail.js',
  '/js/catalogo/cart.js',
  '/js/catalogo/search.js',
  '/js/catalogo/filters.js',
  '/js/pages/landing.js',
  '/js/pages/catalogo.js',
  '/js/app.js',

  // Images
  '/img/logo-full.png',
  '/img/logo-icon.svg',
  '/img/logo-icon.png',
  '/img/logo-icon-white.svg',
  '/img/logo.svg',

  // Admin
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
  '/css/admin.css',
  '/css/dashboard.css',
  '/css/forms.css',
  '/css/tables.css',
];

// ── Install: pre-cache critical assets ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Use allSettled so one missing file doesn't block the entire install
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => {
          console.warn('[SW] Failed to cache:', url);
        }))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: purge old cache versions ──────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ──────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, etc.)
  if (request.method !== 'GET') return;

  // Skip cross-origin requests except Google Fonts
  if (url.origin !== self.location.origin &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  // ─── API calls: Network-first, cache fallback ───
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ─── Static assets: Cache-first, network fallback ───
  event.respondWith(cacheFirst(request));
});

/**
 * Cache-first strategy.
 * Returns cached response if available; otherwise fetches from network,
 * caches the response, and returns it. Falls back to offline page for
 * navigation requests.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline fallback for HTML navigation requests
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlinePage = await caches.match(OFFLINE_PAGE);
      if (offlinePage) return offlinePage;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-first strategy.
 * Tries network; on success caches the response. On failure returns
 * cached version if available.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── Background Sync for offline POS operations ──────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(notifyClients('orders'));
  }
  if (event.tag === 'sync-caixa') {
    event.waitUntil(notifyClients('caixa'));
  }
  if (event.tag === 'sync-estoque') {
    event.waitUntil(notifyClients('estoque'));
  }
});

async function notifyClients(entity) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE', entity });
  });
}

// ── Message handler: skip waiting on demand ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
