// The airline game's interface (www/game: the Overview, the crew, the fleet, every menu and screen) over the whole
// screen, opened from the title screen: New game, Continue game, Load game, Save game or UI. Back to the title screen
// and Quit in it come here; the 3D view of a flight opens this edition's 3D viewer. Closed, it is taken away
// completely, so its memory goes back.
let frame: HTMLIFrameElement | null = null;
let handlers: { title: () => void; exit: () => void; viewer: () => void } | null = null;

export function gameOpen(act: 'new' | 'continue' | 'load' | 'save' | 'ui', on: { title: () => void; exit: () => void; viewer: () => void }) {
  gameClose(); handlers = on;
  const f = document.createElement('iframe'); f.className = 'game-frame'; f.setAttribute('title', 'Airline Manager Pro');
  f.setAttribute('allow', 'autoplay; fullscreen; gamepad; clipboard-write');
  f.src = `game/index.html?embed=${act}&n=${Date.now().toString(36)}`;
  document.body.appendChild(f); document.body.classList.add('game-on'); frame = f;
  requestAnimationFrame(() => f.classList.add('in'));
  setTimeout(() => { try { f.focus(); } catch (e) { /* later */ } }, 400);
}
export function gameIsOpen(): boolean { return !!frame; }
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
  else if (d.amp === 'viewer3d') { gameClose(); h.viewer(); }
});
