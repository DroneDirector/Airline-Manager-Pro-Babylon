// Airport Dynasty Pro, Babylon.js edition. It starts with the start screen (the film), then one place: the lounge.
// The gear in the corner is always there: graphics and controls settings. More parts of the game are added as
// sections (core/sections.ts) and opened from here.
import { logProblem } from './core/errlog';
import { makeEngine, applyScale, getEngine } from './core/engine';
import { onSettings } from './core/settings';
import { inputInit, onButton, setPlay, onPad } from './core/input';
import { openSection, currentSection, closeSection, SectionCtx } from './core/sections';
import { splashOpen, splashEnter, splashIsOpen, splashNav } from './ui/splash';
import { settingsShow, settingsHide, settingsOpen, settingsButton } from './ui/settings-panel';
import { loadingShow, loadingProgress, loadingHide } from './ui/loading';
import { icon, toast } from './ui/icons';
import { exitGame } from './core/exit';
import { gameOpen, gameIsOpen, gameClose, gameShow, gameExists, gameSend, onGameRoom } from './ui/game-frame';
import { APP, IS_PC } from './core/app';
import { updateInit } from './core/update';
import { whatsNewOnStart, whatsNewIsOpen, whatsNewClose } from './ui/whats-new';
import './sections/lounge/index';
import './sections/viewer3d/index';
import './sections/office/index';
import './sections/ops/index';
import './sections/hangar/index';
import './sections/building/index';
import './sections/salute/index';
import './sections/court/index';
import './sections/terminal/index';
import './sections/site/index';

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
// the version number at the bottom of the screen in every place (the start screen has its own)
const verB = document.createElement('small'); verB.className = 'place-ver'; verB.hidden = true; verB.textContent = `v${APP.version} · Babylon.js ${APP.babylon}`; ui.appendChild(verB);
function toggleSettings() {
  if (settingsOpen()) { settingsHide(); return; }
  setPlay(false); settingsShow(() => { if (inPlace) setPlay(true); });
}
onSettings(what => {
  if (what === 'scale' || what === 'preset') applyScale();
  const s = currentSection(); if (s && s.onSettings) s.onSettings(what);
});
onButton(b => {
  if (gameIsOpen()) return;   // the game's interface has its own controls
  if (whatsNewIsOpen()) { if (b === 'back' || b === 'confirm' || b === 'menu') whatsNewClose(); return; }
  if (settingsOpen()) { settingsButton(b); return; }
  if (b === 'menu') { toggleSettings(); return; }
  if (b === 'back' && inPlace) { if (gameExists()) backToGame(); else backToTitle(); return; }
  if (splashIsOpen() && b === 'confirm') splashEnter();
  if (splashIsOpen() && (b === 'up' || b === 'down')) splashNav(b === 'up' ? -1 : 1);
});
onPad(name => toast(name ? `${name} connected` : 'Controller disconnected'));

/** Into a place of the game (today: the lounge), with its loading screen. */
async function enter(id: string, title: string, opts?: any) {
  loadingShow(title);
  const engine = await makeEngine(canvas);
  // where the loading got to: if it is still loading after two minutes, that goes to the log (Settings → Updates and errors)
  let at = { p: 0, s: 'Starting' }, opened = false;
  const ctx: SectionCtx = { engine, canvas, ui, progress: (p, s) => { at = { p, s }; loadingProgress(p, s); }, back: backToTitle, opts, toGame: opts && gameExists() ? backToGame : undefined, goTo: goToPlace };
  const watch = setTimeout(() => { if (!opened) logProblem('3d places', `${title} is taking too long to open`, `Still loading after 2 minutes, at ${Math.round(at.p)}% (${at.s}).`, `Place: ${id}\nOptions: ${JSON.stringify(opts || {}).slice(0, 300)}\nDevice: ${navigator.userAgent}`); }, 120000);
  try { await openSection(id, ctx); } catch (e: any) { clearTimeout(watch); console.error(e); loadingProgress(100, 'This place could not be opened on this device');
    logProblem('3d places', `${title} could not be opened`, `${(e && e.message) || String(e)} (at ${Math.round(at.p)}%, ${at.s})`, `Place: ${id}\nVersion: ${APP.version}\nDevice: ${navigator.userAgent}\n\n${(e && e.stack) || ''}`.slice(0, 4000)); return; }
  opened = true; clearTimeout(watch);
  loadingProgress(100, 'Welcome'); canvas.classList.add('on');
  setTimeout(() => { loadingHide(); inPlace = true; titleB.hidden = false; verB.hidden = false; document.body.classList.toggle('in-viewer', id === 'viewer3d'); if (!settingsOpen()) setPlay(true); }, 350);
}
/** From one place straight to another (the 3D viewer's Airport button): this one is closed and its memory given back. */
function goToPlace(id: string, opts?: any) {
  if (!inPlace) return; inPlace = false; setPlay(false); if (settingsOpen()) settingsHide();
  canvas.classList.remove('on'); const e = getEngine(); if (e) e.stopRenderLoop(); closeSection(); enter(id, TITLES[id] || id, opts);
}
/** Back to the start screen from a place: it is closed and its memory given back, then the film starts again. */
function backToTitle() {
  if (!inPlace) return; inPlace = false; titleB.hidden = true; verB.hidden = true; document.body.classList.remove('in-viewer'); setPlay(false); if (settingsOpen()) settingsHide();
  canvas.classList.remove('on'); const e = getEngine(); if (e) e.stopRenderLoop();
  closeSection(); gameClose(); splashOpen(pickPlace);
}
/** Back from the 3D viewer to the game's interface (it kept running behind). */
function backToGame(screen?: string) {
  if (!inPlace) return; inPlace = false; titleB.hidden = true; verB.hidden = true; document.body.classList.remove('in-viewer'); setPlay(false); if (settingsOpen()) settingsHide();
  canvas.classList.remove('on'); const e = getEngine(); if (e) e.stopRenderLoop();
  closeSection(); gameShow(); if (screen) gameSend({ ampb: 'go', screen });
}
const TITLES: { [id: string]: string } = { viewer3d: '3D viewer · above the clouds', lounge: 'Business lounge', terminal: 'The terminal · Grand Hall', site: 'Airport site · Mýrdalssandur' };
/** What was chosen on the title screen: the game (New, Continue, Load, Save, UI) or one of the demos. */
function pickPlace(id: string) {
  if (id.indexOf('game:') === 0) {
    gameOpen(id.slice(5) as any, { title: () => splashOpen(pickPlace), exit: () => exitGame(), viewer: (fid: string) => enter('viewer3d', /^crash:/.test(fid) ? '3D viewer · the crash site' : /^apt:/.test(fid) ? '3D viewer · your airport' : fid ? '3D viewer · following the flight' : TITLES.viewer3d, /^crash:/.test(fid) ? { crash: fid.slice(6) } : /^apt:/.test(fid) ? { apt: fid.slice(4) } : fid ? { live: fid } : undefined) });
    return;
  }
  enter(id, TITLES[id] || id);
}
splashOpen(pickPlace);
// a 3D place opened from the game (your office…): the game waits behind it
onGameRoom(d => { if (d.room === 'site') { if (!IS_PC) return; enter('site', 'Your airport', { site: 'myrdalssandur', walk: true, data: d.data || {} }); return; } if (d.room === 'court') enter('court', d.data && d.data.mode === 'hearing' ? 'Court is in session' : 'The courtroom', { data: d.data || {} }); else if (d.room === 'salute') enter('salute', 'Water salute', { data: d.data || {} }); else if (d.room === 'building') enter('building', ({ office: 'Your office', ops: 'The Operations office', lounge: 'The Business lounge', museum: 'Your museum' } as any)[d.at] || 'The airport', { at: d.at || 'concourse', data: d.data || {} }); else if (d.room === 'office') enter('office', 'Your office', { data: d.data || {} }); else if (d.room === 'lounge') enter('lounge', 'Business lounge', { data: d.data || {} }); else if (d.room === 'ops') enter('ops', 'The Operations office', { data: d.data || {} }); else if (d.room === 'hangar') enter('hangar', 'The hangar', { data: d.data || {} }); });
// after an update: what's new, once; and a quiet look for a newer version now and then
whatsNewOnStart();
updateInit(v => toast(`Version ${v} is ready: Settings → Updates`));
