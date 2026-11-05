// Battery of the device the app runs on, shown next to the link to your PC: charge level, and whether it
// is charging by cable or wirelessly. On Android it is read from the phone itself (which tells wireless
// charging apart); elsewhere from the browser, where wireless charging can't be told apart. Devices
// without a battery (a desktop PC) show nothing.

const Battery = {
  info: null as { level: number; charging: boolean; full?: boolean; plugged: string } | null,
  _web: null as any,

  init() {
    const T = Store.native();
    const read = (): Promise<any> => T && T.battery ? T.battery().then((b: any) => b && b.present !== false && b.level >= 0 ? { level: b.level, charging: !!b.charging, full: !!b.full, plugged: b.plugged || 'none' } : null)
      : this._web ? Promise.resolve(this.fromWeb(this._web)) : Promise.resolve(null);
    const update = () => read().then(b => { const was = JSON.stringify(this.info); this.info = b; if (JSON.stringify(b) !== was) this.paint(); }).catch(() => { /* no battery information */ });
    if (!(T && T.battery) && (navigator as any).getBattery) {
      (navigator as any).getBattery().then((bm: any) => { this._web = bm; ['levelchange', 'chargingchange'].forEach(ev => bm.addEventListener(ev, update)); update(); }).catch(() => { /* not available */ });
    } else update();
    setInterval(update, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  },

  fromWeb(bm: any) {
    // a desktop without a battery reports "full and charging" with no charging time
    if (bm.level === 1 && bm.charging && bm.chargingTime === 0 && DESKTOP) return null;
    return { level: Math.round(bm.level * 100), charging: !!bm.charging, full: bm.level === 1 && bm.charging, plugged: bm.charging ? 'cable' : 'none' };
  },

  html(): string {
    const b = this.info; if (!b) return '';
    const low = !b.charging && b.level <= 15, how = !b.charging ? '' : b.plugged === 'wireless' ? 'wireless' : 'cable';
    const label = `Battery ${b.level}%${b.full ? ', fully charged' : b.charging ? (how === 'wireless' ? ', charging wirelessly' : ', charging') : ''}`;
    const fill = Math.max(2, Math.round(b.level / 100 * 14));
    return `<span class="batt ${low ? 'low' : ''} ${b.charging ? 'chg' : ''}" role="img" aria-label="${label}" title="${label}">
      <svg class="batt-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="7" width="17" height="10" rx="2.2"/><path d="M21.5 10.5v3" stroke-linecap="round"/><rect class="batt-fill" x="4.2" y="8.7" width="${fill}" height="6.6" rx="1" fill="currentColor" stroke="none"/></svg>
      <b>${b.level}%</b>${b.charging ? `<svg class="batt-bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 5 13.5h6L10 22l9-12h-6.2z" fill="currentColor"/></svg>` : ''}${how === 'wireless' ? `<svg class="batt-wl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="12" r="5.6"/><circle cx="12" cy="12" r="9"/></svg>` : ''}</span>`;
  },

  paint() {
    const el = document.querySelector('.topbar .batt-slot'); if (el) el.innerHTML = this.html();
    const v = document.querySelector('.v3d .v3d-batt'); if (v) v.innerHTML = this.html();   // in the 3D view too, after the camera buttons
  },
};
