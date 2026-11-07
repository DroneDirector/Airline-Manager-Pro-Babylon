// The Business lounge, built in Babylon.js to the same plan and measurements as the main game's (22 × 14 m, walls
// 4.8 m): the copper-wave ceiling, the herringbone oak floor, plaster over walnut, the wall of windows onto the
// apron, the black and brass L-shaped bar with its mirror wall, glass shelves of bottles and globe lights, the art
// deco fireplace with a real fire, armchairs round coffee tables on the carpet, sofas, the refreshment corner, the
// reception desk, four paintings with picture lights, the flight boards, and the sliding doors (shut: this edition is
// the lounge only). Positions are written in the main game's coordinates (x east, z towards the back wall) and
// turned into Babylon.js's own here, so the two stay comparable.
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, ParticleSystem, PointLight, SpotLight, Color4, Plane } from '@babylonjs/core';
import * as P from './pictures';
import { IS_PC } from '../../core/app';

export const LW = 22, LD = 14, LH = 4.8;
const X0 = -LW / 2, X1 = LW / 2, Z0 = -LD / 2, Z1 = LD / 2;
export const DOOR_X = LW / 2 - 6.3, DOOR_W = 1.9, DOOR_H = 2.4;

export interface Lounge {
  root: TransformNode; blocks: number[][]; spawn: { x: number; z: number; yaw: number };
  metals: PBRMaterial[]; casters: AbstractMesh[]; mirror: Mesh | null; mirrorMat: StandardMaterial | null;
  fire: { ps: ParticleSystem | null; light: PointLight; spot: SpotLight | null; at: Vector3; tex: Texture };
  boards: { tex: DynamicTexture; c: HTMLCanvasElement; kind: 'dep' | 'arr' }[]; door: Mesh; sun: number; leaves: AbstractMesh[]; backdrop: AbstractMesh | null;
}

export function buildLounge(scene: Scene, progress: (p: number, s: string) => void): Lounge {
  const root = new TransformNode('lounge', scene);
  const metals: PBRMaterial[] = [], casters: AbstractMesh[] = [], blocks: number[][] = [];
  let n = 0; const nm = (k: string) => k + '-' + (n++);
  const V = (x: number, y: number, z: number) => new Vector3(x, y, -z);   // the main game's coordinates → Babylon.js's
  const block = (xa: number, za: number, xb: number, zb: number) => blocks.push([Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)]);
  // ---- materials ----
  const tex = (c: HTMLCanvasElement, u = 1, v = 1, alpha = false): DynamicTexture => {
    const t = new DynamicTexture(nm('tex'), { width: c.width, height: c.height }, scene, true); const x = t.getContext() as any; x.drawImage(c, 0, 0); t.update(true); t.hasAlpha = alpha;
    t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: number; tex?: Texture; metal?: number; rough?: number; emis?: number; emisK?: number; alpha?: number; unlit?: boolean }): PBRMaterial => {
    const m = new PBRMaterial(nm('m'), scene); m.maxSimultaneousLights = 10;
    m.albedoColor = o.col != null ? Color3.FromHexString('#' + o.col.toString(16).padStart(6, '0')) : Color3.White();
    if (o.tex) m.albedoTexture = o.tex; m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6;
    if (o.emis != null) { m.emissiveColor = Color3.FromHexString('#' + o.emis.toString(16).padStart(6, '0')).scale(o.emisK || 1); }
    if (o.alpha != null && o.alpha < 1) { m.alpha = o.alpha; m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; }
    if (o.unlit) m.unlit = true;
    if ((o.metal || 0) >= 0.6) metals.push(m);
    return m; };
  const brass = pbr({ col: 0xC9A25E, metal: 0.95, rough: 0.28 }), gold = pbr({ col: 0xD4AF37, metal: 1, rough: 0.25 }), chrome = pbr({ col: 0xDDE2E8, metal: 1, rough: 0.15 }), black = pbr({ col: 0x15171B, rough: 0.4 });
  const walnut = pbr({ tex: tex(P.wood('#6B4428', '#2E1A0E', 5)), rough: 0.4 }), lacq = pbr({ col: 0x111214, rough: 0.18, metal: 0.1 });
  const stone = pbr({ tex: tex(P.darkMarble()), rough: 0.2 }), leather = pbr({ tex: tex(P.leather('#7A3F22')), rough: 0.45 }), porcelain = pbr({ col: 0xF7F5F0, rough: 0.2 });
  const glow = (col: number, k = 1) => pbr({ col: 0x000000, emis: col, emisK: k, rough: 1 });
  // ---- shapes (in the main game's coordinates) ----
  const place = (m: Mesh, mat: any, x: number, y: number, z: number, ry = 0, cast = true) => { m.position = V(x, y, z); m.rotation.y = -ry; m.material = mat; m.receiveShadows = true; m.parent = root; if (cast) casters.push(m); return m; };
  const box = (w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry = 0, cast = true) => place(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, scene), mat, x, y, z, ry, cast);
  const cyl = (rt: number, rb: number, h: number, mat: any, x: number, y: number, z: number, seg = 24, cast = true) => place(MeshBuilder.CreateCylinder(nm('c'), { diameterTop: rt * 2, diameterBottom: rb * 2, height: h, tessellation: seg }, scene), mat, x, y, z, 0, cast);
  const sphere = (r: number, mat: any, x: number, y: number, z: number, seg = 16, cast = false) => place(MeshBuilder.CreateSphere(nm('s'), { diameter: r * 2, segments: seg }, scene), mat, x, y, z, 0, cast);
  const lathe = (pts: number[][], mat: any, x: number, y: number, z: number, seg = 28) => place(MeshBuilder.CreateLathe(nm('l'), { shape: pts.map(p => new Vector3(p[0], p[1], 0)), tessellation: seg, sideOrientation: Mesh.DOUBLESIDE }, scene), mat, x, y, z, 0, false);
  /** A flat picture facing the way (nx, nz) in the main game's coordinates. */
  const plane = (w: number, h: number, mat: any, x: number, y: number, z: number, nx: number, nz: number) => { const p = MeshBuilder.CreatePlane(nm('p'), { width: w, height: h }, scene); p.position = V(x, y, z); p.rotation.y = Math.atan2(-nx, nz); p.material = mat; if (mat) mat.backFaceCulling = false; p.parent = root; p.receiveShadows = true; return p; };
  const picMat = (c: HTMLCanvasElement, glowK = 0) => { const m = new StandardMaterial(nm('pm'), scene); const t = tex(c); m.diffuseTexture = t; m.specularColor = new Color3(0.08, 0.08, 0.08); m.maxSimultaneousLights = 10; if (glowK) { m.emissiveTexture = t; m.disableLighting = true; } return m; };

  progress(22, 'Laying the herringbone floor…');
  // ---- floor, walls, wainscot ----
  { const f = MeshBuilder.CreateGround(nm('floor'), { width: LW, height: LD }, scene); f.material = pbr({ tex: tex(P.herringbone(IS_PC), LW / 4, LD / 4), rough: 0.42 }); f.receiveShadows = true; f.parent = root; }
  const wallM = pbr({ tex: tex(P.plaster(), 3, 1), rough: 0.9 });
  const ox0 = DOOR_X - DOOR_W / 2, ox1 = DOOR_X + DOOR_W / 2;
  // the back wall (with the doorway), the side walls; boxes just outside the room
  box(ox0 - X0, LH, 0.1, wallM, (X0 + ox0) / 2, LH / 2, Z1 + 0.05, 0, false); box(X1 - ox1, LH, 0.1, wallM, (ox1 + X1) / 2, LH / 2, Z1 + 0.05, 0, false); box(DOOR_W, LH - DOOR_H, 0.1, wallM, DOOR_X, (LH + DOOR_H) / 2, Z1 + 0.05, 0, false);
  box(0.1, LH, LD, wallM, X0 - 0.05, LH / 2, 0, 0, false); box(0.1, LH, LD, wallM, X1 + 0.05, LH / 2, 0, 0, false);
  for (const s of [-1, 1]) { box(0.02, 1.1, LD, walnut, s * (LW / 2 - 0.01), 0.55, 0, 0, false); box(0.03, 0.04, LD, gold, s * (LW / 2 - 0.02), 1.12, 0, 0, false); }
  for (const [xa, xb] of [[X0, ox0 - 0.12], [ox1 + 0.12, X1]]) { box(xb - xa, 1.1, 0.02, walnut, (xa + xb) / 2, 0.55, Z1 - 0.01, 0, false); box(xb - xa, 0.04, 0.03, gold, (xa + xb) / 2, 1.12, Z1 - 0.02, 0, false); }
  block(X0 - 1, Z0, X0 + 0.35, Z1); block(X1 - 0.35, Z0, X1 + 1, Z1); block(X0, Z1 - 0.35, X1, Z1 + 1); block(X0, Z0 - 1, X1, Z0 + 0.4);

  progress(30, 'Hanging the copper ceiling…');
  // ---- the ceiling: dark above, copper strips in slow waves, warm light hidden along the walls ----
  { box(LW, 0.05, LD, pbr({ col: 0x1A1612, rough: 0.85 }), 0, LH + 0.025, 0, 0, false);
    const nW = Math.round(LD / 0.53), step = LD / nW, tubes: Mesh[] = [];
    for (let j = 0; j < nW; j++) { const z = Z0 + step * (j + 0.5), path: Vector3[] = [];
      for (let i = 0; i <= 40; i++) path.push(V(X0 + 0.08 + i * (LW - 0.16) / 40, LH - 0.5 - 0.4 * Math.sin(i / 40 * Math.PI * 3 + j * 0.25), z));
      tubes.push(MeshBuilder.CreateTube(nm('t'), { path, radius: 0.05, tessellation: IS_PC ? 8 : 6 }, scene)); }
    const cu = Mesh.MergeMeshes(tubes, true, true) as Mesh; cu.material = pbr({ col: 0xB86F3E, metal: 0.9, rough: 0.3, emis: 0x3A1A08, emisK: 0.35 }); cu.parent = root;
    const strip = glow(0xFFC27A, 2.2); for (const z of [Z0 + 0.3, Z1 - 0.12]) box(LW - 0.2, 0.03, 0.08, strip, 0, LH - 0.05, z, 0, false); }

  progress(38, 'Cleaning the windows…');
  // ---- the window wall onto the apron (−z) ----
  { const vm = picMat(P.view(), 1); plane(LW * 2.4, LW * 0.6, vm, 0, LW * 0.15 - 2, Z0 - 14, 0, 1);
    const nMul = Math.round(LW / 2.2); for (let i = 0; i <= nMul; i++) box(0.09, LH, 0.14, black, X0 + i * LW / nMul, LH / 2, Z0, 0, false);
    box(LW, 0.12, 0.2, black, 0, 0.06, Z0, 0, false); box(LW, 0.2, 0.2, black, 0, LH - 0.1, Z0, 0, false);
    const gl = pbr({ col: 0xCFE2F2, alpha: 0.12, rough: 0.03 }); plane(LW, LH, gl, 0, LH / 2, Z0 + 0.01, 0, 1); }

  progress(46, 'Rolling out the carpet…');
  // ---- seating: armchairs round coffee tables on the carpet, a sofa on each side wall ----
  box(LW * 0.7, 0.012, 2 * 3.3 + 1.4, pbr({ tex: tex(P.carpet(), 2, 1.2), rough: 1 }), 0, 0.006, Z0 + 2.6 + 1.65, 0, false);
  const armchair = (x: number, z: number, ry: number) => {
    const g = new TransformNode(nm('chair'), scene); g.parent = root; g.position = V(x, 0, z); g.rotation.y = -ry;
    const part = (w: number, h: number, d: number, mat: any, px: number, py: number, pz: number) => { const b = MeshBuilder.CreateBox(nm('cp'), { width: w, height: h, depth: d }, scene); b.position = new Vector3(px, py, -pz); b.material = mat; b.parent = g; b.receiveShadows = true; casters.push(b); };
    part(0.78, 0.2, 0.72, leather, 0, 0.32, 0); part(0.78, 0.5, 0.14, leather, 0, 0.62, -0.3); for (const s of [-1, 1]) part(0.12, 0.28, 0.72, leather, s * 0.39, 0.5, 0);
    for (const sx of [-0.32, 0.32]) for (const sz of [-0.28, 0.28]) { const l = MeshBuilder.CreateCylinder(nm('leg'), { diameter: 0.035, height: 0.24 }, scene); l.position = new Vector3(sx, 0.12, -sz); l.material = black; l.parent = g; }
  };
  { const nx = 3; for (let ci = 0; ci < nx * 2; ci++) {
      const i = Math.floor(ci / 2), j = ci % 2, cx = -LW * 0.3 + (i + 0.5) * LW * 0.6 / nx, cz = Z0 + 2.6 + j * 3.3;
      cyl(0.5, 0.5, 0.05, walnut, cx, 0.42, cz, 40); cyl(0.06, 0.2, 0.4, black, cx, 0.2, cz, 16); block(cx - 0.55, cz - 0.55, cx + 0.55, cz + 0.55);
      cyl(0.045, 0.04, 0.07, porcelain, cx + 0.18, 0.48, cz + 0.1, 16, false); cyl(0.075, 0.075, 0.01, porcelain, cx + 0.18, 0.45, cz + 0.1, 20, false);
      for (const [dx, dz, ry] of [[0, -1.0, 0], [0, 1.0, Math.PI], [-1.0, 0, Math.PI / 2], [1.0, 0, -Math.PI / 2]]) { if (ci % 2 && dx === 0 && dz < 0) continue; armchair(cx + dx, cz + dz, ry); block(cx + dx - 0.45, cz + dz - 0.45, cx + dx + 0.45, cz + dz + 0.45); }
    } }
  for (const s of [-1, 1]) { const x = s * (LW / 2 - 0.65), z = Z0 + LD * 0.42, ry = -s * Math.PI / 2;
    box(0.9, 0.42, 2.3, leather, x, 0.21, z, 0); box(0.22, 0.85, 2.3, leather, x + s * 0.34, 0.43, z, 0); for (const e of [-1, 1]) box(0.9, 0.62, 0.16, leather, x, 0.31, z + e * 1.15, 0); void ry;
    block(x - 0.5, z - 1.2, x + 0.5, z + 1.2);
    cyl(0.16, 0.18, 0.03, black, x, 0.015, z + 1.6, 20); cyl(0.015, 0.015, 1.5, black, x, 0.76, z + 1.6, 8); cyl(0.18, 0.25, 0.3, glow(0xFFE2A8, 0.8), x, 1.55, z + 1.6, 24, false);
    cyl(0.22, 0.17, 0.5, pbr({ col: 0xE6E1D8, rough: 0.6 }), x, 0.25, z - 1.7, 20); for (let k = 0; k < 9; k++) { const lf = sphere(0.16, pbr({ col: 0x2F6B34, rough: 0.7 }), x + Math.sin(k * 2.4) * 0.18, 0.75 + (k % 3) * 0.28, z - 1.7 + Math.cos(k * 2.4) * 0.18, 8, true); lf.scaling = new Vector3(0.5, 1.6, 0.5); }
    block(x - 0.35, z + 1.3, x + 0.35, z - 2.05); }

  progress(54, 'Setting out the refreshments…');
  // ---- the refreshment corner (back right), the vending machine, the magazine rack, the reception desk ----
  { const cx = X1 - 3.0, cz = Z1 - 1.0; box(3.2, 0.88, 0.7, walnut, cx, 0.44, cz); box(3.3, 0.05, 0.78, stone, cx, 0.905, cz);
    block(cx - 1.7, cz - 0.45, cx + 1.7, Z1);
    box(0.42, 0.5, 0.42, chrome, cx - 1.1, 1.18, cz + 0.05); box(0.3, 0.16, 0.02, glow(0x3A8FD8, 1.2), cx - 1.1, 1.3, cz - 0.17, 0, false);
    lathe([[0, 0], [0.13, 0], [0.15, 0.08], [0.15, 0.35], [0.11, 0.42], [0.04, 0.46], [0, 0.5]], brass, cx - 0.35, 0.93, cz);
    for (let i = 0; i < 4; i++) cyl(0.045, 0.04, 0.07, porcelain, cx + 0.55 + (i % 2) * 0.2, 0.965, cz - 0.15 + Math.floor(i / 2) * 0.22, 16, false);
    cyl(0.16, 0.08, 0.09, porcelain, cx + 1.38, 0.975, cz - 0.05, 24, false); for (let i = 0; i < 5; i++) sphere(0.04, pbr({ col: [0xD23C2C, 0xF2C230, 0x7BC043, 0xF28C28, 0xD23C2C][i], rough: 0.5 }), cx + 1.38 + Math.cos(i * 1.3) * 0.06, 1.04, cz - 0.05 + Math.sin(i * 1.3) * 0.06, 10, false);
    const fx = X1 - 0.62, fz = cz - 1.6; box(0.8, 1.9, 0.95, pbr({ col: 0x2A2D33, rough: 0.4 }), fx, 0.95, fz); box(0.02, 1.2, 0.7, pbr({ col: 0x000000, emis: 0x9FD2FF, emisK: 0.5, rough: 0.05 }), fx - 0.41, 1.15, fz, 0, false); block(fx - 0.5, fz - 0.55, X1, fz + 0.55);
    const mx = X0 + 0.62, mz = Z1 - 0.5; box(0.7, 1.0, 0.3, walnut, mx, 0.5, mz); for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) box(0.26, 0.3, 0.01, pbr({ col: [0xC0392B, 0x2E5C8A, 0xF2B544, 0x2F6B4A, 0x8E44AD, 0xE67E22][(r * 2 + i) % 6], rough: 0.7 }), mx - 0.16 + i * 0.32, 0.3 + r * 0.3, mz - 0.16, 0, false);
    block(mx - 0.45, mz - 0.3, mx + 0.45, Z1);
    const dx = DOOR_X - 2.6; box(2.2, 1.05, 0.6, walnut, dx, 0.525, Z1 - 1.6); box(2.3, 0.05, 0.75, stone, dx, 1.07, Z1 - 1.6);
    plane(1.6, 0.4, picMat(P.sign('Airport Dynasty Pro', '#2C8CFF', '#FFFFFF'), 0), dx, 0.6, Z1 - 1.91, 0, -1); block(dx - 1.2, Z1 - 2.0, dx + 1.2, Z1 - 1.2); }

  progress(62, 'Polishing the brass at the bar…');
  // ---- the bar: L-shaped, black lacquer and brass, returning to the back wall at its right end ----
  { const bxp = X0 + 3.2, bz = Z1 - 1.2, xa = bxp - 1.85, xc = bxp + 1.85, xr = bxp + 2.45;
    box(xr - xa, 1.08, 0.6, lacq, (xa + xr) / 2, 0.54, bz); box(0.6, 1.08, Z1 - bz - 0.3, lacq, (xc + xr) / 2, 0.54, (bz + 0.3 + Z1) / 2);
    box(xr - xa + 0.2, 0.06, 0.8, stone, (xa + xr) / 2, 1.1, bz); box(0.8, 0.06, Z1 - bz - 0.4, stone, (xc + xr) / 2, 1.1, (bz + 0.4 + Z1) / 2 - 0.02);
    box(xr - xa, 0.03, 0.012, brass, (xa + xr) / 2, 1.06, bz - 0.306, 0, false);
    { const r1 = cyl(0.022, 0.022, xr - xa + 0.05, brass, (xa + xr) / 2 + 0.05, 0.2, bz - 0.4, 12, false); r1.rotation.z = Math.PI / 2;
      const r2 = cyl(0.022, 0.022, Z1 - bz + 0.28, brass, xr + 0.1, 0.2, (bz - 0.4 + Z1 - 0.12) / 2, 12, false); r2.rotation.x = Math.PI / 2; }
    block(xa - 0.1, bz - 0.5, xr + 0.15, Z1);
    const seat = pbr({ tex: tex(P.leather('#1E1E20')), rough: 0.5 });
    const stool = (sx: number, sz: number) => { cyl(0.21, 0.2, 0.07, seat, sx, 0.8, sz, 24); cyl(0.2, 0.2, 0.02, brass, sx, 0.755, sz, 24, false);
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4, l = cyl(0.012, 0.014, 0.78, brass, sx + Math.cos(a) * 0.15, 0.38, sz + Math.sin(a) * 0.15, 8, false); l.rotation.z = Math.cos(a) * 0.12; l.rotation.x = Math.sin(a) * 0.12; }
      const ring = place(MeshBuilder.CreateTorus(nm('ring'), { diameter: 0.38, thickness: 0.02, tessellation: 28 }, scene), brass, sx, 0.3, sz, 0, false); void ring;
      block(sx - 0.25, sz - 0.25, sx + 0.25, sz + 0.25); };
    for (let i = 0; i < 5; i++) stool(bxp - 1.6 + i * 0.72, bz - 0.75); for (const sz of [bz + 0.05, bz + 0.78]) stool(xr + 0.7, sz);
    // the back wall: lacquer cabinet, the mirror in its brass frame, glass shelves lit from below, the bottles
    box(3.6, 0.9, 0.3, lacq, bxp, 0.45, Z1 - 0.15); box(3.64, 0.03, 0.34, stone, bxp, 0.915, Z1 - 0.17);
    for (const [w, h, x, y] of [[3.7, 0.04, bxp, 2.92], [3.7, 0.04, bxp, 0.98], [0.04, 1.98, bxp - 1.83, 1.95], [0.04, 1.98, bxp + 1.83, 1.95]]) box(w, h, 0.03, brass, x, y, Z1 - 0.02, 0, false);
    box(xr + 0.4 - (X0 + 0.1), 0.02, 0.02, brass, (X0 + 0.1 + xr + 0.4) / 2, 3.02, Z1 - 0.012, 0, false);
    const shelfGlass = pbr({ col: 0xDDEFF2, alpha: 0.35, rough: 0.05 }), led = glow(0xFFD9A0, 2);
    for (const y of [1.4, 1.8, 2.2]) { box(3.0, 0.015, 0.25, shelfGlass, bxp, y, Z1 - 0.2, 0, false); box(3.0, 0.01, 0.01, brass, bxp, y - 0.012, Z1 - 0.33, 0, false); box(2.9, 0.008, 0.02, led, bxp, y - 0.012, Z1 - 0.1, 0, false); }
    // bottles: eleven drinks, each its own colour and shape, three shelves of twelve (instances of one each)
    const DR: [number, number, number[][]][] = [
      [0x1E3A1E, 0.62, [[0, 0], [0.036, 0.002], [0.037, 0.2], [0.033, 0.225], [0.02, 0.245], [0.014, 0.26], [0.0135, 0.31], [0, 0.31]]],
      [0xC9D7A8, 0.62, [[0, 0], [0.036, 0.002], [0.037, 0.2], [0.033, 0.225], [0.02, 0.245], [0.014, 0.26], [0.0135, 0.31], [0, 0.31]]],
      [0x17301C, 0.62, [[0, 0], [0.043, 0.002], [0.044, 0.18], [0.037, 0.22], [0.022, 0.26], [0.016, 0.28], [0.0155, 0.31], [0, 0.315]]],
      [0xB8661C, 0.5, [[0, 0], [0.046, 0.01], [0.046, 0.17], [0.04, 0.19], [0.02, 0.205], [0.015, 0.215], [0.015, 0.25], [0, 0.27]]],
      [0x9FD2D8, 0.4, [[0, 0], [0.039, 0.012], [0.039, 0.2], [0.03, 0.225], [0.016, 0.24], [0.015, 0.27], [0, 0.29]]],
      [0xE9EEF2, 0.35, [[0, 0], [0.034, 0.01], [0.034, 0.22], [0.028, 0.245], [0.013, 0.265], [0.0125, 0.31], [0, 0.325]]],
      [0xDCE9DC, 0.4, [[0, 0], [0.034, 0.01], [0.034, 0.22], [0.028, 0.245], [0.013, 0.265], [0.0125, 0.31], [0, 0.325]]],
      [0x3A2010, 0.7, [[0, 0], [0.041, 0.012], [0.041, 0.18], [0.035, 0.2], [0.018, 0.22], [0.015, 0.26], [0, 0.28]]],
      [0xA4561A, 0.55, [[0, 0], [0.05, 0.03], [0.055, 0.08], [0.05, 0.13], [0.03, 0.165], [0.016, 0.18], [0.015, 0.215], [0, 0.24]]],
      [0x2A1810, 0.7, [[0, 0], [0.036, 0.002], [0.037, 0.2], [0.033, 0.225], [0.02, 0.245], [0.014, 0.26], [0.0135, 0.31], [0, 0.31]]],
      [0x8A4416, 0.7, [[0, 0], [0.046, 0.012], [0.046, 0.14], [0.04, 0.16], [0.018, 0.18], [0.016, 0.2], [0, 0.22]]],
    ];
    const masters = DR.map(d => { const m = MeshBuilder.CreateLathe(nm('bottle'), { shape: d[2].map(p => new Vector3(p[0], p[1], 0)), tessellation: 20, closed: true }, scene); m.material = pbr({ col: d[0], alpha: d[1], rough: 0.08 }); m.parent = root; m.isVisible = false; return m; });
    let k = 0; for (const y of [1.4, 1.8, 2.2]) for (let i = 0; i < 12; i++) { const mm = masters[(k * 7 + Math.floor(k / 11)) % 11]; k++; const inst = mm.createInstance(nm('bi')); inst.parent = root; inst.position = V(bxp - 1.35 + i * 0.245, y + 0.015, Z1 - 0.2); inst.rotation.y = (i % 3 - 1) * 0.25; }
    // the glass rack hung over the counter, glasses upside down
    for (const s of [-1, 1]) box(3.0, 0.02, 0.02, brass, bxp, 2.42, bz + 0.02 + s * 0.12, 0, false);
    for (const x of [-1.4, 0, 1.4]) cyl(0.008, 0.008, LH - 2.42, brass, bxp + x, 2.42 + (LH - 2.42) / 2, bz + 0.02, 6, false);
    const gm = MeshBuilder.CreateLathe(nm('glass'), { shape: [[0, 0], [0.036, 0.001], [0.005, 0.008], [0.0035, 0.02], [0.0035, 0.085], [0.012, 0.095], [0.036, 0.12], [0.043, 0.15], [0.041, 0.18], [0.035, 0.215]].map(p => new Vector3(p[0], p[1], 0)), tessellation: 20, sideOrientation: Mesh.DOUBLESIDE }, scene);
    gm.material = pbr({ col: 0xF4FAFF, alpha: 0.22, rough: 0.04 }); gm.parent = root; gm.isVisible = false;
    for (let i = 0; i < 14; i++) { const g = gm.createInstance(nm('gi')); g.parent = root; g.position = V(bxp - 1.3 + i * 0.2, 2.41, bz + 0.02 + (i % 2 ? 0.06 : -0.06)); g.rotation.x = Math.PI; }
    // the mixing station on the corner, globe lights over the counter
    { const mx = (xc + xr) / 2, mz = bz + 0.62; box(0.32, 0.01, 0.6, black, mx, 1.135, mz, 0, false); lathe([[0, 0], [0.042, 0], [0.046, 0.12], [0.045, 0.16], [0.038, 0.18], [0.03, 0.22], [0.016, 0.24], [0, 0.245]], chrome, mx, 1.14, mz - 0.18);
      lathe([[0, 0], [0.024, 0], [0.006, 0.045], [0.024, 0.09], [0, 0.09]], chrome, mx - 0.02, 1.14, mz); for (const [i, c] of [[0, 0xF2D23A], [1, 0x7BC043], [2, 0xF28C28]]) cyl(0.02, 0.02, 0.006, pbr({ col: c, rough: 0.6 }), mx + 0.2, 1.18, mz - 0.04 + i * 0.08, 16, false); }
    const globe = glow(0xFFF1DA, 1.6);
    for (let i = 0; i < 5; i++) { const gx = xa + 0.4 + i * (xr - xa - 0.8) / 4, gz = bz - 0.5, gy = 2.85; cyl(0.004, 0.004, LH - gy - 0.17, black, gx, (LH + gy + 0.17) / 2, gz, 6, false); sphere(0.17, globe, gx, gy, gz, 24); cyl(0.03, 0.03, 0.04, brass, gx, gy + 0.18, gz, 12, false); }
  }
  // the mirror behind the bottles (its reflection is set up by the lounge, with its quality setting)
  let mirror: Mesh | null = null, mirrorMat: StandardMaterial | null = null;
  { const bxp = X0 + 3.2; mirror = MeshBuilder.CreatePlane(nm('mirror'), { width: 3.6, height: 1.9 }, scene); mirror.position = V(bxp, 1.95, Z1 - 0.012); mirror.rotation.y = Math.atan2(0, -1); mirror.parent = root;
    mirrorMat = new StandardMaterial(nm('mirrorM'), scene); mirrorMat.diffuseColor = new Color3(0.12, 0.1, 0.09); mirrorMat.specularColor = new Color3(0.3, 0.3, 0.3); mirror.material = mirrorMat; }

  progress(72, 'Lighting the fire…');
  // ---- the art deco fireplace on the west wall, with a real fire ----
  let fire: Lounge['fire'];
  { const fx = X0, fz = Z0 + LD * 0.72, brassF = pbr({ col: 0xC9A25E, metal: 0.95, rough: 0.28, emis: 0x5A3E14, emisK: 0.55 });
    const at = (w: number, h: number, d: number, m: any, x: number, y: number, z: number) => box(d, h, w, m, fx + x, y, fz + z, 0, false);
    at(3.0, LH, 0.12, pbr({ col: 0x111111, rough: 0.15, metal: 0.2 }), 0.06, LH / 2, 0);
    for (let s2 = 0; s2 < 5; s2++) { const w2 = 1.2 + s2 * 0.28, h2 = 1.0 + s2 * 0.14, d2 = 0.14 + (4 - s2) * 0.02;
      at(w2 + 0.04, 0.04, d2, brassF, 0.12 + d2 / 2, h2, 0); at(0.04, h2, d2, brassF, 0.12 + d2 / 2, h2 / 2, w2 / 2); at(0.04, h2, d2, brassF, 0.12 + d2 / 2, h2 / 2, -w2 / 2); }
    at(1.16, 0.96, 0.06, pbr({ col: 0x050505, rough: 0.9 }), 0.13, 0.48, 0); at(2.6, 0.05, 0.6, stone, 0.42, 0.025, 0); at(0.9, 0.06, 0.18, pbr({ col: 0x3A2214, rough: 0.9 }), 0.26, 0.08, 0);
    for (let i = 0; i < 9; i++) { const a2 = (i - 4) * 0.22, r2 = box(0.03, 1.2, 0.02, brassF, fx + 0.14, 2.6 + Math.cos(a2) * 0.6, fz + Math.sin(a2) * 0.6, 0, false); r2.rotation.x = a2; }
    const light = new PointLight('fireL', V(fx + 0.8, 0.5, fz), scene); light.diffuse = Color3.FromHexString('#FF8A3C'); light.intensity = 3; light.range = 7;
    let spot: SpotLight | null = null; if (IS_PC) { spot = new SpotLight('fireUp', V(fx + 0.8, 0.25, fz), new Vector3(-0.35, 1, 0).normalize(), 0.9, 2, scene); spot.diffuse = Color3.FromHexString('#FFC98A'); spot.intensity = 6; spot.range = 5; }
    fire = { ps: null, light, spot, at: V(fx + 0.32, 0.12, fz), tex: tex(P.flame(), 1, 1, true) };
    block(fx - 0.5, fz - 1.5, fx + 0.8, fz + 1.5); }

  progress(80, 'Hanging the paintings…');
  // ---- paintings with picture lights, the flight boards ----
  { const hang = (kind: string, w: number, h: number, x: number, z: number, nx: number, nz: number) => {
      const y = 2.25, m = picMat(P.painting(kind, w, h)); const pl = plane(w, h, m, x + nx * 0.07, y, z + nz * 0.07, nx, nz); void pl;
      const t = 0.07, fr = (bw: number, bh: number, ox: number, oy: number) => box(Math.abs(nx) ? 0.05 : bw, bh, Math.abs(nx) ? bw : 0.05, brass, x + nx * 0.04 + (Math.abs(nz) ? ox : 0), y + oy, z + nz * 0.04 + (Math.abs(nx) ? ox : 0), 0, false);
      fr(w + t * 2, t, 0, h / 2 + t / 2); fr(w + t * 2, t, 0, -h / 2 - t / 2); fr(t, h, w / 2 + t / 2, 0); fr(t, h, -w / 2 - t / 2, 0);
      box(Math.abs(nx) ? 0.07 : Math.min(0.7, w * 0.45), 0.05, Math.abs(nx) ? Math.min(0.7, w * 0.45) : 0.07, brass, x + nx * 0.2, y + h / 2 + 0.14, z + nz * 0.2, 0, false);
      box(Math.abs(nx) ? 0.04 : Math.min(0.66, w * 0.43), 0.008, Math.abs(nx) ? Math.min(0.66, w * 0.43) : 0.04, glow(0xFFE2B0, 2), x + nx * 0.2, y + h / 2 + 0.11, z + nz * 0.2, 0, false); };
    const fidsL = -LW * 0.05 - 1.65, left = X0 + 5.65;
    hang('aurora', 2.6, 1.5, X0, Z0 + LD * 0.17, 1, 0); hang('dusk', 1.8, 1.2, X1, Z0 + LD * 0.2, -1, 0);
    hang('gold', 1.3, 1.6, (left + fidsL) / 2, Z1, 0, -1); hang('storm', 2.4, 1.3, X1 - 3.0, Z1, 0, -1); }
  const boards: Lounge['boards'] = [];
  { const pair = (x: number, y: number, z: number, nx: number, nz: number, w: number) => {
      const h = w * 9 / 16; for (const k of ['dep', 'arr'] as ('dep' | 'arr')[]) {
        const off = (k === 'dep' ? -1 : 1) * (w / 2 + 0.15 + 0.035), ax = Math.abs(nz) ? (nz < 0 ? -off : off) : 0, az = Math.abs(nx) ? (nx > 0 ? -off : off) : 0;
        const [c] = P.canvas(1600, 900); P.board(c, k); const t = tex(c); const m = new StandardMaterial(nm('fids'), scene); m.diffuseTexture = t; m.emissiveTexture = t; m.disableLighting = true;
        plane(w, h, m, x + ax + nx * 0.03, y, z + az + nz * 0.03, nx, nz);
        box(Math.abs(nx) ? 0.05 : w + 0.07, h + 0.07, Math.abs(nx) ? w + 0.07 : 0.05, black, x + ax, y, z + az, 0, false);
        boards.push({ tex: t, c, kind: k }); } };
    pair(-LW * 0.05, 2.0, Z1 - 0.04, 0, -1, 1.6);
    for (const s of [-1, 1]) pair(s * (LW / 2 - 0.04), 2.75, Z0 + LD * 0.42, -s, 0, 1.3); }

  progress(88, 'Opening the doors…');
  // ---- the way in: sliding glass doors (shut in this edition), the exit sign, the welcome mat where you arrive ----
  let door: Mesh; let leaves: AbstractMesh[] = [], backdrop: AbstractMesh | null = null;
  { const dx = DOOR_X, dw = DOOR_W, dh = DOOR_H, z = Z1;
    box(0.09, dh, 0.16, black, dx - dw / 2 - 0.045, dh / 2, z - 0.06, 0, false); box(0.09, dh, 0.16, black, dx + dw / 2 + 0.045, dh / 2, z - 0.06, 0, false); box(dw + 0.18, 0.22, 0.2, black, dx, dh + 0.11, z - 0.08, 0, false);
    const glassD = pbr({ col: 0xCFE2F2, alpha: 0.25, rough: 0.05 });
    const n0 = root.getChildMeshes(true).length;
    for (const s of [-1, 1]) { box(dw / 2 - 0.02, dh - 0.06, 0.03, glassD, dx + s * dw / 4, (dh - 0.06) / 2, z - 0.16, 0, false); box(0.04, dh - 0.06, 0.04, black, dx + s * (dw / 2 - 0.02), (dh - 0.06) / 2, z - 0.16, 0, false); box(dw / 2 - 0.06, 0.1, 0.035, pbr({ col: 0xEDEDED, alpha: 0.8, rough: 0.6 }), dx + s * dw / 4, 1.2, z - 0.16, 0, false); }
    leaves = root.getChildMeshes(true).slice(n0);
    plane(0.46, 0.17, picMat(P.sign('EXIT', '#0E8A43', '#FFFFFF', 256, 96, '700 52px Arial, sans-serif'), 1), dx, dh + 0.42, z - 0.02, 0, -1);
    const nb = root.getChildMeshes(true).length; plane(dw + 3, 3.2, picMat(P.sign('', '#2B2F35', '#000'), 0), dx, 1.6, z + 2.5, 0, -1); backdrop = root.getChildMeshes(true)[nb] || null;
    door = MeshBuilder.CreateBox('door-hit', { width: dw, height: dh, depth: 0.4 }, scene); door.position = V(dx, dh / 2, z - 0.2); door.isVisible = false; door.isPickable = true; door.metadata = { act: 'door' }; door.parent = root;
    box(2.0, 0.01, 1.2, pbr({ tex: tex(P.welcomeMat()), rough: 1 }), dx, 0.005, z - 1.9, 0, false); }
  // ---- the lights ----
  const lamps: [number, number][] = [[-LW * 0.3, Z0 + LD * 0.3], [0, Z0 + LD * 0.3], [LW * 0.3, Z0 + LD * 0.3], [-LW * 0.3, Z0 + LD * 0.7], [0, Z0 + LD * 0.7], [LW * 0.3, Z0 + LD * 0.7]];
  for (const [x, z] of (IS_PC ? lamps : [lamps[1], lamps[3], lamps[5]])) { const L = new PointLight(nm('lamp'), V(x, LH - 0.9, z), scene); L.diffuse = Color3.FromHexString('#FFE6C4'); L.intensity = 9; L.range = 14; }
  { const bl = new PointLight('barL', V(X0 + 3.2, 2.6, Z1 - 1.6), scene); bl.diffuse = Color3.FromHexString('#FFE2B0'); bl.intensity = 5; bl.range = 6; }
  // the pendant lights over the seating
  for (let ci = 0; ci < 6; ci++) { const i = Math.floor(ci / 2), j = ci % 2, cx = -LW * 0.3 + (i + 0.5) * LW * 0.6 / 3, cz = Z0 + 2.6 + j * 3.3;
    cyl(0.006, 0.006, 1.2, black, cx, LH - 0.6, cz, 6, false); const sh = cyl(0.03, 0.28, 0.3, brass, cx, LH - 1.3, cz, 24, false); void sh; sphere(0.08, glow(0xFFF3DC, 1.8), cx, LH - 1.38, cz, 12); }
  progress(94, 'The room comes to life…');
  // where you arrive: on the welcome mat inside the doors, facing the windows (as in the main game)
  const spawn = { x: DOOR_X, z: Z1 - 2.3, yaw: 0.15 };
  void Color4; void Plane;
  return { root, blocks, spawn, metals, casters, mirror, mirrorMat, fire, boards, door, sun: P.daylight(), leaves, backdrop };
}
/** Can you stand there (the walls and everything in the way, with a person's half-width)? */
export function blockedAt(L: Lounge, x: number, z: number): boolean {
  const r = 0.25;
  if (x < X0 + 0.4 || x > X1 - 0.4 || z < Z0 + 0.45 || z > Z1 - 0.4) return true;
  for (const b of L.blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return true;
  return false;
}
