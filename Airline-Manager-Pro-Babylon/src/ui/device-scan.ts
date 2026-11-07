// Scan this device (Settings → Graphics): looks at the processor (cores and a short speed test), the memory, the
// graphics chip (its name and what it supports), the screen and, when a 3D view is open, how fast it is running now.
// It recommends a quality and a few settings to go with it; you choose to apply them or keep yours.
// Laid out for each screen: a sheet from the bottom on phones, a centred card on tablets, two columns on a PC.
import { S, saveSettings, PRESETS } from '../core/settings';
import { IS_PC } from '../core/app';
import { gpuInfo } from '../core/engine';
import { recentPlay } from '../core/perf-meter';
import { esc } from './icons';

type Rec = { preset: 'low' | 'medium' | 'high' | 'ultra'; set: { [k: string]: any }; facts: [string, string][]; why: string[]; score: number };

/** A short processor test (about 120 ms): mixed maths in a loop, as operations per millisecond. */
function cpuTest(): number {
  let n = 0, x = 1.0001; const t0 = performance.now();
  while (performance.now() - t0 < 120) { for (let i = 0; i < 20000; i++) { x = Math.sqrt(x * 1.0003 + i) % 97.3; } n += 20000; }
  return n / (performance.now() - t0) + (x > 1e9 ? 1 : 0);
}

/** Graphics chip class from its name: 0 very weak … 4 high-end desktop. */
function gpuClass(name: string): number {
  const g = name.toLowerCase();
  if (/rtx\s*[3-9]0[6-9]0|rtx\s*[4-9]0[7-9]0|rx\s*[67][89]00|radeon pro|rtx a[4-6]000|apple m[2-9] (max|ultra)/.test(g)) return 4;
  if (/rtx|gtx\s*1[06][6-8]0|rx\s*[5-7][0-9]00|arc a7|apple m[1-9]/.test(g)) return 3;
  if (/gtx|radeon(?! graphics)|iris xe|arc|adreno.?(7[3-9]\d|8\d\d)|mali-g7[1-9]|mali-g[79]\d\d|immortalis|apple gpu|xclipse/.test(g)) return 2;
  if (/intel|uhd|radeon graphics|adreno.?(6[4-9]\d|7[0-2]\d)|mali-g(5[7-9]|6\d|61[05]|68)|powervr bxm/.test(g)) return 1;
  return 0;
}

export function scanDevice(): Rec {
  const gl = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null;
  const maxTex = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 0, msaa = gl ? gl.getParameter(gl.MAX_SAMPLES) : 0;
  const cores = navigator.hardwareConcurrency || 4, mem = (navigator as any).deviceMemory || 0, ops = cpuTest();
  const gpu = gpuInfo() || (gl ? String(gl.getParameter(gl.RENDERER)) : 'unknown'), gc = gpuClass(gpu);
  const px = Math.round(screen.width * (window.devicePixelRatio || 1)) + ' × ' + Math.round(screen.height * (window.devicePixelRatio || 1));
  // how it really ran in the 3D places (the last few minutes of playing, with the settings it ran at) counts most
  const play = recentPlay(), fpsNow = play && Date.now() - play.at < 14 * 864e5 ? Math.round(play.fps) : 0;
  const ORDER: Rec['preset'][] = ['low', 'medium', 'high', 'ultra'];
  const cpuS = Math.max(0, Math.min(3, (ops - 4000) / 6000)) + (cores >= 8 ? 0.5 : 0);
  let score = gc * 1.6 + cpuS + (mem >= 8 ? 1 : mem >= 4 ? 0.5 : mem ? 0 : 0.5) + (IS_PC ? 1 : 0);
  let level = score >= 9 ? 3 : score >= 6.5 ? 2 : score >= 3.5 ? 1 : 0;
  const why: string[] = [];
  // phones and tablets: Medium at most (the airport is a very big place for a phone's chip), Low on weaker chips
  if (!IS_PC) level = Math.min(level, gc >= 3 ? 1 : gc >= 2 ? 1 : 0);
  if (fpsNow) { const ran = Math.max(0, ORDER.indexOf((play!.preset as any) === 'custom' ? 'medium' : play!.preset as any));
    if (fpsNow < 20) level = Math.max(0, Math.min(level, ran - 1));
    else if (fpsNow < 35) level = Math.min(level, ran);
    else if (fpsNow >= 55 && IS_PC) level = Math.max(level, Math.min(3, ran + 1));
    why.push(`It ran at about ${fpsNow} frames a second in the 3D places with ${play!.preset} quality at ${Math.round(play!.scale * 100)}% resolution`); }
  const preset = ORDER[level];
  const set: { [k: string]: any } = Object.assign({}, PRESETS[preset]);
  set.autoRes = !IS_PC || level < 2; if (set.autoRes) why.push('Automatic resolution on, so the frame rate holds when it gets busy');
  if (!IS_PC) {
    set.heightFog = false; set.fps = fpsNow && fpsNow < 45 ? 30 : 60; why.push(`Frame rate limit ${set.fps}, steady and easier on the battery`);
    // the screen's pixels: about 1.3 million drawn at most on a phone or tablet (more makes it slower, not visibly sharper)
    const pix = screen.width * screen.height * (window.devicePixelRatio || 1) ** 2, cap = Math.sqrt(1.3e6 / Math.max(1, pix));
    let sc = Math.min(set.scale, cap, level === 0 ? 0.6 : 0.75); if (fpsNow && fpsNow < 20) sc = Math.min(sc, 0.5);
    set.scale = Math.max(0.4, Math.round(sc * 20) / 20); why.push(`Resolution ${Math.round(set.scale * 100)}%: the screen is sharp and the chip works per pixel`);
    if (level === 0) { set.shadows = 'off'; set.mirror = 'off'; }
  } else set.fps = 0;
  if (msaa < 4 && set.aa === 'msaa') { set.aa = 'fxaa'; why.push('FXAA smoothing, as this graphics chip has no 4× MSAA'); }
  if (!IS_PC && set.aa === 'msaa') set.aa = 'fxaa';
  if (maxTex && maxTex < 8192 && set.shadows === 'high') { set.shadows = 'low'; why.push('Lighter shadows, for this chip\'s picture size limit'); }
  if (fpsNow && fpsNow < 20) why.push('That is too slow to play well, so the recommendation is lighter');
  why.unshift(`${preset[0].toUpperCase() + preset.slice(1)} quality suits this ${IS_PC ? 'PC' : 'device'} best`);
  const facts: [string, string][] = [['Graphics chip', gpu], ['Processor', `${cores} cores · speed ${Math.round(ops / 100) / 10}k`], ['Memory', mem ? `${mem} GB or more` : 'not told'],
    ['Screen', `${px} pixels`], ['Biggest picture', maxTex ? `${maxTex} px` : 'unknown'], ['Measured', fpsNow ? `${fpsNow} frames a second while playing` : 'not yet (play a little first)']];
  return { preset, set, facts, why, score };
}

const NAMES: { [k: string]: string } = { scale: 'Resolution', aa: 'Anti-aliasing', shadows: 'Shadows', autoRes: 'Automatic resolution', fps: 'Frame rate limit', heightFog: 'Height fog',
  ssao: 'Ambient occlusion', volLight: 'Light rays', taa: 'Temporal anti-aliasing', pcss: 'Soft contact shadows', manyLights: 'Many real lights', iblShadows: 'Sky shadows',
  parallax: 'Surface depth', flares: 'Lens flares', bloom: 'Bloom', clouds: 'Volumetric clouds', mirror: 'Mirror', probe: 'Sky reflections', particles: 'Fire and contrails' };
const show = (k: string, v: any) => typeof v === 'boolean' ? (v ? 'On' : 'Off') : k === 'scale' ? Math.round(v * 100) + '%' : k === 'fps' ? (v ? String(v) : 'No limit') : String(v).replace(/^./, c => c.toUpperCase());

/** Opens the scan: a moment of "Scanning…", then the result with Apply and Keep my settings. */
export function openDeviceScan(after: () => void) {
  document.querySelector('.ds-wrap')?.remove();
  const w = document.createElement('div'); w.className = 'ds-wrap'; w.innerHTML = `<div class="ds-card" role="dialog" aria-label="Device scan"><div class="ds-scan"><i></i><b>Scanning this device…</b><small>Processor, memory, graphics chip and screen</small></div></div>`;
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('in'));
  setTimeout(() => {
    const r = scanDevice(); const g: any = S.gfx;
    const diff = Object.keys(r.set).filter(k => NAMES[k] && String(g[k]) !== String(r.set[k]));
    const card = w.querySelector('.ds-card') as HTMLElement;
    card.innerHTML = `<div class="ds-head"><b>Recommended for this ${IS_PC ? 'PC' : 'device'}</b><span class="ds-q ${r.preset}">${r.preset[0].toUpperCase() + r.preset.slice(1)}</span></div>
      <div class="ds-body"><div class="ds-facts">${r.facts.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>
      <div class="ds-rec"><ul>${r.why.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      ${diff.length ? `<div class="ds-diff"><small>What changes</small>${diff.map(k => `<div><span>${esc(NAMES[k])}</span><em>${esc(show(k, g[k]))}</em><i>→</i><b>${esc(show(k, r.set[k]))}</b></div>`).join('')}</div>` : '<p class="ds-same">Your settings already match.</p>'}</div></div>
      <div class="ds-foot"><button class="ds-no" data-ds="no">Keep my settings</button><button class="ds-yes" data-ds="yes" ${diff.length ? '' : 'disabled'}>Apply</button></div>`;
    card.onclick = e => { const b = (e.target as HTMLElement).closest('[data-ds]') as HTMLElement; if (!b) return;
      if (b.getAttribute('data-ds') === 'yes') { Object.assign(S.gfx, r.set); (S.gfx as any).preset = r.preset; saveSettings('preset'); }
      w.classList.remove('in'); setTimeout(() => { w.remove(); after(); }, 200); };
    (card.querySelector('.ds-yes:not([disabled])') as HTMLElement || card.querySelector('.ds-no') as HTMLElement).focus();
  }, 700);
  w.addEventListener('click', e => { if (e.target === w) { w.classList.remove('in'); setTimeout(() => w.remove(), 200); } });
}
