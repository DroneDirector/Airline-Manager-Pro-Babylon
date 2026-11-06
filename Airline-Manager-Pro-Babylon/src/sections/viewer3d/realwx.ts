// Real weather in the 3D viewer: the nearest real airport report where the aircraft is, asked of the game every
// half minute. It sets the cloud cover, the cloud base and how deep the layer is, darkens the light under heavy cloud
// and storms, blows the clouds with the reported wind, and below the cloud base brings rain or snow round the camera
// and, in a thunderstorm, lightning with its flash and thunder. A chip on the screen shows the station and the report.
import { Scene, Vector3, Color3, Color4, Mesh, MeshBuilder, StandardMaterial, ParticleSystem, DynamicTexture, Camera } from '@babylonjs/core';
import { gameSend, onGameWx } from '../../ui/game-frame';
import { IS_PC } from '../../core/app';

export interface RealWx { cover: number; base: number; top: number; dark: number; frame(dt: number, o: { lat: number; lon: number; alt: number; gnd: number; drift: number[] }): void; chip(): string; toggle(): boolean; on(): boolean; dispose(): void }

let last: any = null;
let subscribed = false;
const listeners: ((d: any) => void)[] = [];

export function makeRealWx(sc: Scene, cam: () => Camera, hud: HTMLElement): RealWx {
  if (!subscribed) { subscribed = true; onGameWx(d => { for (const f of listeners) f(d); }); }
  const S: any = { rep: null as any, on: true, ask: 0, cover: 0.82, base: 2100, top: 5600, dark: 0, rain: 0, snow: 0, bolt: 0, next: 6, bolts: [] as { m: Mesh; t: number }[] };
  const got = (d: any) => { S.rep = d && !d.none ? d : null; last = S.rep; };
  listeners.push(got); if (last) S.rep = last;

  // rain and snow round the camera: particles that move with it (so they still fall past a moving aircraft)
  const em = MeshBuilder.CreateBox('rwx-em', { size: 0.1 }, sc); em.isVisible = false; em.isPickable = false;
  const tex = (n: string, w: number, h: number, f: (x: CanvasRenderingContext2D) => void) => { const t = new DynamicTexture(n, { width: w, height: h }, sc, false); f(t.getContext() as CanvasRenderingContext2D); t.hasAlpha = true; t.update(); return t; };
  const drop = tex('rwx-drop', 16, 64, x => { const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(220,230,245,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(6, 0, 4, 64); });
  const flake = tex('rwx-flake', 32, 32, x => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); });
  const rain = new ParticleSystem('rwx-rain', IS_PC ? 9000 : 3500, sc); rain.particleTexture = drop; rain.emitter = em; rain.isLocal = true;
  rain.minEmitBox = new Vector3(-45, 18, -45); rain.maxEmitBox = new Vector3(45, 22, 45);
  rain.direction1 = new Vector3(-0.08, -1, -0.04); rain.direction2 = new Vector3(0.08, -1, 0.04); rain.minEmitPower = 16; rain.maxEmitPower = 20; rain.minLifeTime = 2; rain.maxLifeTime = 2.4; rain.updateSpeed = 1 / 60;
  rain.minSize = 0.05; rain.maxSize = 0.07; rain.minScaleY = 14; rain.maxScaleY = 22; rain.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED; rain.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  rain.color1 = new Color4(0.78, 0.83, 0.9, 0.4); rain.color2 = new Color4(0.7, 0.76, 0.85, 0.3); rain.colorDead = new Color4(0.7, 0.76, 0.85, 0); rain.emitRate = 0; rain.start();
  const snow = new ParticleSystem('rwx-snow', IS_PC ? 8000 : 3000, sc); snow.particleTexture = flake; snow.emitter = em; snow.isLocal = true;
  snow.minEmitBox = new Vector3(-50, 14, -50); snow.maxEmitBox = new Vector3(50, 20, 50);
  snow.direction1 = new Vector3(-0.35, -1, -0.25); snow.direction2 = new Vector3(0.35, -1, 0.25); snow.minEmitPower = 1.2; snow.maxEmitPower = 1.8; snow.minLifeTime = 14; snow.maxLifeTime = 18; snow.minSize = 0.08; snow.maxSize = 0.16;
  snow.minAngularSpeed = -1; snow.maxAngularSpeed = 1; snow.blendMode = ParticleSystem.BLENDMODE_STANDARD; snow.color1 = new Color4(1, 1, 1, 0.95); snow.color2 = new Color4(0.92, 0.95, 1, 0.85); snow.colorDead = new Color4(1, 1, 1, 0); snow.emitRate = 0; snow.start();

  // lightning: a bolt from the cloud base to the ground a few kilometres away, its flash and its thunder
  const boltMat = new StandardMaterial('rwx-bolt', sc); boltMat.emissiveColor = new Color3(2.6, 2.8, 3.2); boltMat.disableLighting = true; boltMat.diffuseColor = Color3.Black();
  let actx: AudioContext | null = null;
  const thunder = (delay: number, dist: number) => { try { actx = actx || new ((window as any).AudioContext || (window as any).webkitAudioContext)(); const a = actx!, len = 4, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
      let v = 0; for (let i = 0; i < d.length; i++) { v = v * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = v; }
      const src = a.createBufferSource(), lp = a.createBiquadFilter(), g = a.createGain(); src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = dist < 2500 ? 700 : 320; const t0 = a.currentTime + Math.min(delay, 12), k = Math.max(0.12, Math.min(0.8, 2500 / dist)) * 0.8;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(k, t0 + 0.4); g.gain.exponentialRampToValueAtTime(0.001, t0 + len); src.connect(lp); lp.connect(g); g.connect(a.destination); src.start(t0); } catch (e) { /* no sound */ } };
  const flash = () => { const f = document.createElement('div'); f.className = 'v3d-flash rwx-flash'; hud.appendChild(f); setTimeout(() => f.remove(), 600); };
  const strike = (topY: number, gndY: number) => {
    const c = cam().globalPosition, a = Math.random() * Math.PI * 2, dist = 2000 + Math.random() * 6000, bx = c.x + Math.cos(a) * dist, bz = c.z + Math.sin(a) * dist;
    const path: Vector3[] = [], n = 22, span = topY - gndY; let x = bx + (Math.random() - 0.5) * 300, z = bz + (Math.random() - 0.5) * 300;
    for (let i = 0; i <= n; i++) { path.push(new Vector3(x, topY - span * i / n, z)); x += (Math.random() - 0.5) * span * 0.06; z += (Math.random() - 0.5) * span * 0.06; }
    const m = MeshBuilder.CreateTube('rwx-bolt', { path, radius: Math.max(3, span / 260), tessellation: 5 }, sc); m.material = boltMat; m.isPickable = false;
    for (let k = 0; k < 3; k++) { const s = path[2 + Math.floor(Math.random() * 12)], br: Vector3[] = [s]; let p = s.clone(); for (let i = 0; i < 6; i++) { p = p.add(new Vector3((Math.random() - 0.5) * span * 0.08, -span * 0.04, (Math.random() - 0.5) * span * 0.08)); br.push(p); } const b = MeshBuilder.CreateTube('rwx-bolt-b', { path: br, radius: Math.max(1.5, span / 520), tessellation: 4 }, sc); b.material = boltMat; b.parent = m; }
    S.bolts.push({ m, t: 0.35 }); if (dist < 5000) flash(); thunder(dist / 343, dist);
  };

  const ease = (cur: number, want: number, dt: number, s: number) => cur + (want - cur) * Math.min(1, dt / s);
  const api: RealWx = {
    get cover() { return S.cover; }, get base() { return S.base; }, get top() { return S.top; }, get dark() { return S.dark; },
    frame(dt, o) {
      S.ask -= dt; if (S.ask <= 0) { S.ask = S.rep ? 30 : 8; gameSend({ ampb: 'wx', lat: o.lat, lon: o.lon }); }
      const r = S.on ? S.rep : null;
      // what the report says, eased in so a new report changes the sky gently
      let cover = 0.82, base = 2100, depth = 3500, dark = 0, rainW = 0, snowW = 0;
      if (r) {
        cover = r.cover > 0 ? 0.1 + r.cover * 0.95 : 0.05;
        base = (r.elev || 0) + (r.base ? r.base * 0.3048 : 1500);
        depth = r.cb ? 9000 : r.tcu ? 6000 : r.cover >= 1 ? 1800 : r.cover >= 0.75 ? 2200 : 2600;
        dark = (r.cover >= 1 ? 0.3 : r.cover >= 0.75 ? 0.15 : 0) + (r.ts ? 0.35 : 0) + (r.precip ? 0.1 * r.k : 0);
        const below = o.alt < base + 150;
        if (below && r.precip === 'ra') rainW = r.k; if (below && r.precip === 'sn') snowW = r.k;
        // the clouds blow with the wind (from the reported direction)
        if (r.dir >= 0 && r.kt > 0) { const w = r.kt * 0.5144, a = (r.dir + 180) * Math.PI / 180; o.drift[0] -= Math.sin(a) * w * dt; o.drift[1] -= Math.cos(a) * w * dt; }
      }
      S.cover = ease(S.cover, cover, dt, 6); S.base = ease(S.base, base, dt, 6); S.top = ease(S.top, base + depth, dt, 6); S.dark = ease(S.dark, Math.min(0.7, dark), dt, 6);
      S.rain = ease(S.rain, rainW, dt, 4); S.snow = ease(S.snow, snowW, dt, 4);
      const c = cam().globalPosition; em.position.copyFrom(c);
      rain.emitRate = S.rain * (IS_PC ? 3600 : 1500); snow.emitRate = S.snow * (IS_PC ? 600 : 260);
      const wk = r && r.kt ? Math.min(0.6, r.kt / 40) : 0.05; rain.direction1.set(wk - 0.06, -1, -0.04); rain.direction2.set(wk + 0.06, -1, 0.04);
      // lightning, in a thunderstorm reported at the station (overhead or nearby)
      if (r && r.ts && S.on) { S.next -= dt; if (S.next <= 0) { S.next = 4 + Math.random() * 12; strike(S.base - o.alt, o.gnd - o.alt); } }
      for (let i = S.bolts.length - 1; i >= 0; i--) { const b = S.bolts[i]; b.t -= dt; b.m.visibility = b.t > 0.2 ? 1 : Math.max(0, b.t / 0.2) * (Math.random() > 0.3 ? 1 : 0.2); if (b.t <= 0) { b.m.dispose(); S.bolts.splice(i, 1); } }
    },
    chip() {
      if (!S.on) return 'Real weather off';
      const r = S.rep; if (!r) return 'Real weather: looking for a report…';
      const cov = r.cover >= 1 ? 'Overcast' : r.cover >= 0.75 ? 'Broken' : r.cover >= 0.44 ? 'Scattered' : r.cover > 0 ? 'Few clouds' : 'Clear';
      const parts = [r.icao || 'Nearest report', r.base && r.cover > 0 ? `${cov} ${Math.round(r.base).toLocaleString('en-GB')} ft` : cov];
      if (r.wx) parts.push(r.wx); if (r.dir >= 0 && r.kt) parts.push(`${String(r.dir).padStart(3, '0')}°/${r.kt}${r.gust ? 'G' + r.gust : ''} kt`); if (typeof r.temp === 'number' && !isNaN(r.temp)) parts.push(`${Math.round(r.temp)}°C`);
      return parts.join(' · ');
    },
    toggle() { S.on = !S.on; S.ask = 0; return S.on; },
    on() { return S.on; },
    dispose() { const i = listeners.indexOf(got); if (i >= 0) listeners.splice(i, 1); try { rain.dispose(); snow.dispose(); em.dispose(); } catch (e) { /* gone */ } for (const b of S.bolts) b.m.dispose(); if (actx) actx.close().catch(() => { /* gone */ }); },
  };
  return api;
}
