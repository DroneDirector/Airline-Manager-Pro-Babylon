// Your private suite behind the office (the "Dark hotel suite"), through a door in the office's right-hand wall: a short
// hall; off it the bathroom (a wall-hung toilet you can use, a vanity with a basin to wash your hands at, a mirror that
// really reflects, a walk-in shower behind a glass panel and a freestanding bath) and the bedroom (a double bed with a
// channelled headboard you can lie down on, nightstands, a lamp you switch on and off, a clock showing the time, a
// ceiling light on a switch by the door so the room goes completely dark, an armchair by the window); at the end of
// the hall the dressing alcove, whose wardrobe opens your look.
// Its doors open with a tap (or E, or Cross) like the office's. The building's coordinates: x east, z north, metres.
import { Scene, Vector3, Color3, Color4, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, PointLight, MirrorTexture, Plane, ParticleSystem, Space } from '@babylonjs/core';
import * as P from '../lounge/pictures';
import { IS_PC } from '../../core/app';

export const SUITE = { x0: 3.2, x1: 10.4, z0: -3.2, z1: 3.2, h: 2.7 };
export const SUITE_DOOR = { z0: 2.05, z1: 2.95 };                     // in the office's right-hand wall (x = 3.2)
const HALL = { x0: 3.25, x1: 4.6 }, ROOMX = 4.7;                       // the hall, then the rooms beyond its wall
const BATH = { z0: 0.95, z1: 3.15 }, BED = { z0: -3.15, z1: 0.85 };
const BATH_DOOR = { z0: 1.6, z1: 2.4 }, BED_DOOR = { z0: -1.4, z1: -0.6 };
export interface Suite {
  root: TransformNode; blocks: number[][]; casters: AbstractMesh[]; metals: PBRMaterial[];
  doors: { [k: string]: { meshes: AbstractMesh[]; hinge: Vector3; dir: number } }; bed: { x: number; z: number; yaw: number };
  inside(x: number, z: number): boolean; walkable(x: number, z: number, open: { [k: string]: number }): boolean;
  use(act: string): string; step(t: number, dt: number): void; lights: PointLight[]; meshes(): AbstractMesh[];
}

export function buildSuite(sc: Scene, accent: string): Suite {
  const root = new TransformNode('suite', sc), blocks: number[][] = [], casters: AbstractMesh[] = [], metals: PBRMaterial[] = [];
  let n = 0; const nm = (k: string) => 'suite-' + k + '-' + (n++);
  const block = (xa: number, za: number, xb: number, zb: number) => blocks.push([Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)]);
  const tex = (c: HTMLCanvasElement, u = 1, v = 1) => { const t = new DynamicTexture(nm('t'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: string; tex?: Texture; metal?: number; rough?: number; emis?: string; emisK?: number; alpha?: number }) => { const m = new PBRMaterial(nm('m'), sc); m.maxSimultaneousLights = 8; m.albedoColor = o.col ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex; m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6; if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis).scale(o.emisK || 1); if (o.alpha != null) { m.alpha = o.alpha; m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; } if ((o.metal || 0) >= 0.6) metals.push(m); return m; };
  const place = (m: Mesh, mat: any, x: number, y: number, z: number, ry = 0, cast = true, act?: string) => { m.position.set(x, y, z); m.rotation.y = ry; m.material = mat; m.receiveShadows = true; m.parent = root; if (cast) casters.push(m); if (act) m.metadata = { act }; return m; };
  const box = (w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry = 0, act?: string, cast = true) => place(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, sc), mat, x, y, z, ry, cast, act);
  const cyl = (d: number, h: number, mat: any, x: number, y: number, z: number, act?: string, dt?: number) => place(MeshBuilder.CreateCylinder(nm('c'), { diameterTop: dt != null ? dt : d, diameterBottom: d, height: h, tessellation: 24 }, sc), mat, x, y, z, 0, true, act);
  const flat = (w: number, h: number, mat: any, x: number, y: number, z: number, ry: number, act?: string) => place(MeshBuilder.CreatePlane(nm('p'), { width: w, height: h }, sc), mat, x, y, z, ry, false, act);
  const H = SUITE.h, X1 = SUITE.x1, Z0 = SUITE.z0, Z1 = SUITE.z1;
  // the dark hotel look: charcoal walls with oak, a dark stone bathroom, warm brass
  const dark = pbr({ tex: tex(P.plaster('#3A3734'), 2, 1), rough: 0.85 }), oak = pbr({ tex: tex(P.wood('#5A3E28', '#2A1A10', 21)), rough: 0.45 });
  const stone = pbr({ tex: tex(P.darkMarble(), 2, 2), rough: 0.25 }), brass = pbr({ col: '#B8925A', metal: 0.95, rough: 0.28 }), white = pbr({ col: '#F2F1EE', rough: 0.15 });
  const chrome = pbr({ col: '#DDE2E8', metal: 1, rough: 0.1 }), black = pbr({ col: '#141518', rough: 0.4 }), linen = pbr({ col: '#E9E4DA', rough: 0.95 }), fabric = pbr({ col: '#2C3440', rough: 0.9 });
  const carpetM = pbr({ tex: tex(P.noise('#2E2B29', 10, 44), 4, 4), rough: 0.98 });
  // ---- floors and ceilings ----
  const floor = (x0: number, z0: number, x1: number, z1: number, m: any) => { const g = MeshBuilder.CreateGround(nm('f'), { width: x1 - x0, height: z1 - z0 }, sc); g.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2); g.material = m; g.receiveShadows = true; g.parent = root; };
  floor(HALL.x0 - 0.05, Z0, HALL.x1, Z1, oak); floor(ROOMX, BATH.z0, X1, Z1, stone); floor(ROOMX, Z0, X1, BED.z1, carpetM);
  { const c = MeshBuilder.CreatePlane(nm('ceil'), { width: X1 - SUITE.x0, height: Z1 - Z0 }, sc); c.rotation.x = -Math.PI / 2; c.position.set((SUITE.x0 + X1) / 2, H, 0); c.material = pbr({ col: '#2A2826', rough: 0.95 }); c.parent = root; }
  // ---- the walls (facing in) ----
  const wallZ = (x0: number, x1: number, z: number, face: number, m = dark) => flat(x1 - x0, H, m, (x0 + x1) / 2, H / 2, z, face);
  const wallX = (z0: number, z1: number, x: number, face: number, m = dark) => flat(z1 - z0, H, m, x, H / 2, (z0 + z1) / 2, face);
  const lintelX = (z0: number, z1: number, x: number, face: number) => flat(z1 - z0, H - 2.15, dark, x, 2.15 + (H - 2.15) / 2, (z0 + z1) / 2, face);
  // the hall: its office side (with the door from the office), its far side (with the bathroom and bedroom doors), its ends
  wallX(Z0, SUITE_DOOR.z0, HALL.x0, Math.PI / 2); wallX(SUITE_DOOR.z1, Z1, HALL.x0, Math.PI / 2); lintelX(SUITE_DOOR.z0, SUITE_DOOR.z1, HALL.x0, Math.PI / 2);
  for (const [a, b] of [[Z0, BED_DOOR.z0], [BED_DOOR.z1, BATH_DOOR.z0], [BATH_DOOR.z1, Z1]]) wallX(a, b, HALL.x1, -Math.PI / 2);
  lintelX(BED_DOOR.z0, BED_DOOR.z1, HALL.x1, -Math.PI / 2); lintelX(BATH_DOOR.z0, BATH_DOOR.z1, HALL.x1, -Math.PI / 2);
  wallZ(HALL.x0, HALL.x1, Z1, 0); wallZ(HALL.x0, HALL.x1, Z0, Math.PI);
  // the rooms: the hall side (their doors), the outer walls, the wall between them
  for (const [a, b] of [[Z0, BED_DOOR.z0], [BED_DOOR.z1, BED.z1]]) wallX(a, b, ROOMX, Math.PI / 2); lintelX(BED_DOOR.z0, BED_DOOR.z1, ROOMX, Math.PI / 2);
  for (const [a, b] of [[BATH.z0, BATH_DOOR.z0], [BATH_DOOR.z1, Z1]]) wallX(a, b, ROOMX, Math.PI / 2, stone); flat(BATH_DOOR.z1 - BATH_DOOR.z0, H - 2.15, stone, ROOMX, 2.15 + (H - 2.15) / 2, (BATH_DOOR.z0 + BATH_DOOR.z1) / 2, Math.PI / 2);
  wallZ(ROOMX, X1, Z1, 0, stone); wallZ(ROOMX, X1, BATH.z0, Math.PI, stone); wallX(BATH.z0, Z1, X1, -Math.PI / 2, stone);
  wallZ(ROOMX, X1, BED.z1, 0); wallZ(ROOMX, X1, Z0, Math.PI);
  // the bedroom's window in its far wall, with the view, and the wall round it
  { const wz0 = -2.4, wz1 = -0.2, sill = 0.8, top = 2.3;
    wallX(Z0, wz0, X1, -Math.PI / 2); wallX(wz1, BED.z1, X1, -Math.PI / 2); flat(wz1 - wz0, sill, dark, X1, sill / 2, (wz0 + wz1) / 2, -Math.PI / 2); flat(wz1 - wz0, H - top, dark, X1, top + (H - top) / 2, (wz0 + wz1) / 2, -Math.PI / 2);
    const vm = new StandardMaterial(nm('view'), sc), vt = tex(P.view()), sun = P.daylight(); vm.diffuseTexture = vt; vm.emissiveTexture = vt; vm.emissiveColor = new Color3(0.3 + 0.6 * sun, 0.3 + 0.58 * sun, 0.36 + 0.55 * sun); vm.disableLighting = true;
    flat(wz1 - wz0, top - sill, vm, X1 + 0.06, (sill + top) / 2, (wz0 + wz1) / 2, -Math.PI / 2); box(0.18, 0.04, wz1 - wz0 + 0.1, oak, X1 - 0.07, sill, (wz0 + wz1) / 2);
    for (const z of [wz0, wz1]) box(0.08, top - sill, 0.06, black, X1 - 0.02, (sill + top) / 2, z);
    // the curtains either side
    for (const z of [wz0 - 0.25, wz1 + 0.25]) box(0.08, H - 0.1, 0.5, pbr({ col: '#4A3A30', rough: 0.95 }), X1 - 0.08, (H - 0.1) / 2, z); }
  // the skirting, and oak panelling along the hall
  for (const [z0, z1] of [[Z0, SUITE_DOOR.z0]]) box(0.02, 1.0, z1 - z0, oak, HALL.x0 + 0.012, 0.5, (z0 + z1) / 2, 0, undefined, false);

  // ---- the doors: from the office, to the bathroom, to the bedroom ----
  const doorM = pbr({ tex: tex(P.wood('#2E2018', '#120A06', 31)), rough: 0.45 });
  const doors: Suite['doors'] = {};
  const door = (k: string, x: number, z0: number, z1: number, dir: number) => { const zc = (z0 + z1) / 2, l = box(0.05, 2.12, z1 - z0 - 0.02, doorM, x, 1.06, zc, 0, 'suitedoor-' + k), hd = box(0.07, 0.04, 0.14, brass, x + (dir > 0 ? -0.05 : 0.05), 1.02, z1 - 0.15, 0, 'suitedoor-' + k);
    doors[k] = { meshes: [l, hd], hinge: new Vector3(x, 0, z0), dir }; };
  door('office', HALL.x0 + 0.03, SUITE_DOOR.z0, SUITE_DOOR.z1, 1); door('bath', HALL.x1 + 0.03, BATH_DOOR.z0, BATH_DOOR.z1, -1); door('bed', HALL.x1 + 0.03, BED_DOOR.z0, BED_DOOR.z1, -1);

  // ---- the bathroom ----
  // the wall-hung toilet and its flush plate
  { const tx = ROOMX + 0.45, tz = Z1 - 0.35; const b = MeshBuilder.CreateCapsule(nm('wc'), { height: 0.6, radius: 0.19, tessellation: 18 }, sc); b.rotation.x = Math.PI / 2; b.scaling.set(1, 1, 0.8); place(b, white, tx, 0.4, tz - 0.05, 0, true, 'toilet');
    box(0.4, 0.04, 0.5, white, tx, 0.62, tz - 0.08, 0, 'toilet'); box(0.2, 0.14, 0.01, chrome, tx, 1.05, Z1 - 0.01, 0, 'toilet'); block(tx - 0.25, tz - 0.4, tx + 0.25, Z1); }
  // the vanity: oak with a stone top, a basin, its tap, and the mirror over it
  const vz = Z1 - 0.3, vx = ROOMX + 1.7;
  box(1.1, 0.5, 0.5, oak, vx, 0.6, vz, 0, 'basin'); box(1.14, 0.04, 0.54, stone, vx, 0.87, vz, 0, 'basin');
  cyl(0.42, 0.12, white, vx, 0.95, vz, 'basin', 0.46); cyl(0.03, 0.22, chrome, vx, 1.0, Z1 - 0.08, 'basin'); box(0.03, 0.03, 0.14, chrome, vx, 1.1, Z1 - 0.13, 0, 'basin');
  block(vx - 0.6, vz - 0.3, vx + 0.6, Z1);
  const mirror = MeshBuilder.CreatePlane(nm('mirror'), { width: 1.0, height: 0.9 }, sc); place(mirror, null, vx, 1.6, Z1 - 0.012, 0, false, 'mirror');
  { const mm = new StandardMaterial(nm('mirrorM'), sc), mt = new MirrorTexture(nm('mt'), IS_PC ? 1024 : 512, sc, true); mt.mirrorPlane = new Plane(0, 0, -1, Z1 - 0.012); mt.level = 0.95; mm.reflectionTexture = mt; mm.diffuseColor = new Color3(0.05, 0.05, 0.05); mm.specularColor = new Color3(0.6, 0.6, 0.6); mirror.material = mm;
    (root as any)._mirror = mt; box(1.06, 0.96, 0.02, brass, vx, 1.6, Z1 - 0.004, 0, undefined, false); }
  const mirrorTex: MirrorTexture = (root as any)._mirror;
  // the walk-in shower: a glass panel, the rain head, the drain
  const sx0 = X1 - 1.3, glassM = pbr({ col: '#CFE4F2', rough: 0.03, alpha: 0.18, metal: 0.1 });
  box(0.02, 2.1, 1.3, glassM, sx0, 1.05, Z1 - 0.65, 0, 'shower', false); cyl(0.3, 0.02, chrome, X1 - 0.6, 2.25, Z1 - 0.6, 'shower'); box(0.03, 0.5, 0.03, chrome, X1 - 0.6, 2.45, Z1 - 0.6, 0, 'shower');
  box(0.3, 0.005, 0.04, black, X1 - 0.6, 0.008, Z1 - 1.0, 0, undefined, false);
  block(sx0 - 0.05, Z1 - 1.32, sx0 + 0.03, Z1);
  // the freestanding bath
  { const bx = X1 - 1.75, bz = BATH.z0 + 0.5; const b = MeshBuilder.CreateCapsule(nm('bath'), { height: 1.7, radius: 0.38, tessellation: 24 }, sc); b.rotation.z = Math.PI / 2; b.scaling.set(1, 1, 1.0); place(b, white, bx, 0.38, bz, 0, true, 'bath');
    const water = MeshBuilder.CreateGround(nm('bathw'), { width: 1.4, height: 0.56 }, sc); place(water, pbr({ col: '#9CC4D6', rough: 0.02, alpha: 0.5 }), bx, 0.72, bz, 0, false, 'bath'); water.setEnabled(false); (root as any)._bathw = water;
    cyl(0.03, 0.9, chrome, bx - 0.95, 0.45, bz); block(bx - 0.95, bz - 0.42, bx + 0.9, bz + 0.42); }
  const bathWater: Mesh = (root as any)._bathw;
  // towels, a plant
  box(0.04, 0.6, 0.45, pbr({ col: '#E4DDD2', rough: 1 }), ROOMX + 0.03, 1.2, BATH.z0 + 0.5, 0);
  // ---- the bedroom ----
  // the bed: headboard against the wall between the rooms, the mattress, the duvet, the pillows, a throw in your colour
  const bedX = ROOMX + 2.8, bedZ = BED.z1 - 1.25;
  box(2.0, 1.3, 0.12, fabric, bedX, 0.65, BED.z1 - 0.07, 0); for (let i = 0; i < 9; i++) box(0.012, 1.2, 0.02, black, bedX - 0.88 + i * 0.22, 0.66, BED.z1 - 0.14, 0, undefined, false);
  box(1.9, 0.3, 2.1, oak, bedX, 0.2, bedZ, 0, 'bed'); box(1.82, 0.22, 2.0, linen, bedX, 0.46, bedZ, 0, 'bed'); box(1.86, 0.08, 1.4, pbr({ col: '#D9D2C6', rough: 0.95 }), bedX, 0.6, bedZ - 0.25, 0, 'bed');
  box(1.86, 0.05, 0.45, pbr({ col: accent, rough: 0.9 }), bedX, 0.66, bedZ - 0.75, 0, 'bed');
  for (const px of [-0.45, 0.45]) { const pl = MeshBuilder.CreateCapsule(nm('pillow'), { height: 0.7, radius: 0.09, tessellation: 12 }, sc); pl.rotation.z = Math.PI / 2; pl.scaling.set(1, 1, 2.2); place(pl, white, bedX + px, 0.66, BED.z1 - 0.45, 0, true, 'bed'); }
  block(bedX - 1.0, bedZ - 1.08, bedX + 1.0, BED.z1);
  // the nightstands, the lamp on one, the clock on the other
  for (const sx of [-1.3, 1.3]) { box(0.5, 0.5, 0.42, oak, bedX + sx, 0.25, BED.z1 - 0.3, 0); block(bedX + sx - 0.28, BED.z1 - 0.55, bedX + sx + 0.28, BED.z1); }
  const lampX = bedX - 1.3, lampZ = BED.z1 - 0.3; cyl(0.12, 0.3, brass, lampX, 0.65, lampZ, 'lamp', 0.05); const shade = cyl(0.32, 0.26, pbr({ col: '#E9DCC2', rough: 0.9, emis: '#FFD9A0', emisK: 0.6 }), lampX, 0.93, lampZ, 'lamp', 0.24);
  const clockT = new DynamicTexture(nm('clock'), { width: 256, height: 96 }, sc, false); const cm = new StandardMaterial(nm('clockM'), sc); cm.diffuseTexture = clockT; cm.emissiveTexture = clockT; cm.disableLighting = true;
  box(0.24, 0.1, 0.08, black, bedX + 1.3, 0.55, BED.z1 - 0.3, 0, 'clock'); flat(0.2, 0.075, cm, bedX + 1.3, 0.55, BED.z1 - 0.341, Math.PI, 'clock');
  // the armchair by the window, a low table
  { const ax = X1 - 0.6, az = Z0 + 0.7; box(0.75, 0.42, 0.75, fabric, ax, 0.21, az, 0, 'armchair'); box(0.12, 0.75, 0.75, fabric, ax + 0.32, 0.6, az, 0); for (const s of [-1, 1]) box(0.75, 0.6, 0.12, fabric, ax, 0.3, az + s * 0.32, 0); block(ax - 0.4, az - 0.4, ax + 0.4, az + 0.4); }
  // the light switch by the bedroom door, and the ceiling light
  box(0.02, 0.12, 0.08, white, ROOMX + 0.015, 1.15, BED_DOOR.z0 - 0.2, 0, 'switch');
  cyl(0.5, 0.04, pbr({ col: '#FFF3DE', emis: '#FFF1D8', emisK: 1.2 }), bedX, H - 0.02, -1.2, undefined); const ceilLamp = root.getChildMeshes().slice(-1)[0];
  // ---- the dressing alcove at the end of the hall: the wardrobe (your look) ----
  box(HALL.x1 - HALL.x0 - 0.1, 2.4, 0.6, oak, (HALL.x0 + HALL.x1) / 2, 1.2, Z0 + 0.31, 0, 'wardrobe'); for (const x of [-0.35, 0.35]) box(0.01, 2.3, 0.005, black, (HALL.x0 + HALL.x1) / 2 + x, 1.2, Z0 + 0.615, 0, undefined, false);
  for (const x of [-0.05, 0.05]) cyl(0.016, 0.3, brass, (HALL.x0 + HALL.x1) / 2 + x, 1.2, Z0 + 0.64, 'wardrobe');
  block(HALL.x0, Z0, HALL.x1, Z0 + 0.62);
  // ---- the lights: the hall, the bathroom, the bedroom's ceiling light and the bedside lamp ----
  const L = (x: number, y: number, z: number, k: number, col: string, range: number) => { const l = new PointLight(nm('l'), new Vector3(x, y, z), sc); l.intensity = k; l.range = range; l.diffuse = Color3.FromHexString(col); return l; };
  const hallL = L((HALL.x0 + HALL.x1) / 2, H - 0.3, 0, 0.55, '#FFE6C4', 6), bathL = L(ROOMX + 2.8, H - 0.3, (BATH.z0 + Z1) / 2, 0.85, '#F4F1EA', 7);
  const mainL = L(bedX, H - 0.3, -1.2, 0.9, '#FFE9CC', 8), lampL = L(lampX, 1.0, lampZ - 0.1, 0.6, '#FFC98A', 5);
  const S: any = { mainOn: true, lampOn: true, shower: null as ParticleSystem | null, wash: 0, loo: 0, bath: false };
  // water: the shower, the tap, the flush (soft particles)
  const drop = (() => { const t = new DynamicTexture(nm('drop'), { width: 16, height: 32 }, sc, false), x = t.getContext() as CanvasRenderingContext2D, g = x.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(210,230,245,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(6, 0, 4, 32); t.hasAlpha = true; t.update(); return t; })();
  const water = (at: Vector3, box2: number, rate: number, life: number) => { const ps = new ParticleSystem(nm('w'), 2000, sc); ps.particleTexture = drop; ps.emitter = at; ps.minEmitBox = new Vector3(-box2, 0, -box2); ps.maxEmitBox = new Vector3(box2, 0, box2);
    ps.direction1 = new Vector3(0, -1, 0); ps.direction2 = new Vector3(0, -1, 0); ps.minEmitPower = 2.5; ps.maxEmitPower = 3; ps.minLifeTime = life; ps.maxLifeTime = life * 1.1; ps.minSize = 0.01; ps.maxSize = 0.018; ps.minScaleY = 6; ps.maxScaleY = 10; ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    ps.color1 = new Color4(0.85, 0.9, 0.95, 0.6); ps.color2 = new Color4(0.8, 0.88, 0.95, 0.5); ps.colorDead = new Color4(0.8, 0.88, 0.95, 0); ps.emitRate = rate; ps.gravity = new Vector3(0, -6, 0); ps.start(); return ps; };
  const W2 = (lx: number, ly: number, lz: number) => new Vector3(lx, ly, lz);
  const api: Suite = {
    root, blocks, casters, metals, doors, bed: { x: bedX, z: bedZ - 0.2, yaw: Math.PI }, lights: [hallL, bathL, mainL, lampL],
    meshes: () => root.getChildMeshes(),
    inside: (x, z) => x > SUITE.x0 && x < X1 && z > Z0 && z < Z1,
    walkable(x, z, open) {
      const r = 0.25, inR = (x0: number, z0: number, x1: number, z1: number) => x > x0 + r && x < x1 - r && z > z0 + r && z < z1 - r;
      let ok = inR(HALL.x0, Z0, HALL.x1, Z1) || inR(ROOMX, BATH.z0, X1, Z1) || inR(ROOMX, Z0, X1, BED.z1);
      if (!ok && open.bath > 0.6 && z > BATH_DOOR.z0 + 0.1 && z < BATH_DOOR.z1 - 0.1 && x > HALL.x1 - 0.5 && x < ROOMX + 0.5) ok = true;
      if (!ok && open.bed > 0.6 && z > BED_DOOR.z0 + 0.1 && z < BED_DOOR.z1 - 0.1 && x > HALL.x1 - 0.5 && x < ROOMX + 0.5) ok = true;
      if (!ok) return false; for (const b of blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return false; return true;
    },
    use(act) {
      if (act === 'lamp') { S.lampOn = !S.lampOn; return S.lampOn ? 'The bedside lamp: on' : 'The bedside lamp: off'; }
      if (act === 'switch') { S.mainOn = !S.mainOn; return S.mainOn ? 'The light: on' : 'The light: off'; }
      if (act === 'toilet') { if (S.loo > 0) return ''; S.loo = 6.6; const w = water(W2(ROOMX + 0.45, 0.6, Z1 - 0.35), 0.08, 300, 0.12); setTimeout(() => w.dispose(), 6000); return 'Flushed'; }
      if (act === 'basin') { if (S.wash > 0) return ''; S.wash = 4.6; const w = water(W2(vx, 1.08, Z1 - 0.2), 0.008, 900, 0.07); setTimeout(() => { w.dispose(); }, 4400); setTimeout(() => S.wash = 0, 4600); return 'Washing your hands…'; }
      if (act === 'shower') { if (S.shower) { S.shower.dispose(); S.shower = null; return 'The shower: off'; } S.shower = water(W2(X1 - 0.6, 2.22, Z1 - 0.6), 0.12, 1800, 0.55); return 'The shower: on'; }
      if (act === 'bath') { S.bath = !S.bath; bathWater.setEnabled(S.bath); return S.bath ? 'The bath is run' : 'The bath is empty'; }
      if (act === 'mirror') return 'The mirror';
      if (act === 'clock') { const d = new Date(); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
      if (act === 'armchair') return 'An armchair by the window';
      return '';
    },
    step(t, dt) {
      if (S.loo > 0) S.loo -= dt;
      mainL.intensity = S.mainOn ? 0.9 : 0; lampL.intensity = S.lampOn ? 0.6 : 0; (shade.material as PBRMaterial).emissiveColor = Color3.FromHexString('#FFD9A0').scale(S.lampOn ? 0.6 : 0.02);
      if (ceilLamp && ceilLamp.material) (ceilLamp.material as PBRMaterial).emissiveColor = Color3.FromHexString('#FFF1D8').scale(S.mainOn ? 1.2 : 0.02);
      if (Math.floor(t) !== S.sec) { S.sec = Math.floor(t); const x = clockT.getContext() as CanvasRenderingContext2D, d = new Date(); x.fillStyle = '#050505'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#FF3B30'; x.font = '700 64px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(`${String(d.getHours()).padStart(2, '0')}${d.getSeconds() % 2 ? ':' : ' '}${String(d.getMinutes()).padStart(2, '0')}`, 128, 50); clockT.update(); }
    },
  };
  // the mirror reflects the bathroom (and the bedroom's door beyond)
  mirrorTex.renderList = root.getChildMeshes().filter(m => m !== mirror);
  for (const m of root.getChildMeshes()) m.isPickable = !!(m.metadata && m.metadata.act);
  void Space;
  return api;
}
