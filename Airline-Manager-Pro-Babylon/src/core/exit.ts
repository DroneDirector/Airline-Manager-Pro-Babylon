// Exit: the game shuts down completely. On Android its own small plugin closes the window, removes it from the
// recent apps and ends the process; on the PC the window closes and the program quits.
import { registerPlugin } from '@capacitor/core';
const AppExit: any = registerPlugin('AppExit');
export function exitGame() {
  try { (document.getElementById('ui') as HTMLElement).style.opacity = '0'; } catch (e) { /* as it is */ }
  if (/Electron/i.test(navigator.userAgent)) { window.close(); return; }
  AppExit.exit().catch(() => { try { window.close(); } catch (e) { /* stays */ } });
}
