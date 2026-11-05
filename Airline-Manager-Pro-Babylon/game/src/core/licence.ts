// Registration. Each customer gets a registration key at purchase (15 capital letters and digits,
// ABCDE-23456-FGHJK). The first device it is registered on keeps it; that device can register again
// as often as it likes (after a reinstall, for example). On a new device, or after Windows or the phone
// has been set up from scratch, the key needs a reactivation code; each code works once.
//
// The app knows the keys and codes only by their fingerprints (src/data/licence-hashes.ts). Which
// device holds which key is kept in the online register (Supabase, supabase/licences.sql) once it is
// set up in app.config.json; until then, and when offline, the app checks against its own record of the
// device the key was registered on, which also travels with backups to a new device.
//
// The device is identified by Android's ID for the app (kept through updates and reinstalls) or by
// Windows' machine ID; only a fingerprint of it is stored or sent.

interface LicenceRec { fp: string; masked: string; device: string; deviceName: string; at: number; checkedAt?: number; usedCodes?: string[] }

const LIC_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** SHA-256 (hex) of a short text. */
function sha256Hex(msg: string): string {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const bytes: number[] = []; const u = unescape(encodeURIComponent(msg));
  for (let i = 0; i < u.length; i++) bytes.push(u.charCodeAt(i));
  const bitLen = bytes.length * 8; bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], W = new Array(64);
  const r = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) { const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => ('00000000' + (x >>> 0).toString(16)).slice(-8)).join('');
}

const Licence = {
  device: '' as string, deviceName: '' as string,
  _keys: null as { [fp: string]: 1 }, _codes: null as { [fp: string]: 1 },

  /** "abcde 23456-fghjk" → "ABCDE23456FGHJK": small letters, spaces and dashes are fine. */
  normalise(s: string): string { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); },
  show(s: string): string { return s.replace(/(.{5})(?=.)/g, '$1-'); },
  mask(s: string): string { return s.slice(0, 5) + '-•••••-' + s.slice(10); },
  keyFp(s: string): string { return sha256Hex('AMP-KEY|' + s).slice(0, 12); },
  codeFp(s: string): string { return sha256Hex('AMP-REACT|' + s).slice(0, 12); },
  set(str: string): { [fp: string]: 1 } { const o: { [fp: string]: 1 } = {}; for (let i = 0; i < str.length; i += 12) o[str.substr(i, 12)] = 1; return o; },
  isKey(s: string): boolean { if (!this._keys) this._keys = this.set(LICENCE_KEY_FP); return s.length === 15 && !!this._keys[this.keyFp(s)]; },
  isCode(s: string): boolean { if (!this._codes) this._codes = this.set(LICENCE_CODE_FP); return s.length === 15 && !!this._codes[this.codeFp(s)]; },

  rec(): LicenceRec { return (State as any).licence || null; },
  /** 'none', 'ok' (registered on this device) or 'moved' (registered on another device: reactivate). */
  status(): 'none' | 'ok' | 'moved' | 'checking' {
    const r = this.rec(); if (!r) return 'none';
    if (!this.device) return 'checking';
    return r.device === this.device ? 'ok' : 'moved';
  },
  online(): any { const o = (APP as any).online; return o && o.supabaseUrl && o.supabaseKey ? o : null; },

  /** Find out which device this is (once, at start). */
  init(): Promise<void> {
    const done = (id: string, name: string) => { this.device = sha256Hex('AMP-DEV|' + id).slice(0, 24); this.deviceName = name || 'This device'; };
    const T = Store.native();
    const p: Promise<any> = T && T.deviceId ? T.deviceId() : DESKTOP ? fetch('/api/device').then(r => r.json()) : Promise.resolve(null);
    return p.then(d => {
      if (d && d.id) return done(d.id, d.name);
      // a browser (or an older PC app): an ID kept in this browser
      let id = ''; try { id = localStorage.getItem('amp-device') || ''; if (!id) { id = uid() + uid(); localStorage.setItem('amp-device', id); } } catch (e) { id = 'browser'; }
      done(id, DESKTOP ? 'This PC' : 'This browser');
    }).catch(() => done('unknown', 'This device')).then(() => {
      // on Windows the registration is also kept by the PC app, so it survives clearing the app's data
      if (DESKTOP) return fetch('/api/licence').then(r => r.json()).then(l => { if (l && l.fp && !(State as any).licence) { (State as any).licence = l; Store.save(); } }).catch(() => { /* older PC app */ });
    }).then(() => { try { if (_setSection === 'licence') rerenderSettingsBody(); } catch (e) { /* settings closed */ } });
  },

  /** Ask the online register (null when it isn't set up or can't be reached). */
  rpc(fn: string, args: any): Promise<string> {
    const o = this.online(); if (!o) return Promise.resolve(null);
    return fetch(o.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: supaHeaders(o.supabaseKey), body: JSON.stringify(args) })
      .then(r => r.ok ? r.json() : null).then(v => typeof v === 'string' ? v : null).catch(() => null);
  },

  save(fp: string, key: string, extra?: any) {
    const old = this.rec();
    (State as any).licence = Object.assign({ usedCodes: old && old.fp === fp ? old.usedCodes || [] : [] }, { fp, masked: this.mask(key), device: this.device, deviceName: this.deviceName, at: Date.now(), checkedAt: this.online() ? Date.now() : 0 }, extra || {});
    Store.save();
    if (DESKTOP) fetch('/api/licence', { method: 'PUT', body: JSON.stringify((State as any).licence) }).catch(() => { /* older PC app */ });
  },

  /** Register a key on this device. */
  register(raw: string): Promise<'ok' | 'invalid' | 'other-device'> {
    const key = this.normalise(raw);
    if (!this.isKey(key)) return Promise.resolve('invalid');
    const fp = this.keyFp(key), r = this.rec();
    // the record on this device says the key belongs to another device (a backup restored here)
    if (r && r.fp === fp && r.device !== this.device) return Promise.resolve('other-device');
    return this.rpc('amp_activate', { p_key: fp, p_device: this.device, p_name: this.deviceName }).then(res => {
      if (res === 'other-device') return 'other-device';
      if (res === 'unknown') return 'invalid';
      this.save(fp, key);
      return 'ok';
    });
  },

  /** Move a key to this device with a reactivation code. */
  reactivate(rawKey: string, rawCode: string): Promise<'ok' | 'invalid-key' | 'invalid-code' | 'used-code'> {
    const key = this.normalise(rawKey), code = this.normalise(rawCode);
    if (!this.isKey(key)) return Promise.resolve('invalid-key');
    if (!this.isCode(code)) return Promise.resolve('invalid-code');
    const fp = this.keyFp(key), cfp = this.codeFp(code), r = this.rec();
    if (r && (r.usedCodes || []).indexOf(cfp) >= 0) return Promise.resolve('used-code');
    return this.rpc('amp_reactivate', { p_key: fp, p_code: cfp, p_device: this.device, p_name: this.deviceName }).then(res => {
      if (res === 'used-code') return 'used-code';
      if (res === 'bad-code') return 'invalid-code';
      if (res === 'unknown') return 'invalid-key';
      this.save(fp, key, { usedCodes: ((r && r.fp === fp && r.usedCodes) || []).concat([cfp]) });
      return 'ok';
    });
  },
};

/** Headers for the online register: the newer publishable keys (sb_publishable_…) go in the apikey header
 *  only (they are not tokens); the older anon keys are sent both ways, as Supabase expects. */
function supaHeaders(key: string): any {
  const h: any = { 'Content-Type': 'application/json', apikey: key };
  if (!/^sb_/.test(key)) h.Authorization = 'Bearer ' + key;
  return h;
}
