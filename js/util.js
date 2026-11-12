/* Shared helpers. Everything runs in the browser; nothing is sent anywhere. */
(function () {
  const U = (window.U = {});

  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Seeded random number generator (mulberry32), so a frame always redraws the same way.
  U.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.newSeed = () => (Math.random() * 4294967296) >>> 0;
  U.hash = (...parts) => {
    let h = 2166136261;
    for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  U.pick = (r, a) => a[Math.floor(r() * a.length)];
  U.rand = (r, a, b) => a + r() * (b - a);
  U.randInt = (r, a, b) => Math.floor(a + r() * (b - a + 1));
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.shuffle = (r, arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  U.ease = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };

  U.hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgba = (hex, a) => {
    const [r, g, b] = U.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };
  // Pick black or white text for a background color.
  U.contrastInk = (hex) => {
    const [r, g, b] = U.hexToRgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff';
  };

  // ---------- canvas helpers ----------
  U.makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  U.roundRect = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const grainCache = {};
  U.grainTile = (dark) => {
    const key = dark ? 'd' : 'l';
    if (grainCache[key]) return grainCache[key];
    const c = U.makeCanvas(256, 256);
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() * 255;
    }
    g.putImageData(img, 0, 0);
    return (grainCache[key] = c);
  };
  U.grain = (ctx, W, H, alpha, ox = 0, oy = 0) => {
    const tile = U.grainTile();
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pat;
    ctx.fillRect(ox, oy, W, H);
    ctx.restore();
  };

  U.vignette = (ctx, W, H, strength = 0.45, color = '0,0,0') => {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, `rgba(${color},0)`);
    g.addColorStop(1, `rgba(${color},${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };

  U.halftone = (ctx, W, H, spacing, color, maxR, angle = 0.4, fn) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(angle);
    const ext = Math.hypot(W, H) / 2;
    for (let y = -ext; y < ext; y += spacing) {
      for (let x = -ext; x < ext; x += spacing) {
        const r = fn ? fn(x, y) * maxR : maxR;
        if (r < 0.3) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  // Ragged polygon around a rectangle, like torn paper.
  U.tornPoly = (x, y, w, h, seed, amp, step) => {
    const r = U.rng(seed);
    const pts = [];
    const edge = (x0, y0, x1, y1) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(2, Math.round(len / step));
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      let o = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        o = U.clamp(o + (r() - 0.5) * amp * 1.2, -amp, amp);
        pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]);
      }
    };
    edge(x, y, x + w, y);
    edge(x + w, y, x + w, y + h);
    edge(x + w, y + h, x, y + h);
    edge(x, y + h, x, y);
    return pts;
  };
  // Zig-zag polygon, like pinking shears.
  U.zigPoly = (x, y, w, h, amp, step) => {
    const pts = [];
    const edge = (x0, y0, x1, y1) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(2, Math.round(len / step));
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      for (let i = 0; i < n; i++) {
        const t = i / n, o = i % 2 ? amp : -amp;
        pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]);
      }
    };
    edge(x, y, x + w, y);
    edge(x + w, y, x + w, y + h);
    edge(x + w, y + h, x, y + h);
    edge(x, y + h, x, y);
    return pts;
  };
  U.polyPath = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  };

  // Hand-drawn loop around a box.
  U.roughEllipse = (ctx, cx, cy, rx, ry, r, passes = 2) => {
    for (let p = 0; p < passes; p++) {
      ctx.beginPath();
      const start = U.rand(r, 0, Math.PI * 2);
      const steps = 40;
      for (let i = 0; i <= steps + 4; i++) {
        const a = start + (i / steps) * Math.PI * 2;
        const j = 1 + U.rand(r, -0.04, 0.04);
        const x = cx + Math.cos(a) * rx * j, y = cy + Math.sin(a) * ry * j;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  };

  U.starPath = (ctx, cx, cy, spikes, outer, inner, r) => {
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 ? inner : outer * (r ? U.rand(r, 0.85, 1.12) : 1);
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  };

  U.wrapLines = (ctx, text, maxW) => {
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          out.push(line);
          line = w;
        } else line = test;
      }
      out.push(line);
    }
    return out;
  };

  U.setLetterSpacing = (ctx, px) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px';
  };

  // Detect canvas filter support (missing in some Safari versions).
  U.canFilter = (() => {
    try {
      const c = document.createElement('canvas').getContext('2d');
      c.filter = 'blur(2px)';
      return c.filter === 'blur(2px)';
    } catch (e) {
      return false;
    }
  })();

  // Draw an image blurred. Falls back to stacked offset copies when ctx.filter is missing.
  U.drawBlurred = (ctx, img, blur, x = 0, y = 0, w, h) => {
    w = w ?? img.width;
    h = h ?? img.height;
    if (blur < 0.4) return ctx.drawImage(img, x, y, w, h);
    if (U.canFilter) {
      ctx.filter = `blur(${blur.toFixed(1)}px)`;
      ctx.drawImage(img, x, y, w, h);
      ctx.filter = 'none';
      return;
    }
    const n = 6;
    ctx.save();
    ctx.drawImage(img, x, y, w, h);
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.drawImage(img, x + Math.cos(a) * blur * 0.6, y + Math.sin(a) * blur * 0.6, w, h);
    }
    ctx.restore();
  };

  // ---------- text corpus for background "page" text ----------
  U.WORDS = (
    'the city council said on monday that new plans would change how people travel across the region ' +
    'officials expect market prices to rise again this season while local farmers wait for rain ' +
    'reporters gathered outside as the minister arrived late for the press briefing ' +
    'experts warn the report shows growth slowing yet investors remain hopeful about next year ' +
    'students teachers and parents joined the march through downtown streets on saturday ' +
    'the team won the final after a dramatic late goal sending thousands of fans into celebration ' +
    'scientists discovered a rare species deep in the forest during a long expedition ' +
    'music festival tickets sold out within hours as artists announced a surprise show ' +
    'the company revealed its latest product promising faster service and lower costs ' +
    'weather forecast heavy storms coastal areas evening traffic delays morning commute ' +
    'history culture business sport technology health opinion letters editorial world nation ' +
    'according to sources familiar with the matter the decision could come within weeks ' +
    'a new chapter begins for the community after years of planning and hard work'
  ).split(' ');
  U.filler = (r, n) => Array.from({ length: n }, () => U.pick(r, U.WORDS)).join(' ');

  // ---------- files & misc ----------
  U.download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 4000);
  };
  U.fileToDataURL = (file) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  U.loadImage = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  // Downscale big photos so the editor stays fast and saved projects stay small.
  U.normalizeImage = async (src, maxSide = 1600) => {
    const img = await U.loadImage(src);
    const s = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (s >= 1 && src.startsWith('data:image/png')) return { img, src };
    const c = U.makeCanvas(img.width * s, img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const hasAlpha = src.startsWith('data:image/png') || src.startsWith('data:image/webp');
    const out = c.toDataURL(hasAlpha ? 'image/png' : 'image/jpeg', 0.9);
    return { img: await U.loadImage(out), src: out };
  };

  U.toast = (msg, ms = 2600) => {
    let el = U.$('#toast');
    el.textContent = window.I18N ? I18N.t(msg) : msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), ms);
  };

  // Frame loop that keeps running when requestAnimationFrame is throttled
  // (some embedded or partly hidden windows). fn returns false to stop.
  U.frameLoop = (fn, fps = 30) => {
    let tok = 0;
    const run = (t) => {
      if (t !== tok) return;
      tok++;
      if (fn() !== false) schedule();
    };
    const schedule = () => {
      const t = tok;
      requestAnimationFrame(() => run(t));
      setTimeout(() => run(t), 1000 / fps);
    };
    schedule();
  };

  U.fmtTime = (t) => {
    t = Math.max(0, t);
    return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  };

  U.loadFonts = async (specs) => {
    if (!document.fonts) return;
    const loads = specs.map((s) => document.fonts.load(s).catch(() => null));
    await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 6000))]);
  };

  // Recorder mime type for the chosen format.
  U.pickMime = (pref) => {
    if (typeof MediaRecorder === 'undefined') return null;
    const mp4 = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=h264,aac', 'video/mp4'];
    const webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const list = pref === 'webm' ? webm.concat(mp4) : pref === 'mp4' ? mp4.concat(webm) : mp4.concat(webm);
    return list.find((m) => MediaRecorder.isTypeSupported(m)) || null;
  };
})();
