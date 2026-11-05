// The Operations office, built in Babylon.js to the main game's plan: where the flying is planned. A long oak desk on
// black steel legs, an ultra-wide curved monitor showing your schedule as it is now (the game draws it, the same
// timeline as the Schedule screen), a keyboard and a mouse, a high-backed chair; archive folders stacked on the desk
// and a tall archive rack full of binders and boxes; a red digital clock; a window onto an airport's control tower and
// apron at dusk; the door. Our own textures and shapes. Babylon.js's coordinates (x right, y up, z towards the window).
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, PointLight, VertexData } from '@babylonjs/core';
import * as P from '../lounge/pictures';
import { IS_PC } from '../../core/app';

export const RW = 6.0, RD = 5.4, RH = 3.0;
const X0 = -RW / 2, X1 = RW / 2, Z0 = -RD / 2, Z1 = RD / 2;
export interface Ops { root: TransformNode; blocks: number[][]; casters: AbstractMesh[]; metals: PBRMaterial[]; monitor: { tex: DynamicTexture; w: number; h: number }; clock: DynamicTexture; seat: { x: number; z: number; yaw: number }; sun: number }

/** The view: a control tower over an apron at dusk, aircraft at the stands with their lights on. */
function towerView(): HTMLCanvasElement {
  const [c, x] = P.canvas(2048, 1024), W = 2048, H = 1024, r = P.rng(9);
  const g = x.createLinearGradient(0, 0, 0, H * 0.62); g.addColorStop(0, '#1B2340'); g.addColorStop(0.55, '#7A4A62'); g.addColorStop(1, '#F0A060'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#2A2E3A'; x.beginPath(); x.moveTo(0, H * 0.6); for (let i = 0; i <= 20; i++) x.lineTo(i * W / 20, H * (0.52 + r() * 0.06)); x.lineTo(W, H * 0.62); x.lineTo(0, H * 0.62); x.fill();
  x.fillStyle = '#3A3D44'; x.fillRect(0, H * 0.62, W, H * 0.38);
  x.strokeStyle = 'rgba(240,200,80,.6)'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(i * 380, H); x.lineTo(i * 300 + 200, H * 0.66); x.stroke(); }
  // the tower
  x.fillStyle = '#C8CCD4'; x.fillRect(W * 0.66, H * 0.22, 60, H * 0.42); x.fillStyle = '#2B3442'; x.beginPath(); x.moveTo(W * 0.66 - 70, H * 0.15); x.lineTo(W * 0.66 + 130, H * 0.15); x.lineTo(W * 0.66 + 100, H * 0.24); x.lineTo(W * 0.66 - 40, H * 0.24); x.fill();
  x.fillStyle = 'rgba(120,220,255,.75)'; x.fillRect(W * 0.66 - 50, H * 0.165, 160, 30); x.fillStyle = '#FF3020'; x.beginPath(); x.arc(W * 0.66 + 30, H * 0.12, 8, 0, 7); x.fill();
  // aircraft at the stands
  for (let i = 0; i < 5; i++) { const ax = 160 + i * 330, ay = H * 0.74; x.fillStyle = '#E8ECF0'; x.fillRect(ax, ay, 210, 26); x.beginPath(); x.moveTo(ax + 40, ay + 10); x.lineTo(ax + 130, ay - 34); x.lineTo(ax + 150, ay + 10); x.fill(); x.fillStyle = '#FFE8A0'; x.fillRect(ax + 214, ay + 8, 6, 6); x.fillStyle = '#FF3020'; x.fillRect(ax + 100, ay - 4, 5, 5); }
  for (let i = 0; i < 90; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,220,140,.9)' : 'rgba(140,200,255,.8)'; x.fillRect(r() * W, H * (0.62 + r() * 0.08), 3, 3); }
  return c;
}

export function buildOps(sc: Scene, color: string, progress: (p: number, s: string) => void): Ops {
  const root = new TransformNode('ops', sc), blocks: number[][] = [], casters: AbstractMesh[] = [], metals: PBRMaterial[] = [];
  let n = 0; const nm = (k: string) => k + '-' + (n++);
  const block = (xa: number, za: number, xb: number, zb: number) => blocks.push([Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)]);
  const tex = (c: HTMLCanvasElement, u = 1, v = 1): DynamicTexture => { const t = new DynamicTexture(nm('t'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: string; tex?: Texture; metal?: number; rough?: number; emis?: string; emisK?: number }): PBRMaterial => {
    const m = new PBRMaterial(nm('m'), sc); m.maxSimultaneousLights = 8; m.albedoColor = o.col ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex;
    m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6; if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis).scale(o.emisK || 1); if ((o.metal || 0) >= 0.6) metals.push(m); return m; };
  const place = (m: Mesh, mat: any, x: number, y: number, z: number, ry = 0, cast = true, act?: string) => { m.position.set(x, y, z); m.rotation.y = ry; m.material = mat; m.receiveShadows = true; m.parent = root; if (cast) casters.push(m); if (act) m.metadata = { act }; return m; };
  const box = (w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry = 0, act?: string) => place(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, sc), mat, x, y, z, ry, true, act);
  const flat = (w: number, h: number, mat: any, x: number, y: number, z: number, ry: number, act?: string) => place(MeshBuilder.CreatePlane(nm('p'), { width: w, height: h }, sc), mat, x, y, z, ry, false, act);
  progress(20, 'Laying the carpet tiles…');
  const sun = P.daylight();
  const carpet = pbr({ tex: tex(P.noise('#3A3F48', 18, 3), 6, 5), rough: 0.95 }), wallM = pbr({ tex: tex(P.plaster('#C9CDD2'), 2, 1), rough: 0.9 }), oak = pbr({ tex: tex(P.wood('#B88A55', '#6E4A26', 4)), rough: 0.45 });
  const black = pbr({ col: '#16181C', rough: 0.4, metal: 0.4 }), steel = pbr({ col: '#9AA0A8', metal: 0.9, rough: 0.35 });
  { const f = MeshBuilder.CreateGround(nm('floor'), { width: RW, height: RD }, sc); f.material = carpet; f.receiveShadows = true; f.parent = root; }
  { const c = MeshBuilder.CreatePlane(nm('ceil'), { width: RW, height: RD }, sc); c.rotation.x = -Math.PI / 2; c.position.y = RH; c.material = pbr({ col: '#E8E8E4', rough: 0.95 }); c.parent = root; }
  // walls; the window behind the monitor (z = Z1), the door on the left
  const WW = 4.0, WH = 1.6, WY = 1.0;
  flat(RW, WY, wallM, 0, WY / 2, Z1, 0); flat(RW, RH - WY - WH, wallM, 0, WY + WH + (RH - WY - WH) / 2, Z1, 0);
  flat((RW - WW) / 2, WH, wallM, -(WW / 2 + (RW - WW) / 4), WY + WH / 2, Z1, 0); flat((RW - WW) / 2, WH, wallM, WW / 2 + (RW - WW) / 4, WY + WH / 2, Z1, 0);
  flat(RW, RH, wallM, 0, RH / 2, Z0, Math.PI); flat(RD, RH, wallM, X1, RH / 2, 0, Math.PI / 2);
  flat(RD - 1.1, RH, wallM, X0, RH / 2, 0.55, -Math.PI / 2); flat(1.1, RH - 2.15, wallM, X0, 2.15 + (RH - 2.15) / 2, Z0 + 0.55, -Math.PI / 2);
  box(0.05, 2.12, 0.98, pbr({ col: '#5C6168', rough: 0.4, metal: 0.3 }), X0 + 0.03, 1.06, Z0 + 0.55, 0, 'door'); box(0.06, 0.04, 0.18, steel, X0 + 0.09, 1.02, Z0 + 0.9, 0, 'door');
  for (const fx of [-WW / 2, 0, WW / 2]) box(0.06, WH, 0.1, black, fx, WY + WH / 2, Z1 - 0.02); box(WW + 0.06, 0.06, 0.12, black, 0, WY, Z1 - 0.02); box(WW + 0.06, 0.06, 0.12, black, 0, WY + WH, Z1 - 0.02);
  { const vm = new StandardMaterial(nm('view'), sc); const vt = tex(towerView()); vm.diffuseTexture = vt; vm.emissiveTexture = vt; vm.emissiveColor = new Color3(0.8, 0.8, 0.85); vm.disableLighting = true; flat(WW * 1.7, WH * 1.7, vm, 0, WY + WH / 2, Z1 + 1.4, 0, 'window'); }
  progress(45, 'Setting up the desk…');
  // the desk: an oak top on black steel legs, 30 cm in front of the window wall's middle
  const DZ = 1.25;
  box(2.2, 0.045, 0.85, oak, 0, 0.75, DZ); for (const sx of [-1, 1]) { box(0.06, 0.71, 0.7, black, sx * 1.0, 0.355, DZ); box(0.08, 0.02, 0.76, black, sx * 1.0, 0.01, DZ); }
  box(1.94, 0.3, 0.02, black, 0, 0.55, DZ + 0.4); block(-1.12, DZ - 0.45, 1.12, DZ + 0.45);
  // the ultra-wide curved monitor (49 inch), on a stand; its picture is drawn by the game
  const MR = 1.25, MWd = 1.08, MHt = 0.32, ML = MWd / MR, MY = 1.12, mz = DZ + 0.15;
  const MWpx = IS_PC ? 4096 : 2560, mon = new DynamicTexture(nm('mon'), { width: MWpx, height: Math.round(MWpx * MHt / MWd) }, sc, true);
  { const x = mon.getContext() as CanvasRenderingContext2D; x.fillStyle = '#0C1A2B'; x.fillRect(0, 0, MWpx, MWpx); x.fillStyle = '#9FB6CC'; x.font = `600 ${Math.round(MWpx / 40)}px Arial`; x.fillText('Loading your schedule…', MWpx * 0.04, MWpx * 0.08); mon.update(true); }
  { const seg = 48, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= seg; i++) { const a = -ML / 2 + ML * i / seg; for (const yy of [0, 1]) { pos.push(Math.sin(a) * MR, MY - MHt / 2 + yy * MHt, mz - MR + Math.cos(a) * MR); uv.push(i / seg, yy); } }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const m = new Mesh(nm('screen'), sc), vd = new VertexData(), nr: number[] = []; vd.positions = pos; vd.uvs = uv; vd.indices = idx; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
    const sm = new StandardMaterial(nm('screenM'), sc); sm.diffuseTexture = mon; sm.emissiveTexture = mon; sm.emissiveColor = Color3.White(); sm.disableLighting = true; sm.backFaceCulling = false; m.material = sm; m.parent = root; m.metadata = { act: 'monitor' };
    const bz = m.clone(nm('bezel')); bz.material = black; bz.position.z = 0.012; bz.scaling.set(1.02, 1.08, 1); bz.metadata = { act: 'monitor' };
  }
  box(0.08, 0.32, 0.06, black, 0, 0.92, mz + 0.06); box(0.32, 0.015, 0.22, black, 0, 0.78, mz + 0.06);
  box(0.46, 0.02, 0.15, black, -0.05, 0.783, DZ - 0.2); box(0.065, 0.025, 0.11, black, 0.35, 0.785, DZ - 0.18);
  // archive folders stacked on the desk
  const fcols = ['#2A4A6B', '#7A2E22', '#3A5A32', '#8C6A2A', '#3A3A44'], r = P.rng(4);
  for (let i = 0; i < 7; i++) box(0.32, 0.05, 0.25, pbr({ col: fcols[i % 5], rough: 0.7 }), 0.85, 0.8 + i * 0.05, DZ + 0.05, (r() - 0.5) * 0.25, 'files');
  // the high-backed chair, facing the monitor
  const chZ = DZ - 0.72, chM = pbr({ col: '#202328', rough: 0.55 });
  box(0.6, 0.12, 0.56, chM, 0, 0.5, chZ, 0, 'chair'); box(0.58, 1.0, 0.1, chM, 0, 1.05, chZ - 0.3, 0, 'chair'); for (const sx of [-0.32, 0.32]) box(0.07, 0.06, 0.42, chM, sx, 0.72, chZ);
  box(0.05, 0.42, 0.05, steel, 0, 0.24, chZ); block(-0.35, chZ - 0.38, 0.35, chZ + 0.3);
  progress(70, 'Filing the archive…');
  // the tall archive rack on the right, full of binders and boxes
  const rx = X1 - 0.25;
  for (const z of [-1.6, -0.2, 1.2]) for (const sy of [0, 1]) box(0.04, 2.4, 0.04, steel, rx + (sy ? 0.2 : -0.2), 1.2, z);
  for (let s = 0; s < 6; s++) { const y = 0.1 + s * 0.44; box(0.42, 0.02, 2.9, steel, rx, y, -0.2);
    let z = -1.6; while (z < 1.2) { const box_ = r() < 0.25, w = box_ ? 0.32 : 0.06 + r() * 0.02, h = box_ ? 0.24 : 0.32; box(0.3, h, w, pbr({ col: box_ ? '#B89A6A' : fcols[Math.floor(r() * 5)], rough: 0.7 }), rx - 0.02, y + 0.01 + h / 2, z + w / 2, 0, 'files'); z += w + 0.01; } }
  block(rx - 0.25, -1.75, X1, 1.35);
  // the red digital clock above the door
  const clock = new DynamicTexture(nm('clock'), { width: 512, height: 128 }, sc, true);
  { const cm = new StandardMaterial(nm('clockM'), sc); cm.diffuseTexture = clock; cm.emissiveTexture = clock; cm.emissiveColor = Color3.White(); cm.disableLighting = true; box(0.06, 0.2, 0.7, black, X0 + 0.03, 2.5, Z0 + 0.55); flat(0.64, 0.16, cm, X0 + 0.065, 2.5, Z0 + 0.55, -Math.PI / 2); }
  // a strip of company colour along the wall, and the ceiling's light panels
  box(RW - 0.1, 0.05, 0.02, pbr({ col: /^#[0-9a-f]{6}$/i.test(color) ? color : '#2C8CFF', rough: 0.4, emis: /^#[0-9a-f]{6}$/i.test(color) ? color : '#2C8CFF', emisK: 0.3 }), 0, 1.1, Z0 + 0.01);
  for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1.2], [1.3, 1.2]]) box(0.6, 0.02, 0.6, pbr({ col: '#FFFFFF', emis: '#F2F6FF', emisK: 1.2 }), x, RH - 0.01, z);
  const light = new PointLight('ceil', new Vector3(0, RH - 0.3, 0), sc); light.intensity = 0.9; light.range = 9; light.diffuse = Color3.FromHexString('#F2F6FF');
  root.getChildMeshes().forEach(m => { m.isPickable = !!(m.metadata && m.metadata.act); });
  return { root, blocks, casters, metals, monitor: { tex: mon, w: MWpx, h: Math.round(MWpx * MHt / MWd) }, clock, seat: { x: 0, z: chZ, yaw: 0 }, sun };
}
export function opsBlocked(O: Ops, x: number, z: number): boolean {
  const r = 0.25; if (x < X0 + 0.3 || x > X1 - 0.3 || z < Z0 + 0.3 || z > Z1 - 0.3) return true;
  for (const b of O.blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return true;
  return false;
}
/** The monitor's picture, as the game drew it. */
export function opsMonitor(O: Ops, url: string) {
  const im = new Image(); im.onload = () => { const x = O.monitor.tex.getContext() as CanvasRenderingContext2D; x.drawImage(im, 0, 0, O.monitor.w, O.monitor.h); O.monitor.tex.update(true); }; im.src = url;
}
/** The red clock: the time now. */
export function opsClock(O: Ops) {
  const x = O.clock.getContext() as CanvasRenderingContext2D, d = new Date(); x.fillStyle = '#05080C'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#FF5A3C'; x.font = '700 96px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#FF3020'; x.shadowBlur = 14;
  x.fillText(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, 256, 68); O.clock.update(true);
}
