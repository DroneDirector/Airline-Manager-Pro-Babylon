// Exit: a hold-to-exit power button, so the app never closes by an accidental tap,
// and the Android back gesture never quits the app on its own.

let _holdRaf = 0, _holdT0 = 0, _lastTick = 0;
const HOLD_MS = 1300;

function exitHtml(): string {
  const r = 56, c = (2 * Math.PI * r).toFixed(1);
  return `
  <div class="exit">
    <div class="exit-sky" aria-hidden="true"><i></i><i></i><i></i></div>
    <h2>Leave ${esc(APP.name)}?</h2>
    <p class="muted">Hold the power button to close. Your airline keeps running while you're away.</p>
    <button class="exit-hold" data-hold aria-label="Hold to exit">
      <svg viewBox="0 0 124 124" aria-hidden="true">
        <circle cx="62" cy="62" r="${r}" class="eh-track"/>
        <circle cx="62" cy="62" r="${r}" class="eh-fill" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-c="${c}"/>
      </svg>
      <span class="eh-core">${icon('power')}</span>
    </button>
    <small class="eh-hint" data-hint>Press and hold</small>
    <div class="modal-actions center"><button class="btn ghost" data-act="close-layer">Stay</button></div>
  </div>`;
}

ACTIONS.exit = () => {
  if ($('.layer.exit-pop')) return;
  Sound.tick();
  const wrap = openLayer('modal', exitHtml(), { cls: 'narrow exit-pop', onClose: () => cancelHold() });
  const btn = $('[data-hold]', wrap);
  const start = (e: Event) => { e.preventDefault(); beginHold(wrap); };
  btn.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, () => cancelHold()));
  btn.addEventListener('keydown', (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) start(e); });
  btn.addEventListener('keyup', () => cancelHold());
  btn.addEventListener('contextmenu', e => e.preventDefault());
};

function beginHold(wrap: HTMLElement) {
  cancelHold();
  const fill = $('.eh-fill', wrap), hold = $('[data-hold]', wrap), hint = $('[data-hint]', wrap);
  const C = parseFloat(fill.getAttribute('data-c'));
  hold.classList.add('holding'); hint.textContent = 'Keep holding…';
  _holdT0 = performance.now(); _lastTick = 0;
  const step = (now: number) => {
    const k = clamp((now - _holdT0) / HOLD_MS, 0, 1);
    fill.setAttribute('stroke-dashoffset', (C * (1 - k)).toFixed(1));
    const tick = Math.floor(k * 5);
    if (tick > _lastTick) { _lastTick = tick; Haptics.pulse(6); }
    if (k >= 1) { _holdRaf = 0; farewell(); return; }
    _holdRaf = requestAnimationFrame(step);
  };
  _holdRaf = requestAnimationFrame(step);
}

function cancelHold() {
  if (_holdRaf) cancelAnimationFrame(_holdRaf);
  _holdRaf = 0;
  const wrap = $('.exit-pop'); if (!wrap || wrap.classList.contains('leaving')) return;
  const fill = $('.eh-fill', wrap), hold = $('[data-hold]', wrap), hint = $('[data-hint]', wrap);
  if (fill) { fill.classList.add('rewind'); fill.setAttribute('stroke-dashoffset', fill.getAttribute('data-c')); setTimeout(() => fill.classList.remove('rewind'), 320); }
  if (hold) hold.classList.remove('holding');
  if (hint) hint.textContent = 'Press and hold';
}

function farewell() {
  const wrap = $('.exit-pop'); if (wrap) wrap.classList.add('leaving');
  Haptics.success(); Sound.chime();
  const f = document.createElement('div');
  f.className = 'farewell';
  f.innerHTML = `<div class="fw-plane">${icon('fleet')}</div><b>See you on the next flight</b><small>${esc(APP.name)} v${esc(APP.version)}</small>`;
  document.body.appendChild(f);
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => {
    const app = (window as any).Capacitor && (window as any).Capacitor.Plugins && (window as any).Capacitor.Plugins.App;
    // quitting: the next time the app is opened it starts afresh (the start-up screen, then the start screen), not
    // back where you were; the airline itself keeps running on the real clock, and its notifications still come
    quitMark();
    try { Store.save(); (Store as any).flushNative && (Store as any).flushNative(); } catch (e) { /* saved as it goes */ }
    try { aiScheduleNotifications(); } catch (e) { /* none to schedule */ }
    if (app && app.exitApp) { app.exitApp(); return; }
    if (DESKTOP) { quitUnseen(f); return; }
    // In a browser preview there is nothing to close: bring the app back.
    window.close();
    setTimeout(() => { f.classList.remove('on'); setTimeout(() => f.remove(), 500); closeAll(); }, 1200);
  }, reducedMotion() ? 300 : 1500);
}

/** Remember that the app was quit (not just put away): the next start skips "back where you were". */
function quitMark() {
  (window as any).__quitting = true;
  try { localStorage.removeItem('amp-resume'); localStorage.removeItem('amp-ui'); localStorage.setItem('amp-quit', String(Date.now())); } catch (e) { /* ignore */ }
}
/** On the PC: the window goes away and the app keeps running unseen (the airline carries on, notifications still
 *  show); opening the app again starts it afresh. Everything open is closed and every sound stops. */
function quitUnseen(f: HTMLElement) {
  (window as any).__unseen = true;
  try { Voice.stop(); } catch (e) { /* none */ }
  for (const R of [OfficeRoom, OpsRoom, CourtRoom, HangarRoom, LoungeRoom] as any[]) { try { if (R && R.on) R.close(true); } catch (e) { /* closed */ } }
  try { if (typeof v3dClose === 'function') v3dClose(); } catch (e) { /* closed */ }
  try { TitleScreen.audio && TitleScreen.audio.pause(); } catch (e) { /* none */ }
  try { soundSuspend(); } catch (e) { /* none */ }
  fetch('/api/hide', { method: 'POST' }).catch(() => { window.close(); });
  setTimeout(() => { f.remove(); closeAll(); try { go('ops', true); } catch (e) { /* ignore */ } }, 600);
}

// Android back button / back gesture: close what's open, step back, and only offer exit at the top.
function handleBack() {
  if (typeof placeBack === 'function' && placeBack()) return;   // an office, the courtroom or the 3D view
  if (_layers.length) { closeTop(); return; }
  if (State.screen !== 'ops') { go(SUB_PAGES[State.screen] || 'ops'); return; }
  ACTIONS.exit(null, null);
}
function bindBack() {
  const app = (window as any).Capacitor && (window as any).Capacitor.Plugins && (window as any).Capacitor.Plugins.App;
  if (app && app.addListener) app.addListener('backButton', () => handleBack());
}
