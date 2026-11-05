/* The weather you are in, in the 3D view: rain or snow falling around the camera when it is under a raining
 * cloud (from the real-world reports, or from Flight Simulator when linked), and lightning from the storm
 * clouds: the cloud lights up from inside, now and then a bolt to the ground, the area brightens for an
 * instant (most at night), and the thunder follows after the time the sound takes to arrive. */

const V3dWx: any = { rain: null, snow: null, k: 0, want: 0, snow1: 0, at: 0, checkAt: 0, next: 0, pulses: [] as number[][], flashPos: null, bolts: [] as any[], overlay: null, wind: [0, 0], flashNow: 0 };

/** Rain or snow here: [0–1 strength, snow?] from the simulator (your aircraft, when linked) or the nearest report. */
function v3dPrecipHere(): number[] {
  const cam = V3d.cam.position, L: any = typeof Link !== 'undefined' ? (Link as any).sim : null;
  const ll = v3dLonLat(cam.x, cam.z);
  if (L && L.wx && L.lat && L.t && Date.now() - L.t < 20000 && gcDistanceNm([L.lon, L.lat], ll) < 2) {
    const p = L.wx.precip; if (p === 'rain' || p === 'snow') return [clamp(0.35 + (L.wx.precipMm || 0) / 8, 0.3, 1), p === 'snow' ? 1 : 0];
    return [0, 0];
  }
  const list = cloudStations(ll[0], ll[1], 120), st = cloudNearest(list, ll[0], ll[1], 120); if (!st) return [0, 0];
  const pr = cloudPrecip(st.wx); if (!pr || pr.vc) return [0, 0];
  const lowest = st.layers.filter(l => CLOUD_COV[l.cover]).map(l => l.base)[0];
  const baseY = st.elev + (lowest == null ? 3000 : lowest) * 0.3048 - v3dCurve(cam.x, cam.z);
  if (cam.y > baseY + 150) return [0, 0];   // above the cloud base: it falls below you
  return [pr.k, pr.kind === 'sn' ? 1 : 0];
}

function v3dPrecipMesh(snow: boolean): any {
  const T = THREE, N = snow ? 2600 : 3600, geo = new T.BufferGeometry();
  const seed = new Float32Array(N * (snow ? 1 : 2) * 3), end = new Float32Array(N * (snow ? 1 : 2));
  for (let i = 0; i < N; i++) {
    const a = Math.random(), b = Math.random(), c = Math.random();
    if (snow) { seed.set([a, b, c], i * 3); end[i] = 0; }
    else { seed.set([a, b, c], i * 6); seed.set([a, b, c], i * 6 + 3); end[i * 2] = 0; end[i * 2 + 1] = 1; }
  }
  geo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(seed.length), 3));
  geo.setAttribute('aSeed', new T.Float32BufferAttribute(seed, 3)); geo.setAttribute('aEnd', new T.Float32BufferAttribute(end, 1));
  const mat = new T.ShaderMaterial({
    uniforms: { uCam: { value: new T.Vector3() }, uTime: { value: 0 }, uK: { value: 0 }, uWind: { value: new T.Vector3() }, uBox: { value: snow ? 70 : 90 }, uCol: { value: new T.Color(1, 1, 1) }, uPx: { value: 800 } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 aSeed; attribute float aEnd;
      uniform vec3 uCam; uniform float uTime; uniform float uK; uniform vec3 uWind; uniform float uBox; uniform float uPx;
      varying float vA;
      void main() {
        float snow = ${snow ? '1.0' : '0.0'};
        vec3 vel = vec3(uWind.x, -mix(9.0, 1.2, snow), uWind.z);
        vec3 p = mod(aSeed * uBox + vel * uTime - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
        p.x += snow * sin(uTime * 1.3 + aSeed.y * 40.0) * 0.5; p.z += snow * cos(uTime * 1.1 + aSeed.x * 30.0) * 0.5;
        p -= aEnd * vel * 0.055;   // a raindrop is seen as a short streak
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = length(mv.xyz);
        vA = step(fract(aSeed.z * 13.7), uK) * smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, d));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(0.09 * uPx / max(0.5, -mv.z), 1.0, 7.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uCol; varying float vA;
      void main() {
        #include <logdepthbuf_fragment>
        float a = vA;
        ${snow ? 'vec2 c = gl_PointCoord - 0.5; a *= 1.0 - smoothstep(0.2, 0.5, length(c));' : ''}
        if (a < 0.01) discard;
        gl_FragColor = vec4(uCol, a * ${snow ? '0.85' : '0.32'});
      }`,
    transparent: true, depthWrite: false, fog: false,
  });
  const m = snow ? new T.Points(geo, mat) : new T.LineSegments(geo, mat);
  m.frustumCulled = false; m.renderOrder = 20;
  return m;
}

function v3dWeatherStep(now: number) {
  if (!V3d.cam || !V3d.scene || !V3d.origin) return;
  const T = THREE, cam = V3d.cam.position, dt = V3dWx.at ? Math.min(0.2, (now - V3dWx.at) / 1000) : 0; V3dWx.at = now;
  // what is falling here: checked once a second, eased in and out over several seconds
  if (now - V3dWx.checkAt > 1000) {
    V3dWx.checkAt = now;
    const p = (State.settings as any).v3dPrecip === false ? [0, 0] : v3dPrecipHere(); V3dWx.want = p[0]; if (p[0] > 0) V3dWx.snow1 = p[1];
    const a: any = (V3dSky as any).a; if (a && a.wx) { const sp = a.wx.wind * 14; V3dWx.wind = [Math.cos(a.wx.dir) * sp, Math.sin(a.wx.dir) * sp]; }
  }
  V3dWx.k += (V3dWx.want - V3dWx.k) * Math.min(1, dt / 4);
  // rain and snow each ease in and out on their own, so rain turning to snow fades across instead of switching
  V3dWx.kr = (V3dWx.kr || 0) + ((V3dWx.snow1 ? 0 : V3dWx.want) - (V3dWx.kr || 0)) * Math.min(1, dt / 4);
  V3dWx.ks = (V3dWx.ks || 0) + ((V3dWx.snow1 ? V3dWx.want : 0) - (V3dWx.ks || 0)) * Math.min(1, dt / 4);
  for (const snow of [0, 1]) {
    const kk = snow ? V3dWx.ks : V3dWx.kr, key = snow ? 'snow' : 'rain', on = kk > 0.01 && V3d.mode !== 'cabin';
    let m = V3dWx[key];
    if (on && (!m || m.parent !== V3d.scene)) { m = V3dWx[key] = v3dPrecipMesh(!!snow); V3d.scene.add(m); }
    if (!m) continue;
    m.visible = on; if (!on) continue;
    const u = m.material.uniforms, amb = Math.max(0.12, (V3dSky as any).amb || 1), tint = (V3dSky as any).tint || [1, 1, 1];
    u.uCam.value.copy(cam); u.uTime.value = now / 1000; u.uK.value = kk;
    u.uWind.value.set(V3dWx.wind[0], 0, V3dWx.wind[1]);
    u.uPx.value = (V3d.r ? V3d.r.domElement.height : 800) / (2 * Math.tan(V3d.cam.fov * D2R / 2));
    const b = snow ? 0.95 : 0.78; u.uCol.value.setRGB(b * amb * tint[0] + V3dWx.flashNow * 0.6, b * amb * tint[1] + V3dWx.flashNow * 0.6, (b + 0.05) * amb * tint[2] + V3dWx.flashNow * 0.7);
  }
  v3dLightningStep(now);
}

/* ---------- lightning ---------- */

function v3dLightningStep(now: number) {
  const T = THREE, cam = V3d.cam.position, storms: number[][] = (V3dClouds as any).storms || [], C: any = V3dClouds.mesh;
  const range = cloudKm() * 1000, near = storms.filter(s => Math.hypot(s[0] - cam.x, s[2] - cam.z) < range);
  // when the next flash comes: storms reported with thunder flash every few seconds; storm clouds without it rarely
  if (near.length && (State.settings as any).v3dLightning !== false) {
    const rate = near.reduce((a, s) => a + s[5], 0);   // flashes a minute, roughly, per active storm cell: a few
    if (!V3dWx.next) V3dWx.next = now + 1500 + Math.random() * 8000;
    if (now >= V3dWx.next) {
      V3dWx.next = now + (-Math.log(1 - Math.random() * 0.98) * 14000) / Math.max(0.25, Math.min(4, rate));
      let pick = Math.random() * rate, st = near[0]; for (const s of near) { pick -= s[5]; if (pick <= 0) { st = s; break; } }
      const cg = Math.random() < 0.3, r = () => (Math.random() - 0.5) * st[4] * 0.7;
      const pos = new T.Vector3(st[0] + r(), cg ? st[1] + 300 : st[1] + Math.random() * (st[3] - st[1]) * 0.6, st[2] + r());
      V3dWx.flashPos = pos;
      // two to four strokes in quick succession, as a real flash flickers
      const n = 2 + Math.floor(Math.random() * 3); V3dWx.pulses = [];
      for (let i = 0; i < n; i++) V3dWx.pulses.push([now + i * (50 + Math.random() * 90), 0.6 + Math.random() * 0.6]);
      if (cg) v3dBolt(pos, now);
      const d = cam.distanceTo(pos);
      try { V3dSound.thunder(d, cg); } catch (e) { /* no sound */ }
    }
  }
  // the flash: brightest at each stroke, fading in a few hundredths of a second
  let k = 0; for (const p of V3dWx.pulses) { const t = now - p[0]; if (t >= 0) k += p[1] * Math.exp(-t / 55); }
  if (V3dWx.pulses.length && now - V3dWx.pulses[V3dWx.pulses.length - 1][0] > 600) V3dWx.pulses = [];
  V3dWx.flashNow = k;
  if (C) { C.material.uniforms.uFlashK.value = k * 1.6; if (V3dWx.flashPos) C.material.uniforms.uFlashPos.value.copy(V3dWx.flashPos); }
  // the whole area lights up for an instant: a lot at night, a little by day, less the further away
  const host = V3d.r && V3d.r.domElement && V3d.r.domElement.parentElement;
  if (host) {
    let el: HTMLElement = V3dWx.overlay;
    if (!el || el.parentElement !== host) { el = document.createElement('div'); el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at 50% 30%,#eef2ff,#c9d4ff);mix-blend-mode:screen;opacity:0'; host.appendChild(el); V3dWx.overlay = el; }
    const night = (V3dSky as any).U ? (V3dSky as any).U.uNight.value : 0, d = V3dWx.flashPos ? cam.distanceTo(V3dWx.flashPos) : 1e9;
    el.style.opacity = clamp(k * (0.05 + 0.3 * night) * Math.exp(-d / 15000), 0, 0.55).toFixed(3);
  }
  // bolts fade out
  for (let i = V3dWx.bolts.length - 1; i >= 0; i--) {
    const b = V3dWx.bolts[i], t = now - b.t0;
    if (t > 380) { V3d.scene.remove(b.obj); b.obj.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); }); V3dWx.bolts.splice(i, 1); continue; }
    b.obj.traverse((o: any) => { if (o.material) o.material.opacity = Math.min(1, k + 0.15) * (1 - t / 380); });
  }
}

/** A bolt of lightning from the cloud base to the ground: a jagged main channel with a few branches. */
function v3dBolt(from: any, now: number) {
  const T = THREE, ll = v3dLonLat(from.x, from.z);
  const gY = (V3dTerrain.rings.length ? V3dTerrain.ground(ll[0], ll[1]) : 0) - v3dCurve(from.x, from.z);
  const g = new T.Group(), mat = new T.LineBasicMaterial({ color: 0xF2F5FF, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending, fog: false });
  const channel = (a: number[], b: number[], rough: number, depth: number): number[][] => {
    let pts = [a, b];
    for (let it = 0; it < 6; it++) {
      const nx: number[][] = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i], len = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
        nx.push([(p[0] + q[0]) / 2 + (Math.random() - 0.5) * len * rough, (p[1] + q[1]) / 2 + (Math.random() - 0.5) * len * rough * 0.3, (p[2] + q[2]) / 2 + (Math.random() - 0.5) * len * rough], q);
      }
      pts = nx;
    }
    const geo = new T.BufferGeometry().setFromPoints(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
    for (const off of [0, 1.2, -1.2]) { const l = new T.Line(geo, mat); l.position.x = off; l.renderOrder = 30; g.add(l); }
    if (depth < 2) for (let k = 0; k < 2; k++) {
      const s = pts[Math.floor(pts.length * (0.2 + Math.random() * 0.5))], len = (s[1] - gY) * (0.25 + Math.random() * 0.3);
      channel(s, [s[0] + (Math.random() - 0.5) * len, s[1] - len, s[2] + (Math.random() - 0.5) * len], 0.5, depth + 1);
    }
    return pts;
  };
  channel([from.x, from.y, from.z], [from.x + (Math.random() - 0.5) * 600, gY, from.z + (Math.random() - 0.5) * 600], 0.45, 0);
  V3d.scene.add(g); V3dWx.bolts.push({ obj: g, t0: now });
}

function v3dWeatherClear() {
  V3dWx.rain = V3dWx.snow = null; V3dWx.k = 0; V3dWx.want = 0; V3dWx.next = 0; V3dWx.pulses = []; V3dWx.bolts = []; V3dWx.flashNow = 0;
  if (V3dWx.overlay) { V3dWx.overlay.remove(); V3dWx.overlay = null; }
  try { V3dSound.stop(); } catch (e) { /* no sound */ }
}
