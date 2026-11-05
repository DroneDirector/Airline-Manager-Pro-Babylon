// The hangar as a section of the game, opened from the game (Hangars, Walk in): walk round your aircraft in for work
// (W A S D, the stick, a controller) and look; the panel shows what is being fixed, how far it is and who is on it. The
// maintenance office opens Maintenance in the game; the doors take you back to the game.
import {
  Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, ShadowGenerator, GlowLayer, DefaultRenderingPipeline,
  SSAO2RenderingPipeline, ImageProcessingConfiguration, ReflectionProbe, RenderTargetTexture, Mesh,
} from '@babylonjs/core';
import { registerSection, Section, SectionCtx } from '../../core/sections';
import { S } from '../../core/settings';
import { runLoop } from '../../core/engine';
import { inputFrame, onButton, isPlay, vibrate } from '../../core/input';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { toast, esc } from '../../ui/icons';
import { buildHangar, hangarBlocked, Hangar, HangarData } from './build';
import { perfAttach, perfDetach, perfShow, perfBegin, perfEnd } from '../../core/perf-meter';

const EYE = 1.65, SIT = 1.2;
const O: any = { scene: null as Scene | null };
const HINTS: { [k: string]: string } = { aircraft: 'Your aircraft', office: 'Maintenance office: Maintenance in the game', break: 'The break room', vending: 'The vending machine', doors: 'The hangar doors: back to the game', exit: 'Door: back to the game', stand: 'A work stand', trolley: 'A tool trolley' };

function apply(what: string) {
  const sc: Scene = O.scene; if (!sc) return; const g = S.gfx, cam: UniversalCamera = O.cam, of: Hangar = O.of, all = what === 'all' || what === 'preset';
  if (all || what === 'fov') cam.fov = g.fov * Math.PI / 180;
  if (all || what === 'shadows') {
    if (O.sg) { O.sg.dispose(); O.sg = null; }
    if (g.shadows !== 'off') { const sg = new ShadowGenerator(g.shadows === 'high' ? (IS_PC ? 4096 : 2048) : 1024, O.sun); sg.usePercentageCloserFiltering = true; sg.filteringQuality = g.shadows === 'high' ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_LOW; sg.bias = 0.0008; sg.normalBias = 0.02; for (const m of of.casters) sg.addShadowCaster(m, false); O.sg = sg; }
  }
  if (all || what === 'probe') {
    if (O.probe) { for (const m of of.metals) m.reflectionTexture = null; O.probe.dispose(); O.probe = null; }
    if (g.probe) { const pr = new ReflectionProbe('probe', IS_PC ? 256 : 128, sc); pr.position = new Vector3(0, 1.6, 0); pr.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE; for (const m of sc.meshes) if (m.isVisible) pr.renderList.push(m); for (const m of of.metals) { m.reflectionTexture = pr.cubeTexture; m.environmentIntensity = 0.7; } O.probe = pr; }
  }
  if (all || what === 'glow') O.glow.isEnabled = g.glow;
  const dp: DefaultRenderingPipeline = O.dp;
  if (all || what === 'aa') { dp.fxaaEnabled = g.aa === 'fxaa'; dp.samples = g.aa === 'msaa' ? 4 : 1; }
  if (all || what === 'bloom') { dp.bloomEnabled = g.bloom; dp.bloomThreshold = 0.8; dp.bloomWeight = 0.3; dp.bloomKernel = 64; dp.bloomScale = 0.5; }
  if (all || what === 'aces' || what === 'exposure') { dp.imageProcessingEnabled = true; const ip = dp.imageProcessing; ip.toneMappingEnabled = g.aces; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = g.exposure; ip.contrast = 1.08; }
  if (all || what === 'sharpen') { dp.sharpenEnabled = g.sharpen; dp.sharpen.edgeAmount = 0.22; }
  if (all || what === 'ssao') {
    if (O.ssao) { sc.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline('ssao', cam); O.ssao.dispose(); O.ssao = null; }
    if (g.ssao) { try { const ss = new SSAO2RenderingPipeline('ssao', sc, { ssaoRatio: 0.5, blurRatio: 0.5 }, [cam]); ss.radius = 0.8; ss.totalStrength = 1.1; ss.samples = IS_PC ? 16 : 8; O.ssao = ss; } catch (e) { O.ssao = null; } }
  }
  if (all || /^show(Fps|Cpu|Gpu|Mem)$/.test(what)) perfShow();
}

const Hangar$: Section = {
  id: 'hangar', title: 'The hangar',
  async open(ctx: SectionCtx) {
    const { engine, ui, progress } = ctx; O.ctx = ctx;
    const D: HangarData = Object.assign({ reg: '', type: '', L: 37.6, span: 35.8, H: 11.8, color: '#1C2A4A', color2: '#3FD3E6', base: '', size: '', fixes: [], progress: 0, crew: [] }, (ctx.opts && ctx.opts.data) || {}); O.D = D;
    progress(8, 'Opening the hangar…'); await new Promise(r => setTimeout(r, 30));
    const sc = new Scene(engine); O.scene = sc; sc.clearColor = new Color4(0.02, 0.02, 0.03, 1); sc.skipPointerMovePicking = true;
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), sc); hemi.diffuse = Color3.FromHexString('#FFF3E2'); hemi.groundColor = Color3.FromHexString('#3A2A1A');
    const of = buildHangar(sc, D, (p, s) => progress(p, s)); O.of = of;
    hemi.intensity = 0.28 + 0.4 * of.sun;
    const sun = new DirectionalLight('sun', new Vector3(0.25, -1, 0.15).normalize(), sc); sun.position = new Vector3(-10, of.HH + 20, -8); sun.intensity = 0.4 + 2.2 * of.sun; sun.diffuse = Color3.FromHexString(of.sun > 0.3 ? '#FFF4E4' : '#9FB4E0'); O.sun = sun;
    hemi.intensity = 0.55 + 0.3 * of.sun;
    const F = { x: of.spawn.x, z: of.spawn.z, yaw: of.spawn.yaw, pitch: 0.05, v: 0, bob: 0, sit: false }; O.F = F;
    const cam = new UniversalCamera('eyes', new Vector3(F.x, EYE, F.z), sc); cam.minZ = 0.05; cam.maxZ = 400; cam.inertia = 0; O.cam = cam; sc.activeCamera = cam;
    O.glow = new GlowLayer('glow', sc, { mainTextureRatio: IS_PC ? 0.5 : 0.35, blurKernelSize: 40 }); O.glow.intensity = 0.5;
    O.dp = new DefaultRenderingPipeline('dp', true, sc, [cam]);
    apply('all');
    const hud = document.createElement('div'); hud.className = 'hud'; hud.innerHTML = `<div class="aim" hidden></div><div class="of-hint" hidden></div><div class="hg-info"><b>${esc(D.reg || 'An empty hangar')}${D.type ? ' · ' + esc(D.type) : ''}</b><small>${esc([D.size, D.base].filter(Boolean).join(' · '))}</small>
      ${D.reg ? `<div class="hg-bar"><i style="width:${Math.round((D.progress || 0) * 100)}%"></i></div><small>${Math.round((D.progress || 0) * 100)}% done</small>
      <ul>${(D.fixes.length ? D.fixes : ['General check']).slice(0, 6).map(f => `<li>${esc(f)}</li>`).join('')}</ul><small>${D.crew.length ? 'Mechanics: ' + esc(D.crew.join(', ')) : 'No mechanics free here'}</small>` : '<small>Walk round and look at it</small>'}</div>`; ui.appendChild(hud); O.hud = hud; perfAttach(engine, sc, hud); perfShow();
    toast(IS_TOUCH ? 'Left thumb: walk · Right: drag to look · tap things to use them' : 'W A S D to walk · click to look with the mouse · E or click to use · a controller works too');
    let down: any = null; const cv = ctx.canvas;
    O.pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    O.pu = (e: PointerEvent) => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 350; down = null; if (moved < 8 && quick && isPlay() && !document.pointerLockElement) use(e.clientX, e.clientY); };
    cv.addEventListener('pointerdown', O.pd); cv.addEventListener('pointerup', O.pu);
    O.btn = (b: string) => { if (O.scene && b === 'confirm' && isPlay()) use(); };
    onButton(O.btn);
    let hintT = 0;
    runLoop(() => {
      perfBegin();
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000), now = performance.now() / 1000, inp = inputFrame(dt);
      F.yaw += inp.lx; F.pitch = Math.max(-1.2, Math.min(1.0, F.pitch - inp.ly));
      {
        const vmax = inp.run ? 3.2 : 1.5, mag = Math.min(1, Math.hypot(inp.mx, inp.my)); F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
        if (mag > 0.05) { const fx = Math.sin(F.yaw), fz = Math.cos(F.yaw), rx = Math.cos(F.yaw), rz = -Math.sin(F.yaw);
          let mx = fx * inp.my + rx * inp.mx, mz = fz * inp.my + rz * inp.mx; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
          const st = F.v * dt, nx = F.x + mx * st, nz = F.z + mz * st;
          if (!hangarBlocked(of, nx, nz)) { F.x = nx; F.z = nz; } else if (!hangarBlocked(of, nx, F.z)) F.x = nx; else if (!hangarBlocked(of, F.x, nz)) F.z = nz; F.bob += st; }
        cam.position.set(F.x, EYE + Math.sin(F.bob / 0.65 * Math.PI) * 0.015 * Math.min(1, F.v / 1.1), F.z);
      }
      const cp = Math.cos(F.pitch); cam.setTarget(cam.position.add(new Vector3(Math.sin(F.yaw) * cp, Math.sin(F.pitch), Math.cos(F.yaw) * cp)));
      // what you are looking at (the middle of the view), within reach: its name
      if (now > hintT) { hintT = now + 0.15; const h = aimAt(); const el = hud.querySelector('.of-hint') as HTMLElement; const t = h ? HINTS[h] || '' : ''; el.hidden = !t || IS_TOUCH; if (t) el.textContent = F.sit && h === 'chair' ? 'Your chair: stand up' : t; }
      (hud.querySelector('.aim') as HTMLElement).hidden = !(IS_PC && document.pointerLockElement);
      sc.render(); perfEnd();
    });
    void esc;
  },
  close() {
    const sc: Scene = O.scene; if (!sc) return;
    try { O.ctx.canvas.removeEventListener('pointerdown', O.pd); O.ctx.canvas.removeEventListener('pointerup', O.pu); } catch (e) { /* gone */ }
    perfDetach(); if (O.hud) O.hud.remove(); sc.dispose(); O.scene = null;
  },
  onSettings(what: string) { apply(what === 'preset' ? 'all' : what); },
};
/** What is in the middle of the view (or where you tapped), within 3 m. */
function pick(px?: number, py?: number): string {
  const sc: Scene = O.scene, cv = O.ctx.canvas as HTMLCanvasElement; if (!sc) return '';
  const e = sc.getEngine(), x = px != null ? px * (e.getRenderWidth() / cv.clientWidth) : e.getRenderWidth() / 2, y = py != null ? py * (e.getRenderHeight() / cv.clientHeight) : e.getRenderHeight() / 2;
  const hit = sc.pick(x, y, (m: any) => !!(m.metadata && m.metadata.act));
  return hit && hit.hit && hit.distance < 6 && hit.pickedMesh ? (hit.pickedMesh as Mesh).metadata.act : '';
}
function aimAt(): string { return pick(); }
/** Use what you are looking at or tapped. */
function use(px?: number, py?: number) {
  const a = pick(px, py), F = O.F, ctx: SectionCtx = O.ctx; if (!a) return;
  const toGame = (screen: string) => { if (ctx.toGame) ctx.toGame(screen); };
  vibrate(60, 0.2, 0.3);
  if (a === 'office') return toGame('maint');
  if (a === 'doors' || a === 'exit') return toGame('');
  if (a === 'aircraft') { const D: HangarData = O.D; toast(D.reg ? `${D.reg}: ${Math.round((D.progress || 0) * 100)}% done${D.fixes.length ? ' · ' + D.fixes.slice(0, 2).join(', ') : ''}` : 'Your aircraft'); return; }
  if (a === 'vending' || a === 'break') { toast('The break room: the vending machine comes with the character animations'); return; }
  if (a === 'stand' || a === 'trolley') { toast(a === 'stand' ? 'A work stand' : 'A tool trolley'); return; }
}
registerSection(Hangar$);
export {};
