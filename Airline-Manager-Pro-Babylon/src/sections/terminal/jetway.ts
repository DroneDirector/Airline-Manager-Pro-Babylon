// The jetways J-1 to J-4: apron-drive passenger boarding bridges, one design for every jetway gate, each its own object
// with its id. As built: a glazed fixed vestibule on the gate's jetway door (its floor flush with the gate's floor at
// +6.00), the rotunda (3.6 m) on its two columns, the glazed telescopic tunnel (walkway 2.5 m wide, a steel X truss
// outside its glass, anti-slip floor, handrails both sides, ceiling lights) sloping down to the cab, the drive unit
// (lift columns on a two-wheel bogie, the yellow air hoses), the service stair, and the round rotating cab with its
// operator's console, bumper and folding canopy (bellows) at the aircraft's front door, its floor at the door's sill.
// Overall length 18.5 m (rotunda to canopy), 4.2 m high; only the slope follows the gate floor and the door's height.
// The drive wheels stand on the PBB wheel box painted on the apron (0.62 of the reach from the rotunda).
import { MeshBuilder, Mesh, Vector3, TransformNode } from '@babylonjs/core';
import { Kit } from './kit';
import { F2Y, PN } from './plan';

/** Where a jetway's rotunda stands for a stand (plan x, z): 15 m east of the stand's centre line, 2.5 m out from the pier. */
export const ROTUNDA = (standX: number) => [standX + 15, PN + 2.5];
/** The aircraft's front door (plan x, height, z) at a stand: 2.4 m left of the centre line, 5.5 m behind the nose, sill at 3.3 m. */
export const DOOR = (standX: number, nz: number) => [standX + 2.4, 3.3, nz + 5.5];

export function buildJetway(K: Kit, n: number, gateX: number, stand: { x: number; nz: number }) {
  const { M, sc } = K, o = K.obj('APRON', 'JETWAY', gateX, F2Y, PN, 0, `J-${n}`); o.metadata.kind = 'jetway';
  // its own finishes: brushed aluminium cladding, a lighter steel truss, white panels inside (they read as metal in any light)
  const JS = K.pbr({ key: 'jwAlu', col: '#C3C9CE', metal: 0.25, rough: 0.38 }), JT = K.pbr({ key: 'jwTruss', col: '#B3BAC1', metal: 0.2, rough: 0.35 }), JW = K.pbr({ key: 'jwPanel', col: '#E7EAED', rough: 0.55 }), JB = K.pbr({ key: 'jwBellows', col: '#2B2D31', rough: 0.8 });
  const meta = o.metadata, node = (par: TransformNode, x: number, y: number, z: number, ry = 0, rx = 0) => { const t = new TransformNode(K.nm('jw'), sc); t.parent = par; t.position.set(x, y, z); t.rotation.y = ry; t.rotation.x = rx; t.metadata = meta; return t; };
  /** A beam of w × h between two points. */
  const beam = (par: TransformNode, p: Vector3, q: Vector3, w: number, h: number, mat: any) => { const d = q.subtract(p), L = d.length(); if (L < 1e-3) return; const t = node(par, (p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2, Math.atan2(d.x, d.z), -Math.atan2(d.y, Math.hypot(d.x, d.z))); K.box(t, w, h, L, mat, 0, 0, 0); };
  const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
  // in the jetway's frame: the gate's door at the origin (its floor y = 0), x east, z out onto the apron
  const R = ROTUNDA(stand.x), D = DOOR(stand.x, stand.nz);
  const rx = R[0] - gateX, rz = R[1] - PN, dx = D[0] - gateX, dy = D[1] - F2Y, dz = D[2] - PN;
  const IW = 2.5, IH = 2.4, T = 0.14, RR = 1.8, CR = 1.7, FRONT = 1.4;
  const cx = dx + 0.15 + FRONT + CR, cz = dz;                         // the cab's round part (the canopy's face at the door)
  const ax = rx - cx, az = rz - cz, hd = Math.hypot(ax, az), ux = -ax / hd, uz = -az / hd;   // rotunda -> cab, on the ground
  const tunYaw = Math.atan2(ux, uz);
  // ---- the fixed vestibule on the gate's jetway door ----
  { const x0 = -1.45, x1 = rx - RR + 0.25, z0 = 0, z1 = rz + 1.8, w = x1 - x0, d = z1 - z0, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
    K.box(o, w, 0.2, d, JS, xm, -0.1, zm); K.box(o, w - 0.1, 0.02, d - 0.05, M.rubber, xm, 0.01, zm);
    K.box(o, w + 0.2, T + 0.1, d + 0.1, JW, xm, IH + 0.2 + T / 2, zm); for (let x = x0 + 1; x < x1 - 0.4; x += 2) K.box(o, 0.5, 0.03, 1.1, M.light, x, IH + 0.19, zm);
    // its glass walls: west and out onto the apron, a sill below, a steel X truss outside
    const wall = (p: Vector3, q: Vector3, nrm: Vector3) => { const L = Vector3.Distance(p, q), m = p.add(q).scale(0.5), t = node(o, m.x, 0, m.z, Math.atan2(q.x - p.x, q.z - p.z));
      K.box(t, T, 0.45, L, JS, 0, 0.225, 0); K.box(t, T * 0.4, IH - 0.45 + 0.2, L, M.glass, 0, 0.45 + (IH - 0.25) / 2, 0); K.box(t, 0.05, 0.05, L - 0.1, JS, -0.1 * (nrm.x || nrm.z) * 0, 0.95, 0);
      const bays = Math.max(1, Math.round(L / 2)), bl = L / bays, so = 0.12; for (let i = 0; i <= bays; i++) K.box(t, 0.1, IH + 0.2, 0.1, JS, so, (IH + 0.2) / 2, -L / 2 + i * bl);
      for (let i = 0; i < bays; i++) { const z0b = -L / 2 + i * bl; beam(t, V(so, 0.45, z0b), V(so, IH + 0.15, z0b + bl), 0.07, 0.07, JT); beam(t, V(so, IH + 0.15, z0b), V(so, 0.45, z0b + bl), 0.07, 0.07, JT); } };
    wall(V(x0, 0, z0 + 0.05), V(x0, 0, z1), V(-1, 0, 0)); wall(V(x0, 0, z1), V(x1 - 0.6, 0, z1), V(0, 0, 1)); wall(V(x1 - 0.2, 0, z0 + 0.05), V(x1 - 0.2, 0, rz - 1.25), V(1, 0, 0)); }
  // ---- the rotunda: round, 3.6 m, open towards the vestibule and the tunnel; on two columns ----
  { const t = node(o, rx, 0, rz), gaps = [-Math.PI / 2, tunYaw], seg = 28;
    K.cyl(t, RR + 0.05, 0.22, JS, 0, -0.11, 0, undefined, 28); K.cyl(t, RR - 0.05, 0.02, M.rubber, 0, 0.01, 0, undefined, 28);
    K.cyl(t, RR + 0.12, 0.3, JS, 0, IH + 0.45, 0, undefined, 28); K.cyl(t, RR + 0.02, 0.04, JW, 0, IH + 0.28, 0, undefined, 28); K.cyl(t, 0.5, 0.03, M.light, 0, IH + 0.25, 0, undefined, 16);
    for (let i = 0; i < seg; i++) { const a = (i + 0.5) / seg * Math.PI * 2, off = Math.min(...gaps.map(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))))); if (off < 0.95) continue;
      const w = 2 * Math.PI * RR / seg * 1.06; K.box(t, w, IH + 0.3, 0.08, JS, Math.sin(a) * RR, (IH + 0.3) / 2, Math.cos(a) * RR, a);
      if (i % 2) K.box(t, 0.05, IH + 0.3, 0.12, JW, Math.sin(a) * (RR + 0.05), (IH + 0.3) / 2, Math.cos(a) * (RR + 0.05), a); }
    // the machinery on top, the service cabinet on its side
    K.box(t, 1.6, 0.7, 1.2, JW, 0.2, IH + 0.95, 0.1); K.box(t, 1.5, 0.08, 1.1, JS, 0.2, IH + 1.34, 0.1);
    K.box(t, 0.7, 1.6, 1.0, JW, RR + 0.3, 1.2, 0.3); K.box(t, 0.02, 1.2, 0.8, JS, RR + 0.66, 1.2, 0.3);
    // its columns down to the apron, a cross brace
    for (const sx of [-0.7, 0.7]) K.box(t, 0.36, F2Y - 0.22, 0.36, JS, sx, -F2Y / 2 - 0.11, 0.6);
    beam(t, V(-0.7, -F2Y + 0.6, 0.6), V(0.7, -1.2, 0.6), 0.12, 0.12, JS); beam(t, V(0.7, -F2Y + 0.6, 0.6), V(-0.7, -1.2, 0.6), 0.12, 0.12, JS);
    K.box(t, 2.0, 0.3, 1.0, JS, 0, -F2Y + 0.15, 0.6);
    // the yellow air hoses hanging from the rotunda
    for (let k = 0; k < 7; k++) K.cyl(t, 0.17, 0.42, M.yellow, RR + 0.25 + (k % 2) * 0.05, -0.6 - k * 0.42, -0.8 + (k % 2) * 0.06, undefined, 12);
    K.block(1, R[0] - 1.2, R[1] - 0.4, R[0] + 1.2, R[1] + 1.6); }
  // ---- the telescopic tunnel: three sections, glazed, the X truss outside, down to the cab ----
  const A = V(rx + ux * (RR - 0.25), 0, rz + uz * (RR - 0.25)), B = V(cx - ux * (CR - 0.25), dy, cz - uz * (CR - 0.25)), AB = B.subtract(A), L = AB.length();
  const tun = node(o, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, tunYaw, -Math.atan2(AB.y, Math.hypot(AB.x, AB.z)));
  K.box(tun, IW + 0.3, 0.22, L, JS, 0, -0.11, 0); K.box(tun, IW, 0.02, L, M.rubber, 0, 0.01, 0);
  for (let z = -L / 2 + 0.8; z < L / 2 - 0.4; z += 1.9) K.box(tun, 0.55, 0.03, 1.2, M.light, 0, IH - 0.03, z);
  const secs = [[-L / 2, -L / 2 + L * 0.4, 0.22], [-L / 2 + L * 0.38, -L / 2 + L * 0.72, 0.11], [-L / 2 + L * 0.7, L / 2, 0]];
  for (const [z0, z1, g] of secs) { const l = z1 - z0, zm = (z0 + z1) / 2, hw = IW / 2 + T / 2 + g / 2;
    for (const sx of [-1, 1]) { const x = sx * hw;
      K.box(tun, T, 0.45, l, JS, x, 0.225, zm); K.box(tun, T * 0.4, IH - 0.45 + g, l, M.glass, x, 0.45 + (IH - 0.45 + g) / 2, zm); K.box(tun, T + 0.04, 0.22, l, JS, x, IH + g + 0.11, zm);
      K.box(tun, 0.05, 0.05, l, JS, sx * (IW / 2 - 0.08), 0.95, zm);
      // the X truss outside the glass, a bay every 2 m
      const so = x + sx * 0.12, bays = Math.max(1, Math.round(l / 2)), bl = l / bays;
      for (let i = 0; i <= bays; i++) K.box(tun, 0.1, IH + g - 0.2, 0.1, JS, so, 0.45 + (IH + g - 0.45) / 2, z0 + i * bl);
      K.box(tun, 0.1, 0.1, l, JS, so, 0.45, zm); K.box(tun, 0.1, 0.1, l, JS, so, IH + g, zm);
      for (let i = 0; i < bays; i++) { const b0 = z0 + i * bl; beam(tun, V(so, 0.45, b0), V(so, IH + g, b0 + bl), 0.08, 0.08, JT); beam(tun, V(so, IH + g, b0), V(so, 0.45, b0 + bl), 0.08, 0.08, JT); } }
    K.box(tun, IW + 2 * T + g + 0.1, 0.14, l, JW, 0, IH + g + 0.29, zm); for (let z = z0 + 0.6; z < z1; z += 1.2) K.box(tun, IW + 2 * T + g + 0.14, 0.03, 0.06, JS, 0, IH + g + 0.37, z);
    // the section's end frame
    K.box(tun, IW + 2 * T + g + 0.3, 0.16, 0.16, JS, 0, IH + g + 0.2, z1 - 0.08); for (const sx of [-1, 1]) K.box(tun, 0.16, IH + g + 0.3, 0.16, JS, sx * (hw + 0.1), (IH + g) / 2, z1 - 0.08); }
  // ---- the drive unit: lift columns on a two-wheel bogie, where the PBB wheel box is painted (0.62 of the reach) ----
  { const reach = Math.hypot(D[0] - R[0], D[2] - R[1]), f = Math.max(0.5, Math.min(0.9, (0.62 * reach - (RR - 0.25)) / Math.hypot(B.x - A.x, B.z - A.z)));
    const W = A.add(AB.scale(f)), bog = node(o, W.x, -F2Y, W.z, tunYaw), top = W.y - 0.22 + F2Y;
    K.box(bog, 2.6, 0.45, 1.3, JS, 0, 0.9, 0); K.box(bog, 1.2, 0.5, 0.9, JW, 0, 1.35, -0.2);
    for (const sx of [-1.05, 1.05]) { K.part('jwWheel', () => MeshBuilder.CreateCylinder('c', { diameter: 1, height: 1, tessellation: 24 }, sc), M.black, bog, sx, 0.55, 0, 0, 0, Math.PI / 2, 1.1, 0.45, 1.1);
      K.part('jwHub', () => MeshBuilder.CreateCylinder('c', { diameter: 1, height: 1, tessellation: 16 }, sc), JS, bog, sx * 1.02, 0.55, 0, 0, 0, Math.PI / 2, 0.55, 0.5, 0.55); }
    for (const sx of [-0.55, 0.55]) { K.box(bog, 0.32, top - 1.1, 0.32, JS, sx, 1.1 + (top - 1.1) / 2, 0.15); K.box(bog, 0.24, (top - 1.1) * 0.5, 0.24, M.chrome || JS, sx, 1.1 + (top - 1.1) * 0.72, 0.15); }
    K.box(bog, 1.6, 0.25, 0.5, JS, 0, top - 0.12, 0.15);
    for (let k = 0; k < 6; k++) K.cyl(bog, 0.16, 0.4, M.yellow, 1.0 + (k % 2) * 0.05, top - 0.5 - k * 0.4, 0.45, undefined, 12);
    K.block(1, W.x + gateX - 1.6, W.z + PN - 1.6, W.x + gateX + 1.6, W.z + PN + 1.6);
    // ---- the service stair: from a landing beside the tunnel down to the apron, towards the terminal ----
    const rt = V(Math.cos(tunYaw), 0, -Math.sin(tunYaw)), land = W.add(rt.scale(IW / 2 + 0.9)), ly = land.y - 0.25, drop = ly + F2Y, run = drop * 1.05, back = V(-ux, 0, -uz);
    const s0 = V(land.x, ly, land.z), s1 = s0.add(back.scale(run)).add(V(0, -drop, 0));
    K.box(node(o, land.x, ly - 0.05, land.z, tunYaw), 1.2, 0.1, 1.4, JS, 0, 0, 0);
    for (const so of [-0.5, 0.5]) { const off = rt.scale(so); beam(o, s0.add(off), s1.add(off), 0.08, 0.25, JS); beam(o, s0.add(off).add(V(0, 1, 0)), s1.add(off).add(V(0, 1, 0)), 0.05, 0.05, JS);
      for (let i = 0; i <= 4; i++) { const p = s0.add(s1.subtract(s0).scale(i / 4)).add(off); beam(o, p, p.add(V(0, 1, 0)), 0.05, 0.05, JS); } }
    const steps = Math.round(drop / 0.18); for (let i = 1; i < steps; i++) { const p = s0.add(s1.subtract(s0).scale(i / steps)); K.box(node(o, p.x, p.y, p.z, tunYaw), 1.0, 0.04, 0.26, JS, 0, 0, 0); } }
  // ---- the cab: round (it turns), the front with the console, the bumper and the canopy at the door ----
  { const t = node(o, cx, dy, cz), seg = 26, gaps = [tunYaw + Math.PI, -Math.PI / 2];
    K.cyl(t, CR + 0.05, 0.22, JS, 0, -0.11, 0, undefined, 26); K.cyl(t, CR - 0.05, 0.02, M.rubber, 0, 0.01, 0, undefined, 26);
    K.cyl(t, CR + 0.1, 0.2, JS, 0, IH + 0.3, 0, undefined, 26); K.cyl(t, 0.45, 0.03, M.light, 0, IH + 0.18, 0, undefined, 16);
    for (let i = 0; i < seg; i++) { const a = (i + 0.5) / seg * Math.PI * 2, off = Math.min(...gaps.map(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))))); if (off < 0.9) continue;
      K.box(t, 2 * Math.PI * CR / seg * 1.06, IH + 0.2, 0.08, JS, Math.sin(a) * CR, (IH + 0.2) / 2, Math.cos(a) * CR, a);
      K.box(t, 0.04, IH + 0.2, 0.1, JW, Math.sin(a) * (CR + 0.05), (IH + 0.2) / 2, Math.cos(a) * (CR + 0.05), a); }
    // the front: from the round part to the door (towards -x, the aircraft), 3.6 m wide
    const fx0 = -CR + 0.3, fx1 = -CR - FRONT, fm = (fx0 + fx1) / 2, fw = fx0 - fx1;
    K.box(t, fw + 0.2, 0.22, 3.6, JS, fm, -0.11, 0); K.box(t, fw, 0.02, 3.4, M.rubber, fm, 0.01, 0); K.box(t, fw + 0.3, 0.18, 3.7, JS, fm, IH + 0.3, 0);
    for (const sz of [-1, 1]) { K.box(t, fw, IH + 0.2, 0.1, JS, fm, (IH + 0.2) / 2, sz * 1.8); K.box(t, fw * 0.6, 0.6, 0.04, M.glass, fm, 1.6, sz * 1.86); }
    // the operator's console (screen and controls) by the left wall, under its window
    K.box(t, 0.7, 1.0, 0.55, M.black, fm + 0.1, 0.5, 1.35); K.box(t, 0.5, 0.3, 0.03, M.tealUI || M.light, fm + 0.1, 1.15, 1.1);
    // the bumper and the canopy (bellows): dark folding frames round the doorway, wider towards the aircraft
    K.box(t, 0.2, 0.12, 3.0, M.black, fx1 - 0.1, 0.06, 0); K.box(t, 0.21, 0.04, 3.0, M.yellow, fx1 - 0.1, 0.13, 0);
    for (let k = 0; k < 5; k++) { const xk = fx1 - 0.05 - k * 0.11, grow = k * 0.08, wz = 3.4 + grow, hy = IH + 0.4 + grow;
      K.box(t, 0.12, 0.18, wz, JB, xk, hy, 0); for (const sz of [-1, 1]) K.box(t, 0.12, hy, 0.5 + grow / 2, JB, xk, hy / 2, sz * (wz / 2 - 0.25 - grow / 4)); }
    K.block(1, cx + gateX - CR - FRONT - 1.2, cz + PN - 1.9, cx + gateX + CR, cz + PN + 1.9); }
  return o;
}
