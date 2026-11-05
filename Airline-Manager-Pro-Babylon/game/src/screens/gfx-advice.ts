// Recommended graphics settings: what this device is (memory, processor, graphics chip, screen and its refresh rate)
// gives a recommended preset. It never changes anything by itself: "Change to recommended settings" applies it.
// The stress test walks the joined rooms (office, Operations, concourse, lounge) while asking more and more of the
// device, stops close to its limit (never past it), and reports how it coped and what to use.

interface DevSpec { name: string; gpu: string; ramMb: number; cores: number; hz: number; w: number; h: number; dpr: number; maxTex: number; pc: boolean; phone: boolean }
const GfxAdvice: any = { spec: null as DevSpec | null, busy: false };

/** What the device is. Native details on the phone (memory, chip, refresh rate) and the PC (memory, graphics card). */
function gfxSpec(): Promise<DevSpec> {
  if (GfxAdvice.spec) return Promise.resolve(GfxAdvice.spec);
  const nav: any = navigator, pc = typeof DESKTOP !== 'undefined' && DESKTOP;
  const s: DevSpec = { name: '', gpu: '', ramMb: nav.deviceMemory ? nav.deviceMemory * 1024 : 0, cores: nav.hardwareConcurrency || 0, hz: 60, w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1, maxTex: 0, pc, phone: !pc && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) };
  try {
    const c = document.createElement('canvas'), gl: any = c.getContext('webgl2') || c.getContext('webgl');
    if (gl) { const ext = gl.getExtension('WEBGL_debug_renderer_info'); s.gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || ''); s.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0; const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
  } catch (e) { /* no graphics details */ }
  s.gpu = s.gpu.replace(/^ANGLE \((.*)\)$/, '$1').replace(/, (D3D11|Vulkan|OpenGL)[^,]*$/i, '').replace(/ \(0x[0-9A-F]+\)/gi, '').trim();
  // the screen's refresh rate, counted
  const hz = new Promise<number>(res => { let n = 0, t0 = 0; const f = (t: number) => { if (!t0) t0 = t; if (++n < 45) requestAnimationFrame(f); else res(Math.round((n - 1) / ((t - t0) / 1000))); }; requestAnimationFrame(f); setTimeout(() => res(60), 1500); });
  const cap: any = (window as any).Capacitor, T = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.AppTools;
  const native = T && T.deviceInfo ? T.deviceInfo().then((r: any) => { s.name = r.device || ''; if (r.ramMb) s.ramMb = +r.ramMb; if (r.cores) s.cores = +r.cores; if (r.soc && !/unknown/i.test(r.soc)) s.name += ` (${r.soc})`; if (r.hz) s.hz = Math.round(+r.hz); s.phone = true; }, () => { /* the browser's own */ })
    : pc ? fetch('/api/sysinfo').then(r => r.json()).then(r => { if (r.ramMb) s.ramMb = r.ramMb; if (r.cores) s.cores = r.cores; s.name = String(r.cpu || '').trim(); const g = (r.gpus || []).filter((x: any) => x.kind === 'dedicated')[0] || (r.gpus || [])[0]; if (g && g.name) s.gpu = g.name; }, () => { /* the browser's own */ }) : Promise.resolve();
  return Promise.all([hz, native]).then(([h]) => { if (!s.hz || s.hz === 60) s.hz = Math.max(30, Math.min(240, h || 60)); GfxAdvice.spec = s; return s; });
}
/** How strong the graphics chip is, from its name: 0 weak … 3 very strong. */
function gfxGpuTier(g: string, pc: boolean): number {
  const n = g.toLowerCase(), num = (re: RegExp) => { const m = re.exec(n); return m ? +m[1] : 0; };
  if (/rtx\s*(40|50)\d\d|rx\s*(79|78|77)\d\d|apple m[2-9] (pro|max|ultra)/.test(n)) return 3;
  if (/rtx|rx\s*[67]\d\d\d|arc a7|apple m\d/.test(n)) return pc ? (num(/rtx\s*(\d)0\d\d/) >= 3 ? 3 : 2) : 3;
  if (/gtx\s*1[06]\d\d|rx\s*5\d\d\d|rx\s*5[78]0|arc/.test(n)) return 2;
  if (/adreno/.test(n)) { const a = num(/adreno[^\d]*(\d{3})/); return a >= 740 ? 3 : a >= 650 ? 2 : a >= 610 ? 1 : 0; }
  if (/mali/.test(n)) { const a = num(/mali-g(\d+)/); return /immortalis|g7[1-9]\d|g720|g715|g710/.test(n) ? 3 : a >= 77 ? 2 : a >= 57 ? 1 : 0; }
  if (/xclipse|apple gpu|apple a1[5-9]/.test(n)) return 2;
  if (/powervr|vivante|videocore|swiftshader|llvmpipe|software/.test(n)) return 0;
  if (/iris xe|radeon(\(tm\))? graphics|780m|680m|vega/.test(n)) return 1;
  if (/intel|uhd|hd graphics/.test(n)) return 0;
  return pc ? 1 : 1;
}
/** The recommended preset for a device (low, medium, high, ultra), and why. */
function gfxRecommend(s: DevSpec): { preset: string; why: string } {
  const tier = gfxGpuTier(s.gpu + ' ' + s.name, s.pc), gb = s.ramMb / 1024, px = s.w * s.h * s.dpr * s.dpr;
  let p = 0;   // 0 low … 3 ultra
  if (s.pc) p = tier >= 3 && gb >= 15 ? 3 : tier >= 2 ? 2 : tier >= 1 && gb >= 8 ? 1 : 0;
  else p = tier >= 3 && gb >= 7 ? 2 : tier >= 2 && gb >= 5.5 ? 2 : (tier >= 1 && gb >= 3.5) || gb >= 5.5 ? 1 : 0;
  if (px > 3.6e6 && tier <= 1 && p > 1) p--;   // a very sharp screen with a modest chip: one step lighter (never below Medium for that alone)
  if (gb && gb < 3 && p > 0) p = 0;
  if (!s.pc && gb >= 5.5 && p < 1) p = 1;   // 6 GB and more: at least Medium
  const names = ['low', 'medium', 'high', 'ultra'];
  const why = [tier >= 3 ? 'a very strong graphics chip' : tier >= 2 ? 'a strong graphics chip' : tier >= 1 ? 'a mid-range graphics chip' : 'a modest graphics chip', gb ? `${Math.round(gb)} GB of memory` : '', px > 3.6e6 ? 'a very sharp screen' : ''].filter(Boolean).join(', ');
  return { preset: names[p], why };
}
/** The stress test's result, if it has run on this device. */
function gfxStressLast(): any { const v = (State.settings as any).gfxStress; return v && v.preset ? v : null; }
const GFX_PRESET_LABEL: any = { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra', auto: 'Automatic' };

/** Settings → Graphics: the card at the top. */
function gfxAdviceHtml(): string {
  const s = GfxAdvice.spec as DevSpec;
  if (!s) { gfxSpec().then(() => { try { rerenderSettingsBody(); } catch (e) { /* closed */ } }); return `<div class="set-card col gfx-rec"><div class="sc-h">${icon('sliders')}<span><b>Recommended for this device</b><small>Looking at this device…</small></span></div></div>`; }
  const rec = gfxRecommend(s), st = gfxStressLast(), want = st ? st.preset : rec.preset, cur = typeof Gfx !== 'undefined' && Gfx.preset ? Gfx.preset() : '';
  const row = (k: string, v: string) => v ? `<div class="gr-row"><span>${k}</span><b>${esc(v)}</b></div>` : '';
  return `<div class="set-card col gfx-rec"><div class="sc-h">${icon('sliders')}<span><b>Recommended for this device: ${GFX_PRESET_LABEL[want]}</b><small>${st ? `From the stress test on ${esc(new Date(st.at).toLocaleDateString())}: ${esc(st.rating)}.` : `From what this device is: ${esc(rec.why)}.`} Nothing changes until you choose to.</small></span></div>
    <div class="gr-spec">${row('Device', s.name || (s.pc ? 'This PC' : 'This device'))}${row('Graphics', s.gpu)}${row('Memory', s.ramMb ? `${Math.round(s.ramMb / 1024)} GB` : '')}${row('Processor cores', s.cores ? String(s.cores) : '')}${row('Screen', `${s.w} × ${s.h}${s.dpr > 1 ? ` (×${Math.round(s.dpr * 100) / 100})` : ''}, ${s.hz} Hz`)}${row('Your settings now', cur ? GFX_PRESET_LABEL[cur] || cur : 'Custom')}</div>
    <div class="gr-acts"><button class="btn primary sm" data-act="gfx-rec-apply" data-v="${want}" ${cur === want ? 'disabled' : ''}>${icon('check')}${cur === want ? 'Recommended settings in use' : 'Change to recommended settings'}</button>
      <button class="btn ghost sm" data-act="gfx-stress">${icon('play')}Run a stress test</button>${(State.settings as any).gfxRecUndo ? `<button class="btn ghost sm" data-act="gfx-rec-undo">${icon('back')}Undo</button>` : ''}</div>
    <p class="fine-print">${icon('info')}The stress test walks through your office, the Operations office, the concourse and the lounge for about a minute, asking more and more of this device, and stops close to its limit (never past it). Then it tells you how well it coped and what to use.</p></div>`;
}
const GFX_REC_KEYS = ['gfxScale', 'gfxShadow', 'gfxLights', 'gfxAniso', 'gfxRoomQ', 'gfxPics', 'gfxShine', 'gfxFps', 'deskAA', 'v3dCabinQ', 'cloudDetail', 'v3dWater', 'v3dKm', 'v3dSatQ', 'v3dTerrainQ'];
ACTIONS['gfx-rec-apply'] = el => {
  const p = el.getAttribute('data-v'), S: any = State.settings; if (!p || !GFX_PRESETS[p]) return;
  const undo: any = {}; for (const k of GFX_REC_KEYS) undo[k] = S[k] === undefined ? null : S[k]; S.gfxRecUndo = undo;
  Object.assign(S, GFX_PRESETS[p]); try { Gfx.bump(); } catch (e) { /* later */ }
  Store.save(); Sound.tick(); toast(`Graphics set to ${GFX_PRESET_LABEL[p]}, as recommended`, 'ok'); rerenderSettingsBody();
};
ACTIONS['gfx-rec-undo'] = () => {
  const S: any = State.settings, u = S.gfxRecUndo; if (!u) return;
  for (const k of Object.keys(u)) { if (u[k] === null) delete S[k]; else S[k] = u[k]; } delete S.gfxRecUndo;
  try { Gfx.bump(); } catch (e) { /* later */ } Store.save(); Sound.tick(); toast('Your earlier graphics settings are back', 'ok'); rerenderSettingsBody();
};
ACTIONS['gfx-stress'] = () => {
  if (typeof company !== 'function' || !company()) { toast('Start or load a game first: the test walks through your own rooms', 'info'); return; }
  Sound.tick(); closeAll(); setTimeout(() => TestRooms.open({ stress: true }), 60);
};

/* ---------- the stress test ---------- */
// Stages, each held for a few seconds while the frame times are measured. Every stage asks more: sharper picture,
// shadows, more furniture drawn. As soon as the frames slow close to the limit, it stops (and nothing is pushed
// further), so the app is never at risk of closing.
const GFX_STRESS_STAGES: { name: string; pr: number; shadow: number; extra: number }[] = [
  { name: 'Light', pr: 0.75, shadow: 0, extra: 0 },
  { name: 'Normal', pr: 1, shadow: 0, extra: 0 },
  { name: 'Shadows', pr: 1, shadow: 1024, extra: 0 },
  { name: 'Sharper', pr: 1.5, shadow: 2048, extra: 1 },
  { name: 'Busy', pr: 1.5, shadow: 2048, extra: 3 },
  { name: 'Very sharp', pr: 2, shadow: 4096, extra: 4 },
  { name: 'Extreme', pr: 2.5, shadow: 4096, extra: 8 },
];
/** Started by the test rooms once they are built (TestRooms.stress set). */
function gfxStressStart() {
  const R = TestRooms; if (!R.on) return;
  for (const D of R.doors) { D.to = 1; D.k0 = 1; D.set(1); }
  const el = document.createElement('div'); el.className = 'gs-hud'; el.innerHTML = `<div class="gs-row"><b>Stress test</b><span class="gs-st">Getting ready…</span><i class="gs-bar"><i></i></i><button class="btn ghost sm" data-gs="stop">${icon('close')}Stop</button></div>
    <div class="gs-graph"><canvas width="560" height="150"></canvas><div class="gs-keys"><span class="k-f"><i></i>Frames a second <b class="gs-fps">–</b></span><span class="k-c"><i></i>Processor <b class="gs-cpu">–</b></span><span class="k-g"><i></i>Graphics <b class="gs-gpu">–</b></span></div></div>`;
  R.root.appendChild(el); el.addEventListener('click', e => { if ((e.target as HTMLElement).closest('[data-gs="stop"]')) gfxStressEnd(true); });
  for (const s of ['.tr-go', '.walk-pad', '.tr-hint']) { const x = R.root.querySelector(s) as HTMLElement; if (x) x.style.display = 'none'; }
  R.stress = { i: -1, t: 0, frames: [], results: [], extras: [], hz: GfxAdvice.spec ? GfxAdvice.spec.hz : 60, path: 0, hud: el, dpr: window.devicePixelRatio || 1, hist: [] as number[][], gq: gfxGpuTimer(R.ren) };
  gfxStressNext();
}
function gfxStressNext() {
  const R = TestRooms, S = R.stress; if (!S) return;
  S.i++; S.frames = []; S.t = 0; S.n = 0;
  if (S.i >= GFX_STRESS_STAGES.length) { gfxStressEnd(false); return; }
  const st = GFX_STRESS_STAGES[S.i], dpr = S.dpr;
  // the picture's sharpness for this stage (on a phone, never more than its own screen)
  R.ren.setPixelRatio(Math.min(st.pr * (DESKTOP ? 1 : Math.min(dpr, 2) / 1.5), DESKTOP ? 2.5 : dpr));
  R.ren.shadowMap.enabled = st.shadow > 0;
  R.scene.traverse((o: any) => { if (o.isLight && o.shadow && (o.isDirectionalLight || o.isSpotLight)) { o.castShadow = st.shadow > 0; if (st.shadow && o.shadow.mapSize.x !== st.shadow) { o.shadow.mapSize.set(st.shadow, st.shadow); if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } } } });
  // more furniture: whole copies of the lounge's armchairs and the plants, along the concourse
  while (S.extras.length < st.extra) {
    const k = S.extras.length, g = new THREE.Group(); R.scene.add(g); S.extras.push(g);
    const at: number[][] = []; for (let i = 0; i < 40; i++) at.push([-7 + (i % 20) * 1.6, 7 + Math.floor(i / 20) * 1.2 + (k % 3) * 0.4, (k + i) * 0.7]);
    Props.placeMany(g, 'armchair-' + (1 + (k % 3)), at, 2, {});
    Props.placeMany(g, 'plant-' + (1 + (k % 3)), at.slice(0, 12).map(p => [p[0] + 0.8, p[1] + 2.5, p[2]]), 2, { seed: k });
  }
  const t = S.hud.querySelector('.gs-st') as HTMLElement; if (t) t.textContent = `Stage ${S.i + 1} of ${GFX_STRESS_STAGES.length}: ${st.name}`;
  const b = S.hud.querySelector('.gs-bar i') as HTMLElement; if (b) b.style.width = Math.round(S.i / GFX_STRESS_STAGES.length * 100) + '%';
}
/** One frame of the test: the camera flies the route, the frame time is noted. */
function gfxStressFrame(dt: number) {
  const R = TestRooms, S = R.stress, T = THREE; if (!S) return;
  S.path += dt * 2.2;
  const P = [[-4.4, -16.5, 0], [-4.4, -12.3, 0], [-2.0, -12.3, 1], [-4.4, -12.3, 0], [-4.4, -2.6, 0], [-1.5, -2.6, 1], [0.8, 0.6, 1], [-1.5, -2.6, 1], [-4.4, -2.6, 0], [-4.5, 8, 0], [24, 12, 0], [33, 12, 1], [38, 8, 1], [33, 12, 1], [24, 12, 0], [-4.5, 8, 0]];
  let d = S.path % 1e9, seg = 0, L = 0; const lens = P.slice(1).map((p, i) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1])), tot = lens.reduce((a, b) => a + b, 0); d = d % tot;
  for (seg = 0; seg < lens.length; seg++) { if (d <= L + lens[seg]) break; L += lens[seg]; }
  const a = P[seg], b = P[seg + 1] || P[0], f = clamp((d - L) / Math.max(0.01, lens[seg] || 1), 0, 1), x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
  const ahead = Math.min(tot, d + 2.5); let s2 = 0, L2 = 0; for (s2 = 0; s2 < lens.length; s2++) { if (ahead <= L2 + lens[s2]) break; L2 += lens[s2]; }
  const a2 = P[s2], b2 = P[s2 + 1] || P[0], f2 = clamp((ahead - L2) / Math.max(0.01, lens[s2] || 1), 0, 1), lx = a2[0] + (b2[0] - a2[0]) * f2, lz = a2[1] + (b2[1] - a2[1]) * f2;
  R.cam.position.set(x, 1.64, z); R.cam.lookAt(new T.Vector3(lx, 1.5, lz));
  // the frame times: the first second of a stage is skipped (shaders and shadow maps being made)
  gfxStressGraph(S, dt);
  S.t += Math.min(dt, 0.25); S.n = (S.n || 0) + 1; if (S.t > 1.2 && S.n > 20) S.frames.push(Math.min(dt * 1000, 250));   // a one-off pause (a shader being made) is not the device's speed
  const bad = S.frames.length >= 12 && S.frames.slice(-12).reduce((p: number, q: number) => p + q, 0) / 12 > 75;   // slower than ~13 frames a second: stop now
  if ((S.t > 4.5 && S.frames.length >= 20) || bad || S.t > 30) {
    const fr = S.frames.slice().sort((p: number, q: number) => p - q), avg = fr.length ? fr.reduce((p: number, q: number) => p + q, 0) / fr.length : 999, p95 = fr.length ? fr[Math.floor(fr.length * 0.95)] : 999;
    const fps = 1000 / avg, cpu = S.cpuN ? S.cpuSum / S.cpuN : 0, gpu = S.gpuN ? S.gpuSum / S.gpuN : 0; S.cpuSum = S.cpuN = S.gpuSum = S.gpuN = 0;
    S.results.push({ stage: S.i, name: GFX_STRESS_STAGES[S.i].name, fps: Math.round(fps), p95: Math.round(p95), cpu: Math.round(cpu), gpu: Math.round(gpu) });
    // close to the limit: stop here, nothing further
    if (bad || fps < 18 || p95 > 90) { gfxStressEnd(false); return; }
    gfxStressNext();
  }
}
function gfxStressEnd(stopped: boolean) {
  const R = TestRooms, S = R.stress; if (!S) return; R.stress = null;
  const res = S.results as any[], hz = Math.max(30, S.hz || 60), pc = !!DESKTOP;
  // smooth enough: on a PC about 50 frames a second; on phones and tablets 30 is how most games run, and fine
  const need = pc ? Math.min(hz, 60) * 0.82 : 28;
  let best = -1; for (const r of res) if (r.fps >= need && r.p95 <= (pc ? 34 : 60)) best = Math.max(best, r.stage);
  let ok = -1; for (const r of res) if (r.fps >= 20) ok = Math.max(ok, r.stage);
  const order = ['low', 'medium', 'high', 'ultra'];
  let pi = best >= 6 ? (pc ? 3 : 2) : best >= 3 ? 2 : best >= 1 ? 1 : 0;
  // never far below what this device is (a few slow moments shouldn't make a capable device Low)
  const spec = GfxAdvice.spec ? order.indexOf(gfxRecommend(GfxAdvice.spec).preset) : 0;
  pi = Math.max(pi, spec - 1, !pc && GfxAdvice.spec && GfxAdvice.spec.ramMb >= 5600 ? 1 : 0);
  const preset = order[pi];
  const rating = best >= 5 ? 'Excellent: it handled even the heaviest stages smoothly' : best >= 3 ? 'Very good: smooth with sharp pictures, shadows and busy rooms' : best >= 2 ? 'Good: smooth with shadows' : best >= 1 ? 'Good: smooth at normal sharpness' : ok >= 1 ? 'Fair: playable, with a few slower moments in the busiest places' : 'Modest: lighter settings keep it smooth';
  if (!stopped && res.length) { const Sx: any = State.settings; Sx.gfxStress = { at: Date.now(), preset, rating, best, results: res }; Store.save(); }
  const rows = res.map(r => `<tr class="${r.stage <= best ? 'ok' : r.stage <= ok ? 'mid' : 'bad'}"><td>${esc(r.name)}</td><td>${r.fps} fps</td><td>${r.p95} ms</td><td>${r.cpu} / ${r.gpu} ms</td></tr>`).join('');
  const s = GfxAdvice.spec as DevSpec;
  try { TestRooms.close(true); } catch (e) { /* closed */ }
  if (stopped && !res.length) return;
  const wrap = openLayer('modal', `<div class="modal-head"><div><h2>Stress test${stopped ? ' (stopped)' : ''}</h2><small>${s ? esc([s.name, s.gpu].filter(Boolean).join(' · ')) : ''}</small></div></div>
    <div class="gs-report"><p><b>${esc(rating)}.</b> It went through ${res.length} of ${GFX_STRESS_STAGES.length} stages${res.length < GFX_STRESS_STAGES.length && !stopped ? ' and stopped close to the limit of this device, as it should' : ''}. Screen: ${hz} Hz.</p>
      <table class="gs-t"><tr><th>Stage</th><th>Average</th><th>Slowest frames</th><th>Processor / graphics</th></tr>${rows}</table>
      <p>Recommended: <b>${GFX_PRESET_LABEL[preset]}</b>.</p></div>
    <div class="modal-actions center"><button class="btn ghost" data-act="close-layer">Keep my settings</button><button class="btn primary" data-gs-apply="${preset}">${icon('check')}Change to recommended settings</button></div>`, { cls: 'narrow gs-layer' });
  const b = wrap && wrap.querySelector('[data-gs-apply]') as HTMLElement;
  if (b) b.addEventListener('click', () => { closeTop(); ACTIONS['gfx-rec-apply'](b, null as any); });
}

/** A timer on the graphics chip, where the device offers one (most PCs; few phones): how long it really took to draw. */
function gfxGpuTimer(ren: any): any {
  try { const gl = ren.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); return ext ? { gl, ext, q: null as any, pend: [] as any[] } : null; } catch (e) { return null; }
}
/** The live graph: frames a second, and how long the processor and the graphics chip take for each frame. The
 *  processor's part is our own work for the frame; the graphics chip's is measured where the device can, otherwise
 *  it is what is left of the frame (marked "about"). */
function gfxStressGraph(S: any, dt: number) {
  const R = TestRooms, frameMs = dt * 1000, cpu = S.lastCpu || 0;
  let gpu = Math.max(0, frameMs - cpu), est = true;
  const G = S.gq;
  if (G) {
    try {
      const gl = G.gl, ext = G.ext;
      // collect a finished query, then start the next around this frame's drawing
      for (let i = G.pend.length - 1; i >= 0; i--) { const q = G.pend[i]; if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) { S.gpuReal = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q); G.pend.splice(i, 1); } }
      if (S.gpuReal != null) { gpu = S.gpuReal; est = false; }
    } catch (e) { S.gq = null; }
  }
  if (S.t > 1.2) { S.cpuSum = (S.cpuSum || 0) + cpu; S.cpuN = (S.cpuN || 0) + 1; S.gpuSum = (S.gpuSum || 0) + gpu; S.gpuN = (S.gpuN || 0) + 1; }
  S.hist.push([frameMs, cpu, gpu]); if (S.hist.length > 140) S.hist.shift();
  if ((S.drawN = (S.drawN || 0) + 1) % 3) return;   // the graph four times a second or so is plenty
  const cv = S.hud.querySelector('canvas') as HTMLCanvasElement; if (!cv) return;
  const x = cv.getContext('2d') as CanvasRenderingContext2D, W = cv.width, H = cv.height, top = 50, yOf = (ms: number) => H - 6 - Math.min(1, ms / top) * (H - 14);
  x.clearRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; x.font = '600 18px Inter, Arial, sans-serif'; x.fillStyle = 'rgba(255,255,255,.4)';
  for (const [ms, lb] of [[16.7, '60'], [33.3, '30']] as [number, string][]) { const y = yOf(ms); x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); x.fillText(lb + ' fps', W - 74, y - 4); }
  const line = (k: number, col: string, w: number) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); S.hist.forEach((h: number[], i: number) => { const px = i / 139 * W, py = yOf(h[k]); if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); };
  line(2, '#F4A742', 2.5); line(1, '#5AA9FF', 2.5); line(0, '#4FD18B', 3.5);
  const last = S.hist.slice(-20), avg = (k: number) => last.reduce((a: number, h: number[]) => a + h[k], 0) / Math.max(1, last.length);
  const set = (c: string, t: string) => { const e = S.hud.querySelector(c) as HTMLElement; if (e) e.textContent = t; };
  set('.gs-fps', String(Math.round(1000 / Math.max(1, avg(0))))); set('.gs-cpu', Math.round(avg(1)) + ' ms'); set('.gs-gpu', (est ? 'about ' : '') + Math.round(avg(2)) + ' ms');
  void R;
}
/** Around the drawing of a stress-test frame: the processor's time, and the graphics chip's timer if there is one. */
function gfxStressDraw(draw: () => void) {
  const R = TestRooms, S = R.stress, t0 = performance.now(); let q: any = null;
  const G = S && S.gq; if (G && G.pend.length < 4) { try { q = G.gl.createQuery(); G.gl.beginQuery(G.ext.TIME_ELAPSED_EXT, q); } catch (e) { q = null; } }
  draw();
  if (q) { try { G.gl.endQuery(G.ext.TIME_ELAPSED_EXT); G.pend.push(q); } catch (e) { /* no timer */ } }
  if (S) S.lastCpu = (S.frameCpu || 0) + (performance.now() - t0);
}
