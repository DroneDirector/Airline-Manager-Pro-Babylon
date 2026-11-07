// The new passenger terminal (concept 1), as a demo of its own from the title screen: you step in at the Grand Hall,
// just inside the main entrance (D-F1-ENTR-C-2), and walk anywhere: both floors, up and down the stairs (S-01, the
// gates' stairs, the staff stairs), the lifts (tap or click them, Cross on a controller), the moving walkways that
// carry you along the pier, out onto the kerb and the apron. Doors open as you come up to them. What you look at
// shows its id (every room, door and object has one), and where you are shows at the top.
import { octreeStatic, prewarmHidden } from '../../core/batch';
import { LiftCtl, liftAt } from './lifts';
import { Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, ShadowGenerator, GlowLayer, DefaultRenderingPipeline, ImageProcessingConfiguration, ReflectionProbe, RenderTargetTexture, AbstractMesh, InstancedMesh } from '@babylonjs/core';
import { registerSection, Section, SectionCtx } from '../../core/sections';
import { S } from '../../core/settings';
import { runLoop } from '../../core/engine';
import { inputFrame, onButton, isPlay, vibrate } from '../../core/input';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { toast, esc } from '../../ui/icons';
import { perfAttach, perfDetach, perfShow, perfBegin, perfEnd } from '../../core/perf-meter';
import { makeKit, Kit } from './kit';
import { buildShell } from './shell';
import { buildDoors, stepDoors, doorPassable, DoorObj } from './doors';
import { furnish } from './furnish';
import { buildFixtures, Fixtures } from './fixtures';
import { buildRental } from './rental';
import { makeWeather, Weather } from './weather';
import { ROOMS, STAIRS, OUTSIDE, SPAWN, F2Y, Fl, Stair, inRoom, roomAt } from './plan';
import { museumBlocked } from '../building/museum';
import { holoMap } from '../../ui/holomap';
import { slimGlow } from '../../core/look';

const EYE = 1.65, R = 0.3;
const O: any = { scene: null as Scene | null };

function apply(what: string) {
  const sc: Scene = O.scene; if (!sc) return; const g = S.gfx, cam: UniversalCamera = O.cam, K: Kit = O.K, all = what === 'all' || what === 'preset';
  if (all || what === 'fov') cam.fov = g.fov * Math.PI / 180;
  if (all || what === 'shadows') {
    if (O.sg) { O.sg.dispose(); O.sg = null; }
    if (g.shadows !== 'off') { const sg = new ShadowGenerator(g.shadows === 'high' ? (IS_PC ? 4096 : 2048) : 1024, O.sun); sg.usePercentageCloserFiltering = true; sg.filteringQuality = g.shadows === 'high' ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_LOW; sg.bias = 0.0008; sg.normalBias = 0.03;
      for (const m of K.casters) sg.addShadowCaster(m, false); O.sg = sg; }
  }
  if (all || what === 'probe') {
    if (O.probe) { sc.environmentTexture = null; O.probe.dispose(); O.probe = null; }
    if (g.probe) { const pr = new ReflectionProbe('probe', IS_PC ? 256 : 128, sc); pr.position = new Vector3(75, 6, 14); pr.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      for (const m of sc.meshes) if (m.isEnabled() && !(m instanceof InstancedMesh) && m.getTotalVertices() > 0 && Math.abs(m.getAbsolutePosition().x - 75) < 400) pr.renderList!.push(m);
      sc.environmentTexture = pr.cubeTexture; O.probe = pr; }
  }
  if (all || what === 'glow') O.glow.isEnabled = g.glow;
  const dp: DefaultRenderingPipeline = O.dp;
  if (all || what === 'aa') { dp.fxaaEnabled = g.aa === 'fxaa'; dp.samples = g.aa === 'msaa' ? 4 : 1; }
  if (all || what === 'bloom') { dp.bloomEnabled = g.bloom; dp.bloomThreshold = 0.85; dp.bloomWeight = 0.25; dp.bloomKernel = 64; dp.bloomScale = 0.5; }
  if (all || what === 'aces' || what === 'exposure') { dp.imageProcessingEnabled = true; const ip = dp.imageProcessing; ip.toneMappingEnabled = g.aces; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = g.exposure; ip.contrast = 1.06; }
  if (all || what === 'sharpen') { dp.sharpenEnabled = g.sharpen; dp.sharpen.edgeAmount = 0.22; }
  if (all || /^show(Fps|Cpu|Gpu|Mem)$/.test(what)) perfShow();
}

const Terminal$: Section = {
  id: 'terminal', title: 'The terminal',
  async open(ctx: SectionCtx) {
    const { engine, ui, progress } = ctx; O.ctx = ctx;
    const D: any = Object.assign({ airline: 'Airport Dynasty Pro', color: '#1C3A8A', color2: '#3FD3E6' }, (ctx.opts && ctx.opts.data) || {});
    progress(6, 'Drawing up the terminal…'); await new Promise(r => setTimeout(r, 30));
    engine.useReverseDepthBuffer = true; O.engine = engine; const sc = new Scene(engine); O.scene = sc; sc.clearColor = new Color4(0.66, 0.78, 0.9, 1); sc.skipPointerMovePicking = true;
    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, -0.3), sc); hemi.diffuse = Color3.FromHexString('#EEF3FA'); hemi.groundColor = Color3.FromHexString('#6E665C'); hemi.intensity = 0.95;
    const sun = new DirectionalLight('sun', new Vector3(-0.45, -1, 0.4).normalize(), sc); sun.position = new Vector3(160, 120, -90); sun.intensity = 2.0; sun.diffuse = Color3.FromHexString('#FFF1DC'); O.sun = sun;
    const K = makeKit(sc); O.K = K;
    buildShell(K, (p, s) => progress(p, s)); await new Promise(r => setTimeout(r, 0));
    O.doors = buildDoors(K) as DoorObj[];
    furnish(K, (p, s) => progress(p, s)); K.clearWalls(); await new Promise(r => setTimeout(r, 0));
    O.fx = buildFixtures(K, D.color, D.color2, D.airline, (p, s) => progress(p, s)) as Fixtures;
    progress(86, 'Finishing the rooms…');
    buildRental(K);
    (K.struct as any).finish();
    // everything that never moves is fixed in place (cheaper to draw); the doors, the revolving wings, the lifts move
    const moving = new Set<AbstractMesh>(); for (const d of O.doors as DoorObj[]) for (const m of d.node.getChildMeshes()) moving.add(m);
    if (O.fx.museum) for (const m of O.fx.museum.root.getChildMeshes()) moving.add(m);
    for (const l of O.fx.lifts as LiftCtl[]) for (const m of l.moving_parts) moving.add(m);
    for (const j of O.fx.jetways || []) for (const m of j.meshes()) moving.add(m);
    for (const m of sc.meshes) if (!moving.has(m)) { m.freezeWorldMatrix(); m.doNotSyncBoundingInfo = true; }
    for (const m of sc.meshes) if (m.name.indexOf('SRC:') === 0) { m.isPickable = false; }
    try { const stop = octreeStatic(sc); sc.onDisposeObservable.addOnce(stop); } catch (e) { /* every object tested on its own */ }
    try { prewarmHidden(sc); } catch (e) { /* compiled when shown */ }
    O.walkways = Array.from(K.objects.values()).filter(o => o.kind === 'MOVING-WALKWAY').map(o => o.node.metadata);
    // you, at the Grand Hall's main entrance
    const F = { x: SPAWN.x, z: SPAWN.z, f: SPAWN.f as Fl, y: 0, yaw: SPAWN.yaw, pitch: -0.04, v: 0, bob: 0, stair: null as Stair | null }; O.F = F;
    if (!walkable(1, F.x, F.z)) { const s = freeNear(1, F.x, F.z); F.x = s[0]; F.z = s[1]; }
    const cam = new UniversalCamera('eyes', new Vector3(F.x, EYE, F.z), sc); cam.minZ = 0.1; cam.maxZ = 900; cam.inertia = 0; O.cam = cam; sc.activeCamera = cam;
    O.glow = new GlowLayer('glow', sc, { mainTextureRatio: IS_PC ? 0.5 : 0.3, blurKernelSize: 32 }); O.glow.intensity = 0.35; for (const m of sc.meshes) if (m.material && (m.material as any)._soft) O.glow.addExcludedMesh(m as any); sc.onNewMeshAddedObservable.add(m => { setTimeout(() => { if (m.material && (m.material as any)._soft) O.glow.addExcludedMesh(m as any); }, 0); }); slimGlow(O.glow, sc);
    O.dp = new DefaultRenderingPipeline('dp', true, sc, [cam]);
    progress(92, 'Lighting the terminal…');
    apply('all');
    const hud = document.createElement('div'); hud.className = 'hud tm-hud'; O.hud = hud;
    hud.innerHTML = `<div class="tm-where"><small></small><b></b></div><div class="aim" hidden></div><div class="of-hint" hidden></div>`;
    ui.appendChild(hud); perfAttach(engine, sc, hud); perfShow();
    holoMap(hud, () => ({ x: F.x, z: F.z, f: (F.stair ? (F.y > F2Y / 2 ? 2 : 1) : F.f) as Fl, yaw: F.yaw }), O.K && O.K.root);
    // the sky, the clouds and the weather, the time of day and its time-lapse, the drone and the photo button
    const wx: Weather = makeWeather({ sc, engine, cam, sun, hemi, glow: O.glow, hud, canvas: ctx.canvas, centre: new Vector3(110, 0, 30),
      indoors: () => { if (!wx.drone) return !!F.stair || !!roomAt(F.f, F.x, F.z); const p = cam.position, f: Fl = p.y > F2Y ? 2 : 1; return p.y < 12.2 && !!roomAt(f, p.x, p.z); } }); O.wx = wx;
    toast(IS_TOUCH ? 'Left thumb: walk · Right: drag to look · tap a lift to use it' : 'W A S D to walk · click to look with the mouse · E or click a lift to change floor · a controller works too');
    let down: any = null; const cv = ctx.canvas;
    O.pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    O.pu = (e: PointerEvent) => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 350; down = null; if (moved < 8 && quick && isPlay() && !document.pointerLockElement) use(e.clientX, e.clientY); };
    cv.addEventListener('pointerdown', O.pd); cv.addEventListener('pointerup', O.pu);
    O.btn = (b: string) => { if (O.scene && b === 'confirm' && isPlay()) use(); }; onButton(O.btn);
    let hintT = 0, whereT = 0, here = '';
    runLoop(() => {
      perfBegin();
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000), now = performance.now() / 1000, inp = inputFrame(dt);
      const flying = wx.droneStep(dt, inp);
      if (!flying) {
      F.yaw += inp.lx; F.pitch = Math.max(-1.2, Math.min(1.0, F.pitch - inp.ly));
      const vmax = inp.run ? 3.0 : 1.5, mag = Math.min(1, Math.hypot(inp.mx, inp.my)); F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
      if (mag > 0.05) { const fx = Math.sin(F.yaw), fz = Math.cos(F.yaw), rx = Math.cos(F.yaw), rz = -Math.sin(F.yaw);
        let mx = fx * inp.my + rx * inp.mx, mz = fz * inp.my + rz * inp.mx; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        const st = F.v * dt; if (!step(F.x + mx * st, F.z + mz * st)) { if (!step(F.x + mx * st, F.z)) step(F.x, F.z + mz * st); } F.bob += st; }
      // the moving walkways carry you
      if (F.f === 2 && !F.stair) for (const w of O.walkways) if (Math.abs(F.z - w.z) < 0.68 && F.x > w.x0 && F.x < w.x1) { const nx = F.x + w.dir * 0.95 * dt; if (walkable(2, nx, F.z)) F.x = nx; break; }
      cam.position.set(F.x, F.y + EYE + Math.sin(F.bob / 0.65 * Math.PI) * 0.015 * Math.min(1, F.v / 1.1), F.z);
      const cp = Math.cos(F.pitch); cam.setTarget(cam.position.add(new Vector3(Math.sin(F.yaw) * cp, Math.sin(F.pitch), Math.cos(F.yaw) * cp)));
      }
      wx.frame(dt, now);
      stepDoors(O.doors, F.x, F.z, F.stair ? 0 : F.f, dt, now);
      // the museum's sliding doors
      if (O.fx.museum) { const Md = O.fx.museumDoor, want = F.f === 1 && Math.hypot(F.x - 36, F.z - 15) < 3 ? 1 : 0; if (Math.abs(Md.k - want) > 0.001) { Md.k += Math.sign(want - Md.k) * Math.min(Math.abs(want - Md.k), dt * 1.8); const e = Md.k * Md.k * (3 - 2 * Md.k); O.fx.museum.doors.forEach((m: AbstractMesh, i: number) => { const b = Md.base[i]; m.position.x = b.x + Math.sign(b.x || 1) * e * 1.12; }); } }
      if (now > whereT) { whereT = now + 0.3; const w = whereAmI(); if (w !== here) { here = w; const [a, b] = w.split('|'); (hud.querySelector('.tm-where small') as HTMLElement).textContent = a; (hud.querySelector('.tm-where b') as HTMLElement).textContent = b; } }
      if (now > hintT && !IS_TOUCH) { hintT = now + 0.2; const h = aimAt(); const el = hud.querySelector('.of-hint') as HTMLElement; el.hidden = !h || IS_TOUCH; if (h) el.textContent = h; }
      (hud.querySelector('.aim') as HTMLElement).hidden = !(IS_PC && document.pointerLockElement);
      sc.render(); perfEnd();
    });
    void esc;
  },
  close() {
    const sc: Scene = O.scene; if (!sc) return;
    try { O.ctx.canvas.removeEventListener('pointerdown', O.pd); O.ctx.canvas.removeEventListener('pointerup', O.pu); } catch (e) { /* gone */ }
    try { if (O.wx) O.wx.dispose(); } catch (e) { /* gone */ } O.wx = null; perfDetach(); if (O.hud) O.hud.remove(); sc.dispose(); try { O.engine.useReverseDepthBuffer = false; } catch (e) { /* gone */ } O.scene = null; O.K = null; O.doors = []; O.fx = null;
  },
  onSettings(what: string) { apply(what === 'preset' ? 'all' : what); },
};

// ---- where you can walk ----
/** How far up a stair's run (0 at its foot on Floor 1, 1 at its head on Floor 2), and whether you are within its width. */
function stairAt(s: Stair, x: number, z: number): { t: number; inside: boolean } {
  const ax = s.dir[0] === 'x', run = ax ? s.x1 - s.x0 : s.z1 - s.z0, u = ax ? (x - s.x0) / run : (z - s.z0) / run, t = s.dir[1] === '+' ? u : 1 - u;
  const lat = ax ? z : x, l0 = ax ? s.z0 : s.x0, l1 = ax ? s.z1 : s.x1; return { t, inside: lat > l0 + 0.35 && lat < l1 - 0.35 && t > -0.02 && t < 1.02 };
}
function walkable(f: Fl, x: number, z: number): boolean {
  for (const s of STAIRS) if (x > s.x0 - 0.05 && x < s.x1 + 0.05 && z > s.z0 - 0.05 && z < s.z1 + 0.05) return false;   // the stairs are walked on their own
  // the museum's way in from the Grand Hall: through its sliding doors only when they are open
  if (f === 1 && x > 35.2 && x < 36.95 && Math.abs(z - 15) < 2.2) return Math.abs(z - 15) < 1.0 && O.fx && O.fx.museum && O.fx.museumDoor.k > 0.6;
  let ok = false;
  for (const r of ROOMS) if (r.f === f && r.kind !== 'museum' && inRoom(r, x, z, 0.45)) { ok = true; break; }
  if (!ok) for (const d of O.doors as DoorObj[]) { if (d.d.f !== f) continue; const along = d.d.along === 'x', a = along ? x - d.d.x : z - d.d.z, c = along ? z - d.d.z : x - d.d.x;
    if (Math.abs(a) < Math.max(0.15, d.d.w / 2 - 0.38) && Math.abs(c) < 0.75) { if (!doorPassable(d)) return false; ok = true; break; } }
  if (!ok && f === 1) { for (const o of OUTSIDE) if (inRoom(o, x, z, 0.2)) { ok = true; break; }
    const M = O.fx && O.fx.museum; if (!ok && M) { const lx = -(z - 15), lz = x - 26; if (Math.abs(lz) < M.D / 2 + 0.5 && Math.abs(lx) < M.W / 2 + 0.5 && !museumBlocked(M, lx, lz)) ok = true; } }
  if (!ok) return false;
  // a closed door's leaf in the way (the room sides of each door are open floor otherwise)
  for (const d of O.doors as DoorObj[]) { if (d.d.f !== f || doorPassable(d)) continue; const along = d.d.along === 'x', a = along ? x - d.d.x : z - d.d.z, c = along ? z - d.d.z : x - d.d.x; if (Math.abs(a) < d.d.w / 2 + 0.1 && Math.abs(c) < 0.3) return false; }
  const K: Kit = O.K;
  for (const b of K.blocks[f]) if (x > b[0] - R && x < b[2] + R && z > b[1] - R && z < b[3] + R) return false;
  for (const c of K.circles[f]) if (Math.hypot(x - c[0], z - c[1]) < c[2] + R) return false;
  return true;
}
/** A step: on and off the stairs at their foot (Floor 1) and head (Floor 2), or across the floor you are on. */
function step(nx: number, nz: number): boolean {
  const F = O.F;
  if (F.stair) { const s: Stair = F.stair, a = stairAt(s, nx, nz), ax = s.dir[0] === 'x', lat = ax ? nz : nx, l0 = ax ? s.z0 : s.x0, l1 = ax ? s.z1 : s.x1;
    if (lat < l0 + 0.35 || lat > l1 - 0.35) return false;
    if (a.t < 0) { if (!walkable(1, nx, nz)) return false; F.stair = null; F.f = 1; F.y = 0; F.x = nx; F.z = nz; return true; }
    if (a.t > 1) { if (!walkable(2, nx, nz)) return false; F.stair = null; F.f = 2; F.y = F2Y; F.x = nx; F.z = nz; return true; }
    F.x = nx; F.z = nz; F.y = F2Y * Math.max(0, Math.min(1, a.t)); return true; }
  for (const s of STAIRS) { const a = stairAt(s, nx, nz); if (!a.inside) continue;
    if ((F.f === 1 && a.t < 0.12) || (F.f === 2 && a.t > 0.88)) { F.stair = s; F.x = nx; F.z = nz; F.y = F2Y * Math.max(0, Math.min(1, a.t)); return true; } return false; }
  if (!walkable(F.f, nx, nz)) return false; F.x = nx; F.z = nz; return true;
}
function freeNear(f: Fl, x: number, z: number): [number, number] { for (let r = 0.3; r < 12; r += 0.3) for (let a = 0; a < Math.PI * 2; a += 0.4) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (walkable(f, px, pz)) return [px, pz]; } return [x, z]; }
function whereAmI(): string {
  const F = O.F; if (F.stair) return `Stairs ${F.stair.id}|${F.stair.from} ↔ ${F.stair.to}`;
  const r = roomAt(F.f, F.x, F.z);
  if (r) return `Floor ${F.f} · ${r.id}|${r.name}`;
  for (const o of OUTSIDE) if (inRoom(o, F.x, F.z)) return `Outside · ${o.id}|${o.name ? o.name : o.id === 'KERB' ? 'The kerb (drop-off under the roof)' : o.id === 'APRON' ? 'The apron' : 'Outside the staff entrance'}`;
  return 'Floor 1 · F1-MUSEUM|Museum (Vortex Gallery)';
}
// ---- what you look at ----
function pick(px?: number, py?: number): { id: string; act?: string; dist: number } | null {
  const sc: Scene = O.scene, cv = O.ctx.canvas as HTMLCanvasElement; if (!sc) return null;
  const e = sc.getEngine(), x = px != null ? px * (e.getRenderWidth() / cv.clientWidth) : e.getRenderWidth() / 2, y = py != null ? py * (e.getRenderHeight() / cv.clientHeight) : e.getRenderHeight() / 2;
  const hit = sc.pick(x, y, (m: any) => !!(m.metadata && m.metadata.id) && m.isPickable);
  if (!hit || !hit.hit || !hit.pickedMesh || hit.distance > 7) return null;
  let md: any = hit.pickedMesh.metadata, n: any = hit.pickedMesh.parent; while ((!md || !md.act) && n) { if (n.metadata && n.metadata.act) { md = n.metadata; break; } n = n.parent; }
  return { id: md.id, act: md.act, dist: hit.distance };
}
function aimAt(): string { const p = pick(); if (!p) return ''; if (p.act === 'lift') return `${p.id} · lift: ${O.F.f === 1 ? 'up to Floor 2' : 'down to Floor 1'}`; return p.id; }
function use(px?: number, py?: number) {
  const p = pick(px, py), F = O.F; if (!p || p.act !== 'lift' || p.dist > 3.5 || F.stair) return;
  const l = (O.fx.lifts as LiftCtl[]).filter(q => q.id === p.id)[0]; if (!l) return;
  const to: Fl = F.f === 1 ? 2 : 1, fx = l.x + Math.sin(l.face) * 1.5, fz = l.z + Math.cos(l.face) * 1.5;
  const [x, z] = walkable(to, fx, fz) ? [fx, fz] : freeNear(to, fx, fz);
  vibrate(60, 0.2, 0.3); F.f = to; F.y = to === 2 ? F2Y : 0; F.x = x; F.z = z; F.yaw = l.face; liftAt(l, to); toast(`${l.id}: Floor ${to}`);
}
registerSection(Terminal$);
