/* Online sync: your own airline (the demo airline too) on all your devices, the phone and the PC, wherever
 * they are, as long as they have internet.
 *
 *  - The airline has its own secret key, made on the device where sync is switched on. Each part of the
 *    airline (fleet, money, staff, logs, news…) is packed and encrypted with it on the device before it is
 *    sent, so the online copy can only be read by your own devices. The key itself never leaves them; the
 *    online copy is found by a fingerprint of it.
 *  - Another device joins with a short one-use code shown on the first (valid ten minutes).
 *  - One device runs the airline at a time (flights, money, staff, time passing): the one you are using.
 *    The others show it live and take over as soon as you use them. During a flight in Flight Simulator,
 *    the device linked to the simulator keeps running it, so the flight is followed without a gap.
 *  - Only the parts that changed are sent. Other devices are told at once (a live channel) and fetch them;
 *    without that channel they look every few seconds.
 *  - Without internet you keep playing on this device; it catches up when the connection is back. If two
 *    devices were played apart, you choose which copy to keep, and the other is kept on this device.
 *  - Each device keeps its own display, sound and graphics settings.
 * The online part is supabase/sync.sql. */

const SYNC_LS = 'amp-sync', SYNC_OTHER = 'airline-manager-pro.save.sync-other';
// settings that belong to the device, not the airline
const SYNC_DEVICE_SETTING = /^(v3d|desk|cloud|map|ui|text|audio|voice|radioVoice|autoVoice|mechanicVoice|mute|onlyVoices|purchaseSound|paySound|uiSounds|haptics|reduceMotion|gameBoost|fullScreen|rememberUi|wx|setSub|theme|units|clock|hour|tfc|otherTraffic|atcListen|hoppie|discord)/i;

interface SyncLocal { on: boolean; key: string; ver: number; h: { [k: string]: string }; dirty: boolean; at: number; joinedAt?: number }

const CloudSync = {
  st: null as SyncLocal,
  role: 'off' as 'off' | 'engine' | 'mirror' | 'offline' | 'setup',
  id: '', engineName: '', engineSim: false, lastErr: '', busy: false,
  _ek: null as CryptoKey, _timer: 0 as any, _pushT: 0 as any, _ws: null as WebSocket, _wsOk: false, _hb: 0 as any, _ref: 1,
  _lastTouch: 0, _wantForce: false, _pendingRefresh: false, _bigAt: {} as { [k: string]: number }, _conflict: false, _started: false,

  /* ---------- set-up ---------- */
  online(): any { return Licence.online(); },
  load(): SyncLocal { try { const s = JSON.parse(localStorage.getItem(SYNC_LS) || 'null'); if (s && s.key) return s; } catch (e) { /* none */ } return null; },
  keep() { try { localStorage.setItem(SYNC_LS, JSON.stringify(this.st)); } catch (e) { /* storage full */ } },
  on(): boolean { return !!(this.st && this.st.on && this.online() && !Mode.coop()); },
  device(): string { return Licence.device || 'unknown'; },
  devName(): string {
    if (DESKTOP) return Licence.deviceName && !/^This /.test(Licence.deviceName) ? Licence.deviceName : 'PC';
    const m = /Android [\d.]+; ([^;)]+)/.exec(navigator.userAgent); return m ? m[1].replace(/ Build.*$/, '').trim() : 'Phone';
  },
  /** This device is linked to Flight Simulator with a flight going on. */
  simFlying(): boolean { try { const s: any = Link.sim || null; return Link.status === 'connected' && !!(s && s.connected && s.inFlight); } catch (e) { return false; } },

  init() {
    this.st = this.load();
    if (Mode.coop() || !this.st || !this.st.on) return;
    if (!this.online()) { this.role = 'setup'; return; }
    this.start();
  },

  start() {
    if (this._started) return; this._started = true;
    this.role = 'offline';
    this.keyReady().then(() => {
      this.live();
      this.tick();
      this._timer = setInterval(() => this.tick(), 8000);
      this._pushT = setInterval(() => { if (this.role === 'engine') this.push(); }, 3000);
      setInterval(() => this.refreshIfQuiet(), 1000);
    });
    // you use this device: it runs the airline from now on
    document.addEventListener('pointerdown', () => { this._lastTouch = Date.now(); if (this.role === 'mirror' && !this.blockedBySim()) { this._wantForce = true; this.tick(); } }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.role === 'engine' && !this.simFlying()) { this.push(true); this.rpc('amp_sync_release', { p_id: this.id, p_device: this.device() }); this.role = 'mirror'; } }
      else this.tick();
    });
    window.addEventListener('online', () => this.tick());
  },

  stop() {
    clearInterval(this._timer); clearInterval(this._pushT); this._started = false;
    try { if (this._ws) this._ws.close(); } catch (e) { /* closed */ } this._ws = null; clearInterval(this._hb);
    this.role = 'off';
  },

  /** The airline's fingerprint (its address online) and its encryption key, from the secret key. */
  keyReady(): Promise<void> {
    const k = this.st.key;
    this.id = sha256Hex('amp-sync-id|' + k);
    return crypto.subtle.importKey('raw', syncHexBytes(sha256Hex('amp-sync-enc|' + k)), 'AES-GCM', false, ['encrypt', 'decrypt']).then(ek => { this._ek = ek; });
  },

  /* ---------- the online calls ---------- */
  rpc(fn: string, args: any, ms?: number): Promise<any> {
    const o = this.online(); if (!o) return Promise.reject(new Error('not set up'));
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 20000);
    return fetch(o.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', signal: ctl.signal,
      headers: supaHeaders(o.supabaseKey), body: JSON.stringify(args) })
      .then(r => { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.status === 204 ? null : r.json(); });
  },

  /* ---------- packing ---------- */
  pack(v: any): Promise<string> {
    const raw = new TextEncoder().encode(JSON.stringify(v)), iv = crypto.getRandomValues(new Uint8Array(12));
    const gz = (typeof (window as any).CompressionStream !== 'undefined')
      ? new Response(new Blob([raw]).stream().pipeThrough(new (window as any).CompressionStream('gzip'))).arrayBuffer().then(b => ({ b: new Uint8Array(b), z: true }))
      : Promise.resolve({ b: raw, z: false });
    return gz.then(g => crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this._ek, g.b).then(ct => {
      const out = new Uint8Array(12 + ct.byteLength); out.set(iv, 0); out.set(new Uint8Array(ct), 12);
      return (g.z ? 'g1.' : 'p1.') + syncB64(out);
    }));
  },
  unpack(s: string): Promise<any> {
    const z = s.slice(0, 3) === 'g1.', all = syncUnB64(s.slice(3));
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, this._ek, all.slice(12)).then(pt => {
      if (!z) return new Uint8Array(pt);
      return new Response(new Blob([pt]).stream().pipeThrough(new (window as any).DecompressionStream('gzip'))).arrayBuffer().then(b => new Uint8Array(b));
    }).then(b => JSON.parse(new TextDecoder().decode(b)));
  },

  /* ---------- the airline in parts ---------- */
  keys(): string[] { return SAVED_KEYS.filter(k => k === 'settings' || (DEVICE_KEYS.indexOf(k) < 0 && k !== 'screen')); },
  value(k: string): any {
    const v = (State as any)[k];
    if (k !== 'settings') return v === undefined ? null : v;
    const o: any = {}; for (const s of Object.keys(v || {})) if (!SYNC_DEVICE_SETTING.test(s)) o[s] = v[s];
    return o;
  },
  hash(v: any): string { const s = JSON.stringify(v); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + '.' + s.length; },
  changed(): string[] { const h = this.st.h || {}; return this.keys().filter(k => h[k] !== this.hash(this.value(k))); },
  apply(k: string, v: any) {
    const S: any = State;
    if (k === 'settings') { const keep: any = {}; for (const s of Object.keys(S.settings || {})) if (SYNC_DEVICE_SETTING.test(s)) keep[s] = S.settings[s]; S.settings = Object.assign({}, S.settings, v || {}, keep); }
    else S[k] = v;
    this.st.h[k] = this.hash(this.value(k));
  },

  /* ---------- the regular check ---------- */
  tick(): Promise<void> {
    if (!this.on() || !this._ek || this.busy || this._conflict) return Promise.resolve();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.goOffline(); return Promise.resolve(); }
    this.busy = true;
    // changes made while this device ran the airline (or played without internet) are its own
    if ((this.role === 'engine' || this.role === 'offline') && this.changed().length) { this.st.dirty = true; this.keep(); }
    const me = this.device(), name = this.devName() + (this.simFlying() ? ' ·sim' : '');
    return this.rpc('amp_sync_head', { p_id: this.id, p_device: me, p_name: name }).then((h: any) => {
      // nothing online yet: this device's airline goes up first
      if (!h || h.ver === -1) { this.st.ver = 0; this.st.h = {}; return this.push(true, true).then(() => this.claim(true)); }
      const ahead = h.ver > this.st.ver, mine = this.changed();
      // played without internet while the airline moved on elsewhere: you choose
      if (ahead && mine.length && this.st.dirty && this.role === 'offline' && h.engine !== me) return this.conflict(h);
      // another device took over a moment ago: follow it (the last few seconds here give way)
      if (this.role === 'engine' && h.engine && h.engine !== me && h.engine_age < 40) { this.role = 'mirror'; this.st.dirty = false; this.st.h = {}; return this.pull().then(() => this.noteEngine(h)); }
      return (ahead ? this.pull() : Promise.resolve()).then(() => this.claim(false));
    }).then(() => { this.lastErr = ''; this.st.at = Date.now(); this.keep(); }, (e: any) => { this.lastErr = String(e && e.message || e); this.goOffline(); })
      .then(() => { this.busy = false; this.statusChanged(); });
  },
  goOffline() {
    if ((this.role === 'engine' || this.role === 'offline') && this.st && this.changed().length) { this.st.dirty = true; this.keep(); }
    if (this.role !== 'offline') { this.role = 'offline'; this.statusChanged(); }
  },

  /** Run the airline here, or follow the device that does. */
  claim(first: boolean): Promise<void> {
    const me = this.device(), sim = this.simFlying();
    const active = !document.hidden && (first || this._wantForce || sim || Date.now() - this._lastTouch < 10 * 60000 || this.role === 'engine' || this.role === 'offline');
    if (!active) { this.role = 'mirror'; return this.rpc('amp_sync_engine', { p_id: this.id, p_device: me, p_name: this.devName(), p_force: false }).then((r: any) => { this.role = r && r.engine === me ? 'engine' : 'mirror'; this.noteEngine(r); }); }
    const force = this._wantForce || (sim && !this.engineSim); this._wantForce = false;
    return this.rpc('amp_sync_engine', { p_id: this.id, p_device: me, p_name: this.devName() + (sim ? ' ·sim' : ''), p_force: force }).then((r: any) => {
      const was = this.role; this.role = r && r.engine === me ? 'engine' : 'mirror'; this.noteEngine(r);
      if (this.role === 'engine' && was !== 'engine') { this.say('engine'); if (r.ver > this.st.ver) return this.pull(); }
    });
  },
  noteEngine(r: any) { const n = String(r && r.engine_name || ''); this.engineSim = / ·sim$/.test(n); this.engineName = n.replace(/ ·sim$/, ''); },
  /** While another device flies in Flight Simulator, it keeps running the airline. */
  blockedBySim(): boolean { return this.engineSim && !this.simFlying(); },

  /** Send the parts that changed (big ones at most every 20 seconds unless now). */
  push(now?: boolean, all?: boolean): Promise<void> {
    if (!this.on() || !this._ek || (!all && this.role !== 'engine' && this.role !== 'offline')) return Promise.resolve();
    const ks = all ? this.keys() : this.changed(); if (!ks.length) return Promise.resolve();
    try { Store.save(); } catch (e) { /* saved next time */ }
    const vals = ks.map(k => this.value(k));
    return Promise.all(vals.map(v => this.pack(v))).then(packed => {
      const parts: any[] = [], sent: string[] = [];
      ks.forEach((k, i) => {
        const big = packed[i].length > 120000;
        if (big && !now && !all && Date.now() - (this._bigAt[k] || 0) < 20000) return;
        if (big) this._bigAt[k] = Date.now();
        parts.push({ k, data: packed[i] }); sent.push(k);
      });
      if (!parts.length) return;
      const hs = sent.map(k => this.hash(this.value(k)));
      return this.rpc('amp_sync_push', { p_id: this.id, p_base: this.st.ver, p_device: this.device(), p_parts: parts, p_force: false }, 60000).then((r: any) => {
        if (r && r.ok) { this.st.ver = r.ver; sent.forEach((k, i) => { this.st.h[k] = hs[i]; }); this.st.dirty = this.changed().length > 0; this.keep(); this.say('ver'); return; }
        // the airline moved on (another device sent first, just before this one took over): take their
        // other parts and send these again on top
        return this.pull(sent).then(() => this.rpc('amp_sync_push', { p_id: this.id, p_base: this.st.ver, p_device: this.device(), p_parts: parts, p_force: false }, 60000))
          .then((r2: any) => { if (r2 && r2.ok) { this.st.ver = r2.ver; sent.forEach((k, i) => { this.st.h[k] = hs[i]; }); this.keep(); this.say('ver'); } });
      });
    }).catch((e: any) => { this.lastErr = String(e && e.message || e); this.st.dirty = true; this.keep(); this.goOffline(); });
  },

  /** Fetch and take in what changed online (except the parts this device is about to send). */
  pull(except?: string[]): Promise<void> {
    return this.rpc('amp_sync_pull', { p_id: this.id, p_since: this.st.ver }, 60000).then((r: any) => {
      if (!r || r.ver < 0) return;
      const parts = (r.parts || []).filter((p: any) => !except || except.indexOf(p.k) < 0);
      return Promise.all(parts.map((p: any) => this.unpack(p.data).then(v => ({ k: p.k, v })))).then(list => {
        list.forEach((x: any) => this.apply(x.k, x.v));
        this.st.ver = r.ver; if (this.role === 'mirror' && !except) this.st.dirty = false; this.keep();
        if (list.length) { try { Store.save(); } catch (e) { /* saved next time */ } this._pendingRefresh = true; this.refreshIfQuiet(); }
      });
    });
  },

  /** Show what came in, without disturbing a dialog that is open or a field being typed in. */
  refreshIfQuiet() {
    if (!this._pendingRefresh) return;
    const a = document.activeElement as HTMLElement;
    if (_layers.length || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    this._pendingRefresh = false;
    try { refresh(); } catch (e) { /* the next change */ }
  },

  /* ---------- the live channel (Supabase Realtime): a nudge when the airline changes ---------- */
  live() {
    const o = this.online(); if (!o || typeof WebSocket === 'undefined') return;
    const topic = 'realtime:amp-' + this.id.slice(0, 32);
    let ws: WebSocket;
    try { ws = new WebSocket(o.supabaseUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(o.supabaseKey) + '&vsn=1.0.0'); } catch (e) { return; }
    this._ws = ws; this._wsOk = false;
    const send = (m: any) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(m)); } catch (e) { /* closed */ } };
    ws.onopen = () => {
      send({ topic, event: 'phx_join', payload: Object.assign({ config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } }, /^sb_/.test(o.supabaseKey) ? {} : { access_token: o.supabaseKey }), ref: String(this._ref++), join_ref: '1' });
      clearInterval(this._hb); this._hb = setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(this._ref++) }), 25000);
    };
    ws.onmessage = ev => {
      let m: any; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.event === 'phx_reply' && m.topic === topic) this._wsOk = m.payload && m.payload.status === 'ok';
      if (m.event === 'broadcast' && m.payload) { const p = m.payload.payload || {}; if (p.dev === this.device()) return; if (m.payload.event === 'engine' && this.role === 'engine') this.tick(); else if (m.payload.event === 'ver' && p.ver > this.st.ver) this.tick(); }
    };
    ws.onclose = () => { this._wsOk = false; clearInterval(this._hb); if (this._started) setTimeout(() => { if (this._started && this._ws === ws) this.live(); }, 5000); };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* closed */ } };
  },
  say(ev: string) {
    const ws = this._ws; if (!ws || ws.readyState !== 1) return;
    try { ws.send(JSON.stringify({ topic: 'realtime:amp-' + this.id.slice(0, 32), event: 'broadcast', payload: { type: 'broadcast', event: ev, payload: { ver: this.st.ver, dev: this.device() } }, ref: String(this._ref++) })); } catch (e) { /* closed */ }
  },

  /* ---------- both played apart: you choose ---------- */
  conflict(h: any): Promise<void> {
    this._conflict = true;
    return this.rpc('amp_sync_pull', { p_id: this.id, p_since: 0 }, 60000).then((r: any) =>
      Promise.all((r.parts || []).map((p: any) => this.unpack(p.data).then(v => ({ k: p.k, v })))).then(list => {
        const other: any = {}; list.forEach((x: any) => { other[x.k] = x.v; });
        const mineSum = syncSummary(State), theirs = syncSummary(other);
        openLayer('modal', `<div class="modal-head"><div><h2>Two versions of your airline</h2><small>This device and ${esc(h.engine_name ? String(h.engine_name).replace(/ ·sim$/, '') : 'another device')} were both played while they weren't connected.</small></div></div>
          <div class="modal-body sync-pick"><p class="muted">Choose which one to keep. The other is kept on this device (Settings → Sync), so nothing is lost.</p>
          <div class="sync-cards">${syncCard('This device', mineSum, 'mine')}${syncCard('Your other devices (online)', theirs, 'theirs')}</div></div>`, { cls: 'wide sync-pop' });
        (window as any).__syncOther = other;
      }));
  },
  /** The chosen copy wins; the other is kept on this device. */
  resolve(keepMine: boolean): Promise<void> {
    const other = (window as any).__syncOther || {};
    const backupOf = (src: any) => { const o: any = {}; for (const k of this.keys()) o[k] = k === 'settings' ? src.settings : src[k]; return JSON.stringify({ at: Date.now(), state: o }); };
    try { localStorage.setItem(SYNC_OTHER, keepMine ? backupOf(other) : backupOf(State)); } catch (e) { /* too big for the browser's storage */ }
    closeAll();
    const go2 = keepMine
      ? this.rpc('amp_sync_head', { p_id: this.id, p_device: this.device(), p_name: this.devName() }).then((h: any) =>
          Promise.all(this.keys().map(k => this.pack(this.value(k)).then(d => ({ k, data: d })))).then(parts =>
            this.rpc('amp_sync_push', { p_id: this.id, p_base: h.ver, p_device: this.device(), p_parts: parts, p_force: true }, 60000)).then((r: any) => {
              this.st.ver = r.ver; for (const k of this.keys()) this.st.h[k] = this.hash(this.value(k)); this.say('ver'); }))
      : Promise.resolve().then(() => { for (const k of Object.keys(other)) this.apply(k, other[k]); this.st.ver = 0; return this.pull(); });
    return go2.then(() => { this.st.dirty = false; this._conflict = false; this.keep(); Store.save(); this._pendingRefresh = true; this.refreshIfQuiet(); toast(keepMine ? 'This device\'s airline is kept and sent to your other devices' : 'The airline from your other devices is here now', 'ok'); this.tick(); },
      () => { this._conflict = false; toast('Couldn\'t reach the internet: try again in a moment', 'warn'); });
  },

  /* ---------- switching on, linking, leaving ---------- */
  enable(): Promise<void> {
    if (!this.online()) return Promise.resolve();
    const key = syncNewKey();
    this.st = { on: true, key, ver: 0, h: {}, dirty: true, at: 0 }; this.keep();
    this.start(); return Promise.resolve();
  },
  /** A one-use code (ten minutes) that lets another device join this airline. */
  linkCode(): Promise<string> {
    const code = syncCode(), k = syncHexBytes(sha256Hex('amp-link-key|' + code)), iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.importKey('raw', k, 'AES-GCM', false, ['encrypt']).then(ck => crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ck, new TextEncoder().encode(JSON.stringify({ key: this.st.key, from: this.devName() }))))
      .then(ct => { const out = new Uint8Array(12 + ct.byteLength); out.set(iv, 0); out.set(new Uint8Array(ct), 12); return this.rpc('amp_sync_link_put', { p_code_fp: sha256Hex('amp-link|' + code), p_payload: syncB64(out) }); })
      .then(() => code.slice(0, 4) + '-' + code.slice(4));
  },
  /** Join the airline of another device with its code: this device's airline is replaced (and kept as a copy). */
  join(raw: string): Promise<'ok' | 'bad' | 'net'> {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) return Promise.resolve('bad');
    return this.rpc('amp_sync_link_take', { p_code_fp: sha256Hex('amp-link|' + code) }).then((payload: any) => {
      if (!payload || typeof payload !== 'string') return 'bad' as any;
      const all = syncUnB64(payload);
      return crypto.subtle.importKey('raw', syncHexBytes(sha256Hex('amp-link-key|' + code)), 'AES-GCM', false, ['decrypt'])
        .then(ck => crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, ck, all.slice(12)))
        .then(pt => {
          const j = JSON.parse(new TextDecoder().decode(pt));
          try { Store.save(); localStorage.setItem(SYNC_OTHER, JSON.stringify({ at: Date.now(), state: JSON.parse(localStorage.getItem(STORE_KEY) || '{}').state })); } catch (e) { /* too big */ }
          this.stop();
          this.st = { on: true, key: j.key, ver: 0, h: {}, dirty: false, at: 0, joinedAt: Date.now() }; this.keep();
          return this.keyReady().then(() => this.pull()).then(() => { this.start(); return 'ok' as any; });
        });
    }, () => 'net');
  },
  /** Stop syncing on this device (the airline stays here as it is; the last device to leave removes the online copy). */
  leave(removeOnline: boolean): Promise<void> {
    const id = this.id, me = this.device();
    this.stop(); if (this.st) { this.st.on = false; this.keep(); }
    return this.rpc('amp_sync_unlink', { p_id: id, p_device: me, p_delete: removeOnline }).then(() => undefined, () => undefined);
  },
  devices(): Promise<any[]> { return this.rpc('amp_sync_devices', { p_id: this.id }).then((r: any) => Array.isArray(r) ? r : [], () => []); },
  /** Bring back the copy that wasn't kept (after a choice, or from before joining). */
  restoreOther() {
    let o: any = null; try { o = JSON.parse(localStorage.getItem(SYNC_OTHER) || 'null'); } catch (e) { /* none */ }
    if (!o || !o.state) return;
    for (const k of Object.keys(o.state)) if (this.keys().indexOf(k) >= 0) { if (k === 'settings') this.apply(k, o.state[k]); else (State as any)[k] = o.state[k]; }
    if (this.st) this.st.dirty = true;
    Store.save(); this._wantForce = true; this.tick(); refresh(); toast('The other copy of your airline is back', 'ok');
  },

  statusChanged() { try { if (typeof _setSection !== 'undefined' && _setSection === 'cloud' && $('#set-body')) rerenderSettingsBody(); } catch (e) { /* settings closed */ } try { renderSyncChip(); } catch (e) { /* no top bar yet */ } },
};

/** Run the airline's clocks so that they pause while another device runs the airline (this one only shows it). */
function syncGated(fn: () => void) {
  const W: any = window, oT = W.setTimeout, oI = W.setInterval;
  const wrap = (cb: any, retry: boolean) => function g(this: any, ...a: any[]) {
    if (CloudSync.role === 'mirror') { if (retry) oT(g, 3000); return undefined; }
    const pT = W.setTimeout, pI = W.setInterval; W.setTimeout = T; W.setInterval = I;
    try { return cb.apply(this, a); } finally { W.setTimeout = pT; W.setInterval = pI; }
  };
  const T: any = (cb: any, ms?: number, ...a: any[]) => typeof cb === 'function' ? oT(wrap(cb, true), ms, ...a) : oT(cb, ms);
  const I: any = (cb: any, ms?: number, ...a: any[]) => typeof cb === 'function' ? oI(wrap(cb, false), ms, ...a) : oI(cb, ms);
  W.setTimeout = T; W.setInterval = I;
  try { fn(); } finally { W.setTimeout = oT; W.setInterval = oI; }
}

/* ---------- small helpers ---------- */
function syncHexBytes(h: string): any { const b = new Uint8Array(h.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; }
function syncB64(b: Uint8Array): string { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000))); return btoa(s); }
function syncUnB64(s: string): any { const t = atob(s), b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; }
function syncNewKey(): string { const b = crypto.getRandomValues(new Uint8Array(32)); return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(''); }
function syncCode(): string { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(8)); return Array.from(b).map(x => A[x % A.length]).join(''); }
function syncSummary(S: any): { saved: string; balance: string; fleet: number; flights: number; last: string } {
  const co = (S.companies || []).filter((c: any) => c.id === S.companyId)[0] || (S.companies || [])[0] || {};
  const lb = Array.isArray(S.logbook) ? S.logbook : [];
  const last = lb.length ? lb[lb.length - 1] : null;
  let bal = ''; try { bal = money(co.balance || 0); } catch (e) { bal = String(Math.round(co.balance || 0)); }
  return { saved: '', balance: bal, fleet: Array.isArray(S.fleet) ? S.fleet.length : 0, flights: lb.length, last: last ? [last.from, last.to].filter(Boolean).join(' → ') : '' };
}
function syncCard(title: string, s: any, which: string): string {
  return `<div class="sync-card"><b>${esc(title)}</b>
    <span><small>Balance</small>${esc(s.balance)}</span><span><small>Aircraft</small>${s.fleet}</span><span><small>Flights in the log</small>${s.flights}</span>${s.last ? `<span><small>Last flight</small>${esc(s.last)}</span>` : ''}
    <button class="btn ${which === 'mine' ? '' : 'ghost'}" data-act="sync-keep" data-v="${which}">Keep this one</button></div>`;
}
/** A small mark in the top bar: synced, running here, showing another device, or offline. */
function renderSyncChip() {
  const el = document.querySelector('.sync-chip') as HTMLElement; if (!el) return;
  const C = CloudSync, r = C.role;
  if (!C.on()) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.className = 'sync-chip ' + r;
  el.title = r === 'engine' ? 'Synced: this device runs the airline' : r === 'mirror' ? 'Synced: showing your airline live from ' + (C.engineName || 'your other device') : 'Not connected: playing on this device, it catches up when online';
  el.innerHTML = icon('sync') + `<span>${r === 'engine' ? 'Synced' : r === 'mirror' ? 'Live' : 'Offline'}</span>`;
}

ACTIONS['sync-on'] = () => { CloudSync.enable().then(() => { Sound.tick(); rerenderSettingsBody(); setTimeout(() => rerenderSettingsBody(), 3000); }); };
ACTIONS['sync-code'] = () => {
  const out = document.querySelector('.sync-code-out') as HTMLElement; if (out) out.textContent = '…';
  CloudSync.linkCode().then(c => { (window as any).__syncCode = { c, at: Date.now() }; rerenderSettingsBody(); }, () => toast('Couldn\'t reach the internet: try again in a moment', 'warn'));
};
ACTIONS['sync-join'] = () => {
  const inp = document.querySelector('.sync-join-in') as HTMLInputElement, v = inp ? inp.value : '';
  CloudSync.join(v).then(r => {
    if (r === 'ok') { toast('This device is now linked to your airline', 'ok'); rerenderSettingsBody(); refresh(); }
    else toast(r === 'bad' ? 'That code isn\'t right, or it has run out (codes last ten minutes). Make a new one on your other device.' : 'Couldn\'t reach the internet: try again in a moment', 'warn');
  });
};
ACTIONS['sync-leave'] = el => {
  const all = el.getAttribute('data-v') === 'all';
  CloudSync.leave(all).then(() => { toast(all ? 'Sync is off and the online copy is removed. Your airline stays on this device.' : 'Sync is off on this device. Your airline stays here as it is.', 'ok'); rerenderSettingsBody(); renderSyncChip(); });
};
ACTIONS['sync-keep'] = el => { CloudSync.resolve(el.getAttribute('data-v') === 'mine'); };
ACTIONS['sync-restore'] = () => { CloudSync.restoreOther(); rerenderSettingsBody(); };
ACTIONS['sync-now'] = () => { CloudSync._wantForce = true; CloudSync.tick().then(() => rerenderSettingsBody()); };

/** Settings → Sync. */
function syncSettingsHtml(): string {
  const C = CloudSync, st = C.st;
  if (Mode.coop()) return `<p class="v3d-note">${icon('info')}Co-op airlines are online already and are the same on every device. Sync is for your own airline.</p>`;
  if (!C.online()) return `<div class="set-card col"><div class="sc-h">${icon('sync')}<span><b>Sync your airline</b><small>Your airline, the demo airline too, on your phone and your PC, live, wherever you are with internet.</small></span></div>
    <p class="v3d-note">${icon('info')}Online sync isn't available in this version of the app yet.</p></div>`;
  const other = (() => { try { return !!localStorage.getItem(SYNC_OTHER); } catch (e) { return false; } })();
  if (!C.on()) return `<div class="set-card col"><div class="sc-h">${icon('sync')}<span><b>Sync your airline</b><small>Your airline, the demo airline too, on your phone and your PC, live, wherever you are with internet. It is locked on your devices before it goes online, so only your own devices can read it.</small></span></div>
      <button class="btn" data-act="sync-on">${icon('sync')}Switch on sync for this airline</button></div>
    <div class="set-card col"><div class="sc-h">${icon('swap')}<span><b>Join your airline from another device</b><small>On the device that has your airline: Settings → Sync → Link another device. Type the code it shows here. The airline on this device is replaced; a copy of it is kept here.</small></span></div>
      <div class="sync-join"><input class="le-in sync-join-in" placeholder="ABCD-1234" maxlength="9" autocapitalize="characters" spellcheck="false" aria-label="Linking code"><button class="btn" data-act="sync-join">Join</button></div></div>
    ${other ? `<button class="btn ghost" data-act="sync-restore">${icon('download')}Bring back this device's earlier airline</button>` : ''}`;
  const r = C.role, ago = st.at ? Math.max(0, Math.round((Date.now() - st.at) / 1000)) : -1;
  const state = r === 'engine' ? 'This device runs your airline; your other devices show it live.'
    : r === 'mirror' ? `Showing your airline live from ${esc(C.engineName || 'your other device')}. Use this device and it takes over.${C.blockedBySim() ? ' During the flight in Flight Simulator, that device keeps running the airline; changes made here are not kept until the flight ends.' : ''}`
    : `Not connected right now: you play on this device, and it catches up when it is online again.${C.lastErr ? ' (' + esc(C.lastErr) + ')' : ''}`;
  const code = (window as any).__syncCode, codeOk = code && Date.now() - code.at < 9.5 * 60000;
  if (!(window as any).__syncDevs || Date.now() - (window as any).__syncDevsAt > 15000) { (window as any).__syncDevsAt = Date.now(); C.devices().then(d => { (window as any).__syncDevs = d; if (_setSection === 'cloud') rerenderSettingsBody(); }); }
  const devs: any[] = (window as any).__syncDevs || [];
  return `<div class="set-card col"><div class="sc-h">${icon('sync')}<span><b>Sync is on</b><small>${state}</small></span></div>
      <div class="sync-stat"><span class="sync-dot ${r}"></span>${r === 'engine' ? 'Running here' : r === 'mirror' ? 'Live' : 'Offline'}${ago >= 0 ? ` · checked ${ago < 60 ? ago + ' s' : Math.round(ago / 60) + ' min'} ago` : ''} · version ${st.ver}${C._wsOk ? ' · live channel on' : ''}
        <button class="btn ghost sm" data-act="sync-now">${icon('sync')}Sync now</button></div></div>
    <div class="set-card col"><div class="sc-h">${icon('swap')}<span><b>Link another device</b><small>On your other device (phone or PC): Settings → Sync → Join, and type this code. It works once, for ten minutes.</small></span></div>
      ${codeOk ? `<div class="sync-code-out">${esc(code.c)}</div>` : `<button class="btn" data-act="sync-code">${icon('key')}Make a code</button>`}</div>
    <div class="set-card col"><div class="sc-h">${icon('pc')}<span><b>Your devices</b><small>The devices linked to this airline.</small></span></div>
      <ul class="sync-devs">${devs.length ? devs.map(d => `<li>${icon(/PC|Windows|DESKTOP/i.test(d.name || '') ? 'pc' : 'cell')}<b>${esc(String(d.name || 'Device').replace(/ ·sim$/, ''))}</b>${d.device === C.device() ? '<em>this device</em>' : ''}<small>${d.seen_age < 90 ? 'online now' : 'seen ' + syncAgo(d.seen_age) + ' ago'}</small></li>`).join('') : '<li><small>…</small></li>'}</ul></div>
    <div class="set-card col"><div class="sc-h">${icon('shield')}<span><b>Stop syncing</b><small>Your airline stays on this device as it is. When the last device stops, the online copy is removed.</small></span></div>
      <div class="sync-btns"><button class="btn ghost" data-act="sync-leave" data-v="me">Stop on this device</button><button class="btn ghost danger" data-act="sync-leave" data-v="all">Stop and remove the online copy</button></div></div>
    ${other ? `<button class="btn ghost" data-act="sync-restore">${icon('download')}Bring back the copy that wasn't kept</button>` : ''}`;
}
function syncAgo(s: number): string { return s < 3600 ? Math.round(s / 60) + ' min' : s < 86400 * 2 ? Math.round(s / 3600) + ' h' : Math.round(s / 86400) + ' days'; }
