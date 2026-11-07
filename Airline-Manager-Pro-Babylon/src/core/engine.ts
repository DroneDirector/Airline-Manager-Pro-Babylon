// The Babylon.js engine on the page's canvas: its sharpness (resolution scale), and the frame-rate limit.
// On the PC it can be WebGPU (Settings → Graphics → Graphics engine): far less work for the processor per thing drawn.
// The game's own shaders are written for WebGL; on WebGPU they are translated as they load, by glslang and Tint
// (shipped with the PC app in webgpu/). If WebGPU can't start, the game falls back to WebGL and says so in the log.
import { Engine, WebGPUEngine, PBRBaseMaterial, StandardMaterial } from '@babylonjs/core';
import { S } from './settings';
import { IS_PC } from './app';
import { logProblem } from './errlog';
import { perfLoad } from './perf-meter';

let engine: Engine | null = null, kind: 'webgl' | 'webgpu' = 'webgl';
const webgl = (canvas: HTMLCanvasElement) => new Engine(canvas, S.gfx.aa === 'msaa', { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance', antialias: S.gfx.aa === 'msaa' }, true);
export async function makeEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  if (engine) return engine;
  if (IS_PC && (S.gfx as any).renderer === 'webgpu' && (navigator as any).gpu) {
    try {
      const e = new WebGPUEngine(canvas, { adaptToDeviceRatio: true, antialias: S.gfx.aa === 'msaa', powerPreference: 'high-performance', stencil: true } as any);
      await e.initAsync({ jsPath: 'webgpu/glslang.js', wasmPath: 'webgpu/glslang.wasm' } as any, { jsPath: 'webgpu/twgsl.js', wasmPath: 'webgpu/twgsl.wasm' } as any);
      // every material keeps the game's own (WebGL) shader code, translated for WebGPU
      PBRBaseMaterial.ForceGLSL = true; StandardMaterial.ForceGLSL = true;
      engine = e as any as Engine; kind = 'webgpu';
    } catch (err: any) {
      logProblem('3d places', 'WebGPU could not start', `Using WebGL instead. ${(err && err.message) || String(err)}`, `Device: ${navigator.userAgent}`);
      engine = null;
    }
  }
  if (!engine) { engine = webgl(canvas); kind = 'webgl'; }
  applyScale();
  engine.onEndFrameObservable.add(drsStep);
  window.addEventListener('resize', () => engine && engine.resize());
  return engine;
}
/** Which graphics engine is running. */
export function engineKind() { return kind; }
export function getEngine(): Engine | null { return engine; }
/** The resolution scale: 1 draws at the screen's own sharpness, less is faster, more (PC) is sharper. */
export function applyScale() { if (engine) { engine.setHardwareScalingLevel(1 / Math.max(0.3, S.gfx.scale * drsK)); engine.resize(); } }
// Automatic resolution (Settings → Graphics; on by default on phones and tablets): when the frame rate falls below its
// goal and the graphics chip is what holds it back (the processor is idle for much of each frame), the picture is drawn
// a little smaller (down to 60%), and sharp again as soon as there is room. When the processor is what struggles,
// it leaves the resolution alone (a softer picture wouldn't help).
let drsK = 1, drsT = 0;
function drsStep() {
  if (!engine) return; const now = performance.now(); if (now < drsT) return; drsT = now + 500;
  if (!(S.gfx as any).autoRes) { if (drsK !== 1) { drsK = 1; applyScale(); } return; }
  const goal = S.gfx.fps > 0 ? S.gfx.fps : 60, fps = engine.getFps(), L = perfLoad(), gpuBound = L.cpu < L.frame * 0.65;
  if (fps < goal * 0.85 && gpuBound && drsK > 0.6) { drsK = Math.max(0.6, drsK - 0.1); applyScale(); drsT = now + 1500; }
  else if ((fps > goal * 0.97 || !gpuBound) && drsK < 1) { drsK = Math.min(1, drsK + 0.05); applyScale(); drsT = now + 2500; }
}
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
  try { const i: any = engine.getGlInfo(); return `${kind === 'webgpu' ? 'WebGPU' : engine.webGLVersion >= 2 ? 'WebGL 2' : 'WebGL 1'} · ${i.renderer || ''}`.trim(); } catch (e) { return kind === 'webgpu' ? 'WebGPU' : ''; }
}
