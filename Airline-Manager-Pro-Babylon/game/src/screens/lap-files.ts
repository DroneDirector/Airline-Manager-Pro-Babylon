/* The in-game computers and phone, part two: their files and their system.
 *  - Photos (your screenshots and photos), Videos (your recordings) and My Documents (reports you make here and files
 *    you add from your device): folders, drag a file onto a folder (mouse, or press and drag on a touch screen),
 *    right-click or press and hold for Open, Rename, Move to, Delete; sort by name, date, size or date made; filter.
 *  - Documents: today's schedule, a weather report, a dispatch sheet, a flight report, made from your airline as it
 *    is now; PDFs and other files from your device (a copy: deleting it on the device doesn't touch the game's).
 *    Open, print here (it comes out of the printer in the room) or print on a real printer.
 *  - Recorder: a record button and a photo button in every 3D place; recordings go to Videos, photos to Photos.
 *  - The start menu (the star): shortcuts and folders of apps (the bank in its own folder, and more as they come).
 *  - Search on the taskbar: apps, folders, photos, videos and documents by name.
 *  - Settings: each computer and the phone its own (wallpaper, colour, text size…), and Update: the game's update. */

type LapFile = { id: string; kind: 'video' | 'doc'; name: string; at: number; created: number; size: number; type: string; blob?: Blob; thumb?: string; dur?: number; folder?: string };
const FileDb = {
  _db: null as Promise<IDBDatabase>,
  db(): Promise<IDBDatabase> {
    if (this._db) return this._db;
    this._db = new Promise((ok, no) => { try { const r = indexedDB.open('amp-files', 1); r.onupgradeneeded = () => { r.result.createObjectStore('files', { keyPath: 'id' }); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
    return this._db;
  },
  put(f: LapFile): Promise<void> { return this.db().then(d => new Promise<void>((ok, no) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').put(f); t.oncomplete = () => ok(); t.onerror = () => no(t.error); })); },
  all(kind?: string): Promise<LapFile[]> { return this.db().then(d => new Promise<LapFile[]>((ok, no) => { const r = d.transaction('files').objectStore('files').getAll(); r.onsuccess = () => ok(((r.result || []) as LapFile[]).filter(f => !kind || f.kind === kind)); r.onerror = () => no(r.error); })); },
  get(id: string): Promise<LapFile> { return this.db().then(d => new Promise<LapFile>(ok => { const r = d.transaction('files').objectStore('files').get(id); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); })); },
  del(id: string): Promise<void> { return this.db().then(d => new Promise<void>(ok => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').delete(id); t.oncomplete = () => ok(); })); },
};
/** Folders and names kept with the save (the files themselves stay on this device). */
function fsMeta(): any { const S: any = State; S.fsMeta = S.fsMeta || {}; for (const k of ['photos', 'videos', 'docs']) { S.fsMeta[k] = S.fsMeta[k] || { folders: [], of: {}, names: {} }; } return S.fsMeta; }
const FS_KIND: { [app: string]: 'photos' | 'videos' | 'docs' } = { photos: 'photos', videos: 'videos', docs: 'docs' };
type FsItem = { id: string; name: string; at: number; created: number; size: number; thumb?: string; folder: string; type?: string; src: any };
const LapFs: any = { folder: { photos: '', videos: '', docs: '' }, sort: 'date', dir: -1, q: '', open: '', menu: null, drag: null, newDoc: false };

function fsSizeTxt(n: number): string { return n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? Math.round(n / 1e3) + ' kB' : n + ' B'; }
/** Everything in one of the three places, as items to list. */
function fsItems(kind: 'photos' | 'videos' | 'docs'): Promise<FsItem[]> {
  const M = fsMeta()[kind];
  if (kind === 'photos') return PhotoDb.all().then(all => all.map((p: any) => ({ id: p.id, name: M.names[p.id] || p.cap || 'Photo ' + dateStr(new Date(p.at)).slice(0, 16), at: p.at, created: p.at, size: Math.round((p.data || '').length * 0.75), thumb: p.thumb, folder: M.of[p.id] || '', type: 'image/jpeg', src: p })));
  return FileDb.all(kind === 'videos' ? 'video' : 'doc').then(all => all.map(f => ({ id: f.id, name: M.names[f.id] || f.name, at: f.at, created: f.created || f.at, size: f.size || 0, thumb: f.thumb, folder: M.of[f.id] || f.folder || '', type: f.type, src: f })));
}
function fsSorted(L: FsItem[]): FsItem[] {
  const k = LapFs.sort, d = LapFs.dir;
  return L.slice().sort((a, b) => d * (k === 'name' ? a.name.localeCompare(b.name) : k === 'size' ? a.size - b.size : k === 'created' ? a.created - b.created : a.at - b.at));
}
function fsTitle(kind: string): string { return kind === 'photos' ? 'Photos' : kind === 'videos' ? 'Videos' : 'My Documents'; }

/* ---------- the explorer (Photos, Videos, My Documents) ---------- */
function lapExpHtml(kind: string): string { setTimeout(() => lapExpFill(kind as any), 0); return `<div class="fx" data-fx="${kind}"><p class="muted">Loading…</p></div>`; }
function lapExpFill(kind: 'photos' | 'videos' | 'docs') {
  const el = Lap.root && Lap.root.querySelector(`.fx[data-fx="${kind}"]`) as HTMLElement; if (!el) return;
  fsItems(kind).then(all => {
    if (!el.isConnected) return;
    const M = fsMeta()[kind], cur = LapFs.folder[kind] || '', q = LapFs.q.trim().toLowerCase();
    const open = all.filter(x => x.id === LapFs.open)[0];
    if (open) { el.innerHTML = fsViewerHtml(kind, open); fsViewerAfter(kind, open); return; }
    const folders = (M.folders as { id: string; name: string }[]).filter(f => !q || f.name.toLowerCase().indexOf(q) >= 0);
    const here = fsSorted(all.filter(x => (q ? x.name.toLowerCase().indexOf(q) >= 0 : x.folder === cur)));
    const fName = cur ? ((M.folders.filter((f: any) => f.id === cur)[0] || {}).name || 'Folder') : '';
    const sorts: [string, string][] = [['date', kind === 'photos' ? 'Date taken' : 'Date'], ['name', 'Name'], ['size', 'Size'], ['created', 'Date made']];
    const tile = (x: FsItem) => `<button class="fx-it" data-fx-it="${x.id}" data-act="fx-open" data-k="${kind}" data-id="${x.id}" title="${esc(x.name)}">
        <span class="fx-th">${x.thumb ? `<img src="${x.thumb}" alt="">` : icon(kind === 'videos' ? 'cinema' : /pdf/.test(x.type || '') ? 'logbook' : 'news')}${kind === 'videos' && x.src.dur ? `<i class="fx-dur">${Math.floor(x.src.dur / 60)}:${String(Math.round(x.src.dur % 60)).padStart(2, '0')}</i>` : ''}</span>
        <b>${esc(x.name)}</b><small>${esc(dateStr(new Date(x.at)).slice(0, 16))} · ${fsSizeTxt(x.size)}</small></button>`;
    el.innerHTML = `<div class="fx-bar">
        <span class="fx-crumb"><button data-act="fx-folder" data-k="${kind}" data-f="">${esc(fsTitle(kind))}</button>${cur ? `<i>›</i><b>${esc(fName)}</b>` : ''}</span>
        <span class="fx-sp"></span>
        <input class="fx-q" data-fx-q placeholder="Filter by name" value="${esc(LapFs.q)}" aria-label="Filter by name">
        <select class="fx-sort" data-fx-sort aria-label="Sort">${sorts.map(s => `<option value="${s[0]}" ${LapFs.sort === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}</select>
        <button class="btn ghost sm" data-act="fx-dir" title="${LapFs.dir < 0 ? 'Newest or largest first' : 'Oldest or smallest first'}">${LapFs.dir < 0 ? '↓' : '↑'}</button>
        ${!cur ? `<button class="btn ghost sm" data-act="fx-newfolder" data-k="${kind}">${icon('plus')}New folder</button>` : ''}
        ${kind === 'docs' ? `<button class="btn ghost sm" data-act="fx-newdoc">${icon('plus')}New document</button><label class="btn ghost sm">${icon('download')}Add from device<input type="file" class="fx-add" data-k="docs" multiple hidden></label>` : ''}
        ${kind === 'photos' ? `<label class="btn ghost sm">${icon('download')}Add from device<input type="file" class="fx-add" data-k="photos" accept="image/*" multiple hidden></label>` : ''}
        ${kind === 'videos' ? `<button class="btn ghost sm" data-act="lap-app" data-k="recorder">${icon('cinema')}Recorder</button><label class="btn ghost sm">${icon('download')}Add from device<input type="file" class="fx-add" data-k="videos" accept="video/*" multiple hidden></label>` : ''}
      </div>
      ${LapFs.newDoc && kind === 'docs' ? fsNewDocHtml() : ''}
      <div class="fx-grid">
        ${cur ? `<button class="fx-it fx-fold up" data-fx-fold="" data-act="fx-folder" data-k="${kind}" data-f=""><span class="fx-th">${icon('back')}</span><b>Back</b><small>${esc(fsTitle(kind))}</small></button>` : folders.map(f => `<button class="fx-it fx-fold" data-fx-fold="${f.id}" data-act="fx-folder" data-k="${kind}" data-f="${f.id}" data-fx-it="f:${f.id}"><span class="fx-th">${icon('layers')}</span><b>${esc(f.name)}</b><small>${(n => n + (n === 1 ? " item" : " items"))(all.filter(x => x.folder === f.id).length)}</small></button>`).join('')}
        ${here.map(tile).join('')}
      </div>
      ${!here.length && !folders.length ? `<div class="lp-none">${icon(kind === 'videos' ? 'cinema' : kind === 'docs' ? 'news' : 'camera')}<p>${kind === 'photos' ? 'No photos yet. Take one with the camera button in a 3D place, or add them from your device.' : kind === 'videos' ? 'No recordings yet. Open the Recorder: a record button then shows in every 3D place.' : 'No documents yet. Make one (New document) or add files from your device.'}</p></div>` : ''}
      <p class="fx-tip">${DESKTOP ? 'Drag a file onto a folder to move it. Right-click a file for more.' : 'Press, then drag a file onto a folder to move it. Press and hold a file for more.'}</p>`;
    const qi = el.querySelector('[data-fx-q]') as HTMLInputElement; if (qi && LapFs.qFocus) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  }).catch(() => { el.innerHTML = '<p class="muted">Files can\'t be stored on this device.</p>'; });
}
function fsViewerHtml(kind: string, x: FsItem): string {
  const isPdf = /pdf/.test(x.type || ''), isHtml = /html/.test(x.type || '');
  const media = kind === 'photos' ? `<img src="${x.src.data}" alt="${esc(x.name)}">`
    : kind === 'videos' ? `<video data-fx-media controls playsinline></video>`
    : isHtml ? `<iframe class="fx-doc" data-fx-media sandbox="allow-same-origin" title="${esc(x.name)}"></iframe>`
    : isPdf && DESKTOP ? `<iframe class="fx-doc" data-fx-media title="${esc(x.name)}"></iframe>`
    : /^image\//.test(x.type || '') ? `<img data-fx-media alt="${esc(x.name)}">`
    : `<div class="lp-none">${icon('logbook')}<p>${esc(x.name)}<br><small>${isPdf ? 'PDFs open on your device: Open below.' : 'This kind of file opens on your device.'}</small></p></div>`;
  const canPrint = kind === 'docs' || kind === 'photos';
  return `<div class="fx-view"><div class="fx-vbar"><button class="btn ghost sm" data-act="fx-close">${icon('back')}${esc(fsTitle(kind))}</button><b>${esc(x.name)}</b><span class="fx-sp"></span>
      ${canPrint ? `<button class="btn ghost sm" data-act="fx-print-room" data-k="${kind}" data-id="${x.id}">${icon('news')}Print here</button><button class="btn ghost sm" data-act="fx-print-real" data-k="${kind}" data-id="${x.id}">${icon('download')}Print on a printer</button>` : ''}
      <button class="btn ghost sm" data-act="fx-save" data-k="${kind}" data-id="${x.id}">${icon('download')}${isPdf || !(kind === 'docs') ? 'Save to device' : 'Open on device'}</button>
      <button class="btn ghost sm" data-act="fx-menu-btn" data-k="${kind}" data-id="${x.id}">…</button></div>
    <div class="fx-media">${media}</div><small class="muted">${esc(dateStr(new Date(x.at)))} · ${fsSizeTxt(x.size)}</small></div>`;
}
function fsViewerAfter(kind: string, x: FsItem) {
  const el = Lap.root && Lap.root.querySelector('[data-fx-media]') as any; if (!el || kind === 'photos') return;
  const b: Blob = x.src.blob; if (!b) return;
  if (/html/.test(x.type || '') && el.tagName === 'IFRAME') { b.text().then(t => { el.srcdoc = t; }); return; }
  try { if (LapFs.url) URL.revokeObjectURL(LapFs.url); } catch (e) { /* none */ }
  LapFs.url = URL.createObjectURL(b); el.src = LapFs.url;
}
ACTIONS['fx-open'] = el => { if (LapFs.dragged) { LapFs.dragged = false; return; } LapFs.open = el.getAttribute('data-id'); Sound.tick(); lapExpFill(el.getAttribute('data-k') as any); };
ACTIONS['fx-close'] = () => { LapFs.open = ''; Sound.tick(); const k = FS_KIND[Lap.app]; if (k) lapExpFill(k); };
ACTIONS['fx-folder'] = el => { if (LapFs.dragged) { LapFs.dragged = false; return; } const k = el.getAttribute('data-k'); LapFs.folder[k] = el.getAttribute('data-f') || ''; LapFs.q = ''; Sound.tick(); lapExpFill(k as any); };
ACTIONS['fx-dir'] = () => { LapFs.dir = -LapFs.dir; Sound.tick(); const k = FS_KIND[Lap.app]; if (k) lapExpFill(k); };
ACTIONS['fx-newfolder'] = el => {
  const k = el.getAttribute('data-k'), M = fsMeta()[k], n = M.folders.length + 1, name = (window.prompt('Name of the new folder', 'New folder ' + n) || '').trim().slice(0, 40); if (!name) return;
  M.folders.push({ id: uid(), name }); Store.soon(); Sound.tick(); lapExpFill(k as any);
};
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.hasAttribute || !el.hasAttribute('data-fx-q')) return; LapFs.q = el.value; LapFs.qFocus = true; const k = FS_KIND[Lap.app]; if (k) lapExpFill(k); });
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el) return;
  if (el.hasAttribute && el.hasAttribute('data-fx-sort')) { LapFs.sort = (el as any).value; const k = FS_KIND[Lap.app]; if (k) lapExpFill(k); return; }
  if (el.classList && el.classList.contains('fx-add') && el.files) fsAddFiles(el.getAttribute('data-k') as any, Array.from(el.files));
});
/** Files from your device, copied into the game (removing them on the device later doesn't remove the game's copy). */
function fsAddFiles(kind: 'photos' | 'videos' | 'docs', files: File[]) {
  const folder = LapFs.folder[kind] || '';
  const one = (f: File): Promise<any> => {
    if (kind === 'photos') return Promise.all([_shrink(f, 2000, 0.88), _shrink(f, 320, 0.7)]).then(([big, th]) => { const id = uid(); if (folder) fsMeta().photos.of[id] = folder; fsMeta().photos.names[id] = f.name.replace(/\.[a-z0-9]+$/i, ''); return PhotoDb.put({ id, log: '', at: f.lastModified || Date.now(), data: big.data, thumb: th.data, w: big.w, h: big.h, cap: f.name, mode: Mode.coop() ? 'coop' : 'solo' }); });
    return FileDb.put({ id: uid(), kind: kind === 'videos' ? 'video' : 'doc', name: f.name.replace(/\.[a-z0-9]+$/i, ''), at: Date.now(), created: f.lastModified || Date.now(), size: f.size, type: f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : ''), blob: f, folder });
  };
  Promise.all(files.slice(0, 20).map(one)).then(() => { toast(`${files.length} added to ${fsTitle(kind)}`, 'ok'); Store.soon(); lapExpFill(kind); }).catch(() => toast('They could not be added', 'warn'));
}
ACTIONS['fx-save'] = el => {
  const k = el.getAttribute('data-k'), id = el.getAttribute('data-id');
  fsItems(k as any).then(L => { const x = L.filter(i => i.id === id)[0]; if (!x) return;
    const a = document.createElement('a'); a.download = x.name + (k === 'photos' ? '.jpg' : k === 'videos' ? '.webm' : /pdf/.test(x.type || '') ? '.pdf' : /html/.test(x.type || '') ? '.html' : '');
    a.href = k === 'photos' ? x.src.data : URL.createObjectURL(x.src.blob); document.body.appendChild(a); a.click(); a.remove(); toast('Saved to your device', 'ok'); });
};

/* ---------- the menu (right-click, press and hold, or …) ---------- */
function fsMenuOpen(kind: string, id: string, x: number, y: number) {
  const M = fsMeta()[kind], isFolder = id.indexOf('f:') === 0;
  const items = isFolder ? [['fx-m-open', 'Open'], ['fx-m-rename', 'Rename'], ['fx-m-delete', 'Delete the folder (its files stay)']]
    : [['fx-m-open', 'Open'], ['fx-m-rename', 'Rename'], ['fx-m-move', 'Move to…'], ['fx-m-delete', 'Delete']];
  fsMenuClose();
  const m = document.createElement('div'); m.className = 'fx-menu'; m.style.left = Math.min(x, innerWidth - 220) + 'px'; m.style.top = Math.min(y, innerHeight - 220) + 'px';
  m.innerHTML = items.map(i => `<button data-act="${i[0]}" data-k="${kind}" data-id="${esc(id)}">${esc(i[1])}</button>`).join('')
    + (isFolder ? '' : `<div class="fx-move" hidden>${[['', fsTitle(kind)]].concat(M.folders.map((f: any) => [f.id, f.name])).map((f: any) => `<button data-act="fx-m-to" data-k="${kind}" data-id="${esc(id)}" data-f="${f[0]}">${icon('layers')}${esc(f[1])}</button>`).join('')}</div>`);
  document.body.appendChild(m); LapFs.menu = m;
  setTimeout(() => document.addEventListener('pointerdown', fsMenuAway, true), 0);
}
function fsMenuAway(e: Event) { if (LapFs.menu && !LapFs.menu.contains(e.target as Node)) fsMenuClose(); }
function fsMenuClose() { if (LapFs.menu) { LapFs.menu.remove(); LapFs.menu = null; } document.removeEventListener('pointerdown', fsMenuAway, true); }
ACTIONS['fx-menu-btn'] = el => { const r = el.getBoundingClientRect(); fsMenuOpen(el.getAttribute('data-k'), el.getAttribute('data-id'), r.left, r.bottom + 4); };
ACTIONS['fx-m-open'] = el => { fsMenuClose(); const k = el.getAttribute('data-k'), id = el.getAttribute('data-id'); if (id.indexOf('f:') === 0) LapFs.folder[k] = id.slice(2); else LapFs.open = id; lapExpFill(k as any); };
ACTIONS['fx-m-move'] = el => { const mv = LapFs.menu && LapFs.menu.querySelector('.fx-move') as HTMLElement; if (mv) mv.hidden = !mv.hidden; };
ACTIONS['fx-m-to'] = el => { fsMenuClose(); fsMove(el.getAttribute('data-k'), el.getAttribute('data-id'), el.getAttribute('data-f') || ''); };
ACTIONS['fx-m-rename'] = el => {
  fsMenuClose(); const k = el.getAttribute('data-k'), id = el.getAttribute('data-id'), M = fsMeta()[k];
  if (id.indexOf('f:') === 0) { const f = M.folders.filter((x: any) => x.id === id.slice(2))[0]; if (!f) return; const n = (window.prompt('New name', f.name) || '').trim().slice(0, 40); if (n) { f.name = n; Store.soon(); lapExpFill(k as any); } return; }
  fsItems(k as any).then(L => { const x = L.filter(i => i.id === id)[0]; if (!x) return; const n = (window.prompt('New name', x.name) || '').trim().slice(0, 80); if (n) { M.names[id] = n; Store.soon(); lapExpFill(k as any); } });
};
ACTIONS['fx-m-delete'] = el => {
  fsMenuClose(); const k = el.getAttribute('data-k'), id = el.getAttribute('data-id'), M = fsMeta()[k];
  if (id.indexOf('f:') === 0) { const fid = id.slice(2); M.folders = M.folders.filter((x: any) => x.id !== fid); for (const key of Object.keys(M.of)) if (M.of[key] === fid) delete M.of[key]; Store.soon(); Sound.tick(); lapExpFill(k as any); return; }
  if (!window.confirm('Delete this for good?')) return;
  (k === 'photos' ? PhotoDb.del(id) : FileDb.del(id)).then(() => { delete M.of[id]; delete M.names[id]; if (LapFs.open === id) LapFs.open = ''; Store.soon(); toast('Deleted', 'ok'); lapExpFill(k as any); });
};
function fsMove(kind: string, id: string, folder: string) {
  const M = fsMeta()[kind]; if (folder) M.of[id] = folder; else delete M.of[id];
  if (kind !== 'photos') FileDb.get(id).then(f => { if (f) { f.folder = folder; FileDb.put(f); } });
  Store.soon(); Sound.tick(); const f = M.folders.filter((x: any) => x.id === folder)[0]; toast(`Moved to ${f ? f.name : fsTitle(kind)}`, 'ok'); lapExpFill(kind as any);
}
// dragging a file onto a folder (mouse: just drag; touch: press, then drag), and the menu (right-click, or press and hold)
document.addEventListener('contextmenu', e => { const it = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('[data-fx-it]') as HTMLElement; if (!it) return; e.preventDefault(); const k = FS_KIND[Lap.app]; if (k) fsMenuOpen(k, it.getAttribute('data-fx-it'), e.clientX, e.clientY); });
document.addEventListener('pointerdown', e => {
  const it = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('[data-fx-it]') as HTMLElement; if (!it || e.button > 0) return;
  const id = it.getAttribute('data-fx-it'); if (id.indexOf('f:') === 0 && e.pointerType === 'mouse') return;
  const D: any = { id, it, x0: e.clientX, y0: e.clientY, touch: e.pointerType !== 'mouse', armed: e.pointerType === 'mouse', ghost: null, held: false };
  if (D.touch) D.timer = setTimeout(() => { D.armed = true; D.held = true; try { navigator.vibrate && navigator.vibrate(15); } catch (x) { /* none */ } it.classList.add('fx-lift'); }, 380);
  LapFs.drag = D;
});
document.addEventListener('pointermove', e => {
  const D = LapFs.drag; if (!D) return; const dx = e.clientX - D.x0, dy = e.clientY - D.y0, far = Math.hypot(dx, dy) > 8;
  if (!D.armed) { if (far) { clearTimeout(D.timer); LapFs.drag = null; } return; }   // touch: moved before the press counted: a scroll
  if (!far && !D.ghost) return;
  if (D.id.indexOf('f:') === 0) return;
  if (!D.ghost) { D.ghost = D.it.cloneNode(true) as HTMLElement; D.ghost.className = 'fx-it fx-ghost'; document.body.appendChild(D.ghost); }
  D.ghost.style.left = e.clientX - 40 + 'px'; D.ghost.style.top = e.clientY - 40 + 'px'; e.preventDefault();
  document.querySelectorAll('.fx-fold.over').forEach(x => x.classList.remove('over'));
  const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement, f = under && under.closest && under.closest('[data-fx-fold]'); if (f) f.classList.add('over');
}, { passive: false });
document.addEventListener('pointerup', e => {
  const D = LapFs.drag; if (!D) return; LapFs.drag = null; clearTimeout(D.timer); D.it.classList.remove('fx-lift');
  document.querySelectorAll('.fx-fold.over').forEach(x => x.classList.remove('over'));
  if (D.ghost) {
    D.ghost.remove(); LapFs.dragged = true; setTimeout(() => { LapFs.dragged = false; }, 300);
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement, f = under && under.closest && under.closest('[data-fx-fold]') as HTMLElement, k = FS_KIND[Lap.app];
    if (f && k) fsMove(k, D.id, f.getAttribute('data-fx-fold') || '');
    return;
  }
  if (D.held && D.touch) { LapFs.dragged = true; setTimeout(() => { LapFs.dragged = false; }, 300); const k = FS_KIND[Lap.app]; if (k) fsMenuOpen(k, D.id, e.clientX, e.clientY); }   // pressed and held without moving: the menu
});

/* ---------- documents made here, from your airline as it is now ---------- */
function fsNewDocHtml(): string {
  const mine = (State.live || []).filter((f: any) => f.you || (plane(f.reg) && plane(f.reg).companyId === State.companyId)).slice(0, 12), logs = (State.logbook || []).slice(0, 10);
  return `<div class="fx-new"><b>Make a document</b>
    <button class="btn ghost sm" data-act="fx-mk" data-t="schedule">Today's schedule</button>
    <button class="btn ghost sm" data-act="fx-mk" data-t="weather">Weather report: ${esc(company().hub)}</button>
    ${mine.length ? `<select class="fx-sel" data-fx-dispatch>${mine.map((f: any) => `<option value="${f.id}">${esc(f.callsign)} ${esc(f.from)} → ${esc(f.to)}</option>`).join('')}</select><button class="btn ghost sm" data-act="fx-mk" data-t="dispatch">Dispatch sheet</button>` : ''}
    ${logs.length ? `<select class="fx-sel" data-fx-report>${logs.map((l: any) => `<option value="${l.id}">${esc(l.from)} → ${esc(l.to)}, ${esc(String(l.date).slice(0, 10))}</option>`).join('')}</select><button class="btn ghost sm" data-act="fx-mk" data-t="report">Flight report</button>` : ''}
    <button class="btn ghost sm" data-act="fx-newdoc">Close</button></div>`;
}
ACTIONS['fx-newdoc'] = () => { LapFs.newDoc = !LapFs.newDoc; Sound.tick(); lapExpFill('docs'); };
function fsDocPage(title: string, sub: string, body: string): string {
  const co: any = company();
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font:13px/1.45 Georgia,'Times New Roman',serif;color:#1a1d22;margin:28px 34px;background:#fff}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid ${co.color || '#1d4e89'};padding-bottom:8px;margin-bottom:14px}
    h1{font:700 20px Inter,Arial,sans-serif;margin:0} small{color:#555} .co{font:700 13px Inter,Arial,sans-serif;color:${co.color || '#1d4e89'};text-align:right}
    table{border-collapse:collapse;width:100%;font:12px Inter,Arial,sans-serif;margin:8px 0} th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left} th{background:#f2f4f7}
    code{display:block;white-space:pre-wrap;font:12px 'Courier New',monospace;background:#f6f7f9;padding:8px;border-radius:4px;margin:6px 0} .sig{margin-top:30px;border-top:1px solid #999;width:220px;padding-top:4px;font-size:11px;color:#555}
    @media print{body{margin:12mm}}</style></head><body><header><div><h1>${esc(title)}</h1><small>${esc(sub)}</small></div><div class="co">${esc(co.name)}<br><small>${esc(co.icao || '')} · ${esc(co.hub || '')}</small></div></header>${body}</body></html>`;
}
function fsMakeDoc(t: string): { name: string; html: string } {
  const now = lapGameNow(), ds = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), co: any = company();
  const wx = (icao: string) => { const m: any = (typeof LiveWx !== 'undefined') ? LiveWx.get(icao) : null, A = apt(icao); return `<h3>${esc(icao)} · ${esc(A ? A.name : '')}</h3>${m && m.raw ? `<code>${esc(m.raw)}</code>${m.taf ? `<code>${esc(m.taf)}</code>` : ''}<p>${m.dir >= 0 ? `Wind ${String(m.dir).padStart(3, '0')}° at ${m.kt} kt${m.gust ? ', gusting ' + m.gust : ''}` : 'Wind calm or variable'}${isFinite(m.temp) ? `, ${m.temp}°C` : ''}${m.qnh ? `, QNH ${m.qnh}` : ''}${m.cat ? `. Category: ${esc(m.cat)}` : ''}.</p>` : '<p>No weather report received for this airport (Settings → Online services → live weather).</p>'}`; };
  if (t === 'schedule') {
    const mine = (State.live || []).filter((f: any) => f.you || (plane(f.reg) && plane(f.reg).companyId === State.companyId));
    return { name: `Schedule ${lapYmd(now)}`, html: fsDocPage('Flight schedule', ds, `<table><tr><th>Flight</th><th>From</th><th>To</th><th>Aircraft</th><th>Passengers</th><th>Status</th></tr>${mine.map((f: any) => `<tr><td>${esc(f.callsign)}</td><td>${esc(f.from)}</td><td>${esc(f.to)}</td><td>${esc(f.reg || '')}</td><td>${f.pax || 0}/${f.paxMax || 0}</td><td>${esc(f.phase || '')}</td></tr>`).join('') || '<tr><td colspan="6">No flights today.</td></tr>'}</table>`) };
  }
  if (t === 'weather') return { name: `Weather ${co.hub} ${lapYmd(now)}`, html: fsDocPage('Weather report', ds, wx(co.hub)) };
  if (t === 'dispatch') {
    const sel = Lap.root && Lap.root.querySelector('[data-fx-dispatch]') as HTMLSelectElement, f: any = (State.live || []).filter((x: any) => sel && x.id === sel.value)[0]; if (!f) return null;
    const A = apt(f.from), B = apt(f.to), dist = A && B ? Math.round(gcDistanceNm(A.pos, B.pos)) : 0;
    return { name: `Dispatch ${f.callsign} ${f.from}-${f.to}`, html: fsDocPage(`Dispatch sheet · ${f.callsign}`, ds, `<table><tr><th>Flight</th><td>${esc(f.callsign)}</td><th>Aircraft</th><td>${esc(f.reg || '')}</td></tr><tr><th>From</th><td>${esc(f.from)} ${esc(A ? A.name : '')}</td><th>To</th><td>${esc(f.to)} ${esc(B ? B.name : '')}</td></tr><tr><th>Distance</th><td>${dist} nm</td><th>Passengers</th><td>${f.pax || 0} of ${f.paxMax || 0}</td></tr></table><h2>Weather</h2>${wx(f.from)}${wx(f.to)}<div class="sig">Dispatcher</div><div class="sig">Captain</div>`) };
  }
  if (t === 'report') {
    const sel = Lap.root && Lap.root.querySelector('[data-fx-report]') as HTMLSelectElement, l: any = (State.logbook || []).filter((x: any) => sel && x.id === sel.value)[0]; if (!l) return null;
    return { name: `Flight report ${l.from}-${l.to} ${String(l.date).slice(0, 10)}`, html: fsDocPage('Flight report', `${l.from} → ${l.to} · ${String(l.date).slice(0, 10)}`, `<table><tr><th>Aircraft</th><td>${esc(l.reg)}</td><th>Block time</th><td>${Math.floor(l.blockMin / 60)} h ${l.blockMin % 60} min</td></tr><tr><th>Passengers</th><td>${l.pax}</td><th>Landing</th><td>${l.landingFpm} fpm, ${(+l.g || 0).toFixed(2)} g</td></tr><tr><th>Result</th><td>${esc(l.result)}</td><th>ATC</th><td>${esc(l.atc || '')}</td></tr></table>${l.notes ? `<h2>Notes</h2><p>${esc(l.notes)}</p>` : ''}<div class="sig">Captain</div>`) };
  }
  return null;
}
ACTIONS['fx-mk'] = el => {
  const d = fsMakeDoc(el.getAttribute('data-t')); if (!d) return;
  const blob = new Blob([d.html], { type: 'text/html' });
  FileDb.put({ id: uid(), kind: 'doc', name: d.name, at: Date.now(), created: Date.now(), size: blob.size, type: 'text/html', blob, folder: LapFs.folder.docs || '' }).then(() => { LapFs.newDoc = false; Sound.tick(); toast(`${d.name} saved in My Documents`, 'ok'); lapExpFill('docs'); });
};

/* ---------- printing: here (in the room) or on a real printer ---------- */
ACTIONS['fx-print-real'] = el => {
  const k = el.getAttribute('data-k'), id = el.getAttribute('data-id');
  fsItems(k as any).then(L => { const x = L.filter(i => i.id === id)[0]; if (!x) return;
    const t = (typeof appTools === 'function') ? appTools() : null;
    const html = (h: string) => { if (t && t.printHtml && !DESKTOP) { t.printHtml({ html: h, name: x.name }).catch(() => toast('Printing is not available', 'warn')); return; } const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(f); f.srcdoc = h; f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Printing is not available', 'warn'); } setTimeout(() => f.remove(), 60000); }; };
    if (k === 'photos') { html(`<!doctype html><html><body style="margin:0"><img src="${x.src.data}" style="max-width:100%;max-height:100vh;display:block;margin:auto"></body></html>`); return; }
    if (/html/.test(x.type || '')) { x.src.blob.text().then(html); return; }
    if (/pdf/.test(x.type || '')) {
      if (t && t.printPdf && !DESKTOP) { const r = new FileReader(); r.onload = () => t.printPdf({ base64: String(r.result).split(',')[1], name: x.name }).catch(() => toast('Printing is not available', 'warn')); r.readAsDataURL(x.src.blob); return; }
      const u = URL.createObjectURL(x.src.blob), f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(f); f.src = u; f.onload = () => { try { f.contentWindow.print(); } catch (e) { toast('Open it on your device to print it', 'info'); } }; return;
    }
    toast('Open it on your device to print it', 'info');
  });
};
ACTIONS['fx-print-room'] = el => {
  const k = el.getAttribute('data-k'), id = el.getAttribute('data-id');
  fsItems(k as any).then(L => { const x = L.filter(i => i.id === id)[0]; if (!x) return;
    const R: any = typeof OfficeRoom !== 'undefined' && OfficeRoom.on ? OfficeRoom : typeof OpsRoom !== 'undefined' && OpsRoom.on ? OpsRoom : null;
    if (!R || !R.A || Lap.phone) { toast('Print here works at the computers in your office and in Operations', 'info'); return; }
    roomPrint(R, x.name, k === 'photos' ? x.src.thumb : '');
    toast(`Printing ${x.name}… it comes out of the printer beside you`, 'ok');
  });
};
/** The printer in the room: a sheet slides out with the page on it, and stays in the tray. */
function roomPrint(R: any, title: string, img: string) {
  const T = THREE, A = R.A; if (!A || !A.root) return;
  if (!A.printer) {   // a small office printer at the side of the desk, made once
    const g = new T.Group(), body = new T.MeshStandardMaterial({ color: 0xE9ECEF, roughness: 0.5 }), dark = new T.MeshStandardMaterial({ color: 0x2A2F36, roughness: 0.6 });
    const b = new T.Mesh(new T.BoxGeometry(0.42, 0.2, 0.36), body); b.position.y = 0.1; g.add(b);
    const tray = new T.Mesh(new T.BoxGeometry(0.3, 0.012, 0.2), dark); tray.position.set(0, 0.16, 0.2); tray.rotation.x = -0.12; g.add(tray);
    const led = new T.Mesh(new T.BoxGeometry(0.02, 0.006, 0.004), new T.MeshBasicMaterial({ color: 0x3DDC84 })); led.position.set(0.15, 0.18, 0.181); g.add(led);
    const at = R === OpsRoom ? { x: 1.05, y: 0.76, z: -0.35, r: 0 } : { x: 1.05, y: 0.78, z: 0.1, r: -0.3 };
    g.position.set(at.x, at.y, at.z); g.rotation.y = at.r; A.root.add(g); A.printer = g; A.sheets = [];
  }
  const [c, x] = ctCanvas(256, 362); x.fillStyle = '#FCFCFA'; x.fillRect(0, 0, 256, 362); x.fillStyle = '#1D4E89'; x.fillRect(16, 16, 224, 4);
  x.fillStyle = '#1A1D22'; x.font = '700 15px Inter, Arial, sans-serif'; x.fillText(title.slice(0, 26), 16, 44);
  if (img) { const im = new Image(); im.onload = () => { x.drawImage(im, 16, 60, 224, 160); tex.needsUpdate = true; }; im.src = img; }
  else { x.fillStyle = '#9AA1AA'; for (let i = 0; i < 16; i++) x.fillRect(16, 64 + i * 16, 120 + ((i * 37) % 100), 5); }
  const tex = ctTex(c), sheet = new T.Mesh(new T.PlaneGeometry(0.21, 0.297), new T.MeshStandardMaterial({ map: tex, roughness: 0.9, side: T.DoubleSide }));
  sheet.rotation.x = -Math.PI / 2 + 0.12; sheet.position.set(0, 0.17, 0.02); A.printer.add(sheet); A.sheets.push(sheet);
  try { if (!Sfx.play('printer')) Sound.door('sliding', true); } catch (e) { /* quiet */ }
  const t0 = performance.now(), go = () => { const k = Math.min(1, (performance.now() - t0) / 2600); sheet.position.z = 0.02 + 0.2 * k; sheet.position.y = 0.17 + 0.004 * A.sheets.indexOf(sheet); if (k < 1 && R.on) requestAnimationFrame(go); }; go();
}

/* ---------- the recorder: in every 3D place, a record button and a photo button ---------- */
const Rec: any = { mr: null, chunks: [], t0: 0, cv: null, thumb: '' };
function recShown(): boolean { return (State.settings as any).recShow === true; }
function recCanvas(): HTMLCanvasElement {
  try {
    if (typeof V3d !== 'undefined' && V3d.open && V3d.cv) return V3d.cv as HTMLCanvasElement;
    for (const R of [typeof TestRooms !== 'undefined' ? TestRooms : null, OfficeRoom, OpsRoom, LoungeRoom, HangarRoom, typeof CourtRoom !== 'undefined' ? CourtRoom : null]) if (R && R.on && R.root) { const c = R.root.querySelector('canvas'); if (c) return c; }
  } catch (e) { /* none */ }
  return null;
}
/** One frame of what the 3D place shows, as a picture (through the canvas's own stream, so it never comes out blank). */
function recGrab(cv: HTMLCanvasElement, w: number): Promise<string> {
  return new Promise(ok => {
    try {
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = (cv as any).captureStream(10);
      v.onplaying = () => setTimeout(() => { const s = Math.min(1, w / v.videoWidth), c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); (v.srcObject as MediaStream).getTracks().forEach(t => t.stop()); ok(c.toDataURL('image/jpeg', 0.88)); }, 120);
      v.play().catch(() => ok(''));
    } catch (e) { ok(''); }
  });
}
ACTIONS['rec-toggle'] = () => {
  if (Rec.mr) { try { Rec.mr.stop(); } catch (e) { /* stopped */ } return; }
  const cv = recCanvas(); if (!cv || !(cv as any).captureStream || typeof MediaRecorder === 'undefined') { toast('Recording isn\'t available here', 'warn'); return; }
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].filter(m => (MediaRecorder as any).isTypeSupported && MediaRecorder.isTypeSupported(m))[0] || '';
  const st = (cv as any).captureStream(30), mr = new MediaRecorder(st, mime ? { mimeType: mime, videoBitsPerSecond: DESKTOP ? 8e6 : 4e6 } : undefined);
  Rec.mr = mr; Rec.chunks = []; Rec.t0 = Date.now(); Rec.cv = cv; Rec.thumb = '';
  recGrab(cv, 320).then(t => { Rec.thumb = t; });
  mr.ondataavailable = (e: any) => { if (e.data && e.data.size) Rec.chunks.push(e.data); };
  mr.onstop = () => {
    st.getTracks().forEach((t: any) => t.stop());
    const blob = new Blob(Rec.chunks, { type: mr.mimeType || 'video/webm' }), dur = (Date.now() - Rec.t0) / 1000, d = new Date();
    Rec.mr = null; recSync();
    if (!blob.size) { toast('Nothing was recorded', 'warn'); return; }
    FileDb.put({ id: uid(), kind: 'video', name: `Recording ${lapYmd(d)} ${d.toTimeString().slice(0, 5)}`, at: Date.now(), created: Date.now(), size: blob.size, type: blob.type, blob, thumb: Rec.thumb, dur })
      .then(() => toast(`Recording saved in Videos (${Math.round(dur)} s)`, 'ok')).catch(() => toast('The recording could not be saved', 'warn'));
  };
  mr.start(1000); Sound.tick(); recSync();
};
ACTIONS['rec-photo'] = () => {
  const cv = recCanvas(); if (!cv) return;
  recGrab(cv, 2400).then(data => { if (!data) { toast('No picture this time', 'warn'); return; } recGrab(cv, 320).then(th => { const d = new Date(); PhotoDb.put({ id: uid(), log: '', at: Date.now(), data, thumb: th || data, w: 0, h: 0, cap: `Photo ${lapYmd(d)} ${d.toTimeString().slice(0, 5)}`, mode: Mode.coop() ? 'coop' : 'solo' }).then(() => { toast('Photo saved in Photos', 'ok'); }); }); });
  try { if (!Sfx.play('camera-shutter')) Sound.tick(); } catch (e) { /* quiet */ }
};
/** The recorder's buttons in a 3D place (while switched on in the Recorder app). */
function recSync() {
  let el = document.querySelector('.scn-rec') as HTMLElement;
  const on = recShown() && typeof sceneOpen === 'function' && sceneOpen();
  if (!on && !Rec.mr) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.className = 'scn-rec'; document.body.appendChild(el); }
  const secs = Rec.mr ? Math.floor((Date.now() - Rec.t0) / 1000) : 0;
  const html = `<button class="sr-rec ${Rec.mr ? 'on' : ''}" data-act="rec-toggle" aria-label="${Rec.mr ? 'Stop recording' : 'Record'}"><i></i><span>${Rec.mr ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : 'Record'}</span></button><button class="sr-photo" data-act="rec-photo" aria-label="Take a photo">${icon('camera')}</button>`;
  if (el.innerHTML !== html) el.innerHTML = html;
}
setInterval(recSync, 500);
function lapRecorderHtml(): string {
  const on = recShown();
  return `<div class="lap-rec"><div class="set-card col"><div class="sc-h">${icon('cinema')}<span><b>Recorder</b><small>Record videos and take photos in every 3D place: the 3D view (the cabin, walking about, any camera), your office, Operations, the corridor and concourse, the lounges and the hangars. Videos go to Videos, photos to Photos.</small></span></div>
    <label class="tg-row"><span><b>Show the recorder in 3D places</b><small>A record button and a photo button at the side of the screen.</small></span><button class="tg ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="rec-show"><i></i></button></label>
    <div class="btn-row"><button class="btn ghost sm" data-act="lap-app" data-k="videos">${icon('cinema')}Open Videos</button><button class="btn ghost sm" data-act="lap-app" data-k="photos">${icon('camera')}Open Photos</button></div></div></div>`;
}
ACTIONS['rec-show'] = () => { const S: any = State.settings; S.recShow = !recShown(); Store.save(); Sound.tick(); recSync(); lapRender(true); toast(S.recShow ? 'The recorder shows in every 3D place' : 'The recorder is hidden', 'ok'); };

/* ---------- each computer's and the phone's own settings ---------- */
function lapDevKey(): string { return Lap.phone ? 'phone' : Lap.ops ? 'ops' : 'office'; }
function lapDev(): any { const S: any = State; S.devSet = S.devSet || {}; return S.devSet[lapDevKey()] = S.devSet[lapDevKey()] || { wall: 'brand', accent: '', text: 'm', clock24: true, clicks: true }; }
const LAP_WALLS: [string, string, string][] = [['brand', 'Your airline', ''], ['sky', 'Blue sky', 'linear-gradient(160deg,#5B9BE0,#BFD9F2 60%,#E9F1F8)'], ['dusk', 'Dusk', 'linear-gradient(165deg,#2B1E4F,#C4547A 55%,#F2A65A)'], ['night', 'Night flight', 'radial-gradient(circle at 70% 20%,#3A4C7A,#0B1226 70%)'], ['ocean', 'Ocean', 'linear-gradient(170deg,#0F4C6B,#1C8CA8 60%,#7FD1D9)'], ['graphite', 'Graphite', 'linear-gradient(160deg,#2A2E35,#15181C)']];
const LAP_ACCENTS = ['', '#3FD0E8', '#3DDC84', '#F5B544', '#F06A6A', '#B07CF0', '#7C8CF0'];
function lapDevApply() {
  const R = Lap.root as HTMLElement, os = R && R.querySelector('.lap-os') as HTMLElement; if (!os) return; const D = lapDev();
  const w = LAP_WALLS.filter(x => x[0] === D.wall)[0]; os.style.setProperty('--lap-wall', w && w[2] ? w[2] : '');
  os.classList.toggle('wall-own', !!(w && w[2])); os.style.setProperty('--lap-acc', D.accent || '');
  os.classList.remove('txt-s', 'txt-m', 'txt-l'); os.classList.add('txt-' + (D.text || 'm'));
}
function lapSettingsHtml(): string {
  const D = lapDev(), name = Lap.phone ? 'your phone' : Lap.ops ? 'the Operations computer' : 'your office computer';
  const upd = (() => { try { const sec = SETTINGS.filter(s => s.id === 'support')[0]; return (sec.items[0] as any).html(); } catch (e) { return ''; } })();
  return `<div class="lap-set">
    <div class="set-card col"><div class="sc-h">${icon('sliders')}<span><b>This is ${esc(name)}</b><small>Its own settings: your other computer and your phone keep theirs.</small></span></div>
      <div class="ch-row"><span><b>Wallpaper</b></span><div class="seg wrap">${LAP_WALLS.map(w => `<button class="${D.wall === w[0] ? 'on' : ''}" data-act="lapset" data-k="wall" data-v="${w[0]}">${esc(w[1])}</button>`).join('')}</div></div>
      <div class="ch-row"><span><b>Colour</b><small>For the buttons and highlights.</small></span><div class="le-sw">${LAP_ACCENTS.map(c => `<button class="sw ${D.accent === c ? 'on' : ''}" style="--c:${c || 'var(--cyan)'}" data-act="lapset" data-k="accent" data-v="${c}" aria-label="${c || 'Standard'}"></button>`).join('')}</div></div>
      <div class="ch-row"><span><b>Text size</b></span><div class="seg">${[['s', 'Small'], ['m', 'Normal'], ['l', 'Large']].map(o => `<button class="${D.text === o[0] ? 'on' : ''}" data-act="lapset" data-k="text" data-v="${o[0]}">${o[1]}</button>`).join('')}</div></div>
      <div class="ch-row"><span><b>Clock</b></span><div class="seg">${[['1', '24-hour'], ['0', '12-hour']].map(o => `<button class="${(D.clock24 ? '1' : '0') === o[0] ? 'on' : ''}" data-act="lapset" data-k="clock24" data-v="${o[0]}">${o[1]}</button>`).join('')}</div></div>
</div>
    <div class="set-card col"><div class="sc-h">${icon('download')}<span><b>Update</b><small>Updates the game itself (not this ${Lap.phone ? 'phone' : 'computer'}): the same as Settings → Updates in the game.</small></span></div>${upd}</div>
  </div>`;
}
ACTIONS['lapset'] = el => { const D = lapDev(), k = el.getAttribute('data-k'), v = el.getAttribute('data-v'); D[k] = k === 'clock24' || k === 'clicks' ? v === '1' : v; Store.soon(); Sound.tick(); lapDevApply(); lapRender(true); };

/* ---------- the start menu (the star) ---------- */
/** Folders of apps; the bank in its own, and more as the computer grows. */
function lapStartFolders(): { name: string; ic: string; c: string; apps: string[] }[] {
  return [
    { name: 'Bank', ic: 'bank', c: '#2FBF8F', apps: ['bank'] },
    { name: 'My airline', ic: 'trophy', c: '#F5B544', apps: ['ranking', 'career', 'markets', 'acmarket'] },
    { name: 'Office', ic: 'mail', c: '#3FA2F0', apps: ['mail', 'calendar', 'docs'] },
    { name: 'Photos and videos', ic: 'camera', c: '#B07CF0', apps: ['photos', 'videos', 'recorder'] },
    { name: 'Phone', ic: 'phone', c: '#34C759', apps: PH_APPS.map(a => a[0]) },
  ];
}
function lapAppInfo(k: string): [string, string, string, string] { return lapDeskApps().filter(a => a[0] === k)[0] || LAP_APPS.concat(PH_APPS).filter(a => a[0] === k)[0]; }
function lapStartHtml(): string {
  const pins = ['mail', 'docs', 'photos', 'videos', 'browser', 'settings'].map(lapAppInfo).filter(Boolean);
  const F = lapStartFolders(), open = Lap.startFolder || '';
  return `<div class="lap-start" data-lap-start>
    <div class="ls-h"><b>${esc(company().name)}</b><small>${esc(lapDevKey() === 'ops' ? 'Operations computer' : lapDevKey() === 'phone' ? 'Phone' : 'Office computer')}</small></div>
    <div class="ls-sub">Pinned</div><div class="ls-grid">${pins.map(a => `<button data-act="lap-app" data-k="${a[0]}"><span style="--c:${a[3]}">${icon(a[2])}</span><b>${esc(a[1])}</b></button>`).join('')}</div>
    <div class="ls-sub">Folders</div><div class="ls-folders">${F.map(f => `<button class="ls-f ${open === f.name ? 'on' : ''}" data-act="lap-start-folder" data-f="${esc(f.name)}"><span style="--c:${f.c}">${icon(f.ic)}</span><b>${esc(f.name)}</b><small>${f.apps.length} ${f.apps.length === 1 ? 'app' : 'apps'}</small></button>`).join('')}</div>
    ${open ? `<div class="ls-grid ls-in">${(F.filter(f => f.name === open)[0] || { apps: [] }).apps.map(lapAppInfo).filter(Boolean).map(a => `<button data-act="lap-app" data-k="${a[0]}"><span style="--c:${a[3]}">${icon(a[2])}</span><b>${esc(a[1])}</b></button>`).join('')}</div>` : ''}
    <div class="ls-foot"><button data-act="lap-close">${icon('power')}${Lap.ops ? 'Switch off the screen' : 'Close'}</button></div></div>`;
}
ACTIONS['lap-start'] = () => { Lap.startOn = !Lap.startOn; Lap.searchOn = false; Sound.tick(); lapPopups(); };
ACTIONS['lap-start-folder'] = el => { const f = el.getAttribute('data-f'); Lap.startFolder = Lap.startFolder === f ? '' : f; Sound.tick(); lapPopups(); };
/** The start menu and the search results, over the desktop just above the taskbar. */
function lapPopups() {
  const R = Lap.root as HTMLElement, area = R && R.querySelector('.lap-area') as HTMLElement; if (!area) return;
  let st = area.querySelector('[data-lap-start]') as HTMLElement, sr = area.querySelector('[data-lap-sr]') as HTMLElement;
  if (Lap.startOn) { const t = document.createElement('div'); t.innerHTML = lapStartHtml(); const n = t.firstElementChild as HTMLElement; if (st) st.replaceWith(n); else area.appendChild(n); } else if (st) st.remove();
  if (Lap.searchOn && Lap.searchQ) { lapSearchHtml(Lap.searchQ).then(h => { if (!Lap.searchOn) return; const t = document.createElement('div'); t.innerHTML = h; const n = t.firstElementChild as HTMLElement; const cur = area.querySelector('[data-lap-sr]'); if (cur) cur.replaceWith(n); else area.appendChild(n); }); }
  else if (sr) sr.remove();
}
document.addEventListener('pointerdown', e => {   // a click elsewhere closes the start menu and the search
  if (!Lap.root || (!Lap.startOn && !Lap.searchOn)) return; const t = e.target as HTMLElement;
  if (t.closest('[data-lap-start], [data-lap-sr], .lb-home, .lb-search')) return;
  Lap.startOn = false; Lap.searchOn = false; lapPopups();
}, true);

/* ---------- search on the taskbar ---------- */
function lapSearchHtml(q: string): Promise<string> {
  const s = q.trim().toLowerCase(), apps = lapDeskApps().concat(LAP_APPS).filter((a, i, L) => L.findIndex(b => b[0] === a[0]) === i && a[1].toLowerCase().indexOf(s) >= 0).slice(0, 6);
  return Promise.all(['photos', 'videos', 'docs'].map(k => fsItems(k as any).catch(() => [] as FsItem[]))).then(([ph, vi, dc]) => {
    const M = fsMeta(), hit = (L: FsItem[], k: string) => L.filter(x => x.name.toLowerCase().indexOf(s) >= 0).slice(0, 6).map(x => `<button data-act="lap-sr-open" data-k="${k}" data-id="${x.id}">${x.thumb ? `<img src="${x.thumb}" alt="">` : `<span class="sr-ic">${icon(k === 'videos' ? 'cinema' : 'news')}</span>`}<b>${esc(x.name)}</b><small>${esc(fsTitle(k))}</small></button>`).join('');
    const folders = ['photos', 'videos', 'docs'].map(k => (M[k].folders as any[]).filter(f => f.name.toLowerCase().indexOf(s) >= 0).map(f => `<button data-act="lap-sr-folder" data-k="${k}" data-f="${f.id}"><span class="sr-ic">${icon('layers')}</span><b>${esc(f.name)}</b><small>Folder in ${esc(fsTitle(k))}</small></button>`).join('')).join('');
    const body = (apps.length ? `<div class="sr-sub">Apps</div>${apps.map(a => `<button data-act="lap-app" data-k="${a[0]}"><span class="sr-ic" style="--c:${a[3]}">${icon(a[2])}</span><b>${esc(a[1])}</b><small>App</small></button>`).join('')}` : '')
      + (folders ? `<div class="sr-sub">Folders</div>${folders}` : '') + (hit(ph, 'photos') ? `<div class="sr-sub">Photos</div>${hit(ph, 'photos')}` : '') + (hit(vi, 'videos') ? `<div class="sr-sub">Videos</div>${hit(vi, 'videos')}` : '') + (hit(dc, 'docs') ? `<div class="sr-sub">Documents</div>${hit(dc, 'docs')}` : '');
    return `<div class="lap-sr" data-lap-sr>${body || `<p class="muted">Nothing called “${esc(q)}”.</p>`}</div>`;
  });
}
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('lb-search')) return; Lap.searchQ = el.value; Lap.searchOn = !!el.value.trim(); Lap.startOn = false; lapPopups(); });
ACTIONS['lap-sr-open'] = el => { const k = el.getAttribute('data-k'); Lap.searchOn = false; LapFs.open = el.getAttribute('data-id'); Lap.app = k; Sound.tick(); lapRender(); };
ACTIONS['lap-sr-folder'] = el => { const k = el.getAttribute('data-k'); Lap.searchOn = false; LapFs.folder[k] = el.getAttribute('data-f'); LapFs.open = ''; Lap.app = k; Sound.tick(); lapRender(); };
