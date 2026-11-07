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
import { toast } from '../ui/icons';

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
/** True while the middle button has freed the mouse pointer (no looking round until it is pressed again). */
export let cursorMode = false;
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
  canvas.addEventListener('click', () => { if (play && !IS_TOUCH && !cursorMode && !document.pointerLockElement) { try { (canvas as any).requestPointerLock(); } catch (e) { /* drag instead */ } } });
  // the middle button (pressing the wheel down): between looking round and a free mouse pointer to click on things
  document.addEventListener('mousedown', e => { if (e.button !== 1 || !play || IS_TOUCH) return; e.preventDefault();
    if (!cursorMode) { cursorMode = true; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (err) { /* no lock */ } toast('Mouse pointer: click on things · press the wheel again to look round'); }
    else { cursorMode = false; lockNow(true); } });
  // taking the mouse back for looking round: the browser may refuse it on the press, so it is asked again on the
  // release; if it still says no, one click in the game takes it (and a note says so)
  const lockNow = (say: boolean) => { const ok = () => { if (say) toast('Looking round with the mouse'); };
    try { const r: any = (canvas as any).requestPointerLock(); if (r && r.then) r.then(ok, () => { /* asked again on the release */ }); else ok(); } catch (err) { /* asked again on the release */ } };
  document.addEventListener('mouseup', e => { if (e.button !== 1 || !play || IS_TOUCH || cursorMode || document.pointerLockElement) return; e.preventDefault(); lockNow(true);
    setTimeout(() => { if (play && !cursorMode && !document.pointerLockElement) toast('Click once in the game to look round with the mouse'); }, 400); });
  document.addEventListener('auxclick', e => { if (e.button === 1 && play) e.preventDefault(); });
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
  window.addEventListener('gamepadconnected', () => { pad(); });
  window.addEventListener('gamepaddisconnected', (e: any) => { if (e.gamepad.index === padIndex) { padIndex = -1; padName = ''; for (const f of padSubs) f(''); pad(); } });
  const loop = () => { requestAnimationFrame(loop); pollPad(); };
  requestAnimationFrame(loop);
}
function padLabel(id: string): string {
  if (/DualSense|0ce6|0df2/i.test(id)) return 'PlayStation DualSense';
  if (/054c|Wireless Controller|DualShock|PLAYSTATION/i.test(id)) return 'PlayStation DualShock 4';
  if (/xbox|045e|xinput/i.test(id)) return 'Xbox controller';
  return id.replace(/\(.*?\)/g, '').trim() || 'Game controller';
}
/** Flight gear (sticks, throttles, rudder pedals, yokes, panels): never used for walking or the menus, kept free
 *  for flying. Recognised by name, when the device doesn't report itself as a standard gamepad. */
const FLIGHT = /stick|throttle|hotas|rudder|pedal|yoke|x-?5[26]|x-?4[05]|t\.?16000|t\.?flight|thrustmaster|extreme 3d|saitek|pro flight|vkb|virpil|winwing|honeycomb|alpha flight|bravo|warthog|gladiator|crosswind|cougar|sidewinder|fighterstick|flight|joystick|wheel|panel/i;
export const isFlightGear = (g: Gamepad) => g.mapping !== 'standard' && FLIGHT.test(g.id);
/** The controller for walking and the menus: the one chosen in Settings → Controls if it is connected, else a standard
 *  gamepad, else a PlayStation one in its raw layout, else anything that isn't flight gear. */
export function choosePad(list: (Gamepad | null)[]): Gamepad | null {
  const all = list.filter((g): g is Gamepad => !!g && g.connected), want = (S.ctl as any).pad as string;
  if (want) { const g = all.find(x => x.id === want); if (g) return g; }
  return all.find(g => g.mapping === 'standard' && !isFlightGear(g)) || all.find(g => PS_RAW.test(g.id) && !isFlightGear(g)) || all.find(g => !isFlightGear(g)) || null;
}
/** The controllers connected now, for the choice in Settings → Controls. */
export function padList(): { id: string; name: string; flight: boolean }[] {
  const list = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  return list.filter((g): g is Gamepad => !!g && g.connected).map(g => ({ id: g.id, name: padLabel(g.id), flight: isFlightGear(g) }));
}
function pad(): Gamepad | null {
  const list = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  const g = choosePad(list); if (!g) { if (padIndex >= 0) { padIndex = -1; padName = ''; } return null; }
  if (g.index !== padIndex) { padIndex = g.index; padName = padLabel(g.id); for (const f of padSubs) f(padName); }
  return calm(norm(g));
}
/** Axes that rest away from the centre (a slider or a throttle set at one end) are left out, so they can't steer the
 *  menus or walk you away: each axis's resting place is noted when the controller is first seen. */
const rest = new Map<string, number[]>();
function calm(g: Gamepad): Gamepad {
  const key = g.index + '|' + g.id; let r = rest.get(key);
  if (!r) { r = Array.from(g.axes); rest.set(key, r); }
  if (!r.some(v => Math.abs(v) > 0.5)) return g;
  const axes = Array.from(g.axes).map((v, i) => Math.abs(r![i] || 0) > 0.5 ? 0 : v);
  return { id: g.id, index: g.index, connected: g.connected, mapping: g.mapping, timestamp: g.timestamp, buttons: g.buttons, axes, vibrationActuator: (g as any).vibrationActuator } as any;
}
/** The chosen controller (for the places' own buttons: jump, crouch, the views…). */
export function activePad(): Gamepad | null { return pad(); }
/** A PlayStation 5 DualSense (or DualShock 4) on a PC that reports its own raw layout (common on Windows, above all over
 *  Bluetooth) instead of the standard one: its buttons, sticks, triggers and D-pad put into the standard order, so it
 *  works exactly like any other controller. Square 0, Cross 1, Circle 2, Triangle 3, L1 4, R1 5, L2 6, R2 7, Create 8,
 *  Options 9, L3 10, R3 11, PS 12, touchpad 13; sticks on axes 0, 1 (left) and 2, 5 (right); the D-pad as one axis (9). */
const PS_RAW = /054c|DualSense|DualShock|Wireless Controller|PLAYSTATION|0ce6|0df2|09cc|05c4/i;
function norm(g: Gamepad): Gamepad {
  if (g.mapping === 'standard' || !PS_RAW.test(g.id) || g.buttons.length < 13) return g;
  const B = (i: number) => g.buttons[i] || { pressed: false, touched: false, value: 0 };
  const hat = g.axes.length > 9 ? g.axes[9] : 2, near = (v: number) => Math.abs(hat - v) < 0.12;
  const up = near(-1) || near(-0.714) || near(1), right = near(-0.714) || near(-0.428) || near(-0.143), down = near(-0.143) || near(0.143) || near(0.428), left = near(0.428) || near(0.714) || near(1);
  const virt = (p: boolean) => ({ pressed: p, touched: p, value: p ? 1 : 0 });
  const buttons = [B(1), B(2), B(0), B(3), B(4), B(5), B(6), B(7), B(8), B(9), B(10), B(11), virt(up), virt(down), virt(left), virt(right), B(12), B(13)];
  const axes = [g.axes[0] || 0, g.axes[1] || 0, g.axes[2] || 0, g.axes[5] || 0];
  return { id: g.id, index: g.index, connected: g.connected, mapping: 'standard', timestamp: g.timestamp, buttons, axes, vibrationActuator: (g as any).vibrationActuator, hapticActuators: (g as any).hapticActuators } as any;
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
