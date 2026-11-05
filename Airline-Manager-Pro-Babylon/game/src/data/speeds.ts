// Take-off and landing speeds and weights per aircraft type, from the reference documents in
// docs/reference/ (takeoff-speeds-and-weights.txt, landing-speeds-and-weights.txt and
// additional-aircraft-speeds-and-weights.txt). Every aircraft type added to the app gets a row here.
//
//   to   take-off (rotation / lift-off) speed range, knots
//   app  final approach speed range, knots
//   mtow / mlw   maximum take-off / landing weight, tonnes
//   oew  operating empty weight, tonnes (approximate, for working out the weight of each flight)
//
// Within a range the speed follows the aircraft's weight: the top of the range at the maximum weight,
// lower when lighter, with speed rising with the square root of weight (section 9 of the documents).
// Passengers count 100 kg each with their bags (the documents' illustration).

interface SpeedSpec { to: number[]; app: number[]; mtow: number; mlw: number; oew: number; doc: string }

const SPEEDS: { [typeId: string]: SpeedSpec } = {
  'a320-fenix': { to: [130, 150], app: [125, 140], mtow: 78, mlw: 66, oew: 42.6, doc: 'A320ceo' },
  'a320neo': { to: [130, 150], app: [125, 140], mtow: 79, mlw: 67.4, oew: 44.3, doc: 'A320neo' },
  'a350-ini': { to: [145, 170], app: [135, 150], mtow: 280, mlw: 205, oew: 142, doc: 'A350-900' },
  'a310-ini': { to: [135, 160], app: [125, 145], mtow: 164, mlw: 123, oew: 80, doc: 'A310-300' },
  'b738-pmdg': { to: [130, 155], app: [125, 145], mtow: 79, mlw: 66.4, oew: 41.4, doc: '737-800' },
  'b736-pmdg': { to: [120, 140], app: [120, 135], mtow: 65.8, mlw: 55.1, oew: 36.4, doc: '737-600 (additional)' },
  'b77w-pmdg': { to: [145, 175], app: [140, 160], mtow: 352, mlw: 251, oew: 168, doc: '777-300ER' },
  'b78x': { to: [145, 175], app: [135, 155], mtow: 254, mlw: 201, oew: 135, doc: '787-10' },
  'b748': { to: [150, 175], app: [145, 165], mtow: 448, mlw: 342, oew: 220, doc: '747-8 Intercontinental' },
  'crj9-aero': { to: [120, 140], app: [120, 140], mtow: 38, mlw: 32, oew: 21.8, doc: 'CRJ-900' },
  'crj7-aero': { to: [115, 135], app: [115, 135], mtow: 34, mlw: 29, oew: 19.7, doc: 'CRJ-700' },
  'atr72': { to: [100, 120], app: [100, 120], mtow: 23, mlw: 21, oew: 13.3, doc: 'ATR 72-600' },
  'dhc6-aero': { to: [70, 85], app: [75, 85], mtow: 5.67, mlw: 5.579, oew: 3.36, doc: 'DHC-6 Twin Otter (additional)' },
  'dhc2': { to: [55, 65], app: [60, 70], mtow: 2.313, mlw: 2.313, oew: 1.36, doc: 'DHC-2 Beaver (additional)' },
  'c208': { to: [70, 75], app: [75, 85], mtow: 3.969, mlw: 3.856, oew: 2.55, doc: 'Cessna 208B (additional)' },
  'kodiak': { to: [65, 75], app: [75, 85], mtow: 3.291, mlw: 3.035, oew: 1.77, doc: 'Kodiak 100 (additional)' },
  'pc12': { to: [65, 75], app: [80, 90], mtow: 4.74, mlw: 4.5, oew: 3.0, doc: 'Pilatus PC-12 (additional)' },
  'c172': { to: [55, 55], app: [60, 75], mtow: 1.157, mlw: 1.157, oew: 0.77, doc: 'Cessna 172S (additional)' },
  'a319neo': { to: [128, 148], app: [125, 135], mtow: 75.5, mlw: 63.9, oew: 43.5, doc: 'A319neo' },
  'a321ceo': { to: [140, 162], app: [135, 148], mtow: 93.5, mlw: 77.8, oew: 48.5, doc: 'A321' },
  'a321neo': { to: [140, 162], app: [135, 148], mtow: 93.5, mlw: 79.2, oew: 50.5, doc: 'A321neo' },
  'a321lr': { to: [143, 166], app: [136, 149], mtow: 97.0, mlw: 79.2, oew: 51.8, doc: 'A321LR neo' },
  'a321xlr': { to: [145, 170], app: [137, 150], mtow: 101.0, mlw: 79.2, oew: 53.5, doc: 'A321XLR neo' },
  'a330-800neo': { to: [145, 168], app: [130, 142], mtow: 251.0, mlw: 186.0, oew: 132.0, doc: 'A330-800neo' },
  'a330-900neo': { to: [148, 170], app: [132, 145], mtow: 251.0, mlw: 191.0, oew: 135.0, doc: 'A330-900neo' },
  'b737-max7': { to: [135, 155], app: [128, 140], mtow: 80.286, mlw: 66.043, oew: 42.2, doc: '737 MAX 7' },
  'b737-max8': { to: [140, 160], app: [132, 148], mtow: 82.644, mlw: 69.308, oew: 45.1, doc: '737 MAX 8' },
  'b737-max9': { to: [145, 165], app: [138, 152], mtow: 88.314, mlw: 74.343, oew: 50.3, doc: '737 MAX 9' },
  'b737-max10': { to: [148, 168], app: [142, 156], mtow: 89.765, mlw: 75.931, oew: 52.0, doc: '737 MAX 10' },
  'b787-8': { to: [145, 168], app: [135, 148], mtow: 227.93, mlw: 172.365, oew: 119.95, doc: '787-8' },
  'b787-9': { to: [150, 172], app: [140, 152], mtow: 254.692, mlw: 192.776, oew: 128.85, doc: '787-9' },
  'b777-9': { to: [155, 180], app: [140, 155], mtow: 351.534, mlw: 266.258, oew: 185.0, doc: '777-9' },
  'h125': { to: [35, 55], app: [50, 60], mtow: 2.25, mlw: 2.25, oew: 1.28, doc: 'H125' },
  'h130': { to: [35, 55], app: [50, 60], mtow: 2.5, mlw: 2.5, oew: 1.46, doc: 'H130' },
  'h135': { to: [35, 55], app: [55, 65], mtow: 2.98, mlw: 2.98, oew: 1.55, doc: 'H135' },
  'h145': { to: [35, 55], app: [60, 70], mtow: 3.8, mlw: 3.8, oew: 1.9, doc: 'H145' },
  'h160': { to: [35, 55], app: [60, 70], mtow: 6.05, mlw: 6.05, oew: 3.98, doc: 'H160' },
  'h175': { to: [35, 55], app: [65, 75], mtow: 7.8, mlw: 7.8, oew: 4.72, doc: 'H175' },
  'bell407': { to: [35, 55], app: [50, 60], mtow: 2.27, mlw: 2.27, oew: 1.22, doc: 'Bell 407GXi' },
  'bell429': { to: [35, 55], app: [55, 65], mtow: 3.17, mlw: 3.17, oew: 2.02, doc: 'Bell 429' },
  'bell505': { to: [35, 55], app: [50, 60], mtow: 1.67, mlw: 1.67, oew: 0.99, doc: 'Bell 505' },
  'bell525': { to: [35, 55], app: [65, 75], mtow: 9.3, mlw: 9.3, oew: 5.6, doc: 'Bell 525 Relentless' },
  'aw109': { to: [35, 55], app: [55, 65], mtow: 3.17, mlw: 3.17, oew: 1.7, doc: 'AW109 Trekker' },
  'aw139': { to: [35, 55], app: [60, 70], mtow: 6.4, mlw: 6.4, oew: 3.9, doc: 'AW139' },
  'aw169': { to: [35, 55], app: [60, 70], mtow: 4.8, mlw: 4.8, oew: 2.9, doc: 'AW169' },
  'aw189': { to: [35, 55], app: [65, 75], mtow: 8.3, mlw: 8.3, oew: 5.0, doc: 'AW189' },
  's76d': { to: [35, 55], app: [60, 70], mtow: 5.39, mlw: 5.39, oew: 3.92, doc: 'S-76D' },
  's92': { to: [35, 55], app: [65, 75], mtow: 12.56, mlw: 12.56, oew: 7.1, doc: 'S-92A' },
};

/** The speeds for a type; types not in the table (aircraft detected in the simulator) use their size class. */
function speedSpec(typeId: string): SpeedSpec {
  if (SPEEDS[typeId]) return SPEEDS[typeId];
  const t = acType(typeId) || AIRCRAFT[0];
  const by: { [c: string]: string } = { widebody: 'b78x', airliner: 'a320-fenix', regional: 'crj9-aero', turboprop: 'atr72', bush: 'c208', ga: 'c172' };
  return SPEEDS[by[t.cls] || 'a320-fenix'];
}

/** Take-off and landing weights (tonnes) of a flight: empty aircraft, crew, passengers at 100 kg, cargo, fuel. */
function flightWeights(typeId: string, pax: number, distNm: number, cargoT?: number): { tow: number; lw: number; zfw: number } {
  const S = speedSpec(typeId), t = acType(typeId) || AIRCRAFT[0];
  const crew = t.seats > 100 ? 0.6 : t.seats > 20 ? 0.3 : 0.1, payload = Math.max(0, pax) * 0.1, cargo = cargoT != null ? Math.max(0, cargoT) : payload * 0.15;
  const range = Math.max(200, t.rangeNm || 1000), share = clamp(distNm / range, 0, 1);
  const zfw = S.oew + crew + payload + cargo;
  // fuel for the trip plus reserves, within the maximum take-off weight
  const fuel = Math.max(0, Math.min((S.mtow - S.oew) * (0.12 + 0.62 * share), S.mtow - zfw));
  const tow = Math.min(S.mtow, zfw + fuel), burn = Math.min((S.mtow - S.oew) * 0.62 * share * 0.9, fuel * 0.85);   // trip fuel; reserves stay
  const lw = Math.min(S.mlw, Math.max(zfw, tow - burn));
  return { tow, lw, zfw };
}

/** A speed within a range for a weight: the top at the maximum weight, scaling with √weight, never below the bottom. */
function speedForWeight(range: number[], w: number, wMax: number): number {
  return Math.round(clamp(range[1] * Math.sqrt(Math.max(0.05, w) / wMax), range[0], range[1]));
}

/** Rotation, climb-out (about V2 + 10), approach, threshold and touchdown speeds for a flight, in knots. */
function flightSpeeds(typeId: string, pax: number, distNm: number) {
  const S = speedSpec(typeId), W = flightWeights(typeId, pax, distNm);
  const vr = speedForWeight(S.to, W.tow, S.mtow), vapp = speedForWeight(S.app, W.lw, S.mlw);
  const small = S.mtow < 10;
  return { vr, v2: vr + (small ? 8 : 12), vapp, vthr: vapp - (small ? 3 : 5), vtd: vapp - (small ? 8 : 12), tow: W.tow, lw: W.lw, doc: S.doc };
}

/** Headwind component (knots, negative for a tailwind) along a runway heading. */
function headwind(windDir: number, windKt: number, rwyHdg: number): number { return windKt * Math.cos((windDir - rwyHdg) * Math.PI / 180); }

const KT = 0.514444;   // metres per second in a knot
