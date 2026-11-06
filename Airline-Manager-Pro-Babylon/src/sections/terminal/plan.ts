// The passenger terminal, concept 1, from the architect's drawings (sheets A-01 to A-04): every room, door, stair, lift,
// timetable screen, roof column, jetway and stand with its id from the schedule (A-04), at its place in metres.
// Axes: x east, z north (towards the ramp), y up. Floor 1 at ±0.00, Floor 2 at +6.00, the pier's roof at +12.00, the
// wave roof's crest at +22.41. The terminal runs from x 0 (the museum's west side) to x 156; the pier from x −80 to 242.
//   Floor 1: the kerb, three entrances, the Grand Hall (check-in desks 1–24 on two islands, bag drop), the museum,
//   the plant room, toilets, cleaners, security (6 lanes), the airside lobby (stairs S-01 and lift E-01 to Floor 2),
//   the lounge, the staff wing (offices 1–4, operations, crew room, staff toilets, the staff corridor and passage, the
//   Academy, the staff entrance), the baggage hall under the walkway, ramp services 1–4 and walk-out gates 5–8.
//   Floor 2: the landing, Tax Free, the Food Walk with eateries 1–5, the link, toilets, the family room, the big bar,
//   the walkway to the gates with moving walkways, jetway gates 1–4 with view bays 1–4; the Grand Hall's void below.
export type Fl = 1 | 2;
export interface Room { id: string; f: Fl; name: string; x0: number; z0: number; x1: number; z1: number; kind: string; glass?: string; h?: number }
export interface Door { id: string; f: Fl; a: string; b: string; type: 'revolving' | 'slide' | 'swing' | 'secure' | 'oneway' | 'double' | 'open' | 'jetway' | 'museum'; w: number; x: number; z: number; along: 'x' | 'z' }
export interface Stair { id: string; x0: number; z0: number; x1: number; z1: number; dir: 'x+' | 'x-' | 'z+' | 'z-'; from: string; to: string }
export interface Lift { id: string; x: number; z: number; face: number; from: string; to: string }
export interface Screen { id: string; f: Fl; kind: 'departures wall' | 'arrivals wall' | 'departures totem' | 'arrivals totem' | 'departures' | 'departures pair' | 'gate screen'; room: string; x: number; z: number; y: number; face: number }
export const F2Y = 6, F1CEIL = 5.4, F2CEIL = 11.4, ROOF = 12;
/** The pier: the walkway (and the baggage hall under it) 16 m wide from z 52, the gates' side from PG, their glass wall onto the ramp at PN. */
export const PW = 16, PG = 52 + PW, PN = PG + 14;

// ---- Floor 1 ----
const R1: Room[] = [
  { id: 'F1-HALL', f: 1, name: 'Grand Hall (departures, check-in, bag drop)', x0: 36, z0: 0, x1: 114, z1: 30, kind: 'hall', glass: 's' },
  { id: 'F1-ENTR-W', f: 1, name: 'Entrance West (vestibule)', x0: 44, z0: -4, x1: 56, z1: 0, kind: 'vestibule', glass: 'nswe' },
  { id: 'F1-ENTR-C', f: 1, name: 'Main Entrance (vestibule)', x0: 67, z0: -4, x1: 83, z1: 0, kind: 'vestibule', glass: 'nswe' },
  { id: 'F1-ENTR-E', f: 1, name: 'Entrance East (vestibule)', x0: 95, z0: -4, x1: 107, z1: 0, kind: 'vestibule', glass: 'nswe' },
  { id: 'F1-MUSEUM', f: 1, name: 'Museum (Vortex Gallery)', x0: 0, z0: 0, x1: 36, z1: 30, kind: 'museum' },
  { id: 'F1-PLANT', f: 1, name: 'Plant room', x0: 0, z0: 30, x1: 36, z1: 52, kind: 'plant' },
  { id: 'F1-WC-M', f: 1, name: 'Toilets (men)', x0: 36, z0: 30, x1: 43, z1: 44, kind: 'wc' },
  { id: 'F1-WC-F', f: 1, name: 'Toilets (women, accessible)', x0: 43, z0: 30, x1: 50, z1: 44, kind: 'wc' },
  { id: 'F1-CLEAN', f: 1, name: 'Cleaners store', x0: 36, z0: 44, x1: 50, z1: 52, kind: 'clean' },
  { id: 'F1-SECURITY', f: 1, name: 'Security (6 lanes)', x0: 50, z0: 30, x1: 90, z1: 42, kind: 'security' },
  { id: 'F1-AIRSIDE', f: 1, name: 'Airside lobby (stairs, escalators, lift to Floor 2)', x0: 50, z0: 42, x1: 90, z1: 52, kind: 'airside' },
  { id: 'F1-LOUNGE', f: 1, name: 'Lounge', x0: 90, z0: 30, x1: 114, z1: 52, kind: 'lounge', h: 4.8 },
  { id: 'F1-OFFICE-1', f: 1, name: 'Office 1', x0: 114, z0: 0, x1: 132, z1: 10, kind: 'office' },
  { id: 'F1-OFFICE-2', f: 1, name: 'Office 2', x0: 114, z0: 10, x1: 132, z1: 20, kind: 'office' },
  { id: 'F1-STAFF-PASS', f: 1, name: 'Staff passage', x0: 114, z0: 20, x1: 132, z1: 22, kind: 'passage' },
  { id: 'F1-OPS', f: 1, name: 'Operations (scheduling)', x0: 114, z0: 22, x1: 132, z1: 34, kind: 'ops' },
  { id: 'F1-STAFF-WC', f: 1, name: 'Staff toilets', x0: 114, z0: 34, x1: 132, z1: 42, kind: 'wc' },
  { id: 'F1-CREW', f: 1, name: 'Crew room', x0: 114, z0: 42, x1: 132, z1: 52, kind: 'crew' },
  { id: 'F1-STAFF-CORR', f: 1, name: 'Staff corridor', x0: 132, z0: 0, x1: 136, z1: 52, kind: 'corridor' },
  { id: 'F1-ACADEMY', f: 1, name: 'Academy (20 student desks, teacher desk)', x0: 136, z0: 0, x1: 156, z1: 20, kind: 'academy' },
  { id: 'F1-OFFICE-3', f: 1, name: 'Office 3', x0: 136, z0: 20, x1: 156, z1: 30, kind: 'office' },
  { id: 'F1-OFFICE-4', f: 1, name: 'Office 4', x0: 136, z0: 30, x1: 156, z1: 40, kind: 'office' },
  { id: 'F1-STAFF-ENTR', f: 1, name: 'Staff entrance', x0: 136, z0: 40, x1: 156, z1: 52, kind: 'staffentr' },
  { id: 'F1-BAGHALL', f: 1, name: 'Baggage hall (sorting under the walkway)', x0: -80, z0: 52, x1: 242, z1: PG, kind: 'baghall' },
];
/** The pier's modules, west to east: ramp services k (under gate k) and walk-out gate k+4 beside it. */
export const MOD = [0, 1, 2, 3].map(i => -72.6 + 80.55 * i);
for (let k = 0; k < 4; k++) {
  const x0 = MOD[k];
  R1.push({ id: `F1-RAMP-${k + 1}`, f: 1, name: `Ramp services ${k + 1} (under Gate ${k + 1})`, x0, z0: PG, x1: x0 + 28, z1: PN, kind: 'ramp' });
  R1.push({ id: `F1-GATE-${k + 5}`, f: 1, name: `Gate ${k + 5} (ground, walk-out boarding)`, x0: x0 + 28, z0: PG, x1: x0 + 68, z1: PN, kind: 'gate1', glass: 'n' });
}
// ---- Floor 2 ----
const R2: Room[] = [
  { id: 'F2-LINK', f: 2, name: 'Link to the walkway', x0: 6, z0: 30, x1: 14, z1: 52, kind: 'link', glass: 's' },
  { id: 'F2-FOOD', f: 2, name: 'Food Walk (seating, walking area)', x0: 14, z0: 30, x1: 56, z1: 44, kind: 'food', glass: 's' },
  { id: 'F2-LANDING', f: 2, name: 'Landing (seating, walking paths)', x0: 56, z0: 42, x1: 90, z1: 52, kind: 'landing' },
  { id: 'F2-TAXFREE', f: 2, name: 'Tax Free (walk-through)', x0: 56, z0: 30, x1: 90, z1: 42, kind: 'taxfree', glass: 's' },
  { id: 'F2-WC-M', f: 2, name: 'Toilets (men)', x0: 90, z0: 42, x1: 104, z1: 47, kind: 'wc' },
  { id: 'F2-WC-F', f: 2, name: 'Toilets (women, accessible)', x0: 90, z0: 47, x1: 104, z1: 52, kind: 'wc' },
  { id: 'F2-FAMILY', f: 2, name: 'Family room', x0: 90, z0: 30, x1: 104, z1: 42, kind: 'family', glass: 's' },
  { id: 'F2-BAR', f: 2, name: 'Bar (big bar area)', x0: 104, z0: 30, x1: 146, z1: 52, kind: 'bar', glass: 's' },
  { id: 'F2-WALK', f: 2, name: 'Walkway to the gates (moving walkways)', x0: -80, z0: 52, x1: 242, z1: PG, kind: 'walk' },
];
for (let k = 0; k < 5; k++) R2.push({ id: `F2-EAT-${k + 1}`, f: 2, name: `Eatery ${k + 1}`, x0: 14 + 8.4 * k, z0: 44, x1: 14 + 8.4 * (k + 1), z1: 52, kind: 'eatery' });
for (let k = 0; k < 4; k++) {
  const x0 = MOD[k];
  R2.push({ id: `F2-GATE-${k + 1}`, f: 2, name: `Gate ${k + 1} (jetway, glass wall onto the ramp)`, x0, z0: PG, x1: x0 + 34, z1: PN, kind: 'gate2', glass: 'n' });
  R2.push({ id: `F2-VIEW-${k + 1}`, f: 2, name: `View bay ${k + 1} (seats, windows onto the ramp)`, x0: x0 + 34, z0: PG, x1: x0 + 68, z1: PN, kind: 'view', glass: 'n' });
}
export const ROOMS: Room[] = [...R1, ...R2];
export const room = (id: string) => ROOMS.filter(r => r.id === id)[0];

// ---- doors (A-04): what they join, their kind and width; where they are ----
const D: Door[] = [];
const d = (id: string, f: Fl, a: string, b: string, type: Door['type'], w: number, x: number, z: number, along: 'x' | 'z') => D.push({ id, f, a, b, type, w, x, z, along });
d('D-F1-ENTR-W-1', 1, 'F1-ENTR-W', 'KERB', 'revolving', 3.0, 50, -4, 'x'); d('D-F1-ENTR-W-2', 1, 'F1-ENTR-W', 'F1-HALL', 'slide', 3.0, 50, 0, 'x');
d('D-F1-ENTR-C-1', 1, 'F1-ENTR-C', 'KERB', 'slide', 5.0, 75, -4, 'x'); d('D-F1-ENTR-C-2', 1, 'F1-ENTR-C', 'F1-HALL', 'slide', 5.0, 75, 0, 'x');
d('D-F1-ENTR-E-1', 1, 'F1-ENTR-E', 'KERB', 'revolving', 3.0, 101, -4, 'x'); d('D-F1-ENTR-E-2', 1, 'F1-ENTR-E', 'F1-HALL', 'slide', 3.0, 101, 0, 'x');
d('D-F1-MUSEUM-1', 1, 'F1-MUSEUM', 'F1-HALL', 'museum', 4.0, 36, 15, 'z');
d('D-F1-WC-M-1', 1, 'F1-WC-M', 'F1-HALL', 'swing', 1.2, 39.5, 30, 'x'); d('D-F1-WC-F-1', 1, 'F1-WC-F', 'F1-HALL', 'swing', 1.2, 46.5, 30, 'x');
d('D-F1-SECURITY-1', 1, 'F1-SECURITY', 'F1-HALL', 'slide', 6.0, 62, 30, 'x'); d('D-F1-SECURITY-2', 1, 'F1-SECURITY', 'F1-HALL', 'slide', 6.0, 78, 30, 'x');
d('D-F1-AIRSIDE-1', 1, 'F1-AIRSIDE', 'F1-SECURITY', 'oneway', 10, 70, 42, 'x');
d('D-F1-CLEAN-1', 1, 'F1-CLEAN', 'F1-AIRSIDE', 'swing', 1.0, 50, 48, 'z');
d('D-F1-LOUNGE-1', 1, 'F1-LOUNGE', 'F1-AIRSIDE', 'slide', 2.4, 90, 47, 'z');
d('D-F1-PLANT-1', 1, 'F1-PLANT', 'F1-BAGHALL', 'secure', 2.0, 18, 52, 'x');
d('D-F1-STAFF-PASS-1', 1, 'F1-STAFF-PASS', 'F1-HALL', 'secure', 1.6, 114, 21, 'z'); d('D-F1-STAFF-PASS-2', 1, 'F1-STAFF-PASS', 'F1-STAFF-CORR', 'swing', 1.6, 132, 21, 'z');
d('D-F1-OFFICE-1-1', 1, 'F1-OFFICE-1', 'F1-STAFF-CORR', 'swing', 1.0, 132, 5, 'z'); d('D-F1-OFFICE-2-1', 1, 'F1-OFFICE-2', 'F1-STAFF-CORR', 'swing', 1.0, 132, 15, 'z');
d('D-F1-OPS-1', 1, 'F1-OPS', 'F1-STAFF-CORR', 'secure', 1.2, 132, 28, 'z'); d('D-F1-STAFF-WC-1', 1, 'F1-STAFF-WC', 'F1-STAFF-CORR', 'swing', 1.0, 132, 38, 'z');
d('D-F1-CREW-1', 1, 'F1-CREW', 'F1-STAFF-CORR', 'swing', 1.2, 132, 47, 'z');
d('D-F1-ACADEMY-1', 1, 'F1-ACADEMY', 'F1-STAFF-CORR', 'double', 1.6, 136, 5, 'z'); d('D-F1-ACADEMY-2', 1, 'F1-ACADEMY', 'F1-STAFF-CORR', 'swing', 1.0, 136, 15, 'z');
d('D-F1-OFFICE-3-1', 1, 'F1-OFFICE-3', 'F1-STAFF-CORR', 'swing', 1.0, 136, 25, 'z'); d('D-F1-OFFICE-4-1', 1, 'F1-OFFICE-4', 'F1-STAFF-CORR', 'swing', 1.0, 136, 35, 'z');
d('D-F1-STAFF-ENTR-1', 1, 'F1-STAFF-ENTR', 'F1-STAFF-CORR', 'secure', 1.6, 136, 46, 'z'); d('D-F1-STAFF-ENTR-2', 1, 'F1-STAFF-ENTR', 'OUTSIDE', 'secure', 1.6, 156, 46, 'z');
d('D-F1-STAFF-CORR-1', 1, 'F1-STAFF-CORR', 'F1-BAGHALL', 'secure', 1.6, 134, 52, 'x');
for (let k = 0; k < 4; k++) { const x0 = MOD[k], n = k + 1, g = k + 5;
  d(`D-F1-RAMP-${n}-1`, 1, `F1-RAMP-${n}`, 'F1-BAGHALL', 'secure', 2.0, x0 + 14, PG, 'x'); d(`D-F1-RAMP-${n}-2`, 1, `F1-RAMP-${n}`, 'APRON', 'secure', 3.0, x0 + 5, PN, 'x');
  d(`D-F1-GATE-${g}-1`, 1, `F1-GATE-${g}`, 'APRON', 'slide', 2.4, x0 + 36, PN, 'x'); d(`D-F1-GATE-${g}-2`, 1, `F1-GATE-${g}`, 'APRON', 'slide', 2.4, x0 + 60, PN, 'x');
  d(`D-F2-GATE-${n}-1`, 2, `F2-GATE-${n}`, 'F2-WALK', 'open', 8.0, x0 + 12, PG, 'x'); d(`D-F2-GATE-${n}-JW`, 2, `F2-GATE-${n}`, `J-${n}`, 'jetway', 1.8, x0 + 22, PN, 'x');
  d(`D-F2-VIEW-${n}-1`, 2, `F2-VIEW-${n}`, 'F2-WALK', 'open', 10, x0 + 51, PG, 'x'); }
d('D-F2-TAXFREE-1', 2, 'F2-TAXFREE', 'F2-LANDING', 'open', 8.0, 73, 42, 'x'); d('D-F2-TAXFREE-2', 2, 'F2-TAXFREE', 'F2-FOOD', 'open', 6.0, 56, 36, 'z');
d('D-F2-WC-M-1', 2, 'F2-WC-M', 'F2-LANDING', 'swing', 1.2, 90, 44.5, 'z'); d('D-F2-WC-F-1', 2, 'F2-WC-F', 'F2-LANDING', 'swing', 1.2, 90, 49.5, 'z');
for (let k = 0; k < 5; k++) d(`D-F2-EAT-${k + 1}-1`, 2, `F2-EAT-${k + 1}`, 'F2-FOOD', 'open', 5.0, 14 + 8.4 * (k + 0.5), 44, 'x');
d('D-F2-LINK-1', 2, 'F2-LINK', 'F2-FOOD', 'open', 6.0, 14, 37, 'z'); d('D-F2-LINK-2', 2, 'F2-LINK', 'F2-WALK', 'open', 7.6, 10, 52, 'x');
d('D-F2-FAMILY-1', 2, 'F2-FAMILY', 'F2-BAR', 'swing', 1.6, 104, 36, 'z');
d('D-F2-BAR-1', 2, 'F2-BAR', 'F2-WALK', 'open', 8.0, 118, 52, 'x'); d('D-F2-BAR-2', 2, 'F2-BAR', 'F2-WALK', 'open', 8.0, 132, 52, 'x');
export const DOORS = D;
export const doorH = (dr: Door) => dr.type === 'open' ? 3.2 : dr.type === 'museum' ? 3.0 : dr.w >= 5 ? 3.0 : dr.w >= 2.4 ? 2.7 : 2.25;

// ---- stairs and lifts: Floor 1 at the start of each run, Floor 2 at its end ----
export const STAIRS: Stair[] = [{ id: 'S-01', x0: 58, z0: 44, x1: 66, z1: 50, dir: 'x+', from: 'F1-AIRSIDE', to: 'F2-LANDING' },
  { id: 'S-STAFF', x0: 140, z0: 43, x1: 143, z1: 51, dir: 'z-', from: 'F1-STAFF-ENTR', to: 'F2-BAR' }];
export const LIFTS: Lift[] = [{ id: 'E-01', x: 69, z: 47.5, face: -Math.PI / 2, from: 'F1-AIRSIDE', to: 'F2-LANDING' }];
for (let k = 0; k < 4; k++) { const x0 = MOD[k];
  STAIRS.push({ id: `S-G${k + 1}`, x0: x0 + 28.3, z0: PG + 1.5, x1: x0 + 31.1, z1: PN - 1.5, dir: 'z-', from: `F1-GATE-${k + 5}`, to: `F2-GATE-${k + 1}` });
  LIFTS.push({ id: `E-G${k + 1}`, x: x0 + 32.9, z: PN - 1.4, face: -Math.PI / 2, from: `F1-GATE-${k + 5}`, to: `F2-GATE-${k + 1}` }); }

// ---- timetable screens ----
export const SCREENS: Screen[] = [
  { id: 'M-F1-01', f: 1, kind: 'departures wall', room: 'F1-HALL', x: 70, z: 29.75, y: 4.2, face: Math.PI },
  { id: 'M-F1-02', f: 1, kind: 'arrivals wall', room: 'F1-HALL', x: 86, z: 29.75, y: 4.2, face: Math.PI },
  { id: 'M-F1-03', f: 1, kind: 'departures totem', room: 'F1-HALL', x: 50, z: 6.1, y: 0, face: Math.PI },
  { id: 'M-F1-04', f: 1, kind: 'departures totem', room: 'F1-HALL', x: 99.6, z: 6.1, y: 0, face: Math.PI },
  { id: 'M-F1-05', f: 1, kind: 'departures totem', room: 'F1-HALL', x: 70, z: 10, y: 0, face: Math.PI },
  { id: 'M-F1-06', f: 1, kind: 'arrivals totem', room: 'F1-HALL', x: 82, z: 10, y: 0, face: Math.PI },
  { id: 'M-F1-07', f: 1, kind: 'departures', room: 'F1-AIRSIDE', x: 80, z: 51.75, y: 2.6, face: Math.PI },
  { id: 'M-F1-08', f: 1, kind: 'departures', room: 'F1-LOUNGE', x: 104, z: 30.25, y: 2.4, face: 0 },
  { id: 'M-F2-01', f: 2, kind: 'departures pair', room: 'F2-LANDING', x: 80, z: 51.75, y: 2.6, face: Math.PI },
  { id: 'M-F2-02', f: 2, kind: 'departures pair', room: 'F2-FOOD', x: 22.4, z: 43.75, y: 2.4, face: Math.PI },
  { id: 'M-F2-03', f: 2, kind: 'departures pair', room: 'F2-BAR', x: 108, z: 51.75, y: 2.6, face: Math.PI },
  { id: 'M-F2-04', f: 2, kind: 'departures', room: 'F2-WALK', x: -40, z: 52.25, y: 3.0, face: 0 },
  { id: 'M-F2-05', f: 2, kind: 'departures', room: 'F2-WALK', x: 45, z: 52.25, y: 3.0, face: 0 },
  { id: 'M-F2-06', f: 2, kind: 'departures', room: 'F2-WALK', x: 95, z: 52.25, y: 3.0, face: 0 },
  { id: 'M-F2-07', f: 2, kind: 'departures', room: 'F2-WALK', x: 190, z: 52.25, y: 3.0, face: 0 },
];
for (let k = 0; k < 4; k++) { const x0 = MOD[k];
  SCREENS.push({ id: `M-F2-G${k + 1}`, f: 2, kind: 'gate screen', room: `F2-GATE-${k + 1}`, x: x0 + 22, z: PG + 0.25, y: 2.6, face: 0 });
  SCREENS.push({ id: `M-F1-G${k + 5}`, f: 1, kind: 'gate screen', room: `F1-GATE-${k + 5}`, x: x0 + 48, z: PG + 0.25, y: 2.6, face: 0 }); }
// ---- the wave roof's tree columns, the jetways, the stands ----
export const COLUMNS: [string, number, number][] = [['C-1', 46, 6], ['C-2', 46, 22], ['C-3', 75, 6], ['C-4', 75, 22], ['C-5', 104, 6], ['C-6', 104, 22], ['C-7', 56, -9], ['C-8', 94, -9]];
/** The stands (an aircraft's nose at nz, pointing at the pier): jetway stands 1–4 off gates 1–4, walk-out 5–8 off gates 5–8. */
/** A jetway gate's static corridor and rotunda for its stand (nose nz): the cab's round part 5.65 m right of the stand's
 *  centre line at the front door (5.5 m behind the nose), the rotunda 13 m from it (the jetway 18.5 m overall) straight out
 *  from the gate's jetway door; the corridor runs from the pier's glass (PN) to the rotunda's edge (1.8 m). */
export function jetwayAt(gateX: number, standX: number, nz: number) { void nz; const dx = standX + 5.65 - gateX, dz = Math.sqrt(13 * 13 - dx * dx), rz = PN + 20 + 5.5 - dz; return { rotunda: [gateX, rz], corridor: rz - 1.8 - PN }; }
/** The stands' centre lines along the pier, west to east (jetway, walk-out, jetway, ...). */
export const STAND_X = (i: number) => Math.round((-62 + i * 286 / 7) * 100) / 100;
export const STANDS: { id: string; x: number; nz: number; kind: 'jetway' | 'walk-out'; gate: string }[] = [];
for (let k = 0; k < 4; k++) { const x0 = MOD[k];
  // spaced evenly along the pier, 40.86 m apart (x -62 to 224, as on the airport's sheets): every pair of wingtips keeps
  // more than the 4.5 m an A320 / A321 / 737 needs (36 m span); the jetways reach each stand's front door
  STANDS.push({ id: `STAND-${k + 1}`, x: STAND_X(k * 2), nz: PN + 26, kind: 'jetway', gate: `F2-GATE-${k + 1}` });
  STANDS.push({ id: `STAND-${k + 5}`, x: STAND_X(k * 2 + 1), nz: PN + 28, kind: 'walk-out', gate: `F1-GATE-${k + 5}` }); }
/** The wave roof: its underside's height at (x, z), three crests running north at x 45, 75 and 105 (the lens skylights). */
export const WAVE = { x0: 24, x1: 126, z1: 34 };
export function waveSouth(x: number) { const t = (x - 75) / 51; return -7 - 9 * Math.max(0, 1 - t * t); }
export function waveH(x: number, z: number) { return 18.4 + 3.4 * Math.cos(2 * Math.PI * (x - 75) / 30) - 0.006 * (z - 16) * (z - 16) - 0.0015 * Math.max(0, Math.abs(x - 75) - 36) ** 2; }
/** Where you step in: the Grand Hall, just inside the main entrance, facing into the hall. */
export const SPAWN = { x: 79, z: 2.8, yaw: 0, f: 1 as Fl };
/** Outside, where you can walk: the kerb under the roof, the apron. */
export const OUTSIDE: { id: string; name?: string; x0: number; z0: number; x1: number; z1: number }[] = [{ id: 'KERB', x0: 20, z0: -20, x1: 130, z1: -4 }, { id: 'APRON', x0: -95, z0: PN, x1: 255, z1: PN + 64 }, { id: 'OUTSIDE', x0: 156, z0: 40, x1: 170, z1: 52 },
  // the rental car centre beside the east wing (rental.ts): its pick-up lanes and front, the hall, the covered walk, the garage's ready/return level
  { id: 'RENTAL-FRONT', name: 'Rental car centre · pick-up lanes', x0: 128, z0: -20, x1: 300, z1: 7.4 }, { id: 'RENTAL-HALL', name: 'Rental car centre · customer hall', x0: 173, z0: 7, x1: 201, z1: 49 },
  { id: 'RENTAL-WALK', name: 'Covered walk to the rental car centre', x0: 156.3, z0: 21.6, x1: 173.5, z1: 28.4 }, { id: 'RENTAL-GARAGE', name: 'Rental car centre · ready / return', x0: 202, z0: 4, x1: 272, z1: 50 },
  { id: 'RENTAL-GARAGE-DOOR', name: 'Rental car centre · customer hall', x0: 200.4, z0: 26, x1: 202.6, z1: 31 }];
export function inRoom(r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number, m = 0) { return x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m; }
export function roomAt(f: Fl, x: number, z: number): Room | null { for (const r of ROOMS) if (r.f === f && inRoom(r, x, z)) return r; return null; }
