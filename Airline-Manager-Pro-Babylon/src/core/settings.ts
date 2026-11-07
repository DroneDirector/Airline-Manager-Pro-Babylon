// Settings: graphics and controls only. Kept on this device (localStorage); every change takes effect at once.
import { IS_PC } from './app';

export type Preset = 'low' | 'medium' | 'high' | 'ultra' | 'custom';
export interface Gfx {
  preset: Preset; scale: number; fps: number; aa: 'off' | 'fxaa' | 'msaa'; shadows: 'off' | 'low' | 'high';
  mirror: 'off' | 'low' | 'high'; probe: boolean; glow: boolean; bloom: boolean; ssao: boolean; aces: boolean; exposure: number;
  sharpen: boolean; fov: number; clouds: 'low' | 'medium' | 'high' | 'ultra'; terrain: boolean; showFps: boolean; showCpu: boolean; showGpu: boolean; showMem: boolean; particles: 'low' | 'high';
  iblShadows: boolean; manyLights: boolean; volLight: boolean; heightFog: boolean; ssr: boolean; pcss: boolean; taa: boolean;
  eyeAdapt: boolean; flares: boolean; dof: boolean; mblur: boolean; parallax: boolean; wetRain: boolean; glint: boolean; renderer: 'webgl' | 'webgpu'; autoRes: boolean; ktx2: boolean; shadowDist: number; shadowEvery: number; liveRefl: boolean; liveReflQ: number; reflMode: 'off' | 'live' | 'screen' | 'both'; ssrQ: number; liveJet: boolean;
}
export interface Controls {
  pad: string; padLook: number; padDead: number; padInvert: boolean; padSwap: boolean; padVibrate: boolean;
  touchLook: number; touchStick: number; mouseLook: number; mouseInvert: boolean;
}
export interface Settings { gfx: Gfx; ctl: Controls; music: boolean }

export const PRESETS: { [k: string]: Partial<Gfx> } = {
  low: { scale: 0.6, aa: 'off', shadows: 'off', mirror: 'low', probe: false, glow: true, bloom: false, ssao: false, sharpen: false, particles: 'low', clouds: 'low', iblShadows: false, manyLights: false, volLight: false, heightFog: false, pcss: false, taa: false, eyeAdapt: true, flares: false, dof: false, mblur: false, parallax: false, wetRain: true, glint: true },
  medium: { scale: 0.8, aa: 'fxaa', shadows: 'low', mirror: 'low', probe: true, glow: true, bloom: true, ssao: false, sharpen: false, particles: 'high', clouds: 'medium', iblShadows: false, manyLights: false, volLight: false, heightFog: IS_PC, pcss: false, taa: false, eyeAdapt: true, flares: true, dof: false, mblur: false, parallax: false, wetRain: true, glint: true },
  high: { scale: 1, aa: 'msaa', shadows: 'high', mirror: 'high', probe: true, glow: true, bloom: true, ssao: false, sharpen: true, particles: 'high', clouds: 'high', iblShadows: false, manyLights: IS_PC, volLight: true, heightFog: IS_PC, pcss: true, taa: true, eyeAdapt: true, flares: true, dof: false, mblur: false, parallax: true, wetRain: true, glint: true },
  ultra: { scale: IS_PC ? 1.25 : 1, aa: 'msaa', shadows: 'high', mirror: 'high', probe: true, glow: true, bloom: true, ssao: true, sharpen: true, particles: 'high', clouds: 'ultra', iblShadows: IS_PC, manyLights: true, volLight: true, heightFog: IS_PC, pcss: true, taa: true, eyeAdapt: true, flares: true, dof: false, mblur: false, parallax: true, wetRain: true, glint: true },
};
const DEF: Settings = {
  gfx: Object.assign({ renderer: 'webgl', autoRes: !IS_PC, ktx2: !IS_PC, shadowDist: IS_PC ? 400 : 150, shadowEvery: 1, liveRefl: false, liveReflQ: 0.5, reflMode: 'off', ssrQ: 0.5, liveJet: IS_PC, preset: (IS_PC ? 'high' : 'medium') as Preset, fps: IS_PC ? 0 : 60, terrain: true, aces: true, exposure: 1, fov: 70, showFps: false, showCpu: false, showGpu: false, showMem: false } as any, PRESETS[IS_PC ? 'high' : 'medium']),
  ctl: { pad: '', padLook: 1, padDead: 0.15, padInvert: false, padSwap: false, padVibrate: true, touchLook: 1, touchStick: 1, mouseLook: 1, mouseInvert: false },
  music: true,
};
const KEY = 'ampb-settings';
function load(): Settings {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    // once, on phones and tablets: height fog off (it draws the whole place a second time every frame)
    if (s && s.gfx && !IS_PC && !s.gfx.fogOff1) { s.gfx.heightFog = false; s.gfx.fogOff1 = true; }
    if (s) return { gfx: Object.assign({}, DEF.gfx, s.gfx), ctl: Object.assign({}, DEF.ctl, s.ctl), music: s.music !== false }; } catch (e) { /* the defaults */ }
  return JSON.parse(JSON.stringify(DEF));
}
export const S: Settings = load();
const subs: ((what: string) => void)[] = [];
/** Something to do when a setting changes (what: the setting's name, or 'preset'). */
export function onSettings(f: (what: string) => void) { subs.push(f); }
export function saveSettings(what: string) {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* not kept */ }
  for (const f of subs) { try { f(what); } catch (e) { console.error(e); } }
}
export function applyPreset(p: Preset) { if (p !== 'custom') Object.assign(S.gfx, PRESETS[p]); S.gfx.preset = p; saveSettings('preset'); }
export function resetControls() { S.ctl = JSON.parse(JSON.stringify(DEF.ctl)); saveSettings('ctl'); }
