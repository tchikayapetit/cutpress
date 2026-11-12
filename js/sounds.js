/* Sound library browser: search, categories, preview, favorites, WAV download. */
(function () {
  const LIB = (window.LIB = { kind: 'music', cat: 'All', q: '', opts: {}, playing: null });
  let favs = new Set();
  try { favs = new Set(JSON.parse(localStorage.getItem('cutpress.favs') || '[]')); } catch (e) {}
  const saveFavs = () => { try { localStorage.setItem('cutpress.favs', JSON.stringify([...favs])); } catch (e) {} };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const items = () => (LIB.kind === 'music' ? AE.TRACKS : AE.SFX_LIB);
  const cats = () => ['All', 'Favorites'].concat(LIB.kind === 'music' ? AE.GENRES : AE.SFX_CATS);
  const catOf = (x) => (LIB.kind === 'music' ? x.genre : x.cat);
  const T = (s) => I18N.t(s);
  const tags = (x) => x.tags.map(T).join(', ');
  const meta = (x) =>
    LIB.kind === 'music' ? `${T(x.genre)} · ${x.bpm} BPM · ${tags(x)}` : `${T(x.cat)} · ${x.len < 1 ? T('short') : x.len.toFixed(1) + 's'} · ${tags(x)}`;

  // opts: { kind, selected, onPick(id, slot), slots: [{slot,label}], allowNone, allowUpload, onUpload }
  LIB.open = (opts = {}) => {
    LIB.opts = opts;
    LIB.kind = opts.kind || 'music';
    LIB.cat = 'All';
    LIB.q = '';
    U.$('#lib-search').value = '';
    U.$('#lib').hidden = false;
    document.body.classList.add('modal-open');
    LIB.render();
    setTimeout(() => U.$('#lib-search').focus(), 50);
  };
  LIB.close = () => {
    AE.stopPreview();
    LIB.playing = null;
    U.$('#lib').hidden = true;
    document.body.classList.remove('modal-open');
  };

  LIB.render = () => {
    U.$$('.lib-tab').forEach((b) => {
      const on = b.dataset.kind === LIB.kind;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    });
    U.$('#lib-count-music').textContent = AE.TRACKS.length;
    U.$('#lib-count-sfx').textContent = AE.SFX_LIB.length;
    const cb = U.$('#lib-cats');
    cb.innerHTML = cats().map((c) => `<button type="button" class="pill${c === LIB.cat ? ' on' : ''}" data-cat="${esc(c)}">${c === 'Favorites' ? '♥ ' : ''}${esc(c)}</button>`).join('');
    U.$$('[data-cat]', cb).forEach((b) => (b.onclick = () => { LIB.cat = b.dataset.cat; LIB.render(); }));

    const q = LIB.q.trim().toLowerCase();
    const list = items().filter((x) => {
      if (LIB.cat === 'Favorites' && !favs.has(x.id)) return false;
      if (LIB.cat !== 'All' && LIB.cat !== 'Favorites' && catOf(x) !== LIB.cat) return false;
      if (q && !(x.name + ' ' + T(x.name) + ' ' + catOf(x) + ' ' + T(catOf(x)) + ' ' + x.tags.join(' ') + ' ' + x.tags.map(T).join(' ')).toLowerCase().includes(q)) return false;
      return true;
    });
    const sel = LIB.opts.selected;
    const slots = LIB.opts.slots && LIB.kind === 'sfx' ? LIB.opts.slots : null;
    let h = '';
    if (LIB.cat === 'All' && !q && LIB.kind === 'music') {
      if (LIB.opts.allowNone) h += `<div class="lib-row special${sel === 'none' ? ' sel' : ''}"><span class="lib-ico">∅</span><div class="lib-main"><div class="lib-name">No music</div><div class="lib-meta">Only sound effects</div></div><button type="button" class="btn-sm lib-use" data-id="none">${sel === 'none' ? '✓ Selected' : 'Use'}</button></div>`;
      if (LIB.opts.allowUpload) h += `<div class="lib-row special"><span class="lib-ico">⬆</span><div class="lib-main"><div class="lib-name">Upload my own track</div><div class="lib-meta">MP3, WAV or M4A. Tempo and drop are detected for you.</div></div><button type="button" class="btn-sm" id="lib-upload">Upload</button></div>`;
    }
    if (LIB.cat === 'All' && !q && LIB.kind === 'sfx' && LIB.opts.allowNone) {
      h += `<div class="lib-row special${sel === 'none' ? ' sel' : ''}"><span class="lib-ico">∅</span><div class="lib-main"><div class="lib-name">No sound</div><div class="lib-meta">Silence for this moment</div></div><button type="button" class="btn-sm lib-use" data-id="none">${sel === 'none' ? '✓ Selected' : 'Use'}</button></div>`;
    }
    for (const x of list) {
      const isSel = sel === x.id;
      const useBtns = slots
        ? slots.map((s) => `<button type="button" class="btn-sm lib-use" data-id="${x.id}" data-slot="${s.slot}">${esc(s.label)}</button>`).join('')
        : LIB.opts.onPick
        ? `<button type="button" class="btn-sm lib-use${isSel ? ' on' : ''}" data-id="${x.id}">${isSel ? '✓ Selected' : 'Use'}</button>`
        : '';
      h += `<div class="lib-row${isSel ? ' sel' : ''}${LIB.playing === x.id ? ' playing' : ''}" data-row="${x.id}">
        <button type="button" class="lib-play" data-play="${x.id}" aria-label="Preview ${esc(x.name)}">${LIB.playing === x.id ? '■' : '▶'}</button>
        <div class="lib-main"><div class="lib-name">${esc(x.name)}</div><div class="lib-meta">${esc(meta(x))}</div></div>
        <button type="button" class="lib-icon${favs.has(x.id) ? ' fav' : ''}" data-fav="${x.id}" aria-label="Favorite">${favs.has(x.id) ? '♥' : '♡'}</button>
        <button type="button" class="lib-icon" data-dl="${x.id}" title="Download WAV" aria-label="Download WAV">⬇</button>
        ${useBtns}
      </div>`;
    }
    if (!list.length) h += `<p class="lib-empty">${LIB.cat === 'Favorites' ? 'Tap ♡ on a sound to save it here.' : 'No sounds match your search.'}</p>`;
    const box = U.$('#lib-list');
    box.innerHTML = h;

    U.$$('[data-play]', box).forEach((b) => (b.onclick = () => LIB.togglePlay(b.dataset.play)));
    U.$$('[data-fav]', box).forEach((b) => (b.onclick = () => {
      const id = b.dataset.fav;
      favs.has(id) ? favs.delete(id) : favs.add(id);
      saveFavs();
      LIB.render();
    }));
    U.$$('[data-dl]', box).forEach((b) => (b.onclick = () => LIB.download(b.dataset.dl, b)));
    U.$$('.lib-use', box).forEach((b) => (b.onclick = () => {
      if (LIB.opts.onPick) LIB.opts.onPick(b.dataset.id, b.dataset.slot);
      if (!slots) LIB.close();
      else U.toast(I18N.t('Set for {what}.', { what: b.textContent.toLowerCase() }));
    }));
    const up = U.$('#lib-upload', box);
    if (up) up.onclick = () => { LIB.close(); LIB.opts.onUpload && LIB.opts.onUpload(); };
  };

  LIB.togglePlay = async (id) => {
    if (LIB.playing === id) {
      AE.stopPreview();
      LIB.playing = null;
      return LIB.render();
    }
    LIB.playing = id;
    LIB.render();
    await AE.preview(LIB.kind, id, () => {
      if (LIB.playing === id) { LIB.playing = null; LIB.render(); }
    });
  };

  LIB.download = async (id, btn) => {
    const x = items().find((i) => i.id === id);
    btn.textContent = '…';
    try {
      const buf = await AE.renderOffline(LIB.kind, id);
      U.download(AE.toWav(buf), `${x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wav`);
    } catch (e) {
      console.error(e);
      U.toast('Could not render this sound.');
    }
    btn.textContent = '⬇';
  };

  LIB.init = () => {
    U.$$('.lib-tab').forEach((b) => (b.onclick = () => {
      AE.stopPreview();
      LIB.playing = null;
      LIB.kind = b.dataset.kind;
      LIB.cat = 'All';
      LIB.render();
    }));
    U.$('#lib-search').addEventListener('input', (e) => { LIB.q = e.target.value; LIB.render(); });
    U.$('#lib-close').onclick = LIB.close;
    U.$('#lib').addEventListener('click', (e) => { if (e.target.id === 'lib') LIB.close(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !U.$('#lib').hidden) LIB.close(); });
  };
})();
