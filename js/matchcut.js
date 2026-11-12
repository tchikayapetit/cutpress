/* Text match cut: timeline, playback, audio sync and export. */
(function () {
  const SIZES = {
    '9:16': { 720: [720, 1280], 1080: [1080, 1920] },
    '4:5': { 720: [720, 900], 1080: [1080, 1350] },
    '1:1': { 720: [720, 720], 1080: [1080, 1080] },
    '16:9': { 720: [1280, 720], 1080: [1920, 1080] },
  };

  const DEFAULTS = {
    mode: 'word',
    phrase: 'Every great story starts with one word',
    focus: [2],
    headline: 'Local bakery opens its doors',
    caption: '',
    styles: ['broadsheet', 'magazine', 'book', 'oldpress', 'front', 'tabloid', 'vintage', 'fashion', 'newsweekly', 'newsweb', 'blog', 'tv', 'wanted', 'clipping', 'spread', 'business'],
    pstyles: ['hist1910', 'hist1930', 'extra', 'hist1960', 'morning', 'redtop', 'pile', 'fan', 'archive', 'vintage', 'clipping', 'front', 'tabloid', 'oldpress'],
    seed: 12345,
    aspect: '9:16', quality: '720', fps: 30, format: 'auto',
    length: 6, cps: 8, accel: false, hold: 1.5, ending: 'hold', finalStyle: 'auto', oldLook: true,
    zoom: 0.8, blur: 0.8, textScale: 1, shake: false, flash: false, grain: false, vignette: false, upper: false,
    marker: 'yellow', hlCustom: false, hlColor: '#ffe14a', dof: 1, brand: '',
    logo: null, logoPos: 'below', logoSize: 1,
    music: 'none', bpm: 120, musicVol: 0.8, cutSfx: 'paper', revealSfx: 'none', riser: false, sfxVol: 0.9,
    loop: true,
  };

  const MARKERS = {
    yellow: ['marker', '#ffe14a'], pink: ['marker', '#ff9ec4'], green: ['marker', '#a8f08a'], blue: ['marker', '#9fd6ff'],
    pen: ['pen', '#c8201a'], circle: ['circle', '#c8201a'],
  };

  const TEMPLATES = [
    { name: 'Classic', desc: 'Fast cuts across newspapers and books, paper sound', patch: { styles: ['broadsheet', 'magazine', 'book', 'oldpress'], music: 'none', bpm: 120, cps: 12, accel: false, cutSfx: 'paper', revealSfx: 'none', riser: false, ending: 'hold', zoom: 0.6, blur: 0.6 } },
    { name: 'Breaking news', desc: 'Newspapers and tabloids, news theme', patch: { styles: ['broadsheet', 'tabloid', 'front', 'newsweb', 'tv'], music: 'news', bpm: 120, cps: 4, accel: true, cutSfx: 'shutter', revealSfx: 'news-sting', riser: false, ending: 'front', zoom: 0.9, blur: 0.9 } },
    { name: 'Archive', desc: 'Old papers and typed memos, cinematic', patch: { styles: ['oldpress', 'memo', 'book', 'vintage', 'wanted', 'clipping'], music: 'cin-dark', bpm: 80, cps: 2.5, accel: true, cutSfx: 'film-advance', revealSfx: 'boom', riser: true, ending: 'hold', zoom: 0.8, blur: 1 } },
    { name: 'Magazine', desc: 'Glossy pages, house beat', patch: { styles: ['magazine', 'fashion', 'spread', 'travel', 'gossip', 'music'], music: 'house-sunset', bpm: 122, cps: 4, accel: false, cutSfx: 'page-turn', revealSfx: 'whoosh', riser: false, ending: 'hold', zoom: 0.8, blur: 0.8 } },
    { name: 'Business', desc: 'Financial papers and reports', patch: { styles: ['finance', 'report', 'business', 'bizmag', 'newsweb'], music: 'pop-brand', bpm: 110, cps: 3.5, accel: true, cutSfx: 'click', revealSfx: 'bass', riser: false, ending: 'front', zoom: 0.8, blur: 0.8 } },
    { name: 'Top secret', desc: 'Typed memos, typewriter keys', patch: { styles: ['memo', 'report', 'corkboard', 'badge', 'clipping'], music: 'news-tense', bpm: 128, cps: 4.5, accel: true, cutSfx: 'type', revealSfx: 'stamp', riser: false, ending: 'hold', zoom: 0.8, blur: 0.8 } },
    { name: 'Afro promo', desc: 'Tabloids and magazines, Afrobeats', patch: { styles: ['tabloid', 'magazine', 'concert', 'social', 'fashion', 'front'], music: 'afro-douala', bpm: 104, cps: 3.5, accel: true, cutSfx: 'shutter', revealSfx: 'boom', riser: true, ending: 'front', zoom: 1, blur: 1 } },
  ];

  const LS_KEY = 'cutpress.matchcut.v6';

  const MC = (window.MC = {
    state: null, track: null, tl: null,
    playing: false, pos: 0, exporting: false,
    cache: new Map(),
  });

  MC.init = () => {
    MC.canvas = U.$('#mc-canvas');
    MC.ctx = MC.canvas.getContext('2d');
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
    MC.state = MC.sanitize(Object.assign({}, DEFAULTS, saved || {}, { seed: (saved && saved.seed) || U.newSeed() }));
    if (MC.state.logo) U.loadImage(MC.state.logo).then((img) => { MC.logoImg = img; MC.rebuild(); }).catch(() => {});
    MC.bindUI();
    MC.rebuild();
  };

  MC.save = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(MC.state)); } catch (e) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(Object.assign({}, MC.state, { logo: null }))); } catch (e2) {}
    }
  };

  MC.words = () => MC.state.phrase.split(/\s+/).filter(Boolean);

  MC.focusList = () => {
    const words = MC.words();
    let f = MC.state.focus.filter((i) => i >= 0 && i < words.length).sort((a, b) => a - b);
    if (!f.length && words.length) {
      // Default to the longest word.
      let best = 0;
      words.forEach((w, i) => { if (w.length > words[best].length) best = i; });
      f = [best];
    }
    return f;
  };

  MC.size = () => {
    const s = MC.state;
    return SIZES[s.aspect][s.quality] || SIZES['9:16'][720];
  };

  // Builds the list of cuts. Cut boundaries are counted backwards from the reveal,
  // so the final word always lands exactly on the downbeat at time R.
  // Builds the cuts for the chosen length and speed. With music, the speed snaps to the beat
  // and the last frame lands on a beat. Long videos reuse up to 48 unique pages.
  MC.buildTimeline = () => {
    const s = MC.state;
    const beat = 60 / s.bpm;
    const music = s.music !== 'none';
    const hold = U.clamp(s.hold, 0.3, Math.max(0.3, s.length - 0.5));
    let R = Math.max(0.5, s.length - hold);
    if (music) R = Math.max(beat, Math.round(R / beat) * beat);
    let c = 1 / U.clamp(s.cps, 0.25, 30);
    if (music) {
      const k = beat / c;
      c = k >= 1 ? beat / Math.round(k) : beat * Math.round(1 / k);
    }
    const bounds = [R];
    let t = R;
    while (t > 1e-6) {
      const step = s.accel && t < R / 2 ? c * 2 : c;
      t -= step;
      bounds.unshift(Math.max(0, t));
    }
    if (bounds.length > 2 && bounds[1] - bounds[0] < c * 0.35) bounds.splice(1, 1);
    const words = MC.words();
    const focus = s.mode === 'photo' ? (MC.photos.length ? MC.photos.map((_, i) => i) : [0]) : MC.focusList();
    const sel = s.mode === 'photo' ? s.pstyles : s.styles;
    const styles = sel.length ? sel : ['broadsheet'];
    const r = U.rng(s.seed);
    const n = bounds.length - 1;
    const UNIQ = Math.max(1, Math.min(n, 48));
    const slots = [];
    let prev = null;
    for (let j = 0; j < UNIQ; j++) {
      let st = U.pick(r, styles);
      if (styles.length > 1 && st === prev) st = U.pick(r, styles.filter((x) => x !== prev));
      prev = st;
      slots.push({ style: st, seed: U.hash(s.seed, j, st) });
    }
    const cuts = [], fkMap = {};
    for (let i = 0; i < n; i++) {
      const slot = i % UNIQ;
      const fi = focus[Math.min(focus.length - 1, Math.floor((i / n) * focus.length))];
      const fk = `${slot}:${fi}`;
      const cut = { t0: bounds[i], t1: bounds[i + 1], style: slots[slot].style, seed: slots[slot].seed, fi, fk };
      fkMap[fk] = cut;
      cuts.push(cut);
    }
    const finalStyle = s.finalStyle !== 'auto' ? s.finalStyle : cuts.length ? cuts[cuts.length - 1].style : styles[0];
    return { beat, c, R, hold, T: R + hold, cuts, fkMap, words, focus, finalStyle, finalSeed: U.hash(s.seed, 'final') };
  };

  MC.rebuild = () => {
    const [W, H] = MC.size();
    if (MC.canvas.width !== W || MC.canvas.height !== H) {
      MC.canvas.width = W;
      MC.canvas.height = H;
    }
    MC.W = W;
    MC.H = H;
    MC.tl = MC.buildTimeline();
    MC.cache.clear();
    MC.resetFrames();
    MC.pos = Math.min(MC.pos, MC.tl.T);
    MC.save();
    MC.updateInfo();
    if (!MC.playing) {
      // At rest, show a sharp frame instead of the blurred start of a cut.
      const c0 = MC.tl.cuts[0];
      const rest = MC.pos >= MC.tl.T - 0.01 ? MC.tl.R + 0.6 : MC.pos === 0 && c0 ? (c0.t0 + c0.t1) / 2 : MC.pos;
      MC.draw(rest);
    }
    else MC.restart();
  };

  MC.renderOpts = () => {
    const s = MC.state;
    const [kind, color] = MARKERS[s.marker] || MARKERS.yellow;
    return { textScale: s.textScale, upper: s.upper, hlKind: kind, hlColor: s.hlCustom ? s.hlColor : color, dof: s.dof, brand: s.brand.trim() };
  };

  // A neutral sample photo, used until the user adds their own.
  MC.photos = [];
  MC.sample = (() => {
    const c = U.makeCanvas(900, 650), g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 650);
    sky.addColorStop(0, '#7fa7d9'); sky.addColorStop(0.65, '#f1c58f'); sky.addColorStop(1, '#8a5a3c');
    g.fillStyle = sky; g.fillRect(0, 0, 900, 650);
    g.fillStyle = '#fff4d6'; g.beginPath(); g.arc(640, 300, 70, 0, 7); g.fill();
    g.fillStyle = '#3d2a22';
    g.beginPath(); g.arc(330, 270, 85, 0, 7); g.fill();
    g.beginPath(); g.ellipse(330, 650, 200, 250, 0, 0, 7); g.fill();
    return c;
  })();
  MC.photo = (i) => MC.photos[i] || MC.photos[0] || MC.sample;

  // Frame cache: a few canvases so playback does not redraw text every tick.
  // Pre-rendered pages (ImageBitmaps), filled in the background after every change,
  // so playback and export never wait for a page to be typeset.
  MC.frames = new Map();
  MC.prepTok = 0;
  MC.resetFrames = () => {
    for (const b of MC.frames.values()) if (b && b.close) b.close();
    MC.frames.clear();
    MC.prepTok++;
    clearTimeout(MC._prepTimer);
    MC._prepTimer = setTimeout(() => MC.prepare(), 400);
  };
  MC.frameKeys = () => {
    const keys = Object.keys(MC.tl.fkMap);
    if (MC.state.ending !== 'hold') keys.push('final');
    return keys;
  };
  MC.prepare = async (onProgress) => {
    const tok = MC.prepTok;
    const keys = MC.frameKeys();
    const { W, H } = MC;
    // keep memory reasonable on phones: skip pre-rendering very large sets
    if (W * H * 4 * keys.length > 700e6 || typeof createImageBitmap === 'undefined') return true;
    const work = U.makeCanvas(W, H), g = work.getContext('2d');
    for (let i = 0; i < keys.length; i++) {
      if (tok !== MC.prepTok) return false;
      const k = keys[i];
      if (!MC.frames.has(k)) {
        MC.renderKey(g, k);
        const bmp = await createImageBitmap(work);
        if (tok !== MC.prepTok) { bmp.close && bmp.close(); return false; }
        MC.frames.set(k, bmp);
      }
      if (onProgress) onProgress((i + 1) / keys.length);
      await new Promise((r) => setTimeout(r, 0));
    }
    return true;
  };
  MC.ensureFrames = async () => {
    const keys = MC.frameKeys();
    if (keys.every((k) => MC.frames.has(k))) return;
    const ov = U.$('#mc-play-overlay');
    U.$('.phone').classList.add('preparing');
    let ok = false;
    while (!ok) ok = await MC.prepare((p) => (ov.textContent = Math.round(p * 100) + '%'));
    U.$('.phone').classList.remove('preparing');
    MC.setPlayButton();
  };
  MC.renderKey = (ctx, key) => {
    const { W, H, tl } = MC;
    if (key === 'final') {
      MC.renderFinal(ctx);
      if (MC.state.mode === 'photo' && MC.state.oldLook) MC.oldGrade(ctx);
      return;
    }
    const cut = tl.fkMap[key];
    if (MC.state.mode === 'photo') {
      MCStyles.renderPhoto(ctx, W, H, cut.style, cut.seed, { img: MC.photo(cut.fi), headline: MC.state.headline, caption: MC.state.caption }, MC.renderOpts());
      if (MC.state.oldLook) MC.oldGrade(ctx);
    } else {
      const w = tl.words;
      const parts = { before: w.slice(0, cut.fi), focus: w[cut.fi] || '', after: w.slice(cut.fi + 1) };
      MCStyles.renderFrame(ctx, W, H, cut.style, cut.seed, parts, MC.renderOpts());
    }
  };

  // Old-photograph grade: sepia, faded colour, brown vignette and grain.
  let gradeTmp = null;
  MC.oldGrade = (ctx) => {
    const { W, H } = MC;
    if (!gradeTmp || gradeTmp.width !== W || gradeTmp.height !== H) gradeTmp = U.makeCanvas(W, H);
    const t = gradeTmp.getContext('2d');
    t.clearRect(0, 0, W, H);
    t.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (U.canFilter) {
      ctx.filter = 'sepia(0.6) saturate(0.65) contrast(1.06) brightness(0.96)';
      ctx.drawImage(gradeTmp, 0, 0);
      ctx.filter = 'none';
    } else {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(224,200,150,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    U.vignette(ctx, W, H, 0.38, '70,42,12');
    U.grain(ctx, W, H, 0.28);
    ctx.restore();
  };

  MC.getFrame = (key) => {
    if (MC.frames.has(key)) return MC.frames.get(key);
    if (MC.cache.has(key)) return MC.cache.get(key);
    const { W, H, tl } = MC;
    let c = MC.cache.size >= 4 ? null : U.makeCanvas(W, H);
    if (!c) {
      const oldKey = MC.cache.keys().next().value;
      c = MC.cache.get(oldKey);
      MC.cache.delete(oldKey);
    }
    MC.renderKey(c.getContext('2d'), key);
    MC.cache.set(key, c);
    return c;
  };

  MC.renderFinal = (ctx) => {
    const { W, H, tl } = MC;
    const s = MC.state;
    const photo = s.mode === 'photo';
    MCStyles.renderFront(ctx, W, H, tl.finalStyle, tl.finalSeed, {
      mode: s.mode, words: tl.words, focusSet: new Set(tl.focus), headline: s.headline, caption: s.caption,
      img: photo ? MC.photo(tl.focus[tl.focus.length - 1]) : null, logo: MC.logoImg,
    }, MC.renderOpts());
  };

  MC.cutIndexAt = (t) => {
    const cuts = MC.tl.cuts;
    let lo = 0, hi = cuts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cuts[mid].t0 <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  MC.draw = (t) => {
    const { ctx, W, H, tl } = MC;
    const s = MC.state;
    const unit = Math.min(W, H);
    t = U.clamp(t, 0, tl.T);
    let img, scale = 1, blur = 0, dx = 0, dy = 0, flash = 0;
    if (t < tl.R && tl.cuts.length) {
      const i = MC.cutIndexAt(t);
      const cut = tl.cuts[i];
      img = MC.getFrame(cut.fk);
      const lt = U.clamp((t - cut.t0) / (cut.t1 - cut.t0), 0, 1);
      scale = 1 + s.zoom * (0.015 + 0.075 * U.ease.outCubic(lt));
      blur = s.blur * 9 * (unit / 1080) * Math.pow(Math.max(0, 1 - lt * 3.2), 2);
      if (s.shake) {
        const r = U.rng(cut.seed);
        const amt = unit * 0.012 * Math.max(0.3, s.zoom) * (1 - lt);
        dx = (r() - 0.5) * 2 * amt;
        dy = (r() - 0.5) * 2 * amt;
      }
      const nk = i + 1 < tl.cuts.length ? tl.cuts[i + 1].fk : null;
      if (nk && !MC.frames.has(nk) && !MC.cache.has(nk)) MC.prefetch(nk);
    } else {
      const tf = t - tl.R;
      const hold = s.ending === 'hold' && tl.cuts.length;
      img = hold ? MC.getFrame(tl.cuts[tl.cuts.length - 1].fk) : MC.getFrame('final');
      const e = U.ease.outExpo(Math.min(1, tf / 0.5));
      scale = U.lerp(hold ? 1.1 : 1.22, 1, e) * (1 + 0.035 * s.zoom * (tf / Math.max(0.1, tl.hold)));
      blur = s.blur * 14 * (unit / 1080) * (1 - e);
      flash = s.flash ? Math.max(0, 1 - tf / 0.2) : 0;
      if (s.shake && tf < 0.3) {
        const k = (1 - tf / 0.3) * unit * 0.015;
        dx = Math.sin(tf * 90) * k;
        dy = Math.cos(tf * 70) * k;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(scale, 0, 0, scale, (W / 2) * (1 - scale) + dx, (H / 2) * (1 - scale) + dy);
    U.drawBlurred(ctx, img, blur);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (s.grain) U.grain(ctx, W, H, 0.16, Math.floor(Math.random() * 256), Math.floor(Math.random() * 256));
    if (s.vignette) U.vignette(ctx, W, H, 0.45);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(flash * 0.85).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    MC.updateTime(t);
  };

  let prefetchTimer = null;
  MC.prefetch = (i) => {
    if (prefetchTimer) return;
    prefetchTimer = setTimeout(() => {
      prefetchTimer = null;
      if (MC.tl.fkMap[i]) MC.getFrame(i);
    }, 0);
  };

  // ---------- playback ----------
  MC.scheduleAudio = (sess, t0, from) => {
    const s = MC.state, tl = MC.tl;
    if (s.music === 'upload' && MC.track) AE.playTrack(sess, MC.track, { R: tl.R, t0, from, T: tl.T });
    else AE.scheduleMusic(sess, s.music, { bpm: s.bpm, R: tl.R, T: tl.T, t0, from });
    if (s.cutSfx !== 'none') for (const c of tl.cuts) if (c.t0 >= from - 1e-3) AE.sfx(sess, s.cutSfx, t0 + c.t0, 0.8);
    if (s.riser && from < tl.R - 0.1) AE.I.riser(sess.sfx, t0 + Math.max(from, tl.R - 2 * tl.beat), t0 + tl.R, 0.2);
    if (s.revealSfx !== 'none' && from <= tl.R + 1e-3) AE.sfx(sess, s.revealSfx, t0 + tl.R, 1);
  };

  MC.play = async (from = MC.pos) => {
    if (MC.playing || MC._starting) return;
    if (from >= MC.tl.T - 0.05) from = 0;
    MC._starting = true;
    try { await MC.ensureFrames(); } finally { MC._starting = false; }
    await AE.resume();
    MC.session = AE.startSession({ musicVol: MC.state.musicVol, sfxVol: MC.state.sfxVol });
    MC.t0 = AE.now() + 0.1 - from;
    MC.scheduleAudio(MC.session, MC.t0, from);
    MC.playing = true;
    MC.setPlayButton();
    const ended = new Promise((res) => (MC._ended = res));
    const tick = () => {
      if (!MC.playing) return false;
      const t = AE.now() - MC.t0;
      if (MC.exporting) REC.progress(U.clamp(t / MC.tl.T, 0, 1));
      if (t >= MC.tl.T) {
        MC.draw(MC.tl.T);
        if (MC.state.loop && !MC.exporting) {
          MC.stop();
          MC.play(0);
        } else {
          MC.stop();
          MC.pos = MC.tl.T;
        }
        return false;
      }
      MC.pos = Math.max(0, t);
      MC.draw(MC.pos);
    };
    U.frameLoop(tick, MC.state.fps);
    return ended;
  };

  MC.stop = () => {
    if (!MC.playing) return;
    MC.playing = false;
    AE.stopSession(MC.session);
    MC.session = null;
    MC.setPlayButton();
    if (MC._ended) { MC._ended(); MC._ended = null; }
  };

  MC.restart = () => {
    const p = MC.pos;
    MC.stop();
    MC.play(p);
  };

  MC.toggle = () => (MC.playing ? MC.stop() : MC.play());

  MC.exportVideo = async (name) => {
    if (MC.exporting) return;
    MC.stop();
    MC.exporting = true;
    await MC.ensureFrames();
    REC.showOverlay('Printing your video…');
    try {
      const s = MC.state;
      const fname = name || 'cutpress-' + ((MC.state.mode === 'photo' ? MC.state.headline.split(/\s+/)[0] : MC.words()[MC.focusList()[0]]) || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '');
      // fast path: encode every frame straight away with WebCodecs (MP4 only)
      if (s.format !== 'webm' && s.fastExport !== false && window.FX && FX.available()) {
        try {
          REC.cancelled = false;
          await AE.resume();
          if (AE.recP) await AE.recP;
          const tl = MC.tl;
          const audio = await AE.renderSession(tl.T, (sess) => MC.scheduleAudio(sess, 0, 0), { musicVol: s.musicVol, sfxVol: s.sfxVol });
          const blob = await FX.encode({
            canvas: MC.canvas, W: MC.W, H: MC.H, fps: s.fps, bitrate: s.quality === '1080' ? 12e6 : 6e6, T: tl.T,
            drawAt: (t) => MC.draw(t), audio, onProgress: (p) => REC.progress(p), cancelled: () => REC.cancelled,
          });
          if (REC.cancelled) return null;
          if (blob) { MC.draw(MC.tl.R + 0.5); return REC.save(blob, `${fname}.mp4`); }
        } catch (err) { console.warn('Fast export failed, recording in real time instead.', err); }
        REC.cancelled = false;
      }
      return await REC.record({
        canvas: MC.canvas,
        fps: s.fps,
        bitrate: s.quality === '1080' ? 12e6 : 6e6,
        format: s.format,
        name: fname,
        play: () => { MC.draw(0); return MC.play(0); },
        stop: () => MC.stop(),
      });
    } finally {
      MC.exporting = false;
      REC.hideOverlay();
    }
  };

  MC.exportBatch = async (n) => {
    const base = MC.state.seed;
    for (let i = 0; i < n; i++) {
      if (i > 0) { MC.state.seed = U.newSeed(); MC.rebuild(); }
      U.$('#export-title').textContent = `Recording variation ${i + 1} of ${n}…`;
      const f = await MC.exportVideo(`cutpress-variation-${i + 1}`);
      if (!f) break;
    }
    if (n > 1) U.toast(I18N.t('Exported {n} variations.', { n }));
    return base;
  };

  // ---------- uploaded audio ----------
  MC.loadTrack = async (file) => {
    U.toast('Analyzing track…');
    try {
      const buf = await AE.decode(await file.arrayBuffer());
      const an = AE.analyze(buf);
      MC.track = Object.assign({ buffer: buf, name: file.name }, an);
      MC.state.music = 'upload';
      MC.state.bpm = an.bpm;
      MC.syncControls();
      MC.rebuild();
      MC.drawWave();
      U.toast(I18N.t('Detected ~{bpm} BPM. Drop set at {t}s. Click the waveform to move it.', { bpm: an.bpm, t: an.drop.toFixed(1) }), 5000);
    } catch (e) {
      console.error(e);
      U.toast('Could not read that audio file.');
    }
  };

  MC.drawWave = () => {
    const c = U.$('#mc-wave');
    const wrap = U.$('#mc-wave-wrap');
    wrap.hidden = !(MC.state.music === 'upload' && MC.track);
    if (wrap.hidden) return;
    const tr = MC.track;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const x = (t) => (t / tr.duration) * W;
    ctx.fillStyle = 'rgba(255,200,60,0.18)';
    ctx.fillRect(x(tr.drop - MC.tl.R), 0, x(MC.tl.T) - x(0), H);
    ctx.fillStyle = '#8a8f98';
    for (let i = 0; i < tr.peaks.length; i++) {
      const h = tr.peaks[i] * H * 0.9;
      ctx.fillRect((i / tr.peaks.length) * W, H / 2 - h / 2, Math.max(1, W / tr.peaks.length - 0.5), h);
    }
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(x(tr.drop) - dpr, 0, 2 * dpr, H);
    U.$('#mc-wave-info').textContent = `${tr.name} · drop at ${tr.drop.toFixed(2)}s · ${U.fmtTime(tr.duration)}`;
  };

  // ---------- UI ----------
  const QUICK_CUT = ['paper', 'shutter-slr', 'shutter-5d', 'shutter-holga', 'film-advance', 'polaroid-real', 'flash', 'click', 'none'];
  const QUICK_REVEAL = ['bass', 'impact', 'whoosh', 'news-sting', 'ding', 'none'];
  const fmtOut = (el, v) => (el.dataset.fmt === 'x' ? Number(v).toFixed(1) + '×' : el.dataset.fmt === 's' ? Number(v).toFixed(1) + 's' : el.dataset.fmt === 'cps' ? Number(v).toFixed(1) + ' cuts/s' : v);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  MC.updateInfo = () => {
    const tl = MC.tl;
    const cps = tl.cuts.length / Math.max(0.01, tl.R);
    U.$('#mc-info').textContent = I18N.t('{c} cuts · {s} cuts/s · {t}s · {w}×{h}', { c: tl.cuts.length, s: cps.toFixed(1), t: tl.T.toFixed(1), w: MC.W, h: MC.H });
    U.$('#mc-scrub').max = tl.T.toFixed(3);
    // cut-speed buttons show the real cuts per second at the current tempo

  };
  MC.updateTime = (t) => {
    U.$('#mc-time').textContent = `${U.fmtTime(t)} / ${U.fmtTime(MC.tl.T)}`;
    const sc = U.$('#mc-scrub');
    if (!sc._dragging) sc.value = t.toFixed(3);
  };
  MC.setPlayButton = () => {
    const b = U.$('#mc-play');
    b.textContent = MC.playing ? '❚❚ Pause' : '▶ Preview';
    b.setAttribute('aria-pressed', MC.playing);
    U.$('.phone').classList.toggle('playing', MC.playing);
    const ov = U.$('#mc-play-overlay');
    ov.textContent = MC.playing ? '❚❚' : '▶';
    ov.setAttribute('aria-label', MC.playing ? 'Pause preview' : 'Play preview');
  };

  MC.renderWords = () => {
    const box = U.$('#mc-words');
    box.innerHTML = '';
    const focus = new Set(MC.focusList());
    MC.words().forEach((w, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'word-chip' + (focus.has(i) ? ' on' : '');
      b.textContent = w;
      b.setAttribute('aria-pressed', focus.has(i));
      b.onclick = () => {
        const f = new Set(MC.focusList());
        if (f.has(i) && f.size > 1) f.delete(i);
        else f.add(i);
        MC.state.focus = [...f];
        MC.renderWords();
        MC.rebuild();
        MC.renderStyleThumbs();
      };
      box.appendChild(b);
    });
    U.$('#mc-count').textContent = `${MC.state.phrase.length}/80`;
  };

  // Style cards with a live thumbnail of each style using the user's own word.
  let thumbTimer = null;
  // Thumbnails render one at a time so the page stays responsive.
  let thumbTok = 0;
  MC.renderStyleThumbs = () => {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => {
      const tok = ++thumbTok;
      const words = MC.words();
      const fi = MC.focusList()[0] ?? 0;
      const parts = { before: words.slice(0, fi), focus: words[fi] || 'Word', after: words.slice(fi + 1) };
      const c = U.makeCanvas(240, 320);
      const g = c.getContext('2d');
      const o = Object.assign(MC.renderOpts(), { textScale: 1.25 });
      const cards = U.$$('.style-card').filter((b) => !b.hidden).concat(U.$$('.style-card').filter((b) => b.hidden));
      let i = 0;
      const next = () => {
        if (tok !== thumbTok || i >= cards.length) return;
        const card = cards[i++];
        const k = card.dataset.style;
        if (MC.state.mode === 'photo') MCStyles.renderPhoto(g, 240, 320, k, 4245 + (U.hash(k) % 5), { img: MC.photo(0), headline: MC.state.headline, caption: MC.state.caption }, o);
        else MCStyles.renderFrame(g, 240, 320, k, 4242 + (U.hash(k) % 7), parts, o);
        card.querySelector('img').src = c.toDataURL('image/jpeg', 0.72);
        setTimeout(next, 0);
      };
      next();
    }, 300);
  };
  MC.sk = () => (MC.state.mode === 'photo' ? 'pstyles' : 'styles');
  const GROUPS = ['All', 'Old front pages', 'Close-up print', 'Newspapers', 'Magazines', 'Web & screens', 'Posters', 'Desk & objects'];
  MC.styleGroup = 'All';
  MC.renderStyles = () => {
    const box = U.$('#mc-styles');
    if (!box.children.length) {
      for (const k of MCStyles.keys) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'style-card';
        b.dataset.style = k;
        b.dataset.group = MCStyles.group(k);
        b.innerHTML = `<img alt=""><span>${esc(MCStyles.name(k))}</span>`;
        b.onclick = () => {
          const set = new Set(MC.state[MC.sk()]);
          if (set.has(k) && set.size > 1) set.delete(k);
          else set.add(k);
          MC.state[MC.sk()] = MCStyles.keys.filter((x) => set.has(x));
          MC.renderStyles();
          MC.rebuild();
        };
        box.appendChild(b);
      }
      const gb = U.$('#mc-groups');
      gb.innerHTML = GROUPS.map((gname) => `<button type="button" class="pill" data-group="${gname}">${gname}</button>`).join('');
      U.$$('[data-group]', gb).forEach((b) => (b.onclick = () => { MC.styleGroup = b.dataset.group; MC.renderStyles(); }));
      U.$('#mc-styles-all').onclick = () => {
        const vis = U.$$('.style-card', box).filter((b) => !b.hidden).map((b) => b.dataset.style);
        MC.state[MC.sk()] = MCStyles.keys.filter((k) => MC.state[MC.sk()].includes(k) || vis.includes(k));
        MC.renderStyles(); MC.rebuild();
      };
      U.$('#mc-styles-none').onclick = () => {
        const vis = U.$$('.style-card', box).filter((b) => !b.hidden).map((b) => b.dataset.style);
        const left = MC.state[MC.sk()].filter((k) => !vis.includes(k));
        MC.state[MC.sk()] = left.length ? left : [vis[0]];
        MC.renderStyles(); MC.rebuild();
      };
      MC.renderStyleThumbs();
    }
    U.$$('#mc-groups .pill').forEach((b) => b.classList.toggle('on', b.dataset.group === MC.styleGroup));
    for (const b of box.children) {
      const on = MC.state[MC.sk()].includes(b.dataset.style);
      b.hidden = MC.styleGroup !== 'All' && b.dataset.group !== MC.styleGroup;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    }
    U.$('#mc-styles-count').textContent = I18N.t('{n} of {total} selected', { n: MC.state[MC.sk()].length, total: MCStyles.keys.length });
    const sel = U.$('#mc-finalStyle');
    if (!sel.options.length) sel.innerHTML = '<option value="auto">Same as last cut</option>' + MCStyles.keys.filter((k) => MCStyles.isPub(k)).map((k) => `<option value="${k}">${MCStyles.name(k)}</option>`).join('');
    sel.value = MCStyles.isPub(MC.state.finalStyle) || MC.state.finalStyle === 'auto' ? MC.state.finalStyle : 'auto';
  };

  MC.renderTemplates = () => {
    const box = U.$('#mc-templates');
    box.innerHTML = '';
    for (const t of TEMPLATES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill';
      b.title = t.desc;
      b.textContent = t.name;
      b.onclick = () => {
        AE.stopPreview();
        Object.assign(MC.state, t.patch, { seed: U.newSeed() });
        MC.syncControls();
        MC.rebuild();
        U.$$('#mc-templates .pill').forEach((x) => x.classList.toggle('on', x === b));
        U.toast(`${I18N.t(t.name)}: ${I18N.t(t.desc)}`);
      };
      box.appendChild(b);
    }
  };

  // ---------- music & sound pickers ----------
  MC.setMusic = (id) => {
    MC.state.music = id;
    if (id === 'upload' && MC.track) MC.state.bpm = MC.track.bpm;
    else if (AE.track(id)) MC.state.bpm = AE.track(id).bpm;
    MC.syncControls();
    MC.rebuild();
  };
  MC.renderMusicCard = () => {
    const s = MC.state;
    const box = U.$('#mc-music-card');
    let name, meta, play = true;
    if (s.music === 'none') { name = 'No music'; meta = 'Sound effects only'; play = false; }
    else if (s.music === 'upload' && MC.track) { name = MC.track.name; meta = `${I18N.t('Your track')} · ~${MC.track.bpm} BPM`; play = false; }
    else { const tk = AE.track(s.music); name = tk.name; meta = `${I18N.t(tk.genre)} · ${tk.bpm} BPM · ${tk.tags.map((x) => I18N.t(x)).join(', ')}`; }
    box.innerHTML = `${play ? '<button type="button" class="sc-play" aria-label="Preview track">▶</button>' : `<span class="sc-ico">${s.music === 'none' ? '∅' : '♪'}</span>`}
      <div class="sc-main"><div class="sc-name">${esc(name)}</div><div class="sc-meta">${esc(meta)}</div></div>
      <button type="button" class="btn-sm" id="mc-music-change">Change</button>`;
    const pb = U.$('.sc-play', box);
    if (pb) pb.onclick = async () => {
      if (pb.dataset.on) { AE.stopPreview(); pb.textContent = '▶'; delete pb.dataset.on; return; }
      MC.stop();
      pb.textContent = '■';
      pb.dataset.on = 1;
      await AE.preview('music', s.music, () => { pb.textContent = '▶'; delete pb.dataset.on; });
    };
    U.$('#mc-music-change', box).onclick = MC.openMusicLib;
  };
  MC.openMusicLib = () => {
    MC.stop();
    LIB.open({
      kind: 'music', selected: MC.state.music, allowNone: true, allowUpload: true,
      onPick: (id) => MC.setMusic(id),
      onUpload: () => U.$('#mc-audio-file').click(),
    });
  };
  MC.renderSfxPills = () => {
    for (const [key, quick, boxId] of [['cutSfx', QUICK_CUT, '#mc-cut-pills'], ['revealSfx', QUICK_REVEAL, '#mc-reveal-pills']]) {
      const box = U.$(boxId);
      const info = MC.state[key] === 'none' ? null : AE.sfxInfo(MC.state[key]);
      const cur = info ? info.id : 'none';
      const avail = quick.filter((id) => id === 'none' || AE.sfxInfo(id));
      const list = avail.includes(cur) ? avail : [cur].concat(avail);
      box.innerHTML = list
        .map((id) => `<button type="button" class="pill${id === cur ? ' on' : ''}" data-id="${id}">${id === 'none' ? 'No sound' : esc(AE.sfxInfo(id).name)}</button>`)
        .join('');
      U.$$('.pill', box).forEach((b) => (b.onclick = () => {
        MC.state[key] = b.dataset.id;
        MC.renderSfxPills();
        MC.save();
        if (b.dataset.id !== 'none') AE.preview('sfx', b.dataset.id);
      }));
    }
  };
  MC.openSfxLib = (key) => {
    MC.stop();
    LIB.open({
      kind: 'sfx', selected: MC.state[key], allowNone: true,
      onPick: (id) => { MC.state[key] = id; MC.renderSfxPills(); MC.save(); },
    });
  };

  // ---------- binding ----------
  MC.syncControls = () => {
    for (const el of U.$$('[data-mc]')) {
      const v = MC.state[el.dataset.mc];
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v;
      const out = el.id && U.$(`output[for="${el.id}"]`);
      if (out) out.textContent = fmtOut(el, v);
    }
    for (const seg of U.$$('[data-seg]')) {
      const v = String(MC.state[seg.dataset.seg]);
      U.$$('button', seg).forEach((b) => {
        b.classList.toggle('on', b.dataset.v === v);
        b.setAttribute('aria-pressed', b.dataset.v === v);
      });
    }
    const ph = U.$('#mc-phrase');
    if (ph.value !== MC.state.phrase) ph.value = MC.state.phrase;
    const hd = U.$('#mc-headline');
    if (hd.value !== MC.state.headline) hd.value = MC.state.headline;
    U.$$('.word-only').forEach((el) => (el.hidden = MC.state.mode !== 'word'));
    U.$$('.photo-only').forEach((el) => (el.hidden = MC.state.mode !== 'photo'));
    MC.renderPhotos();
    if (MC._lastMode !== MC.state.mode) { MC._lastMode = MC.state.mode; MC.renderStyleThumbs(); }
    U.$('#mc-caption').value = MC.state.caption;
    MC.renderWords();
    MC.renderStyles();
    MC.renderMusicCard();
    MC.renderSfxPills();
    U.$('#mc-logo-row').hidden = !MC.logoImg;
    MC.drawWave();
  };

  MC.bindUI = () => {
    MC.renderTemplates();
    for (const el of U.$$('[data-mc]')) {
      const k = el.dataset.mc;
      el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'range' || el.dataset.num !== undefined) v = parseFloat(v);
        MC.state[k] = v;
        const out = el.id && U.$(`output[for="${el.id}"]`);
        if (out) out.textContent = fmtOut(el, v);
        if (k === 'musicVol' && MC.session) MC.session.music.gain.value = v;
        if (k === 'sfxVol' && MC.session) MC.session.sfx.gain.value = v;
        if (['musicVol', 'sfxVol', 'loop', 'format', 'riser'].includes(k)) return MC.save();
        if (k === 'upper') MC.renderStyleThumbs();
        MC.rebuild();
        if (k === 'bpm') MC.drawWave();
      });
    }
    for (const seg of U.$$('[data-seg]')) {
      const k = seg.dataset.seg;
      U.$$('button', seg).forEach((b) => (b.onclick = () => {
        const v = b.dataset.v;
        MC.state[k] = /^[0-9.]+$/.test(v) ? parseFloat(v) : v;
        MC.syncControls();
        MC.rebuild();
        if (k === 'mode') { MC.styleGroup = v === 'photo' ? 'Old front pages' : 'All'; MC.renderStyles(); }
        if (k === 'mode' || k === 'marker') MC.renderStyleThumbs();
      }));
    }
    const ph = U.$('#mc-phrase');
    ph.addEventListener('input', () => {
      const old = MC.words();
      MC.state.phrase = ph.value;
      const nw = MC.words();
      if (old.length !== nw.length) MC.state.focus = MC.state.focus.filter((i) => i < nw.length);
      MC.renderWords();
      MC.rebuild();
      MC.renderStyleThumbs();
    });
    // Selecting text inside the box highlights those words, like a marker.
    const fromSelection = () => {
      const a = ph.selectionStart, b = ph.selectionEnd;
      if (a == null || a === b) return;
      const f = [];
      let idx = 0;
      for (const m of ph.value.matchAll(/\S+/g)) {
        const s = m.index, e = s + m[0].length;
        if (e > a && s < b) f.push(idx);
        idx++;
      }
      if (f.length) {
        MC.state.focus = f;
        MC.renderWords();
        MC.rebuild();
        MC.renderStyleThumbs();
      }
    };
    ph.addEventListener('mouseup', fromSelection);
    ph.addEventListener('keyup', (e) => e.shiftKey && fromSelection());
    ph.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); MC.play(0); } });
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && !U.$('#view-matchcut').hidden && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        ph.focus();
      }
    });
    U.$('#mc-caption').addEventListener('input', (e) => { MC.state.caption = e.target.value; MC.rebuild(); });
    U.$('#mc-headline').addEventListener('input', (e) => { MC.state.headline = e.target.value; MC.rebuild(); MC.renderStyleThumbs(); });
    const addPhotos = async (files) => {
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        try {
          const { img } = await U.normalizeImage(await U.fileToDataURL(f), 1600);
          if (MC.photos.length < 8) MC.photos.push(img);
        } catch (err) { U.toast(I18N.t('Could not read {name}', { name: f.name })); }
      }
      MC.renderPhotos();
      MC.rebuild();
      MC.renderStyleThumbs();
    };
    U.$('#mc-photo-file').addEventListener('change', (e) => { addPhotos([...e.target.files]); e.target.value = ''; });
    const dz = U.$('#mc-drop');
    dz.addEventListener('click', () => U.$('#mc-photo-file').click());
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); addPhotos([...e.dataTransfer.files]); });
    U.$('#mc-speed-reset').onclick = () => { MC.state.length = DEFAULTS.length; MC.state.cps = DEFAULTS.cps; MC.syncControls(); MC.rebuild(); };
    U.$('#mc-remix').onclick = () => { MC.state.seed = U.newSeed(); MC.rebuild(); };
    U.$('#mc-play').onclick = MC.toggle;
    U.$('#mc-play-overlay').onclick = MC.toggle;
    U.$('#mc-canvas').onclick = MC.toggle;
    const sc = U.$('#mc-scrub');
    sc.addEventListener('pointerdown', () => (sc._dragging = true));
    sc.addEventListener('pointerup', () => (sc._dragging = false));
    sc.addEventListener('input', () => { MC.stop(); MC.pos = parseFloat(sc.value); MC.draw(MC.pos); });
    U.$('#mc-export').onclick = () => MC.exportVideo();
    U.$('#mc-batch').onclick = () => MC.exportBatch(parseInt(U.$('#mc-batch-n').value, 10));
    U.$('#mc-music-browse').onclick = MC.openMusicLib;
    U.$$('[data-sfx-browse]').forEach((b) => (b.onclick = () => MC.openSfxLib(b.dataset.sfxBrowse)));
    U.$('#mc-logo').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const { img, src } = await U.normalizeImage(await U.fileToDataURL(f), 800);
      MC.logoImg = img;
      MC.state.logo = src;
      U.$('#mc-logo-row').hidden = false;
      MC.rebuild();
      e.target.value = '';
    });
    U.$('#mc-logo-remove').onclick = () => { MC.logoImg = null; MC.state.logo = null; U.$('#mc-logo-row').hidden = true; MC.rebuild(); };
    U.$('#mc-audio-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) MC.loadTrack(f);
      e.target.value = '';
    });
    U.$('#mc-wave').addEventListener('click', (e) => {
      if (!MC.track) return;
      const rect = e.target.getBoundingClientRect();
      const t = ((e.clientX - rect.left) / rect.width) * MC.track.duration;
      MC.track.drop = AE.snapToBeat(t, MC.state.bpm, MC.track.beatOffset);
      MC.drawWave();
      if (MC.playing) MC.restart();
    });
    U.$('#mc-save').onclick = () => {
      const blob = new Blob([JSON.stringify({ app: 'cutpress', kind: 'matchcut', version: 2, state: MC.state }, null, 1)], { type: 'application/json' });
      U.download(blob, 'cutpress-matchcut.json');
    };
    U.$('#mc-load').onclick = () => U.$('#mc-load-file').click();
    U.$('#mc-load-file').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (data.kind !== 'matchcut') throw new Error('wrong kind');
        MC.state = MC.sanitize(Object.assign({}, DEFAULTS, data.state));
        MC.logoImg = MC.state.logo ? await U.loadImage(MC.state.logo) : null;
        MC.syncControls();
        MC.rebuild();
        U.toast('Project loaded.');
      } catch (err) {
        U.toast('That file is not a CutPress match cut project.');
      }
    });
    window.addEventListener('resize', () => MC.drawWave());
    MC.syncControls();
  };

  MC.renderPhotos = () => {
    const box = U.$('#mc-photo-thumbs');
    box.innerHTML = '';
    MC.photos.forEach((img, i) => {
      const d = document.createElement('div');
      d.className = 'pthumb';
      d.innerHTML = `<img alt="${I18N.t('Photo {n}', { n: i + 1 })}" src="${img.src}"><button type="button" aria-label="${I18N.t('Remove photo')}">✕</button>`;
      d.querySelector('button').onclick = () => { MC.photos.splice(i, 1); MC.renderPhotos(); MC.rebuild(); MC.renderStyleThumbs(); };
      box.appendChild(d);
    });
    U.$('#mc-drop-label').textContent = MC.photos.length ? 'Add another photo' : 'Drop a photo here or tap to choose';
  };

  // Replace ids that no longer exist (old saves) with defaults.
  MC.sanitize = (s) => {
    if (s.music === 'upload' && !MC.track) s.music = DEFAULTS.music;
    if (s.music !== 'none' && s.music !== 'upload' && !AE.track(s.music)) s.music = DEFAULTS.music;
    if (s.cutSfx !== 'none' && !AE.sfxInfo(s.cutSfx)) s.cutSfx = DEFAULTS.cutSfx;
    if (s.revealSfx !== 'none' && !AE.sfxInfo(s.revealSfx)) s.revealSfx = DEFAULTS.revealSfx;
    if (!(s.length > 0)) s.length = DEFAULTS.length;
    if (!(s.cps > 0)) s.cps = DEFAULTS.cps;
    if (s.format === 'mp4') s.format = 'auto';
    for (const key of ['styles', 'pstyles']) {
      s[key] = (s[key] || []).filter((k) => MCStyles.keys.includes(k));
      if (!s[key].length) s[key] = DEFAULTS[key].slice();
    }
    if (s.finalStyle !== 'auto' && !MCStyles.keys.includes(s.finalStyle)) s.finalStyle = 'auto';
    if (s.ending === 'card') s.ending = 'front';
    if (!MARKERS[s.marker]) s.marker = 'yellow';
    return s;
  };
})();
