/* Settings from inside any 3D place: the 3D view, the joined building and its rooms, the hangars, the lounges, the
 * courtroom. A gear marked Settings sits in the top-left corner (below the place's name); it can be tucked away to a
 * small tab at the edge and pulled out again (remembered). Settings opens over the scene, which stays as it is:
 * closing Settings puts you straight back where you were. */

/** Is a 3D place open right now? */
function sceneOpen(): boolean {
  try {
    if (typeof V3d !== 'undefined' && V3d.open) return true;
    for (const R of [typeof TestRooms !== 'undefined' ? TestRooms : null, typeof OfficeRoom !== 'undefined' ? OfficeRoom : null, typeof OpsRoom !== 'undefined' ? OpsRoom : null,
      typeof LoungeRoom !== 'undefined' ? LoungeRoom : null, typeof HangarRoom !== 'undefined' ? HangarRoom : null, typeof CourtRoom !== 'undefined' ? CourtRoom : null]) if (R && R.on) return true;
  } catch (e) { /* none */ }
  return false;
}
function sceneGearTucked(): boolean { return (State.settings as any).sceneGearTucked === true; }
/** Keeps the gear there while a 3D place is open, and away when none is. */
function sceneGearSync() {
  let el = document.querySelector('.scn-gear') as HTMLElement;
  // the 3D view has its gear in its own bar at the top (before Behind); the other places get this one
  const on = sceneOpen() && !(typeof V3d !== 'undefined' && V3d.open && V3d.root && !V3d.root.classList.contains('v3d-aptonly')) && !(typeof ExitSplash !== 'undefined' && ExitSplash.on);
  const pads = sceneOpen() && !(typeof ExitSplash !== 'undefined' && ExitSplash.on);
  if (!on && el) el.remove();
  if (!pads) { const h0 = document.querySelector('body > .pad-hints'); if (h0) h0.remove(); document.body.classList.remove('scn-set-on'); return; }
  if (!el && on) {
    el = document.createElement('div'); el.className = 'scn-gear';
    el.innerHTML = `<button class="scn-gear-btn" data-act="scene-settings" aria-label="Settings">${icon('gear')}<span>Settings</span></button><button class="scn-gear-tuck" data-act="scene-gear-tuck" aria-label="Tuck the settings button away">${icon('chevron')}</button><button class="scn-gear-tab" data-act="scene-gear-tuck" aria-label="Show the settings button">${icon('gear')}</button>`;
    document.body.appendChild(el);
  }
  if (el && on) el.classList.toggle('tucked', sceneGearTucked());
  // the controller's buttons for this place, only while a controller is connected (they follow Settings → Devices)
  const v3 = typeof V3d !== 'undefined' && V3d.open;
  const want = typeof Pad !== 'undefined' && Pad.gp ? padHintsHtml(v3 ? [['nextCam', 'Camera'], ['prev', 'Previous aircraft'], ['next', 'Next aircraft'], ['pointer', 'Pointer'], ['back', 'Back'], ['settings', 'Settings']]
    : [['pointer', 'Pointer'], ['click', 'Use'], ['run', 'Faster'], ['back', 'Back'], ['settings', 'Settings']]) : '';
  let h = document.querySelector('body > .pad-hints') as HTMLElement;
  if (!want) { if (h) h.remove(); }
  else { const tmp = document.createElement('div'); tmp.innerHTML = want; const n = tmp.firstElementChild as HTMLElement; if (!h) document.body.appendChild(n); else if (h.innerHTML !== n.innerHTML) h.innerHTML = n.innerHTML; }
  if (!document.querySelector('.settings-pop')) document.body.classList.remove('scn-set-on');
}
ACTIONS['scene-gear-tuck'] = () => { const S: any = State.settings; S.sceneGearTucked = !sceneGearTucked(); Store.soon(); Sound.tick(); sceneGearSync(); };
ACTIONS['scene-settings'] = () => {
  try { aimUnlock(); } catch (e) { /* no mouse taken */ }
  document.body.classList.add('scn-set-on');   // Settings above the scene; the scene stays as it is underneath
  Sound.tick(); openLayer('modal', settingsHtml(), { cls: 'full settings-pop' });
};
setInterval(sceneGearSync, 600);
// While Settings is open over a 3D place, Esc closes Settings (not the place behind it), and the place doesn't walk
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!document.body.classList.contains('scn-set-on') || !document.querySelector('.settings-pop')) return;
  const t = e.target as HTMLElement;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeTop(); setTimeout(sceneGearSync, 50); return; }
  if (t && t.closest && t.closest('input, textarea, select')) return;
  e.stopImmediatePropagation();
}, true);

/* ---------- the performance monitor: a narrow panel of text in the 3D places, dragged where you like ---------- */
// Frames a second on the screen (real and made by frame generation), the processor's time per frame, the graphics
// chip's time per real frame (where the browser can measure it), the cores (their speed on Android, how busy each is
// on the PC), and a quick switch for frame generation that Settings follows (and the other way round).
const FgMon: any = { cores: null as any, coresAt: 0, el: null as HTMLElement };
function fgMonOn(): boolean { return (State.settings as any).fgMon !== false; }
function fgMonCores() {
  const now = Date.now(); if (now - FgMon.coresAt < 2000) return; FgMon.coresAt = now;
  try {
    if (DESKTOP) { fetch('/api/cpu').then(r => r.json()).then(r => { FgMon.cores = { use: r.use || [], ghz: r.ghz || 0 }; }).catch(() => { /* none */ }); return; }
    const t = (typeof appTools === 'function') ? appTools() : null;
    if (t && t.cpuInfo) t.cpuInfo().then((r: any) => { FgMon.cores = { mhz: r.mhz || [], max: r.max || [] }; }).catch(() => { /* none */ });
  } catch (e) { /* none */ }
}
function fgMonText(): string {
  const S = FgStat, on = FrameGen.on(), n = navigator.hardwareConcurrency || 0, C = FgMon.cores;
  const cores = C && C.use && C.use.length ? C.use.map((u: number) => Math.round(u)).join(' ') + ' %' : C && C.mhz && C.mhz.length ? C.mhz.map((m: number) => (m / 1000).toFixed(1)).join(' ') + ' GHz' : '';
  return `<b>${S.fps || 0} fps</b> <span>${on ? `${S.realFps || 0} real + ${S.madeFps || 0} made` : 'all real'}</span>
    <i>CPU ${(S.cpu || 0).toFixed(1)} ms · GPU ${S.gpu ? S.gpu.toFixed(1) + ' ms' : '—'}</i>
    <i>${n || '?'} cores${cores ? ': ' + cores : ''}</i>`;
}
function fgMonSync(force?: boolean) {
  const want = fgMonOn() && sceneOpen() && !(typeof ExitSplash !== 'undefined' && ExitSplash.on);
  let el = document.querySelector('.fg-mon') as HTMLElement;
  if (!want) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div'); el.className = 'fg-mon';
    const P = (State.settings as any).fgMonPos; if (P) { el.style.left = P[0] + 'px'; el.style.top = P[1] + 'px'; el.style.right = 'auto'; }
    el.innerHTML = `<div class="fgm-txt"></div><button class="fgm-fg" data-act="fg-quick"></button>`;
    document.body.appendChild(el); fgMonDrag(el);
  }
  fgMonCores();
  const tx = el.querySelector('.fgm-txt') as HTMLElement, h = fgMonText(); if (tx.innerHTML !== h) tx.innerHTML = h;
  const b = el.querySelector('.fgm-fg') as HTMLElement, m = FrameGen.mode(), lab = `Frame gen: ${m === 'on' ? 'ON' : m === 'auto' ? 'AUTO' : 'OFF'}`;
  if (b.textContent !== lab || force) { b.textContent = lab; b.classList.toggle('on', FrameGen.on()); }
}
/** Drag the monitor anywhere by any part of it but its switch (kept where you leave it). */
function fgMonDrag(el: HTMLElement) {
  let d: any = null;
  el.addEventListener('pointerdown', e => { if ((e.target as HTMLElement).closest('.fgm-fg')) return; const r = el.getBoundingClientRect(); d = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId }; el.setPointerCapture(e.pointerId); e.stopPropagation(); });
  el.addEventListener('pointermove', e => { if (!d || e.pointerId !== d.id) return; const x = clamp(e.clientX - d.dx, 0, innerWidth - el.offsetWidth), y = clamp(e.clientY - d.dy, 0, innerHeight - el.offsetHeight); el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.right = 'auto'; e.stopPropagation(); });
  const up = (e: PointerEvent) => { if (!d) return; d = null; (State.settings as any).fgMonPos = [parseInt(el.style.left) || 0, parseInt(el.style.top) || 0]; Store.soon(); e.stopPropagation(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
ACTIONS['fg-quick'] = () => {
  const S: any = State.settings; S.frameGen = FrameGen.mode() === 'off' ? 'on' : 'off'; Store.save(); Sound.tick(); fgMonSync(true);
  toast(S.frameGen === 'on' ? 'Frame generation on' : 'Frame generation off', 'info');
  try { if (document.querySelector('.settings-pop')) rerenderSettingsBody(); } catch (e) { /* not open */ }   // Settings shows the same
};
setInterval(() => fgMonSync(), 500);
