// The airport site: where the custom airport could stand in the real world, at real scale. The real terrain's
// heights (Terrain Tiles on AWS, from SRTM and others; no satellite pictures) round the site: fine detail for 18 km
// round it and coarser out to about 70 km, on the curve of the Earth, coloured by height and slope (black sand or
// fields low down, moss and grass, scree, rock on the steep faces, snow and ice up high), with the sea, the sky,
// its clouds and the haze of the distance. On it, the airport as planned: the terminal and its pier with eight
// stands and aircraft on them, the apron, the parallel taxiway, two parallel 3,500 m runways 2,000 m apart with the
// taxiways between them, a tower, and the fence round about 21 km². Ready-made views (from a gate, the apron, the
// runways, the air) and a free drone camera, the time of day and the weather, and the photo button.
import { Ray, Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, ShadowGenerator, GlowLayer, DefaultRenderingPipeline, ImageProcessingConfiguration, MeshBuilder, Mesh, VertexData, TransformNode, PBRMaterial, StandardMaterial, DynamicTexture, Texture, AbstractMesh } from '@babylonjs/core';
import { registerSection, Section, SectionCtx } from '../../core/sections';
import { runLoop } from '../../core/engine';
import { inputFrame } from '../../core/input';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { S } from '../../core/settings';
import { toast } from '../../ui/icons';
import { perfAttach, perfDetach, perfShow, perfBegin, perfEnd } from '../../core/perf-meter';
import { buildAirliner, setGear } from '../viewer3d/airliner';
import { makeWeather, Weather } from '../terminal/weather';
import { makeKit } from '../terminal/kit';
import { buildShell } from '../terminal/shell';
import { buildDoors, stepDoors, DoorObj } from '../terminal/doors';
import { STAIRS, F2Y } from '../terminal/plan';
import { furnish } from '../terminal/furnish';
import { buildFixtures } from '../terminal/fixtures';
import { buildRental } from '../terminal/rental';
import { addFlatZone, clearFlatZones, flatHeight, onFlatChange, zoneForModel } from '../../core/flatten';

const D2R = Math.PI / 180, R = 6371000, HEIGHT_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
/** The sites: the airport's reference point (the middle between the runways), the runways' true heading (the gates
 *  face 90° to the left of it, towards the mountains), the snow line, the colours of the low ground. */
export const SITES = [
  { id: 'myrdalssandur', name: 'Mýrdalssandur, Iceland', lat: 63.465, lon: -18.72, hdg: 68, rwy: ['07', '25'], gates: 338, snow: 950, low: 'sand' },
  { id: 'matanuska', name: 'Matanuska Valley, Alaska', lat: 61.53, lon: -149.02, hdg: 292, rwy: ['29', '11'], gates: 202, snow: 1350, low: 'green' },
];
// the airport in its own frame: u along the runways (the heading), v to their left (towards the gates' view)
const RWY = { len: 3500, wid: 60, vA: -1000, vB: 1000 }, TWY = { vA: -1182, w: 23 }, FENCE = { u0: -3000, u1: 3000, v0: -1700, v1: 1800 };
const PX = (x: number) => x - 81, PV = (z: number) => z - 1482;          // the terminal's plan (x, z) into the airport's (u, v)
const PN = 82, MOD = [0, 1, 2, 3].map(i => -72.6 + 80.55 * i);

const O: any = { scene: null as Scene | null };

// ---- the terrain's heights ----
const tiles: { [k: string]: Float32Array | null } = {};
const tX = (lon: number, z: number) => (lon + 180) / 360 * 2 ** z;
const tY = (lat: number, z: number) => (1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2 * 2 ** z;
function loadTile(z: number, x: number, y: number): Promise<Float32Array | null> {
  const k = `${z}/${x}/${y}`; if (k in tiles) return Promise.resolve(tiles[k]);
  return new Promise(ok => { const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D; g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, 256, 256).data, H = new Float32Array(65536); for (let i = 0; i < 65536; i++) H[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768; tiles[k] = H; ok(H); };
    im.onerror = () => { tiles[k] = null; ok(null); }; im.src = `${HEIGHT_URL}${z}/${x}/${y}.png`; });
}
/** The height (m) at a place from the tiles of zoom z (bilinear), or null. */
function hAt(z: number, lat: number, lon: number): number | null {
  const X = tX(lon, z), Y = tY(lat, z), xi = Math.floor(X), yi = Math.floor(Y), H = tiles[`${z}/${xi}/${yi}`]; if (!H) return null;
  const fx = (X - xi) * 256 - 0.5, fy = (Y - yi) * 256 - 0.5, x0 = Math.max(0, Math.min(255, Math.floor(fx))), y0 = Math.max(0, Math.min(255, Math.floor(fy))), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1), a = Math.max(0, Math.min(1, fx - x0)), b = Math.max(0, Math.min(1, fy - y0));
  return (H[y0 * 256 + x0] * (1 - a) + H[y0 * 256 + x1] * a) * (1 - b) + (H[y1 * 256 + x0] * (1 - a) + H[y1 * 256 + x1] * a) * b;
}
async function loadArea(z: number, lat: number, lon: number, halfM: number, progress: (k: number) => void) {
  const dLat = halfM / 110540, dLon = halfM / (111320 * Math.cos(lat * D2R));
  const x0 = Math.floor(tX(lon - dLon, z)), x1 = Math.floor(tX(lon + dLon, z)), y0 = Math.floor(tY(lat + dLat, z)), y1 = Math.floor(tY(lat - dLat, z));
  const jobs: Promise<any>[] = []; let done = 0, all = (x1 - x0 + 1) * (y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) jobs.push(loadTile(z, x, y).then(() => progress(++done / all)));
  await Promise.all(jobs);
}

// ---- the ground: a grid of heights, coloured by height and slope, with a fine detail texture ----
function groundMesh(sc: Scene, site: any, half: number, n: number, z: number, detail: Texture, sink = 0, hole = 0) {
  const lat0 = site.lat, lon0 = site.lon, kx = 111320 * Math.cos(lat0 * D2R), kz = 110540, step = half * 2 / n;
  const raw = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const e = -half + i * step, nn = -half + j * step; let h = hAt(z, lat0 + nn / kz, lon0 + e / kx); if (h == null) h = hAt(11, lat0 + nn / kz, lon0 + e / kx) ?? 0; raw[j * (n + 1) + i] = h; }
  const m = new Mesh('ground', sc), mat = new PBRMaterial('groundM', sc); mat.albedoTexture = detail; mat.metallic = 0; mat.roughness = 0.95; mat.environmentIntensity = 0.35; m.useVertexColors = true; m.material = mat; m.isPickable = false; m.receiveShadows = true; m.renderingGroupId = 1;
  /** Lay the ground out (again): its own heights, levelled under every flat zone (core/flatten), coloured by height and slope. */
  const layout = () => {
  const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [], hs = new Float32Array((n + 1) * (n + 1)), fl = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const e = -half + i * step, nn = -half + j * step, q = j * (n + 1) + i, f = flatHeight(lat0 + nn / kz, lon0 + e / kx, raw[q]);
    hs[q] = Math.max(-25, f.h); fl[q] = f.k; }
  let s = 17; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const C = (hx: string) => Color3.FromHexString(hx), SAND = site.low === 'sand' ? C('#2E2D2E') : C('#5D6B3A'), MOSS = site.low === 'sand' ? C('#5E7238') : C('#3F5A2C'), GRASS = site.low === 'sand' ? C('#7C8A4A') : C('#4F6B33'),
    ROCK = C('#5B554E'), ROCK2 = C('#3F3B37'), SCREE = C('#7A746B'), SNOW = C('#F2F5F8'), ICE = C('#DCE6EE'), WET = C('#1E2A30');
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const e = -half + i * step, nn = -half + j * step, h = hs[j * (n + 1) + i], d2 = e * e + nn * nn;
    const hl = hs[j * (n + 1) + Math.max(0, i - 1)], hr = hs[j * (n + 1) + Math.min(n, i + 1)], hd = hs[Math.max(0, j - 1) * (n + 1) + i], hu = hs[Math.min(n, j + 1) * (n + 1) + i];
    const sl = Math.min(1, Math.hypot(hr - hl, hu - hd) / (2 * step)), nz = rnd();
    pos.push(e, h - d2 / (2 * R) * (1 - fl[j * (n + 1) + i]) - (hole && Math.abs(e) < hole && Math.abs(nn) < hole ? sink : 0), nn); uv.push(e / 40, nn / 40);
    let c: Color3;
    if (h < 0.6) c = WET; else {
      const low = site.low === 'sand' ? (h < 140 ? SAND : Color3.Lerp(SAND, MOSS, Math.min(1, (h - 140) / 200))) : Color3.Lerp(GRASS, MOSS, Math.min(1, h / 500));
      c = Color3.Lerp(low, GRASS, Math.max(0, Math.min(1, (sl - 0.08) * 3)) * (h < site.snow ? 0.6 : 0));
      c = Color3.Lerp(c, Color3.Lerp(SCREE, ROCK, nz), Math.max(0, Math.min(1, (sl - 0.35) * 2.6)));
      c = Color3.Lerp(c, ROCK2, Math.max(0, Math.min(1, (sl - 0.75) * 3)));
      const sn = Math.max(0, Math.min(1, (h - site.snow + nz * 160) / 220)) * (1 - Math.max(0, Math.min(1, (sl - 0.7) * 2.5)));
      c = Color3.Lerp(c, h > site.snow + 300 ? ICE : SNOW, sn);
    }
    const v = 0.92 + nz * 0.14; col.push(c.r * v, c.g * v, c.b * v, 1);
  }
  // the triangles wound so their fronts face up (the top of the land is what is drawn)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + n + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const vd = new VertexData(), nr: number[] = []; VertexData.ComputeNormals(pos, idx, nr); vd.positions = pos; vd.indices = idx; vd.normals = nr; vd.colors = col; vd.uvs = uv; vd.applyToMesh(m, true); s = 17;
  };
  layout(); return { m, layout };
}

// ---- the airport ----
function airport(sc: Scene, site: any, elev: number, casters: AbstractMesh[]) {
  const root = new TransformNode('AIRPORT', sc); root.position.y = elev; root.rotation.y = (site.hdg - 90) * D2R;
  const mat = (hex: string, rough = 0.6, metal = 0) => { const m = new PBRMaterial('am', sc); m.albedoColor = Color3.FromHexString(hex); m.roughness = rough; m.metallic = metal; return m; };
  const tex = (draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 512) => { const t = new DynamicTexture('at', { width: w, height: h }, sc, true); draw(t.getContext() as any, w, h); t.update(); t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const noise = (base: string, amt: number) => tex((x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < 26000; i++) { const v = Math.random() - 0.5; x.fillStyle = v > 0 ? `rgba(255,255,255,${v * amt})` : `rgba(0,0,0,${-v * amt})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const asphalt = new PBRMaterial('asphalt', sc); asphalt.albedoTexture = noise('#34373B', 0.3); asphalt.roughness = 0.85; asphalt.zOffset = -2; const concrete = new PBRMaterial('concrete', sc); concrete.albedoTexture = noise('#A9A8A3', 0.18); concrete.roughness = 0.85; concrete.zOffset = -1;
  const white = mat('#F2F3F5', 0.5), yellow = mat('#E7B92E', 0.5), glass = mat('#2E4252', 0.08, 0.5), roofW = mat('#F4F6F8', 0.2), timber = mat('#B87443', 0.6), steel = mat('#9AA2AC', 0.35, 0.6); yellow.zOffset = -4; const mark = mat('#F2F3F5', 0.5); mark.zOffset = -4;
  const part: Mesh[] = [];
  const box = (w: number, h: number, d: number, m: any, u: number, y: number, v: number, cast = false, ry = 0) => { const b = MeshBuilder.CreateBox('ab', { width: w, height: h, depth: d }, sc); b.position.set(u, y, v); b.rotation.y = ry; b.material = m; b.parent = root; b.receiveShadows = true; b.renderingGroupId = 1; b.isPickable = false; if (cast) casters.push(b); part.push(b); return b; };
  const pave = (u0: number, v0: number, u1: number, v1: number, m: any, y = 0.05, uvk = 30) => { const g = MeshBuilder.CreateGround('ap', { width: u1 - u0, height: v1 - v0 }, sc); g.position.set((u0 + u1) / 2, y, (v0 + v1) / 2); g.material = m; g.parent = root; g.receiveShadows = true; g.renderingGroupId = 1; g.isPickable = false;
    const t = (m.albedoTexture as Texture); if (t) { const uvs = g.getVerticesData('uv') as any; for (let i = 0; i < uvs.length; i += 2) { uvs[i] *= (u1 - u0) / uvk; uvs[i + 1] *= (v1 - v0) / uvk; } g.setVerticesData('uv', uvs); } return g; };
  // the runways: asphalt, the edge and centre lines, the thresholds' piano keys, the numbers, the touchdown marks
  const numTex = (t: string) => { const d = tex((x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#F2F3F5'; x.font = '700 300px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, w / 2, h / 2); }, 512, 512); d.hasAlpha = true; const m = new StandardMaterial('num', sc); m.diffuseTexture = d; m.useAlphaFromDiffuseTexture = true; m.specularColor = Color3.Black(); return m; };
  for (const [v, side] of [[RWY.vA, 'R'], [RWY.vB, 'L']] as [number, string][]) {
    pave(-RWY.len / 2 - 60, v - RWY.wid / 2 - 7, RWY.len / 2 + 60, v + RWY.wid / 2 + 7, asphalt, 0.06);
    for (const s of [-1, 1]) box(RWY.len, 0.02, 0.9, mark, 0, 0.08, v + s * (RWY.wid / 2 - 1));
    for (let u = -RWY.len / 2 + 400; u < RWY.len / 2 - 400; u += 50) box(30, 0.02, 0.9, mark, u, 0.08, v);
    for (const end of [-1, 1]) { const uE = end * (RWY.len / 2 - 12);
      for (let k = 0; k < 16; k++) { const off = -RWY.wid / 2 + 3 + k * 3.6 + (k >= 8 ? 2.4 : 0); box(30, 0.02, 1.8, mark, uE - end * 15, 0.08, v + off); }
      for (const d of [150, 300, 450]) for (const s of [-1, 1]) box(22, 0.02, 3, mark, uE - end * (d + 11), 0.08, v + s * 9);
      for (const s of [-1, 1]) box(45, 0.02, 10, mark, uE - end * 400, 0.08, v + s * 11);
      const nm = end < 0 ? site.rwy[0] : site.rwy[1], sd = end < 0 ? (side === 'L' ? 'L' : 'R') : (side === 'L' ? 'R' : 'L');
      const p = MeshBuilder.CreatePlane('rn', { width: 18, height: 36 }, sc); p.material = numTex(nm + sd); p.parent = root; p.rotation.x = Math.PI / 2; p.rotation.y = end < 0 ? Math.PI / 2 : -Math.PI / 2; p.position.set(uE - end * 70, 0.09, v); p.renderingGroupId = 1; }
  }
  // the taxiways: the parallel one south of runway A, links from the apron, the exits, the crossings to runway B; yellow centre lines
  const twy = (u0: number, v0: number, u1: number, v1: number) => { const alongU = Math.abs(u1 - u0) > Math.abs(v1 - v0); const lo = alongU ? Math.min(u0, u1) : Math.min(v0, v1), hi = alongU ? Math.max(u0, u1) : Math.max(v0, v1), c = alongU ? v0 : u0;
    if (alongU) { pave(lo, c - TWY.w / 2 - 5, hi, c + TWY.w / 2 + 5, asphalt, 0.055); box(hi - lo, 0.02, 0.3, yellow, (lo + hi) / 2, 0.075, c); } else { pave(c - TWY.w / 2 - 5, lo, c + TWY.w / 2 + 5, hi, asphalt, 0.055); box(0.3, 0.02, hi - lo, yellow, c, 0.075, (lo + hi) / 2); } };
  twy(-RWY.len / 2, TWY.vA, RWY.len / 2, TWY.vA);
  for (const u of [-1500, -700, -250, 250, 700, 1500]) twy(u, PV(PN + 70), u, TWY.vA);
  for (const u of [-RWY.len / 2 + 40, -900, 0, 900, RWY.len / 2 - 40]) twy(u, TWY.vA, u, RWY.vA);
  for (const u of [-RWY.len / 2 + 40, 0, RWY.len / 2 - 40]) twy(u, RWY.vA, u, RWY.vB);
  twy(-RWY.len / 2, RWY.vB - 182, RWY.len / 2, RWY.vB - 182);
  // the apron in concrete, its stand lines, a wider apron east and west for more stands later
  pave(PX(260), PV(PN), PX(900), PV(PN + 70), concrete, 0.05, 20); pave(PX(-700), PV(PN), PX(-100), PV(PN + 70), concrete, 0.05, 20); // the terminal's own apron is between these
  pave(-1700, PV(PN + 70), 1700, TWY.vA - 16, concrete, 0.045, 20);
  // the tower and its cab, a fire station, a hangar
  { const tx = PX(-180), tz = PV(30); const t = MeshBuilder.CreateCylinder('tower', { diameterTop: 5, diameterBottom: 7, height: 48, tessellation: 24 }, sc); t.position.set(tx, 24, tz); t.material = white; t.parent = root; t.renderingGroupId = 1; casters.push(t);
    const cab = MeshBuilder.CreateCylinder('cab', { diameterTop: 13, diameterBottom: 10, height: 5, tessellation: 12 }, sc); cab.position.set(tx, 50.5, tz); cab.material = glass; cab.parent = root; cab.renderingGroupId = 1;
    const cap = MeshBuilder.CreateCylinder('cap', { diameter: 14, height: 1.2, tessellation: 12 }, sc); cap.position.set(tx, 53.6, tz); cap.material = white; cap.parent = root; cap.renderingGroupId = 1; }
  box(80, 14, 50, mat('#C9CED5', 0.5, 0.3), 1200, 7, PV(10), true); box(90, 0.5, 60, concrete, 1200, 0.05, PV(70)); box(40, 9, 30, mat('#B3261E', 0.5), -1250, 4.5, PV(20), true);
  // the fence round the airport
  const fm = new PBRMaterial('fence', sc); fm.albedoColor = Color3.FromHexString('#8A9097'); fm.alpha = 0.55; fm.roughness = 0.6; fm.backFaceCulling = false;
  for (const [a, b, c, d] of [[FENCE.u0, FENCE.v0, FENCE.u1, FENCE.v0], [FENCE.u1, FENCE.v0, FENCE.u1, FENCE.v1], [FENCE.u1, FENCE.v1, FENCE.u0, FENCE.v1], [FENCE.u0, FENCE.v1, FENCE.u0, FENCE.v0]]) {
    const L = Math.hypot(c - a, d - b), p = MeshBuilder.CreatePlane('fn', { width: L, height: 2.4, sideOrientation: Mesh.DOUBLESIDE }, sc); p.material = fm; p.parent = root; p.position.set((a + c) / 2, 1.2, (b + d) / 2); p.rotation.y = -Math.atan2(d - b, c - a); p.renderingGroupId = 1; }
  // the road to the kerb
  pave(-14, FENCE.v0 - 400, 14, PV(-34), asphalt, 0.05);
  return root;
}
/** The ready-made views: where (in the airport's frame: u, height, v) and what it looks at. */
const VIEWS: { id: string; name: string; at: [number, number, number]; look: [number, number, number] }[] = [
  // gate 4 (upper floor): standing between the second and third rows of seats, the gate desk and its sign to the right, looking straight out over the seats to the aircraft and the mountains
  { id: 'gate', name: 'Gate 4', at: [PX(MOD[3] + 11), 7.62, PV(75.6)], look: [PX(MOD[3] + 11), 7.62, PV(75.6) + 200] },
  { id: 'carpark', name: 'Over the car park', at: [PX(75), 26, PV(-135)], look: [PX(75), 9, PV(15)] },
  { id: 'apron', name: 'On the apron', at: [PX(MOD[2] + 40), 1.7, PV(PN + 45)], look: [-600, 120, 3000] },
  { id: 'runway', name: 'Runway threshold', at: [-RWY.len / 2 - 20, 3, RWY.vA - 20], look: [RWY.len / 2, 80, RWY.vA + 1600] },
  { id: 'between', name: 'Between the runways', at: [400, 2, 0], look: [-400, 150, 4000] },
  { id: 'air', name: 'From the air', at: [-2400, 900, -5200], look: [600, 200, 1500] },
  { id: 'flyby', name: 'Low fly-by', at: [2600, 140, -2200], look: [-300, 40, -600] },
];

const Site$: Section = {
  id: 'site', title: 'Airport site',
  async open(ctx: SectionCtx) {
    const { engine, ui, progress } = ctx, site = SITES.find(s => s.id === (ctx.opts && ctx.opts.site)) || SITES[0]; O.ctx = ctx; O.site = site;
    progress(4, `Finding ${site.name}…`); await new Promise(r => setTimeout(r, 30));
    engine.useReverseDepthBuffer = true; O.engine = engine; const sc = new Scene(engine); O.scene = sc; sc.clearColor = new Color4(0.6, 0.72, 0.86, 1); sc.skipPointerMovePicking = true;
    // the real ground's heights: fine round the site, coarse further out
    await loadArea(13, site.lat, site.lon, 9500, k => progress(6 + Math.round(k * 44), 'Loading the terrain round the site…'));
    await loadArea(11, site.lat, site.lon, 36000, k => progress(50 + Math.round(k * 20), 'Loading the mountains further out…'));
    progress(72, 'Shaping the ground…'); await new Promise(r => setTimeout(r, 0));
    // the airport's height: the ground under its middle, levelled
    let sum = 0, cnt = 0; for (let a = -1500; a <= 1500; a += 300) for (let b = -1500; b <= 1500; b += 300) { const h = hAt(13, site.lat + b / 110540, site.lon + a / (111320 * Math.cos(site.lat * D2R))); if (h != null) { sum += h; cnt++; } }
    const elev = Math.max(2, cnt ? sum / cnt : 10); O.elev = elev;
    const detail = new DynamicTexture('detail', { width: 512, height: 512 }, sc, true); { const x = detail.getContext() as any; x.fillStyle = '#B8B8B8'; x.fillRect(0, 0, 512, 512); for (let i = 0; i < 60000; i++) { const v = Math.random(); x.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},${0.08 + Math.random() * 0.18})`; x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 2); } detail.update(); detail.wrapU = detail.wrapV = Texture.WRAP_ADDRESSMODE; }
    // the ground under the airport, levelled at its height: the fenced area (and a margin), the road in
    clearFlatZones('SITE/'); const kx0 = 111320 * Math.cos(site.lat * D2R), hd = site.hdg * D2R, at = (u: number, v: number) => ({ lat: site.lat + (u * Math.cos(hd) + v * Math.sin(hd)) / 110540, lon: site.lon + (u * Math.sin(hd) - v * Math.cos(hd)) / kx0 });
    { const c = at(0, (FENCE.v0 + FENCE.v1) / 2); addFlatZone({ id: 'SITE/AIRPORT', lat: c.lat, lon: c.lon, hdg: site.hdg, hu: FENCE.u1 + 150, hv: (FENCE.v1 - FENCE.v0) / 2 + 150, elev, blend: 700 }); }
    { const c = at(0, FENCE.v0 - 225); addFlatZone({ id: 'SITE/ROAD', lat: c.lat, lon: c.lon, hdg: site.hdg, hu: 30, hv: 260, elev, blend: 120 }); }
    O.zoneForModel = zoneForModel;
    const inner = groundMesh(sc, site, 9000, IS_PC ? 560 : 380, 13, detail);
    // the outer ground goes down under the inner, so only the fine one shows there
    const outer = groundMesh(sc, site, 36000, IS_PC ? 300 : 200, 11, detail, 60, 8800);
    // a model placed later with its own zone: the ground is laid out again under it
    let relay = 0; O.offFlat = onFlatChange(() => { clearTimeout(relay); relay = window.setTimeout(() => { inner.layout(); outer.layout(); }, 50); });
    // the sea
    const sea = MeshBuilder.CreateGround('sea', { width: 160000, height: 160000 }, sc); sea.position.y = 0.3 - 0; const sm = new PBRMaterial('seaM', sc); sm.albedoColor = Color3.FromHexString('#1D3443'); sm.roughness = 0.12; sm.metallic = 0.1; sea.material = sm; sea.renderingGroupId = 1; sea.isPickable = false;
    progress(84, 'Laying out the airport…');
    const casters: AbstractMesh[] = []; const ap = airport(sc, site, elev, casters); O.ap = ap;
    // your terminal itself, built by its own builders (they are not changed): its rooms, walls, glass, roofs, stairs,
    // doors, furniture, screens, its own grounds and apron with the aircraft and jet bridges, and the rental car centre;
    // then set into the airport frame, the plan's origin at (u, v) = (-81, -1482), on the levelled ground
    progress(86, 'Building your terminal…'); await new Promise(r => setTimeout(r, 0));
    const before = new Set(sc.transformNodes.concat(sc.meshes as any[]));
    const K = makeKit(sc); buildShell(K, () => { /* its own steps */ }); const doors = buildDoors(K) as DoorObj[]; furnish(K, () => { /* */ }); K.clearWalls();
    buildFixtures(K, '#1C3A8A', '#3FD3E6', 'Airline Manager Pro', () => { /* */ }); buildRental(K); (K.struct as any).finish();
    for (const n of (sc.transformNodes as any[]).concat(sc.meshes as any[])) if (!before.has(n) && !n.parent && n !== K.root) n.parent = K.root;   // anything built loose goes with it
    K.root.parent = ap; K.root.position.set(PX(0), 0, PV(0)); O.K = K;
    for (const m of K.casters) casters.push(m);
    for (const m of sc.meshes) { if (!before.has(m)) { m.renderingGroupId = 1; m.computeWorldMatrix(true); m.freezeWorldMatrix(); m.doNotSyncBoundingInfo = true; } }
    // airport mode (from the game's Airport): on foot, with gravity, against the terminal's floors, walls and glass,
    // the levelled ground and the aircraft; the stairs are walked up as ramps; the doors open as you come to them
    const walkMode = !!(ctx.opts && ctx.opts.walk); O.walkMode = walkMode;
    if (walkMode) {
      sc.collisionsEnabled = true;
      const skip = new Set<any>(); for (const d of doors) for (const m of d.node.getChildMeshes()) skip.add(m);
      for (const m of K.groups.STAIRS.getChildMeshes()) skip.add(m); for (const m of K.groups.SCREENS.getChildMeshes()) skip.add(m);
      for (const m of sc.meshes) if (!before.has(m) && !skip.has(m) && m.getTotalVertices() > 0) m.checkCollisions = true;
      for (const m of ap.getChildMeshes()) if (m.getTotalVertices() > 0 && !/fn|num|rn/.test(m.name)) m.checkCollisions = true;
      inner.m.checkCollisions = true; inner.m.subdivide(64);
      // the stairs as invisible ramps, from the lower floor up to the upper
      for (const st of STAIRS) { const r = (x: number, z: number, y: number) => new Vector3(x, y, z); let p: Vector3[];
        if (st.dir === 'x+') p = [r(st.x0, st.z0, 0), r(st.x1, st.z0, F2Y), r(st.x1, st.z1, F2Y), r(st.x0, st.z1, 0)];
        else if (st.dir === 'x-') p = [r(st.x0, st.z0, F2Y), r(st.x1, st.z0, 0), r(st.x1, st.z1, 0), r(st.x0, st.z1, F2Y)];
        else if (st.dir === 'z+') p = [r(st.x0, st.z0, 0), r(st.x1, st.z0, 0), r(st.x1, st.z1, F2Y), r(st.x0, st.z1, F2Y)];
        else p = [r(st.x0, st.z0, F2Y), r(st.x1, st.z0, F2Y), r(st.x1, st.z1, 0), r(st.x0, st.z1, 0)];
        const m = new Mesh('ramp-' + st.id, sc), vd = new VertexData(); vd.positions = p.flatMap(v => [v.x, v.y + 0.02, v.z]); vd.indices = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]; vd.applyToMesh(m);
        m.parent = K.root; m.isVisible = false; m.checkCollisions = true; m.isPickable = false; }
    }
    O.doors = doors;
    progress(92, 'Setting up the views…');
    // lights, camera, the sky and its weather
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), sc); hemi.intensity = 0.8;
    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), sc); sun.intensity = 2.2; sun.shadowMinZ = 1; sun.shadowMaxZ = 9000;
    const cam = new UniversalCamera('cam', new Vector3(0, 10, 0), sc); cam.minZ = 0.5; cam.maxZ = 120000; cam.fov = 0.9; cam.inertia = 0; O.cam = cam; sc.activeCamera = cam;
    const glow = new GlowLayer('glow', sc, { mainTextureRatio: 0.4 }); glow.intensity = 0.3; glow.isEnabled = S.gfx.glow !== false; for (const g of [inner.m, outer.m, sea]) glow.addExcludedMesh(g);
    if (S.gfx.shadows !== 'off') { const sg = new ShadowGenerator(S.gfx.shadows === 'high' ? (IS_PC ? 4096 : 2048) : 1024, sun); sg.usePercentageCloserFiltering = true; sg.bias = 0.0006; sg.normalBias = 0.02; for (const m of casters) sg.addShadowCaster(m, false); }
    const dp = new DefaultRenderingPipeline('dp', true, sc, [cam]); dp.fxaaEnabled = true; dp.imageProcessingEnabled = true; dp.imageProcessing.toneMappingEnabled = true; dp.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; dp.imageProcessing.exposure = 1.05; dp.imageProcessing.contrast = 1.08;
    dp.bloomEnabled = true; dp.bloomThreshold = 0.9; dp.bloomWeight = 0.15;
    const hud = document.createElement('div'); hud.className = 'hud site-hud'; O.hud = hud; ui.appendChild(hud);
    const wx: Weather = makeWeather({ baseFog: 0.000022, sc, engine, cam, sun, hemi, glow, hud, canvas: ctx.canvas, centre: ap.position.clone(), indoors: () => false }); O.wx = wx;
    for (const ps of sc.particleSystems) ps.renderingGroupId = 1;
    // what the panel shows: the site, its numbers, the views, the drone's speed
    const kx = 111320 * Math.cos(site.lat * D2R);
    hud.insertAdjacentHTML('beforeend', `<div class="site-top"><b>${site.name}</b><small>${site.lat.toFixed(3)}° ${site.lat >= 0 ? 'N' : 'S'} · ${Math.abs(site.lon).toFixed(3)}° ${site.lon < 0 ? 'W' : 'E'} · runways ${site.rwy[0]}/${site.rwy[1]} true ${String(site.hdg).padStart(3, '0')}°/${String((site.hdg + 180) % 360).padStart(3, '0')}° · gates face ${String(site.gates).padStart(3, '0')}° · ground ${Math.round(elev)} m</small></div>
      <div class="site-dock"><div class="site-speed"><small>Drone speed</small>${[[8, 'Walk'], [40, 'Fast'], [220, 'Plane']].map(([k, l]) => `<button class="wx-o" data-sp2="${k}">${l}</button>`).join('')}</div>
      <div class="site-views">${VIEWS.map(v => `<button class="wx-b" data-view="${v.id}">${v.name}</button>`).join('')}<button class="wx-b" data-site>${SITES.filter(s => s !== site).map(s => 'Go to ' + s.name.split(',')[0]).join('')}</button></div>
</div>
      <div class="wx-updown site-ud" ${IS_TOUCH ? '' : 'hidden'}><button class="wx-b" data-ud="up">▲</button><button class="wx-b" data-ud="down">▼</button></div>`);
    const CAM = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 40, up: 0, down: 0 }; O.CAM = CAM;
    if (walkMode) hud.insertAdjacentHTML('beforeend', `<div class="site-moves">${[['jump', 'Jump'], ['crouch', 'Crouch'], ['prone', 'Prone'], ['sprint', 'Sprint']].map(([k, l]) => `<button class="wx-b" data-mv="${k}">${l}</button>`).join('')}</div>`);
    if (walkMode) { hud.classList.add('site-walk'); (hud.querySelector('.site-dock') as HTMLElement).style.display = 'none'; (hud.querySelector('.site-ud') as HTMLElement).style.display = 'none'; }
    // the body you walk in: feet at its position, 1.8 m tall, 0.6 m across
    const body = MeshBuilder.CreateBox('player', { size: 0.5 }, sc); body.isVisible = false; body.isPickable = false; body.checkCollisions = false; body.ellipsoid = new Vector3(0.3, 0.9, 0.3); body.ellipsoidOffset = new Vector3(0, 0.9, 0);
    const toWorld = (x: number, y: number, z: number) => Vector3.TransformCoordinates(new Vector3(PX(x), y, PV(z)), ap.computeWorldMatrix(true));
    // the stances: standing, crouching, lying prone; the eye's height, the body's half height, the speeds (walk, sprint)
    const STANCE: { [k: string]: { eye: number; half: number; r: number; walk: number; sprint: number } } = {
      stand: { eye: 1.65, half: 0.9, r: 0.3, walk: 1.6, sprint: 6.2 }, crouch: { eye: 1.0, half: 0.58, r: 0.3, walk: 0.9, sprint: 1.6 }, prone: { eye: 0.32, half: 0.24, r: 0.36, walk: 0.35, sprint: 0.5 } };
    const W = { vy: 0, ground: false, stance: 'stand', eye: 1.65, jump: false, sprint: false }; O.W = W;
    /** Room overhead for a stance (its body's full height) where you are? */
    const roomFor = (k: string) => { const h = STANCE[k].half * 2, cur = STANCE[W.stance].half * 2; if (h <= cur) return true;
      const hit = sc.pickWithRay(new Ray(body.position.add(new Vector3(0, cur - 0.05, 0)), Vector3.Up(), h - cur + 0.1), (m: any) => !!m.checkCollisions && m !== body); return !(hit && hit.hit); };
    const setStance = (k: string) => { if (k === W.stance) k = 'stand'; if (!roomFor(k)) { toast('No room to stand up here'); return; } W.stance = k; const st = STANCE[k];
      body.ellipsoid = new Vector3(st.r, st.half, st.r); body.ellipsoidOffset = new Vector3(0, st.half, 0); hud.querySelectorAll('[data-mv]').forEach(b => b.classList.toggle('on', b.getAttribute('data-mv') === k)); };
    O.setStance = setStance;
    // airport mode starts at the kerb's edge, square on to the main entrance under its DEPARTURES sign
    if (walkMode) { const p = toWorld(75, 0.3, -21.5); body.position.copyFrom(p); const f = toWorld(75, 0.3, 20).subtract(p).normalize(); CAM.yaw = Math.atan2(f.x, f.z); CAM.pitch = 0; }
    const place = (id: string) => { const v = VIEWS.find(q => q.id === id) || VIEWS[0], at = Vector3.TransformCoordinates(new Vector3(v.at[0], v.at[1], v.at[2]), ap.computeWorldMatrix(true)), lk = Vector3.TransformCoordinates(new Vector3(v.look[0], v.look[1], v.look[2]), ap.getWorldMatrix());
      const d = lk.subtract(at).normalize(); CAM.x = at.x; CAM.y = at.y; CAM.z = at.z; CAM.yaw = Math.atan2(d.x, d.z); CAM.pitch = Math.asin(d.y); CAM.speed = id === 'air' || id === 'flyby' ? 220 : id === 'gate' ? 8 : 40;
      hud.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.getAttribute('data-view') === id)); hud.querySelectorAll('[data-sp2]').forEach(b => b.classList.toggle('on', Number(b.getAttribute('data-sp2')) === CAM.speed)); };
    hud.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button') as HTMLElement | null; if (!b) return;
      if (b.hasAttribute('data-mv')) { const k = b.getAttribute('data-mv'); if (k === 'jump') O.W.jump = true; else if (k === 'sprint') { O.W.sprint = !O.W.sprint; b.classList.toggle('on', O.W.sprint); } else O.setStance(k); }
      if (b.hasAttribute('data-view')) place(b.getAttribute('data-view') as string);
      if (b.hasAttribute('data-sp2')) { CAM.speed = Number(b.getAttribute('data-sp2')); hud.querySelectorAll('[data-sp2]').forEach(q => q.classList.toggle('on', q === b)); }
      if (b.hasAttribute('data-site')) { const other = SITES.find(s => s !== site)!; if (ctx.back) { /* open again at the other site */ } O.reopen = other.id; Site$.close(); Site$.open(Object.assign({}, ctx, { opts: Object.assign({}, ctx.opts || {}, { site: other.id }) })); } });
    for (const k of ['up', 'down'] as const) { const b = hud.querySelector(`[data-ud="${k}"]`) as HTMLElement; b.addEventListener('pointerdown', e => { e.stopPropagation(); CAM[k] = 1; }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { CAM[k] = 0; }); }
    const keys = new Set<string>(); O.kd = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); keys.add(k); if (!O.walkMode || e.repeat) return; if (k === ' ') O.W.jump = true; else if (k === 'c' || k === 'control') O.setStance('crouch'); else if (k === 'z') O.setStance('prone'); }; O.ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase()); window.addEventListener('keydown', O.kd); window.addEventListener('keyup', O.ku);
    if (!walkMode) place((ctx.opts && ctx.opts.view) || 'gate');
    perfAttach(engine, sc, hud); perfShow();
    if (walkMode) toast(IS_TOUCH ? 'Your airport · left thumb: walk · right: look' : 'Your airport · W A S D walk · mouse look · Shift run · P photo'); else toast(IS_TOUCH ? 'Pick a view · left thumb: fly · right: look · ▲ ▼ up and down' : 'Pick a view · W A S D fly · mouse look · Space / R up · C / F down · Shift faster · P photo');
    progress(100, 'Ready');
    runLoop(() => {
      perfBegin();
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000), now = performance.now() / 1000, inp = inputFrame(dt);
      CAM.yaw += inp.lx; CAM.pitch = Math.max(-1.55, Math.min(1.55, CAM.pitch - inp.ly));
      if (walkMode) {
        const st = STANCE[W.stance], sprinting = (inp.run || keys.has('shift') || W.sprint) && inp.my > 0.1;
        const cp0 = Math.cos(CAM.pitch), fw = new Vector3(Math.sin(CAM.yaw), 0, Math.cos(CAM.yaw)), rt = new Vector3(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw)), spd = (sprinting ? st.sprint : st.walk) * (W.ground ? 1 : 0.85) * dt;
        // a jump: up at 4.4 m/s (about a metre), from standing or crouching, only from the ground; landing from a crouch or prone stands you up first
        if (W.jump) { W.jump = false; if (W.ground) { if (W.stance !== 'stand') setStance(W.stance); else W.vy = 4.4, W.ground = false; } }
        W.vy = W.ground ? -0.5 : Math.max(-30, W.vy - 9.81 * dt);
        const want = fw.scale(inp.my * spd).add(rt.scale(inp.mx * spd)); want.y = W.vy * dt; const y0 = body.position.y;
        body.moveWithCollisions(want); W.ground = body.position.y > y0 + want.y + 0.001; if (W.ground) W.vy = 0;
        if (body.position.y < elev - 40) { body.position.copyFrom(toWorld(75, 0.5, -21.5)); W.vy = 0; }
        W.eye += (st.eye - W.eye) * Math.min(1, dt * 9); cam.position.set(body.position.x, body.position.y + W.eye, body.position.z); cam.setTarget(cam.position.add(new Vector3(Math.sin(CAM.yaw) * cp0, Math.sin(CAM.pitch), Math.cos(CAM.yaw) * cp0)));
        // the doors open as you come to them
        const lp = Vector3.TransformCoordinates(body.position, K.root.getWorldMatrix().clone().invert()); try { stepDoors(doors, lp.x, lp.z, lp.y > 3 ? 2 : 1, dt, now); } catch (e) { /* still */ }
      } else {
      const sp = CAM.speed * (inp.run || keys.has('shift') ? 4 : 1) * dt, cp = Math.cos(CAM.pitch), f = new Vector3(Math.sin(CAM.yaw) * cp, Math.sin(CAM.pitch), Math.cos(CAM.yaw) * cp), r = new Vector3(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw));
      const mv = f.scale(inp.my).add(r.scale(inp.mx)), vert = (keys.has(' ') || keys.has('r') || CAM.up ? 1 : 0) - (keys.has('c') || keys.has('f') || CAM.down ? 1 : 0);
      CAM.x += mv.x * sp; CAM.z += mv.z * sp; CAM.y = Math.max(elev + 0.6, Math.min(12000, CAM.y + mv.y * sp + vert * sp));
      cam.position.set(CAM.x, CAM.y, CAM.z); cam.setTarget(cam.position.add(f));
      }
      wx.frame(dt, now);
      sc.render(); perfEnd();
    });
    void kx; void Mesh; void StandardMaterial;
  },
  close() {
    const sc: Scene = O.scene; if (!sc) return;
    try { if (O.wx) O.wx.dispose(); } catch (e) { /* gone */ } try { window.removeEventListener('keydown', O.kd); window.removeEventListener('keyup', O.ku); } catch (e) { /* gone */ }
    perfDetach(); if (O.hud) O.hud.remove(); try { if (O.offFlat) O.offFlat(); } catch (e) { /* gone */ } clearFlatZones('SITE/'); sc.dispose(); O.scene = null; try { O.engine.useReverseDepthBuffer = false; } catch (e) { /* gone */ }
  },
};
registerSection(Site$);
export {};
