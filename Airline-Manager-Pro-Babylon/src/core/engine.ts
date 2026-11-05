// The Babylon.js engine on the page's canvas: its sharpness (resolution scale), and the frame-rate limit.
import { Engine } from '@babylonjs/core';
import { S } from './settings';

let engine: Engine | null = null;
export function makeEngine(canvas: HTMLCanvasElement): Engine {
  if (engine) return engine;
  engine = new Engine(canvas, S.gfx.aa === 'msaa', { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance', antialias: S.gfx.aa === 'msaa' }, true);
  applyScale();
  window.addEventListener('resize', () => engine && engine.resize());
  return engine;
}
export function getEngine(): Engine | null { return engine; }
/** The resolution scale: 1 draws at the screen's own sharpness, less is faster, more (PC) is sharper. */
export function applyScale() { if (engine) { engine.setHardwareScalingLevel(1 / Math.max(0.3, S.gfx.scale)); engine.resize(); } }
/** The render loop with the frame-rate limit (0: as fast as the screen allows). */
export function runLoop(frame: () => void) {
  if (!engine) return; engine.stopRenderLoop();
  let last = 0;
  engine.runRenderLoop(() => {
    const cap = S.gfx.fps; if (cap > 0) { const now = performance.now(); if (now - last < 1000 / cap - 1.5) return; last = now; }
    frame();
  });
}
/** What the graphics card is, for the settings page. */
export function gpuInfo(): string {
  if (!engine) return '';
  try { const i: any = engine.getGlInfo(); return `${engine.webGLVersion >= 2 ? 'WebGL 2' : 'WebGL 1'} · ${i.renderer || ''}`.trim(); } catch (e) { return ''; }
}
