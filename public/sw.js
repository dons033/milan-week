// Service worker for CalendarApp (Esma). Strategy:
//   - App shell (navigation / Next static assets) : network-first, cache fallback
//   - Supabase GET /rest/v1/events                : network-first, cache fallback
//   - OSM tiles                                   : cache-first, size-capped
//   - Everything else                             : pass through

const VERSION = 'cal-v3';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const TILE_CACHE = `${VERSION}-tiles`;
const TILE_CACHE_MAX = 400;

const PRECACHE_URLS = ['/', '/map', '/icon.png', '/apple-icon.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) {
    cache.put(req, res.clone());
    if (maxEntries) trimCache(cacheName, maxEntries);
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // OSM tiles
  if (/tile\.openstreetmap\.org/.test(url.hostname)) {
    event.respondWith(cacheFirst(req, TILE_CACHE, TILE_CACHE_MAX));
    return;
  }

  // Supabase REST reads
  if (/\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith('/rest/')) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // Same-origin navigation + app shell
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
