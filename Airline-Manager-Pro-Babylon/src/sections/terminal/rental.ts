// The rental car centre (design 1, Wing), beside the terminal's east wing: one thin roof swept like a wing over the
// customer hall, white on top and warm timber underneath, its leading edge reaching out over the pick-up lanes on four
// raked columns; the glass hall with the six rental companies' desks; behind it the ready/return garage (three decks
// and its roof, 140 bays a level), wrapped in perforated aluminium, with a spiral ramp at its east end; the covered walk
// from the terminal; the quick turnaround (wash and charge) east of the ramp.
//
// Everything is placed under the RENTAL node, whose origin is the building's south-west corner (world x 172, z 4).
// Every tree and every car is its own object with an id and a name:
//   RENTAL/TREE-001…      metadata { kind 'TREE', name, species }
//   RENTAL/CAR-001…       metadata { kind 'CAR', name, rental { company, type, power, status, bay, … }, drive { … } }
//   RENTAL/SHUTTLE-1…     the shuttle buses
// The cars are stand-ins (simple shapes) until real models replace them: swapCarModel(K, id, mesh) puts a model in a
// car's place and keeps its id, name and rental data. RENTAL_BAYS lists every empty bay in the garage (id, level, x,
// z, yaw in world coordinates) for placing the fleet later.
import { MeshBuilder, Mesh, Vector3, VertexData, TransformNode, PBRMaterial, AbstractMesh } from '@babylonjs/core';
import { Kit, signC } from './kit';
import { RT } from './rental-tex';

export const RENTAL_AT = { x: 172, z: 4 };
const OX = RENTAL_AT.x, OZ = RENTAL_AT.z, LV = [0, 3.4, 6.8, 10.2];

/** The rental companies at the desks (made-up names; their colours on desks, signs and cars). */
export const RENTAL_COMPANIES = [
  { id: 'NORDRIVE', name: 'Nordrive', bg: '#0F3B66', fg: '#FFFFFF' }, { id: 'AURORA', name: 'Aurora Rent', bg: '#2E7D78', fg: '#FFFFFF' },
  { id: 'FJORD', name: 'Fjord Motors', bg: '#A3262A', fg: '#FFFFFF' }, { id: 'VELO', name: 'Velo Cars', bg: '#E0B12E', fg: '#14202E' },
  { id: 'SKYLINE', name: 'Skyline', bg: '#14202E', fg: '#7FD3FF' }, { id: 'GREENLINE', name: 'Greenline EV', bg: '#4F9A3A', fg: '#FFFFFF' },
];
/** The kinds of car: their stand-in sizes and what they are, for the rental agreements later. */
export const CAR_TYPES: { [k: string]: { name: string; size: [number, number, number]; seats: number; doors: number; cabin: number } } = {
  sedan: { name: 'Sedan', size: [1.82, 1.45, 4.7], seats: 5, doors: 4, cabin: 0.5 }, station: { name: 'Station car', size: [1.84, 1.5, 4.85], seats: 5, doors: 5, cabin: 0.62 },
  jeep: { name: 'Jeep / SUV', size: [1.95, 1.8, 4.6], seats: 5, doors: 5, cabin: 0.6 }, sports: { name: 'Sports car', size: [1.9, 1.22, 4.45], seats: 2, doors: 2, cabin: 0.4 },
};
export interface RentalBay { id: string; level: number; x: number; z: number; yaw: number }
export const RENTAL_BAYS: RentalBay[] = [];

export function buildRental(K: Kit) {
  const { sc, M } = K;
  const root = new TransformNode('RENTAL', sc); root.parent = K.groups.SITE; root.position.set(OX, 0, OZ); root.metadata = { id: 'RENTAL', kind: 'building', name: 'Rental car centre (Wing)' }; K.rooms.RENTAL = root;
  const tex = (c: HTMLCanvasElement, u = 1, v = 1) => K.tex(c, u, v);
  const mat = (key: string, o: any) => K.pbr({ key, ...o });
  const R = {
    soffit: mat('rentalSoffit', { tex: tex(RT.planks('#C98A52', '#6E3A18', false, 18), 1, 1), rough: 0.5 }),
    roofTop: mat('rentalRoofTop', { col: '#F5F7F9', rough: 0.18, coat: 0.6 }),
    perf: (() => { const m = mat('rentalPerforated', { tex: tex(RT.perforated(), 1, 1), metal: 0.45, rough: 0.3 }); const t = m.albedoTexture as any; t.hasAlpha = true; m.useAlphaFromAlbedoTexture = true; m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND; m.alphaCutOff = 0.4; m.backFaceCulling = false; m.twoSidedLighting = true; return m; })(),
    concrete: mat('rentalConcrete', { tex: tex(RT.concrete(), 1, 1), rough: 0.92 }), concreteLight: mat('rentalConcreteLight', { tex: tex(RT.concrete('#D8D5CE'), 1, 1), rough: 0.9 }),
    deck: mat('rentalDeck', { tex: tex(RT.deck(), 28, 1), rough: 0.85 }), paving: mat('rentalPaving', { tex: tex(RT.paving(), 1, 1), rough: 0.8 }),
    asphalt: mat('rentalAsphalt', { tex: tex(RT.asphalt(), 1, 1), rough: 0.88 }), terrazzo: mat('rentalTerrazzo', { tex: tex(RT.terrazzo(), 1, 1), rough: 0.2, coat: 0.3 }),
    slats: mat('rentalSlats', { tex: tex(RT.planks('#D9B48A', '#8A6038', true, 24, 512), 1, 1), rough: 0.55 }), mullion: mat('rentalMullion', { col: '#2A2E33', rough: 0.4, metal: 0.6 }),
    bark: mat('rentalBark', { tex: tex(RT.bark(), 1, 1), rough: 0.9 }), leaf: mat('rentalLeaf', { tex: tex(RT.leaves('#4E7E36'), 2, 2), rough: 0.85 }), leafDark: mat('rentalLeafDark', { tex: tex(RT.leaves('#33602A'), 2, 2), rough: 0.85 }),
    leafBirch: mat('rentalLeafBirch', { tex: tex(RT.leaves('#7A9A42'), 2, 2), rough: 0.85 }), tyre: mat('rentalTyre', { col: '#17181A', rough: 0.9 }), rim: mat('rentalRim', { col: '#B8BEC6', metal: 0.8, rough: 0.3 }),
    carGlass: mat('rentalCarGlass', { col: '#16202A', rough: 0.05, metal: 0.5 }), lineW: mat('rentalLine', { col: '#F2F2EE', rough: 0.6 }), seat: mat('rentalSeat', { col: '#1F4E8C', rough: 0.6 }),
  };
  // ---- the structure: local meshes, merged per material at the end and put under RENTAL ----
  const parts = new Map<any, Mesh[]>(); const st = (m: Mesh, mt: any, cast = true) => { m.material = mt; let l = parts.get(mt); if (!l) parts.set(mt, l = []); l.push(m); (m as any)._cast = cast; return m; };
  const box = (w: number, h: number, d: number, mt: any, x: number, y: number, z: number, ry = 0, cast = true) => { const b = MeshBuilder.CreateBox(K.nm('rb'), { width: w, height: h, depth: d }, sc); b.position.set(x, y, z); b.rotation.y = ry; return st(b, mt, cast); };
  const cylM = (d: number, h: number, mt: any, x: number, y: number, z: number, tess = 24, dTop?: number) => { const c = MeshBuilder.CreateCylinder(K.nm('rc'), { diameterBottom: d, diameterTop: dTop == null ? d : dTop, height: h, tessellation: tess }, sc); c.position.set(x, y, z); return st(c, mt); };
  const surface = (nu: number, nv: number, f: (u: number, v: number) => Vector3, mt: any, su = 1, sv = 1, cast = true) => { const pos: number[] = [], idx: number[] = [], uv: number[] = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const p = f(i / nu, j / nv); pos.push(p.x, p.y, p.z); uv.push(i / nu * su, j / nv * sv); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const m = new Mesh(K.nm('rs'), sc), vd = new VertexData(), nr: number[] = []; VertexData.ComputeNormals(pos, idx, nr); vd.positions = pos; vd.indices = idx; vd.normals = nr; vd.uvs = uv; vd.applyToMesh(m); (mt as any).backFaceCulling = false; (mt as any).twoSidedLighting = true; return st(m, mt, cast); };
  const panel = (ax: number, az: number, bx: number, bz: number, y0: number, y1: number, mt: any, per = 4, cast = false) => surface(1, 1, (u, v) => new Vector3(ax + (bx - ax) * u, y0 + (y1 - y0) * v, az + (bz - az) * u), mt, Math.hypot(bx - ax, bz - az) / per, (y1 - y0) / per, cast);
  const ground = (x0: number, z0: number, x1: number, z1: number, y: number, mt: any, per: number) => surface(1, 1, (u, v) => new Vector3(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * v), mt, (x1 - x0) / per, (z1 - z0) / per, false);
  const blk = (x0: number, z0: number, x1: number, z1: number) => K.block(1, OX + x0, OZ + z0, OX + x1, OZ + z1);
  const sign = (par: TransformNode, text: string, x: number, y: number, z: number, w: number, h: number, ry: number, bg: string, fg: string, k = 1) => {
    const p = MeshBuilder.CreatePlane(K.nm('rsg'), { width: w, height: h }, sc); p.material = K.picture(signC(text, bg, fg, 1024, Math.round(1024 * h / w), `700 ${Math.round(1024 * h / w * 0.56)}px Arial, sans-serif`), k); p.parent = par; p.position.set(x, y, z); p.rotation.y = ry; p.metadata = par.metadata; p.isPickable = false; return p; };

  // ---- the grounds: the pick-up lanes, the pavement along the front, the bay lines ----
  ground(-44, -24, 128, -6, 0.008, R.asphalt, 6); ground(-16, -6, 128, 0, 0.02, R.paving, 4); ground(-16, 0, 30, 3, 0.02, R.paving, 4); box(144, 0.16, 0.3, R.concreteLight, 56, 0.08, -6, 0, false);
  for (let x = -40; x < 120; x += 4) box(0.14, 0.012, 3.2, R.lineW, x, 0.016, -11, 0, false);
  for (let x = -40; x < 120; x += 9) box(4, 0.012, 0.16, R.lineW, x, 0.016, -19, 0, false);
  { const z = ground(116, 0, 128, 46, 0.012, R.paving, 4); void z; }
  // ---- the covered walk from the terminal's east wing to the hall ----
  for (let x = -15; x < 0; x += 3) for (const z of [17.6, 24.4]) cylM(0.22, 4.2, M.steel, x, 2.1, z, 12);
  box(16.2, 0.28, 7.2, M.whiteGloss, -8, 4.3, 21); box(16, 0.04, 6.8, R.slats, -8, 4.15, 21, 0, false); ground(-16, 17.6, 0, 24.4, 0.022, R.terrazzo, 4);
  panel(-16, 17.6, 0, 17.6, 0.02, 4.15, M.glass, 100); panel(-16, 24.4, 0, 24.4, 0.02, 4.15, M.glass, 100);
  for (let k = 0; k < 4; k++) box(1.2, 0.04, 0.3, M.light, -14 + k * 4, 4.12, 21, 0, false);
  blk(-16, 17.3, 0, 17.75); blk(-16, 24.25, 0, 24.7);
  // ---- the customer hall: glass on a dark frame, a slatted timber ceiling, terrazzo ----
  const HX0 = 1, HX1 = 29, HZ0 = 3, HZ1 = 45, HH = 8;
  ground(HX0, HZ0, HX1, HZ1, 0.024, R.terrazzo, 3); box(HX1 - HX0, 0.05, HZ1 - HZ0, R.slats, (HX0 + HX1) / 2, HH - 0.03, (HZ0 + HZ1) / 2, 0, false); box(HX1 - HX0 + 0.4, 0.5, HZ1 - HZ0 + 0.4, M.white, (HX0 + HX1) / 2, HH + 0.25, (HZ0 + HZ1) / 2);
  for (const [ax, az, bx, bz, doors] of [[HX0, HZ0, HX1, HZ0, [[12, 18]]], [HX1, HZ0, HX1, HZ1, [[22, 27]]], [HX1, HZ1, HX0, HZ1, []], [HX0, HZ1, HX0, HZ0, [[18.5, 23.5]]]] as [number, number, number, number, number[][]][]) {
    const alongX = az === bz, L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 3);
    const lo = alongX ? Math.min(ax, bx) : Math.min(az, bz), hi = alongX ? Math.max(ax, bx) : Math.max(az, bz); let u = lo;
    const seg = (p0: number, p1: number, y0: number, y1: number, mt: any) => alongX ? panel(p0, az, p1, az, y0, y1, mt, 100) : panel(ax, p0, ax, p1, y0, y1, mt, 100);
    // the glass between the doors (over each doorway a glass transom), walls you can't walk through, the doorways open
    for (const [d0, d1] of [...doors, [hi, hi]]) { if (d0 > u) { seg(u, d0, 0.02, HH, M.glass); if (alongX) blk(u, az - 0.2, d0, az + 0.2); else blk(ax - 0.2, u, ax + 0.2, d0); } u = d1; }
    for (const [d0, d1] of doors) { seg(d0, d1, 3.0, HH, M.glass); seg(d0, d1, 2.9, 3.05, R.mullion); }
    for (let k = 0; k <= n; k++) { const t = k / n, pu = (alongX ? ax + (bx - ax) * t : az + (bz - az) * t); if (doors.some(([d0, d1]) => pu > d0 + 0.05 && pu < d1 - 0.05)) continue; box(0.1, HH, 0.16, R.mullion, ax + (bx - ax) * t, HH / 2, az + (bz - az) * t, alongX ? 0 : Math.PI / 2, false); }
    panel(ax, az, bx, bz, HH - 0.3, HH, R.mullion, 100);
  }
  for (let x = HX0 + 3; x < HX1 - 2; x += 5) for (let z = HZ0 + 4; z < HZ1 - 3; z += 6) box(2.4, 0.05, 0.4, M.light, x, HH - 0.1, z, 0, false);
  // the six desks, each its own object with its company's sign
  const dw = (HX1 - HX0 - 2) / RENTAL_COMPANIES.length;
  RENTAL_COMPANIES.forEach((c, i) => { const x = HX0 + 1 + dw * (i + 0.5), o = K.obj('RENTAL', 'DESK', x, 0, HZ1 - 3.2, 0, `RENTAL/DESK-${c.id}`); o.metadata.name = `${c.name} desk`; o.metadata.company = c.id;
    K.box(o, dw - 0.8, 1.05, 0.9, M.white, 0, 0.52, 0); K.box(o, dw - 0.7, 0.06, 1.0, M.marbleDark, 0, 1.08, 0); K.box(o, dw - 0.8, 0.18, 0.92, K.pbr({ key: 'rentalDesk' + c.id, col: c.bg, rough: 0.4 }), 0, 0.2, 0);
    K.box(o, 0.5, 0.32, 0.03, M.screenBlack, -0.6, 1.3, 0.1); K.box(o, 0.5, 0.32, 0.03, M.screenBlack, 0.6, 1.3, 0.1);
    const s = K.obj('RENTAL', 'DESK-SIGN', x, 3.1, HZ1 - 0.6, 0, `RENTAL/DESK-${c.id}/SIGN`); s.metadata.name = `${c.name} sign`; K.box(s, dw - 1.1, 0.9, 0.08, M.black, 0, 0, 0.05); sign(s, c.name.toUpperCase(), 0, 0, -0.01, dw - 1.2, 0.8, 0, c.bg, c.fg, 1.0);
    blk(x - (dw - 0.8) / 2, HZ1 - 3.7, x + (dw - 0.8) / 2, HZ1 - 2.7); });
  // queue posts, seats, a tree in a planter, the big sign
  for (let k = 0; k < 9; k++) { const q = K.obj('RENTAL', 'QUEUE-POST', HX0 + 3 + k * 3, 0, HZ1 - 7); K.cyl(q, 0.04, 0.95, M.chrome, 0, 0.48, 0); K.cyl(q, 0.16, 0.03, M.chrome, 0, 0.015, 0); if (k < 8) K.box(q, 3, 0.05, 0.01, M.navy, 1.5, 0.92, 0); }
  for (let k = 0; k < 3; k++) { const o = K.obj('RENTAL', 'SEATS', HX0 + 5 + k * 6, 0, 12, 0); for (let s = 0; s < 5; s++) { K.box(o, 0.56, 0.08, 0.5, R.seat, -1.24 + s * 0.62, 0.45, 0); K.box(o, 0.56, 0.5, 0.06, R.seat, -1.24 + s * 0.62, 0.72, -0.24); } K.box(o, 3.1, 0.06, 0.08, M.steel, 0, 0.32, 0); blk(HX0 + 5 + k * 6 - 1.6, 11.6, HX0 + 5 + k * 6 + 1.6, 12.4); }
  { const p = K.obj('RENTAL', 'PLANTER', 15, 0, 26, 0, 'RENTAL/HALL/PLANTER'); K.cyl(p, 1.4, 0.6, M.whiteGloss, 0, 0.3, 0, 1.3, 32); K.circle(1, OX + 15, OZ + 26, 1.5); }
  { const s = K.obj('RENTAL', 'SIGN', 15, 6.6, HZ0 - 0.1, 0, 'RENTAL/SIGN-CAR-RENTAL'); s.metadata.name = 'Car rental sign'; K.box(s, 14.2, 1.8, 0.12, M.black, 0, 0, 0.08); sign(s, 'CAR RENTAL', 0, 0, -0.01, 14, 1.7, 0, '#14202E', '#FFFFFF', 0.9); }
  // ---- the wing: one thin roof, white over timber, on four raked columns ----
  const wingY = (u: number, v: number) => 9.2 + 3.2 * Math.sin(Math.PI * v) * (0.6 + 0.4 * u) + 1.5 * u;
  const wingP = (u: number, v: number, dy: number) => new Vector3(-6 + 42 * u, wingY(u, v) + dy, -16 + 64 * v - 6 * Math.sin(Math.PI * u) * (1 - v));
  const wing = K.obj('RENTAL', 'ROOF', 0, 0, 0, 0, 'RENTAL/ROOF-WING'); wing.metadata.name = 'Wing roof';
  const wt = surface(48, 36, (u, v) => wingP(u, v, 0.45), R.roofTop, 1, 1), ws = surface(48, 36, (u, v) => wingP(u, v, 0), R.soffit, 5, 16);
  const edge: Vector3[] = []; for (let i = 0; i <= 48; i++) edge.push(wingP(i / 48, 0, 0.22)); const ed = MeshBuilder.CreateTube(K.nm('we'), { path: edge, radius: 0.26, tessellation: 10 }, sc); st(ed, R.roofTop);
  for (let i = 0; i <= 12; i++) { const u = i / 12, p = wingP(u, 0.02, -0.06); box(0.12, 0.04, 0.12, M.light, p.x, p.y, p.z, 0, false); }
  for (let i = 1; i < 6; i++) for (let j = 1; j < 8; j++) { const p = wingP(i / 6, j / 8, -0.04); if (p.x > HX0 && p.x < HX1 && p.z > HZ0 && p.z < HZ1) continue; cylM(0.35, 0.05, M.light, p.x, p.y, p.z, 12); }
  for (const [x, z, dx, dz] of [[4, -6, -2, -4], [26, -6, 2, -4], [4, 46, -2, 0], [26, 46, 2, 0]]) { const top = wingP((x + dx + 6) / 42, (z + dz + 16) / 64, -0.2);
    const t = MeshBuilder.CreateTube(K.nm('wc'), { path: [new Vector3(x, 0, z), new Vector3(x + dx, top.y, z + dz)], radius: 0.34, tessellation: 16, cap: Mesh.CAP_ALL }, sc); st(t, M.whiteGloss); cylM(1.0, 0.3, R.concreteLight, x, 0.15, z, 20); K.circle(1, OX + x, OZ + z, 0.6); }
  void wt; void ws;
  // ---- the garage: three decks and the roof, columns, upstands, bay lines; perforated aluminium round it ----
  const GX0 = 30, GX1 = 100, GZ0 = 0, GZ1 = 46;
  LV.forEach((y, i) => { if (i > 0) box(GX1 - GX0, 0.36, GZ1 - GZ0, R.concrete, (GX0 + GX1) / 2, y - 0.18, (GZ0 + GZ1) / 2);
    const top = surface(1, 1, (u, v) => new Vector3(GX0 + (GX1 - GX0) * u, y + 0.012, GZ0 + (GZ1 - GZ0) * v), R.deck, (GX1 - GX0) / 2.5, 1, false); void top;
    if (i > 0) { panel(GX0, GZ0, GX1, GZ0, y, y + 1.05, R.concreteLight, 4); panel(GX0, GZ1, GX1, GZ1, y, y + 1.05, R.concreteLight, 4); panel(GX1, GZ0, GX1, GZ1, y, y + 1.05, R.concreteLight, 4); }
    for (const [a, b, yaw] of [[1, 6, Math.PI], [12, 17, 0], [17, 22, Math.PI], [28, 33, 0], [33, 38, Math.PI]] as number[][]) { let n = 0; for (let x = GX0 + 1.25; x < GX1 - 1; x += 2.5) RENTAL_BAYS.push({ id: `RENTAL/BAY-L${i}-${String.fromCharCode(65 + [1, 12, 17, 28, 33].indexOf(a))}${String(++n).padStart(2, '0')}`, level: i, x: OX + x, z: OZ + (a + b) / 2, yaw }); } });
  for (let x = GX0 + 8.4; x < GX1 - 1; x += 8.4) for (const z of [9, 25, 41]) { for (let i = 0; i < LV.length - 1; i++) box(0.5, LV[i + 1] - LV[i] - 0.36, 0.5, R.concreteLight, x, LV[i] + (LV[i + 1] - LV[i] - 0.36) / 2, z); K.circle(1, OX + x, OZ + z, 0.4); }
  for (let i = 1; i < LV.length; i++) for (const z of [9, 25, 41]) box(GX1 - GX0 - 2, 0.04, 0.16, M.light, (GX0 + GX1) / 2, LV[i] - 0.4, z, 0, false);
  for (const [ax, az, bx, bz] of [[GX0, GZ0 - 0.6, GX1 + 0.6, GZ0 - 0.6], [GX1 + 0.6, GZ0 - 0.6, GX1 + 0.6, GZ1 + 0.6], [GX1 + 0.6, GZ1 + 0.6, GX0, GZ1 + 0.6]]) panel(ax, az, bx, bz, 1.2, 11.6, R.perf, 6);
  for (let x = GX0; x <= GX1; x += 6) { box(0.12, 10.6, 0.3, R.mullion, x, 6.3, GZ0 - 0.75, 0, false); box(0.12, 10.6, 0.3, R.mullion, x, 6.3, GZ1 + 0.75, 0, false); }
  blk(GX0, GZ0 - 0.8, GX1 + 0.8, GZ0 + 0.2); blk(GX0, GZ1 - 0.2, GX1 + 0.8, GZ1 + 0.8); blk(GX1 - 0.2, GZ0, GX1 + 0.8, GZ1);
  { const s = K.obj('RENTAL', 'SIGN', 65, 9.2, GZ0 - 0.85, 0, 'RENTAL/SIGN-READY-RETURN'); s.metadata.name = 'Ready / return sign'; sign(s, 'READY · RETURN', 0, 0, 0, 12, 1.4, 0, '#14202E', '#F2C230', 0.9); }
  // the spiral ramp at the east end, wrapped in the same perforated skin
  { const cx = 108, cz = 23, r = 10, top = 10.2, turns = top / 3.4; surface(Math.round(turns * 56), 2, (u, v) => { const a = u * turns * Math.PI * 2, rr = r - 3 + 6 * v; return new Vector3(cx + rr * Math.cos(a), u * top + 0.2, cz + rr * Math.sin(a)); }, R.concrete, turns * 14, 1);
    cylM(5.4, top + 1.2, R.concreteLight, cx, (top + 1.2) / 2, cz, 40); surface(96, 1, (u, v) => new Vector3(cx + 13.3 * Math.cos(u * Math.PI * 2), 0.6 + (top + 0.8) * v, cz + 13.3 * Math.sin(u * Math.PI * 2)), R.perf, 14, 2, false); K.circle(1, OX + cx, OZ + cz, 13.8); }
  // the quick turnaround: wash and charge, east of the ramp
  { const q = K.obj('RENTAL', 'QUICK-TURNAROUND', 131, 0, 23, 0, 'RENTAL/QUICK-TURNAROUND'); q.metadata.name = 'Quick turnaround (wash, charge)';
    box(18, 5.2, 34, R.concreteLight, 131, 2.6, 23); box(18.6, 0.4, 34.6, M.white, 131, 5.4, 23); panel(122, 8, 122, 38, 0.3, 4.8, R.perf, 6); sign(q, 'WASH · CHARGE', -9.06, 4.0, 0, 8, 0.9, -Math.PI / 2, '#14202E', '#7FD3FF', 0.9);
    for (let k = 0; k < 4; k++) { const c = K.obj('RENTAL', 'CHARGER', 119.5, 0, 12 + k * 6, Math.PI / 2, `RENTAL/CHARGER-${k + 1}`); c.metadata.name = `Charger ${k + 1}`; K.box(c, 0.5, 1.6, 0.3, M.white, 0, 0.8, 0); K.box(c, 0.4, 0.3, 0.02, M.light, 0, 1.3, 0.16); } blk(122, 6, 140, 40); }

  // ---- trees, each its own object ----
  let tn = 0; const tree = (x: number, z: number, h: number, species: 'lime' | 'birch' | 'oak') => { const id = `RENTAL/TREE-${String(++tn).padStart(3, '0')}`, o = K.obj('RENTAL', 'TREE', x, 0, z, 0, id);
    o.metadata.name = `Tree ${tn} (${species})`; o.metadata.species = species; const trunkM = species === 'birch' ? R.bark : M.trunk, lf = species === 'birch' ? R.leafBirch : species === 'oak' ? R.leafDark : R.leaf;
    K.cyl(o, 0.16 * h / 7, h * 0.55, trunkM, 0, h * 0.27, 0, 0.1 * h / 7, 10);
    for (let k = 0; k < 5; k++) { const a = k * 1.3, r = k ? 0.9 * h / 7 : 0; K.ball(o, h * (0.24 - k * 0.012), k % 2 ? lf : R.leafDark, Math.cos(a) * r, h * (0.62 + (k % 3) * 0.09), Math.sin(a) * r, 0.86); }
    K.circle(1, OX + x, OZ + z, 0.35); };
  for (let x = -8; x < 118; x += 11) tree(x + (tn % 3) * 0.7, -22.5, 6.5 + (tn % 4) * 0.5, tn % 3 === 1 ? 'birch' : 'lime');
  for (let z = 6; z < 46; z += 9) tree(144, z, 7 + (tn % 3), 'oak');
  for (const [x, z] of [[-14, 30], [-14, 40], [-6, 34], [-14, 8], [-6, 4]]) tree(x, z, 6 + (tn % 3), 'birch');
  // ---- the rental cars, ready in the pick-up lanes in front of the hall ----
  let cn = 0; const COLORS = ['#F4F5F6', '#C3C8CE', '#16181B', '#4A4F57', '#1F4E8C', '#A3262A', '#2E7D78', '#E9EAEC', '#8C9198', '#E0B12E'];
  const types = ['sedan', 'station', 'jeep', 'sports'], powers = ['electric', 'petrol', 'hybrid', 'diesel'];
  for (let x = -38; x < 118; x += 4) { if ((Math.floor(x) * 7 + 13) % 10 < 4) continue;
    const k = cn % RENTAL_COMPANIES.length, comp = RENTAL_COMPANIES[k], type = types[(cn * 3 + 1) % 4], power = comp.id === 'GREENLINE' ? 'electric' : powers[(cn * 5 + 2) % 4], color = type === 'sports' && cn % 2 ? '#E0B12E' : COLORS[(cn * 7) % COLORS.length];
    rentalCar(K, R, ++cn, x + 2, -11, 0, { company: comp.id, type, power, color, bay: `LANE-${String(Math.round((x + 40) / 4) + 1).padStart(2, '0')}` }); }
  // the shuttle buses at their stop
  for (let k = 0; k < 2; k++) { const o = K.obj('RENTAL', 'SHUTTLE', 30 + k * 40, 0, -18, 0, `RENTAL/SHUTTLE-${k + 1}`); o.metadata.name = `Shuttle bus ${k + 1}`;
    K.box(o, 2.6, 2.9, 12, K.pbr({ key: 'rentalBus' + k, col: k ? '#1F4E8C' : '#F2F3F5', rough: 0.3, coat: 0.5 }), 0, 1.75, 0); K.box(o, 2.62, 1.0, 11.6, R.carGlass, 0, 2.3, 0); for (const z of [-4, 4]) for (const s of [-1, 1]) K.part('wheel', () => MeshBuilder.CreateCylinder('w', { diameter: 1, height: 1, tessellation: 18 }, sc), R.tyre, o, s * 1.2, 0.5, z, 0, 0, Math.PI / 2, 1.0, 0.35, 1.0);
    o.rotation.y = Math.PI / 2; blk(30 + k * 40 - 6.1, -19.4, 30 + k * 40 + 6.1, -16.6); }

  // ---- merge the structure per material, under RENTAL ----
  const holder = new TransformNode('RENTAL/STRUCTURE', sc); holder.parent = root; holder.metadata = { id: 'RENTAL/STRUCTURE', kind: 'structure', room: 'RENTAL' };
  for (const [mt, list] of parts) { const casts = list.some(m => (m as any)._cast); for (let i = 0; i < list.length; i += 200) { const mm = Mesh.MergeMeshes(list.slice(i, i + 200), true, true, undefined, false, false); if (!mm) continue;
    mm.name = `RENTAL/STRUCTURE-${mt.name}`; mm.material = mt; mm.parent = holder; mm.receiveShadows = true; mm.isPickable = false; mm.metadata = { id: mm.name, kind: 'structure', room: 'RENTAL' }; if (casts && mt !== M.glass && mt !== R.perf) K.casters.push(mm as AbstractMesh); } }
}

/** A rental car: its own object with its id, name and rental data; a stand-in body until a real model replaces it. */
function rentalCar(K: Kit, R: any, n: number, x: number, z: number, yaw: number, o: { company: string; type: string; power: string; color: string; bay: string }) {
  const { sc, M } = K, t = CAR_TYPES[o.type], comp = RENTAL_COMPANIES.find(c => c.id === o.company)!, id = `RENTAL/CAR-${String(n).padStart(3, '0')}`, plate = `RC ${String(100 + n * 7).padStart(3, '0')}`;
  const c = K.obj('RENTAL', 'CAR', x, 0, z, yaw, id);
  c.metadata.name = `${comp.name} · ${t.name} · ${o.power} · ${plate}`;
  c.metadata.rental = { company: o.company, type: o.type, power: o.power, color: o.color, plate, status: 'ready', bay: o.bay, agreement: null };
  c.metadata.drive = { drivable: true, seats: t.seats, doors: t.doors, driverSide: 'left', enterFrom: 'left', modelSlot: `cars/${o.type}`, placeholder: true };
  const [w, h, L] = t.size, paint = K.pbr({ key: 'rentalPaint' + o.color, col: o.color, metal: 0.55, rough: 0.26, coat: 0.9 }), body = new TransformNode(id + '/BODY', sc); body.parent = c; body.metadata = c.metadata;
  const bodyH = h * 0.46, cabH = h - bodyH - 0.32;
  K.box(body, w, bodyH, L, paint, 0, 0.3 + bodyH / 2, 0);
  K.box(body, w * 0.86, cabH, L * t.cabin, R.carGlass, 0, 0.3 + bodyH + cabH / 2, -L * 0.04); K.box(body, w * 0.84, 0.05, L * t.cabin * 0.92, paint, 0, 0.3 + bodyH + cabH + 0.02, -L * 0.04);
  for (const s of [-1, 1]) { K.box(body, 0.32, 0.1, 0.04, M.light, s * w * 0.32, 0.3 + bodyH * 0.7, L / 2 + 0.01); K.box(body, 0.32, 0.1, 0.04, K.glow('#FF2A1A', 1.2), s * w * 0.32, 0.3 + bodyH * 0.7, -L / 2 - 0.01); }
  for (const zz of [-L * 0.32, L * 0.32]) for (const s of [-1, 1]) { K.part('wheel', () => MeshBuilder.CreateCylinder('w', { diameter: 1, height: 1, tessellation: 18 }, sc), R.tyre, body, s * (w / 2 - 0.08), 0.34, zz, 0, 0, Math.PI / 2, 0.68, 0.24, 0.68);
    K.part('rim', () => MeshBuilder.CreateCylinder('r', { diameter: 1, height: 1, tessellation: 14 }, sc), R.rim, body, s * (w / 2 - 0.02), 0.34, zz, 0, 0, Math.PI / 2, 0.42, 0.14, 0.42); }
  const pl = MeshBuilder.CreatePlane(K.nm('pl'), { width: 0.52, height: 0.13 }, sc); pl.material = K.picture(RT.plate(plate), 0.3); pl.parent = body; pl.position.set(0, 0.42, -L / 2 - 0.02); pl.metadata = c.metadata;
  // its company's colour on a tag in the windscreen
  K.box(body, 0.3, 0.12, 0.01, K.pbr({ key: 'rentalTag' + comp.id, col: comp.bg, rough: 0.5 }), w * 0.25, 0.3 + bodyH + cabH * 0.35, -L * 0.04 + L * t.cabin / 2 + 0.006);
  const cs = Math.cos(yaw), sn = Math.sin(yaw), hx = Math.abs(cs) * w / 2 + Math.abs(sn) * L / 2, hz = Math.abs(sn) * w / 2 + Math.abs(cs) * L / 2;
  K.block(1, OX + x - hx, OZ + z - hz, OX + x + hx, OZ + z + hz);
}

/** Put a real model in a rental car's place (it keeps its id, name and rental data); the stand-in body goes. */
export function swapCarModel(K: Kit, id: string, model: TransformNode | AbstractMesh) {
  const o = K.objects.get(id); if (!o) return false; const old = o.node.getChildren().find(c => c.name === id + '/BODY'); if (old) old.dispose();
  model.parent = o.node; model.metadata = o.node.metadata; o.node.metadata.drive.placeholder = false; return true;
}
/** Every rental car, with its data. */
export function rentalCars(K: Kit) { return [...K.objects.values()].filter(o => o.kind === 'CAR' && o.room === 'RENTAL').map(o => ({ id: o.id, name: o.node.metadata.name, ...o.node.metadata.rental, node: o.node })); }
