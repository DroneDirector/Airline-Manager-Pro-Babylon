// Saves the airline on the device so it survives app updates and restarts.
// Updates replace the app's files but keep this saved data. New settings or data added in a
// later version are merged in with their defaults, so an older save always keeps working.

const STORE_KEY = 'airline-manager-pro.save';
// Two worlds, each with its own save: your own airline with hired (AI) pilots, and co-op, where the airline
// is flown by real players. Switching loads the other world; neither touches the other's aircraft, money,
// staff or logs. Settings and the like belong to the device and are the same in both.
const MODE_KEY = 'amp-mode', DEVICE_KEY = 'airline-manager-pro.device';
const DEVICE_KEYS = ['settings', 'birthdayGreeted', 'seenVersion', 'wnClosed', 'licence', 'knownAirports', 'simInstalled', 'linkPc', 'linkedOnce', 'favs'];
const Mode = {
  _cur: null as boolean,   // the world this run of the app opened (fixed until it restarts)
  coop(): boolean { if (this._cur === null) { try { this._cur = localStorage.getItem(MODE_KEY) === 'coop'; } catch (e) { this._cur = false; } } return this._cur; },
  switching: false,
  key(): string { return this.coop() ? STORE_KEY + '.coop' : STORE_KEY; },
  /** Save this world and open the other one (the app restarts into it). */
  set(coop: boolean) {
    Store.save(); Store.flushNative(); this.switching = true;
    try { localStorage.setItem(MODE_KEY, coop ? 'coop' : 'solo'); localStorage.setItem('amp-resume', JSON.stringify({ at: Date.now(), screen: coop ? 'coop' : 'ops' })); } catch (e) { /* ignore */ }
    location.reload();
  },
};
const SAVE_VERSION = 1;
// Parts of State that are saved. Screen position and the like start fresh each launch.
const SAVED_KEYS = ['companyId', 'divisionId', 'myReg', 'settings', 'profiles', 'companies', 'pilots', 'candidates',
  'fleet', 'live', 'today', 'routes', 'logbook', 'issues', 'notices', 'txns', 'fines',
  'staff', 'staffCandidates', 'incidents', 'coPilot', 'birthdayGreeted', 'simDate', 'myLoad', 'salaryV2',
  'linkPc', 'linkedOnce', 'knownAirports', 'lastTouchdown', 'aiNext', 'aiDay', 'cases', 'screen', 'badges', 'progress', 'popLog', 'ratingDay', 'condTick', 'groundedUntil', 'payNext', 'poolNext', 'conductPausedAt', 'seenVersion', 'wnClosed', 'coop', 'favs', 'licence', 'bank', 'jobs', 'landRecs', 'ofp', 'plans', 'acars', 'simInstalled', 'usedMarket', 'payV3', 'unions', 'moraleNext', 'paxRecords', 'noFly', 'paxReviews', 'groundV1', 'groundWarned', 'news', 'whistle', 'wbDay', 'thanksDue', 'thanks', 'newsSeen', 'newsCool', 'newsWatchV1', 'newsWx', 'conductDrama', 'difficulty', 'conductPlan', 'pet', 'family', 'finHold', 'regNext', 'fresh', 'visited', 'gifts', 'giftSeen', 'briefDay', 'life', 'rides', 'photoNewsDay', 'mkt', 'stock', 'bookings', 'challenges', 'gevents', 'briefings', 'mktReal', 'faCrew', 'birthdayBowed', 'loyalty', 'achv', 'firstWeek', 'freeCrew', 'poolFill', 'hangarItems'];

// Changes between save versions go here, e.g. MIGRATIONS[2] = data => { ...; return data; }
const MIGRATIONS: { [v: number]: (d: any) => any } = {};

const Store = {
  _timer: 0 as any,
  _defaults: null as any,
  wasEmpty: false,   // nothing was saved on this phone when the app started

  load() {
    this._defaults = JSON.parse(JSON.stringify(State.settings));
    let raw: string = null;
    try { raw = localStorage.getItem(Mode.key()); } catch (e) { return; }
    if (!raw) { this.wasEmpty = true; this.loadDevice(); return; }
    let data: any;
    try { data = JSON.parse(raw); } catch (e) { this.backupBroken(raw); return; }
    if (!data || typeof data !== 'object' || !data.state) return;
    let v = data.v || 1;
    while (v < SAVE_VERSION) { v++; if (MIGRATIONS[v]) data.state = MIGRATIONS[v](data.state); }
    const st = data.state, S: any = State;
    for (const k of SAVED_KEYS) {
      if (!(k in st)) continue;
      if (k === 'settings' || k === 'myReg') S[k] = Object.assign({}, S[k], st[k]); // keep new defaults
      else S[k] = st[k];
    }
    this.loadDevice();
    this.repair();
  },
  /** Saves started from scratch in 0.9.8–0.9.13 could hold empty records where lists were expected: put them right. */
  repair() {
    const S: any = State;
    for (const k of ['acars', 'cases', 'landRecs']) if (S[k] != null && !Array.isArray(S[k])) S[k] = [];
    if (S.bank && !S.bank.loans) S.bank = Object.assign({ loans: [], insurance: {}, insNext: {}, campaigns: [], rentNext: {} }, S.bank, { loans: [] });
    if (S.coop && !Array.isArray(S.coop.members)) S.coop = null;
    if (S.usedMarket && !Array.isArray(S.usedMarket.items)) S.usedMarket = null;
  },
  /** Settings and other device things, shared by both worlds. */
  loadDevice() {
    let d: any = null; try { d = JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null'); } catch (e) { /* none yet */ }
    if (!d) return;   // first time: they are in the solo save already
    const S: any = State;
    for (const k of DEVICE_KEYS) if (k in d) S[k] = k === 'settings' ? Object.assign({}, S[k], d[k]) : d[k];
  },

  /** Every save was deleted on the start screen: nothing is saved until a new game is started or a save is loaded. */
  nogame(): boolean { try { return localStorage.getItem('amp-nogame') === '1'; } catch (e) { return false; } },
  save() {
    if (this.nogame()) return;
    if (Mode.switching) return;   // the other world is opening: this one is saved already
    const out: any = {};
    for (const k of SAVED_KEYS) out[k] = (State as any)[k];
    const json = JSON.stringify({ v: SAVE_VERSION, app: APP.version, savedAt: Date.now(), state: out });
    try { localStorage.setItem(Mode.key(), json); }
    catch (e) { /* storage full or unavailable: keep running from memory */ }
    try { const d: any = {}; for (const k of DEVICE_KEYS) d[k] = (State as any)[k]; localStorage.setItem(DEVICE_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    // the phone's own copy and the backup folder hold your own airline; the co-op airline lives online
    if (Mode.coop()) return;
    // and a second copy in the app's own files on the phone
    // (at most every few seconds, and straight away when the app goes to the background)
    this._native = json;
    if (typeof Backup !== 'undefined') Backup.afterSave(json, document.hidden);
    if (typeof SaveSlots !== 'undefined') SaveSlots.after(json, document.hidden);
    if (document.hidden) this.flushNative();
    else if (!this._nativeTimer) this._nativeTimer = setTimeout(() => this.flushNative(), 1200);
  },
  _native: '' as string,
  _nativeTimer: 0 as any,
  flushNative() {
    clearTimeout(this._nativeTimer); this._nativeTimer = 0;
    const T = this.native(), json = this._native; this._native = '';
    if (json && T && T.backupWrite) T.backupWrite({ data: json }).catch(() => { /* the web copy is still there */ });
  },

  native(): any { const cap = (window as any).Capacitor; return cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.AppTools; },

  /** If the web storage was emptied (the system can clear it), bring the airline back from the phone's copy. */
  restoreIfEmpty() {
    let has = false;
    try { has = !!localStorage.getItem(STORE_KEY); } catch (e) { /* storage unavailable */ }
    const T = this.native();
    if (has || Mode.coop() || !T || !T.backupRead || this.nogame()) return;
    T.backupRead().then((r: any) => {
      if (!r || !r.data) return;
      try { JSON.parse(r.data); localStorage.setItem(STORE_KEY, r.data); location.reload(); } catch (e) { /* broken copy: start fresh */ }
    }).catch(() => { /* no copy */ });
  },

  /** Save shortly after a change, so many quick changes become one write. */
  soon() { clearTimeout(this._timer); this._timer = setTimeout(() => this.save(), 400); },

  backupBroken(raw: string) { try { localStorage.setItem(STORE_KEY + '.broken', raw); } catch (e) { /* ignore */ } },

  reset() { try { localStorage.removeItem(Mode.key()); } catch (e) { /* ignore */ } location.reload(); },

  bind() {
    // after every tap that does something, when leaving the app, and every half minute for flight progress
    document.addEventListener('click', ev => { if ((ev.target as HTMLElement).closest('[data-act]')) this.soon(); }, true);
    // minimised or closed: save everything now and note where the app was, so that when it opens again
    // (after it was swiped away, exited, or closed by Android to free memory) it is right there
    const away = () => { this.save(); this.flushNative(); if ((window as any).__quitting) return; try { localStorage.setItem('amp-resume', JSON.stringify({ at: Date.now(), screen: State.screen })); } catch (e) { /* ignore */ } };
    document.addEventListener('visibilitychange', () => { if (document.hidden) away(); });
    setInterval(() => { if (!document.hidden && !(window as any).__quitting) try { localStorage.setItem('amp-resume', JSON.stringify({ at: Date.now(), screen: State.screen })); } catch (e) { /* ignore */ } }, 15000);
    window.addEventListener('pagehide', away);
    setInterval(() => this.save(), 30000);
  },
};
