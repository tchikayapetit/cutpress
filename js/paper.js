/* Realistic print renderer. Each frame is a close-up of a real-looking page (newspaper, magazine,
   book, report, memo…) set in proper typography with real sentences, paper texture, ink, lighting
   and depth-of-field blur. The focus word (or the photo) always sits at the same spot on screen. */
(function () {
  const { rng, pick, rand } = U;
  const C = window.CORPUS;

  const PUBS = {
    broadsheet: {
      name: 'Newspaper', paper: ['#f3f1ea', '#efede6'], ink: '#1d1c1a', body: ['Source Serif 4', 400], head: ['Playfair Display', 700],
      kick: ['Libre Franklin', 700], accent: '#1d1c1a', lh: 1.32, justify: true, rules: true, corpus: 'news', mast: 'The Morning Ledger', mastFont: ['UnifrakturMaguntia', 400],
      shots: { body: 5, headline: 3, quote: 2 }, photo: 'halftone',
    },
    magazine: {
      name: 'Magazine', paper: ['#fbfaf7', '#f9f7f2'], ink: '#161616', body: ['Newsreader', 400], head: ['Bodoni Moda', 700], headStyle: 'italic',
      kick: ['Inter', 600], accents: ['#c8102e', '#1f6f78', '#b5651d'], lh: 1.45, justify: false, corpus: 'magazine', mast: 'MODE', mastFont: ['Bodoni Moda', 900],
      shots: { body: 4, headline: 3, quote: 4 }, photo: 'gloss', kickSpacing: 0.18,
    },
    oldpress: {
      name: 'Old newspaper', paper: ['#e9dcc0', '#e4d5b4'], ink: '#2a2118', body: ['Old Standard TT', 400], head: ['Old Standard TT', 700], headUpper: true,
      kick: ['Old Standard TT', 700], lh: 1.24, justify: true, rules: true, corpus: 'news', mast: 'The Evening Courier', mastFont: ['UnifrakturMaguntia', 400],
      shots: { body: 5, headline: 4, quote: 1 }, photo: 'sepia', aged: true,
    },
    tabloid: {
      name: 'Tabloid', paper: ['#f6f6f3', '#f1f1ee'], ink: '#141414', body: ['Libre Franklin', 400], head: ['Anton', 400], headUpper: true, headMul: 1.15,
      kick: ['Libre Franklin', 800], accent: '#d7261e', lh: 1.32, justify: false, corpus: 'news', mast: 'THE DAILY FLASH', mastFont: ['Anton', 400],
      shots: { body: 3, headline: 5, quote: 2 }, photo: 'color', banner: true,
    },
    finance: {
      name: 'Business paper', paper: ['#f4e1d2', '#f1dccb'], ink: '#1e1a17', body: ['PT Serif', 400], head: ['PT Serif', 700],
      kick: ['Inter', 700], accent: '#1e1a17', lh: 1.3, justify: true, rules: true, corpus: 'finance', mast: 'The Market Journal', mastFont: ['PT Serif', 700],
      shots: { body: 5, headline: 3, quote: 1 }, photo: 'halftone', tables: true,
    },
    book: {
      name: 'Book page', paper: ['#f6f0e3', '#f3ecdc'], ink: '#1f1b16', body: ['EB Garamond', 400], head: ['EB Garamond', 500],
      kick: ['EB Garamond', 500], lh: 1.45, justify: true, corpus: 'book', mast: 'Chapter One', mastFont: ['EB Garamond', 500],
      shots: { body: 7, headline: 2, quote: 0 }, photo: 'plate', single: true, bodyMul: 1.05,
    },
    report: {
      name: 'Report', paper: ['#fbfbfa', '#f7f7f5'], ink: '#1b1f24', body: ['IBM Plex Sans', 400], head: ['IBM Plex Sans', 600],
      kick: ['IBM Plex Sans', 600], accent: '#1f5fbf', lh: 1.5, justify: false, corpus: 'report', mast: 'Annual Report 2026', mastFont: ['IBM Plex Sans', 600],
      shots: { body: 4, headline: 4, quote: 2 }, photo: 'color', bodyMul: 0.92,
    },
    memo: {
      name: 'Typed memo', paper: ['#f5f2e9', '#f1ede2'], ink: '#24211c', body: ['Courier Prime', 400], head: ['Courier Prime', 700],
      kick: ['Courier Prime', 700], accent: '#b3261e', lh: 1.5, justify: false, corpus: 'memo', mast: 'MEMORANDUM', mastFont: ['Courier Prime', 700],
      shots: { body: 5, headline: 3, quote: 0 }, photo: 'print', typed: true, bodyMul: 0.95,
    },
  };

  const font = (spec, size, style = '') => `${style} ${spec[1]} ${Math.max(1, size).toFixed(1)}px "${spec[0]}", Georgia, serif`;
  const weightedPick = (r, map) => {
    const e = Object.entries(map).filter(([, w]) => w > 0);
    let t = r() * e.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of e) if ((t -= w) <= 0) return k;
    return e[0][0];
  };

  // ---------- paper ----------
  const texCache = new Map();
  function paperTexture(pubKey, variant, W, H) {
    const key = `${pubKey}|${variant}|${W}x${H}`;
    if (texCache.has(key)) return texCache.get(key);
    if (texCache.size > 24) texCache.delete(texCache.keys().next().value);
    const pub = PUBS[pubKey];
    const r = rng(U.hash(key));
    const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
    const c = U.makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = pub.paper[variant % pub.paper.length];
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = rand(r, 0, w), y = rand(r, 0, h), rad = rand(r, 0.08, 0.45) * Math.max(w, h);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() < 0.55;
      gr.addColorStop(0, dark ? `rgba(90,70,40,${pub.aged ? 0.05 : 0.022})` : 'rgba(255,255,255,0.04)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    g.strokeStyle = 'rgba(60,50,30,0.05)';
    g.lineWidth = 0.6;
    for (let i = 0; i < (w * h) / 900; i++) {
      const x = rand(r, 0, w), y = rand(r, 0, h), a = rand(r, 0, Math.PI), l = rand(r, 2, 7);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rand(r, -1, 1), y + Math.sin(a) * l * 0.5 + rand(r, -1, 1), x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    if (pub.aged) {
      for (let i = 0; i < 6; i++) {
        const x = rand(r, 0, w), y = rand(r, 0, h), rad = rand(r, 0.03, 0.12) * w;
        const gr = g.createRadialGradient(x, y, rad * 0.6, x, y, rad);
        gr.addColorStop(0, 'rgba(150,110,50,0.05)');
        gr.addColorStop(0.9, 'rgba(130,90,40,0.1)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }
    }
    // fine grain
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = pub.aged ? 0.1 : 0.05;
    g.fillStyle = g.createPattern(U.grainTile(), 'repeat');
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    texCache.set(key, c);
    return c;
  }

  // ---------- text layout ----------
  const mCache = new Map();
  const measure = (g, s) => {
    const k = g.font + '|' + s;
    let v = mCache.get(k);
    if (v === undefined) {
      v = g.measureText(s).width;
      if (mCache.size > 20000) mCache.clear();
      mCache.set(k, v);
    }
    return v;
  };
  const words = (str) => str.split(/\s+/).filter(Boolean);

  // Sentence stream from a corpus, starting at a random place, with paragraph marks.
  function stream(r, corpusKey, nWords) {
    const src = C[corpusKey];
    let i = Math.floor(r() * src.length);
    const toks = [];
    let sinceBreak = 0, nextBreak = U.randInt(r, 2, 4);
    while (toks.length < nWords) {
      const ws = words(src[i++ % src.length]);
      ws.forEach((t, j) => toks.push({ t, para: j === 0 && sinceBreak === 0 && toks.length > 0 }));
      if (++sinceBreak >= nextBreak) { sinceBreak = 0; nextBreak = U.randInt(r, 2, 4); }
    }
    return toks;
  }

  // Wraps the phrase in a sentence template; returns tokens with the focus word flagged.
  function phraseTokens(tpl, parts, upper) {
    const up = (s) => (upper ? s.toUpperCase() : s);
    const [pre, post = ''] = tpl.split('{X}');
    const preW = words(pre);
    let lead = '';
    if (pre && !/\s$/.test(pre) && preW.length) lead = preW.pop();
    const postW = words(post);
    let trail = '';
    if (post && !/^\s/.test(post) && postW.length) trail = postW.shift();
    const ph = parts.before.concat(parts.focus, parts.after);
    const fi = parts.before.length;
    const toks = preW.map((t) => ({ t: up(t) }));
    ph.forEach((t, i) => toks.push({ t: up(t), pre: i === 0 ? lead : '', suf: i === ph.length - 1 ? trail : '', ph: true, f: i === fi }));
    postW.forEach((t) => toks.push({ t: up(t) }));
    return toks;
  }

  function flow(g, toks, colW, firstIndent = 0) {
    const sp = measure(g, ' ');
    const lines = [];
    let cur = [], w = 0, indent = 0;
    const push = (last) => { if (cur.length) lines.push({ toks: cur, last, indent }); cur = []; w = 0; };
    for (const tk of toks) {
      tk.w = measure(g, (tk.pre || '') + tk.t + (tk.suf || ''));
      if (tk.para && cur.length) { push(true); }
      if (!cur.length) indent = tk.para ? firstIndent : 0;
      const add = cur.length ? sp + tk.w : tk.w;
      if (cur.length && w + add > colW - indent) push(false);
      if (!cur.length) indent = tk.para ? firstIndent : indent;
      cur.push(tk);
      w += cur.length > 1 ? sp + tk.w : tk.w;
    }
    push(true);
    return { lines, sp };
  }
  function lineXs(line, colW, sp, justify, align = 'left') {
    const n = line.toks.length;
    const natural = line.toks.reduce((a, t) => a + t.w, 0) + sp * (n - 1);
    const avail = colW - line.indent;
    let gap = sp, x = line.indent;
    if (justify && !line.last && n > 1 && natural > avail * 0.75) gap = sp + (avail - natural) / (n - 1);
    else if (align === 'center') x += (avail - natural) / 2;
    const xs = [];
    for (const t of line.toks) { xs.push(x); x += t.w + gap; }
    return xs;
  }
  function focusIn(lines, g, sp, colW, justify, align) {
    for (let i = 0; i < lines.length; i++) {
      const j = lines[i].toks.findIndex((t) => t.f);
      if (j >= 0) {
        const xs = lineXs(lines[i], colW, sp, justify, align);
        const tk = lines[i].toks[j];
        const preW = tk.pre ? measure(g, tk.pre) : 0;
        const ww = measure(g, tk.t);
        return { li: i, x: xs[j] + preW, w: ww };
      }
    }
    return { li: 0, x: 0, w: 0 };
  }

  // Draws lines of a column; skips lines outside the view.
  function drawLines(g, P, lines, sp, x0, yOf, colW, opts) {
    const { justify, align = 'left', color, aged, hl } = opts;
    const H = g.canvas.height;
    lines.forEach((ln, i) => {
      const y = yOf(i);
      if (y < -opts.size * 2 || y > H + opts.size * 2) return;
      const xs = lineXs(ln, colW, sp, justify, align);
      ln.toks.forEach((tk, j) => {
        const x = x0 + xs[j];
        if (tk.f && hl) {
          const preW = tk.pre ? measure(g, tk.pre) : 0;
          hl(x + preW, y, measure(g, tk.t));
        }
        g.globalAlpha = aged ? 0.72 + ((U.hash(tk.t, i, j) % 100) / 100) * 0.28 : 0.94;
        g.fillStyle = color;
        g.fillText((tk.pre || '') + tk.t + (tk.suf || ''), x, y);
      });
    });
    g.globalAlpha = 1;
  }

  // ---------- highlighter ----------
  function highlight(g, kind, color, x, y, w, s, r) {
    g.save();
    if (kind === 'pen') {
      g.strokeStyle = color;
      g.lineWidth = Math.max(1.5, s * 0.06);
      g.lineCap = 'round';
      g.globalAlpha = 0.9;
      g.beginPath();
      const yy = y + s * 0.5;
      g.moveTo(x - s * 0.05, yy + rand(r, -1, 1));
      for (let k = 1; k <= 8; k++) g.lineTo(x + (w * k) / 8, yy + Math.sin(k * 1.7) * s * 0.03);
      g.stroke();
      g.globalAlpha = 0.6;
      g.beginPath();
      g.moveTo(x, yy + s * 0.1);
      g.lineTo(x + w * 0.95, yy + s * 0.08);
      g.stroke();
    } else if (kind === 'circle') {
      g.strokeStyle = color;
      g.lineWidth = Math.max(1.5, s * 0.055);
      g.globalAlpha = 0.9;
      g.lineCap = 'round';
      U.roughEllipse(g, x + w / 2, y, w / 2 + s * 0.35, s * 0.72, r, 2);
    } else {
      // translucent highlighter with slightly uneven edges and a darker streak
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = color;
      g.globalAlpha = 0.88;
      const top = y - s * 0.6, bot = y + s * 0.47, l = x - s * 0.1, rt = x + w + s * 0.1;
      g.beginPath();
      g.moveTo(l + rand(r, -1, 1) * s * 0.03, top + rand(r, 0, 1) * s * 0.04);
      g.lineTo(rt + rand(r, -1, 1) * s * 0.04, top + rand(r, -1, 1) * s * 0.03);
      g.lineTo(rt + rand(r, -1, 1) * s * 0.04, bot + rand(r, -1, 1) * s * 0.03);
      g.lineTo(l + rand(r, -1, 1) * s * 0.03, bot + rand(r, -1, 0) * s * 0.04);
      g.closePath();
      g.fill();
      g.globalAlpha = 0.12;
      g.fillRect(l, bot - s * 0.12, rt - l, s * 0.08);
    }
    g.restore();
  }

  // ---------- shared page furniture ----------
  function dateLine() {
    const d = new Date();
    return d.toLocaleDateString(window.I18N ? I18N.locale() : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function smallCaps(g, spec, size, text, x, y, color, spacing = 0.08, align = 'left') {
    g.font = font(spec, size);
    U.setLetterSpacing(g, size * spacing);
    g.fillStyle = color;
    g.textAlign = align;
    g.fillText(text, x, y);
    g.textAlign = 'left';
    U.setLetterSpacing(g, 0);
  }
  function hRule(g, x, y, w, t, color) {
    g.fillStyle = color;
    g.fillRect(x, y, w, Math.max(1, t));
  }
  // A column of small body text between y0 and y1.
  function textColumn(g, P, r, x, y0, y1, colW, bs, opts = {}) {
    if (x > g.canvas.width || x + colW < 0 || y1 < 0 || y0 > g.canvas.height) return;
    const lh = bs * P.lh;
    // a news photo with caption somewhere in the column
    if (opts.allowPhoto && window.STOCK && r() < 0.45 && y1 - y0 > colW * 1.2) {
      const ph = colW * U.rand(r, 0.55, 0.8);
      const py = y0 + U.rand(r, 0, Math.max(0, y1 - y0 - ph - bs * 3));
      const top = Math.round((py - y0) / lh) * lh + y0;
      const op = Object.assign({}, opts, { allowPhoto: false });
      if (top - y0 > lh) textColumn(g, P, r, x, y0, top - bs * 0.6, colW, bs, op);
      const prev = g.globalCompositeOperation;
      g.globalCompositeOperation = 'source-over';
      drawPhoto(g, P.photo === 'print' ? Object.assign({}, P, { photo: 'color' }) : P, STOCK.get(r() * 1000), { x, y: top, w: colW, h: ph }, r);
      g.globalCompositeOperation = prev;
      const cs = bs * 0.8;
      g.font = font(P.body, cs, 'italic');
      g.fillStyle = P.ink;
      g.fillText(pick(r, C.decks).split(' ').slice(0, 7).join(' ') + '.', x, top + ph + cs * 0.9, colW);
      textColumn(g, P, r, x, top + ph + cs * 2, y1, colW, bs, op);
      return;
    }
    const n = Math.max(1, Math.floor((y1 - y0) / lh));
    g.font = font(P.body, bs);
    if (P.tables && opts.allowTable && r() < 0.5) {
      // stock listing
      g.font = font(['Inter', 400], bs * 0.85);
      for (let i = 0; i < n; i++) {
        const y = y0 + i * lh + lh / 2;
        if (y > g.canvas.height + lh) break;
        const name = C.tickers[(U.hash(x | 0, i) % C.tickers.length)];
        const v = ((U.hash(name, i) % 9000) / 100 + 1).toFixed(2);
        const ch = (((U.hash(i, name) % 600) - 300) / 100).toFixed(2);
        g.fillStyle = P.ink;
        g.globalAlpha = 0.9;
        g.textAlign = 'left';
        g.fillText(name, x, y);
        g.textAlign = 'right';
        g.fillText(v, x + colW * 0.78, y);
        g.fillText((ch > 0 ? '+' : '') + ch, x + colW, y);
        g.textAlign = 'left';
        if (i % 5 === 4) hRule(g, x, y + lh / 2, colW, 0.6, 'rgba(0,0,0,0.25)');
      }
      g.globalAlpha = 1;
      return;
    }
    const toks = stream(r, P.corpus, Math.ceil(n * (colW / (bs * 2.6)) * 1.25) + 10);
    if (opts.startPara) toks[0].para = true;
    const { lines, sp } = flow(g, toks, colW, P.justify ? bs * 1.1 : 0);
    if (opts.dropCap && lines.length > 3) {
      // drop cap: enlarge first letter over three lines
      const first = lines[0].toks[0];
      const ch = first.t[0];
      first.t = first.t.slice(1);
      g.save();
      g.font = font(P.head, lh * 2.9);
      g.fillStyle = opts.accent || P.ink;
      g.textBaseline = 'alphabetic';
      g.fillText(ch, x, y0 + lh * 2.75);
      const dw = measure(g, ch) + bs * 0.3;
      g.restore();
      g.font = font(P.body, bs);
      for (let k = 0; k < 3; k++) lines[k].indent = dw;
    }
    drawLines(g, P, lines.slice(0, n), sp, x, (i) => y0 + i * lh + lh / 2, colW, { justify: P.justify, color: P.ink, aged: P.aged, size: bs });
  }
  function articleHeader(g, P, r, x, yBottom, colW, bs, accent) {
    // Draws a small headline + byline that ends at yBottom (used above columns).
    const hs = bs * rand(r, 1.9, 2.6);
    g.font = font(P.head, hs, P.headStyle || '');
    const txt = pick(r, C[P.corpus === 'news' || P.corpus === 'finance' ? 'news' : P.corpus]).split(' ').slice(0, U.randInt(r, 4, 8)).join(' ').replace(/[.,]$/, '');
    const { lines, sp } = flow(g, words(P.headUpper ? txt.toUpperCase() : txt).map((t) => ({ t })), colW);
    const lh = hs * 1.1;
    const top = yBottom - lines.length * lh - bs * 2.2;
    drawLines(g, P, lines, sp, x, (i) => top + i * lh + lh / 2, colW, { justify: false, color: P.ink, size: hs });
    smallCaps(g, P.kick, bs * 0.75, ('By ' + pick(r, C.bylines)).toUpperCase(), x, yBottom - bs * 0.8, accent || P.ink, 0.06);
    return top;
  }

  function pageHeader(g, P, r, x, y, w, bs, brand) {
    // running header line with publication name, date and page number
    hRule(g, x, y + bs * 0.7, w, Math.max(1, bs * 0.06), P.ink);
    const name = (brand || P.mast).toUpperCase();
    smallCaps(g, P.kick, bs * 0.72, name, x, y, P.ink, 0.12);
    smallCaps(g, P.kick, bs * 0.72, `${dateLine().toUpperCase()}   ${U.randInt(r, 2, 38)}`, x + w, y, P.ink, 0.08, 'right');
  }

  // ---------- shots ----------
  function shotBody(g, W, H, P, r, parts, o) {
    const unit = Math.min(W, H);
    const s = unit * rand(r, 0.078, 0.11) * o.textScale * (P.bodyMul || 1);
    g.font = font(P.body, s);
    const one = parts.before.length + parts.after.length === 0;
    const tpl = one && r() < 0.6 ? pick(r, C.wordTemplates) : pick(r, C.quoteTemplates);
    const ph = phraseTokens(tpl, parts, o.upper);
    const fw = measure(g, ph.find((t) => t.f).t);
    const colW = Math.max(s * rand(r, 12, 19), fw + s * 4);
    const lh = s * P.lh;
    const need = Math.ceil(H / 2 / lh) + 3;
    const wpl = colW / (s * 2.7);
    const pre = stream(r, P.corpus, Math.ceil(need * wpl * 1.3));
    const post = stream(r, P.corpus, Math.ceil(need * wpl * 1.3));
    if (r() < 0.5) ph[0].para = true;
    const all = pre.concat(ph, post);
    const { lines, sp } = flow(g, all, colW, P.justify ? s * 1.2 : 0);
    const f = focusIn(lines, g, sp, colW, P.justify);
    const colX = W / 2 - (f.x + f.w / 2);
    const cy = H / 2;
    const yOf = (i) => cy + (i - f.li) * lh;
    // optional start of article (headline) a few lines above the focus line
    let firstLine = 0;
    if (!P.single && r() < 0.35) {
      firstLine = Math.max(0, f.li - U.randInt(r, 3, 7));
      articleHeader(g, P, r, colX, yOf(firstLine) - lh * 0.6, colW, s * 0.9, P.accent);
    }
    if (P.single) {
      // book page: running head above, page number below
      firstLine = Math.max(0, f.li - U.randInt(r, 4, 14));
      smallCaps(g, P.body, s * 0.62, pick(r, C.bookTitles), colX + colW / 2, yOf(firstLine) - lh * 1.8, P.ink, 0.18, 'center');
      const last = Math.min(lines.length - 1, f.li + U.randInt(r, 5, 16));
      smallCaps(g, P.body, s * 0.7, String(U.randInt(r, 12, 340)), colX + colW / 2, yOf(last) + lh * 2, P.ink, 0, 'center');
      lines.length = last + 1;
    }
    const hl = (x, y, w) => highlight(g, o.hlKind, o.hlColor, x, y, w, s, r);
    g.font = font(P.body, s);
    g.globalCompositeOperation = 'multiply';
    drawLines(g, P, lines.slice(firstLine), sp, colX, (i) => yOf(i + firstLine), colW, { justify: P.justify, color: P.ink, aged: P.aged, size: s, hl });
    g.globalCompositeOperation = 'source-over';
    // neighbouring columns
    if (!P.single) {
      const gut = s * 1.4;
      const top = yOf(0) - lh, bottom = H + lh;
      for (let k = 1; k <= 3; k++) {
        const lx = colX - k * (colW + gut), rx = colX + colW + gut + (k - 1) * (colW + gut);
        const cr = rng(U.hash(r() * 1e9));
        g.globalCompositeOperation = 'multiply';
        if (lx + colW > 0) textColumn(g, P, cr, lx, Math.min(top, -lh), bottom, colW, s, { allowTable: true, allowPhoto: true });
        if (rx < W) textColumn(g, P, cr, rx, Math.min(top, -lh), bottom, colW, s, { allowTable: true, allowPhoto: true });
        g.globalCompositeOperation = 'source-over';
        if (P.rules) {
          g.globalAlpha = 0.5;
          g.fillStyle = P.ink;
          if (lx + colW > -gut) g.fillRect(lx + colW + gut / 2, -10, 1, H + 20);
          if (rx < W + gut) g.fillRect(rx - gut / 2, -10, 1, H + 20);
          g.globalAlpha = 1;
        }
      }
    }
    return { cy, band: lh * 1.3 };
  }

  function shotHeadline(g, W, H, P, r, parts, o) {
    const unit = Math.min(W, H);
    const hs = unit * rand(r, 0.105, 0.13) * o.textScale * (P.headMul || 1);
    const bs = unit * rand(r, 0.026, 0.032) * (P.bodyMul || 1);
    const nPh = parts.before.length + parts.after.length + 1;
    const tpl = nPh > 4 ? '{X}' : pick(r, P.single ? ['{X}'] : C.headlines);
    const upper = P.headUpper || o.upper;
    const toks = phraseTokens(tpl, parts, upper);
    g.font = font(P.head, hs, P.headStyle || '');
    const fw = measure(g, toks.find((t) => t.f).t);
    const hw = Math.max(W * rand(r, 0.72, 1.0), fw + hs * 2);
    const center = P.single || P.corpus === 'memo' ? false : P.corpus === 'magazine' && r() < 0.4;
    const { lines, sp } = flow(g, toks, hw);
    const f = focusIn(lines, g, sp, hw, false, center ? 'center' : 'left');
    const bx = W / 2 - (f.x + f.w / 2);
    const lh = hs * (upper ? 1.02 : 1.1);
    const cy = H / 2;
    const top = cy - f.li * lh - lh / 2;
    const bottom = cy + (lines.length - f.li) * lh - lh / 2;
    const accent = P.accent || (P.accents ? pick(r, P.accents) : P.ink);
    // kicker / banner / chapter label
    if (P.single) {
      smallCaps(g, P.body, bs * 1.1, 'CHAPTER ' + pick(r, ['SEVEN', 'TWELVE', 'THREE', 'NINE', 'FOUR']), bx, top - bs * 1.6, P.ink, 0.25);
    } else if (P.corpus === 'memo') {
      g.font = font(P.body, bs * 1.2);
      g.fillStyle = P.ink;
      ['MEMORANDUM', '', 'TO:    All department heads', 'FROM:  Office of the Director', 'DATE:  ' + dateLine()].forEach((t, i) => g.fillText(t, bx, top - bs * (9.5 - i * 1.7)));
      g.font = font(P.head, hs * 0.5);
      g.fillText('RE:', bx, top - bs * 0.2);
    } else if (P.banner) {
      const kt = pick(r, C.kickers);
      g.font = font(P.kick, bs * 1.1);
      const kw = measure(g, kt) + bs * 1.4;
      g.fillStyle = accent;
      g.fillRect(bx, top - bs * 2.6, kw, bs * 1.9);
      smallCaps(g, P.kick, bs * 1.1, kt, bx + bs * 0.7, top - bs * 1.25, '#ffffff', 0.04);
    } else {
      smallCaps(g, P.kick, bs * 0.85, pick(r, C.kickers), bx, top - bs * 1.3, accent, P.kickSpacing || 0.1);
      if (P.rules) hRule(g, bx, top - bs * 3.2, hw, Math.max(1, bs * 0.1), P.ink);
    }
    if (!P.single && P.corpus !== 'memo') pageHeader(g, P, r, bx, top - bs * 6.5, Math.min(hw * 1.4, W * 1.3), bs, o.brand);
    // headline
    const hl = (x, y, w) => highlight(g, o.hlKind, o.hlColor, x, y, w, hs, r);
    g.font = font(P.head, hs, P.headStyle || '');
    g.globalCompositeOperation = 'multiply';
    drawLines(g, P, lines, sp, bx, (i) => cy + (i - f.li) * lh, hw, { justify: false, align: center ? 'center' : 'left', color: P.ink, aged: P.aged, size: hs, hl });
    g.globalCompositeOperation = 'source-over';
    // deck + byline
    let y = bottom + hs * 0.35;
    if (!P.single) {
      const ds = hs * 0.4;
      g.font = font(P.body, ds, 'italic');
      const deck = flow(g, words(pick(r, C.decks)).map((t) => ({ t })), hw * 0.92);
      g.globalCompositeOperation = 'multiply';
      drawLines(g, P, deck.lines.slice(0, 3), deck.sp, bx, (i) => y + ds * 0.7 + i * ds * 1.3, hw * 0.92, { justify: false, color: P.ink, size: ds });
      g.globalCompositeOperation = 'source-over';
      y += Math.min(3, deck.lines.length) * ds * 1.3 + ds * 0.6;
      smallCaps(g, P.kick, bs * 0.72, `BY ${pick(r, C.bylines).toUpperCase()}, ${pick(r, C.roles).toUpperCase()}`, bx, y + bs * 0.6, P.ink, 0.06);
      y += bs * 2;
    }
    // body columns under the headline, and the previous article to the left
    const gut = bs * 1.4;
    const cw = bs * rand(r, 13, 17);
    g.globalCompositeOperation = 'multiply';
    for (let k = 0; k < 6; k++) {
      const x = bx + k * (cw + gut);
      if (x > W) break;
      textColumn(g, P, rng(U.hash(r() * 1e9)), x, y, H + bs * 2, cw, bs, { startPara: true, dropCap: k === 0 && P.corpus === 'magazine', accent, allowTable: k > 0, allowPhoto: k > 0 });
      if (P.rules && k > 0) { g.fillStyle = P.ink; g.globalAlpha = 0.45; g.fillRect(x - gut / 2, y, 1, H); g.globalAlpha = 1; }
    }
    for (let k = 1; k <= 4; k++) {
      const x = bx - k * (cw + gut);
      if (x + cw < 0) break;
      textColumn(g, P, rng(U.hash(r() * 1e9)), x, -bs * 2, H + bs * 2, cw, bs, { allowTable: true, allowPhoto: true });
      if (P.rules) { g.fillStyle = P.ink; g.globalAlpha = 0.45; g.fillRect(x + cw + gut / 2, -5, 1, H + 10); g.globalAlpha = 1; }
    }
    // above the page header: the bottom of the previous page section
    const hdrTop = top - bs * 8.5;
    if (hdrTop > 0 && !P.single) {
      hRule(g, bx - W, hdrTop + bs * 0.4, W * 3, 1, 'rgba(0,0,0,0.35)');
      for (let k = 0; k < 6; k++) textColumn(g, P, rng(U.hash(r() * 1e9)), bx + (k - 2) * (cw + gut), hdrTop - H, hdrTop - bs * 0.6, cw, bs);
    }
    g.globalCompositeOperation = 'source-over';
    return { cy, band: (lines.length * lh) / 2 + hs * 0.8 };
  }

  function shotQuote(g, W, H, P, r, parts, o) {
    const unit = Math.min(W, H);
    const qs = unit * rand(r, 0.08, 0.1) * o.textScale;
    const bs = unit * rand(r, 0.026, 0.032) * (P.bodyMul || 1);
    const spec = P.corpus === 'magazine' ? P.head : [P.body[0], 400];
    const toks = phraseTokens(pick(r, C.pullQuotes), parts, o.upper);
    g.font = font(spec, qs, 'italic');
    const fw = measure(g, toks.find((t) => t.f).t);
    const qw = Math.max(W * rand(r, 0.55, 0.82), fw + qs * 2);
    const { lines, sp } = flow(g, toks, qw);
    const f = focusIn(lines, g, sp, qw, false);
    const bx = W / 2 - (f.x + f.w / 2);
    const lh = qs * 1.2, cy = H / 2;
    const top = cy - f.li * lh - lh / 2, bottom = cy + (lines.length - f.li) * lh - lh / 2;
    const accent = P.accent || (P.accents ? pick(r, P.accents) : P.ink);
    hRule(g, bx, top - qs * 0.45, qw, Math.max(1, qs * 0.035), accent);
    hRule(g, bx, bottom + qs * 0.4, qw, Math.max(1, qs * 0.035), accent);
    const hl = (x, y, w) => highlight(g, o.hlKind, o.hlColor, x, y, w, qs, r);
    g.font = font(spec, qs, 'italic');
    g.globalCompositeOperation = 'multiply';
    drawLines(g, P, lines, sp, bx, (i) => cy + (i - f.li) * lh, qw, { justify: false, color: P.corpus === 'magazine' ? accent : P.ink, size: qs, hl });
    smallCaps(g, P.kick, bs * 0.8, `— ${pick(r, C.bylines).toUpperCase()}`, bx, bottom + qs * 0.4 + bs * 1.8, P.ink, 0.08);
    // surrounding body text
    const gut = bs * 1.4;
    textColumn(g, P, rng(U.hash(r() * 1e9)), bx, -bs * 2, top - qs * 0.9, qw, bs);
    textColumn(g, P, rng(U.hash(r() * 1e9)), bx, bottom + qs * 0.4 + bs * 3.2, H + bs * 2, qw, bs);
    for (let k = 1; k <= 4; k++) {
      const cw = qw;
      const rx = bx + k * (cw + gut), lx = bx - k * (cw + gut);
      if (rx < W) textColumn(g, P, rng(U.hash(r() * 1e9)), rx, -bs * 2, H + bs * 2, cw, bs);
      if (lx + cw > 0) textColumn(g, P, rng(U.hash(r() * 1e9)), lx, -bs * 2, H + bs * 2, cw, bs);
    }
    g.globalCompositeOperation = 'source-over';
    return { cy, band: (lines.length * lh) / 2 + qs * 0.6 };
  }

  // ---------- photos ----------
  let imgId = 1;
  const photoCache = new Map();
  function coverCrop(img, w, h) {
    const c = U.makeCanvas(w, h), g = c.getContext('2d');
    const k = Math.max(w / img.width, h / img.height);
    g.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k);
    return c;
  }
  function treatPhoto(img, kind, w, h) {
    if (!img._cpId) img._cpId = imgId++;
    w = Math.round(w); h = Math.round(h);
    const key = `${img._cpId}|${kind}|${w}x${h}`;
    if (photoCache.has(key)) return photoCache.get(key);
    if (photoCache.size > 30) photoCache.delete(photoCache.keys().next().value);
    const c = coverCrop(img, w, h), g = c.getContext('2d');
    const d = g.getImageData(0, 0, w, h), p = d.data;
    if (kind === 'halftone' || kind === 'sepia') {
      // clustered-dot screen at 45°, like newsprint
      const period = Math.max(2.6, w / (kind === 'sepia' ? 120 : 170));
      const k = (Math.PI * 2) / period, cs = Math.SQRT1_2;
      const ink = kind === 'sepia' ? [58, 40, 24] : [28, 27, 26];
      for (let y = 0, i = 0; y < h; y++)
        for (let x = 0; x < w; x++, i += 4) {
          let L = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
          L = U.clamp((L - 0.5) * 1.15 + 0.53, 0, 1);
          const u = (x * cs - y * cs) * k, v = (x * cs + y * cs) * k;
          const t = Math.cos(u) * Math.cos(v) * 0.5 + 0.5;
          const cov = U.clamp((1 - L - t) / 0.18 + 0.5, 0, 1);
          p[i] = ink[0]; p[i + 1] = ink[1]; p[i + 2] = ink[2];
          p[i + 3] = cov * 240;
        }
    } else if (kind === 'plate') {
      for (let i = 0; i < p.length; i += 4) {
        const L = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        p[i] = Math.min(255, L * 0.95 + 18); p[i + 1] = Math.min(255, L * 0.9 + 14); p[i + 2] = Math.min(255, L * 0.8 + 8);
      }
    } else if (kind === 'color') {
      for (let i = 0; i < p.length; i += 4) {
        for (let c2 = 0; c2 < 3; c2++) p[i + c2] = U.clamp((p[i + c2] - 128) * 1.12 + 132, 0, 255);
      }
    } else if (kind === 'print') {
      for (let i = 0; i < p.length; i += 4) for (let c2 = 0; c2 < 3; c2++) p[i + c2] = p[i + c2] * 0.88 + 22;
    }
    g.putImageData(d, 0, 0);
    if (kind === 'gloss') {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, 'rgba(255,255,255,0.10)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    photoCache.set(key, c);
    return c;
  }
  // Where the photo sits on screen; identical for every frame so the cut matches.
  function photoBox(W, H, img) {
    const ar = U.clamp(img ? img.width / img.height : 1.4, 0.7, 1.6);
    let w = W * (W > H ? 0.5 : 0.8);
    let h = w / ar;
    const maxH = H * (W > H ? 0.6 : 0.44);
    if (h > maxH) { h = maxH; w = h * ar; }
    return { x: (W - w) / 2, y: H * 0.53 - h / 2, w, h };
  }
  function drawPhoto(g, P, img, b, r) {
    const kind = P.photo;
    const ph = treatPhoto(img, kind, b.w, b.h);
    if (kind === 'print') {
      const m = b.w * 0.03;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.25)';
      g.shadowBlur = b.w * 0.03;
      g.shadowOffsetY = b.w * 0.01;
      g.fillStyle = '#fbfbf8';
      g.fillRect(b.x - m, b.y - m, b.w + 2 * m, b.h + 2 * m);
      g.restore();
      g.drawImage(ph, b.x, b.y, b.w, b.h);
      g.fillStyle = 'rgba(235,225,190,0.75)';
      for (const [tx, ty, a] of [[b.x - m, b.y - m, -0.6], [b.x + b.w + m, b.y - m, 0.6]]) {
        g.save(); g.translate(tx, ty); g.rotate(a);
        g.fillRect(-b.w * 0.09, -b.w * 0.025, b.w * 0.18, b.w * 0.05);
        g.restore();
      }
      return;
    }
    if (kind === 'halftone' || kind === 'sepia') {
      g.globalCompositeOperation = 'multiply';
      g.drawImage(ph, b.x, b.y, b.w, b.h);
      g.globalCompositeOperation = 'source-over';
    } else {
      g.globalCompositeOperation = kind === 'color' ? 'multiply' : 'source-over';
      g.drawImage(ph, b.x, b.y, b.w, b.h);
      g.globalCompositeOperation = 'source-over';
    }
    if (kind === 'plate') {
      g.strokeStyle = P.ink;
      g.lineWidth = 1;
      g.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    }
  }

  function shotPhoto(g, W, H, P, r, ph, o) {
    const unit = Math.min(W, H);
    const b = photoBox(W, H, ph.img);
    const bs = unit * rand(r, 0.024, 0.03) * (P.bodyMul || 1);
    const hs = unit * rand(r, 0.055, 0.075) * o.textScale * (P.headMul || 1);
    const accent = P.accent || (P.accents ? pick(r, P.accents) : P.ink);
    const gut = bs * 1.4;
    g.globalCompositeOperation = 'multiply';
    // headline above the photo, bottom-aligned to the photo
    const htxt = (ph.headline || '').trim();
    let headTop = b.y - bs * 1.2;
    if (htxt) {
      const up = P.headUpper || o.upper;
      g.font = font(P.head, hs, P.headStyle || '');
      const { lines, sp } = flow(g, words(up ? htxt.toUpperCase() : htxt).map((t) => ({ t })), b.w);
      const lh = hs * 1.08;
      const shown = lines.slice(0, 4);
      headTop = b.y - bs * 1.4 - shown.length * lh;
      drawLines(g, P, shown, sp, b.x, (i) => headTop + i * lh + lh / 2, b.w, { justify: false, color: P.ink, aged: P.aged, size: hs });
    }
    g.globalCompositeOperation = 'source-over';
    if (P.banner) {
      const kt = pick(r, C.kickers);
      g.font = font(P.kick, bs * 1.05);
      const kw = measure(g, kt) + bs * 1.4;
      g.fillStyle = accent;
      g.fillRect(b.x, headTop - bs * 2.4, kw, bs * 1.8);
      smallCaps(g, P.kick, bs * 1.05, kt, b.x + bs * 0.7, headTop - bs * 1.15, '#fff', 0.04);
    } else if (P.single) {
      smallCaps(g, P.body, bs, pick(r, C.bookTitles), b.x + b.w / 2, headTop - bs * 1.4, P.ink, 0.2, 'center');
    } else {
      smallCaps(g, P.kick, bs * 0.85, pick(r, C.kickers), b.x, headTop - bs * 1.2, accent, P.kickSpacing || 0.1);
    }
    if (!P.single) pageHeader(g, P, r, b.x, headTop - bs * 5, b.w, bs, o.brand);
    // above: previous article columns
    g.globalCompositeOperation = 'multiply';
    const cols = 2, cw = (b.w - gut * (cols - 1)) / cols;
    for (let k = 0; k < cols; k++) textColumn(g, P, rng(U.hash(r() * 1e9)), b.x + k * (cw + gut), -bs * 3, headTop - bs * 7, cw, bs);
    g.globalCompositeOperation = 'source-over';
    drawPhoto(g, P, ph.img, b, r);
    // caption + credit
    g.globalCompositeOperation = 'multiply';
    const cap = (ph.caption || pick(r, C.decks)).trim();
    const cs = bs * 0.9;
    g.font = font(P.body, cs, 'italic');
    const cf = flow(g, words(cap).map((t) => ({ t })), b.w);
    const cy0 = b.y + b.h + cs * 1.4;
    drawLines(g, P, cf.lines.slice(0, 2), cf.sp, b.x, (i) => cy0 + i * cs * 1.3, b.w, { justify: false, color: P.ink, size: cs });
    smallCaps(g, P.kick, bs * 0.6, P.single ? 'PLATE ' + pick(r, ['II', 'IV', 'VII', 'IX']) : 'PHOTO: STAFF', b.x + b.w, b.y + b.h + cs * 0.55, P.ink, 0.08, 'right');
    // body text under the caption and columns on both sides
    const yb = cy0 + Math.min(2, cf.lines.length) * cs * 1.3 + bs * 1.2;
    for (let k = 0; k < cols; k++) textColumn(g, P, rng(U.hash(r() * 1e9)), b.x + k * (cw + gut), yb, H + bs * 2, cw, bs, { startPara: true, dropCap: k === 0 && P.corpus === 'magazine', accent });
    if (!P.single) {
      for (let k = 1; k <= 4; k++) {
        const lx = b.x - k * (cw + gut), rx = b.x + b.w + gut + (k - 1) * (cw + gut);
        if (lx + cw > 0) textColumn(g, P, rng(U.hash(r() * 1e9)), lx, -bs * 2, H + bs * 2, cw, bs, { allowTable: true });
        if (rx < W) textColumn(g, P, rng(U.hash(r() * 1e9)), rx, -bs * 2, H + bs * 2, cw, bs, { allowTable: true });
        if (P.rules) {
          g.fillStyle = P.ink;
          g.globalAlpha = 0.45;
          if (lx + cw > -gut) g.fillRect(lx + cw + gut / 2, -5, 1, H + 10);
          if (rx < W + gut) g.fillRect(rx - gut / 2, -5, 1, H + 10);
          g.globalAlpha = 1;
        }
      }
    }
    g.globalCompositeOperation = 'source-over';
    return { cy: b.y + b.h / 2, band: b.h * 0.75 };
  }

  // ---------- compositing ----------
  let PAGE = null, TMP = null;
  const buf = (c, W, H) => {
    if (!c || c.width !== W || c.height !== H) c = U.makeCanvas(W, H);
    return c;
  };
  function maskBand(g, W, H, cy, outer, inner) {
    g.globalCompositeOperation = 'destination-in';
    const gr = g.createLinearGradient(0, cy - outer, 0, cy + outer);
    const a = Math.max(0, (outer - inner) / (2 * outer));
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(a, 'rgba(0,0,0,1)');
    gr.addColorStop(1 - a, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }
  // Depth of field: sharp around cy, increasingly soft above and below.
  function depthOfField(ctx, src, W, H, cy, band, amt) {
    const unit = Math.min(W, H);
    const far = amt * unit * 0.009;
    if (far < 0.4) return ctx.drawImage(src, 0, 0);
    U.drawBlurred(ctx, src, far);
    TMP = buf(TMP, W, H);
    const t = TMP.getContext('2d');
    t.clearRect(0, 0, W, H);
    U.drawBlurred(t, src, far * 0.42);
    maskBand(t, W, H, cy, band * 2.4 + unit * 0.05, band * 1.3);
    ctx.drawImage(TMP, 0, 0);
    t.clearRect(0, 0, W, H);
    t.drawImage(src, 0, 0);
    maskBand(t, W, H, cy, band * 1.25 + unit * 0.02, band * 0.55);
    ctx.drawImage(TMP, 0, 0);
  }
  function lighting(ctx, W, H, r, aged) {
    const a = rand(r, 0, Math.PI * 2);
    const gr = ctx.createLinearGradient(W / 2 + Math.cos(a) * W * 0.7, H / 2 + Math.sin(a) * H * 0.7, W / 2 - Math.cos(a) * W * 0.7, H / 2 - Math.sin(a) * H * 0.7);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)');
    gr.addColorStop(1, aged ? 'rgba(80,50,10,0.12)' : 'rgba(40,30,20,0.08)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    U.vignette(ctx, W, H, 0.12, '40,30,20');
  }

  // Renders one page into ctx. shot(g, W, H, P, r) draws content and returns {cy, band}.
  function renderPage(ctx, W, H, key, seed, o, shot) {
    const P = PUBS[key] || PUBS.broadsheet;
    const r = rng(seed);
    PAGE = buf(PAGE, W, H);
    const g = PAGE.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // slight hand-held tilt around the anchor
    const tilt = rand(r, -1, 1) * 0.012 * (o.tilt ?? 1);
    g.translate(W / 2, H / 2);
    g.rotate(tilt);
    g.translate(-W / 2, -H / 2);
    const tex = paperTexture(key, U.randInt(r, 0, 1), W, H);
    g.drawImage(tex, -W * 0.06, -H * 0.06, W * 1.12, H * 1.12);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const res = shot(g, W, H, P, r);
    g.setTransform(1, 0, 0, 1, 0, 0);
    U.setLetterSpacing(g, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    depthOfField(ctx, PAGE, W, H, res.cy, res.band, (o.dof ?? 1) * rand(r, 0.7, 1.15));
    lighting(ctx, W, H, r, P.aged);
    ctx.restore();
  }

  // ---------- front page (title card) ----------
  function renderFront(ctx, W, H, key, seed, data, o) {
    const P = PUBS[key] || PUBS.broadsheet;
    const r = rng(seed);
    const unit = Math.min(W, H);
    PAGE = buf(PAGE, W, H);
    const g = PAGE.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(paperTexture(key, 0, W, H), 0, 0, W, H);
    g.textBaseline = 'middle';
    const m = W * 0.07, cw = W - 2 * m;
    const accent = P.accent || (P.accents ? P.accents[0] : P.ink);
    // masthead
    const mast = o.brand || P.mast;
    let ms = unit * 0.12;
    g.font = font(P.mastFont, ms);
    const mw = measure(g, mast);
    if (mw > cw) ms *= cw / mw;
    g.font = font(P.mastFont, ms);
    g.fillStyle = P.ink;
    g.textAlign = 'center';
    let y = m + ms * 0.6;
    g.fillText(mast, W / 2, y);
    g.textAlign = 'left';
    y += ms * 0.65;
    const bs = unit * 0.026;
    hRule(g, m, y, cw, Math.max(1, unit * 0.003), P.ink);
    smallCaps(g, P.kick, bs * 0.8, dateLine().toUpperCase(), W / 2, y + bs * 1.1, P.ink, 0.1, 'center');
    hRule(g, m, y + bs * 2, cw, 1, P.ink);
    y += bs * 3.4;
    // headline with highlighted focus words
    const ws = data.mode === 'photo' ? words(data.headline || '') : data.words;
    const up = P.headUpper || o.upper;
    let hs = unit * 0.13 * o.textScale * (P.headMul || 1), lay;
    const toks = ws.map((t, i) => ({ t: up ? t.toUpperCase() : t, f: data.mode !== 'photo' && data.focusSet.has(i) }));
    for (let it = 0; it < 30; it++) {
      g.font = font(P.head, hs, P.headStyle || '');
      lay = flow(g, toks.map((t) => Object.assign({}, t)), cw);
      if (lay.lines.length <= 4 && lay.lines.length * hs * 1.08 < H * 0.3) break;
      hs *= 0.92;
    }
    const lh = hs * 1.08;
    g.font = font(P.head, hs, P.headStyle || '');
    g.globalCompositeOperation = 'multiply';
    lay.lines.forEach((ln, i) => {
      const xs = lineXs(ln, cw, lay.sp, false);
      ln.toks.forEach((tk, j) => {
        const yy = y + i * lh + lh / 2;
        if (tk.f) highlight(g, o.hlKind, o.hlColor, m + xs[j], yy, tk.w, hs, r);
        g.fillStyle = P.ink;
        g.fillText(tk.t, m + xs[j], yy);
      });
    });
    y += lay.lines.length * lh + hs * 0.25;
    // deck / caption and byline
    const ds = unit * 0.036;
    g.font = font(P.body, ds, 'italic');
    const deck = flow(g, words(data.caption || pick(r, C.decks)).map((t) => ({ t })), cw);
    drawLines(g, P, deck.lines.slice(0, 3), deck.sp, m, (i) => y + ds * 0.7 + i * ds * 1.3, cw, { justify: false, color: P.ink, size: ds });
    y += Math.min(3, deck.lines.length) * ds * 1.3 + ds * 0.6;
    g.globalCompositeOperation = 'source-over';
    smallCaps(g, P.kick, bs * 0.8, `BY ${pick(r, C.bylines).toUpperCase()}`, m, y + bs * 0.4, accent, 0.08);
    y += bs * 2;
    // photo or logo
    const img = data.img || data.logo;
    if (img) {
      const ar = img.width / img.height;
      let w = cw, h = w / ar;
      const maxH = H - y - bs * 9;
      if (h > maxH) { h = Math.max(unit * 0.1, maxH); w = data.img ? cw : h * ar; }
      const b = { x: data.img ? m : W / 2 - w / 2, y, w, h };
      if (data.img) drawPhoto(g, P, data.img, b, r);
      else g.drawImage(data.logo, b.x, b.y, b.w, b.h);
      y += h + bs * 1.5;
    }
    // body columns
    const cols = W > H ? 4 : 3, gut = bs * 1.3, colw = (cw - gut * (cols - 1)) / cols;
    g.globalCompositeOperation = 'multiply';
    for (let k = 0; k < cols; k++) {
      textColumn(g, P, rng(U.hash(seed, k)), m + k * (colw + gut), y, H - m, colw, bs, { startPara: true, dropCap: k === 0, accent });
      if (P.rules && k) { g.fillStyle = P.ink; g.globalAlpha = 0.45; g.fillRect(m + k * (colw + gut) - gut / 2, y, 1, H - m - y); g.globalAlpha = 1; }
    }
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(PAGE, 0, 0);
    lighting(ctx, W, H, r, P.aged);
    ctx.restore();
  }

  window.PAPER = { PUBS, font, flow, lineXs, drawLines, textColumn, highlight, paperTexture, treatPhoto, drawPhoto, smallCaps, hRule, words, stream, measure, depthOfField, lighting, dateLine, phraseTokens, focusIn, shotPhoto, weightedPick };

  const PUB_KEYS = Object.keys(PUBS);
  const isPub = (k) => PUB_KEYS.includes(k);
  const TPL = () => window.TEMPLATES;

  window.MCStyles = {
    get keys() { return PUB_KEYS.concat(TPL() ? TPL().keys : []); },
    name: (k) => (isPub(k) ? PUBS[k].name : TPL().T[k] ? TPL().T[k].name : k),
    group: (k) => (isPub(k) ? 'Close-up print' : TPL().T[k].group),
    isPub,
    photoBox,
    renderFrame(ctx, W, H, key, seed, parts, o) {
      if (!isPub(key) && TPL() && TPL().T[key]) {
        return TPL().renderTemplate(ctx, W, H, key, seed, { mode: 'word', parts, img: window.STOCK ? STOCK.get(seed) : null, brand: o.brand }, o);
      }
      renderPage(ctx, W, H, key, seed, o, (g, W2, H2, P, r) => {
        const shot = weightedPick(r, P.shots);
        return shot === 'headline' ? shotHeadline(g, W2, H2, P, r, parts, o) : shot === 'quote' ? shotQuote(g, W2, H2, P, r, parts, o) : shotBody(g, W2, H2, P, r, parts, o);
      });
    },
    // Photo cut: every style is filmed by the moving camera, so the photo changes
    // position, size and angle from frame to frame.
    renderPhoto(ctx, W, H, key, seed, ph, o) {
      const d = { mode: 'photo', img: ph.img, headline: ph.headline, caption: ph.caption, brand: o.brand };
      if (!isPub(key)) return TPL().renderTemplate(ctx, W, H, key, seed, d, o);
      const P = PUBS[key];
      const page = {
        size: [1200, 1600],
        draw: (g, w, h, dd) => {
          g.drawImage(paperTexture(key, 0, w, h), 0, 0, w, h);
          g.textBaseline = 'middle';
          shotPhoto(g, w, h, P, dd.r, ph, Object.assign({}, o, { textScale: 1 }));
          return { photo: photoBox(w, h, ph.img) };
        },
      };
      TPL().renderTemplate(ctx, W, H, page, seed, d, o);
    },
    renderFront(ctx, W, H, key, seed, data, o) {
      renderFront(ctx, W, H, isPub(key) ? key : 'broadsheet', seed, data, o);
    },
  };
})();
