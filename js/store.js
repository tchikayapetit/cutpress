/* On-device storage: saved projects, video history, and share links.
   Everything lives in this browser (IndexedDB). Nothing is uploaded. */
(function () {
  const ST = (window.STORE = {});
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = (s, v) => I18N.t(s, v);
  const MAX_VIDEOS = 12;

  // ---------- IndexedDB ----------
  const open = () =>
    new Promise((res, rej) => {
      const req = indexedDB.open('cutpress-work', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('projects', { keyPath: 'id' });
        db.createObjectStore('videos', { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const out = fn(t.objectStore(store));
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  const all = (store) => tx(store, 'readonly', (s) => s.getAll());
  const put = (store, v) => tx(store, 'readwrite', (s) => s.put(v));
  const del = (store, id) => tx(store, 'readwrite', (s) => s.delete(id));
  const get = (store, id) => tx(store, 'readonly', (s) => s.get(id));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const thumb = (canvas, w = 180) => {
    const c = U.makeCanvas(w, Math.round((w * canvas.height) / canvas.width));
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  };

  // ---------- projects ----------
  ST.saveProject = async (name) => {
    name = (name || '').trim() || (MC.state.mode === 'photo' ? MC.state.headline : MC.state.phrase).slice(0, 40) || 'Untitled';
    if (!MC.playing) MC.draw(Math.min(MC.tl.R * 0.6, MC.tl.T));
    const rec = {
      id: uid(), name, date: Date.now(), thumb: thumb(MC.canvas),
      state: JSON.parse(JSON.stringify(MC.state)), photos: MC.photos.map((i) => i.src),
    };
    await put('projects', rec);
    return rec;
  };
  ST.openProject = async (id) => {
    const rec = await get('projects', id);
    if (!rec) return;
    MC.stop();
    MC.state = MC.sanitize(Object.assign({}, MC.state, rec.state));
    MC.photos = [];
    for (const src of rec.photos || []) { try { MC.photos.push(await U.loadImage(src)); } catch (e) {} }
    MC.logoImg = MC.state.logo ? await U.loadImage(MC.state.logo).catch(() => null) : null;
    MC.syncControls();
    MC.rebuild();
    MC.renderStyleThumbs();
    U.toast(T('Project opened.'));
  };

  // ---------- video history ----------
  ST.addVideo = async (file) => {
    const rec = { id: uid(), name: file.name, date: Date.now(), size: file.size, thumb: thumb(MC.canvas), blob: file, mode: MC.state.mode, dur: MC.tl ? MC.tl.T : 0 };
    await put('videos', rec);
    const list = (await all('videos')).sort((a, b) => b.date - a.date);
    for (const old of list.slice(MAX_VIDEOS)) await del('videos', old.id);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  };

  // ---------- share link ----------
  const b64 = {
    enc: (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
  };
  async function pipe(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
  ST.shareLink = async () => {
    const s = Object.assign({}, MC.state);
    delete s.logo;
    const json = new TextEncoder().encode(JSON.stringify(s));
    let tag = 'p', bytes = json;
    if (typeof CompressionStream !== 'undefined') { bytes = await pipe(json, new CompressionStream('deflate-raw')); tag = 'z'; }
    const url = new URL(location.href);
    url.search = '';
    url.hash = `s=${tag}${b64.enc(bytes)}`;
    return url.toString();
  };
  ST.applyHash = async () => {
    const m = /^#s=([pz])(.+)$/.exec(location.hash);
    if (!m) return false;
    try {
      let bytes = b64.dec(m[2]);
      if (m[1] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
      const incoming = JSON.parse(new TextDecoder().decode(bytes));
      delete incoming.logo;
      MC.state = MC.sanitize(Object.assign({}, MC.state, incoming));
      history.replaceState(null, '', location.pathname + location.search);
      MC.syncControls();
      MC.rebuild();
      MC.renderStyleThumbs();
      U.toast(T('Settings loaded from the link.'));
      return true;
    } catch (e) {
      U.toast(T('That link could not be read.'));
      return false;
    }
  };
  ST.copyLink = async () => {
    const link = await ST.shareLink();
    try { await navigator.clipboard.writeText(link); U.toast(T('Link copied. It keeps your text and settings, not your photos.'), 4500); }
    catch (e) { window.prompt(T('Copy this link:'), link); }
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: document.title, url: link }); } catch (e) {} }
  };

  // ---------- "My work" window ----------
  let tab = 'projects';
  const fmtDate = (t) => new Date(t).toLocaleString(I18N.locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtSize = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB');

  ST.openWork = (t) => {
    if (t) tab = t;
    U.$('#work').hidden = false;
    document.body.classList.add('modal-open');
    ST.renderWork();
  };
  ST.closeWork = () => {
    U.$('#work').hidden = true;
    document.body.classList.remove('modal-open');
    const v = U.$('#work-video');
    if (v) { v.pause(); URL.revokeObjectURL(v.src); }
  };

  ST.renderWork = async () => {
    U.$$('.work-tab').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const box = U.$('#work-list');
    const rows = tab === 'projects' ? (await all('projects')).sort((a, b) => b.date - a.date) : (await all('videos')).sort((a, b) => b.date - a.date);
    let h = '';
    if (tab === 'projects') {
      h += `<div class="work-new"><input id="work-name" type="text" maxlength="50" placeholder="${esc(T('Name this project'))}" aria-label="${esc(T('Name this project'))}"><button type="button" class="btn-sm on" id="work-save">${esc(T('Save current'))}</button></div>`;
    } else {
      h += `<div id="work-player" hidden><video id="work-video" controls playsinline></video></div>`;
    }
    if (!rows.length) h += `<p class="lib-empty">${esc(T(tab === 'projects' ? 'No saved projects yet.' : 'Videos you make will appear here, kept on this device.'))}</p>`;
    for (const r of rows) {
      h += `<div class="lib-row work-row" data-id="${r.id}">
        <img class="w-thumb" alt="" src="${r.thumb}">
        <div class="lib-main"><div class="lib-name">${esc(r.name)}</div><div class="lib-meta">${esc(fmtDate(r.date))}${r.size ? ' · ' + fmtSize(r.size) : ''}${r.dur ? ' · ' + r.dur.toFixed(1) + 's' : ''}</div></div>
        ${tab === 'projects' ? `<button type="button" class="btn-sm" data-act="open">${esc(T('Open'))}</button>` : `<button type="button" class="btn-sm" data-act="play">${esc(T('Play'))}</button><button type="button" class="btn-sm" data-act="dl">${esc(T('Download'))}</button>`}
        <button type="button" class="lib-icon" data-act="del" aria-label="${esc(T('Delete'))}" title="${esc(T('Delete'))}">${U.ic('x')}</button>
      </div>`;
    }
    box.innerHTML = h;
    const store = tab === 'projects' ? 'projects' : 'videos';
    const sv = U.$('#work-save');
    if (sv) sv.onclick = async () => { await ST.saveProject(U.$('#work-name').value); U.toast(T('Project saved on this device.')); ST.renderWork(); };
    for (const b of U.$$('[data-act]', box)) {
      b.onclick = async () => {
        const id = b.closest('.work-row').dataset.id, act = b.dataset.act;
        if (act === 'del') { await del(store, id); ST.renderWork(); }
        else if (act === 'open') { ST.closeWork(); await ST.openProject(id); }
        else {
          const rec = await get('videos', id);
          if (!rec) return;
          if (act === 'dl') U.download(rec.blob, rec.name);
          else {
            const v = U.$('#work-video');
            URL.revokeObjectURL(v.src);
            v.src = URL.createObjectURL(rec.blob);
            U.$('#work-player').hidden = false;
            v.play().catch(() => {});
            v.scrollIntoView({ block: 'nearest' });
          }
        }
      };
    }
    try {
      const e = await navigator.storage.estimate();
      U.$('#work-foot').textContent = T('Kept on this device only · {used} used', { used: fmtSize(e.usage || 0) });
    } catch (err) { U.$('#work-foot').textContent = T('Kept on this device only'); }
  };

  ST.init = () => {
    U.$$('.work-tab').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; ST.renderWork(); }));
    U.$('#work-close').onclick = ST.closeWork;
    U.$('#work').addEventListener('click', (e) => { if (e.target.id === 'work') ST.closeWork(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !U.$('#work').hidden) ST.closeWork(); });
    U.$('#mc-mywork').onclick = () => ST.openWork('projects');
    U.$('#mc-videos').onclick = () => ST.openWork('videos');
    U.$('#mc-saveproj').onclick = async () => { await ST.saveProject(); U.toast(T('Project saved on this device.')); };
    U.$('#mc-sharelink').onclick = ST.copyLink;
    REC.onSaved = (file) => { ST.addVideo(file).catch(() => {}); };
    I18N.onchange(() => { if (!U.$('#work').hidden) ST.renderWork(); });
  };
})();
