// The 3D viewer, as a demonstration: an airliner in the cruise at flight level 300 (30,000 ft) following its flight
// plan from Vágar to Copenhagen above a layer of volumetric clouds, the sun, the moon and the real stars where they
// are for the time and the place. The time of day runs (paused, as it is, 60×, 600×, 2000× or 3200×) and the slider moves the sun
// at once, so you can see how the light changes everything. Camera angles: behind, side, front, above, below, the
// left and right windows, the tail and a fly-by; drag (or the right stick, or the mouse) to look round, pinch, the
// wheel or the left stick to come closer.
import {
  Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, SpotLight, ShadowGenerator, GlowLayer, DefaultRenderingPipeline,
  ImageProcessingConfiguration, ReflectionProbe, RenderTargetTexture, ParticleSystem, DynamicTexture, Mesh, Matrix,
} from '@babylonjs/core';
import { registerSection, Section, SectionCtx } from '../../core/sections';
import { S } from '../../core/settings';
import { runLoop } from '../../core/engine';
import { inputFrame, activePad } from '../../core/input';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { icon, esc, toast } from '../../ui/icons';
import { perfAttach, perfDetach, perfShow, perfBegin, perfEnd } from '../../core/perf-meter';
import { makeSky, skyFrame, Sky } from './sky';
import { makePhotoMode } from './photo';
import { makeRealWx } from './realwx';
import { buildCabin, seatAt, FLOOR as CFLOOR, CABIN_VIEW_ROW, CABIN_AISLE_ROW, CABIN_Z } from './cabin';
import { buildAirliner, Airliner, repaint, setGear } from './airliner';
import { buildAirport, placeAirport, Airport } from './airport';
import { buildOwnAirport, isOwnLayout } from './own-airport';
import { buildCrash, Crash } from './crash';
import { buildTerrain, placeTerrain, terrainStale, Terrain } from './terrain';
import { gameSend, onGameFlight, onGameAirport } from '../../ui/game-frame';
import { sunAt, moonAt, dirOf, sunlight, lst } from './astro';
import { FROM, TO, ROUTE_M, gcAt, gcBrg, gcDist, D2R } from './route';

const FL = 9144, TAS = 231, MACH = 0.78;   // 30,000 ft, 449 knots
const CLOUDQ: { [k: string]: [number, number] } = { low: [18, 2], medium: [30, 3], high: [46, 4], ultra: [72, 6] };
interface View { id: string; label: string; orbit?: [number, number, number]; eye?: number[]; at?: number[]; flyby?: boolean; cabin?: boolean; walk?: boolean }
const SW = seatAt(CABIN_VIEW_ROW, 0), SA = seatAt(CABIN_AISLE_ROW, 2), EYE = CFLOOR + 1.17;
const VIEWS: View[] = [
  { id: 'chase', label: 'Behind', orbit: [0, 0.14, 64] },
  { id: 'side', label: 'Right side', orbit: [Math.PI / 2, 0.04, 60] },
  { id: 'sideL', label: 'Left side', orbit: [-Math.PI / 2, 0.04, 60] },
  { id: 'front', label: 'Front', orbit: [Math.PI * 0.9, 0.07, 54] },
  { id: 'top', label: 'Above', orbit: [0.5, 1.2, 72] },
  { id: 'below', label: 'Below', orbit: [0.7, -0.42, 48] },
  { id: 'winL', label: 'Left window', cabin: true, eye: [SW.x + 0.06, EYE, SW.z + 0.02], at: [-6, EYE - 0.55, SW.z + 1.6] },
  { id: 'winR', label: 'Right window', cabin: true, eye: [-SW.x - 0.06, EYE, SW.z + 0.02], at: [6, EYE - 0.55, SW.z + 1.6] },
  { id: 'aisle', label: 'Aisle seat', cabin: true, eye: [SA.x + 0.05, EYE, SA.z + 0.02], at: [-0.1, EYE - 0.25, SA.z + 12] },
  { id: 'cabin', label: 'Walk the cabin', cabin: true, walk: true },
  { id: 'tail', label: 'Tail', eye: [0, 8.6, -16.2], at: [0, 1.5, 14] },
  { id: 'flyby', label: 'Fly-by', flyby: true },
];
const V: any = { scene: null as Scene | null };

/* ---------- following a real flight of the game (yours, your airline's or another airline's) ---------- */
interface Sample { id: string; callsign: string; reg: string; type: string; from: string; to: string; fromName: string; toName: string; airline: string; color: string; color2: string;
  phase: string; pax: number; paxMax: number; gs: number; lat: number; lon: number; altM: number; hdg: number; vs: number; onGround: boolean; at: number }
onGameFlight((d: any) => {
  const L = V.live; if (!V.scene || !L) return;
  if (d.gone) { if (!L.goneSaid) { L.goneSaid = true; toast('This flight has ended'); const nx = (L.list || []).filter((x: any) => x.id !== L.id)[0]; if (nx) follow(nx.id); } return; }
  const me: Sample = Object.assign({}, d.me, { at: performance.now() });
  if (me.id !== L.id) return;
  L.s0 = L.s1 || me; L.s1 = me; wantAirports(me); L.list = d.list || []; L.near = d.near || []; L.goneSaid = false;
  const key = me.color + me.color2; if (L.painted !== key) { L.painted = key; try { repaint(V.ac, me.color, me.color2); if (V.cabin) V.cabin.paint(me.color, me.color2); } catch (e) { /* its own colours */ } }
});
/** The airports of the flight followed: asked of the game once each, built when their layout comes. */
function wantAirports(me: Sample) { const A = V.apts || (V.apts = {}); for (const k of [me.from, me.to]) if (k && !(k in A)) { A[k] = null; gameSend({ ampb: 'airport', icao: k }); } }
onGameAirport((d: any) => {
  if (!V.scene || !V.apts || !d.L || !(d.icao in V.apts)) return;
  try { const old: Airport = V.apts[d.icao]; if (old) old.dispose(); const A = isOwnLayout(d.L) ? buildOwnAirport(V.scene, d.L) : buildAirport(V.scene, d.L); V.apts[d.icao] = A;
    if (d.crash) { try { const c: Crash = buildCrash(V.scene, A.root, d.L, d.crash, { elev: A.elev, sea: (la: number, lo: number) => { try { const hh = V.ter ? V.ter.heightAt(la, lo) : null; return hh != null && hh < 0.6 && A.elev < 60 && !!(V.ter && (V.ter as any).isSea ? (V.ter as any).isSea(la, lo) : hh <= 0.1); } catch (e) { return false; } } }); (V.crashes = V.crashes || {})[d.icao] = c; const dis = A.dispose.bind(A); A.dispose = () => { try { c.dispose(); } catch (e) { /* gone */ } delete V.crashes[d.icao]; dis(); }; if (V.crashFocus === d.icao) V.crashAt = { A, c }; } catch (e) { console.error(e); } }
    else if (V.crashFocus === d.icao) toast('The crash site there has been cleared');
    if (V.aptFocus === d.icao && !V.crashAt) V.crashAt = { A, c: null }; farDiscs(); for (const l of A.lights) V.glow.addIncludedOnlyMesh(l); if (V.sg) A.root.getChildMeshes().forEach(m => m.receiveShadows = true); } catch (e) { console.error(e); }
});
/** The real ground under the flight (below 33,000 ft, when Real terrain is on): laid out again as the aircraft flies on. */
function terrainStep(lat: number, lon: number, alt: number) {
  const want = S.gfx.terrain && alt < 10000;
  if (!want) { if (V.ter) { V.ter.dispose(); V.ter = null; farDiscs(); } return; }
  if (!V.ter || terrainStale(V.ter, lat, lon)) { if (V.ter) V.ter.dispose(); V.ter = buildTerrain(V.scene, lat, lon); farDiscs(); const c = V.hud && V.hud.querySelector('.v3d-credit'); if (c) c.hidden = false; }
  placeTerrain(V.ter, lat, lon, alt);
}
/** The airports' wide grass round them only where there is no real terrain. */
function farDiscs() { for (const k in V.apts || {}) { const A: Airport = V.apts[k]; if (A) A.root.getChildMeshes().forEach(m => { if (m.name === 'aptFar') m.setEnabled(!V.ter); }); } }
/** The nearest airport built (within 40 km), for the ground's height under the aircraft. */
function nearAirport(lat: number, lon: number): Airport | null {
  let best: Airport | null = null, bd = 40000;
  for (const k in V.apts || {}) { const A: Airport = V.apts[k]; if (!A) continue; const d = Math.hypot((A.lon - lon) * 111320 * Math.cos(lat * D2R), (A.lat - lat) * 110540); if (d < bd) { bd = d; best = A; } }
  return best;
}
/** Follow another flight. */
function follow(id: string) { const L = V.live; if (!L) return; L.id = id; L.s0 = null; L.s1 = null; L.painted = ''; L.prev = null; gameSend({ ampb: 'follow', id }); }
/** Where the followed flight is now: between the last two positions the game sent (a quarter of a second behind, so
 *  it moves smoothly), its heading turning the short way. */
function liveState(now: number): Sample | null {
  const L = V.live, a: Sample = L.s0, b: Sample = L.s1; if (!b) return null;
  const span = Math.max(60, b.at - a.at), k = Math.max(0, Math.min(1, (now - b.at) / span));
  const lerp = (x: number, y: number) => x + (y - x) * k, dh = ((b.hdg - a.hdg + 540) % 360) - 180;
  return Object.assign({}, b, { lat: lerp(a.lat, b.lat), lon: lerp(a.lon, b.lon), altM: lerp(a.altM, b.altM), hdg: (a.hdg + dh * k + 360) % 360, vs: lerp(a.vs, b.vs), gs: lerp(a.gs, b.gs) });
}
/** The other aircraft near the one you follow, where they are (the same model; up to 16). */
function others(me: Sample) {
  const L = V.live, have: { [id: string]: any } = V.others || (V.others = {}), seen: { [id: string]: boolean } = {};
  const k = Math.cos(me.lat * D2R);
  for (const o of (L.near || []).slice(0, 16)) {
    seen[o.id] = true; let n = have[o.id];
    if (!n) { n = V.ac.root.instantiateHierarchy(null, undefined, (src: any, cl: any) => { if (cl.renderingGroupId !== undefined) cl.renderingGroupId = 1; }); if (!n) continue; have[o.id] = n; }
    n.position.set((o.lon - me.lon) * 111320 * k, (o.altM + (o.onGround ? 3.9 : 0)) - (me.altM + (me.onGround ? 3.9 : 0)), (o.lat - me.lat) * 110540);
    n.rotation.set(0, o.hdg * D2R, 0); n.setEnabled(true);
  }
  for (const id in have) if (!seen[id]) { have[id].dispose(); delete have[id]; }
}

function apply(what: string) {
  const sc: Scene = V.scene; if (!sc) return; const g = S.gfx, all = what === 'all' || what === 'preset';
  if (all || what === 'fov') V.cam.fov = g.fov * Math.PI / 180;
  if (all || what === 'shadows') {
    if (V.sg) { V.sg.dispose(); V.sg = null; }
    if (g.shadows !== 'off') { const sg = new ShadowGenerator(g.shadows === 'high' ? (IS_PC ? 4096 : 2048) : 1024, V.sun); sg.usePercentageCloserFiltering = true; sg.filteringQuality = g.shadows === 'high' ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_LOW; sg.bias = 0.0006; sg.normalBias = 0.03;
      for (const m of V.ac.casters) sg.addShadowCaster(m, false); V.sg = sg; }
  }
  if (all || what === 'probe') { V.probeOn = g.probe; V.sc.environmentIntensity = g.probe ? 1 : 0.35; }
  if (all || what === 'glow') V.glow.isEnabled = g.glow;
  const dp: DefaultRenderingPipeline = V.dp;
  if (all || what === 'aa') { dp.fxaaEnabled = g.aa === 'fxaa'; dp.samples = g.aa === 'msaa' ? 4 : 1; }
  if (all || what === 'bloom') { dp.bloomEnabled = g.bloom; dp.bloomThreshold = 0.85; dp.bloomWeight = 0.35; dp.bloomKernel = 64; dp.bloomScale = 0.5; }
  if (all || what === 'aces' || what === 'exposure') { dp.imageProcessingEnabled = true; const ip = dp.imageProcessing; ip.toneMappingEnabled = g.aces; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = g.exposure * 1.15; ip.contrast = 1.06; }
  if (all || what === 'sharpen') { dp.sharpenEnabled = g.sharpen; dp.sharpen.edgeAmount = 0.2; }
  if (all || what === 'particles') makeTrails();
  if (what === 'terrain' && !S.gfx.terrain && V.ter) { V.ter.dispose(); V.ter = null; farDiscs(); }
  if (all || what === 'clouds') { const q = CLOUDQ[g.clouds] || CLOUDQ.medium; V.steps = q[0]; V.lsteps = q[1]; }
  if (all || /^show(Fps|Cpu|Gpu|Mem)$/.test(what)) perfShow();
  V.envDirty = true;
}
/** The contrails: condensation forming a little way behind each engine and staying in the air as the aircraft flies on. */
function makeTrails() {
  for (const p of V.trails || []) p.dispose(); V.trails = [];
  const hi = S.gfx.particles === 'high', sc: Scene = V.scene;
  if (!V.trailTex) { const t = new DynamicTexture('puff', { width: 128, height: 128 }, sc, false), x = t.getContext() as CanvasRenderingContext2D, g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); t.hasAlpha = true; t.update(); V.trailTex = t; }
  for (const ex of V.ac.exhausts as Vector3[]) {
    const ps = new ParticleSystem('contrail', hi ? 2600 : 700, sc); ps.particleTexture = V.trailTex; ps.renderingGroupId = 1;
    ps.emitter = ex.clone(); ps.minEmitBox = new Vector3(-0.3, -0.3, 0); ps.maxEmitBox = new Vector3(0.3, 0.3, 0);
    ps.updateSpeed = 1 / 60; ps.minLifeTime = hi ? 5 : 3; ps.maxLifeTime = hi ? 7 : 4; ps.emitRate = hi ? 380 : 140;
    ps.minEmitPower = TAS * 0.995; ps.maxEmitPower = TAS * 1.005; ps.gravity = new Vector3(0, -1.2, 0);
    ps.addSizeGradient(0, 1.2); ps.addSizeGradient(0.15, 4.5); ps.addSizeGradient(1, 16);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD; ps.minAngularSpeed = -0.4; ps.maxAngularSpeed = 0.4;
    ps.start(); V.trails.push(ps);
  }
}
/** The light of the moment: where the sun and the moon are for the aircraft's position, the sunlight's colour, the
 *  stars, the light on the aircraft and the clouds. */
function sky(now: number) {
  const pos = V.pos, s = sunAt(V.t, pos[0], pos[1]), m = moonAt(V.t, pos[0], pos[1]), sd = dirOf(s), md = dirOf(m);
  const sc = sunlight(s.alt), phase = (1 - (sd[0] * md[0] + sd[1] * md[1] + sd[2] * md[2])) / 2;
  const moonK = m.alt > -1 ? 0.06 * phase * Math.min(1, (m.alt + 1) / 6) : 0, nightK = Math.max(0, Math.min(1, (-s.alt - 1) / 7));
  const lit = s.alt > -3 || moonK < 0.002 ? sd : md;
  let lc = s.alt > -3 ? sc : [moonK * 0.75, moonK * 0.85, moonK * 1.1];
  V.sunAlt = s.alt;
  const q = CLOUDQ[S.gfx.clouds] || CLOUDQ.medium, W = V.rwx, dk = W ? 1 - W.dark : 1;
  const lc0 = lc; lc = [lc0[0] * dk, lc0[1] * dk, lc0[2] * dk];
  skyFrame(V.sky, { sun: sd, sunCol: sc, moon: md, lit, litCol: lc, alt: (V.alt || FL) + V.cam.position.y, drift: V.drift, time: now, cover: W ? W.cover : 0.82, base: W ? W.base : 2100, top: W ? W.top : 5600, steps: V.steps || q[0], lsteps: V.lsteps || q[1],
    lat: pos[0] * D2R, lst: lst(V.t, pos[1]) * D2R, starK: Math.min(1.4, nightK * 1.4), nightK, gnd: V.gnd || 0, landK: V.land || 0 });
  // the sun (or the moon) on the aircraft, its shadows, the sky's light from above and the clouds' from below
  const L: DirectionalLight = V.sun, ld = new Vector3(-lit[0], -lit[1], -lit[2]), mx = Math.max(lc[0], lc[1], lc[2], 1e-4);
  L.direction = ld; L.position = new Vector3(lit[0] * 120, lit[1] * 120, lit[2] * 120);
  L.diffuse = new Color3(lc[0] / mx, lc[1] / mx, lc[2] / mx); L.specular = L.diffuse; L.intensity = mx * 3.4;
  L.shadowEnabled = mx > 0.02;
  const day = Math.max(0, Math.min(1, (s.alt + 6) / 16));
  const H: HemisphericLight = V.hemi; H.diffuse = Color3.Lerp(new Color3(0.02, 0.03, 0.07), new Color3(0.42, 0.56, 0.86), day); H.groundColor = Color3.Lerp(new Color3(0.02, 0.02, 0.04), new Color3(0.85, 0.82, 0.78).scale(0.6 + 0.4 * sc[1]), day);
  H.intensity = (0.25 + 0.55 * day + moonK * 2) * (1 - (W ? W.dark : 0) * 0.6);
  // the logo lights on the fin, at dusk and at night
  V.logoLight.intensity = s.alt < 4 ? 14 * Math.min(1, (4 - s.alt) / 6) : 0;
  // the contrails take the colour of the light
  const tc = new Color4(Math.min(1, lc[0] * 0.9 + H.diffuse.r * H.intensity * 0.6 + 0.03), Math.min(1, lc[1] * 0.9 + H.diffuse.g * H.intensity * 0.6 + 0.03), Math.min(1, lc[2] * 0.9 + H.diffuse.b * H.intensity * 0.6 + 0.04), 0.5);
  for (const p of V.trails || []) { p.color1 = tc; p.color2 = tc; p.colorDead = new Color4(tc.r, tc.g, tc.b, 0); }
}
function fmtTime(ms: number, offH: number): string { const d = new Date(ms + offH * 3600000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; }
/** Local solar time at the aircraft (minutes in the day): the sun is highest at 12:00. */
function localMin(): number { const d = new Date(V.t); return ((d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + V.pos[1] * 4) % 1440 + 1440) % 1440; }
function setLocalMin(v: number) { const now = localMin(); let dm = v - now; if (dm > 720) dm -= 1440; if (dm < -720) dm += 1440; V.t += dm * 60000; V.envDirty = true; }
/** A moment today when the sun is setting where the aircraft is, so the flight opens above the clouds at sunset. */
function sunsetStart(): number {
  const d = new Date(), day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), p = V.pos;
  let prev = sunAt(day0 + 12 * 3600000, p[0], p[1]).alt;
  for (let m = 12 * 60 + 5; m < 24 * 60; m += 5) { const a = sunAt(day0 + m * 60000, p[0], p[1]).alt; if (prev >= 5 && a < 5) return day0 + m * 60000; prev = a; }
  return day0 + 17 * 3600000;
}

function hudHtml(): string {
  return `<div class="v3d ${V.live ? 'live' : ''}">
    <div class="v3d-top">
      ${V.live ? `<button class="v3d-b v3d-game" data-v="game" aria-label="Back to the game">${icon('back')}<span>Back to the game</span></button>` : ''}
      <button class="v3d-b v3d-site" data-v="site" aria-label="To the airport: your gate, gate 4">${icon('mountain')}<span>Airport</span></button>
      <button class="v3d-b v3d-photo" data-v="photo" aria-label="Photo mode: looks, a wide frame, depth of field, a caption"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 8h3l2-3h6l2 3h3v11H4V8Zm8 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/></svg><span>Photo mode</span></button>
      <button class="v3d-b v3d-rwx on" data-v="rwx" aria-label="Real weather: the nearest airport report, on or off"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M7 16h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.2 3.2 0 0 0 7 16Zm1 3-1 2m5-2-1 2m5-2-1 2"/></svg><span>Real weather</span></button>
      <div class="v3d-info"><div class="v3d-csr">${V.live ? `<button class="v3d-b v3d-pk" data-v="prev" aria-label="The previous flight">‹</button>` : ''}<b class="v3d-cs">${V.live ? 'Waiting for the flight…' : `AMP 214 · ${esc(FROM.name)} → ${esc(TO.name)}`}</b>${V.live ? `<button class="v3d-b v3d-pk" data-v="next" aria-label="The next flight">›</button>` : ''}</div><small class="v3d-al"></small><div class="v3d-rows"></div></div>
    </div>
    <div class="v3d-views" role="toolbar" aria-label="Camera">${VIEWS.map((v, i) => `<button class="v3d-b ${i === 0 ? 'on' : ''}" data-view="${v.id}">${esc(v.label)}</button>`).join('')}</div>
    <div class="v3d-time">
      <div class="v3d-clock">${icon('clock')}<b class="v3d-lt">--:--</b><small class="v3d-sub"></small></div>
      <input class="v3d-slider" type="range" min="0" max="1439" step="1" aria-label="Time of day (demo): moves the sun">
      <div class="v3d-speed">${[[0, 'Pause'], [1, '1×'], [60, '60×'], [600, '600×'], [2000, '2000×'], [3200, '3200×']].map(([k, l]) => `<button class="v3d-b ${k === 60 ? 'on' : ''}" data-speed="${k}">${l}</button>`).join('')}</div>
      <small class="v3d-demo">Demo: drag the slider to move the sun</small>
    </div>
    <small class="v3d-wxchip">Real weather: looking for a report…</small>
    <div class="v3d-perf"></div>
    <small class="v3d-credit" hidden>Terrain: Terrain Tiles on AWS (SRTM, GMTED2010, ETOPO1, 3DEP, EU-DEM) · imagery: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0)</small>
  </div>`;
}
function setView(id: string) {
  const i = VIEWS.findIndex(v => v.id === id); if (i < 0) return; V.view = VIEWS[i]; V.uYaw = 0; V.uPitch = 0; V.zoom = 1; V.blend = 0;
  if (V.view.flyby) placeFlyby();
  V.hud.querySelectorAll('[data-view]').forEach((b: Element) => b.classList.toggle('on', b.getAttribute('data-view') === id));
}
/** The fly-by: a point in the air ahead of the aircraft and to one side; the aircraft flies past it. */
function placeFlyby() {
  const h = V.hdg * D2R, f = new Vector3(Math.sin(h), 0, Math.cos(h)), r = new Vector3(Math.cos(h), 0, -Math.sin(h)), side = Math.random() < 0.5 ? 1 : -1;
  V.fb = f.scale(520).add(r.scale(side * (38 + Math.random() * 30))).add(new Vector3(0, -6 + Math.random() * 16, 0));
}
function setSpeed(k: number) { V.speed = k; V.hud.querySelectorAll('[data-speed]').forEach((b: Element) => b.classList.toggle('on', Number(b.getAttribute('data-speed')) === k)); }

const Viewer: Section = {
  id: 'viewer3d', title: '3D viewer',
  async open(ctx: SectionCtx) {
    const { engine, ui, progress } = ctx; V.ctx = ctx;
    const crashIcao = ctx.opts && ctx.opts.crash; V.crashFocus = crashIcao || ''; V.crashAt = null; V.crashes = {};
    if (crashIcao) { V.apts = V.apts || {}; V.apts[crashIcao] = null; gameSend({ ampb: 'airport', icao: crashIcao }); }
    const liveId = ctx.opts && ctx.opts.live; V.live = liveId ? { id: liveId, s0: null, s1: null, list: [], near: [], painted: '', prev: null } : null; V.others = {}; V.turn = 0; V.cur = null;
    if (liveId) gameSend({ ampb: 'follow', id: liveId });
    V.apts = {}; const aptIcao = ctx.opts && ctx.opts.apt; V.aptFocus = aptIcao || ''; if (aptIcao) { V.apts[aptIcao] = null; gameSend({ ampb: 'airport', icao: aptIcao }); } V.gnd = 0; V.land = 0; V.ter = null;
    progress(10, 'Filling the sky…'); await new Promise(r => setTimeout(r, 30));
    const sc = new Scene(engine); V.scene = sc; V.sc = sc; sc.clearColor = new Color4(0, 0, 0, 1); sc.skipPointerMovePicking = true;
    V.frac = 0.14; V.pos = gcAt([FROM.lat, FROM.lon], [TO.lat, TO.lon], V.frac); V.hdg = gcBrg(V.pos, [TO.lat, TO.lon]); V.drift = [0, 0];
    V.t = V.live ? Date.now() : sunsetStart(); V.speed = V.live ? 1 : 60;
    V.sky = makeSky(sc) as Sky;
    progress(40, 'Building the aircraft…'); await new Promise(r => setTimeout(r, 30));
    const ac = buildAirliner(sc) as Airliner; V.ac = ac;
    ac.root.getChildMeshes().forEach(m => { m.renderingGroupId = 1; });
    V.hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), sc);
    V.sun = new DirectionalLight('sun', new Vector3(0, -1, 0), sc); V.sun.autoUpdateExtends = true; V.sun.shadowMinZ = 1; V.sun.shadowMaxZ = 260;
    const ll = new SpotLight('logo', new Vector3(0, 1.0, -15.6), new Vector3(0, 0.75, 0.66).normalize(), 1.1, 2, sc); ll.diffuse = Color3.FromHexString('#FFF1D6'); ll.range = 14; ll.parent = ac.root; V.logoLight = ll;
    V.cabin = buildCabin(sc, ac.root, [V.hemi, V.sun, ll]); V.fuse = ac.root.getChildMeshes().filter(m => m.name === 'fuselage');
    // the landing and taxi lights, ahead of the nose
    const tl = new SpotLight('taxiL', new Vector3(0, -1.7, 13.5), new Vector3(0, -0.1, 1).normalize(), 0.7, 6, sc); tl.intensity = 90; tl.range = 900; tl.diffuse = Color3.FromHexString('#FFF6E6'); tl.parent = ac.root; tl.setEnabled(false); V.taxiL = tl;
    setGear(ac, 0);
    const cam = new UniversalCamera('cam', new Vector3(0, 8, -64), sc); cam.minZ = 0.3; cam.maxZ = 20000; cam.inertia = 0; V.cam = cam; sc.activeCamera = cam;
    progress(70, 'Lighting the clouds…');
    // reflections of the sky on the paint: the dome seen from the aircraft, refreshed as the light changes
    const pr = new ReflectionProbe('env', IS_PC ? 256 : 128, sc, true, true); pr.renderList.push(V.sky.dome); pr.position = Vector3.Zero(); pr.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE; V.probe = pr;
    sc.environmentTexture = pr.cubeTexture;
    V.glow = new GlowLayer('glow', sc, { mainTextureRatio: IS_PC ? 0.5 : 0.35, blurKernelSize: 40 }); V.glow.intensity = 1.1;
    for (const m of [...ac.navs, ...ac.strobes, ...ac.beacons, ...ac.logo]) V.glow.addIncludedOnlyMesh(m as Mesh);
    V.dp = new DefaultRenderingPipeline('dp', true, sc, [cam]);
    apply('all');
    // the controls on the screen
    const hud = document.createElement('div'); hud.className = 'hud v3d-hud'; hud.innerHTML = hudHtml(); ui.appendChild(hud); V.hud = hud;
    // photo mode: looks, a wide frame, depth of field (focused on the aircraft), a caption, and the picture
    V.photo = makePhotoMode({ hud, root: document.body, engine, canvas: ctx.canvas, dp: () => V.dp, cam: () => V.cam, focus: () => (V.cam && V.ac ? V.cam.globalPosition.subtract(V.ac.root.getAbsolutePosition()).length() : 300), caption: () => '' });
    V.rwx = makeRealWx(sc, () => V.cam, hud);
    // in the cabin: tap someone to hear what they say (a bubble over them, with a button to hear it)
    const says = document.createElement('div'); says.className = 'cab-says'; hud.appendChild(says); V.says = says;
    says.addEventListener('click', (e: Event) => { const b = (e.target as HTMLElement).closest('[data-speak]') as HTMLElement; if (!b) return; e.stopPropagation(); try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(b.getAttribute('data-speak') || ''); u.lang = 'en-GB'; speechSynthesis.speak(u); } catch (err) { /* no voice */ } });
    let td: any = null; V.tdn = (e: PointerEvent) => { td = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    V.tup = (e: PointerEvent) => { if (!td || !V.inCabin || !V.cabin) { td = null; return; } const moved = Math.hypot(e.clientX - td.x, e.clientY - td.y), quick = performance.now() - td.t < 350; td = null; if (moved > 8 || !quick) return;
      const cv = ctx.canvas, en = sc.getEngine(), px = (e.clientX - cv.getBoundingClientRect().left) * en.getRenderWidth() / cv.clientWidth, py = (e.clientY - cv.getBoundingClientRect().top) * en.getRenderHeight() / cv.clientHeight;
      const hit = sc.pick(px, py, (m: any) => m.isPickable && m.isEnabled() && m.isDescendantOf(V.cabin.root)); if (hit && hit.hit && hit.pickedMesh) V.cabin.talk(hit.pickedMesh, hit.thinInstanceIndex == null ? -1 : hit.thinInstanceIndex); };
    ctx.canvas.addEventListener('pointerdown', V.tdn); ctx.canvas.addEventListener('pointerup', V.tup);
    perfAttach(engine, sc, hud.querySelector('.v3d-perf') as HTMLElement); perfShow();
    hud.addEventListener('click', (e: Event) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLElement; if (!b) return;
      if (b.hasAttribute('data-view')) setView(b.getAttribute('data-view') as string);
      else if (b.hasAttribute('data-speed')) setSpeed(Number(b.getAttribute('data-speed')));
      else if (b.getAttribute('data-v') === 'game' && ctx.toGame) ctx.toGame();
      else if (b.getAttribute('data-v') === 'photo' && V.photo) V.photo.toggle();
      else if (b.getAttribute('data-v') === 'rwx' && V.rwx) { const on = V.rwx.toggle(); b.classList.toggle('on', on); toast(on ? 'Real weather on: the nearest airport report' : 'Real weather off'); }
      else if (b.getAttribute('data-v') === 'site' && ctx.goTo) ctx.goTo('site', { site: 'myrdalssandur', view: 'carpark' });
      else if ((b.getAttribute('data-v') === 'prev' || b.getAttribute('data-v') === 'next') && V.live) { const l = V.live.list || [], i = l.findIndex((x: any) => x.id === V.live.id); if (l.length) follow(l[(i + (b.getAttribute('data-v') === 'next' ? 1 : l.length - 1) + l.length) % l.length].id); }
    });
    const sl = hud.querySelector('.v3d-slider') as HTMLInputElement; V.slider = sl;
    sl.addEventListener('input', () => { V.sliding = true; setLocalMin(Number(sl.value)); });
    sl.addEventListener('change', () => { V.sliding = false; });
    sl.addEventListener('pointerup', () => { V.sliding = false; });
    setView('chase');
    toast(IS_TOUCH ? 'Drag on the right to look round · the left thumb comes closer' : 'Click the view and move the mouse to look round · the wheel zooms · 1–9 change the camera');
    // the wheel, the keys and the controller's shoulder buttons
    V.wheel = (e: WheelEvent) => { V.zoom = Math.max(0.35, Math.min(4, V.zoom * Math.exp(e.deltaY * 0.0012))); e.preventDefault(); };
    ctx.canvas.addEventListener('wheel', V.wheel, { passive: false });
    V.key = (e: KeyboardEvent) => {
      if (!V.scene || (e.target as HTMLElement).tagName === 'INPUT') return;
      const n = Number(e.key); if (n >= 1 && n <= VIEWS.length) setView(VIEWS[n - 1].id);
      else if (e.key.toLowerCase() === 'v') setView(VIEWS[(VIEWS.indexOf(V.view) + 1) % VIEWS.length].id);
      else if (e.key === ' ') setSpeed(V.speed ? 0 : 60);
      else if (e.key === ']') setLocalMin((localMin() + 30) % 1440); else if (e.key === '[') setLocalMin((localMin() + 1410) % 1440);
    };
    window.addEventListener('keydown', V.key);
    const pb: boolean[] = [];
    V.uYaw = 0; V.uPitch = 0; V.zoom = 1; V.blend = 0; let envT = 0, infoT = 0, fbPrev = 0;
    runLoop(() => {
      perfBegin();
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000), now = performance.now() / 1000;
      // the controller: L1 / R1 change the camera, the D-pad left and right move the sun
      const g = activePad();
      if (g) { const press = (i: number) => { const p = !!(g.buttons[i] && g.buttons[i].pressed), e = p && !pb[i]; pb[i] = p; return e; };
        if (press(4)) setView(VIEWS[(VIEWS.indexOf(V.view) + VIEWS.length - 1) % VIEWS.length].id); if (press(5)) setView(VIEWS[(VIEWS.indexOf(V.view) + 1) % VIEWS.length].id);
        if (g.buttons[14] && g.buttons[14].pressed) setLocalMin((localMin() + 1440 - 90 * dt) % 1440); if (g.buttons[15] && g.buttons[15].pressed) setLocalMin((localMin() + 90 * dt) % 1440); }
      // the time of day, and the flight along its plan
      if (!V.sliding) V.t += dt * 1000 * V.speed;
      let hdg: number, h: number, bank = 0, pitch = -0.035, fan = 48;
      const r = ac.root;
      if (V.crashAt) {
        // a crash site: the camera on the wreck from a little way off, the aircraft out of sight
        const { A, c } = V.crashAt as { A: Airport; c: Crash }; ac.root.setEnabled(false);
        V.pos = [A.lat, A.lon]; V.gnd = A.elev; V.land = 1; V.alt = A.elev + 3.9; V.spd = 0; hdg = 0;
        for (const k in V.apts) if (V.apts[k]) placeAirport(V.apts[k], A.lat, A.lon, V.alt, V.sunAlt < 2);
        terrainStep(A.lat, A.lon, V.alt); r.position.y = 0;
      } else if (V.live) {
        // the real flight: where the game says it is
        const st = liveState(performance.now()); V.cur = st;
        if (st) {
          const L = V.live, pv = L.prev, na = nearAirport(st.lat, st.lon); V.pos = [st.lat, st.lon];
          const th = V.ter ? V.ter.heightAt(st.lat, st.lon) : null; V.gnd = na ? na.elev : th != null ? th : 0; V.land = na || (th != null && th > 1) ? 1 : 0;
          V.alt = st.onGround ? V.gnd + 3.9 : Math.max(st.altM, V.gnd + 3.9); V.spd = Math.max(0, st.gs || 0) * 0.5144;
          // the gear: down on the ground and low on the way in or out, up in the climb and the cruise (8 seconds)
          const agl = V.alt - V.gnd, want = st.onGround || agl < 750 ? 1 : 0; setGear(ac, Math.max(0, Math.min(1, ac.gearK + Math.sign(want - ac.gearK) * dt / 8)));
          for (const k in V.apts) if (V.apts[k]) placeAirport(V.apts[k], st.lat, st.lon, V.alt, V.sunAlt < 2);
          if (V.taxiL) V.taxiL.setEnabled(V.sunAlt < 4 && agl < 1500);
          terrainStep(st.lat, st.lon, V.alt);
          if (pv) { V.drift[0] += (st.lon - pv.lon) * 111320 * Math.cos(st.lat * D2R); V.drift[1] += (st.lat - pv.lat) * 110540; const dh = ((st.hdg - pv.hdg + 540) % 360) - 180; V.turn = V.turn * 0.9 + (dt > 0 ? dh / dt : 0) * 0.1; }
          L.prev = { lat: st.lat, lon: st.lon, hdg: st.hdg };
          hdg = st.hdg; bank = st.onGround ? 0 : Math.max(-0.45, Math.min(0.45, (V.turn || 0) / 3 * 0.44));
          pitch = st.onGround ? 0 : -0.035 - Math.max(-0.28, Math.min(0.28, Math.atan2((st.vs || 0) * 0.00508, Math.max(40, V.spd))));
          fan = st.onGround && V.spd < 2 ? 6 : 48;
          others(st);
        } else hdg = V.hdg || 0;
        V.t = Date.now();
        r.position.y = 0;
      } else {
        V.frac += TAS * dt / ROUTE_M; if (V.frac > 0.93) { V.frac = 0.08; toast('Back at the start of the cruise'); }
        V.pos = gcAt([FROM.lat, FROM.lon], [TO.lat, TO.lon], V.frac); V.alt = FL; V.spd = TAS;
        hdg = gcBrg(V.pos, [TO.lat, TO.lon]); const hh = hdg * D2R;
        V.drift[0] += Math.sin(hh) * TAS * dt; V.drift[1] += Math.cos(hh) * TAS * dt;
        bank = Math.sin(now * 0.31) * 0.012 + Math.sin(now * 1.7) * 0.003; pitch = -0.035 + Math.sin(now * 0.23) * 0.006;
        r.position.y = Math.sin(now * 0.4) * 0.35 + Math.sin(now * 2.3) * 0.05;
      }
      V.hdg = hdg; h = hdg * D2R;
      // the aircraft: its heading, bank and pitch
      r.rotation.y = h; r.rotation.z = -bank; r.rotation.x = pitch;
      for (const f of ac.fans) f.rotation.z += dt * fan;
      const strobe = (now % 1.25), on = strobe < 0.05 || (strobe > 0.12 && strobe < 0.17); for (const m of ac.strobes) m.isVisible = on;
      const bc = Math.max(0, 1 - Math.abs(((now % 1.05) - 0.08) / 0.1)); for (const m of ac.beacons) m.visibility = bc;
      for (const m of ac.logo) m.isVisible = V.sunAlt < 4;
      // the contrails leave from where the engines are now
      r.computeWorldMatrix(true); const wm = r.getWorldMatrix(), back = Vector3.TransformNormal(new Vector3(0, 0, -1), wm).normalize();
      const trailsOn = (V.alt || FL) > 7600;
      (V.trails || []).forEach((p: ParticleSystem, i: number) => { p.emitter = Vector3.TransformCoordinates(ac.exhausts[i].add(new Vector3(0, 0, -26)), wm); p.direction1 = back; p.direction2 = back; p.emitRate = trailsOn ? (S.gfx.particles === 'high' ? 380 : 140) : 0; p.minEmitPower = (V.spd || TAS) * 0.995; p.maxEmitPower = (V.spd || TAS) * 1.005; });
      // the camera
      const inp = inputFrame(dt), v: View = V.view;
      V.uYaw += inp.lx; V.uPitch = Math.max(-1.3, Math.min(1.3, V.uPitch + inp.ly)); V.zoom = Math.max(0.35, Math.min(4, V.zoom * Math.exp(-inp.my * dt * 1.4)));
      let eye: Vector3, at: Vector3;
      if (v.orbit) {
        const yaw = v.orbit[0] + V.uYaw, p = Math.max(-1.45, Math.min(1.45, v.orbit[1] + V.uPitch)), d = v.orbit[2] * V.zoom;
        const loc = new Vector3(Math.sin(yaw) * Math.cos(p) * d, Math.sin(p) * d, -Math.cos(yaw) * Math.cos(p) * d);
        at = Vector3.TransformCoordinates(new Vector3(0, 0.5, -1.5), wm); eye = at.add(Vector3.TransformNormal(loc, Matrix.RotationY(h)));
      } else if (v.walk) {
        // walking the cabin: forward and back along the aisle (and across at the galleys), looking round as you like
        const cw = V.cw || (V.cw = { x: 0, z: CABIN_Z.front - 1.5 }), yaw = V.uYaw, pt = V.uPitch * 0.8;
        const sp = (inp.run ? 1.6 : 0.9) * dt, fx = Math.sin(yaw), fz = Math.cos(yaw);
        cw.x += (fx * inp.my + fz * inp.mx) * sp; cw.z += (fz * inp.my - fx * inp.mx) * sp;
        cw.z = Math.max(CABIN_Z.back, Math.min(CABIN_Z.front, cw.z)); const galley = cw.z > CABIN_Z.front - 0.7 || cw.z < CABIN_Z.back + 0.7; cw.x = Math.max(galley ? -1.2 : -0.2, Math.min(galley ? 1.2 : 0.2, cw.x));
        const e = new Vector3(cw.x, CFLOOR + 1.62, cw.z), d = new Vector3(Math.sin(yaw) * Math.cos(pt), Math.sin(pt), Math.cos(yaw) * Math.cos(pt));
        eye = Vector3.TransformCoordinates(e, wm); at = Vector3.TransformCoordinates(e.add(d), wm); V.zoom = 1;
      } else if (v.eye) {
        eye = Vector3.TransformCoordinates(Vector3.FromArray(v.eye), wm);
        const lt = Vector3.FromArray(v.at as number[]), ly = Matrix.RotationYawPitchRoll(V.uYaw * 0.8, V.uPitch * 0.8, 0);
        at = Vector3.TransformCoordinates(Vector3.TransformCoordinates(lt.subtract(Vector3.FromArray(v.eye)), ly).add(Vector3.FromArray(v.eye)), wm);
      } else {
        // the point in the air moves back past the aircraft as it flies on
        V.fb = V.fb.subtract(new Vector3(Math.sin(h), 0, Math.cos(h)).scale((V.spd || TAS) * dt)); eye = V.fb;
        const ahead = Vector3.Dot(V.fb, new Vector3(Math.sin(h), 0, Math.cos(h))); if (ahead < -420 && fbPrev >= -420) placeFlyby(); fbPrev = ahead;
        at = Vector3.TransformCoordinates(new Vector3(0, 0, 0), wm);
      }
      if (V.crashAt) { const c: Crash = V.crashAt.c; let ctr: Vector3; if (c) { c.root.computeWorldMatrix(true); ctr = Vector3.TransformCoordinates(c.centre, c.root.getWorldMatrix()); } else { const A2: Airport = V.crashAt.A; A2.root.computeWorldMatrix(true); ctr = A2.root.getAbsolutePosition().clone(); } const yaw = 0.7 + V.uYaw, pp = Math.max(0.08, Math.min(1.3, (c ? 0.3 : 0.55) + V.uPitch)), d = (c ? 230 : 1600) * V.zoom;
        at = ctr; eye = ctr.add(new Vector3(Math.cos(yaw) * Math.cos(pp) * d, Math.sin(pp) * d, Math.sin(yaw) * Math.cos(pp) * d)); }
      V.blend = v.cabin || V.inCabin ? 1 : Math.min(1, V.blend + dt * 2.2);   // straight into the cabin and out, no glide through the fuselage
      if (V.blend < 1 && V.lastEye) { const k = V.blend * V.blend * (3 - 2 * V.blend); eye = Vector3.Lerp(V.lastEye, eye, k); at = Vector3.Lerp(V.lastAt, at, k); }
      if (V.blend >= 1) { V.lastEye = eye.clone(); V.lastAt = at.clone(); }
      if (!!v.cabin !== !!V.inCabin) { V.inCabin = !!v.cabin; if (V.cabin) V.cabin.show(V.inCabin); for (const m of V.fuse || []) m.setEnabled(!V.inCabin); cam.minZ = V.inCabin ? 0.05 : 0.3; }
      if (V.cabin && V.inCabin) { const st2: any = V.cur, ph = st2 ? st2.phase || '' : 'Cruise', agl = (V.alt || FL) - (V.gnd || 0);
        V.cabin.frame(dt, { phase: ph, pax: st2 ? st2.pax || 0 : 0, paxMax: st2 ? st2.paxMax || 0 : 0, onGround: st2 ? !!st2.onGround : false, night: V.sunAlt < -4, cruise: agl > 6000 && Math.abs(st2 ? st2.vs || 0 : 0) < 600, descent: st2 ? (st2.vs || 0) < -600 : false }); }
      cam.position.copyFrom(eye); cam.setTarget(at);
      V.sky.dome.position.copyFrom(cam.position);
      if (V.rwx) V.rwx.frame(dt, { lat: V.pos[0], lon: V.pos[1], alt: (V.alt || FL) + cam.position.y, gnd: V.gnd || 0, drift: V.drift });
      sky(now);
      // the sky's reflection on the paint: refreshed now and then, and at once when the slider moves
      if (V.probeOn && (V.envDirty || now > envT)) { pr.cubeTexture.resetRefreshCounter(); envT = now + (V.speed >= 2000 ? 0.2 : V.speed >= 600 ? 0.4 : 1.2); V.envDirty = false; }
      if (now > infoT) { infoT = now + 0.25; info(); const wc = V.hud && V.hud.querySelector('.v3d-wxchip'); if (wc && V.rwx) wc.textContent = V.rwx.chip(); }
      if (V.crashes) { const night = Math.max(0, Math.min(1, (-(V.sunAlt || 0) + 2) / 8)), rw = V.rwx && V.rwx.on() ? V.drift : null; for (const k in V.crashes) V.crashes[k].step(now, night, rw ? [3, 1] : [2, 1]); }
      // the cabin's bubbles, over whoever is speaking
      if (V.says) { const bs = V.inCabin && V.cabin ? V.cabin.bubbles : [];
        if (!bs.length) { if (V.says.childElementCount) V.says.innerHTML = ''; }
        else { const en = sc.getEngine(), W = en.getRenderWidth(), H = en.getRenderHeight(), cw = ctx.canvas.clientWidth / W, ch = ctx.canvas.clientHeight / H, wm2 = V.cabin.root.getWorldMatrix(), tm = sc.getTransformMatrix(), vp = cam.viewport.toGlobal(W, H);
          const key = bs.map((b: any) => b.who + b.text).join('|'); if (V.saysKey !== key) { V.saysKey = key; V.says.innerHTML = bs.map((b: any) => `<div class="cab-say"><b>${esc(b.who)}</b><span>${esc(b.text)}</span><button class="cab-play" data-speak="${esc(b.text)}" aria-label="Hear it">▶</button></div>`).join(''); }
          bs.forEach((b: any, i: number) => { const el = V.says.children[i] as HTMLElement; if (!el) return; const w = Vector3.TransformCoordinates(b.at, wm2), p = Vector3.Project(w, Matrix.Identity(), tm, vp), vis = p.z > 0 && p.z < 1;
            el.style.display = vis ? '' : 'none'; el.style.transform = `translate(${p.x * cw}px, ${p.y * ch}px) translate(-50%, -100%)`; }); } }
      if (V.photo) V.photo.frame();
      sc.render();
      perfEnd();
    });
  },
  close() {
    const sc: Scene = V.scene; if (!sc) return;
    try { if (V.rwx) { V.rwx.dispose(); V.rwx = null; } } catch (e) { /* gone */ }
    try { V.ctxCanvas && 0; const cv: HTMLCanvasElement = (V.scene && V.scene.getEngine().getRenderingCanvas()) as HTMLCanvasElement; if (cv) { cv.removeEventListener('pointerdown', V.tdn); cv.removeEventListener('pointerup', V.tup); } speechSynthesis.cancel(); } catch (e) { /* gone */ }
    try { if (V.cabin) { V.cabin.dispose(); V.cabin = null; } V.inCabin = false; V.cw = null; V.fuse = null; } catch (e) { /* gone */ }
    try { if (V.photo) { V.photo.dispose(); V.photo = null; } document.body.classList.remove('photo-on'); } catch (e) { /* gone */ }
    try { V.ctx.canvas.removeEventListener('wheel', V.wheel); } catch (e) { /* gone */ }
    window.removeEventListener('keydown', V.key);
    if (V.live) { gameSend({ ampb: 'stop' }); V.live = null; } V.others = {}; V.apts = {}; if (V.ter) { V.ter.dispose(); V.ter = null; }
    perfDetach(); if (V.hud) V.hud.remove(); V.trails = []; V.trailTex = null; sc.dispose(); V.scene = null;
  },
  onSettings(what: string) { apply(what === 'preset' ? 'all' : what); },
};
/** The flight's numbers and the time, on the screen. */
function info() {
  const hud: HTMLElement = V.hud; if (!hud) return;
  const lat = V.pos[0], lon = V.pos[1];
  const ll = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  const st: Sample = V.cur;
  if (V.live) {
    if (!st) return;
    const ft = Math.round(st.altM / 0.3048), alt = st.onGround ? 'On the ground' : ft >= 18000 ? `FL${String(Math.round(ft / 100)).padStart(3, '0')}` : `${ft.toLocaleString('en-GB')} ft`;
    (hud.querySelector('.v3d-cs') as HTMLElement).textContent = `${st.callsign} · ${st.fromName} → ${st.toName}`;
    (hud.querySelector('.v3d-al') as HTMLElement).textContent = [st.airline, st.type ? st.type.toUpperCase() : '', st.reg].filter(Boolean).join(' · ');
    (hud.querySelector('.v3d-rows') as HTMLElement).innerHTML = [
      ['Altitude', alt], ['Speed', `${Math.round(st.gs || 0)} kt`], ['Heading', `${String(Math.round(st.hdg) % 360).padStart(3, '0')}°`],
      ['Position', ll], ['Route', `${esc(st.from)} → ${esc(st.to)}`], ['Phase', esc(st.phase || '—')], ['Passengers', st.paxMax ? `${st.pax} / ${st.paxMax}` : String(st.pax || 0)],
      ['Climb', `${st.vs > 0 ? '+' : ''}${Math.round(st.vs || 0)} ft/min`],
    ].map(([k, v]) => `<span><small>${k}</small><b>${v}</b></span>`).join('');
  } else {
  const left = gcDist(V.pos, [TO.lat, TO.lon]) / 1852;
  (hud.querySelector('.v3d-rows') as HTMLElement).innerHTML = [
    ['Altitude', 'FL300'], ['Speed', `${Math.round(TAS / 0.5144)} kt · M${MACH.toFixed(2)}`], ['Heading', `${String(Math.round(V.hdg) % 360).padStart(3, '0')}°`],
    ['Position', ll], ['To go', `${Math.round(left)} nm · ${esc(TO.icao)}`], ['Phase', 'Cruise'],
  ].map(([k, v]) => `<span><small>${k}</small><b>${v}</b></span>`).join('');
  }
  const lm = localMin(); if (!V.sliding) V.slider.value = String(Math.round(lm));
  (hud.querySelector('.v3d-lt') as HTMLElement).textContent = `${String(Math.floor(lm / 60)).padStart(2, '0')}:${String(Math.floor(lm % 60)).padStart(2, '0')}`;
  (hud.querySelector('.v3d-sub') as HTMLElement).textContent = `local · ${fmtTime(V.t, 0)} UTC · sun ${V.sunAlt >= 0 ? '+' : ''}${V.sunAlt.toFixed(1)}°`;
}
registerSection(Viewer);
export {};
