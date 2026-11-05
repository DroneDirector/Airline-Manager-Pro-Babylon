// The app on Windows (opened by the PC app): the same screens, scaled to the window. Everything grows
// with the window height, keeping its proportions, and the layouts use the extra width, so wide,
// ultrawide and super-ultrawide screens are filled without stretching anything. Settings → Display has
// the display mode, the resolution, anti-aliasing, the size of everything, the graphics card and the sound output.

const Desk = {
  prefs: null as any,
  gpus: [] as { name: string; vendor: string; kind: string; vramMb: number }[],
  outputs: [] as MediaDeviceInfo[],

  init() {
    if (!DESKTOP) return;
    document.documentElement.classList.add('desktop');
    const fit = () => {
      const k = (+(State.settings as any).uiSize || 1) * (+(State.settings as any).textSize || 1);
      const z = clamp(Math.min(innerHeight / 560, innerWidth / 980), 0.8, 6) * k;   // narrow screens (4:3, 5:4) by their width, wide ones by their height
      (window as any).__uiZoom = z;
      (document.documentElement.style as any).zoom = String(z);
      // the page is scaled by z, so a screen-sized length is the window divided by z (otherwise windows sized to the
      // screen end up z times too big and run off it)
      document.documentElement.style.setProperty('--vh', (innerHeight / z / 100) + 'px');
      document.documentElement.style.setProperty('--vw', (innerWidth / z / 100) + 'px');
    };
    fit(); window.addEventListener('resize', fit); (window as any).__deskFit = fit;
    fetch('/api/desktop').then(r => r.json()).then(p => { this.prefs = p; }).catch(() => { /* PC app older */ });
    fetch('/api/gpus').then(r => r.json()).then(r => { this.gpus = r.gpus || []; }).catch(() => { /* none */ });
    this.applySink();
    // F11 and Esc work as in any Windows app
    document.addEventListener('keydown', e => { if (e.key === 'F11') { e.preventDefault(); this.toggleFullscreen(); } });
  },

  save(p: any) {
    this.prefs = Object.assign(this.prefs || {}, p);
    fetch('/api/desktop', { method: 'PUT', body: JSON.stringify(p) }).catch(() => { /* PC app closed */ });
  },

  toggleFullscreen(on?: boolean) {
    const d: any = document, fs = !!d.fullscreenElement;
    const want = on == null ? !fs : on;
    try { if (want && !fs) d.documentElement.requestFullscreen({ navigationUI: 'hide' }); else if (!want && fs) d.exitFullscreen(); } catch (e) { /* not allowed here */ }
  },

  /** Sound outputs connected to Windows. Their names are only shown once the app may use audio devices. */
  async listOutputs(ask?: boolean) {
    const md = navigator.mediaDevices; if (!md || !md.enumerateDevices) return [];
    let list = (await md.enumerateDevices()).filter(d => d.kind === 'audiooutput');
    if (ask && list.every(d => !d.label)) {
      try { const s = await md.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); } catch (e) { /* declined */ }
      list = (await md.enumerateDevices()).filter(d => d.kind === 'audiooutput');
    }
    this.outputs = list;
    return list;
  },

  /** Send the app's sounds to the chosen device (speakers, headphones, Bluetooth…). */
  applySink() {
    const id = (State.settings as any).audioOut || '';
    const ctx: any = (typeof _ctx !== 'undefined') ? _ctx : null;
    if (ctx && ctx.setSinkId) ctx.setSinkId(id === 'default' ? '' : id).catch(() => { /* gone */ });
    (window as any).__audioSink = id;
  },
};

/* ---------- resolution ----------
 * The screen's own resolution and shape are read from Windows (through the browser). Windowed: the window takes
 * the chosen size (kept for the next start). Borderless and full screen: the app always fills the screen in its
 * own shape, ultrawide and super-ultrawide included, and the resolution sets how many pixels the 3D views are
 * drawn with (fewer is quicker, more is sharper), as a game's render resolution does. */
const DESK_RES: { g: string; r: number[][] }[] = [
  { g: '4:3', r: [[1024, 768], [1280, 960], [1600, 1200], [2048, 1536]] },
  { g: '5:4', r: [[1280, 1024]] },
  { g: '16:10', r: [[1280, 800], [1440, 900], [1680, 1050], [1920, 1200], [2560, 1600], [3840, 2400]] },
  { g: '16:9', r: [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440], [3200, 1800], [3840, 2160], [5120, 2880]] },
  { g: '21:9 ultrawide', r: [[2560, 1080], [3440, 1440], [3840, 1600], [5120, 2160]] },
  { g: '24:10 ultrawide', r: [[3840, 1600], [5760, 2400]] },
  { g: '32:9 super ultrawide', r: [[3840, 1080], [5120, 1440], [7680, 2160]] },
  { g: '32:10 super ultrawide', r: [[3840, 1200]] },
];
function deskScreen(): { w: number; h: number; name: string } {
  const d = window.devicePixelRatio || 1, w = Math.round(screen.width * d), h = Math.round(screen.height * d), a = w / h;
  const name = a >= 3.4 ? '32:9 super ultrawide' : a >= 3.0 ? '32:10 super ultrawide' : a >= 2.3 ? '21:9 ultrawide' : a >= 1.7 ? '16:9' : a >= 1.5 ? '16:10' : a >= 1.3 ? '4:3' : '5:4';
  return { w, h, name };
}
/** The chosen resolution in pixels ([0, 0] = the screen's own). */
function deskRes(): number[] { const v = String((State.settings as any).deskRes || 'native'); const m = /^(\d+)x(\d+)$/.exec(v); return m ? [+m[1], +m[2]] : [0, 0]; }
/** How many pixels the 3D views are drawn with, compared with the screen's own (1 = the screen's). */
function deskRenderScale(): number {
  if (!DESKTOP) return 1;
  const r = deskRes(); if (!r[0]) return 1;
  const mode = (Desk.prefs && Desk.prefs.mode) || 'window';
  if (mode === 'window') return 1;   // the window itself has that size
  const sc = deskScreen(); return clamp(Math.sqrt(r[0] * r[1] / (sc.w * sc.h)), 0.35, 2);
}
/** Windowed: the window takes the chosen size (in the screen's middle), and opens at that size next time. */
function deskApplyRes() {
  const r = deskRes(), d = window.devicePixelRatio || 1, sc = deskScreen();
  const w = r[0] ? r[0] : sc.w, h = r[0] ? r[1] : sc.h;
  const cw = Math.min(Math.round(w / d), screen.availWidth), ch = Math.min(Math.round(h / d), screen.availHeight);
  Desk.save({ width: cw, height: ch });
  if (((Desk.prefs && Desk.prefs.mode) || 'window') !== 'window') return;
  try { window.resizeTo(cw, ch); window.moveTo(Math.max(0, Math.round((screen.availWidth - cw) / 2)), Math.max(0, Math.round((screen.availHeight - ch) / 2))); } catch (e) { /* the next start */ }
}
ACTIONS['desk-res'] = el => {
  const v = el.getAttribute('data-v') || (el as any).value || 'native';
  (State.settings as any).deskRes = v; Store.save(); Sound.tick(); deskApplyRes(); rerenderSettingsBody();
  const mode = (Desk.prefs && Desk.prefs.mode) || 'window';
  if (mode !== 'window' && v !== 'native') toast('The 3D views are drawn at this resolution from the next time you open them', 'info');
};
document.addEventListener('change', e => { const el = e.target as HTMLSelectElement; if (el && el.classList && el.classList.contains('desk-res-sel')) ACTIONS['desk-res'](el as any, null as any); });

/** Edge smoothing in the 3D views on the PC: 0 off, 1 standard (multisampling), 2 high (multisampling, drawn
 *  1.25× larger), 3 very high (1.5×), 4 ultra (2×, the smoothest edges; for strong graphics cards). */
const DESK_AA_NAMES = ['Off', 'Standard', 'High', 'Very high', 'Ultra'];
function deskAA(): number { const v = (State.settings as any).deskAA; return v == null ? 1 : clamp(Math.round(+v), 0, 4); }
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('desk-aa')) return; const h = el.closest('.set-card') && el.closest('.set-card').querySelector('.daa-h'); if (h) h.textContent = 'Anti-aliasing: ' + DESK_AA_NAMES[+el.value]; });
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('desk-aa')) return;
  (State.settings as any).deskAA = +el.value; Store.save(); rerenderSettingsBody();
  toast(V3d.open ? 'Anti-aliasing changes the next time you open the 3D view' : 'Anti-aliasing saved: used in the 3D view', 'info');
});

ACTIONS['desk-mode'] = el => {
  const m = el.getAttribute('data-v'); Sound.tick();
  Desk.save({ mode: m });
  if (m === 'window') { Desk.toggleFullscreen(false); setTimeout(deskApplyRes, 400); } else Desk.toggleFullscreen(true);
  rerenderSettingsBody();
  if (m === 'fullscreen') toast('Full screen now; from the next start the app opens in full screen with no window around it', 'info');
};
ACTIONS['desk-size'] = el => { (State.settings as any).uiSize = el.getAttribute('data-v'); Store.save(); Sound.tick(); const f = (window as any).__deskFit; if (f) f(); rerenderSettingsBody(); };
ACTIONS['desk-gpu'] = el => { Desk.save({ gpu: el.getAttribute('data-v') }); Sound.tick(); rerenderSettingsBody(); toast('The graphics card is used from the next time the app opens', 'info'); };
ACTIONS['desk-open'] = el => { Desk.save({ open: !(Desk.prefs && Desk.prefs.open) }); Sound.tick(); rerenderSettingsBody(); };
ACTIONS['desk-audio-find'] = () => { Desk.listOutputs(true).then(() => rerenderSettingsBody()); };
ACTIONS['desk-audio'] = el => { (State.settings as any).audioOut = el.getAttribute('data-v'); Store.save(); Desk.applySink(); Sound.tick(); rerenderSettingsBody(); };

/** The resolution card: your screen, the choice (grouped by shape, up to your screen's size), and a quick match. */
function deskResHtml(mode: string): string {
  const sc = deskScreen(), cur = String((State.settings as any).deskRes || 'native'), r = deskRes();
  const fits = (w: number, h: number) => w <= sc.w * 1.001 && h <= sc.h * 1.001;
  const groups = DESK_RES.map(g => ({ g: g.g, r: g.r.filter(x => (fits(x[0], x[1]) || cur === x[0] + 'x' + x[1]) && !(x[0] === sc.w && x[1] === sc.h)) })).filter(g => g.r.length);
  const opts = `<option value="native" ${cur === 'native' ? 'selected' : ''}>Match my screen: ${sc.w} × ${sc.h} (${sc.name})</option>`
    + groups.map(g => `<optgroup label="${esc(g.g)}">${g.r.map(x => `<option value="${x[0]}x${x[1]}" ${cur === x[0] + 'x' + x[1] ? 'selected' : ''}>${x[0]} × ${x[1]}</option>`).join('')}</optgroup>`).join('');
  const shape = r[0] ? r[0] / r[1] : sc.w / sc.h, off = Math.abs(shape / (sc.w / sc.h) - 1) > 0.04;
  const wide = sc.w / sc.h >= 2.3;
  const how = mode === 'window' ? 'Windowed: the window takes this size, in the middle of the screen, and opens at that size next time.'
    : 'Borderless and full screen: the app always fills your whole screen in its own shape; the resolution sets how many pixels the 3D views are drawn with (lower is quicker, higher is sharper).';
  return `<div class="set-card col"><div class="sc-h">${icon('pc')}<span><b>Resolution</b><small>Your screen: ${sc.w} × ${sc.h}, ${sc.name}. ${how} Ultrawide and super-ultrawide screens are filled edge to edge: the map, the 3D views and the pages use the extra width.</small></span></div>
      <select class="le-in desk-res-sel" aria-label="Resolution">${opts}</select>
      ${cur !== 'native' && (off || wide) ? `<div class="desk-res-tip">${icon('info')}<span>${off ? 'This resolution has a different shape from your screen.' : 'Your screen is ' + esc(sc.name) + '.'} Matching it makes everything fit best.</span><button class="btn sm" data-act="desk-res" data-v="native">Match my screen</button></div>` : ''}</div>`;
}

/** Settings → Display, on the PC only. */
function desktopSettingsHtml(): string {
  const p = Object.assign({ mode: 'window', gpu: 'auto', open: true }, Desk.prefs || {}), S: any = State.settings;
  const seg = (act: string, cur: string, opts: string[][]) => `<div class="seg">${opts.map(o => `<button class="${cur === o[0] ? 'on' : ''}" data-act="${act}" data-v="${esc(o[0])}">${esc(o[1])}</button>`).join('')}</div>`;
  const gpus = Desk.gpus;
  const outs = Desk.outputs.length ? Desk.outputs : [];
  return `
    <div class="ch-row"><span><b>Display mode</b><small>Windowed: a normal window you can move and resize. Borderless: fills the screen with no frame, and switching to Flight Simulator or other programs is instant. Full screen: the app takes the whole screen like a game, and opens that way at every start. Press F11 to switch at any time.</small></span>${seg('desk-mode', p.mode, [['window', 'Windowed'], ['borderless', 'Borderless'], ['fullscreen', 'Full screen']])}</div>
    ${deskResHtml(p.mode)}
    <div class="set-card col"><div class="sc-h">${icon('layers')}<span><b class="daa-h">Anti-aliasing: ${DESK_AA_NAMES[deskAA()]}</b><small>Smooths the jagged edges in the 3D views. Standard uses multisampling. High, Very high and Ultra also draw the picture larger and scale it down (1.25×, 1.5× and 2×) for the smoothest edges, the finest lines and the sharpest distance.</small></span></div>
      <input type="range" class="desk-aa" min="0" max="4" step="1" value="${deskAA()}" aria-label="Anti-aliasing">
      <div class="v3d-scale"><span>Off</span><span>Standard</span><span>High</span><span>Very high</span><span>Ultra</span></div>
      ${deskAA() >= 3 ? `<p class="v3d-note warn">${icon('alert')}Very high settings might affect performance: the 3D view draws up to four times as many pixels, so it needs a strong graphics card.</p>` : deskAA() === 0 ? `<p class="v3d-note ok">${icon('info')}Low settings might improve performance on slower PCs.</p>` : ''}</div>
    <div class="ch-row"><span><b>Size of everything</b><small>Everything scales with the window and keeps its shape, from small windows to super-ultrawide screens.</small></span>${seg('desk-size', String(S.uiSize || '1'), [['0.85', 'Smaller'], ['1', 'Normal'], ['1.15', 'Larger'], ['1.3', 'Largest']])}</div>
    <div class="ch-row"><span><b>Graphics card</b><small>${gpus.length ? gpus.map(g => esc(g.name) + (g.vramMb > 0 ? ` (${g.vramMb >= 1024 ? Math.round(g.vramMb / 1024) + ' GB' : g.vramMb + ' MB'})` : '')).join(', ') : 'The graphics cards in this PC'}. Takes effect the next time the app opens.</small></span>
      ${seg('desk-gpu', p.gpu, [['auto', 'Windows decides']].concat(gpus.some(g => g.kind === 'dedicated') ? [['high', gpus.filter(g => g.kind === 'dedicated')[0].name.replace(/^(NVIDIA|AMD)\s+/i, '')]] : [['high', 'High performance']]).concat(gpus.some(g => g.kind === 'integrated') ? [['low', gpus.filter(g => g.kind === 'integrated')[0].name.replace(/^Intel\(R\)\s+/i, '')]] : [['low', 'Power saving']]))}</div>
    <div class="ch-row"><span><b>Sound output</b><small>${outs.length && outs.some(o => o.label) ? 'Speakers, headphones and Bluetooth devices connected to Windows.' : 'Find the speakers, headphones and Bluetooth devices connected to Windows. Windows may show the microphone symbol for a moment while the list is read.'}</small></span>
      ${outs.some(o => o.label) ? seg('desk-audio', S.audioOut || 'default', outs.map(o => [o.deviceId, o.label || 'Device'])) : `<button class="btn ghost sm" data-act="desk-audio-find">${icon('volume')}Find devices</button>`}</div>
    <div class="ch-row"><span><b>Open when the PC app starts</b><small>Turn off to use only the phone with the PC app.</small></span><button class="tg ${p.open !== false ? 'on' : ''}" data-act="desk-open" role="switch" aria-checked="${p.open !== false}"><i></i></button></div>`;
}
