// The performance overlay (Settings → Graphics, each part on or off):
//  - Frame rate: frames a second and the time between them.
//  - CPU: how much of each frame the processor spends working (the app's own work and preparing the drawing).
//  - GPU: how long the graphics chip takes to draw a frame, measured by the chip itself where the device reports it
//    (otherwise it says so), with the draw calls and triangles.
// It sits low in the middle at the bottom (clear of the other buttons), in three rows: the names, their figures, and
// a line saying what holds the frame rate back when it struggles. It can be dragged anywhere (double-tap: back home).
//  - Memory: the app's memory (where the device reports it) and what its pictures and models take on the graphics chip.
import { Engine, Scene, EngineInstrumentation, SceneInstrumentation } from '@babylonjs/core';
import { S } from './settings';

let el: HTMLElement | null = null, ei: EngineInstrumentation | null = null, si: SceneInstrumentation | null = null, eng: Engine | null = null, scn: Scene | null = null;
let t0 = 0, work = 0, frames = 0, last = 0, interval = 16.7, nextShow = 0, memT = 0, gpuMem = 0;
/** Start measuring a place's scene; the overlay goes in host. */
export function perfAttach(engine: Engine, scene: Scene, host: HTMLElement) {
  perfDetach(); eng = engine; scn = scene;
  el = document.createElement('div'); el.className = 'perf'; host.appendChild(el); drag(el);
  try { ei = new EngineInstrumentation(engine); ei.captureGPUFrameTime = true; } catch (e) { ei = null; }
  try { si = new SceneInstrumentation(scene); si.captureFrameTime = true; si.captureRenderTime = true; } catch (e) { si = null; }
  perfShow();
}
/** The overlay can be dragged anywhere (by mouse or finger); where it was left is kept on the device. */
function drag(e: HTMLElement) {
  try { const p = JSON.parse(localStorage.getItem('ampb.perfpos') || 'null'); if (p) place(e, p.x, p.y); } catch (err) { /* default place */ }
  let sx = 0, sy = 0, ox = 0, oy = 0, on = false;
  e.addEventListener('pointerdown', ev => { on = true; const r = e.getBoundingClientRect(); sx = ev.clientX; sy = ev.clientY; ox = r.left; oy = r.top; try { e.setPointerCapture(ev.pointerId); } catch (err) { /* fine */ } ev.stopPropagation(); });
  e.addEventListener('pointermove', ev => { if (!on) return; place(e, ox + ev.clientX - sx, oy + ev.clientY - sy); ev.stopPropagation(); });
  const up = (ev: PointerEvent) => { if (!on) return; on = false; const r = e.getBoundingClientRect(); try { localStorage.setItem('ampb.perfpos', JSON.stringify({ x: r.left, y: r.top })); } catch (err) { /* not kept */ } ev.stopPropagation(); };
  e.addEventListener('pointerup', up); e.addEventListener('pointercancel', up);
  e.addEventListener('dblclick', () => { e.style.left = e.style.top = e.style.bottom = e.style.transform = ''; e.classList.remove('moved'); try { localStorage.removeItem('ampb.perfpos'); } catch (err) { /* fine */ } });
}
function place(e: HTMLElement, x: number, y: number) { const w = e.offsetWidth || 300, h = e.offsetHeight || 60;
  x = Math.max(0, Math.min(innerWidth - w, x)); y = Math.max(0, Math.min(innerHeight - h, y)); e.classList.add('moved'); e.style.left = x + 'px'; e.style.top = y + 'px'; }
export function perfDetach() { if (el) el.remove(); el = null; try { ei && ei.dispose(); si && si.dispose(); } catch (e) { /* gone */ } ei = null; si = null; eng = null; scn = null; }
/** Show or hide the overlay's parts as the settings say. */
export function perfShow() { if (!el) return; const g = S.gfx; el.hidden = !(g.showFps || g.showCpu || g.showGpu || g.showMem); nextShow = 0; }
/** Where the processor's time goes, part by part (ms per frame, averaged): shown under CPU. */
const parts: { [k: string]: number } = {}, partsShown: { [k: string]: number } = {};
export function perfPart(name: string, ms: number) { parts[name] = (parts[name] || 0) + ms; }
export function perfBegin() { const now = performance.now(); if (last) { const d = now - last; interval += (d - interval) * 0.1; if (d < 1000) playTrack(d, now); } last = now; t0 = now; }
/** How fast the 3D places really ran while playing (pauses left out), with the settings they ran at: kept on the
 *  device, for the device scan. */
let pSum = 0, pN = 0, pSaved = 0;
function playTrack(d: number, now: number) { pSum += d; pN++; if (now - pSaved < 5000 || pN < 60) return; pSaved = now;
  const fps = 1000 / (pSum / pN); pSum = 0; pN = 0; let r: any = null; try { r = JSON.parse(localStorage.getItem('ampb.playfps') || 'null'); } catch (e) { /* none */ }
  const g: any = S.gfx, same = r && r.preset === g.preset && Math.abs(r.scale - g.scale) < 0.01;
  const avg = same ? r.fps + (fps - r.fps) * 0.2 : fps;
  try { localStorage.setItem('ampb.playfps', JSON.stringify({ fps: avg, preset: g.preset, scale: g.scale, shadows: g.shadows, at: Date.now() })); } catch (e) { /* not kept */ } }
export function recentPlay(): { fps: number; preset: string; scale: number; at: number } | null { try { return JSON.parse(localStorage.getItem('ampb.playfps') || 'null'); } catch (e) { return null; } }
let cpuAvg = 0;
export function perfEnd() { const w = performance.now() - t0; work += w; cpuAvg += (w - cpuAvg) * 0.1; frames++; if (performance.now() > nextShow) draw(); }
/** The processor's time per frame and the time between frames (smoothed), for the automatic resolution. */
export function perfLoad() { return { cpu: cpuAvg, frame: interval }; }
const bar = (k: number, warn = 0.7, bad = 0.9) => { const p = Math.max(0, Math.min(1, k)); return `<i class="pb"><i style="width:${(p * 100).toFixed(0)}%;background:${p > bad ? '#FF5A6E' : p > warn ? '#FFC24A' : '#4CFFA0'}"></i></i>`; };
function draw() {
  if (!el || el.hidden || !eng) { work = 0; frames = 0; return; }
  const g = S.gfx, now = performance.now(); nextShow = now + 500;
  const fps = eng.getFps(), cpu = frames ? work / frames : 0;
  for (const k of Object.keys(parts)) { partsShown[k] = frames ? parts[k] / frames : 0; parts[k] = 0; } work = 0; frames = 0;
  // three rows: the names, their figures under them, and a line saying what (if anything) holds the frame rate back
  const head: string[] = [], val: string[] = [], warn: string[] = [];
  const col = (k: number, w = 0.7, b = 0.9) => k > b ? 'bad' : k > w ? 'warn' : '';
  if (g.showFps) { head.push('Frames'); val.push(`<span class="${fps < 20 ? 'bad' : fps < 40 ? 'warn' : ''}">${Math.round(fps)} fps</span><small>${interval.toFixed(1)} ms</small>`); if (fps < 25) warn.push(`low frame rate (${Math.round(fps)} fps)`); }
  if (g.showCpu) { const k = cpu / Math.max(1, interval); head.push('CPU'); val.push(`<span class="${col(k)}">${Math.round(k * 100)}%</span><small>${cpu.toFixed(1)} ms</small>`);
    if (k > 0.85) { const top = Object.keys(partsShown).filter(n => partsShown[n] >= 0.5).sort((a, b) => partsShown[b] - partsShown[a]).slice(0, 3).map(n => `${n} ${partsShown[n].toFixed(0)} ms`).join(', ');
      warn.push(`the processor is the limit${top ? ' — ' + top : ''}`); } }
  if (g.showGpu) {
    const c: any = ei && ei.gpuFrameTimeCounter, ms = c && c.lastSecAverage ? c.lastSecAverage * 1e-6 : 0;
    const dc = si ? Math.round(si.drawCallsCounter.lastSecAverage || si.drawCallsCounter.current) : 0, tris = scn ? Math.round(scn.getActiveIndices() / 3) : 0;
    if (ms > 0) { const k = ms / Math.max(1, interval); head.push('GPU'); val.push(`<span class="${col(k)}">${Math.round(k * 100)}%</span><small>${ms.toFixed(1)} ms</small>`); if (k > 0.9) warn.push('the graphics chip is the limit — lower the resolution or the shadows'); }
    else { head.push('GPU'); val.push('<span class="na">n/a</span><small>not reported</small>'); }
    head.push('Drawing'); val.push(`<span class="${dc > 3000 ? 'warn' : ''}">${dc}</span><small>calls · ${(tris / 1000).toFixed(0)}k tris</small>`); if (dc > 3500) warn.push(`many draw calls (${dc})`);
  }
  if (g.showMem) {
    if (now > memT) { memT = now + 3000; gpuMem = estimateGpu(); }
    const pm: any = (performance as any).memory, used = pm ? pm.usedJSHeapSize / 1048576 : 0, lim = pm ? pm.jsHeapSizeLimit / 1048576 : 0;
    head.push('RAM'); val.push(pm ? `<span class="${col(used / Math.max(1, lim), 0.6, 0.85)}">${used.toFixed(0)} MB</span><small>of ${lim.toFixed(0)}</small>` : '<span class="na">n/a</span><small>not reported</small>');
    if (pm && used / Math.max(1, lim) > 0.85) warn.push('memory nearly full');
    head.push('VRAM'); val.push(`<span>≈ ${gpuMem.toFixed(0)} MB</span><small>pictures, models</small>`);
  }
  const n = head.length;
  el.innerHTML = `<div class="pf-g" style="grid-template-columns:repeat(${n},auto)">${head.map(h => `<b>${h}</b>`).join('')}${val.map(v => `<div>${v}</div>`).join('')}</div>`
    + `<div class="pf-m ${warn.length ? 'bad' : ''}">${warn.length ? '⚠ ' + warn.join(' · ') : 'Running smoothly'}</div>`;
  clear(el);
}
/** Keep the overlay clear of every button and panel on screen: when it would cover one, it moves up above it. */
function clear(e: HTMLElement) {
  const others = Array.from(document.querySelectorAll<HTMLElement>('button, .site-moves, .wx-b, .v3d-b, .holomap, .place-ver, .gear, .exit, .to-title'))
    .filter(o => !e.contains(o) && o.offsetParent !== null && getComputedStyle(o).visibility !== 'hidden' && getComputedStyle(o).opacity !== '0').map(o => o.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  if (!e.classList.contains('moved')) e.style.bottom = '';
  const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  for (let i = 0; i < 6; i++) { const r = e.getBoundingClientRect(), o = others.find(b => hit(r, b)); if (!o) return;
    const y = Math.max(0, o.top - r.height - 6);
    if (e.classList.contains('moved')) e.style.top = y + 'px'; else e.style.bottom = (innerHeight - o.top + 6) + 'px'; }
}
/** What the pictures (with their smaller copies) and the models take on the graphics chip, roughly. */
function estimateGpu(): number {
  let b = 0;
  try { for (const t of (eng as any).getLoadedTexturesCache() as any[]) { const w = t.width || t.baseWidth || 0, h = t.height || t.baseHeight || 0, faces = t.isCube ? 6 : 1, bpp = t.type === 1 || t.type === 2 ? 8 : 4; b += w * h * bpp * faces * (t.generateMipMaps ? 1.33 : 1); } } catch (e) { /* none */ }
  try { for (const m of (scn as any).meshes) { const v = m.getTotalVertices ? m.getTotalVertices() : 0, i = m.getTotalIndices ? m.getTotalIndices() : 0; if (!m.isAnInstance) b += v * 48 + i * 4; } } catch (e) { /* none */ }
  return b / 1048576;
}
