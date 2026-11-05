// Backups of the whole airline (settings, looks, crews, fleet, money, logs, the PC link, everything that
// is saved) outside the app's own storage, so nothing is lost when the app's data is cleared, the app is
// uninstalled, or you move to a new phone.
//  - The app's own copy: the web storage plus a second copy in the app's files (Store.save). Android's
//    own backup also takes the app's data along to a new phone when that is switched on.
//  - A backup folder you choose (Documents, an SD card, a Google Drive folder…): the airline is written
//    there automatically, and after a reinstall you pick the same folder to get everything back.
//  - A backup file you save or open by hand.

const Backup = {
  folder: null as { set: boolean; name?: string; lastWrite?: number },
  _last: 0,
  _pending: '',

  tools(): any { return Store.native(); },

  init() {
    if (DESKTOP) { this.folder = { set: true, name: 'Documents\\Airline Manager Pro', lastWrite: 0 }; return; }
    const T = this.tools();
    if (T && T.backupFolderInfo) T.backupFolderInfo().then((r: any) => { this.folder = r; }).catch(() => { /* older app */ });
  },

  /** The current save as text (what Store.save writes). */
  snapshot(): string {
    Store.save();
    try { return localStorage.getItem(STORE_KEY) || ''; } catch (e) { return ''; }
  },

  /** Called after each save: copy to the backup folder every few minutes, and at once when leaving the app. */
  afterSave(json: string, now?: boolean) {
    if (!this.folder || !this.folder.set) return;
    this._pending = json;
    if (now || Date.now() - this._last > 3 * 60000) this.writeFolder();
  },
  writeFolder() {
    if (DESKTOP && this._pending) {
      const json = this._pending; this._pending = ''; this._last = Date.now();
      fetch('/api/backup', { method: 'PUT', body: json }).then(r => r.json()).then(() => { if (this.folder) this.folder.lastWrite = Date.now(); if ($('#set-body')) rerenderSettingsBody(); }).catch(() => { /* PC app closed */ });
      return;
    }
    const T = this.tools(), json = this._pending; if (!T || !json) return;
    this._pending = ''; this._last = Date.now();
    T.backupFolderWrite({ data: json }).then(() => { if (this.folder) this.folder.lastWrite = Date.now(); if ($('#set-body')) rerenderSettingsBody(); })
      .catch((e: any) => ErrorLog.add('backup', 'The backup couldn\'t be saved to your backup folder', (e && e.message) || String(e), 'Choose the folder again in Settings, Backup and restore.', false));
  },

  pickFolder(): Promise<any> {
    const T = this.tools(); if (!T) return Promise.resolve(null);
    return T.backupFolderPick().then((r: any) => { if (r && r.set) { this.folder = { set: true, name: r.name, lastWrite: 0 }; } return r; });
  },

  /** Is this text a backup of this app? Returns the parsed save or null. */
  parse(text: string): any {
    try { const d = JSON.parse(text); return d && d.state && typeof d.state === 'object' ? d : null; } catch (e) { return null; }
  },

  /** Replace everything with a backup and start again from it. */
  restore(text: string) {
    const d = this.parse(text); if (!d) { toast('That file isn\'t an Airline Manager Pro backup', 'warn'); return; }
    try { localStorage.setItem(STORE_KEY, text); } catch (e) { toast('The backup couldn\'t be stored on this phone', 'warn'); return; }
    try { localStorage.removeItem('amp-nogame'); } catch (e) { /* ignore */ }
    // nothing may save over it now, before the app starts again from it
    try { (Mode as any).switching = true; clearTimeout((Store as any)._nativeTimer); (Store as any)._native = ''; } catch (e) { /* ignore */ }
    const T = this.tools(); if (T && T.backupWrite) T.backupWrite({ data: text }).catch(() => { /* the web copy is there */ });
    try { if (!sessionStorage.getItem('amp-title-next')) sessionStorage.setItem('amp-title-next', 'game'); } catch (e) { /* ignore */ }
    toast('Backup restored', 'ok');
    setTimeout(() => location.reload(), 600);
  },

  fileName(): string { return `AirlineManagerPro-backup-${dateStr(new Date()).slice(0, 10)}.json`; },

  exportFile() {
    const json = this.snapshot(), T = this.tools();
    if (T && T.backupExport) { T.backupExport({ data: json, name: this.fileName() }).then((r: any) => { if (r && r.saved) toast('Backup file saved', 'ok'); }).catch((e: any) => ErrorLog.add('backup', 'The backup file couldn\'t be saved', (e && e.message) || String(e))); return; }
    // in a browser: download it
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = this.fileName();
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },

  importFile(): Promise<string> {
    const T = this.tools();
    if (T && T.backupImport) return T.backupImport().then((r: any) => (r && r.data) || '');
    return new Promise(res => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return res(''); const rd = new FileReader(); rd.onload = () => res(String(rd.result || '')); rd.readAsText(f); };
      inp.click();
    });
  },

  /** Ask before replacing the airline on this device with a backup: the backup and what is here now, side by
   *  side (when each was saved, by which version, the airlines, balance, fleet and flights), with a clear
   *  warning when the backup is older than what it would replace. */
  confirmRestore(text: string, from: string) {
    const d = this.parse(text); if (!d) { toast('No Airline Manager Pro backup was found there', 'warn'); return; }
    const here = DESKTOP ? 'this PC' : 'this phone';
    let cur: any = null; try { cur = JSON.parse(localStorage.getItem(Mode.key()) || 'null'); } catch (e) { /* nothing */ }
    if (cur && !cur.state) cur = null;
    if (!cur && !Store.wasEmpty) { const o: any = {}; for (const k of SAVED_KEYS) o[k] = (State as any)[k]; cur = { savedAt: Date.now(), app: APP.version, state: o }; }
    const card = (title: string, x: any, cls: string, verb: string) => {
      if (!x) return `<div class="rs-card ${cls}"><small class="rs-k">${esc(title)}</small><b>Nothing saved on ${here}</b><small>A fresh start: nothing will be lost.</small></div>`;
      const st = x.state || {}, cos = (st.companies || []).map((c: any) => c.name).join(', '), sm = typeof syncSummary === 'function' ? syncSummary(st) : null;
      return `<div class="rs-card ${cls}"><small class="rs-k">${esc(title)}</small><b>${esc(cos || 'Your airline')}</b>
        <span><small>Saved</small>${esc(x.savedAt ? dateStr(new Date(x.savedAt)) : 'unknown time')}</span>
        <span><small>Version</small>${esc(x.app || '?')}</span>
        ${sm ? `<span><small>Balance</small>${esc(sm.balance)}</span><span><small>Aircraft</small>${sm.fleet}</span><span><small>Flights in the log</small>${sm.flights}</span>` : ''}
        <em>${esc(verb)}</em></div>`;
    };
    const older = cur && cur.savedAt && d.savedAt && d.savedAt < cur.savedAt - 60000;
    const warn = !cur ? '' : older
      ? `<p class="v3d-note warn">${icon('alert')}The backup is older than what is on ${here} now (saved ${esc(dateStr(new Date(cur.savedAt)))}). Restoring it replaces the newer airline here, and everything since the backup is lost.</p>`
      : `<p class="v3d-note">${icon('info')}Restoring replaces the airline on ${here}: settings, looks, staff, fleet, money, flight logs and the link to your PC.</p>`;
    (window as any).__restoreText = text;
    openLayer('modal', `<div class="modal-head"><div><h2>Restore this backup?</h2><small>${esc(from)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
      <div class="rs-cards">${card('The backup', d, 'from', 'Will be restored')}${card('Now on ' + here, cur, 'to', 'Will be replaced')}</div>
      ${warn}
      <div class="modal-actions"><button class="btn ghost" data-act="close-layer">${cur ? 'Keep what is here' : 'Cancel'}</button><button class="btn primary ${older ? 'danger' : ''}" data-act="backup-restore-go">${icon('check')}${older ? 'Restore the older backup' : 'Restore'}</button></div>`, { cls: 'wide' });
  },

  /** First start with nothing saved (a new phone, a reinstall, cleared data): offer to bring the airline back. */
  offerRestoreOnFirstStart() {
    if (Store.nogame()) return;   // every save was deleted: the start screen offers a new game or a backup
    if (DESKTOP && Store.wasEmpty && !Mode.coop()) {
      fetch('/api/backup').then(r => r.json()).then(r => { if (r && r.data) setTimeout(() => this.confirmRestore(r.data, 'Found in Documents\\Airline Manager Pro on this PC'), 1500); else setTimeout(() => firstStartWelcome(false), SPLASH_MS + 600); }).catch(() => setTimeout(() => firstStartWelcome(false), SPLASH_MS + 600));
      return;
    }
    if (Mode.coop()) { if (Store.wasEmpty) setTimeout(() => coopWorldWelcome(), SPLASH_MS + 600); return; }
    if (!Store.wasEmpty) return;
    setTimeout(() => firstStartWelcome(!!this.tools()), SPLASH_MS + 600);
  },
};

ACTIONS['backup-folder'] = () => {
  Backup.pickFolder().then(r => {
    if (!r || !r.set) return;
    toast(`Backups go to ${r.name || 'the chosen folder'}`, 'ok');
    Backup.afterSave(Backup.snapshot(), true);
    rerenderSettingsBody();
  }).catch((e: any) => ErrorLog.add('backup', 'That folder couldn\'t be used', (e && e.message) || String(e)));
};
ACTIONS['backup-now'] = () => { Backup.afterSave(Backup.snapshot(), true); toast('Backup saved', 'ok'); setTimeout(() => rerenderSettingsBody(), 800); };
ACTIONS['backup-export'] = () => Backup.exportFile();
ACTIONS['backup-import'] = () => { Backup.importFile().then(t => { if (t) { closeAll(); Backup.confirmRestore(t, 'From a backup file'); } }).catch((e: any) => ErrorLog.add('backup', 'The backup file couldn\'t be opened', (e && e.message) || String(e))); };
ACTIONS['backup-folder-restore'] = () => {
  const T = Backup.tools(); if (!T) return;
  Backup.pickFolder().then(r => {
    if (!r || !r.set) return;
    if (!r.hasBackup) { toast(`No backup in ${r.name || 'that folder'} yet. New backups will go there.`, 'info'); closeAll(); return; }
    return T.backupFolderRead().then((x: any) => { closeAll(); Backup.confirmRestore((x && x.data) || '', `From ${r.name || 'your backup folder'}`); });
  }).catch((e: any) => ErrorLog.add('backup', 'The backup folder couldn\'t be read', (e && e.message) || String(e)));
};
ACTIONS['backup-restore-go'] = () => { const t = (window as any).__restoreText; closeAll(); if (t) Backup.restore(t); };

/* ---------- five backup saves on this device, taken in turn ---------- */
// The main save is written after every change (Store.save). Besides it, the device keeps five backup saves:
// each new one replaces the oldest, at most one a minute while you play and one straight away when you leave
// the app, so there are always five recent moments to go back to. On the phone they are files in the app's own
// storage; on the PC, in Documents\Airline Manager Pro\backups; in a browser, in its own storage.
const SaveSlots = {
  N: 5, _last: 0, _json: '', _timer: 0 as any,
  meta(): { next: number; at: number[] } { try { const m = JSON.parse(localStorage.getItem('amp.saveSlots') || 'null'); if (m && Array.isArray(m.at)) return m; } catch (e) { /* none */ } return { next: 0, at: [0, 0, 0, 0, 0] }; },
  after(json: string, now?: boolean) {
    this._json = json;
    if (now || Date.now() - this._last > 60000) { this.write(); return; }
    if (!this._timer) this._timer = setTimeout(() => { this._timer = 0; this.write(); }, 60000 - (Date.now() - this._last));
  },
  write() {
    clearTimeout(this._timer); this._timer = 0;
    const json = this._json; if (!json) return; this._json = ''; this._last = Date.now();
    const m = this.meta(), i = m.next % this.N, name = `save-${i + 1}.json`;
    const done = () => { m.at[i] = Date.now(); m.next = (i + 1) % this.N; try { localStorage.setItem('amp.saveSlots', JSON.stringify(m)); } catch (e) { /* ignore */ } };
    const T = Store.native();
    if (T && T.backupWrite) { T.backupWrite({ data: json, name }).then(done).catch(() => { /* the main save is still there */ }); return; }
    if (DESKTOP) { fetch('/api/saves?slot=' + (i + 1), { method: 'PUT', body: json }).then(r => { if (r.ok) done(); }).catch(() => { /* PC app closed */ }); return; }
    try { localStorage.setItem('amp.save.' + (i + 1), json); done(); } catch (e) { /* storage full: the main save is kept */ }
  },
  read(i: number): Promise<string> {
    const T = Store.native(), name = `save-${i}.json`;
    if (T && T.backupRead) return T.backupRead({ name }).then((r: any) => (r && r.data) || '');
    if (DESKTOP) return fetch('/api/saves?slot=' + i).then(r => r.json()).then((j: any) => j.data || '');
    try { return Promise.resolve(localStorage.getItem('amp.save.' + i) || ''); } catch (e) { return Promise.resolve(''); }
  },
  html(): string {
    const m = this.meta(), rows = m.at.map((at, i) => ({ at, i: i + 1 })).filter(r => r.at).sort((a, b) => b.at - a.at);
    return `<div class="set-card"><span class="pc-ic">${icon('check')}</span><span><b>Save now</b><small>Everything is saved by itself the moment anything changes, also the markets, prices, money in and out and messages. Save now writes the save and a backup save straight away${DESKTOP ? ' (or press Ctrl+S)' : ''}.</small></span><button class="btn primary sm" data-act="save-now">${icon('check')}Save now</button></div>
      <div class="set-card col"><div class="sc-h">${icon('shield')}<span><b>Backup saves on this device</b><small>Everything is saved the moment it changes. Five backup saves are kept besides, taken in turn (one a minute while you play, and when you leave the app), so you can go back to an earlier moment.</small></span></div>
      ${rows.length ? rows.map(r => `<div class="ch-row"><span><b>Backup ${r.i}</b><small>${esc(dateStr(new Date(r.at)))} ${esc(new Date(r.at).toTimeString().slice(0, 5))}</small></span><button class="btn ghost sm" data-act="slot-restore" data-i="${r.i}">${icon('sync')}Restore</button></div>`).join('') : '<small class="muted">The first backup save is made a minute from now.</small>'}</div>`;
  },
};
ACTIONS['slot-restore'] = el => {
  const i = +(el.getAttribute('data-i') || 0); if (!i) return;
  if (!confirm('Go back to this backup save? What happened since then is replaced.')) return;
  SaveSlots.read(i).then(t => { if (!t) { toast('That backup save could not be read', 'warn'); return; } Backup.restore(t); }).catch(() => toast('That backup save could not be read', 'warn'));
};
document.addEventListener('change', () => { try { Store.soon(); } catch (e) { /* not ready */ } }, true);

/* ---------- saved as things happen on their own, and saved when you say so ---------- */
// Besides what you do, the airline changes by itself: the markets and prices move, money comes in and goes out,
// flights land, people write, the court and the authority get in touch. Every couple of seconds a quick summary
// of the airline is compared with the last one, and when anything has changed it is saved.
const SaveWatch = {
  last: '', timer: 0 as any, at: 0, owe: false,
  BIG: ['companies', 'mkt', 'bank', 'stock', 'settings', 'unions', 'jobs'],
  sig(): string {
    const S: any = State, out: string[] = [];
    for (const k of SAVED_KEYS) {
      const v = S[k];
      if (v == null || typeof v !== 'object') { out.push(String(v)); continue; }
      if (this.BIG.indexOf(k) >= 0) { let j = ''; try { j = JSON.stringify(v); } catch (e) { /* cyclic */ } out.push(j.length + ':' + saveHash(j)); continue; }
      if (Array.isArray(v)) { const a = v[0], z = v[v.length - 1]; let e = ''; try { e = JSON.stringify(a || '').slice(0, 300) + JSON.stringify(z || '').slice(0, 300); } catch (x) { /* odd */ } out.push(v.length + ':' + saveHash(e)); continue; }
      out.push(String(Object.keys(v).length));
    }
    try { const M: any = (State as any).mail; if (Array.isArray(M)) out.push('m' + M.length + (M[0] && M[0].id)); } catch (e) { /* none */ }
    return out.join('|');
  },
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (document.hidden) return;
      let s = ''; try { s = this.sig(); } catch (e) { return; }
      // saved at once, but not more than every 8 seconds from changes that keep running (aircraft moving), so phones stay smooth
      if (this.last && s !== this.last) { const now = Date.now(); if (now - this.at >= 8000) { this.at = now; try { Store.soon(); } catch (e) { /* not ready */ } } else this.owe = true; }
      else if (this.owe && Date.now() - this.at >= 8000) { this.owe = false; this.at = Date.now(); try { Store.soon(); } catch (e) { /* not ready */ } }
      this.last = s;
    }, 2500);
  },
};
function saveHash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
setTimeout(() => { try { SaveWatch.start(); } catch (e) { /* later */ } }, 4000);

/** Save now: the main save, the phone's own file and a backup save, all at once. */
function saveNow(quiet?: boolean) {
  try { Store.save(); Store.flushNative(); } catch (e) { /* storage */ }
  try { SaveSlots._json = SaveSlots._json || (localStorage.getItem(Mode.key()) || ''); SaveSlots.write(); } catch (e) { /* none */ }
  try { if (Backup.folder && Backup.folder.set) Backup.writeFolder(); } catch (e) { /* none */ }
  if (!quiet) { try { Sound.tick(); toast('Saved', 'ok'); } catch (e) { /* no ui */ } }
}
ACTIONS['save-now'] = () => saveNow();
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); } });
