// Photo mode in the 3D viewer (as in the main game): the controls go away and a strip at the bottom offers a look
// (Natural, Warm, Cinematic, Black and white, Vivid, Vintage), black bars for a wide-screen frame (2.39:1), depth of
// field (off, soft, strong: the aircraft stays sharp, what is nearer or further away blurs by its distance) and a
// caption. Move the camera as usual, then take the picture: everything on the screen is taken away for it, the
// picture is made at up to 4K with the look, the frame and the caption, and it is saved (Pictures / Airline Manager
// Pro on Android and the PC), then the strip comes back.
import { AbstractEngine, Tools, Camera, DefaultRenderingPipeline, DepthOfFieldEffectBlurLevel } from '@babylonjs/core';
import { savePhoto } from '../../core/photo';
import { toast } from '../../ui/icons';

export const PHOTO_LOOKS: [string, string, string][] = [
  ['none', 'Natural', ''], ['warm', 'Warm', 'sepia(.22) saturate(1.15) brightness(1.04)'], ['cine', 'Cinematic', 'contrast(1.18) saturate(.82) brightness(.96) hue-rotate(-6deg)'],
  ['bw', 'Black and white', 'grayscale(1) contrast(1.22)'], ['vivid', 'Vivid', 'saturate(1.45) contrast(1.08)'], ['vintage', 'Vintage', 'sepia(.55) contrast(.9) brightness(1.06) saturate(.8)'],
];
const DOF = ['Depth of field: off', 'Depth of field: soft', 'Depth of field: strong'];

export interface PhotoHooks { hud: HTMLElement; root: HTMLElement; engine: AbstractEngine; canvas: HTMLCanvasElement; dp: () => DefaultRenderingPipeline; cam: () => Camera;
  focus: () => number; caption: () => string }
export function makePhotoMode(h: PhotoHooks) {
  const P = { on: false, look: 'none', bars: false, dof: 0, cap: '', busy: false };
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
  const filter = () => (PHOTO_LOOKS.find(l => l[0] === P.look) || PHOTO_LOOKS[0])[2];
  const strip = document.createElement('div'); strip.className = 'ph-wrap'; strip.hidden = true; h.hud.appendChild(strip);
  const bars = document.createElement('div'); bars.className = 'ph-bars'; bars.hidden = true; bars.innerHTML = '<i></i><i></i>'; h.hud.appendChild(bars);
  const draw = () => {
    strip.innerHTML = `<div class="ph-bar">${PHOTO_LOOKS.map(l => `<button class="ph-look ${P.look === l[0] ? 'on' : ''}" data-ph="look" data-l="${l[0]}">${esc(l[1])}</button>`).join('')}
      <button class="ph-look ${P.bars ? 'on' : ''}" data-ph="bars">Wide frame</button>
      <button class="ph-look ${P.dof ? 'on' : ''}" data-ph="dof">${DOF[P.dof]}</button>
      <input class="ph-cap" placeholder="Caption (optional)" value="${esc(P.cap)}" maxlength="80" aria-label="Caption">
      <button class="ph-shoot" data-ph="shoot" aria-label="Take the picture"><svg viewBox="0 0 24 24" class="ic"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 8h3l2-3h6l2 3h3v11H4V8Zm8 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/></svg></button>
      <button class="ph-exit" data-ph="exit" aria-label="Leave photo mode">✕</button></div>`;
    const inp = strip.querySelector('.ph-cap') as HTMLInputElement; inp.addEventListener('input', () => { P.cap = inp.value; }); inp.addEventListener('keydown', e => e.stopPropagation());
  };
  const dofApply = () => { const dp = h.dp(); if (!dp) return; try { dp.depthOfFieldEnabled = P.on && P.dof > 0; if (dp.depthOfFieldEnabled) { dp.depthOfFieldBlurLevel = P.dof === 2 ? DepthOfFieldEffectBlurLevel.High : DepthOfFieldEffectBlurLevel.Medium;
      dp.depthOfField.focalLength = P.dof === 2 ? 120 : 70; dp.depthOfField.fStop = P.dof === 2 ? 1.4 : 2.8; dp.depthOfField.lensSize = 50; } } catch (e) { /* not on this device */ } };
  const apply = () => { document.body.classList.toggle('photo-on', P.on); strip.hidden = !P.on; bars.hidden = !(P.on && P.bars); h.canvas.style.filter = P.on ? filter() : ''; if (P.on) draw(); dofApply(); };
  const set = (on: boolean) => { P.on = on; apply(); };
  strip.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button') as HTMLElement | null; if (!b) return; e.stopPropagation(); const a = b.getAttribute('data-ph');
    if (a === 'look') P.look = b.getAttribute('data-l') as string; else if (a === 'bars') P.bars = !P.bars; else if (a === 'dof') P.dof = (P.dof + 1) % 3; else if (a === 'exit') { set(false); return; } else if (a === 'shoot') { shoot(); return; }
    apply(); });
  strip.addEventListener('pointerdown', e => e.stopPropagation());

  async function shoot() {
    if (P.busy) return; P.busy = true; const hidden: [HTMLElement, string][] = [];
    const hide = (el: Element) => { for (const c of Array.from(el.children)) { const e = c as HTMLElement; if (e === h.canvas || e.tagName === 'SCRIPT') continue; if (e.contains(h.canvas)) { hide(e); continue; } hidden.push([e, e.style.visibility]); e.style.visibility = 'hidden'; } };
    hide(document.body);
    try {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const url = await Tools.CreateScreenshotAsync(h.engine, h.cam(), { precision: 1 }, 'image/png');
      for (const [e, v] of hidden) e.style.visibility = v; hidden.length = 0;
      const img = new Image(); await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
      // up to 4K: the picture, with the look, cropped to the wide frame, a soft vignette for Cinematic and Vintage, the caption
      const k = Math.min(1, 3840 / Math.max(img.width, img.height)) || 1, W = Math.round(img.width * k), H0 = Math.round(img.height * k), cut = P.bars ? Math.round(Math.max(0, H0 - W / 2.39) / 2) : 0, H = H0 - cut * 2;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.filter = filter() || 'none'; g.drawImage(img, 0, cut / k, img.width, img.height - cut * 2 / k, 0, 0, W, H); g.filter = 'none';
      if (P.look === 'vintage' || P.look === 'cine') { const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      const cap = P.cap.trim(); if (cap) { const fs = Math.round(H / 26); g.font = `600 ${fs}px Inter, Arial, sans-serif`; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, H - fs * 2.2, W, fs * 2.2); g.fillStyle = '#fff'; g.fillText(cap, fs, H - fs * 0.8); }
      const flash = document.createElement('div'); flash.className = 'v3d-flash'; h.root.appendChild(flash); setTimeout(() => flash.remove(), 600);
      const d = new Date(), p2 = (n: number) => String(n).padStart(2, '0'), name = `AMP-photo-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.jpg`;
      const where = await savePhoto(c.toDataURL('image/jpeg', 0.95), name); toast(`Photo saved · ${where}${cap || h.caption() ? '' : ''}`);
    } catch (e: any) { toast('The photo couldn\'t be taken' + (e && e.message ? ': ' + e.message : '')); }
    finally { for (const [e, v] of hidden) e.style.visibility = v; P.busy = false; }
  }
  return {
    toggle() { set(!P.on); }, get on() { return P.on; },
    /** Each frame: the focus stays on the aircraft as the camera moves. */
    frame() { if (!P.on || !P.dof) return; const dp = h.dp(); if (dp && dp.depthOfFieldEnabled) try { dp.depthOfField.focusDistance = Math.max(2, h.focus()) * 1000; } catch (e) { /* not on this device */ } },
    shoot, dispose() { strip.remove(); bars.remove(); h.canvas.style.filter = ''; try { const dp = h.dp(); if (dp) dp.depthOfFieldEnabled = false; } catch (e) { /* gone */ } },
  };
}
