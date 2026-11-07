// Everything in the rooms, each its own object with its id (ROOM/KIND-nnn), placed to the drawings: check-in desks 1–24
// on their two islands with the belts and queue lines, the 8 bag drop points, the trees in their planters, the six
// security lanes, the lounge (copper waves, fireplace 7 in art deco brass, the black and brass L-shaped bar with its
// bottles and globe lights, armchairs), the offices and Operations as drawn, the Academy's 20 student desks and the
// teacher's desk, the crew room, toilets, the baggage hall's belts and carts, ramp services, the gates' seats and
// desks, the Food Walk's tables and its five eateries, Tax Free's shelves, the big bar's oval counter, the family room,
// the view bays, the ceiling lights of every room.
import { MeshBuilder, Mesh, Vector3, TransformNode } from '@babylonjs/core';
import { Kit, signC, P } from './kit';
import { ROOMS, Room, F2Y, MOD, STAIRS, PG, PN } from './plan';
import { IS_PC } from '../../core/app';
import { makeFids, OPS_W } from './fids';

export function furnish(K: Kit, progress: (p: number, s: string) => void) {
  const { sc, M } = K;
  const Y = (r: Room) => r.f === 2 ? F2Y : 0;
  // ---- the kit of objects (each takes the room, where, which way it faces; adds what is in the way) ----
  const chair = (r: Room, x: number, z: number, yaw: number, mat = M.fabricBlue) => { const o = K.obj(r.id, 'CHAIR', x, Y(r), z, yaw);
    K.box(o, 0.46, 0.07, 0.44, mat, 0, 0.46, 0); K.box(o, 0.46, 0.5, 0.06, mat, 0, 0.74, -0.2); for (const sx of [-0.2, 0.2]) for (const sz of [-0.18, 0.18]) K.box(o, 0.03, 0.45, 0.03, M.steel, sx, 0.22, sz); K.circle(r.f, x, z, 0.32); return o; };
  const officeChair = (r: Room, x: number, z: number, yaw: number) => { const o = K.obj(r.id, 'OFFICE-CHAIR', x, Y(r), z, yaw);
    K.box(o, 0.5, 0.09, 0.48, M.fabricGrey, 0, 0.48, 0); K.box(o, 0.48, 0.62, 0.07, M.fabricGrey, 0, 0.85, -0.22); K.cyl(o, 0.03, 0.4, M.chrome, 0, 0.25, 0); K.cyl(o, 0.3, 0.04, M.black, 0, 0.05, 0, undefined, 5); K.circle(r.f, x, z, 0.35); return o; };
  const armchair = (r: Room, x: number, z: number, yaw: number, mat = M.fabricTeal) => { const o = K.obj(r.id, 'ARMCHAIR', x, Y(r), z, yaw);
    K.box(o, 0.8, 0.22, 0.76, mat, 0, 0.32, 0); K.box(o, 0.8, 0.5, 0.15, mat, 0, 0.62, -0.31); for (const s of [-1, 1]) K.box(o, 0.13, 0.32, 0.76, mat, s * 0.4, 0.52, 0); for (const sx of [-0.33, 0.33]) for (const sz of [-0.3, 0.3]) K.cyl(o, 0.02, 0.22, M.brass, sx, 0.11, sz); K.circle(r.f, x, z, 0.5); return o; };
  const sofa = (r: Room, x: number, z: number, yaw: number, len = 2.2, mat = M.fabricGrey) => { const o = K.obj(r.id, 'SOFA', x, Y(r), z, yaw);
    K.box(o, len, 0.42, 0.9, mat, 0, 0.21, 0); K.box(o, len, 0.5, 0.2, mat, 0, 0.62, -0.36); for (const s of [-1, 1]) K.box(o, 0.18, 0.62, 0.9, mat, s * len / 2, 0.31, 0);
    const c = Math.cos(yaw), s2 = Math.sin(yaw), hx = Math.abs(c) * len / 2 + Math.abs(s2) * 0.45, hz = Math.abs(s2) * len / 2 + Math.abs(c) * 0.45; K.block(r.f, x - hx, z - hz, x + hx, z + hz); return o; };
  const table = (r: Room, x: number, z: number, rad = 0.45, h = 0.74, top = M.white) => { const o = K.obj(r.id, 'TABLE', x, Y(r), z); K.cyl(o, rad, 0.04, top, 0, h, 0, undefined, 28); K.cyl(o, 0.05, h, M.black, 0, h / 2, 0); K.cyl(o, 0.25, 0.03, M.black, 0, 0.015, 0); K.circle(r.f, x, z, rad + 0.05); return o; };
  const desk = (r: Room, x: number, z: number, yaw: number, w = 1.6, d = 0.8, top = M.oak, screens = 1) => { const o = K.obj(r.id, 'DESK', x, Y(r), z, yaw);
    K.box(o, w, 0.04, d, top, 0, 0.74, 0); for (const s of [-1, 1]) K.box(o, 0.04, 0.72, d - 0.06, M.white, s * (w / 2 - 0.03), 0.36, 0); K.box(o, w - 0.1, 0.4, 0.02, M.white, 0, 0.5, -d / 2 + 0.03);
    for (let i = 0; i < screens; i++) { const sx = (i - (screens - 1) / 2) * 0.58; K.box(o, 0.54, 0.32, 0.03, M.screenBlack, sx, 1.02, -d / 2 + 0.2); K.box(o, 0.5, 0.28, 0.01, M.lightCool, sx, 1.02, -d / 2 + 0.22); K.box(o, 0.05, 0.16, 0.05, M.black, sx, 0.84, -d / 2 + 0.18); }
    K.box(o, 0.44, 0.02, 0.15, M.black, 0, 0.77, 0.08);
    const c = Math.cos(yaw), s2 = Math.sin(yaw), hx = Math.abs(c) * w / 2 + Math.abs(s2) * d / 2, hz = Math.abs(s2) * w / 2 + Math.abs(c) * d / 2; K.block(r.f, x - hx, z - hz, x + hx, z + hz); return o; };
  const plant = (r: Room, x: number, z: number, big = false) => { const o = K.obj(r.id, 'PLANT', x, Y(r), z);
    if (big) { K.cyl(o, 0.5, 0.6, M.black, 0, 0.3, 0, 0.42); for (let i = 0; i < 9; i++) { const a = i * 2.4, l = K.ball(o, 0.18, M.plantDark, Math.sin(a) * 0.2, 0.9 + (i % 3) * 0.32, Math.cos(a) * 0.2, 2.6); l.rotation.z = Math.sin(a) * 0.4; l.rotation.x = Math.cos(a) * 0.4; } K.circle(r.f, x, z, 0.55); }
    else { K.cyl(o, 0.24, 0.45, M.white, 0, 0.22, 0, 0.2); K.ball(o, 0.34, M.plant, 0, 0.75, 0, 1.2); K.circle(r.f, x, z, 0.3); }
    return o; };
  const treePlanter = (r: Room, x: number, z: number) => { const o = K.obj(r.id, 'TREE-PLANTER', x, Y(r), z);
    K.cyl(o, 2.3, 0.75, M.whiteGloss, 0, 0.375, 0, 2.15, 40); K.cyl(o, 2.1, 0.06, M.soil, 0, 0.74, 0, undefined, 40); K.cyl(o, 0.16, 3.2, M.trunk, 0, 2.2, 0, 0.12); K.ball(o, 1.9, M.plant, 0, 4.6, 0, 1.15); K.circle(r.f, x, z, 2.35); return o; };
  const bin = (r: Room, x: number, z: number) => { const o = K.obj(r.id, 'BIN', x, Y(r), z); K.cyl(o, 0.2, 0.8, M.steel, 0, 0.4, 0); K.cyl(o, 0.21, 0.04, M.black, 0, 0.8, 0); K.circle(r.f, x, z, 0.25); return o; };
  /** A row of n linked seats on one beam (gates, view bays, the walkway, the landing). */
  const seats = (r: Room, x: number, z: number, yaw: number, n: number, back2 = false) => { const o = K.obj(r.id, 'SEATS', x, Y(r), z, yaw), w = 0.62, L = n * w;
    K.box(o, L, 0.06, 0.08, M.steel, 0, 0.32, 0); for (const sx of [-L / 2 + 0.2, L / 2 - 0.2]) K.box(o, 0.06, 0.32, 0.5, M.steel, sx, 0.16, 0);
    for (let i = 0; i < n; i++) { const sx = -L / 2 + w * (i + 0.5); K.box(o, w - 0.06, 0.07, 0.48, M.navy, sx, 0.44, back2 ? 0.26 : 0); K.box(o, w - 0.06, 0.48, 0.06, M.navy, sx, 0.72, back2 ? 0.02 : -0.24);
      if (back2) { K.box(o, w - 0.06, 0.07, 0.48, M.navy, sx, 0.44, -0.26); } }
    const c = Math.cos(yaw), s2 = Math.sin(yaw), d = back2 ? 1.1 : 0.6, hx = Math.abs(c) * L / 2 + Math.abs(s2) * d / 2, hz = Math.abs(s2) * L / 2 + Math.abs(c) * d / 2; K.block(r.f, x - hx, z - hz, x + hx, z + hz); return o; };
  const counter = (r: Room, x: number, z: number, yaw: number, w: number, d: number, front = M.white, top = M.marbleDark, h = 1.05) => { const o = K.obj(r.id, 'COUNTER', x, Y(r), z, yaw);
    K.box(o, w, h, d, front, 0, h / 2, 0); K.box(o, w + 0.06, 0.05, d + 0.06, top, 0, h + 0.025, 0);
    const c = Math.cos(yaw), s2 = Math.sin(yaw), hx = Math.abs(c) * w / 2 + Math.abs(s2) * d / 2, hz = Math.abs(s2) * w / 2 + Math.abs(c) * d / 2; K.block(r.f, x - hx, z - hz, x + hx, z + hz); return o; };
  const shelf = (r: Room, x: number, z: number, yaw: number, w = 2, h = 1.8, d = 0.5, goods = true) => { const o = K.obj(r.id, 'SHELF', x, Y(r), z, yaw);
    K.box(o, w, h, 0.04, M.white, 0, h / 2, 0); for (let i = 0; i < 4; i++) K.box(o, w, 0.03, d, M.white, 0, 0.15 + i * (h - 0.25) / 3, 0);
    if (goods) { const cols = [M.red, M.navy, M.yellow, M.gold, M.tealUI, M.offwhite]; for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) K.box(o, 0.22, 0.24 + ((i + j) % 3) * 0.06, 0.2, cols[(i * 3 + j) % cols.length], -w / 2 + 0.2 + j * (w - 0.4) / 5, 0.29 + i * (h - 0.25) / 3, d * 0.15); }
    const c = Math.cos(yaw), s2 = Math.sin(yaw), hx = Math.abs(c) * w / 2 + Math.abs(s2) * d / 2, hz = Math.abs(s2) * w / 2 + Math.abs(c) * d / 2; K.block(r.f, x - hx, z - hz, x + hx, z + hz); return o; };
  const lockers = (r: Room, x: number, z: number, yaw: number, n = 6) => { const o = K.obj(r.id, 'LOCKERS', x, Y(r), z, yaw), w = n * 0.42;
    for (let i = 0; i < n; i++) { K.box(o, 0.4, 1.9, 0.5, M.steel, -w / 2 + 0.21 + i * 0.42, 0.95, 0); K.box(o, 0.02, 0.12, 0.03, M.black, -w / 2 + 0.36 + i * 0.42, 1.1, 0.26); }
    const c = Math.cos(yaw), s2 = Math.sin(yaw), hx = Math.abs(c) * w / 2 + Math.abs(s2) * 0.27, hz = Math.abs(s2) * w / 2 + Math.abs(c) * 0.27; K.block(r.f, x - hx, z - hz, x + hx, z + hz); return o; };
  const wcBlock = (r: Room) => {
    // stalls along the north side (or the longer wall), the sinks and mirror across from them
    const along = (r.x1 - r.x0) >= (r.z1 - r.z0), n = Math.max(2, Math.floor(((along ? r.x1 - r.x0 : r.z1 - r.z0) - 2) / 1.5));
    for (let i = 0; i < n; i++) { const u = (along ? r.x0 : r.z0) + 1 + i * 1.5 + 0.75, x = along ? u : r.x1 - 1.0, z = along ? r.z1 - 1.0 : u, yaw = along ? Math.PI : -Math.PI / 2;
      const o = K.obj(r.id, 'STALL', x, Y(r), z, yaw); for (const s of [-1, 1]) K.box(o, 0.04, 2.0, 1.6, M.offwhite, s * 0.75, 1.1, 0); K.box(o, 1.46, 1.9, 0.04, M.navy, 0, 1.1, 0.8);
      K.box(o, 0.4, 0.42, 0.6, M.porcelain, 0, 0.21, -0.45); K.box(o, 0.38, 0.4, 0.18, M.porcelain, 0, 0.6, -0.72); K.block(r.f, x - (along ? 0.78 : 0.82), z - (along ? 0.82 : 0.78), x + (along ? 0.78 : 0.82), z + (along ? 0.82 : 0.78)); }
    const len = (along ? r.x1 - r.x0 : r.z1 - r.z0) * 0.5, cx = along ? (r.x0 + r.x1) / 2 : r.x0 + 0.5, cz = along ? r.z0 + 0.5 : (r.z0 + r.z1) / 2, yaw = along ? 0 : Math.PI / 2;
    const s = K.obj(r.id, 'SINKS', cx, Y(r), cz, yaw); K.box(s, len, 0.1, 0.55, M.marbleDark, 0, 0.85, 0); K.box(s, len, 0.9, 0.04, M.white, 0, 1.6, -0.26);
    for (let i = 0; i < Math.floor(len / 0.9); i++) { const sx = -len / 2 + 0.45 + i * 0.9; K.cyl(s, 0.18, 0.08, M.porcelain, sx, 0.86, 0.02); K.cyl(s, 0.015, 0.2, M.chrome, sx, 1.0, -0.18); }
    K.box(s, len - 0.1, 0.8, 0.01, M.chrome, 0, 1.6, -0.24);
    if (along) K.block(r.f, cx - len / 2, r.z0, cx + len / 2, r.z0 + 0.8); else K.block(r.f, r.x0, cz - len / 2, r.x0 + 0.8, cz + len / 2);
  };
  /** A picture on a wall. */
  const picture = (r: Room, kind: string, x: number, y: number, z: number, yaw: number, w = 1.8, h = 1.1) => { const o = K.obj(r.id, 'PAINTING', x, Y(r) + y, z, yaw);
    const p = MeshBuilder.CreatePlane(K.nm('pt'), { width: w, height: h }, sc); p.material = K.picture(P.painting(kind, Math.round(w * 160), Math.round(h * 160))); p.parent = o; p.position.z = 0.03; p.rotation.y = Math.PI; p.metadata = o.metadata;
    for (const [bw, bh, ox, oy] of [[w + 0.1, 0.05, 0, h / 2 + 0.025], [w + 0.1, 0.05, 0, -h / 2 - 0.025], [0.05, h, w / 2 + 0.025, 0], [0.05, h, -w / 2 - 0.025, 0]]) K.box(o, bw, bh, 0.05, M.gold, ox, oy, 0.02); return o; };
  const sign = (r: Room, text: string, x: number, y: number, z: number, yaw: number, w: number, h: number, bg = '#14202E', fg = '#F2F4F7') => { const o = K.obj(r.id, 'SIGN', x, Y(r) + y, z, yaw);
    const p = MeshBuilder.CreatePlane(K.nm('sg'), { width: w, height: h }, sc); p.material = K.picture(signC(text, bg, fg, 1024, Math.round(1024 * h / w), `700 ${Math.round(1024 * h / w * 0.55)}px Arial, sans-serif`), 1); p.parent = o; p.rotation.y = Math.PI; p.metadata = o.metadata; return o; };
  // ---- the lights of every room: panels in the ceiling, each its own object ----
  const lamps = (r: Room, step = 4.2) => {
    if (r.kind === 'hall' || r.kind === 'museum' || r.kind === 'lounge' || r.kind === 'bar' || r.kind === 'walk') return; // the walkway's lights come with its ceiling
    const top = (r.f === 2 ? F2Y : 0) + (r.h != null ? r.h : r.kind === 'vestibule' ? 3.4 : 5.4) - 0.07, nx = Math.max(1, Math.round((r.x1 - r.x0) / step)), nz = Math.max(1, Math.round((r.z1 - r.z0) / step));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = r.x0 + (r.x1 - r.x0) * (i + 0.5) / nx, z = r.z0 + (r.z1 - r.z0) * (j + 0.5) / nz;
      if (STAIRS.some(s => x > s.x0 - 0.5 && x < s.x1 + 0.5 && z > s.z0 - 0.5 && z < s.z1 + 0.5)) continue;
      const o = K.obj(r.id, 'LAMP', x, top, z); K.box(o, r.kind === 'baghall' || r.kind === 'walk' ? 2.4 : 1.2, 0.04, r.kind === 'baghall' || r.kind === 'walk' ? 0.3 : 0.6, M.light, 0, 0, 0); }
  };
  let i = 0;
  for (const r of ROOMS) {
    if (++i % 8 === 0) progress(38 + Math.round(i / ROOMS.length * 22), `Furnishing ${r.name.replace(/\s*\(.*$/, '').toLowerCase()}…`);
    lamps(r);
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    switch (r.kind) {
      case 'hall': hall(r); break;
      case 'vestibule': { const o = K.obj(r.id, 'MAT', cx, 0.022, cz); K.box(o, r.x1 - r.x0 - 1, 0.01, 2.6, M.rubber, 0, 0, 0); break; }
      case 'plant': for (let k = 0; k < 4; k++) { const o = K.obj(r.id, 'AIR-HANDLER', 5 + k * 8, 0, 40); K.box(o, 6, 2.8, 3.2, M.offwhite, 0, 1.4, 0); K.box(o, 1.6, 1.6, 0.05, M.steel, -1.8, 1.6, 1.62); K.cyl(o, 0.4, 2.6, M.steel, 2.2, 4.1, 0); K.block(1, 2 + k * 8, 38.4, 8 + k * 8, 41.6); }
        for (let k = 0; k < 3; k++) { const o = K.obj(r.id, 'PUMP', 6 + k * 9, 0, 48); K.box(o, 1.6, 1.2, 1.0, M.navy, 0, 0.6, 0); K.cyl(o, 0.15, 3, M.steel, 0.9, 1.5, 0); K.block(1, 5 + k * 9, 47.4, 7.2 + k * 9, 48.6); }
        { const o = K.obj(r.id, 'PIPES', 18, 4.6, 33, 0); for (let k = 0; k < 4; k++) { const p = K.cyl(o, 0.14, 34, M.steel, 0, k * 0.35, 0); p.rotation.z = Math.PI / 2; } } break;
      case 'wc': wcBlock(r); break;
      case 'clean': shelf(r, 40, 51.4, Math.PI, 3, 2, 0.5); shelf(r, 46, 51.4, Math.PI, 3, 2, 0.5); { const o = K.obj(r.id, 'CLEANING-CART', 44, 0, 46); K.box(o, 1.0, 0.9, 0.55, M.yellow, 0, 0.6, 0); K.cyl(o, 0.2, 0.5, M.navy, -0.3, 1.25, 0); K.block(1, 43.4, 45.6, 44.6, 46.4); } break;
      case 'security': security(r); break;
      case 'airside': for (const x of [74, 80, 86]) seats(r, x, 51.5, Math.PI, 6); plant(r, 52, 50, true); plant(r, 88, 50, true); bin(r, 72, 50.5); sign(r, 'GATES 1–8 · FLOOR 2', 62, 4.2, 42.3, 0, 5, 0.6); break;
      case 'lounge': lounge(r); break;
      case 'office': office(r); break;
      case 'passage': sign(r, 'STAFF ONLY', 116, 2.6, 21, -Math.PI / 2, 1.4, 0.3, '#B3261E'); break;
      case 'ops': ops(r); break;
      case 'crew': sofa(r, 118, 50.8, Math.PI, 3, M.fabricBlue); sofa(r, 118, 45, 0, 3, M.fabricBlue); table(r, 118, 48, 0.6, 0.45, M.oak); lockers(r, 127, 51.5, Math.PI, 8);
        counter(r, 126, 43, 0, 4, 0.65, M.white, M.marbleDark, 0.92); { const o = K.obj(r.id, 'COFFEE-MACHINE', 125, 0.97, 43); K.box(o, 0.4, 0.5, 0.4, M.chrome, 0, 0.25, 0); }
        { const o = K.obj(r.id, 'TV', 114.2, 1.6, 48, Math.PI / 2); K.box(o, 1.6, 0.92, 0.06, M.screenBlack, 0, 0, 0); K.box(o, 1.5, 0.84, 0.01, M.lightCool, 0, 0, 0.035); } break;
      case 'corridor': for (let z = 3; z < 52; z += 6) { const o = K.obj(r.id, 'WALL-LIGHT', 132.2, 2.2, z, Math.PI / 2); K.box(o, 0.4, 0.12, 0.08, M.lightWarm, 0, 0, 0); } break;
      case 'academy': academy(r); break;
      case 'staffentr': { const t = K.obj(r.id, 'SECURITY-DESK', 147, 0, 47, 0); K.box(t, 3, 1.05, 0.7, M.white, 0, 0.52, 0); K.box(t, 3.1, 0.05, 0.8, M.marbleDark, 0, 1.07, 0); K.block(1, 145.5, 46.6, 148.5, 47.4); officeChair(r, 147, 48.2, Math.PI);
        for (const z of [42.5, 44.2]) { const g = K.obj(r.id, 'TURNSTILE', 152, 0, z); K.box(g, 0.3, 1.0, 1.0, M.steel, 0, 0.5, 0); K.box(g, 0.02, 0.4, 0.8, M.glass, 0.5, 0.9, 0); K.block(1, 151.8, z - 0.5, 152.2, z + 0.5); }
        lockers(r, 150, 40.5, 0, 10); sign(r, 'STAFF ENTRANCE · ID REQUIRED', 146, 3.2, 51.8, Math.PI, 4.4, 0.42, '#B3261E'); break; }
      case 'baghall': baghall(r); break;
      case 'ramp': { for (let k = 0; k < 3; k++) { const o = K.obj(r.id, 'BAGGAGE-CART', r.x0 + 6 + k * 4, 0, PG + 8); K.box(o, 1.6, 0.06, 3.0, M.steel, 0, 0.55, 0); for (const s of [-1, 1]) K.box(o, 1.6, 1.2, 0.05, M.steel, 0, 1.15, s * 1.5); K.box(o, 1.62, 0.08, 3.0, M.yellow, 0, 1.75, 0); for (const sx of [-0.7, 0.7]) for (const sz of [-1.2, 1.2]) K.cyl(o, 0.18, 0.12, M.black, sx, 0.2, sz); K.block(1, r.x0 + 5.1 + k * 4, PG + 6.4, r.x0 + 6.9 + k * 4, PG + 9.6); }
        { const o = K.obj(r.id, 'TUG', r.x0 + 20, 0, PG + 7); K.box(o, 1.6, 1.0, 2.6, M.yellow, 0, 0.75, 0); K.box(o, 1.4, 0.9, 1.0, M.glass, 0, 1.7, -0.4); K.block(1, r.x0 + 19.1, PG + 5.6, r.x0 + 20.9, PG + 8.4); }
        lockers(r, r.x0 + 14, PG + 1.2, 0, 10); break; }
      case 'gate1': gateRoom(r, 1); break;
      case 'gate2': gateRoom(r, 2); break;
      case 'view': for (let k = 0; k < 3; k++) seats(r, cx, PG + 3 + k * 3.2, 0, 26, false); plant(r, r.x0 + 1.2, PN - 1.4, true); plant(r, r.x1 - 1.2, PN - 1.4, true); break;
      case 'link': for (const z of [36, 44]) seats(r, 6.5, z, Math.PI / 2, 6); plant(r, 7, 31.2); plant(r, 13, 31.2); break;
      case 'food': food(r); break;
      case 'eatery': eatery(r); break;
      case 'landing': seats(r, 79.3, 51.5, Math.PI, 18); seats(r, 83.5, 42.5, 0, 18); plant(r, 57.2, 51, true); plant(r, 88.8, 43, true); break;
      case 'taxfree': taxfree(r); break;
      case 'family': family(r); break;
      case 'bar': bar(r); break;
      case 'walk': walk(r); break;
    }
  }

  // ---- the Grand Hall ----
  function hall(r: Room) {
    // the two check-in islands: desks 1–12 and 13–24 facing the entrance, the belt behind them, the banner over it
    for (const [isl, x0] of [[0, 44], [1, 71]] as [number, number][]) {
      const banner = K.obj(r.id, 'CHECKIN-BANNER', x0 + 12.5, 0, 20.6, 0, `F1-CHECKIN/BANNER-${isl + 1}`); K.box(banner, 25, 2.2, 0.3, M.navy, 0, 3.4, 0); K.box(banner, 25, 0.9, 0.3, M.white, 0, 1.6, 0); K.box(banner, 25, 0.25, 0.32, M.tealUI, 0, 2.2, 0);
      const bp = MeshBuilder.CreatePlane(K.nm('bn'), { width: 12, height: 1.6 }, sc); bp.material = K.picture(signC(`CHECK-IN  ${isl ? '13–24' : '1–12'}`, '#1C2D52', '#FFFFFF', 1536, 205, '700 140px Arial, sans-serif'), 1); bp.parent = banner; bp.position.set(0, 3.4, -0.16); bp.metadata = banner.metadata;
      const belt = K.obj(r.id, 'CHECKIN-BELT', x0 + 12.5, 0, 18.4, 0, `F1-CHECKIN/BELT-${isl + 1}`); K.box(belt, 25, 0.45, 1.0, M.steel, 0, 0.22, 0); K.box(belt, 24.8, 0.04, 0.8, M.rubber, 0, 0.46, 0);
      K.block(1, x0, 17.6, x0 + 25, 21);
      for (let k = 0; k < 12; k++) { const n = isl * 12 + k + 1, x = x0 + 1.05 + k * 2.08, o = K.obj(r.id, 'CHECKIN-DESK', x, 0, 16.4, Math.PI, `F1-CHECKIN/DESK-${String(n).padStart(2, '0')}`);
        K.box(o, 1.7, 1.05, 0.75, M.white, 0, 0.52, 0); K.box(o, 1.74, 0.05, 0.85, M.marbleDark, 0, 1.07, 0); K.box(o, 0.5, 0.32, 0.03, M.screenBlack, 0.3, 1.32, 0.15); K.box(o, 0.6, 0.2, 0.75, M.steel, -1.15, 0.12, 0); K.box(o, 0.6, 0.03, 0.75, M.rubber, -1.15, 0.24, 0);
        const np = MeshBuilder.CreatePlane(K.nm('dn'), { width: 0.5, height: 0.3 }, sc); np.material = K.picture(signC(String(n), '#F2C230', '#14202E', 256, 154, '700 120px Arial, sans-serif'), 1); np.parent = o; np.position.set(0.5, 1.6, 0.0); np.metadata = o.metadata; K.box(o, 0.04, 0.5, 0.04, M.steel, 0.5, 1.3, 0);
        officeChair(r, x + 0.2, 17.25, Math.PI); }
      K.block(1, x0, 15.9, x0 + 25, 16.9);
      // queue lines in front, posts and belts, each its own object
      for (let k = 0; k < 6; k++) { const qx = x0 + 2 + k * 4.2, q = K.obj(r.id, 'QUEUE-POST', qx, 0, 13.6); K.cyl(q, 0.04, 0.95, M.chrome, 0, 0.48, 0); K.cyl(q, 0.16, 0.03, M.chrome, 0, 0.015, 0); if (k < 5) K.box(q, 4.2, 0.05, 0.01, M.navy, 2.1, 0.92, 0); K.circle(1, qx, 13.6, 0.18); }
    }
    // the bag drop: eight self-service points
    for (let k = 0; k < 8; k++) { const x = k < 4 ? 101.5 : 108.5, z = 10.5 + (k % 4) * 4.2, o = K.obj(r.id, 'BAGDROP-POINT', x, 0, z, Math.PI, `F1-BAGDROP/POINT-${k + 1}`);
      K.box(o, 0.9, 1.5, 0.5, M.white, 0.9, 0.75, -0.2); K.box(o, 0.6, 0.4, 0.03, M.lightCool, 0.9, 1.25, 0.06); K.box(o, 1.0, 0.35, 1.4, M.steel, -0.2, 0.17, -0.4); K.box(o, 1.0, 0.03, 1.4, M.rubber, -0.2, 0.36, -0.4); K.box(o, 0.05, 1.3, 1.4, M.glass, -0.75, 1.0, -0.4);
      K.block(1, x - 0.9, z - 0.3, x + 1.5, z + 1.2); }
    sign(r, 'BAG DROP · SELF SERVICE', 105, 4.4, 26.5, Math.PI, 6, 0.8, '#1C2D52');
    // trees in white planters, benches round them, bins
    for (const [x, z] of [[58, 2.55], [92, 2.55], [38.55, 25], [92.5, 27.45]]) treePlanter(r, x, z);
    for (const [x, z, yaw] of [[64, 0.5, 0], [86, 0.5, 0], [36.5, 9, Math.PI / 2]] as number[][]) seats(r, x, z, yaw, 5);
    for (const [x, z] of [[66, 0.45], [89, 0.45], [36.45, 5.5], [97, 29.6]]) bin(r, x, z);
    sign(r, 'SECURITY · ALL GATES', 70, 3.4, 29.75, Math.PI, 6.4, 0.7, '#1C2D52');
    // DEPARTURES over the main entrance, outside
    { const o = K.obj('KERB', 'SIGN', 75, 7.6, -0.4, 0, 'KERB/DEPARTURES-SIGN'); const p = MeshBuilder.CreatePlane(K.nm('dep'), { width: 12, height: 1.6 }, sc); p.material = K.picture(signC('DEPARTURES', '#F2F4F7', '#14202E', 1536, 205, '700 150px Arial, sans-serif'), 0); (p.material as any).backFaceCulling = true; p.parent = o; K.box(o, 12.2, 1.8, 0.12, M.whiteGloss, 0, 0, 0.08); p.metadata = o.metadata; }
    // the canopies over the three ways in
    for (const [x, w] of [[50, 13], [75, 17], [101, 13]]) { const o = K.obj('KERB', 'CANOPY', x, 3.8, -6, 0); K.box(o, w, 0.25, 4, M.whiteGloss, 0, 0, 0); K.box(o, w - 0.4, 0.02, 3.6, M.light, 0, -0.13, 0); for (const s of [-1, 1]) K.cyl(o, 0.1, 3.8, M.mullion, s * (w / 2 - 0.4), -1.9, -1.6); K.circle(1, x - (w / 2 - 0.4), -7.6, 0.2); K.circle(1, x + (w / 2 - 0.4), -7.6, 0.2); }
    for (const [x, z] of [[40, -12], [62, -14], [88, -14], [110, -12]]) { const o = K.obj('KERB', 'BENCH', x, 0, z); K.box(o, 2.4, 0.08, 0.6, M.oak, 0, 0.45, 0); K.box(o, 2.2, 0.42, 0.5, M.steel, 0, 0.21, 0); K.block(1, x - 1.2, z - 0.3, x + 1.2, z + 0.3); }
  }
  function security(r: Room) {
    for (const [k, x] of [53, 59.2, 65.3, 71.5, 77.7, 83.8].entries()) {
      const o = K.obj(r.id, 'SECURITY-LANE', x, 0, 36, 0, `F1-SECURITY/LANE-${k + 1}`);
      K.box(o, 0.8, 0.8, 8, M.steel, 0, 0.4, 0); K.box(o, 0.7, 0.03, 8, M.rubber, 0, 0.81, 0); K.box(o, 1.4, 1.2, 1.8, M.offwhite, 0, 1.2, -0.5); K.box(o, 0.9, 0.5, 0.05, M.black, 0, 1.0, -1.42); K.box(o, 0.9, 0.5, 0.05, M.black, 0, 1.0, 0.42);
      for (let t = 0; t < 4; t++) K.box(o, 0.55, 0.08, 0.4, M.navy, 0, 0.86, 1.4 + t * 0.55);
      K.box(o, 0.12, 2.2, 0.6, M.offwhite, 1.15, 1.1, -0.4); K.box(o, 0.12, 2.2, 0.6, M.offwhite, 2.2, 1.1, -0.4); K.box(o, 1.17, 0.25, 0.6, M.offwhite, 1.675, 2.2, -0.4); K.box(o, 0.9, 0.04, 0.05, M.green, 1.675, 2.05, -0.1);
      { const m = K.obj(r.id, 'MONITOR', x - 0.9, 0, 35, Math.PI / 2); K.box(m, 0.6, 0.8, 0.5, M.white, 0, 0.4, 0); K.box(m, 0.4, 0.3, 0.03, M.screenBlack, 0, 1.0, 0); }
      K.block(1, x - 0.45, 32, x + 0.45, 40); K.block(1, x - 1.25, 34.6, x - 0.55, 35.4); K.circle(1, x + 1.15, 35.6, 0.15); K.circle(1, x + 2.2, 35.6, 0.15);
    }
    for (let k = 0; k < 6; k++) { const q = K.obj(r.id, 'QUEUE-POST', 54 + k * 6, 0, 31.4); K.cyl(q, 0.04, 0.95, M.chrome, 0, 0.48, 0); K.cyl(q, 0.16, 0.03, M.chrome, 0, 0.015, 0); K.circle(1, 54 + k * 6, 31.4, 0.16); }
  }
  function lounge(r: Room) {
    const LH = r.h || 4.8;
    // the ceiling: copper strips in parallel waves, glowing warm from hidden lights
    { const o = K.obj(r.id, 'CEILING-COPPER-WAVES', 0, 0, 0, 0, 'F1-LOUNGE/CEILING'); const tubes: Mesh[] = [];
      for (let j = 0; j < 40; j++) { const z = r.z0 + 0.3 + j * (r.z1 - r.z0 - 0.6) / 39, path: Vector3[] = []; for (let k = 0; k <= 36; k++) path.push(new Vector3(r.x0 + 0.1 + k * (r.x1 - r.x0 - 0.2) / 36, LH - 0.5 - 0.4 * Math.sin(k / 36 * Math.PI * 3 + j * 0.25), z)); tubes.push(MeshBuilder.CreateTube(K.nm('cu'), { path, radius: 0.05, tessellation: 6 }, sc)); }
      const cu = Mesh.MergeMeshes(tubes, true, true) as Mesh; cu.material = M.copper; cu.parent = o; cu.metadata = o.metadata; cu.isPickable = false;
      const dark = MeshBuilder.CreatePlane(K.nm('dk'), { width: r.x1 - r.x0, height: r.z1 - r.z0 }, sc); dark.rotation.x = -Math.PI / 2; dark.position.set((r.x0 + r.x1) / 2, LH - 0.09, (r.z0 + r.z1) / 2); dark.material = K.pbr({ key: 'loungeDark', col: '#1A1612', rough: 0.85 }); (dark.material as any).backFaceCulling = false; dark.parent = o;
      for (const z of [r.z0 + 0.3, r.z1 - 0.15]) K.box(o, r.x1 - r.x0 - 0.3, 0.03, 0.08, M.lightWarm, (r.x0 + r.x1) / 2, LH - 0.13, z); }
    // walnut wainscot with a brass rail round the room
    { const o = K.obj(r.id, 'WAINSCOT', 0, 0, 0, 0, 'F1-LOUNGE/WAINSCOT'); for (const [x, z, w, d] of [[(r.x0 + r.x1) / 2, r.z0 + 0.17, r.x1 - r.x0, 0.03], [(r.x0 + r.x1) / 2, r.z1 - 0.17, r.x1 - r.x0, 0.03], [r.x1 - 0.17, (r.z0 + r.z1) / 2, 0.03, r.z1 - r.z0]]) { K.box(o, w, 1.1, d, M.walnut, x, 0.55, z); K.box(o, w, 0.04, d + 0.02, M.brass, x, 1.12, z); }
      K.box(o, 0.03, 1.1, 14, M.walnut, r.x0 + 0.17, 0.55, 37); }
    // fireplace 7, art deco brass: black lacquer chimney breast, brass surround in sunburst steps (2.32 m wide, 1.56 m high), the fire
    { const fz = 37, o = K.obj(r.id, 'FIREPLACE-7', r.x0 + 0.18, 0, fz, Math.PI / 2, 'F1-LOUNGE/FIREPLACE-7');
      K.box(o, 3.0, LH, 0.12, M.lacquer, 0, LH / 2, 0.06);
      for (let s = 0; s < 5; s++) { const w2 = 1.2 + s * 0.28, h2 = 1.0 + s * 0.14, d2 = 0.14 + (4 - s) * 0.02; K.box(o, w2 + 0.04, 0.04, d2, M.brass, 0, h2, 0.12 + d2 / 2); for (const sd of [-1, 1]) K.box(o, 0.04, h2, d2, M.brass, sd * w2 / 2, h2 / 2, 0.12 + d2 / 2); }
      K.box(o, 1.16, 0.96, 0.06, M.black, 0, 0.48, 0.13); K.box(o, 2.6, 0.05, 0.6, M.marbleDark, 0, 0.025, 0.42); K.box(o, 0.9, 0.06, 0.18, M.trunk, 0, 0.08, 0.26); K.box(o, 0.8, 0.5, 0.04, M.lightWarm, 0, 0.35, 0.18);
      for (let k = 0; k < 9; k++) { const a = (k - 4) * 0.22, rr = K.box(o, 0.02, 1.2, 0.03, M.brass, Math.sin(a) * 0.6, 2.6 + Math.cos(a) * 0.6, 0.14); rr.rotation.z = -a; }
      K.block(1, r.x0, fz - 1.5, r.x0 + 0.9, fz + 1.5);
      armchair(r, r.x0 + 2.6, fz - 1.0, -Math.PI / 2 - 0.4, M.leather); armchair(r, r.x0 + 2.6, fz + 1.0, -Math.PI / 2 + 0.4, M.leather); }
    // the bar, variation 2, black and brass: an L-shaped counter returning to the north wall, the back bar with its bottles, globe lights, stools
    { const bz = 49.4, xa = 95, xr = 105.2, o = K.obj(r.id, 'BAR-COUNTER', 0, 0, 0, 0, 'F1-LOUNGE/BAR-COUNTER');
      K.box(o, xr - xa, 1.08, 0.6, M.lacquer, (xa + xr) / 2, 0.54, bz); K.box(o, 0.6, 1.08, r.z1 - bz - 0.3, M.lacquer, xr - 0.3, 0.54, (bz + r.z1 - 0.3) / 2);
      K.box(o, xr - xa + 0.2, 0.06, 0.8, M.marbleDark, (xa + xr) / 2, 1.1, bz); K.box(o, 0.8, 0.06, r.z1 - bz - 0.4, M.marbleDark, xr - 0.3, 1.1, (bz + r.z1 - 0.4) / 2);
      const rail = K.cyl(o, 0.022, xr - xa, M.brass, (xa + xr) / 2, 0.2, bz - 0.4); rail.rotation.z = Math.PI / 2;
      K.block(1, xa - 0.1, bz - 0.45, xr + 0.15, r.z1);
      const bb = K.obj(r.id, 'BACK-BAR', 99, 0, r.z1 - 0.38, Math.PI, 'F1-LOUNGE/BACK-BAR'); K.box(bb, 6, 0.9, 0.35, M.lacquer, 0, 0.45, 0); K.box(bb, 6.1, 2.1, 0.04, M.screenBlack, 0, 2.0, 0.15);
      for (const [w, h, x, y] of [[6.2, 0.05, 0, 3.05], [6.2, 0.05, 0, 0.95], [0.05, 2.1, -3.08, 2.0], [0.05, 2.1, 3.08, 2.0]]) K.box(bb, w, h, 0.04, M.gold, x, y, 0.12);
      const bottle = [M.plantDark, M.gold, M.red, M.offwhite, M.navy, M.trunk, M.tealUI, M.yellow, M.brass, M.black, M.porcelain];
      for (const yy of [1.4, 1.85, 2.3]) { K.box(bb, 5.6, 0.015, 0.25, M.glass, 0, yy, 0.0); K.box(bb, 5.5, 0.01, 0.02, M.lightWarm, 0, yy - 0.012, 0.08);
        for (let k = 0; k < 20; k++) { const bx = -2.7 + k * 0.285; K.cyl(bb, 0.035, 0.26, bottle[(k * 7 + Math.round(yy * 10)) % 11], bx, yy + 0.14, -0.02); K.cyl(bb, 0.013, 0.08, M.black, bx, yy + 0.31, -0.02); } }
      for (let k = 0; k < 7; k++) { const sx = xa + 0.7 + k * 1.25, st = K.obj(r.id, 'BAR-STOOL', sx, 0, bz - 0.8); K.cyl(st, 0.21, 0.07, M.leatherBlack, 0, 0.8, 0); K.cyl(st, 0.2, 0.02, M.brass, 0, 0.755, 0); for (let q = 0; q < 4; q++) { const a = q / 4 * Math.PI * 2 + 0.4; K.cyl(st, 0.013, 0.78, M.brass, Math.cos(a) * 0.15, 0.38, Math.sin(a) * 0.15); } K.circle(1, sx, bz - 0.8, 0.25); }
      for (const sz of [50.2, 50.95, 51.6]) { const st = K.obj(r.id, 'BAR-STOOL', xr + 0.75, 0, sz - 0.4); K.cyl(st, 0.21, 0.07, M.leatherBlack, 0, 0.8, 0); for (let q = 0; q < 4; q++) { const a = q / 4 * Math.PI * 2 + 0.4; K.cyl(st, 0.013, 0.78, M.brass, Math.cos(a) * 0.15, 0.38, Math.sin(a) * 0.15); } K.circle(1, xr + 0.75, sz - 0.4, 0.25); }
      for (let k = 0; k < 6; k++) { const gx = xa + 0.6 + k * (xr - xa - 1.2) / 5, g = K.obj(r.id, 'GLOBE-LIGHT', gx, 0, bz - 0.5); K.cyl(g, 0.004, LH - 2.85, M.black, 0, (LH + 2.85) / 2, 0); K.ball(g, 0.17, M.light, 0, 2.85, 0); } }
    // seating: two rows of three groups of armchairs round coffee tables, on rugs
    for (const [k, gx] of [97.5, 103.5, 109.5].entries()) for (const gz of [34.2, 40.2]) {
      const rug = K.obj(r.id, 'RUG', gx, 0.024, gz); K.box(rug, 4.2, 0.01, 4.2, M.carpet, 0, 0, 0);
      table(r, gx, gz, 0.5, 0.42, M.walnut);
      for (const [dx, dz, yaw] of [[0, -1.1, 0], [0, 1.1, Math.PI], [-1.1, 0, Math.PI / 2], [1.1, 0, -Math.PI / 2]]) armchair(r, gx + dx, gz + dz, yaw, (k + Math.round(gz)) % 2 ? M.fabricTeal : M.fabricRust);
    }
    for (const [x, z] of [[r.x0 + 0.8, r.z0 + 0.8], [r.x1 - 0.8, r.z0 + 0.8], [r.x1 - 0.8, 44]]) plant(r, x, z, true);
    picture(r, 'aurora', 107, 2.3, r.z0 + 0.22, 0, 2.4, 1.4); picture(r, 'dusk', 96, 2.3, r.z0 + 0.22, 0, 1.8, 1.2); picture(r, 'gold', r.x1 - 0.22, 2.3, 38, -Math.PI / 2, 1.4, 1.8); picture(r, 'storm', r.x0 + 0.22, 2.3, 44, Math.PI / 2, 1.8, 1.1);
    for (const [x, z] of [[100, 36], [106, 36], [100, 44], [106, 44]]) { const g = K.obj(r.id, 'PENDANT', x, 0, z); K.cyl(g, 0.006, 1.2, M.black, 0, LH - 0.6, 0); K.cyl(g, 0.28, 0.3, M.brass, 0, LH - 1.3, 0, 0.03); K.ball(g, 0.08, M.light, 0, LH - 1.38, 0); }
  }
  /** An office as drawn: the desk and its chair, a cabinet, a shelf, a plant, two chairs for visitors. */
  function office(r: Room) {
    const east = r.x0 >= 136, dx = east ? 141.5 : 119.5, dz = r.z0 + 4.7;
    desk(r, dx, dz, Math.PI, 1.8, 0.8, M.oak, 2); officeChair(r, dx, dz - 1.0, 0);
    chair(r, dx - 0.5, dz + 1.3, Math.PI, M.fabricGrey); chair(r, dx + 0.5, dz + 1.3, Math.PI, M.fabricGrey);
    shelf(r, east ? r.x1 - 1.2 : r.x0 + 1.2, r.z1 - 0.4, Math.PI, 2, 2.0, 0.4); shelf(r, east ? r.x1 - 3.4 : r.x0 + 3.4, r.z1 - 0.4, Math.PI, 2, 2.0, 0.4);
    { const o = K.obj(r.id, 'CABINET', east ? r.x1 - 0.5 : r.x0 + 0.5, Y(r), r.z0 + 1.2, east ? -Math.PI / 2 : Math.PI / 2); K.box(o, 0.9, 1.3, 0.6, M.steel, 0, 0.65, 0); K.block(1, (east ? r.x1 - 0.8 : r.x0 + 0.2), r.z0 + 0.7, (east ? r.x1 - 0.2 : r.x0 + 0.8), r.z0 + 1.7); }
    plant(r, east ? r.x1 - 0.6 : r.x0 + 0.6, r.z1 - 1.6, true); picture(r, ['aurora', 'dusk', 'gold', 'storm'][Math.round(r.z0 / 10) % 4], (r.x0 + r.x1) / 2 + (east ? 3 : -3), 2.0, r.z0 + 0.2, 0, 1.6, 1.0);
    { const mx = east ? r.x0 + 12 : r.x1 - 6, o = K.obj(r.id, 'MEETING-TABLE', mx, Y(r), r.z0 + 5); K.box(o, 2.4, 0.05, 1.1, M.white, 0, 0.74, 0); K.box(o, 0.1, 0.72, 0.6, M.steel, 0, 0.36, 0); K.block(1, mx - 1.2, r.z0 + 4.45, mx + 1.2, r.z0 + 5.55);
      for (const s of [-1, 1]) for (const q of [-0.6, 0.6]) chair(r, mx + q, r.z0 + 5 + s * 0.85, s > 0 ? Math.PI : 0); }
  }
  /** Operations: the monitor wall along the north side, the duty desk and its chair as drawn, more desks for the planners. */
  function ops(r: Room) {
    const w = K.obj(r.id, 'MONITOR-WALL', 123, 0, 33.6, Math.PI, 'F1-OPS/MONITOR-WALL'); K.box(w, 16, 3.0, 0.2, M.black, 0, 2.2, 0);
    // the video wall: six monitors of departures and arrivals in turn, the whole width (see fids.ts)
    { const p = MeshBuilder.CreatePlane(K.nm('opsw'), { width: 15.7, height: 15.7 / (OPS_W[0] / OPS_W[1]) }, sc); p.material = makeFids(sc, 'BIAP').get('dep', 'opswall'); p.parent = w; p.position.set(0, 2.2, -0.11); p.rotation.y = Math.PI; p.metadata = w.metadata; }
    K.block(1, 115, 33.3, 131, 34);
    desk(r, 119.5, 27.9, Math.PI, 3.0, 0.9, M.white, 3); officeChair(r, 119.5, 26.8, 0);
    for (const [x, z] of [[126, 27.9], [126, 30.5]]) { desk(r, x, z, Math.PI, 2.4, 0.8, M.white, 2); officeChair(r, x, z - 0.95, 0); }
    { const c = K.obj(r.id, 'CLOCKS', 131.8, 3.6, 28, -Math.PI / 2); for (let i = 0; i < 4; i++) { K.cyl(c, 0.22, 0.04, M.white, -1.2 + i * 0.8, 0, 0); } }
  }
  /** The Academy as drawn: the board on the north wall, the teacher's desk facing the class, 4 rows of 5 student desks. */
  function academy(r: Room) {
    const b = K.obj(r.id, 'WHITEBOARD', 146, 0, 19.8, Math.PI, 'F1-ACADEMY/BOARD'); K.box(b, 8, 1.4, 0.05, M.whiteGloss, 0, 1.7, 0); K.box(b, 8.1, 0.06, 0.12, M.steel, 0, 0.98, 0.05);
    const sc2 = K.obj(r.id, 'PROJECTION', 146, 0, 19.75, Math.PI, 'F1-ACADEMY/SCREEN'); const p = MeshBuilder.CreatePlane(K.nm('ac'), { width: 3.2, height: 1.8 }, sc); p.material = K.picture(signC('Airport Dynasty Pro · Academy', '#1C2D52', '#F2F4F7', 1024, 576, '700 64px Arial, sans-serif'), 1); p.parent = sc2; p.position.set(0, 3.4, -0.05); p.rotation.y = Math.PI; p.metadata = sc2.metadata;
    desk(r, 144.9, 17.3, 0, 1.8, 0.8, M.oak, 1); officeChair(r, 144.9, 18.4, Math.PI);
    let n = 0;
    for (const z of [14.2, 10.6, 7.1, 3.5]) for (const x of [138.7, 142.3, 145.9, 149.5, 153.1]) { n++;
      const o = K.obj(r.id, 'STUDENT-DESK', x, 0, z, Math.PI, `F1-ACADEMY/DESK-${String(n).padStart(2, '0')}`); K.box(o, 1.2, 0.04, 0.6, M.oak, 0, 0.74, 0); for (const s of [-1, 1]) K.box(o, 0.04, 0.72, 0.55, M.steel, s * 0.57, 0.36, 0); K.box(o, 0.32, 0.02, 0.22, M.screenBlack, 0, 0.77, 0.05); K.block(1, x - 0.6, z - 0.3, x + 0.6, z + 0.3);
      chair(r, x, z - 0.65, 0, M.fabricBlue); }
  }
  function baghall(r: Room) {
    for (const [z0, dir] of [[56.5, 0], [63.5, 1]] as number[][]) {
      // the sorting belts, in pieces between the doors (so you can cross from the corridor to the ramps)
      const gaps = [18, 134, ...MOD.map(m => m + 14)].sort((a, b) => a - b); let x = r.x0 + 2;
      for (const gx of [...gaps, r.x1]) { const a = x, b = gx - 3; if (b - a > 4) { const o = K.obj(r.id, 'SORTING-BELT', (a + b) / 2, 0, z0, 0); K.box(o, b - a, 0.7, 1.1, M.steel, 0, 0.35, 0); K.box(o, b - a, 0.03, 0.9, M.rubber, 0, 0.71, 0); for (let k = 0; k < Math.floor((b - a) / 6); k++) K.box(o, 0.6, 0.4, 0.4, [M.navy, M.red, M.black, M.trunk][k % 4], -(b - a) / 2 + 3 + k * 6, 0.92, 0); K.block(1, a, z0 - 0.6, b, z0 + 0.6); } x = gx + 3; }
      void dir;
    }
    for (let k = 0; k < 10; k++) { const x = r.x0 + 20 + k * 32, o = K.obj(r.id, 'BAGGAGE-CART', x, 0, 60, Math.PI / 2); K.box(o, 1.4, 0.06, 2.6, M.steel, 0, 0.55, 0); K.box(o, 1.42, 0.08, 2.6, M.yellow, 0, 1.6, 0); for (const sx of [-0.6, 0.6]) for (const sz of [-1.0, 1.0]) K.cyl(o, 0.16, 0.12, M.black, sx, 0.18, sz); K.block(1, x - 1.3, 59.3, x + 1.3, 60.7); }
  }
  /** A gate: rows of seats facing the windows, the gate desk, its stairs and lift down to the walk-out gate (or up to the jetway). */
  function gateRoom(r: Room, fl: number) {
    const x0 = r.x0, rowsX = fl === 2 ? [x0 + 2.5, x0 + 26] : [x0 + 5.5, x0 + 38.5];
    for (let k = 0; k < 3; k++) seats(r, (rowsX[0] + rowsX[1]) / 2, PG + 3.4 + k * 3.0, 0, Math.floor((rowsX[1] - rowsX[0]) / 0.62), false);
    const dx = fl === 2 ? x0 + 17 : x0 + 20, gd = K.obj(r.id, 'GATE-DESK', dx, Y(r), PN - 1.6, 0); K.box(gd, 2.6, 1.05, 0.7, M.white, 0, 0.52, 0); K.box(gd, 2.7, 0.05, 0.8, M.marbleDark, 0, 1.07, 0); K.box(gd, 0.5, 0.3, 0.03, M.screenBlack, 0.6, 1.3, -0.1);
    K.block(r.f, dx - 1.35, PN - 2.0, dx + 1.35, PN - 1.2); officeChair(r, dx, PN - 0.7, Math.PI);
    sign(r, `GATE ${r.id.replace(/\D+/g, '').slice(-1)}`, dx, 3.5, PN - 0.25, Math.PI, 2.4, 0.6, '#F2C230', '#14202E');
    plant(r, r.x1 - 1.2, PG + 1, true); bin(r, dx - 2.6, PN - 1.6);
  }
  function food(r: Room) {
    for (const x of [18, 24.5, 31, 37.5, 44, 50.5]) for (const z of [39.3, 33.9]) { table(r, x, z, 0.55, 0.74, M.white); for (const [dx, dz, yaw] of [[0, -0.85, 0], [0, 0.85, Math.PI], [-0.85, 0, Math.PI / 2], [0.85, 0, -Math.PI / 2]]) chair(r, x + dx, z + dz, yaw, M.fabricRust); }
    for (const x of [16, 53.5]) plant(r, x, 31, true);
  }
  function eatery(r: Room) {
    const cx = (r.x0 + r.x1) / 2, n = r.id.replace(/\D+/g, '').slice(-1), cols = ['#B3261E', '#2E7D32', '#E8A33D', '#1C5DA8', '#6A3FA0'];
    counter(r, cx, 49.2, 0, 6.4, 0.8, M.white, M.marbleDark);
    { const o = K.obj(r.id, 'KITCHEN', cx, Y(r), 51.4, Math.PI); K.box(o, 7.6, 1.0, 0.7, M.steel, 0, 0.5, 0); K.box(o, 7.6, 0.9, 0.4, M.steel, 0, 2.2, 0.1); K.block(2, r.x0 + 0.3, 51, r.x1 - 0.3, 51.8); }
    { const o = K.obj(r.id, 'MENU-BOARD', cx, Y(r) + 2.9, 51.75, Math.PI); const p = MeshBuilder.CreatePlane(K.nm('mn'), { width: 6, height: 1.2 }, sc); p.material = K.picture(signC(`EATERY ${n}`, cols[+n - 1] || '#1C2D52', '#FFFFFF', 1024, 205, '700 120px Arial, sans-serif'), 1); p.parent = o; p.rotation.y = Math.PI; p.metadata = o.metadata; }
    for (const sx of [-2.2, -0.8, 0.6, 2.0]) { const st = K.obj(r.id, 'STOOL', cx + sx, Y(r), 48.3); K.cyl(st, 0.19, 0.06, M.leatherBlack, 0, 0.75, 0); K.cyl(st, 0.03, 0.72, M.chrome, 0, 0.36, 0); K.circle(2, cx + sx, 48.3, 0.22); }
  }
  function taxfree(r: Room) {
    for (const x of [60.9, 66.9, 72.9, 78.9, 84.9]) for (const z of [37.5, 33.5]) shelf(r, x, z, 0, 2.6, 1.6, 0.9);
    counter(r, 62, 40.8, Math.PI, 3.2, 0.8, M.lacquer, M.gold); counter(r, 84, 40.8, Math.PI, 3.2, 0.8, M.lacquer, M.gold);
    sign(r, 'TAX FREE', 73, 4.3, 41.7, Math.PI, 5, 0.8, '#14202E', '#D4AF37');
    { const o = K.obj(r.id, 'PERFUME-ISLAND', 73, Y(r), 35.5); K.cyl(o, 1.0, 1.0, M.whiteGloss, 0, 0.5, 0, undefined, 32); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; K.cyl(o, 0.05, 0.16, M.gold, Math.cos(a) * 0.75, 1.08, Math.sin(a) * 0.75); } K.circle(2, 73, 35.5, 1.05); }
  }
  function family(r: Room) {
    const mat = K.obj(r.id, 'PLAY-MAT', 97, Y(r) + 0.03, 35); K.box(mat, 6, 0.04, 5, M.tealUI, 0, 0, 0);
    for (const [k, c] of [M.red, M.yellow, M.navy].entries()) { const b = K.obj(r.id, 'TOY-BLOCK', 95 + k * 1.6, Y(r), 34.5); K.box(b, 0.6, 0.6, 0.6, c, 0, 0.3, 0); K.circle(2, 95 + k * 1.6, 34.5, 0.4); }
    sofa(r, 97, 40.6, Math.PI, 3, M.fabricTeal); table(r, 101.5, 33, 0.5, 0.5, M.white); for (const a of [0, 2.1, 4.2]) chair(r, 101.5 + Math.cos(a) * 0.85, 33 + Math.sin(a) * 0.85, -a - Math.PI / 2, M.fabricBlue);
    counter(r, 92, 41.2, Math.PI, 2.2, 0.7, M.white, M.white, 0.9);
  }
  /** The big bar: an oval counter of black lacquer and brass in the middle with its back bar of bottles, stools round it, tables round the room, globe lights. */
  function bar(r: Room) {
    const cx = 125, cz = 40.9, ax = 9, az = 4.5, N = 44, o = K.obj(r.id, 'BAR-COUNTER', cx, Y(r), cz, 0, 'F2-BAR/BAR-COUNTER');
    for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, a2 = (k + 1) / N * Math.PI * 2, x1 = Math.cos(a) * ax, z1 = Math.sin(a) * az, x2 = Math.cos(a2) * ax, z2 = Math.sin(a2) * az, len = Math.hypot(x2 - x1, z2 - z1) + 0.04, yaw = -Math.atan2(z2 - z1, x2 - x1);
      K.box(o, len, 1.08, 0.6, M.lacquer, (x1 + x2) / 2, 0.54, (z1 + z2) / 2, yaw); K.box(o, len, 0.06, 0.82, M.marbleDark, (x1 + x2) / 2 * 1.01, 1.1, (z1 + z2) / 2 * 1.01, yaw); K.box(o, len, 0.03, 0.03, M.brass, (x1 + x2) / 2 * 1.06, 0.2, (z1 + z2) / 2 * 1.08, yaw); }
    const bb = K.obj(r.id, 'BACK-BAR', cx, Y(r), cz, 0, 'F2-BAR/BACK-BAR'); K.cyl(bb, 1, 0.9, M.lacquer, 0, 0.45, 0, undefined, 40).scaling.set(12.8, 0.9, 4.8);
    const bottle = [M.plantDark, M.gold, M.red, M.offwhite, M.navy, M.trunk, M.tealUI, M.yellow, M.brass, M.black, M.porcelain];
    for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; K.cyl(bb, 0.035, 0.28, bottle[k % 11], Math.cos(a) * ax * 0.5, 1.05, Math.sin(a) * az * 0.42); }
    for (const yy of [1.6, 2.1]) { const g = K.cyl(bb, 1, 0.02, M.glass, 0, yy, 0, undefined, 40); g.scaling.set(11, 0.02, 4.0); }
    K.block(2, cx - ax - 0.4, cz - az - 0.4, cx + ax + 0.4, cz + az + 0.4);
    for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2, sx = cx + Math.cos(a) * (ax + 0.85), sz = cz + Math.sin(a) * (az + 0.85), st = K.obj(r.id, 'BAR-STOOL', sx, Y(r), sz);
      K.cyl(st, 0.21, 0.07, M.leatherBlack, 0, 0.8, 0); K.cyl(st, 0.2, 0.02, M.brass, 0, 0.755, 0); for (let q = 0; q < 4; q++) { const b = q / 4 * Math.PI * 2 + 0.4; K.cyl(st, 0.013, 0.78, M.brass, Math.cos(b) * 0.15, 0.38, Math.sin(b) * 0.15); } K.circle(2, sx, sz, 0.25); }
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, gx = cx + Math.cos(a) * ax * 0.7, gz = cz + Math.sin(a) * az * 0.7, g = K.obj(r.id, 'GLOBE-LIGHT', gx, Y(r), gz); K.cyl(g, 0.004, 2.4, M.black, 0, 4.2, 0); K.ball(g, 0.2, M.light, 0, 3.0, 0); }
    for (const x of [110, 118.9, 127.9, 136.9]) for (const z of [48.8, 32.9]) { if (x > 136 && z > 45) continue; table(r, x, z, 0.6, 0.74, M.marbleDark); for (const [dx, dz, yaw] of [[0, -0.9, 0], [0, 0.9, Math.PI], [-0.9, 0, Math.PI / 2], [0.9, 0, -Math.PI / 2]]) chair(r, x + dx, z + dz, yaw, M.leather); }
    for (const [x, z] of [[105, 31], [145, 31], [105, 51]]) plant(r, x, z, true);
    sign(r, 'THE BAR', 125, 4.6, 30.25, 0, 4, 0.8, '#101114', '#D4AF37');
  }
  /** The walkway, 16 m wide: the two moving walkways side by side down its middle (east and west, one rail between them),
   *  a clear lane about 6 m wide on each side, and seating islands with planters by the gates, between the walkways' sections. */
  function walk(r: Room) {
    const zc = (r.z0 + r.z1) / 2, segs = [[-75, -5], [5, 75], [85, 155], [165, 235]];
    for (const [a, b] of segs) {
      for (const [dz, dir] of [[-0.85, 1], [0.85, -1]]) { const z = zc + dz, o = K.obj(r.id, 'MOVING-WALKWAY', (a + b) / 2, Y(r), z, 0); o.metadata.dir = dir; o.metadata.x0 = a; o.metadata.x1 = b; o.metadata.z = z;
        K.box(o, b - a, 0.12, 1.5, M.rubber, 0, 0.06, 0); K.box(o, 0.6, 0.02, 1.5, M.yellow, -(b - a) / 2 + 0.3, 0.125, 0); K.box(o, 0.6, 0.02, 1.5, M.yellow, (b - a) / 2 - 0.3, 0.125, 0);
        for (let k = 0; k < Math.floor((b - a) / 12); k++) { const p = MeshBuilder.CreatePlane(K.nm('arw'), { width: 1.0, height: 0.5 }, sc); p.material = K.picture(signC(dir > 0 ? '→' : '←', '#2A2D33', '#F2C230', 256, 128, '700 110px Arial, sans-serif'), 1); p.parent = o; p.rotation.x = Math.PI / 2; p.position.set(-(b - a) / 2 + 6 + k * 12, 0.13, 0); p.metadata = o.metadata; } }
      const rails = K.obj(r.id, 'WALKWAY-RAILS', (a + b) / 2, Y(r), zc, 0);
      for (const dz of [-1.68, 0, 1.68]) { K.box(rails, b - a, 0.9, 0.06, M.glass, 0, 0.55, dz); K.box(rails, b - a, 0.07, dz ? 0.14 : 0.2, M.black, 0, 1.02, dz); K.block(2, a, zc + dz - 0.1, b, zc + dz + 0.1); }
    }
    // seating along the south wall at each crossing between the walkways' sections (the middle kept clear), planters along the south wall
    for (const gx of [0, 80, 160]) seats(r, gx, r.z0 + 0.5, 0, 6, false);
    for (let x = -78; x < 242; x += 40) { plant(r, x + 2, r.z0 + 0.8, true); }
  }
  void IS_PC; void TransformNode;
}
