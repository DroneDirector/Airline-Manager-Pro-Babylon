// The airport site: where the custom airport could stand in the real world, at real scale. The real terrain's
// heights (Terrain Tiles on AWS, from SRTM and others; no satellite pictures) round the site: fine detail for 18 km
// round it and coarser out to about 70 km, on the curve of the Earth, coloured by height and slope (black sand or
// fields low down, moss and grass, scree, rock on the steep faces, snow and ice up high), with the sea, the sky,
// its clouds and the haze of the distance. On it, your airport, Mýrdalssandur (BIAP / VTX), as on its architect sheets
// (airfield/): the terminal and its pier with eight stands and aircraft on them, the asphalt apron with the A380 stand,
// the 4,000 m runway 08/26 (Code 4F, displaced thresholds), the parallel taxiways A and B with their curved ends and
// links, the holding positions with their signs and guard lights, the cargo apron and terminal, a tower, and the fence
// on the airport boundary. Inside the boundary the ground is levelled (blending into the real ground only within its
// outer 100 m); outside it the real ground and its mountains are untouched. Ready-made views (from a gate, the apron,
// the runway, the holding point, the air) and a free drone camera, the time of day and the weather, the photo button.
import { logIssue } from '../../core/errlog';
import { glassMirrors } from '../../core/glassmirror';
import { glassLook } from '../terminal/kit';
import { thinStatic, thinMoving } from '../../core/thin';
import { shareMaterials } from '../../core/texarray';
import { CascadedShadowGenerator, SSAO2RenderingPipeline, ReflectionProbe } from '@babylonjs/core';
import { Ray, Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, ShadowGenerator, GlowLayer, DefaultRenderingPipeline, ImageProcessingConfiguration, MeshBuilder, Mesh, VertexData, TransformNode, PBRMaterial, StandardMaterial, DynamicTexture, Texture, AbstractMesh } from '@babylonjs/core';
import { registerSection, Section, SectionCtx } from '../../core/sections';
import { runLoop } from '../../core/engine';
import { inputFrame, activePad } from '../../core/input';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { S } from '../../core/settings';
import { toast } from '../../ui/icons';
import { perfAttach, perfDetach, perfShow, perfBegin, perfEnd, perfPart } from '../../core/perf-meter';
import { buildAirliner, setGear } from '../viewer3d/airliner';
import { makeWeather, Weather } from '../terminal/weather';
import { applyLook, slimGlow } from '../../core/look';
import { mergeStatic, freezeStatic, octreeStatic, prewarmHidden } from '../../core/batch';
import { jetwayInteriors, tinyFar } from '../../core/hide';
import { cachedUrl, releaseUrl } from '../../core/tilecache';
import { makeKit } from '../terminal/kit';
import { buildShell } from '../terminal/shell';
import { buildDoors, stepDoors, DoorObj } from '../terminal/doors';
import { STAIRS, F2Y, ROOMS, inRoom } from '../terminal/plan';
import { holoMap } from '../../ui/holomap';
import { Matrix } from '@babylonjs/core';
import { stepLifts, LiftCtl } from '../terminal/lifts';
import { furnish } from '../terminal/furnish';
import { buildFixtures } from '../terminal/fixtures';
import { buildRental, rentalCars } from '../terminal/rental';
import { addFlatZone, clearFlatZones, flatHeight, onFlatChange, zoneForModel } from '../../core/flatten';
import { STANDS as T_STANDS } from '../terminal/plan';
import { applyReplacements } from '../../core/replace';
import { buildAirfield, AIRFIELD_VIEWS } from './airfield/build';
import { AIRFIELD, designate } from './airfield/plan';

const D2R = Math.PI / 180, R = 6371000, HEIGHT_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
/** The quick viewpoints in airport mode (plan metres: x along the pier, z out to the apron), the first is where you start:
 *  each is placed on a clear spot (never inside a wall, seat, rail or roof). */
const WALK_VIEWS: { name: string; label: string; at: [number, number]; look: [number, number]; y: number; pitch: number }[] = [
  { label: 'Entrance', name: 'Outside the main entrance doors', at: [75, -19], look: [75, 12], y: 0, pitch: 0 },
  { label: 'Main hall', name: 'Inside the main hall, facing check-in', at: [76, -0.5], look: [76, 40], y: 0, pitch: 0 },
  { label: 'Gate 4', name: 'Gate 4, looking out at the apron', at: [180, 72.5], look: [180, 110], y: F2Y, pitch: 0 },
  { label: 'Jetway', name: 'Gate 4\'s jetway corridor', at: [191.05, 83.3], look: [191.05, 96], y: F2Y, pitch: 0 },
  { label: 'Apron', name: 'On the apron by gate 4\'s jetway', at: [150, 100], look: [200, 104], y: 0, pitch: 0 },
  { label: 'Pier', name: 'On the apron, looking along the terminal', at: [238, 94], look: [100, 86], y: 0, pitch: 0 },
  { label: 'Kerb', name: 'At the kerb, looking at the main entrance', at: [22, -30], look: [75, -4], y: 0, pitch: 0 },
  { label: 'Bus stop', name: 'At the kerb, the shuttle bus and the trees', at: [66, -27.5], look: [0, -19], y: 0, pitch: 0 },
];
/** Where airport mode starts: on the apron. */
const WALK_START = 4;
/** The site (Iceland only): the frame's reference point (the terminal's plan origin is 1,482 m from it, south of the runway), the
 *  runway's true heading (the gates face 90° to the left of it, towards the mountains), its designators (west end
 *  first), the snow line, the colours of the low ground. Mýrdalssandur is your airport, BIAP / VTX. */
export const SITES = [
  { id: 'myrdalssandur', name: 'Mýrdalssandur Airport, Iceland', icao: 'BIAP', iata: 'VTX', lat: 63.465, lon: -18.72, hdg: 68, rwy: ['08', '26'], gates: 338, snow: 950, low: 'sand' },
];
// the airport in its own frame: u along the runway (the heading), v to its left (towards the gates' view); the plan
// (the terminal's and the airfield's: x along the runway, y towards it) has its origin at (u, v) = (-81, -1482)
const PX = (x: number) => x + AIRFIELD.airport.planU, PV = (z: number) => z + AIRFIELD.airport.planV;
const B = AIRFIELD.boundary, RWY0 = AIRFIELD.runway;
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
    im.onerror = () => { tiles[k] = null; ok(null); }; cachedUrl(`${HEIGHT_URL}${z}/${x}/${y}.png`).then(u => { const done = () => releaseUrl(u); im.addEventListener('load', done); im.addEventListener('error', done); im.src = u; }); });
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
function groundMesh(sc: Scene, site: any, half: number, n: number, z: number, detail: Texture, sink = 0, hole = 0, sinkIn: ((e: number, nn: number) => number) | null = null) {
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
    pos.push(e, h - d2 / (2 * R) * (1 - fl[j * (n + 1) + i]) - (hole && Math.abs(e) < hole && Math.abs(nn) < hole ? sink : 0) - (sinkIn ? sinkIn(e, nn) : 0), nn); uv.push(e / 40, nn / 40);
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
/** The airport: the airfield from its plan (ground, markings, signs, lights, cargo terminal, fence), a tower, a fire
 *  station and a hangar landside, the access road (inside the boundary on the levelled ground, outside it on the real
 *  ground). heightAt(u, v): the levelled ground's height there, from the airport's. */
function airport(sc: Scene, site: any, elev: number, casters: AbstractMesh[], heightAt: (u: number, v: number) => number, rawAt: (u: number, v: number) => number) {
  const root = new TransformNode('AIRPORT', sc); root.position.y = elev; root.rotation.y = (site.hdg - 90) * D2R;
  root.metadata = { id: 'AIRPORT', kind: 'airport', icao: site.icao || '' };
  const mat = (hex: string, rough = 0.6, metal = 0) => { const m = new PBRMaterial('am', sc); m.albedoColor = Color3.FromHexString(hex); m.roughness = rough; m.metallic = metal; return m; };
  const white = mat('#F2F3F5', 0.5), glass = mat('#2E4252', 0.08, 0.5);
  const box = (w: number, h: number, d: number, m: any, u: number, y: number, v: number, cast = false, id = 'ab') => { const b = MeshBuilder.CreateBox(id, { width: w, height: h, depth: d }, sc); b.position.set(u, y, v); b.material = m; b.parent = root; b.receiveShadows = true; b.renderingGroupId = 1; b.isPickable = false; b.metadata = { id, kind: 'building' }; if (cast) casters.push(b); return b; };
  // the runway's designators as this site has them (west end first)
  designate(site.rwy[0], site.rwy[1]);
  const AFB = buildAirfield(sc, root, { low: !IS_PC, heightAt });
  for (const m of AFB.casters) casters.push(m);
  // the tower and its cab, a fire station, a hangar
  { const tx = PX(-180), tz = PV(30); const t = MeshBuilder.CreateCylinder('TOWER', { diameterTop: 5, diameterBottom: 7, height: 48, tessellation: 24 }, sc); t.position.set(tx, 24, tz); t.material = white; t.parent = root; t.renderingGroupId = 1; t.metadata = { id: 'TOWER', kind: 'building' }; casters.push(t);
    const cab = MeshBuilder.CreateCylinder('TOWER/CAB', { diameterTop: 13, diameterBottom: 10, height: 5, tessellation: 12 }, sc); cab.position.set(tx, 50.5, tz); cab.material = glass; cab.parent = root; cab.renderingGroupId = 1;
    const cap = MeshBuilder.CreateCylinder('TOWER/CAP', { diameter: 14, height: 1.2, tessellation: 12 }, sc); cap.position.set(tx, 53.6, tz); cap.material = white; cap.parent = root; cap.renderingGroupId = 1; }
  box(80, 14, 50, mat('#C9CED5', 0.5, 0.3), PX(1281), 7, PV(10), true, 'HANGAR-1'); box(40, 9, 30, mat('#B3261E', 0.5), PX(-1169), 4.5, PV(20), true, 'FIRE-STATION');
  // the access road: from the terminal's road south to the boundary on the levelled ground, then on along the real ground
  { const asph = new PBRMaterial('ROAD', sc); asph.albedoColor = Color3.FromHexString('#2B2D30'); asph.roughness = 0.88; asph.metallic = 0; asph.zOffset = -2;
    const pos: number[] = [], idx: number[] = [], X = 170, half = 6; let vi = 0;
    for (let y = -34; y >= B.y0 - 1400; y -= 10) { const u = PX(X), v = PV(y), inside = y >= B.y0 + 100, h = inside ? heightAt(u, v) + 0.03 : Math.max(heightAt(u, v), rawAt(u, v)) + 0.18;
      pos.push(u - half, h, v, u + half, h, v); if (vi) idx.push(vi - 2, vi, vi - 1, vi - 1, vi, vi + 1); vi += 2; }
    const m = new Mesh('ROAD/ACCESS', sc), vd = new VertexData(), nr: number[] = []; vd.positions = pos; vd.indices = idx; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
    m.material = asph; m.parent = root; m.receiveShadows = true; m.renderingGroupId = 1; m.isPickable = false; m.metadata = { id: 'ROAD/ACCESS', kind: 'road' }; asph.backFaceCulling = false; }
  return { root, AFB };
}
/** The ready-made views: where (in the airport's frame: u, height, v) and what it looks at. */
const VIEWS: { id: string; name: string; at: [number, number, number]; look: [number, number, number] }[] = [
  // gate 4 (upper floor): standing between the second and third rows of seats, the gate desk and its sign to the right, looking straight out over the seats to the aircraft and the mountains
  { id: 'gate', name: 'Gate 4', at: [PX(MOD[3] + 11), 7.62, PV(75.6)], look: [PX(MOD[3] + 11), 7.62, PV(75.6) + 200] },
  { id: 'carpark', name: 'Over the car park', at: [PX(75), 26, PV(-135)], look: [PX(75), 9, PV(15)] },
  { id: 'apron', name: 'On the apron', at: [PX(MOD[2] + 40), 1.7, PV(PN + 88)], look: [PX(-600), 120, PV(3000)] },
  // the airfield's own views (as its photo renders)
  ...AIRFIELD_VIEWS.map(v => ({ id: v.id, name: v.name, at: [PX(v.at[0]), v.at[2], PV(v.at[1])] as [number, number, number], look: [PX(v.look[0]), v.look[2], PV(v.look[1])] as [number, number, number] })),
];

const Site$: Section = {
  id: 'site', title: 'Airport site',
  async open(ctx: SectionCtx) {
    const { engine, ui, progress } = ctx, site = SITES.find(s => s.id === (ctx.opts && ctx.opts.site)) || SITES[0]; O.ctx = ctx; O.site = site;
    progress(4, `Finding ${site.name}…`); await new Promise(r => setTimeout(r, 30));
    engine.useReverseDepthBuffer = true; O.engine = engine; const sc = new Scene(engine); O.scene = sc; sc.clearColor = new Color4(0.6, 0.72, 0.86, 1); sc.skipPointerMovePicking = true;
    sc.blockMaterialDirtyMechanism = true;   // while the airport is built: materials are not re-checked after every change (released before the graphics are prepared)
    // the real ground's heights: fine round the site, coarse further out
    await loadArea(13, site.lat, site.lon, 9500, k => progress(6 + Math.round(k * 44), 'Loading the terrain round the site…'));
    await loadArea(11, site.lat, site.lon, 36000, k => progress(50 + Math.round(k * 20), 'Loading the mountains further out…'));
    progress(72, 'Shaping the ground…'); await new Promise(r => setTimeout(r, 0));
    // the airport's height: the ground under its middle, levelled
    const kx0 = 111320 * Math.cos(site.lat * D2R), hd = site.hdg * D2R, at = (u: number, v: number) => ({ lat: site.lat + (u * Math.cos(hd) + v * Math.sin(hd)) / 110540, lon: site.lon + (u * Math.sin(hd) - v * Math.cos(hd)) / kx0 });
    let sum = 0, cnt = 0; for (let x = B.x0 + 150; x <= B.x1 - 150; x += 200) for (let y = B.y0 + 150; y <= B.y1 - 150; y += 150) { const c = at(PX(x), PV(y)), h = hAt(13, c.lat, c.lon); if (h != null) { sum += h; cnt++; } }
    const elev = Math.max(2, cnt ? sum / cnt : 10); O.elev = elev;
    const detail = new DynamicTexture('detail', { width: 512, height: 512 }, sc, true); { const x = detail.getContext() as any; x.fillStyle = '#B8B8B8'; x.fillRect(0, 0, 512, 512); for (let i = 0; i < 60000; i++) { const v = Math.random(); x.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},${0.08 + Math.random() * 0.18})`; x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 2); } detail.update(); detail.wrapU = detail.wrapV = Texture.WRAP_ADDRESSMODE; }
    // the ground inside the airport boundary, levelled at its height: fully inside, blending into the real ground only
    // within the boundary's outer 100 m; outside it the ground and its mountains are untouched
    clearFlatZones('SITE/');
    { const fl = AIRFIELD.flatten.blendInsideM, c = at(PX((B.x0 + B.x1) / 2), PV((B.y0 + B.y1) / 2)); addFlatZone({ id: 'SITE/AIRPORT', lat: c.lat, lon: c.lon, hdg: site.hdg, hu: (B.x1 - B.x0) / 2 - fl, hv: (B.y1 - B.y0) / 2 - fl, elev, blend: fl }); }
    // the levelled ground's height (from the airport's) at (u, v), and the real ground's
    const rawH = (u: number, v: number) => { const c = at(u, v); let h = hAt(13, c.lat, c.lon); if (h == null) h = hAt(11, c.lat, c.lon) ?? elev; return h; };
    const levelH = (u: number, v: number) => { const c = at(u, v); return Math.max(-25, flatHeight(c.lat, c.lon, rawH(u, v)).h) - elev; };
    const rawRel = (u: number, v: number) => Math.max(-25, rawH(u, v)) - elev;
    // the real ground's own mesh goes down a little inside the boundary, under the airfield's ground
    const sinkIn = (e: number, nn: number) => { const u = e * Math.sin(hd) + nn * Math.cos(hd), v = -e * Math.cos(hd) + nn * Math.sin(hd), x = u - AIRFIELD.airport.planU, y = v - AIRFIELD.airport.planV;
      return x > B.x0 + 25 && x < B.x1 - 25 && y > B.y0 + 25 && y < B.y1 - 25 ? 1.5 : 0; };
    O.zoneForModel = zoneForModel;
    const inner = groundMesh(sc, site, 9000, IS_PC ? 560 : 380, 13, detail, 0, 0, sinkIn);
    // the outer ground goes down under the inner, so only the fine one shows there
    const outer = groundMesh(sc, site, 36000, IS_PC ? 300 : 200, 11, detail, 60, 8800);
    // a model placed later with its own zone: the ground is laid out again under it
    let relay = 0; O.offFlat = onFlatChange(() => { clearTimeout(relay); relay = window.setTimeout(() => { inner.layout(); outer.layout(); }, 50); });
    // the sea
    const sea = MeshBuilder.CreateGround('sea', { width: 160000, height: 160000 }, sc); sea.position.y = 0.3 - 0; const sm = new PBRMaterial('seaM', sc); sm.albedoColor = Color3.FromHexString('#1D3443'); sm.roughness = 0.12; sm.metallic = 0.1; sea.material = sm; sea.renderingGroupId = 1; sea.isPickable = false;
    progress(84, 'Laying out the airport…');
    const casters: AbstractMesh[] = []; const AP = airport(sc, site, elev, casters, levelH, rawRel), ap = AP.root; O.ap = ap; O.AFB = AP.AFB;
    // your terminal itself, built by its own builders (they are not changed): its rooms, walls, glass, roofs, stairs,
    // doors, furniture, screens, its own grounds and apron with the aircraft and jet bridges, and the rental car centre;
    // then set into the airport frame, the plan's origin at (u, v) = (-81, -1482), on the levelled ground
    progress(86, 'Building your terminal…'); await new Promise(r => setTimeout(r, 0));
    const before = new Set(sc.transformNodes.concat(sc.meshes as any[]));
    const K = makeKit(sc); buildShell(K, () => { /* its own steps */ }); const doors = buildDoors(K) as DoorObj[]; furnish(K, () => { /* */ }); K.clearWalls();
    const FX: any = buildFixtures(K, '#1C3A8A', '#3FD3E6', 'Airport Dynasty Pro', () => { /* */ }); O.lifts = (FX && FX.lifts) || []; buildRental(K);
    // the rental car centre's cars as the game has them: only the companies signed at your airport, and a car that is out is not in its bay
    try { const RC = ctx.opts && ctx.opts.data && ctx.opts.data.rental; if (RC) { const seen: { [k: string]: number } = {};
      for (const c of rentalCars(K)) { const k = c.company + '/' + c.type, n = seen[k] = (seen[k] || 0) + 1, on = RC.signed.indexOf(c.company) >= 0 && n > ((RC.out[c.company] || {})[c.type] || 0);
        c.node.setEnabled(on); if (c.node.metadata && c.node.metadata.rental) c.node.metadata.rental.status = on ? 'ready' : RC.signed.indexOf(c.company) >= 0 ? 'rented' : 'not at the airport'; } } } catch (e) { /* every car in its bay */ }
    (K.struct as any).finish();
    for (const n of (sc.transformNodes as any[]).concat(sc.meshes as any[])) if (!before.has(n) && !n.parent && n !== K.root) n.parent = K.root;   // anything built loose goes with it
    K.root.parent = ap; K.root.position.set(PX(0), 0, PV(0)); O.K = K;
    // the terminal's own grass, apron and stand lines give way to the airfield's (its ground and markings, the same stands)
    const hidden = new Set<any>();
    for (const id of ['SITE/GRASS', 'SITE/APRON']) for (const m of sc.meshes) if (m.name === id && (m.metadata && m.metadata.room === 'SITE')) hidden.add(m);
    { const lane = K.objects.get('APRON/TAXI-LANE'); if (lane) for (const m of lane.node.getChildMeshes()) hidden.add(m); }
    for (const st of T_STANDS) { const o = K.objects.get(st.id); if (o) for (const m of o.node.getChildMeshes()) if (m.material === K.M.yellow) hidden.add(m); }
    for (const m of hidden) { m.setEnabled(false); m.checkCollisions = false; }
    // big aircraft on the A380 stand and the cargo stands (PC)
    if (IS_PC) for (const [id, k] of [['STAND-9', 1.85], ['C1', 1.95], ['C3', 1.95]] as [string, number][]) { const st = AIRFIELD.stands.find((q: any) => q.id === id); if (!st) continue;
      try { const ac = buildAirliner(sc); setGear(ac, 1); for (const m of [...ac.strobes, ...ac.beacons]) m.setEnabled(false);
        const holder = new TransformNode(id + '/AIRCRAFT', sc); holder.parent = ap; holder.position.set(PX(st.x), 3.9 * k, PV(st.nose - st.dir * 18.8 * k)); holder.rotation.y = st.dir < 0 ? Math.PI : 0; holder.scaling.setAll(k); holder.metadata = { id: id + '/AIRCRAFT', kind: 'aircraft' };
        ac.root.parent = holder; for (const m of ac.casters) casters.push(m); } catch (e) { /* the stand stays empty */ } }
    for (const m of K.casters) casters.push(m);
    const liftParts = new Set<any>(); for (const l of O.lifts as LiftCtl[]) for (const m of l.moving_parts) liftParts.add(m); for (const j of (FX && FX.jetways) || []) for (const m of j.meshes()) liftParts.add(m); O.jetways = (FX && FX.jetways) || [];
    for (const d of doors) for (const m of d.node.getChildMeshes()) liftParts.add(m);   // the doors slide and swing: never fixed in place
    for (const m of sc.meshes) { if (!before.has(m)) { m.renderingGroupId = 1; m.computeWorldMatrix(true); if (!liftParts.has(m)) { m.freezeWorldMatrix(); m.doNotSyncBoundingInfo = true; } } }
    // the terminal's static things merged by material and 60 m square: far fewer draw calls, the same picture
    { const doorParts = new Set<any>(); for (const d of doors) for (const m of d.node.getChildMeshes()) doorParts.add(m);
      const okM = (m: AbstractMesh) => !before.has(m) && !liftParts.has(m) && !hidden.has(m) && !doorParts.has(m);
      // materials alike but for colour and picture become one (texture arrays), so far more can be merged below
      try { shareMaterials(sc, okM); } catch (e) { logIssue('Airport', 'Texture arrays could not be made', String((e as any)?.message || e)); }
      try { mergeStatic(sc, okM, casters); } catch (e) { logIssue('Airport', 'Fixed objects could not be merged', String((e as any)?.message || e)); } }
    // airport mode (from the game's Airport): on foot, with gravity, against the terminal's floors, walls and glass,
    // the levelled ground and the aircraft; the stairs are walked up as ramps; the doors open as you come to them
    const walkMode = !!(ctx.opts && ctx.opts.walk); O.walkMode = walkMode;
    if (walkMode) {
      sc.collisionsEnabled = true;
      const skip = new Set<any>(); for (const d of doors) for (const m of d.node.getChildMeshes()) skip.add(m);
      for (const m of K.groups.STAIRS.getChildMeshes()) skip.add(m); for (const m of K.groups.SCREENS.getChildMeshes()) skip.add(m);
      for (const m of sc.meshes) if (!before.has(m) && !skip.has(m) && m.getTotalVertices() > 0) m.checkCollisions = true;
      // (the doors are left out: they open as you come to them, so they are never in the way)
      for (const m of ap.getChildMeshes()) { if (m.getTotalVertices() <= 0 || hidden.has(m) || skip.has(m)) continue; const kind = m.metadata && m.metadata.kind;
        if (/^AIRFIELD\//.test(m.name) ? kind === 'ground' || kind === 'building' || kind === 'signs' : kind !== 'road') m.checkCollisions = true; }
      O.AFB.ground.subdivide(64);
      inner.m.checkCollisions = true; inner.m.subdivide(64);
      // walking into the big, detailed shapes (the buildings' walls and floors, the jetways, the aircraft): each gets an
      // invisible stand-in sharing its shape, cut into small pieces, so only the pieces near you are tested (the shape
      // you see is not cut: that would cost draw calls)
      for (const m of sc.meshes.slice()) { if (!m.checkCollisions || (m as any).isAnInstance || !(m instanceof Mesh) || m === inner.m || m === O.AFB.ground) continue;
        const tris = m.getTotalIndices() / 3; if (tris < 3000) continue;
        try { const c = m.clone(m.name + '/COLLIDE', m.parent, true, false); if (!c) continue; c.isVisible = false; c.isPickable = false; c.material = null; c.checkCollisions = true;
          c.subdivide(Math.min(256, Math.ceil(tris / 400))); c.computeWorldMatrix(true); if (m.isWorldMatrixFrozen) c.freezeWorldMatrix(); m.checkCollisions = false; } catch (e) { /* tested as it is */ } }
      // the stairs as invisible ramps, from the lower floor up to the upper
      for (const st of STAIRS) { const r = (x: number, z: number, y: number) => new Vector3(x, y, z); let p: Vector3[];
        if (st.dir === 'x+') p = [r(st.x0, st.z0, 0), r(st.x1, st.z0, F2Y), r(st.x1, st.z1, F2Y), r(st.x0, st.z1, 0)];
        else if (st.dir === 'x-') p = [r(st.x0, st.z0, F2Y), r(st.x1, st.z0, 0), r(st.x1, st.z1, 0), r(st.x0, st.z1, F2Y)];
        else if (st.dir === 'z+') p = [r(st.x0, st.z0, 0), r(st.x1, st.z0, 0), r(st.x1, st.z1, F2Y), r(st.x0, st.z1, F2Y)];
        else p = [r(st.x0, st.z0, F2Y), r(st.x1, st.z0, F2Y), r(st.x1, st.z1, 0), r(st.x0, st.z1, 0)];
        const m = new Mesh('ramp-' + st.id, sc), vd = new VertexData(); vd.positions = p.flatMap(v => [v.x, v.y + 0.02, v.z]); vd.indices = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]; vd.applyToMesh(m);
        m.parent = K.root; m.isVisible = false; m.checkCollisions = true; m.isPickable = false; }
    }
    // the fixed copies (furniture, fittings) as thin instances: nothing per copy left for the processor each frame
    try { const moving = new Set<any>(); for (const d of doors) for (const m of d.node.getChildMeshes()) moving.add(m);
      thinStatic(sc, m => !before.has(m) && !liftParts.has(m) && !hidden.has(m) && !moving.has(m), casters, walkMode); } catch (e) { logIssue('Airport', 'Thin instances could not be made', String((e as any)?.message || e)); }
    // the jetways' wheels, stair wheels, steps, posts and rails: one list per kind of piece per jetway, following the
    // pieces only while that jetway docks or undocks (the pieces stay, unseen, to be walked on)
    try { const fs: (() => void)[] = []; for (const j of (O.jetways || []) as any[]) { const rx = new RegExp('^' + j.id + '/(STEP|STAIR-POST|STAIR-RAIL|STAIR-WHEEL|WHEEL)');
        fs.push(thinMoving(sc, sc.meshes.filter((m: any) => rx.test(m.name)) as any, casters, () => j.state === 'docking' || j.state === 'undocking', j.id)); } O.jwThin = fs; }
    catch (e) { logIssue('Airport', 'The jetways\' pieces could not be combined', String((e as any)?.message || e)); }
    O.doors = doors;
    progress(92, 'Setting up the views…');
    // lights, camera, the sky and its weather
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), sc); hemi.intensity = 0.8;
    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), sc); sun.intensity = 2.2; sun.shadowMinZ = 1; sun.shadowMaxZ = 9000;
    const cam = new UniversalCamera('cam', new Vector3(0, 10, 0), sc); cam.minZ = 0.5; cam.maxZ = 120000; cam.fov = 0.9; cam.inertia = 0; O.cam = cam; sc.activeCamera = cam;
    const glow = new GlowLayer('glow', sc, { mainTextureRatio: 0.4 }); glow.intensity = 0.3; glow.isEnabled = S.gfx.glow !== false; for (const g of [inner.m, outer.m, sea].concat(O.AFB.exclude)) glow.addExcludedMesh(g); for (const m of sc.meshes) if (m.material && (m.material as any)._soft) glow.addExcludedMesh(m as any); sc.onNewMeshAddedObservable.add(m => { setTimeout(() => { if (m.material && (m.material as any)._soft) glow.addExcludedMesh(m as any); }, 0); });
    slimGlow(glow, sc, cam);
    const ULTRA = S.gfx.preset === 'ultra', HIGH = ULTRA || S.gfx.preset === 'high';
    const SG: any[] = [];
    if (S.gfx.shadows !== 'off' && ULTRA && IS_PC) { const csm = new CascadedShadowGenerator(4096, sun); csm.numCascades = 4; csm.lambda = 0.85; csm.stabilizeCascades = true; csm.usePercentageCloserFiltering = true; csm.filteringQuality = CascadedShadowGenerator.QUALITY_HIGH; csm.bias = 0.002; csm.normalBias = 0.02; csm.shadowMaxZ = 420; for (const m of casters) csm.addShadowCaster(m, false); SG.push(csm); }
    else if (S.gfx.shadows !== 'off') { const sg = new ShadowGenerator(S.gfx.shadows === 'high' ? (IS_PC ? 4096 : 2048) : 1024, sun); sg.usePercentageCloserFiltering = true; sg.bias = 0.0006; sg.normalBias = 0.02; for (const m of casters) sg.addShadowCaster(m, false); SG.push(sg); }
    // the shadows' distance and how often they are drawn (Settings → Graphics; both apply at once): only the casters
    // within the distance of you go in, so the shadow map covers less ground (faster, and the near shadows sharper)
    if (SG.length) { const all = casters.slice(); let last = '';
      const shadowTick = () => { const g: any = S.gfx, D = g.shadowDist || 400, every = Math.max(1, g.shadowEvery || 1), p = cam.globalPosition;
        for (const gen of SG) { const sm = gen.getShadowMap(); if (!sm) continue; sm.refreshRate = every;
          // small things (under about 0.8 m) cast only within 40 m: further off their shadows are a few pixels
          const list = all.filter((m: any) => { if (m.isDisposed()) return false; const bs = m.getBoundingInfo().boundingSphere, d = Vector3.Distance(p, bs.centerWorld) - bs.radiusWorld;
            return (D >= 400 || d < D) && (bs.radiusWorld > 0.4 || d < 40); });
          sm.renderList = list; } last = String(D); };
      const st = setInterval(shadowTick, 500); sc.onDisposeObservable.addOnce(() => clearInterval(st)); }
    const dp = new DefaultRenderingPipeline('dp', true, sc, [cam]); dp.fxaaEnabled = true; dp.imageProcessingEnabled = true; dp.imageProcessing.toneMappingEnabled = true; dp.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; dp.imageProcessing.exposure = 1.05; dp.imageProcessing.contrast = 1.08;
    // the look, by graphics quality: bloom on the lights, filmic grading, a light vignette, sharpening, fine grain (Ultra on the PC)
    dp.samples = S.gfx.aa === 'msaa' ? 4 : 1; dp.imageProcessing.exposure = 1.06 * (S.gfx.exposure || 1); dp.imageProcessing.contrast = HIGH ? 1.15 : 1.08;
    dp.bloomEnabled = S.gfx.bloom !== false; dp.bloomThreshold = HIGH ? 0.82 : 0.9; dp.bloomWeight = HIGH ? 0.3 : 0.15; dp.bloomKernel = HIGH ? 64 : 32; dp.bloomScale = 0.6;
    if (HIGH) { dp.imageProcessing.vignetteEnabled = true; dp.imageProcessing.vignetteWeight = 1.4; dp.imageProcessing.vignetteColor = new Color4(0.08, 0.06, 0.05, 0); }
    if (S.gfx.sharpen) { dp.sharpenEnabled = true; dp.sharpen.edgeAmount = 0.2; }
    if (ULTRA && IS_PC) { dp.grainEnabled = true; dp.grain.intensity = 3; dp.grain.animated = true; dp.chromaticAberrationEnabled = true; dp.chromaticAberration.aberrationAmount = 2; }
    // ambient occlusion in the corners and under things (Ultra)
    if (S.gfx.ssao) { try { const ao = new SSAO2RenderingPipeline('look-ao', sc, { ssaoRatio: IS_PC ? 0.75 : 0.5, blurRatio: IS_PC ? 1 : 0.5 }, [cam]); ao.radius = 1.4; ao.totalStrength = 1.1; ao.samples = IS_PC ? 24 : 12; ao.maxZ = 220; ao.expensiveBlur = IS_PC; ao.base = 0.08; O.ao = ao; } catch (e) { /* not on this device */ } }
    const hud = document.createElement('div'); hud.className = 'hud site-hud'; O.hud = hud; ui.appendChild(hud);
    const wx: Weather = makeWeather({ baseFog: 0.000022, sc, engine, cam, sun, hemi, glow, hud, canvas: ctx.canvas, centre: ap.position.clone(), indoors: () => false }); O.wx = wx;
    // on foot the sky (which follows you) and the ground always fill the picture: no need to clear it first each frame
    if (walkMode) { sc.autoClear = false; sc.autoClearDepthAndStencil = true; }
    // the sky's light on everything: the sky and the ground seen from the apron, reflected in steel, cladding and glass (kept up with the time of day)
    if (S.gfx.probe !== false) { try { const pr = new ReflectionProbe('look-probe', ULTRA && IS_PC ? 256 : 128, sc); pr.position = ap.position.add(new Vector3(0, 12, 0)); const dome = sc.getMeshByName('sky'); if (dome) pr.renderList!.push(dome);
      for (const m of O.AFB.exclude || []) if (m && /GROUND/.test(m.name)) pr.renderList!.push(m); pr.refreshRate = IS_PC ? 120 : 600; sc.environmentTexture = pr.cubeTexture; sc.environmentIntensity = HIGH ? 0.75 : 0.55; O.probe = pr; } catch (e) { /* not on this device */ } }
    for (const ps of sc.particleSystems) ps.renderingGroupId = 1;
    // the extra graphics, each its own switch in Settings
    const lookStep = applyLook({ sc, cam, sun, dp, shadows: SG, ground: sc.meshes.filter(m => /ground|apron|taxi|rwy|road|markings|ramp-/i.test(m.name)), base: ap.position.y, casters });
    // what the panel shows: the site, its numbers, the views, the drone's speed
    const kx = 111320 * Math.cos(site.lat * D2R);
    hud.insertAdjacentHTML('beforeend', `<div class="site-top"><b>${site.name}</b><small>${site.lat.toFixed(3)}° ${site.lat >= 0 ? 'N' : 'S'} · ${Math.abs(site.lon).toFixed(3)}° ${site.lon < 0 ? 'W' : 'E'} ${site.icao ? `· ${site.icao} / ${site.iata} ` : ''}· runway ${site.rwy[0]}/${site.rwy[1]} true ${String(site.hdg).padStart(3, '0')}°/${String((site.hdg + 180) % 360).padStart(3, '0')}° · gates face ${String(site.gates).padStart(3, '0')}° · ground ${Math.round(elev)} m</small></div>
      <div class="site-dock"><div class="site-speed"><small>Drone speed</small>${[[8, 'Walk'], [40, 'Fast'], [220, 'Plane']].map(([k, l]) => `<button class="wx-o" data-sp2="${k}">${l}</button>`).join('')}</div>
      <div class="site-views">${VIEWS.map(v => `<button class="wx-b" data-view="${v.id}">${v.name}</button>`).join('')}</div>
</div>
      <div class="wx-updown site-ud" ${IS_TOUCH ? '' : 'hidden'}><button class="wx-b" data-ud="up">▲</button><button class="wx-b" data-ud="down">▼</button></div>`);
    const CAM = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 40, up: 0, down: 0 }; O.CAM = CAM;
    if (ctx.toGame) hud.insertAdjacentHTML('beforeend', `<button class="wx-b site-services" data-services>Services and concessions</button>`);
    hud.insertAdjacentHTML('beforeend', `<div class="site-lift" hidden></div>`);
    // the jetways' test button: animates all of them (docks parked ones, undocks docked ones). REMOVE BEFORE 1.0
    hud.insertAdjacentHTML('beforeend', `<button class="wx-b site-jwtest" data-jwtest style="position:absolute;left:12px;bottom:${walkMode ? 168 : 112}px">Animate jetways (test)</button>`);
    if (walkMode) hud.insertAdjacentHTML('beforeend', `<div class="site-moves">${[['jump', 'Jump'], ['crouch', 'Crouch'], ['prone', 'Prone'], ['sprint', 'Sprint']].map(([k, l]) => `<button class="wx-b" data-mv="${k}">${l}</button>`).join('')}<div class="site-views"><span>Go to</span>${WALK_VIEWS.map((v, i) => `<button class="wx-b" data-wv="${i}" title="${v.name}" aria-label="${v.name}">${v.label}</button>`).join('')}</div></div>`);
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
    // the airport map in the corner while walking: where you are on the plan, which floor, which way you face
    // scratch vectors for the frame loop, made once (no new objects every frame, so no memory clean-up hiccups)
    const SV: any = { fw: new Vector3(), rt: new Vector3(), dir: new Vector3(), tmp: new Vector3(), down: new Vector3(), look: new Vector3(), target: new Vector3(), lp: new Vector3(), rootInv: null };
    const apInv = Matrix.Invert(ap.computeWorldMatrix(true));   // the airport never moves: its inverse once
    if (walkMode) holoMap(hud, () => { const inv = apInv, l = Vector3.TransformCoordinates(body.position, inv);
      const d = Vector3.TransformNormal(new Vector3(Math.sin(CAM.yaw), 0, Math.cos(CAM.yaw)), inv);
      return { x: l.x - AIRFIELD.airport.planU, z: l.z - AIRFIELD.airport.planV, f: l.y > F2Y - 1.5 ? 2 : 1, yaw: Math.atan2(d.x, d.z) }; }, O.K && O.K.root);
    /** Puts you on one of the quick viewpoints (plan metres), standing, facing its look point. */
    /** A spot clear of walls, seats, rails and roofs near p (world): the body's width round it at foot, knee, chest and
     *  head height, and its full height above; tried in rings out to 3 m. Returns p if no clear spot is found. */
    const solid = (m: any) => !!m.checkCollisions && m !== body && m.isEnabled();
    const clearSpot = (p: Vector3) => { const dirs: Vector3[] = []; for (let a = 0; a < 8; a++) dirs.push(new Vector3(Math.cos(a * Math.PI / 4), 0, Math.sin(a * Math.PI / 4)));
      const ok = (q: Vector3) => { const dn = sc.pickWithRay(new Ray(q.add(new Vector3(0, 1.0, 0)), Vector3.Down(), 3), solid); if (!dn || !dn.hit || !dn.pickedPoint) return false;
        const f = dn.pickedPoint.y; const up = sc.pickWithRay(new Ray(new Vector3(q.x, f + 0.05, q.z), Vector3.Up(), 1.95), solid); if (up && up.hit) return false;
        for (const h of [0.35, 0.9, 1.5]) for (const d of dirs) { const r = sc.pickWithRay(new Ray(new Vector3(q.x, f + h, q.z), d, 0.45), solid); if (r && r.hit) return false; }
        q.y = f + 0.05; return true; };
      for (let ring = 0; ring <= 12; ring++) { const rr = ring * 0.25, n = ring ? 8 + ring * 2 : 1;
        for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, q = new Vector3(p.x + Math.cos(a) * rr, p.y, p.z + Math.sin(a) * rr); if (ok(q)) return q; } }
      return p; };
    /** Puts you on one of the quick viewpoints (plan metres), standing, facing its look point, never inside anything. */
    /** Walking is tested only against the solid things near you (within 20 m of their edge), the list kept fresh four
     *  times a second; everything solid is looked for again every 5 s, so things added later are walked against too. */
    let solidAll: AbstractMesh[] = [], solidScan = 0; const NEAR = 20;
    const nearSolids = (p: Vector3, now: number) => {
      if (now - solidScan > 5000) { solidScan = now; solidAll = sc.meshes.filter((m: any) => m !== body && (m.checkCollisions || m._farOff)); }
      for (const m of solidAll as any[]) { if (m.isDisposed()) continue; const bs = m.getBoundingInfo().boundingSphere, near = Vector3.Distance(p, bs.centerWorld) - bs.radiusWorld < NEAR;
        if (near) { if (m._farOff) { m.checkCollisions = true; m._farOff = false; } } else if (m.checkCollisions) { m.checkCollisions = false; m._farOff = true; } } };
    O.nearSolids = nearSolids; let nearT = 0;
    const goView = (i: number) => { const v = WALK_VIEWS[i] || WALK_VIEWS[WALK_START], p = toWorld(v.at[0], v.y + 0.3, v.at[1]); if (W.stance !== 'stand') setStance('stand');
      if (walkMode) nearSolids(p, performance.now());   // the floor and walls where you land are solid at once
      body.position.copyFrom(clearSpot(p)); W.vy = 0;
      const f = toWorld(v.look[0], v.y + 0.3, v.look[1]).subtract(p).normalize(); CAM.yaw = Math.atan2(f.x, f.z); CAM.pitch = v.pitch;
      hud.querySelectorAll('[data-wv]').forEach(b => b.classList.toggle('on', b.getAttribute('data-wv') === String(i))); };
    O.goView = goView;
    if (walkMode) goView(WALK_START);
    const place = (id: string) => { const v = VIEWS.find(q => q.id === id) || VIEWS[0], at = Vector3.TransformCoordinates(new Vector3(v.at[0], v.at[1], v.at[2]), ap.computeWorldMatrix(true)), lk = Vector3.TransformCoordinates(new Vector3(v.look[0], v.look[1], v.look[2]), ap.getWorldMatrix());
      const d = lk.subtract(at).normalize(); CAM.x = at.x; CAM.y = at.y; CAM.z = at.z; CAM.yaw = Math.atan2(d.x, d.z); CAM.pitch = Math.asin(d.y); CAM.speed = id === 'air' || id === 'flyby' ? 220 : id === 'gate' ? 8 : 40;
      hud.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.getAttribute('data-view') === id)); hud.querySelectorAll('[data-sp2]').forEach(b => b.classList.toggle('on', Number(b.getAttribute('data-sp2')) === CAM.speed)); };
    hud.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button') as HTMLElement | null; if (!b) return;
      if (b.hasAttribute('data-wv')) { O.goView(+(b.getAttribute('data-wv') || 0)); return; }
      if (b.hasAttribute('data-mv')) { const k = b.getAttribute('data-mv'); if (k === 'jump') O.W.jump = true; else if (k === 'sprint') { O.W.sprint = !O.W.sprint; b.classList.toggle('on', O.W.sprint); } else O.setStance(k); }
      if (b.hasAttribute('data-services') && ctx.toGame) { ctx.toGame('rental'); return; }
      if (b.hasAttribute('data-jwtest')) { const js: any[] = O.jetways || []; for (const j of js) j.test(); const st = js[0] && js[0].state; toast(st === 'docking' ? 'Jetways docking (about 2 minutes)' : st === 'undocking' ? 'Jetways undocking (about 1½ minutes)' : 'Jetways are still moving'); return; }
      if (b.hasAttribute('data-view')) place(b.getAttribute('data-view') as string);
      if (b.hasAttribute('data-sp2')) { CAM.speed = Number(b.getAttribute('data-sp2')); hud.querySelectorAll('[data-sp2]').forEach(q => q.classList.toggle('on', q === b)); }
    });
    for (const k of ['up', 'down'] as const) { const b = hud.querySelector(`[data-ud="${k}"]`) as HTMLElement; b.addEventListener('pointerdown', e => { e.stopPropagation(); CAM[k] = 1; }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { CAM[k] = 0; }); }
    const keys = new Set<string>(); O.kd = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); keys.add(k); if (!O.walkMode || e.repeat) return; if (k === ' ') O.W.jump = true; else if (k === 'c' || k === 'control') O.setStance('crouch'); else if (k === 'z') O.setStance('prone'); else if (k === 'e') O.liftPress = true; }; O.ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase()); window.addEventListener('keydown', O.kd); window.addEventListener('keyup', O.ku);
    if (!walkMode) place((ctx.opts && ctx.opts.view) || 'gate');
    perfAttach(engine, sc, hud); perfShow();
    if (walkMode) toast(IS_TOUCH ? 'Your airport · left thumb: walk · right: look' : 'Your airport · W A S D walk · mouse look · Shift run · Space jump · C crouch · Z prone · E lift · P photo · a controller: A jump, B crouch, Y prone, X lift, R3 sprint'); else toast(IS_TOUCH ? 'Pick a view · left thumb: fly · right: look · ▲ ▼ up and down' : 'Pick a view · W A S D fly · mouse look · Space / R up · C / F down · Shift faster · P photo');
    // the shaders compiled while still loading (no stutter the first time something comes into view), at most 25 s
    const insides = jetwayInteriors(sc);   // the jetways' insides only drawn from close by
    try { tinyFar(sc); } catch (e) { /* all drawn */ }   // tiny things far away left out
    sc.blockMaterialDirtyMechanism = false;
    progress(97, 'Preparing the graphics…');
    try { await Promise.race([sc.whenReadyAsync(), new Promise(r => setTimeout(r, 25000))]); } catch (e) { /* compiled as they come into view */ }
    progress(100, 'Ready');
    // then, with your own models in place, the materials that never change are frozen (the ground's, the landscape's,
    // lamps, signs, screens and the weather's stay live)
    const freezeLater = () => { try { const keep = new Set<any>(); for (const m of sc.meshes) if (/ground|GROUND|ROAD|APRON|GRASS/.test(m.name) && m.material) keep.add(m.material); freezeStatic(sc, keep); } catch (e) { logIssue('Airport', 'Materials could not be frozen', String((e as any)?.message || e)); }
      try { const stop = octreeStatic(sc); sc.onDisposeObservable.addOnce(stop); } catch (e) { logIssue('Airport', 'The octree could not be built', String((e as any)?.message || e)); }
      try { prewarmHidden(sc); } catch (e) { /* compiled when shown */ }
      };
    applyReplacements(sc).then(freezeLater, freezeLater);
    runLoop(() => {
      perfBegin();
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000), now = performance.now() / 1000, inp = inputFrame(dt); let T = performance.now(); lookStep(dt); const lap = (n: string) => { const t = performance.now(); perfPart(n, t - T); T = t; }; lap('effects');
      CAM.yaw += inp.lx; CAM.pitch = Math.max(-1.55, Math.min(1.55, CAM.pitch - inp.ly));
      if (walkMode) {
        // a controller: Cross / A jumps, Circle / B crouches, Triangle / Y lies prone, Square / X uses a lift, R3 sprints (L3 too, while held)
        const gp = activePad();
        if (gp) { const pb: boolean[] = O.pb || (O.pb = []), hit = (i: number) => { const p = !!(gp.buttons[i] && gp.buttons[i].pressed), e = p && !pb[i]; pb[i] = p; return e; };
          if (hit(0)) W.jump = true; if (hit(1)) setStance('crouch'); if (hit(3)) setStance('prone'); if (hit(2)) O.liftPress = true; if (hit(11)) { W.sprint = !W.sprint; const sb = hud.querySelector('[data-mv="sprint"]'); if (sb) sb.classList.toggle('on', W.sprint); } }
        const st = STANCE[W.stance], sprinting = (inp.run || keys.has('shift') || W.sprint) && Math.hypot(inp.mx, inp.my) > 0.1;
        const cp0 = Math.cos(CAM.pitch), fw = SV.fw.set(Math.sin(CAM.yaw), 0, Math.cos(CAM.yaw)), rt = SV.rt.set(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw)), spd = (sprinting ? st.sprint : st.walk) * (W.ground ? 1 : 0.85) * dt;
        // a jump: up at 4.4 m/s (about a metre), from standing or crouching, only from the ground; landing from a crouch or prone stands you up first
        if (W.jump) { W.jump = false; if (W.ground) { if (W.stance !== 'stand') setStance(W.stance); else W.vy = 4.4, W.ground = false; } }
        W.vy = W.ground ? -0.5 : Math.max(-30, W.vy - 9.81 * dt);
        // the step along the floor and the fall (or the jump) are moved separately, so touching the floor doesn't eat the step
        const len = Math.min(1, Math.hypot(inp.mx, inp.my)), dir = fw.scaleToRef(inp.my, SV.dir).addInPlace(rt.scaleToRef(inp.mx, SV.tmp)); if (dir.lengthSquared() > 1e-6) dir.normalize();
        nearT -= dt; if (nearT <= 0) { nearT = 0.25; nearSolids(body.position, performance.now()); }
        lap('input'); body.moveWithCollisions(dir.scaleInPlace(len * spd));
        const y0 = body.position.y, dy = W.vy * dt; body.moveWithCollisions(SV.down.set(0, dy, 0)); W.ground = dy < 0 && body.position.y > y0 + dy + 0.001; if (body.position.y < y0 + dy - 0.001 || (dy > 0 && body.position.y < y0 + dy - 0.001)) W.vy = 0; if (W.ground) W.vy = 0;
        lap('walking'); if (body.position.y < elev - 40) { body.position.copyFrom(toWorld(75, 0.5, -21.5)); W.vy = 0; }
        W.eye += (st.eye - W.eye) * Math.min(1, dt * 9); cam.position.set(body.position.x, body.position.y + W.eye, body.position.z); cam.setTarget(cam.position.addToRef(SV.look.set(Math.sin(CAM.yaw) * cp0, Math.sin(CAM.pitch), Math.cos(CAM.yaw) * cp0), SV.target));
        // the doors open as you come to them
        const lp = Vector3.TransformCoordinatesToRef(body.position, SV.rootInv || (SV.rootInv = K.root.getWorldMatrix().clone().invert()), SV.lp); try { stepDoors(doors, lp.x, lp.z, lp.y > 3 ? 2 : 1, dt, now); } catch (e) { /* still */ }
        // the lifts: called as you come to them, and the ride (you go up and down with the car)
        try { const r = stepLifts(O.lifts, lp.x, lp.y, lp.z, dt, !!O.liftPress); O.liftPress = false; if (r.dy) { body.position.y += r.dy; W.vy = 0; W.ground = true; }
          const lh = hud.querySelector('.site-lift') as HTMLElement; if (lh) { lh.hidden = !r.hint; if (r.hint) lh.textContent = r.hint; } } catch (e) { /* still */ }
      } else {
      const sp = CAM.speed * (inp.run || keys.has('shift') ? 4 : 1) * dt, cp = Math.cos(CAM.pitch), f = new Vector3(Math.sin(CAM.yaw) * cp, Math.sin(CAM.pitch), Math.cos(CAM.yaw) * cp), r = new Vector3(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw));
      const mv = f.scale(inp.my).add(r.scale(inp.mx)), vert = (keys.has(' ') || keys.has('r') || CAM.up ? 1 : 0) - (keys.has('c') || keys.has('f') || CAM.down ? 1 : 0);
      CAM.x += mv.x * sp; CAM.z += mv.z * sp; CAM.y = Math.max(elev + 0.6, Math.min(12000, CAM.y + mv.y * sp + vert * sp));
      cam.position.set(CAM.x, CAM.y, CAM.z); cam.setTarget(cam.position.add(f));
      }
      lap('doors+lifts'); try { O.AFB.step(now); } catch (e) { /* still */ } lap('airfield');
      // the jetways: docking and undocking; on foot on a moving one you are carried with it; the warning beep near one moving
      try { const js: any[] = O.jetways || []; let ride: any = null, m0: any = null;
        if (walkMode && js.some(j => j.state === 'docking' || j.state === 'undocking')) { const hit = sc.pickWithRay(new Ray(body.position.add(new Vector3(0, 0.3, 0)), new Vector3(0, -1, 0), 1.2), (m: any) => !!(m.metadata && /^J-\d/.test(m.metadata.id || '')) && m !== body);
          if (hit && hit.pickedMesh) { ride = hit.pickedMesh; m0 = ride.computeWorldMatrix(true).clone(); } }
        for (const j of js) j.update(dt); for (const f of O.jwThin || []) f();
        if (ride) { const m1 = ride.computeWorldMatrix(true), p = Vector3.TransformCoordinates(Vector3.TransformCoordinates(body.position, m0.clone().invert()), m1); body.position.copyFrom(p); }
        if (js.some(j => j.moving && Vector3.Distance(cam.position, j.node.getAbsolutePosition()) < 45)) { if (now - (O.beepT || 0) > 1.1) { O.beepT = now; jwBeep(); } } } catch (e) { /* still */ }
      try { insides(cam.globalPosition); } catch (e) { /* all drawn */ }
      // the outer glazing: strong reflections seen from outside, a clear view out from inside (changed only on going in or out)
      if ((O.glT = (O.glT || 0) - dt) <= 0) { O.glT = 0.3; try { const gm = K.M.glassOuter; if (gm) {
        const lq = Vector3.TransformCoordinates(cam.globalPosition, SV.rootInv || (SV.rootInv = K.root.getWorldMatrix().clone().invert())), fl = lq.y > F2Y - 0.5 ? 2 : 1;
        let inside = ROOMS.some(r => r.f === fl && inRoom(r, lq.x, lq.z));
        if (!inside) { const up = sc.pickWithRay(new Ray(cam.globalPosition, Vector3.Up(), 4), (m: any) => !!(m.metadata && /^J-\d/.test(m.metadata.id || '')), true); inside = !!(up && up.hit); }
        glassLook(gm, inside); O.glIn = inside;
        // live reflections (off unless turned on): set up the first time they are wanted
        const gx: any = S.gfx, live = gx.reflMode === 'live' || gx.reflMode === 'both'; if (live && !O.GM) { const sky = sc.meshes.filter((m: any) => /^sky/i.test(m.name));
          const extra = () => sc.meshes.filter((m: any) => m.isEnabled() && m.isVisible && (/^AIRFIELD\//.test(m.name) || (O.AFB && m === O.AFB.ground)) && !/COLLIDE/.test(m.name));
          O.GM = glassMirrors(sc, cam, gm, sky, extra, (g: any) => glassLook(g, !!O.glIn)); }
        if (O.GM) { O.GM.tick(live, gx.liveReflQ || 0.5, inside, gx.liveJet !== false); for (const m of O.GM.mats()) glassLook(m, inside); } } } catch (e) { /* stays as it is */ } }
      lap('jetways'); wx.frame(dt, now); lap('weather');
      sc.render(); lap('drawing'); perfEnd();
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

/** The jetway's warning beep while it moves (a short tone). */
let jwAC: AudioContext | null = null;
function jwBeep() { try { const C = jwAC || (jwAC = new AudioContext()); const o = C.createOscillator(), g = C.createGain(); o.type = 'square'; o.frequency.value = 1250;
  g.gain.setValueAtTime(0.0001, C.currentTime); g.gain.exponentialRampToValueAtTime(0.05, C.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, C.currentTime + 0.28); o.connect(g); g.connect(C.destination); o.start(); o.stop(C.currentTime + 0.3); } catch (e) { /* no sound */ } }
