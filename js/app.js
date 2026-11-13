/* App shell: fonts, startup, sound library entry point. */
(function () {
  const FONT_SPECS = [
    '400 32px "Source Serif 4"', 'italic 400 32px "Source Serif 4"', '700 32px "Playfair Display"', 'italic 400 32px "Playfair Display"',
    '400 32px "Newsreader"', 'italic 400 32px "Newsreader"', '600 32px "Newsreader"', '400 32px "Bodoni Moda"', '700 32px "Bodoni Moda"', 'italic 700 32px "Bodoni Moda"', '900 32px "Bodoni Moda"', 'italic 400 32px "Bodoni Moda"',
    '400 32px "Old Standard TT"', '700 32px "Old Standard TT"', 'italic 400 32px "Old Standard TT"', '400 32px "UnifrakturMaguntia"',
    '400 32px "Libre Franklin"', '700 32px "Libre Franklin"', '800 32px "Libre Franklin"', 'italic 400 32px "Libre Franklin"', '400 32px "Anton"',
    '400 32px "PT Serif"', '700 32px "PT Serif"', 'italic 400 32px "PT Serif"', '400 32px "EB Garamond"', '500 32px "EB Garamond"', 'italic 400 32px "EB Garamond"',
    '400 32px "IBM Plex Sans"', '600 32px "IBM Plex Sans"', 'italic 400 32px "IBM Plex Sans"', '400 32px "Courier Prime"', '700 32px "Courier Prime"', 'italic 400 32px "Courier Prime"',
    '400 32px "Inter"', '600 32px "Inter"', '700 32px "Inter"', '800 32px "Inter"', '400 32px "IBM Plex Mono"', '400 32px "Rye"', '400 32px "Permanent Marker"', '700 32px "Oswald"', '500 32px "Oswald"', '900 32px "Bodoni Moda"',
  ];

  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('cutpress.theme', t); } catch (e) {}
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === 'dark' ? '#141310' : '#ecebe6';
    const b = U.$('#theme-toggle');
    b.innerHTML = U.ic(t === 'dark' ? 'sun' : 'moon');
    const label = I18N.t(t === 'dark' ? 'Light theme' : 'Dark theme');
    b.title = label;
    b.setAttribute('aria-label', label);
    b._en = null;
  }
  function langButton() {
    const b = U.$('#lang-toggle');
    b.textContent = I18N.lang === 'fr' ? 'EN' : 'FR';
    b.title = I18N.lang === 'fr' ? 'English' : 'Français';
    b.setAttribute('aria-label', b.title);
    b._enA = null;
  }

  async function boot() {
    await U.loadFonts(FONT_SPECS);
    I18N.init();
    // sticky preview sits just under the header, whatever its height
    const mast = U.$('.mast');
    const setMast = () => document.documentElement.style.setProperty('--mast-h', mast.offsetHeight + 'px');
    setMast();
    if (window.ResizeObserver) new ResizeObserver(setMast).observe(mast);
    // when the stock pictures arrive, redraw pages that used placeholders
    STOCK.onready = () => { if (MC.tl) { MC.resetFrames(); MC.cache.clear(); if (!MC.playing) MC.draw(MC.pos); MC.renderStyleThumbs(); } };
    AE.onRecorded = () => {
      MC.sanitize(MC.state);
      MC.renderSfxPills();
      if (!U.$('#lib').hidden) LIB.render();
      LIB.counts && LIB.counts();
    };
    AE.recP = AE.loadRecorded();
    STOCK.load();
    LIB.init();
    MC.init();
    U.$('#nav-sounds').onclick = () => {
      MC.stop();
      LIB.open({
        kind: 'sfx',
        selected: MC.state.music,
        slots: [{ slot: 'cutSfx', label: 'Every cut' }, { slot: 'revealSfx', label: 'Last frame' }],
        onPick: (id, slot) => {
          if (slot) { MC.state[slot] = id; MC.renderSfxPills(); MC.save(); }
          else { MC.setMusic(id); U.toast('Music added to your video.'); }
        },
      });
    };
    const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    setTheme(cur);
    U.$('#theme-toggle').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    langButton();
    U.$('#lang-toggle').onclick = () => I18N.set(I18N.lang === 'fr' ? 'en' : 'fr');
    const DEF = { en: ['Every great story starts with one word', 'Local bakery opens its doors', 2], fr: ['Chaque belle histoire commence par un mot', 'Une boulangerie ouvre ses portes', 2] };
    const swapDefaults = (lang) => {
      const from = lang === 'fr' ? 'en' : 'fr';
      if (MC.state.phrase === DEF[from][0]) { MC.state.phrase = DEF[lang][0]; MC.state.focus = [DEF[lang][2]]; }
      if (MC.state.headline === DEF[from][1]) MC.state.headline = DEF[lang][1];
    };
    swapDefaults(I18N.lang);
    MC.syncControls();
    MC.rebuild();
    I18N.onchange((lang) => {
      swapDefaults(lang);
      langButton();
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
      MC.syncControls();
      MC.updateInfo();
      MC.setPlayButton();
      MC.resetFrames();
      MC.cache.clear();
      if (!MC.playing) MC.draw(MC.pos);
      MC.renderStyleThumbs();
      if (!U.$('#lib').hidden) LIB.render();
    });
    STORE.init();
    await STORE.applyHash();
    // install button + offline support
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; U.$('#install-btn').hidden = false; });
    U.$('#install-btn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; U.$('#install-btn').hidden = true; };
    window.addEventListener('appinstalled', () => (U.$('#install-btn').hidden = true));
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    U.$('#export-cancel').onclick = () => REC.cancel();
    U.$$('.share-btn').forEach((b) => (b.onclick = REC.share));
    REC.updateShare();
    if (!REC.supported()) U.toast('Video export is not available in this browser. Try Chrome or Edge.', 6000);
    U.$('#loading').remove();
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || !U.$('#lib').hidden) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return;
      e.preventDefault();
      MC.toggle();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
