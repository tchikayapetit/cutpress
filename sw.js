/* Service worker: makes the app work offline after the first visit.
   - Pages (HTML) are fetched from the network first, so updates show right away,
     with the saved copy used when offline or when the network is slow.
   - Scripts and styles carry a ?v= number, so each exact URL is saved once and never mixed
     with another version.
   - Sounds, icons, fonts, stock photos and scans are saved the first time they load. */
const VERSION = 'v15';
const CORE = `core-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const PAGES = ['index.html', 'how.html'];
const EXTRA = ['./', 'manifest.webmanifest', 'js/vendor/mp4-muxer.min.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'sounds/manifest.json'];
const MAX_RUNTIME = 140;
const SLOW_MS = 3500;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE);
    const urls = new Set(EXTRA);
    for (const page of PAGES) {
      try {
        const res = await fetch(page, { cache: 'reload' });
        const html = await res.clone().text();
        await c.put(page, res);
        for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
          const u = m[1];
          if (!/^(https?:|data:|mailto:)/.test(u) && !u.endsWith('.html')) urls.add(u);
        }
      } catch (err) { /* offline install: pages are saved on first visit */ }
    }
    try {
      const list = await (await fetch('sounds/manifest.json')).json();
      list.forEach((m) => urls.add(m.file));
    } catch (err) { /* no recorded sounds */ }
    await Promise.all([...urls].map((u) => c.add(u).catch(() => null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![CORE, RUNTIME].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_RUNTIME; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const known = same || /fonts\.(googleapis|gstatic)\.com|images\.unsplash\.com|wikimedia\.org|cdn\.jsdelivr\.net/.test(url.hostname);
  if (!known) return;
  const isPage = same && (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/'));
  const apiFirst = /commons\.wikimedia\.org$/.test(url.hostname);

  e.respondWith((async () => {
    const cache = await caches.open(same ? CORE : RUNTIME);
    const store = async (res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        const key = isPage ? url.pathname.replace(/\/$/, '/index.html').replace(/^\//, '') || 'index.html' : req;
        cache.put(key, copy).then(() => (same ? null : trim(cache))).catch(() => {});
      }
      return res;
    };
    const saved = () => cache.match(isPage ? url.pathname.replace(/\/$/, '/index.html').replace(/^\//, '') || 'index.html' : req);

    if (isPage || apiFirst) {
      // network first, saved copy when offline or slow
      const net = fetch(req).then(store);
      try {
        return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), SLOW_MS))]);
      } catch (err) {
        const hit = await saved();
        if (hit) { net.catch(() => {}); return hit; }
        return net;
      }
    }
    // exact URL (including ?v=) is saved once; unversioned files refresh in the background
    const hit = await cache.match(req);
    if (hit) {
      if (!url.search) fetch(req).then(store).catch(() => {});
      return hit;
    }
    try { return await fetch(req).then(store); } catch (err) {
      if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
      throw err;
    }
  })());
});
