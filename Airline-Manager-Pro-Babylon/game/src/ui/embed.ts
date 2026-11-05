// Inside the Babylon.js edition: the airline game's whole interface (the Overview, the crew, the fleet, every menu and
// screen), opened from the edition's title screen with New game, Continue game, Load game, Save game or UI. The edition
// has the title screen and the 3D places; this page has the rest.
//  - No start-up logo and no title film of its own: it opens straight at what was chosen.
//  - New game, Load game and Save game show their panels on their own; closing one goes back to the title screen.
//  - Back to the title screen (the logo in the menu) and Quit go to the edition (which closes the game completely).
//  - The 3D places (your office, the Operations room, the hangars, the lounges, the court, the museum and the rest)
//    are being rebuilt on Babylon.js: until each is ready, it says so. The 3D view of a flight opens the edition's
//    3D viewer.
const EMBED: string = (() => { try { return new URLSearchParams(location.search).get('embed') || ''; } catch (e) { return ''; } })();
function embedTell(what: string, extra?: any) { try { parent.postMessage(Object.assign({ amp: what }, extra || {}), '*'); } catch (e) { /* alone */ } }

if (EMBED) {
  const W: any = window;
  document.documentElement.classList.add('in-babylon');
  // the start-up logo screen: straight on
  W.showSplash = (then?: () => void) => { setTimeout(() => { try { if (then) then(); } catch (e) { console.error(e); } }, 0); };
  W.splashShowing = () => false;
  // no title music here: the edition's title screen has the film and the music
  W.titleMusic = () => { /* the edition plays it */ };
  W.whatsNewOnStart = () => { /* the edition shows what's new */ };
  const ownTitleOpen = W.titleOpen;
  /** The title screen's panels on their own (New game, Load game, Save game), without its film and menu. */
  const panelOnly = (act: string) => {
    ownTitleOpen(); document.documentElement.classList.add('ts-panel-only');
    setTimeout(() => { try { ACTIONS['ts-' + act](document.createElement('b'), null as any); } catch (e) { console.error(e); } }, 60);
  };
  W.titleOpen = () => { try { saveNow(true); } catch (e) { /* saved already */ } embedTell('title'); };
  W.titleAfterSplash = () => {
    // after a load or a new game the page starts again: into the game
    let next = ''; try { next = sessionStorage.getItem('amp-title-next') || ''; sessionStorage.removeItem('amp-title-next'); } catch (e) { /* none */ }
    // the same opening only once (a reload of this page, after a load, goes into the game)
    let nonce = ''; try { nonce = new URLSearchParams(location.search).get('n') || ''; } catch (e) { /* none */ }
    let done = ''; try { done = sessionStorage.getItem('ampb-embed-done') || ''; sessionStorage.setItem('ampb-embed-done', nonce); } catch (e) { /* none */ }
    if (next || (nonce && done === nonce)) { go('ops', true); return; }
    if (EMBED === 'continue') { try { enterSplash(); } catch (e) { /* straight in */ } go('ops', true); return; }
    if (EMBED === 'new' || EMBED === 'load' || EMBED === 'save') { panelOnly(EMBED); return; }
    go('ops', true);
  };
  // closing a panel shown on its own: back to the title screen
  const ownClose = ACTIONS['ts-panel-close'];
  ACTIONS['ts-panel-close'] = (el: HTMLElement, ev: Event) => {
    if (document.documentElement.classList.contains('ts-panel-only')) { embedTell('title'); return; }
    return ownClose(el, ev);
  };
  ACTIONS.exit = () => leaveAsk('quit', () => { try { saveNow(true); } catch (e) { /* saved already */ } embedTell('exit'); });
  ACTIONS['title-open'] = () => leaveAsk('title', () => { closeAll(); try { saveNow(true); } catch (e) { /* saved already */ } embedTell('title'); });
  // the 3D places: coming on Babylon.js
  const soon = (name: string) => () => { try { Sound.tick(); } catch (e) { /* muted */ } toast(`${name}: coming to the Babylon.js edition`, 'info'); return false; };
  const rooms: [any, string][] = [[OfficeRoom, 'Your office'], [OpsRoom, 'The Operations office'], [HangarRoom, 'The hangar'], [LoungeRoom, 'The lounge'], [CourtRoom, 'The courtroom'],
    [Museum, 'The museum'], [Salute, 'The water salute'], [TestRooms, 'The test rooms']];
  for (const [R, name] of rooms) if (R) R.open = soon(name);
  for (const a of ['photo-mode', 'hangar-visit', 'lounge-visit']) if (typeof (ACTIONS as any)[a] === 'function') (ACTIONS as any)[a] = soon('This 3D place');
  // the 3D view of a flight: the edition's 3D viewer
  W.v3dOpen = () => { try { saveNow(true); } catch (e) { /* saved */ } embedTell('viewer3d'); };
  ACTIONS['v3d-open'] = () => W.v3dOpen(); ACTIONS['apt-3d'] = () => W.v3dOpen();
  // the edition can ask for a save before it closes this page
  window.addEventListener('message', (e: MessageEvent) => { const d: any = e.data; if (d && d.ampb === 'save') { try { saveNow(true); } catch (err) { /* saved */ } embedTell('saved'); } });
}
