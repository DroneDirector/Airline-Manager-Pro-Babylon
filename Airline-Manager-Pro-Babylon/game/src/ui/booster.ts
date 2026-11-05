/* Game Booster (Settings → Game Booster). Off unless switched on; the choice is kept by the app and by the
 * device (the phone remembers it natively, the PC app in its own settings), so it is back in force at the
 * next start. When on:
 *  - the 3D view runs at up to 60 pictures a second on the fast graphics chip, and while it is open the map
 *    behind it stops drawing and caches are trimmed, so the device's time and memory go to the view;
 *  - on the phone: the screen stays on, the processor is held at a steady sustained speed where the phone
 *    supports it, and the app is a game to Android, so the system's own game mode and the phone maker's
 *    game booster can run it in performance mode;
 *  - on the PC: the app window runs on the high-performance graphics card with nothing slowed down in the
 *    background, and the PC app and its window run at a higher priority than other programs.
 * It gives the app every resource the system allows; no app can take memory from the system itself. */

function gameBoost(): boolean { return !!(State.settings as any).gameBoost; }
function fullScreenOn(): boolean { return (State.settings as any).fullScreen !== false; }

/** The device's own side: the phone's native settings, or the PC app's. Called at start and on every change. */
function boosterSync(): Promise<any> {
  boostStatsStart();
  try {
    if (typeof DESKTOP !== 'undefined' && DESKTOP) { Desk.save({ boost: gameBoost() }); return Promise.resolve({ pc: true }); }
    const t = appTools(); if (!t || !t.display) return Promise.resolve(null);
    return t.display({ fullScreen: fullScreenOn(), boost: gameBoost(), gameLock: (State.settings as any).gameLock === true }).then((r: any) => { (window as any).__boostInfo = r; return r; }).catch(() => null);
  } catch (e) { return Promise.resolve(null); }
}
/** Memory the app can give back at once: pictures and caches that are made again when needed. */
function boosterTrim() {
  try { if (typeof Clouds2d !== 'undefined' && Clouds2d.cv) { for (const c of Clouds2d.cv) { c.width = 1; c.height = 1; } Clouds2d.cv = null; Clouds2d.key = ''; } } catch (e) { /* nothing to trim */ }
  try { const m: any = _curMap(); if (m && m.scenes) for (const k of Object.keys(m.scenes)) { const sc = m.scenes[k]; if (sc && sc.timedCache) sc.timedCache = null; } } catch (e) { /* nothing to trim */ }
}

ACTIONS['boost-toggle'] = () => {
  const S: any = State.settings; S.gameBoost = !S.gameBoost; Store.save();
  try { if (S.gameBoost) { Haptics.success(); boosterTrim(); } else Sound.tick(); } catch (e) { /* quiet */ }
  boosterSync().then(() => rerenderSettingsBody());
  const el = document.querySelector('.boost-hero'); if (el) { el.classList.toggle('on', !!S.gameBoost); if (S.gameBoost) { el.classList.remove('surge'); void (el as HTMLElement).offsetWidth; el.classList.add('surge'); } }
  boostAnim();
};
ACTIONS['gamelock-toggle'] = () => { const S: any = State.settings; S.gameLock = S.gameLock !== true; Store.save(); Sound.tick(); boosterSync(); rerenderSettingsBody(); if (S.gameLock) toast('Android asks once to pin the app: confirm it. To leave, hold Back and Recents, or swipe up and hold', 'info'); };
ACTIONS['fullscreen-toggle'] = () => { const S: any = State.settings; S.fullScreen = S.fullScreen === false; Store.save(); Sound.tick(); boosterSync(); rerenderSettingsBody(); };

/** The Game Booster page: an engine core that spins up, speed lines, a surge of sparks and a gauge filling to full. */
function boosterHtml(): string {
  const on = gameBoost(), info: any = (window as any).__boostInfo || {}, pc = typeof DESKTOP !== 'undefined' && DESKTOP;
  const facts = pc
    ? ['The programs you tick below are closed while you play, and kept closed until you switch the booster off or close the app', 'The app window on the high-performance graphics card', 'Nothing in the window slowed down in the background', 'The PC app and its window at a higher priority than other programs', '3D view at up to 60 pictures a second']
    : ['3D view at up to 60 pictures a second on the fast graphics chip', 'The screen stays on while you play', info.sustained ? 'The processor held at a steady, sustained speed (this phone supports it)' : 'Steady processor speed where the phone supports it', 'A game to Android: the system\'s game mode and your phone\'s game booster can run it in performance mode', 'Up to Android 13: other apps running in the background are closed every 30 seconds while the app is open'];
  const mode = ['', 'Standard', 'Performance', 'Battery saving'][info.gameMode || 0];
  return `<div class="boost-hero ${on ? 'on' : ''}${State.settings.reduceMotion ? ' calm' : ''}">
      <canvas class="boost-cv" aria-hidden="true"></canvas>
      <div class="boost-core"><div class="bc-ring r1"></div><div class="bc-ring r2"></div><div class="bc-ring r3"></div>
        <div class="bc-fan">${Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * (360 / 14)}deg"></i>`).join('')}</div><div class="bc-hub"></div></div>
      <div class="boost-side">
        <b class="boost-title">GAME BOOSTER</b>
        <span class="boost-state">${on ? 'BOOST ACTIVE' : 'Standby'}</span>
        <div class="boost-gauge"><i></i></div>
        <button class="boost-btn" data-act="boost-toggle" role="switch" aria-checked="${on}">${icon('power')}<span>${on ? 'Turn off' : 'Boost'}</span></button>
      </div>
    </div>
    ${boostStatsHtml()}
    <div class="set-card col"><div class="sc-h">${icon('info')}<span><b>What it does</b><small>Off unless you switch it on. Your choice is remembered by the app and by this ${pc ? 'PC' : 'device'}, so the boost is back the next time you open the app.</small></span></div>
      <ul class="boost-list">${facts.map(f => `<li>${icon('check')}${esc(f)}</li>`).join('')}<li>${icon('check')}While the 3D view is open, the map behind it stops drawing and caches are trimmed, so the time and memory go to the view</li></ul>
      ${mode ? `<small class="muted">Android's game mode for this app right now: ${mode}. You can change it in your phone's game settings.</small>` : ''}
      <p class="v3d-note">${icon('info')}It gives the app every resource ${pc ? 'Windows' : 'Android'} allows, but no app can take memory away from the system itself. More speed uses more battery and makes the ${pc ? 'computer' : 'phone'} warmer.</p></div>`;
}

/** The particles behind the core: drifting slowly in standby, streaking past at speed when boosted. */
function boostAnim() {
  const cv = document.querySelector('.boost-cv') as HTMLCanvasElement; if (!cv || (cv as any)._run) return;
  (cv as any)._run = true;
  const g = cv.getContext('2d'); if (!g) return;
  const P: number[][] = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random()]);
  let speed = gameBoost() ? 1 : 0.06, last = performance.now();
  const step = (now: number) => {
    if (!cv.isConnected) { (cv as any)._run = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const want = gameBoost() ? 1 : 0.06; speed += (want - speed) * Math.min(1, dt * 1.6);
    const calm = State.settings.reduceMotion;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const cx = w * 0.3, cy = h * 0.5;
    for (const p of P) {
      p[0] += dt * (0.05 + p[2] * 0.6) * speed * (calm ? 0.2 : 1);
      if (p[0] > 1) { p[0] -= 1; p[1] = Math.random(); }
      // from the core outwards along rays, faster further out, like being pulled into a jet intake in reverse
      const a = p[1] * Math.PI * 2, r = Math.pow(p[0], 1.6) * Math.max(w, h) * 0.9, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.6;
      const len = 2 + speed * (6 + p[2] * 34) * p[0];
      const hue = gameBoost() ? 185 + p[2] * 50 : 205;
      g.strokeStyle = `hsla(${hue}, 100%, ${60 + p[2] * 25}%, ${(0.15 + 0.7 * p[0]) * (0.35 + speed * 0.65)})`;
      g.lineWidth = 1 + p[2] * 1.6 * speed;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len * 0.6); g.stroke();
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- Live readings and charts ----------
 * Taken every 2 seconds while the Game Booster page is open, and every 10 seconds in the background while the
 * booster is on (so the charts show the last minutes of play when you come back to them).
 *  - PC: processor, memory, graphics card, graphics memory and disk from the PC app; the programs it closed.
 *  - Phone: memory, processor speed, temperature; background apps closed (Android 13 and older).
 *  - Both: the 3D view's frame rate and the app's own memory. */
const BoostLive: any = { hist: [] as any[], pc: null as any, procs: null as any[], procsBusy: false, timer: 0, tick: 0, lastFrames: 0, lastT: 0 };

function boostStatsStart() { if (BoostLive.timer) return; BoostLive.timer = setInterval(() => { try { boostSample(); } catch (e) { /* next time */ } }, 2000); }
function boostPageOpen(): boolean { const el = document.querySelector('.boost-stats'); return !!(el && el.isConnected); }
function boostIsPc(): boolean { return typeof DESKTOP !== 'undefined' && !!DESKTOP; }

function boostSample() {
  const page = boostPageOpen(), on = gameBoost(); BoostLive.tick++;
  if (!page && !on) { BoostLive.lastT = 0; return; }
  if (!page && BoostLive.tick % 5) return;
  const now = performance.now(), V: any = typeof V3d !== 'undefined' ? V3d : null;
  let fps: number = null;
  if (V && V.open && BoostLive.lastT && now > BoostLive.lastT) fps = Math.max(0, Math.round(((V.frames || 0) - BoostLive.lastFrames) * 1000 / (now - BoostLive.lastT)));
  BoostLive.lastFrames = (V && V.frames) || 0; BoostLive.lastT = now;
  const pm: any = (performance as any).memory;
  const s: any = { t: Date.now(), fps, heap: pm ? Math.round(pm.usedJSHeapSize / 1048576) : null };
  BoostLive.hist.push(s); if (BoostLive.hist.length > 300) BoostLive.hist.splice(0, BoostLive.hist.length - 300);
  if (boostIsPc()) {
    if (on) fetch('/api/boost/alive', { method: 'POST' }).catch(() => { /* PC app closed */ });
    if (page) fetch('/api/boost').then(r => r.json()).then(j => { BoostLive.pc = j; boostDraw(); }).catch(() => boostDraw());
    return;
  }
  const t = appTools();
  if (t && t.boostStats) t.boostStats().then((r: any) => { Object.assign(s, r || {}); if (page) boostDraw(); }).catch(() => { if (page) boostDraw(); });
  else if (page) boostDraw();
}

/** The charts: [key, title, unit, fixed top of the scale or 0 for automatic]. */
function boostCharts(): [string, string, string, number][] {
  return boostIsPc()
    ? [['cpu', 'Processor', '%', 100], ['ram', 'Memory (RAM)', 'GB', 0], ['gpu', 'Graphics card', '%', 100], ['vram', 'Graphics memory', 'GB', 0], ['disk', 'Disk', '%', 100], ['fps', 'Frame rate, 3D view', 'fps', 60], ['heap', 'App memory', 'MB', 0]]
    : [['mem', 'Memory (RAM)', 'GB', 0], ['cpuSpeed', 'Processor speed', '%', 100], ['temp', 'Temperature', '°C', 0], ['fps', 'Frame rate, 3D view', 'fps', 60], ['appMb', 'App memory', 'MB', 0]];
}

/** One chart's readings, oldest first: [time, value or null]. */
function boostSeries(k: string): [number, number][] {
  const out: [number, number][] = [];
  if (boostIsPc() && /^(cpu|ram|gpu|vram|disk)$/.test(k)) {
    for (const h of (BoostLive.pc && BoostLive.pc.hist) || []) out.push([h.t, k === 'vram' ? (h.vramMb == null ? null : Math.round(h.vramMb / 102.4) / 10) : k === 'ram' ? (h.ramUsedMb == null ? null : h.ramUsedMb / 1024) : h[k]]);
    return out;
  }
  for (const h of BoostLive.hist) {
    let v: number = null;
    if (k === 'mem') v = h.memTotalMb ? (h.memTotalMb - h.memAvailMb) / 1024 : null;
    else if (k === 'temp') v = h.battTemp != null ? h.battTemp : null;
    else v = h[k] == null ? null : h[k];
    out.push([h.t, v]);
  }
  return out;
}

function boostSub(k: string, last: any): string {
  const pc = BoostLive.pc, ph = BoostLive.hist[BoostLive.hist.length - 1] || {};
  if (k === 'cpu' && pc) return `${pc.cores} cores${pc.cpuName ? ' · ' + pc.cpuName : ''}`;
  if (k === 'ram' && pc && pc.hist.length) { const h = pc.hist[pc.hist.length - 1]; return `${Math.round(100 * h.ramUsedMb / Math.max(1, h.ramTotalMb))}% in use · ${((h.ramTotalMb - h.ramUsedMb) / 1024).toFixed(1)} GB free`; }
  if (k === 'gpu') return 'Drawing (3D) across all programs';
  if (k === 'vram') return 'In use on the graphics card';
  if (k === 'disk') return 'Time the disks are busy';
  if (k === 'fps') return (typeof V3d !== 'undefined' && V3d.open) ? 'While the 3D view is open' : 'Shown while the 3D view is open';
  if (k === 'heap' || k === 'appMb') return 'Used by this app';
  if (k === 'mem' && ph.memTotalMb) return `${Math.round(100 * (ph.memTotalMb - ph.memAvailMb) / ph.memTotalMb)}% in use · ${(ph.memAvailMb / 1024).toFixed(1)} GB free${ph.lowMem ? ' · memory is low' : ''}`;
  if (k === 'cpuSpeed') return ph.cores ? `${ph.cores} cores, against their top speed` : 'Against the top speed';
  if (k === 'temp') { const th = ['Cool', 'Light warming', 'Warm', 'Hot: the phone slows down', 'Very hot', 'Critical', 'Shutting down'][ph.thermal]; return `Battery${th ? ' · ' + th : ''}${ph.headroom != null ? ` · ${ph.headroom}% to the slow-down point` : ''}`; }
  return '';
}

/** A line chart as SVG: thin line, faint area, the latest point marked. */
function boostSvg(d: [number, number][], top: number): string {
  const W = 300, H = 74, pts = d.filter(p => p[1] != null);
  if (pts.length < 2) return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" y1="${H - 1}" x2="${W}" y2="${H - 1}" class="bs-base"/></svg>`;
  const t0 = d[0][0], t1 = d[d.length - 1][0] || t0 + 1, mx = top || Math.max(1, ...pts.map(p => p[1])) * 1.15;
  const X = (t: number) => (t - t0) / Math.max(1, t1 - t0) * W, Y = (v: number) => H - 3 - Math.min(1, v / mx) * (H - 8);
  let line = '', run: string[] = [];
  const flush = () => { if (run.length) { line += 'M' + run.join('L'); run = []; } };
  for (const p of d) { if (p[1] == null) flush(); else run.push(`${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`); }
  flush();
  const a = pts[0], z = pts[pts.length - 1];
  const area = `M${X(a[0]).toFixed(1)},${H}L` + pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('L') + `L${X(z[0]).toFixed(1)},${H}Z`;
  const grid = [0.5].map(f => `<line x1="0" x2="${W}" y1="${(H - 3 - f * (H - 8)).toFixed(1)}" y2="${(H - 3 - f * (H - 8)).toFixed(1)}" class="bs-gl"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<line x1="0" y1="${H - 1}" x2="${W}" y2="${H - 1}" class="bs-base"/><path d="${area}" class="bs-area"/><path d="${line}" class="bs-line"/></svg>
    <i class="bs-dot" style="left:${(X(z[0]) / W * 100).toFixed(2)}%;top:${(Y(z[1]) / H * 100).toFixed(2)}%"></i>`;
}

/** All the memory there is (GB), for the memory chart: its top is the whole of it. */
function boostRamTotal(k: string): number {
  if (k === 'ram') { const pc = BoostLive.pc, h = pc && pc.hist && pc.hist[pc.hist.length - 1]; return h && h.ramTotalMb ? h.ramTotalMb / 1024 : 0; }
  if (k === 'mem') { const h = BoostLive.hist.filter((x: any) => x.memTotalMb).pop(); return h ? h.memTotalMb / 1024 : 0; }
  return 0;
}
function boostVal(v: number, unit: string): string { return v == null ? '–' : `${unit === 'GB' || unit === '°C' ? v.toFixed(1) : Math.round(v)}${unit === '%' ? '%' : ' ' + unit}`; }

/** Bars: programs closed each minute over the last 15 minutes (PC). */
function boostBars(): string {
  const log: any[] = (BoostLive.pc && BoostLive.pc.log) || [], now = Date.now(), n = 15, b = new Array(n).fill(0);
  for (const e of log) { if (!e.mb && e.note) continue; const i = n - 1 - Math.floor((now - e.at) / 60000); if (i >= 0 && i < n) b[i]++; }
  const mx = Math.max(1, ...b);
  return `<div class="bs-bars" role="img" aria-label="Programs closed per minute, last 15 minutes">${b.map((v, i) => `<i style="height:${v ? Math.max(8, v / mx * 100) : 0}%" title="${n - 1 - i ? (n - 1 - i) + ' min ago' : 'This minute'}: ${v} closed"></i>`).join('')}</div><div class="bs-axis"><span>15 min ago</span><span>now</span></div>`;
}

function boostClosingHtml(): string {
  if (boostIsPc()) {
    const pc = BoostLive.pc || {}, c = pc.counts || { programs: 0, closings: 0, again: 0, freedMb: 0 }, picks = (Desk.prefs && Desk.prefs.boostClose) || [];
    const state = !gameBoost() ? 'Switch on the booster to close them while you play' : !picks.length ? 'Pick the programs to close below' : pc.watching ? `Keeping ${picks.length} program${picks.length > 1 ? 's' : ''} closed while the app is open` : 'Starting…';
    const log = ((pc.log || []) as any[]).slice(-8).reverse();
    return `<div class="bs-card bs-wide"><div class="bs-h"><b>Programs closed</b><small>${esc(state)}</small></div>
      <div class="bs-nums"><span><b>${c.programs}</b><small>programs closed</small></span><span><b>${c.again}</b><small>stopped from starting again</small></span><span><b>${c.freedMb >= 1024 ? (c.freedMb / 1024).toFixed(1) + ' GB' : c.freedMb + ' MB'}</b><small>memory freed</small></span></div>
      ${boostBars()}
      ${log.length ? `<ul class="bs-log">${log.map((e: any) => `<li><time>${new Date(e.at).toTimeString().slice(0, 5)}</time><b>${esc(e.name)}</b><span>${e.note ? esc(e.note) : e.again ? `started again, closed (${e.mb} MB)` : `closed (${e.mb} MB)`}</span></li>`).join('')}</ul>` : ''}</div>`;
  }
  const h = BoostLive.hist[BoostLive.hist.length - 1] || {};
  if (h.canClose === false) return `<div class="bs-card bs-wide"><div class="bs-h"><b>Other apps</b><small>Android ${h.sdk >= 35 ? '15' : '14'} and later don't let an app close other apps. Your phone's own game booster or game mode can do it: this app is listed there as a game.</small></div></div>`;
  return `<div class="bs-card bs-wide"><div class="bs-h"><b>Background apps closed</b><small>${gameBoost() ? 'While the app is open, other apps running in the background are closed every 30 seconds, so they don\'t keep running' : 'Switch on the booster to close other apps running in the background while you play'}</small></div>
    <div class="bs-nums"><span><b>${h.closeRounds || 0}</b><small>times closed</small></span><span><b>${h.closeAsked || 0}</b><small>apps checked each time</small></span><span><b>${(h.freedMb || 0) >= 1024 ? ((h.freedMb || 0) / 1024).toFixed(1) + ' GB' : (h.freedMb || 0) + ' MB'}</b><small>memory freed</small></span></div></div>`;
}

/** The charts' section of the page (filled in by boostDraw). */
function boostStatsHtml(): string {
  return `<div class="boost-stats"><div class="bs-title">${icon('finance')}<b>Live readings</b><small>Updated every 2 seconds</small></div>
    <div class="bs-grid">${boostCharts().map(([k, t]) => `<div class="bs-card" data-k="${k}"><div class="bs-h"><b>${esc(t)}</b><em class="bs-v">–</em></div><small class="bs-sub"></small><div class="bs-plot"></div><div class="bs-tip" hidden></div></div>`).join('')}</div>
    <div class="bs-close">${boostClosingHtml()}</div>${boostIsPc() ? boostPickerHtml() : ''}</div>`;
}

function boostDraw() {
  const root = document.querySelector('.boost-stats'); if (!root) return;
  for (let [k, , unit, top] of boostCharts()) {
    const card = root.querySelector(`.bs-card[data-k="${k}"]`) as HTMLElement; if (!card) continue;
    const d = boostSeries(k), last = d.filter(p => p[1] != null).pop(), tot = boostRamTotal(k);
    (card.querySelector('.bs-v') as HTMLElement).textContent = tot && last ? `${last[1].toFixed(1)} of ${tot.toFixed(1)} GB` : boostVal(last ? last[1] : null, unit);
    if (tot) top = tot;
    (card.querySelector('.bs-sub') as HTMLElement).textContent = boostSub(k, last);
    const plot = card.querySelector('.bs-plot') as HTMLElement; plot.innerHTML = boostSvg(d, top); (plot as any)._d = d; (plot as any)._u = unit;
    card.classList.toggle('bs-none', !last);
  }
  const cl = root.querySelector('.bs-close'); if (cl) cl.innerHTML = boostClosingHtml();
}

/* hover: the reading at that moment */
document.addEventListener('pointermove', e => {
  const plot = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('.bs-plot') as HTMLElement;
  document.querySelectorAll('.bs-tip:not([hidden])').forEach(t => { if (!plot || t.parentElement !== plot.parentElement) t.setAttribute('hidden', ''); });
  if (!plot) return;
  const d: [number, number][] = (plot as any)._d || []; if (d.length < 2) return;
  const r = plot.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), t = d[0][0] + f * (d[d.length - 1][0] - d[0][0]);
  let best = d[0]; for (const p of d) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
  const tip = plot.parentElement.querySelector('.bs-tip') as HTMLElement;
  tip.textContent = `${new Date(best[0]).toTimeString().slice(0, 8)}  ${boostVal(best[1], (plot as any)._u)}`;
  tip.style.left = Math.min(r.width - 90, Math.max(0, e.clientX - r.left - 45)) + 'px'; tip.removeAttribute('hidden');
}, { passive: true });

/* ---------- PC: the programs to close while you play ---------- */
function boostPickerHtml(): string {
  const picks: string[] = (Desk.prefs && Desk.prefs.boostClose) || [], L = BoostLive.procs;
  const rows = L ? L.map((p: any) => `<label class="bs-proc${p.suggested ? ' sug' : ''}"><input type="checkbox" data-act="boost-pick" data-name="${esc(p.name)}" ${picks.indexOf(p.name) >= 0 ? 'checked' : ''}>
      <span><b>${esc(p.title)}</b><small>${esc(p.name)}.exe${p.count > 1 ? ` · ${p.count} processes` : ''}${p.window ? ' · has a window' : ' · background'}</small></span>${p.suggested ? '<em>Suggested</em>' : ''}<i>${p.mb >= 1024 ? (p.mb / 1024).toFixed(1) + ' GB' : p.mb + ' MB'}</i></label>`).join('') : '';
  const gone = picks.filter(n => !L || !L.some((p: any) => p.name === n));
  return `<div class="set-card col bs-picker"><div class="sc-h">${icon('power')}<span><b>Close programs while you play</b><small>Tick the programs to close. While the booster is on and the app is open, they are closed and kept closed: if one starts again, it is closed again within a few seconds. Programs with a window are asked to close as if you closed them yourself, so one asking you to save stays open. Windows, Flight Simulator, Steam, the Xbox app, security software and drivers are never closed.</small></span></div>
    <div class="bs-pick-btns"><button class="btn sm" data-act="boost-procs">${icon('sync')}${L ? 'Refresh the list' : 'Show running programs'}</button>${L ? '<button class="btn sm ghost" data-act="boost-pick-sug">Tick the suggested ones</button>' : ''}${picks.length ? '<button class="btn sm ghost" data-act="boost-pick-none">Untick all</button>' : ''}</div>
    ${BoostLive.procsBusy ? '<small class="muted">Looking at the running programs…</small>' : ''}
    ${gone.length ? `<small class="muted">Also ticked, not running now: ${gone.map(esc).join(', ')}</small>` : ''}
    <div class="bs-procs">${rows}</div></div>`;
}
function boostPickRedraw() { const el = document.querySelector('.bs-picker'); if (el) el.outerHTML = boostPickerHtml(); }
function boostSavePicks(p: string[]) { Desk.save({ boostClose: p }); boostPickRedraw(); boostDraw(); }
ACTIONS['boost-procs'] = () => {
  BoostLive.procsBusy = true; boostPickRedraw(); Sound.tick();
  fetch('/api/boost/procs').then(r => r.json()).then(j => { BoostLive.procs = j.procs || []; }).catch(() => { BoostLive.procs = []; }).then(() => { BoostLive.procsBusy = false; boostPickRedraw(); });
};
ACTIONS['boost-pick'] = el => {
  const n = el.getAttribute('data-name'), p: string[] = ((Desk.prefs && Desk.prefs.boostClose) || []).slice(), i = p.indexOf(n);
  if ((el as HTMLInputElement).checked) { if (i < 0) p.push(n); } else if (i >= 0) p.splice(i, 1);
  Sound.tick(); boostSavePicks(p);
};
ACTIONS['boost-pick-sug'] = () => { const p: string[] = ((Desk.prefs && Desk.prefs.boostClose) || []).slice(); for (const x of BoostLive.procs || []) if (x.suggested && p.indexOf(x.name) < 0) p.push(x.name); Sound.tick(); boostSavePicks(p); };
ACTIONS['boost-pick-none'] = () => { Sound.tick(); boostSavePicks([]); };
