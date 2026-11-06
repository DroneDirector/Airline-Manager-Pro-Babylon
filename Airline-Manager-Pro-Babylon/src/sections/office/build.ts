// Your office, built in Babylon.js to the main game's plan: a warm, panelled corner office of 6.4 × 6.4 m. A walnut
// executive desk with a leather top; your laptop showing the airline, the monitor with the flight planner, a banker's
// lamp, the phone, a notepad, coffee, the conduct reports, a model of one of your aircraft in the company colours and
// your nameplate; a big window over the airport; bookshelves with trophies, aviation posters, your route map, a
// propeller on the wall, a leather sofa and a globe. Everything is our own: drawn textures and simple shapes.
// Babylon.js's coordinates: x to the right, y up, z towards the window; the room's middle at the origin.
import { placePet, Pet, PetData } from './pet';
import './pet-preview';
import { gameSend } from '../../ui/game-frame';
import { toast } from '../../ui/icons';
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, PointLight } from '@babylonjs/core';
import * as P from '../lounge/pictures';
import { IS_PC } from '../../core/app';
import { buildAirliner, repaint } from '../viewer3d/airliner';

export const OW = 6.4, OD = 6.4, OH = 3.0;
const X0 = -OW / 2, X1 = OW / 2, Z0 = -OD / 2, Z1 = OD / 2;
export interface OfficeData { pet?: PetData; airline: string; icao: string; color: string; color2: string; hub: string; pilot: string; balance: string; flying: number; fleet: number; routes: number[][][]; reports: number }
export interface Office { root: TransformNode; blocks: number[][]; casters: AbstractMesh[]; metals: PBRMaterial[]; lamp: PointLight; pet: Pet | null; spawn: { x: number; z: number; yaw: number }; seat: { x: number; z: number; yaw: number }; sun: number; screens: { tex: DynamicTexture; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void }[] }

/** The laptop's screen: the airline at a glance. */
function laptopScreen(D: OfficeData) {
  return (x: CanvasRenderingContext2D, W: number, H: number) => {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0B1A2C'); g.addColorStop(1, '#06111F'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = D.color || '#1C2A4A'; x.fillRect(0, 0, W, 54); x.fillStyle = '#FFFFFF'; x.font = '700 28px Arial'; x.fillText(`${D.airline} · Overview`, 22, 37);
    const card = (cx: number, cy: number, k: string, v: string, c: string) => { x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(cx, cy, W / 2 - 34, 86); x.fillStyle = '#93A9C1'; x.font = '600 18px Arial'; x.fillText(k, cx + 16, cy + 30); x.fillStyle = c; x.font = '700 32px Arial'; x.fillText(v, cx + 16, cy + 68); };
    card(22, 76, 'Balance', D.balance, '#7CFFB2'); card(W / 2 + 12, 76, 'In the air', String(D.flying), '#3FD3E6');
    card(22, 176, 'Fleet', `${D.fleet} aircraft`, '#FFFFFF'); card(W / 2 + 12, 176, 'Hub', D.hub, '#FFC24A');
    x.fillStyle = '#93A9C1'; x.font = '500 17px Arial'; x.fillText('Tap to open the game here', 22, H - 22);
  };
}
/** The desk monitor: the flight planner. */
function plannerScreen(D: OfficeData) {
  return (x: CanvasRenderingContext2D, W: number, H: number) => {
    x.fillStyle = '#081423'; x.fillRect(0, 0, W, H); x.fillStyle = '#3FD3E6'; x.font = '700 30px Arial'; x.fillText('Flight planner', 24, 46);
    for (let i = 0; i < 7; i++) { const y = 80 + i * 44; x.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)'; x.fillRect(20, y, W - 40, 38); x.fillStyle = '#D8E4F0'; x.font = '600 18px Arial'; x.fillText(`${D.icao}${210 + i * 7}`, 34, y + 25); x.fillStyle = D.color2 || '#3FD3E6'; x.fillRect(150 + (i * 53) % 220, y + 10, 120 + (i * 37) % 140, 18); }
    x.fillStyle = '#93A9C1'; x.font = '500 17px Arial'; x.fillText('Tap to open the planner', 24, H - 18);
  };
}
/** The route map: every route of the network on a dark chart, the hub marked. */
function routeMap(D: OfficeData): HTMLCanvasElement {
  const [c, x] = P.canvas(1536, 1024), W = c.width, H = c.height;
  x.fillStyle = '#0A1626'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(120,160,210,.12)'; x.lineWidth = 1; for (let i = 0; i <= 24; i++) { x.beginPath(); x.moveTo(i * W / 24, 0); x.lineTo(i * W / 24, H); x.stroke(); } for (let j = 0; j <= 16; j++) { x.beginPath(); x.moveTo(0, j * H / 16); x.lineTo(W, j * H / 16); x.stroke(); }
  const pts = D.routes.flat(); let lo0 = -30, lo1 = 40, la0 = 30, la1 = 70;
  if (pts.length) { lo0 = Math.min(...pts.map(p => p[0])) - 6; lo1 = Math.max(...pts.map(p => p[0])) + 6; la0 = Math.min(...pts.map(p => p[1])) - 4; la1 = Math.max(...pts.map(p => p[1])) + 4; }
  const k = Math.min(W / (lo1 - lo0), H / (la1 - la0)), ox = (W - (lo1 - lo0) * k) / 2, oy = (H - (la1 - la0) * k) / 2;
  const X = (lo: number) => ox + (lo - lo0) * k, Y = (la: number) => H - oy - (la - la0) * k;
  x.strokeStyle = D.color2 || '#3FD3E6'; x.lineWidth = 3; x.shadowColor = D.color2 || '#3FD3E6'; x.shadowBlur = 10;
  for (const r of D.routes) { if (r.length < 2) continue; x.beginPath(); x.moveTo(X(r[0][0]), Y(r[0][1])); const mx = (X(r[0][0]) + X(r[1][0])) / 2, my = (Y(r[0][1]) + Y(r[1][1])) / 2 - Math.hypot(X(r[1][0]) - X(r[0][0]), Y(r[1][1]) - Y(r[0][1])) * 0.15; x.quadraticCurveTo(mx, my, X(r[1][0]), Y(r[1][1])); x.stroke(); }
  x.shadowBlur = 0; x.fillStyle = '#FFFFFF'; for (const p of pts) { x.beginPath(); x.arc(X(p[0]), Y(p[1]), 6, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#E9EEF5'; x.font = '700 44px Georgia, serif'; x.fillText(`${D.airline} · route network`, 40, 70);
  if (!D.routes.length) { x.font = '500 34px Arial'; x.fillStyle = '#93A9C1'; x.fillText('No routes yet: plan them in the game', 40, 130); }
  return c;
}
function globeTex(): HTMLCanvasElement {
  const [c, x] = P.canvas(1024, 512), r = P.rng(7); x.fillStyle = '#C9B98A'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${90 + r() * 40},${120 + r() * 40},${70 + r() * 30},.85)`; x.beginPath(); x.ellipse(r() * 1024, 80 + r() * 352, 20 + r() * 90, 14 + r() * 60, r() * 3, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = 'rgba(90,60,30,.35)'; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(i * 1024 / 12, 0); x.lineTo(i * 1024 / 12, 512); x.stroke(); }
  return c;
}

export function buildOffice(sc: Scene, D: OfficeData, progress: (p: number, s: string) => void): Office {
  const root = new TransformNode('office', sc), blocks: number[][] = [], casters: AbstractMesh[] = [], metals: PBRMaterial[] = [], screens: Office['screens'] = [];
  let n = 0; const nm = (k: string) => k + '-' + (n++);
  const block = (xa: number, za: number, xb: number, zb: number) => blocks.push([Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)]);
  const tex = (c: HTMLCanvasElement, u = 1, v = 1): DynamicTexture => { const t = new DynamicTexture(nm('t'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: string; tex?: Texture; metal?: number; rough?: number; emis?: string; emisK?: number }): PBRMaterial => {
    const m = new PBRMaterial(nm('m'), sc); m.maxSimultaneousLights = 8; m.albedoColor = o.col ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex;
    m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6; if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis).scale(o.emisK || 1); if ((o.metal || 0) >= 0.6) metals.push(m); return m; };
  const place = (m: Mesh, mat: any, x: number, y: number, z: number, ry = 0, cast = true, act?: string) => { m.position.set(x, y, z); m.rotation.y = ry; m.material = mat; m.receiveShadows = true; m.parent = root; if (cast) casters.push(m); if (act) m.metadata = { act }; return m; };
  const box = (w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry = 0, act?: string) => place(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, sc), mat, x, y, z, ry, true, act);
  const cyl = (rt: number, rb: number, h: number, mat: any, x: number, y: number, z: number, seg = 24, act?: string) => place(MeshBuilder.CreateCylinder(nm('c'), { diameterTop: rt * 2, diameterBottom: rb * 2, height: h, tessellation: seg }, sc), mat, x, y, z, 0, true, act);
  const flat = (w: number, h: number, mat: any, x: number, y: number, z: number, ry: number, act?: string) => place(MeshBuilder.CreatePlane(nm('p'), { width: w, height: h }, sc), mat, x, y, z, ry, false, act);
  const screen = (w: number, h: number, draw: (c: CanvasRenderingContext2D, W: number, H: number) => void, x: number, y: number, z: number, ry: number, act: string, tilt = 0) => {
    const t = new DynamicTexture(nm('scr'), { width: 640, height: Math.round(640 * h / w) }, sc, true); draw(t.getContext() as any, 640, Math.round(640 * h / w)); t.update(true);
    const m = new StandardMaterial(nm('sm'), sc); m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new Color3(0.9, 0.9, 0.9); m.specularColor = new Color3(0.2, 0.2, 0.2); m.disableLighting = true;
    const p = flat(w, h, m, x, y, z, ry, act); p.rotation.x = tilt; screens.push({ tex: t, draw }); return p; };

  progress(15, 'Laying the oak floor…');
  const walnut = pbr({ tex: tex(P.wood('#6B4428', '#2E1A0E', 11)), rough: 0.38 }), darkWood = pbr({ tex: tex(P.wood('#4A2D19', '#1E120A', 3)), rough: 0.45 });
  const leather = pbr({ tex: tex(P.leather('#5A2E1A')), rough: 0.5 }), greenLeather = pbr({ tex: tex(P.leather('#24402E')), rough: 0.5 });
  const brass = pbr({ col: '#C9A25E', metal: 0.95, rough: 0.28 }), chrome = pbr({ col: '#DDE2E8', metal: 1, rough: 0.15 }), black = pbr({ col: '#15171B', rough: 0.35 }), alu = pbr({ col: '#B9BEC6', metal: 0.9, rough: 0.3 });
  { const f = MeshBuilder.CreateGround(nm('floor'), { width: OW, height: OD }, sc); f.material = pbr({ tex: tex(P.herringbone(IS_PC), OW / 4, OD / 4), rough: 0.4 }); f.receiveShadows = true; f.parent = root; }
  { const c = MeshBuilder.CreatePlane(nm('ceil'), { width: OW, height: OD }, sc); c.rotation.x = -Math.PI / 2; c.position.y = OH; c.material = pbr({ tex: tex(P.plaster('#F1ECE2'), 2, 2), rough: 0.95 }); c.parent = root; }
  // a rug under the desk
  { const r = MeshBuilder.CreateGround(nm('rug'), { width: 3.4, height: 2.6 }, sc); r.position.set(0, 0.005, 1.1); r.material = pbr({ tex: tex(P.carpet()), rough: 0.95 }); r.receiveShadows = true; r.parent = root; }
  progress(30, 'Panelling the walls…');
  // walls: walnut panelling to 1.1 m, warm plaster above; the window in the wall ahead, the door in the left wall
  const plaster = pbr({ tex: tex(P.plaster('#D9CBB4'), 2, 1), rough: 0.9 });
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => { flat(w, h, plaster, x, y, z, ry); const p = flat(w, Math.min(h, 1.1), walnut, x, Math.min(1.1, h) / 2 + (y - h / 2), z + (ry === 0 ? -0.012 : ry === Math.PI ? 0.012 : 0), ry); if (ry === Math.PI / 2) p.position.x += 0.012; if (ry === -Math.PI / 2) p.position.x -= 0.012; };
  // the window wall (z = Z1): a frame of wall round a 4.2 × 1.9 m window from 0.85 m up
  const WW = 4.2, WH = 1.9, WY = 0.85;
  flat(OW, WY, plaster, 0, WY / 2, Z1, 0); flat(OW, OH - WY - WH, plaster, 0, WY + WH + (OH - WY - WH) / 2, Z1, 0);
  flat((OW - WW) / 2, WH, plaster, -(WW / 2 + (OW - WW) / 4), WY + WH / 2, Z1, 0); flat((OW - WW) / 2, WH, plaster, WW / 2 + (OW - WW) / 4, WY + WH / 2, Z1, 0);
  flat(OW, Math.min(WY, 0.85), walnut, 0, WY / 2, Z1 - 0.01, 0);
  wall(OW, OH, 0, OH / 2, Z0, Math.PI);
  // the right-hand wall, with the door to your suite (z 2.05 … 2.95) north of the bookshelves
  if ((D as any).suite) { wall(2.05 - Z0, OH, X1, OH / 2, (Z0 + 2.05) / 2, Math.PI / 2); wall(Z1 - 2.95, OH, X1, OH / 2, (2.95 + Z1) / 2, Math.PI / 2); flat(0.9, OH - 2.15, plaster, X1, 2.15 + (OH - 2.15) / 2, 2.5, Math.PI / 2); }
  else wall(OD, OH, X1, OH / 2, 0, Math.PI / 2);
  // the left wall with the door (z −3.1 … −2.1)
  wall(OD - 1.2, OH, X0, OH / 2, 0.6, -Math.PI / 2); flat(0.1, OH, plaster, X0, OH / 2, Z0 + 0.05, -Math.PI / 2); flat(1.05, OH - 2.15, plaster, X0, 2.15 + (OH - 2.15) / 2, -2.6, -Math.PI / 2);
  const door = box(0.05, 2.12, 0.98, darkWood, X0 + 0.03, 1.06, -2.6, 0, 'door'); void door;
  box(0.06, 0.05, 0.16, brass, X0 + 0.09, 1.02, -2.25, 0, 'door');
  // the window: its frame and mullions, and the view over the airport (lit by the time of day)
  const sun = P.daylight();
  for (const fx of [-WW / 2, -WW / 6, WW / 6, WW / 2]) box(0.07, WH, 0.12, darkWood, fx, WY + WH / 2, Z1 - 0.02);
  box(WW + 0.07, 0.08, 0.14, darkWood, 0, WY, Z1 - 0.02); box(WW + 0.07, 0.07, 0.12, darkWood, 0, WY + WH, Z1 - 0.02);
  box(WW + 0.3, 0.05, 0.3, walnut, 0, WY - 0.03, Z1 - 0.15);   // the sill
  { const vm = new StandardMaterial(nm('view'), sc); const vt = tex(P.view()); vm.diffuseTexture = vt; vm.emissiveTexture = vt; vm.emissiveColor = new Color3(0.35 + 0.65 * sun, 0.35 + 0.62 * sun, 0.4 + 0.6 * sun); vm.disableLighting = true; flat(WW * 1.6, WH * 1.6, vm, 0, WY + WH / 2, Z1 + 1.2, 0, 'window'); }
  { const g = pbr({ col: '#9FC4E0', rough: 0.05, metal: 0.1 }); g.alpha = 0.08; flat(WW, WH, g, 0, WY + WH / 2, Z1 - 0.01, 0); }

  progress(50, 'Polishing the desk…');
  // the desk: walnut with a green leather top, two pedestals and a modesty panel
  const DZ = 1.45;
  box(2.1, 0.06, 1.0, walnut, 0, 0.75, DZ); box(1.8, 0.012, 0.75, greenLeather, 0, 0.784, DZ + 0.02);
  for (const sx of [-0.78, 0.78]) { box(0.5, 0.72, 0.92, walnut, sx, 0.36, DZ); for (let i = 0; i < 3; i++) { box(0.42, 0.18, 0.02, darkWood, sx, 0.13 + i * 0.22, DZ - 0.47); box(0.1, 0.02, 0.03, brass, sx, 0.17 + i * 0.22, DZ - 0.49); } }
  box(1.06, 0.55, 0.03, walnut, 0, 0.42, DZ - 0.42); block(-1.05, DZ - 0.5, 1.05, DZ + 0.5);
  // the chair behind it, facing the room
  const chZ = DZ + 0.82;
  cyl(0.03, 0.03, 0.42, chrome, 0, 0.24, chZ); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; box(0.05, 0.04, 0.32, chrome, Math.sin(a) * 0.16, 0.05, chZ + Math.cos(a) * 0.16, a); }
  box(0.6, 0.12, 0.56, leather, 0, 0.5, chZ, 0, 'chair'); box(0.6, 0.8, 0.12, leather, 0, 0.95, chZ + 0.3, 0, 'chair'); for (const sx of [-0.32, 0.32]) box(0.07, 0.06, 0.45, leather, sx, 0.72, chZ);
  block(-0.35, chZ - 0.3, 0.35, chZ + 0.38);
  // the laptop (open, facing you), the monitor with the planner, the lamp, the phone, the notepad, the coffee, the reports
  box(0.36, 0.02, 0.25, alu, 0.15, 0.8, DZ + 0.18, 0, 'laptop');
  { const lid = box(0.36, 0.24, 0.012, alu, 0.15, 0.92, DZ + 0.06, 0, 'laptop'); lid.rotation.x = -0.18; screen(0.33, 0.21, laptopScreen(D), 0.15, 0.92, DZ + 0.068, Math.PI, 'laptop', 0.18); }
  box(0.05, 0.3, 0.05, black, -0.6, 0.94, DZ - 0.12); box(0.22, 0.012, 0.16, black, -0.6, 0.79, DZ - 0.12);
  box(0.62, 0.38, 0.03, black, -0.6, 1.16, DZ - 0.12, 0, 'planner'); screen(0.58, 0.34, plannerScreen(D), -0.6, 1.16, DZ - 0.104, Math.PI, 'planner');
  // the banker's lamp: brass, a green glass shade, and its warm light
  cyl(0.07, 0.08, 0.02, brass, 0.75, 0.79, DZ - 0.25); cyl(0.012, 0.012, 0.34, brass, 0.75, 0.95, DZ - 0.25);
  { const sh = pbr({ col: '#1E6B3A', rough: 0.15, emis: '#2E8A4A', emisK: 0.4 }); const s = cyl(0.04, 0.12, 0.09, sh, 0.75, 1.1, DZ - 0.17); s.rotation.x = Math.PI / 2; s.scaling.set(1, 1, 0.5); }
  const lamp = new PointLight('lamp', new Vector3(0.75, 1.02, DZ - 0.1), sc); lamp.diffuse = Color3.FromHexString('#FFD9A0'); lamp.intensity = 1.6; lamp.range = 4;
  box(0.2, 0.05, 0.16, black, 0.62, 0.81, DZ + 0.28, 0, 'phone'); box(0.2, 0.03, 0.05, black, 0.62, 0.86, DZ + 0.24, 0.1, 'phone');
  box(0.15, 0.008, 0.21, pbr({ col: '#F4EFD9', rough: 0.8 }), -0.25, 0.79, DZ + 0.25, 0.15);
  cyl(0.04, 0.035, 0.09, pbr({ col: '#F7F5F0', rough: 0.2 }), 0.42, 0.83, DZ + 0.32); cyl(0.034, 0.034, 0.005, pbr({ col: '#3A2216', rough: 0.2 }), 0.42, 0.873, DZ + 0.32);
  box(0.24, 0.025, 0.32, pbr({ col: '#8B2A1E', rough: 0.6 }), -0.95 + 0.25, 0.795, DZ + 0.15, -0.2, 'reports');
  // the nameplate, facing the room
  { const c = P.sign(D.pilot || 'Captain', '#1A120C', '#E2C27A', 512, 96, '700 40px Georgia, serif'); const m = new StandardMaterial(nm('np'), sc); m.diffuseTexture = tex(c); box(0.36, 0.07, 0.04, brass, 0.0, 0.82, DZ - 0.42); const p = flat(0.34, 0.06, m, 0.0, 0.82, DZ - 0.443, 0); void p; }
  // the model of one of your aircraft, in the company colours, on a stand
  try {
    const ac = buildAirliner(sc); repaint(ac, D.color, D.color2); ac.root.parent = root; ac.root.scaling.setAll(0.011); ac.root.position.set(-0.85, 0.98, DZ + 0.28); ac.root.rotation.y = 2.3; ac.root.rotation.z = 0.12;
    for (const m of [...ac.strobes, ...ac.beacons, ...ac.navs, ...ac.logo]) m.setEnabled(false); for (const g of ac.gear) g.setEnabled(false);
    ac.root.getChildMeshes().forEach(m => { m.metadata = { act: 'model' }; });
    cyl(0.004, 0.004, 0.17, chrome, -0.85, 0.87, DZ + 0.28); cyl(0.05, 0.06, 0.015, black, -0.85, 0.788, DZ + 0.28);
  } catch (e) { /* the desk without it */ }

  progress(70, 'Filling the shelves…');
  // bookshelves along the right wall, with books and trophies
  const shX = X1 - 0.2;
  box(0.4, 2.3, 2.6, darkWood, shX, 1.15, 0.5); block(shX - 0.22, -0.85, X1, 1.85);
  const r = P.rng(5), bookCols = ['#7A2E22', '#2A4A6B', '#3A5A32', '#8C6A2A', '#4A2D4A', '#1E2E3E', '#9A8A6A', '#5A1E1E'];
  for (let s = 0; s < 5; s++) {
    const y = 0.12 + s * 0.45; box(0.36, 0.025, 2.5, walnut, shX - 0.02, y, 0.5);
    if (s === 2) { for (const [z, h] of [[-0.3, 0.32], [0.3, 0.42], [0.9, 0.28]]) { cyl(0.05, 0.035, h * 0.5, brass, shX - 0.05, y + 0.06 + h * 0.25, z); cyl(0.09, 0.03, h * 0.35, brass, shX - 0.05, y + 0.06 + h * 0.62, z); cyl(0.06, 0.06, 0.04, black, shX - 0.05, y + 0.04, z); } continue; }
    let z = -0.72; while (z < 1.7) { const w = 0.025 + r() * 0.035, h = 0.24 + r() * 0.14; box(0.24, h, w, pbr({ col: bookCols[Math.floor(r() * bookCols.length)], rough: 0.7 }), shX - 0.04, y + 0.012 + h / 2, z + w / 2, 0); z += w + 0.004; if (r() < 0.06) z += 0.12; }
  }
  // the route map on the left wall; the posters and the propeller on the wall across from the desk
  { const m = new StandardMaterial(nm('map'), sc); const t = tex(routeMap(D)); m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new Color3(0.25, 0.25, 0.25); box(0.04, 1.06, 1.56, darkWood, X0 + 0.02, 1.75, 0.8); flat(1.5, 1.0, m, X0 + 0.045, 1.75, 0.8, -Math.PI / 2, 'map'); }
  for (const [kind, x] of [['dusk', -1.6], ['aurora', 1.6]] as [string, number][]) { const m = new StandardMaterial(nm('poster'), sc); m.diffuseTexture = tex(P.painting(kind, 512, 704)); box(0.86, 1.16, 0.03, darkWood, x, 1.75, Z0 + 0.02); flat(0.8, 1.1, m, x, 1.75, Z0 + 0.04, Math.PI, 'poster'); }
  // the propeller, above the sofa
  { const hub = cyl(0.07, 0.07, 0.12, chrome, 0, 2.15, Z0 + 0.08); hub.rotation.x = Math.PI / 2; for (let i = 0; i < 3; i++) { const b = box(0.1, 0.62, 0.02, walnut, Math.sin(i * 2.094) * 0.33, 2.15 + Math.cos(i * 2.094) * 0.33, Z0 + 0.1); b.rotation.z = -i * 2.094; } }
  // the leather sofa and a low table
  { const sz = Z0 + 0.6; box(2.1, 0.42, 0.85, leather, 0, 0.21, sz); box(2.1, 0.5, 0.2, leather, 0, 0.62, sz - 0.33); for (const sx of [-1.0, 1.0]) box(0.2, 0.62, 0.85, leather, sx, 0.31, sz); block(-1.1, Z0, 1.1, sz + 0.45);
    box(1.0, 0.05, 0.55, walnut, 0, 0.42, sz + 1.0); for (const sx of [-0.42, 0.42]) for (const sz2 of [-0.22, 0.22]) box(0.04, 0.4, 0.04, brass, sx, 0.2, sz + 1.0 + sz2); block(-0.52, sz + 0.7, 0.52, sz + 1.3); }
  // the globe in its stand
  { const gx = X0 + 0.6, gz = 2.5; cyl(0.2, 0.26, 0.06, darkWood, gx, 0.03, gz); cyl(0.03, 0.04, 0.62, darkWood, gx, 0.35, gz); const g = MeshBuilder.CreateSphere(nm('globe'), { diameter: 0.5, segments: 32 }, sc); g.position.set(gx, 0.92, gz); g.rotation.z = 0.41; g.material = pbr({ tex: tex(globeTex()), rough: 0.35 }); g.parent = root; g.metadata = { act: 'globe' }; casters.push(g); block(gx - 0.3, gz - 0.3, gx + 0.3, gz + 0.3); }
  // ceiling lights
  for (const [x, z] of [[-1.4, -1.2], [1.4, -1.2], [0, 1.4]]) { cyl(0.12, 0.12, 0.02, pbr({ col: '#FFF6E6', emis: '#FFF1D8', emisK: 1.4 }), x, OH - 0.01, z, 20); }
  // your pet, asleep in its bed by the right-hand bookshelf, its bowls beside it
  let pet: Pet | null = null;
  try { if (D.pet) { pet = placePet(sc, root, D.pet, [X1 - 0.75, -1.6], Math.PI / 2, { door: [X1 - 1.7, -1.6], box: [X0 + 0.4, Z0 + 1.6, X1 - 0.4, Z1 - 0.4],
      free: (x, z) => { const r = 0.18; if (x < X0 + 0.3 || x > X1 - 0.3 || z < Z0 + 0.3 || z > Z1 - 0.3) return false; for (const b of blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return false; return true; },
      save: (food, water) => gameSend({ ampb: 'pet', food, water }), toast: (t) => toast(t), fine: IS_PC });
    if (pet) for (const b of pet.blocks) blocks.push(b); } } catch (e) { console.error(e); pet = null; }
  progress(90, 'Opening the blinds…');
  root.getChildMeshes().forEach(m => { m.isPickable = !!(m.metadata && m.metadata.act); });
  if (pet) for (const m of pet.hits) m.isPickable = true;
  return { root, blocks, casters, metals, lamp, pet, sun, screens, spawn: { x: X0 + 0.9, z: -2.6, yaw: Math.PI / 2 + 0.35 }, seat: { x: 0, z: chZ, yaw: Math.PI } };
}
/** Can you stand there (the walls and the furniture, with a person's half-width)? */
export function officeBlocked(O: Office, x: number, z: number): boolean {
  const r = 0.25; if (x < X0 + 0.3 || x > X1 - 0.3 || z < Z0 + 0.3 || z > Z1 - 0.3) return true;
  for (const b of O.blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return true;
  return false;
}
