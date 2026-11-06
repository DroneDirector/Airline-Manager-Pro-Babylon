// Your pet in your office: a dog or a cat, chosen and made your own in the game (Your pilot → Pet), in its bed on the
// floor by the bookshelf, with its two bowls. Our own model, as on the main game: the body is sculpted as one smooth
// animal (shapes melted together in a distance field, meshed with surface nets) and covered in thousands of strands
// of fur. It sleeps curled up for a good while, breathing slowly, an ear twitching now and then, a tail tip flicking
// (a cat) or paws twitching in a dream (a dog); now and then it wakes, gets up, wanders about the room on its four
// legs, has a drink or a bite, comes back, turns round in its bed and lies down to sleep again. Tap it and it wakes for
// a moment and looks at you; tap a bowl and it is filled up.
// Office coordinates (x east, y up, z north, metres). The pet faces +x in its own frame.
import { Scene, Vector3, Color3, Color4, MeshBuilder, Mesh, StandardMaterial, PBRMaterial, DynamicTexture, TransformNode, ShaderMaterial, Effect, VertexData, AbstractMesh, Matrix, Quaternion, Vector4, Camera } from '@babylonjs/core';

export type PetKind = 'dog' | 'cat' | 'none';
export interface PetData { kind: PetKind; name: string; coat: number; white: boolean; size: 's' | 'm' | 'l'; ears: 'floppy' | 'pointy'; bed: number; coatHex?: string; lightHex?: string; food?: number; water?: number }
export const PET_COATS: { [k: string]: [string, string][] } = {
  dog: [['#C8913E', 'Golden'], ['#2A2420', 'Black'], ['#6B4226', 'Brown'], ['#E6D3AE', 'Cream'], ['#F2EFE8', 'White'], ['#8A8783', 'Grey'], ['#A0522D', 'Red'], ['#4A3B30', 'Dark brown']],
  cat: [['#E08A3C', 'Ginger'], ['#2A2624', 'Black'], ['#9A9590', 'Grey'], ['#F1EEE8', 'White'], ['#7A6450', 'Tabby'], ['#D9C3A0', 'Cream'], ['#5E6670', 'Blue-grey'], ['#B07A4A', 'Cinnamon']],
};
export const PET_BEDS: [string, string][] = [['#7A2E2E', 'Red'], ['#2E4A7A', 'Blue'], ['#5A6B3A', 'Green'], ['#8C8FA0', 'Grey'], ['#C9A46A', 'Sand'], ['#5B3A6B', 'Plum']];
const coatHex = (P: PetData) => P.coatHex || (PET_COATS[P.kind === 'cat' ? 'cat' : 'dog'][P.coat] || PET_COATS.dog[0])[0];
const lightHex = (P: PetData) => P.white ? (P.lightHex || '#F3EFE6') : null;
const petScale = (P: PetData) => P.kind === 'cat' ? 0.95 : P.size === 's' ? 0.72 : P.size === 'l' ? 1.25 : 1;
const sm = (x: number) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
const to = (cur: number, want: number, rate: number, dt: number) => cur + (want - cur) * Math.min(1, dt * rate);

/* ---------- the shapes of the body ---------- */
type Prim = { k: 'e' | 'c'; a: number[]; b?: number[]; r: number[]; part?: string; light?: number; dark?: number; paint?: boolean };
type Shapes = { prims: Prim[]; tail: number[][]; tailR: number[]; neck: number[]; earL: number[]; earR: number[]; nose: number[]; noseR: number; eyes: { at: number[]; len: number }[]; legs?: number[][]; fwd?: number[]; skull: number[] };
function tailCurve(pts: number[][], n: number): number[][] {
  const P = [pts[0].map((v, i) => 2 * v - pts[1][i])].concat(pts, [pts[pts.length - 1].map((v, i) => 2 * v - pts[pts.length - 2][i])]), out: number[][] = [], segs = pts.length - 1;
  for (let k = 0; k <= n; k++) {
    const u = k / n * segs, i = Math.min(segs - 1, Math.floor(u)), t = u - i, p0 = P[i], p1 = P[i + 1], p2 = P[i + 2], p3 = P[i + 3], t2 = t * t, t3 = t2 * t;
    out.push([0, 1, 2].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
  }
  return out;
}
/** Standing on four legs, facing +x: the body, chest ruff, neck, head, muzzle, ears, legs with paws and the tail. */
function stand(P: PetData, s: number): Shapes {
  const S = (v: number[]) => v.map(x => x * s);
  if (P.kind !== 'cat') {
    const prims: Prim[] = [
      { k: 'e', a: S([0.1, 0.2, 0]), r: S([0.16, 0.115, 0.115]), dark: 0.4 },
      { k: 'e', a: S([-0.12, 0.2, 0]), r: S([0.17, 0.11, 0.115]), dark: 0.5 },
      { k: 'e', a: S([0.17, 0.2, 0]), r: S([0.085, 0.11, 0.095]), light: 1 },
      { k: 'c', a: S([0.15, 0.25, 0]), b: S([0.24, 0.31, 0]), r: S([0.072, 0.062]), part: 'h' },
      { k: 'e', a: S([0.28, 0.33, 0]), r: S([0.085, 0.076, 0.078]), part: 'h' },
      { k: 'c', a: S([0.33, 0.315, 0]), b: S([0.4, 0.3, 0]), r: S([0.042, 0.03]), part: 'h', light: 1 },
      { k: 'e', a: S([0.36, 0.285, 0]), r: S([0.038, 0.016, 0.03]), part: 'h', light: 1 },
      { k: 'c', a: S([0.29, 0.38, 0]), b: S([0.37, 0.31, 0]), r: S([0.016, 0.022]), light: 1, paint: true },
    ];
    const legs = [S([0.13, 0.16, 0.06]), S([0.13, 0.16, -0.06]), S([-0.17, 0.16, 0.06]), S([-0.17, 0.16, -0.06])];
    legs.forEach((L, i) => { prims.push({ k: 'c', a: L, b: [L[0] + 0.01 * s, 0.035 * s, L[2]], r: S([i < 2 ? 0.036 : 0.042, 0.03]), part: 'l' + i }, { k: 'e', a: [L[0] + 0.02 * s, 0.022 * s, L[2]], r: S([0.04, 0.022, 0.032]), light: 1, part: 'l' + i }); });
    const pointy = P.ears === 'pointy', eL = S([0.27, 0.38, 0.045]), eR = S([0.27, 0.38, -0.045]);
    if (pointy) prims.push({ k: 'c', a: eL, b: S([0.25, 0.49, 0.08]), r: S([0.042, 0.006]), part: 'eL' }, { k: 'c', a: eR, b: S([0.25, 0.49, -0.08]), r: S([0.042, 0.006]), part: 'eR' });
    else prims.push({ k: 'e', a: S([0.27, 0.33, 0.085]), r: S([0.042, 0.06, 0.014]), part: 'eL', dark: 0.5 }, { k: 'e', a: S([0.27, 0.33, -0.085]), r: S([0.042, 0.06, 0.014]), part: 'eR', dark: 0.5 });
    const tail = [[-0.27, 0.24, 0], [-0.33, 0.29, 0], [-0.36, 0.34, 0], [-0.35, 0.39, 0]].map(S);
    return { prims, tail, tailR: S([0.042, 0.034]), neck: S([0.18, 0.27, 0]), earL: eL, earR: eR, nose: S([0.433, 0.306, 0]), noseR: 0.018 * s, legs, fwd: [1, 0, 0], skull: S([0.28, 0.33, 0]),
      eyes: [{ at: S([0.354, 0.35, 0.042]), len: 0.019 * s }, { at: S([0.354, 0.35, -0.042]), len: 0.019 * s }] };
  }
  const prims: Prim[] = [
    { k: 'e', a: S([-0.02, 0.17, 0]), r: S([0.16, 0.095, 0.095]), dark: 0.5 },
    { k: 'e', a: S([0.1, 0.165, 0]), r: S([0.08, 0.09, 0.085]), light: 1 },
    { k: 'c', a: S([0.11, 0.2, 0]), b: S([0.17, 0.25, 0]), r: S([0.058, 0.05]), part: 'h' },
    { k: 'e', a: S([0.2, 0.275, 0]), r: S([0.074, 0.068, 0.072]), part: 'h' },
    { k: 'e', a: S([0.255, 0.26, 0]), r: S([0.034, 0.027, 0.042]), part: 'h', light: 1 },
    { k: 'e', a: S([0.245, 0.245, 0]), r: S([0.028, 0.015, 0.03]), part: 'h', light: 1 },
  ];
  const legs = [S([0.09, 0.14, 0.045]), S([0.09, 0.14, -0.045]), S([-0.12, 0.14, 0.045]), S([-0.12, 0.14, -0.045])];
  legs.forEach((L, i) => { prims.push({ k: 'c', a: L, b: [L[0] + 0.008 * s, 0.025 * s, L[2]], r: S([i < 2 ? 0.027 : 0.032, 0.023]), part: 'l' + i }, { k: 'e', a: [L[0] + 0.014 * s, 0.017 * s, L[2]], r: S([0.028, 0.017, 0.024]), light: 1, part: 'l' + i }); });
  const eL = S([0.19, 0.32, 0.036]), eR = S([0.19, 0.32, -0.036]);
  prims.push({ k: 'c', a: eL, b: S([0.185, 0.385, 0.055]), r: S([0.03, 0.004]), part: 'eL' }, { k: 'c', a: eR, b: S([0.185, 0.385, -0.055]), r: S([0.03, 0.004]), part: 'eR' });
  const tail = [[-0.16, 0.19, 0], [-0.24, 0.22, 0], [-0.29, 0.3, 0], [-0.28, 0.38, 0]].map(S);
  return { prims, tail, tailR: S([0.028, 0.023]), neck: S([0.13, 0.22, 0]), earL: eL, earR: eR, nose: S([0.288, 0.268, 0]), noseR: 0.009 * s, legs, fwd: [1, 0, 0], skull: S([0.2, 0.275, 0]),
    eyes: [{ at: S([0.27, 0.293, 0.032]), len: 0.021 * s }, { at: S([0.27, 0.293, -0.032]), len: 0.021 * s }] };
}

/* ---------- the sculpted body and its fur ---------- */
interface Sculpt { body: VertexData & { pw: Float32Array; lw: Float32Array; tw: Float32Array }; fur: VertexData & { pw: Float32Array; lw: Float32Array; tw: Float32Array }; D: Shapes }
const cache: { [k: string]: Sculpt } = {};
function sculpt(P: PetData, s: number, fine: boolean): Sculpt {
  const key = JSON.stringify([P.kind, coatHex(P), lightHex(P), P.size, P.ears, s, fine]); if (cache[key]) return cache[key];
  const cat = P.kind === 'cat', D = stand(P, s), prims = D.prims.slice();
  const tc = tailCurve(D.tail, 14), nT = tc.length - 1;
  for (let i = 0; i < nT; i++) { const f0 = i / nT, f1 = (i + 1) / nT, rr = (f: number) => D.tailR[0] + (D.tailR[1] - D.tailR[0]) * f - D.tailR[1] * 0.35 * Math.max(0, f - 0.75) / 0.25; prims.push({ k: 'c', a: tc[i], b: tc[i + 1], r: [rr(f0), rr(f1)], part: 't' + Math.floor(i * (D.tail.length - 1) / nT) }); }
  const K = 0.03 * s;
  const ell = (p: number[], c: number[], r: number[]) => { const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2], k0 = Math.sqrt(x * x + y * y + z * z), k1 = Math.sqrt(x * x / (r[0] * r[0]) + y * y / (r[1] * r[1]) + z * z / (r[2] * r[2])); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(r[0], r[1], r[2]); };
  const cap = (p: number[], a: number[], b: number[], r: number[]) => { const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], pa = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], L2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2]; let h = (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / L2; h = h < 0 ? 0 : h > 1 ? 1 : h; const dx = pa[0] - ba[0] * h, dy = pa[1] - ba[1] * h, dz = pa[2] - ba[2] * h; return Math.sqrt(dx * dx + dy * dy + dz * dz) - (r[0] + (r[1] - r[0]) * h); };
  const prim = (q: Prim, p: number[]) => q.k === 'e' ? ell(p, q.a, q.r) : cap(p, q.a, q.b!, q.r);
  const smin = (a: number, b: number) => { const h = Math.max(K - Math.abs(a - b), 0) / K; return Math.min(a, b) - h * h * K * 0.25; };
  const solid = prims.filter(q => !q.paint), field = (p: number[]) => { let d = 1e9; for (const q of solid) d = smin(d, prim(q, p)); return d; };
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const q of solid) { const pts = q.k === 'e' ? [[q.a[0] - q.r[0], q.a[1] - q.r[1], q.a[2] - q.r[2]], [q.a[0] + q.r[0], q.a[1] + q.r[1], q.a[2] + q.r[2]]] : [q.a.map(v => v - q.r[0]), q.a.map(v => v + q.r[0]), q.b!.map(v => v - q.r[1]), q.b!.map(v => v + q.r[1])]; for (const p of pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } }
  const pad = 0.02 * s; lo = lo.map(v => v - pad); hi = hi.map(v => v + pad);
  const h = (fine ? 0.0072 : 0.0095) * s, nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const F = new Float32Array(nx * ny * nz), at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[at(i, j, k)] = field([lo[0] + i * h, lo[1] + j * h, lo[2] + k * h]);
  const vid = new Int32Array(nx * ny * nz).fill(-1), pos: number[] = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = [F[at(i, j, k)], F[at(i + 1, j, k)], F[at(i, j + 1, k)], F[at(i + 1, j + 1, k)], F[at(i, j, k + 1)], F[at(i + 1, j, k + 1)], F[at(i, j + 1, k + 1)], F[at(i + 1, j + 1, k + 1)]];
    let neg = 0; for (const v of c) if (v < 0) neg++; if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) { if ((c[a] < 0) === (c[b] < 0)) continue; const t = c[a] / (c[a] - c[b]); const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1, bx2 = b & 1, by = (b >> 1) & 1, bz = (b >> 2) & 1; sx += ax + (bx2 - ax) * t; sy += ay + (by - ay) * t; sz += az + (bz - az) * t; n++; }
    vid[at(i, j, k)] = pos.length / 3; pos.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h);
  }
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = F[at(i, j, k)] < 0;
    if (v0 !== (F[at(i + 1, j, k)] < 0)) quad(vid[at(i, j - 1, k - 1)], vid[at(i, j, k - 1)], vid[at(i, j, k)], vid[at(i, j - 1, k)], !v0);
    if (v0 !== (F[at(i, j + 1, k)] < 0)) quad(vid[at(i - 1, j, k - 1)], vid[at(i - 1, j, k)], vid[at(i, j, k)], vid[at(i, j, k - 1)], !v0);
    if (v0 !== (F[at(i, j, k + 1)] < 0)) quad(vid[at(i - 1, j - 1, k)], vid[at(i, j - 1, k)], vid[at(i, j, k)], vid[at(i - 1, j, k)], !v0);
  }
  const nV = pos.length / 3, nor = new Float32Array(nV * 3), col = new Float32Array(nV * 4), pw = new Float32Array(nV * 4), lw = new Float32Array(nV * 4), tw = new Float32Array(nV), len = new Float32Array(nV);
  const coat = Color3.FromHexString(coatHex(P)), lh = lightHex(P), light = lh ? Color3.FromHexString(lh) : Color3.Lerp(coat, Color3.White(), 0.12), dark = coat.scale(0.72), pink = Color3.FromHexString('#E7A3A0');
  const e = 0.0015 * s, nTail = D.tail.length - 1, fw = D.fwd || [1, 0, 0];
  for (let v = 0; v < nV; v++) {
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    const gx = field([p[0] + e, p[1], p[2]]) - field([p[0] - e, p[1], p[2]]), gy = field([p[0], p[1] + e, p[2]]) - field([p[0], p[1] - e, p[2]]), gz = field([p[0], p[1], p[2] + e]) - field([p[0], p[1], p[2] - e]), gl = Math.hypot(gx, gy, gz) || 1;
    const n = [gx / gl, gy / gl, gz / gl]; nor[v * 3] = n[0]; nor[v * 3 + 1] = n[1]; nor[v * 3 + 2] = n[2];
    let wh = 0, wl = 0, wr = 0, wp = 0, wt = 0, li = 0, dk = 0, tot = 0; const wleg = [0, 0, 0, 0];
    for (const q of prims) { const d = prim(q, p), w = Math.exp(-Math.max(0, d) / (0.012 * s)); if (!q.paint) tot += w;
      if (q.paint) { li += (q.light || 0) * Math.exp(-Math.max(0, d) / (0.006 * s)) * 3; continue; }
      if (q.part === 'h' || q.part === 'eL' || q.part === 'eR') wh += w; if (q.part === 'eL') wl += w; if (q.part === 'eR') wr += w; if (q.part === 'p') wp += w;
      if (q.part && q.part[0] === 't') wt += w * (0.3 + 0.7 * (+q.part.slice(1) + 1) / nTail);
      if (q.part && q.part[0] === 'l') wleg[+q.part[1]] += w * Math.min(1, Math.max(0, (D.legs ? D.legs[+q.part[1]][1] - p[1] : 0) / (0.06 * s) + 0.35));
      li += w * (q.light || 0); dk += w * (q.dark || 0); }
    tot = tot || 1; pw[v * 4] = wh / tot; pw[v * 4 + 1] = Math.min(1, wl / tot * 1.4); pw[v * 4 + 2] = Math.min(1, wr / tot * 1.4); pw[v * 4 + 3] = wp / tot; tw[v] = wt / tot;
    for (let k = 0; k < 4; k++) lw[v * 4 + k] = Math.min(1, wleg[k] / tot * 1.2);
    const lk = Math.min(1, li / tot * 1.3), dkk = Math.min(1, dk / tot) * Math.max(0, n[1]) * (1 - lk);
    let c = Color3.Lerp(coat, dark, dkk);
    if (cat) { const band = 0.5 + 0.5 * Math.sin((p[0] * 62 + p[2] * 18 + p[1] * 26) / s); c = Color3.Lerp(c, dark.scale(0.85), 0.55 * Math.max(0, band * band * band - 0.2) * (1 - lk) * (n[1] > -0.4 ? 1 : 0)); }
    c = Color3.Lerp(c, light, lk);
    const earW = Math.max(pw[v * 4 + 1], pw[v * 4 + 2]); if (earW > 0.4 && (cat || P.ears === 'pointy')) c = Color3.Lerp(c, pink, Math.min(1, (earW - 0.4) * 2.5) * Math.max(0, Math.min(1, (n[0] * fw[0] + n[2] * fw[2] - 0.1) * 2.2)));
    col[v * 4] = c.r; col[v * 4 + 1] = c.g; col[v * 4 + 2] = c.b; col[v * 4 + 3] = 1;
    len[v] = (0.011 * (1 - pw[v * 4]) + 0.006 * pw[v * 4]) * (1 + 0.6 * lk * (1 - pw[v * 4])) * (1 + 0.45 * tw[v]) * (earW > 0.4 ? 0.45 : 1) * s;
  }
  const body: any = new VertexData(); body.positions = pos; body.indices = idx; body.normals = nor; body.colors = col; body.pw = pw; body.lw = lw; body.tw = tw;
  const tailDir = (p: number[]) => { let bi = 0, bd = 1e9; for (let i = 0; i < nT; i++) { const m = tc[i], d2 = (p[0] - m[0]) ** 2 + (p[1] - m[1]) ** 2 + (p[2] - m[2]) ** 2; if (d2 < bd) { bd = d2; bi = i; } } const a2 = tc[bi], b2 = tc[bi + 1], d = [b2[0] - a2[0], b2[1] - a2[1], b2[2] - a2[2]], l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; };
  const fur = strands(pos, nor, col, pw, lw, tw, len, idx, Math.round((cat ? 5200 : 7000) * (fine ? 1 : 0.55)), s, fw, tailDir);
  const out = { body, fur, D }; cache[key] = out; return out;
}
/** Strands of fur over the body: fine tapering hairs laid back along it (down the legs), lighter at the tips. */
function strands(pos: number[], nor: Float32Array, col: Float32Array, pw: Float32Array, lw: Float32Array, tw: Float32Array, len: Float32Array, idx: number[], N: number, s: number, fw: number[], tailDir: (p: number[]) => number[]): any {
  const nT = idx.length / 3, cum = new Float32Array(nT); let tot = 0;
  const P = (i: number) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  for (let t = 0; t < nT; t++) { const a = P(idx[t * 3]), b = P(idx[t * 3 + 1]), c = P(idx[t * 3 + 2]); const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; tot += 0.5 * Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]); cum[t] = tot; }
  const V: number[] = [], Nn: number[] = [], C: number[] = [], PW: number[] = [], LW: number[] = [], TW: number[] = [], I: number[] = [];
  let seed = 12345; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < N; k++) {
    const r = rnd() * tot; let lo = 0, hi = nT - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    const ia = idx[lo * 3], ib = idx[lo * 3 + 1], ic = idx[lo * 3 + 2]; let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const w0 = 1 - u - v;
    const p = [0, 1, 2].map(j => pos[ia * 3 + j] * w0 + pos[ib * 3 + j] * u + pos[ic * 3 + j] * v);
    const n = [0, 1, 2].map(j => nor[ia * 3 + j] * w0 + nor[ib * 3 + j] * u + nor[ic * 3 + j] * v); const nl = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= nl; n[1] /= nl; n[2] /= nl;
    const leg = Math.max(lw[ia * 4], lw[ia * 4 + 1], lw[ia * 4 + 2], lw[ia * 4 + 3]), onTail = tw[ia] > 0.2;
    let d = onTail ? tailDir(p) : [-fw[0] * (1 - leg), -0.35 - 0.65 * leg, -fw[2] * (1 - leg)]; const dn = d[0] * n[0] + d[1] * n[1] + d[2] * n[2]; d = [d[0] - n[0] * dn, d[1] - n[1] * dn, d[2] - n[2] * dn]; const dl = Math.hypot(d[0], d[1], d[2]) || 1; d = d.map(x => x / dl);
    const L = len[ia] * (0.7 + 0.6 * rnd()), wd = 0.0011 * s;
    const sd = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
    const lift = onTail ? 0.12 : 0.4, tip = [p[0] + d[0] * L + n[0] * L * lift, p[1] + d[1] * L + n[1] * L * lift, p[2] + d[2] * L + n[2] * L * lift];
    const b0 = V.length / 3; V.push(p[0] - sd[0] * wd, p[1] - sd[1] * wd, p[2] - sd[2] * wd, p[0] + sd[0] * wd, p[1] + sd[1] * wd, p[2] + sd[2] * wd, tip[0], tip[1], tip[2]); I.push(b0, b0 + 1, b0 + 2);
    for (let q = 0; q < 3; q++) { Nn.push(n[0], n[1], n[2]); const k2 = q === 2 ? 1.14 : 0.86; C.push(Math.min(1, col[ia * 4] * k2), Math.min(1, col[ia * 4 + 1] * k2), Math.min(1, col[ia * 4 + 2] * k2), 1); for (let j = 0; j < 4; j++) { PW.push(pw[ia * 4 + j]); LW.push(lw[ia * 4 + j]); } TW.push(tw[ia]); }
  }
  const g: any = new VertexData(); g.positions = V; g.indices = I; g.normals = Nn; g.colors = C; g.pw = new Float32Array(PW); g.lw = new Float32Array(LW); g.tw = new Float32Array(TW);
  return g;
}

/* ---------- the fur's material: it breathes, and the head, ears, tail, paws and legs move by the weights ---------- */
Effect.ShadersStore['petFurVertexShader'] = `precision highp float;
attribute vec3 position; attribute vec3 normal; attribute vec4 color; attribute vec4 pw; attribute vec4 lw; attribute float tw;
uniform mat4 world; uniform mat4 viewProjection;
uniform float uBreath, uHead, uEarL, uEarR, uTail, uTailY, uPaw; uniform vec4 uLegA; uniform vec3 uNeck, uEarPL, uEarPR, uTailP, uLeg0, uLeg1, uLeg2, uLeg3;
varying vec3 vN; varying vec3 vW; varying vec4 vC; varying vec3 vObj;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
vec3 mv(vec3 p, inout vec3 n) {
  mat3 R;
  R = rotZ(uLegA.x); p = mix(p, uLeg0 + R * (p - uLeg0), lw.x); n = mix(n, R * n, lw.x);
  R = rotZ(uLegA.y); p = mix(p, uLeg1 + R * (p - uLeg1), lw.y); n = mix(n, R * n, lw.y);
  R = rotZ(uLegA.z); p = mix(p, uLeg2 + R * (p - uLeg2), lw.z); n = mix(n, R * n, lw.z);
  R = rotZ(uLegA.w); p = mix(p, uLeg3 + R * (p - uLeg3), lw.w); n = mix(n, R * n, lw.w);
  R = rotX(uEarL); p = mix(p, uEarPL + R * (p - uEarPL), pw.y); R = rotX(-uEarR); p = mix(p, uEarPR + R * (p - uEarPR), pw.z);
  R = rotZ(uHead); p = mix(p, uNeck + R * (p - uNeck), pw.x); n = mix(n, R * n, pw.x);
  float t = step(0.001, tw);
  R = rotZ(uTailY * tw); p = mix(p, uTailP + R * (p - uTailP), t); R = rotY(uTail * tw); p = mix(p, uTailP + R * (p - uTailP), t);
  p.y += pw.w * uPaw * 0.012;
  float b = smoothstep(0.03, 0.16, p.y) * (1.0 - pw.x) * (1.0 - max(max(lw.x, lw.y), max(lw.z, lw.w))); p.y += b * uBreath * 0.01;
  return p; }
void main() { vec3 n = normal; vec3 p = mv(position, n); vec4 w = world * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(world) * n); vC = color; vObj = position; gl_Position = viewProjection * w; }`;
Effect.ShadersStore['petFurFragmentShader'] = `precision highp float;
varying vec3 vN; varying vec3 vW; varying vec4 vC; varying vec3 vObj;
uniform vec3 cameraPosition; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uSheen; uniform float uStrand;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y), mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW); if (uStrand < 0.5 && dot(n, v) < 0.0) n = -n;
  float st = vn(vObj * vec3(420.0, 150.0, 420.0)) * 0.6 + vn(vObj * 760.0) * 0.4;
  vec3 base = vC.rgb * (uStrand > 0.5 ? 0.96 + 0.1 * st : 0.82 + 0.16 * st);
  float wrap = max(0.0, (dot(n, -uSunDir) + 0.35) / 1.35);
  vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 c = base * (amb + uSunCol * wrap) + uSheen * rim * 0.35 * (0.4 + 0.6 * wrap);
  gl_FragColor = vec4(c, 1.0); }`;

export interface PetHooks { free?: (x: number, z: number) => boolean; door: number[]; box: number[]; save?: (food: number, water: number) => void; toast?: (t: string) => void; fine?: boolean }
export interface Pet { kneel: number; cam: Camera | null; pickup(): boolean; root: TransformNode; hits: AbstractMesh[]; blocks: number[][]; step(t: number, dt: number): void; stir(): void; refill(k: 'food' | 'water'): boolean; name: string; dispose(): void }

/** The bed at pos (x, z) turned by yaw, the pet asleep in it, its bowls beside it. */
export function placePet(sc: Scene, parent: TransformNode | null, P: PetData, pos: number[], yaw: number, H: PetHooks): Pet | null {
  if (!P || P.kind === 'none') return null;
  const cat = P.kind === 'cat', s = petScale(P), root = new TransformNode('pet', sc); root.parent = parent;
  const g = new TransformNode('pet-bed', sc); g.parent = root; g.position.set(pos[0], 0, pos[1]); g.rotation.y = yaw;
  const toW = (x: number, z: number) => new Vector3(pos[0] + x * Math.cos(yaw) + z * Math.sin(yaw), 0, pos[1] - x * Math.sin(yaw) + z * Math.cos(yaw));
  const hits: AbstractMesh[] = [], blocks: number[][] = [];
  const std = (hex: string, rough = 0.9) => { const m = new PBRMaterial('pet-m', sc); m.albedoColor = Color3.FromHexString(hex); m.roughness = rough; m.metallic = 0; m.maxSimultaneousLights = 8; return m; };
  // the bed: a round cushion in a soft rim (a cat's is smaller and deeper)
  const bedR = cat ? 0.34 : 0.45 * Math.max(0.8, s), bc = (PET_BEDS[P.bed] || PET_BEDS[0])[0];
  const cush = MeshBuilder.CreateCylinder('pet-cushion', { diameterTop: bedR * 1.72, diameterBottom: bedR * 1.76, height: 0.06, tessellation: 40 }, sc); cush.material = std(lighten(bc, 0.12), 0.98); cush.parent = g; cush.position.y = 0.03; cush.receiveShadows = true;
  const rim = MeshBuilder.CreateTorus('pet-rim', { diameter: bedR * 1.8, thickness: (cat ? 0.065 : 0.075 * Math.max(0.9, s)) * 2, tessellation: 48 }, sc); rim.material = std(bc, 0.97); rim.parent = g; rim.position.y = cat ? 0.07 : 0.075; rim.receiveShadows = true;
  blocks.push([pos[0] - bedR - 0.05, pos[1] - bedR - 0.05, pos[0] + bedR + 0.05, pos[1] + bedR + 0.05]);
  // the body, its fur and its face
  const SC = sculpt(P, s, H.fine !== false), D = SC.D;
  const grp = new TransformNode('pet-body', sc); grp.parent = root;
  const mk = (name: string, vd: any, strand: boolean) => {
    const m = new Mesh(name, sc); vd.applyToMesh(m, true); m.setVerticesData('pw', vd.pw, false, 4); m.setVerticesData('lw', vd.lw, false, 4); m.setVerticesData('tw', vd.tw, false, 1);
    const mat = new ShaderMaterial(name + '-m', sc, { vertex: 'petFur', fragment: 'petFur' }, { attributes: ['position', 'normal', 'color', 'pw', 'lw', 'tw'], uniforms: ['world', 'viewProjection', 'cameraPosition', 'uBreath', 'uHead', 'uEarL', 'uEarR', 'uTail', 'uTailY', 'uPaw', 'uLegA', 'uNeck', 'uEarPL', 'uEarPR', 'uTailP', 'uLeg0', 'uLeg1', 'uLeg2', 'uLeg3', 'uSunDir', 'uSunCol', 'uSky', 'uGround', 'uSheen', 'uStrand'] });
    mat.backFaceCulling = false; mat.setFloat('uStrand', strand ? 1 : 0); m.material = mat; m.parent = grp; m.isPickable = false; m.alwaysSelectAsActiveMesh = true; return { m, mat };
  };
  const body = mk('pet-skin', SC.body, false), fur = mk('pet-fur', SC.fur, true), mats = [body.mat, fur.mat];
  const V3 = (a: number[]) => new Vector3(a[0], a[1], a[2]), legs = (D.legs || [D.neck, D.neck, D.neck, D.neck]).map(V3);
  const coat = Color3.FromHexString(coatHex(P)), sheen = Color3.Lerp(coat, Color3.White(), 0.22);
  for (const m of mats) { m.setVector3('uNeck', V3(D.neck)); m.setVector3('uEarPL', V3(D.earL)); m.setVector3('uEarPR', V3(D.earR)); m.setVector3('uTailP', V3(D.tail[0]));
    legs.forEach((l, i) => m.setVector3('uLeg' + i, l)); m.setVector3('uSunDir', new Vector3(-0.3, -0.8, 0.4).normalize()); m.setColor3('uSunCol', new Color3(0.85, 0.78, 0.68)); m.setColor3('uSky', new Color3(0.62, 0.58, 0.54)); m.setColor3('uGround', new Color3(0.2, 0.16, 0.12)); m.setColor3('uSheen', sheen); }
  const headG = new TransformNode('pet-head', sc); headG.parent = grp; headG.position = V3(D.neck);
  const rel = (a: number[]) => V3(a).subtract(V3(D.neck));
  const noseM = std(cat ? '#D98C8C' : '#1A1412', 0.3), nose = MeshBuilder.CreateSphere('pet-nose', { diameter: 2, segments: 12 }, sc); nose.material = noseM; nose.parent = headG; nose.position = rel(D.nose); nose.scaling.set(D.noseR, D.noseR * 0.75, D.noseR * 1.15);
  const eyeT = new DynamicTexture('pet-eye', { width: 128, height: 128 }, sc, true); { const x = eyeT.getContext() as CanvasRenderingContext2D, iris = cat ? '#3FAE6A' : '#5A3A22';
    x.fillStyle = '#1a1210'; x.fillRect(0, 0, 128, 128); const gr = x.createRadialGradient(64, 64, 10, 64, 64, 60); gr.addColorStop(0, iris); gr.addColorStop(0.75, iris); gr.addColorStop(1, '#0d0907'); x.fillStyle = gr; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#050403'; x.beginPath(); x.arc(64, 64, 30, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(46, 44, 11, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(80, 82, 5, 0, Math.PI * 2); x.fill(); eyeT.update(true); }
  const eyeM = new StandardMaterial('pet-eyeM', sc); eyeM.diffuseTexture = eyeT; eyeM.specularColor = new Color3(0.9, 0.9, 0.9); eyeM.specularPower = 120; eyeM.emissiveColor = new Color3(0.08, 0.08, 0.08);
  const lidM = std('#14100E', 0.5), eyes: Mesh[] = [], lids: Mesh[] = [];
  for (const e of D.eyes) {
    const out = V3(e.at).subtract(V3(D.skull)).normalize(), at = rel(e.at).add(out.scale(0.0015 * s));
    const ey = MeshBuilder.CreateDisc('pet-eye', { radius: e.len * 0.62, tessellation: 20 }, sc); ey.material = eyeM; ey.parent = headG; ey.position = at; ey.lookAt(at.subtract(out)); ey.isVisible = false; eyes.push(ey);
    const lid = MeshBuilder.CreateCapsule('pet-lid', { height: e.len, radius: 0.0024 * s, tessellation: 6 }, sc); lid.material = lidM; lid.parent = headG; lid.position = at; lid.rotation.x = Math.PI / 2; lids.push(lid);
  }
  if (cat) {   // whiskers
    const b = rel(D.nose), lines: Vector3[][] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) { const y = b.y - 0.004 * s + i * 0.0028 * s; lines.push([new Vector3(b.x - 0.008 * s, y, b.z + side * 0.01 * s), new Vector3(b.x - 0.015 * s, y - 0.01 * s + i * 0.006 * s, b.z + side * 0.075 * s)]); }
    const w = MeshBuilder.CreateLineSystem('pet-whiskers', { lines }, sc); w.color = new Color3(0.96, 0.95, 0.92); w.alpha = 0.85; w.parent = headG; w.isPickable = false;
  }
  const hit = MeshBuilder.CreateBox('pet-hit', { width: 0.62 * s, height: 0.42 * s, depth: 0.34 * s }, sc); hit.parent = grp; hit.position.set(0.02 * s, 0.2 * s, 0); hit.visibility = 0; hit.metadata = { act: 'pet' }; hits.push(hit);
  // the bowls: water, and food in a bowl with its name on
  const bowls = makeBowls(sc, g, P, bedR, bc, hits);
  const lv = P; if (lv.food == null) lv.food = 1; if (lv.water == null) lv.water = 1; bowls.food.set(lv.food); bowls.water.set(lv.water);
  { const a = toW(bowls.x - bowls.r, -bowls.gap - bowls.r), b = toW(bowls.x + bowls.r, bowls.gap + bowls.r); blocks.push([Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)]); }
  const front = 0.2 + 0.22 * s, home = new Vector3(pos[0], 0, pos[1]);
  const eatAt = { food: toW(bowls.x, bowls.gap + front), water: toW(bowls.x, -bowls.gap - front) }, bowlAt = { food: toW(bowls.x, bowls.gap), water: toW(bowls.x, -bowls.gap) };
  const A: any = { st: 'sleep', until: 50 + Math.random() * 70, t: 0, nextEar: 4 + Math.random() * 6, nextTwitch: 8 + Math.random() * 10, ear: -1, earT: 0, tw: 0, stir: 0,
    pos: home.clone(), dir: yaw, path: [] as any[], ph: 0, lie: 1, head: -0.32, tailY: 0.95, tailW: 1.0, pitch: 0, gait: 0, fill: null as any, walkT: 0, pause: 0, job: '', bowlFace: 0, turnTo: 0 };
  const U: any = { uBreath: 0, uHead: 0, uEarL: 0, uEarR: 0, uTail: 0, uTailY: 0, uPaw: 0 };
  const doorV = new Vector3(H.door[0], 0, H.door[1]);

  const clear = (ax: number, az: number, bx: number, bz: number) => { const f = H.free; if (!f) return true; const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1));
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; if (Math.hypot(x - home.x, z - home.z) < bedR + 0.35) continue; if (!f(x, z)) return false; } return true; };
  const next = (from: Vector3): Vector3 | null => { const b = H.box; let best: Vector3 | null = null, bd = 0;
    for (let i = 0; i < 40; i++) { const x = b[0] + Math.random() * (b[2] - b[0]), z = b[1] + Math.random() * (b[3] - b[1]); if (H.free && !H.free(x, z)) continue;
      const d = Math.hypot(x - from.x, z - from.z); if (d < 0.7 || !clear(from.x, from.z, x, z)) continue; const sc2 = Math.min(d, 2.6) + Math.random() * 0.8; if (sc2 > bd) { bd = sc2; best = new Vector3(x, 0, z); } }
    return best; };
  const plan = (): any[] => { const out: any[] = []; let from = A.pos.clone(); const inBed = Math.hypot(A.pos.x - home.x, A.pos.z - home.z) < bedR + 0.1;
    if (inBed && Math.random() < 0.6) { const k: 'food' | 'water' = (lv.water || 0) > 0.05 && (Math.random() < 0.5 || (lv.food || 0) <= 0.05) ? 'water' : 'food';
      if ((lv[k] || 0) > 0.05) { const at = eatAt[k].clone(), tg = bowlAt[k]; const face = Math.atan2(-(tg.z - at.z), tg.x - at.x); out.push(Object.assign(at, { job: k === 'food' ? 'eat' : 'drink', face })); from = at; } }
    if (inBed || out.length) { out.push(doorV.clone()); from = doorV; }
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) { const n = next(from); if (!n) break; if (Math.random() < 0.45) (n as any).job = 'sniff'; out.push(n); from = n; }
    return out; };
  const pathHome = (): any[] => { const out: any[] = []; if (!clear(A.pos.x, A.pos.z, doorV.x, doorV.z)) { const mid = next(A.pos); if (mid && clear(mid.x, mid.z, doorV.x, doorV.z)) out.push(mid); } out.push(doorV.clone()); out.push(Object.assign(home.clone(), { home: true })); return out; };
  const pose = () => {
    const L = A.lie, fold = cat ? [1.12, 1.12, 1.38, 1.38] : [1.18, 1.18, 1.42, 1.42], a = 0.42 * A.gait * (1 - L), ph = A.ph;
    const legA = [fold[0] * L + a * Math.sin(ph), fold[1] * L + a * Math.sin(ph + Math.PI), fold[2] * L + a * Math.sin(ph + Math.PI), fold[3] * L + a * Math.sin(ph)];
    const d = Math.hypot(A.pos.x - home.x, A.pos.z - home.z), rimR = bedR * 0.9;
    const onBed = 1 - sm((d - rimR * 0.62) / (rimR * 0.38)), hop = A.gait > 0.05 ? 0.1 * s * Math.max(0, 1 - Math.abs(d - rimR) / 0.13) : 0;
    const drop = (cat ? 0.075 : 0.085) * s * 0.92 * L, bob = A.gait > 0.05 ? Math.abs(Math.sin(ph)) * 0.006 * s : 0;
    grp.position.set(A.pos.x, 0.06 * onBed - drop + hop + bob, A.pos.z); grp.rotation.set(0, A.dir, A.pitch);
    U.uHead = A.head; headG.rotation.z = A.head; U.uTailY = A.tailY; U.uTail = A.tailW;
    for (const m of mats) { m.setFloat('uBreath', U.uBreath); m.setFloat('uHead', U.uHead); m.setFloat('uEarL', U.uEarL); m.setFloat('uEarR', U.uEarR); m.setFloat('uTail', U.uTail); m.setFloat('uTailY', U.uTailY); m.setFloat('uPaw', U.uPaw);
      m.setVector4('uLegA', new Vector4(legA[0], legA[1], legA[2], legA[3])); }
  };
  const eyesOpen = (o: number) => { for (let i = 0; i < eyes.length; i++) { eyes[i].isVisible = o > 0.02; eyes[i].scaling.y = Math.max(0.0001, o); lids[i].isVisible = o < 0.3; } };
  const fillStep = (dt: number) => {
    const F = A.fill; if (!F) return; const B = bowls[F.k as 'food' | 'water'], Dd = 1.8; F.t += dt; const k = Math.min(1, F.t / Dd);
    if (F.k === 'water') {
      if (!F.mesh) { F.mesh = MeshBuilder.CreateCylinder('pet-pour', { diameterTop: 0.008, diameterBottom: 0.013, height: 1, tessellation: 10, cap: Mesh.NO_CAP }, sc); const m = new StandardMaterial('pet-pourM', sc); m.diffuseColor = Color3.FromHexString('#BFE3F2'); m.alpha = 0.6; F.mesh.material = m; F.mesh.parent = B.holder; }
      const top = 0.45, surf = B.hgt * (0.23 + 0.52 * B.level), on = k < 0.9 ? 1 : 1 - (k - 0.9) / 0.1; F.mesh.scaling.set(on, top - surf, on); F.mesh.position.set(0.01, (top + surf) / 2, 0); F.mesh.isVisible = on > 0.02;
      B.set(F.from + (1 - F.from) * sm(k * 1.1));
    } else {
      if (!F.drops) { F.drops = []; for (let i = 0; i < 40; i++) F.drops.push([Math.random() * 0.9, (Math.random() - 0.5) * B.r * 0.9, (Math.random() - 0.5) * B.r * 0.9, Math.random() * 6]); F.buf = new Float32Array(40 * 16); B.rain.thinInstanceSetBuffer('matrix', F.buf, 16, false); B.rain.isVisible = true; }
      const heapY = B.hgt * (0.3 + 0.45 * B.level);
      F.drops.forEach((d: number[], i: number) => { const tt = F.t - d[0] * Dd * 0.7, y = 0.4 - 0.5 * 9.8 * Math.max(0, tt) * Math.max(0, tt), sc2 = tt < 0 || y <= heapY ? 0.0001 : 1;
        Matrix.Compose(new Vector3(sc2, sc2 * 0.7, sc2), Quaternion.FromEulerAngles(d[3] + F.t * 8, d[3], 0), new Vector3(d[1], Math.max(heapY, y), d[2])).copyToArray(F.buf, i * 16); });
      B.rain.thinInstanceBufferUpdated('matrix'); B.set(F.from + (1 - F.from) * sm((k - 0.15) / 0.85));
    }
    if (F.t >= Dd) { if (F.mesh) F.mesh.dispose(); if (F.drops) B.rain.isVisible = false; lv[F.k as 'food' | 'water'] = 1; B.set(1); A.fill = null; if (H.save) H.save(lv.food || 0, lv.water || 0); }
  };
  // the food bowl in your hands: down on one knee beside it, picked up and looked at, put back down (and filled up)
  const carry: any = { st: '', t: 0 };
  const carryStep = (dt: number) => {
    if (!carry.st) return; carry.t += dt; const B = bowls.food, hd: TransformNode = B.holder;
    if (carry.st === 'down') { api.kneel = sm(carry.t / 0.7); if (carry.t >= 0.7 && api.cam) { carry.home = { p: hd.parent, pos: hd.position.clone(), rot: hd.rotation.clone() }; hd.parent = api.cam; hd.position.set(0, -0.16, 0.42); hd.rotation.set(-0.55, Math.PI, 0); carry.st = 'hold'; carry.t = 0;
        if (H.toast) H.toast(`${(P.name || (cat ? 'Kitty' : 'Buddy')).toUpperCase()}: ${api.name}'s bowl, ${Math.round((lv.food || 0) * 100)} % full`); } }
    else if (carry.st === 'hold') { hd.rotation.y = Math.PI + Math.sin(carry.t * 1.2) * 0.35; if (carry.t > 3.2) { const h0 = carry.home; hd.parent = h0.p; hd.position.copyFrom(h0.pos); hd.rotation.copyFrom(h0.rot); carry.st = 'up'; carry.t = 0; if ((lv.food || 0) < 0.97) api.refill('food'); } }
    else if (carry.st === 'up') { api.kneel = 1 - sm(carry.t / 0.7); if (carry.t >= 0.7) { api.kneel = 0; carry.st = ''; } }
  };
  const api: Pet = {
    kneel: 0, cam: null,
    pickup() { if (carry.st || A.fill || !api.cam) return false; carry.st = 'down'; carry.t = 0; return true; },
    root, hits, blocks, name: P.name || (cat ? 'Your cat' : 'Your dog'),
    step(t, dt) {
      const per = cat ? 2.6 : 3.6; A.t += dt;
      U.uBreath = Math.sin(t * 2 * Math.PI / (A.st === 'sleep' ? per : per * 0.6)) * (A.st === 'sleep' ? (A.stir > 0 ? 1.8 : 1.15) : 0.6);
      if (t > A.nextEar) { A.ear = Math.random() < 0.5 ? 0 : 1; A.earT = 0; A.nextEar = t + 6 + Math.random() * 14; }
      U.uEarL = 0; U.uEarR = 0;
      if (A.ear >= 0) { A.earT += dt; const k = A.earT < 0.4 ? Math.sin(A.earT / 0.4 * Math.PI * 2) * (1 - A.earT / 0.4) : 0; if (A.ear) U.uEarR = 0.4 * k; else U.uEarL = 0.4 * k; if (A.earT > 0.4) A.ear = -1; }
      fillStep(dt); carryStep(dt);
      let open = 1, wantHead = 0, wantTailY = 0, wantTailW = 0.12 * Math.sin(t * 1.3), wantLie = 0, wantPitch = 0;
      if (A.st === 'sleep') {
        wantLie = 1; wantHead = -0.32; wantTailY = 0.95; wantTailW = 1.0; open = 0; A.gait = 0;
        if (t > A.nextTwitch) { A.tw = 1.2; A.nextTwitch = t + 10 + Math.random() * 18; }
        U.uPaw = 0;
        if (A.tw > 0) { A.tw = Math.max(0, A.tw - dt); const k = Math.sin(A.tw * 18) * Math.min(1, A.tw); if (cat) wantTailW += 0.25 * k; else U.uPaw = k; }
        if (A.stir > 0) { A.stir = Math.max(0, A.stir - dt); const k = Math.sin(Math.min(1, (2.6 - A.stir) / 2.6) * Math.PI); wantHead = -0.32 + 0.4 * k; open = Math.min(1, (2.6 - A.stir) / 0.3, A.stir / 0.6); }
        if (A.t > A.until && A.stir <= 0) { A.st = 'wake'; A.t = 0; }
      } else if (A.st === 'wake') {
        wantLie = 1; wantHead = 0.02 + 0.08 * Math.sin(A.t * 2); wantTailY = 0.6; wantTailW = 0.7; open = Math.min(1, A.t / 0.5);
        if (A.t > 1.8) { A.st = 'rise'; A.t = 0; }
      } else if (A.st === 'rise') {
        const k = Math.min(1, A.t / 1.4); wantLie = 1 - sm(k * 1.1); wantPitch = 0.16 * Math.sin(Math.PI * Math.min(1, k * 1.25)) - 0.05 * Math.sin(Math.PI * Math.max(0, k * 1.6 - 0.6)); wantHead = 0.05; wantTailY = 0.2;
        if (A.t >= 1.5) { A.st = 'walk'; A.t = 0; A.walkT = 0; A.job = ''; A.path = plan(); }
      } else if (A.st === 'walk') {
        A.walkT += dt; wantLie = 0; wantTailY = cat ? 0.1 : -0.1; wantTailW = cat ? 0.12 * Math.sin(t * 1.3) : 0.35 * Math.sin(t * 9);
        if (A.pause > 0) {
          A.pause -= dt; A.gait = to(A.gait, 0, 6, dt);
          wantHead = A.job === 'eat' || A.job === 'drink' ? -0.55 + 0.05 * Math.sin(t * (A.job === 'drink' ? 9 : 5)) : A.job === 'sniff' ? -0.4 + 0.06 * Math.sin(t * 7) : 0.04;
          if (A.job && A.bowlFace) { let da = A.bowlFace - A.dir; da = Math.atan2(Math.sin(da), Math.cos(da)); A.dir += Math.max(-dt * 2, Math.min(dt * 2, da)); }
          if ((A.job === 'eat' || A.job === 'drink') && A.pause <= 0) { const k: 'food' | 'water' = A.job === 'eat' ? 'food' : 'water'; lv[k] = Math.max(0, (lv[k] || 0) - 0.14); bowls[k].set(lv[k]!); if (H.save) H.save(lv.food || 0, lv.water || 0); }
          if (A.pause <= 0) A.job = '';
        } else {
          const tgt = A.path[0];
          if (!tgt) { A.path = A.walkT > 55 ? pathHome() : plan(); if (!A.path.length) A.path = pathHome(); }
          else {
            const dx = tgt.x - A.pos.x, dz = tgt.z - A.pos.z, d = Math.hypot(dx, dz), want = Math.atan2(-dz, dx), speed = (cat ? 0.26 : 0.33) * Math.min(1.15, Math.max(0.8, s));
            let da = want - A.dir; da = Math.atan2(Math.sin(da), Math.cos(da)); A.dir += Math.max(-dt * 2.6, Math.min(dt * 2.6, da));
            const go = Math.abs(da) < 1.0 ? speed * (d < 0.2 ? Math.max(0.4, d / 0.2) : 1) : speed * 0.25;
            A.pos.x += Math.cos(A.dir) * go * dt; A.pos.z -= Math.sin(A.dir) * go * dt;
            A.gait = to(A.gait, go / speed, 6, dt); A.ph += go * dt / (0.22 * s) * Math.PI; wantHead = 0.04 + 0.03 * Math.sin(t * 2.2);
            if (d < 0.07) { A.path.shift();
              if (tgt.job) { A.job = tgt.job; A.pause = tgt.job === 'sniff' ? 1.2 + Math.random() * 2 : 3.5 + Math.random() * 2; A.bowlFace = tgt.face || 0; }
              if (tgt.home) { A.st = 'turn'; A.t = 0; A.turnTo = A.dir + Math.PI * (1.6 + Math.random() * 0.8); } }
          }
        }
      } else if (A.st === 'turn') {
        A.gait = to(A.gait, 0.55, 6, dt); A.ph += dt * 6; wantTailY = 0; wantTailW = 0.3 * Math.sin(t * 6);
        A.dir += Math.min(dt * 2.4, Math.max(0, A.turnTo - A.dir)); Vector3.LerpToRef(A.pos, home, Math.min(1, dt * 3), A.pos);
        if (A.dir >= A.turnTo - 0.01) { A.st = 'down'; A.t = 0; }
      } else if (A.st === 'down') {
        const k = Math.min(1, A.t / 1.5); A.gait = to(A.gait, 0, 8, dt);
        wantLie = sm(k * 1.05); wantPitch = -0.1 * Math.sin(Math.PI * Math.min(1, k * 1.4)); wantHead = -0.32 * sm((k - 0.5) * 2); wantTailY = 0.95 * k; wantTailW = 1.0 * k; open = 1 - sm((k - 0.6) / 0.4);
        if (A.t >= 1.7) { A.st = 'sleep'; A.t = 0; A.until = 240 + Math.random() * 300; }
      }
      A.lie = to(A.lie, wantLie, A.st === 'rise' || A.st === 'down' ? 9 : 4, dt);
      A.head = to(A.head, wantHead, 5, dt); A.tailY = to(A.tailY, wantTailY, 3, dt); A.tailW = to(A.tailW, wantTailW, 6, dt); A.pitch = to(A.pitch, wantPitch, 8, dt);
      eyesOpen(open); pose();
    },
    stir() { if (A.stir > 0) return; if (A.st === 'sleep') { A.stir = 2.6; A.ear = 0; A.earT = 0; }
      if (H.toast) H.toast(A.st === 'sleep' ? `${api.name} opens an eye, and sleeps on` : `${api.name} is having a look round the office`); },
    refill(k) { if (A.fill) return false; if ((lv[k] || 0) > 0.97) return false; A.fill = { k, t: 0, from: lv[k] || 0 }; return true; },
    dispose() { root.dispose(false, true); },
  };
  pose(); eyesOpen(0);
  return api;
}
function lighten(hex: string, k: number): string { const c = Color3.FromHexString(hex); return Color3.Lerp(c, Color3.White(), k).toHexString(); }

/** Two bowls side by side next to the bed: a glazed one of water, and one of food with your pet's name painted on the
 *  side facing the room. Each shows how full it is (set(0…1)). */
function makeBowls(sc: Scene, g: TransformNode, P: PetData, bedR: number, bc: string, hits: AbstractMesh[]): any {
  const cat = P.kind === 'cat', r = cat ? 0.068 : 0.088, hgt = cat ? 0.042 : 0.052, x = bedR + r + 0.07, gap = r + 0.012, out: any = { x, gap, r, hgt };
  for (const side of [-1, 1]) {
    const food = side > 0, holder = new TransformNode('pet-bowl', sc); holder.parent = g; holder.position.set(x, 0, side * gap); holder.rotation.y = Math.PI;
    const shape = [[0, 0], [r * 1.0, 0], [r * 1.04, 0.006], [r * 0.98, hgt * 0.92], [r * 0.95, hgt], [r * 0.9, hgt * 0.99], [r * 0.82, hgt * 0.35], [r * 0.6, hgt * 0.22], [0, hgt * 0.2]].map(p => new Vector3(p[0], p[1], 0));
    const baseHex = food ? lighten(bc, 0.08) : '#F1EEE8';
    const bm = new PBRMaterial('pet-bowlM', sc); bm.albedoColor = Color3.FromHexString(baseHex); bm.roughness = 0.18; bm.metallic = 0; bm.clearCoat.isEnabled = true; bm.clearCoat.intensity = 0.8; bm.backFaceCulling = false; bm.maxSimultaneousLights = 8;
    const bowl = MeshBuilder.CreateLathe('pet-bowl', { shape, tessellation: 48, sideOrientation: Mesh.DOUBLESIDE }, sc); bowl.material = bm; bowl.parent = holder; bowl.metadata = { act: food ? 'bowl-food' : 'bowl-water' }; hits.push(bowl);
    // the name (food) or WATER, painted on one side, with a paw print either side
    const lab = food ? (P.name || (cat ? 'Kitty' : 'Buddy')).toUpperCase() : 'WATER', bcol = Color3.FromHexString(baseHex), ink = food ? (bcol.r * 0.3 + bcol.g * 0.59 + bcol.b * 0.11 > 0.45 ? '#2A2420' : '#FFFFFF') : bc;
    const t = new DynamicTexture('pet-band', { width: 2048, height: 128 }, sc, true); t.hasAlpha = true; { const c = t.getContext() as CanvasRenderingContext2D; c.clearRect(0, 0, 2048, 128); c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
      let fs = 96; c.font = `800 ${fs}px Arial, sans-serif`; while (c.measureText(lab).width > 560 && fs > 36) { fs -= 2; c.font = `800 ${fs}px Arial, sans-serif`; } c.fillText(lab, 1024, 68);
      const tw2 = c.measureText(lab).width; for (const px of [1024 - tw2 / 2 - 60, 1024 + tw2 / 2 + 60]) { const py = 66; c.beginPath(); c.ellipse(px, py + 11, 19, 15, 0, 0, Math.PI * 2); c.fill(); for (const [dx, dy] of [[-21, -12], [-7, -27], [7, -27], [21, -12]]) { c.beginPath(); c.ellipse(px + dx, py + dy, 7, 9, 0, 0, Math.PI * 2); c.fill(); } } t.update(true); }
    const tm = new StandardMaterial('pet-bandM', sc); tm.diffuseTexture = t; tm.useAlphaFromDiffuseTexture = true; tm.specularColor = new Color3(0.4, 0.4, 0.4); tm.zOffset = -2;
    const band = MeshBuilder.CreateCylinder('pet-band', { diameterTop: r * 1.975, diameterBottom: r * 2.05, height: hgt * 0.56, tessellation: 64, cap: Mesh.NO_CAP }, sc); band.material = tm; band.parent = holder; band.position.y = hgt * 0.47; band.isPickable = false;
    const o: any = { holder, r, hgt, food, level: 1 };
    if (food) {
      const n = cat ? 160 : 130, kib = MeshBuilder.CreatePolyhedron('pet-kibble', { type: 2, size: cat ? 0.0042 : 0.0062 }, sc), km = new PBRMaterial('pet-kibM', sc); km.albedoColor = Color3.White(); km.roughness = 0.75; km.metallic = 0; kib.material = km; kib.parent = holder; kib.isPickable = false;
      let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const L: number[][] = []; for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * r * 0.74, y = hgt * 0.24 + (1 - rr / (r * 0.74)) * hgt * 0.55 * rnd() + rnd() * 0.006; L.push([a, rr, y, rnd() * 6, rnd() * 6, rnd() * 6, 0.8 + rnd() * 0.5, 0.07 + rnd() * 0.03, 0.22 + rnd() * 0.12]); }
      L.sort((p, q) => p[2] - q[2]);
      const mb = new Float32Array(n * 16), cb = new Float32Array(n * 4);
      L.forEach((k, i) => { Matrix.Compose(new Vector3(k[6], k[6] * 0.7, k[6]), Quaternion.FromEulerAngles(k[3], k[4], k[5]), new Vector3(Math.cos(k[0]) * k[1], k[2], Math.sin(k[0]) * k[1])).copyToArray(mb, i * 16); const c = Color3.FromHSV(k[7] * 360, 0.6, k[8] * 1.7); cb.set([c.r, c.g, c.b, 1], i * 4); });
      kib.thinInstanceSetBuffer('matrix', mb, 16, true); kib.thinInstanceSetBuffer('color', cb, 4, true);
      const rain = kib.clone('pet-kibble-rain'); rain.parent = holder; rain.thinInstanceSetBuffer('matrix', new Float32Array(16), 16, false); rain.isVisible = false; o.rain = rain;
      o.set = (v: number) => { o.level = Math.max(0, Math.min(1, v)); kib.thinInstanceCount = Math.round(n * o.level); kib.isVisible = kib.thinInstanceCount > 0; };
    } else {
      const wm = new PBRMaterial('pet-water', sc); wm.albedoColor = Color3.FromHexString('#9CC4D6'); wm.roughness = 0.02; wm.metallic = 0; wm.alpha = 0.55;
      const w = MeshBuilder.CreateDisc('pet-water', { radius: 1, tessellation: 40 }, sc); w.rotation.x = Math.PI / 2; w.material = wm; w.parent = holder; w.isPickable = false; o.w = w;
      o.set = (v: number) => { o.level = Math.max(0, Math.min(1, v)); const y = hgt * (0.23 + 0.52 * o.level), rad = r * (0.6 + 0.3 * Math.min(1, (y - hgt * 0.22) / (hgt * 0.7))); w.position.y = y; w.scaling.setAll(rad); w.isVisible = o.level > 0.02; };
    }
    o.set(1); out[food ? 'food' : 'water'] = o;
  }
  return out;
}
void Color4;
