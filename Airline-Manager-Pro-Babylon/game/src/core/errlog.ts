// Error log: anything that goes wrong is saved here and shown in a pop-up with the details,
// ready to copy or share. The log is kept on the device (separately from the airline) and
// listed in Settings → Updates and errors.

interface ErrEntry { id: string; time: string; where: string; title: string; message: string; detail?: string; n?: number; last?: string }

const ERR_KEY = 'airline-manager-pro.errors';
const ERR_MAX = 60;

function appTools(): any { const c = (window as any).Capacitor; return c && c.Plugins && c.Plugins.AppTools; }

const ErrorLog = {
  list: [] as ErrEntry[],
  device: null as any,
  _shown: {} as { [msg: string]: boolean },
  _queue: [] as ErrEntry[],

  init() {
    try { this.list = JSON.parse(localStorage.getItem(ERR_KEY) || '[]') || []; } catch (e) { this.list = []; }
    // errors caught by the page before this script was ready
    ((window as any).__bootErrors || []).forEach((b: any) => this.add('start-up', 'Something went wrong while starting', b.message, b.detail));
    window.addEventListener('error', ev => {
      const e: any = (ev as any).error;
      const msg = (e && e.message) || ev.message;
      if (!msg || msg === 'Script error.') return;
      this.add('app', 'Something went wrong', msg, (e && e.stack) || `${ev.filename || ''}:${ev.lineno || ''}:${ev.colno || ''}`);
    });
    window.addEventListener('unhandledrejection', ev => {
      const r: any = (ev as any).reason;
      const msg = r && r.message ? r.message : String(r);
      this.add('app', 'Something went wrong', msg, r && r.stack);
    });
    const t = appTools();
    if (t) {
      t.deviceInfo().then((d: any) => { this.device = d; }).catch(() => { /* older Android */ });
      // a crash in the Android part of the app is saved there and reported on the next start
      t.lastCrash().then((r: any) => {
        if (r && r.text) this.add('android', 'The app closed unexpectedly last time', firstLine(r.text), r.text);
      }).catch(() => { /* none */ });
    }
    setTimeout(() => this.flush(), 1500);
  },

  /** Shows errors that happened before the interface was ready. */
  flush() {
    if (!this._queue.length) return;
    if (!document.getElementById('overlay-root')) { const r = document.createElement('div'); r.id = 'overlay-root'; document.body.appendChild(r); }
    const q = this._queue; this._queue = [];
    q.forEach(e => { try { showErrorPopup(e); } catch (x) { /* nothing more to do */ } });
  },

  save() {
    try { localStorage.setItem(ERR_KEY, JSON.stringify(this.list.slice(0, ERR_MAX))); } catch (e) { /* storage full */ }
  },

  /** Saves an error and, unless popup is false, shows it. The same message only pops up once per session. */
  add(where: string, title: string, message: string, detail?: string, popup?: boolean): ErrEntry {
    const d = new Date();
    // the same error again within a minute (say, every frame of the map): counted on the entry, not repeated
    const top = this.list[0], msg = String(message || 'Unknown error'), det = detail ? String(detail).slice(0, 8000) : '';
    if (top && top.where === where && top.message === msg && top.detail === det && Date.now() - new Date((top.last || top.time).replace(' ', 'T') + 'Z').getTime() < 60000) {
      top.n = (top.n || 1) + 1; top.last = d.toISOString().slice(0, 19).replace('T', ' '); this.save(); return top;
    }
    const e: ErrEntry = { id: uid(), time: d.toISOString().slice(0, 19).replace('T', ' '), where, title, message: String(message || 'Unknown error'), detail: detail ? String(detail).slice(0, 8000) : '' };
    this.list.unshift(e);
    if (this.list.length > ERR_MAX) this.list.length = ERR_MAX;
    this.save();
    const key = where + '|' + e.message;
    if (popup !== false && !this._shown[key]) {
      this._shown[key] = true;
      if (document.getElementById('overlay-root')) { try { showErrorPopup(e); } catch (x) { this._queue.push(e); } }
      else this._queue.push(e);
    }
    try { if ($('#set-body') && _setSection === 'support') rerenderSettingsBody(); } catch (x) { /* settings closed */ }
    return e;
  },

  clear() { this.list = []; this.save(); },

  header(): string {
    const d = this.device;
    return [
      `${APP.name} ${APP.version}`,
      d ? `Android ${d.android} (SDK ${d.sdk}), ${d.device}` : `Browser: ${navigator.userAgent}`,
      d ? `Installed version ${d.versionName} (${d.versionCode})${d.installer ? ', installed by ' + d.installer : ''}` : '',
      `Report made ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    ].filter(Boolean).join('\n');
  },

  entryText(e: ErrEntry): string {
    return `[${e.time}] ${e.title} (${e.where})${e.n && e.n > 1 ? ` · ${e.n} times, last ${e.last}` : ''}\n${e.message}${e.detail ? '\n' + e.detail : ''}`;
  },

  report(entries?: ErrEntry[]): string {
    const list = entries || this.list;
    return this.header() + '\n\n' + (list.length ? list.map(e => this.entryText(e)).join('\n\n') : 'No errors logged.');
  },
};

function firstLine(s: string): string {
  const l = String(s).split('\n').filter(x => /Exception|Error/.test(x))[0] || String(s).split('\n')[0];
  return l.trim().slice(0, 300);
}

/** Copies text to the clipboard (native on Android, the browser clipboard elsewhere). */
async function copyText(text: string): Promise<boolean> {
  const t = appTools();
  try { if (t) { await t.copy({ text, label: APP.name + ' error log' }); return true; } } catch (e) { /* try the browser */ }
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* older WebView */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

/** Opens the share sheet (Android) or the browser's share, falling back to copying. */
async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  const t = appTools();
  try { if (t) { await t.share({ text, title: APP.name + ' error log' }); return 'shared'; } } catch (e) { /* try the browser */ }
  try { if ((navigator as any).share) { await (navigator as any).share({ title: APP.name + ' error log', text }); return 'shared'; } } catch (e) { /* cancelled */ }
  return (await copyText(text)) ? 'copied' : 'failed';
}

/* ---------- Pop-up ---------- */
function showErrorPopup(e: ErrEntry) {
  const text = ErrorLog.entryText(e) + '\n\n' + ErrorLog.header();
  const wrap = openLayer('modal', `
    <div class="modal-head del-head"><span class="del-ic">${icon('alert')}</span><div><h2>${esc(e.title)}</h2><small>${esc(e.time)}</small></div>
      <button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body err-pop">
      <p class="lede warn">${icon('alert')}${esc(e.message)}</p>
      <pre class="err-box">${esc(text)}</pre>
      <p class="fine-print">${icon('info')}Copy or share these details so the problem can be looked at. They're also saved in Settings, Updates and errors.</p>
      <div class="modal-actions">
        <button class="btn ghost" data-act="err-copy">${icon('copy')}Copy</button>
        <button class="btn ghost" data-act="err-share">${icon('share')}Share</button>
        <button class="btn" data-act="close-layer">Close</button>
      </div>
    </div>`, { cls: 'narrow err-layer' });
  (wrap as any)._errText = text;
  try { Sound.tick(); Haptics.pulse(20); } catch (x) { /* sound not ready */ }
}

function errTextFor(el: Element): string {
  const w: any = el.closest('.layer');
  return w && w._errText ? w._errText : ErrorLog.report();
}
ACTIONS['err-copy'] = async el => { const ok = await copyText(errTextFor(el)); toast(ok ? 'Copied' : 'Couldn\'t copy, select the text and copy it', ok ? 'ok' : 'warn'); };
ACTIONS['err-share'] = async el => {
  const r = await shareText(errTextFor(el));
  if (r === 'copied') toast('Copied, paste it where you want to share it', 'ok');
  else if (r === 'failed') toast('Couldn\'t share, select the text and copy it', 'warn');
};
ACTIONS['err-open'] = el => { const e = ErrorLog.list.filter(x => x.id === el.getAttribute('data-id'))[0]; if (e) showErrorPopup(e); };
ACTIONS['err-show-all'] = () => {
  const text = ErrorLog.report();
  const wrap = openLayer('modal', `
    <div class="modal-head"><h2>Error log</h2><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body err-pop"><pre class="err-box tall">${esc(text)}</pre>
      <div class="modal-actions"><button class="btn ghost" data-act="err-copy">${icon('copy')}Copy</button><button class="btn ghost" data-act="err-share">${icon('share')}Share</button><button class="btn" data-act="close-layer">Close</button></div></div>`, { cls: 'narrow err-layer' });
  (wrap as any)._errText = text;
};
ACTIONS['err-clear'] = () => { ErrorLog.clear(); Sound.tick(); rerenderSettingsBody(); toast('Error log cleared', 'ok'); };
