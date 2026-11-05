// Flight plans (the Flight planner, screens/planner.ts): a route between two airports as waypoints, each with
// the level to fly from it on and, if you set one, the speed (indicated knots or a Mach number), plus climb and
// descent speeds and an alternate. A plan that is switched on is flown by every flight between those airports:
//  - the path on the map, in 3D and at the airports goes from the departure through the waypoints to the
//    arrival (procedures.ts, flightPathFor);
//  - the climb, the cruise (with step climbs and descents at the waypoints), the speeds, the top of descent and
//    so the times are worked out along it (flightperf.ts, flightProfile).
// Waypoints are named the way pilots write a position without a published name: degrees and minutes of
// latitude and longitude (5530N02015W), or an airport's code when it is one.

interface PlanWp { id: string; name: string; lat: number; lon: number; alt: number; spd?: number; mach?: number; apt?: string; via?: string }
interface FlightPlanR { key: string; from: string; to: string; wps: PlanWp[]; climbIas?: number; descIas?: number; altn?: string; on: boolean; v: number; at: number; typeId?: string;
  /** Runways and procedures assigned for every flight between the two airports (yours and your pilots'), even
   *  while the waypoints are switched off: '' or missing means chosen by the wind and the direction of flight. */
  depRwy?: string; arrRwy?: string; sid?: string; sidTr?: string; star?: string; starTr?: string; app?: string; appTr?: string }

/** The plan the Flight planner is showing (worked out as flown even while it is switched off). */
let _planPreview: string = null;
function planKey(from: string, to: string): string { return from + '-' + to; }
function plansAll(): { [k: string]: FlightPlanR } { const S: any = State; return S.plans || (S.plans = {}); }
/** The plan flown between two airports, if there is one and it is switched on. */
function flightPlanFor(from: string, to: string): FlightPlanR {
  if (!from || !to || from === to) return null;
  const p = plansAll()[planKey(from, to)];
  return p && (p.on || _planPreview === p.key) && p.wps && p.wps.length ? p : null;   // also while the planner previews it
}
/** The runways and procedures assigned between two airports (whether or not its waypoints are flown). */
function procPick(from: string, to: string): FlightPlanR {
  if (!from || !to || from === to) return null;
  const p = plansAll()[planKey(from, to)];
  return p && (p.depRwy || p.arrRwy || p.sid || p.star || p.app) ? p : null;
}
/** Changes whenever the plan does: the cached paths and profiles are made again. */
function planSig(from: string, to: string): string {
  const p = flightPlanFor(from, to), q = procPick(from, to);
  return (p ? '|plan' + p.v : '') + (q ? `|pk${q.depRwy || ''}>${q.arrRwy || ''}>${q.sid || ''}.${q.sidTr || ''}>${q.starTr || ''}.${q.star || ''}>${q.app || ''}.${q.appTr || ''}` : '');
}

/** A position as a waypoint name: 5530N02015W. */
function coordName(lat: number, lon: number): string {
  const dm = (v: number, w: number) => { const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); return String(m === 60 ? d + 1 : d).padStart(w, '0') + String(m === 60 ? 0 : m).padStart(2, '0'); };
  return dm(lat, 2) + (lat >= 0 ? 'N' : 'S') + dm(lon, 3) + (lon >= 0 ? 'E' : 'W');
}

/** A first plan: waypoints along the great circle about every 200 nm, at the level the aircraft would choose. */
function planDefault(from: string, to: string, typeId: string): FlightPlanR {
  const A = apt(from), B = apt(to); if (!A || !B) return null;
  const gc = gcDistanceNm(A.pos, B.pos), n = clamp(Math.round(gc / 200), 1, 14);
  let alt = 35000; try { alt = flightProfile(typeId, from, to).cruiseAlt; } catch (e) { /* the standard level */ }
  const wps: PlanWp[] = [];
  for (let i = 1; i <= n; i++) { const p = gcInterpolate(A.pos, B.pos, i / (n + 1)); wps.push({ id: uid(), name: coordName(p[1], p[0]), lat: p[1], lon: p[0], alt }); }
  return { key: planKey(from, to), from, to, wps, on: false, v: 1, at: Date.now(), typeId };
}
/** Save a plan (and everything flying it is worked out again). */
function planSave(p: FlightPlanR) {
  p.v = (p.v || 0) + 1; p.at = Date.now(); plansAll()[p.key] = p;
  try { for (const k in _profiles) if (k.indexOf('|' + p.from + '|' + p.to + '|') >= 0) delete _profiles[k]; } catch (e) { /* none cached */ }
  Store.soon();
}
/** The flight level as pilots say it (FL350), or feet below the transition. */
function altText(ft: number): string { return ft >= 18000 ? 'FL' + Math.round(ft / 100) : num(Math.round(ft / 100) * 100) + ' ft'; }

/** A plan from your SimBrief flight plan: its waypoints and airways (not the departure and arrival procedures,
 *  which the flight takes from the runway in use), the level at each (the cruise level through the climb, step
 *  climbs where SimBrief has them), its cruise speeds and its alternate. */
function planFromOfp(o: Ofp): FlightPlanR {
  if (!o || !o.from || !o.to || !apt(o.from) || !apt(o.to)) return null;
  const en = o.fixes.filter(x => !x.proc && x.type !== 'apt' && x.ident !== o.from && x.ident !== o.to);
  if (!en.length) return null;
  const cruise = o.cruiseFt || Math.max(...en.map(x => x.alt)) || 35000;
  let lvl = cruise; const wps: PlanWp[] = [];
  for (const x of en) {
    if (x.stage === 'CRZ' && x.alt >= 10000) lvl = x.alt;   // step climbs and descents in the cruise
    const w: PlanWp = { id: uid(), name: x.ident || coordName(x.lat, x.lon), lat: x.lat, lon: x.lon, alt: lvl, via: x.via && x.via !== 'DCT' ? x.via : '' };
    if (x.stage === 'CRZ') { if (x.mach) w.mach = Math.round(x.mach * 100) / 100; else if (x.ias) w.spd = Math.round(x.ias); }
    wps.push(w);
  }
  return { key: planKey(o.from, o.to), from: o.from, to: o.to, wps, altn: o.altn && apt(o.altn) ? o.altn : '', on: true, v: 1, at: Date.now(), src: 'simbrief' } as any;
}
