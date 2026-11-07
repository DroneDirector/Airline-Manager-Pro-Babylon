// The sky and the weather over the terminal, and the photographer's tools of the Terminal demo:
//  - the sky of the 3D viewer (sky.ts): its blue and its sunsets, the real sun, moon and stars for the time and the
//    place, and its volumetric cloud layer high overhead (base 2,100 m), lit by the sun;
//  - the clouds, from clear through scattered, broken and overcast to storms and thunderstorms with lightning (a bolt,
//    the flash lighting the clouds and the ground, the thunder after it, later the further away it struck);
//  - rain or snow falling round you outside (not indoors), heavier in a storm, with the haze closing in;
//  - the time of day on a slider, and a time-lapse: paused, 1×, 60×, 600×, 2000× or 3200×;
//  - Drone: a free camera you fly anywhere, through walls and up over the roofs (W A S D or the stick, Space / R up,
//    C / F down, Shift faster; on a touch screen the ▲ ▼ buttons);
//  - Photo: every piece of the interface is taken off the screen, the picture is taken, saved (Pictures / Airline
//    Manager Pro on Android and on the PC), and the interface comes back.
import { Scene, Vector3, Color3, Color4, ParticleSystem, GPUParticleSystem, DynamicTexture, Texture, MeshBuilder, Mesh, StandardMaterial, DirectionalLight, HemisphericLight, UniversalCamera, AbstractEngine, Tools, GlowLayer } from '@babylonjs/core';
import { makeSky, skyFrame, Sky } from '../viewer3d/sky';
import { sunAt, moonAt, dirOf, lst } from '../viewer3d/astro';
import { S } from '../../core/settings';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { savePhoto } from '../../core/photo';
import { toast } from '../../ui/icons';

/** The sun's height above the horizon at the airport now (degrees), for lights that come on at dusk (kept up by the weather each frame). */
export const SUN = { alt: 30, rain: 0, snow: 0, vis: 1 };

// ---- is the sun out? The sky's own cloud layer (the same noise as its shader, in single precision), sampled along
// the ray towards the sun: 1 in a clear sky or a gap in the clouds, 0 behind thick cloud ----
const fr = Math.fround;
const fract = (v: number) => fr(v - Math.floor(v));
function hash3(x: number, y: number, z: number) { x = fr(fract(fr(fr(x * 0.3183099) + 0.1)) * 17); y = fr(fract(fr(fr(y * 0.3183099) + 0.1)) * 17); z = fr(fract(fr(fr(z * 0.3183099) + 0.1)) * 17);
  return fract(fr(fr(fr(x * y) * z) * fr(fr(x + y) + z))); }
function noise3(x: number, y: number, z: number) { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz); const h = (a: number, b: number, c: number) => hash3(ix + a, iy + b, iz + c), m = (a: number, b: number, t: number) => a + (b - a) * t;
  return m(m(m(h(0, 0, 0), h(1, 0, 0), fx), m(h(0, 1, 0), h(1, 1, 0), fx), fy), m(m(h(0, 0, 1), h(1, 0, 1), fx), m(h(0, 1, 1), h(1, 1, 1), fx), fy), fz); }
function fbm3(x: number, y: number, z: number) { let a = 0.5, s = 0; for (let i = 0; i < 4; i++) { s += a * noise3(x, y, z); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.1; a *= 0.5; } return s; }
const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function cloudAt(px: number, h: number, pz: number, drift: number[], time: number, cover: number, BASE = 2100, TOP = 5600) {
  const hn = (h - BASE) / (TOP - BASE); if (hn < 0 || hn > 1) return 0; const gx = px + drift[0], gz = pz + drift[1];
  const big = noise3(gx * 0.000035, gz * 0.000035, 0.5) * 0.65 + noise3(gx * 0.00011, gz * 0.00011, 2.5) * 0.35;
  const shape = fbm3(gx * 0.00032 + time * 0.004, h * 0.00055, gz * 0.00032 + time * 0.002);
  const prof = smooth(0, 0.12, hn) * smooth(1, 0.35 + 0.35 * big, hn);
  return Math.max(0, Math.min(1, (shape * 0.9 + big * 0.75 - (1.55 - cover)) * prof * 2.4)); }
/** How much of the sun gets through the clouds to where you are (dir: towards the sun, alt: your height). */
export function sunThrough(dir: number[], alt: number, drift: number[], time: number, cover: number) {
  if (dir[1] <= 0.01) return 0; const t0 = (2100 - alt) / dir[1], t1 = (5600 - alt) / dir[1], n = 10, dt = (t1 - t0) / n; let sum = 0;
  for (let i = 0; i < n; i++) { const t = t0 + (i + 0.5) * dt; sum += cloudAt(dir[0] * t, alt + dir[1] * t, dir[2] * t, drift, time, cover); }
  return Math.exp(-sum * dt * 0.0022); }

const D2R = Math.PI / 180, LAT = 62.06, LON = -7.28;            // the airport's place on the Earth (for the sun, moon and stars)
const CLOUDQ: { [k: string]: [number, number] } = { low: [18, 2], medium: [30, 3], high: [46, 4], ultra: [72, 6] };
/** The kinds of sky: cloud cover, how dark the day, the haze, how hard it rains, lightning. */
export const CLOUDS: { [k: string]: { name: string; cover: number; dark: number; fog: number; wet: number; bolts: number } } = {
  clear: { name: 'Clear', cover: 0.12, dark: 0, fog: 0, wet: 0, bolts: 0 }, scattered: { name: 'Scattered', cover: 0.6, dark: 0.05, fog: 0, wet: 0, bolts: 0 },
  broken: { name: 'Broken', cover: 0.88, dark: 0.18, fog: 0.0004, wet: 0.6, bolts: 0 }, overcast: { name: 'Overcast', cover: 1.18, dark: 0.45, fog: 0.0012, wet: 0.8, bolts: 0 },
  storm: { name: 'Storm', cover: 1.38, dark: 0.68, fog: 0.0035, wet: 1.6, bolts: 0 }, thunder: { name: 'Thunderstorm', cover: 1.5, dark: 0.78, fog: 0.0045, wet: 2.0, bolts: 1 },
};
export const PRECIP = [['none', 'None'], ['rain', 'Rain'], ['snow', 'Snow']];
const SPEEDS = [0, 1, 60, 600, 2000, 3200];

/** The light of the sun at the ground: redder and weaker through more air low in the sky. */
function groundLight(altDeg: number): [number, number, number] {
  if (altDeg < -4) return [0, 0, 0];
  const a = Math.max(altDeg, -3.5), m = 1 / (Math.sin(Math.max(a, 0.5) * D2R) + 0.15 * Math.pow(Math.max(0.1, a + 3.885), -1.253)), fade = altDeg < 0 ? Math.max(0, (altDeg + 4) / 4) : 1;
  return [Math.exp(-m * 0.035) * fade, Math.exp(-m * 0.095) * fade, Math.exp(-m * 0.24) * fade];
}

export interface WxHooks { baseFog?: number; sc: Scene; engine: AbstractEngine; cam: UniversalCamera; sun: DirectionalLight; hemi: HemisphericLight; glow: GlowLayer; hud: HTMLElement; canvas: HTMLCanvasElement; indoors: () => boolean; centre: Vector3 }
export function makeWeather(h: WxHooks) {
  const { sc, cam, sun, hemi } = h;
  const sky: Sky = makeSky(sc); sky.dome.scaling.setAll(1700 / 30000); h.glow.addExcludedMesh(sky.dome);
  const day0 = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime(); })();
  const W: any = { t: day0 + (13 * 60 - LON * 4) * 60000, speed: 1, clouds: 'scattered', precip: 'none', cur: { ...CLOUDS.scattered, rain: 0, snow: 0 }, drift: [0, 0], ctime: 0,
    flash: 0, nextBolt: 4, bolts: [] as { m: Mesh; t: number }[], drone: false, D: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, keys: new Set<string>(), up: 0, down: 0, panel: false, shooting: false };
  const localMin = () => { const d = new Date(W.t); return ((d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + LON * 4) % 1440 + 1440) % 1440; };
  const setLocalMin = (v: number) => { let dm = v - localMin(); if (dm > 720) dm -= 1440; if (dm < -720) dm += 1440; W.t += dm * 60000; };

  // ---- rain and snow, falling round the camera ----
  const dropTex = (() => { const t = new DynamicTexture('wx-drop', { width: 16, height: 64 }, sc, false); const x = t.getContext() as CanvasRenderingContext2D; const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(220,230,245,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(6, 0, 4, 64); t.hasAlpha = true; t.update(); return t; })();
  const flakeTex = (() => { const t = new DynamicTexture('wx-flake', { width: 32, height: 32 }, sc, false); const x = t.getContext() as CanvasRenderingContext2D; const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); t.hasAlpha = true; t.update(); return t; })();
  // the rain and the snow are worked out by the graphics chip where it can (not by the processor); the same look
  const PS = (name: string, cap: number): ParticleSystem => (GPUParticleSystem.IsSupported ? new GPUParticleSystem(name, { capacity: cap }, sc) : new ParticleSystem(name, cap, sc)) as any;
  const rain = PS('wx-rain', IS_PC ? 9000 : 3500); rain.particleTexture = dropTex; rain.emitter = new Vector3(0, 14, 0); rain.minEmitBox = new Vector3(-22, 0, -22); rain.maxEmitBox = new Vector3(22, 2, 22);
  rain.direction1 = new Vector3(-0.08, -1, -0.04); rain.direction2 = new Vector3(0.08, -1, 0.04); rain.minEmitPower = 15; rain.maxEmitPower = 19; rain.minLifeTime = 0.9; rain.maxLifeTime = 1.05; rain.updateSpeed = 1 / 60;
  rain.minSize = 0.028; rain.maxSize = 0.04; rain.minScaleY = 14; rain.maxScaleY = 22; rain.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED; rain.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  rain.color1 = new Color4(0.78, 0.83, 0.9, 0.42); rain.color2 = new Color4(0.7, 0.76, 0.85, 0.32); rain.colorDead = new Color4(0.7, 0.76, 0.85, 0); rain.emitRate = 0; rain.start();
  const snow = PS('wx-snow', IS_PC ? 8000 : 3000); snow.particleTexture = flakeTex; snow.emitter = new Vector3(0, 16, 0); snow.minEmitBox = new Vector3(-26, 0, -26); snow.maxEmitBox = new Vector3(26, 3, 26);
  snow.direction1 = new Vector3(-0.35, -1, -0.25); snow.direction2 = new Vector3(0.35, -1, 0.25); snow.minEmitPower = 0.9; snow.maxEmitPower = 1.5; snow.minLifeTime = 9; snow.maxLifeTime = 13; snow.minSize = 0.03; snow.maxSize = 0.075;
  snow.minAngularSpeed = -1; snow.maxAngularSpeed = 1; snow.blendMode = ParticleSystem.BLENDMODE_STANDARD; snow.color1 = new Color4(1, 1, 1, 0.95); snow.color2 = new Color4(0.92, 0.95, 1, 0.85); snow.colorDead = new Color4(1, 1, 1, 0); snow.emitRate = 0; snow.start();

  // ---- lightning: a bolt, its flash, its thunder ----
  const boltMat = new StandardMaterial('wx-bolt', sc); boltMat.emissiveColor = new Color3(2.6, 2.8, 3.2); boltMat.disableLighting = true; boltMat.diffuseColor = Color3.Black();
  let actx: AudioContext | null = null;
  const thunder = (delay: number, dist: number) => { try { actx = actx || new ((window as any).AudioContext || (window as any).webkitAudioContext)(); const a = actx!, len = 3.5, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
      let v = 0; for (let i = 0; i < d.length; i++) { v = v * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = v; }
      const src = a.createBufferSource(), lp = a.createBiquadFilter(), g = a.createGain(); src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = dist < 600 ? 900 : 380; const t0 = a.currentTime + delay, k = Math.max(0.15, Math.min(1, 500 / dist)) * 0.9;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(k, t0 + (dist < 600 ? 0.05 : 0.4)); g.gain.exponentialRampToValueAtTime(0.001, t0 + len); src.connect(lp); lp.connect(g); g.connect(a.destination); src.start(t0); } catch (e) { /* no sound */ } };
  const strike = () => { const a = Math.random() * Math.PI * 2, dist = 260 + Math.random() * 520, bx = cam.position.x + Math.cos(a) * dist, bz = cam.position.z + Math.sin(a) * dist;
    const path: Vector3[] = []; let x = bx + (Math.random() - 0.5) * 60, z = bz + (Math.random() - 0.5) * 60; for (let y = 520; y >= 0; y -= 26) { path.push(new Vector3(x, y, z)); x += (Math.random() - 0.5) * 22; z += (Math.random() - 0.5) * 22; } path[path.length - 1].x = bx; path[path.length - 1].z = bz;
    const m = MeshBuilder.CreateTube('wx-bolt', { path, radius: 0.9, tessellation: 5 }, sc); m.material = boltMat; m.isPickable = false;
    for (let k = 0; k < 3; k++) { const s = path[3 + Math.floor(Math.random() * 10)], br: Vector3[] = [s]; let p = s.clone(); for (let i = 0; i < 6; i++) { p = p.add(new Vector3((Math.random() - 0.5) * 30, -18 - Math.random() * 14, (Math.random() - 0.5) * 30)); br.push(p); } const b = MeshBuilder.CreateTube('wx-bolt-b', { path: br, radius: 0.45, tessellation: 4 }, sc); b.material = boltMat; b.parent = m; }
    W.bolts.push({ m, t: 0.32 }); W.flash = 1; thunder(dist / 343, dist); };

  // ---- the panel and the buttons on the screen ----
  const ui = document.createElement('div'); ui.className = 'wx'; h.hud.appendChild(ui);
  const svg = (p: string) => `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="${p}"/></svg>`;
  const IC = { cloud: svg('M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.2 3.2 0 0 0 7 18Z'), drone: svg('M9 12h6M12 9v6M5 5l4 4M19 5l-4 4M5 19l4-4M19 19l-4-4M3 5h4M17 5h4M3 19h4M17 19h4'), camera: svg('M4 8h3l2-3h6l2 3h3v11H4V8Zm8 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z') };
  ui.innerHTML = `<div class="wx-tools"><button class="wx-b" data-wx="panel" aria-label="Weather and time">${IC.cloud}<span>Weather</span></button><button class="wx-b" data-wx="drone" aria-label="Drone: a free camera">${IC.drone}<span>Drone</span></button><button class="wx-b wx-shot" data-wx="photo" aria-label="Take a photo">${IC.camera}<span>Photo</span></button></div>
    <div class="wx-panel" hidden>
      <div class="wx-row"><small>Clouds</small><div class="wx-opts">${Object.entries(CLOUDS).map(([k, c]) => `<button class="wx-o" data-cl="${k}">${c.name}</button>`).join('')}</div></div>
      <div class="wx-row"><small>Rain or snow</small><div class="wx-opts">${PRECIP.map(([k, n]) => `<button class="wx-o" data-pr="${k}">${n}</button>`).join('')}</div></div>
      <div class="wx-row"><small>Time of day</small><div class="wx-time"><b class="wx-clock">--:--</b><input class="wx-slider" type="range" min="0" max="1439" step="1" aria-label="Time of day"></div></div>
      <div class="wx-row"><small>Time-lapse</small><div class="wx-opts">${SPEEDS.map(k => `<button class="wx-o" data-sp="${k}">${k ? k + '×' : 'Pause'}</button>`).join('')}</div></div>
    </div>
    <div class="wx-updown" hidden><button class="wx-b" data-wx="up" aria-label="Up">▲</button><button class="wx-b" data-wx="down" aria-label="Down">▼</button></div>
    <div class="wx-dronehint" hidden>Drone · ${IS_TOUCH ? 'left thumb: fly · right: look · ▲ ▼ up and down' : 'W A S D fly · mouse look · Space / R up · C / F down · Shift faster · V back to walking'}</div>`;
  const $ = (s: string) => ui.querySelector(s) as HTMLElement, slider = $('.wx-slider') as HTMLInputElement;
  const mark = () => { ui.querySelectorAll('[data-cl]').forEach(b => b.classList.toggle('on', b.getAttribute('data-cl') === W.clouds)); ui.querySelectorAll('[data-pr]').forEach(b => b.classList.toggle('on', b.getAttribute('data-pr') === W.precip));
    ui.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', Number(b.getAttribute('data-sp')) === W.speed)); $('[data-wx="drone"]').classList.toggle('on', W.drone); $('[data-wx="panel"]').classList.toggle('on', W.panel); };
  const setDrone = (on: boolean) => { W.drone = on; if (on) { const p = cam.position, f = cam.getDirection(Vector3.Forward()); W.D = { x: p.x, y: p.y + 0.5, z: p.z, yaw: Math.atan2(f.x, f.z), pitch: Math.asin(Math.max(-1, Math.min(1, f.y))) }; cam.maxZ = 1600; } else cam.maxZ = 900;
    $('.wx-updown').hidden = !(on && IS_TOUCH); $('.wx-dronehint').hidden = !on; toast(on ? 'Drone: fly anywhere' : 'Back to walking'); mark(); };
  const hold = (k: 'up' | 'down', v: number) => { W[k] = v; };
  ui.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button') as HTMLElement | null; if (!b) return; e.stopPropagation();
    const a = b.getAttribute('data-wx'); if (a === 'panel') { W.panel = !W.panel; $('.wx-panel').hidden = !W.panel; } else if (a === 'drone') setDrone(!W.drone); else if (a === 'photo') photo();
    if (b.hasAttribute('data-cl')) W.clouds = b.getAttribute('data-cl'); if (b.hasAttribute('data-pr')) W.precip = b.getAttribute('data-pr'); if (b.hasAttribute('data-sp')) W.speed = Number(b.getAttribute('data-sp')); mark(); });
  for (const k of ['up', 'down'] as const) { const b = $(`[data-wx="${k}"]`); b.addEventListener('pointerdown', e => { e.stopPropagation(); hold(k, 1); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => hold(k, 0)); }
  ui.addEventListener('pointerdown', e => e.stopPropagation());
  slider.addEventListener('input', () => { W.sliding = true; setLocalMin(Number(slider.value)); }); slider.addEventListener('change', () => { W.sliding = false; });
  const kd = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); W.keys.add(k); if (e.repeat) return; if (k === 'v') setDrone(!W.drone); else if (k === 'p') photo(); else if (k === 't') { W.panel = !W.panel; $('.wx-panel').hidden = !W.panel; mark(); } };
  const ku = (e: KeyboardEvent) => W.keys.delete(e.key.toLowerCase()); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  mark();

  // ---- the photo: the interface off, the picture taken and saved, the interface back ----
  async function photo() {
    if (W.shooting) return; W.shooting = true; const hidden: [HTMLElement, string][] = [];
    const hide = (el: Element) => { for (const c of Array.from(el.children)) { const e = c as HTMLElement; if (e === h.canvas || e.tagName === 'SCRIPT') continue; if (e.contains(h.canvas)) { hide(e); continue; } hidden.push([e, e.style.visibility]); e.style.visibility = 'hidden'; } };
    hide(document.body);
    try { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const url = await Tools.CreateScreenshotAsync(h.engine, cam, { precision: 1 }, 'image/png');
      const d = new Date(), p = (n: number) => String(n).padStart(2, '0'), name = `AMP-photo-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
      for (const [e, v] of hidden) e.style.visibility = v; hidden.length = 0;
      const where = await savePhoto(url, name); toast(`Photo saved · ${where}`);
    } catch (e: any) { toast('The photo couldn\'t be saved' + (e && e.message ? ': ' + e.message : '')); }
    finally { for (const [e, v] of hidden) e.style.visibility = v; W.shooting = false; }
  }

  // ---- each frame ----
  let envT = 0;
  return {
    get drone() { return W.drone as boolean; },
    /** The drone: flies the camera (true while it is in charge of it). */
    droneStep(dt: number, inp: { lx: number; ly: number; mx: number; my: number; run: boolean }): boolean {
      if (!W.drone) return false; const D = W.D, ks = W.keys;
      D.yaw += inp.lx; D.pitch = Math.max(-1.55, Math.min(1.55, D.pitch - inp.ly));
      const sp = (inp.run || ks.has('shift') ? 26 : 7) * dt, cp = Math.cos(D.pitch), f = new Vector3(Math.sin(D.yaw) * cp, Math.sin(D.pitch), Math.cos(D.yaw) * cp), r = new Vector3(Math.cos(D.yaw), 0, -Math.sin(D.yaw));
      const v = f.scale(inp.my).add(r.scale(inp.mx)); const vert = (ks.has(' ') || ks.has('r') || W.up ? 1 : 0) - (ks.has('c') || ks.has('f') || W.down ? 1 : 0);
      D.x += v.x * sp; D.y = Math.max(0.3, Math.min(900, D.y + v.y * sp + vert * sp * 0.8)); D.z += v.z * sp;
      cam.position.set(D.x, D.y, D.z); cam.setTarget(cam.position.add(f)); return true; },
    frame(dt: number, now: number) {
      if (!W.sliding) W.t += dt * 1000 * W.speed;
      // ease towards the chosen weather
      const tgt = CLOUDS[W.clouds], c = W.cur, k = Math.min(1, dt * 0.8);
      for (const p of ['cover', 'dark', 'fog', 'bolts'] as const) c[p] += (tgt[p] - c[p]) * k;
      const wantRain = W.precip === 'rain' ? Math.max(0.5, tgt.wet) : 0, wantSnow = W.precip === 'snow' ? Math.max(0.5, tgt.wet * 0.8) : 0; c.rain += (wantRain - c.rain) * k; c.snow += (wantSnow - c.snow) * k;
      // the sun, the moon, the stars
      const s = sunAt(W.t, LAT, LON), m = moonAt(W.t, LAT, LON), sd = dirOf(s), md = dirOf(m), gl = groundLight(s.alt); SUN.alt = s.alt; SUN.rain = c.rain; SUN.snow = c.snow;
      const phase = (1 - (sd[0] * md[0] + sd[1] * md[1] + sd[2] * md[2])) / 2, moonK = m.alt > -1 ? 0.06 * phase * Math.min(1, (m.alt + 1) / 6) : 0, nightK = Math.max(0, Math.min(1, (-s.alt - 1) / 7));
      const lit = s.alt > -3 || moonK < 0.002 ? sd : md; let lc: number[] = s.alt > -3 ? gl : [moonK * 0.75, moonK * 0.85, moonK * 1.1];
      const dim = 1 - c.dark * 0.8; lc = lc.map(v => v * dim);
      W.flash = Math.max(0, W.flash - dt * 5); const fl = W.flash > 0 ? W.flash * (0.6 + 0.4 * Math.sin(now * 90)) : 0;
      const q = CLOUDQ[S.gfx.clouds] || CLOUDQ.medium;
      W.drift[0] += dt * W.speed * 7 * (1 + c.dark * 2); W.drift[1] += dt * W.speed * 3; W.ctime += dt * Math.min(W.speed, 60) * (1 + c.dark);
      sky.dome.position.copyFrom(cam.position);
      skyFrame(sky, { sun: sd, sunCol: gl.map(v => v * (1 - c.dark * 0.6)), moon: md, lit, litCol: lc.map((v, i) => v + fl * (i === 2 ? 2.6 : 2.2)), alt: 40 + Math.max(0, cam.position.y), drift: W.drift, time: W.ctime, cover: c.cover,
        steps: q[0], lsteps: q[1], lat: LAT * D2R, lst: lst(W.t, LON) * D2R, starK: Math.min(1.4, nightK * 1.4) * (1 - Math.min(1, c.cover * 0.8)), nightK, gnd: 0, landK: 1 });
      // the light on the terminal
      const mx = Math.max(lc[0], lc[1], lc[2], 1e-4); sun.direction = new Vector3(-lit[0], -lit[1], -lit[2]); sun.position = h.centre.add(new Vector3(lit[0] * 220, lit[1] * 220, lit[2] * 220));
      sun.diffuse = new Color3(lc[0] / mx, lc[1] / mx, lc[2] / mx); const through = s.alt > -3 ? sunThrough(sd, 40 + Math.max(0, cam.position.y), W.drift, W.ctime, c.cover) : 1; SUN.vis += (through - SUN.vis) * Math.min(1, dt * 2.5);
      sun.intensity = mx * 2.4 * (0.35 + 0.65 * SUN.vis); sun.shadowEnabled = mx > 0.03 && c.dark < 0.55 && SUN.vis > 0.25;
      const day = Math.max(0, Math.min(1, (s.alt + 6) / 16)) * (1 - c.dark * 0.55);
      hemi.diffuse = Color3.Lerp(new Color3(0.05, 0.06, 0.12), new Color3(0.82, 0.88, 0.98), day); hemi.groundColor = Color3.Lerp(new Color3(0.03, 0.03, 0.05), new Color3(0.45, 0.42, 0.38), day);
      hemi.intensity = 0.18 + 0.8 * day + moonK * 2 + fl * 1.6;
      // the haze, darker and closer in a storm
      const fogC = Color3.Lerp(new Color3(0.06, 0.07, 0.1), new Color3(0.68, 0.73, 0.8).scale(1 - c.dark * 0.45), day).add(new Color3(fl * 0.4, fl * 0.42, fl * 0.5));
      const fogD = Math.max(h.baseFog || 0, c.fog + c.rain * 0.0008 + c.snow * 0.002);
      if (fogD > 0.0002 || h.baseFog) { if (sc.fogMode !== Scene.FOGMODE_EXP2) sc.fogMode = Scene.FOGMODE_EXP2; sc.fogDensity = fogD; sc.fogColor = fogC; } else if (sc.fogMode !== Scene.FOGMODE_NONE) sc.fogMode = Scene.FOGMODE_NONE;
      // rain and snow round the camera, outside only
      const inside = h.indoors();
      (rain.emitter as Vector3).set(cam.position.x, cam.position.y + 14, cam.position.z); (snow.emitter as Vector3).set(cam.position.x, cam.position.y + 16, cam.position.z);
      rain.emitRate = inside ? 0 : c.rain * (IS_PC ? 4200 : 1800); snow.emitRate = inside ? 0 : c.snow * (IS_PC ? 700 : 320);
      const wind = 0.08 + c.dark * 0.35; rain.direction1.set(wind - 0.06, -1, -0.04); rain.direction2.set(wind + 0.06, -1, 0.04);
      // lightning
      if (c.bolts > 0.5) { W.nextBolt -= dt; if (W.nextBolt <= 0) { strike(); W.nextBolt = 3 + Math.random() * 9; if (Math.random() < 0.3) setTimeout(() => { if (W.flash < 0.3) W.flash = 0.8; }, 120); } }
      for (let i = W.bolts.length - 1; i >= 0; i--) { const b = W.bolts[i]; b.t -= dt; b.m.visibility = b.t > 0.2 ? 1 : Math.max(0, b.t / 0.2) * (Math.random() > 0.3 ? 1 : 0.2); if (b.t <= 0) { b.m.dispose(); W.bolts.splice(i, 1); } }
      // the sky's reflection on glass and paint: now and then, more often in a fast time-lapse
      if (sc.environmentTexture && now > envT) { const pr: any = (sc as any).reflectionProbes && (sc as any).reflectionProbes[0]; if (pr) { pr.cubeTexture.resetRefreshCounter(); } envT = now + (W.speed >= 600 ? 4 : 30); }
      // the clock
      const lm = localMin(); if (!W.sliding) slider.value = String(Math.round(lm)); $('.wx-clock').textContent = `${String(Math.floor(lm / 60)).padStart(2, '0')}:${String(Math.floor(lm % 60)).padStart(2, '0')}`;
    },
    dispose() { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); try { rain.dispose(); snow.dispose(); } catch (e) { /* gone */ } ui.remove(); if (actx) actx.close().catch(() => { /* gone */ }); },
  };
}
export type Weather = ReturnType<typeof makeWeather>;
void Texture;
