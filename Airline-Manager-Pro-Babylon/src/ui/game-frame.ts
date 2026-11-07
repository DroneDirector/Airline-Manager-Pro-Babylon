// The airline game's interface (www/game: the Overview, the crew, the fleet, every menu and screen) over the whole
// screen, opened from the title screen: New game, Continue game, Load game, Save game or UI. Back to the title screen
// and Quit in it come here; the 3D view of a flight opens this edition's 3D viewer. Closed, it is taken away
// completely, so its memory goes back.
let frame: HTMLIFrameElement | null = null;
let handlers: { title: () => void; exit: () => void; viewer: (id: string) => void } | null = null;
const flightSubs: ((d: any) => void)[] = [], airportSubs: ((d: any) => void)[] = [];
const wxSubs: ((d: any) => void)[] = [], petSubs: ((d: any) => void)[] = [];
const roomSubs: ((d: any) => void)[] = [], monSubs: ((d: any) => void)[] = [], courtSubs: ((d: any) => void)[] = [];
/** A hearing in the courtroom, as the game runs it: who speaks, who stands, the exhibits, looking round, the end. */
export function onGameCourt(f: (d: any) => void) { courtSubs.push(f); }
/** The game over the 3D place, see-through (a hearing: its dialogue box over the edition's hall), or not. */
export function gameOverlay(on: boolean) {
  if (!frame) return; frame.classList.toggle('over', on);
  if (on) { frame.classList.remove('away'); wake(); document.body.classList.add('game-on'); setTimeout(() => { try { frame && frame.focus(); } catch (e) { /* later */ } }, 100); }
}
/** The Operations monitor's picture, drawn by the game every few seconds. */
export function onGameMonitor(f: (d: any) => void) { monSubs.push(f); }
/** A 3D place the game asks for (your office…): the game goes out of sight and waits behind it. */
export function onGameRoom(f: (d: any) => void) { roomSubs.push(f); }
/** An airport's layout, as the game sends it when the 3D viewer asks. */
export function onGameAirport(f: (d: any) => void) { airportSubs.push(f); }
/** The real weather where the 3D viewer is: the nearest airport report, as the game sends it when asked. */
/** The game's pet editor asking for a picture of your pet. */
export function onGamePetPreview(f: (d: any) => void) { petSubs.push(f); }
export function onGameWx(f: (d: any) => void) { wxSubs.push(f); }
/** The departures and arrivals for the timetable screens, as the game sends them when asked. */
const fidsSubs: ((d: any) => void)[] = [];
export function onGameFids(f: (d: any) => void) { fidsSubs.push(f); return () => { const i = fidsSubs.indexOf(f); if (i >= 0) fidsSubs.splice(i, 1); }; }
/** The flight the 3D viewer follows, as the game sends it (several times a second). */
export function onGameFlight(f: (d: any) => void) { flightSubs.push(f); }
/** A message to the game (follow a flight, stop, save). */
/** Back from fully hidden: its maps and lists measure themselves again. */
const wake = () => setTimeout(() => { try { frame && frame.contentWindow && frame.contentWindow.dispatchEvent(new Event('resize')); } catch (e) { /* gone */ } }, 30);
export function gameSend(m: any) { try { if (frame && frame.contentWindow) frame.contentWindow.postMessage(m, '*'); } catch (e) { /* gone */ } }
/** The game out of sight, still running (its airline, schedules and flights go on): the 3D viewer is in front. */
export function gameHide() { if (frame) { frame.classList.add('away'); document.body.classList.remove('game-on'); } }
export function gameShow() { if (frame) { gameSend({ ampb: 'stop' }); frame.classList.remove('away', 'over'); wake(); document.body.classList.add('game-on'); setTimeout(() => { try { frame && frame.focus(); } catch (e) { /* later */ } }, 200); } }
export function gameHidden(): boolean { return !!frame && frame.classList.contains('away'); }

export function gameOpen(act: 'new' | 'continue' | 'load' | 'save' | 'ui', on: { title: () => void; exit: () => void; viewer: (id: string) => void }) {
  gameClose(); handlers = on;
  const f = document.createElement('iframe'); f.className = 'game-frame'; f.setAttribute('title', 'Airport Dynasty Pro');
  f.setAttribute('allow', 'autoplay; fullscreen; gamepad; clipboard-write');
  f.src = `game/index.html?embed=${act}&n=${Date.now().toString(36)}`;
  document.body.appendChild(f); document.body.classList.add('game-on'); frame = f;
  requestAnimationFrame(() => f.classList.add('in'));
  setTimeout(() => { try { f.focus(); } catch (e) { /* later */ } }, 400);
}
export function gameIsOpen(): boolean { return !!frame && !frame.classList.contains('away'); }
export function gameExists(): boolean { return !!frame; }
export function gameClose() {
  const f = frame; frame = null; document.body.classList.remove('game-on'); if (!f) return;
  try { f.src = 'about:blank'; } catch (e) { /* gone */ }
  f.remove();
}
window.addEventListener('message', (e: MessageEvent) => {
  const d: any = e.data; if (!d || !d.amp || !frame || e.source !== frame.contentWindow || !handlers) return;
  const h = handlers;
  if (d.amp === 'title') { gameClose(); h.title(); }
  else if (d.amp === 'exit') h.exit();
  else if (d.amp === 'viewer3d') { if (d.crash) { gameHide(); h.viewer('crash:' + d.crash); } else if (d.id) { gameHide(); h.viewer(d.id); } else { gameClose(); h.viewer(''); } }
  else if (d.amp === 'room') { gameHide(); for (const f of roomSubs) { try { f(d); } catch (err) { console.error(err); } } }
  else if (d.amp === 'court') { for (const f of courtSubs) { try { f(d); } catch (err) { console.error(err); } } }
  else if (d.amp === 'monitor') { for (const f of monSubs) { try { f(d); } catch (err) { console.error(err); } } }
  else if (d.amp === 'airport') { for (const f of airportSubs) { try { f(d); } catch (err) { console.error(err); } } }
  else if (d.amp === 'petprev') { for (const f of petSubs) { try { f(d); } catch (err) { console.error(err); } } }
  else if (d.amp === 'wx') { for (const f of wxSubs) { try { f(d); } catch (err) { console.error(err); } } }
  else if (d.amp === 'fids') { for (const f of fidsSubs) { try { f(d); } catch (err) { console.error(err); } } }
  else if (d.amp === 'flight') { for (const f of flightSubs) { try { f(d); } catch (err) { console.error(err); } } }
});
