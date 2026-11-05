/* Settings → Devices: your controllers, keyboard, mouse and sound devices in one place.
 *  - What is connected now, and what the game remembers that isn't connected at the moment.
 *  - Live: the buttons, keys and mouse buttons you press light up as you press them.
 *  - Bindings: change what any controller button or key does, single or as a combination (hold one, press another).
 *    The controller's button hints in the game follow your bindings.
 *  - Sound devices: speakers, headphones and headsets, by cable, USB or Bluetooth.
 *  - Pairing: on Android, find and pair a wireless controller or headset here; on Windows, its Bluetooth settings open. */

/** A controller button's name and its PlayStation symbol (standard layout). */
const PAD_BTN: [string, string][] = [['Cross', '✕'], ['Circle', '○'], ['Square', '□'], ['Triangle', '△'], ['L1', 'L1'], ['R1', 'R1'], ['L2', 'L2'], ['R2', 'R2'],
  ['Create', 'Create'], ['Options', 'Options'], ['L3', 'L3'], ['R3', 'R3'], ['D-pad up', '▲'], ['D-pad down', '▼'], ['D-pad left', '◀'], ['D-pad right', '▶'], ['PS', 'PS'], ['Touchpad', 'Pad']];
type PadBind = { b: number; h?: number };
type KeyBind = { k: string; m?: string };
/** What the controller's buttons do (and their usual buttons). */
const PAD_ACTIONS: { id: string; name: string; d: PadBind }[] = [
  { id: 'click', name: 'Click (hold to drag)', d: { b: 0 } },
  { id: 'back', name: 'Back', d: { b: 1 } },
  { id: 'nextCam', name: '3D view: the next camera', d: { b: 2 } },
  { id: 'pointer', name: 'The pointer in 3D and the rooms', d: { b: 3 } },
  { id: 'prev', name: 'Previous page · previous aircraft', d: { b: 4 } },
  { id: 'next', name: 'Next page · next aircraft', d: { b: 5 } },
  { id: 'settings', name: 'Settings', d: { b: 9 } },
  { id: 'centre', name: 'Pointer to the middle · hide the 3D controls', d: { b: 11 } },
  { id: 'run', name: 'Walk faster (hold)', d: { b: 10 } },
];
/** What the keys do (their usual keys). */
const KEY_ACTIONS: { id: string; name: string; d: KeyBind }[] = [
  { id: 'fwd', name: 'Walk forward', d: { k: 'w' } }, { id: 'bwd', name: 'Walk back', d: { k: 's' } },
  { id: 'left', name: 'Step left', d: { k: 'a' } }, { id: 'right', name: 'Step right', d: { k: 'd' } },
  { id: 'run', name: 'Walk faster (hold)', d: { k: 'shift' } },
  { id: 'turnL', name: 'Turn left', d: { k: 'q' } }, { id: 'turnR', name: 'Turn right', d: { k: 'e' } },
  { id: 'escape', name: 'Back · leave · let go of the mouse', d: { k: 'escape' } },
];
const Dev: any = { cap: null, held: -1, heldAt: 0, seenKb: 0, seenMouse: 0, keys: {}, mouse: [false, false, false], raf: 0, audio: [], bt: [], btBusy: false };

function padBinds(): { [k: string]: PadBind } { const S: any = State.settings; return S.padBind = S.padBind || {}; }
function keyBinds(): { [k: string]: KeyBind } { const S: any = State.settings; return S.keyBind = S.keyBind || {}; }
function padBind(id: string): PadBind { const a = PAD_ACTIONS.filter(x => x.id === id)[0]; return padBinds()[id] || (a ? a.d : { b: -1 }); }
function keyBind(id: string): KeyBind { const a = KEY_ACTIONS.filter(x => x.id === id)[0]; return keyBinds()[id] || (a ? a.d : { k: '' }); }
/** This frame: was the action's button (or combination) just pressed? A button used in a combination doesn't also do its own thing while the combination's other button is held. */
function padAct(id: string, B: boolean[], P: boolean[]): boolean {
  const bd = padBind(id); if (bd.b < 0) return false;
  if (bd.h != null) return !!B[bd.h] && !!B[bd.b] && !P[bd.b];
  if (!B[bd.b] || P[bd.b]) return false;
  for (const a of PAD_ACTIONS) { const o = padBind(a.id); if (a.id !== id && o.h != null && o.b === bd.b && B[o.h]) return false; }
  return true;
}
function padActUp(id: string, B: boolean[], P: boolean[]): boolean { const bd = padBind(id); return bd.b >= 0 && !B[bd.b] && !!P[bd.b]; }
function padActHeld(id: string, B: boolean[]): boolean { const bd = padBind(id); return bd.b >= 0 && !!B[bd.b] && (bd.h == null || !!B[bd.h]); }
/** The button (or combination) as the controller shows it: for the hints in the game. */
function padGlyph(id: string): string {
  const bd = padBind(id), g = (i: number) => `<kbd class="pg pg-${i}">${esc((PAD_BTN[i] || ['', '?'])[1])}</kbd>`;
  return bd.b < 0 ? '' : bd.h != null ? `${g(bd.h)}<span class="pg-plus">+</span>${g(bd.b)}` : g(bd.b);
}
/** A small row of controller hints, only while a controller is connected. */
function padHintsHtml(list: [string, string][]): string {
  if (!(typeof Pad !== 'undefined' && Pad.gp)) return '';
  return `<div class="pad-hints">${list.map(x => `<span>${padGlyph(x[0])}${esc(x[1])}</span>`).join('')}</div>`;
}
function keyName(b: KeyBind): string {
  const nice: { [k: string]: string } = { ' ': 'Space', escape: 'Esc', shift: 'Shift', control: 'Ctrl', alt: 'Alt', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', enter: 'Enter', tab: 'Tab', backspace: 'Backspace' };
  const k = nice[b.k] || (b.k.length === 1 ? b.k.toUpperCase() : b.k.charAt(0).toUpperCase() + b.k.slice(1));
  return (b.m ? (b.m === 'ctrl' ? 'Ctrl' : b.m === 'alt' ? 'Alt' : 'Shift') + ' + ' : '') + k;
}

/* ---------- the keyboard: your keys turned into the game's own ---------- */
// Every place in the game listens for its usual keys (W A S D, Shift, Q, E, Esc). A key you bound to an action is
// handed on as that action's usual key, and the usual key of an action you moved elsewhere does nothing.
function keyRemap(e: KeyboardEvent): string | null | undefined {
  const k = e.key.toLowerCase(), m = e.ctrlKey ? 'ctrl' : e.altKey ? 'alt' : '';
  let hit: string | null | undefined;
  for (const a of KEY_ACTIONS) { const b = keyBind(a.id); if (b.k === k && (b.m || '') === (b.m === 'shift' ? (e.shiftKey ? 'shift' : '') : m)) { hit = a.d.k; break; } }
  if (hit !== undefined) return hit === k ? undefined : hit;
  for (const a of KEY_ACTIONS) if (a.d.k === k && keyBinds()[a.id] && keyBinds()[a.id].k !== k) return null;   // its action has moved to another key
  return undefined;
}
['keydown', 'keyup'].forEach(type => window.addEventListener(type, (e: Event) => {
  const ev = e as KeyboardEvent; if ((ev as any).__remapped) return;
  if (type === 'keydown') { Dev.seenKb = Date.now(); Dev.keys[ev.key.toLowerCase()] = true; } else delete Dev.keys[ev.key.toLowerCase()];
  if (Dev.cap && Dev.cap.kind === 'key') { if (type === 'keydown') devKeyCaptured(ev); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
  const t = ev.target as HTMLElement; if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
  const to = keyRemap(ev); if (to === undefined) return;
  ev.stopImmediatePropagation(); ev.preventDefault(); if (to === null) return;
  const key = to === 'escape' ? 'Escape' : to === 'shift' ? 'Shift' : to;
  const n: any = new KeyboardEvent(type, { key, code: ev.code, bubbles: true, cancelable: true, shiftKey: to === 'shift' }); n.__remapped = true;
  (ev.target || window).dispatchEvent(n);
}, true));
['pointerdown', 'pointerup'].forEach(type => window.addEventListener(type, (e: Event) => { const p = e as PointerEvent; if (p.pointerType !== 'mouse') return; Dev.seenMouse = Date.now(); if (p.button >= 0 && p.button < 3) Dev.mouse[p.button] = type === 'pointerdown'; }, true));

/* ---------- changing a binding ---------- */
function devKeyCaptured(e: KeyboardEvent) {
  const k = e.key.toLowerCase(); if (k === 'control' || k === 'alt' || (k === 'shift' && Dev.cap.id !== 'run')) return;   // wait for the key that goes with it
  const b: KeyBind = { k }; if (e.ctrlKey && k !== 'control') b.m = 'ctrl'; else if (e.altKey && k !== 'alt') b.m = 'alt'; else if (e.shiftKey && k !== 'shift') b.m = 'shift';
  keyBinds()[Dev.cap.id] = b; Dev.cap = null; Store.save(); Sound.tick(); toast(`Now ${keyName(b)}`, 'ok'); devRerender();
}
/** Watching the controller while a binding is being changed: one button, or hold one and press another. */
function devPadCapture(B: boolean[], P: boolean[]) {
  const now = performance.now();
  for (let i = 0; i < B.length; i++) if (B[i] && !P[i]) {
    if (Dev.held >= 0 && Dev.held !== i && now - Dev.heldAt > 200) { padBinds()[Dev.cap.id] = { h: Dev.held, b: i }; Dev.cap = null; Dev.held = -1; Store.save(); Sound.tick(); devRerender(); return; }
    if (Dev.held < 0) { Dev.held = i; Dev.heldAt = now; }
  }
  if (Dev.held >= 0 && !B[Dev.held] && P[Dev.held]) { padBinds()[Dev.cap.id] = { b: Dev.held }; Dev.cap = null; Dev.held = -1; Store.save(); Sound.tick(); devRerender(); }
}
ACTIONS['dev-bind'] = el => {
  const kind = el.getAttribute('data-kind') as 'pad' | 'key', id = el.getAttribute('data-id');
  if (kind === 'pad' && !(typeof Pad !== 'undefined' && Pad.gp)) { toast('Connect a controller first', 'info'); return; }
  Dev.cap = { kind, id }; Dev.held = -1; Sound.tick(); devRerender();
};
ACTIONS['dev-bind-cancel'] = () => { Dev.cap = null; Dev.held = -1; Sound.tick(); devRerender(); };
ACTIONS['dev-bind-reset'] = el => { const kind = el.getAttribute('data-kind'); const S: any = State.settings; if (kind === 'pad') S.padBind = {}; else S.keyBind = {}; Store.save(); Sound.tick(); toast(kind === 'pad' ? 'The controller is back to its usual buttons' : 'The keys are back to their usual keys', 'ok'); devRerender(); };
function devRerender() { try { if (document.querySelector('.dev-page')) rerenderSettingsBody(true); } catch (e) { /* not open */ } }

/* ---------- remembered devices ---------- */
function devRemember(kind: string, name: string) {
  const S: any = State.settings; S.devKnown = S.devKnown || []; const L: any[] = S.devKnown, it = L.filter(x => x.kind === kind && x.name === name)[0];
  if (it) { if (Date.now() - (it.seen || 0) > 60e3) { it.seen = Date.now(); Store.soon(); } } else { L.push({ kind, name, seen: Date.now() }); if (L.length > 24) L.shift(); Store.soon(); }
}
ACTIONS['dev-forget'] = el => { const S: any = State.settings, n = el.getAttribute('data-n'), k = el.getAttribute('data-k'); S.devKnown = (S.devKnown || []).filter((x: any) => !(x.kind === k && x.name === n)); Store.save(); Sound.tick(); devRerender(); };

/* ---------- sound devices ---------- */
function devAudioRefresh() {
  const t = (typeof appTools === 'function') ? appTools() : null;
  if (t && t.audioDevices) { t.audioDevices().then((r: any) => { Dev.audio = (r && r.devices) || []; devPaintAudio(); }).catch(() => { /* none */ }); return; }
  try { navigator.mediaDevices.enumerateDevices().then(ds => { Dev.audio = ds.filter(d => d.kind === 'audiooutput' || d.kind === 'audioinput').map((d, i) => ({ name: d.label || (d.kind === 'audiooutput' ? (d.deviceId === 'default' ? 'Default speakers or headphones' : 'Speakers or headphones ' + (i + 1)) : 'Microphone ' + (i + 1)), type: d.kind === 'audiooutput' ? 'out' : 'in', how: /bluetooth|airpods|buds|wh-|wf-/i.test(d.label) ? 'Bluetooth' : /usb/i.test(d.label) ? 'USB' : '' })); devPaintAudio(); }).catch(() => { /* none */ }); } catch (e) { /* none */ }
}
function devPaintAudio() {
  const el = document.querySelector('[data-dev-audio]') as HTMLElement; if (!el) return;
  const L: any[] = Dev.audio || []; L.forEach(a => devRemember('audio', a.name));
  el.innerHTML = L.length ? L.map(a => `<div class="dev-row"><i class="dev-led on"></i>${icon('volume')}<span><b>${esc(a.name)}</b><small>${a.type === 'in' ? 'Microphone' : 'Sound out'}${a.how ? ' · ' + esc(a.how) : ''}</small></span></div>`).join('')
    : `<p class="muted">No sound devices reported. The ones in use play anyway; names show once the ${DESKTOP ? 'PC' : 'device'} shares them.</p>`;
}

/* ---------- pairing (Android: here; Windows: its Bluetooth settings) ---------- */
ACTIONS['dev-pair'] = () => {
  const t = (typeof appTools === 'function') ? appTools() : null;
  if (DESKTOP) { try { (window as any).open('ms-settings:bluetooth'); } catch (e) { /* none */ } toast('Windows opens its Bluetooth settings: put the controller or headset in pairing mode and add it there', 'info'); return; }
  if (!t || !t.btScan) { toast('Pairing works in the phone app', 'info'); return; }
  Dev.bt = []; Dev.btBusy = true; devRerender(); Sound.tick();
  t.btScan().then((r: any) => { Dev.btBusy = false; Dev.bt = (r && r.devices) || []; if (r && r.error) toast(r.error, 'warn'); devRerender(); }).catch(() => { Dev.btBusy = false; devRerender(); });
};
ACTIONS['dev-pair-one'] = el => {
  const t = appTools(), a = el.getAttribute('data-a'); if (!t || !t.btPair) return; Sound.tick();
  toast('Pairing… confirm on the device if it asks', 'info');
  t.btPair({ address: a }).then((r: any) => { toast(r && r.ok ? 'Paired. Connect it from here or by turning it on' : (r && r.error) || 'It did not pair', r && r.ok ? 'ok' : 'warn'); devRerender(); }).catch(() => { /* none */ });
};
ACTIONS['dev-bt-settings'] = () => { const t = (typeof appTools === 'function') ? appTools() : null; if (t && t.btSettings) t.btSettings(); };

/* ---------- the page ---------- */
function devicesHtml(): string {
  const g = typeof Pad !== 'undefined' ? Pad.gp : null, S: any = State.settings, known: any[] = S.devKnown || [], now = Date.now();
  if (g) devRemember('pad', padName(g));
  const kbOn = now - Dev.seenKb < 10 * 60e3 || DESKTOP, msOn = now - Dev.seenMouse < 10 * 60e3 || DESKTOP;
  if (Dev.seenKb) devRemember('keyboard', 'Keyboard'); if (Dev.seenMouse) devRemember('mouse', 'Mouse');
  const conn = [g ? { k: 'pad', n: padName(g) } : null, kbOn ? { k: 'keyboard', n: 'Keyboard' } : null, msOn ? { k: 'mouse', n: 'Mouse' } : null].filter(Boolean) as any[];
  const away = known.filter(x => x.kind !== 'audio' && !conn.some(c => c.k === x.kind && c.n === x.name));
  const kindIcon = (k: string) => k === 'pad' ? 'play' : k === 'keyboard' ? 'pc' : k === 'mouse' ? 'focus' : 'volume';
  const cap = Dev.cap;
  const padRows = PAD_ACTIONS.map(a => { const on = cap && cap.kind === 'pad' && cap.id === a.id, ch = padBinds()[a.id];
    return `<div class="dev-bind ${on ? 'cap' : ''}"><span><b>${esc(a.name)}</b>${ch ? '<small>Changed</small>' : ''}</span><span class="dev-keys">${on ? '<em>Press a button, or hold one and press another…</em>' : padGlyph(a.id)}</span>${on ? `<button class="btn ghost sm" data-act="dev-bind-cancel">Cancel</button>` : `<button class="btn ghost sm" data-act="dev-bind" data-kind="pad" data-id="${a.id}">Change</button>`}</div>`; }).join('');
  const keyRows = KEY_ACTIONS.map(a => { const on = cap && cap.kind === 'key' && cap.id === a.id, ch = keyBinds()[a.id];
    return `<div class="dev-bind ${on ? 'cap' : ''}"><span><b>${esc(a.name)}</b>${ch ? '<small>Changed</small>' : ''}</span><span class="dev-keys">${on ? '<em>Press a key (or Ctrl, Alt or Shift with a key)…</em>' : `<kbd>${esc(keyName(keyBind(a.id)))}</kbd>`}</span>${on ? `<button class="btn ghost sm" data-act="dev-bind-cancel">Cancel</button>` : `<button class="btn ghost sm" data-act="dev-bind" data-kind="key" data-id="${a.id}">Change</button>`}</div>`; }).join('');
  const padPic = `<div class="dev-pad" data-dev-pad>${PAD_BTN.map((b, i) => `<kbd class="pg pg-${i}" data-pb="${i}" title="${esc(b[0])}">${esc(b[1])}</kbd>`).join('')}<i class="dev-stick l" data-ps="l"></i><i class="dev-stick r" data-ps="r"></i></div>`;
  setTimeout(() => { devLive(); devAudioRefresh(); }, 30);
  return `<div class="dev-page">
    <div class="set-card col"><div class="sc-h">${icon('play')}<span><b>Connected</b><small>What the game sees now. Devices it has seen before stay listed below while they are away.</small></span></div>
      ${conn.map(c => `<div class="dev-row"><i class="dev-led on"></i>${icon(kindIcon(c.k))}<span><b>${esc(c.n)}</b><small>Connected</small></span></div>`).join('') || '<p class="muted">Nothing yet: press a button on a controller, a key or move the mouse.</p>'}
      ${away.length ? `<div class="dev-sub">Remembered, not connected now</div>${away.map(x => `<div class="dev-row away"><i class="dev-led"></i>${icon(kindIcon(x.kind))}<span><b>${esc(x.name)}</b><small>Last seen ${esc(dateStr(new Date(x.seen)))}</small></span><button class="btn ghost sm" data-act="dev-forget" data-k="${x.kind}" data-n="${esc(x.name)}">Forget</button></div>`).join('')}` : ''}
      <div class="dev-pairbar"><button class="btn primary sm" data-act="dev-pair">${icon('plus')}${DESKTOP ? 'Pair a controller or headset (Windows Bluetooth)' : 'Find and pair a wireless controller or headset'}</button>${!DESKTOP ? `<button class="btn ghost sm" data-act="dev-bt-settings">Bluetooth settings</button>` : ''}</div>
      ${Dev.btBusy ? '<p class="muted">Looking for devices in pairing mode… (about 12 seconds)</p>' : ''}
      ${(Dev.bt || []).map((d: any) => `<div class="dev-row"><i class="dev-led ${d.bonded ? 'on' : ''}"></i>${icon(/head|bud|pod|ear|wh-|wf-/i.test(d.name || '') ? 'volume' : 'play')}<span><b>${esc(d.name || 'Unnamed device')}</b><small>${d.bonded ? 'Paired' : 'Ready to pair'}</small></span>${d.bonded ? '' : `<button class="btn ghost sm" data-act="dev-pair-one" data-a="${esc(d.address)}">Pair</button>`}</div>`).join('')}
    </div>
    <div class="set-card col"><div class="sc-h">${icon('focus')}<span><b>Live</b><small>Press anything: it lights up here.</small></span></div>
      ${padPic}
      <div class="dev-live"><span>Keys: <b data-dev-keys>–</b></span><span>Mouse: <i class="dev-mb" data-mb="0">Left</i><i class="dev-mb" data-mb="1">Middle</i><i class="dev-mb" data-mb="2">Right</i></span></div></div>
    <div class="set-card col"><div class="sc-h">${icon('play')}<span><b>Controller buttons</b><small>Change what a button does, or make a combination: hold one button and press another. The button hints in the game follow these.</small></span></div>
      ${padRows}<div class="dev-pairbar"><button class="btn ghost sm" data-act="dev-bind-reset" data-kind="pad">Back to the usual buttons</button></div></div>
    <div class="set-card col"><div class="sc-h">${icon('pc')}<span><b>Keyboard and mouse</b><small>Change the keys for walking and the rest, on the PC and on Android with a keyboard. A combination: Ctrl, Alt or Shift with a key.</small></span></div>
      ${keyRows}
      <label class="tg-row"><span><b>Invert looking up and down (mouse)</b><small>Moving the mouse up looks down.</small></span><button class="tg ${S.mouseInvertY ? 'on' : ''}" role="switch" aria-checked="${!!S.mouseInvertY}" data-act="pad-opt" data-key="mouseInvertY" data-d="0"><i></i></button></label>
      <div class="sc-h" style="margin-top:8px"><span><b class="ms-sp-h">Mouse look speed: ${Math.round((+S.mouseLook || 1) * 100)}%</b></span></div><input type="range" class="ms-sp" min="0.3" max="2.5" step="0.1" value="${+S.mouseLook || 1}" aria-label="Mouse look speed">
      <div class="dev-pairbar"><button class="btn ghost sm" data-act="dev-bind-reset" data-kind="key">Back to the usual keys</button></div></div>
    <div class="set-card col"><div class="sc-h">${icon('volume')}<span><b>Sound devices</b><small>Speakers, headphones and headsets, by cable, USB or Bluetooth.</small></span></div><div data-dev-audio><p class="muted">Looking…</p></div></div>
    ${typeof padSettingsHtml === 'function' ? padSettingsHtml() : ''}
  </div>`;
}
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('ms-sp')) return; (State.settings as any).mouseLook = +el.value; const h = document.querySelector('.ms-sp-h'); if (h) h.textContent = `Mouse look speed: ${Math.round(+el.value * 100)}%`; });
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (el && el.classList && el.classList.contains('ms-sp')) Store.save(); });
/** The live picture while the page is open: buttons, sticks, keys and mouse buttons as you press them. */
function devLive() {
  if (Dev.raf) return;
  const step = () => {
    const page = document.querySelector('.dev-page'); if (!page) { Dev.raf = 0; return; }
    Dev.raf = requestAnimationFrame(step);
    const g: any = typeof Pad !== 'undefined' ? Pad.gp : null;
    page.querySelectorAll('[data-pb]').forEach((k: any) => { const i = +k.getAttribute('data-pb'); k.classList.toggle('on', !!(g && g.buttons[i] && g.buttons[i].pressed)); });
    if (g) { const st = (sel: string, x: number, y: number) => { const s = page.querySelector(sel) as HTMLElement; if (s) s.style.transform = `translate(${(x || 0) * 9}px, ${(y || 0) * 9}px)`; }; st('[data-ps=l]', g.axes[0], g.axes[1]); st('[data-ps=r]', g.axes[2], g.axes[3]); }
    const kk = page.querySelector('[data-dev-keys]') as HTMLElement; if (kk) { const t = Object.keys(Dev.keys).map(k => keyName({ k })).join(' + ') || '–'; if (kk.textContent !== t) kk.textContent = t; }
    page.querySelectorAll('[data-mb]').forEach((m: any) => m.classList.toggle('on', !!Dev.mouse[+m.getAttribute('data-mb')]));
  };
  Dev.raf = requestAnimationFrame(step);
}
