// Game controllers: the PlayStation 5 DualSense (and DualSense Edge) in full, and other standard controllers.
// Everywhere in the app:
//  - left stick: the pointer (an on-screen cursor); Cross or a press on the touchpad: click (hold to drag: pan a
//    map, move a waypoint); Circle: back (closes what is open, leaves the 3D view, the office, the courtroom);
//    right stick: scroll, or zoom over a map; L2 / R2: zoom out / in; L1 / R1: the previous / next page;
//    d-pad: jumps between buttons; Options: settings; Square and Triangle as below.
//  - in the 3D view: left stick moves (walking in the cabin, the free camera) or circles the camera, right stick
//    looks around, L2 / R2 zoom (in the free camera: down / up), L1 / R1 the previous / next aircraft, Square
//    the next camera, Triangle the 3D view's own menu (the cursor); in the office and the courtroom the sticks
//    walk and look.
//  - the touchpad as a mouse: slide a finger to move the pointer, tap to click, two fingers to scroll. On the
//    PC this needs the controller's touch data, which Windows hands over once you allow it (Settings →
//    Controller → Use the touchpad as a mouse); the touchpad press always clicks. On phones, Android decides
//    what the touchpad does itself.
//  - a short rumble on each click (Settings → Controller).

const Pad: any = { gp: null, prev: [] as boolean[], x: 0, y: 0, shown: false, downEl: null, dragged: false, last: 0, raf: 0, name: '', idleT: 0, wheelT: 0, navT: 0, hid: null, hidOk: false };
const PAD_PID = 9999;   // the controller's own pointer
function padOpt(k: string, d: any): any { const v = (State.settings as any)[k]; return v == null ? d : v; }

function padStart() {
  // a pointer of our own can't be captured like a real one: never let that stop a handler
  for (const fn of ['setPointerCapture', 'releasePointerCapture']) {
    const orig = (Element.prototype as any)[fn];
    (Element.prototype as any)[fn] = function (id: number) { try { return orig.call(this, id); } catch (e) { return undefined; } };
  }
  Pad.x = innerWidth / 2; Pad.y = innerHeight / 2;
  window.addEventListener('gamepadconnected', (e: any) => { Pad.name = padName(e.gamepad); try { toast(`${Pad.name} connected`, 'ok'); } catch (x) { /* not ready */ } padLoop(); });
  window.addEventListener('gamepaddisconnected', () => { padCursor(false); Pad.gp = null; });
  // the mouse or a finger takes over again: the cursor goes away
  for (const ev of ['mousemove', 'touchstart']) window.addEventListener(ev, (e: any) => { if (!e.isTrusted || (e as any)._pad) return; if (Pad.shown && performance.now() - Pad.last > 300) padCursor(false); }, { passive: true } as any);
  padLoop();
  try { PadHid.connect(false); } catch (e) { /* no touchpad access */ }
}
function padName(g: any): string {
  const id = String(g && g.id || '');
  return /0ce6|DualSense Wireless/i.test(id) ? 'DualSense' : /0df2|Edge/i.test(id) ? 'DualSense Edge' : /054c/i.test(id) ? 'PlayStation controller' : /xbox|045e/i.test(id) ? 'Xbox controller' : 'Controller';
}

function padCursor(on: boolean) {
  let c = document.querySelector('.pad-cursor') as HTMLElement;
  if (on && !c) { c = document.createElement('div'); c.className = 'pad-cursor'; c.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z"/></svg>'; document.body.appendChild(c); }
  if (c) { c.style.display = on ? 'block' : 'none'; if (on) c.style.transform = `translate(${Pad.x}px, ${Pad.y}px)`; }
  Pad.shown = on;
}
function padHover(): HTMLElement { return document.elementFromPoint(Pad.x, Pad.y) as HTMLElement; }
function padEvt(type: string, el: Element, buttons: number, extra?: any) {
  if (!el) return;
  const o: any = Object.assign({ bubbles: true, cancelable: true, composed: true, clientX: Pad.x, clientY: Pad.y, screenX: Pad.x, screenY: Pad.y, button: 0, buttons, view: window }, extra || {});
  let e: any;
  if (/^pointer/.test(type) && typeof PointerEvent !== 'undefined') e = new PointerEvent(type, Object.assign({ pointerId: PAD_PID, pointerType: 'mouse', isPrimary: true }, o));
  else if (type === 'wheel') e = new WheelEvent('wheel', o);
  else e = new MouseEvent(type, o);
  e._pad = true; el.dispatchEvent(e);
}
function padRumble(strong: number, weak: number, ms: number) {
  if (!padOpt('padRumble', true)) return;
  const g = Pad.gp, a = g && g.vibrationActuator; try { if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { /* no rumble */ }
}
/** Press (true) and release (false) at the cursor: a click when it didn't move, a drag when it did. */
function padPress(down: boolean) {
  const el = padHover();
  if (down) {
    Pad.downEl = el; Pad.dragged = false; if (!el) return;
    padEvt('pointerdown', el, 1); padEvt('mousedown', el, 1);
    const f = el.closest('input, textarea, select, button, [tabindex]') as HTMLElement; if (f && f.focus) try { f.focus(); } catch (e) { /* not focusable */ }
    padRumble(0, 0.35, 28);
  } else {
    const t = Pad.downEl || el; Pad.downEl = null; if (!t) return;
    padEvt('pointerup', t, 0); padEvt('mouseup', t, 0);
    if (!Pad.dragged && el && (el === t || t.contains(el) || el.contains(t))) {
      // a list to choose from opens no menu here: the next choice instead
      const sel = el.closest('select') as HTMLSelectElement;
      if (sel) { sel.selectedIndex = (sel.selectedIndex + 1) % Math.max(1, sel.options.length); sel.dispatchEvent(new Event('change', { bubbles: true })); }
      else padEvt('click', el, 0);
    }
  }
}
/** Back: whatever is open closes, step by step. */
function padBack() {
  padRumble(0.15, 0.2, 40);
  const layer = document.querySelector('.layer, .modal-back, .sheet-back, .ct-modal:not([hidden])');
  if (layer) { try { closeAll(); } catch (e) { /* none */ } return; }
  try { if (placeBack()) return; } catch (e) { /* none */ }
  if (typeof OpsRoom !== 'undefined' && OpsRoom.on) { try { padRoomBack(OpsRoom, true); } catch (e) { /* none */ } return; }
  if (typeof OfficeRoom !== 'undefined' && OfficeRoom.on) { try { padRoomBack(OfficeRoom, false); } catch (e) { /* none */ } return; }
  if (typeof CourtRoom !== 'undefined' && CourtRoom.on) { try { ctLeaveAsk(); } catch (e) { /* none */ } return; }
  if (typeof V3d !== 'undefined' && V3d.open) { try { ACTIONS['v3d-close'](null as any, null as any); } catch (e) { /* none */ } return; }
  if (State.screen !== 'ops') { const b = document.createElement('b'); b.setAttribute('data-screen', 'ops'); ACTIONS.go(b, null); }
}
/** Circle in your office or Operations: the phone's screen goes down, then the phone, then what is open, then you leave. */
function padRoomBack(R: any, ops: boolean) {
  if (R.overlay && R.overlay.classList.contains('ph-screen')) { phoneClose(R); return; }
  if (R.overlay) { if (ops) opsScreenClose(); else if (R.overlay.querySelector('.lap-os') && typeof ofLaptopClose === 'function') ofLaptopClose(); else ofPlannerClose(); return; }
  if (R.pk && R.pk.st === 'hold') { phonePut(R); return; }
  if (ops) opsLeave(); else ofLeave();
}
/** The d-pad: the cursor jumps to the nearest button that way. */
function padJump(dx: number, dy: number) {
  const els = Array.from(document.querySelectorAll('[data-act], button, a[href], input, select, .rail-btn')) as HTMLElement[];
  let best: HTMLElement = null, bs = 1e9;
  for (const e of els) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, vx = cx - Pad.x, vy = cy - Pad.y;
    const along = vx * dx + vy * dy; if (along < 8) continue;
    const side = Math.abs(vx * dy - vy * dx), sc = along + side * 2.2;
    if (sc < bs && document.elementFromPoint(cx, cy) && (e.contains(document.elementFromPoint(cx, cy)) || document.elementFromPoint(cx, cy) === e)) { bs = sc; best = e; }
  }
  if (best) { const r = best.getBoundingClientRect(); Pad.x = r.left + r.width / 2; Pad.y = r.top + r.height / 2; padCursor(true); padRumble(0, 0.15, 15); }
}
function padScrollAt(dy: number, dx: number) {
  let el = padHover() as HTMLElement;
  // over a map or a 3D view: zoom, like a mouse wheel
  if (el && el.closest('canvas, .maplibregl-canvas, .ml-host')) { const now = performance.now(); if (Math.abs(dy) > 0.35 && now - Pad.wheelT > 110) { Pad.wheelT = now; padEvt('wheel', el, 0, { deltaY: dy * 100, deltaMode: 0 }); } return; }
  while (el && el !== document.body) { const s = getComputedStyle(el); if ((/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2) || (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 2)) break; el = el.parentElement; }
  (el && el !== document.body ? el : document.scrollingElement || document.body).scrollBy(dx, dy);
}
function padGo(d: number) {
  const list = NAV_ORDER, i = list.indexOf(SUB_PAGES[State.screen] || State.screen), k = list[(i + d + list.length) % list.length];
  const b = document.createElement('b'); b.setAttribute('data-screen', k); try { ACTIONS.go(b, null); } catch (e) { /* none */ }
}

function padLoop() {
  if (Pad.raf) return;
  const step = (now: number) => {
    Pad.raf = requestAnimationFrame(step);
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    const g: any = pads.filter((x: any) => x.mapping === 'standard')[0] || pads[0];
    if (!g) { Pad.gp = null; return; }
    Pad.gp = g; if (!Pad.name) Pad.name = padName(g);
    const dt = Pad.t ? Math.min(0.05, (now - Pad.t) / 1000) : 0; Pad.t = now;
    const dz = (v: number) => Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86;
    const ax = (i: number) => dz(+g.axes[i] || 0), bt = (i: number) => !!(g.buttons[i] && g.buttons[i].pressed), bv = (i: number) => g.buttons[i] ? +g.buttons[i].value || 0 : 0;
    const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3) * (padOpt('padInvertY', false) ? -1 : 1), l2 = bv(6), r2 = bv(7);
    const B: boolean[] = []; for (let i = 0; i < 18; i++) B[i] = bt(i);
    const hit = (i: number) => B[i] && !Pad.prev[i], rel = (i: number) => !B[i] && Pad.prev[i];
    const any = lx || ly || rx || ry || l2 > 0.05 || r2 > 0.05 || B.some(Boolean);
    if (typeof Dev !== 'undefined' && Dev.cap && Dev.cap.kind === 'pad') { devPadCapture(B, Pad.prev); Pad.prev = B; return; }   // a button is being chosen in Settings → Devices
    const act = (id: string) => padAct(id, B, Pad.prev);
    if (any) Pad.last = now;
    // the 3D object viewer (gifts, plaques, badges) reads the controller itself; the water salute film closes on Circle
    if (typeof V3V !== 'undefined' && V3V.on) { Pad.prev = B; try { padCursor(false); } catch (e) { /* none */ } return; }
    if (typeof Salute !== 'undefined' && Salute.on) { if (hit(1)) { try { saluteClose(); } catch (e) { /* none */ } } Pad.prev = B; return; }
    if (typeof Museum !== 'undefined' && Museum.on) { try { museumPad(lx, ly, rx, ry, l2, r2, B, hit, dt); } catch (e) { /* none */ } Pad.prev = B; return; }
    const v3 = typeof V3d !== 'undefined' && V3d.open, op = typeof OpsRoom !== 'undefined' && OpsRoom.on && !OpsRoom.overlay, of = (typeof OfficeRoom !== 'undefined' && OfficeRoom.on && !OfficeRoom.overlay) || op, ct = typeof CourtRoom !== 'undefined' && CourtRoom.on;
    const sens = +padOpt('padSpeed', 1) || 1;
    // ---- the world views: the sticks move and look ----
    if (v3) {
      const VV: any = V3d, F = VV.fc;
      if (V3d.mode === 'walk') { CabinWalk.stick = [lx, -ly]; CabinWalk.keys.shift = padActHeld('run', B); }
      else if (V3d.mode === 'free' && F) { try { v3dFreePush(lx * dt * 2.5, (r2 - l2) * dt * 2.5, -ly * dt * 2.5); } catch (e) { /* not ready */ } }
      else if (lx || ly) { V3d.yaw -= lx * dt * 1.8; V3d.pitch = clamp(V3d.pitch - ly * dt * 1.2, -1.2, 1.2); }
      if (V3d.mode === 'free' && F) { F.yaw += rx * dt * 1.9 * sens; F.pitch = clamp(F.pitch - ry * dt * 1.5 * sens, -1.5, 1.4); }
      else if (rx || ry) { V3d.yaw -= rx * dt * 2.0 * sens; V3d.pitch = clamp(V3d.pitch - ry * dt * 1.5 * sens, -1.2, 1.2); }
      if (V3d.mode !== 'free' && (l2 > 0.1 || r2 > 0.1) && now - Pad.wheelT > 90) { Pad.wheelT = now; padEvt('wheel', V3d.cv, 0, { clientX: innerWidth / 2, clientY: innerHeight / 2, deltaY: (l2 - r2) * 120 }); }
      if (act('prev') || act('next')) { const b = document.createElement('b'); b.setAttribute('data-d', act('prev') ? '-1' : '1'); try { ACTIONS['v3d-next'](b, null); } catch (e) { /* none */ } }
      if (act('nextCam')) { const ms = Array.from(V3d.root.querySelectorAll('.v3d-modes [data-m]')) as HTMLElement[], i = ms.findIndex(m => m.getAttribute('data-m') === V3d.mode); if (ms.length) { try { ACTIONS['v3d-mode'](ms[(i + 1) % ms.length], null); } catch (e) { /* none */ } } }
      if (act('pointer')) { padCursor(!Pad.shown); }   // the 3D view's own buttons, with the cursor
      if (act('centre') && /^(walk|free)$/.test(V3d.mode)) { try { v3dUi(); } catch (e) { /* none */ } }   // R3: hide or show the controls
    } else if (of || ct) {
      const R: any = op ? OpsRoom : of ? OfficeRoom : CourtRoom;
      if (R.stick) R.stick = [lx, -ly];
      if (R.look && (rx || ry)) { R.look.yaw = R.look.yaw - rx * dt * 1.6 * sens; R.look.pitch = clamp(R.look.pitch - ry * dt * 1.2 * sens, -1.0, 0.8); }   // all the way round
      if (act('pointer')) padCursor(!Pad.shown);
      // the phone in your hand: Cross brings its screen up (unless you are pointing at something with the cursor)
      if (!ct && R.pk && R.pk.st === 'hold' && !R.overlay && !Pad.shown && hit(0)) { try { phoneOpen(R); } catch (e) { /* none */ } Pad.prev = B; return; }
      // L1 / R1 turn it in your hand, the d-pad up and down tilts it
      if (!ct && R.pk && R.pk.st === 'hold' && !R.overlay) { const ty = (hit(5) ? 1 : 0) - (hit(4) ? 1 : 0), tp = (hit(13) ? 1 : 0) - (hit(12) ? 1 : 0); if (ty || tp) { try { phoneTurn(R, ty, tp); } catch (e) { /* none */ } } }
    }
    // ---- the pointer: the left stick (in the 3D views once shown with Triangle) ----
    const pointerOn = !(v3 || of || ct) || Pad.shown;
    if (pointerOn && (lx || ly)) {
      const m = Math.hypot(lx, ly), sp = (420 + 1100 * m * m) * sens;
      Pad.x = clamp(Pad.x + lx / m * sp * m * dt, 0, innerWidth - 2); Pad.y = clamp(Pad.y + ly / m * sp * m * dt, 0, innerHeight - 2);
      padCursor(true); padMoved();
    }
    if (!(v3 || of || ct)) {
      if (ry || rx) padScrollAt(ry * 900 * dt, rx * 900 * dt);
      if ((l2 > 0.1 || r2 > 0.1) && now - Pad.wheelT > 100) { const el = padHover(); if (el && el.closest('canvas, .maplibregl-canvas')) { Pad.wheelT = now; padEvt('wheel', el, 0, { deltaY: (l2 - r2) * 120 }); } }
      if (act('prev')) padGo(-1); if (act('next')) padGo(1);
      if (now - Pad.navT > 160) { const dx = (B[15] ? 1 : 0) - (B[14] ? 1 : 0), dy = (B[13] ? 1 : 0) - (B[12] ? 1 : 0); if (dx || dy) { Pad.navT = now; if (!(dx && padAdjust(dx))) padJump(dx, dy); } }
    } else if (V3d && V3d.open && V3d.mode === 'walk') {
      const K = CabinWalk.keys; K.arrowup = B[12]; K.arrowdown = B[13]; K.arrowleft = B[14]; K.arrowright = B[15];
    }
    // ---- buttons ----
    const clickBtn = (i: number) => { if (hit(i)) { if (!Pad.shown) { padCursor(true); } padPress(true); } if (rel(i)) padPress(false); };
    const ck = padBind('click');
    if (pointerOn || act('click') || hit(17)) { if (act('click')) { if (!Pad.shown) padCursor(true); padPress(true); } if (padActUp('click', B, Pad.prev)) padPress(false); if (ck.b !== 17) clickBtn(17); }
    if (act('back')) padBack();
    if (act('settings')) { try { if (document.querySelector('.settings-pop')) closeAll(); else ACTIONS.settings(null as any, null); } catch (e) { /* none */ } }
    if (act('centre')) { Pad.x = innerWidth / 2; Pad.y = innerHeight / 2; padCursor(true); }
    Pad.prev = B;
  };
  Pad.raf = requestAnimationFrame(step);
}
/** The cursor moved: hover (and a drag while held). */
function padMoved() {
  const el = padHover();
  if (Pad.downEl) { Pad.dragged = true; padEvt('pointermove', Pad.downEl, 1); padEvt('mousemove', Pad.downEl, 1); }
  else if (el) { padEvt('pointermove', el, 0); padEvt('mousemove', el, 0); }
}

/** The D-pad's left and right on a slider or a list of choices under the pointer: one step down or up. */
function padAdjust(d: number): boolean {
  const el: any = Pad.shown ? padHover() : document.activeElement; if (!el) return false;
  const ctl: any = el.closest ? el.closest('input[type=range], select') : null; if (!ctl || ctl.disabled) return false;
  if (ctl.tagName === 'SELECT') { const n = ctl.options.length, i = clamp(ctl.selectedIndex + d, 0, n - 1); if (i === ctl.selectedIndex) return true; ctl.selectedIndex = i; }
  else { const st = +ctl.step || (+ctl.max - +ctl.min) / 20 || 1, v = clamp(+ctl.value + d * st, +ctl.min, +ctl.max); if (v === +ctl.value) return true; ctl.value = String(v); ctl.dispatchEvent(new Event('input', { bubbles: true })); }
  ctl.dispatchEvent(new Event('change', { bubbles: true })); try { Sound.tick(); } catch (e) { /* quiet */ }
  return true;
}

/* ---------- looking about with the touchpad ---------- */
/** What the touchpad turns right now: the free camera, the 3D view's camera, or a room's view (null: the pointer). */
function padLookTarget(): any {
  if (typeof V3d !== 'undefined' && V3d.open) { const F = (V3d as any).fc; return V3d.mode === 'free' && F ? { kind: 'free', o: F } : { kind: 'v3d' }; }
  if (typeof OpsRoom !== 'undefined' && OpsRoom.on && !OpsRoom.overlay && OpsRoom.look) return { kind: 'room', o: OpsRoom.look };
  if (typeof OfficeRoom !== 'undefined' && OfficeRoom.on && !OfficeRoom.overlay && OfficeRoom.look) return { kind: 'room', o: OfficeRoom.look };
  if (typeof CourtRoom !== 'undefined' && CourtRoom.on && CourtRoom.look) return { kind: 'room', o: CourtRoom.look };
  return null;
}
function padLookTurn(t: any, dx: number, dy: number) {
  if (t.kind === 'free') { t.o.yaw += dx; t.o.pitch = clamp(t.o.pitch - dy, -1.5, 1.4); }
  else if (t.kind === 'v3d') { V3d.yaw -= dx; V3d.pitch = clamp(V3d.pitch - dy, -1.2, 1.2); }
  else { t.o.yaw -= dx; t.o.pitch = clamp(t.o.pitch - dy, -1.1, 0.9); }
}
function padLookZoom(dy: number) {
  if (typeof V3d !== 'undefined' && V3d.open && V3d.cv) padEvt('wheel', V3d.cv, 0, { clientX: innerWidth / 2, clientY: innerHeight / 2, deltaY: dy * 6 });
}

/* ---------- the touchpad as a mouse (PC): the controller's touch data, once allowed ---------- */
const PadHid: any = {
  dev: null, f: null as any, t0: 0, moved: 0, two: false, ok: false,
  ids: [{ vendorId: 0x054c, productId: 0x0ce6 }, { vendorId: 0x054c, productId: 0x0df2 }],
  available(): boolean { return !!(navigator as any).hid; },
  /** Use an allowed controller (ask: show Windows' choice of devices; needs a click). */
  async connect(ask: boolean): Promise<boolean> {
    const hid: any = (navigator as any).hid; if (!hid) return false;
    try {
      let devs: any[] = (await hid.getDevices()).filter((d: any) => this.ids.some((x: any) => x.vendorId === d.vendorId && x.productId === d.productId));
      if (!devs.length && ask) devs = await hid.requestDevice({ filters: this.ids });
      const d = devs[0]; if (!d) return false;
      if (!d.opened) await d.open();
      try { await d.receiveFeatureReport(0x05); } catch (e) { /* asking for this switches a wireless controller to its full reports */ }
      if (this.dev !== d) { d.addEventListener('inputreport', (e: any) => this.report(e)); this.dev = d; }
      this.ok = true; return true;
    } catch (e) { return false; }
  },
  report(e: any) {
    if (padOpt('padTouch', true) === false) return;
    const v: DataView = e.data, base = e.reportId === 0x31 ? 33 : e.reportId === 0x01 && v.byteLength >= 40 ? 32 : -1; if (base < 0) return;
    const fin = (o: number) => { const b0 = v.getUint8(o); return { on: !(b0 & 0x80), x: v.getUint8(o + 1) | ((v.getUint8(o + 2) & 0x0f) << 8), y: (v.getUint8(o + 2) >> 4) | (v.getUint8(o + 3) << 4) }; };
    const a = fin(base), b = fin(base + 4), now = performance.now(), sens = +padOpt('padSpeed', 1) || 1, k = Math.max(innerWidth, 1280) / 1920 * 1.15 * sens;
    if (a.on && !this.f) { this.f = { x: a.x, y: a.y }; this.t0 = now; this.moved = 0; this.two = false; }
    else if (a.on && this.f) {
      const dx = a.x - this.f.x, dy = a.y - this.f.y; this.f = { x: a.x, y: a.y }; this.moved += Math.abs(dx) + Math.abs(dy);
      // in the 3D views and the rooms (while the pointer isn't shown): the touchpad turns the view, two fingers zoom
      const look = padLookTarget();
      if (look && !Pad.shown) {
        if (b.on) { this.two = true; if (dy) padLookZoom(dy); }
        else if (dx || dy) { padLookTurn(look, dx * 0.0042 * sens, dy * 0.0032 * sens); Pad.last = now; }
      }
      else if (b.on) { this.two = true; padScrollAt(dy * 2.2, dx * 2.2); }
      else if (dx || dy) { Pad.x = clamp(Pad.x + dx * k, 0, innerWidth - 2); Pad.y = clamp(Pad.y + dy * k, 0, innerHeight - 2); Pad.last = now; padCursor(true); padMoved(); }
    } else if (!a.on && this.f) {
      // a light tap clicks (a press on the touchpad clicks through the controller's own button)
      if (!this.two && now - this.t0 < 220 && this.moved < 30) { padPress(true); padPress(false); }
      this.f = null;
    }
  },
};
ACTIONS['pad-touch'] = () => { PadHid.connect(true).then((ok: boolean) => { toast(ok ? 'The touchpad works as a mouse' : 'No controller was allowed', ok ? 'ok' : 'warn'); try { rerenderSettingsBody(); } catch (e) { /* not open */ } }); };

/** Settings → Controller. */
function padSettingsHtml(): string {
  const S: any = State.settings, g = Pad.gp, tg = (k: string, d: boolean, l: string, h: string) => { const on = S[k] == null ? d : !!S[k]; return `<label class="tg-row"><span><b>${l}</b><small>${h}</small></span><button class="tg ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="pad-opt" data-key="${k}" data-d="${d ? 1 : 0}"><i></i></button></label>`; };
  const rows: [string, string][] = [['Left stick', 'The pointer · in 3D: move, walk or circle the camera'], ['Right stick', 'Scroll, zoom over a map · in 3D, the office and court: look around'], ['Cross / touchpad press', 'Click (hold to drag)'], ['Circle', 'Back'], ['Square', 'In 3D: the next camera'], ['Triangle', 'In 3D, the office and court: the pointer for their buttons'], ['L1 / R1', 'Previous / next page · in 3D: previous / next aircraft'], ['L2 / R2', 'Zoom out / in · free camera: down / up'], ['D-pad', 'Jump between buttons · left and right change a slider or a list under the pointer · walking: walk'], ['Touchpad', 'Slide: the pointer · in 3D, the offices and court: turn the view; two fingers: zoom (on the PC, once allowed below)'], ['Options', 'Settings'], ['R3', 'The pointer to the middle'], ['L3', 'Walking: faster']];
  return `<div class="set-card col"><div class="sc-h">${icon('play')}<span><b>${g ? esc(padName(g)) + ' connected' : 'No controller connected'}</b><small>${g ? 'Ready.' : 'Connect a PlayStation 5 controller (or another one) by cable or Bluetooth and press a button.'}</small></span></div>
      <div class="pad-map">${rows.map(r => `<div><b>${r[0]}</b><small>${r[1]}</small></div>`).join('')}</div></div>
    <div class="set-card col"><div class="sc-h">${icon('focus')}<span><b>The touchpad as a mouse</b><small>Slide a finger to move the pointer, tap to click, two fingers to scroll. ${DESKTOP ? 'Windows hands the touchpad over once you allow it here (once).' : 'On phones and tablets, Android decides what the touchpad does; a press on it always clicks.'}</small></span></div>
      ${DESKTOP && PadHid.available() ? `<button class="btn ${PadHid.ok ? 'ghost' : 'primary'} sm" data-act="pad-touch">${PadHid.ok ? 'Allowed: choose again' : 'Use the touchpad as a mouse'}</button>` : ''}
      ${tg('padTouch', true, 'Touchpad moves the pointer', 'Off: only the press on it clicks.')}</div>
    <div class="set-card col">${tg('padRumble', true, 'Rumble', 'A light rumble on each click and when going back.')}${tg('padInvertY', false, 'Invert looking up and down', 'The right stick up looks down.')}
      <div class="sc-h" style="margin-top:8px"><span><b class="pad-sp-h">Pointer speed: ${Math.round((+padOpt('padSpeed', 1)) * 100)}%</b></span></div><input type="range" class="pad-sp" min="0.4" max="2" step="0.1" value="${+padOpt('padSpeed', 1)}" aria-label="Pointer speed"></div>`;
}
ACTIONS['pad-opt'] = el => { const S: any = State.settings, k = el.getAttribute('data-key'), d = el.getAttribute('data-d') === '1'; S[k] = !(S[k] == null ? d : !!S[k]); Store.save(); Sound.tick(); try { rerenderSettingsBody(); } catch (e) { /* not open */ } };
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('pad-sp')) return; (State.settings as any).padSpeed = +el.value; const h = document.querySelector('.pad-sp-h'); if (h) h.textContent = `Pointer speed: ${Math.round(+el.value * 100)}%`; });
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (el && el.classList && el.classList.contains('pad-sp')) Store.save(); });
