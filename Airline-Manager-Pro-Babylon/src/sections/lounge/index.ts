// The lounge as a section of the game: its scene, your eyes (the camera), walking (touch, keys and mouse, a
// controller), and every graphics setting applied as it changes: shadows, the mirror, reflections on metal, glow,
// bloom, ambient occlusion, film tone mapping, sharpening, the fire, the field of view.
import {
  Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, ShadowGenerator, GlowLayer, DefaultRenderingPipeline,
  SSAO2RenderingPipeline, ImageProcessingConfiguration, MirrorTexture, Plane, ReflectionProbe, RenderTargetTexture, ParticleSystem, Color4 as C4, Mesh,
} from '@babylonjs/core';
import { registerSection, Section, SectionCtx } from '../../core/sections';
import { S } from '../../core/settings';
import { runLoop } from '../../core/engine';
import { inputFrame, onButton, isPlay, vibrate } from '../../core/input';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { toast } from '../../ui/icons';
import { buildLounge, blockedAt, Lounge } from './build';
import * as P from './pictures';
import { perfAttach, perfDetach, perfShow, perfBegin, perfEnd } from '../../core/perf-meter';

const EYE = 1.65;
const L: any = { scene: null as Scene | null };

function apply(what: string) {
  const sc: Scene = L.scene; if (!sc) return; const g = S.gfx, cam: UniversalCamera = L.cam, lo: Lounge = L.lo;
  const all = what === 'all' || what === 'preset';
  if (all || what === 'fov') cam.fov = g.fov * Math.PI / 180;
  // shadows from the daylight through the windows
  if (all || what === 'shadows') {
    if (L.sg) { L.sg.dispose(); L.sg = null; }
    if (g.shadows !== 'off') { const sg = new ShadowGenerator(g.shadows === 'high' ? (IS_PC ? 4096 : 2048) : 1024, L.sun); sg.usePercentageCloserFiltering = true; sg.filteringQuality = g.shadows === 'high' ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_LOW; sg.bias = 0.0008; sg.normalBias = 0.02;
      for (const m of lo.casters) sg.addShadowCaster(m, false); L.sg = sg; }
  }
  // the mirror behind the bottles: a real reflection
  if (all || what === 'mirror') {
    if (L.mt) { lo.mirrorMat.reflectionTexture = null; L.mt.dispose(); L.mt = null; }
    if (g.mirror !== 'off' && lo.mirror) {
      const mt = new MirrorTexture('mirrorTex', g.mirror === 'high' ? (IS_PC ? 1024 : 768) : 384, sc, true);
      lo.mirror.computeWorldMatrix(true); const nd = lo.mirror.getVerticesData('normal'); const n = Vector3.TransformNormal(new Vector3(nd[0], nd[1], nd[2]), lo.mirror.getWorldMatrix()).normalize();
      mt.mirrorPlane = Plane.FromPositionAndNormal(lo.mirror.getAbsolutePosition(), n.scale(-1));
      mt.renderList = sc.meshes.filter(m => m !== lo.mirror && m.isVisible); mt.level = 0.85;
      lo.mirrorMat.reflectionTexture = mt; L.mt = mt;
    }
  }
  // reflections on metal: the room seen from its middle, once
  if (all || what === 'probe') {
    if (L.probe) { for (const m of lo.metals) m.reflectionTexture = null; L.probe.dispose(); L.probe = null; }
    if (g.probe) { const pr = new ReflectionProbe('probe', IS_PC ? 256 : 128, sc); pr.position = new Vector3(0, 1.8, 0); pr.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      for (const m of sc.meshes) if (m.isVisible && m !== lo.mirror) pr.renderList.push(m); for (const m of lo.metals) { m.reflectionTexture = pr.cubeTexture; m.environmentIntensity = 0.7; } L.probe = pr; }
  }
  if (all || what === 'glow') { L.glow.isEnabled = g.glow; }
  // the camera's effects
  const dp: DefaultRenderingPipeline = L.dp;
  if (all || what === 'aa') { dp.fxaaEnabled = g.aa === 'fxaa'; dp.samples = g.aa === 'msaa' ? 4 : 1; }
  if (all || what === 'bloom') { dp.bloomEnabled = g.bloom; dp.bloomThreshold = 0.78; dp.bloomWeight = 0.32; dp.bloomKernel = 64; dp.bloomScale = 0.5; }
  if (all || what === 'aces' || what === 'exposure') { dp.imageProcessingEnabled = true; const ip = dp.imageProcessing; ip.toneMappingEnabled = g.aces; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = g.exposure; ip.contrast = 1.08; }
  if (all || what === 'sharpen') { dp.sharpenEnabled = g.sharpen; dp.sharpen.edgeAmount = 0.22; }
  if (all || what === 'ssao') {
    if (L.ssao) { sc.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline('ssao', cam); L.ssao.dispose(); L.ssao = null; }
    if (g.ssao) { try { const ss = new SSAO2RenderingPipeline('ssao', sc, { ssaoRatio: 0.5, blurRatio: 0.5 }, [cam]); ss.radius = 1.2; ss.totalStrength = 1.1; ss.samples = IS_PC ? 16 : 8; L.ssao = ss; } catch (e) { L.ssao = null; } }
  }
  if (all || what === 'particles') makeFire();
  if (all || /^show(Fps|Cpu|Gpu|Mem)$/.test(what)) perfShow();
}
/** The fire: flames rising from the logs, their light flickering on the room. */
function makeFire() {
  const lo: Lounge = L.lo, sc: Scene = L.scene; if (lo.fire.ps) { lo.fire.ps.dispose(); lo.fire.ps = null; }
  const hi = S.gfx.particles === 'high', ps = new ParticleSystem('fire', hi ? 900 : 300, sc);
  ps.particleTexture = lo.fire.tex; ps.emitter = lo.fire.at.clone();
  ps.minEmitBox = new Vector3(-0.04, 0, -0.42); ps.maxEmitBox = new Vector3(0.06, 0.04, 0.42);
  ps.color1 = new C4(1, 0.62, 0.22, 1); ps.color2 = new C4(1, 0.38, 0.06, 1); ps.colorDead = new C4(0.25, 0.05, 0, 0);
  ps.minSize = 0.1; ps.maxSize = hi ? 0.3 : 0.36; ps.minLifeTime = 0.25; ps.maxLifeTime = 0.65; ps.emitRate = hi ? 320 : 110;
  ps.blendMode = ParticleSystem.BLENDMODE_ONEONE; ps.gravity = new Vector3(0, 1.1, 0);
  ps.direction1 = new Vector3(-0.05, 0.9, -0.08); ps.direction2 = new Vector3(0.08, 1.3, 0.08); ps.minEmitPower = 0.15; ps.maxEmitPower = 0.45; ps.updateSpeed = 0.016;
  ps.minAngularSpeed = -1; ps.maxAngularSpeed = 1; ps.start(); lo.fire.ps = ps;
}

const Lounge$: Section = {
  id: 'lounge', title: 'Business lounge',
  async open(ctx: SectionCtx) {
    const { engine, ui, progress } = ctx; L.ui = ui; L.ctx = ctx;
    progress(8, 'Building the room…');
    await new Promise(r => setTimeout(r, 30));
    const sc = new Scene(engine); L.scene = sc; sc.clearColor = new Color4(0.02, 0.03, 0.05, 1); sc.skipPointerMovePicking = true;
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), sc); hemi.diffuse = Color3.FromHexString('#FFF3E2'); hemi.groundColor = Color3.FromHexString('#3A2A1A'); hemi.intensity = 0.45;
    const lo = buildLounge(sc, (p, s) => progress(p, s)); L.lo = lo;
    const sun = new DirectionalLight('sun', new Vector3(0.25, -0.6, -1).normalize(), sc); sun.position = new Vector3(-2, 10, 16); sun.intensity = 0.35 + 2.2 * lo.sun; sun.diffuse = Color3.FromHexString(lo.sun > 0.3 ? '#FFF0DA' : '#9FB4E0'); L.sun = sun;
    hemi.intensity = 0.3 + 0.35 * lo.sun;
    // your eyes: where you arrive in the main game's lounge, on the welcome mat inside the doors, facing the windows
    const F = { x: lo.spawn.x, z: lo.spawn.z, yaw: lo.spawn.yaw, pitch: -0.04, v: 0, bob: 0 }; L.F = F;
    if (blockedAt(lo, F.x, F.z)) { for (let r = 0.2; r < 3 && blockedAt(lo, F.x, F.z); r += 0.2) for (let a = 0; a < 6.28 && blockedAt(lo, F.x, F.z); a += 0.5) { const x = lo.spawn.x + Math.cos(a) * r, z = lo.spawn.z + Math.sin(a) * r; if (!blockedAt(lo, x, z)) { F.x = x; F.z = z; } } }
    const cam = new UniversalCamera('eyes', new Vector3(F.x, EYE, -F.z), sc); cam.minZ = 0.05; cam.maxZ = 220; cam.inertia = 0; L.cam = cam; sc.activeCamera = cam;
    progress(96, 'Polishing the glasses…');
    L.glow = new GlowLayer('glow', sc, { mainTextureRatio: IS_PC ? 0.5 : 0.35, blurKernelSize: 48 }); L.glow.intensity = 0.65;
    L.dp = new DefaultRenderingPipeline('dp', true, sc, [cam]);
    apply('all');
    // the hint and the frame-rate meter
    const hud = document.createElement('div'); hud.className = 'hud'; hud.innerHTML = `<div class="aim" hidden></div>`; ui.appendChild(hud); L.hud = hud; perfAttach(engine, sc, hud); perfShow();
    toast(IS_TOUCH ? 'Left thumb: walk · Right: drag to look' : 'W A S D to walk · click to look with the mouse · a controller works too');
    // a tap or a click (not a drag) on something: use it
    let down: any = null; const cv = ctx.canvas;
    L.pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    L.pu = (e: PointerEvent) => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 350; down = null; if (moved < 8 && quick && isPlay() && !document.pointerLockElement && IS_TOUCH) use(e.clientX, e.clientY); };
    cv.addEventListener('pointerdown', L.pd); cv.addEventListener('pointerup', L.pu);
    L.btn = (b: string) => { if (L.scene && b === 'confirm' && isPlay()) use(); };
    onButton(L.btn);
    // each frame: walking, looking, the fire's light, the boards, the meter
    let boardT = 0;
    runLoop(() => {
      perfBegin();
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000), now = performance.now() / 1000;
      const inp = inputFrame(dt);
      F.yaw -= inp.lx; F.pitch = Math.max(-1.2, Math.min(1.0, F.pitch - inp.ly));
      const vmax = inp.run ? 2.6 : 1.4, mag = Math.min(1, Math.hypot(inp.mx, inp.my)); F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
      if (mag > 0.05) { const fx = -Math.sin(F.yaw), fz = -Math.cos(F.yaw), rx = Math.cos(F.yaw), rz = -Math.sin(F.yaw);
        let mx = fx * inp.my + rx * inp.mx, mz = fz * inp.my + rz * inp.mx; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        const step = F.v * dt, nx = F.x + mx * step, nz = F.z + mz * step;
        if (!blockedAt(lo, nx, nz)) { F.x = nx; F.z = nz; } else if (!blockedAt(lo, nx, F.z)) F.x = nx; else if (!blockedAt(lo, F.x, nz)) F.z = nz;
        F.bob += step; }
      const bobY = Math.sin(F.bob / 0.65 * Math.PI) * 0.016 * Math.min(1, F.v / 1.1);
      cam.position.set(F.x, EYE + bobY, -F.z);
      const cp = Math.cos(F.pitch); cam.setTarget(new Vector3(F.x - Math.sin(F.yaw) * cp, EYE + bobY + Math.sin(F.pitch), -(F.z - Math.cos(F.yaw) * cp)));
      lo.fire.light.intensity = 2.6 + 0.9 * Math.sin(now * 9) * Math.sin(now * 4.7) + 0.3 * Math.sin(now * 23);
      if (now > boardT) { boardT = now + 30; for (const b of lo.boards) { P.board(b.c, b.kind); const x = b.tex.getContext() as any; x.drawImage(b.c, 0, 0); b.tex.update(true); } }
      (hud.querySelector('.aim') as HTMLElement).hidden = !(IS_PC && document.pointerLockElement);
      sc.render();
      perfEnd();
    });
  },
  close() {
    const sc: Scene = L.scene; if (!sc) return;
    try { L.cam && ctxCanvas() && ctxCanvas().removeEventListener('pointerdown', L.pd); } catch (e) { /* gone */ }
    perfDetach(); if (L.hud) L.hud.remove(); sc.dispose(); L.scene = null;
  },
  onSettings(what: string) { apply(what === 'preset' ? 'all' : what); },
};
function ctxCanvas(): HTMLCanvasElement { return document.getElementById('bjs') as HTMLCanvasElement; }
/** Use what is in front of you (the middle of the view, or where you tapped): today only the doors, which stay shut. */
function use(px?: number, py?: number) {
  const sc: Scene = L.scene, cv = ctxCanvas(); if (!sc) return;
  const x = px != null ? px * (sc.getEngine().getRenderWidth() / cv.clientWidth) : sc.getEngine().getRenderWidth() / 2, y = py != null ? py * (sc.getEngine().getRenderHeight() / cv.clientHeight) : sc.getEngine().getRenderHeight() / 2;
  const hit = sc.pick(x, y, (m: any) => !!(m.metadata && m.metadata.act));
  if (hit && hit.hit && hit.distance < 4 && hit.pickedMesh && (hit.pickedMesh as Mesh).metadata.act === 'door') { if (L.ctx && L.ctx.toGame) { L.ctx.toGame(); return; } toast('This is the lounge only for now: the doors stay shut'); vibrate(120, 0.3, 0.5); }
}
registerSection(Lounge$);
export {};
