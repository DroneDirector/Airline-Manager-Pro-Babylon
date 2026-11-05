// App updates: checks the published releases, downloads the new version and hands it to
// Android's installer. If Android refuses the install, its exact reason goes to the error log.

interface UpdateInfo { version: string; url: string; notes: string; size: number; page: string }

const UPDATE_CHECK_KEY = 'airline-manager-pro.update-check';

const Updater = {
  state: 'idle' as 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'installing' | 'permission' | 'failed',
  info: null as UpdateInfo,
  pct: -1,
  _listening: false,

  get native(): boolean { return !!appTools() || DESKTOP; },   // the phone app installs APKs; the PC app updates itself

  init() {
    if (!this.native || !APP.updates) return;
    let last = 0;
    try { last = Number(localStorage.getItem(UPDATE_CHECK_KEY)) || 0; } catch (e) { /* no storage */ }
    if (Date.now() - last > 6 * 3600 * 1000) setTimeout(() => this.check(true), 8000);
    // back from the "install unknown apps" setting: carry on with the install
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || this.state !== 'permission') return;
      appTools().deviceInfo().then((d: any) => { if (d.canInstall) this.install(); else { this.state = 'available'; updateChanged(); } }).catch(() => { /* ask again later */ });
    });
  },

  async check(quiet?: boolean): Promise<void> {
    if (!APP.updates || this.state === 'downloading' || this.state === 'installing') return;
    this.state = 'checking'; updateChanged();
    try {
      // GitHub doesn't list releases newest first (0.9.100 comes after 0.9.69), so every page is read and the
      // highest version wins
      // never an answer kept from an earlier check (the phone's web view may keep one): always asked fresh
      const page = (n: number) => fetch(`https://api.github.com/repos/${APP.updates.repo}/releases?per_page=100&page=${n}&t=${Date.now()}`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      const r = await page(1);
      if (!r.ok) throw new Error(`The update server answered ${r.status} ${r.statusText}`);
      let list: any[] = await r.json();
      for (let n = 2; n <= 5 && list.length === (n - 1) * 100; n++) { try { const rn = await page(n); if (!rn.ok) break; list = list.concat(await rn.json()); } catch (e) { break; } }
      const rel = list.filter(x => !x.draft && String(x.tag_name).indexOf(APP.updates.tagPrefix) === 0)
        .sort((a, b) => cmpVersion(b.tag_name.slice(APP.updates.tagPrefix.length), a.tag_name.slice(APP.updates.tagPrefix.length)))[0];
      try { localStorage.setItem(UPDATE_CHECK_KEY, String(Date.now())); } catch (e) { /* no storage */ }
      const v = rel ? rel.tag_name.slice(APP.updates.tagPrefix.length) : '';
      // the phone takes the Android app; the PC its own Windows download
      const apk = rel && (rel.assets || []).filter((a: any) => DESKTOP ? /^AirlineManagerPro-PC-.*\.zip$/i.test(a.name) : /\.apk$/i.test(a.name))[0];
      if (!rel || !apk || cmpVersion(v, APP.version) <= 0) { this.state = 'latest'; this.info = null; updateChanged(); if (!quiet) toast(rel && !apk ? `Version ${v} is published, but its ${DESKTOP ? 'PC' : 'Android'} download isn't there yet. Try again in a few minutes.` : `You have the latest version, ${APP.version}`, rel && !apk ? 'info' : 'ok'); return; }
      this.info = { version: v, url: apk.browser_download_url, notes: rel.body || '', size: apk.size, page: rel.html_url };
      this.state = 'available'; updateChanged();
      if (quiet) toast(`Version ${v} is ready to install`, 'info', { label: 'Update', act: 'update-open' });
      else openUpdate();
    } catch (e) {
      this.state = 'failed'; updateChanged();
      if (!quiet) ErrorLog.add('update', 'Couldn\'t check for updates', (e && e.message) || String(e), `Check that the ${DESKTOP ? 'PC' : 'phone'} is online and try again.`);
    }
  },

  async install() {
    if (DESKTOP) return this.installPc();
    const t = appTools();
    if (!t || !this.info) return;
    if (!this._listening) {
      this._listening = true;
      t.addListener('updateProgress', (p: any) => { this.pct = p.pct; this.state = p.pct >= 100 ? 'installing' : 'downloading'; updateChanged(); });
      t.addListener('updateResult', (r: any) => onUpdateResult(r));
    }
    try {
      const r = await t.installUpdate({ url: this.info.url });
      if (r && r.needsPermission) {
        this.state = 'permission'; updateChanged();
        openLayer('modal', `<div class="modal-head"><h2>Allow app updates</h2><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
          <div class="modal-body"><p class="lede">${icon('info')}Android needs your permission once before ${esc(APP.name)} can install its own updates. Turn on "Allow from this source", then come back here.</p>
          <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Not now</button><button class="btn" data-act="update-permission">Open the setting</button></div></div>`, { cls: 'narrow' });
        return;
      }
      this.state = 'downloading'; this.pct = 0; updateChanged();
    } catch (e) {
      this.state = 'failed'; updateChanged();
      ErrorLog.add('update', 'The update couldn\'t be installed', (e && e.message) || String(e));
    }
  },

  /** On the PC: the PC app downloads its new version, closes, copies it over itself and opens again. */
  async installPc() {
    if (!this.info) return;
    try { Store.save(); Store.flushNative(); } catch (e) { /* saved already */ }
    try { if (typeof Backup !== 'undefined') Backup.writeFolder(); } catch (e) { /* the regular copy is there */ }
    const fail = (msg: string) => { this.state = 'failed'; updateChanged(); ErrorLog.add('update', 'The update couldn\'t be installed', msg, `PC app update: ${APP.version} → ${this.info ? this.info.version : '?'}`); };
    let r: any;
    try { r = await fetch('/api/update', { method: 'POST', body: JSON.stringify({ version: this.info.version }) }).then(x => x.ok ? x.json() : null); }
    catch (e) { return fail('The PC app didn\'t answer. Is it still running?'); }
    if (!r) return fail('This PC app is too old to update itself. Download the new version once from the release page; after that, updates install from here.');
    if (r.state === 'failed') return fail(r.error || 'The update failed.');
    this.state = 'downloading'; this.pct = 0; updateChanged();
    const poll = () => fetch('/api/update').then(x => x.json()).then((s: any) => {
      if (s.state === 'failed') return fail(s.error || 'The update failed.');
      if (s.state === 'downloading') { this.state = 'downloading'; this.pct = s.pct; updateChanged(); }
      if (s.state === 'unpacking' || s.state === 'restarting') { this.state = 'installing'; this.pct = 100; updateChanged(); }
      setTimeout(poll, 700);
    }, () => { this.state = 'installing'; updateChanged(); /* the PC app has closed to install: it opens again by itself */ });
    poll();
  },
};

const INSTALL_REASONS: { [k: string]: string } = {
  FAILURE_CONFLICT: 'Android says the new version conflicts with the app that is installed. This happens when the installed copy was signed with a different key (an early test version). Uninstall the app once and install the new version; after that, updates install over it.',
  FAILURE_INCOMPATIBLE: 'Android says this version isn\'t compatible with this phone.',
  FAILURE_INVALID: 'Android says the downloaded file isn\'t a valid app. It may have been damaged on the way; try again.',
  FAILURE_STORAGE: 'There isn\'t enough free storage on the phone to install the update.',
  FAILURE_BLOCKED: 'The install was blocked, usually by Google Play Protect or a device policy. Open Play Protect and allow the app, then try again.',
  FAILURE_ABORTED: 'The install was cancelled.',
  FAILURE_TIMEOUT: 'Android took too long to install the update. Try again.',
  DOWNLOAD_FAILED: 'The download failed. Check the internet connection and try again.',
  INSTALL_SESSION_FAILED: 'Android couldn\'t start the install.',
  CONFIRM_FAILED: 'Android couldn\'t show the install confirmation.',
};

function onUpdateResult(r: any) {
  if (r.ok) { Updater.state = 'installing'; updateChanged(); return; }
  Updater.state = 'failed'; updateChanged();
  const reason = INSTALL_REASONS[r.code] || 'Android refused to install the update.';
  const detail = `Android installer result: ${r.code} (status ${r.status})${r.message ? '\nAndroid message: ' + r.message : ''}\nUpdate: ${APP.version} → ${Updater.info ? Updater.info.version : '?'}${Updater.info ? '\nFile: ' + Updater.info.url : ''}`;
  if (r.code === 'FAILURE_ABORTED') { ErrorLog.add('update', 'Update cancelled', reason, detail, false); toast('Update cancelled', 'info'); return; }
  closeAll();
  ErrorLog.add('update', 'The update couldn\'t be installed', reason, detail);
}

function cmpVersion(a: string, b: string): number {
  const pa = String(a).split(/[.-]/).map(n => parseInt(n, 10) || 0), pb = String(b).split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}

function updateStatusText(): string {
  const u = Updater;
  switch (u.state) {
    case 'checking': return 'Checking for updates…';
    case 'latest': return 'You have the latest version';
    case 'available': return `Version ${u.info.version} is ready to install`;
    case 'downloading': return u.pct >= 0 ? `Downloading version ${u.info.version}, ${u.pct}%` : `Downloading version ${u.info.version}…`;
    case 'installing': return DESKTOP ? 'Installing: the PC app closes and opens again with the new version' : 'Installing, the app restarts when it\'s done';
    case 'permission': return 'Waiting for permission to install updates';
    case 'failed': return 'The last update attempt failed, see the error log';
    default: return u.native ? 'Updates install over this version and keep your airline' : 'Updates install in the Android app and the PC app';
  }
}

function updateBody(): string {
  const u = Updater, busy = u.state === 'downloading' || u.state === 'installing';
  return `<div class="upd-v"><span class="brand-lg">${brandMark()}</span><span><small>Installed</small><b>${esc(APP.version)}</b></span>${icon('chevron')}<span><small>New</small><b class="green">${esc(u.info.version)}</b></span>${u.info.size ? `<em>${(u.info.size / 1048576).toFixed(1)} MB</em>` : ''}</div>
    ${u.info.notes ? `<div class="upd-notes">${esc(u.info.notes.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim().slice(0, 2400))}</div>` : ''}
    <div class="upd-prog ${busy ? '' : 'hide'}"><div class="upd-bar"><i style="width:${Math.max(4, u.pct || 0)}%"></i></div><p class="fine-print">${icon('info')}${esc(busy ? updateStatusText() : '')}</p></div>
    <p class="fine-print">${icon('info')}Your airline is kept. The update installs over this version and the app opens again.</p>
    <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Later</button><button class="btn" data-act="update-install" ${busy ? 'disabled' : ''}>${icon('download')}${busy ? 'Installing…' : 'Download and install'}</button></div>`;
}

function openUpdate() {
  if (!Updater.info) return;
  openLayer('modal', `<div class="modal-head"><h2>Update available</h2><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body" id="upd-body">${updateBody()}</div>`, { cls: 'narrow' });
}

function updateChanged() {
  // changed in place (no flashing while the download counts up)
  const b = $('#upd-body'); if (b && Updater.info) patchHtml(b, updateBody());
  try { if ($('#set-body') && _setSection === 'support') rerenderSettingsBody(); } catch (e) { /* settings closed */ }
}

ACTIONS['update-open'] = el => { const t = el && el.closest('.toast'); if (t) t.remove(); Sound.tick(); openUpdate(); };
ACTIONS['update-check'] = () => { Sound.tick(); if (!Updater.native) { toast('Updates install in the Android app and the PC app', 'info'); return; } Updater.check(false); };
ACTIONS['update-install'] = () => { Sound.tick(); Updater.install(); };
ACTIONS['update-permission'] = () => { closeTop(); const t = appTools(); if (t) t.openInstallPermission().catch((e: any) => ErrorLog.add('update', 'Couldn\'t open the setting', (e && e.message) || String(e))); };
