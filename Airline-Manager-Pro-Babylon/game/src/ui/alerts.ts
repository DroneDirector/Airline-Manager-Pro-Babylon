// Alerts for the messages that matter: conduct reports, the court (a case, a hearing, a verdict), the
// aviation authority, serious accidents, staff reporting a safety problem. Each one, as it arrives:
//  - pops up in the app (a toast with Open) with a chime, if it hasn't one of its own,
//  - and shows as a notification on the phone or in Windows, also when the app is in the background,
//    following Settings → Notifications (quiet hours, and "inbox only" or "off" per kind).
// Every message is stamped with the time it was received, shown in the inbox and on the message.

const _alertSeen = new Set<string>();
let _alertN = 0;

function alertsStart() {
  for (const n of State.notices as any[]) _alertSeen.add(n.id);   // what was already there isn't new
  setInterval(() => { try { alertsTick(); } catch (e) { /* next time */ } }, 1500);
  const cap = (window as any).Capacitor, LN = cap && cap.Plugins && cap.Plugins.LocalNotifications;
  if (LN && LN.checkPermissions) Promise.resolve(LN.checkPermissions()).then((p: any) => { if (p && p.display !== 'granted' && LN.requestPermissions) return LN.requestPermissions(); }).catch(() => { /* not allowed */ });
  // Windows (and browsers) ask once for permission to show notifications, on the first click
  if (DESKTOP && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    const ask = () => { document.removeEventListener('click', ask, true); try { Notification.requestPermission(); } catch (e) { /* not supported */ } };
    document.addEventListener('click', ask, true);
  }
}

/** Is this a message you should hear about straight away? */
function alertWorthy(n: any): boolean {
  if (n.ref && /^case-/.test(String(n.ref))) return true;
  if (n.kind === 'authority') return true;
  return /^Conduct report|court|hearing|verdict|Serious accident|crash|reports a safety problem|stand in|charged|arrested/i.test(n.title || '');
}

function alertsTick() {
  const list = State.notices as any[];
  for (let i = 0; i < Math.min(list.length, 40); i++) {
    const n = list[i]; if (_alertSeen.has(n.id)) continue;
    _alertSeen.add(n.id);
    if (!n.at) n.at = Date.now();   // the moment it was received
    // on the phone in your hand: every new message (the court's and the investigators' come as mail instead)
    if (!/^(inv|case)-/.test(String(n.ref || '')) && ntRule(n.kind) !== 'off') { try { phoneNote({ title: n.title, body: String(n.body || '').slice(0, 140), ic: 'bell', c: '#F2A93B', notice: n.id }); } catch (e) { /* no phone */ } }
    if (!alertWorthy(n) || ntRule(n.kind) !== 'show') continue;
    const quiet = quietAt(Date.now());
    // in the app: a toast, unless the message brought its own
    if (!/^Conduct report|^Court is in session/.test(n.title) && !document.hidden && !quiet) {
      try { toast(n.title, 'warn', { label: 'Open', act: 'alert-open', data: n.id }); Sound.chime(); } catch (e) { /* not ready */ }
    }
    if (!quiet) alertOs(n);
  }
}
ACTIONS['alert-open'] = el => { const t = el.closest && el.closest('.toast'); if (t) t.remove(); const e = document.createElement('b'); e.setAttribute('data-id', el.getAttribute('data-id')); ACTIONS['open-notice'](e, null); };

/** A notification on the phone (Android) or in Windows. */
function alertOs(n: any) {
  const title = n.title, body = String(n.body || '').slice(0, 240);
  const cap = (window as any).Capacitor, LN = cap && cap.Plugins && cap.Plugins.LocalNotifications;
  if (LN) {
    const id = 7000 + (_alertN++ % 500);
    Promise.resolve(LN.schedule({ notifications: [{ id, title, body, schedule: { at: new Date(Date.now() + 800), allowWhileIdle: true }, extra: { notice: n.id } }] })).catch(() => { /* not allowed */ });
    return;
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && (DESKTOP || document.hidden)) {
    try { const w = new Notification(title, { body, tag: n.id }); w.onclick = () => { try { if ((window as any).__unseen) { (window as any).__unseen = false; (window as any).__quitting = false; try { localStorage.removeItem('amp-quit'); } catch (x) { /* ignore */ } fetch('/api/show', { method: 'POST' }).catch(() => { /* older PC app */ }); } window.focus(); const e = document.createElement('b'); e.setAttribute('data-id', n.id); ACTIONS['open-notice'](e, null); } catch (e) { /* closed */ } w.close(); }; } catch (e) { /* not supported */ }
  }
}

/** "1 Nov 2026 at 16:42": the date and the time a message came. */
function atText(at: number): string {
  const d = new Date(at);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${d.toTimeString().slice(0, 5)}`;
}
