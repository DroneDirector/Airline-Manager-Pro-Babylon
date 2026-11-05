// The courtroom, on Babylon.js (from the main game's courtroom): a panelled hall 16 m wide and 7.4 m high, with tall
// windows on the left (deep reveals, red velvet curtains, the light falling through them), a coffered ceiling with
// rosettes and four brass chandeliers; the judges' bench on its dais under the emblem of justice, the clerk's desk,
// the witness box, the tables of the prosecution and the defence, the families' counsel, the bar with its gate, the
// public benches, the doors with the exit sign and the clock, paintings and the court's two screens.
// The scene runs right-handed, so every measure is the main game's own: x across, z from the bench (−9) to the
// doors (10.5).
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, PointLight, VertexData, Quaternion, Matrix } from '@babylonjs/core';
import * as T from './textures';
import { courtSeats, Seat, X0, X1, Z0, Z1, HH, BAR, DAIS, benchW } from './seats';
import { IS_PC } from '../../core/app';

export interface Court { root: TransformNode; seats: { [id: string]: Seat }; casters: AbstractMesh[]; metals: PBRMaterial[]; gate: TransformNode[]; hands: TransformNode[]; screens: DynamicTexture[]; lights: PointLight[] }

export function buildCourt(sc: Scene, judges: number, progress: (p: number, s: string) => void): Court {
  const root = new TransformNode('court', sc), casters: AbstractMesh[] = [], metals: PBRMaterial[] = [], groups = new Map<any, Mesh[]>();
  let n = 0; const nm = (k: string) => k + '-' + (n++);
  const tex = (c: HTMLCanvasElement, u = 1, v = 1): DynamicTexture => { const t = new DynamicTexture(nm('t'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: string; tex?: Texture; metal?: number; rough?: number; coat?: number; emis?: string; alpha?: number }): PBRMaterial => {
    const m = new PBRMaterial(nm('m'), sc); m.maxSimultaneousLights = 8; m.albedoColor = o.col ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex;
    m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6; if (o.coat) { m.clearCoat.isEnabled = true; m.clearCoat.intensity = o.coat; m.clearCoat.roughness = 0.2; }
    if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis); if (o.alpha != null) { m.alpha = o.alpha; m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; }
    if ((o.metal || 0) >= 0.6 || (o.coat || 0) >= 0.5) metals.push(m); m.backFaceCulling = false; m.twoSidedLighting = true; return m; };
  const flat = (cv: HTMLCanvasElement, k = 1) => { const m = new StandardMaterial(nm('f'), sc); m.emissiveTexture = tex(cv); m.diffuseColor = Color3.Black(); m.specularColor = Color3.Black(); m.emissiveColor = new Color3(k, k, k); m.disableLighting = true; m.backFaceCulling = false; return m; };
  progress(14, 'Polishing the walnut…');
  const tx = {
    walnut: tex(T.ctWood('#5A3519', '#2A160A', 3)), oak: tex(T.ctWood('#8E6238', '#4A2E16', 5)), parquet: tex(T.ctParquet(), 5, 4), marbleDark: tex(T.ctMarble([46, 44, 42], [150, 140, 128], 4), 2, 2),
    plaster: tex(T.ctNoise('#E7DCC6', 0.08, 5), 6, 4), carpet: tex(T.ctCarpet(), 8, 8), leatherG: tex(T.ctLeather('#23402F')), leatherR: tex(T.ctLeather('#5A1F22')), runner: tex(T.ctNoise('#3E1016', 0.25, 13), 1, 8),
  };
  const mat = {
    walnut: pbr({ tex: tx.walnut, rough: 0.32, coat: 0.55 }), walnutM: pbr({ tex: tx.walnut, rough: 0.5 }), oak: pbr({ tex: tx.oak, rough: 0.4, coat: 0.35 }),
    parquet: pbr({ tex: tx.parquet, rough: 0.28, coat: 0.7 }), marbleDark: pbr({ tex: tx.marbleDark, rough: 0.2, coat: 0.6 }), plaster: pbr({ tex: tx.plaster, rough: 0.92 }), ceiling: pbr({ col: '#EFE6D2', rough: 0.9 }),
    carpet: pbr({ tex: tx.carpet, rough: 1 }), runner: pbr({ tex: tx.runner, rough: 1 }), leatherG: pbr({ tex: tx.leatherG, rough: 0.45 }), leatherR: pbr({ tex: tx.leatherR, rough: 0.45 }),
    brass: pbr({ col: '#C9A04E', metal: 1, rough: 0.28 }), gilt: pbr({ col: '#D7AE5C', metal: 1, rough: 0.35 }), black: pbr({ col: '#15171B', rough: 0.5 }), paper: pbr({ col: '#F4F1E8', rough: 0.9 }),
    glass: pbr({ col: '#DDEEFF', rough: 0.05, alpha: 0.22 }), velvet: pbr({ col: '#5E1621', rough: 0.85 }), emblem: pbr({ tex: tex(T.ctEmblem()), rough: 0.35, metal: 0.4 }),
  };
  /** A mesh into the room: merged with the others of its material at the end (one draw for each). */
  const put = (m: Mesh, mt: any, x: number, y: number, z: number, ry = 0, par?: TransformNode, keep = false) => { m.position.set(x, y, z); m.rotation.y = ry; m.material = mt; m.receiveShadows = true; m.parent = par || root;
    if (keep) { casters.push(m); return m; } let g = groups.get(mt); if (!g) groups.set(mt, g = []); g.push(m); return m; };
  const bx = (w: number, h: number, d: number, mt: any, x: number, y: number, z: number, ry = 0, par?: TransformNode, keep = false) => put(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, sc), mt, x, y, z, ry, par, keep);
  const slab = (w: number, d: number, h: number, mt: any, x: number, yTop: number, z: number, ry = 0, par?: TransformNode) => bx(w, h, d, mt, x, yTop - h / 2, z, ry, par);
  const cyl = (rt: number, rb: number, h: number, mt: any, x: number, y: number, z: number, par?: TransformNode, seg = 12, keep = false) => put(MeshBuilder.CreateCylinder(nm('c'), { diameterTop: rt * 2, diameterBottom: rb * 2, height: h, tessellation: seg }, sc), mt, x, y, z, 0, par, keep);
  /** A plane facing +z (as the main game's), turned ry (and tipped rx). */
  const plane = (w: number, h: number, mt: any, x: number, y: number, z: number, ry = 0, rx = 0, keep = true) => { const p = MeshBuilder.CreatePlane(nm('p'), { width: w, height: h, sideOrientation: Mesh.BACKSIDE }, sc); p.rotation.x = rx; return put(p, mt, x, y, z, ry, undefined, keep); };
  /** A moulding: a profile (out from the wall, up) run along a length. */
  const mould = (prof: number[][], len: number, mt: any, x: number, y: number, z: number, ry: number) => {
    const a = prof.map(p => new Vector3(p[0], p[1], -len / 2)), b = prof.map(p => new Vector3(p[0], p[1], len / 2));
    const m = MeshBuilder.CreateRibbon(nm('mould'), { pathArray: [a, b], sideOrientation: Mesh.DOUBLESIDE }, sc); return put(m, mt, x, y, z, ry);
  };
  const ogee: number[][] = []; for (let i = 0; i <= 10; i++) { const t = i / 10; ogee.push([0.02 + 0.16 * t + Math.sin(t * Math.PI * 2) * 0.02, t * 0.32]); }
  const rail: number[][] = [[0, 0], [0.035, 0], [0.05, 0.02], [0.05, 0.05], [0.03, 0.07], [0, 0.07]];
  const base: number[][] = [[0, 0], [0.04, 0], [0.04, 0.18], [0.025, 0.2], [0.02, 0.24], [0, 0.24]];

  // ---- the floor: parquet in the well with a dark marble border, carpet behind the bar with a runner up the aisle ----
  const ground = (w: number, d: number, mt: any, z: number, y: number) => { const g = MeshBuilder.CreateGround(nm('g'), { width: w, height: d }, sc); g.position.set(0, y, z); g.material = mt; g.receiveShadows = true; g.parent = root; return g; };
  ground(X1 - X0 - 1.2, BAR - Z0 - 0.6, mat.parquet, (Z0 + 0.6 + BAR) / 2, 0.002); ground(X1 - X0, BAR - Z0, mat.marbleDark, (Z0 + BAR) / 2, 0.0005);
  ground(X1 - X0, Z1 - BAR, mat.carpet, (BAR + Z1) / 2, 0.002); ground(1.6, Z1 - BAR, mat.runner, (BAR + Z1) / 2, 0.004);
  // ---- the walls: plaster above, walnut panelling below (raised panels, chair rail, skirting), the ceiling ----
  for (const w of [[0, HH / 2, Z0, X1 - X0, 0], [0, HH / 2, Z1, X1 - X0, Math.PI], [X0, HH / 2, (Z0 + Z1) / 2, Z1 - Z0, Math.PI / 2], [X1, HH / 2, (Z0 + Z1) / 2, Z1 - Z0, -Math.PI / 2]]) plane(w[3], HH, mat.plaster, w[0], w[1], w[2], w[4]);
  plane(X1 - X0, Z1 - Z0, mat.ceiling, 0, HH, (Z0 + Z1) / 2, 0, Math.PI / 2);
  const WAIN = 2.4;
  const along = (ax: number, az: number, bx2: number, bz: number, inward: number[], skip?: (t: number) => boolean) => {
    const len = Math.hypot(bx2 - ax, bz - az), k = Math.max(1, Math.round(len / 1.25)), ry = Math.atan2(bx2 - ax, bz - az) - Math.PI / 2;
    for (let i = 0; i < k; i++) { const t = (i + 0.5) / k, x = ax + (bx2 - ax) * t, z = az + (bz - az) * t; if (skip && skip(t * len)) continue;
      bx(len / k - 0.24, 1.55, 0.03, mat.walnut, x + inward[0] * 0.05, 1.25, z + inward[1] * 0.05, ry); bx(len / k - 0.24, 0.32, 0.03, mat.walnut, x + inward[0] * 0.05, 0.36, z + inward[1] * 0.05, ry); }
    bx(len, WAIN, 0.04, mat.walnutM, (ax + bx2) / 2 + inward[0] * 0.02, WAIN / 2, (az + bz) / 2 + inward[1] * 0.02, ry);
    mould(rail, len, mat.walnut, (ax + bx2) / 2 + inward[0] * 0.04, WAIN - 0.03, (az + bz) / 2 + inward[1] * 0.04, ry + Math.PI / 2);
    mould(base, len, mat.walnut, (ax + bx2) / 2 + inward[0] * 0.04, 0, (az + bz) / 2 + inward[1] * 0.04, ry + Math.PI / 2);
    mould(ogee, len, mat.ceiling, (ax + bx2) / 2, HH - 0.32, (az + bz) / 2, ry + Math.PI / 2);
  };
  along(X0, Z0, X0, Z1, [1, 0]); along(X1, Z1, X1, Z0, [-1, 0]); along(X0, Z0, X1, Z0, [0, 1]); along(X1, Z1, X0, Z1, [0, -1], d => Math.abs(d - 8) < 1.6);
  progress(24, 'Hanging the curtains…');
  // ---- the tall windows on the left: deep reveals, velvet curtains, the light falling through ----
  const winM = flat(T.ctWindow(), 1.1), shaftM = new StandardMaterial(nm('shaft'), sc); shaftM.emissiveTexture = tex(T.ctShaft()); shaftM.opacityTexture = shaftM.emissiveTexture; shaftM.disableLighting = true; shaftM.alpha = IS_PC ? 0.1 : 0.07; shaftM.backFaceCulling = false; shaftM.alphaMode = 1;
  for (const z of [-6.4, -2.6, 1.2, 5.0, 8.6]) {
    plane(1.6, 3.7, winM, X0 + 0.01, 4.35, z, Math.PI / 2);
    const arch = MeshBuilder.CreateDisc(nm('arch'), { radius: 0.8, tessellation: 24, arc: 0.5, sideOrientation: Mesh.BACKSIDE }, sc); put(arch, winM, X0 + 0.01, 6.2, z, Math.PI / 2, undefined, true);
    bx(0.16, 0.1, 1.9, mat.walnut, X0 + 0.08, 2.48, z);
    for (const s of [-1, 1]) {
      bx(0.12, 4.6, 0.14, mat.oak, X0 + 0.06, 4.3, z + s * 0.87);
      const paths: Vector3[][] = []; for (let i = 0; i <= 24; i++) { const x = -0.31 + 0.62 * i / 24, zz = Math.sin(x * 31) * 0.045 + Math.sin(x * 13) * 0.02; paths.push([new Vector3(x, -2.5, zz), new Vector3(x, 2.5, zz)]); }
      const cu = MeshBuilder.CreateRibbon(nm('curtain'), { pathArray: paths, sideOrientation: Mesh.DOUBLESIDE }, sc); put(cu, mat.velvet, X0 + 0.22, 4.4, z + s * 1.18, Math.PI / 2);
      bx(0.06, 0.3, 0.08, mat.gilt, X0 + 0.25, 3.0, z + s * 1.15);
    }
    bx(0.08, 0.08, 3.2, mat.brass, X0 + 0.28, 6.95, z);
    const sa = new Vector3(X0 + 0.1, 4.4, z), sb = new Vector3(X0 + 5.6, 0.02, z + 0.9), sd = sa.subtract(sb), sl = sd.length(); sd.normalize();
    const sh = new TransformNode(nm('shaft'), sc); sh.parent = root; sh.position = sa.add(sb).scale(0.5); const q = new Quaternion(); Quaternion.FromUnitVectorsToRef(new Vector3(0, 1, 0), sd, q); sh.rotationQuaternion = q;
    for (const ry of [0, Math.PI / 2]) { const pl = MeshBuilder.CreatePlane(nm('sp'), { width: 1.5, height: sl, sideOrientation: Mesh.DOUBLESIDE }, sc); pl.rotation.y = ry; pl.material = shaftM; pl.parent = sh; pl.isPickable = false; }
  }
  { const wz = [-6.4, -2.6, 1.2, 5.0, 8.6]; for (let i = 0; i <= wz.length; i++) { const z = i === 0 ? Z0 + 0.6 : i === wz.length ? Z1 - 0.6 : (wz[i - 1] + wz[i]) / 2; bx(0.14, HH - WAIN - 0.45, 0.42, mat.plaster, X0 + 0.07, (HH - 0.33 + WAIN) / 2, z); bx(0.22, 0.2, 0.52, mat.gilt, X0 + 0.11, HH - 0.48, z); } }
  // ---- paintings and the court's two screens ----
  [-5.4, 3.0, 7.2].forEach((z, i) => {
    plane(1.8, 1.2, pbr({ tex: tex(T.ctPainting(i + 2)), rough: 0.6 }), X1 - 0.05, 4.2, z, -Math.PI / 2);
    for (const [w, h, x, y] of [[2.0, 0.1, 0, 0.65], [2.0, 0.1, 0, -0.65], [0.1, 1.4, 0.95, 0], [0.1, 1.4, -0.95, 0]]) bx(0.07, h, w, mat.gilt, X1 - 0.06, 4.2 + y, z + x);
    bx(0.03, 0.04, 0.4, mat.brass, X1 - 0.09, 5.0, z);
  });
  const screens: DynamicTexture[] = [];
  for (const [x, z, ry] of [[X1 - 0.12, -1.2, -Math.PI / 2], [X0 + 0.12, -4.4, Math.PI / 2]]) {
    const dt = new DynamicTexture(nm('scr'), { width: 1024, height: 576 }, sc, true); T.ctExhibitDraw((dt.getContext() as any).canvas, null); dt.update(true); screens.push(dt);
    const m = new StandardMaterial(nm('scrM'), sc); m.emissiveTexture = dt; m.disableLighting = true; m.backFaceCulling = false;
    plane(2.1, 1.18, m, x + (ry < 0 ? -0.04 : 0.04), 3.3, z, ry); bx(0.06, 1.28, 2.2, mat.black, x, 3.3, z);
  }
  // ---- the coffered ceiling, its rosettes, the brass chandeliers ----
  for (let x = X0 + 2; x < X1; x += 2) bx(0.22, 0.24, Z1 - Z0, mat.ceiling, x, HH - 0.12, (Z0 + Z1) / 2);
  for (let z = Z0 + 2.2; z < Z1; z += 2.2) bx(X1 - X0, 0.24, 0.22, mat.ceiling, 0, HH - 0.12, z);
  for (let x = X0 + 2; x < X1; x += 2) for (let z = Z0 + 2.2; z < Z1; z += 2.2) cyl(0.16, 0.2, 0.06, mat.gilt, x, HH - 0.25, z, undefined, 16);
  const bulb = new StandardMaterial(nm('bulb'), sc); bulb.emissiveColor = Color3.FromHexString('#FFC77A').scale(1.6); bulb.disableLighting = true;
  const lights: PointLight[] = [];
  for (const [x, z] of [[-3, -4.5], [3, -4.5], [-3, 4.2], [3, 4.2]]) {
    cyl(0.015, 0.015, 1.9, mat.brass, x, HH - 0.95, z, undefined, 6);
    put(MeshBuilder.CreateTorus(nm('tor'), { diameter: 1.24, thickness: 0.056, tessellation: 48 }, sc), mat.brass, x, 5.35, z);
    put(MeshBuilder.CreateTorus(nm('tor'), { diameter: 0.68, thickness: 0.04, tessellation: 32 }, sc), mat.brass, x, 5.75, z);
    put(MeshBuilder.CreateSphere(nm('s'), { diameter: 0.22, segments: 12 }, sc), mat.brass, x, 5.4, z);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, cx = x + Math.cos(a) * 0.62, cz = z + Math.sin(a) * 0.62;
      cyl(0.035, 0.03, 0.04, mat.brass, cx, 5.39, cz, undefined, 10); cyl(0.018, 0.018, 0.14, mat.paper, cx, 5.48, cz, undefined, 8);
      const b = MeshBuilder.CreateSphere(nm('bulb'), { diameter: 0.06, segments: 8 }, sc); b.scaling.y = 1.6; put(b, bulb, cx, 5.58, cz); }
    const L = new PointLight(nm('chand'), new Vector3(x, 5.2, z), sc); L.diffuse = Color3.FromHexString('#FFCF96'); L.intensity = IS_PC ? 24 : 20; L.range = 16; L.parent = root; lights.push(L);
  }
  progress(36, 'Raising the bench…');
  // ---- the bench: the dais, the panelled back wall with the emblem, the judges' high-backed chairs ----
  const bw = benchW(judges), bz = -6.6, fz = bz + 0.85;
  slab(bw + 1.2, 2.9, DAIS, mat.walnutM, 0, DAIS, bz - 0.35);
  for (let i = 1; i <= 2; i++) slab(1.4, 0.32, DAIS * i / 3, mat.walnutM, bw / 2 + 0.25, DAIS * i / 3, bz + 1.1 + (3 - i) * 0.3 - 0.15);
  mould(base, bw + 1.2, mat.walnut, 0, 0, bz + 1.1, Math.PI / 2 + Math.PI);
  bx(bw + 1.0, 4.6, 0.12, mat.walnutM, 0, 2.3 + DAIS, Z0 + 0.08);
  for (let i = 0; i < 7; i++) bx(0.16, 4.2, 0.05, mat.walnut, (i - 3) * (bw + 0.6) / 6, 2.4 + DAIS, Z0 + 0.16);
  { const w2 = bw / 2 + 0.6, y0 = 4.62 + DAIS, zA = Z0 + 0.05, zB = Z0 + 0.35, pos = [-w2, y0, zA, w2, y0, zA, 0, y0 + 0.9, zA, -w2, y0, zB, w2, y0, zB, 0, y0 + 0.9, zB], idx = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
    const m = new Mesh(nm('pediment'), sc), vd = new VertexData(), nr: number[] = []; vd.positions = pos; vd.indices = idx; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m); put(m, mat.walnut, 0, 0, 0); }
  { const em = MeshBuilder.CreateDisc(nm('emblem'), { radius: 0.85, tessellation: 48, sideOrientation: Mesh.BACKSIDE }, sc); put(em, mat.emblem, 0, 3.55 + DAIS, Z0 + 0.2, 0, undefined, true);
    const t = MeshBuilder.CreateTorus(nm('emR'), { diameter: 1.74, thickness: 0.1, tessellation: 64 }, sc); t.rotation.x = Math.PI / 2; t.position.set(0, 3.55 + DAIS, Z0 + 0.2); t.material = mat.gilt; t.parent = root; }
  bx(bw, 0.92, 0.1, mat.walnutM, 0, DAIS + 0.46, fz);
  { const k = Math.round(bw / 1.1), w = bw / k; for (let i = 0; i < k; i++) bx(w - 0.2, 0.6, 0.03, mat.walnut, -bw / 2 + w * (i + 0.5), DAIS + 0.45, fz + 0.06); }
  slab(bw + 0.2, 0.42, 0.06, mat.walnut, 0, DAIS + 0.98, fz - 0.05); slab(bw, 0.75, 0.05, mat.walnut, 0, DAIS + 0.76, fz - 0.45);
  for (const s of [-1, 1]) bx(0.1, 0.98, 1.1, mat.walnutM, s * (bw / 2 + 0.05), DAIS + 0.49, fz - 0.4);
  const seats = courtSeats(judges);
  for (let i = 0; i < judges; i++) { const s = seats['judge' + i]; chair(s.x, DAIS, s.z, 0, true); bx(0.3, 0.012, 0.22, mat.paper, s.x - 0.15, DAIS + 0.79, fz - 0.4, 0.15); bx(0.33, 0.02, 0.25, mat.leatherR, s.x + 0.25, DAIS + 0.79, fz - 0.42, -0.1); }
  cyl(0.06, 0.07, 0.02, mat.walnut, 0.45, DAIS + 0.795, fz - 0.25, undefined, 20);
  { const g = cyl(0.03, 0.03, 0.13, mat.walnut, 0.43, DAIS + 0.83, fz - 0.27); g.rotation.z = Math.PI / 2; const h = cyl(0.009, 0.009, 0.2, mat.walnut, 0.48, DAIS + 0.83, fz - 0.17); h.rotation.x = Math.PI / 2; }
  // ---- the clerk's desk ----
  const cz = fz + 1.25;
  slab(2.2, 0.8, 0.05, mat.walnut, 0, 0.76, cz + 0.2); bx(2.2, 0.72, 0.06, mat.walnutM, 0, 0.36, cz + 0.6);
  for (const s of [-1, 1]) bx(0.06, 0.72, 0.8, mat.walnutM, s * 1.07, 0.36, cz + 0.2);
  chair(0, 0, cz - 0.55, 0, false); mic(0.3, 0.78, cz + 0.05, 0); bx(0.34, 0.24, 0.02, mat.black, -0.45, 0.88, cz + 0.05, 0.25);
  // ---- the witness box: raised, panelled on three sides, a seat and a microphone ----
  { const wb = new TransformNode(nm('wbox'), sc); wb.parent = root; wb.position.set(5.0, 0, -4.8); wb.rotation.y = -0.55;
    slab(1.5, 1.5, 0.3, mat.walnutM, 0, 0.3, 0, 0, wb);
    bx(1.5, 1.05, 0.06, mat.walnutM, 0, 0.825, 0.72, 0, wb); bx(0.06, 1.05, 1.5, mat.walnutM, -0.72, 0.825, 0, 0, wb); bx(0.06, 1.05, 1.5, mat.walnutM, 0.72, 0.825, 0, 0, wb);
    slab(1.62, 0.16, 0.05, mat.walnut, 0, 1.4, 0.72, 0, wb); slab(0.16, 1.62, 0.05, mat.walnut, -0.72, 1.4, 0, 0, wb); slab(0.16, 1.62, 0.05, mat.walnut, 0.72, 1.4, 0, 0, wb);
    for (let i = 0; i < 3; i++) bx(0.38, 0.7, 0.02, mat.walnut, (i - 1) * 0.46, 0.8, 0.76, 0, wb);
    chair(0, 0.3, -0.22, 0, false, wb); mic(0.25, 1.43, 0.66, 0, wb); }
  progress(46, 'Setting the tables…');
  // ---- the counsel tables: prosecution (left), defence (right); the families' counsel at the side ----
  const tz = -1.15;
  for (const [x, k] of [[-3.5, 'pros'], [3.5, 'def']] as [number, string][]) {
    const w = 3.2; slab(w, 0.95, 0.05, mat.walnut, x, 0.76, tz); bx(w - 0.1, 0.1, 0.85, mat.walnutM, x, 0.68, tz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.035, 0.028, 0.63, mat.walnutM, x + sx * (w / 2 - 0.12), 0.315, tz + sz * 0.38, undefined, 10);
    bx(w - 0.3, 0.42, 0.03, mat.walnutM, x, 0.42, tz - 0.4);
    for (const sx of [x - 0.7, x + 0.7]) { chair(sx, 0, tz + 0.98, Math.PI, false); mic(sx, 0.78, tz - 0.15, Math.PI); }
    bx(0.3, 0.03, 0.22, mat.paper, x - 0.75, 0.795, tz + 0.05, 0.1); bx(0.32, 0.07, 0.25, pbr({ col: k === 'pros' ? '#24406A' : '#6A2430', rough: 0.6 }), x + 1.2, 0.815, tz - 0.1, -0.2);
    const lt = new TransformNode(nm('laptop'), sc); lt.parent = root; lt.position.set(x + 0.55, 0.785, tz); lt.rotation.y = Math.PI + 0.2;
    bx(0.34, 0.015, 0.24, mat.black, 0, 0.008, 0, 0, lt); const scr = bx(0.34, 0.22, 0.01, mat.black, 0, 0.12, -0.12, 0, lt); scr.rotation.x = -0.25;
    const sm = new StandardMaterial(nm('lap'), sc); sm.emissiveColor = Color3.FromHexString('#9EC3E8'); sm.disableLighting = true; sm.backFaceCulling = false;
    const sp = MeshBuilder.CreatePlane(nm('lapS'), { width: 0.31, height: 0.19, sideOrientation: Mesh.BACKSIDE }, sc); sp.parent = lt; sp.position.set(0, 0.12, -0.113); sp.rotation.x = -0.25; sp.material = sm;
    cyl(0.05, 0.06, 0.24, mat.glass, x - 0.1, 0.9, tz - 0.25, undefined, 20, true);
    for (const gx of [-0.25, 0.05]) cyl(0.035, 0.03, 0.1, mat.glass, x + gx, 0.83, tz - 0.05, undefined, 16, true);
  }
  slab(1.6, 0.8, 0.05, mat.walnut, -6.3, 0.76, 0.0); bx(1.5, 0.1, 0.7, mat.walnutM, -6.3, 0.68, 0.0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.03, 0.025, 0.63, mat.walnutM, -6.3 + sx * 0.68, 0.315, sz * 0.3, undefined, 10);
  chair(-6.3, 0, 0.9, Math.PI, false); bx(0.3, 0.03, 0.22, mat.paper, -6.4, 0.795, -0.05, 0.2);
  // ---- the bar: a balustrade of turned balusters, a gate in the middle (it swings) ----
  { const sh = [[0.03, 0], [0.045, 0.04], [0.03, 0.1], [0.025, 0.2], [0.05, 0.38], [0.025, 0.56], [0.03, 0.66], [0.045, 0.72], [0.03, 0.76]].map(p => new Vector3(p[0], p[1], 0));
    const bal = MeshBuilder.CreateLathe(nm('baluster'), { shape: sh, tessellation: 10 }, sc); bal.material = mat.walnut; bal.parent = root; bal.receiveShadows = true; casters.push(bal);
    for (let x = X0 + 0.4; x < X1 - 0.3; x += 0.2) if (Math.abs(x) > 0.85) bal.thinInstanceAdd(Matrix.Translation(x, 0.05, BAR)); }
  for (const s of [-1, 1]) { slab(X1 - 1.05, 0.14, 0.07, mat.walnut, s * (0.85 + (X1 - 1.05) / 2), 0.88, BAR); bx(X1 - 1.05, 0.05, 0.12, mat.walnut, s * (0.85 + (X1 - 1.05) / 2), 0.025, BAR); bx(0.12, 0.95, 0.12, mat.walnut, s * 0.85, 0.475, BAR); put(MeshBuilder.CreateSphere(nm('knob'), { diameter: 0.14, segments: 12 }, sc), mat.walnut, s * 0.85, 0.99, BAR); }
  const gate: TransformNode[] = [];
  for (const s of [-1, 1]) { const g = new TransformNode(nm('gate'), sc); g.parent = root; g.position.set(s * 0.79, 0, BAR); g.metadata = { s }; gate.push(g);
    const parts = [bx(0.74, 0.06, 0.05, mat.walnut, -s * 0.37, 0.82, 0, 0, g, true), bx(0.74, 0.06, 0.05, mat.walnut, -s * 0.37, 0.12, 0, 0, g, true)]; for (let i = 1; i < 6; i++) parts.push(bx(0.03, 0.7, 0.03, mat.walnut, -s * i * 0.12, 0.47, 0, 0, g, true));
    for (const p of parts) { p.metadata = { act: 'gate' }; } }
  { const hit = MeshBuilder.CreateBox(nm('gateHit'), { width: 1.6, height: 0.95, depth: 0.3 }, sc); hit.position.set(0, 0.48, BAR); hit.parent = root; hit.visibility = 0; hit.metadata = { act: 'gate' }; hit.isPickable = true; }
  progress(56, 'Lining up the benches…');
  // ---- the public benches: two blocks of pews behind the bar, the aisle in the middle ----
  for (let r = 0; r < 7; r++) { const hz = BAR + 1.2 + r * 1.02; for (const s of [-1, 1]) { const xa = s * 1.0, xb = s * 7.3; pew((xa + xb) / 2, hz, Math.abs(xb - xa)); } }
  // ---- the doors at the back with the exit sign and the clock; the judges' door ----
  const dz = Z1 - 0.06;
  bx(3.4, 3.3, 0.12, mat.walnut, 0, 1.65, Z1 - 0.02);
  for (const s of [-1, 1]) { const d = bx(1.45, 2.95, 0.08, mat.walnutM, s * 0.74, 1.5, dz - 0.04, 0, undefined, true); d.metadata = { act: 'door' };
    for (const [y, h] of [[2.3, 0.9], [0.95, 1.3]]) bx(1.1, h, 0.03, mat.walnut, s * 0.74, y, dz - 0.09);
    cyl(0.018, 0.018, 0.5, mat.brass, s * 0.12, 1.15, dz - 0.14, undefined, 10); }
  plane(0.75, 0.28, flat(T.ctExit(), 1.2), 0, 3.55, Z1 - 0.1, Math.PI); bx(0.8, 0.32, 0.06, mat.black, 0, 3.55, Z1 - 0.05);
  plane(0.84, 0.84, pbr({ tex: tex(T.ctClock()), rough: 0.4 }), 0, 5.3, Z1 - 0.06, Math.PI);
  { const t = MeshBuilder.CreateTorus(nm('ckR'), { diameter: 0.88, thickness: 0.08, tessellation: 48 }, sc); t.rotation.x = Math.PI / 2; t.position.set(0, 5.3, Z1 - 0.07); t.material = mat.gilt; t.parent = root; }
  const hands: TransformNode[] = [];
  for (const [l, w] of [[0.24, 0.025], [0.34, 0.016]]) { const hg = new TransformNode(nm('hand'), sc); hg.parent = root; hg.position.set(0, 5.3, Z1 - 0.1); bx(w, l, 0.01, mat.black, 0, l / 2 - 0.04, 0, 0, hg, true); hands.push(hg); }
  bx(1.2, 2.5, 0.08, mat.walnutM, X1 - 1.5, 1.25 + DAIS, Z0 + 0.12); bx(0.9, 1.0, 0.03, mat.walnut, X1 - 1.5, 1.8 + DAIS, Z0 + 0.17); cyl(0.018, 0.018, 0.4, mat.brass, X1 - 1.9, 1.3 + DAIS, Z0 + 0.2, undefined, 10);
  progress(64, 'Dusting the room…');
  // ---- one draw for each material (every part where it stands first) ----
  root.computeWorldMatrix(true); for (const t of sc.transformNodes) t.computeWorldMatrix(true);
  for (const [mt, list] of groups) {
    if (list.length < 2) { for (const m of list) casters.push(m); continue; }
    for (let i = 0; i < list.length; i += 400) { const part = list.slice(i, i + 400), mm = Mesh.MergeMeshes(part, true, true, undefined, false, false); if (mm) { mm.material = mt; mm.receiveShadows = true; mm.parent = root; mm.isPickable = false; casters.push(mm); } }
  }
  root.getChildMeshes().forEach(m => { if (!(m.metadata && m.metadata.act)) m.isPickable = false; });
  return { root, seats, casters, metals, gate, hands, screens, lights };

  /** A chair (or a judge's high-backed one) for a person whose hip is at (x, z), facing yaw: the seat's top 0.49 up. */
  function chair(x: number, y: number, z: number, yaw: number, high: boolean, par?: TransformNode) {
    const g = new TransformNode(nm('chair'), sc); g.parent = par || root; g.position.set(x, y, z); g.rotation.y = yaw; const lm = high ? mat.leatherR : mat.leatherG;
    slab(0.56, 0.52, 0.09, lm, 0, 0.49, 0.05, 0, g); bx(0.5, 0.06, 0.46, mat.walnutM, 0, 0.38, 0.05, 0, g);
    const bh = high ? 1.15 : 0.55, back = bx(0.56, bh, 0.09, lm, 0, 0.52 + bh / 2, -0.27, 0, g); back.rotation.x = -0.06;
    if (high) slab(0.62, 0.12, 0.05, mat.walnut, 0, 0.55 + bh + 0.05, -0.29, 0, g);
    for (const s of [-1, 1]) { for (const zz of [-0.17, 0.27]) cyl(0.022, 0.018, 0.36, mat.walnutM, s * 0.23, 0.18, zz, g, 8); bx(0.05, 0.05, 0.42, mat.walnut, s * 0.31, 0.74, 0.0, 0, g); bx(0.04, 0.24, 0.04, mat.walnut, s * 0.31, 0.6, 0.16, 0, g); }
  }
  /** A pew: hip line at z (people face −z), seat top 0.49, back 0.2 behind the hips, a book shelf on its back. */
  function pew(x: number, z: number, len: number) {
    slab(len, 0.46, 0.06, mat.oak, x, 0.49, z + 0.03); bx(len - 0.04, 0.52, 0.05, mat.oak, x, 0.84, z + 0.27); bx(len - 0.04, 0.04, 0.08, mat.oak, x, 1.1, z + 0.27);
    bx(len - 0.1, 0.1, 0.15, mat.oak, x, 0.76, z + 0.36); bx(len - 0.1, 0.08, 0.36, mat.oak, x, 0.2, z + 0.03);
    for (const s of [-1, 1]) bx(0.06, 1.12, 0.69, mat.oak, x + s * (len / 2 + 0.01), 0.56, z + 0.075);
  }
  function mic(x: number, y: number, z: number, yaw: number, par?: TransformNode) {
    cyl(0.04, 0.045, 0.015, mat.black, x, y + 0.008, z, par, 16); const nk = cyl(0.006, 0.006, 0.32, mat.black, x, y + 0.16, z, par, 6); nk.rotation.x = (yaw === 0 ? 1 : -1) * 0.35;
    put(MeshBuilder.CreateSphere(nm('mic'), { diameter: 0.036, segments: 8 }, sc), mat.black, x, y + 0.32, z + (yaw === 0 ? 0.11 : -0.11), 0, par);
  }
}
/** An exhibit (or none) on the court's screens. */
export function courtExhibit(C: Court, ex: any) { for (const t of C.screens) { T.ctExhibitDraw((t.getContext() as any).canvas, ex); t.update(true); } }
