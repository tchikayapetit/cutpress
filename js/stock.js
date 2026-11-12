/* Free stock photos (Unsplash License: free for commercial use, no attribution required)
   used as filler pictures on the printed pages. Only places, food, buildings and objects,
   never people. Loaded from Unsplash's CDN in the viewer's browser; if they cannot load,
   pages simply use generated pictures instead. */
(function () {
  const IDS = [
    'photo-1449824913935-59a10b8d2000', 'photo-1617121346253-43ef95179ac9', 'photo-1546636889-ba9fdd63583e', 'photo-1513682121497-80211f36a7d3',
    'photo-1543872084-c7bd3822856f', 'photo-1486406146926-c627a92ad1ab', 'photo-1488972685288-c3fd157d7c7a', 'photo-1479839672679-a46483c0e7c8',
    'photo-1527576539890-dfa815648363', 'photo-1493397212122-2b85dda8106b', 'photo-1546069901-ba9599a7e63c', 'photo-1565299624946-b28f40a0ae38',
    'photo-1482049016688-2d3e1b311543', 'photo-1522778119026-d647f0596c20', 'photo-1489944440615-453fc2b6a9a9', 'photo-1579952363873-27f3bade9f55',
    'photo-1546608235-3310a2494cdf', 'photo-1599158150601-1417ebbaafdd', 'photo-1509042239860-f550ce710b93', 'photo-1447933601403-0c6688de566e',
    'photo-1541167760496-1628856ab772', 'photo-1506744038136-46273834b3fb', 'photo-1501785888041-af3ef285b470', 'photo-1470071459604-3b5ec3a7fe05',
    'photo-1511884642898-4c92249e20b6', 'photo-1506260408121-e353d10b87c7', 'photo-1497366811353-6870744d04b2', 'photo-1497215728101-856f4ea42174',
    'photo-1568992687947-868a62a9f521', 'photo-1497366754035-f200968a6e72', 'photo-1550989460-0adf9ea622e2', 'photo-1542838132-92c53300491e',
  ];
  const STOCK = (window.STOCK = { imgs: [], ready: false });

  // Generated fallback pictures (skyline, hills, still life) in case the CDN is unreachable.
  function fallback(i) {
    const c = U.makeCanvas(640, 440), g = c.getContext('2d');
    const r = U.rng(i * 977 + 3);
    const sky = g.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, `hsl(${200 + r() * 30},45%,${55 + r() * 15}%)`);
    sky.addColorStop(1, `hsl(${25 + r() * 20},55%,${65 + r() * 10}%)`);
    g.fillStyle = sky;
    g.fillRect(0, 0, 640, 440);
    if (i % 2) {
      for (let x = 0; x < 640; ) {
        const w = 40 + r() * 70, h = 120 + r() * 220;
        g.fillStyle = `hsl(210,12%,${18 + r() * 18}%)`;
        g.fillRect(x, 440 - h, w, h);
        g.fillStyle = 'rgba(255,230,160,0.55)';
        for (let y = 440 - h + 10; y < 430; y += 18) for (let xx = x + 6; xx < x + w - 8; xx += 14) if (r() < 0.4) g.fillRect(xx, y, 6, 9);
        x += w + 3;
      }
    } else {
      for (let k = 0; k < 3; k++) {
        g.fillStyle = `hsl(${90 + k * 20},${25 + k * 10}%,${40 - k * 9}%)`;
        g.beginPath();
        g.moveTo(0, 440);
        for (let x = 0; x <= 640; x += 32) g.lineTo(x, 250 + k * 50 + Math.sin(x / (80 + k * 30) + r() * 6) * 40);
        g.lineTo(640, 440);
        g.fill();
      }
    }
    return c;
  }

  STOCK.load = () => {
    STOCK.loadScans();
    STOCK.imgs = IDS.map((_, i) => fallback(i));
    let left = IDS.length;
    const done = () => { if (--left === 0) { STOCK.ready = true; if (STOCK.onready) STOCK.onready(); } };
    IDS.forEach((id, i) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => { STOCK.imgs[i] = img; done(); };
      img.onerror = done;
      img.src = `https://images.unsplash.com/${id}?w=720&q=70&auto=format&fit=crop`;
    });
  };
  // Real scanned front pages from 1900-1960, public domain, listed live from Wikimedia Commons.
  STOCK.scans = [];
  STOCK.loadScans = async () => {
    try {
      const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=categorymembers' +
        '&gcmtitle=Category:Front_pages_of_newspapers_of_the_United_States&gcmtype=file&gcmlimit=80&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1100';
      const j = await (await fetch(u)).json();
      const list = Object.values((j.query && j.query.pages) || {})
        .filter((p) => p.imageinfo && /\.(jpe?g|png|webp)$/i.test(p.title))
        .map((p) => p.imageinfo[0])
        .filter((i) => i.height > i.width * 1.15 && /public domain|^PD/i.test(((i.extmetadata || {}).LicenseShortName || {}).value || ''))
        .slice(0, 24);
      list.forEach((i) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          STOCK.scans.push(img);
          clearTimeout(STOCK._scanT);
          STOCK._scanT = setTimeout(() => STOCK.onready && STOCK.onready(), 1200);
        };
        img.src = i.thumburl;
      });
    } catch (e) { /* offline: generated papers are used instead */ }
  };
  STOCK.scan = (n) => (STOCK.scans.length ? STOCK.scans[Math.abs(Math.floor(n)) % STOCK.scans.length] : null);
  STOCK.get = (n) => STOCK.imgs[Math.abs(Math.floor(n)) % STOCK.imgs.length];
})();
