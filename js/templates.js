/* 34 realistic frames (newspapers, magazines, web pages, posters, desk scenes) plus a camera
   that films each page from a different angle, zoom and position, with perspective tilt,
   a surface underneath, shadows and depth of field. All brand names are invented. */
(function () {
  const { rng, pick, rand } = U;
  const C = window.CORPUS;
  const PP = window.PAPER;
  const font = PP.font;

  const F = {
    serif: ['Source Serif 4', 400], play: ['Playfair Display', 700], old: ['Old Standard TT', 700], oldR: ['Old Standard TT', 400],
    frank: ['Libre Franklin', 400], frankB: ['Libre Franklin', 800], anton: ['Anton', 400], bodoni: ['Bodoni Moda', 700], bodoniB: ['Bodoni Moda', 900],
    news: ['Newsreader', 400], newsB: ['Newsreader', 600], pt: ['PT Serif', 400], ptB: ['PT Serif', 700], gara: ['EB Garamond', 500],
    plex: ['IBM Plex Sans', 400], inter: ['Inter', 400], interB: ['Inter', 800], interM: ['Inter', 600], black: ['UnifrakturMaguntia', 400],
    rye: ['Rye', 400], marker: ['Permanent Marker', 400], mono: ['Courier Prime', 400],
  };
  const pub = (body, o = {}) => Object.assign({ body, head: body, ink: '#1d1c1a', lh: 1.32, corpus: 'news', justify: true, photo: 'halftone', kick: F.frankB }, o);

  // ---------- drawing helpers ----------
  function paperBg(g, w, h, color, r, aged = 0) {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const x = rand(r, 0, w), y = rand(r, 0, h), rad = rand(r, 0.1, 0.5) * Math.max(w, h);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(110,80,40,${0.02 + aged * 0.05})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.05 + aged * 0.06;
    g.fillStyle = g.createPattern(U.grainTile(), 'repeat');
    g.fillRect(0, 0, w, h);
    g.restore();
    if (aged) U.vignette(g, w, h, 0.25 * aged, '90,55,15');
  }
  const tokens = (d, upper) =>
    d.mode === 'word' ? PP.phraseTokens('{X}', d.parts, upper) : PP.words(d.headline || 'Your headline here').map((t) => ({ t: upper ? t.toUpperCase() : t }));

  // Headline with the focus word highlighted. Returns height and the focus word's rectangle.
  function head(g, d, spec, size, x, y, w, o = {}) {
    const { upper = false, color = '#141414', align = 'left', lh = 1.06, style = '', maxLines = 4, stroke = null } = o;
    let s = size, lay;
    const toks = tokens(d, upper);
    for (let i = 0; i < 24; i++) {
      g.font = font(spec, s, style);
      lay = PP.flow(g, toks.map((t) => Object.assign({}, t)), w);
      if (lay.lines.length <= maxLines && lay.lines.every((l) => l.toks.reduce((a, t) => a + t.w, 0) <= w * 1.02)) break;
      s *= 0.9;
    }
    g.font = font(spec, s, style);
    const L = s * lh;
    let focus = null;
    lay.lines.forEach((ln, i) => {
      const xs = PP.lineXs(ln, w, lay.sp, false, align);
      ln.toks.forEach((tk, j) => {
        const yy = y + i * L + L / 2, xx = x + xs[j];
        const preW = tk.pre ? PP.measure(g, tk.pre) : 0, ww = PP.measure(g, tk.t);
        if (tk.f) {
          PP.highlight(g, d.o.hlKind, d.o.hlColor, xx + preW, yy, ww, s, d.r);
          focus = { x: xx + preW, y: yy - s * 0.55, w: ww, h: s * 1.1 };
          g.font = font(spec, s, style);
        }
        const txt = (tk.pre || '') + tk.t + (tk.suf || '');
        if (stroke) { g.lineJoin = 'round'; g.lineWidth = s * 0.12; g.strokeStyle = stroke; g.strokeText(txt, xx, yy); }
        g.fillStyle = color;
        g.fillText(txt, xx, yy);
      });
    });
    return { h: lay.lines.length * L, focus, size: s };
  }
  function cols(g, P, r, x, y, w, h, n, bs, o = {}) {
    const gut = bs * 1.3, cw = (w - gut * (n - 1)) / n;
    g.save();
    g.globalCompositeOperation = o.screen ? 'source-over' : 'multiply';
    for (let k = 0; k < n; k++) {
      PP.textColumn(g, P, rng(U.hash(r() * 1e9)), x + k * (cw + gut), y, y + h, cw, bs, { startPara: true, allowPhoto: o.photos, dropCap: o.dropCap && k === 0, allowTable: o.tables });
      if (o.rules && k) { g.fillStyle = P.ink; g.globalAlpha = 0.4; g.fillRect(x + k * (cw + gut) - gut / 2, y, 1.2, h); g.globalAlpha = 1; }
    }
    g.restore();
  }
  function pic(g, img, x, y, w, h, kind, r) {
    PP.drawPhoto(g, { photo: kind, ink: '#1d1c1a' }, img, { x, y, w, h }, r);
    return { x, y, w, h };
  }
  const sc = (g, spec, size, text, x, y, color, sp = 0.1, align = 'left') => PP.smallCaps(g, spec, size, text, x, y, color, sp, align);
  const rule = (g, x, y, w, t, c) => { g.fillStyle = c; g.fillRect(x, y, w, t); };
  function fitText(g, spec, text, maxW, size, style = '') {
    g.font = font(spec, size, style);
    const w = PP.measure(g, text);
    if (w > maxW) size *= maxW / w;
    g.font = font(spec, size, style);
    return size;
  }
  function lines(g, spec, size, text, x, y, w, color, lh = 1.35, max = 99, align = 'left') {
    g.font = font(spec, size);
    g.fillStyle = color;
    g.textAlign = align;
    U.wrapLines(g, text, w).slice(0, max).forEach((l, i) => g.fillText(l, align === 'center' ? x + w / 2 : x, y + i * size * lh));
    g.textAlign = 'left';
  }
  function barcode(g, x, y, w, h, r) {
    g.fillStyle = '#fff';
    g.fillRect(x - 8, y - 8, w + 16, h + 30);
    g.fillStyle = '#111';
    for (let i = 0; i < w; ) { const s = 1 + Math.floor(r() * 3); if (r() < 0.6) g.fillRect(x + i, y, s, h); i += s + 1; }
    g.font = font(F.mono, 14);
    g.fillText('9 771234 567003', x, y + h + 12);
  }
  function shadowRect(g, x, y, w, h, blur, color = 'rgba(0,0,0,0.35)', oy = 0.3) {
    g.save();
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.shadowOffsetY = blur * oy;
    g.fillStyle = '#000';
    g.fillRect(x, y, w, h);
    g.restore();
  }
  const dateTxt = () => PP.dateLine();
  const brand = (d, def) => d.brand || def;

  // ---------- surfaces (also used behind pages when the camera zooms out) ----------
  const surfCache = new Map();
  function surface(kind, w, h) {
    const key = `${kind}|${w}x${h}`;
    if (surfCache.has(key)) return surfCache.get(key);
    if (surfCache.size > 12) surfCache.delete(surfCache.keys().next().value);
    const c = U.makeCanvas(w, h), g = c.getContext('2d');
    const r = rng(U.hash(key));
    if (kind === 'wood') {
      g.fillStyle = '#6e4a2f';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < h; i += 3) {
        g.strokeStyle = `rgba(${r() < 0.5 ? '40,22,10' : '150,105,65'},${rand(r, 0.05, 0.16)})`;
        g.lineWidth = rand(r, 1, 3);
        g.beginPath();
        const a = rand(r, 2, 8), f = rand(r, 0.002, 0.006), p = r() * 9;
        for (let x = 0; x <= w; x += 20) g.lineTo(x, i + Math.sin(x * f + p) * a);
        g.stroke();
      }
      for (let k = 1; k < 4; k++) rule(g, 0, (h / 4) * k + rand(r, -20, 20), w, 2, 'rgba(20,10,5,0.35)');
    } else if (kind === 'cork') {
      g.fillStyle = '#b58a5c';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < (w * h) / 60; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(90,55,25,0.35)' : 'rgba(220,180,130,0.3)';
        g.fillRect(rand(r, 0, w), rand(r, 0, h), rand(r, 1, 4), rand(r, 1, 4));
      }
    } else if (kind === 'brick') {
      g.fillStyle = '#c9c1b4';
      g.fillRect(0, 0, w, h);
      const bh = 70, bw = 200;
      for (let y = 0, row = 0; y < h; y += bh, row++)
        for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw) {
          g.fillStyle = `hsl(${rand(r, 8, 18)},${rand(r, 35, 50)}%,${rand(r, 30, 42)}%)`;
          g.fillRect(x + 4, y + 4, bw - 8, bh - 8);
        }
    } else if (kind === 'slate') {
      g.fillStyle = '#2b2e31';
      g.fillRect(0, 0, w, h);
    } else if (kind === 'linen') {
      g.fillStyle = '#d8d1c3';
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.08;
      for (let x = 0; x < w; x += 4) rule(g, x, 0, 1, h, '#5a4a30');
      for (let y = 0; y < h; y += 4) rule(g, 0, y, w, 1, '#5a4a30');
      g.globalAlpha = 1;
    } else if (kind === 'wall') {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#d9d4c9'); gr.addColorStop(1, '#bdb6a8');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    } else {
      g.fillStyle = '#e6e3dc';
      g.fillRect(0, 0, w, h);
    }
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.12;
    g.fillStyle = g.createPattern(U.grainTile(), 'repeat');
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    surfCache.set(key, c);
    return c;
  }

  // ---------- templates ----------
  // Each draws a page into g (size w×h) and returns { photo, focus } rectangles in page pixels.
  const T = {};
  const def = (key, name, group, size, draw) => (T[key] = { key, name, group, size, draw });
  const P_NEWS = pub(F.serif), P_SANS = pub(F.frank, { justify: false }), P_OLD = pub(F.oldR, { ink: '#2a2118', lh: 1.24, photo: 'sepia' });
  const P_FIN = pub(F.pt, { corpus: 'finance', tables: true }), P_MAG = pub(F.news, { corpus: 'magazine', justify: false, lh: 1.45, photo: 'gloss' });
  const P_WEB = pub(F.news, { corpus: 'news', justify: false, lh: 1.5, photo: 'gloss', ink: '#222' });

  def('front', 'Front page', 'Newspapers', [1200, 1600], (g, w, h, d) => {
    const r = d.r, m = 60;
    paperBg(g, w, h, '#f2f0e9', r);
    g.fillStyle = '#141414';
    const ms = fitText(g, F.black, brand(d, 'The Morning Ledger'), w - 2 * m, 130);
    g.textAlign = 'center';
    g.fillText(brand(d, 'The Morning Ledger'), w / 2, m + ms * 0.55);
    g.textAlign = 'left';
    let y = m + ms * 1.15;
    rule(g, m, y, w - 2 * m, 4, '#141414');
    sc(g, F.frankB, 18, `VOL. CXII · ${dateTxt().toUpperCase()} · PRICE 500 FCFA`, w / 2, y + 26, '#141414', 0.12, 'center');
    rule(g, m, y + 44, w - 2 * m, 1.5, '#141414');
    y += 70;
    g.globalCompositeOperation = 'multiply';
    const hd = head(g, d, F.play, 92, m, y, w - 2 * m, { maxLines: 3 });
    y += hd.h + 14;
    lines(g, F.serif, 28, pick(r, C.decks), m, y + 14, w - 2 * m, '#333', 1.3, 2);
    y += 90;
    const pw = (w - 2 * m) * 0.66, ph = pw * 0.68;
    const photo = pic(g, d.img, m, y, pw, ph, 'halftone', r);
    lines(g, F.serif, 18, (d.caption || pick(r, C.decks)), m, y + ph + 22, pw, '#333', 1.3, 2);
    cols(g, P_NEWS, r, m + pw + 26, y, w - 2 * m - pw - 26, h - y - m, 1, 19, {});
    cols(g, P_NEWS, r, m, y + ph + 70, w - 2 * m, h - y - ph - 70 - m, 4, 19, { rules: true, photos: true });
    return { photo, focus: hd.focus };
  });

  def('tabloid', 'Tabloid', 'Newspapers', [1200, 1600], (g, w, h, d) => {
    const r = d.r, m = 40;
    paperBg(g, w, h, '#f5f5f2', r);
    g.fillStyle = '#d7261e';
    g.fillRect(m, m, w - 2 * m, 170);
    g.fillStyle = '#fff';
    fitText(g, F.anton, brand(d, 'THE DAILY FLASH').toUpperCase(), w - 2 * m - 300, 140);
    g.fillText(brand(d, 'THE DAILY FLASH').toUpperCase(), m + 24, m + 88);
    g.fillStyle = '#ffd400';
    g.fillRect(w - m - 250, m + 30, 220, 110);
    sc(g, F.frankB, 26, 'EXCLUSIVE', w - m - 140, m + 85, '#111', 0.06, 'center');
    let y = m + 200;
    const ph = 660;
    const photo = pic(g, d.img, m, y, w - 2 * m, ph, 'color', r);
    y += ph + 20;
    const hd = head(g, d, F.anton, 150, m, y, w - 2 * m, { upper: true, maxLines: 2, lh: 1 });
    y += hd.h + 16;
    lines(g, F.frankB, 30, pick(r, C.decks), m, y + 16, w - 2 * m, '#d7261e', 1.25, 2);
    cols(g, P_SANS, r, m, y + 90, w - 2 * m, h - y - 90 - m, 3, 20, {});
    return { photo, focus: hd.focus };
  });

  def('vintage', '1920s paper', 'Newspapers', [1200, 1650], (g, w, h, d) => {
    const r = d.r, m = 50;
    paperBg(g, w, h, '#e6d6b4', r, 1);
    g.fillStyle = '#2a2118';
    const ms = fitText(g, F.black, brand(d, 'The Evening Courier'), w - 2 * m, 120);
    g.textAlign = 'center';
    g.fillText(brand(d, 'The Evening Courier'), w / 2, m + ms * 0.55);
    g.textAlign = 'left';
    let y = m + ms * 1.1;
    rule(g, m, y, w - 2 * m, 3, '#2a2118');
    rule(g, m, y + 6, w - 2 * m, 1, '#2a2118');
    sc(g, F.old, 16, `ESTABLISHED 1887 · ${dateTxt().toUpperCase()} · TWO CENTS`, w / 2, y + 26, '#2a2118', 0.1, 'center');
    rule(g, m, y + 42, w - 2 * m, 1, '#2a2118');
    y += 64;
    g.globalCompositeOperation = 'multiply';
    const hd = head(g, d, F.old, 66, m + 40, y, w - 2 * m - 80, { upper: true, align: 'center', maxLines: 3 });
    y += hd.h + 10;
    sc(g, F.old, 20, 'EXTRA! FULL PARTICULARS INSIDE — LATEST DISPATCHES', w / 2, y + 10, '#2a2118', 0.08, 'center');
    y += 36;
    const pw = (w - 2 * m) * 0.5, ph = pw * 0.75, px = (w - pw) / 2;
    const photo = pic(g, d.img, px, y, pw, ph, 'sepia', r);
    g.strokeStyle = '#2a2118';
    g.strokeRect(px - 6, y - 6, pw + 12, ph + 12);
    cols(g, P_OLD, r, m, y, px - m - 20, ph, 2, 16, { rules: true });
    cols(g, P_OLD, r, px + pw + 20, y, w - m - px - pw - 20, ph, 2, 16, { rules: true });
    cols(g, P_OLD, r, m, y + ph + 30, w - 2 * m, h - y - ph - 30 - m, 6, 16, { rules: true });
    return { photo, focus: hd.focus };
  });

  def('business', 'Business paper', 'Newspapers', [1200, 1600], (g, w, h, d) => {
    const r = d.r, m = 56;
    paperBg(g, w, h, '#f3dfcf', r);
    g.fillStyle = '#1e1a17';
    fitText(g, F.ptB, brand(d, 'The Market Journal'), w - 2 * m, 90);
    g.fillText(brand(d, 'The Market Journal'), m, m + 50);
    rule(g, m, m + 100, w - 2 * m, 3, '#1e1a17');
    sc(g, F.interM, 16, `${dateTxt().toUpperCase()}   ·   MARKETS   ·   COMPANIES   ·   OPINION`, m, m + 124, '#1e1a17', 0.08);
    let y = m + 160;
    g.globalCompositeOperation = 'multiply';
    const hd = head(g, d, F.ptB, 80, m, y, w - 2 * m, { maxLines: 3 });
    y += hd.h + 20;
    const pw = (w - 2 * m) * 0.58, ph = pw * 0.66;
    const photo = pic(g, d.img, m, y, pw, ph, 'halftone', r);
    // market chart
    const cx = m + pw + 30, cw = w - m - cx, ch = ph * 0.55;
    g.strokeStyle = '#1e1a17';
    g.lineWidth = 1;
    g.strokeRect(cx, y, cw, ch);
    sc(g, F.interM, 14, 'INDEX · 12 MONTHS', cx + 10, y + 18, '#1e1a17', 0.06);
    g.beginPath();
    let v = 0.5;
    for (let i = 0; i <= 40; i++) { v = U.clamp(v + rand(r, -0.08, 0.1), 0.1, 0.9); const px = cx + 10 + (i / 40) * (cw - 20), py = y + ch - 10 - v * (ch - 40); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.lineWidth = 3;
    g.strokeStyle = '#a3261b';
    g.stroke();
    cols(g, P_FIN, r, cx, y + ch + 16, cw, ph - ch - 16, 1, 17, { tables: true });
    cols(g, P_FIN, r, m, y + ph + 30, w - 2 * m, h - y - ph - 30 - m, 4, 18, { rules: true, tables: true });
    return { photo, focus: hd.focus };
  });

  def('sports', 'Sports page', 'Newspapers', [1200, 1600], (g, w, h, d) => {
    const r = d.r, m = 40;
    paperBg(g, w, h, '#f4f4f1', r);
    g.fillStyle = '#111';
    g.fillRect(m, m, w - 2 * m, 90);
    g.fillStyle = '#fff';
    g.font = font(F.anton, 64);
    g.fillText('SPORT', m + 20, m + 48);
    sc(g, F.frankB, 18, 'FOOTBALL · BASKETBALL · ATHLETICS · BOXING', m + 230, m + 48, '#fff', 0.1);
    let y = m + 110;
    const ph = 600;
    const photo = pic(g, d.img, m, y, w - 2 * m, ph, 'color', r);
    y += ph + 16;
    const hd = head(g, d, F.anton, 120, m, y, w - 2 * m, { upper: true, maxLines: 2, lh: 1 });
    y += hd.h + 20;
    // score box
    const bw = 380, bx = w - m - bw;
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    g.strokeRect(bx, y, bw, 150);
    sc(g, F.frankB, 16, 'FULL TIME', bx + 16, y + 26, '#d7261e', 0.1);
    g.font = font(F.frankB, 30);
    g.fillStyle = '#111';
    g.fillText('Douala FC', bx + 16, y + 70); g.fillText('2', bx + bw - 40, y + 70);
    g.fillText('Coastal United', bx + 16, y + 118); g.fillText('1', bx + bw - 40, y + 118);
    cols(g, P_SANS, r, m, y, w - 2 * m - bw - 30, h - y - m, 2, 19, {});
    cols(g, P_SANS, r, bx, y + 180, bw, h - y - 180 - m, 1, 19, {});
    return { photo, focus: hd.focus };
  });

  def('local', 'Local weekly', 'Newspapers', [1200, 1600], (g, w, h, d) => {
    const r = d.r, m = 50;
    paperBg(g, w, h, '#f7f5ef', r);
    g.fillStyle = '#0f6e6a';
    g.fillRect(0, 0, w, 150);
    g.fillStyle = '#fff';
    fitText(g, F.frankB, brand(d, 'Riverside Weekly'), w - 2 * m - 260, 86);
    g.fillText(brand(d, 'Riverside Weekly'), m, 78);
    sc(g, F.frank, 18, 'YOUR COMMUNITY · FREE', w - m, 78, '#fff', 0.1, 'right');
    let y = 190;
    g.globalCompositeOperation = 'multiply';
    const hd = head(g, d, F.frankB, 78, m, y, w - 2 * m, { maxLines: 3 });
    y += hd.h + 24;
    const pw = w - 2 * m, ph = 560;
    const photo = pic(g, d.img, m, y, pw, ph, 'color', r);
    lines(g, F.frank, 20, d.caption || pick(r, C.decks), m, y + ph + 24, pw, '#444', 1.3, 2);
    y += ph + 70;
    const bw = 340, bx = w - m - bw;
    g.fillStyle = '#e8f1ef';
    g.fillRect(bx, y, bw, h - y - m);
    sc(g, F.frankB, 18, 'COMMUNITY NOTICES', bx + 20, y + 30, '#0f6e6a', 0.1);
    lines(g, F.frank, 19, '• Library story hour, Saturday 10am  • Market clean-up day, Sunday  • Choir rehearsal moved to Thursday  • Lost: black bicycle near the school  • Football trials for under-14s next week', bx + 20, y + 66, bw - 40, '#222', 1.45);
    cols(g, P_SANS, r, m, y, w - 2 * m - bw - 30, h - y - m, 2, 19, {});
    return { photo, focus: hd.focus };
  });

  def('classified', 'Classifieds', 'Newspapers', [1200, 1600], (g, w, h, d) => {
    const r = d.r, m = 40;
    paperBg(g, w, h, '#efede6', r);
    g.fillStyle = '#111';
    g.font = font(F.anton, 80);
    g.fillText('CLASSIFIEDS', m, m + 44);
    rule(g, m, m + 96, w - 2 * m, 4, '#111');
    const gx = 3, gy = 6, cw = (w - 2 * m - 20 * (gx - 1)) / gx, chh = (h - m - (m + 116) - 16 * (gy - 1)) / gy;
    let photo, focus;
    for (let iy = 0; iy < gy; iy++)
      for (let ix = 0; ix < gx; ix++) {
        const x = m + ix * (cw + 20), y = m + 116 + iy * (chh + 16);
        if (ix < 2 && iy >= 1 && iy <= 2) {
          if (ix === 0 && iy === 1) {
            const bw = cw * 2 + 20, bh = chh * 2 + 16;
            g.lineWidth = 4;
            g.strokeStyle = '#111';
            g.strokeRect(x, y, bw, bh);
            sc(g, F.frankB, 18, '★ FEATURED', x + 20, y + 30, '#d7261e', 0.1);
            photo = pic(g, d.img, x + 20, y + 50, bw * 0.48, bh - 70, 'halftone', r);
            focus = head(g, d, F.frankB, 54, x + bw * 0.52, y + 50, bw * 0.45, { maxLines: 4 }).focus;
          }
          continue;
        }
        g.lineWidth = 1;
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.strokeRect(x, y, cw, chh);
        g.font = font(F.frankB, 20);
        g.fillStyle = '#111';
        g.fillText(pick(r, ['FOR SALE', 'TO LET', 'WANTED', 'JOBS', 'SERVICES', 'NOTICES']), x + 12, y + 24);
        lines(g, F.frank, 15, pick(r, C.news), x + 12, y + 50, cw - 24, '#222', 1.3, 4);
        g.font = font(F.frankB, 16);
        g.fillText(`Tel. 6${U.randInt(r, 50, 99)} ${U.randInt(r, 100, 999)} ${U.randInt(r, 100, 999)}`, x + 12, y + chh - 18);
      }
    return { photo, focus };
  });

  def('clipping', 'Clipping on desk', 'Newspapers', [1600, 1150], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('wood', w, h), 0, 0);
    // coffee ring
    g.strokeStyle = 'rgba(70,35,10,0.35)';
    g.lineWidth = 10;
    U.roughEllipse(g, w * 0.85, h * 0.2, 110, 105, r, 1);
    const cx = w * 0.12, cy = h * 0.08, cw = w * 0.62, ch = h * 0.84;
    const poly = U.tornPoly(cx, cy, cw, ch, U.randInt(r, 1, 1e6), 8, 14);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 30;
    g.shadowOffsetY = 12;
    g.fillStyle = '#efece3';
    U.polyPath(g, poly);
    g.fill();
    g.restore();
    g.save();
    U.polyPath(g, poly);
    g.clip();
    paperBg(g, w, h, '#efece3', r);
    g.globalCompositeOperation = 'multiply';
    const hd = head(g, d, F.play, 68, cx + 40, cy + 40, cw - 80, { maxLines: 3 });
    const py = cy + 60 + hd.h;
    const photo = pic(g, d.img, cx + 40, py, cw * 0.55, cw * 0.4, 'halftone', r);
    cols(g, P_NEWS, r, cx + 60 + cw * 0.55, py, cw - 100 - cw * 0.55, cw * 0.4, 1, 17, {});
    cols(g, P_NEWS, r, cx + 40, py + cw * 0.4 + 24, cw - 80, ch, 3, 17, {});
    g.restore();
    // pen and paper clip
    g.save();
    g.translate(w * 0.86, h * 0.62);
    g.rotate(-0.9);
    shadowRect(g, -16, -220, 32, 440, 16);
    const pg = g.createLinearGradient(-16, 0, 16, 0);
    pg.addColorStop(0, '#0d2a5c'); pg.addColorStop(0.5, '#2e5aa8'); pg.addColorStop(1, '#0d2a5c');
    g.fillStyle = pg;
    U.roundRect(g, -16, -220, 32, 440, 14);
    g.fill();
    g.fillStyle = '#c9c9c9';
    g.fillRect(-16, 170, 32, 30);
    g.restore();
    g.strokeStyle = '#b8b8b8';
    g.lineWidth = 5;
    U.roundRect(g, cx + cw - 70, cy - 20, 40, 120, 18);
    g.stroke();
    return { photo, focus: hd.focus };
  });

  def('supplement', 'Weekend supplement', 'Newspapers', [1200, 1600], (g, w, h, d) => {
    const r = d.r, m = 50;
    paperBg(g, w, h, '#fbfaf7', r);
    g.fillStyle = '#111';
    g.font = font(F.bodoni, 150, 'italic');
    g.fillText('Weekend', m, m + 90);
    sc(g, F.interM, 18, `${brand(d, 'THE MORNING LEDGER').toUpperCase()} MAGAZINE · ${dateTxt().toUpperCase()}`, m, m + 190, '#c8102e', 0.14);
    const photo = pic(g, d.img, m, m + 220, w - 2 * m, 760, 'gloss', r);
    const hd = head(g, d, F.bodoni, 84, m, m + 1010, w - 2 * m, { style: 'italic', maxLines: 2 });
    lines(g, F.news, 28, pick(r, C.magazine), m, m + 1040 + hd.h, w - 2 * m, '#333', 1.35, 2);
    cols(g, P_MAG, r, m, m + 1130 + hd.h, w - 2 * m, h - m - 1130 - hd.h - m, 3, 18, { dropCap: true });
    return { photo, focus: hd.focus };
  });

  // ---- magazines ----
  def('fashion', 'Fashion cover', 'Magazines', [1200, 1560], (g, w, h, d) => {
    const r = d.r;
    const photo = pic(g, d.img, 0, 0, w, h, 'gloss', r);
    const top = g.createLinearGradient(0, 0, 0, h * 0.3);
    top.addColorStop(0, 'rgba(0,0,0,0.35)'); top.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = top; g.fillRect(0, 0, w, h * 0.3);
    const bot = g.createLinearGradient(0, h * 0.55, 0, h);
    bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = bot; g.fillRect(0, h * 0.55, w, h * 0.45);
    g.fillStyle = '#fff';
    fitText(g, F.bodoniB, brand(d, 'MODE').toUpperCase(), w - 80, 300);
    g.textAlign = 'center';
    g.fillText(brand(d, 'MODE').toUpperCase(), w / 2, 190);
    g.textAlign = 'left';
    sc(g, F.interM, 20, `ISSUE ${U.randInt(r, 10, 99)} · ${dateTxt().toUpperCase()}`, w / 2, 330, '#fff', 0.2, 'center');
    ['THE NEW', 'ICONS', '', '48 PAGES', 'OF STYLE'].forEach((t, i) => t && sc(g, F.interB, 30, t, 60, 470 + i * 40, '#fff', 0.06));
    const hd = head(g, d, F.bodoni, 110, 60, h - 420, w * 0.8, { style: 'italic', color: '#fff', maxLines: 3 });
    lines(g, F.interM, 26, 'Inside the season everyone is talking about', 60, h - 400 + hd.h + 20, w * 0.7, '#fff');
    barcode(g, w - 220, h - 150, 150, 70, r);
    return { photo, focus: hd.focus };
  });

  def('newsweekly', 'News weekly cover', 'Magazines', [1200, 1560], (g, w, h, d) => {
    const r = d.r, b = 44;
    g.fillStyle = '#c8102e';
    g.fillRect(0, 0, w, h);
    const photo = pic(g, d.img, b, b + 170, w - 2 * b, h - 2 * b - 170, 'gloss', r);
    g.fillStyle = '#fff';
    fitText(g, F.play, brand(d, 'THE WEEK').toUpperCase(), w - 2 * b, 150);
    g.fillText(brand(d, 'THE WEEK').toUpperCase(), b + 10, b + 90);
    sc(g, F.interM, 18, dateTxt().toUpperCase(), w - b, b + 150, '#fff', 0.12, 'right');
    const gr = g.createLinearGradient(0, h * 0.6, 0, h - b);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = gr; g.fillRect(b, h * 0.6, w - 2 * b, h * 0.4 - b);
    const hd = head(g, d, F.play, 100, b + 40, h - b - 340, w - 2 * b - 80, { color: '#fff', maxLines: 3 });
    return { photo, focus: hd.focus };
  });

  def('spread', 'Magazine spread', 'Magazines', [2000, 1300], (g, w, h, d) => {
    const r = d.r, half = w / 2;
    const photo = pic(g, d.img, 0, 0, half, h, 'gloss', r);
    paperBg(g, half, h, '#fbfaf7', r);
    g.save();
    g.translate(half, 0);
    paperBg(g, half, h, '#fbfaf7', r);
    const m = 90;
    sc(g, F.interM, 20, pick(r, ['PROFILE', 'FEATURE', 'CULTURE', 'THE INTERVIEW']), m, m, '#c8102e', 0.2);
    const hd = head(g, d, F.bodoni, 92, m, m + 30, half - 2 * m, { style: 'italic', maxLines: 3 });
    lines(g, F.news, 28, pick(r, C.magazine), m, m + 70 + hd.h, half - 2 * m, '#444', 1.35, 3);
    cols(g, P_MAG, r, m, m + 200 + hd.h, half - 2 * m, h - m * 2 - 200 - hd.h, 2, 19, { dropCap: true });
    sc(g, F.interM, 16, String(U.randInt(r, 20, 140)), half - m, h - 50, '#111', 0, 'right');
    g.restore();
    // re-draw photo over the left page (paperBg above covered it) and add gutter shadow
    pic(g, d.img, 0, 0, half, h, 'gloss', r);
    const gs = g.createLinearGradient(half - 80, 0, half + 80, 0);
    gs.addColorStop(0, 'rgba(0,0,0,0)'); gs.addColorStop(0.5, 'rgba(0,0,0,0.28)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gs;
    g.fillRect(half - 80, 0, 160, h);
    return { photo, focus: hd.focus ? { x: hd.focus.x + half, y: hd.focus.y, w: hd.focus.w, h: hd.focus.h } : null };
  });

  def('music', 'Music magazine', 'Magazines', [1200, 1560], (g, w, h, d) => {
    const r = d.r;
    g.fillStyle = '#111';
    g.fillRect(0, 0, w, h);
    const photo = pic(g, d.img, 0, 180, w, h - 180, 'color', r);
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgba(220,40,60,0.55)';
    g.fillRect(0, 180, w, h - 180);
    g.restore();
    g.save();
    g.translate(60, 170);
    g.rotate(-0.04);
    g.fillStyle = '#ffde00';
    fitText(g, F.anton, brand(d, 'NOISE').toUpperCase(), w - 120, 240);
    g.fillText(brand(d, 'NOISE').toUpperCase(), 0, -40);
    g.restore();
    g.fillStyle = '#ffde00';
    g.beginPath(); g.arc(w - 190, 420, 130, 0, 7); g.fill();
    sc(g, F.anton, 34, 'EXCLUSIVE', w - 190, 405, '#111', 0.04, 'center');
    sc(g, F.anton, 34, 'INTERVIEW', w - 190, 445, '#111', 0.04, 'center');
    const hd = head(g, d, F.anton, 130, 60, h - 420, w - 120, { upper: true, color: '#fff', maxLines: 3, lh: 1 });
    return { photo, focus: hd.focus };
  });

  def('travel', 'Travel magazine', 'Magazines', [1200, 1560], (g, w, h, d) => {
    const r = d.r;
    const photo = pic(g, d.img, 0, 0, w, h, 'gloss', r);
    g.strokeStyle = '#fff';
    g.lineWidth = 6;
    g.strokeRect(36, 36, w - 72, h - 72);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(36, 36, w - 72, 210);
    g.fillStyle = '#fff';
    U.setLetterSpacing(g, 30);
    fitText(g, F.play, brand(d, 'WANDER').toUpperCase(), w - 140, 140);
    g.textAlign = 'center';
    g.fillText(brand(d, 'WANDER').toUpperCase(), w / 2, 150);
    g.textAlign = 'left';
    U.setLetterSpacing(g, 0);
    const gr = g.createLinearGradient(0, h * 0.62, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = gr; g.fillRect(0, h * 0.62, w, h * 0.38);
    const hd = head(g, d, F.play, 96, 80, h - 380, w - 160, { color: '#fff', maxLines: 3, style: 'italic' });
    sc(g, F.interM, 22, '50 PLACES TO SEE THIS YEAR', 80, h - 100, '#fff', 0.16);
    return { photo, focus: hd.focus };
  });

  def('gossip', 'Celebrity weekly', 'Magazines', [1200, 1560], (g, w, h, d) => {
    const r = d.r;
    const photo = pic(g, d.img, 0, 0, w, h, 'gloss', r);
    g.fillStyle = '#e4007c';
    g.fillRect(0, 0, w, 210);
    g.fillStyle = '#fff';
    fitText(g, F.anton, brand(d, 'BUZZ!').toUpperCase(), w - 300, 200);
    g.fillText(brand(d, 'BUZZ!').toUpperCase(), 40, 110);
    [['SHOCK', 'PICS!', w - 170, 340, '#ffe600'], ['ALL THE', 'GOSSIP', 170, 760, '#00d1ff']].forEach(([a, b, x, y, c]) => {
      g.fillStyle = c; g.beginPath(); g.arc(x, y, 120, 0, 7); g.fill();
      sc(g, F.anton, 40, a, x, y - 18, '#111', 0.02, 'center');
      sc(g, F.anton, 40, b, x, y + 30, '#111', 0.02, 'center');
    });
    g.save();
    g.translate(40, h - 360);
    g.rotate(-0.03);
    g.fillStyle = '#111';
    g.fillRect(-10, -20, w - 60, 300);
    const hd = head(g, d, F.anton, 110, 20, 0, w - 120, { upper: true, color: '#fff', maxLines: 2, lh: 1 });
    g.restore();
    const f = hd.focus;
    // the band is rotated; approximate the focus rect position after rotation
    const focus = f ? { x: 40 + f.x, y: h - 360 + f.y - (f.x * 0.03), w: f.w, h: f.h } : null;
    return { photo, focus };
  });

  def('bizmag', 'Business magazine', 'Magazines', [1200, 1560], (g, w, h, d) => {
    const r = d.r, m = 70;
    paperBg(g, w, h, '#f6f6f4', r);
    g.fillStyle = '#111';
    fitText(g, F.interB, brand(d, 'VENTURE').toUpperCase(), w - 2 * m, 200);
    g.fillText(brand(d, 'VENTURE').toUpperCase(), m, m + 100);
    sc(g, F.interM, 18, `THE BUSINESS ISSUE · ${dateTxt().toUpperCase()}`, m, m + 210, '#1f5fbf', 0.14);
    shadowRect(g, m + 60, m + 260, w - 2 * m - 120, 760, 40, 'rgba(0,0,0,0.25)');
    const photo = pic(g, d.img, m + 60, m + 260, w - 2 * m - 120, 760, 'gloss', r);
    const hd = head(g, d, F.interB, 88, m, m + 1060, w - 2 * m, { maxLines: 2 });
    lines(g, F.interM, 26, 'The 30 founders shaping the next decade · How to raise your first round · Inside the boardroom', m, m + 1090 + hd.h, w - 2 * m, '#444', 1.4, 3);
    return { photo, focus: hd.focus };
  });

  // ---- web & screens ----
  function browser(g, w, h, url) {
    g.fillStyle = '#dee1e6';
    g.fillRect(0, 0, w, 110);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(34 + i * 30, 30, 10, 0, 7); g.fill(); });
    g.fillStyle = '#fff';
    U.roundRect(g, 140, 10, 380, 40, 10); g.fill();
    g.fillStyle = '#fff';
    U.roundRect(g, 20, 62, w - 40, 38, 19); g.fill();
    g.font = font(F.inter, 20);
    g.fillStyle = '#555';
    g.fillText('🔒 ' + url, 44, 82);
    g.fillStyle = '#fff';
    g.fillRect(0, 110, w, h - 110);
  }
  const slug = (d) => (d.mode === 'word' ? d.parts.before.concat(d.parts.focus, d.parts.after).join('-') : d.headline || 'story').toLowerCase().replace(/[^a-z0-9-]+/g, '').slice(0, 40);
  const domain = (d, def2) => (d.brand ? d.brand.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com' : def2);

  def('blog', 'Blog post', 'Web & screens', [1200, 1600], (g, w, h, d) => {
    const r = d.r, m = 110;
    browser(g, w, h, `${domain(d, 'thequietdesk.blog')}/stories/${slug(d)}`);
    sc(g, F.newsB, 30, brand(d, 'The Quiet Desk'), m, 170, '#111', 0);
    sc(g, F.inter, 18, 'Stories   Culture   About   Subscribe', w - m, 170, '#666', 0.02, 'right');
    rule(g, m, 200, w - 2 * m, 1, '#e5e5e5');
    const hd = head(g, d, F.newsB, 70, m, 240, w - 2 * m, { maxLines: 3 });
    let y = 260 + hd.h;
    g.fillStyle = '#ccc'; g.beginPath(); g.arc(m + 24, y + 24, 24, 0, 7); g.fill();
    sc(g, F.interM, 20, pick(r, C.bylines), m + 62, y + 18, '#222', 0);
    sc(g, F.inter, 18, `${dateTxt()} · ${U.randInt(r, 3, 9)} min read`, m + 62, y + 42, '#888', 0);
    y += 80;
    const photo = pic(g, d.img, m, y, w - 2 * m, (w - 2 * m) * 0.56, 'gloss', r);
    y += (w - 2 * m) * 0.56 + 40;
    cols(g, P_WEB, r, m, y, w - 2 * m, h - y, 1, 26, { screen: true });
    return { photo, focus: hd.focus };
  });

  def('newsweb', 'News website', 'Web & screens', [1200, 1600], (g, w, h, d) => {
    const r = d.r, m = 60;
    browser(g, w, h, `www.${domain(d, 'news24daily.com')}/world/${slug(d)}`);
    g.fillStyle = '#111';
    g.fillRect(0, 110, w, 80);
    g.fillStyle = '#d7261e';
    g.fillRect(m, 120, 200, 60);
    sc(g, F.interB, 30, brand(d, 'NEWS 24').toUpperCase(), m + 100, 152, '#fff', 0.02, 'center');
    sc(g, F.interM, 18, 'Home   World   Business   Sport   Culture   Video', m + 240, 152, '#fff', 0.04);
    g.fillStyle = '#d7261e';
    g.fillRect(0, 190, w, 50);
    sc(g, F.interB, 20, 'BREAKING  ·  ' + pick(r, C.news).toUpperCase().slice(0, 80), m, 216, '#fff', 0.04);
    const hd = head(g, d, F.frankB, 64, m, 280, w - 2 * m, { maxLines: 3 });
    let y = 300 + hd.h;
    sc(g, F.inter, 18, `By ${pick(r, C.bylines)} · Updated ${U.randInt(r, 2, 59)} minutes ago`, m, y, '#777', 0);
    y += 30;
    const photo = pic(g, d.img, m, y, w - 2 * m, (w - 2 * m) * 0.56, 'gloss', r);
    y += (w - 2 * m) * 0.56 + 40;
    sc(g, F.interB, 22, 'MORE STORIES', m, y, '#111', 0.1);
    const tw = (w - 2 * m - 40) / 3;
    for (let i = 0; i < 3; i++) {
      const x = m + i * (tw + 20);
      pic(g, STOCK.get(r() * 99), x, y + 24, tw, tw * 0.62, 'gloss', r);
      lines(g, F.frankB, 22, pick(r, C.news), x, y + 50 + tw * 0.62, tw, '#111', 1.3, 3);
    }
    return { photo, focus: hd.focus };
  });

  def('social', 'Photo post', 'Web & screens', [1200, 1650], (g, w, h, d) => {
    const r = d.r, m = 30;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    const ring = g.createLinearGradient(m, m, m + 90, m + 90);
    ring.addColorStop(0, '#f9ce34'); ring.addColorStop(0.5, '#ee2a7b'); ring.addColorStop(1, '#6228d7');
    g.fillStyle = ring; g.beginPath(); g.arc(m + 45, m + 50, 45, 0, 7); g.fill();
    g.fillStyle = '#ddd'; g.beginPath(); g.arc(m + 45, m + 50, 38, 0, 7); g.fill();
    sc(g, F.interB, 28, (d.brand || 'daily.matchcut').toLowerCase().replace(/\s+/g, '.'), m + 110, m + 38, '#111', 0);
    sc(g, F.inter, 22, pick(r, ['Douala, Cameroon', 'Yaoundé', 'Lagos', 'Paris', 'Accra']), m + 110, m + 70, '#555', 0);
    const photo = pic(g, d.img, 0, 120, w, w, 'gloss', r);
    let y = 120 + w + 30;
    g.font = font(F.inter, 50);
    g.fillStyle = '#111';
    g.fillText('♡   💬   ➤', m, y + 20);
    sc(g, F.interB, 26, `${U.randInt(r, 2, 98)},${U.randInt(r, 100, 999)} likes`, m, y + 80, '#111', 0);
    const hd = head(g, d, F.interB, 44, m, y + 110, w - 2 * m, { maxLines: 2 });
    lines(g, F.inter, 26, 'View all ' + U.randInt(r, 120, 990) + ' comments', m, y + 150 + hd.h, w, '#888');
    return { photo, focus: hd.focus };
  });

  def('tweet', 'Text post', 'Web & screens', [1200, 1350], (g, w, h, d) => {
    const r = d.r, m = 50;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#9aa'; g.beginPath(); g.arc(m + 40, m + 44, 40, 0, 7); g.fill();
    sc(g, F.interB, 30, d.brand || 'The Daily Flash', m + 100, m + 30, '#0f1419', 0);
    g.fillStyle = '#1d9bf0'; g.beginPath(); g.arc(m + 120 + PP.measure(g, d.brand || 'The Daily Flash'), m + 30, 12, 0, 7); g.fill();
    sc(g, F.inter, 24, '@' + (d.brand || 'dailyflash').toLowerCase().replace(/\s+/g, '') + ' · 2h', m + 100, m + 64, '#536471', 0);
    const hd = head(g, d, F.interM, 50, m, m + 120, w - 2 * m, { maxLines: 4, lh: 1.25 });
    const y = m + 150 + hd.h;
    g.save();
    U.roundRect(g, m, y, w - 2 * m, (w - 2 * m) * 0.56, 30);
    g.clip();
    const photo = pic(g, d.img, m, y, w - 2 * m, (w - 2 * m) * 0.56, 'gloss', r);
    g.restore();
    sc(g, F.inter, 24, `💬 ${U.randInt(r, 1, 9)}K    🔁 ${U.randInt(r, 2, 30)}K    ♡ ${U.randInt(r, 10, 300)}K    📊 ${U.randInt(r, 1, 9)}M`, m, y + (w - 2 * m) * 0.56 + 50, '#536471', 0);
    return { photo, focus: hd.focus };
  });

  def('video', 'Video page', 'Web & screens', [1700, 1150], (g, w, h, d) => {
    const r = d.r, m = 40;
    g.fillStyle = '#0f0f0f';
    g.fillRect(0, 0, w, h);
    const vw = w * 0.66, vh = vw * 0.5625;
    const photo = pic(g, d.img, m, m, vw, vh, 'gloss', r);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(m + vw / 2, m + vh / 2, 60, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(m + vw / 2 - 18, m + vh / 2 - 28); g.lineTo(m + vw / 2 + 30, m + vh / 2); g.lineTo(m + vw / 2 - 18, m + vh / 2 + 28); g.fill();
    rule(g, m, m + vh - 8, vw, 6, 'rgba(255,255,255,0.3)');
    rule(g, m, m + vh - 8, vw * rand(r, 0.2, 0.7), 6, '#ff0033');
    const hd = head(g, d, F.interB, 40, m, m + vh + 20, vw, { color: '#f1f1f1', maxLines: 2 });
    g.fillStyle = '#888'; g.beginPath(); g.arc(m + 30, m + vh + 60 + hd.h, 28, 0, 7); g.fill();
    sc(g, F.interM, 22, brand(d, 'News 24 Live'), m + 72, m + vh + 52 + hd.h, '#f1f1f1', 0);
    sc(g, F.inter, 18, `${U.randInt(r, 100, 999)}K subscribers · ${U.randInt(r, 1, 9)}M views`, m + 72, m + vh + 78 + hd.h, '#aaa', 0);
    const x0 = m + vw + 30, tw = w - x0 - m;
    for (let i = 0; i < 6; i++) {
      const y = m + i * 175;
      pic(g, STOCK.get(r() * 99), x0, y, tw * 0.48, tw * 0.27, 'gloss', r);
      lines(g, F.interM, 18, pick(r, C.news), x0 + tw * 0.52, y + 16, tw * 0.48, '#f1f1f1', 1.3, 3);
    }
    return { photo, focus: hd.focus };
  });

  def('phoneapp', 'Phone news app', 'Web & screens', [1300, 1700], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('linen', w, h), 0, 0);
    const pw = 780, ph = 1560, px = (w - pw) / 2, py = (h - ph) / 2;
    shadowRect(g, px, py, pw, ph, 60);
    g.fillStyle = '#111';
    U.roundRect(g, px, py, pw, ph, 90); g.fill();
    const sx = px + 26, sy = py + 26, sw = pw - 52, sh = ph - 52;
    g.save();
    U.roundRect(g, sx, sy, sw, sh, 70); g.clip();
    g.fillStyle = '#fff'; g.fillRect(sx, sy, sw, sh);
    sc(g, F.interM, 24, '9:41', sx + 60, sy + 50, '#111', 0);
    sc(g, F.interB, 34, brand(d, 'News 24'), sx + 40, sy + 130, '#d7261e', 0);
    rule(g, sx + 40, sy + 160, sw - 80, 2, '#eee');
    const photo = pic(g, d.img, sx, sy + 180, sw, sw * 0.7, 'gloss', r);
    const hd = head(g, d, F.interB, 54, sx + 40, sy + 210 + sw * 0.7, sw - 80, { maxLines: 4 });
    sc(g, F.inter, 22, `${pick(r, C.kickers)} · ${U.randInt(r, 2, 50)} min ago`, sx + 40, sy + 240 + sw * 0.7 + hd.h, '#888', 0);
    cols(g, P_WEB, r, sx + 40, sy + 280 + sw * 0.7 + hd.h, sw - 80, sh, 1, 26, { screen: true });
    g.restore();
    g.fillStyle = '#111';
    U.roundRect(g, px + pw / 2 - 110, py + 40, 220, 50, 25); g.fill();
    return { photo, focus: hd.focus };
  });

  def('tv', 'TV news', 'Web & screens', [1700, 1150], (g, w, h, d) => {
    const r = d.r;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#3a3530'); bg.addColorStop(1, '#1d1a17');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const tw = w * 0.86, th = tw * 0.5625, tx = (w - tw) / 2, ty = (h - th) / 2 - 20;
    shadowRect(g, tx, ty, tw, th, 50);
    g.fillStyle = '#0b0b0b';
    U.roundRect(g, tx - 22, ty - 22, tw + 44, th + 44, 16); g.fill();
    const photo = pic(g, d.img, tx, ty, tw, th, 'gloss', r);
    g.fillStyle = '#d7261e';
    g.fillRect(tx + 50, ty + th - 230, 330, 56);
    sc(g, F.interB, 30, 'BREAKING NEWS', tx + 70, ty + th - 200, '#fff', 0.04);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fillRect(tx + 50, ty + th - 174, tw - 100, 110);
    const hd = head(g, d, F.interB, 52, tx + 70, ty + th - 166, tw - 140, { upper: true, maxLines: 2, lh: 1.02 });
    g.fillStyle = '#111';
    g.fillRect(tx, ty + th - 50, tw, 50);
    sc(g, F.interM, 24, pick(r, C.news) + '   ·   ' + pick(r, C.finance), tx + 20, ty + th - 24, '#ffd400', 0.02);
    g.fillStyle = '#d7261e';
    g.fillRect(tx + 40, ty + 40, 100, 44);
    sc(g, F.interB, 24, '● LIVE', tx + 90, ty + 63, '#fff', 0.04, 'center');
    sc(g, F.interB, 30, brand(d, 'NEWS 24').toUpperCase(), tx + tw - 40, ty + 64, '#fff', 0.04, 'right');
    // screen glare
    const gl = g.createLinearGradient(tx, ty, tx + tw, ty + th);
    gl.addColorStop(0, 'rgba(255,255,255,0.08)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(tx, ty, tw, th);
    return { photo, focus: hd.focus };
  });

  // ---- posters ----
  def('wanted', 'Wanted poster', 'Posters', [1200, 1650], (g, w, h, d) => {
    const r = d.r, m = 70;
    paperBg(g, w, h, '#e0cc9f', r, 1.4);
    g.fillStyle = '#3b2412';
    fitText(g, F.rye, L('p.wanted', 'WANTED'), w - 2 * m, 250);
    g.textAlign = 'center';
    g.fillText(L('p.wanted', 'WANTED'), w / 2, m + 150);
    g.textAlign = 'left';
    sc(g, F.rye, 40, 'FOR QUESTIONING', w / 2, m + 300, '#3b2412', 0.12, 'center');
    const pw = w * 0.62, ph = pw * 0.8, px = (w - pw) / 2;
    g.lineWidth = 8;
    g.strokeStyle = '#3b2412';
    g.strokeRect(px - 12, m + 350, pw + 24, ph + 24);
    g.globalCompositeOperation = 'multiply';
    const photo = pic(g, d.img, px, m + 362, pw, ph, 'sepia', r);
    const hd = head(g, d, F.rye, 64, m, m + 410 + ph, w - 2 * m, { upper: true, align: 'center', maxLines: 2, color: '#3b2412' });
    sc(g, F.rye, 110, 'REWARD', w / 2, m + 520 + ph + hd.h, '#3b2412', 0.06, 'center');
    sc(g, F.rye, 90, '$5,000', w / 2, m + 640 + ph + hd.h, '#3b2412', 0.04, 'center');
    g.globalCompositeOperation = 'source-over';
    [[40, 40], [w - 40, 40], [40, h - 40], [w - 40, h - 40]].forEach(([x, y]) => { g.fillStyle = '#555'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); });
    return { photo, focus: hd.focus };
  });

  // ---------- more WANTED posters ----------
  const L = (k, d) => (window.I18N ? I18N.t(k, d) : d);
  function parchment(g, x, y, w, h, r, burn = 1) {
    g.save();
    const poly = U.tornPoly(x, y, w, h, U.randInt(r, 1, 1e6), 6, 12);
    U.polyPath(g, poly);
    g.clip();
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, '#ecd9a8'); gr.addColorStop(0.5, '#e2c98c'); gr.addColorStop(1, '#d3b374');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
    for (let i = 0; i < 24; i++) {
      const sx = rand(r, x, x + w), sy = rand(r, y, y + h), rad = rand(r, 30, 200);
      const sp = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
      sp.addColorStop(0, `rgba(120,70,20,${rand(r, 0.04, 0.12)})`);
      sp.addColorStop(1, 'rgba(120,70,20,0)');
      g.fillStyle = sp;
      g.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.18;
    g.fillStyle = g.createPattern(U.grainTile(), 'repeat');
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
    const eg = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.hypot(w, h) * 0.55);
    eg.addColorStop(0, 'rgba(60,30,5,0)');
    eg.addColorStop(1, `rgba(60,30,5,${0.7 * burn})`);
    g.fillStyle = eg;
    g.fillRect(x, y, w, h);
    g.restore();
    return poly;
  }
  function stud(g, x, y, rad = 14) {
    const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 1, x, y, rad);
    gr.addColorStop(0, '#d9d2c4'); gr.addColorStop(0.6, '#6b665c'); gr.addColorStop(1, '#2b2924');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  function posterShadow(g, poly) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
    g.fillStyle = '#000';
    U.polyPath(g, poly);
    g.fill();
    g.restore();
  }
  const wBrown = '#3b2412';
  const WT = () => L('p.wanted', 'WANTED');
  const reward = (r) => pick(r, ['$5,000', '$15,000', '$50,000', '$100,000']);

  // 1. Dead or alive on a black burnt-edge board
  def('wanted2', 'Wanted · dead or alive', 'Posters', [1200, 1650], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('wood', w, h), 0, 0);
    const m = 70;
    const frame = U.tornPoly(m - 22, m - 22, w - 2 * m + 44, h - 2 * m + 44, U.randInt(r, 1, 1e6), 10, 16);
    posterShadow(g, frame);
    g.fillStyle = '#17120d';
    U.polyPath(g, frame); g.fill();
    parchment(g, m, m, w - 2 * m, h - 2 * m, r, 1.1);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = wBrown;
    fitText(g, F.rye, WT(), w - 2 * m - 120, 240);
    g.textAlign = 'center';
    g.fillText(WT(), w / 2, m + 160);
    g.textAlign = 'left';
    sc(g, F.rye, 42, '★  ' + L('p.deadalive', 'DEAD OR ALIVE') + '  ★', w / 2, m + 300, '#a3261b', 0.12, 'center');
    rule(g, m + 80, m + 340, w - 2 * m - 160, 4, wBrown);
    const bx = m + 110, bw = w - 2 * m - 220, bh = bw * 0.82, by = m + 380;
    g.strokeStyle = wBrown; g.lineWidth = 10; g.strokeRect(bx, by, bw, bh);
    const photo = pic(g, d.img, bx + 14, by + 14, bw - 28, bh - 28, 'sepia', r);
    const hd = head(g, d, F.rye, 74, m + 60, by + bh + 36, w - 2 * m - 120, { upper: true, align: 'center', maxLines: 2, color: wBrown });
    sc(g, F.rye, 60, L('p.reward', 'REWARD'), w / 2, by + bh + 70 + hd.h + 50, wBrown, 0.12, 'center');
    sc(g, F.rye, 88, reward(r), w / 2, by + bh + 70 + hd.h + 150, '#a3261b', 0.04, 'center');
    g.globalCompositeOperation = 'source-over';
    [[m + 40, m + 40], [w - m - 40, m + 40], [m + 40, h - m - 40], [w - m - 40, h - m - 40]].forEach(([x, y]) => stud(g, x, y));
    return { photo, focus: hd.focus };
  });

  // 2. Wooden board with details, like an old western notice
  def('wanted3', 'Wanted · western notice', 'Posters', [1200, 1650], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('wood', w, h), 0, 0);
    const m = 40;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, h);
    const pm = 110;
    const poly = U.tornPoly(pm, pm, w - 2 * pm, h - 2 * pm, U.randInt(r, 1, 1e6), 4, 10);
    posterShadow(g, poly);
    parchment(g, pm, pm, w - 2 * pm, h - 2 * pm, r, 0.55);
    g.globalCompositeOperation = 'multiply';
    const iw = w - 2 * pm - 100, ix = pm + 50;
    sc(g, F.play, 120, WT(), w / 2, pm + 120, wBrown, 0.05, 'center');
    g.fillStyle = wBrown;
    fitText(g, F.play, WT(), iw, 170);
    g.textAlign = 'center'; g.fillText(WT(), w / 2, pm + 110); g.textAlign = 'left';
    rule(g, ix, pm + 200, iw, 4, wBrown);
    const bw = iw * 0.62, bh = bw * 0.82, bx = (w - bw) / 2, by = pm + 240;
    g.lineWidth = 6; g.strokeStyle = wBrown; g.strokeRect(bx - 8, by - 8, bw + 16, bh + 16);
    const photo = pic(g, d.img, bx, by, bw, bh, 'sepia', r);
    const hd = head(g, d, F.ptB, 62, ix, by + bh + 34, iw, { upper: true, align: 'center', maxLines: 2, color: wBrown });
    let y = by + bh + 50 + hd.h;
    sc(g, F.pt, 26, L('p.forcrimes', 'FOR QUESTIONING IN THE MATTER OF THE LOST CHRONICLES'), w / 2, y, wBrown, 0.06, 'center');
    y += 30;
    lines(g, F.pt, 22, L('p.details', 'Known to be clever, quick on his feet and never seen twice in the same town. Approach with care. Anyone with information should report to the sheriff.'), ix + 20, y, iw - 40, wBrown, 1.4, 4, 'center');
    y += 150;
    g.font = font(F.pt, 22);
    g.fillStyle = wBrown;
    g.fillText(L('p.age', 'Age: mid-40s') + '     ' + L('p.height', 'Height: 6 ft') + '     ' + L('p.hair', 'Hair: dark brown'), ix + 40, y);
    sc(g, F.ptB, 64, L('p.reward', 'REWARD'), w / 2, y + 70, wBrown, 0.1, 'center');
    sc(g, F.ptB, 76, reward(r), w / 2, y + 150, '#8c1c13', 0.03, 'center');
    g.globalCompositeOperation = 'source-over';
    [[pm + 30, pm + 30], [w - pm - 30, pm + 30]].forEach(([x, yy]) => stud(g, x, yy, 12));
    return { photo, focus: hd.focus };
  });

  // 3. Ornamental frame with ribbon and big dollar amount
  def('wanted4', 'Wanted · ribbon', 'Posters', [1200, 1650], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('brick', w, h), 0, 0);
    const m = 60;
    const poly = U.tornPoly(m, m, w - 2 * m, h - 2 * m, U.randInt(r, 1, 1e6), 6, 12);
    posterShadow(g, poly);
    parchment(g, m, m, w - 2 * m, h - 2 * m, r, 0.9);
    g.globalCompositeOperation = 'multiply';
    g.strokeStyle = wBrown; g.lineWidth = 6;
    g.strokeRect(m + 30, m + 30, w - 2 * m - 60, h - 2 * m - 60);
    g.lineWidth = 2; g.strokeRect(m + 44, m + 44, w - 2 * m - 88, h - 2 * m - 88);
    g.fillStyle = wBrown;
    fitText(g, F.rye, WT(), w - 2 * m - 200, 220);
    g.textAlign = 'center'; g.fillText(WT(), w / 2, m + 170); g.textAlign = 'left';
    sc(g, F.rye, 34, L('p.deadalive', 'DEAD OR ALIVE'), w / 2, m + 290, wBrown, 0.28, 'center');
    const hd = head(g, d, F.ptB, 76, m + 80, m + 330, w - 2 * m - 160, { upper: true, align: 'center', maxLines: 2, color: wBrown });
    const by = m + 350 + hd.h, bw = w - 2 * m - 300, bh = bw * 0.78, bx = (w - bw) / 2;
    g.lineWidth = 5; g.strokeRect(bx - 10, by - 10, bw + 20, bh + 20);
    const photo = pic(g, d.img, bx, by, bw, bh, 'sepia', r);
    [[bx - 40, by - 40], [bx + bw + 40, by - 40], [bx - 40, by + bh + 40], [bx + bw + 40, by + bh + 40]].forEach(([x, y]) => stud(g, x, y, 13));
    sc(g, F.rye, 110, reward(r).replace(/,/g, ','), w / 2, by + bh + 130, wBrown, 0.02, 'center');
    // ribbon
    const ry = by + bh + 190;
    g.fillStyle = wBrown;
    g.beginPath();
    g.moveTo(m + 90, ry); g.lineTo(w - m - 90, ry); g.lineTo(w - m - 60, ry + 40); g.lineTo(w - m - 90, ry + 80); g.lineTo(m + 90, ry + 80); g.lineTo(m + 60, ry + 40); g.closePath(); g.fill();
    sc(g, F.rye, 52, L('p.reward', 'REWARD'), w / 2, ry + 42, '#ecd9a8', 0.3, 'center');
    g.globalCompositeOperation = 'source-over';
    return { photo, focus: hd.focus };
  });

  // 4. Blank template style: studs, framed photo box, name plate
  def('wanted5', 'Wanted · name plate', 'Posters', [1200, 1650], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('linen', w, h), 0, 0);
    const m = 60;
    const poly = U.tornPoly(m, m, w - 2 * m, h - 2 * m, U.randInt(r, 1, 1e6), 8, 14);
    posterShadow(g, poly);
    parchment(g, m, m, w - 2 * m, h - 2 * m, r, 0.8);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = wBrown;
    g.textAlign = 'center';
    fitText(g, F.rye, WT(), w - 2 * m - 240, 210);
    g.fillText(WT(), w / 2, m + 150);
    [m + 110, w - m - 110].forEach((x) => stud(g, x, m + 150, 20));
    g.textAlign = 'left';
    rule(g, m + 80, m + 260, w - 2 * m - 160, 3, wBrown);
    const hd = head(g, d, F.ptB, 80, m + 70, m + 290, w - 2 * m - 140, { upper: true, align: 'center', maxLines: 2, color: wBrown });
    const bw = w - 2 * m - 240, bh = bw * 0.78, bx = (w - bw) / 2, by = m + 320 + hd.h;
    g.lineWidth = 8; g.strokeStyle = wBrown; g.strokeRect(bx - 8, by - 8, bw + 16, bh + 16);
    const photo = pic(g, d.img, bx, by, bw, bh, 'sepia', r);
    const ny = by + bh + 50;
    g.lineWidth = 4;
    U.roundRect(g, m + 90, ny, w - 2 * m - 180, 90, 14); g.stroke();
    sc(g, F.rye, 36, L('p.deadalive', 'DEAD OR ALIVE'), w / 2, ny + 46, wBrown, 0.22, 'center');
    sc(g, F.rye, 74, reward(r).replace('$', '$ ') , w / 2, ny + 190, '#8c1c13', 0.03, 'center');
    sc(g, F.rye, 44, L('p.reward', 'REWARD'), w / 2, ny + 280, wBrown, 0.3, 'center');
    g.globalCompositeOperation = 'source-over';
    return { photo, focus: hd.focus };
  });

  // 5. Modern action-movie style WANTED poster
  def('wanted6', 'Wanted · action poster', 'Posters', [1200, 1700], (g, w, h, d) => {
    const r = d.r;
    g.fillStyle = '#0c0c0e';
    g.fillRect(0, 0, w, h);
    const photo = pic(g, d.img, 0, 260, w, h - 260, 'color', r);
    g.save();
    g.globalCompositeOperation = 'multiply';
    const gr = g.createLinearGradient(0, 260, 0, h);
    gr.addColorStop(0, 'rgba(230,140,20,0.6)'); gr.addColorStop(1, 'rgba(40,10,0,0.9)');
    g.fillStyle = gr; g.fillRect(0, 260, w, h - 260);
    g.restore();
    g.save();
    g.translate(w / 2, 170);
    g.rotate(-0.04);
    g.fillStyle = '#fff';
    fitText(g, F.anton, WT(), w - 120, 330);
    g.textAlign = 'center';
    g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#e6a100'; g.strokeText(WT(), 0, 20);
    g.fillText(WT(), 0, 20);
    g.restore();
    const hd = head(g, d, F.anton, 150, 70, h - 520, w - 140, { upper: true, color: '#ffe14a', maxLines: 2, lh: 0.98, stroke: '#000' });
    sc(g, F.interB, 30, L('p.deadalive', 'DEAD OR ALIVE') + '  ·  ' + L('p.reward', 'REWARD') + ' ' + reward(r), 70, h - 150, '#fff', 0.1);
    return { photo, focus: hd.focus };
  });

  def('missing', 'Missing poster', 'Posters', [1500, 1700], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('brick', w, h), 0, 0);
    const pw = 1000, ph = 1440, px = (w - pw) / 2, py = 120;
    g.save();
    g.translate(w / 2, py + ph / 2);
    g.rotate(rand(r, -0.02, 0.02));
    g.translate(-w / 2, -(py + ph / 2));
    shadowRect(g, px, py, pw, ph, 30);
    g.fillStyle = '#fbfbf8';
    g.fillRect(px, py, pw, ph);
    g.fillStyle = '#d7261e';
    fitText(g, F.anton, L('p.missing', 'MISSING'), pw - 80, 220);
    g.textAlign = 'center';
    g.fillText(L('p.missing', 'MISSING'), w / 2, py + 140);
    g.textAlign = 'left';
    const photo = pic(g, d.img, px + 100, py + 260, pw - 200, (pw - 200) * 0.75, 'color', r);
    const hd = head(g, d, F.interB, 58, px + 70, py + 300 + (pw - 200) * 0.75, pw - 140, { align: 'center', maxLines: 2 });
    lines(g, F.inter, 26, 'Last seen near the central market on Friday evening. If you have any information please call the number below.', px + 90, py + 360 + (pw - 200) * 0.75 + hd.h, pw - 180, '#222', 1.4, 3, 'center');
    // tear-off tabs
    for (let i = 0; i < 9; i++) {
      const x = px + 20 + i * ((pw - 40) / 9);
      g.strokeStyle = '#999'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(x, py + ph - 200); g.lineTo(x, py + ph); g.stroke(); g.setLineDash([]);
      g.save(); g.translate(x + 60, py + ph - 20); g.rotate(-Math.PI / 2);
      g.font = font(F.interM, 20); g.fillStyle = '#111'; g.fillText('Call 677 000 111', 0, 0); g.restore();
    }
    g.fillStyle = 'rgba(235,225,190,0.8)';
    g.fillRect(w / 2 - 90, py - 20, 180, 50);
    g.restore();
    return { photo, focus: hd.focus };
  });

  def('concert', 'Event poster', 'Posters', [1200, 1650], (g, w, h, d) => {
    const r = d.r;
    const pal = pick(r, [['#1b1464', '#ff3d7f', '#ffe14a'], ['#0b3d2e', '#ff7a00', '#f1f1e6'], ['#2b0f3a', '#00e5ff', '#ffe600']]);
    g.fillStyle = pal[0];
    g.fillRect(0, 0, w, h);
    const photo = pic(g, d.img, 80, 360, w - 160, 760, 'color', r);
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = pal[1];
    g.fillRect(80, 360, w - 160, 760);
    g.restore();
    g.fillStyle = pal[2];
    g.font = font(F.anton, 120);
    g.fillText('FRI 21 NOV', 80, 200);
    sc(g, F.interB, 32, 'LIVE · DOORS 8PM · ' + brand(d, 'THE WAREHOUSE').toUpperCase(), 80, 300, pal[2], 0.1);
    const hd = head(g, d, F.anton, 150, 80, 1150, w - 160, { upper: true, color: pal[2], maxLines: 2, lh: 0.98 });
    sc(g, F.interM, 26, 'TICKETS AT THE DOOR · 5000 FCFA', 80, 1190 + hd.h, pal[2], 0.12);
    return { photo, focus: hd.focus };
  });

  def('retro', 'Vintage poster', 'Posters', [1200, 1650], (g, w, h, d) => {
    const r = d.r;
    paperBg(g, w, h, '#efe0bd', r, 0.8);
    g.save();
    g.translate(w / 2, 720);
    g.fillStyle = 'rgba(200,90,40,0.28)';
    for (let i = 0; i < 32; i += 2) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1600, (i / 32) * Math.PI * 2, ((i + 1) / 32) * Math.PI * 2); g.fill(); }
    g.restore();
    g.save();
    g.beginPath(); g.arc(w / 2, 720, 360, 0, 7); g.clip();
    g.globalCompositeOperation = 'multiply';
    const photo = pic(g, d.img, w / 2 - 360, 360, 720, 720, 'sepia', r);
    g.restore();
    g.strokeStyle = '#9b2226'; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, 720, 366, 0, 7); g.stroke();
    g.globalCompositeOperation = 'multiply';
    const hd = head(g, d, F.play, 96, 80, 80, w - 160, { upper: true, align: 'center', maxLines: 2, color: '#9b2226' });
    // ribbon
    g.fillStyle = '#9b2226';
    g.fillRect(140, 1150, w - 280, 110);
    sc(g, F.play, 46, brand(d, 'GRAND OPENING').toUpperCase(), w / 2, 1206, '#efe0bd', 0.1, 'center');
    lines(g, F.old, 36, 'Come one, come all — music, food and celebration for the whole family', 120, 1340, w - 240, '#3b2412', 1.3, 3, 'center');
    g.globalCompositeOperation = 'source-over';
    return { photo, focus: hd.focus };
  });

  def('movie', 'Movie poster', 'Posters', [1200, 1750], (g, w, h, d) => {
    const r = d.r;
    g.fillStyle = '#050505';
    g.fillRect(0, 0, w, h);
    const photo = pic(g, d.img, 0, 0, w, h * 0.72, 'gloss', r);
    const gr = g.createLinearGradient(0, h * 0.4, 0, h * 0.72);
    gr.addColorStop(0, 'rgba(5,5,5,0)'); gr.addColorStop(1, 'rgba(5,5,5,1)');
    g.fillStyle = gr; g.fillRect(0, h * 0.4, w, h * 0.33);
    sc(g, F.interM, 22, 'FROM THE STUDIO THAT BROUGHT YOU NOTHING LIKE IT', w / 2, 70, '#ddd', 0.2, 'center');
    U.setLetterSpacing(g, 10);
    const hd = head(g, d, F.play, 110, 80, h * 0.7, w - 160, { upper: true, align: 'center', color: '#f2f2f2', maxLines: 2 });
    U.setLetterSpacing(g, 0);
    lines(g, F.serif, 32, 'Every story starts somewhere.', 80, h * 0.72 + hd.h + 40, w - 160, '#bbb', 1.3, 1, 'center');
    g.globalAlpha = 0.7;
    lines(g, F.frank, 16, 'A FILM BY ' + pick(r, C.bylines).toUpperCase() + ' · STARRING ' + C.bylines.slice(0, 4).join(' · ').toUpperCase() + ' · MUSIC BY ' + pick(r, C.bylines).toUpperCase() + ' · EDITED BY ' + pick(r, C.bylines).toUpperCase() + ' · PRODUCED BY ' + brand(d, 'CUTPRESS PICTURES').toUpperCase(), 140, h - 170, w - 280, '#ccc', 1.4, 4, 'center');
    g.globalAlpha = 1;
    sc(g, F.interB, 30, 'COMING SOON', w / 2, h - 50, '#fff', 0.3, 'center');
    return { photo, focus: hd.focus };
  });

  // ---- desk & objects ----
  def('corkboard', 'Pinboard', 'Desk & objects', [1700, 1200], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('cork', w, h), 0, 0);
    const pins = [];
    const pol = (x, y, s, rot, img) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      shadowRect(g, -s / 2, -s / 2, s, s * 1.18, 20);
      g.fillStyle = '#fafaf7'; g.fillRect(-s / 2, -s / 2, s, s * 1.18);
      pic(g, img, -s / 2 + s * 0.06, -s / 2 + s * 0.06, s * 0.88, s * 0.88, 'color', r);
      g.restore();
      pins.push([x, y - s / 2 + 14]);
    };
    pol(w * 0.18, h * 0.3, 300, -0.08, STOCK.get(r() * 99));
    pol(w * 0.2, h * 0.75, 260, 0.06, STOCK.get(r() * 99));
    const s = 520, x = w * 0.52, y = h * 0.48, rot = rand(r, -0.05, 0.05);
    g.save(); g.translate(x, y); g.rotate(rot);
    shadowRect(g, -s / 2, -s / 2, s, s * 1.18, 30);
    g.fillStyle = '#fafaf7'; g.fillRect(-s / 2, -s / 2, s, s * 1.18);
    g.restore();
    const photo = pic(g, d.img, x - s * 0.44, y - s * 0.44, s * 0.88, s * 0.88, 'color', r);
    pins.push([x, y - s / 2 + 14]);
    // index card note with the headline
    g.save(); g.translate(w * 0.84, h * 0.5); g.rotate(0.04);
    shadowRect(g, -200, -150, 400, 300, 16);
    g.fillStyle = '#fff6a8'; g.fillRect(-200, -150, 400, 300);
    const hd = head(g, d, F.marker, 46, -175, -120, 350, { maxLines: 4, color: '#1a2a6b', lh: 1.15 });
    g.restore();
    pins.push([w * 0.84, h * 0.5 - 136]);
    g.strokeStyle = '#c1121f'; g.lineWidth = 3;
    g.beginPath(); pins.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    pins.forEach(([px, py]) => { g.fillStyle = '#c1121f'; g.beginPath(); g.arc(px, py, 12, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(px - 4, py - 4, 4, 0, 7); g.fill(); });
    const f = hd.focus;
    const focus = f ? { x: w * 0.84 + f.x, y: h * 0.5 + f.y, w: f.w, h: f.h } : null;
    return { photo, focus };
  });

  def('bookcover', 'Book cover', 'Desk & objects', [1300, 1700], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('wood', w, h), 0, 0);
    const bw = 900, bh = 1360, bx = (w - bw) / 2, by = (h - bh) / 2;
    shadowRect(g, bx, by, bw + 20, bh, 50);
    g.fillStyle = '#f2efe8'; g.fillRect(bx + bw, by + 10, 18, bh - 20);
    g.fillStyle = '#1e2a3a'; g.fillRect(bx, by, bw, bh);
    const photo = pic(g, d.img, bx, by, bw, bh * 0.62, 'gloss', r);
    const hd = head(g, d, F.gara, 90, bx + 70, by + bh * 0.65, bw - 140, { maxLines: 3, color: '#f3ead8', align: 'center' });
    sc(g, F.gara, 40, pick(r, C.bylines).toUpperCase(), bx + bw / 2, by + bh - 110, '#d9b56b', 0.2, 'center');
    sc(g, F.gara, 22, 'A NOVEL', bx + bw / 2, by + bh * 0.65 - 20, '#d9b56b', 0.4, 'center');
    const sh = g.createLinearGradient(bx, 0, bx + 40, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(bx, by, 40, bh);
    return { photo, focus: hd.focus };
  });

  def('album', 'Record sleeve', 'Desk & objects', [1600, 1300], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('slate', w, h), 0, 0);
    const s = 1000, sx = 120, sy = (h - s) / 2;
    g.fillStyle = '#0d0d0d'; g.beginPath(); g.arc(sx + s * 0.78, h / 2, s * 0.48, 0, 7); g.fill();
    for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(255,255,255,${0.03 + (i % 3) * 0.01})`; g.beginPath(); g.arc(sx + s * 0.78, h / 2, s * (0.18 + i * 0.01), 0, 7); g.stroke(); }
    g.fillStyle = '#d7261e'; g.beginPath(); g.arc(sx + s * 0.78, h / 2, s * 0.15, 0, 7); g.fill();
    shadowRect(g, sx, sy, s, s, 40);
    const photo = pic(g, d.img, sx, sy, s, s, 'gloss', r);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(sx, sy + s - 230, s, 230);
    const hd = head(g, d, F.interB, 64, sx + 50, sy + s - 210, s - 100, { upper: true, color: '#fff', maxLines: 2 });
    sc(g, F.interM, 24, brand(d, 'SIDE A · 12" VINYL').toUpperCase(), sx + 50, sy + s - 40, '#fff', 0.2);
    return { photo, focus: hd.focus };
  });

  def('framed', 'Framed on wall', 'Desk & objects', [1700, 1200], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('wall', w, h), 0, 0);
    const fw = 900, fh = 720, fx = 220, fy = (h - fh) / 2;
    shadowRect(g, fx - 40, fy - 40, fw + 80, fh + 80, 50);
    g.fillStyle = '#1b1b1b'; g.fillRect(fx - 40, fy - 40, fw + 80, fh + 80);
    g.fillStyle = '#f7f5f0'; g.fillRect(fx, fy, fw, fh);
    const photo = pic(g, d.img, fx + 70, fy + 70, fw - 140, fh - 140, 'gloss', r);
    const lx = fx + fw + 120, lw = 380;
    shadowRect(g, lx, fy + fh - 300, lw, 300, 10, 'rgba(0,0,0,0.2)');
    g.fillStyle = '#fff'; g.fillRect(lx, fy + fh - 300, lw, 300);
    const hd = head(g, d, F.newsB, 44, lx + 30, fy + fh - 280, lw - 60, { maxLines: 3 });
    lines(g, F.inter, 18, `${pick(r, C.bylines)}, 2026. Photograph, archival pigment print.`, lx + 30, fy + fh - 250 + hd.h + 20, lw - 60, '#555', 1.4, 3);
    return { photo, focus: hd.focus };
  });

  def('photobooth', 'Photo booth strip', 'Desk & objects', [1300, 1700], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('linen', w, h), 0, 0);
    const sw = 520, sx = (w - sw) / 2 - 140, sy = 60, fh = 340;
    g.save(); g.translate(sx + sw / 2, h / 2); g.rotate(-0.04); g.translate(-(sx + sw / 2), -h / 2);
    shadowRect(g, sx, sy, sw, fh * 4 + 200, 30);
    g.fillStyle = '#fbfbf8'; g.fillRect(sx, sy, sw, fh * 4 + 200);
    let photo;
    for (let i = 0; i < 4; i++) {
      const c = U.makeCanvas(460, 300), cg = c.getContext('2d');
      const z = 1 + i * 0.15, iw = d.img.width, ih = d.img.height;
      const k = Math.max(460 / iw, 300 / ih) * z;
      cg.drawImage(d.img, (460 - iw * k) / 2 + rand(r, -30, 30), (300 - ih * k) / 2, iw * k, ih * k);
      const rr = pic(g, c, sx + 30, sy + 30 + i * (fh + 10), sw - 60, fh - 30, 'plate', r);
      if (i === 1) photo = rr;
    }
    g.restore();
    g.save(); g.translate(w * 0.72, h * 0.5); g.rotate(0.05);
    shadowRect(g, -190, -260, 380, 520, 16);
    g.fillStyle = '#fff'; g.fillRect(-190, -260, 380, 520);
    const hd = head(g, d, F.marker, 54, -160, -220, 320, { maxLines: 5, color: '#c1121f', lh: 1.15 });
    g.restore();
    const f = hd.focus;
    return { photo, focus: f ? { x: w * 0.72 + f.x, y: h * 0.5 + f.y, w: f.w, h: f.h } : null };
  });

  def('badge', 'Press badge', 'Desk & objects', [1300, 1700], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface('slate', w, h), 0, 0);
    g.fillStyle = '#c1121f';
    g.fillRect(w / 2 - 50, 0, 100, 300);
    const bw = 760, bh = 1120, bx = (w - bw) / 2, by = 330;
    g.fillStyle = '#999'; g.fillRect(w / 2 - 40, 280, 80, 70);
    shadowRect(g, bx, by, bw, bh, 40);
    g.fillStyle = '#fff'; U.roundRect(g, bx, by, bw, bh, 30); g.fill();
    g.fillStyle = '#c1121f'; g.fillRect(bx, by + 60, bw, 170);
    sc(g, F.anton, 130, 'PRESS', w / 2, by + 150, '#fff', 0.2, 'center');
    const photo = pic(g, d.img, bx + 160, by + 270, bw - 320, (bw - 320) * 1.1, 'gloss', r);
    const hd = head(g, d, F.interB, 56, bx + 60, by + 300 + (bw - 320) * 1.1, bw - 120, { align: 'center', maxLines: 2 });
    sc(g, F.interM, 24, brand(d, 'ACCESS ALL AREAS').toUpperCase(), w / 2, by + bh - 150, '#c1121f', 0.2, 'center');
    barcode(g, w / 2 - 150, by + bh - 110, 300, 50, r);
    return { photo, focus: hd.focus };
  });

  // ---------- historic front pages (dense, aged, folded) ----------
  const NAMES = ['The Daily Chronicle', 'The Evening Courier', 'The Morning Ledger', 'The Weekly Sentinel', 'The Harbour Times', 'The Coastal Gazette', 'The Central Post', 'The Daily Dispatch', 'The Evening Tribune', 'The City Herald'];
  const ADS = [
    ['FRESH BREAD', 'EVERY MORNING', 'Central Bakery — Market St.'], ['TONIGHT', 'AT THE PALACE', 'Two shows · 7 and 9 p.m.'], ['SAVE MORE', 'MERIDIAN BANK', '3% on all deposits'],
    ['RADIO SETS', 'EASY TERMS', 'Harbour Electric Co.'], ['DRINK KOLA', 'ICE COLD', 'Sold everywhere'], ['NEW HATS', 'FOR SPRING', 'Orchid Outfitters'], ['SHOES MENDED', 'WHILE YOU WAIT', 'Riverside Cobblers'],
  ];
  const headlineish = (r) => {
    const w = pick(r, C.news).replace(/[.,;:"]/g, '').split(' ');
    return w.slice(0, U.randInt(r, 3, 6)).join(' ').toUpperCase();
  };
  const fragment = (r, n = 10) => pick(r, C.news).split(' ').slice(0, n).join(' ').replace(/[.,]$/, '');

  // Text squeezed horizontally, like the condensed headline type of old papers.
  function condBlock(g, spec, size, text, x, y, w, o = {}) {
    const { cond = 0.78, align = 'center', color = '#1d1c1a', maxLines = 4, lh = 1.02, style = '' } = o;
    g.font = font(spec, size, style);
    const ls = U.wrapLines(g, text, w / cond).slice(0, maxLines);
    g.fillStyle = color;
    ls.forEach((l, i) => {
      const lw = PP.measure(g, l) * cond;
      const lx = align === 'center' ? x + (w - lw) / 2 : x;
      g.save();
      g.translate(lx, y + i * size * lh + size * 0.5);
      g.scale(cond, 1);
      g.fillText(l, 0, 0);
      g.restore();
    });
    return ls.length * size * lh;
  }
  function crease(g, x, y, len, vertical, strength = 1) {
    const t = 26;
    const gr = vertical ? g.createLinearGradient(x - t, 0, x + t, 0) : g.createLinearGradient(0, y - t, 0, y + t);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.46, `rgba(60,40,10,${0.16 * strength})`);
    gr.addColorStop(0.5, `rgba(255,255,240,${0.32 * strength})`);
    gr.addColorStop(0.56, `rgba(0,0,0,${0.06 * strength})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    if (vertical) g.fillRect(x - t, y, t * 2, len);
    else g.fillRect(x, y - t, len, t * 2);
  }
  // Age the paper: yellow edges, foxing spots, fold creases, torn edges.
  function age(g, w, h, r, amt) {
    g.save();
    g.globalCompositeOperation = 'multiply';
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(1, `rgba(150,95,30,${0.45 * amt})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40 * amt; i++) {
      const x = rand(r, 0, w), y = rand(r, 0, h), rad = rand(r, 3, 26);
      const sp = g.createRadialGradient(x, y, 0, x, y, rad);
      sp.addColorStop(0, `rgba(140,90,30,${rand(r, 0.1, 0.3)})`);
      sp.addColorStop(1, 'rgba(140,90,30,0)');
      g.fillStyle = sp;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 3 * amt; i++) {
      const x = rand(r, 0, w), y = rand(r, 0, h), rad = rand(r, 80, 260);
      const st = g.createRadialGradient(x, y, rad * 0.7, x, y, rad);
      st.addColorStop(0, `rgba(160,110,40,${0.05 * amt})`);
      st.addColorStop(0.92, `rgba(130,80,25,${0.12 * amt})`);
      st.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = st;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.restore();
    crease(g, 0, h * rand(r, 0.47, 0.53), w, false, 0.6 + amt * 0.5);
    if (r() < 0.5) crease(g, w * rand(r, 0.48, 0.52), 0, h, true, 0.4 + amt * 0.3);
    // torn / worn edges
    g.save();
    g.globalCompositeOperation = 'destination-in';
    const pts = U.tornPoly(3, 3, w - 6, h - 6, U.randInt(r, 1, 1e6), 2 + amt * 4, 9);
    if (amt > 0.8 && r() < 0.6) {
      // a missing corner
      const k = U.randInt(r, 0, 3), cx = k % 2 ? w : 0, cy = k > 1 ? h : 0, s = rand(r, 40, 110);
      for (const p of pts) if (Math.abs(p[0] - cx) + Math.abs(p[1] - cy) < s) { p[0] += (cx ? -1 : 1) * s * 0.5; p[1] += (cy ? -1 : 1) * s * 0.5; }
    }
    U.polyPath(g, pts);
    g.fillStyle = '#000';
    g.fill();
    g.restore();
  }

  const ERAS = {
    1910: { paper: '#e2cea4', aged: 1.3, ink: '#2b2116', mast: F.black, banner: ['Old Standard TT', 700], bannerSize: 92, cols: 8, photo: 'sepia', deckA: ['Old Standard TT', 700], deckB: ['Old Standard TT', 400], body: P_OLD, bs: 14, price: 'ONE CENT' },
    1930: { paper: '#e8d9b6', aged: 1, ink: '#221c16', mast: F.black, banner: ['Oswald', 700], bannerSize: 130, cols: 7, photo: 'halftone', deckA: ['Oswald', 700], deckB: ['Playfair Display', 400], deckStyle: 'italic', body: pub(F.oldR, { ink: '#221c16', lh: 1.25 }), bs: 15, price: 'TWO CENTS' },
    1960: { paper: '#ebe5d3', aged: 0.6, ink: '#1a1a1a', mast: ['Playfair Display', 700], banner: ['Anton', 400], bannerSize: 150, cols: 6, photo: 'halftone', deckA: ['Oswald', 700], deckB: F.serif, deckStyle: 'italic', body: P_NEWS, bs: 16, price: '10 CENTS' },
    modern: { paper: '#f0efea', aged: 0.2, ink: '#161616', mast: ['Playfair Display', 700], banner: F.frankB, bannerSize: 110, cols: 6, photo: 'color', deckA: F.frankB, deckB: F.serif, deckStyle: 'italic', body: P_NEWS, bs: 16, price: '500 FCFA' },
  };

  function storyColumn(g, E, r, x, y, w, yEnd, allowAd) {
    let first = true;
    while (y < yEnd - 120) {
      if (!first) { rule(g, x, y, w, 2, E.ink); y += 14; }
      first = false;
      y += condBlock(g, E.deckA, rand(r, 28, 36), headlineish(r), x, y, w, { color: E.ink, maxLines: 3 }) + 6;
      rule(g, x + w * 0.3, y, w * 0.4, 1, E.ink);
      y += 10;
      y += condBlock(g, E.deckB, 19, fragment(r, 9), x, y, w, { color: E.ink, cond: 0.92, maxLines: 3, style: E.deckStyle || '', lh: 1.15 }) + 8;
      if (r() < 0.22 && yEnd - y > w * 1.3) {
        pic(g, STOCK.get(r() * 99), x, y, w, w * 0.78, E.photo === 'color' ? 'halftone' : E.photo, r);
        y += w * 0.78 + 4;
        y += condBlock(g, E.deckA, 13, fragment(r, 7).toUpperCase(), x, y, w, { color: E.ink, cond: 0.85, maxLines: 2 }) + 8;
      }
      if (allowAd && r() < 0.35 && yEnd - y > 330) {
        const ad = pick(r, ADS), ah = 170, ay = yEnd - ah;
        PP.textColumn(g, E.body, rng(U.hash(r() * 1e9)), x, y, ay - 16, w, E.bs);
        g.strokeStyle = E.ink; g.lineWidth = 3; g.strokeRect(x + 2, ay, w - 4, ah - 4);
        g.lineWidth = 1; g.strokeRect(x + 8, ay + 6, w - 16, ah - 16);
        condBlock(g, E.deckA, 30, ad[0], x, ay + 22, w, { color: E.ink });
        condBlock(g, ['Playfair Display', 700], 26, ad[1], x, ay + 62, w, { color: E.ink, cond: 0.85 });
        condBlock(g, E.deckB, 15, ad[2], x, ay + 110, w, { color: E.ink, cond: 0.95 });
        return;
      }
      const len = rand(r, 160, 460);
      PP.textColumn(g, E.body, rng(U.hash(r() * 1e9)), x, y, Math.min(y + len, yEnd), w, E.bs);
      y += len + 12;
    }
  }

  function histFront(g, w, h, d, E, extra) {
    const r = d.r, m = 34, ink = E.ink;
    paperBg(g, w, h, E.paper, r, E.aged * 0.5);
    g.globalCompositeOperation = 'multiply';
    // ears
    const earW = 210, earH = 118;
    g.strokeStyle = ink; g.lineWidth = 2;
    g.strokeRect(m, m, earW, earH);
    condBlock(g, E.deckA, 22, pick(r, ['LATE CITY EDITION', 'HOME EDITION', 'NIGHT FINAL']), m, m + 10, earW, { color: ink });
    condBlock(g, E.deckB, 15, 'Weather: Fair and warmer today; showers tonight.', m + 10, m + 44, earW - 20, { color: ink, cond: 0.95, maxLines: 3, lh: 1.2 });
    g.strokeRect(w - m - earW, m, earW, earH);
    condBlock(g, E.deckA, 44, extra ? 'EXTRA' : 'FINAL', w - m - earW, m + 12, earW, { color: ink });
    condBlock(g, E.deckB, 16, '★ ★ ★  ' + E.price, w - m - earW, m + 74, earW, { color: ink, cond: 0.95 });
    // masthead
    const name = d.brand || pick(r, NAMES);
    g.fillStyle = ink;
    const ms = fitText(g, E.mast, name, w - 2 * m - 2 * earW - 40, 120);
    g.textAlign = 'center';
    g.fillText(name, w / 2, m + earH / 2 + 4);
    g.textAlign = 'left';
    let y = m + earH + 16;
    rule(g, m, y, w - 2 * m, 4, ink); rule(g, m, y + 7, w - 2 * m, 1.5, ink);
    g.font = font(E.deckB, 17);
    g.fillStyle = ink;
    g.fillText(`VOL. ${pick(r, ['LX', 'LXXII', 'CXII', 'XCI'])}—No. ${U.randInt(r, 10, 29)},${U.randInt(r, 100, 999)}`, m, y + 26);
    g.textAlign = 'center'; g.fillText(dateTxt().toUpperCase(), w / 2, y + 26);
    g.textAlign = 'right'; g.fillText(E.price + ' · ' + pick(r, ['32 PAGES', '24 PAGES', '48 PAGES']), w - m, y + 26);
    g.textAlign = 'left';
    rule(g, m, y + 42, w - 2 * m, 1.5, ink);
    y += 56;
    if (extra) {
      y += condBlock(g, ['Oswald', 700], 210, 'EXTRA', m, y, w - 2 * m, { color: ink, cond: 1, lh: 0.95 }) + 6;
    }
    const hd = head(g, d, E.banner, E.bannerSize, m, y, w - 2 * m, { upper: true, align: 'center', maxLines: 2, color: ink, lh: 1 });
    y += hd.h + 8;
    rule(g, m, y, w - 2 * m, 2, ink);
    y += 14;
    // second banner deck across the page
    y += condBlock(g, E.deckB, 34, fragment(r, 12), m, y, w - 2 * m, { color: ink, cond: 0.9, maxLines: 1, style: E.deckStyle || '' }) + 10;
    rule(g, m, y, w - 2 * m, 1, ink);
    y += 12;
    // columns
    const n = E.cols, gut = 14, cw = (w - 2 * m - gut * (n - 1)) / n;
    const colX = (i) => m + i * (cw + gut);
    const pc = extra ? n - 2 : Math.max(3, Math.round(n * 0.5)), ps = extra ? 1 : U.randInt(r, 1, n - pc - 1);
    const px = colX(ps), pw = pc * cw + (pc - 1) * gut, ph = pw * rand(r, 0.62, 0.78);
    const photo = pic(g, d.img, px, y, pw, ph, E.photo, r);
    g.strokeStyle = ink; g.lineWidth = 1.5; g.strokeRect(px - 3, y - 3, pw + 6, ph + 6);
    g.font = font(E.deckB, 12, 'italic'); g.textAlign = 'right'; g.fillText('—Staff Photo', px + pw, y + ph + 14); g.textAlign = 'left';
    let cy = y + ph + 22;
    cy += condBlock(g, E.deckA, 22, (d.caption || fragment(r, 12)).toUpperCase(), px, cy, pw, { color: ink, cond: 0.82, maxLines: 2, lh: 1.1 }) + 10;
    for (let i = 0; i < n; i++) {
      const x = colX(i);
      if (i >= ps && i < ps + pc) storyColumn(g, E, r, x, cy, cw, h - m, false);
      else storyColumn(g, E, r, x, y, cw, h - m, i === 0 || i === n - 1);
      if (i) { g.fillStyle = ink; g.globalAlpha = 0.55; g.fillRect(x - gut / 2, (i > ps && i < ps + pc) ? cy : y, 1.2, h - m - y); g.globalAlpha = 1; }
    }
    g.globalCompositeOperation = 'source-over';
    age(g, w, h, r, E.aged);
    return { photo, focus: hd.focus };
  }
  def('hist1910', '1910s front page', 'Old front pages', [1300, 1760], (g, w, h, d) => histFront(g, w, h, d, ERAS[1910], false));
  def('hist1930', '1930s front page', 'Old front pages', [1300, 1760], (g, w, h, d) => histFront(g, w, h, d, ERAS[1930], false));
  def('extra', 'EXTRA edition', 'Old front pages', [1300, 1760], (g, w, h, d) => histFront(g, w, h, d, ERAS[1930], true));
  def('hist1960', '1960s front page', 'Old front pages', [1300, 1760], (g, w, h, d) => histFront(g, w, h, d, ERAS[1960], false));
  def('morning', 'Modern front page', 'Old front pages', [1300, 1760], (g, w, h, d) => histFront(g, w, h, d, ERAS.modern, false));

  // ---- red-top tabloid cover ----
  const TABS = ['THE SCOOP', 'DAILY FLASH', 'THE BUGLE', 'THE INSIDER', 'SUNDAY SPLASH'];
  function redtop(g, w, h, d) {
    const r = d.r, m = 26;
    paperBg(g, w, h, '#f4f4f1', r);
    const red = pick(r, ['#e10600', '#d7261e', '#c4001a']);
    g.fillStyle = red;
    g.fillRect(m, m, w * 0.58, 230);
    g.fillStyle = '#fff';
    fitText(g, F.anton, d.brand ? d.brand.toUpperCase() : pick(r, TABS), w * 0.58 - 40, 150);
    g.fillText(d.brand ? d.brand.toUpperCase() : pick(r, TABS), m + 20, m + 118);
    // promo strip with small pictures
    const sx = m + w * 0.58 + 14, sw = w - m - sx;
    for (let i = 0; i < 2; i++) {
      const yy = m + i * 118;
      pic(g, STOCK.get(r() * 99), sx, yy, sw * 0.42, 108, 'color', r);
      condBlock(g, F.anton, 30, pick(r, ['FREE TV GUIDE', 'WIN A CAR!', '20 PAGES OF SPORT', 'PLUS: RECIPES']), sx + sw * 0.45, yy + 20, sw * 0.55, { color: i ? red : '#111', cond: 0.95, maxLines: 2 });
    }
    const photo = pic(g, d.img, m, m + 250, w - 2 * m, h * 0.52, 'color', r);
    // flash
    g.save(); g.translate(w - m - 130, m + 380); g.rotate(0.15);
    g.fillStyle = '#ffd400'; U.starPath(g, 0, 0, 16, 120, 92, r); g.fill();
    condBlock(g, F.anton, 34, 'WORLD', -90, -44, 180, { color: '#111', cond: 0.9 });
    condBlock(g, F.anton, 34, 'EXCLUSIVE', -90, -4, 180, { color: red, cond: 0.9 });
    g.restore();
    // headline on black band
    const by = m + 250 + h * 0.52 - 40;
    g.fillStyle = '#111';
    g.fillRect(m, by, w - 2 * m, h - by - m - 160);
    const hd = head(g, d, F.anton, 170, m + 20, by + 16, w - 2 * m - 40, { upper: true, color: '#fff', maxLines: 2, lh: 0.98 });
    condBlock(g, F.frankB, 34, (d.caption || fragment(r, 10)).toUpperCase(), m + 20, by + 26 + hd.h, w - 2 * m - 40, { color: '#ffd400', cond: 0.85, maxLines: 2, align: 'left' });
    // bottom puffs
    const py = h - m - 150, pwid = (w - 2 * m - 20) / 3;
    for (let i = 0; i < 3; i++) {
      pic(g, STOCK.get(r() * 99), m + i * (pwid + 10), py, pwid * 0.45, 140, 'color', r);
      condBlock(g, F.anton, 26, headlineish(r), m + i * (pwid + 10) + pwid * 0.48, py + 6, pwid * 0.5, { color: '#111', cond: 0.85, maxLines: 4, align: 'left' });
    }
    age(g, w, h, r, 0.15);
    return { photo, focus: hd.focus };
  }
  def('redtop', 'Red-top tabloid', 'Old front pages', [1250, 1700], redtop);

  // ---- scenes made of several papers ----
  function renderSub(fn, size, d, seed) {
    const c = U.makeCanvas(size[0], size[1]), sg = c.getContext('2d');
    sg.textBaseline = 'middle';
    const res = fn(sg, size[0], size[1], Object.assign({}, d, { r: rng(seed) })) || {};
    return { c, res };
  }
  function placeOnto(g, sub, cx, cy, rot, k) {
    const { c } = sub;
    g.save();
    g.translate(cx, cy); g.rotate(rot); g.scale(k, k);
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
    g.drawImage(c, -c.width / 2, -c.height / 2);
    g.restore();
    const map = (rr) => {
      if (!rr) return null;
      const u = rr.x + rr.w / 2 - c.width / 2, v = rr.y + rr.h / 2 - c.height / 2;
      return { x: cx + (u * Math.cos(rot) - v * Math.sin(rot)) * k - (rr.w * k) / 2, y: cy + (u * Math.sin(rot) + v * Math.cos(rot)) * k - (rr.h * k) / 2, w: rr.w * k, h: rr.h * k };
    };
    return { photo: map(sub.res.photo), focus: map(sub.res.focus) };
  }
  const randomPaper = (r) => {
    const opts = [(g, w, h, dd) => histFront(g, w, h, dd, ERAS[1910], false), (g, w, h, dd) => histFront(g, w, h, dd, ERAS[1930], r() < 0.3), (g, w, h, dd) => histFront(g, w, h, dd, ERAS[1960], false), redtop];
    return pick(r, opts);
  };
  // A real scanned old front page, aged and torn like the generated ones.
  function scanSub(r) {
    const sc = window.STOCK && STOCK.scan(r() * 999);
    if (!sc) return null;
    const w = 1300, h = Math.round((1300 * sc.height) / sc.width);
    const c = U.makeCanvas(w, h), sg = c.getContext('2d');
    sg.drawImage(sc, 0, 0, w, h);
    age(sg, w, h, rng(U.randInt(r, 1, 1e9)), 0.8);
    return { c, res: {} };
  }
  const fillerSub = (d, r, fn, size) => (r() < 0.7 && scanSub(r)) || renderSub(fn, size, otherD(d, r), U.randInt(r, 1, 1e9));
  const otherD = (d, r) => ({ mode: 'photo', img: STOCK.get(r() * 99), headline: headlineish(r), caption: '', brand: null, o: d.o });

  def('pile', 'Pile of newspapers', 'Old front pages', [2000, 1500], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface(pick(r, ['wood', 'slate', 'linen']), w, h), 0, 0);
    for (let i = 0; i < 3; i++) {
      const sub = fillerSub(d, r, randomPaper(r), [1300, 1760]);
      placeOnto(g, sub, w * rand(r, 0.25, 0.75), h * rand(r, 0.3, 0.7), rand(r, -0.5, 0.5), 0.72);
    }
    const top = renderSub(randomPaper(r), [1300, 1760], d, U.randInt(r, 1, 1e9));
    return placeOnto(g, top, w * 0.5, h * 0.52, rand(r, -0.12, 0.12), 0.78);
  });

  def('archive', 'Archive table', 'Old front pages', [2200, 1500], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface(pick(r, ['wood', 'linen']), w, h), 0, 0);
    for (let i = 0; i < 4; i++) {
      const sub = fillerSub(d, r, randomPaper(r), [1300, 1760]);
      placeOnto(g, sub, w * (0.15 + i * 0.23) + rand(r, -60, 60), h * rand(r, 0.35, 0.65), rand(r, -0.25, 0.25), 0.62);
    }
    const top = renderSub(pick(r, [(gg, ww, hh, dd) => histFront(gg, ww, hh, dd, ERAS[1910], false), (gg, ww, hh, dd) => histFront(gg, ww, hh, dd, ERAS[1930], false)]), [1300, 1760], d, U.randInt(r, 1, 1e9));
    return placeOnto(g, top, w * rand(r, 0.4, 0.6), h * 0.5, rand(r, -0.08, 0.08), 0.74);
  });

  def('fan', 'Newsstand spread', 'Old front pages', [2000, 1500], (g, w, h, d) => {
    const r = d.r;
    g.drawImage(surface(pick(r, ['slate', 'wood']), w, h), 0, 0);
    const spots = [[0.2, 0.28], [0.5, 0.22], [0.8, 0.3], [0.18, 0.75], [0.82, 0.72], [0.5, 0.82]];
    for (const [sx, sy] of spots) {
      const sub = fillerSub(d, r, r() < 0.5 ? redtop : randomPaper(r), [1250, 1700]);
      placeOnto(g, sub, w * sx, h * sy, rand(r, -0.35, 0.35), 0.48);
    }
    const top = renderSub(r() < 0.6 ? redtop : randomPaper(r), [1250, 1700], d, U.randInt(r, 1, 1e9));
    return placeOnto(g, top, w * 0.5, h * 0.5, rand(r, -0.1, 0.1), 0.62);
  });

  // ---------- camera ----------
  let PAGE = null, FRAME = null;
  const buf = (c, W, H) => (!c || c.width !== W || c.height !== H ? U.makeCanvas(W, H) : c);
  const SURFACES = ['wood', 'linen', 'slate', 'desk', 'wood', 'cork'];

  function renderTemplate(ctx, W, H, key, seed, d, o) {
    const tp = typeof key === 'string' ? T[key] : key;
    const r = rng(seed);
    const [pw, ph] = tp.size;
    PAGE = buf(PAGE, pw, ph);
    const g = PAGE.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, pw, ph);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    U.setLetterSpacing(g, 0);
    const res = tp.draw(g, pw, ph, Object.assign({}, d, { r: rng(seed + 1), o })) || {};
    g.globalCompositeOperation = 'source-over';
    U.setLetterSpacing(g, 0);

    // camera
    const unit = Math.min(W, H);
    const word = d.mode === 'word' && res.focus;
    const a = word ? res.focus : res.photo || { x: pw * 0.3, y: ph * 0.3, w: pw * 0.4, h: ph * 0.4 };
    const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
    let s, tx, ty, rot, k;
    if (word) {
      s = (unit * rand(r, 0.085, 0.11) * o.textScale) / a.h;
      tx = W / 2; ty = H / 2;
      rot = rand(r, -1, 1) * 0.03;
      k = r() < 0.5 ? rand(r, -0.12, 0.12) : 0;
    } else {
      const wide = r() < (pw > 1900 ? 0.55 : 0.2);
      if (wide) s = Math.min(W / pw, H / ph) * rand(r, 0.9, 1.1);
      else s = Math.min((W * rand(r, 0.7, 1.3)) / a.w, (H * 1.0) / a.h);
      tx = W * rand(r, 0.36, 0.64); ty = H * rand(r, 0.38, 0.62);
      if (wide) { tx = W / 2 + (acx - pw / 2) * s; ty = H / 2 + (acy - ph / 2) * s; }
      rot = rand(r, -1, 1) * (r() < 0.3 ? 0.2 : 0.08);
      k = r() < 0.65 ? rand(r, -0.4, 0.4) : 0;
    }
    const cos = Math.cos(rot) * s, sin = Math.sin(rot) * s;
    const M = (u, v) => {
      const x = (u - acx) * cos - (v - acy) * sin + tx;
      const y = (u - acx) * sin + (v - acy) * cos + ty;
      const f = 1 + (k * (y - ty)) / H;
      return { x: tx + (x - tx) * f, y };
    };
    FRAME = buf(FRAME, W, H);
    const fg = FRAME.getContext('2d');
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.drawImage(surface(pick(r, SURFACES), W, H), 0, 0);
    // page shadow
    const corners = [M(0, 0), M(pw, 0), M(pw, ph), M(0, ph)];
    fg.save();
    fg.shadowColor = 'rgba(0,0,0,0.5)';
    fg.shadowBlur = unit * 0.05;
    fg.shadowOffsetY = unit * 0.015;
    fg.fillStyle = '#000';
    U.polyPath(fg, corners.map((p) => [p.x, p.y]));
    fg.fill();
    fg.restore();
    // page, drawn in thin strips when tilted (perspective)
    if (Math.abs(k) < 1e-3) {
      fg.setTransform(cos, sin, -sin, cos, tx - acx * cos + acy * sin, ty - acx * sin - acy * cos);
      fg.drawImage(PAGE, 0, 0);
    } else {
      const hs = Math.max(1, 2.5 / s);
      for (let v = 0; v < ph; v += hs) {
        const TL = M(0, v), TR = M(pw, v), BL = M(0, v + hs);
        const minY = Math.min(TL.y, TR.y, BL.y), maxY = Math.max(TL.y, TR.y, BL.y);
        if (maxY < -10 || minY > H + 10) continue;
        fg.setTransform((TR.x - TL.x) / pw, (TR.y - TL.y) / pw, (BL.x - TL.x) / hs, (BL.y - TL.y) / hs, TL.x, TL.y);
        fg.drawImage(PAGE, 0, v, pw, Math.min(hs + 0.8, ph - v), 0, 0, pw, Math.min(hs + 0.8, ph - v));
      }
    }
    fg.setTransform(1, 0, 0, 1, 0, 0);
    const band = Math.max(unit * 0.06, a.h * s * (word ? 1.2 : 0.6));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    PP.depthOfField(ctx, FRAME, W, H, ty, band, (o.dof ?? 1) * (word ? 0.9 : 0.5 + Math.abs(k) * 1.6));
    PP.lighting(ctx, W, H, r, false);
    ctx.restore();
  }

  window.TEMPLATES = { T, keys: Object.keys(T), renderTemplate };
})();
