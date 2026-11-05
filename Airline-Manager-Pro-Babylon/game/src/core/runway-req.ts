// Which aircraft can use which runways. For each type: the take-off field length at maximum take-off
// weight and the landing field length at maximum landing weight (sea level, standard day, dry runway),
// the narrowest runway it is cleared for, and whether it can use grass or gravel. From the manufacturers'
// airport-planning documents and the aircraft's handbooks; see docs/reference/runway-requirements.txt.
// The distance needed follows the real weight of each flight (take-off roughly with the square of the
// weight, landing with the weight) and the airport's elevation (about 7% more per 1,000 ft for take-off,
// 5% for landing). Every aircraft type added to the app gets an entry here (see CLAUDE.md).

interface FieldSpec { to: number; ld: number; wid: number; rough?: boolean; water?: boolean }

const FIELD: { [typeId: string]: FieldSpec } = {
  'a320-fenix': { to: 2100, ld: 1500, wid: 30 },
  'a320neo': { to: 2100, ld: 1480, wid: 30 },
  'a350-ini': { to: 2600, ld: 2000, wid: 45 },
  'a310-ini': { to: 2400, ld: 1650, wid: 45 },
  'b738-pmdg': { to: 2300, ld: 1630, wid: 30 },
  'b736-pmdg': { to: 1800, ld: 1370, wid: 30 },
  'b77w-pmdg': { to: 3050, ld: 1900, wid: 45 },
  'b78x': { to: 2900, ld: 1800, wid: 45 },
  'b748': { to: 3100, ld: 2200, wid: 45 },
  'crj9-aero': { to: 1940, ld: 1600, wid: 30 },
  'crj7-aero': { to: 1700, ld: 1500, wid: 30 },
  'atr72': { to: 1330, ld: 915, wid: 23 },
  'dhc6-aero': { to: 450, ld: 520, wid: 10, rough: true },
  'dhc2': { to: 420, ld: 360, wid: 8, rough: true, water: true },
  'c208': { to: 600, ld: 530, wid: 10, rough: true },
  'kodiak': { to: 430, ld: 400, wid: 8, rough: true },
  'pc12': { to: 790, ld: 660, wid: 12, rough: true },
  'c172': { to: 500, ld: 410, wid: 8, rough: true },
  'a319neo': { to: 2000, ld: 1500, wid: 30 },
  'a321ceo': { to: 2210, ld: 1600, wid: 30 },
  'a321neo': { to: 2200, ld: 1750, wid: 30 },
  'a321lr': { to: 2400, ld: 1750, wid: 30 },
  'a321xlr': { to: 2600, ld: 1750, wid: 30 },
  'a330-800neo': { to: 2770, ld: 1900, wid: 45 },
  'a330-900neo': { to: 2770, ld: 1900, wid: 45 },
  'b737-max7': { to: 2100, ld: 1500, wid: 30 },
  'b737-max8': { to: 2500, ld: 1600, wid: 30 },
  'b737-max9': { to: 2700, ld: 1750, wid: 30 },
  'b737-max10': { to: 2800, ld: 1850, wid: 30 },
  'b787-8': { to: 2600, ld: 1700, wid: 45 },
  'b787-9': { to: 2800, ld: 1800, wid: 45 },
  'b777-9': { to: 3050, ld: 2000, wid: 45 },
  // helicopters: the take-off and landing area they need (1.5 × D, the largest dimension, rotors turning)
  'h125': { to: 19, ld: 19, wid: 13, rough: true },
  'h130': { to: 19, ld: 19, wid: 13, rough: true },
  'h135': { to: 18, ld: 18, wid: 12, rough: true },
  'h145': { to: 20, ld: 20, wid: 14, rough: true },
  'h160': { to: 24, ld: 24, wid: 16, rough: true },
  'h175': { to: 27, ld: 27, wid: 18, rough: true },
  'bell407': { to: 19, ld: 19, wid: 13, rough: true },
  'bell429': { to: 20, ld: 20, wid: 13, rough: true },
  'bell505': { to: 19, ld: 19, wid: 13, rough: true },
  'bell525': { to: 30, ld: 30, wid: 20, rough: true },
  'aw109': { to: 19, ld: 19, wid: 13, rough: true },
  'aw139': { to: 25, ld: 25, wid: 17, rough: true },
  'aw169': { to: 22, ld: 22, wid: 15, rough: true },
  'aw189': { to: 26, ld: 26, wid: 18, rough: true },
  's76d': { to: 24, ld: 24, wid: 16, rough: true },
  's92': { to: 31, ld: 31, wid: 21, rough: true },
};

function fieldSpec(typeId: string): FieldSpec {
  if (FIELD[typeId]) return FIELD[typeId];
  const t = acType(typeId) || AIRCRAFT[0];
  const by: { [c: string]: string } = { widebody: 'b78x', airliner: 'a320neo', regional: 'crj9-aero', turboprop: 'atr72', bush: 'c208', ga: 'c172' };
  return FIELD[by[t.cls] || 'a320neo'];
}

/** The take-off performance of the engine on the aircraft being checked now (1 = the type's usual engine). */
let RW_PERF = 1;
const PAVED = /ASP|CON|BIT|PEM|ASF|PAV|TAR|SEAL|MAC/i;

/** The airport's longest runway this type may use (surface and width), in metres; null without runway data. */
function usableRunway(typeId: string, icao: string): { name: string; len: number; wid: number; surf: string; all: number } {
  const rows: any[] = ((World.runways || {})[icao] || []) as any[];
  if (!World.runways || !rows.length) return null;
  const F = fieldSpec(typeId);
  let best: any = null;
  for (const r of rows) {
    const len = (r[2] || 0) * 0.3048, wid = (r[3] || 0) * 0.3048, surf = String(r[4] || '');
    const heli = typeof isHeli === 'function' && isHeli(typeId);
    if (!heli && (/^H/.test(String(r[0] || '')) || len < 100)) continue;          // helipads (helicopters use them, and any runway)
    if (!PAVED.test(surf) && !F.rough && surf) continue;              // grass and gravel: light aircraft only
    if (!heli && wid && wid < F.wid - 1.5) continue;            // runway widths are listed in whole feet: allow for rounding
    if (!best || len > best.len) best = { name: `${r[0]}/${r[1]}`, len, wid, surf };
  }
  const all = Math.max(0, ...rows.map(r => (r[2] || 0) * 0.3048));
  return best ? Object.assign(best, { all }) : { name: '', len: 0, wid: 0, surf: '', all };
}

/** Runway needed for take-off and landing at given weights (t) and airport elevations (ft). */
function runwayNeed(typeId: string, tow: number, lw: number, depElevFt: number, arrElevFt: number): { to: number; ld: number } {
  const F = fieldSpec(typeId), S = speedSpec(typeId);
  // an engine with more take-off thrust (RW_PERF, for the aircraft being checked) needs less runway, more so up high
  const pf = RW_PERF || 1;
  const to = F.to * Math.pow(clamp(tow / S.mtow, 0.45, 1), 2) * (1 + 0.07 / Math.pow(pf, 3) * Math.max(0, depElevFt) / 1000) / pf;
  const ld = F.ld * clamp(lw / S.mlw, 0.6, 1) * (1 + 0.05 * Math.max(0, arrElevFt) / 1000);
  return { to: Math.round(to), ld: Math.round(ld) };
}

/** Can this type fly from one airport to another with this many passengers? With `maxPax`, the most it
 *  can take when the runways limit the weight (a payload-limited flight). */
function legRunwayCheck(typeId: string, from: string, to: string, pax?: number, cargoKg?: number): { ok: boolean; why: string; maxPax: number; full: boolean } {
  const t = acType(typeId) || AIRCRAFT[0], seats = pax == null ? t.seats : pax;
  if (t.cls !== 'helicopter') for (const k of [from, to]) if (isHelipad(k)) return { ok: false, why: `${k} is a ${helipadKind(k).toLowerCase() === 'helipad' ? 'helipad' : helipadKind(k).toLowerCase() + ' helipad'}: helicopters only`, maxPax: 0, full: false };
  if (t.cls === 'helicopter') return { ok: true, why: '', maxPax: seats, full: true };   // helicopters land on any pad or runway
  if (!World.runways) return { ok: true, why: '', maxPax: seats, full: true };
  const A: any = apt(from), B: any = apt(to); if (!A || !B) return { ok: true, why: '', maxPax: seats, full: true };
  const rd = usableRunway(typeId, from), ra = usableRunway(typeId, to), F = fieldSpec(typeId);
  const name = acType(typeId).model, m = (x: number) => num(Math.round(x)) + ' m';
  for (const [r, k] of [[rd, from], [ra, to]] as [any, string][]) {
    if (r && !r.len) {
      const why = r.all ? `${k}'s runways are too narrow or unpaved for the ${name} (needs ${F.wid} m wide${F.rough ? '' : ', paved'})` : `${k} has no runway for the ${name}`;
      return { ok: false, why, maxPax: 0, full: false };
    }
  }
  const dist = gcDistanceNm(A.pos, B.pos);
  const fits = (p: number) => { const W = flightWeights(typeId, p, dist, cargoKg != null ? cargoKg / 1000 : undefined), need = runwayNeed(typeId, W.tow, W.lw, A.elev || 0, B.elev || 0); return { need, ok: (!rd || need.to <= rd.len) && (!ra || need.ld <= ra.len) }; };
  const full = fits(seats);
  if (full.ok) return { ok: true, why: '', maxPax: seats, full: true };
  // the most passengers that still fit both runways
  let lo = 0, hi = seats;
  if (!fits(0).ok) {
    const n0 = fits(0).need, short = rd && n0.to > rd.len ? `take-off needs ${m(n0.to)}, ${from} has ${m(rd.len)}` : `landing needs ${m(n0.ld)}, ${to} has ${m(ra.len)}`;
    return { ok: false, why: `Runway too short for the ${name}: ${short}`, maxPax: 0, full: false };
  }
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (fits(mid).ok) lo = mid; else hi = mid; }
  const n = full.need, short = rd && n.to > rd.len ? `take-off at full load needs ${m(n.to)}, ${from} has ${m(rd.len)}` : `landing at full load needs ${m(n.ld)}, ${to} has ${m(ra.len)}`;
  if (lo < Math.max(1, t.seats * 0.2)) return { ok: false, why: `Runway too short for the ${name}: ${short}`, maxPax: lo, full: false };
  return { ok: true, why: `Payload limited: ${short}, so at most ${lo} passengers`, maxPax: lo, full: false };
}

/** A whole route: the first leg that can't be flown (empty when every leg can). */
function routeRunwayProblem(typeId: string, legs: string[]): string {
  for (let i = 0; i < legs.length; i++) {
    const a = legs[i], b = legs[(i + 1) % legs.length]; if (!a || !b || a === b) continue;
    const c = legRunwayCheck(typeId, a, b); if (!c.ok) return c.why;
  }
  return '';
}
