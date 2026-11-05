// The airline business around every flight, from real-world airline figures:
//  - Seasons: northern summer and Christmas are the busy times, January and February the quietest;
//    the southern hemisphere the other way round; ski airports peak in winter; Alaska's bush flying in
//    summer. The tropics stay about the same all year.
//  - Competing airlines fly many of the same routes. How many depends on the airports (two big hubs
//    have most), and it changes over the months. Passengers choose by price and by each airline's
//    popularity.
//  - Fuel costs differ by airport: cheapest in the Middle East and the US, dearer on islands, in remote
//    places and at small airports, and it moves a little from day to day. Fuel can be tankered: carried
//    from a cheaper airport for the next leg, at the cost of burning a little more to carry the weight.
//  - Airport charges: a landing fee by weight, parking and gate time on every turnaround, and hangar rent
//    every month for each aircraft at its base, higher at big hubs.
//  - Demand: the passengers who want to fly a route each day, by airport size, distance and season;
//    your share of them by your fares, your popularity, your marketing and your competitors.
//  - Your own fares per route for economy, business and first class, and cabin layouts per aircraft.
//  - Cargo: belly cargo on every passenger flight, freighter conversions, cargo rates by distance.
//  - What an aircraft is worth as it ages, for selling and for the used-aircraft market.

/** A well-mixed number from a text: close texts give unrelated numbers. */
function hashMix(str: string): number {
  let h = _hashStr(str);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

/* ---------- Seasons ---------- */
const SEASON_NORTH = [0.84, 0.86, 0.95, 1.0, 1.04, 1.12, 1.22, 1.22, 1.05, 0.98, 0.9, 1.06];
// ski resorts and the airports serving them
const SKI_AIRPORTS = ['LOWI', 'LOWS', 'LSGS', 'LSZS', 'LFLB', 'LFLS', 'LFLP', 'LIMJ', 'KEGE', 'KASE', 'KHDN', 'KSUN', 'KJAC', 'KMTJ', 'CYXC', 'ENSN', 'ESNZ', 'EFKT', 'EFRO', 'EFIV', 'RJCC', 'NZQN'];

function seasonFactor(icao: string, d?: Date): number {
  const A = apt(icao); if (!A) return 1;
  const m = (d || companyDateSafe()).getMonth(), lat = A.pos[1];
  if (SKI_AIRPORTS.indexOf(icao) >= 0) return [1.3, 1.32, 1.18, 0.96, 0.78, 0.86, 0.98, 0.98, 0.8, 0.82, 0.9, 1.25][m];
  if (icao[0] === 'P' && lat > 54) return [0.68, 0.7, 0.8, 0.9, 1.1, 1.32, 1.4, 1.36, 1.05, 0.82, 0.72, 0.8][m];
  if (Math.abs(lat) < 23) return m === 11 || m === 0 ? 1.08 : m === 6 || m === 7 ? 1.04 : 0.98;
  return lat >= 0 ? SEASON_NORTH[m] : SEASON_NORTH[(m + 6) % 12];
}
function routeSeason(from: string, to: string, d?: Date): number { return (seasonFactor(from, d) + seasonFactor(to, d)) / 2; }
function seasonLabel(f: number): string { return f >= 1.15 ? 'Peak season' : f >= 1.04 ? 'Busy season' : f <= 0.88 ? 'Quiet season' : 'Normal season'; }
function companyDateSafe(): Date { try { return companyDate(); } catch (e) { return new Date(); } }

/* ---------- Airports ---------- */
/** 2 big hub, 1 medium, 0 small (from the airport list, or the airline's own airports as medium). */
function aptSize(icao: string): number {
  const w: any = typeof World !== 'undefined' ? World.get(icao) : null;
  // airports the airline itself uses are never smaller than regional
  const own = AIRPORTS[icao] ? 1 : 0;
  if (w && w.size === 3) return own;   // seaplane bases
  if (w && typeof w.size === 'number') return Math.max(own, Math.min(2, Math.max(0, Math.round(w.size))));
  return own;
}
const SIZE_NAMES = ['Small airport', 'Regional airport', 'Major airport'];

/* ---------- Fuel price per airport (USD per kg of jet fuel) ---------- */
const FUEL_REGION: { [k: string]: number } = { K: 0.9, C: 0.96, P: 1.16, E: 1.0, L: 1.03, B: 1.16, O: 0.78, U: 0.9, V: 1.0, W: 1.02, R: 1.0, Z: 1.0, F: 1.18, G: 1.2, D: 1.2, H: 1.16, S: 1.08, M: 1.1, T: 1.12, Y: 1.04, N: 1.14, A: 1.12 };
const REMOTE_AIRPORTS = ['EKVG', 'BGSF', 'BGBW', 'BGGH', 'BIAR', 'BIEG', 'ENSB', 'ENBO', 'EGPA', 'EGPB', 'EGPL', 'LPAZ', 'LPLA', 'GCLA', 'PHTO', 'NTAA'];
function fuelPrice(icao: string, d?: Date): number {
  // a fixed price agreed with the supplier at your hub (airline-life.ts)
  try { const F: any = (State as any).life && (State as any).life.fuelFix; if (F && F.hub === icao && F.until > (d || new Date()).getTime() && F.cid === State.companyId) return F.price; } catch (e) { /* none */ }
  const day = (d || new Date()).toDateString(), base = 0.85 * (FUEL_REGION[icao[0]] || 1.05);
  const size = aptSize(icao), remote = REMOTE_AIRPORTS.indexOf(icao) >= 0 ? 1.1 : 1;
  const wobble = 1 + (((hashMix(icao[0] + day) % 1000) / 1000) - 0.5) * 0.08 + (((hashMix(icao + day) % 1000) / 1000) - 0.5) * 0.03;
  const mk = typeof marketIdx === 'function' ? marketIdx('fuel') : 1;
  const hedge = typeof hedgeFactor === 'function' ? hedgeFactor(State.companyId, mk) : 1;   // your fuel bought ahead (loyalty.ts)
  return Math.round(base * (size === 2 ? 1 : size === 1 ? 1.04 : 1.13) * remote * wobble * mk * hedge * 1000) / 1000;
}

/* ---------- Airport charges ---------- */
function mtowOf(t: AircraftType): number { return MTOW_T[t.cls] || 60; }
function landingFee(icao: string, t: AircraftType): number {
  const s = aptSize(icao), small = t.cls === 'bush' || t.cls === 'ga';
  return Math.max(small ? 10 : 60, Math.round(mtowOf(t) * (small ? 4 : s === 2 ? 11 : s === 1 ? 8 : 5.5)));
}
/** Parking and gate (or stand) time on a turnaround of about an hour. */
function parkingFee(icao: string, t: AircraftType): number {
  const s = aptSize(icao), small = t.cls === 'bush' || t.cls === 'ga';
  return small ? (s === 2 ? 25 : 8) : Math.round(mtowOf(t) * (s === 2 ? 2.4 : s === 1 ? 1.5 : 0.9) + (s === 2 ? 120 : 40));
}
const HANGAR_RENT: { [cls: string]: number } = { widebody: 18000, airliner: 8000, regional: 5500, turboprop: 4000, bush: 900, ga: 300 };
/** Hangar and stand rent at a base for a month, for the aircraft based there. */
function hangarRent(icao: string, list: Aircraft[]): number {
  const s = aptSize(icao), k = s === 2 ? 1.3 : s === 1 ? 1 : 0.7;
  return Math.round(list.reduce((t, a) => t + (HANGAR_RENT[acType(a.typeId).cls] || 3000), 0) * k);
}

/* ---------- Competing airlines (made-up names) ---------- */
const COMPETITOR_NAMES = ['Skyline Express', 'Aurora Connect', 'Polar Wings', 'Meridian Airways', 'Cobalt Jet', 'Northstar Regional', 'Seabreeze Air', 'Summit Airlines', 'Vector Air', 'Kestrel Airways', 'Bluefin Air', 'Granite Air', 'Tundra Air', 'Coastal Hop', 'Fjordline Air', 'Solstice Airways'];
interface Competitor { name: string; fare: number; quality: number; daily: number; since: string }

/** The other airlines on a route this month (the same answer for both directions). */
function competitorsOn(from: string, to: string, d?: Date): Competitor[] {
  if (!from || !to || from === to) return [];
  const k = [from, to].sort().join('-'), when = d || companyDateSafe(), month = when.getFullYear() * 12 + when.getMonth();
  const s = aptSize(from) + aptSize(to), bush = from[0] === 'P' && to[0] === 'P' && s < 3;
  const max = bush ? 1 : s >= 4 ? 3 : s >= 3 ? 2 : s >= 2 ? 1 : 0;
  // the market shifts every few months: an airline joins or pulls out
  const n = Math.min(max, (hashMix(k + Math.floor(month / 3)) % (max + 1)) + (s >= 4 ? 1 : 0));
  const out: Competitor[] = [];
  for (let i = 0; i < n; i++) {
    const h = hashMix(k + '|' + i), name = COMPETITOR_NAMES[h % COMPETITOR_NAMES.length];
    if (out.some(c => c.name === name)) continue;
    const startM = month - (h % 30);
    out.push({ name, fare: 0.82 + ((h >>> 4) % 31) / 100, quality: 40 + ((h >>> 9) % 46), daily: s >= 4 ? 2 + ((h >>> 13) % 5) : 1 + ((h >>> 13) % 2), since: `${Math.floor(startM / 12)}-${String(startM % 12 + 1).padStart(2, '0')}` });
  }
  return rivalApply(k, out);
}

/* ---------- Demand ---------- */
/** Passengers who want to fly between two airports each day, one way. */
function marketPax(from: string, to: string, d?: Date): number {
  const A = apt(from), B = apt(to); if (!A || !B || from === to) return 0;
  const sa = aptSize(from), sb = aptSize(to), nm = gcDistanceNm(A.pos, B.pos);
  const sizeK = [[20, 60, 160], [60, 180, 420], [160, 420, 1100]][sa][sb];
  const bush = from[0] === 'P' && to[0] === 'P' && sa + sb <= 1;
  const dist = nm < 60 ? 0.5 : nm < 300 ? 0.9 : nm < 1500 ? 1.1 : nm < 4000 ? 0.85 : 0.6;
  const fixed = 0.85 + (hashMix([from, to].sort().join('')) % 30) / 100;   // some city pairs are simply busier
  return Math.round((bush ? 22 : sizeK) * dist * fixed * routeSeason(from, to, d) * (typeof routeSpecial === 'function' ? routeSpecial(from, to, d) : 1));
}
function cargoMarketKg(from: string, to: string): number {
  const sa = aptSize(from), sb = aptSize(to);
  return Math.round([[300, 1200, 4000], [1200, 6000, 16000], [4000, 16000, 45000]][sa][sb] * (0.8 + (hashMix(to + from) % 40) / 100));
}

/** Your passengers' fares and theirs: the price passengers compare (1 = the usual market fare). */
function routeOf(cid: string, from: string, to: string): RouteDef {
  const rs = State.routes.filter(r => r.companyId === cid && !r.test);
  for (const r of rs) for (let i = 1; i < r.legs.length; i++) if (r.legs[i - 1] === from && r.legs[i] === to) return r;
  for (const r of rs) if (r.legs.indexOf(from) >= 0 && r.legs.indexOf(to) >= 0) return r;
  return null;
}
function routeFares(r: RouteDef): { y: number; j: number; f: number } { const f: any = r && (r as any).fares, k = typeof flexK === 'function' ? flexK(r) : 1; return { y: (f ? f.y : 1) * k, j: (f ? f.j : 1) * k, f: (f ? f.f : 1) * k }; }

/** Marketing that runs now for a route (or the whole airline): extra demand, 0.1 = 10%. */
function marketingBoost(cid: string, routeId?: string): number {
  const b = bankState(); if (!b) return 0;
  const now = Date.now();
  return b.campaigns.filter(c => c.companyId === cid && c.end > now && c.start <= now && (c.kind === 'airline' || c.routeId === routeId)).reduce((t, c) => t + c.boost, 0);
}

/** The share of a route's passengers who choose you, and how full that makes your flights. */
function routeOutlook(cid: string, from: string, to: string, seatsPerDay?: number): { market: number; share: number; pax: number; lf: number; comp: Competitor[]; fareIdx: number; season: number } {
  const c = company(cid), r = routeOf(cid, from, to), f = routeFares(r);
  const fareIdx = f.y, comp = competitorsOn(from, to), market = marketPax(from, to);
  const pop = (c && c.reputation != null ? c.reputation : 60) / 100;
  const boost = marketingBoost(cid, r ? r.id : null);
  const att = (q: number, fi: number) => (0.45 + q) * Math.pow(fi, -1.7);
  const you = att(pop, fareIdx) * (1 + boost) * (1 + (typeof ffPull === 'function' ? ffPull(cid) : 0));
  const them = comp.reduce((t, x) => t + att(x.quality / 100, x.fare), 0);
  // dearer fares also put some people off flying at all; cheaper ones bring extra travellers
  const total = market * Math.pow(fareIdx, -0.7) * (1 + boost * 0.5);
  const share = you / (you + them);
  const pax = total * share;
  const cap = seatsPerDay || 0;
  // flights fill up gradually: twice as many travellers as seats still leaves a few seats empty
  return { market, share, pax, lf: cap ? clamp(1 - Math.exp(-1.25 * pax / cap), 0.08, 0.97) : 0, comp, fareIdx, season: routeSeason(from, to) };
}

/** Seats you fly on a route each day, one way: the aircraft type's seats times its legs a day. */
function seatsPerDay(r: RouteDef): number {
  const t = acType(r.typeId); if (!t) return 1;
  const a0 = apt(r.legs[0]), a1 = apt(r.legs[1]);
  const nm = a0 && a1 ? gcDistanceNm(a0.pos, a1.pos) : 300;
  const block = nm / Math.max(100, t.cruiseKt) * 60 + 30;
  const legs = clamp(Math.floor(11 * 60 / (block + 45)), 1, 8);
  return Math.max(1, cabinSeats(t, null)) * Math.max(1, legs / Math.max(1, r.legs.length - 1));
}
/** Route demand on a 0-100 scale for the list: how full your flights would be. */
function routeDemandPct(r: RouteDef): number {
  if (r.test || r.legs.length < 2) return 0;
  let s = 0; for (let i = 1; i < r.legs.length; i++) s += routeOutlook(r.companyId, r.legs[i - 1], r.legs[i], seatsPerDay(r)).lf;
  return Math.round(s / (r.legs.length - 1) * 100);
}

/* ---------- Fares per class ---------- */
function economyFare(typeId: string, from: string, to: string): number {
  const t = acType(typeId), f = averageFare(typeId, from, to);
  return t && t.cls === 'widebody' ? Math.round(f / 1.25) : f;
}
function classFares(typeId: string, from: string, to: string, r?: RouteDef): { y: number; j: number; f: number } {
  const A = apt(from), B = apt(to), nm = A && B ? gcDistanceNm(A.pos, B.pos) : 500, y = economyFare(typeId, from, to), m = routeFares(r);
  const jk = nm < 800 ? 2.4 : nm < 2500 ? 3.2 : 4.2, fk = nm < 2500 ? 5 : 7;
  return { y: Math.round(y * m.y), j: Math.round(y * jk * m.j), f: Math.round(y * fk * m.f) };
}

/* ---------- Cabins ---------- */
interface Cabin { y: number; j: number; f: number; freighter?: boolean }
// seat space: a business seat takes the room of two economy seats, first class three
const CABIN_UNITS = { y: 1, j: 2, f: 3 };
function defaultCabin(t: AircraftType): Cabin {
  if (t.cls === 'widebody') { const j = Math.round(t.seats * 0.09); return { y: t.seats - j * 2, j, f: 0 }; }
  return { y: t.seats, j: 0, f: 0 };
}
function cabinOf(a: Aircraft): Cabin { const c: any = a && (a as any).cabin; return c ? c : defaultCabin(acType(a.typeId)); }
function cabinSeats(t: AircraftType, a: Aircraft): number { const c = a ? cabinOf(a) : defaultCabin(t); return c.freighter ? 0 : c.y + c.j + c.f; }
function cabinUnits(c: Cabin): number { return c.y * CABIN_UNITS.y + c.j * CABIN_UNITS.j + c.f * CABIN_UNITS.f; }
function cabinText(c: Cabin): string { return c.freighter ? 'Freighter' : [c.f ? c.f + ' first' : '', c.j ? c.j + ' business' : '', c.y + ' economy'].filter(Boolean).join(', '); }
function canHaveFirst(t: AircraftType): boolean { return t.cls === 'widebody'; }
function canHaveBusiness(t: AircraftType): boolean { return t.cls === 'widebody' || t.cls === 'airliner' || t.cls === 'regional'; }

/* ---------- Cargo ---------- */
const BELLY_KG: { [cls: string]: number } = { widebody: 18000, airliner: 2500, regional: 900, turboprop: 1000, bush: 150, ga: 30 };
const FREIGHT_PER_SEAT: { [cls: string]: number } = { widebody: 260, airliner: 115, regional: 95, turboprop: 120, bush: 125, ga: 70 };
function cargoCapacity(a: Aircraft): number {
  const t = acType(a.typeId), c = cabinOf(a);
  return c.freighter ? Math.round(t.seats * (FREIGHT_PER_SEAT[t.cls] || 100)) : (BELLY_KG[t.cls] || 500);
}
/** What a kilogram of cargo pays from one airport to another. */
function cargoRate(from: string, to: string, cls?: string): number {
  const A = apt(from), B = apt(to), nm = A && B ? gcDistanceNm(A.pos, B.pos) : 300;
  if (cls === 'bush' || cls === 'ga') return Math.round((1.6 + nm * 0.004) * 100) / 100;
  return Math.round(Math.max(0.6, 0.55 + nm * 0.0006) * 100) / 100;
}

/** The load of a hired pilot's flight: passengers by class and cargo, from demand on the route. */
function aiLoad(reg: string, from: string, to: string, leg: number): { pax: number; paxJ: number; paxF: number; cargoKg: number } {
  const a = plane(reg); if (!a) return { pax: 0, paxJ: 0, paxF: 0, cargoKg: 0 };
  const t = acType(a.typeId), cab = cabinOf(a), r = routeOf(a.companyId, from, to);
  const rnd = (k: string) => (hashMix(reg + leg + k) % 1000) / 1000;
  const cap = cargoCapacity(a);
  const cmk = cargoMarketKg(from, to) / Math.max(1, competitorsOn(from, to).length + 1);
  const cargoLf = clamp(cmk / Math.max(1, cap * 3) + 0.25, 0.2, 0.92) * (0.85 + rnd('c') * 0.3);
  if (cab.freighter) return { pax: 0, paxJ: 0, paxF: 0, cargoKg: Math.round(cap * clamp(cargoLf + 0.15, 0.3, 0.95)) };
  const o = routeOutlook(a.companyId, from, to, r ? seatsPerDay(r) : cabinSeats(t, a) * 3);
  const A = apt(from), B = apt(to), nm = A && B ? gcDistanceNm(A.pos, B.pos) : 500;
  // the services the airline offers make it a little more or less popular
  const svcD = typeof serviceEffects === 'function' ? serviceEffects(a.companyId, t.cls, nm, !isDomestic(from, to), 100, 10).demand : 1;
  const media = typeof mediaFactor === 'function' ? mediaFactor(a.companyId) : 1;   // a case in the news
  const lf = clamp(o.lf * svcD * media * (0.9 + rnd('p') * 0.2), 0.1, 1);
  // premium travellers: more of them on long flights and between big airports
  const big = (aptSize(from) + aptSize(to)) / 4, fares = routeFares(r);
  const jDemand = (nm > 1500 ? 0.12 : nm > 500 ? 0.07 : 0.04) * (0.7 + big * 0.6) * Math.pow(fares.j, -1.4);
  const fDemand = (nm > 3000 ? 0.025 : 0.008) * Math.pow(fares.f, -1.3);
  // your lounges at either end, and your frequent flyers, bring more premium travellers
  const prem = 1 + (typeof loungePull === 'function' ? loungePull(a.companyId, from, to) : 0) + (typeof ffPull === 'function' ? ffPull(a.companyId) : 0);
  const total = cab.y + cab.j + cab.f || 1;
  const paxJ = cab.j ? Math.min(cab.j, Math.round(total * lf * jDemand * prem * (0.85 + rnd('j') * 0.3))) : 0;
  const paxF = cab.f ? Math.min(cab.f, Math.round(total * lf * fDemand * prem * (0.8 + rnd('f') * 0.4))) : 0;
  const paxY = Math.min(cab.y, Math.round(cab.y * lf));
  return { pax: paxY + paxJ + paxF, paxJ, paxF, cargoKg: Math.round(cap * cargoLf * (nm > 2000 ? 1 : 0.7)) };
}

/* ---------- What an aircraft is worth ---------- */
/** Years since it first flew: kept for used aircraft, otherwise worked out from its hours. */
function aircraftAge(a: Aircraft): number {
  const A: any = a, t = acType(a.typeId);
  const perYear = ({ widebody: 4300, airliner: 3000, regional: 2600, turboprop: 2200, bush: 700, ga: 300 } as any)[t.cls] || 2500;
  const since = a.delivered ? Math.max(0, (Date.now() - Date.parse(a.delivered)) / (365.25 * 864e5)) : 0;
  return A.ageY != null ? A.ageY + since : Math.max(since, a.hoursMin / 60 / perYear);
}
/** Market value today: new price, less about 7% a year, less for poor condition and very high hours. */
function aircraftValue(a: Aircraft): number {
  const t = acType(a.typeId), age = aircraftAge(a);
  const cond = 0.55 + 0.45 * clamp(a.condition, 0, 100) / 100;
  return Math.round(t.price * Math.max(0.12, Math.pow(0.93, age)) * cond / 1000) * 1000;
}
const BROKER_FEE = 0.06;
function sellPrice(a: Aircraft): number { const d = typeof diff === 'function' ? diff() : { sell: 1 } as any; return Math.round(aircraftValue(a) * (1 - BROKER_FEE) * d.sell / 1000) * 1000; }
function fleetValue(cid: string): number { return fleetOf(cid).filter(a => !(a as any).lease).reduce((t, a) => t + aircraftValue(a), 0); }
