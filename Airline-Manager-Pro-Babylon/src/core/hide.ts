// Things you can't see from where you are, not drawn. The jetways' insides (the carpet, the wall linings, the ceiling
// slats, the handrails, the console and its gauges, the signs, the adverts, the lights inside, the fire extinguisher)
// can only be seen from close by, through the doors and the cab's windows: from further than about 35 m away they are
// left out. Each jetway on its own, checked four times a second; on the phone and the PC alike.
import { Scene, AbstractMesh, Vector3 } from '@babylonjs/core';

const INSIDE_MAT = /^(jwCeil|jwWall|jwCarpet|jwSlats|jwChrome|jwSignBlue|jwGauge)$|\/LED$/;
const INSIDE_NAME = /LINING|CONSOLE|FIRE-EXTINGUISHER|EXIT|\/AD|CARPET|CEILING|HANDRAIL/i;

export function jetwayInteriors(sc: Scene, near = 35): (cam: Vector3) => void {
  const groups = new Map<string, AbstractMesh[]>();
  for (const m of sc.meshes) { const j = /^J-(\d+)/.exec(m.name); if (!j) continue;
    const mt = m.material ? m.material.name : ''; if (!INSIDE_MAT.test(mt) && !INSIDE_NAME.test(m.name)) continue;
    (groups.get(j[1]) || groups.set(j[1], []).get(j[1])!).push(m); }
  const list = Array.from(groups.values()).filter(g => g.length), shown = list.map(() => true);
  let t = 0;
  return (cam: Vector3) => {
    const now = performance.now(); if (now < t) return; t = now + 250;
    list.forEach((g, i) => {
      // the nearest of a few of its pieces (it is long, and it moves)
      let d = Infinity; for (const k of [0, g.length >> 1, g.length - 1]) { const p = g[k].getBoundingInfo().boundingSphere.centerWorld; d = Math.min(d, Vector3.Distance(cam, p)); }
      const want = d < near; if (want === shown[i]) return; shown[i] = want;
      for (const m of g) m.isVisible = want;
    });
  };
}

/** Tiny things far away (under about a metre across, further than `far` metres: a pixel or two on screen) are left out.
 *  Lights and anything that glows always stay, so lamps still twinkle in the distance. Phone and PC alike. */
export function tinyFar(sc: Scene, far = 180, size = 1.0): number {
  let n = 0;
  for (const m of sc.meshes as any[]) {
    if (m.isAnInstance || m.hasInstances || m.hasThinInstances || !m.isVisible || !m.material || typeof m.addLODLevel !== 'function' || m.getTotalVertices() <= 0) continue;
    const mt: any = m.material, e = mt.emissiveColor; if (mt.emissiveTexture || (e && e.r + e.g + e.b > 0.02) || /LIGHT|LAMP|GLOW|BEACON|STROBE|NAV|sky|look-/i.test(m.name + ' ' + mt.name)) continue;
    let d = 99; try { const bb = m.getBoundingInfo().boundingBox; d = bb.maximumWorld.subtract(bb.minimumWorld).length(); } catch (err) { continue; }
    if (d >= size) continue;
    try { m.addLODLevel(far, null); n++; } catch (err) { /* always drawn */ }
  }
  return n;
}
