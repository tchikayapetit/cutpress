/* Service worker: makes the app work offline after the first visit.
   - The app files, sounds and icons are saved at install.
   - Fonts, stock photos, old newspaper scans and the video library are saved the first time they load.
   - Files are served from the cache first and refreshed in the background. */
const VERSION = 'v4';
const CORE = `core-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const SHELL = [
  './', 'index.html', 'how.html', 'manifest.webmanifest',
  'css/app.css', 'css/how.css',
  'js/i18n.js', 'js/util.js', 'js/corpus.js', 'js/audio.js', 'js/stock.js', 'js/paper.js', 'js/templates.js', 'js/recorder.js',
  'js/fastexport.js', 'js/store.js', 'js/sounds.js', 'js/matchcut.js', 'js/app.js',
  'js/vendor/mp4-muxer.min.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  'sounds/manifest.json',
];
const MAX_RUNTIME = 140;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE);
    await Promise.all(SHELL.map((u) => c.add(u).catch(() => null)));
    try {
      const list = await (await fetch('sounds/manifest.json')).json();
      await Promise.all(list.map((m) => c.add(m.file).catch(() => null)));
    } catch (err) { /* no recorded sounds */ }
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
  // Wikimedia API lists scans: always try the network first, fall back to the last answer.
  const apiFirst = /commons\.wikimedia\.org$/.test(url.hostname);
  e.respondWith((async () => {
    const cache = await caches.open(same ? CORE : RUNTIME);
    const hit = await cache.match(req, { ignoreSearch: same });
    const fetchAndStore = async () => {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        // replace older copies of the same file (same path, other ?v= number)
        (same ? cache.delete(req, { ignoreSearch: true }) : Promise.resolve())
          .then(() => cache.put(req, copy))
          .then(() => (same ? null : trim(cache)))
          .catch(() => {});
      }
      return res;
    };
    if (apiFirst) {
      try { return await fetchAndStore(); } catch (err) { if (hit) return hit; throw err; }
    }
    if (hit) { fetchAndStore().catch(() => {}); return hit; }
    try { return await fetchAndStore(); } catch (err) {
      if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
      throw err;
    }
  })());
});
