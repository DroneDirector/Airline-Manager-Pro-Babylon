// Updates from inside the game: it looks at the published releases (GitHub), shows what the new version holds, and
// installs it. On Android the app downloads the new APK and hands it to Android's installer (it installs over this
// version and keeps everything); on the PC the PC app downloads the new installer, closes, installs it and opens
// again. It checks by itself at most every 6 hours, and at any time from Settings → Updates.
import { registerPlugin } from '@capacitor/core';
import { APP } from './app';

export interface UpdateInfo { version: string; url: string; notes: string; size: number; page: string }
export type UpdState = 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'installing' | 'permission' | 'failed';
const AppUpdate: any = registerPlugin('AppUpdate');
const KEY = 'ampb-update-check';
export const IS_ELECTRON = /Electron/i.test(navigator.userAgent);
const IS_ANDROID_APP = !!(window as any).Capacitor && (window as any).Capacitor.getPlatform && (window as any).Capacitor.getPlatform() === 'android';

export const U = { state: 'idle' as UpdState, info: null as UpdateInfo | null, pct: -1, error: '', listening: false };
const subs: (() => void)[] = [];
/** Something to redraw when the update's state changes. */
export function onUpdate(f: () => void) { subs.push(f); }
function changed() { for (const f of subs) { try { f(); } catch (e) { console.error(e); } } }
/** Can this copy install updates itself (the Android app and the PC app can; a browser can't). */
export function canSelfUpdate(): boolean { return IS_ANDROID_APP || IS_ELECTRON; }

export function cmpVersion(a: string, b: string): number {
  const pa = String(a).split(/[.-]/).map(n => parseInt(n, 10) || 0), pb = String(b).split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
/** At start-up: a quiet check if the last one was more than 6 hours ago. */
export function updateInit(found: (v: string) => void) {
  if (!canSelfUpdate() || !APP.updates) return;
  let last = 0; try { last = Number(localStorage.getItem(KEY)) || 0; } catch (e) { /* no storage */ }
  if (Date.now() - last > 6 * 3600 * 1000) setTimeout(() => { updateCheck().then(() => { if (U.state === 'available' && U.info) found(U.info.version); }); }, 9000);
  // back from Android's "install unknown apps" setting: carry on with the install
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || U.state !== 'permission') return;
    AppUpdate.canInstall().then((r: any) => { if (r && r.canInstall) updateInstall(); else { U.state = 'available'; changed(); } }).catch(() => { /* later */ });
  });
}
/** Looks for a newer published version (every page of releases is read, the highest version wins). */
export async function updateCheck(): Promise<void> {
  if (!APP.updates || U.state === 'downloading' || U.state === 'installing') return;
  U.state = 'checking'; U.error = ''; changed();
  try {
    const page = (n: number) => fetch(`https://api.github.com/repos/${APP.updates.repo}/releases?per_page=100&page=${n}&t=${Date.now()}`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    const r = await page(1); if (!r.ok) throw new Error(`The update server answered ${r.status} ${r.statusText}`);
    let list: any[] = await r.json();
    for (let n = 2; n <= 5 && list.length === (n - 1) * 100; n++) { try { const rn = await page(n); if (!rn.ok) break; list = list.concat(await rn.json()); } catch (e) { break; } }
    const pre = APP.updates.tagPrefix;
    const rel = list.filter(x => !x.draft && String(x.tag_name).indexOf(pre) === 0).sort((a, b) => cmpVersion(b.tag_name.slice(pre.length), a.tag_name.slice(pre.length)))[0];
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* no storage */ }
    const v = rel ? rel.tag_name.slice(pre.length) : '';
    // the phone takes the Android app, the PC its installer
    const file = rel && (rel.assets || []).filter((a: any) => IS_ELECTRON ? /-PC-Setup-.*\.exe$/i.test(a.name) : /\.apk$/i.test(a.name))[0];
    if (!rel || cmpVersion(v, APP.version) <= 0) { U.state = 'latest'; U.info = null; changed(); return; }
    U.info = { version: v, url: file ? file.browser_download_url : '', notes: rel.body || '', size: file ? file.size : 0, page: rel.html_url };
    if (!file) { U.state = 'failed'; U.error = `Version ${v} is published, but its ${IS_ELECTRON ? 'PC' : 'Android'} download isn't there yet. Try again in a few minutes.`; changed(); return; }
    U.state = 'available'; changed();
  } catch (e: any) { U.state = 'failed'; U.error = `Couldn't check for updates: ${(e && e.message) || e}. Check that the ${IS_ELECTRON ? 'PC' : 'device'} is online and try again.`; changed(); }
}
const REASONS: { [k: string]: string } = {
  FAILURE_CONFLICT: 'Android says the new version conflicts with the installed one (it was signed with another key). Uninstall the app once and install the new version; after that, updates install over it.',
  FAILURE_INCOMPATIBLE: 'Android says this version isn\'t compatible with this device.',
  FAILURE_INVALID: 'Android says the downloaded file isn\'t a valid app. It may have been damaged on the way; try again.',
  FAILURE_STORAGE: 'There isn\'t enough free storage to install the update.',
  FAILURE_BLOCKED: 'The install was blocked, usually by Google Play Protect or a device policy. Allow the app in Play Protect and try again.',
  FAILURE_ABORTED: 'The install was cancelled.',
  FAILURE_TIMEOUT: 'Android took too long to install the update. Try again.',
  DOWNLOAD_FAILED: 'The download failed. Check the internet connection and try again.',
  INSTALL_SESSION_FAILED: 'Android couldn\'t start the install.',
  CONFIRM_FAILED: 'Android couldn\'t show the install confirmation.',
};
/** Download and install the new version. */
export async function updateInstall(): Promise<void> {
  if (!U.info || !U.info.url) return;
  if (IS_ELECTRON) return installPc();
  if (!U.listening) {
    U.listening = true;
    AppUpdate.addListener('updateProgress', (p: any) => { U.pct = p.pct; U.state = p.pct >= 100 ? 'installing' : 'downloading'; changed(); });
    AppUpdate.addListener('updateResult', (r: any) => {
      if (r.ok) { U.state = 'installing'; changed(); return; }
      U.state = 'failed'; U.error = (REASONS[r.code] || 'Android refused to install the update.') + (r.message ? ` (${r.message})` : ''); changed();
    });
  }
  try {
    const r = await AppUpdate.installUpdate({ url: U.info.url });
    if (r && r.needsPermission) { U.state = 'permission'; changed(); return; }
    U.state = 'downloading'; U.pct = 0; changed();
  } catch (e: any) { U.state = 'failed'; U.error = 'The update couldn\'t be installed: ' + ((e && e.message) || e); changed(); }
}
/** Android: the "install unknown apps" setting for this app, needed once. */
export function updatePermission() { AppUpdate.openInstallPermission().catch(() => { /* not there */ }); }
/** The PC app downloads the new installer, closes, installs it quietly over itself and opens again. */
async function installPc() {
  const fail = (m: string) => { U.state = 'failed'; U.error = m; changed(); };
  let r: any;
  try { r = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: U.info!.url, version: U.info!.version }) }).then(x => x.ok ? x.json() : null); }
  catch (e) { return fail('The PC app didn\'t answer.'); }
  if (!r) return fail('This PC app is too old to update itself. Download the new version once from the release page; after that, updates install from here.');
  U.state = 'downloading'; U.pct = 0; changed();
  const poll = () => fetch('/api/update').then(x => x.json()).then((s: any) => {
    if (s.state === 'failed') return fail(s.error || 'The update failed.');
    if (s.state === 'downloading') { U.state = 'downloading'; U.pct = s.pct; changed(); }
    if (s.state === 'installing') { U.state = 'installing'; U.pct = 100; changed(); }
    setTimeout(poll, 600);
  }, () => { U.state = 'installing'; changed(); /* the PC app has closed to install; it opens again by itself */ });
  poll();
}
export function updateStatus(): string {
  switch (U.state) {
    case 'checking': return 'Checking for updates…';
    case 'latest': return 'You have the latest version';
    case 'available': return `Version ${U.info!.version} is ready to install`;
    case 'downloading': return U.pct >= 0 ? `Downloading version ${U.info!.version}: ${U.pct}%` : `Downloading version ${U.info!.version}…`;
    case 'installing': return IS_ELECTRON ? 'Installing: the game closes and opens again with the new version' : 'Installing: the game restarts when it is done';
    case 'permission': return 'Waiting for permission to install updates';
    case 'failed': return U.error || 'The last update attempt failed';
    default: return canSelfUpdate() ? 'Updates install over this version and keep your settings' : 'Updates install in the Android app and the PC app';
  }
}
