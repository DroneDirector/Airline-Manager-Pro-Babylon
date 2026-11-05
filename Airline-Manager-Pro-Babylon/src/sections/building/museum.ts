// Your museum: the Vortex Gallery, in the joined building, off the concourse's west wall (to the owner's plan and
// renders, concept 1). An oval hall, 30 × 20 m: the walls sweep up into the ceiling as one white high-gloss shell, 64
// ribs follow its curve with lines of light, an oval skylight at its top (9.2 m), and a gallery ribbon round it at 4.4 m
// with a glass balustrade and light along its edges. The glossy floor has lines of light flowing in from the entrance.
// In the middle, the centrepiece: an airliner in your colours hovering at 3.6 m over a dark round plinth ringed with
// light. Three curved display walls with backlit niches, and pedestals 1–8 with glass domes for the trophies, model
// aircraft and medals; when the collection grows, more pedestals stand round the hall. The entrance from the concourse:
// a portal with a glowing arch and sliding glass doors, the museum's name over it. Our own shapes and textures.
// The museum's own coordinates: x along the hall's long axis, z towards the entrance (z = D / 2); the floor's middle 0.
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, PointLight, VertexData, SpotLight } from '@babylonjs/core';
import * as P from '../lounge/pictures';
import { IS_PC } from '../../core/app';
import { buildAirliner, repaint, setGear } from '../viewer3d/airliner';

export interface Exhibit { title: string; sub: string; kind: string; color?: string; lines?: string[]; tier?: number }
export interface Piece { e: Exhibit; node: TransformNode; at: Vector3 }   // at: where you stand to look at it (museum coordinates)
export interface Museum { root: TransformNode; W: number; D: number; blocks: number[][]; circles: number[][]; casters: AbstractMesh[]; metals: PBRMaterial[]; pieces: Piece[]; doors: AbstractMesh[]; doorBase: Vector3[]; plane?: TransformNode }
const TIER = ['#B07A45', '#C9CED6', '#E2B84A', '#DDE6EE', '#BFEFFF', '#FF6FD8'];
const A = 15, B = 10, H = 9.2, KS = 0.36, GAL = 4.4, NR = 64, DOOR_T = 0.1, DOOR_U = 0.15;   // DOOR_*: the entrance's opening in the shell (round it, up it)   // the oval's half-axes, the skylight's height, its size (share of the oval), the gallery, the ribs
/** A point of the shell: round the oval (t: 0…2π, from the long axis) and up its curve (u: 0 floor … 1 skylight). */
function shell(t: number, u: number, inset = 0): Vector3 {
  const ph = u * Math.PI / 2, c = Math.pow(Math.cos(ph), 2 / 3), s = Math.pow(Math.sin(ph), 2 / 3), k = KS + (1 - KS) * c - inset;
  return new Vector3(A * k * Math.cos(t), H * s - inset * 0.6, B * k * Math.sin(t));
}
/** Where the shell is at a height (its scale against the oval), for the gallery and the rings of light. */
function kAt(y: number): number { const s = Math.min(1, y / H), ph = Math.asin(Math.pow(s, 1.5)); return KS + (1 - KS) * Math.pow(Math.cos(ph), 2 / 3); }

export function buildMuseum(sc: Scene, items: Exhibit[], c1: string, c2: string, name: string): Museum {
  const root = new TransformNode('museum', sc), blocks: number[][] = [], circles: number[][] = [], casters: AbstractMesh[] = [], metals: PBRMaterial[] = [], pieces: Piece[] = [], doors: AbstractMesh[] = [];
  let n = 0; const nm = (k: string) => k + '-' + (n++);
  const ok = (h: string, d: string) => /^#[0-9a-f]{6}$/i.test(h || '') ? h : d; c1 = ok(c1, '#1C3A8A'); c2 = ok(c2, '#3FD3E6');
  const tex = (c: HTMLCanvasElement, u = 1, v = 1): DynamicTexture => { const t = new DynamicTexture(nm('t'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: string; tex?: Texture; metal?: number; rough?: number; emis?: string; emisK?: number; alpha?: number; coat?: boolean }): PBRMaterial => {
    const m = new PBRMaterial(nm('m'), sc); m.maxSimultaneousLights = 6; m.albedoColor = o.col ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex;
    m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.5; if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis).scale(o.emisK || 1);
    if (o.alpha != null) { m.alpha = o.alpha; m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; } if (o.coat) { m.clearCoat.isEnabled = true; m.clearCoat.intensity = 0.8; m.clearCoat.roughness = 0.05; }
    if ((o.metal || 0) >= 0.6 || o.coat) metals.push(m); return m; };
  const glowM = (col: string, k = 1.6) => { const m = new StandardMaterial(nm('gl'), sc); m.emissiveColor = Color3.FromHexString(col).scale(k); m.disableLighting = true; return m; };
  const put = (m: AbstractMesh, mat: any, x: number, y: number, z: number, parent: TransformNode = root, cast = true) => { m.position.set(x, y, z); (m as Mesh).material = mat; m.receiveShadows = true; m.parent = parent; if (cast) casters.push(m); return m; };
  const cyl = (rt: number, rb: number, h: number, mat: any, x: number, y: number, z: number, p?: TransformNode, seg = 40) => put(MeshBuilder.CreateCylinder(nm('c'), { diameterTop: rt * 2, diameterBottom: rb * 2, height: h, tessellation: seg }, sc), mat, x, y, z, p);
  const box = (w: number, h: number, d: number, mat: any, x: number, y: number, z: number, p?: TransformNode) => put(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, sc), mat, x, y, z, p);
  const white = pbr({ col: '#EEF1F5', rough: 0.12, coat: true }), whiteSoft = pbr({ col: '#E4E8EE', rough: 0.3 }), gold = pbr({ col: '#D4AF37', metal: 1, rough: 0.22 }), black = pbr({ col: '#0E1116', rough: 0.12, metal: 0.3, coat: true });
  const glass = pbr({ col: '#DDEBF6', rough: 0.02, metal: 0.1, alpha: 0.14 }); glass.backFaceCulling = false;
  const lineW = glowM('#E9F6FF', 1.8), lineC = glowM(c2, 1.4);

  // ---- the shell: one white high-gloss surface from the floor to the skylight ----
  { const NT = IS_PC ? 160 : 112, NU = 28, pos: number[] = [], idx: number[] = [], uv: number[] = [];
    for (let i = 0; i <= NT; i++) for (let j = 0; j <= NU; j++) { const p = shell(i / NT * Math.PI * 2, j / NU); pos.push(p.x, p.y, p.z); uv.push(i / NT, j / NU); }
    for (let i = 0; i < NT; i++) for (let j = 0; j < NU; j++) { const tc = (i + 0.5) / NT * Math.PI * 2, uc = (j + 0.5) / NU; if (Math.abs(tc - Math.PI / 2) < DOOR_T && uc < DOOR_U) continue;   // the entrance's opening
      const a = i * (NU + 1) + j, b = a + NU + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const m = new Mesh(nm('shell'), sc), vd = new VertexData(), nr: number[] = []; vd.positions = pos; vd.indices = idx; vd.uvs = uv; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
    const sm = pbr({ col: '#DCE2EA', rough: 0.16, coat: true }); sm.backFaceCulling = false; sm.twoSidedLighting = true; m.material = sm; m.parent = root; m.receiveShadows = true; }
  // ---- the 64 ribs following its curve, lines of light along every other one, and the rings of light ----
  { const ribs: Mesh[] = [], lights: Mesh[] = [];
    for (let i = 0; i < NR; i++) { const t = i / NR * Math.PI * 2, path: Vector3[] = []; const u0 = Math.abs(t - Math.PI / 2) < DOOR_T + 0.02 ? DOOR_U + 0.01 : 0; for (let j = 0; j <= 30; j++) path.push(shell(t, u0 + (0.985 - u0) * j / 30, 0.012));
      ribs.push(MeshBuilder.CreateTube(nm('rib'), { path, radius: 0.085, tessellation: 6 }, sc));
      if (i % 2 === 0) { const lp = path.map(p => p.scale(0.996)); lights.push(MeshBuilder.CreateTube(nm('ribL'), { path: lp, radius: 0.022, tessellation: 4 }, sc)); } }
    const rm = Mesh.MergeMeshes(ribs, true, true); if (rm) { rm.material = whiteSoft; rm.parent = root; }
    for (const y of [1.0, 6.4, 7.9]) { const k = kAt(y) - 0.01, gap = y < 3.2 ? DOOR_T + 0.04 : 0, t0 = Math.PI / 2 + gap, t1 = Math.PI / 2 + Math.PI * 2 - gap, path: Vector3[] = []; for (let i = 0; i <= 160; i++) { const t = t0 + (t1 - t0) * i / 160; path.push(new Vector3(A * k * Math.cos(t), y, B * k * Math.sin(t))); } lights.push(MeshBuilder.CreateTube(nm('ring'), { path, radius: 0.03, tessellation: 4 }, sc)); }
    const lm = Mesh.MergeMeshes(lights, true, true); if (lm) { lm.material = lineW; lm.parent = root; } }
  // ---- the oval skylight: the sky with soft clouds, its glowing rim ----
  { const [c, x] = P.canvas(1024, 1024), r = P.rng(31); const g = x.createRadialGradient(512, 512, 40, 512, 512, 520); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.5, '#D6EEFB'); g.addColorStop(1, '#9FD2F2'); x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 16; i++) { x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(r() * 1024, r() * 1024, 60 + r() * 140, 20 + r() * 40, r() * 3, 0, 7); x.fill(); }
    const k = KS + 0.005, d = MeshBuilder.CreateDisc(nm('sky'), { radius: 1, tessellation: 96 }, sc); d.rotation.x = -Math.PI / 2; d.scaling.set(A * k, B * k, 1); d.position.y = H - 0.02; const sm = new StandardMaterial(nm('skyM'), sc); sm.emissiveTexture = tex(c); sm.disableLighting = true; sm.backFaceCulling = false; d.material = sm; d.parent = root;
    const rim: Vector3[] = []; for (let i = 0; i <= 160; i++) { const t = i / 160 * Math.PI * 2; rim.push(new Vector3(A * k * Math.cos(t), H - 0.05, B * k * Math.sin(t))); } const rt = MeshBuilder.CreateTube(nm('rim'), { path: rim, radius: 0.09, tessellation: 6 }, sc); rt.material = glowM('#FFFFFF', 2.2); rt.parent = root; }
  // ---- the gallery ribbon at 4.4 m: its deck, the glass balustrade, light along its edges ----
  { const k0 = kAt(GAL) - 0.005, k1 = k0 - 0.075, NT = 140, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= NT; i++) { const t = i / NT * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); pos.push(A * k0 * c, GAL, B * k0 * s, A * k1 * c, GAL, B * k1 * s, A * k0 * c, GAL - 0.32, B * k0 * s, A * k1 * c, GAL - 0.32, B * k1 * s); }
    for (let i = 0; i < NT; i++) { const a = i * 4, b = a + 4; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2, a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); }
    const m = new Mesh(nm('gallery'), sc), vd = new VertexData(), nr: number[] = []; vd.positions = pos; vd.indices = idx; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m); const gm = pbr({ col: '#E8ECF1', rough: 0.25, coat: true }); gm.backFaceCulling = false; gm.twoSidedLighting = true; m.material = gm; m.parent = root; casters.push(m);
    const edge = (k: number, y: number, r: number, mat: any) => { const path: Vector3[] = []; for (let i = 0; i <= 160; i++) { const t = i / 160 * Math.PI * 2; path.push(new Vector3(A * k * Math.cos(t), y, B * k * Math.sin(t))); } const tb = MeshBuilder.CreateTube(nm('edge'), { path, radius: r, tessellation: 5 }, sc); tb.material = mat; tb.parent = root; return tb; };
    edge(k1, GAL - 0.33, 0.03, lineW); edge(k1, GAL + 1.05, 0.025, lineW); edge(k1, GAL + 0.02, 0.02, lineC);
    const gp: number[] = [], gi: number[] = []; for (let i = 0; i <= NT; i++) { const t = i / NT * Math.PI * 2; gp.push(A * k1 * Math.cos(t), GAL, B * k1 * Math.sin(t), A * k1 * Math.cos(t), GAL + 1.05, B * k1 * Math.sin(t)); } for (let i = 0; i < NT; i++) { const a = i * 2; gi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const gl = new Mesh(nm('balustrade'), sc), gv = new VertexData(), gn: number[] = []; gv.positions = gp; gv.indices = gi; VertexData.ComputeNormals(gp, gi, gn); gv.normals = gn; gv.applyToMesh(gl); gl.material = glass; gl.parent = root; }
  // ---- the floor: glossy, with lines of light flowing in from the entrance ----
  { const N2 = IS_PC ? 2048 : 1536, [c, x] = P.canvas(N2, Math.round(N2 * B / A)), W2 = c.width, H2 = c.height, X = (e: number) => (e / (2 * A) + 0.5) * W2, Z = (z: number) => (0.5 - z / (2 * B)) * H2;
    const [ce, xe] = P.canvas(W2, H2); x.fillStyle = '#D9DDE3'; x.fillRect(0, 0, W2, H2); xe.fillStyle = '#000'; xe.fillRect(0, 0, W2, H2);
    const stroke = (f: (x: CanvasRenderingContext2D) => void, w: number) => { for (const [g, col] of [[x, 'rgba(255,255,255,.95)'], [xe, '#FFFFFF']] as [CanvasRenderingContext2D, string][]) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); f(g); g.stroke(); } };
    // the flowing lines: from the entrance, round the centrepiece, out to the display walls
    for (const s of [-1, 1]) for (const k of [0, 1]) stroke(g => { g.moveTo(X(s * 0.8), Z(B)); g.bezierCurveTo(X(s * (2 + k * 2)), Z(6), X(s * (7 + k * 3)), Z(5 - k), X(s * (5 + k * 6)), Z(-1.5 - k * 2)); }, 5);
    stroke(g => { g.ellipse(X(0), Z(0), (A * 0.56) / (2 * A) * W2, (B * 0.56) / (2 * B) * H2, 0, 0, Math.PI * 2); }, 4);
    stroke(g => { g.ellipse(X(0), Z(0), (A * 0.86) / (2 * A) * W2, (B * 0.86) / (2 * B) * H2, 0, 0, Math.PI * 2); }, 3);
    // the rib shadows' rhythm: faint radial lines set in the floor
    x.strokeStyle = 'rgba(160,170,184,.35)'; x.lineWidth = 2; for (let i = 0; i < NR; i++) { const t = i / NR * Math.PI * 2; x.beginPath(); x.moveTo(X(Math.cos(t) * A * 0.6), Z(Math.sin(t) * B * 0.6)); x.lineTo(X(Math.cos(t) * A * 0.98), Z(Math.sin(t) * B * 0.98)); x.stroke(); }
    const f = MeshBuilder.CreateDisc(nm('floor'), { radius: 1, tessellation: 128 }, sc); f.rotation.x = Math.PI / 2; f.scaling.set(A, B, 1); f.parent = root;
    const fm = pbr({ tex: tex(c), rough: 0.07, coat: true }); fm.emissiveTexture = tex(ce); fm.emissiveColor = new Color3(0.85, 0.95, 1); fm.environmentIntensity = 1.1; f.material = fm; f.receiveShadows = true; }
  // ---- the centrepiece: the dark plinth with its rings of light, the beam, the airliner hovering at 3.6 m ----
  const plane = new TransformNode(nm('centre'), sc); plane.parent = root;
  { cyl(2.45, 2.65, 0.5, black, 0, 0.25, 0); cyl(2.3, 2.3, 0.02, pbr({ col: '#0A1A22', rough: 0.05, coat: true }), 0, 0.51, 0);
    for (const r of [2.15, 1.45]) { const t = MeshBuilder.CreateTorus(nm('ring'), { diameter: r * 2, thickness: 0.05, tessellation: 96 }, sc); t.position.y = 0.53; t.material = glowM('#5FF3FF', 2); t.parent = root; }
    const beam = MeshBuilder.CreateCylinder(nm('beam'), { diameterTop: 2.2, diameterBottom: 3.6, height: 3.0, tessellation: 40 }, sc); beam.position.y = 2.0; const bm = new StandardMaterial(nm('beamM'), sc); bm.emissiveColor = new Color3(0.75, 0.92, 1); bm.alpha = 0.07; bm.disableLighting = true; bm.backFaceCulling = false; beam.material = bm; beam.parent = root;
    circles.push([0, 0, 2.8]);
    try { const ac = buildAirliner(sc); repaint(ac, c1, c2); setGear(ac, 0); ac.root.parent = plane; ac.root.scaling.setAll(0.27); plane.position.set(0, 3.6, 0); plane.rotation.set(0, -0.6, 0); ac.root.rotation.set(-0.06, 0, -0.12);
      for (const m of [...ac.strobes, ...ac.beacons]) m.setEnabled(false); ac.root.getChildMeshes().forEach(m => { casters.push(m); m.receiveShadows = true; });
      const rod = cyl(0.015, 0.015, H - 3.9, pbr({ col: '#2A4A9A', metal: 0.8, rough: 0.3 }), 0, 3.9 + (H - 3.9) / 2, 0); void rod; } catch (e) { /* the plinth alone */ }
    const sp = new SpotLight(nm('spot'), new Vector3(0, 0.6, 0), new Vector3(0, 1, 0), 0.9, 2, sc); sp.parent = root; sp.intensity = 40; sp.range = 8; sp.diffuse = Color3.FromHexString('#DFF6FF'); }
  // ---- the curved display walls, each with backlit niches ----
  const niches: { x: number; z: number; nx: number; nz: number }[] = [];
  const arc = (cx: number, cz: number, R: number, a0: number, a1: number, ny: number) => {
    const seg = 18, th = 0.32, hh = 3.6, mats = whiteSoft;
    for (let i = 0; i < seg; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / seg, len = Math.abs(a1 - a0) * R / seg + 0.03, x = cx + R * Math.cos(a), z = cz + R * Math.sin(a);
      const b = box(len, hh, th, mats, x, hh / 2, z); b.rotation.y = -(a + Math.PI / 2); blocks.push([x - 0.35, z - 0.35, x + 0.35, z + 0.35]); }
    const capT: Vector3[] = []; for (let i = 0; i <= 40; i++) { const a = a0 + (a1 - a0) * i / 40; capT.push(new Vector3(cx + (R - th / 2 * ny) * Math.cos(a), hh + 0.01, cz + (R - th / 2 * ny) * Math.sin(a))); }
    const cl = MeshBuilder.CreateTube(nm('capL'), { path: capT, radius: 0.025, tessellation: 4 }, sc); cl.material = lineW; cl.parent = root;
    for (const f of [0.25, 0.5, 0.75]) { const a = a0 + (a1 - a0) * f, x = cx + (R - ny * (th / 2 + 0.02)) * Math.cos(a), z = cz + (R - ny * (th / 2 + 0.02)) * Math.sin(a), nx = -ny * Math.cos(a), nz = -ny * Math.sin(a);
      const pl = MeshBuilder.CreatePlane(nm('niche'), { width: 1.2, height: 1.6 }, sc); pl.position.set(x, 1.75, z); pl.rotation.y = Math.atan2(-nx, -nz); pl.material = glowM('#F4FAFF', 1.1); pl.parent = root;
      niches.push({ x: x + nx * 0.25, z: z + nz * 0.25, nx, nz }); }
  };
  arc(0, 7, 14, -115 * Math.PI / 180, -65 * Math.PI / 180, 1);           // the north wall, facing the centrepiece
  arc(-7, 3.5, 4.2, 200 * Math.PI / 180, 330 * Math.PI / 180, -1);       // the west wall
  arc(7, 3.5, 4.2, 210 * Math.PI / 180, 340 * Math.PI / 180, -1);        // the east wall
  // ---- the pieces: pedestals 1–8 with glass domes, then the niches, then more pedestals round the hall ----
  const plate = (title: string, sub: string) => { const [c, x] = P.canvas(512, 160); const g = x.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, '#F4F6F9'); g.addColorStop(1, '#D6DCE4'); x.fillStyle = g; x.fillRect(0, 0, 512, 160); x.fillStyle = '#1A2230'; x.textAlign = 'center'; x.font = '700 38px Arial, sans-serif'; x.fillText(title.slice(0, 26), 256, 68); x.font = '500 26px Arial, sans-serif'; x.fillText(sub.slice(0, 36), 256, 116); return c; };
  const ped8: [number, number][] = [[-9.5, -3.4], [-12.2, 1.6], [-3.4, -3.6], [3.4, -3.6], [9.6, -3.0], [11.5, 1.0], [-4.2, 6.4], [4.6, 6.6]];
  const extra: [number, number][] = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * Math.PI * 2 + 0.13; if (Math.abs(((t + Math.PI * 2) % (Math.PI * 2)) - Math.PI / 2) < 0.5) continue; const x = 12.6 * Math.cos(t), z = 7.9 * Math.sin(t); if (ped8.some(p => Math.hypot(p[0] - x, p[1] - z) < 2.2)) continue; extra.push([x, z]); }
  const slots: { x: number; z: number; niche?: { nx: number; nz: number } }[] = [...ped8.map(p => ({ x: p[0], z: p[1] })), ...niches.map(q => ({ x: q.x, z: q.z, niche: { nx: q.nx, nz: q.nz } })), ...extra.map(p => ({ x: p[0], z: p[1] }))];
  items.slice(0, slots.length).forEach((e, i) => {
    const s = slots[i], node = new TransformNode(nm('piece'), sc); node.parent = root;
    if (s.niche) { box(0.9, 0.06, 0.45, whiteSoft, s.x - s.niche.nx * 0.05, 1.08, s.z - s.niche.nz * 0.05).rotation.y = Math.atan2(s.niche.nx, s.niche.nz); node.position.set(s.x, 1.12, s.z); node.rotation.y = Math.atan2(s.niche.nx, s.niche.nz) + Math.PI; }
    else {
      cyl(0.46, 0.52, 1.0, white, s.x, 0.5, s.z); const rg = MeshBuilder.CreateTorus(nm('pring'), { diameter: 0.92, thickness: 0.03, tessellation: 48 }, sc); rg.position.set(s.x, 1.0, s.z); rg.material = lineW; rg.parent = root;
      circles.push([s.x, s.z, 0.62]); node.position.set(s.x, 1.02, s.z); node.rotation.y = Math.atan2(-s.x, -s.z) + Math.PI;
      const dome = MeshBuilder.CreateCapsule(nm('dome'), { radius: 0.42, height: 1.2, tessellation: 24 }, sc); dome.position.set(s.x, 1.02 + 0.6, s.z); dome.material = glass; dome.parent = root; dome.isPickable = false;
      const pl = MeshBuilder.CreatePlane(nm('plate'), { width: 0.56, height: 0.17 }, sc); const toC = Math.atan2(-s.x, -s.z); pl.position.set(s.x + Math.sin(toC) * 0.53, 0.78, s.z + Math.cos(toC) * 0.53); pl.rotation.y = toC + Math.PI; const pm = new StandardMaterial(nm('pm'), sc); pm.diffuseTexture = tex(plate(e.title, e.sub)); pm.emissiveColor = new Color3(0.35, 0.35, 0.35); pl.material = pm; pl.parent = root; }
    buildPiece(e, node);
    node.getChildMeshes().forEach(m => { m.metadata = { act: 'piece', i }; m.isPickable = true; });
    const toC = s.niche ? null : Math.hypot(s.x, s.z) || 1;
    const at = s.niche ? new Vector3(s.x + s.niche.nx * 1.6, 0, s.z + s.niche.nz * 1.6) : new Vector3(s.x - s.x / (toC as number) * 1.6, 0, s.z - s.z / (toC as number) * 1.6);
    pieces.push({ e, node, at });
  });
  // ---- the light: the skylight's daylight, warm and cool washes on the shell ----
  for (const [x, z, col, k] of [[-8, -2, '#9FC8FF', 1.6], [8, -2, '#FFD9AE', 1.6], [0, 5, '#FFFFFF', 1.2]] as [number, number, string, number][]) { const l = new PointLight(nm('mL'), new Vector3(x, 6.5, z), sc); l.parent = root; l.intensity = k; l.range = 26; l.diffuse = Color3.FromHexString(col); }
  // ---- the entrance from the concourse: a portal with a glowing arch and sliding glass doors, the name over it ----
  const DW = 2.4, DH = 3.0, zf = B;
  { const frame = pbr({ col: '#F2F5F8', rough: 0.15, coat: true });
    for (const s of [-1, 1]) { box(0.45, DH + 0.5, 0.7, frame, s * (DW / 2 + 0.22), (DH + 0.5) / 2, zf + 0.2); const st = box(0.05, DH + 0.3, 0.05, lineC, s * (DW / 2 + 0.01), (DH + 0.3) / 2, zf + 0.56); void st; }
    // the arch over it: a half ring of light
    const arch: Vector3[] = []; for (let i = 0; i <= 48; i++) { const a = Math.PI * i / 48; arch.push(new Vector3(Math.cos(a) * (DW / 2 + 0.45), DH + 0.5 + Math.sin(a) * 1.3, zf + 0.58)); }
    const at2 = MeshBuilder.CreateTube(nm('arch'), { path: arch, radius: 0.07, tessellation: 8 }, sc); at2.material = glowM('#FFFFFF', 2.2); at2.parent = root;
    const arch2 = arch.map(p => new Vector3(p.x * 0.86, DH + 0.5 + (p.y - DH - 0.5) * 0.82, p.z)); const at3 = MeshBuilder.CreateTube(nm('arch2'), { path: arch2, radius: 0.035, tessellation: 6 }, sc); at3.material = glowM(c2, 1.8); at3.parent = root;
    box(DW + 1.4, 0.5, 0.7, frame, 0, DH + 0.25, zf + 0.2);
    const sign = new StandardMaterial(nm('sign'), sc); sign.diffuseTexture = tex(P.sign(`${name} museum`, '#0B1220', '#E9F6FF', 1280, 200, '700 90px Arial, sans-serif')); sign.emissiveColor = new Color3(0.8, 0.8, 0.8);
    const sp2 = MeshBuilder.CreatePlane(nm('signP'), { width: 3.4, height: 0.53 }, sc); sp2.position.set(0, DH + 1.05, zf + 0.6); sp2.rotation.y = Math.PI; sp2.material = sign; sp2.parent = root;
    const sub = new StandardMaterial(nm('sub'), sc); sub.diffuseTexture = tex(P.sign('VORTEX GALLERY', '#0B1220', '#5FF3FF', 1024, 140, '700 70px Arial, sans-serif')); sub.emissiveColor = new Color3(0.8, 0.8, 0.8);
    const sp3 = MeshBuilder.CreatePlane(nm('subP'), { width: 2.6, height: 0.36 }, sc); sp3.position.set(0, DH + 0.27, zf + 0.56); sp3.rotation.y = Math.PI; sp3.material = sub; sp3.parent = root;
    // the doors: two glass leaves with lines of light, sliding apart
    for (const s of [-1, 1]) { const d = box(DW / 2 - 0.02, DH - 0.04, 0.05, glass, s * DW / 4, (DH - 0.04) / 2, zf + 0.3); d.metadata = { act: 'museumdoor' }; d.isPickable = true;
      const strip = box(0.03, DH - 0.2, 0.06, lineW, s * (DW / 2 - 0.12) - s * DW / 4, 0, 0, d as any); strip.position.set(-s * (DW / 4 - 0.1), 0, 0); doors.push(d); }
    // the threshold's line of light on both sides
    box(DW + 0.6, 0.02, 0.1, lineC, 0, 0.01, zf + 0.6); }
  root.getChildMeshes().forEach(m => { if (!(m.metadata && m.metadata.act)) m.isPickable = false; });
  return { root, W: 2 * A, D: 2 * B, blocks, circles, casters, metals, pieces, doors, doorBase: doors.map(d => d.position.clone()), plane };

  /** Each kind of piece, made from simple shapes (in metres, standing at 0). */
  function buildPiece(e: Exhibit, p: TransformNode) {
    const c = e.color && /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : '#6FB3D9';
    const disc = (r: number, h: number, m: any, y: number) => cyl(r, r, h, m, 0, y, 0, p);
    switch (e.kind) {
      case 'model': { try { const ac = buildAirliner(sc); repaint(ac, c1, c2); ac.root.parent = p; ac.root.scaling.setAll(0.014); ac.root.position.set(0, 0.42, 0); ac.root.rotation.y = 0.7; for (const m of [...ac.strobes, ...ac.beacons, ...ac.navs, ...ac.logo]) m.setEnabled(false); for (const g of ac.gear) g.setEnabled(false); cyl(0.006, 0.006, 0.36, gold, 0, 0.18, 0, p); disc(0.12, 0.03, black, 0.015); } catch (er) { box(0.4, 0.1, 0.1, gold, 0, 0.1, 0, p); } return; }
      case 'plaque': case 'cert': { const [cv, x] = P.canvas(512, 384); x.fillStyle = e.kind === 'cert' ? '#F6F1E4' : '#5A3A22'; x.fillRect(0, 0, 512, 384); x.strokeStyle = e.kind === 'cert' ? (e.color || '#8A6A2A') : '#D4AF37'; x.lineWidth = 12; x.strokeRect(16, 16, 480, 352); x.fillStyle = e.kind === 'cert' ? '#2A2014' : '#E8C878'; x.textAlign = 'center';
        (e.lines && e.lines.length ? e.lines : [e.title]).slice(0, 5).forEach((l, k) => { x.font = `${k === 1 ? 700 : 500} ${k === 1 ? 40 : 26}px Georgia, serif`; x.fillText(String(l).slice(0, 30), 256, 90 + k * 56); });
        const fr = box(0.62, 0.48, 0.04, black, 0, 0.36, 0, p); fr.rotation.x = -0.18; const face = MeshBuilder.CreatePlane(nm('face'), { width: 0.56, height: 0.42 }, sc); face.parent = fr; face.position.z = 0.025; face.rotation.y = Math.PI; const fm = new StandardMaterial(nm('fm'), sc); fm.diffuseTexture = tex(cv); fm.emissiveColor = new Color3(0.25, 0.25, 0.25); face.material = fm; casters.push(face); box(0.12, 0.3, 0.04, black, 0, 0.15, 0.12, p); return; }
      case 'medal': case 'badge': { const tc = e.kind === 'badge' ? TIER[Math.max(0, Math.min(5, e.tier || 0))] : '#E2B84A'; const m = pbr({ col: tc, metal: 1, rough: 0.22 }); const d = cyl(0.13, 0.13, 0.02, m, 0, 0.34, 0, p); d.rotation.x = Math.PI / 2; const r2 = cyl(0.09, 0.09, 0.024, pbr({ col: tc, metal: 1, rough: 0.4 }), 0, 0.34, -0.003, p); r2.rotation.x = Math.PI / 2;
        box(0.1, 0.22, 0.01, pbr({ col: c1, rough: 0.6 }), 0, 0.56, 0.01, p); box(0.36, 0.5, 0.06, black, 0, 0.25, 0.06, p); return; }
      case 'vase': { const sh = [[0, 0], [0.09, 0], [0.13, 0.08], [0.15, 0.2], [0.1, 0.34], [0.07, 0.42], [0.09, 0.46]].map(q => new Vector3(q[0], q[1], 0)); const v = MeshBuilder.CreateLathe(nm('vase'), { shape: sh, tessellation: 40, sideOrientation: Mesh.DOUBLESIDE }, sc); put(v, pbr({ col: c, rough: 0.12, metal: 0.05 }), 0, 0, 0, p); return; }
      case 'dish': { const d = cyl(0.26, 0.2, 0.04, pbr({ col: c, rough: 0.15 }), 0, 0.2, 0, p); d.rotation.x = -1.1; box(0.1, 0.2, 0.06, black, 0, 0.08, 0.06, p); return; }
      case 'tin': { cyl(0.12, 0.12, 0.2, pbr({ col: c, rough: 0.3, metal: 0.6 }), 0, 0.1, 0, p); cyl(0.125, 0.125, 0.02, gold, 0, 0.205, 0, p); return; }
      case 'book': { box(0.26, 0.05, 0.34, pbr({ col: c, rough: 0.5 }), 0, 0.03, 0, p); box(0.25, 0.04, 0.33, pbr({ col: '#F4EFD9', rough: 0.8 }), 0.004, 0.032, 0, p); return; }
      case 'jumper': { box(0.36, 0.08, 0.3, pbr({ tex: tex(P.noise(c, 30, 4)), rough: 0.95 }), 0, 0.04, 0, p); return; }
      case 'carving': { const w = pbr({ col: c, rough: 0.7 }); cyl(0.07, 0.1, 0.26, w, 0, 0.13, 0, p, 9); put(MeshBuilder.CreateSphere(nm('h'), { diameter: 0.14, segments: 8 }, sc), w, 0, 0.32, 0, p); return; }
      case 'trophy': default: {
        // a trophy cup: a gold bowl on a stem over a dark foot (the renders' cups)
        if (e.kind === 'frame') { const fr = box(0.5, 0.4, 0.04, gold, 0, 0.3, 0, p); fr.rotation.x = -0.15; const face = MeshBuilder.CreatePlane(nm('ph'), { width: 0.44, height: 0.34 }, sc); face.parent = fr; face.position.z = 0.025; face.rotation.y = Math.PI; const fm = new StandardMaterial(nm('fm'), sc); fm.diffuseTexture = tex(P.view()); fm.emissiveColor = new Color3(0.2, 0.2, 0.2); face.material = fm; box(0.1, 0.25, 0.04, black, 0, 0.12, 0.1, p); return; }
        const sh = [[0, 0], [0.11, 0], [0.12, 0.03], [0.04, 0.06], [0.03, 0.22], [0.05, 0.26], [0.17, 0.32], [0.19, 0.5], [0.17, 0.5]].map(q => new Vector3(q[0], q[1], 0));
        const cup = MeshBuilder.CreateLathe(nm('cup'), { shape: sh, tessellation: 40, sideOrientation: Mesh.DOUBLESIDE }, sc); put(cup, gold, 0, 0, 0, p); disc(0.12, 0.04, black, 0.02); }
    }
  }
}
/** Can you stand at (x, z) in the museum's coordinates: inside the oval, clear of the plinths, pedestals and walls? */
export function museumBlocked(M: Museum, x: number, z: number): boolean {
  if (z > B - 0.25 && Math.abs(x) < 1.1) return false;   // the entrance
  if ((x / (A - 0.9)) ** 2 + (z / (B - 0.75)) ** 2 > 1) return true;
  for (const c of M.circles) if (Math.hypot(x - c[0], z - c[1]) < c[2] + 0.25) return true;
  for (const b of M.blocks) if (x > b[0] - 0.05 && x < b[2] + 0.05 && z > b[1] - 0.05 && z < b[3] + 0.05) return true;
  return false;
}
