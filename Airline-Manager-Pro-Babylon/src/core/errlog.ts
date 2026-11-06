// Problems the 3D places run into, for the game's log (Settings → Updates and errors): kept on the device until the
// game's interface reads them, then shown there with their details.
import { gameSend } from '../ui/game-frame';
const LOG_KEY = 'ampb.partlog';
export function logProblem(area: string, title: string, message: string, detail = '') {
  try { const q = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); q.push({ kind: 'problem', area, title, message, detail, at: Date.now() }); localStorage.setItem(LOG_KEY, JSON.stringify(q.slice(-50))); } catch (e) { /* no storage */ }
  try { gameSend({ ampb: 'partlog' }); } catch (e) { /* the interface is not open */ }
}
