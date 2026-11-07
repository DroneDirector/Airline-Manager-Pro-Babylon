// Problems the 3D places run into, for the game's log (Settings → Updates and errors): kept on the device until the
// game's interface reads them, then shown there with their details.
import { gameSend } from '../ui/game-frame';
const LOG_KEY = 'ampb.partlog';
export function logProblem(area: string, title: string, message: string, detail = '') {
  try { const q = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); q.push({ kind: 'problem', area, title, message, detail, at: Date.now() }); localStorage.setItem(LOG_KEY, JSON.stringify(q.slice(-50))); } catch (e) { /* no storage */ }
  try { gameSend({ ampb: 'partlog' }); } catch (e) { /* the interface is not open */ }
}

// Performance problems (instancing, texture arrays, merging) are reported at the start screen the next time it opens, like a
// crash screen; they also go into the game's log, and on the PC into Documents\Airport Dynasty Pro\Logs\problems.log.
// Nothing ever goes missing because of one: what could not be combined is simply drawn the usual way.
const ISSUE_KEY = 'ampb.issues';
export type Issue = { at: number; place: string; what: string; why: string; detail?: string; version?: string };
export function logIssue(place: string, what: string, why: string, detail = '') {
  const it: Issue = { at: Date.now(), place, what, why, detail };
  try { (it as any).version = (window as any).__APP_VERSION__ || ''; const q: Issue[] = JSON.parse(localStorage.getItem(ISSUE_KEY) || '[]'); q.push(it); localStorage.setItem(ISSUE_KEY, JSON.stringify(q.slice(-100))); } catch (e) { /* not kept */ }
  try { logProblem(place, what, why, detail); } catch (e) { /* the game's log only */ }
  if (/Electron/i.test(navigator.userAgent)) fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(it) }).catch(() => { /* the PC app's file only */ });
}
/** The problems not yet seen (and, with clear, mark them seen). */
export function pendingIssues(clear = false): Issue[] { try { const q = JSON.parse(localStorage.getItem(ISSUE_KEY) || '[]'); if (clear) localStorage.setItem(ISSUE_KEY, '[]'); return q; } catch (e) { return []; } }
/** As text, for copying or sharing. */
export function issuesText(list: Issue[]): string {
  return list.map(i => `${new Date(i.at).toISOString().replace('T', ' ').slice(0, 19)}  ${i.place}: ${i.what}\n    ${i.why}${i.detail ? '\n    ' + i.detail.replace(/\n/g, '\n    ') : ''}`).join('\n\n');
}
