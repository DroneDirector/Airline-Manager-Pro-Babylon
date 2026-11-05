// Feeds live data from Flight Simulator into the app: your flight on the map and flight card,
// weights and fuel, aircraft match, and at the end of each leg the flight log, hours, landings,
// money and any damage the mechanic needs to look at.

const ACTIVE_PHASES = ['taxi-out', 'takeoff', 'climb', 'cruise', 'descent', 'approach', 'landed', 'taxi-in'];
const PHASE_NAMES: { [k: string]: string } = { 'taxi-out': 'Taxi', takeoff: 'Take-off', climb: 'Climb', cruise: 'Cruise', descent: 'Descent', approach: 'Approach', landed: 'Landed', 'taxi-in': 'Taxi in', parked: 'At the gate' };
const LEG_ISSUES: string[] = [];          // issues raised during the current leg
let _legNotes: string[] = [];
let _lastLive = false;

/** Guess which aircraft type in the app matches the aircraft loaded in the sim. */
function guessType(title: string, model: string): string {
  const s = (title + ' ' + model).toLowerCase();
  const rules: [RegExp, string][] = [
    [/a320 ?neo|a20n|a320-251n/, 'a320neo'], [/a32[01]|fenix/, 'a320-fenix'], [/a350|a359/, 'a350-ini'], [/a310/, 'a310-ini'],
    [/737-?8|b738|737 max/, 'b738-pmdg'], [/737-?6|b736/, 'b736-pmdg'], [/777-?3|b77w|777-?300/, 'b77w-pmdg'], [/787-?10|b78x|787/, 'b78x'], [/747-?8|b748|747/, 'b748'],
    [/crj ?-?9|crj900/, 'crj9-aero'], [/crj ?-?7|crj700|crj/, 'crj7-aero'], [/atr ?72|at76/, 'atr72'], [/twin otter|dhc-?6/, 'dhc6-aero'], [/beaver|dhc-?2/, 'dhc2'],
    [/caravan|c208|208b/, 'c208'], [/kodiak/, 'kodiak'], [/pc-?12/, 'pc12'], [/172|skyhawk/, 'c172'],
  ];
  for (const r of rules) if (r[0].test(s)) return r[1];
  return '';
}

function registerAirport(icao: string, lon: number, lat: number) {
  if (!icao || AIRPORTS[icao]) return;
  AIRPORTS[icao] = { icao, name: icao, city: icao, country: '', pos: [lon, lat] };
  const S: any = State;
  S.knownAirports = S.knownAirports || {};
  S.knownAirports[icao] = [lon, lat];
}
function loadKnownAirports() {
  const k = (State as any).knownAirports || {};
  for (const icao of Object.keys(k)) if (!AIRPORTS[icao]) AIRPORTS[icao] = { icao, name: icao, city: icao, country: '', pos: k[icao] };
}
/** Keep an airport from the world list with the airline's saved airports, so routes always find it. */
function registerWorldAirport(icao: string) { if (AIRPORTS[icao]) return; const a = World.get(icao); if (a) { registerAirport(icao, a.pos[0], a.pos[1]); AIRPORTS[icao] = { icao, name: a.name, city: a.city, country: a.country, pos: a.pos }; if ((a as any).size === 4) Object.assign(AIRPORTS[icao], { size: 4, hk: (a as any).hk }); } }
function nearestKnownAirport(lon: number, lat: number, maxNm: number): string { return World.nearest(lon, lat, maxNm); }

function onAirports(list: { icao: string; lat: number; lon: number }[]) {
  for (const a of list || []) registerAirport(a.icao, a.lon, a.lat);
  try { World.addSim(list); } catch (e) { /* ignore */ }
  Store.soon();
}

/** Every airport the simulator has (in parts): added to the airport list, so the app has the same airports. */
function onSimAirportList(m: { list: [string, number, number][]; part: number; parts: number; total: number }) {
  World.addSim(m.list.map(r => ({ icao: r[0], lat: r[1], lon: r[2] })));
  if (m.part + 1 >= m.parts) { (State as any).simAirportCount = m.total; Store.soon(); toast(`${num(m.total)} airports from the simulator are available`, 'ok'); }
}
/** Send a message to the PC app (when linked). */
function linkSend(m: any): boolean {
  const ws: any = (Link as any).ws;
  if (!ws || Link.status !== 'connected' || ws.readyState !== 1) return false;
  ws.send(JSON.stringify(m)); return true;
}

function onLinked() {
  // from now on your own flights come from the simulator, not the demo
  State.live = State.live.filter(f => !(f.you && !f.real));
  const mine = plane((State as any).myReg[State.companyId]);
  if (mine && mine.status === 'flying' && !State.live.some(f => f.reg === mine.reg)) mine.status = 'parked';
  Sound.chime(); toast(`Linked to ${Link.pc.name}`, 'ok');
  // the simulator's own airports, once per link (MSFS 2024)
  setTimeout(() => linkSend({ type: 'all-airports' }), 3000);
  // the aircraft installed in the simulator (default and add-ons), for the market
  setTimeout(() => linkSend({ type: 'aircraft-list' }), 1500);
  refresh();
}

/** The planned destination for a leg from `from`: today's legs, then your routes, then the sim's approach. */
function plannedTo(from: string, approach: string): string {
  const leg = State.today.filter(l => l.from === from && l.status !== 'done')[0];
  if (leg) return leg.to;
  const a = plane((State as any).myReg[State.companyId]);
  for (const r of State.routes) {
    if (r.companyId !== State.companyId || (a && r.typeId !== a.typeId)) continue;
    const i = r.legs.indexOf(from);
    if (i >= 0 && i < r.legs.length - 1) return r.legs[i + 1];
  }
  if (approach && AIRPORTS[approach]) return approach;
  return '';
}

/** Fuel needed for a leg, from the aircraft's class (kg per hour) plus 45 minutes reserve. */
const BURN_KG_H: { [cls: string]: number } = { ga: 30, bush: 120, turboprop: 650, regional: 1300, airliner: 2500, widebody: 6500 };

function onSimState(s: SimSnapshot) {
  Link.sim = s;
  try { MyRec.onState(s); } catch (e) { /* never stop the feed */ }
  try { paxOnState(s); } catch (e) { /* never stop the feed */ }
  try { if (s && s.connected) gsxOnState(s, nearestKnownAirport(s.lon, s.lat, 8) || s.from || ((State.live.filter(f => f.id === 'me')[0] || {} as any).from) || ''); } catch (e) { /* never stop the feed */ }
  const b: any = State.bridge, S: any = State;
  if (!s || !s.connected) {
    b.sim = s ? 'Flight Simulator not running' : b.sim;
    if (removeMyLiveFlight()) refresh();
    if (s) { b.simRunning = false; renderTopbar(); }
    return;
  }
  b.sim = s.sim; b.simRunning = true; b.gsx = s.gsx.running;
  try { myPhaseNews(s.phase, s.approachAirport || ''); } catch (e) { /* never stop the feed */ }
  if (s.title) S.simAircraft = { title: s.title, typeId: guessType(s.title, s.atcModel), reg: s.atcId };
  const myReg = S.myReg[State.companyId], a = plane(myReg);
  // weights and fuel
  if (s.inFlight && s.totalKg > 0) {
    const L = S.myLoad;
    const byName = (re: RegExp) => s.stations.filter(x => re.test(x.name)).reduce((t, x) => t + x.kg, 0);
    const paxKg = byName(/pax|passenger|seat|row|cabin|business|economy|first|zone/i) - byName(/pilot|crew/i);
    L.source = s.gsx.running ? 'gsx' : 'sim';
    L.emptyKg = Math.round(s.emptyKg); L.fuelKg = Math.round(s.fuelKg); L.mtowKg = Math.round(s.mtowKg) || L.mtowKg;
    L.pax = s.gsx.running && s.gsx.paxBoarded ? s.gsx.paxBoarded : Math.max(0, Math.round(paxKg / 84));
    L.paxKg = 84;
    L.bagsKg = Math.round(byName(/bag/i)); L.mailKg = Math.round(byName(/mail/i)); L.cargoKg = Math.round(byName(/cargo|freight|hold/i) - byName(/bag|mail/i));
    const other = s.totalKg - s.emptyKg - s.fuelKg - L.pax * 84 - L.bagsKg - L.cargoKg - L.mailKg;
    if (other > 50 && !s.stations.length) L.cargoKg += Math.round(other);
    const t = a ? acType(a.typeId) : null;
    const from = s.from || nearestKnownAirport(s.lon, s.lat, 6);
    const to = plannedTo(from, s.approachAirport);
    if (t && from && to && AIRPORTS[from] && AIRPORTS[to]) {
      const burn = BURN_KG_H[t.cls] || 2000;
      L.tripFuelKg = Math.round(gcDistanceNm(AIRPORTS[from].pos, AIRPORTS[to].pos) / t.cruiseKt * burn + burn * 0.3);
      L.reserveKg = Math.round(burn * 0.75);
    }
  }
  // your live flight
  const active = s.inFlight && ACTIVE_PHASES.indexOf(s.phase) >= 0 && !!a;
  let changed = false;
  if (active) {
    let f = State.live.filter(x => x.id === 'me')[0];
    if (!f) {
      let from = s.from || nearestKnownAirport(s.lon, s.lat, 8);
      if (!from) { from = 'DEP'; AIRPORTS.DEP = { icao: 'DEP', name: 'Departure', city: 'Departure', country: '', pos: [s.lon, s.lat] }; }
      const c = company();
      f = { id: 'me', reg: a.reg, pilotId: myPilot().id, from, to: from, t: 0, rate: 0, callsign: c.icao + (100 + (_hashStr(a.reg) % 800)), pax: 0, paxMax: acType(a.typeId).seats,
        alt: 0, phase: '', you: true, real: true } as LiveFlight;
      State.live.unshift(f);
      a.status = 'flying'; changed = true;
      _legNotes = []; LEG_ISSUES.length = 0;
    }
    if (s.from && f.from !== s.from && AIRPORTS[s.from]) f.from = s.from;
    const to = plannedTo(f.from, s.approachAirport);
    f.to = to || f.from; f.noDest = !to;
    f.pos = [s.lon, s.lat]; f.hdg = s.hdg; f.alt = Math.round(s.altFt); f.gs = s.gs;
    if (s.wx) (f as any).wx = s.wx;   // the sim's own weather; the demo flight has made-up weather instead
    f.phase = PHASE_NAMES[s.phase] || s.phase;
    if ((a as any).noBase) S.myLoad.pax = 0;   // no stand at its base: no passengers on board
    f.pax = S.myLoad.pax; f.paxMax = acType(a.typeId).seats;
    if (!f.noDest) {
      const total = gcDistanceNm(AIRPORTS[f.from].pos, AIRPORTS[f.to].pos), left = gcDistanceNm(f.pos, AIRPORTS[f.to].pos);
      f.t = total > 0 ? clamp(1 - left / total, 0, 1) : 0;
    }
  } else if (removeMyLiveFlight()) changed = true;
  if (changed || active !== _lastLive) { _lastLive = active; refresh(); }
  else updateLiveViews();
}

function _hashStr(s: string): number { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

function removeMyLiveFlight(): boolean {
  const i = State.live.findIndex(f => f.id === 'me');
  if (i < 0) return false;
  const f = State.live[i];
  State.live.splice(i, 1);
  const a = plane(f.reg); if (a && a.status === 'flying') a.status = 'parked';
  return true;
}

/** Update the live parts of the current screen without re-rendering it (no entrance animations). */
function updateLiveViews() {
  const me = State.live.filter(f => f.id === 'me')[0];
  if (me) $all('.flight-card').forEach(el => {
    const cs = el.querySelector('.fc-cs');
    if (cs && cs.textContent === me.callsign) { const tmp = document.createElement('div'); tmp.innerHTML = flightCard(me).trim(); el.replaceWith(tmp.firstElementChild); }
  });
  const w = $('.my-ac'); if (w && State.screen === 'ops' && !(w as any)._t) { (w as any)._t = 1; setTimeout(() => { if (State.screen === 'ops') { const tmp = document.createElement('div'); tmp.innerHTML = myAircraftCard(); const n = tmp.firstElementChild; if (n && w.isConnected) w.replaceWith(n); } }, 3000); }
}

/* ---------- Events at the end of and during a leg ---------- */
const DAMAGE: { [code: string]: { title: string; cost: number[]; days: number[] } } = {
  'tail-strike': { title: 'Tail strike', cost: [180000, 180000, 180000], days: [3, 3, 3] },
  'hard-landing': { title: 'Hard landing', cost: [9000, 48000, 150000], days: [0, 1, 3] },
  'flap-overspeed': { title: 'Flap overspeed', cost: [12500, 12500, 40000], days: [0, 0, 1] },
  'gear-overspeed': { title: 'Gear overspeed', cost: [14000, 14000, 45000], days: [0, 0, 1] },
  'engine-failure': { title: 'Engine failure', cost: [60000, 220000, 650000], days: [1, 2, 5] },
  'overstress': { title: 'Airframe overstress', cost: [90000, 160000, 260000], days: [1, 2, 4] },
  'severe-turbulence': { title: 'Severe turbulence inspection', cost: [62000, 62000, 62000], days: [1, 1, 1] },
};
const CLASS_COST: { [cls: string]: number } = { ga: 0.12, bush: 0.2, turboprop: 0.5, regional: 0.7, airliner: 1, widebody: 1.8 };

function raiseIssue(code: string, severity: 'minor' | 'major' | 'grounding', detail: string): Issue {
  const d = DAMAGE[code]; if (!d) return null;
  const a = plane((State as any).myReg[State.companyId]); if (!a) return null;
  const k = severity === 'minor' ? 0 : severity === 'major' ? 1 : 2;
  const cost = Math.round(d.cost[k] * (CLASS_COST[acType(a.typeId).cls] || 1) / 100) * 100;
  const issue: Issue = { id: uid(), reg: a.reg, title: d.title, detail: issueText(code, severity), source: detail, severity, cost, days: d.days[k], status: 'open', date: dateStr(new Date()).slice(0, 10) };
  State.issues.unshift(issue);
  // the mechanic's words get ready while you fly, so he speaks straight away after landing
  try { Voice.prepare(mechanicLines(issue), 'mechanic'); } catch (e) { /* not ready */ }
  a.condition = Math.max(5, a.condition - (k + 1) * 4);
  LEG_ISSUES.push(issue.id);
  _legNotes.push(d.title);
  State.notices.unshift({ id: uid(), kind: 'mechanic', title: `${a.reg}: ${d.title}`, body: (severity === 'grounding' ? 'Grounded until it\'s repaired. ' : 'The mechanic will look at it after landing. ') + (repairPlanMin(a.reg) ? `Repair time: ${repairTimeText(repairPlanMin(a.reg))}.` : 'Ready to fly once paid.'), time: 'Now', read: false, ref: issue.id });
  return issue;
}
function issueText(code: string, sev: string): string {
  switch (code) {
    case 'tail-strike': return 'Aft fuselage skin abrasion and tail skid compressed. Structural check required before the next flight.';
    case 'hard-landing': return sev === 'minor' ? 'Hard landing inspection of the main gear and attach points.' : 'Main gear, attach fittings and wing structure to be inspected after a hard touchdown.';
    case 'flap-overspeed': return 'Flaps extended above their limit speed. Flap track and actuator inspection due.';
    case 'gear-overspeed': return 'Landing gear extended above its limit speed. Gear doors and actuators to be inspected.';
    case 'engine-failure': return sev === 'grounding' ? 'More than one engine failed. Engines to be inspected and repaired before the next flight.' : 'Engine failure in flight. Borescope inspection and repair needed.';
    case 'overstress': return 'The airframe was loaded beyond its limits. Structural inspection required before the next flight.';
    default: return 'Mandatory severe turbulence inspection of wing attach fittings, engine mounts and cabin interior.';
  }
}

function dateStr(d: Date): string {
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

let _myCallsign: { callsign: string; from: string; to: string; descent: boolean } = null;
/** Top of descent on your own flight: the arrival information to the aircraft's ACARS. */
function myPhaseNews(phase: string, to: string) {
  if (!_myCallsign || _myCallsign.descent || phase !== 'descent') return;
  _myCallsign.descent = true; if (to) _myCallsign.to = to;
  try { Acars.onMyEvent('descent', _myCallsign); } catch (e) { /* ignore */ }
}

function onSimEvent(e: FlightEvent) {
  const S: any = State;
  const a = plane(S.myReg[State.companyId]);
  if (e.airport) registerAirport(e.airport, e.lon, e.lat);
  switch (e.type) {
    case 'blocks-off': {
      _legNotes = []; LEG_ISSUES.length = 0;
      // the schedule follows what you actually fly: the planned leg from here becomes active with the real
      // off-blocks time, and a leg that wasn't planned is added to today's schedule
      const hhmm = dateStr(new Date()).slice(11);
      State.today.forEach(l => { if (l.status === 'active') l.status = 'done'; });
      let leg = State.today.filter(l => l.from === e.airport && (l.status === 'next' || l.status === 'planned'))[0];
      if (!leg && e.airport) {
        leg = { from: e.airport, to: plannedTo(e.airport, '') || '', dep: hhmm, reg: a ? a.reg : '', status: 'active' } as any;
        State.today.push(leg); State.today.sort((x, y) => x.dep < y.dep ? -1 : x.dep > y.dep ? 1 : 0);
      }
      if (leg) { leg.status = 'active'; (leg as any).dep = hhmm; (leg as any).actual = true; }
      { const me = plane(S.myReg[company().id]) as any;
        if (me && me.noBase) { toast(`${me.reg} has no stand at its base: not cleared for take-off and no passengers on board`, 'warn'); State.notices.unshift({ id: uid(), kind: 'mechanic', title: `${me.reg}: take-off refused`, body: `${me.reg} has no stand at ${me.base}. Choose another base for it on its page in Fleet. Flights without a base carry no passengers.`, time: 'Now', read: false } as any); }
        else toast(`Blocks off${e.airport ? ' at ' + e.airport : ''}`, 'info'); }
      // the load sheet to the aircraft's ACARS, and the news to the airline's Discord
      try {
        const cs = company().icao + (100 + (_hashStr(a ? a.reg : '') % 800)), to = leg ? leg.to : '';
        _myCallsign = { callsign: cs, from: e.airport || '', to, descent: false };
        Acars.onMyEvent('blocks-off', _myCallsign);
        Online.discord('mine', `${cs} off blocks at ${e.airport || '—'}`, `${myPilot().name} is departing ${e.airport || ''}${to ? ' for ' + to : ''}${a ? ' in ' + a.reg : ''}.`);
      } catch (er) { /* ignore */ }
      break;
    }
    case 'takeoff': toast(`Airborne${e.airport ? ' from ' + e.airport : ''}`, 'info'); break;
    case 'touchdown':
      S.lastTouchdown = e;
      toast(`Touchdown${e.airport ? ' at ' + e.airport : ''}: ${e.fpm} fpm, ${e.g} g`, e.fpm > 500 ? 'warn' : 'ok');
      break;
    case 'damage': case 'turbulence': {
      const issue = raiseIssue(e.code, e.severity || 'minor', e.detail || '');
      if (e.code === 'severe-turbulence' && (e.g || 0) >= 2.2 && issue) {
        const cab: Issue = Object.assign({}, issue, { id: uid(), title: 'Cabin interior damage', detail: 'Overhead bin latches and galley cart restraints damaged in severe turbulence.', severity: 'minor', cost: Math.round(issue.cost * 0.14 / 100) * 100, days: 0 });
        State.issues.unshift(cab); LEG_ISSUES.push(cab.id);
      }
      renderTopbar(); Sound.chime();
      if (issue) toast(`${issue.title}: the mechanic will report after the flight`, 'warn');
      break;
    }
    case 'crash': {
      if (!a) break;
      const l: LogEntry = { id: uid(), date: dateStr(new Date()), from: (State.live.filter(f => f.id === 'me')[0] || { from: '' } as any).from || '—', to: e.airport || '—', reg: a.reg,
        blockMin: 0, landingFpm: -(e.fpm || 0), g: e.g || 0, pax: S.myLoad.pax || 0, result: 'crash', decision: 'pending', atc: State.settings.atcSource === 'beyondatc' ? 'BeyondATC' : 'Built-in', notes: e.detail };
      State.logbook.unshift(l);
      try { (l as any).score = 0; if (MyRec.pts.length > 2) trackSave(l.id, trackThin(MyRec.pts, trackMarks(MyRec.pts.slice(), MyRec.marks.concat([{ k: 'td', i: MyRec.pts.length - 1 }])), 500)); MyRec.reset(); } catch (er) { /* ignore */ }
      removeMyLiveFlight();
      Store.save(); refresh();
      if (State.settings.crashPrompt) setTimeout(() => crashPopup(l.id), 600);
      else ACTIONS['crash-decide']({ getAttribute: (k: string) => k === 'data-id' ? l.id : 'registered' } as any, null);
      break;
    }
    case 'blocks-on': finishLeg(e); try { paxOnBlocksOn(e.airport || (e.summary && e.summary.to) || ''); } catch (er) { /* ignore */ } break;
  }
  Store.soon();
}

function finishLeg(e: FlightEvent) {
  const S: any = State, sm = e.summary; if (!sm) return;
  const c = company(), a = plane(S.myReg[c.id]); if (!a) return;
  const t = acType(a.typeId), me: any = myPilot();
  const to = sm.to || e.airport || nearestKnownAirport(e.lon, e.lat, 6) || '—';
  const from = sm.from || (State.live.filter(f => f.id === 'me')[0] || { from: '—' } as any).from;
  // flight log, hours, landings
  if ((a as any).noBase) sm.pax = 0;   // flown without a stand at its base: nobody on board
  const hard = sm.landingFpm >= 600 || sm.landingG >= 1.8;
  const grounded = LEG_ISSUES.map(id => State.issues.filter(i => i.id === id)[0]).some(i => i && i.severity === 'grounding');
  let _rcNote = ''; try { _rcNote = recencyMyLeg(a.typeId, sm); } catch (er) { /* ignore */ }
  State.logbook.unshift({ id: uid(), date: dateStr(new Date()), from, to, reg: a.reg, blockMin: sm.blockMin, landingFpm: -sm.landingFpm, g: sm.landingG, pax: sm.pax,
    typeId: a.typeId, result: grounded ? 'incident' : hard ? 'hard' : 'ok', atc: State.settings.atcSource === 'beyondatc' ? 'BeyondATC' : 'Built-in', notes: [_rcNote].concat(_legNotes).filter(Boolean).join(', ') || undefined } as any);
  try { const L0: any = State.logbook[0]; vaAfterMyLeg(L0, sm, a.typeId, S.lastTouchdown ? { lon: S.lastTouchdown.lon, lat: S.lastTouchdown.lat, icao: to } : undefined); const scn = sharedAfterMyLeg(L0, sm.blockMin); if (scn) L0.notes = [L0.notes, scn].filter(Boolean).join(', '); } catch (er) { /* ignore */ }
  me.hoursMin += sm.blockMin; me.landings += 1;
  a.hoursMin += sm.blockMin; a.cycles += 1; a.location = to; a.status = grounded ? 'grounded' : 'parked';
  try { conditionAfterFlight(a, sm.blockMin); } catch (er) { /* ignore */ }
  // money
  // real-world fares, on-board sales and costs (economics.ts), with the fuel actually burned in the sim
  const job = Jobs.forMyLeg(from, to, a.reg);
  const m = legEconomics(a.typeId, from, to, sm.pax, sm.cargoKg, sm.blockMin, sm.fuelUsedKg, gsxTakeLegFlag() && !!(State.settings as any).gsx, { book: true, reg: a.reg, job: job ? jobPayFor(job.id) : undefined });
  try { vaStatLeg({ onTime: true, pax: sm.pax, net: m.net, fpm: sm.landingFpm, score: (State.logbook[0] as any).score }); } catch (er) { /* ignore */ }
  try { if (from !== to) firstVisitCheck(c.id, to, a.reg); } catch (er) { /* ignore */ }
  try { hubOnLand(c.id, from, to, Date.now(), sm.pax, 0, Date.now()); if (curfewAt(to, Date.now())) { const fine = 30000; payTxn(c.id, `Night curfew breach at ${to}`, -fine, 'fees', [[curfewText(to), -fine]]); State.notices.unshift({ id: uid(), kind: 'authority', title: `Curfew breach at ${to}`, body: `You landed during the ${curfewText(to).toLowerCase()}: a fine of ${money(fine)}.`, time: 'Now', at: Date.now(), read: false } as any); } } catch (er) { /* ignore */ }
  const now = new Date(), day = dateStr(now).slice(0, 10), time = dateStr(now).slice(11);
  const flight = c.icao + (100 + (_hashStr(a.reg) % 800));
  const rev = m.revenue, fuel = m.costs, fees = 0;
  const txId = uid();
  State.txns.unshift({ id: txId, companyId: c.id, date: day, time, label: `${flight} ${from} to ${to}`, amount: m.net, kind: m.net >= 0 ? 'revenue' : 'fees', reg: a.reg, flight, route: `${from} → ${to}`, lines: m.lines } as any);
  const before = c.balance;
  c.balance += rev - fuel - fees;
  // today's legs
  State.today.forEach(l => { if (l.status === 'active') { if (l.to !== to) (l as any).planned = l.to; l.to = to; l.status = 'done'; (l as any).arr = time; (l as any).blockMin = sm.blockMin; } });
  const nxt = State.today.filter(l => l.status === 'planned')[0]; if (nxt && !State.today.some(l => l.status === 'next')) nxt.status = 'next';
  State.notices.unshift({ id: uid(), kind: 'flight', title: `Landed at ${to}: ${sm.landingFpm} fpm`, body: `${from} to ${to}, ${hours(sm.blockMin)} block, ${num(sm.distanceNm)} nm, ${sm.pax} passengers. ${money(rev - fuel - fees, { sign: true })}. Tap for the money in and out.`, time: time, read: false, tx: txId } as any);
  removeMyLiveFlight();
  try { Progress.afterMyLeg(sm.landingFpm, grounded ? 'incident' : hard ? 'hard' : 'ok'); } catch (er) { /* ignore */ }
  try { coopAfterMyLeg(from, to, sm.blockMin, m.net, txId); } catch (er) { /* ignore */ }
  try { careerAfterMyLeg(from, to, sm.blockMin, sm.landingFpm, a.typeId); } catch (er) { /* ignore */ }
  try { crewAfterLeg(c.id, { coPilot: true, typeId: a.typeId, from, to, blockMin: sm.blockMin }); } catch (er) { /* ignore */ }
  // a charter you flew, the tours, the weekly challenge, a check ride on a new type, and the news
  try { if (job) Jobs.delivered(job.id, Date.now(), m.net, txId); } catch (er) { /* ignore */ }
  try { Jobs.afterMyLeg(from, to, sm.landingFpm); Jobs.checkWeekly(); } catch (er) { /* ignore */ }
  try { if (!rideAfterLeg(a.typeId, sm.landingFpm, sm.landingG, grounded || LEG_ISSUES.length > 0)) Ratings.myCheckRide(a.typeId, sm.landingFpm, sm.landingG, grounded || LEG_ISSUES.length > 0); } catch (er) { /* ignore */ }
  try { Online.discord('mine', `${flight} landed at ${to}`, `${me.name} flew ${from} → ${to} in ${a.reg}.`, [['Landing', `${Math.abs(sm.landingFpm)} fpm, ${sm.landingG} g`], ['Block', hours(sm.blockMin)], ['Passengers', String(sm.pax)], ['Result', money(m.net, { sign: true })]]); } catch (er) { /* ignore */ }
  _myCallsign = null;
  Store.save(); refresh(); animateBalance(before, c.balance);
  toast(`Flight logged: ${from} to ${to}, ${money(rev - fuel - fees, { sign: true })}`, 'ok');
  // the mechanic gets back to you about anything found on this leg
  const first = LEG_ISSUES[0];
  if (first) setTimeout(() => mechanicPopup(first), 1800);
  LEG_ISSUES.length = 0; _legNotes = [];
}
