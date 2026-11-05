// Leaving the game: Quit and Back to the start screen ask first, then offer to save the game in a save slot
// (a real saved game, not only the automatic backup). And the autosave: Settings → Backup and restore → Autosave
// saves the game every 5 to 30 minutes in its own slot (game-21, shown as "Autosave" when loading).

const AUTO_SLOT = 21;
let _autoAt = Date.now();
function autosaveMeta(): any { try { return JSON.parse(localStorage.getItem('amp.gameAuto') || 'null'); } catch (e) { return null; } }
/** Save the game in the Autosave slot. */
function autosaveNow(): Promise<void> {
  try { Store.save(); } catch (e) { /* storage */ }
  const json = Backup.snapshot(); if (!json) return Promise.reject(new Error('nothing'));
  const co: any = company(), me: any = myPilot();
  return GameSaves.write(AUTO_SLOT, json).then(() => {
    try { localStorage.setItem('amp.gameAuto', JSON.stringify({ at: Date.now(), airline: co && co.name, icao: co && co.icao, balance: co && co.balance, pilot: me && me.name, fleet: State.fleet.filter((a: any) => !co || a.companyId === co.id).length, ver: APP.version })); } catch (e) { /* ignore */ }
  });
}
setInterval(() => {
  const m = parseInt(String((State.settings as any).autosaveMin || '0'), 10);
  if (!m || Date.now() - _autoAt < m * 60e3) return;
  if ((typeof TitleScreen !== 'undefined' && TitleScreen.on) || Store.nogame() || (typeof Mode !== 'undefined' && (Mode as any).switching)) return;
  _autoAt = Date.now();
  autosaveNow().then(() => { try { toast('Game autosaved', 'info'); } catch (e) { /* quiet */ } }).catch(() => { /* try again next time */ });
}, 20000);

/** The last slot you saved in or loaded (offered first when you leave). */
function lastSlot(): number { try { return +(localStorage.getItem('amp.lastSlot') || 0) || 0; } catch (e) { return 0; } }
function setLastSlot(i: number) { try { localStorage.setItem('amp.lastSlot', String(i)); } catch (e) { /* ignore */ } }

/** Ask before leaving, then offer to save. kind: 'quit' (closes the app) or 'title' (back to the start screen). */
function leaveAsk(kind: 'quit' | 'title', then: () => void) {
  if ($('.layer.leave-pop')) return;
  Sound.tick();
  const q = kind === 'quit' ? `Quit ${esc(APP.name)}?` : 'Back to the start screen?';
  const sub = kind === 'quit' ? 'Your airline keeps running while you are away.' : 'You can carry on from there with Continue.';
  const wrap = openLayer('modal', `<div class="leave">
      <h2>${q}</h2><p class="muted">${sub}</p>
      <div class="modal-actions center"><button class="btn primary" data-leave="yes">${icon(kind === 'quit' ? 'power' : 'play')}Yes, ${kind === 'quit' ? 'quit' : 'go back'}</button><button class="btn ghost" data-act="close-layer">No, stay</button></div></div>`, { cls: 'narrow leave-pop' });
  const yes = $('[data-leave=yes]', wrap) as HTMLElement;
  yes.addEventListener('click', () => { closeTop(); if (Store.nogame()) { then(); return; } setTimeout(() => leaveSave(kind, then), 220); });
}

/** Save before leaving: in the last slot used, the first empty one, or one you pick; or leave without saving. */
function leaveSave(kind: 'quit' | 'title', then: () => void) {
  const M = GameSaves.meta(), last = lastSlot(), empty = M.findIndex((m: any) => !m) + 1;
  const label = (i: number) => { const m = M[i - 1]; return m ? `${esc(m.airline || 'Airline')} · ${esc(dateStr(new Date(m.at)).slice(0, 10))}` : 'Empty'; };
  const grid = Array.from({ length: GameSaves.N }, (_, k) => k + 1).map(i => `<button class="ls-slot ${M[i - 1] ? 'used' : ''}" data-ls="${i}"><b>${String(i).padStart(2, '0')}</b><small>${label(i)}</small></button>`).join('');
  const wrap = openLayer('modal', `<div class="leave">
      <h2>Save your game?</h2><p class="muted">Save the whole airline in a save slot before you ${kind === 'quit' ? 'quit' : 'go'}. You can load it any time from the start screen.</p>
      <div class="ls-quick">
        ${last ? `<button class="btn primary" data-ls="${last}">${icon('download')}Save in slot ${last}<small>${label(last)}</small></button>` : ''}
        ${empty && empty !== last ? `<button class="btn ${last ? 'ghost' : 'primary'}" data-ls="${empty}">${icon('plus')}Save in a new slot (${empty})</button>` : ''}
        <button class="btn ghost" data-ls-pick>${icon('list')}Choose a slot</button>
      </div>
      <div class="ls-grid" hidden>${grid}</div>
      <div class="modal-actions center"><button class="btn ghost" data-ls-skip>Don't save, ${kind === 'quit' ? 'quit' : 'go back'}</button><button class="btn ghost" data-act="close-layer">Cancel</button></div></div>`, { cls: 'leave-pop leave-save' });
  const doSave = (i: number, el: HTMLElement) => {
    const go = () => {
      wrap.querySelectorAll('button').forEach((b: any) => b.disabled = true);
      GameSaves.save(i).then(() => { setLastSlot(i); Haptics.success(); toast(`Saved in slot ${i}`, 'ok'); closeTop(); setTimeout(then, 250); })
        .catch(() => { toast('The save couldn\'t be written', 'warn'); wrap.querySelectorAll('button').forEach((b: any) => b.disabled = false); });
    };
    if (M[i - 1] && el.closest('.ls-grid')) { if (el.classList.contains('ask')) { go(); return; } el.classList.add('ask'); el.querySelector('small').textContent = 'Tap again to overwrite'; return; }
    go();
  };
  wrap.addEventListener('click', (e: Event) => {
    const t = e.target as HTMLElement, b = t.closest('[data-ls]') as HTMLElement;
    if (b) { doSave(+b.getAttribute('data-ls'), b); return; }
    if (t.closest('[data-ls-pick]')) { const g = $('.ls-grid', wrap) as HTMLElement; g.hidden = !g.hidden; return; }
    if (t.closest('[data-ls-skip]')) { closeTop(); setTimeout(then, 200); }
  });
}

// Quit (the power button, Android's back at the top, Quit on the start screen) and back to the start screen
ACTIONS.exit = () => leaveAsk('quit', () => farewell());
ACTIONS['title-open'] = () => leaveAsk('title', () => {
  closeAll(); Sound.tick();
  try { saveNow(true); } catch (e) { /* ignore */ }
  titleOpen();
});
ACTIONS['ts-auto-game'] = el => {
  titleAsk(el, 'Are you sure you want to load the autosave?', 'Load', () => { GameSaves.read(AUTO_SLOT).then((t: string) => { if (!t) { toast('The autosave could not be read', 'warn'); return; } GameSaves.restoreText(t); }).catch(() => toast('The autosave could not be read', 'warn')); });
};
