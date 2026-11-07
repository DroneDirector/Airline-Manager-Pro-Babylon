// Inside the Babylon.js edition: the airline game's whole interface (the Overview, the crew, the fleet, every menu and
// screen), opened from the edition's title screen with New game, Continue game, Load game, Save game or UI. The edition
// has the title screen and the 3D places; this page has the rest.
//  - No start-up logo and no title film of its own: it opens straight at what was chosen.
//  - New game, Load game and Save game show their panels on their own; closing one goes back to the title screen.
//  - Back to the title screen (the logo in the menu) and Quit go to the edition (which closes the game completely).
//  - The 3D places (your office, the Operations room, the hangars, the lounges, the court, the museum and the rest)
//    are being rebuilt on Babylon.js: until each is ready, it says so. The 3D view of a flight opens the edition's
//    3D viewer.
const EMBED: string = (() => { try { return new URLSearchParams(location.search).get('embed') || ''; } catch (e) { return ''; } })();
function embedTell(what: string, extra?: any) { try { parent.postMessage(Object.assign({ amp: what }, extra || {}), '*'); } catch (e) { /* alone */ } }

if (EMBED) {
  const W: any = window;
  document.documentElement.classList.add('in-babylon');
  // the start-up logo screen: straight on
  W.showSplash = (then?: () => void) => { setTimeout(() => { try { if (then) then(); } catch (e) { console.error(e); } }, 0); };
  W.splashShowing = () => false;
  // no title music here: the edition's title screen has the film and the music
  W.titleMusic = () => { /* the edition plays it */ };
  W.whatsNewOnStart = () => { /* the edition shows what's new */ };
  const ownTitleOpen = W.titleOpen;
  /** The title screen's panels on their own (New game, Load game, Save game), without its film and menu. */
  const panelOnly = (act: string) => {
    ownTitleOpen(); document.documentElement.classList.add('ts-panel-only');
    setTimeout(() => { try { ACTIONS['ts-' + act](document.createElement('b'), null as any); } catch (e) { console.error(e); } }, 60);
  };
  W.titleOpen = () => { try { saveNow(true); } catch (e) { /* saved already */ } embedTell('title'); };
  W.titleAfterSplash = () => {
    // after a load or a new game the page starts again: into the game
    let next = ''; try { next = sessionStorage.getItem('amp-title-next') || ''; sessionStorage.removeItem('amp-title-next'); } catch (e) { /* none */ }
    // the same opening only once (a reload of this page, after a load, goes into the game)
    let nonce = ''; try { nonce = new URLSearchParams(location.search).get('n') || ''; } catch (e) { /* none */ }
    let done = ''; try { done = sessionStorage.getItem('ampb-embed-done') || ''; sessionStorage.setItem('ampb-embed-done', nonce); } catch (e) { /* none */ }
    if (next || (nonce && done === nonce)) { go('ops', true); return; }
    if (EMBED === 'continue') { try { enterSplash(); } catch (e) { /* straight in */ } go('ops', true); return; }
    if (EMBED === 'new' || EMBED === 'load' || EMBED === 'save') { panelOnly(EMBED); return; }
    go('ops', true);
  };
  // closing a panel shown on its own: back to the title screen
  const ownClose = ACTIONS['ts-panel-close'];
  ACTIONS['ts-panel-close'] = (el: HTMLElement, ev: Event) => {
    if (document.documentElement.classList.contains('ts-panel-only')) { embedTell('title'); return; }
    return ownClose(el, ev);
  };
  ACTIONS.exit = () => leaveAsk('quit', () => { try { saveNow(true); } catch (e) { /* saved already */ } embedTell('exit'); });
  ACTIONS['title-open'] = () => leaveAsk('title', () => { closeAll(); try { saveNow(true); } catch (e) { /* saved already */ } embedTell('title'); });
  // the 3D places: coming on Babylon.js
  const soon = (name: string) => () => { try { Sound.tick(); } catch (e) { /* muted */ } toast(`${name}: coming to the Babylon.js edition`, 'info'); return false; };
  // the joined building on Babylon.js: your office and the Operations office off the staff corridor, the concourse and
  // the Business lounge. My office, Operations, Lounges and Airport (in the menu) each bring you in where they say.
  const officeData = (): any => {
    try {
      const c: any = company(), me: any = myPilot(), routes: number[][][] = [];
      for (const r of (State as any).routes || []) { if (r.companyId !== State.companyId) continue; const legs: string[] = r.legs || []; for (let i = 0; i + 1 < legs.length; i++) { const A = apt(legs[i]), B = apt(legs[i + 1]); if (A && B) routes.push([A.pos, B.pos]); } if (routes.length > 300) break; }
      return { airline: c.name, icao: c.icao, color: c.color, color2: c.color2, hub: c.hub, pilot: me ? me.name : '', balance: money(c.balance, { compact: true }), flying: liveOf().length, fleet: fleetOf().length, routes,
        reports: (((State as any).incidents || []) as any[]).filter(x => x && x.status !== 'closed').length, pet: (() => { try { return petData(); } catch (e) { return null; } })() };
    } catch (e) { return {}; }
  };
  // what stands in the museum: every gift and award received, and the best badges (as on the main game's museum)
  const museumData = (): any[] => {
    const out: any[] = [];
    try { for (const ex of (giftsAll() as any[]).slice(0, 40)) { const A: any = apt(ex.icao) || { name: ex.icao }; for (const it of ex.received || []) out.push({ title: it.name, sub: ex.cat === 'career' ? 'Awarded ' + dateStr(new Date(ex.at)).slice(0, 10) : 'From ' + A.name, kind: it.kind || 'frame', color: it.color, lines: it.lines }); } } catch (e) { /* none */ }
    try { const earned = ((State as any).badges || {}) as any; for (const b of badgeDefs().filter(b => earned[b.id]).sort((a, b) => b.tier - a.tier || earned[b.id] - earned[a.id]).slice(0, 12)) out.push({ title: b.title, sub: TIER_NAMES[b.tier] + ' badge', kind: 'badge', tier: b.tier }); } catch (e) { /* none */ }
    return out.slice(0, 36);
  };
  // who is in the Training room now, the instructor and his lessons (as on the main game's Academy)
  const trainingData = (): any => {
    const out: any = { teacher: TRN_TEACHER, lessons: TRN_LESSONS, students: [] };
    try { for (const p of inTrainingNow().slice(0, 12)) { const C: any = p.course ? CrewTraining.course(p.course.id) : null, ty: any = p.training ? acType(p.training.typeId) : null;
      out.students.push({ id: String(p.id), name: p.name, role: roleNameOf(p), sex: p.sex || 'm', course: C ? C.name : ty ? `${ty.maker} ${ty.model} type rating` : 'Training', who: C ? C.who : 'pilot', until: p.trainingUntil || (p.course && p.course.until) || Date.now(), from: p.trainingFrom || Date.now() }); } } catch (e) { /* an empty class */ }
    return out;
  };
  const building = (at: string, extra?: any) => { try { saveNow(true); } catch (e) { /* saved */ } embedTell('room', { room: 'building', at, data: Object.assign(officeData(), { museum: museumData(), training: trainingData() }, extra || {}) }); };
  // a gift, a plaque or a badge "in 3D": in your museum, in your hands (the edition's 3D); one given away is not there
  W.viewer3dOpen = (o: any) => { const t = o && o.title; if (!t) return; if (!museumData().some((m: any) => m.title === t)) { toast(`${t} is not in your museum: only what you were given or earned stands there`, 'info'); return; } closeAll(); building('museum', { focus: t }); };
  // the graphics stress test: a walk through the joined building with the frame rate on the screen
  const stress = () => { if (typeof company !== 'function' || !company()) { toast('Start or load a game first: the test walks through your own rooms', 'info'); return; } closeAll(); building('concourse', { stress: true }); };
  ACTIONS['gfx-stress'] = stress; setTimeout(() => { ACTIONS['gfx-stress'] = stress; }, 0);
  const trnVisit = () => { closeAll(); building('training'); }; ACTIONS['ct-visit'] = trnVisit; setTimeout(() => { ACTIONS['ct-visit'] = trnVisit; }, 0);
  OfficeRoom.open = () => building('office');
  OpsRoom.open = () => building('ops');
  LoungeRoom.open = () => building('lounge');
  ACTIONS['office-open'] = () => { closeAll(); building('office'); };
  ACTIONS['ops-room'] = () => { closeAll(); building('ops'); };
  ACTIONS['lounge-visit'] = () => { closeAll(); building('lounge'); };
  // Airport: your own airport at its site, on foot from the kerb outside the main entrance
  ACTIONS['airport-open'] = () => { if (/Android/i.test(navigator.userAgent)) return; closeAll(); embedTell('room', { room: 'site', data: { walk: true, rental: (() => { try { return crBaysOut(); } catch (e) { return null; } })() } }); };
  ACTIONS['mus-open'] = () => { closeAll(); building('museum'); };
  // the water salute, on Babylon.js: the airline's aircraft taxiing under the fire trucks' arch at that airport, now
  W.saluteOpen = (o: any) => {
    try { saveNow(true); } catch (e) { /* saved */ }
    try { const c: any = company(o.cid || State.companyId) || company(), A: any = apt(o.icao) || { name: o.icao, city: '', pos: [0, 60] };
      embedTell('room', { room: 'salute', data: { airline: c ? c.name : '', reg: o.reg, color: c ? c.color : '#1C2A4A', color2: c ? c.color2 : '#3FD3E6', airport: A.name, city: A.city || o.icao, lat: A.pos ? A.pos[1] : 60, lon: A.pos ? A.pos[0] : 0 } }); }
    catch (e) { embedTell('room', { room: 'salute', data: {} }); }
  };
  W.museumOpen = () => building('museum');
  // the Operations monitor: drawn here, shown there
  let monT: any = 0; const monCv = document.createElement('canvas'); monCv.width = 2048; monCv.height = Math.round(2048 * 0.32 / 1.08);
  const monSend = () => { try { opsMonitorDraw({ monCv, monTex: {} }); embedTell('monitor', { url: monCv.toDataURL('image/jpeg', 0.88) }); } catch (e) { /* the next time */ } };
  // the hangars: on Babylon.js, with the aircraft in for work, what is being fixed, how far it is and who is on it
  HangarRoom.open = (reg?: string, base?: string, size?: string) => {
    try { saveNow(true); } catch (e) { /* saved */ }
    try {
      const a: any = reg ? plane(reg) : null, c: any = company(), sh: any = a ? shapeOf(a.typeId) : null, t: any = a ? acType(a.typeId) : null;
      let sz = size || ''; try { if (a) sz = hgSizeFor(a.typeId).name; } catch (e) { /* as given */ }
      embedTell('room', { room: 'hangar', data: { reg: a ? a.reg : '', type: t ? `${t.maker} ${t.model}` : '', L: sh ? sh.L : 0, span: sh ? sh.span : 0, H: sh ? sh.H : 0, color: c.color, color2: c.color2,
        base: a ? hgWhere(a) : base || '', size: sz, fixes: a ? hgFixList(a.reg).map((i: any) => i.title) : [], progress: a ? hgProgress(a.reg) : 0, crew: a ? hgCrewFor(a.reg).map((p: any) => p.name) : [] } });
    } catch (e) { embedTell('room', { room: 'hangar', data: {} }); }
  };
  ACTIONS['hangar-visit'] = (el: HTMLElement) => { const g = (k: string) => el && el.getAttribute ? el.getAttribute(k) || '' : ''; closeAll(); HangarRoom.open(g('data-reg'), g('data-base'), g('data-size')); };
  const rooms: [any, string][] = [[TestRooms, 'The test rooms']];
  courtEmbed(W);
  for (const [R, name] of rooms) if (R) R.open = soon(name);
  for (const a of ['photo-mode']) if (typeof (ACTIONS as any)[a] === 'function') (ACTIONS as any)[a] = soon('This 3D place');
  // the 3D view of a flight: the edition's 3D viewer follows it, live. This page keeps running behind it (the airline,
  // its schedules and the other airlines' flights go on) and sends where the flight is, several times a second.
  W.v3dOpen = (id: string) => {
    try { saveNow(true); } catch (e) { /* saved */ }
    const m: any = (typeof _curMap === 'function') ? _curMap() : null;
    const fid = id || (m && (m.following || m.selected)) || (liveOf().filter(f => f.you)[0] || liveOf()[0] || {} as any).id || '';
    if (!fid) { embedTell('viewer3d', { id: '' }); return; }
    embedTell('viewer3d', { id: fid });
  };
  // a crash site from the map or a notification: the 3D viewer at that airport, looking at the wreck
  ACTIONS['crash-3d'] = (el: any) => { const k = el && el.getAttribute ? el.getAttribute('data-apt') : ''; if (!k) return; closeAll(); embedTell('viewer3d', { crash: k }); };
  setTimeout(() => { ACTIONS['crash-3d'] = (el: any) => { const k = el && el.getAttribute ? el.getAttribute('data-apt') : ''; if (!k) return; closeAll(); embedTell('viewer3d', { crash: k }); }; }, 0);
  W.v3dSupported = () => true;   // the edition's 3D viewer is always there
  ACTIONS['v3d-open'] = () => W.v3dOpen(''); ACTIONS['apt-3d'] = () => W.v3dOpen('');
  let follow = '', timer: any = 0;
  const findFlight = (id: string): any => State.live.filter(x => x.id === id)[0] || (typeof Traffic !== 'undefined' && Traffic.on() ? (Traffic.live() as any[]).filter((x: any) => x.id === id)[0] : null) || null;
  const describe = (f: any) => {
    const w: any = v3dWhere(f), a: any = f.reg ? plane(f.reg) : null, c: any = a ? company(a.companyId) : null, A = apt(f.from), B = apt(f.to);
    return { id: f.id, callsign: f.callsign || f.reg || '', reg: f.reg || '', type: (a && a.typeId) || f.typeId || '', from: f.from, to: f.to, fromName: A ? A.city || A.name : f.from, toName: B ? B.city || B.name : f.to,
      airline: c ? c.name : f.airline || '', color: c ? c.color : f.color || '#1C2A4A', color2: c ? c.color2 : f.color2 || '#3FD3E6', you: !!f.you, mine: !!(a && a.companyId === State.companyId),
      phase: w.phase || f.phase || '', pax: f.pax || 0, paxMax: f.paxMax || 0, gs: f.gs || 0, lat: w.lat, lon: w.lon, altM: w.altM, hdg: w.hdg, vs: w.vs || 0, onGround: !!w.onGround,
      elev: 0 };
  };
  const send = () => {
    if (!follow) return;
    try {
      const f = findFlight(follow); if (!f) { embedTell('flight', { gone: true }); return; }
      const me = describe(f), near: any[] = [];
      const all: any[] = State.live.concat(typeof Traffic !== 'undefined' && Traffic.on() ? (Traffic.live() as any[]) : []);
      for (const o of all) { if (o.id === f.id || near.length >= 16) continue; try { const w: any = v3dWhere(o); const dx = (w.lon - me.lon) * 111320 * Math.cos(me.lat * Math.PI / 180), dz = (w.lat - me.lat) * 110540; if (dx * dx + dz * dz < 40000 * 40000) near.push({ id: o.id, callsign: o.callsign || '', lat: w.lat, lon: w.lon, altM: w.altM, hdg: w.hdg, onGround: !!w.onGround }); } catch (e) { /* not placed */ } }
      const list = liveOf().map(x => ({ id: x.id, callsign: x.callsign, from: x.from, to: x.to }));
      embedTell('flight', { t: Date.now(), me, near, list });
    } catch (e) { /* the next time */ }
  };
  // the pet editor's picture: drawn by the edition (this page has no 3D of its own), shown when it comes back
  let petPrevN = 0;
  W.petPreviewDraw = (P: any) => { const cv = document.querySelector('[data-pet-prev]') as HTMLCanvasElement; if (!cv || !P || P.kind === 'none') return; petPrevN++; embedTell('petprev', { pet: JSON.parse(JSON.stringify(P)), w: cv.width, h: cv.height, id: petPrevN }); };
  // the 3D places' notes on replaced parts (your own models in models/) and any problem with them: into the log
  const partLog = () => { try { const q = JSON.parse(localStorage.getItem('ampb.partlog') || '[]'); localStorage.removeItem('ampb.partlog');
    for (const p of q) ErrorLog.add(p.area || '3d models', p.title, p.message, p.detail || '', p.kind === 'problem'); } catch (err) { /* none */ } };
  partLog();
  window.addEventListener('message', (e: MessageEvent) => {
    const d: any = e.data; if (!d || !d.ampb) return;
    if (d.ampb === 'partlog') { partLog(); return; }
    if (d.ampb === 'fids') { try { const now = Date.now(); let base = String(d.icao || ''); let dep = fidsRows('dep', base, now, 48), arr = fidsRows('arr', base, now, 48);
        if (!dep.length && !arr.length) { const c: any = company(); const home = c && (c.base || c.hub || ''); if (home && home !== base) { base = home; dep = fidsRows('dep', base, now, 48); arr = fidsRows('arr', base, now, 48); } }
        embedTell('fids', { base, dep, arr, at: now }); } catch (err) { embedTell('fids', { base: d.icao, dep: [], arr: [], at: Date.now() }); } return; }
    if (d.ampb === 'petprev' && d.url) { if (d.id !== petPrevN) return; const cv = document.querySelector('[data-pet-prev]') as HTMLCanvasElement; if (!cv) return; const im = new Image(); im.onload = () => { const x = cv.getContext('2d'); if (x) { x.clearRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height); } }; im.src = d.url; return; }
    if (d.ampb === 'wardrobe') { try { closeAll(); osWardrobe(); } catch (err) { /* later */ } return; }
    if (d.ampb === 'pet') { try { const p: any = petData(); if (typeof d.food === 'number') p.food = d.food; if (typeof d.water === 'number') p.water = d.water; Store.soon(); } catch (err) { /* later */ } return; }
    if (d.ampb === 'save') { try { saveNow(true); } catch (err) { /* saved */ } embedTell('saved'); }
    else if (d.ampb === 'monitor') { clearInterval(monT); if (d.on) { monSend(); monT = setInterval(monSend, 5000); } }
    else if (d.ampb === 'go' && d.screen) { try { closeAll(); go(d.screen); } catch (err) { /* stays */ } }
    else if (d.ampb === 'follow') { follow = d.id || ''; clearInterval(timer); if (follow) { send(); timer = setInterval(send, 250); } }
    else if (d.ampb === 'stop') { follow = ''; clearInterval(timer); }
    else if (d.ampb === 'wx' && typeof d.lat === 'number') {
      // the weather where the 3D viewer is: the nearest real airport report (asked for if not yet fetched)
      try {
        const lon = d.lon, lat = d.lat, seen: any = {};
        for (const [dx, dy] of [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.6], [0, -0.6]]) { const k = World.nearest(lon + dx, lat + dy, 120); if (k && !seen[k]) { seen[k] = 1; LiveWx.get(k); } }
        const list = cloudStations(lon, lat, 160), st = cloudNearest(list, lon, lat, 160);
        if (!st) embedTell('wx', { none: true });
        else {
          let icao = ''; for (const k in LiveWx.cache) { const A: any = apt(k); if (A && A.pos[0] === st.pos[0] && A.pos[1] === st.pos[1]) { icao = k; break; } }
          const m: any = icao ? LiveWx.cache[icao] : null, pr = cloudPrecip(st.wx || '');
          const ls = st.layers.filter(l => CLOUD_COV[l.cover]), cover = ls.reduce((a, l) => Math.max(a, CLOUD_COV[l.cover]), 0);
          const low = ls.map(l => +l.base).sort((a, b) => a - b)[0], cb = st.layers.some(l => l.type === 'CB'), tcu = st.layers.some(l => l.type === 'TCU');
          embedTell('wx', { icao, raw: m ? m.raw : '', cover, base: low == null ? 0 : low, elev: st.elev || 0, cb, tcu, precip: pr && !pr.vc ? pr.kind : '', k: pr ? pr.k : 0, ts: !!(pr && pr.ts), vc: !!(pr && pr.vc),
            dir: m ? m.dir : -1, kt: m ? m.kt : 0, gust: m ? m.gust : 0, vis: m ? m.vis : '', temp: st.temp, wx: st.wx || '' });
        }
      } catch (err) { embedTell('wx', { none: true }); }
    }
    else if (d.ampb === 'airport' && d.icao) {
      // an airport's layout for the 3D viewer: what is known now, and again if a better one arrives
      const A: any = apt(d.icao), elev = A && A.elev ? A.elev * 0.3048 : 0;
      const crash = (() => { try { const c: any = crashSiteAt(d.icao); if (!c) return null; const o = JSON.parse(JSON.stringify(c)); try { o.heli = typeof isHeli === 'function' && isHeli(c.typeId); } catch (e) { /* an aeroplane */ } return o; } catch (e) { return null; } })();
      const out = (L: any) => { if (L) embedTell('airport', { icao: d.icao, crash, L: Object.assign({}, L, { alt: L.alt || elev }) }); };
      try { AirportLayouts.get(d.icao, out).then(out).catch(() => embedTell('airport', { icao: d.icao, L: null })); } catch (e) { embedTell('airport', { icao: d.icao, L: null }); }
    }
  });
}

/* ---------- the courtroom on Babylon.js ----------
 * The empty courtroom is the edition's own: you walk about it there. In a hearing, this page keeps running it (every
 * line, your answers, your lawyer's objections, the verdict) and its dialogue box, the exhibits and Leave court stay
 * here, drawn over the edition's hall: the page goes see-through, and tells the edition who is speaking, who stands
 * and who sits, who is in the witness box and what is on the court's screens. The edition draws the hall, the people
 * and the camera on whoever speaks; dragging here looks round there. */
/** The seats, as the edition has them (src/sections/court/seats.ts): every one with its id. */
function courtSeatsData(judges: number): any {
  const A: any = { seats: {} }, dais = 0.75, bw = judges > 3 ? 9.8 : 7.4, fz = -6.6 + 0.85, BAR = 1.6;
  A.seats.judge = []; for (let i = 0; i < judges; i++) A.seats.judge.push({ id: 'judge' + i, x: (i - (judges - 1) / 2) * (bw / judges) * 0.95, y: dais, z: fz - 0.95, yaw: 0, sit: 1 });
  A.seats.clerk = { id: 'clerk', x: 0, y: 0, z: fz + 1.25 - 0.55, yaw: 0, sit: 1 };
  const wr = -0.55; A.seats.witness = { id: 'witness', x: 5.0 - 0.22 * Math.sin(wr), y: 0.3, z: -4.8 - 0.22 * Math.cos(wr), yaw: wr, sit: 1 };
  A.seats.pros = [-4.2, -2.8].map((x, i) => ({ id: 'pros' + i, x, y: 0, z: -1.15 + 0.98, yaw: Math.PI, sit: 1 }));
  A.seats.def = [2.8, 4.2].map((x, i) => ({ id: 'def' + i, x, y: 0, z: -1.15 + 0.98, yaw: Math.PI, sit: 1 }));
  A.seats.fam = { id: 'fam', x: -6.3, y: 0, z: 0.9, yaw: Math.PI, sit: 1 };
  A.police = [{ x: -2.1, z: 10.5 - 0.7, yaw: Math.PI }, { x: 2.1, z: 10.5 - 0.7, yaw: Math.PI }, { x: 6.9, z: -2.4, yaw: -Math.PI / 2 - 0.25 }].map((p, i) => Object.assign(p, { id: 'police' + i, y: 0, sit: 0 }));
  A.seats.pub = [];
  for (let r = 0; r < 7; r++) { const hz = BAR + 1.2 + r * 1.02; for (const s of [-1, 1]) { const xa = s * 1.0, len = 6.3, n = Math.floor(len / 0.62); for (let i = 0; i < n; i++) A.seats.pub.push({ id: 'pub' + A.seats.pub.length, x: xa + s * (0.42 + i * (len - 0.6) / (n - 1)), y: 0, z: hz, yaw: Math.PI, sit: 1, row: r, side: s, i }); } }
  A.screens = { cv: [], tex: [] }; A.root = null; return A;
}
function courtEmbed(W: any) {
  const R = CourtRoom; let snapT: any = 0, last = '', readyThen: (() => void) | null = null, casting = false;
  // the people are data here (the edition draws them): while they come in, a person is just who and where
  const HB = Human.build, hb = Object.getOwnPropertyDescriptor(Human, 'ready');
  try { Object.defineProperty(Human, 'ready', { configurable: true, get: () => casting || !!(hb && hb.get ? hb.get.call(Human) : false) }); } catch (e) { /* as it is */ }
  (Human as any).build = function (...a: any[]) { return casting ? { top: 1.7 } : (HB as any).apply(Human, a); };
  W.ctPlace = (it: any, m: any) => {
    const p = Object.assign(it, { m: m || { top: 1.7 }, pivot: { visible: !it.hidden }, holder: {}, sitK: it.seat.sit, wantSit: it.seat.sit, ph: 0, g: null, gazeYaw: 0 });
    R.people[it.key] = p; if (it.crowd || /^relative|^press/.test(it.key)) R.crowd.push(p);
  };
  W.ctShotOf = (key: string) => { R.shotKey = key || ''; };
  W.ctFrame = () => { /* drawn by the edition */ };
  const ownEx = W.ctExhibit; W.ctExhibit = (ex: any) => { try { ownEx(ex); } catch (e) { /* the box */ } embedTell('court', { ex }); };
  /** Everyone is in: the edition builds the hall with them in it, then the hearing starts. */
  W.ctLoaded = (then?: () => void) => {
    casting = false; if (!R.on) return; readyThen = then || null;
    const people = Object.keys(R.people).map(k => { const p = R.people[k], L = p.look || {}; return { key: k, seat: p.seat.id, sex: p.sex || L.sex || 'm', name: p.name, title: p.title, vis: p.pivot.visible ? 1 : 0, sit: p.wantSit,
      look: { skin: L.skin, hair: L.hair, hairColor: L.hairColor, top: L.top, uniform: L.uniform, glasses: L.glasses } }; });
    const co: any = company(R.c.companyId);
    embedTell('room', { room: 'court', data: { mode: 'hearing', judges: R.judges, courtName: R.courtName, title: R.title, people, color: co.color, color2: co.color2 } });
  };
  const send = () => {
    if (!R.on || !R.people) return;
    const now = (performance.now() - R.t0) / 1000, ps: any = {};
    for (const k in R.people) { const p = R.people[k]; ps[k] = [p.pivot.visible ? 1 : 0, p.wantSit]; }
    let talk = false; const sp = R.speaker ? R.people[R.speaker] : null;
    if (sp) { try { talk = R.talkUntil > now || humanVoiceOn(R.speaker === 'you' ? 'me' : sp.name); } catch (e) { talk = R.talkUntil > now; } }
    const st = { sp: R.speaker || '', shot: R.shotKey == null ? R.speaker || '' : R.shotKey, talk, ps, mourn: !!R.mourn };
    const j = JSON.stringify(st); if (j !== last) { last = j; embedTell('court', { st }); }
  };
  CourtRoom.open = function (c: any, st: any) {
    if (R.on) R.close(true);
    try { saveNow(true); } catch (e) { /* saved */ }
    const empty = !c, co: any = company(c ? c.companyId : State.companyId), hub: any = apt(co.hub), appeal = !!st && st.key === 'hearA', judges = appeal ? 5 : 3;
    const courtName = c ? (appeal ? c.court.replace(/District Court|Crown Court/, 'Court of Appeal') : c.court) : `The District Court in ${hub ? hub.city : 'town'}`;
    if (empty) { embedTell('room', { room: 'court', data: { mode: 'empty', courtName, color: co.color, color2: co.color2 } }); return; }
    R.empty = false; R.keys = {}; R.stick = [0, 0]; R.on = true; R.c = c; R.st = st; R.key = st.key; R.lines = hearingScript(c, st.key); R.i = -1; R.answered = []; R.finished = false; R.objected = false;
    R.judges = judges; R.courtName = courtName; R.title = co.name + ': ' + st.title; R.shotKey = null; R.speaker = null; R.mourn = false; R.look = { yaw: 0, pitch: 0 };
    R.A = courtSeatsData(judges); R.people = {}; R.crowd = []; R.t0 = performance.now(); R.loadT0 = R.t0; last = '';
    const root = document.createElement('div'); root.className = 'court3d over'; root.hidden = true; R.root = root;
    root.innerHTML = `<div class="ct-drag"></div>
      <div class="ct-top"><div><small>${esc(courtName)}</small><b>${esc(R.title)}</b></div></div>
      <button class="ct-leave" data-ct="leave">${icon('close')}<span>Leave court</span><kbd>Esc</kbd></button>
      <div class="ct-ex" hidden></div><div class="ct-rate" hidden></div>
      <div class="ct-box" hidden><div class="box-grip" title="Drag to move the window (double-click to put it back)"><i></i></div><div class="ct-who"><b></b><small></small></div><p class="ct-text"></p><div class="ct-say"></div><div class="ct-opts"></div><div class="ct-ctl"></div></div>
      <div class="ct-modal" hidden></div>`;
    document.body.appendChild(root);
    root.addEventListener('click', ev => { const b = (ev.target as HTMLElement).closest('[data-ct]') as HTMLElement; if (b) ctClick(b); });
    try { roomBoxDrag(root, 'court'); } catch (e) { /* fixed */ }
    // dragging the view looks round in the edition's hall
    const dg = root.querySelector('.ct-drag') as HTMLElement; let drag: any = null;
    dg.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; dg.setPointerCapture(e.pointerId); embedTell('court', { look: 'down' }); });
    dg.addEventListener('pointermove', e => { if (!drag) return; embedTell('court', { look: [(e.clientX - drag.x) * 0.004, (e.clientY - drag.y) * 0.003] }); drag = { x: e.clientX, y: e.clientY }; });
    const up = () => { if (drag) embedTell('court', { look: 'up' }); drag = null; }; dg.addEventListener('pointerup', up); dg.addEventListener('pointercancel', up);
    R.key$ = (e: KeyboardEvent) => {
      if (!R.on) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); const m = root.querySelector('.ct-modal') as HTMLElement; if (!m.hidden) { m.hidden = true; return; } ctLeaveAsk(); }
      else if ((e.key === 'Enter' || e.key === ' ') && (root.querySelector('.ct-modal') as HTMLElement).hidden) { const n = root.querySelector('.ct-ctl .btn.primary') as HTMLElement; if (n) { e.preventDefault(); n.click(); } }
    };
    window.addEventListener('keydown', R.key$, true);
    casting = true; ctCast(c, st, judges, 1);
  };
  CourtRoom.close = function (quiet?: boolean) {
    if (!R.on) return; R.on = false; casting = false; clearInterval(snapT); readyThen = null;
    window.removeEventListener('keydown', R.key$, true);
    try { Voice.stop(); } catch (e) { /* quiet */ }
    if (R.root) R.root.remove(); R.people = {}; R.crowd = [];
    document.documentElement.classList.remove('court-over');
    embedTell('court', { end: true });
    if (!quiet) { try { refresh(); if (R.c) courtPopup(R.c.id); } catch (e) { /* ignore */ } }
  };
  // the edition's hall is up: in we go
  window.addEventListener('message', (e: MessageEvent) => {
    const d: any = e.data; if (!d || d.ampb !== 'court' || !R.on) return;
    if (d.ready) {
      document.documentElement.classList.add('court-over'); R.root.hidden = false; try { (document.activeElement as any)?.blur?.(); window.focus(); } catch (x) { /* focus later */ }
      clearInterval(snapT); snapT = setInterval(send, 120); send();
      const t = readyThen; readyThen = null; if (t) setTimeout(t, 500);
    } else if (d.leave) ctLeaveAsk();
  });
}
