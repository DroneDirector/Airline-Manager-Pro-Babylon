// Pictures loaded from files (the jetways', the rotundas', the runway's skid marks): with "Compressed textures" on, the
// compressed copy (KTX2, Basis Universal UASTC) is loaded and kept compressed on the graphics chip (about a quarter of
// the memory, and quicker to read); the original picture is used when the setting is off or the copy fails to load.
// The decoder and its transcoders ship with the app (ktx2/), so nothing is fetched over the internet.
import { Texture, Scene, KhronosTextureContainer2 } from '@babylonjs/core';
import { S } from './settings';

let ready = false;
function setup() {
  if (ready) return; ready = true; const b = 'ktx2/';
  KhronosTextureContainer2.URLConfig = { jsDecoderModule: b + 'babylon.ktx2Decoder.js', wasmUASTCToASTC: b + 'uastc_astc.wasm', wasmUASTCToBC7: b + 'uastc_bc7.wasm',
    wasmUASTCToRGBA_UNORM: b + 'uastc_rgba8_unorm_v2.wasm', wasmUASTCToRGBA_SRGB: b + 'uastc_rgba8_srgb_v2.wasm', wasmUASTCToR8_UNORM: b + 'uastc_r8_unorm.wasm',
    wasmUASTCToRG8_UNORM: b + 'uastc_rg8_unorm.wasm', jsMSCTranscoder: b + 'msc_basis_transcoder.js', wasmMSCTranscoder: b + 'msc_basis_transcoder.wasm', wasmZSTDDecoder: b + 'zstddec.wasm' };
}

// the decoder is checked once: if it is missing or will not start, every compressed picture falls back to its original
let broken = false; const waiting: { t: Texture; orig: string; done: boolean }[] = [];
const fallBack = (w: { t: Texture; orig: string; done: boolean }) => { if (w.done) return; w.done = true; try { (w.t as any)._invertVScale = false; w.t.updateURL(w.orig); } catch (e) { /* stays blank */ } };
function probe() { fetch('ktx2/babylon.ktx2Decoder.js', { method: 'HEAD' }).then(r => { if (!r.ok) throw new Error('no decoder'); }).catch(() => { broken = true; for (const w of waiting) fallBack(w); waiting.length = 0; });
  window.addEventListener('error', e => { if (/ktx2/i.test(String((e as any).message || (e as any).filename || ''))) { broken = true; for (const w of waiting) fallBack(w); waiting.length = 0; } }); }

/** A picture from assets/textures (its name without the extension), compressed when the setting is on. */
export function fileTex(name: string, sc: Scene, noMipmap = false, invertY = true, sampling: number = Texture.TRILINEAR_SAMPLINGMODE): Texture {
  const orig = `assets/textures/${name}.webp`;
  if (!(S.gfx as any).ktx2 || broken) return new Texture(orig, sc, noMipmap, invertY, sampling);
  if (!ready) probe(); setup();
  const w = { t: null as any as Texture, orig, done: false };
  w.t = new Texture(`assets/textures/${name}.ktx2`, sc, noMipmap, invertY, sampling, () => { w.done = true; }, () => fallBack(w));
  waiting.push(w);
  setTimeout(() => { if (!w.done && !w.t.isReady()) fallBack(w); const i = waiting.indexOf(w); if (i >= 0) waiting.splice(i, 1); }, 10000);   // never left blank
  return w.t;
}
