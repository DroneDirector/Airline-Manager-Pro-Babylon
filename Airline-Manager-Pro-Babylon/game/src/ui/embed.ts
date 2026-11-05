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
  // your office: on Babylon.js, with the airline's own details on its laptop, monitor, route map and nameplate
  OfficeRoom.open = () => {
    try { saveNow(true); } catch (e) { /* saved */ }
    try {
      const c: any = company(), me: any = myPilot(), routes: number[][][] = [];
      for (const r of (State as any).routes || []) { if (r.companyId !== State.companyId) continue; const legs: string[] = r.legs || []; for (let i = 0; i + 1 < legs.length; i++) { const A = apt(legs[i]), B = apt(legs[i + 1]); if (A && B) routes.push([A.pos, B.pos]); } if (routes.length > 300) break; }
      embedTell('room', { room: 'office', data: { airline: c.name, icao: c.icao, color: c.color, color2: c.color2, hub: c.hub, pilot: me ? me.name : '', balance: money(c.balance, { compact: true }), flying: liveOf().length, fleet: fleetOf().length, routes,
        reports: (((State as any).incidents || []) as any[]).filter(x => x && x.status !== 'closed').length } });
    } catch (e) { embedTell('room', { room: 'office', data: {} }); }
  };
  // the lounges: the Business lounge on Babylon.js (its doors lead back here)
  LoungeRoom.open = () => { try { saveNow(true); } catch (e) { /* saved */ } embedTell('room', { room: 'lounge', data: {} }); };
  ACTIONS['lounge-visit'] = () => LoungeRoom.open();
  const rooms: [any, string][] = [[OpsRoom, 'The Operations office'], [HangarRoom, 'The hangar'], [CourtRoom, 'The courtroom'],
    [Museum, 'The museum'], [Salute, 'The water salute'], [TestRooms, 'The test rooms']];
  for (const [R, name] of rooms) if (R) R.open = soon(name);
  for (const a of ['photo-mode', 'hangar-visit']) if (typeof (ACTIONS as any)[a] === 'function') (ACTIONS as any)[a] = soon('This 3D place');
  // the 3D view of a flight: the edition's 3D viewer follows it, live. This page keeps running behind it (the airline,
  // its schedules and the other airlines' flights go on) and sends where the flight is, several times a second.
  W.v3dOpen = (id: string) => {
    try { saveNow(true); } catch (e) { /* saved */ }
    const m: any = (typeof _curMap === 'function') ? _curMap() : null;
    const fid = id || (m && (m.following || m.selected)) || (liveOf().filter(f => f.you)[0] || liveOf()[0] || {} as any).id || '';
    if (!fid || String(fid).indexOf('apt:') === 0) { embedTell('viewer3d', { id: '' }); return; }
    embedTell('viewer3d', { id: fid });
  };
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
  window.addEventListener('message', (e: MessageEvent) => {
    const d: any = e.data; if (!d || !d.ampb) return;
    if (d.ampb === 'save') { try { saveNow(true); } catch (err) { /* saved */ } embedTell('saved'); }
    else if (d.ampb === 'go' && d.screen) { try { closeAll(); go(d.screen); } catch (err) { /* stays */ } }
    else if (d.ampb === 'follow') { follow = d.id || ''; clearInterval(timer); if (follow) { send(); timer = setInterval(send, 250); } }
    else if (d.ampb === 'stop') { follow = ''; clearInterval(timer); }
    else if (d.ampb === 'airport' && d.icao) {
      // an airport's layout for the 3D viewer: what is known now, and again if a better one arrives
      const A: any = apt(d.icao), elev = A && A.elev ? A.elev * 0.3048 : 0;
      const out = (L: any) => { if (L) embedTell('airport', { icao: d.icao, L: Object.assign({}, L, { alt: L.alt || elev }) }); };
      try { AirportLayouts.get(d.icao, out).then(out).catch(() => embedTell('airport', { icao: d.icao, L: null })); } catch (e) { embedTell('airport', { icao: d.icao, L: null }); }
    }
  });
}
