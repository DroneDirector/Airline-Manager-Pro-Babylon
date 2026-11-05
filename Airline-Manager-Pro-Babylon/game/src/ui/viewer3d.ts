// The 3D object viewer: a gift, a plaque or a badge opens in a popup where you turn it freely and zoom in.
//  - Mouse or finger: drag to turn it, wheel or pinch to zoom, double-click to put it back.
//  - Keyboard: arrows or W A S D turn it, + and − zoom, R puts it back, Space starts or stops it spinning, Esc closes.
//  - A game controller (PlayStation, Xbox, Switch or any standard one): the left stick turns it, the right stick
//    too (finer), the triggers zoom, the bottom face button spins it, the right one closes, the top one puts it
//    back. When a controller is connected, the popup shows its own buttons (✕ ○ △ □, A B X Y ...) on a drawing of
//    a controller, and they light up as you press them.
// Thumbnails for lists are rendered once with the same lighting (viewerThumb).

const V3V: any = { on: false, mode: 'kb' };   // mode: the last device used, 'kb' (keyboard, mouse, touch) or 'pad'
let V3V_ROT = Math.PI / 2;   // the medal's face lettering upright on the disc

/** The studio: soft light all round, a key light, a rim light and a reflection map for metal and glass. */
function v3vStudio(T: any, R: any, sc: any, bare?: boolean) {
  sc.add(new T.HemisphereLight(0xF4F7FF, 0x30343C, 0.9));
  const key = new T.DirectionalLight(0xFFF4E6, 2.4); key.position.set(3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 }); key.shadow.bias = -0.0006; sc.add(key);
  const rim = new T.DirectionalLight(0xBFD8FF, 1.2); rim.position.set(-4, 3, -4); sc.add(rim);
  const fill = new T.DirectionalLight(0xFFFFFF, 0.5); fill.position.set(-3, 1, 3); sc.add(fill);
  try {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.45, '#C9D2DE'); gr.addColorStop(0.55, '#5A6270'); gr.addColorStop(1, '#1A1D22');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(60, 40, 120, 40); g.fillRect(320, 30, 140, 30);   // softboxes
    const tex = new T.CanvasTexture(c); tex.mapping = T.EquirectangularReflectionMapping; tex.colorSpace = T.SRGBColorSpace;
    const pm = new T.PMREMGenerator(R); sc.environment = pm.fromEquirectangular(tex).texture; pm.dispose(); tex.dispose();
  } catch (e) { /* no reflections */ }
  // a dark round plinth with a soft shadow on it
  if (bare) return { key };
  const pl = new T.Mesh(new T.CylinderGeometry(1.6, 1.7, 0.12, 64), new T.MeshStandardMaterial({ color: 0x15181D, roughness: 0.55, metalness: 0.3 }));
  pl.position.y = -0.06; pl.receiveShadow = true; sc.add(pl);
  return { key };
}

/** Fit an object on the plinth: scaled to about 2 units across, standing on y = 0. */
function v3vFit(T: any, obj: any): number {
  const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3()), s = 2.1 / Math.max(size.x, size.y * 0.9, size.z, 0.01);
  obj.scale.multiplyScalar(s); obj.updateMatrixWorld(true);
  const b2 = new T.Box3().setFromObject(obj), c = b2.getCenter(new T.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  return b2.max.y - b2.min.y;
}

/** Which kind of controller is connected: 'ps', 'xbox', 'switch' or 'pad' (any other standard one); '' for none. */
function v3vPadKind(): { kind: string; pad: any } {
  let pads: any[] = []; try { pads = Array.from((navigator as any).getGamepads ? (navigator as any).getGamepads() : []).filter(Boolean); } catch (e) { pads = []; }
  const p = pads[0]; if (!p) return { kind: '', pad: null };
  const id = String(p.id || '').toLowerCase();
  const kind = /xbox|xinput|045e/.test(id) ? 'xbox' : /dualsense|dualshock|playstation|wireless controller|054c/.test(id) ? 'ps' : /pro controller|joy-con|nintendo|057e/.test(id) ? 'switch' : 'pad';
  return { kind, pad: p };
}

/** The keyboard and mouse help, and the controller drawing with its buttons, for the popup. */
function v3vHelpHtml(kind: string, mode?: string): string {
  const k = (s: string) => `<kbd>${s}</kbd>`;
  const keys = `<div class="v3v-keys"><span>${k('←')}${k('→')}${k('↑')}${k('↓')}<em>or</em>${k('W')}${k('A')}${k('S')}${k('D')}<small>Turn</small></span>
    <span>${k('+')}${k('−')}<em>or</em>${k('Wheel')}<small>Zoom</small></span><span>${k('Space')}<small>Spin</small></span><span>${k('R')}<small>Reset</small></span><span>${k('Esc')}<small>Close</small></span>
    <span class="v3v-touch">${icon('hand') || ''}<small>Drag to turn · pinch to zoom</small></span></div>`;
  if (!kind || mode !== 'pad') return keys;
  // face buttons by controller: bottom, right, left, top
  const F: any = {
    ps: [['✕', '#7FB2FF'], ['○', '#FF6B7A'], ['□', '#E58BFF'], ['△', '#3FE0B5']],
    xbox: [['A', '#5BD25B'], ['B', '#FF5A5A'], ['X', '#4FA3FF'], ['Y', '#FFC531']],
    switch: [['B', '#E8EDF3'], ['A', '#E8EDF3'], ['Y', '#E8EDF3'], ['X', '#E8EDF3']],
    pad: [['1', '#9FB3C8'], ['2', '#9FB3C8'], ['3', '#9FB3C8'], ['4', '#9FB3C8']],
  };
  const f = F[kind] || F.pad, trig = kind === 'ps' ? ['L2', 'R2'] : kind === 'xbox' ? ['LT', 'RT'] : kind === 'switch' ? ['ZL', 'ZR'] : ['LT', 'RT'];
  const name = kind === 'ps' ? 'PlayStation controller' : kind === 'xbox' ? 'Xbox controller' : kind === 'switch' ? 'Switch Pro controller' : 'Game controller';
  const fb = (i: number, cx: number, cy: number) => `<g class="v3v-b" data-b="${[0, 1, 2, 3][i]}"><circle cx="${cx}" cy="${cy}" r="11"/><text x="${cx}" y="${cy + 4.5}" fill="${f[i][1]}">${f[i][0]}</text></g>`;
  const svg = `<svg class="v3v-pad" viewBox="0 0 420 210" aria-label="${name} buttons">
    <defs><linearGradient id="v3vpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B3442"/><stop offset="1" stop-color="#131820"/></linearGradient></defs>
    <path class="v3v-body" d="M130 58 C150 46 270 46 290 58 L318 60 C352 62 372 86 382 128 C392 172 380 196 356 196 C336 196 322 178 306 158 C298 148 290 144 278 144 L142 144 C130 144 122 148 114 158 C98 178 84 196 64 196 C40 196 28 172 38 128 C48 86 68 62 102 60 Z" fill="url(#v3vpg)"/>
    <g class="v3v-b" data-b="6"><rect x="92" y="34" width="46" height="18" rx="7"/><text x="115" y="47">${trig[0]}</text></g>
    <g class="v3v-b" data-b="7"><rect x="282" y="34" width="46" height="18" rx="7"/><text x="305" y="47">${trig[1]}</text></g>
    <g class="v3v-dpad"><g class="v3v-b" data-b="12"><rect x="94" y="80" width="16" height="17" rx="3"/></g><g class="v3v-b" data-b="13"><rect x="94" y="113" width="16" height="17" rx="3"/></g><g class="v3v-b" data-b="14"><rect x="76" y="97" width="18" height="16" rx="3"/></g><g class="v3v-b" data-b="15"><rect x="110" y="97" width="18" height="16" rx="3"/></g></g>
    ${fb(3, 318, 80)}${fb(1, 342, 104)}${fb(2, 294, 104)}${fb(0, 318, 128)}
    <g class="v3v-stick" data-s="0"><circle cx="160" cy="150" r="20"/><circle class="v3v-knob" cx="160" cy="150" r="11"/></g>
    <g class="v3v-stick" data-s="1"><circle cx="260" cy="150" r="20"/><circle class="v3v-knob" cx="260" cy="150" r="11"/></g>
    <g class="v3v-call"><path d="M160 172 L160 200 L120 200"/><text x="116" y="204" text-anchor="end">Turn</text>
      <path d="M260 172 L260 200 L300 200"/><text x="304" y="204">Fine turn</text>
      <path d="M115 34 L115 18 L70 18"/><text x="66" y="22" text-anchor="end">Zoom out</text>
      <path d="M305 34 L305 18 L350 18"/><text x="354" y="22">Zoom in</text>
      <path d="M329 80 L370 66"/><text x="374" y="66">Reset</text>
      <path d="M353 104 L392 104"/><text x="396" y="108">Close</text>
      <path d="M329 128 L370 146"/><text x="374" y="152">Spin</text>
      <path d="M76 105 L40 105"/><text x="36" y="109" text-anchor="end">Turn</text></g>
  </svg>`;
  return `<div class="v3v-help2"><div class="v3v-padwrap"><b>${name}</b>${svg}</div></div>`;
}

/** Open the viewer. build() makes the object (any size; it is fitted on the plinth). */
function viewer3dOpen(o: { title: string; sub?: string; info?: string; build: (T: any) => any; spin?: boolean }) {
  const T = typeof THREE !== 'undefined' ? THREE : null; if (!T) { toast('3D is not available on this device', 'warn'); return; }
  viewer3dClose();
  const host = document.createElement('div'); host.className = 'v3v'; host.setAttribute('role', 'dialog'); host.setAttribute('aria-label', o.title);
  host.innerHTML = `<canvas></canvas>
    <div class="v3v-head"><b>${esc(o.title)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>
    <button class="v3v-x" data-act="v3v-close" aria-label="Close (Esc)">${icon('close')}<small>Esc</small></button>
    ${o.info ? `<div class="v3v-info">${o.info}</div>` : ''}
    <div class="v3v-help"></div>`;
  document.body.appendChild(host);
  const cv = host.querySelector('canvas') as HTMLCanvasElement;
  let R: any; try { R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { host.remove(); toast('3D is not available on this device', 'warn'); return; }
  R.setPixelRatio(Gfx.pr(Math.min(2, window.devicePixelRatio || 1))); R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1;
  R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
  const sc = new T.Scene(); v3vStudio(T, R, sc);
  const cam = new T.PerspectiveCamera(32, 1, 0.05, 100);
  const pivot = new T.Group(); sc.add(pivot);
  let obj: any = null; try { obj = o.build(T); } catch (e) { obj = null; }
  if (!obj) { obj = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0x888888 })); }
  obj.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const shine = { value: 0 }; if (Gfx.shine()) v3vShine(obj, shine);
  const hgt = v3vFit(T, obj); pivot.add(obj);
  const st = { yaw: -0.5, pitch: 0.12, dist: 6.2, vy: 0, vp: 0, spin: o.spin !== false, tYaw: -0.5, tPitch: 0.12, tDist: 6.2 };
  const reset = () => { st.tYaw = -0.5; st.tPitch = 0.12; st.tDist = 6.2; };
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; R.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
  resize(); window.addEventListener('resize', resize);
  // pointer: drag to turn, wheel and pinch to zoom
  const ptr: { [id: number]: number[] } = {}; let pinch = 0, lastTap = 0;
  cv.addEventListener('pointerdown', (e: PointerEvent) => { cv.setPointerCapture(e.pointerId); ptr[e.pointerId] = [e.clientX, e.clientY]; st.spin = false; const n = Date.now(); if (n - lastTap < 300) reset(); lastTap = n; });
  cv.addEventListener('pointermove', (e: PointerEvent) => {
    const p = ptr[e.pointerId]; if (!p) return; const ids = Object.keys(ptr);
    if (ids.length === 2) { const [a, b] = ids.map(k => ptr[+k]); const d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); ptr[e.pointerId] = [e.clientX, e.clientY]; const [c, d] = ids.map(k => ptr[+k]); const d1 = Math.hypot(c[0] - d[0], c[1] - d[1]); if (pinch) st.tDist = clamp(st.tDist * d0 / Math.max(1, d1), 2.6, 12); pinch = 1; return; }
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; ptr[e.pointerId] = [e.clientX, e.clientY];
    st.tYaw += dx * 0.01; st.tPitch = clamp(st.tPitch + dy * 0.008, -1.2, 1.35); st.vy = dx * 0.002;
  });
  const up = (e: PointerEvent) => { delete ptr[e.pointerId]; pinch = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e: WheelEvent) => { e.preventDefault(); st.tDist = clamp(st.tDist * (1 + Math.sign(e.deltaY) * 0.1), 2.6, 12); }, { passive: false });
  // keyboard
  const held: { [k: string]: boolean } = {};
  const kd = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); e.stopPropagation(); viewer3dClose(); return; }
    if (k === 'r') reset(); else if (k === ' ') { e.preventDefault(); st.spin = !st.spin; } else if (k === '+' || k === '=') st.tDist = clamp(st.tDist * 0.9, 2.6, 12); else if (k === '-' || k === '_') st.tDist = clamp(st.tDist * 1.1, 2.6, 12);
    if (/^(arrow(left|right|up|down)|[wasd])$/.test(k)) { e.preventDefault(); held[k] = true; st.spin = false; }
  };
  const ku = (e: KeyboardEvent) => { delete held[e.key.toLowerCase()]; };
  window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku, true);
  // the help: keyboard always, the controller when one is connected (checked as it is plugged in or out)
  // one set of help at a time: the keyboard's or the controller's, whichever you used last (switching as you change)
  let padKind = '-', shown = '';
  const helpEl = host.querySelector('.v3v-help') as HTMLElement;
  const helpUpdate = () => {
    const k = v3vPadKind().kind, mode = k && V3V.mode === 'pad' ? 'pad' : 'kb', sig = mode + k;
    if (sig === shown && k === padKind) return; padKind = k; shown = sig;
    helpEl.innerHTML = v3vHelpHtml(k, mode); helpEl.classList.toggle('pad', mode === 'pad');
    const xs = host.querySelector('.v3v-x small'); if (xs) xs.textContent = mode === 'pad' ? ({ ps: '○', xbox: 'B', switch: 'A' } as any)[k] || '2' : 'Esc';
  };
  const useKb = () => { if (V3V.mode !== 'kb') { V3V.mode = 'kb'; helpUpdate(); } };
  host.addEventListener('pointerdown', useKb, true); host.addEventListener('wheel', useKb, { capture: true, passive: true }); window.addEventListener('keydown', useKb, true);
  helpUpdate();
  let prevB: boolean[] = [];
  const frame = () => {
    if (!V3V.on || V3V.host !== host) return;
    const dt = 1 / 60;
    // keys held
    if (held['arrowleft'] || held['a']) st.tYaw -= 2.2 * dt; if (held['arrowright'] || held['d']) st.tYaw += 2.2 * dt;
    if (held['arrowup'] || held['w']) st.tPitch = clamp(st.tPitch - 1.6 * dt, -1.2, 1.35); if (held['arrowdown'] || held['s']) st.tPitch = clamp(st.tPitch + 1.6 * dt, -1.2, 1.35);
    // the controller
    const P = v3vPadKind();
    if (P.pad) {
      const ax = P.pad.axes || [], bt = (P.pad.buttons || []).map((b: any) => !!(b && (b.pressed || b.value > 0.5)));
      const dz = (v: number) => Math.abs(v) < 0.12 ? 0 : v;
      const lx = dz(ax[0] || 0), ly = dz(ax[1] || 0), rx = dz(ax[2] || 0), ry = dz(ax[3] || 0);
      if (lx || ly || rx || ry) st.spin = false;
      if ((lx || ly || rx || ry || bt.some((x: boolean) => x)) && V3V.mode !== 'pad') { V3V.mode = 'pad'; helpUpdate(); }
      st.tYaw += (lx * 2.6 + rx * 1.0) * dt; st.tPitch = clamp(st.tPitch + (ly * 1.8 + ry * 0.7) * dt, -1.2, 1.35);
      const lt = P.pad.buttons[6] ? P.pad.buttons[6].value || (P.pad.buttons[6].pressed ? 1 : 0) : 0, rt = P.pad.buttons[7] ? P.pad.buttons[7].value || (P.pad.buttons[7].pressed ? 1 : 0) : 0;
      st.tDist = clamp(st.tDist * (1 + (lt - rt) * 1.4 * dt), 2.6, 12);
      if (bt[12]) st.tPitch = clamp(st.tPitch - 1.4 * dt, -1.2, 1.35); if (bt[13]) st.tPitch = clamp(st.tPitch + 1.4 * dt, -1.2, 1.35);
      if (bt[14]) st.tYaw -= 2 * dt; if (bt[15]) st.tYaw += 2 * dt;
      const press = (i: number) => bt[i] && !prevB[i];
      if (press(0)) st.spin = !st.spin; if (press(3)) reset(); if (press(1)) { viewer3dClose(); return; }
      // light up what is pressed on the drawing, and move the sticks
      helpEl.querySelectorAll('.v3v-b').forEach((g: any) => g.classList.toggle('on', !!bt[+g.getAttribute('data-b')]));
      helpEl.querySelectorAll('.v3v-stick').forEach((g: any) => { const s = +g.getAttribute('data-s'), k = g.querySelector('.v3v-knob'); if (k) k.setAttribute('transform', `translate(${((s ? rx : lx) * 8).toFixed(1)} ${((s ? ry : ly) * 8).toFixed(1)})`); });
      prevB = bt;
    }
    if (st.spin) st.tYaw += 0.35 * dt;
    st.yaw += (st.tYaw - st.yaw) * 0.18; st.pitch += (st.tPitch - st.pitch) * 0.18; st.dist += (st.tDist - st.dist) * 0.15;
    pivot.rotation.y = st.yaw; shine.value = st.yaw * 1.25 + st.pitch * 0.9;
    const cy = hgt * 0.45;
    cam.position.set(0, cy + Math.sin(st.pitch) * st.dist, Math.cos(st.pitch) * st.dist); cam.lookAt(0, cy, 0);
    R.render(sc, cam);
    V3V.raf = requestAnimationFrame(frame);
  };
  const onPad = () => helpUpdate();
  window.addEventListener('gamepadconnected', onPad); window.addEventListener('gamepaddisconnected', onPad);
  const padPoll = setInterval(helpUpdate, 1500);
  V3V.on = true; V3V.host = host; V3V.R = R; V3V.sc = sc; V3V.st = st;
  V3V.off = () => { window.removeEventListener('resize', resize); window.removeEventListener('keydown', kd, true); window.removeEventListener('keydown', useKb, true); window.removeEventListener('keyup', ku, true); window.removeEventListener('gamepadconnected', onPad); window.removeEventListener('gamepaddisconnected', onPad); clearInterval(padPoll); };
  Sound.tick();
  frame();
}
function viewer3dClose() {
  if (!V3V.host) return;
  V3V.on = false; cancelAnimationFrame(V3V.raf); try { V3V.off && V3V.off(); } catch (e) { /* none */ }
  try { V3V.sc.traverse((m: any) => { if (m.geometry) m.geometry.dispose(); const ms = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []; ms.forEach((x: any) => { ['map', 'bumpMap', 'roughnessMap', 'normalMap'].forEach(k => x[k] && x[k].dispose()); x.dispose(); }); }); } catch (e) { /* gone */ }
  try { V3V.R.dispose(); V3V.R.forceContextLoss && V3V.R.forceContextLoss(); } catch (e) { /* gone */ }
  V3V.host.classList.add('out'); const h = V3V.host; setTimeout(() => h.remove(), 200);
  V3V.host = null; V3V.R = null; V3V.sc = null;
}
ACTIONS['v3v-close'] = () => viewer3dClose();

/** A shine on the metal parts only (brass, gold, silver, bronze, chrome; not wood, glass, cloth or paint): a bright
 *  streak across the metal that sweeps over it as you turn the object, on top of its reflections. */
function v3vShine(obj: any, u: { value: number }) {
  const done = new Set();
  obj.traverse((o: any) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || done.has(m) || !m.isMeshStandardMaterial || (m.metalness || 0) < 0.8 || m.transmission) continue;
      done.add(m);
      m.onBeforeCompile = (sh: any) => {
        sh.uniforms.uShine = u;
        sh.fragmentShader = 'uniform float uShine;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
          {
            // a diagonal streak across the metal, in the picture, that moves as the object is turned
            vec3 vp = -vViewPosition;
            float g = (vp.x * 0.78 + vp.y * 0.62) + 0.25 * dot(normalize(normal), vec3(0.6, 0.6, 0.5));
            float c = 1.6 * sin(uShine);
            float band = exp(-pow((g - c) / 0.11, 2.0)) + 0.6 * exp(-pow((g - c + 0.3) / 0.035, 2.0));
            gl_FragColor.rgb += band * (diffuseColor.rgb * 0.6 + 0.4) * 0.7;
          }`);
      };
      m.customProgramCacheKey = () => 'v3vshine';
      m.needsUpdate = true;
    }
  });
}

/** A still of an object for a list, rendered once with the viewer's lighting (kept for the session). */
const _v3vThumbs: { [k: string]: string } = {};
let _v3vThumbR: any = null;
function viewerThumb(key: string, build: (T: any) => any, size?: number, bare?: boolean): string {
  if (_v3vThumbs[key] !== undefined) return _v3vThumbs[key];
  const T = typeof THREE !== 'undefined' ? THREE : null; if (!T) return (_v3vThumbs[key] = '');
  try {
    const S = size || 320;
    if (!_v3vThumbR) { const c = document.createElement('canvas'); _v3vThumbR = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); _v3vThumbR.outputColorSpace = T.SRGBColorSpace; _v3vThumbR.toneMapping = T.ACESFilmicToneMapping; _v3vThumbR.toneMappingExposure = 1.1; _v3vThumbR.shadowMap.enabled = true; _v3vThumbR.setClearColor(0x000000, 0); }
    const R = _v3vThumbR; R.setPixelRatio(1); R.setSize(S, S, false);
    const sc = new T.Scene(); v3vStudio(T, R, sc, bare);
    const obj = build(T); obj.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    const hgt = v3vFit(T, obj); obj.rotation.y = -0.5; sc.add(obj);
    const cam = new T.PerspectiveCamera(32, 1, 0.05, 100), d = 5.6; cam.position.set(0, hgt * 0.45 + Math.sin(0.2) * d, Math.cos(0.2) * d); cam.lookAt(0, hgt * 0.45, 0);
    R.render(sc, cam);
    const url = R.domElement.toDataURL('image/png');
    sc.traverse((m: any) => { if (m.geometry) m.geometry.dispose(); const ms = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []; ms.forEach((x: any) => { ['map', 'bumpMap', 'roughnessMap'].forEach(k => x[k] && x[k].dispose()); x.dispose(); }); });
    if (sc.environment) sc.environment.dispose();
    return (_v3vThumbs[key] = url);
  } catch (e) { return (_v3vThumbs[key] = ''); }
}

/* ---------- textures and shapes shared by the gifts and the badges ---------- */

/** Draw one of the app's line icons onto a canvas (its 24 × 24 drawing scaled to `size`, centred at x, y). */
function v3vDrawIcon(g: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, width?: number) {
  const src = (ICON_PATHS as any)[name] || (ICON_PATHS as any).star || ''; const k = size / 24;
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(k, k); g.lineWidth = width || 1.9; g.lineCap = 'round'; g.lineJoin = 'round';
  const re = /<(path|circle|rect|line|polyline|polygon|ellipse)\s([^>]*)\/?>/g; let m: RegExpExecArray;
  const at = (s: string, a: string) => { const r = new RegExp('\\b' + a + '="([^"]*)"').exec(s); return r ? r[1] : null; };
  while ((m = re.exec(src))) {
    const t = m[1], s = m[2], p = new Path2D();
    if (t === 'path') { const d = at(s, 'd'); if (d) p.addPath(new Path2D(d)); }
    else if (t === 'circle') p.arc(+at(s, 'cx'), +at(s, 'cy'), +at(s, 'r'), 0, Math.PI * 2);
    else if (t === 'ellipse') p.ellipse(+at(s, 'cx'), +at(s, 'cy'), +at(s, 'rx'), +at(s, 'ry'), 0, 0, Math.PI * 2);
    else if (t === 'rect') p.rect(+at(s, 'x') || 0, +at(s, 'y') || 0, +at(s, 'width'), +at(s, 'height'));
    else if (t === 'line') { p.moveTo(+at(s, 'x1'), +at(s, 'y1')); p.lineTo(+at(s, 'x2'), +at(s, 'y2')); }
    else { const pts = (at(s, 'points') || '').trim().split(/[\s,]+/).map(Number); for (let i = 0; i + 1 < pts.length; i += 2) i ? p.lineTo(pts[i], pts[i + 1]) : p.moveTo(pts[i], pts[i + 1]); if (t === 'polygon') p.closePath(); }
    g.stroke(p);
  }
  g.restore();
}
function v3vTex(T: any, c: HTMLCanvasElement, srgb = true): any { const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
function v3vCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

/** A badge as a medal: a metal disc in its tier's metal with a raised rim, the badge's icon and its tier on the
 *  front, its name and the date it was earned engraved on the back, hanging from a striped ribbon. */
function badgeMedal(T: any, b: BadgeDef, earnedAt: number): any {
  const TIER = [['#B4703A', '#E3A774', 0.35], ['#BFC6CE', '#F2F5F8', 0.25], ['#D4AA2F', '#FFE08A', 0.22], ['#DCE3EA', '#FFFFFF', 0.12], ['#9FE6FF', '#FFFFFF', 0.06], ['#FF7A3D', '#FFD36B', 0.18]] as [string, string, number][];
  const [col, hi, rough] = TIER[b.tier] || TIER[0];
  const g = new T.Group();
  const metal = new T.MeshStandardMaterial({ color: new T.Color(col), metalness: 1, roughness: rough });
  // the faces: the icon and lettering raised (a bump map), a little darker in the hollows
  const face = (back: boolean) => {
    const [c, x] = v3vCanvas(512, 512); x.fillStyle = col; x.fillRect(0, 0, 512, 512);
    const [bc, bx] = v3vCanvas(512, 512); bx.fillStyle = '#000'; bx.fillRect(0, 0, 512, 512);
    for (const [ctx, ink] of [[x, hi], [bx, '#FFF']] as [CanvasRenderingContext2D, string][]) {
      ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(256, 256, 226, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(256, 256, 204, 0, Math.PI * 2); ctx.stroke();
      if (!back) {
        v3vDrawIcon(ctx, b.icon, 256, 236, 210, 2.2);
        ctx.font = '700 34px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(TIER_NAMES[b.tier].toUpperCase(), 256, 410);
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ctx.beginPath(); ctx.arc(256 + Math.cos(a) * 215, 256 + Math.sin(a) * 215, 3, 0, 7); ctx.fill(); }
      } else {
        ctx.textAlign = 'center'; ctx.font = '700 40px Inter, sans-serif';
        const words = b.title.split(' '); const lines: string[] = []; let ln = '';
        for (const w of words) { if (ctx.measureText(ln + ' ' + w).width > 330 && ln) { lines.push(ln); ln = w; } else ln = ln ? ln + ' ' + w : w; } lines.push(ln);
        lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 256, 210 + i * 48 - (lines.length - 1) * 20));
        ctx.font = '500 28px Inter, sans-serif'; ctx.fillText(earnedAt ? 'Earned ' + dateStr(new Date(earnedAt)).slice(0, 10) : '', 256, 360);
        v3vDrawIcon(ctx, 'star', 256, 120, 46, 2);
      }
    }
    const tm = v3vTex(T, c), tb = v3vTex(T, bc, false);
    for (const t of [tm, tb]) { t.center.set(0.5, 0.5); t.rotation = back ? -V3V_ROT : V3V_ROT; if (back) t.repeat.set(-1, 1); }
    return new T.MeshStandardMaterial({ color: 0xFFFFFF, map: tm, bumpMap: tb, bumpScale: 0.035, metalness: 1, roughness: rough });
  };
  const disc = new T.Mesh(new T.CylinderGeometry(1, 1, 0.12, 96), [metal, face(false), face(true)]);
  disc.rotation.x = Math.PI / 2; disc.position.y = 1.15; g.add(disc);
  const rim = new T.Mesh(new T.TorusGeometry(1, 0.06, 18, 96), metal); rim.position.y = 1.15; g.add(rim);
  // the loop and the ring at the top
  const loop = new T.Mesh(new T.TorusGeometry(0.12, 0.035, 12, 32), metal); loop.position.set(0, 2.25, 0); g.add(loop);
  const ring = new T.Mesh(new T.TorusGeometry(0.2, 0.03, 12, 40), metal); ring.rotation.y = Math.PI / 2; ring.position.set(0, 2.42, 0); g.add(ring);
  // the ribbon: two bands meeting at the ring, in stripes
  const [rc, rx] = v3vCanvas(128, 256); const stripes = b.tier >= 2 ? ['#0B2A55', '#D4AA2F', '#0B2A55', '#FFFFFF', '#0B2A55'] : ['#7A1F2B', '#FFFFFF', '#2C5FA8', '#FFFFFF', '#7A1F2B'];
  stripes.forEach((s, i) => { rx.fillStyle = s; rx.fillRect(i * 128 / stripes.length, 0, 128 / stripes.length + 1, 256); });
  const rib = new T.MeshStandardMaterial({ map: v3vTex(T, rc), roughness: 0.75, side: T.DoubleSide });
  for (const s of [-1, 1]) { const band = new T.Mesh(new T.PlaneGeometry(0.62, 1.5), rib); band.position.set(s * 0.26, 3.05, -0.04 * s); band.rotation.z = s * 0.28; g.add(band); }
  return g;
}

ACTIONS['badge-3d'] = el => {
  const b = badgeDefs().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!b) return;
  const at = ((State as any).badges || {})[b.id] || 0;
  viewer3dOpen({ title: b.title, sub: `${TIER_NAMES[b.tier]} badge${at ? ' · earned ' + dateStr(new Date(at)).slice(0, 10) : ''}`, info: `<p>${esc(b.desc)}</p>`, build: T => badgeMedal(T, b, at) });
};
