// Crash sites in the 3D viewer. After a crash (yours, a hired pilot's, or one from a court case) the airport keeps the
// site for three days: the aircraft broken in three (nose, the middle with the wings, the tail), scorched and lying
// where it came to rest beyond the runway, wreckage strewn back along its path, burnt ground, fires burning for the
// first hours and a column of smoke drifting with the wind for a day and more, and fire engines and ambulances round
// it with their lights flashing for the first twelve hours. An aircraft only damaged lies in one piece, down on a
// broken gear leg, with what came off it near by.
// In the airport's own frame: x east, z north (metres), y up, the airport's elevation at y = 0.
import { Scene, Vector3, Color3, Color4, Mesh, MeshBuilder, StandardMaterial, PBRMaterial, DynamicTexture, TransformNode, ParticleSystem, Plane, Matrix, Quaternion, PointLight, AbstractMesh } from '@babylonjs/core';
import { buildAirliner, setGear, repaint } from './airliner';
import type { Layout } from './airport';

export interface CrashSite { heli?: boolean; id: string; apt: string; typeId?: string; color?: string; color2?: string; reg?: string; at: number; dead?: boolean; pos?: number[]; hdg?: number; level?: 'destroyed' | 'damaged'; parts?: string[] }
export interface Crash { root: TransformNode; centre: Vector3; site: CrashSite; step(t: number, night: number, wind: number[]): void; dispose(): void }
const FIRE_MS = 6 * 3600e3, SMOKE_MS = 30 * 3600e3, VEH_MS = 12 * 3600e3, D2R = Math.PI / 180, L = 37.57, SPAN = 35.8;

function hash(a: number, b: number, c: number): number { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const en = (Lt: Layout, lat: number, lon: number) => [(lon - Lt.lon) * 111320 * Math.cos(Lt.lat * D2R), (lat - Lt.lat) * 110540];

/** Where the wreck lies and which way: where it happened if known, otherwise past the end of the longest runway, off to one side. */
function place(site: CrashSite, Lt: Layout): { x: number; z: number; hdg: number } {
  if (site.pos) { const q = en(Lt, site.pos[1], site.pos[0]); return { x: q[0], z: q[1], hdg: site.hdg || 0 }; }
  const rnd = (k: number) => hash(site.id.length * 131 + k, site.at % 100000, 7), r = (Lt.runways || []).slice().sort((a, b) => b.len - a.len)[0];
  if (!r) return { x: 300, z: 200, hdg: rnd(1) * 360 };
  const end = rnd(2) < 0.5 ? 1 : -1, hd = r.hdg + (end < 0 ? 180 : 0), h = hd * D2R, c = en(Lt, r.lat, r.lon);
  const along = r.len / 2 + 120 + rnd(3) * 380, side = (rnd(4) - 0.5) * 140, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  return { x: c[0] + fx * along + rx * side, z: c[1] + fz * along + rz * side, hdg: (hd + (rnd(5) - 0.5) * 70 + 360) % 360 };
}
function softTex(sc: Scene, name: string, n: number, rgba: (a: number) => string, R = 100): DynamicTexture {
  const t = new DynamicTexture(name, { width: 256, height: 256 }, sc, true), x = t.getContext() as CanvasRenderingContext2D; x.clearRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, d = Math.pow(Math.random(), 0.7) * R, cx = 128 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d, r = 18 + Math.random() * 42;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rgba(0.35 + Math.random() * 0.3)); g.addColorStop(1, rgba(0)); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.28); x.fill(); }
  t.hasAlpha = true; t.update(true); return t;
}

export function buildCrash(sc: Scene, parent: TransformNode, Lt: Layout, site: CrashSite, opt?: { sea?: (lat: number, lon: number) => boolean; elev?: number }): Crash {
  const root = new TransformNode('crash-' + site.id, sc); root.parent = parent;
  const P = place(site, Lt), h = P.hdg * D2R, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  const at = (along: number, side: number) => [P.x + fx * along + rx * side, P.z + fz * along + rz * side];
  const rnd = (k: number) => hash(site.id.length * 17 + k, site.at % 99991, 3);
  const dmg = site.level === 'damaged', parts = site.parts || [], has = (k: string) => parts.some(p => p.indexOf(k) >= 0);
  // in the sea (the wreck partly sunk, burning fuel and oil on the water, rescue boats), and a helicopter's own wreck
  const lat = Lt.lat + P.z / 110540, lon = Lt.lon + P.x / (111320 * Math.cos(Lt.lat * D2R)), sea = !!(opt && opt.sea && opt.sea(lat, lon)), gy = sea ? -((opt && opt.elev) || 0) : 0;
  const heli = !!site.heli, HL = 12.5, HS = 10.7, len = heli ? HL : L, span = heli ? HS : SPAN, WL = len; void span;
  const extras: { dispose(): void }[] = [], clipped: { mesh: AbstractMesh; piv: TransformNode; a: number; b: number }[] = [];

  // the aircraft, broken in three and burnt (or whole and scuffed, down on a broken leg)
  const cuts = dmg ? [[0, 1.01]] : [[0, 0.34], [0.34, 0.7], [0.7, 1.01]];
  const lay = dmg ? [[0, 0, has('main gear') ? 1.0 : has('nose gear') ? 0.5 : 0, (rnd(6) - 0.5) * 10, has('nose gear') ? -3.5 : has('tail') ? 2 : 0, has('main gear') ? 5 + rnd(7) * 3 : 0]] : [   // [along, side, sink, yaw, pitch, roll]
    [L * 0.55 + 18 + rnd(1) * 25, (rnd(2) - 0.5) * 18, 1.2, (rnd(3) - 0.5) * 50, -7 - rnd(4) * 8, 25 + rnd(5) * 40],
    [0, 0, 1.6, (rnd(6) - 0.5) * 16, 2, (rnd(7) - 0.5) * 18],
    [-L * 0.45 - 14 - rnd(8) * 30, (rnd(9) - 0.5) * 30, 0.8, 60 + rnd(10) * 70, 4, -30 - rnd(11) * 40],
  ];
  if (!heli) cuts.forEach((cut, i) => {
    const ac = buildAirliner(sc); try { repaint(ac, site.color || '#1C2A4A', site.color2 || '#3FD3E6'); } catch (e) { /* our own colours */ }
    setGear(ac, dmg && !has('gear') ? 1 : 0);
    for (const m of [...ac.strobes, ...ac.beacons, ...ac.navs, ...ac.logo]) m.setEnabled(false);
    for (const f of ac.fans) f.rotation.z = rnd(30 + i) * 6;
    const k = dmg ? 0.85 : 0.18 + rnd(20 + i) * 0.2;
    for (const m of ac.root.getChildMeshes()) { const mt: any = m.material; if (!mt) continue; const c = mt.clone(mt.name + '-wreck'); if (c.albedoColor) c.albedoColor = c.albedoColor.scale(k); if (c.diffuseColor) c.diffuseColor = c.diffuseColor.scale(k);
      if ('roughness' in c) c.roughness = dmg ? 0.6 : 0.95; if ('metallic' in c && !dmg) c.metallic = 0.05; if (c.clearCoat) c.clearCoat.isEnabled = dmg; c.backFaceCulling = false; m.material = c; m.isPickable = false; }
    const piv = new TransformNode('crash-piece', sc); piv.parent = root; ac.root.parent = piv;
    const zTop = L / 2 - cut[0] * L, zBot = L / 2 - cut[1] * L, zc = (zTop + zBot) / 2; ac.root.position.set(0, 0, -zc);
    const l = lay[i], q = at(l[0], l[1]); if (sea) { l[4] *= 2.2; l[5] *= 1.3; } piv.position.set(q[0], gy + 2.0 - l[2] * 0.6 - (sea ? 1.5 : 0), q[1]);
    piv.rotationQuaternion = Quaternion.FromEulerAngles(0, (P.hdg + l[3]) * D2R, 0).multiply(Quaternion.FromEulerAngles(-l[4] * D2R, 0, l[5] * D2R));
    if (!dmg) for (const m of ac.root.getChildMeshes()) clipped.push({ mesh: m, piv, a: zBot - zc, b: zTop - zc });
  });
  // each piece shows only its own part of the fuselage (cut across it where it broke): two planes on its materials
  const cutPieces: { piv: TransformNode; a: number; b: number; mats: any[] }[] = [];
  for (const c of clipped) { let e = cutPieces.find(q => q.piv === c.piv); if (!e) { e = { piv: c.piv, a: c.a, b: c.b, mats: [] }; cutPieces.push(e); } if (c.mesh.material && e.mats.indexOf(c.mesh.material) < 0) e.mats.push(c.mesh.material); }
  const cutNow = () => { for (const e of cutPieces) { e.piv.computeWorldMatrix(true); const W = e.piv.getWorldMatrix(), p1 = new Plane(0, 0, 1, -e.b).transform(W), p2 = new Plane(0, 0, -1, e.a).transform(W); for (const m of e.mats) { m.clipPlane = p1; m.clipPlane2 = p2; } } };

  if (heli) {
    // a helicopter comes down short and steep: the cabin on its side where it hit, the tail boom torn off a few metres away,
    // the skids bent, the rotor blades broken and thrown round it
    const paint = new PBRMaterial('crash-hpaint', sc); paint.albedoColor = Color3.FromHexString(site.color || '#C8102E').scale(dmg ? 0.9 : 0.3); paint.roughness = 0.9; paint.metallic = 0.1;
    const glassH = new PBRMaterial('crash-hglass', sc); glassH.albedoColor = Color3.FromHexString('#10151C'); glassH.roughness = 0.2; glassH.metallic = 0.4;
    const darkH = new PBRMaterial('crash-hdark', sc); darkH.albedoColor = Color3.FromHexString('#1E2126'); darkH.roughness = 0.85; darkH.metallic = 0.3;
    const cab = new TransformNode('crash-hcab', sc); cab.parent = root; const cq = at(len * 0.05, 0); cab.position.set(cq[0], gy + (sea ? 0.2 : 1.1), cq[1]);
    cab.rotationQuaternion = Quaternion.FromEulerAngles(0, (P.hdg + (rnd(3) - 0.5) * 40) * D2R, 0).multiply(Quaternion.FromEulerAngles((-15 - rnd(4) * 10) * D2R, 0, (dmg ? 4 : 70 + rnd(5) * 25) * D2R));
    const body = MeshBuilder.CreateCapsule('crash-hbody', { height: 5.2, radius: 1.15, tessellation: 18 }, sc); body.material = paint; body.parent = cab; body.rotation.x = Math.PI / 2; body.scaling.set(1, 1, 0.9);
    const nose = MeshBuilder.CreateSphere('crash-hnose', { diameter: 2.1, segments: 12, slice: 0.5 }, sc); nose.material = glassH; nose.parent = cab; nose.position.z = 1.9; nose.rotation.x = -Math.PI / 2;
    for (const sx of [-0.9, 0.9]) { const sk = MeshBuilder.CreateCylinder('crash-hskid', { diameter: 0.12, height: 4.2, tessellation: 8 }, sc); sk.material = darkH; sk.parent = cab; sk.rotation.set(Math.PI / 2 + (rnd(6) - 0.5) * 0.4, 0, sx * 0.2); sk.position.set(sx, -1.3, 0); }
    const mast = MeshBuilder.CreateCylinder('crash-hmast', { diameter: 0.3, height: 0.8, tessellation: 10 }, sc); mast.material = darkH; mast.parent = cab; mast.position.y = 1.4;
    if (dmg) { const boom = MeshBuilder.CreateCylinder('crash-hboom', { diameterTop: 0.35, diameterBottom: 0.6, height: 6.5, tessellation: 12 }, sc); boom.material = paint; boom.parent = cab; boom.rotation.x = Math.PI / 2; boom.position.set(0, 0.5, -5.5); }
    else { const tb = new TransformNode('crash-htail', sc); tb.parent = root; const tq = at(-len * 0.45 - 3 - rnd(8) * 6, (rnd(9) - 0.5) * 9); tb.position.set(tq[0], gy + (sea ? 0 : 0.35), tq[1]); tb.rotation.set(0.1, (P.hdg + 40 + rnd(10) * 90) * D2R, (-25 - rnd(11) * 30) * D2R);
      const boom = MeshBuilder.CreateCylinder('crash-hboom', { diameterTop: 0.35, diameterBottom: 0.6, height: 6.5, tessellation: 12 }, sc); boom.material = paint; boom.parent = tb; boom.rotation.x = Math.PI / 2;
      const fin = MeshBuilder.CreateBox('crash-hfin', { width: 0.12, height: 1.6, depth: 1.1 }, sc); fin.material = paint; fin.parent = tb; fin.position.set(0, 0.7, -3.1); }
    // the rotor blades, broken and thrown round the wreck
    const bl = HS / 2;
    for (let k = 0; k < (dmg ? 0 : 5); k++) { const pc = MeshBuilder.CreateBox('crash-hblade', { width: bl * (0.25 + rnd(40 + k) * 0.6), height: 0.06, depth: 0.45 }, sc); pc.material = darkH; pc.parent = root; const q = at((rnd(50 + k) - 0.5) * len * 1.4, (rnd(60 + k) - 0.5) * HS * 1.2);
      pc.position.set(q[0], gy + 0.08, q[1]); pc.rotation.set((rnd(70 + k) - 0.5) * 0.4, rnd(80 + k) * 6.28, (rnd(90 + k) - 0.5) * 0.3); }
    if (dmg) for (let k = 0; k < 4; k++) { const pc = MeshBuilder.CreateBox('crash-hblade', { width: bl * 0.95, height: 0.06, depth: 0.45 }, sc); pc.material = darkH; pc.parent = cab; pc.position.y = 1.85; pc.rotation.y = k * Math.PI / 2 + 0.3; pc.position.x = Math.cos(-(k * Math.PI / 2 + 0.3)) * bl / 2; pc.position.z = Math.sin(-(k * Math.PI / 2 + 0.3)) * bl / 2; }
  }
  // the burnt ground, and the scar back along the path it slid
  const soot = softTex(sc, 'crash-soot', 90, a => `rgba(12,10,8,${a})`);
  const sm = new StandardMaterial('crash-sootM', sc); sm.diffuseTexture = soot; sm.useAlphaFromDiffuseTexture = true; sm.specularColor = Color3.Black(); sm.zOffset = -6; sm.disableDepthWrite = true;
  if (sea) {   // the slick: dark, ragged, with an oily rainbow sheen, spreading out from the wreck
    const oil = new DynamicTexture('crash-oil', { width: 256, height: 256 }, sc, true), ox = oil.getContext() as CanvasRenderingContext2D; ox.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, d = Math.pow(Math.random(), 0.6) * 105, cx = 128 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d, r = 14 + Math.random() * 40, g = ox.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(8,8,10,${0.45 + Math.random() * 0.3})`); g.addColorStop(1, 'rgba(8,8,10,0)'); ox.fillStyle = g; ox.beginPath(); ox.arc(cx, cy, r, 0, 6.28); ox.fill(); }
    ox.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 40; i++) { const cx = 30 + Math.random() * 196, cy = 30 + Math.random() * 196, r = 6 + Math.random() * 20, g = ox.createRadialGradient(cx, cy, r * 0.4, cx, cy, r); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, `hsla(${Math.random() * 360},80%,55%,.22)`); g.addColorStop(1, 'rgba(0,0,0,0)'); ox.fillStyle = g; ox.beginPath(); ox.arc(cx, cy, r, 0, 6.28); ox.fill(); }
    oil.hasAlpha = true; oil.update(true); const om = new StandardMaterial('crash-oilM', sc); om.diffuseTexture = oil; om.useAlphaFromDiffuseTexture = true; om.specularColor = new Color3(0.6, 0.6, 0.6); om.specularPower = 80; om.zOffset = -6; om.disableDepthWrite = true;
    const sl = MeshBuilder.CreateGround('crash-oil', { width: 1, height: 1 }, sc); sl.material = om; sl.parent = root; const op = at(-len * 0.4, 0); sl.position.set(op[0], gy + 0.15, op[1]); sl.rotation.y = h; sl.scaling.set(len * 3.2, 1, len * 4.2);
  }
  const scar = MeshBuilder.CreateGround('crash-scar', { width: 1, height: 1 }, sc); scar.material = sm; scar.parent = root; const sp = at(heli ? -len * 0.2 : -L * 0.6 - 60, 0); scar.position.set(sp[0], 0.25, sp[1]); scar.rotation.y = h; scar.scaling.set(heli ? HS * 0.9 : dmg ? SPAN * 0.4 : SPAN * 0.9, 1, heli ? len * 1.4 + 8 : dmg ? L * 1.2 + 40 : L * 2.6 + 140); if (sea) scar.setEnabled(false);
  const burn = MeshBuilder.CreateDisc('crash-burn', { radius: 1, tessellation: 28 }, sc); burn.material = sm; burn.parent = root; burn.rotation.x = Math.PI / 2; burn.position.set(P.x, 0.3, P.z); burn.scaling.set(heli ? HS * 0.8 : dmg ? SPAN * 0.35 : SPAN * 1.3, heli ? len * 0.8 : dmg ? L * 0.4 : L * 1.2, 1); if (sea) burn.setEnabled(false);
  // debris: hundreds of pieces strewn back along the path, thickest near the wreck
  const nD = dmg ? 45 : heli ? 90 : 260, deb = MeshBuilder.CreateBox('crash-debris', { size: 1 }, sc), dm = new PBRMaterial('crash-debM', sc); dm.albedoColor = Color3.White(); dm.roughness = 0.9; dm.metallic = 0.2; deb.material = dm; deb.parent = root; deb.isPickable = false;
  { const mb = new Float32Array(nD * 16), cb = new Float32Array(nD * 4), col = Color3.FromHexString(site.color || '#1C2A4A');
    for (let i = 0; i < nD; i++) { const t = Math.pow(Math.random(), 1.8), p = heli ? at(-t * (len * 1.5 + 25) + (Math.random() - 0.5) * len * 0.5, (Math.random() - 0.5) * (HS * 0.9 + t * 12)) : at(-t * (L * 3 + 220) + (Math.random() - 0.3) * L * 0.6, (Math.random() - 0.5) * (SPAN * 0.5 + t * 50)), s = 0.25 + Math.pow(Math.random(), 3) * 2.6;
      Matrix.Compose(new Vector3(s * (0.5 + Math.random()), s * 0.25, s * (0.4 + Math.random())), Quaternion.FromEulerAngles(Math.random() * 6, Math.random() * 6, Math.random() * 6), new Vector3(p[0], gy + (sea ? 0.05 : s * 0.1), p[1])).copyToArray(mb, i * 16);
      const c = (Math.random() < 0.25 ? col : Math.random() < 0.5 ? new Color3(0.85, 0.86, 0.88) : new Color3(0.16, 0.17, 0.19)).scale(0.35 + Math.random() * 0.4); cb.set([c.r, c.g, c.b, 1], i * 4); }
    deb.thinInstanceSetBuffer('matrix', mb, 16, true); deb.thinInstanceSetBuffer('color', cb, 4, true); }
  // the parts that came off a damaged aircraft: an engine, a piece of wing, wheels
  if (dmg) {
    const metal = new PBRMaterial('crash-metal', sc); metal.albedoColor = Color3.FromHexString('#BFC4CA'); metal.metallic = 0.8; metal.roughness = 0.4;
    const dark = new PBRMaterial('crash-dark', sc); dark.albedoColor = Color3.FromHexString('#2A2D32'); dark.metallic = 0.2; dark.roughness = 0.8;
    if (has('engine')) { const q = at(-L * 0.25 - rnd(20) * 20, SPAN * 0.42 + rnd(21) * 10), e = MeshBuilder.CreateCylinder('crash-engine', { diameterTop: 2.2, diameterBottom: 1.9, height: 4.2, tessellation: 18 }, sc); e.material = metal; e.parent = root; e.rotation.set(Math.PI / 2, rnd(22) * 3, 0.3); e.position.set(q[0], 1.0, q[1]); }
    if (has('wing')) { const q = at(-L * 0.4 - rnd(23) * 30, -SPAN * 0.5 - 6), w = MeshBuilder.CreateBox('crash-wing', { width: SPAN * 0.12, height: 0.35, depth: L * 0.06 }, sc); const wm = new PBRMaterial('crash-wingM', sc); wm.albedoColor = Color3.FromHexString('#D9DDE2'); wm.roughness = 0.5; wm.metallic = 0.4; w.material = wm; w.parent = root; w.rotation.set(0.2, rnd(24) * 3, 0.15); w.position.set(q[0], 0.3, q[1]); }
    if (has('gear')) { const q = at(-L * 0.15 - rnd(25) * 25, (rnd(26) - 0.5) * 12); for (let k = 0; k < 2; k++) { const wh = MeshBuilder.CreateCylinder('crash-wheel', { diameter: 1.2, height: 0.45, tessellation: 16 }, sc); wh.material = dark; wh.parent = root; wh.rotation.set(Math.PI / 2, 0, rnd(27 + k)); wh.position.set(q[0] + k * 1.6, 0.6, q[1] + k); } }
  }

  // fire and smoke from the wreck (the wing roots, the engines, the nose)
  const fireAt: number[][] = dmg ? (has('fire') ? [[L * 0.05, -SPAN * 0.22, 3]] : [[L * 0.05, SPAN * 0.2, 1.2]]) : [[0, 0, 9], [L * 0.05, -SPAN * 0.22, 8], [L * 0.05, SPAN * 0.22, 8], [lay[0][0], lay[0][1], 6], [-L * 0.2, SPAN * 0.35, 5], [lay[2][0] * 0.5, 4, 4]];
  if (heli && !dmg) { fireAt.length = 0; fireAt.push([len * 0.05, 0, 7], [len * 0.15, 1.5, 5], [-len * 0.3, 0.5, 3]); }
  if (sea) for (let i2 = 0; i2 < 12; i2++) { const a2 = Math.random() * 6.28, d2 = Math.sqrt(Math.random()) * len * 1.3; fireAt.push([-len * 0.4 + Math.cos(a2) * d2, Math.sin(a2) * d2 * 0.7, 3 + Math.random() * 5]); }
  const flame = new DynamicTexture('crash-flame', { width: 64, height: 64 }, sc, false); { const x = flame.getContext() as CanvasRenderingContext2D, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.35, 'rgba(255,150,40,.85)'); g.addColorStop(1, 'rgba(120,20,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); flame.hasAlpha = true; flame.update(); }
  const puff = softTex(sc, 'crash-puff', 26, a => `rgba(255,255,255,${a})`, 60);
  const fires: { ps: ParticleSystem; rate: number }[] = [], smokes: { ps: ParticleSystem; rate: number }[] = [];
  fireAt.forEach(([al, sd, sz], i) => {
    const q = at(al, sd), em = MeshBuilder.CreateBox('crash-em', { size: 0.1 }, sc); em.isVisible = false; em.parent = root; em.position.set(q[0], gy + (sea ? 0.25 : 0.5), q[1]); const k = Math.max(0.6, len / 40) * sz * (sea ? 1 : 1);
    const f = new ParticleSystem('crash-fire', 260, sc); f.particleTexture = flame; f.emitter = em; f.isLocal = true; f.minEmitBox = new Vector3(-k * 0.5, 0, -k * 0.5); f.maxEmitBox = new Vector3(k * 0.5, 0.5, k * 0.5);
    f.color1 = new Color4(1, 0.62, 0.22, 1); f.color2 = new Color4(1, 0.38, 0.06, 1); f.colorDead = new Color4(0.2, 0.04, 0, 0); f.minSize = k * 0.35; f.maxSize = k * 0.9; f.minLifeTime = 0.5; f.maxLifeTime = 1.3;
    f.blendMode = ParticleSystem.BLENDMODE_ONEONE; f.gravity = new Vector3(0, 3, 0); f.direction1 = new Vector3(-0.3, 2, -0.3); f.direction2 = new Vector3(0.3, 4, 0.3); f.minEmitPower = 0.5; f.maxEmitPower = 1.5; f.emitRate = 0; f.start(); fires.push({ ps: f, rate: 30 + sz * 10 });
    if (i < 3) {
      const s = new ParticleSystem('crash-smoke', 600, sc); s.particleTexture = puff; s.emitter = em; s.isLocal = true; s.minEmitBox = new Vector3(-k * 0.4, 2, -k * 0.4); s.maxEmitBox = new Vector3(k * 0.4, 4, k * 0.4);
      s.color1 = new Color4(0.16, 0.15, 0.15, 0.55); s.color2 = new Color4(0.28, 0.27, 0.26, 0.45); s.colorDead = new Color4(0.45, 0.45, 0.46, 0); s.minSize = k * 1.2; s.maxSize = k * 2.4; s.minLifeTime = 14; s.maxLifeTime = 26;
      s.addSizeGradient(0, k * 1.2); s.addSizeGradient(1, k * 9); s.blendMode = ParticleSystem.BLENDMODE_STANDARD; s.gravity = new Vector3(2, 1.6, 1); s.direction1 = new Vector3(-0.4, 4, -0.4); s.direction2 = new Vector3(0.4, 7, 0.4); s.minEmitPower = 1; s.maxEmitPower = 2;
      s.minAngularSpeed = -0.3; s.maxAngularSpeed = 0.3; s.emitRate = 0; s.start(); smokes.push({ ps: s, rate: 10 + sz * 1.4 });
    }
  });
  // the fire's glow on the ground at night
  const glow = new PointLight('crash-glow', new Vector3(P.x, 6, P.z), sc); glow.parent = root; glow.diffuse = Color3.FromHexString('#FF7A2A'); glow.range = 220; glow.intensity = 0;
  // fire engines and ambulances round it, facing the wreck, their lights flashing
  const red = new PBRMaterial('crash-red', sc); red.albedoColor = Color3.FromHexString('#B3151B'); red.roughness = 0.45; red.metallic = 0.2;
  const yel = new PBRMaterial('crash-yel', sc); yel.albedoColor = Color3.FromHexString('#D8C21A'); yel.roughness = 0.45; yel.metallic = 0.2;
  const wht = new PBRMaterial('crash-wht', sc); wht.albedoColor = Color3.FromHexString('#E8EAEC'); wht.roughness = 0.45; wht.metallic = 0.2;
  const glass = new PBRMaterial('crash-glass', sc); glass.albedoColor = Color3.FromHexString('#1A222C'); glass.roughness = 0.1; glass.metallic = 0.3;
  const tyre = new PBRMaterial('crash-tyre', sc); tyre.albedoColor = Color3.FromHexString('#16181B'); tyre.roughness = 0.9; tyre.metallic = 0;
  const flash: { m: Mesh; ph: number; amb: boolean; mat: StandardMaterial }[] = [], vehs: TransformNode[] = [];
  const boatM = new PBRMaterial('crash-boat', sc); boatM.albedoColor = Color3.FromHexString('#E8641B'); boatM.roughness = 0.5; boatM.metallic = 0.1;
  for (let i = 0; i < 6; i++) {
    const amb = !sea && i >= 4, ang = (i / 6) * Math.PI * 2 + rnd(40 + i) * 0.6, rr = (sea ? WL * 1.6 + 70 : WL * 0.7 + 35) + rnd(50 + i) * 25, x = P.x + Math.cos(ang) * rr, z = P.z + Math.sin(ang) * rr;
    const v = new TransformNode('crash-veh', sc); v.parent = root; v.position.set(x, gy + (sea ? -0.3 : 0), z); if (sea) v.metadata = { boat: true, ph: i * 1.7 }; v.rotation.y = Math.atan2(P.x - x, P.z - z); vehs.push(v);
    const len = sea ? 9 : amb ? 6 : 10.5, hgt = sea ? 1.4 : amb ? 2.6 : 3.3, wid = sea ? 3 : amb ? 2.3 : 2.6;
    if (sea) { // a rescue boat: a pointed hull with its cabin
      const hull = MeshBuilder.CreateCylinder('crash-hull', { diameterTop: wid, diameterBottom: wid * 0.6, height: len, tessellation: 3 }, sc); hull.material = i % 2 ? red : boatM; hull.parent = v; hull.rotation.x = Math.PI / 2; hull.scaling.set(1, 1, 0.45); hull.position.y = 0.5;
      const cabB = MeshBuilder.CreateBox('crash-bcab', { width: 2.2, height: 1.6, depth: 3.2 }, sc); cabB.material = wht; cabB.parent = v; cabB.position.set(0, 1.6, -1);
      for (const sd of [-0.6, 0.6]) { const lm = MeshBuilder.CreateSphere('crash-flash', { diameter: 0.5, segments: 8 }, sc), mt = new StandardMaterial('crash-flashM', sc); mt.disableLighting = true; mt.emissiveColor = new Color3(0.05, 0.05, 0.1); lm.material = mt; lm.parent = v; lm.position.set(sd, 2.6, -1); flash.push({ m: lm, ph: i * 0.37 + (sd > 0 ? 0.5 : 0), amb: false, mat: mt }); }
      continue; }
    const body = MeshBuilder.CreateBox('crash-vb', { width: wid, height: hgt, depth: len }, sc); body.material = amb ? wht : i === 0 ? yel : red; body.parent = v; body.position.y = hgt / 2 + 0.5;
    const ws = MeshBuilder.CreateBox('crash-vw', { width: wid * 0.92, height: hgt * 0.32, depth: 0.05 }, sc); ws.material = glass; ws.parent = v; ws.position.set(0, hgt * 0.78 + 0.5, len / 2 + 0.01);
    for (const [wz, sd] of [[len * 0.32, -1], [len * 0.32, 1], [-len * 0.32, -1], [-len * 0.32, 1]]) { const w = MeshBuilder.CreateCylinder('crash-vt', { diameter: 1.05, height: 0.4, tessellation: 14 }, sc); w.material = tyre; w.parent = v; w.rotation.z = Math.PI / 2; w.position.set(sd * wid / 2, 0.52, wz); }
    if (!amb) { const st = MeshBuilder.CreateBox('crash-stripe', { width: wid + 0.02, height: 0.18, depth: len * 0.98 }, sc); st.material = wht; st.parent = v; st.position.y = hgt * 0.45 + 0.5; }
    else { const st = MeshBuilder.CreateBox('crash-stripe', { width: wid + 0.02, height: 0.25, depth: len * 0.98 }, sc); st.material = red; st.parent = v; st.position.y = hgt * 0.5 + 0.5; }
    for (const sd of [-0.8, 0.8]) { const lm = MeshBuilder.CreateSphere('crash-flash', { diameter: 0.56, segments: 8 }, sc), mt = new StandardMaterial('crash-flashM', sc); mt.disableLighting = true; mt.emissiveColor = new Color3(0.05, 0.05, 0.1); lm.material = mt; lm.parent = v; lm.position.set(sd, hgt + 0.8, len / 2 - 0.4); flash.push({ m: lm, ph: i * 0.37 + (sd > 0 ? 0.5 : 0), amb, mat: mt }); }
  }
  root.getChildMeshes().forEach(m => { m.isPickable = false; m.renderingGroupId = 1; });

  const api: Crash = {
    root, site, centre: new Vector3(P.x, 4, P.z),
    step(t, night, wind) {
      cutNow();
      const age = Date.now() - site.at, fk = Math.max(0, Math.min(1, 1 - age / FIRE_MS)), sk = Math.max(0.12, Math.min(1, 1 - age / SMOKE_MS));
      for (const f of fires) f.ps.emitRate = f.rate * fk; for (const s of smokes) { s.ps.emitRate = s.rate * sk; s.ps.gravity.set(wind[0] * 0.25, 1.6, wind[1] * 0.25); }
      glow.intensity = fk * (0.4 + 3.2 * night) * (0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3));
      const on = age < VEH_MS;
      for (const l of flash) { const lit = on && Math.sin((t * 2.6 + l.ph) * Math.PI * 2) > 0; l.mat.emissiveColor = lit ? (l.amb && l.ph % 1 > 0.4 ? new Color3(1, 0.12, 0.12) : new Color3(0.14, 0.28, 1)) : new Color3(0.04, 0.04, 0.08); }
      for (const v of vehs) { v.setEnabled(age < 2 * VEH_MS); if (v.metadata && v.metadata.boat) { v.position.y = gy - 0.3 + Math.sin(t * 1.3 + v.metadata.ph) * 0.25; v.rotation.z = Math.sin(t * 1.1 + v.metadata.ph) * 0.04; } }
    },
    dispose() { for (const f of fires) f.ps.dispose(); for (const s of smokes) s.ps.dispose(); glow.dispose(); for (const e of extras) e.dispose(); root.dispose(false, true); },
  };
  return api;
}
