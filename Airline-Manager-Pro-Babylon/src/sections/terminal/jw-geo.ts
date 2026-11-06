// A small geometry builder for the jetways: boxes, beams, cylinders and tubes written straight into one buffer per
// material, then made into one mesh per material under a node (few draw calls). The texture co-ordinates are laid
// flat on each face in metres, so a texture of one metre repeats at its true size on every part. A deform can bend
// the vertices before the mesh is made (the static corridor's slope and its ends cut to the rotunda's wall).
import { Mesh, VertexData, Matrix, Vector3, Quaternion, TransformNode, Scene } from '@babylonjs/core';

type Buf = { p: number[]; n: number[]; i: number[]; u: number[] };
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

export class Geo {
  private bufs = new Map<any, Buf>();
  private buf(mat: any) { let b = this.bufs.get(mat); if (!b) { b = { p: [], n: [], i: [], u: [] }; this.bufs.set(mat, b); } return b; }
  /** A flat face of four points (any order round it) facing n. */
  quad(mat: any, a: Vector3, b: Vector3, c: Vector3, d: Vector3, n: Vector3, uv?: number[]) {
    const B = this.buf(mat), v0 = B.p.length / 3; for (const q of [a, b, c, d]) { B.p.push(q.x, q.y, q.z); B.n.push(n.x, n.y, n.z); }
    for (let k = 0; k < 8; k++) B.u.push(uv ? uv[k] : NaN);   // its own co-ordinates (a, b, c, d), or laid flat in metres
    // front faces as Babylon reads them: (p1 - p2) × (p3 - p2) along the normal
    const f = a.subtract(b).cross(c.subtract(b)); if (Vector3.Dot(f, n) >= 0) B.i.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3); else B.i.push(v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2);
  }
  /** A box: centre, size, an optional turn (yaw, pitch, roll) or a full matrix; split into nx strips across x (so it can bend). */
  box(mat: any, x: number, y: number, z: number, w: number, h: number, d: number, rot?: Vector3 | Matrix, nx = 1, faces = 63) {
    const M = rot instanceof Matrix ? rot : Matrix.Compose(V(1, 1, 1), rot ? Quaternion.RotationYawPitchRoll(rot.x, rot.y, rot.z) : Quaternion.Identity(), V(x, y, z));
    const P = (i: number, j: number, k: number) => Vector3.TransformCoordinates(V(i * w / 2, j * h / 2, k * d / 2), M), N = (v: Vector3) => Vector3.TransformNormal(v, M).normalize();
    for (let s = 0; s < nx; s++) { const a = -1 + 2 * s / nx, b = -1 + 2 * (s + 1) / nx;
      if (faces & 1) this.quad(mat, P(a, 1, -1), P(b, 1, -1), P(b, 1, 1), P(a, 1, 1), N(V(0, 1, 0)));
      if (faces & 2) this.quad(mat, P(a, -1, -1), P(b, -1, -1), P(b, -1, 1), P(a, -1, 1), N(V(0, -1, 0)));
      if (faces & 4) this.quad(mat, P(a, -1, 1), P(b, -1, 1), P(b, 1, 1), P(a, 1, 1), N(V(0, 0, 1)));
      if (faces & 8) this.quad(mat, P(a, -1, -1), P(b, -1, -1), P(b, 1, -1), P(a, 1, -1), N(V(0, 0, -1))); }
    if (faces & 16) this.quad(mat, P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1), N(V(1, 0, 0)));
    if (faces & 32) this.quad(mat, P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1), N(V(-1, 0, 0)));
  }
  /** A beam of w × h from p to q. */
  beam(mat: any, p: Vector3, q: Vector3, w: number, h: number) { const d = q.subtract(p), L = d.length(); if (L < 1e-3) return; const m = p.add(q).scale(0.5);
    this.box(mat, 0, 0, 0, w, h, L, Matrix.Compose(V(1, 1, 1), Quaternion.RotationYawPitchRoll(Math.atan2(d.x, d.z), -Math.atan2(d.y, Math.hypot(d.x, d.z)), 0), m)); }
  /** A round rod (radius r) from p to q, capped. */
  rod(mat: any, p: Vector3, q: Vector3, r: number, seg = 10) { this.lathe(mat, p, q, [[0, 0], [r, 0], [r, 1], [0, 1]], seg); }
  /** A turned shape along p -> q: its profile [radius, t] (t 0 at p, 1 at q), seg sides; the profile's own normals. */
  lathe(mat: any, p: Vector3, q: Vector3, prof: number[][], seg = 16, uvf?: (around: number, k: number) => [number, number]) {
    const ax = q.subtract(p), L = ax.length(), u = ax.scale(1 / L), t0 = Math.abs(u.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0), e1 = Vector3.Cross(u, t0).normalize(), e2 = Vector3.Cross(e1, u);
    const at = (r: number, t: number, a: number) => p.add(u.scale(t * L)).add(e1.scale(Math.cos(a) * r)).add(e2.scale(Math.sin(a) * r));
    for (let k = 0; k < prof.length - 1; k++) { const [r0, s0] = prof[k], [r1, s1] = prof[k + 1]; if (r0 < 1e-5 && r1 < 1e-5) continue;
      const dr = r1 - r0, ds = (s1 - s0) * L, nl = Math.hypot(dr, ds) || 1;
      for (let i = 0; i < seg; i++) { const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
        const n = e1.scale(Math.cos(am) * ds / nl).add(e2.scale(Math.sin(am) * ds / nl)).add(u.scale(-dr / nl));
        const uv = uvf ? [...uvf(i / seg, k), ...uvf((i + 1) / seg, k), ...uvf((i + 1) / seg, k + 1), ...uvf(i / seg, k + 1)] : undefined;
        this.quad(mat, at(r0, s0, a0), at(r0, s0, a1), at(r1, s1, a1), at(r1, s1, a0), n.normalize(), uv); } }
  }
  /** A tube along a path (radius r). */
  tube(mat: any, path: Vector3[], r: number, seg = 10) { for (let i = 0; i < path.length - 1; i++) this.rod(mat, path[i], path[i + 1], r, seg); }
  /** The meshes, one per material, under par (named id + material); deform bends every vertex first (frame of par). */
  build(sc: Scene, par: TransformNode, id: string, meta: any, deform?: (v: Vector3) => Vector3, uv = 1): Mesh[] {
    const out: Mesh[] = [];
    for (const [mat, B] of this.bufs) { if (!B.i.length) continue;
      let pos = B.p, nor = B.n;
      if (deform) { pos = []; for (let i = 0; i < B.p.length; i += 3) { const v = deform(V(B.p[i], B.p[i + 1], B.p[i + 2])); pos.push(v.x, v.y, v.z); }
        // the normals again from the bent faces (each face keeps its own four)
        nor = []; for (let i = 0; i < pos.length; i += 12) { const a = V(pos[i], pos[i + 1], pos[i + 2]), b = V(pos[i + 3], pos[i + 4], pos[i + 5]), c = V(pos[i + 6], pos[i + 7], pos[i + 8]);
          let n = b.subtract(a).cross(c.subtract(a)).normalize(); const o = V(B.n[i], B.n[i + 1], B.n[i + 2]); if (Vector3.Dot(n, o) < 0) n = n.scale(-1); if (!isFinite(n.x)) n = o; for (let k = 0; k < 4; k++) nor.push(n.x, n.y, n.z); } }
      // flat co-ordinates in metres on each face (along its two widest directions)
      const uvs: number[] = []; for (let i = 0; i < pos.length; i += 3) { const nx = Math.abs(nor[i]), ny = Math.abs(nor[i + 1]), nz = Math.abs(nor[i + 2]), x = pos[i], y = pos[i + 1], z = pos[i + 2];
        const j = i / 3 * 2; if (!isNaN(B.u[j])) { uvs.push(B.u[j], B.u[j + 1]); continue; }
        if (ny >= nx && ny >= nz) uvs.push(x * uv, z * uv); else if (nx >= nz) uvs.push(z * uv, y * uv); else uvs.push(x * uv, y * uv); }
      const m = new Mesh(`${id}:${mat && mat.name}`, sc); m.parent = par; const vd = new VertexData(); vd.positions = pos; vd.normals = nor; vd.uvs = uvs; vd.indices = B.i; vd.applyToMesh(m, false);
      m.material = mat; m.receiveShadows = true; m.isPickable = true; m.metadata = meta ? { id: meta.id, kind: meta.kind, room: meta.room } : null; out.push(m); }
    this.bufs.clear(); return out;
  }
}
