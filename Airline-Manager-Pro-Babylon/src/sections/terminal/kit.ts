// The terminal's building kit: its materials (drawn textures), and the way every part is made.
//  - The model is one tree: TERMINAL → F1 / F2 / ROOF / SITE → each room (its id) → its STRUCTURE (floor, walls,
//    ceiling, merged into a few meshes) and every object in it (doors, chairs, tables, lamps, screens, plants…),
//    each its own node named with its id (F1-HALL/CHAIR-012), with metadata { id, kind, room } so it is easy to find,
//    move, swap or remove on its own.
//  - Objects of the same kind share one source mesh per part (instances): many chairs cost little to draw.
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, InstancedMesh } from '@babylonjs/core';
import * as P from '../lounge/pictures';
import { fileTex } from '../../core/filetex';
import { IS_PC } from '../../core/app';
import { ROOMS, inRoom } from './plan';

export interface Obj { id: string; kind: string; room: string; node: TransformNode }
export interface Kit {
  sc: Scene; root: TransformNode; groups: { [k: string]: TransformNode }; rooms: { [id: string]: TransformNode };
  objects: Map<string, Obj>; metals: PBRMaterial[]; casters: AbstractMesh[]; blocks: { [f: number]: number[][] }; circles: { [f: number]: number[][] };
  M: { [k: string]: any }; tex: (c: HTMLCanvasElement, u?: number, v?: number) => DynamicTexture; pbr: (o: MatO) => PBRMaterial; glow: (hex: string, k?: number) => StandardMaterial;
  picture: (c: HTMLCanvasElement, glowK?: number) => StandardMaterial;
  /** A new object, its node placed and turned (yaw: 0 faces +z), counted in its room. */
  obj: (room: string, kind: string, x: number, y: number, z: number, yaw?: number, id?: string) => TransformNode;
  /** A part of an object: an instance of the shared source for that key (made once by build), at local (x, y, z). */
  part: (key: string, build: () => Mesh, mat: any, par: TransformNode, x: number, y: number, z: number, rx?: number, ry?: number, rz?: number, sx?: number, sy?: number, sz?: number) => InstancedMesh;
  box: (par: TransformNode, w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry?: number) => InstancedMesh;
  cyl: (par: TransformNode, r: number, h: number, mat: any, x: number, y: number, z: number, rTop?: number, seg?: number) => InstancedMesh;
  ball: (par: TransformNode, r: number, mat: any, x: number, y: number, z: number, sy?: number) => InstancedMesh;
  /** A unique mesh for a room's structure, merged with the others of its material in that room at the end. */
  struct: (room: string, m: Mesh, mat: any) => Mesh;
  block: (f: number, x0: number, z0: number, x1: number, z1: number) => void;
  circle: (f: number, x: number, z: number, r: number) => void;
  nm: (k: string) => string;
  /** After furnishing: free-standing furniture that reaches into a wall is moved back into its room, clear of the wall. */
  clearWalls: () => void;
}
export interface MatO { col?: string; tex?: Texture; metal?: number; rough?: number; emis?: string; emisK?: number; alpha?: number; coat?: number; key?: string }

export function makeKit(sc: Scene): Kit {
  let cur: string | null = null; const owner = new Map<number[], string>();
  const root = new TransformNode('TERMINAL', sc), groups: { [k: string]: TransformNode } = {}, rooms: { [id: string]: TransformNode } = {};
  for (const g of ['F1', 'F2', 'ROOF', 'SITE', 'DOORS', 'STAIRS', 'SCREENS', 'STANDS']) { const t = new TransformNode(g, sc); t.parent = root; groups[g] = t; }
  const objects = new Map<string, Obj>(), metals: PBRMaterial[] = [], casters: AbstractMesh[] = [], blocks: { [f: number]: number[][] } = { 1: [], 2: [] }, circles: { [f: number]: number[][] } = { 1: [], 2: [] };
  let n = 0; const nm = (k: string) => k + '#' + (n++);
  const tex = (c: HTMLCanvasElement, u = 1, v = 1) => { const t = new DynamicTexture(nm('tex'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const matCache = new Map<string, PBRMaterial>();
  const pbr = (o: MatO) => {
    if (o.key && matCache.has(o.key)) return matCache.get(o.key) as PBRMaterial;
    const m = new PBRMaterial(o.key || nm('m'), sc); m.maxSimultaneousLights = 4; m.albedoColor = o.col ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex;
    m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6; if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis).scale(o.emisK || 1);
    if (o.alpha != null) { m.alpha = o.alpha; m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; m.backFaceCulling = false; }
    if (o.coat) { m.clearCoat.isEnabled = true; m.clearCoat.intensity = o.coat; m.clearCoat.roughness = 0.15; }
    if ((o.metal || 0) >= 0.5 || (o.coat || 0) >= 0.4) metals.push(m); if (o.key) matCache.set(o.key, m); return m; };
  const glow = (hex: string, k = 1.4) => { const m = new StandardMaterial(nm('glow'), sc); m.emissiveColor = Color3.FromHexString(hex).scale(k); m.diffuseColor = Color3.Black(); m.specularColor = Color3.Black(); m.disableLighting = true; return m; };
  const picture = (c: HTMLCanvasElement, glowK = 0) => { const m = new StandardMaterial(nm('pic'), sc); const t = tex(c); m.diffuseTexture = t; m.specularColor = new Color3(0.05, 0.05, 0.05); m.backFaceCulling = false; if (glowK) { m.emissiveTexture = t; m.emissiveColor = new Color3(1, 1, 1).scale(0.42 * Math.min(1.5, glowK)); (m as any)._soft = true; } return m; };   // lit signs and screens: a soft, readable glow (kept out of the bloom)
  // ---- the materials, each named so a mod can find it ----
  const M: { [k: string]: any } = {
    white: pbr({ key: 'white', col: '#F2F3F5', rough: 0.35 }), whiteGloss: pbr({ key: 'whiteGloss', col: '#F4F6F8', rough: 0.12, coat: 0.5 }), offwhite: pbr({ key: 'offwhite', col: '#E8E4DC', rough: 0.8 }),
    plaster: pbr({ key: 'plaster', tex: tex(P.plaster(), 4, 2), rough: 0.9 }), concrete: pbr({ key: 'concrete', tex: tex(P.noise('#B8B6B0', 0.18, 3), 8, 8), rough: 0.95 }),
    terrazzo: pbr({ key: 'terrazzo', tex: tex(P.noise('#E9E8EC', 0.12, 9, 512, 22000), 20, 20), rough: 0.18, coat: 0.3 }),
    timber: pbr({ key: 'timber', tex: tex(P.wood('#C9763A', '#7A3A16', 11, 512, 512, 0.6), 6, 30), rough: 0.5 }),
    walnut: pbr({ key: 'walnut', tex: tex(P.wood('#6B4428', '#2E1A0E', 5)), rough: 0.4 }), oak: pbr({ key: 'oak', tex: tex(P.wood('#C29A6A', '#7A5A36', 7)), rough: 0.45 }),
    herring: pbr({ key: 'herring', tex: tex(P.herringbone(true), 6, 6), rough: 0.42 }), carpetBlue: pbr({ key: 'carpetBlue', tex: tex(P.noise('#2E3E5A', 0.25, 21), 10, 10), rough: 1 }),
    carpetGrey: pbr({ key: 'carpetGrey', tex: tex(P.noise('#5A5E66', 0.25, 22), 10, 10), rough: 1 }), carpet: pbr({ key: 'carpet', tex: tex(P.carpet(), 3, 3), rough: 1 }),
    tile: pbr({ key: 'tile', tex: tex(tiles('#E6E9EC', '#C4C9CF', 64), 20, 20), rough: 0.25 }), tileDark: pbr({ key: 'tileDark', tex: tex(tiles('#3A3E44', '#2A2D31', 64), 12, 12), rough: 0.3 }),
    rubber: pbr({ key: 'rubber', tex: tex(P.noise('#3C3F44', 0.2, 31), 20, 4), rough: 0.9 }), epoxy: pbr({ key: 'epoxy', col: '#7C8690', rough: 0.4 }),
    glass: pbr({ key: 'glass', col: '#CFE4F2', rough: 0.03, alpha: 0.16, metal: 0.1 }), glassBlue: pbr({ key: 'glassBlue', col: '#9FC4DC', rough: 0.05, alpha: 0.3, metal: 0.2 }),
    steel: pbr({ key: 'steel', col: '#9AA2AC', metal: 0.85, rough: 0.35 }), chrome: pbr({ key: 'chrome', col: '#E2E6EA', metal: 1, rough: 0.12 }), black: pbr({ key: 'black', col: '#16181C', rough: 0.45 }),
    lacquer: pbr({ key: 'lacquer', col: '#101114', rough: 0.15, coat: 0.6 }), brass: pbr({ key: 'brass', col: '#C9A25E', metal: 0.95, rough: 0.28 }), gold: pbr({ key: 'gold', col: '#D4AF37', metal: 1, rough: 0.25 }),
    marbleDark: pbr({ key: 'marbleDark', tex: tex(P.darkMarble()), rough: 0.18, coat: 0.4 }), navy: pbr({ key: 'navy', col: '#1C2D52', rough: 0.6 }), mullion: pbr({ key: 'mullion', col: '#EEF0F3', rough: 0.3, metal: 0.2 }),
    fabricTeal: pbr({ key: 'fabricTeal', tex: tex(P.noise('#1F4A4A', 0.2, 41), 2, 2), rough: 0.95 }), fabricRust: pbr({ key: 'fabricRust', tex: tex(P.noise('#9A4A2A', 0.2, 42), 2, 2), rough: 0.95 }),
    fabricBlue: pbr({ key: 'fabricBlue', tex: tex(P.noise('#2C4A7A', 0.2, 43), 2, 2), rough: 0.95 }), fabricGrey: pbr({ key: 'fabricGrey', tex: tex(P.noise('#4A4E56', 0.2, 44), 2, 2), rough: 0.95 }),
    leather: pbr({ key: 'leather', tex: tex(P.leather('#7A3F22')), rough: 0.45 }), leatherBlack: pbr({ key: 'leatherBlack', tex: tex(P.leather('#1E1E20')), rough: 0.5 }),
    plant: pbr({ key: 'plant', col: '#4E8A3A', rough: 0.8 }), plantDark: pbr({ key: 'plantDark', col: '#2F6B34', rough: 0.75 }), soil: pbr({ key: 'soil', col: '#3A2A1E', rough: 1 }), trunk: pbr({ key: 'trunk', col: '#5A3E26', rough: 0.9 }),
    porcelain: pbr({ key: 'porcelain', col: '#F7F5F0', rough: 0.2 }), screenBlack: pbr({ key: 'screenBlack', col: '#0A0B0D', rough: 0.1, coat: 0.4 }), yellow: pbr({ key: 'yellow', col: '#F2C230', rough: 0.5 }),
    red: pbr({ key: 'red', col: '#C0392B', rough: 0.5 }), grass: pbr({ key: 'grass', tex: tex(P.noise('#4A7A34', 0.25, 51, 256, 9000), 120, 120), rough: 1 }),
    asphalt: pbr({ key: 'asphalt', tex: tex(P.noise('#25272B', 0.2, 52, 256, 9000), 60, 6), rough: 0.9 }), apron: pbr({ key: 'apron', tex: tex(P.noise('#8C8C88', 0.15, 53, 256, 9000), 80, 16), rough: 0.9 }),
    kerb: pbr({ key: 'kerb', tex: tex(P.noise('#C9C6CE', 0.12, 54), 30, 6), rough: 0.7 }), solar: pbr({ key: 'solar', col: '#1A2A44', rough: 0.15, metal: 0.4 }),
    copper: pbr({ key: 'copper', col: '#B86F3E', metal: 0.9, rough: 0.3, emis: '#3A1A08', emisK: 0.35 }), tealUI: pbr({ key: 'tealUI', col: '#3FD3E6', rough: 0.4 }),
    light: glow('#FFF6E6', 1.6), lightCool: glow('#EAF4FF', 1.5), lightWarm: glow('#FFD9A0', 1.8), sky: glow('#BFE3FA', 1.1), green: glow('#3BD16F', 1.4), redLed: glow('#FF3B30', 1.4),
  };
  // the outer glazing (the facades, the gates' and the pier's windows, the jetways): low-iron laminated glass with
  // float-glass waviness, a film of dust, dried water spots and rain runs (our own tileable pictures, 3 m a repeat). It
  // reflects strongly seen from outside and hardly at all from inside (glassLook switches the two as you go in and out)
  { const q = IS_PC ? '' : '-512', g = new PBRMaterial('glassOuter', sc); g.maxSimultaneousLights = 4;
    const c = fileTex('glass-colour' + q, sc), n = fileTex('glass-normal' + q, sc), r = fileTex('glass-refl' + q, sc); c.hasAlpha = true;
    g.albedoColor = Color3.White(); g.albedoTexture = c; g.useAlphaFromAlbedoTexture = true; g.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; g.backFaceCulling = false;
    // a reflective coating (specular workflow): its strength set by glassLook, its gloss from the picture (smudges a touch duller)
    g.bumpTexture = n; (g.bumpTexture as any).level = 0.35; g.reflectivityTexture = r; g.useMicroSurfaceFromReflectivityMapAlpha = true; g.microSurface = 0.98;
    g.useRadianceOverAlpha = true; g.useSpecularOverAlpha = true; g.indexOfRefraction = 1.52;
    M.glassOuter = g; glassLook(g, false); }
  for (const k of ['plaster', 'concrete', 'terrazzo', 'timber', 'herring', 'carpetBlue', 'carpetGrey', 'tile', 'tileDark', 'rubber', 'grass', 'asphalt', 'apron', 'kerb', 'white', 'offwhite']) { (M[k] as PBRMaterial).backFaceCulling = false; }
  // ---- objects ----
  const counts: { [k: string]: number } = {};
  const obj = (roomId: string, kind: string, x: number, y: number, z: number, yaw = 0, id?: string) => {
    const k = roomId + '/' + kind; counts[k] = (counts[k] || 0) + 1;
    const oid = id || `${roomId}/${kind}-${String(counts[k]).padStart(3, '0')}`;
    const t = new TransformNode(oid, sc); t.position.set(x, y, z); t.rotation.y = yaw; t.metadata = { id: oid, kind, room: roomId };
    t.parent = rooms[roomId] || groups[roomId] || root; objects.set(oid, { id: oid, kind, room: roomId, node: t }); cur = oid; return t; };
  const sources = new Map<string, Mesh>();
  const part = (key: string, build: () => Mesh, mat: any, par: TransformNode, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const sk = key + '|' + (mat && mat.name); let src = sources.get(sk);
    if (!src) { src = build(); src.name = 'SRC:' + sk; src.material = mat; src.receiveShadows = true; src.isVisible = true; src.setEnabled(true); src.position.set(0, -500, 0); src.isPickable = false; src.alwaysSelectAsActiveMesh = false; sources.set(sk, src); }
    const i = src.createInstance(nm(key)); i.parent = par; i.position.set(x, y, z); i.rotation.set(rx, ry, rz); i.scaling.set(sx, sy, sz); i.isPickable = true;
    const md = par.metadata; i.metadata = md ? { id: md.id, kind: md.kind, room: md.room } : null; return i; };
  const box = (par: TransformNode, w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry = 0) => part('box', () => MeshBuilder.CreateBox('b', { size: 1 }, sc), mat, par, x, y, z, 0, ry, 0, w, h, d);
  const cyl = (par: TransformNode, r: number, h: number, mat: any, x: number, y: number, z: number, rTop?: number, seg = 18) => {
    const k = rTop == null ? 1 : Math.round(rTop / r * 20) / 20; return part('cyl' + k + '-' + seg, () => MeshBuilder.CreateCylinder('c', { diameterTop: k, diameterBottom: 1, height: 1, tessellation: seg }, sc), mat, par, x, y, z, 0, 0, 0, r * 2, h, r * 2); };
  const ball = (par: TransformNode, r: number, mat: any, x: number, y: number, z: number, sy = 1) => part('ball', () => MeshBuilder.CreateSphere('s', { diameter: 1, segments: 12 }, sc), mat, par, x, y, z, 0, 0, 0, r * 2, r * 2 * sy, r * 2);
  const structs = new Map<string, Mesh[]>(), structMat = new Map<string, any>();
  const struct = (roomId: string, m: Mesh, mat: any) => { const k = roomId + '|' + mat.name; let l = structs.get(k); if (!l) { structs.set(k, l = []); structMat.set(k, mat); } m.material = mat; l.push(m); return m; };
  (struct as any).finish = () => {
    for (const [k, list] of structs) { const [roomId] = k.split('|'), mat = structMat.get(k), par = rooms[roomId] || groups[roomId] || root;
      for (let i = 0; i < list.length; i += 300) { const mm = Mesh.MergeMeshes(list.slice(i, i + 300), true, true, undefined, false, false); if (mm) { mm.name = `${roomId}/STRUCTURE-${mat.name}`; mm.material = mat; mm.parent = par; mm.receiveShadows = true; mm.isPickable = false; mm.metadata = { id: roomId, kind: 'structure', room: roomId }; mm.freezeWorldMatrix(); } } }
    structs.clear();
  };
  const block = (f: number, x0: number, z0: number, x1: number, z1: number) => { const b = [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]; blocks[f].push(b); if (cur) owner.set(b, cur); };
  const circle = (f: number, x: number, z: number, r: number) => { const c = [x, z, r]; circles[f].push(c); if (cur) owner.set(c, cur); };
  const FREE = new Set(['AIR-HANDLER', 'ARMCHAIR', 'BACK-BAR', 'BAGGAGE-CART', 'BAR-STOOL', 'BENCH', 'BIN', 'CABINET', 'CHAIR', 'CLEANING-CART', 'COUNTER', 'DESK', 'GATE-DESK', 'LOCKERS', 'MEETING-TABLE', 'OFFICE-CHAIR', 'PLANT', 'PUMP', 'SEATS', 'SHELF', 'SOFA', 'STOOL', 'STUDENT-DESK', 'TABLE', 'TREE-PLANTER', 'TUG', 'TOY-BLOCK', 'SECURITY-DESK', 'KITCHEN', 'STALL', 'PERFUME-ISLAND']);
  const clearWalls = () => {
    const CLEAR = 0.25; // the wall's face is at most 0.15 m in from the room's line; 10 cm more to spare
    for (const o of objects.values()) {
      if (!FREE.has(o.kind)) continue; const r = ROOMS.find(q => q.id === o.room); if (!r || r.kind === 'museum') continue;
      const { min, max } = o.node.getHierarchyBoundingVectors(true), cx = (min.x + max.x) / 2, cz = (min.z + max.z) / 2;
      if (!inRoom(r, cx, cz)) continue;
      const push = (lo: number, hi: number, a: number, b: number) => { const dl = a + CLEAR - lo, dh = hi - (b - CLEAR); if (dl > 0 && dh > 0) return 0; if (dl > 0 && dl < 0.8) return dl; if (dh > 0 && dh < 0.8) return -dh; return 0; };
      const dx = push(min.x, max.x, r.x0, r.x1), dz = push(min.z, max.z, r.z0, r.z1); if (!dx && !dz) continue;
      const near = (x: number, z: number) => x > min.x - 0.5 && x < max.x + 0.5 && z > min.z - 0.5 && z < max.z + 0.5;
      o.node.position.x += dx; o.node.position.z += dz;
      for (const f of [1, 2]) { for (const b of blocks[f]) if (owner.get(b) === o.id && near((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)) { b[0] += dx; b[2] += dx; b[1] += dz; b[3] += dz; } for (const c of circles[f]) if (owner.get(c) === o.id && near(c[0], c[1])) { c[0] += dx; c[1] += dz; } }
    }
    cur = null;
  };
  return { sc, root, groups, rooms, objects, metals, casters, blocks, circles, M, tex, pbr, glow, picture, obj, part, box, cyl, ball, struct, block, circle, nm, clearWalls };
}
/** Square tiles with grout. */
export function tiles(a: string, b: string, n: number): HTMLCanvasElement {
  const [c, x] = P.canvas(512, 512), s = 512 / 8; x.fillStyle = b; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = a; x.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
  void n; return c;
}
/** A sign: white letters on a colour, for over doors and desks. */
export function signC(text: string, bg = '#14202E', fg = '#F2F4F7', w = 1024, h = 200, font = '700 96px Arial, sans-serif') { return P.sign(text, bg, fg, w, h, font); }
export { P, Vector3 };

/** The outer glazing seen from outside (strong reflections, the inside hard to make out) or from inside (a clear view out,
 *  the room barely mirrored). Changed only when you go in or out, never every frame. */
export function glassLook(g: PBRMaterial, inside: boolean) {
  if ((g as any)._inside === inside) return; (g as any)._inside = inside;
  // outside: the coating mirrors the sky and the apron and the tinted glass has body; inside: the coating's mirror and
  // most of the tint drop away (the bright day outside is what you see)
  g.reflectivityColor.set(inside ? 0.02 : 0.55, inside ? 0.02 : 0.6, inside ? 0.02 : 0.64); g.environmentIntensity = inside ? 0.3 : 2.6; g.alpha = inside ? 0.32 : 1; g.specularIntensity = inside ? 0.2 : 1; g.directIntensity = inside ? 0.5 : 1;
}
/** Texture co-ordinates for a glass pane laid flat on its own plane, 3 m a repeat (so the pattern is the same size on every pane). */
export function glassUV(m: Mesh, world: boolean, tile = 3) {
  const pos = m.getVerticesData('position'), nor = m.getVerticesData('normal'); if (!pos || !nor) return;
  const W = world ? m.computeWorldMatrix(true) : null, uv = new Float32Array(pos.length / 3 * 2), v = new Vector3();
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) { v.set(pos[i], pos[i + 1], pos[i + 2]); if (W) Vector3.TransformCoordinatesToRef(v, W, v);
    const ax = Math.abs(nor[i]), ay = Math.abs(nor[i + 1]), az = Math.abs(nor[i + 2]);
    if (ay >= ax && ay >= az) { uv[j] = v.x / tile; uv[j + 1] = v.z / tile; } else if (ax >= az) { uv[j] = v.z / tile; uv[j + 1] = v.y / tile; } else { uv[j] = v.x / tile; uv[j + 1] = v.y / tile; } }
  m.setVerticesData('uv', uv, false, 2);
}
