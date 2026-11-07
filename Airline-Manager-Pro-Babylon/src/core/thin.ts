// Fixed copies as thin instances: the furniture and fittings are built from shared parts (a box, a cylinder, a ball
// in each material), each placed as a copy ("instance") of its part. Every copy is an object the processor looks after
// each frame (its place, whether it is in view, its lights), some 14,000 of them in the airport. Here the copies that
// never move become thin instances: one list of places per part, per floor and per area (150 m), drawn by the graphics
// chip in one go, with nothing per copy left for the processor. Same parts, same places, same look.
// Walking: thin instances can't be walked into, so each copy that could be is given an exact invisible box (its own
// size, place and turn), all of them in one invisible shape per area, cut into small pieces for quick testing.
// Parked and rental cars are included; one that has to drive off is taken back out with releaseThin first.
// Never changed: anything that moves or opens (jetways, doors, lifts and their parts), swappable models,
// screens, and copies that are hidden or switched off.
import { logIssue } from './errlog';
import { Scene, Mesh, InstancedMesh, AbstractMesh, Matrix, Vector3, VertexData, Node, Quaternion } from '@babylonjs/core';

const NEVER = /COLLIDE|sky|look-|ramp-|holo|SCREEN|MONITOR|DOOR|LIFT|JETWAY|J-\d/i;
const blocked = (n: Node | null): boolean => { for (let p: any = n; p; p = p.parent) { const md = p.metadata; if (md && (md.slot || md.door || md.lift || md.live || /^(jetway|door|lift|escalator|walkway|moving-walkway|shuttle)$/i.test(md.kind || ''))) return true; } return false; };
/** What each object's copies became, so one can be taken back out (a car that drives off): its places in the lists,
 *  the parts as they were, and its box to walk against. */
type Part = { host: Mesh; i: number; src: Mesh; parent: Node | null; pos: Vector3; rot: any; scl: Vector3; name: string; md: any; cc: boolean };
const REG = new Map<Node, Part[]>(), BOXES = new Map<Node, { m: Mesh; v0: number; n: number }[]>();
const ownerNode = (m: AbstractMesh): Node | null => { for (let q: Node | null = m.parent; q; q = q.parent) { const md: any = q.metadata; if (md && md.kind && !/^(room|floor|group|airport|airfield|terminal|structure)$/i.test(md.kind)) return q; } return null; };
/** Takes an object (its node, e.g. a car) back out of the thin instances: its parts become normal objects again where
 *  they were, and its walking box goes. Returns false if it was never in them. */
export function releaseThin(owner: Node): boolean {
  const parts = REG.get(owner); if (!parts) return false; REG.delete(owner);
  const zero = Matrix.Scaling(0, 0, 0);
  for (const p of parts) { try { p.host.thinInstanceSetMatrixAt(p.i, zero, true);
    const c = p.src.createInstance(p.name); c.parent = p.parent; c.position.copyFrom(p.pos); if (p.rot) c.rotationQuaternion = p.rot.clone(); c.scaling.copyFrom(p.scl); c.metadata = p.md; c.checkCollisions = p.cc; } catch (e) { logIssue('Thin instances', 'A part could not be taken back out', String((e as any)?.message || e)); } }
  for (const b of BOXES.get(owner) || []) { const pos = b.m.getVerticesData('position'); if (!pos) continue; for (let k = b.v0 + 1; k < b.v0 + b.n; k++) { pos[k * 3] = pos[b.v0 * 3]; pos[k * 3 + 1] = pos[b.v0 * 3 + 1]; pos[k * 3 + 2] = pos[b.v0 * 3 + 2]; }
    b.m.unfreezeWorldMatrix(); b.m.updateVerticesData('position', pos); b.m.refreshBoundingInfo(); b.m.freezeWorldMatrix(); }
  BOXES.delete(owner); return true;
}
const BOX = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const BOXI = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];

/** Turns the fixed copies that `ok` allows into thin instances. `casters`: the shadow casters (updated in place).
 *  `walk`: give them invisible boxes to walk against. Returns how many copies became thin instances. */
export function thinStatic(sc: Scene, ok: (m: AbstractMesh) => boolean, casters: AbstractMesh[], walk: boolean, cell = 150): number {
  REG.clear(); BOXES.clear();   // a new place: the last one's records go
  const cast = new Set(casters), groups = new Map<string, InstancedMesh[]>(), solid = new Map<string, InstancedMesh[]>();
  for (const m of sc.meshes) {
    if (!(m instanceof InstancedMesh)) continue; const src = m.sourceMesh;
    if (m.getChildren().length || !m.isWorldMatrixFrozen || !m.isEnabled() || !m.isVisible || m.visibility !== 1 || !src || src.skeleton || src.morphTargetManager || src.hasLODLevels || m.billboardMode) continue;
    if (NEVER.test(m.name) || NEVER.test(src.name) || blocked(m) || !ok(m)) continue;
    const c = m.getBoundingInfo().boundingBox.centerWorld, k = [src.uniqueId, Math.floor(c.x / cell), Math.floor(c.z / cell), Math.floor(c.y / 5.5), cast.has(m) || cast.has(src) ? 1 : 0].join('|');
    (groups.get(k) || groups.set(k, []).get(k)!).push(m);
  }
  let n = 0; const gone = new Set<AbstractMesh>(), hosts: Mesh[] = [];
  for (const [k, list] of groups) {
    if (list.length < 2) continue;
    try {
    const src = list[0].sourceMesh, host = src.clone(`THIN/${src.name}/${k.split('|').slice(1, 4).join(',')}`, null, true, false) as Mesh;   // the part as it is at the origin
    host.parent = null; host.position.setAll(0); host.rotation.setAll(0); host.rotationQuaternion = null; host.scaling.setAll(1); host.setEnabled(true); host.isVisible = true; host.unfreezeWorldMatrix();
    host.makeGeometryUnique();   // its own copy of the shape: the list of places is kept on the shape, so lists must never share one
    host.isPickable = false; host.checkCollisions = false; host.metadata = { kind: 'thin', id: host.name };
    const buf = new Float32Array(16 * list.length); list.forEach((m, i) => m.computeWorldMatrix(true).copyToArray(buf, i * 16));
    if (!buf.every(Number.isFinite)) { host.dispose(); continue; }
    host.thinInstanceSetBuffer('matrix', buf, 16, true); host.thinInstanceRefreshBoundingInfo(false); host.computeWorldMatrix(true); host.freezeWorldMatrix(); host.doNotSyncBoundingInfo = true;
    if (k.endsWith('|1')) hosts.push(host);
    list.forEach((m, i) => { const own = ownerNode(m); if (!own) return; const r = REG.get(own) || (REG.set(own, []), REG.get(own)!);
      if (!m.rotationQuaternion) m.rotationQuaternion = Quaternion.FromEulerVector(m.rotation);
      r.push({ host, i, src: m.sourceMesh, parent: m.parent, pos: m.position.clone(), rot: m.rotationQuaternion.clone(), scl: m.scaling.clone(), name: m.name, md: m.metadata, cc: m.checkCollisions }); });
    for (const m of list) { if (walk && m.checkCollisions) { const sk = k.split('|').slice(1, 3).join('|'); (solid.get(sk) || solid.set(sk, []).get(sk)!).push(m); } gone.add(m); }
    n += list.length;
    } catch (e) { logIssue('Thin instances', `${list[0].sourceMesh.name}: ${list.length} copies left as they were`, String((e as any)?.message || e)); }
  }
  // the invisible boxes to walk against: one box per piece of furniture (its whole outline, in its own turn: a row of
  // seats from the floor to the top of its back), so you bump into it and slide along it as before; parts that belong
  // to no piece get a box of their own
  const OUTER = /^(room|floor|group|airport|airfield|terminal|structure)$/i, WHOLE = /SEAT|BENCH|CHAIR|SOFA|STOOL|TABLE|PLANT|LOCKER|SHELF|CART|BIN|STALL/i;
  const ownerOf = (m: AbstractMesh): Node | null => { for (let q: Node | null = m.parent; q; q = q.parent) { const md: any = q.metadata; if (md && md.kind && !OUTER.test(md.kind)) return q; } return null; };
  for (const [sk, list] of solid) {
    const pos: number[] = [], ind: number[] = []; const v = new Vector3(), boxes = new Map<any, { W: Matrix; lo: Vector3; hi: Vector3 }>(), parts = new Map<any, InstancedMesh[]>();
    for (const m of list) { const bb = m.sourceMesh.getBoundingInfo().boundingBox, ctr = bb.center, ext = bb.extendSize, W = m.getWorldMatrix(), own = ownerOf(m);
      const key = own || m, OW = own ? (own as any).getWorldMatrix() as Matrix : W; let b = boxes.get(key); (parts.get(key) || parts.set(key, []).get(key)!).push(m);
      if (!b) { b = { W: OW, lo: new Vector3(Infinity, Infinity, Infinity), hi: new Vector3(-Infinity, -Infinity, -Infinity) }; boxes.set(key, b); }
      const inv = own ? Matrix.Invert(OW) : Matrix.Identity();
      for (const [x, y, z] of BOX) { Vector3.TransformCoordinatesFromFloatsToRef(ctr.x + x * ext.x, ctr.y + y * ext.y, ctr.z + z * ext.z, W, v); if (own) Vector3.TransformCoordinatesToRef(v, inv, v); else Vector3.TransformCoordinatesFromFloatsToRef(ctr.x + x * ext.x, ctr.y + y * ext.y, ctr.z + z * ext.z, Matrix.IdentityReadOnly, v); b.lo.minimizeInPlace(v); b.hi.maximizeInPlace(v); } }
    let cur: Node | null = null; const boxRec: [Node, number, number][] = [];
    const emit = (W: Matrix, lo: Vector3, hi: Vector3) => { const base = pos.length / 3; if (cur) boxRec.push([cur, base, 8]); const _b = base, c = lo.add(hi).scale(0.5), e = hi.subtract(lo).scale(0.5);
      for (const [x, y, z] of BOX) { Vector3.TransformCoordinatesFromFloatsToRef(c.x + x * e.x, c.y + y * e.y, c.z + z * e.z, W, v); pos.push(v.x, v.y, v.z); }
      for (const i of BOXI) ind.push(base + i);
      for (let t = BOXI.length - 3; t >= 0; t -= 3) ind.push(base + BOXI[t], base + BOXI[t + 2], base + BOXI[t + 1]); };   // both ways round: walked against from any side
    for (const [key, b] of boxes) { const sz = b.hi.subtract(b.lo);
      const kind = key instanceof InstancedMesh ? '' : String(((key as any).metadata || {}).kind || '');
      cur = key instanceof InstancedMesh ? null : key as Node;
      if (key instanceof InstancedMesh || (WHOLE.test(kind) && sz.y <= 3) || (sz.x <= 4 && sz.z <= 4 && sz.y <= 2.5)) { emit(b.W, b.lo, b.hi); continue; }
      // a big piece (a bar counter, a security lane): exact boxes for its parts, so it can still be walked round and through
      for (const m of parts.get(key) || []) { const bb = m.sourceMesh.getBoundingInfo().boundingBox; emit(m.getWorldMatrix(), bb.minimum, bb.maximum); } }
    const c = new Mesh(`THIN/${sk}/COLLIDE`, sc), vd = new VertexData(); vd.positions = pos; vd.indices = ind; vd.applyToMesh(c, true);   // updatable: a box can be taken away
    for (const [own, v0, nv] of boxRec) (BOXES.get(own) || (BOXES.set(own, []), BOXES.get(own)!)).push({ m: c, v0, n: nv });
    c.isVisible = false; c.isPickable = false; c.checkCollisions = true; c.subdivide(Math.max(1, Math.min(256, Math.ceil(ind.length / 3 / 400)))); c.computeWorldMatrix(true); c.freezeWorldMatrix();
  }
  // the shadows: the new lists cast where their copies did
  for (let i = casters.length - 1; i >= 0; i--) if (gone.has(casters[i])) casters.splice(i, 1);
  for (const h of hosts) casters.push(h);
  for (const m of gone) m.dispose(true, false);
  return n;
}

/** Moving parts that come in many identical pieces (the jetways' wheels, stair steps, posts and rails): each piece keeps
 *  its own moving node (a wheel still spins, a step still tips to stay level), but they are drawn as one thin-instance
 *  list per kind of piece. The lists take the pieces' places again only while `moving()` says something moves; when all
 *  is still they cost nothing. The pieces themselves stay, unseen, to be walked on. Returns the step to call each frame. */
export function thinMoving(sc: Scene, parts: Mesh[], casters: AbstractMesh[], moving: () => boolean, label: string): () => void {
  const groups = new Map<string, Mesh[]>();
  for (const m of parts) { if (!(m instanceof Mesh) || m.isDisposed() || (m as any).isAnInstance || m.skeleton || !m.material || m.getTotalVertices() <= 0 || !m.isEnabled() || !m.isVisible) continue;
    const e = m.getBoundingInfo().boundingBox.extendSize, k = [label, m.name.replace(/[0-9]+/g, '#'), m.material.uniqueId, m.getTotalVertices(), m.getTotalIndices(), e.x.toFixed(3), e.y.toFixed(3), e.z.toFixed(3)].join('|');
    (groups.get(k) || groups.set(k, []).get(k)!).push(m); }
  const lists: { host: Mesh; list: Mesh[]; buf: Float32Array }[] = [], cast = new Set(casters);
  for (const [k, list] of groups) {
    if (list.length < 2) continue;
    try { const m0 = list[0], host = m0.clone('THINMOVE/' + k.split('|').slice(0, 2).join('/'), null, true, false) as Mesh;
      host.parent = null; host.position.setAll(0); host.rotation.setAll(0); host.rotationQuaternion = null; host.scaling.setAll(1); host.unfreezeWorldMatrix(); host.makeGeometryUnique();
      host.checkCollisions = false; host.isPickable = false; host.isVisible = true; host.setEnabled(true); host.metadata = { kind: 'thin', id: host.name };
      const buf = new Float32Array(16 * list.length); list.forEach((m, i) => m.computeWorldMatrix(true).copyToArray(buf, i * 16));
      host.thinInstanceSetBuffer('matrix', buf, 16, false); host.thinInstanceRefreshBoundingInfo(false); host.alwaysSelectAsActiveMesh = false;
      if (list.some(m => cast.has(m))) casters.push(host);
      for (const m of list) { m.isVisible = false; const i = casters.indexOf(m); if (i >= 0) casters.splice(i, 1); }   // still walked on, no longer drawn
      lists.push({ host, list, buf }); } catch (e) { logIssue('Thin instances', `${label}: ${list.length} moving pieces left as they were`, String((e as any)?.message || e)); }
  }
  let wasMoving = true;
  return () => { const mv = moving(); if (!mv && !wasMoving) return; wasMoving = mv;
    for (const L of lists) { L.list.forEach((m, i) => m.computeWorldMatrix(true).copyToArray(L.buf, i * 16)); L.host.thinInstanceBufferUpdated('matrix'); L.host.thinInstanceRefreshBoundingInfo(false); } };
}
