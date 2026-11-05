// Exit: the game shuts down completely and gives all its memory back. First the place you are in, the 3D engine (its
// pictures, models and buffers on the graphics chip) and the sounds are released; then on Android the app's own
// plugin closes the window, removes it from the recent apps and ends the process, and on the PC the window closes and
// the program quits.
import { registerPlugin } from '@capacitor/core';
import { currentSection } from './sections';
import { getEngine } from './engine';
const AppExit: any = registerPlugin('AppExit');
export function exitGame() {
  try { (document.getElementById('ui') as HTMLElement).style.opacity = '0'; } catch (e) { /* as it is */ }
  try { const s = currentSection(); if (s) s.close(); } catch (e) { /* closing anyway */ }
  try { const e = getEngine(); if (e) { e.stopRenderLoop(); e.dispose(); } } catch (e) { /* closing anyway */ }
  try { document.querySelectorAll('audio').forEach(a => { (a as HTMLAudioElement).pause(); (a as HTMLAudioElement).src = ''; }); } catch (e) { /* none */ }
  const quit = () => {
    if (/Electron/i.test(navigator.userAgent)) { window.close(); return; }
    AppExit.exit().catch(() => { try { window.close(); } catch (e) { /* stays */ } });
  };
  setTimeout(quit, 120);
}
