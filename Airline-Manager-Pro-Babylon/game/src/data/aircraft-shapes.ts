// The shape of every aircraft type, in metres, from published dimensions (manufacturers' airport-planning
// documents, type certificate data sheets and the aircraft's handbooks): length, span, height, fuselage
// size, wing position, chord and sweep, engines, tail, nose, wingtips, landing gear, windows and doors.
// The aircraft pictures in the app and the models in the 3D view are both built from these numbers,
// so each type looks like itself. Every aircraft type added to the app gets an entry here
// (see CLAUDE.md). Original artwork: no manufacturer's or airline's logos or liveries.
//
// Axes: x from the nose tip backwards, y to the right wing, z up from the ground (aircraft on its wheels).
//   L, span, H     overall length, wingspan, height to the top of the fin
//   w, h           fuselage width and height (main cabin)
//   ground         height of the fuselage underside above the ground
//   nose, tip      length of the nose taper; height of the nose tip as a share of h (0 underside, 1 top)
//   pTop, pBot     how full the nose's upper and lower curves are (2 round, 1.5 pointed, 3 blunt)
//   tail, tailEnd  length of the tail cone; height of its end (centre) as a share of h
//   drop           how far the top line falls along the tail cone (share of h; light aircraft)
//   wing           x of the root leading edge, root and tip chords, leading-edge sweep and dihedral (°),
//                  z of the root as a share of h (0 low wing, 1 high wing), wingtip device
//   fin            x of the root leading edge, root and tip chords, leading-edge sweep (tip at H)
//   stab           horizontal tail: x, chords, span, sweep, dihedral, z as a share of h (T: on top of the fin)
//   eng            engines on the right side (mirrored to the left; y 0 for a nose engine): x of the front,
//                  y, z of the centre, length, diameter, kind, propeller diameter and blades
//   gear           nose wheel x, main wheels x, track, wheels per main leg, fixed / floats
//   win            first and last window x, pitch, height of the window line (share of h), window size
//   doors          x of the passenger doors

interface ShapeWing { x: number; root: number; tip: number; sweep: number; dih: number; z: number; t?: number; tipDev?: 'fence' | 'sharklet' | 'blended' | 'raked' | 'curved' | 'small' | 'none' }
interface ShapeEng { x: number; y: number; z: number; l: number; d: number; kind: 'fan' | 'rear' | 'tprop' | 'nose' | 'radial'; prop?: number; blades?: number }
interface ShapeSpec {
  L: number; span: number; H: number; w: number; h: number; ground: number;
  nose: number; tip: number; pTop: number; pBot: number; tail: number; tailEnd: number; drop?: number;
  cockpit: 'airbus' | 'a350' | 'b737' | 'b777' | 'b787' | 'b747' | 'crj' | 'atr' | 'utility' | 'ga';
  wing: ShapeWing;
  fin: { x: number; root: number; tip: number; sweep: number; dorsal?: number };
  stab: { x: number; root: number; tip: number; span: number; sweep: number; dih: number; z: number; T?: boolean };
  eng: ShapeEng[];
  gear: { nose: number; main: number; track: number; wheels: number; fixed?: boolean; floats?: { x: number; l: number; y: number; d: number } };
  win: { from: number; to: number; pitch: number; z: number; ww?: number; wh?: number; big?: boolean };
  doors: number[];
  hump?: { end: number; h: number };
  strut?: boolean; pod?: 'cargo' | 'sponson';
}

const SHAPES: { [typeId: string]: ShapeSpec } = {
  // Airbus A320ceo (A320-214): 37.57 m long, 34.10 m span (wingtip fences), 11.76 m high, fuselage 3.95 × 4.14 m,
  // wing sweep 25° at quarter chord, CFM56-5B, wheelbase 12.64 m, track 7.59 m
  'a320-fenix': {
    L: 37.57, span: 34.1, H: 11.76, w: 3.95, h: 4.14, ground: 1.7,
    nose: 6.2, tip: 0.36, pTop: 2.1, pBot: 2.4, tail: 10.8, tailEnd: 0.72, cockpit: 'airbus',
    wing: { x: 12.4, root: 7.2, tip: 1.55, sweep: 27, dih: 5.1, z: 0.12, t: 0.13, tipDev: 'fence' },
    fin: { x: 28.3, root: 6.6, tip: 2.6, sweep: 36, dorsal: 1.5 },
    stab: { x: 31.6, root: 3.9, tip: 1.5, span: 12.45, sweep: 32, dih: 6, z: 0.52 },
    eng: [{ x: 11.6, y: 5.75, z: 1.62, l: 4.45, d: 2.08, kind: 'fan' }],
    gear: { nose: 5.07, main: 17.71, track: 7.59, wheels: 2 },
    win: { from: 7.4, to: 30.6, pitch: 0.533, z: 0.6 },
    doors: [4.25, 30.2],
  },
  // Airbus A320neo (A320-251N): as the ceo with 35.80 m span (Sharklets) and the larger CFM LEAP-1A nacelle
  'a320neo': {
    L: 37.57, span: 35.8, H: 11.76, w: 3.95, h: 4.14, ground: 1.72,
    nose: 6.2, tip: 0.36, pTop: 2.1, pBot: 2.4, tail: 10.8, tailEnd: 0.72, cockpit: 'airbus',
    wing: { x: 12.4, root: 7.2, tip: 1.55, sweep: 27, dih: 5.1, z: 0.12, t: 0.13, tipDev: 'sharklet' },
    fin: { x: 28.3, root: 6.6, tip: 2.6, sweep: 36, dorsal: 1.5 },
    stab: { x: 31.6, root: 3.9, tip: 1.5, span: 12.45, sweep: 32, dih: 6, z: 0.52 },
    eng: [{ x: 11.0, y: 5.75, z: 1.72, l: 4.95, d: 2.42, kind: 'fan' }],
    gear: { nose: 5.07, main: 17.71, track: 7.59, wheels: 2 },
    win: { from: 7.4, to: 30.6, pitch: 0.533, z: 0.6 },
    doors: [4.25, 30.2],
  },
  // Airbus A350-900: 66.80 m long, 64.75 m span, 17.05 m high, fuselage 5.96 × 6.09 m, sweep 31.9°,
  // Rolls-Royce Trent XWB (fan 3.0 m), wheelbase 28.67 m, track 10.60 m
  'a350-ini': {
    L: 66.8, span: 64.75, H: 17.05, w: 5.96, h: 6.09, ground: 2.35,
    nose: 8.6, tip: 0.38, pTop: 2.0, pBot: 2.3, tail: 17.5, tailEnd: 0.7, cockpit: 'a350',
    wing: { x: 23.2, root: 13.6, tip: 2.6, sweep: 34, dih: 6, z: 0.12, t: 0.12, tipDev: 'curved' },
    fin: { x: 52.3, root: 10.6, tip: 3.9, sweep: 40, dorsal: 2.5 },
    stab: { x: 57.0, root: 6.2, tip: 2.2, span: 18.8, sweep: 33, dih: 6, z: 0.5 },
    eng: [{ x: 24.2, y: 10.1, z: 2.55, l: 6.3, d: 3.55, kind: 'fan' }],
    gear: { nose: 5.9, main: 34.57, track: 10.6, wheels: 4 },
    win: { from: 10.4, to: 58.6, pitch: 0.55, z: 0.58, wh: 0.48 },
    doors: [6.1, 19.0, 43.2, 58.8],
  },
  // Airbus A310-300: 46.66 m long, 43.90 m span (wingtip fences), 15.80 m high, fuselage 5.64 m,
  // sweep 28°, GE CF6-80C2, wheelbase 15.21 m, track 9.60 m
  'a310-ini': {
    L: 46.66, span: 43.9, H: 15.8, w: 5.64, h: 5.64, ground: 2.05,
    nose: 7.4, tip: 0.38, pTop: 2.0, pBot: 2.3, tail: 13.2, tailEnd: 0.72, cockpit: 'airbus',
    wing: { x: 15.6, root: 9.4, tip: 2.2, sweep: 30, dih: 6, z: 0.12, t: 0.13, tipDev: 'fence' },
    fin: { x: 35.6, root: 8.6, tip: 3.2, sweep: 40, dorsal: 2 },
    stab: { x: 39.7, root: 5.0, tip: 1.8, span: 16.26, sweep: 34, dih: 7, z: 0.5 },
    eng: [{ x: 15.8, y: 7.6, z: 2.25, l: 5.3, d: 2.75, kind: 'fan' }],
    gear: { nose: 5.0, main: 20.21, track: 9.6, wheels: 4 },
    win: { from: 9.0, to: 39.0, pitch: 0.533, z: 0.58 },
    doors: [5.6, 13.4, 39.6],
  },
  // Boeing 737-800: 39.47 m long, 35.79 m span (blended winglets), 12.55 m high, fuselage 3.76 × 4.01 m,
  // sweep 25°, CFM56-7B (flat-bottomed nacelle), wheelbase 15.60 m, track 5.72 m
  'b738-pmdg': {
    L: 39.47, span: 35.79, H: 12.55, w: 3.76, h: 4.01, ground: 1.25,
    nose: 5.6, tip: 0.33, pTop: 1.75, pBot: 2.1, tail: 11.2, tailEnd: 0.74, cockpit: 'b737',
    wing: { x: 13.7, root: 7.4, tip: 1.3, sweep: 27, dih: 6, z: 0.14, t: 0.13, tipDev: 'blended' },
    fin: { x: 30.0, root: 6.9, tip: 2.0, sweep: 39, dorsal: 3.2 },
    stab: { x: 34.2, root: 4.2, tip: 1.4, span: 14.35, sweep: 32, dih: 7, z: 0.48 },
    eng: [{ x: 11.4, y: 4.83, z: 1.5, l: 4.65, d: 2.04, kind: 'fan' }],
    gear: { nose: 4.38, main: 19.98, track: 5.72, wheels: 2 },
    win: { from: 6.3, to: 33.6, pitch: 0.508, z: 0.6 },
    doors: [3.55, 34.4],
  },
  // Boeing 737-600: 31.24 m long, 34.32 m span (no winglets), 12.57 m high, wheelbase 11.23 m
  'b736-pmdg': {
    L: 31.24, span: 34.32, H: 12.57, w: 3.76, h: 4.01, ground: 1.25,
    nose: 5.6, tip: 0.33, pTop: 1.75, pBot: 2.1, tail: 11.2, tailEnd: 0.74, cockpit: 'b737',
    wing: { x: 10.9, root: 7.4, tip: 1.3, sweep: 27, dih: 6, z: 0.14, t: 0.13, tipDev: 'none' },
    fin: { x: 21.8, root: 6.9, tip: 2.0, sweep: 39, dorsal: 3.2 },
    stab: { x: 26.0, root: 4.2, tip: 1.4, span: 14.35, sweep: 32, dih: 7, z: 0.48 },
    eng: [{ x: 8.6, y: 4.83, z: 1.5, l: 4.65, d: 2.04, kind: 'fan' }],
    gear: { nose: 4.38, main: 15.61, track: 5.72, wheels: 2 },
    win: { from: 6.3, to: 25.4, pitch: 0.508, z: 0.6 },
    doors: [3.55, 26.2],
  },
  // Boeing 777-300ER: 73.86 m long, 64.80 m span (raked wingtips), 18.50 m high, fuselage 6.20 m,
  // sweep 31.6°, GE90-115B (fan 3.25 m), wheelbase 31.22 m, track 10.97 m, six-wheel main bogies
  'b77w-pmdg': {
    L: 73.86, span: 64.8, H: 18.5, w: 6.2, h: 6.2, ground: 2.2,
    nose: 8.2, tip: 0.36, pTop: 1.9, pBot: 2.3, tail: 18.6, tailEnd: 0.62, cockpit: 'b777',
    wing: { x: 25.3, root: 14.4, tip: 2.0, sweep: 33, dih: 6, z: 0.12, t: 0.12, tipDev: 'raked' },
    fin: { x: 58.8, root: 11.2, tip: 3.8, sweep: 41, dorsal: 2.5 },
    stab: { x: 63.6, root: 6.6, tip: 2.2, span: 21.5, sweep: 35, dih: 7, z: 0.48 },
    eng: [{ x: 24.9, y: 9.65, z: 2.85, l: 7.3, d: 4.05, kind: 'fan' }],
    gear: { nose: 5.5, main: 36.72, track: 10.97, wheels: 6 },
    win: { from: 9.6, to: 65.5, pitch: 0.533, z: 0.58 },
    doors: [5.9, 19.6, 37.6, 52.6, 66.3],
  },
  // Boeing 787-10: 68.28 m long, 60.12 m span (raked wingtips), 17.02 m high, fuselage 5.77 × 5.97 m,
  // sweep 32.2°, GEnx-1B / Trent 1000 with chevron nozzles, wheelbase 30.0 m, track 9.8 m
  'b78x': {
    L: 68.28, span: 60.12, H: 17.02, w: 5.77, h: 5.97, ground: 2.2,
    nose: 8.4, tip: 0.4, pTop: 1.7, pBot: 2.1, tail: 16.5, tailEnd: 0.66, cockpit: 'b787',
    wing: { x: 23.9, root: 13.4, tip: 1.9, sweep: 35, dih: 7, z: 0.12, t: 0.11, tipDev: 'raked' },
    fin: { x: 53.9, root: 10.2, tip: 3.5, sweep: 42, dorsal: 2.5 },
    stab: { x: 58.2, root: 5.9, tip: 2.0, span: 19.5, sweep: 35, dih: 6, z: 0.5 },
    eng: [{ x: 25.0, y: 9.9, z: 2.6, l: 6.7, d: 3.6, kind: 'fan' }],
    gear: { nose: 5.2, main: 35.2, track: 9.8, wheels: 4 },
    win: { from: 9.3, to: 60.5, pitch: 0.61, z: 0.57, wh: 0.55, ww: 0.32 },
    doors: [5.9, 17.4, 40.2, 60.9],
  },
  // Boeing 747-8 Intercontinental: 76.25 m long, 68.40 m span (raked wingtips), 19.35 m high, fuselage 6.50 m
  // with the upper deck, sweep 37.5°, four GEnx-2B, wheelbase 29.7 m, outer track 12.7 m
  'b748': {
    L: 76.25, span: 68.4, H: 19.35, w: 6.5, h: 6.9, ground: 2.35,
    nose: 9.6, tip: 0.33, pTop: 1.9, pBot: 2.4, tail: 19.0, tailEnd: 0.62, cockpit: 'b747',
    wing: { x: 26.3, root: 16.2, tip: 2.4, sweep: 40, dih: 7, z: 0.12, t: 0.12, tipDev: 'raked' },
    fin: { x: 60.6, root: 12.6, tip: 4.5, sweep: 46 },
    stab: { x: 65.0, root: 7.4, tip: 2.6, span: 22.2, sweep: 38, dih: 7, z: 0.48 },
    eng: [{ x: 30.6, y: 12.4, z: 2.75, l: 6.0, d: 3.25, kind: 'fan' }, { x: 38.6, y: 21.2, z: 3.75, l: 6.0, d: 3.25, kind: 'fan' }],
    gear: { nose: 6.4, main: 36.1, track: 12.7, wheels: 4 },
    win: { from: 10.6, to: 67.2, pitch: 0.508, z: 0.56 },
    doors: [6.6, 15.0, 33.0, 50.6, 63.4],
    hump: { end: 31.0, h: 2.25 },
  },
  // Bombardier CRJ900: 36.19 m long, 24.85 m span (winglets), 7.51 m high, fuselage 2.69 m, sweep 26.3°,
  // two GE CF34-8C5 at the rear, T-tail, wheelbase 17.32 m, track 4.0 m
  'crj9-aero': {
    L: 36.19, span: 24.85, H: 7.51, w: 2.69, h: 2.69, ground: 0.92,
    nose: 4.4, tip: 0.38, pTop: 1.8, pBot: 2.0, tail: 8.2, tailEnd: 0.72, cockpit: 'crj',
    wing: { x: 16.8, root: 5.0, tip: 1.1, sweep: 28, dih: 4.5, z: 0.08, t: 0.12, tipDev: 'small' },
    fin: { x: 30.2, root: 4.4, tip: 3.0, sweep: 44 },
    stab: { x: 0, root: 2.4, tip: 1.2, span: 8.54, sweep: 34, dih: -3, z: 1, T: true },
    eng: [{ x: 26.0, y: 2.45, z: 3.15, l: 3.9, d: 1.48, kind: 'rear' }],
    gear: { nose: 2.62, main: 19.94, track: 4.0, wheels: 2 },
    win: { from: 4.6, to: 27.4, pitch: 0.8, z: 0.58, ww: 0.24, wh: 0.34 },
    doors: [2.4, 27.9],
  },
  // Bombardier CRJ700: 32.51 m long, 23.24 m span, 7.57 m high, wheelbase 14.27 m
  'crj7-aero': {
    L: 32.51, span: 23.24, H: 7.57, w: 2.69, h: 2.69, ground: 0.92,
    nose: 4.4, tip: 0.38, pTop: 1.8, pBot: 2.0, tail: 8.2, tailEnd: 0.72, cockpit: 'crj',
    wing: { x: 14.4, root: 4.8, tip: 1.1, sweep: 28, dih: 4.5, z: 0.08, t: 0.12, tipDev: 'small' },
    fin: { x: 26.5, root: 4.4, tip: 3.0, sweep: 44 },
    stab: { x: 0, root: 2.4, tip: 1.2, span: 8.54, sweep: 34, dih: -3, z: 1, T: true },
    eng: [{ x: 22.3, y: 2.45, z: 3.15, l: 3.9, d: 1.48, kind: 'rear' }],
    gear: { nose: 2.62, main: 16.89, track: 4.0, wheels: 2 },
    win: { from: 4.6, to: 23.7, pitch: 0.8, z: 0.58, ww: 0.24, wh: 0.34 },
    doors: [2.4, 24.2],
  },
  // ATR 72-600: 27.17 m long, 27.05 m span, 7.65 m high, fuselage 2.87 × 2.6 m, high wing, T-tail,
  // two PW127M with six-blade 3.93 m propellers, main gear in fuselage sponsons, wheelbase 10.77 m, track 4.1 m
  'atr72': {
    L: 27.17, span: 27.05, H: 7.65, w: 2.87, h: 2.6, ground: 0.78,
    nose: 3.6, tip: 0.42, pTop: 1.9, pBot: 2.0, tail: 8.0, tailEnd: 0.78, cockpit: 'atr',
    wing: { x: 10.2, root: 2.57, tip: 1.41, sweep: 3, dih: 2.5, z: 1.0, t: 0.15, tipDev: 'none' },
    fin: { x: 20.4, root: 4.6, tip: 2.3, sweep: 36, dorsal: 3.5 },
    stab: { x: 0, root: 1.9, tip: 1.2, span: 7.31, sweep: 10, dih: 0, z: 1, T: true },
    eng: [{ x: 8.3, y: 4.05, z: 3.05, l: 5.6, d: 1.15, kind: 'tprop', prop: 3.93, blades: 6 }],
    gear: { nose: 1.6, main: 12.37, track: 4.1, wheels: 2 },
    win: { from: 4.3, to: 20.6, pitch: 0.77, z: 0.58, ww: 0.26, wh: 0.36 },
    doors: [3.0, 21.6],
    pod: 'sponson',
  },
  // DHC-6-300 Twin Otter: 15.77 m long, 19.81 m span, 5.94 m high, high braced wing of constant 1.98 m chord,
  // two PT6A-27 with three-blade 2.59 m propellers, fixed tricycle gear, wheelbase 4.53 m, track 3.71 m
  'dhc6-aero': {
    L: 15.77, span: 19.81, H: 5.94, w: 1.62, h: 1.78, ground: 0.92,
    nose: 3.0, tip: 0.36, pTop: 2.2, pBot: 1.8, tail: 6.0, tailEnd: 0.72, drop: 0.12, cockpit: 'utility',
    wing: { x: 5.3, root: 1.98, tip: 1.98, sweep: 0, dih: 3, z: 1.0, t: 0.16, tipDev: 'none' },
    fin: { x: 12.9, root: 2.5, tip: 1.4, sweep: 22 },
    stab: { x: 13.7, root: 1.6, tip: 1.6, span: 6.3, sweep: 0, dih: 0, z: 0.82 },
    eng: [{ x: 3.75, y: 2.6, z: 2.55, l: 3.4, d: 0.86, kind: 'tprop', prop: 2.59, blades: 3 }],
    gear: { nose: 2.1, main: 6.63, track: 3.71, wheels: 1, fixed: true },
    win: { from: 3.9, to: 10.8, pitch: 0.86, z: 0.6, ww: 0.48, wh: 0.42, big: true },
    doors: [11.3],
    strut: true,
  },
  // DHC-2 Beaver on floats: 9.24 m long, 14.63 m span, high braced wing of 1.59 m chord, Pratt & Whitney
  // R-985 radial with a 2.59 m propeller, Edo floats about 7.6 m long
  'dhc2': {
    L: 9.24, span: 14.63, H: 4.1, w: 1.25, h: 1.45, ground: 1.72,
    nose: 1.5, tip: 0.5, pTop: 2.8, pBot: 2.8, tail: 5.2, tailEnd: 0.62, drop: 0.32, cockpit: 'ga',
    wing: { x: 2.55, root: 1.59, tip: 1.59, sweep: 0, dih: 1.5, z: 1.0, t: 0.15, tipDev: 'none' },
    fin: { x: 7.95, root: 1.5, tip: 0.85, sweep: 28 },
    stab: { x: 8.0, root: 1.2, tip: 0.85, span: 5.03, sweep: 6, dih: 0, z: 0.55 },
    eng: [{ x: -0.15, y: 0, z: 2.45, l: 1.2, d: 1.32, kind: 'radial', prop: 2.59, blades: 2 }],
    gear: { nose: 0, main: 0, track: 2.6, wheels: 0, fixed: true, floats: { x: -0.4, l: 7.6, y: 1.3, d: 0.78 } },
    win: { from: 1.9, to: 4.6, pitch: 0.9, z: 0.62, ww: 0.62, wh: 0.5, big: true },
    doors: [],
    strut: true,
  },
  // Cessna 208B Grand Caravan EX: 12.67 m long, 15.88 m span, 4.71 m high, high braced wing, PT6A-140 with a
  // three-blade 2.69 m propeller, fixed tricycle gear, belly cargo pod, wheelbase 3.54 m, track 3.56 m
  'c208': {
    L: 12.67, span: 15.88, H: 4.71, w: 1.7, h: 1.72, ground: 1.0,
    nose: 2.7, tip: 0.46, pTop: 2.2, pBot: 2.0, tail: 6.0, tailEnd: 0.66, drop: 0.24, cockpit: 'utility',
    wing: { x: 4.2, root: 1.98, tip: 1.24, sweep: 0, dih: 3, z: 1.0, t: 0.16, tipDev: 'none' },
    fin: { x: 10.3, root: 2.3, tip: 1.1, sweep: 34, dorsal: 1.5 },
    stab: { x: 10.8, root: 1.45, tip: 0.9, span: 6.25, sweep: 5, dih: 0, z: 0.5 },
    eng: [{ x: -0.25, y: 0, z: 1.82, l: 2.6, d: 0.95, kind: 'nose', prop: 2.69, blades: 3 }],
    gear: { nose: 1.55, main: 5.09, track: 3.56, wheels: 1, fixed: true },
    win: { from: 4.0, to: 9.1, pitch: 0.92, z: 0.6, ww: 0.5, wh: 0.46, big: true },
    doors: [8.7],
    strut: true, pod: 'cargo',
  },
  // Daher Kodiak 100: 10.41 m long, 13.71 m span, 4.72 m high, high braced wing, PT6A-34 with a four-blade
  // 2.44 m propeller, fixed tricycle gear
  'kodiak': {
    L: 10.41, span: 13.71, H: 4.72, w: 1.5, h: 1.62, ground: 1.05,
    nose: 2.35, tip: 0.46, pTop: 2.2, pBot: 2.0, tail: 5.0, tailEnd: 0.66, drop: 0.24, cockpit: 'utility',
    wing: { x: 3.6, root: 1.75, tip: 1.35, sweep: 0, dih: 3, z: 1.0, t: 0.16, tipDev: 'none' },
    fin: { x: 8.2, root: 2.2, tip: 1.1, sweep: 36, dorsal: 1.2 },
    stab: { x: 8.75, root: 1.45, tip: 0.9, span: 5.6, sweep: 5, dih: 0, z: 0.5 },
    eng: [{ x: -0.2, y: 0, z: 1.85, l: 2.3, d: 0.92, kind: 'nose', prop: 2.44, blades: 4 }],
    gear: { nose: 1.45, main: 4.75, track: 3.2, wheels: 1, fixed: true },
    win: { from: 3.4, to: 7.0, pitch: 0.95, z: 0.6, ww: 0.55, wh: 0.46, big: true },
    doors: [7.3],
    strut: true,
  },
  // Pilatus PC-12 NGX: 14.40 m long, 16.28 m span (winglets), 4.26 m high, low wing, T-tail, PT6E-67XP with a
  // five-blade 2.67 m propeller, retractable gear, wheelbase 4.46 m, track 4.5 m
  'pc12': {
    L: 14.4, span: 16.28, H: 4.26, w: 1.6, h: 1.65, ground: 0.86,
    nose: 2.9, tip: 0.48, pTop: 2.0, pBot: 2.0, tail: 5.6, tailEnd: 0.68, drop: 0.08, cockpit: 'ga',
    wing: { x: 5.2, root: 2.45, tip: 1.2, sweep: 3, dih: 6, z: 0.05, t: 0.15, tipDev: 'small' },
    fin: { x: 11.2, root: 2.7, tip: 1.6, sweep: 42, dorsal: 1.5 },
    stab: { x: 0, root: 1.4, tip: 0.9, span: 5.2, sweep: 12, dih: 0, z: 1, T: true },
    eng: [{ x: -0.25, y: 0, z: 1.68, l: 2.9, d: 0.9, kind: 'nose', prop: 2.67, blades: 5 }],
    gear: { nose: 1.75, main: 6.21, track: 4.5, wheels: 1 },
    win: { from: 4.2, to: 9.6, pitch: 0.88, z: 0.6, ww: 0.42, wh: 0.5, big: true },
    doors: [10.2],
  },
  // Cessna 172S Skyhawk: 8.28 m long, 11.00 m span, 2.72 m high, high braced wing, Lycoming IO-360 with a
  // two-blade 1.93 m propeller, fixed tricycle gear, wheelbase 1.65 m, track 2.54 m
  'c172': {
    L: 8.28, span: 11.0, H: 2.72, w: 1.12, h: 1.32, ground: 0.5,
    nose: 1.95, tip: 0.46, pTop: 2.4, pBot: 2.0, tail: 4.3, tailEnd: 0.6, drop: 0.46, cockpit: 'ga',
    wing: { x: 2.25, root: 1.63, tip: 1.13, sweep: 0, dih: 1.7, z: 1.0, t: 0.13, tipDev: 'none' },
    fin: { x: 6.75, root: 1.55, tip: 0.72, sweep: 38, dorsal: 0.8 },
    stab: { x: 6.95, root: 1.25, tip: 0.85, span: 3.45, sweep: 4, dih: 0, z: 0.42 },
    eng: [{ x: -0.1, y: 0, z: 1.08, l: 1.9, d: 0.72, kind: 'nose', prop: 1.93, blades: 2 }],
    gear: { nose: 0.95, main: 2.6, track: 2.54, wheels: 1, fixed: true },
    win: { from: 2.0, to: 3.5, pitch: 0.75, z: 0.64, ww: 0.6, wh: 0.5, big: true },
    doors: [],
    strut: true,
  },
};

/** A type from a close relative's shape: the fuselage lengthened or shortened at the real plugs (fwd metres ahead of
 *  the wing, the rest behind it), with its own span, height, wing, engines and gear. */
function shapeStretch(b: ShapeSpec, o: any): ShapeSpec {
  const s: ShapeSpec = JSON.parse(JSON.stringify(b)), aft = o.L - b.L - o.fwd, wx = b.wing.x, wEnd = wx + b.wing.root;
  const mv = (x: number) => x < wx - 0.5 ? x : x <= wEnd + 0.5 ? x + o.fwd : x + o.fwd + aft;
  s.L = o.L; s.wing.x = wx + o.fwd + (o.wingX || 0); s.fin.x += o.fwd + aft; s.stab.x += o.fwd + aft;
  s.eng = s.eng.map(e => Object.assign(e, { x: e.x + o.fwd + (o.wingX || 0) }));
  s.gear.main += o.fwd + (o.wingX || 0); s.win.to += o.fwd + aft; s.doors = s.doors.map(mv);
  if (o.span) { s.span = o.span; s.eng.forEach(e => { e.y = Math.max(e.y, b.eng[0].y * o.span / b.span * 0.95); }); }
  if (o.H) s.H = o.H; if (o.tipDev) s.wing.tipDev = o.tipDev; if (o.sweep) s.wing.sweep = o.sweep;
  if (o.root) s.wing.root = Math.max(b.wing.root * 0.9, o.root); if (o.tip) s.wing.tip = o.tip; if (o.stab) s.stab.span = o.stab;
  if (o.engD) s.eng.forEach(e => { e.d = o.engD; e.z = Math.max(e.z, b.eng[0].z + (o.engD - b.eng[0].d) * 0.45); });
  if (o.engL) s.eng.forEach(e => { e.l = o.engL * 1.12; });
  if (o.track) s.gear.track = o.track; if (o.wheels) s.gear.wheels = o.wheels; if (o.ground) s.ground = o.ground;
  return s;
}
SHAPES['a319neo'] = shapeStretch(SHAPES['a320neo'], {L: 33.84, fwd: -2.13, span: 35.8, H: 11.76, tipDev: 'sharklet', wheels: 2, track: 7.59, sweep: 27.0, root: 7.1979999999999995, tip: 1.5, stab: 12.45, engD: 2.38, engL: 4.0});
SHAPES['a321ceo'] = shapeStretch(SHAPES['a320-fenix'], {L: 44.51, fwd: 4.27, span: 35.8, H: 11.76, tipDev: 'sharklet', wheels: 2, track: 7.59, sweep: 27.0, root: 7.1979999999999995, tip: 1.5, stab: 12.45, engD: 2.08, engL: 4.0});
SHAPES['a321neo'] = shapeStretch(SHAPES['a320neo'], {L: 44.51, fwd: 4.27, span: 35.8, H: 11.76, tipDev: 'sharklet', wheels: 2, track: 7.59, sweep: 27.0, root: 7.1979999999999995, tip: 1.5, stab: 12.45, engD: 2.38, engL: 4.0});
SHAPES['a321lr'] = shapeStretch(SHAPES['a320neo'], {L: 44.51, fwd: 4.27, span: 35.8, H: 11.76, tipDev: 'sharklet', wheels: 2, track: 7.59, sweep: 27.0, root: 7.1979999999999995, tip: 1.5, stab: 12.45, engD: 2.38, engL: 4.0});
SHAPES['a321xlr'] = shapeStretch(SHAPES['a320neo'], {L: 44.51, fwd: 4.27, span: 35.8, H: 11.76, tipDev: 'sharklet', wheels: 2, track: 7.59, sweep: 27.0, root: 7.1979999999999995, tip: 1.5, stab: 12.45, engD: 2.38, engL: 4.0});
SHAPES['a330-800neo'] = shapeStretch(SHAPES['a310-ini'], {L: 58.82, fwd: 6.6, span: 64.0, H: 17.39, tipDev: 'sharklet', wheels: 4, track: 10.69, sweep: 32.0, root: 12.508, tip: 2.0, stab: 19.4, engD: 3.41, engL: 5.6, wingX: 1.2});
SHAPES['a330-900neo'] = shapeStretch(SHAPES['a310-ini'], {L: 63.66, fwd: 9.2, span: 64.0, H: 16.79, tipDev: 'sharklet', wheels: 4, track: 10.69, sweep: 32.0, root: 12.508, tip: 2.0, stab: 19.4, engD: 3.41, engL: 5.6, wingX: 1.2});
SHAPES['b737-max7'] = shapeStretch(SHAPES['b738-pmdg'], {L: 35.56, fwd: -2.03, span: 35.92, H: 12.29, tipDev: 'blended', wheels: 2, track: 5.72, sweep: 27.0, root: 8.613999999999999, tip: 1.25, stab: 14.35, engD: 2.11, engL: 3.9});
SHAPES['b737-max8'] = shapeStretch(SHAPES['b738-pmdg'], {L: 39.52, fwd: 0.0, span: 35.92, H: 12.29, tipDev: 'blended', wheels: 2, track: 5.72, sweep: 27.0, root: 8.613999999999999, tip: 1.25, stab: 14.35, engD: 2.11, engL: 3.9});
SHAPES['b737-max9'] = shapeStretch(SHAPES['b738-pmdg'], {L: 42.11, fwd: 1.42, span: 35.92, H: 12.29, tipDev: 'blended', wheels: 2, track: 5.72, sweep: 27.0, root: 8.613999999999999, tip: 1.25, stab: 14.35, engD: 2.11, engL: 3.9});
SHAPES['b737-max10'] = shapeStretch(SHAPES['b738-pmdg'], {L: 43.8, fwd: 2.3, span: 35.92, H: 12.5, tipDev: 'blended', wheels: 2, track: 5.72, sweep: 27.0, root: 8.613999999999999, tip: 1.25, stab: 14.35, engD: 2.11, engL: 3.9, ground: 1.4});
SHAPES['b787-8'] = shapeStretch(SHAPES['b78x'], {L: 56.72, fwd: -6.1, span: 60.12, H: 16.92, tipDev: 'raked', wheels: 4, track: 9.8, sweep: 34.2, root: 13.569999999999999, tip: 1.8, stab: 19.8, engD: 3.38, engL: 5.5});
SHAPES['b787-9'] = shapeStretch(SHAPES['b78x'], {L: 62.81, fwd: -3.0, span: 60.12, H: 17.02, tipDev: 'raked', wheels: 4, track: 9.8, sweep: 34.2, root: 13.569999999999999, tip: 1.8, stab: 19.8, engD: 3.38, engL: 5.5});
SHAPES['b777-9'] = shapeStretch(SHAPES['b77w-pmdg'], {L: 76.73, fwd: 1.5, span: 71.76, H: 19.53, tipDev: 'raked', wheels: 6, track: 10.97, sweep: 34.0, root: 16.52, tip: 2.0, stab: 21.5, engD: 4.08, engL: 7.0});

/** The shape for a type; aircraft from the simulator that the app doesn't list use the closest type of their class. */
/** Metres from the middle of the fuselage forward to the nose wheel. On the ground an aircraft is placed by
 *  its nose wheel (on the taxiway line, on the stand's stop mark), as pilots steer it. */
function noseWheelAhead(typeId: string): number { const S = shapeOf(typeId); return S && S.gear && S.gear.nose < S.L / 2 ? S.L / 2 - S.gear.nose : 0; }
function shapeOf(typeId: string): ShapeSpec {
  if (typeof isHeli === 'function' && isHeli(typeId)) return heliShape(typeId);
  if (SHAPES[typeId]) return SHAPES[typeId];
  const t = acType(typeId) || AIRCRAFT[0];
  const by: { [c: string]: string } = { widebody: 'b78x', airliner: 'a320neo', regional: 'crj9-aero', turboprop: 'atr72', bush: 'c208', ga: 'c172' };
  return SHAPES[by[t.cls] || 'a320neo'];
}
