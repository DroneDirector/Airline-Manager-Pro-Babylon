// Leaving a 3D place (your office, the Operations office, the courtroom, the 3D view): that place's own loading
// screen comes up at once, your airline is saved, the place's 3D graphics are freed (models, textures, people, the
// drawing surface; never any of your data), the app's screens load back, and the loading screen goes away when
// that is done, after at least 6 seconds.

const EXIT_MIN_MS = 6000;
const ExitSplash: any = { on: false };

interface ExitStep { pct: number; step: string; run: () => void; wait?: () => boolean }   // wait: the step lasts until this is true (at most 40 s)

function exitSplash(kind: 'office' | 'ops' | 'court' | 'v3d' | 'hangar' | 'lounge' | 'enter', title: string, steps: ExitStep[], then?: () => void, minMs?: number) {
  const MIN = minMs || EXIT_MIN_MS;
  if (ExitSplash.on && ExitSplash.el) { try { ExitSplash.el.remove(); } catch (e) { /* gone */ } }
  const el = document.createElement('div'); el.className = 'exit-splash exit-' + kind;
  const first = steps.length ? steps[0].step : 'Loading…';
  if (kind === 'v3d') el.innerHTML = v3dLoaderHtml().replace('<b>3D view</b>', `<b>${esc(title)}</b>`).replace('Loading the mountains and the sea…', esc(first));
  else el.innerHTML = ctLoaderHtml(title, first, kind === 'office' ? OF_WINGS : kind === 'enter' ? OF_WINGS.replace('>OFFICE<', '>' + esc(((company() as any) || {}).icao || 'AIRLINE') + '<') : kind === 'ops' ? OPS_EMBLEM : kind === 'hangar' ? HG_EMBLEM : kind === 'lounge' ? LG_EMBLEM : undefined, kind === 'ops' || kind === 'enter' ? OPS_SCENE : kind === 'hangar' ? HG_SCENE : undefined);
  document.body.appendChild(el); ExitSplash.on = true; ExitSplash.el = el;
  // first of all, everything you did there is saved (only the graphics are cleared, never your data)
  steps = [{ pct: 10, step: 'Saving your changes…', run: () => { try { Store.save(); Store.flushNative(); } catch (e) { /* saved with the next change */ } } } as ExitStep].concat(steps);
  const t0 = performance.now(); let target = 2, shown = 0, done = false, i = 0, lastT = 0;
  const set = (p: number, s?: string) => {
    const pct = Math.round(Math.max(0, Math.min(100, p)));
    const q = (a: string) => el.querySelector(a) as HTMLElement;
    const P = q('.ctl-pct') || q('.spl-pct'), F = q('.ctl-fill') || q('.spl-fill'), T = q('.ctl-tip') || q('.spl-tip'), S = q('.ctl-step') || q('.spl-step');
    if (P) P.textContent = pct + '%'; if (F) F.style.width = pct + '%'; if (T) T.style.left = pct + '%'; if (s && S) S.textContent = s;
  };
  // one step at a time, each after the screen has had a frame to show the step's name
  const runNext = () => {
    if (i >= steps.length) { done = true; return; }
    const s = steps[i++]; set(shown, s.step);
    setTimeout(() => {
      try { s.run(); } catch (e) { /* carry on */ }
      const w0 = performance.now(), on = () => { let ok = true; try { ok = !s.wait || s.wait(); } catch (e) { ok = true; }
        if (ok || performance.now() - w0 > 40000) { target = s.pct; setTimeout(runNext, 160); } else setTimeout(on, 120); };
      on();
    }, 60);
  };
  // what is shown moves towards the step reached, never faster than the 6 seconds
  const tick = () => {
    const nowT = performance.now(), age = nowT - t0, cap = Math.min(100, age / MIN * 100), goal = done ? cap : Math.min(target, cap);
    const dt = Math.min(0.25, (nowT - (lastT || nowT)) / 1000); lastT = nowT;
    shown = Math.min(goal, shown + Math.max(0, goal - shown) * Math.min(1, dt * 6) + dt * 4); set(shown);
    if (done && age >= MIN && shown >= 99.5) {
      set(100, 'Ready'); el.classList.add('out'); ExitSplash.on = false;
      setTimeout(() => { el.remove(); if (ExitSplash.el === el) ExitSplash.el = null; }, 800);
      try { if (then) then(); } catch (e) { /* shown anyway */ }
      return;
    }
    requestAnimationFrame(tick);
  };
  runNext(); requestAnimationFrame(tick);
}

/** What a place leaves behind in memory, once it is closed: three.js's file cache, and a nudge to the browser. */
function exitFreeMemory() {
  try { if (THREE && THREE.Cache) THREE.Cache.clear(); } catch (e) { /* none */ }
  try { const g: any = (window as any).gc; if (typeof g === 'function') g(); } catch (e) { /* not offered */ }
}
/** Free a renderer completely: its programs, its targets and the drawing surface itself. */
function exitFreeRenderer(ren: any, scene?: any) {
  try {
    if (scene) scene.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) v.dispose(); } m.dispose(); });
      if (o.dispose && o.isInstancedMesh) o.dispose();
    });
    if (scene && scene.environment && scene.environment.dispose) scene.environment.dispose();
  } catch (e) { /* gone */ }
  try { if (ren) { ren.renderLists && ren.renderLists.dispose(); ren.dispose(); ren.forceContextLoss && ren.forceContextLoss(); } } catch (e) { /* gone */ }
}

/** Back (the Android back button, the gamepad's Circle, Esc) while a 3D place is open: true if it was handled. */
function placeBack(): boolean {
  if (ExitSplash.on) return true;   // on the way out already
  if (typeof OpsRoom !== 'undefined' && OpsRoom.on) { if (OpsRoom.overlay) opsScreenClose(); else opsLeave(); return true; }
  if (typeof OfficeRoom !== 'undefined' && OfficeRoom.on) { if (OfficeRoom.overlay) ofPlannerClose(); else ofLeave(); return true; }
  if (typeof CourtRoom !== 'undefined' && CourtRoom.on) { ctLeaveAsk(); return true; }
  if (typeof V3d !== 'undefined' && V3d.open) { ACTIONS['v3d-close'](null as any, null as any); return true; }
  return false;
}
