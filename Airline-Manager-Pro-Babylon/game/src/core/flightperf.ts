// How long a real flight takes, minute by minute: taxi, take-off, climb on the real speed schedule
// (250 kt below 10,000 ft, then climb speed and Mach), cruise at a flight level that suits the
// distance and direction, descent and approach. Distances follow airways and departure/arrival
// procedures rather than the straight line, and the jet stream speeds up eastbound flights and
// slows down westbound ones. Hired pilots' flights are flown along this profile on the real clock.

interface PerfSpec {
  maxAlt: number;        // highest usual cruise altitude (ft)
  jet: boolean;
  mach: number;          // cruise Mach (jets)
  climbIas: number; climbMach: number; descIas: number;
  rocSL: number; rocTop: number;   // climb rate near the ground and near cruise altitude (ft/min)
  rod: number;           // descent rate (ft/min)
  appKt: number;         // final approach speed
  taxiOut: number; taxiIn: number; // minutes
  airway: number;        // distance flown along airways compared with the straight line
  procNm: number;        // extra miles for departure and arrival procedures
  climbPerNm: number; altBase: number; // cruise altitude for short legs: altBase + distance × climbPerNm
  // descent planning as flown in the real world: miles per 1,000 ft to lose, extra miles to slow down,
  // and how far out the aircraft is established on final (on the 3° glide path, about 318 ft per mile)
  descK: number; decelNm: number; finalNm: number;
}

interface ProfilePoint { s: number; d: number; alt: number; gs: number; ph: string }
interface FlightProfile { pts: ProfilePoint[]; totalS: number; routeNm: number; cruiseAlt: number; airS: number }

// International Standard Atmosphere: speed of sound and true airspeed from indicated airspeed
function _isaTheta(h: number) { return Math.max(0.7519, 1 - 6.8756e-6 * h); }
function soundKt(h: number) { return 661.47 * Math.sqrt(_isaTheta(h)); }
function iasToTas(ias: number, h: number) {
  const sigma = h <= 36089 ? Math.pow(1 - 6.8756e-6 * h, 4.2559) : 0.2971 * Math.exp(-(h - 36089) / 20806);
  return ias / Math.sqrt(sigma);
}

function perfFor(t: AircraftType): PerfSpec {
  const base = perfForClass(t), name = t.maker + ' ' + t.model + ' ' + t.variant;
  for (const m of MODEL_PERF) if (m.re.test(name)) return Object.assign(base, m.p);
  return base;
}

/** Defaults by size class, for models not in MODEL_PERF. */
function perfForClass(t: AircraftType): PerfSpec {
  const kt = t.cruiseKt;
  // heavy four-engine and 777-size aircraft start lower and step-climb later; the newer twins go higher sooner
  // helicopters: low (1,500-3,000 ft), direct, no taxi to speak of, steep approaches to the pad
  if (t.cls === 'helicopter') return { maxAlt: kt > 145 ? 3500 : 2500, jet: false, mach: 0, climbIas: Math.round(kt * 0.6), climbMach: 0, descIas: Math.round(kt * 0.95), rocSL: 1000, rocTop: 700, rod: 700, appKt: 45, taxiOut: 2, taxiIn: 1, airway: 1.01, procNm: 1,
    climbPerNm: 60, altBase: 800, descK: 3.2, decelNm: 0, finalNm: 1 };
  if (t.cls === 'widebody') return { maxAlt: t.seats >= 350 ? 35000 : 37000, jet: true, mach: kt / soundKt(36000), climbIas: 310, climbMach: 0.84, descIas: 290, rocSL: 2800, rocTop: 800, rod: 2300, appKt: 148, taxiOut: 17, taxiIn: 8, airway: 1.06, procNm: 28, climbPerNm: 85, altBase: 9000, descK: 3.3, decelNm: 12, finalNm: 11 };
  if (t.cls === 'airliner') return { maxAlt: 37000, jet: true, mach: kt / soundKt(36000), climbIas: 290, climbMach: 0.76, descIas: 280, rocSL: 3000, rocTop: 1000, rod: 2300, appKt: 138, taxiOut: 14, taxiIn: 7, airway: 1.045, procNm: 22, climbPerNm: 85, altBase: 9000, descK: 3.0, decelNm: 10, finalNm: 10 };
  if (t.cls === 'regional') return { maxAlt: 35000, jet: true, mach: kt / soundKt(35000), climbIas: 290, climbMach: 0.74, descIas: 280, rocSL: 3300, rocTop: 900, rod: 2200, appKt: 138, taxiOut: 11, taxiIn: 6, airway: 1.04, procNm: 16, climbPerNm: 90, altBase: 8000, descK: 3.0, decelNm: 8, finalNm: 9 };
  if (t.cls === 'turboprop' || kt >= 250) return { maxAlt: t.cls === 'turboprop' ? 25000 : 26000, jet: false, mach: 0, climbIas: 170, climbMach: 0, descIas: 235, rocSL: 1700, rocTop: 500, rod: 1500, appKt: 112, taxiOut: 9, taxiIn: 5, airway: 1.03, procNm: 10, climbPerNm: 80, altBase: 4000, descK: t.cls === 'turboprop' ? 3.0 : 3.2, decelNm: t.cls === 'turboprop' ? 4 : 3, finalNm: t.cls === 'turboprop' ? 8 : 6 };
  // piston singles, Caravans, Otters and Beavers: low, slow and mostly direct
  const top = clamp(Math.round((kt - 100) * 110 / 500) * 500 + 3500, 4500, 12500);
  return { maxAlt: top, jet: false, mach: 0, climbIas: Math.round(kt * 0.62), climbMach: 0, descIas: Math.round(kt * 1.02), rocSL: kt > 160 ? 1000 : 700, rocTop: kt > 160 ? 550 : 400, rod: 600, appKt: Math.round(kt * 0.55), taxiOut: 5, taxiIn: 3, airway: 1.015, procNm: 2, climbPerNm: 60, altBase: 2500,
    // a cruise descent at about 500-700 ft/min, then a visual final of about 3 miles from the traffic pattern
    descK: clamp(kt / 60 / (kt > 160 ? 700 : 500) * 1000, 3.5, 4.5), decelNm: 0, finalNm: 3 };
}

// Real-world numbers per aircraft model, laid over the size-class defaults above. Matched on maker,
// model and variant, so add-ons and aircraft detected in the sim get them too.
//   maxAlt   usual initial cruise level (heavy long-haul jets start lower and step-climb later)
//   descIas  descent speed above 10,000 ft (below it: 250 kt or less)
//   appKt    final approach speed (around Vref + 5)
//   descK    miles per 1,000 ft in the descent (the 3:1 rule; heavier and cleaner jets glide further)
//   decelNm  extra miles to slow down for the approach
//   finalNm  miles from the runway where it is established on final (ILS intercept, or a visual final)
// With these, an A320 or 737 at FL370 starts down about 120 nm out, a 777 or 747 about 125-135 nm,
// a CRJ about 110 nm, an ATR at FL250 about 80 nm and a Cessna at 6,500 ft about 25 nm.
const MODEL_PERF: { re: RegExp; p: Partial<PerfSpec> }[] = [
  // Airbus
  { re: /airbus.*a380/i,               p: { maxAlt: 35000, descIas: 300, appKt: 140, descK: 3.4, decelNm: 13, finalNm: 12 } },
  { re: /airbus.*a35\d/i,              p: { maxAlt: 37000, descIas: 300, appKt: 142, descK: 3.3, decelNm: 12, finalNm: 11 } },
  { re: /airbus.*a33\d/i,              p: { maxAlt: 37000, descIas: 300, appKt: 140, descK: 3.3, decelNm: 12, finalNm: 11 } },
  { re: /airbus.*a3(00|10)/i,            p: { maxAlt: 35000, descIas: 290, appKt: 138, descK: 3.2, decelNm: 11, finalNm: 10 } },
  { re: /airbus.*a32\d.*neo|a32\dn/i,  p: { maxAlt: 37000, descIas: 290, appKt: 135, descK: 3.0, decelNm: 10, finalNm: 10 } },
  { re: /airbus.*a3(18|19|20|21)/i,    p: { maxAlt: 37000, descIas: 290, appKt: 137, descK: 3.0, decelNm: 10, finalNm: 10 } },
  { re: /airbus.*a220|bombardier.*cs[13]00/i, p: { maxAlt: 39000, descIas: 290, appKt: 128, descK: 3.0, decelNm: 9, finalNm: 9 } },
  // Boeing
  { re: /boeing.*747/i,                p: { maxAlt: 33000, descIas: 310, appKt: 158, descK: 3.4, decelNm: 13, finalNm: 12 } },
  { re: /boeing.*777/i,                p: { maxAlt: 33000, descIas: 310, appKt: 152, descK: 3.4, decelNm: 12, finalNm: 12 } },
  { re: /boeing.*787/i,                p: { maxAlt: 37000, descIas: 300, appKt: 148, descK: 3.3, decelNm: 12, finalNm: 11 } },
  { re: /boeing.*767/i,                p: { maxAlt: 35000, descIas: 290, appKt: 142, descK: 3.2, decelNm: 11, finalNm: 11 } },
  { re: /boeing.*757/i,                p: { maxAlt: 37000, descIas: 290, appKt: 135, descK: 3.1, decelNm: 10, finalNm: 10 } },
  { re: /boeing.*737.*(max|-[789]\b)|737-[89]|737 max/i, p: { maxAlt: 37000, descIas: 280, appKt: 147, descK: 3.0, decelNm: 10, finalNm: 10 } },
  { re: /boeing.*737/i,                p: { maxAlt: 37000, descIas: 280, appKt: 135, descK: 3.0, decelNm: 10, finalNm: 10 } },
  // regional jets
  { re: /crj.?(900|1000)|crj9/i,       p: { maxAlt: 35000, descIas: 290, appKt: 142, descK: 3.0, decelNm: 8, finalNm: 9 } },
  { re: /crj/i,                        p: { maxAlt: 35000, descIas: 290, appKt: 138, descK: 3.0, decelNm: 8, finalNm: 9 } },
  { re: /embraer.*(e?19\d|e2)/i,       p: { maxAlt: 37000, descIas: 290, appKt: 135, descK: 3.0, decelNm: 8, finalNm: 9 } },
  { re: /embraer.*(e?17\d)/i,          p: { maxAlt: 37000, descIas: 290, appKt: 130, descK: 3.0, decelNm: 8, finalNm: 9 } },
  // business jets
  { re: /citation|learjet|phenom|praetor|challenger|global|gulfstream|falcon|hondajet/i, p: { maxAlt: 41000, descIas: 280, appKt: 115, descK: 3.0, decelNm: 7, finalNm: 8 } },
  // turboprops
  { re: /atr\s*72/i,                   p: { maxAlt: 23000, descIas: 240, appKt: 113, descK: 3.0, decelNm: 4, finalNm: 8 } },
  { re: /atr\s*42/i,                   p: { maxAlt: 21000, descIas: 235, appKt: 108, descK: 3.0, decelNm: 4, finalNm: 8 } },
  { re: /dash\s*8|q400|dhc-8/i,        p: { maxAlt: 25000, descIas: 245, appKt: 120, descK: 3.0, decelNm: 5, finalNm: 8 } },
  { re: /saab|jetstream|beech.*1900/i, p: { maxAlt: 21000, descIas: 230, appKt: 115, descK: 3.0, decelNm: 4, finalNm: 7 } },
  { re: /pc-?12/i,                     p: { maxAlt: 26000, descIas: 235, appKt: 90,  descK: 3.2, decelNm: 3, finalNm: 6 } },
  { re: /tbm/i,                        p: { maxAlt: 28000, descIas: 240, appKt: 88,  descK: 3.2, decelNm: 3, finalNm: 6 } },
  { re: /king\s*air/i,                 p: { maxAlt: 25000, descIas: 230, appKt: 105, descK: 3.2, decelNm: 3, finalNm: 6 } },
  // utility and bush aircraft: low, slow, often a visual final
  { re: /caravan|208/i,                p: { maxAlt: 10000, descIas: 165, appKt: 82,  descK: 3.6, decelNm: 1, finalNm: 4 } },
  { re: /kodiak/i,                     p: { maxAlt: 11000, descIas: 160, appKt: 78,  descK: 3.6, decelNm: 1, finalNm: 4 } },
  { re: /twin otter|dhc-6/i,           p: { maxAlt: 8000,  descIas: 145, appKt: 80,  descK: 3.8, decelNm: 1, finalNm: 3 } },
  { re: /beaver|dhc-2/i,               p: { maxAlt: 5500,  descIas: 120, appKt: 65,  descK: 4.0, decelNm: 0, finalNm: 2 } },
  // light singles and twins
  { re: /cessna.*1[5-8]\d|skyhawk|skylane|piper|cherokee|archer|diamond|da[24]0|cirrus|sr2\d/i, p: { maxAlt: 6500, descIas: 115, appKt: 65, descK: 3.8, decelNm: 0, finalNm: 2 } },
];

/** Cruise true airspeed at an altitude: the cruise Mach for jets, the book cruise speed (a little slower down low) for propellers. */
function cruiseTas(P: PerfSpec, t: AircraftType, h: number) {
  if (P.jet) return Math.min(P.mach * soundKt(h), iasToTas(h < 10000 ? 250 : 320, h));
  return t.cruiseKt * clamp(1 - 0.018 * (P.maxAlt - h) / 1000, 0.75, 1.02);
}

function bearingDeg(a: number[], b: number[]) {
  const r = Math.PI / 180, f1 = a[1] * r, f2 = b[1] * r, dl = (b[0] - a[0]) * r;
  const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) / r + 360) % 360;
}

/** West-to-east jet stream: strongest around 40-45° latitude, at cruise altitude and in winter. Returns the tailwind in knots. */
function tailwindKt(h: number, lat: number, track: number, month: number) {
  const north = lat >= 0, season = 1 + 0.35 * Math.cos(2 * Math.PI * ((north ? month : month + 6) % 12) / 12);
  const w = 60 * Math.pow(clamp(h / 34000, 0, 1.15), 1.3) * Math.exp(-Math.pow((Math.abs(lat) - 42) / 16, 2)) * season;
  return w * Math.sin(track * Math.PI / 180);
}

// Large hubs with long taxi routes (minutes added to taxi out and taxi in)
const BIG_HUBS: { [icao: string]: number } = { EGLL: 9, KJFK: 10, EDDF: 7, LFPG: 8, EHAM: 8, OMDB: 7, KBOS: 4, CYYZ: 6, KSEA: 4, LEMD: 5, LIRF: 4, EKCH: 3, ESSA: 3, ENGM: 3 };

const _profiles: { [k: string]: FlightProfile } = {};

/** The whole flight from off-blocks to on-blocks, sampled about every 20 seconds. */
function flightProfile(typeId: string, from: string, to: string, when?: number): FlightProfile {
  const month = new Date(when || Date.now()).getMonth();
  const CLS = awyClass(typeId), key = typeId + '|' + from + '|' + to + '|' + month + planSig(from, to) + (planSig(from, to) ? '' : AirwayRoutes.sig(from, to, CLS));
  if (_profiles[key]) return _profiles[key];
  const t = acType(typeId) || AIRCRAFT[0];
  // where the airports are: from the airport list, or from their runways; if neither is known yet (the world
  // list still loading), the profile is worked out but not kept, so it is made again with the real distance
  const at = (k: string): any => { const a = apt(k); if (a && a.pos) return a; try { const r: any = World.runways ? activeRunway(k) : null; return r && r.thr ? { pos: r.thr } : null; } catch (e) { return null; } };
  const A = at(from), B = at(to); let keep = !!(A && B);
  // the type's own climb and descent speeds and flap schedule (flight-configs.ts), over the model defaults
  const CF: ConfigSpec = typeof FLIGHT_CONFIGS !== 'undefined' ? FLIGHT_CONFIGS[typeId] : null;
  const P = Object.assign({}, perfFor(t), CF ? { climbIas: CF.climbIas || undefined, descIas: CF.descIas || undefined } : {}) as PerfSpec;
  if (!P.climbIas) P.climbIas = perfFor(t).climbIas; if (!P.descIas) P.descIas = perfFor(t).descIas;
  if (CF && CF.climbMach) P.climbMach = CF.climbMach;
  const gc = A && B ? gcDistanceNm(A.pos, B.pos) : 200;
  // a flight plan from the planner: flown along its path, at its levels and speeds
  const PL = flightPlanFor(from, to), AWR = !PL ? AirwayRoutes.get(from, to, CLS) : null;
  let FPH: FlightPath = null; try { FPH = PL || AWR ? flightPathFor(from, to, false, CLS) : null; } catch (e) { FPH = null; }
  const plan = PL && FPH && FPH.wpD ? PL : null, onAwy = !PL && AWR && FPH && (FPH as any).awy ? true : false;
  if (AWR && !onAwy) keep = false;
  if (PL && !plan) keep = false;   // the runways not known yet: worked out again with the plan once they are
  if (plan && plan.climbIas) P.climbIas = plan.climbIas;
  if (plan && plan.descIas) P.descIas = plan.descIas;
  const routeNm = plan || onAwy ? FPH.len : Math.max(3, gc * P.airway + (gc > 40 ? P.procNm : gc * 0.05));
  const track0 = A && B ? bearingDeg(A.pos, B.pos) : 90;
  const latAt = (frac: number) => plan || onAwy ? pathAt(FPH, frac * FPH.len).pos[1] : A && B ? gcInterpolate(A.pos, B.pos, clamp(frac, 0, 1))[1] : 50;
  const trackAt = (frac: number) => plan || onAwy ? pathAt(FPH, frac * FPH.len).hdg : A && B && gc > 5 ? bearingDeg(gcInterpolate(A.pos, B.pos, clamp(frac, 0, 0.99)), B.pos) : track0;
  // the plan's waypoints in order along the path: the level (and speed) to fly from each one on
  const pw = plan ? plan.wps.filter(w => FPH.wpD[w.id] != null).map(w => ({ d: FPH.wpD[w.id], w })).sort((a, b) => a.d - b.d) : [];
  const planAt = (d: number) => { let r = pw[0]; for (const x of pw) if (x.d <= d + 0.01) r = x; return r ? r.w : null; };
  const wind = (h: number, d: number) => tailwindKt(h, latAt(d / routeNm), trackAt(d / routeNm), month);

  // Descent as planned in the real world, worked out from the runway: established on final at
  // finalNm on the 3° glide path, then back up at descK miles per 1,000 ft with decelNm extra miles
  // to slow down below 10,000 ft (250 kt), up to the cruise level. That gives the top of descent:
  // about 120 nm for an A320 or 737 at FL370, 125-135 nm for the big twins and four-engine jets,
  // about 110 nm for a CRJ, 80 nm for an ATR at FL250, 25-35 nm for a Cessna or Twin Otter.
  const GLIDE = 318;   // ft per nm on a 3° path
  // take-off roll and landing roll from the type's speeds (docs/reference), at a typical 80% load
  const SPD = flightSpeeds(typeId, Math.round(t.seats * 0.8), gc), accel = P.jet ? 2.0 : 2.4, decel = P.jet ? 1.9 : 1.6;
  // the arrival's and approach's altitude and speed limits at their fixes (published, or built from navaids), as
  // [miles to go, altitude rule, altitude, speed]: the descent is planned to meet them, as crews do
  const cons: [number, string, number, number][] = [];
  try {
    const PP: any = FPH || (A && B ? flightPathFor(from, to, false, CLS) : null);
    if (PP && PP.fixes && PP.len > 0) {
      const k = routeNm / PP.len, arrStart = (PP.parts.filter((x: any) => x.kind === 'star')[0] || { from: PP.len * 0.6 }).from;
      for (const f of PP.fixes as ProcFix[]) {
        if (!f.alt && !f.spd) continue;
        let bi = 0, bd = 1e9; for (let i = 0; i < PP.pts.length; i += 1) { const d = gcDistanceNm(PP.pts[i], f.pos); if (d < bd) { bd = d; bi = i; } }
        if (bd > 3 || PP.cum[bi] < arrStart - 1) continue;   // the departure's limits are for the climb
        const elev = ((apt(to) as any) || {}).elev || 0;
        const ad = f.ad === 'I' || f.ad === 'J' ? '+' : f.ad === 'G' || f.ad === 'H' || f.ad === 'V' ? '@' : f.ad || '';   // glide slope intercept: at or above
        cons.push([(PP.len - PP.cum[bi]) * k, ad, f.alt ? Math.max(0, f.alt - elev) : 0, f.spd || 0]);
      }
    }
  } catch (e) { /* no procedure known */ }
  const descPlan = (top: number) => {
    const finalAlt = Math.min(top, P.finalNm * GLIDE), low = Math.min(top, 10000);
    // [miles out, altitude, indicated speed]: on the final in the landing configuration; before it, slowing
    // through the flap steps from the clean speed (the type's own schedule when known)
    const landStep = CF && CF.steps.length ? CF.steps[CF.steps.length - 1].at : 0, preStep = CF && CF.steps.length > 1 ? CF.steps[CF.steps.length - 2].at : 0;
    const nodes: number[][] = [[0, 0, SPD.vthr], [P.finalNm, finalAlt, CF ? Math.max(SPD.vapp + 5, Math.min(preStep || landStep + 15, SPD.vapp + (P.jet ? 25 : 15))) : SPD.vapp + (P.jet ? 25 : 15)]];
    if (CF && P.jet) nodes.push([P.finalNm + 4, Math.min(top, finalAlt + 1200), Math.min(250, CF.clean)]);
    const lowNm = P.finalNm + Math.max(0, low - finalAlt) / 1000 * P.descK + P.decelNm * Math.min(1, low / 10000);
    nodes.push([lowNm, low, P.jet ? 250 : Math.min(P.descIas, 250)]);
    if (top > low) nodes.push([lowNm + (top - low) / 1000 * P.descK, top, P.descIas]);
    nodes.sort((a, b) => a[0] - b[0]);
    // the procedure's limits: at or below, at, between (never above) and at or above (never below) at each fix,
    // and the speed limits, worked in where the fix is; never steeper than the type can descend
    const at0 = (dn: number, k: number) => { for (let i = 1; i < nodes.length; i++) if (dn <= nodes[i][0]) { const a = nodes[i - 1], b = nodes[i], f = (dn - a[0]) / ((b[0] - a[0]) || 1); return a[k] + (b[k] - a[k]) * f; } return nodes[nodes.length - 1][k]; };
    for (const [dn, ad, alt, spd] of cons) {
      if (dn <= P.finalNm * 0.5 || dn >= nodes[nodes.length - 1][0]) continue;
      let h = at0(dn, 1), v = at0(dn, 2);
      if (alt) { if ((ad === '-' || ad === '@' || ad === '' || ad === 'B') && h > alt) h = alt; if ((ad === '+' || ad === '@' || ad === '') && h < alt) h = Math.min(top, alt); }
      if (spd && v > spd) v = spd;
      if (h !== at0(dn, 1) || v !== at0(dn, 2)) nodes.push([dn, Math.min(top, Math.max(0, h)), v]);
    }
    nodes.sort((a, b) => a[0] - b[0]);
    if (cons.length) { for (let i = nodes.length - 2; i >= 0; i--) if (nodes[i][1] > nodes[i + 1][1]) nodes[i][1] = nodes[i + 1][1]; }   // never higher nearer the runway
    else for (let i = 1; i < nodes.length; i++) if (nodes[i][1] < nodes[i - 1][1]) nodes[i][1] = nodes[i - 1][1];
    const todNm = nodes[nodes.length - 1][0];
    // approach starts at 10,000 ft for airliners and turboprops, about 10 miles out for light aircraft
    const apprNm = P.jet || P.maxAlt > 15000 ? lowNm : Math.min(todNm, P.finalNm + 7);
    const at = (dn: number, k: number) => { for (let i = 1; i < nodes.length; i++) if (dn <= nodes[i][0]) { const a = nodes[i - 1], b = nodes[i], f = (dn - a[0]) / ((b[0] - a[0]) || 1); return a[k] + (b[k] - a[k]) * f; } return nodes[nodes.length - 1][k]; };
    // fly it from the top of descent to the runway in half-mile steps
    const steps: { dd: number; dt: number; h: number; gs: number; ph: string }[] = [];
    let s = 0;
    for (let dn = todNm; dn > 1e-6;) {
      const dd = Math.min(0.5, dn), mid = dn - dd / 2, h = at(mid, 1), ias = at(mid, 2);
      let tas = iasToTas(ias, h);
      if (P.jet) tas = Math.min(tas, P.mach * soundKt(h));
      else if (h > 4000) tas = Math.min(tas, cruiseTas(P, t, h) * 1.08);
      const gs = Math.max(45, tas + wind(h, routeNm - mid) * 0.9), dt = dd / gs * 3600;
      dn -= dd; s += dt;
      steps.push({ dd, dt, h: at(dn, 1), gs, ph: dn < P.finalNm ? 'Final' : dn < apprNm ? 'Approach' : 'Descent' });
    }
    return { todNm, steps, s };
  };
  const climbTo = (top: number) => {
    let h = 0, d = 0, s = 0;
    while (h < top) {
      const dh = Math.min(250, top - h);
      // V2 + 10 to about 1,000 ft, then speeding up while the flaps come in, 250 kt below 10,000 ft
      const v2 = SPD.v2 + 10, lowIas = Math.min(250, P.climbIas);
      const ias = h < 1000 ? v2 : h < 3000 ? v2 + (lowIas - v2) * (h - 1000) / 2000 : h < 10000 ? lowIas : P.climbIas;
      let tas = iasToTas(ias, h);
      if (P.jet && P.climbMach) tas = Math.min(tas, P.climbMach * soundKt(h));
      if (!P.jet) tas = Math.min(tas, cruiseTas(P, t, h));
      const rate = P.rocSL + (P.rocTop - P.rocSL) * clamp(h / Math.max(P.maxAlt, 1), 0, 1);
      const gs = Math.max(50, tas + wind(h, d) * 0.9);
      const dt = dh / rate * 60; s += dt; d += gs * dt / 3600; h += dh;
    }
    return { d, s };
  };

  // cruise level: lower on short legs; odd thousands eastbound and even westbound (the semicircular rule);
  // with a plan, the level at its first waypoint (and never above what the type can reach)
  let cruise = Math.min(P.maxAlt, P.altBase + gc * P.climbPerNm);
  const east = track0 < 180;
  const level = (h: number) => {
    let k = Math.floor(h / 1000);
    if (h >= 3000 && (k % 2 === 1) !== east) k -= 1;
    return Math.max(k * 1000 + (P.jet || h >= 18000 ? 0 : 500), 1500);
  };
  let cap = P.maxAlt, lastAlt = 0;
  if (pw.length) {
    cruise = clamp(pw[0].w.alt || cruise, 2000, P.maxAlt); lastAlt = clamp(pw[pw.length - 1].w.alt || cruise, 2000, P.maxAlt);
    let up = climbTo(cruise), down = descPlan(lastAlt);
    while (up.d + down.todNm > routeNm * 0.95 && cap > 2500) { cap -= 2000; cruise = Math.min(cruise, cap); lastAlt = Math.min(lastAlt, cap); up = climbTo(cruise); down = descPlan(lastAlt); }
  } else cruise = level(cruise);
  let up = climbTo(cruise), down = descPlan(pw.length ? lastAlt : cruise);
  while (!pw.length && up.d + down.todNm > routeNm * 0.95 && cruise > 2500) {
    cruise = level(cruise - 2000); up = climbTo(cruise); down = descPlan(cruise);
  }
  void up;
  // the speed flown at a point: the plan's (Mach or indicated) where it sets one, otherwise the type's cruise
  const tasAt = (d: number, h: number) => {
    const w = planAt(d);
    if (w && w.mach && P.jet) return Math.min(w.mach, P.mach + 0.04) * soundKt(h);
    if (w && w.spd) return Math.min(iasToTas(w.spd, h), cruiseTas(P, t, h) * 1.12);
    return cruiseTas(P, t, h);
  };

  // fly it forwards
  const pts: ProfilePoint[] = [];
  let s = 0, d = 0, h = 0;
  const push = (ph: string, gs: number) => pts.push({ s, d: Math.min(d, routeNm), alt: Math.round(h), gs: Math.round(gs), ph });
  const taxiOut = P.taxiOut + (P.jet ? BIG_HUBS[from] || 0 : 0), taxiIn = P.taxiIn + (P.jet ? (BIG_HUBS[to] || 0) * 0.5 : 0);
  push('Taxi out', 0);
  s += taxiOut * 60; push('Taxi out', 12);
  const rollS = Math.round(SPD.vr * KT / accel + 4); s += rollS; d += 0.6; push('Takeoff', SPD.v2);
  const STEP = 20;
  // climb
  while (h < cruise) {
    // V2 + 10 to about 1,000 ft, then speeding up while the flaps come in, 250 kt below 10,000 ft
    const v2c = SPD.v2 + 10, lowC = Math.min(250, P.climbIas);
    const ias = h < 1000 ? v2c : h < 3000 ? v2c + (lowC - v2c) * (h - 1000) / 2000 : h < 10000 ? lowC : P.climbIas;
    let tas = iasToTas(ias, h);
    if (P.jet && P.climbMach) tas = Math.min(tas, P.climbMach * soundKt(h));
    if (!P.jet) tas = Math.min(tas, cruiseTas(P, t, h));
    const rate = P.rocSL + (P.rocTop - P.rocSL) * clamp(h / Math.max(P.maxAlt, 1), 0, 1);
    const gs = Math.max(50, tas + wind(h, d) * 0.9);
    s += STEP; d += gs * STEP / 3600; h = Math.min(cruise, h + rate * STEP / 60);
    push('Climb', gs);
  }
  // cruise until the top of descent
  const todNm = down.todNm;
  while (d < routeNm - todNm) {
    const gs = Math.max(60, tasAt(d, h) + wind(h, d));
    const step = Math.min(gs * STEP / 3600, routeNm - todNm - d), dtS = step / gs * 3600;
    // step climbs and descents at the plan's waypoints: climbing at the type's rate near its ceiling, down at 1,500 ft/min
    if (pw.length) { const w = planAt(d), want = Math.min(cap, w ? w.alt || h : h); if (Math.abs(want - h) > 1) h = want > h ? Math.min(want, h + Math.max(500, P.rocTop) * dtS / 60) : Math.max(want, h - 1500 * dtS / 60); }
    s += dtS; d += step; push('Cruise', gs);
    if (step < 1e-6) break;
  }
  // descent, approach and final
  let acc = 0;
  for (let i = 0; i < down.steps.length; i++) {
    const st = down.steps[i];
    s += st.dt; d += st.dd; h = st.h; acc += st.dd;
    if (acc >= 2 || st.ph === 'Final' || i === down.steps.length - 1 || st.ph !== down.steps[i + 1].ph) { push(st.ph, st.gs); acc = 0; }
  }
  d = routeNm; h = 0; s += Math.round((SPD.vtd - 15) * KT / decel + 8); push('Landing', 15);
  s += taxiIn * 60; push('Taxi in', 0);
  const airS = s - taxiOut * 60 - taxiIn * 60;
  const prof = { pts, totalS: s, routeNm, cruiseAlt: pw.length ? Math.max(...pw.map(x => Math.min(cap, x.w.alt || cruise))) : cruise, airS };
  if (keep) _profiles[key] = prof;
  return prof;
}

/** Where a flight is after `elapsedS` seconds from off-blocks. */
function profileAt(p: FlightProfile, elapsedS: number) {
  const pts = p.pts;
  if (elapsedS <= 0) return { d: 0, alt: 0, gs: 0, ph: 'Taxi out', left: p.routeNm, toGoS: p.totalS };
  if (elapsedS >= p.totalS) return { d: p.routeNm, alt: 0, gs: 0, ph: 'Arrived', left: 0, toGoS: 0 };
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= elapsedS) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], k = b.s > a.s ? (elapsedS - a.s) / (b.s - a.s) : 0;
  const d = a.d + (b.d - a.d) * k;
  return { d, alt: Math.round((a.alt + (b.alt - a.alt) * k) / 10) * 10, gs: Math.round(a.gs + (b.gs - a.gs) * k), ph: b.ph, left: Math.max(0, p.routeNm - d), toGoS: p.totalS - elapsedS };
}

/** Elapsed seconds at which a flight has covered a share `frac` of its route (used to place flights from older saves). */
function profileTimeAtFrac(p: FlightProfile, frac: number) {
  const target = frac * p.routeNm;
  for (let i = 1; i < p.pts.length; i++) if (p.pts[i].d >= target && p.pts[i].ph !== 'Taxi out') {
    const a = p.pts[i - 1], b = p.pts[i], k = b.d > a.d ? (target - a.d) / (b.d - a.d) : 0;
    return a.s + (b.s - a.s) * k;
  }
  return p.totalS * frac;
}
