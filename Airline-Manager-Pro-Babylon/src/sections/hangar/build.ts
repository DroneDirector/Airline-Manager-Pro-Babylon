// The hangar, built in Babylon.js to the main game's plan: as big as the aircraft in it needs, its doors shut behind
// it. Steel columns and roof trusses, insulated wall panels, skylight strips across the roof and a band of windows high
// on the side walls and in the doors; the sliding door leaves across the whole front. The aircraft (your own, in your
// colours) on its gear, with work stands, tool trolleys and the painted safety lines round it. Along the back wall,
// two rooms: the maintenance office and the break room with a vending machine. Our own textures and shapes.
// Babylon.js's coordinates: x right, y up, z towards the doors; the hangar floor's middle at the origin.
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, PointLight } from '@babylonjs/core';
import * as P from '../lounge/pictures';
import { IS_PC } from '../../core/app';
import { buildAirliner, repaint, setGear } from '../viewer3d/airliner';

export interface HangarData { reg: string; type: string; L: number; span: number; H: number; color: string; color2: string; base: string; size: string; fixes: string[]; progress: number; crew: string[] }
export interface Hangar { root: TransformNode; blocks: number[][]; casters: AbstractMesh[]; metals: PBRMaterial[]; W: number; D: number; HH: number; spawn: { x: number; z: number; yaw: number }; sun: number }

export function buildHangar(sc: Scene, D: HangarData, progress: (p: number, s: string) => void): Hangar {
  const root = new TransformNode('hangar', sc), blocks: number[][] = [], casters: AbstractMesh[] = [], metals: PBRMaterial[] = [];
  let n = 0; const nm = (k: string) => k + '-' + (n++);
  const block = (xa: number, za: number, xb: number, zb: number) => blocks.push([Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)]);
  const tex = (c: HTMLCanvasElement, u = 1, v = 1): DynamicTexture => { const t = new DynamicTexture(nm('t'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: string; tex?: Texture; metal?: number; rough?: number; emis?: string; emisK?: number }): PBRMaterial => {
    const m = new PBRMaterial(nm('m'), sc); m.maxSimultaneousLights = 8; m.albedoColor = o.col ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex;
    m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6; if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis).scale(o.emisK || 1); if ((o.metal || 0) >= 0.6) metals.push(m); return m; };
  const place = (m: Mesh, mat: any, x: number, y: number, z: number, ry = 0, cast = true, act?: string) => { m.position.set(x, y, z); m.rotation.y = ry; m.material = mat; m.receiveShadows = true; m.parent = root; if (cast) casters.push(m); if (act) m.metadata = { act }; return m; };
  const box = (w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry = 0, act?: string, cast = true) => place(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, sc), mat, x, y, z, ry, cast, act);
  const flat = (w: number, h: number, mat: any, x: number, y: number, z: number, ry: number, act?: string) => place(MeshBuilder.CreatePlane(nm('p'), { width: w, height: h }, sc), mat, x, y, z, ry, false, act);
  // as big as the aircraft needs
  const L = D.L || 37.6, S = D.span || 35.8, AH = D.H || 11.8;
  const W = Math.ceil(S + 18), DD = Math.ceil(L + 22), HH = Math.ceil(AH + 7), X0 = -W / 2, X1 = W / 2, Z0 = -DD / 2, Z1 = DD / 2;
  progress(15, 'Sweeping the hangar floor…');
  const sun = P.daylight();
  const floorC = (() => { const [c, x] = P.canvas(1024, 1024), r = P.rng(3); x.fillStyle = '#8E9399'; x.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '60,64,70' : '170,176,182'},${0.05 + r() * 0.08})`; x.fillRect(r() * 1024, r() * 1024, 2 + r() * 6, 2 + r() * 6); } for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(40,40,40,.08)'; x.beginPath(); x.ellipse(r() * 1024, r() * 1024, 20 + r() * 80, 10 + r() * 40, r() * 3, 0, 7); x.fill(); } return c; })();
  { const f = MeshBuilder.CreateGround(nm('floor'), { width: W, height: DD }, sc); const fm = pbr({ tex: tex(floorC, W / 12, DD / 12), rough: 0.35 }); fm.environmentIntensity = 0.6; f.material = fm; f.receiveShadows = true; f.parent = root; }
  // the painted lines: a yellow box round the aircraft's place and a walkway along the sides
  const yel = pbr({ col: '#E8B820', rough: 0.5 });
  for (const [w, d, x, z] of [[S + 6, 0.15, 0, -(L / 2 + 3)], [S + 6, 0.15, 0, L / 2 + 3], [0.15, L + 6, -(S / 2 + 3), 0], [0.15, L + 6, S / 2 + 3, 0]]) box(w, 0.005, d, yel, x, 0.003, z, 0, undefined, false);
  progress(30, 'Raising the steel…');
  // walls: insulated panels with a band of windows high up; the roof: trusses and skylight strips
  const panel = (() => { const [c, x] = P.canvas(512, 512); x.fillStyle = '#D5D9DD'; x.fillRect(0, 0, 512, 512); x.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 8; i++) x.fillRect(i * 64, 0, 3, 512); return c; })();
  const wallM = pbr({ tex: tex(panel, W / 8, HH / 8), rough: 0.6, metal: 0.2 }), steel = pbr({ col: '#3E5A7A', metal: 0.7, rough: 0.45 }), glassM = pbr({ col: '#CFE6F8', emis: sun > 0.3 ? '#DDEEFF' : '#2A3550', emisK: 0.4 + sun * 1.2, rough: 0.1 });
  const bandY = HH - 2.6;
  for (const [w, x, z, ry] of [[W, 0, Z0, Math.PI], [DD, X0, 0, -Math.PI / 2], [DD, X1, 0, Math.PI / 2]] as number[][]) {
    flat(w, bandY, wallM, x, bandY / 2, z, ry); flat(w, HH - bandY - 1.4, wallM, x, bandY + 1.4 + (HH - bandY - 1.4) / 2, z, ry);
    const g = flat(w - 1, 1.2, glassM, x, bandY + 0.7, z, ry); g.position.x += ry === -Math.PI / 2 ? 0.02 : ry === Math.PI / 2 ? -0.02 : 0; g.position.z += ry === Math.PI ? 0.02 : 0;
  }
  // the sliding doors across the front, shut, with their own windows
  const doorM = pbr({ col: '#C3C9D0', metal: 0.4, rough: 0.5 }), leaves = Math.max(4, Math.round(W / 9));
  for (let i = 0; i < leaves; i++) { const lw = W / leaves, x = X0 + lw * (i + 0.5); box(lw - 0.08, HH - 1.2, 0.25, doorM, x, (HH - 1.2) / 2, Z1 - 0.15 - (i % 2) * 0.3, 0, 'doors'); flat(lw - 1.2, 0.9, glassM, x, HH - 3.2, Z1 - 0.29 - (i % 2) * 0.3, Math.PI); }
  box(W, 1.2, 0.6, steel, 0, HH - 0.6, Z1 - 0.3);
  // columns along the side walls, and roof trusses across
  const bays = Math.max(4, Math.round(DD / 10));
  for (let i = 0; i <= bays; i++) { const z = Z0 + DD * i / bays; for (const x of [X0 + 0.25, X1 - 0.25]) box(0.4, HH, 0.4, steel, x, HH / 2, z); box(W, 0.5, 0.25, steel, 0, HH - 0.25, z); box(W, 0.12, 0.12, steel, 0, HH - 2.1, z); for (let k = 0; k < 10; k++) { const x = X0 + W * (k + 0.5) / 10, d = box(0.1, 1.9, 0.1, steel, x, HH - 1.15, z); d.rotation.z = k % 2 ? 0.5 : -0.5; } }
  { const c = MeshBuilder.CreatePlane(nm('roof'), { width: W, height: DD }, sc); c.rotation.x = -Math.PI / 2; c.position.y = HH; c.material = pbr({ col: '#B8BEC6', rough: 0.7 }); c.parent = root; }
  for (let i = 0; i < bays; i++) { const z = Z0 + DD * (i + 0.5) / bays; const s = MeshBuilder.CreatePlane(nm('sky'), { width: W - 4, height: 1.6 }, sc); s.rotation.x = Math.PI / 2; s.position.set(0, HH - 0.02, z); s.material = glassM; s.parent = root; }
  // the lights: rows of high-bay lamps
  const lampM = pbr({ col: '#FFFFFF', emis: '#FFF6E8', emisK: 2.2 });
  for (let i = 0; i < bays; i++) for (let k = 0; k < 4; k++) { const x = X0 + W * (k + 0.5) / 4, z = Z0 + DD * (i + 0.5) / bays; box(0.9, 0.12, 0.9, lampM, x, HH - 2.6, z, 0, undefined, false); }
  for (const z of [Z0 + DD * 0.3, Z0 + DD * 0.7]) { const l = new PointLight(nm('bay'), new Vector3(0, HH - 3, z), sc); l.intensity = 1.6; l.range = Math.max(W, DD); l.diffuse = Color3.FromHexString('#FFF6E8'); }
  progress(55, 'Rolling the aircraft in…');
  // the aircraft, on its gear, nose towards the doors
  try {
    const ac = buildAirliner(sc), k = L / 37.57; repaint(ac, D.color, D.color2); setGear(ac, 1); ac.root.parent = root; ac.root.scaling.setAll(k); ac.root.position.set(0, 3.9 * k, -1.5); ac.root.rotation.y = 0;
    for (const m of [...ac.strobes, ...ac.beacons]) m.setEnabled(false);
    ac.root.getChildMeshes().forEach(m => { m.metadata = { act: 'aircraft' }; casters.push(m); m.receiveShadows = true; });
    block(-2.2 * k, -1.5 - L / 2, 2.2 * k, -1.5 + L / 2); block(-S / 2, -1.5 - 4 * k, S / 2, -1.5 + 3 * k);
  } catch (e) { /* the empty hangar */ }
  // work stands under the engines and by the nose, tool trolleys, chocks and cones
  const stand = pbr({ col: '#F2C230', rough: 0.5, metal: 0.3 }), red = pbr({ col: '#C8281E', rough: 0.5 }), dark = pbr({ col: '#22262B', rough: 0.5 });
  const k = L / 37.57;
  for (const sx of [-1, 1]) { const x = sx * 5.75 * k, z = -1.5 + 6.5 * k; box(2.2, 0.08, 2.2, stand, x + sx * 0.2, 1.2 * k, z, 0, 'stand'); for (const a of [-1, 1]) for (const b of [-1, 1]) box(0.08, 1.2 * k, 0.08, stand, x + sx * 0.2 + a, 0.6 * k, z + b); block(x - 1.2, z - 1.2, x + 1.4, z + 1.2); }
  { const z = -1.5 + L / 2 - 3; box(1.6, 0.08, 1.4, stand, 2.4, 2.6 * k, z, 0, 'stand'); for (const a of [-0.7, 0.7]) for (const b of [-0.6, 0.6]) box(0.08, 2.6 * k, 0.08, stand, 2.4 + a, 1.3 * k, z + b); for (let i = 0; i < 7; i++) box(0.9, 0.05, 0.25, stand, 2.4, 0.35 * (i + 1) * k, z - 0.75 - i * 0.28); block(1.6, z - 2.8, 3.2, z + 0.7); }
  for (const [x, z] of [[-S / 2 - 1, -4], [S / 2 + 1.2, 3], [-6, L / 2 + 1]]) { box(0.9, 0.9, 0.55, red, x, 0.6, z, 0.3, 'trolley'); for (let d = 0; d < 3; d++) box(0.86, 0.02, 0.52, dark, x, 0.4 + d * 0.25, z, 0.3); block(x - 0.6, z - 0.5, x + 0.6, z + 0.5); }
  for (const [x, z] of [[-S / 2 - 2, -L / 2], [S / 2 + 2, -L / 2], [-S / 2 - 2, L / 2], [S / 2 + 2, L / 2]]) { const c = MeshBuilder.CreateCylinder(nm('cone'), { diameterTop: 0.04, diameterBottom: 0.36, height: 0.7 }, sc); place(c, pbr({ col: '#F26A1B', rough: 0.5 }), x, 0.35, z); }
  progress(75, 'Making the coffee in the break room…');
  // along the back wall: the maintenance office and the break room (glass fronts, lit)
  const roomD = 4.5, roomW = Math.min(9, W / 2 - 2), officeM = pbr({ col: '#E4E6E8', rough: 0.7 });
  for (const [cx, kind] of [[X0 + roomW / 2 + 1, 'office'], [X1 - roomW / 2 - 1, 'break']] as [number, string][]) {
    const z = Z0 + roomD / 2; box(roomW, 3.0, 0.15, officeM, cx, 1.5, Z0 + roomD, 0, kind === 'office' ? 'office' : 'break');
    for (const sx of [-1, 1]) box(0.15, 3.0, roomD, officeM, cx + sx * roomW / 2, 1.5, z);
    box(roomW, 0.12, roomD, officeM, cx, 3.05, z);
    const gl = flat(roomW - 1.4, 1.2, pbr({ col: '#BFD8EA', emis: '#FFF4DE', emisK: 0.9, rough: 0.1 }), cx, 1.7, Z0 + roomD + 0.08, Math.PI, kind === 'office' ? 'office' : 'break'); void gl;
    const sg = new StandardMaterial(nm('sign'), sc); sg.diffuseTexture = tex(P.sign(kind === 'office' ? 'Maintenance office' : 'Break room', '#1E2A38', '#F4F4F0', 640, 128, '700 52px Arial, sans-serif')); sg.emissiveColor = new Color3(0.4, 0.4, 0.4);
    flat(2.6, 0.5, sg, cx, 3.4, Z0 + roomD + 0.1, Math.PI);
    block(cx - roomW / 2, Z0, cx + roomW / 2, Z0 + roomD + 0.1);
    if (kind === 'break') { box(0.9, 1.8, 0.7, pbr({ col: '#7A1414', rough: 0.35, metal: 0.3, emis: '#3A0A0A', emisK: 0.3 }), cx + roomW / 2 - 1, 0.9, Z0 + roomD + 0.6, 0, 'vending'); block(cx + roomW / 2 - 1.5, Z0 + roomD, cx + roomW / 2 - 0.5, Z0 + roomD + 1.0); }
  }
  // the little door to the outside, in the wall by the doors
  box(1.1, 2.2, 0.08, pbr({ col: '#5C6168', rough: 0.4, metal: 0.3 }), X1 - 0.06, 1.1, Z1 - 3.5, Math.PI / 2, 'exit');
  void IS_PC;
  root.getChildMeshes().forEach(m => { m.isPickable = !!(m.metadata && m.metadata.act); });
  return { root, blocks, casters, metals, W, D: DD, HH, spawn: { x: X1 - 2.2, z: Z1 - 4.5, yaw: -Math.PI * 0.72 }, sun };
}
export function hangarBlocked(H: Hangar, x: number, z: number): boolean {
  const r = 0.3; if (x < -H.W / 2 + 0.6 || x > H.W / 2 - 0.6 || z < -H.D / 2 + 0.6 || z > H.D / 2 - 0.8) return true;
  for (const b of H.blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return true;
  return false;
}
