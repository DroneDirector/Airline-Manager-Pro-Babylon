// @ts-nocheck
// The plan of your airport, as on the architect sheets: the terminal (every room, door, stair, lift, screen, jetway and
// stand, each with its own id) and the airfield (runway, taxiways, holding positions, signs, stands, the boundary).
// Metres; x along the runway (true 068°), y towards the runway from the terminal's kerb (true 338°).
// The passenger terminal: every room, door, stair, lift, screen, jetway and stand, each with its own id.
// Metres. x runs west to east, y from the kerb (y = 0, the main facade) north towards the ramp.
// Floor 1 is the ground floor (+0.00), Floor 2 is the upper floor (+6.00).
/** A jetway gate's static corridor and rotunda for its stand: the cab's round part 5.65 m right of the stand's centre line at
 *  the front door (5.5 m behind the nose), the rotunda 13 m from it (the jetway 18.5 m overall) straight out from the gate's
 *  door; the corridor runs from the pier (y 82) to the rotunda's edge (1.8 m). Same as terminal/plan.ts jetwayAt. */
export function jetwayAt(gateX: number, standX: number, nose: number) { void nose; const dx = standX + 5.65 - gateX, dz = Math.sqrt(13 * 13 - dx * dx), rz = 82 + 20 + 5.5 - dz; return { rotunda: [gateX, rz], corridor: rz - 1.8 - 82 }; }   // the rotunda stays put (placed for a nose 20 m out); the stands are further out, the jetway reaches
export const TERMINAL: any = (() => {
  const R = [], D = [], V = [], M = [], J = [], S = [];
  const room = (id, floor, name, x0, y0, x1, y1, kind, note) => R.push({ id, floor, name, x0, y0, x1, y1, kind: kind || 'room', note: note || '' });
  // door: on a wall at constant y ('h') or constant x ('v'); a = the room it belongs to, b = the other side
  const door = (id, floor, x, y, w, wall, a, b, type) => D.push({ id, floor, x, y, w, wall, a, b, type });
  // The pier: 8 gates side by side along the ramp, in 4 pairs of 80 m. In each pair the Floor 2 jetway gate (1-4) comes
  // first, then its Floor 1 walk-out gate (5-8) right beside it, reached by stairs and a lift from the Floor 2 gate.
  // the pier as built in the Babylon.js edition (sections/terminal/plan.ts): the walkway 16 m wide from y 52 (PG 68), the
  // gates' glass wall onto the ramp at PN 82, the modules 80.55 m apart from x -72.6
  // the stands' noses: 26 m (jetway) and 28 m (walk-out) out from the pier, room for the static corridors and the jetways (about 18.6 m reach, room to extend and retract)
  const NOSE_J = 82 + 26, NOSE_W = 82 + 28;
  const PIER = [-80, 242], PG = 68, PN = 82, PAIRS = [0, 1, 2, 3].map(i => -72.6 + 80.55 * i - 6);
  const UP = PAIRS.map(a => [a + 6, a + 40]), LO = PAIRS.map(a => [a + 34, a + 74]);

  // ---------------- FLOOR 1 (ground) ----------------
  room('F1-HALL', 1, 'Grand Hall (departures, check-in, bag drop)', 36, 0, 114, 30, 'hall', 'Full height under the wave roof');
  room('F1-ENTR-W', 1, 'Entrance West (vestibule)', 44, -4, 56, 0, 'vestibule');
  room('F1-ENTR-C', 1, 'Main Entrance (vestibule)', 67, -4, 83, 0, 'vestibule');
  room('F1-ENTR-E', 1, 'Entrance East (vestibule)', 94, -4, 106, 0, 'vestibule');
  room('F1-CHECKIN', 1, 'Check-in (desks 1-24, two islands)', 44, 13, 96, 21, 'zone');
  room('F1-BAGDROP', 1, 'Bag Drop (self service, 8 points)', 99, 8, 112, 26, 'zone');
  room('F1-MUSEUM', 1, 'Museum (Vortex Gallery)', 0, 0, 36, 30, 'museum');
  room('F1-PLANT', 1, 'Plant room', 0, 30, 36, 52, 'service');
  room('F1-WC-M', 1, 'Toilets (men)', 36, 30, 43, 44, 'wc');
  room('F1-WC-F', 1, 'Toilets (women, accessible)', 43, 30, 50, 44, 'wc');
  room('F1-CLEAN', 1, 'Cleaners store', 36, 44, 50, 52, 'service');
  room('F1-SECURITY', 1, 'Security (6 lanes)', 50, 30, 90, 42, 'security');
  room('F1-AIRSIDE', 1, 'Airside lobby (stairs, escalators, lift to Floor 2)', 50, 42, 90, 52, 'lobby');
  room('F1-LOUNGE', 1, 'Lounge', 90, 30, 114, 52, 'lounge');
  room('F1-STAFF-PASS', 1, 'Staff passage', 114, 20, 132, 22, 'corridor');
  room('F1-OFFICE-1', 1, 'Office 1', 114, 0, 132, 10, 'office');
  room('F1-OFFICE-2', 1, 'Office 2', 114, 10, 132, 20, 'office');
  room('F1-OPS', 1, 'Operations (scheduling)', 114, 22, 132, 34, 'ops', 'Desk with an office chair on wheels, wall of screens');
  room('F1-STAFF-WC', 1, 'Staff toilets', 114, 34, 132, 42, 'wc');
  room('F1-CREW', 1, 'Crew room', 114, 42, 132, 52, 'office');
  room('F1-STAFF-CORR', 1, 'Staff corridor', 132, 0, 136, 52, 'corridor');
  room('F1-ACADEMY', 1, 'Academy (20 student desks, teacher desk)', 136, 0, 156, 20, 'academy', '20 tables with chairs in 4 rows of 5, teacher desk and chair, screen wall');
  room('F1-OFFICE-3', 1, 'Office 3', 136, 20, 156, 30, 'office');
  room('F1-OFFICE-4', 1, 'Office 4', 136, 30, 156, 40, 'office');
  room('F1-STAFF-ENTR', 1, 'Staff entrance', 136, 40, 156, 52, 'lobby');
  room('F1-BAGHALL', 1, 'Baggage hall (sorting under the walkway)', PIER[0], 52, PIER[1], PG, 'service');
  LO.forEach(([a, b], i) => room('F1-GATE-' + (i + 5), 1, 'Gate ' + (i + 5) + ' (ground, walk-out boarding)', a, PG, b, PN, 'gate'));

  door('D-F1-ENTR-W-1', 1, 50, -4, 3.0, 'h', 'F1-ENTR-W', 'KERB', 'revolving');
  door('D-F1-ENTR-W-2', 1, 50, 0, 3.0, 'h', 'F1-ENTR-W', 'F1-HALL', 'auto-slide');
  door('D-F1-ENTR-C-1', 1, 75, -4, 5.0, 'h', 'F1-ENTR-C', 'KERB', 'auto-slide');
  door('D-F1-ENTR-C-2', 1, 75, 0, 5.0, 'h', 'F1-ENTR-C', 'F1-HALL', 'auto-slide');
  door('D-F1-ENTR-E-1', 1, 100, -4, 3.0, 'h', 'F1-ENTR-E', 'KERB', 'revolving');
  door('D-F1-ENTR-E-2', 1, 100, 0, 3.0, 'h', 'F1-ENTR-E', 'F1-HALL', 'auto-slide');
  door('D-F1-MUSEUM-1', 1, 36, 15, 4.0, 'v', 'F1-MUSEUM', 'F1-HALL', 'auto-slide');
  door('D-F1-WC-M-1', 1, 39.5, 30, 1.2, 'h', 'F1-WC-M', 'F1-HALL', 'swing');
  door('D-F1-WC-F-1', 1, 46.5, 30, 1.2, 'h', 'F1-WC-F', 'F1-HALL', 'swing');
  door('D-F1-SECURITY-1', 1, 62, 30, 6.0, 'h', 'F1-SECURITY', 'F1-HALL', 'auto-slide');
  door('D-F1-SECURITY-2', 1, 78, 30, 6.0, 'h', 'F1-SECURITY', 'F1-HALL', 'auto-slide');
  door('D-F1-AIRSIDE-1', 1, 70, 42, 10.0, 'h', 'F1-AIRSIDE', 'F1-SECURITY', 'one-way');
  door('D-F1-CLEAN-1', 1, 50, 48, 1.0, 'v', 'F1-CLEAN', 'F1-AIRSIDE', 'swing');
  door('D-F1-LOUNGE-1', 1, 90, 47, 2.4, 'v', 'F1-LOUNGE', 'F1-AIRSIDE', 'auto-slide');
  door('D-F1-PLANT-1', 1, 18, 52, 2.0, 'h', 'F1-PLANT', 'F1-BAGHALL', 'secure');
  door('D-F1-STAFF-PASS-1', 1, 114, 21, 1.6, 'v', 'F1-STAFF-PASS', 'F1-HALL', 'secure');
  door('D-F1-STAFF-PASS-2', 1, 132, 21, 1.6, 'v', 'F1-STAFF-PASS', 'F1-STAFF-CORR', 'swing');
  door('D-F1-OFFICE-1-1', 1, 132, 5, 1.0, 'v', 'F1-OFFICE-1', 'F1-STAFF-CORR', 'swing');
  door('D-F1-OFFICE-2-1', 1, 132, 15, 1.0, 'v', 'F1-OFFICE-2', 'F1-STAFF-CORR', 'swing');
  door('D-F1-OPS-1', 1, 132, 28, 1.2, 'v', 'F1-OPS', 'F1-STAFF-CORR', 'secure');
  door('D-F1-STAFF-WC-1', 1, 132, 38, 1.0, 'v', 'F1-STAFF-WC', 'F1-STAFF-CORR', 'swing');
  door('D-F1-CREW-1', 1, 132, 47, 1.2, 'v', 'F1-CREW', 'F1-STAFF-CORR', 'swing');
  door('D-F1-ACADEMY-1', 1, 136, 6, 1.6, 'v', 'F1-ACADEMY', 'F1-STAFF-CORR', 'double');
  door('D-F1-ACADEMY-2', 1, 136, 15, 1.0, 'v', 'F1-ACADEMY', 'F1-STAFF-CORR', 'swing');
  door('D-F1-OFFICE-3-1', 1, 136, 25, 1.0, 'v', 'F1-OFFICE-3', 'F1-STAFF-CORR', 'swing');
  door('D-F1-OFFICE-4-1', 1, 136, 35, 1.0, 'v', 'F1-OFFICE-4', 'F1-STAFF-CORR', 'swing');
  door('D-F1-STAFF-ENTR-1', 1, 136, 46, 1.6, 'v', 'F1-STAFF-ENTR', 'F1-STAFF-CORR', 'secure');
  door('D-F1-STAFF-ENTR-2', 1, 156, 46, 1.6, 'v', 'F1-STAFF-ENTR', 'OUTSIDE', 'secure');
  door('D-F1-STAFF-CORR-1', 1, 134, 52, 1.6, 'h', 'F1-STAFF-CORR', 'F1-BAGHALL', 'secure');
  PAIRS.forEach((a, i) => { room('F1-RAMP-' + (i + 1), 1, 'Ramp services ' + (i + 1) + ' (under Gate ' + (i + 1) + ')', a + 6, PG, a + 34, PN, 'service'); door('D-F1-RAMP-' + (i + 1) + '-1', 1, a + 20, PG, 2.0, 'h', 'F1-RAMP-' + (i + 1), 'F1-BAGHALL', 'secure'); door('D-F1-RAMP-' + (i + 1) + '-2', 1, a + 10, PN, 3.0, 'h', 'F1-RAMP-' + (i + 1), 'APRON', 'secure'); });
  LO.forEach(([a, b], i) => { const n = i + 5;
    door('D-F1-GATE-' + n + '-1', 1, a + 8, PN, 2.4, 'h', 'F1-GATE-' + n, 'APRON', 'auto-slide');
    door('D-F1-GATE-' + n + '-2', 1, b - 8, PN, 2.4, 'h', 'F1-GATE-' + n, 'APRON', 'auto-slide'); });

  // ---------------- FLOOR 2 (upper, +6.00) ----------------
  room('F2-LANDING', 2, 'Landing (seating, walking paths)', 56, 42, 90, 52, 'lobby', 'Rows of chairs, lines of light in the floor leading on');
  room('F2-WC-M', 2, 'Toilets (men)', 90, 42, 104, 47, 'wc');
  room('F2-WC-F', 2, 'Toilets (women, accessible)', 90, 47, 104, 52, 'wc');
  room('F2-TAXFREE', 2, 'Tax Free (walk-through)', 56, 30, 90, 42, 'shop', 'Looks out over the Grand Hall');
  room('F2-FOOD', 2, 'Food Walk (seating, walking area)', 14, 30, 56, 44, 'food');
  for (let i = 0; i < 5; i++) room('F2-EAT-' + (i + 1), 2, 'Eatery ' + (i + 1), 14 + i * 8.4, 44, 14 + (i + 1) * 8.4, 52, 'eatery');
  room('F2-LINK', 2, 'Link to the walkway', 6, 30, 14, 52, 'corridor');
  room('F2-FAMILY', 2, 'Family room', 90, 30, 104, 42, 'room');
  room('F2-BAR', 2, 'Bar (big bar area)', 104, 30, 146, 52, 'bar', 'Island bar, high tables, lounge seats, view over the hall');
  room('F2-WALK', 2, 'Walkway to the gates (moving walkways)', PIER[0], 52, PIER[1], PG, 'walkway');
  UP.forEach(([a, b], i) => room('F2-GATE-' + (i + 1), 2, 'Gate ' + (i + 1) + ' (jetway, glass wall onto the ramp)', a, PG, b, PN, 'gate'));
  LO.forEach(([a, b], i) => room('F2-VIEW-' + (i + 1), 2, 'View bay ' + (i + 1) + ' (seats, windows onto the ramp)', a + 6, PG, b, PN, 'view'));

  door('D-F2-TAXFREE-1', 2, 73, 42, 8.0, 'h', 'F2-TAXFREE', 'F2-LANDING', 'open');
  door('D-F2-TAXFREE-2', 2, 56, 36, 6.0, 'v', 'F2-TAXFREE', 'F2-FOOD', 'open');
  door('D-F2-WC-M-1', 2, 90, 44.5, 1.2, 'v', 'F2-WC-M', 'F2-LANDING', 'swing');
  door('D-F2-WC-F-1', 2, 90, 49.5, 1.2, 'v', 'F2-WC-F', 'F2-LANDING', 'swing');
  for (let i = 0; i < 5; i++) door('D-F2-EAT-' + (i + 1) + '-1', 2, 14 + i * 8.4 + 4.2, 44, 5.0, 'h', 'F2-EAT-' + (i + 1), 'F2-FOOD', 'open');
  door('D-F2-LINK-1', 2, 14, 37, 6.0, 'v', 'F2-LINK', 'F2-FOOD', 'open');
  door('D-F2-LINK-2', 2, 10, 52, 8.0, 'h', 'F2-LINK', 'F2-WALK', 'open');
  door('D-F2-FAMILY-1', 2, 104, 36, 1.6, 'v', 'F2-FAMILY', 'F2-BAR', 'swing');
  door('D-F2-BAR-1', 2, 118, 52, 8.0, 'h', 'F2-BAR', 'F2-WALK', 'open');
  door('D-F2-BAR-2', 2, 136, 52, 8.0, 'h', 'F2-BAR', 'F2-WALK', 'open');
  UP.forEach(([a, b], i) => { const n = i + 1;
    door('D-F2-GATE-' + n + '-1', 2, a + 17, PG, 8.0, 'h', 'F2-GATE-' + n, 'F2-WALK', 'open');
    door('D-F2-GATE-' + n + '-JW', 2, a + 22, PN, 1.8, 'h', 'F2-GATE-' + n, 'J-' + n, 'jetway');
    door('D-F2-VIEW-' + n + '-1', 2, b + 17, PG, 10.0, 'h', 'F2-VIEW-' + n, 'F2-WALK', 'open'); });

  // ---------------- stairs, escalators, lifts ----------------
  V.push({ id: 'S-01', kind: 'stairs+escalators', x0: 58, y0: 43, x1: 66, y1: 51, from: 'F1-AIRSIDE', to: 'F2-LANDING' });
  V.push({ id: 'E-01', kind: 'lift', x0: 67, y0: 46, x1: 70, y1: 49, from: 'F1-AIRSIDE', to: 'F2-LANDING' });
  PAIRS.forEach((a, i) => { V.push({ id: 'S-G' + (i + 1), kind: 'stairs', x0: a + 34.5, y0: PG + 1.5, x1: a + 38.5, y1: PN - 5, from: 'F2-GATE-' + (i + 1), to: 'F1-GATE-' + (i + 5) });
    V.push({ id: 'E-G' + (i + 1), kind: 'lift', x0: a + 35, y0: PN - 4.4, x1: a + 38, y1: PN - 1.4, from: 'F2-GATE-' + (i + 1), to: 'F1-GATE-' + (i + 5) }); });
  V.push({ id: 'S-STAFF', kind: 'stairs', x0: 140, y0: 44, x1: 145, y1: 51, from: 'F1-STAFF-ENTR', to: 'F2-BAR' });

  // ---------------- timetable screens (departures / arrivals) ----------------
  const mon = (id, floor, x, y, kind, room) => M.push({ id, floor, x, y, kind, room });
  mon('M-F1-01', 1, 62, 27, 'departures wall', 'F1-HALL'); mon('M-F1-02', 1, 88, 27, 'arrivals wall', 'F1-HALL');
  mon('M-F1-03', 1, 50, 6, 'departures totem', 'F1-HALL'); mon('M-F1-04', 1, 100, 6, 'departures totem', 'F1-HALL');
  mon('M-F1-05', 1, 70, 10, 'departures totem', 'F1-HALL'); mon('M-F1-06', 1, 80, 10, 'arrivals totem', 'F1-HALL');
  mon('M-F1-07', 1, 80, 50, 'departures', 'F1-AIRSIDE'); mon('M-F1-08', 1, 102, 50, 'departures', 'F1-LOUNGE');
  mon('M-F2-01', 2, 82, 51, 'departures pair', 'F2-LANDING'); mon('M-F2-02', 2, 35, 43, 'departures pair', 'F2-FOOD');
  mon('M-F2-03', 2, 125, 50, 'departures pair', 'F2-BAR');
  [-40, 40, 122, 200].forEach((x, i) => mon('M-F2-' + String(4 + i).padStart(2, '0'), 2, x, 53, 'departures', 'F2-WALK'));
  PAIRS.forEach((a, i) => { mon('M-F2-G' + (i + 1), 2, a + 26, PG + 1, 'gate screen', 'F2-GATE-' + (i + 1)); mon('M-F1-G' + (i + 5), 1, a + 58, PG + 1, 'gate screen', 'F1-GATE-' + (i + 5)); });

  // ---------------- jetways and stands ----------------
  PAIRS.forEach((a, i) => { const cx = Math.round((-62 + i * 2 * 286 / 7) * 100) / 100, cw = Math.round((-62 + (i * 2 + 1) * 286 / 7) * 100) / 100;   // 40.86 m apart, as in the 3D terminal
    // as in the Babylon terminal (fixtures.ts): out of the gate at x0 + 22, the rotunda 5.2 m out on its column, the moving
    // tunnel from 6.6 m out down to the aircraft's front door
    // the static corridor straight out from the gate's jetway door, the rotunda at its end, the jetway (18.5 m) to the front door
    const jg = jetwayAt(a + 28, cx, NOSE_J);
    J.push({ id: 'J-' + (i + 1), gate: 'F2-GATE-' + (i + 1), door: 'D-F2-GATE-' + (i + 1) + '-JW', x: a + 28, y: PN, corridor: jg.corridor, rotunda: jg.rotunda, cab: [cx + 2.4, NOSE_J + 5.5] });
    S.push({ id: 'STAND-' + (i + 1), gate: 'F2-GATE-' + (i + 1), kind: 'jetway stand', x: cx, nose: NOSE_J });
    S.push({ id: 'STAND-' + (i + 5), gate: 'F1-GATE-' + (i + 5), kind: 'walk-out stand', x: cw, nose: NOSE_W }); });

  // ---------------- the wave roof over the Grand Hall and the kerb ----------------
  // A leaf-shaped roof: its front edge swings out over the kerb, three long waves run across it, each crest carrying a
  // lens of skylight; it rests on white branching tree columns. roofY0(x) = its front edge; height roofH(x, y).
  const RX0 = 26, RX1 = 124, RY1 = 34;
  const ex = (x) => Math.max(0, Math.sin(Math.PI * (x - RX0) / (RX1 - RX0)));
  const roofY0 = (x) => -7 - 9 * Math.pow(ex(x), 0.8);
  const roofV = (x, y) => Math.min(1, Math.max(0, (y - roofY0(x)) / (RY1 - roofY0(x))));
  const roofH = (x, y) => { const e = ex(x), v = roofV(x, y), ey = Math.sin(Math.PI * v); return 13 + 4.6 * ey + 2.8 * e + 2.6 * Math.cos(2 * Math.PI * (x - 75) / 32.7) * Math.pow(ey, 0.7) * e - 1.2 * (1 - v); };
  const SKY = [43.3, 75, 106.7];   // crest lines carrying the skylights
  const TREES = []; for (const x of [46, 75, 104]) for (const y of [6, 22]) TREES.push({ id: 'C-' + (TREES.length + 1), x, y }); for (const x of [56, 94]) TREES.push({ id: 'C-' + (TREES.length + 1), x, y: -9 });
  const roof = { x0: RX0, x1: RX1, y1: RY1, y0: roofY0, h: roofH, v: roofV, sky: SKY, trees: TREES };

  return { roof, rooms: R, doors: D, vertical: V, monitors: M, jetways: J, stands: S, pier: PIER, PG, PN, rental: { hall: [173, 7, 201, 49], garage: [202, 4, 272, 50], walk: [156.3, 21.6, 173.5, 28.4], front: [128, -20, 300, 7.4], roofH: 11, garageH: 13.6 }, pairs: PAIRS, upper: UP, lower: LO,
    levels: { F1: 0, F2: 6.0, roofLow: 12.0 } };
})();

// Mýrdalssandur Airport (BIAP / VTX), the airfield of your own terminal: runway 08/26 (true 068°/248°, magnetic about 078°), 4,000 m × 60 m, Code 4F (Airbus A380) to EASA
// CS ADR-DSN; parallel taxiway A on the terminal side, B on the cargo side; entries/exits at both ends and the middle;
// the terminal apron with stands 1-8 at the pier and the new A380 stand 9 at the apron's east end; the cargo apron.
// Metres. x east, y north; the same axes and origin as TERMINAL and the Babylon.js terminal (the pier's glass front at y = 82).
export const AIRFIELD: any = (() => {
  // ---- design figures (EASA CS ADR-DSN, Code 4F, precision approach runway) ----
  const CODE = {
    rwyWidth: 60, rwyShoulder: 7.5,               // runway 60 m, runway + shoulders 75 m
    twyWidth: 25, twyShoulder: 17.5,              // taxiway 25 m, taxiway + shoulders 60 m
    rwyToTwyMin: 190, rwyToTwy: 260,              // minimum 190 m; built at 260 m: an A380 on A passes behind an A380 waiting
                                                  // at a holding position with 40 m to spare (107.5 + 72.7 long + 39.9 half span)
    twyToTwyMin: 97.5, twyToLane: 180,            // minimum 97.5 m; taxiway A to apron taxilane T at 180 m: a whole A380
                                                  // (72.7 m) waits on a link with 47.4 m (half span + 7.5 m) clear of both
    taxilaneToObject: 50.5,                       // aircraft stand taxilane centre line to object
    holdingPosition: 107.5,                       // runway-holding position from the runway centre line
    wingtip: { C: 4.5, E: 7.5, F: 7.5 },          // clearance between aircraft on stands and objects
  };
  const TY = 206, AY = TY + CODE.twyToLane;      // apron taxilane T: 50.5 m behind the tails at the stands (y 206); A (y 386)
  const RY = AY + CODE.rwyToTwy, RX0 = -1919, RX1 = 2081;   // runway centre line (y 618); 4,000 m: threshold 08 (west), 26 (east)
  const BY = RY + CODE.rwyToTwy, KY = BY + CODE.twyToLane;  // taxiway B (y 878), cargo taxilane K (y 1058)
  const runway = { id: 'RWY 08/26', x0: RX0, x1: RX1, y: RY, w: CODE.rwyWidth, sh: CODE.rwyShoulder, ends: [{ id: '08', x: RX0, dir: 1, disp: 250 }, { id: '26', x: RX1, dir: -1, disp: 250 }], stopway: 60,
    // the 250 m added at each end is used for the take-off run and the landing roll but not for touching down: the landing
    // thresholds stay where the 3,500 m runway's ends were (displaced thresholds). TORA 4,000 m, LDA 3,750 m each way.
    declared: { TORA: 4000, TODA: 4000, ASDA: 4060, LDA: 3750 } };
  // taxiways: centre lines (polylines), width, kind
  const T = [];
  const twy = (id, pts, kind, w) => T.push({ id, pts, kind: kind || 'taxiway', w: w || CODE.twyWidth, sh: kind === 'taxilane' ? 0 : CODE.twyShoulder });
  // at the runway's ends A and B turn into A1/A3 and B1/B3 along a gentle curve (centre line radius CR, 75 m: more than the
  // A380 needs, so the turn is smooth and the wheels keep well inside the pavement); A2/B2 meet A/B at right angles
  const CR = 75, XW = RX0 + 20, XE = RX1 - 20, corners = [];
  twy('A', [[XW + CR, AY], [XE - CR, AY]]);
  twy('B', [[XW + CR, BY], [XE - CR, BY]]);
  twy('A1', [[XW, AY + CR], [XW, RY]], 'link'); twy('A2', [[81, AY], [81, RY]], 'link'); twy('A3', [[XE, AY + CR], [XE, RY]], 'link');
  twy('B1', [[XW, BY - CR], [XW, RY]], 'link'); twy('B2', [[81, BY], [81, RY]], 'link'); twy('B3', [[XE, BY - CR], [XE, RY]], 'link');
  // the turn radius (centre line) where each link meets: the middle exits A2/B2 75 m both ends (an A380 turning off the
  // runway follows it smoothly), the runway-end links 60 m onto the runway, the apron links 50 m
  for (const t of T) if (t.kind === 'link') t.rt = /2$/.test(t.id) ? 75 : /^[PQ]/.test(t.id) ? 50 : 60;
  for (const [id, main, x, y, sx, oy] of [['A1', 'A', XW, AY, 1, 1], ['A3', 'A', XE, AY, -1, 1], ['B1', 'B', XW, BY, 1, -1], ['B3', 'B', XE, BY, -1, -1]]) {
    T.find(q => q.id === id).corner = true; corners.push({ id: 'CURVE-' + main + '-' + id, link: id, main, x, y, sx, oy, r: CR, w: CODE.twyWidth, sh: CODE.twyShoulder }); }
  twy('P1', [[-130, TY], [-130, AY]], 'link'); twy('P2', [[150, TY], [150, AY]], 'link'); twy('P3', [[362, TY], [362, AY]], 'link');
  twy('Q1', [[200, KY], [200, BY]], 'link'); twy('Q2', [[620, KY], [620, BY]], 'link');
  twy('T', [[-140, TY], [372, TY]], 'taxilane'); twy('K', [[190, KY], [630, KY]], 'taxilane');
  // ---- stands. Terminal stands 1-8: Code C (up to A321 / 737 MAX, span ≤ 36 m), spaced evenly along the 322 m pier
  // (nose towards the terminal, dir -1: the nose points south; cargo noses point north) so that every pair of wingtips keeps more than 4.5 m; stand 9 for the A380 (Code F) past the pier's east end,
  // set back towards the landside so its tail keeps 50.5 m from taxilane T; cargo stands C1-C4 Code F (747-8F).
  const S = [];
  const order = [1, 5, 2, 6, 3, 7, 4, 8];        // west to east along the pier: jetway gate, then its walk-out gate
  order.forEach((n, i) => S.push({ id: 'STAND-' + n, code: 'C', x: TERMINAL.stands.find(q => q.id === 'STAND-' + n).x, nose: n <= 4 ? TERMINAL.stands[0].nose : TERMINAL.stands[1].nose, dir: -1, span: 36, len: 44.5, ac: 'A320 · A321 · 737', jetway: n <= 4 ? 'J-' + n : null, from: 'T' }));
  S.push({ id: 'STAND-9', code: 'F', x: 300, nose: 78, dir: -1, span: 80, len: 72.7, ac: 'A380 · 747-8 · 777-9', jetway: null, from: 'T' });
  [260, 347.5, 435, 522.5].forEach((x, i) => S.push({ id: 'C' + (i + 1), code: 'F', x, nose: KY + 130, dir: 1, span: 80, len: 76.3, ac: '747-8F · 777F · A350F', jetway: null, from: 'K', cargo: true }));
  // ---- runway-holding positions (Pattern A), mandatory signs, runway guard lights ----
  const H = [];
  for (const t of T.filter(q => /^[AB][123]$/.test(q.id))) {
    const side = t.id[0] === 'A' ? -1 : 1, x = t.pts[0][0], y = RY + side * CODE.holdingPosition;
    const end = t.id[1] === '1' ? '08' : t.id[1] === '3' ? '26' : null;
    // the runway designation as seen from the holding position: the left number is the threshold on the left
    const legend = end || (side < 0 ? '08-26' : '26-08');
    H.push({ id: 'HP-' + t.id, twy: t.id, x, y, side, legend, guard: [[x - 16, y], [x + 16, y]] });
  }
  // sign assemblies: at each holding position both sides; location sign (black/yellow) outboard of the mandatory sign
  const G = [];
  for (const h of H) { const off = 34, face = -h.side;   // the signs face aircraft coming from the taxiway
    G.push({ id: 'SG-' + h.twy + '-L', kind: 'mandatory', x: h.x + (face > 0 ? -off : off), y: h.y - h.side * 2, face, panels: [['loc', h.twy], ['man', h.legend]] });
    G.push({ id: 'SG-' + h.twy + '-R', kind: 'mandatory', x: h.x + (face > 0 ? off : -off), y: h.y - h.side * 2, face, panels: [['man', h.legend], ['loc', h.twy]] }); }
  // direction signs on A and B before each link (yellow with black arrows), with the taxiway's own location sign
  for (const [tw, y, side] of [['A', AY, -1], ['B', BY, 1]]) for (const n of ['2']) { const x = T.find(q => q.id === tw + n).pts[0][0];
    for (const dir of [1, -1]) { const sx = x - dir * 70; if (sx < RX0 + 20 || sx > RX1 - 20) continue;
      G.push({ id: 'SG-' + tw + '-' + tw + n + (dir > 0 ? 'E' : 'W'), kind: 'direction', x: sx, y: y + (dir > 0 ? 34 : -34), face: dir > 0 ? 'east' : 'west',
        panels: [['loc', tw], ['dir', (dir > 0) === (side < 0) ? '← ' + tw + n : tw + n + ' →']] }); } }
  // on the apron: where P1-P3 meet A, and Q1-Q2 meet B
  for (const id of ['P1', 'P2', 'P3']) { const x = T.find(q => q.id === id).pts[0][0]; G.push({ id: 'SG-' + id + '-A', kind: 'direction', x: x - 34, y: AY - 40, face: 'north', panels: [['loc', id], ['dir', '← A'], ['dir', 'A →']] }); }
  for (const id of ['Q1', 'Q2']) { const x = T.find(q => q.id === id).pts[0][0]; G.push({ id: 'SG-' + id + '-B', kind: 'direction', x: x + 34, y: BY + 40, face: 'south', panels: [['loc', id], ['dir', '← B'], ['dir', 'B →']] }); }
  // the airport boundary: the grass square of sheet L-01. Everything inside it (grass, runway, taxiways, aprons, the
  // terminal, its stands and the other buildings) is levelled to the airport's elevation; outside it the ground and its
  // mountains are untouched. The level ground blends into the real ground only within the boundary's outer 100 m, and
  // nothing is built in that band (the nearest pavement or building is more than 100 m in).
  const boundary = { x0: -2000, y0: -170, x1: 2240, y1: 1320 }, flatten = { inside: 'boundary', blendInsideM: 100, outside: 'untouched' };
  const cargoBuilding = { id: 'CARGO-1', x0: 200, y0: KY + 145, x1: 590, y1: KY + 215 };
  // the airport itself
  const airport = { icao: 'BIAP', iata: 'VTX', name: 'Mýrdalssandur', city: 'Mýrdalssandur', country: 'Iceland', hdg: 68, magvar: -10, elevFt: 130,
    // the plan's origin (the terminal's) in the site's frame: u along the runway, v to its left (see site/index.ts)
    planU: -81, planV: -1482 };
  return { airport, CODE, boundary, flatten, runway, taxiways: T, corners, stands: S, holds: H, signs: G, cargoBuilding, ys: { RY, AY, BY, TY, KY } };
})();

/** The runway's designators for the site it is built at (west end first): the markings, the holding positions'
 *  legends and the mandatory signs follow. Mýrdalssandur: 08/26. */
export function designate(a: string, b: string) {
  const R = AIRFIELD.runway, old = [R.ends[0].id, R.ends[1].id]; if (old[0] === a && old[1] === b) return;
  const map = (s: string) => s.split('-').map(t => t === old[0] ? a : t === old[1] ? b : t).join('-');
  R.ends[0].id = a; R.ends[1].id = b; R.id = 'RWY ' + a + '/' + b;
  for (const h of AIRFIELD.holds) h.legend = map(h.legend);
  for (const g of AIRFIELD.signs) g.panels = g.panels.map(([k, t]) => [k, k === 'man' ? map(t) : t]);
}
