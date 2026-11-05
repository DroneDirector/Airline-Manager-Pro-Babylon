// Airline Manager Pro, Babylon.js edition. It starts with the start screen (the film), then one place: the lounge.
// The gear in the corner is always there: graphics and controls settings. More parts of the game are added as
// sections (core/sections.ts) and opened from here.
import { makeEngine, applyScale, getEngine } from './core/engine';
import { onSettings } from './core/settings';
import { inputInit, onButton, setPlay, onPad } from './core/input';
import { openSection, currentSection, closeSection, SectionCtx } from './core/sections';
import { splashOpen, splashEnter, splashIsOpen, splashNav } from './ui/splash';
import { settingsShow, settingsHide, settingsOpen, settingsButton } from './ui/settings-panel';
import { loadingShow, loadingProgress, loadingHide } from './ui/loading';
import { icon, toast } from './ui/icons';
import { exitGame } from './core/exit';
import './sections/lounge/index';
import './sections/viewer3d/index';

const canvas = document.getElementById('bjs') as HTMLCanvasElement, ui = document.getElementById('ui') as HTMLElement;
let inPlace = false;
inputInit(canvas, ui);

// the gear: always on the screen
const gear = document.createElement('button'); gear.className = 'gear'; gear.setAttribute('aria-label', 'Settings'); gear.innerHTML = icon('gear'); ui.appendChild(gear);
gear.addEventListener('click', () => toggleSettings());
// Exit, beside the gear: the game shuts down completely and you are back on the desktop (PC) or home screen (Android)
const exitB = document.createElement('button'); exitB.className = 'exit'; exitB.setAttribute('aria-label', 'Exit the game'); exitB.innerHTML = `${icon('power')}<span>Exit</span>`; ui.appendChild(exitB);
exitB.addEventListener('click', () => exitGame());
// Title screen, beside Exit, in every place of the game (the 3D viewer, the lounge): back to the start screen
const titleB = document.createElement('button'); titleB.className = 'to-title'; titleB.hidden = true; titleB.setAttribute('aria-label', 'Back to the title screen'); titleB.innerHTML = `${icon('back')}<span>Title screen</span>`; ui.appendChild(titleB);
titleB.addEventListener('click', () => backToTitle());
function toggleSettings() {
  if (settingsOpen()) { settingsHide(); return; }
  setPlay(false); settingsShow(() => { if (inPlace) setPlay(true); });
}
onSettings(what => {
  if (what === 'scale' || what === 'preset') applyScale();
  const s = currentSection(); if (s && s.onSettings) s.onSettings(what);
});
onButton(b => {
  if (settingsOpen()) { settingsButton(b); return; }
  if (b === 'menu') { toggleSettings(); return; }
  if (b === 'back' && inPlace) { backToTitle(); return; }
  if (splashIsOpen() && b === 'confirm') splashEnter();
  if (splashIsOpen() && (b === 'up' || b === 'down')) splashNav(b === 'up' ? -1 : 1);
});
onPad(name => toast(name ? `${name} connected` : 'Controller disconnected'));

/** Into a place of the game (today: the lounge), with its loading screen. */
async function enter(id: string, title: string) {
  loadingShow(title);
  const engine = makeEngine(canvas);
  const ctx: SectionCtx = { engine, canvas, ui, progress: (p, s) => loadingProgress(p, s), back: backToTitle };
  try { await openSection(id, ctx); } catch (e) { console.error(e); loadingProgress(100, 'This place could not be opened on this device'); return; }
  loadingProgress(100, 'Welcome'); canvas.classList.add('on');
  setTimeout(() => { loadingHide(); inPlace = true; titleB.hidden = false; if (!settingsOpen()) setPlay(true); }, 350);
}
/** Back to the start screen from a place: it is closed and its memory given back, then the film starts again. */
function backToTitle() {
  if (!inPlace) return; inPlace = false; titleB.hidden = true; setPlay(false); if (settingsOpen()) settingsHide();
  canvas.classList.remove('on'); const e = getEngine(); if (e) e.stopRenderLoop();
  closeSection(); splashOpen(id => enter(id, TITLES[id] || id));
}
const TITLES: { [id: string]: string } = { viewer3d: '3D viewer · above the clouds', lounge: 'Business lounge' };
splashOpen(id => enter(id, TITLES[id] || id));
