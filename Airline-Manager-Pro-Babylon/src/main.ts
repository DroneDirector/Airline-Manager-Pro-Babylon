// Airline Manager Pro, Babylon.js edition. It starts with the start screen (the film), then one place: the lounge.
// The gear in the corner is always there: graphics and controls settings. More parts of the game are added as
// sections (core/sections.ts) and opened from here.
import { makeEngine, applyScale } from './core/engine';
import { onSettings } from './core/settings';
import { inputInit, onButton, setPlay, onPad } from './core/input';
import { openSection, currentSection, SectionCtx } from './core/sections';
import { splashOpen, splashEnter, splashIsOpen } from './ui/splash';
import { settingsShow, settingsHide, settingsOpen, settingsButton } from './ui/settings-panel';
import { loadingShow, loadingProgress, loadingHide } from './ui/loading';
import { icon, toast } from './ui/icons';
import './sections/lounge/index';

const canvas = document.getElementById('bjs') as HTMLCanvasElement, ui = document.getElementById('ui') as HTMLElement;
let inPlace = false;
inputInit(canvas, ui);

// the gear: always on the screen
const gear = document.createElement('button'); gear.className = 'gear'; gear.setAttribute('aria-label', 'Settings'); gear.innerHTML = icon('gear'); ui.appendChild(gear);
gear.addEventListener('click', () => toggleSettings());
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
  if (splashIsOpen() && b === 'confirm') splashEnter();
});
onPad(name => toast(name ? `${name} connected` : 'Controller disconnected'));

/** Into a place of the game (today: the lounge), with its loading screen. */
async function enter(id: string, title: string) {
  loadingShow(title);
  const engine = makeEngine(canvas);
  const ctx: SectionCtx = { engine, canvas, ui, progress: (p, s) => loadingProgress(p, s) };
  try { await openSection(id, ctx); } catch (e) { console.error(e); loadingProgress(100, 'This place could not be opened on this device'); return; }
  loadingProgress(100, 'Welcome'); canvas.classList.add('on');
  setTimeout(() => { loadingHide(); inPlace = true; if (!settingsOpen()) setPlay(true); }, 350);
}
splashOpen(() => enter('lounge', 'Business lounge'));
