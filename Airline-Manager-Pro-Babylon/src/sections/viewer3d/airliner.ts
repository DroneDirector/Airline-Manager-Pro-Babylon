// The aircraft in the 3D viewer: a narrow-body twin jet of the A320 family's size (37.6 m long, 35.8 m span),
// built from its published dimensions: the fuselage with its nose, flight deck windows and swept-up tail cone, the
// swept wings with their sharklets, the tailplane and fin, two high-bypass engines on pylons with their fans turning,
// the cabin windows and doors, and the lights (navigation, strobes, beacons, logo light). Our own livery, no
// airline's. Painted, gloss-coated metal (physically based), lit by the sky round it.
// Axes: x to the right wing, y up, z forward (the nose), metres, the middle of the fuselage at the origin.
import {
  Scene, Mesh, MeshBuilder, VertexData, TransformNode, PBRMaterial, Color3, DynamicTexture, Vector3, StandardMaterial, Texture,
} from '@babylonjs/core';

const L = 37.57, RX = 1.98, RY = 2.07, NOSE = 5.2, TAIL = 11.6;
export interface Airliner { gear: TransformNode[]; gearK: number; taxiLight?: any; root: TransformNode; fans: Mesh[]; strobes: Mesh[]; beacons: Mesh[]; navs: Mesh[]; logo: Mesh[]; casters: Mesh[]; exhausts: Vector3[]; paint: PBRMaterial[] }

/** The fuselage's cross-section at s metres from the nose: half-width, half-height and the height of its middle. */
function section(s: number): { rx: number; ry: number; cy: number } {
  if (s < NOSE) { const t = s / NOSE, k = Math.pow(Math.max(0, 1 - Math.pow(1 - t, 2.25)), 0.5); return { rx: RX * Math.max(0.02, k), ry: RY * Math.max(0.02, k), cy: -0.32 * RY * Math.pow(1 - t, 1.6) }; }
  const e = L - TAIL;
  if (s > e) { const t = (s - e) / TAIL, k = 1 - (1 - 0.1) * (t * t * (3 - 2 * t)) * 0.92 - 0.08 * t; const ry = RY * k; return { rx: RX * (k * 0.96 + 0.04 * (1 - t)), ry, cy: (RY - ry) * 0.86 }; }
  return { rx: RX, ry: RY, cy: 0 };
}
function fuselage(sc: Scene): Mesh {
  const NS = 90, NA = 56, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NS; i++) {
    const u = i / NS, s = L * u, q = section(s), z = L / 2 - s;
    for (let j = 0; j <= NA; j++) { const a = j / NA * Math.PI * 2; pos.push(q.rx * Math.sin(a), q.cy + q.ry * Math.cos(a), z); uv.push(u, j / NA); }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const m = new Mesh('fuselage', sc), vd = new VertexData(); vd.positions = pos; vd.indices = idx; vd.uvs = uv; const nr: number[] = []; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
  return m;
}
/** A wing, tailplane or fin: a tapered, swept surface with a real aerofoil (NACA four-digit, thickness tc), from its
 *  root leading edge to its tip leading edge, the chord running backwards (−z) and the thickness along th. */
function surface(sc: Scene, name: string, rootLE: Vector3, tipLE: Vector3, rc: number, tcd: number, tc: number, th: Vector3, camber = 0.02): Mesh {
  const NS = 14, NC = 22, pos: number[] = [], idx: number[] = [], uv: number[] = [];
  const cw = (x: number) => [x, 5 * tc * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)];
  const ring: number[][] = [];
  for (let k = 0; k <= NC; k++) { const x = 0.5 - 0.5 * Math.cos(k / NC * Math.PI); const [xx, y] = cw(x); ring.push([xx, y + camber * 4 * x * (1 - x)]); }
  for (let k = NC - 1; k >= 1; k--) { const x = 0.5 - 0.5 * Math.cos(k / NC * Math.PI); const [xx, y] = cw(x); ring.push([xx, -y + camber * 4 * x * (1 - x)]); }
  const NR = ring.length;
  for (let i = 0; i <= NS; i++) {
    const f = i / NS, c = rc + (tcd - rc) * f, le = Vector3.Lerp(rootLE, tipLE, f), thin = 1 - 0.25 * f;
    for (let k = 0; k <= NR; k++) { const p = ring[k % NR]; pos.push(le.x + th.x * p[1] * c * thin, le.y + th.y * p[1] * c * thin, le.z - p[0] * c + th.z * p[1] * c * thin); uv.push(k / NR, f); }
  }
  for (let i = 0; i < NS; i++) for (let k = 0; k < NR; k++) { const a = i * (NR + 1) + k, b = a + NR + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // the tip closed off
  const tip = NS * (NR + 1), tc0 = pos.length / 3; const le = tipLE; pos.push(le.x, le.y, le.z - tcd * 0.45); uv.push(0.5, 1);
  for (let k = 0; k < NR; k++) idx.push(tip + k, tip + k + 1, tc0);
  const m = new Mesh(name, sc), vd = new VertexData(); vd.positions = pos; vd.indices = idx; vd.uvs = uv; const nr: number[] = []; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
  return m;
}
const mirror = (v: Vector3) => new Vector3(-v.x, v.y, v.z);

/** The livery on the fuselage: white, a grey belly, a navy cheatline under the windows, the windows, the flight deck
 *  windows and the doors. The picture runs along the fuselage (across) and round it (down). */
function paintBody(sc: Scene, C1 = '#1C2A4A', C2 = '#3FD3E6'): DynamicTexture {
  const W = 4096, H = 1024, t = new DynamicTexture('livery', { width: W, height: H }, sc, true);
  const x = t.getContext() as CanvasRenderingContext2D, X = (s: number) => s / L * W, Y = (v: number) => (1 - v) * H;
  x.fillStyle = '#F3F5F7'; x.fillRect(0, 0, W, H);
  const band = (v0: number, v1: number, col: string) => { x.fillStyle = col; x.fillRect(0, Y(v1), W, Y(v0) - Y(v1)); };
  band(0.40, 0.60, '#C9CED4');   // the belly
  for (const side of [1, -1]) {
    const v = (a: number) => side > 0 ? a : 1 - a;   // round the right side (0–0.5) or the left (0.5–1)
    const vv = [v(0.288), v(0.31)].sort(); x.fillStyle = C1; x.fillRect(X(4.2), Y(vv[1]), X(L - 9) - X(4.2), Y(vv[0]) - Y(vv[1]));     // the cheatline
    const ww = [v(0.312), v(0.319)].sort(); x.fillStyle = C2; x.fillRect(X(6), Y(ww[1]), X(L - 10) - X(6), Y(ww[0]) - Y(ww[1]));      // its cyan edge
    // the cabin windows
    for (let s = 7.1; s < 30.6; s += 0.53) {
      if (s > 15.0 && s < 16.4) continue;
      const w0 = [v(0.228), v(0.258)].sort(); const px = X(s), w = X(0.26), y0 = Y(w0[1]), h = Y(w0[0]) - Y(w0[1]);
      x.fillStyle = '#1A222C'; roundRect(x, px, y0, w, h, w * 0.45); x.fill();
      x.fillStyle = 'rgba(120,170,210,.35)'; roundRect(x, px + w * 0.15, y0 + h * 0.1, w * 0.4, h * 0.35, w * 0.2); x.fill();
    }
    // the flight deck windows
    x.fillStyle = '#111820';
    const fw = [v(0.135), v(0.205)].sort(); x.beginPath(); x.moveTo(X(2.55), Y(fw[1]) + 4); x.lineTo(X(3.95), Y(fw[1])); x.lineTo(X(4.15), Y(fw[0])); x.lineTo(X(2.35), Y(fw[0]) - 6); x.closePath(); x.fill();
    const fw2 = [v(0.215), v(0.255)].sort(); x.fillRect(X(3.75), Y(fw2[1]), X(0.55), Y(fw2[0]) - Y(fw2[1]));
    // the doors: front and rear, the overwing exits
    x.strokeStyle = 'rgba(70,80,95,.75)'; x.lineWidth = 3;
    for (const [s, w, a, b] of [[5.0, 0.82, 0.2, 0.34], [31.1, 0.82, 0.2, 0.34], [15.15, 0.5, 0.215, 0.3], [16.0, 0.5, 0.215, 0.3]] as number[][]) {
      const d = [v(a), v(b)].sort(); roundRect(x, X(s), Y(d[1]), X(w), Y(d[0]) - Y(d[1]), 14); x.stroke();
    }
  }
  // the tail cone in navy with the cyan swoosh running up into the fin
  const g = x.createLinearGradient(X(L - 9), 0, X(L), 0); g.addColorStop(0, hexA(C1, 0)); g.addColorStop(0.35, C1); g.addColorStop(1, C1);
  x.fillStyle = g; x.fillRect(X(L - 9), Y(0.30), X(9), Y(0.0) - Y(0.30)); x.fillRect(X(L - 9), Y(1.0), X(9), Y(0.70) - Y(1.0));
  t.update(true); t.anisotropicFilteringLevel = 8;
  return t;
}
function roundRect(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, r: number) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
/** The fin's paint: navy with the cyan swoosh and our emblem (a stylised wing). */
function paintFin(sc: Scene, C1 = '#1C2A4A', C2 = '#3FD3E6'): DynamicTexture {
  const t = new DynamicTexture('fin', { width: 1024, height: 1024 }, sc, true), x = t.getContext() as CanvasRenderingContext2D;
  x.fillStyle = C1; x.fillRect(0, 0, 1024, 1024);
  x.strokeStyle = C2; x.lineWidth = 46; x.beginPath(); x.moveTo(-40, 820); x.bezierCurveTo(300, 760, 600, 420, 1060, 300); x.stroke();
  x.strokeStyle = '#FF3FB8'; x.lineWidth = 16; x.beginPath(); x.moveTo(-40, 900); x.bezierCurveTo(320, 840, 640, 520, 1060, 400); x.stroke();
  t.update(true); return t;
}

/** A colour with its transparency, for gradients. */
function hexA(h: string, a: number): string { const c = Color3.FromHexString(h.length === 7 ? h : '#1C2A4A'); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; }
/** The airline's own colours on the aircraft: the cheatline, its edge, the tail cone, the fin and the sharklets. */
export function repaint(ac: Airliner, c1: string, c2: string) {
  const sc = ac.root.getScene(), ok = (h: string) => /^#[0-9a-f]{6}$/i.test(h || '');
  if (!ok(c1)) c1 = '#1C2A4A'; if (!ok(c2)) c2 = '#3FD3E6';
  const [paint, , fin, navy] = ac.paint;
  const ob = paint.albedoTexture, of = fin.albedoTexture; paint.albedoTexture = paintBody(sc, c1, c2); fin.albedoTexture = paintFin(sc, c1, c2); if (ob) ob.dispose(); if (of) of.dispose();
  navy.albedoColor = Color3.FromHexString(c1);
}
/** The gear down (1), up (0) or on its way: the nose leg folds forward, the main legs in towards the middle. */
export function setGear(ac: Airliner, k: number) {
  ac.gearK = k; const up = 1 - k;
  for (const g of ac.gear) { const f = (g as any).metadata.fold; g.setEnabled(k > 0.02); if (f === 0) g.rotation.set(-up * Math.PI / 2, 0, 0); else g.rotation.set(0, 0, f * up * Math.PI / 2); }
}
export function buildAirliner(sc: Scene): Airliner {
  const root = new TransformNode('aircraft', sc);
  const paint = new PBRMaterial('paint', sc); paint.albedoTexture = paintBody(sc); paint.metallic = 0.15; paint.roughness = 0.34;
  paint.clearCoat.isEnabled = true; paint.clearCoat.intensity = 0.7; paint.clearCoat.roughness = 0.08; paint.twoSidedLighting = true; paint.backFaceCulling = false;
  const wingMat = new PBRMaterial('wingPaint', sc); wingMat.albedoColor = Color3.FromHexString('#D9DDE2'); wingMat.metallic = 0.35; wingMat.roughness = 0.38; wingMat.backFaceCulling = false; wingMat.twoSidedLighting = true;
  wingMat.clearCoat.isEnabled = true; wingMat.clearCoat.intensity = 0.4;
  const finMat = new PBRMaterial('finPaint', sc); finMat.albedoTexture = paintFin(sc); finMat.metallic = 0.15; finMat.roughness = 0.3; finMat.clearCoat.isEnabled = true; finMat.clearCoat.intensity = 0.7; finMat.backFaceCulling = false; finMat.twoSidedLighting = true;
  const navy = new PBRMaterial('navy', sc); navy.albedoColor = Color3.FromHexString('#1C2A4A'); navy.metallic = 0.2; navy.roughness = 0.3; navy.clearCoat.isEnabled = true; navy.backFaceCulling = false; navy.twoSidedLighting = true;
  const white = new PBRMaterial('white', sc); white.albedoColor = Color3.FromHexString('#EEF1F4'); white.metallic = 0.15; white.roughness = 0.32; white.clearCoat.isEnabled = true; white.clearCoat.intensity = 0.7; white.backFaceCulling = false; white.twoSidedLighting = true;
  const metal = new PBRMaterial('metal', sc); metal.albedoColor = Color3.FromHexString('#B8BEC6'); metal.metallic = 1; metal.roughness = 0.28;
  const dark = new PBRMaterial('dark', sc); dark.albedoColor = Color3.FromHexString('#15181C'); dark.metallic = 0.6; dark.roughness = 0.45;
  const hot = new PBRMaterial('hot', sc); hot.albedoColor = Color3.FromHexString('#4A4038'); hot.metallic = 0.9; hot.roughness = 0.55;
  const casters: Mesh[] = [];
  const add = (m: Mesh, mat: any) => { m.material = mat; m.parent = root; casters.push(m); m.receiveShadows = true; return m; };

  add(fuselage(sc), paint);
  // the wings: low, swept 27° at the leading edge, 5° of dihedral, root chord 6.1 m, tip 1.6 m
  const wr = new Vector3(1.75, -1.25, 6.2), wt = new Vector3(17.2, -1.25 + 15.45 * Math.tan(5 * Math.PI / 180), 6.2 - 15.45 * Math.tan(27 * Math.PI / 180));
  for (const side of [1, -1]) {
    const r = side > 0 ? wr : mirror(wr), t = side > 0 ? wt : mirror(wt);
    add(surface(sc, 'wing', r, t, 6.1, 1.6, 0.13, new Vector3(0, 1, 0)), wingMat);
    // the root fairing (belly) and the sharklet at the tip
    const sk0 = t.add(new Vector3(0, 0.05, -0.35)), sk1 = sk0.add(new Vector3(side * 0.55, 2.35, -1.25));
    add(surface(sc, 'sharklet', sk0, sk1, 1.25, 0.42, 0.10, new Vector3(1, 0, 0), 0), navy);
  }
  const belly = MeshBuilder.CreateSphere('fairing', { diameterX: 3.8, diameterY: 1.4, diameterZ: 10.5, segments: 20 }, sc); belly.position.set(0, -1.75, 2.6); add(belly, white);
  // the tailplane and the fin
  const sr = new Vector3(0.6, 0.55, -13.65), st = new Vector3(6.25, 0.55 + 5.65 * Math.tan(6 * Math.PI / 180), -13.65 - 5.65 * Math.tan(32 * Math.PI / 180));
  for (const side of [1, -1]) add(surface(sc, 'stab', side > 0 ? sr : mirror(sr), side > 0 ? st : mirror(st), 3.6, 1.35, 0.11, new Vector3(0, 1, 0), 0), wingMat);
  const fr = new Vector3(0, 1.75, -10.2), ft = new Vector3(0, 7.7, -10.2 - 5.95 * Math.tan(34 * Math.PI / 180));
  add(surface(sc, 'fin', fr, ft, 5.9, 1.9, 0.11, new Vector3(1, 0, 0), 0), finMat);
  // the engines: nacelles on pylons under the wings, a fan behind the intake, the exhaust and its cone
  const fans: Mesh[] = [], exhausts: Vector3[] = [];
  for (const side of [1, -1]) {
    const cx = side * 5.75, cy = -2.42, front = 8.75, len = 4.45;
    const prof = [new Vector3(0.80, 0, 0), new Vector3(0.95, 0.06, 0), new Vector3(1.02, 0.35, 0), new Vector3(1.05, 1.2, 0), new Vector3(1.0, 2.4, 0), new Vector3(0.86, 3.4, 0), new Vector3(0.66, len, 0)];
    const nac = MeshBuilder.CreateLathe('nacelle', { shape: prof, tessellation: 40, sideOrientation: Mesh.DOUBLESIDE }, sc);
    nac.rotation.x = -Math.PI / 2; nac.position.set(cx, cy, front); add(nac, white);
    const lip = MeshBuilder.CreateTorus('lip', { diameter: 1.74, thickness: 0.16, tessellation: 40 }, sc); lip.rotation.x = Math.PI / 2; lip.position.set(cx, cy, front + 0.02); add(lip, metal);
    const fan = MeshBuilder.CreateCylinder('fan', { diameter: 1.6, height: 0.05, tessellation: 36 }, sc); fan.rotation.x = Math.PI / 2; fan.position.set(cx, cy, front - 0.55); add(fan, dark);
    const blades = new StandardMaterial('blades', sc); blades.diffuseTexture = bladeTexture(sc); blades.diffuseTexture.hasAlpha = true; blades.useAlphaFromDiffuseTexture = true; blades.specularColor = new Color3(0.6, 0.6, 0.65); blades.backFaceCulling = false;
    const bd = MeshBuilder.CreateDisc('blades', { radius: 0.8, tessellation: 36 }, sc); bd.position.set(cx, cy, front - 0.5); bd.rotation.y = Math.PI; bd.material = blades; bd.parent = root; fans.push(bd);
    const sp = MeshBuilder.CreateCylinder('spinner', { diameterTop: 0, diameterBottom: 0.5, height: 0.55, tessellation: 24 }, sc); sp.rotation.x = Math.PI / 2; sp.position.set(cx, cy, front - 0.3); add(sp, metal);
    const core = MeshBuilder.CreateCylinder('core', { diameterTop: 0.55, diameterBottom: 0.9, height: 1.2, tessellation: 28 }, sc); core.rotation.x = -Math.PI / 2; core.position.set(cx, cy, front - len - 0.45); add(core, hot);
    const plug = MeshBuilder.CreateCylinder('plug', { diameterTop: 0.02, diameterBottom: 0.42, height: 0.9, tessellation: 20 }, sc); plug.rotation.x = -Math.PI / 2; plug.position.set(cx, cy, front - len - 1.35); add(plug, hot);
    exhausts.push(new Vector3(cx, cy, front - len - 1.6));
    const py = MeshBuilder.CreateBox('pylon', { width: 0.38, height: 1.25, depth: 4.6 }, sc); py.position.set(cx, cy + 1.1, front - 2.4); add(py, white);
  }
  // the lights: red on the left wing tip, green on the right, white strobes on both tips and the tail, red beacons
  // on top and underneath, and the logo lights shining on the fin
  const emis = (c: string) => { const m = new StandardMaterial('l' + c, sc); m.emissiveColor = Color3.FromHexString(c); m.disableLighting = true; return m; };
  const bulb = (p: Vector3, c: string, r = 0.11) => { const b = MeshBuilder.CreateSphere('light', { diameter: r * 2, segments: 8 }, sc); b.position.copyFrom(p); b.material = emis(c); b.parent = root; return b; };
  const navs = [bulb(mirror(wt).add(new Vector3(-0.05, 0, -0.5)), '#FF2020'), bulb(wt.add(new Vector3(0.05, 0, -0.5)), '#20FF40'), bulb(new Vector3(0, 0.95, -L / 2 + 0.05), '#FFFFFF')];
  const strobes = [bulb(mirror(wt).add(new Vector3(-0.08, 0, -0.9)), '#FFFFFF', 0.13), bulb(wt.add(new Vector3(0.08, 0, -0.9)), '#FFFFFF', 0.13), bulb(new Vector3(0, 1.0, -L / 2 + 0.02), '#FFFFFF', 0.12)];
  const beacons = [bulb(new Vector3(0, RY + 0.05, 1.2), '#FF2A10', 0.13), bulb(new Vector3(0, -RY - 0.25, 3.0), '#FF2A10', 0.13)];
  const logo = [bulb(st.add(new Vector3(0, 0.14, -0.2)), '#FFF4D8', 0.08), bulb(mirror(st).add(new Vector3(0, 0.14, -0.2)), '#FFF4D8', 0.08)];
  // the landing gear: the nose leg (two wheels) and the two main legs (two wheels each), folding into their wells
  const gear: TransformNode[] = [], tyre = new PBRMaterial('tyre', sc); tyre.albedoColor = Color3.FromHexString('#1A1B1D'); tyre.metallic = 0; tyre.roughness = 0.85;
  const hub = new PBRMaterial('hub', sc); hub.albedoColor = Color3.FromHexString('#C8CCD2'); hub.metallic = 0.9; hub.roughness = 0.35;
  const leg = (name: string, at: Vector3, len: number, wheelD: number, gapX: number, foldSide: number) => {
    const pivot = new TransformNode(name, sc); pivot.parent = root; pivot.position.copyFrom(at); (pivot as any).metadata = { fold: foldSide };
    const strut = MeshBuilder.CreateCylinder('strut', { diameter: 0.24, height: len, tessellation: 12 }, sc); strut.position.y = -len / 2; strut.parent = pivot; strut.material = metal; casters.push(strut as Mesh);
    for (const sx of [-gapX, gapX]) {
      const w = MeshBuilder.CreateCylinder('wheel', { diameter: wheelD, height: wheelD * 0.36, tessellation: 22 }, sc); w.rotation.z = Math.PI / 2; w.position.set(sx, -len, 0); w.parent = pivot; w.material = tyre; casters.push(w as Mesh);
      const hb = MeshBuilder.CreateCylinder('hub', { diameter: wheelD * 0.55, height: wheelD * 0.38, tessellation: 16 }, sc); hb.rotation.z = Math.PI / 2; hb.position.set(sx, -len, 0); hb.parent = pivot; hb.material = hub;
    }
    gear.push(pivot);
  };
  // the fuselage's middle stands 3.9 m above the ground on its wheels
  leg('noseGear', new Vector3(0, -RY + 0.1, L / 2 - 5.1), 3.9 - RY - 0.1 - 0.38, 0.76, 0.24, 0);
  for (const side of [1, -1]) leg('mainGear', new Vector3(side * 3.8, -1.55, -1.6), 3.9 - 1.55 - 0.57, 1.14, 0.42, side);
  return { root, fans, strobes, beacons, navs, logo, casters, exhausts, paint: [paint, wingMat, finMat, navy, white], gear, gearK: 0 };
}
/** The fan's blades seen from the front: 24 wide-chord blades, painted once and turned. */
function bladeTexture(sc: Scene): DynamicTexture {
  const t = new DynamicTexture('fanBlades', { width: 512, height: 512 }, sc, true), x = t.getContext() as CanvasRenderingContext2D;
  x.clearRect(0, 0, 512, 512); x.translate(256, 256);
  for (let i = 0; i < 24; i++) {
    x.save(); x.rotate(i / 24 * Math.PI * 2);
    const g = x.createLinearGradient(0, 0, 250, 0); g.addColorStop(0, '#9AA2AC'); g.addColorStop(1, '#C8CED6');
    x.fillStyle = g; x.beginPath(); x.moveTo(40, -6); x.quadraticCurveTo(150, -34, 252, -22); x.lineTo(252, 4); x.quadraticCurveTo(150, 0, 40, 8); x.closePath(); x.fill();
    x.restore();
  }
  x.fillStyle = '#D6DAE0'; x.beginPath(); x.arc(0, 0, 44, 0, Math.PI * 2); x.fill();
  t.hasAlpha = true; t.update(true); t.wrapU = Texture.CLAMP_ADDRESSMODE; t.wrapV = Texture.CLAMP_ADDRESSMODE; return t;
}
