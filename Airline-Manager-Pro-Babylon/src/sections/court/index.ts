// The courtroom as a section of the game, opened from the game (Court, a summons, a case's Open).
//  - The empty courtroom (no hearing today): walk about it (W A S D, the stick, a controller), look round, jump to the
//    bench, the witness box, the defence table, the public benches or the doors; push the gate in the bar open (tap or
//    click it); the doors (or Leave) take you back to the game.
//  - A hearing: the game runs it and its dialogue box, the exhibits and Leave court are drawn over this hall. Here:
//    everyone in their seats, standing to speak and sitting again, looking at whoever speaks; the camera on the
//    speaker; the exhibits on the court's screens. Drag (over the game's box) to look round.
import { Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, SpotLight, ShadowGenerator, GlowLayer, DefaultRenderingPipeline, ImageProcessingConfiguration, ReflectionProbe, RenderTargetTexture, Mesh, Matrix, PBRMaterial } from '@babylonjs/core';
import { registerSection, Section, SectionCtx } from '../../core/sections';
import { S } from '../../core/settings';
import { runLoop } from '../../core/engine';
import { inputFrame, onButton, isPlay, vibrate } from '../../core/input';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { toast, esc } from '../../ui/icons';
import { perfAttach, perfDetach, perfShow, perfBegin, perfEnd } from '../../core/perf-meter';
import { onGameCourt, gameOverlay, gameSend } from '../../ui/game-frame';
import { buildCourt, courtExhibit, Court } from './build';
import { courtBlocked } from './seats';
import { buildPerson, posePerson, headOf, Person, PersonData } from './people';

const EYE = 1.64;
const O: any = { scene: null as Scene | null };
const SPOTS: { [k: string]: [number, number, number, number, string] } = { bench: [0, -6.9, 0, 0.75, 'The bench'], witness: [5.0, -4.85, -0.55, 0.3, 'Witness box'], def: [3.5, -0.2, Math.PI, 0, 'Defence table'], pub: [-3.0, 5.0, Math.PI, 0, 'Public benches'], door: [0, 9.2, Math.PI, 0, 'The doors'] };

function apply(what: string) {
  const sc: Scene = O.scene; if (!sc) return; const g = S.gfx, cam: UniversalCamera = O.cam, C: Court = O.C, all = what === 'all' || what === 'preset';
  if (all || what === 'fov') cam.fov = Math.min(g.fov, 70) * Math.PI / 180;
  if (all || what === 'shadows') {
    if (O.sg) { O.sg.dispose(); O.sg = null; }
    if (g.shadows !== 'off') { const sg = new ShadowGenerator(g.shadows === 'high' ? (IS_PC ? 4096 : 2048) : 1024, O.sun); sg.usePercentageCloserFiltering = true; sg.filteringQuality = g.shadows === 'high' ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_LOW; sg.bias = 0.0006; sg.normalBias = 0.02;
      for (const m of C.casters) sg.addShadowCaster(m, false); for (const k in O.people) for (const m of O.people[k].meshes) sg.addShadowCaster(m, false); O.sg = sg; }
  }
  if (all || what === 'probe') {
    if (O.probe) { for (const m of C.metals) m.reflectionTexture = null; O.probe.dispose(); O.probe = null; }
    if (g.probe) { const pr = new ReflectionProbe('probe', IS_PC ? 256 : 128, sc); pr.position = new Vector3(0, 2.2, 0); pr.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE; for (const m of sc.meshes) if (m.isVisible && m.isEnabled()) pr.renderList!.push(m); for (const m of C.metals) m.reflectionTexture = pr.cubeTexture; O.probe = pr; }
  }
  if (all || what === 'glow') O.glow.isEnabled = g.glow;
  const dp: DefaultRenderingPipeline = O.dp;
  if (all || what === 'aa') { dp.fxaaEnabled = g.aa === 'fxaa'; dp.samples = g.aa === 'msaa' ? 4 : 1; }
  if (all || what === 'bloom') { dp.bloomEnabled = g.bloom; dp.bloomThreshold = 0.85; dp.bloomWeight = 0.25; dp.bloomKernel = 64; dp.bloomScale = 0.5; }
  if (all || what === 'aces' || what === 'exposure') { dp.imageProcessingEnabled = true; const ip = dp.imageProcessing; ip.toneMappingEnabled = g.aces; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = g.exposure * 1.05; ip.contrast = 1.06; }
  if (all || what === 'sharpen') { dp.sharpenEnabled = g.sharpen; dp.sharpen.edgeAmount = 0.22; }
  if (all || /^show(Fps|Cpu|Gpu|Mem)$/.test(what)) perfShow();
}

const Court$: Section = {
  id: 'court', title: 'The courtroom',
  async open(ctx: SectionCtx) {
    const { engine, ui, progress } = ctx; O.ctx = ctx;
    const D: any = Object.assign({ mode: 'empty', judges: 3, courtName: 'The District Court', title: '', people: [], color: '#1C2A4A', color2: '#3FD3E6' }, (ctx.opts && ctx.opts.data) || {});
    const hearing = D.mode === 'hearing'; O.hearing = hearing;
    progress(8, hearing ? 'The court is preparing…' : 'Opening the doors…'); await new Promise(r => setTimeout(r, 30));
    const sc = new Scene(engine); O.scene = sc; sc.useRightHandedSystem = true; sc.clearColor = new Color4(0.1, 0.07, 0.05, 1); sc.skipPointerMovePicking = true;
    sc.fogMode = Scene.FOGMODE_LINEAR; sc.fogStart = 22; sc.fogEnd = 40; sc.fogColor = Color3.FromHexString('#2A2018');
    // the light: daylight through the windows, the warm chandeliers, a soft fill on the bench
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), sc); hemi.diffuse = Color3.FromHexString('#FFF1DC'); hemi.groundColor = Color3.FromHexString('#3A2616'); hemi.intensity = 0.6;
    const sun = new DirectionalLight('sun', new Vector3(18, -13, -2).normalize(), sc); sun.position = new Vector3(-18, 13, 2); sun.intensity = 2.4; sun.diffuse = Color3.FromHexString('#FFE6C0'); O.sun = sun;
    const fill = new SpotLight('fill', new Vector3(0, 6.5, 1), new Vector3(0, -5.5, -7.6).normalize(), 1.0, 2, sc); fill.intensity = 30; fill.range = 20; fill.diffuse = Color3.FromHexString('#FFE2B8');
    const C = buildCourt(sc, D.judges || 3, (p, s) => progress(p, s)); O.C = C;
    // the people (a hearing)
    O.people = {} as { [k: string]: Person }; const mats = new Map<string, PBRMaterial>();
    if (hearing) { progress(70, 'The court is coming in…'); for (const d of D.people as PersonData[]) { const s = C.seats[d.seat]; if (!s) continue; const p = buildPerson(sc, d, s, D.color || '#2C8CFF', mats); p.root.parent = C.root; O.people[d.key] = p; } }
    progress(82, 'Lighting the hall…');
    const cam = new UniversalCamera('eyes', new Vector3(0, EYE, 9.2), sc); cam.minZ = 0.05; cam.maxZ = 80; cam.inertia = 0; O.cam = cam; sc.activeCamera = cam;
    O.glow = new GlowLayer('glow', sc, { mainTextureRatio: IS_PC ? 0.5 : 0.35, blurKernelSize: 32 }); O.glow.intensity = 0.4;
    O.dp = new DefaultRenderingPipeline('dp', true, sc, [cam]);
    apply('all');
    // walking about (the empty courtroom), or the camera on the speaker (a hearing)
    const F = { x: 0, z: 9.2, yaw: Math.PI, pitch: -0.04, v: 0, bob: 0, floor: 0 }; O.F = F;
    O.gate = { want: 0, k: 0, v: 0, dir: 1 };
    O.shot = { pos: new Vector3(6.5, 3.4, 9.5), at: new Vector3(0, 1.4, -5) }; O.camAt = O.shot.at.clone(); O.look = { yaw: 0, pitch: 0, drag: false }; O.st = null;
    if (hearing) cam.position.copyFrom(O.shot.pos);
    const hud = document.createElement('div'); hud.className = 'hud ct-hud'; O.hud = hud;
    hud.innerHTML = hearing ? '' : `<div class="ct-name"><small>${esc(D.courtName)}</small><b>The courtroom, empty: no hearing today</b></div>
      <button class="ct-out" data-k="leave">Leave the courtroom</button>
      <div class="ct-jump">${Object.keys(SPOTS).map(k => `<button data-k="${k}">${esc(SPOTS[k][4])}</button>`).join('')}</div><div class="aim" hidden></div><div class="of-hint" hidden></div>`;
    ui.appendChild(hud); perfAttach(engine, sc, hud); perfShow();
    hud.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button[data-k]') as HTMLElement; if (!b) return; const k = b.getAttribute('data-k') as string; if (k === 'leave') return leave(); spot(k); });
    if (!hearing) toast(IS_TOUCH ? 'Left thumb: walk · Right: drag to look · tap the gate to open it' : 'W A S D to walk · click to look with the mouse · E or click the gate to open it');
    let down: any = null; const cv = ctx.canvas;
    O.pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    O.pu = (e: PointerEvent) => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 350; down = null; if (moved < 8 && quick && isPlay() && !document.pointerLockElement) use(e.clientX, e.clientY); };
    cv.addEventListener('pointerdown', O.pd); cv.addEventListener('pointerup', O.pu);
    O.btn = (b: string) => { if (O.scene && b === 'confirm' && isPlay() && !O.hearing) use(); }; onButton(O.btn);
    let hintT = 0;
    runLoop(() => {
      perfBegin();
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000), now = performance.now() / 1000, inp = inputFrame(dt);
      if (!hearing) {
        F.yaw -= inp.lx; F.pitch = Math.max(-1.1, Math.min(1.0, F.pitch - inp.ly));
        const vmax = inp.run ? 2.4 : 1.4, mag = Math.min(1, Math.hypot(inp.mx, inp.my)); F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
        if (mag > 0.05) { const fx = Math.sin(F.yaw), fz = Math.cos(F.yaw), rx = -Math.cos(F.yaw), rz = Math.sin(F.yaw);
          let mx = fx * inp.my + rx * inp.mx, mz = fz * inp.my + rz * inp.mx; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
          if (F.floor && (F.z > -5.2 || Math.abs(F.x) > 4.6)) F.floor = 0;   // stepped down off the dais or out of the box
          const can = (x: number, z: number) => F.floor ? true : !courtBlocked(x, z, O.gate.k > 0.8);
          const st = F.v * dt, nx = F.x + mx * st, nz = F.z + mz * st;
          if (can(nx, nz)) { F.x = nx; F.z = nz; } else if (can(nx, F.z)) F.x = nx; else if (can(F.x, nz)) F.z = nz; F.bob += st; }
        cam.position.set(F.x, EYE + F.floor + Math.sin(F.bob / 0.65 * Math.PI) * 0.018 * Math.min(1, F.v / 1.2), F.z);
        const cp = Math.cos(F.pitch); cam.setTarget(cam.position.add(new Vector3(Math.sin(F.yaw) * cp, Math.sin(F.pitch), Math.cos(F.yaw) * cp)));
        // the gate: a spring with a little bounce at the end
        const G = O.gate; G.v += ((G.want - G.k) * 38 - G.v * 7.5) * dt; G.k = Math.max(-0.06, Math.min(1.06, G.k + G.v * dt));
        for (const g of C.gate) g.rotation.y = -g.metadata.s * 1.5 * G.k * G.dir;
        if (now > hintT) { hintT = now + 0.15; const h = pick(); const el = hud.querySelector('.of-hint') as HTMLElement; const t = h === 'gate' ? (G.want ? 'The gate: close it' : 'The gate: open it') : h === 'door' ? 'The doors: back to the game' : ''; el.hidden = !t || IS_TOUCH; if (t) el.textContent = t; }
        (hud.querySelector('.aim') as HTMLElement).hidden = !(IS_PC && document.pointerLockElement);
      } else {
        // the camera eases to the shot; looking round it
        const sh = O.shot, ease = Math.min(1, dt * 1.6), L = O.look;
        Vector3.LerpToRef(cam.position, sh.pos, ease, cam.position); Vector3.LerpToRef(O.camAt, sh.at, ease, O.camAt);
        let dir = O.camAt.subtract(cam.position); dir = Vector3.TransformNormal(dir, Matrix.RotationY(L.yaw)); const side = Vector3.Cross(dir, Vector3.Up()).normalize(); dir = Vector3.TransformNormal(dir, Matrix.RotationAxis(side, L.pitch));
        cam.setTarget(cam.position.add(dir));
        if (!L.drag) { L.yaw *= 1 - dt * 0.15; L.pitch *= 1 - dt * 0.15; }
      }
      // everyone in court
      const st = O.st, spk: Person | null = st && st.sp ? O.people[st.sp] : null, sh = spk ? headOf(spk) : null;
      for (const k in O.people) { const p: Person = O.people[k]; if (p.root.isEnabled()) posePerson(p, now, !!(st && st.talk && st.sp === k), k === (st && st.sp) ? null : sh, dt); }
      { const d = new Date(), hrs = (d.getHours() % 12 + d.getMinutes() / 60) / 12, mn = d.getMinutes() / 60; C.hands[0].rotation.z = hrs * Math.PI * 2; C.hands[1].rotation.z = mn * Math.PI * 2; }
      sc.render(); perfEnd();
    });
    // a hearing: the game's box goes over the hall, and the hearing starts
    if (hearing) setTimeout(() => { if (O.scene !== sc) return; gameOverlay(true); gameSend({ ampb: 'court', ready: 1 }); }, 450);
  },
  close() {
    const sc: Scene = O.scene; if (!sc) return;
    try { O.ctx.canvas.removeEventListener('pointerdown', O.pd); O.ctx.canvas.removeEventListener('pointerup', O.pu); } catch (e) { /* gone */ }
    perfDetach(); if (O.hud) O.hud.remove(); sc.dispose(); O.scene = null; O.people = {}; O.st = null;
  },
  onSettings(what: string) { apply(what === 'preset' ? 'all' : what); },
};
/** The camera on someone speaking: from in front of them, a little to one side, at about eye level. */
function shotOf(key: string) {
  const p: Person | undefined = key ? O.people[key] : undefined;
  if (!p) { O.shot = { pos: new Vector3(6.5, 3.4, 9.5), at: new Vector3(0, 1.4, -5) }; return; }
  const h = headOf(p), f = new Vector3(Math.sin(p.seat.yaw), 0, Math.cos(p.seat.yaw)), sd = new Vector3(f.z, 0, -f.x), judge = /^judge/.test(key);
  const far = judge ? 5.2 : p.seat.id === 'witness' ? 3.6 : /^relative/.test(key) ? 3.0 : 3.2, off = key === 'you' ? -1.1 : 0.9;
  const pos = h.add(f.scale(far)).add(sd.scale(off)); pos.y = h.y + (judge ? -0.25 : 0.15);
  pos.x = Math.max(-7.4, Math.min(7.4, pos.x)); pos.z = Math.max(-8.4, Math.min(10, pos.z));
  O.shot = { pos, at: h.add(new Vector3(0, judge ? -0.75 : -0.55, 0)) };   // the speaker above the game's dialogue box
}
// the hearing, as the game runs it
onGameCourt(d => {
  if (!O.scene || O.ctx == null) return;
  if (d.end) { gameOverlay(false); if (O.ctx.toGame) O.ctx.toGame(); return; }
  if (d.ex !== undefined) { courtExhibit(O.C, d.ex); return; }
  if (d.look) { const L = O.look; if (d.look === 'down') L.drag = true; else if (d.look === 'up') L.drag = false; else { L.yaw = Math.max(-1.2, Math.min(1.2, L.yaw - d.look[0])); L.pitch = Math.max(-0.5, Math.min(0.5, L.pitch - d.look[1])); } return; }
  if (d.st) {
    const st = d.st, prev = O.st; O.st = st;
    for (const k in st.ps) { const p: Person = O.people[k]; if (!p) continue; const [v, s] = st.ps[k]; p.root.setEnabled(!!v); p.want = s; }
    if (!prev || prev.shot !== st.shot) shotOf(st.shot);
  }
});
/** Into a spot in the empty courtroom, looking the natural way from there. */
function spot(k: string) { const s = SPOTS[k], F = O.F; if (!s || O.hearing) return; F.x = s[0]; F.z = s[1]; F.yaw = s[2]; F.floor = s[3]; F.pitch = -0.05; vibrate(30, 0.1, 0.2); }
function leave() { const ctx: SectionCtx = O.ctx; if (ctx.toGame) ctx.toGame(''); else if (ctx.back) ctx.back(); }
/** What is in the middle of the view (or where you tapped), within reach. */
function pick(px?: number, py?: number): string {
  const sc: Scene = O.scene, cv = O.ctx.canvas as HTMLCanvasElement; if (!sc) return '';
  const e = sc.getEngine(), x = px != null ? px * (e.getRenderWidth() / cv.clientWidth) : e.getRenderWidth() / 2, y = py != null ? py * (e.getRenderHeight() / cv.clientHeight) : e.getRenderHeight() / 2;
  const hit = sc.pick(x, y, (m: any) => !!(m.metadata && m.metadata.act));
  return hit && hit.hit && hit.distance < 2.6 && hit.pickedMesh ? (hit.pickedMesh as Mesh).metadata.act : '';
}
function use(px?: number, py?: number) {
  const a = pick(px, py), F = O.F, G = O.gate; if (!a) return;
  vibrate(60, 0.2, 0.3);
  if (a === 'door') return leave();
  if (a === 'gate') {
    const open = !G.want;
    if (!open && Math.abs(F.x) < 0.95 && Math.abs(F.z - 1.6) < 0.55) { toast('Step out of the gateway first'); return; }
    if (open) G.dir = F.z > 1.6 ? 1 : -1;   // it swings away from you
    G.want = open ? 1 : 0;
  }
}
registerSection(Court$);
