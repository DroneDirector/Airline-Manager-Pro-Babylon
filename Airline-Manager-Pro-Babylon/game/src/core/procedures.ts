// Departures and arrivals. Every flight of a hired or co-op pilot follows one path, used by the world map
// and by the airports alike (so an aircraft never jumps between the two):
//   runway in use → departure (SID): straight ahead on runway heading, then a turn onto the route
//   → the route → arrival (STAR): straight in, or via downwind and base, depending on where the flight comes
//   from → approach: ILS (longer paved runways at larger airports) or RNP, intermediate fix at 10 nm, final
//   approach fix at 5.5 nm, down the final to the runway.
// The runway in use follows the wind (the simulator's when linked, otherwise an estimate for the day),
// the same choice the airports make. These are generated to real procedure geometry; published SIDs,
// STARs and approaches from the simulator replace them where available.

interface RunwayEnd { icao: string; name: string; other: string; thr: number[]; end: number[]; hdg: number; lenM: number; ils: boolean }
interface ProcPart { kind: 'sid' | 'route' | 'star' | 'app'; name: string; from: number; to: number }   // distances along the path (nm)
interface FlightPath { pts: number[][]; cum: number[]; len: number; parts: ProcPart[]; dep: RunwayEnd; arr: RunwayEnd; wpD?: { [id: string]: number } }

const NM = 1852;

/** A point `dist` nm from [lon, lat] on true bearing `brg`. */
function geoDest(p: number[], brg: number, dist: number): number[] {
  const d = dist / 3440.065, b = brg * D2R, la1 = p[1] * D2R, lo1 = p[0] * D2R;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [((lo2 / D2R + 540) % 360) - 180, la2 / D2R];
}
function geoBrg(a: number[], b: number[]): number {
  const la1 = a[1] * D2R, la2 = b[1] * D2R, dl = (b[0] - a[0]) * D2R;
  return (Math.atan2(Math.sin(dl) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl)) / D2R + 360) % 360;
}
function angDiff(a: number, b: number): number { return ((b - a + 540) % 360) - 180; }

/** The wind at an airport: the simulator's when it is nearby, otherwise an estimate for the day. */
function airportWind(icao: string, pos: number[]): { dir: number; kt: number; real: boolean } {
  const s: any = Link.sim;
  if (s && s.wx && s.lat && gcDistanceNm([s.lon, s.lat], pos) < 60) return { dir: s.wx.windDir, kt: Math.round(s.wx.windKt), real: true };
  // the real weather report (METAR) for the airport, when live weather is on
  try { const m = typeof LiveWx !== 'undefined' ? LiveWx.get(icao) : null; if (m && m.dir >= 0) return { dir: m.dir, kt: Math.round(m.kt), real: true }; } catch (e) { /* not loaded */ }
  return { dir: _hashStr(icao + new Date().toDateString()) % 360, kt: 6 + (_hashStr(icao) % 12), real: false };
}

const _rwyCache: { [k: string]: RunwayEnd } = {};
const _rwyEnds: { [icao: string]: { day: string; ends: (RunwayEnd & { paved: boolean })[] } } = {};
/** Every runway end at an airport (both directions of each open runway), with whether it has an ILS. */
function runwayEnds(icao: string): (RunwayEnd & { paved: boolean })[] {
  const a: any = apt(icao); if (!a) return [];
  const day = new Date().toISOString().slice(0, 10), c = _rwyEnds[icao];
  if (c && c.day === day) return c.ends;
  const rows: any[] = ((World.runways || {})[icao] || []) as any[], out: (RunwayEnd & { paved: boolean })[] = [];
  for (const r of rows) {
    const [id1, id2, lenFt, , surf, la1, lo1, la2, lo2, hdg1] = r;
    try { if (rows.length > 1 && notamRwyClosed(icao, id1, id2)) continue; } catch (e) { /* no NOTAMs yet */ }
    let e1: number[], e2: number[], h: number;
    if (la1 != null && la2 != null) { e1 = [lo1, la1]; e2 = [lo2, la2]; h = geoBrg(e1, e2); }
    else { h = hdg1 != null ? hdg1 : (parseInt(id1, 10) || 0) * 10; const half = (lenFt || 6000) * 0.3048 / 2 / NM; e1 = geoDest(a.pos, h + 180, half); e2 = geoDest(a.pos, h, half); }
    const lenM = (lenFt || 0) * 0.3048 || gcDistanceNm(e1, e2) * NM;
    const paved = /ASP|CON|BIT|PEM|ASF/i.test(surf || '');
    for (const dir of [0, 1]) {
      const name = String(dir ? id2 : id1 || ''); if (!name) continue;
      const ils = paved && lenM >= 1800 && (a.size === 2 || (a.size === 1 && lenM >= 2200) || !!AIRPORTS[icao]) && !(() => { try { return notamIlsOut(icao, name); } catch (e) { return false; } })();
      out.push({ icao, name, other: String(dir ? id1 : id2 || ''), thr: dir ? e2 : e1, end: dir ? e1 : e2, hdg: dir ? (h + 180) % 360 : h, lenM, ils, paved });
    }
  }
  _rwyEnds[icao] = { day, ends: out };
  return out;
}
/** The wind along a runway end: + headwind, − tailwind, and the crosswind (kt). */
function runwayWind(re: RunwayEnd): { head: number; cross: number; dir: number; kt: number; real: boolean } {
  const a: any = apt(re.icao), w = airportWind(re.icao, a ? a.pos : re.thr);
  return { head: Math.round(w.kt * Math.cos((w.dir - re.hdg) * D2R)), cross: Math.round(Math.abs(w.kt * Math.sin((w.dir - re.hdg) * D2R))), dir: w.dir, kt: w.kt, real: w.real };
}
/** A runway end by its name (08, 26L), or null. */
function runwayByName(icao: string, name: string): RunwayEnd {
  if (!name) return null;
  return runwayEnds(icao).filter(r => rwyMatch(r.name, name))[0] || null;
}
/** The runway end in use at an airport (landing and take-off into the wind, longer runways preferred). */
function activeRunway(icao: string): RunwayEnd {
  const a: any = apt(icao); if (!a) return null;
  const wind = airportWind(icao, a.pos), key = icao + '|' + Math.round(wind.dir / 10) + '|' + new Date().toISOString().slice(0, 10);
  if (_rwyCache[key] !== undefined) return _rwyCache[key];
  let best: RunwayEnd = null, bs = -1e9;
  for (const r of runwayEnds(icao)) {
    const head = Math.cos((wind.dir - r.hdg) * D2R), score = head * 2 + Math.min(r.lenM, 4000) / 1500 + (r.paved ? 0.5 : 0);
    if (score > bs) { bs = score; best = r; }
  }
  return (_rwyCache[key] = best);
}
const RWY_TAIL_MAX = 10;   // kt: the usual tailwind limit for take-off and landing
/** The runways a route's flights use: the ones assigned in the Flight planner, otherwise the one in use. */
function routeRunways(from: string, to: string): { dep: RunwayEnd; arr: RunwayEnd; depSet: boolean; arrSet: boolean } {
  const pk = procPick(from, to);
  // an assigned runway with too much tailwind isn't used until the wind turns (as the tower would)
  const ok = (re: RunwayEnd) => re && -runwayWind(re).head <= RWY_TAIL_MAX ? re : null;
  const d = pk && pk.depRwy ? ok(runwayByName(from, pk.depRwy)) : null, r = pk && pk.arrRwy ? ok(runwayByName(to, pk.arrRwy)) : null;
  return { dep: d || activeRunway(from), arr: r || activeRunway(to), depSet: !!d, arrSet: !!r };
}

/** Round off the corners of a polyline (two passes of corner cutting), keeping the end points. */
/** Round every corner of a route with a circular arc of the given radius (nm; 0 keeps the corner), the way an
 *  aircraft flies by a waypoint. Returns the new points and, for each old point, the index of its new point. */
function flyByArcs(p: number[][], radiusNm: (i: number) => number): { pts: number[][]; map: number[] } {
  const out: number[][] = [p[0]], map = [0];
  for (let i = 1; i < p.length - 1; i++) {
    const R = radiusNm(i), a = p[i - 1], b = p[i], c = p[i + 1];
    const l1 = gcDistanceNm(a, b), l2 = gcDistanceNm(b, c);
    const h1 = geoBrg(a, b), h2 = geoBrg(b, c);
    let turn = ((h2 - h1 + 540) % 360) - 180;
    if (!R || l1 < 0.05 || l2 < 0.05 || Math.abs(turn) < 2) { map.push(out.length); out.push(b); continue; }
    // the arc starts and ends where it meets each leg: R·tan(turn/2) before and after the waypoint, at most
    // 45% of each leg (a tighter turn when the legs are short)
    const th = Math.abs(turn) * Math.PI / 180;
    let t = R * Math.tan(th / 2); const tMax = Math.min(l1, l2) * 0.45;
    let r = R; if (t > tMax) { t = tMax; r = t / Math.tan(th / 2); }
    const p0 = geoDest(b, (h1 + 180) % 360, t), side = turn > 0 ? 1 : -1;
    const ctr = geoDest(p0, (h1 + 90 * side + 360) % 360, r);
    const steps = Math.max(3, Math.ceil(Math.abs(turn) / 2.5));   // a smooth curve: a point every 2.5° of turn
    const start = (h1 - 90 * side + 360) % 360;   // from the centre to the start of the arc
    map.push(out.length + Math.floor(steps / 2));
    for (let k = 0; k <= steps; k++) out.push(geoDest(ctr, (start + turn * k / steps + 360) % 360, r));
  }
  map.push(out.length); out.push(p[p.length - 1]);
  return { pts: out, map };
}

function smoothPath(p: number[][], passes = 2): number[][] {
  let q = p;
  for (let k = 0; k < passes; k++) {
    if (q.length < 3) return q;
    const out = [q[0]];
    for (let i = 0; i < q.length - 1; i++) {
      const a = q[i], b = q[i + 1];
      if (i > 0) out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      if (i < q.length - 2) out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(q[q.length - 1]); q = out;
  }
  return q;
}

/* ---------- Published procedures from the simulator (through the PC app, when linked) ---------- */
interface SimLeg { t: number; fix: string; lat: number; lon: number; alt: number; crs: number; dist: number; turn: number; arcLat?: number; arcLon?: number; ad?: string; alt2?: number; spd?: number; role?: string }
interface SimProc { name: string; kind: string; type?: number; suffix?: string; rwy?: string; common: SimLeg[]; runways: { name: string; rwy?: string; legs: SimLeg[] }[]; enroute: { name: string; legs: SimLeg[] }[] }
interface SimProcs { icao: string; sids: SimProc[]; stars: SimProc[]; apps: SimProc[] }

const SimProcedures = {
  data: {} as { [icao: string]: SimProcs | false },
  asked: {} as { [icao: string]: boolean },
  get(icao: string): SimProcs {
    const d = this.data[icao]; if (d) return d; if (d === false) { const b = BundledProcs.get(icao); if (b) { this.src[icao] = 'faa'; return b; } const g = BundledProcs.index && !BundledProcs.index[icao] ? NavProcs.get(icao) : null; if (g) this.src[icao] = 'nav'; return g; }
    try { const k = JSON.parse(localStorage.getItem('amp-proc:' + icao) || 'null'); if (k && k.l) { this.src[icao] = 'sim'; return (this.data[icao] = k.l); } } catch (e) { /* none */ }
    this.ask(icao);
    // the published ones that come with the app (US airports, FAA), with or without the simulator
    const b = BundledProcs.get(icao); if (b) { this.src[icao] = 'faa'; return b; }
    // elsewhere: ones built from the real radio navaids around the airport
    if (BundledProcs.index && !BundledProcs.index[icao]) { const g = NavProcs.get(icao); if (g) { this.src[icao] = 'nav'; return g; } }
    return null;
  },
  /** Where an airport's procedures come from: 'sim' (Flight Simulator's navigation data), 'faa' (the FAA's, with the app). */
  src: {} as { [icao: string]: string },
  ask(icao: string) {
    if (this.asked[icao] || Link.status !== 'connected') return;
    this.asked[icao] = true;
    try { linkSend({ type: 'procs', icao }); } catch (e) { /* not linked */ }
  },
  received(icao: string, procs: any, error?: string) {
    icao = String(icao || '').toUpperCase();
    if (!procs || error) { this.data[icao] = false; return; }
    this.data[icao] = procs; this.src[icao] = 'sim';
    try { AirportLayouts.keep('amp-proc:' + icao, procs as any); } catch (e) { /* storage full */ }
    // only flights that start from now on use them: a flight never changes its path in the air
    for (const k of Object.keys(_paths)) if (k.indexOf(icao) >= 0) delete _paths[k];
  },
};

/** The published departures, arrivals and approaches that come with the app: the FAA's for the airports in the
 *  United States and its territories (tools/navdata/cifp.py), loaded a group of airports at a time when needed. */
const BundledProcs = {
  index: null as { [icao: string]: 1 }, cycle: '', loading: false, groups: {} as { [g: string]: { [icao: string]: any } | false }, done: {} as { [icao: string]: SimProcs }, busy: {} as { [g: string]: boolean },
  start() {
    if (this.index || this.loading) return; this.loading = true;
    fetch('navdata/cifp/index.json').then(r => r.ok ? r.json() : null).then((j: any) => {
      const ix: any = {}; for (const k of (j && j.airports) || []) ix[k] = 1; this.index = ix; this.cycle = (j && j.cycle) || '';
    }).catch(() => { this.index = {}; });
  },
  has(icao: string): boolean { this.start(); return !!(this.index && this.index[icao]); },
  get(icao: string): SimProcs {
    if (!this.has(icao)) return null;
    const g = icao.slice(0, 2), G = this.groups[g];
    if (G) { if (this.done[icao]) return this.done[icao]; const v = G[icao]; return v ? (this.done[icao] = bundledExpand(icao, v)) : null; }
    if (G === false || this.busy[g]) return null;
    this.busy[g] = true;
    fetch('navdata/cifp/' + g + '.json').then(r => r.ok ? r.json() : null).then((j: any) => {
      this.groups[g] = j || false;
      // flights starting from now on use them (a flight never changes its path in the air)
      if (j) for (const k of Object.keys(_paths)) if (k.slice(0, 2) === g || k.indexOf('>' + g) >= 0) delete _paths[k];
    }).catch(() => { this.groups[g] = false; }).then(() => { delete this.busy[g]; });
    return null;
  },
};
/** Every radio navaid in the world (OurAirports, public domain): VOR, VOR-DME, VORTAC, TACAN, DME and NDB. */
const Navaids = {
  list: null as any[], grid: {} as { [k: string]: any[] }, loading: false,
  load() {
    if (this.list || this.loading) return; this.loading = true;
    fetch('navaids-world.json').then(r => r.ok ? r.json() : null).then((j: any) => {
      const L: any[] = (j && j.navaids) || [], G: any = {};
      for (const n of L) { const k = Math.floor(n[2]) + ',' + Math.floor(n[3]); (G[k] || (G[k] = [])).push(n); }
      this.grid = G; this.list = L;
      for (const k of Object.keys(_paths)) delete _paths[k];   // flights from now on use them
    }).catch(() => { this.list = []; });
  },
  /** Navaids within `nm` of a place: [ident, kind, lat, lon, kHz, airport]. */
  near(pos: number[], nm: number): any[] {
    if (!this.list) { this.load(); return []; }
    const out: any[] = [], la = Math.floor(pos[1]), lo = Math.floor(pos[0]), r = Math.ceil(nm / 50) + 1;
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const n of this.grid[(la + i) + ',' + (lo + j)] || []) if (gcDistanceNm(pos, [n[3], n[2]]) <= nm) out.push(n);
    return out;
  },
};

/** Departures, arrivals and approaches built the way they are designed, from the real navaids around an airport,
 *  where neither the simulator nor the FAA has published ones: each departure climbs straight ahead and turns
 *  to a navaid in its direction; each arrival starts at a navaid and leads to the final approach course; the
 *  approach has its fixes where they are put on real approaches (CIxx about 10 nm out, FFxx, the final approach
 *  fix, 5.5 nm out at about 1,800 ft above the runway, and the runway). An ILS where the runway has one,
 *  otherwise an RNAV approach. Shown as built from navaids, never as published. */
const NavProcs = {
  data: {} as { [icao: string]: SimProcs | false },
  get(icao: string): SimProcs {
    if (this.data[icao] !== undefined) return this.data[icao] || null;
    const A: any = apt(icao); if (!A || !World.runways) return null;
    if (!Navaids.list) { Navaids.load(); return null; }
    const ends = runwayEnds(icao); if (!ends.length) { this.data[icao] = false; return null; }
    const elevM = (A.elev || 0) * 0.3048, ft = (f: number) => Math.round(elevM + f * 0.3048);
    const leg = (t: number, fix: string, p: number[], alt?: number, crs?: number): SimLeg => ({ t, fix, lat: p ? p[1] : 0, lon: p ? p[0] : 0, alt: alt || 0, crs: crs || 0, dist: 0, turn: 0 });
    // up to six navaids 12-80 nm away, spread round the compass (the nearest in each direction)
    const cand = Navaids.near(A.pos, 80).filter(n => { const d = gcDistanceNm(A.pos, [n[3], n[2]]); return d >= 12 && /^(V|VD|VT|T|N|ND)$/.test(n[1]); })
      .map(n => ({ id: String(n[0]), pos: [n[3], n[2]], brg: geoBrg(A.pos, [n[3], n[2]]), d: gcDistanceNm(A.pos, [n[3], n[2]]), vor: /^V/.test(n[1]) }))
      .sort((a, b) => (a.vor === b.vor ? a.d - b.d : a.vor ? -1 : 1));
    const picked: any[] = [];
    for (const c of cand) { if (picked.length >= 6) break; if (picked.every(p => Math.abs(angDiff(p.brg, c.brg)) > 45)) picked.push(c); }
    const num = (k: string) => 1 + (_hashStr(icao + k) % 9);
    const sids: SimProc[] = [], stars: SimProc[] = [], apps: SimProc[] = [];
    for (const n of picked) {
      sids.push({ name: n.id + num(n.id) + 'D', kind: 'sid', common: [leg(7, n.id, n.pos, ft(Math.min(12000, 3000 + n.d * 150)))],
        runways: ends.map(e => ({ name: 'RW' + e.name, rwy: e.name, legs: [leg(2, '', null, ft(1500), e.hdg)] })), enroute: [] });
      stars.push({ name: n.id + num(n.id + 'a') + 'A', kind: 'star', common: [leg(15, n.id, n.pos, ft(Math.min(10000, 4000 + n.d * 100)))],
        runways: ends.map(e => {
          const back = (e.hdg + 180) % 360, ci = geoDest(e.thr, back, 10), inb = geoBrg(n.pos, ci), off = angDiff(e.hdg, inb), legs: SimLeg[] = [];
          // coming from ahead of the runway: round by a point abeam the field, as a downwind and base would
          if (Math.abs(off) > 70) { const side = off > 0 ? -1 : 1; legs.push(leg(18, '', geoDest(geoDest(e.thr, (e.hdg + 90 * side + 360) % 360, 6), back, 4), ft(4000))); }
          legs.push(leg(18, 'CI' + e.name, ci, ft(3000)));
          return { name: 'RW' + e.name, rwy: e.name, legs };
        }), enroute: [] });
    }
    for (const e of ends) {
      const back = (e.hdg + 180) % 360, ci = geoDest(e.thr, back, 10), ff = geoDest(e.thr, back, 5.5);
      const l1 = leg(15, 'CI' + e.name, ci, ft(3000)), l2 = leg(4, 'FF' + e.name, ff, ft(1800), e.hdg), l3 = leg(4, 'RW' + e.name, e.thr, ft(50), e.hdg);
      l1.role = 'B'; l2.role = 'F'; l3.role = 'M'; l1.ad = '+'; l2.ad = '+';
      apps.push({ name: (e.ils ? 'I' : 'R') + e.name, kind: 'app', type: e.ils ? 4 : 10, suffix: '', rwy: e.name, common: [l1, l2, l3], runways: [], enroute: [] });
    }
    const out: SimProcs = { icao, sids, stars, apps };
    this.data[icao] = out; return out;
  },
};

/** A leg as the file has it ([type, fix, lat, lon, alt, course, distance, turn, arc lat, arc lon, rule, alt 2, speed, role]) to a SimLeg. */
function bundledLeg(a: any[]): SimLeg {
  const l: any = { t: a[0], fix: a[1] || '', lat: a[2] || 0, lon: a[3] || 0, alt: a[4] || 0, crs: a[5] || 0, dist: a[6] || 0, turn: a[7] || 0 };
  if (a[8] || a[9]) { l.arcLat = a[8]; l.arcLon = a[9]; }
  if (a[10]) l.ad = a[10]; if (a[11]) l.alt2 = a[11]; if (a[12]) l.spd = a[12]; if (a[13]) l.role = a[13];
  return l;
}
function bundledExpand(icao: string, v: any): SimProcs {
  const pr = (p: any): SimProc => ({ name: p.name, kind: p.kind, type: p.type, suffix: p.suffix, rwy: p.rwy, common: (p.common || []).map(bundledLeg),
    runways: (p.runways || []).map((r: any) => ({ name: r.name, rwy: r.rwy, legs: r.legs.map(bundledLeg) })), enroute: (p.enroute || []).map((r: any) => ({ name: r.name, legs: r.legs.map(bundledLeg) })) });
  return { icao, sids: (v.sids || []).map(pr), stars: (v.stars || []).map(pr), apps: (v.apps || []).map(pr) };
}

/* ---------- Real-world airways (from the simulator, through the PC app) ---------- */
// Airliners and cargo jets fly the high airways, turboprops and light aircraft the low ones, between where
// their departures end and their arrivals begin, as in real life. A route is asked for once per city pair and
// kind and kept on this device; until it is known (or without the simulator) flights fly the great circle.
interface AwyFixA { id: string; lat: number; lon: number; via: string }
const AirwayRoutes = {
  data: {} as { [k: string]: { at: number; route: AwyFixA[] } | false }, asked: {} as { [k: string]: number }, busy: 0,
  key(from: string, to: string, cls: string) { return `${from}-${to}-${cls}`; },
  get(from: string, to: string, cls: string): AwyFixA[] {
    if (!from || !to || from === to || (State.settings as any).realAirways === false) return null;
    const k = this.key(from, to, cls), d = this.data[k];
    if (d) return d.route; if (d === false) return null;
    try { const j = JSON.parse(localStorage.getItem('amp-awy:' + k) || 'null'); if (j && j.route) { this.data[k] = j; return j.route; } } catch (e) { /* none */ }
    this.ask(from, to, cls);
    return null;
  },
  sig(from: string, to: string, cls: string): string { const r = this.get(from, to, cls); return r ? '|awy' + cls + r.length : ''; },
  ask(from: string, to: string, cls: string) {
    const k = this.key(from, to, cls), now = Date.now();
    if ((this.asked[k] && now - this.asked[k] < 30 * 60e3) || Link.status !== 'connected' || this.busy > 2) return;
    const A = apt(from), B = apt(to); if (!A || !B || gcDistanceNm(A.pos, B.pos) < 100) { this.data[k] = false; return; }
    this.asked[k] = now; this.busy++;
    try { linkSend({ type: 'awy', from, to, cls } as any); } catch (e) { this.busy--; }
  },
  received(from: string, to: string, cls: string, route: AwyFixA[], error?: string) {
    this.busy = Math.max(0, this.busy - 1);
    const k = this.key(from, to, cls);
    if (!route || error || route.length < 2) { this.data[k] = false; try { if (PlannerUi.awyWait === k) { PlannerUi.awyWait = ''; toast(error || 'No airway route found', 'warn'); } } catch (e) { /* not open */ } return; }
    const v = { at: Date.now(), route: route.filter(x => x && isFinite(x.lat) && isFinite(x.lon)) };
    this.data[k] = v;
    try { localStorage.setItem('amp-awy:' + k, JSON.stringify(v)); } catch (e) { /* storage full */ }
    // flights that start from now on fly it (a flight never changes its path in the air)
    for (const pk of Object.keys(_paths)) if (pk.indexOf(from + '>' + to) === 0) delete _paths[pk];
    try { for (const pk in _profiles) if (pk.indexOf('|' + from + '|' + to + '|') >= 0) delete _profiles[pk]; } catch (e) { /* none */ }
    try { if (PlannerUi.awyWait === k) { PlannerUi.awyWait = ''; plFillAirways(v.route); } else plPanelRedraw(); } catch (e) { /* not open */ }
  },
};
/** High airways for airliners and cargo jets, low ones for turboprops and light aircraft. */
function awyClass(typeId: string): 'H' | 'L' {
  const t = acType(typeId); if (!t) return 'H';
  const P: any = perfFor(t); return P.jet && P.maxAlt >= 25000 ? 'H' : 'L';
}

/** While linked to Flight Simulator: the published departures, arrivals and approaches (real-world navigation
 *  data, as the simulator has it) for the airports your airline flies to, where its aircraft are, and the
 *  Faroe Islands, Iceland, Greenland and Scandinavia, fetched one airport every few seconds and kept on this
 *  device, so flights there follow the real procedures (also later, when not linked). */
const ProcPrefetch = { queue: [] as string[], started: false, timer: 0 as any };
function procPrefetchStart() {
  if (ProcPrefetch.started) return; ProcPrefetch.started = true;
  ProcPrefetch.timer = setInterval(() => {
    if (Link.status !== 'connected') return;
    if (!ProcPrefetch.queue.length) {
      const want: { [k: string]: number } = {};
      const add = (k: string, pr: number) => { if (k && /^[A-Z0-9]{4}$/.test(k)) want[k] = Math.max(want[k] || 0, pr); };
      try { for (const r of State.routes || []) for (const l of (r as any).legs || []) add(l, 3); } catch (e) { /* none */ }
      try { for (const f of State.live || []) { add(f.from, 3); add(f.to, 3); } for (const a of State.fleet || []) add((a as any).location, 2); } catch (e) { /* none */ }
      try { for (const a of World.list || []) if (/^(EK|EN|ES|EF|BI|BG)/.test(a.icao) && (a as any).size >= 1) add(a.icao, /^(EKVG|EKKA|EKCH|ENGM|ENBR|ESSA|EFHK|BIKF|BGSF)$/.test(a.icao) ? 3 : 1); } catch (e) { /* not loaded */ }
      const have = (k: string) => { try { return !!localStorage.getItem('amp-proc:' + k) || SimProcedures.data[k] !== undefined; } catch (e) { return false; } };
      ProcPrefetch.queue = Object.keys(want).filter(k => !have(k)).sort((a, b) => want[b] - want[a]).slice(0, 400);
      if (!ProcPrefetch.queue.length) return;
    }
    const k = ProcPrefetch.queue.shift(); if (k) SimProcedures.ask(k);
  }, 4000);
}

const APP_TYPES: { [t: number]: string } = { 1: 'GPS', 2: 'VOR', 3: 'NDB', 4: 'ILS', 5: 'LOC', 6: 'SDF', 7: 'LDA', 8: 'VOR/DME', 9: 'NDB/DME', 10: 'RNAV', 11: 'LOC BC' };
const hasFix = (l: SimLeg) => !!l && (Math.abs(l.lat) > 1e-6 || Math.abs(l.lon) > 1e-6);

/** Legs to points: fixes where they have one, a short climb on course for course-to-altitude legs, arcs drawn round their centre. */
function legPoints(legs: SimLeg[], start: number[]): number[][] {
  const out: number[][] = []; let last = start;
  for (const l of legs || []) {
    if (hasFix(l)) {
      const p = [l.lon, l.lat];
      if (l.t === 17 && l.arcLat != null && last) {   // RF: constant-radius arc to the fix
        const c = [l.arcLon, l.arcLat], r = gcDistanceNm(c, p), b0 = geoBrg(c, last), b1 = geoBrg(c, p);
        let sweep = angDiff(b0, b1); if (l.turn === 1 && sweep > 0) sweep -= 360; if (l.turn === 2 && sweep < 0) sweep += 360;
        const n = Math.max(2, Math.round(Math.abs(sweep) / 10));
        for (let i = 1; i < n; i++) out.push(geoDest(c, b0 + sweep * i / n, r));
      }
      out.push(p); last = p;
    } else if ([2, 3, 5, 8, 19, 20, 21].indexOf(l.t) >= 0 && last && l.crs) {   // CA, CD, CI, FA, VA, VD, VI
      last = geoDest(last, l.crs, 3); out.push(last);
    }
  }
  return out;
}
function rwyMatch(a: string, b: string) { return !!a && !!b && a.replace(/^0/, '') === b.replace(/^0/, ''); }

/** A procedure's named fixes in order, with their altitude rule (for the map and the profile). */
interface ProcFix { name: string; pos: number[]; alt?: number; ad?: string; spd?: number }
function legFixes(legs: SimLeg[]): ProcFix[] {
  const out: ProcFix[] = [];
  for (const l of legs || []) if (hasFix(l) && l.fix) { const f: ProcFix = { name: l.fix, pos: [l.lon, l.lat] }; if (l.alt) { f.alt = Math.round(l.alt / 0.3048 / 10) * 10; f.ad = l.ad || ''; } if (l.spd) f.spd = l.spd; if (!out.length || out[out.length - 1].name !== f.name) out.push(f); }
  return out;
}
/** The departures (SIDs) that can be flown from a runway end, each with its transitions. */
function sidsFor(dep: RunwayEnd): SimProc[] {
  const sp = SimProcedures.get(dep.icao); if (!sp) return [];
  return sp.sids.filter(sid => !sid.runways.length || sid.runways.some(r => rwyMatch(r.rwy, dep.name)));
}
function starsFor(arr: RunwayEnd): SimProc[] {
  const sp = SimProcedures.get(arr.icao); if (!sp) return [];
  return sp.stars.filter(st => !st.runways.length || st.runways.some(r => rwyMatch(r.rwy, arr.name)));
}
function appsFor(arr: RunwayEnd): SimProc[] {
  const sp = SimProcedures.get(arr.icao); if (!sp) return [];
  const rank = (t: number) => t === 4 ? 0 : t === 10 || t === 1 ? 1 : 2;
  return sp.apps.filter(a => rwyMatch(a.rwy, arr.name)).sort((a, b) => rank(a.type) - rank(b.type));
}
function appName(app: SimProc): string { return `${APP_TYPES[app.type] || 'APP'} ${app.rwy || ''}${app.suffix ? ' ' + app.suffix : ''}`.trim(); }

/** The departure for the runway: the one assigned in the planner (and its transition), otherwise the published
 *  one that heads best towards the destination. */
function simDeparture(dep: RunwayEnd, dest: number[], pick?: { sid?: string; sidTr?: string }): { pts: number[][]; name: string; fixes: ProcFix[] } {
  const sids = sidsFor(dep); if (!sids.length) return null;
  const want = geoBrg(dep.end, dest);
  let best: any = null, bs = 1e9;
  for (const sid of sids) {
    if (pick && pick.sid && sid.name !== pick.sid) continue;
    const rt = sid.runways.filter(r => rwyMatch(r.rwy, dep.name))[0];
    let ens = sid.enroute.length ? sid.enroute : [{ name: '', legs: [] as SimLeg[] }];
    if (pick && pick.sidTr) { const e = ens.filter(x => x.name === pick.sidTr); if (e.length) ens = e; }
    for (const en of ens) {
      const legs = (rt ? rt.legs : []).concat(sid.common, en.legs), pts = legPoints(legs, dep.end); if (!pts.length) continue;
      const exit = pts[pts.length - 1], score = Math.abs(angDiff(want, geoBrg(dep.end, exit))) + gcDistanceNm(exit, dest) * 0.02;
      if (score < bs) { bs = score; best = { pts, name: sid.name + (en.name ? '.' + en.name : ''), fixes: legFixes(legs) }; }
    }
  }
  return best || (pick && pick.sid ? simDeparture(dep, dest) : null);
}

/** The arrival and approach for the landing runway: the ones assigned in the planner (with their transitions),
 *  otherwise the published ones that suit the direction the flight comes from. */
function simArrival(arr: RunwayEnd, from: number[], pick?: { star?: string; starTr?: string; app?: string; appTr?: string }): { star: number[][]; app: number[][]; starName: string; appName: string; fixes: ProcFix[] } {
  let apps = appsFor(arr); if (!apps.length) return null;
  if (pick && pick.app) { const a = apps.filter(x => x.name === pick.app || appName(x) === pick.app); if (a.length) apps = a; }
  const app = apps[0];
  let star: any = null, ss = 1e9;
  for (const st of starsFor(arr)) {
    if (pick && pick.star && st.name !== pick.star) continue;
    const rt = st.runways.filter(r => rwyMatch(r.rwy, arr.name))[0];
    let ens = st.enroute.length ? st.enroute : [{ name: '', legs: [] as SimLeg[] }];
    if (pick && pick.starTr) { const e = ens.filter(x => x.name === pick.starTr); if (e.length) ens = e; }
    for (const en of ens) {
      const legs = en.legs.concat(st.common, rt ? rt.legs : []), pts = legPoints(legs, null); if (!pts.length) continue;
      const score = gcDistanceNm(from, pts[0]) + pts.reduce((t, q, i) => i ? t + gcDistanceNm(pts[i - 1], q) : 0, 0) * 0.5;
      if (score < ss) { ss = score; star = { pts, name: (en.name ? en.name + '.' : '') + st.name, fixes: legFixes(legs) }; }
    }
  }
  if (!star && pick && pick.star) return simArrival(arr, from, { app: pick.app, appTr: pick.appTr });
  // the approach transition: the one assigned, or the one nearest where the arrival ends (or where the flight comes from)
  const joinAt = star ? star.pts[star.pts.length - 1] : from;
  let tr: any = null, trLegs: SimLeg[] = [], ts = 1e9;
  for (const t of app.enroute) {
    if (pick && pick.appTr && t.name !== pick.appTr) continue;
    const p = legPoints(t.legs, null); if (!p.length) continue; const d = gcDistanceNm(joinAt, p[0]); if (d < ts) { ts = d; tr = p; trLegs = t.legs; }
  }
  const final = legPoints(app.common, tr ? tr[tr.length - 1] : joinAt);
  if (!final.length) return null;
  const fixes = (star ? star.fixes : []).concat(legFixes(trLegs.concat(app.common)));
  return { star: star ? star.pts : [], app: (tr || []).concat(final), starName: star ? star.name : '', appName: appName(app), fixes };
}

const _paths: { [k: string]: FlightPath } = {};
/** The whole path of a flight from runway to runway (cached). Null when the runways aren't known. */
function flightPathFor(from: string, to: string, noSim?: boolean, cls?: 'H' | 'L'): FlightPath {
  if (!from || !to || from === to || !World.runways) return null;
  const RR = routeRunways(from, to), dep = RR.dep, arr = RR.arr;   // assigned in the planner, or by the wind
  if (!dep || !arr) return null;
  const PL0 = flightPlanFor(from, to);   // a flight plan from the planner: its waypoints instead of the great circle
  // otherwise the real airways (high or low) from the simulator, when known
  const AW = !PL0 && cls && !noSim ? AirwayRoutes.get(from, to, cls) : null;
  const PL: { wps: { id: string; lat: number; lon: number }[] } = PL0 || (AW ? { wps: AW.map((x, i) => ({ id: 'awy' + i, lat: x.lat, lon: x.lon })) } : null);
  const key = from + '>' + to + '|' + dep.name + '>' + arr.name + (noSim ? '|own' : '') + planSig(from, to) + (AW ? '|awy' + cls + AW.length : '');
  if (_paths[key]) return _paths[key];
  // departure: the published one from the simulator, or straight ahead for 4 nm and a turn onto the route
  let sidPts: number[][], sidName: string;
  // the simulator's procedures, when every point of them is near the airport (a point in the wrong place
  // would send the path on a huge detour, and the aircraft along it far too fast)
  const near = (pts: number[][], c: number[], nm: number) => pts.every(q => q && isFinite(q[0]) && isFinite(q[1]) && gcDistanceNm(q, c) < nm);
  const PK: any = procPick(from, to) || {};
  let sd = noSim ? null : simDeparture(dep, arr.thr, PK); if (sd && !near(sd.pts, dep.thr, 120)) sd = null;
  if (sd) { sidPts = sd.pts; sidName = sd.name; }
  else {
    const sidA = geoDest(dep.end, dep.hdg, 4), turn = angDiff(dep.hdg, geoBrg(sidA, arr.thr));
    sidPts = [sidA];
    const steps = Math.max(1, Math.round(Math.abs(turn) / 15));
    for (let i = 1; i <= steps; i++) { const prev = sidPts[sidPts.length - 1], h = dep.hdg + turn * i / steps; sidPts.push(geoDest(prev, h, 1.1)); }
    sidPts.push(geoDest(sidPts[sidPts.length - 1], geoBrg(sidPts[sidPts.length - 1], arr.thr), 8));
    sidName = `${dep.name} departure`;
  }
  const sidEnd = sidPts[sidPts.length - 1];
  // arrival and approach: published ones, or generated (straight in, or downwind and base; IF 10 nm, FAF 5.5 nm)
  let starPts: number[][], appPts: number[][], starName: string, appName: string;
  let sa = noSim ? null : simArrival(arr, sidEnd, PK); if (sa && !near((sa.star || []).concat(sa.app || []), arr.thr, 200)) sa = null;
  if (sa) {
    starPts = sa.star; appPts = sa.app; starName = sa.starName || `${arr.name} arrival`; appName = sa.appName;
    if (!starPts.length) starPts = [geoDest(appPts[0], geoBrg(appPts[0], sidEnd), 15)];
    const lastApp = appPts[appPts.length - 1];
    if (gcDistanceNm(lastApp, arr.thr) > 0.05) appPts = appPts.concat([arr.thr]);
  } else {
    const back = (arr.hdg + 180) % 360, IF = geoDest(arr.thr, back, 10), FAF = geoDest(arr.thr, back, 5.5);
    const inbound = geoBrg(sidEnd, IF), off = angDiff(arr.hdg, inbound);
    let star: number[][];
    if (Math.abs(off) <= 50) star = [geoDest(IF, (inbound + 180) % 360, 22), geoDest(IF, (inbound + 180) % 360, 8)];
    else {
      const side = off > 0 ? -1 : 1;
      const abeam = geoDest(geoDest(arr.thr, (arr.hdg + 90 * side + 360) % 360, 4.5), arr.hdg, 3);
      const base = geoDest(geoDest(IF, (arr.hdg + 90 * side + 360) % 360, 4.5), back, 1.5);
      star = [geoDest(abeam, geoBrg(sidEnd, abeam) + 180, 14), abeam, base];
    }
    const sm = smoothPath(star.concat([IF]), 2);
    starPts = sm.slice(0, -1); appPts = [IF, FAF, arr.thr];
    starName = `${arr.name} arrival`; appName = `${arr.ils ? 'ILS' : 'RNP'} ${arr.name}`;
  }
  // the route between: along a great circle, or through the plan's waypoints (great circles between them)
  const enroute: number[][] = [], wpRaw: { [id: string]: number } = {};
  if (PL) {
    const nodes: number[][] = [sidEnd], ids: string[] = [''];
    for (const w of PL.wps) { const q = [w.lon, w.lat]; if (gcDistanceNm(q, sidEnd) < 12 || gcDistanceNm(q, starPts[0]) < 12) continue; nodes.push(q); ids.push(w.id); }
    nodes.push(starPts[0]);
    for (let j = 1; j < nodes.length; j++) {
      const a = nodes[j - 1], b = nodes[j], m = Math.max(1, Math.min(32, Math.round(gcDistanceNm(a, b) / 40)));
      for (let i = 1; i < m; i++) enroute.push(gcInterpolate(a, b, i / m));
      if (j < nodes.length - 1) { enroute.push(b); wpRaw[ids[j]] = enroute.length - 1; }
    }
  } else {
    const a0 = sidEnd, b0 = starPts[0], legNm = gcDistanceNm(a0, b0), n = Math.max(2, Math.min(64, Math.round(legNm / 40)));
    for (let i = 1; i < n; i++) enroute.push(gcInterpolate(a0, b0, i / n));
  }
  const sid = sd ? [dep.thr, dep.end].concat(sidPts) : smoothPath([dep.thr, dep.end].concat(sidPts), 1);
  const raw = sid.concat(enroute, starPts, appPts);
  // turns are flown as round fly-by arcs, as a real aircraft turns: the radius its speed gives at the bank
  // airliners use (about 25°): about 1.5 nm in the departure and arrival, 3.5-4 nm joining and leaving the
  // route, about 7 nm at cruise speed; never wider than the legs allow, so it still follows the route.
  // The runway and the final stay straight.
  const iS = sid.length - 1, iR = iS + enroute.length + 1, iA = iR + starPts.length;
  const radius = (i: number) => i <= 1 || i >= raw.length - 2 ? 0 : i <= iS ? 1.4 : i < iR ? (i - iS <= 1 ? 3.5 : iR - i <= 1 ? 4 : 7) : i < iA ? 1.8 : 1.2;
  const sm = flyByArcs(raw, radius), pts = sm.pts, map = sm.map;
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + gcDistanceNm(pts[i - 1], pts[i]));
  const idx = (k: number) => cum[Math.min(cum.length - 1, k)];
  const iSidEnd = map[sid.length - 1], iStar = map[sid.length - 1 + enroute.length + 1], iApp = map[sid.length + enroute.length + starPts.length];
  const parts: ProcPart[] = [
    { kind: 'sid', name: sidName, from: 0, to: idx(iSidEnd) },
    { kind: 'route', name: '', from: idx(iSidEnd), to: idx(iStar) },
    { kind: 'star', name: starName, from: idx(iStar), to: idx(iApp) },
    { kind: 'app', name: appName, from: idx(iApp), to: cum[cum.length - 1] },
  ];
  const len = cum[cum.length - 1], gc = gcDistanceNm(dep.thr, arr.thr);
  // where each of the plan's waypoints is along the path (for its levels and speeds)
  const wpD: { [id: string]: number } = {}; for (const id in wpRaw) wpD[id] = idx(map[sid.length + wpRaw[id]]);
  // still much longer than the trip itself: the app's own departure and arrival instead
  const picked = !!(PK.sid || PK.star || PK.app);   // ones you chose are flown even when they are long
  if ((sd || sa) && !noSim && !picked && len > gc * 1.35 + (PL ? 400 : 120)) { const own = flightPathFor(from, to, true); if (own) return (_paths[key] = own); }
  return (_paths[key] = { pts, cum, len, parts, dep, arr, sim: !!(sd || sa), wpD, awy: AW || null, depSrc: sd ? SimProcedures.src[from] || 'sim' : '', arrSrc: sa ? SimProcedures.src[to] || 'sim' : '', fixes: (sd ? sd.fixes : []).concat(sa ? sa.fixes : []) } as any);
}

/** The point `d` nm along a path, and the direction of travel there. */
function pathAt(fp: FlightPath, d: number): { pos: number[]; hdg: number } {
  const c = fp.cum, p = fp.pts; d = clamp(d, 0, fp.len);
  let i = 1; while (i < c.length - 1 && c[i] < d) i++;
  const seg = c[i] - c[i - 1] || 1e-9, k = clamp((d - c[i - 1]) / seg, 0, 1);
  return { pos: [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k], hdg: geoBrg(p[i - 1], p[i]) };
}

const _flightPaths: { [k: string]: FlightPath } = {};
/** A helicopter's path: straight from pad to pad (no runways, departures or arrivals); it lifts off and sets down where it is. */
function heliPath(from: string, to: string): FlightPath {
  const A = apt(from), B = apt(to); if (!A || !B || from === to) return null;
  const len = Math.max(0.2, gcDistanceNm(A.pos, B.pos)), hdg = geoBrg(A.pos, B.pos);
  const end = (k: string, p: number[], h: number): RunwayEnd => ({ icao: k, name: 'pad', other: 'pad', thr: p, end: p, hdg: h, lenM: 0, ils: false });
  return { pts: [A.pos, B.pos], cum: [0, len], len, parts: [{ kind: 'route', name: 'Direct', from: 0, to: len }], dep: end(from, A.pos, hdg), arr: end(to, B.pos, hdg) };
}
/** Where a hired or co-op pilot's flight is right now along its procedures (null: not on a known path). */
function flightPathPos(f: any, now?: number): { pos: number[]; hdg: number; d: number; fp: FlightPath } {
  if (!f || !f.depAt || f.real && f.you) return null;
  const pk = f.id + '|' + f.from + '>' + f.to + '|' + f.depAt + planSig(f.from, f.to);
  let fp = _flightPaths[pk];
  const tid = f.typeId || (plane(f.reg) || {} as any).typeId, cls = awyClass(tid);
  if (!fp && isHeli(tid)) { fp = heliPath(f.from, f.to); if (!fp) return null; _flightPaths[pk] = fp; }
  if (!fp) { fp = flightPathFor(f.from, f.noDest ? null : f.to, false, cls); if (!fp) return null; _flightPaths[pk] = fp; }
  now = now || Date.now();
  const prof: FlightProfile = f.coop || f.tfc ? flightProfile(f.typeId, f.from, f.to, f.depAt) : aiProfile(f);
  // the simulator's procedures much longer than the trip the times are worked out for: the app's own ones instead
  const pkF: any = procPick(f.from, f.to) || {};
  if (!isHeli(tid) && (fp as any).sim && !flightPlanFor(f.from, f.to) && !(pkF.sid || pkF.star || pkF.app) && prof.routeNm > 0 && fp.len > prof.routeNm * 1.4 + 40) { const own = flightPathFor(f.from, f.noDest ? null : f.to, true); if (own) fp = _flightPaths[pk] = own; }
  const fe = flightEl(f, now), q = profileAt(prof, fe.el);
  // the profile's distance (along airways) mapped onto this path
  const d = prof.routeNm > 0 ? q.d / prof.routeNm * fp.len : 0;
  const r = pathAt(fp, d);
  // a holding pattern, or a go-around and a circuit back to the final: circling to the right, a turn about every 4 minutes
  if (fe.hold && (fe.hold.kind === 'air' || fe.hold.kind === 'goaround')) {
    const R = fe.hold.kind === 'air' ? 2.6 : 1.8, ang = (fe.inHold / 240) * 360;
    const ctr = geoDest(r.pos, r.hdg + 90, R), pos = geoDest(ctr, r.hdg - 90 + ang, R);
    return { pos, hdg: (r.hdg + ang + 360) % 360, d, fp };
  }
  return { pos: r.pos, hdg: r.hdg, d, fp };
}
