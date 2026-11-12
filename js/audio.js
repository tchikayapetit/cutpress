/* Audio engine: a library of synthesized music tracks and sound effects, uploaded tracks,
   beat/drop analysis, and offline rendering to WAV. Every sound is generated with the
   Web Audio API, so there are no licensing issues and nothing is downloaded. */
(function () {
  const AE = (window.AE = {});
  let ctx = null, bus = null, master = null, noiseBuf = null, crackleBuf = null, distCurve = null, irBuf = null;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);

  function makeIR(c, sec) {
    const n = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    return b;
  }
  // Compressor + small reverb, built for any (real or offline) context.
  function makeBus(c, dest) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    // brick-wall-ish limiter so loud tracks never clip
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -4;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.1;
    comp.connect(lim).connect(dest);
    const conv = c.createConvolver();
    conv.buffer = irBuf;
    const wet = c.createGain();
    wet.gain.value = 0.32;
    const verbIn = c.createGain();
    verbIn.connect(conv).connect(wet).connect(comp);
    return { comp, verbIn };
  }

  AE.init = () => {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    AE.streamDest = ctx.createMediaStreamDestination ? ctx.createMediaStreamDestination() : null;
    if (AE.streamDest) master.connect(AE.streamDest);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const cd = crackleBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) {
      cd[i] = (Math.random() * 2 - 1) * 0.012;
      if (Math.random() < 0.0006) cd[i] = (Math.random() * 2 - 1) * 0.9;
    }
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) distCurve[i] = Math.tanh(((i / 1023) * 2 - 1) * 2.5);
    irBuf = makeIR(ctx, 2.2);
    bus = makeBus(ctx, master);
    return ctx;
  };
  AE.resume = async () => {
    AE.init();
    if (ctx.state !== 'running') await ctx.resume();
  };
  AE.now = () => (ctx ? ctx.currentTime : 0);

  function makeSession(b, { musicVol = 0.8, sfxVol = 0.8 } = {}) {
    const out = ctx.createGain();
    out.connect(b.comp);
    const music = ctx.createGain();
    music.gain.value = musicVol;
    music.connect(out);
    const sfx = ctx.createGain();
    sfx.gain.value = sfxVol;
    sfx.connect(out);
    const mSend = ctx.createGain();
    mSend.gain.value = 0.12;
    music.connect(mSend).connect(b.verbIn);
    const sSend = ctx.createGain();
    sSend.gain.value = 0.18;
    sfx.connect(sSend).connect(b.verbIn);
    const drumLP = ctx.createBiquadFilter();
    drumLP.type = 'lowpass';
    drumLP.frequency.value = 20000;
    drumLP.connect(music);
    return { out, music, sfx, drums: drumLP, drumLP, sources: [] };
  }
  // A session groups every node of one playback, so stopping it silences everything at once.
  AE.startSession = (opts) => {
    AE.init();
    return makeSession(bus, opts);
  };
  AE.stopSession = (s) => {
    if (!s) return;
    const t = ctx.currentTime;
    s.out.gain.cancelScheduledValues(t);
    s.out.gain.setValueAtTime(s.out.gain.value, t);
    s.out.gain.linearRampToValueAtTime(0, t + 0.04);
    for (const src of s.sources) {
      try { src.stop(t + 0.05); } catch (e) {}
    }
    setTimeout(() => s.out.disconnect(), 120);
  };

  // ---------- primitives ----------
  function env(g, t, v, attack, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dec);
  }
  function noiseHit(d, t, { v = 0.5, dec = 0.1, type = 'highpass', f = 2000, q = 0.7, attack = 0.001, fEnd } = {}) {
    t = Math.max(t, ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + attack + dec);
    fl.Q.value = q;
    const g = ctx.createGain();
    env(g, t, v, attack, dec);
    src.connect(fl).connect(g).connect(d);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + dec + 0.05);
  }
  function tone(d, t, f, dur, { type = 'sine', v = 0.3, attack = 0.005, fEnd, glide = 0.1, cutoff, dist = false, vib } = {}) {
    t = Math.max(t, ctx.currentTime);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + glide);
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = vib.rate;
      lg.gain.value = vib.depth;
      l.connect(lg).connect(o.frequency);
      l.start(t);
      l.stop(t + attack + dur + 0.05);
    }
    let node = o;
    if (cutoff) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = cutoff;
      node = node.connect(fl);
    }
    if (dist) {
      const ws = ctx.createWaveShaper();
      ws.curve = distCurve;
      node = node.connect(ws);
    }
    const g = ctx.createGain();
    env(g, t, v, attack, dur);
    node.connect(g).connect(d);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  // ---------- instruments ----------
  const I = {
    kick: (d, t, v = 0.9, f0 = 150, f1 = 45, dec = 0.42) => tone(d, t, f0, dec, { v, fEnd: f1, glide: 0.11, attack: 0.002 }),
    tom: (d, t, v = 0.7, f = 120) => {
      tone(d, t, f * 1.6, 0.5, { v, fEnd: f, glide: 0.15 });
      noiseHit(d, t, { v: v * 0.3, dec: 0.12, type: 'lowpass', f: 1200 });
    },
    snare: (d, t, v = 0.5) => {
      noiseHit(d, t, { v, dec: 0.17, type: 'highpass', f: 1300 });
      tone(d, t, 200, 0.09, { type: 'triangle', v: v * 0.5, fEnd: 150, glide: 0.05 });
    },
    gated: (d, t, v = 0.5) => {
      noiseHit(d, t, { v, dec: 0.32, type: 'bandpass', f: 1800, q: 0.5 });
      tone(d, t, 210, 0.12, { type: 'triangle', v: v * 0.5, fEnd: 160 });
    },
    clap: (d, t, v = 0.5) => {
      for (let i = 0; i < 3; i++) noiseHit(d, t + i * 0.011, { v: v * 0.7, dec: 0.02, type: 'bandpass', f: 1300, q: 1.2 });
      noiseHit(d, t + 0.033, { v, dec: 0.16, type: 'bandpass', f: 1200, q: 0.9 });
    },
    hat: (d, t, v = 0.2, open = false) => noiseHit(d, t, { v, dec: open ? 0.24 : 0.045, type: 'highpass', f: 7500 }),
    shaker: (d, t, v = 0.08) => noiseHit(d, t, { v, dec: 0.05, attack: 0.008, type: 'highpass', f: 6500 }),
    rim: (d, t, v = 0.3) => {
      noiseHit(d, t, { v: v * 0.6, dec: 0.025, type: 'bandpass', f: 2200, q: 2 });
      tone(d, t, 820, 0.04, { type: 'triangle', v: v * 0.5 });
    },
    conga: (d, t, v = 0.4, f = 260) => tone(d, t, f * 1.3, 0.18, { v, fEnd: f, glide: 0.03 }),
    crash: (d, t, v = 0.25) => noiseHit(d, t, { v, dec: 1.8, type: 'highpass', f: 5500 }),
    stomp: (d, t, v = 0.8) => {
      tone(d, t, 110, 0.5, { v, fEnd: 38, glide: 0.12, attack: 0.002 });
      noiseHit(d, t, { v: v * 0.5, dec: 0.12, type: 'lowpass', f: 400 });
    },
    tick: (d, t, v = 0.15, hi = true) => {
      noiseHit(d, t, { v, dec: 0.008, type: 'highpass', f: 5000 });
      tone(d, t, hi ? 2600 : 1900, 0.012, { v: v * 0.5, type: 'square' });
    },
    bass808: (d, t, f, dur, v = 0.7, fTo) => tone(d, t, f * 1.5, dur, { v, fEnd: fTo || f, glide: fTo ? 0.12 : 0.06, dist: true }),
    bassSaw: (d, t, f, dur, v = 0.3, cutoff = 600) => tone(d, t, f, dur, { type: 'sawtooth', v, cutoff }),
    logDrum: (d, t, m, dur = 0.45, v = 0.55) => {
      const f = mtof(m);
      tone(d, t, f * 2.2, dur, { v, fEnd: f, glide: 0.06, dist: true });
      tone(d, t, f * 2, dur * 0.6, { v: v * 0.25, type: 'triangle', fEnd: f, glide: 0.06 });
    },
    keys: (d, t, notes, dur, v = 0.12) => {
      for (const m of notes) {
        tone(d, t, mtof(m), dur, { v, attack: 0.008, cutoff: 2200 });
        tone(d, t, mtof(m) * 2, dur * 0.4, { v: v * 0.25, attack: 0.005 });
      }
    },
    organ: (d, t, notes, dur, v = 0.05) => {
      for (const m of notes) for (const [h, a] of [[1, 1], [2, 0.5], [3, 0.25]]) tone(d, t, mtof(m) * h, dur, { v: v * a, attack: 0.005 });
    },
    marimba: (d, t, m, v = 0.18) => {
      const f = mtof(m);
      tone(d, t, f, 0.35, { v, attack: 0.002 });
      tone(d, t, f * 4, 0.05, { v: v * 0.3, attack: 0.001 });
    },
    bell: (d, t, f, v = 0.2, dec = 1.5) => {
      for (const [k, a] of [[1, 1], [2.76, 0.4], [5.4, 0.2], [8.9, 0.1]]) tone(d, t, f * k, dec / (1 + k * 0.3), { v: v * a, attack: 0.002 });
    },
    cowbell: (d, t, m, v = 0.18) => {
      const f = mtof(m);
      for (const k of [1, 1.48]) tone(d, t, f * k, 0.22, { type: 'square', v: v * 0.5, cutoff: f * 3 });
    },
    strum: (d, t, notes, v = 0.1) => notes.forEach((m, i) => tone(d, t + i * 0.012, mtof(m), 0.35, { type: 'triangle', v, attack: 0.002, cutoff: 3000 })),
    brass: (d, t, notes, dur, v = 0.1) => {
      for (const m of notes) for (const det of [0.996, 1.004]) tone(d, t, mtof(m) * det, dur, { type: 'sawtooth', v, attack: 0.03, cutoff: 1700, dist: false });
    },
    pluck: (d, t, m, v = 0.15, dec = 0.25) => {
      t = Math.max(t, ctx.currentTime);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.setValueAtTime(3500, t);
      fl.frequency.exponentialRampToValueAtTime(300, t + dec);
      const g = ctx.createGain();
      env(g, t, v, 0.003, dec);
      o.connect(fl).connect(g).connect(d);
      o.start(t);
      o.stop(t + dec + 0.05);
    },
    pad: (d, t, notes, dur, v = 0.06, cutoff = 900) => {
      t = Math.max(t, ctx.currentTime);
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = cutoff;
      const g = ctx.createGain();
      const atk = Math.min(0.5, dur * 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + atk);
      g.gain.setValueAtTime(v, t + Math.max(atk, dur - 0.05));
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
      fl.connect(g).connect(d);
      for (const m of notes)
        for (const det of [-7, 7]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = mtof(m);
          o.detune.value = det;
          o.connect(fl);
          o.start(t);
          o.stop(t + dur + 0.5);
        }
    },
    braam: (d, t, dur, v = 0.25, tr = 0) => {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.setValueAtTime(150, t);
      fl.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
      fl.frequency.exponentialRampToValueAtTime(400, t + Math.max(0.6, dur));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
      const ws = ctx.createWaveShaper();
      ws.curve = distCurve;
      fl.connect(ws).connect(g).connect(d);
      for (const m of [26, 38, 45, 50])
        for (const det of [-10, 10]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = mtof(m + tr);
          o.detune.value = det;
          o.connect(fl);
          o.start(t);
          o.stop(t + dur + 0.6);
        }
    },
    impact: (d, t, v = 0.9) => {
      tone(d, t, 90, 1.8, { v, fEnd: 32, glide: 0.5 });
      noiseHit(d, t, { v: v * 0.5, dec: 1.1, type: 'lowpass', f: 3500, fEnd: 200 });
      noiseHit(d, t, { v: v * 0.22, dec: 1.6, type: 'highpass', f: 5000 });
    },
    riser: (d, t0, t1, v = 0.25) => {
      t0 = Math.max(t0, ctx.currentTime);
      if (t1 - t0 < 0.05) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const fl = ctx.createBiquadFilter();
      fl.type = 'bandpass';
      fl.Q.value = 3;
      fl.frequency.setValueAtTime(300, t0);
      fl.frequency.exponentialRampToValueAtTime(6000, t1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t1 - 0.01);
      g.gain.linearRampToValueAtTime(0, t1 + 0.02);
      src.connect(fl).connect(g).connect(d);
      src.start(t0);
      src.stop(t1 + 0.05);
      tone(d, t0, 200, t1 - t0, { type: 'sine', v: v * 0.3, fEnd: 1200, glide: t1 - t0, attack: (t1 - t0) * 0.9 });
    },
    reverseCymbal: (d, t0, t1, v = 0.2) => {
      t0 = Math.max(t0, ctx.currentTime);
      if (t1 - t0 < 0.05) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const fl = ctx.createBiquadFilter();
      fl.type = 'highpass';
      fl.frequency.value = 4500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t1);
      g.gain.linearRampToValueAtTime(0, t1 + 0.02);
      src.connect(fl).connect(g).connect(d);
      src.start(t0);
      src.stop(t1 + 0.05);
    },
    crackle: (d, t0, t1, s) => {
      const src = ctx.createBufferSource();
      src.buffer = crackleBuf;
      src.loop = true;
      const fl = ctx.createBiquadFilter();
      fl.type = 'highpass';
      fl.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      src.connect(fl).connect(g).connect(d);
      src.start(Math.max(t0, ctx.currentTime));
      src.stop(t1);
      s.sources.push(src);
    },
  };
  AE.I = I;

  // ---------- sound effect library ----------
  // These are the original sounds from the first version of the app.
  const S = [];
  const sfx = (id, name, cat, tags, play, lead = 0, len = 1) => S.push({ id, name, cat, tags, play, lead, len });
  const C = { tr: 'Transitions', im: 'Impacts', pa: 'Paper & office', ca: 'Camera', gl: 'Glitch & digital', ui: 'UI & notifications', fu: 'Fun & cartoon', te: 'Tension & news' };
  AE.SFX_CATS = Object.values(C);

  // Camera and paper first: these are the classic match cut sounds.
  sfx('paper', 'Paper shuffle', C.pa, ['newspaper', 'soft'], (d, t, v) => { noiseHit(d, t, { v: 0.5 * v, dec: 0.08, type: 'bandpass', f: 1500, q: 0.8, attack: 0.006 }); noiseHit(d, t, { v: 0.25 * v, dec: 0.04, type: 'highpass', f: 4500 }); }, 0, 0.2);
  sfx('shutter', 'Camera shutter', C.ca, ['photo', 'click'], (d, t, v) => { noiseHit(d, t, { v: 0.5 * v, dec: 0.02, type: 'bandpass', f: 3200, q: 1.5 }); noiseHit(d, t + 0.045, { v: 0.4 * v, dec: 0.045, type: 'bandpass', f: 1800, q: 1 }); }, 0, 0.15);
  sfx('film-advance', 'Film advance', C.ca, ['analog', 'ratchet'], (d, t, v) => { for (let i = 0; i < 7; i++) { noiseHit(d, t + i * 0.035, { v: 0.32 * v, dec: 0.012, type: 'bandpass', f: 2500, q: 3 }); tone(d, t + i * 0.035, 120, 0.02, { type: 'square', v: 0.05 * v }); } }, 0, 0.35);
  sfx('polaroid', 'Polaroid', C.ca, ['instant', 'motor'], (d, t, v) => { noiseHit(d, t, { v: 0.45 * v, dec: 0.02, type: 'bandpass', f: 3000, q: 1.5 }); tone(d, t + 0.05, 85, 0.7, { type: 'sawtooth', v: 0.12 * v, cutoff: 700, vib: { rate: 30, depth: 5 } }); }, 0, 0.9);
  sfx('flash', 'Flash pop', C.ca, ['photo', 'charge'], (d, t, v) => { tone(d, t - 0.6, 1500, 0.6, { v: 0.04 * v, fEnd: 7000, glide: 0.6, attack: 0.5 }); noiseHit(d, t, { v: 0.5 * v, dec: 0.05, type: 'bandpass', f: 3000 }); tone(d, t, 200, 0.12, { v: 0.4 * v, fEnd: 60, glide: 0.1 }); }, 0.6, 0.8);
  sfx('zoom-lens', 'Lens zoom', C.ca, ['motor', 'focus'], (d, t, v) => tone(d, t, 500, 0.35, { type: 'triangle', v: 0.06 * v, fEnd: 700, glide: 0.35, vib: { rate: 40, depth: 8 } }), 0, 0.45);
  sfx('click', 'Click', C.ui, ['tap', 'short'], (d, t, v) => noiseHit(d, t, { v: 0.45 * v, dec: 0.022, type: 'highpass', f: 3500 }), 0, 0.1);
  sfx('type', 'Typewriter key', C.pa, ['retro', 'typing'], (d, t, v) => { noiseHit(d, t, { v: 0.55 * v, dec: 0.018, type: 'highpass', f: 2200 }); tone(d, t, 140, 0.03, { type: 'square', v: 0.12 * v }); }, 0, 0.1);
  sfx('glitch', 'Glitch', C.gl, ['digital', 'error'], (d, t, v) => { for (let i = 0; i < 3; i++) tone(d, t + i * 0.018, rnd(200, 2000), 0.014, { type: 'square', v: 0.1 * v }); }, 0, 0.1);
  sfx('pop', 'Pop', C.ui, ['bubble', 'cute'], (d, t, v) => tone(d, t, 900, 0.08, { v: 0.4 * v, fEnd: 250, glide: 0.07 }), 0, 0.15);

  // Transitions
  sfx('whoosh', 'Whoosh', C.tr, ['fast', 'air'], (d, t, v) => noiseHit(d, t - 0.32, { v: 0.5 * v, dec: 0.3, attack: 0.18, type: 'bandpass', f: 500, fEnd: 4000, q: 1.2 }), 0.32, 0.6);
  sfx('whoosh-long', 'Long whoosh', C.tr, ['air', 'slow'], (d, t, v) => noiseHit(d, t - 0.55, { v: 0.5 * v, dec: 0.45, attack: 0.5, type: 'bandpass', f: 300, fEnd: 5000, q: 1 }), 0.55, 1.1);
  sfx('swoosh-up', 'Swoosh up', C.tr, ['rise', 'air'], (d, t, v) => { noiseHit(d, t - 0.3, { v: 0.45 * v, dec: 0.1, attack: 0.25, type: 'bandpass', f: 400, fEnd: 7000, q: 4 }); tone(d, t - 0.3, 300, 0.3, { v: 0.05 * v, fEnd: 1500, glide: 0.3 }); }, 0.3, 0.5);
  sfx('swoosh-down', 'Swoosh down', C.tr, ['fall', 'air'], (d, t, v) => noiseHit(d, t, { v: 0.45 * v, dec: 0.45, attack: 0.02, type: 'bandpass', f: 7000, fEnd: 400, q: 4 }), 0, 0.6);
  sfx('reverse', 'Reverse cymbal', C.tr, ['suck', 'build'], (d, t, v) => I.reverseCymbal(d, t - 1, t, 0.3 * v), 1, 1.1);
  sfx('riser-short', 'Short riser', C.tr, ['build', 'tension'], (d, t, v) => I.riser(d, t - 1.2, t, 0.25 * v), 1.2, 1.3);
  sfx('riser-long', 'Long riser', C.tr, ['build', 'tension'], (d, t, v) => I.riser(d, t - 3, t, 0.25 * v), 3, 3.1);
  sfx('downlifter', 'Downlifter', C.tr, ['fall', 'drop'], (d, t, v) => { noiseHit(d, t, { v: 0.4 * v, dec: 1.4, type: 'bandpass', f: 5000, fEnd: 200, q: 2 }); tone(d, t, 900, 1.2, { v: 0.12 * v, fEnd: 60, glide: 1.2 }); }, 0, 1.6);
  sfx('tape-stop', 'Tape stop', C.tr, ['slow', 'retro'], (d, t, v) => tone(d, t, 220, 0.6, { type: 'sawtooth', v: 0.3 * v, fEnd: 15, glide: 0.6, cutoff: 1200 }), 0, 0.8);
  sfx('scratch', 'Vinyl scratch', C.tr, ['dj', 'retro'], (d, t, v) => { [[800, 3000], [3000, 600], [700, 2500]].forEach(([a, b], i) => noiseHit(d, t + i * 0.1, { v: 0.5 * v, dec: 0.08, attack: 0.01, type: 'bandpass', f: a, fEnd: b, q: 3 })); }, 0, 0.4);

  // Impacts
  sfx('bass', 'Bass hit', C.im, ['drop', 'deep'], (d, t, v) => { tone(d, t, 110, 1.6, { v: 0.9 * v, fEnd: 40, glide: 0.25, dist: true }); noiseHit(d, t, { v: 0.5 * v, dec: 0.15, type: 'lowpass', f: 900 }); }, 0, 1.8);
  sfx('impact', 'Cinematic impact', C.im, ['trailer', 'big'], (d, t, v) => I.impact(d, t, 0.9 * v), 0, 2);
  sfx('boom', 'Deep boom', C.im, ['trailer', 'deep'], (d, t, v) => { I.impact(d, t, 0.8 * v); tone(d, t, 60, 2.4, { v: 0.6 * v, fEnd: 22, glide: 1.6 }); }, 0, 2.6);
  sfx('subdrop', 'Sub drop', C.im, ['drop', 'deep'], (d, t, v) => tone(d, t, 90, 2, { v: 0.9 * v, fEnd: 25, glide: 1.5 }), 0, 2.1);
  sfx('punch', 'Punch', C.im, ['hit', 'fight'], (d, t, v) => { I.kick(d, t, v, 220, 50, 0.25); noiseHit(d, t, { v: 0.6 * v, dec: 0.07, type: 'lowpass', f: 2500 }); }, 0, 0.4);
  sfx('slam', 'Door slam', C.im, ['hit', 'heavy'], (d, t, v) => { noiseHit(d, t, { v: 0.8 * v, dec: 0.5, type: 'lowpass', f: 1800 }); I.kick(d, t, 0.8 * v, 130, 40, 0.6); }, 0, 0.8);
  sfx('thud', 'Thud', C.im, ['soft', 'low'], (d, t, v) => tone(d, t, 75, 0.3, { v: 0.9 * v, fEnd: 50, glide: 0.2, cutoff: 300 }), 0, 0.4);
  sfx('gong', 'Gong', C.im, ['epic', 'asian'], (d, t, v) => { [1, 1.47, 2.03, 2.76, 3.5].forEach((k) => tone(d, t, 95 * k, 3.5 / (1 + k * 0.2), { v: (0.22 / k) * v, attack: 0.02, vib: { rate: 4, depth: 1.5 } })); noiseHit(d, t, { v: 0.3 * v, dec: 0.3, type: 'lowpass', f: 600 }); }, 0, 3.6);
  sfx('metal', 'Metal clang', C.im, ['hit', 'industrial'], (d, t, v) => [1, 1.37, 2.11, 2.93, 3.79].forEach((k) => tone(d, t, 320 * k, 0.9 / k, { type: 'square', v: 0.07 * v, cutoff: 5000 })), 0, 1);

  // Paper & office
  sfx('page-turn', 'Page turn', C.pa, ['book', 'soft'], (d, t, v) => noiseHit(d, t, { v: 0.45 * v, dec: 0.22, attack: 0.06, type: 'bandpass', f: 1200, fEnd: 4000, q: 0.8 }), 0, 0.4);
  sfx('paper-rip', 'Paper rip', C.pa, ['tear', 'collage'], (d, t, v) => { for (let i = 0; i < 14; i++) noiseHit(d, t + i * 0.028, { v: rnd(0.2, 0.5) * v, dec: 0.02, type: 'bandpass', f: rnd(2000, 4000), q: 0.8 }); }, 0, 0.5);
  sfx('stamp', 'Rubber stamp', C.pa, ['office', 'approved'], (d, t, v) => { tone(d, t, 90, 0.15, { v: 0.8 * v, fEnd: 60, glide: 0.1 }); noiseHit(d, t, { v: 0.6 * v, dec: 0.06, type: 'lowpass', f: 1500 }); }, 0, 0.3);
  sfx('type-ding', 'Typewriter bell', C.pa, ['retro', 'ding'], (d, t, v) => { noiseHit(d, t - 0.1, { v: 0.5 * v, dec: 0.018, type: 'highpass', f: 2200 }); I.bell(d, t, 2093, 0.22 * v, 1.4); }, 0.1, 1.3);
  sfx('keyboard', 'Keyboard typing', C.pa, ['typing', 'computer'], (d, t, v) => { let o = 0; for (let i = 0; i < 6; i++) { noiseHit(d, t + o, { v: rnd(0.25, 0.4) * v, dec: 0.02, type: 'bandpass', f: rnd(2500, 4000), q: 1.5 }); o += rnd(0.06, 0.11); } }, 0, 0.7);
  sfx('mouse', 'Mouse click', C.pa, ['computer', 'click'], (d, t, v) => { noiseHit(d, t, { v: 0.4 * v, dec: 0.012, type: 'bandpass', f: 3000, q: 2 }); noiseHit(d, t + 0.07, { v: 0.25 * v, dec: 0.012, type: 'bandpass', f: 2600, q: 2 }); }, 0, 0.15);
  sfx('scribble', 'Pencil scribble', C.pa, ['writing', 'school'], (d, t, v) => { for (let i = 0; i < 4; i++) noiseHit(d, t + i * 0.12, { v: 0.25 * v, dec: 0.08, attack: 0.03, type: 'bandpass', f: rnd(3000, 4500), q: 2 }); }, 0, 0.6);

  // Glitch & digital
  sfx('stutter', 'Digital stutter', C.gl, ['digital', 'repeat'], (d, t, v) => { const f = rnd(300, 1200); for (let i = 0; i < 8; i++) tone(d, t + i * 0.035, f, 0.02, { type: 'square', v: 0.09 * v }); }, 0, 0.35);
  sfx('bitcrush', 'Bit crush', C.gl, ['8-bit', 'down'], (d, t, v) => tone(d, t, 1500, 0.3, { type: 'square', v: 0.1 * v, fEnd: 80, glide: 0.3 }), 0, 0.4);
  sfx('error', 'Error buzz', C.gl, ['wrong', 'computer'], (d, t, v) => { tone(d, t, 180, 0.1, { type: 'square', v: 0.15 * v }); tone(d, t + 0.15, 180, 0.15, { type: 'square', v: 0.15 * v }); }, 0, 0.35);
  sfx('beep', 'Beep', C.gl, ['censor', 'tone'], (d, t, v) => tone(d, t, 1000, 0.12, { v: 0.25 * v }), 0, 0.2);
  sfx('laser', 'Laser', C.gl, ['sci-fi', 'zap'], (d, t, v) => tone(d, t, 2200, 0.25, { type: 'sawtooth', v: 0.12 * v, fEnd: 90, glide: 0.25, cutoff: 4000 }), 0, 0.35);
  sfx('scan', 'Scanner', C.gl, ['sci-fi', 'tech'], (d, t, v) => tone(d, t, 300, 0.5, { v: 0.1 * v, fEnd: 3000, glide: 0.5, vib: { rate: 20, depth: 40 } }), 0, 0.6);
  sfx('data', 'Data beeps', C.gl, ['computer', 'hacker'], (d, t, v) => { for (let i = 0; i < 8; i++) tone(d, t + i * 0.045, rnd(800, 2400), 0.03, { v: 0.1 * v }); }, 0, 0.45);

  // UI & notifications
  sfx('bubble', 'Bubble', C.ui, ['water', 'cute'], (d, t, v) => tone(d, t, 250, 0.08, { v: 0.35 * v, fEnd: 1000, glide: 0.07 }), 0, 0.15);
  sfx('ding', 'Ding', C.ui, ['bell', 'bright'], (d, t, v) => I.bell(d, t, 1568, 0.25 * v, 1.2), 0, 1.2);
  sfx('notify', 'Notification', C.ui, ['phone', 'message'], (d, t, v) => { I.bell(d, t, 880, 0.18 * v, 0.4); I.bell(d, t + 0.12, 1318, 0.18 * v, 0.8); }, 0, 0.9);
  sfx('success', 'Success chime', C.ui, ['win', 'happy'], (d, t, v) => [72, 76, 79, 84].forEach((m, i) => tone(d, t + i * 0.07, mtof(m), 0.3, { type: 'triangle', v: 0.15 * v })), 0, 0.6);
  sfx('coin', 'Coin', C.ui, ['game', 'money'], (d, t, v) => { tone(d, t, 988, 0.07, { type: 'square', v: 0.1 * v }); tone(d, t + 0.07, 1319, 0.35, { type: 'square', v: 0.1 * v }); }, 0, 0.5);
  sfx('cash', 'Cash register', C.ui, ['money', 'sale'], (d, t, v) => { I.bell(d, t, 2093, 0.2 * v, 1); I.bell(d, t + 0.05, 2637, 0.15 * v, 1); noiseHit(d, t + 0.25, { v: 0.4 * v, dec: 0.12, type: 'lowpass', f: 900 }); }, 0, 1.1);
  sfx('swipe', 'Swipe', C.ui, ['phone', 'fast'], (d, t, v) => noiseHit(d, t, { v: 0.35 * v, dec: 0.14, attack: 0.05, type: 'bandpass', f: 2000, fEnd: 6000, q: 1 }), 0, 0.25);
  sfx('toggle', 'Toggle', C.ui, ['switch', 'tap'], (d, t, v) => { noiseHit(d, t, { v: 0.3 * v, dec: 0.015, type: 'highpass', f: 3000 }); tone(d, t, 600, 0.05, { v: 0.15 * v }); }, 0, 0.1);
  sfx('like', 'Like', C.ui, ['heart', 'social'], (d, t, v) => { tone(d, t, 900, 0.06, { v: 0.3 * v, fEnd: 300, glide: 0.05 }); tone(d, t + 0.05, 600, 0.12, { v: 0.2 * v, fEnd: 1200, glide: 0.1 }); }, 0, 0.25);

  // Fun & cartoon
  sfx('boing', 'Boing', C.fu, ['spring', 'cartoon'], (d, t, v) => tone(d, t, 120, 0.6, { v: 0.35 * v, fEnd: 260, glide: 0.5, vib: { rate: 14, depth: 25 } }), 0, 0.7);
  sfx('slide-up', 'Slide whistle up', C.fu, ['cartoon', 'rise'], (d, t, v) => tone(d, t, 300, 0.7, { v: 0.18 * v, fEnd: 1600, glide: 0.7, vib: { rate: 6, depth: 10 } }), 0, 0.8);
  sfx('slide-down', 'Slide whistle down', C.fu, ['cartoon', 'fail'], (d, t, v) => tone(d, t, 1600, 0.7, { v: 0.18 * v, fEnd: 300, glide: 0.7, vib: { rate: 6, depth: 10 } }), 0, 0.8);
  sfx('rimshot', 'Ba dum tss', C.fu, ['joke', 'drums'], (d, t, v) => { I.tom(d, t - 0.45, 0.6 * v, 200); I.tom(d, t - 0.25, 0.6 * v, 150); I.snare(d, t, 0.4 * v); I.crash(d, t, 0.3 * v); }, 0.45, 2);
  sfx('cowbell', 'Cowbell', C.fu, ['phonk', 'percussion'], (d, t, v) => I.cowbell(d, t, 76, 0.3 * v), 0, 0.3);
  sfx('airhorn', 'Air horn', C.fu, ['party', 'hype'], (d, t, v) => { [0, 0.18, 0.36].forEach((o, i) => [466, 587, 698].forEach((f) => tone(d, t + o, f, i === 2 ? 0.6 : 0.14, { type: 'sawtooth', v: 0.07 * v, cutoff: 2500, dist: true }))); }, 0, 1.1);
  sfx('applause', 'Applause', C.fu, ['crowd', 'win'], (d, t, v) => { for (let i = 0; i < 130; i++) { const o = Math.random() * 2.2; const e = Math.sin((o / 2.2) * Math.PI); noiseHit(d, t + o, { v: 0.35 * v * e + 0.02, dec: 0.03, type: 'bandpass', f: rnd(900, 2200), q: 1.2 }); } }, 0, 2.4);
  sfx('drumroll', 'Drum roll', C.fu, ['reveal', 'drums'], (d, t, v) => { for (let o = 1.2; o > 0; o -= 0.035) I.snare(d, t - o, (0.1 + (1.2 - o) * 0.25) * v); I.crash(d, t, 0.35 * v); I.kick(d, t, 0.8 * v); }, 1.2, 2.8);
  sfx('cymbal', 'Cymbal crash', C.fu, ['drums', 'hit'], (d, t, v) => I.crash(d, t, 0.35 * v), 0, 1.9);

  // Tension & news
  sfx('heartbeat', 'Heartbeat', C.te, ['tension', 'body'], (d, t, v) => [0, 0.18, 0.8, 0.98].forEach((o, i) => tone(d, t + o, 60, 0.18, { v: (i % 2 ? 0.6 : 0.9) * v, fEnd: 40, glide: 0.1, cutoff: 200 })), 0, 1.3);
  sfx('tick', 'Clock tick', C.te, ['time', 'short'], (d, t, v) => I.tick(d, t, 0.25 * v), 0, 0.1);
  sfx('clock', 'Ticking clock', C.te, ['time', 'deadline'], (d, t, v) => { for (let i = 0; i < 8; i++) I.tick(d, t + i * 0.25, 0.22 * v, i % 2 === 0); }, 0, 2.1);
  sfx('news-sting', 'News sting', C.te, ['broadcast', 'brass'], (d, t, v) => { I.brass(d, t - 0.3, [62, 69], 0.08, 0.07 * v); I.brass(d, t - 0.15, [62, 69], 0.08, 0.07 * v); I.brass(d, t, [50, 57, 62, 66], 0.7, 0.08 * v); I.tom(d, t, 0.7 * v, 80); I.crash(d, t, 0.2 * v); }, 0.3, 1.2);
  sfx('countdown', 'Countdown beeps', C.te, ['start', 'timer'], (d, t, v) => { [1.5, 1, 0.5].forEach((o) => tone(d, t - o, 880, 0.12, { v: 0.2 * v })); tone(d, t, 1760, 0.5, { v: 0.2 * v }); }, 1.5, 2.1);
  sfx('alarm', 'Alarm', C.te, ['warning', 'urgent'], (d, t, v) => { for (let i = 0; i < 6; i++) tone(d, t + i * 0.14, i % 2 ? 660 : 880, 0.11, { type: 'square', v: 0.08 * v, cutoff: 3000 }); }, 0, 0.9);

  AE.SFX_LIB = S;
  const SFX_BY_ID = Object.fromEntries(S.map((x) => [x.id, x]));
  // ids from the realistic-foley version
  const SFX_ALIAS = { 'paper-slide': 'paper', crumple: 'paper-rip', 'paper-drop': 'thud', typing: 'keyboard', carriage: 'type-ding', pencil: 'scribble', 'whoosh-fast': 'whoosh', 'hit-deep': 'bass' };
  AE.sfxInfo = (id) => SFX_BY_ID[id] || SFX_BY_ID[SFX_ALIAS[id]] || null;
  AE.sfx = (s, id, t, v = 1) => {
    const x = AE.sfxInfo(id);
    if (x) x.play(s.sfx, t, v);
  };

  // ---------- recorded sounds (real recordings from sounds/manifest.json) ----------
  AE.recorded = [];
  AE.loadRecorded = async () => {
    try {
      const list = await (await fetch('sounds/manifest.json')).json();
      AE.init();
      const got = [];
      await Promise.all(list.map(async (m) => {
        try {
          const buf = await AE.decode(await (await fetch(m.file)).arrayBuffer());
          const x = { id: m.id, name: m.name, cat: m.cat, tags: m.tags || [], len: m.len || buf.duration, lead: 0, rec: true, buffer: buf, credit: m };
          x.play = (d, t, v) => {
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const g = ctx.createGain();
            g.gain.value = v;
            src.connect(g).connect(d);
            src.start(Math.max(t, ctx.currentTime));
          };
          got.push(x);
        } catch (e) { /* skip a broken file */ }
      }));
      got.sort((a, b) => list.findIndex((m) => m.id === a.id) - list.findIndex((m) => m.id === b.id));
      for (const x of got) { SFX_BY_ID[x.id] = x; }
      // real recordings replace the synthesized versions of the same sound
      for (const [old, rec] of [['shutter', 'shutter-slr'], ['polaroid', 'polaroid-real']]) {
        if (!SFX_BY_ID[rec]) continue;
        const i = S.findIndex((x) => x.id === old);
        if (i >= 0) S.splice(i, 1);
        delete SFX_BY_ID[old];
        SFX_ALIAS[old] = rec;
      }
      S.unshift(...got);
      AE.recorded = got;
      if (AE.onRecorded) AE.onRecorded(got);
    } catch (e) { /* offline or missing folder: synthesized sounds are used */ }
  };

  // ---------- music library ----------
  const GENRES = {
    trap: 'Trap', drill: 'Drill', phonk: 'Phonk', afro: 'Afrobeats', amapiano: 'Amapiano', lofi: 'Lo-fi', cinematic: 'Cinematic',
    emotional: 'Piano & emotional', techno: 'Techno', house: 'House', synthwave: 'Synthwave', pop: 'Upbeat pop', stomp: 'Stomp & clap', news: 'News & suspense',
  };
  const TRACKS = [
    ['hype', 'Street Crown', 'trap', 140, 0, 0, ['energetic', 'confident']],
    ['trap-midnight', 'Midnight Drip', 'trap', 150, -3, 1, ['dark', 'night']],
    ['trap-gold', 'Gold Rush', 'trap', 132, 2, 0, ['bright', 'flex']],
    ['drill-cold', 'Cold Streets', 'drill', 142, 0, 0, ['dark', 'gritty']],
    ['drill-night', 'Night Shift', 'drill', 144, -2, 1, ['dark', 'tense']],
    ['phonk-drift', 'Drift King', 'phonk', 130, 0, 0, ['aggressive', 'car']],
    ['phonk-cow', 'Cowbell Fury', 'phonk', 140, 3, 1, ['aggressive', 'gym']],
    ['afro-douala', 'Douala Nights', 'afro', 104, 0, 0, ['dance', 'warm']],
    ['afro-sunday', 'Sunday Jollof', 'afro', 100, 5, 1, ['happy', 'sunny']],
    ['afro-lagos', 'Lagos Drive', 'afro', 108, -2, 0, ['groovy', 'night']],
    ['piano-log', 'Log Drum Season', 'amapiano', 112, 0, 0, ['dance', 'deep']],
    ['piano-sunset', 'Sunset Pianos', 'amapiano', 113, 3, 1, ['chill', 'warm']],
    ['lofi', 'Rainy Study', 'lofi', 80, 0, 0, ['chill', 'study']],
    ['lofi-coffee', 'Coffee Steam', 'lofi', 75, 2, 1, ['calm', 'morning']],
    ['lofi-bus', 'Late Bus', 'lofi', 85, -3, 0, ['nostalgic', 'night']],
    ['cinematic', 'Titan Rising', 'cinematic', 90, 0, 0, ['epic', 'trailer']],
    ['cin-dark', 'Dark Horizon', 'cinematic', 80, -2, 1, ['dark', 'suspense']],
    ['cin-hero', 'Last Stand', 'cinematic', 100, 3, 0, ['heroic', 'trailer']],
    ['emotional', 'First Letter', 'emotional', 72, 0, 0, ['emotional', 'soft']],
    ['emo-hope', 'Hope Again', 'emotional', 80, 2, 1, ['hopeful', 'inspiring']],
    ['emo-gold', 'Golden Hour', 'emotional', 66, -3, 0, ['tender', 'love']],
    ['techno', 'Warehouse 126', 'techno', 126, 0, 0, ['driving', 'club']],
    ['techno-rave', 'Neon Rave', 'techno', 132, 3, 1, ['intense', 'club']],
    ['house-sunset', 'Sunset House', 'house', 122, 0, 0, ['groovy', 'fashion']],
    ['house-deep', 'Deep Lounge', 'house', 120, -2, 1, ['smooth', 'lounge']],
    ['synthwave', 'Night Drive', 'synthwave', 108, 0, 0, ['retro', '80s']],
    ['synth-arcade', 'Retro Arcade', 'synthwave', 116, 4, 1, ['retro', 'game']],
    ['pop-happy', 'Happy Feet', 'pop', 118, 0, 0, ['happy', 'ads']],
    ['pop-vibes', 'Good Vibes', 'pop', 124, 2, 1, ['upbeat', 'summer']],
    ['pop-brand', 'Brand New Day', 'pop', 110, -1, 0, ['corporate', 'positive']],
    ['stomp', 'Stadium Stomp', 'stomp', 90, 0, 0, ['anthem', 'sport']],
    ['stomp-rise', 'Rise Up', 'stomp', 96, 2, 1, ['motivational', 'sport']],
    ['news', 'Breaking Story', 'news', 120, 0, 0, ['news', 'urgent']],
    ['news-tense', 'Deadline', 'news', 128, -1, 1, ['suspense', 'thriller']],
  ].map(([id, name, comp, bpm, tr, pv, tags]) => ({ id, name, comp, genre: GENRES[comp], bpm, tr, pv, tags }));
  // Old ids from earlier saves.
  const ALIAS = { techno: 'techno', synthwave: 'synthwave' };
  AE.TRACKS = TRACKS;
  AE.GENRES = Object.values(GENRES);
  const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
  AE.track = (id) => TRACK_BY_ID[ALIAS[id] || id] || null;

  // Every composer builds on a beat grid that starts at timeline 0, so the
  // reveal time R (a whole number of bars) falls on a downbeat: the "drop".
  const COMP = {};

  COMP.trap = (c) => {
    const progs = [[[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]], [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]]];
    const chords = progs[c.pv % 2], roots = c.pv % 2 ? [33, 26, 28, 33] : [33, 29, 36, 31];
    c.each(1, ({ tl, pos, bar, t, pre }) => {
      if (pos === 0) I.pad(c.m, t, c.ch(chords, tl), 4 * c.beat, pre ? 0.035 : 0.05, 1200);
      if (pre) {
        if (tl === 0) I.kick(c.dr, t);
        if (tl >= c.lastBar) {
          const p = (tl - c.lastBar) / (c.R - c.lastBar);
          if (p < 0.5 ? pos % 2 === 0 : true) I.snare(c.dr, t, 0.15 + p * 0.35);
          if (p > 0.75) I.snare(c.dr, t + c.s16 / 2, 0.15 + p * 0.35);
        } else if (pos % 2 === 0) I.hat(c.dr, t, 0.16);
      } else {
        if (c.atDrop(tl)) I.impact(c.m, t, 0.7);
        if ([0, 3, 10].includes(pos)) {
          I.kick(c.dr, t, 0.95);
          I.bass808(c.m, t, mtof(roots[bar % 4] + c.tr), pos === 3 ? 6 * c.s16 : 5 * c.s16, 0.55);
        }
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.5);
        if (pos % 2 === 0) I.hat(c.dr, t, 0.18);
        if (pos === 14 || pos === 15) for (let j = 1; j < 3; j++) I.hat(c.dr, t + (j * c.s16) / 3, 0.12);
      }
    });
    c.riser(2 * c.beat, 0.18);
  };

  COMP.drill = (c) => {
    const chords = [[57, 60, 64], [53, 57, 60], [55, 58, 62], [52, 55, 59]];
    const roots = [33, 29, 31, 28];
    c.each(1, ({ tl, pos, bar, t, pre }) => {
      const ch = c.ch(chords, tl);
      if (pos === 0) I.keys(c.m, t, ch.map((n) => n + 12), 3 * c.beat, 0.05);
      if (pos === 8 && bar % 2) I.keys(c.m, t, [ch[2] + 24], c.beat, 0.05);
      if ([0, 3, 6, 8, 11, 14].includes(pos)) I.hat(c.dr, t, 0.14);
      if (pos === 7 || pos === 15) for (let j = 0; j < 3; j++) I.hat(c.dr, t + (j * c.s16) / 3, 0.1);
      if (pre) {
        if (tl >= c.lastBar && pos % 2 === 0) I.snare(c.dr, t, 0.1 + ((tl - c.lastBar) / (c.R - c.lastBar)) * 0.35);
      } else {
        if (c.atDrop(tl)) I.impact(c.m, t, 0.6);
        if (pos === 0 || pos === 11) I.kick(c.dr, t, 0.9);
        if (pos === 8) I.snare(c.dr, t, 0.5);
        if (pos === 15 && bar % 2) I.snare(c.dr, t, 0.35);
        const r = mtof(roots[bar % 4] + c.tr);
        if (pos === 0) I.bass808(c.m, t, r, 5 * c.s16, 0.6);
        if (pos === 6) I.bass808(c.m, t, r * 1.5, 3 * c.s16, 0.5, r);
        if (pos === 11) I.bass808(c.m, t, r * 2, 5 * c.s16, 0.5, r * 1.33);
      }
    });
    c.riser(2 * c.beat, 0.15);
  };

  COMP.phonk = (c) => {
    const mel = c.pv % 2 ? [72, 72, 75, 77, 75, 72, 70, 72] : [72, 75, 72, 77, 75, 75, 72, 70];
    const steps = [0, 3, 6, 8, 10, 12, 14];
    c.each(1, ({ tl, pos, bar, t, pre }) => {
      if (steps.includes(pos)) I.cowbell(pre ? c.dr : c.m, t, mel[(steps.indexOf(pos) + bar) % mel.length] + c.tr, pre ? 0.14 : 0.2);
      if (pre) {
        if (pos % 4 === 2) I.hat(c.dr, t, 0.1);
      } else {
        if (c.atDrop(tl)) I.impact(c.m, t, 0.6);
        if ([0, 6, 10].includes(pos)) { I.kick(c.dr, t, 1, 160, 40, 0.5); I.bass808(c.m, t, mtof(29 + c.tr), 4 * c.s16, 0.6); }
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.5);
        I.hat(c.dr, t, pos % 2 ? 0.07 : 0.14);
      }
    });
    c.riser(2 * c.beat, 0.15);
  };

  COMP.afro = (c) => {
    const progs = [[[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]];
    const chords = progs[c.pv % 2];
    c.each(1, ({ tl, pos, bar, t, pre }) => {
      const ch = c.ch(chords, tl);
      I.shaker(c.dr, t, pos % 2 ? 0.09 : 0.05);
      if ([0, 3, 6, 10, 12].includes(pos)) I.marimba(c.m, t, ch[(pos + bar) % 3] + 12, 0.16);
      if ([3, 10].includes(pos)) I.rim(c.dr, t, 0.22);
      if (pre) {
        if (tl >= c.lastBar && [2, 5, 9, 11, 13, 14, 15].includes(pos)) I.conga(c.dr, t, 0.3, pos > 12 ? 300 : 230);
      } else {
        if ([0, 7, 10].includes(pos)) I.kick(c.dr, t, 0.85, 130, 45, 0.35);
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.35);
        if ([6, 14].includes(pos)) I.rim(c.dr, t, 0.2);
        if ([2, 5, 9, 13].includes(pos)) I.conga(c.dr, t, 0.25, pos % 2 ? 230 : 300);
        if ([0, 3, 7, 10].includes(pos)) I.bassSaw(c.m, t, mtof(ch[0] - 24 + (pos === 7 ? 7 : 0)), 2.5 * c.s16, 0.25, 380);
      }
    });
    c.riser(2 * c.beat, 0.12);
  };

  COMP.amapiano = (c) => {
    const chords = [[57, 60, 64, 67, 71], [50, 53, 57, 60, 64], [55, 59, 62, 65, 69], [48, 52, 55, 59, 62]];
    const logPat = c.pv % 2 ? [3, 7, 10, 14] : [3, 6, 10, 14];
    c.each(1, ({ tl, pos, t, pre }) => {
      const ch = c.ch(chords, tl);
      if ([0, 6, 10].includes(pos)) I.keys(c.m, t, ch, pos === 0 ? 1.4 * c.beat : c.beat, 0.035);
      I.shaker(c.dr, t, pos % 2 ? 0.08 : 0.04);
      if (pos % 4 === 0) I.kick(c.dr, t, 0.6, 110, 45, 0.3);
      if ([3, 7, 11, 15].includes(pos)) I.rim(c.dr, t, 0.15);
      if (!pre) {
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.32);
        if (logPat.includes(pos)) I.logDrum(c.m, t, ch[0] - 24 + (pos === 10 ? 3 : 0), 0.45, 0.5);
      }
    });
    c.muffle(500);
  };

  COMP.lofi = (c) => {
    const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
    const roots = [41, 40, 38, 36];
    I.crackle(c.m, c.at(c.from), c.at(c.T + 0.3), c.s);
    c.each(1, ({ tl, pos, bar, t, pre }) => {
      if (pos === 0) I.keys(c.m, t, c.ch(chords, tl), 1.6 * c.beat, 0.07);
      if (pos === 6) I.keys(c.m, t, c.ch(chords, tl), 2.4 * c.beat, 0.06);
      if ([0, 7, 10].includes(pos)) I.kick(c.dr, t, 0.75, 110, 45, 0.35);
      if (pos === 4 || pos === 12) I.snare(c.dr, t, 0.32);
      if (pos % 2 === 0) I.hat(c.dr, t + (pos % 4 === 2 ? c.beat * 0.08 : 0), 0.12);
      if (!pre && (pos === 0 || pos === 10)) I.bassSaw(c.m, t, mtof(roots[bar % 4] + c.tr), 2 * c.beat, 0.22, 300);
    });
    c.muffle(600);
  };

  COMP.cinematic = (c) => {
    if (c.from < c.T) I.pad(c.m, c.at(c.from), [38 + c.tr, 45 + c.tr], Math.max(0.5, Math.min(c.R, c.T) - c.from + 0.2), 0.05, 500);
    const ost = c.pv % 2 ? [62, 65, 70, 65] : [62, 65, 69, 65];
    c.each(2, ({ tl, pos, k, t, pre }) => {
      const p = pre ? tl / c.R : 0.4;
      I.pluck(c.m, t, ost[(k / 2) % 4] + c.tr - (pre ? 0 : 12), 0.05 + p * 0.12, 0.22);
      if (pre && pos === 0) I.tom(c.dr, t, 0.35 + p * 0.3, 90);
      if (pre && tl >= c.lastBar && [0, 4, 8, 10, 12, 14].includes(pos)) I.tom(c.dr, t, 0.75, 110);
      if (!pre && (pos === 0 || pos === 6 || pos === 8)) I.tom(c.dr, t, 0.6, 85);
    });
    if (c.from <= c.R && c.R < c.T) {
      I.riser(c.m, c.at(Math.max(c.from, c.lastBar)), c.at(c.R), 0.2);
      I.impact(c.m, c.at(c.R), 1);
      I.braam(c.m, c.at(c.R), Math.max(0.6, c.T - c.R), 0.22, c.tr);
    }
  };

  COMP.emotional = (c) => {
    const progs = [[[48, 55, 60, 64], [43, 55, 59, 62], [45, 57, 60, 64], [41, 53, 57, 60]], [[41, 53, 57, 60], [43, 55, 59, 62], [40, 55, 59, 64], [45, 57, 60, 64]]];
    const chords = progs[c.pv % 2];
    const arp = [0, 1, 2, 3, 2, 1, 2, 3];
    c.each(2, ({ tl, pos, k, t, pre }) => {
      const ch = c.ch(chords, tl);
      I.keys(c.m, t, [ch[arp[(k / 2) % 8]] + 12], c.beat * 1.4, pre ? 0.08 : 0.1);
      if (pos === 0) {
        I.pad(c.m, t, ch.slice(1), 4 * c.beat, pre ? 0.025 : 0.05, 1100);
        if (!pre) I.bassSaw(c.m, t, mtof(ch[0] - 12), 4 * c.beat, 0.16, 250);
      }
      if (!pre && (pos === 0 || pos === 8)) I.kick(c.dr, t, 0.55, 100, 45, 0.5);
      if (!pre && pos === 8) I.snare(c.dr, t, 0.15);
    });
    if (c.from < c.R) I.reverseCymbal(c.m, c.at(Math.max(c.from, c.lastBar)), c.at(c.R), 0.12);
  };

  COMP.techno = (c) => {
    c.each(1, ({ tl, pos, t, pre }) => {
      if (pre) {
        if (pos % 4 === 0) I.kick(c.dr, t, 0.7, 120, 40, 0.6);
        if (pos % 4 === 2) I.hat(c.dr, t, 0.14);
        if (tl >= c.lastBar + 2 * c.beat) I.snare(c.m, t, 0.12 + ((tl - c.lastBar) / (c.R - c.lastBar)) * 0.3);
      } else {
        if (pos % 4 === 0) I.kick(c.dr, t, 1, 160, 42, 0.38);
        if (pos % 4 === 2) I.hat(c.dr, t, 0.18, true);
        else I.hat(c.dr, t, 0.07);
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.42);
        if (pos % 4 !== 0) I.bassSaw(c.m, t, mtof((pos % 4 === 2 ? 45 : 33) + c.tr), c.s16 * 0.9, 0.22, c.pv % 2 ? 1100 : 700);
      }
    });
    c.muffle(450);
    if (c.from < c.R) I.riser(c.m, c.at(Math.max(c.from, c.lastBar)), c.at(c.R), 0.2);
  };

  COMP.house = (c) => {
    const chords = [[57, 60, 64, 67], [50, 53, 57, 60], [52, 55, 59, 62], [53, 57, 60, 64]];
    c.each(1, ({ tl, pos, t, pre }) => {
      const ch = c.ch(chords, tl);
      if ([2, 6, 10, 14].includes(pos) && (pos !== 14 || !pre)) I.organ(c.m, t, ch, c.s16 * 1.6, 0.03);
      if (pos % 4 === 0) I.kick(c.dr, t, 0.9, 140, 45, 0.35);
      if (pos % 4 === 2) I.hat(c.dr, t, 0.16, true);
      if (!pre) {
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.4);
        if (pos % 2 === 1) I.hat(c.dr, t, 0.06);
        if (pos % 4 === 2) I.bassSaw(c.m, t, mtof(ch[0] - 24), c.s16 * 1.5, 0.25, 500);
      }
    });
    c.muffle(400);
    c.riser(2 * c.beat, 0.14);
  };

  COMP.synthwave = (c) => {
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    c.each(1, ({ tl, pos, k, t, pre }) => {
      const ch = c.ch(chords, tl);
      I.pluck(c.m, t, ch[k % 3] + 12 * (Math.floor(k / 3) % 2), pre ? 0.07 : 0.09, 0.16);
      if (pos === 0) I.pad(c.m, t, ch, 4 * c.beat, 0.04, pre ? 700 : 1600);
      if (!pre) {
        if (pos === 0 || pos === 8) I.kick(c.dr, t, 0.9);
        if (pos === 4 || pos === 12) I.gated(c.dr, t, 0.42);
        if (pos % 2 === 0) I.bassSaw(c.m, t, mtof(ch[0] - 24 + (pos % 4 === 2 ? 12 : 0)), c.s16 * 1.8, 0.2, 500);
        if (pos % 2 === 0) I.hat(c.dr, t, 0.08);
      }
    });
    c.riser(4 * c.beat, 0.16);
  };

  COMP.pop = (c) => {
    const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
    const mel = c.pv % 2 ? [76, 79, 81, 79, 76, 74, 72, 74] : [72, 74, 76, 79, 76, 74, 76, 72];
    c.each(2, ({ tl, pos, k, t, pre }) => {
      const ch = c.ch(chords, tl);
      const up = pos % 4 === 2;
      I.strum(c.m, t, up ? ch.slice().reverse() : ch, up ? 0.05 : 0.08);
      if (pre) {
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.2);
      } else {
        if (pos === 0 || pos === 8 || pos === 10) I.kick(c.dr, t, 0.85);
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.45);
        I.hat(c.dr, t, 0.1);
        I.bassSaw(c.m, t, mtof(ch[0] - 24), c.s16 * 1.8, 0.2, 400);
        if (pos % 4 === 0) I.bell(c.m, t, mtof(mel[(k / 2 / 2) % 8] + 12), 0.06, 0.6);
      }
    });
    c.riser(2 * c.beat, 0.12);
  };

  COMP.stomp = (c) => {
    c.each(2, ({ tl, pos, t, pre }) => {
      if (pos === 0) I.pad(c.m, t, [50, 57, 62, 65].map((n) => n - (pre ? 12 : 0)), 4 * c.beat, pre ? 0.03 : 0.05, pre ? 600 : 1400);
      if (pre) {
        const p = tl / c.R;
        if (pos === 0 || pos === 8) I.stomp(c.dr, t, 0.4 + p * 0.5);
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.2 + p * 0.3);
        if (tl >= c.lastBar && [0, 4, 8, 10, 12, 14].includes(pos)) I.tom(c.dr, t, 0.6, 100);
      } else {
        if (c.atDrop(tl)) I.impact(c.m, t, 0.8);
        if (pos === 0 || pos === 8) I.stomp(c.dr, t, 0.95);
        if (pos === 4 || pos === 12) I.clap(c.dr, t, 0.55);
        if (pos % 4 === 2) I.tom(c.dr, t, 0.35, 120);
        if (pos % 4 === 0) I.bassSaw(c.m, t, mtof(38 + c.tr), c.beat, 0.2, 300);
      }
    });
  };

  COMP.news = (c) => {
    const pat = c.pv % 2 ? [62, 62, 65, 62, 70, 62, 65, 62] : [62, 62, 65, 62, 69, 62, 65, 62];
    c.each(1, ({ tl, pos, k, t, pre }) => {
      if (pos % 2 === 0) I.tick(c.dr, t, 0.12, pos % 4 === 0);
      I.pluck(c.m, t, pat[k % 8] + c.tr - (pre ? 0 : 12), pre ? 0.05 + (tl / c.R) * 0.06 : 0.08, 0.12);
      if (pre && tl >= c.lastBar && pos % 4 === 0) I.tom(c.dr, t, 0.6, 80);
      if (!pre) {
        if (c.atDrop(tl)) { I.brass(c.m, t, [50, 57, 62, 65].map((n) => n + c.tr), 0.8, 0.07); I.impact(c.m, t, 0.7); }
        if (pos % 4 === 0) I.kick(c.dr, t, 0.7);
        if (pos % 2 === 0) I.bassSaw(c.m, t, mtof(38 + c.tr), c.s16 * 1.5, 0.2, 500);
        if (pos === 8) I.snare(c.dr, t, 0.3);
      }
    });
  };

  AE.scheduleMusic = (s, trackId, { bpm, R, T, t0, from = 0 }) => {
    const tk = AE.track(trackId);
    if (!tk) return;
    bpm = bpm || tk.bpm;
    const beat = 60 / bpm, s16 = beat / 4;
    const c = {
      s, m: s.music, dr: s.drums, beat, s16, R, T, from, tr: tk.tr, pv: tk.pv,
      lastBar: R - 4 * beat,
      at: (tl) => t0 + tl,
      ch: (chords, tl) => chords[Math.floor(tl / (4 * beat)) % chords.length].map((n) => n + tk.tr),
      atDrop: (tl) => Math.abs(tl - R) < 1e-6,
      // Calls fn on every `step`-th 16th note that should be heard.
      each(step, fn) {
        const n = Math.ceil((T + 0.01) / s16);
        for (let k = 0; k < n; k += step) {
          const tl = k * s16;
          if (tl < from - 0.001 || tl >= T + 0.05) continue;
          fn({ tl, k, pos: k % 16, bar: Math.floor(k / 16), t: t0 + tl, pre: tl < R - 1e-6 });
        }
      },
      // Drums are muffled before the drop, then the filter opens on the reveal.
      muffle(freq) {
        s.drumLP.frequency.setValueAtTime(from < R ? freq : 20000, Math.max(ctx.currentTime, t0 + from));
        if (from < R) s.drumLP.frequency.setValueAtTime(20000, t0 + R);
      },
      riser(len, v) {
        if (from < R) I.riser(s.music, t0 + Math.max(from, R - len), t0 + R, v);
      },
    };
    COMP[tk.comp](c);
  };

  // Play an uploaded track so its "drop" point lines up with timeline time R.
  AE.playTrack = (s, track, { R, t0, from = 0, T }) => {
    const songPos = track.drop - R + from;
    const when = t0 + from + Math.max(0, -songPos);
    const src = ctx.createBufferSource();
    src.buffer = track.buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, Math.max(ctx.currentTime, t0 + T - 0.25));
    g.gain.linearRampToValueAtTime(0.0001, t0 + T + 0.05);
    src.connect(g).connect(s.music);
    src.start(Math.max(when, ctx.currentTime), Math.max(0, songPos));
    src.stop(t0 + T + 0.1);
    s.sources.push(src);
  };

  // ---------- previews & offline rendering ----------
  let preview = null;
  AE.stopPreview = () => {
    if (preview) { AE.stopSession(preview.s); clearTimeout(preview.timer); preview = null; }
  };
  // Plays a library item; onEnd fires when it finishes. Returns the duration in seconds.
  AE.preview = async (kind, id, onEnd) => {
    AE.stopPreview();
    await AE.resume();
    const s = AE.startSession({ musicVol: 0.9, sfxVol: 0.9 });
    let dur;
    if (kind === 'music') {
      const tk = AE.track(id);
      const beat = 60 / tk.bpm, R = 8 * beat, T = R + 8 * beat;
      AE.scheduleMusic(s, id, { bpm: tk.bpm, R, T, t0: AE.now() + 0.05 });
      dur = T + 0.5;
    } else {
      const x = AE.sfxInfo(id);
      x.play(s.sfx, AE.now() + 0.05 + x.lead, 1);
      dur = x.len + x.lead + 0.6;
    }
    const p = { s, timer: setTimeout(() => { if (preview === p) { preview = null; onEnd && onEnd(); } }, dur * 1000) };
    preview = p;
    return dur;
  };

  // Renders a library item to an AudioBuffer without playing it.
  AE.renderOffline = async (kind, id) => {
    AE.init();
    let dur, build;
    if (kind === 'music') {
      const tk = AE.track(id);
      const beat = 60 / tk.bpm, R = 8 * beat, T = R + 16 * beat;
      dur = T + 1.5;
      build = (s) => AE.scheduleMusic(s, id, { bpm: tk.bpm, R, T, t0: 0.02 });
    } else {
      const x = AE.sfxInfo(id);
      dur = x.len + x.lead + 1.2;
      build = (s) => x.play(s.sfx, 0.02 + x.lead, 1);
    }
    // must match the reverb impulse's sample rate
    const sr = ctx.sampleRate;
    const off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const prev = ctx;
    ctx = off;
    try {
      const b = makeBus(off, off.destination);
      build(makeSession(b, { musicVol: 0.9, sfxVol: 0.9 }));
    } finally {
      ctx = prev;
    }
    return await off.startRendering();
  };

  // Renders a whole timeline (music + effects) to a stereo buffer, faster than real time.
  AE.renderSession = async (T, build, opts) => {
    AE.init();
    const sr = ctx.sampleRate;
    const off = new OfflineAudioContext(2, Math.ceil(sr * (T + 0.3)), sr);
    const prev = ctx;
    ctx = off;
    try {
      const b = makeBus(off, off.destination);
      build(makeSession(b, opts));
    } finally {
      ctx = prev;
    }
    return await off.startRendering();
  };

  AE.toWav = (buf) => {
    const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
    out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const data = [...Array(ch)].map((_, i) => buf.getChannelData(i));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v * 32767, true); o += 2; }
    return new Blob([out], { type: 'audio/wav' });
  };

  // ---------- uploaded track analysis ----------
  AE.decode = async (arrayBuffer) => {
    AE.init();
    return await new Promise((res, rej) => ctx.decodeAudioData(arrayBuffer, res, rej));
  };

  // Estimates tempo, beat phase and the most likely "drop" (biggest rise in loudness).
  AE.analyze = (buffer) => {
    const sr = buffer.sampleRate;
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
    const hop = 512, n = Math.floor(ch0.length / hop), hopT = hop / sr;
    const envl = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = i * hop; j < (i + 1) * hop; j += 2) {
        const v = (ch0[j] + ch1[j]) * 0.5;
        sum += v * v;
      }
      envl[i] = Math.sqrt(sum / (hop / 2));
    }
    const onset = new Float32Array(n);
    for (let i = 1; i < n; i++) onset[i] = Math.max(0, Math.log(envl[i] + 1e-4) - Math.log(envl[i - 1] + 1e-4));
    const lim = Math.min(n, Math.floor(45 / hopT));
    let best = 120, bestScore = -1;
    for (let bpm = 70; bpm <= 180; bpm += 0.5) {
      const lag = 60 / bpm / hopT;
      let sc = 0;
      for (let i = 0; i + 2 * lag < lim; i += 1) sc += onset[i] * (onset[Math.round(i + lag)] + 0.5 * onset[Math.round(i + 2 * lag)]);
      sc /= Math.max(1, lim - 2 * lag);
      sc *= 1 - Math.abs(bpm - 115) / 400;
      if (sc > bestScore) { bestScore = sc; best = bpm; }
    }
    const lag = 60 / best / hopT;
    let phase = 0, phaseScore = -1;
    for (let p = 0; p < lag; p++) {
      let sc = 0;
      for (let i = p; i < lim; i += lag) sc += onset[Math.round(i)];
      if (sc > phaseScore) { phaseScore = sc; phase = p; }
    }
    const beatOffset = phase * hopT;
    const win = Math.round(2 / hopT);
    const pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + envl[i];
    const mean = (a, b) => (pre[Math.min(n, b)] - pre[Math.max(0, a)]) / Math.max(1, Math.min(n, b) - Math.max(0, a));
    let drop = Math.min(8, buffer.duration / 2), dropScore = -1;
    const maxI = Math.min(n - win, Math.floor(120 / hopT));
    for (let i = Math.floor(3 / hopT); i < maxI; i += 4) {
      const after = mean(i, i + win), before = mean(i - win, i);
      const sc = (after / (before + 1e-3)) * after;
      if (sc > dropScore) { dropScore = sc; drop = i * hopT; }
    }
    drop = AE.snapToBeat(drop, best, beatOffset);
    const bins = 800, peaks = new Float32Array(bins);
    const per = Math.floor(ch0.length / bins);
    for (let b = 0; b < bins; b++) {
      let mx = 0;
      for (let j = b * per; j < (b + 1) * per; j += 16) mx = Math.max(mx, Math.abs(ch0[j]));
      peaks[b] = mx;
    }
    return { bpm: Math.round(best * 2) / 2, beatOffset, drop, peaks, duration: buffer.duration };
  };
  AE.snapToBeat = (t, bpm, offset) => {
    const beat = 60 / bpm;
    return Math.max(0, offset + Math.round((t - offset) / beat) * beat);
  };
})();
