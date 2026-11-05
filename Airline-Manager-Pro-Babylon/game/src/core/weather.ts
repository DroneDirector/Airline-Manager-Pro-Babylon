// Real-world weather for the whole world, always on: the AI flies in it whether you watch the map or not.
// Sources (public, free for any use, from the US National Weather Service's Aviation Weather Center):
//  - METAR and TAF: the weather at each airport now and forecast (wind, gusts, visibility, cloud base,
//    thunderstorms, rain, snow, fog, freezing rain).
//  - SIGMETs (international and US): areas of thunderstorms, severe turbulence, severe icing, volcanic ash
//    and tropical cyclones (hurricanes, typhoons).
// The weather layer on the map shows all of it and can be switched on and off; switching it off only
// hides it. With Flight Simulator connected, the panel shows the sim's own weather at your aircraft.
//
// What the hired pilots do follows real limits per aircraft type (docs/reference/weather-limits.txt):
// the demonstrated crosswind, tailwind, the lowest visibility and cloud base each aircraft and airport may
// use (CAT III at big airports, CAT I at regional ones, a non-precision approach at small ones, VFR for
// aircraft without IFR approval), no take-off or landing with a thunderstorm over the airport, freezing
// rain and heavy snow (de-icing and runway clearing), very strong gusts, hurricanes, volcanic ash and
// severe icing for aircraft not approved for it. Only the severe cases stop a flight: it waits (and after
// five hours is cancelled and flown the next day), holds before landing, reroutes around a storm area,
// or diverts to an alternate airport with good weather and carries on when it can.

interface WxLimit { xw: number; tw: number; appM: number; appFt: number; toM: number; ifr: boolean; fiki: boolean }
// xw: max crosswind incl. gusts (kt, demonstrated/manufacturer guidance); tw: max tailwind (kt);
// appM/appFt: lowest landing visibility (m) and decision height (ft) the aircraft is approved for;
// toM: lowest take-off visibility (m); ifr: approved to fly in cloud; fiki: approved for known icing.
const WX_LIMITS: { [typeId: string]: WxLimit } = {
  'a320-fenix': { xw: 38, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'a320neo': { xw: 38, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'a350-ini': { xw: 40, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'a310-ini': { xw: 32, tw: 10, appM: 200, appFt: 50, toM: 150, ifr: true, fiki: true },
  'b738-pmdg': { xw: 33, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'b736-pmdg': { xw: 33, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'b77w-pmdg': { xw: 38, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'b78x': { xw: 40, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'b748': { xw: 30, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'crj9-aero': { xw: 27, tw: 10, appM: 350, appFt: 100, toM: 150, ifr: true, fiki: true },
  'crj7-aero': { xw: 27, tw: 10, appM: 350, appFt: 100, toM: 150, ifr: true, fiki: true },
  'atr72': { xw: 35, tw: 10, appM: 300, appFt: 100, toM: 150, ifr: true, fiki: true },
  'dhc6-aero': { xw: 27, tw: 10, appM: 550, appFt: 200, toM: 400, ifr: true, fiki: false },
  'dhc2': { xw: 17, tw: 5, appM: 3000, appFt: 1000, toM: 3000, ifr: false, fiki: false },
  'c208': { xw: 20, tw: 10, appM: 550, appFt: 200, toM: 400, ifr: true, fiki: true },
  'kodiak': { xw: 20, tw: 10, appM: 550, appFt: 200, toM: 400, ifr: true, fiki: true },
  'pc12': { xw: 25, tw: 10, appM: 550, appFt: 200, toM: 400, ifr: true, fiki: true },
  'c172': { xw: 15, tw: 5, appM: 5000, appFt: 1500, toM: 5000, ifr: false, fiki: false },
  'a319neo': { xw: 38, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'a321ceo': { xw: 35, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'a321neo': { xw: 35, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'a321lr': { xw: 35, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'a321xlr': { xw: 35, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'a330-800neo': { xw: 40, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'a330-900neo': { xw: 40, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'b737-max7': { xw: 33, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'b737-max8': { xw: 33, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'b737-max9': { xw: 33, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'b737-max10': { xw: 33, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  'b787-8': { xw: 40, tw: 15, appM: 75, appFt: 0, toM: 75, ifr: true, fiki: true },
  'b787-9': { xw: 40, tw: 15, appM: 75, appFt: 0, toM: 75, ifr: true, fiki: true },
  'b777-9': { xw: 38, tw: 15, appM: 75, appFt: 0, toM: 75, ifr: true, fiki: true },
  'h125': { xw: 45, tw: 15, appM: 1500, appFt: 500, toM: 1500, ifr: false, fiki: false },
  'h130': { xw: 45, tw: 15, appM: 1500, appFt: 500, toM: 1500, ifr: false, fiki: false },
  'h135': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: false },
  'h145': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: false },
  'h160': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: false },
  'h175': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: false },
  'bell407': { xw: 40, tw: 15, appM: 1500, appFt: 500, toM: 1500, ifr: false, fiki: false },
  'bell429': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: false },
  'bell505': { xw: 40, tw: 15, appM: 1500, appFt: 500, toM: 1500, ifr: false, fiki: false },
  'bell525': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: false },
  'aw109': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: false },
  'aw139': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: true },
  'aw169': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: false },
  'aw189': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: true },
  's76d': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: true },
  's92': { xw: 45, tw: 15, appM: 800, appFt: 200, toM: 400, ifr: true, fiki: true },
};
const WX_DEFAULT: { [cls: string]: WxLimit } = {
  widebody: { xw: 38, tw: 15, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true }, airliner: { xw: 33, tw: 10, appM: 75, appFt: 0, toM: 125, ifr: true, fiki: true },
  regional: { xw: 27, tw: 10, appM: 350, appFt: 100, toM: 150, ifr: true, fiki: true }, turboprop: { xw: 30, tw: 10, appM: 300, appFt: 100, toM: 150, ifr: true, fiki: true },
  bush: { xw: 20, tw: 10, appM: 550, appFt: 200, toM: 400, ifr: true, fiki: false }, ga: { xw: 15, tw: 5, appM: 5000, appFt: 1500, toM: 5000, ifr: false, fiki: false },
};
function wxLimit(typeId: string): WxLimit { const t = acType(typeId); return WX_LIMITS[typeId] || WX_DEFAULT[t ? t.cls : 'airliner'] || WX_DEFAULT.airliner; }

/* ---------- reading a report ---------- */
interface WxNow { visM: number; ceilFt: number; wx: string; kt: number; gust: number; dir: number; ts: boolean; vcts: boolean; fz: boolean; heavySn: boolean; fog: boolean; raw: string }
function wxNow(icao: string): WxNow {
  const m: any = LiveWx.get(icao); if (!m || !m.raw) return null;
  const raw: string = m.raw, wx: string = m.wx || '';
  const vis = String(m.vis).replace('+', ''), visM = vis === '' ? 9999 : Math.min(9999, Math.round(parseFloat(vis) * 1609));
  const ceil = m.ceil != null && m.ceil > 0 ? m.ceil : 99999;
  const all = wx + ' ' + raw.replace(/^\S+\s+\S+\s+/, '');
  return { visM: isNaN(visM) ? 9999 : visM, ceilFt: ceil, wx, kt: m.kt || 0, gust: m.gust || 0, dir: m.dir, raw,
    ts: /(^|\s)[+-]?TS|TSRA|TSGR|TSSN/.test(wx) || /\s[+-]?TS(RA|GR|SN)?\s/.test(' ' + all + ' ') && !/VCTS/.test(all.match(/\S*TS\S*/) ? all.match(/\S*TS\S*/)[0] : ''),
    vcts: /VCTS/.test(all), fz: /FZ(RA|DZ)/.test(all), heavySn: /\+SN|\+SHSN|BLSN/.test(all), fog: /FG/.test(wx) };
}
/** The lowest visibility and cloud base the airport's approaches allow: CAT III at big airports, CAT I at regional ones, non-precision at small ones. */
function airportMinima(icao: string): { m: number; ft: number } {
  const sz = typeof aptSize === 'function' ? aptSize(icao) : 1;
  return sz >= 2 ? { m: 75, ft: 0 } : sz === 1 ? { m: 550, ft: 200 } : { m: 1500, ft: 400 };
}
function crosswindAt(icao: string, w: WxNow): number {
  if (!w || w.dir < 0) return 0;
  let rw: RunwayEnd = null; try { rw = activeRunway(icao); } catch (e) { /* none */ }
  if (!rw) return 0;
  const ang = Math.abs(((w.dir - rw.hdg) % 360 + 540) % 360 - 180) * D2R;
  return Math.round(Math.max(w.kt, w.gust) * Math.abs(Math.sin(ang)));
}
interface WxVerdict { ok: boolean; why: string; kind: 'wait' | 'cancel' | ''; storm?: boolean }
/** Can this aircraft take off from (dep) or land at (arr) this airport in the weather there now? */
function wxCheck(typeId: string, icao: string, phase: 'dep' | 'arr'): WxVerdict {
  const w = wxNow(icao), L = wxLimit(typeId), ok: WxVerdict = { ok: true, why: '', kind: '' };
  const tc = Sigmets.at(icao, 'TC'); if (tc) return { ok: false, why: `Tropical cyclone near ${icao}`, kind: 'cancel' };
  const va = Sigmets.at(icao, 'VA'); if (va) return { ok: false, why: `Volcanic ash over ${icao}`, kind: 'wait' };
  if (!w) return ok;
  if (w.ts) return { ok: false, why: `Thunderstorm over ${icao}`, kind: 'wait', storm: true };
  if (w.vcts && !L.ifr) return { ok: false, why: `Thunderstorms near ${icao}`, kind: 'wait', storm: true };
  if (Math.max(w.kt, w.gust) >= 50) return { ok: false, why: `Wind ${w.kt} kt gusting ${w.gust || w.kt} at ${icao}`, kind: 'wait' };
  const xw = crosswindAt(icao, w); if (xw > L.xw) return { ok: false, why: `Crosswind ${xw} kt at ${icao}, the limit is ${L.xw} kt`, kind: 'wait' };
  if (/\+FZRA|\+FZDZ/.test(w.raw)) return { ok: false, why: `Heavy freezing rain at ${icao}`, kind: 'wait' };
  if (w.fz && !L.fiki) return { ok: false, why: `Freezing rain at ${icao}: not approved for icing`, kind: 'wait' };
  if (w.heavySn && phase === 'dep') return { ok: false, why: `Heavy snow at ${icao}: runway clearing and de-icing`, kind: 'wait' };
  const ap = airportMinima(icao), needM = phase === 'dep' ? Math.max(L.toM, ap.m === 75 ? 125 : ap.m / 2) : Math.max(L.appM, ap.m), needFt = phase === 'dep' ? (L.ifr ? 0 : L.appFt) : Math.max(L.appFt, ap.ft);
  if (w.visM < needM) return { ok: false, why: `Visibility ${w.visM < 1000 ? w.visM + ' m' : (w.visM / 1000).toFixed(1) + ' km'} at ${icao}${w.fog ? ' in fog' : ''}, below the ${needM} m minimum`, kind: 'wait' };
  if (w.ceilFt < needFt) return { ok: false, why: `Cloud base ${w.ceilFt} ft at ${icao}, below the ${needFt} ft minimum`, kind: 'wait' };
  return ok;
}
/** Short-term trouble forecast at the destination (TAF TEMPO/PROB groups with thunderstorms or fog). */
function wxForecastTrouble(icao: string): string {
  const m: any = LiveWx.get(icao); if (!m || !m.taf) return '';
  const t = String(m.taf).replace(/^TAF\s+(AMD\s+|COR\s+)?\S+\s+\S+\s+\S+\s+/, '');
  if (/(TEMPO|PROB\d\d)[^A-Z]*[^]*?(\+?TS\S*)/.test(t) && /TS/.test(t)) return 'thunderstorms';
  if (/(TEMPO|PROB\d\d)[^]*?\s0[0-3]\d\d\s/.test(t) || /(TEMPO|PROB\d\d)[^]*?\sFG\b/.test(t)) return 'fog';
  return '';
}

/* ---------- SIGMETs: hazard areas ---------- */
interface Sigmet { hazard: string; qual: string; from: number; to: number; base: number; top: number; poly: number[][]; raw: string; fir: string }
const Sigmets = {
  list: [] as Sigmet[], at0: 0, busy: false,
  refresh() {
    if (this.busy || Date.now() - this.at0 < 10 * 60e3 || typeof Net === 'undefined') return;
    this.busy = true;
    const parse = (arr: any[], us: boolean): Sigmet[] => (arr || []).map((s: any) => {
      const co = s.coords || s.geom || [];
      const poly = (Array.isArray(co) ? co : []).map((p: any) => Array.isArray(p) ? [+p[0], +p[1]] : [+p.lon, +p.lat]).filter((p: number[]) => isFinite(p[0]) && isFinite(p[1]));
      let hz = String(s.hazard || '').toUpperCase(); if (us && /CONVECTIVE/.test(hz)) hz = 'TS';
      return { hazard: hz, qual: String(s.qualifier || s.severity || ''), from: Date.parse(s.validTimeFrom) || (s.validTimeFrom * 1000) || 0, to: Date.parse(s.validTimeTo) || (s.validTimeTo * 1000) || 0,
        base: +s.base || +s.altitudeLow1 || 0, top: +s.top || +s.altitudeHi1 || 0, poly, raw: String(s.rawSigmet || s.rawAirSigmet || ''), fir: String(s.firId || s.icaoId || '') } as Sigmet;
    }).filter((s: Sigmet) => s.poly.length >= 3 && /TS|TURB|ICE|VA|TC|MTW/.test(s.hazard));
    Promise.all([Net.json('https://aviationweather.gov/api/data/isigmet?format=json').catch(() => []), Net.json('https://aviationweather.gov/api/data/airsigmet?format=json&type=sigmet').catch(() => [])])
      .then(([a, b]: any[]) => { const l = parse(a, false).concat(parse(b, true)); if (l.length || !this.list.length) this.list = l; this.at0 = Date.now(); })
      .catch(() => { this.at0 = Date.now() - 8 * 60e3; }).then(() => { this.busy = false; });
  },
  active(): Sigmet[] { this.refresh(); const now = Date.now(); return this.list.filter(s => (!s.from || s.from <= now + 3600e3) && (!s.to || s.to >= now)); },
  inside(pt: number[], poly: number[][]): boolean {
    let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1] || 1e-9) + a[0]) c = !c;
    } return c;
  },
  /** A hazard area over (or for a cyclone, within 150 nm of) an airport. */
  at(icao: string, hazard: string): Sigmet {
    const a = apt(icao); if (!a) return null;
    return this.active().filter(s => s.hazard === hazard && (this.inside(a.pos, s.poly) || (hazard === 'TC' && s.poly.some(p => gcDistanceNm(p, a.pos) < 150))))[0] || null;
  },
  /** Hazard areas a route crosses (sampled along the great circle). */
  onRoute(from: string, to: string): Sigmet[] {
    const A = apt(from), B = apt(to); if (!A || !B) return [];
    const pts: number[][] = []; for (let i = 1; i < 12; i++) pts.push(gcInterpolate(A.pos, B.pos, i / 12));
    return this.active().filter(s => pts.some(p => this.inside(p, s.poly)));
  },
};

/* ---------- what the hired pilot does ---------- */
/** At the gate: can the leg leave now? Departure and destination weather, and hazards on the way. */
function wxDepartureBlock(n: any, a: any): WxVerdict {
  const d = wxCheck(a.typeId, n.from, 'dep'); if (!d.ok) return d;
  const r = wxCheck(a.typeId, n.to, 'arr');
  if (!r.ok) {
    // a passing storm at the destination: long flights go anyway (it will have moved on), short ones wait
    const A = apt(n.from), B = apt(n.to), nm = A && B ? gcDistanceNm(A.pos, B.pos) : 300;
    if (!(r.storm && nm > 600)) return r;
  }
  const L = wxLimit(a.typeId), on = Sigmets.onRoute(n.from, n.to);
  const ice = on.filter(s => s.hazard === 'ICE')[0]; if (ice && !L.fiki) return { ok: false, why: 'Severe icing on the route: not approved for icing', kind: 'wait' };
  if (on.some(s => s.hazard === 'TC') && !L.ifr) return { ok: false, why: 'Tropical cyclone on the route', kind: 'cancel' };
  return { ok: true, why: '', kind: '' };
}
/** Once the leg leaves: reroutes around storm areas, holding for weather at the destination, or a diversion. */
function wxEnroute(f: any, a: any, prof: FlightProfile): string {
  const on = Sigmets.onRoute(f.from, f.to), holds: Hold[] = f.holds || (f.holds = []);
  const span = (ph: string) => { const pts = prof.pts; for (let i = 1; i < pts.length; i++) if (pts[i].ph === ph) return pts[i - 1].s; return prof.totalS * 0.4; };
  const cruise = span('Cruise');
  const ts = on.filter(s => s.hazard === 'TS')[0], tb = on.filter(s => s.hazard === 'TURB' || s.hazard === 'MTW')[0], va = on.filter(s => s.hazard === 'VA')[0];
  if (va) holds.push({ at: cruise, s: (25 + Math.random() * 20) * 60, kind: 'air', why: 'Rerouting around volcanic ash' });
  if (ts) { holds.push({ at: cruise, s: (8 + Math.random() * 17) * 60, kind: 'air', why: 'Rerouting around thunderstorms (weather)' }); f.bumpy = true; }
  if (tb) { if (!ts) holds.push({ at: cruise, s: (4 + Math.random() * 8) * 60, kind: 'air', why: 'Changing level for severe turbulence (weather)' }); f.bumpy = true; }
  // the destination's forecast: thunderstorms or fog coming and going
  const fc = wxForecastTrouble(f.to);
  if (fc) {
    const desc = prof.pts.filter(p => p.ph === 'Descent')[0], at = desc ? desc.s : prof.totalS * 0.85;
    if (Math.random() < 0.3) return fc;   // the weather won't lift: divert
    holds.push({ at, s: (15 + Math.random() * 20) * 60, kind: 'air', why: `Holding: ${fc} at ${f.to} (weather)` });
    if (fc === 'thunderstorms') f.bumpy = true;
  }
  holds.sort((x, y) => x.at - y.at);
  return '';
}
/** The alternate: the nearest airport to the destination with good weather and a runway the aircraft can use. */
function wxAlternate(typeId: string, from: string, dest: string, pax: number): string {
  const B = apt(dest); if (!B) return '';
  const seen: { [k: string]: boolean } = { [dest]: true, [from]: true };
  for (const r of [50, 100, 160, 230]) for (let b = 0; b < 360; b += 45) {
    const lat = B.pos[1] + r / 60 * Math.cos(b * D2R), lon = B.pos[0] + r / 60 * Math.sin(b * D2R) / Math.max(0.2, Math.cos(B.pos[1] * D2R));
    const k = World.nearest(lon, lat, 70); if (!k || seen[k] || !apt(k)) continue; seen[k] = true;
    if (!legRunwayCheck(typeId, from, k, pax).ok) continue;
    const v = wxCheck(typeId, k, 'arr'); if (v.ok) return k;
  }
  return '';
}
function wxDivertNote(f: any) {
  const d = f.wxDivert; if (!d || d.noted) return; d.noted = true;
  try { newsWxDiverted(f); } catch (e) { /* ignore */ }
  State.notices.unshift({ id: uid(), kind: 'pilot', title: `${f.callsign} diverting to ${f.to}: ${d.why} at ${d.orig}`, body: `The weather at ${d.orig} is below what ${f.callsign} may land in (${d.why}). The crew divert to ${f.to}, the planned alternate, and carry on to ${d.orig} once it clears.`, time: 'Now', read: false, ref: f.id } as any);
  try { renderTopbar(); } catch (e) { /* not ready */ }
}

/** Keep the weather fresh for every airport the airline flies to (the AI needs it even when nobody looks). */
let _wxPre = 0;
function wxPrefetch() {
  if (Date.now() - _wxPre < 9 * 60e3) return; _wxPre = Date.now();
  const set: { [k: string]: boolean } = {};
  State.routes.forEach(r => r.legs.forEach(k => set[k] = true));
  State.live.forEach(f => { set[f.from] = true; set[f.to] = true; });
  ((State as any).aiNext || []).forEach((n: any) => { set[n.from] = true; set[n.to] = true; });
  Object.keys(set).forEach(k => LiveWx.get(k));
  Sigmets.refresh();
}

/* ---------- the map layer ---------- */
const WX_HAZ: { [h: string]: [string, string, string] } = {   // fill, line, name
  TS: ['rgba(255,80,90,.16)', '#FF5A5F', 'Thunderstorms'], TURB: ['rgba(242,193,78,.14)', '#F2C14E', 'Severe turbulence'], MTW: ['rgba(242,193,78,.12)', '#F2C14E', 'Mountain waves'],
  ICE: ['rgba(110,170,255,.15)', '#6EAAFF', 'Severe icing'], VA: ['rgba(170,170,170,.2)', '#BBBBBB', 'Volcanic ash'], TC: ['rgba(190,110,255,.18)', '#BE6EFF', 'Tropical cyclone'],
};
const WX_CAT: { [c: string]: string } = { VFR: '#3DDC97', MVFR: '#4DA3FF', IFR: '#FF5A5F', LIFR: '#D45CFF' };
const WxLayer = {
  bboxAt: 0, bboxKey: '',
  on(): boolean { return !!(State.settings as any).wxLayer; },
  draw(c: CanvasRenderingContext2D, m: any, degPx: number) {
    wxPrefetch();
    if (!this.on()) return;
    const S: any = State.settings;
    c.save();
    if (S.wxClouds !== false) { if (degPx >= 1.5) this.fetchView(m); try { clouds2dDraw(c, m, degPx); } catch (e) { /* never stop the map */ } }
    if (S.wxSigmet !== false) for (const s of Sigmets.active()) {
      const st = WX_HAZ[s.hazard] || WX_HAZ.TS;
      c.beginPath(); let first = true, cx = 0, cy = 0, n = 0;
      for (const p of s.poly) { const q = m.px(p[0], p[1]); if (!q) continue; if (first) { c.moveTo(q[0], q[1]); first = false; } else c.lineTo(q[0], q[1]); cx += q[0]; cy += q[1]; n++; }
      if (n < 3) continue;
      c.closePath(); c.fillStyle = st[0]; c.fill(); c.strokeStyle = st[1]; c.lineWidth = 1.2; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]);
      if (degPx > 1.2) { c.font = '600 10.5px Inter, sans-serif'; c.fillStyle = st[1]; c.textAlign = 'center'; c.fillText(st[2] + (s.top ? ` to FL${Math.round(s.top / 100)}` : ''), cx / n, cy / n); c.textAlign = 'left'; }
    }
    if (S.wxMetar !== false) {
      if (degPx >= 1.5) this.fetchView(m);
      const cache = LiveWx.cache;
      let drawn = 0;
      for (const k in cache) {
        const w: any = cache[k]; if (!w.raw) continue;
        const a = apt(k); if (!a) continue;
        const q = m.px(a.pos[0], a.pos[1]); if (!q || q[0] < -10 || q[1] < -10 || q[0] > m.w + 10 || q[1] > m.h + 10) continue;
        const col = WX_CAT[w.cat] || '#9FB0C4', now = wxNow(k);
        c.beginPath(); c.arc(q[0], q[1], degPx > 4 ? 5 : 3.5, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(6,17,31,.8)'; c.lineWidth = 1.2; c.stroke();
        const tags: string[] = [];
        if (now) { if (now.ts) tags.push('TS'); else if (now.vcts) tags.push('VCTS'); if (now.fz) tags.push('FZ'); if (/RA/.test(now.wx)) tags.push(/\+RA|\+SHRA/.test(now.wx) ? '+RA' : 'RA'); if (/SN/.test(now.wx)) tags.push('SN'); if (now.fog) tags.push('FG'); if (Math.max(now.kt, now.gust) >= 30) tags.push(`${now.kt}G${now.gust || now.kt}`); }
        if (tags.length && degPx > 2.5) { c.font = '700 9.5px Inter, sans-serif'; c.fillStyle = now && now.ts ? '#FF7A7F' : '#DCE6F2'; c.fillText(tags.join(' '), q[0] + 7, q[1] + 3); }
        if (++drawn > 1200) break;
      }
    }
    c.restore();
  },
  /** At region zoom: the reports for every airport in view (one request, at most every five minutes per area). */
  fetchView(m: any) {
    const a = m.ll(0, m.h), b = m.ll(m.w, 0); if (!a || !b) return;
    const s = Math.floor(Math.max(-89, a[1])), w = Math.floor(Math.max(-180, a[0])), n = Math.ceil(Math.min(89, b[1])), e = Math.ceil(Math.min(180, b[0]));
    if (n - s > 40 || e - w > 60) return;
    const key = [s, w, n, e].join(',');
    if (key === this.bboxKey && Date.now() - this.bboxAt < 5 * 60e3) return;
    if (Date.now() - this.bboxAt < 4000) return;
    this.bboxKey = key; this.bboxAt = Date.now();
    Net.json(`https://aviationweather.gov/api/data/metar?bbox=${s},${w},${n},${e}&format=json`).then((ms: any[]) => {
      for (const x of ms || []) { if (!x || !x.icaoId) continue; LiveWx.store(x, ''); }
    }).catch(() => { /* offline */ });
  },
};
/** The panel: the sim's own weather at your aircraft (when connected), and the legend. */
function wxPanelHtml(): string {
  if (!WxLayer.on()) return '';
  const s: any = typeof Link !== 'undefined' ? Link.sim : null, w = s && s.wx;
  const sim = w && s.lat ? `<div class="wx-sim"><b>${icon('wind')}Your aircraft, from the simulator</b>
    <span>Wind ${String(Math.round(w.windDir)).padStart(3, '0')}° ${Math.round(w.windKt)} kt · Visibility ${w.visM >= 9999 ? '10 km+' : w.visM < 1000 ? w.visM + ' m' : (w.visM / 1000).toFixed(1) + ' km'} · ${w.tempC} °C · ${w.qnhHpa} hPa${w.precip && w.precip !== 'none' ? ' · ' + esc(w.precip) : ''}${w.inCloud ? ' · in cloud' : ''}${w.turb && w.turb !== 'none' ? ' · turbulence ' + esc(w.turb) : ''}</span></div>` : '';
  return `<div class="wx-panel">${sim}<div class="wx-legend">${Object.keys(WX_CAT).map(k => `<span><i style="background:${WX_CAT[k]}"></i>${k}</span>`).join('')}${['TS', 'TURB', 'ICE', 'VA', 'TC'].map(k => `<span><i class="area" style="border-color:${WX_HAZ[k][1]};background:${WX_HAZ[k][0]}"></i>${WX_HAZ[k][2]}</span>`).join('')}</div></div>`;
}
function wxBtn(): string {
  return `<button class="icon-btn wx-btn ${WxLayer.on() ? 'on' : ''}" data-act="wx-menu" aria-label="Weather layer">${icon('wind')}</button>`;
}
ACTIONS['wx-menu'] = el => {
  Sound.tick();
  const S: any = State.settings, r = el.getBoundingClientRect();
  const row = (k: string, label: string, sub: string, on: boolean) => `<button class="ly-opt wx-opt ${on ? 'on' : ''}" data-act="wx-toggle" data-k="${k}"><b>${label}</b><small>${sub}</small><span class="tg ${on ? 'on' : ''}"><i></i></span></button>`;
  const wrap = openLayer('pop', `<div class="ly-head"><b>Weather</b><small>Real-world weather from the Aviation Weather Center. Your hired pilots always fly in it; this only shows or hides it.</small></div>
    <div class="ly-opts wx-opts">${row('wxLayer', 'Weather on the map', 'Show the weather layer', !!S.wxLayer)}${row('wxClouds', 'Clouds', 'Cloud layers from the airport reports, as see-through layers', S.wxClouds !== false)}${row('wxSigmet', 'Storms and hazards', 'Thunderstorms, severe turbulence and icing, volcanic ash, cyclones', S.wxSigmet !== false)}${row('wxMetar', 'Airport weather', 'Flight category, thunderstorms, rain, snow, fog, strong wind', S.wxMetar !== false)}</div>`, { cls: 'layer-pick' });
  placePop(wrap.querySelector('.panel') as HTMLElement, r, 320);
};
ACTIONS['wx-toggle'] = el => {
  const S: any = State.settings, k = el.getAttribute('data-k');
  S[k] = k === 'wxLayer' ? !S.wxLayer : S[k] === false;
  Store.save(); Sound.tick(); closeAll(); refresh();
};
