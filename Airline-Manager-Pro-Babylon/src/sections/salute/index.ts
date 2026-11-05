// A water salute, on Babylon.js: the first time one of your aircraft lands at an airport it has never been to, the
// airport's fire service welcomes it. Two fire trucks stand either side of the taxiway and spray water from their roof
// cannons; the jets cross high above in an arch, and the aircraft taxis underneath. The water is droplets thrown from
// each cannon on their real arcs (gravity, 9.81 m/s²), with spray and mist where they fall. The sky, the sun and the
// light are the airport's own, now. Opened from the game (the news article's 3D button, or as it happens).
import {
  Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, ShadowGenerator, GlowLayer, DefaultRenderingPipeline,
  ImageProcessingConfiguration, MeshBuilder, PBRMaterial, StandardMaterial, DynamicTexture, ParticleSystem, Mesh, TransformNode, SpotLight, Texture,
} from '@babylonjs/core';
import { registerSection, Section, SectionCtx } from '../../core/sections';
import { S } from '../../core/settings';
import { runLoop } from '../../core/engine';
import { inputFrame } from '../../core/input';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { icon, esc, toast } from '../../ui/icons';
import { perfAttach, perfDetach, perfShow, perfBegin, perfEnd } from '../../core/perf-meter';
import { makeSky, skyFrame, Sky } from '../viewer3d/sky';
import { buildAirliner, repaint, setGear, Airliner } from '../viewer3d/airliner';
import { sunAt, moonAt, dirOf, sunlight, lst } from '../viewer3d/astro';
import * as P from '../lounge/pictures';

const D2R = Math.PI / 180, G = 9.81, TRUCK_X = 32, ARCH_H = 24, TAXI = 7;   // m, m, m/s
const X: any = { scene: null as Scene | null };
const VIEWS: [string, string, [number, number, number]][] = [['side', 'Side', [70, 14, 0]], ['arch', 'Under the arch', [6, 3, -40]], ['behind', 'Behind', [0, 8, -70]], ['truck', 'From a truck', [TRUCK_X - 3, 4.5, 12]], ['high', 'High', [40, 60, -50]]];

/** A fire truck: the red body, the cab, six wheels, the roof cannon, the blue lights. */
function truck(sc: Scene, x: number, face: number): { root: TransformNode; nozzle: Vector3; lights: Mesh[] } {
  const root = new TransformNode('truck', sc), red = new PBRMaterial('red', sc), dark = new PBRMaterial('tyre', sc), chrome = new PBRMaterial('chrome', sc), glass = new PBRMaterial('glass', sc);
  red.albedoColor = Color3.FromHexString('#C81E1E'); red.metallic = 0.3; red.roughness = 0.35; red.clearCoat.isEnabled = true;
  dark.albedoColor = Color3.FromHexString('#16171A'); dark.roughness = 0.85; chrome.albedoColor = Color3.FromHexString('#DDE2E8'); chrome.metallic = 1; chrome.roughness = 0.2; glass.albedoColor = Color3.FromHexString('#22303C'); glass.roughness = 0.05; glass.metallic = 0.5;
  const box = (w: number, h: number, d: number, m: any, px: number, py: number, pz: number) => { const b = MeshBuilder.CreateBox('tb', { width: w, height: h, depth: d }, sc); b.position.set(px, py, pz); b.material = m; b.parent = root; b.receiveShadows = true; return b; };
  box(3.0, 2.4, 9.0, red, 0, 2.1, -0.6); box(3.0, 1.9, 2.6, red, 0, 1.85, 4.6); box(2.9, 0.9, 0.05, glass, 0, 2.3, 5.92); box(0.05, 0.8, 1.6, glass, 1.51, 2.3, 4.7); box(0.05, 0.8, 1.6, glass, -1.51, 2.3, 4.7);
  box(3.1, 0.15, 10.4, chrome, 0, 0.95, 0.4); box(2.8, 0.06, 0.4, new PBRMaterial('w', sc), 0, 3.32, 1.0);
  for (const z of [-3.6, -1.2, 4.2]) for (const s of [-1, 1]) { const w = MeshBuilder.CreateCylinder('wheel', { diameter: 1.25, height: 0.5, tessellation: 20 }, sc); w.rotation.z = Math.PI / 2; w.position.set(s * 1.35, 0.62, z); w.material = dark; w.parent = root; }
  // the roof cannon, aimed across the taxiway
  const turret = MeshBuilder.CreateCylinder('turret', { diameter: 0.6, height: 0.4 }, sc); turret.position.set(0, 3.5, 1.5); turret.material = chrome; turret.parent = root;
  const barrel = MeshBuilder.CreateCylinder('barrel', { diameterTop: 0.16, diameterBottom: 0.26, height: 1.6 }, sc); barrel.position.set(-0.55 * face, 4.0, 1.5); barrel.rotation.z = face * (Math.PI / 2 - 0.99); barrel.material = chrome; barrel.parent = root;
  const blue = new StandardMaterial('blue', sc); blue.emissiveColor = Color3.FromHexString('#2A6BFF'); blue.disableLighting = true;
  const lights: Mesh[] = []; for (const s of [-1, 1]) { const l = MeshBuilder.CreateBox('blue', { width: 0.5, height: 0.18, depth: 0.3 }, sc); l.position.set(s * 0.9, 2.9, 5.6); l.material = blue; l.parent = root; lights.push(l); }
  root.position.set(x, 0, 0); root.rotation.y = face > 0 ? 0 : 0;
  return { root, nozzle: new Vector3(x - 1.2 * face, 4.6, 1.5), lights };
}
/** The water from one cannon: droplets on their arcs across the taxiway, then spray and mist where they come down. */
function water(sc: Scene, from: Vector3, face: number, tex: Texture): ParticleSystem[] {
  const hi = S.gfx.particles === 'high', vy = Math.sqrt(2 * G * ARCH_H), t = vy / G, vx = (Math.abs(from.x) / t) * -Math.sign(from.x), v = Math.hypot(vx, vy);
  const jet = new ParticleSystem('jet', hi ? 6000 : 2200, sc); jet.particleTexture = tex; jet.emitter = from.clone();
  jet.minEmitBox = new Vector3(-0.05, -0.05, -0.05); jet.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
  jet.direction1 = new Vector3(vx / v - 0.02, vy / v - 0.01, -0.025); jet.direction2 = new Vector3(vx / v + 0.02, vy / v + 0.01, 0.025);
  jet.minEmitPower = v * 0.97; jet.maxEmitPower = v * 1.02; jet.gravity = new Vector3(0, -G, 0); jet.updateSpeed = 1 / 60;
  jet.minLifeTime = 2 * t * 0.95; jet.maxLifeTime = 2 * t * 1.05; jet.emitRate = hi ? 1300 : 500; jet.minSize = 0.25; jet.maxSize = 0.6;
  jet.addSizeGradient(0, 0.25); jet.addSizeGradient(0.5, 0.9); jet.addSizeGradient(1, 1.6);
  jet.color1 = new Color4(0.86, 0.92, 1, 0.55); jet.color2 = new Color4(0.95, 0.98, 1, 0.45); jet.colorDead = new Color4(1, 1, 1, 0); jet.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  const mist = new ParticleSystem('mist', hi ? 1600 : 500, sc); mist.particleTexture = tex; mist.emitter = new Vector3(-from.x * 0.9, 0.5, from.z);
  mist.minEmitBox = new Vector3(-6, 0, -4); mist.maxEmitBox = new Vector3(6, 2, 4); mist.direction1 = new Vector3(-1, 0.5, -1); mist.direction2 = new Vector3(1, 1.5, 1); mist.minEmitPower = 0.5; mist.maxEmitPower = 2.2; mist.updateSpeed = 1 / 60;
  mist.minLifeTime = 1.6; mist.maxLifeTime = 3.4; mist.emitRate = hi ? 380 : 120; mist.minSize = 1.5; mist.maxSize = 4.5; mist.gravity = new Vector3(0, -0.6, 0);
  mist.color1 = new Color4(0.92, 0.95, 1, 0.18); mist.color2 = new Color4(1, 1, 1, 0.1); mist.colorDead = new Color4(1, 1, 1, 0);
  void face; return [jet, mist];
}

const Salute: Section = {
  id: 'salute', title: 'Water salute',
  async open(ctx: SectionCtx) {
    const { engine, ui, progress } = ctx; X.ctx = ctx;
    const D: any = Object.assign({ airline: '', reg: '', color: '#1C2A4A', color2: '#3FD3E6', airport: '', city: '', lat: 60, lon: 0 }, (ctx.opts && ctx.opts.data) || {}); X.D = D;
    progress(10, 'The fire trucks are rolling out…'); await new Promise(r => setTimeout(r, 30));
    const sc = new Scene(engine); X.scene = sc; sc.clearColor = new Color4(0, 0, 0, 1);
    const sky = makeSky(sc) as Sky; X.sky = sky;
    // the airport round the taxiway: grass, the taxiway with its yellow centre line and blue edge lights, the apron
    const ground = MeshBuilder.CreateGround('grass', { width: 3000, height: 3000 }, sc); const gm = new PBRMaterial('grassM', sc); const gt = new DynamicTexture('grassT', { width: 512, height: 512 }, sc, true); { const c = P.noise('#56693C', 22, 5); (gt.getContext() as any).drawImage(c, 0, 0); gt.update(true); } gt.uScale = gt.vScale = 120; gm.albedoTexture = gt; gm.roughness = 0.95; ground.material = gm; ground.receiveShadows = true;
    const tw = MeshBuilder.CreateGround('taxiway', { width: 23, height: 2000 }, sc); tw.position.y = 0.03; const tm = new PBRMaterial('twM', sc); const tt = new DynamicTexture('twT', { width: 256, height: 2048 }, sc, true);
    { const x = tt.getContext() as CanvasRenderingContext2D; x.fillStyle = '#3B3E42'; x.fillRect(0, 0, 256, 2048); for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '25,26,28' : '80,82,86'},.25)`; x.fillRect(Math.random() * 256, Math.random() * 2048, 2, 6); } x.fillStyle = '#E8B820'; x.fillRect(124, 0, 8, 2048); x.fillStyle = '#C9C2A6'; x.fillRect(8, 0, 5, 2048); x.fillRect(243, 0, 5, 2048); tt.update(true); }
    tt.vScale = 20; tm.albedoTexture = tt; tm.roughness = 0.8; tm.zOffset = -1; tw.material = tm; tw.receiveShadows = true;
    const blueL = new StandardMaterial('edgeL', sc); blueL.emissiveColor = Color3.FromHexString('#3060FF'); blueL.disableLighting = true;
    const edge = MeshBuilder.CreateSphere('edge', { diameter: 0.35, segments: 4 }, sc); edge.material = blueL; const eb: number[] = [];
    for (let z = -400; z <= 400; z += 30) for (const s of [-1, 1]) { const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, s * 13, 0.25, z, 1]; eb.push(...m); }
    edge.thinInstanceSetBuffer('matrix', new Float32Array(eb), 16, true);
    progress(40, 'The aircraft is on its way in…');
    const ac = buildAirliner(sc) as Airliner; repaint(ac, D.color, D.color2); setGear(ac, 1); X.ac = ac; ac.root.position.y = 3.9;
    const taxiL = new SpotLight('taxiL', new Vector3(0, -1.7, 13.5), new Vector3(0, -0.12, 1).normalize(), 0.7, 6, sc); taxiL.parent = ac.root; taxiL.intensity = 60; taxiL.range = 500; X.taxiL = taxiL;
    const tA = truck(sc, -TRUCK_X, 1), tB = truck(sc, TRUCK_X, -1); X.trucks = [tA, tB];
    // the light of the airport, now
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), sc); X.hemi = hemi;
    const sun = new DirectionalLight('sun', new Vector3(0, -1, 0), sc); sun.autoUpdateExtends = true; X.sun = sun;
    const cam = new UniversalCamera('cam', new Vector3(70, 14, 0), sc); cam.minZ = 0.3; cam.maxZ = 20000; cam.inertia = 0; cam.fov = S.gfx.fov * D2R; X.cam = cam; sc.activeCamera = cam;
    progress(70, 'Filling the tanks…');
    const drop = new DynamicTexture('drop', { width: 64, height: 64 }, sc, false); { const x = drop.getContext() as CanvasRenderingContext2D, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(235,245,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); drop.hasAlpha = true; drop.update(); }
    X.water = [...water(sc, tA.nozzle, 1, drop), ...water(sc, tB.nozzle, -1, drop)];
    if (S.gfx.shadows !== 'off') { const sg = new ShadowGenerator(S.gfx.shadows === 'high' ? 2048 : 1024, sun); sg.usePercentageCloserFiltering = true; for (const m of ac.casters) sg.addShadowCaster(m, false); for (const t of X.trucks) t.root.getChildMeshes().forEach((m: any) => sg.addShadowCaster(m, false)); X.sg = sg; }
    X.glow = new GlowLayer('glow', sc, { mainTextureRatio: IS_PC ? 0.5 : 0.35 }); X.glow.intensity = 0.9; X.glow.isEnabled = S.gfx.glow;
    const dp = new DefaultRenderingPipeline('dp', true, sc, [cam]); dp.fxaaEnabled = S.gfx.aa === 'fxaa'; dp.samples = S.gfx.aa === 'msaa' ? 4 : 1; dp.bloomEnabled = S.gfx.bloom; dp.bloomThreshold = 0.85; dp.bloomWeight = 0.3;
    dp.imageProcessingEnabled = true; dp.imageProcessing.toneMappingEnabled = S.gfx.aces; dp.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; dp.imageProcessing.exposure = S.gfx.exposure * 1.1;
    // on the screen
    const hud = document.createElement('div'); hud.className = 'hud v3d-hud'; X.hud = hud;
    hud.innerHTML = `<div class="v3d"><div class="v3d-top">${ctx.toGame ? `<button class="v3d-b" data-v="game">${icon('back')}<span>Back to the game</span></button>` : ''}<div class="v3d-info"><b class="v3d-cs">Water salute · ${esc(D.airport)}</b><small class="v3d-al">${esc([D.airline, D.reg, D.city ? 'first visit to ' + D.city : ''].filter(Boolean).join(' · '))}</small></div></div>
      <div class="v3d-views">${VIEWS.map(([k, l], i) => `<button class="v3d-b ${i === 0 ? 'on' : ''}" data-view="${k}">${esc(l)}</button>`).join('')}<button class="v3d-b" data-v="again">${icon('play')}Watch again</button></div><div class="v3d-perf"></div></div>`;
    ui.appendChild(hud); perfAttach(engine, sc, hud.querySelector('.v3d-perf') as HTMLElement); perfShow();
    X.view = 'side'; X.uYaw = 0; X.uPitch = 0; X.zoom = 1; X.z = -160; X.t0 = performance.now();
    hud.addEventListener('click', (e: Event) => { const b = (e.target as HTMLElement).closest('button') as HTMLElement; if (!b) return;
      if (b.hasAttribute('data-view')) { X.view = b.getAttribute('data-view'); X.uYaw = 0; X.uPitch = 0; X.zoom = 1; hud.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x === b)); }
      else if (b.getAttribute('data-v') === 'again') X.z = -160; else if (b.getAttribute('data-v') === 'game' && ctx.toGame) ctx.toGame(''); });
    X.wheel = (e: WheelEvent) => { X.zoom = Math.max(0.4, Math.min(3, X.zoom * Math.exp(e.deltaY * 0.0012))); e.preventDefault(); }; ctx.canvas.addEventListener('wheel', X.wheel, { passive: false });
    for (const p of X.water) p.start();
    toast(IS_TOUCH ? 'Drag on the right to look round' : 'Click the view and move the mouse to look round · the wheel zooms');
    let flashT = 0;
    runLoop(() => {
      perfBegin();
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000), now = performance.now() / 1000, inp = inputFrame(dt);
      // the aircraft taxis through the arch, then again from the start
      X.z += TAXI * dt; if (X.z > 220) X.z = -160; ac.root.position.z = X.z; for (const f of ac.fans) f.rotation.z += dt * 8;
      const strobe = now % 1.25; for (const m of ac.strobes) m.isVisible = strobe < 0.05; const bc = Math.max(0, 1 - Math.abs(((now % 1.05) - 0.08) / 0.1)); for (const m of ac.beacons) m.visibility = bc;
      if (now > flashT) { flashT = now + 0.18; for (const t of X.trucks) t.lights.forEach((l: Mesh, i: number) => l.isVisible = ((Math.floor(now * 5.5) + i) % 2) === 0); }
      // the light of the airport now: the sun, the moon, the sky
      const ms = Date.now(), s = sunAt(ms, D.lat, D.lon), m = moonAt(ms, D.lat, D.lon), sd = dirOf(s), md = dirOf(m), scol = sunlight(s.alt), mx = Math.max(scol[0], scol[1], scol[2], 1e-4), day = Math.max(0, Math.min(1, (s.alt + 6) / 16));
      skyFrame(sky, { sun: sd, sunCol: scol, moon: md, lit: sd, litCol: scol, alt: Math.max(2, cam.position.y), drift: [0, 0], time: now, cover: 0.7, steps: 24, lsteps: 2, lat: D.lat * D2R, lst: lst(ms, D.lon) * D2R, starK: Math.max(0, Math.min(1.4, (-s.alt - 1) / 7 * 1.4)), nightK: 0, gnd: 0, landK: 1 });
      sky.dome.position.copyFrom(cam.position);
      sun.direction = new Vector3(-sd[0], -sd[1], -sd[2]); sun.position = new Vector3(sd[0] * 150, sd[1] * 150, sd[2] * 150); sun.diffuse = new Color3(scol[0] / mx, scol[1] / mx, scol[2] / mx); sun.intensity = mx * 3.2;
      hemi.diffuse = Color3.Lerp(new Color3(0.03, 0.04, 0.08), new Color3(0.45, 0.56, 0.82), day); hemi.groundColor = Color3.Lerp(new Color3(0.02, 0.02, 0.03), new Color3(0.32, 0.36, 0.24), day); hemi.intensity = 0.3 + 0.6 * day;
      X.taxiL.setEnabled(s.alt < 4);
      // the camera
      X.uYaw += inp.lx; X.uPitch = Math.max(-1, Math.min(1, X.uPitch + inp.ly)); X.zoom = Math.max(0.4, Math.min(3, X.zoom * Math.exp(-inp.my * dt * 1.4)));
      const v = VIEWS.filter(q => q[0] === X.view)[0][2], at = new Vector3(0, 6, X.view === 'truck' || X.view === 'high' ? X.z * 0.6 : X.z);
      const off = new Vector3(v[0], v[1], v[2]).scale(X.zoom), cy = Math.cos(X.uYaw), sy = Math.sin(X.uYaw), rx = off.x * cy - off.z * sy, rz = off.x * sy + off.z * cy;
      const eye = X.view === 'truck' ? new Vector3(v[0], v[1], v[2]) : new Vector3(rx, Math.max(1.6, off.y + X.uPitch * 20), at.z + rz);
      cam.position.copyFrom(eye); cam.setTarget(X.view === 'truck' ? new Vector3(0, 10 + X.uPitch * 20, X.z * 0.3 + X.uYaw * 40) : at);
      sc.render(); perfEnd();
    });
    void Texture;
  },
  close() {
    const sc: Scene = X.scene; if (!sc) return;
    try { X.ctx.canvas.removeEventListener('wheel', X.wheel); } catch (e) { /* gone */ }
    perfDetach(); if (X.hud) X.hud.remove(); sc.dispose(); X.scene = null;
  },
  onSettings(what: string) { if (what === 'glow' && X.glow) X.glow.isEnabled = S.gfx.glow; },
};
registerSection(Salute);
export {};
