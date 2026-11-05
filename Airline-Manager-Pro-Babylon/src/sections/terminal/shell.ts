// The terminal's structure, room by room: each room's floor, its walls (with every door's opening cut where the plan
// has it, glass where the drawings show glass), its ceiling and the slab or roof over it; the white cladding outside
// where a wall faces the open air; the wave roof over the Grand Hall and the kerb (white on top, warm timber under it,
// three lens skylights along its crests, downlights) on its eight tree columns; the pier's roof with its solar panels;
// and the site: the kerb, the access road, the car park, the trees, the apron with its stands and taxi lane.
import { MeshBuilder, Mesh, Vector3, VertexData, TransformNode } from '@babylonjs/core';
import { Kit, signC } from './kit';
import { ROOMS, DOORS, STAIRS, Room, Fl, F2Y, F1CEIL, F2CEIL, ROOF, doorH, WAVE, waveSouth, waveH, COLUMNS, STANDS, inRoom } from './plan';
import { IS_PC } from '../../core/app';

type R4 = { x0: number; z0: number; x1: number; z1: number };
/** A rectangle less the holes in it (as smaller rectangles). */
export function rectMinus(r: R4, holes: R4[]): R4[] {
  const hs = holes.filter(h => h.x1 > r.x0 && h.x0 < r.x1 && h.z1 > r.z0 && h.z0 < r.z1); if (!hs.length) return [r];
  const xs = [r.x0, r.x1, ...hs.flatMap(h => [Math.max(r.x0, h.x0), Math.min(r.x1, h.x1)])].sort((a, b) => a - b), zs = [r.z0, r.z1, ...hs.flatMap(h => [Math.max(r.z0, h.z0), Math.min(r.z1, h.z1)])].sort((a, b) => a - b);
  const out: R4[] = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) { const c = { x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] }; if (c.x1 - c.x0 < 0.01 || c.z1 - c.z0 < 0.01) continue; const mx = (c.x0 + c.x1) / 2, mz = (c.z0 + c.z1) / 2; if (hs.some(h => inRoom(h, mx, mz))) continue; out.push(c); }
  // merge cells along x in each row strip, to fewer pieces
  return out;
}
const FLOOR_M: { [k: string]: string } = { hall: 'terrazzo', vestibule: 'terrazzo', plant: 'epoxy', wc: 'tile', clean: 'epoxy', security: 'terrazzo', airside: 'terrazzo', lounge: 'herring', office: 'carpetGrey', passage: 'tile', ops: 'carpetBlue', crew: 'carpetGrey', corridor: 'tile', academy: 'carpetBlue', staffentr: 'tileDark', baghall: 'concrete', ramp: 'concrete', gate1: 'carpetBlue', link: 'terrazzo', food: 'terrazzo', landing: 'terrazzo', taxfree: 'tile', family: 'carpet', bar: 'herring', walk: 'terrazzo', eatery: 'tileDark', gate2: 'carpetBlue', view: 'carpetBlue' };
const WALL_M: { [k: string]: string } = { hall: 'white', plant: 'concrete', baghall: 'concrete', ramp: 'concrete', wc: 'tile', eatery: 'tileDark', clean: 'concrete', lounge: 'plaster' };
export const stairHoles = (): R4[] => STAIRS.map(s => ({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1 }));

export function buildShell(K: Kit, progress: (p: number, s: string) => void) {
  const { sc, M } = K;
  for (const r of ROOMS) { const t = new TransformNode(r.id, sc); t.parent = K.groups['F' + r.f]; t.metadata = { id: r.id, kind: 'room', room: r.id, name: r.name }; K.rooms[r.id] = t; }
  for (const k of ['KERB', 'APRON', 'OUTSIDE']) { const t = new TransformNode(k, sc); t.parent = K.groups.SITE; K.rooms[k] = t; }
  const base = (f: Fl) => f === 1 ? 0 : F2Y;
  const top = (r: Room) => base(r.f) + (r.h != null ? r.h : r.kind === 'vestibule' ? 3.4 : 5.4);
  const F2R = ROOMS.filter(r => r.f === 2), holes = stairHoles();
  const inAny = (f: Fl, x: number, z: number) => ROOMS.some(r => r.f === f && r.kind !== 'museum' && inRoom(r, x, z));
  const wallBox = (roomId: string, mat: any, ax: 'x' | 'z', line: number, a: number, b: number, y0: number, y1: number, off: number, th = 0.12) => {
    if (b - a < 0.02 || y1 - y0 < 0.02) return; const m = MeshBuilder.CreateBox(K.nm('w'), { width: ax === 'x' ? b - a : th, height: y1 - y0, depth: ax === 'x' ? th : b - a }, sc);
    if (ax === 'x') m.position.set((a + b) / 2, (y0 + y1) / 2, line + off); else m.position.set(line + off, (y0 + y1) / 2, (a + b) / 2);
    K.struct(roomId, m, mat); };
  /** A run of wall along a side: solid (or glass) between the doors, a lintel over each door. */
  const sideRun = (r: Room, side: string, y0: number, y1: (u: number) => number, mat: any, glass: boolean, off: number, th = 0.12, rid = r.id) => {
    const ax: 'x' | 'z' = side === 'n' || side === 's' ? 'x' : 'z', line = side === 'n' ? r.z1 : side === 's' ? r.z0 : side === 'e' ? r.x1 : r.x0;
    const a0 = ax === 'x' ? r.x0 : r.z0, a1 = ax === 'x' ? r.x1 : r.z1;
    const ds = DOORS.filter(dr => dr.f === r.f && dr.along === ax && Math.abs((ax === 'x' ? dr.z : dr.x) - line) < 0.3 && (ax === 'x' ? dr.x : dr.z) > a0 && (ax === 'x' ? dr.x : dr.z) < a1 && y0 < base(r.f) + 0.5)
      .map(dr => ({ c: ax === 'x' ? dr.x : dr.z, w: dr.w, h: base(r.f) + doorH(dr) })).sort((p, q) => p.c - q.c);
    const pieces: [number, number, number][] = []; let u = a0;
    for (const dr of ds) { pieces.push([u, dr.c - dr.w / 2, y0]); pieces.push([dr.c - dr.w / 2, dr.c + dr.w / 2, dr.h]); u = dr.c + dr.w / 2; } pieces.push([u, a1, y0]);
    for (const [pa, pb, py] of pieces) {
      // tall walls under a sloping top (the wave roof) are cut into short pieces, each up to the roof above it
      const step = y1(pa) === y1(pb) && y1((pa + pb) / 2) === y1(pa) ? pb - pa : 2;
      for (let s = pa; s < pb - 0.001; s += step) { const e = Math.min(pb, s + step), yt = Math.min(y1(s), y1(e), y1((s + e) / 2));
        if (glass && py === y0) { wallBox(rid, M.glass, ax, line, s, e, py, yt, off, 0.03); } else wallBox(rid, mat, ax, line, s, e, py, yt, off, th); }
      if (glass && py === y0) for (let s = pa; s <= pb + 0.001; s += (pb - pa) / Math.max(1, Math.round((pb - pa) / 1.8))) wallBox(rid, M.mullion, ax, line, s - 0.04, s + 0.04, y0, y1(s), off, 0.14);
    }
  };
  progress(14, 'Laying the floors…');
  for (const r of ROOMS) {
    if (r.kind === 'museum') continue;
    const b = base(r.f), fm = M[FLOOR_M[r.kind] || 'terrazzo'], wm = M[WALL_M[r.kind] || 'plaster'], isHall = r.kind === 'hall';
    // the floor (less the stairs going down through it on Floor 2); its slab under it on Floor 2
    for (const c of (r.f === 2 ? rectMinus(r, holes) : [r])) {
      const g = MeshBuilder.CreateGround(K.nm('fl'), { width: c.x1 - c.x0, height: c.z1 - c.z0 }, sc); g.position.set((c.x0 + c.x1) / 2, b + 0.005, (c.z0 + c.z1) / 2); K.struct(r.id, g, fm);
      if (r.f === 2) { const s = MeshBuilder.CreateBox(K.nm('slab'), { width: c.x1 - c.x0, height: 0.36, depth: c.z1 - c.z0 }, sc); s.position.set((c.x0 + c.x1) / 2, F2Y - 0.19, (c.z0 + c.z1) / 2); K.struct(r.id, s, M.concrete); }
    }
    // the ceiling; the roof slab where nothing is built over it
    if (!isHall) {
      const ct = top(r), cm = r.kind === 'baghall' || r.kind === 'plant' || r.kind === 'ramp' ? M.concrete : M.offwhite;
      for (const c of rectMinus(r, holes)) { const p = MeshBuilder.CreatePlane(K.nm('ce'), { width: c.x1 - c.x0, height: c.z1 - c.z0 }, sc); p.rotation.x = -Math.PI / 2; p.position.set((c.x0 + c.x1) / 2, ct, (c.z0 + c.z1) / 2); K.struct(r.id, p, cm); }
      if (r.f === 1) { const open = rectMinus(r, F2R); for (const c of open) { const s = MeshBuilder.CreateBox(K.nm('rf'), { width: c.x1 - c.x0, height: 0.4, depth: c.z1 - c.z0 }, sc); s.position.set((c.x0 + c.x1) / 2, (r.kind === 'vestibule' ? ct : F1CEIL) + 0.2, (c.z0 + c.z1) / 2); K.struct(r.id, s, M.white); } }
      else { const s = MeshBuilder.CreateBox(K.nm('rf'), { width: r.x1 - r.x0, height: ROOF - F2CEIL, depth: r.z1 - r.z0 }, sc); s.position.set((r.x0 + r.x1) / 2, (F2CEIL + ROOF) / 2, (r.z0 + r.z1) / 2); K.struct(r.id, s, M.white); }
    }
    // the walls, on the inside of each side; the cladding outside where a side faces the open air
    for (const side of ['n', 's', 'e', 'w']) {
      const inward = side === 'n' ? -1 : side === 's' ? 1 : side === 'e' ? -1 : 1, glass = !!(r.glass && r.glass.indexOf(side) >= 0);
      const ax = side === 'n' || side === 's' ? 'x' : 'z', line = side === 'n' ? r.z1 : side === 's' ? r.z0 : side === 'e' ? r.x1 : r.x0;
      if (isHall) {
        // the Grand Hall: its walls go up to the wave roof; on its north side, between 6 and 12 m, the glass of the Floor 2 rooms over the hall takes their place
        const roofAt = (u: number) => ax === 'x' ? waveH(u, line) - 0.05 : waveH(line, u) - 0.05;
        sideRun(r, side, 0, u => Math.min(F2Y, roofAt(u)), wm, glass, inward * 0.09);
        const a0 = ax === 'x' ? r.x0 : r.z0, a1 = ax === 'x' ? r.x1 : r.z1; let s0 = a0;
        const covered = (u: number) => { const px = ax === 'x' ? u : line - inward * 0.5, pz = ax === 'x' ? line - inward * 0.5 : u; return F2R.some(q => inRoom(q, px, pz)); };
        for (let u = a0; u <= a1 + 0.5; u += 1) { const cv = u <= a1 && covered(Math.min(a1 - 0.01, u + 0.5)); if (cv || u > a1) { if (u > s0) { const sub = { ...r, x0: ax === 'x' ? s0 : r.x0, x1: ax === 'x' ? Math.min(u, a1) : r.x1, z0: ax === 'z' ? s0 : r.z0, z1: ax === 'z' ? Math.min(u, a1) : r.z1 } as Room; sideRun(sub, side, F2Y, u2 => Math.min(ROOF, roofAt(u2)), wm, glass, inward * 0.09); } s0 = u + 1; } }
        const sub2 = r; sideRun(sub2, side, ROOF, roofAt, wm, glass, inward * 0.09);
        continue;
      }
      sideRun(r, side, base(r.f), () => top(r), wm, glass, inward * 0.09);
      if (glass) continue;
      // outside: sample the side every metre; where the air is beyond it, white cladding over the floor's height
      const a0 = ax === 'x' ? r.x0 : r.z0, a1 = ax === 'x' ? r.x1 : r.z1; let s0 = -1;
      const air = (u: number) => { const px = ax === 'x' ? u : line - inward * 0.4, pz = ax === 'x' ? line - inward * 0.4 : u; return !inAny(r.f, px, pz) && !(r.f === 1 && inAny(1, px, pz)); };
      const flush = (a: number, b2: number) => { const sub = { ...r, x0: ax === 'x' ? a : r.x0, x1: ax === 'x' ? b2 : r.x1, z0: ax === 'z' ? a : r.z0, z1: ax === 'z' ? b2 : r.z1 } as Room; sideRun(sub, side, base(r.f), () => base(r.f) + 6, M.white, false, -inward * 0.04, 0.08); };
      for (let u = a0 + 0.5; u < a1 + 0.5; u += 1) { const isAir = u < a1 && air(u); if (isAir && s0 < 0) s0 = u - 0.5; if (!isAir && s0 >= 0) { flush(Math.max(a0, s0), Math.min(a1, u - 0.5)); s0 = -1; } }
      if (s0 >= 0) flush(Math.max(a0, s0), a1);
    }
  }
  progress(26, 'Raising the wave roof…');
  buildWaveRoof(K);
  progress(32, 'The site: the kerb, the road, the car park, the apron…');
  buildSite(K);
}

/** The wave roof: one surface from the kerb over the Grand Hall to the Floor 2 roof, its crests along x 45, 75, 105. */
function buildWaveRoof(K: Kit) {
  const { sc, M } = K, par = K.groups.ROOF, NX = IS_PC ? 120 : 80, NZ = 40;
  const surf = (dy: number, flip: boolean, mat: any, name: string) => {
    const pos: number[] = [], idx: number[] = [], uv: number[] = [];
    for (let i = 0; i <= NX; i++) { const x = WAVE.x0 + (WAVE.x1 - WAVE.x0) * i / NX, zs = waveSouth(x); for (let j = 0; j <= NZ; j++) { const z = zs + (WAVE.z1 - zs) * j / NZ; pos.push(x, waveH(x, z) + dy, z); uv.push(x / 8, z / 8); } }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const a = i * (NZ + 1) + j, b = a + NZ + 1; if (flip) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const m = new Mesh(name, sc), vd = new VertexData(), nr: number[] = []; vd.positions = pos; vd.indices = idx; vd.uvs = uv; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
    m.material = mat; m.parent = par; m.receiveShadows = true; m.isPickable = false; m.metadata = { id: name, kind: 'roof', room: 'ROOF' }; return m; };
  surf(0, false, M.timber, 'ROOF/WAVE-SOFFIT'); surf(0.7, true, M.whiteGloss, 'ROOF/WAVE-TOP');
  // the fascia round its edge, with a line of light under its south edge
  const edge: Vector3[] = [], edgeT: Vector3[] = []; for (let i = 0; i <= 80; i++) { const x = WAVE.x0 + (WAVE.x1 - WAVE.x0) * i / 80, z = waveSouth(x); edge.push(new Vector3(x, waveH(x, z) + 0.35, z)); edgeT.push(new Vector3(x, waveH(x, z) - 0.05, z + 0.15)); }
  const fas = MeshBuilder.CreateTube('ROOF/FASCIA', { path: edge, radius: 0.42, tessellation: 10 }, sc); fas.material = M.whiteGloss; fas.parent = par;
  const ls = MeshBuilder.CreateTube('ROOF/EDGE-LIGHT', { path: edgeT, radius: 0.06, tessellation: 6 }, sc); ls.material = M.light; ls.parent = par;
  // the three lens skylights along the crests
  for (const [i, cx] of [45, 75, 105].entries()) {
    const pos: number[] = [], idx: number[] = [], N = 30;
    for (let j = 0; j <= N; j++) { const t = j / N, z = 4 + 24 * t, w = 2.6 * Math.sin(Math.PI * t); for (const s of [-1, 1]) { const x = cx + s * w; pos.push(x, waveH(x, z) - 0.04, z); } }
    for (let j = 0; j < N; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const m = new Mesh(`ROOF/SKYLIGHT-${i + 1}`, sc), vd = new VertexData(), nr: number[] = []; vd.positions = pos; vd.indices = idx; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
    m.material = M.sky; m.parent = par; (M.sky as any).backFaceCulling = false; m.metadata = { id: `ROOF/SKYLIGHT-${i + 1}`, kind: 'skylight', room: 'ROOF' };
  }
  // downlights in the timber, each its own small object
  for (let x = WAVE.x0 + 4; x < WAVE.x1 - 3; x += 6) for (let z = -12; z < WAVE.z1 - 2; z += 6) {
    if (z < waveSouth(x) + 2) continue; if ([45, 75, 105].some(c => Math.abs(x - c) < 3 && z > 3 && z < 29)) continue;
    const o = K.obj('ROOF', 'DOWNLIGHT', x, waveH(x, z) - 0.03, z); K.cyl(o, 0.18, 0.04, M.light, 0, 0, 0); }
  // the tree columns: a white trunk branching into arms that hold the roof
  for (const [id, x, z] of COLUMNS) {
    const o = K.obj(z < 0 ? 'KERB' : 'F1-HALL', 'COLUMN', x, 0, z, 0, id), h = waveH(x, z), fork = h * 0.42;
    K.cyl(o, 0.5, fork, M.whiteGloss, 0, fork / 2, 0, 0.38, 24); K.cyl(o, 0.62, 0.5, M.whiteGloss, 0, 0.25, 0, 0.5, 24);
    for (let a = 0; a < 5; a++) { const ang = a / 5 * Math.PI * 2 + 0.3, rr = a === 4 ? 0 : 4.5, ex = Math.cos(ang) * rr, ez = Math.sin(ang) * rr;
      const p = [new Vector3(0, fork - 0.3, 0), new Vector3(ex * 0.45, fork + (h - fork) * 0.55, ez * 0.45), new Vector3(ex, waveH(x + ex, z + ez) - 0.1, ez)];
      const t = MeshBuilder.CreateTube(K.nm('arm'), { path: p, radius: 0.28, tessellation: 12, cap: Mesh.CAP_END }, sc); t.material = M.whiteGloss; t.parent = o; t.metadata = o.metadata; K.casters.push(t); }
    K.circle(1, x, z, 0.75);
  }
}

/** The site: grass, the kerb under the roof, the road, the car park with its cars and trees, the apron and its stands. */
function buildSite(K: Kit) {
  const { sc, M } = K, par = K.groups.SITE;
  const ground = (id: string, mat: any, x0: number, z0: number, x1: number, z1: number, y: number) => { const g = MeshBuilder.CreateGround(id, { width: x1 - x0, height: z1 - z0 }, sc); g.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); g.material = mat; g.parent = par; g.receiveShadows = true; g.isPickable = false; g.metadata = { id, kind: 'ground', room: 'SITE' }; g.freezeWorldMatrix(); return g; };
  ground('SITE/GRASS', M.grass, -260, -200, 420, 260, -0.03); ground('SITE/KERB', M.kerb, 20, -20, 130, -4, 0.004); ground('SITE/FORECOURT', M.kerb, 0, -4, 160, 0, 0.003);
  ground('SITE/ROAD', M.asphalt, -120, -34, 280, -20, 0.006); ground('SITE/APRON', M.apron, -100, 76, 260, 145, 0.004); ground('SITE/CARPARK', M.asphalt, 20, -96, 150, -40, 0.005);
  ground('SITE/SIDE-PATH', M.kerb, 156, 40, 170, 52, 0.004);
  // the road's dashes, the kerb edge, the car park's lines
  const dash = K.obj('SITE', 'ROAD-MARKING', 0, 0.012, -27, 0, 'SITE/ROAD-MARKING'); for (let x = -118; x < 278; x += 8) K.box(dash, 3.5, 0.01, 0.18, M.white, x, 0, 0);
  const kerbE = K.obj('SITE', 'KERB-EDGE', 0, 0, -20, 0, 'SITE/KERB-EDGE'); K.box(kerbE, 110, 0.16, 0.3, M.concrete, 75, 0.08, 0);
  const lines = K.obj('SITE', 'PARKING-LINES', 0, 0.012, 0, 0, 'SITE/PARKING-LINES');
  for (let row = 0; row < 4; row++) { const z = -46 - row * 13; for (let x = 24; x < 148; x += 2.6) K.box(lines, 0.1, 0.01, 5, M.white, x, 0, z); }
  // the parked cars, each its own object
  const carCols = [M.white, M.steel, M.navy, M.black, M.red, M.offwhite];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 46; i++) { if ((i * 7 + row * 3) % 5 === 0) continue; const x = 25.3 + i * 2.6, z = -46 - row * 13 + (row % 2 ? -0.2 : 0.2);
    const car = K.obj('SITE', 'CAR', x, 0, z, (row % 2) * Math.PI); const c = carCols[(i * 5 + row) % carCols.length];
    K.box(car, 1.8, 0.75, 4.4, c, 0, 0.55, 0); K.box(car, 1.6, 0.6, 2.2, M.glassBlue, 0, 1.2, -0.2); for (const sx of [-0.8, 0.8]) for (const sz of [-1.4, 1.4]) { const w = K.cyl(car, 0.33, 0.24, M.black, sx, 0.33, sz); w.rotation.z = Math.PI / 2; } }
  // trees: along the road and round the car park
  const tree = (room: string, x: number, z: number, s = 1) => { const t = K.obj(room, 'TREE', x, 0, z); K.cyl(t, 0.18 * s, 2.6 * s, M.trunk, 0, 1.3 * s, 0, 0.14 * s); K.ball(t, 2.2 * s, M.plant, 0, 3.6 * s, 0, 0.95); K.ball(t, 1.4 * s, M.plantDark, 0.8 * s, 4.3 * s, 0.3 * s); };
  for (let x = -100; x < 270; x += 12) tree('SITE', x, -36.5); for (let x = 26; x < 150; x += 11) tree('SITE', x, -98, 1.1);
  for (let z = -92; z < -40; z += 11) { tree('SITE', 18, z); tree('SITE', 153, z); }
  // the apron: the taxi lane, each stand's lead-in line and stop bar, and the stands' signs
  const lane = K.obj('APRON', 'TAXI-LANE', 0, 0.012, 132, 0, 'APRON/TAXI-LANE'); K.box(lane, 350, 0.01, 0.25, M.yellow, 80, 0, 0); K.box(lane, 350, 0.01, 0.12, M.yellow, 80, 0, -8);
  for (const s of STANDS) { const o = K.obj('APRON', 'STAND', s.x, 0.013, s.nz, 0, s.id); K.box(o, 0.2, 0.01, 132 - s.nz, M.yellow, 0, 0, (132 - s.nz) / 2); K.box(o, 3, 0.01, 0.3, M.yellow, 0, 0, -1.2);
    const sign = MeshBuilder.CreatePlane(K.nm('ss'), { width: 3.2, height: 0.8 }, sc); sign.material = K.picture(signC(s.id, '#14202E', '#F2C230', 512, 128, '700 64px Arial, sans-serif'), 1); sign.parent = o; sign.position.set(-6, 3.2, -5); sign.rotation.y = Math.PI; sign.metadata = o.metadata;
    K.box(o, 0.12, 3.2, 0.12, M.steel, -6, 1.6, -4.9); }
  // the pier's roof: rows of solar panels
  const sol = K.obj('ROOF', 'SOLAR-PANELS', 0, ROOF + 0.15, 0, 0, 'ROOF/SOLAR-PANELS');
  for (let x = -76; x < 238; x += 4.2) for (const z of [54, 57.2, 60.4, 64.5, 68, 71.5]) { const p = K.box(sol, 3.8, 0.08, 2.6, M.solar, x, 0, z); p.rotation.x = -0.12; }
  for (const [x, z] of [[20, 40], [60, 36], [118, 46], [140, 22]]) { const u = K.obj('ROOF', 'ROOF-UNIT', x, ROOF, z); K.box(u, 5, 1.6, 3.2, M.offwhite, 0, 0.8, 0); K.box(u, 4.4, 0.1, 2.6, M.steel, 0, 1.65, 0); }
}
