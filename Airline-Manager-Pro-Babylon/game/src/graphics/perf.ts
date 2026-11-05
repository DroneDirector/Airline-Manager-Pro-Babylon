// Automatic performance for the 3D views and rooms on phones and tablets (and on the PC when switched on).
// Each renderer keeps its own small state; every frame it asks whether to draw now (a frame-rate cap when the
// device is warm or saving battery) and how sharp to draw (the resolution goes down step by step while the
// frame rate is low, and back up when there is room). The device's own temperature and battery saver are read
// every 20 seconds on Android.

const PERF_MIN_K = 0.55;
const Perf = {
  thermal: 0, saver: false, polled: 0, polling: false,
  /** Switched on? Automatic on phones and tablets, chosen on the PC. */
  on(): boolean {
    const v = (State.settings as any).perfAuto;
    return v == null ? false : v !== false && v !== 'off';   // off unless chosen: frame generation keeps it smooth instead
  },
  /** The device's temperature level (Android: 0 cool … 6 shutting down) and battery saver, every 20 s. */
  poll() {
    const now = Date.now(); if (this.polling || now - this.polled < 20000) return; this.polled = now;
    const c: any = (window as any).Capacitor, T = c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.AppTools;
    if (!T || !T.boostStats) return;
    this.polling = true;
    T.boostStats().then((r: any) => { this.thermal = +(r && r.thermal) || 0; this.saver = !!(r && r.powerSave); }).catch(() => { /* no readings */ }).then(() => { this.polling = false; });
  },
  /** The highest frame rate worth drawing now: 30 while warm or saving battery, otherwise as fast as the screen. */
  fpsCap(): number { const w = this.on() && (this.thermal >= 2 || this.saver) ? 30 : 0, u = typeof Gfx !== 'undefined' ? Gfx.fps() : 0; return w && u ? Math.min(w, u) : w || u; },
  /** The sharpest it may draw now (warm: less, hot: less again). */
  kMax(): number { return !this.on() ? 1 : this.thermal >= 4 ? 0.6 : this.thermal >= 3 ? 0.7 : this.thermal >= 2 ? 0.85 : 1; },
  /** A renderer's own state. */
  state(): any { return { t0: 0, n: 0, k: 1, base: 0, last: 0, lowN: 0, highN: 0, pending: 0, ren: null }; },
  /** Skip this frame? (Call first each frame; with a cap of 30, every other frame of a 60 Hz screen is skipped.) */
  skip(st: any, now?: number): boolean {
    if (!st) return false;
    this.poll();
    // a new sharpness is put in at the start of a frame, just before it is drawn: changing it resizes the drawing
    // surface, which clears it, so done after a frame the screen showed an empty picture for a moment (a flicker)
    if (st.pending && st.ren) { const r = st.ren, want = st.pending; st.pending = 0; if (Math.abs(r.getPixelRatio() - want) > 0.02) { r.setPixelRatio(want); try { r.domElement && r.domElement.dispatchEvent(new Event('perf')); } catch (e) { /* ignore */ } } }
    const cap = this.fpsCap(), t = now == null ? performance.now() : now;
    if (cap && FrameGen.on()) { st.last = t; return false; }   // frame generation fills the frames in between instead
    if (cap && st.last && t - st.last < 1000 / cap - 3) return true;
    st.last = t; return false;
  },
  /** After drawing: count the frame and set the renderer's sharpness for the frame rate it manages
   *  (top: the most frames a second this view ever draws, when it has a cap of its own). */
  frame(st: any, r: any, top?: number) {
    if (!st || !r) return;
    if (!st.base) st.base = r.getPixelRatio();
    const now = performance.now(); if (st.gen && FrameGen.on() && (Perf.fpsCap() || FrameGen.mode() === 'on') && st.lastReal === st.real) return; st.lastReal = st.real; st.n++;   // with frame generation, only the real frames count
    if (!st.t0) { st.t0 = now; st.n = 0; return; }
    if (now - st.t0 < 1500) return;
    const lim = Math.min(this.fpsCap() || 999, top || 999), full = lim < 999 ? lim : 0;
    const fps = st.n * 1000 / (now - st.t0), goal = full ? Math.min(28, full * 0.88) : 28; st.n = 0; st.t0 = now;
    // only after two readings in a row the same way, so the sharpness doesn't swing back and forth around the limit
    if (!this.on()) { st.k = 1; st.lowN = st.highN = 0; }
    else if (fps < goal) { st.highN = 0; if (++st.lowN >= 2) { st.k = Math.max(PERF_MIN_K, st.k - 0.1); st.lowN = 0; } }
    else if (fps > (full ? full * 0.95 : 42)) { st.lowN = 0; if (++st.highN >= 2) { st.k = Math.min(1, st.k + 0.05); st.highN = 0; } }
    else st.lowN = st.highN = 0;
    st.k = Math.min(st.k, this.kMax());
    st.fps = Math.round(fps);
    const want = Math.max(0.5, st.base * st.k);
    if (Math.abs(r.getPixelRatio() - want) > 0.02) { st.pending = want; st.ren = r; }   // put in before the next frame is drawn (see skip)
    Perf.lastK = st.k; Perf.lastFps = st.fps;
  },
  lastK: 1, lastFps: 0,
  /** What it is doing now, for Settings. */
  label(): string {
    if (!this.on()) return 'Off: the 3D views always draw at full sharpness and frame rate.';
    const why = this.thermal >= 3 ? 'the device is hot' : this.thermal >= 2 ? 'the device is warm' : this.saver ? 'battery saver is on' : '';
    const cap = this.fpsCap();
    return `${why ? `Now: ${why}, so ` : 'Now: '}${cap ? `up to ${cap} frames a second` : 'as smooth as the screen allows'}, drawn at ${Math.round(this.lastK * 100)}% sharpness${this.lastFps ? ` (last seen: ${this.lastFps} frames a second)` : ''}.`;
  },
};

/* ---------- frame generation: an in-between frame made from the last one, for smoother turning ---------- */
// With the frame rate held at 30 (warm, battery saver), the scene is drawn 30 times a second into a picture with
// its depth; on the screen's other frames that picture is shifted to where the camera is now (each point moved by
// its own distance), so looking around and walking stay as smooth as the screen. Things that move by themselves
// still move 30 times a second; edges uncovered by the shift take the nearest colour.
/** What frame generation did in the last second, for the performance monitor. */
const FgStat: any = { real: 0, made: 0, shown: 0, t0: 0, fps: 0, realFps: 0, madeFps: 0, cpu: 0, gpu: 0, gq: null as any, cpuAcc: 0, cpuN: 0 };
const FrameGen = {
  /** Switched on? On unless switched off ('on', the default: always, as many frames in between as help; 'auto': only
   *  while the frame rate is held at 30). */
  mode(): string { const v = (State.settings as any).frameGen; return v == null ? 'on' : String(v); },
  on(): boolean { const v = this.mode(); return v === 'on' || (v === 'auto' && Perf.on()); },
  /** How many made frames to put after each real one (always on): as many as fit while a real frame takes its time,
   *  none when real frames come as fast as the screen anyway. */
  between(st: any): number {
    // the screen's own pace: the shortest wait between frames lately (60 Hz: about 17 ms)
    const vs = Math.max(6, Math.min(17.5, st.vsync || 16.7)), r = st.realDt || vs;
    if (r < vs * 1.4) return 0;   // real frames keep up with the screen: nothing to add
    return Math.max(1, Math.min(2, Math.round(r / vs) - 1));   // at most two: real motion (other aircraft, people) stays at a good pace
  },
  /** Before a frame's work (the 3D view): real or made? A made frame can skip the heavy work; draw() follows it. */
  plan(st: any, now: number): 'real' | 'made' {
    if (!st || !this.on() || this.mode() !== 'on' || !st.gen || !st.gen.fresh) { if (st) st.plan = 'real'; return 'real'; }
    st.plan = (st.madeRun || 0) >= this.between(st) ? 'real' : 'made'; return st.plan;
  },
  /** One second of counts and times for the monitor. */
  tick(t: number, real: boolean, cpu: number) {
    const S = FgStat; S.shown++; if (real) S.real++; else S.made++; S.cpuAcc += cpu; S.cpuN++;
    if (!S.t0) S.t0 = t;
    if (t - S.t0 >= 1000) { const k = 1000 / (t - S.t0); S.fps = Math.round(S.shown * k); S.realFps = Math.round(S.real * k); S.madeFps = Math.round(S.made * k); S.cpu = S.cpuN ? S.cpuAcc / S.cpuN : 0; S.shown = S.real = S.made = 0; S.cpuAcc = 0; S.cpuN = 0; S.t0 = t; }
  },
  /** The graphics chip's time for a real frame (where the browser can measure it). */
  gpuBegin(ren: any): any {
    try {
      const S = FgStat; if (!S.gq || S.gq.gl !== ren.getContext()) { const gl = ren.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); S.gq = ext ? { gl, ext, pend: [] as any[] } : { gl, ext: null, pend: [] }; }
      const G = S.gq; if (!G.ext || G.pend.length > 3) return null;
      for (let i = G.pend.length - 1; i >= 0; i--) { const q = G.pend[i]; if (G.gl.getQueryParameter(q, G.gl.QUERY_RESULT_AVAILABLE)) { if (!G.gl.getParameter(G.ext.GPU_DISJOINT_EXT)) { const ns = G.gl.getQueryParameter(q, G.gl.QUERY_RESULT); S.gpu = S.gpu ? S.gpu * 0.8 + ns / 1e6 * 0.2 : ns / 1e6; } G.gl.deleteQuery(q); G.pend.splice(i, 1); } }
      const q = G.gl.createQuery(); G.gl.beginQuery(G.ext.TIME_ELAPSED_EXT, q); return q;
    } catch (e) { return null; }
  },
  gpuEnd(q: any) { if (!q) return; try { const G = FgStat.gq; G.gl.endQuery(G.ext.TIME_ELAPSED_EXT); G.pend.push(q); } catch (e) { /* no timer */ } },
  /** Draw this frame: the real scene when its turn has come, otherwise an in-between frame. */
  draw(st: any, ren: any, scene: any, cam: any, now?: number): boolean {
    const t = now == null ? performance.now() : now, c0 = performance.now(), always = this.mode() === 'on', cap = Perf.fpsCap() || (st && st.genCap) || 0;
    // how long the screen waited after a real frame and after a made one (always on: decides how many to make)
    if (st) { const dt = st.prevT ? t - st.prevT : 0; st.prevT = t; if (dt > 0 && dt < 250) { if (st.lastWasReal) st.realDt = st.realDt ? st.realDt * 0.85 + dt * 0.15 : dt; else st.genDt = st.genDt ? st.genDt * 0.85 + dt * 0.15 : dt;
      if (!st.vsync || dt < st.vsync) st.vsync = st.vsync ? st.vsync * 0.5 + dt * 0.5 : dt; else st.vsync = Math.min(17.5, st.vsync * 1.002); } }   // the screen's pace: follows the shortest waits, creeps up slowly
    if (!st || !this.on() || (!cap && !always)) { const q = this.gpuBegin(ren); ren.render(scene, cam); this.gpuEnd(q); if (st) st.lastWasReal = true; this.tick(t, true, performance.now() - c0); return true; }
    const G = st.gen || (st.gen = this.make(this.samples(ren)));
    if (!G) { ren.render(scene, cam); return true; }
    const T = THREE, sz = ren.getDrawingBufferSize(new T.Vector2());
    if (G.rt.width !== sz.x || G.rt.height !== sz.y) { G.rt.setSize(sz.x, sz.y); G.fresh = false; }
    cam.updateMatrixWorld();
    let real: boolean;
    if (always) { if (st.plan) { real = st.plan === 'real' || !G.fresh; st.plan = ''; } else { const n = this.between(st); real = !G.fresh || n === 0 || (st.madeRun || 0) >= n; } }
    else real = !G.fresh || !st.realAt || t - st.realAt >= 1000 / cap - 3;
    // circling round the aircraft you follow: when the camera has swung round it too far since the drawn picture, the
    // picture can't be shifted far enough without gaps opening round the aircraft (the jumping): a real frame instead
    if (!real && G.aOn === 1 && st.anchor && st.anchor.parent && G.camA) {
      const A = st.anchor; A.updateMatrix(); const aNow = G.tmp2.multiplyMatrices(A.parent.matrixWorld, A.matrix), inA = aNow.invert().multiply(cam.matrixWorld);
      const e = inA.elements, p = G.camA.elements, f0 = [p[8], p[9], p[10]], f1 = [e[8], e[9], e[10]];
      const dot = (f0[0] * f1[0] + f0[1] * f1[1] + f0[2] * f1[2]) / Math.max(1e-6, Math.hypot(f0[0], f0[1], f0[2]) * Math.hypot(f1[0], f1[1], f1[2]));
      const moved = Math.hypot(e[12] - p[12], e[13] - p[13], e[14] - p[14]), dist = Math.max(1, Math.hypot(p[12], p[13], p[14]));
      if (dot < Math.cos(0.03) || moved / dist > 0.03) real = true;
    }
    // never a long run of made frames: a real one at least every few frames, whatever the room
    if (!real && (st.madeRun || 0) >= 3) real = true;
    if (real) {
      // the real frame: drawn into the picture, with the camera it was drawn from
      const q = this.gpuBegin(ren); ren.setRenderTarget(G.rt); ren.render(scene, cam); this.layer(G, st, ren, cam, scene); ren.setRenderTarget(null); this.gpuEnd(q);
      G.prevVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); G.fresh = true; st.realAt = t; st.real = (st.real || 0) + 1; st.madeRun = 0;
      G.aOn = 0; const A = st.anchor; if (A && (A.parent || A.isCamera)) { G.aPrev.copy(A.matrixWorld); G.aOn = st.anchorAll ? 2 : G.layOk ? 1 : 0; G.camA = (G.camA || new THREE.Matrix4()).copy(A.matrixWorld).invert().multiply(cam.matrixWorld); }
    } else { st.made = (st.made || 0) + 1; st.madeRun = (st.madeRun || 0) + 1; }
    st.lastWasReal = real;
    // on the screen: the picture, shifted from the camera it was drawn from to the camera now
    const U = G.mat.uniforms;
    // from the screen now straight to the drawn picture, worked out here at full precision: in the shader, a trip
    // through the world's own coordinates (kilometres from the centre, an eye a hand's width from a seat) loses so much
    // that the picture breaks up into blocks
    const inv = G.tmp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).invert();
    U.uMW.value.multiplyMatrices(G.prevVP, inv);
    // what moves with the aircraft you follow: from where it is now back to where it was in the drawn picture
    U.uUseA.value = 0;
    if (G.aOn && st.anchor && (st.anchor.parent || st.anchor.isCamera)) {
      const A = st.anchor; if (A.parent) { A.updateMatrix(); G.aNow.multiplyMatrices(A.parent.matrixWorld, A.matrix); } else { A.updateMatrixWorld(); G.aNow.copy(A.matrixWorld); }
      U.uMA.value.copy(G.aNow).invert().premultiply(G.aPrev).premultiply(G.prevVP).multiply(inv); U.uUseA.value = G.aOn;
    }
    U.uNear.value = cam.near; U.uFar.value = cam.far; U.uLog.value = ren.capabilities && ren.capabilities.logarithmicDepthBuffer ? 1 : 0; U.uP22.value = cam.projectionMatrix.elements[10]; U.uP32.value = cam.projectionMatrix.elements[14];
    ren.render(G.scene, G.cam);
    this.tick(t, real, performance.now() - c0);
    return real;
  },
  /** Edge smoothing for the drawn picture: the same as the screen's (it was missing, so frame generation looked rough). */
  samples(ren: any): number {
    try { const gl = ren.getContext(), a = gl.getContextAttributes(); if (!a || !a.antialias || !ren.capabilities.isWebGL2) return 0; return Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0); } catch (e) { return 0; }
  },
  /** Every light's glow in the scene (sprites, points and small additive glows; never the sky's own layers): they
   *  leave no depth in the picture, so the motion layer gives them their own. Lights added later count by themselves. */
  glows(G: any, scene: any, A: any): any[] {
    if (!scene) return [];
    const now = performance.now(); if (G.glowAt && now - G.glowAt < 2000 && G.glowScene === scene) return G.glowList;
    G.glowAt = now; G.glowScene = scene; const out: any[] = [], T = THREE;
    scene.traverse((o: any) => {
      if (o === A) return;   // the followed aircraft's own lights move with it: left out of its layer, as see-through parts
      const m = o.material; if (!m || Array.isArray(m) || !m.transparent || m.depthWrite || m.depthTest === false || m.side === T.BackSide) return;
      let glow = o.isSprite || o.isPoints;
      if (!glow && o.isMesh && m.blending === T.AdditiveBlending) { const g = o.geometry; if (g && !g.boundingSphere && g.computeBoundingSphere) g.computeBoundingSphere(); const r = g && g.boundingSphere ? g.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) : 1e9; glow = r < 60; }
      if (glow) { let p = o.parent, inA = false; while (p) { if (p === A) { inA = true; break; } p = p.parent; } if (!inA) out.push(o); }
    });
    G.glowList = out; return out;
  },
  /** With a real frame: the motion layer, a small picture of the aircraft you follow (st.anchor) and of the clouds'
   *  distance (st.depthOnly), so made frames move each by its own motion. Nothing to do inside the aircraft. */
  layer(G: any, st: any, ren: any, cam: any, scene?: any) {
    G.layOk = false;
    // what moves with the anchor: the anchor itself, or (anchored to the camera) the things held in your hands
    const draw: any[] = (st.anchorDraw ? st.anchorDraw : st.anchor ? [st.anchor] : []).filter((o: any) => o && o.visible && o.parent && !o.isCamera);
    const A = draw.length ? draw[0] : null, extra: any[] = (st.depthOnly || []).concat(this.glows(G, scene, A)).filter((o: any) => o && o.visible && o.parent);
    if (st.anchorAll) return;   // inside the aircraft: everything moves with it, no layer needed
    try {
      const T = THREE, sz = ren.getDrawingBufferSize(new T.Vector2()), w = sz.x, h = sz.y;
      if (G.lay.width !== w || G.lay.height !== h) G.lay.setSize(w, h);
      G.mat.uniforms.uLTex.value.set(1 / w, 1 / h);
      const col = ren.getClearColor(new T.Color()), alpha = ren.getClearAlpha(), L = G.lscene;
      ren.setRenderTarget(G.lay); ren.setClearColor(0x000000, 0); ren.clear(true, true, false);
      const was = ren.autoClear; ren.autoClear = false;
      L.matrixWorldAutoUpdate = false;
      // the aircraft in plain white (it keeps its place in the scene: only drawn from here)
      if (A) {
        // all of it but its lights: glows and halos (points, sprites, lines and anything added on as light) would mark the
        // sky round them as aircraft. See-through parts that belong to it stay: the cabin windows, their glass, blinds and
        // the view through them, the propeller discs, so they move with the aircraft
        const off: any[] = [], T0 = THREE, glowM = (x: any) => x && (x.blending === T0.AdditiveBlending || (x.userData && x.userData.fgGlow));
        for (const D of draw) D.traverseVisible((o: any) => { const m = o.material; if (o.isSprite || o.isPoints || o.isLine || (m && (Array.isArray(m) ? m.some(glowM) : glowM(m)))) off.push(o); });
        for (const o of off) o.visible = false;
        L.overrideMaterial = G.white; L.children = draw;
        try { ren.render(L, cam); } finally { for (const o of off) o.visible = true; }
      }
      // the clouds and every light's glow: only their distance (the clouds where they are thick enough to be seen), all
      // in one go
      L.overrideMaterial = null;
      if (extra.length) {
        const keep: any[] = [];
        for (const o of extra) {
          const m = o.material, U = m && m.uniforms; if (!m) continue;
          keep.push([m, m.depthWrite, m.colorWrite, U && U.uCut ? U.uCut.value : null]);
          m.depthWrite = true; m.colorWrite = false; if (U && U.uCut) U.uCut.value = 0.25;
        }
        L.children = extra;
        try { ren.render(L, cam); } finally { for (const k of keep.reverse()) { k[0].depthWrite = k[1]; k[0].colorWrite = k[2]; if (k[3] != null) k[0].uniforms.uCut.value = k[3]; } }
      }
      L.children = []; ren.autoClear = was; ren.setClearColor(col, alpha); ren.setRenderTarget(G.rt);
      G.layOk = !!A;
    } catch (e) { try { G.lscene.children = []; ren.setRenderTarget(G.rt); } catch (e2) { /* as it was */ } }
  },
  make(aa: number): any {
    try {
      const T = THREE, rt = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType, samples: aa });
      rt.depthTexture = new T.DepthTexture(4, 4); rt.depthTexture.type = T.UnsignedIntType;
      // the motion layer (drawn with each real frame, plainly): where the aircraft you follow is (red) and how far away
      // things are that leave no depth of their own in the picture (the clouds)
      const lay = new T.WebGLRenderTarget(4, 4); lay.depthTexture = new T.DepthTexture(4, 4); lay.depthTexture.type = T.UnsignedIntType;
      const mat = new T.ShaderMaterial({
        uniforms: { tCol: { value: rt.texture }, tDep: { value: rt.depthTexture }, tLay: { value: lay.texture }, tLDep: { value: lay.depthTexture }, uUseA: { value: 0 }, uLTex: { value: new T.Vector2(0.01, 0.01) }, uMW: { value: new T.Matrix4() }, uMA: { value: new T.Matrix4() }, uNear: { value: 0.1 }, uFar: { value: 100 }, uLog: { value: 0 }, uP22: { value: -1 }, uP32: { value: -0.2 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `uniform sampler2D tCol; uniform sampler2D tDep; uniform sampler2D tLay; uniform sampler2D tLDep; uniform mat4 uMW; uniform mat4 uMA; uniform float uFar, uLog, uP22, uP32, uUseA; uniform vec2 uLTex; varying vec2 vUv;
          // a logarithmic depth buffer (the long-range 3D view) back to the ordinary depth this shift works with
          float lin(float d) { if (uLog < 0.5) return d; float w = exp2(d * log2(uFar + 1.0)) - 1.0; return ((uP22 * -w + uP32) / w) * 0.5 + 0.5; }
          float depP(vec2 uv) { return lin(texture2D(tDep, clamp(uv, 0.0, 1.0)).x); }
          // the nearer of the picture and the motion layer: clouds count at their own distance, not the ground's behind them
          float depS(vec2 uv) { vec2 c = clamp(uv, 0.0, 1.0); return min(lin(texture2D(tDep, c).x), lin(texture2D(tLDep, c).x)); }
          float onA(vec2 uv) { return texture2D(tLay, clamp(uv, 0.0, 1.0)).r; }
          // the world stands still between real frames: only the camera moved
          vec2 backW(vec2 uv, float d) { vec4 p = uMW * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xy / p.w * 0.5 + 0.5; }
          // the aircraft you follow (and everything in it: the cabin, the people) moved on with it
          vec2 backA(vec2 uv, float d) { vec4 p = uMA * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xy / p.w * 0.5 + 0.5; }
          void main() {
            vec2 s;
            if (uUseA > 1.5) {
              // inside the aircraft: all of the picture moves with it
              float d = depP(vUv); s = backA(vUv, d); d = depP(s); s = backA(vUv, d); d = min(d, depP(s)); s = backA(vUv, d);
            } else {
              // where this point was in the drawn picture: guess with the depth here, then once more with the depth found there
              float d = depS(vUv); s = backW(vUv, d);
              d = depS(s); s = backW(vUv, d);
              d = min(d, depS(s)); s = backW(vUv, d);
              if (uUseA > 0.5) {
                float da = depP(vUv); vec2 sa = backA(vUv, da); da = depP(sa); sa = backA(vUv, da); da = depP(sa); sa = backA(vUv, da);
                if (onA(sa) > 0.5) s = sa;   // the aircraft: carried along with it
                else if (onA(s) > 0.5) {
                  // ground or sky that the aircraft covered in the drawn picture: the nearest of it beside the aircraft
                  vec2 dir = s - sa; float L = length(dir / uLTex);
                  dir = L > 0.01 ? dir / L : vec2(uLTex.x, 0.0);
                  for (int i = 1; i <= 24; i++) {
                    vec2 q1 = s + dir * float(i) * 1.5, q2 = s - dir * float(i) * 1.5;
                    if (onA(q1) < 0.5) { s = q1; break; }
                    if (onA(q2) < 0.5) { s = q2; break; }
                  }
                }
              }
            }
            vec2 sc = clamp(s, vec2(0.0005), vec2(0.9995));
            gl_FragColor = texture2D(tCol, sc);
            // the background colour is never tone-mapped when drawn straight to the screen, so not here either
            #if defined( TONE_MAPPING )
            if (texture2D(tDep, sc).x < 0.999999) gl_FragColor.rgb = toneMapping(gl_FragColor.rgb);
            #endif
            #include <colorspace_fragment>
          }`,
        depthTest: false, depthWrite: false,
      });
      const scene = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new T.Mesh(new T.PlaneGeometry(2, 2), mat); q.frustumCulled = false; scene.add(q);
      return { rt, lay, mat, scene, cam, prevVP: new T.Matrix4(), tmp: new T.Matrix4(), tmp2: new T.Matrix4(), camA: null as any, aPrev: new T.Matrix4(), aNow: new T.Matrix4(), aOn: 0, layOk: false, lscene: new T.Scene(), white: new T.MeshBasicMaterial({ color: 0xffffff }), fresh: false };
    } catch (e) { return null; }
  },
  dispose(st: any) { const G = st && st.gen; if (!G) return; try { G.rt.dispose(); G.lay.dispose(); G.mat.dispose(); G.white.dispose(); } catch (e) { /* gone */ } st.gen = null; },
};
