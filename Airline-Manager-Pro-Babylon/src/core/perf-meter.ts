// The performance overlay (Settings → Graphics, each part on or off):
//  - Frame rate: frames a second and the time between them.
//  - CPU: how much of each frame the processor spends working (the app's own work and preparing the drawing).
//  - GPU: how long the graphics chip takes to draw a frame, measured by the chip itself where the device reports it
//    (otherwise it says so), with the draw calls and triangles.
//  - Memory: the app's memory (where the device reports it) and what its pictures and models take on the graphics chip.
import { Engine, Scene, EngineInstrumentation, SceneInstrumentation } from '@babylonjs/core';
import { S } from './settings';

let el: HTMLElement | null = null, ei: EngineInstrumentation | null = null, si: SceneInstrumentation | null = null, eng: Engine | null = null, scn: Scene | null = null;
let t0 = 0, work = 0, frames = 0, last = 0, interval = 16.7, nextShow = 0, memT = 0, gpuMem = 0;
/** Start measuring a place's scene; the overlay goes in host. */
export function perfAttach(engine: Engine, scene: Scene, host: HTMLElement) {
  perfDetach(); eng = engine; scn = scene;
  el = document.createElement('div'); el.className = 'perf'; host.appendChild(el);
  try { ei = new EngineInstrumentation(engine); ei.captureGPUFrameTime = true; } catch (e) { ei = null; }
  try { si = new SceneInstrumentation(scene); si.captureFrameTime = true; si.captureRenderTime = true; } catch (e) { si = null; }
  perfShow();
}
export function perfDetach() { if (el) el.remove(); el = null; try { ei && ei.dispose(); si && si.dispose(); } catch (e) { /* gone */ } ei = null; si = null; eng = null; scn = null; }
/** Show or hide the overlay's parts as the settings say. */
export function perfShow() { if (!el) return; const g = S.gfx; el.hidden = !(g.showFps || g.showCpu || g.showGpu || g.showMem); nextShow = 0; }
export function perfBegin() { const now = performance.now(); if (last) interval += ((now - last) - interval) * 0.1; last = now; t0 = now; }
export function perfEnd() { work += performance.now() - t0; frames++; if (performance.now() > nextShow) draw(); }
const bar = (k: number, warn = 0.7, bad = 0.9) => { const p = Math.max(0, Math.min(1, k)); return `<i class="pb"><i style="width:${(p * 100).toFixed(0)}%;background:${p > bad ? '#FF5A6E' : p > warn ? '#FFC24A' : '#4CFFA0'}"></i></i>`; };
function draw() {
  if (!el || el.hidden || !eng) { work = 0; frames = 0; return; }
  const g = S.gfx, now = performance.now(); nextShow = now + 500;
  const fps = eng.getFps(), cpu = frames ? work / frames : 0; work = 0; frames = 0;
  const rows: string[] = [];
  if (g.showFps) rows.push(`<div><b>FPS</b><span>${Math.round(fps)}</span><small>${interval.toFixed(1)} ms</small></div>`);
  if (g.showCpu) { const k = cpu / Math.max(1, interval); rows.push(`<div><b>CPU</b><span>${Math.round(k * 100)}%</span><small>${cpu.toFixed(1)} ms</small>${bar(k)}</div>`); }
  if (g.showGpu) {
    const c: any = ei && ei.gpuFrameTimeCounter, ms = c && c.lastSecAverage ? c.lastSecAverage * 1e-6 : 0;
    const dc = si ? Math.round(si.drawCallsCounter.lastSecAverage || si.drawCallsCounter.current) : 0, tris = scn ? Math.round(scn.getActiveIndices() / 3) : 0;
    const extra = `<small class="sub">${dc} draw calls · ${(tris / 1000).toFixed(0)}k triangles</small>`;
    if (ms > 0) { const k = ms / Math.max(1, interval); rows.push(`<div><b>GPU</b><span>${Math.round(k * 100)}%</span><small>${ms.toFixed(1)} ms</small>${bar(k)}${extra}</div>`); }
    else rows.push(`<div><b>GPU</b><span class="na">not reported</span><small>this device doesn't measure it</small>${extra}</div>`);
  }
  if (g.showMem) {
    if (now > memT) { memT = now + 3000; gpuMem = estimateGpu(); }
    const pm: any = (performance as any).memory, used = pm ? pm.usedJSHeapSize / 1048576 : 0, lim = pm ? pm.jsHeapSizeLimit / 1048576 : 0;
    rows.push(`<div><b>RAM</b>${pm ? `<span>${used.toFixed(0)} MB</span><small>of ${lim.toFixed(0)} MB</small>${bar(used / Math.max(1, lim), 0.6, 0.85)}` : '<span class="na">not reported</span><small>on this device</small>'}</div>`);
    rows.push(`<div><b>VRAM</b><span>≈ ${gpuMem.toFixed(0)} MB</span><small>pictures and models</small></div>`);
  }
  el.innerHTML = rows.join('');
}
/** What the pictures (with their smaller copies) and the models take on the graphics chip, roughly. */
function estimateGpu(): number {
  let b = 0;
  try { for (const t of (eng as any).getLoadedTexturesCache() as any[]) { const w = t.width || t.baseWidth || 0, h = t.height || t.baseHeight || 0, faces = t.isCube ? 6 : 1, bpp = t.type === 1 || t.type === 2 ? 8 : 4; b += w * h * bpp * faces * (t.generateMipMaps ? 1.33 : 1); } } catch (e) { /* none */ }
  try { for (const m of (scn as any).meshes) { const v = m.getTotalVertices ? m.getTotalVertices() : 0, i = m.getTotalIndices ? m.getTotalIndices() : 0; if (!m.isAnInstance) b += v * 48 + i * 4; } } catch (e) { /* none */ }
  return b / 1048576;
}
