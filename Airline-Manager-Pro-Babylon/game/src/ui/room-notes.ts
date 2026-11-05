// Messages while you are in a room. In the courtroom: nothing (no pop-ups, no message sounds), the court is serious.
// In your office and in Operations, walking about or in your chair: a notification card at the top, to read only (it
// doesn't take you anywhere: leave the room to follow it up). With the phone in your hand, or the laptop or a monitor
// zoomed in: the message arrives on that screen, like a notification on a phone or a computer, and tapping it asks
// whether you want to go to it (a flight: the room closes and the 3D view opens on it).

/** In a room, and which. */
function roomNow(): 'court' | 'office' | 'ops' | '' {
  if (typeof CourtRoom !== 'undefined' && CourtRoom.on) return 'court';
  if (typeof OfficeRoom !== 'undefined' && OfficeRoom.on) return 'office';
  if (typeof OpsRoom !== 'undefined' && OpsRoom.on) return 'ops';
  return '';
}
/** The screen you are looking at in a room (the phone or laptop, or a monitor zoomed in), if any. */
function roomZoomEl(): HTMLElement | null {
  const L: any = Lap; if (L.root && L.root.isConnected) return L.root.querySelector(L.phone ? '.ph-os' : '.lap-os');
  const r = roomNow(); if (r === 'ops' && OpsRoom.overlay) return OpsRoom.overlay as HTMLElement; if (r === 'office' && OfficeRoom.overlay) return OfficeRoom.overlay as HTMLElement;
  return null;
}
function roomJustTouched(): boolean { try { return performance.now() - _tsInput < 1500; } catch (e) { return false; } }

/** A notification card at the top of the room, to read; it goes after a few seconds (or tap it away). */
function roomCard(title: string, kind?: string) {
  const r = roomNow(), host = r === 'office' ? OfficeRoom.root : r === 'ops' ? OpsRoom.root : null; if (!host) return;
  (host as HTMLElement).querySelectorAll('.room-note').forEach(o => o.remove());
  const el = document.createElement('div'); el.className = 'room-note' + (kind === 'warn' ? ' warn' : '');
  let d = new Date(); try { d = companyDate(); } catch (e) { /* the clock */ }
  el.innerHTML = `<span class="rn-ic">${icon(kind === 'warn' ? 'alert' : 'bell')}</span><span class="rn-t"><b>${esc(title)}</b><small>${d.toTimeString().slice(0, 5)} · leave the ${r === 'office' ? 'office' : 'operations room'} to follow it up</small></span>`;
  const gone = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); };
  el.addEventListener('pointerdown', e => { e.stopPropagation(); gone(); });
  (host as HTMLElement).appendChild(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { if (el.isConnected) gone(); }, 6000);
}

/** Tapped a message about a flight on a screen in a room: do you want to see it? Yes: out of the room, into 3D. */
function roomAskFlight(f: any) {
  const p = pilot(f.pilotId), who = p ? p.name : f.callsign, r = roomNow();
  const what = f.phase === 'Final' ? 'on final' : f.phase === 'Descent' ? 'coming down' : f.phase === 'Taxi' || f.phase === 'Boarding' ? 'at ' + f.from : 'in the air';
  confirmChange(`Do you want to see ${who} ${what}?`, `You leave the ${r === 'ops' ? 'operations room' : 'office'}, and the 3D view opens on ${f.callsign}${f.to ? ' to ' + f.to : ''}.`, 'Yes, show me', 'No',
    () => { closeAll(); roomTo3d(f.id); }, () => closeTop());
}
/** Leave the room (its own loading screen) and open the 3D view on a flight. */
function roomTo3d(id: string) {
  const go = () => { try { if (v3dSupported()) v3dOpen(id, _curMap(), null); else showFlightOnMap(id); } catch (e) { /* the overview */ } };
  const r = roomNow();
  if (r === 'office') { exitSplash('office', 'Leaving the office', [{ pct: 30, step: 'Closing the office…', run: () => OfficeRoom.close(true) }, { pct: 55, step: 'Clearing the room from memory…', run: exitFreeMemory }, { pct: 85, step: 'Opening the 3D view…', run: () => refresh() }], go); return; }
  if (r === 'ops') { exitSplash('ops', 'Leaving Operations', [{ pct: 30, step: 'Switching off the screens…', run: () => OpsRoom.close(true) }, { pct: 55, step: 'Clearing the room from memory…', run: exitFreeMemory }, { pct: 85, step: 'Opening the 3D view…', run: () => refresh() }], go); return; }
  go();
}

(function roomHush() {
  const W: any = window;
  const t0 = W.toast;
  if (typeof t0 === 'function') W.toast = function (msg: string, kind?: any, action?: any) {
    const r = roomNow(); if (!r || roomJustTouched()) return t0.call(this, msg, kind, action);
    if (r === 'court') return;   // nothing in court
    if (roomZoomEl()) { if (action) return; return t0.call(this, msg, kind); }   // the screen in front of you shows messages itself
    roomCard(msg, kind);   // in the room: a card to read
  };
  // no message sounds in court
  const S: any = Sound;
  for (const k of ['chime', 'purchase', 'payOut']) { const f = S[k]; if (typeof f === 'function') S[k] = function (...a: any[]) { if (roomNow() === 'court' && !roomJustTouched()) return; return f.apply(S, a); }; }
})();
