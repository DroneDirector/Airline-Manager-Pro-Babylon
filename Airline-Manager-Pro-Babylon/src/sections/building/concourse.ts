// The joined building's halls, to the main game's plan: the staff corridor (2.4 m wide, 3 m high) that joins your office
// and the Operations office, and at its end the door onto the concourse: a long hall (39 × 12 m, 5.2 m high) with a stone
// floor, a glass wall onto the apron, shops along the other wall, rows of seats, pillars and plants, the flight boards
// hanging before the lounge, and the lounge's doors at the far end. Our own textures and shapes.
// The building's coordinates (Babylon.js's): x east, y up, z north; your office's middle at the origin.
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, PointLight } from '@babylonjs/core';
import * as P from '../lounge/pictures';
import { IS_PC } from '../../core/app';
import { TRN_DOOR } from '../training/build';

export const COR = { x0: -5.6, x1: -3.2, z0: -6, z1: 18.5, h: 3.0 };
export const CON = { x0: -9, x1: 30, z0: -18, z1: -6, h: 5.2 };
export const STAFF_DOOR = { x0: -5.05, x1: -4.05 };       // in the concourse's north wall (z = CON.z1)
export const LOUNGE_DOOR = { z: -12, w: 1.9, h: 2.4 };    // in the concourse's east wall (x = CON.x1)
export const MUSEUM_DOOR = { z: -12, w: 2.4, h: 3.0 };    // in the concourse's west wall (x = CON.x0): the Vortex Gallery's portal
export const OFFICE_DOOR = { z0: -3.1, z1: -2.1 };        // in the corridor's east wall (x = COR.x1)
export const OPS_AT = { x: -0.2, z: 14 };                 // the Operations office's middle
export const OPS_DOOR = { z0: 11.36, z1: 12.34 };         // its door in the corridor's east wall
export interface Halls { root: TransformNode; blocks: number[][]; casters: AbstractMesh[]; metals: PBRMaterial[]; staffDoor: Mesh; boards: { tex: DynamicTexture; c: HTMLCanvasElement; kind: 'dep' | 'arr' }[] }

/** The view onto the apron through the glass wall: aircraft at the gates, the taxiway, the hills. */
function apronView(sun: number): HTMLCanvasElement {
  const [c, x] = P.canvas(4096, 1024), W = 4096, H = 1024, r = P.rng(21);
  const sky = x.createLinearGradient(0, 0, 0, H * 0.55); if (sun > 0.3) { sky.addColorStop(0, '#5E95C8'); sky.addColorStop(1, '#CFE3F2'); } else { sky.addColorStop(0, '#0E1530'); sky.addColorStop(1, '#3A3456'); } x.fillStyle = sky; x.fillRect(0, 0, W, H);
  x.fillStyle = sun > 0.3 ? '#6E7C6A' : '#20232C'; x.beginPath(); x.moveTo(0, H * 0.52); for (let i = 0; i <= 40; i++) x.lineTo(i * W / 40, H * (0.44 + r() * 0.08)); x.lineTo(W, H * 0.56); x.lineTo(0, H * 0.56); x.fill();
  x.fillStyle = sun > 0.3 ? '#8A8F96' : '#2E3138'; x.fillRect(0, H * 0.56, W, H * 0.44);
  x.strokeStyle = 'rgba(232,184,32,.75)'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, H * 0.66); x.lineTo(W, H * 0.66); x.stroke();
  for (let i = 0; i < 6; i++) { const ax = 220 + i * 680, ay = H * 0.8, s = 1.4; x.fillStyle = '#EEF1F4'; x.fillRect(ax, ay, 300 * s, 40 * s); x.beginPath(); x.moveTo(ax + 80 * s, ay + 14); x.lineTo(ax + 190 * s, ay - 60 * s); x.lineTo(ax + 220 * s, ay + 14); x.fill(); x.fillStyle = '#1C2A4A'; x.fillRect(ax + 260 * s, ay - 50 * s, 34 * s, 54 * s);
    x.fillStyle = '#9AA0A8'; x.fillRect(ax - 140, ay - 30, 150, 26); if (sun <= 0.3) { x.fillStyle = '#FFE8A0'; for (let k = 0; k < 9; k++) x.fillRect(ax + 30 + k * 40, ay + 12, 8, 6); } }
  return c;
}

export function buildHalls(sc: Scene, progress: (p: number, s: string) => void, sun: number): Halls {
  const root = new TransformNode('halls', sc), blocks: number[][] = [], casters: AbstractMesh[] = [], metals: PBRMaterial[] = [], boards: Halls['boards'] = [];
  let n = 0; const nm = (k: string) => k + '-' + (n++);
  const block = (xa: number, za: number, xb: number, zb: number) => blocks.push([Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)]);
  const tex = (c: HTMLCanvasElement, u = 1, v = 1): DynamicTexture => { const t = new DynamicTexture(nm('t'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: string; tex?: Texture; metal?: number; rough?: number; emis?: string; emisK?: number; alpha?: number }): PBRMaterial => {
    const m = new PBRMaterial(nm('m'), sc); m.maxSimultaneousLights = 8; m.albedoColor = o.col ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex;
    m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6; if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis).scale(o.emisK || 1); if (o.alpha != null) { m.alpha = o.alpha; m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; } if ((o.metal || 0) >= 0.6) metals.push(m); return m; };
  const place = (m: Mesh, mat: any, x: number, y: number, z: number, ry = 0, cast = true, act?: string) => { m.position.set(x, y, z); m.rotation.y = ry; m.material = mat; m.receiveShadows = true; m.parent = root; if (cast) casters.push(m); if (act) m.metadata = { act }; return m; };
  const box = (w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry = 0, act?: string, cast = true) => place(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, sc), mat, x, y, z, ry, cast, act);
  const flat = (w: number, h: number, mat: any, x: number, y: number, z: number, ry: number, act?: string) => place(MeshBuilder.CreatePlane(nm('p'), { width: w, height: h }, sc), mat, x, y, z, ry, false, act);
  const picMat = (c: HTMLCanvasElement, k = 0.35) => { const m = new StandardMaterial(nm('pm'), sc); const t = tex(c); m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new Color3(k, k, k); m.specularColor = new Color3(0.05, 0.05, 0.05); return m; };
  const wallM = pbr({ tex: tex(P.plaster('#E2E0DA'), 3, 1), rough: 0.9 }), steel = pbr({ col: '#5A626C', metal: 0.8, rough: 0.35 }), dark = pbr({ col: '#2A2E35', rough: 0.4, metal: 0.3 });
  progress(62, 'The staff corridor…');
  // ---- the staff corridor: vinyl floor, a skirting line, ceiling lights; the doors are the rooms' own ----
  { const { x0, x1, z0, z1, h } = COR, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const f = MeshBuilder.CreateGround(nm('corF'), { width: w, height: d }, sc); f.position.set(cx, 0.001, cz); f.material = pbr({ tex: tex(P.noise('#9AA3AD', 14, 8), 2, 10), rough: 0.5 }); f.receiveShadows = true; f.parent = root;
    const c = MeshBuilder.CreatePlane(nm('corC'), { width: w, height: d }, sc); c.rotation.x = -Math.PI / 2; c.position.set(cx, h, cz); c.material = pbr({ col: '#ECEBE6', rough: 0.95 }); c.parent = root;
    // the west wall, with the opening for the Training room's double doors
    flat(TRN_DOOR.z0 - z0, h, wallM, x0 + 0.005, h / 2, (z0 + TRN_DOOR.z0) / 2, -Math.PI / 2); flat(z1 - TRN_DOOR.z1, h, wallM, x0 + 0.005, h / 2, (TRN_DOOR.z1 + z1) / 2, -Math.PI / 2);
    flat(TRN_DOOR.z1 - TRN_DOOR.z0, h - 2.15, wallM, x0 + 0.005, 2.15 + (h - 2.15) / 2, (TRN_DOOR.z0 + TRN_DOOR.z1) / 2, -Math.PI / 2); flat(w, h, wallM, cx, h / 2, z1, 0);
    // the east wall, with the openings for your office's and the Operations office's doors (the rooms' own walls are behind)
    const seg = (za: number, zb: number) => { if (zb - za > 0.01) flat(zb - za, h, wallM, x1 - 0.005, h / 2, (za + zb) / 2, Math.PI / 2); };
    const lintel = (za: number, zb: number) => flat(zb - za, h - 2.15, wallM, x1 - 0.005, 2.15 + (h - 2.15) / 2, (za + zb) / 2, Math.PI / 2);
    seg(z0, OFFICE_DOOR.z0); seg(OFFICE_DOOR.z1, OPS_DOOR.z0); seg(OPS_DOOR.z1, z1); lintel(OFFICE_DOOR.z0, OFFICE_DOOR.z1); lintel(OPS_DOOR.z0, OPS_DOOR.z1);
    // the corridor's own end wall at the concourse, round the staff door
    const sw0 = STAFF_DOOR.x0, sw1 = STAFF_DOOR.x1; flat(sw0 - x0, h, wallM, (x0 + sw0) / 2, h / 2, z0, Math.PI); flat(x1 - sw1, h, wallM, (sw1 + x1) / 2, h / 2, z0, Math.PI); flat(sw1 - sw0, h - 2.15, wallM, (sw0 + sw1) / 2, 2.15 + (h - 2.15) / 2, z0, Math.PI);
    for (let z = z0 + 2; z < z1; z += 4) box(0.8, 0.03, 0.8, pbr({ col: '#FFFFFF', emis: '#F2F4F8', emisK: 1.4 }), cx, h - 0.015, z, 0, undefined, false);
    const l = new PointLight('corL', new Vector3(cx, h - 0.4, cz), sc); l.intensity = 0.9; l.range = d; l.diffuse = Color3.FromHexString('#F4F6FA');
    // the signs beside the doors, airport style
    const sign = (t: string, z: number) => flat(0.9, 0.22, picMat(P.sign(t, '#14202E', '#F2C230', 512, 128, '700 46px Arial, sans-serif'), 0.6), x1 - 0.01, 2.3, z, Math.PI / 2);
    flat(1.1, 0.22, picMat(P.sign('Training room', '#14202E', '#F2C230', 512, 128, '700 46px Arial, sans-serif'), 0.6), x0 + 0.01, 2.4, (TRN_DOOR.z0 + TRN_DOOR.z1) / 2, -Math.PI / 2);
    sign('Your office', (OFFICE_DOOR.z0 + OFFICE_DOOR.z1) / 2 + 1.0); sign('Operations', (OPS_DOOR.z0 + OPS_DOOR.z1) / 2 - 1.0);
    flat(1.0, 0.22, picMat(P.sign('Concourse', '#14202E', '#F2C230', 512, 128, '700 46px Arial, sans-serif'), 0.6), (sw0 + sw1) / 2, 2.4, z0 + 0.01, Math.PI);
  }
  progress(70, 'The concourse…');
  // ---- the concourse ----
  const { x0, x1, z0, z1, h } = CON, W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  { const fc = (() => { const [c, x] = P.canvas(1024, 1024), r = P.rng(13); x.fillStyle = '#C9C4BA'; x.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 14000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '120,114,104' : '236,232,224'},${0.15 + r() * 0.25})`; x.fillRect(r() * 1024, r() * 1024, 2 + r() * 3, 2 + r() * 3); } x.strokeStyle = 'rgba(90,86,78,.35)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 256, 0); x.lineTo(i * 256, 1024); x.stroke(); x.beginPath(); x.moveTo(0, i * 256); x.lineTo(1024, i * 256); x.stroke(); } return c; })();
    const f = MeshBuilder.CreateGround(nm('conF'), { width: W, height: D }, sc); f.position.set(cx, 0, cz); const fm = pbr({ tex: tex(fc, W / 4, D / 4), rough: 0.25 }); fm.environmentIntensity = 0.8; f.material = fm; f.receiveShadows = true; f.parent = root;
    const c = MeshBuilder.CreatePlane(nm('conC'), { width: W, height: D }, sc); c.rotation.x = -Math.PI / 2; c.position.set(cx, h, cz); c.material = pbr({ col: '#F0EFEA', rough: 0.9 }); c.parent = root; }
  // the north wall with the staff door and the shopfronts; the west wall; the east wall round the lounge's doors
  { const sd0 = STAFF_DOOR.x0, sd1 = STAFF_DOOR.x1; flat(sd0 - x0, h, wallM, (x0 + sd0) / 2, h / 2, z1, 0); flat(sd1 - sd0, h - 2.15, wallM, (sd0 + sd1) / 2, 2.15 + (h - 2.15) / 2, z1, 0); flat(x1 - sd1, h, wallM, (sd1 + x1) / 2, h / 2, z1, 0);
    // the west wall, round the Vortex Gallery's portal (its frame, arch and name come with the museum)
    { const mz0 = MUSEUM_DOOR.z - MUSEUM_DOOR.w / 2, mz1 = MUSEUM_DOOR.z + MUSEUM_DOOR.w / 2;
      flat(mz0 - z0, h, wallM, x0, h / 2, (z0 + mz0) / 2, -Math.PI / 2); flat(z1 - mz1, h, wallM, x0, h / 2, (mz1 + z1) / 2, -Math.PI / 2); flat(MUSEUM_DOOR.w, h - MUSEUM_DOOR.h, wallM, x0, MUSEUM_DOOR.h + (h - MUSEUM_DOOR.h) / 2, MUSEUM_DOOR.z, -Math.PI / 2); }
    const lz0 = LOUNGE_DOOR.z - LOUNGE_DOOR.w / 2 - 0.15, lz1 = LOUNGE_DOOR.z + LOUNGE_DOOR.w / 2 + 0.15;
    flat(lz0 - z0, h, wallM, x1, h / 2, (z0 + lz0) / 2, Math.PI / 2); flat(z1 - lz1, h, wallM, x1, h / 2, (lz1 + z1) / 2, Math.PI / 2); flat(lz1 - lz0, h - LOUNGE_DOOR.h - 0.1, wallM, x1, LOUNGE_DOOR.h + 0.1 + (h - LOUNGE_DOOR.h - 0.1) / 2, LOUNGE_DOOR.z, Math.PI / 2);
    // the lounge's name over its doors
    flat(3.2, 0.6, picMat(P.sign('Business lounge', '#1A120C', '#E2C27A', 1024, 192, '700 92px Georgia, serif'), 0.7), x1 - 0.02, LOUNGE_DOOR.h + 0.65, LOUNGE_DOOR.z, Math.PI / 2);
  }
  // the staff door (metal, opens into the concourse), with its sign
  const staffDoor = box(STAFF_DOOR.x1 - STAFF_DOOR.x0 - 0.04, 2.12, 0.05, pbr({ col: '#7A828C', metal: 0.5, rough: 0.4 }), (STAFF_DOOR.x0 + STAFF_DOOR.x1) / 2, 1.06, z1 - 0.03, 0, 'staffdoor');
  flat(0.9, 0.22, picMat(P.sign('Staff only', '#14202E', '#F2C230', 512, 128, '700 46px Arial, sans-serif'), 0.6), STAFF_DOOR.x1 + 0.75, 2.0, z1 - 0.01, 0);
  // the glass wall onto the apron: mullions every 3 m, the view beyond
  { const glass = pbr({ col: '#BFD8EA', alpha: 0.12, rough: 0.05, metal: 0.1 }); flat(W, h, glass, cx, h / 2, z0, Math.PI);
    for (let x = x0; x <= x1 + 0.01; x += 3) box(0.12, h, 0.14, steel, x, h / 2, z0 + 0.05); box(W, 0.14, 0.16, steel, cx, h - 0.07, z0 + 0.05); box(W, 0.3, 0.2, steel, cx, 0.15, z0 + 0.05);
    const vm = new StandardMaterial(nm('apron'), sc); const vt = tex(apronView(sun)); vm.diffuseTexture = vt; vm.emissiveTexture = vt; vm.emissiveColor = new Color3(0.3 + 0.7 * sun, 0.3 + 0.7 * sun, 0.35 + 0.65 * sun); vm.disableLighting = true;
    flat(W * 2.2, h * 4, vm, cx, h * 1.4, z0 - 26, Math.PI); }
  // the shops along the north wall: lit glass fronts with their names (made up)
  const shops: [string, string, string][] = [['Café Aurora', '#3A2416', '#F4D9A8'], ['News & Books', '#14324A', '#F4F4F0'], ['Duty Free', '#1A1A1A', '#E2C27A'], ['Sky Pharmacy', '#0E5A3A', '#F4F4F0']];
  shops.forEach(([name, bg, fg], i) => { const sx = 0 + i * 7 + 3;
    box(6.2, 3.2, 0.2, dark, sx, 1.6, z1 - 0.1, 0, 'shop'); flat(5.6, 2.4, pbr({ col: '#FFF6E2', emis: '#FFF1D8', emisK: 0.9, rough: 0.2 }), sx, 1.4, z1 - 0.21, 0, 'shop');
    flat(4.0, 0.6, picMat(P.sign(name, bg, fg, 1024, 160, '700 84px Georgia, serif'), 0.8), sx, 3.55, z1 - 0.22, 0, 'shop'); block(sx - 3.1, z1 - 0.4, sx + 3.1, z1); });
  // pillars with plants, and rows of seats facing the glass
  for (const px of [1.5, 10.5, 19.5]) { box(0.7, h, 0.7, wallM, px, h / 2, -12); block(px - 0.35, -12.35, px + 0.35, -11.65);
    box(0.7, 0.55, 0.7, dark, px + 1.2, 0.27, -12); const pl = MeshBuilder.CreateSphere(nm('plant'), { diameter: 1.0, segments: 10 }, sc); place(pl, pbr({ col: '#3C6E34', rough: 0.8 }), px + 1.2, 0.95, -12); pl.scaling.y = 1.3; block(px + 0.85, -12.35, px + 1.55, -11.65); }
  const seatM = pbr({ col: '#2E3B4A', rough: 0.45 }), chromeM = pbr({ col: '#DDE2E8', metal: 1, rough: 0.2 });
  for (const rz of [-15.2, -14.2]) for (const gx of [-6, 2, 13, 21]) { const nS = 5, len = nS * 0.6;
    box(len, 0.05, 0.08, chromeM, gx + len / 2, 0.38, rz); for (let i = 0; i < nS; i++) { const x = gx + 0.3 + i * 0.6; box(0.52, 0.06, 0.5, seatM, x, 0.45, rz, 0, 'seat'); box(0.52, 0.5, 0.06, seatM, x, 0.72, rz + (rz < -14.5 ? 0.25 : -0.25), 0, 'seat'); }
    for (const lx of [gx + 0.1, gx + len - 0.1]) box(0.05, 0.4, 0.4, chromeM, lx, 0.2, rz); block(gx, rz - 0.32, gx + len, rz + 0.32); }
  // the flight boards hanging before the lounge, facing west
  for (const [kind, z] of [['dep', -10.4], ['arr', -13.6]] as ['dep' | 'arr', number][]) {
    const [c] = P.canvas(1024, 640); P.board(c, kind); const t = tex(c); const m = new StandardMaterial(nm('board'), sc); m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = Color3.White(); m.disableLighting = true;
    box(0.12, 1.9, 2.95, dark, 25.9, 3.3, z); flat(2.8, 1.75, m, 25.83, 3.3, z, Math.PI / 2, 'board'); boards.push({ tex: t, c, kind });
    box(0.03, h - 4.25, 0.03, steel, 25.9, 4.25 + (h - 4.25) / 2, z - 1.2); box(0.03, h - 4.25, 0.03, steel, 25.9, 4.25 + (h - 4.25) / 2, z + 1.2);
  }
  // the light: long strips in the ceiling, and the day through the glass
  for (let x = x0 + 3; x < x1; x += 6) for (const z of [-9, -15]) box(4.4, 0.04, 0.4, pbr({ col: '#FFFFFF', emis: '#F6F4EE', emisK: 1.5 }), x, h - 0.02, z, 0, undefined, false);
  for (const lx of IS_PC ? [0, 12, 24] : [6, 20]) { const l = new PointLight(nm('conL'), new Vector3(lx, h - 0.6, cz), sc); l.intensity = 2.2; l.range = 22; l.diffuse = Color3.FromHexString('#F7F3EA'); }
  root.getChildMeshes().forEach(m => { m.isPickable = !!(m.metadata && m.metadata.act); });
  return { root, blocks, casters, metals, staffDoor, boards };
}
