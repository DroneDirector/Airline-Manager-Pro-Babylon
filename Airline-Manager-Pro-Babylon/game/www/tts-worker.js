// Speech for the people in the app: runs the voice model (Kokoro-82M, Apache License 2.0) with ONNX
// Runtime Web (MIT License) in the background, so the app stays smooth while a line is being spoken.
// Messages in: init {base, model}, voice {name, url}, synth {id, ids, voice, speed}. Out: ready, audio, error.
'use strict';
let session = null, base = '', busy = Promise.resolve();
const voices = {};

self.onmessage = e => {
  const m = e.data || {};
  busy = busy.then(() => handle(m)).catch(err => self.postMessage({ type: 'error', id: m.id, error: String((err && err.message) || err) }));
};

async function handle(m) {
  if (m.type === 'init') {
    base = m.base;
    if (!self.ort) importScripts(base + 'vendor/ort/ort.wasm.min.js');
    ort.env.wasm.wasmPaths = base + 'vendor/ort/';
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) > 2 ? navigator.hardwareConcurrency - 1 : navigator.hardwareConcurrency || 1)) : 1;
    ort.env.wasm.proxy = false;
    const t0 = Date.now();
    const buf = m.modelBuffer || await (await fetch(m.model)).arrayBuffer();
    session = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    self.postMessage({ type: 'ready', id: m.id, ms: Date.now() - t0, threads: ort.env.wasm.numThreads });
  } else if (m.type === 'voice') {
    if (!voices[m.name]) voices[m.name] = new Float32Array(await (await fetch(m.url)).arrayBuffer());
    self.postMessage({ type: 'voice', id: m.id, name: m.name });
  } else if (m.type === 'synth') {
    if (!session) throw new Error('The voice model isn\'t loaded');
    const v = voices[m.voice]; if (!v) throw new Error('Voice not loaded: ' + m.voice);
    const ids = m.ids, n = Math.min(ids.length, 509), t0 = Date.now();
    const tokens = new BigInt64Array(n + 2); for (let i = 0; i < n; i++) tokens[i + 1] = BigInt(ids[i]);
    const style = v.slice(n * 256, n * 256 + 256);
    const out = await session.run({
      tokens: new ort.Tensor('int64', tokens, [1, n + 2]),
      style: new ort.Tensor('float32', style, [1, 256]),
      speed: new ort.Tensor('float32', new Float32Array([m.speed || 1]), [1]),
    });
    const audio = out.audio.data.slice ? out.audio.data.slice() : new Float32Array(out.audio.data);
    self.postMessage({ type: 'audio', id: m.id, audio, ms: Date.now() - t0 }, [audio.buffer]);
  }
}
