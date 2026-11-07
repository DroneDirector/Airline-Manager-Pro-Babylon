// Live reflections on the terminal's outer glass (Settings → Graphics → Live reflections, off unless turned on).
// The glazing on each side of the building is one flat plane of glass (the apron side: every gate window and the glass
// between; the kerb side: the entrance and the Grand Hall's front). Each plane gets a mirror: the scene drawn once more
// as seen in that glass, so the jetways, the aircraft and the sky really show in it, even when they are behind you.
// Only the side of the terminal you are on is mirrored, and nothing while you are inside (from inside you see out).
// The jetways' windows (they move, and face every way) get a small live all-round reflection of the apron instead.
// The quality slider sets how sharp the mirrors are, how often they are drawn again and how much of the scenery is in them.
import { Scene, Mesh, AbstractMesh, Vector3, Plane, MirrorTexture, ReflectionProbe, PBRMaterial, Camera, Node } from '@babylonjs/core';

type Side = { mats: PBRMaterial[]; mirror: MirrorTexture | null; plane: Plane; meshes: Mesh[] };
const kindUp = (n: Node | null, rx: RegExp) => { for (let q: any = n; q; q = q.parent) { const md = q.metadata; if (md && (rx.test(md.kind || '') || rx.test(md.id || ''))) return true; } return false; };

/** Sets the mirrors up. glass: the outer glazing's material; isAirside(p): is a point (world) on the apron side of the
 *  terminal; extra(): other things worth seeing in the glass at higher quality (buildings, vehicles, the ground). */
export function glassMirrors(sc: Scene, cam: Camera, glass: PBRMaterial, sky: AbstractMesh[], extra: () => AbstractMesh[], look: (g: PBRMaterial) => void) {
  // the outer glazing's panes on the two long sides, by which way they face (their own normal, in the world)
  const sides: { [k: string]: Side } = {}, jetGlass: AbstractMesh[] = [];
  for (const m of sc.meshes) {
    if (m.material !== glass || !(m instanceof Mesh)) continue;
    if (kindUp(m, /^jetway$|^J-\d/)) { jetGlass.push(m); continue; }
    // which way a pane faces: across its thin side (its own frame), turned into the world
    const e = m.getBoundingInfo().boundingBox.extendSize, ax = e.x < e.z ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
    const n = Vector3.TransformNormal(ax, m.computeWorldMatrix(true)); n.y = 0; if (n.lengthSquared() < 1e-6) continue; n.normalize();
    let ang = Math.atan2(n.x, n.z); if (ang < 0) ang += Math.PI; if (ang >= Math.PI - 0.05) ang -= Math.PI;   // a line, not a direction
    const key = 'a' + Math.round(ang / (Math.PI / 36));
    const S0 = sides[key] || (sides[key] = { mats: [], mirror: null, plane: new Plane(0, 0, 1, 0), meshes: [] }); S0.meshes.push(m); (S0 as any).n = (S0 as any).n || n;
  }
  // the panes of each axis, split into the two sides of the building (front and back) by their position
  const planes: Side[] = [];
  for (const k of Object.keys(sides)) { const list = sides[k].meshes; if (list.length < 4) continue;
    const n0 = ((sides[k] as any).n as Vector3).clone();
    const d = list.map(m => Vector3.Dot(m.getBoundingInfo().boundingSphere.centerWorld, n0)), mid = (Math.min(...d) + Math.max(...d)) / 2;
    for (const sgn of [1, -1]) { const mine = list.filter((m, i) => (d[i] - mid) * sgn > 0); if (mine.length < 4) continue;
      const out = n0.scale(sgn), dd = Math.max(...mine.map(m => Vector3.Dot(m.getBoundingInfo().boundingSphere.centerWorld, out)));
      // the mirror plane: through the outermost panes, facing out (Babylon wants the plane's normal pointing into the glass)
      const g2 = glass.clone(glass.name + '/live' + planes.length) as PBRMaterial; (g2 as any)._inside = undefined; look(g2);
      const side: Side = { mats: [g2], mirror: null, plane: new Plane(-out.x, -out.y, -out.z, dd), meshes: mine }; (side as any).out = out; (side as any).dd = dd;
      planes.push(side); } }
  let probe: ReflectionProbe | null = null, active: Side | null = null, on = false, q = -1, jetOn = false;
  const list = (qq: number) => { const L: AbstractMesh[] = [...sky]; for (const m of sc.meshes) if (m.isEnabled() && m.isVisible && kindUp(m, /aircraft|^jetway$|^J-\d/i)) L.push(m); if (qq >= 0.5) L.push(...extra()); return L; };
  const size = (qq: number) => qq < 0.3 ? 128 : qq < 0.55 ? 256 : qq < 0.8 ? 512 : 1024;
  const every = (qq: number) => qq < 0.35 ? 3 : qq < 0.7 ? 2 : 1;
  const stop = () => { for (const p of planes) { if (p.mirror) { p.mirror.dispose(); p.mirror = null; } for (const m of p.meshes) m.material = glass; }
    if (probe) { probe.dispose(); probe = null; } for (const m of jetGlass) m.material = glass; jetMat && jetMat.dispose(); jetMat = null; active = null; };
  let jetMat: PBRMaterial | null = null;
  const makeJet = (L: AbstractMesh[]) => { if (!jetGlass.length) return; probe = new ReflectionProbe('glass-jet-probe', q < 0.55 ? 64 : 128, sc); probe.refreshRate = every(q) * 2; for (const m of L) if (!jetGlass.includes(m)) probe.renderList!.push(m);
    jetMat = glass.clone(glass.name + '/jet') as PBRMaterial; (jetMat as any)._inside = undefined; look(jetMat); jetMat.reflectionTexture = probe.cubeTexture; };
  /** Called a few times a second: on or off, the quality, which side you are on (or inside). */
  const tick = (want: boolean, quality: number, inside: boolean, jet = true) => {
    if (!want) { if (on) { stop(); on = false; } return; }
    // the jetways' all-round reflection is its own switch: turning it on or off leaves the terminal's glass as it is
    if (on && jet !== jetOn) { if (probe) { probe.dispose(); probe = null; } for (const m of jetGlass) m.material = glass; if (jetMat) { jetMat.dispose(); jetMat = null; } jetOn = jet; if (jet) makeJet(list(q)); }
    if (!on || Math.abs(quality - q) > 0.04) { stop(); on = true; q = quality; jetOn = jet;
      const L = list(q);
      for (const p of planes) { const mt = new MirrorTexture('glass-mirror', size(q), sc, true); mt.mirrorPlane = p.plane; mt.renderList = L; mt.refreshRate = every(q); mt.level = 1;
        p.mirror = mt; p.mats[0].reflectionTexture = mt; (p.mats[0] as any).realTimeFiltering = false; }
      if (jet) makeJet(L);
    }
    // the side you are on: its mirror drawn and its panes mirroring; the other side as before (and nothing while inside)
    const p0 = cam.globalPosition; let best: Side | null = null;
    if (!inside) for (const p of planes) { const out = (p as any).out as Vector3, dd = (p as any).dd as number; if (Vector3.Dot(p0, out) > dd - 1) best = p; }
    if (best !== active) { for (const p of planes) { const live = p === best; for (const m of p.meshes) m.material = live ? p.mats[0] : glass;
        /* a mirror is only drawn while glass that uses it is in view */ }
      active = best; }
    // the jetways' windows: live while you are outside on the apron side (the side with the jetways)
    if (probe && jetMat) { const apron = !inside && !!best && best === planes.find(p => p.meshes.some(m => kindUp(m, /GATE/i)));
      for (const m of jetGlass) m.material = apron ? jetMat : glass;
      probe.refreshRate = apron ? every(q) * 2 : 1e9;   // not drawn at all off the apron side
      if (apron) probe.position.copyFrom(p0).addInPlaceFromFloats(0, 2, 0); }
  };
  /** The look for inside or outside, kept the same on the live copies. */
  const sync = () => { for (const p of planes) look(p.mats[0]); if (jetMat) look(jetMat); };
  const mats = () => { const L: PBRMaterial[] = []; for (const p of planes) L.push(p.mats[0]); if (jetMat) L.push(jetMat); return L; };
  return { tick, sync, stop, mats, planes: planes.length };
}
