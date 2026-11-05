// An airport under the flights in the 3D viewer, from the game's layout of it (the simulator's own, OpenStreetMap's, or
// laid out from the runways): the ground round it, the aprons and the stands with their lead-in lines and numbers, the
// taxiways with their yellow centre lines, the terminal buildings, and the runways with their real markings (threshold
// bars, designators, centre line, touchdown zone and aiming point, edge lines) and their lights at dusk and at night
// (white edge lights, green thresholds, red ends, and the approach lights).
// Metres; x east, y up, z north; the airport's middle (the layout's own point) at its origin.
import { Scene, Mesh, MeshBuilder, VertexData, TransformNode, StandardMaterial, PBRMaterial, DynamicTexture, Color3, Vector3, Matrix, Texture } from '@babylonjs/core';
import { IS_PC } from '../../core/app';

export interface Layout {
  icao: string; name: string; lat: number; lon: number; alt: number;
  runways: { lat: number; lon: number; hdg: number; len: number; wid: number; surf: number; a: string; b: string }[];
  points: number[][]; parks: number[][]; paths: number[][]; names: string[]; parkNames?: string[];
  areas?: { k: string; pts: number[][] }[]; source: string;
}
export interface Airport { icao: string; lat: number; lon: number; elev: number; root: TransformNode; lights: Mesh[]; dispose(): void }
const D2R = Math.PI / 180;

/** A polygon cut into triangles (ear clipping): for the terminals' roofs. */
function earcut(pts: number[][]): number[] {
  const n = pts.length; if (n < 3) return [];
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const idx = Array.from({ length: n }, (_, i) => area > 0 ? i : n - 1 - i), out: number[] = [];
  const cross = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p: number[], a: number[], b: number[], c: number[]) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 5000) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length], A = pts[i0], B = pts[i1], C = pts[i2];
      if (cross(A, B, C) <= 0) continue;
      let ok = true; for (const j of idx) { if (j === i0 || j === i1 || j === i2) continue; if (inside(pts[j], A, B, C)) { ok = false; break; } }
      if (!ok) continue;
      out.push(i0, i1, i2); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
  return out;
}
/** Where a point (lat, lon) is from the airport's middle, in metres east and north. */
function en(L: Layout, lat: number, lon: number): number[] { return [(lon - L.lon) * 111320 * Math.cos(L.lat * D2R), (lat - L.lat) * 110540]; }

/** The ground picture: grass, aprons, taxiways, stands and the terminals' roofs, seen from above. */
function paintGround(sc: Scene, L: Layout, half: number): DynamicTexture {
  const N = IS_PC ? 4096 : 2048, t = new DynamicTexture('aptGround', { width: N, height: N }, sc, true), x = t.getContext() as CanvasRenderingContext2D;
  const k = N / (half * 2), X = (e: number) => (e + half) * k, Y = (n: number) => (half - n) * k;
  // grass, with mown bands and patches
  x.fillStyle = '#5A6E3E'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) { const r = 6 + Math.random() * 60; x.fillStyle = `rgba(${Math.random() < 0.5 ? '70,92,48' : '98,112,64'},${0.12 + Math.random() * 0.18})`; x.beginPath(); x.arc(Math.random() * N, Math.random() * N, r, 0, Math.PI * 2); x.fill(); }
  // aprons
  x.fillStyle = '#8E9196';
  for (const a of L.areas || []) { if (a.k !== 'apron' || a.pts.length < 3) continue; x.beginPath(); a.pts.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); x.closePath(); x.fill(); }
  // without mapped aprons: concrete round the stands
  if (!(L.areas || []).some(a => a.k === 'apron')) for (const p of L.parks || []) { const r = Math.max(18, (p[3] || 20) * 1.3); x.beginPath(); x.arc(X(p[0]), Y(p[1]), r * k, 0, Math.PI * 2); x.fill(); }
  // taxiways: shoulder, asphalt, then the yellow centre line
  const taxi = (L.paths || []).filter(p => (p[0] === 1 || p[0] === 4 || p[0] === 9) && L.points[p[2]] && L.points[p[3]]);
  const conn = (L.paths || []).filter(p => p[0] === 3 && L.points[p[2]] && L.parks && L.parks[p[3]]);
  x.lineCap = 'round'; x.lineJoin = 'round';
  const line = (A: number[], B: number[]) => { x.beginPath(); x.moveTo(X(A[0]), Y(A[1])); x.lineTo(X(B[0]), Y(B[1])); x.stroke(); };
  for (const [col, extra] of [['#7A7D6F', 8], ['#3B3E42', 0]] as [string, number][]) {
    x.strokeStyle = col;
    for (const p of taxi) { x.lineWidth = (Math.min(40, Math.max(12, p[1] || 20)) + extra) * k; line(L.points[p[2]], L.points[p[3]]); }
    for (const p of conn) { x.lineWidth = (14 + extra) * k; line(L.points[p[2]], L.parks[p[3]]); }
  }
  x.strokeStyle = '#E8B820'; x.lineWidth = Math.max(1, 0.4 * k);
  for (const p of taxi) line(L.points[p[2]], L.points[p[3]]);
  for (const p of conn) line(L.points[p[2]], L.parks[p[3]]);
  // the stands: the lead-in line, the stop bar and the number
  x.font = `bold ${Math.max(9, Math.round(5 * k))}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
  (L.parks || []).forEach((p, i) => {
    const h = (p[2] || 0) * D2R, r = Math.max(12, p[3] || 20), fx = Math.sin(h), fy = Math.cos(h);
    x.strokeStyle = '#E8B820'; x.lineWidth = Math.max(1, 0.35 * k); line([p[0] - fx * r * 1.4, p[1] - fy * r * 1.4], [p[0] + fx * r * 0.6, p[1] + fy * r * 0.6]);
    x.strokeStyle = '#F4F4F0'; line([p[0] + fx * r * 0.6 - fy * 3, p[1] + fy * r * 0.6 + fx * 3], [p[0] + fx * r * 0.6 + fy * 3, p[1] + fy * r * 0.6 - fx * 3]);
    const nm = L.parkNames && L.parkNames[i] || (p[6] ? String(p[6]) : ''); if (nm) { x.fillStyle = '#F4F4F0'; x.fillText(nm, X(p[0] - fx * r * 1.6), Y(p[1] - fy * r * 1.6)); }
  });
  // the terminals' footprint (their buildings stand on it)
  x.fillStyle = '#5E6166';
  for (const a of L.areas || []) { if (a.k !== 'terminal' || a.pts.length < 3) continue; x.beginPath(); a.pts.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); x.closePath(); x.fill(); }
  t.update(true); t.anisotropicFilteringLevel = 8; t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE;
  return t;
}
/** A runway's paint, along its length: threshold bars, designators, centre line, touchdown zone and aiming point marks
 *  and the edge lines (to the ICAO pattern). */
function paintRunway(sc: Scene, len: number, wid: number, a: string, b: string, paved: boolean): DynamicTexture {
  const W = 256, H = 4096, t = new DynamicTexture('rwy', { width: W, height: H }, sc, true), x = t.getContext() as CanvasRenderingContext2D;
  const kx = W / wid, ky = H / len, Yd = (d: number) => H - d * ky;   // d: metres from end A
  x.fillStyle = paved ? '#2E3033' : '#6E6A52'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '20,20,22' : '70,72,76'},${0.15 + Math.random() * 0.2})`; x.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 10, 4 + Math.random() * 40); }
  if (!paved) { t.update(true); return t; }
  x.fillStyle = '#ECECE6';
  x.fillRect(1.5 * kx, 0, 0.9 * kx, H); x.fillRect(W - 2.4 * kx, 0, 0.9 * kx, H);           // edge lines
  for (let d = 40; d < len - 40; d += 50) x.fillRect(W / 2 - 0.45 * kx, Yd(d + 30), 0.9 * kx, 30 * ky);   // centre line
  for (const [end, des] of [[0, a], [1, b]] as [number, string][]) {
    const at = (d: number) => end ? len - d : d, put = (d0: number, l: number, cx: number, w: number) => { const y0 = Yd(end ? len - d0 : d0), y1 = Yd(end ? len - d0 - l : d0 + l); x.fillRect(cx - w / 2, Math.min(y0, y1), w, Math.abs(y1 - y0)); };
    // threshold bars
    const bars = wid >= 45 ? 16 : wid >= 30 ? 8 : 6, bw = (wid - 6) / (bars * 2 - 1);
    for (let i = 0; i < bars; i++) { const cx = 3 * kx + (i * 2 + 0.5) * bw * kx + (i >= bars / 2 ? bw * kx : 0) - (i >= bars / 2 ? bw * kx : 0); put(6, 30, cx, bw * kx); }
    // the designator
    x.save(); const cy = Yd(at(52)); x.translate(W / 2, cy); if (end) x.rotate(Math.PI); x.font = `bold ${Math.round(18 * ky)}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.scale(1, 1); x.fillText(String(des || '').replace(/^0(?=\d)/, '0'), 0, 0); x.restore();
    // aiming point and touchdown zone
    if (len > 1500) put(300, 50, W / 2 - 7 * kx, 6 * kx), put(300, 50, W / 2 + 7 * kx, 6 * kx);
    for (const d of [150, 450, 600, 750, 900]) if (d < len / 2 - 100) { put(d, 22, W / 2 - 6 * kx, 1.8 * kx); put(d, 22, W / 2 + 6 * kx, 1.8 * kx); }
  }
  t.update(true); t.anisotropicFilteringLevel = 16; t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE;
  return t;
}

export function buildAirport(sc: Scene, L: Layout): Airport {
  const root = new TransformNode('airport-' + L.icao, sc), lights: Mesh[] = [], made: any[] = [];
  // how far the airport reaches
  let half = 600;
  const grow = (e: number, n: number) => { half = Math.max(half, Math.abs(e) + 400, Math.abs(n) + 400); };
  for (const p of L.points || []) grow(p[0], p[1]); for (const p of L.parks || []) grow(p[0], p[1]);
  const rws = (L.runways || []).map(r => { const c = en(L, r.lat, r.lon), h = r.hdg * D2R; grow(c[0] + Math.sin(h) * r.len / 2, c[1] + Math.cos(h) * r.len / 2); grow(c[0] - Math.sin(h) * r.len / 2, c[1] - Math.cos(h) * r.len / 2); return { r, c, h }; });
  half = Math.min(half, 6000);
  // the ground: a wide field of grass, the airport's picture in its middle
  const far = MeshBuilder.CreateDisc('aptFar', { radius: 26000, tessellation: 64 }, sc); far.rotation.x = Math.PI / 2; far.position.y = -0.3; far.parent = root;
  const fm = new StandardMaterial('aptFarM', sc); fm.diffuseColor = Color3.FromHexString('#56693C'); fm.specularColor = Color3.Black(); far.material = fm; made.push(fm);
  const gnd = MeshBuilder.CreateGround('aptGround', { width: half * 2, height: half * 2 }, sc); gnd.parent = root;
  const gm = new PBRMaterial('aptGroundM', sc); gm.albedoTexture = paintGround(sc, L, half); gm.metallic = 0; gm.roughness = 0.92; gm.environmentIntensity = 0.35; gnd.material = gm; gnd.receiveShadows = true; made.push(gm);
  // the runways
  for (const { r, c, h } of rws) {
    const paved = r.surf !== 2 && r.surf !== 5;   // not grass or gravel (the simulator's codes)
    const m = MeshBuilder.CreateGround('rwy', { width: r.wid || 45, height: r.len }, sc); m.parent = root; m.position.set(c[0], 0.08, c[1]); m.rotation.y = h; m.receiveShadows = true;
    const rm = new PBRMaterial('rwyM', sc); rm.albedoTexture = paintRunway(sc, r.len, r.wid || 45, r.a, r.b, paved); rm.metallic = 0; rm.roughness = 0.85; rm.environmentIntensity = 0.4; rm.zOffset = -2; m.material = rm; made.push(rm);
    // its lights: edge lights every 60 m (white), the thresholds (green), the ends (red), the approach lights
    const bulbs: [number, number, number][] = [], fwd = [Math.sin(h), Math.cos(h)], side = [Math.cos(h), -Math.sin(h)], w2 = (r.wid || 45) / 2 + 1.5;
    const at = (d: number, s: number): [number, number] => [c[0] + fwd[0] * d + side[0] * s, c[1] + fwd[1] * d + side[1] * s];
    for (let d = -r.len / 2; d <= r.len / 2; d += 60) for (const s of [-w2, w2]) { const p = at(d, s); bulbs.push([p[0], p[1], 0]); }
    for (let s = -w2; s <= w2; s += 3) { const p = at(-r.len / 2, s), q = at(r.len / 2, s); bulbs.push([p[0], p[1], 1], [q[0], q[1], 1]); }
    if (paved && r.len > 1800) for (const dir of [-1, 1]) for (let d = 30; d <= 900; d += 30) for (const s of d % 150 === 0 ? [-12, -6, 0, 6, 12] : [-1.5, 0, 1.5]) { const p = at(dir * (r.len / 2 + d), s); bulbs.push([p[0], p[1], 2]); }
    for (const [kind, col] of [[0, '#FFF2D0'], [1, '#40FF70'], [2, '#FFFFFF']] as [number, string][]) {
      const list = bulbs.filter(b => b[2] === kind); if (!list.length) continue;
      const s = MeshBuilder.CreateSphere('rwyLight', { diameter: kind === 2 ? 0.9 : 0.7, segments: 4 }, sc); s.parent = root;
      const lm = new StandardMaterial('rwyLightM', sc); lm.emissiveColor = Color3.FromHexString(col); lm.disableLighting = true; s.material = lm; made.push(lm);
      const buf = new Float32Array(list.length * 16); list.forEach((b, i) => Matrix.Translation(b[0], 0.45, b[1]).copyToArray(buf, i * 16));
      s.thinInstanceSetBuffer('matrix', buf, 16, true); s.isVisible = false; lights.push(s);
    }
  }
  // the terminal buildings: walls and a flat roof, 14 m high
  const tm = new PBRMaterial('termM', sc); tm.albedoColor = Color3.FromHexString('#A9B2BC'); tm.metallic = 0.3; tm.roughness = 0.45; made.push(tm);
  for (const a of L.areas || []) {
    if (a.k !== 'terminal' || a.pts.length < 3 || a.pts.length > 400) continue;
    const H = 14, pos: number[] = [], idx: number[] = [], n = a.pts.length;
    for (let i = 0; i < n; i++) { const p = a.pts[i], q = a.pts[(i + 1) % n], o = pos.length / 3; pos.push(p[0], 0, p[1], q[0], 0, q[1], q[0], H, q[1], p[0], H, p[1]); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
    const o = pos.length / 3; for (const p of a.pts) pos.push(p[0], H, p[1]); for (const i of earcut(a.pts)) idx.push(o + i);
    const m = new Mesh('terminal', sc), vd = new VertexData(), nr: number[] = []; vd.positions = pos; vd.indices = idx; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
    tm.backFaceCulling = false; tm.twoSidedLighting = true; m.material = tm; m.parent = root; m.receiveShadows = true;
  }
  root.getChildMeshes().forEach(m => { m.renderingGroupId = 1; m.isPickable = false; });
  return { icao: L.icao, lat: L.lat, lon: L.lon, elev: L.alt || 0, root, lights, dispose() { for (const m of made) { try { if (m.albedoTexture) m.albedoTexture.dispose(); m.dispose(); } catch (e) { /* gone */ } } root.dispose(); } };
}
/** Where the airport is from the aircraft (it stays still; the aircraft moves), and its lights after dusk. */
export function placeAirport(A: Airport, lat: number, lon: number, alt: number, dark: boolean) {
  A.root.position.set((A.lon - lon) * 111320 * Math.cos(lat * D2R), A.elev - alt, (A.lat - lat) * 110540);
  for (const l of A.lights) l.isVisible = dark;
}
export { Vector3 };
