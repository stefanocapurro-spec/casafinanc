/* CasaFinance — Service Worker v15
   Cache-first per CDN e font, network-first per l'app stessa.
   Necessario per: installazione PWA su Chrome/Edge, offline support. */

const CACHE_NAME = 'casafinance-v15';

const PRECACHE = [
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&family=Lato:wght@300;400;700&display=swap'
];

// ── INSTALL: pre-carica le dipendenze CDN ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {
        // Se il pre-cache fallisce (offline), continua comunque
        return Promise.resolve();
      }))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: rimuovi cache vecchie ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: strategia per tipo di risorsa ─────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Salta richieste non-GET e richieste Supabase (sempre network)
  if (event.request.method !== 'GET') return;
  if (url.includes('supabase.co')) return;

  // CDN e font: cache-first
  if (url.includes('cdn.jsdelivr.net') ||
      url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // App HTML (index.html): network-first, fallback cache
  if (url.includes('.html') || url.endsWith('/') || url === self.location.origin + '/casafinance/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // manifest.json e sw.js: network-first
  if (url.includes('manifest.json') || url.includes('sw.js')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
