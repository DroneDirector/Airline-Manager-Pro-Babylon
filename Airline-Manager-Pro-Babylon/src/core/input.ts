// Every way to move and look, from day one:
//  - Keyboard and mouse (PC): W A S D or the arrows to walk, Shift to run; click the view to look with the mouse
//    (Esc lets the mouse go).
//  - Touchscreen: a stick appears under your left thumb wherever you put it down on the left of the screen; drag
//    anywhere on the right to look round.
//  - Game controllers (PlayStation DualShock 4 and DualSense, and any standard one): left stick walks, right stick
//    looks, L3 runs, Cross uses, Circle goes back, Options opens the settings; the D-pad and Cross work the menus.
// The look speeds, dead zone, inverting and swapping the sticks and vibration are in Settings → Controls.
import { S } from './settings';
import { IS_TOUCH } from './app';

export type Btn = 'confirm' | 'back' | 'menu' | 'up' | 'down' | 'left' | 'right';
const btnSubs: ((b: Btn) => void)[] = [];
export function onButton(f: (b: Btn) => void) { btnSubs.push(f); }
const padSubs: ((name: string) => void)[] = [];
/** A controller connected (its name) or disconnected (''). */
export function onPad(f: (name: string) => void) { padSubs.push(f); }
function fire(b: Btn) { for (const f of btnSubs) { try { f(b); } catch (e) { console.error(e); } } }

const keys: { [k: string]: boolean } = {};
let lookX = 0, lookY = 0, play = false, canvasEl: HTMLCanvasElement | null = null;
let stick: { id: number; x0: number; y0: number; x: number; y: number; el: HTMLElement; knob: HTMLElement } | null = null;
let look: { id: number; x: number; y: number } | null = null;
let padName = '', padIndex = -1;
const prevBtn: boolean[] = [];
let navRepeat = 0, navDir = '';

/** Is a controller connected (its name), for the settings page. */
export function padConnected(): string { return padName; }
/** Walking and looking are on (in a 3D place, with no menu open). */
export function setPlay(on: boolean) { play = on; if (!on) { stick && stick.el.remove(); stick = null; look = null; if (document.pointerLockElement) document.exitPointerLock(); } const z = document.querySelector('.tz') as HTMLElement; if (z) z.hidden = !on || !IS_TOUCH; }
export function isPlay(): boolean { return play; }

export function inputInit(canvas: HTMLCanvasElement, ui: HTMLElement) {
  canvasEl = canvas;
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (e.key === 'Escape' && !document.pointerLockElement) fire('menu');
    if (!play) { if (e.key === 'ArrowUp') fire('up'); else if (e.key === 'ArrowDown') fire('down'); else if (e.key === 'ArrowLeft') fire('left'); else if (e.key === 'ArrowRight') fire('right'); else if (e.key === 'Enter') fire('confirm'); }
    if (play && (k === 'e' || k === 'enter')) fire('confirm');
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // the mouse: click to look (pointer lock); on a PC without the lock, dragging looks too
  canvas.addEventListener('click', () => { if (play && !IS_TOUCH && !document.pointerLockElement) { try { (canvas as any).requestPointerLock(); } catch (e) { /* drag instead */ } } });
  document.addEventListener('mousemove', e => { if (!play) return; if (document.pointerLockElement === canvas) { lookX += e.movementX * 0.0022 * S.ctl.mouseLook; lookY += e.movementY * 0.0022 * S.ctl.mouseLook * (S.ctl.mouseInvert ? -1 : 1); } });
  // touch: the stick on the left, looking on the right
  const tz = document.createElement('div'); tz.className = 'tz'; tz.hidden = true; ui.appendChild(tz);
  tz.addEventListener('touchstart', e => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX < window.innerWidth * 0.42 && !stick) {
        const el = document.createElement('div'); el.className = 'tz-stick'; const knob = document.createElement('i'); el.appendChild(knob); tz.appendChild(el);
        const r = 56 * S.ctl.touchStick; el.style.width = el.style.height = r * 2 + 'px'; el.style.left = t.clientX - r + 'px'; el.style.top = t.clientY - r + 'px';
        stick = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, el, knob };
      } else if (!look) look = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
    e.preventDefault();
  }, { passive: false });
  tz.addEventListener('touchmove', e => {
    for (const t of Array.from(e.changedTouches)) {
      if (stick && t.identifier === stick.id) { stick.x = t.clientX; stick.y = t.clientY; const r = 56 * S.ctl.touchStick, dx = stick.x - stick.x0, dy = stick.y - stick.y0, d = Math.hypot(dx, dy), k = d > r ? r / d : 1; stick.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`; }
      else if (look && t.identifier === look.id) { lookX += (t.clientX - look.x) * 0.006 * S.ctl.touchLook; lookY += (t.clientY - look.y) * 0.006 * S.ctl.touchLook; look.x = t.clientX; look.y = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) { if (stick && t.identifier === stick.id) { stick.el.remove(); stick = null; } if (look && t.identifier === look.id) look = null; } };
  tz.addEventListener('touchend', end); tz.addEventListener('touchcancel', end);
  window.addEventListener('gamepadconnected', (e: any) => { padIndex = e.gamepad.index; padName = padLabel(e.gamepad.id); for (const f of padSubs) f(padName); });
  window.addEventListener('gamepaddisconnected', (e: any) => { if (e.gamepad.index === padIndex) { padIndex = -1; padName = ''; for (const f of padSubs) f(''); } });
  const loop = () => { requestAnimationFrame(loop); pollPad(); };
  requestAnimationFrame(loop);
}
function padLabel(id: string): string {
  if (/DualSense|0ce6|0df2/i.test(id)) return 'PlayStation DualSense';
  if (/054c|Wireless Controller|DualShock|PLAYSTATION/i.test(id)) return 'PlayStation DualShock 4';
  if (/xbox|045e|xinput/i.test(id)) return 'Xbox controller';
  return id.replace(/\(.*?\)/g, '').trim() || 'Game controller';
}
function pad(): Gamepad | null {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  if (padIndex >= 0 && list[padIndex]) return list[padIndex];
  for (const g of Array.from(list)) if (g && g.connected) { padIndex = g.index; padName = padLabel(g.id); return g; }
  return null;
}
/** The controller's buttons each frame: presses become actions (menus, use, back, settings). */
function pollPad() {
  const g = pad(); if (!g) return;
  const b = (i: number) => !!(g.buttons[i] && g.buttons[i].pressed);
  const edge = (i: number, a: Btn) => { const now = b(i); if (now && !prevBtn[i]) fire(a); prevBtn[i] = now; };
  edge(0, 'confirm'); edge(1, 'back'); edge(9, 'menu');
  if (!play) {
    // the D-pad, or the left stick held, moves through a menu (repeating while held)
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    const dir = b(12) || ay < -0.6 ? 'up' : b(13) || ay > 0.6 ? 'down' : b(14) || ax < -0.6 ? 'left' : b(15) || ax > 0.6 ? 'right' : '';
    const now = performance.now();
    if (dir && (dir !== navDir || now > navRepeat)) { fire(dir as Btn); navRepeat = now + (dir !== navDir ? 380 : 140); }
    navDir = dir;
  } else navDir = '';
}
const dz = (v: number) => { const d = S.ctl.padDead; return Math.abs(v) < d ? 0 : Math.sign(v) * (Math.abs(v) - d) / (1 - d); };
/** This frame's walking (x right, y forward, each −1…1), looking (radians to turn) and running. */
export function inputFrame(dt: number): { mx: number; my: number; lx: number; ly: number; run: boolean } {
  let mx = 0, my = 0, run = false, lx = lookX, ly = lookY; lookX = 0; lookY = 0;
  if (!play) return { mx: 0, my: 0, lx: 0, ly: 0, run: false };
  if (keys.w || keys.arrowup) my += 1; if (keys.s || keys.arrowdown) my -= 1; if (keys.d || keys.arrowright) mx += 1; if (keys.a || keys.arrowleft) mx -= 1;
  if (keys.shift) run = true;
  if (stick) { const r = 56 * S.ctl.touchStick, dx = (stick.x - stick.x0) / r, dy = (stick.y - stick.y0) / r; mx += Math.max(-1, Math.min(1, dx)); my -= Math.max(-1, Math.min(1, dy)); if (Math.hypot(dx, dy) > 1.15) run = true; }
  const g = pad();
  if (g) {
    const [a, b2, c, d] = S.ctl.padSwap ? [2, 3, 0, 1] : [0, 1, 2, 3];
    mx += dz(g.axes[a] || 0); my -= dz(g.axes[b2] || 0);
    const k = 2.6 * S.ctl.padLook * dt; lx += dz(g.axes[c] || 0) * k; ly += dz(g.axes[d] || 0) * k * (S.ctl.padInvert ? -1 : 1);
    if (g.buttons[10] && g.buttons[10].pressed) run = true;
  }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  return { mx, my, lx, ly, run };
}
/** A short rumble on the controller (when it can, and vibration is on). */
export function vibrate(ms = 160, strong = 0.6, weak = 0.4) {
  if (!S.ctl.padVibrate) return; const g: any = pad(); if (!g) return;
  try { if (g.vibrationActuator && g.vibrationActuator.playEffect) g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { /* no rumble */ }
}
export { canvasEl };
