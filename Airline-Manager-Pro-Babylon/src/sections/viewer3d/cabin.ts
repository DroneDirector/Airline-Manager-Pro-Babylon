// The cabin of the aircraft in the 3D viewer: the inside of the same A320-sized fuselage, built to its real
// layout. Sidewalls with the windows where the windows are on the outside (you look out at the wing, the engine,
// the clouds and the ground through them), the ceiling with its light strip, overhead bins with mood lighting under
// them, a carpeted floor with a lighter aisle, the galley bulkheads at both ends, and 27 rows of slimline seats,
// three and three, in the airline's colours (extra legroom at the overwing exits).
//
// The people: passengers in their seats as many as the flight carries; while boarding they come down the aisle
// from the front door to their row and sit down, and when deboarding they stand up and leave. In the cruise a cabin
// crew member brings the trolley down the aisle and back, and another walks the cabin now and then.
//
// Axes as the aircraft's: x to the right wing, y up, z forward, metres, the middle of the fuselage at the origin.
// Everything is drawn once for all the seats and people (thin instances), so a full cabin costs a handful of draws.
import { buildPerson, posePerson, stridePerson, Person } from '../court/people';
import {
  Scene, Mesh, MeshBuilder, PBRMaterial, VertexData, TransformNode, StandardMaterial, Color3, DynamicTexture, Vector3, Matrix, Quaternion, HemisphericLight, Texture, Light,
} from '@babylonjs/core';

const L = 37.57, RX = 1.86, RY = 1.95;
export const FLOOR = -0.95;
const S0 = 6.4, S1 = 31.5;                         // the cabin from the front galley to the rear galley (metres from the nose)
const zOf = (s: number) => L / 2 - s;
const SEATX = [-1.34, -0.9, -0.46, 0.46, 0.9, 1.34];
const ROWS: number[] = (() => { const r: number[] = []; for (let s = 7.75; s < 14.9; s += 0.79) r.push(s); for (let s = 16.75; s < 30.2; s += 0.79) r.push(s); return r; })();
export const CABIN_ROWS = ROWS.length;
/** Where a seat is (row 0 at the front, seat 0 = A on the left … 5 = F on the right), on the floor. */
export function seatAt(row: number, seat: number): Vector3 { return new Vector3(SEATX[seat], FLOOR, zOf(ROWS[Math.max(0, Math.min(ROWS.length - 1, row))])); }
/** The window seat over the wing, and a row further back on the aisle, for the camera. */
export const CABIN_VIEW_ROW = ROWS.findIndex(s => s > 17.2);
export const CABIN_AISLE_ROW = ROWS.findIndex(s => s > 24);
export const CABIN_Z = { front: zOf(S0 + 0.6), back: zOf(S1 - 0.6), door: zOf(5.4) };

function tex(sc: Scene, name: string, w: number, h: number, f: (x: CanvasRenderingContext2D) => void, alpha = false): DynamicTexture {
  const t = new DynamicTexture(name, { width: w, height: h }, sc, true); const x = t.getContext() as CanvasRenderingContext2D; f(x); t.hasAlpha = alpha; t.update(true); t.anisotropicFilteringLevel = 8; return t;
}
function rr(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, r: number) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }

/** The inside of the fuselage: a tube facing in, the windows cut out of its picture. */
function wall(sc: Scene): Mesh {
  const NS = 60, NA = 72, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NS; i++) { const s = S0 + (S1 - S0) * i / NS, z = zOf(s); for (let j = 0; j <= NA; j++) { const a = j / NA * Math.PI * 2; pos.push(RX * Math.sin(a), RY * Math.cos(a), z); uv.push(i / NS, j / NA); } }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const m = new Mesh('cabin-wall', sc), vd = new VertexData(); vd.positions = pos; vd.indices = idx; vd.uvs = uv; const nr: number[] = []; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
  return m;
}
function wallTexture(sc: Scene): DynamicTexture {
  const W = 4096, H = 1024;
  return tex(sc, 'cabin-wall', W, H, x => {
    const X = (s: number) => (s - S0) / (S1 - S0) * W, Y = (v: number) => (1 - v) * H;
    x.fillStyle = '#E8EAED'; x.fillRect(0, 0, W, H);
    // the ceiling a touch warmer, the lower sidewall a touch darker, the dado panel at the floor
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#F1F0EC'); g.addColorStop(0.18, '#ECECEA'); g.addColorStop(0.3, '#E3E6EA'); g.addColorStop(0.36, '#C9CED6'); g.addColorStop(0.5, '#9AA2AE');
    g.addColorStop(0.64, '#C9CED6'); g.addColorStop(0.7, '#E3E6EA'); g.addColorStop(0.82, '#ECECEA'); g.addColorStop(1, '#F1F0EC'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // the sidewall panels: a seam every two windows
    x.strokeStyle = 'rgba(120,128,140,.35)'; x.lineWidth = 2;
    for (let s = 7.1 - 0.135; s < S1; s += 1.06) { x.beginPath(); x.moveTo(X(s), Y(0.17)); x.lineTo(X(s), Y(0.33)); x.moveTo(X(s), Y(0.67)); x.lineTo(X(s), Y(0.83)); x.stroke(); }
    // the windows: a deep bezel with the opening cut out
    for (const side of [1, -1]) {
      const v = (a: number) => side > 0 ? a : 1 - a;
      for (let s = 7.1; s < 30.6; s += 0.53) {
        if (s > 15.0 && s < 16.4) continue;
        const c = X(s + 0.13), ya = Y(v(0.222)), yb = Y(v(0.264)), y0 = Math.min(ya, yb), h = Math.abs(ya - yb), w = X(S0 + 0.42);
        const bz = x.createRadialGradient(c, y0 + h / 2, 2, c, y0 + h / 2, w * 0.7); bz.addColorStop(0, '#B9C0C9'); bz.addColorStop(1, '#DDE1E6');
        x.fillStyle = bz; rr(x, c - w / 2, y0, w, h, w * 0.42); x.fill();
        x.strokeStyle = 'rgba(90,98,110,.45)'; x.lineWidth = 2; rr(x, c - w / 2, y0, w, h, w * 0.42); x.stroke();
        const ow = X(S0 + 0.25), oa = Y(v(0.229)), ob = Y(v(0.257)), oy = Math.min(oa, ob), oh = Math.abs(oa - ob);
        x.save(); rr(x, c - ow / 2, oy, ow, oh, ow * 0.45); x.clip(); x.clearRect(c - ow, oy - 2, ow * 2, oh + 4); x.restore();
      }
      // the overwing exits: a hatch outline with its handle
      for (const s of [15.15, 16.0]) { const ya = Y(v(0.205)), yb = Y(v(0.31)), y0 = Math.min(ya, yb), hh = Math.abs(ya - yb); x.strokeStyle = 'rgba(110,118,130,.6)'; x.lineWidth = 3; rr(x, X(s), y0, X(s + 0.5) - X(s), hh, 12); x.stroke(); x.fillStyle = '#C8102E'; x.fillRect(X(s + 0.2), y0 + hh / 2 - 3, X(S0 + 0.1), 6); }
    }
    // the ceiling light strip's glow on the ceiling
    const cg = x.createLinearGradient(0, 0, 0, Y(0.1)); cg.addColorStop(0, 'rgba(255,250,235,.55)'); cg.addColorStop(1, 'rgba(255,250,235,0)'); x.fillStyle = cg; x.fillRect(0, 0, W, Y(0.1));
    const cg2 = x.createLinearGradient(0, H, 0, H - Y(0.1)); cg2.addColorStop(0, 'rgba(255,250,235,.55)'); cg2.addColorStop(1, 'rgba(255,250,235,0)'); x.fillStyle = cg2; x.fillRect(0, H - Y(0.1), W, Y(0.1));
  }, true);
}
function carpet(sc: Scene, c1: string): DynamicTexture {
  return tex(sc, 'cabin-carpet', 512, 2048, x => {
    x.fillStyle = shade(c1, -0.35); x.fillRect(0, 0, 512, 2048);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * 512, Math.random() * 2048, 2, 2); }
    x.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 0; y < 2048; y += 64) for (let xx = (y / 64) % 2 ? 32 : 0; xx < 512; xx += 64) x.fillRect(xx + 28, y + 28, 8, 8);
    // the aisle: lighter, with the floor-path lights either side
    x.fillStyle = shade(c1, -0.18); x.fillRect(256 - 62, 0, 124, 2048);
    x.fillStyle = 'rgba(210,225,235,.8)'; for (let y = 0; y < 2048; y += 96) { x.fillRect(256 - 70, y, 5, 40); x.fillRect(256 + 65, y, 5, 40); }
  });
}
function bulkhead(sc: Scene, front: boolean, c1: string, c2: string): DynamicTexture {
  return tex(sc, front ? 'cabin-fwd' : 'cabin-aft', 1024, 1024, x => {
    x.fillStyle = '#E6E8EB'; x.fillRect(0, 0, 1024, 1024);
    x.fillStyle = '#5B6573'; rr(x, 412, 330, 200, 560, 30); x.fill();                         // the doorway to the galley
    x.fillStyle = shade(c1, -0.1); rr(x, 420, 338, 184, 552, 24); x.fill();                   // its curtain
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 4; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(432 + i * 20, 340); x.lineTo(432 + i * 20, 886); x.stroke(); }
    x.fillStyle = '#9AA3AF'; x.fillRect(120, 330, 250, 560); x.fillRect(654, 330, 250, 560);   // the lockers
    x.strokeStyle = 'rgba(70,78,90,.5)'; x.lineWidth = 3; for (const px of [120, 654]) for (let i = 0; i < 3; i++) { x.strokeRect(px + 6, 336 + i * 184, 238, 176); x.fillStyle = '#C8CDD4'; x.fillRect(px + 110, 336 + i * 184 + 80, 30, 10); }
    x.fillStyle = c2; x.fillRect(120, 300, 784, 10);
    x.fillStyle = '#1A2230'; rr(x, 380, 170, 264, 100, 12); x.fill();                         // the screen and the exit sign
    x.fillStyle = c2; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.fillText(front ? 'Welcome aboard' : 'Thank you for flying', 512, 232);
    x.fillStyle = '#18A957'; rr(x, 462, 110, 100, 40, 6); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.fillText('EXIT', 512, 140);
  });
}
function shade(hex: string, k: number): string {
  const c = Color3.FromHexString(hex), f = (v: number) => Math.round(Math.max(0, Math.min(1, k < 0 ? v * (1 + k) : v + (1 - v) * k)) * 255);
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}

/** A slimline seat (fabric parts, and the frame with the white headrest cover), facing forward from its spot on the floor. */
function seatMeshes(sc: Scene): { fabric: Mesh; frame: Mesh } {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => { const b = MeshBuilder.CreateBox('p', { width: w, height: h, depth: d }, sc); b.position.set(x, y, z); b.rotation.x = rx; return b; };
  const fab = [box(0.44, 0.11, 0.46, 0, 0.45, 0.02), box(0.44, 0.66, 0.1, 0, 0.84, -0.22, -0.13), box(0.42, 0.06, 0.04, 0, 0.51, 0.23)];
  const fr = [box(0.43, 0.2, 0.12, 0, 1.16, -0.28, -0.13), box(0.05, 0.05, 0.44, -0.245, 0.66, 0.0), box(0.05, 0.05, 0.44, 0.245, 0.66, 0.0),
    box(0.04, 0.38, 0.04, -0.17, 0.2, 0.12), box(0.04, 0.38, 0.04, 0.17, 0.2, 0.12), box(0.04, 0.38, 0.04, -0.17, 0.2, -0.18), box(0.04, 0.38, 0.04, 0.17, 0.2, -0.18),
    box(0.4, 0.3, 0.02, 0, 0.88, -0.29, -0.13)];
  const fabric = Mesh.MergeMeshes(fab, true, true) as Mesh; fabric.name = 'cabin-seat'; const frame = Mesh.MergeMeshes(fr, true, true) as Mesh; frame.name = 'cabin-seatframe';
  return { fabric, frame };
}
/** A person, seated (or standing): clothes and skin as two shapes, each coloured per person. */
function personMeshes(sc: Scene, standing: boolean): { body: Mesh; skin: Mesh } {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => { const b = MeshBuilder.CreateBox('p', { width: w, height: h, depth: d }, sc); b.position.set(x, y, z); b.rotation.x = rx; return b; };
  const cap = (h: number, r: number, x: number, y: number, z: number, rx = 0) => { const c = MeshBuilder.CreateCapsule('p', { height: h, radius: r, tessellation: 10, subdivisions: 1 }, sc); c.position.set(x, y, z); c.rotation.x = rx; return c; };
  let body: Mesh[], skin: Mesh[];
  if (!standing) {
    body = [cap(0.58, 0.17, 0, 0.8, -0.13, -0.13), cap(0.48, 0.075, -0.1, 0.56, 0.12, Math.PI / 2), cap(0.48, 0.075, 0.1, 0.56, 0.12, Math.PI / 2), cap(0.46, 0.065, -0.1, 0.3, 0.36), cap(0.46, 0.065, 0.1, 0.3, 0.36),
      cap(0.34, 0.055, -0.2, 0.75, -0.02, 0.6), cap(0.34, 0.055, 0.2, 0.75, -0.02, 0.6)];
    skin = [MeshBuilder.CreateSphere('p', { diameter: 0.21, segments: 8 }, sc), box(0.07, 0.08, 0.07, 0, 1.06, -0.15)]; skin[0].position.set(0, 1.18, -0.14); skin[0].scaling.set(0.92, 1.1, 1);
  } else {
    body = [cap(0.62, 0.17, 0, 1.22, 0), cap(0.86, 0.075, -0.09, 0.45, 0), cap(0.86, 0.075, 0.09, 0.45, 0), cap(0.62, 0.055, -0.22, 1.18, 0), cap(0.62, 0.055, 0.22, 1.18, 0)];
    skin = [MeshBuilder.CreateSphere('p', { diameter: 0.21, segments: 8 }, sc), box(0.07, 0.08, 0.07, 0, 1.54, 0)]; skin[0].position.set(0, 1.66, 0); skin[0].scaling.set(0.92, 1.1, 1);
  }
  const b = Mesh.MergeMeshes(body, true, true) as Mesh, k = Mesh.MergeMeshes(skin, true, true) as Mesh; b.name = standing ? 'cabin-walker' : 'cabin-pax'; k.name = b.name + '-skin';
  return { body: b, skin: k };
}

const CLOTHES = ['#2C3E50', '#7F8C8D', '#1F4E79', '#8E3B46', '#3E6B48', '#C9B79C', '#4A4A4A', '#D9D4CC', '#5D3A6E', '#B5651D', '#22313F', '#9E2A2B', '#2E86AB', '#6C757D'];
const SKIN = ['#F1C9A5', '#E0AC86', '#C68863', '#8D5524', '#6B4226', '#FFDBB8', '#D9A47A', '#A86B48'];
const rnd = (seed: number) => { let s = seed | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

interface Walker { pi: number; row: number; seat: number; z: number; t: number; dir: 1 | -1; state: 'walk' | 'turn' | 'sit' | 'out'; body: number; skin: number; c: Color3; k: Color3 }
export interface Cabin {
  root: TransformNode; on: boolean;
  show(on: boolean): void;
  paint(c1: string, c2: string): void;
  frame(dt: number, o: { phase: string; pax: number; paxMax: number; onGround: boolean; night: boolean; cruise: boolean; descent: boolean }): void;
  /** What someone said who was tapped (a mesh and its thin instance), shown as a bubble over them. */
  talk(mesh: AbstractMeshLike, instance: number): boolean;
  /** The bubbles to show now: where (in the cabin's frame), who and what. */
  bubbles: { at: Vector3; who: string; text: string; until: number }[];
  dispose(): void;
}
type AbstractMeshLike = { name: string };

export function buildCabin(sc: Scene, parent: TransformNode, lights: Light[]): Cabin {
  const root = new TransformNode('cabin', sc); root.parent = parent;
  const meshes: Mesh[] = [];
  const own = (m: Mesh, mat: StandardMaterial) => { m.material = mat; m.parent = root; m.isPickable = false; meshes.push(m); return m; };
  const mat = (name: string, col: string, spec = 0.08) => { const m = new StandardMaterial(name, sc); m.diffuseColor = Color3.FromHexString(col); m.specularColor = new Color3(spec, spec, spec); return m; };
  let C1 = '#1C2A4A', C2 = '#3FD3E6';

  // the walls, the ceiling and the windows
  const wallM = mat('cabin-wallM', '#FFFFFF'); wallM.diffuseTexture = wallTexture(sc); wallM.diffuseTexture.hasAlpha = true; wallM.useAlphaFromDiffuseTexture = false; wallM.transparencyMode = 1; wallM.alphaCutOff = 0.5; wallM.backFaceCulling = true;
  own(wall(sc), wallM);
  // the floor
  const floorM = mat('cabin-floorM', '#FFFFFF'); const ft = carpet(sc, C1); ft.wrapV = Texture.WRAP_ADDRESSMODE; ft.vScale = 6; floorM.diffuseTexture = ft;
  const fw = 2 * RX * Math.sqrt(1 - (FLOOR / RY) ** 2);
  const floor = own(MeshBuilder.CreateGround('cabin-floor', { width: fw, height: S1 - S0 }, sc), floorM); floor.position.set(0, FLOOR, zOf((S0 + S1) / 2));
  // the bulkheads at both ends
  const bh = (front: boolean) => { const m = mat(front ? 'cabin-fwdM' : 'cabin-aftM', '#FFFFFF'); m.diffuseTexture = bulkhead(sc, front, C1, C2); m.backFaceCulling = false;
    const d = own(MeshBuilder.CreateDisc(front ? 'cabin-fwd' : 'cabin-aft', { radius: 1, tessellation: 48 }, sc), m); d.scaling.set(RX, RY, 1); d.position.z = zOf(front ? S0 : S1); if (!front) d.rotation.y = Math.PI; return m; };
  const bhF = bh(true), bhA = bh(false);
  // the overhead bins, the light strip and the mood lighting under the bins
  const binM = mat('cabin-binM', '#EEF0F2', 0.25);
  for (const side of [1, -1]) {
    const sh = [[0.86, 1.62], [0.78, 1.12], [0.98, 0.98], [1.56, 1.07], [1.34, 1.38], [1.04, 1.62], [0.86, 1.62]];
    const at = (z: number) => sh.map(([x, y]) => new Vector3(side * x, y, z));
    own(MeshBuilder.CreateRibbon('cabin-bins', { pathArray: [at(zOf(S0)), at(zOf(S1))], sideOrientation: Mesh.DOUBLESIDE }, sc), binM);
  }
  const seamM = mat('cabin-seamM', '#AEB5BE');
  for (const side of [1, -1]) for (let s = S0 + 0.3; s < S1 - 0.3; s += 1.06) { const k = own(MeshBuilder.CreateBox('cabin-seam', { width: 0.012, height: 0.5, depth: 0.012 }, sc), seamM); k.position.set(side * 0.8, 1.35, zOf(s)); k.rotation.z = side * 0.15; }
  const stripM = new StandardMaterial('cabin-stripM', sc); stripM.disableLighting = true; stripM.emissiveColor = new Color3(1, 0.97, 0.9);
  const strip = own(MeshBuilder.CreateBox('cabin-strip', { width: 0.32, height: 0.02, depth: S1 - S0 - 1 }, sc), stripM); strip.position.set(0, RY - 0.04, zOf((S0 + S1) / 2));
  const moodM = new StandardMaterial('cabin-moodM', sc); moodM.disableLighting = true; moodM.emissiveColor = Color3.FromHexString(C2).scale(0.8);
  for (const side of [1, -1]) { const m = own(MeshBuilder.CreateBox('cabin-mood', { width: 0.03, height: 0.015, depth: S1 - S0 - 1 }, sc), moodM); m.position.set(side * 0.8, 1.12, zOf((S0 + S1) / 2)); }
  // the reading lights and the seat-belt signs above each row
  const psuM = mat('cabin-psuM', '#D9DDE2');
  const psu = MeshBuilder.CreateBox('cabin-psu', { width: 0.62, height: 0.03, depth: 0.3 }, sc); own(psu, psuM);

  // the seats
  const seat = seatMeshes(sc), fabM = mat('cabin-fabM', C1, 0.04), frameM = mat('cabin-frameM', '#D4D8DE', 0.3);
  own(seat.fabric, fabM); own(seat.frame, frameM);
  const seatMs: Matrix[] = [], psuMs: Matrix[] = [];
  ROWS.forEach((s, r) => { for (let i = 0; i < 6; i++) seatMs.push(Matrix.Translation(SEATX[i], FLOOR, zOf(s))); for (const side of [1, -1]) psuMs.push(Matrix.Translation(side * 1.12, 1.0, zOf(s) - 0.1)); void r; });
  const buf = (ms: Matrix[]) => { const a = new Float32Array(ms.length * 16); ms.forEach((m, i) => m.copyToArray(a, i * 16)); return a; };
  seat.fabric.thinInstanceSetBuffer('matrix', buf(seatMs), 16, true); seat.frame.thinInstanceSetBuffer('matrix', buf(seatMs), 16, true); psu.thinInstanceSetBuffer('matrix', buf(psuMs), 16, true);
  // the headrest covers: white with the airline's colour
  const coverM = mat('cabin-coverM', '#F4F5F7'); const cover = own(MeshBuilder.CreateBox('cabin-cover', { width: 0.44, height: 0.16, depth: 0.125 }, sc), coverM);
  cover.thinInstanceSetBuffer('matrix', buf(seatMs.map(m => Matrix.RotationX(-0.13).multiply(Matrix.Translation(0, 1.17, -0.285)).multiply(m))), 16, true);

  // the passengers in their seats
  const pax = personMeshes(sc, false), paxM = mat('cabin-paxM', '#FFFFFF', 0.05), skinM = mat('cabin-skinM', '#FFFFFF', 0.1);
  own(pax.body, paxM); own(pax.skin, skinM);
  const N = ROWS.length * 6, R = rnd(20261106);
  const order = Array.from({ length: N }, (_, i) => i).sort(() => R() - 0.5);              // who sits where, the same every time
  const clothes = order.map(() => Color3.FromHexString(CLOTHES[Math.floor(R() * CLOTHES.length)]));
  const skins = order.map(() => Color3.FromHexString(SKIN[Math.floor(R() * SKIN.length)]));
  const seated = new Uint8Array(N);
  const paxMs = new Float32Array(N * 16), paxCol = new Float32Array(N * 4), skinCol = new Float32Array(N * 4);
  const writePax = () => {
    let n = 0;
    instSeat = [];
    for (let i = 0; i < N; i++) { if (!seated[i]) continue; instSeat.push(i); const r = Math.floor(i / 6), k = i % 6; Matrix.Translation(SEATX[k], FLOOR, zOf(ROWS[r])).copyToArray(paxMs, n * 16);
      const c = clothes[i], s = skins[i]; paxCol.set([c.r, c.g, c.b, 1], n * 4); skinCol.set([s.r, s.g, s.b, 1], n * 4); n++; }
    pax.body.thinInstanceSetBuffer('matrix', paxMs, 16, false); pax.skin.thinInstanceSetBuffer('matrix', paxMs, 16, false);
    pax.body.thinInstanceSetBuffer('color', paxCol, 4, false); pax.skin.thinInstanceSetBuffer('color', skinCol, 4, false);
    pax.body.thinInstanceCount = n; pax.skin.thinInstanceCount = n; pax.body.isVisible = pax.skin.isVisible = n > 0;
  };
  // the people walking: boarding and deboarding passengers, the cabin crew
  const walk = personMeshes(sc, true), walkM = mat('cabin-walkM', '#FFFFFF', 0.05), wskinM = mat('cabin-wskinM', '#FFFFFF', 0.1);
  own(walk.body, walkM); own(walk.skin, wskinM);
  const MAXW = 24, wMs = new Float32Array(MAXW * 16), wCol = new Float32Array(MAXW * 4), wSk = new Float32Array(MAXW * 4);
  walk.body.thinInstanceSetBuffer('matrix', wMs, 16, false); walk.skin.thinInstanceSetBuffer('matrix', wMs, 16, false); walk.body.thinInstanceSetBuffer('color', wCol, 4, false); walk.skin.thinInstanceSetBuffer('color', wSk, 4, false);
  // the people who walk (the crew and the passengers coming and going): jointed figures that walk in step
  walk.body.setEnabled(false); walk.skin.setEnabled(false);
  const pmats = new Map<string, PBRMaterial>(), POOL = 14, pool: { p: Person; used: boolean; ph: number }[] = [];
  for (let i = 0; i < POOL; i++) { const crewP = i < 3, sex = i % 2 ? 'f' : 'm';
    const p = buildPerson(sc, { key: (crewP ? 'counsel-crew-' : 'public-cab-') + i, seat: 'w' + i, sex, sit: 0 }, { id: 'w' + i, x: 0, y: FLOOR, z: 0, yaw: 0, sit: 0 }, C1, pmats);
    p.root.parent = root; p.root.setEnabled(false); for (const m of p.meshes) { meshes.push(m as Mesh); m.isPickable = true; m.metadata = { cabinWho: i }; } pool.push({ p, used: crewP, ph: Math.random() * 6 }); }
  const take = () => { for (let i = 3; i < POOL; i++) if (!pool[i].used) { pool[i].used = true; return i; } return -1; };
  const PM = (i: number) => pool[i] && pool[i].p;
  void PM;
  const trolleyM = mat('cabin-trolleyM', '#B8BEC6', 0.6); const trolley = own(MeshBuilder.CreateBox('cabin-trolley', { width: 0.3, height: 1.03, depth: 0.8 }, sc), trolleyM);
  const uniform = Color3.FromHexString(C1);
  const walkers: Walker[] = [];
  const crew = { z: CABIN_Z.front, dir: -1, row: 0, stop: 0, out: false, t: 0, walker: { z: CABIN_Z.back, dir: 1, t: 0, wait: 20 } };
  // ---- who says what: the crew, and every passenger in their own mood ----
  let talkWho = -9, lastStop = -1, phaseNow = '';
  const whoAt: { [i: number]: Vector3 } = {};
  const MOODS = ['happy', 'happy', 'fine', 'fine', 'fine', 'tired', 'nervous', 'grumpy', 'chatty'], moodOf = (i: number) => MOODS[Math.floor(R2(i) * MOODS.length)];
  function R2(i: number) { let h = (i * 2654435761) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; return (h % 10000) / 10000; }
  const pickL = (a: string[], k: number) => a[Math.floor((k + Math.random() * 0.999) * a.length) % a.length];
  const CREW: { [k: string]: string[] } = {
    boarding: ['Good morning, welcome aboard!', 'May I see your boarding pass? Row ahead on the left.', 'Let me help you with that bag.', 'Please take your seat as soon as you can, thank you.'],
    trolley: ['Anything to drink for you today?', 'Tea or coffee? We also have juice and water.', 'Would you like something from the menu?', 'A snack with that?', 'Card only on board, thank you.'],
    cruise: ['Is everything all right here?', 'We will be landing in about an hour.', 'Can I get you a blanket?', 'The toilets are at the front and at the back.'],
    descent: ['Seat backs upright, please, we are starting our descent.', 'Seat belt on, please.', 'Tray tables up, thank you.', 'Please put your bag under the seat in front.'],
    ground: ['Welcome aboard!', 'Thank you for flying with us, goodbye!', 'Mind your step at the door.'],
  };
  const PAX: { [m: string]: string[] } = {
    happy: ['A coffee, please, with milk. Thank you!', 'Lovely flight so far.', 'Orange juice would be great, thanks.', 'Could I have some water?'],
    fine: ['Just water, thanks.', 'Tea, no sugar.', 'Do you have a sandwich?', 'No thank you, I am fine.'],
    tired: ['Just water, I am trying to sleep.', 'Could you wake me before landing?', 'Coffee. A strong one, please.'],
    nervous: ['Is that bumping normal?', 'How long until we land?', 'Could I have some water? I do not love flying.'],
    grumpy: ['The seat will not recline.', 'Is there really nothing hot to eat?', 'It is very warm in here.', 'We were late leaving, again.'],
    chatty: ['Is it your first time on this route? Mine is the tenth!', 'Have you been to the airport there? The views are something.', 'I love the colours of this airline.'],
  };
  const crewLine = (k: string) => pickL(CREW[k] || CREW.cruise, 0);
  const paxLine = (i: number, k: string) => { const m = moodOf(i); if (k === 'trolley') return pickL(PAX[m], 0); return pickL(PAX[m === 'happy' || m === 'fine' ? 'chatty' : m], 0); };
  const seatName = (i: number) => `${Math.floor(i / 6) + 1}${'ABCDEF'[i % 6]}`;
  const seatAtIdx = (i: number) => new Vector3(SEATX[i % 6], FLOOR + 1.45, zOf(ROWS[Math.floor(i / 6)]));
  const seatedIn = (row: number) => { const c = [row * 6 + 2, row * 6 + 3, row * 6 + 1, row * 6 + 4, row * 6, row * 6 + 5].filter(i => seated[i]); return c.length ? c[Math.floor(Math.random() * c.length)] : -1; };
  const say = (who: number, text: string, at: Vector3, name: string) => { const now = performance.now() / 1000; api.bubbles = api.bubbles.filter(b => b.who !== name); api.bubbles.push({ at, who: name, text, until: now + Math.max(4, text.length / 12 + 2) }); if (who >= 0) { talkWho = who; setTimeout(() => { if (talkWho === who) talkWho = -9; }, 2500); } };
  let instSeat: number[] = [];


  // the cabin's own light: bright by day, dimmed at night in the cruise; the sun and the sky's light stay outside
  const lamp = new HemisphericLight('cabin-light', new Vector3(0.1, 1, 0.05), sc); lamp.groundColor = new Color3(0.42, 0.4, 0.38); lamp.specular = new Color3(0.2, 0.2, 0.2);
  lamp.includedOnlyMeshes = meshes; for (const l of lights) for (const m of meshes) l.excludedMeshes.push(m);

  let target = 0, shown = 0, lastPax = -1, lastPhase = '';
  const fillTo = (k: number) => { target = Math.max(0, Math.min(N, Math.round(k))); };
  const place = (i: number, on: boolean) => { seated[order[i]] = on ? 1 : 0; };
  const api: Cabin = {
    root, on: false,
    show(on) { api.on = on; root.setEnabled(on); lamp.setEnabled(on); },
    paint(c1, c2) {
      if (c1 === C1 && c2 === C2) return; C1 = c1; C2 = c2;
      fabM.diffuseColor = Color3.FromHexString(c1); moodM.emissiveColor = Color3.FromHexString(c2).scale(0.8); uniform.copyFrom(Color3.FromHexString(c1));
      try { const o = floorM.diffuseTexture; const t = carpet(sc, c1); t.vScale = 6; floorM.diffuseTexture = t; if (o) o.dispose(); } catch (e) { /* keeps the old */ }
      for (const [m, f] of [[bhF, true], [bhA, false]] as [StandardMaterial, boolean][]) { const o = m.diffuseTexture; m.diffuseTexture = bulkhead(sc, f, c1, c2); if (o) o.dispose(); }
    },
    bubbles: [],
    talk(mesh, inst) {
      const md: any = (mesh as any).metadata;
      if (md && md.cabinWho != null) { const i = md.cabinWho, at = whoAt[i] || new Vector3(0, FLOOR + 1.75, 0);
        const k = /board/i.test(phaseNow) ? 'boarding' : /desc|appro|land/i.test(phaseNow) ? 'descent' : /gate|ground|taxi|deboard|park/i.test(phaseNow) ? 'ground' : i === 0 && crew.stop > 0 ? 'trolley' : 'cruise';
        say(i, i < 3 ? crewLine(k) : pickL(PAX.chatty.concat(PAX.fine), 0), at, i < 3 ? 'Cabin crew' : 'Passenger'); return true; }
      if ((mesh.name === 'cabin-pax' || mesh.name === 'cabin-pax-skin') && inst >= 0 && instSeat[inst] != null) { const sI = instSeat[inst]; say(-1, paxLine(sI, 'cruise'), seatAtIdx(sI), `Passenger ${seatName(sI)} · ${moodOf(sI)}`); return true; }
      return false; },
    frame(dt, o) {
      if (!api.on) return; phaseNow = o.phase;
      const boarding = /board/i.test(o.phase) && !/deboard/i.test(o.phase), deboarding = /deboard|arriv|landed|at the gate/i.test(o.phase) && o.onGround;
      // how many are aboard: the flight's own number (80 % in the demo), or the boarding and deboarding as it goes
      const want = o.paxMax ? Math.round(N * Math.min(1, o.pax / o.paxMax)) : o.pax ? Math.min(N, o.pax) : Math.round(N * 0.8);
      if (o.pax !== lastPax || o.phase !== lastPhase) { lastPax = o.pax; lastPhase = o.phase; fillTo(deboarding ? 0 : want); if (!boarding && !deboarding) { for (let i = 0; i < N; i++) place(i, i < target); shown = target; writePax(); walkers.length = 0; } }
      // boarding: the next passengers come in at the front door and walk to their row; deboarding: they stand up and leave
      if ((boarding && shown < target) || (deboarding && shown > 0)) {
        if (walkers.length < 10 && Math.random() < dt * 1.2) {
          if (boarding) { const i = shown++, id = order[i]; walkers.push({ pi: take(), row: Math.floor(id / 6), seat: id % 6, z: CABIN_Z.door, t: 0, dir: -1, state: 'walk', body: 0, skin: 0, c: clothes[id], k: skins[id] }); }
          else { const i = --shown, id = order[i]; place(i, false); writePax(); walkers.push({ pi: take(), row: Math.floor(id / 6), seat: id % 6, z: zOf(ROWS[Math.floor(id / 6)]), t: 0, dir: 1, state: 'walk', body: 0, skin: 0, c: clothes[id], k: skins[id] }); }
        }
      }
      let n = 0; const visibleP = new Set<number>(), tt = performance.now() / 1000;
      const put = (x: number, z: number, yaw: number, bob: number, c: Color3, k: Color3, pi = -1) => { void c; void k; if (pi < 0) { n++; return; } const q = pool[pi]; if (!q) return;
        const walking = bob > 0.001, P2 = q.p; P2.root.setEnabled(true); P2.root.position.set(x, FLOOR, z); P2.root.rotation.y = yaw; P2.seat.yaw = yaw; P2.seat.x = x; P2.seat.z = z; P2.want = 0;
        if (walking) q.ph += dt * 6.2; posePerson(P2, tt, talkWho === pi, null, dt); stridePerson(P2, q.ph, walking ? 1 : 0); visibleP.add(pi); n++;
        whoAt[pi] = new Vector3(x, FLOOR + 1.75, z); };
      for (let i = walkers.length - 1; i >= 0; i--) {
        const w = walkers[i], rz = zOf(ROWS[w.row]); w.t += dt;
        if (w.dir < 0) { // boarding: down the aisle to the row, then into the seat
          if (w.z > rz) { w.z = Math.max(rz, w.z - dt * 0.9); put(0, w.z, Math.PI, 0.03, w.c, w.k, w.pi); }
          else { const idx = order.indexOf(w.row * 6 + w.seat); place(idx, true); writePax(); if (pool[w.pi]) pool[w.pi].used = false; walkers.splice(i, 1); }
        } else { // deboarding: into the aisle and forward to the door
          w.z += dt * 0.9; put(0, w.z, 0, 0.03, w.c, w.k, w.pi); if (w.z > CABIN_Z.door) { if (pool[w.pi]) pool[w.pi].used = false; walkers.splice(i, 1); }
        }
      }
      // the cruise: the trolley down the aisle row by row and back, another crew member walking the cabin
      const skinA = Color3.FromHexString('#E8B998');
      if (o.cruise && !boarding && !deboarding) {
        crew.t += dt;
        if (crew.stop > 0) crew.stop -= dt;
        else { crew.z += crew.dir * dt * 0.45; const r = ROWS.findIndex(s => zOf(s) < crew.z + (crew.dir < 0 ? 0 : -0.79)); if (crew.dir < 0 && r >= 0 && r !== crew.row) { crew.row = r; crew.stop = 7 + Math.random() * 6; }
          if (crew.z < CABIN_Z.back + 1) crew.dir = 1; if (crew.z > CABIN_Z.front && crew.dir > 0) { crew.dir = -1; crew.row = -1; crew.stop = 90; } }
        trolley.setEnabled(true); trolley.position.set(0, FLOOR + 0.52, crew.z - 0.5); const pushing = crew.stop <= 0 ? 0.03 : 0; put(0, crew.z + 0.12, Math.PI, pushing, uniform, skinA, 0); put(0, crew.z - 1.12, 0, pushing, uniform, Color3.FromHexString('#C68863'), 1);
        const cw = crew.walker; if (cw.wait > 0) cw.wait -= dt; else { cw.z += cw.dir * dt * 0.8; cw.t += dt; if (cw.z > CABIN_Z.front) { cw.dir = -1; cw.wait = 40; } if (cw.z < CABIN_Z.back) { cw.dir = 1; cw.wait = 30; } }
        if (Math.abs(cw.z - crew.z) > 2.2) put(0, cw.z, cw.dir > 0 ? 0 : Math.PI, cw.wait > 0 ? 0 : 0.03, uniform, Color3.FromHexString('#F1C9A5'), 2);
      } else {
        trolley.setEnabled(false);
        // seated for take-off and landing; at the gate, welcoming at the front door
        if (o.onGround) put(0.15, CABIN_Z.front - 0.3, Math.PI, 0, uniform, skinA, 0);
      }
      for (let i = 0; i < POOL; i++) if (!visibleP.has(i)) pool[i].p.root.setEnabled(false);
      // the trolley's stops: a word with the row, and the answer from someone there (in their own mood)
      if (o.cruise && crew.row >= 0 && crew.row !== lastStop && crew.stop > 0) { lastStop = crew.row; const sp = seatedIn(crew.row); say(0, crewLine('trolley'), new Vector3(0, FLOOR + 1.75, crew.z + 0.12), 'Cabin crew');
        if (sp >= 0) setTimeout(() => { const ss = seatAtIdx(sp); say(-1, paxLine(sp, 'trolley'), ss, 'Passenger ' + seatName(sp)); }, 2600); }
      const nowS = performance.now() / 1000; api.bubbles = api.bubbles.filter(b => b.until > nowS);
      // the light: dimmed at night in the cruise, full for boarding, take-off and landing
      const dim = o.night && o.cruise ? 0.45 : 1; lamp.intensity = 0.95 * dim + 0.15; stripM.emissiveColor = new Color3(1, 0.97, 0.9).scale(0.4 + 0.6 * dim);
      moodM.emissiveColor = Color3.FromHexString(C2).scale(o.night && o.cruise ? 1 : 0.55);
    },
    dispose() { lamp.dispose(); root.dispose(false, true); },
  };
  pax.body.thinInstanceEnablePicking = true; pax.skin.thinInstanceEnablePicking = true; pax.body.isPickable = pax.skin.isPickable = true;
  api.show(false);
  return api;
}
