// Every door in the schedule (A-04) as its own object (named with its id, in the room it opens from): sliding glass
// doors, revolving doors (the wings turn all the time), swing doors, secure staff doors (steel, a card reader with
// its light), double doors, the one-way door out of security, jetway doors, and the open ways through (a frame and
// nothing to stop you). They open as you come up to them and shut behind you. The name of the room goes over the door
// on the public side.
import { MeshBuilder, TransformNode, InstancedMesh } from '@babylonjs/core';
import { Kit, signC } from './kit';
import { DOORS, Door, doorH, room, F2Y } from './plan';

export interface DoorObj { d: Door; node: TransformNode; k: number; want: number; slides: { m: InstancedMesh; x0: number; dir: number }[]; hinges: { t: TransformNode; dir: number }[]; wings: TransformNode | null; led: InstancedMesh | null }
const PUBLIC = /HALL|AIRSIDE|LANDING|FOOD|WALK|BAR|SECURITY|STAFF-CORR|BAGHALL|KERB/;

export function buildDoors(K: Kit): DoorObj[] {
  const { sc, M } = K, out: DoorObj[] = [];
  for (const d of DOORS) {
    if (d.type === 'museum') continue;   // the museum's own portal and sliding doors (museum.ts)
    const y = d.f === 2 ? F2Y : 0, h = doorH(d), w = d.w, yaw = d.along === 'x' ? 0 : Math.PI / 2;
    const node = K.obj(d.a, 'DOOR', d.x, y, d.z, yaw, d.id); node.metadata = { id: d.id, kind: 'door', room: d.a, type: d.type, act: 'door' };
    const D: DoorObj = { d, node, k: 0, want: 0, slides: [], hinges: [], wings: null, led: null };
    const frame = d.type === 'secure' ? M.steel : d.type === 'swing' || d.type === 'double' ? M.walnut : M.black;
    if (d.type !== 'open') { K.box(node, 0.1, h, 0.32, frame, -w / 2 - 0.05, h / 2, 0); K.box(node, 0.1, h, 0.32, frame, w / 2 + 0.05, h / 2, 0); K.box(node, w + 0.3, 0.14, 0.32, frame, 0, h + 0.07, 0); }
    else K.box(node, w + 0.2, 0.12, 0.34, M.mullion, 0, h + 0.06, 0);
    if (d.type === 'slide' || d.type === 'oneway' || d.type === 'jetway') {
      for (const s of [-1, 1]) { const m = K.box(node, w / 2 - 0.02, h - 0.04, 0.04, M.glass, s * w / 4, (h - 0.04) / 2, 0); D.slides.push({ m, x0: s * w / 4, dir: s });
        const fr = K.box(node, 0.05, h - 0.04, 0.06, M.black, s * (w / 2 - 0.03), (h - 0.04) / 2, 0); D.slides.push({ m: fr, x0: s * (w / 2 - 0.03), dir: s });
        const bar = K.box(node, w / 2 - 0.1, 0.06, 0.05, M.chrome, s * w / 4, 1.05, 0); D.slides.push({ m: bar, x0: s * w / 4, dir: s }); }
      K.box(node, w + 0.1, 0.22, 0.2, M.black, 0, h - 0.11, 0.14);   // the sliding gear's cover
      if (d.type === 'oneway') { const p = MeshBuilder.CreatePlane(K.nm('ow'), { width: 2.4, height: 0.4 }, sc); p.material = K.picture(signC('NO RE-ENTRY', '#B3261E', '#FFFFFF', 768, 128, '700 70px Arial, sans-serif'), 1); p.parent = node; p.position.set(0, h + 0.4, -0.2); p.metadata = node.metadata; }
    } else if (d.type === 'swing' || d.type === 'secure' || d.type === 'double') {
      const leaves = d.type === 'double' ? [-1, 1] : [-1], lw = d.type === 'double' ? w / 2 : w;
      for (const s of leaves) { const t = new TransformNode(K.nm('hinge'), sc); t.parent = node; t.position.set(s * w / 2, 0, 0); t.metadata = node.metadata;
        const mat = d.type === 'secure' ? M.steel : d.type === 'swing' && /WC|CLEAN/.test(d.a) ? M.offwhite : M.oak;
        K.box(t as any, lw - 0.04, h - 0.03, 0.05, mat, -s * lw / 2, (h - 0.03) / 2, 0); K.box(t as any, 0.03, 0.03, 0.16, M.chrome, -s * (lw - 0.12), 1.0, 0);
        if (d.type !== 'secure' && /OFFICE|ACADEMY|CREW/.test(d.a)) K.box(t as any, lw * 0.35, 0.6, 0.06, M.glass, -s * lw / 2, 1.5, 0);
        D.hinges.push({ t, dir: s }); }
      if (d.type === 'secure') { K.box(node, 0.09, 0.14, 0.05, M.black, w / 2 + 0.28, 1.25, -0.2); D.led = K.box(node, 0.04, 0.02, 0.06, M.redLed, w / 2 + 0.28, 1.3, -0.23); }
    } else if (d.type === 'revolving') {
      const r = w / 2; const dr = MeshBuilder.CreateCylinder(K.nm('drum'), { diameter: w, height: h, tessellation: 40, arc: 0.3, sideOrientation: 2 }, sc);
      dr.material = M.glass; dr.parent = node; dr.position.y = h / 2; dr.rotation.y = Math.PI / 2 - 0.3 * Math.PI; dr.metadata = node.metadata;
      const dr2 = dr.clone(K.nm('drum2')); dr2.rotation.y += Math.PI; dr2.parent = node;
      K.cyl(node, r + 0.12, 0.3, M.black, 0, h + 0.15, 0, undefined, 40); K.cyl(node, r + 0.05, 0.02, M.rubber, 0, 0.01, 0, undefined, 40);
      const wings = new TransformNode(K.nm('wings'), sc); wings.parent = node; wings.metadata = node.metadata; K.cyl(wings as any, 0.06, h - 0.1, M.chrome, 0, h / 2, 0);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; K.box(wings as any, r - 0.08, h - 0.15, 0.03, M.glass, Math.cos(a) * r / 2, h / 2, Math.sin(a) * r / 2, -a); }
      D.wings = wings;
    } else if (d.type === 'open') { /* nothing to stop you */ }
    // the room's name over the door, on the public side
    const a = room(d.a), other = d.b; if (a && PUBLIC.test(other) && !/^J-/.test(other)) {
      const name = a.name.replace(/\s*\(.*$/, ''), side = sideOf(d);
      const p = MeshBuilder.CreatePlane(K.nm('sign'), { width: Math.min(4.2, Math.max(1.8, name.length * 0.2)), height: 0.42 }, sc);
      p.material = K.picture(signC(name, '#14202E', '#F2F4F7', 1024, 104, '700 64px Arial, sans-serif'), 1); p.parent = node; p.position.set(0, h + 0.42, side * 0.2); p.rotation.y = side > 0 ? Math.PI : 0; p.metadata = node.metadata;
    }
    out.push(D);
  }
  return out;
}
/** Which way the door's public side is, in the door's own z (+1 or −1). */
function sideOf(d: Door): number {
  const a = room(d.a); if (!a) return 1;
  if (d.along === 'x') { const inA = (a.z0 + a.z1) / 2 > d.z; return inA ? -1 : 1; }
  const inA = (a.x0 + a.x1) / 2 > d.x; return inA ? -1 : 1;
}
/** Each frame: open as you come near (the same floor), shut when you have gone; revolving doors turn. */
export function stepDoors(list: DoorObj[], px: number, pz: number, pf: number, dt: number, t: number) {
  for (const D of list) {
    const near = D.d.f === pf && Math.hypot(px - D.d.x, pz - D.d.z) < Math.max(2.6, D.d.w * 0.7);
    D.want = near ? 1 : 0;
    if (D.wings) { D.wings.rotation.y = t * 0.6; continue; }
    if (Math.abs(D.k - D.want) < 0.001) continue;
    D.k += Math.sign(D.want - D.k) * Math.min(Math.abs(D.want - D.k), dt * (D.slides.length ? 1.8 : 1.4)); const e = D.k * D.k * (3 - 2 * D.k), w = D.d.w;
    for (const s of D.slides) s.m.position.x = s.x0 + s.dir * e * (w / 2 - 0.08);
    for (const h of D.hinges) h.t.rotation.y = -h.dir * e * 1.5;
  }
}
/** Can you pass through the door's opening now (open, or always open)? */
export function doorPassable(D: DoorObj) { return D.d.type === 'open' || D.d.type === 'revolving' || D.k > 0.7; }
