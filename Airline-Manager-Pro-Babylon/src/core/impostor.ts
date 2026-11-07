// Far-object impostors: each fixed object made of several parts (a row of seats, a car, a tree, a plant, a cart, a
// parked aircraft, ...) gets a stand-in: one simple box carrying pictures of the object taken from its four sides and
// from above. Beyond a set distance the stand-in is drawn (one draw call) instead of all the object's parts; closer in,
// the real object comes back. The pictures are taken once after loading, a few objects per frame, packed into a few
// shared pictures (atlases), and taken again when the light has changed a lot (the sun moving, the weather).
// Never stand-ins: anything that moves or opens (doors, lifts, jetways, vehicles on the move), lights and screens.
import { Scene, Mesh, AbstractMesh, TransformNode, Vector3, Matrix, Color3, Color4, Camera, FreeCamera, RenderTargetTexture, DynamicTexture, StandardMaterial,
  VertexData, Constants, Texture } from '@babylonjs/core';

type Group = { node: TransformNode; meshes: AbstractMesh[]; vis: boolean[]; c: Vector3; r: number; box: Mesh | null; far: boolean;
  lmin: Vector3; lmax: Vector3; tile: number; atlas: number; tx: number; ty: number };
const NEVER = /jetway|door|lift|stair|LAMP|LIGHT|SCREEN|MONITOR|BANNER|DISPLAY|SIGN|CEILING|WAINSCOT|PIPES|CLADDING|building|PARKING|WALKWAY|ESCALATOR|SHUTTLE|room|floor|group|airport|airfield|terminal/i;
const AT = 2048;

/** Sets up the stand-ins for the objects in `objects` (nodes with metadata.kind). Returns a stop function. */
export function impostors(sc: Scene, objects: TransformNode[], cam: Camera, dist: number, sunDir: () => Vector3): () => void {
  const groups: Group[] = [];
  for (const node of objects) {
    const md: any = node.metadata; if (!md || !md.kind || NEVER.test(md.kind)) continue;
    const meshes = node.getChildMeshes(false).filter(m => m.isEnabled() && m.isVisible && m.getTotalVertices() > 0 && !/COLLIDE/.test(m.name));
    if (meshes.length < 3 || meshes.some(m => !m.isWorldMatrixFrozen || m.skeleton || (m.material && (m.material as any).alpha < 0.98 && /glass/i.test(m.material.name)))) continue;
    // the object's box in its own frame
    const inv = Matrix.Invert(node.computeWorldMatrix(true)), lmin = new Vector3(Infinity, Infinity, Infinity), lmax = lmin.scale(-1);
    for (const m of meshes) for (const v of m.getBoundingInfo().boundingBox.vectorsWorld) { const l = Vector3.TransformCoordinates(v, inv); lmin.minimizeInPlace(l); lmax.maximizeInPlace(l); }
    const size = lmax.subtract(lmin), big = Math.max(size.x, size.y, size.z); if (!(big > 0.4 && big < 70)) continue;
    const c = Vector3.TransformCoordinates(lmin.add(lmax).scale(0.5), node.getWorldMatrix());
    const tile = Math.max(32, Math.min(128, 1 << Math.round(Math.log2(big * 4))));   // about 4 pixels a metre: plenty from 150 m away
    groups.push({ node, meshes, vis: meshes.map(m => m.isVisible), c, r: big / 2, box: null, far: false, lmin, lmax, tile, atlas: 0, tx: 0, ty: 0 });
  }
  // an object inside another object: only the outer one gets a stand-in
  const inSet = new Set(groups.map(g => g.node)); for (let i = groups.length - 1; i >= 0; i--) { for (let q = groups[i].node.parent; q; q = q.parent) if (inSet.has(q as TransformNode)) { groups.splice(i, 1); break; } }
  if (!groups.length) return () => { /* nothing to stand in for */ };
  // pack the tiles (each object: 5 tiles in a row) onto atlases, biggest first, in shelves
  groups.sort((a, b) => b.tile - a.tile); let ai = 0, x = 0, y = 0, shelf = 0;
  for (const g of groups) { const w = g.tile * 5; if (x + w > AT) { x = 0; y += shelf; shelf = 0; } if (y + g.tile > AT) { ai++; x = 0; y = 0; shelf = 0; } g.atlas = ai; g.tx = x; g.ty = y; x += w; shelf = Math.max(shelf, g.tile); }
  const canv: HTMLCanvasElement[] = [], tex: DynamicTexture[] = [], mats: StandardMaterial[] = [];
  // each atlas only as tall as it needs to be (a power of two)
  const H: number[] = []; for (const g of groups) H[g.atlas] = Math.max(H[g.atlas] || 0, g.ty + g.tile); for (let i = 0; i <= ai; i++) H[i] = 1 << Math.ceil(Math.log2(Math.max(32, H[i] || 32)));
  for (const g of groups) (g as any).AH = H[g.atlas];
  for (let i = 0; i <= ai; i++) { const t = new DynamicTexture('impostor-atlas-' + i, { width: AT, height: H[i] }, sc, true, Texture.TRILINEAR_SAMPLINGMODE); t.hasAlpha = true;
    canv.push(t.getContext().canvas as HTMLCanvasElement); tex.push(t);
    const m = new StandardMaterial('impostor-' + i, sc); m.diffuseTexture = t; m.emissiveTexture = t; m.diffuseColor = Color3.Black(); m.specularColor = Color3.Black(); m.disableLighting = true;
    m.transparencyMode = 1; (m as any).alphaCutOff = 0.45; m.backFaceCulling = true; mats.push(m); }
  // the faces: +x, -x, +z, -z (sides) and +y (top); each with the camera's right and up on the picture
  const FACES: [Vector3, Vector3][] = [[new Vector3(1, 0, 0), new Vector3(0, 1, 0)], [new Vector3(-1, 0, 0), new Vector3(0, 1, 0)], [new Vector3(0, 0, 1), new Vector3(0, 1, 0)], [new Vector3(0, 0, -1), new Vector3(0, 1, 0)], [new Vector3(0, 1, 0), new Vector3(0, 0, 1)]];
  const shot = new FreeCamera('impostor-cam', Vector3.Zero(), sc); shot.mode = Camera.ORTHOGRAPHIC_CAMERA; shot.minZ = 0.05; shot.maxZ = 400;
  let rtts: { [n: number]: RenderTargetTexture } = {};
  const rttFor = (n: number) => { if (!rtts[n]) { const r = new RenderTargetTexture('impostor-rt-' + n, n, sc, false, true, Constants.TEXTURETYPE_UNSIGNED_BYTE); r.clearColor = new Color4(0, 0, 0, 0); r.activeCamera = shot; r.refreshRate = 0; rtts[n] = r; } return rtts[n]; };

  /** Takes the five pictures of one object into its atlas (canvas), and builds or rebuilds its box. */
  const bake = async (g: Group) => {
    const W = g.node.getWorldMatrix(), size = g.lmax.subtract(g.lmin), half = size.scale(0.5), ctr = g.lmin.add(half), rt = rttFor(g.tile);
    const ctx = canv[g.atlas].getContext('2d')!, img = ctx.createImageData(g.tile, g.tile);
    const pos: number[] = [], uv: number[] = [], ind: number[] = [];
    for (let f = 0; f < 5; f++) { const [d, up] = FACES[f]; const right = Vector3.Cross(up, d).normalize();   // seen from outside along -d
      const hw = Math.abs(Vector3.Dot(half, right)) + 0.02, hh = Math.abs(Vector3.Dot(half, up)) + 0.02, depth = Math.abs(Vector3.Dot(half, d));
      const wc = Vector3.TransformCoordinates(ctr, W), wd = Vector3.TransformNormal(d, W).normalize(), wu = Vector3.TransformNormal(up, W).normalize();
      shot.position.copyFrom(wc.add(wd.scale(depth + 5))); shot.upVector.copyFrom(wu); shot.setTarget(wc);
      // the picture's right, as the camera sees it (left- or right-handed alike): flip the face's right if needed
      shot.orthoLeft = -hw; shot.orthoRight = hw; shot.orthoTop = hh; shot.orthoBottom = -hh;
      const vp = shot.getViewMatrix(true).multiply(shot.getProjectionMatrix(true)); const sx = Vector3.TransformCoordinates(wc.add(Vector3.TransformNormal(right, W)), vp).x;
      const r2 = sx >= 0 ? right : right.scale(-1);
      rt.renderList = g.meshes; for (let i = 0; i < g.meshes.length; i++) g.meshes[i].isVisible = true;
      rt.render(false); for (let i = 0; i < g.meshes.length; i++) g.meshes[i].isVisible = g.far ? false : g.vis[i]; const px = await rt.readPixels();
      if (px) { const src = px as Uint8Array, n = g.tile; for (let row = 0; row < n; row++) img.data.set(src.subarray((n - 1 - row) * n * 4, (n - row) * n * 4), row * n * 4); ctx.putImageData(img, g.tx + f * g.tile, g.ty); }
      // the face's quad, on the box's side: corners (a, b) = (-1|1, -1|1) along (r2, up)
      const base = pos.length / 3, u0 = (g.tx + f * g.tile + 0.5) / AT, u1 = (g.tx + (f + 1) * g.tile - 0.5) / AT, vTop = 1 - (g.ty + 0.5) / (g as any).AH, vBot = 1 - (g.ty + g.tile - 0.5) / (g as any).AH;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = ctr.add(d.scale(depth)).add(r2.scale(a * hw)).add(up.scale(b * hh)); pos.push(p.x, p.y, p.z); uv.push(a < 0 ? u0 : u1, b < 0 ? vBot : vTop); }
      // wound to face outwards (towards +d)
      const n0 = Vector3.Cross(r2, up); if (Vector3.Dot(n0, d) > 0) ind.push(base, base + 2, base + 1, base, base + 3, base + 2); else ind.push(base, base + 1, base + 2, base, base + 2, base + 3); }
    if (!g.box) { g.box = new Mesh('IMPOSTOR/' + g.node.name, sc); g.box.parent = g.node; g.box.isPickable = false; g.box.material = mats[g.atlas]; g.box.setEnabled(false); g.box.alwaysSelectAsActiveMesh = false; }
    const vd = new VertexData(); vd.positions = pos; vd.uvs = uv; vd.indices = ind; vd.applyToMesh(g.box, false); g.box.computeWorldMatrix(true); g.box.freezeWorldMatrix();
  };

  let stopped = false, baked = false, lastSun = sunDir().clone(), lastBake = performance.now();
  const bakeAll = async () => {
    for (let i = 0; i < groups.length && !stopped; i++) { try { await bake(groups[i]); } catch (e) { groups[i].box = null; } if (i % 4 === 3) await new Promise(r => setTimeout(r, 16)); }
    if (stopped) return; for (const t of tex) t.update(true); baked = true; lastSun = sunDir().clone(); lastBake = performance.now();
  };
  setTimeout(() => { bakeAll().catch(() => { /* drawn in full */ }); }, 1500);
  // near or far, four times a second; the pictures again when the sun has moved more than 6° (at most every 2 minutes)
  const timer = setInterval(() => {
    if (!baked || stopped) return; const p = cam.globalPosition;
    for (const g of groups) { if (!g.box) continue; const d = Vector3.Distance(p, g.c) - g.r, far = g.far ? d > dist - 10 : d > dist;
      if (far === g.far) continue; g.far = far; g.box.setEnabled(far); for (let i = 0; i < g.meshes.length; i++) g.meshes[i].isVisible = far ? false : g.vis[i]; }
    if (performance.now() - lastBake > 120000 && Vector3.Dot(sunDir(), lastSun) < Math.cos(6 * Math.PI / 180)) { baked = false; bakeAll(); }
  }, 250);
  return () => { stopped = true; clearInterval(timer); for (const g of groups) { for (let i = 0; i < g.meshes.length; i++) if (!g.meshes[i].isDisposed()) g.meshes[i].isVisible = g.vis[i]; g.box && g.box.dispose(); }
    for (const k in rtts) rtts[k].dispose(); rtts = {}; for (const t of tex) t.dispose(); for (const m of mats) m.dispose(); shot.dispose(); };
}
