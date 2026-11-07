// Fewer draw calls with the same picture, for places with a great many static things:
//  - mergeStatic: static meshes that share a material, in the same 60 m square, become one mesh (one draw call instead
//    of many). Never merged: anything that moves, is switched on and off, can be swapped for your own model (a slot), is a
//    rental car, a door or a lift, glass the map traces, an instance or the source of instances, or is named as one of
//    the parts other code looks for. Shadow casters stay shadow casters.
//  - octreeStatic: the things that never move are sorted into blocks of space, so each frame whole blocks out of view
//    are skipped instead of testing every object on its own (the picture is the same; moving things are always tested).
//  - freezeStatic: materials that never change after loading are frozen (Babylon stops re-checking them every frame).
//    Never frozen: anything with its own shader code (the ground, wet surfaces, snow, glint), anything that glows or is
//    lit up and down (lamps, beacons, signs, screens), the sky and weather, and anything named as changing.
import { Scene, Mesh, AbstractMesh, Material, MultiMaterial, ShaderMaterial, Node, Vector3 } from '@babylonjs/core';

const NEVER = /STRUCTURE|COLLIDE|sky|look-|ramp-|GROUND|PAINT|MARKINGS|ROAD|holo|SCREEN|MONITOR|DOOR|LIFT|AIRFIELD\//i;
const metaBlocks = (n: Node | null): boolean => { for (let p: any = n; p; p = p.parent) { const md = p.metadata; if (md && (md.slot || md.rental || md.kind === 'glass' || md.door || md.lift)) return true; } return false; };

export function mergeStatic(sc: Scene, ok: (m: AbstractMesh) => boolean, casters?: AbstractMesh[], cell = 60): number {
  const cast = new Set(casters || []), groups = new Map<string, Mesh[]>();
  for (const m of sc.meshes) {
    if (!(m instanceof Mesh) || (m as any).isAnInstance || m.hasInstances || m.hasThinInstances || m.skeleton || !m.isEnabled() || !m.isVisible) continue;
    if (!m.material || m.material instanceof MultiMaterial || m.getTotalVertices() <= 0 || !m.isWorldMatrixFrozen || m.billboardMode || m.visibility !== 1 || m.morphTargetManager) continue;
    if (NEVER.test(m.name) || metaBlocks(m) || !ok(m)) continue;
    const c = m.getBoundingInfo().boundingBox.centerWorld;
    const key = [m.material.uniqueId, m.renderingGroupId, m.receiveShadows ? 1 : 0, m.checkCollisions ? 1 : 0, m.isPickable ? 1 : 0, cast.has(m) ? 1 : 0, m.layerMask,
      Math.floor(c.x / cell), Math.floor(c.z / cell), m.getVerticesDataKinds().sort().join('+')].join('|');
    (groups.get(key) || groups.set(key, []).get(key)!).push(m);
  }
  let saved = 0;
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    // in pieces of at most about 300,000 points each
    const chunks: Mesh[][] = []; let cur: Mesh[] = [], n = 0;
    for (const m of list) { const v = m.getTotalVertices(); if (n + v > 300000 && cur.length) { chunks.push(cur); cur = []; n = 0; } cur.push(m); n += v; }
    if (cur.length) chunks.push(cur);
    for (const part of chunks) {
      if (part.length < 2) continue;
      const first = part[0], wasCaster = cast.has(first), rg = first.renderingGroupId, rs = first.receiveShadows, cc = first.checkCollisions, pk = first.isPickable, lm = first.layerMask;
      try {
        const mm = Mesh.MergeMeshes(part, true, true, undefined, false, false); if (!mm) continue;
        mm.name = `MERGED/${first.material!.name}/${key.split('|').slice(7, 9).join(',')}`;
        mm.renderingGroupId = rg; mm.receiveShadows = rs; mm.checkCollisions = cc; mm.isPickable = pk; mm.layerMask = lm;
        mm.computeWorldMatrix(true); mm.freezeWorldMatrix(); mm.doNotSyncBoundingInfo = true;
        if (casters && wasCaster) { for (const m of part) { const i = casters.indexOf(m); if (i >= 0) casters.splice(i, 1); } casters.push(mm); }
        saved += part.length - 1;
      } catch (e) { /* these stay as they are */ }
    }
  }
  return saved;
}

const LIVE = /BEACON|LAMP|LED|GATE-NUMBER|LIGHT|GLOW|SIGN|SCREEN|STROBE|NAV|MON|AD\b|ADS|VIDEO|sky|sun|cloud|rain|snow|wx|look-|holo|water|sea|flag|fire/i;
export function freezeStatic(sc: Scene, keep: Set<Material> = new Set()): number {
  let n = 0;
  for (const mt of sc.materials as any[]) {
    if (mt.isFrozen || keep.has(mt) || mt instanceof ShaderMaterial || mt instanceof MultiMaterial || LIVE.test(mt.name || '')) continue;
    if (mt.pluginManager && mt.pluginManager._plugins && mt.pluginManager._plugins.length) continue;          // its own shader code
    const e = mt.emissiveColor; if (mt.emissiveTexture || (e && e.r + e.g + e.b > 0.001)) continue;           // glows: may be lit up and down
    if ([mt.diffuseTexture, mt.albedoTexture].some((t: any) => t && (t.video || (t.getClassName && /Video/.test(t.getClassName()))))) continue;   // films
    try { mt.freeze(); n++; } catch (err) { /* stays live */ }
  }
  return n;
}

/** Fixed things (their place frozen) go into an octree for picking what is in view; everything else, and anything made
 *  later, is always looked at. A fixed thing that starts moving again is taken out of the blocks within two seconds. */
export function octreeStatic(sc: Scene): () => void {
  const fixed: AbstractMesh[] = [], moving: AbstractMesh[] = [];
  for (const m of sc.meshes) { if (m.isDisposed()) continue; (m.isWorldMatrixFrozen && !m.skeleton && !(m as any).hasThinInstances && !m.alwaysSelectAsActiveMesh && !m.infiniteDistance ? fixed : moving).push(m); }
  if (fixed.length < 300) return () => { /* too few to be worth it */ };
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of fixed) { const b = m.getBoundingInfo().boundingBox; lo.minimizeInPlace(b.minimumWorld); hi.maximizeInPlace(b.maximumWorld); }
  const oct: any = (sc as any).createOrUpdateSelectionOctree(64, 2); oct.update(lo, hi, fixed); oct.dynamicContent = moving;
  const inBlocks = new Set<AbstractMesh>(fixed);
  const added = sc.onNewMeshAddedObservable.add(m => { if (oct.dynamicContent.indexOf(m) < 0) oct.dynamicContent.push(m); });
  const gone = sc.onMeshRemovedObservable.add(m => { if (inBlocks.delete(m)) oct.removeMesh(m); const i = oct.dynamicContent.indexOf(m); if (i >= 0) oct.dynamicContent.splice(i, 1); });
  const timer = setInterval(() => { for (const m of inBlocks) if (!m.isWorldMatrixFrozen) { inBlocks.delete(m); oct.removeMesh(m); oct.dynamicContent.push(m); } }, 2000);
  return () => { clearInterval(timer); sc.onNewMeshAddedObservable.remove(added); sc.onMeshRemovedObservable.remove(gone); };
}

/** Shader pre-warming: things that start hidden or switched off (jetway insides, far detail, lift cars, rental cars, ...)
 *  get their shaders compiled in the background, a few at a time, so there is no stutter when they first come into view. */
export function prewarmHidden(sc: Scene): void {
  const todo: AbstractMesh[] = []; const seen = new Set<string>();
  for (const m of sc.meshes) { const mat = m.material; if (!mat || (m as any).isAnInstance || !(m as Mesh).geometry) continue;
    if (m.isVisible && m.isEnabled()) continue; const k = mat.uniqueId + ':' + ((m as Mesh).hasInstances ? 1 : 0) + ':' + (m.receiveShadows ? 1 : 0); if (seen.has(k)) continue; seen.add(k); todo.push(m); }
  let i = 0; const next = () => { if (sc.isDisposed || i >= todo.length) return; const m = todo[i++], mat = m.material;
    if (!mat || m.isDisposed()) { setTimeout(next, 0); return; }
    mat.forceCompilationAsync(m, { useInstances: !!(m as Mesh).hasInstances }).catch(() => { /* compiled when shown */ }).then(() => setTimeout(next, 16)); };
  setTimeout(next, 500);
}

/** The places built without the airport's kit (the lounge, the offices, operations, the hangar, the court, the joined
 *  building, the terminal on its own): what is fixed is found by watching, then combined like at the airport.
 *  A second and a half after the place has settled, everything that has not moved, is not animated and is not a door,
 *  a lift, a screen, a person, an animal, a vehicle, an aircraft or the like counts as fixed: it is fixed in place and
 *  gets the texture arrays, merging, thin instances (with boxes to walk against) and the octree. Anything that fails is
 *  logged (shown at the start screen next time) and simply drawn as it was. */
const MOVES = /door|lift|elev|hatch|drawer|fan|wheel|prop|rotor|screen|monitor|\btv\b|npc|person|people|staff|pilot|crew|avatar|pet|dog|cat|bird|animal|aircraft|airliner|plane|\bcar\b|vehicle|bus|truck|cart|player|camera|sky|cloud|water|fire|flag|curtain|blind|clock|board|fids|ball|net|hose|jetway|look-|holo|wx|rain|snow/i;
export function optimizePlace(sc: Scene, place: string, log: (what: string, why: string) => void) {
  const moving = (m: Node | null) => { for (let q: any = m; q; q = q.parent) { if (MOVES.test(q.name || '')) return true; const md = q.metadata; if (md && (md.door || md.lift || md.slot || md.live || MOVES.test(String(md.kind || '')))) return true; } return false; };
  setTimeout(() => {
    if (sc.isDisposed) return; const W0 = new Map<AbstractMesh, Float32Array>();
    for (const m of sc.meshes) W0.set(m, new Float32Array(m.computeWorldMatrix(true).m));
    setTimeout(() => {
      if (sc.isDisposed) return;
      const animated = new Set<any>(); for (const g of sc.animationGroups) for (const ta of g.targetedAnimations) animated.add(ta.target); for (const a of (sc as any)._activeAnimatables || []) animated.add(a.target);
      const isAnim = (m: Node) => { for (let q: any = m; q; q = q.parent) if (animated.has(q)) return true; return false; };
      const fixed = new Set<AbstractMesh>();
      for (const m of sc.meshes) { const w0 = W0.get(m); if (!w0 || m.skeleton || m.isWorldMatrixFrozen && !(m as any).isAnInstance && false) continue;
        const w1 = m.computeWorldMatrix(true).m; let same = true; for (let i = 0; i < 16; i++) if (Math.abs(w1[i] - w0[i]) > 1e-5) { same = false; break; }
        if (same && !moving(m) && !isAnim(m)) fixed.add(m); }
      for (const m of fixed) { if (!m.isWorldMatrixFrozen) m.freezeWorldMatrix(); m.doNotSyncBoundingInfo = true; }
      const ok = (m: AbstractMesh) => fixed.has(m), gens: any[] = [];
      for (const l of sc.lights) { const g: any = (l as any).getShadowGenerator && (l as any).getShadowGenerator(); if (g && g.getShadowMap()) gens.push(g); }
      const casters: AbstractMesh[] = []; for (const g of gens) for (const m of g.getShadowMap().renderList || []) if (!casters.includes(m)) casters.push(m);
      const step = (what: string, f: () => void) => { try { f(); } catch (e) { log(what + ' could not be done', String((e as any)?.message || e)); } };
      step('Texture arrays', () => shareMaterialsLazy(sc, ok));
      step('Merging fixed objects', () => mergeStatic(sc, ok, casters));
      step('Thin instances', () => thinLazy(sc, ok, casters, !!sc.collisionsEnabled));
      for (const g of gens) { const sm = g.getShadowMap(); if (sm && sm.renderList) sm.renderList = casters.filter(m => !m.isDisposed()); }
      step('Freezing materials', () => freezeStatic(sc));
      if (!(sc as any)._selectionOctree) step('The octree', () => { const stop = octreeStatic(sc); sc.onDisposeObservable.addOnce(stop); });
      step('Shader pre-warming', () => prewarmHidden(sc));
    }, 1500);
  }, 2500);
}
// (loaded on use: texarray and thin import this file's neighbours)
let shareMaterialsLazy: (sc: Scene, ok: (m: AbstractMesh) => boolean) => any = () => 0;
let thinLazy: (sc: Scene, ok: (m: AbstractMesh) => boolean, c: AbstractMesh[], walk: boolean) => any = () => 0;
export function setCombiners(share: typeof shareMaterialsLazy, thin: typeof thinLazy) { shareMaterialsLazy = share; thinLazy = thin; }
