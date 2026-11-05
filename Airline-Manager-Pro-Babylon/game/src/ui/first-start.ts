// The very first start: after the start-up screen, look around the demo airline or start from nothing.

function firstStartWelcome(withRestore: boolean) {
  if (splashShowing()) { setTimeout(() => firstStartWelcome(withRestore), 1000); return; }
  if (titleShowing()) return;   // the start screen offers New game and the demo itself
  openLayer('modal', `<div class="modal-head"><div><h2>Welcome to ${esc(APP.name)}</h2><small>How would you like to start?</small></div></div>
    <div class="fs-choice">
      <button class="fs-card" data-act="fs-demo"><span class="fs-ic">${icon('play')}</span><b>Explore the demo airlines</b><small>Three airlines with aircraft, routes, crew and flights already running. Look around, try everything, and start your own company any time.</small></button>
      <button class="fs-card" data-act="fs-scratch"><span class="fs-ic">${icon('plus')}</span><b>Start from scratch</b><small>Everything wiped: no aircraft, staff, routes or history. You found your own airline, with starting money, and build it up yourself.</small></button>
    </div>
    ${withRestore ? `<div class="btn-row fs-restore"><small>Used the app before?</small><button class="btn ghost sm" data-act="backup-folder-restore">${icon('download')}Choose my backup folder</button><button class="btn ghost sm" data-act="backup-import">${icon('download')}Open a backup file</button></div>` : ''}`, { cls: 'fs-modal' });
}
ACTIONS['fs-demo'] = () => { Sound.tick(); closeAll(); toast('Enjoy the demo. Settings → Backup and restore lets you start from scratch later.', 'ok'); };
let _fsKind = 'major', _fsHub = '';
ACTIONS['fs-scratch'] = () => {
  Sound.tick(); closeAll();
  const kinds = [['major', 'Airline', 'Jets and turboprops on scheduled routes.', 'a320neo', 'EKVG'], ['regional', 'Regional and cargo', 'Smaller jets and turboprops, short hops.', 'atr72', 'EKVG'], ['bush', 'Bush outfit', 'Floatplanes and STOL aircraft.', 'dhc2', 'PALH']];
  openLayer('modal', `<div class="modal-head"><div><h2>Your new airline</h2><small>Everything else is wiped. You can change all of this later.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="choice-grid fs-kinds">${kinds.map(k => `<button class="choice ${_fsKind === k[0] ? 'on' : ''}" data-act="fs-kind" data-k="${k[0]}" data-hub="${k[4]}"><div class="choice-art">${aircraftArt(k[3], { color: '#3FD0E8', color2: '#0D3A4A', ground: false })}</div><b>${k[1]}</b><small>${k[2]}</small></button>`).join('')}</div>
    <div class="fs-fields">
      <label class="field"><span>Airline name</span><input class="le-in fs-name" maxlength="40" placeholder="Northern Lights Air"></label>
      <label class="field"><span>ICAO code (3 letters)</span><input class="le-in fs-icao" maxlength="3" placeholder="NLA"></label>
      <label class="field"><span>Callsign</span><input class="le-in fs-call" maxlength="16" placeholder="NORTHERN"></label>
      <div class="field"><span>Home base (required)</span><button class="btn ghost fs-hub-btn ${_fsHub ? '' : 'need'}" data-act="fs-hub">${icon('pin')}${_fsHub && apt(_fsHub) ? `${esc(_fsHub)} · ${esc(apt(_fsHub).name)}` : 'Choose your home base'}</button></div>
      <label class="field"><span>Your pilot name</span><input class="le-in fs-pilot" maxlength="40" value="${esc(myPilot().name)}"></label>
    </div>
    <div class="field fs-diff"><span>Difficulty</span>${difficultyPickHtml(_fsDiff, 'fs-diff')}</div>
    <p class="fine-print">${icon('alert')}This removes the demo airlines, aircraft, staff, routes, flights, money and logs. Your settings are kept.</p>
    <div class="modal-actions"><button class="btn ghost" data-act="fs-back">Back</button><button class="btn danger" data-act="fs-wipe">${icon('trash')}Wipe and start</button></div>`, { cls: 'wide fs-modal' });
};
ACTIONS['fs-back'] = () => { closeAll(); firstStartWelcome(false); };
ACTIONS['fs-kind'] = el => {
  _fsKind = el.getAttribute('data-k');
  document.querySelectorAll('.fs-kinds .choice').forEach(b => b.classList.toggle('on', b === el));
  Sound.tick();
};
ACTIONS['fs-hub'] = () => {
  openBasePicker('Your home base', 'The airport your airline is based at. Your aircraft are delivered here and your hub crew work here.', icao => {
    _fsHub = icao; const b = $('.fs-hub-btn'); if (b) { b.classList.remove('need'); b.innerHTML = `${icon('pin')}${esc(icao)} · ${esc(apt(icao) ? apt(icao).name : icao)}`; }
  });
};
ACTIONS['fs-wipe'] = () => {
  const v = (q: string) => { const e = $(q) as HTMLInputElement; return e ? e.value.trim() : ''; };
  const name = v('.fs-name') || (_fsKind === 'bush' ? 'Tundra Wings' : _fsKind === 'regional' ? 'Fjord Regional' : 'Northern Lights Air');
  const icao = (v('.fs-icao') || name.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase().padEnd(3, 'X').slice(0, 3);
  const hub = _fsHub;
  if (!hub || !apt(hub)) { toast('Choose your home base first', 'warn'); const b = $('.fs-hub-btn'); if (b) { b.classList.add('need', 'shake'); setTimeout(() => b.classList.remove('shake'), 600); } return; }
  wipeToScratch({ kind: _fsKind, name, icao, callsign: (v('.fs-call') || name.split(' ')[0]).toUpperCase(), hub, pilot: v('.fs-pilot') });
};

/** A new game: everything is erased and begins from nothing (companies, pilots, aircraft, staff, routes, flights,
 *  money, loans, logbook, news, markets, history, your pet) except your settings and the app's registration, and one
 *  new airline is founded with your pilot (as created on the start screen, or the one you had). */
function wipeToScratch(o: { kind: string; name: string; icao: string; callsign: string; hub: string; pilot: string }) {
  if (Mode.coop()) { try { localStorage.setItem('amp-coop-new', '1'); } catch (e) { /* ignore */ } }
  try { localStorage.setItem('amp-news-first', Mode.coop() ? 'coop' : 'first'); } catch (e) { /* ignore */ }
  const S: any = State, old: any = State.pilots.filter((p: any) => p.id === 'you')[0] || myPilot() || {}, np: any = (window as any).__ngPilot;
  // kept: your settings, the registration, and things about this device and the world (airports, the simulator)
  const KEEP = ['settings', 'licence', 'knownAirports', 'simInstalled', 'linkPc', 'linkedOnce', 'seenVersion', 'wnClosed', 'simDate', 'ratingDay', 'mktReal', 'candidates', 'staffCandidates', 'salaryV2', 'payV3', 'groundV1', 'newsWatchV1'];
  const st: any = {};
  for (const k of SAVED_KEYS) {
    const v = S[k];
    if (KEEP.indexOf(k) >= 0) { st[k] = v; continue; }
    st[k] = Array.isArray(v) ? [] : typeof v === 'number' ? 0 : typeof v === 'boolean' ? false : typeof v === 'string' ? '' : v && typeof v === 'object' ? {} : null;
  }
  const id = 'co-' + uid();
  st.companies = [{ id, profileId: 'p1', name: o.name, icao: o.icao, callsign: o.callsign, hub: o.hub, color: '#2C8CFF', color2: '#0B2A55',
    balance: Math.round((o.kind === 'bush' ? 1500000 : o.kind === 'regional' ? 12000000 : 25000000) * DIFFICULTY[_fsDiff].start / 100000) * 100000, reputation: 50, founded: dateStr(new Date()).slice(0, 10), kind: o.kind, divisions: [] }];
  st.profiles = [{ id: 'p1', pilotId: 'you', label: 'Main profile' }];
  st.freeCrew = { [id]: 'offered' };   // the first crew for free (crew-start.ts)
  st.poolFill = true;   // the hiring list is filled to POOL_MIN of every kind as the new career opens (staffing.ts)
  const look = (np && np.look) || old.look;
  st.pilots = [{ id: 'you', name: (np && np.name) || o.pilot || old.name || 'Capt. New Pilot', rank: 'Captain', hoursMin: 0, landings: 0, base: o.hub, you: true, profileId: 'p1', status: 'standby', types: [], rating: 4, xp: 0,
    sex: (np && np.sex) || old.sex || 'm', look, dob: (np && np.dob) || old.dob, nat: (np && np.nat) || old.nat, lookAccepted: true, voice: old.voice }];
  st.companyId = id; st.divisionId = 'all'; st.myReg = {}; st.coPilot = { [id]: { sex: 'f', id: '' } }; st.screen = 'ops';
  st.myLoad = Object.assign({}, S.myLoad, { pax: 0, cargoKg: 0, mailKg: 0, bagsKg: 0 });
  st.bank = { loans: [], insurance: {}, insNext: {}, campaigns: [], rentNext: {} };
  st.mkt = null; st.coop = null; st.usedMarket = null; st.pet = null; st.stock = {}; st.difficulty = _fsDiff;
  st.salaryV2 = true; st.payV3 = true; st.groundV1 = true;
  st.finHold = true; st.regNext = 0; st.fresh = true;   // the money waits for you to start your career (career-start.ts)
  const json = JSON.stringify({ v: SAVE_VERSION, app: APP.version, savedAt: Date.now(), state: st });
  try { localStorage.removeItem('amp-nogame'); } catch (e) { /* ignore */ }
  // nothing from the old game may be saved over it before the app starts again
  try { (Mode as any).switching = true; clearTimeout((Store as any)._nativeTimer); (Store as any)._native = ''; } catch (e) { /* ignore */ }
  try { localStorage.setItem(Mode.key(), json); } catch (e) { toast('The new game couldn\'t be stored', 'warn'); return; }
  const T = Store.native(); if (T && T.backupWrite && !Mode.coop()) T.backupWrite({ data: json }).catch(() => { /* the web copy is there */ });
  try { sessionStorage.setItem('amp-title-next', 'game'); } catch (e) { /* ignore */ }
  try { localStorage.setItem('amp-resume', JSON.stringify({ at: Date.now(), screen: 'ops' })); localStorage.setItem('amp-tour', '1'); localStorage.removeItem('amp-ui'); } catch (e) { /* ignore */ }
  location.reload();
}

/* ---------- co-op mode: its own world, set up the first time it opens ---------- */
function coopWorldWelcome() {
  openLayer('modal', `<div class="modal-head"><div><h2>Co-op mode</h2><small>A separate airline, flown by real players. Your own airline is kept just as it is.</small></div></div>
    <div class="fs-choice">
      <button class="fs-card" data-act="cw-new"><span class="fs-ic">${icon('coop')}</span><b>Found a co-op airline</b><small>You are its owner: you buy, sell and lease the aircraft, hire the crew and invite pilots with a code.</small></button>
      <button class="fs-card" data-act="cw-join"><span class="fs-ic">${icon('user')}</span><b>Join with a code</b><small>Fly for another player's co-op airline.</small></button>
    </div>
    <div class="btn-row fs-restore"><small>Not now?</small><button class="btn ghost sm" data-act="mode-solo">${icon('swap')}Back to my own airline</button></div>`, { cls: 'fs-modal' });
}
ACTIONS['cw-new'] = () => {
  ACTIONS['fs-scratch'](null as any, null as any);
  const h = $('.fs-modal h2'), s = $('.fs-modal .modal-head small'), w = $('.fs-modal .fine-print'), b = $('.fs-modal [data-act=fs-wipe]'), bk = $('.fs-modal [data-act=fs-back]');
  if (h) h.textContent = 'Your co-op airline'; if (s) s.textContent = 'You are the owner. You can change all of this later.';
  if (w) w.innerHTML = `${icon('info')}Only the co-op world starts empty. Your own airline, its aircraft, staff and money stay as they are.`;
  if (b) { b.classList.remove('danger'); b.classList.add('primary'); b.innerHTML = `${icon('coop')}Found the airline`; }
  if (bk) bk.setAttribute('data-act', 'cw-back');
};
ACTIONS['cw-back'] = () => { closeAll(); coopWorldWelcome(); };
ACTIONS['cw-join'] = () => toast('Joining from other devices opens when the online service is connected. Found your own co-op airline to try it now.', 'info');
ACTIONS['mode-solo'] = () => { Sound.tick(); Mode.set(false); };
ACTIONS['mode-coop'] = () => { Sound.tick(); Mode.set(true); };
/** On start: the co-op world just founded becomes a co-op; your own world never runs co-op. */
function modeStart() {
  const S: any = State;
  document.body.classList.toggle('coop-mode', Mode.coop());
  if (Mode.coop()) {
    let fresh = false; try { fresh = localStorage.getItem('amp-coop-new') === '1'; localStorage.removeItem('amp-coop-new'); } catch (e) { /* ignore */ }
    if ((fresh || !coopState()) && !Store.wasEmpty) { coopStart(); try { coopBackend().tick(Date.now()); } catch (e) { /* ignore */ } }
  } else if (S.coop) {
    // a co-op started inside your own airline in an earlier version: co-op has its own world now
    coopLeave();
    State.notices.unshift({ id: uid(), kind: 'company' as any, title: 'Co-op has its own mode now', body: 'Co-op is now a separate world with its own airline, aircraft, crew, money and logs, flown by real players. Open Co-op and switch to co-op mode. Your own airline stays as it is.', time: 'Now', at: Date.now(), read: false } as any);
  }
}
