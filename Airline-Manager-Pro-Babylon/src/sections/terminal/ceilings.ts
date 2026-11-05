// The walkway's ceiling (F2-WALK): everything above the tops of its side walls, built as one design that can be
// swapped for another. Each design builds under its own node, F2-WALK/CEILING, and nothing else in the terminal
// depends on it: change WALK_CEILING (or call setWalkCeiling while the terminal is open) to put a different one in.
//
// Barrel vault (variation 2): flat white ceilings over the lanes on each side, sitting right on top of the side walls,
// and between them, over the moving walkways, a glass barrel vault 10 m wide on white steel ribs every 3 m with five
// purlins, its highest point 9.65 m above the walkway's floor. The glass is its own material, M.glassVault, with its
// settings in VAULT_GLASS, so its look can be changed in one place.
import { Mesh, MeshBuilder, Vector3, VertexData, TransformNode, PBRMaterial, Color3 } from '@babylonjs/core';
import { Kit } from './kit';
import { ROOMS, Room, F2Y, ROOF } from './plan';

export interface CeilingDesign { id: string; name: string; build: (K: Kit, r: Room, g: TransformNode) => void }

/** The design the walkway has. */
export const WALK_CEILING = 'barrel-vault';

/** The vault's glass: tint, how see-through, how rough, index of refraction, how strongly it reflects. */
export const VAULT_GLASS = { tint: '#E6F1F7', alpha: 0.14, rough: 0.02, ior: 1.52, reflect: 1.0 };

/** The vault's size. */
export const VAULT = { width: 10, top: 9.65, ribEvery: 3, purlins: 5, sill: 0.15, slabTop: 0.02 };

const wallTop = (r: Room) => F2Y + (r.h != null ? r.h : 5.4);

export function vaultGlass(K: Kit): PBRMaterial {
  const g = VAULT_GLASS, m = K.pbr({ key: 'glassVault', col: g.tint, rough: g.rough, alpha: g.alpha, metal: 0 });
  m.indexOfRefraction = g.ior; m.environmentIntensity = g.reflect; m.useRadianceOverAlpha = true; m.useSpecularOverAlpha = true;
  m.separateCullingPass = true; m.backFaceCulling = false; K.M.glassVault = m; return m;
}

/** A white slab over part of the walkway, from the tops of the walls to just over the roof line. */
function slab(K: Kit, g: TransformNode, id: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) {
  const m = MeshBuilder.CreateBox(id, { width: x1 - x0, height: y1 - y0, depth: z1 - z0 }, K.sc); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.material = K.M.white; m.parent = g; m.receiveShadows = true; m.isPickable = false; m.metadata = { id, kind: 'ceiling', room: 'F2-WALK' }; return m;
}
/** Panel lights in a flat ceiling, each its own object, their tops against the ceiling. */
function downlights(K: Kit, r: Room, zs: number[], y: number) {
  for (let x = r.x0 + 2.1; x < r.x1 - 1; x += 4.2) for (const z of zs) { const o = K.obj(r.id, 'CEILING-LIGHT', x, y - 0.021, z); K.box(o, 2.4, 0.04, 0.3, K.M.light, 0, 0, 0); }
}

const barrelVault: CeilingDesign = {
  id: 'barrel-vault', name: 'Glass barrel vault',
  build(K, r, g) {
    const { sc, M } = K, yW = wallTop(r), yS = ROOF + VAULT.slabTop, zc = (r.z0 + r.z1) / 2, hw = VAULT.width / 2, e = 0.1;
    const ySp = yS + VAULT.sill, rise = F2Y + VAULT.top - ySp, glass = vaultGlass(K);
    // the flat ceilings either side: solid slabs whose undersides sit right on the side walls (over their whole thickness)
    const parts = [slab(K, g, 'F2-WALK/CEILING/FLAT-S', r.x0 - e, r.x1 + e, r.z0 - e, zc - hw, yW, yS), slab(K, g, 'F2-WALK/CEILING/FLAT-N', r.x0 - e, r.x1 + e, zc + hw, r.z1 + e, yW, yS)];
    // over each end wall, between the slabs, a white beam so the vault's ends close down onto the walls
    for (const [k, x] of [['W', r.x0], ['E', r.x1]] as [string, number][]) parts.push(slab(K, g, `F2-WALK/CEILING/END-${k}`, x - e, x + e, zc - hw, zc + hw, yW, ySp));
    const flat = Mesh.MergeMeshes(parts, true, true) as Mesh; flat.name = 'F2-WALK/CEILING/FLAT'; flat.parent = g; flat.receiveShadows = true; flat.isPickable = false; flat.metadata = { id: 'F2-WALK/CEILING/FLAT', kind: 'ceiling', room: r.id };
    // the sills the vault stands on, along both edges of the opening
    const sills: Mesh[] = []; for (const s of [-1, 1]) sills.push(slab(K, g, 'sill', r.x0 - e, r.x1 + e, zc + s * hw - 0.15, zc + s * hw + 0.15, yS, ySp));
    const sill = Mesh.MergeMeshes(sills, true, true) as Mesh; sill.name = 'F2-WALK/CEILING/SILLS'; sill.material = M.whiteGloss; sill.parent = g; sill.isPickable = false; sill.metadata = { id: 'F2-WALK/CEILING/SILLS', kind: 'ceiling', room: r.id };
    // the arch: half an ellipse from sill to sill
    const N = 36, at = (t: number, inset = 0) => ({ z: zc + (hw - inset) * Math.cos(t), y: ySp + (rise - inset) * Math.sin(t) });
    // the glass, in sections along the walkway so each sorts on its own
    const L = r.x1 - r.x0, nSec = Math.max(1, Math.round(L / 46));
    for (let k = 0; k < nSec; k++) { const xa = r.x0 + L * k / nSec, xb = r.x0 + L * (k + 1) / nSec, pa: Vector3[] = [], pb: Vector3[] = [];
      for (let i = 0; i <= N; i++) { const p = at(Math.PI * i / N); pa.push(new Vector3(xa, p.y, p.z)); pb.push(new Vector3(xb, p.y, p.z)); }
      const m = MeshBuilder.CreateRibbon(`F2-WALK/CEILING/GLASS-${k + 1}`, { pathArray: [pa, pb], sideOrientation: Mesh.DOUBLESIDE }, sc);
      m.material = glass; m.parent = g; m.isPickable = false; m.alphaIndex = 20; m.metadata = { id: m.name, kind: 'glass', room: r.id }; }
    // the glass gables closing each end of the vault
    for (const [k, x] of [['W', r.x0 + 0.02], ['E', r.x1 - 0.02]] as [string, number][]) {
      const pos: number[] = [x, ySp, zc], idx: number[] = []; for (let i = 0; i <= N; i++) { const p = at(Math.PI * i / N); pos.push(x, p.y, p.z); if (i) idx.push(0, i, i + 1); }
      const m = new Mesh(`F2-WALK/CEILING/GABLE-${k}`, sc), vd = new VertexData(), nr: number[] = []; vd.positions = pos; vd.indices = idx; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
      m.material = glass; m.parent = g; m.isPickable = false; m.alphaIndex = 20; m.metadata = { id: m.name, kind: 'glass', room: r.id }; }
    // the white steel ribs every 3 m, under the glass, one shared shape
    const rp: Vector3[] = []; for (let i = 0; i <= N; i++) { const p = at(Math.PI * i / N, 0.1); rp.push(new Vector3(0, p.y, p.z)); }
    const rib = MeshBuilder.CreateTube('F2-WALK/CEILING/RIB', { path: rp, radius: 0.08, tessellation: 8 }, sc); rib.material = M.whiteGloss; rib.parent = g; rib.isPickable = false;
    const ribs = new TransformNode('F2-WALK/CEILING/RIBS', sc); ribs.parent = g; ribs.metadata = { id: 'F2-WALK/CEILING/RIBS', kind: 'ceiling', room: r.id };
    let n = 0; for (let x = r.x0 + VAULT.ribEvery / 2; x < r.x1; x += VAULT.ribEvery) { const i = n++ ? rib.createInstance(`F2-WALK/CEILING/RIB-${String(n).padStart(3, '0')}`) : rib; i.parent = ribs; i.position.x = x; i.isPickable = false; }
    // the five purlins along it
    const purl = new TransformNode('F2-WALK/CEILING/PURLINS', sc); purl.parent = g; purl.metadata = { id: 'F2-WALK/CEILING/PURLINS', kind: 'ceiling', room: r.id };
    for (let j = 1; j <= VAULT.purlins; j++) { const p = at(Math.PI * j / (VAULT.purlins + 1), 0.1), c = MeshBuilder.CreateCylinder(`F2-WALK/CEILING/PURLIN-${j}`, { diameter: 0.1, height: L, tessellation: 8 }, sc);
      c.rotation.z = Math.PI / 2; c.position.set((r.x0 + r.x1) / 2, p.y, p.z); c.material = M.whiteGloss; c.parent = purl; c.isPickable = false; }
    // downlights in the flat ceilings, over the lanes
    downlights(K, r, [(r.z0 + zc - hw) / 2, (zc + hw + r.z1) / 2], yW);
    void Color3;
  },
};

const flatCeiling: CeilingDesign = {
  id: 'flat', name: 'Flat ceiling',
  build(K, r, g) { slab(K, g, 'F2-WALK/CEILING/FLAT', r.x0 - 0.1, r.x1 + 0.1, r.z0 - 0.1, r.z1 + 0.1, wallTop(r), ROOF + VAULT.slabTop); const zc = (r.z0 + r.z1) / 2; downlights(K, r, [zc - 6, zc - 2, zc + 2, zc + 6], wallTop(r)); },
};

/** Every design the walkway can have, by id. Add a new one here. */
export const WALK_CEILINGS: { [id: string]: CeilingDesign } = { [barrelVault.id]: barrelVault, [flatCeiling.id]: flatCeiling };

/** Build the walkway's ceiling (the design named, or WALK_CEILING). */
export function buildWalkCeiling(K: Kit, id = WALK_CEILING) {
  const r = ROOMS.find(q => q.kind === 'walk'); if (!r) return null;
  const g = K.obj(r.id, 'CEILING', 0, 0, 0, 0, 'F2-WALK/CEILING'); g.metadata.design = id;
  (WALK_CEILINGS[id] || barrelVault).build(K, r, g); return g;
}

/** Take the walkway's ceiling down and put up another design. */
export function setWalkCeiling(K: Kit, id: string) {
  const old = K.objects.get('F2-WALK/CEILING'); if (old) { old.node.dispose(false, false); K.objects.delete('F2-WALK/CEILING'); }
  for (const [k, o] of K.objects) if (o.room === 'F2-WALK' && o.kind === 'CEILING-LIGHT') { o.node.dispose(); K.objects.delete(k); }
  return buildWalkCeiling(K, id);
}
