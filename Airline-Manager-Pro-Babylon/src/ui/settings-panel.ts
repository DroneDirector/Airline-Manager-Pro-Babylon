// The settings, behind the gear that is always on the screen: Graphics and Controls only. Works with touch, the
// mouse, the keyboard (arrows, Enter, Esc) and a controller (D-pad or left stick to move, left/right to change,
// Cross to switch, Circle or Options to close).
import { S, saveSettings, applyPreset, resetControls, PRESETS } from '../core/settings';
import { APP, IS_PC } from '../core/app';
import { gpuInfo } from '../core/engine';
import { padConnected, vibrate, onPad, padList } from '../core/input';
import { icon, esc } from './icons';
import { U, onUpdate, updateCheck, updateInstall, updatePermission, updateStatus, canSelfUpdate } from '../core/update';
import { whatsNewHtml, whatsNewBind, mdHtml } from './whats-new';
import { openDeviceScan } from './device-scan';

type Row = { k: 'seg'; key: string; label: string; sub?: string; opts: [any, string][] }
  | { k: 'tog'; key: string; label: string; sub?: string }
  | { k: 'range'; key: string; label: string; sub?: string; min: number; max: number; step: number; fmt: (v: number) => string }
  | { k: 'btn'; label: string; sub?: string; act: string; text: string }
  | { k: 'info'; label: string; text: () => string }
  | { k: 'html'; html: () => string };

const pct = (v: number) => Math.round(v * 100) + '%';
const GFX: Row[] = [
  { k: 'btn', label: 'Scan this device', sub: 'Checks the processor, memory, graphics chip and screen, then recommends settings you can apply or decline', act: 'scan', text: 'Scan' },
  { k: 'seg', key: 'gfx.preset', label: 'Quality', sub: 'Sets everything below at once', opts: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra'], ['custom', 'Custom']] },
  { k: 'tog', key: 'gfx.autoRes', label: 'Automatic resolution', sub: 'Draws a little smaller when the graphics chip can\'t keep up, and sharp again when it can (never below 60%)' },
  { k: 'range', key: 'gfx.scale', label: 'Resolution', sub: 'Lower is faster, higher is sharper', min: 0.4, max: IS_PC ? 1.5 : 1, step: 0.05, fmt: pct },
  ...(IS_PC ? [{ k: 'seg', key: 'gfx.renderer', label: 'Graphics engine', sub: 'WebGPU takes far less of the processor per thing drawn (new; WebGL if it can\'t start). Applies after restarting the game', opts: [['webgl', 'WebGL'], ['webgpu', 'WebGPU']] } as Row] : []),
  { k: 'seg', key: 'gfx.fps', label: 'Frame rate limit', opts: [[30, '30'], [60, '60'], [0, 'No limit']] },
  { k: 'seg', key: 'gfx.aa', label: 'Anti-aliasing', sub: 'Smooth edges. Switching MSAA on or off applies after restarting the game', opts: [['off', 'Off'], ['fxaa', 'FXAA'], ['msaa', 'MSAA 4×']] },
  { k: 'seg', key: 'gfx.shadows', label: 'Shadows', sub: 'In the airport: applies when it is reopened', opts: [['off', 'Off'], ['low', 'Low'], ['high', 'High']] },
  { k: 'range', key: 'gfx.shadowDist', label: 'Shadow distance', sub: 'Things further away cast no shadow (lower is faster, and the near shadows sharper)', min: 30, max: 400, step: 10, fmt: v => v >= 400 ? 'All' : Math.round(v) + ' m' },
  { k: 'seg', key: 'gfx.shadowEvery', label: 'Shadow updates', sub: 'How often shadows are drawn again (less often is faster; moving shadows may trail a little)', opts: [[1, 'Every frame'], [2, 'Every 2nd'], [3, 'Every 3rd']] },
  { k: 'seg', key: 'gfx.mirror', label: 'Mirror behind the bar', sub: 'A real reflection of the room. In the airport: applies when it is reopened', opts: [['off', 'Off'], ['low', 'Low'], ['high', 'High']] },
  { k: 'tog', key: 'gfx.probe', label: 'Sky reflections', sub: 'Metal and paint reflect what is round them (the room, the sky). In the airport: applies when it is reopened' },
  { k: 'tog', key: 'gfx.glow', label: 'Glow of lights', sub: 'Lamps, the fire and the screens glow. In the airport: applies when it is reopened' },
  { k: 'tog', key: 'gfx.bloom', label: 'Bloom', sub: 'Bright light spills softly. In the airport: applies when it is reopened' },
  { k: 'tog', key: 'gfx.ssao', label: 'Ambient occlusion', sub: 'Soft shade where things meet (heavy). In the airport: applies when it is reopened' },
  { k: 'tog', key: 'gfx.iblShadows', label: 'Sky shadows', sub: 'Light and shade from the whole sky, not just the sun (very heavy). Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.manyLights', label: 'Many real lights', sub: 'Every light panel lights what is round it (heavy on phones). Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.volLight', label: 'Light rays', sub: 'Sun rays past buildings and jetways. Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.heightFog', label: 'Height fog', sub: 'Low haze over the ground that thins with height. Applies when the airport is reopened' },
  { k: 'seg', key: 'gfx.reflMode', label: 'Reflection type', sub: 'Off; Live: the outer glass mirrors the jetways, the aircraft and the sky; Screen: floors and the wet apron reflect what is on screen (applies when the airport is reopened); Both: the two together (heavy, for strong PCs)', opts: [['off', 'Off'], ['live', 'Live'], ['screen', 'Screen'], ['both', 'Both']] },
  { k: 'range', key: 'gfx.liveReflQ', label: 'Live reflection quality', sub: 'Higher: sharper, drawn more often and more of the scenery in the glass (heavier)', min: 0.1, max: 1, step: 0.05, fmt: pct, show: () => /live|both/.test((S.gfx as any).reflMode) } as any,
  { k: 'tog', key: 'gfx.liveJet', label: 'Jetway windows live', sub: 'The jetways\' windows mirror the apron all round too (the heaviest part of live reflections). The terminal\'s glass stays live either way', show: () => /live|both/.test((S.gfx as any).reflMode) } as any,
  { k: 'range', key: 'gfx.ssrQ', label: 'Screen reflection quality', sub: 'Higher: sharper, reaching further and stronger (heavier)', min: 0.1, max: 1, step: 0.05, fmt: pct, show: () => /screen|both/.test((S.gfx as any).reflMode) } as any,
  { k: 'tog', key: 'gfx.pcss', label: 'Soft contact shadows', sub: 'Sharp where things touch the ground, softer further away. Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.taa', label: 'Temporal anti-aliasing', sub: 'No shimmer on handrails, fences and trusses (slight blur). Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.eyeAdapt', label: 'Eye adaptation', sub: 'Brighter indoors, back down outside, eased like an eye. Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.flares', label: 'Lens flares', sub: 'Flares when looking towards the sun. Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.dof', label: 'Depth of field', sub: 'Focus on what you look at, the rest softly blurred. Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.mblur', label: 'Motion blur', sub: 'Blur when turning quickly. Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.parallax', label: 'Surface depth', sub: 'Relief on floors, cladding and tyres. Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.ktx2', label: 'Compressed textures', sub: 'The jetways\', rotundas\' and runway\'s pictures kept compressed on the graphics chip (about a quarter of the memory; very slightly softer). Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.wetRain', label: 'Rain and snow on the ground', sub: 'Wet ground and puddles in rain, snow lying on the ground in snow. Applies when the airport is reopened' },
  { k: 'tog', key: 'gfx.glint', label: 'Sun glint', sub: 'The sun glinting on tarmac and markings when it shines through the clouds. Applies when the airport is reopened' },
  { k: 'seg', key: 'gfx.particles', label: 'Fire and contrails', opts: [['low', 'Simple'], ['high', 'Full']] },
  { k: 'tog', key: 'gfx.terrain', label: 'Real terrain', sub: 'Mountains, coasts and the sea where they are, with satellite pictures, under flights below 33,000 ft (loaded over the internet)' },
  { k: 'seg', key: 'gfx.clouds', label: 'Volumetric clouds', sub: 'How finely the clouds are drawn (higher is heavier). In the airport: applies when it is reopened', opts: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']] },
  { k: 'tog', key: 'gfx.aces', label: 'Film tone mapping', sub: 'ACES, like a camera' },
  { k: 'range', key: 'gfx.exposure', label: 'Brightness', sub: 'In the airport: applies when it is reopened', min: 0.5, max: 1.8, step: 0.05, fmt: pct },
  { k: 'tog', key: 'gfx.sharpen', label: 'Sharpen', sub: 'In the airport: applies when it is reopened' },
  { k: 'range', key: 'gfx.fov', label: 'Field of view', min: 50, max: 100, step: 1, fmt: v => Math.round(v) + '°' },
  { k: 'tog', key: 'gfx.showFps', label: 'Show the frame rate', sub: 'Frames a second and the time between them' },
  { k: 'tog', key: 'gfx.showCpu', label: 'Show the CPU load', sub: 'How much of each frame the processor is busy' },
  { k: 'tog', key: 'gfx.showGpu', label: 'Show the GPU load', sub: 'How long the graphics chip takes per frame, draw calls and triangles' },
  { k: 'tog', key: 'gfx.showMem', label: 'Show the memory', sub: 'The app\'s memory and what pictures and models take on the graphics chip' },
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

const TABS: [string, string, string][] = [['gfx', 'monitor', 'Graphics'], ['ctl', 'pad', 'Controls'], ['upd', 'download', 'Updates'], ['new', 'star', 'What\'s new']];
/** Settings → Updates: the installed version, the newest one and what it holds, and the buttons to check and install. */
function updRows(): Row[] {
  const busy = U.state === 'checking' || U.state === 'downloading' || U.state === 'installing', R: Row[] = [
    { k: 'info', label: 'Installed', text: () => `${APP.name} ${APP.version}` },
    { k: 'info', label: 'Status', text: () => updateStatus() },
  ];
  if (canSelfUpdate()) {
    if (U.state === 'permission') R.push({ k: 'btn', label: 'Allow updates', sub: 'Android needs your permission once: turn on "Allow from this source", then come back', act: 'upd-perm', text: 'Open the setting' });
    else if (U.state === 'available' && U.info) R.push({ k: 'btn', label: `Install version ${U.info.version}`, sub: `${U.info.size ? (U.info.size / 1048576).toFixed(1) + ' MB · ' : ''}installs over this version and keeps your settings`, act: 'upd-install', text: 'Update' });
    if (!busy) R.push({ k: 'btn', label: 'Check for updates', sub: 'Also checked by itself every few hours', act: 'upd-check', text: 'Check' });
  }
  if (U.info && U.info.notes) R.push({ k: 'html', html: () => `<div class="upd-notes"><b>What version ${esc(U.info!.version)} holds</b>${mdHtml(U.info!.notes)}</div>` });
  return R;
}
const NEW: Row[] = [{ k: 'html', html: () => `<div class="wn-list in-sp">${whatsNewHtml()}</div>` }];
let el: HTMLElement | null = null, tab = 'gfx', focus = 0, onClose: (() => void) | null = null;
const get = (key: string) => { const [a, b] = key.split('.'); return (S as any)[a][b]; };
const set = (key: string, v: any) => {
  if (key === 'gfx.preset') { applyPreset(v); return; }
  const [a, b] = key.split('.'); (S as any)[a][b] = v;
  if (a === 'gfx' && b !== 'fps' && b !== 'fov' && b !== 'showFps' && b !== 'showCpu' && b !== 'showGpu' && b !== 'showMem' && b !== 'exposure' && b !== 'aces' && S.gfx.preset !== 'custom') {
    const P: any = PRESETS[S.gfx.preset]; if (P && P[b] !== undefined && P[b] !== v) S.gfx.preset = 'custom';
  }
  saveSettings(b);
};
export function settingsOpen(): boolean { return !!el; }
export function settingsShow(closed?: () => void) {
  if (el) return; onClose = closed || null;
  const ui = document.getElementById('ui') as HTMLElement; el = document.createElement('div'); el.className = 'sp'; ui.appendChild(el); document.body.classList.add('sp-on');
  el.addEventListener('click', clickIn); el.addEventListener('input', inputIn);
  render(); requestAnimationFrame(() => el && el.classList.add('in'));
}
export function settingsHide() {
  const e = el; if (!e) return; el = null; e.classList.remove('in'); setTimeout(() => e.remove(), 300); document.body.classList.remove('sp-on');
  const f = onClose; onClose = null; if (f) f();
}
onPad(() => { if (el) render(); });
/** The controller to use, when more than one is connected (flight gear is marked, and never chosen by itself). */
function padRow(): Row[] { const L = padList(); if (L.length < 2 && !(S.ctl as any).pad) return [];
  return [{ k: 'seg', key: 'ctl.pad', label: 'Controller to use', sub: 'Automatic takes a gamepad and never flight gear (sticks, throttles, pedals), which stays free for flying', opts: [['', 'Automatic'], ...L.map(p => [p.id, p.name + (p.flight ? ' · flight gear' : '')] as [any, string])] }]; }
function rows(): Row[] { return tab === 'gfx' ? GFX.filter((r: any) => !r.show || r.show()) : tab === 'ctl' ? [...padRow(), ...CTL] : tab === 'upd' ? updRows() : NEW; }
onUpdate(() => { if (el && tab === 'upd') render(); });
const NT = TABS.length;
let lastTab = '', lastFocus = -1;
function render() {
  if (!el) return; const R = rows(); focus = Math.max(0, Math.min(R.length + NT - 1, focus));
  // the list stays where it was scrolled to when a setting changes (it only moves to follow the controller's focus)
  const was = el.querySelector('.sp-list') as HTMLElement | null, keep = was && tab === lastTab ? was.scrollTop : 0;
  el.innerHTML = `<div class="sp-head"><b>${icon('gear')}Settings</b><button class="sp-x" data-a="close" aria-label="Close">${icon('close')}</button></div>
    <div class="sp-tabs">${TABS.map(([k, ic, l], i) => `<button data-a="tab" data-v="${k}" class="${tab === k ? 'on' : ''} ${focus === i ? 'f' : ''}">${icon(ic)}<span>${l}</span>${k === 'upd' && U.state === 'available' ? '<i class="sp-dot"></i>' : ''}</button>`).join('')}</div>
    <div class="sp-list">${R.map((r, i) => rowHtml(r, i + NT)).join('')}</div>`;
  if (tab === 'new') whatsNewBind(el);
  const list = el.querySelector('.sp-list') as HTMLElement | null; if (list) list.scrollTop = keep;
  if (focus !== lastFocus || tab !== lastTab) { const f = el.querySelector('.sp-row.f') as HTMLElement; if (f) f.scrollIntoView({ block: 'nearest' }); }
  lastTab = tab; lastFocus = focus;
}
function rowHtml(r: Row, i: number): string {
  const cls = `sp-row ${focus === i ? 'f' : ''}`, lab = `<span class="sp-l"><b>${esc((r as any).label)}</b>${(r as any).sub ? `<small>${esc((r as any).sub)}</small>` : ''}</span>`;
  if (r.k === 'seg') { const v = get(r.key); return `<div class="${cls}" data-i="${i}">${lab}<span class="sp-seg">${r.opts.map(o => `<button data-a="seg" data-key="${r.key}" data-v="${esc(String(o[0]))}" class="${String(v) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</span></div>`; }
  if (r.k === 'tog') { const v = !!get(r.key); return `<div class="${cls}" data-i="${i}">${lab}<button class="sp-tog ${v ? 'on' : ''}" data-a="tog" data-key="${r.key}" aria-pressed="${v}"><i></i></button></div>`; }
  if (r.k === 'range') { const v = get(r.key); return `<div class="${cls}" data-i="${i}">${lab}<span class="sp-rng"><input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}" data-key="${r.key}"><em>${esc(r.fmt(v))}</em></span></div>`; }
  if (r.k === 'html') return `<div class="${cls} html" data-i="${i}">${r.html()}</div>`;
  if (r.k === 'btn') return `<div class="${cls}" data-i="${i}">${lab}<button class="sp-btn" data-a="${r.act}">${esc(r.text)}</button></div>`;
  return `<div class="${cls} info" data-i="${i}"><span class="sp-l"><b>${esc(r.label)}</b><small>${esc(r.text())}</small></span></div>`;
}
function clickIn(e: Event) {
  const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement; if (!b) return;
  const a = b.getAttribute('data-a') || '', key = b.getAttribute('data-key') || '', v = b.getAttribute('data-v');
  if (a === 'close') { settingsHide(); return; }
  if (a === 'tab') { tab = v || 'gfx'; focus = Math.max(0, TABS.findIndex(t => t[0] === tab)); render(); return; }
  if (a === 'seg') { const cur = get(key); set(key, typeof cur === 'number' ? Number(v) : v); render(); return; }
  if (a === 'tog') { set(key, !get(key)); render(); return; }
  if (a === 'scan') { openDeviceScan(render); return; }
  if (a === 'rumble') { vibrate(400, 1, 0.8); return; }
  if (a === 'reset-ctl') { resetControls(); render(); return; }
  if (a === 'upd-check') { updateCheck(); return; }
  if (a === 'upd-install') { updateInstall(); return; }
  if (a === 'upd-perm') { updatePermission(); return; }
}
function inputIn(e: Event) {
  const t = e.target as HTMLInputElement; const key = t.getAttribute('data-key'); if (!key) return;
  set(key, Number(t.value)); const em = t.parentElement && t.parentElement.querySelector('em'); const r = rows().filter((x: any) => x.key === key)[0] as any; if (em && r) em.textContent = r.fmt(Number(t.value));
}
/** A controller or the keyboard in the settings: move, change, switch, close. */
export function settingsButton(btn: string): boolean {
  if (!el) return false; const R = rows(), n = R.length + NT;
  if (btn === 'back' || btn === 'menu') { settingsHide(); return true; }
  if (btn === 'up') { focus = (focus + n - 1) % n; render(); return true; }
  if (btn === 'down') { focus = (focus + 1) % n; render(); return true; }
  if (focus < NT) { if (btn === 'left' || btn === 'right' || btn === 'confirm') { const cur = TABS.findIndex(t => t[0] === tab), to = btn === 'confirm' ? focus : (cur + (btn === 'left' ? NT - 1 : 1)) % NT; tab = TABS[to][0]; focus = to; render(); } return true; }
  const r = R[focus - NT]; if (!r) return true;
  if (r.k === 'seg') { const cur = get(r.key), i = r.opts.findIndex(o => String(o[0]) === String(cur)); const d = btn === 'left' ? -1 : btn === 'right' || btn === 'confirm' ? 1 : 0; if (d) { const o = r.opts[(Math.max(0, i) + d + r.opts.length) % r.opts.length]; set(r.key, o[0]); render(); } }
  else if (r.k === 'tog') { if (btn === 'confirm' || btn === 'left' || btn === 'right') { set(r.key, !get(r.key)); render(); } }
  else if (r.k === 'range') { const d = btn === 'left' ? -1 : btn === 'right' ? 1 : 0; if (d) { const v = Math.max(r.min, Math.min(r.max, Math.round((get(r.key) + d * r.step) / r.step) * r.step)); set(r.key, Number(v.toFixed(3))); render(); } }
  else if (r.k === 'btn') { if (btn === 'confirm') { if (r.act === 'scan') openDeviceScan(render); else if (r.act === 'rumble') vibrate(400, 1, 0.8); else if (r.act === 'reset-ctl') { resetControls(); render(); } else if (r.act === 'upd-check') updateCheck(); else if (r.act === 'upd-install') updateInstall(); else if (r.act === 'upd-perm') updatePermission(); } }
  return true;
}
