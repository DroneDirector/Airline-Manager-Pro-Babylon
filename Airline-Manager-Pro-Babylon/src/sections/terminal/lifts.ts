// The lifts (E-01, E-G1–4): each in its own shaft through both floors, clad outside, with a landing door on each
// floor and the car riding up and down inside it. The shaft is a little wider than the hole cut for it in Floor 2's
// slab and in the ceilings, so its walls cover the slab's edge: you never see into the gap between the floors, and the
// car never passes through anything. The car: a floor, brushed steel walls with a mirror at the back, a handrail, a
// lit ceiling, the button panel with the floor shown, and its own doors that open with the landing doors.
// In airport mode they work as lifts do: come up to the doors and the lift is called to your floor; it opens; step in
// and after a moment the doors close and it takes you to the other floor (gently, speeding up and slowing down), then
// opens again. Tap, click, E or a controller's Cross while in front of it or inside does the same at once.
import { TransformNode, Vector3, MeshBuilder, AbstractMesh, DynamicTexture } from '@babylonjs/core';
import type { Kit } from './kit';
import { LIFTS, F2Y, F2CEIL } from './plan';

export const LIFT_HOLE = 1.02;               // half the size of the hole in the slab and the ceilings round each lift
const OUT = 1.06, IN = 0.92, T = 0.07;         // the shaft: outer half width, inner half width, wall thickness
const DOOR = 0.5, DH = 2.2, CAR = 0.84, CH = 2.4, SPEED = 1.1;
export interface LiftCtl { id: string; x: number; z: number; face: number; node: TransformNode; car: TransformNode; y: number; to: number; k: number; hold: number; inT: number; moving: boolean; v: number;
  land: { a: AbstractMesh; b: AbstractMesh }[]; carDoor: { a: AbstractMesh; b: AbstractMesh }; display: DynamicTexture; shown: string; moving_parts: AbstractMesh[] }

export function liftHoles() { return LIFTS.map(l => ({ x0: l.x - LIFT_HOLE, z0: l.z - LIFT_HOLE, x1: l.x + LIFT_HOLE, z1: l.z + LIFT_HOLE })); }

export function buildLifts(K: Kit, signC: (t: string, bg: string, fg: string, w: number, h: number, font: string) => HTMLCanvasElement): LiftCtl[] {
  const { sc, M } = K, out: LiftCtl[] = [];
  const clad = K.pbr({ key: 'liftClad', col: '#D9DCE0', rough: 0.45, metal: 0.15 }), brushed = K.pbr({ key: 'liftBrushed', col: '#B9C0C8', rough: 0.28, metal: 0.9 });
  const mirror = K.pbr({ key: 'liftMirror', col: '#E8EEF2', rough: 0.02, metal: 1 }), floorM = K.pbr({ key: 'liftFloor', col: '#3A3F46', rough: 0.6, metal: 0.1 });
  const doorM = K.pbr({ key: 'liftDoor', col: '#C8CED6', rough: 0.22, metal: 0.95 }), trim = M.chrome, dark = M.black;
  for (const l of LIFTS) {
    const o = K.obj(l.from, 'LIFT', l.x, 0, l.z, l.face, l.id); o.metadata.kind = 'lift'; o.metadata.act = 'lift';
    const parts: AbstractMesh[] = [];
    // the shaft: the back and the sides from the ground floor up to Floor 2's ceiling, over the edge of the holes
    K.box(o, OUT * 2, F2CEIL, T, clad, 0, F2CEIL / 2, -OUT + T / 2); K.box(o, T, F2CEIL, OUT * 2, clad, -OUT + T / 2, F2CEIL / 2, 0); K.box(o, T, F2CEIL, OUT * 2, clad, OUT - T / 2, F2CEIL / 2, 0);
    // its front: panels either side of the doors on each floor, and over them up to the next floor
    for (const sx of [-1, 1]) K.box(o, OUT - DOOR, F2CEIL, T, clad, sx * (DOOR + (OUT - DOOR) / 2), F2CEIL / 2, OUT - T / 2);
    for (const fy of [0, F2Y]) { const top = fy === 0 ? F2Y : F2CEIL; K.box(o, DOOR * 2, top - fy - DH, T, clad, 0, fy + DH + (top - fy - DH) / 2, OUT - T / 2); }
    // the cap over the shaft, under the roof
    K.box(o, OUT * 2, 0.1, OUT * 2, clad, 0, F2CEIL - 0.05, 0);
    // on each floor: the door frame, the landing doors (two leaves sliding apart behind the front panels), the call button and the sign
    const land: LiftCtl['land'] = [];
    for (const fy of [0, F2Y]) {
      K.box(o, 0.05, DH + 0.05, 0.1, trim, -DOOR - 0.02, fy + DH / 2, OUT + 0.01); K.box(o, 0.05, DH + 0.05, 0.1, trim, DOOR + 0.02, fy + DH / 2, OUT + 0.01); K.box(o, DOOR * 2 + 0.09, 0.05, 0.1, trim, 0, fy + DH + 0.02, OUT + 0.01);
      const a = K.box(o, DOOR, DH, 0.03, doorM, -DOOR / 2, fy + DH / 2, OUT - T - 0.02), b = K.box(o, DOOR, DH, 0.03, doorM, DOOR / 2, fy + DH / 2, OUT - T - 0.02);
      a.metadata = b.metadata = o.metadata; land.push({ a, b }); parts.push(a, b);
      K.box(o, 0.09, 0.16, 0.03, dark, DOOR + 0.2, fy + 1.15, OUT + 0.02); K.box(o, 0.04, 0.04, 0.02, M.green, DOOR + 0.2, fy + 1.18, OUT + 0.035);
      const p = MeshBuilder.CreatePlane(K.nm('lf'), { width: 0.9, height: 0.24 }, sc); p.material = K.picture(signC(`${l.id} · LIFT`, '#14202E', '#F2F4F7', 512, 154, '700 72px Arial, sans-serif'), 1); p.parent = o; p.position.set(0, fy + DH + 0.3, OUT + 0.015); p.rotation.y = Math.PI; p.metadata = o.metadata;
    }
    // the car
    const car = new TransformNode('lift-car-' + l.id, sc); car.parent = o; car.metadata = o.metadata;
    const cp = (m: AbstractMesh) => { parts.push(m); m.metadata = o.metadata; return m; };
    cp(K.box(car, CAR * 2, 0.12, CAR * 2, floorM, 0, -0.06, 0));
    cp(K.box(car, CAR * 2, CH, 0.04, brushed, 0, CH / 2, -CAR)); cp(K.box(car, 0.04, CH, CAR * 2, brushed, -CAR, CH / 2, 0)); cp(K.box(car, 0.04, CH, CAR * 2, brushed, CAR, CH / 2, 0));
    cp(K.box(car, CAR * 2 - 0.2, 1.1, 0.01, mirror, 0, 1.55, -CAR + 0.03));
    cp(K.box(car, CAR * 2 - 0.2, 0.04, 0.04, trim, 0, 0.95, -CAR + 0.07)); for (const sx of [-1, 1]) cp(K.box(car, 0.04, 0.04, CAR * 2 - 0.4, trim, sx * (CAR - 0.07), 0.95, -0.1));
    cp(K.box(car, CAR * 2, 0.08, CAR * 2, brushed, 0, CH + 0.04, 0)); cp(K.box(car, CAR * 1.4, 0.02, CAR * 1.4, M.light, 0, CH - 0.01, 0));
    for (const sx of [-1, 1]) cp(K.box(car, CAR - DOOR + 0.04, CH, 0.05, brushed, sx * (DOOR + (CAR - DOOR) / 2), CH / 2, CAR));
    cp(K.box(car, DOOR * 2, CH - DH, 0.05, brushed, 0, DH + (CH - DH) / 2, CAR));
    // the button panel by the door, with the floor shown over it
    cp(K.box(car, 0.02, 0.5, 0.16, dark, CAR - 0.03, 1.15, CAR - 0.25));
    for (const [y, c] of [[1.25, M.green], [1.1, M.green], [0.95, M.redLed]] as [number, any][]) cp(K.box(car, 0.02, 0.05, 0.05, c, CAR - 0.045, y, CAR - 0.25));
    const display = new DynamicTexture('lift-disp', { width: 128, height: 64 }, sc, false); const dm = K.picture(document.createElement('canvas'), 1.4); dm.diffuseTexture = display; dm.emissiveTexture = display;
    const dp = MeshBuilder.CreatePlane(K.nm('ld'), { width: 0.26, height: 0.13 }, sc); dp.material = dm; dp.parent = car; dp.position.set(0, DH + 0.1, CAR - 0.03); parts.push(dp);
    const ca = cp(K.box(car, DOOR, DH, 0.03, doorM, -DOOR / 2, DH / 2, CAR - 0.06)), cb = cp(K.box(car, DOOR, DH, 0.03, doorM, DOOR / 2, DH / 2, CAR - 0.06));
    K.block(1, l.x - OUT, l.z - OUT, l.x + OUT, l.z + OUT); K.block(2, l.x - OUT, l.z - OUT, l.x + OUT, l.z + OUT);
    const L: LiftCtl = { id: l.id, x: l.x, z: l.z, face: l.face, node: o, car, y: 0, to: 0, k: 0, hold: 0, inT: 0, moving: false, v: 0, land, carDoor: { a: ca, b: cb }, display, shown: '', moving_parts: parts };
    showFloor(L); out.push(L);
  }
  return out;
}
function showFloor(L: LiftCtl) {
  const f = L.moving ? (L.to > L.y ? '▲' : '▼') + ' ' + (L.y > F2Y / 2 ? 2 : 1) : String(L.y > F2Y / 2 ? 2 : 1); if (f === L.shown) return; L.shown = f;
  const x = L.display.getContext() as CanvasRenderingContext2D; x.fillStyle = '#05070A'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#FF9A2E'; x.font = '700 44px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(f, 64, 34); L.display.update();
}
/** The doors: 0 shut … 1 open, the landing doors on the car's floor with the car's own. */
function setDoors(L: LiftCtl) {
  const e = L.k * L.k * (3 - 2 * L.k), f = L.y > F2Y / 2 ? 1 : 0, off = e * (DOOR - 0.04);
  L.land.forEach((d, i) => { const o = i === f && !L.moving ? off : 0; d.a.position.x = -DOOR / 2 - o; d.b.position.x = DOOR / 2 + o; });
  L.carDoor.a.position.x = -DOOR / 2 - off; L.carDoor.b.position.x = DOOR / 2 + off;
}
/** Where a point is in a lift's own frame (x across, z out of its doors). */
function local(L: LiftCtl, px: number, pz: number): [number, number] { const dx = px - L.x, dz = pz - L.z, c = Math.cos(L.face), s = Math.sin(L.face); return [dx * c - dz * s, dx * s + dz * c]; }
export function liftInside(L: LiftCtl, px: number, py: number, pz: number): boolean { const [lx, lz] = local(L, px, pz); return Math.abs(lx) < CAR - 0.12 && lz > -CAR + 0.1 && lz < CAR - 0.05 && Math.abs(py - L.y) < 1.0; }
function waiting(L: LiftCtl, px: number, py: number, pz: number): number { const [lx, lz] = local(L, px, pz); if (Math.abs(lx) > 1.4 || lz < OUT - 0.05 || lz > OUT + 2.4) return -1; return py > F2Y / 2 ? 1 : 0; }

/** Each frame in airport mode: calls, doors, the ride. Returns how far up (or down) to carry whoever is inside, and a line to show. */
export function stepLifts(list: LiftCtl[], px: number, py: number, pz: number, dt: number, press: boolean): { dy: number; hint: string } {
  let dy = 0, hint = '';
  for (const L of list) {
    const inside = liftInside(L, px, py, pz), at = waiting(L, px, py, pz), here = L.y > F2Y / 2 ? 1 : 0;
    if (L.moving) {
      // the ride: speeding up, cruising, slowing down to stop level with the floor
      const left = L.to - L.y, dist = Math.abs(left), want = Math.sign(left) * Math.min(SPEED, Math.sqrt(2 * 0.9 * dist) + 0.02);
      L.v += Math.max(-0.9 * dt, Math.min(0.9 * dt, want - L.v)); let step = L.v * dt; if (Math.abs(step) >= dist) { step = left; L.moving = false; L.v = 0; L.hold = 6; }
      if (inside) dy = step; L.y += step; L.car.position.y = L.y; showFloor(L);
      if (inside) hint = `${L.id} · ${L.to > F2Y / 2 ? 'going up to Floor 2' : 'going down to Floor 1'}`;
    } else {
      // standing at a floor: open for whoever is there, close after a while, set off once someone is inside
      const someone = inside || at === here;
      if (at >= 0 && at !== here && !inside) { if (L.k > 0) L.k = Math.max(0, L.k - dt * 1.6); else { L.to = at ? F2Y : 0; L.moving = true; } hint = `${L.id} · coming to Floor ${at + 1}`; }
      else if (someone) { L.k = Math.min(1, L.k + dt * 1.4); L.hold = Math.max(L.hold, 4); }
      else { L.hold -= dt; if (L.hold <= 0) L.k = Math.max(0, L.k - dt * 1.2); }
      if (inside) { L.inT += dt; hint = `${L.id} · to Floor ${here ? 1 : 2}${L.inT < 1.6 && !press ? ' in a moment' : ''}`;
        if ((L.inT > 1.6 || press) && L.k >= 1) L.inT = Math.max(L.inT, 1.6);
        if (L.inT >= 1.6) { L.k = Math.max(0, L.k - dt * 1.6); if (L.k <= 0) { L.to = here ? 0 : F2Y; L.moving = true; L.inT = 0; } } }
      else L.inT = 0;
      if (press && at === here && !inside) L.k = Math.min(1, L.k + 0.5);
    }
    setDoors(L);
  }
  return { dy, hint };
}
/** Straight to a floor (the terminal demo walks floor to floor without the ride): the car there with its doors open. */
export function liftAt(L: LiftCtl, floor: number) { L.y = floor === 2 ? F2Y : 0; L.to = L.y; L.moving = false; L.car.position.y = L.y; L.k = 1; L.hold = 5; setDoors(L); showFloor(L); }
export { Vector3 };
