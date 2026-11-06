// The Training room (the Academy): a classroom off the staff corridor, on its west side, opposite the Operations
// office. Through inward-opening double doors from the corridor; always open to walk into, with or without a class.
//  - The front is the west wall: the whiteboard with today's course and the lesson on it, the instructor's desk and
//    chair, the instructor at the board; two windows in the north wall near the front.
//  - 12 student desks in three rows of four, an aisle down the middle from the doors to the front, each with its chair.
//  - On every desk the airline's notebook (its mark, its name and "Academy" below); pens of different colours, pencils,
//    calculators and paper on some of them, never all the same.
//  - Bookshelves along the south wall with aviation books, a poster, a clock with moving hands, and plants.
//  - The class: everyone of yours on a course now sits at a desk (the longest there at the front).
// Built in the building's own coordinates (metres: x east, y up, z north). The small things on the desks are drawn
// once for all of them (thin instances), so the room stays light on phones and tablets.
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, StandardMaterial, DynamicTexture, Texture, TransformNode, AbstractMesh, PointLight, Matrix, Quaternion } from '@babylonjs/core';
import * as P from '../lounge/pictures';
import { buildPerson, posePerson, stridePerson, Person } from '../court/people';
import type { Seat } from '../court/seats';

export const TRN = { x0: -14.6, x1: -5.6, z0: 9.5, z1: 17.5, h: 3.0 };
export const TRN_DOOR = { z0: 12.6, z1: 14.4 };            // the double doors, in the corridor's west wall (x = TRN.x1)
const ROWS = [-11.6, -10.0, -8.4];                           // the desks' rows (x), front to back
const COLS = [10.75, 11.75, 15.25, 16.25];                   // their places across the room (z), the aisle between
export const TRN_BOOKS = ['Principles of Flight', 'Piloting for Beginners', 'Becoming Cabin Crew', 'Ground Operations Handbook', 'Aviation Weather', 'Air Law',
  'Human Factors', 'Navigation', 'Aircraft Systems', 'Safety & Emergency Procedures', 'Ramp & Baggage Handling', 'Dangerous Goods', 'Radio Telephony',
  'First Aid on Board', 'Mass & Balance', 'Aircraft Maintenance Basics', 'Dispatch & Flight Planning', 'Customer Service in the Air'];

export interface Student { id: string; name: string; role: string; sex: string; course: string; who: string; until: number; from: number }
export interface TrainingData { teacher?: { name: string; title: string; sex: string }; students?: Student[]; lessons?: { [who: string]: string[] } }
export interface Training {
  root: TransformNode; blocks: number[][]; casters: AbstractMesh[]; metals: PBRMaterial[]; doors: AbstractMesh[][]; spawn: { x: number; z: number; yaw: number };
  people: { [id: string]: { p: Person; s?: Student } }; teacher: Person; subject: string; lines: string[];
  board(line: string): void; step(t: number, dt: number, talking: boolean): void; clock(): void;
}

export function buildTraining(sc: Scene, airline: string, c1: string, c2: string, data: TrainingData): Training {
  const root = new TransformNode('training', sc), blocks: number[][] = [], casters: AbstractMesh[] = [], metals: PBRMaterial[] = [];
  let n = 0; const nm = (k: string) => 'trn-' + k + '-' + (n++);
  const block = (xa: number, za: number, xb: number, zb: number) => blocks.push([Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)]);
  const tex = (c: HTMLCanvasElement, u = 1, v = 1): DynamicTexture => { const t = new DynamicTexture(nm('t'), { width: c.width, height: c.height }, sc, true); (t.getContext() as any).drawImage(c, 0, 0); t.update(true); t.uScale = u; t.vScale = v; t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const pbr = (o: { col?: string; tex?: Texture; metal?: number; rough?: number; emis?: string; emisK?: number }): PBRMaterial => {
    const m = new PBRMaterial(nm('m'), sc); m.maxSimultaneousLights = 8; m.albedoColor = o.col ? Color3.FromHexString(o.col) : Color3.White(); if (o.tex) m.albedoTexture = o.tex;
    m.metallic = o.metal || 0; m.roughness = o.rough != null ? o.rough : 0.6; if (o.emis) m.emissiveColor = Color3.FromHexString(o.emis).scale(o.emisK || 1); if ((o.metal || 0) >= 0.6) metals.push(m); return m; };
  const picMat = (c: HTMLCanvasElement, k = 0.35) => { const m = new StandardMaterial(nm('pm'), sc); const t = tex(c); m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new Color3(k, k, k); m.specularColor = new Color3(0.05, 0.05, 0.05); return m; };
  const place = (m: Mesh, mat: any, x: number, y: number, z: number, ry = 0, cast = true, act?: string, extra?: any) => { m.position.set(x, y, z); m.rotation.y = ry; m.material = mat; m.receiveShadows = true; m.parent = root; if (cast) casters.push(m); if (act) m.metadata = Object.assign({ act }, extra || {}); return m; };
  const box = (w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry = 0, act?: string, cast = true, extra?: any) => place(MeshBuilder.CreateBox(nm('b'), { width: w, height: h, depth: d }, sc), mat, x, y, z, ry, cast, act, extra);
  const flat = (w: number, h: number, mat: any, x: number, y: number, z: number, ry: number, act?: string) => place(MeshBuilder.CreatePlane(nm('p'), { width: w, height: h }, sc), mat, x, y, z, ry, false, act);
  const { x0, x1, z0, z1, h } = TRN, W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

  // ---- the room: carpet tiles, plastered walls, a ceiling with light panels ----
  const wallM = pbr({ tex: tex(P.plaster('#E6E3DC'), 3, 1), rough: 0.9 });
  const fl = MeshBuilder.CreateGround(nm('floor'), { width: W, height: D }, sc); fl.position.set(cx, 0.002, cz); fl.material = pbr({ tex: tex(P.noise('#4A5566', 16, 31), 5, 5), rough: 0.95 }); fl.receiveShadows = true; fl.parent = root;
  const ce = MeshBuilder.CreatePlane(nm('ceil'), { width: W, height: D }, sc); ce.rotation.x = -Math.PI / 2; ce.position.set(cx, h, cz); ce.material = pbr({ col: '#EEEDE8', rough: 0.95 }); ce.parent = root;
  const panel = pbr({ col: '#FFFFFF', emis: '#F4F6FA', emisK: 1.5 });
  for (const x of [x0 + 2.2, x0 + 4.7, x0 + 7.2]) for (const z of [cz - 2, cz + 2]) box(1.2, 0.03, 0.6, panel, x, h - 0.015, z, 0, undefined, false);
  // the walls (facing in): the front with the board, the back with the doors, the south with the shelves, the north with the windows
  flat(D, h, wallM, x0, h / 2, cz, -Math.PI / 2);
  const dz0 = TRN_DOOR.z0, dz1 = TRN_DOOR.z1;
  flat(dz0 - z0, h, wallM, x1 - 0.01, h / 2, (z0 + dz0) / 2, Math.PI / 2); flat(z1 - dz1, h, wallM, x1 - 0.01, h / 2, (dz1 + z1) / 2, Math.PI / 2); flat(dz1 - dz0, h - 2.15, wallM, x1 - 0.01, 2.15 + (h - 2.15) / 2, (dz0 + dz1) / 2, Math.PI / 2);
  flat(W, h, wallM, cx, h / 2, z0, Math.PI);
  { // the north wall round the two windows, and the view out of them
    let xa = x0; const sill = 0.9, top = 2.3;
    const ws = [[x0 + 0.8, x0 + 2.2], [x0 + 2.6, x0 + 4.0]];   // two windows near the front
    for (const [a, b] of ws) { flat(a - xa, h, wallM, (xa + a) / 2, h / 2, z1, 0); flat(b - a, sill, wallM, (a + b) / 2, sill / 2, z1, 0); flat(b - a, h - top, wallM, (a + b) / 2, top + (h - top) / 2, z1, 0); xa = b;
      flat(b - a, top - sill, picMat(P.view(), 1.0), (a + b) / 2, (sill + top) / 2, z1 + 0.06, 0);
      box(b - a + 0.08, 0.04, 0.18, pbr({ col: '#F2F2F0', rough: 0.4 }), (a + b) / 2, sill, z1 - 0.07, 0); }
    flat(x1 - xa, h, wallM, (xa + x1) / 2, h / 2, z1, 0);
  }
  const skirt = pbr({ col: '#3A3F48', rough: 0.5 });
  box(0.02, 0.1, D, skirt, x0 + 0.01, 0.05, cz, 0, undefined, false); box(W, 0.1, 0.02, skirt, cx, 0.05, z0 + 0.01, 0, undefined, false);

  // ---- the front: the whiteboard, the instructor's desk and chair ----
  const bc = document.createElement('canvas'); bc.width = 2048; bc.height = 680; const bt = new DynamicTexture(nm('board'), { width: 2048, height: 680 }, sc, true);
  const bm = new StandardMaterial(nm('boardM'), sc); bm.diffuseTexture = bt; bm.emissiveTexture = bt; bm.emissiveColor = new Color3(0.35, 0.35, 0.35); bm.specularColor = new Color3(0.25, 0.25, 0.25);
  flat(3.6, 1.2, bm, x0 + 0.03, 1.55, cz, -Math.PI / 2, 'whiteboard');
  box(0.05, 1.3, 3.7, pbr({ col: '#B8BEC6', metal: 0.7, rough: 0.3 }), x0 + 0.02, 1.55, cz, 0, undefined, false);
  box(0.12, 0.04, 3.2, pbr({ col: '#9AA2AC', metal: 0.6, rough: 0.35 }), x0 + 0.08, 0.93, cz, 0, undefined, false);
  for (const [z, col] of [[cz - 0.6, '#1A4FB0'], [cz - 0.45, '#C0262D'], [cz - 0.3, '#1D7A3E'], [cz - 0.15, '#111']] as [number, string][]) box(0.02, 0.02, 0.12, pbr({ col }), x0 + 0.1, 0.96, z, 0, undefined, false);
  const wood = pbr({ tex: tex(P.wood('#B48A5E', '#7A5634', 7)), rough: 0.55 }), steel = pbr({ col: '#6A727C', metal: 0.8, rough: 0.35 }), dark = pbr({ col: '#2A2E35', rough: 0.4, metal: 0.3 });
  const tdx = x0 + 1.4, tdz = z0 + 1.9;
  box(0.8, 0.04, 1.5, wood, tdx, 0.75, tdz, 0, 'teacherdesk'); box(0.76, 0.7, 0.03, wood, tdx + 0.1, 0.38, tdz - 0.73, 0); box(0.76, 0.7, 0.03, wood, tdx + 0.1, 0.38, tdz + 0.73, 0); box(0.03, 0.55, 1.44, wood, tdx - 0.37, 0.45, tdz, 0);
  block(tdx - 0.45, tdz - 0.8, tdx + 0.45, tdz + 0.8);
  box(0.34, 0.02, 0.24, dark, tdx + 0.05, 0.78, tdz - 0.3, 0.2); box(0.32, 0.22, 0.01, dark, tdx - 0.06, 0.88, tdz - 0.3, 0.2);       // the laptop
  box(0.45, 0.06, 0.45, pbr({ col: '#202A3A', rough: 0.8 }), tdx - 0.65, 0.48, tdz + 0.1, 0); box(0.45, 0.55, 0.06, pbr({ col: '#202A3A', rough: 0.8 }), tdx - 0.88, 0.8, tdz + 0.1, 0);
  box(0.05, 0.45, 0.05, steel, tdx - 0.65, 0.23, tdz + 0.1, 0);
  block(tdx - 0.95, tdz - 0.15, tdx - 0.4, tdz + 0.35);

  // ---- the desks and chairs ----
  const deskTop = pbr({ col: '#E9E6DF', rough: 0.45 }), legM = steel, chairM = pbr({ col: shade(c1, -0.15), rough: 0.7 });
  const seats: Seat[] = [];
  for (const x of ROWS) for (const z of COLS) {
    box(0.55, 0.03, 0.82, deskTop, x, 0.74, z, 0, 'desk');
    for (const [dx, dz] of [[-0.24, -0.37], [0.24, -0.37], [-0.24, 0.37], [0.24, 0.37]]) box(0.035, 0.73, 0.035, legM, x + dx, 0.365, z + dz, 0, undefined, false);
    box(0.02, 0.28, 0.78, legM, x - 0.25, 0.55, z, 0, undefined, false);
    const sx = x + 0.62; box(0.42, 0.05, 0.42, chairM, sx, 0.46, z, 0, 'chair'); box(0.05, 0.42, 0.4, chairM, sx + 0.2, 0.74, z, 0, undefined);
    for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) box(0.025, 0.45, 0.025, legM, sx + dx, 0.225, z + dz, 0, undefined, false);
    block(x - 0.3, z - 0.43, x + 0.3, z + 0.43); block(sx - 0.24, z - 0.24, sx + 0.24, z + 0.24);
    seats.push({ id: 's' + seats.length, x: sx - 0.02, y: 0, z, yaw: -Math.PI / 2, sit: 1 });
  }
  // the notebooks, pens, pencils, calculators and paper: drawn once for all the desks
  const R = P.rng(2211), notebook = notebookCanvas(airline, c1);
  const nb = MeshBuilder.CreateBox(nm('nb'), { width: 0.21, height: 0.012, depth: 0.29 }, sc); nb.material = picMat(notebook, 0.25); nb.parent = root;
  const pen = MeshBuilder.CreateCylinder(nm('pen'), { height: 0.14, diameter: 0.009, tessellation: 6 }, sc); pen.rotation.z = Math.PI / 2; pen.bakeCurrentTransformIntoVertices(); pen.material = pbr({ col: '#FFFFFF', rough: 0.4 }); pen.parent = root;
  const calc = MeshBuilder.CreateBox(nm('calc'), { width: 0.08, height: 0.012, depth: 0.15 }, sc); calc.material = pbr({ col: '#2B2F36', rough: 0.5 }); calc.parent = root;
  const paper = MeshBuilder.CreateBox(nm('paper'), { width: 0.21, height: 0.002, depth: 0.297 }, sc); paper.material = pbr({ col: '#F7F7F4', rough: 0.9 }); paper.parent = root;
  const nbM: Matrix[] = [], penM: Matrix[] = [], penC: number[] = [], calcM: Matrix[] = [], papM: Matrix[] = [];
  const at = (x: number, y: number, z: number, ry: number) => Matrix.Compose(Vector3.One(), Quaternion.FromEulerAngles(0, ry, 0), new Vector3(x, y, z));
  const PENS = ['#1A4FB0', '#111111', '#C0262D', '#1D7A3E', '#E2B714', '#6A3FA0'];
  for (const x of ROWS) for (const z of COLS) {
    nbM.push(at(x + 0.05, 0.762, z + (R() - 0.5) * 0.2, -Math.PI / 2 + (R() - 0.5) * 0.3));
    const np = 1 + Math.floor(R() * 3); for (let i = 0; i < np; i++) { penM.push(at(x + (R() - 0.5) * 0.3, 0.761, z + 0.22 + (R() - 0.5) * 0.1, R() * Math.PI)); const c = Color3.FromHexString(PENS[Math.floor(R() * PENS.length)]); penC.push(c.r, c.g, c.b, 1); }
    if (R() < 0.4) calcM.push(at(x - 0.1, 0.762, z - 0.28, (R() - 0.5) * 0.5));
    if (R() < 0.55) papM.push(at(x - 0.05, 0.757, z - 0.12 + (R() - 0.5) * 0.1, (R() - 0.5) * 0.6));
  }
  const thin = (m: Mesh, ms: Matrix[]) => { const a = new Float32Array(ms.length * 16); ms.forEach((mm, i) => mm.copyToArray(a, i * 16)); m.thinInstanceSetBuffer('matrix', a, 16, true); m.isVisible = ms.length > 0; };
  thin(nb, nbM); thin(pen, penM); pen.thinInstanceSetBuffer('color', new Float32Array(penC), 4, true); thin(calc, calcM); thin(paper, papM);

  // ---- the south wall: the bookshelves with aviation books ----
  const shelfM = pbr({ tex: tex(P.wood('#8A6440', '#5A3E26', 9)), rough: 0.55 });
  for (let i = 0; i < 3; i++) {
    const sx0 = x0 + 2.2 + i * 1.9, sxc = sx0 + 0.85;
    box(1.7, 2.1, 0.03, shelfM, sxc, 1.05, z0 + 0.02, 0, undefined, false); box(0.03, 2.1, 0.34, shelfM, sx0, 1.05, z0 + 0.18, 0); box(0.03, 2.1, 0.34, shelfM, sx0 + 1.7, 1.05, z0 + 0.18, 0);
    for (let s = 0; s < 5; s++) { const y = 0.08 + s * 0.48; box(1.7, 0.025, 0.34, shelfM, sxc, y, z0 + 0.18, 0, undefined, false);
      if (s < 4) flat(1.62, 0.3, picMat(spines(i * 10 + s, c1), 0.3), sxc, y + 0.165, z0 + 0.33, Math.PI, 'books'); }
    block(sx0 - 0.05, z0, sx0 + 1.75, z0 + 0.4);
  }
  // ---- the back wall: a poster, the clock above the doors; the plants in the corners ----
  flat(1.0, 1.4, picMat(poster(c1, c2), 0.4), x1 - 0.02, 1.6, z0 + 1.4, Math.PI / 2, 'poster');
  flat(1.0, 1.4, picMat(poster2(c1, c2), 0.4), x1 - 0.02, 1.6, z1 - 1.4, Math.PI / 2, 'poster');
  const clockC = P.canvas(256, 256)[0], ck = clockC.getContext('2d') as CanvasRenderingContext2D;
  ck.fillStyle = '#FAFAF8'; ck.beginPath(); ck.arc(128, 128, 124, 0, Math.PI * 2); ck.fill(); ck.lineWidth = 8; ck.strokeStyle = '#2A2E35'; ck.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ck.fillStyle = '#2A2E35'; ck.fillRect(128 + Math.sin(a) * 100 - 3, 128 - Math.cos(a) * 100 - 10, 6, 20); }
  const face = MeshBuilder.CreateDisc(nm('clock'), { radius: 0.17, tessellation: 40 }, sc); place(face, picMat(clockC, 0.5), x1 - 0.03, 2.55, cz, Math.PI / 2, false, 'clock');
  const hand = (len: number, w: number) => { const m = MeshBuilder.CreateBox(nm('hand'), { width: 0.01, height: len, depth: w }, sc); m.setPivotPoint(new Vector3(0, -len / 2, 0)); m.material = pbr({ col: '#15181C' }); m.parent = root; m.position.set(x1 - 0.045, 2.55 + len / 2, cz); return m; };
  const hh = hand(0.09, 0.014), mh = hand(0.14, 0.009);
  const pot = pbr({ col: '#D9D4CC', rough: 0.6 }), leaf = pbr({ col: '#2F6A3A', rough: 0.7 });
  for (const [px, pz] of [[x0 + 0.5, z1 - 0.5], [x1 - 0.5, z0 + 0.5], [x0 + 0.5, z0 + 0.5]]) {
    place(MeshBuilder.CreateCylinder(nm('pot'), { height: 0.45, diameterTop: 0.42, diameterBottom: 0.32, tessellation: 18 }, sc), pot, px, 0.225, pz);
    for (let i = 0; i < 9; i++) { const l = MeshBuilder.CreateSphere(nm('lf'), { diameter: 0.34, segments: 6 }, sc); l.scaling.set(0.55, 1.6, 0.2); place(l, leaf, px + Math.cos(i * 0.7) * 0.12, 0.75 + (i % 3) * 0.18, pz + Math.sin(i * 0.7) * 0.12, i * 0.7); }
    block(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3);
  }

  // ---- the doors: two leaves opening inward, each on its hinge ----
  const doorM = pbr({ tex: tex(P.wood('#C9A57A', '#8A6440', 12)), rough: 0.5 }), glassM = pbr({ col: '#BFD4E2', rough: 0.05, metal: 0.1 });
  const leaves: AbstractMesh[][] = [];
  for (const [za, zb] of [[dz0, (dz0 + dz1) / 2], [(dz0 + dz1) / 2, dz1]]) {
    const zc = (za + zb) / 2, w = zb - za - 0.02;
    const l = box(0.045, 2.1, w, doorM, x1, 1.05, zc, 0, 'trndoor'), g = box(0.05, 0.6, 0.16, glassM, x1, 1.55, zc, 0, 'trndoor'), hdl = box(0.08, 0.03, 0.14, steel, x1 - 0.04, 1.02, zc + (za === dz0 ? 0.3 : -0.3) * (w / 0.88), 0, 'trndoor');
    leaves.push([l, g, hdl]);
  }
  box(0.06, 0.06, dz1 - dz0 + 0.12, steel, x1, 2.13, (dz0 + dz1) / 2, 0, undefined, false);
  // the room's own light
  const lt = new PointLight(nm('light'), new Vector3(cx, h - 0.4, cz), sc); lt.intensity = 1.0; lt.range = 14; lt.diffuse = Color3.FromHexString('#F4F6FA');
  const lt2 = new PointLight(nm('light'), new Vector3(x0 + 1.2, h - 0.5, cz), sc); lt2.intensity = 0.5; lt2.range = 6;

  // ---- the people: the instructor at the board, and the class at the desks ----
  const mats = new Map<string, PBRMaterial>(), T = data.teacher || { name: 'Daniel Brandt', title: 'Instructor, the Academy', sex: 'm' };
  const people: Training['people'] = {};
  const tSeat: Seat = { id: 'teacher', x: x0 + 0.85, y: 0, z: cz + 0.6, yaw: Math.PI / 2, sit: 0 };
  const teacher = buildPerson(sc, { key: 'clerk-teacher', seat: 'teacher', sex: T.sex, name: T.name, sit: 0 }, tSeat, c1, mats);
  teacher.root.parent = root; for (const m of teacher.meshes) { m.metadata = { act: 'trn', id: 'teacher' }; casters.push(m); } people.teacher = { p: teacher };
  const st = (data.students || []).slice(0, seats.length);
  st.forEach((s, i) => { const p = buildPerson(sc, { key: 'public-' + s.id, seat: seats[i].id, sex: s.sex, name: s.name, sit: 1 }, seats[i], c1, mats); p.root.parent = root;
    for (const m of p.meshes) { m.metadata = { act: 'trn', id: s.id }; casters.push(m); } people[s.id] = { p, s }; });
  // what the class is about: the kind most of them are learning
  const count: { [k: string]: number } = {}; for (const s of st) count[s.who] = (count[s.who] || 0) + 1;
  const subject = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || '';
  const lines = (subject && data.lessons && data.lessons[subject]) || [];

  const api: Training = {
    root, blocks, casters, metals, doors: leaves, spawn: { x: x1 - 1.2, z: (dz0 + dz1) / 2, yaw: -Math.PI / 2 }, people, teacher, subject, lines,
    board(line: string) {
      const x = bt.getContext() as CanvasRenderingContext2D; x.fillStyle = '#F8F9FA'; x.fillRect(0, 0, 2048, 680);
      x.strokeStyle = 'rgba(0,0,0,.05)'; x.lineWidth = 2; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(30 + i * 170, 30); x.quadraticCurveTo(80 + i * 170, 340, 40 + i * 170, 650); x.stroke(); }
      x.fillStyle = c1; x.font = '700 64px Arial, sans-serif'; x.textAlign = 'left'; x.fillText(`${airline} Academy`, 70, 110);
      x.fillStyle = '#C0262D'; x.font = '600 44px Arial, sans-serif';
      const names = Array.from(new Set(st.map(s => s.course))).slice(0, 3);
      x.fillText(names.length ? `Today: ${names.join(' · ')}`.slice(0, 80) : 'No class today', 70, 190);
      x.fillStyle = '#1A2230'; x.font = '400 48px "Comic Sans MS", "Segoe Print", cursive';
      const text = line || (st.length ? '' : 'Courses are booked in Crew → Training. Everyone on a course sits here.');
      const words = text.split(' '); let ln = '', y = 300; for (const w of words) { const t = ln ? ln + ' ' + w : w; if (x.measureText(t).width > 1880) { x.fillText(ln, 70, y); y += 70; ln = w; if (y > 620) break; } else ln = t; } if (ln && y <= 620) x.fillText(ln, 70, y);
      x.strokeStyle = c2; x.lineWidth = 6; x.beginPath(); x.moveTo(70, 220); x.lineTo(900, 220); x.stroke();
      bt.update(true);
    },
    step(t, dt, talking) {
      const head = new Vector3(teacher.root.position.x, 1.66, teacher.root.position.z);
      posePerson(teacher, t, talking, new Vector3(x0 + 7, 1.2, cz), dt);
      for (const k in people) if (k !== 'teacher') posePerson(people[k].p, t, false, head, dt);
      // the instructor walks to and fro in front of the board while talking, stopping now and then to face the class
      const cyc = (t * 0.05) % 1, seg = cyc < 0.25 ? sm2(cyc / 0.25) : cyc < 0.5 ? 1 : cyc < 0.75 ? 1 - sm2((cyc - 0.5) / 0.25) : 0, v = cyc < 0.25 || (cyc >= 0.5 && cyc < 0.75) ? 1 : 0;
      teacher.root.position.z = cz - 0.9 + seg * 2.4; const face = v ? (cyc < 0.25 ? 0 : Math.PI) : Math.PI / 2 + Math.sin(t * 0.25) * 0.25;
      let da = face - teacher.root.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); teacher.root.rotation.y += da * Math.min(1, dt * 4); teacher.seat.yaw = teacher.root.rotation.y;
      (teacher as any).walkPh = ((teacher as any).walkPh || 0) + dt * 5.5 * v; stridePerson(teacher, (teacher as any).walkPh, v * Math.min(1, Math.abs(Math.sin(Math.PI * (cyc % 0.25) / 0.25)) * 1.6));
    },
    clock() { const d = new Date(), hr = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2, mn = (d.getMinutes() + d.getSeconds() / 60) / 60 * Math.PI * 2; hh.rotation.x = -hr; mh.rotation.x = -mn; },
  };
  api.board(''); api.clock();
  return api;
}

function sm2(x: number) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
function shade(hex: string, k: number): string { const c = Color3.FromHexString(hex), f = (v: number) => Math.round(Math.max(0, Math.min(1, k < 0 ? v * (1 + k) : v + (1 - v) * k)) * 255); return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`; }
/** The airline's notebook cover: its mark, its name, and Academy below. */
function notebookCanvas(name: string, acc: string): HTMLCanvasElement {
  const [cv, k] = P.canvas(300, 420), w = 300;
  k.fillStyle = acc; k.fillRect(0, 0, w, 420); k.fillStyle = 'rgba(0,0,0,.18)'; k.fillRect(0, 0, 18, 420);
  k.save(); k.translate(w / 2 + 9, 140); k.beginPath(); k.arc(0, 0, 64, 0, Math.PI * 2); k.lineWidth = 4; k.strokeStyle = 'rgba(255,255,255,.6)'; k.stroke();
  k.fillStyle = '#fff'; k.beginPath(); const s = 64 / 14.5;
  for (const [a, b] of [[0, -11.5], [2, -2], [11.5, 0], [2, 2], [0, 11.5], [-2, 2], [-11.5, 0], [-2, -2]]) k.lineTo(a * s, b * s);
  k.closePath(); k.fill(); k.restore();
  k.textAlign = 'center'; k.fillStyle = '#fff'; let fs = 34; k.font = `700 ${fs}px Arial, sans-serif`;
  while (k.measureText(name).width > w - 50 && fs > 16) { fs -= 2; k.font = `700 ${fs}px Arial, sans-serif`; }
  k.fillText(name, w / 2 + 9, 270); k.font = '600 30px Arial, sans-serif'; k.fillStyle = 'rgba(255,255,255,.85)'; k.fillText('Academy', w / 2 + 9, 315);
  return cv;
}
/** A shelf of book spines, some with the aviation titles on them. */
function spines(seed: number, acc: string): HTMLCanvasElement {
  const [c, x] = P.canvas(1024, 192), r = P.rng(seed + 5), cols = ['#1C3A6E', '#7A1F2B', '#1E5A3A', '#3A3A44', '#C9A227', '#2F4F7F', '#5A2E6A', '#8A4A22', '#E8E4DA', acc];
  x.fillStyle = '#5A3E26'; x.fillRect(0, 0, 1024, 192);
  let px = 6;
  while (px < 1010) { const w = 26 + Math.floor(r() * 34), hgt = 140 + Math.floor(r() * 50); if (px + w > 1018) break; const col = cols[Math.floor(r() * cols.length)];
    x.fillStyle = col; x.fillRect(px, 192 - hgt, w - 2, hgt); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(px + 2, 192 - hgt + 8, w - 6, 4);
    if (w > 34 && r() < 0.8) { const t = TRN_BOOKS[Math.floor(r() * TRN_BOOKS.length)]; x.save(); x.translate(px + w / 2 + 5, 192 - 8); x.rotate(-Math.PI / 2); x.fillStyle = col === '#E8E4DA' || col === '#C9A227' ? '#1A1A1A' : '#F2EFE6'; x.font = '600 15px Arial, sans-serif'; x.fillText(t.slice(0, Math.floor(hgt / 9)), 0, 0); x.restore(); }
    px += w; }
  return c;
}
function poster(c1: string, c2: string): HTMLCanvasElement {
  const [c, x] = P.canvas(500, 700); const g = x.createLinearGradient(0, 0, 0, 700); g.addColorStop(0, '#4E86C2'); g.addColorStop(1, '#D9E8F4'); x.fillStyle = g; x.fillRect(0, 0, 500, 700);
  x.fillStyle = '#EEF1F4'; x.beginPath(); x.ellipse(250, 330, 190, 26, -0.25, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(200, 340); x.lineTo(120, 470); x.lineTo(170, 470); x.lineTo(290, 330); x.fill(); x.beginPath(); x.moveTo(390, 290); x.lineTo(440, 200); x.lineTo(460, 210); x.lineTo(430, 300); x.fill();
  x.fillStyle = c1; x.fillRect(0, 560, 500, 140); x.fillStyle = c2; x.fillRect(0, 556, 500, 6);
  x.fillStyle = '#fff'; x.font = '700 44px Arial, sans-serif'; x.textAlign = 'center'; x.fillText('Safety first', 250, 620); x.font = '400 24px Arial, sans-serif'; x.fillText('Every flight, every time', 250, 660);
  return c;
}
function poster2(c1: string, c2: string): HTMLCanvasElement {
  const [c, x] = P.canvas(500, 700); x.fillStyle = '#F4F2EC'; x.fillRect(0, 0, 500, 700);
  x.fillStyle = c1; x.font = '700 40px Arial, sans-serif'; x.textAlign = 'center'; x.fillText('The phonetic alphabet', 250, 70);
  const A = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'];
  x.font = '500 24px Arial, sans-serif'; x.textAlign = 'left'; A.forEach((w, i) => { const col = i < 13 ? 0 : 1, row = i % 13; x.fillStyle = c2; x.fillText(w[0], 50 + col * 230, 130 + row * 42); x.fillStyle = '#1A2230'; x.fillText(w, 85 + col * 230, 130 + row * 42); });
  return c;
}
