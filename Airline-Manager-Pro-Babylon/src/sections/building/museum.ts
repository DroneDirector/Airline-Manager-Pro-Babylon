// Your museum, in the joined building, off the concourse's west wall: a hall where everything your airline and you have
// been given or earned stands on display, each on its own plinth with a ring of light and a brass name plate: the gifts
// and plaques from the airports (models, plaques, vases, dishes, books, carvings, certificates, medals…), your career
// awards and your best badges as medals. Tap a piece (or Enter / Cross in front of it) to take it in your hands and
// turn it round; the Collection list shows everything, and takes you to any piece. Our own shapes and textures.
// The museum's own coordinates: x across, z from the back wall to the doors (z = D / 2); its floor's middle at 0.
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, PointLight } from '@babylonjs/core';
import * as P from '../lounge/pictures';
import { buildAirliner, repaint } from '../viewer3d/airliner';

export interface Exhibit { title: string; sub: string; kind: string; color?: string; lines?: string[]; tier?: number }
export interface Piece { e: Exhibit; node: TransformNode; at: Vector3 }   // at: in the museum's coordinates, where you stand to look at it
export interface Museum { root: TransformNode; W: number; D: number; blocks: number[][]; casters: AbstractMesh[]; metals: PBRMaterial[]; pieces: Piece[]; doors: AbstractMesh[] }
const TIER = ['#B07A45', '#C9CED6', '#E2B84A', '#DDE6EE', '#BFEFFF', '#FF6FD8'];

export function museumSize(n: number): { W: number; D: number; cols: number; rows: number } {
  const cols = Math.max(3, Math.min(6, Math.ceil(Math.sqrt(n || 1)))), rows = Math.max(2, Math.ceil((n || 1) / cols));
  return { W: Math.max(14, cols * 4.2 + 6), D: Math.max(14, rows * 4.6 + 8), cols, rows };
}

export function buildMuseum(sc: Scene, items: Exhibit[], c1: string, c2: string, name: string): Museum {
  const root = new TransformNode('museum', sc), blocks: number[][] = [], casters: AbstractMesh[] = [], metals: PBRMaterial[] = [], pieces: Piece[] = [], doors: AbstractMesh[] = [];
  let n = 0; const nm = (k: string) => k + '-' + (n++);
  const { W, D, cols } = museumSize(items.length), H = 5;
  const tex = (c: HTMLCanvasElement, u = 1, v = 1): DynamicTexture => { const t = new DynamicTexture(nm('t'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: string; tex?: Texture; metal?: number; rough?: number; emis?: string; emisK?: number }): PBRMaterial => {
    const m = new PBRMaterial(nm('m'), sc); m.maxSimultaneousLights = 6; m.albedoColor = o.col && /^#[0-9a-f]{6}$/i.test(o.col) ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex;
    m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6; if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis).scale(o.emisK || 1); if ((o.metal || 0) >= 0.6) metals.push(m); return m; };
  const at = (m: AbstractMesh, mat: any, x: number, y: number, z: number, parent: TransformNode = root, act?: string) => { m.position.set(x, y, z); (m as Mesh).material = mat; m.receiveShadows = true; m.parent = parent; casters.push(m); if (act) m.metadata = { act }; return m; };
  const box = (w: number, h: number, d: number, mat: any, x: number, y: number, z: number, p?: TransformNode, act?: string) => at(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, sc), mat, x, y, z, p, act);
  const cyl = (rt: number, rb: number, h: number, mat: any, x: number, y: number, z: number, p?: TransformNode, seg = 32) => at(MeshBuilder.CreateCylinder(nm('c'), { diameterTop: rt * 2, diameterBottom: rb * 2, height: h, tessellation: seg }, sc), mat, x, y, z, p);
  const flat = (w: number, h: number, mat: any, x: number, y: number, z: number, ry: number) => { const p = MeshBuilder.CreatePlane(nm('p'), { width: w, height: h }, sc); p.position.set(x, y, z); p.rotation.y = ry; p.material = mat; p.parent = root; return p; };
  const picMat = (c: HTMLCanvasElement, k = 0.3) => { const m = new StandardMaterial(nm('pm'), sc); const t = tex(c); m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new Color3(k, k, k); m.specularColor = new Color3(0.1, 0.1, 0.1); return m; };
  // the hall: a polished dark floor, soft grey walls, light strips in the ceiling; the doors in the front wall
  const floor = MeshBuilder.CreateGround(nm('floor'), { width: W, height: D }, sc); floor.parent = root; const fm = pbr({ tex: tex(P.darkMarble(), W / 4, D / 4), rough: 0.16 }); fm.environmentIntensity = 1; floor.material = fm; floor.receiveShadows = true;
  { const c = MeshBuilder.CreatePlane(nm('ceil'), { width: W, height: D }, sc); c.rotation.x = -Math.PI / 2; c.position.y = H; c.material = pbr({ col: '#2A2E36', rough: 0.9 }); c.parent = root; }
  const wallM = pbr({ tex: tex(P.plaster('#B9BDC4'), 3, 1), rough: 0.85 }), gold = pbr({ col: '#D4AF37', metal: 1, rough: 0.25 }), plinthM = pbr({ col: '#ECEAE4', rough: 0.35 }), darkM = pbr({ col: '#1A1D22', rough: 0.4, metal: 0.4 });
  flat(W, H, wallM, 0, H / 2, -D / 2, Math.PI); flat(D, H, wallM, -W / 2, H / 2, 0, -Math.PI / 2); flat(D, H, wallM, W / 2, H / 2, 0, Math.PI / 2);
  const DW = 1.8, DH = 2.6;
  flat((W - DW) / 2, H, wallM, -(DW / 2 + (W - DW) / 4), H / 2, D / 2, 0); flat((W - DW) / 2, H, wallM, DW / 2 + (W - DW) / 4, H / 2, D / 2, 0); flat(DW, H - DH, wallM, 0, DH + (H - DH) / 2, D / 2, 0);
  // the museum's name inside, over the doors; a strip of the company's colours along the walls
  flat(4.6, 0.7, picMat(P.sign(`${name} museum`, '#14161B', '#E2C27A', 1280, 192, '700 84px Georgia, serif'), 0.7), 0, DH + 0.9, D / 2 - 0.02, 0);
  for (const [w, x, z, ry] of [[W, 0, -D / 2 + 0.01, Math.PI], [D, -W / 2 + 0.01, 0, -Math.PI / 2], [D, W / 2 - 0.01, 0, Math.PI / 2]] as number[][]) { const s = flat(w, 0.06, pbr({ col: c1, emis: c1, emisK: 0.5 }), x, 3.6, z, ry); void s; }
  for (let x = -W / 2 + 3; x < W / 2; x += 6) box(0.3, 0.03, D - 3, pbr({ col: '#FFFFFF', emis: '#FFF6E8', emisK: 1.3 }), x, H - 0.02, 0);
  for (const [x, z] of [[-W / 4, 0], [W / 4, 0]]) { const l = new PointLight(nm('mL'), new Vector3(x, H - 0.8, z), sc); l.parent = root; l.intensity = 2.2; l.range = Math.max(W, D); l.diffuse = Color3.FromHexString('#FFF3E2'); }
  // the double doors (they swing in), shut
  for (const s of [-1, 1]) { const d = box(DW / 2 - 0.03, DH - 0.02, 0.06, pbr({ col: '#3A2416', rough: 0.4 }), s * DW / 4, DH / 2, D / 2 - 0.03, root, 'museumdoor'); box(0.04, 0.5, 0.06, gold, s * 0.12, DH * 0.45, D / 2 - 0.08, d as any); (d.getChildren()[0] as any).position.set(-s * (DW / 4 - 0.12), 0, -0.05); doors.push(d); }
  // the pieces on their plinths, in rows, each with a ring of light and its brass name plate
  const plate = (title: string, sub: string) => { const [c, x] = P.canvas(512, 160); const g = x.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, '#E8C878'); g.addColorStop(1, '#A8823A'); x.fillStyle = g; x.fillRect(0, 0, 512, 160); x.fillStyle = '#2A1E0A'; x.textAlign = 'center'; x.font = '700 40px Georgia, serif'; x.fillText(title.slice(0, 24), 256, 70); x.font = '500 28px Georgia, serif'; x.fillText(sub.slice(0, 34), 256, 118); return c; };
  items.forEach((e, i) => {
    const col = i % cols, row = Math.floor(i / cols), x = (col - (cols - 1) / 2) * 4.2, z = -D / 2 + 4 + row * 4.6;
    box(1.1, 1.0, 1.1, plinthM, x, 0.5, z); const ring = cyl(0.62, 0.62, 0.02, pbr({ col: '#FFF6E2', emis: '#FFF1D2', emisK: 1.2 }), x, 1.01, z); ring.isPickable = false;
    const pl = MeshBuilder.CreatePlane(nm('plate'), { width: 0.6, height: 0.19 }, sc); pl.position.set(x, 0.72, z + 0.56); pl.rotation.y = Math.PI; pl.rotation.x = 0.0; pl.material = picMat(plate(e.title, e.sub), 0.5); pl.parent = root;
    blocks.push([x - 0.6, z - 0.6, x + 0.6, z + 0.6]);
    const node = new TransformNode(nm('piece'), sc); node.parent = root; node.position.set(x, 1.04, z);
    buildPiece(e, node);
    node.getChildMeshes().forEach(m => { m.metadata = { act: 'piece', i }; m.isPickable = true; });
    pieces.push({ e, node, at: new Vector3(x, 0, z + 1.8) });
  });
  if (!items.length) { flat(6, 1.2, picMat(P.sign('Nothing on display yet', '#14161B', '#C9CED6', 1024, 200, '600 64px Georgia, serif'), 0.6), 0, 2.2, -D / 2 + 0.03, Math.PI); }
  root.getChildMeshes().forEach(m => { if (!(m.metadata && m.metadata.act)) m.isPickable = false; });
  return { root, W, D, blocks, casters, metals, pieces, doors };

  /** Each kind of piece, made from simple shapes (sizes in metres, standing on the plinth at 0). */
  function buildPiece(e: Exhibit, p: TransformNode) {
    const c = e.color && /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : '#6FB3D9';
    switch (e.kind) {
      case 'model': { try { const ac = buildAirliner(sc); repaint(ac, c1, c2); ac.root.parent = p; ac.root.scaling.setAll(0.014); ac.root.position.set(0, 0.42, 0); ac.root.rotation.y = 0.7; for (const m of [...ac.strobes, ...ac.beacons, ...ac.navs, ...ac.logo]) m.setEnabled(false); for (const g of ac.gear) g.setEnabled(false); cyl(0.006, 0.006, 0.36, gold, 0, 0.18, 0, p); cyl(0.12, 0.14, 0.03, darkM, 0, 0.015, 0, p); } catch (er) { box(0.4, 0.1, 0.1, gold, 0, 0.1, 0, p); } return; }
      case 'plaque': case 'cert': { const [cv, x] = P.canvas(512, 384); x.fillStyle = e.kind === 'cert' ? '#F6F1E4' : '#5A3A22'; x.fillRect(0, 0, 512, 384); x.strokeStyle = e.kind === 'cert' ? (e.color || '#8A6A2A') : '#D4AF37'; x.lineWidth = 12; x.strokeRect(16, 16, 480, 352); x.fillStyle = e.kind === 'cert' ? '#2A2014' : '#E8C878'; x.textAlign = 'center';
        (e.lines && e.lines.length ? e.lines : [e.title]).slice(0, 5).forEach((l, k) => { x.font = `${k === 1 ? 700 : 500} ${k === 1 ? 40 : 26}px Georgia, serif`; x.fillText(String(l).slice(0, 30), 256, 90 + k * 56); });
        const fr = box(0.62, 0.48, 0.04, darkM, 0, 0.36, 0, p); fr.rotation.x = -0.18; const face = MeshBuilder.CreatePlane(nm('face'), { width: 0.56, height: 0.42 }, sc); face.parent = fr; face.position.z = 0.025; face.rotation.y = Math.PI; face.material = picMat(cv, 0.2); casters.push(face); box(0.12, 0.3, 0.04, darkM, 0, 0.15, 0.12, p); return; }
      case 'medal': case 'badge': { const tc = e.kind === 'badge' ? TIER[Math.max(0, Math.min(5, e.tier || 0))] : '#E2B84A'; const m = pbr({ col: tc, metal: 1, rough: 0.22 }); const d = cyl(0.13, 0.13, 0.02, m, 0, 0.34, 0, p); d.rotation.x = Math.PI / 2; const r2 = cyl(0.09, 0.09, 0.024, pbr({ col: tc, metal: 1, rough: 0.4 }), 0, 0.34, -0.003, p); r2.rotation.x = Math.PI / 2;
        const rib = box(0.1, 0.22, 0.01, pbr({ col: c1, rough: 0.6 }), 0, 0.56, 0.01, p); void rib; box(0.36, 0.5, 0.06, darkM, 0, 0.25, 0.06, p); return; }
      case 'vase': { const sh = [[0, 0], [0.09, 0], [0.13, 0.08], [0.15, 0.2], [0.1, 0.34], [0.07, 0.42], [0.09, 0.46]].map(q => new Vector3(q[0], q[1], 0)); const v = MeshBuilder.CreateLathe(nm('vase'), { shape: sh, tessellation: 40, sideOrientation: Mesh.DOUBLESIDE }, sc); at(v, pbr({ col: c, rough: 0.12, metal: 0.05 }), 0, 0, 0, p); return; }
      case 'dish': { const d = cyl(0.26, 0.2, 0.04, pbr({ col: c, rough: 0.15 }), 0, 0.2, 0, p); d.rotation.x = -1.1; box(0.1, 0.2, 0.06, darkM, 0, 0.08, 0.06, p); return; }
      case 'tin': { cyl(0.12, 0.12, 0.2, pbr({ col: c, rough: 0.3, metal: 0.6 }), 0, 0.1, 0, p); cyl(0.125, 0.125, 0.02, gold, 0, 0.205, 0, p); return; }
      case 'book': { box(0.26, 0.05, 0.34, pbr({ col: c, rough: 0.5 }), 0, 0.03, 0, p); box(0.25, 0.04, 0.33, pbr({ col: '#F4EFD9', rough: 0.8 }), 0.004, 0.03, 0, p).position.y = 0.032; return; }
      case 'jumper': { box(0.36, 0.08, 0.3, pbr({ tex: tex(P.noise(c, 30, 4)), rough: 0.95 }), 0, 0.04, 0, p); return; }
      case 'carving': { const w = pbr({ col: c, rough: 0.7 }); cyl(0.07, 0.1, 0.26, w, 0, 0.13, 0, p, 9); at(MeshBuilder.CreateSphere(nm('h'), { diameter: 0.14, segments: 8 }, sc), w, 0, 0.32, 0, p); return; }
      default: { const fr = box(0.5, 0.4, 0.04, gold, 0, 0.3, 0, p); fr.rotation.x = -0.15; const face = MeshBuilder.CreatePlane(nm('ph'), { width: 0.44, height: 0.34 }, sc); face.parent = fr; face.position.z = 0.025; face.rotation.y = Math.PI; face.material = picMat(P.view(), 0.2); box(0.1, 0.25, 0.04, darkM, 0, 0.12, 0.1, p); }
    }
  }
}
/** Can you stand at (x, z) in the museum's coordinates? */
export function museumBlocked(M: Museum, x: number, z: number): boolean {
  const r = 0.28; if (x < -M.W / 2 + 0.4 || x > M.W / 2 - 0.4 || z < -M.D / 2 + 0.4 || z > M.D / 2 - 0.35) return true;
  for (const b of M.blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return true;
  return false;
}
