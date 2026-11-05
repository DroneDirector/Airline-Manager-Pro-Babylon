// The settings, behind the gear that is always on the screen: Graphics and Controls only. Works with touch, the
// mouse, the keyboard (arrows, Enter, Esc) and a controller (D-pad or left stick to move, left/right to change,
// Cross to switch, Circle or Options to close).
import { S, saveSettings, applyPreset, resetControls, PRESETS } from '../core/settings';
import { APP, IS_PC } from '../core/app';
import { gpuInfo } from '../core/engine';
import { padConnected, vibrate, onPad } from '../core/input';
import { icon, esc } from './icons';

type Row = { k: 'seg'; key: string; label: string; sub?: string; opts: [any, string][] }
  | { k: 'tog'; key: string; label: string; sub?: string }
  | { k: 'range'; key: string; label: string; sub?: string; min: number; max: number; step: number; fmt: (v: number) => string }
  | { k: 'btn'; label: string; sub?: string; act: string; text: string }
  | { k: 'info'; label: string; text: () => string };

const pct = (v: number) => Math.round(v * 100) + '%';
const GFX: Row[] = [
  { k: 'seg', key: 'gfx.preset', label: 'Quality', sub: 'Sets everything below at once', opts: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra'], ['custom', 'Custom']] },
  { k: 'range', key: 'gfx.scale', label: 'Resolution', sub: 'Lower is faster, higher is sharper', min: 0.4, max: IS_PC ? 1.5 : 1, step: 0.05, fmt: pct },
  { k: 'seg', key: 'gfx.fps', label: 'Frame rate limit', opts: [[30, '30'], [60, '60'], [0, 'No limit']] },
  { k: 'seg', key: 'gfx.aa', label: 'Anti-aliasing', sub: 'Smooth edges (MSAA after a restart of the 3D view)', opts: [['off', 'Off'], ['fxaa', 'FXAA'], ['msaa', 'MSAA 4×']] },
  { k: 'seg', key: 'gfx.shadows', label: 'Shadows', opts: [['off', 'Off'], ['low', 'Low'], ['high', 'High']] },
  { k: 'seg', key: 'gfx.mirror', label: 'Mirror behind the bar', sub: 'A real reflection of the room', opts: [['off', 'Off'], ['low', 'Low'], ['high', 'High']] },
  { k: 'tog', key: 'gfx.probe', label: 'Reflections on metal', sub: 'Brass, copper and chrome reflect the room' },
  { k: 'tog', key: 'gfx.glow', label: 'Glow of lights', sub: 'Lamps, the fire and the screens glow' },
  { k: 'tog', key: 'gfx.bloom', label: 'Bloom', sub: 'Bright light spills softly' },
  { k: 'tog', key: 'gfx.ssao', label: 'Ambient occlusion', sub: 'Soft shade where things meet (heavy)' },
  { k: 'seg', key: 'gfx.particles', label: 'Fire', opts: [['low', 'Simple'], ['high', 'Full']] },
  { k: 'tog', key: 'gfx.aces', label: 'Film tone mapping', sub: 'ACES, like a camera' },
  { k: 'range', key: 'gfx.exposure', label: 'Brightness', min: 0.5, max: 1.8, step: 0.05, fmt: pct },
  { k: 'tog', key: 'gfx.sharpen', label: 'Sharpen' },
  { k: 'range', key: 'gfx.fov', label: 'Field of view', min: 50, max: 100, step: 1, fmt: v => Math.round(v) + '°' },
  { k: 'tog', key: 'gfx.showFps', label: 'Show the frame rate' },
  { k: 'info', label: 'Engine', text: () => `Babylon.js ${APP.babylon} · ${gpuInfo() || 'starting'}` },
];
const CTL: Row[] = [
  { k: 'info', label: 'Controller', text: () => padConnected() || 'None connected: connect a PlayStation controller by cable or Bluetooth' },
  { k: 'range', key: 'ctl.padLook', label: 'Controller look speed', min: 0.3, max: 3, step: 0.1, fmt: pct },
  { k: 'range', key: 'ctl.padDead', label: 'Stick dead zone', sub: 'How far a stick moves before it counts', min: 0.05, max: 0.4, step: 0.01, fmt: pct },
  { k: 'tog', key: 'ctl.padInvert', label: 'Invert looking up and down (controller)' },
  { k: 'tog', key: 'ctl.padSwap', label: 'Swap the sticks', sub: 'Look with the left stick, walk with the right' },
  { k: 'tog', key: 'ctl.padVibrate', label: 'Vibration' },
  { k: 'btn', label: 'Test vibration', act: 'rumble', text: 'Rumble' },
  { k: 'info', label: 'Buttons', text: () => 'Left stick: walk · Right stick: look · L3: run · Cross: use · Circle: back · Options: settings' },
  { k: 'range', key: 'ctl.touchLook', label: 'Touch look speed', min: 0.3, max: 3, step: 0.1, fmt: pct },
  { k: 'range', key: 'ctl.touchStick', label: 'Touch stick size', min: 0.7, max: 1.6, step: 0.05, fmt: pct },
  { k: 'range', key: 'ctl.mouseLook', label: 'Mouse look speed', min: 0.3, max: 3, step: 0.1, fmt: pct },
  { k: 'tog', key: 'ctl.mouseInvert', label: 'Invert looking up and down (mouse)' },
  { k: 'btn', label: 'Controls as they were', act: 'reset-ctl', text: 'Reset' },
];

let el: HTMLElement | null = null, tab = 'gfx', focus = 0, onClose: (() => void) | null = null;
const get = (key: string) => { const [a, b] = key.split('.'); return (S as any)[a][b]; };
const set = (key: string, v: any) => {
  if (key === 'gfx.preset') { applyPreset(v); return; }
  const [a, b] = key.split('.'); (S as any)[a][b] = v;
  if (a === 'gfx' && b !== 'fps' && b !== 'fov' && b !== 'showFps' && b !== 'exposure' && b !== 'aces' && S.gfx.preset !== 'custom') {
    const P: any = PRESETS[S.gfx.preset]; if (P && P[b] !== undefined && P[b] !== v) S.gfx.preset = 'custom';
  }
  saveSettings(b);
};
export function settingsOpen(): boolean { return !!el; }
export function settingsShow(closed?: () => void) {
  if (el) return; onClose = closed || null;
  const ui = document.getElementById('ui') as HTMLElement; el = document.createElement('div'); el.className = 'sp'; ui.appendChild(el);
  el.addEventListener('click', clickIn); el.addEventListener('input', inputIn);
  render(); requestAnimationFrame(() => el && el.classList.add('in'));
}
export function settingsHide() {
  const e = el; if (!e) return; el = null; e.classList.remove('in'); setTimeout(() => e.remove(), 300);
  const f = onClose; onClose = null; if (f) f();
}
onPad(() => { if (el) render(); });
function rows(): Row[] { return tab === 'gfx' ? GFX : CTL; }
function render() {
  if (!el) return; const R = rows(); focus = Math.max(0, Math.min(R.length + 1, focus));
  el.innerHTML = `<div class="sp-head"><b>${icon('gear')}Settings</b><button class="sp-x" data-a="close" aria-label="Close">${icon('close')}</button></div>
    <div class="sp-tabs"><button data-a="tab" data-v="gfx" class="${tab === 'gfx' ? 'on' : ''} ${focus === 0 ? 'f' : ''}">${icon('monitor')}Graphics</button><button data-a="tab" data-v="ctl" class="${tab === 'ctl' ? 'on' : ''} ${focus === 1 ? 'f' : ''}">${icon('pad')}Controls</button></div>
    <div class="sp-list">${R.map((r, i) => rowHtml(r, i + 2)).join('')}</div>`;
  const f = el.querySelector('.sp-row.f') as HTMLElement; if (f) f.scrollIntoView({ block: 'nearest' });
}
function rowHtml(r: Row, i: number): string {
  const cls = `sp-row ${focus === i ? 'f' : ''}`, lab = `<span class="sp-l"><b>${esc(r.label)}</b>${(r as any).sub ? `<small>${esc((r as any).sub)}</small>` : ''}</span>`;
  if (r.k === 'seg') { const v = get(r.key); return `<div class="${cls}" data-i="${i}">${lab}<span class="sp-seg">${r.opts.map(o => `<button data-a="seg" data-key="${r.key}" data-v="${o[0]}" class="${String(v) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</span></div>`; }
  if (r.k === 'tog') { const v = !!get(r.key); return `<div class="${cls}" data-i="${i}">${lab}<button class="sp-tog ${v ? 'on' : ''}" data-a="tog" data-key="${r.key}" aria-pressed="${v}"><i></i></button></div>`; }
  if (r.k === 'range') { const v = get(r.key); return `<div class="${cls}" data-i="${i}">${lab}<span class="sp-rng"><input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}" data-key="${r.key}"><em>${esc(r.fmt(v))}</em></span></div>`; }
  if (r.k === 'btn') return `<div class="${cls}" data-i="${i}">${lab}<button class="sp-btn" data-a="${r.act}">${esc(r.text)}</button></div>`;
  return `<div class="${cls} info" data-i="${i}"><span class="sp-l"><b>${esc(r.label)}</b><small>${esc(r.text())}</small></span></div>`;
}
function clickIn(e: Event) {
  const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement; if (!b) return;
  const a = b.getAttribute('data-a') || '', key = b.getAttribute('data-key') || '', v = b.getAttribute('data-v');
  if (a === 'close') { settingsHide(); return; }
  if (a === 'tab') { tab = v || 'gfx'; render(); return; }
  if (a === 'seg') { const cur = get(key); set(key, typeof cur === 'number' ? Number(v) : v); render(); return; }
  if (a === 'tog') { set(key, !get(key)); render(); return; }
  if (a === 'rumble') { vibrate(400, 1, 0.8); return; }
  if (a === 'reset-ctl') { resetControls(); render(); return; }
}
function inputIn(e: Event) {
  const t = e.target as HTMLInputElement; const key = t.getAttribute('data-key'); if (!key) return;
  set(key, Number(t.value)); const em = t.parentElement && t.parentElement.querySelector('em'); const r = rows().filter((x: any) => x.key === key)[0] as any; if (em && r) em.textContent = r.fmt(Number(t.value));
}
/** A controller or the keyboard in the settings: move, change, switch, close. */
export function settingsButton(btn: string): boolean {
  if (!el) return false; const R = rows(), n = R.length + 2;
  if (btn === 'back' || btn === 'menu') { settingsHide(); return true; }
  if (btn === 'up') { focus = (focus + n - 1) % n; render(); return true; }
  if (btn === 'down') { focus = (focus + 1) % n; render(); return true; }
  if (focus <= 1) { if (btn === 'left' || btn === 'right' || btn === 'confirm') { tab = btn === 'confirm' ? (focus === 0 ? 'gfx' : 'ctl') : tab === 'gfx' ? 'ctl' : 'gfx'; focus = tab === 'gfx' ? 0 : 1; render(); } return true; }
  const r = R[focus - 2]; if (!r) return true;
  if (r.k === 'seg') { const cur = get(r.key), i = r.opts.findIndex(o => String(o[0]) === String(cur)); const d = btn === 'left' ? -1 : btn === 'right' || btn === 'confirm' ? 1 : 0; if (d) { const o = r.opts[(Math.max(0, i) + d + r.opts.length) % r.opts.length]; set(r.key, o[0]); render(); } }
  else if (r.k === 'tog') { if (btn === 'confirm' || btn === 'left' || btn === 'right') { set(r.key, !get(r.key)); render(); } }
  else if (r.k === 'range') { const d = btn === 'left' ? -1 : btn === 'right' ? 1 : 0; if (d) { const v = Math.max(r.min, Math.min(r.max, Math.round((get(r.key) + d * r.step) / r.step) * r.step)); set(r.key, Number(v.toFixed(3))); render(); } }
  else if (r.k === 'btn') { if (btn === 'confirm') { if (r.act === 'rumble') vibrate(400, 1, 0.8); else if (r.act === 'reset-ctl') { resetControls(); render(); } } }
  return true;
}
